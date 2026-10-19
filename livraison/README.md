# 🛵 Coursier Express — application de commande de courses

Application web (fonctionne sur téléphone et ordinateur, installable comme une app) qui permet à vos clients professionnels de :

- **commander une course** (récupérer à une adresse → livrer à une autre) ;
- **demander le retrait d'un colis à la poste** (n° de suivi, nom sur l'avis, procuration) ;
- **programmer** la course à un jour et une heure précis, ou en **express** ;
- **voir le prix immédiatement**, calculé selon la distance par la route et les options ;
- **suivre** l'état de leurs courses (nouvelle → confirmée → récupérée → livrée).

Et à vous, le livreur, de :

- recevoir chaque commande (WhatsApp + tableau de bord avec alerte sonore/notification) ;
- voir votre **agenda** de courses jour par jour, avec liens **Waze / Google Maps** et appel en un clic ;
- changer le statut et **prévenir le client sur WhatsApp** avec un message déjà rédigé ;
- ajuster un prix, laisser un message au client, exporter les courses dans votre agenda (.ics) ;
- obtenir la **facturation du mois par entreprise** (+ export CSV pour la comptabilité).

## Adresses

Une fois la branche fusionnée sur `main`, GitHub Pages publie :

- Page clients : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/`
- Espace livreur : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/admin.html`

C'est le lien de la page clients que vous envoyez à vos entreprises (WhatsApp, carte de visite, QR code…).

## 1. Personnaliser (5 minutes)

Tout se règle dans **`config.js`** :

| Réglage | À quoi ça sert |
|---|---|
| `businessName`, `slogan`, `phoneDisplay`, `email` | Votre nom commercial et vos coordonnées |
| `whatsapp` | **Votre numéro WhatsApp** (ex. `972501234567`) : les commandes y arrivent |
| `hours` | Vos horaires par jour (`null` = fermé) |
| `minLeadMinutes` | Délai minimum pour réserver |
| `pricing` | Prise en charge, prix au km, suppléments (taille, poste, express, aller-retour, arrêts) |
| `currency` | Monnaie affichée |

## 2. Deux modes de fonctionnement

### Mode démo (par défaut, rien à installer)

Les commandes sont enregistrées sur le téléphone du client et **vous sont envoyées par WhatsApp** (bouton après validation). Le client voit ses courses mais ne voit pas les changements de statut, puisque vous n'avez pas accès à son appareil. Code de l'espace livreur : `demoAdminPin` dans `config.js`.

### Mode en ligne (recommandé, gratuit) — avec Supabase

Les commandes arrivent directement dans votre tableau de bord, et les clients voient en direct quand vous confirmez, récupérez et livrez.

1. Créez un compte sur [supabase.com](https://supabase.com) puis un projet (offre gratuite).
2. Dans **SQL Editor**, collez le contenu de `supabase-schema.sql` et cliquez sur **Run**.
3. Dans **Authentication → Users**, cliquez sur **Add user** et créez votre compte livreur (email + mot de passe).
4. Dans **Authentication → Sign In / Providers**, désactivez **Allow new users to sign up** (personne d'autre ne pourra créer de compte livreur).
5. Dans **Project Settings → API**, copiez l'**URL du projet** et la clé **anon public** dans `config.js` :

```js
supabase: {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJhbGciOi..."
},
```

La clé « anon » peut être publique : les règles de sécurité (`supabase-schema.sql`) n'autorisent les clients qu'à créer des commandes et à voir les leurs. Seul votre compte livreur voit et modifie tout.

## 3. Conseils d'utilisation

- Sur votre téléphone, ouvrez l'espace livreur puis « Ajouter à l'écran d'accueil » : il s'ouvre comme une application.
- Cliquez sur **🔔 Activer les alertes** pour être averti des nouvelles commandes (l'onglet doit rester ouvert).
- Le prix affiché au client est ferme quand la distance a pu être calculée. Si une adresse est introuvable, le client voit « dès … » et vous pouvez ajuster le prix avec **✏️ Prix**.

## Fichiers

```
livraison/
├── index.html            # Page clients : présentation, tarifs, commande, suivi
├── admin.html            # Espace livreur
├── config.js             # ← vos réglages
├── pricing.js            # Calcul du prix, horaires, distance (OpenStreetMap)
├── store.js              # Enregistrement des commandes (appareil ou Supabase)
├── common.js             # Affichage partagé (cartes de course, liens WhatsApp/Waze)
├── client.js / admin.js  # Logique des deux pages
├── styles.css
├── manifest.webmanifest  # Installation comme application
└── supabase-schema.sql   # Base de données (mode en ligne)
```

La distance est calculée gratuitement avec OpenStreetMap (Nominatim + OSRM), sans clé d'API.
