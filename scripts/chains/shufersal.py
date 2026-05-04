"""Scraper Shufersal.

Endpoint public, sans login : http://prices.shufersal.co.il/

Le site a 2 modes :
1. Page HTML avec table des fichiers (URL relatives via ?download=)
2. Endpoint JSON /FileObject/UpdateCategory?catID=N&storeId=0 (DataTables)

On essaie plusieurs combinaisons pour maximiser les chances.

catID typiques :
- 0 : tous
- 1 : Stores
- 2 : Prices (PriceFull)
- 3 : Promos (PromoFull)
- 4 : PriceFullAll
- 5 : PromoFullAll
"""
from __future__ import annotations

import json
import logging
import re
from typing import Iterator, List
from urllib.parse import urljoin

from ._base import PriceItem, PromoItem, decompress, fetch, parse_xml_items, parse_xml_promos, session

log = logging.getLogger(__name__)

BASE = "https://prices.shufersal.co.il"
HOME_URL = f"{BASE}/"

CHAIN = "shufersal"


def _list_files_for_pattern(pattern: str, cat_id: int) -> List[str]:
    """Liste les fichiers matchant le pattern (PriceFull / PromoFull)
    en essayant plusieurs endpoints connus."""
    sess = session()
    urls: List[str] = []

    # Essai 1 : endpoint JSON DataTables
    json_urls = [
        f"{BASE}/FileObject/UpdateCategory?catID={cat_id}&storeId=0",
        f"{BASE}/FileObject/GetFileObjects?catID={cat_id}",
    ]
    for jurl in json_urls:
        try:
            r = sess.get(jurl, timeout=30)
            if not r.ok:
                continue
            text = r.text
            # Cherche tous les noms de fichiers .gz dans la réponse
            matches = re.findall(rf'({pattern}[\w.\-]+\.gz)', text)
            for fname in matches:
                # Construit l'URL de téléchargement
                full_url = f"{BASE}/FileObject/Download/{fname}"
                if full_url not in urls:
                    urls.append(full_url)
            # Cherche aussi des liens HTML/JSON avec href
            href_matches = re.findall(r'href=["\']([^"\']+\.gz)["\']', text, re.IGNORECASE)
            for href in href_matches:
                if pattern in href:
                    full_url = href if href.startswith("http") else urljoin(BASE, href)
                    if full_url not in urls:
                        urls.append(full_url)
            # JSON-style "url"
            url_matches = re.findall(r'"(https?://[^"]+\.gz)"', text)
            for u in url_matches:
                if pattern in u and u not in urls:
                    urls.append(u)
            if urls:
                log.info("Shufersal: %d fichiers via %s", len(urls), jurl)
                break
        except Exception as e:
            log.debug("Shufersal endpoint %s failed: %s", jurl, e)

    # Essai 2 : page HTML accueil
    if not urls:
        try:
            r = sess.get(HOME_URL, timeout=30)
            if r.ok:
                text = r.text
                matches = re.findall(rf'(?:href=["\']|"|=)([^"\'\s<>]*{pattern}[\w.\-]+\.gz)', text)
                for m in matches:
                    full_url = m if m.startswith("http") else urljoin(BASE, m)
                    if full_url not in urls:
                        urls.append(full_url)
                log.info("Shufersal home page: %d urls trouvées", len(urls))
        except Exception as e:
            log.error("Shufersal home page failed: %s", e)

    return urls


def fetch_items(max_files: int = 1) -> Iterator[PriceItem]:
    """Renvoie les items des `max_files` premiers PriceFull trouvés."""
    files = _list_files_for_pattern("PriceFull", 2)
    if not files:
        log.warning("Shufersal : aucun fichier PriceFull trouvé")
        return
    sess = session()
    for url in files[:max_files]:
        try:
            data = fetch(url, sess=sess)
            xml = decompress(data, url)
            count = 0
            for it in parse_xml_items(xml, CHAIN):
                count += 1
                yield it
            log.info("Shufersal : %d items parsés depuis %s", count, url)
        except Exception as e:
            log.error("Shufersal : échec sur %s : %s", url, e)


def fetch_promos(max_files: int = 1) -> Iterator[PromoItem]:
    """Renvoie les promotions des `max_files` premiers PromoFull."""
    files = _list_files_for_pattern("PromoFull", 3)
    if not files:
        log.warning("Shufersal : aucun fichier PromoFull trouvé")
        return
    sess = session()
    for url in files[:max_files]:
        try:
            data = fetch(url, sess=sess)
            xml = decompress(data, url)
            count = 0
            for it in parse_xml_promos(xml, CHAIN):
                count += 1
                yield it
            log.info("Shufersal : %d promos parsées depuis %s", count, url)
        except Exception as e:
            log.error("Shufersal promos : échec sur %s : %s", url, e)
