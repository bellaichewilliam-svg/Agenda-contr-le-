// ============================================================================
// CONFIGURATION — c'est le seul fichier à modifier pour personnaliser l'app.
// ============================================================================

window.CONFIG = {
  // --- Identité --------------------------------------------------------------
  businessName: "HOP! Livraison",
  businessNameHe: "הופ! משלוחים",
  // Numéro WhatsApp du coursier, format international SANS "+" ni espaces.
  whatsapp: "972500000000",
  phoneDisplay: "050-000-0000",
  // Numéro de téléphone sur lequel les clients paient avec Bit
  bitPhone: "050-000-0000",
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
    0: [8, 21], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21],
    5: [8, 14],
    6: null
  },
  minLeadMinutes: 30,         // délai minimum pour une course programmée

  // --- Villes desservies : le prix se calcule entre les centres-villes -------
  cities: [
    { id: "netanya",      fr: "Netanya",        he: "נתניה",        lat: 32.3215, lon: 34.8532 },
    { id: "even-yehuda",  fr: "Even Yehuda",    he: "אבן יהודה",    lat: 32.2700, lon: 34.8870 },
    { id: "kadima",       fr: "Kadima-Tzoran",  he: "קדימה-צורן",   lat: 32.2780, lon: 34.9150 },
    { id: "pardesia",     fr: "Pardesia",       he: "פרדסיה",       lat: 32.3060, lon: 34.9090 },
    { id: "kfar-yona",    fr: "Kfar Yona",      he: "כפר יונה",     lat: 32.3170, lon: 34.9350 },
    { id: "hadera",       fr: "Hadera",         he: "חדרה",         lat: 32.4340, lon: 34.9190 },
    { id: "raanana",      fr: "Ra'anana",       he: "רעננה",        lat: 32.1848, lon: 34.8713 },
    { id: "kfar-saba",    fr: "Kfar Saba",      he: "כפר סבא",      lat: 32.1750, lon: 34.9070 },
    { id: "hod-hasharon", fr: "Hod HaSharon",   he: "הוד השרון",    lat: 32.1500, lon: 34.8880 },
    { id: "herzliya",     fr: "Herzliya",       he: "הרצליה",       lat: 32.1624, lon: 34.8443 },
    { id: "ramat-hasharon", fr: "Ramat HaSharon", he: "רמת השרון",  lat: 32.1460, lon: 34.8390 },
    { id: "tel-aviv",     fr: "Tel Aviv",       he: "תל אביב",      lat: 32.0853, lon: 34.7818 },
    { id: "ramat-gan",    fr: "Ramat Gan",      he: "רמת גן",       lat: 32.0823, lon: 34.8107 },
    { id: "givatayim",    fr: "Givatayim",      he: "גבעתיים",      lat: 32.0722, lon: 34.8120 },
    { id: "bnei-brak",    fr: "Bnei Brak",      he: "בני ברק",      lat: 32.0807, lon: 34.8338 },
    { id: "petah-tikva",  fr: "Petah Tikva",    he: "פתח תקווה",    lat: 32.0840, lon: 34.8878 },
    { id: "holon",        fr: "Holon",          he: "חולון",        lat: 32.0158, lon: 34.7874 },
    { id: "bat-yam",      fr: "Bat Yam",        he: "בת ים",        lat: 32.0171, lon: 34.7454 },
    { id: "rishon",       fr: "Rishon LeZion",  he: "ראשון לציון",  lat: 31.9730, lon: 34.7925 }
  ],
  homeCity: "netanya",

  // --- Tarifs ----------------------------------------------------------------
  // Prix depuis/vers votre ville : fixés à la main ci-dessous (petit colis).
  // Pour les autres trajets : base + perKm × distance à vol d'oiseau, arrondi à 5 ₪.
  pricing: {
    fixedFromHome: {
      "netanya": 25,
      "pardesia": 45, "even-yehuda": 45, "kadima": 50, "kfar-yona": 50,
      "hadera": 75,
      "raanana": 80, "kfar-saba": 85, "herzliya": 85, "hod-hasharon": 90, "ramat-hasharon": 95,
      "tel-aviv": 120, "ramat-gan": 120, "givatayim": 120, "bnei-brak": 120, "petah-tikva": 120,
      "holon": 145, "bat-yam": 145, "rishon": 160
    },
    base: 25,
    perKm: 3.5,
    roundTo: 5,
    minimum: 25,
    sizes: {
      petit: 0,     // enveloppe, sac, petit colis (< 5 kg)
      moyen: 10,    // 5 à 15 kg
      gros: 25      // 15 à 30 kg
    },
    express: 20,        // en moins d'une heure
    pickupPoint: 10,    // retrait à la poste / Super-Pharm / point relais (attente)
    purchase: 15,       // « J'achète pour vous » (pharmacie, courses…)
    extraStop: 10,      // par arrêt supplémentaire
    returnTripPercent: 50
  },

  // --- Livreurs partenaires (comme Wolt) ---------------------------------------
  platform: {
    commissionPerCourse: 3,   // ce que vous prenez sur chaque course d'un livreur
    settlementDay: 0          // jour du paiement hebdomadaire (0 = dimanche)
  },

  // --- Offres de lancement ----------------------------------------------------
  promos: {
    // Codes promo : percent (avec max) ou amount ; firstOrderOnly = 1re commande
    codes: {
      BIENVENUE: { percent: 50, max: 20, firstOrderOnly: true },
      BRUCHIM:   { percent: 50, max: 20, firstOrderOnly: true },  // « Bienvenue » en hébreu
      NETANYA:   { amount: 5 }
    },
    // Parrainage : chaque client a un code AMI + 4 derniers chiffres de son téléphone
    referral: { prefix: "AMI", amount: 10 },
    // Carte de fidélité : la Nième course est offerte (jusqu'à max ₪)
    loyalty: { every: 10, max: 30 },
    // Offres professionnelles affichées sur la page (commande par WhatsApp)
    business: [
      { fr: "Restaurants : livraison de repas dans Netanya", he: "מסעדות: משלוח אוכל בתוך נתניה", price: "18 ₪" },
      { fr: "Carnet de 10 courses dans une même ville", he: "כרטיסייה של 10 משלוחים בתוך אותה עיר", price: "200 ₪" },
      { fr: "Tournée quotidienne fixe (avocats, comptables, labos)", he: "סבב יומי קבוע (עורכי דין, רואי חשבון, מעבדות)", price: "sur devis · בהצעת מחיר" }
    ]
  },

  // --- Base de données en ligne (Supabase, gratuit) --------------------------
  // Vide = mode démo (commandes envoyées par WhatsApp, pas de suivi à distance).
  supabase: {
    url: "",
    anonKey: ""
  },
  demoAdminPin: "1234"
};
