"""Essai (23/11, demande du patron : Shufersal et Universe) : le site des prix de Shufersal est-il lisible depuis le robot GitHub,
quels magasins à Netanya (Shufersal et Universe, qui appartient à Shufersal), et sous quels noms de fichiers ?
Écrit livraison/data/shufersal-probe.json (aucun nom de client, seulement des magasins et des liens de fichiers publics).
"""
from __future__ import annotations

import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

BASE = "https://prices.shufersal.co.il"
OUT = Path(__file__).resolve().parent.parent / "livraison" / "data" / "shufersal-probe.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}


def links(html: str) -> list[str]:
    out = re.findall(r'href="(https?://[^"]+\.(?:gz|xml)[^"]*)"', html)
    return [x.replace("&amp;", "&") for x in out]


def main() -> int:
    res = {"ok": False, "pages": {}, "stores": [], "files": {}}
    s = requests.Session(); s.headers.update(UA)
    try:
        r = s.get(BASE + "/", timeout=60)
        res["pages"]["home"] = {"status": r.status_code, "len": len(r.text),
                                "selects": re.findall(r'<option value="(\d+)"[^>]*>([^<]{1,40})</option>', r.text)[:80]}
        # catID : 1 Prices, 2 PricesFull, 3 Promos, 4 PromosFull, 5 Stores (selon le site)
        for cat in (5, 2, 4):
            rr = s.get(f"{BASE}/FileObject/UpdateCategory?catID={cat}&storeId=0&page=1", timeout=60)
            ls = links(rr.text)
            res["files"][str(cat)] = {"status": rr.status_code, "count": len(ls), "sample": [re.sub(r"\?.*", "", x) for x in ls[:15]]}
            if cat == 5 and ls:
                raw = s.get(ls[0], timeout=120).content
                try:
                    raw = gzip.decompress(raw)
                except OSError:
                    pass
                root = ET.fromstring(raw.lstrip(b"\xef\xbb\xbf"))
                for st in root.iter():
                    if st.tag.upper() != "STORE":
                        continue
                    g = {c.tag.upper(): (c.text or "").strip() for c in st}
                    if "נתני" in " ".join(g.values()) or g.get("CITY") in ("7400", "נתניה"):
                        res["stores"].append({k: g.get(k, "") for k in ("STOREID", "STORENAME", "ADDRESS", "CITY", "SUBCHAINNAME", "CHAINID")})
        res["ok"] = True
    except Exception as e:  # noqa: BLE001
        res["error"] = repr(e)[:300]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
