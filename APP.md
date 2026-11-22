# HOP! Livraison : le dossier de l'appli (à relire à chaque démarrage)

> Résumé de tout ce qui existe, pour reprendre vite sans relire l'historique.
> Les règles du patron (langue, marque, interdits, argent, mises en ligne) sont dans `CLAUDE.md` : elles priment.
> Tenir ce fichier à jour (200–300 lignes max) quand une grosse fonction arrive ou change.

## 1. En deux mots
- **HOP!** livre à **Netanya** (zone « HaSharon » active ; Tel Aviv, Petah Tikva, Rishon prêtes mais inactives).
- On livre tout : colis, courses au supermarché (boutiques HOP!), restos, pharmacie, pressing, retrait de colis, poste, documents.
- 4 applis web (PWA installables), FR + HE : **client** (`index.html`), **livreur** (`coursier.html`), **patron** (`admin.html`), **commerce** (`commerce.html`).
- Le patron s'appelle Will (compte « Will » = **admin** qui livre aussi lui-même : `couriers.role = 'admin'`, ne pas modifier ce compte).

## 2. Où est quoi (dossier `livraison/`)
| Fichier | Rôle |
|---|---|
| `client.js` (~10 000 l.) | Appli client : vitrine, magasins, panier, « Ma commande », course libre, Hoppy voix, compte, promos, mes courses |
| `coursier.js` (~3 600 l.) | Appli livreur : carte + panneau, courses dispo, Mes courses, fiche d'arrêt, tournée, finances, crédit |
| `admin.js` (~3 600 l.) | Panneau patron : courses, livreurs, commerces, clients, paniers, promos, réglages, rayons, kit pub, stats |
| `commerce.js` / `.html` | Espace commerce (lien `?k=TOKEN`) : commandes, catalogue, horaires, « Envoyer une course à un client » |
| `suivi.js` / `.html` | Suivi client en direct (`suivi.html?t=TOKEN`, `&shop=1` = vue du commerce) : carte, étapes, paiement, chat, photo |
| `store.js` | Toutes les données : REST/RPC Supabase (`ONLINE`) ou mode démo local (localStorage) |
| `common.js` (`UI.*`) | Outils partagés : prix affichés, liens WhatsApp (`UI.waPersonal`), cartes Leaflet, photos, ETA, messages |
| `i18n.js` | Tous les textes FR/HE (`I18N.t`, `I18N.forLang`) ; `coursier-lang.js` + `coursier-he-dict.js` = hébreu livreur |
| `pricing.js` | Calcul des prix (`Pricing.computeQuote`) |
| `config.js` | Config publique (zones, prix, téléphones, URL Supabase + clé publique). **Aucun secret.** |
| `rayons.js`, `enseignes.js`, `places.js` | Rayons (produits HOP!), enseignes connues, recherche d'adresses/lieux |
| `chat.js` | Fenêtre de chat (fils `o:<id commande>`, `shop:…`, service client) |
| `kit.js` / `kit.html` | Kit pub (visuels, vidéos Remotion, campagnes, générateur par commerce) |
| `recu.html/js`, `bienvenue.html`, `on-livre.html`, `badge.*`, `autocollant.html` | Reçus, accueil nouveau client, page « on livre », badge livreur, autocollant QR caisse |
| `styles.css` | Tout le style ; couches `html.d3` (design clair en vigueur), `html.d2` (ancien bleu nuit), `d3-sp` (espace commerce) |
| `sw.js` | Service worker (cache + notifications push) |
| `supabase/*.sql` | Notes des migrations (la base en ligne fait foi) ; `supabase/functions/` = fonctions Edge |
- Autres dossiers : `video/` (Remotion, Hoppy, musiques), `livraison/kit/visuels/` (visuels FR/HE), `livraison/img/<commerce>/` (photos .webp).

## 3. Appli client (`index.html` + `client.js`)
- **Design clair d3** (fond blanc, noir `#111418`, un seul orange `#E8590C` pour l'action, pastels doux par rubrique, pas d'émoji). `?design=2` = ancien.
- **Design « tuiles » d4 (test, 22/11)** : `?design=4` sur un téléphone (gardé ; `?design=3` l'enlève) → `html.d4`. Accueil : `d4Tiles()` (client.js) = grande tuile promo orange + Hoppy qui saute (« Jusqu'à −X % » d'après `pa.data`), « Refaire mes courses » (dessins `img/qc` des articles de la dernière commande) ou « Première commande ? », tuiles services pastel, nos magasins ; `#vitCourse` en bleu ciel. Styles `html.d4 …` en fin de styles.css. Pas encore pour tout le monde.
- **Accueil vitrine** : « Livrer à » + « Quand », recherche, rubriques, bandeaux, « Commander à nouveau », carte course libre avec Hoppy et prix « dès 25 ₪ en ville », commerces.
- Barre du bas : Accueil · Course libre · **Hoppy (voix, rond blanc au milieu)** · Commandes · Compte (cachée si un bouton Commander est à l'écran).
- **Hors service** : carte ambre claire sur l'accueil ; « Quand : dès notre retour » ; le bouton hors ligne du patron prend le dessus sur ses horaires.
- **Magasins / boutiques HOP!** (Carrefour City הרב קוק 32, Rami Lévy, BOOOM, Victory, Roladin, Laline, Panzer…) : catalogue léger, photos par lien (`shop_catalog`), panier gardé 7 jours.
- **Articles hors catalogue** (boutique HOP!) : lignes écrites à la main dans « À prendre aussi » ; elles comptent dans les 2 ₪/article au-delà de 6 (`extra_units`).
- **Ma commande** : où/quand, courses par magasin avec photos, paiement en 2 cases (articles au magasin / livraison au livreur), bouton Commander · total.
- **Course libre** (A → B) : départ et arrivée bien libellés, adresses enregistrées Maison/Travail, appartement/étage/code, sans contact (photo obligatoire).
- **Hoppy (voix)** : commande à la voix, création de compte à la voix (nom, tél, rue, n°, étage, appart, code, adresse validée sur la carte), ouvre les catalogues (« montre-moi les laits chez Carrefour »). Analyse locale : **jamais de nom/adresse/tél envoyé à l'IA**.
- **Compte** : téléphone + mot de passe (pas d'e-mail), page de création d3 « qui donne envie » + bouton voix.
- **Promos** : page « Toutes les promos » (tous les magasins) avec recherche + micro ; le geste retour du téléphone la ferme.
- **Les promos du moment** (19/11) : bloc juste sous la recherche de l'accueil (`#homePromos`, classes `pz-*`) : compteur, filtre par magasin (logos), grandes cartes sur fond pastel du magasin, défilement seul + barre de progression (revient au début), « + » = panier de ce magasin (`paAddItem`). Promos du patron (`home_promo_pins`) en tête.
- **Boutiques HOP!** : en haut du catalogue, « Nos magasins sur HOP! » (le magasin en cours en bleu nuit, les autres à un toucher). Victory : rangement automatique des promos par rayon (`victory_categorize`, cron 03:58).
- **Recherche** : `products_search_v3` lit les textes déjà normalisés de `product_search_cache` (trigger + cron horaire) ; côté téléphone, réponses gardées en mémoire, jamais d'écran vide.
- **Suivi** : rond avec fourchette, étapes animées, scooter sur la carte, chat, paiement Bit en 3 étapes ; course programmée = « à l'heure prévue » (jamais « dans 3 min ») ; photo de livraison en grand une fois livrée.

## 4. Appli livreur (`coursier.html` + `coursier.js`)
- **Carte plein écran + panneau qui glisse** (normal / remonté / réduit) ; mini-courbe de la demande ; « HOP! » à glisser pour passer en ligne.
- **Courses disponibles** : le premier qui accepte la prend ; offre plein écran qui sonne (push répété). `settings.boss_only = true` = le patron distribue lui-même (le livreur ne voit rien de libre).
- **Tournée guidée (17/11)** : sur l'accueil, seulement l'arrêt en cours + « Encore N arrêts · ensuite : … ». Le toucher ouvre la **fiche d'arrêt** plein écran (INFOS : code, étage, appart, remarques, appel, Waze · ARTICLES) avec **glissé** « Commande récupérée » / « Commande livrée ! ». Arrêt fait → l'arrêt suivant s'ouvre tout seul. Ordre = `tourStops()` (récupérations puis livraisons, au plus près).
- **Mes courses** : une seule course ouverte, les autres repliées en une ligne (`mineOpen`). Même départ = groupe ; boutique HOP! = une liste et un sac par client.
- **Je pars dans** : Maintenant / 10 / 15 / 20 / 30 min → RPC `courier_eta_set` (message au client, suivi mis à jour, ligne verte de confirmation).
- **Boutique HOP!** : cocher chaque article (ou « manquant ») → **ticket du magasin (photo + montant) obligatoire avant « Courses récupérées »** → livrer, encaisser ticket + course.
- **Attente annoncée** : 3/5 min offertes puis 1 ₪/min (max 60 ₪), photo obligatoire ; « Sur place depuis X min ».
- **Après « Livré »** : reçu au client ; si la personne livrée n'a pas commandé (course d'un commerce) → bouton « 📷 Envoyer la photo de livraison » à SON numéro (`UI.deliveredMsg`) ; nouveau client → « Livré avec HOP! ».
- **18+** (tabac/alcool) : cocher « identité vérifiée » avant Livré. Cigarettes : prix indicatif, jamais de calcul par le livreur.
- **Finances** : gains de la semaine, **détails journaliers** (un jour = date + gain, on touche pour le détail), semaines passées, **crédit HOP prépayé** (commission déduite, 25 ₪ offerts au départ, recharges).
- **Hébreu** dans Réglages ; « Devenir livreur » : inscription avec documents (5 photos), Bit obligatoire, photo du top case.

## 5. Panneau patron (`admin.html` + `admin.js`)
- Courses en direct (carte, retards en rouge), donner une course à un livreur, la prendre soi-même, saisie d'une commande reçue sur WhatsApp, retenue au livreur, corbeille (jamais d'effacement réel).
- Livreurs : validation, documents, crédit (ajouter/retirer), débloquer, qualité. Commerces : accès (lien + code), catalogue, mise en avant.
- Clients (onglet), paniers en attente (relance WhatsApp), promos, message promo, « Livré avec HOP! », bienvenue nouveau client.
- Réglages : en service / hors service, horaires, `boss_only` + `boss_first_seconds`, commission min, crédit de départ.
- Rayons (éditeur produits/photos/prix), mode patron sur la page client, statistiques, kit pub, dialogues de l'IA.
- **Tout WhatsApp patron/livreur = `UI.waPersonal(tél, texte)`** (WhatsApp perso, jamais Business).

## 6. Espace commerce (`commerce.html?k=TOKEN`)
- Design d3 (`d3-sp`). Accès direct depuis l'appli client (`Store.myShops()`, carte « Mon commerce »).
- **« Envoyer une course à un client »** en haut : départ = la boutique (déjà enregistrée), seulement l'adresse du client à remplir ; qui paie (le commerce ou le client) ; `?send=1` ouvre le formulaire.
- Une fois envoyée : bouton **« Envoyer le suivi à {cliente} »** (WhatsApp, lien de suivi), aussi sur chaque course en cours et en haut de sa page de suivi.
- Commandes du catalogue, liste à préparer, « prête dans 15 min », horaires, photos, tableau de bord des ventes, avis.
- Démo : `commerce.html?demo=resto|boulangerie|boutique`.

## 6 bis. API HOP! (restaurants) et Vaisselle au mikvé (18/11)
- **API** : fonction Edge `hop-api` (prix `/v1/quote`, créer `/v1/deliveries` avec `dry_run`, suivre, annuler) ; une clé `hop_live_…` par commerce (tables `api_keys` = empreinte seulement, `api_deliveries`) ; prix calculés avec `config.js` + `pricing.js` du site ; client qui paie le livreur ; webhook `orders_api_webhook` (en-tête `X-HOP-Webhook-Secret`). Patron : onglet « 🔌 API » (créer / copier une fois / couper). Doc : `api.html` (FR/EN). Le bac à sable ne joint pas supabase.co : tester via `extensions.http` dans la base.
- **Vaisselle au mikvé** (tevilat kelim) : carré « Vaisselle au mikvé / טבילת כלים » (2e de « Ce qu'on livre »), page `#mikveSheet` (`mikveOpen()` dans `client.js`) : seulement l'adresse ; course aller-retour chez le client, prix fixe `config.pricing.mikve` = 35 + 50 = 85 ₪.

## 7. Prix et argent (ne rien changer sans le patron)
- Course **en ville 25 ₪** ; même zone 25 ₪ ; **ville ↔ zone industrielle / quartier à part (Agamim, Neot Shaked, Ir Yamim…) 30 ₪** (`pricing.areas`). Dire « dès 25 ₪ / en ville ».
- Achat : petit (makolet, cigarettes) au prix de la course ; achat en boutique = + supplément (ex. 25 + 8 = 33 ₪). Autre magasin dans la même commande : +10 ₪.
- Boutique HOP! : 6 articles compris, puis **2 ₪/article** (livreur + HOP!), hors catalogue compris (`extra_units`).
- Attente : 5 min offertes puis 1 ₪/min (max 60 ₪), pour le livreur. Commission HOP : 15 %, minimum 3 ₪, prise sur le crédit prépayé.
- Paiement : le client paie le livreur directement (espèces ou Bit/PayBox). Articles : payés au magasin (lien/Bit) ou avancés par le livreur puis ticket exact. Personne ne tape de carte bancaire.
- **En attente du patron** : prix des achats hors catalogue en café/resto (Roladin). Choix 1 = tout à 30 ; 2 = cafés/restos à 30, boutiques à 33 ; 3 = garder 33. **Ne pas toucher avant sa réponse.**

## 8. Base Supabase (projet `qwabzgmlpkazzvwhzfki`)
- Tables principales : `orders`, `couriers`, `shops`, `shop_products`, `shop_categories`, `shop_photo_files`, `clients`, `client_sessions`, `carts`, `chat_messages`, `settings`, `app_promos`, `rayon_items`/`rayon_cats`, `courier_topups`, `courier_penalties`, `courier_docs`, `order_declines`, `order_offers`, `push_subs`, `client_push_subs`, `site_events`, `known_places`, `blocked_phones`, catalogues magasins (`rami_items`, `victory_items`, `laline_items`, `carrefour_*`, `booom_*`…).
- `orders` (colonnes utiles) : `status` (nouvelle → confirmee → recuperee → livree / annulee / refusee), `token` (lien de suivi), `ref` (C261117-XXXX), `price`, `commission`, `hop_share`, `payment_method`, `payment_status`, `paid_to`, `hop_buy`, `items`, `items_note`, `shop_order`, `extra_units`, `buy_check`, `goods_spent` (ticket), `arrived_at`, `eta_*`, `pickup_at`, `not_before`, `leave_at_door`, `shop_sent`, `payer`, `first_order`, `first_shop`, `welcome_sent_at`, `dropoff_phone/contact`.
- Triggers clés : `orders_money_guard` (à l'insertion), `orders_zzz_hop_buy` (part HOP, places), `orders_hop_buy_step` (prise + ticket obligatoire avant récupérée), `orders_goods_livree` (ticket avant livrée).
- RPC clés : `track_order`, `chat_order(_send)`, `shop_catalog`, `shop_pic`, `courier_update`, `courier_ping`, `courier_buy_check`, `courier_hop_ticket`, `courier_eta_set`, `carrefour_fetch` / `carrefour_import` (méthode dans `CLAUDE.md`).
- Fonctions Edge : `hop-ia` (Gemini, règles ≤ 4000 caractères), `hop-push` (notifications ; **ne pas redéployer sans le patron**, une version prête attend), `shop-enrich`.
- `extensions.http` marche pour nominatim (géocodage) avec User-Agent ; photon est bloqué depuis le bac à sable.
- Migrations : seulement `create` / `create or replace` / `if not exists` ; jamais `drop` ni `delete` de vraies données.

## 9. Faire un changement (procédure)
1. Coder dans `livraison/`, puis `./bump-version.sh` (dans `livraison/`) pour casser le cache.
2. Vérifier la syntaxe : `npx -y acorn --ecma2022 --silent <fichier.js>`.
3. Tester (voir §10), capture 390 px FR + HE pour toute page client.
4. Commit sur `claude/delivery-management-app-eccme5` (pied de commit : Co-Authored-By + Claude-Session), push.
5. PR vers `claude/shopping-price-comparison-aAUf1`, fusion **merge**.
6. Mise en ligne Vercel (projet `prj_Nel1buwiQFVTxKJFM7xm1yj3h9A7`, alias `hop-livraison.vercel.app`) : `create_deployment` avec `deploymentId` = la prod actuelle, `withLatestCommit: true`, `target: production`, puis vérifier READY + alias (rappel `send_later` ~3 min).
   - **Mises en ligne groupées** : tout de suite seulement ce qui vend ou débloque ; le reste part en fin de journée. Quota gratuit (erreur 402) : attendre le lendemain.
   - Toujours dire au patron « en ligne » ou « prêt, part ce soir / demain ».
7. Base : `apply_migration` (aucune mise en ligne nécessaire) ; ne pas mettre en ligne du code qui écrit une colonne avant sa migration.

## 10. Tester en local
- `cd livraison && python3 -m http.server 8765` ; Playwright (Chromium déjà installé) en 390×844.
- Le code livreur est dans un bloc `(()=>{ … })();` : pour tester, intercepter `coursier.js` et ajouter avant la fin `window.__t = { set(m,o){ me=m; orders=o; }, openPage, render, ficheOpen, … }`, puis montrer `#work`.
- Pages en ligne (suivi…) : simuler Supabase avec `ctx.route` (`rpc/track_order`, `rpc/chat_order`).
- Ancien banc complet (PostgREST local) : scratchpad `h.js`, `service postgresql start`, `pgrst/postgrest hop.conf` (meurt au redémarrage du poste).

## 11. Pièges connus
- d3 masque les `<i>` vides et retire les émojis : utiliser `<s>` ou un pseudo-élément ; enfants de colonnes flex → `flex:none`.
- La fiche d'arrêt clique le **vrai bouton** de la carte « Mes courses » (`ficheAct`) : la carte doit être ouverte dans le DOM (`mineOpen`).
- Tout gestionnaire d'événement de `coursier.js` doit rester **dans** le bloc principal (un code placé après `})();` ne voit pas `orders`, bug du « Je pars dans » du 17/11).
- Le compte patron « Will » est `role='admin'` : `is_active_courier()` le compte comme livreur actif ; les règles « livreur » ne s'appliquent pas toujours à lui.
- `courier_id = auth.uid()` partout dans les RPC livreur ; le patron passe par `is_admin()`.
- Catalogue client : jamais de photo brute, toujours un lien (`shop_catalog` < 150 Ko).
- Commande envoyée par un commerce : `contact_name = shop_name` ; la vraie cliente = `dropoff_contact` / `dropoff_phone`.

## 12. Interdits express (détail dans `CLAUDE.md`)
FR + HE partout · jamais « partenaire » côté client · aucun concurrent cité · pas de durée chiffrée de livraison · casher : pas de mot laitier chez les restos viande · cigarettes sans marque, prix indicatif · aucun secret dans `config.js` · jamais l'e-mail du patron · aucun identifiant de modèle d'IA dans commits/fichiers · ne jamais envoyer nom/adresse/tél d'un client à l'IA · demander avant toute règle d'argent.

## 13. Dernières nouveautés (17–18/11/2026)
- Mes courses : une seule course ouverte ; tournée guidée arrêt par arrêt avec enchaînement automatique.
- « Je pars dans » réparé ; ticket obligatoire avant « Courses récupérées » (base remise souple le 17 en attendant la mise en ligne, à rétablir après : rappel programmé le 18/11 14 h 25, heure d'Israël).
- Photo de livraison envoyée à la personne livrée + affichée sur le suivi ; rappel « Envoyer le suivi » côté commerce ; « Livré avec HOP! » pour les clientes des commerces.
- Finances livreur rangées par jour ; promos avec recherche + micro ; création de compte (voix) ; carte « hors service » ; prix « dès 25 ₪ » sur la course libre ; espace commerce d3.

## 14. En attente / à faire plus tard
- Réponse du patron : prix Roladin (1/2/3) ; passer `boss_only` à faux pour que les livreurs reçoivent les courses (« oui, change le réglage »).
- Déploiement `hop-push` (notifications « course donnée / annulée / pas remboursé ») : attend l'accord du patron.
- Design d3 pour les applis livreur et patron ; vignettes photo des catégories (3 par ligne) ; back-office produits ; regroupement intelligent des commandes ; assistance livreur / client ; emballage Android (stores).
