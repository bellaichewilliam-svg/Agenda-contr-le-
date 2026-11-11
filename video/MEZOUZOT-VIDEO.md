# Vidéo « Vos mezouzot vérifiées, sans bouger » (patron, 11/11)
**L'idée :** les mezouzot de la maison doivent être vérifiées par un sofer. Pas le temps d'y aller ? HOP! vient les chercher chez vous, les apporte au sofer, puis vous les rapporte. Un aller-retour, et vous ne bougez pas de chez vous.
**Le slogan :** « HOP! vos mezouzot chez le sofer, et retour » / « הופ! המזוזות אצל הסופר, וחזרה ».
**Format :** 9:16, environ 10 s, plans rapides comme la vidéo des promos. Une version FR et une version HE (les textes sont ajoutés au montage).

On fait comme hier :
1. On crée les 6 images dans Gemini, **une image par message**.
2. Tu m'envoies les images pour que je vérifie.
3. Tu lances le prompt vidéo Gemini (Veo) avec les 6 images, dans l'ordre.
4. Je fais le montage : textes FR/HE, logo HOP!, musique.

## Règles importantes (objet saint)
- Les mezouzot sont toujours **dans leur boîtier**, ou enveloppées dans un **petit étui en tissu propre**, dans une **boîte en bois**. Jamais par terre, jamais jetées, jamais en vrac dans le sac.
- **Le parchemin (klaf) n'apparaît que chez le sofer**, roulé ou vu de loin, **sans écriture lisible**. Les IA inventent de fausses lettres hébraïques : sur un texte saint, il ne faut pas.
- **Hoppy ne touche jamais le parchemin** : il transporte seulement la boîte fermée, avec respect. Pas de geste de la main.
- Le sofer : un homme religieux, kippa, barbe, chemise blanche, gestes calmes et sérieux. Rien de comique sur lui.
- Pas de prix ni de texte dans les images.

**À joindre :** `hoppy-officiel.png` (ou `video/ia/fiche-hoppy.jpg`) pour Hoppy, `video/ia/fiche-client.jpg` pour le client, `sac-000.png` pour le sac.

**À coller à la fin de chaque prompt d'image :**
```
Photorealistic cinematic commercial still, 9:16 vertical, warm natural light, sharp details, Israeli apartment building in Netanya. The kangaroo mascot is exactly the character from the attached reference image (same face, fur, colors), Pixar-quality 3D in a real photographic world, no hand gestures. The delivery bag is always exactly the navy blue insulated bag from the reference image, with the white "HOP!" and orange "!". No readable writing on any parchment, no text, no prices, no watermark.
```

---

## Image 1 : « Il faut faire vérifier les mezouzot »
**Joindre :** `fiche-client.jpg`
```
The young man from the reference image stands at the front door of his Netanya apartment and gently removes a mezuzah case from the doorpost with both hands, respectfully. Next to him on a small table: an open wooden box lined with white cloth, with two other mezuzah cases already placed inside. Soft morning light, calm and respectful mood.
```
**Animation :** il détache délicatement le boîtier et le pose dans la boîte. Caméra : léger rapprochement.

## Image 2 : Hoppy vient chercher la boîte
**Joindre :** `hoppy-officiel.png` + `fiche-client.jpg` + `sac-000.png`
```
At the apartment door, the young man from the reference image hands a closed wooden box, wrapped in a white cloth, to the kangaroo mascot from the other reference image. The kangaroo holds the box carefully with both paws, like something precious, next to the open navy HOP! delivery bag. Warm light, respectful and friendly mood.
```
**Animation :** Hoppy prend la boîte avec soin et la pose bien droite dans le sac. Caméra : fixe.

## Image 3 : en route vers le sofer
**Joindre :** `hoppy-officiel.png` + `sac-000.png`
```
The kangaroo mascot from the reference image rides a small delivery scooter through a sunny Netanya street lined with palm trees and white buildings, the navy HOP! bag closed and well attached on the back. Dynamic motion, joyful but careful.
```
**Animation :** le scooter passe vite, les palmiers défilent. Caméra : travelling latéral.

## Image 4 : chez le sofer
**Joindre :** rien (pas de personnage de référence)
```
Inside a quiet scribe's workshop in Israel: a religious sofer with a kippah, beard and white shirt, sitting at an old wooden desk, carefully examines a small rolled parchment with a magnifying glass under a warm desk lamp. On the desk: open mezuzah cases, a quill, an inkwell, neatly arranged. The parchment is seen from a distance, no readable writing. Calm, serious, golden light.
```
**Animation :** le sofer déroule doucement le parchemin et le regarde à la loupe, puis hoche la tête. Caméra : lent rapprochement.

## Image 5 : Hoppy rapporte la boîte
**Joindre :** `hoppy-officiel.png` + `fiche-client.jpg` + `sac-000.png`
```
At the apartment door in the late afternoon, the kangaroo mascot from the reference image takes the closed wooden box wrapped in white cloth out of the navy HOP! bag and hands it back to the smiling young man from the other reference image. Warm golden light, happy and respectful mood.
```
**Animation :** Hoppy sort la boîte du sac et la rend, le client sourit. Caméra : fixe.

## Image 6 : la mezouza est de retour
**Joindre :** `fiche-client.jpg`
```
The young man from the reference image fixes the mezuzah case back on the doorpost of his apartment, slanted as tradition requires, then touches it with his fingertips and brings them to his lips, smiling. Warm golden light, peaceful home atmosphere.
```
**Animation :** il remet la mezouza, la touche et embrasse ses doigts. Caméra : léger rapprochement, fin sur un sourire.

---

## 🎬 Prompt vidéo Gemini (Veo), à coller avec les 6 images dans l'ordre
```
Vertical 9:16 video, 10 seconds, one warm and fast-paced commercial using the attached images in order, keeping every character, object and logo exactly the same.
1. The man gently removes the mezuzah case from his doorpost and places it in the wooden box.
2. At the door, he hands the wrapped box to the kangaroo mascot, who places it carefully upright in the navy HOP! bag.
3. The kangaroo rides the delivery scooter through a sunny Netanya street with palm trees.
4. In a quiet workshop, the scribe examines the rolled parchment with a magnifying glass and nods.
5. Back at the door, the kangaroo hands the box back to the smiling man.
6. The man fixes the mezuzah back on the doorpost, touches it and kisses his fingertips, smiling.
Cinematic, warm light, Pixar-style 3D kangaroo in a real photorealistic world, respectful mood around the sacred objects, no readable writing on the parchment. Gentle upbeat music, soft sound effects, no voices, no subtitles, no added text.
```
**Si Gemini la refait en horizontal :** pas de souci, je fais la version verticale au montage (la vidéo au centre, les textes en haut et en bas).
**Si une image a un défaut** (fausses lettres sur le parchemin, Hoppy différent, logo HOP! raté) : refais seulement cette image, ou envoie-la-moi.

---

### Textes au montage (c'est moi qui les ajoute)
| Moment | FR | HE |
|---|---|---|
| Plan 1 | « Vos mezouzot à faire vérifier ? » | « המזוזות שלכם צריכות בדיקה? » |
| Plan 2 | « HOP! vient les chercher » | « הופ! בא לאסוף אותן » |
| Plan 4 | « Chez votre sofer » | « אצל הסופר שלכם » |
| Plan 5 | « … et vous les rapporte » | « …ומחזיר אותן אליכם » |
| Plan 6 | « Sans bouger de chez vous » | « בלי לצאת מהבית » |
| Fin | « HOP! · aller-retour · commandez sur l'appli » + logo HOP! | « הופ! · הלוך ושוב · מזמינים באפליקציה » + logo HOP! |

**À savoir pour la commande :** c'est une course « aller-retour » (bouton Aller-retour dans l'appli). Le client indique l'adresse de son sofer, et c'est lui qui paie le sofer directement : le livreur n'avance jamais d'argent.
