import math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 24
DUR = 10.0
SRC = "src.mp4"
SRC_DUR = 7.9
FONT = "fonts/Rubik[wght].ttf"
NAVY = (15, 31, 61)       # bleu nuit officiel HOP! #0F1F3D (le brief disait #0E1B4D)
NAVY2 = (24, 44, 120)
ORANGE = (255, 106, 19)   # orange officiel HOP! #FF6A13 (le brief disait #FF7A00)
WHITE = (255, 255, 255)
SKY = (140, 205, 255)

VID_Y0, VID_H = 430, 1080  # square video band


def font(size, wght=900):
    f = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM)
    f.set_variation_by_axes([wght])
    return f


def text_sprite(txt, size, color, wght=900, rtl=False, stroke=0, stroke_col=NAVY, shadow=True):
    f = font(size, wght)
    kw = dict(direction="rtl", language="he") if rtl else {}
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = d0.textbbox((0, 0), txt, font=f, stroke_width=stroke, **kw)
    pad = 40
    w, h = r - l + pad * 2, b - t + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pad - l, pad - t + 8), txt, font=f, fill=(0, 0, 20, 170),
                                stroke_width=stroke, stroke_fill=(0, 0, 20, 170), **kw)
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(10)))
    ImageDraw.Draw(im).text((pad - l, pad - t), txt, font=f, fill=color,
                            stroke_width=stroke, stroke_fill=stroke_col, **kw)
    return im


def pill_sprite(parts, size, bg, padx=56, pady=26, wght=900, radius=None, border=None):
    """parts: list of (text, color). Drawn left-to-right on a rounded pill."""
    f = font(size, wght)
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    widths, tops, bots = [], [], []
    for txt, _ in parts:
        l, t, r, b = d0.textbbox((0, 0), txt, font=f)
        widths.append((l, r)); tops.append(t); bots.append(b)
    asc_t, asc_b = min(tops), max(bots)
    tw = sum(r - l for l, r in widths)
    pw, ph = tw + padx * 2, (asc_b - asc_t) + pady * 2
    m = 30
    im = Image.new("RGBA", (pw + m * 2, ph + m * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    rad = radius if radius is not None else ph // 2
    ImageDraw.Draw(sh).rounded_rectangle((m, m + 10, m + pw, m + ph + 10), rad, fill=(0, 0, 20, 150))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((m, m, m + pw, m + ph), rad, fill=bg,
                        outline=border, width=6 if border else 0)
    x = m + padx
    for (txt, col), (l, r) in zip(parts, widths):
        d.text((x - l, m + pady - asc_t), txt, font=f, fill=col)
        x += r - l
    return im


# ---------- easing ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out_back(x, s=1.9):
    x = clamp(x); x -= 1
    return x * x * ((s + 1) * x + s) + 1


def ease_out_cubic(x):
    x = clamp(x); return 1 - (1 - x) ** 3


def ease_in_cubic(x):
    x = clamp(x); return x ** 3


def paste(canvas, spr, cx, cy, scale=1.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.LANCZOS)
    if alpha < 0.999:
        a = spr.getchannel("A").point(lambda v: int(v * alpha))
        spr = spr.copy(); spr.putalpha(a)
    canvas.alpha_composite(spr, (int(cx - spr.width / 2), int(cy - spr.height / 2)))


# ---------- sprites ----------
S = {}
S["logo_small"] = pill_sprite([("HOP", WHITE), ("!", ORANGE)], 64, NAVY, border=(255, 255, 255, 60))
S["q1"] = text_sprite("IL PLEUT ?", 150, WHITE)
S["q1he"] = text_sprite("יורד גשם?", 66, SKY, wght=700, rtl=True)
S["a1"] = text_sprite("ON LIVRE", 104, WHITE)
S["a2"] = text_sprite("QUAND MÊME !", 104, ORANGE)
S["a_he"] = text_sprite("מגיעים בכל מזג אוויר!", 52, SKY, wght=700, rtl=True)
S["price"] = pill_sprite([("À PARTIR DE ", WHITE), ("25 ₪", WHITE)], 78, ORANGE)
S["price_he"] = text_sprite("משלוחים החל מ-25 ₪", 62, WHITE, wght=800, rtl=True)
S["sub_fr"] = text_sprite("Vos pizzas livrées chaudes à Netanya", 44, (220, 232, 255), wght=600)
S["logo_big"] = pill_sprite([("HOP", WHITE), ("!", ORANGE)], 210, NAVY, padx=90, pady=40,
                            border=(255, 255, 255, 230))
S["end_price"] = pill_sprite([("À PARTIR DE 25 ₪", WHITE)], 84, ORANGE)
S["end_fr"] = text_sprite("Livraison à Netanya", 62, WHITE, wght=800)
S["end_he"] = text_sprite("משלוחים עד הבית בנתניה", 58, SKY, wght=700, rtl=True)

# ---------- background ----------
yy = np.linspace(0, 1, H)[:, None]
grad = (np.array(NAVY)[None, None, :] * (1 - yy[..., None]) + np.array(NAVY2)[None, None, :] * yy[..., None])
grad = np.repeat(grad, W, axis=1).astype(np.float32)
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def background(t):
    ang = np.arctan2(YY - 960, XX - 540) + t * 0.12
    rays = (np.cos(ang * 14) > 0.55).astype(np.float32)
    dist = np.sqrt((XX - 540) ** 2 + (YY - 960) ** 2) / 1300
    glow = np.clip(1 - dist, 0, 1)
    img = grad + (rays * 0.10 * glow)[..., None] * np.array([120, 170, 255]) + (glow ** 2 * 0.25)[..., None] * np.array([40, 70, 160])
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


# vertical fade mask for the video band (blends into navy)
fade = np.ones((VID_H,), np.float32)
F = 150
fade[:F] = np.linspace(0, 1, F) ** 1.5
fade[-F:] = np.linspace(1, 0, F) ** 1.5
VMASK = Image.fromarray((np.repeat(fade[:, None], W, axis=1) * 255).astype(np.uint8))


def sparks(canvas, cx, cy, w, h, t, alpha):
    if alpha <= 0: return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    flick = 0.75 + 0.25 * math.sin(t * 18)
    a = int(255 * alpha * flick)
    for side in (-1, 1):
        for k, (dy, ang) in enumerate([(-0.55, -28), (0, 0), (0.55, 28)]):
            x0 = cx + side * (w / 2 + 40)
            y0 = cy + dy * h
            L = 70 if k == 1 else 55
            rad = math.radians(ang)
            x1 = x0 + side * L * math.cos(rad)
            y1 = y0 + L * math.sin(rad) * (1 if side > 0 else 1)
            d.line((x0, y0, x1, y1), fill=ORANGE + (a,), width=16)
            d.ellipse((x0 - 8, y0 - 8, x0 + 8, y0 + 8), fill=ORANGE + (a,))
            d.ellipse((x1 - 8, y1 - 8, x1 + 8, y1 + 8), fill=ORANGE + (a,))
    canvas.alpha_composite(layer)


# ---------- frame source ----------
proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", SRC, "-vf", "crop=1080:1080:420:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    stdout=subprocess.PIPE)
out = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "video_only.mp4"],
    stdin=subprocess.PIPE)

last = None
N = int(DUR * FPS)
for i in range(N):
    t = i / FPS
    buf = proc.stdout.read(1080 * 1080 * 3)
    if buf and len(buf) == 1080 * 1080 * 3:
        last = Image.frombytes("RGB", (1080, 1080), buf)
    frame = last
    c = background(t)

    # end-card transition factor
    e = ease_out_cubic((t - 7.55) / 0.6)
    vid = frame.convert("RGBA")
    if e > 0:
        blurred = vid.filter(ImageFilter.GaussianBlur(18 * e))
        dark = Image.new("RGBA", vid.size, NAVY + (int(150 * e),))
        vid = Image.alpha_composite(blurred, dark)
    # slow push on video
    z = 1.0 + 0.04 * (t / DUR)
    vz = vid.resize((int(1080 * z), int(1080 * z)), Image.LANCZOS)
    ox = (vz.width - 1080) // 2
    vid = vz.crop((ox, ox, ox + 1080, ox + 1080))
    vid.putalpha(VMASK)
    c.alpha_composite(vid, (0, VID_Y0))

    out_k = 1 - ease_in_cubic((t - 7.4) / 0.35)  # everything exits before end card

    # small logo, top
    s = ease_out_back((t - 0.1) / 0.45)
    paste(c, S["logo_small"], 540, 95, s * out_k, clamp((t - 0.1) / 0.15) * out_k)

    # Q1 "IL PLEUT ?"
    q_in = ease_out_back((t - 0.35) / 0.5, 2.2)
    q_out = 1 - ease_in_cubic((t - 2.55) / 0.25)
    paste(c, S["q1"], 540, 265, q_in * (0.7 + 0.3 * q_out), clamp((t - 0.35) / 0.12) * q_out)
    he_in = ease_out_cubic((t - 0.75) / 0.45)
    paste(c, S["q1he"], 540 + 260 * (1 - he_in), 375, 1, he_in * q_out)

    # Answer
    a_in = ease_out_back((t - 2.8) / 0.45, 2.0)
    paste(c, S["a1"], 540, 200, a_in * out_k, clamp((t - 2.8) / 0.1) * out_k)
    a2_in = ease_out_back((t - 3.05) / 0.45, 2.4)
    paste(c, S["a2"], 540, 298, a2_in * out_k, clamp((t - 3.05) / 0.1) * out_k)
    ah = ease_out_cubic((t - 3.45) / 0.45)
    paste(c, S["a_he"], 540 + 260 * (1 - ah), 392, 1, ah * out_k)

    # Price pill bottom (slide up + pulse)
    p_in = ease_out_back((t - 4.0) / 0.55, 1.7)
    pulse = 1 + 0.045 * max(0, math.sin((t - 4.6) * 2 * math.pi * 1.1)) if t > 4.6 else 1
    py = 1440 + 300 * (1 - p_in)
    paste(c, S["price"], 540, py, pulse * out_k if p_in > 0 else 0, clamp((t - 4.0) / 0.15) * out_k)
    ph = ease_out_cubic((t - 4.6) / 0.45)
    paste(c, S["price_he"], 540 + 260 * (1 - ph), 1565, 1, ph * out_k)
    sf = ease_out_cubic((t - 5.5) / 0.5)
    paste(c, S["sub_fr"], 540, 1650 + 30 * (1 - sf), 1, sf * out_k)

    # END CARD
    lg = ease_out_back((t - 7.8) / 0.55, 2.2)
    if t > 7.8:
        paste(c, S["logo_big"], 540, 800, lg, clamp((t - 7.8) / 0.12))
        sparks(c, 540, 800, S["logo_big"].width * lg - 60, S["logo_big"].height * 0.6, t, clamp((t - 8.15) / 0.2))
        ep = ease_out_back((t - 8.25) / 0.5, 1.8)
        epulse = 1 + 0.04 * max(0, math.sin((t - 8.9) * 2 * math.pi * 1.1)) if t > 8.9 else 1
        paste(c, S["end_price"], 540, 1050, ep * epulse, clamp((t - 8.25) / 0.12))
        ef = ease_out_cubic((t - 8.6) / 0.45)
        paste(c, S["end_fr"], 540, 1215 + 40 * (1 - ef), 1, ef)
        eh = ease_out_cubic((t - 8.85) / 0.45)
        paste(c, S["end_he"], 540 + 220 * (1 - eh), 1305, 1, eh)

    out.stdin.write(c.convert("RGB").tobytes())
    if i % 24 == 0:
        print("frame", i, file=sys.stderr)

out.stdin.close(); out.wait(); proc.terminate()
print("done")
