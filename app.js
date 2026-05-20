// ============================================================================
// כדאי v31 — Clean rewrite, monofichier
// Remplace app.js + app-tabs.js + app-features.js anciens.
// Architecture: État → Données → Rendu → Panneaux → Init/Events.
// Inspiré apps de deals (Bonial/Honey/Yad2) mais design + identité originaux.
// ============================================================================

(function () {
"use strict";

// ============================================================================
// 1. ÉTAT
// ============================================================================
const LS_KEY = "kedai.state.v1";

const FAKE_USER = {
  name: "Sarah", avatar: "👩", location: "Netanya, Israël",
  savings_month: 247, savings_total: 1850, deals_used: 34,
  streak: 12, level: 3, next_in: 6, is_premium: false
};

const NOTIFS = [
  { id: 1, icon: "🎁", title: "Nouvelle promo sur ton favori !", text: "Nutella -23% chez Osher Ad", time: "8 min", unread: true },
  { id: 2, icon: "🔥", title: "SUPER deal du jour", text: "Pâtes Osem 1+1 chez Shufersal", time: "2h", unread: true },
  { id: 3, icon: "💚", title: "Économies hier : +35₪", text: "+15 points achievement", time: "hier", unread: false },
  { id: 4, icon: "📍", title: "3 nouvelles offres proches", text: "Victory Netanya HaOrzim", time: "hier", unread: false },
  { id: 5, icon: "👨‍👩‍👧", title: "Marie a ajouté à ta liste", text: "Lait écrémé 1L", time: "2j", unread: false }
];

const ACHIEVEMENTS = [
  { id: "first", icon: "🌱", title: "Première économie", desc: "Économisé 1ère fois", earned: true, date: "12 mar" },
  { id: "100", icon: "💵", title: "100₪ économisés", desc: "Cumulé 100₪", earned: true, date: "18 mar" },
  { id: "streak", icon: "🔥", title: "Semaine de chasse", desc: "7j consécutifs", earned: true, date: "25 mar" },
  { id: "500", icon: "💰", title: "500₪ économisés", desc: "Cumulé 500₪", earned: true, date: "8 avr" },
  { id: "hunter", icon: "🎯", title: "Chasseur de deals", desc: "30 promos", earned: true, date: "2 mai" },
  { id: "social", icon: "📤", title: "Partageur", desc: "Partage 5 listes", earned: false, progress: "3/5" },
  { id: "1000", icon: "👑", title: "Champion 1000₪", desc: "Cumulé 1000₪", earned: false, progress: "1850/1000 ✓" },
  { id: "explorer", icon: "🗺️", title: "Explorateur", desc: "5 magasins visités", earned: false, progress: "2/5" }
];

const STORIES = [
  { store: "rami_levy", title: "Promo Shabbat", emoji: "🕯️" },
  { store: "shufersal", title: "Hot deals", emoji: "🔥" },
  { store: "osher_ad", title: "Nouveau catalogue", emoji: "📋" },
  { store: "victory", title: "Solde été", emoji: "☀️" },
  { store: "yochananof", title: "Bio & frais", emoji: "🌿" },
  { store: "boom", title: "Mega deal", emoji: "💥" },
  { store: "carrefour", title: "Produits France", emoji: "🥐" }
];

const CHAT_STARTERS = [
  "🔍 Trouve-moi des promos pâtes",
  "🍝 Recette pas chère pour ce soir ?",
  "📍 Quel magasin est le moins cher ?",
  "📋 Aide-moi pour Shabbat"
];

const CHAT_REPLIES = {
  promo: "J'ai trouvé 3 super promos sur les pâtes :\n\n🔥 Osem 500g — 1+1 chez Shufersal (jusqu'au 20 mai)\n💚 Barilla — -25% chez Rami Levy\n🎁 Pâtes complètes — 3 paquets à 15₪ chez Victory\n\nTu économises ~12₪. Je les ajoute à ta liste ?",
  recette: "Idée pasta tomate-thon pour 4, ~28₪ total :\n\n• Pâtes 500g (3.22₪ chez Shufersal en promo)\n• Tomates 1kg (8₪)\n• Thon 2 boîtes (9₪)\n• Aromates (~7₪)\n\nTemps : 20 min. Tu veux la recette ?",
  magasin: "D'après ton historique, **Osher Ad Tom Lantos** est ton magasin le plus économique (-8% en moyenne).\n\nCette semaine, Rami Levy HaOrzim a 4 super promos sur tes favoris — ça vaut le détour.",
  shabbat: "Pour Shabbat à 6 personnes, je propose :\n\n🍞 Pain hallah chez Rami Levy (-20%)\n🐟 Saumon 1kg chez Tiv Taam\n🍷 Vin Yarden (3 pour 100₪ chez Carrefour)\n🥗 Salades Osher Ad\n🍰 Gâteau Yochananof\n\nTotal estimé : 245₪ (au lieu de 320₪). Je crée la liste ?",
  default: "En mode démo pour l'instant. Bientôt je serai connecté à Claude pour vraiment t'aider à optimiser tes courses, trouver des recettes économiques, comparer les enseignes en temps réel, etc."
};

// State init
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) {}
  return defaultState();
}

function defaultState() {
  return {
    view: "promos",
    lang: detectLang(),
    theme: "light",
    cart: {},
    favorites: [],
    activeCat: null,
    activeDealCat: null,
    onboarded: false,
    chatMsgs: [{ from: "ai", text: "Salut Sarah ! 👋 Je suis ton assistant כדאי. Que veux-tu faire ?" }],
    notifs_read: []
  };
}

function detectLang() {
  const l = (navigator.language || "fr").slice(0, 2);
  return ["fr", "he", "en", "ru"].includes(l) ? l : "fr";
}

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

window.kedai = window.kedai || {};
window.kedai.state = state;
window.kedai.saveState = saveState;

// ============================================================================
// 1bis. SVG ICONS (inline library, replaces OS-dependent emojis on actions)
// ============================================================================
const ICONS = {
  x:             'M18 6 6 18M6 6l12 12',
  check:         'M5 12l5 5L20 7',
  plus:          'M12 5v14M5 12h14',
  minus:         'M5 12h14',
  "arrow-right": 'M5 12h14M13 5l7 7-7 7',
  "arrow-left":  'M19 12H5M11 19l-7-7 7-7',
  "chevron-right": 'm9 6 6 6-6 6',
  send:          'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  flame:         'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  heart:         'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z',
  bell:          'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  user:          'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  crown:         'm2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 16h14',
  trophy:        'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0Z',
  "map-pin":     'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  star:          'M12 2l2.7 6.5L22 9.3l-5.5 4.8L18 21l-6-3.5L6 21l1.5-6.9L2 9.3l7.3-.8L12 2Z',
  "trending-down": 'm22 17-8.5-8.5-5 5L2 7M16 17h6v-6',
  "badge-check": 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76ZM9 12l2 2 4-4',
  trash:         'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  "chat-bot":    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
};

function kedaiIcon(name, size, opts) {
  size = size || 20;
  opts = opts || {};
  const path = ICONS[name];
  if (!path) return '';
  const stroke = opts.stroke || 'currentColor';
  const fill = opts.fill || 'none';
  const sw = opts.strokeWidth || 1.8;
  return '<svg class="icon" viewBox="0 0 24 24" width="' + size + '" height="' + size +
         '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw +
         '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
}
window.kedaiIcon = kedaiIcon;

// ============================================================================
// 2. DATA HELPERS
// ============================================================================
function getStores() { return (typeof STORES !== "undefined") ? STORES : {}; }
function getProducts() { return (typeof PRODUCTS !== "undefined") ? PRODUCTS : []; }
function getPromos() { return (typeof PROMOTIONS !== "undefined") ? PROMOTIONS : []; }
function getBigDeals() { return (typeof BIG_DEALS !== "undefined") ? BIG_DEALS : []; }
function getBigCats() { return (typeof BIG_CATEGORIES !== "undefined") ? BIG_CATEGORIES : {}; }
function getBigStores() { return (typeof BIG_STORES !== "undefined") ? BIG_STORES : {}; }

function findProduct(id) { return getProducts().find(p => p.id === id); }

function cheapestStoreFor(p) {
  if (!p || !p.prices) return { store: null, price: 0 };
  let best = { store: null, price: Infinity };
  Object.entries(p.prices).forEach(([s, pr]) => {
    if (pr != null && pr < best.price) best = { store: s, price: pr };
  });
  return best;
}

// Convertit un PROMOTIONS entry en infos utilisables
function promoInfo(p) {
  const stores = getStores();
  const store = stores[p.chain] || { name: p.chain || "?", color: "#FF6B35", icon: "🏪" };
  let product = null;
  if (p.products && p.products.length) product = findProduct(p.products[0]);
  else if (p.category) product = getProducts().find(x => x.category === p.category);
  const emoji = (product && product.icon) || "🎁";
  const name = p.title || (product ? product.name : "Promo");
  let baseP = product && product.prices ? product.prices[p.chain] : null;
  let newP = baseP;
  let saved = 0, savedPct = 0;
  if (baseP) {
    if (p.pct) { newP = baseP * (1 - p.pct/100); saved = baseP - newP; savedPct = p.pct; }
    else if (p.type === "n_for_m" && p.n && p.m) { newP = baseP * p.m / p.n; saved = baseP - newP; savedPct = Math.round((1 - p.m/p.n) * 100); }
    else if (p.type === "second_pct" && p.pct) { newP = baseP * (1 - p.pct/200); saved = baseP - newP; savedPct = Math.round(p.pct/2); }
    else if (p.fixed) { saved = p.fixed; newP = Math.max(0, baseP - p.fixed); savedPct = Math.round((p.fixed/baseP) * 100); }
    else if (p.type === "n_for_price" && p.n && p.price) { newP = p.price/p.n; saved = baseP - newP; savedPct = Math.round((1 - newP/baseP) * 100); }
  } else if (p.pct) savedPct = p.pct;
  else if (p.type === "n_for_m" && p.n && p.m) savedPct = Math.round((1 - p.m/p.n) * 100);

  let typeBadge = "";
  if (p.type === "n_for_m" && p.n === 2 && p.m === 1) typeBadge = "1+1";
  else if (p.type === "n_for_m") typeBadge = `${p.n}=${p.m}`;
  else if (p.type === "second_pct") typeBadge = `2ème −${p.pct}%`;
  else if (p.type === "n_for_price") typeBadge = `${p.n} = ₪${p.price}`;
  else if (p.pct) typeBadge = `−${p.pct}%`;
  else if (p.fixed) typeBadge = `−₪${p.fixed}`;

  const isSuper = (p.fixed >= 15) || (p.pct >= 25) || (p.type === "n_for_m" && (p.n - p.m) >= 2);
  return { store, product, emoji, name, baseP, newP, saved, savedPct, typeBadge, isSuper, desc: p.desc, validUntil: p.validUntil };
}

function fmtPrice(n) {
  if (typeof n !== "number") return "—";
  return (Math.round(n * 100) / 100).toFixed(2) + "₪";
}

// ============================================================================
// 3. ROUTING / VIEW SWITCH
// ============================================================================
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  const view = document.querySelector(`.view[data-view="${name}"]`);
  const tab = document.querySelector(`.nav-tab[data-view="${name}"]`);
  if (view) view.classList.add("active");
  if (tab) tab.classList.add("active");
  state.view = name;
  saveState();
  window.scrollTo({ top: 0, behavior: "instant" });

  if (name === "promos") renderPromos();
  else if (name === "list") renderList();
  else if (name === "favs") renderFavs();
  else if (name === "more") renderMore();
}
window.kedai.showView = showView;

// ============================================================================
// 4. RENDU : VUE PROMOS
// ============================================================================
function renderPromos() {
  renderHeroDeal();
  renderStories();
  renderStoresGrid();
  renderFoodCarousel();
  renderBigDealCats();
  renderBigDeals();
}

function renderHeroDeal() {
  const el = $("#hero-deal");
  if (!el) return;
  const promos = getPromos();
  if (!promos.length) { el.style.display = "none"; return; }

  // Choisir le best deal (savedPct + super bonus)
  let best = null, bestScore = -1;
  promos.forEach(p => {
    const i = promoInfo(p);
    let score = i.savedPct || 0;
    if (i.isSuper) score += 20;
    if (score > bestScore) { bestScore = score; best = { p, info: i }; }
  });
  if (!best) { el.style.display = "none"; return; }

  const i = best.info;
  const valid = i.validUntil ? new Date(i.validUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";

  el.innerHTML = `
    <div class="hero-eyebrow">Le deal du jour</div>
    <div class="hero-card" data-promo-pid="${(best.p.products && best.p.products[0]) || ""}">
      <div class="hero-img">
        <span class="hero-emoji">${i.emoji}</span>
        ${i.savedPct > 0 ? `<span class="hero-pct">-${i.savedPct}%</span>` : ""}
      </div>
      <div class="hero-body">
        <div class="hero-store"><span class="hero-dot" style="background:${i.store.color}"></span><span translate="no">${i.store.name}</span></div>
        <div class="hero-title">${i.name}</div>
        ${i.desc ? `<div class="hero-desc">${i.desc}</div>` : ""}
        ${i.baseP ? `
          <div class="hero-prices">
            <span class="hero-new">${fmtPrice(i.newP)}</span>
            <span class="hero-old">${fmtPrice(i.baseP)}</span>
            ${i.saved > 0.5 ? `<span class="hero-save">${kedaiIcon("trending-down", 12)} ${fmtPrice(i.saved)} éco</span>` : ""}
          </div>` : (i.typeBadge ? `<div class="hero-prices"><span class="hero-badge-big">${i.typeBadge}</span></div>` : "")}
        ${valid ? `<div class="hero-until">Jusqu'au ${valid}</div>` : ""}
        <button class="btn primary hero-cta">Voir l'offre ${kedaiIcon("arrow-right", 16)}</button>
      </div>
    </div>
  `;
}

function renderStories() {
  const el = $("#stories");
  if (!el) return;
  const stores = getStores();
  el.innerHTML = STORIES.map(s => {
    const store = stores[s.store] || { name: s.store, color: "#FF6B35" };
    return `
      <button class="story" data-store="${s.store}">
        <div class="story-ring" style="background:linear-gradient(135deg,${store.color},${shade(store.color,-20)})">
          <div class="story-inner">${s.emoji}</div>
        </div>
        <div class="story-label" translate="no">${store.name}</div>
      </button>`;
  }).join("");
}

function renderStoresGrid() {
  const el = $("#stores-grid");
  if (!el) return;
  const stores = getStores();
  const promos = getPromos();
  const counts = {};
  promos.forEach(p => { counts[p.chain] = (counts[p.chain] || 0) + 1; });

  el.innerHTML = Object.entries(stores).map(([id, s]) => `
    <button class="store-tile" data-store="${id}">
      <div class="st-logo" style="background:${s.color}"><span>${s.icon || "🏪"}</span></div>
      <div class="st-name" translate="no">${s.name}</div>
      ${counts[id] ? `<div class="st-count">${counts[id]} promos</div>` : `<div class="st-count off">Bientôt</div>`}
    </button>`).join("");
}

function renderFoodCarousel() {
  const el = $("#food-carousel");
  const count = $("#food-count");
  if (!el) return;
  const promos = [...getPromos()].sort((a, b) => {
    const ai = promoInfo(a), bi = promoInfo(b);
    return (bi.savedPct + (bi.isSuper ? 20 : 0)) - (ai.savedPct + (ai.isSuper ? 20 : 0));
  });
  if (count) count.textContent = `${promos.length} actives`;

  el.innerHTML = promos.slice(0, 12).map(p => {
    const i = promoInfo(p);
    return `
      <div class="promo-tile ${i.isSuper ? "super" : ""}" data-promo-pid="${(p.products && p.products[0]) || ""}">
        ${i.isSuper ? `<div class="pt-super-band">${kedaiIcon("flame", 10)} Super</div>` : ""}
        <div class="pt-img"><span>${i.emoji}</span>${i.savedPct > 0 ? `<div class="pt-pct">-${i.savedPct}%</div>` : ""}</div>
        <div class="pt-body">
          <div class="pt-store"><span class="pt-dot" style="background:${i.store.color}"></span><span translate="no">${i.store.name}</span></div>
          <div class="pt-title">${i.name}</div>
          ${i.baseP ? `<div class="pt-prices"><span class="pt-new">${fmtPrice(i.newP)}</span><span class="pt-old">${fmtPrice(i.baseP)}</span></div>` : (i.typeBadge ? `<div class="pt-prices"><span class="pt-badge">${i.typeBadge}</span></div>` : "")}
        </div>
      </div>`;
  }).join("");
}

function renderBigDealCats() {
  const el = $("#deal-cats");
  if (!el) return;
  const cats = getBigCats();
  const deals = getBigDeals();
  const counts = {};
  deals.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });

  el.innerHTML = `<button class="deal-cat-pill ${!state.activeDealCat ? "active" : ""}" data-cat="">✨ Tout (${deals.length})</button>` +
    Object.entries(cats).map(([id, c]) => {
      const n = counts[id] || 0;
      if (!n) return "";
      return `<button class="deal-cat-pill ${state.activeDealCat === id ? "active" : ""}" data-cat="${id}">${c.name} (${n})</button>`;
    }).filter(Boolean).join("");
}

function renderBigDeals() {
  const el = $("#big-deals");
  const count = $("#big-count");
  if (!el) return;
  let deals = getBigDeals();
  if (state.activeDealCat) deals = deals.filter(d => d.category === state.activeDealCat);
  if (count) count.textContent = `${deals.length} offres`;

  if (!deals.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1">🎁 Pas d'offre dans cette catégorie</div>`;
    return;
  }
  const bigStores = getBigStores();
  const bigCats = getBigCats();
  el.innerHTML = deals.map(d => {
    const store = bigStores[d.store] || { name: d.store, color: "#FF6B35", icon: "🏪" };
    const cat = bigCats[d.category] || { color: "#FF6B35" };
    const pct = d.discount_rate ? Math.round(d.discount_rate * 100) : 0;
    const valid = d.valid_until ? new Date(d.valid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
    return `
      <div class="deal-card" data-deal-id="${d.id}">
        <div class="dc-img" style="background:linear-gradient(135deg,${cat.color},${shade(cat.color,-25)})">
          <span class="dc-emoji">${d.emoji || "🎁"}</span>
          ${d.brand ? `<span class="dc-brand">${d.brand}</span>` : ""}
          ${pct ? `<span class="dc-pct">-${pct}%</span>` : ""}
        </div>
        <div class="dc-body">
          <div class="dc-store"><span class="dc-dot" style="background:${store.color}"></span><span translate="no">${store.name}</span></div>
          <div class="dc-name">${d.name}</div>
          <div class="dc-prices">
            <span class="dc-new">${fmtPrice(d.discounted_price)}</span>
            ${d.original_price > d.discounted_price ? `<span class="dc-old">${fmtPrice(d.original_price)}</span>` : ""}
          </div>
          ${valid ? `<div class="dc-until">Jusqu'au ${valid}</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ============================================================================
// 5. RENDU : VUE LISTE
// ============================================================================
function renderList() {
  renderCatsRow();
  renderCart();
  renderCartSummary();
  updateCartBadge();
}

function renderCatsRow() {
  const el = $("#cats-row");
  if (!el) return;
  const cats = [...new Set(getProducts().map(p => p.category))];
  el.innerHTML = cats.map(c =>
    `<button class="cat-chip ${state.activeCat === c ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
}

function renderCart() {
  const el = $("#cart");
  const title = $("#cart-title");
  const actions = $("#cart-actions");
  if (!el) return;
  const ids = Object.keys(state.cart);
  if (!ids.length) {
    el.innerHTML = `<div class="empty"><div class="empty-emoji">🛒</div>Ta liste est vide. Cherche un produit ou clique sur une catégorie pour ajouter.</div>`;
    if (title) title.textContent = "Mes articles";
    if (actions) actions.hidden = true;
    return;
  }
  if (title) title.textContent = `Mes articles (${ids.length})`;
  if (actions) actions.hidden = false;

  el.innerHTML = ids.map(id => {
    const p = findProduct(id);
    if (!p) return "";
    const item = state.cart[id];
    const best = cheapestStoreFor(p);
    const store = getStores()[best.store] || {};
    const lineTotal = best.price * item.qty;
    const safeName = String(p.name || "");
    return `
      <div class="cart-row ${item.done ? "done" : ""}">
        <button class="check ${item.done ? "checked" : ""}" data-action="toggle" data-id="${id}" aria-pressed="${item.done ? "true" : "false"}" aria-label="${item.done ? "Décocher" : "Marquer comme acheté"} ${safeName}">${item.done ? kedaiIcon("check", 14) : ""}</button>
        <div class="ci-icon" aria-hidden="true">${p.icon || "📦"}</div>
        <div class="ci-info">
          <div class="ci-name">${p.name}</div>
          <div class="ci-meta">
            <span class="ci-store" style="background:${store.color || '#FF1A6B'}" translate="no"><span aria-hidden="true">${store.icon || "🏪"}</span> ${store.name || "—"}</span>
            <span class="ci-price">${fmtPrice(best.price)}</span>
          </div>
        </div>
        <div class="ci-qty">
          <button class="q-btn" data-action="dec" data-id="${id}" aria-label="Diminuer la quantité de ${safeName}">${kedaiIcon("minus", 14)}</button>
          <span class="q-val" aria-live="polite" aria-label="Quantité : ${item.qty}">${item.qty}</span>
          <button class="q-btn" data-action="inc" data-id="${id}" aria-label="Augmenter la quantité de ${safeName}">${kedaiIcon("plus", 14)}</button>
        </div>
        <div class="ci-total">${fmtPrice(lineTotal)}</div>
        <button class="ci-rm" data-action="remove" data-id="${id}" aria-label="Retirer ${safeName} de la liste">${kedaiIcon("x", 16)}</button>
      </div>`;
  }).join("");
}

function renderCartSummary() {
  const el = $("#cart-summary");
  if (!el) return;
  const ids = Object.keys(state.cart);
  if (!ids.length) { el.hidden = true; return; }
  const stores = getStores();
  const totals = {};
  Object.keys(stores).forEach(s => totals[s] = 0);
  let avail = {};
  Object.keys(stores).forEach(s => avail[s] = true);
  ids.forEach(id => {
    const p = findProduct(id);
    if (!p) return;
    const qty = state.cart[id].qty;
    Object.entries(p.prices).forEach(([s, pr]) => {
      if (pr != null) totals[s] += pr * qty;
      else avail[s] = false;
    });
  });
  const sorted = Object.entries(totals).map(([s, t]) => ({ s, t, avail: avail[s] })).filter(x => x.avail && x.t > 0).sort((a, b) => a.t - b.t);
  if (!sorted.length) { el.hidden = true; return; }
  const best = sorted[0];
  const next = sorted[1];
  const saving = next ? next.t - best.t : 0;
  const store = stores[best.s];
  el.hidden = false;
  el.innerHTML = `
    <div class="cs-title">Le moins cher pour ta liste</div>
    <div class="cs-store"><span class="cs-dot" style="background:${store.color}"></span><b translate="no">${store.name}</b></div>
    <div class="cs-total">${fmtPrice(best.t)}</div>
    ${saving > 0 ? `<div class="cs-save">${kedaiIcon("trending-down", 14)} Économie ${fmtPrice(saving)} vs ${stores[next.s].name}</div>` : ""}
  `;
}

function updateCartBadge() {
  const b = $("#cart-badge");
  if (!b) return;
  const n = Object.values(state.cart).filter(i => i && i.qty > 0 && !i.done).length;
  if (n > 0) { b.hidden = false; b.textContent = n > 99 ? "99+" : n; }
  else b.hidden = true;
}

function addToCart(pid, qty = 1) {
  if (!state.cart[pid]) state.cart[pid] = { qty: 0, done: false };
  state.cart[pid].qty += qty;
  saveState();
  if (state.view === "list") { renderCart(); renderCartSummary(); }
  updateCartBadge();
  toast("✓ Ajouté à la liste");
}

function setCartQty(pid, qty) {
  if (qty <= 0) { delete state.cart[pid]; }
  else { if (!state.cart[pid]) state.cart[pid] = { qty: 0, done: false }; state.cart[pid].qty = qty; }
  saveState();
  renderCart(); renderCartSummary(); updateCartBadge();
}

function toggleCart(pid) {
  if (!state.cart[pid]) return;
  state.cart[pid].done = !state.cart[pid].done;
  saveState();
  renderCart(); updateCartBadge();
}

function clearCart() {
  openConfirm({
    title: "Vider toute la liste ?",
    text: "Tous les articles seront supprimés. Cette action est irréversible.",
    danger: true,
    confirmLabel: "Oui, vider",
    cancelLabel: "Annuler",
    onConfirm() {
      state.cart = {};
      saveState();
      renderCart(); renderCartSummary(); updateCartBadge();
      toast("🗑️ Liste vidée");
    }
  });
}

// ============================================================================
// 6. RENDU : VUE FAVORIS
// ============================================================================
function renderFavs() {
  const el = $("#favs-list");
  if (!el) return;
  if (!state.favorites.length) {
    el.innerHTML = `<div class="empty"><div class="empty-emoji">💔</div>Aucun favori pour l'instant.<br>Clique sur ❤️ sur un produit pour le suivre.</div>`;
    return;
  }
  el.innerHTML = state.favorites.map(pid => {
    const p = findProduct(pid);
    if (!p) return "";
    const best = cheapestStoreFor(p);
    const store = getStores()[best.store] || {};
    const promo = getPromos().find(pr => pr.products && pr.products.includes(pid));
    const safeName = String(p.name || "");
    return `
      <div class="fav-row" data-pid="${pid}">
        <div class="fav-icon" aria-hidden="true">${p.icon || "📦"}</div>
        <div class="fav-info">
          <div class="fav-name">${p.name}</div>
          <div class="fav-meta">Le - cher chez <b translate="no">${store.name}</b> à ${fmtPrice(best.price)}</div>
          ${promo ? `<div class="fav-promo">${kedaiIcon("flame", 11)} Promo active</div>` : ""}
        </div>
        <button class="fav-heart" data-action="unfav" data-id="${pid}" aria-label="Retirer ${safeName} des favoris">${kedaiIcon("heart", 22, { fill: "currentColor" })}</button>
      </div>`;
  }).join("");
}

function toggleFav(pid) {
  const i = state.favorites.indexOf(pid);
  if (i >= 0) { state.favorites.splice(i, 1); toast("💔 Retiré des favoris"); }
  else { state.favorites.push(pid); toast("❤️ Ajouté ! Tu seras prévenu des promos."); }
  saveState();
  if (state.view === "favs") renderFavs();
}

// ============================================================================
// 7. RENDU : VUE PLUS
// ============================================================================
function renderMore() {
  const el = $("#user-summary");
  if (!el) return;
  el.innerHTML = `
    <div class="us-avatar">${FAKE_USER.avatar}</div>
    <div class="us-info">
      <div class="us-name">${FAKE_USER.name}</div>
      <div class="us-loc">${kedaiIcon("map-pin", 12)} ${FAKE_USER.location}</div>
      <div class="us-level">${kedaiIcon("star", 12)} Niveau ${FAKE_USER.level} · ${FAKE_USER.next_in} deals avant niveau ${FAKE_USER.level + 1}</div>
      <div class="us-progress"><div class="us-progress-fill" style="width:${100 - FAKE_USER.next_in * 10}%"></div></div>
    </div>
    <div class="us-stats">
      <div class="us-stat"><b>${FAKE_USER.savings_month}₪</b><small>ce mois</small></div>
      <div class="us-stat"><b>🔥 ${FAKE_USER.streak}j</b><small>streak</small></div>
    </div>
  `;
  $("#set-dark").checked = state.theme === "dark";
}

// ============================================================================
// 8. PANELS / MODALS  (v33: role=dialog, focus-trap, scroll-lock, restore-focus)
// ============================================================================
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

const _panelStack = [];

function openPanel(html, type = "side") {
  closePanels();
  const root = $("#panels-root");
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.className = "panel-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) closePanels(); });

  const panel = document.createElement("div");
  panel.className = `panel panel-${type}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.tabIndex = -1;
  panel.innerHTML = html;

  // Auto-wire aria-labelledby to the first heading inside the panel.
  const heading = panel.querySelector("h2, h3, h4, .chat-name, .pd-name, .confirm-title");
  if (heading) {
    if (!heading.id) heading.id = "panel-h-" + Math.random().toString(36).slice(2, 8);
    panel.setAttribute("aria-labelledby", heading.id);
  }

  // Focus trap on Tab / Shift+Tab.
  const trapHandler = (e) => {
    if (e.key !== "Tab") return;
    const list = panel.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!list.length) { e.preventDefault(); panel.focus(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", trapHandler);

  overlay.appendChild(panel);
  root.appendChild(overlay);

  _panelStack.push({ overlay, previousFocus, previousOverflow, trapHandler });

  // Animate in + move focus inside the panel on the next frame.
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    const first = panel.querySelector(FOCUSABLE_SELECTOR);
    (first || panel).focus({ preventScroll: true });
  });
  return panel;
}

function closePanels() {
  while (_panelStack.length) {
    const { overlay, previousFocus, previousOverflow, trapHandler } = _panelStack.pop();
    document.removeEventListener("keydown", trapHandler);
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 280);
    document.body.style.overflow = previousOverflow || "";
    if (previousFocus && typeof previousFocus.focus === "function") {
      try { previousFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  // Fallback: clean any orphan overlays not in the stack.
  const root = $("#panels-root");
  if (root) [...root.children].forEach(c => {
    c.classList.remove("show");
    setTimeout(() => c.remove(), 280);
  });
}
window.kedai.closePanels = closePanels;

// Custom confirm dialog (replaces native confirm()).
function openConfirm({ title, text, danger = false, confirmLabel = "Confirmer", cancelLabel = "Annuler", onConfirm }) {
  const html = `
    <div class="confirm-card ${danger ? "danger" : ""}">
      <div class="confirm-icon" aria-hidden="true">${kedaiIcon(danger ? "trash" : "bell", 28)}</div>
      <h3 class="confirm-title">${title}</h3>
      <p class="confirm-text">${text || ""}</p>
      <div class="confirm-actions">
        <button class="btn ghost" data-confirm-cancel>${cancelLabel}</button>
        <button class="btn ${danger ? "danger" : "primary"}" data-confirm-ok>${confirmLabel}</button>
      </div>
    </div>
  `;
  const p = openPanel(html, "modal");
  p.querySelector("[data-confirm-cancel]").addEventListener("click", () => closePanels());
  p.querySelector("[data-confirm-ok]").addEventListener("click", () => {
    closePanels();
    if (typeof onConfirm === "function") onConfirm();
  });
}
window.kedai.openConfirm = openConfirm;

// Notifications
function openNotifs() {
  const html = `
    <div class="p-head">
      <h3>${kedaiIcon("bell", 20)} Notifications</h3>
      <button class="p-close" data-close aria-label="Fermer le panneau notifications">${kedaiIcon("x", 18)}</button>
    </div>
    <div class="p-actions"><button class="link" id="mark-all">Tout marquer comme lu</button></div>
    <div class="p-body">
      ${NOTIFS.map(n => {
        const unread = n.unread && !state.notifs_read.includes(n.id);
        return `
          <div class="notif ${unread ? "unread" : ""}" data-notif="${n.id}" tabindex="0" role="button" aria-label="${unread ? "Non lue : " : ""}${n.title}, ${n.text}, il y a ${n.time}">
            <div class="n-icon" aria-hidden="true">${n.icon}</div>
            <div class="n-info">
              <div class="n-title">${n.title}</div>
              <div class="n-text">${n.text}</div>
              <time class="n-time">${n.time}</time>
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
  const p = openPanel(html, "side");
  p.querySelector("#mark-all").addEventListener("click", () => {
    NOTIFS.forEach(n => { if (!state.notifs_read.includes(n.id)) state.notifs_read.push(n.id); });
    saveState(); updateNotifDot(); closePanels();
  });
  p.querySelectorAll("[data-notif]").forEach(r => {
    const markRead = () => {
      const id = +r.dataset.notif;
      if (!state.notifs_read.includes(id)) state.notifs_read.push(id);
      saveState(); updateNotifDot(); r.classList.remove("unread");
    };
    r.addEventListener("click", markRead);
    r.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markRead(); }
    });
  });
}

function updateNotifDot() {
  const d = $("#notif-dot");
  const unread = NOTIFS.filter(n => n.unread && !state.notifs_read.includes(n.id)).length;
  if (unread > 0) { d.hidden = false; d.textContent = unread; }
  else d.hidden = true;
}

// Profile
function openProfile() {
  const earned = ACHIEVEMENTS.filter(a => a.earned).length;
  const html = `
    <div class="p-head">
      <h3>${kedaiIcon("user", 20)} Profil</h3>
      <button class="p-close" data-close aria-label="Fermer le panneau profil">${kedaiIcon("x", 18)}</button>
    </div>
    <div class="p-body">
      <div class="prof-hero">
        <div class="prof-avatar" aria-hidden="true">${FAKE_USER.avatar}</div>
        <div class="prof-info">
          <div class="prof-name">${FAKE_USER.name}</div>
          <div class="prof-loc">${kedaiIcon("map-pin", 12)} ${FAKE_USER.location}</div>
          <div class="prof-level">${kedaiIcon("star", 12)} Niveau ${FAKE_USER.level}</div>
        </div>
      </div>
      <div class="prof-stats">
        <div class="ps"><b>${FAKE_USER.savings_month}₪</b><small>ce mois</small></div>
        <div class="ps"><b>${FAKE_USER.savings_total}₪</b><small>total</small></div>
        <div class="ps"><b>${FAKE_USER.deals_used}</b><small>deals</small></div>
        <div class="ps"><b>${FAKE_USER.streak} j</b><small>streak</small></div>
      </div>
      <button class="premium-row" data-open-premium>
        <span class="pr-crown" aria-hidden="true">${kedaiIcon("crown", 22, { fill: "currentColor" })}</span><b>Passe Premium</b><small>10₪/mois</small>
      </button>
      <h4 class="p-section">${kedaiIcon("trophy", 14)} Achievements (${earned}/${ACHIEVEMENTS.length})</h4>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map(a => `
          <div class="ach ${a.earned ? "earned" : "locked"}">
            <div class="ach-icon" aria-hidden="true">${a.icon}</div>
            <div class="ach-title">${a.title}</div>
            <div class="ach-desc">${a.desc}</div>
            <div class="ach-meta">${a.earned ? kedaiIcon("check", 10) + " " + a.date : a.progress || ""}</div>
          </div>`).join("")}
      </div>
      <div class="p-foot">Membre depuis Mars 2026</div>
    </div>
  `;
  openPanel(html, "side");
}

// Premium
function openPremium() {
  const html = `
    <div class="prem-card">
      <button class="p-close prem-close" data-close aria-label="Fermer la fenêtre Premium">${kedaiIcon("x", 18)}</button>
      <div class="prem-hero">
        <div class="prem-crown" aria-hidden="true">${kedaiIcon("crown", 64, { fill: "currentColor", stroke: "rgba(255,255,255,0.3)", strokeWidth: 1.2 })}</div>
        <h2><span lang="he">כדאי</span> <span>Premium</span></h2>
        <p>Économise encore plus, sans limite.</p>
      </div>
      <ul class="prem-features">
        <li>${kedaiIcon("check", 16)} Alertes illimitées sur tes favoris</li>
        <li>${kedaiIcon("check", 16)} Comparateur de prix temps réel</li>
        <li>${kedaiIcon("check", 16)} Pas de publicités</li>
        <li>${kedaiIcon("check", 16)} Analyse de tes habitudes</li>
        <li>${kedaiIcon("check", 16)} Mode famille (5 comptes)</li>
        <li>${kedaiIcon("check", 16)} Cashback bonus +1%</li>
        <li>${kedaiIcon("check", 16)} Support prioritaire</li>
      </ul>
      <div class="prem-plans">
        <button class="prem-plan" data-plan="monthly" aria-label="Plan mensuel 10₪ par mois sans engagement">
          <div class="pp-name">Mensuel</div>
          <div class="pp-price">10₪<span>/mois</span></div>
          <div class="pp-sub">Sans engagement</div>
        </button>
        <button class="prem-plan reco" data-plan="yearly" aria-label="Plan annuel 89₪ par an, économie de 31₪">
          <span class="pp-badge">−25%</span>
          <div class="pp-name">Annuel</div>
          <div class="pp-price">89₪<span>/an</span></div>
          <div class="pp-sub">Éco 31₪</div>
        </button>
      </div>
      <div class="prem-foot">7 jours d'essai gratuit · annulable</div>
    </div>
  `;
  const p = openPanel(html, "modal");
  p.querySelectorAll(".prem-plan").forEach(b => b.addEventListener("click", () => {
    toast("🎉 Essai 7 jours démarré (démo)"); closePanels();
  }));
}

// Chat IA
function openChat() {
  const html = `
    <div class="chat-head">
      <div class="chat-meta">
        <div class="chat-avatar" aria-hidden="true">${kedaiIcon("chat-bot", 22)}</div>
        <div><div class="chat-name">Assistant כדאי</div><div class="chat-status"><span class="chat-dot" aria-hidden="true"></span> En ligne</div></div>
      </div>
      <button class="p-close" data-close aria-label="Fermer la conversation">${kedaiIcon("x", 18)}</button>
    </div>
    <div class="chat-body" id="chat-body" role="log" aria-live="polite" aria-atomic="false"></div>
    <div class="chat-sugg" id="chat-sugg" aria-label="Suggestions de questions"></div>
    <div class="chat-input">
      <label for="chat-text" class="sr-only">Écrire un message à l'assistant</label>
      <input id="chat-text" type="text" placeholder="Pose-moi une question..." autocomplete="off" />
      <button class="btn primary" id="chat-send" aria-label="Envoyer le message">${kedaiIcon("send", 18)}</button>
    </div>
  `;
  const p = openPanel(html, "chat");
  renderChatMessages(p);
  const input = p.querySelector("#chat-text");
  p.querySelector("#chat-send").addEventListener("click", () => sendChatMsg(input.value, p));
  input.addEventListener("keydown", e => { if (e.key === "Enter") sendChatMsg(input.value, p); });
}

function renderChatMessages(p) {
  const body = p.querySelector("#chat-body");
  const sugg = p.querySelector("#chat-sugg");
  if (!body) return;
  body.innerHTML = state.chatMsgs.map(m => `<div class="msg ${m.from}">${m.text.replace(/\n/g, "<br>")}</div>`).join("");
  if (sugg) {
    sugg.innerHTML = CHAT_STARTERS.map(s => `<button class="sugg-btn">${s}</button>`).join("");
    sugg.querySelectorAll(".sugg-btn").forEach(b => b.addEventListener("click", () => sendChatMsg(b.textContent, p)));
  }
  body.scrollTop = body.scrollHeight;
}

function sendChatMsg(text, p) {
  text = (text || "").trim();
  if (!text) return;
  const input = p.querySelector("#chat-text");
  if (input) input.value = "";
  state.chatMsgs.push({ from: "me", text });
  saveState();
  renderChatMessages(p);
  // typing indicator
  const body = p.querySelector("#chat-body");
  body.insertAdjacentHTML("beforeend", '<div class="msg ai typing"><span></span><span></span><span></span></div>');
  body.scrollTop = body.scrollHeight;
  // fake AI reply
  setTimeout(() => {
    const lo = text.toLowerCase();
    let reply = CHAT_REPLIES.default;
    if (lo.includes("promo") || lo.includes("pâte")) reply = CHAT_REPLIES.promo;
    else if (lo.includes("recette") || lo.includes("soir")) reply = CHAT_REPLIES.recette;
    else if (lo.includes("magasin") || lo.includes("cher")) reply = CHAT_REPLIES.magasin;
    else if (lo.includes("shabbat") || lo.includes("samedi")) reply = CHAT_REPLIES.shabbat;
    state.chatMsgs.push({ from: "ai", text: reply });
    saveState();
    renderChatMessages(p);
  }, 900);
}

// Onboarding
function showOnboarding() {
  if (state.onboarded) return;
  const stores = getStores();
  const html = `
    <div class="onb-card">
      <div class="onb-screens" role="region" aria-label="Onboarding">
        <div class="onb-screen active" data-step="0">
          <div class="onb-emoji" aria-hidden="true">🎁</div>
          <h2>Bienvenue sur <span lang="he">כדאי</span></h2>
          <p>Économise jusqu'à <strong>250₪/mois</strong> grâce aux meilleures promos vérifiées chaque jour en Israël.</p>
        </div>
        <div class="onb-screen" data-step="1">
          <div class="onb-emoji" aria-hidden="true">🏪</div>
          <h2>Tes magasins préférés</h2>
          <p>Sélectionne 2-3 enseignes que tu fréquentes — on personnalise ton feed.</p>
          <div class="onb-stores" role="group" aria-label="Choix des magasins">
            ${Object.entries(stores).map(([id, s]) => `<button class="onb-store" data-store-id="${id}" aria-pressed="false"><span class="oss" style="background:${s.color}" aria-hidden="true">${s.icon || "🏪"}</span><span>${s.name}</span></button>`).join("")}
          </div>
        </div>
        <div class="onb-screen" data-step="2">
          <div class="onb-emoji" aria-hidden="true">🔔</div>
          <h2>Reçois les alertes</h2>
          <p>Active les notifs pour être prévenu quand TES produits sont en promo.</p>
        </div>
      </div>
      <div class="onb-dots" role="tablist" aria-label="Progression onboarding">
        <span class="onb-dot active" role="tab" aria-selected="true" aria-label="Étape 1 sur 3"></span>
        <span class="onb-dot" role="tab" aria-selected="false" aria-label="Étape 2 sur 3"></span>
        <span class="onb-dot" role="tab" aria-selected="false" aria-label="Étape 3 sur 3"></span>
      </div>
      <div class="onb-nav">
        <button class="btn ghost" id="onb-prev" hidden>${kedaiIcon("arrow-left", 14)} Préc.</button>
        <button class="btn primary" id="onb-next">Suivant ${kedaiIcon("arrow-right", 14)}</button>
      </div>
    </div>
  `;
  const p = openPanel(html, "onboarding");
  let step = 0;
  const screens = p.querySelectorAll(".onb-screen");
  const dots = p.querySelectorAll(".onb-dot");
  const next = p.querySelector("#onb-next");
  const prev = p.querySelector("#onb-prev");
  function go(to) {
    step = Math.max(0, Math.min(2, to));
    screens.forEach((s, i) => s.classList.toggle("active", i === step));
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === step);
      d.setAttribute("aria-selected", i === step ? "true" : "false");
    });
    prev.hidden = step === 0;
    next.innerHTML = step === 2 ? "Commencer" : `Suivant ${kedaiIcon("arrow-right", 14)}`;
  }
  next.addEventListener("click", () => {
    if (step === 2) {
      state.onboarded = true;
      saveState();
      closePanels();
      toast("🎉 Bienvenue !");
    } else go(step + 1);
  });
  prev.addEventListener("click", () => go(step - 1));
  p.querySelectorAll(".onb-store").forEach(b => b.addEventListener("click", () => {
    const pressed = b.classList.toggle("selected");
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
  }));
}

// Product detail
function openProductDetail(pid) {
  const p = findProduct(pid);
  if (!p) return;
  const sortedPrices = Object.entries(p.prices).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
  const inFavs = state.favorites.includes(pid);
  const promo = getPromos().find(pr => pr.products && pr.products.includes(pid));
  const safeName = String(p.name || "");
  const html = `
    <div class="pd-card">
      <button class="p-close pd-close" data-close aria-label="Fermer la fiche produit">${kedaiIcon("x", 18)}</button>
      <div class="pd-head">
        <div class="pd-emoji" aria-hidden="true">${p.icon || "📦"}</div>
        <div class="pd-info">
          <div class="pd-name">${p.name}</div>
          <div class="pd-cat">${p.category}${p.unit ? " · " + p.unit : ""}</div>
          ${promo ? `<div class="pd-promo">${kedaiIcon("flame", 11)} En promo : ${promo.title}</div>` : ""}
        </div>
        <button
          class="pd-heart ${inFavs ? "on" : ""}"
          data-action="fav-detail"
          data-id="${pid}"
          aria-pressed="${inFavs ? "true" : "false"}"
          aria-label="${inFavs ? "Retirer" : "Ajouter"} ${safeName} ${inFavs ? "des" : "aux"} favoris"
        >${kedaiIcon("heart", 18, inFavs ? { fill: "currentColor" } : {})}</button>
      </div>
      <h4 class="pd-section">Prix par magasin</h4>
      <div class="pd-prices">
        ${sortedPrices.map(([s, price], i) => {
          const store = getStores()[s] || {};
          return `<div class="pd-row ${i === 0 ? "best" : ""}">
            <span class="pd-store"><span class="pd-dot" style="background:${store.color}" aria-hidden="true"></span><span translate="no">${store.name}</span></span>
            <span class="pd-price">${fmtPrice(price)}</span>
            ${i === 0 ? `<span class="pd-tag">${kedaiIcon("badge-check", 11)} Le moins cher</span>` : ""}
          </div>`;
        }).join("")}
      </div>
      <div class="pd-actions">
        <button class="btn primary pd-add" data-action="add-cart" data-id="${pid}">${kedaiIcon("plus", 16)} Ajouter à ma liste</button>
      </div>
    </div>
  `;
  openPanel(html, "modal");
}
window.kedai.openProductDetail = openProductDetail;

// ============================================================================
// 9. SEARCH
// ============================================================================
let searchTimer;
function setupSearch() {
  const inp = $("#search-input");
  const results = $("#search-results");
  const browse = $("#browse-grid");
  if (!inp) return;
  inp.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = inp.value.trim().toLowerCase();
    searchTimer = setTimeout(() => {
      if (!q) { results.hidden = true; browse.hidden = true; return; }
      const matches = getProducts().filter(p =>
        p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
      ).slice(0, 20);
      if (!matches.length) {
        results.hidden = false;
        results.innerHTML = `<div class="empty">Aucun produit trouvé pour "${q}"</div>`;
        return;
      }
      results.hidden = false;
      results.innerHTML = matches.map(p => {
        const best = cheapestStoreFor(p);
        return `<button class="sr-row" data-pid="${p.id}">
          <span class="sr-icon">${p.icon || "📦"}</span>
          <span class="sr-info"><b>${p.name}</b><small>${p.category} · dès ${fmtPrice(best.price)}</small></span>
          <span class="sr-add" aria-hidden="true">${kedaiIcon("plus", 16)}</span>
        </button>`;
      }).join("");
    }, 120);
  });
}

// Global search (top bar) — toggle
function setupGlobalSearch() {
  const gs = $("#global-search");
  const inp = $("#gs-input");
  const res = $("#gs-results");
  const trigger = $("#btn-search-toggle");

  const setOpen = (open) => {
    if (open) {
      gs.hidden = false;
      requestAnimationFrame(() => gs.classList.add("open"));
      trigger.setAttribute("aria-expanded", "true");
      setTimeout(() => inp.focus(), 50);
    } else {
      gs.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      setTimeout(() => {
        gs.hidden = true;
        inp.value = "";
        res.innerHTML = "";
        trigger.focus();
      }, 200);
    }
  };

  trigger.addEventListener("click", () => setOpen(true));
  $("#gs-close").addEventListener("click", () => setOpen(false));
  inp.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  inp.addEventListener("input", () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { res.innerHTML = ""; return; }
    const prods = getProducts().filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
    const promos = getPromos().filter(p => (p.title || "").toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q)).slice(0, 5);
    res.innerHTML = `
      ${promos.length ? `<div class="gs-section" role="presentation"><span aria-hidden="true">🔥</span> Promos</div>${promos.map(pm => `<button class="gs-row" role="option" data-promo-pid="${(pm.products && pm.products[0]) || ""}"><span aria-hidden="true">🎁</span><span><b>${pm.title}</b><small>${getStores()[pm.chain]?.name || ""}</small></span></button>`).join("")}` : ""}
      ${prods.length ? `<div class="gs-section" role="presentation"><span aria-hidden="true">📦</span> Produits</div>${prods.map(p => `<button class="gs-row" role="option" data-pid="${p.id}"><span aria-hidden="true">${p.icon || "📦"}</span><span><b>${p.name}</b><small>${p.category}</small></span></button>`).join("")}` : ""}
      ${(!prods.length && !promos.length) ? `<div class="empty">Aucun résultat pour "${q}"</div>` : ""}
    `;
  });
}

// ============================================================================
// 10. SHARE
// ============================================================================
function shareList() {
  const ids = Object.keys(state.cart);
  if (!ids.length) { toast("Liste vide à partager"); return; }
  const lines = ids.map(id => {
    const p = findProduct(id); if (!p) return "";
    return `• ${p.name} (${state.cart[id].qty}×)`;
  }).join("\n");
  const url = location.href;
  const text = `Ma liste de courses כדאי :\n\n${lines}\n\n${url}`;
  if (navigator.share) { navigator.share({ title: "Ma liste כדאי", text }).catch(() => {}); }
  else if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast("📤 Copié ! Colle dans WhatsApp")); }
  else toast("Partage non supporté");
}

// ============================================================================
// 11. THEME
// ============================================================================
function applyTheme() {
  document.body.setAttribute("data-theme", state.theme);
}

// ============================================================================
// 12. UTILITAIRES UI
// ============================================================================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
window.kedai.toast = toast;

function shade(hex, p) {
  if (!hex || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16);
  const a = Math.round(2.55 * p);
  const R = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + a));
  const G = Math.min(255, Math.max(0, ((n >> 8)  & 0xff) + a));
  const B = Math.min(255, Math.max(0, ( n        & 0xff) + a));
  return "#" + ((R << 16) | (G << 8) | B).toString(16).padStart(6, "0");
}

// ============================================================================
// 13. EVENT BINDINGS (global delegation)
// ============================================================================
function bindEvents() {
  // Bottom nav
  $$(".nav-tab").forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));

  // Header buttons
  $("#btn-notifs").addEventListener("click", openNotifs);
  $("#btn-profile").addEventListener("click", openProfile);

  // Floating chat
  $("#btn-chat").addEventListener("click", openChat);

  // Lang picker
  $$(".lang-btn").forEach(b => b.addEventListener("click", () => {
    $$(".lang-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.lang = b.dataset.lang;
    saveState();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = (state.lang === "he") ? "rtl" : "ltr";
  }));

  // Search bar liste view
  setupSearch();
  // Global search (top)
  setupGlobalSearch();

  // List view: list-tabs (cf cart actions)
  $("#btn-share").addEventListener("click", shareList);
  $("#btn-clear").addEventListener("click", clearCart);

  // Settings
  $("#set-dark").addEventListener("change", e => {
    state.theme = e.target.checked ? "dark" : "light";
    saveState();
    applyTheme();
  });
  $("#set-shopping").addEventListener("change", () => toast("Mode courses (démo)"));
  $("#set-notifs").addEventListener("change", () => toast("Préférence sauvegardée"));

  // Premium teaser
  $("#btn-premium").addEventListener("click", openPremium);

  // Tools — disabled tools are visually marked and inert.
  $$(".tool").forEach(t => t.addEventListener("click", () => {
    if (t.getAttribute("aria-disabled") === "true") return;
    const id = t.dataset.tool;
    if (id === "achievements") openProfile();
  }));

  // Legal rows — all currently disabled (aria-disabled), so we no-op.
  $$(".legal-row").forEach(r => r.addEventListener("click", () => {
    if (r.getAttribute("aria-disabled") === "true") return;
  }));

  // Hero CTA
  document.addEventListener("click", e => {
    // Close buttons in panels
    if (e.target.closest("[data-close]")) { closePanels(); return; }
    // Click on hero card
    const heroCard = e.target.closest(".hero-card");
    if (heroCard && heroCard.dataset.promoPid) openProductDetail(heroCard.dataset.promoPid);
    // Click on promo tile
    const tile = e.target.closest(".promo-tile");
    if (tile && tile.dataset.promoPid) openProductDetail(tile.dataset.promoPid);
    // Click on deal card → toast (no detail for big deals demo)
    const deal = e.target.closest(".deal-card");
    if (deal) { const d = getBigDeals().find(x => x.id === deal.dataset.dealId); if (d) toast(`🎁 ${d.brand || ""} ${d.name} · ${fmtPrice(d.discounted_price)}`); }
    // Click on store-tile / story
    const storeTile = e.target.closest(".store-tile, .story");
    if (storeTile) { const s = getStores()[storeTile.dataset.store]; if (s) toast(`📰 Catalogue ${s.name} (bientôt complet)`); }
    // Click on category chip
    const catChip = e.target.closest(".cat-chip");
    if (catChip) {
      state.activeCat = (state.activeCat === catChip.dataset.cat) ? null : catChip.dataset.cat;
      saveState();
      renderCatsRow();
      renderBrowseGrid();
      return;
    }
    // Click on deal-cat-pill
    const dcp = e.target.closest(".deal-cat-pill");
    if (dcp) {
      state.activeDealCat = dcp.dataset.cat || null;
      saveState();
      renderBigDealCats();
      renderBigDeals();
      return;
    }
    // Search result → add to cart
    const sr = e.target.closest(".sr-row");
    if (sr && sr.dataset.pid) { addToCart(sr.dataset.pid); $("#search-input").value = ""; $("#search-results").hidden = true; return; }
    // GS row → open product
    const gsr = e.target.closest(".gs-row");
    if (gsr) {
      if (gsr.dataset.pid) openProductDetail(gsr.dataset.pid);
      else if (gsr.dataset.promoPid) openProductDetail(gsr.dataset.promoPid);
      $("#gs-close").click();
      return;
    }
    // Cart actions
    const ca = e.target.closest("[data-action]");
    if (ca) {
      const id = ca.dataset.id;
      const act = ca.dataset.action;
      if (act === "toggle") toggleCart(id);
      else if (act === "inc") { const it = state.cart[id]; setCartQty(id, (it ? it.qty : 0) + 1); }
      else if (act === "dec") { const it = state.cart[id]; if (it) setCartQty(id, it.qty - 1); }
      else if (act === "remove") setCartQty(id, 0);
      else if (act === "unfav") toggleFav(id);
      else if (act === "fav-detail") { toggleFav(id); closePanels(); }
      else if (act === "add-cart") { addToCart(id); closePanels(); }
      return;
    }
    // Browse grid product
    const bgItem = e.target.closest(".browse-tile");
    if (bgItem && bgItem.dataset.pid) addToCart(bgItem.dataset.pid);
    // Open premium link in profile
    if (e.target.closest("[data-open-premium]")) { closePanels(); setTimeout(openPremium, 300); }
  });

  // Escape closes panels
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePanels(); });
}

function renderBrowseGrid() {
  const el = $("#browse-grid");
  if (!el) return;
  if (!state.activeCat) { el.hidden = true; return; }
  const prods = getProducts().filter(p => p.category === state.activeCat).slice(0, 30);
  el.hidden = false;
  el.innerHTML = prods.map(p => {
    const best = cheapestStoreFor(p);
    return `<button class="browse-tile" data-pid="${p.id}">
      <div class="bt-icon">${p.icon || "📦"}</div>
      <div class="bt-name">${p.name}</div>
      <div class="bt-price">${fmtPrice(best.price)}</div>
      <div class="bt-add" aria-hidden="true">${kedaiIcon("plus", 14)}</div>
    </button>`;
  }).join("");
}

// ============================================================================
// 14. INIT
// ============================================================================
function init() {
  // Sync theme with system preference on first launch (when user never chose).
  try {
    const hasUserChoice = localStorage.getItem(LS_KEY) && (state.theme === "dark" || state.theme === "light");
    if (!hasUserChoice && typeof window.matchMedia === "function") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      state.theme = prefersDark ? "dark" : "light";
    }
  } catch (e) {}

  applyTheme();
  bindEvents();
  showView(state.view || "promos");
  updateNotifDot();
  updateCartBadge();

  // Show onboarding immediately on first visit (no flash).
  if (!state.onboarded) showOnboarding();

  // Sync language picker UI (the picker is hidden in v33 but we keep state in sync).
  document.documentElement.lang = state.lang;
  document.documentElement.dir = (state.lang === "he") ? "rtl" : "ltr";
  $$(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === state.lang));

  // Register service worker after first paint.
  if ("serviceWorker" in navigator) {
    setTimeout(() => navigator.serviceWorker.register("sw.js").catch(() => {}), 1000);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
