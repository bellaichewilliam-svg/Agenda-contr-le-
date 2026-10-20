# Vidéo HOP! pour les réseaux (Remotion)

Vidéo verticale 1080 × 1920 (Reels, TikTok, Stories, statut WhatsApp), 27,5 s à 30 images/s,
en deux versions : **française** (`HopPromo`) et **hébreu** (`HopPromoHe`, de droite à gauche).

## Les scènes (src/timeline.json)

1. **Accroche** : le colis HOP! saute sur la trajectoire en pointillés, « Et hop, c'est livré ! ».
2. **Tout ce qu'on livre** : colis, repas, pharmacie, clés oubliées, fleurs, puis « On s'en occupe. ».
3. **Commande en 30 secondes** : le téléphone, départ et arrivée tapés, 25 ₪, « Commander maintenant ».
4. **Suivi en direct** : la carte (la mer à l'ouest, comme à Netanya), le scooter sur le trajet, l'heure d'arrivée qui baisse.
5. **25 ₪** : la course dans Netanya, prix fixe, espèces ou Bit, express.
6. **Commerçants** : 0 % de commission sur vos ventes, catalogue en ligne, ils paient seulement la livraison.
7. **Livreurs** : rejoignez HOP!, vos horaires, des courses près de vous.
8. **Fin** : le logo, la première course à 15 ₪ (code BIENVENUE / BRUCHIM), hop-livraison.vercel.app.

Les textes sont dans `src/strings.ts` (français et hébreu), les couleurs dans `src/theme.ts`.

## Musique

La musique (120 BPM, un temps = 15 images, les scènes tombent sur le temps) et les bruitages sont
**fabriqués par `scripts/music.py`** : aucun droit d'auteur. Pour TikTok ou Instagram, on peut aussi
couper le son et mettre un son tendance dans l'appli.

## Fabriquer la vidéo

```bash
npm install
pip install numpy scipy
npm run render       # -> out/hop-promo-fr.mp4
npm run render:he    # -> out/hop-promo-he.mp4
npm run studio       # pour la voir et la modifier dans le navigateur
```

Dans le conteneur cloud, ajouter `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
