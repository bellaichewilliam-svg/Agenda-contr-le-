"""Essai (24/11, demande du patron : Machsanei HaShuk, 60 boulevard Binyamin, Netanya) : où la chaîne publie ses fichiers de prix
(loi de transparence des prix), quels magasins à Netanya et sous quels noms de fichiers.
Écrit livraison/data/mck-probe.json (seulement des magasins et des liens de fichiers publics, aucun client).
"""
from __future__ import annotations

import gzip
import io
import json
import re
import zipfile
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent.parent / "livraison" / "data" / "mck-probe.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}
# Machsanei HaShuk : numéros de chaîne possibles (le bon est dans les noms de fichiers)
IDS = ["7290661400001", "7290633800006", "7290700100008"]
PAGES = [
    "https://laibcatalog.co.il/",
    "https://laibcatalog.co.il/NBCompetitionRegulations.aspx",
    "http://matrixcatalog.co.il/NBCompetitionRegulations.aspx",
    "https://www.mck.co.il/",
    "https://www.mck.co.il/prices",
    "https://prices.mck.co.il/",
]


def unpack(raw: bytes) -> str:
    try:
        raw = gzip.decompress(raw)
    except Exception:
        try:
            z = zipfile.ZipFile(io.BytesIO(raw)); raw = z.read(z.namelist()[0])
        except Exception:
            pass
    for enc in ("utf-8", "utf-16", "windows-1255"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "ignore")


def main() -> int:
    res = {"pages": {}, "files": [], "stores": []}
    s = requests.Session(); s.headers.update(UA)
    for url in PAGES:
        try:
            r = s.get(url, timeout=60)
            t = r.text
            fl = sorted(set(re.findall(r'(?:fname=|/)((?:Stores|PriceFull|PromoFull|Price|Promo)\d{13}[^"\'<>\s&]*)', t)))
            res["pages"][url] = {"status": r.status_code, "len": len(t), "title": (re.findall(r"<title>([^<]{0,80})", t) or [""])[0].strip(),
                                 "chains": sorted(set(re.findall(r"(?:Stores|Price|Promo)(?:Full)?(\d{13})", t)))[:40],
                                 "links_mck": [f for f in fl if any(i in f for i in IDS)][:40]}
            for f in res["pages"][url]["links_mck"]:
                full = re.search(r'href="([^"]*' + re.escape(f) + r'[^"]*)"', t)
                res["files"].append({"page": url, "file": f, "href": full.group(1).replace("&amp;", "&") if full else ""})
        except Exception as e:
            res["pages"][url] = {"error": str(e)[:200]}
    # fichier des magasins : chercher Netanya / Binyamin
    for f in res["files"]:
        if not f["file"].startswith("Stores") or not f["href"]:
            continue
        href = f["href"] if f["href"].startswith("http") else re.sub(r"/[^/]*$", "/", f["page"]) + f["href"].lstrip("/")
        try:
            xml = unpack(s.get(href, timeout=120).content)
            for blk in re.findall(r"<Store>(.*?)</Store>", xml, re.S | re.I):
                if re.search("נתניה|בנימין|Netanya", blk, re.I):
                    g = lambda k: (re.findall(rf"<{k}>([^<]*)</{k}>", blk, re.I) or [""])[0]
                    res["stores"].append({"id": g("StoreId") or g("StoreID"), "name": g("StoreName"), "address": g("Address"), "city": g("City")})
            break
        except Exception as e:
            res["stores_error"] = str(e)[:200]
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False)[:4000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
