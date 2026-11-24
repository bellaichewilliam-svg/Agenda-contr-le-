# Guide : la page d'une boutique ou d'un restaurant dans HOP! (design 5)

Règles du patron (24/11/2026), à appliquer **à chaque nouvelle boutique**, sans qu'il ait à les redire.
Modèles : **Smash It** (`SMASHIT`) et **Rendez-Vous** (`RENDEZVOUS`). Tout se règle dans la table `shop_vitrine` (champ `cfg`), sans mise en ligne,
sauf les images, qui vont dans `livraison/img/<boutique>/` (fichiers `.webp`, partent avec la prochaine mise en ligne).

## 1. Le catalogue (avant tout)
- Reprendre **tout** le menu de son site : rubriques, plats, prix, descriptions, FR + HE (`« Nom FR · שם עברית »`, 80 caractères maximum).
- Photos **par lien**, jamais intégrées dans ce qu'on envoie au client. Pour les mettre dans la base sans les télécharger soi-même :
  `net.http_get('https://wsrv.nl/?url=<photo>&w=420&output=webp&q=68&encoding=base64')`, puis la réponse dans `shop_products.photo`.
  Vérifier `length(shop_catalog('<CODE>')::text)` < 150 Ko.
- `plan_until` rempli (sinon le catalogue ne s'affiche pas), `status = 'actif'`, horaires, adresse, téléphone, `kosher`.
- Casher : resto **viande**, jamais de mot laitier (écrire « parvé » / « végétal ») ; casher **mixte** (viande + lait, comme Rendez-Vous) : rubriques
  « Bassari » / « Halavi » dans leur nom, ou les ajouter dans `KS_EXTRA` (client.js) → l'écran « Vous avez envie de quoi ? » apparaît tout seul.

## 2. Le haut de page à l'identité de la boutique (`cfg.brand`)
- **Son logo** (`img/<boutique>/logo.webp`, rond), **ses couleurs** (`colors.page` = sa couleur principale, `brand.accent` = sa couleur claire),
  **sa police** (lire le CSS de son site : `font-family` des titres ; `brand.font`, `brand.fontLine`, `brand.fontHe` + `brand.fonts` pour Google Fonts),
  **sa phrase** (`brand.line`, ex. « Sandwichs · Salades · Café » : les mots s'allument l'un après l'autre).
- Le plat vedette détouré à droite, avec halo, ombre au sol et **fumée qui monte** (automatique pour un restaurant).
- **Rien ne doit être caché** : le texte jamais sous le plat, les pastilles jamais sous la barre du haut, rien de coupé au bord de l'écran.
- Pastilles du haut (Ouvert · Livraison · Casher) : sur une ligne, avec icône, reflet lumineux, point vert qui pulse si c'est ouvert.

## 3. La vitrine « menu éclaté » (`cfg.dishes`)
- 3 à 5 plats vedettes. Le patron fournit les plats entiers (ChatGPT, fond blanc) ; les ingrédients : d'abord ceux du site de la boutique
  (souvent sur fond blanc), sinon ChatGPT. Détourer avec rembg (`/root/cbx/bin/python`, modèle `isnet-general-use`), webp 620 px (plat) / 260 px (ingrédient).
- **Les ingrédients = exactement ceux de la recette** (description du plat). Ingrédient principal : juste montré ; les autres : « à enlever » (`off`)
  avec un mot qui existe (`lettuce, pickle, ketchup, mustard, sauce, mayo, tomato, dried, onion, cheese, cheeseParve, butter, egg, cucumber, crispy`) ;
  sauce vendue à part : « à ajouter » (`add` = id du produit). Pas d'élément décoratif trompeur (pas de pain qui flotte, pas d'étiquette inventée).
- Étiquettes (`tags`) : seulement des choses vraies (« Best-seller » si on le sait, « Nouveau » si le site le dit).
- Casher mixte : `side: "b"` (bassari) ou `"h"` (halavi) sur chaque plat ; la vitrine suit le choix du client.
- Toucher le plat dans la liste du menu ouvre la vitrine (pas l'ancienne fiche).

## 4. Les paiements
- Dès l'arrivée : bloc « Deux paiements » (articles au commerce, en ligne s'il a son paiement ; **livraison au livreur, en espèces ou par Bit**).
- Commerce sans paiement en ligne : « Commandez d'abord auprès de … » + la livraison au livreur. Ne jamais changer une règle d'argent sans le patron.

## 5. Vérifier avant de montrer (et avant toute mise en ligne)
- Captures **pleine page, rien de coupé** (screenshot `fullPage: true`, ou bandes successives qui se recouvrent), FR **et** HE, 390 px.
- Vidéo : tout le parcours (accueil → boutique → choix → vitrine → ingrédient → Ajouter → panier), aucune zone coupée.
- **Tous les boutons cliqués un par un avec les vraies données** (vrais commerces, vraies promos) avant de mettre le design en ligne.
