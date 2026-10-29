# HOP! sur Google Play — emballage TWA (Trusted Web Activity)

Ce dossier contient les deux projets Android qui « emballent » la PWA HOP! pour Google Play,
générés avec [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (`@bubblewrap/cli` 1.23.0).
Une TWA n'embarque aucun code : l'appli Android ouvre le site `https://hop-livraison.vercel.app`
en plein écran dans Chrome. Toute mise à jour du site est donc visible immédiatement, sans republier
sur le Play Store (sauf changement d'icône, de nom, de couleurs ou de version Android).

| Appli            | Dossier    | Package Android      | URL de démarrage                          | Manifest web                                              |
|------------------|------------|----------------------|-------------------------------------------|-----------------------------------------------------------|
| **HOP!** (clients) | `client/`  | `il.co.hop.livraison` | `https://hop-livraison.vercel.app/app/`     | `https://hop-livraison.vercel.app/manifest.webmanifest`     |
| **HOP! Livreur**   | `livreur/` | `il.co.hop.livreur`   | `https://hop-livraison.vercel.app/livreur/` | `https://hop-livraison.vercel.app/manifest-coursier.webmanifest` |

Le code de l'appli web (`index.html`, `coursier.js`, manifests…) n'a **pas** été modifié.

---

## 1. Ce qui est prêt

- `client/twa-manifest.json` et `livreur/twa-manifest.json` : la configuration Bubblewrap complète
  (package, nom, couleurs tirées des manifests web, `display: standalone`, orientation portrait,
  notifications activées, `fallbackType: customtabs`, `minSdkVersion: 21`).
- Les projets Android eux-mêmes (`app/`, Gradle, icônes à toutes les densités) ne sont **pas** dans le
  dépôt : ils se régénèrent à l'identique avec `bubblewrap update` dans `client/` puis `livreur/`
  (la génération a été vérifiée). Seul `store_icon.png` (512×512, pour la fiche Play) est gardé.
- `assetlinks.example.json` : modèle du fichier Digital Asset Links, avec les empreintes des
  **clés de TEST** (voir § 4 — à remplacer par l'empreinte de production).
- `.gitignore` : exclut les sorties de build, les keystores et `node_modules/`.

### Vérification des manifests web (faite, rien à corriger)

| Clé                | `manifest.webmanifest` (client)       | `manifest-coursier.webmanifest` (livreur) |
|--------------------|---------------------------------------|-------------------------------------------|
| `id`               | `hop-client`                          | `hop-livreur`                             |
| `start_url` / `scope` | `/app/` / `/app/`                  | `/livreur/` / `/livreur/`                 |
| `display`          | `standalone`                          | `standalone`                              |
| `theme_color`      | `#FFFFFF`                             | `#0F1F3D`                                 |
| `background_color` | `#0F1F3D`                             | `#0F1F3D`                                 |
| Icônes PNG         | `icon-192.png` 192×192, `icon-512.png` 512×512 (RGB) | `icon-livreur-192.png` 192×192, `icon-livreur-512.png` 512×512 (RGBA) |
| Icône SVG          | `logo.svg`                            | `logo-livreur.svg`                        |
| `shortcuts`        | aucun                                 | aucun                                     |

Tous les fichiers d'icônes existent sur le disque aux tailles annoncées. Aucune icône n'est déclarée
`purpose: "maskable"` : ce n'est **pas bloquant** pour Google Play, mais sur Android 8+ l'icône sera
affichée réduite dans la forme du lanceur. Si on veut une icône « pleine forme », il faudra fournir
plus tard une version avec marge de sécurité (le logo dans un cercle de 80 % du carré — l'icône
livreur actuelle, avec son bandeau « LIVREUR » collé au bord, serait rognée) et l'indiquer dans
`maskableIconUrl` du `twa-manifest.json`, puis relancer `bubblewrap update`.

## 2. Ce qui a bloqué ici (construction)

La génération des projets a réussi, mais la compilation (`bubblewrap build`) n'a pas pu être faite
dans cet environnement : le proxy réseau refuse le téléchargement du SDK Android.

```
$ curl https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
curl: (56) CONNECT tunnel failed, response 403
[agent-proxy] dl.google.com:443 — connect_rejected (gateway answered 403 to CONNECT)

$ bubblewrap build
cli ERROR The provided androidSdk isn't correct.
```

(Le JDK 17 a pu être installé par apt, et `services.gradle.org` / `maven.google.com` répondent ;
seul `dl.google.com`, source des `build-tools;36.1.0` et de `platforms;android-36`, est bloqué.)
Donc **aucun `.aab` / `.apk` n'a été produit ici** : la compilation se fait sur un poste normal
(voir § 3), elle prend quelques minutes.

## 3. Construire les deux applis (sur un PC/Mac avec Internet)

Prérequis : Node.js 18+ et `npm`. Bubblewrap télécharge lui-même un JDK 17 et le SDK Android
(~1 Go) lors du premier lancement, dans `~/.bubblewrap/`.

```bash
npm install -g @bubblewrap/cli
# Vérifie JDK + SDK (répondre « oui » aux propositions d'installation)
bubblewrap doctor
```

### 3.1 Clé de signature

Chaque appli doit être signée. **Ne jamais mettre un keystore dans le dépôt git** (le `.gitignore`
les exclut, mais ne pas les copier dans `android/` quand même).

- Clés de **test** (mot de passe `hoptest123`, alias `hop-client` / `hop-livreur`) générées ici dans
  le scratchpad de la session, hors du dépôt :
  `/tmp/claude-0/-home-user-Agenda-contr-le-/3271f45e-38cc-5064-9960-b5b1618e61f0/scratchpad/android-keys/hop-client-test.keystore`
  et `.../android-keys/hop-livreur-test.keystore`. Elles ne servent qu'à des essais locaux.
- Clé de **production** (une par appli, à conserver précieusement, hors git, avec sauvegarde) :

```bash
# Dans android/client/ (le twa-manifest.json attend ./android.keystore, alias hop-client)
keytool -genkeypair -v -keystore android.keystore -alias hop-client \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=HOP Livraison, O=HOP, C=IL"
# Dans android/livreur/ : même commande avec -alias hop-livreur
```

Si vous utilisez un autre chemin/alias, modifiez `signingKey.path` / `signingKey.alias` dans
`twa-manifest.json`.

### 3.2 Compilation

```bash
cd android/client     # puis pareil dans android/livreur
bubblewrap build      # demande les mots de passe du keystore et de la clé
```

Bubblewrap propose de relancer `update` si `twa-manifest.json` a changé (répondre oui).
Sorties attendues dans le dossier :

- `app-release-bundle.aab` → **à envoyer sur Google Play** (format obligatoire).
- `app-release-signed.apk` → pour installer directement sur un téléphone de test
  (`adb install app-release-signed.apk`).

### 3.3 Nouvelle version Android (changement d'icône, de couleur, de nom…)

1. Modifier `twa-manifest.json` (ou laisser Bubblewrap relire le manifest web avec `bubblewrap merge`).
2. Incrémenter `appVersionCode` (entier, +1 à chaque envoi sur Play) et `appVersion` (ex. `1.0.1`).
3. `bubblewrap update` puis `bubblewrap build`.

Les projets générés (`app/`, `build.gradle`, `gradlew`…) sont régénérés par `update` ; ils sont
versionnés pour être lisibles, mais la source de vérité est `twa-manifest.json`.

## 4. Digital Asset Links (indispensable : sinon une barre d'adresse Chrome reste affichée)

Android vérifie que le site autorise l'appli à l'afficher en plein écran grâce au fichier
`https://hop-livraison.vercel.app/.well-known/assetlinks.json`.

1. Récupérer l'empreinte SHA-256 du certificat **qui signe réellement l'APK installé** :
   - si **Play App Signing** est activé (choix par défaut et recommandé dans la Play Console) :
     Play Console → votre appli → *Configuration* → *Intégrité de l'application* →
     *Certificat de clé de signature d'application* → « Empreinte du certificat SHA-256 ».
     C'est **cette** empreinte qu'il faut publier, pas celle de la clé locale d'envoi (upload key).
   - pour un APK signé localement (tests avec `adb install`) : `bubblewrap fingerprint list`
     ou `keytool -list -v -keystore android.keystore -alias hop-client`.
   On peut lister plusieurs empreintes dans `sha256_cert_fingerprints` (clé Play + clé locale).
2. Copier `android/assetlinks.example.json` vers `livraison/.well-known/assetlinks.json`
   (créer le dossier `.well-known/` à la racine du site, à côté de `index.html`) et remplacer
   les empreintes de test par les vraies. Le fichier contient déjà les deux packages
   (`il.co.hop.livraison` et `il.co.hop.livreur`) : un seul fichier pour les deux applis.
3. Déployer (git push → Vercel). Vercel sert les `.json` statiques avec
   `Content-Type: application/json`, et les réécritures de `vercel.json` ne touchent pas
   `/.well-known/…`, donc en principe rien à changer. Si jamais la vérification échoue à cause du
   type MIME, ajouter dans `vercel.json` (clé `headers`, à côté de `redirects` / `rewrites`) :

   ```json
   "headers": [
     {
       "source": "/.well-known/assetlinks.json",
       "headers": [{ "key": "Content-Type", "value": "application/json" }]
     }
   ]
   ```

4. Vérifier : ouvrir `https://hop-livraison.vercel.app/.well-known/assetlinks.json` dans un
   navigateur, puis tester avec l'outil Google « Statement List Generator and Tester »
   (https://developers.google.com/digital-asset-links/tools/generator) ou
   `bubblewrap validate --url=https://hop-livraison.vercel.app/app/`.

Empreintes des **clés de test** générées ici (valables uniquement pour les keystores du scratchpad) :

- `il.co.hop.livraison` : `42:9D:3D:E7:21:B8:F8:57:13:0C:5D:CD:A4:86:68:D9:4C:F1:C6:2C:92:9A:10:5D:DB:2A:E8:E1:C4:99:EC:0A`
- `il.co.hop.livreur` : `EF:22:E7:BD:E4:C8:45:48:F0:7E:53:12:D8:12:42:E8:F6:E4:D6:E2:C4:C9:05:BF:ED:01:26:6B:7C:F0:61:1F`

## 5. Ce qu'il reste à faire côté patron (Google Play)

1. **Compte développeur Google Play Console** : https://play.google.com/console — frais uniques
   de 25 $ US, vérification d'identité (pièce d'identité, et pour un compte « organisation » un
   numéro D-U-N-S). Compter quelques jours pour la validation.
2. **Créer deux applications** dans la console : « HOP! » (`il.co.hop.livraison`) et
   « HOP! Livreur » (`il.co.hop.livreur`). Le nom de package est définitif une fois publié.
3. **Signature** : accepter *Play App Signing* à l'envoi du premier `.aab`, puis récupérer
   l'empreinte SHA-256 (§ 4) et publier `assetlinks.json` **avant** de tester, sinon l'appli
   s'ouvre avec la barre d'adresse Chrome.
4. **Fiche Play Store** pour chaque appli : titre (30 caractères max), description courte (80) et
   longue (4000), icône 512×512 (`store_icon.png` fourni dans chaque dossier), image de présentation
   1024×500, au moins 2 captures d'écran de téléphone (16:9 ou 9:16, 320 à 3840 px), catégorie,
   e-mail de contact, **URL de politique de confidentialité** (obligatoire ; l'appli livreur
   demande la géolocalisation, il faut l'expliquer dans la politique et dans le formulaire
   « Sécurité des données »).
5. **Questionnaires obligatoires** : classification du contenu, public cible (13 ans et plus
   suffit), sécurité des données (données collectées : position, identifiants, numéro de téléphone,
   adresses de livraison…), publicités (non), applis gouvernementales (non).
6. **Test interne puis test fermé** : envoyer le `.aab` dans *Tests* → *Test interne* (jusqu'à
   100 testeurs par e-mail, disponible en quelques minutes). **Si le compte développeur est un
   compte personnel créé après novembre 2023, Google impose avant la production un test fermé
   avec au moins 12 testeurs inscrits en continu pendant 14 jours**, puis une demande d'accès à
   la production (formulaire). Un compte « organisation » n'a pas cette obligation.
7. **Production** : passer l'appli en production ; la revue Google prend en général de quelques
   heures à quelques jours. Chaque nouvelle version Android = nouveau `appVersionCode` (§ 3.3).

## 6. Fichiers de ce dossier

```
android/
├── README.md                    ← ce fichier
├── .gitignore                   ← build/, *.keystore, *.jks, *.aab, *.apk, node_modules/…
├── assetlinks.example.json      ← modèle pour livraison/.well-known/assetlinks.json
├── client/
│   ├── twa-manifest.json        ← configuration Bubblewrap de « HOP! » (source de vérité)
│   ├── manifest-checksum.txt    ← empreinte du twa-manifest (gérée par Bubblewrap)
│   ├── store_icon.png           ← icône 512×512 pour la fiche Play
│   ├── app/, build.gradle, settings.gradle, gradle/, gradlew… ← projet Android généré
│   └── (android.keystore, app-release-bundle.aab, app-release-signed.apk : générés, non versionnés)
└── livreur/                     ← idem pour « HOP! Livreur »
```
