"""Scraper Shufersal.

Endpoint public, sans login : http://prices.shufersal.co.il/
Les fichiers sont listés sur la page d'accueil. On cherche les
PriceFull (catalogue complet) le plus récent, on prend un magasin
représentatif (Tel-Aviv) pour avoir un échantillon.
"""
from __future__ import annotations

import logging
import re
from typing import Iterator, List

from ._base import PriceItem, PromoItem, decompress, fetch, parse_xml_items, parse_xml_promos, session

log = logging.getLogger(__name__)

INDEX_URL = "http://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2&storeId=0"
HOME_URL = "http://prices.shufersal.co.il/"

CHAIN = "shufersal"


def _list_files() -> List[str]:
    """Liste les fichiers PriceFull sur l'index. Le HTML contient des
    liens directs vers les .gz."""
    sess = session()
    try:
        html = fetch(INDEX_URL, sess=sess).decode("utf-8", errors="ignore")
    except Exception:
        html = fetch(HOME_URL, sess=sess).decode("utf-8", errors="ignore")
    # liens absolus vers les .gz
    urls = re.findall(r'https?://[^\s"\']+PriceFull[^\s"\']+\.gz', html)
    return list(dict.fromkeys(urls))  # dédup en préservant l'ordre


def fetch_items(max_files: int = 1) -> Iterator[PriceItem]:
    """Renvoie les items des `max_files` premiers PriceFull trouvés."""
    files = _list_files()
    if not files:
        log.warning("Shufersal : aucun fichier PriceFull trouvé sur l'index")
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


def _list_promo_files() -> list:
    """Liste les fichiers PromoFull (promotions complètes) sur l'index."""
    sess = session()
    try:
        html = fetch(HOME_URL, sess=sess).decode("utf-8", errors="ignore")
    except Exception:
        return []
    urls = re.findall(r'https?://[^\s"\']+PromoFull[^\s"\']+\.gz', html)
    return list(dict.fromkeys(urls))


def fetch_promos(max_files: int = 1) -> Iterator[PromoItem]:
    """Renvoie les promotions des `max_files` premiers PromoFull."""
    files = _list_promo_files()
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
