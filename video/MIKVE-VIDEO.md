# Vidéo « Votre vaisselle au mikvé, sans bouger » (patron, 18/11)
**L'idée :** vaisselle neuve (casseroles, verres, couverts…) : il faut la tremper au mikvé de kelim avant de s'en servir (tevilat kelim). Pas le temps d'y aller ? HOP! vient la chercher chez vous, la trempe au mikvé de kelim le plus proche et vous la ramène.
**Le slogan :** « HOP! votre vaisselle au mikvé, et retour » / « הופ! הכלים לטבילה, וחזרה ».
**Le prix (dans l'appli) :** 85 ₪ tout compris (aller-retour 35 ₪ + service 50 ₪). Le client donne seulement son adresse : carré « Vaisselle au mikvé » sur l'accueil.
**Format :** 9:16, environ 10 s, plans rapides comme les autres vidéos. Une version FR et une version HE (les textes sont ajoutés au montage).

Comme d'habitude :
1. Tu crées les 6 images dans Gemini (ou ChatGPT), **une image par message**.
2. Tu m'envoies les images pour que je vérifie.
3. Tu lances le prompt vidéo Gemini (Veo) avec les 6 images, dans l'ordre.
4. Je fais le montage : textes FR/HE, prix, logo HOP!, Hoppy à la fin, musique.

## Règles importantes (mitsva, à montrer avec respect)
- La vaisselle est **neuve**, propre, **sans étiquette ni autocollant** (on les enlève avant la tevila).
- Au mikvé, **chaque objet est trempé entièrement** dans l'eau (dans un panier en filet ou tenu à la main), jamais jeté, jamais en vrac.
- **Le trempage est fait par une main humaine** (manche du t-shirt bleu nuit du livreur HOP!), pas par Hoppy. Hoppy transporte seulement le carton, avec soin.
- Le mikvé de kelim : un petit bassin en pierre claire avec quelques marches, eau limpide, endroit propre et calme. **Aucune inscription, aucune plaque lisible** (les IA inventent de fausses lettres hébraïques).
- Pas de prix ni de texte dans les images. Pas de geste de la main ambigu.

**À joindre :** `hoppy-officiel.png` (ou `video/ia/fiche-hoppy.jpg`) pour Hoppy, `video/ia/fiche-client.jpg` pour la cliente / le client, `sac-000.png` pour le sac.

**À coller à la fin de chaque prompt d'image :**
```
Photorealistic cinematic commercial still, 9:16 vertical, warm natural light, sharp details, Israeli apartment in Netanya. The kangaroo mascot is exactly the character from the attached reference image (same face, fur, colors), Pixar-quality 3D in a real photographic world, no hand gestures. The delivery bag is always exactly the navy blue insulated bag from the reference image, with the white "HOP!" and orange "!". All dishes are brand new, clean, with no labels or stickers. No readable writing anywhere, no signs, no text, no prices, no watermark.
```

---

## Image 1 : « Nouvelle vaisselle, il faut la tremper »
**Joindre :** `fiche-client.jpg`
```
In a bright modern kitchen in Netanya, the person from the reference image happily unpacks brand new dishes from cardboard boxes on the counter: a shiny stainless steel pot, a frying pan, glass cups, a set of cutlery, white plates. Some packaging and tissue paper around. Warm morning light, joyful "new home" mood.
```
**Animation :** elle sort une casserole neuve du carton et la regarde, contente. Caméra : léger rapprochement.

## Image 2 : Hoppy vient chercher le carton
**Joindre :** `hoppy-officiel.png` + `fiche-client.jpg` + `sac-000.png`
```
At the apartment door, the person from the reference image hands a neat closed cardboard box full of new dishes (a pot handle and glasses visible on top, wrapped in tissue paper) to the kangaroo mascot from the other reference image. The kangaroo holds the box carefully with both paws, the navy HOP! delivery bag on its back. Warm light, friendly and careful mood.
```
**Animation :** Hoppy prend le carton avec soin et repart d'un petit bond. Caméra : fixe.

## Image 3 : en route vers le mikvé
**Joindre :** `hoppy-officiel.png` + `sac-000.png`
```
The kangaroo mascot from the reference image rides a small delivery scooter through a sunny Netanya street lined with palm trees and white buildings, the cardboard box of dishes well strapped behind it next to the navy HOP! bag. Dynamic motion, joyful but careful.
```
**Animation :** le scooter passe vite, les palmiers défilent. Caméra : travelling latéral.

## Image 4 : le trempage au mikvé de kelim
**Joindre :** rien (pas de personnage de référence)
```
A small outdoor mikveh for dishes in Israel: a clean pale Jerusalem-stone basin with a few steps leading down into crystal-clear water, plants around, soft sunlight. A man's hands and forearms (navy blue t-shirt sleeves) fully immerse a shiny new stainless steel pot in the water, the pot completely under the water; next to the basin, a tidy row of new glasses and a mesh basket with cutlery waiting their turn. Calm, respectful, clean atmosphere, sparkling water, no signs, no writing.
```
**Animation :** les mains plongent la casserole entièrement dans l'eau, puis la ressortent qui brille, des gouttes tombent. Caméra : lent rapprochement.

## Image 5 : Hoppy rapporte la vaisselle
**Joindre :** `hoppy-officiel.png` + `fiche-client.jpg` + `sac-000.png`
```
At the apartment door in the late afternoon, the kangaroo mascot from the reference image hands the cardboard box of dishes back to the smiling person from the other reference image; the dishes on top sparkle, perfectly clean. The navy HOP! bag on the kangaroo's back. Warm golden light, happy mood.
```
**Animation :** Hoppy tend le carton, la personne sourit et le prend. Caméra : fixe.

## Image 6 : la table est prête
**Joindre :** `fiche-client.jpg`
```
In the same bright kitchen, the person from the reference image places the shiny new pot on the stove and sets a beautiful table with the new white plates, glasses and cutlery, a family meal about to start. Warm golden light, peaceful and festive home atmosphere.
```
**Animation :** elle pose la casserole sur le feu et met la table, sourire. Caméra : léger recul, fin sur la table dressée.

---

## 🎬 Prompt vidéo Gemini (Veo), à coller avec les 6 images dans l'ordre
```
Vertical 9:16 video, 10 seconds, one warm and fast-paced commercial using the attached images in order, keeping every character, object and logo exactly the same.
1. In a bright kitchen, the person happily unpacks brand new dishes from cardboard boxes.
2. At the door, they hand the box of dishes to the kangaroo mascot, who holds it carefully.
3. The kangaroo rides the delivery scooter through a sunny Netanya street with palm trees, the box strapped behind.
4. At a clean stone mikveh for dishes, a man's hands fully immerse a new pot in crystal-clear water and lift it out sparkling.
5. Back at the door, the kangaroo hands the box of sparkling dishes back to the smiling person.
6. In the kitchen, the person puts the new pot on the stove and sets a beautiful table.
Cinematic, warm light, Pixar-style 3D kangaroo in a real photorealistic world, respectful mood at the mikveh, clean sparkling water, no readable writing or signs. Gentle upbeat music, soft water and sparkle sound effects, no voices, no subtitles, no added text.
```
**Si Gemini la refait en horizontal :** pas de souci, je fais la version verticale au montage.
**Si une image a un défaut** (fausses lettres, panneau, Hoppy différent, logo HOP! raté, objet pas entièrement dans l'eau) : refais seulement cette image, ou envoie-la-moi.

---

### Textes au montage (c'est moi qui les ajoute)
| Moment | FR | HE |
|---|---|---|
| Plan 1 | « Nouvelle vaisselle ? » | « כלים חדשים? » |
| Plan 2 | « HOP! vient la chercher » | « הופ! בא לאסוף » |
| Plan 4 | « Trempée au mikvé de kelim » | « טבילה במקוות כלים » |
| Plan 5 | « … et vous la ramène » | « …ומחזיר אליכם » |
| Plan 6 | « Sans bouger de chez vous » | « בלי לצאת מהבית » |
| Fin | « 85 ₪ tout compris · commandez sur l'appli » + logo HOP! + Hoppy | « 85 ₪ הכול כלול · מזמינים באפליקציה » + logo HOP! + Hoppy |

---

## 📱 Visuel réseaux (Instagram / TikTok / Facebook), style officiel
Avec le prompt de `HOPPY.md` (« Visuels pour les réseaux », joindre `hoppy-officiel.png` ET `reseaux/hoppy-fleurs-original.png`), remplir ainsi :
| [LIGNE 1] / [LIGNE 2] | [HÉBREU] | [ACTION] | [PHRASE FRANÇAISE] / [PHRASE HÉBREU] |
|---|---|---|---|
| VOTRE VAISSELLE / AU MIKVÉ | טבילת כלים בלי לצאת מהבית | holding with both paws a shiny new stainless steel pot with sparkling water droplets, a few new glasses and a ladle peeking out of the navy HOP! bag in its pouch (brand new, no labels) | On la trempe pour vous, aller-retour : 85 ₪ tout compris. / מטבילים בשבילכם, הלוך ושוב: 85 ₪ הכול כלול. |

Le prompt déjà rempli, prêt à copier :
```
Create a new Instagram post, vertical 4:5 (1080x1350), in EXACTLY the same style and layout as the second attached image (the HOP! "flowers" ad), with EXACTLY the same character as the first attached image (Hoppy the kangaroo: same face, fur, navy backpack straps, navy "HOP!" bag in its pouch with "HOP" in white and "!" in orange).
- Bright sky-blue gradient background with soft light and white speed lines behind Hoppy.
- Top title, big bold rounded uppercase letters, line 1 in white: "VOTRE VAISSELLE", line 2 in bright orange: "AU MIKVÉ", small orange burst strokes on both sides.
- Under it, in bold white Hebrew letters: "טבילת כלים בלי לצאת מהבית".
- Center: Hoppy jumping happily, holding with both paws a shiny new stainless steel pot with sparkling water droplets, a few new glasses and a ladle peeking out of the navy HOP! bag in its pouch (brand new, no labels).
- Bottom right: navy rounded pill with the HOP! logo (white "HOP", orange "!").
- Bottom: navy band with rounded top corners, white text "On la trempe pour vous, aller-retour : 85 ₪ tout compris." and below it in orange Hebrew "מטבילים בשבילכם, הלוך ושוב: 85 ₪ הכול כלול."
Spell every text exactly as written, letter by letter.
```
**Version hébreu seule (pour les groupes israéliens) :** même prompt, titre ligne 1 « הכלים החדשים », ligne 2 « לטבילה במקווה », hébreu dessous « אנחנו מביאים ומחזירים », bandeau « 85 ₪ הכול כלול · מזמינים באפליקציה ».

**À savoir :** sur l'appli, c'est le carré « Vaisselle au mikvé » (2e carré de « Ce qu'on livre »). Le client donne seulement son adresse ; le livreur va au mikvé de kelim le plus proche, trempe chaque objet et ramène tout. Conseil à donner aux clients : enlever les étiquettes et autocollants avant.
