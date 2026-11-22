"""Tous les prix de Mahsanei Lahav Netanya (מחסני להב, קניון השרון), refaits une fois par semaine.

Source : fichiers officiels de la loi sur la transparence des prix (url.publishedprices.co.il, compte public « freshmarket » :
Mahsanei Lahav appartient à Freshmarket ; Netanya = magasin 022).
Sortie : livraison/data/lahav-prix.json  {"store": "022", "at": "AAAA-MM-JJ", "items": [[code-barres, nom hébreu, prix, au poids], …]}
La base le lit chaque semaine (lahav_items) : recherche « dans tout le magasin » et comparateur de prix (par code-barres).
"""
from __future__ import annotations

import datetime as dt
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ramilevy_promos import BANNED, num  # mêmes règles que Rami Lévy (sans alcool ni tabac)

BASE = "https://url.publishedprices.co.il"
USER = "freshmarket"
CHAIN = "7290876100000"
STORE = "022"
OUT = Path(__file__).resolve().parent.parent / "livraison" / "data" / "lahav-prix.json"
MIN_OK = 3000   # fichier trop court = cassé : on garde l'ancien


def csrf(html: str) -> str:
    m = re.search(r'csrftoken"[^>]*?(?:content|value)="([^"]+)"', html)
    return m.group(1) if m else ""


def main() -> int:
    today = dt.date.today()
    try:
        last = dt.date.fromisoformat(json.loads(OUT.read_text(encoding="utf-8")).get("at", "2000-01-01"))
    except (OSError, ValueError):
        last = dt.date(2000, 1, 1)
    if (today - last).days < 7 and "--force" not in sys.argv:
        print("lahav : déjà à jour cette semaine")
        return 0
    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    r = s.get(BASE + "/login", timeout=40); r.raise_for_status()
    r = s.post(BASE + "/login/user", data={"username": USER, "password": "", "csrftoken": csrf(r.text), "r": ""}, timeout=40); r.raise_for_status()
    r = s.get(BASE + "/file", timeout=40); tok = csrf(r.text)
    r = s.post(BASE + "/file/json/dir", timeout=90, data={"sEcho": 1, "iColumns": 5, "iDisplayStart": 0, "iDisplayLength": 1000,
                                                       "sSearch": f"-{STORE}-", "cd": "/", "csrftoken": tok})
    r.raise_for_status()
    names = [x.get("fname") or x.get("name") or "" for x in r.json().get("aaData", [])]
    names = sorted(n for n in names if n.startswith(f"PriceFull{CHAIN}-") and f"-{STORE}-" in n and n.endswith(".gz"))
    if not names:
        print("lahav : aucun fichier PriceFull"); return 1
    raw = gzip.decompress(s.get(f"{BASE}/file/d/{names[-1]}", timeout=300).content)
    root = ET.fromstring(raw.lstrip(b"\xef\xbb\xbf"))
    rows = []
    for it in root.iter("Item"):
        code = (it.findtext("ItemCode") or "").strip()
        name = re.sub(r"\s+", " ", (it.findtext("ItemName") or "").strip())
        price = num(it.findtext("ItemPrice"))
        if not code or not name or price <= 0 or price > 5000 or BANNED.search(name + " "):
            continue
        rows.append([code, name, round(price, 2), 1 if (it.findtext("bIsWeighted") or "").strip() == "1" else 0])
    if len(rows) < MIN_OK:
        print(f"lahav : seulement {len(rows)} produits, on garde l'ancien fichier"); return 1
    rows.sort(key=lambda x: (x[1], x[0]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"store": STORE, "at": today.isoformat(), "items": rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("écrit :", OUT, f"({len(rows)} produits)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
