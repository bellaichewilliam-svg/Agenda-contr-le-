---
name: revue-design-hop
description: Revue d'un écran de l'appli HOP! comme un designer senior (demande du patron, 22/11) : captures téléphone FR + HE, liste des défauts du plus grave au moins grave, corrections dans le style HOP!, captures avant / après. À utiliser quand le patron demande de rendre une page « pro », « jolie », « pas IA », ou de « revoir le design ».
---

# Revue design HOP!

1. **Regarder le vrai rendu** : serveur local (`livraison/`, `python3 -m http.server 8765`), Playwright à 360 et 390 px, en français ET en hébreu, avec des données réalistes (routes simulées pour Supabase). Faire défiler l'écran par tranches (pas de capture « pleine page » : les cartes qui apparaissent au défilement restent vides).
2. **Lister les défauts, du plus grave au moins grave** : texte coupé ou qui déborde, espace vide inutile, page trop longue, éléments qui se chevauchent, contraste faible, flèches dans le mauvais sens en hébreu, images cassées, incohérences entre écrans.
3. **Chasser ce qui « fait IA »** (voir le skill frontend-design) : fond crème + accent terracotta, cartes toutes identiques avec la même ombre, dégradés décoratifs, petites étiquettes EN MAJUSCULES au-dessus de chaque titre, textes « A · B · C », flèches « → » ajoutées partout, animations sur chaque bloc. Un seul élément mémorable par écran, le reste calme.
4. **Corriger dans le style HOP!** (CLAUDE.md) : design `html.d4` / `html.d3`, une seule couleur d'action (orange), bleu nuit `#0F1F3D` pour le choisi, Heebo, hébreu bien visible, aucun mot interdit (« partenaire », concurrents, durées).
5. **Montrer avant / après** au patron (captures assemblées), puis PR et mise en ligne selon les règles (groupée le soir sauf urgence).
