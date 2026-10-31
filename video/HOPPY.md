# Hoppy (הופי), la mascotte HOP!

## Qui est Hoppy ?
- Un **kangourou** : il fait « hop ! » en sautant, et il a une **poche**, donc il livre tout naturellement.
- La commande est dans sa poche : le **sac isotherme HOP!** bleu nuit dépasse de son ventre, parfois avec un peu de vapeur (« c'est encore chaud »).
- Caractère : joyeux, serviable, rapide, un peu malicieux. Il ne court jamais, il **saute**.
- Il parle français et hébreu. Ses répliques : « Coucou ! / שלום! », « Et hop ! / והופ! », « Livré ! / נמסר! ».

## À respecter à chaque fois
| Élément | Règle |
|---|---|
| Corps | orange HOP! `#FF6A13` (dégradé du clair `#FFB37A` au foncé `#E0520A`) |
| Ventre, museau, dessous des pieds | crème `#FFE9D2` |
| Intérieur des oreilles, joues | rose pêche `#FF9C8A` |
| Nez et yeux | bleu nuit `#0F1F3D`, yeux ronds et brillants avec 2 reflets blancs |
| Sac dans la poche | bleu nuit `#0F1F3D`, « HOP » en blanc et « ! » en orange, petite poignée |
| Oreilles | 2 grandes oreilles **pointues** de kangourou (pas des oreilles de lapin) |
| Proportions | grosse tête ronde, petit corps en forme de poire, grands pieds plats, longue queue épaisse |
| Style | **jouet 3D en vinyle** : formes rondes et douces, lumière de studio, ombre douce au sol |
| Fond des pubs | bleu nuit HOP! `#0F1F3D` (ou crème `#FFF0E6`) |

À éviter : vêtements chargés, texte autre que « HOP! » sur le sac, gestes de la main avec un seul doigt levé, ressemblance avec une mascotte existante.

## Le prompt pour ChatGPT (à copier tel quel)

> Joins aussi l'image `hoppy-fiche.png` (la fiche du personnage) à ton message, pour que ChatGPT garde exactement le même Hoppy.

```
Create a cute 3D mascot character for "HOP!", a food and parcel delivery app in Netanya, Israel.

Character: "Hoppy", a chubby baby kangaroo, in the style of a premium soft vinyl designer toy (smooth rounded shapes, matte plastic with subtle glossy highlights, studio lighting, soft shadow on the ground, Pixar-like cuteness, high detail, 3D render).

Design (keep exactly):
- Body: warm orange #FF6A13, slightly lighter on top, darker at the bottom.
- Belly, muzzle and soles of the feet: cream #FFE9D2.
- Two big POINTY kangaroo ears (not rabbit ears), inner ear peach pink #FF9C8A.
- Big round head, small pear-shaped body, big flat feet, long thick tail.
- Big round shiny navy eyes (#0F1F3D) with two white reflections, small navy nose, rosy cheeks, happy open smile.
- In its belly pouch: a small navy-blue (#0F1F3D) insulated delivery bag with a little handle, with the text "HOP" in white and "!" in orange, a few wisps of steam coming out (the food is still hot).
- No clothes, no other text, no logo other than "HOP!" on the bag.

Pose: [CHOISIR : waving hello with one paw / jumping happily in the air with motion lines / holding a red heart, winking / riding an orange delivery scooter / handing the HOP! bag to the viewer].
Background: plain deep navy blue #0F1F3D with a soft light behind the character. Square format 1:1 (or 4:5 for Instagram), character centered with space around.
```

### Variantes de pose prêtes à coller
- `waving hello with one paw, other paw on the HOP! bag`
- `jumping happily in the air, motion lines under its feet, eyes closed with joy`
- `holding a big red heart up in one paw, winking`
- `riding a small orange delivery scooter with a navy "HOP!" top case, wind in its ears`
- `handing the steaming HOP! bag towards the viewer with both paws, big smile`
- `sitting on a stack of parcels and pizza boxes, giving a happy wave`

### Conseils pour garder le même Hoppy
1. Toujours joindre `hoppy-fiche.png` et écrire : « Garde exactement ce personnage, change seulement la pose : … ».
2. Si ChatGPT change les couleurs ou les oreilles, répondre : « Oreilles pointues de kangourou, corps orange #FF6A13, sac bleu nuit HOP! dans la poche, comme sur l'image jointe. »
3. Demander une seule pose par image, fond uni, puis ajouter les textes dans le kit ou Canva.

## Fichiers
- `hoppy-post-fr.png` : présentation « Voici Hoppy ! » (1080 × 1350, FR + HE)
- `hoppy-fiche-fr.png` : fiche du personnage, 3 poses (2160 × 1350)
- Le dessin est dans `video/src/Mascot.tsx` (composant `Hoppy`, réutilisable dans les vidéos).
