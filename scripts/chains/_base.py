"""Outils communs pour parser les flux XML des supermarchés israéliens.

Tous les flux suivent un schéma proche défini par la loi de transparence
des prix (2014). Les fichiers sont compressés (.gz, .zip) et contiennent
un XML avec une structure du type :

    <Root>
        <ChainId>...</ChainId>
        <StoreId>...</StoreId>
        <Items>
            <Item>
                <ItemCode>...</ItemCode>
                <ItemName>...</ItemName>
                <ItemPrice>...</ItemPrice>
                <Manufacturer>...</Manufacturer>
                <UnitOfMeasure>...</UnitOfMeasure>
                <Quantity>...</Quantity>
            </Item>
            ...
        </Items>
    </Root>

Les noms exacts des balises varient légèrement (PriceUpdateDate vs.
PriceTime, Item vs. Product…). On essaie plusieurs alias.
"""
from __future__ import annotations

import gzip
import io
import logging
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Optional
from xml.etree import ElementTree as ET

import requests

log = logging.getLogger(__name__)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
TIMEOUT = 60


@dataclass
class PriceItem:
    """Une ligne produit-prix-magasin extraite d'un flux."""
    chain: str             # identifiant chaîne ("rami_levy", "shufersal"...)
    store_id: str          # numéro de magasin spécifique
    item_code: str         # code-barres / item ID
    name: str              # nom hébreu du produit
    price: float           # prix en ILS
    manufacturer: str = ""
    unit: str = ""
    quantity: float = 0.0

    def to_dict(self) -> dict:
        return {
            "chain": self.chain,
            "store_id": self.store_id,
            "code": self.item_code,
            "name": self.name,
            "price": self.price,
            "manufacturer": self.manufacturer,
            "unit": self.unit,
            "qty": self.quantity,
        }


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.7,fr;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    return s


def fetch(url: str, sess: Optional[requests.Session] = None, **kwargs) -> bytes:
    """GET avec timeout et UA."""
    s = sess or session()
    log.info("GET %s", url)
    r = s.get(url, timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r.content


def decompress(data: bytes, filename: str = "") -> bytes:
    """Détecte gz / zip / brut et renvoie l'XML décompressé."""
    if data[:2] == b"\x1f\x8b" or filename.endswith(".gz"):
        return gzip.decompress(data)
    if data[:2] == b"PK" or filename.endswith(".zip"):
        z = zipfile.ZipFile(io.BytesIO(data))
        # plus gros fichier dans l'archive
        biggest = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
        return z.read(biggest)
    return data


def _findtext(el: ET.Element, *names: str) -> str:
    """Renvoie le premier .text non-vide pour les balises listées."""
    for n in names:
        for sub in el.iter(n):
            if sub.text and sub.text.strip():
                return sub.text.strip()
    return ""


def parse_xml_items(xml_bytes: bytes, chain: str) -> Iterator[PriceItem]:
    """Parser générique compatible avec la majorité des flux (Shufersal,
    publishedprices.co.il, matrixcatalog…)."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        log.warning("XML parse error pour %s: %s", chain, e)
        return

    store_id = _findtext(root, "StoreId", "StoreID", "SubChainId")

    items_parents = list(root.iter("Items")) + list(root.iter("Products"))
    for parent in items_parents:
        for item_el in list(parent):
            try:
                code = _findtext(item_el, "ItemCode", "ItemId", "Barcode")
                name = _findtext(item_el, "ItemName", "ItemNm", "ProductName")
                price_str = _findtext(item_el, "ItemPrice", "Price", "UnitOfMeasurePrice")
                if not (code and name and price_str):
                    continue
                try:
                    price = float(price_str)
                except ValueError:
                    continue
                yield PriceItem(
                    chain=chain,
                    store_id=store_id,
                    item_code=code,
                    name=name,
                    price=price,
                    manufacturer=_findtext(item_el, "Manufacturer", "ManufactureName", "ManufacturerName"),
                    unit=_findtext(item_el, "UnitOfMeasure", "Unit", "UnitQty"),
                    quantity=_to_float(_findtext(item_el, "Quantity", "QuantityInPackage", "UnitOfMeasureQty")),
                )
            except Exception as e:
                log.debug("Item parse error: %s", e)


def _to_float(s: str) -> float:
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        m = re.search(r"[\d.]+", s)
        return float(m.group()) if m else 0.0


@dataclass
class PromoItem:
    """Une promotion extraite d'un fichier PromoFull."""
    chain: str
    store_id: str
    promo_id: str
    description: str           # texte de la promo en hébreu
    discount_type: str         # "discount", "amount", "n_for_m", "free", etc.
    min_qty: float             # quantité minimale pour déclencher
    discount_rate: float       # % de réduction (0-100)
    discounted_price: float    # prix après réduction (si applicable)
    valid_from: str
    valid_until: str
    item_codes: list           # liste des item_codes qui bénéficient
    raw_type: str = ""         # type brut depuis le XML

    def to_dict(self) -> dict:
        return {
            "chain": self.chain,
            "store_id": self.store_id,
            "promo_id": self.promo_id,
            "description": self.description,
            "type": self.discount_type,
            "min_qty": self.min_qty,
            "discount_rate": self.discount_rate,
            "discounted_price": self.discounted_price,
            "valid_from": self.valid_from,
            "valid_until": self.valid_until,
            "items": self.item_codes,
            "raw_type": self.raw_type,
        }


def parse_xml_promos(xml_bytes: bytes, chain: str) -> Iterator[PromoItem]:
    """Parser générique des fichiers PromoFull. Chaque chaîne publie un
    schéma proche : <Promotions><Promotion>...</Promotion></Promotions>
    avec des balises PromotionDescription, MinQty, DiscountedPrice, etc.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        log.warning("Promo XML parse error pour %s: %s", chain, e)
        return

    store_id = _findtext(root, "StoreId", "StoreID")

    parents = list(root.iter("Promotions")) + list(root.iter("Sales"))
    for parent in parents:
        for promo_el in list(parent):
            try:
                promo_id = _findtext(promo_el, "PromotionId", "PromotionID", "SaleId")
                desc = _findtext(promo_el, "PromotionDescription", "SaleDescription", "Description")
                if not desc:
                    continue
                # Extraction infos numériques
                min_qty = _to_float(_findtext(promo_el, "MinQty", "MinimumQty", "MinPurchaseAmnt"))
                discount_rate = _to_float(_findtext(promo_el, "DiscountRate", "DiscountedPricePerMida"))
                discounted_price = _to_float(_findtext(promo_el, "DiscountedPrice", "MinAmount"))
                discount_type = _findtext(promo_el, "DiscountType", "Reward")

                valid_from = _findtext(promo_el, "PromotionStartDate", "PromotionStart")
                valid_until = _findtext(promo_el, "PromotionEndDate", "PromotionEnd", "PromoEnd")

                # Items concernés
                item_codes = []
                for it in promo_el.iter("PromotionItems"):
                    for sub in it.iter("Item"):
                        code = _findtext(sub, "ItemCode", "ItemId")
                        if code:
                            item_codes.append(code)
                # Fallback : sometimes items are direct children
                if not item_codes:
                    for sub in promo_el.iter("Item"):
                        code = _findtext(sub, "ItemCode", "ItemId")
                        if code:
                            item_codes.append(code)

                # Classification heuristique du type
                norm_type = "unknown"
                desc_lower = desc.lower() if desc else ""
                if min_qty >= 2 and discounted_price > 0:
                    norm_type = "n_for_price"
                elif "1+1" in desc or "2 ב" in desc:
                    norm_type = "buy_one_get_one"
                elif "%" in desc or discount_rate > 0:
                    norm_type = "discount_pct"
                elif discounted_price > 0:
                    norm_type = "fixed_price"
                else:
                    norm_type = "discount"

                yield PromoItem(
                    chain=chain,
                    store_id=store_id,
                    promo_id=promo_id,
                    description=desc,
                    discount_type=norm_type,
                    min_qty=min_qty,
                    discount_rate=discount_rate,
                    discounted_price=discounted_price,
                    valid_from=valid_from,
                    valid_until=valid_until,
                    item_codes=item_codes,
                    raw_type=discount_type,
                )
            except Exception as e:
                log.debug("Promo parse error: %s", e)
