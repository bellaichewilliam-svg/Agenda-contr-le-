# 🛵 HOP! Livraison · הופ! משלוחים — « Et hop, c'est livré ! »

Application web de livraison pour Netanya, le Sharon et Tel Aviv. Elle fonctionne sur téléphone et ordinateur et s'installe comme une application.

- **Côté clients :** en français et en hébreu.
- **Côté patron et livreurs :** en français.

## Les pages

| Page | Pour qui | Adresse (après mise en ligne) |
|---|---|---|
| Commande et suivi | Clients | `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/` |
| Espace patron | Vous | `…/livraison/admin.html` |
| Espace livreur | Livreurs partenaires | `…/livraison/coursier.html` |
| Kit de lancement | Vous | `…/livraison/kit.html` |
| Commerces partenaires | Restaurants, boutiques… | `…/livraison/commerce.html` |

### Clients (`index.html`, `suivi.html`, `recu.html`)
- **Adresses vérifiées sur la carte** : le client tape une adresse ou une enseigne (Super-Pharm, restaurant, poste…) et choisit dans les suggestions ; la ville se remplit seule, le nom de l'enseigne apparaît sur la course et Waze guide au point GPS exact (recherche gratuite Photon / OpenStreetMap).
- **Prix fixe affiché tout de suite.** Les prix depuis Netanya sont fixés à la main dans `config.js` : 25 ₪ en ville, 80 ₪ pour Ra'anana, 85 ₪ pour Herzliya, 120 ₪ pour Tel Aviv… Pour les autres trajets : 25 ₪ + 3,5 ₪ par km.
- **9 exemples cliquables** (poste, Super-Pharm, restaurant, Yad2, documents…) et **« Pourquoi nous plutôt qu'une grande plateforme ? »**.
- **Commande immédiate, express ou programmée** au jour et à l'heure près. Si vous êtes complet ou ne pouvez pas prendre une course, le client est prévenu, avec la raison dans sa langue.
- **Paiement en espèces ou par Bit.** Un numéro de commande est affiché partout.
- **Suivi en direct** sur la carte. Le client peut **écrire ou téléphoner directement à son livreur** ou **au service client** (vous).
- **Bouton WhatsApp** sur chaque page pour vous écrire directement.
- **Reçu (קבלה)** bilingue, numéroté, imprimable, et **envoyé automatiquement par mail** (voir `email/README-mail.md`).
- **Offres :** codes promo, parrainage, carte de fidélité.

### Vous (`admin.html`)
- **Carte « En direct »** : tous les livreurs en service, chaque point de récupération (🍔 restaurant, 📮 poste, 🛒 achat, 📦 colis) et de livraison (🏁), le trajet restant et l'étape de chaque course avec le temps estimé.
- **Courses :** agenda, alertes, « Je la prends », « Donner à un livreur », « 🚫 Je ne peux pas » (raison envoyée au client), « Je suis complet ».
- **Sur la route :** mode « En service » avec position GPS, encaissé / à encaisser, messages WhatsApp dans la langue du client, itinéraire, reçus.
- **Onglet Livreurs :** validation des inscriptions, dates du permis et de l'assurance (en rouge si expirées), suspension.
- **Onglet Paiements de la semaine :** commission de chaque livreur, message récapitulatif, « ✓ Réglé ».
- **Facturation mensuelle** par client, avec export CSV.

### Livreurs partenaires (`coursier.html`) : une vraie appli de livreur
- **Carte plein écran** (sombre ou claire) avec votre position, les courses disponibles (avec leur prix) et votre course en cours.
- **Panneau du bas** : la demande en direct (« C'est calme », « Ça roule », « 🔥 Ça vaut le coup de sortir »), la course en cours, les courses disponibles, « Gagnez plus ».
- **Glisser pour passer en service** (impossible de se connecter par erreur).
- **Menu** : Mes courses, Courses disponibles, Zones et demande, Finances, Statistiques, Gagner plus, Engagements et assurance, Assistance HOP!, Réglages (Waze ou Google Maps, mode de déplacement, apparence, son), Centre d'aide.
- **🔔** : les annonces de HOP et la conversation avec HOP.

- **Inscription :** coordonnées, véhicule, permis, assurance, numéro d'עוסק, et **9 engagements à cocher** (permis valide, assurance, statut d’indépendant, responsabilité des colis et de l’argent, « Livré » validé seulement sur place, sécurité, commission hebdomadaire…). Le bouton « Livré » vérifie la position GPS : à plus de 200 m de l’adresse (`platform.deliverRadius`), la livraison est refusée.
- **Fenêtre « Nouvelle course ! »** avec un son, dès qu'une course arrive : montant, gain net, trajet, kilomètres, distance jusqu'au point de récupération, puis « J'accepte » ou « Plus tard ».
- **Après votre validation :** courses disponibles (le premier qui accepte la prend), ses courses, GPS, encaissement, « Je ne peux plus ».
- **Onglet « Ma semaine » :** courses, encaissé, commission à verser par Bit une fois par semaine (`platform.commissionPerCourse` = 3 ₪ par course dans `config.js`).

### Commerces partenaires et parrainage (`commerce.html`)
- **Le livreur amène un commerce** : onglet « 🤝 Parrainage » de son espace (son code, son lien, son QR code, un message prêt à envoyer en hébreu et en français).
- **Le commerce s'inscrit gratuitement** (FR/HE) et reçoit son espace : bouton « Commander une course » avec le départ déjà rempli, lien et affiche QR pour ses clients, historique de ses courses.
- **Le parrain gagne 1 ₪** (`partners.bonusPerDelivery`) sur chaque course livrée au départ de ses commerces, même si un autre livreur la fait, **tant qu'il reste actif** : après 3 semaines sans aucune livraison (`partners.activeDays`), ses bonus s'arrêtent jusqu'à sa prochaine livraison. Le bonus est déduit de sa commission chaque semaine.
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
- **Chaque semaine :** le livreur vous doit ses commissions (3 ₪ par course), moins les courses payées à HOP (vous les lui reversez) et moins ses bonus de parrainage. « ✓ Réglé » remet le compteur à zéro.
- **Plafond :** au-delà de `platform.maxDebt` (50 ₪) dus, le livreur ne peut plus accepter de course tant qu'il n'a pas réglé.
- Sur une course, le bouton « Payée au livreur ⇄ Payée à HOP » corrige le cas d'un client qui a payé le mauvais numéro.

### Qui reçoit la course
Le livreur en service le plus proche du départ la reçoit en premier, le 2e plus proche après 45 s (`platform.waveSeconds`), puis tous les autres après 90 s. Pour une course d'un commerce partenaire, son parrain passe d'abord (3 min). Côté patron, « Donner à un livreur » classe les livreurs du plus proche au plus loin.

### Espace pro et carnet
L'espace du commerce (`commerce.html`) montre le tarif pro (25 ₪ dans Netanya) et le carnet de 10 courses (200 ₪). Le commerce paie par Bit, puis vous cliquez « 🎟️ Carnet payé » dans l'onglet « 🏪 Commerces » : les 10 courses sont ajoutées et un **reçu (קבלה) numéroté** est créé (même numérotation que vos autres reçus) et envoyé au commerce dans sa messagerie ; il le retrouve aussi dans son espace pro. Il choisit ensuite « Carnet pro » au paiement : rien à payer au livreur. Un commerce déjà inscrit (même téléphone ou même nom dans la même ville) ne peut pas se réinscrire.

### Messages aux livreurs
Onglet « 📣 Messages livreurs » : « 🔥 Ça vaut le coup de sortir ! » et d'autres messages prêts, à tous ou à un seul livreur. Le message s'ouvre en grand chez eux, avec un son, et ils répondent « J'arrive » ou « Pas dispo ».

### Adresses
- **📍 Ma position** remplit l'adresse depuis le GPS du téléphone, et **⭐ Enregistrer cette adresse** l'ajoute au carnet du client.
- Avant chaque commande, le client **vérifie ses adresses sur une carte** et peut faire glisser l'épingle au bon endroit, par exemple s'il commande pour une autre adresse que la sienne.

### Déposer devant la porte, blocages et déblocages
- **Devant la porte :** le livreur doit envoyer la photo du colis dans la conversation **et** être sur place pour valider « Livré ».
- **Une course à la fois :** tant qu'une course récupérée n'est pas validée, le livreur ne peut pas en prendre une autre.
- **⚠️ Un souci :** le livreur signale un problème (client absent, adresse introuvable, retard, panne…). Il s'affiche sur la course, dans la conversation, et vous recevez une alerte.
- **Vous débloquez tout :** « 🔓 Débloquer la course » (livrer sans GPS ni photo) ou « 🔓 Débloquer 24 h » sur un livreur (plus aucun blocage pendant 24 h).

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
| `platform.commissionPerCourse` | Votre commission par course de livreur |
| `hours`, `cities`, `promos` | Horaires, villes, offres |
| `demoAdminPin` | Code de l'espace patron en mode démo : **changez-le** |

⚠️ `config.js` est public : n'y mettez rien de secret.

Après chaque modification d'un fichier, lancez `./bump-version.sh` : il change le numéro de version des fichiers pour que les téléphones rechargent tout d'un coup (sinon un ancien fichier gardé en cache peut casser la page).

## 2. Mode démo ou mode en ligne

**Mode démo (par défaut) :** tout est enregistré sur le téléphone. Le client vous envoie sa commande par WhatsApp. Le suivi à distance et les livreurs partenaires ne fonctionnent pas entre plusieurs téléphones.

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
- En tournée, « Passer en service » et **gardez l'écran allumé, page ouverte** : les téléphones coupent le GPS en arrière-plan.
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
