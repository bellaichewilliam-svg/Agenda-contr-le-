// PrixMalin - logique principale
// Dépend de data/products.js (STORES, PRODUCTS, DATA_VERSION, LAST_UPDATED)

const STORAGE_KEY = "prixmalin.cart.v2";
const STORAGE_KEY_OLD = "prixmalin.cart.v1";

// ---------- État global ----------
// Format cart: { [productId]: { qty: number, done: boolean } }
const state = {
  cart: loadCart(),
  mode: "single",
  activeCategory: null,
  searchQuery: "",
  hideDone: false
};

// ---------- Persistence ----------
function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // migration v1 -> v2
    const old = localStorage.getItem(STORAGE_KEY_OLD);
    if (old) {
      const parsed = JSON.parse(old);
      const migrated = {};
      Object.entries(parsed).forEach(([id, qty]) => {
        migrated[id] = { qty, done: false };
      });
      return migrated;
    }
  } catch {}
  return {};
}
function saveCart() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); } catch {}
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
    .replace(/[̀-ͯ]/g, "");
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}
function getQty(id) { return state.cart[id]?.qty || 0; }
function isDone(id) { return state.cart[id]?.done || false; }
function activeItems() {
  // produits non cochés (utilisés pour la comparaison de prix)
  const out = {};
  Object.entries(state.cart).forEach(([id, item]) => {
    if (!item.done) out[id] = item.qty;
  });
  return out;
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
    wrap.hidden = true; wrap.innerHTML = ""; return;
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
    const qty = getQty(p.id);
    const cartTag = qty ? `<span style="color:var(--success);font-weight:600">✓ ${qty}×</span>` : "";
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
    if (price != null && price < best.price) best = { store, price };
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
  const cur = state.cart[id];
  if (cur) {
    cur.qty += qty;
    cur.done = false; // ré-ajout = redevient à acheter
  } else {
    state.cart[id] = { qty, done: false };
  }
  saveCart();
  renderAll();
}
function setQty(id, qty) {
  if (qty <= 0) {
    delete state.cart[id];
  } else {
    if (!state.cart[id]) state.cart[id] = { qty, done: false };
    else state.cart[id].qty = qty;
  }
  saveCart();
  renderAll();
}
function toggleDone(id) {
  if (!state.cart[id]) return;
  state.cart[id].done = !state.cart[id].done;
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
function clearDone() {
  Object.keys(state.cart).forEach(id => {
    if (state.cart[id].done) delete state.cart[id];
  });
  saveCart();
  renderAll();
}
function uncheckAll() {
  Object.values(state.cart).forEach(item => item.done = false);
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
  const progressEl = document.getElementById("cart-progress");
  const countEl = document.getElementById("cart-count");

  if (ids.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🛒</span>
        Votre liste est vide.<br />
        Cherchez un produit ou cliquez sur une catégorie pour commencer.
      </div>`;
    actions.hidden = true;
    progressEl.hidden = true;
    return;
  }

  actions.hidden = false;
  progressEl.hidden = false;

  const doneCount = ids.filter(id => state.cart[id].done).length;
  const total = ids.length;
  const pct = Math.round((doneCount / total) * 100);
  progressEl.innerHTML = `
    <div class="progress-head">
      <span class="progress-label">${doneCount} / ${total} cochés</span>
      <div class="progress-actions">
        <button class="link-btn" data-action="hide-done">${state.hideDone ? "Voir tout" : "Masquer cochés"}</button>
        ${doneCount > 0 ? `<button class="link-btn" data-action="uncheck-all">Tout décocher</button>` : ""}
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
  progressEl.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", () => {
      if (el.dataset.action === "hide-done") {
        state.hideDone = !state.hideDone;
        renderCart();
      } else if (el.dataset.action === "uncheck-all") {
        uncheckAll();
      }
    });
  });

  const totalItems = Object.values(state.cart).reduce((a, b) => a + b.qty, 0);
  countEl.textContent = `${total} produit${total > 1 ? "s" : ""} · ${totalItems} article${totalItems > 1 ? "s" : ""}`;

  // Tri : non cochés d'abord, puis cochés
  const sortedIds = ids.sort((a, b) => {
    const da = state.cart[a].done ? 1 : 0;
    const db = state.cart[b].done ? 1 : 0;
    return da - db;
  });

  wrap.innerHTML = sortedIds.map(id => {
    const p = findProduct(id);
    if (!p) return "";
    const item = state.cart[id];
    if (state.hideDone && item.done) return "";
    const cheapest = cheapestStoreFor(p);
    const cheapestStore = STORES[cheapest.store];
    return `
      <div class="cart-item ${item.done ? "done" : ""}">
        <button class="check-btn ${item.done ? "checked" : ""}" data-action="toggle" data-id="${id}" aria-label="Cocher">
          ${item.done ? "✓" : ""}
        </button>
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
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-id="${id}" aria-label="−">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${id}" aria-label="+">+</button>
        </div>
        <button class="remove-btn" data-action="rm" data-id="${id}" aria-label="Supprimer">×</button>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const action = el.dataset.action;
      if (action === "inc") setQty(id, getQty(id) + 1);
      else if (action === "dec") setQty(id, getQty(id) - 1);
      else if (action === "rm") removeFromCart(id);
      else if (action === "toggle") toggleDone(id);
    });
  });
}

// ---------- Comparison ----------
function computeStoreTotals() {
  const totals = {};
  Object.keys(STORES).forEach(s => {
    totals[s] = { store: s, total: 0, available: 0, missing: [], items: [] };
  });
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
    const allDone = Object.keys(state.cart).length > 0;
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="emoji">${allDone ? "🎉" : "📊"}</span>
        ${allDone
          ? "Bravo, tous les produits sont cochés&nbsp;!"
          : "Ajoutez des produits à votre liste<br />pour voir la comparaison entre les enseignes."}
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

  wrap.innerHTML = sorted.map(s => {
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
            <div class="store-name">${store.name} ${isCheapest ? '<span class="cheapest-badge">🏆 LE MOINS CHER</span>' : ""}</div>
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
  const cartItems = Object.entries(activeItems()).map(([id, qty]) => ({ product: findProduct(id), qty }))
    .filter(x => x.product);

  const assignmentOpt = {};
  let optimalTotal = 0;
  cartItems.forEach(({ product, qty }) => {
    const best = cheapestStoreFor(product);
    if (best.store) {
      assignmentOpt[product.id] = { store: best.store, price: best.price };
      optimalTotal += best.price * qty;
    }
  });

  const realistic = limitToNStores(cartItems, 2);
  const totals = computeStoreTotals();
  const bestSingle = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
  const bestSingleTotal = bestSingle ? bestSingle.total : null;

  let html = "";
  const savedVsBest = bestSingleTotal != null ? bestSingleTotal - realistic.total : 0;
  html += `
    <div class="opti-summary">
      <div class="title">✨ Panier optimisé sur 2 magasins</div>
      <div class="total">${formatPrice(realistic.total)}</div>
      ${bestSingle && savedVsBest > 0.1
        ? `<div class="saved">Vous économisez <strong>${formatPrice(savedVsBest)}</strong> par rapport à ${STORES[bestSingle.store].name} (le moins cher en magasin unique)</div>`
        : `<div class="saved">Faire vos courses chez ${bestSingle ? STORES[bestSingle.store].name : "un seul magasin"} reste plus simple à ce niveau de panier.</div>`}
    </div>
  `;

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

function limitToNStores(cartItems, maxStores) {
  const allStores = Object.keys(STORES);
  let best = { total: Infinity, assignment: {}, stores: [] };
  const combos = combinations(allStores, maxStores);
  combos.forEach(combo => {
    const assignment = {};
    let total = 0;
    let valid = true;
    cartItems.forEach(({ product, qty }) => {
      let bestPrice = Infinity, bestStore = null;
      combo.forEach(s => {
        const price = product.prices[s];
        if (price != null && price < bestPrice) { bestPrice = price; bestStore = s; }
      });
      if (bestStore) {
        assignment[product.id] = { store: bestStore, price: bestPrice };
        total += bestPrice * qty;
      } else valid = false;
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
  const result = [];
  function recur(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); recur(i + 1, combo); combo.pop(); }
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
    grouped[a.store].push({ product, qty, price: a.price, lineTotal: a.price * qty });
  });
  return grouped;
}

// ---------- Mobile CTA ----------
function renderMobileCTA() {
  const cta = document.getElementById("mobile-cta");
  const active = Object.keys(activeItems());
  if (active.length === 0) { cta.classList.remove("visible"); return; }
  const totals = computeStoreTotals();
  const best = Object.values(totals).filter(s => s.missing.length === 0).sort((a, b) => a.total - b.total)[0];
  if (!best) { cta.classList.remove("visible"); return; }
  cta.classList.add("visible");
  document.getElementById("mobile-cta-total").textContent = formatPrice(best.total);
  document.getElementById("mobile-cta-store").textContent = `🏆 ${STORES[best.store].name} (le moins cher)`;
}

// ---------- Partage de liste ============================================
// Encode l'état du panier dans l'URL pour partage avec une autre personne.
// Format compact : id1:qty:done,id2:qty:done... → base64-url
function encodeCart() {
  const parts = Object.entries(state.cart).map(([id, item]) =>
    `${id}:${item.qty}:${item.done ? 1 : 0}`
  );
  const str = parts.join(",");
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
      if (id && findProduct(id)) {
        cart[id] = { qty: parseInt(qty, 10) || 1, done: done === "1" };
      }
    });
    return cart;
  } catch { return null; }
}
function buildShareURL() {
  const enc = encodeCart();
  const base = location.origin + location.pathname;
  return `${base}#liste=${enc}`;
}

async function shareList() {
  if (Object.keys(state.cart).length === 0) {
    showToast("Ajoutez d'abord des produits à votre liste", "warn");
    return;
  }
  const url = buildShareURL();
  const text = `🛒 Ma liste de courses (${Object.keys(state.cart).length} produits) — ouvre ce lien pour la voir, la cocher et la compléter :`;

  // 1. API native (Android Chrome, iOS Safari)
  if (navigator.share) {
    try {
      await navigator.share({ title: "Ma liste PrixMalin", text, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // user cancelled
    }
  }

  // 2. Fallback : copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(url);
    showShareModal(url);
  } catch {
    showShareModal(url);
  }
}

function showShareModal(url) {
  const modal = document.getElementById("share-modal");
  document.getElementById("share-url").value = url;
  document.getElementById("share-wa").href = `https://wa.me/?text=${encodeURIComponent("🛒 Ma liste de courses PrixMalin : " + url)}`;
  document.getElementById("share-sms").href = `sms:?body=${encodeURIComponent("🛒 Ma liste de courses : " + url)}`;
  document.getElementById("share-mail").href = `mailto:?subject=${encodeURIComponent("Ma liste de courses")}&body=${encodeURIComponent("Voici ma liste de courses, tu peux la cocher / compléter ici :\n\n" + url)}`;
  modal.classList.add("visible");
}
function hideShareModal() {
  document.getElementById("share-modal").classList.remove("visible");
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast visible " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("visible"), 2800);
}

// Importe une liste partagée présente dans l'URL
function checkIncomingList() {
  const m = location.hash.match(/liste=([^&]+)/);
  if (!m) return;
  const incoming = decodeCart(m[1]);
  if (!incoming || Object.keys(incoming).length === 0) {
    location.hash = "";
    return;
  }
  const incomingCount = Object.keys(incoming).length;
  const currentCount = Object.keys(state.cart).length;

  let action;
  if (currentCount === 0) {
    action = "replace";
  } else {
    const choice = prompt(
      `📥 Une liste partagée a été reçue (${incomingCount} produits).\n\n` +
      `Votre liste actuelle contient ${currentCount} produits.\n\n` +
      `Tapez :\n` +
      `  1 pour REMPLACER votre liste par celle reçue\n` +
      `  2 pour FUSIONNER les deux listes (recommandé)\n` +
      `  3 pour IGNORER la liste reçue`,
      "2"
    );
    if (choice === "1") action = "replace";
    else if (choice === "2") action = "merge";
    else action = "ignore";
  }

  if (action === "replace") {
    state.cart = incoming;
    showToast(`✓ Liste reçue importée (${incomingCount} produits)`);
  } else if (action === "merge") {
    let added = 0, updated = 0;
    Object.entries(incoming).forEach(([id, item]) => {
      if (state.cart[id]) {
        // garder le max de quantité, garder l'état "done" si l'un des deux est coché
        const cur = state.cart[id];
        const newQty = Math.max(cur.qty, item.qty);
        if (newQty !== cur.qty) updated++;
        cur.qty = newQty;
        cur.done = cur.done && item.done;
      } else {
        state.cart[id] = { qty: item.qty, done: item.done };
        added++;
      }
    });
    showToast(`✓ Fusion : ${added} ajoutés, ${updated} mis à jour`);
  }

  saveCart();
  history.replaceState(null, "", location.pathname + location.search);
  renderAll();
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
searchInput.addEventListener("input", e => { state.searchQuery = e.target.value; renderSearchResults(); });
searchInput.addEventListener("focus", () => { if (state.searchQuery || state.activeCategory) renderSearchResults(); });
document.addEventListener("click", e => {
  if (!e.target.closest(".search-box") && !e.target.closest(".quick-categories")) {
    document.getElementById("search-results").hidden = true;
  }
});

document.getElementById("clear-cart").addEventListener("click", () => {
  if (confirm("Vider toute la liste de courses ?")) clearCart();
});
document.getElementById("share-list").addEventListener("click", shareList);

document.getElementById("mobile-cta-btn").addEventListener("click", () => {
  document.querySelector("#comparison, #optimization:not([hidden])").scrollIntoView({ behavior: "smooth", block: "start" });
});

// Modal partage
document.getElementById("share-close").addEventListener("click", hideShareModal);
document.getElementById("share-modal").addEventListener("click", e => {
  if (e.target.id === "share-modal") hideShareModal();
});
document.getElementById("share-copy").addEventListener("click", async () => {
  const input = document.getElementById("share-url");
  try {
    await navigator.clipboard.writeText(input.value);
    showToast("✓ Lien copié dans le presse-papier !");
  } catch {
    input.select();
    document.execCommand("copy");
    showToast("✓ Lien copié !");
  }
});

// ---------- Init ----------
renderUpdateBanner();
renderStoreBadges();
renderQuickCategories();
checkIncomingList();
renderAll();
