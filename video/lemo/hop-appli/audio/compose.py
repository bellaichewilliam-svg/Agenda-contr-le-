"""Musique du film HOP! (40 s, 120 BPM, ré majeur, une mesure = 2 s). Lit léger sous la voix (basse pincée, kick doux, shaker,
nappe de cordes, petite figure de marimba) ; le thème complet au marimba seulement dans les respirations sans voix
(6–8,6 s et 15,7–18,2 s) et sur la fin. Accents sur les grands moments : pop du sac 4,0 s, « Tout ici » 14,0 s, « Livré » 36,0 s, titre 38,3 s.
Lancer depuis la bibliothèque :  LIB=… $LIB/.venv/bin/python -I audio/compose.py"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..')); LIB = os.environ['LIB']
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, add, t_, env_exp

S.seed(11)
DUR = json.load(open(os.path.join(ROOT, 'vo_fr/timeline.json')))['dur']; FIN = 38.3
BAR = 2.0; BEAT = .5
CH = ['D', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'G', 'D', 'G', 'Em', 'A', 'Bm', 'G', 'A', 'D']
PAD = {'D': ['A3', 'D4', 'F#4'], 'G': ['G3', 'B3', 'D4'], 'A': ['A3', 'C#4', 'E4'], 'Bm': ['B3', 'D4', 'F#4'], 'Em': ['G3', 'B3', 'E4']}
ROOT_ = {'D': 'D2', 'G': 'G2', 'A': 'A2', 'Bm': 'B2', 'Em': 'E2'}
HEAD = [(0, 'F#5', 1), (1, 'A5', .5), (1.5, 'B5', .5), (2, 'D6', 1.5), (3.5, 'C#6', .5)]
MEL = {3: HEAD, 8: [(0, 'B5', 1), (1, 'D6', .5), (1.5, 'B5', .5), (2, 'G5', 2)], 19: [(0, 'D6', 3)]}
ev = []
def E(t, inst, p, d, v, pan=0., **kw): ev.append(dict(t=t, inst=inst, pitch=p, dur=d, vel=v, pan=pan, **kw))
for b, ch in enumerate(CH):
    t0 = b * BAR
    for i, p in enumerate(PAD[ch]): E(t0, 'violas' if i else 'cellos', p, BAR + .1, .22, [-.3, 0, .3][i], attack=.35, release=.6)
    if b in MEL:
        for (bt, n, d) in MEL[b]: E(t0 + bt * BEAT, 'marimba', n, max(.18, d * BEAT), .74, .05); (d >= 1.5) and E(t0 + bt * BEAT, 'vibraphone', n, d * BEAT, .3, -.1)
    elif b > 0:
        tones = sorted(S.midi(p) + 12 for p in PAD[ch])
        E(t0, 'marimba', S.name(tones[2]), .4, .4, .1); E(t0 + 2 * BEAT, 'marimba', S.name(tones[1]), .4, .34, .1)
    rt = ROOT_[ch]
    if 1 <= b < 19:
        E(t0, 'contrabass_pizz', rt, .45, .72, 0); E(t0 + 2 * BEAT, 'contrabass_pizz', rt, .4, .56, 0)
        for k in range(8): E(t0 + k * BEAT / 2, 'shaker', 'down' if k % 2 == 0 else 'up', None, .16 + (.06 if k % 2 == 0 else 0), .35)
    if b in (3, 8, 13, 14):
        for k in (1, 3): E(t0 + k * BEAT, 'claps', 'solo', None, .32, -.2)
def chordhit(t, ch, v=.5):
    for p in PAD[ch]: E(t, 'violins_pizz', S.name(S.midi(p) + 12), .3, v, .2)
E(.4, 'glockenspiel', 'D6', 1.0, .35, .2)
E(4.0, 'glockenspiel', 'A6', .8, .32, .2); chordhit(4.0, 'D', .35)
E(14.0, 'timpani', 'D2', 1.2, .55, 0); E(14.0, 'cellos_pizz', 'D3', .4, .55); chordhit(14.0, 'D', .4)
E(18.4, 'glockenspiel', 'A5', .6, .26, .2); E(18.9, 'glockenspiel', 'B5', .6, .26, .2); E(19.4, 'glockenspiel', 'D6', .8, .3, .2)
E(36.0, 'glockenspiel', 'F#6', 1.0, .36, .2); chordhit(36.0, 'D', .4)
E(FIN, 'timpani', 'D2', 1.6, .45); E(FIN, 'sus_cymbal', 'hit', None, .22)
for p in ['D4', 'F#4', 'A4', 'D5']: E(FIN, 'vibraphone', p, DUR - FIN - .3, .28, 0)
for p in ['D3', 'A3']: E(FIN, 'horn', p, DUR - FIN - .3, .26, 0, attack=.2, release=.4)
E(FIN, 'contrabass', 'D2', DUR - FIN - .3, .36, 0, attack=.15, release=.4)
mus = S.render(ev, dur=DUR)
def kick(v):
    d = .22; tt = t_(d); f = 62 + 70 * np.exp(-tt / .03)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .07) * v).astype(np.float32)
for b in range(1, 19):
    for k in (0, 2): add(mus, kick(.34 if k == 0 else .24), b * BAR + k * BEAT, 1, 0)
for t in (4.0, 14.0, 36.0, FIN): add(mus, kick(.5), t, 1, 0)
mus = S.room(mus, size=.32, mix=.12)
fade = int(.5 * SR); mus[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
mus *= .5 / max(1e-9, np.abs(mus).max())
os.makedirs(os.path.join(ROOT, 'music'), exist_ok=True)
sf.write(os.path.join(ROOT, 'music/score.wav'), mus[:int(DUR * SR)], SR, subtype='PCM_24')
har = [{'bar': b, 't0': b * BAR, 'chord': ch, 'notes': [S.midi(p) for p in PAD[ch]], 'root': S.midi(ROOT_[ch])} for b, ch in enumerate(CH)]
json.dump(har, open(os.path.join(ROOT, 'music/harmony.json'), 'w'))
print('score', mus.shape, 'peak', float(np.abs(mus).max()))
print(S.credits(sorted({e['inst'] for e in ev})))
