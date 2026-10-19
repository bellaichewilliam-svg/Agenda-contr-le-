# 🛵 Coursier Express · שליח אקספרס — application de livraison

Application web bilingue **français / hébreu** (fonctionne sur téléphone et ordinateur, installable comme une app), pensée comme un « Wolt des courses » pour Netanya, le Sharon et Tel Aviv.

**Pour les clients (particuliers, commerces, restaurants)**
- Prix fixe affiché tout de suite, de ville à ville (ex. 25 ₪ dans Netanya, 65 ₪ Netanya → Tel Aviv).
- 9 exemples à toucher qui remplissent le formulaire : poste, Super-Pharm, restaurant, documents, Yad2, clés oubliées, « j'achète pour vous », fleurs, Netanya → Tel Aviv.
- 4 services : envoyer un colis, récupérer un colis (poste / Super-Pharm / point relais), acheter pour moi, repas de restaurant.
- Dès que possible, express (< 1 h) ou programmé à l'heure choisie.
- Paiement **espèces ou Bit**, par le client ou par le destinataire.
- **Suivi en direct sur la carte** (position du coursier, temps d'arrivée estimé), lien de suivi à envoyer au destinataire.
- Codes promo (BIENVENUE / BRUCHIM -50 % la 1re course, NETANYA -5 ₪), parrainage (code AMI + 4 chiffres), carte de fidélité (10e course offerte).

**Pour vous, le coursier (`admin.html`)**
- Alerte sonore et notification à chaque commande, agenda jour par jour.
- Bouton **« En service »** : votre téléphone envoie sa position GPS toutes les 15 s, vos clients vous voient sur la carte.
- Accepter / récupéré / livré, **message WhatsApp déjà rédigé dans la langue du client**, lien de suivi pour le destinataire.
- Toutes les infos : procuration, n° de suivi, liste d'achats et budget, mode de paiement, code promo, Waze / Google Maps.
- Encaissé / à encaisser, **itinéraire de la tournée** dans Google Maps, export agenda (.ics), facturation mensuelle par client + CSV.

**Pour vous faire connaître (`kit.html`)** : stratégie des 30 premiers jours, prix de lancement, messages prêts à copier en français et en hébreu (groupes Facebook/WhatsApp, commerçants, poste, Google), QR code et **flyer bilingue imprimable**.

## Adresses

Une fois la branche fusionnée sur `main`, GitHub Pages publie :

- Page clients : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/`
- Espace coursier : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/admin.html`
- Kit de lancement : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/kit.html`

C'est le lien de la page clients que vous envoyez à vos entreprises (WhatsApp, carte de visite, QR code…).

## 1. Personnaliser (5 minutes)

Tout se règle dans **`config.js`** :

| Réglage | À quoi ça sert |
|---|---|
| `businessName`, `businessNameHe`, `phoneDisplay` | Votre nom commercial (français / hébreu) et votre téléphone |
| `whatsapp` | **Votre numéro WhatsApp** (ex. `972501234567`) |
| `bitPhone` | Le numéro sur lequel vos clients paient avec Bit |
| `hours`, `minLeadMinutes` | Horaires par jour (`null` = fermé) et délai minimum |
| `cities`, `homeCity` | Villes desservies (ajoutez-en avec leurs coordonnées) |
| `pricing` | `base` + `perKm` × distance, arrondi à 5 ₪, et les suppléments |
| `promos` | Codes promo, parrainage, fidélité, offres professionnelles |

## 2. Deux modes de fonctionnement

### Mode démo (par défaut, rien à installer)

Les commandes sont enregistrées sur le téléphone du client et **vous sont envoyées par WhatsApp** (bouton après validation). Le suivi en direct et les changements de statut ne fonctionnent pas à distance dans ce mode. Code de l'espace coursier : `demoAdminPin` dans `config.js` (changez-le).

### Mode en ligne (recommandé, gratuit) — avec Supabase

**Indispensable pour le suivi en direct façon Wolt.** Les commandes arrivent directement dans votre espace, et les clients voient sur la carte où vous êtes et quand vous acceptez, récupérez et livrez.

1. Créez un compte sur [supabase.com](https://supabase.com) puis un projet (offre gratuite).
2. Dans **SQL Editor**, collez le contenu de `supabase-schema.sql` et cliquez sur **Run**.
3. Dans **Authentication → Users**, cliquez sur **Add user** et créez votre compte coursier (email + mot de passe).
4. Dans **Authentication → Sign In / Providers**, désactivez **Allow new users to sign up** (personne d'autre ne pourra créer de compte coursier).
5. Dans **Project Settings → API**, copiez l'**URL du projet** et la clé **anon public** dans `config.js` :

```js
supabase: {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJhbGciOi..."
},
```

La clé « anon » peut être publique : les règles de sécurité (`supabase-schema.sql`) n'autorisent les clients qu'à créer des commandes et à voir les leurs. Seul votre compte coursier voit et modifie tout.

## 3. Conseils d'utilisation

- Sur votre téléphone, ouvrez l'espace coursier puis « Ajouter à l'écran d'accueil » : il s'ouvre comme une application.
- Touchez **🔔 Activer les alertes**, et gardez l'onglet ouvert pour recevoir les nouvelles commandes.
- Pendant une tournée, touchez **Passer en service** et **gardez l'écran allumé, page ouverte** : les navigateurs coupent le GPS quand l'écran s'éteint ou qu'on change d'application. L'app essaie de garder l'écran allumé automatiquement.
- Parrainage : quand un nouveau client utilise le code AMI d'un ami, offrez aussi la réduction au parrain sur sa course suivante avec **✏️ Prix**.
- Les codes promo sont vérifiés sur le téléphone du client : vous voyez toujours le code utilisé sur la course et pouvez corriger le prix.

## Fichiers

```
livraison/
├── index.html / client.js  # Page clients : accueil, exemples, offres, commande, mes courses
├── suivi.html / suivi.js   # Suivi en direct (carte OpenStreetMap + Leaflet)
├── admin.html / admin.js   # Espace coursier
├── kit.html / kit.js       # Kit de lancement : stratégie, messages FR/HE, QR, flyer
├── config.js               # ← vos réglages
├── i18n.js                 # Textes français / hébreu
├── pricing.js              # Prix, horaires, distances, temps estimé
├── store.js                # Enregistrement (appareil ou Supabase)
├── common.js               # Formatage et liens partagés
├── styles.css
├── manifest.webmanifest
└── supabase-schema.sql     # Base de données + règles de sécurité
```
