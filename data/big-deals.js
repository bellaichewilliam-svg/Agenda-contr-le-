// ============================================================================
// PrixMalin — Big Deals (non-alimentaire) v1
// Promos sur électroménager, meubles, multimédia, mode, beauté, etc.
// Inspiré du concept Bonial mais 100% nos propres données.
// ============================================================================

// Catégories non-alimentaires
const BIG_CATEGORIES = {
  appliance: { name: "🏠 Électroménager", color: "#0EA5E9", icon: "🏠" },
  furniture: { name: "🛋️ Meubles & déco", color: "#A855F7", icon: "🛋️" },
  multimedia: { name: "📺 Multimédia & high-tech", color: "#3B82F6", icon: "📺" },
  fashion: { name: "👗 Mode", color: "#EC4899", icon: "👗" },
  beauty: { name: "💄 Beauté & soins", color: "#F43F5E", icon: "💄" },
  diy: { name: "🔨 Bricolage & jardin", color: "#84CC16", icon: "🔨" },
  baby: { name: "🍼 Bébé & enfant", color: "#F59E0B", icon: "🍼" },
  sport: { name: "⚽ Sport & loisirs", color: "#10B981", icon: "⚽" },
  petfood: { name: "🐕 Animaux", color: "#8B5CF6", icon: "🐕" }
};

// Magasins additionnels pour le non-alimentaire (en Israël)
const BIG_STORES = {
  ikea:        { name: "IKEA",          color: "#0058A3", icon: "🛏️", category: "furniture" },
  ace:         { name: "ACE",           color: "#E60000", icon: "🔧", category: "diy" },
  home_center: { name: "Home Center",   color: "#F97316", icon: "🏠", category: "appliance" },
  bug:         { name: "BUG",           color: "#0099FF", icon: "💻", category: "multimedia" },
  ksp:         { name: "KSP",           color: "#1E40AF", icon: "🖥️", category: "multimedia" },
  fox:         { name: "Fox",           color: "#000000", icon: "👕", category: "fashion" },
  super_pharm: { name: "Super-Pharm",   color: "#E11D48", icon: "💊", category: "beauty" },
  toys_r_us:   { name: "Toys R Us",     color: "#1E40AF", icon: "🧸", category: "baby" },
  decathlon:   { name: "Decathlon",     color: "#0082C3", icon: "⚽", category: "sport" },
  zoo_land:    { name: "Zoo Land",      color: "#8B5CF6", icon: "🐾", category: "petfood" }
};

// Exemples concrets de promos non-alimentaires
// (Les vraies promos seront fetchées plus tard — pour l'instant exemples réalistes)
const BIG_DEALS = [
  // ===== ÉLECTROMÉNAGER =====
  {
    id: "deal-fridge-lg-350",
    category: "appliance",
    store: "home_center",
    name: "Réfrigérateur LG 350L No Frost",
    brand: "LG",
    emoji: "🧊",
    color: "#0EA5E9",
    original_price: 4499,
    discounted_price: 3199,
    discount_rate: 0.29,
    description: "Classe A+, double porte, distributeur d'eau",
    valid_until: "2026-05-31",
    image: null  // URL optionnelle (sinon emoji utilisé)
  },
  {
    id: "deal-washer-bosch-8kg",
    category: "appliance",
    store: "home_center",
    name: "Lave-linge Bosch 8kg",
    brand: "Bosch",
    emoji: "🧺",
    color: "#0EA5E9",
    original_price: 3290,
    discounted_price: 2490,
    discount_rate: 0.24,
    description: "1400 trs/min, classe A+++, programme rapide 15 min",
    valid_until: "2026-05-25"
  },
  {
    id: "deal-microwave-samsung",
    category: "appliance",
    store: "ace",
    name: "Micro-ondes Samsung 25L",
    brand: "Samsung",
    emoji: "📡",
    color: "#0EA5E9",
    original_price: 549,
    discounted_price: 379,
    discount_rate: 0.31,
    description: "Grill intégré, 900W, 6 niveaux de puissance",
    valid_until: "2026-05-20"
  },
  {
    id: "deal-airfryer-philips",
    category: "appliance",
    store: "ace",
    name: "Friteuse air Philips XL 6.2L",
    brand: "Philips",
    emoji: "🍟",
    color: "#0EA5E9",
    original_price: 899,
    discounted_price: 549,
    discount_rate: 0.39,
    description: "Sans huile, 7 programmes, écran tactile",
    valid_until: "2026-05-28"
  },

  // ===== MEUBLES =====
  {
    id: "deal-couch-klippan",
    category: "furniture",
    store: "ikea",
    name: "Canapé KLIPPAN 2 places",
    brand: "IKEA",
    emoji: "🛋️",
    color: "#A855F7",
    original_price: 1690,
    discounted_price: 1290,
    discount_rate: 0.24,
    description: "Tissu Vansbro gris foncé, housse lavable",
    valid_until: "2026-06-15"
  },
  {
    id: "deal-bed-malm",
    category: "furniture",
    store: "ikea",
    name: "Lit MALM 160x200 + 2 tiroirs",
    brand: "IKEA",
    emoji: "🛏️",
    color: "#A855F7",
    original_price: 2199,
    discounted_price: 1599,
    discount_rate: 0.27,
    description: "Placage chêne blanchi, sommier inclus",
    valid_until: "2026-06-01"
  },
  {
    id: "deal-table-dining",
    category: "furniture",
    store: "ikea",
    name: "Table à manger 6 personnes",
    brand: "IKEA",
    emoji: "🪑",
    color: "#A855F7",
    original_price: 1490,
    discounted_price: 990,
    discount_rate: 0.34,
    description: "Bois massif, 200×85 cm",
    valid_until: "2026-05-31"
  },

  // ===== MULTIMÉDIA =====
  {
    id: "deal-tv-samsung-55",
    category: "multimedia",
    store: "bug",
    name: "TV Samsung 55\" 4K Crystal UHD",
    brand: "Samsung",
    emoji: "📺",
    color: "#3B82F6",
    original_price: 2499,
    discounted_price: 1899,
    discount_rate: 0.24,
    description: "Smart TV Tizen, HDR10+, 3 ports HDMI",
    valid_until: "2026-05-22"
  },
  {
    id: "deal-iphone-15",
    category: "multimedia",
    store: "ksp",
    name: "iPhone 15 128 Go",
    brand: "Apple",
    emoji: "📱",
    color: "#3B82F6",
    original_price: 4290,
    discounted_price: 3890,
    discount_rate: 0.09,
    description: "Garantie officielle Apple Israel",
    valid_until: "2026-05-30"
  },
  {
    id: "deal-headphones-sony",
    category: "multimedia",
    store: "bug",
    name: "Casque Sony WH-1000XM5",
    brand: "Sony",
    emoji: "🎧",
    color: "#3B82F6",
    original_price: 1599,
    discounted_price: 1099,
    discount_rate: 0.31,
    description: "Bluetooth, réduction de bruit, 30h d'autonomie",
    valid_until: "2026-05-18"
  },
  {
    id: "deal-laptop-lenovo",
    category: "multimedia",
    store: "ksp",
    name: "PC portable Lenovo IdeaPad 15.6\"",
    brand: "Lenovo",
    emoji: "💻",
    color: "#3B82F6",
    original_price: 2890,
    discounted_price: 2190,
    discount_rate: 0.24,
    description: "Intel i5, 16 Go RAM, SSD 512 Go",
    valid_until: "2026-05-25"
  },

  // ===== MODE =====
  {
    id: "deal-jeans-fox",
    category: "fashion",
    store: "fox",
    name: "Jean slim homme",
    brand: "Fox",
    emoji: "👖",
    color: "#EC4899",
    original_price: 199,
    discounted_price: 99,
    discount_rate: 0.5,
    description: "Du 28 au 38, 5 coloris disponibles",
    valid_until: "2026-05-15"
  },
  {
    id: "deal-tshirts-fox",
    category: "fashion",
    store: "fox",
    name: "Pack 3 T-shirts coton",
    brand: "Fox",
    emoji: "👕",
    color: "#EC4899",
    original_price: 149,
    discounted_price: 89,
    discount_rate: 0.4,
    description: "100% coton bio, du S au XXL",
    valid_until: "2026-05-20"
  },

  // ===== BEAUTÉ =====
  {
    id: "deal-shampoo-loreal",
    category: "beauty",
    store: "super_pharm",
    name: "Shampoing L'Oréal Elseve 700ml",
    brand: "L'Oréal",
    emoji: "🧴",
    color: "#F43F5E",
    original_price: 39.90,
    discounted_price: 24.90,
    discount_rate: 0.38,
    description: "Différents soins disponibles",
    valid_until: "2026-05-15"
  },
  {
    id: "deal-perfume-paco",
    category: "beauty",
    store: "super_pharm",
    name: "Paco Rabanne 1 Million 100ml",
    brand: "Paco Rabanne",
    emoji: "💎",
    color: "#F43F5E",
    original_price: 449,
    discounted_price: 329,
    discount_rate: 0.27,
    description: "Eau de toilette homme",
    valid_until: "2026-05-31"
  },
  {
    id: "deal-cream-nivea",
    category: "beauty",
    store: "super_pharm",
    name: "Crème Nivea Soft 200ml × 2",
    brand: "Nivea",
    emoji: "🧴",
    color: "#F43F5E",
    original_price: 49.90,
    discounted_price: 29.90,
    discount_rate: 0.4,
    description: "Lot de 2, peau normale à sèche",
    valid_until: "2026-05-25"
  },

  // ===== BRICOLAGE =====
  {
    id: "deal-drill-bosch",
    category: "diy",
    store: "ace",
    name: "Perceuse Bosch 18V + 2 batteries",
    brand: "Bosch",
    emoji: "🔩",
    color: "#84CC16",
    original_price: 799,
    discounted_price: 549,
    discount_rate: 0.31,
    description: "Mallette + 30 accessoires inclus",
    valid_until: "2026-05-22"
  },
  {
    id: "deal-bbq-weber",
    category: "diy",
    store: "ace",
    name: "Barbecue gaz Weber Q1200",
    brand: "Weber",
    emoji: "🍖",
    color: "#84CC16",
    original_price: 1299,
    discounted_price: 999,
    discount_rate: 0.23,
    description: "Allumage électronique, table latérale",
    valid_until: "2026-06-01"
  },

  // ===== BÉBÉ =====
  {
    id: "deal-stroller",
    category: "baby",
    store: "toys_r_us",
    name: "Poussette Chicco + nacelle",
    brand: "Chicco",
    emoji: "🚼",
    color: "#F59E0B",
    original_price: 1990,
    discounted_price: 1290,
    discount_rate: 0.35,
    description: "3 en 1 : poussette + nacelle + coque auto",
    valid_until: "2026-05-30"
  },
  {
    id: "deal-diapers-pampers",
    category: "baby",
    store: "super_pharm",
    name: "Couches Pampers Pack 2 mois",
    brand: "Pampers",
    emoji: "🍼",
    color: "#F59E0B",
    original_price: 399,
    discounted_price: 249,
    discount_rate: 0.38,
    description: "Tailles 2 à 5 disponibles, 192 couches",
    valid_until: "2026-05-20"
  },

  // ===== SPORT =====
  {
    id: "deal-bike-decathlon",
    category: "sport",
    store: "decathlon",
    name: "VTT Rockrider ST 100",
    brand: "Decathlon",
    emoji: "🚴",
    color: "#10B981",
    original_price: 1299,
    discounted_price: 899,
    discount_rate: 0.31,
    description: "21 vitesses Shimano, suspension avant",
    valid_until: "2026-05-25"
  },
  {
    id: "deal-yoga-mat",
    category: "sport",
    store: "decathlon",
    name: "Tapis yoga + accessoires",
    brand: "Decathlon",
    emoji: "🧘",
    color: "#10B981",
    original_price: 199,
    discounted_price: 99,
    discount_rate: 0.5,
    description: "Tapis 6mm + sangle + 2 blocs",
    valid_until: "2026-05-15"
  },

  // ===== ANIMAUX =====
  {
    id: "deal-dogfood-royal",
    category: "petfood",
    store: "zoo_land",
    name: "Croquettes Royal Canin 15kg",
    brand: "Royal Canin",
    emoji: "🐕",
    color: "#8B5CF6",
    original_price: 449,
    discounted_price: 329,
    discount_rate: 0.27,
    description: "Pour chiens adultes de moyenne taille",
    valid_until: "2026-05-31"
  },
  {
    id: "deal-cat-litter",
    category: "petfood",
    store: "zoo_land",
    name: "Litière chat 15kg × 2",
    brand: "Cat's Best",
    emoji: "🐈",
    color: "#8B5CF6",
    original_price: 199,
    discounted_price: 139,
    discount_rate: 0.3,
    description: "Lot de 2 sacs, agglomérante naturelle",
    valid_until: "2026-05-20"
  }
];

// Helper : retourne les promos pour une catégorie donnée
function getBigDealsByCategory(catId) {
  if (!catId) return BIG_DEALS;
  return BIG_DEALS.filter(d => d.category === catId);
}

// Helper : retourne les promos pour un magasin
function getBigDealsByStore(storeId) {
  return BIG_DEALS.filter(d => d.store === storeId);
}

// Helper : compter promos par catégorie
function countBigDealsByCategory() {
  const counts = {};
  BIG_DEALS.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
  return counts;
}

// Expose globally
if (typeof window !== "undefined") {
  window.BIG_CATEGORIES = BIG_CATEGORIES;
  window.BIG_STORES = BIG_STORES;
  window.BIG_DEALS = BIG_DEALS;
  window.getBigDealsByCategory = getBigDealsByCategory;
  window.getBigDealsByStore = getBigDealsByStore;
  window.countBigDealsByCategory = countBigDealsByCategory;
}
