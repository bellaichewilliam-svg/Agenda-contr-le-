"""Musique et bruitages de « Fidélite » (carte de fidélité dans le Wallet, 54 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (aucun droit d'auteur) : python3 scripts/fidelite_music.py -> public/fidelite-music-fr.wav et -he.wav
Les coups tombent sur les coupes de src/Fidelite.tsx (CUTS) et sur les gestes : tampons rouges « Perdue / Oubliée / Jetée »,
toucher « Créer ma carte », tampons de la carte, cadeau (carillon), coches du comparatif, fonctions, chiffres, fin.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.5, 48.5
CUTS = [0, 120, 240, 360, 450, 570, 720, 1020, 1140, 1245, 1335]


def flt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(d):
    return np.arange(int(SR * d)) / SR


def f2t(frame):
    return frame / 30


def build():
    rng = np.random.default_rng(7)
    N = int(SR * DUR)
    L, R = np.zeros(N), np.zeros(N)

    def add(sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0 or i >= N:
            return
        s = sig[: N - i] * gain
        L[i:i + len(s)] += s * (1 - max(0, pan))
        R[i:i + len(s)] += s * (1 + min(0, pan))

    # --- instruments ---
    def kick():
        t = ts(0.35)
        f = 50 + 90 * np.exp(-t * 30)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

    def clap():
        t = ts(0.22)
        return flt(rng.standard_normal(len(t)), "bandpass", [900, 3500]) * np.exp(-t * 22) * 0.6

    def hat(open_=False):
        t = ts(0.18 if open_ else 0.05)
        return flt(rng.standard_normal(len(t)), "highpass", 7000) * np.exp(-t * (14 if open_ else 70)) * 0.25

    def pluck(m, d=0.45):
        t = ts(d)
        f = hz(m)
        s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
        return s * np.exp(-t * 7) * np.minimum(1, t * 400)

    def pad(ms, d):
        t = ts(d)
        s = sum(np.sin(2 * np.pi * hz(m) * t * (1 + det)) for m in ms for det in (-0.003, 0.003))
        env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5)
        return flt(s, "lowpass", 2200) * env * 0.07

    def bass(m, d):
        t = ts(d)
        s = np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(4 * np.pi * hz(m) * t)
        return flt(s, "lowpass", 600) * np.exp(-t * 2.5) * np.minimum(1, t * 300) * 0.5

    def whoosh(d=0.5):
        t = ts(d)
        n = rng.standard_normal(len(t))
        env = np.sin(np.pi * t / d) ** 2
        return flt(n, "bandpass", [400, 5000]) * env * 0.35

    def pop(m=84):
        t = ts(0.16)
        f = hz(m) * (1 + 1.2 * np.exp(-t * 40))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * 0.7

    def thud():
        t = ts(0.4)
        f = 80 + 120 * np.exp(-t * 25)
        n = flt(rng.standard_normal(len(t)), "lowpass", 1200) * np.exp(-t * 30) * 0.4
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + n

    def chime(base=84):
        out = np.zeros(int(SR * 1.6))
        for k, m in enumerate([base, base + 4, base + 7, base + 12]):
            t = ts(1.6 - k * 0.08)
            s = np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 3) * 0.3
            i = int(k * 0.08 * SR)
            out[i:i + len(s)] += s
        return out

    # --- progression : F – C – Dm – Bb (chaleureux, positif), 2 mesures par accord ---
    chords = [[53, 57, 60, 65], [48, 52, 55, 64], [50, 53, 57, 62], [46, 50, 53, 62]]
    roots = [41, 36, 38, 34]
    bar = BEAT * 4
    t = 0.0
    k = 0
    while t < DUR - 0.5:
        ci = (k // 2) % 4
        add(pad(chords[ci], bar), t, 1.0)
        for b in range(4):
            tb = t + b * BEAT
            if tb >= DUR:
                break
            intro = tb < f2t(165)
            add(bass(roots[ci] + (12 if b == 2 else 0), BEAT * 0.9), tb, 0.9)
            if not intro or b in (0, 2):
                add(kick(), tb, 0.9)
            if not intro and b in (1, 3):
                add(clap(), tb, 0.55)
            for h in range(2):
                add(hat(open_=(h == 1 and b == 3)), tb + h * BEAT / 2, 0.8 if not intro else 0.4, pan=0.3)
            # mélodie pincée (motif de 8 croches)
            mel = [72, 76, 77, 79, 77, 76, 72, 74] if ci in (0, 1) else [74, 77, 81, 79, 77, 74, 72, 70]
            if tb >= f2t(345) and tb < f2t(1500):
                add(pluck(mel[(b * 2) % 8]), tb, 0.16, pan=-0.25)
                add(pluck(mel[(b * 2 + 1) % 8]), tb + BEAT / 2, 0.12, pan=0.25)
        t += bar
        k += 1

    # --- bruitages calés sur l'image (src/Fidelite.tsx v2) ---
    for c in CUTS[1:]:
        add(whoosh(0.4), f2t(c) - 0.25, 0.9)
    for i in range(3):
        add(thud(), f2t(40 + i * 16), 0.8)                      # PERDUE / OUBLIÉE / JETÉE
    add(pop(84), f2t(120 + 52), 0.7)                            # la carte glisse dans le Wallet
    add(pop(96), f2t(240 + 70), 0.6)                            # bip du scan
    add(chime(84), f2t(240 + 74), 0.7)                          # la carte apparaît
    add(pop(72), f2t(360 + 24), 0.6)                            # « 0 appli »
    for i in range(4):
        add(pop(78 + i * 2), f2t(450 + 10 + i * 12), 0.45)      # cartes empilées
        add(pop(88), f2t(450 + 50 + i * 8), 0.4)                # pastilles
    for e in (30, 64, 98):
        add(pop(90), f2t(570 + e), 0.9)                         # tampons
    add(chime(89), f2t(570 + 104), 0.6)                         # notification
    for i in range(4):
        add(chime(84 + i * 2), f2t(720 + i * 75 + 14), 0.55)    # notifications de l'écran verrouillé
    add(thud(), f2t(1020 + 44), 0.5)                            # « Envoyer à tous »
    for i in range(10):
        add(pop(84 + (i % 5) * 2), f2t(1020 + 52 + i * 3), 0.35)
    for i in range(5):
        add(pop(80 + i), f2t(1140 + 24 + i * 7), 0.4)           # les habitués
    add(pop(84), f2t(1335 + 14), 0.6)
    add(chime(84), f2t(1335 + 50), 0.9)                         # fin

    mix = np.stack([L, R], 1)
    fade = np.minimum(1, (DUR - np.arange(N) / SR) / 1.5)[:, None]
    mix *= fade
    mix /= max(1e-9, np.abs(mix).max()) / 0.89
    return mix


def save(mix, path):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    m = build()
    for lang in ("fr", "he"):
        save(m, os.path.join(ROOT, "public", f"fidelite-music-{lang}.wav"))
    print("ok")
