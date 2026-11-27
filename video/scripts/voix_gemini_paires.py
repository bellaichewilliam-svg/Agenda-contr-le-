"""Voix off de « Fidelite » avec Gemini (voix Sulafat), 2 phrases par demande (quota gratuit limité par jour).
python3 scripts/voix_gemini_paires.py <fichier_clé_fid_tts>
Chaque paire est lue avec une pause, coupée sur le plus grand silence ; chaque morceau est contrôlé (débit 9–20 caractères/s).
Les phrases déjà présentes dans public/fidelite-voix/gemini/ sont gardées. Ensuite : python3 scripts/fidelite_voix_mix.py
"""
import json, os, subprocess, sys, wave, time
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "public", "fidelite-voix"); G = os.path.join(D, "gemini")
key = open(sys.argv[1]).read().strip()
P = {"fr": "Dis ces deux phrases avec un ton chaleureux, souriant et naturel, comme une pub sympa, avec une vraie pause entre les deux :\n",
     "he": "תגיד את שני המשפטים האלה בטון חם, מחייך וטבעי, כמו פרסומת נעימה, עם הפסקה אמיתית ביניהם:\n"}
def tts(text, out):
    body = json.dumps({"key": key, "voice": "Sulafat", "model": "gemini-2.5-flash-preview-tts", "text": text})
    subprocess.run(["curl", "-s", "-o", out, "-X", "POST", "https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/fid-tts",
                    "-H", "Content-Type: application/json", "--data-binary", "@-"], input=body.encode(), check=True)
    w = wave.open(out); sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768; w.close()
    return sr, a
def save(x, sr, path):
    o = wave.open(path, "wb"); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((x * 32767).astype(np.int16).tobytes()); o.close()
lines = json.load(open(os.path.join(D, "lignes.json"), encoding="utf-8"))
todo = [l for l in lines if not os.path.exists(os.path.join(G, l["id"] + ".wav"))]
groups = []
for lang in ("fr", "he"):
    m = [l for l in todo if l["lang"] == lang]
    groups += [m[i:i + 2] for i in range(0, len(m), 2)]
for g in groups:
    lang = g[0]["lang"]; raw = os.path.join(G, "_paire.wav")
    try:
        sr, a = tts((P[lang] if len(g) == 2 else "") + "\n\n".join(l["text"] for l in g), raw)
    except Exception:
        print("ECHEC", [l["id"] for l in g], open(raw, "rb").read(160)); break
    hop = int(sr * 0.01)
    db = np.array([20 * np.log10(np.sqrt(np.mean(a[i:i + hop] ** 2)) + 1e-6) for i in range(0, len(a) - hop, hop)])
    on = db > -42; idx = np.where(on)[0]; first, last = idx[0], idx[-1]
    cuts = [(first, last)]
    if len(g) == 2:
        gaps, s = [], None
        for i in range(first, last + 1):
            if not on[i] and s is None: s = i
            if on[i] and s is not None: gaps.append((i - s, s, i)); s = None
        _, gs, ge = max(gaps)
        cuts = [(first, gs), (ge, last)]
    for l, (b, e) in zip(g, cuts):
        x = a[max(0, b * hop - int(sr * .04)): e * hop + int(sr * .12)]
        rate = len(l["text"]) / (len(x) / sr)
        ok = 9 <= rate <= 20
        save(x, sr, os.path.join(G, l["id"] + (".wav" if ok else ".douteux.wav")))
        print(l["id"], f"{len(x) / sr:.2f}s", f"{rate:.1f} car/s", "ok" if ok else "DOUTEUX", flush=True)
    time.sleep(21)
