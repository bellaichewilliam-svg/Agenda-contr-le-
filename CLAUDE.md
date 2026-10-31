# HOP! Livraison (Netanya) : consignes permanentes

Le patron parle français : toujours lui répondre en **français**, simplement, sans jargon.
Chaque demande se fait jusqu'au bout : coder, tester, PR (`claude/delivery-management-app-eccme5` → `claude/shopping-price-comparison-aAUf1`, fusion « merge »), mettre en ligne (Vercel, alias `hop-livraison.vercel.app`), base Supabase à jour.

## « Mets Hoppy » : la mascotte
Quand le patron dit **« mets Hoppy »** (dans une vidéo, une image, un post, une page…), on ajoute **Hoppy (הופי)**, le kangourou officiel de HOP!.
- **Image officielle (référence)** : `livraison/kit/visuels/hoppy-officiel.png` = `video/public/hoppy.png`. C'est LUI, ne jamais le redessiner autrement.
- **Version sans fond** : `video/public/hoppy-cut.png` (aussi `livraison/kit/visuels/hoppy-detoure-fr.png`), à poser sur n'importe quel fond.
- **Dans une vidéo Remotion** : `<HoppyHop x={210} bottom={1890} h={560} at={0.35} />` (`video/src/HoppyHop.tsx`), dans la `<Sequence>` de la scène voulue : il arrive en sautant, atterrit, rebondit ; `exitAt={s}` pour qu'il reparte (vidéos en boucle) ; `from="right"` pour qu'il arrive de la droite. Déjà présent à la fin de toutes les vidéos du kit.
- **Dans une image fixe Remotion** : `<Img src={staticFile('hoppy-cut.png')} />` (voir `video/src/HoppyPhoto.tsx`).
- **Dans le site / le kit** : `kit/visuels/hoppy-detoure-fr.png`.
- **Nouvelles poses** : pas de dessin maison ; le patron les fait avec ChatGPT grâce au prompt de `video/HOPPY.md` (toujours joindre `hoppy-officiel.png`). Les nouvelles images validées vont dans `livraison/kit/visuels/` et `video/public/`.
- Hoppy de temps en temps dans les pubs, pas partout ; jamais de geste de la main ambigu.

## Marque
- Logo **HOP!** : blanc sur **bleu nuit `#0F1F3D`**, le « ! » orange `#FF6A13`. Fonds de marque = bleu nuit (pas d'aplat orange).
- Nom des applis : « HOP! » (client), « HOP! Livreur », « HOP! Delivery » ; écran de lancement bleu nuit.
- Toujours **français + hébreu** (l'hébreu bien visible : gras, assez grand), droite à gauche correct (`HOP!` isolé en LTR).
- Pages et visuels **niveau pro**, jamais amateur ; textes jamais coupés (tester 360–412 px, FR et HE).

## Interdits et règles
- **Ne jamais citer de concurrent** par son nom (dire « une autre appli », « les grandes plateformes »).
- **Pas de durée chiffrée** de livraison (pas de « 18 min ») : dire « au plus vite », « votre plat arrive chaud ».
- Ne jamais envoyer l'e-mail du patron ; `config.js` est public : aucun secret dedans.
- Aucun identifiant de modèle d'IA dans les commits, PR ou fichiers.
- **Règles d'argent** : demander avant de changer un prix, une commission, une règle de paiement.
- **Base de données** : migrations en `create` / `create or replace` / `if not exists` seulement ; jamais de `drop` ni de `delete` de vraies données. Ne pas mettre en ligne du code qui écrit de nouvelles colonnes avant la migration en ligne.
- Le compte patron « Will » reste tel quel. Personne ne tape de numéro de carte bancaire dans HOP!.
- Cigarettes : ni prix ni images. Le livreur ne fait jamais de calcul.
- Vercel : 100 déploiements / jour maximum, grouper les mises en ligne.

## Repères techniques
- Appli : `livraison/` (PWA statique : `client.js`, `coursier.js`, `admin.js`, `commerce`, `suivi`, `kit.js`…), `./bump-version.sh` après chaque modification.
- Vidéos et visuels : `video/` (Remotion). Rendu : `npx remotion render src/index.ts <Composition> out/x.mp4 --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, puis ffmpeg (crf 24, faststart) vers `livraison/kit/visuels/<id>-video-<fr|he>.mp4` et entrée dans `VIDEOS` de `kit.js`.
- Musiques synthétisées (pas de droits) : `video/scripts/*.py`.
