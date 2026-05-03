// PrixMalin - logique principale
// Dépend de : data/products.js (STORES, PRODUCTS, LAST_UPDATED)
//             data/i18n.js (I18N, PRODUCT_I18N)

const STORAGE_KEY = "prixmalin.state.v3";
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
      s.mode = s.mode || "single";
      return s;
    }
    // migration v2 -> v3 : ancien panier devient liste unique
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const cart = JSON.parse(v2);
      const id = newId();
      return { ...defaultState(), activeListId: id,
               lists: { [id]: { name: "", cart, createdAt: Date.now() } } };
    }
    // migration v1
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const old = JSON.parse(v1);
      const cart = {};
      Object.entries(old).forEach(([id, qty]) => { cart[id] = { qty, done: false }; });
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

// ========== PHOTOS PRODUITS (Open Food Facts + Wikimedia) ==========
// Recherche async en ligne, cache localStorage permanent, fallback emoji
const IMG_CACHE = {};   // mémoire
const IMG_LOADING = {}; // promesses en cours
const IMG_PREFIX = "pm.img.";

function imgFromCache(pid) {
  if (IMG_CACHE[pid] !== undefined) return IMG_CACHE[pid];
  try {
    const v = localStorage.getItem(IMG_PREFIX + pid);
    if (v !== null) {
      const url = v || null;
      IMG_CACHE[pid] = url;
      return url;
    }
  } catch {}
  return undefined; // pas en cache
}

function imgSetCache(pid, url) {
  IMG_CACHE[pid] = url || null;
  try { localStorage.setItem(IMG_PREFIX + pid, url || ""); } catch {}
}

// Pour les requêtes : utilise le nom anglais si dispo (meilleur taux de match sur OFF)
function searchTermsFor(p) {
  const tr = (typeof PRODUCT_I18N !== "undefined") ? PRODUCT_I18N[p.id] : null;
  let q = (tr && tr.en) || p.name;
  // Garde les premiers mots significatifs, retire les unités/parenthèses
  q = q.replace(/\([^)]*\)/g, "").replace(/[0-9]+\s*(g|kg|ml|l|u|×).*$/i, "").trim();
  return q.split(/\s+/).slice(0, 3).join(" ");
}

async function tryOpenFoodFacts(p) {
  try {
    const q = encodeURIComponent(searchTermsFor(p));
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3&fields=image_front_small_url,image_front_thumb_url,image_url`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const j = await r.json();
    for (const item of (j.products || [])) {
      const img = item.image_front_small_url || item.image_front_thumb_url || item.image_url;
      if (img && img.startsWith("http")) return img;
    }
  } catch {}
  return null;
}

async function tryWikimedia(p) {
  try {
    const q = encodeURIComponent(searchTermsFor(p).split(" ")[0]);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=200&generator=search&gsrnamespace=6&gsrsearch=${q}&gsrlimit=1&origin=*`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const thumb = page?.imageinfo?.[0]?.thumburl;
      if (thumb && thumb.startsWith("http")) return thumb;
    }
  } catch {}
  return null;
}

async function fetchProductImage(pid) {
  if (IMG_LOADING[pid]) return IMG_LOADING[pid];
  IMG_LOADING[pid] = (async () => {
    const p = findProduct(pid);
    if (!p) { imgSetCache(pid, null); return null; }
    let url = await tryOpenFoodFacts(p);
    if (!url) url = await tryWikimedia(p);
    imgSetCache(pid, url);
    delete IMG_LOADING[pid];
    return url;
  })();
  return IMG_LOADING[pid];
}

// Lance le chargement pour les éléments visibles avec data-pid
let imgObserver = null;
function setupImageObserver() {
  if (imgObserver) imgObserver.disconnect();
  if (typeof IntersectionObserver === "undefined") return;
  imgObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const pid = el.dataset.pid;
      if (!pid) return;
      imgObserver.unobserve(el);
      const cached = imgFromCache(pid);
      if (typeof cached === "string" && cached) {
        applyImage(el, cached);
      } else if (cached === null) {
        // déjà tenté, pas de photo trouvée
      } else {
        fetchProductImage(pid).then(url => { if (url) applyImage(el, url); });
      }
    });
  }, { rootMargin: "100px" });
}
function applyImage(el, url) {
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  img.onerror = () => { img.remove(); }; // garde l'emoji
  img.onload = () => {
    el.classList.add("has-img");
    el.innerHTML = "";
    el.appendChild(img);
  };
}
function observeProductIcons(container) {
  if (!imgObserver) return;
  container.querySelectorAll(".prod-icon[data-pid]").forEach(el => {
    const pid = el.dataset.pid;
    const cached = imgFromCache(pid);
    if (typeof cached === "string" && cached) applyImage(el, cached);
    else if (cached === undefined) imgObserver.observe(el);
  });
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
    LIVE_META = { chains: data.chains || [], summary: data.summary || {}, matched: Object.keys(LIVE_PRICES).length };
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
    renderUpdateBanner(); renderAll();
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
  wrap.innerHTML = Object.values(STORES).map(s =>
    `<span class="store-badge"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`
  ).join("");
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
function renderSearchResults() {
  const wrap = document.getElementById("search-results");
  if (!state.searchQuery && !state.activeCategory) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  const results = filterProducts(state.searchQuery, state.activeCategory).slice(0, 30);
  if (results.length === 0) {
    wrap.hidden = false;
    wrap.innerHTML = `<div class="search-result-item"><span class="meta">${t("search_none")}</span></div>`;
    return;
  }
  wrap.hidden = false;
  wrap.innerHTML = results.map(p => {
    const cheapest = cheapestStoreFor(p);
    const qty = getQty(p.id);
    const cartTag = qty ? `<span style="color:var(--success);font-weight:600">✓ ${formatQty(qty)}×</span>` : "";
    return `
      <div class="search-result-item" data-id="${p.id}">
        <div class="prod-icon" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px">${tProduct(p)} ${cartTag}</div>
          <div class="meta">${tCat(p.category)} · ${p.unit} · ${t("starting_at")} <strong style="color:${STORES[cheapest.store].color}">${formatPrice(cheapest.price)}</strong> ${t("at_store")} ${STORES[cheapest.store].name}</div>
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
    });
  });
  observeProductIcons(wrap);
}
function cheapestStoreFor(product) {
  let best = { store: null, price: Infinity };
  Object.entries(product.prices).forEach(([store, price]) => {
    if (price != null && price < best.price) best = { store, price };
  });
  return best;
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
      renderQuickCategories();
      renderSearchResults();
    });
  });
}

// ========== PANIER ==========
function addToCart(id, qty) {
  const p = findProduct(id);
  if (!p) return;
  if (qty == null) qty = defaultQty(p);
  const cart = activeCart();
  if (cart[id]) { cart[id].qty += qty; cart[id].done = false; }
  else { cart[id] = { qty, done: false }; }
  state.frequency[id] = (state.frequency[id] || 0) + 1;
  state.lists[state.activeListId].updatedAt = Date.now();
  saveState(); renderAll();
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
  renderSuggestions();
  renderCart();
  renderComparison();
  renderMobileCTA();
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
      const id = el.dataset.id, action = el.dataset.action;
      if (action === "inc") bumpQty(id, +1);
      else if (action === "dec") bumpQty(id, -1);
      else if (action === "rm") removeFromCart(id);
      else if (action === "toggle") toggleDone(id);
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
  const cheapest = cheapestStoreFor(p);
  const cheapestStore = STORES[cheapest.store];
  const qtyStr = formatQty(item.qty);
  return `
    <div class="cart-item ${item.done ? "done" : ""} ${big ? "big" : ""}">
      <button class="check-btn ${item.done ? "checked" : ""}" data-action="toggle" data-id="${id}" aria-label="✓">
        ${item.done ? "✓" : ""}
      </button>
      <div class="prod-icon" data-pid="${p.id}" style="background:${productTint(p)}">${productIcon(p)}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${tProduct(p)}</div>
        <div class="cart-item-meta">
          <span>${p.unit}</span>
          <span class="dot">·</span>
          <span class="cart-item-best" style="color:${cheapestStore.color}">
            ${t("starting_at")} ${formatPrice(cheapest.price)} (${cheapestStore.name})
          </span>
        </div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-action="dec" data-id="${id}" aria-label="−">−</button>
        <input class="qty-input" data-id="${id}" type="text" inputmode="decimal" value="${qtyStr}" />
        <button class="qty-btn" data-action="inc" data-id="${id}" aria-label="+">+</button>
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
  if (state.mode === "single") {
    renderSingleStore(wrap);
    optiWrap.hidden = true; optiWrap.innerHTML = "";
  } else {
    wrap.innerHTML = "";
    optiWrap.hidden = false;
    renderOptimized(optiWrap);
  }
}

function renderSingleStore(wrap) {
  const totals = computeStoreTotals();
  const sorted = Object.values(totals).sort((a, b) => {
    const ac = a.missing.length === 0 ? 0 : 1, bc = b.missing.length === 0 ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.total - b.total;
  });
  const completes = sorted.filter(s => s.missing.length === 0);
  const cheapest = completes[0];
  const mostExpensive = completes[completes.length - 1];

  wrap.innerHTML = sorted.map(s => {
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
      <div class="store-card ${isCheapest ? "cheapest" : ""} ${!isComplete ? "unavailable" : ""}">
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

// Crée une nouvelle liste contenant uniquement les produits assignés au magasin donné
function exportStoreAsNewList(storeId) {
  const assignment = state._lastAssignment || {};
  const cart = activeCart();
  const newCart = {};
  Object.entries(assignment).forEach(([pid, a]) => {
    if (a.store === storeId && cart[pid]) {
      newCart[pid] = { qty: cart[pid].qty, done: false };
    }
  });
  if (Object.keys(newCart).length === 0) return;
  const id = newId();
  const storeName = STORES[storeId].name;
  state.lists[id] = {
    name: `🛒 ${storeName}`,
    cart: newCart,
    createdAt: Date.now()
  };
  state.activeListId = id;
  saveState();
  renderAll();
  showToast(`✓ ${t("new_list")}: ${storeName} (${Object.keys(newCart).length})`);
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
function encodeCart() {
  const cart = activeCart();
  const parts = Object.entries(cart).map(([id, item]) => `${id}:${item.qty}:${item.done ? 1 : 0}`);
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
      const [id, qty, done] = part.split(":");
      if (id && findProduct(id)) cart[id] = { qty: parseFloat(qty) || 1, done: done === "1" };
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
  search.addEventListener("input", e => { state.searchQuery = e.target.value; renderSearchResults(); });
  search.addEventListener("focus", () => { if (state.searchQuery || state.activeCategory) renderSearchResults(); });
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-box") && !e.target.closest(".quick-categories")) {
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
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
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

// ========== INIT ==========
applyLang();
applyTheme();
setupImageObserver();
renderLangPicker();
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
