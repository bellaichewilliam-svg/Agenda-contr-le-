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

from ._base import PriceItem, PromoItem, decompress, parse_xml_items, parse_xml_promos, session

log = logging.getLogger(__name__)

BASE = "https://url.publishedprices.co.il"


def _login(sess: requests.Session, user: str, password: str = "") -> bool:
    """Effectue le login et garde le cookie de session.
    Logue précisément à chaque étape pour debug."""
    log.info("[%s] Étape 1 : GET login page", user)
    try:
        r = sess.get(f"{BASE}/login", timeout=30)
        log.info("[%s] login GET status=%d, content-len=%d", user, r.status_code, len(r.text))
        if not r.ok:
            log.warning("[%s] login GET failed", user)
            return False
    except Exception as e:
        log.error("[%s] login GET exception: %s", user, e)
        return False

    csrf = ""
    m = re.search(r'name=["\']csrftoken["\']\s+value=["\']([^"\']+)["\']', r.text)
    if m:
        csrf = m.group(1)
        log.info("[%s] csrf token trouvé: %s", user, csrf[:16] + "...")
    else:
        log.warning("[%s] csrf token NON trouvé dans la page", user)

    log.info("[%s] Étape 2 : POST credentials", user)
    payload = {"username": user, "password": password, "csrftoken": csrf}
    try:
        r = sess.post(f"{BASE}/login/user", data=payload, timeout=30, allow_redirects=True)
        log.info("[%s] login POST status=%d, final URL=%s", user, r.status_code, r.url)
    except Exception as e:
        log.error("[%s] login POST exception: %s", user, e)
        return False

    log.info("[%s] Étape 3 : test accès liste fichiers", user)
    try:
        r = sess.get(f"{BASE}/file/json/dir?iDisplayLength=1&cd=%2F", timeout=30)
        ok = r.ok and "aaData" in r.text
        log.info("[%s] file/json/dir status=%d, ok=%s, sample=%s", user, r.status_code, ok, r.text[:200])
        return ok
    except Exception as e:
        log.error("[%s] file/json/dir exception: %s", user, e)
        return False


def _list_files_pattern(sess: requests.Session, pattern: str) -> List[str]:
    """Liste les fichiers matchant un pattern (PriceFull ou PromoFull)."""
    out = []
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
            html = row[0] if isinstance(row, list) and row else ""
            m = re.search(r'href="([^"]+)"', html) or re.search(rf"({pattern}[\w.\-]+)", html)
            fname = m.group(1) if m else (html if isinstance(html, str) else "")
            if pattern in fname and (fname.endswith(".gz") or fname.endswith(".zip")):
                out.append(fname.split("/")[-1])
    return out


def _list_price_full(sess: requests.Session) -> List[str]:
    """Liste les fichiers PriceFull."""
    return _list_files_pattern(sess, "PriceFull")


def _list_promo_full(sess: requests.Session) -> List[str]:
    """Liste les fichiers PromoFull."""
    return _list_files_pattern(sess, "PromoFull")


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


def fetch_promos(chain: str, user: str, password: str = "", max_files: int = 1) -> Iterator[PromoItem]:
    """Connecte au compte `user` et yield les promos du 1er PromoFull."""
    sess = session()
    try:
        if not _login(sess, user, password):
            log.warning("%s promos : login échoué", chain)
            return
    except Exception as e:
        log.error("%s promos : exception login : %s", chain, e)
        return

    try:
        files = _list_promo_full(sess)
    except Exception as e:
        log.error("%s : impossible de lister les PromoFull : %s", chain, e)
        return

    if not files:
        log.warning("%s : aucun PromoFull trouvé", chain)
        return

    for fname in files[:max_files]:
        try:
            r = sess.get(f"{BASE}/file/d/{fname}", timeout=120)
            r.raise_for_status()
            xml = decompress(r.content, fname)
            count = 0
            for it in parse_xml_promos(xml, chain):
                count += 1
                yield it
            log.info("%s : %d promos parsées depuis %s", chain, count, fname)
        except Exception as e:
            log.error("%s promos : échec sur %s : %s", chain, fname, e)
