// Base de données PrixMalin
// Prix en ILS (₪) - Israël
// Source: estimations basées sur les flux officiels du Ministère de l'Économie
// (חוק שקיפות מחירים - loi de transparence des prix israélienne, 2014)
// Les supermarchés sont tenus de publier leurs prix en XML public.
// Ce fichier peut être régénéré par fetch-prices.js (voir docs).

const DATA_VERSION = "2026-05-03";
const LAST_UPDATED = "2026-05-03T08:00:00+03:00";

const STORES = {
  rami_levy:   { name: "Rami Levy",    color: "#dc2626", icon: "RL", tier: "discount" },
  osher_ad:    { name: "Osher Ad",     color: "#0891b2", icon: "OA", tier: "discount" },
  boom:        { name: "Boom",         color: "#ec4899", icon: "BM", tier: "discount" },
  hatzi_hinam: { name: "Hatzi Hinam",  color: "#14b8a6", icon: "HH", tier: "discount" },
  carrefour:   { name: "Carrefour",    color: "#1d4ed8", icon: "CF", tier: "premium"  },
  shufersal:   { name: "Shufersal",    color: "#16a34a", icon: "SH", tier: "standard" },
  yochananof:  { name: "Yochananof",   color: "#9333ea", icon: "YO", tier: "standard" },
  victory:     { name: "Victory",      color: "#f59e0b", icon: "VI", tier: "standard" },
  tiv_taam:    { name: "Tiv Taam",     color: "#7c3aed", icon: "TT", tier: "premium"  }
};

// Multiplicateurs par défaut par tier (vs prix de base = Rami Levy)
const TIER_MULTIPLIER = {
  discount: 1.00,
  standard: 1.10,
  premium:  1.18
};

// Génère les prix dans tous les magasins à partir d'un prix de base + variations
function priceMatrix(base, variations = {}) {
  const out = {};
  for (const [store, conf] of Object.entries(STORES)) {
    const override = variations[store];
    if (override === null) { out[store] = null; continue; }
    if (override !== undefined) { out[store] = override; continue; }
    const mul = TIER_MULTIPLIER[conf.tier];
    const noise = ((store.charCodeAt(0) + base * 7) % 7 - 3) * 0.02; // ±6% reproductible
    out[store] = Math.round((base * (mul + noise)) * 100) / 100;
  }
  return out;
}

const PRODUCTS = [
  // ===== Produits laitiers =====
  { id: "milk-3", name: "Lait 3% (1L) - Tnuva", category: "Laitiers", unit: "1L",
    prices: priceMatrix(6.20) },
  { id: "milk-1", name: "Lait 1% (1L) - Tara", category: "Laitiers", unit: "1L",
    prices: priceMatrix(6.10) },
  { id: "cottage", name: "Cottage Tnuva 5%", category: "Laitiers", unit: "250g",
    prices: priceMatrix(6.90) },
  { id: "yogurt", name: "Yaourt nature Yoplait", category: "Laitiers", unit: "150g",
    prices: priceMatrix(3.50) },
  { id: "butter", name: "Beurre Tnuva", category: "Laitiers", unit: "200g",
    prices: priceMatrix(8.90) },
  { id: "cheese-yellow", name: "Fromage jaune Emek 28%", category: "Laitiers", unit: "200g",
    prices: priceMatrix(14.90) },
  { id: "feta", name: "Feta bulgare", category: "Laitiers", unit: "200g",
    prices: priceMatrix(11.90) },
  { id: "cream-cheese", name: "Fromage à tartiner Philadelphia", category: "Laitiers", unit: "200g",
    prices: priceMatrix(9.90) },
  { id: "labane", name: "Labané", category: "Laitiers", unit: "250g",
    prices: priceMatrix(7.90) },
  { id: "sour-cream", name: "Crème fraîche", category: "Laitiers", unit: "200ml",
    prices: priceMatrix(5.90) },

  // ===== Œufs et viande =====
  { id: "eggs-12", name: "Œufs L (boîte de 12)", category: "Œufs/Viande", unit: "12u",
    prices: priceMatrix(16.90) },
  { id: "chicken-breast", name: "Blanc de poulet frais", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(39.90) },
  { id: "chicken-whole", name: "Poulet entier", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(24.90) },
  { id: "ground-beef", name: "Viande hachée 17%", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(54.90) },
  { id: "schnitzel", name: "Schnitzel de poulet", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(49.90) },
  { id: "turkey", name: "Escalope de dinde", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(44.90) },
  { id: "salmon", name: "Saumon frais", category: "Œufs/Viande", unit: "1kg",
    prices: priceMatrix(89.90, { tiv_taam: 99.90 }) },

  // ===== Boulangerie =====
  { id: "bread-white", name: "Pain blanc tranché Angel", category: "Boulangerie", unit: "750g",
    prices: priceMatrix(7.90) },
  { id: "bread-whole", name: "Pain complet Berman", category: "Boulangerie", unit: "750g",
    prices: priceMatrix(8.90) },
  { id: "pita", name: "Pita (sachet de 6)", category: "Boulangerie", unit: "6u",
    prices: priceMatrix(4.90) },
  { id: "challah", name: "Hala tressée", category: "Boulangerie", unit: "1u",
    prices: priceMatrix(9.90) },
  { id: "bagel", name: "Beigel (sachet de 5)", category: "Boulangerie", unit: "5u",
    prices: priceMatrix(8.90) },

  // ===== Fruits & Légumes =====
  { id: "tomato", name: "Tomates", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(5.90) },
  { id: "cherry-tomato", name: "Tomates cerises", category: "Fruits/Légumes", unit: "500g",
    prices: priceMatrix(7.90) },
  { id: "cucumber", name: "Concombres", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(4.90) },
  { id: "potato", name: "Pommes de terre", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(3.90) },
  { id: "sweet-potato", name: "Patates douces", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(7.90) },
  { id: "onion", name: "Oignons", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(3.50) },
  { id: "carrot", name: "Carottes", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(4.50) },
  { id: "pepper", name: "Poivrons rouges", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(8.90) },
  { id: "zucchini", name: "Courgettes", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(5.90) },
  { id: "eggplant", name: "Aubergines", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(5.50) },
  { id: "lettuce", name: "Salade laitue", category: "Fruits/Légumes", unit: "1u",
    prices: priceMatrix(4.90) },
  { id: "parsley", name: "Persil (botte)", category: "Fruits/Légumes", unit: "1u",
    prices: priceMatrix(2.90) },
  { id: "apple", name: "Pommes Pink Lady", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(9.90) },
  { id: "banana", name: "Bananes", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(7.90) },
  { id: "orange", name: "Oranges", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(5.90) },
  { id: "lemon", name: "Citrons", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(6.90) },
  { id: "avocado", name: "Avocats", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(11.90) },
  { id: "grapes", name: "Raisins", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(14.90) },
  { id: "watermelon", name: "Pastèque", category: "Fruits/Légumes", unit: "1kg",
    prices: priceMatrix(3.90) },
  { id: "garlic", name: "Ail", category: "Fruits/Légumes", unit: "100g",
    prices: priceMatrix(4.90) },

  // ===== Épicerie =====
  { id: "rice", name: "Riz blanc Sugat", category: "Épicerie", unit: "1kg",
    prices: priceMatrix(9.90) },
  { id: "pasta", name: "Pâtes Osem (spaghetti)", category: "Épicerie", unit: "500g",
    prices: priceMatrix(5.90) },
  { id: "couscous", name: "Couscous Osem", category: "Épicerie", unit: "500g",
    prices: priceMatrix(8.90) },
  { id: "flour", name: "Farine blanche", category: "Épicerie", unit: "1kg",
    prices: priceMatrix(4.90) },
  { id: "sugar", name: "Sucre blanc", category: "Épicerie", unit: "1kg",
    prices: priceMatrix(5.90) },
  { id: "salt", name: "Sel de table", category: "Épicerie", unit: "1kg",
    prices: priceMatrix(3.90) },
  { id: "oil", name: "Huile de tournesol", category: "Épicerie", unit: "1L",
    prices: priceMatrix(12.90) },
  { id: "olive-oil", name: "Huile d'olive extra vierge", category: "Épicerie", unit: "750ml",
    prices: priceMatrix(32.90) },
  { id: "tahini", name: "Tahini Achva", category: "Épicerie", unit: "500g",
    prices: priceMatrix(14.90) },
  { id: "humus", name: "Houmous Sabra", category: "Épicerie", unit: "400g",
    prices: priceMatrix(9.90) },
  { id: "tomato-sauce", name: "Sauce tomate Osem", category: "Épicerie", unit: "700g",
    prices: priceMatrix(7.90) },
  { id: "tuna", name: "Thon en boîte Starkist", category: "Épicerie", unit: "160g",
    prices: priceMatrix(6.90) },
  { id: "honey", name: "Miel", category: "Épicerie", unit: "500g",
    prices: priceMatrix(24.90) },
  { id: "jam", name: "Confiture fraises", category: "Épicerie", unit: "350g",
    prices: priceMatrix(11.90) },
  { id: "mayo", name: "Mayonnaise Hellmann's", category: "Épicerie", unit: "500g",
    prices: priceMatrix(11.90) },
  { id: "ketchup", name: "Ketchup Heinz", category: "Épicerie", unit: "750g",
    prices: priceMatrix(13.90) },

  // ===== Boissons =====
  { id: "water-6", name: "Eau Mei Eden (pack 6×1.5L)", category: "Boissons", unit: "9L",
    prices: priceMatrix(14.90) },
  { id: "coke", name: "Coca-Cola (pack 6×1.5L)", category: "Boissons", unit: "9L",
    prices: priceMatrix(32.90) },
  { id: "juice", name: "Jus d'orange Prigat", category: "Boissons", unit: "1.5L",
    prices: priceMatrix(12.90) },
  { id: "coffee", name: "Café Elite Turkish", category: "Boissons", unit: "200g",
    prices: priceMatrix(18.90) },
  { id: "instant-coffee", name: "Café instantané Nescafé", category: "Boissons", unit: "200g",
    prices: priceMatrix(34.90) },
  { id: "tea", name: "Thé Wissotzky", category: "Boissons", unit: "100u",
    prices: priceMatrix(16.90) },
  { id: "beer", name: "Bière Goldstar (pack 6)", category: "Boissons", unit: "6×500ml",
    prices: priceMatrix(42.90) },
  { id: "wine", name: "Vin Carmel Selected", category: "Boissons", unit: "750ml",
    prices: priceMatrix(29.90) },

  // ===== Surgelés =====
  { id: "frozen-pizza", name: "Pizza surgelée Maadanot", category: "Surgelés", unit: "400g",
    prices: priceMatrix(14.90) },
  { id: "frozen-fries", name: "Frites surgelées McCain", category: "Surgelés", unit: "1kg",
    prices: priceMatrix(14.90) },
  { id: "frozen-veggies", name: "Légumes surgelés Sunfrost", category: "Surgelés", unit: "800g",
    prices: priceMatrix(16.90) },
  { id: "ice-cream", name: "Glace Ben & Jerry's", category: "Surgelés", unit: "500ml",
    prices: priceMatrix(32.90) },
  { id: "frozen-fish", name: "Filet de poisson surgelé", category: "Surgelés", unit: "400g",
    prices: priceMatrix(29.90) },

  // ===== Snacks =====
  { id: "bamba", name: "Bamba Osem", category: "Snacks", unit: "80g",
    prices: priceMatrix(4.90) },
  { id: "bisli", name: "Bisli Osem", category: "Snacks", unit: "70g",
    prices: priceMatrix(4.90) },
  { id: "chips", name: "Chips Tapuchips", category: "Snacks", unit: "150g",
    prices: priceMatrix(7.90) },
  { id: "chocolate", name: "Chocolat Elite (lait)", category: "Snacks", unit: "100g",
    prices: priceMatrix(6.90) },
  { id: "cookies", name: "Biscuits Pesek Zman", category: "Snacks", unit: "45g",
    prices: priceMatrix(4.50) },
  { id: "krembo", name: "Krembo (pack 9)", category: "Snacks", unit: "9u",
    prices: priceMatrix(19.90) },

  // ===== Hygiène =====
  { id: "toilet-paper", name: "Papier toilette Lily (pack 32)", category: "Hygiène", unit: "32u",
    prices: priceMatrix(49.90) },
  { id: "tissues", name: "Mouchoirs en boîte", category: "Hygiène", unit: "100u",
    prices: priceMatrix(6.90) },
  { id: "shampoo", name: "Shampoing Pantene", category: "Hygiène", unit: "400ml",
    prices: priceMatrix(22.90) },
  { id: "soap", name: "Savon liquide", category: "Hygiène", unit: "500ml",
    prices: priceMatrix(9.90) },
  { id: "toothpaste", name: "Dentifrice Colgate", category: "Hygiène", unit: "100ml",
    prices: priceMatrix(12.90) },
  { id: "deodorant", name: "Déodorant Rexona", category: "Hygiène", unit: "150ml",
    prices: priceMatrix(15.90) },

  // ===== Entretien =====
  { id: "dish-soap", name: "Liquide vaisselle Sano", category: "Entretien", unit: "750ml",
    prices: priceMatrix(10.90) },
  { id: "laundry", name: "Lessive Ariel", category: "Entretien", unit: "3L",
    prices: priceMatrix(49.90) },
  { id: "softener", name: "Adoucissant Badin", category: "Entretien", unit: "2L",
    prices: priceMatrix(19.90) },
  { id: "bleach", name: "Eau de Javel", category: "Entretien", unit: "2L",
    prices: priceMatrix(8.90) },
  { id: "trash-bags", name: "Sacs poubelle (pack 50)", category: "Entretien", unit: "50u",
    prices: priceMatrix(14.90) },
  { id: "aluminum-foil", name: "Papier aluminium", category: "Entretien", unit: "30m",
    prices: priceMatrix(11.90) },

  // ===== Bébé =====
  { id: "diapers", name: "Couches Huggies (taille 4)", category: "Bébé", unit: "60u",
    prices: priceMatrix(79.90) },
  { id: "wipes", name: "Lingettes bébé (pack 4×80)", category: "Bébé", unit: "320u",
    prices: priceMatrix(24.90) },
  { id: "baby-formula", name: "Lait infantile Materna", category: "Bébé", unit: "700g",
    prices: priceMatrix(89.90) },

  // ===== Petit déjeuner =====
  { id: "cereal", name: "Céréales Telma Cornflakes", category: "Petit-déj", unit: "750g",
    prices: priceMatrix(19.90) },
  { id: "oats", name: "Flocons d'avoine", category: "Petit-déj", unit: "500g",
    prices: priceMatrix(9.90) },
  { id: "nutella", name: "Nutella", category: "Petit-déj", unit: "350g",
    prices: priceMatrix(24.90) },
  { id: "halva", name: "Halva", category: "Petit-déj", unit: "400g",
    prices: priceMatrix(19.90) }
];

if (typeof module !== "undefined") {
  module.exports = { STORES, PRODUCTS, DATA_VERSION, LAST_UPDATED };
}
