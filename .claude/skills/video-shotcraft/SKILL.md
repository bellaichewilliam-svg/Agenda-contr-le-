---
name: video-shotcraft
description: Vidéos produit « cinéma » avec Remotion à partir des vraies pages de l'appli HOP! — 124 cartes de plans (recettes d'animation avec code et aperçus), le modèle Ink Press, synchronisation sur le rythme, sound design et recherche d'effets sonores. À utiliser quand le patron demande une vidéo / pub / promo « de qualité » sur l'appli, un plan précis (ex. « fais comme la carte 37 »), ou des effets sonores pour une vidéo existante. Bibliothèque github.com/Vincentwei1021/video-shotcraft (Apache 2.0).
---

# video-shotcraft (pour HOP!)

1. **Récupérer la bibliothèque** : `sh "<dossier de cette compétence>/scripts/setup.sh"` (clone au premier usage dans `~/video-shotcraft`, sinon mise à jour) ; la dernière ligne donne `LIB=<chemin>`. `setup.sh deps` installe ses paquets Node.
2. **Suivre la bibliothèque** : lire `$LIB/SKILL.md` (en chinois, c'est le mode d'emploi complet) et ses `references/` ; aperçus animés des 124 plans : https://vincentwei1021.github.io/video-shotcraft/
3. **Choix du mode** (le SKILL.md le demande) : pour HOP!, proposer en priorité « création libre » ou « co-création » adaptées à notre charte ; le modèle Ink Press seulement s'il colle.

## Règles HOP! qui passent avant tout (CLAUDE.md)
- Les vidéos HOP! vivent dans `video/` (Remotion du projet) : on y reprend les plans et composants de shotcraft, on ne crée pas un 2e projet Remotion. Rendu et export kit : voir CLAUDE.md (« Repères techniques »).
- Captures RÉELLES de l'appli (design 5 en vigueur), FR + HE (hébreu RTL, gras, lisible), textes jamais coupés, Hoppy officiel uniquement (`video/public/hoppy-cut.png`, `HoppyHop`).
- Jamais de concurrent cité, pas de durée chiffrée, « dès 25 ₪ en ville », jamais « partenaire ».
- Effets sonores / musiques : uniquement des sons à licence libre vérifiée (Freesound CC0 / CC-BY avec crédit noté) ou synthétisés (`video/scripts/*.py`).
- Vérifier les images clés (FR et HE) avant de montrer au patron.
