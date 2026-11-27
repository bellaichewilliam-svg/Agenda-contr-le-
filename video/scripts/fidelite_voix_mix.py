"""Mixe la voix off (Gemini, voix Sulafat, via la fonction fid-tts ; avant : Chatterbox) avec la musique + bruitages de « Fidelite ».
1) /root/cbx/bin/python scripts/voix_chatterbox.py public/fidelite-voix/lignes.json public/fidelite-voix [voix_reference.wav]
2) python3 scripts/fidelite_voix_mix.py  ->  public/fidelite-mix-fr.wav et fidelite-mix-he.wav (utilisés par src/Fidelite.tsx)
Chaque phrase démarre à son image (« at » dans lignes.json) ; si elle déborde sur la phrase suivante, elle est accélérée
(au plus ×1,12, sans changer la hauteur de la voix, filtre atempo de ffmpeg). La musique baisse de 9 dB sous la voix.
"""
import json, os, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
SR, FPS, END = 44100, 30, 1455


def read(path):
    with wave.open(path) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    a = a.reshape(-1, ch).T
    if sr != SR:
        a = np.stack([resample_poly(c, SR, sr) for c in a])
    return a if a.shape[0] == 2 else np.vstack([a, a])


def save(a, path):
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a.T, -1, 1) * 32767).astype(np.int16).tobytes())


def tempo(path, factor):
    out = path.replace(".wav", f".t.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-filter:a", f"atempo={factor:.3f}", out], check=True)
    return out


def trim(v, thr=0.01):
    idx = np.where(np.abs(v).max(0) > thr)[0]
    return v[:, max(0, idx[0] - 400): idx[-1] + 2200] if len(idx) else v


def tighten(v, max_pause=0.14):
    """Raccourcit les silences à l'intérieur d'une phrase (au plus 0,14 s) pour que la voix reste calée sur les images."""
    hop = int(SR * 0.01)
    lvl = np.array([np.abs(v[:, i:i + hop]).max() for i in range(0, v.shape[1], hop)])
    keep, run = [], 0
    for k, x in enumerate(lvl):
        run = run + 1 if x < 0.012 else 0
        if run * 0.01 <= max_pause:
            keep.append(v[:, k * hop:(k + 1) * hop])
    return np.concatenate(keep, axis=1)


def voice_fx(v):
    """Voix naturelle (Gemini) : coupe juste les graves sourds et met au bon niveau, sans durcir le son."""
    sos = butter(2, 70, "highpass", fs=SR, output="sos")
    v = np.stack([sosfilt(sos, c) for c in v])
    return v / (np.abs(v).max() + 1e-9) * 0.85


VDIR = os.environ.get("VOIX", "gemini")   # dossier des phrases : gemini (voix Sulafat) ou "." (anciennes Chatterbox)
lines = json.load(open(os.path.join(PUB, "fidelite-voix", "lignes.json"), encoding="utf-8"))
for lang in ("fr", "he"):
    music = read(os.path.join(PUB, f"fidelite-music-{lang}.wav"))
    N = music.shape[1]
    voice = np.zeros_like(music)
    mine = [l for l in lines if l["lang"] == lang]
    cursor = 0.0   # fin de la phrase précédente (s) : une phrase qui déborde décale légèrement la suivante
    for i, l in enumerate(mine):
        p = os.path.join(PUB, "fidelite-voix", VDIR, l["id"] + ".wav")
        if not os.path.exists(p):
            print("manque", p); continue
        nxt = mine[i + 1]["at"] if i + 1 < len(mine) else END - 12
        room = (nxt - l["at"]) / FPS - 0.12
        v = tighten(trim(read(p)))
        dur = v.shape[1] / SR
        if dur > room:
            f = min(1.15, dur / room)
            v = tighten(trim(read(tempo(p, f))))
            print(f"{l['id']} {dur:.2f}s > {room:.2f}s : accéléré x{f:.2f} -> {v.shape[1] / SR:.2f}s")
        v = voice_fx(v)
        start = max(l["at"] / FPS, cursor + 0.12)
        s = int(start * SR)
        cursor = start + v.shape[1] / SR
        e = min(N, s + v.shape[1])
        if e > s:
            voice[:, s:e] += v[:, : e - s]
    # Baisse de la musique sous la voix (enveloppe lissée, attaque 80 ms, relâche 350 ms)
    env = (np.abs(voice).max(0) > 0.02).astype(np.float32)
    k = np.ones(int(0.35 * SR)) / int(0.35 * SR)
    env = np.clip(np.convolve(env, k, mode="same") * 3, 0, 1)
    duck = 1 - 0.65 * env
    mix = music * duck + voice
    mix = np.tanh(mix / (np.abs(mix).max() / 1.25)) * 0.9 / np.tanh(1.25)
    save(mix, os.path.join(PUB, f"fidelite-mix-{lang}.wav"))
    print("ok", lang)
