// ============================================================================
// CONFIGURATION — c'est le seul fichier à modifier pour personnaliser l'app.
// ============================================================================

window.CONFIG = {
  // --- Identité --------------------------------------------------------------
  businessName: "HOP! Livraison",
  businessNameHe: "הופ! משלוחים",
  // Adresse officielle du site : tous les liens et QR codes partagés y mènent
  // (même si l'appli est ouverte depuis l'ancienne adresse GitHub)
  siteUrl: "https://hop-livraison.vercel.app/",
  // Numéro WhatsApp du coursier, format international SANS "+" ni espaces.
  whatsapp: "972527790361",
  phoneDisplay: "052-779-0361",
  // Numéro de téléphone sur lequel les clients paient avec Bit
  bitPhone: "052-779-0361",
  // Notifications push (même appli fermée) : clé publique VAPID (la clé privée est dans Supabase, table push_config)
  push: { publicKey: "BD0sjiF6QaklSSq7MN4CBXrpBUUQdA_P6ux42nXBDg2Fjgr6U8NEgY3CVo9bI7BDFHGqOfMPw_lIaWwfdhdKHiA" },
  email: "contact@exemple.com",

  // --- Reçus (קבלה) : vos informations légales ------------------------------
  // Un עוסק פטור émet des reçus (קבלה), pas de חשבונית מס, et ne facture pas la TVA.
  // ⚠️ Ce fichier est public : n'écrivez ici que ce qui doit figurer sur un reçu.
  business: {
    legalName: "בלאיש ויליאם אברהם",
    tradeName: "DIGITAL AND CO",
    status: "עוסק פטור",
    number: "332342807",
    address: "יהודה הלוי 20, נתניה",
    email: ""                 // email affiché sur le reçu (facultatif)
  },

  // --- Monnaie / pays --------------------------------------------------------
  currency: "₪",
  timezone: "Asia/Jerusalem",
  countryCode: "il",          // pour chercher les adresses (OpenStreetMap)
  phoneCountryPrefix: "972",  // ajouté aux numéros 05x… pour WhatsApp
  defaultLang: "fr",          // "fr" ou "he" (sinon langue du téléphone)

  // --- Horaires (0 = dimanche … 6 = samedi) : [ouverture, fermeture] ou null --
  hours: {
    0: [8, 23], 1: [8, 23], 2: [8, 23], 3: [8, 23], 4: [8, 23],
    5: [8, 14],
    6: null
  },
  minLeadMinutes: 30,         // délai minimum pour une course programmée

  // --- Villes desservies : le prix se calcule entre les centres-villes -------
  cities: [
    { id: "netanya",      fr: "Netanya",        he: "נתניה",        lat: 32.3215, lon: 34.8532 },
    // Sharon (grille de prix du groupe, colonnes moto / voiture)
    { id: "nordia",       fr: "Nordia",         he: "נורדיה",       lat: 32.3122, lon: 34.8935 },
    { id: "havatselet",   fr: "Havatselet HaSharon", he: "חבצלת השרון", lat: 32.3600, lon: 34.8640, aliases: ["Havatselet Hasharon"] },
    { id: "beit-yitzhak", fr: "Beit Yitzhak",   he: "בית יצחק",     lat: 32.3280, lon: 34.8870, aliases: ["בית יצחק-שער חפר", "Beit Yitzhak-Sha'ar Hefer"] },
    { id: "yakum",        fr: "Yakum",          he: "יקום",         lat: 32.2490, lon: 34.8410, aliases: ["Yaqum"] },
    { id: "wingate",      fr: "Wingate",        he: "וינגייט",      lat: 32.2770, lon: 34.8340, aliases: ["מכון וינגייט", "Wingate Institute"] },
    { id: "even-yehuda",  fr: "Even Yehuda",    he: "אבן יהודה",    lat: 32.2700, lon: 34.8870, aliases: ["Even Yehuda"] },
    { id: "kadima",       fr: "Kadima-Tzoran",  he: "קדימה-צורן",   lat: 32.2780, lon: 34.9150, aliases: ["Kadima Zoran", "Kadima"] },
    { id: "pardesia",     fr: "Pardesia",       he: "פרדסיה",       lat: 32.3060, lon: 34.9090 },
    { id: "kfar-yona",    fr: "Kfar Yona",      he: "כפר יונה",     lat: 32.3170, lon: 34.9350 },
    { id: "tel-mond",     fr: "Tel Mond",       he: "תל מונד",      lat: 32.2550, lon: 34.9180 },
    { id: "beit-yanai",   fr: "Beit Yanai / Kfar Vitkin", he: "בית ינאי / כפר ויתקין", lat: 32.3820, lon: 34.8680, aliases: ["בית ינאי", "Beit Yanai", "כפר ויתקין", "Kfar Vitkin"] },
    { id: "shefayim",     fr: "Shefayim",       he: "שפיים",        lat: 32.2230, lon: 34.8240 },
    { id: "emek-hefer",   fr: "Emek Hefer",     he: "עמק חפר",      lat: 32.3700, lon: 34.9000, aliases: ["מועצה אזורית עמק חפר", "Emek Hefer Regional Council", "Hefer Valley"] },
    { id: "nitzanei-oz",  fr: "Nitzanei Oz",    he: "ניצני עוז",    lat: 32.3060, lon: 35.0090 },
    { id: "shaar-efraim", fr: "Sha'ar Efraim",  he: "שער אפרים",    lat: 32.2650, lon: 35.0000, aliases: ["Shaar Efraim", "שער אפריים"] },
    { id: "hadera",       fr: "Hadera",         he: "חדרה",         lat: 32.4340, lon: 34.9190, aliases: ["גבעת אולגה", "אולגה", "Givat Olga", "Olga"] },
    { id: "or-akiva",     fr: "Or Akiva",       he: "אור עקיבא",    lat: 32.5080, lon: 34.9200, aliases: ["Or Aqiva"] },
    { id: "caesarea",     fr: "Césarée",        he: "קיסריה",       lat: 32.5190, lon: 34.9040, aliases: ["Caesarea", "Qesarya"] },
    { id: "kalansawe",    fr: "Kalansawe",      he: "קלנסווה",      lat: 32.2850, lon: 34.9810, aliases: ["Qalansawe", "קלנסואה"] },
    { id: "tira",         fr: "Tira",           he: "טירה",         lat: 32.2340, lon: 34.9500, aliases: ["At-Tira", "Et Tira"] },
    { id: "raanana",      fr: "Ra'anana",       he: "רעננה",        lat: 32.1848, lon: 34.8713, aliases: ["Raanana"] },
    { id: "kfar-saba",    fr: "Kfar Saba",      he: "כפר סבא",      lat: 32.1750, lon: 34.9070, aliases: ["Kefar Sava", "Kfar Sava"] },
    { id: "hod-hasharon", fr: "Hod HaSharon",   he: "הוד השרון",    lat: 32.1500, lon: 34.8880, aliases: ["Hod Hasharon"] },
    { id: "herzliya",     fr: "Herzliya",       he: "הרצליה",       lat: 32.1624, lon: 34.8443, aliases: ["Herzliyya", "Herzliya Pituah", "הרצליה פיתוח"] },
    { id: "ramat-hasharon", fr: "Ramat HaSharon", he: "רמת השרון",  lat: 32.1460, lon: 34.8390 },
    { id: "tel-aviv", zone: "tlv",     fr: "Tel Aviv",       he: "תל אביב",      lat: 32.0853, lon: 34.7818, aliases: ["Tel Aviv-Yafo", "Tel Aviv-Jaffa", "Jaffa", "יפו"] },
    { id: "ramat-gan", zone: "tlv",    fr: "Ramat Gan",      he: "רמת גן",       lat: 32.0823, lon: 34.8107 },
    { id: "givatayim", zone: "tlv",    fr: "Givatayim",      he: "גבעתיים",      lat: 32.0722, lon: 34.8120, aliases: ["Giv'atayim", "Givataim"] },
    { id: "bnei-brak", zone: "tlv",    fr: "Bnei Brak",      he: "בני ברק",      lat: 32.0807, lon: 34.8338, aliases: ["Bene Beraq", "Bnei Brak"] },
    { id: "petah-tikva", zone: "petah-tikva",  fr: "Petah Tikva",    he: "פתח תקווה",    lat: 32.0840, lon: 34.8878, aliases: ["Petah Tiqwa", "Petach Tikva", "Petah Tikva"] },
    { id: "holon", zone: "tlv",        fr: "Holon",          he: "חולון",        lat: 32.0158, lon: 34.7874 },
    { id: "bat-yam", zone: "tlv",      fr: "Bat Yam",        he: "בת ים",        lat: 32.0171, lon: 34.7454 },
    { id: "rishon", zone: "rishon",       fr: "Rishon LeZion",  he: "ראשון לציון",  lat: 31.9730, lon: 34.7925, aliases: ["Rishon LeTsiyyon", "Rishon Lezion"] }
  ],
  homeCity: "netanya",

  // --- Zones de livraison : le Sharon, Tel Aviv – Gush Dan, Petah Tikva, Rishon ---
  // Les villes sans « zone » sont dans le Sharon. Mettez active: true pour ouvrir une zone (pour l'instant : le Sharon seulement).
  zones: [
    { id: "sharon",      fr: "HaSharon",                he: "השרון",                active: true },
    { id: "tlv",         fr: "Tel Aviv – Gush Dan",     he: "תל אביב – גוש דן",      active: false },
    { id: "petah-tikva", fr: "Petah Tikva",             he: "פתח תקווה",            active: false },
    { id: "rishon",      fr: "Rishon LeZion & Shfela",  he: "ראשון לציון והשפלה",   active: false }
  ],
  // Regroupement : deux courses d'un coup quand les arrivées sont proches (mêmes règles que la base, pair_ok)
  grouping: { dropKm: 1.2, pickupKm: 0.6, minutes: 15, detourKm: 1, maxOrders: 3 },
  // Heures de pointe habituelles, affichées aux livreurs
  peakHours: { fr: "12\u00a0h–14\u00a0h et 18\u00a0h–21\u00a0h", he: "12:00–14:00 ו-18:00–21:00" },

  // --- Tarifs ----------------------------------------------------------------
  // Prix depuis/vers votre ville : fixés à la main ci-dessous.
  // fixedFromHome = scooter / moto (petit et moyen colis), fixedCarFromHome = voiture
  // (gros colis). Sharon : grille de prix du groupe. Autres trajets : base + perKm
  // × distance à vol d'oiseau, arrondi à 5 ₪.
  pricing: {
    // Course prête : prix fixe. Si le livreur attend sur place (commande pas prête) ou fait les achats :
    // minutes offertes, puis un supplément par tranche commencée, plafonné ; versé en entier au livreur.
    // (En ligne : wait_free_min, wait_step_min, wait_step_price, wait_max dans la table settings.)
    waiting: { freeMinutes: 5, stepMinutes: 1, stepPrice: 1, max: 60 },
    // Pas encore de voiture : l'option « Gros colis » est cachée. Mettez true pour l'ouvrir
    // (les prix voiture ci-dessous sont déjà prêts).
    carAvailable: false,
    fixedFromHome: {
      "netanya": 25,
      "nordia": 35, "havatselet": 40, "beit-yitzhak": 40, "yakum": 40,
      "wingate": 50, "even-yehuda": 50, "kadima": 50, "kfar-yona": 50, "pardesia": 50, "tel-mond": 50, "beit-yanai": 50,
      "shefayim": 60, "emek-hefer": 70, "nitzanei-oz": 80,
      "shaar-efraim": 100, "hadera": 100, "raanana": 100, "kfar-saba": 100, "herzliya": 100, "hod-hasharon": 100,
      "ramat-hasharon": 110, "or-akiva": 120, "caesarea": 120, "kalansawe": 130, "tira": 150,
      "tel-aviv": 120, "ramat-gan": 120, "givatayim": 120, "bnei-brak": 120, "petah-tikva": 120,
      "holon": 145, "bat-yam": 145, "rishon": 160
    },
    fixedCarFromHome: {
      "netanya": 40,
      "nordia": 50, "havatselet": 50, "beit-yitzhak": 50, "yakum": 50,
      "wingate": 80, "even-yehuda": 60, "kadima": 60, "kfar-yona": 60, "pardesia": 70, "tel-mond": 60, "beit-yanai": 60,
      "shefayim": 80, "emek-hefer": 80, "nitzanei-oz": 100,
      "shaar-efraim": 120, "hadera": 120, "raanana": 120, "kfar-saba": 120, "herzliya": 120, "hod-hasharon": 120,
      "ramat-hasharon": 130, "or-akiva": 140, "caesarea": 140, "kalansawe": 150, "tira": 170
    },
    base: 25,
    perKm: 3.5,
    roundTo: 5,
    minimum: 25,
    sizes: {
      petit: 0,     // enveloppe, sac, petit colis (< 5 kg)
      moyen: 10,    // 5 à 15 kg
      gros: 25      // 15 à 30 kg (voiture) — remplacé par fixedCarFromHome quand il existe
    },
    express: 20,        // en moins d'une heure
    pickupPoint: 0,     // retrait à la poste / Super-Pharm / point relais : plus de supplément fixe (l'attente au-delà de 10 min est payée au temps, voir waiting)
    purchase: 10,       // « J'achète pour vous » : 10 min d'achats comptées d'office (10 ₪), sauf un paquet de cigarettes seul ;
    purchaseMinutes: 10, // au-delà, l'attente annoncée habituelle (1 ₪ la minute). En ligne : settings.purchase_min
    extraStop: 10,      // (ancien) par arrêt supplémentaire sans adresse
    // Arrêt en plus, avec son adresse : sur le chemin (détour d'au plus onWayKm km) → onWayPercent % du
    // prix d'une course ; sinon le prix d'une course (base). Au plus maxStops arrêts.
    stop: { onWayKm: 1.5, onWayPercent: 50, maxStops: 2 },
    returnTripPercent: 50,
    // Zones industrielles de Netanya : une course entre la ville et une zone (ou d'une zone à l'autre)
    // coûte price au lieu du prix « dans Netanya », dans les deux sens ; dans la même zone, prix normal.
    // Rectangles approximatifs (sud, nord, ouest, est) : à vérifier sur la carte, et à ajuster ici.
    areas: {
      price: 30,
      list: [
        { id: "ezor-hadash", city: "netanya", fr: "zone industrielle nouvelle (Poleg)", he: "אזור התעשייה החדש",
          box: [32.268, 32.292, 34.852, 34.876] },
        { id: "ezor-yashan", city: "netanya", fr: "zone industrielle ancienne", he: "אזור התעשייה הישן",
          box: [32.326, 32.345, 34.866, 34.890] }
      ]
    }
  },

  // --- Livreurs partenaires --------------------------------------------------
  platform: {
    // Commission sur les courses que l'appli apporte au livreur : commissionPercent % du prix,
    // au moins commissionPerCourse, arrondie au demi-shekel : 25 ₪ → 4 ₪, 50 ₪ → 7,50 ₪, 100 ₪ → 15 ₪
    // (en ligne : settings.commission_pct et settings.commission_min). Les clients paient le livreur directement ;
    // la commission est déduite du crédit HOP que le livreur recharge à l'avance.
    commissionPerCourse: 3,
    commissionPercent: 15,
    // Courses de son réseau (un commerce qu'il a amené) : networkPercent %, au moins networkMin
    // 25 ₪ → 2 ₪, 100 ₪ → 8 ₪ (en ligne : settings.network_pct et settings.network_min)
    networkPercent: 8,
    networkMin: 2,
    // Pourboires proposés au client après la livraison : 100 % pour le livreur
    tips: [5, 10, 15],
    // Après ce nombre de courses refusées d'affilée (refus ou pas de réponse en 40 s), le livreur passe
    // hors ligne tout seul ; il repasse en ligne quand il est prêt (en ligne : settings.decline_streak_max)
    declineStreakMax: 3,
    // En service : on reste en ligne ce nombre de minutes sans nouvelle position (le temps d'être sur Waze)
    // ; « Terminer le service » met hors ligne tout de suite (en ligne : settings.duty_grace_min)
    dutyGraceMinutes: 60,
    // Au-delà de ce solde dû (commissions − courses payées à HOP − bonus), le livreur ne
    // peut plus accepter de course tant qu'il n'a pas réglé (en ligne : settings.max_debt)
    maxDebt: 50,
    // Courses proposées d'abord au livreur en service le plus proche, puis au 2e après
    // ces secondes, puis à tous (en ligne : settings.wave_seconds)
    waveSeconds: 45,
    // « Livré » accepté seulement si le livreur est à moins de ces mètres de l'adresse
    // de livraison (position GPS du téléphone ; en ligne : settings.deliver_radius)
    deliverRadius: 200,
    settlementDay: 0          // jour du paiement hebdomadaire (0 = dimanche)
  },

  // --- Commerces partenaires amenés par les livreurs ---------------------------
  // Le livreur qui amène un commerce gagne bonusPerDelivery à chaque course livrée
  // au départ de ce commerce (même si un autre livreur la fait), tant qu'il reste
  // actif (au moins une livraison dans les activeDays derniers jours), et a
  // priorityMinutes d'avance pour prendre ces courses. Le bonus est déduit de sa
  // commission chaque semaine. (En ligne : colonnes referral_bonus et
  // priority_minutes de la table settings.)
  partners: {
    // Programme « Gagner plus » côté livreur (amener des commerces, avantages réseau, bonus) :
    // caché tant que le patron ne le débloque pas. true pour le remettre.
    courierProgram: false,
    bonusPerDelivery: 2,
    priorityMinutes: 3,
    // Bonus versés seulement si le parrain a livré au moins une course ces N derniers jours
    // (en ligne : settings.referral_active_days)
    activeDays: 21,
    // Niveaux du livreur selon le nombre de commerces amenés
    levels: [
      { min: 1, name: "🌱 Premier commerce" },
      { min: 3, name: "🔥 Chasseur" },
      { min: 5, name: "🚀 Ambassadeur" },
      { min: 10, name: "👑 Légende HOP!" }
    ],
    kinds: ["restaurant", "boutique", "pharmacie", "bureau", "autre"],
    // Catalogue HOP! Pro : catégories proposées au commerce selon son type (il les renomme comme il veut)
    catalogCategories: {
      restaurant: ["Entrées · מנות ראשונות", "Plats · מנות עיקריות", "Desserts · קינוחים", "Boissons · שתייה"],
      boutique: ["Nouveautés · חדש", "Vêtements · ביגוד", "Accessoires · אביזרים", "Promotions · מבצעים"],
      pharmacie: ["Pharmacie · בית מרקחת", "Hygiène · היגיינה", "Bébé · תינוקות", "Beauté · יופי"],
      bureau: ["Fournitures · ציוד משרדי", "Impression · הדפסה"],
      autre: ["Produits · מוצרים", "Promotions · מבצעים"]
    },
    // Carnet pro : 10 courses dans Netanya payées d'avance (en ligne : settings.carnet_unit = price / courses)
    // offered: false = le carnet n'est plus proposé aux commerces (mis de côté par le patron, pour une promo de relance) ;
    // les commerces qui en ont encore l'utilisent normalement. Remettre true pour le proposer de nouveau.
    carnet: { courses: 10, price: 200, offered: false }
  },

  // HOP! Pro : abonnement mensuel des commerces (0 % de commission sur leurs ventes). Leurs clients
  // commandent dans l'appli ; le commerce paie une part fixe de chaque livraison (shopShare, dont hopShare
  // pour HOP), le client paie le reste (25 − 10 = 15 ₪ dans Netanya) ; le livreur est envoyé leadMinutes
  // avant que ce soit prêt. Le livreur qui a amené le commerce touche referrerPercent % de chaque mois
  // d'abonnement payé, pendant referrerMonths mois.
  // (En ligne : pro_monthly, pro_shop_share, pro_hop_share, pro_lead_min, pro_referrer_pct, pro_referrer_months.)
  // hopShareClient : part de HOP quand le commerce a choisi « le client paie la livraison » (prise sur le crédit du livreur)
  pro: { monthly: 299, shopShare: 12, hopShare: 2, hopShareClient: 1, leadMinutes: 8, prepChoices: [10, 15, 20, 30], referrerPercent: 0, referrerMonths: 12 },   // part livreur des abonnements : 0 % tant que le patron ne la débloque pas (était 20 %)

  // Messages prêts à envoyer aux livreurs depuis l'espace patron
  courierMessages: [
    { kind: "rush", text: "🔥 Ça vaut le coup de sortir : beaucoup de commandes en ce moment !" },
    { kind: "rush", text: "🍔 Rush du soir à Netanya : passez en ligne maintenant !" },
    { kind: "info", text: "🌧️ Il pleut : prudence sur la route, prenez votre temps." },
    { kind: "info", text: "📍 Des courses attendent au centre-ville de Netanya." },
    { kind: "info", text: "😴 Calme pour le moment, pas besoin de sortir." }
  ],

  // --- Offres de lancement ----------------------------------------------------
  promos: {
    // Codes promo : percent (avec max) ou amount ; firstOrderOnly = 1re commande
    codes: {
      // Bienvenue : -10 ₪ (Netanya → Netanya à 15 ₪), une seule fois par numéro / téléphone / IP
      BIENVENUE: { amount: 10, firstOrderOnly: true, welcome: true },
      BRUCHIM:   { amount: 10, firstOrderOnly: true, welcome: true },  // « Bienvenue » en hébreu
      NETANYA:   { amount: 5 }
    },
    // Parrainage : chaque client a un code AMI + 4 derniers chiffres de son téléphone
    referral: { prefix: "AMI", amount: 10 },
    // Carte de fidélité : la Nième course est offerte (jusqu'à max ₪)
    loyalty: { every: 10, max: 30 },
    // Offres professionnelles affichées sur la page (commande par WhatsApp) ; la ligne du carnet seulement si partners.carnet.offered
    business: [
      { fr: "Commerces et restaurants : course dans Netanya, sans abonnement, 0 % sur vos ventes", he: "עסקים ומסעדות: משלוח בתוך נתניה, בלי מנוי, 0% מהמכירות", price: { fr: "25 ₪", he: "25 ₪" } },
      { carnet: true, fr: "Carnet pro de 10 courses dans Netanya, au lieu de 250 ₪ (25 ₪ × 10)", he: "כרטיסייה לעסקים: 10 משלוחים בתוך נתניה, במקום 250 ₪ (25 ₪ × 10)", price: { fr: "200 ₪ les 10", he: "200 ₪ ל-10" } },
      { fr: "Tournée quotidienne fixe (avocats, comptables, labos)", he: "סבב יומי קבוע (עורכי דין, רואי חשבון, מעבדות)", price: { fr: "sur devis", he: "בהצעת מחיר" } }
    ]
  },

  // --- Base de données en ligne (Supabase, gratuit) --------------------------
  // Vide = mode démo (commandes envoyées par WhatsApp, pas de suivi à distance).
  // Base en ligne (clé publique « anon » : faite pour être dans le site, la sécurité est dans les règles de la base)
  supabase: {
    url: "https://qwabzgmlpkazzvwhzfki.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWJ6Z21scGthenp2d2h6ZmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ3MDAsImV4cCI6MjEwNzk5MDcwMH0.O-MhDJnHp8h8XamlgwEL_Bxm3EIzQufySPwAiGLRrOs"
  },
  demoAdminPin: "1234"
};

// Ancienne adresse (GitHub) : on passe tout de suite à l'adresse officielle, même page (l'espace livreur
// et l'espace patron y ont leur propre adresse, pour s'installer comme des applis à part)
(function () {
  // Sur le site officiel : l'appli client vit dans /app/, l'espace livreur dans /livreur/, le patron dans /patron/
  // (trois applis séparées : Android installe chacune avec son icône, sans les confondre)
  if (/\.vercel\.app$/.test(location.hostname) && !/^\/(app|livreur|patron)\//.test(location.pathname)) {
    const page = location.pathname.split("/").pop() || "";
    const to = page === "coursier.html" ? "/livreur/" : page === "admin.html" ? "/patron/" : "/app/" + (page === "index.html" ? "" : page);
    location.replace(to + location.search + location.hash);
    return;
  }
  if (!/\.github\.io$/.test(location.hostname)) return;
  const page = location.pathname.split("/").pop() || "index.html";
  const to = page === "coursier.html" ? "livreur/" : page === "admin.html" ? "patron/" : "app/" + (page === "index.html" ? "" : page);
  location.replace(window.CONFIG.siteUrl + to + location.search + location.hash);
})();
