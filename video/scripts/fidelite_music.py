"""Musique et bruitages de « Fidelite » v2 (carte de fidélité dans le Wallet, 48,5 s, 120 BPM : 1 temps = 15 images à 30 i/s).

Tout est synthétisé ici (aucun droit d'auteur ; Freesound n'est pas joignable depuis le poste de travail) :
    python3 scripts/fidelite_music.py  ->  public/fidelite-music-fr.wav et -he.wav
Règles video-shotcraft (aesthetic-rules S1–S4) : vocabulaire de film publicitaire (whoosh / impact / riser / sparkle),
pas de sons de jeu vidéo ; un fond tech-house (kick 4 temps, clap 2-4, charleston ouverte à contretemps, basse, accords
étouffés) ; chaque bruitage est cloué sur une image précise de src/Fidelite.tsx (table SFX plus bas) ; les séries
(cartes, téléphones) alternent deux timbres avec un volume qui descend ; 3 grands impacts seulement (R4).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BEAT, DUR = 44100, 0.5, 48.5
CUTS = [0, 120, 240, 360, 450, 570, 720, 1020, 1140, 1245, 1335]
rng = np.random.default_rng(42)


def flt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def ts(d):
    return np.arange(int(SR * d)) / SR


def f2t(frame):
    return frame / 30


def norm(x, peak=1.0):
    m = np.abs(x).max()
    return x / m * peak if m > 0 else x


# Réverbération : réponse impulsionnelle synthétique (bruit à décroissance exponentielle, stéréo décorrélée)
def ir(seconds=1.6, decay=3.2, seed=1):
    r = np.random.default_rng(seed)
    t = ts(seconds)
    env = np.exp(-t * decay)
    return [flt(r.standard_normal(len(t)) * env, "lowpass", 7000) * 0.06 for _ in range(2)]


IR_L, IR_R = ir(seed=1), ir(seed=2)
IR_L, IR_R = IR_L[0], IR_R[1]


# ---------------- Bruitages « film publicitaire » ----------------
def whoosh(d=0.55, lo=300, hi=6000):
    """Souffle de caméra : bruit filtré dont la bande monte puis descend (effet Doppler), attaque douce."""
    t = ts(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    seg = 256
    for i in range(0, len(t), seg):
        p = i / len(t)
        c = lo + (hi - lo) * np.sin(np.pi * p) ** 1.5
        out[i:i + seg] = flt(n[i:i + seg + 64], "bandpass", [max(80, c * 0.6), min(16000, c * 1.4)], 1)[:len(out[i:i + seg])]
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return norm(out * env, 0.5)


def impact(d=1.4, low=46):
    """Impact cinématographique : sub qui tombe + transitoire de bruit + queue."""
    t = ts(d)
    f = low + 70 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    hit = flt(rng.standard_normal(len(t)), "lowpass", 2500) * np.exp(-t * 28)
    body = flt(rng.standard_normal(len(t)), "bandpass", [120, 600]) * np.exp(-t * 7) * 0.5
    return norm(sub * 1.0 + hit * 0.6 + body, 0.95)


def riser(d=2.0):
    """Montée : bruit dont le filtre s'ouvre + note qui monte, s'arrête net sur le temps."""
    t = ts(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    seg = 512
    for i in range(0, len(t), seg):
        c = 400 + 9000 * (i / len(t)) ** 2
        out[i:i + seg] = flt(n[i:i + seg + 64], "bandpass", [c * 0.7, min(18000, c * 1.3)], 1)[:len(out[i:i + seg])]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / d) ** 2) / SR) * 0.25
    env = (t / d) ** 2.2
    return norm((out + tone) * env, 0.55)


def sparkle(d=1.2, base=2600, count=9, seed=3):
    """Scintillement : petites cloches aiguës désaccordées, en cascade montante (pour les moments magiques)."""
    r = np.random.default_rng(seed)
    out = np.zeros(int(SR * d))
    for k in range(count):
        at = int(SR * (k * 0.045 + r.random() * 0.02))
        f = base * (1 + k * 0.09) * (1 + r.random() * 0.02)
        t = ts(d - at / SR)
        s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * (6 + r.random() * 3))
        s = s[: len(out) - at]
        out[at:at + len(s)] += s * (0.9 - k * 0.06)
    return norm(flt(out, "highpass", 1200), 0.45)


def click(bright=3200):
    """Déclic mécanique réel (bouton, tampon qui frappe) : transitoire très court, pas un « bip »."""
    t = ts(0.06)
    n = flt(rng.standard_normal(len(t)), "bandpass", [bright * 0.6, bright * 1.6]) * np.exp(-t * 160)
    thump = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.5
    return norm(n + thump, 0.8)


def stamp():
    """Tampon encreur qui frappe le papier : bruit sec grave + petit déclic (même famille que le visuel « tampon »)."""
    t = ts(0.22)
    body = flt(rng.standard_normal(len(t)), "lowpass", 900) * np.exp(-t * 38)
    knock = np.sin(2 * np.pi * np.cumsum(140 + 120 * np.exp(-t * 60)) / SR) * np.exp(-t * 30)
    return norm(body * 0.7 + knock + np.pad(click(2600), (0, len(t) - len(click(2600)))) * 0.4, 0.85)


def notif_chime(root=88):
    """Carillon doux de notification (montré à l'écran comme une vraie notification : usage narratif voulu, sound-design §3.3)."""
    out = np.zeros(int(SR * 1.3))
    for k, (m, at) in enumerate([(root, 0.0), (root + 7, 0.09)]):
        t = ts(1.3 - at)
        f = hz(m)
        s = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * f * 3 * t)) * np.exp(-t * 4.5)
        i = int(at * SR)
        s = s[: len(out) - i]
        out[i:i + len(s)] += s * (1 - k * 0.25)
    return norm(out, 0.5)


def paper(d=0.35):
    """Carton / papier qui glisse (la carte en carton qui tombe)."""
    t = ts(d)
    n = flt(rng.standard_normal(len(t)), "bandpass", [900, 5000]) * (np.sin(np.pi * t / d) ** 0.7)
    return norm(n, 0.4)


# ---------------- Fond tech-house ----------------
def kick():
    t = ts(0.4)
    f = 48 + 110 * np.exp(-t * 32)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) + flt(rng.standard_normal(len(t)), "highpass", 3000) * np.exp(-t * 200) * 0.15


def clap():
    t = ts(0.28)
    out = np.zeros(len(t))
    for d0 in (0, 0.011, 0.023):
        i = int(d0 * SR)
        tt = ts(0.28 - d0)[: len(out) - int(d0 * SR)]
        out[i:i + len(tt)] += flt(rng.standard_normal(len(tt)), "bandpass", [900, 4000]) * np.exp(-tt * 26)
    return out * 0.6


def hat(open_=False):
    t = ts(0.22 if open_ else 0.04)
    return flt(rng.standard_normal(len(t)), "highpass", 8000) * np.exp(-t * (13 if open_ else 90)) * 0.3


def bass(m, d):
    t = ts(d)
    saw = 2 * ((hz(m) * t) % 1) - 1
    return flt(saw, "lowpass", 380) * np.minimum(1, t * 200) * np.exp(-t * 3) * 0.55


def stab(ms, d=0.32):
    """Accord étouffé façon house (scie filtrée), sur les contretemps."""
    t = ts(d)
    s = sum(2 * ((hz(m) * (1 + det) * t) % 1) - 1 for m in ms for det in (-0.004, 0.004))
    return flt(s, "lowpass", 1600) * np.exp(-t * 9) * np.minimum(1, t * 300) * 0.06


def pad(ms, d):
    t = ts(d)
    s = sum(np.sin(2 * np.pi * hz(m) * t * (1 + det)) for m in ms for det in (-0.003, 0.003))
    return flt(s, "lowpass", 1800) * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.6) * 0.05


def build():
    N = int(SR * DUR)
    M = np.zeros((2, N))          # musique
    X = np.zeros((2, N))          # bruitages (bus séparé, réverb plus courte)

    def add(bus, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0 or i >= N:
            return
        s = sig[: N - i] * gain
        bus[0, i:i + len(s)] += s * (1 - max(0, pan))
        bus[1, i:i + len(s)] += s * (1 + min(0, pan))

    chords = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]]   # Fmaj7 Dm7 Bbmaj7 C7
    roots = [41, 38, 34, 36]
    bar = BEAT * 4
    k = 0
    t = 0.0
    while t < DUR - 0.2:
        ci = k % 4
        intro = t < f2t(120)
        breakdown = f2t(720) <= t < f2t(1020)      # écran verrouillé : la musique s'allège pour les notifications
        add(M, pad(chords[ci], bar), t, 1.0)
        for b in range(4):
            tb = t + b * BEAT
            if tb >= DUR:
                break
            if not intro:
                add(M, kick(), tb, 0.55 if breakdown else 0.95)
            if not intro and not breakdown and b in (1, 3):
                add(M, clap(), tb, 0.5)
            add(M, hat(), tb, 0.35, pan=0.25)
            if not intro:
                add(M, hat(open_=True), tb + BEAT / 2, 0.45 if not breakdown else 0.25, pan=-0.2)
                add(M, bass(roots[ci], BEAT * 0.45), tb + BEAT / 2, 0.8)
                if not breakdown:
                    add(M, stab(chords[ci]), tb + BEAT / 2, 1.0, pan=0.15 if b % 2 else -0.15)
        t += bar
        k += 1

    # ---------------- Table des bruitages (image → son), src/Fidelite.tsx v2 ----------------
    SFX = [
        # coupes : souffle de caméra à chaque changement de scène (cercle qui s'ouvre)
        *[(c - 6, whoosh(0.5), 0.55, 0.0) for c in CUTS[1:]],
        (2, riser(3.6), 0.35, 0.0),                 # montée d'intro jusqu'à la scène 2
        (40, stamp(), 0.9, -0.2), (56, stamp(), 0.8, 0.2), (72, stamp(), 0.7, 0.0),   # PERDUE / OUBLIÉE / JETÉE (tampons rouges)
        (96, paper(0.5), 0.8, 0.0),                 # la carte en carton tombe
        (120, impact(), 0.55, 0.0),                 # GRAND IMPACT 1/3 : « …dans le Wallet ? »
        (120 + 52, whoosh(0.35, 800, 9000), 0.5, 0.2), (120 + 60, click(2400), 0.7, 0.0),   # la carte se range dans le Wallet
        (240 + 44, click(4200), 0.45, 0.2),         # le téléphone vise le QR
        (240 + 74, sparkle(), 0.6, 0.0),            # la carte apparaît dans le téléphone
        (360 + 24, click(2000), 0.6, -0.2),         # « 0 appli »
        *[(450 + 10 + i * 12, whoosh(0.28, 900, 7000), 0.42 - i * 0.06, (-0.3, 0.3)[i % 2]) for i in range(4)],   # cartes empilées
        *[(450 + 50 + i * 8, click((3600, 2800)[i % 2]), 0.5 - i * 0.07, 0.0) for i in range(4)],                 # pastilles
        (570, impact(1.2, 52), 0.4, 0.0),           # GRAND IMPACT 2/3 : « Un tampon à chaque passage »
        *[(570 + e, stamp(), 0.95 - i * 0.1, 0.0) for i, e in enumerate((30, 64, 98))],   # tampons sur la carte
        (570 + 104, notif_chime(88), 0.55, 0.0),    # notification « Nouveau tampon »
        *[(720 + i * 75 + 14, notif_chime(86 + (i % 2) * 3), 0.6, 0.0) for i in range(4)],   # 4 notifications écran verrouillé
        (720 + 85, sparkle(0.9, 3200, 7, 9), 0.35, -0.3),   # gâteau d'anniversaire
        (1020 + 44, click(1800), 0.8, 0.0),         # « Envoyer à tous » (bouton enfoncé)
        (1020 + 46, riser(0.25), 0.3, 0.0),
        *[(1020 + 52 + i * 3, notif_chime(91 + (i % 2) * 2) * 0.7, 0.32 - i * 0.022, (-0.4 + 0.08 * i)) for i in range(10)],   # les 10 téléphones s'allument
        *[(1140 + 24 + i * 7, whoosh(0.22, 1200, 8000), 0.3 - i * 0.04, 0.3) for i in range(5)],   # les habitués glissent
        (1245, riser(2.8), 0.32, 0.0),              # défilé des fonctionnalités → montée vers la fin
        (1335, impact(1.8, 44), 0.75, 0.0),         # GRAND IMPACT 3/3 : « Ta carte de fidélité »
        (1335 + 50, sparkle(1.4, 2400, 11, 5), 0.55, 0.0),   # « Crée la tienne »
    ]
    for frame, sig, vol, pan in SFX:
        add(X, sig, f2t(frame), vol, pan)

    # Réverbération : musique (salle longue, mouillée), bruitages (plus sec)
    def verb(bus, wet):
        L = fftconvolve(bus[0], IR_L)[:N]
        R = fftconvolve(bus[1], IR_R)[:N]
        return bus + wet * np.stack([L, R])

    M = verb(M, 0.9)
    X = verb(X, 0.45)
    # La musique s'efface légèrement sous les grands impacts (sidechain simple)
    duck = np.ones(N)
    for frame in (120, 570, 1335):
        i = int(f2t(frame) * SR)
        tt = ts(0.9)
        duck[i:i + len(tt)] = np.minimum(duck[i:i + len(tt)], 1 - 0.55 * np.exp(-tt * 4))
    mix = M * duck * 0.8 + X
    fade_in = np.minimum(1, np.arange(N) / (SR * 0.3))
    fade_out = np.minimum(1, (DUR - np.arange(N) / SR) / 1.6)
    mix *= fade_in * fade_out
    mix = np.tanh(mix / (np.abs(mix).max() / 1.4)) * 0.89 / np.tanh(1.4)   # léger limiteur doux
    return mix.T


def save(mix, path):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    m = build()
    for lang in ("fr", "he"):
        save(m, os.path.join(ROOT, "public", f"fidelite-music-{lang}.wav"))
    print("ok", m.shape, float(np.abs(m).max()))
