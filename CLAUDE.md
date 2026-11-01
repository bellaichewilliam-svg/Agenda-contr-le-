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
- **Visuels réseaux (Instagram, TikTok, Facebook, image de HOP!) : UNIQUEMENT le style du modèle `video/public/reseaux/hoppy-fleurs-original.png`** (fond bleu ciel, gros titre majuscules blanc + orange, hébreu blanc gras, Hoppy officiel au centre, pastille HOP!, bandeau bleu nuit). Ces visuels sont faits avec ChatGPT (prompt et thèmes prêts dans `video/HOPPY.md`) ; ne pas publier de montage maison à la place. Quand le patron envoie un nouveau visuel : le redimensionner en 1080 × 1350, le mettre dans `livraison/kit/visuels/<id>-post-<fr|he>.png` (+ l'original dans `video/public/reseaux/`) et l'ajouter aux campagnes du kit.

## Marque
- Logo **HOP!** : blanc sur **bleu nuit `#0F1F3D`**, le « ! » orange `#FF6A13`. Fonds de marque = bleu nuit (pas d'aplat orange).
- Nom des applis : « HOP! » (client), « HOP! Livreur », « HOP! Delivery » ; écran de lancement bleu nuit.
- Toujours **français + hébreu** (l'hébreu bien visible : gras, assez grand), droite à gauche correct (`HOP!` isolé en LTR).
- Pages et visuels **niveau pro**, jamais amateur ; textes jamais coupés (tester 360–412 px, FR et HE).

## Charte du nouveau design (maquette validée par le patron, kit `HOP_kit_pour_Claude`)
- **Toujours suivre la maquette au millimètre** : `references/maquette-inspiration.png`, `modele-encarts-valide.png`, `proposition-carte-recherche.png`, `proposition-partenaires-bas.png`. Même tailles, mêmes fonds, mêmes couleurs, mêmes icônes. Comparer avec des captures avant de montrer.
- **Rendu homogène sur toutes les pages client** (accueil, commande, commerce, mes courses, tarifs, suivi, « ce qu'on livre », bienvenue) : fond bleu nuit `#0B1830`, cartes `#13233F`, champs `#172A4B`, textes blancs, orange `#FF6A13` pour l'action. Activé par `html.d2` : **validé par le patron le 01/11/2026, pour tout le monde** (`?design=1` garde l'ancien sur un téléphone, `?design=2` revient au nouveau). Blanc le jour, bleu nuit le soir (`d2-day`).
- **Épuré** : rien de gros par-dessus la carte (une fine pastille d'une ligne au plus, ex. « 😴 Livreurs indisponibles · Programmer »). La carte doit respirer.
- **Icônes** : les icônes 3D du kit (`livraison/img/k2/i-*.webp`), même cadre bleu arrondi, 4 visibles par ligne sur l'accueil. Catégorie partout = `UI.catImg()`.
- **Grands encarts** : fonds officiels `fonds-encarts.css` (`.hop-fond-*`), objet en bas à droite fondu dans la carte, « ✨ NOUVEAU », titre gras, bouton blanc « Découvrir ».
- **Commerces** : 2 cartes par ligne, photo + vrai logo, pastille catégorie + cœur, « ● Fermé · ouvre à … » sous le nom, bouton « Programmer » ; jamais de grand bandeau sur la photo.
- **Barre du haut** : profil (rond), logo HOP!, panier (rond, pastille orange = nombre d'articles), livreur, langue. **Commander** : bouton orange avec le petit scooter + vrai prix.
- **Panier** : gardé 7 jours, visible du patron (onglet 🛒 Paniers, relance WhatsApp). Commerce sans paiement en ligne ou panier vide : guider « 1. commandez au commerce · 2. revenez sur HOP! pour la livraison ».

## Interdits et règles
- **Ne jamais citer de concurrent** par son nom (dire « une autre appli », « les grandes plateformes »).
- **Pas de durée chiffrée** de livraison (pas de « 18 min ») : dire « au plus vite », « votre plat arrive chaud ».
- Ne jamais envoyer l'e-mail du patron ; `config.js` est public : aucun secret dedans.
- Aucun identifiant de modèle d'IA dans les commits, PR ou fichiers.
- **Règles d'argent** : demander avant de changer un prix, une commission, une règle de paiement.
- **Base de données** : migrations en `create` / `create or replace` / `if not exists` seulement ; jamais de `drop` ni de `delete` de vraies données. Ne pas mettre en ligne du code qui écrit de nouvelles colonnes avant la migration en ligne.
- Le compte patron « Will » reste tel quel. Personne ne tape de numéro de carte bancaire dans HOP!.
- Cigarettes : jamais de prix ; images seulement d'un paquet SANS marque (comme l'icône du kit), jamais une vraie marque. Le livreur ne fait jamais de calcul.
- Vercel : 100 déploiements / jour maximum, grouper les mises en ligne.

## Repères techniques
- Appli : `livraison/` (PWA statique : `client.js`, `coursier.js`, `admin.js`, `commerce`, `suivi`, `kit.js`…), `./bump-version.sh` après chaque modification.
- Vidéos et visuels : `video/` (Remotion). Rendu : `npx remotion render src/index.ts <Composition> out/x.mp4 --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, puis ffmpeg (crf 24, faststart) vers `livraison/kit/visuels/<id>-video-<fr|he>.mp4` et entrée dans `VIDEOS` de `kit.js`.
- Musiques synthétisées (pas de droits) : `video/scripts/*.py`.
