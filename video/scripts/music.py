"""Musique et bruitages de la vidéo HOP! (120 BPM, 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (pas de droits d'auteur) : python3 scripts/music.py -> public/hop-music.wav
Les bruitages suivent src/timeline.json (image de début de chaque scène + liste « sfx »).
"""
import json
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
BPM = 120
BEAT = 60 / BPM
TL = json.load(open(os.path.join(ROOT, "src", "timeline.json")))
FPS = TL["fps"]
TOTAL_FRAMES = sum(s["frames"] for s in TL["scenes"]) - (len(TL["scenes"]) - 1) * TL["transition"]
DUR = TOTAL_FRAMES / FPS
N = int(SR * (DUR + 0.2))
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def add(sig, t, gain=1.0, pan=0.0, haas=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    gl = gain * np.sqrt((1 - pan) / 2)
    gr = gain * np.sqrt((1 + pan) / 2)
    L[i : i + len(sig)] += sig * gl
    j = i + int(haas * SR)
    if j < N:
        s2 = sig[: N - j]
        R[j : j + len(s2)] += s2 * gr


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    ph = (t * f * (1 + detune)) % 1
    return 2 * ph - 1


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


# --- Instruments -----------------------------------------------------------
def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 46 + 130 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 300) * 0.35
    return np.tanh((body + click) * 1.6)


def clap():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 3200)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        e += (t >= off) * np.exp(-np.maximum(0, t - off) * (180 if k < 2 else 26))
    return nz * e * 0.8


def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500) * np.exp(-t * (28 if open_ else 110)) * 0.5


def bass(m, length):
    n = int(length * SR)
    s = saw(note(m), n) + 0.5 * np.sin(2 * np.pi * note(m - 12) * np.arange(n) / SR)
    return lp(s, 520) * env(n, 0.004, 0.16) * 1.2


def pluck(ms, length=0.32):
    n = int(length * SR)
    s = np.zeros(n)
    for m in ms:
        for d in (-0.006, 0.0, 0.007):
            s += saw(note(m), n, d)
    s = lp(s / (len(ms) * 3), 2600)
    return s * env(n, 0.002, 0.11)


def pad(ms, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * note(m) * t) + 0.3 * np.sin(4 * np.pi * note(m) * t) for m in ms) / len(ms)
    e = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.3)
    return s * e


# I–V–vi–IV en do majeur (un accord par mesure de 4 temps)
CHORDS = [(48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [60, 64, 69, 72]), (41, [60, 65, 69, 72])]
STAB = [0, 3, 6, 10, 12]  # doubles-croches de la mesure où tombe l'accord

bar = 4 * BEAT
K, CL, H, HO = kick(), clap(), hat(), hat(True)
CTA_T = sum(s["frames"] - TL["transition"] for s in TL["scenes"][:-1]) / FPS
STOP = (CTA_T - BEAT, CTA_T)  # un temps de silence juste avant la fin (puis le « hit »)

ML = np.zeros(N)
MR = np.zeros(N)
side = np.ones(N)


def madd(sig, t, gain, pan=0.0, haas=0.0, duck=True):
    i = int(t * SR)
    if i >= N:
        return
    if STOP[0] - 0.01 <= t < STOP[1] - 0.01:
        return
    sig = sig[: N - i]
    gl = gain * np.sqrt((1 - pan) / 2)
    gr = gain * np.sqrt((1 + pan) / 2)
    tgtL = ML if duck else L
    tgtR = MR if duck else R
    tgtL[i : i + len(sig)] += sig * gl
    j = i + int(haas * SR)
    if j < N:
        tgtR[j : j + len(sig[: N - j])] += sig[: N - j] * gr


t = 0.0
b = 0
end_music = DUR - 0.9
while t < end_music:
    root, ch = CHORDS[b % 4]
    for beat in range(4):
        tb = t + beat * BEAT
        if tb >= end_music:
            break
        madd(K, tb, 0.95, duck=False)
        if not (STOP[0] - 0.01 <= tb < STOP[1] - 0.01):
            k = int(tb * SR)
            n = int(0.25 * SR)
            side[k : k + n] = np.minimum(side[k : k + n], 1 - 0.65 * np.exp(-np.arange(n) / SR * 14)[: len(side[k : k + n])])
        if beat in (1, 3):
            madd(CL, tb, 0.55, duck=False)
        madd(H, tb + BEAT / 2, 0.32, pan=0.35, duck=False)
        madd(H, tb + BEAT / 4, 0.12, pan=-0.35, duck=False)
        madd(H, tb + 3 * BEAT / 4, 0.12, pan=-0.35, duck=False)
        if beat == 3:
            madd(HO, tb + BEAT / 2, 0.22, pan=0.2, duck=False)
        madd(bass(root, BEAT / 2 * 0.9), tb + BEAT / 2, 0.55)
        madd(bass(root + 12, BEAT / 4 * 0.8), tb + 3 * BEAT / 4, 0.28)
    for st in STAB:
        madd(pluck(ch), t + st * BEAT / 4, 0.42, pan=-0.15, haas=0.012)
    madd(pad(ch, bar), t, 0.10, haas=0.02)
    t += bar
    b += 1

# Accord final qui résonne
root, ch = CHORDS[0]
madd(pad(ch + [48], 1.4), end_music, 0.22, haas=0.02, duck=False)
madd(pluck(ch, 1.0) * 1.2, end_music, 0.5, duck=False)
madd(K, end_music, 1.0, duck=False)

L += ML * side
R += MR * side


# --- Bruitages -------------------------------------------------------------
def pop(f0=420, f1=1150, d=0.07):
    n = int(0.16 * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * np.minimum(1, tt / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 30)


def whoosh(d=0.42):
    n = int(d * SR)
    tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    lo = bp(nz, 300, 1500)
    hi = bp(nz, 1500, 7000)
    x = tt / d
    mix = lo * (1 - x) + hi * x
    return mix * np.sin(np.pi * x) ** 2 * 0.9


def hit():
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    crash = hp(rng.standard_normal(n), 4500) * np.exp(-tt * 2.6) * 0.45
    sub = np.sin(2 * np.pi * 42 * tt) * np.exp(-tt * 4) * 0.9
    out = crash + sub
    out[: len(K)] += K * 0.9
    return out


def stamp():
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (70 + 90 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 14)
    slap = bp(rng.standard_normal(n), 400, 2500) * np.exp(-tt * 60) * 0.6
    return thump + slap


def click(f=3500, d=0.012):
    n = int(0.03 * SR)
    tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), f * 0.6, min(f * 1.6, 16000)) * np.exp(-tt / d)


def typing(dur=1.0):
    n = int((dur + 0.05) * SR)
    out = np.zeros(n)
    tt = 0.0
    while tt < dur:
        c = click(2800 + rng.random() * 2500) * (0.5 + rng.random() * 0.5)
        i = int(tt * SR)
        out[i : i + len(c)] += c[: n - i]
        tt += 0.045 + rng.random() * 0.05
    return out * 0.8


def ding():
    n = int(1.1 * SR)
    tt = np.arange(n) / SR
    s = 0
    for f, a in ((1318.5, 1.0), (1975.5, 0.6), (2637, 0.25)):
        s = s + a * np.sin(2 * np.pi * f * tt)
    s2 = np.zeros(n)
    k = int(0.09 * SR)
    for f, a in ((1975.5, 0.9), (2959.9, 0.4)):
        s2[k:] += a * np.sin(2 * np.pi * f * tt[: n - k])
    return (s * np.exp(-tt * 5) + s2 * np.exp(-np.maximum(0, tt - 0.09) * 4.5)) * 0.32


def riser(d=0.95):
    n = int(d * SR)
    tt = np.arange(n) / SR
    x = tt / d
    nz = hp(rng.standard_normal(n), 2000) * x ** 2 * 0.5
    f = 220 + 1200 * x ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * x ** 1.5 * 0.35
    return nz + tone


SFX = {
    "pop": lambda: pop() * 0.55,
    "pop2": lambda: pop(700, 1700, 0.05) * 0.38,
    "whoosh": lambda: whoosh() * 0.55,
    "hit": lambda: hit() * 0.75,
    "stamp": lambda: stamp() * 0.8,
    "type": lambda: typing(0.95) * 0.5,
    "tap": lambda: click(1800, 0.02) * 1.4,
    "ding": lambda: ding(),
    "riser": lambda: riser() * 0.7,
}

start = 0
for sc in TL["scenes"]:
    for fr, name in sc["sfx"]:
        add(SFX[name](), (start + fr) / FPS, 1.0, pan=0.0)
    start += sc["frames"] - TL["transition"]

# --- Mastering -------------------------------------------------------------
st = np.stack([L, R], axis=1)
st = hp(st.T, 30).T
fade = np.ones(N)
fn = int(0.6 * SR)
fade[-fn:] = np.linspace(1, 0, fn)
st *= fade[:, None]
st = np.tanh(st * 1.15) / np.tanh(1.15)
st *= 0.89 / np.max(np.abs(st))

os.makedirs(os.path.join(ROOT, "public"), exist_ok=True)
out = os.path.join(ROOT, "public", "hop-music.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print(out, f"{DUR:.2f} s")
