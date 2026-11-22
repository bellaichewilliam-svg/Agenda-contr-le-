# Audit d'accessibilité · appli client · 22/11/2026
**Norme :** WCAG 2.1 AA · **Pages :** accueil, page magasin (Rami Lévy), Ma commande (Marché français) · FR + HE · 390 px
**Outils :** contrôle automatique axe-core 4.10 (dans Playwright), clavier (Tab), zones de toucher, contour au clavier.

## Résumé
| | Avant | Après |
|---|---|---|
| Bouton sans nom (bouton « Nous écrire ») | 6 | 0 |
| Contrastes insuffisants | 26 | 6 (5 = bouton orange, à décider ; 1 = mesure pendant une animation) |
| Boutons imbriqués (cœur dans la carte commerce) | 6 | 0 |
| Champ de recherche sans libellé | 1 | 0 |

## Corrigé
- Bouton « Nous écrire » et champs de recherche : nom lu par les lecteurs d'écran (FR / HE).
- Petits textes gris (« Partager l'appli », « Envoyez votre liste sur WhatsApp ») : gris #5A6270 sans transparence (3,6:1 → 5,7:1).
- « Ouvert » : vert foncé #067647 (2,6:1 → 5,7:1).
- Jour / heure choisis et bouton « Changer » : bleu nuit au lieu de l'orange vif (2,9:1 → 16:1), comme la règle du design « choix sélectionné = bleu nuit ».
- Carte commerce : plus un bouton qui contient un bouton (le cœur devient « Ajouter aux favoris », avec son état).
- Pastilles d'exemples (« Lait », « Pain »…) : 40 px de haut au moins pour le doigt.
- Contour bleu nuit bien visible quand on navigue au clavier.

## À décider par le patron
- **Bouton orange principal (« Choisir mes articles », « Commander »)** : blanc sur #E8590C = 3,6:1, il faut 4,5:1 pour un texte de 16 px. Deux choix : un orange un peu plus foncé (#C2410C, 5,2:1), ou un texte un peu plus grand (19 px gras, où 3:1 suffit). L'orange est la couleur validée : on ne la change pas sans accord.

## Bon
- Zoom autorisé (pas de blocage du zoom), langue et sens de lecture déclarés (fr / he, ltr / rtl), toutes les images ont un texte alternatif.
- À tester encore sur un vrai téléphone avec VoiceOver / TalkBack (un contrôle automatique ne voit qu'environ 30 % des problèmes).
