"""Voix off de « Fidelite » avec Gemini (voix Sulafat) en UNE demande par langue (la version gratuite limite le nombre de demandes par jour).
python3 scripts/voix_gemini_lot.py <fichier_clé_fid_tts> [fr|he]
Toutes les phrases d'une langue sont lues d'affilée, séparées par de longues pauses, puis découpées sur les silences
-> public/fidelite-voix/gemini/<id>.wav (les phrases déjà faites sont gardées). Ensuite : python3 scripts/fidelite_voix_mix.py
"""
import json, os, subprocess, sys, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "public", "fidelite-voix")
key = open(sys.argv[1]).read().strip()
langs = sys.argv[2:] or ["fr", "he"]
P = {"fr": "Lis ces phrases avec un ton chaleureux, souriant et naturel, comme une pub sympa. Fais une longue pause de deux secondes entre chaque phrase :\n",
     "he": "קרא את המשפטים האלה בטון חם, מחייך וטבעי, כמו פרסומת נעימה. עשה הפסקה ארוכה של שתי שניות בין כל משפט:\n"}
lines = json.load(open(os.path.join(D, "lignes.json"), encoding="utf-8"))
os.makedirs(os.path.join(D, "gemini"), exist_ok=True)
for lang in langs:
    mine = [l for l in lines if l["lang"] == lang]
    raw = os.path.join(D, "gemini", f"_lot-{lang}.wav")
    body = json.dumps({"key": key, "voice": "Sulafat", "model": "gemini-2.5-flash-preview-tts", "text": P[lang] + "\n\n".join(l["text"] for l in mine)})
    subprocess.run(["curl", "-s", "-o", raw, "-X", "POST", "https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/fid-tts",
                    "-H", "Content-Type: application/json", "--data-binary", "@-"], input=body.encode(), check=True)
    try:
        w = wave.open(raw); sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768; w.close()
    except Exception:
        print(lang, "ECHEC", open(raw, "rb").read(200)); continue
    # Découpe : morceaux de son séparés par des silences ; on fusionne les petits trous jusqu'à avoir autant de morceaux que de phrases
    hop = int(sr * 0.02); env = np.array([np.abs(a[i:i + hop]).max() for i in range(0, len(a), hop)])
    on = env > 0.02
    segs, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None: segs.append([s, i]); s = None
    if s is not None: segs.append([s, len(on)])
    while len(segs) > len(mine):
        gaps = [segs[k + 1][0] - segs[k][1] for k in range(len(segs) - 1)]
        k = int(np.argmin(gaps)); segs[k][1] = segs[k + 1][1]; del segs[k + 1]
    print(lang, f"{len(a) / sr:.1f}s", len(segs), "morceaux pour", len(mine), "phrases")
    if len(segs) != len(mine):
        print("  découpe incertaine : vérifier à l'oreille"); continue
    for l, (b, e) in zip(mine, segs):
        x = a[max(0, b * hop - int(sr * 0.05)): min(len(a), e * hop + int(sr * 0.12))]
        with wave.open(os.path.join(D, "gemini", l["id"] + ".wav"), "wb") as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((x * 32767).astype(np.int16).tobytes())
        print(" ", l["id"], f"{len(x) / sr:.2f}s")
