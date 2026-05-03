"""Scraper pour le portail Matrix : http://matrixcatalog.co.il/

Hébergement de plusieurs enseignes :
- Victory   (chain ID 7290696200003)
- Hashuk
- Stop Market
- Politzer
- Super Cofix
- ...

Pas de login. La page liste les fichiers récents avec liens directs.
"""
from __future__ import annotations

import logging
import re
from typing import Iterator, List

from ._base import PriceItem, decompress, fetch, parse_xml_items, session

log = logging.getLogger(__name__)

INDEX = "http://matrixcatalog.co.il/NBCompetitionRegulations.aspx"
BASE = "http://matrixcatalog.co.il/"


def _list_files(chain_id: str) -> List[str]:
    sess = session()
    try:
        html = fetch(INDEX, sess=sess).decode("utf-8", errors="ignore")
    except Exception as e:
        log.error("Matrix : index inaccessible : %s", e)
        return []
    # liens type "Download.ashx?fname=PriceFull7290696200003-001-...gz"
    pattern = rf'(Download\.ashx\?fname=PriceFull{chain_id}-[^\s"\'<>]+)'
    matches = re.findall(pattern, html)
    return [BASE + m for m in dict.fromkeys(matches)]


def fetch_items(chain_name: str, chain_id: str, max_files: int = 1) -> Iterator[PriceItem]:
    files = _list_files(chain_id)
    if not files:
        log.warning("%s : aucun fichier trouvé sur Matrix (chain_id=%s)", chain_name, chain_id)
        return
    sess = session()
    for url in files[:max_files]:
        try:
            data = fetch(url, sess=sess)
            xml = decompress(data, url)
            count = 0
            for it in parse_xml_items(xml, chain_name):
                count += 1
                yield it
            log.info("%s : %d items parsés", chain_name, count)
        except Exception as e:
            log.error("%s : échec sur %s : %s", chain_name, url, e)
