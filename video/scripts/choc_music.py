"""Musique et bruitages de « Choc » (44 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (aucun droit d'auteur) : python3 scripts/choc_music.py -> public/choc-music-fr.wav et choc-music-he.wav
Les coups tombent sur les coupes de src/Choc.tsx (180, 390, 630, 870, 1020, 1140) et sur les gestes à l'écran
(touchers, lettres tapées, zoom sur le prix, ajout au panier, micro, logo). Trois grands coups seulement : 40 ₪, le prix, le logo.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.5, 44.0


def flt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(d):
    return np.arange(int(SR * d)) / SR


def f2t(frame):
    return frame / 30


def build(lang):
    rng = np.random.default_rng(11)
    N = int(SR * DUR)
    L, R = np.zeros(N), np.zeros(N)

    def add(sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0 or i >= N:
            return
        sig = sig[: N - i]
        L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
        R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))

    def kick():
        t = ts(0.32)
        return np.sin(2 * np.pi * (46 * t + 75 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t * 9)

    def clap():
        t = ts(0.2)
        return flt(rng.standard_normal(len(t)), "band", [900, 4200]) * np.exp(-t * 24) * (1 + 0.6 * (np.sin(t * 380) > 0))

    def hat(d=0.05):
        t = ts(d)
        return flt(rng.standard_normal(len(t)), "high", 7000) * np.exp(-t / d * 5)

    def bass(m, d):
        t = ts(d)
        x = np.sin(2 * np.pi * hz(m) * t) + 0.4 * np.sign(np.sin(2 * np.pi * hz(m) * t))
        return flt(x, "low", 380) * np.minimum(1, t * 80) * np.exp(-t * 2.2)

    def stab(ms, d=0.22):
        t = ts(d)
        x = sum(np.sign(np.sin(2 * np.pi * hz(m) * t * (1 + dt))) for m in ms for dt in (-0.004, 0.004))
        return flt(x, "low", 2200) * np.exp(-t * 11) * np.minimum(1, t * 300) / (2 * len(ms))

    def pad(ms, d):
        t = ts(d)
        x = sum(np.sin(2 * np.pi * hz(m) * t * (1 + dt)) for m in ms for dt in (-0.003, 0, 0.003))
        env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5)
        return flt(x, "low", 1500) * env / (3 * len(ms))

    def whoosh(d=0.5, up=True):
        t = ts(d)
        n = rng.standard_normal(len(t))
        out = np.zeros(len(t))
        for a, b in ((0, .34), (.33, .67), (.66, 1)):
            i0, i1 = int(a * len(t)), int(b * len(t))
            c = 500 + 5000 * ((a + b) / 2 if up else 1 - (a + b) / 2)
            out[i0:i1] = flt(n, "band", [c * .6, c * 1.5])[i0:i1]
        return out * (t / d if up else 1 - t / d) ** 2

    def riser(d):
        t = ts(d)
        x = flt(rng.standard_normal(len(t)), "band", [800, 6000]) * (t / d) ** 2.5
        return x + 0.3 * np.sin(2 * np.pi * (200 * t + 600 * t * t / d)) * (t / d) ** 2

    def boom(g=1.0):
        t = ts(1.3)
        return (np.sin(2 * np.pi * (36 * t + 64 * (1 - np.exp(-t * 14)) / 14)) * np.exp(-t * 3)
                + flt(rng.standard_normal(len(t)), "low", 900) * np.exp(-t * 8) * 0.55) * g

    def ding(m=88):
        t = ts(0.9)
        return (np.sin(2 * np.pi * hz(m) * t) + 0.5 * np.sin(2 * np.pi * hz(m + 12) * t) + 0.25 * np.sin(2 * np.pi * hz(m + 19) * t)) * np.exp(-t * 5)

    def click():   # toucher sur l'écran (petit claquement de doigt sur le verre)
        t = ts(0.04)
        return flt(rng.standard_normal(len(t)), "band", [2000, 7000]) * np.exp(-t * 180) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 220) * 0.5

    def key():
        t = ts(0.035)
        return flt(rng.standard_normal(len(t)), "band", [1500, 5000]) * np.exp(-t * 150)

    def pop(m=80):
        t = ts(0.12)
        return np.sin(2 * np.pi * hz(m) * t * (1 + 2.5 * np.exp(-t * 40))) * np.exp(-t * 26)

    def tick():
        t = ts(0.02)
        return np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 300)

    def marker():   # le feutre qui barre le prix
        t = ts(0.35)
        return flt(rng.standard_normal(len(t)), "band", [1200, 3800]) * (np.sin(np.pi * t / 0.35) ** 0.5) * (0.7 + 0.3 * np.sin(t * 90))

    CH = [(45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]   # Am F C G : énergique
    # ---- 1. accroche (0–180) : grave, tendu, puis libération sur « dès 25 ₪ »
    add(pad([45, 52, 57, 60], 3.6), 0, 0.5)
    for fr in (0, 12):
        add(kick(), f2t(fr), 0.8); add(clap(), f2t(fr), 0.3)
    add(whoosh(0.4, True), f2t(30) - 0.4, 0.5); add(boom(1.0), f2t(30), 1.0)   # grand coup n°1 : 40 ₪
    add(marker(), f2t(74), 0.55)
    add(whoosh(0.35, False), f2t(100), 0.45)
    for k in range(12):
        add(tick(), f2t(116 + k * 22 / 12), 0.35)
    add(ding(88), f2t(138), 0.5); add(ding(95), f2t(138) + 0.08, 0.45); add(pop(84), f2t(142), 0.45)
    add(pad([48, 55, 60, 64, 67], 1.6), f2t(120), 0.45)
    add(riser(1.2), f2t(180) - 1.2, 0.5)
    # ---- 2 à 6. le rythme plein (180–1140 = 64 temps)
    t0 = f2t(180)
    for b in range(64):
        t = t0 + b * BEAT
        root, notes = CH[(b // 4) % 4]
        add(kick(), t, 0.95)
        if b % 2: add(clap(), t, 0.4)
        add(hat(), t + BEAT / 2, 0.2, pan=0.3)
        add(hat(0.03), t + BEAT / 4, 0.07, pan=-0.3); add(hat(0.03), t + 3 * BEAT / 4, 0.07, pan=-0.3)
        add(bass(root - 12 if root > 44 else root, 0.42), t, 0.6); add(bass(root, 0.2), t + BEAT * 0.75, 0.32)
        if b % 2 == 0: add(stab([n + 12 for n in notes[:3]]), t + BEAT * 0.5, 0.16, pan=0.2)
        if b % 8 == 0: add(pad(notes, 4.0), t, 0.22)
    for fr in (180, 390, 630, 870, 1020):
        add(whoosh(0.45, True), f2t(fr) - 0.45, 0.4); add(boom(0.55), f2t(fr), 0.55)
    # 2. tout Netanya : le carrousel qui tourne, les enseignes, les mots
    for fr in (210, 238, 266):
        add(whoosh(0.3, True), f2t(fr), 0.22, pan=-0.4)
    for i in range(5):
        add(pop(76 + i * 2), f2t(224 + i * 9), 0.32, pan=(i % 2 - 0.5) * 0.8)
    for k in range(7):
        add(tick(), f2t(292 + k * 11 + 6), 0.25)
    add(whoosh(0.6, True), f2t(298), 0.18)   # la page défile
    # 3. comparateur : toucher, lettres, résultats, zoom (grand coup n°2), « Tout ici », promos
    add(click(), f2t(414), 0.6)
    for k in range(4 if lang == "fr" else 3):
        add(key(), f2t(428 + k * 8), 0.55)
    add(whoosh(0.3, True), f2t(458), 0.25)
    add(whoosh(0.28, True), f2t(498) - 0.28, 0.55); add(boom(0.9), f2t(498), 0.85)
    add(ding(91), f2t(502), 0.45)
    add(pop(79), f2t(550), 0.4); add(click(), f2t(560), 0.6); add(ding(86), f2t(561), 0.35)
    add(whoosh(0.35, True), f2t(576) - 0.1, 0.35)
    # 4. vitrine : zoom, touchers sur les ingrédients, ajout au panier
    add(whoosh(0.4, True), f2t(686) - 0.2, 0.25)
    for fr, m in ((704, 79), (742, 76), (780, 83)):
        add(click(), f2t(fr), 0.55); add(pop(m), f2t(fr) + 0.04, 0.35)
    add(click(), f2t(828), 0.6); add(ding(88), f2t(836), 0.45); add(ding(95), f2t(836) + 0.1, 0.4); add(pop(88), f2t(842), 0.4)
    # 5. voix : micro, panneau qui monte, onde, bulle
    add(click(), f2t(894), 0.6); add(whoosh(0.35, True), f2t(900) - 0.05, 0.35)
    t = ts(1.5); add(flt(rng.standard_normal(len(t)), "band", [300, 1800]) * (0.5 + 0.5 * np.abs(np.sin(t * 19))) * np.minimum(1, t * 6) * np.minimum(1, (1.5 - t) * 6), f2t(920), 0.12)
    add(pop(81), f2t(952), 0.45); add(pop(86), f2t(970), 0.25); add(pop(84), f2t(982), 0.3)
    # 6. paiement : trois lignes, le trajet
    for i, fr in enumerate((1048, 1060, 1072)):
        add(pop(77 + i * 3), f2t(fr), 0.4)
    add(riser(1.0), f2t(1140) - 1.0, 0.45)
    # 7. fin (logo-shrink-wordmark-lockup) : l'anneau se resserre, freinage + onde de choc (grand coup n°3), H O P, textes, Hoppy, disparition
    add(pad([45, 52, 57, 60, 64, 69], 5.8), f2t(1140), 0.55)
    add(riser(0.9), f2t(1140), 0.35)
    add(whoosh(0.3, True), f2t(1172) - 0.3, 0.5); add(boom(1.0), f2t(1172), 0.95)
    add(ding(93), f2t(1174), 0.35)
    add(whoosh(0.3, True), f2t(1184), 0.25)
    for i in range(3):
        add(pop(74 + i * 4), f2t(1196 + i * 5), 0.38)
    for i, m in enumerate((69, 72, 76, 81)):
        add(stab([m], 0.6), f2t(1210) + i * 0.09, 0.45)
    add(pop(79), f2t(1216), 0.3); add(pop(84), f2t(1226), 0.35); add(pop(88), f2t(1236), 0.35); add(ding(91), f2t(1248), 0.35)
    add(kick(), f2t(1229), 0.6)
    add(whoosh(0.4, False), f2t(1300), 0.4); add(pop(70), f2t(1316), 0.35)

    mix = np.stack([L, R], axis=1)
    mix = np.tanh(mix * 0.9 / max(1e-9, np.percentile(np.abs(mix), 99.7))) * 0.92
    fade = np.minimum(1, (DUR - np.arange(N) / SR) / 0.8)
    mix *= fade[:, None]
    out = os.path.join(ROOT, "public", f"choc-music-{lang}.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(os.path.basename(out), DUR, "s")


for lg in ("fr", "he"):
    build(lg)
