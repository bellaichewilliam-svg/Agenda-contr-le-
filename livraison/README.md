# 🛵 HOP! Livraison · הופ! משלוחים — « Et hop, c'est livré ! »

Application web de livraison pour Netanya, le Sharon et Tel Aviv. Elle fonctionne sur téléphone et ordinateur et s'installe comme une application.

- **Côté clients :** en français et en hébreu.
- **Côté patron et livreurs :** en français.

## Les pages

| Page | Pour qui | Adresse (après mise en ligne) |
|---|---|---|
| Commande et suivi | Clients | `https://hop-livraison.vercel.app/` |
| Espace patron | Vous | `…/livraison/admin.html` |
| Espace livreur | Livreurs partenaires | `…/livraison/coursier.html` |
| Kit de lancement | Vous | `…/livraison/kit.html` |
| Commerces partenaires | Restaurants, boutiques… | `…/livraison/commerce.html` |

### Clients (`index.html`, `suivi.html`, `recu.html`)
- **Accueil façon appli** : une carte en grand avec les **livreurs en ligne autour** (petits scooters, position arrondie à ≈ 500 m, sans nom) et le temps pour qu'un livreur arrive au départ. Par-dessus, le panneau **« Où on livre ? »** : départ et arrivée (avec 📍 ma position et ⇅ pour inverser), adresses enregistrées en un geste, raccourcis d'heure (**Maintenant · Dans 1 h · Ce soir · Demain matin**, seulement quand c'est possible), **« Qu'est-ce qu'on livre ? »** (poste, Super-Pharm, repas, documents…), **🔁 Refaire la dernière course**, et le prix tout de suite. « Continuer » mène droit à ce qui manque dans le formulaire.
- **Trouver une enseigne et son adresse** : en tapant « Super-Pharm », « poste »… l'agence la plus proche du client sort en premier, avec son adresse complète et la distance ; les **commerces partenaires HOP** (vérifiés) sortent toujours en tête (⭐ Partenaire HOP) et la course leur est rattachée (bonus du parrain). Le panneau **« 🏪 Enseignes près de vous »** liste par catégorie (⭐ Partenaires HOP, 💊 Pharmacies, 📮 Poste et relais, 🛒 Supermarchés, 🍔 Restaurants, 🛍️ Centres commerciaux, 💐 Fleuristes, 📱 Téléphonie) les enseignes autour du client, de la plus proche à la plus loin, avec « 📍 Récupérer ici » ou « 🏁 Livrer ici ». Choisir « Colis à la poste » ou « Super-Pharm » ouvre directement la liste des agences proches. Données OpenStreetMap (Overpass, gratuit), gardées 7 jours sur le téléphone ; une adresse manquante est complétée par la carte au moment du choix.
- **« HOP! » en grand** et une pluie d'emojis quand la commande part, puis à la livraison.
- **Note de la livraison** : après la livraison, le client donne de 1 à 5 étoiles, choisit des petits mots (⚡ Rapide, 😊 Sympa, ⏰ En retard…) et peut laisser un mot au livreur. Une note de 3 ou moins (ou un mot) arrive tout de suite dans la conversation de la course, chez vous. Le livreur voit sa note moyenne et les mots des clients dans ses statistiques ; vous la voyez sur chaque course et sur chaque livreur.
- **Adresses vérifiées sur la carte** : le client tape une adresse ou une enseigne (Super-Pharm, restaurant, poste…) et choisit dans les suggestions ; la ville se remplit seule, le nom de l'enseigne apparaît sur la course et Waze guide au point GPS exact (recherche gratuite Photon / OpenStreetMap).
- **Prix honnête, affiché partout** (accueil, récapitulatif, FAQ, visuels, textes) : **un colis, un document : 25 ₪ dans Netanya, prix fixe** ; **quand HOP fait les courses : le prix réel du magasin (ticket) + 25 ₪ de livraison**. **0 frais de service, 0 frais de petite commande, 0 prix gonflé** : le récapitulatif l'écrit noir sur blanc (« Frais de service 0 ₪ », « Frais de petite commande 0 ₪ »). Plus de supplément fixe pour la poste, Super-Pharm ou les achats (`pricing.pickupPoint` et `pricing.purchase` à 0) : seul le temps sur place au-delà de 10 min est payé (voir plus bas).
- **Prix fixe affiché tout de suite.** Les prix depuis Netanya sont fixés à la main dans `config.js` : 25 ₪ en ville, 80 ₪ pour Ra'anana, 85 ₪ pour Herzliya, 120 ₪ pour Tel Aviv… Pour les autres trajets : 25 ₪ + 3,5 ₪ par km.
- **9 exemples cliquables** (poste, Super-Pharm, restaurant, Yad2, documents…) et **« Pourquoi nous plutôt qu'une grande plateforme ? »**.
- **Commande immédiate, express ou programmée** au jour et à l'heure près. Si vous êtes complet ou ne pouvez pas prendre une course, le client est prévenu, avec la raison dans sa langue.
- **Paiement en espèces ou par Bit.** Un numéro de commande est affiché partout.
- **Suivi en direct** sur la carte. Le client peut **écrire ou téléphoner directement à son livreur** ou **au service client** (vous).
- **Messagerie dans l'application** (« 💬 Nous écrire ») sur chaque page : aucun échange par WhatsApp.
- **Bulle ronde du temps restant** : pendant une course, une bulle reste ouverte avec les minutes restantes (en haut du panneau sur l'accueil, en bas de l'écran ailleurs) ; en la touchant, le client voit le scooter avancer sur la carte. Après la livraison, elle invite à noter la course.
- **Reçu (קבלה)** bilingue, numéroté, imprimable, et **envoyé automatiquement par mail** (voir `email/README-mail.md`).
- **Offres :** codes promo, parrainage, carte de fidélité.

### Vous (`admin.html`)
- **Carte « En direct »** : tous les livreurs en service, chaque point de récupération (🍔 restaurant, 📮 poste, 🛒 achat, 📦 colis) et de livraison (🏁), le trajet restant et l'étape de chaque course avec le temps estimé.
- **Courses :** agenda, alertes, « Je la prends », « Donner à un livreur », « 🚫 Je ne peux pas » (raison envoyée au client), « Je suis complet ».
- **Sur la route :** mode « En ligne » avec position GPS, encaissé / à encaisser, messages dans la langue du client, itinéraire, reçus.
- **Onglet Livreurs :** validation des inscriptions, date du permis (en rouge si expiré), assurance déclarée, suspension.
- **Onglet Paiements de la semaine :** commission de chaque livreur, message récapitulatif, « ✓ Réglé ».
- **Facturation mensuelle** par client, avec export CSV.

### Livreurs partenaires (`coursier.html`) : une vraie appli de livreur
- **Carte plein écran** (sombre ou claire) avec votre position, les courses disponibles (avec leur prix) et votre course en cours.
- **Panneau du bas** : la demande en direct (« C'est calme », « Ça roule », « 🔥 Ça vaut le coup de sortir »), la course en cours, les courses disponibles, « Gagnez plus ».
- **En ligne / hors ligne :** on glisse le bouton « HOP! » jusqu'au bout pour passer en ligne (impossible par erreur). Hors ligne, le livreur ne reçoit aucune course, ni fenêtre ni son. L'appli se souvient de l'état et reprend en ligne toute seule après un rechargement.
- **Refuser une course :** « ✖ Refuser » dans la fenêtre de la course (40 s pour répondre). Elle passe tout de suite au livreur suivant. Le taux d'acceptation s'affiche dans les statistiques.
- **Prévisions de demande** (Zones et demande) : les commandes heure par heure des 4 dernières semaines pour le même jour, pour savoir quand sortir.
- **Menu** : Mes courses, Courses disponibles, Zones et demande, Finances, Statistiques, Gagner plus, Engagements et assurance, Assistance HOP!, Réglages (Waze ou Google Maps, mode de déplacement, apparence, son), Centre d'aide.
- **🔔** : les annonces de HOP et la conversation avec HOP.

- **Inscription :** coordonnées, véhicule, permis, numéro d'עוסק, photo du top case, et **10 engagements à cocher** (permis valide, **déclaration d'assurance** (pas d'attestation demandée), **HOP n'est pas responsable** des accidents, dommages ou pertes, statut d’indépendant, responsabilité des colis et de l’argent, « Livré » validé seulement sur place, sécurité, commission hebdomadaire…). Le bouton « Livré » vérifie la position GPS : à plus de 200 m de l’adresse (`platform.deliverRadius`), la livraison est refusée.
- **Fenêtre « Nouvelle course ! »** avec une **sonnerie douce qui revient toutes les 2,5 s, de plus en plus fort, et fait vibrer le téléphone jusqu'à ce que le livreur accepte, refuse ou laisse passer la course** (elle s'arrête aussi si un autre livreur la prend), dès qu'une course arrive : montant, gain net, trajet, kilomètres, distance jusqu'au point de récupération, puis « J'accepte », « Plus tard » ou « ✖ Refuser ».
- **Après votre validation :** courses disponibles (le premier qui accepte la prend), ses courses, GPS, encaissement, « Je ne peux plus ».
- **Onglet « Ma semaine » :** courses, encaissé, commission à verser par Bit une fois par semaine.

### Commerces partenaires et parrainage (`commerce.html`)
- **Le livreur amène un commerce** : onglet « 🤝 Parrainage » de son espace (son code, son lien, son QR code, un message prêt à envoyer en hébreu et en français).
- **Le commerce s'inscrit gratuitement** (FR/HE) et reçoit son espace : bouton « Commander une course » avec le départ déjà rempli, lien et affiche QR pour ses clients, historique de ses courses.
- **Le parrain paie seulement 8 % de commission** (`platform.networkPercent`, au moins 2 ₪) sur les courses de ses commerces qu'il livre lui-même, et **gagne 2 ₪** (`partners.bonusPerDelivery`) quand un autre livreur les fait, **tant qu'il reste actif** : après 3 semaines sans aucune livraison (`partners.activeDays`), ses bonus s'arrêtent jusqu'à sa prochaine livraison. Le bonus est déduit de sa commission chaque semaine.
- **Le parrain a 3 minutes d'avance** (`partners.priorityMinutes`) : les autres livreurs voient ces courses après lui.
- Niveaux (🌱 → 👑) et classement des parrains du mois.
- Côté patron : onglet « 🏪 Commerces » (vérifier, suspendre, changer le parrain, envoyer ses liens au commerce).

### Messagerie dans l'application (aucun dialogue par WhatsApp)
- **Client :** bouton « 💬 Nous écrire » sur toutes les pages → la conversation de sa course (lui, son livreur et vous) ou le service client. Texte et photos (réduites automatiquement). Les étapes de la course (acceptée, récupérée, livrée, refusée) s'affichent toutes seules dans la conversation.
- **Livreur :** « 💬 Client » sur chaque course, « 📷 Photo du dépôt », « 💬 Écrire à HOP » (documents d'inscription en photo, « J'ai payé mon solde »…).
- **Commerce :** bouton « Nous écrire » de son espace pro (achat de carnet, questions). Le reçu du carnet lui arrive ici.
- **Vous :** onglet « 💬 Messagerie » (toutes les conversations, messages non lus, son et alerte), et un bouton « 💬 » sur chaque course, livreur, commerce et demande de devis.
- Le message de refus d'une course (avec la raison, dans la langue du client) part tout seul dans sa conversation.

### Argent : tout est carré
- **Qui encaisse :** le livreur n'encaisse **que les espèces**. Le **Bit va toujours à HOP** (052-779-0361), comme les courses programmées et les carnets pro : vous reversez ces courses au livreur dans la semaine.
- **Commission :** 15 % du prix sur les courses que l'appli apporte, au minimum 3,50 ₪ (25 ₪ → 4 ₪, 100 ₪ → 15 ₪) ; **8 % (au moins 2 ₪) sur les courses du réseau du livreur** (commerces qu'il a amenés). Arrondie au demi-shekel, calculée sur la valeur de la course (prix + code promo, payé par HOP + part du commerce Pro). Réglage : `commission_pct`, `commission_min`, `network_pct`, `network_min` dans `settings` (et `platform.*` dans `config.js` pour le mode démo).
- **Refus de courses :** à chaque refus, le livreur choisit la raison en un geste (trop loin, pas assez payé, trop gros, occupé, fin de service, autre ; « sans réponse » si les 40 s passent). Après **3 refus d'affilée** (`platform.declineStreakMax`, en ligne `settings.decline_streak_max`), il passe **hors ligne tout seul**, voit pourquoi et peut repasser en ligne ou expliquer à HOP dans la messagerie (un message apparaît aussi dans sa conversation avec le patron). Le compteur repart à zéro dès qu'il accepte une course ou repasse en ligne. Le patron voit pour chaque livreur ses refus des 30 jours, son taux d'acceptation et les raisons (en orange sous 60 %).
- **Codes promo payés par HOP :** le livreur est payé comme si le client avait payé le prix complet.
- **Pourboires :** après la livraison, le client choisit 5, 10 ou 15 ₪ (`platform.tips`) et les paie par Bit à HOP. Le patron touche « ✅ Pourboire reçu » quand le Bit arrive, et le pourboire est reversé en entier au livreur avec son solde.
- **Chaque semaine :** le livreur vous doit ses commissions, moins les courses payées à HOP (vous les lui reversez) et moins ses bonus de parrainage. « ✓ Réglé » remet le compteur à zéro.
- **Plafond :** au-delà de `platform.maxDebt` (50 ₪) dus, le livreur ne peut plus accepter de course tant qu'il n'a pas réglé.
- Sur une course, le bouton « Payée au livreur ⇄ Payée à HOP » corrige le cas d'un client qui a payé le mauvais numéro.

### HOP! Pro : l'abonnement des commerces (moins cher qu'une grande plateforme, des deux côtés)
- **Le commerce paie un abonnement fixe** (`pro.monthly` = 199 ₪ / mois, sans engagement, premier mois offert) **et 0 % de commission sur ses ventes**. Il ajoute une part fixe à chaque livraison (`pro.shopShare` = 12 ₪, dont `pro.hopShare` = 2 ₪ pour HOP) : **le client ne paie que 15 ₪ de livraison dans Netanya**, sans frais de service, et le livreur touche toujours sa course complète (25 ₪ − commission). Le patron enregistre chaque mois payé (« ⭐ +1 mois payé ») : **20 % pour le livreur qui a amené le commerce**, ses 12 premiers mois (`pro.referrerPercent`, `pro.referrerMonths`). En ligne : `pro_monthly`, `pro_shop_share`, `pro_hop_share`, `pro_lead_min`, `pro_referrer_pct`, `pro_referrer_months` dans `settings`.
- **Le client commande depuis la page du commerce** (son QR / son lien `?c=CODE`) : il écrit sa commande (« 2 shawarma, 1 Coca ») ; il paie ses articles directement au commerce.
- **Le commerce reçoit la commande avec une sonnerie** dans son espace pro, l'accepte avec un temps de préparation (10, 15, 20 ou 30 min) ou la refuse (la raison part au client), puis appuie sur **« ✅ Commande prête »**.
- **Le livreur est envoyé au bon moment** : la course est proposée `pro.leadMinutes` (8 min) avant l'heure annoncée, pour qu'il arrive quand c'est prêt. Il voit « 🍳 Prête dans 5 min », la commande et la part payée par le commerce (HOP la lui reverse).
- **Pas prêt à l'heure ?** L'attente du livreur ne compte qu'à partir de l'heure annoncée, et **c'est le commerce qui la paie**, pas le client.
- Le client suit tout en direct (« Shawarma Nona prépare votre commande · prête dans ≈ 12 min », puis « ✅ prête »).
- **Vous** : dans l'onglet Commerces, « ⭐ HOP! Pro : +1 mois » (payé ou offert) ou « Arrêter », et ce que chaque commerce vous doit ce mois-ci (abonnement + sa part des livraisons). Le commerce voit la même facture dans son espace pro.

### Catalogue HOP! Pro (produits en ligne)
- Dans son espace, le commerce Pro a **🛍️ Mon catalogue** : un bouton crée les **catégories proposées** selon son type (Entrées, Plats, Desserts, Boissons pour un restaurant…), qu'il renomme comme il veut ; puis il ajoute ses **produits** (nom, prix, photo, description) et les passe **✅ Disponible / ⛔ Épuisé** d'un geste.
- Le client qui commande chez lui choisit par catégorie avec **+ / −**, voit son total d'articles (**à régler directement au commerce**, le livreur n'avance rien) et peut ajouter une précision.
- La base reprend toujours **les prix et les noms du catalogue** (jamais ceux envoyés par le téléphone) et refuse les produits épuisés. Le commerce reçoit une **liste à cocher** au moment de préparer, avec le total des articles.

### Commande prête ou attente : un prix juste
- **Commande prête : prix fixe**, affiché avant de commander.
- **Le livreur doit attendre** (commande pas prête) **ou faire les achats** : au point de récupération, il appuie sur **« 📍 Je suis arrivé »** (seulement sur place, vérifié au GPS) ; le compteur démarre. **10 min offertes**, puis **+5 ₪ par tranche de 10 min commencée**, **60 ₪ au maximum** (`pricing.waiting` dans `config.js`, `wait_free_min`, `wait_step_min`, `wait_step_price`, `wait_max` dans la table `settings` en ligne).
- À « Colis récupéré », le supplément est ajouté au prix de la course et **versé en entier au livreur** (la commission HOP ne change pas). Le client le voit en direct sur son suivi (« arrivé au départ, sur place depuis 12 min ») puis dans le montant à payer ; la course reste à régler si elle était déjà payée (Bit, carnet). Vous le voyez sur la course (« ⏱️ Attente 27 min · +10 ₪ »).

### Inscription des livreurs : photo du top case
- **Photo du top case obligatoire** (la caisse sur le scooter) pour s'inscrire. Un livreur déjà inscrit sans photo la voit demandée sur sa page d'attente. Vous l'ouvrez en grand depuis sa fiche (« 📷 Voir le top case ») ; valider un livreur sans photo demande une confirmation.

### Qui reçoit la course
Seuls les livreurs en ligne reçoivent des courses. Le livreur en ligne le plus proche du départ la reçoit en premier, le 2e plus proche après 45 s (`platform.waveSeconds`), puis tous les autres après 90 s. Pour une course d'un commerce partenaire, son parrain passe d'abord (3 min). Côté patron, « Donner à un livreur » classe les livreurs du plus proche au plus loin.

### Espace pro et carnet
L'espace du commerce (`commerce.html`) montre le tarif pro (25 ₪ dans Netanya) et le carnet de 10 courses (200 ₪). Le commerce paie par Bit, puis vous cliquez « 🎟️ Carnet payé » dans l'onglet « 🏪 Commerces » : les 10 courses sont ajoutées et un **reçu (קבלה) numéroté** est créé (même numérotation que vos autres reçus) et envoyé au commerce dans sa messagerie ; il le retrouve aussi dans son espace pro. Il choisit ensuite « Carnet pro » au paiement : rien à payer au livreur. Un commerce déjà inscrit (même téléphone ou même nom dans la même ville) ne peut pas se réinscrire.

### Messages aux livreurs
Onglet « 📣 Messages livreurs » : « 🔥 Ça vaut le coup de sortir ! » et d'autres messages prêts, à tous ou à un seul livreur. Le message s'ouvre en grand chez eux, avec un son, et ils répondent « J'arrive » ou « Pas dispo ».

### Adresses
- En touchant « Récupérer à » ou « Livrer à », la liste propose tout de suite **📍 Ma position** et les **adresses enregistrées**. **📍 Ma position** remplit l'adresse depuis le GPS du téléphone (aussi en raccourci sur l'accueil), et **⭐ Enregistrer cette adresse** l'ajoute au carnet du client en **🏠 Maison**, **💼 Travail** ou sous un nom choisi (« Maman »…). Ces adresses passent en premier dans les raccourcis. Dans **Mes courses → Mon compte**, **✏️ Modifier** change le nom (Maison, Travail, autre) et les détails pour le livreur (étage, appartement, code, remarque) ; le carnet s'affiche dès la première adresse enregistrée.
- **Enseignes :** « Golda », « Super-Pharm »… donnent d'abord l'agence la plus proche du client (si la carte n'en trouve aucune à moins de 4 km, on cherche le nom sur OpenStreetMap autour de lui).
- Avant chaque commande, le client **vérifie ses adresses sur une carte** et peut faire glisser l'épingle au bon endroit, par exemple s'il commande pour une autre adresse que la sienne.

### Déposer devant la porte, blocages et déblocages
- **Devant la porte :** le livreur doit envoyer la photo du colis dans la conversation **et** être sur place pour valider « Livré ».
- **Une course à la fois :** tant qu'une course récupérée n'est pas validée, le livreur ne peut pas en prendre une autre.
- **⚠️ Un souci :** le livreur signale un problème (client absent, adresse introuvable, retard, panne…). Il s'affiche sur la course, dans la conversation, et vous recevez une alerte.
- **Vous débloquez tout :** « 🔓 Débloquer la course » (livrer sans GPS ni photo) ou « 🔓 Débloquer 24 h » sur un livreur (plus aucun blocage pendant 24 h).

### Commande passée par téléphone (commerce pas sur HOP!)
- Repas, ou départ d'une enseigne : le client coche **« 📞 J'ai déjà commandé par téléphone »**, donne le **nom de la commande** (et le n° s'il en a un), **dans combien de temps c'est prêt** (déjà prête, 10 à 60 min) et confirme que **c'est déjà payé au commerce** (sinon : « J'achète pour vous »).
- La course n'est proposée aux livreurs que **quelques minutes avant l'heure « prête »** (`pro_lead_min`, 8 min), avec une notification à ce moment-là : le livreur arrive quand c'est prêt, pas avant. Il voit « 📞 Commande au nom de David · n° 57 · prête à 20:45 ».
- **Attente** comptée à partir de l'heure « prête » : 10 min offertes, puis payée par le client. **Si la commande n'existe pas ou a été annulée, la course reste due** (écrit au client avant de commander).

- **Le vrai numéro de l'enseigne** (carte OpenStreetMap) s'affiche avec un bouton **📞 Appeler** ; la commande en cours reste enregistrée sur le téléphone pendant l'appel (2 h), même si HOP! se ferme.
- **Colis à récupérer (poste, Super-Pharm, point relais, casier) : tout est reçu avant d'envoyer un livreur.** Le client doit donner le n° du colis, le nom inscrit dessus (ou le code du casier) et les photos demandées selon le lieu : avis/SMS ; carte d'identité de la personne au nom du colis ; à la poste en plus la procuration signée (ייפוי כוח), le **rendez-vous à la poste** (date et heure, obligatoire) et sa capture d'écran. La course part à l'heure du rendez-vous. Elle reste **📄 à vérifier** : le patron voit les photos (« voir »), puis **✅ Documents OK** (la course part aux livreurs, 40 min avant le rendez-vous à la poste) ou **✉️ Il manque…** (le client reçoit le message et ajoute la photo depuis son suivi). Le livreur de la course retrouve les photos à montrer au guichet (« 📄 Documents à montrer »). Seuls le patron et ce livreur voient les photos ; elles sont effacées 3 jours après la fin de la course (`order_docs`, `purge_order_docs`, tâche `hop-purge-docs`).
- **Autres cas, chacun avec sa justification** (vérifiée aussi par la base) :
  - **médicament sur ordonnance** (« J'achète pour vous ») : photos de la carte d'identité du patient et de l'ordonnance, vérifiées par le patron avant d'envoyer un livreur (`rx`) ;
  - **dépôt d'un colis à la poste** : rendez-vous obligatoire et envoi déjà payé (photos du rendez-vous et de l'étiquette ou du reçu) ; le livreur part 30 min avant le rendez-vous et n'avance rien (`post_send`, `post_appt`) ;
  - **vente entre particuliers** (Yad2, Marketplace) : l'acheteur a déjà payé le vendeur ; le livreur n'encaisse jamais le prix de l'objet (`p2p_sale`, `sale_paid`) ;
  - **clés ou objet de valeur** : un code de remise à 4 chiffres, sur le suivi du client ; le livreur le demande au destinataire avant « Livré » (5 essais, la base refuse sinon ; le livreur ne voit jamais le code : `order_secrets`, `courier_handoff`).
- **Vitrine HOP! Pro** : dans son espace, le commerce abonné met son **logo**, une **photo de couverture** et une **phrase d'accroche** (« 🎨 Ma vitrine », avec l'aperçu de ce que voient les clients). Les commerces abonnés sont mis en avant sur l'accueil (« ⭐ Nos partenaires » : photo, logo, livraison à 15 ₪, nombre de produits). En commandant chez eux, le client voit leur en-tête (photo, logo, accroche) et le **menu par rubriques** : grande photo, description, prix, bouton « + » sur la photo, panier en bas (`shops.logo`, `shops.cover`, `shops.tagline`, `shop_brand_save`, `shops_showcase`).
- **Sans contact** : le type de lieu, le **code d'entrée** (sauf maison) et le **n° d'appartement** sont obligatoires, sinon le livreur ne peut pas arriver jusqu'à la porte (refus par la base : `door_kind`, `door_code`).
- **Courses (« J'achète pour vous »)** : tout doit tenir dans le **top case du scooter** (40 × 40 × 35 cm, 15 kg) : le client le coche obligatoirement (`fits_topcase`), avec un rappel pour les supermarchés (Rami Levy, Shufersal…) : petites courses seulement.
- **Le livreur arrive directement dans son espace** : connecté sur son téléphone, l'accueil HOP! (site ou appli client) l'emmène tout de suite sur son espace livreur. Le logo de l'espace livreur ramène à l'accueil client pour cette visite (`?client=1`), par exemple pour commander comme client.
- **Aucune avance d'argent par le livreur** : commande par téléphone déjà payée au commerce ; chez un commerce HOP! Pro, les articles se règlent directement au commerce. **« J'achète pour vous »** : le client coche obligatoirement « Je règle le magasin moi-même » (paiement par téléphone, Bit du magasin ou déjà payé en ligne) ; à la caisse, le livreur l'appelle depuis l'appli. La base refuse la commande sinon (`goods_pay_required`, colonne `goods_self_pay`).

### Message aux clients
Onglet « 📣 Annonces livreurs et clients » : **🎁 Message aux clients** (promo, annonce), à tous les clients du dernier mois, des 3 derniers mois ou de l'année. Il arrive dans leur conversation « service client » (pastille sur la bulle 💬).

### Prix dans Netanya : zones industrielles
Dans Netanya : 25 ₪. **Entre la ville et une zone industrielle (ancienne ou nouvelle), dans les deux sens, ou d'une zone à l'autre : 30 ₪** (`pricing.areas` dans `config.js` : le prix et les rectangles des zones, à vérifier et ajuster).

### Sonnerie du patron
Tant qu'une commande attend un livreur, **ça sonne toutes les 3 s** avec un bandeau orange « 🔔 Commande à prendre » (**Voir** / **🔕 Couper** : coupe pour les commandes déjà là, pas pour les suivantes).

### Paiement Bit
- Le client qui choisit Bit **paie tout de suite** depuis l'écran « Commande envoyée » ou le suivi : montant, numéro, n° de commande, bouton **Ouvrir Bit** (Android), **Copier le numéro** et **✅ J'ai payé**. Vous voyez « 💳 Le client dit avoir payé par Bit · à vérifier » et vous recevez une alerte : vérifiez votre Bit, puis marquez la course payée.
- **Trompé de moyen de paiement ?** Sur le suivi, « Je préfère payer par Bit / en espèces » tant que rien n'est payé ; le livreur est prévenu dans la conversation.

### Notifications push (même quand HOP! est fermé)
- Patron : nouvelle commande, course remise en attente, message d'un client / commerce / livreur, paiement Bit à vérifier. Livreurs en service : nouvelle course qu'ils peuvent prendre, message du patron ou du client.
- Il suffit d'**autoriser les alertes** (« 🔔 Activer les alertes », ou « Passer en service »). Sur iPhone, seulement avec HOP! **sur l'écran d'accueil**.
- Fonctionnement : la base appelle la fonction Supabase `hop-push` (`supabase/functions/hop-push`) ; les clés sont dans la table `push_config` (invisible depuis l'application ; la clé publique est aussi dans `config.js`, `push.publicKey`).

### Trois applis, trois icônes
Client (orange), **HOP! Livreur** (bleue « LIVREUR ») et **HOP! Patron** (noire « PATRON »). Sur le site, l'appli client est à **/app/**, l'espace livreur à **/livreur/** et l'espace patron à **/patron/** (`vercel.json`, et `config.js` renvoie chaque page à la bonne adresse) : chaque appli s'installe à part sur Android. Depuis l'appli client, le bouton **🛵** en haut ouvre l'espace livreur. Le livreur a un bouton « 📲 Mettre HOP! Livreur sur l'écran d'accueil », le patron « 📲 Installer HOP! Patron ». Le patron et les livreurs ont aussi « Mot de passe oublié ? » sous la connexion.

### Zones
Seulement le Sharon est ouvert (`zones` dans `config.js`). Tel Aviv – Gush Dan, Petah Tikva et Rishon apparaissent « bientôt » chez les clients et dans l'écran « 📍 Zones » des livreurs, qui montre aussi la demande en direct. Mettez `active: true` pour ouvrir une zone.

### Gros colis (voiture)
Pas encore de voiture : l'option « Gros colis » est cachée. Pour l'ouvrir, mettez `pricing.carAvailable: true` dans `config.js` (les prix voiture du Sharon sont déjà dans `fixedCarFromHome`).

## 1. Personnaliser — `config.js`

| Réglage | À quoi ça sert |
|---|---|
| `whatsapp`, `phoneDisplay`, `bitPhone` | **Vos numéros** (WhatsApp au format `972501234567`) |
| `business` | Vos informations légales pour les reçus (עוסק פטור) |
| `pricing.fixedFromHome` | **Prix depuis/vers Netanya, ville par ville** |
| `pricing.base`, `perKm` | Prix des autres trajets (entre deux autres villes) |
| `platform.commissionPercent`, `commissionPerCourse` | Votre commission : 15 % du prix, minimum 3,50 ₪ |
| `platform.networkPercent`, `networkMin` | Commission sur les courses du réseau du livreur : 8 %, minimum 2 ₪ |
| `hours`, `cities`, `promos` | Horaires, villes, offres |
| `demoAdminPin` | Code de l'espace patron en mode démo : **changez-le** |

⚠️ `config.js` est public : n'y mettez rien de secret.

Après chaque modification d'un fichier, lancez `./bump-version.sh` : il change le numéro de version des fichiers pour que les téléphones rechargent tout d'un coup (sinon un ancien fichier gardé en cache peut casser la page).

## 2. Mode démo ou mode en ligne

**Ce site est en mode en ligne** : il est branché sur le projet Supabase « hop-livraison » (`config.js`), et la base est installée. Les étapes ci-dessous servent pour une nouvelle installation (par exemple pour un autre groupe de livraison).

**Mode démo (`supabase.url` vide) :** tout est enregistré sur le téléphone. Le client vous envoie sa commande par WhatsApp. Le suivi à distance et les livreurs partenaires ne fonctionnent pas entre plusieurs téléphones.

**Mode en ligne (Supabase, gratuit) :** indispensable pour le suivi en direct, les livreurs et les reçus par mail.

1. Créez un compte sur [supabase.com](https://supabase.com), puis un projet.
2. **SQL Editor** : collez `supabase-schema.sql`, puis **Run**.
3. **Authentication → Users → Add user** : créez **votre** compte (email + mot de passe).
4. De nouveau dans **SQL Editor**, lancez le petit bloc indiqué à la fin de `supabase-schema.sql`, avec votre email, votre nom et votre téléphone. Il fait de votre compte le compte patron.
5. **Authentication → Sign In / Providers** : laissez **Allow new users to sign up** activé, pour que les livreurs puissent s'inscrire. Ils n'ont accès à rien tant que vous ne les avez pas validés.
6. **Project Settings → API** : copiez l'URL et la clé **anon public** dans `config.js` (`supabase.url`, `supabase.anonKey`).
7. Reçus par mail : suivez `email/README-mail.md`.

## 3. Conseils

- Installez l'espace patron sur votre téléphone (« Ajouter à l'écran d'accueil ») et activez les alertes 🔔.
- En tournée, passez en ligne et **gardez l'écran allumé, page ouverte** : les téléphones coupent le GPS en arrière-plan.
- Faites relire par un avocat ou un comptable :
  - les engagements des livreurs (statut d'indépendant, assurance de transport de marchandises, responsabilité en cas de perte) ;
  - le format de vos reçus.

## Fichiers

```
livraison/
├── index.html / client.js     # Clients : accueil, exemples, pourquoi nous, offres, commande, mes courses
├── suivi.html / suivi.js      # Suivi en direct (carte Leaflet + OpenStreetMap)
├── recu.html / recu.js        # Reçu (קבלה) bilingue imprimable
├── admin.html / admin.js      # Espace patron
├── coursier.html / coursier.js# Espace livreur partenaire
├── kit.html / kit.js          # Kit de lancement (stratégie, messages FR/HE, QR, flyer)
├── commerce.html / commerce.js# Commerces partenaires : inscription, espace, QR clients
├── config.js                  # ← vos réglages
├── i18n.js                    # Textes français / hébreu
├── pricing.js                 # Prix, horaires, distances, temps estimé
├── store.js                   # Données (appareil ou Supabase)
├── common.js                  # Formatage, liens, messages partagés
├── styles.css · logo.svg · manifest.webmanifest
├── supabase-schema.sql        # Base de données + règles de sécurité + reçus
└── email/                     # Envoi automatique des reçus depuis Gmail
```
