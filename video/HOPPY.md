# Hoppy (הופי), la mascotte HOP!

## L'image officielle (référence)
**`livraison/kit/visuels/hoppy-officiel.png`** : c'est LUI. Toujours repartir de cette image.
Version détourée (fond transparent) : `video/public/hoppy-cut.png`, pour le poser sur n'importe quel fond.

## Qui est Hoppy ?
- Un **kangourou** dynamique et souriant : il fait « hop ! » en sautant, et il livre la commande **dans sa poche**.
- Caractère : joyeux, serviable, rapide, un peu malicieux. Il ne court jamais, il **saute**.
- Il parle français et hébreu. Ses répliques : « Coucou ! / שלום! », « Et hop ! / והופ! », « Livré ! / נמסר! ».

## À respecter à chaque fois (d'après l'image officielle)
| Élément | Règle |
|---|---|
| Style | personnage **3D façon film d'animation** (Pixar / Disney), fourrure douce et détaillée, lumière studio |
| Fourrure | fauve / caramel chaud, ventre, poitrine et poche **crème-sable** |
| Extrémités | bout des pattes et des pieds **brun foncé** |
| Tête | grandes oreilles dressées (intérieur rose), grands yeux bruns expressifs, sourcils marqués, nez brun, moustaches, grand sourire |
| Équipement | sac à dos à bretelles **bleu marine** + **sac isotherme bleu marine « HOP! »** (lettres blanches) qui dépasse de la poche, avec un peu de vapeur |
| Attitude | en plein saut, pouce levé ou geste joyeux |
| Fond | blanc ou bleu nuit HOP! `#0F1F3D` (avec la version détourée) |

À éviter : changer la couleur de la fourrure, vêtements en plus, autre texte que « HOP! » sur le sac, gestes ambigus de la main.

## Le prompt pour ChatGPT (à copier tel quel)

> **Toujours joindre `hoppy-officiel.png`** à ton message et commencer par : « Garde exactement ce personnage (même visage, même fourrure, même sac HOP!), change seulement : … »

```
Keep exactly the same character as in the attached image: "Hoppy", the kangaroo mascot of HOP! (a delivery app in Netanya, Israel).
Same 3D animated-movie style (Pixar/Disney quality), same warm caramel fur with cream belly and pouch, dark brown paw and foot tips, big upright ears with pink inside, big expressive brown eyes, whiskers, big friendly smile.
Same navy-blue backpack straps and the same navy-blue insulated delivery bag with "HOP!" in white letters sticking out of its pouch, with a little steam (the food is still hot).
Do not change his face, colors or proportions. No other text or logo.

New scene: [CHOISIR UNE SCÈNE CI-DESSOUS]
Background: [plain white / plain deep navy blue #0F1F3D]. Format 4:5 (Instagram post) or 9:16 (story). Character fully visible, with space around.
```

### Scènes prêtes à coller
- `jumping over the Netanya seaside promenade at sunset, the sea in the background`
- `knocking at an apartment door, handing the steaming HOP! bag to a happy customer`
- `riding a small delivery scooter with a navy "HOP!" top case, wind in his ears`
- `carrying grocery bags, a pizza box and a bouquet of flowers at once, juggling happily`
- `sitting on a stack of parcels, waving hello`
- `celebrating with confetti, both arms up, "Et hop !"`

### Conseils pour garder le même Hoppy
1. Une seule scène par image, toujours avec `hoppy-officiel.png` joint.
2. Si le visage ou les couleurs changent, répondre : « Reprends exactement le personnage de l'image jointe, seule la scène change. »
3. Les textes (prix, slogans) s'ajoutent ensuite dans le kit ou dans Canva, pas dans ChatGPT (il écrit souvent mal le texte).

## Fichiers
- `hoppy-officiel.png` : l'image de référence (à joindre à ChatGPT)
- `hoppy-post-fr.png` : présentation « Voici Hoppy ! » (1080 × 1350, FR + HE)
- `hoppy-story-fr.png` : la même en story (1080 × 1920)
- `hoppy-detoure-fr.png` : Hoppy sans fond (PNG transparent)
- Le premier dessin (`video/src/Mascot.tsx`) n'est plus la référence : c'était l'esquisse avant l'image officielle.
