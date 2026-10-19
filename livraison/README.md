# 🛵 HOP! Livraison · הופ! משלוחים — « Et hop, c'est livré ! »

Application web de livraison façon Wolt pour Netanya, le Sharon et Tel Aviv. Elle fonctionne sur téléphone et ordinateur et s'installe comme une application.

- **Côté clients :** en français et en hébreu.
- **Côté patron et livreurs :** en français.

## Les pages

| Page | Pour qui | Adresse (après mise en ligne) |
|---|---|---|
| Commande et suivi | Clients | `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/` |
| Espace patron | Vous | `…/livraison/admin.html` |
| Espace livreur | Livreurs partenaires | `…/livraison/coursier.html` |
| Kit de lancement | Vous | `…/livraison/kit.html` |

### Clients (`index.html`, `suivi.html`, `recu.html`)
- **Prix fixe affiché tout de suite.** Les prix depuis Netanya sont fixés à la main dans `config.js` : 25 ₪ en ville, 65 ₪ pour Ra'anana, 90 ₪ pour Tel Aviv…
- **9 exemples cliquables** (poste, Super-Pharm, restaurant, Yad2, documents…) et **« Pourquoi nous plutôt qu'une grande plateforme ? »**.
- **Commande immédiate, express ou programmée** au jour et à l'heure près. Si vous êtes complet ou ne pouvez pas prendre une course, le client est prévenu, avec la raison dans sa langue.
- **Paiement en espèces ou par Bit.** Un numéro de commande est affiché partout.
- **Suivi en direct** sur la carte, avec le nom et le WhatsApp du livreur.
- **Bouton WhatsApp** sur chaque page pour vous écrire directement.
- **Reçu (קבלה)** bilingue, numéroté, imprimable, et **envoyé automatiquement par mail** (voir `email/README-mail.md`).
- **Offres :** codes promo, parrainage, carte de fidélité.

### Vous (`admin.html`)
- **Courses :** agenda, alertes, « Je la prends », « Donner à un livreur », « 🚫 Je ne peux pas » (raison envoyée au client), « Je suis complet ».
- **Sur la route :** mode « En service » avec position GPS, encaissé / à encaisser, messages WhatsApp dans la langue du client, itinéraire, reçus.
- **Onglet Livreurs :** validation des inscriptions, dates du permis et de l'assurance (en rouge si expirées), suspension.
- **Onglet Paiements de la semaine :** commission de chaque livreur, message récapitulatif, « ✓ Réglé ».
- **Facturation mensuelle** par client, avec export CSV.

### Livreurs partenaires (`coursier.html`)
- **Inscription :** coordonnées, véhicule, permis, assurance, numéro d'עוסק, et **8 engagements à cocher** (permis valide, assurance, statut d'indépendant, responsabilité des colis et de l'argent, sécurité, commission hebdomadaire…).
- **Après votre validation :** courses disponibles (le premier qui accepte la prend), ses courses, GPS, encaissement, « Je ne peux plus ».
- **Onglet « Ma semaine » :** courses, encaissé, commission à verser par Bit une fois par semaine (`platform.commissionPerCourse` = 3 ₪ par course dans `config.js`).

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
├── config.js                  # ← vos réglages
├── i18n.js                    # Textes français / hébreu
├── pricing.js                 # Prix, horaires, distances, temps estimé
├── store.js                   # Données (appareil ou Supabase)
├── common.js                  # Formatage, liens, messages partagés
├── styles.css · logo.svg · manifest.webmanifest
├── supabase-schema.sql        # Base de données + règles de sécurité + reçus
└── email/                     # Envoi automatique des reçus depuis Gmail
```
