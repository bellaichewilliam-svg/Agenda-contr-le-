# HOP! : pubs vidéo, une idée pour chaque chose qu'on livre

> Carnet de prompts du 08/11/2026. Suite du brief `video/pubs/BRIEF.md` (la pub « Il pleut ? » est déjà faite).
> Aucune idée du brief n'est reprise ici (duel du fromage, Hoppy au-dessus de Netanya, ouverture ASMR, pluie de pizzas) : ce sont **23 angles nouveaux**.

## Comment s'en servir (3 étapes, toujours les mêmes)

1. **L'image de départ** (ChatGPT ou Gemini) : coller le **prompt image**. Pour les pubs avec Hoppy, **joindre `livraison/kit/visuels/hoppy-officiel.png`** et commencer le message par : « Garde exactement ce personnage (même visage, même fourrure, même sac HOP!) ».
   Vérifier que « HOP! » est bien écrit sur la boîte, le sac ou l'autocollant avant de passer à l'étape 2.
2. **L'animation** (Veo, dans Gemini ou Flow) : joindre l'image de l'étape 1 (elle devient la **première image** de la vidéo) et coller le **prompt Veo**. 8 secondes au maximum, caméra fixe.
3. **Le montage** : m'envoyer la vidéo Veo. J'ajoute les **textes FR + HE**, la fin avec le logo, « À partir de 25 ₪ » et les bruitages (`video/pubs/render.py` + `sfx.py`), puis je vérifie chaque image avant de dire « prêt ».

## Règles déjà en place dans chaque prompt

- L'IA ne fait que l'image : **aucun texte** demandé à Veo (il abîme l'hébreu).
- **Format 9:16** ; le haut (22 %) et le bas (20 %) restent calmes pour les titres et la légende d'Instagram et de TikTok.
- **Hoppy** est le personnage officiel. Il ne marche ni ne saute jamais sur de la nourriture, et ne fait aucun geste de la main ambigu. Il apparaît dans 5 pubs sur 23 (n° 6, 8, 14, 20, 21), pas partout.
- **Aucune autre marque** à l'image (pas de logo de chaîne ni de produit) : seulement HOP!.
- **Casher** : jamais de viande et de lait dans la même image. Le burger est sans fromage, et la pizza est seule.
- **Pas de durée chiffrée** (« au plus vite », jamais « en 20 min ») et pas de « partenaire ». Le prix : « à partir de 25 ₪ », jamais « 25 ₪ partout ».
- Pas de pub tabac ni alcool (la loi les encadre).

**Bloc à coller à la fin de chaque prompt image :**
```
Vertical 9:16 (1080x1920). Keep the top 22% and the bottom 20% of the frame calm and uncluttered (simple background only). No text, no letters, no numbers, no brand logos anywhere, except the HOP! logo when it is asked (white "HOP" with an orange "!", on a navy-blue #0F1F3D background). Modern Israeli Mediterranean city look (Netanya), natural modest clothing, premium commercial photography, rich warm colors.
```

**Fin commune à toutes les pubs** (faite au montage) : gros logo HOP! avec les traits orange, puis « À PARTIR DE 25 ₪ / משלוחים החל מ-25 ₪ », puis « Livraison à Netanya / משלוחים עד הבית בנתניה ».

---

## 🍕 Restaurants

### 1. Le dernier morceau
**L'idée :** une famille tend la main vers la dernière part de pizza en même temps. Qui la prendra ?
**Image :**
```
Overhead close-up of an open kraft pizza box on a living-room coffee table, only ONE slice of margherita left, steaming. Four hands (a child, a teenager, two adults) reach for it from four sides at the same time, freezing just before touching it. The box lid shows a clean navy-blue HOP! logo sticker. Warm evening lamp light, cozy family atmosphere.
```
**Veo :** `Locked static overhead camera. The four hands slowly creep toward the last slice, fingers twitching, then all freeze; the steam keeps rising. No text.`
**Textes :** « LE DERNIER MORCEAU ? » / « הפרוסה האחרונה? » → « COMMANDEZ-EN UNE AUTRE ! » / « מזמינים עוד אחת! »

### 2. Le burger en apesanteur
**L'idée :** le burger se construit tout seul dans les airs, couche par couche (sans fromage : il est casher viande).
**Image :**
```
A gourmet beef burger exploded into floating layers in mid-air: toasted sesame brioche bun, crisp lettuce, thick juicy grilled patty with grill marks, tomato slices, red onion rings, pickles, top bun. NO cheese, no sauce dripping on a plate. Dark navy-blue background with an orange rim light, flying sesame seeds and tiny drops, ultra sharp food commercial.
```
**Veo :** `Locked static camera. The floating layers slowly drift, then snap together one by one into a perfect burger, a puff of steam rises. No text.`
**Textes :** « TOUT EST PRÊT… » / « הכול מוכן… » → « IL NE MANQUE QUE VOUS. » / « חסרים רק אתם. »

### 3. Les baguettes qui tremblent
**L'idée :** des baguettes saisissent un sushi au-dessus de la ville, la nuit, sur un balcon de Netanya.
**Image :**
```
Close-up of chopsticks lifting a glossy salmon nigiri above a small bowl of soy sauce, on a balcony table at night, blurred city lights of Netanya and the sea in the background, a small navy delivery bag with a HOP! logo on the chair behind. Moody cinematic light, bokeh.
```
**Veo :** `Locked static camera. The chopsticks dip the nigiri into the soy sauce in slow motion, a tiny splash, the city lights twinkle. No text.`
**Textes :** « UNE ENVIE DE SUSHI ? » / « בא לכם סושי? » → « ON Y VA. » / « יוצאים לדרך. »

### 4. Le jus qui éclabousse
**L'idée :** des oranges tombent au ralenti, s'ouvrent et deviennent un jus dans un gobelet HOP! (HOP! Jus de fruits).
**Image :**
```
Fresh oranges, strawberries and mango pieces falling in slow motion into a tall clear cup of fresh juice, big splash crown, droplets frozen in the air, the cup has a navy-blue sleeve with the HOP! logo. Bright sunny background with soft orange gradient, studio light.
```
**Veo :** `Locked static camera. Fruits keep falling into the cup in slow motion, the juice splashes and settles, condensation drops slide down. No text.`
**Textes :** « PRESSÉ À LA MINUTE » / « סחוט טרי » → « LIVRÉ CHEZ VOUS » / « עד הבית »

---

## 🛒 Courses

### 5. Le frigo vide (2 générations Veo)
**L'idée :** on ouvre le frigo : un citron tout seul. On le rouvre : il est plein.
**Image A :**
```
A modern fridge opening toward the camera, its light switching on, completely empty except for ONE lonely lemon rolling on the middle shelf. Slightly dark kitchen, a bit of comic sadness.
```
**Image B :**
```
The same fridge, same angle, now completely full and colorful: milk, eggs, fresh vegetables, fruit, yogurts, bread, juice, a navy HOP! paper bag on the floor in front of it. Bright happy light.
```
**Veo A :** `Locked static camera. The door opens, the light flickers on, the lemon rolls slowly and stops. No text.`
**Veo B :** `Locked static camera. The door swings fully open, cold mist flows out, everything sparkles. No text.`
**Textes :** « FRIGO VIDE ? » / « המקרר ריק? » → (plan B) « ON LE REMPLIT. » / « אנחנו ממלאים אותו. »

### 6. La liste qui s'envole (avec Hoppy)
**L'idée :** la liste de courses aimantée sur le frigo s'envole par la fenêtre ; Hoppy la rattrape au vol. C'est exactement « Hoppy a compris votre liste » dans l'appli.
**Image :**
```
[Hoppy, exactly as in the attached image] mid-jump outside an open kitchen window of a Netanya apartment, catching in the air a small paper shopping list covered only with little doodle icons (milk carton, bread, eggs, apple — no letters), sunny sky and rooftops behind him.
```
**Veo :** `Locked static camera. The paper flutters in the wind, Hoppy catches it mid-air with a happy grin and lands softly on the balcony railing side, ears bouncing. No text.`
**Textes :** « ÉCRIVEZ VOTRE LISTE… » / « כתבו את הרשימה… » → « HOPPY FAIT LE RESTE ! » / « הופי עושה את השאר! »

### 7. Le chariot fantôme
**L'idée :** un chariot de supermarché roule tout seul dans les rayons et les produits sautent dedans.
**Image :**
```
An empty shopping cart alone in the middle of a bright, clean supermarket aisle, shelves full of colorful generic products (no brands, no readable labels), a navy HOP! tag hanging on the cart handle. Wide symmetrical shot, magical soft light.
```
**Veo :** `Locked static camera. The cart rolls slowly forward by itself while products hop from the shelves into it one after another, landing softly. No text.`
**Textes :** « VOUS RESTEZ ASSIS… » / « אתם נשארים בבית… » → « LES COURSES ARRIVENT. » / « הקניות מגיעות. »

### 8. Le 4ᵉ étage sans ascenseur (avec Hoppy)
**L'idée :** les packs d'eau, l'escalier, le 4ᵉ étage… Hoppy monte en sautant, une marche à la fois, tout sourire.
**Image :**
```
[Hoppy, exactly as in the attached image] hopping up the stairs of a typical Netanya apartment building stairwell, carrying two six-packs of water bottles (no labels), floor number signs replaced by plain colored dots, bright daylight through the window.
```
**Veo :** `Locked static camera at the top of the stairs. Hoppy hops up the last steps with the water packs, lands on the landing and gives a happy proud smile. No text.`
**Textes :** « 4ᵉ ÉTAGE SANS ASCENSEUR ? » / « קומה רביעית בלי מעלית? » → « ON MONTE LES PACKS. » / « אנחנו מעלים את השישיות. »

---

## 💊 Pharmacie

### 9. Restez au lit
**L'idée :** quelqu'un de malade sous la couette ; la sonnette ; un sac de pharmacie apparaît sur la table de nuit.
**Image :**
```
A person sick in bed under a thick duvet, tissues and a cup of tea on the bedside table, cozy dim bedroom, and on the bedside table a small white pharmacy paper bag with a green cross and a small HOP! sticker. Soft morning light through curtains.
```
**Veo :** `Locked static camera. The person slowly pulls the duvet down, sees the pharmacy bag, smiles weakly and gives a tiny relieved sigh. No text.`
**Textes :** « MALADE ? RESTEZ AU LIT. » / « חולים? תישארו במיטה. » → « LA PHARMACIE VIENT À VOUS » / « בית המרקחת מגיע אליכם » · sous-titre : « Même avec ordonnance » / « גם עם מרשם »

---

## 🥖 Boulangerie et Chabbat

### 10. Vendredi, 13 h
**L'idée :** une table de Chabbat prête, il ne manque qu'une chose ; les hallot dorées arrivent, encore fumantes.
**Image :**
```
A beautiful Shabbat table set with a white tablecloth, silver candlesticks with unlit candles, wine cups, salads, and an empty challah board in the center. Next to it, two golden braided challot just placed on a navy HOP! paper bag, a little steam rising. Warm Friday afternoon light.
```
**Veo :** `Locked static camera. Steam rises from the warm challot, sunlight slowly shifts across the tablecloth. No text.`
**Textes :** « VENDREDI, PAS LE TEMPS ? » / « שישי, אין זמן? » → « LES HALLOT ARRIVENT. » / « החלות כבר בדרך. »

---

## 📦 Colis, poste, documents, clés

### 11. La queue à la poste
**L'idée :** une file interminable à la poste ; une chaise vide au milieu : « votre » place, c'est nous qui la prenons.
**Image :**
```
A long queue of tired people in a post office waiting room, ticket machine and counters (no readable signs), one empty plastic chair in the middle of the row with a small navy HOP! parcel waiting on it. Neutral fluorescent light, slightly comic mood.
```
**Veo :** `Locked static camera. People sigh, check their watches and shift their weight; the parcel on the empty chair stays calm and still. No text.`
**Textes :** « LA QUEUE À LA POSTE ? » / « התור בדואר? » → « ON Y VA À VOTRE PLACE. » / « אנחנו הולכים במקומכם. »

### 12. Le colis qui fait HOP!
**L'idée :** un carton avec l'autocollant HOP! traverse la rue en faisant des petits bonds, comme un kangourou.
**Image :**
```
A small cardboard parcel with a navy HOP! sticker standing on a sunny Netanya sidewalk lined with palm trees and white buildings, slightly squashed as if about to jump, a cute cartoon feeling in a realistic street. Low angle.
```
**Veo :** `Locked static camera. The parcel makes three joyful little hops along the sidewalk like a kangaroo and lands in front of a front door. No text.`
**Textes :** « VOS COLIS… » / « החבילות שלכם… » → « FONT HOP! » / « עושות HOP! » (HOP! reste en lettres latines, isolé)

### 13. Les clés oubliées
**L'idée :** on est devant la porte, on fouille ses poches… les clés sont restées au bureau.
**Image :**
```
A person standing in front of a closed apartment door at dusk, patting their empty pockets with a worried face; through the small glass window of the door, a set of keys is visible lying on a shelf inside the apartment. Warm hallway light.
```
**Veo :** `Locked static camera. The person pats pocket after pocket, looks up with a comic sigh; the hallway light flickers on. No text.`
**Textes :** « CLÉS OUBLIÉES ? » / « שכחתם את המפתחות? » → « ON VOUS LES APPORTE. » / « אנחנו מביאים אותם. »

### 14. Vendu sur Internet (avec Hoppy)
**L'idée :** un fauteuil vendu entre deux voisins ; Hoppy le porte d'un immeuble à l'autre.
**Image :**
```
[Hoppy, exactly as in the attached image] jumping happily across a sunny Netanya street holding a small cozy armchair above his head with a bow on it, a smiling young couple waiting at the door of the building on the right. Bright day.
```
**Veo :** `Locked static camera. Hoppy lands gently in front of the couple and sets the armchair down, they clap happily. No text.`
**Textes :** « VENDU SUR INTERNET ? » / « מכרתם משהו באינטרנט? » → « ON LE LIVRE AU CLIENT. » / « אנחנו מעבירים אותו לקונה. »

---

## 👔 Pressing

### 15. La chemise qui vole
**L'idée :** une chemise blanche impeccable traverse la ville sur son cintre et rentre toute seule dans l'armoire.
**Image :**
```
A crisp white shirt on a wooden hanger inside a clear garment cover with a small navy HOP! tag, floating in the air in front of an open wardrobe in a bright bedroom, the window behind shows the sea of Netanya. Soft clean light.
```
**Veo :** `Locked static camera. The floating shirt drifts gently into the wardrobe and hangs itself on the rail, the wardrobe door closes softly. No text.`
**Textes :** « VOTRE PRESSING… » / « ניקוי יבש… » → « ALLER ET RETOUR. » / « הלוך וחזור. »

---

## 💐 Fleurs et cadeaux

### 16. Vous avez oublié ?
**L'idée :** un homme réalise sur son téléphone que c'est l'anniversaire de sa femme ; la sonnette ; le bouquet est déjà là.
**Image :**
```
A woman opening her front door with a huge happy surprise smile, holding a big colorful bouquet of flowers tied with a navy ribbon and a small HOP! tag; behind her, inside the apartment, her husband peeks with a relieved grin. Warm light.
```
**Veo :** `Locked static camera. She smells the flowers, laughs and turns toward her husband, who gives a discreet relieved smile. No text.`
**Textes :** « VOUS AVEZ OUBLIÉ ? » / « שכחתם? » → « ON LIVRE LA SURPRISE. » / « אנחנו מביאים את ההפתעה. »

---

## 👶 Bébé et 🐾 animaux

### 17. Le dernier paquet de couches
**L'idée :** un parent ouvre le paquet de couches : vide. Panique silencieuse, très drôle.
**Image :**
```
A young parent in a cozy nursery holding a baby on one arm and an EMPTY diaper box (plain, no brand) upside down with the other hand, with a comically shocked face; the baby laughs. Soft pastel light.
```
**Veo :** `Locked static camera. The parent shakes the empty box, nothing falls out, the baby giggles and grabs the parent's nose. No text.`
**Textes :** « PLUS DE COUCHES ? » / « נגמרו החיתולים? » → « PAS DE PANIQUE. » / « בלי פאניקה. »

### 18. Le chat qui attend
**L'idée :** un chat assis devant sa gamelle vide fixe la caméra ; le sac de croquettes arrive.
**Image :**
```
A fluffy cat sitting very straight in front of an empty food bowl on a kitchen floor, staring at the camera with a judging face; next to it a plain bag of pet food (no brand) standing in a navy HOP! paper bag. Warm afternoon light.
```
**Veo :** `Locked static camera. The cat slowly turns its head to the HOP! bag, then back to the camera, blinks slowly and licks its lips. No text.`
**Textes :** « IL A FAIM ? » / « החתול רעב? » → « SES CROQUETTES ARRIVENT. » / « האוכל שלו כבר בדרך. »

---

## 🏠 Maison

### 19. La télécommande morte
**L'idée :** le soir du match, la télécommande ne répond plus ; les piles arrivent.
**Image :**
```
A man on a sofa at night pointing a TV remote at the screen with desperation, pressing the button, the TV showing only a blurred green sports field (no logos, no text); on the coffee table a small navy HOP! bag with a pack of plain batteries peeking out.
```
**Veo :** `Locked static camera. He presses the button again and again, shakes the remote, then notices the HOP! bag and his face lights up. No text.`
**Textes :** « LA TÉLÉCOMMANDE EST MORTE ? » / « השלט מת? » → « ON APPORTE LES PILES. » / « מביאים סוללות. »

---

## 🦘 La marque HOP!

### 20. La poche magique de Hoppy
**L'idée :** comme un magicien, Hoppy sort de sa poche tout ce qu'on livre : une pizza, un bouquet, un colis, une baguette, un sac de pharmacie… C'est la pub qui dit tout en 8 secondes.
**Image :**
```
[Hoppy, exactly as in the attached image] standing on a plain deep navy-blue (#0F1F3D) background with soft orange rim light, pulling out of his pouch, one after another, items that float around him: a pizza box, a bouquet of flowers, a cardboard parcel, a baguette, a small white pharmacy bag, a bottle of milk. Magical sparkles. Character fully visible, centered.
```
**Veo :** `Locked static camera. Hoppy pulls the items out of his pouch one by one, each one pops into the air and floats around him in a circle; he ends with a big friendly smile. No text.`
**Textes :** « TOUT CE QUE VOUS VOULEZ… » / « כל מה שתרצו… » → « …DANS LA POCHE DE HOPPY ! » / « …בכיס של הופי! »

### 21. Hoppy au feu rouge
**L'idée :** Hoppy attend au feu rouge sur son scooter HOP!, à côté des voitures ; le feu passe au vert et il part en souriant.
**Image :**
```
[Hoppy, exactly as in the attached image] sitting on a small navy delivery scooter with a navy HOP! top case, waiting at a red traffic light on a sunny Netanya boulevard between ordinary cars, helmet strap on, ears up, looking at the camera with a mischievous smile.
```
**Veo :** `Locked static camera. The light turns green, Hoppy winks at the camera and rides off smoothly out of frame, his ears flowing in the wind. No text.`
**Textes :** « NETANYA… » / « נתניה… » → « ON ARRIVE ! » / « אנחנו מגיעים! »

---

## 🛵 Recrutement et commerces

### 22. Deviens livreur
**L'idée :** un livreur sur son scooter au coucher du soleil, sur la route des falaises de Netanya. Liberté.
**Image :**
```
A smiling young delivery rider on a scooter with a navy HOP! top case, riding along the Netanya cliff road at golden hour, the Mediterranean sea glowing orange, helmet and safety jacket, phone mounted on the handlebar showing a simple map (no text).
```
**Veo :** `Locked static camera. The rider passes from left to right at a calm speed, the sunset light flickers through the palm trees. No text.`
**Textes :** « DEVIENS LIVREUR HOP! » / « בואו להיות שליחים ב-HOP! » → « TES COURSES, QUAND TU VEUX » / « בוחרים משלוחים, מתי שרוצים »
(La fin de cette pub est différente : logo + « Inscription dans l'appli HOP! Livreur » / « הרשמה באפליקציית HOP! Livreur », sans le prix.)

### 23. Votre commerce n'a pas de livreur ?
**L'idée :** un commerçant derrière son comptoir, le téléphone sonne, une commande : le livreur HOP! entre déjà.
**Image :**
```
A friendly shop owner behind the counter of a small neighborhood bakery in Netanya, looking at a phone that just lit up, while through the glass door a HOP! delivery rider with a navy HOP! bag is about to enter. Warm morning light, pastries on display (no text, no prices).
```
**Veo :** `Locked static camera. The owner smiles at the phone, packs a paper bag, the rider opens the door and waves. No text.`
**Textes :** « PAS DE LIVREUR ? » / « אין לכם שליח? » → « MAINTENANT, SI. » / « עכשיו יש. »
(Fin : logo + « Inscrivez votre commerce sur HOP! » / « רשמו את העסק שלכם ב-HOP! », sans le prix.)

---

## Par où commencer

Les 3 qui vendent le plus vite, à faire en premier :
1. **n°20 La poche magique de Hoppy** : elle montre tout ce qu'on livre en une seule pub.
2. **n°5 Le frigo vide** : tout le monde s'y reconnaît.
3. **n°1 Le dernier morceau** : ça donne faim et c'est drôle.
