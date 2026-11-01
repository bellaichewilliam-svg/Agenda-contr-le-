"""Musique du « Film de lancement » HOP! (26 s, 120 BPM). Synthétisée ici, sans droits.

Tout est synthétisé ici (pas de droits d'auteur) : python3 scripts/lancement_music.py -> public/lancement-music.wav
Repères (images à 30 i/s) : ventre qui gargouille 6, touches 60 / 78, commande envoyée 81,
sonnette 330, livré 346, « c'est chaud » 390, logo 510.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
FPS = 30
BEAT = 0.5
DUR = 26.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def add(sig, t, gain=1.0, pan=0.0):
    """Ajout circulaire : ce qui dépasse la fin revient au début (boucle parfaite)."""
    i = int(t * SR) % N
    idx = (np.arange(len(sig)) + i) % N
    np.add.at(L, idx, sig * gain * np.sqrt((1 - pan) / 2))
    np.add.at(R, idx, sig * gain * np.sqrt((1 + pan) / 2))


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(n):
    return np.arange(n) / SR


def kick(p=1.0):
    n = int(0.4 * SR)
    t = ts(n)
    f = 46 + 120 * np.exp(-t * 28)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 1.6 * p)


def clap():
    n = int(0.25 * SR)
    t = ts(n)
    e = np.zeros(n)
    for k in (0, 0.01, 0.02):
        i = int(k * SR)
        e[i:] += np.exp(-t[: n - i] * 70)
    return bp(rng.standard_normal(n), 900, 5000) * (e + np.exp(-t * 15) * 0.4) * 0.8


def hat(open_=False):
    n = int((0.2 if open_ else 0.05) * SR)
    t = ts(n)
    return hp(rng.standard_normal(n), 7500) * np.exp(-t * (14 if open_ else 90)) * 0.45


def bass(m, length):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    x = lp(np.sin(2 * np.pi * f * t) + 0.4 * np.sign(np.sin(2 * np.pi * f * t)), 600)
    return np.tanh(x * np.minimum(1, t / 0.006) * np.exp(-t * 2.6) * 1.3) * 0.75


def keys(ms, length):
    """Piano électrique doux (accords)."""
    n = int(length * SR)
    t = ts(n)
    x = np.zeros(n)
    for m in ms:
        f = note(m)
        x += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)) * np.exp(-t * 1.8)
    return lp(x / len(ms), 3000) * np.minimum(1, t / 0.004) * 0.6


def pluck(m, length=0.35):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 9) * 0.5


def bell(m, length=1.2):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    return sum(np.sin(2 * np.pi * f * k * t) * a * np.exp(-t * (2.5 + k)) for k, a in ((1, 1), (2.0, 0.35), (3.01, 0.15))) * 0.5


def tap():
    n = int(0.06 * SR)
    t = ts(n)
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) * 0.6


def growl():
    """Ventre qui gargouille : grave, modulé, rigolo."""
    n = int(0.9 * SR)
    t = ts(n)
    f = 70 + 25 * np.sin(2 * np.pi * 7 * t) + 30 * t
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t))
    return lp(np.tanh(x * 2), 400) * np.sin(np.pi * t / 0.9) * 0.9


def whoosh(d=0.4):
    n = int(d * SR)
    t = ts(n)
    nz = rng.standard_normal(n + 4096)
    out = np.zeros(n)
    for i in range(0, n, 512):
        f = 300 + 4000 * (i / n)
        out[i : i + 512] = bp(nz[i : i + 2560], f * 0.7, min(f * 1.4, 16000))[: len(out[i : i + 512])]
    return out * np.sin(np.pi * t / d) ** 2 * 0.6


def hit():
    n = int(1.0 * SR)
    t = ts(n)
    s = np.sin(2 * np.pi * (40 + 50 * np.exp(-t * 16)) * t) * np.exp(-t * 3)
    return np.tanh((s + hp(rng.standard_normal(n), 4000) * np.exp(-t * 4) * 0.3) * 1.4)


f2s = lambda f: f / FPS
# 13 mesures de 4 temps (26 s). Am7 - Dm7 - G7 - Cmaj7 ; intro légère, fin sur l'accord de do.
CH = [(45, [57, 60, 64, 67]), (50, [53, 57, 60, 65]), (43, [55, 59, 62, 65]), (48, [55, 59, 64, 67])]
for bar in range(13):
    t0 = bar * 4 * BEAT
    root, ch = CH[bar % 4] if bar < 12 else CH[3]
    calm = bar == 0
    last = bar == 12
    add(keys(ch, 4 * BEAT + 0.3), t0, 0.5 if not last else 0.6)
    for b in range(4):
        t = t0 + b * BEAT
        if last and b > 0:
            continue
        if not calm or b in (0, 2):
            add(kick(0.9), t, 0.75)
        if b % 2 == 1 and not calm:
            add(clap(), t, 0.4)
        add(hat(), t + BEAT / 2, 0.28, pan=0.3)
        if not calm:
            add(hat(), t + BEAT / 4, 0.12, pan=-0.3)
        add(bass(root - 12 + (7 if b == 3 else 0), BEAT * 0.85), t, 0.6)
    if bar % 2 == 1 and not last:
        mel = [ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[0] + 24, ch[3] + 12, ch[2] + 12]
        for k, m in enumerate(mel):
            add(pluck(m), t0 + k * BEAT / 2, 0.22, pan=-0.4 + 0.1 * k)

# Bruitages (calés sur src/Lancement.tsx) : le logo d'ouverture, un volet à chaque affiche, le logo et Hoppy à la fin
for k in range(4):                          # les lettres du logo d'ouverture
    add(pluck(72 + [0, 4, 7, 12][k], 0.4), f2s(2 + k * 3), 0.4)
add(hit(), f2s(14), 0.7)
for c in (60, 160, 260, 360, 460, 560, 660):
    add(whoosh(0.4), f2s(c - 8), 0.6)
for c in (60, 160, 260, 360, 460, 560):     # le reflet sur chaque affiche
    add(bell(88, 0.8), f2s(c + 18), 0.22)
for k in range(4):                          # les lettres du logo de fin
    add(pluck(72 + [0, 4, 7, 12][k], 0.4), f2s(664 + k * 3), 0.4)
add(hit(), f2s(676), 0.8)
add(bell(81, 1.4), f2s(688), 0.4)
add(whoosh(0.45), f2s(706), 0.5)            # Hoppy saute
add(hit(), f2s(724), 0.55)

mix = np.stack([L, R], axis=1)
mix = hp(mix.T, 28).T
# fondu de sortie sur la dernière seconde
fade = np.ones(N); fade[-SR:] = np.linspace(1, 0, SR) ** 1.5
mix = mix * fade[:, None]
peak = np.max(np.abs(mix)) or 1
mix = np.tanh(mix / peak * 1.3) / np.tanh(1.3) * 0.9
pcm = (mix * 32767).astype(np.int16)
out = os.path.join(ROOT, "public", "lancement-music.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out, f"{DUR:.1f}s")
