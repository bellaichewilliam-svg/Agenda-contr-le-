# La méthode Higgsfield pour nos prochaines vidéos HOP! (patron, 09/11)

## 1. Ce qu'on a appris du film « Don't Poison Ivy » (modèle à suivre)
Projet de **joeysnoisygroup** sur Higgsfield (festival de films IA), lien : higgsfield.ai/@joeysnoisygroup/projects/don-t-poison-ivy
- **Histoire** : « Un conte fait main : une maison qui pousse de partout, une mère qui n'a plus rien à donner, et les années qu'il faut pour comprendre que le soin va dans les deux sens. » Une vraie histoire avec de l'émotion, pas une pub qui montre un produit.
- **Durée** : 15 min 38 s, en 4K.
- **Travail** : 553 générations, 30 741 crédits, 16,4 Go de fichiers.
- **Outils utilisés** (part de chaque outil) :
  - **Seedance 2.5** : 73 % → toutes les vidéos (les plans qui bougent).
  - **Seedream 5.0 Pro** : 16 % → les images de base (décors, plans fixes de départ).
  - **Nano Banana Pro** : 11 % → les personnages toujours identiques d'un plan à l'autre, et les retouches d'images.
  - **Cinematic Video Editor** : le montage final dans Higgsfield.
- **La leçon** :
  1. On crée d'abord les **images** : personnages, décors, et une image de départ pour chaque plan.
  2. On les **anime** ensuite, plan par plan, avec Seedance.
  3. On **monte** à la fin.
  4. Beaucoup d'essais : environ 35 générations par minute de film. On garde seulement les meilleures.
- Ses prompts sont publics, dans l'onglet **Canvas / Prompts** du projet. Ils ne s'ouvrent que dans un navigateur, pas chez Claude. **Ouvre-le sur l'ordinateur, copie 3 ou 4 prompts (ou fais des captures) et envoie-les-moi** : je les adapte à HOP!.

## 2. Notre méthode, en 4 étapes
### Étape 1 : la « fiche personnage » (Nano Banana Pro)
On fait une seule fois les personnages, et on les réutilise partout : c'est le secret pour que ça ne change pas d'un plan à l'autre.
- **Hoppy** : toujours partir de `hoppy-officiel.png`.
  ```
  Character sheet of the kangaroo mascot from the attached image, exactly the same character: front view, side view, back view, three-quarter view, on a plain white background. Same face, fur, colors, same navy blue insulated bag with white "HOP!" and orange "!" in its pouch. Pixar-quality 3D. No other text.
  ```
- **Le client** (à garder pour toutes nos pubs) :
  ```
  Character sheet of a friendly 30-year-old man from Netanya, Israel, short dark hair, light beard, casual navy t-shirt and jeans, expressive funny face: front, side, three-quarter views, plus 4 expressions (hungry, shocked, laughing, happy thumbs up). Photorealistic, plain white background.
  ```
- **Le sac HOP!** : partir de `sac-000.png`. Il ne change jamais : bleu nuit, « HOP! » blanc, « ! » orange.

### Étape 2 : les images de départ de chaque plan (Seedream 5.0 Pro)
Pour chaque plan, une image fixe, en **9:16**, en joignant la fiche du personnage concerné. On garde la même lumière et les mêmes couleurs dans tous les plans.

### Étape 3 : on anime chaque plan (Seedance 2.5)
- Envoyer l'image de départ, écrire ce qui bouge et comment bouge la caméra. Plans de 5 s.
- Faire 3 essais par plan et garder le meilleur.

### Étape 4 : le montage
- Monter dans le Cinematic Video Editor de Higgsfield, **ou** m'envoyer les plans : j'ajoute le logo, les textes en français et en hébreu, les bruitages et la musique, et je fais les versions FR et HE.
- Aucun texte dans les images ni dans les vidéos : c'est moi qui les ajoute.

## 3. Règles HOP! (à respecter dans toutes les vidéos)
- Logo **HOP!** blanc sur bleu nuit `#0F1F3D`, le « ! » orange `#FF6A13`. Pas d'autre logo, pas de concurrent.
- Hoppy officiel uniquement, jamais redessiné autrement, et sans geste de la main.
- Pas de durée chiffrée (« au plus vite », jamais « en 20 min »). Prix : « dès 25 ₪ en ville ».
- Toujours une version française et une version hébreu.

## 4. Notre prochaine vidéo : « Frigo vide ? HOP! » (≈ 20 s, choc et drôle)
Fiches à joindre : le client, Hoppy, le sac. Plans détaillés dans `HIGGSFIELD.md`.
| Plan | Image de départ (Seedream) | Animation (Seedance) |
|---|---|---|
| 1 | Le client devant son frigo vide, la nuit | Il ouvre, une boule d'herbe roule, zoom brutal sur sa tête |
| 2 | Rue de Netanya ensoleillée, palmiers, mer | Le sac HOP! géant tombe comme une météorite, gros impact |
| 3 | Nuage de poussière dans la rue | Hoppy sort, atterrissage de super-héros, sourire |
| 4 | Toits de Netanya au coucher du soleil | Hoppy saute de toit en toit, une baguette dépasse du sac |
| 5 | Porte de l'appartement du client | Ding-dong, Hoppy tend le sac, le client bouche bée puis éclate de rire |
| 6 | Le client devant son frigo plein | Il se tourne vers la caméra, pouce levé |

Textes au montage (FR / HE) : « Frigo vide ? » / « מקרר ריק? » → gros « HOP! » à l'impact → « Faites vos courses, on y va pour vous » / « עושים קניות, ואנחנו מביאים » → « dès 25 ₪ en ville » / « החל מ־25 ₪ בעיר » → logo HOP!.

## 5. Idées pour les suivantes (même méthode)
- **« La météo HOP! »** : un présentateur annonce « pluie de courses sur Netanya », et des produits tombent du ciel dans les sacs HOP!.
- **« Hoppy contre le canapé »** : quelqu'un n'a pas envie de sortir, Hoppy arrive à sa place.
- **« Le livreur héros »** : nos livreurs filmés comme dans un film d'action, mais pour une baguette.
- **« Vendredi, panique avant Chabbat »** : il manque tout en cuisine, HOP! sauve le repas (aucun délai promis : « on y va pour vous »).
