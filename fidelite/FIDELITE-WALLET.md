# Carte fidélité Wallet : le dossier (projet séparé de HOP!)

## Les liens
- **Présentation (pour les commerçants)** : https://carte-fidelite-wallet.vercel.app/
- **Exemple à montrer : ta carte HOP!** : https://carte-fidelite-wallet.vercel.app/carte.html?c=c123e923-89f3-4fd8-a736-6dcf3a00b440
- **Ton espace commerçant « HOP! » (secret, ne pas partager)** : https://carte-fidelite-wallet.vercel.app/pro.html?k=e8a1f9e1-09d9-48ef-a178-3f46396a57eb
- **Page d'inscription des clients HOP!** (ce que montre le QR code) : https://carte-fidelite-wallet.vercel.app/carte.html?s=HOPDEMO
- Un nouveau commerçant crée sa carte lui-même : https://carte-fidelite-wallet.vercel.app/pro.html

## Séparé de HOP!
- Dossier `fidelite/` du dépôt, site Vercel à part (`carte-fidelite-wallet`), mis en ligne par envoi de fichiers : un changement dans HOP! ne touche pas ce site, et inversement.
- Base : tables `fid_shops`, `fid_cards`, `fid_events`, `fid_apple_devices` (aucun lien avec les tables de HOP!). Même projet Supabase, mais rien de partagé.
- Fonction serveur `fid-wallet` (Google + Apple + images des tampons). Tâche du matin `fid-daily` (7 h 17 UTC : anniversaires, relances).

## Ce qui manque : les clés Google et Apple
Elles se collent dans **Supabase → Edge Functions → Secrets** (jamais dans l'appli, jamais dans le chat).
Vérifier : https://qwabzgmlpkazzvwhzfki.supabase.co/functions/v1/fid-wallet → `{"google":true,"apple":true}`.
Tant qu'elles ne sont pas là, tout marche dans le navigateur (carte, tampons, parrainage, QR…), seul le bouton « Ajouter au Wallet » est grisé.

### A. Google Wallet (tu as le compte)
1. pay.google.com/business/console → **Google Wallet API** → noter l'**Issuer ID**.
2. console.cloud.google.com (même compte) : créer un projet → **API et services → Bibliothèque** → « Google Wallet API » → **Activer**.
3. **IAM → Comptes de service → Créer** (`fidelite-wallet`, aucun rôle) → le compte → **Clés → Ajouter une clé → JSON** (un fichier se télécharge).
4. Console Wallet → **Utilisateurs → Inviter** l'adresse du compte de service (`…iam.gserviceaccount.com`), rôle **Développeur**.
5. Supabase → Secrets : `GOOGLE_WALLET_ISSUER_ID` = l'Issuer ID ; `GOOGLE_WALLET_SA_JSON` = tout le contenu du fichier JSON.
6. Console Wallet → **demander l'accès Production** (nom, site `carte-fidelite-wallet.vercel.app`, une capture de la carte). Avant ça, seuls les comptes « testeurs » ajoutés dans la console peuvent enregistrer la carte : ajoute ton Gmail comme testeur pour essayer tout de suite.

### B. Apple Wallet (iPhone)
Il faut un **compte Apple Developer** : 99 $ / an.
1. developer.apple.com/programs → **Enroll** (identifiant Apple avec double authentification). En particulier : 1–2 jours. En société : numéro D-U-N-S gratuit, ~1 semaine.
2. developer.apple.com/account → **Membership** : noter le **Team ID** (10 caractères).
3. **Certificates, IDs & Profiles → Identifiers → +** → **Pass Type IDs** → description « Carte fidélité », identifiant `pass.com.cartefidelite.wallet` → Register.
4. **Le certificat** (sans Mac, je le fais avec toi) : je te prépare une demande de certificat (`.csr`) ; dans ton Pass Type ID → **Create Certificate** → tu envoies le `.csr` → tu télécharges `pass.cer` et tu me le donnes (ce n'est pas secret). Je le convertis.
5. Télécharger le certificat intermédiaire Apple **WWDR G4** (apple.com/certificateauthority).
6. Supabase → Secrets : `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`, `APPLE_WWDR_PEM`.
7. Pas de validation Apple à attendre. Le certificat dure 1 an : à renouveler chaque année.

## Ce que le client a dans sa carte
1. **Sa carte dans le téléphone** (Google Wallet sur Android, Apple Wallet sur iPhone) : nom et logo du commerce, ses couleurs, les tampons dessinés (petites icônes : café, pizza, fleur…), le cadeau doré au bout.
2. **Le QR code** à montrer au comptoir : le commerçant le scanne (ou tape les 4 derniers chiffres du téléphone) et ajoute le tampon.
3. **Les notifications** sur l'écran verrouillé : « Nouveau tampon ! », « Ton cadeau t'attend 🎁 », messages du commerce (une promo, au plus une fois par jour).
4. **Le rappel quand il passe devant** (environ 100 mètres) : « Tu es tout près ! Ton tampon t'attend 👋 ». La distance exacte est choisie par Apple / Google ; le commerçant enregistre sa position en un clic dans son espace.
5. **Son anniversaire** : un cadeau le jour J (s'il a donné sa date).
6. **La relance** s'il ne vient plus (après 30 jours par défaut, réglable) : « Ça fait un moment… ».
7. **Parrainage** : il envoie sa carte à un ami par WhatsApp ; l'ami a sa carte, lui gagne un tampon.
8. **Avis Google** : un bouton pour laisser des étoiles.
9. **Contacter le commerce** : appeler, WhatsApp, itinéraire, Instagram, site.
10. **Français ou hébreu**, au choix.
Sans le Wallet (avant les clés), la même carte existe en page web (lien gardé sur le téléphone).

## À décider (argent)
- **Le prix de l'offre pour les commerces** (rien n'est affiché pour l'instant, pas de « jours offerts »). Dis-moi le tarif et je l'ajoute au site et à la vidéo.
