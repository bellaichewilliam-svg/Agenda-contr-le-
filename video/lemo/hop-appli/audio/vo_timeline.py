"""Pose les phrases de la voix off sur l'horloge du film (début fixe de chaque phrase, même seconde en FR et en HE)
et écrit src/vo.js et <vo_dir>/timeline.json. Usage : python3 audio/vo_timeline.py [vo_fr|vo_he]."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VD = sys.argv[1] if len(sys.argv) > 1 else 'vo_fr'
L = json.load(open(os.path.join(ROOT, VD, 'lines.json'), encoding='utf-8')); D = json.load(open(os.path.join(ROOT, VD, 'dur.json')))
DUR, TITLE = 40.0, 37.9
out = []
for i, l in enumerate(L):
    t0 = l['start']; t1 = round(t0 + D[l['id']], 3)
    nxt = L[i + 1]['start'] if i + 1 < len(L) else DUR
    assert t1 < nxt - .15, f"{l['id']} déborde ({t1} > {nxt})"
    # première ligne = langue parlée, deuxième = traduction
    out.append({'id': l['id'], 't0': t0, 't1': t1, 'zh': l['sub'], 'en': l['he'] if VD == 'vo_fr' else l['fr']})
js = '// Voix off sur l\'horloge du film (écrit par audio/vo_timeline.py). t0/t1 = début/fin de la phrase.\n'
js += f'export const DUR = {DUR};\nexport const CREDIT_T = {TITLE};\nexport const VO = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
open(os.path.join(ROOT, 'src/vo.js'), 'w', encoding='utf-8').write(js)
json.dump({'dur': DUR, 'lines': out}, open(os.path.join(ROOT, VD, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
for o in out: print(o['id'], o['t0'], o['t1'], o['zh'])
