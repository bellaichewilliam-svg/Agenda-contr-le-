// ============================================================================
// CONFIGURATION — c'est le seul fichier à modifier pour personnaliser l'app.
// ============================================================================

window.CONFIG = {
  // --- Identité de l'entreprise de livraison ---------------------------------
  businessName: "Coursier Express",
  slogan: "Vos colis récupérés et livrés, à l'heure.",
  city: "Israël",
  // Numéro WhatsApp du livreur, format international SANS "+" ni espaces.
  // Les nouvelles commandes vous sont envoyées sur ce numéro.
  whatsapp: "972500000000",
  phoneDisplay: "050-000-0000",
  email: "contact@exemple.com",

  // --- Monnaie / pays --------------------------------------------------------
  currency: "₪",
  locale: "fr-FR",
  timezone: "Asia/Jerusalem",
  // Code pays utilisé pour chercher les adresses (OpenStreetMap)
  countryCode: "il",
  // Indicatif ajouté aux numéros locaux (05x…) pour les liens WhatsApp
  phoneCountryPrefix: "972",

  // --- Horaires d'ouverture (0 = dimanche … 6 = samedi) ----------------------
  // [heure d'ouverture, heure de fermeture] ou null = fermé
  hours: {
    0: [8, 19], 1: [8, 19], 2: [8, 19], 3: [8, 19], 4: [8, 19],
    5: [8, 13],
    6: null
  },
  // Délai minimum entre la commande et la récupération (minutes)
  minLeadMinutes: 60,

  // --- Tarifs ----------------------------------------------------------------
  pricing: {
    base: 35,               // Prise en charge (inclut les premiers km)
    includedKm: 5,          // km inclus dans la prise en charge
    perKm: 3.5,             // Prix par km au-delà
    minimum: 35,            // Prix minimum d'une course
    roundTo: 1,             // Arrondi du prix final
    sizes: {                // Supplément selon la taille du colis
      enveloppe: { label: "Enveloppe / document", extra: 0 },
      petit:     { label: "Petit colis (< 5 kg)", extra: 0 },
      moyen:     { label: "Colis moyen (5–15 kg)", extra: 15 },
      gros:      { label: "Gros colis (15–30 kg)", extra: 35 }
    },
    expressPercent: 50,     // Course express (dès que possible) : +50 %
    postOfficeExtra: 25,    // Retrait à la poste (file d'attente, démarches)
    returnTripPercent: 70,  // Aller-retour : +70 %
    extraStop: 15           // Par arrêt supplémentaire
  },

  // --- Base de données en ligne (Supabase, gratuit) --------------------------
  // Laisser vide = mode démo : les commandes restent sur l'appareil et vous
  // sont transmises par WhatsApp. Voir livraison/README.md pour l'activer.
  supabase: {
    url: "",
    anonKey: ""
  },

  // Code d'accès à l'espace livreur en mode démo (sans Supabase)
  demoAdminPin: "1234"
};
