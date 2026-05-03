"""Scraper générique pour les chaînes publiant sur publishedprices.co.il.

Le portail centralise plusieurs enseignes derrière un login (les
identifiants sont publics conformément à la loi de transparence des prix).

URL : https://url.publishedprices.co.il/
- POST /login/user (username + password)
- GET /file/json/dir?cd=/  (liste JSON)
- GET /file/d/<filename>   (téléchargement)

Identifiants connus (à vérifier au 1er run) :
- Rami Levy   -> RamiLevi      (mot de passe vide)
- Tiv Taam    -> TivTaam       (vide)
- Yenot Bitan -> Yenotbitan    (vide)        [Carrefour Israël]
- Mega        -> doralon       (vide)
- Osher Ad    -> osherad       (vide)
- Hatzi Hinam -> HaziHinam     (vide)
- SuperPharm  -> superpharm    (vide)
- Yochananof  -> yohananof     (vide)        [aussi sur leur propre serveur]
"""
from __future__ import annotations

import logging
import re
from typing import Iterator, List

import requests

from ._base import PriceItem, decompress, parse_xml_items, session

log = logging.getLogger(__name__)

BASE = "https://url.publishedprices.co.il"


def _login(sess: requests.Session, user: str, password: str = "") -> bool:
    """Effectue le login et garde le cookie de session."""
    # 1) GET la page de login pour récupérer le cookie initial + csrf
    r = sess.get(f"{BASE}/login", timeout=30)
    csrf = ""
    m = re.search(r'name="csrftoken"\s+value="([^"]+)"', r.text)
    if m:
        csrf = m.group(1)
    # 2) POST des credentials
    payload = {"username": user, "password": password, "csrftoken": csrf}
    r = sess.post(f"{BASE}/login/user", data=payload, timeout=30, allow_redirects=True)
    # 3) Vérifier qu'on a accès en interrogeant la liste
    r = sess.get(f"{BASE}/file/json/dir?iDisplayLength=1&cd=%2F", timeout=30)
    return r.ok and "aaData" in r.text


def _list_price_full(sess: requests.Session) -> List[str]:
    """Liste les fichiers PriceFull dispo dans le compte connecté."""
    out = []
    # On itère par pages au cas où il y en a beaucoup
    for start in range(0, 500, 100):
        r = sess.get(
            f"{BASE}/file/json/dir",
            params={"iDisplayLength": 100, "iDisplayStart": start, "cd": "/"},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        rows = data.get("aaData", [])
        if not rows:
            break
        for row in rows:
            # Le 1er champ est typiquement un lien HTML <a href="..." ou juste le nom
            html = row[0] if isinstance(row, list) and row else ""
            m = re.search(r'href="([^"]+)"', html) or re.search(r"(PriceFull[\w.\-]+)", html)
            fname = m.group(1) if m else (html if isinstance(html, str) else "")
            if "PriceFull" in fname and (fname.endswith(".gz") or fname.endswith(".zip")):
                out.append(fname.split("/")[-1])
    return out


def fetch_items(chain: str, user: str, password: str = "", max_files: int = 1) -> Iterator[PriceItem]:
    """Connecte au compte `user` et yield les items du 1er PriceFull trouvé."""
    sess = session()
    try:
        if not _login(sess, user, password):
            log.warning("%s : login échoué (user=%s)", chain, user)
            return
    except Exception as e:
        log.error("%s : exception login : %s", chain, e)
        return

    try:
        files = _list_price_full(sess)
    except Exception as e:
        log.error("%s : impossible de lister les fichiers : %s", chain, e)
        return

    if not files:
        log.warning("%s : aucun PriceFull trouvé", chain)
        return

    for fname in files[:max_files]:
        try:
            r = sess.get(f"{BASE}/file/d/{fname}", timeout=120)
            r.raise_for_status()
            xml = decompress(r.content, fname)
            count = 0
            for it in parse_xml_items(xml, chain):
                count += 1
                yield it
            log.info("%s : %d items parsés depuis %s", chain, count, fname)
        except Exception as e:
            log.error("%s : échec sur %s : %s", chain, fname, e)
