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

UA = "Mozilla/5.0 (compatible; PrixMalinBot/1.0; +https://github.com/bellaichewilliam-svg/Agenda-contr-le-)"
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
    s.headers.update({"User-Agent": UA, "Accept-Language": "he,en;q=0.5"})
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
