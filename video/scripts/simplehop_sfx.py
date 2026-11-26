"""Bruitages de la fin de « SimpleHop » (clip Gemini du patron + carton « C'est aussi simple que ça avec HOP! »).
python3 scripts/simplehop_sfx.py -> public/simplehop-sfx.wav (13,5 s ; le son du clip reste dans la vidéo, celui-ci s'ajoute).
Souffle sur l'ouverture du rond bleu nuit (image 282), impact quand le logo tombe (image 306), scintillement sur le « ! », accord doux.
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fidelite_music import whoosh, impact, sparkle, pad, flt, fftconvolve, IR_L, IR_R, save, SR, ROOT

DUR = 13.5
L = np.zeros(int(SR * DUR)); R = np.zeros_like(L)
def put(x, frame, g=1.0, pan=0.0):
    s = int(frame / 30 * SR); x = x[: len(L) - s]
    L[s:s + len(x)] += x * g * (1 - max(0, pan)); R[s:s + len(x)] += x * g * (1 + min(0, pan))
put(whoosh(0.6), 280, 0.9)
put(impact(1.6), 306, 0.85)
put(sparkle(1.3), 318, 0.6, 0.3)
put(sparkle(1.0, base=3400, seed=7), 352, 0.35, -0.3)
put(pad([60, 64, 67, 71], 3.4), 300, 4.0)         # Do maj7, doux
put(pad([48, 55], 3.4), 300, 3.0)
wetL = fftconvolve(L, IR_L)[: len(L)]; wetR = fftconvolve(R, IR_R)[: len(R)]
mix = np.stack([L + wetL * 0.8, R + wetR * 0.8])
t = np.arange(len(L)) / SR
mix *= np.clip((DUR - t) / 0.8, 0, 1)
mix = mix / (np.abs(mix).max() + 1e-9) * 0.85
save(mix, os.path.join(ROOT, "public", "simplehop-sfx.wav"))
print("ok")
