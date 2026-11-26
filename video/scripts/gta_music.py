"""Musique et bruitages du montage « Vice City » (HopGta, 23,3 s, 100 BPM : 1 temps = 18 images à 30 i/s).

Tout est synthétisé ici (aucun droit d'auteur) : python3 scripts/gta_music.py -> public/gta/gta-music.wav
Pendant le clip du patron (images 130-430), son propre son reste devant : la musique descend à une nappe douce.
Repères (images) : ouverture 0-130, passage au clip 130, étoiles 196 220 259 280 358, « mission accomplie » 430,
logo 520 (anneau qui se referme à 552), fin 700.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.6, 23.34


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
        sig = sig[: N - i]
        L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
        R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))

    def kick():
        t = ts(0.4)
        return np.sin(2 * np.pi * (44 * t + 90 * (1 - np.exp(-t * 28)) / 28)) * np.exp(-t * 7)

    def snare():   # caisse claire « gated » années 80
        t = ts(0.32)
        n = flt(rng.standard_normal(len(t)), "band", [700, 6000])
        body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
        gate = np.where(t < 0.22, 1.0, np.exp(-(t - 0.22) * 60))
        return (n * 0.8 + body) * gate * np.exp(-t * 3)

    def hat(d=0.04):
        t = ts(d)
        return flt(rng.standard_normal(len(t)), "high", 7500) * np.exp(-t / d * 5)

    def saw(m, t, det=(-0.006, 0, 0.006)):
        return sum(2 * ((hz(m) * (1 + d) * t) % 1) - 1 for d in det) / len(det)

    def pad(ms, d, cut=1800):
        t = ts(d)
        x = sum(saw(m, t) for m in ms) / len(ms)
        env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.6)
        return flt(x, "low", cut) * env

    def bass(m, d):
        t = ts(d)
        x = saw(m, t, (0,)) + 0.5 * np.sin(2 * np.pi * hz(m) * t)
        return flt(x, "low", 520) * np.minimum(1, t * 200) * np.exp(-t * 3)

    def arp(m, d=0.14):
        t = ts(d)
        x = np.sign(np.sin(2 * np.pi * hz(m) * t)) * 0.6 + saw(m, t, (0,)) * 0.4
        return flt(x, "low", 3200) * np.exp(-t * 14) * np.minimum(1, t * 400)

    def bell(m, d=1.4):
        t = ts(d)
        return (np.sin(2 * np.pi * hz(m) * t) + 0.45 * np.sin(2 * np.pi * hz(m) * 2.76 * t) * np.exp(-t * 6)
                + 0.2 * np.sin(2 * np.pi * hz(m) * 5.4 * t) * np.exp(-t * 12)) * np.exp(-t * 2.6)

    def blip(m=93):
        t = ts(0.16)
        return np.sign(np.sin(2 * np.pi * hz(m) * t)) * np.exp(-t * 22) * 0.5 + np.sin(2 * np.pi * hz(m + 12) * t) * np.exp(-t * 30) * 0.4

    def whoosh(d=0.6, up=True):
        t = ts(d)
        n = rng.standard_normal(len(t))
        out = np.zeros(len(t))
        for a, b in ((0, .25), (.25, .5), (.5, .75), (.75, 1)):
            i0, i1 = int(a * len(t)), int(b * len(t))
            c = 400 + 6000 * ((a + b) / 2 if up else 1 - (a + b) / 2)
            out[i0:i1] = flt(n, "band", [c * .6, c * 1.5])[i0:i1]
        return out * (t / d if up else 1 - t / d) ** 2

    def riser(d):
        t = ts(d)
        return flt(rng.standard_normal(len(t)), "band", [600, 7000]) * (t / d) ** 2.6 + 0.25 * np.sin(2 * np.pi * (180 * t + 700 * t * t / d)) * (t / d) ** 2

    def boom(g=1.0):
        t = ts(1.6)
        return (np.sin(2 * np.pi * (34 * t + 60 * (1 - np.exp(-t * 12)) / 12)) * np.exp(-t * 2.6)
                + flt(rng.standard_normal(len(t)), "low", 800) * np.exp(-t * 7) * 0.5) * g

    CH = [(41, [53, 57, 60, 64]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (40, [52, 55, 59, 64])]  # Fmaj7 G Am Em : coucher de soleil
    ARP = [0, 7, 12, 16, 12, 7, 4, 7]

    def groove(t0, beats, full=True, g=1.0):
        for b in range(beats):
            t = t0 + b * BEAT
            root, notes = CH[(b // 4) % 4]
            if full:
                add(kick(), t, 0.9 * g)
                if b % 2: add(snare(), t, 0.42 * g)
                add(hat(), t + BEAT / 2, 0.16 * g, pan=0.35)
            add(bass(root, 0.28), t, 0.5 * g); add(bass(root + 12, 0.2), t + BEAT / 2, 0.28 * g)
            for k in range(4):   # arpège en doubles croches
                add(arp(root + 12 + ARP[(b * 4 + k) % 8]), t + k * BEAT / 4, 0.12 * g, pan=0.4 if k % 2 else -0.4)
            if b % 4 == 0:
                add(pad(notes, BEAT * 4 + 0.3), t, 0.22 * g)

    # ---- 1. ouverture (0–130) : nappe + arpège, la batterie entre sur le titre
    add(pad([53, 57, 60, 64], 2.0, 1200), 0, 0.3)
    groove(f2t(18), 6, full=False, g=0.8)
    add(boom(0.7), f2t(18))
    for b in range(2):
        t = f2t(18) + (4 + b) * BEAT
        add(kick(), t, 0.8); add(snare(), t + BEAT / 2, 0.3) if b else None
    add(blip(88), f2t(62), 0.35); add(blip(95), f2t(66), 0.3)          # la carte s'allume
    add(riser(1.1), f2t(130) - 1.1, 0.42)
    add(whoosh(0.5, True), f2t(130) - 0.5, 0.5)
    # ---- 2. le clip (130–430) : son du patron devant, nappe très douce + une étoile par grand moment
    add(pad([53, 57, 60, 64], 10.2, 700), f2t(130), 0.09)
    for i, fr in enumerate((196, 220, 259, 280, 358)):
        add(blip(86 + 2 * i), f2t(fr), 0.22)
    add(riser(1.0), f2t(430) - 1.0, 0.3)
    # ---- 3. « mission accomplie » (430–520) : carillon + reprise du rythme
    for k, m in enumerate((72, 76, 79, 84)):
        add(bell(m), f2t(430) + k * 0.09, 0.32, pan=-0.2 + 0.13 * k)
    add(boom(0.8), f2t(430))
    groove(f2t(430) + BEAT, 5)
    # ---- 4. logo et appel (520–700)
    add(whoosh(0.45, False), f2t(520), 0.4)
    add(boom(1.0), f2t(552))
    groove(f2t(552), 9)
    add(bell(84), f2t(552), 0.3); add(bell(91), f2t(552) + 0.1, 0.22)
    add(pad([53, 57, 60, 64, 69], 2.6, 1500), f2t(622), 0.22)

    mix = np.stack([L, R], 1)
    # fondu de fin
    fade = int(SR * 0.9)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix *= 0.89 / max(1e-9, np.abs(mix).max())
    return (mix * 32767).astype(np.int16)


if __name__ == "__main__":
    out = os.path.join(ROOT, "public", "gta", "gta-music.wav")
    data = build()
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    print(out, len(data) / SR, "s")
