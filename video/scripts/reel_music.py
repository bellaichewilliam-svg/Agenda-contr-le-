"""Musique du showreel HOP! (15 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (pas de droits d'auteur) : python3 scripts/reel_music.py -> public/reel-music.wav
Les coups tombent sur les images clés de src/Reel.tsx (voir HITS plus bas).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
FPS = 30
BEAT = 0.5
DUR = 15.6
N = int(SR * DUR)
KEY = int(os.environ.get('HOP_KEY', '0'))  # transposition (demi-tons) pour une variante
rng = np.random.default_rng(int(os.environ.get('HOP_SEED', '11')))
L = np.zeros(N)
R = np.zeros(N)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2)
    R[i : i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2)


def note(m):
    return 440 * 2 ** ((m + KEY - 69) / 12)


def ts(n):
    return np.arange(n) / SR


# --- Instruments ------------------------------------------------------------
def kick(punch=1.0):
    n = int(0.45 * SR)
    t = ts(n)
    f = 44 + 150 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t * 320) * 0.4
    return np.tanh((body + click) * 1.8 * punch)


def clap():
    n = int(0.3 * SR)
    t = ts(n)
    nz = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for k in (0, 0.011, 0.022):
        i = int(k * SR)
        e[i:] += np.exp(-(t[: n - i]) * 70)
    e += np.exp(-t * 14) * 0.5
    return nz * e * 0.9


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = ts(n)
    return hp(rng.standard_normal(n), 7500) * np.exp(-t * (14 if open_ else 95)) * 0.5


def snare():
    n = int(0.18 * SR)
    t = ts(n)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    nz = bp(rng.standard_normal(n), 1500, 8000) * np.exp(-t * 26)
    return (tone * 0.6 + nz) * 0.7


def bass(m, length):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t)
    x = lp(x, 520)
    e = np.minimum(1, t / 0.005) * np.exp(-t * 3.2)
    return np.tanh(x * e * 1.4) * 0.8


def stab(ms, length=0.25):
    n = int(length * SR)
    t = ts(n)
    x = np.zeros(n)
    for m in ms:
        for d in (-0.006, 0, 0.007):
            ph = (t * note(m) * (1 + d)) % 1
            x += 2 * ph - 1
    x = lp(x / (len(ms) * 3), 3800)
    return x * np.minimum(1, t / 0.003) * np.exp(-t * 9) * 0.9


def pad(ms, length):
    n = int(length * SR)
    t = ts(n)
    x = np.zeros(n)
    for m in ms:
        for d in (-0.004, 0.004):
            ph = (t * note(m) * (1 + d)) % 1
            x += 2 * ph - 1
    x = lp(x / (len(ms) * 2), 1400)
    a = np.minimum(1, t / 0.4) * np.minimum(1, (length - t) / 0.5)
    return x * a * 0.35


# --- Bruitages ---------------------------------------------------------------
def whoosh(d=0.45, up=True):
    n = int(d * SR)
    t = ts(n)
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n
        f = 300 + (4500 if up else 2500) * (p if up else 1 - p)
        out[i : i + seg] = bp(nz[i : i + seg + 2048], f * 0.7, min(f * 1.4, 18000))[:seg][: len(out[i : i + seg])]
    e = np.sin(np.pi * np.minimum(1, t / d)) ** 2
    return out * e * 0.7


def hit():
    n = int(1.2 * SR)
    t = ts(n)
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 18)) * t) * np.exp(-t * 2.5)
    crash = hp(rng.standard_normal(n), 4000) * np.exp(-t * 3.5) * 0.35
    boom = lp(rng.standard_normal(n), 180) * np.exp(-t * 6) * 0.8
    return np.tanh((sub + crash + boom) * 1.5)


def pop(f0=500, f1=1400, d=0.08):
    n = int(d * SR)
    t = ts(n)
    f = f0 + (f1 - f0) * (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40) * 0.8


def ding():
    n = int(1.1 * SR)
    t = ts(n)
    x = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((1568, 1), (2349, 0.5), (3136, 0.3)))
    return x * np.exp(-t * 4) * 0.45


def riser(d=1.5):
    n = int(d * SR)
    t = ts(n)
    f = 200 * (12 ** (t / d))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + hp(rng.standard_normal(n), 2000) * 0.25 * (t / d)
    return x * (t / d) ** 2


def tick():
    n = int(0.03 * SR)
    t = ts(n)
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 180) * 0.6


# --- Arrangement -------------------------------------------------------------
f2s = lambda f: f / FPS  # image -> secondes
CH = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]  # Am F C G

# Intro : montée, puis le logo claque (image 22)
add(riser(0.75), 0.0, 0.8)
add(hit(), f2s(22), 1.0)
add(stab([69, 72, 76], 0.5), f2s(22), 0.5)
for k, f in enumerate((22, 25, 28, 31)):  # les lettres
    add(pop(500 + 150 * k, 1400 + 200 * k), f2s(f), 0.35, pan=-0.6 + 0.4 * k)
add(whoosh(0.5), f2s(45), 0.8)

# Mots qui claquent (images 60 à 135) : un par temps
words_start = 60
for i in range(5):
    t = f2s(words_start + 15 * i)
    add(kick(), t, 0.95)
    add(clap() if i % 2 else snare(), t, 0.6)
    add(stab([72 + (i % 3) * 2, 76, 79], 0.22), t, 0.35, pan=-0.3 + 0.15 * i)
    add(bass(45 + (0, 5, 0, 7, 3)[i], 0.45), t, 0.7)
add(whoosh(0.45), f2s(127), 0.7)

# Groove (carte puis téléphone : images 135 à 300)
beat_t = f2s(135)
b = 0
while beat_t < f2s(300) - 0.01:
    add(kick(), beat_t, 0.9)
    if b % 2:
        add(clap(), beat_t, 0.5)
    add(hat(), beat_t + BEAT / 2, 0.35, pan=0.3)
    add(hat(), beat_t + BEAT / 4, 0.18, pan=-0.3)
    add(hat(), beat_t + 3 * BEAT / 4, 0.18, pan=-0.3)
    root, ch = CH[(b // 2) % 4]
    add(bass(root - 12, BEAT * 0.9), beat_t, 0.75)
    if b % 4 == 0:
        add(pad(ch + [ch[0] + 12], BEAT * 4), beat_t, 0.5)
    beat_t += BEAT
    b += 1
for f in (150, 165, 180, 195, 210):  # le scooter avance : petits tics
    add(tick(), f2s(f) + 0.25, 0.25, pan=0.5)
add(whoosh(0.45), f2s(217), 0.7)
add(ding(), f2s(268), 0.9)  # « Livré ! »
add(pop(700, 2000, 0.1), f2s(268), 0.4)
for k in range(10):  # confettis
    add(pop(900 + 120 * k, 2400, 0.05), f2s(270 + 2 * k), 0.12, pan=(k % 3 - 1) * 0.6)
add(whoosh(0.45), f2s(292), 0.7)

# 25 ₪ : roulement qui accélère, puis le tampon (image 330)
for k in range(16):
    t = f2s(300) + k * (0.06 - 0.0022 * k)
    add(snare(), t, 0.15 + 0.03 * k)
add(hit(), f2s(330), 0.9)
add(kick(1.3), f2s(330), 1.0)
add(stab([69, 73, 76, 81], 0.4), f2s(330), 0.45)
for k, f in enumerate((340, 346, 352)):
    add(pop(600 + 200 * k, 1600 + 200 * k), f2s(f), 0.3)

# Tuiles (images 360 à 405)
for k, f in enumerate((360, 366, 372, 378)):
    add(kick(0.8), f2s(f), 0.6)
    add(stab([76 + 2 * k, 79 + 2 * k], 0.15), f2s(f), 0.3, pan=-0.5 + 0.33 * k)
for f in (390, 397):
    add(hat(True), f2s(f), 0.3)
add(riser(0.5), f2s(390), 0.6)

# Fin : grand coup, accord tenu, le logo
add(hit(), f2s(405), 1.1)
add(kick(1.4), f2s(405), 1.0)
add(pad([57, 64, 69, 72, 76], 2.0), f2s(405), 0.9)
add(stab([69, 72, 76, 81], 0.6), f2s(405), 0.5)
add(pop(500, 1600, 0.09), f2s(420), 0.4)
add(ding(), f2s(432), 0.35)

# --- Mastering ---------------------------------------------------------------
mix = np.stack([L, R], axis=1)
mix = hp(mix.T, 28).T
peak = np.max(np.abs(mix)) or 1
mix = np.tanh(mix / peak * 1.35) / np.tanh(1.35) * 0.92
fade = int(0.35 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
pcm = (mix * 32767).astype(np.int16)
out = os.path.join(ROOT, "public", os.environ.get("HOP_OUT", "reel-music.wav"))
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out, f"{DUR:.1f}s")
