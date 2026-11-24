#!/usr/bin/env python3
# Fabrique d5-auto.css (patron, 24/11 : « plus de noir, plus de bleu nuit, plus d'orange, sauf le « ! » du logo »).
# L'ancien design (html.d3 dans styles.css) a des centaines de couleurs écrites en dur (#111418 noir, #0F1F3D bleu nuit,
# #E8590C orange…). Ce script relit styles.css et écrit, pour chaque règle html.d3 qui en contient, la même règle en
# html.d5 avec la couleur de la nouvelle palette (--ink, bleu mer foncé). d5-auto.css est chargé juste avant d5.css,
# donc les réglages faits à la main dans d5.css passent toujours par-dessus.
# À relancer après une modification de styles.css :  python3 d5-couleurs.py
import re, pathlib

here = pathlib.Path(__file__).parent
css = (here / "styles.css").read_text()
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

DARK = r"#111418|#0F1F3D|#0B1830|#13233F|#172A4B|#111|#000(?![0-9a-f])|#000000"
ORANGE = r"#E8590C|#C94A07|#B5440A|#FF6A13|#E0520A|#FF7A2F"
ANY = re.compile(rf"({DARK}|{ORANGE})(?![0-9a-fA-F])", re.I)
ORANGE_RX = re.compile(rf"({ORANGE})(?![0-9a-fA-F])", re.I)

def sel5(sel):
    out = []
    for part in sel.split(","):
        part = part.strip()
        if not part.startswith("html.d3"):
            return None
        m = re.match(r"html\.d3((?:\.[\w-]+|:not\([^)]*\))*)(\s+body\b)?(.*)$", part, re.S)
        if not m:
            return None
        extra = m.group(1).replace(".d3", "")
        rest = m.group(3)
        # html.d3 body… / html.d3 .x  →  html.d5 body… / html.d5 body .x
        out.append(f"html.d5{extra} body{rest}")
    return ", ".join(out)

def is_logo(sel):
    return bool(re.search(r"wordmark|logo|tb-brand|\bb i\b|>\s*i\b|\.bang", sel))

rules = []
for m in re.finditer(r"([^{}@;]+)\{([^{}]*)\}", css):
    sel, body = m.group(1).strip(), m.group(2)
    if "html.d3" not in sel or not ANY.search(body):
        continue
    s5 = sel5(sel)
    if not s5:
        continue
    decls = []
    for d in body.split(";"):
        if ":" not in d:
            continue
        prop, val = d.split(":", 1)
        prop, val = prop.strip().lower(), val.strip()
        if not ANY.search(val):
            continue
        if prop in ("background", "background-color"):
            if "gradient" in val:
                continue
            decls.append("background-color: var(--ink) !important")  # garde les images de fond (icônes)
        elif prop.startswith("border") or prop in ("outline", "outline-color"):
            decls.append(f"{prop}: {ANY.sub('var(--ink)', val.replace('!important', '').strip())} !important")
        elif prop in ("color", "fill", "stroke", "caret-color", "accent-color", "text-decoration-color"):
            if is_logo(sel) and ORANGE_RX.search(val):
                continue  # le « ! » du logo HOP! reste orange
            decls.append(f"{prop}: var(--ink) !important")
        elif prop == "box-shadow" and ANY.search(val):
            decls.append("box-shadow: none !important")
    if decls:
        rules.append(f"{s5} {{ {'; '.join(decls)}; }}")

# 2) les règles communes (sans html.d3) qui ont un fond orange écrit en dur : fond --ink aussi (le « ! » du logo est du texte, pas touché)
seen = set()
for m in re.finditer(r"([^{}@;]+)\{([^{}]*)\}", css):
    sel, body = m.group(1).strip(), m.group(2)
    if "html.d" in sel or sel.startswith(("from", "to", "@")) or re.match(r"^[\d.%, ]+$", sel) or is_logo(sel):
        continue
    if not re.search(rf"background(-color)?\s*:[^;]*({ORANGE})(?![0-9a-fA-F])", body, re.I):
        continue
    parts = []
    for part in sel.split(","):
        part = part.strip()
        if not part or part.startswith((":root", "html")):
            continue
        part = re.sub(r"^body\b", "", part).strip()
        parts.append(f"html:where(.d5) body {part}".strip())  # plus faible que les règles html.d3 qui ont déjà changé ce fond
    if parts and sel not in seen:
        seen.add(sel)
        rules.append(f"{', '.join(parts)} {{ background-color: var(--ink) !important; }}")

head = ("/* Fichier fabriqué par d5-couleurs.py à partir de styles.css : ne pas modifier à la main.\n"
        "   Design 5 : les couleurs noires, bleu nuit et orange de l'ancien design deviennent la couleur --ink de la palette. */\n")
(here / "d5-auto.css").write_text(head + "\n".join(rules) + "\n")
print(len(rules), "règles écrites dans d5-auto.css")
