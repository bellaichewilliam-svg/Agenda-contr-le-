// PrixMalin - logique principale
// Dépend de data/products.js (STORES, PRODUCTS, DATA_VERSION, LAST_UPDATED)

const STORAGE_KEY = "prixmalin.cart.v1";

// État global
const state = {
  cart: loadCart(),       // { [productId]: quantity }
  mode: "single",         // "single" | "optimized"
  activeCategory: null,
  searchQuery: ""
};

// ---------- Persistence ----------
function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
  } catch {}
}

// ---------- Helpers ----------
function findProduct(id) {
  return PRODUCTS.find(p => p.id === id);
}
function formatPrice(n) {
  return `₪ ${n.toFixed(2)}`;
}
function normalize(s) {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip diacritiques
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// ---------- Banner ----------
function renderUpdateBanner() {
  document.getElementById("last-updated").textContent = formatDate(LAST_UPDATED);
  document.getElementById("product-count").textContent = PRODUCTS.length;
}

function renderStoreBadges() {
  const wrap = document.getElementById("store-badges");
  wrap.innerHTML = Object.values(STORES).map(s =>
    `<span class="store-badge"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`
  ).join("");
}

// ---------- Search ----------
function filterProducts(query, category) {
  const q = normalize(query.trim());
  return PRODUCTS.filter(p => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    return normalize(p.name).includes(q) || normalize(p.category).includes(q);
  });
}

function renderSearchResults() {
  const wrap = document.getElementById("search-results");
  const query = state.searchQuery;

  if (!query && !state.activeCategory) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  const results = filterProducts(query, state.activeCategory).slice(0, 30);

  if (results.length === 0) {
    wrap.hidden = false;
    wrap.innerHTML = `<div class="search-result-item"><span class="meta">Aucun produit trouvé</span></div>`;
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = results.map(p => {
    const cheapest = cheapestStoreFor(p);
    const inCart = state.cart[p.id];
    const cartTag = inCart ? `<span style="color:var(--success);font-weight:600">✓ ${inCart}×</span>` : "";
    return `
      <div class="search-result-item" data-id="${p.id}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px">${p.name} ${cartTag}</div>
          <div class="meta">${p.category} · ${p.unit} · dès <strong style="color:${STORES[cheapest.store].color}">${formatPrice(cheapest.price)}</strong> chez ${STORES[cheapest.store].name}</div>
        </div>
        <div class="add-icon">+</div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll(".search-result-item[data-id]").forEach(el => {
    el.addEventListener("click", () => {
      addToCart(el.dataset.id);
      document.getElementById("search-input").value = "";
      state.searchQuery = "";
      renderSearchResults();
    });
  });
}

function cheapestStoreFor(product) {
  let best = { store: null, price: Infinity };
  Object.entries(product.prices).forEach(([store, price]) => {
    if (price != null && price < best.price) {
      best = { store, price };
    }
  });
  return best;
}

// ---------- Categories ----------
function renderQuickCategories() {
  const wrap = document.getElementById("quick-categories");
  const cats = [...new Set(PRODUCTS.map(p => p.category))];
  wrap.innerHTML = cats.map(c =>
    `<button class="cat-pill ${state.activeCategory === c ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
  wrap.querySelectorAll(".cat-pill").forEach(el => {
    el.addEventListener("click", () => {
      state.activeCategory = state.activeCategory === el.dataset.cat ? null : el.dataset.cat;
      renderQuickCategories();
      renderSearchResults();
    });
  });
}

// ---------- Cart ----------
function addToCart(id, qty = 1) {
  state.cart[id] = (state.cart[id] || 0) + qty;
  saveCart();
  renderAll();
}
function setQty(id, qty) {
  if (qty <= 0) {
    delete state.cart[id];
  } else {
    state.cart[id] = qty;
  }
  saveCart();
  renderAll();
}
function removeFromCart(id) {
  delete state.cart[id];
  saveCart();
  renderAll();
}
function clearCart() {
  state.cart = {};
  saveCart();
  renderAll();
}

function renderAll() {
  renderCart();
  renderComparison();
  renderMobileCTA();
}

function renderCart() {
  const wrap = document.getElementById("cart");
  const ids = Object.keys(state.cart);
  const actions = document.getElementById("cart-actions");
  const countEl = document.getElementById("cart-count");

  if (ids.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🛒</span>
        Votre liste est vide.<br />
        Cherchez un produit ou cliquez sur une catégorie pour commencer.
      </div>`;
    actions.hidden = true;
    return;
  }

  actions.hidden = false;
  const totalItems = Object.values(state.cart).reduce((a, b) => a + b, 0);
  countEl.textContent = `${ids.length} produit${ids.length > 1 ? "s" : ""} · ${totalItems} article${totalItems > 1 ? "s" : ""}`;

  wrap.innerHTML = ids.map(id => {
    const p = findProduct(id);
    if (!p) return "";
    const qty = state.cart[id];
    const cheapest = cheapestStoreFor(p);
    const cheapestStore = STORES[cheapest.store];
    return `
      <div class="cart-item">
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-id="${id}" aria-label="Diminuer">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${id}" aria-label="Augmenter">+</button>
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-meta">
            <span>${p.unit}</span>
            <span class="dot">·</span>
            <span class="cart-item-best" style="color:${cheapestStore.color}">
              dès ${formatPrice(cheapest.price)} (${cheapestStore.name})
            </span>
          </div>
        </div>
        <button class="remove-btn" data-action="rm" data-id="${id}" title="Supprimer" aria-label="Supprimer">×</button>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const action = el.dataset.action;
      if (action === "inc") setQty(id, state.cart[id] + 1);
      else if (action === "dec") setQty(id, state.cart[id] - 1);
      else if (action === "rm") removeFromCart(id);
    });
  });
}

// ---------- Comparison ----------
function computeStoreTotals() {
  const totals = {};
  Object.keys(STORES).forEach(s => {
    totals[s] = { store: s, total: 0, available: 0, missing: [], items: [] };
  });

  Object.entries(state.cart).forEach(([id, qty]) => {
    const p = findProduct(id);
    if (!p) return;
    Object.keys(STORES).forEach(s => {
      const price = p.prices[s];
      if (price == null) {
        totals[s].missing.push(p);
      } else {
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
  const cartIds = Object.keys(state.cart);

  if (cartIds.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📊</span>
        Ajoutez des produits à votre liste<br />pour voir la comparaison entre les enseignes.
      </div>`;
    optiWrap.hidden = true;
    optiWrap.innerHTML = "";
    return;
  }

  if (state.mode === "single") {
    renderSingleStore(wrap);
    optiWrap.hidden = true;
    optiWrap.innerHTML = "";
  } else {
    wrap.innerHTML = "";
    optiWrap.hidden = false;
    renderOptimized(optiWrap);
  }
}

function renderSingleStore(wrap) {
  const totals = computeStoreTotals();

  // Trier par total croissant (les magasins complets d'abord)
  const sorted = Object.values(totals).sort((a, b) => {
    const aComplete = a.missing.length === 0 ? 0 : 1;
    const bComplete = b.missing.length === 0 ? 0 : 1;
    if (aComplete !== bComplete) return aComplete - bComplete;
    return a.total - b.total;
  });

  const completes = sorted.filter(s => s.missing.length === 0);
  const cheapestComplete = completes[0];
  const mostExpensive = completes[completes.length - 1];
  const cheapestTotal = cheapestComplete ? cheapestComplete.total : null;

  wrap.innerHTML = sorted.map((s, idx) => {
    const store = STORES[s.store];
    const isComplete = s.missing.length === 0;
    const isCheapest = cheapestComplete && s.store === cheapestComplete.store;
    let savingsHTML = "";
    if (isComplete && cheapestTotal != null) {
      if (isCheapest && mostExpensive && mostExpensive.store !== s.store) {
        const saved = mostExpensive.total - s.total;
        const pct = Math.round((saved / mostExpensive.total) * 100);
        savingsHTML = `<div class="savings">💚 −${formatPrice(saved)} (${pct}%) vs le plus cher</div>`;
      } else if (!isCheapest) {
        const extra = s.total - cheapestTotal;
        savingsHTML = `<div class="extra">+${formatPrice(extra)}</div>`;
      }
    }
    const missingHTML = s.missing.length > 0
      ? `<div class="store-meta warning">⚠️ ${s.missing.length} produit(s) indisponible(s)</div>`
      : `<div class="store-meta">✓ Tous les produits disponibles</div>`;

    return `
      <div class="store-card ${isCheapest ? "cheapest" : ""} ${!isComplete ? "unavailable" : ""}">
        <div class="store-info">
          <div class="store-icon" style="background:${store.color}">${store.icon}</div>
          <div style="min-width:0">
            <div class="store-name">
              ${store.name}
              ${isCheapest ? '<span class="cheapest-badge">🏆 LE MOINS CHER</span>' : ""}
            </div>
            ${missingHTML}
          </div>
        </div>
        <div class="store-price">
          <div class="total">${formatPrice(s.total)}</div>
          ${savingsHTML}
        </div>
      </div>
    `;
  }).join("");
}

function renderOptimized(wrap) {
  const cartItems = Object.entries(state.cart).map(([id, qty]) => ({ product: findProduct(id), qty }))
    .filter(x => x.product);

  // Étape 1 : assignment optimal global (chaque produit dans son magasin le moins cher)
  const assignmentOpt = {};
  let optimalTotal = 0;
  cartItems.forEach(({ product, qty }) => {
    const best = cheapestStoreFor(product);
    if (best.store) {
      assignmentOpt[product.id] = { store: best.store, price: best.price };
      optimalTotal += best.price * qty;
    }
  });

  // Étape 2 : version "réaliste" limitée à 2 magasins
  const realistic = limitToNStores(cartItems, 2);

  // Étape 3 : meilleur magasin unique pour comparaison
  const totals = computeStoreTotals();
  const bestSingle = Object.values(totals)
    .filter(s => s.missing.length === 0)
    .sort((a, b) => a.total - b.total)[0];
  const bestSingleTotal = bestSingle ? bestSingle.total : null;

  let html = "";
  const savedVsBest = bestSingleTotal != null ? bestSingleTotal - realistic.total : 0;

  // Résumé
  html += `
    <div class="opti-summary">
      <div class="title">✨ Panier optimisé sur 2 magasins</div>
      <div class="total">${formatPrice(realistic.total)}</div>
      ${bestSingle && savedVsBest > 0.1
        ? `<div class="saved">Vous économisez <strong>${formatPrice(savedVsBest)}</strong> par rapport à ${STORES[bestSingle.store].name} (le moins cher en magasin unique)</div>`
        : `<div class="saved">Faire vos courses chez ${bestSingle ? STORES[bestSingle.store].name : "un seul magasin"} reste plus simple à ce niveau de panier.</div>`}
    </div>
  `;

  // Détail par magasin (réaliste)
  const grouped = groupByStore(realistic.assignment, cartItems);
  Object.entries(grouped).forEach(([storeId, items]) => {
    const store = STORES[storeId];
    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    html += `
      <div class="opti-store">
        <div class="opti-store-head">
          <div class="opti-store-name">
            <span class="store-icon" style="background:${store.color};width:30px;height:30px;font-size:11px">${store.icon}</span>
            ${store.name}
            <span style="font-size:11px;color:var(--muted);font-weight:500">(${items.length} produit${items.length > 1 ? "s" : ""})</span>
          </div>
          <div class="opti-store-total">${formatPrice(subtotal)}</div>
        </div>
        ${items.map(it => `
          <div class="opti-item">
            <span class="name">${it.qty}× ${it.product.name}</span>
            <span class="price">${formatPrice(it.lineTotal)}</span>
          </div>
        `).join("")}
      </div>
    `;
  });

  // Suggestion bonus : version totalement optimale (sans limite)
  if (Math.abs(optimalTotal - realistic.total) > 0.5) {
    const groupedOpt = groupByStore(assignmentOpt, cartItems);
    const storeCount = Object.keys(groupedOpt).length;
    const bonusSavings = realistic.total - optimalTotal;
    html += `
      <div class="opti-store bonus">
        <div class="opti-store-head">
          <div class="opti-store-name">💡 Option ultra-économique (${storeCount} magasins)</div>
          <div class="opti-store-total">${formatPrice(optimalTotal)}</div>
        </div>
        <div style="font-size:13px;color:var(--text-soft);line-height:1.5">
          En répartissant sur <strong>${storeCount} magasins</strong>, vous économiseriez <strong>${formatPrice(bonusSavings)}</strong> de plus, mais cela demande plus de déplacements.
        </div>
      </div>
    `;
  }

  wrap.innerHTML = html;
}

// Limite l'assignation à N magasins en choisissant la meilleure combinaison
function limitToNStores(cartItems, maxStores) {
  const allStores = Object.keys(STORES);
  let best = { total: Infinity, assignment: {}, stores: [] };

  const combos = combinations(allStores, maxStores);

  combos.forEach(combo => {
    const assignment = {};
    let total = 0;
    let valid = true;

    cartItems.forEach(({ product, qty }) => {
      let bestPrice = Infinity;
      let bestStore = null;
      combo.forEach(s => {
        const price = product.prices[s];
        if (price != null && price < bestPrice) {
          bestPrice = price;
          bestStore = s;
        }
      });
      if (bestStore) {
        assignment[product.id] = { store: bestStore, price: bestPrice };
        total += bestPrice * qty;
      } else {
        valid = false;
      }
    });

    if (valid && total < best.total) {
      best = { total, assignment, stores: combo };
    }
  });

  // Fallback : 1 magasin si la combinaison à N n'est pas valide
  if (best.total === Infinity) {
    const totals = computeStoreTotals();
    const fallback = Object.values(totals)
      .filter(s => s.missing.length === 0)
      .sort((a, b) => a.total - b.total)[0];
    if (fallback) {
      const assignment = {};
      cartItems.forEach(({ product }) => {
        assignment[product.id] = { store: fallback.store, price: product.prices[fallback.store] };
      });
      best = { total: fallback.total, assignment, stores: [fallback.store] };
    }
  }

  return best;
}

function combinations(arr, k) {
  const result = [];
  function recur(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recur(i + 1, combo);
      combo.pop();
    }
  }
  recur(0, []);
  return result;
}

function groupByStore(assignment, cartItems) {
  const grouped = {};
  cartItems.forEach(({ product, qty }) => {
    const a = assignment[product.id];
    if (!a) return;
    if (!grouped[a.store]) grouped[a.store] = [];
    grouped[a.store].push({
      product,
      qty,
      price: a.price,
      lineTotal: a.price * qty
    });
  });
  return grouped;
}

// ---------- Mobile CTA ----------
function renderMobileCTA() {
  const cta = document.getElementById("mobile-cta");
  const ids = Object.keys(state.cart);
  if (ids.length === 0) {
    cta.classList.remove("visible");
    return;
  }
  const totals = computeStoreTotals();
  const best = Object.values(totals)
    .filter(s => s.missing.length === 0)
    .sort((a, b) => a.total - b.total)[0];
  if (!best) {
    cta.classList.remove("visible");
    return;
  }
  cta.classList.add("visible");
  document.getElementById("mobile-cta-total").textContent = formatPrice(best.total);
  document.getElementById("mobile-cta-store").textContent = `🏆 ${STORES[best.store].name} (le moins cher)`;
}

// ---------- Events ----------
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.mode;
    renderComparison();
  });
});

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", e => {
  state.searchQuery = e.target.value;
  renderSearchResults();
});
searchInput.addEventListener("focus", () => {
  if (state.searchQuery || state.activeCategory) renderSearchResults();
});
document.addEventListener("click", e => {
  if (!e.target.closest(".search-box") && !e.target.closest(".quick-categories")) {
    document.getElementById("search-results").hidden = true;
  }
});

document.getElementById("clear-cart").addEventListener("click", () => {
  if (confirm("Vider toute la liste de courses ?")) clearCart();
});

document.getElementById("mobile-cta-btn").addEventListener("click", () => {
  document.querySelector("#comparison, #optimization:not([hidden])").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// ---------- Init ----------
renderUpdateBanner();
renderStoreBadges();
renderQuickCategories();
renderAll();
