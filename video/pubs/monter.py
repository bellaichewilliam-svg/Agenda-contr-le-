#!/usr/bin/env python3
"""
Montage des pubs vidéo HOP! (méthode du brief : l'IA fait l'image, les textes sont posés ici).

    python3 monter.py <id> <video_veo.mp4> [--x 420] [--only fr|he]

- Lit les textes de la pub dans pubs.json (clé <id>).
- Sort DEUX vidéos 1080x1920, 10 s, H.264 + AAC, prêtes pour Reels / TikTok / statuts :
    livraison/kit/visuels/<id>-video-fr.mp4  (gros titres en français, ligne en hébreu dessous)
    livraison/kit/visuels/<id>-video-he.mp4  (gros titres en hébreu, ligne en français dessous)
- Vidéo Veo verticale (9:16) : plein écran, avec un voile bleu nuit en haut et en bas pour lire les textes.
  Vidéo horizontale (16:9) : bande carrée au centre, fondue dans le fond bleu nuit (--x = décalage du recadrage).
- Bruitages faits ici (whoosh, pop, ding, carillon du logo), mélangés au son de la vidéo s'il y en a.
- Planche de contrôle : video/out/pubs/<id>-<lang>-planche.jpg (images à 1 s, 3,8 s, 5 s, 6,5 s, 9,5 s).

Couleurs officielles : bleu nuit #0F1F3D, orange #FF6A13. Police Rubik (fonts/), hébreu en RTL (libraqm).
"""
import argparse, json, math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
W, H, FPS, DUR = 1080, 1920, 24, 10.0
FONT = os.path.join(HERE, "fonts", "Rubik[wght].ttf")
NAVY, NAVY2 = (15, 31, 61), (27, 48, 98)
ORANGE, WHITE, SKY = (255, 106, 19), (255, 255, 255), (140, 205, 255)
SR = 48000
LRI, PDI = "⁦", "⁩"   # « HOP! » isolé de gauche à droite dans une phrase en hébreu


def font(size, wght=900):
    f = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM)
    f.set_variation_by_axes([wght])
    return f


def is_he(txt):
    return any("֐" <= ch <= "׿" for ch in txt)


def fix_hop(txt):
    # Hébreu : « HOP! » isolé de gauche à droite, et une marque RTL au début (« …אפילו » : les points restent à droite)
    return "\u200F" + txt.replace("HOP!", LRI + "HOP!" + PDI) if is_he(txt) else txt


def measure(txt, f, rtl):
    kw = dict(direction="rtl", language="he") if rtl else {}
    return ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), txt, font=f, **kw)


def text_sprite(txt, size, color, wght=900, maxw=980, shadow=True, stroke=None, wrap=True):
    """Texte (FR ou HE) avec ombre douce. Trop long : d'abord sur 2 lignes équilibrées, puis la taille baisse."""
    if wrap and " " in txt.strip():
        f0 = font(size, wght); r0 = is_he(txt)
        w0 = lambda t: (lambda b: b[2] - b[0])(measure(fix_hop(t), f0, r0))
        if w0(txt) > maxw:
            words = txt.split()
            best = min(range(1, len(words)), key=lambda k: max(w0(" ".join(words[:k])), w0(" ".join(words[k:]))))
            a = text_sprite(" ".join(words[:best]), size, color, wght, maxw, shadow, stroke, wrap=False)
            b = text_sprite(" ".join(words[best:]), size, color, wght, maxw, shadow, stroke, wrap=False)
            gap = -int(size * 0.42)
            im = Image.new("RGBA", (max(a.width, b.width), a.height + b.height + gap), (0, 0, 0, 0))
            im.alpha_composite(a, ((im.width - a.width) // 2, 0)); im.alpha_composite(b, ((im.width - b.width) // 2, a.height + gap))
            return im
    txt = fix_hop(txt); rtl = is_he(txt)
    kw = dict(direction="rtl", language="he") if rtl else {}
    while True:
        f = font(size, wght)
        sw = max(3, size // 16) if stroke is None else stroke   # contour bleu nuit : lisible sur n'importe quelle image
        l, t, r, b = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), txt, font=f, stroke_width=sw, **kw)
        if r - l <= maxw or size <= 24:
            break
        size = int(size * 0.94)
    pad = 40
    w, h = r - l + pad * 2, b - t + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pad - l, pad - t + 8), txt, font=f, fill=(0, 0, 20, 200), stroke_width=sw, stroke_fill=(0, 0, 20, 200), **kw)
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(12)))
    ImageDraw.Draw(im).text((pad - l, pad - t), txt, font=f, fill=color, stroke_width=sw, stroke_fill=NAVY, **kw)
    return im


def pill_sprite(parts, size, bg, padx=56, pady=26, wght=900, border=None, maxw=980):
    """Pilule arrondie ; parts = [(texte, couleur)] (une seule partie si c'est de l'hébreu)."""
    parts = [(fix_hop(t), c) for t, c in parts]
    rtl = any(is_he(t) for t, _ in parts)
    kw = dict(direction="rtl", language="he") if rtl else {}
    while True:
        f = font(size, wght)
        boxes = [measure(t, f, rtl) for t, _ in parts]
        tw = sum(b[2] - b[0] for b in boxes)
        if tw + padx * 2 <= maxw or size <= 24:
            break
        size = int(size * 0.94)
    asc_t, asc_b = min(b[1] for b in boxes), max(b[3] for b in boxes)
    pw, ph = tw + padx * 2, (asc_b - asc_t) + pady * 2
    m = 30
    im = Image.new("RGBA", (pw + m * 2, ph + m * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((m, m + 10, m + pw, m + ph + 10), ph // 2, fill=(0, 0, 20, 150))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((m, m, m + pw, m + ph), ph // 2, fill=bg, outline=border, width=6 if border else 0)
    x = m + padx
    for (t, col), b in zip(parts, boxes):
        d.text((x - b[0], m + pady - asc_t), t, font=f, fill=col, **kw)
        x += b[2] - b[0]
    return im


def logo(size, padx, pady, border):
    return pill_sprite([("HOP", WHITE), ("!", ORANGE)], size, NAVY, padx=padx, pady=pady, border=border)


# ---------- animations ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out_back(x, s=1.9): x = clamp(x) - 1; return x * x * ((s + 1) * x + s) + 1
def ease_out_cubic(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_in_cubic(x): x = clamp(x); return x ** 3


def paste(canvas, spr, cx, cy, scale=1.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.LANCZOS)
    if alpha < 0.999:
        a = spr.getchannel("A").point(lambda v: int(v * alpha))
        spr = spr.copy(); spr.putalpha(a)
    canvas.alpha_composite(spr, (int(cx - spr.width / 2), int(cy - spr.height / 2)))


def sparks(canvas, cx, cy, w, h, t, alpha):
    if alpha <= 0: return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    a = int(255 * alpha * (0.75 + 0.25 * math.sin(t * 18)))
    for side in (-1, 1):
        for k, (dy, ang) in enumerate([(-0.55, -28), (0, 0), (0.55, 28)]):
            x0, y0 = cx + side * (w / 2 + 40), cy + dy * h
            L = 70 if k == 1 else 55; rad = math.radians(ang)
            x1, y1 = x0 + side * L * math.cos(rad), y0 + L * math.sin(rad)
            d.line((x0, y0, x1, y1), fill=ORANGE + (a,), width=16)
            for (x, y) in ((x0, y0), (x1, y1)):
                d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=ORANGE + (a,))
    canvas.alpha_composite(layer)


# ---------- fond bleu nuit avec rayons ----------
yy = np.linspace(0, 1, H)[:, None]
GRAD = np.repeat(np.array(NAVY)[None, None, :] * (1 - yy[..., None]) + np.array(NAVY2)[None, None, :] * yy[..., None], W, axis=1).astype(np.float32)
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
ANG0 = np.arctan2(YY - 960, XX - 540)
GLOW = np.clip(1 - np.sqrt((XX - 540) ** 2 + (YY - 960) ** 2) / 1300, 0, 1)


def background(t):
    rays = (np.cos((ANG0 + t * 0.12) * 14) > 0.55).astype(np.float32)
    img = GRAD + (rays * 0.10 * GLOW)[..., None] * np.array([120, 170, 255]) + (GLOW ** 2 * 0.25)[..., None] * np.array([40, 70, 160])
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


def vshade():
    """Voile bleu nuit en haut et en bas (vidéo plein écran) pour que les textes se lisent toujours."""
    a = np.zeros(H, np.float32)
    a[:720] = np.linspace(0.88, 0, 720) ** 1.1
    a[-760:] = np.linspace(0, 0.85, 760) ** 1.3
    al = (np.repeat(a[:, None], W, axis=1) * 255).astype(np.uint8)
    im = Image.new("RGBA", (W, H), NAVY + (0,)); im.putalpha(Image.fromarray(al)); return im


def band_mask(h=1080, f=150):
    fade = np.ones((h,), np.float32); fade[:f] = np.linspace(0, 1, f) ** 1.5; fade[-f:] = np.linspace(1, 0, f) ** 1.5
    return Image.fromarray((np.repeat(fade[:, None], W, axis=1) * 255).astype(np.uint8))


# ---------- bruitages ----------
def make_sfx(path, seed=1):
    n = int(SR * DUR); mix = np.zeros(n); rng = np.random.default_rng(seed)
    def add(sig, t, g):
        i = int(t * SR); j = min(n, i + len(sig)); mix[i:j] += sig[:j - i] * g
    def whoosh(d=0.45):
        m = int(d * SR); x = rng.standard_normal(m); tt = np.linspace(0, 1, m)
        fc = 300 + 4000 * np.sin(np.pi * tt) ** 2; a = np.exp(-2 * np.pi * fc / SR); y = np.zeros(m); p = 0.0
        for k in range(m): p = a[k] * p + (1 - a[k]) * x[k]; y[k] = p
        return y * np.sin(np.pi * tt) ** 1.5 / (np.abs(y).max() + 1e-9)
    def pop():
        m = int(0.12 * SR); tt = np.arange(m) / SR; f = 900 * np.exp(-tt * 25) + 250
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40)
    def ding(f, d=0.9):
        m = int(d * SR); tt = np.arange(m) / SR
        return (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.15 * np.sin(2 * np.pi * f * 3.01 * tt)) * np.exp(-tt * 5) * np.minimum(1, tt * 400)
    def impact():
        m = int(0.6 * SR); tt = np.arange(m) / SR
        return np.sin(2 * np.pi * (60 + 80 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 7) + 0.3 * rng.standard_normal(m) * np.exp(-tt * 30)
    add(pop(), 0.1, 0.35); add(whoosh(), 0.3, 0.30); add(whoosh(0.35), 0.72, 0.15)
    add(whoosh(), 2.5, 0.25); add(pop(), 2.8, 0.35); add(pop(), 3.05, 0.4)
    add(whoosh(0.5), 3.95, 0.30); add(ding(1318.5), 4.15, 0.22); add(whoosh(0.35), 4.55, 0.15)
    add(whoosh(0.6), 7.35, 0.35); add(impact(), 7.82, 0.55); add(pop(), 7.85, 0.4)
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]): add(ding(f, 1.2), 8.25 + k * 0.13, 0.18)
    mix = np.clip(mix, -1, 1)
    w = wave.open(path, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()


def probe(src):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", src],
                         capture_output=True, text=True).stdout
    st = json.loads(out)["streams"]
    v = next(s for s in st if s["codec_type"] == "video")
    return v["width"], v["height"], any(s["codec_type"] == "audio" for s in st)


# ---------- montage d'une langue ----------
def render(pid, cfg, src, lang, xoff, outdir, dest):
    other = "he" if lang == "fr" else "fr"
    sw, sh, has_audio = probe(src)
    vertical = sh > sw
    big, small = (WHITE, SKY)
    S = {}
    S["logo_s"] = logo(64, 56, 26, (255, 255, 255, 60))
    S["hook"] = text_sprite(cfg["hook"][lang], 132 if lang == "fr" else 140, WHITE)
    S["hook2"] = text_sprite(cfg["hook"][other], 60, SKY, wght=700, wrap=False)
    pl = cfg["punch"][lang] if isinstance(cfg["punch"][lang], list) else [cfg["punch"][lang]]
    p1, p2 = pl[0], (pl[1] if len(pl) > 1 else "")
    S["p1"] = text_sprite(p1, 104, WHITE)
    S["p2"] = text_sprite(p2, 104, ORANGE) if p2 else None
    po = cfg["punch"][other]; po = " ".join(po) if isinstance(po, list) else po
    S["p_o"] = text_sprite(po, 52, SKY, wght=700, wrap=False)
    end = cfg.get("end", {})
    price = {"fr": "À PARTIR DE 25 ₪", "he": "משלוחים החל מ-25 ₪"}
    S["price"] = pill_sprite([(end.get("pill", price)[lang], WHITE)], 78, ORANGE)
    S["price_o"] = text_sprite(end.get("pill", price)[other], 54, WHITE, wght=800, wrap=False)
    if cfg.get("sub"):
        S["sub"] = text_sprite(cfg["sub"][lang], 46, (225, 236, 255), wght=600, wrap=False)
    S["logo_b"] = logo(210, 90, 40, (255, 255, 255, 230))
    S["end_pill"] = pill_sprite([(end.get("pill", price)[lang], WHITE)], 84, ORANGE)
    l1 = end.get("line", {"fr": "Livraison à Netanya", "he": "משלוחים עד הבית בנתניה"})
    S["end1"] = text_sprite(l1[lang], 62, WHITE, wght=800, wrap=False)
    S["end2"] = text_sprite(l1[other], 56, SKY, wght=700, wrap=False)

    # Positions en hauteur : les lignes s'empilent sous le petit logo, quelle que soit leur taille (1 ou 2 lignes)
    Y, top, PAD = {}, 150, 40
    Y["hook"] = top + S["hook"].height / 2
    Y["hook2"] = Y["hook"] + S["hook"].height / 2 - PAD + S["hook2"].height / 2 - PAD + 22
    Y["p1"] = top + S["p1"].height / 2
    y_end = Y["p1"] + S["p1"].height / 2 - PAD
    if S["p2"]:
        Y["p2"] = y_end + 4 + S["p2"].height / 2 - PAD
        y_end = Y["p2"] + S["p2"].height / 2 - PAD
    Y["p_o"] = y_end + 18 + S["p_o"].height / 2 - PAD
    if vertical:
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        fw, fh = 1080, 1920
    else:
        vf = f"scale=-2:1080,crop=1080:1080:{xoff if xoff is not None else '(iw-1080)/2'}:0"
        fw, fh = 1080, 1080
    shade, bmask = vshade(), band_mask()
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf", vf + f",fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    tmpv = os.path.join(outdir, f"{pid}-{lang}-v.mp4")
    out = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", tmpv], stdin=subprocess.PIPE)
    last, shots = None, {}
    marks = {24: "1s", 91: "3.8s", 120: "5s", 156: "6.5s", 228: "9.5s"}
    for i in range(int(DUR * FPS)):
        t = i / FPS
        buf = proc.stdout.read(fw * fh * 3)
        if buf and len(buf) == fw * fh * 3:
            last = Image.frombytes("RGB", (fw, fh), buf)
        vid = last.convert("RGBA")
        e = ease_out_cubic((t - 7.55) / 0.6)
        if e > 0:
            vid = Image.alpha_composite(vid.filter(ImageFilter.GaussianBlur(18 * e)), Image.new("RGBA", vid.size, NAVY + (int(160 * e),)))
        z = 1.0 + 0.04 * (t / DUR)
        vz = vid.resize((int(fw * z), int(fh * z)), Image.LANCZOS)
        ox, oy = (vz.width - fw) // 2, (vz.height - fh) // 2
        vid = vz.crop((ox, oy, ox + fw, oy + fh))
        if vertical:
            c = vid; c.alpha_composite(shade)
        else:
            c = background(t); vid.putalpha(bmask); c.alpha_composite(vid, (0, 430))
        out_k = 1 - ease_in_cubic((t - 7.4) / 0.35)
        s = ease_out_back((t - 0.1) / 0.45)
        paste(c, S["logo_s"], 540, 110, s * out_k, clamp((t - 0.1) / 0.15) * out_k)
        # Accroche
        q_in = ease_out_back((t - 0.35) / 0.5, 2.2); q_out = 1 - ease_in_cubic((t - 2.55) / 0.25)
        paste(c, S["hook"], 540, Y["hook"], q_in * (0.7 + 0.3 * q_out), clamp((t - 0.35) / 0.12) * q_out)
        h2 = ease_out_cubic((t - 0.75) / 0.45); dx = 260 if lang == "fr" else -260
        paste(c, S["hook2"], 540 + dx * (1 - h2), Y["hook2"], 1, h2 * q_out)
        # Réponse
        a_in = ease_out_back((t - 2.8) / 0.45, 2.0)
        paste(c, S["p1"], 540, Y["p1"], a_in * out_k, clamp((t - 2.8) / 0.1) * out_k)
        if S["p2"]:
            a2 = ease_out_back((t - 3.05) / 0.45, 2.4)
            paste(c, S["p2"], 540, Y["p2"], a2 * out_k, clamp((t - 3.05) / 0.1) * out_k)
        ah = ease_out_cubic((t - 3.45) / 0.45)
        paste(c, S["p_o"], 540 + dx * (1 - ah), Y["p_o"], 1, ah * out_k)
        # Prix en bas (au-dessus de la zone de la légende Instagram / TikTok)
        p_in = ease_out_back((t - 4.0) / 0.55, 1.7)
        pulse = 1 + 0.045 * max(0, math.sin((t - 4.6) * 2 * math.pi * 1.1)) if t > 4.6 else 1
        paste(c, S["price"], 540, 1400 + 300 * (1 - p_in), pulse * out_k if p_in > 0 else 0, clamp((t - 4.0) / 0.15) * out_k)
        ph = ease_out_cubic((t - 4.6) / 0.45)
        paste(c, S["price_o"], 540 - dx * (1 - ph), 1525, 1, ph * out_k)
        if "sub" in S:
            sf = ease_out_cubic((t - 5.5) / 0.5)
            paste(c, S["sub"], 540, 1610 + 30 * (1 - sf), 1, sf * out_k)
        # Fin : logo, prix, Netanya
        if t > 7.8:
            lg = ease_out_back((t - 7.8) / 0.55, 2.2)
            paste(c, S["logo_b"], 540, 800, lg, clamp((t - 7.8) / 0.12))
            sparks(c, 540, 800, S["logo_b"].width * lg - 60, S["logo_b"].height * 0.6, t, clamp((t - 8.15) / 0.2))
            ep = ease_out_back((t - 8.25) / 0.5, 1.8)
            epulse = 1 + 0.04 * max(0, math.sin((t - 8.9) * 2 * math.pi * 1.1)) if t > 8.9 else 1
            paste(c, S["end_pill"], 540, 1050, ep * epulse, clamp((t - 8.25) / 0.12))
            ef = ease_out_cubic((t - 8.6) / 0.45)
            paste(c, S["end1"], 540, 1215 + 40 * (1 - ef), 1, ef)
            eh = ease_out_cubic((t - 8.85) / 0.45)
            paste(c, S["end2"], 540 + dx * (1 - eh), 1305, 1, eh)
        rgb = c.convert("RGB")
        out.stdin.write(rgb.tobytes())
        if i in marks: shots[marks[i]] = rgb.copy()
    out.stdin.close(); out.wait(); proc.terminate()

    # Son : bruitages + son de la vidéo (s'il y en a), prolongé jusqu'à 10 s
    sfx = os.path.join(outdir, f"{pid}-sfx.wav")
    if not os.path.exists(sfx): make_sfx(sfx)
    final = os.path.join(dest, f"{pid}-video-{lang}.mp4")
    if has_audio:
        fc = ("[0:a]aresample=48000,apad=whole_dur=10,afade=t=out:st=8.2:d=1.8,volume=1.1[amb];[1:a]aresample=48000[s];"
              "[amb][s]amix=inputs=2:normalize=0:duration=longest,atrim=0:10,alimiter=limit=0.7:level=0,aformat=channel_layouts=stereo[aout]")
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", sfx, "-i", tmpv, "-filter_complex", fc, "-map", "2:v", "-map", "[aout]"]
    else:
        fc = "[0:a]aresample=48000,apad=whole_dur=10,atrim=0:10,alimiter=limit=0.7:level=0,aformat=channel_layouts=stereo[aout]"
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", sfx, "-i", tmpv, "-filter_complex", fc, "-map", "1:v", "-map", "[aout]"]
    subprocess.run(cmd + ["-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", final], check=True)
    os.remove(tmpv)
    # Planche de contrôle
    sheet = Image.new("RGB", (5 * 360 + 6 * 12, 640 + 24), (20, 20, 30))
    for k, key in enumerate(["1s", "3.8s", "5s", "6.5s", "9.5s"]):
        sheet.paste(shots[key].resize((360, 640)), (12 + k * 372, 12))
    sp = os.path.join(outdir, f"{pid}-{lang}-planche.jpg"); sheet.save(sp, quality=88)
    for key, im in shots.items():
        im.save(os.path.join(outdir, f"{pid}-{lang}-{key}.jpg"), quality=90)
    print("OK", final, "·", sp)


def add_to_kit(pid, cfg):
    """Ajoute la pub en tête de l'onglet Vidéos du kit (kit.js), si elle n'y est pas déjà."""
    kp = os.path.join(ROOT, "livraison", "kit.js"); src = open(kp, encoding="utf-8").read()
    if f'id: "{pid}"' in src:
        return
    line = '  { id: "%s", aud: "%s", title: %s },\n' % (pid, cfg.get("aud", "client"), json.dumps(cfg.get("titre", pid), ensure_ascii=False))
    src = src.replace("const VIDEOS = [\n", "const VIDEOS = [\n  // Pub vidéo (video/pubs/monter.py)\n" + line, 1)
    open(kp, "w", encoding="utf-8").write(src); print("Ajoutée au kit :", pid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id"); ap.add_argument("src")
    ap.add_argument("--x", type=int, default=None, help="vidéo horizontale : décalage du recadrage carré")
    ap.add_argument("--only", choices=["fr", "he"])
    ap.add_argument("--test", action="store_true", help="essai : la vidéo reste dans video/out/pubs, pas dans le kit")
    ap.add_argument("--kit", action="store_true", help="ajouter la pub à l'onglet Vidéos du kit (seulement quand le patron l'a validée)")
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, "pubs.json"), encoding="utf-8"))[a.id]
    outdir = os.path.join(ROOT, "video", "out", "pubs"); os.makedirs(outdir, exist_ok=True)
    for lang in ([a.only] if a.only else ["fr", "he"]):
        render(a.id, cfg, a.src, lang, a.x, outdir, outdir if a.test else os.path.join(ROOT, "livraison", "kit", "visuels"))
    if a.kit and not a.test:
        add_to_kit(a.id, cfg)


if __name__ == "__main__":
    main()
