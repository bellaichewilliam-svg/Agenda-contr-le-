"""Musique du survol 3D de la page HOP! (14,5 s), synthétisée ici (pas de droits d'auteur).

python3 scripts/fly_music.py -> public/fly-music.wav
Repères : montée de 7,75 s à 9,25 s (vue d'ensemble), plongée à 9,47 s, carte titre à 9,97 s.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
DUR = 14.5
N = int(SR * (DUR + 0.6))
rng = np.random.default_rng(5)
L = np.zeros(N)
R = np.zeros(N)
BPM = 96
BEAT = 60 / BPM


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2)
    R[i : i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2)


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(n):
    return np.arange(n) / SR


def pad(ms, length, att=0.8, rel=1.2, bright=1500):
    n = int(length * SR)
    t = ts(n)
    x = np.zeros(n)
    for m in ms:
        for d in (-0.005, 0, 0.006):
            ph = (t * note(m) * (1 + d)) % 1
            x += (2 * ph - 1) * 0.5 + np.sin(2 * np.pi * note(m) * (1 + d) * t) * 0.5
    x = lp(x / (len(ms) * 3), bright)
    a = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (length - t) / rel))
    return x * a


def pluck(m, length=0.9):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return x * np.minimum(1, t / 0.004) * np.exp(-t * 4.2) * 0.5


def bell(m, length=2.5):
    n = int(length * SR)
    t = ts(n)
    f = note(m)
    x = sum(np.sin(2 * np.pi * f * k * t) * a * np.exp(-t * (1.6 + k)) for k, a in ((1, 1), (2.76, 0.4), (5.4, 0.18)))
    return x * 0.4


def sub(m, length):
    n = int(length * SR)
    t = ts(n)
    return np.sin(2 * np.pi * note(m) * t) * np.minimum(1, t / 0.02) * np.exp(-t * 1.8) * 0.8


def soft_kick():
    n = int(0.5 * SR)
    t = ts(n)
    f = 42 + 70 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9


def tick():
    n = int(0.06 * SR)
    t = ts(n)
    return hp(rng.standard_normal(n), 6000) * np.exp(-t * 60) * 0.25


def whoosh(d, up=True):
    n = int(d * SR)
    t = ts(n)
    nz = rng.standard_normal(n + 4096)
    out = np.zeros(n)
    seg = 1024
    for i in range(0, n, seg):
        p = i / n
        f = 250 + 3800 * (p if up else 1 - p)
        out[i : i + seg] = bp(nz[i : i + seg + 2048], f * 0.6, min(f * 1.5, 16000))[: len(out[i : i + seg])]
    e = np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    return out * e * 0.55


def impact():
    n = int(2.5 * SR)
    t = ts(n)
    s = np.sin(2 * np.pi * (36 + 40 * np.exp(-t * 14)) * t) * np.exp(-t * 2.2)
    air = hp(rng.standard_normal(n), 5000) * np.exp(-t * 2.6) * 0.18
    return np.tanh((s + air) * 1.3)


# --- Arrangement ----------------------------------------------------------------
# Accords : Fmaj7 - Am7 - Dm9 - Bbmaj7 (2 mesures chacun, 96 BPM)
CH = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60, 64], [46, 50, 53, 57]]
bar = 4 * BEAT
for i in range(4):
    add(pad(CH[i % 4], bar * 1.15 + 0.6, att=0.9 if i == 0 else 0.25), i * bar, 0.55)
    add(sub(CH[i % 4][0] - 12, bar), i * bar, 0.35)
# Arpège léger pendant le survol (doubles croches à 96 BPM)
arp = [0, 2, 1, 3, 2, 1, 3, 2]
t = 0.0
k = 0
while t < 7.6:
    ch = CH[int(t // bar) % 4]
    m = ch[arp[k % len(arp)] % len(ch)] + 12
    add(pluck(m), t, 0.22 * min(1, t / 1.2 + 0.25), pan=0.35 if k % 2 else -0.35)
    if k % 4 == 0 and t > 1.2:
        add(soft_kick(), t, 0.35)
    if k % 2 == 1 and t > 2.4:
        add(tick(), t, 0.5, pan=0.4)
    t += BEAT / 2
    k += 1
# Montée vers la vue d'ensemble, souffle, puis la plongée
add(whoosh(1.7, True), 7.6, 0.9)
add(pad([65, 69, 72, 76], 1.8, att=1.2, rel=0.4, bright=3200), 7.6, 0.35)
add(whoosh(0.55, False), 9.45, 0.8)
# Carte titre : impact doux, accord final, cloches
add(impact(), 9.97, 0.9)
add(pad([53, 60, 64, 67, 72], 4.9, att=0.05, rel=1.6, bright=2600), 9.97, 0.75)
add(sub(41, 4.0), 9.97, 0.5)
for j, (m, dt) in enumerate(((84, 0.0), (79, 0.45), (76, 0.9), (88, 1.6))):
    add(bell(m), 10.1 + dt, 0.35, pan=(-0.4, 0.4, -0.2, 0.2)[j])
for j, m in enumerate((72, 76, 79, 84)):
    add(pluck(m, 1.4), 11.6 + j * 0.16, 0.18, pan=-0.3 + 0.2 * j)

# --- Petite réverbération (échos diffus) et mastering -----------------------------
mix = np.stack([L, R], axis=1)
wet = np.zeros_like(mix)
for d, g in ((0.031, 0.32), (0.047, 0.28), (0.071, 0.24), (0.113, 0.2), (0.173, 0.16), (0.251, 0.12), (0.367, 0.09)):
    i = int(d * SR)
    wet[i:, 0] += mix[:-i, 1] * g
    wet[i:, 1] += mix[:-i, 0] * g
mix = mix + lp(wet.T, 4000).T * 0.6
mix = hp(mix.T, 25).T
peak = np.max(np.abs(mix)) or 1
mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.9
mix = mix[: int(DUR * SR)]
fade = int(0.6 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
fin = int(0.02 * SR)
mix[:fin] *= np.linspace(0, 1, fin)[:, None]
pcm = (mix * 32767).astype(np.int16)
out = os.path.join(ROOT, "public", "fly-music.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out)
