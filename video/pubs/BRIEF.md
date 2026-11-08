# HOP! — Pubs vidéo : brief de reprise pour Claude Code

> Notes du 08/11/2026 : la mascotte s'appelle **Hoppy (הופי)** (image officielle `livraison/kit/visuels/hoppy-officiel.png`, voir `video/HOPPY.md`), et les couleurs officielles sont le bleu nuit `#0F1F3D` et l'orange `#FF6A13` (déjà mises dans `render.py`). Les nouvelles idées de pubs sont dans `video/PUBS-VIDEO.md`.

> Document de passation, écrit le 08/11/2026 depuis une conversation Claude (chat).
> But : que Claude Code puisse **reprendre, régénérer et décliner** les pubs vidéo HOP! sans redemander le contexte.
> Fichiers livrés avec ce document : `render.py` (montage + textes animés) et `sfx.py` (bruitages).

---

## 1. Contexte

- **HOP!** = service de livraison de Willy à **Netanya** (pizzas aujourd'hui, catalogue McDonald's Kanyon HaSharon dans l'appli de commande).
- Mascotte : **Hopi**, un kangourou livreur en 3D style dessin animé (fourrure orange chaud, sac à dos isotherme bleu marine avec liseré orange et logo HOP!).
- Cible : habitants de Netanya, **francophones et hébréophones**, donc tous les textes sont **bilingues FR + hébreu**.
- Exigence de Willy : « que ça fasse hyper pro », **la marque doit se voir** (boîtes, sac, logo), jamais de logo coupé.

---

## 2. Charte HOP!

| Élément | Valeur |
|---|---|
| Bleu marine (fond, badges) | `#0E1B4D` → dégradé vers `#182C78` |
| Orange (prix, « ! », accents) | `#FF7A00` |
| Bleu ciel (lignes en hébreu) | `#8CCDFF` |
| Blanc | `#FFFFFF` |
| Police | **Rubik** (Google Fonts), graisse 900 pour les titres, 600-800 pour le reste. Couvre le latin, l'hébreu et le signe ₪ |
| Logo | Texte « HOP » blanc + « ! » orange, dans une pilule bleu marine aux bords arrondis, liseré blanc |
| Motifs | Rayons de lumière qui tournent en fond, petits traits orange qui « clignotent » autour du logo (repris de l'affiche) |

**Textes validés (hébreu vérifié, sens RTL correct) :**

| FR | Hébreu |
|---|---|
| IL PLEUT ? | יורד גשם? |
| ON LIVRE QUAND MÊME ! | מגיעים בכל מזג אוויר! |
| À PARTIR DE 25 ₪ | משלוחים החל מ-25 ₪ |
| Livraison à Netanya | משלוחים עד הבית בנתניה |
| Vos pizzas livrées chaudes à Netanya | הפיצות האהובות עליכם, חמות עד הבית בנתניה! |

---

## 3. La méthode (règle tranchée, ne pas y revenir)

**L'IA vidéo ne fait QUE l'image. Les textes se posent toujours au montage.**

1. Générer l'image ou la vidéo **sans aucun texte** (Gemini / Veo).
2. Animer à **caméra fixe** (un zoom coupe le logo du haut).
3. Ajouter les textes animés, le logo et les bruitages **en post-production** : `render.py`, ou CapCut à défaut.

### Leçons apprises (erreurs déjà faites, à ne pas refaire)

- **Veo (Gemini / Flow) = 8 s maximum.** Tout ce qui est prévu après 8 s est coupé (le kangourou avait disparu à cause de ça).
- **Une image jointe dans Veo devient la PREMIÈRE image de la vidéo**, pas la fin. Pour une fin sur l'affiche, il faut une génération séparée.
- **Veo efface ou déforme le texte**, surtout l'hébreu. On ne lui demande jamais d'animer un texte.
- **Hopi ne doit jamais marcher ni sauter sur une pizza** (Willy : « pas très élégant »). Dans les prompts : *feet never touch any food, no jumping*.
- **Le logo HOP! doit être bien visible** : boîtes au premier plan face caméra, sac de livraison, sac à dos de Hopi.
- Prévoir des **marges de sécurité** pour Reels et TikTok : rien d'important dans les ~250 px du bas, à cause de la légende.

---

## 4. Livrable déjà produit

**`HOP_pub_pluie_9x16.mp4`** : 1080×1920, 24 i/s, 10 s, H.264 + AAC.

- Source : vidéo Veo 16:9 « Kangaroo delivering pizza in rain » (Hopi trempé à une porte, pizza fumante).
- Montage : recadrage carré centré sur Hopi (`crop=1080:1080:420:0`), fondu en haut et en bas dans le fond bleu marine, léger zoom de 4 %.

| Temps | Animation |
|---|---|
| 0,1 s | Petit logo HOP! (rebond) |
| 0,35 → 2,5 s | « IL PLEUT ? » (pop) + « יורד גשם? » (glisse depuis la droite) |
| 2,8 → 7,4 s | « ON LIVRE » blanc + « QUAND MÊME ! » orange + ligne en hébreu |
| 4,0 s | Badge orange « À PARTIR DE 25 ₪ », qui monte puis pulse en boucle |
| 4,6 / 5,5 s | Ligne prix en hébreu, puis sous-titre FR |
| 7,4 s | Tous les textes sortent |
| 7,55 → 10 s | **Plan de fin** : vidéo figée, floutée et assombrie, gros logo HOP! avec traits orange, prix, « Livraison à Netanya » FR + HE |

**Son :** pluie d'origine (prolongée par fondu enchaîné jusqu'à 10 s), plus des bruitages générés en Python : « whoosh » à chaque entrée, « pop », « ding » sur le prix, impact et carillon à 4 notes sur le logo final. Aucune musique sous licence.

---

## 5. Régénérer / décliner

### Prérequis
```bash
pip install pillow numpy fonttools   # Pillow doit avoir libraqm (bidi hébreu) : python -c "from PIL import features; print(features.check('raqm'))"
# ffmpeg dans le PATH
mkdir -p fonts && curl -L -o "fonts/Rubik[wght].ttf" "https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf"
```

### Commandes
```bash
cp <video_veo>.mp4 src.mp4
python render.py        # -> video_only.mp4 (image seule, 10 s)
python sfx.py           # -> sfx.wav
ffmpeg -y -i src.mp4 -i sfx.wav -i video_only.mp4 -filter_complex "\
[0:a]atrim=0:7.9,asetpts=PTS-STARTPTS,aresample=48000[a0];\
[0:a]atrim=1:4.5,asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st=1.6:d=1.8[a1];\
[a0][a1]acrossfade=d=0.4[amb];[amb]volume=1.3[ambv];[1:a]aresample=48000[s];\
[ambv][s]amix=inputs=2:normalize=0:duration=longest,atrim=0:10,alimiter=limit=0.9,aformat=channel_layouts=stereo[aout]" \
-map 2:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -movflags +faststart HOP_pub_9x16.mp4
```

### Ce qu'on modifie pour une nouvelle pub
- **Textes** : dictionnaire `S[...]` dans `render.py` (sprites FR via `text_sprite`, hébreu avec `rtl=True`).
- **Rythme** : les temps d'entrée sont dans la boucle (`(t - 0.35) / 0.5`, etc.). Garder **0,5 à 0,8 s d'écart** entre deux textes.
- **Recadrage** : le filtre `crop=1080:1080:420:0` dépend de la position du sujet dans la vidéo source. À vérifier sur chaque nouvelle vidéo (extraire 5 images avec ffmpeg et regarder).
- **Durée de la source** : `SRC_DUR` et le début du plan de fin (`7.55`) se calent sur la durée de la vidéo Veo, qui fait 8 s.
- **Bruitages** : les appels `add(...)` de `sfx.py` se calent sur les mêmes temps que les textes.

### Contrôle obligatoire avant de dire « c'est prêt »
1. Extraire une image à 1 s, 3,8 s, 5 s, 6,5 s et 9,5 s, puis les regarder en planche.
2. Zoomer sur chaque ligne en hébreu : la ponctuation doit être **à gauche**, et les mots dans le bon ordre.
3. Vérifier qu'aucun texte ne se chevauche et que le logo du haut est entier.
4. Contrôler le volume : `volumedetect`, avec un max autour de −3 dB.

---

## 6. Concepts suivants (prompts prêts, image SANS texte)

Le n°3 est **déjà produit** (la pub pluie). Ordre conseillé ensuite : **n°1**, puis **n°2**.

**1. Le duel du fromage**
```
Vertical 9:16, premium food advertising. Extreme close-up of a single four-cheese pizza slice being pulled apart: on the left a human hand, on the right the paw of a cartoon-style 3D kangaroo with warm-orange fur and a navy-blue HOP! delivery backpack. A huge glossy melted-cheese stretch spans the center of the frame. Dramatic warm backlight, steam, dark navy background with soft orange rim light, shallow depth of field. Clean empty space in the top third and bottom fifth. No text.
```
Veo : `Locked static camera. The cheese stretches longer and longer in slow motion, both sides pull playfully, steam rises, the kangaroo grins. No text.`
Textes : « QUI VA GAGNER ? » → « À PARTIR DE 25 ₪ » → logo.

**2. Hopi au-dessus de Netanya**
```
Vertical 9:16, epic cinematic shot. A cartoon-style 3D kangaroo with warm-orange fur and a navy-blue HOP! delivery backpack leaps high through the air, holding a steaming pizza box, silhouetted against a blazing orange sunset over the Netanya cliffs and the Mediterranean sea. Low angle, golden hour, lens flare, saturated colors. Clean sky space in the top third, clean sea space at the bottom. No text.
```
Veo : `Locked static camera. The kangaroo glides through the air in slow motion, tail and ears flowing, sunlight flickers, waves sparkle below. No text.`

**4. L'ouverture ASMR**, vue de dessus
```
Vertical 9:16, top-down overhead shot, premium food commercial. A kraft pizza box with a navy-blue and orange HOP! logo on the lid sits slightly open on a dark wooden table, golden light and thick steam escaping from the gap. Dramatic single spotlight, deep shadows, rich warm colors. Clean dark space in top and bottom. No text.
```
Veo : `Locked static overhead camera. The lid slowly opens by itself, a burst of steam rises into the light, revealing a bubbling margherita with fresh basil and glistening cheese. No text.`

**5. Il pleut des pizzas** (parachutes orange sur la plage de Netanya, Hopi qui en attrape une)
```
Vertical 9:16, playful cinematic shot. Dozens of kraft pizza boxes floating down from a bright blue sky under small orange parachutes, over a sunny Netanya beach. In the foreground, a cartoon-style 3D kangaroo with warm-orange fur and a navy-blue HOP! backpack jumps up joyfully to catch one. Saturated colors, sunlight. Clean sky space at top. No text.
```

---

## 7. Règles de travail avec Willy (rappel)

- Il écrit en **français** ; il veut des réponses **directes**, en Markdown structuré, avec **une seule prochaine étape** à la fin.
- **Toute question passe par le widget de question** (choix cliquables), jamais une ligne glissée en fin de texte.
- **Tout tester avant de dire « prêt »** : il ne doit jamais découvrir un défaut lui-même.
- Ne pas re-proposer des angles déjà produits : un nouveau lot = **de nouveaux angles**.

---

## 8. Montage automatique (08/11/2026)

`python3 video/pubs/monter.py <id> <video_veo.mp4>` : textes de `video/pubs/pubs.json`, sortie des deux versions (FR et HE) dans `livraison/kit/visuels/<id>-video-<fr|he>.mp4`, ajout dans l'onglet Vidéos du kit (`kit.js`), planche de contrôle dans `video/out/pubs/`. Vidéo Veo verticale : plein écran avec voile bleu nuit en haut et en bas ; horizontale : bande carrée (`--x` pour recadrer). `--test` : essai sans toucher au kit. Les idées : `video/PUBS-VIDEO.md`.
