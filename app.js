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
    activeSubcat: null,
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
  if (tr && tr[state.lang]) return tr[state.lang];
  // Fallback automatique basé sur l'id du produit
  return autoTranslateName(p);
}

// Fallback automatique : traduit le nom français à partir de patterns dans l'id.
// Permet de couvrir les ~700 produits sans avoir à tout traduire à la main.
const AUTO_NAME_FR = {
  // L1 : prefix d'id -> { he, en, ru }
  prefixes: [
    // Laitiers
    ["milk-", { he: "חלב", en: "Milk", ru: "Молоко" }],
    ["yogurt-", { he: "יוגורט", en: "Yogurt", ru: "Йогурт" }],
    ["cheese-emek", { he: "גבינת עמק", en: "Emek cheese", ru: "Сыр Эмек" }],
    ["cheese-gilboa", { he: "גבינת גלבוע תנובה", en: "Gilboa Tnuva", ru: "Сыр Гильбоа" }],
    ["cheese-noam", { he: "גבינת נועם", en: "Noam cheese", ru: "Сыр Ноам" }],
    ["cheese-gad", { he: "גבינת גד", en: "Gad cheese", ru: "Сыр Гад" }],
    ["cheese-yellow", { he: "גבינה צהובה", en: "Yellow cheese", ru: "Жёлтый сыр" }],
    ["cheese-", { he: "גבינה", en: "Cheese", ru: "Сыр" }],
    ["cream-fresh", { he: "שמנת חמוצה סמיכה", en: "Thick sour cream", ru: "Густая сметана" }],
    // Œufs
    ["eggs-", { he: "ביצים", en: "Eggs", ru: "Яйца" }],
    // Viande
    ["chicken-", { he: "עוף", en: "Chicken", ru: "Курица" }],
    ["turkey-", { he: "הודו", en: "Turkey", ru: "Индейка" }],
    ["beef-", { he: "בקר", en: "Beef", ru: "Говядина" }],
    ["lamb-", { he: "כבש", en: "Lamb", ru: "Баранина" }],
    ["veal-", { he: "עגל", en: "Veal", ru: "Телятина" }],
    ["duck-", { he: "ברווז", en: "Duck", ru: "Утка" }],
    ["ground-beef-", { he: "בקר טחון", en: "Ground beef", ru: "Фарш говяжий" }],
    // Boulangerie
    ["bread-", { he: "לחם", en: "Bread", ru: "Хлеб" }],
    ["pita-", { he: "פיתה", en: "Pita", ru: "Пита" }],
    // Fruits
    ["apple-", { he: "תפוח", en: "Apple", ru: "Яблоко" }],
    ["pear-", { he: "אגס", en: "Pear", ru: "Груша" }],
    ["grape-", { he: "ענבים", en: "Grapes", ru: "Виноград" }],
    // Tomates
    ["tomato-", { he: "עגבניות", en: "Tomatoes", ru: "Помидоры" }],
    ["onion-", { he: "בצל", en: "Onion", ru: "Лук" }],
    ["pepper-", { he: "פלפל", en: "Pepper", ru: "Перец" }],
    ["carrot-", { he: "גזר", en: "Carrot", ru: "Морковь" }],
    ["chili-", { he: "צ'ילי", en: "Chili", ru: "Чили" }],
    ["lettuce-", { he: "חסה", en: "Lettuce", ru: "Салат" }],
    ["salad-", { he: "סלט", en: "Salad", ru: "Салат" }],
    ["mushroom-", { he: "פטריות", en: "Mushrooms", ru: "Грибы" }],
    ["olives-", { he: "זיתים", en: "Olives", ru: "Оливки" }],
    // Épicerie
    ["rice-", { he: "אורז", en: "Rice", ru: "Рис" }],
    ["pasta-", { he: "פסטה", en: "Pasta", ru: "Паста" }],
    ["lentils-", { he: "עדשים", en: "Lentils", ru: "Чечевица" }],
    ["chickpeas-", { he: "חומוס", en: "Chickpeas", ru: "Нут" }],
    ["beans-", { he: "שעועית", en: "Beans", ru: "Фасоль" }],
    ["oil-", { he: "שמן", en: "Oil", ru: "Масло" }],
    ["vinegar-", { he: "חומץ", en: "Vinegar", ru: "Уксус" }],
    ["paprika-", { he: "פפריקה", en: "Paprika", ru: "Паприка" }],
    ["jam-", { he: "ריבת", en: "Jam", ru: "Варенье" }],
    ["sugar-", { he: "סוכר", en: "Sugar", ru: "Сахар" }],
    ["flour-", { he: "קמח", en: "Flour", ru: "Мука" }],
    ["cereal-", { he: "דגני בוקר", en: "Cereal", ru: "Хлопья" }],
    ["coffee-", { he: "קפה", en: "Coffee", ru: "Кофе" }],
    ["tea-", { he: "תה", en: "Tea", ru: "Чай" }],
    ["wine-", { he: "יין", en: "Wine", ru: "Вино" }],
    ["beer-", { he: "בירה", en: "Beer", ru: "Пиво" }],
    ["water-", { he: "מים", en: "Water", ru: "Вода" }],
    ["coke-", { he: "קוקה קולה", en: "Coca-Cola", ru: "Кока-Кола" }],
    ["juice-", { he: "מיץ", en: "Juice", ru: "Сок" }],
    ["soda-", { he: "משקה מוגז", en: "Soda", ru: "Газировка" }],
    // Surgelés
    ["frozen-", { he: "קפוא", en: "Frozen", ru: "Замороженный" }],
    ["ice-cream-", { he: "גלידה", en: "Ice cream", ru: "Мороженое" }],
    // Snacks
    ["chocolate-", { he: "שוקולד", en: "Chocolate", ru: "Шоколад" }],
    ["burekas-", { he: "בורקס", en: "Bourekas", ru: "Бурекас" }],
    ["cake-", { he: "עוגה", en: "Cake", ru: "Кекс" }],
    ["biscuits-", { he: "ביסקוויטים", en: "Biscuits", ru: "Печенье" }],
    ["cookies-", { he: "עוגיות", en: "Cookies", ru: "Печенье" }],
    ["chips-", { he: "צ'יפס", en: "Chips", ru: "Чипсы" }],
    ["candy-", { he: "סוכריות", en: "Candy", ru: "Конфеты" }],
    ["nuts-", { he: "אגוזים", en: "Nuts", ru: "Орехи" }],
    ["snack-", { he: "חטיף", en: "Snack", ru: "Снек" }],
    // Bébé
    ["diapers-", { he: "חיתולים", en: "Diapers", ru: "Подгузники" }],
    ["baby-", { he: "תינוק", en: "Baby", ru: "Детское" }],
    ["training-pants", { he: "תחתוני אימון", en: "Training pants", ru: "Трусики" }],
    // Hygiène
    ["shampoo-", { he: "שמפו", en: "Shampoo", ru: "Шампунь" }],
    ["soap-", { he: "סבון", en: "Soap", ru: "Мыло" }],
    ["deodorant-", { he: "דאודורנט", en: "Deodorant", ru: "Дезодорант" }],
    ["toilet-paper-", { he: "נייר טואלט", en: "Toilet paper", ru: "Туалетная бумага" }],
    ["tissues-", { he: "ממחטות", en: "Tissues", ru: "Салфетки" }],
    // Entretien
    ["laundry-", { he: "אבקת כביסה", en: "Laundry", ru: "Стиральный порошок" }],
    ["dish-", { he: "סבון כלים", en: "Dish soap", ru: "Средство для посуды" }],
    ["trash-bags-", { he: "שקיות אשפה", en: "Trash bags", ru: "Мусорные пакеты" }],
    // Animaux
    ["dog-", { he: "כלבים", en: "Dog", ru: "Собаки" }],
    ["cat-", { he: "חתולים", en: "Cat", ru: "Кошки" }]
  ]
};
function autoTranslateName(p) {
  if (!p) return "";
  const lang = state.lang;
  // Cherche le préfixe le plus long qui matche
  let bestMatch = null;
  for (const [prefix, names] of AUTO_NAME_FR.prefixes) {
    if (p.id === prefix || p.id.startsWith(prefix)) {
      if (!bestMatch || prefix.length > bestMatch.prefix.length) {
        bestMatch = { prefix, names };
      }
    }
  }
  if (bestMatch && bestMatch.names[lang]) {
    // Suffixe : extrait du nom français ce qui suit le mot principal
    let suffix = "";
    const m = p.name.match(/\(([^)]+)\)/);
    if (m) suffix = " (" + m[1] + ")";
    // Ajoute marque si présente dans le nom
    const brandMatch = p.name.match(/(Tnuva|Tara|Yotvata|Strauss|Osem|Sugat|Telma|Achva|Sabra|Elite|Wissotzky|Carmel|Coca|Pepsi|Pantene|Colgate|Sano|Ariel|Tnuva|Yoplait|Danone|Heinz|Pringles|Doritos|Lindt|Milka|Nutella|Bonzo|Whiskas|Materna|Huggies|Pampers|Lily|Berman|Angel|Maadanot|McCain|Sunfrost)/i);
    if (brandMatch) suffix += " " + brandMatch[0];
    return bestMatch.names[lang] + suffix;
  }
  // Aucun fallback : on garde le français
  return p.name;
}
function tCat(cat) {
  const dict = I18N[state.lang] || I18N.fr;
  return (dict.cat && dict.cat[cat]) || cat;
}
function tSubcat(sub) {
  const dict = I18N[state.lang] || I18N.fr;
  return (dict.subcat && dict.subcat[sub]) || sub;
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
// Parse "500g" / "0.5kg" / "2L" / "300ml" -> nombre de fois l'unité produit
// Ex : pour un produit vendu en "1kg", "500g" -> 0.5
//      pour un produit vendu en "1L", "250ml" -> 0.25
//      pour "1u", "3" -> 3
function parseQtyInput(value, productUnit) {
  if (!value) return null;
  const v = String(value).toLowerCase().replace(",", ".").trim();
  const m = v.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|u|×|x)?$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2];
  if (!unit) return num;
  const pu = (productUnit || "").toLowerCase();
  // Détecte l'unité produit (poids vs volume vs pièces)
  if (pu.includes("kg") || pu.match(/^\d+\s*g/) || pu.endsWith("g")) {
    // Produit pesé : convertir tout en kg
    let kg = num;
    if (unit === "g") kg = num / 1000;
    else if (unit === "kg") kg = num;
    // Diviser par la taille de l'unité produit
    const puMatch = pu.match(/(\d+(?:\.\d+)?)\s*(g|kg)/);
    if (puMatch) {
      const puNum = parseFloat(puMatch[1]);
      const puUnit = puMatch[2];
      const puKg = puUnit === "g" ? puNum / 1000 : puNum;
      return puKg > 0 ? kg / puKg : num;
    }
    return kg;
  }
  if (pu.includes("l") || pu.endsWith("ml")) {
    let l = num;
    if (unit === "ml") l = num / 1000;
    else if (unit === "l") l = num;
    const puMatch = pu.match(/(\d+(?:\.\d+)?)\s*(ml|l)/);
    if (puMatch) {
      const puNum = parseFloat(puMatch[1]);
      const puUnit = puMatch[2];
      const puL = puUnit === "ml" ? puNum / 1000 : puNum;
      return puL > 0 ? l / puL : num;
    }
    return l;
  }
  return num;
}
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

// Charge les vraies promos depuis live-promotions.json (généré par scraper)
let LIVE_PROMOS = null;
async function loadLivePromos() {
  try {
    const res = await fetch("data/live-promotions.json", { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.promos || Object.keys(data.promos).length === 0) return;
    // Convertit le format scraper -> format app PROMOTIONS
    const newPromos = [];
    Object.entries(data.promos).forEach(([id, p]) => {
      // Détecter type et paramètres
      let type = "discount_pct", n = 0, m = 0, pct = 0, fixed = 0, price = 0;
      if (p.type === "n_for_price" && p.min_qty >= 2 && p.discounted_price > 0) {
        type = "n_for_price"; n = Math.round(p.min_qty); price = p.discounted_price;
      } else if (p.type === "buy_one_get_one") {
        type = "n_for_m"; n = 2; m = 1;
      } else if (p.discount_rate > 0) {
        type = "category_pct"; pct = Math.round(p.discount_rate);
      } else {
        type = "discount_pct"; pct = 10;
      }
      newPromos.push({
        id: "live-" + id,
        chain: p.chain,
        type,
        title: p.title || p.description || "",
        desc: p.title || "",
        products: p.products || [],
        n, m, pct, fixed, price,
        validUntil: p.valid_until,
        _live: true
      });
    });
    if (newPromos.length > 0 && typeof PROMOTIONS !== "undefined") {
      // Remplace les mocks par les vraies promos
      PROMOTIONS.length = 0;
      newPromos.forEach(p => PROMOTIONS.push(p));
      LIVE_PROMOS = data;
      renderTopPromos();
      renderPromos();
    }
  } catch {}
}

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
  // Si live-prices.json a été chargé avec une date, l'utiliser, sinon date du jour
  const dateToShow = (LIVE_META && LIVE_META.generatedAt) ? LIVE_META.generatedAt : new Date().toISOString();
  document.getElementById("last-updated").textContent = formatDate(dateToShow);
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
    const tip = isLive ? `${liveCount} ${t("live_ready")}` : t("live_waiting");
    return `<span class="store-badge ${isLive ? "live" : ""}" title="${tip}" translate="no"><span class="dot" style="background:${s.color}"></span>${s.name}${status}</span>`;
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
  // Tous les éléments avec data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const txt = t(key);
    if (typeof txt === "string" && txt && txt !== key) el.textContent = txt;
  });
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
function filterProducts(query, category, subcat) {
  const q = normalize(query.trim());
  const matches = [];
  PRODUCTS.forEach(p => {
    if (category && p.category !== category) return;
    if (subcat && p.subcategory !== subcat) return;
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
  attachWheelHorizontalScroll(wrap);
  wrap.querySelectorAll(".cat-pill").forEach(el => {
    el.addEventListener("click", () => {
      state.activeCategory = state.activeCategory === el.dataset.cat ? null : el.dataset.cat;
      state.activeSubcat = null; // reset à chaque changement de catégorie
      _browsePage = 1;
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
  // Auto-add au frigo quand l'item est coché (= acheté)
  if (cart[id].done) {
    try { addToFridge(id); } catch {}
  }
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
  renderTopPromos();
  renderBrowsePanel();
  renderSuggestions();
  renderCart();
  renderPromos();
  renderComparison();
  renderMobileCTA();
}

// Bandeau promos toujours visible en haut, style Circl :
// scroll horizontal de cartes attrayantes (image, prix barré,
// badge "économies", logo magasin)
function renderTopPromos() {
  const wrap = document.getElementById("promos-top");
  if (!wrap || typeof PROMOTIONS === "undefined") return;

  function isSuper(p) {
    return (p.fixed && p.fixed >= 15) || (p.pct && p.pct >= 25) || (p.type === "n_for_m" && (p.n - p.m) >= 2);
  }

  // Top 8 promos triées par attractivité
  const top = [...PROMOTIONS].sort((a, b) => {
    const sa = isSuper(a) ? 1 : 0;
    const sb = isSuper(b) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.pct || b.fixed || 0) - (a.pct || a.fixed || 0);
  }).slice(0, 8);

  if (top.length === 0) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";

  const lang = state.lang;
  const labels = {
    fr: { title: "🔥 Promos du moment", all: "Voir tout", saving: "économies" },
    he: { title: "🔥 המבצעים החמים", all: "לכל המבצעים", saving: "חיסכון" },
    en: { title: "🔥 Hot deals", all: "See all", saving: "savings" },
    ru: { title: "🔥 Горячие акции", all: "Все акции", saving: "экономия" }
  };
  const L = labels[lang] || labels.fr;

  wrap.innerHTML = `
    <div class="promos-top-head">
      <span class="promos-top-title">${L.title}</span>
      <button class="promos-top-all" data-promos-all>${L.all} →</button>
    </div>
    <div class="promos-top-scroll">
      ${top.map(p => {
        const store = STORES[p.chain];
        const _super = isSuper(p);
        // Produit représentatif
        let firstProd = null;
        if (p.products && p.products.length) firstProd = findProduct(p.products[0]);
        else if (p.requiredAny && p.requiredAny[0]) firstProd = findProduct(p.requiredAny[0][0]);
        else if (p.category) firstProd = PRODUCTS.find(x => x.category === p.category);

        // Badge type promo (type "2ème à moitié prix")
        let typeBadge = "";
        if (p.type === "n_for_m" && p.n === 2 && p.m === 1) typeBadge = lang === "he" ? "1+1" : (lang === "fr" ? "1+1" : "Buy 1 get 1");
        else if (p.type === "n_for_m") typeBadge = `${p.n}=${p.m}`;
        else if (p.type === "second_pct") typeBadge = lang === "he" ? `2-י −${p.pct}%` : (lang === "fr" ? `2ème −${p.pct}%` : `2nd −${p.pct}%`);
        else if (p.type === "n_for_price") typeBadge = `${p.n} = ${formatPrice(p.price)}`;
        else if (p.pct) typeBadge = `−${p.pct}%`;
        else if (p.fixed) typeBadge = `−${formatPrice(p.fixed)}`;

        // Prix : si on a un produit, calcule prix avant/après
        let pricesHTML = "";
        let savingHTML = "";
        if (firstProd) {
          const baseP = firstProd.prices[p.chain];
          if (baseP) {
            let newP = baseP;
            let savedAmount = 0;
            if (p.pct) { newP = baseP * (1 - p.pct/100); savedAmount = baseP - newP; }
            else if (p.type === "n_for_m") { newP = baseP * p.m / p.n; savedAmount = baseP - newP; }
            else if (p.type === "second_pct") { newP = baseP * (1 - p.pct/200); savedAmount = baseP - newP; }
            else if (p.fixed) { savedAmount = p.fixed; newP = Math.max(0, baseP - p.fixed); }
            pricesHTML = `
              <div class="ptop-prices">
                <span class="ptop-price-old">${formatPrice(baseP)}</span>
                <span class="ptop-price-new">${formatPrice(newP)}</span>
              </div>`;
            if (savedAmount > 0.5) {
              savingHTML = `<div class="ptop-saving-pill">💚 ${formatPrice(savedAmount)} ${L.saving}</div>`;
            }
          }
        }

        return `
          <div class="ptop-card ${_super ? "super" : ""}" data-promo-card="${p.id}" data-add-pid="${firstProd ? firstProd.id : ""}" data-add-store="${p.chain}">
            <div class="ptop-card-top">
              ${typeBadge ? `<span class="ptop-type">${typeBadge}</span>` : ""}
              <div class="ptop-store-logo" style="background:${store.color}">
                <span>${store.icon}</span>
              </div>
            </div>
            <div class="ptop-image" style="background:${firstProd ? productTint(firstProd) : 'var(--accent-soft)'}">
              <span class="ptop-image-emoji">${firstProd ? productIcon(firstProd) : "🎁"}</span>
            </div>
            <div class="ptop-info">
              <div class="ptop-title">${firstProd ? tProduct(firstProd) : p.title}</div>
              <div class="ptop-meta">${firstProd ? firstProd.unit : ""}</div>
              ${pricesHTML}
              ${savingHTML}
              <div class="ptop-store-name">${store.name}</div>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  wrap.querySelector("[data-promos-all]").addEventListener("click", showPromosHub);
  wrap.querySelectorAll("[data-promo-card]").forEach(card => {
    card.addEventListener("click", e => {
      const pid = card.dataset.addPid;
      const store = card.dataset.addStore;
      if (pid) {
        addToCart(pid, undefined, store);
        // Petit feedback visuel
        card.style.transform = "scale(0.96)";
        setTimeout(() => card.style.transform = "", 150);
      } else {
        showPromosHub();
      }
    });
  });
  attachWheelHorizontalScroll(wrap.querySelector(".promos-top-scroll"));
}

// ========== BROWSE PANEL (catégorie -> grille avec scroll infini) ==========
const PAGE_SIZE = 30;
let _browsePage = 1;
let _browseObserver = null;
function renderBrowsePanel() {
  const wrap = document.getElementById("browse-grid");
  if (!wrap) return;
  if (!state.activeCategory && !state.searchQuery) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const all = filterProducts(state.searchQuery, state.activeCategory, state.activeSubcat);
  const products = all.slice(0, _browsePage * PAGE_SIZE);
  if (all.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>${t("search_none")}</div>`;
    return;
  }
  let titleHTML = "";
  if (state.activeCategory) {
    // Compte produits par sous-catégorie pour la catégorie active
    const subcounts = {};
    PRODUCTS.forEach(p => {
      if (p.category === state.activeCategory) {
        subcounts[p.subcategory] = (subcounts[p.subcategory] || 0) + 1;
      }
    });
    const subs = Object.entries(subcounts).sort((a, b) => b[1] - a[1]);
    const breadcrumb = state.activeSubcat
      ? `${tCat(state.activeCategory)} <span style="color:var(--muted)">›</span> ${tSubcat(state.activeSubcat)}`
      : tCat(state.activeCategory);
    titleHTML = `
      <div class="browse-head">
        <span class="browse-title">${breadcrumb}</span>
        <span class="browse-count">${all.length}</span>
        <button class="link-btn" data-clear-cat>×</button>
      </div>
      <div class="subcat-row">
        <button class="subcat-pill ${!state.activeSubcat ? "active" : ""}" data-subcat="">${t("cat_all")}</button>
        ${subs.map(([s, n]) => `<button class="subcat-pill ${state.activeSubcat === s ? "active" : ""}" data-subcat="${s}">${tSubcat(s)} <span class="subcat-count">${n}</span></button>`).join("")}
      </div>`;
  } else {
    titleHTML = `<div class="browse-head"><span class="browse-title">"${state.searchQuery}"</span><span class="browse-count">${all.length}</span></div>`;
  }
  const remaining = all.length - products.length;
  const sentinelHTML = remaining > 0
    ? `<div class="browse-sentinel" id="browse-sentinel">⏳ ${remaining} de plus à charger…</div>`
    : (all.length > PAGE_SIZE ? `<div class="browse-end">✓ ${all.length} produits affichés</div>` : "");
  wrap.innerHTML = titleHTML + `
    <div class="prod-grid">
      ${products.map(p => {
        const cheapest = cheapestStoreFor(p);
        const sp = priceSpread(p);
        const inCart = getQty(p.id);
        const cs = STORES[cheapest.store];
        // Liste des prix par magasin triés (pour les mini-tags)
        const sortedPrices = Object.entries(p.prices)
          .map(([s, v]) => ({ store: s, price: v }))
          .sort((a, b) => {
            if (a.price == null && b.price == null) return 0;
            if (a.price == null) return 1;
            if (b.price == null) return -1;
            return a.price - b.price;
          });
        const availCount = sortedPrices.filter(x => x.price != null).length;
        return `
          <div class="prod-card" data-pid="${p.id}">
            <div class="prod-icon big" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</div>
            <div class="prod-card-name">${tProduct(p)}</div>
            <div class="prod-card-meta">${p.unit}</div>
            <div class="prod-card-price">
              <span class="prod-card-from">${t("starting_at")}</span>
              <strong style="color:${cs.color}">${formatPrice(cheapest.price)}</strong>
              <span class="prod-card-store-pill" style="background:${cs.color}">
                <span class="prod-card-store-icon">${cs.icon}</span>${cs.name}
              </span>
              <span class="prod-card-spread">→ ${formatPrice(sp.max)} <span class="spread-pct">−${sp.pct}%</span></span>
            </div>
            <div class="prod-card-stores" title="Tap pour voir les ${availCount} prix">
              ${sortedPrices.map((x, i) => {
                const s = STORES[x.store];
                if (x.price == null) return `<span class="mini-store off" title="${s.name} : indisponible">${s.icon}</span>`;
                return `<span class="mini-store ${i === 0 ? "best" : ""}" style="background:${s.color}" title="${s.name} : ${formatPrice(x.price)}">${s.icon}</span>`;
              }).join("")}
            </div>
            ${inCart ? `<div class="prod-card-incart">✓ ${formatQty(inCart)}× ${STORES[chosenStoreFor(p.id) || cheapest.store]?.name || ""}</div>` : ""}
            <button class="prod-card-add" data-add-pid="${p.id}" aria-label="Add">+</button>
          </div>`;
      }).join("")}
    </div>
    ${sentinelHTML}`;
  // Click handlers
  wrap.querySelectorAll(".prod-card").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest("[data-add-pid]")) return;
      showProductDetail(el.dataset.pid);
    });
  });
  wrap.querySelectorAll("[data-add-pid]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); addToCart(el.dataset.add-pid || el.dataset.addPid); });
  });
  const clearBtn = wrap.querySelector("[data-clear-cat]");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    state.activeCategory = null;
    state.activeSubcat = null;
    state.searchQuery = "";
    _browsePage = 1;
    document.getElementById("search-input").value = "";
    renderQuickCategories();
    renderBrowsePanel();
  });
  // Sous-catégorie pills
  wrap.querySelectorAll(".subcat-pill").forEach(el => {
    el.addEventListener("click", () => {
      const s = el.dataset.subcat || null;
      state.activeSubcat = state.activeSubcat === s ? null : (s || null);
      _browsePage = 1;
      renderBrowsePanel();
    });
  });
  const subcatRow = wrap.querySelector(".subcat-row");
  if (subcatRow) attachWheelHorizontalScroll(subcatRow);
  // Scroll infini : observe le sentinel et charge la page suivante
  if (_browseObserver) _browseObserver.disconnect();
  const sentinel = document.getElementById("browse-sentinel");
  if (sentinel && typeof IntersectionObserver !== "undefined") {
    _browseObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        _browsePage++;
        renderBrowsePanel();
      }
    }, { rootMargin: "200px" });
    _browseObserver.observe(sentinel);
  }
  observeProductIcons(wrap);
}
// PARTIAL CONTENT — APP.JS PUSH TRUNCATED DUE TO SIZE — SEE FOLLOWUP COMMIT
