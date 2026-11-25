"""Musique de « La révolution à Netanya » au nouveau design (30 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (pas de droits d'auteur) : python3 scripts/revo5_music.py -> public/revo5-music.wav
Les coups tombent sur les coupes de src/Revolution5.tsx : 120, 270, 450, 600, 720, 810 (fin).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.5, 30.0
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



CH = [(48, [60, 64, 67, 71]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65])]  # Cmaj7 G Am F : lumineux
CUTS = (120, 270, 450, 600, 720, 810)
# 1. accroche : quatre coups (LA · RÉVO · LU · TION), tic-tac, montée vers la coupe 120
for fr in (0, 15, 30, 45):
    add(boom(), f2t(fr), 0.55 + 0.1 * (fr == 45)); add(clap(), f2t(fr), 0.35)
for k in range(16):
    add(hat(0.03), f2t(k * 7.5), 0.16, pan=(k % 2 - 0.5) * 0.6)
add(pad(CH[0][1], 4.0), 0.0, 0.35)
add(ding(91), f2t(60), 0.35)
add(whoosh(1.0, True), f2t(120) - 1.0, 0.6)
# 2 à 6. le rythme plein de l'image 120 à 810 (23 s = 46 temps)
t0 = f2t(120)
for b in range(46):
    t = t0 + b * BEAT
    root, notes = CH[(b // 4) % 4]
    add(kick(), t, 0.95)
    if b % 2: add(clap(), t, 0.42)
    add(hat(), t + BEAT / 2, 0.2, pan=0.3)
    add(hat(0.03), t + BEAT / 4, 0.08, pan=-0.3); add(hat(0.03), t + 3 * BEAT / 4, 0.08, pan=-0.3)
    add(bass(root - 12 if root > 44 else root, 0.42), t, 0.58); add(bass(root, 0.2), t + BEAT * 0.75, 0.34)
    if b % 4 == 0: add(pad(notes, 2.2), t, 0.28)
    for j, off in enumerate((0, 0.25, 0.5, 0.75)):
        add(pluck(notes[(b + j) % 4] + 12, 0.22), t + off * BEAT, 0.12, pan=(j % 2 - 0.5) * 0.7)
# coups sur chaque coupe
for fr in CUTS[:-1]:
    add(whoosh(0.5, True), f2t(fr) - 0.5, 0.45); add(boom(), f2t(fr), 0.7)
# comparateur : les pastilles « Moins cher » (330, 345) et le prix (375)
for i, fr in enumerate((330, 345, 360)):
    add(blip([84, 88, 91][i]), f2t(fr), 0.4)
add(ding(93), f2t(375), 0.4)
# restos : Bassari / Halavi (525, 540)
add(ding(86), f2t(525), 0.3); add(ding(90), f2t(540), 0.3)
# voix : micro (630), bulle (660)
for i in range(3): add(blip([79, 83, 86][i]), f2t(630 + i * 5), 0.3)
add(ding(88), f2t(660), 0.35)
# « dès 25 ₪ » (750) et « au plus vite » (780)
add(ding(84), f2t(750), 0.45); add(ding(91), f2t(750) + 0.12, 0.4); add(whoosh(0.35, True), f2t(780) - 0.35, 0.4)
# 7. fin : accord tenu, le logo (810), Hoppy touche le sol
add(pad([48, 55, 60, 64, 67, 72], 3.4), f2t(810), 0.6)
add(whoosh(0.7, True), f2t(810) - 0.7, 0.5); add(boom(), f2t(810), 0.95)
for i, m in enumerate((72, 76, 79, 84)):
    add(pluck(m, 0.7, 5000), f2t(810) + i * 0.09, 0.4)
add(kick(), f2t(846), 0.6); add(blip(79), f2t(846) + 0.02, 0.3)
add(ding(96), f2t(864), 0.4)

mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 0.9 / max(1e-9, np.percentile(np.abs(mix), 99.7))) * 0.92
fade = np.minimum(1, (DUR - np.arange(N) / SR) / 0.6)
mix *= fade[:, None]
with wave.open(os.path.join(ROOT, "public", "revo5-music.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("revo5-music.wav", round(DUR, 1), "s")
