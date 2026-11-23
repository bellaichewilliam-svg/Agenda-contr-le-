"""Photos d'un nouveau commerce (demande du patron, 23/11 : restaurant Shiso) : télécharge les images publiques du site du
commerce, les met au format de l'appli (.webp léger, 640 px au plus, fond blanc) et les range dans livraison/img/<dossier>/.
Utilisé par le robot GitHub (le site du commerce n'est pas joignable depuis l'outil de travail).

Fichier d'entrée (JSON) : {"dir": "shiso", "items": [{"url": "...", "out": "p02.webp", "max": 640}, ...]}
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import requests
from PIL import Image

try:  # logos en .avif
    import pillow_avif  # noqa: F401
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent / "livraison" / "img"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}


def main(spec_path: str) -> int:
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8"))
    out_dir = ROOT / spec["dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    ok = bad = 0
    for it in spec["items"]:
        dest = out_dir / it["out"]
        try:
            r = requests.get(it["url"], headers=UA, timeout=60)
            r.raise_for_status()
            if it["out"].endswith(".pdf"):  # menu en PDF (ex. Raffaello) : gardé tel quel pour être lu ensuite
                dest = Path(__file__).resolve().parent.parent / "livraison" / "data" / "menus" / it["out"]
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(r.content)
                ok += 1
                print(f"ok {it['out']} {len(r.content) // 1024} Ko (PDF)")
                continue
            im = Image.open(io.BytesIO(r.content))
            im.load()
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                bg = Image.new("RGB", im.size, (255, 255, 255))
                bg.paste(im, mask=im.split()[-1])
                im = bg
            else:
                im = im.convert("RGB")
            m = int(it.get("max", 640))
            im.thumbnail((m, m))
            q = 80
            while True:
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=q, method=6)
                if buf.tell() <= 70_000 or q <= 55:
                    break
                q -= 8
            dest.write_bytes(buf.getvalue())
            ok += 1
            print(f"ok {it['out']} {buf.tell() // 1024} Ko")
        except Exception as e:  # noqa: BLE001  (une photo manquante n'arrête pas les autres)
            bad += 1
            print(f"ERREUR {it['out']} : {e}", file=sys.stderr)
    print(f"{ok} photos, {bad} erreurs")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
