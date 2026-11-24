"""Voix off avec Chatterbox (Resemble AI, MIT, gratuit, hors ligne une fois le modèle téléchargé) : français et hébreu.
Usage : /root/cbx/bin/python scripts/voix_chatterbox.py lignes.json dossier_sortie [voix_reference.wav]
lignes.json = [{"id": "v01", "text": "...", "lang": "fr"}, ...]  ->  dossier_sortie/v01.wav ...
Avec une voix de référence (10 s d'une vraie personne, avec son accord), la voix est clonée sur elle."""
import json, os, sys
import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

torch.set_num_threads(os.cpu_count() or 4)
lines = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; ref = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
for l in lines:
    wav = model.generate(l['text'], language_id=l['lang'], audio_prompt_path=ref,
                         exaggeration=l.get('exaggeration', 0.6), cfg_weight=l.get('cfg', 0.4), temperature=0.8)
    p = os.path.join(out, l['id'] + '.wav'); ta.save(p, wav, model.sr)
    print(p, round(wav.shape[-1] / model.sr, 2), 's', flush=True)
