// PrixMalin - logique principale
// Dépend de : data/products.js (STORES, PRODUCTS, LAST_UPDATED)
//             data/i18n.js (I18N, PRODUCT_I18N)

const STORAGE_KEY = "prixmalin.state.v4";
const STORAGE_KEY_V3 = "prixmalin.state.v3";
const STORAGE_KEY_V2 = "prixmalin.cart.v2";
const STORAGE_KEY_V1 = "prixmalin.cart.v1";

// ========== ÉTAT ==========
// state.lists: { [listId]: { name, cart: { [pid]: {qty,done} }, createdAt } }
const state = loadState();

function defaultState() {
  const id = newId();
  return {
    activeListId: id,
    lists: {
      [id]: { name: "", cart: {}, createdAt: Date.now() }
    },
    frequency: {},     // { pid: count }
    lang: detectLang(),
    theme: "auto",     // "auto" | "light" | "dark"
    shoppingMode: false,
    mode: "optimized", // "optimized" (défaut, classement auto) | "single"
    activeCategory: null,
    searchQuery: "",
    hideDone: false
  };
}
function detectLang() {
  const stored = (() => { try { return localStorage.getItem("prixmalin.lang"); } catch { return null; } })();
  if (stored && I18N[stored]) return stored;
  const nav = (navigator.language || "fr").slice(0, 2);
  if (I18N[nav]) return nav;
  return "fr";
}
function newId() { return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.lists || !s.activeListId) return defaultState();
      s.frequency = s.frequency || {};
      s.lang = (s.lang && I18N[s.lang]) ? s.lang : detectLang();
      s.theme = s.theme || "auto";
      s.mode = s.mode || "optimized";
      return s;
    }
    // migration v3 -> v4 : ajoute "store" à chaque item
    const v3 = localStorage.getItem(STORAGE_KEY_V3);
    if (v3) {
      const s = JSON.parse(v3);
      if (s.lists) {
        Object.values(s.lists).forEach(list => {
          Object.values(list.cart).forEach(item => {
            if (item.store === undefined) item.store = null;
          });
        });
        return s;
      }
    }
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const cart = JSON.parse(v2);
      Object.values(cart).forEach(it => { if (it.store === undefined) it.store = null; });
      const id = newId();
      return { ...defaultState(), activeListId: id,
               lists: { [id]: { name: "", cart, createdAt: Date.now() } } };
    }
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const old = JSON.parse(v1);
      const cart = {};
      Object.entries(old).forEach(([id, qty]) => { cart[id] = { qty, done: false, store: null }; });
      const id = newId();
      return { ...defaultState(), activeListId: id,
               lists: { [id]: { name: "", cart, createdAt: Date.now() } } };
    }
  } catch {}
  return defaultState();
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem("prixmalin.lang", state.lang);
  } catch {}
}

// Cart de la liste active (raccourci)
function activeCart() { return state.lists[state.activeListId].cart; }

// ========== I18N ==========
function t(key, vars = {}) {
  const dict = I18N[state.lang] || I18N.fr;
  let s = dict[key];
  if (s === undefined) s = (I18N.fr[key] !== undefined ? I18N.fr[key] : key);
  if (typeof s !== "string") return s;
  Object.entries(vars).forEach(([k, v]) => { s = s.replaceAll(`{${k}}`, v); });
  return s;
}
function tProduct(p) {
  if (state.lang === "fr") return p.name;
  const tr = (typeof PRODUCT_I18N !== "undefined") ? PRODUCT_I18N[p.id] : null;
  return (tr && tr[state.lang]) || p.name;
}
function tCat(cat) {
  const dict = I18N[state.lang] || I18N.fr;
  return (dict.cat && dict.cat[cat]) || cat;
}

// ========== ICÔNES PRODUITS ==========
// Mapping id-prefix -> emoji. Si pas de match, fallback sur la catégorie.
// (Emojis natifs : marche hors-ligne, multiplateforme.)
const ICON_BY_PREFIX = {
  // Laitiers
  "milk-skim": "🥛", "milk-soya": "🥛", "milk-almond": "🥛", "milk-oat": "🥛", "milk-": "🥛",
  "chocolate-milk": "🍫", "cottage": "🧀", "yogurt": "🥣", "skyr": "🥣", "leben": "🥣",
  "labane": "🧀", "white-cheese": "🧀", "butter": "🧈", "margarine": "🧈",
  "cream-cooking": "🥛", "sour-cream": "🥛", "whipping-cream": "🥛",
  "cream-cheese": "🧀", "cheese-yellow": "🧀", "gouda": "🧀", "edam": "🧀",
  "mozzarella": "🧀", "parmesan": "🧀", "feta": "🧀", "halloumi": "🧀",
  "ricotta": "🧀", "camembert": "🧀", "brie": "🧀", "blue-cheese": "🧀",
  // Œufs
  "eggs-": "🥚",
  // Viande / Volaille
  "chicken-breast": "🍗", "chicken-thigh": "🍗", "chicken-wings": "🍗",
  "chicken-whole": "🍗", "chicken-liver": "🥩", "schnitzel": "🍗",
  "ground-chicken": "🍗", "turkey-breast": "🦃", "turkey-ground": "🦃",
  "ground-beef": "🥩", "entrecote": "🥩", "rib-eye": "🥩", "beef-stew": "🥩",
  "lamb": "🍖", "kebab": "🍢", "merguez": "🌭", "hot-dog": "🌭",
  "salami": "🥓", "pastrami": "🥓",
  // Poisson
  "salmon": "🐟", "tuna-fresh": "🐟", "white-fish": "🐟", "tilapia": "🐟",
  "denis": "🐟", "sardines": "🐟", "herring": "🐟",
  // Boulangerie
  "bread-rye": "🍞", "bread-multi": "🍞", "bread-": "🍞", "baguette": "🥖",
  "pita": "🫓", "lafa": "🫓", "challah": "🥖", "bagel": "🥯",
  "tortilla": "🌮", "burger-bun": "🍔", "hot-dog-bun": "🌭", "matza": "🫓",
  "breadcrumbs": "🌾",
  // Gâteaux
  "marble-cake": "🍰", "chocolate-cake": "🎂", "cheesecake": "🍰",
  "honey-cake": "🍰", "sponge-cake": "🍰", "babka": "🍞",
  "rugelach": "🥐", "muffins": "🧁", "brownies": "🍫",
  "croissant": "🥐", "danish": "🥐", "donuts": "🍩",
  "burekas": "🥐", "tart-fruit": "🥧",
  "biscuits": "🍪", "wafers": "🍪", "cookies": "🍪", "halva": "🍯",
  // Fruits
  "apple-": "🍎", "banana": "🍌", "orange": "🍊", "clementine": "🍊",
  "grapefruit": "🍊", "lemon": "🍋", "lime": "🍋", "pear": "🍐",
  "peach": "🍑", "nectarine": "🍑", "plum": "🍑", "cherry": "🍒",
  "strawberry": "🍓", "blueberry": "🫐", "raspberry": "🍓",
  "grape-": "🍇", "watermelon": "🍉", "melon": "🍈",
  "pineapple": "🍍", "mango": "🥭", "avocado": "🥑", "kiwi": "🥝",
  "pomegranate": "🥭", "fig": "🍇", "persimmon": "🍅", "date": "🌰",
  // Légumes
  "tomato-paste": "🥫", "tomato-crushed": "🥫", "tomato-sauce": "🥫",
  "tomato-cherry": "🍅", "tomato-grape": "🍅", "tomato": "🍅",
  "cucumber": "🥒", "potato": "🥔", "sweet-potato": "🍠",
  "onion": "🧅", "shallot": "🧅", "leek": "🥬",
  "carrot": "🥕", "pepper-hot": "🌶️", "pepper-mini": "🫑", "pepper-": "🫑",
  "zucchini": "🥒", "eggplant": "🍆",
  "lettuce": "🥬", "spinach": "🥬", "kale": "🥬", "arugula": "🌿",
  "cabbage": "🥬", "cauliflower": "🥦", "broccoli": "🥦",
  "celery-root": "🥬", "celery": "🥬", "radish": "🌶️", "beet": "🍎",
  "turnip": "🥕", "pumpkin": "🎃", "corn": "🌽",
  "mushroom": "🍄", "garlic": "🧄", "ginger": "🫚",
  "parsley": "🌿", "cilantro": "🌿", "dill": "🌿", "mint": "🌿", "basil": "🌿",
  "olives": "🫒",
  // Épicerie
  "rice-": "🍚", "pasta-spaghetti": "🍝", "pasta-penne": "🍝",
  "pasta-fusilli": "🍝", "pasta-lasagna": "🍝", "pasta-noodles": "🍜",
  "pasta-": "🍝", "couscous": "🍚", "bulgur": "🌾", "quinoa": "🌾",
  "lentils": "🫘", "chickpeas": "🫘", "beans": "🫘",
  "corn-can": "🌽", "peas-can": "🟢",
  "pesto": "🌿", "soy-sauce": "🥫", "teriyaki": "🥫",
  "vinegar": "🧴", "oil-olive": "🫒", "oil-": "🫒",
  "tahini": "🥜", "humus": "🫘", "matbucha": "🥫", "harissa": "🌶️",
  "schug": "🌶️", "amba": "🥫",
  "tuna-can": "🥫", "tuna-oil": "🥫", "anchovies": "🥫",
  "ketchup": "🍅", "mustard": "🌭", "mayo": "🥚",
  "bbq-sauce": "🍖", "salsa": "🌶️",
  "soup-mix": "🍜", "stock-": "🍜",
  "salt": "🧂", "pepper": "🧂", "paprika-": "🌶️", "cumin": "🧂",
  "turmeric": "🧂", "cinnamon": "🧂", "oregano": "🌿", "zaatar": "🌿",
  // Petit-déj
  "flour": "🌾", "sugar-vanilla": "🍯", "sugar": "🍬",
  "honey": "🍯", "silan": "🍯", "maple": "🍁",
  "jam-": "🫐", "nutella": "🍫",
  "peanut-butter": "🥜", "almond-butter": "🥜",
  "cereal-": "🥣", "muesli": "🥣", "granola": "🥣", "oats": "🥣",
  // Boissons
  "water-": "💧", "coke-": "🥤", "sprite": "🥤", "fanta": "🥤", "schweppes": "🥤",
  "ice-tea": "🧋", "energy-drink": "⚡", "redbull": "⚡",
  "juice-": "🧃", "lemonade": "🍋",
  "coffee-": "☕", "tea-": "🍵",
  "beer-": "🍺", "wine-": "🍷", "vodka": "🥃", "arak": "🥃",
  // Surgelés
  "frozen-pizza": "🍕", "frozen-fries": "🍟", "frozen-wedges": "🥔",
  "frozen-veggies": "🥦", "frozen-peas": "🟢", "frozen-corn": "🌽",
  "frozen-broccoli": "🥦", "frozen-cauliflower": "🥦",
  "frozen-spinach": "🥬", "frozen-stir-fry": "🥡",
  "frozen-fish": "🐟", "frozen-shrimp": "🦐",
  "frozen-schnitzel": "🍗", "frozen-burger": "🍔",
  "frozen-nuggets": "🍗", "frozen-meatballs": "🍖",
  "frozen-puff": "🥐", "frozen-filo": "🥐",
  "ice-cream-": "🍦", "popsicles": "🍡",
  // Snacks
  "bamba": "🥜", "bisli": "🥨", "doritos": "🌽",
  "chips-tapuchips": "🥔", "chips-pringles": "🥔", "chips-": "🥔",
  "popcorn": "🍿", "pretzel": "🥨", "crackers": "🍪",
  "rice-cakes": "🍘", "nuts-mixed": "🥜", "almonds": "🥜",
  "cashew": "🥜", "pistachio": "🥜", "peanut": "🥜",
  "sunflower-seeds": "🌻", "pumpkin-seeds": "🎃",
  "dried-fruit": "🍇", "raisins": "🍇",
  "chocolate-elite": "🍫", "chocolate-dark": "🍫", "chocolate-milka": "🍫",
  "chocolate-toblerone": "🍫", "chocolate-kinder": "🍫", "chocolate-bueno": "🍫",
  "chocolate-mars": "🍫", "chocolate-snickers": "🍫", "chocolate-twix": "🍫",
  "kitkat": "🍫", "pesek-zman": "🍫", "krembo": "🍫",
  "candy-": "🍬", "gum-": "🍬",
  // Bébé
  "diapers-": "👶", "wipes": "🧻",
  "baby-formula": "🍼", "baby-cereal": "🥣", "baby-puree": "🥣",
  "baby-bottle": "🍼", "baby-pacifier": "🍼", "baby-shampoo": "🧴",
  // Hygiène
  "toilet-paper-": "🧻", "tissues-": "🤧", "paper-towel": "🧻",
  "shampoo-": "🧴", "conditioner": "🧴",
  "soap-liquid": "🧼", "soap-bar": "🧼", "shower-gel": "🚿",
  "toothpaste": "🪥", "toothbrush": "🪥", "mouthwash": "🌿",
  "deodorant-": "🧴", "razor": "🪒", "shaving-cream": "🧴",
  "tampons": "🩸", "pads": "🩸", "cotton": "☁️", "qtips": "🦴",
  "sunscreen": "☀️", "moisturizer": "🧴",
  // Entretien
  "dish-soap": "🧽", "dish-tab": "🧽",
  "laundry-": "🧺", "softener": "🌸", "stain-remover": "🧼",
  "bleach": "🧴", "floor-cleaner": "🧹", "glass-cleaner": "🧴",
  "kitchen-cleaner": "🧴", "bathroom-cleaner": "🚿", "toilet-cleaner": "🚽",
  "drain-cleaner": "🧴", "trash-bags-": "🗑️",
  "aluminum-foil": "📜", "plastic-wrap": "📜", "baking-paper": "📜",
  "sponges": "🧽", "rubber-gloves": "🧤", "air-freshener": "🌸",
  "matches": "🔥", "candles": "🕯️", "batteries-": "🔋", "lightbulb": "💡",
  // Animaux
  "dog-food-": "🐕", "cat-food-": "🐈", "cat-litter": "🐈"
};
const ICON_BY_CAT = {
  "Laitiers": "🥛", "Œufs": "🥚", "Viande": "🥩", "Poisson": "🐟",
  "Boulangerie": "🍞", "Gâteaux": "🍰", "Fruits": "🍎", "Légumes": "🥕",
  "Épicerie": "🥫", "Petit-déj": "🥣", "Boissons": "🥤", "Surgelés": "❄️",
  "Snacks": "🍿", "Bébé": "👶", "Hygiène": "🧼", "Entretien": "🧴", "Animaux": "🐾"
};
// Couleur de fond du chip selon catégorie
const CAT_TINT = {
  "Laitiers": "#fef3c7", "Œufs": "#fef9c3", "Viande": "#fee2e2", "Poisson": "#dbeafe",
  "Boulangerie": "#fed7aa", "Gâteaux": "#fce7f3", "Fruits": "#fee2e2", "Légumes": "#dcfce7",
  "Épicerie": "#fef3c7", "Petit-déj": "#fed7aa", "Boissons": "#dbeafe", "Surgelés": "#cffafe",
  "Snacks": "#fde68a", "Bébé": "#fce7f3", "Hygiène": "#e0e7ff", "Entretien": "#e0e7ff", "Animaux": "#fef3c7"
};
function productIcon(p) {
  if (!p) return "🛒";
  let bestKey = null;
  for (const k of Object.keys(ICON_BY_PREFIX)) {
    if (p.id === k || p.id.startsWith(k)) {
      if (!bestKey || k.length > bestKey.length) bestKey = k;
    }
  }
  if (bestKey) return ICON_BY_PREFIX[bestKey];
  return ICON_BY_CAT[p.category] || "🛒";
}
function productTint(p) {
  if (!p) return "#e0e7ff";
  return CAT_TINT[p.category] || "#e0e7ff";
}

// ========== PHOTOS PRODUITS (DÉSACTIVÉES) ==========
// L'auto-fetch via OFF/Wikimedia donnait trop de faux positifs
// (ex : "camembert" affiché pour "lait d'amande"). On garde uniquement
// l'icône emoji jusqu'à ce que le scraper officiel fournisse les vraies
// photos depuis les flux des supermarchés.
function setupImageObserver() {}
function observeProductIcons() {}

// ========== DESCRIPTIONS ==========
const PRODUCT_DESC = {
  "milk-3": "Lait entier 3% de matière grasse, brique 1L. Le classique pour le café et la cuisine.",
  "milk-1": "Lait demi-écrémé 1% MG, plus léger. Brique 1L Tara.",
  "milk-skim": "Lait écrémé 0% MG. Tnuva, brique 1L.",
  "cottage": "Fromage frais granuleux 5% MG. Idéal pour le petit-déjeuner ou les salades.",
  "yogurt-greek": "Yaourt grec épais et crémeux. Riche en protéines.",
  "feta": "Feta bulgare au lait de brebis. Pour salades et pâtisseries salées.",
  "eggs-12-l": "Œufs taille L, boîte de 12. Calibre standard pour la plupart des recettes.",
  "chicken-breast": "Blanc de poulet frais désossé. Au kg, à cuire le jour-même.",
  "ground-beef-17": "Bœuf haché frais 17% MG. Pour boulettes, sauces, hamburgers maison.",
  "salmon-fillet": "Filet de saumon Atlantique, frais. Sans peau, prêt à cuire.",
  "bread-white": "Pain blanc tranché Angel, 750g. Conservation 5 jours.",
  "challah": "Pain tressé traditionnel pour Shabbat. Cuit le vendredi.",
  "tomato": "Tomates fraîches, au kg. Variété ronde, mûres à point.",
  "cucumber": "Concombres israéliens (small/baby). Croquants, sans graines.",
  "potato": "Pommes de terre tout-usage, au kg. Convient à toutes les cuissons.",
  "onion": "Oignons jaunes au kg. Base de toute cuisine.",
  "pepper-red": "Poivrons rouges au kg. Parfaits crus ou grillés.",
  "avocado": "Avocats Hass au kg. Vendus presque mûrs.",
  "rice-white": "Riz blanc long grain Sugat, 1kg. Le riz quotidien.",
  "rice-basmati": "Riz basmati premium, 1kg. Pour les plats indiens et iraniens.",
  "pasta-spaghetti": "Spaghetti Osem, 500g. Pâtes italiennes classiques.",
  "oil-olive": "Huile d'olive extra vierge 750ml. Pour assaisonnement et cuisson douce.",
  "tahini": "Tahini Achva 100% sésame, 500g. Base pour sauces et houmous maison.",
  "humus": "Houmous Sabra prêt à servir, 400g. Avec un filet d'huile d'olive.",
  "honey": "Miel pur 500g. Conservation indéfinie.",
  "nutella": "Pâte à tartiner choco-noisettes 350g.",
  "pepper": "Poivre noir moulu, 100g. Pour assaisonnement quotidien.",
  "pepper-white": "Poivre blanc moulu, 100g. Plus doux, idéal pour sauces blanches.",
  "salt": "Sel de table fin, 1kg. Iodé.",
  "yeast": "Levure de boulanger sèche, 50g. Pour pains et brioches maison.",
  "baking-powder": "Levure chimique, 200g. Pour gâteaux et pâtes à frire.",
  "baking-soda": "Bicarbonate de soude, 500g. Pâtisserie et nettoyage.",
  "vanilla-extract": "Extrait de vanille pur, 30ml. Quelques gouttes suffisent.",
  "cocoa-powder": "Cacao non sucré, 200g. Pour pâtisseries et boissons.",
  "diapers-4": "Couches Huggies taille 4 (9-14kg), pack 60. Absorption 12h.",
  "wipes": "Lingettes bébé Huggies, 4 paquets de 80. Sans alcool, hypoallergéniques.",
  "toilet-paper-32": "Papier toilette Lily 3 plis, pack 32 rouleaux. Format économique.",
  "shampoo-pantene": "Shampoing Pantene Pro-V, 400ml. Tous types de cheveux.",
  "toothpaste": "Dentifrice Colgate Total, 100ml. Protection 12h.",
  "dish-soap": "Liquide vaisselle Sano concentré, 750ml. Anti-graisse.",
  "laundry-ariel": "Lessive liquide Ariel 3L. ~60 lavages.",
  "coffee-turkish": "Café moulu Elite Turkish, 200g. Pour café à la turque.",
  "coke-1.5": "Coca-Cola bouteille 1.5L. Vendu à l'unité.",
  "water-6pack": "Eau minérale Mei Eden, pack de 6 bouteilles 1.5L (9L total).",
  "tea-wissotzky": "Thé noir Wissotzky, boîte de 100 sachets.",
  "beer-goldstar": "Bière Goldstar, pack 6 canettes 500ml. Bière israélienne classique.",
  "wine-carmel": "Vin rouge Carmel Selected, 750ml. Cabernet Sauvignon. Cacher.",
  "frozen-pizza": "Pizza surgelée Maadanot, 400g. 12-15min au four.",
  "ice-cream-bens": "Glace Ben & Jerry's, pot 500ml. À conserver à -18°C.",
  "bamba": "Bamba Osem cacahuètes, 80g. Le snack israélien iconique.",
  "chocolate-elite": "Chocolat au lait Elite, tablette 100g.",
  "krembo": "Krembo (mousse de marshmallow chocolatée), pack 9. Hiver uniquement."
};
function getDescription(p) {
  if (!p) return "";
  if (PRODUCT_DESC[p.id]) return PRODUCT_DESC[p.id];
  return `${tCat(p.category)} · ${p.unit}`;
}

// Composition / ingrédients pour les produits manufacturés
const PRODUCT_COMPOSITION = {
  "milk-3":         { brand: "Tnuva", origin: "Israël", ingredients: "Lait entier pasteurisé homogénéisé.", nutrition: "Énergie 64 kcal · Protéines 3.3g · MG 3% · Glucides 4.7g · Calcium 120mg / 100ml" },
  "milk-1":         { brand: "Tara",  origin: "Israël", ingredients: "Lait demi-écrémé pasteurisé.", nutrition: "Énergie 46 kcal · Protéines 3.4g · MG 1% · Glucides 4.8g / 100ml" },
  "cottage":        { brand: "Tnuva", origin: "Israël", ingredients: "Fromage frais (lait pasteurisé, ferments lactiques, sel), crème.", nutrition: "Énergie 105 kcal · Protéines 11g · MG 5% / 100g" },
  "yogurt-greek":   { brand: "Tnuva", origin: "Israël", ingredients: "Lait pasteurisé, crème, ferments lactiques.", nutrition: "Énergie 95 kcal · Protéines 7g · MG 5% / 100g" },
  "feta":           { brand: "Bulgare", origin: "Bulgarie", ingredients: "Lait de brebis et chèvre pasteurisé, sel, présure, ferments lactiques.", nutrition: "Énergie 264 kcal · Protéines 14g · MG 21% · Sel 3.7g / 100g" },
  "humus":          { brand: "Sabra", origin: "Israël", ingredients: "Pois chiches, tahini (sésame), huile de tournesol, ail, sel, jus de citron, acide citrique.", nutrition: "Énergie 305 kcal · Protéines 8g · MG 24g · Glucides 12g · Fibres 6g / 100g" },
  "tahini":         { brand: "Achva", origin: "Israël", ingredients: "100% graines de sésame moulu (sans additifs).", nutrition: "Énergie 600 kcal · Protéines 18g · MG 53g · Glucides 21g · Calcium 426mg / 100g" },
  "oil-olive":      { brand: "Yad Mordechai", origin: "Israël", ingredients: "Huile d'olive vierge extra 100%, première pression à froid.", nutrition: "Énergie 884 kcal · MG 100g (sat 14g) / 100ml" },
  "honey":          { brand: "Lin's Farm", origin: "Israël", ingredients: "100% miel naturel.", nutrition: "Énergie 304 kcal · Glucides 82g (sucres 82g) / 100g" },
  "nutella":        { brand: "Ferrero", origin: "Italie", ingredients: "Sucre, huile de palme, NOISETTES (13%), cacao maigre (7.4%), LAIT écrémé en poudre (6.6%), petit-LAIT en poudre, émulsifiants (lécithines), arôme vanilline. Sans gluten.", nutrition: "Énergie 539 kcal · MG 30g · Glucides 57g (sucres 56g) · Protéines 6g / 100g" },
  "bamba":          { brand: "Osem", origin: "Israël", ingredients: "Maïs (50%), CACAHUÈTES (50%), huile de palme, sel.", nutrition: "Énergie 565 kcal · Protéines 14g · MG 36g · Glucides 47g / 100g · ⚠️ Allergène arachides" },
  "bisli":          { brand: "Osem", origin: "Israël", ingredients: "Farine de BLÉ, huile de palme, amidon de pomme de terre, sel, exhausteur de goût (E621).", nutrition: "Énergie 478 kcal · Protéines 8g · MG 18g · Glucides 70g / 100g" },
  "coke-1.5":       { brand: "Coca-Cola", origin: "Israël (sous licence)", ingredients: "Eau gazéifiée, sucre, dioxyde de carbone, colorant E150d, acidifiant E338, extraits végétaux, caféine.", nutrition: "Énergie 42 kcal · Glucides 10.6g (sucres 10.6g) / 100ml" },
  "coffee-turkish": { brand: "Elite", origin: "Israël", ingredients: "Café 100% Arabica torréfié et moulu finement.", nutrition: "Énergie 2 kcal / tasse" },
  "tea-wissotzky":  { brand: "Wissotzky", origin: "Israël", ingredients: "Thé noir d'Inde, Sri Lanka et Kenya. Sachets en filtre papier.", nutrition: "Énergie 2 kcal / tasse" },
  "wine-carmel":    { brand: "Carmel", origin: "Israël (Galilée)", ingredients: "Cabernet Sauvignon. Sulfites (E220). Vin cacher mevushal.", nutrition: "Alcool 13% vol · Énergie 80 kcal / 100ml" },
  "beer-goldstar":  { brand: "Tempo", origin: "Israël", ingredients: "Eau, malt d'ORGE, houblon, levure de bière. Brassée à Netanya.", nutrition: "Alcool 4.9% vol · Énergie 41 kcal / 100ml" },
  "diapers-4":      { brand: "Huggies (Kimberly-Clark)", origin: "Pologne", ingredients: "Voile non-tissé polypropylène, polymère super absorbant, cellulose, élastomère, lotion à l'aloe vera. Sans parabène, sans parfum, sans chlore.", nutrition: "Taille 4 (9-14kg) · Pack 60 · Indicateur d'humidité" },
  "shampoo-pantene":{ brand: "Pantene Pro-V (P&G)", origin: "France", ingredients: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycol Distearate, Parfum, Panthénol, Histidine, Vitamine B5...", nutrition: "Convient à tous types de cheveux" },
  "toothpaste":     { brand: "Colgate-Palmolive", origin: "Pologne", ingredients: "Aqua, Sorbitol, Hydrated Silica, Sodium Lauryl Sulfate, Sodium Monofluorophosphate (1450 ppm F), Aroma, Cellulose Gum, Sodium Saccharin.", nutrition: "Protection 12h · Fluor 1450ppm" },
  "eggs-12-l":      { brand: "Tnuva", origin: "Israël", ingredients: "Œufs frais de poules en cage. Calibre L (63-73g).", nutrition: "Énergie 143 kcal · Protéines 13g · MG 10g · Glucides 0.7g · Cholestérol 372mg / 100g" },
  "chicken-breast": { brand: "Off Tov", origin: "Israël", ingredients: "Viande de poulet fraîche (100%). Élevage en Israël. Cacher Mehadrin.", nutrition: "Énergie 165 kcal · Protéines 31g · MG 3.6g / 100g" },
  "salmon-fillet":  { brand: "Élevé en Norvège", origin: "Norvège", ingredients: "Saumon Atlantique (Salmo salar). Élevé en aquaculture. Sans additifs.", nutrition: "Énergie 208 kcal · Protéines 20g · MG 13g · Oméga-3 2.3g / 100g" },
  "bread-white":    { brand: "Angel", origin: "Israël", ingredients: "Farine de BLÉ, eau, levure, sel, sucre, huile végétale. Peut contenir des traces de SOJA et SÉSAME.", nutrition: "Énergie 265 kcal · Protéines 9g · Glucides 49g · Fibres 2.7g / 100g" },
  "challah":        { brand: "Boulangerie", origin: "Israël", ingredients: "Farine de BLÉ, ŒUFS, sucre, huile, levure, sel. Cuite le vendredi pour Shabbat.", nutrition: "Énergie 280 kcal · Protéines 8g · Glucides 50g · Sucres 8g / 100g" },
  "pasta-spaghetti":{ brand: "Osem (Nestlé)", origin: "Israël", ingredients: "Semoule de BLÉ dur 100%.", nutrition: "Énergie 358 kcal · Protéines 13g · Glucides 71g · Fibres 3g / 100g" },
  "rice-basmati":   { brand: "Sugat", origin: "Inde", ingredients: "Riz basmati 100% grains longs vieilli 12 mois.", nutrition: "Énergie 360 kcal · Protéines 8g · Glucides 78g · Fibres 1g / 100g" },
  "frozen-pizza":   { brand: "Maadanot", origin: "Israël", ingredients: "Pâte (BLÉ, eau, huile, levure, sel), sauce tomate, mozzarella (LAIT), origan. Cuire 12-15min à 220°C.", nutrition: "Énergie 245 kcal · Protéines 11g · MG 8g · Glucides 32g / 100g" },
  "ice-cream-bens": { brand: "Ben & Jerry's (Unilever)", origin: "Pays-Bas", ingredients: "LAIT, sucre, CRÈME, eau, jaunes d'ŒUFS, cacao maigre, chocolat, beurre de cacao, vanille. Sans OGM.", nutrition: "Énergie 270 kcal · Protéines 4g · MG 16g · Sucres 24g / 100ml" },
  "potato":         { brand: "Israël", origin: "Israël (Néguev)", ingredients: "Pommes de terre fraîches, variété tout-usage.", nutrition: "Énergie 77 kcal · Protéines 2g · Glucides 17g · Vitamine C 19mg / 100g" },
  "tomato":         { brand: "Israël", origin: "Israël (Aravah)", ingredients: "Tomates fraîches, variété ronde grappe.", nutrition: "Énergie 18 kcal · Protéines 0.9g · Glucides 3.9g · Lycopène 2.6mg / 100g" },
  "cucumber":       { brand: "Israël", origin: "Israël", ingredients: "Concombres israéliens (variété baby), 96% eau.", nutrition: "Énergie 15 kcal · Glucides 3.6g · Vitamine K 16µg / 100g" },
  "avocado":        { brand: "Israël/Mexique", origin: "Variable selon saison", ingredients: "Avocats Hass.", nutrition: "Énergie 160 kcal · MG 15g (mono-insat 10g) · Fibres 7g / 100g" },
  "apple-pink":     { brand: "Israël/import", origin: "Israël ou France", ingredients: "Pommes Pink Lady (Cripps Pink).", nutrition: "Énergie 52 kcal · Glucides 14g (sucres 10g) · Fibres 2.4g / 100g" }
};
function getComposition(p) {
  if (!p) return null;
  return PRODUCT_COMPOSITION[p.id] || null;
}

// ========== HELPERS ==========
function findProduct(id) { return PRODUCTS.find(p => p.id === id); }
function formatPrice(n) {
  const lang = state.lang === "he" ? "he-IL" : (state.lang === "ru" ? "ru-RU" : "fr-FR");
  return new Intl.NumberFormat(lang, { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n);
}
function formatQty(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function formatDate(iso) {
  try {
    const lang = state.lang === "he" ? "he-IL" : (state.lang === "ru" ? "ru-RU" : (state.lang === "en" ? "en-GB" : "fr-FR"));
    return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}
function getCartItem(id) { return activeCart()[id]; }
function getQty(id) { return activeCart()[id]?.qty || 0; }
function isDone(id) { return activeCart()[id]?.done || false; }
function activeItems() {
  const out = {};
  Object.entries(activeCart()).forEach(([id, item]) => { if (!item.done) out[id] = item.qty; });
  return out;
}
// Quantité par défaut selon l'unité
function defaultQty(p) {
  if (!p) return 1;
  const u = (p.unit || "").toLowerCase();
  if (u.includes("kg") || u === "1kg") return 1;
  if (u.includes("g") && /^\d/.test(u)) return 1;
  return 1;
}
// Pas d'incrément selon l'unité
function qtyStep(p) {
  if (!p) return 1;
  const u = (p.unit || "").toLowerCase();
  if (u === "1kg" || u.startsWith("1 kg")) return 0.25;
  return 1;
}

// ========== PRIX EN DIRECT ==========
let LIVE_PRICES = {}, LIVE_META = null;

async function loadLivePrices() {
  try {
    const res = await fetch("data/live-prices.json", { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    LIVE_PRICES = data.prices || {};
    // summary peut être soit { chain: count } soit { chain: { items, status } }
    const rawSummary = (data.summary && data.summary.chains) ? data.summary.chains : (data.summary || {});
    const cleanSummary = {};
    Object.entries(rawSummary).forEach(([k, v]) => {
      cleanSummary[k] = typeof v === "object" ? (v.items || 0) : v;
    });
    LIVE_META = {
      chains: data.chains || Object.keys(cleanSummary),
      summary: cleanSummary,
      matched: Object.keys(LIVE_PRICES).length,
      generatedAt: data.generated_at || data.summary?.generated_at
    };
    PRODUCTS.forEach(p => {
      const live = LIVE_PRICES[p.id];
      if (!live) return;
      p.live = {};
      Object.entries(live).forEach(([chain, price]) => {
        if (p.prices.hasOwnProperty(chain) && typeof price === "number") {
          p.prices[chain] = price; p.live[chain] = true;
        }
      });
    });
    renderUpdateBanner();
    renderStoreBadges();
    renderAll();
  } catch {}
}

// ========== RENDER : BANNER + HEADER ==========
function renderUpdateBanner() {
  document.getElementById("last-updated-label").textContent = t("last_updated");
  document.getElementById("last-updated").textContent = formatDate(LAST_UPDATED);
  document.getElementById("product-count").textContent = PRODUCTS.length;
  document.getElementById("source-label").textContent = "📡 " + t("source_official");
  const liveEl = document.getElementById("live-status");
  if (liveEl) {
    if (LIVE_META && LIVE_META.matched > 0) {
      liveEl.innerHTML = `🟢 <strong>${LIVE_META.matched}</strong> ${t("live_ready")}`;
      liveEl.classList.add("live");
    } else {
      liveEl.innerHTML = `🟡 ${t("live_waiting")}`;
      liveEl.classList.remove("live");
    }
  }
  document.getElementById("tagline").textContent = t("tagline");
  document.getElementById("logo-text").textContent = t("title");
}

function renderStoreBadges() {
  const wrap = document.getElementById("store-badges");
  const liveSummary = (LIVE_META && LIVE_META.summary) || {};
  wrap.innerHTML = Object.entries(STORES).map(([id, s]) => {
    const liveCount = liveSummary[id] || 0;
    const isLive = liveCount > 0;
    const status = isLive ? `<span class="badge-status live">🟢</span>` : `<span class="badge-status mock">⚪</span>`;
    const tip = isLive ? `${liveCount} prix réels` : "Prix estimés";
    return `<span class="store-badge ${isLive ? "live" : ""}" title="${tip}"><span class="dot" style="background:${s.color}"></span>${s.name}${status}</span>`;
  }).join("");
}

function renderLangPicker() {
  const wrap = document.getElementById("lang-picker");
  wrap.innerHTML = Object.entries(I18N).map(([k, v]) =>
    `<button class="lang-btn ${state.lang === k ? "active" : ""}" data-lang="${k}" title="${v._name}">${v._flag}</button>`
  ).join("");
  wrap.querySelectorAll(".lang-btn").forEach(b => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });
}

function setLang(lang) {
  if (!I18N[lang]) return;
  state.lang = lang;
  saveState();
  applyLang();
  renderAll();
  renderUpdateBanner();
  renderLangPicker();
  renderQuickCategories();
  renderStaticTexts();
}

function applyLang() {
  const dir = I18N[state.lang]._dir;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = dir;
}

function renderStaticTexts() {
  document.getElementById("search-input").placeholder = t("search_ph");
  document.getElementById("my-list-title").textContent = "📝 " + t("my_list");
  document.getElementById("comparison-title").textContent = "💸 " + t("comparison");
  document.getElementById("mode-single").textContent = t("single_store");
  document.getElementById("mode-multi").textContent = "🎯 " + t("multi_store");
  document.getElementById("share-btn-text").textContent = "📤 " + t("share");
  document.getElementById("clear-btn").title = t("clear");
  document.getElementById("share-modal-title").textContent = "📤 " + t("share_modal_title");
  document.getElementById("share-modal-text").textContent = t("share_modal_text");
  document.getElementById("share-copy").textContent = t("copy");
  document.getElementById("mobile-cta-btn").textContent = t("view_details") + " ↑";
  // Settings labels
  document.getElementById("settings-shopping-label").textContent = t("shopping_mode");
  document.getElementById("settings-shopping-hint").textContent = t("shopping_mode_hint");
  document.getElementById("settings-theme-label").textContent = t("dark_mode");
}

// ========== THEME ==========
function applyTheme() {
  const root = document.documentElement;
  let effective = state.theme;
  if (effective === "auto") {
    effective = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.dataset.theme = effective;
  document.querySelector('meta[name="theme-color"]').content = effective === "dark" ? "#0f172a" : "#4f46e5";
}
function setTheme(t) { state.theme = t; saveState(); applyTheme(); }

// ========== RECHERCHE ==========
function filterProducts(query, category) {
  const q = normalize(query.trim());
  const matches = [];
  PRODUCTS.forEach(p => {
    if (category && p.category !== category) return;
    if (!q) { matches.push({ p, score: 0 }); return; }
    const name_fr = normalize(p.name);
    const name_other = normalize(tProduct(p));
    const cat_local = normalize(tCat(p.category));
    let score = -1;
    // Score décroissant selon la qualité du match
    if (name_fr === q || name_other === q) score = 100;
    else if (name_fr.startsWith(q) || name_other.startsWith(q)) score = 80;
    else if (new RegExp(`\\b${q}`, "i").test(name_fr) || new RegExp(`\\b${q}`, "i").test(name_other)) score = 60;
    else if (name_fr.includes(q) || name_other.includes(q)) score = 40;
    else if (cat_local === q) score = 30;
    else if (cat_local.includes(q)) score = 20;
    if (score >= 0) matches.push({ p, score });
  });
  // Tri par score décroissant, puis par nom alphabétique
  matches.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return matches.map(m => m.p);
}
// Dropdown (raccourci pendant la frappe seulement, désactivé sinon)
function renderSearchResults() {
  const wrap = document.getElementById("search-results");
  if (!state.searchQuery) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  const results = filterProducts(state.searchQuery, null).slice(0, 6);
  if (results.length === 0) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  wrap.hidden = false;
  wrap.innerHTML = results.map(p => {
    const cheapest = cheapestStoreFor(p);
    const qty = getQty(p.id);
    const cartTag = qty ? `<span style="color:var(--success);font-weight:600">✓ ${formatQty(qty)}×</span>` : "";
    return `
      <div class="search-result-item" data-id="${p.id}">
        <div class="prod-icon mini" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px">${tProduct(p)} ${cartTag}</div>
          <div class="meta">${tCat(p.category)} · ${formatPrice(cheapest.price)}</div>
        </div>
        <div class="add-icon">+</div>
      </div>`;
  }).join("");
  wrap.querySelectorAll(".search-result-item[data-id]").forEach(el => {
    el.addEventListener("click", () => {
      addToCart(el.dataset.id);
      document.getElementById("search-input").value = "";
      state.searchQuery = "";
      renderSearchResults();
      renderBrowsePanel();
    });
  });
}
// Étendue des prix d'un produit (le moins cher, le plus cher, % d'écart)
function priceSpread(product) {
  const vals = Object.values(product.prices).filter(p => p != null);
  if (vals.length === 0) return { min: 0, max: 0, range: 0, pct: 0 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return { min, max, range: max - min, pct: min > 0 ? Math.round(((max - min) / max) * 100) : 0 };
}
function cheapestStoreFor(product) {
  let best = { store: null, price: Infinity };
  Object.entries(product.prices).forEach(([store, price]) => {
    if (price != null && price < best.price) best = { store, price };
  });
  return best;
}
function mostExpensiveStoreFor(product) {
  let worst = { store: null, price: -Infinity };
  Object.entries(product.prices).forEach(([store, price]) => {
    if (price != null && price > worst.price) worst = { store, price };
  });
  return worst;
}

// ========== CATÉGORIES ==========
function renderQuickCategories() {
  const wrap = document.getElementById("quick-categories");
  const cats = [...new Set(PRODUCTS.map(p => p.category))];
  wrap.innerHTML = cats.map(c =>
    `<button class="cat-pill ${state.activeCategory === c ? "active" : ""}" data-cat="${c}">${tCat(c)}</button>`
  ).join("");
  wrap.querySelectorAll(".cat-pill").forEach(el => {
    el.addEventListener("click", () => {
      state.activeCategory = state.activeCategory === el.dataset.cat ? null : el.dataset.cat;
      // Si on active une catégorie, on vide la recherche pour éviter le conflit
      if (state.activeCategory) {
        state.searchQuery = "";
        const si = document.getElementById("search-input");
        if (si) si.value = "";
        document.getElementById("search-results").hidden = true;
      }
      renderQuickCategories();
      renderBrowsePanel();
      // Scrolle vers la grille
      const grid = document.getElementById("browse-grid");
      if (grid && state.activeCategory) {
        setTimeout(() => grid.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      }
    });
  });
}

// ========== PANIER ==========
function addToCart(id, qty, store) {
  const p = findProduct(id);
  if (!p) return;
  if (qty == null) qty = defaultQty(p);
  const cart = activeCart();
  if (cart[id]) { cart[id].qty += qty; cart[id].done = false; if (store !== undefined) cart[id].store = store; }
  else { cart[id] = { qty, done: false, store: store === undefined ? null : store }; }
  state.frequency[id] = (state.frequency[id] || 0) + 1;
  state.lists[state.activeListId].updatedAt = Date.now();
  saveState(); renderAll();
}
// Magasin choisi pour cet item (null = auto = le moins cher)
function chosenStoreFor(id) {
  const it = activeCart()[id];
  return it?.store || null;
}
function setItemStore(id, store) {
  const cart = activeCart();
  if (cart[id]) { cart[id].store = store; saveState(); renderAll(); }
}
// Prix effectif selon le magasin choisi (ou cheapest)
function effectivePrice(p, item) {
  if (!p) return 0;
  if (item?.store && p.prices[item.store] != null) return p.prices[item.store];
  return cheapestStoreFor(p).price;
}
function effectiveStore(p, item) {
  if (item?.store && p.prices[item.store] != null) return item.store;
  return cheapestStoreFor(p).store;
}
function setQty(id, qty) {
  const cart = activeCart();
  qty = Math.round(qty * 100) / 100;
  if (qty <= 0) delete cart[id];
  else if (cart[id]) cart[id].qty = qty;
  else cart[id] = { qty, done: false };
  saveState(); renderAll();
}
function bumpQty(id, delta) {
  const p = findProduct(id);
  const step = qtyStep(p);
  setQty(id, Math.max(0, getQty(id) + delta * step));
}
function toggleDone(id) {
  const cart = activeCart();
  if (!cart[id]) return;
  cart[id].done = !cart[id].done;
  saveState(); renderAll();
}
function removeFromCart(id) {
  delete activeCart()[id];
  saveState(); renderAll();
}
function clearCart() {
  state.lists[state.activeListId].cart = {};
  saveState(); renderAll();
}
function uncheckAll() {
  Object.values(activeCart()).forEach(it => it.done = false);
  saveState(); renderAll();
}

// ========== LISTES MULTIPLES ==========
function renderListsTabs() {
  const wrap = document.getElementById("lists-tabs");
  const lists = Object.entries(state.lists);
  wrap.innerHTML = lists.map(([id, list]) => {
    const name = list.name || t("list_default_name");
    const count = Object.keys(list.cart).length;
    return `
      <button class="list-tab ${id === state.activeListId ? "active" : ""}" data-id="${id}">
        <span class="list-tab-name">${name}</span>
        <span class="list-tab-count">${count}</span>
      </button>`;
  }).join("") + `
    <button class="list-tab new" id="add-list" title="${t("new_list")}">+</button>
  `;
  wrap.querySelectorAll(".list-tab[data-id]").forEach(el => {
    el.addEventListener("click", () => switchList(el.dataset.id));
    let pressTimer;
    el.addEventListener("pointerdown", () => {
      pressTimer = setTimeout(() => listMenu(el.dataset.id), 600);
    });
    el.addEventListener("pointerup", () => clearTimeout(pressTimer));
    el.addEventListener("pointerleave", () => clearTimeout(pressTimer));
  });
  document.getElementById("add-list").addEventListener("click", addList);
}
function switchList(id) {
  if (state.lists[id]) { state.activeListId = id; saveState(); renderAll(); }
}
function addList() {
  const name = prompt(t("list_name_prompt"), t("list_default_name") + " " + (Object.keys(state.lists).length + 1));
  if (name === null) return;
  const id = newId();
  state.lists[id] = { name: name.trim() || t("list_default_name"), cart: {}, createdAt: Date.now() };
  state.activeListId = id;
  saveState(); renderAll();
}
function listMenu(id) {
  const list = state.lists[id];
  if (!list) return;
  const choice = prompt(`"${list.name || t("list_default_name")}"\n\n1 = ${t("rename_list")}\n2 = ${t("delete_list")}`, "1");
  if (choice === "1") {
    const name = prompt(t("list_name_prompt"), list.name || t("list_default_name"));
    if (name !== null) { list.name = name.trim() || t("list_default_name"); saveState(); renderAll(); }
  } else if (choice === "2") {
    if (Object.keys(state.lists).length === 1) {
      list.cart = {}; list.name = t("list_default_name");
    } else {
      if (!confirm(t("list_delete_confirm"))) return;
      delete state.lists[id];
      if (state.activeListId === id) state.activeListId = Object.keys(state.lists)[0];
    }
    saveState(); renderAll();
  }
}

// ========== SUGGESTIONS ==========
function renderSuggestions() {
  const wrap = document.getElementById("suggestions");
  const cart = activeCart();
  const top = Object.entries(state.frequency)
    .filter(([id]) => !cart[id] && findProduct(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => findProduct(id));
  if (top.length === 0) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  wrap.hidden = false;
  wrap.innerHTML = `
    <div class="sugg-head">⭐ ${t("suggestions")}</div>
    <div class="sugg-list">
      ${top.map(p => `<button class="sugg-chip" data-id="${p.id}"><span class="prod-icon mini" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</span>${tProduct(p)} <span>+</span></button>`).join("")}
    </div>`;
  wrap.querySelectorAll(".sugg-chip").forEach(el => {
    el.addEventListener("click", () => addToCart(el.dataset.id));
  });
  observeProductIcons(wrap);
}

// ========== RENDER GLOBAL ==========
function renderAll() {
  renderListsTabs();
  renderBrowsePanel();
  renderSuggestions();
  renderCart();
  renderPromos();
  renderComparison();
  renderMobileCTA();
}

// ========== BROWSE PANEL (catégorie -> grille) ==========
function renderBrowsePanel() {
  const wrap = document.getElementById("browse-grid");
  if (!wrap) return;
  if (!state.activeCategory && !state.searchQuery) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const products = filterProducts(state.searchQuery, state.activeCategory).slice(0, 60);
  if (products.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>${t("search_none")}</div>`;
    return;
  }
  const titleHTML = state.activeCategory
    ? `<div class="browse-head"><span class="browse-title">${tCat(state.activeCategory)}</span><span class="browse-count">${products.length}</span><button class="link-btn" data-clear-cat>×</button></div>`
    : "";
  wrap.innerHTML = titleHTML + `
    <div class="prod-grid">
      ${products.map(p => {
        const cheapest = cheapestStoreFor(p);
        const sp = priceSpread(p);
        const inCart = getQty(p.id);
        return `
          <div class="prod-card" data-pid="${p.id}">
            <div class="prod-icon big" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</div>
            <div class="prod-card-name">${tProduct(p)}</div>
            <div class="prod-card-meta">${p.unit}</div>
            <div class="prod-card-price">
              <span class="prod-card-from">${t("starting_at")}</span>
              <strong style="color:${STORES[cheapest.store].color}">${formatPrice(cheapest.price)}</strong>
              <span class="prod-card-spread">→ ${formatPrice(sp.max)} <span class="spread-pct">−${sp.pct}%</span></span>
            </div>
            ${inCart ? `<div class="prod-card-incart">✓ ${formatQty(inCart)}× ${STORES[chosenStoreFor(p.id) || cheapest.store]?.name || ""}</div>` : ""}
            <button class="prod-card-add" data-add-pid="${p.id}" aria-label="Add">+</button>
          </div>`;
      }).join("")}
    </div>`;
  // Click handlers
  wrap.querySelectorAll(".prod-card").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest("[data-add-pid]")) return;
      showProductDetail(el.dataset.pid);
    });
  });
  wrap.querySelectorAll("[data-add-pid]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); addToCart(el.dataset.addPid); });
  });
  const clearBtn = wrap.querySelector("[data-clear-cat]");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    state.activeCategory = null;
    state.searchQuery = "";
    document.getElementById("search-input").value = "";
    renderQuickCategories();
    renderBrowsePanel();
  });
  observeProductIcons(wrap);
}

// ========== MODAL DÉTAIL PRODUIT ==========
function showProductDetail(pid) {
  const p = findProduct(pid);
  if (!p) return;
  const modal = document.getElementById("product-modal");
  const inCart = getQty(pid);
  const chosen = chosenStoreFor(pid);
  const sortedPrices = Object.entries(p.prices)
    .filter(([, price]) => price != null)
    .sort((a, b) => a[1] - b[1]);
  const cheapestStore = sortedPrices[0]?.[0];
  const mostExpensive = sortedPrices[sortedPrices.length - 1]?.[1] || 0;

  // Promos liées à ce produit
  const allPromos = (typeof PROMOTIONS !== "undefined" ? PROMOTIONS : []).filter(promo => {
    if (promo.products && promo.products.includes(pid)) return true;
    if (promo.category && promo.category === p.category) return true;
    if (promo.requiredAny) return promo.requiredAny.some(axis => axis.includes(pid));
    return false;
  });

  modal.querySelector(".pm-content").innerHTML = `
    <div class="pm-head">
      <div class="prod-icon huge" data-pid="${pid}" style="background:${productTint(p)}">${productIcon(p)}</div>
      <div class="pm-info">
        <h3>${tProduct(p)}</h3>
        <div class="pm-cat">${tCat(p.category)} · ${p.unit}</div>
      </div>
      <button class="modal-close" data-pm-close>×</button>
    </div>
    <p class="pm-desc">${getDescription(p)}</p>
    ${(() => {
      const comp = getComposition(p);
      if (!comp) return "";
      return `
        <div class="pm-section-title">🏷️ Marque & composition</div>
        <div class="pm-comp">
          ${comp.brand ? `<div class="pm-comp-row"><span class="pm-comp-label">Marque</span><span class="pm-comp-val">${comp.brand}</span></div>` : ""}
          ${comp.origin ? `<div class="pm-comp-row"><span class="pm-comp-label">Origine</span><span class="pm-comp-val">${comp.origin}</span></div>` : ""}
          ${comp.ingredients ? `<div class="pm-comp-row"><span class="pm-comp-label">Ingrédients</span><span class="pm-comp-val">${comp.ingredients}</span></div>` : ""}
          ${comp.nutrition ? `<div class="pm-comp-row"><span class="pm-comp-label">Nutrition</span><span class="pm-comp-val">${comp.nutrition}</span></div>` : ""}
        </div>`;
    })()}
    <div class="pm-section-title">📊 Prix dans les ${sortedPrices.length} magasins</div>
    <div class="pm-prices">
      ${sortedPrices.map(([storeId, price], i) => {
        const store = STORES[storeId];
        const isCheapest = i === 0;
        const diff = price - sortedPrices[0][1];
        const diffPct = sortedPrices[0][1] > 0 ? Math.round((diff / sortedPrices[0][1]) * 100) : 0;
        const isChosen = chosen === storeId || (!chosen && isCheapest);
        return `
          <button class="pm-price-row ${isChosen ? "chosen" : ""} ${isCheapest ? "cheapest" : ""}" data-pick-store="${storeId}">
            <span class="store-icon" style="background:${store.color};width:28px;height:28px;font-size:11px">${store.icon}</span>
            <span class="pm-store-name">${store.name}</span>
            ${isCheapest ? `<span class="cheapest-badge">🏆</span>` : `<span class="pm-diff">+${diffPct}%</span>`}
            <span class="pm-price">${formatPrice(price)}</span>
            ${isChosen ? `<span class="pm-check">✓</span>` : ""}
          </button>`;
      }).join("")}
    </div>
    ${allPromos.length > 0 ? `
      <div class="pm-section-title">🎁 Promotions</div>
      <div class="pm-promos">
        ${allPromos.map(promo => `
          <div class="pm-promo">
            <div class="pm-promo-store">
              <span class="store-icon" style="background:${STORES[promo.chain].color};width:22px;height:22px;font-size:10px">${STORES[promo.chain].icon}</span>
              ${STORES[promo.chain].name}
            </div>
            <div class="pm-promo-title">${promo.title}</div>
            <div class="pm-promo-desc">${promo.desc || ""}</div>
          </div>
        `).join("")}
      </div>
    ` : ""}
    <div class="pm-actions">
      ${inCart > 0 ? `
        <div class="qty-controls">
          <button class="qty-btn" data-pm-dec>−</button>
          <input class="qty-input" data-pm-qty type="text" inputmode="decimal" value="${formatQty(inCart)}" />
          <button class="qty-btn" data-pm-inc>+</button>
        </div>
        <button class="btn primary big" data-pm-close>OK</button>
      ` : `
        <button class="btn primary big" data-pm-add>+ ${t("add") || "Ajouter au panier"}</button>
      `}
    </div>
  `;
  modal.classList.add("visible");
  observeProductIcons(modal);

  modal.querySelectorAll("[data-pm-close]").forEach(b => b.addEventListener("click", hideProductModal));
  modal.querySelectorAll("[data-pick-store]").forEach(b => {
    b.addEventListener("click", () => {
      const storeId = b.dataset.pickStore;
      if (inCart > 0) setItemStore(pid, storeId);
      else addToCart(pid, undefined, storeId);
      showProductDetail(pid);
    });
  });
  const addBtn = modal.querySelector("[data-pm-add]");
  if (addBtn) addBtn.addEventListener("click", () => { addToCart(pid); showProductDetail(pid); });
  const decBtn = modal.querySelector("[data-pm-dec]");
  if (decBtn) decBtn.addEventListener("click", () => { bumpQty(pid, -1); showProductDetail(pid); });
  const incBtn = modal.querySelector("[data-pm-inc]");
  if (incBtn) incBtn.addEventListener("click", () => { bumpQty(pid, +1); showProductDetail(pid); });
  const qtyInp = modal.querySelector("[data-pm-qty]");
  if (qtyInp) qtyInp.addEventListener("change", () => {
    const v = parseFloat(qtyInp.value.replace(",", "."));
    if (!isNaN(v)) { setQty(pid, v); showProductDetail(pid); }
  });
}
function hideProductModal() {
  document.getElementById("product-modal").classList.remove("visible");
}

// ========== PROMOS BANNER ==========
function renderPromos() {
  const wrap = document.getElementById("promos-banner");
  if (!wrap) return;
  if (typeof analyzePromos === "undefined") { wrap.hidden = true; return; }
  const cart = activeCart();
  const totals = computeStoreTotals();
  // Trouve le magasin le moins cher actuel pour cibler les promos
  const bestStore = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
  if (!bestStore || Object.keys(cart).length === 0) { wrap.hidden = true; wrap.innerHTML = ""; return; }

  // Analyse pour TOUS les magasins, regroupe par chaîne
  const byChain = {};
  Object.keys(STORES).forEach(c => {
    const r = analyzePromos(cart, PRODUCTS, c);
    if (r.applied.length > 0 || r.suggestions.length > 0) byChain[c] = r;
  });

  if (Object.keys(byChain).length === 0) { wrap.hidden = true; wrap.innerHTML = ""; return; }

  const totalApplied = Object.values(byChain).reduce((s, r) => s + r.totalSaving, 0);
  const allItems = [];
  Object.entries(byChain).forEach(([chain, r]) => {
    r.suggestions.forEach(s => allItems.push({ ...s, chain }));
    r.applied.forEach(a => allItems.push({ ...a, chain, _applied: true }));
  });
  // Détecte les "super promos" : économie > 15₪ ou >25% du prix d'origine
  allItems.forEach(p => {
    const saving = p.potentialSaving || p.saving || 0;
    p._super = saving > 15 || (p.pct && p.pct >= 25) || (p.type === "n_for_m" && p.n - p.m >= 2);
  });
  allItems.sort((a, b) => {
    // Super promos en premier, puis appliquées, puis suggestions
    if (a._super !== b._super) return a._super ? -1 : 1;
    if (a._applied !== b._applied) return a._applied ? 1 : -1;
    return (b.potentialSaving || b.saving || 0) - (a.potentialSaving || a.saving || 0);
  });

  const appliedCount = allItems.filter(i => i._applied).length;
  const sugCount = allItems.length - appliedCount;
  const summaryParts = [];
  if (totalApplied > 0.1) summaryParts.push(`💸 <strong>−${formatPrice(totalApplied)}</strong> en promos`);
  if (sugCount > 0) summaryParts.push(`💡 ${sugCount} suggestion${sugCount > 1 ? "s" : ""}`);
  const summary = summaryParts.length ? summaryParts.join(" · ") : `${allItems.length} promo${allItems.length > 1 ? "s" : ""}`;

  let html = `
    <button class="promo-toggle" data-promo-toggle>
      <span class="promo-toggle-text">${summary}</span>
      <span class="promo-toggle-arrow">▼</span>
    </button>
    <div class="promo-list">`;
  allItems.slice(0, 6).forEach(p => {
    const store = STORES[p.chain];
    const superBadge = p._super ? `<span class="super-promo-badge">🔥 SUPER</span>` : "";
    if (p._applied) {
      html += `
        <div class="promo-item applied ${p._super ? "super" : ""}">
          <span class="store-icon" style="background:${store.color};width:22px;height:22px;font-size:10px">${store.icon}</span>
          <div class="promo-text">
            <div class="promo-title">✅ ${p.title}${superBadge}</div>
            <div class="promo-saved">−${formatPrice(p.saving || 0)} chez ${store.name}</div>
          </div>
        </div>`;
    } else {
      const sugProd = p.suggest ? findProduct(p.suggest.id) : null;
      const missingTxt = p.isAmount
        ? `Encore ${formatPrice(p.missing)}`
        : (sugProd ? `Ajoute ${tProduct(sugProd)}` : `Ajoute ${p.missing}× plus`);
      const gain = p.potentialSaving > 0 ? ` → −${formatPrice(p.potentialSaving)}` : "";
      html += `
        <div class="promo-item ${p._super ? "super" : ""}">
          <span class="store-icon" style="background:${store.color};width:22px;height:22px;font-size:10px">${store.icon}</span>
          <div class="promo-text">
            <div class="promo-title">${p.title} · ${store.name}${superBadge}</div>
            <div class="promo-hint">${missingTxt}${gain}</div>
          </div>
          ${p.suggest ? `<button class="promo-add" data-add="${p.suggest.id}" data-store="${p.chain}">+</button>` : ""}
        </div>`;
    }
  });
  html += `</div>`;

  wrap.hidden = false;
  wrap.innerHTML = html;
  wrap.querySelector("[data-promo-toggle]").addEventListener("click", () => {
    wrap.classList.toggle("expanded");
  });
  wrap.querySelectorAll("[data-add]").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      addToCart(b.dataset.add, undefined, b.dataset.store);
    });
  });
}

function renderCart() {
  const wrap = document.getElementById("cart");
  const cart = activeCart();
  const ids = Object.keys(cart);
  const actions = document.getElementById("cart-actions");
  const progressEl = document.getElementById("cart-progress");

  if (ids.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🛒</span>
        ${t("empty_list")}<br />${t("empty_hint")}
      </div>`;
    actions.hidden = true; progressEl.hidden = true;
    return;
  }

  actions.hidden = false; progressEl.hidden = false;

  const doneCount = ids.filter(id => cart[id].done).length;
  const total = ids.length;
  const pct = Math.round((doneCount / total) * 100);
  progressEl.innerHTML = `
    <div class="progress-head">
      <span class="progress-label">${doneCount} / ${total} ${t("checked")}</span>
      <div class="progress-actions">
        <button class="link-btn" data-action="hide-done">${state.hideDone ? t("show_all") : t("hide_checked")}</button>
        ${doneCount > 0 ? `<button class="link-btn" data-action="uncheck-all">${t("uncheck_all")}</button>` : ""}
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  progressEl.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", () => {
      if (el.dataset.action === "hide-done") { state.hideDone = !state.hideDone; renderCart(); }
      else if (el.dataset.action === "uncheck-all") uncheckAll();
    });
  });

  const totalItems = Object.values(cart).reduce((a, b) => a + b.qty, 0);
  document.getElementById("cart-count").textContent =
    `${total} ${total > 1 ? t("products") : t("product")} · ${formatQty(totalItems)} ${totalItems > 1 ? t("items") : t("item")}`;

  // Mode courses : groupé par rayon, sinon liste à plat
  if (state.shoppingMode) {
    renderShoppingMode(wrap, ids);
  } else {
    renderFlatList(wrap, ids);
  }

  wrap.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      const id = el.dataset.id, action = el.dataset.action;
      if (action === "inc") bumpQty(id, +1);
      else if (action === "dec") bumpQty(id, -1);
      else if (action === "rm") removeFromCart(id);
      else if (action === "toggle") toggleDone(id);
      else if (action === "detail") showProductDetail(id);
      else if (action === "pick") showProductDetail(id);
    });
  });
  wrap.querySelectorAll(".qty-input").forEach(inp => {
    inp.addEventListener("change", () => {
      const id = inp.dataset.id;
      const v = parseFloat(inp.value.replace(",", "."));
      if (!isNaN(v)) setQty(id, v);
    });
    inp.addEventListener("focus", () => inp.select());
  });
  observeProductIcons(wrap);
}

function renderFlatList(wrap, ids) {
  const cart = activeCart();
  const sorted = [...ids].sort((a, b) => (cart[a].done ? 1 : 0) - (cart[b].done ? 1 : 0));
  wrap.innerHTML = sorted.map(id => renderCartItemHTML(id)).filter(Boolean).join("");
}

function renderShoppingMode(wrap, ids) {
  const cart = activeCart();
  const aisleOrder = I18N[state.lang].aisle_order || I18N.fr.aisle_order;
  const groups = {};
  ids.forEach(id => {
    const p = findProduct(id);
    if (!p) return;
    if (state.hideDone && cart[id].done) return;
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(id);
  });
  const orderedCats = aisleOrder.filter(c => groups[c]);
  Object.keys(groups).forEach(c => { if (!orderedCats.includes(c)) orderedCats.push(c); });

  wrap.innerHTML = orderedCats.map(cat => {
    const items = groups[cat]
      .sort((a, b) => (cart[a].done ? 1 : 0) - (cart[b].done ? 1 : 0))
      .map(id => renderCartItemHTML(id, true))
      .filter(Boolean)
      .join("");
    if (!items) return "";
    return `
      <div class="aisle-group">
        <div class="aisle-head">${tCat(cat)}</div>
        ${items}
      </div>`;
  }).join("");
}

function renderCartItemHTML(id, big = false) {
  const cart = activeCart();
  const p = findProduct(id);
  if (!p) return "";
  const item = cart[id];
  if (state.hideDone && item.done) return "";
  const effStore = effectiveStore(p, item);
  const effPrice = effectivePrice(p, item);
  const store = STORES[effStore];
  const cheapestS = cheapestStoreFor(p);
  const sp = priceSpread(p);
  const isCheapest = effStore === cheapestS.store;
  const qtyStr = formatQty(item.qty);
  const lineTotal = effPrice * item.qty;
  return `
    <div class="cart-item ${item.done ? "done" : ""} ${big ? "big" : ""}">
      <button class="check-btn ${item.done ? "checked" : ""}" data-action="toggle" data-id="${id}" aria-label="✓">
        ${item.done ? "✓" : ""}
      </button>
      <div class="prod-icon" data-pid="${p.id}" style="background:${productTint(p)}" data-action="detail" data-id="${id}">${productIcon(p)}</div>
      <div class="cart-item-info" data-action="detail" data-id="${id}">
        <div class="cart-item-name">${tProduct(p)}</div>
        <div class="cart-item-meta">
          <button class="store-pick" data-action="pick" data-id="${id}" title="Choisir un magasin">
            <span class="store-mini" style="background:${store.color}">${store.icon}</span>
            <span style="color:${store.color};font-weight:600">${formatPrice(effPrice)}</span>
            ${!isCheapest
              ? `<span class="alt-cheaper" title="Moins cher chez ${STORES[cheapestS.store].name}">↓ ${formatPrice(cheapestS.price)} (−${formatPrice(effPrice - cheapestS.price)})</span>`
              : `<span class="spread-info">↑ ${formatPrice(sp.max)}</span>`}
          </button>
        </div>
      </div>
      <div class="cart-item-right">
        <div class="qty-controls compact">
          <button class="qty-btn" data-action="dec" data-id="${id}">−</button>
          <input class="qty-input" data-id="${id}" type="text" inputmode="decimal" value="${qtyStr}" />
          <button class="qty-btn" data-action="inc" data-id="${id}">+</button>
        </div>
        <div class="cart-item-total">${formatPrice(lineTotal)}</div>
      </div>
      <button class="remove-btn" data-action="rm" data-id="${id}" aria-label="×">×</button>
    </div>`;
}

// ========== COMPARAISON ==========
function computeStoreTotals() {
  const totals = {};
  Object.keys(STORES).forEach(s => { totals[s] = { store: s, total: 0, available: 0, missing: [], items: [] }; });
  Object.entries(activeItems()).forEach(([id, qty]) => {
    const p = findProduct(id);
    if (!p) return;
    Object.keys(STORES).forEach(s => {
      const price = p.prices[s];
      if (price == null) totals[s].missing.push(p);
      else {
        totals[s].total += price * qty;
        totals[s].available += 1;
        totals[s].items.push({ product: p, qty, price, lineTotal: price * qty });
      }
    });
  });
  return totals;
}

// Décompte des économies : compare le total payé (selon les magasins choisis
// par item) au total min (cheapest auto), max (most expensive) et moyen.
function computeSavingsTracker() {
  const cart = activeCart();
  let chosenTotal = 0, cheapestTotal = 0, expensiveTotal = 0, avgTotal = 0;
  let nItems = 0;
  Object.entries(cart).forEach(([id, item]) => {
    if (item.done) return;
    const p = findProduct(id);
    if (!p) return;
    const prices = Object.values(p.prices).filter(x => x != null);
    if (prices.length === 0) return;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, x) => s + x, 0) / prices.length;
    const eff = effectivePrice(p, item);
    const qty = item.qty;
    chosenTotal += eff * qty;
    cheapestTotal += min * qty;
    expensiveTotal += max * qty;
    avgTotal += avg * qty;
    nItems++;
  });
  return {
    chosenTotal, cheapestTotal, expensiveTotal, avgTotal,
    savedVsExpensive: expensiveTotal - chosenTotal,
    missedVsCheapest: chosenTotal - cheapestTotal,
    nItems
  };
}

function renderComparison() {
  const wrap = document.getElementById("comparison");
  const optiWrap = document.getElementById("optimization");
  const active = Object.keys(activeItems());
  if (active.length === 0) {
    const hasItems = Object.keys(activeCart()).length > 0;
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">${hasItems ? "🎉" : "📊"}</span>${hasItems ? t("all_done") : t("add_empty_compare")}</div>`;
    optiWrap.hidden = true; optiWrap.innerHTML = "";
    return;
  }
  // Bandeau "Mes économies" en haut
  const sv = computeSavingsTracker();
  const savingsHTML = `
    <div class="savings-tracker">
      <div class="st-row">
        <span class="st-label">🛒 Total à payer</span>
        <span class="st-value primary">${formatPrice(sv.chosenTotal)}</span>
      </div>
      <div class="st-row good">
        <span class="st-label">💚 Vous économisez vs panier le plus cher</span>
        <span class="st-value">−${formatPrice(sv.savedVsExpensive)}</span>
      </div>
      ${sv.missedVsCheapest > 0.05 ? `
        <div class="st-row warn">
          <span class="st-label">⚠️ Économies manquées (vs optimal)</span>
          <span class="st-value">+${formatPrice(sv.missedVsCheapest)}</span>
        </div>` : `
        <div class="st-row good">
          <span class="st-label">✨ Vous payez le minimum possible</span>
          <span class="st-value">✓</span>
        </div>`}
    </div>`;

  if (state.mode === "single") {
    wrap.innerHTML = savingsHTML;
    renderSingleStore(wrap);
    optiWrap.hidden = true; optiWrap.innerHTML = "";
  } else {
    wrap.innerHTML = savingsHTML;
    optiWrap.hidden = false;
    renderOptimized(optiWrap);
  }
}

function renderSingleStore(wrap) {
  const totals = computeStoreTotals();
  const innerWrap = document.createElement("div");
  innerWrap.className = "store-list";
  wrap.appendChild(innerWrap);
  const target = innerWrap;
  const sorted = Object.values(totals).sort((a, b) => {
    const ac = a.missing.length === 0 ? 0 : 1, bc = b.missing.length === 0 ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.total - b.total;
  });
  const completes = sorted.filter(s => s.missing.length === 0);
  const cheapest = completes[0];
  const mostExpensive = completes[completes.length - 1];

  target.innerHTML = sorted.map(s => {
    const store = STORES[s.store];
    const isComplete = s.missing.length === 0;
    const isCheapest = cheapest && s.store === cheapest.store;
    let savingsHTML = "";
    if (isComplete && cheapest) {
      if (isCheapest && mostExpensive && mostExpensive.store !== s.store) {
        const saved = mostExpensive.total - s.total;
        const pct = Math.round((saved / mostExpensive.total) * 100);
        savingsHTML = `<div class="savings">💚 −${formatPrice(saved)} (${pct}%) ${t("saved_vs_max")}</div>`;
      } else if (!isCheapest) {
        const extra = s.total - cheapest.total;
        savingsHTML = `<div class="extra">+${formatPrice(extra)}</div>`;
      }
    }
    const missingHTML = s.missing.length > 0
      ? `<div class="store-meta warning">⚠️ ${s.missing.length} ${t("products_unavailable")}</div>`
      : `<div class="store-meta">✓ ${t("products_available")}</div>`;
    return `
      <div class="store-card ${isCheapest ? "cheapest" : ""} ${!isComplete ? "unavailable" : ""}" data-pick-store-all="${s.store}">
        <div class="store-info">
          <div class="store-icon" style="background:${store.color}">${store.icon}</div>
          <div style="min-width:0">
            <div class="store-name">${store.name} ${isCheapest ? `<span class="cheapest-badge">🏆 ${t("cheapest_badge")}</span>` : ""}</div>
            ${missingHTML}
          </div>
        </div>
        <div class="store-price">
          <div class="total">${formatPrice(s.total)}</div>
          ${savingsHTML}
        </div>
      </div>`;
  }).join("");
  // Click sur une carte magasin = définit ce magasin pour TOUS les items
  target.querySelectorAll("[data-pick-store-all]").forEach(el => {
    el.addEventListener("click", () => {
      const sid = el.dataset.pickStoreAll;
      const cart = activeCart();
      Object.keys(cart).forEach(id => {
        const p = findProduct(id);
        if (p && p.prices[sid] != null) cart[id].store = sid;
      });
      saveState(); renderAll();
      showToast(`✓ Tout assigné à ${STORES[sid].name}`);
    });
  });
}

function renderOptimized(wrap) {
  const cartItems = Object.entries(activeItems()).map(([id, qty]) => ({ product: findProduct(id), qty })).filter(x => x.product);
  const assignmentOpt = {};
  let optimalTotal = 0;
  cartItems.forEach(({ product, qty }) => {
    const best = cheapestStoreFor(product);
    if (best.store) { assignmentOpt[product.id] = { store: best.store, price: best.price }; optimalTotal += best.price * qty; }
  });
  const realistic = limitToNStores(cartItems, 2);
  const totals = computeStoreTotals();
  const bestSingle = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
  const bestSingleTotal = bestSingle ? bestSingle.total : null;

  let html = "";
  const savedVsBest = bestSingleTotal != null ? bestSingleTotal - realistic.total : 0;
  html += `
    <div class="opti-summary">
      <div class="title">✨ ${t("opti_title")}</div>
      <div class="total">${formatPrice(realistic.total)}</div>
      ${bestSingle && savedVsBest > 0.1
        ? `<div class="saved">${t("opti_save_intro")} <strong>${formatPrice(savedVsBest)}</strong> ${t("opti_save_outro")} ${STORES[bestSingle.store].name}</div>`
        : `<div class="saved">${t("opti_simpler")}</div>`}
    </div>`;
  const grouped = groupByStore(realistic.assignment, cartItems);
  Object.entries(grouped).forEach(([storeId, items]) => {
    const store = STORES[storeId];
    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    html += `
      <div class="opti-store">
        <div class="opti-store-head">
          <div class="opti-store-name">
            <span class="store-icon" style="background:${store.color};width:30px;height:30px;font-size:11px">${store.icon}</span>
            ${store.name} <span style="font-size:11px;color:var(--muted);font-weight:500">(${items.length})</span>
          </div>
          <button class="export-store-btn" data-export-store="${storeId}">📥 ${t("new_list")}</button>
          <div class="opti-store-total">${formatPrice(subtotal)}</div>
        </div>
        ${items.map(it => `<div class="opti-item"><span class="prod-icon mini" data-pid="${it.product.id}" style="background:${productTint(it.product)}">${productIcon(it.product)}</span><span class="name">${formatQty(it.qty)}× ${tProduct(it.product)}</span><span class="price">${formatPrice(it.lineTotal)}</span></div>`).join("")}
      </div>`;
  });
  // Save assignments for export
  state._lastAssignment = realistic.assignment;

  if (Math.abs(optimalTotal - realistic.total) > 0.5) {
    const groupedOpt = groupByStore(assignmentOpt, cartItems);
    const storeCount = Object.keys(groupedOpt).length;
    const bonusSavings = realistic.total - optimalTotal;
    html += `
      <div class="opti-store bonus">
        <div class="opti-store-head">
          <div class="opti-store-name">💡 ${t("opti_bonus_title")} (${storeCount} ${t("opti_bonus_more")})</div>
          <div class="opti-store-total">${formatPrice(optimalTotal)}</div>
        </div>
        <div style="font-size:13px;color:var(--text-soft);line-height:1.5">${t("opti_bonus_text", { n: storeCount, amount: formatPrice(bonusSavings) })}</div>
      </div>`;
  }
  wrap.innerHTML = html;

  // Bouton "Exporter en nouvelle liste" pour chaque magasin du panier optimisé
  wrap.querySelectorAll("[data-export-store]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      exportStoreAsNewList(btn.dataset.exportStore);
    });
  });
  observeProductIcons(wrap);
}

// Crée une nouvelle liste contenant uniquement les produits assignés au magasin donné.
// Chaque item est pré-paramétré sur ce magasin pour cohérence.
function exportStoreAsNewList(storeId) {
  const assignment = state._lastAssignment || {};
  const cart = activeCart();
  const newCart = {};
  Object.entries(assignment).forEach(([pid, a]) => {
    if (a.store === storeId && cart[pid]) {
      newCart[pid] = { qty: cart[pid].qty, done: false, store: storeId };
    }
  });
  if (Object.keys(newCart).length === 0) {
    showToast("⚠️ Aucun produit assigné à " + STORES[storeId].name);
    return;
  }
  const id = newId();
  const storeName = STORES[storeId].name;
  state.lists[id] = {
    name: `🛒 ${storeName}`,
    cart: newCart,
    createdAt: Date.now(),
    sourceStore: storeId
  };
  state.activeListId = id;
  saveState();
  renderAll();
  showToast(`✓ Liste créée : ${storeName} (${Object.keys(newCart).length} produits)`);
}

function limitToNStores(cartItems, maxStores) {
  const all = Object.keys(STORES);
  let best = { total: Infinity, assignment: {}, stores: [] };
  combinations(all, maxStores).forEach(combo => {
    const assignment = {}; let total = 0; let valid = true;
    cartItems.forEach(({ product, qty }) => {
      let bp = Infinity, bs = null;
      combo.forEach(s => { const pr = product.prices[s]; if (pr != null && pr < bp) { bp = pr; bs = s; } });
      if (bs) { assignment[product.id] = { store: bs, price: bp }; total += bp * qty; }
      else valid = false;
    });
    if (valid && total < best.total) best = { total, assignment, stores: combo };
  });
  if (best.total === Infinity) {
    const totals = computeStoreTotals();
    const fb = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
    if (fb) {
      const assignment = {};
      cartItems.forEach(({ product }) => { assignment[product.id] = { store: fb.store, price: product.prices[fb.store] }; });
      best = { total: fb.total, assignment, stores: [fb.store] };
    }
  }
  return best;
}
function combinations(arr, k) {
  const r = [];
  (function rec(i, c) { if (c.length === k) { r.push([...c]); return; } for (let j = i; j < arr.length; j++) { c.push(arr[j]); rec(j + 1, c); c.pop(); } })(0, []);
  return r;
}
function groupByStore(assignment, cartItems) {
  const g = {};
  cartItems.forEach(({ product, qty }) => {
    const a = assignment[product.id]; if (!a) return;
    if (!g[a.store]) g[a.store] = [];
    g[a.store].push({ product, qty, price: a.price, lineTotal: a.price * qty });
  });
  return g;
}

// ========== MOBILE CTA ==========
function renderMobileCTA() {
  const cta = document.getElementById("mobile-cta");
  if (Object.keys(activeItems()).length === 0) { cta.classList.remove("visible"); return; }
  const totals = computeStoreTotals();
  const best = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
  if (!best) { cta.classList.remove("visible"); return; }
  cta.classList.add("visible");
  document.getElementById("mobile-cta-total").textContent = formatPrice(best.total);
  document.getElementById("mobile-cta-store").textContent = `🏆 ${STORES[best.store].name} (${t("cheapest")})`;
}

// ========== PARTAGE ==========
// Format encodé : id:qty:done:store (store optionnel)
function encodeCart() {
  const cart = activeCart();
  const parts = Object.entries(cart).map(([id, item]) =>
    `${id}:${item.qty}:${item.done ? 1 : 0}${item.store ? ":" + item.store : ""}`
  );
  return btoa(unescape(encodeURIComponent(parts.join(",")))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeCart(enc) {
  try {
    const b64 = enc.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    const str = decodeURIComponent(escape(atob(padded)));
    if (!str) return {};
    const cart = {};
    str.split(",").forEach(part => {
      const tokens = part.split(":");
      const [id, qty, done, store] = tokens;
      if (id && findProduct(id)) {
        cart[id] = {
          qty: parseFloat(qty) || 1,
          done: done === "1",
          store: (store && STORES[store]) ? store : null
        };
      }
    });
    return cart;
  } catch { return null; }
}
function buildShareURL() {
  const enc = encodeCart();
  return `${location.origin}${location.pathname}#liste=${enc}`;
}
async function shareList() {
  if (Object.keys(activeCart()).length === 0) { showToast(t("share_first"), "warn"); return; }
  const url = buildShareURL();
  const text = `🛒 ${t("my_list")} (${Object.keys(activeCart()).length} ${t("products")})`;
  if (navigator.share) {
    try { await navigator.share({ title: t("title"), text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); showShareModal(url); }
  catch { showShareModal(url); }
}
function showShareModal(url) {
  const m = document.getElementById("share-modal");
  document.getElementById("share-url").value = url;
  document.getElementById("share-wa").href = `https://wa.me/?text=${encodeURIComponent("🛒 " + url)}`;
  document.getElementById("share-sms").href = `sms:?body=${encodeURIComponent("🛒 " + url)}`;
  document.getElementById("share-mail").href = `mailto:?subject=${encodeURIComponent(t("my_list"))}&body=${encodeURIComponent(url)}`;
  m.classList.add("visible");
}
function hideShareModal() { document.getElementById("share-modal").classList.remove("visible"); }
function showToast(msg, type = "info") {
  const tEl = document.getElementById("toast");
  tEl.textContent = msg;
  tEl.className = "toast visible " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => tEl.classList.remove("visible"), 2800);
}
function checkIncomingList() {
  const m = location.hash.match(/liste=([^&]+)/);
  if (!m) return;
  const incoming = decodeCart(m[1]);
  if (!incoming || Object.keys(incoming).length === 0) { location.hash = ""; return; }
  const inc = Object.keys(incoming).length;
  const cur = Object.keys(activeCart()).length;
  let action = "replace";
  if (cur > 0) {
    const c = prompt(t("received_list", { n: inc, cur }), "2");
    action = c === "1" ? "replace" : (c === "2" ? "merge" : "ignore");
  }
  if (action === "replace") {
    state.lists[state.activeListId].cart = incoming;
    showToast(`✓ ${t("list_imported")}`);
  } else if (action === "merge") {
    const cart = activeCart();
    let added = 0, updated = 0;
    Object.entries(incoming).forEach(([id, item]) => {
      if (cart[id]) {
        const newQty = Math.max(cart[id].qty, item.qty);
        if (newQty !== cart[id].qty) updated++;
        cart[id].qty = newQty;
        cart[id].done = cart[id].done && item.done;
      } else { cart[id] = { qty: item.qty, done: item.done }; added++; }
    });
    showToast(`✓ ${t("merge_done", { a: added, u: updated })}`);
  }
  saveState();
  history.replaceState(null, "", location.pathname + location.search);
  renderAll();
}

// ========== SETTINGS DRAWER ==========
function setupSettings() {
  document.getElementById("settings-btn").addEventListener("click", () => {
    document.getElementById("settings-drawer").classList.add("visible");
  });
  document.getElementById("settings-close").addEventListener("click", () => {
    document.getElementById("settings-drawer").classList.remove("visible");
  });
  document.getElementById("settings-drawer").addEventListener("click", e => {
    if (e.target.id === "settings-drawer") e.currentTarget.classList.remove("visible");
  });
  // Shopping mode toggle
  const sm = document.getElementById("settings-shopping");
  sm.checked = state.shoppingMode;
  sm.addEventListener("change", () => { state.shoppingMode = sm.checked; saveState(); renderAll(); });
  // Theme toggle
  const th = document.getElementById("settings-theme");
  th.checked = state.theme === "dark";
  th.addEventListener("change", () => { setTheme(th.checked ? "dark" : "light"); });
  // Force update button
  const resetBtn = document.getElementById("settings-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      showToast("⏳ Vidage du cache en cours...");
      setTimeout(() => nukeCacheAndReload(), 500);
    });
  }
  const verEl = document.getElementById("app-version");
  if (verEl) verEl.textContent = "Version " + (window.PRIXMALIN_VERSION || "v8") + " · " + DATA_VERSION;
}

// ========== EVENTS ==========
function setupEvents() {
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      saveState(); renderComparison();
    });
  });
  const search = document.getElementById("search-input");
  search.addEventListener("input", e => {
    state.searchQuery = e.target.value;
    // Recherche désactive le filtre catégorie pour ne pas conflit
    if (state.searchQuery && state.activeCategory) {
      state.activeCategory = null;
      renderQuickCategories();
    }
    renderBrowsePanel();
    renderSearchResults();
  });
  search.addEventListener("focus", () => { if (state.searchQuery) renderSearchResults(); });
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-box")) {
      document.getElementById("search-results").hidden = true;
    }
  });
  document.getElementById("clear-btn").addEventListener("click", () => { if (confirm(t("clear_confirm"))) clearCart(); });
  document.getElementById("share-list").addEventListener("click", shareList);
  document.getElementById("mobile-cta-btn").addEventListener("click", () => {
    document.querySelector("#comparison, #optimization:not([hidden])").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("share-close").addEventListener("click", hideShareModal);
  document.getElementById("share-modal").addEventListener("click", e => { if (e.target.id === "share-modal") hideShareModal(); });
  // Product modal : fermer en cliquant à l'extérieur ou Escape
  document.getElementById("product-modal").addEventListener("click", e => { if (e.target.id === "product-modal") hideProductModal(); });
  // Nearby stores button
  const nearbyBtn = document.getElementById("nearby-btn");
  if (nearbyBtn) nearbyBtn.addEventListener("click", () => {
    document.getElementById("settings-drawer").classList.remove("visible");
    showNearbyStores();
  });
  document.getElementById("nearby-modal").addEventListener("click", e => { if (e.target.id === "nearby-modal") hideNearbyModal(); });
  // Recipes button
  const recipesBtn = document.getElementById("recipes-btn");
  if (recipesBtn) recipesBtn.addEventListener("click", () => {
    document.getElementById("settings-drawer").classList.remove("visible");
    showRecipesModal();
  });
  document.getElementById("recipes-modal").addEventListener("click", e => { if (e.target.id === "recipes-modal") hideRecipesModal(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      hideProductModal();
      hideShareModal();
      document.getElementById("settings-drawer").classList.remove("visible");
    }
  });
  document.getElementById("share-copy").addEventListener("click", async () => {
    const inp = document.getElementById("share-url");
    try { await navigator.clipboard.writeText(inp.value); showToast("✓ " + t("copied")); }
    catch { inp.select(); document.execCommand("copy"); showToast("✓ " + t("copied")); }
  });
  // Re-rendre quand le système change de thème
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
}

// ========== PWA ==========
function setupPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then(reg => {
        // Force la vérification de mise à jour
        reg.update().catch(() => {});
        // Recharge automatique quand un nouveau SW prend le contrôle
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              showToast("✨ Mise à jour disponible, rechargement...");
              setTimeout(() => location.reload(), 1500);
            }
          });
        });
      }).catch(() => {});
      // Reload sur message du SW
      navigator.serviceWorker.addEventListener("message", e => {
        if (e.data && e.data.type === "sw-updated") {
          setTimeout(() => location.reload(), 800);
        }
      });
    });
  }
  // Détection de version pour les visiteurs avec cache navigateur agressif
  window.PRIXMALIN_VERSION = "v8";
  const VERSION_KEY = "prixmalin.version";
  const CURRENT_VERSION = "v8";
  const stored = (() => { try { return localStorage.getItem(VERSION_KEY); } catch { return null; } })();
  if (stored !== CURRENT_VERSION) {
    try { localStorage.setItem(VERSION_KEY, CURRENT_VERSION); } catch {}
    // Si on a un SW actif et version différente, force update
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller && stored) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update());
      });
    }
  }
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById("install-btn");
    if (btn) {
      btn.hidden = false;
      btn.onclick = async () => {
        btn.hidden = true;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      };
    }
  });
}

// ========== KILL SWITCH ==========
// Purge totale (caches + service workers + flag de session) si ?reset=1
async function nukeCacheAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  // Recharge sans cache navigateur
  const url = new URL(location.href);
  url.searchParams.delete("reset");
  url.searchParams.set("_v", Date.now());
  location.replace(url.toString());
}
if (new URLSearchParams(location.search).has("reset")) {
  nukeCacheAndReload();
  // empêche le reste du script de tourner
  throw new Error("Resetting...");
}

// ========== RECETTES ==========
function showRecipesModal() {
  if (typeof RECIPES === "undefined") return;
  const modal = document.getElementById("recipes-modal");
  const lang = state.lang;
  modal.querySelector(".recipes-content").innerHTML = `
    <div class="recipes-head">
      <h3>👨‍🍳 ${lang === "he" ? "מתכונים" : (lang === "en" ? "Recipes" : (lang === "ru" ? "Рецепты" : "Recettes"))}</h3>
      <button class="modal-close" data-recipes-close>×</button>
    </div>
    <p class="recipes-intro">${lang === "fr" ? "Un clic ajoute tous les ingrédients à ta liste" : (lang === "he" ? "לחיצה אחת מוסיפה את כל המרכיבים לרשימה" : (lang === "en" ? "One click adds all ingredients to your list" : "Один клик добавляет все ингредиенты в список"))}</p>
    <div class="recipes-grid">
      ${RECIPES.map(r => {
        const name = r.names[lang] || r.names.fr;
        const desc = r.descs[lang] || r.descs.fr;
        return `
          <button class="recipe-card" data-recipe-id="${r.id}">
            <div class="recipe-emoji">${r.emoji}</div>
            <div class="recipe-name">${name}</div>
            <div class="recipe-count">${r.ingredients.length} ${lang === "he" ? "פריטים" : (lang === "en" ? "items" : "ingrédients")}</div>
            <div class="recipe-desc">${desc}</div>
          </button>`;
      }).join("")}
    </div>`;
  modal.classList.add("visible");
  modal.querySelector("[data-recipes-close]").addEventListener("click", hideRecipesModal);
  modal.querySelectorAll(".recipe-card").forEach(el => {
    el.addEventListener("click", () => {
      const recipe = RECIPES.find(r => r.id === el.dataset.recipeId);
      if (recipe) showRecipeDetail(recipe);
    });
  });
}
function showRecipeDetail(recipe) {
  const modal = document.getElementById("recipes-modal");
  const lang = state.lang;
  const cart = activeCart();
  // par défaut : tous cochés sauf ceux déjà au panier
  const checkedState = {};
  recipe.ingredients.forEach(ing => {
    checkedState[ing.id] = !cart[ing.id];
  });

  const render = () => {
    modal.querySelector(".recipes-content").innerHTML = `
      <div class="recipes-head">
        <button class="modal-close" data-back-recipes title="Retour" style="font-size:22px">←</button>
        <h3 style="flex:1;text-align:center">${recipe.emoji} ${recipe.names[lang] || recipe.names.fr}</h3>
        <button class="modal-close" data-recipes-close>×</button>
      </div>
      <p class="recipes-intro">${recipe.descs[lang] || recipe.descs.fr}</p>
      <div class="recipe-detail-toolbar">
        <button class="link-btn" data-check-all>Tout cocher</button>
        <button class="link-btn" data-uncheck-all>Tout décocher</button>
      </div>
      <div class="recipe-ingredients">
        ${recipe.ingredients.map(ing => {
          const p = findProduct(ing.id);
          if (!p) return "";
          const cheapest = cheapestStoreFor(p);
          const inCartTxt = cart[ing.id] ? `<span style="color:var(--success);font-size:10px">✓ déjà au panier</span>` : "";
          return `
            <label class="ing-row ${checkedState[ing.id] ? "" : "unchecked"}">
              <input type="checkbox" data-ing-id="${ing.id}" ${checkedState[ing.id] ? "checked" : ""} />
              <div class="prod-icon mini" style="background:${productTint(p)}">${productIcon(p)}</div>
              <div class="ing-info">
                <div class="ing-name">${tProduct(p)}</div>
                <div class="ing-meta">${formatQty(ing.qty)}× ${p.unit} · ${formatPrice(cheapest.price * ing.qty)} ${inCartTxt}</div>
              </div>
              <input type="text" inputmode="decimal" class="ing-qty" data-ing-qty="${ing.id}" value="${formatQty(ing.qty)}" />
            </label>`;
        }).join("")}
      </div>
      <div class="pm-actions">
        <button class="btn ghost" data-back-recipes>← Annuler</button>
        <button class="btn primary big" data-add-recipe>+ Ajouter <span id="ing-count">${Object.values(checkedState).filter(Boolean).length}</span> au panier</button>
      </div>`;

    modal.querySelectorAll("[data-back-recipes]").forEach(b =>
      b.addEventListener("click", () => showRecipesModal()));
    modal.querySelector("[data-recipes-close]").addEventListener("click", hideRecipesModal);
    modal.querySelector("[data-check-all]").addEventListener("click", () => {
      Object.keys(checkedState).forEach(k => checkedState[k] = true);
      render();
    });
    modal.querySelector("[data-uncheck-all]").addEventListener("click", () => {
      Object.keys(checkedState).forEach(k => checkedState[k] = false);
      render();
    });
    modal.querySelectorAll("[data-ing-id]").forEach(cb => {
      cb.addEventListener("change", () => {
        checkedState[cb.dataset.ingId] = cb.checked;
        cb.closest(".ing-row").classList.toggle("unchecked", !cb.checked);
        document.getElementById("ing-count").textContent =
          Object.values(checkedState).filter(Boolean).length;
      });
    });
    modal.querySelectorAll("[data-ing-qty]").forEach(inp => {
      inp.addEventListener("change", () => {
        const v = parseFloat(inp.value.replace(",", "."));
        if (!isNaN(v) && v > 0) {
          const id = inp.dataset.ingQty;
          const ing = recipe.ingredients.find(i => i.id === id);
          if (ing) ing.qty = v;
        }
      });
    });
    modal.querySelector("[data-add-recipe]").addEventListener("click", () => {
      let added = 0, updated = 0;
      recipe.ingredients.forEach(ing => {
        if (!checkedState[ing.id]) return;
        const p = findProduct(ing.id);
        if (!p) return;
        const cart = activeCart();
        if (cart[ing.id]) {
          cart[ing.id].qty = Math.max(cart[ing.id].qty, ing.qty);
          updated++;
        } else {
          cart[ing.id] = { qty: ing.qty, done: false, store: null };
          added++;
        }
      });
      saveState();
      renderAll();
      hideRecipesModal();
      if (added + updated === 0) {
        showToast("ℹ️ Aucun ingrédient sélectionné", "warn");
      } else {
        showToast(`✓ ${recipe.names[lang] || recipe.names.fr} : ${added} ajoutés${updated > 0 ? ", " + updated + " maj" : ""}`);
      }
    });
  };
  render();
}
function hideRecipesModal() {
  document.getElementById("recipes-modal").classList.remove("visible");
}

// ========== MAGASINS PROCHES (géolocalisation) ==========
let userLocation = null;
function loadCachedLocation() {
  try {
    const v = localStorage.getItem("pm.userLocation");
    if (v) userLocation = JSON.parse(v);
  } catch {}
}
function saveLocation(loc) {
  userLocation = loc;
  try { localStorage.setItem("pm.userLocation", JSON.stringify(loc)); } catch {}
}

function showNearbyStores() {
  const modal = document.getElementById("nearby-modal");
  const content = modal.querySelector(".nearby-content");
  if (!userLocation) {
    content.innerHTML = `
      <div class="nearby-head">
        <h3>📍 Magasins proches</h3>
        <button class="modal-close" data-nearby-close>×</button>
      </div>
      <div class="nearby-perm">
        <div class="emoji" style="font-size:48px">📍</div>
        <p>Pour trouver les magasins les plus proches et les itinéraires, autorise la localisation.</p>
        <button class="btn primary big" data-locate>Activer la localisation</button>
        <p style="font-size:11px;color:var(--muted);margin-top:8px">Tes coordonnées restent sur ton téléphone, jamais envoyées.</p>
      </div>`;
    modal.classList.add("visible");
    modal.querySelector("[data-locate]").addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition(pos => {
        saveLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        showNearbyStores();
      }, err => {
        showToast("Localisation refusée. Tu peux la modifier dans les paramètres du navigateur.", "warn");
      }, { timeout: 10000, enableHighAccuracy: false });
    });
    modal.querySelector("[data-nearby-close]").addEventListener("click", hideNearbyModal);
    return;
  }

  const nearby = nearestStores(userLocation.lat, userLocation.lon, 1);
  const sortedChains = Object.entries(nearby)
    .map(([chain, stores]) => ({ chain, store: stores[0] }))
    .filter(x => x.store)
    .sort((a, b) => a.store.distance - b.store.distance);

  content.innerHTML = `
    <div class="nearby-head">
      <h3>📍 Magasins proches de toi</h3>
      <button class="modal-close" data-nearby-close>×</button>
    </div>
    <div class="nearby-stores">
      ${sortedChains.map(({ chain, store }) => {
        const s = STORES[chain];
        const website = STORE_WEBSITES[chain];
        return `
          <div class="nearby-store">
            <div class="nearby-store-head">
              <span class="store-icon" style="background:${s.color};width:32px;height:32px;font-size:12px">${s.icon}</span>
              <div class="nearby-store-name-block">
                <div class="nearby-store-name">${store.name}</div>
                <div class="nearby-store-meta">${store.address}</div>
              </div>
              <div class="nearby-store-dist">${store.distance} km</div>
            </div>
            <div class="nearby-store-info">
              <span class="nearby-pill">${store.delivery ? "🚚 Livraison" : "🚫 Retrait magasin"}</span>
              <span class="nearby-pill">🕐 ${store.hours}</span>
            </div>
            <div class="nearby-actions">
              <a href="${wazeURL(store.lat, store.lon)}" target="_blank" rel="noopener" class="nearby-btn waze">
                <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
                  <circle cx="24" cy="24" r="20" fill="#fff"/>
                  <path d="M24 8C14.06 8 6 16.06 6 26c0 4.5 1.66 8.62 4.4 11.78-.5 1.18-1.4 2.5-2.4 3.22 1.5.4 4.2 0 6-1.4 2.6 1.5 5.7 2.4 9 2.4h1c10.5 0 18-8 18-18S33.94 8 24 8z" fill="#33CCFF"/>
                  <circle cx="18" cy="22" r="2.2" fill="#fff"/>
                  <circle cx="30" cy="22" r="2.2" fill="#fff"/>
                  <path d="M14 28c1.5 3 5 5.5 10 5.5s8.5-2.5 10-5.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                </svg>
                Waze
              </a>
              <a href="${googleMapsURL(store.lat, store.lon)}" target="_blank" rel="noopener" class="nearby-btn gmaps">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <defs>
                    <linearGradient id="gmpin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="#EA4335"/>
                      <stop offset="1" stop-color="#C5221F"/>
                    </linearGradient>
                  </defs>
                  <path d="M12 1C7.03 1 3 5.03 3 10c0 6.5 9 13 9 13s9-6.5 9-13c0-4.97-4.03-9-9-9z" fill="url(#gmpin)"/>
                  <circle cx="12" cy="10" r="3.5" fill="#fff"/>
                  <circle cx="12" cy="10" r="2.2" fill="#1A73E8"/>
                </svg>
                Google Maps
              </a>
              ${website ? `<a href="${website}" target="_blank" rel="noopener" class="nearby-btn site">🛒 Commander</a>` : ""}
            </div>
          </div>`;
      }).join("")}
    </div>
    <div style="text-align:center;padding:8px;font-size:11px;color:var(--muted)">
      📍 Position : ${userLocation.lat.toFixed(3)}, ${userLocation.lon.toFixed(3)}
      · <button class="link-btn" data-relocate>Mettre à jour</button>
    </div>`;
  modal.classList.add("visible");
  modal.querySelector("[data-nearby-close]").addEventListener("click", hideNearbyModal);
  modal.querySelector("[data-relocate]").addEventListener("click", () => {
    userLocation = null;
    try { localStorage.removeItem("pm.userLocation"); } catch {}
    showNearbyStores();
  });
}
function hideNearbyModal() {
  document.getElementById("nearby-modal").classList.remove("visible");
}
// Détecte les promos qui n'ont jamais été vues (depuis la dernière visite)
// et affiche un toast d'alerte.
function detectNewPromos() {
  if (typeof PROMOTIONS === "undefined") return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem("pm.seenPromos") || "{}"); } catch {}
  const newOnes = PROMOTIONS.filter(p => !seen[p.id]);
  if (newOnes.length === 0) return;
  // Affiche après 1.5s pour laisser l'app se charger
  setTimeout(() => {
    if (newOnes.length === 1) {
      const p = newOnes[0];
      showToast(`🎁 Nouvelle promo : ${p.title} chez ${STORES[p.chain].name}`);
    } else {
      showToast(`🎁 ${newOnes.length} nouvelles promos disponibles ! Voir le bandeau jaune dans la liste.`);
    }
    // Marque comme vues
    const updated = { ...seen };
    newOnes.forEach(p => { updated[p.id] = Date.now(); });
    try { localStorage.setItem("pm.seenPromos", JSON.stringify(updated)); } catch {}
  }, 1500);
}

// ========== INIT ==========
// Nettoyage des photos cachées de l'ancienne version
try {
  const keys = Object.keys(localStorage);
  keys.filter(k => k.startsWith("pm.img.")).forEach(k => localStorage.removeItem(k));
} catch {}

applyLang();
applyTheme();
setupImageObserver();
renderLangPicker();
loadCachedLocation();
detectNewPromos();
renderUpdateBanner();
renderStaticTexts();
renderStoreBadges();
renderQuickCategories();
checkIncomingList();
renderAll();
setupSettings();
setupEvents();
setupPWA();
loadLivePrices();
