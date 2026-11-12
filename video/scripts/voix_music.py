"""Musique de « Parlez. C'est livré. » (23 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (pas de droits d'auteur) : python3 scripts/voix_music.py -> public/voix-music.wav
Les coups tombent sur les images clés de src/Voix.tsx (clavier qui éclate, micro, panier, « envoyée », 1re appli, fin).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.5, 23.4
N = int(SR * DUR)
rng = np.random.default_rng(7)
L, R = np.zeros(N), np.zeros(N)


def flt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(d):
    return np.arange(int(SR * d)) / SR


def kick():
    t = ts(0.32)
    return np.sin(2 * np.pi * (48 * t + 70 * (1 - np.exp(-t * 28)) / 28)) * np.exp(-t * 9) + 0.3 * np.exp(-t * 300) * rng.standard_normal(len(t)) * 0.3


def clap():
    t = ts(0.18)
    return flt(rng.standard_normal(len(t)), "band", [900, 4200]) * np.exp(-t * 26) * (1 + 0.6 * (np.sin(t * 380) > 0))


def hat(d=0.05):
    t = ts(d)
    return flt(rng.standard_normal(len(t)), "high", 7000) * np.exp(-t / d * 5)


def bass(m, d):
    t = ts(d)
    x = np.sin(2 * np.pi * hz(m) * t) + 0.35 * np.sign(np.sin(2 * np.pi * hz(m) * t))
    return flt(x, "low", 420) * np.minimum(1, t * 80) * np.exp(-t * 2.5)


def pluck(m, d=0.28, bright=2600):
    t = ts(d)
    x = sum(np.sin(2 * np.pi * hz(m) * k * t) / k for k in (1, 2, 3, 4))
    return flt(x, "low", bright) * np.exp(-t * 12) * np.minimum(1, t * 400)


def pad(ms, d):
    t = ts(d)
    x = sum(np.sin(2 * np.pi * hz(m) * t * (1 + dt)) for m in ms for dt in (-0.003, 0, 0.003))
    env = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.6)
    return flt(x, "low", 1400) * env / (3 * len(ms))


def whoosh(d=0.5, up=True):
    t = ts(d)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    for a, b in ((0, .34), (.33, .67), (.66, 1)):
        i0, i1 = int(a * len(t)), int(b * len(t))
        c = 500 + 5000 * ((a + b) / 2 if up else 1 - (a + b) / 2)
        out[i0:i1] = flt(n, "band", [c * .6, c * 1.5])[i0:i1]
    return out * (t / d if up else 1 - t / d) ** 2


def boom():
    t = ts(1.1)
    return np.sin(2 * np.pi * (38 * t + 60 * (1 - np.exp(-t * 14)) / 14)) * np.exp(-t * 3.2) + flt(rng.standard_normal(len(t)), "low", 900) * np.exp(-t * 9) * 0.5


def ding(m=88):
    t = ts(1.0)
    return (np.sin(2 * np.pi * hz(m) * t) + 0.5 * np.sin(2 * np.pi * hz(m + 12) * t) + 0.3 * np.sin(2 * np.pi * hz(m + 19) * t)) * np.exp(-t * 4.5)


def blip(m):
    t = ts(0.09)
    return np.sin(2 * np.pi * hz(m) * t * (1 + 0.6 * t)) * np.exp(-t * 30)


def key():
    t = ts(0.03)
    return flt(rng.standard_normal(len(t)), "band", [1800, 5200]) * np.exp(-t * 160)


def f2t(frame):
    return frame / 30


CH = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 66])]  # Am7 Fmaj7 C G

# 1. On tape, on s'énerve… (0 → 1,33 s), puis le clavier éclate (image 40)
for k in range(13):
    add(key(), f2t(k * 3) + 0.02, 0.5, pan=(k % 3 - 1) * 0.4)
add(whoosh(0.55, True), f2t(40) - 0.55, 0.5)
add(boom(), f2t(40), 0.95)
add(clap(), f2t(40), 0.5)
add(boom(), f2t(52), 0.7)
add(clap(), f2t(52), 0.45)
# 2. PARLEZ (image 75) : nappe douce, petites notes sur chaque mot de la phrase
add(whoosh(0.4, True), f2t(75) - 0.4, 0.4)
add(ding(81), f2t(77), 0.35)
add(pad(CH[0][1], 3.6), f2t(75), 0.5)
for i in range(10):
    add(blip([76, 79, 81, 84, 83, 81, 79, 84, 86, 88][i]), f2t(75 + 26 + i * 6), 0.32, pan=(i % 2 - 0.5) * 0.6)
# 3 à 5. Le rythme : 4 temps par mesure, de l'image 180 à 555 (12,5 s = 25 temps)
t0 = f2t(180)
add(whoosh(0.5, True), t0 - 0.5, 0.5)
for b in range(25):
    t = t0 + b * BEAT
    root, notes = CH[(b // 4) % 4]
    add(kick(), t, 0.85)
    if b % 2:
        add(clap(), t, 0.36)
    add(hat(), t + BEAT / 2, 0.16, pan=0.3)
    add(hat(0.03), t + BEAT / 4, 0.07, pan=-0.3)
    add(hat(0.03), t + 3 * BEAT / 4, 0.07, pan=-0.3)
    add(bass(root - 12 if root > 44 else root, 0.42), t, 0.5)
    add(bass(root, 0.2), t + BEAT * 0.75, 0.3)
    if b % 4 == 0:
        add(pad(notes, 2.2), t, 0.34)
    for j, off in enumerate((0, 0.25, 0.5, 0.75)):
        add(pluck(notes[(b + j) % 4] + 12, 0.22), t + off * BEAT, 0.13, pan=(j % 2 - 0.5) * 0.7)
# le panier : une note qui monte à chaque article, puis l'adresse
for i, fr in enumerate((28, 46, 64, 88)):
    add(pluck([84, 86, 88, 91][i], 0.5, 5000), f2t(180 + fr), 0.4)
    add(blip([84, 86, 88, 91][i]), f2t(180 + fr + 6), 0.25)
# « Commande envoyée » (image 180 + 142)
add(whoosh(0.6, True), f2t(180 + 142) - 0.6, 0.45)
add(ding(88), f2t(180 + 142), 0.6)
add(ding(93), f2t(180 + 142) + 0.12, 0.45)
add(boom(), f2t(180 + 142), 0.6)
# 4. quatre phrases qui claquent (image 375, toutes les 22,5 images)
for i in range(4):
    add(clap(), f2t(375 + i * 22.5), 0.4)
    add(pluck(72 + [0, 4, 7, 12][i], 0.4, 4000), f2t(375 + i * 22.5), 0.35)
# 5. la 1re appli (image 465) : montée puis gros coup
add(whoosh(0.9, True), f2t(465) - 0.9, 0.6)
add(boom(), f2t(465), 0.9)
add(pad([57, 64, 69, 72, 76], 3.0), f2t(465), 0.5)
add(ding(84), f2t(465 + 36), 0.5)
# 6. fin (image 555) : accord tenu, clochette, Hoppy qui atterrit
add(whoosh(0.7, True), f2t(555) - 0.7, 0.55)
add(boom(), f2t(555), 0.95)
add(pad([48, 55, 60, 64, 67, 72], 4.4), f2t(555), 0.6)
for i, m in enumerate((72, 76, 79, 84)):
    add(pluck(m, 0.7, 5000), f2t(555 + 20) + i * 0.11, 0.4)
add(ding(96), f2t(555 + 32), 0.45)
add(kick(), f2t(555) + 1.1 + 0.55, 0.6)   # Hoppy touche le sol
add(blip(79), f2t(555) + 1.1 + 0.57, 0.3)

mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 0.9 / max(1e-9, np.percentile(np.abs(mix), 99.7))) * 0.92
fade = np.minimum(1, (DUR - np.arange(N) / SR) / 0.5)
mix *= fade[:, None]
with wave.open(os.path.join(ROOT, "public", "voix-music.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("voix-music.wav", round(DUR, 1), "s")
