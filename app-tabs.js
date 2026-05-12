// ============================================================================
// PrixMalin — Bottom tabs + Promo-first views (v15)
// Étend app.js sans le réécrire. Toutes les fonctions existantes (cart, search,
// catégories, etc.) marchent toujours via leurs IDs.
// ============================================================================

(function () {
  "use strict";

  // ---- Translations locales (intégré ici pour pas casser i18n.js) -------------
  const TABS_I18N = {
    fr: {
      tabs:    { promos: "Promos", favs: "Favoris", list: "Liste", more: "Plus" },
      promos:  { title: "🎁 Promos du jour", sub: "Les meilleurs deals près de chez toi" },
      favs:    { title: "❤️ Mes favoris", sub: "Tes produits préférés et leurs promos en cours" },
      list:    { title: "📝 Ma liste", sub: "Prépare ta prochaine sortie courses" },
      more:    { title: "⋯ Plus", sub: "Outils, économies et préférences" },
      stores:  "🏪 Magasins",
      nearMe:  "📍 Près de moi",
      allPromos: "🔥 Toutes les promos",
      heroEyebrow: "AUJOURD'HUI",
      heroTitle:   "Économise sur tes courses",
      heroSub:     "Promos vérifiées dans 9 enseignes israéliennes",
      heroStatsPromos: "promos actives",
      heroStatsStores: "magasins",
      heroStatsSaving: "économie max",
      emptyFavs: "Aucun favori pour l'instant. Ajoute des produits en cœur depuis la liste.",
      emptyPromos: "Aucune promo disponible aujourd'hui.",
      promoFor: "Promo",
      until: "Jusqu'au",
      cheapestAt: "Le moins cher chez",
      addToList: "Ajouter à la liste",
      seeStore: "Voir le magasin",
      promosCount: (n) => `${n} actives`,
      bestSaving: "Top deal",
      shareList: "📤 Partager"
    },
    he: {
      tabs:    { promos: "מבצעים", favs: "מועדפים", list: "רשימה", more: "עוד" },
      promos:  { title: "🎁 מבצעי היום", sub: "המבצעים הכי טובים קרוב אליך" },
      favs:    { title: "❤️ המועדפים שלי", sub: "המוצרים האהובים והמבצעים שלהם" },
      list:    { title: "📝 הרשימה שלי", sub: "תכנן את הקנייה הבאה" },
      more:    { title: "⋯ עוד", sub: "כלים, חיסכון והעדפות" },
      stores:  "🏪 חנויות",
      nearMe:  "📍 קרוב אליי",
      allPromos: "🔥 כל המבצעים",
      heroEyebrow: "היום",
      heroTitle:   "תחסוך על הקניות",
      heroSub:     "מבצעים מאומתים מ-9 רשתות בישראל",
      heroStatsPromos: "מבצעים פעילים",
      heroStatsStores: "חנויות",
      heroStatsSaving: "חיסכון מקסימלי",
      emptyFavs: "אין מועדפים עדיין. הוסף לב למוצרים מהרשימה.",
      emptyPromos: "אין מבצעים זמינים היום.",
      promoFor: "מבצע",
      until: "עד",
      cheapestAt: "הזול ביותר ב-",
      addToList: "הוסף לרשימה",
      seeStore: "ראה חנות",
      promosCount: (n) => `${n} פעילים`,
      bestSaving: "מבצע מומלץ",
      shareList: "📤 שתף"
    },
    en: {
      tabs:    { promos: "Deals", favs: "Favorites", list: "List", more: "More" },
      promos:  { title: "🎁 Today's deals", sub: "Best deals near you" },
      favs:    { title: "❤️ My favorites", sub: "Your favorite products and current deals" },
      list:    { title: "📝 My list", sub: "Plan your next shopping trip" },
      more:    { title: "⋯ More", sub: "Tools, savings & preferences" },
      stores:  "🏪 Stores",
      nearMe:  "📍 Near me",
      allPromos: "🔥 All deals",
      heroEyebrow: "TODAY",
      heroTitle:   "Save on groceries",
      heroSub:     "Verified deals across 9 Israeli chains",
      heroStatsPromos: "active deals",
      heroStatsStores: "stores",
      heroStatsSaving: "max saving",
      emptyFavs: "No favorites yet. Heart products from the list.",
      emptyPromos: "No deals available today.",
      promoFor: "Deal",
      until: "Until",
      cheapestAt: "Cheapest at",
      addToList: "Add to list",
      seeStore: "See store",
      promosCount: (n) => `${n} active`,
      bestSaving: "Top deal",
      shareList: "📤 Share"
    },
    ru: {
      tabs:    { promos: "Акции", favs: "Избранное", list: "Список", more: "Ещё" },
      promos:  { title: "🎁 Акции дня", sub: "Лучшие предложения рядом" },
      favs:    { title: "❤️ Избранное", sub: "Любимые товары и акции" },
      list:    { title: "📝 Мой список", sub: "Планируй следующий поход" },
      more:    { title: "⋯ Ещё", sub: "Инструменты и настройки" },
      stores:  "🏪 Магазины",
      nearMe:  "📍 Рядом",
      allPromos: "🔥 Все акции",
      heroEyebrow: "СЕГОДНЯ",
      heroTitle:   "Экономь на покупках",
      heroSub:     "Проверенные акции в 9 сетях Израиля",
      heroStatsPromos: "акций",
      heroStatsStores: "магазинов",
      heroStatsSaving: "макс. скидка",
      emptyFavs: "Нет избранного. Добавь сердечком из списка.",
      emptyPromos: "Сегодня нет акций.",
      promoFor: "Акция",
      until: "До",
      cheapestAt: "Дешевле всего в",
      addToList: "В список",
      seeStore: "К магазину",
      promosCount: (n) => `${n} активных`,
      bestSaving: "Топ предложение",
      shareList: "📤 Поделиться"
    }
  };

  function L() {
    const lang = (window.state && window.state.lang) || "fr";
    return TABS_I18N[lang] || TABS_I18N.fr;
  }

  // ---- Tab switching -------------------------------------------------------
  function showView(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const view = document.getElementById("view-" + name);
    const tab  = document.querySelector(`.tab[data-view="${name}"]`);
    if (view) view.classList.add("active");
    if (tab)  tab.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (name === "promos") renderPromosView();
    if (name === "favs")   renderFavsView();
    if (name === "list")   renderListView();

    try { localStorage.setItem("prixmalin.activeView", name); } catch {}
  }
  window.showView = showView;

  function initTabs() {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view) showView(view);
      });
    });
    // Restore last view
    let last = "promos";
    try { last = localStorage.getItem("prixmalin.activeView") || "promos"; } catch {}
    showView(last);
  }

  // ---- Translate tab labels --------------------------------------------------
  function applyTabsI18n() {
    const l = L();
    const ids = {
      "tab-label-promos": l.tabs.promos,
      "tab-label-favs":   l.tabs.favs,
      "tab-label-list":   l.tabs.list,
      "tab-label-more":   l.tabs.more,
      "view-promos-title": l.promos.title,
      "view-promos-sub":   l.promos.sub,
      "view-favs-title":   l.favs.title,
      "view-favs-sub":     l.favs.sub,
      "view-list-title":   l.list.title,
      "view-list-sub":     l.list.sub,
      "view-more-title":   l.more.title,
      "view-more-sub":     l.more.sub,
      "stores-section-title": l.stores,
      "all-promos-title":  l.allPromos,
      "see-all-stores-btn": l.nearMe
    };
    Object.entries(ids).forEach(([id, txt]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    });
    // Subtitle for share button
    const shareBtn = document.getElementById("share-btn-text");
    if (shareBtn) shareBtn.textContent = l.shareList.replace("📤 ", "");
  }
  window.applyTabsI18n = applyTabsI18n;

  // ---- Hero block ------------------------------------------------------------
  function renderHero() {
    const el = document.getElementById("promo-hero");
    if (!el) return;
    const l = L();
    const promos = (typeof PROMOTIONS !== "undefined") ? PROMOTIONS : [];
    const numStores = Object.keys(window.STORES || {}).length || 9;
    // Calcule l'économie max parmi les promos
    let maxSaving = 0;
    promos.forEach(p => {
      if (p.discount_rate && p.discount_rate > maxSaving) maxSaving = p.discount_rate;
    });
    const maxSavingPct = Math.round(maxSaving * 100);

    el.innerHTML = `
      <div class="promo-hero-eyebrow">${l.heroEyebrow}</div>
      <div class="promo-hero-title">${l.heroTitle}</div>
      <div class="promo-hero-sub">${l.heroSub}</div>
      <div class="promo-hero-stats">
        <div class="promo-hero-stat"><strong>${promos.length}</strong>${l.heroStatsPromos}</div>
        <div class="promo-hero-stat"><strong>${numStores}</strong>${l.heroStatsStores}</div>
        ${maxSavingPct > 0 ? `<div class="promo-hero-stat"><strong>-${maxSavingPct}%</strong>${l.heroStatsSaving}</div>` : ""}
      </div>
    `;
  }

  // ---- Store chips ----------------------------------------------------------
  function renderStoreChips() {
    const el = document.getElementById("store-chips");
    if (!el || !window.STORES) return;
    const stores = window.STORES;
    const promos = (typeof PROMOTIONS !== "undefined") ? PROMOTIONS : [];
    // Count promos per store
    const promosByStore = {};
    promos.forEach(p => { promosByStore[p.store] = (promosByStore[p.store] || 0) + 1; });

    el.innerHTML = Object.entries(stores).map(([id, s]) => {
      const count = promosByStore[id] || 0;
      return `
        <button class="store-chip" data-store="${id}">
          <div class="store-chip-logo" style="color:${s.color}">${s.icon || "🏪"}</div>
          <div class="store-chip-name" translate="no">${s.name}</div>
          ${count > 0 ? `<div class="store-chip-promos">${count} promos</div>` : ""}
        </button>`;
    }).join("");

    el.querySelectorAll(".store-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const storeId = btn.dataset.store;
        // Filter the all-promos list by this store
        renderAllPromos(storeId);
        document.getElementById("all-promos-title").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ---- Top promos carousel --------------------------------------------------
  function renderTopPromos() {
    const el = document.getElementById("promos-top");
    if (!el || typeof PROMOTIONS === "undefined") return;
    // Top 6 promos (sorted by discount_rate desc)
    const top = [...PROMOTIONS].sort((a, b) => (b.discount_rate || 0) - (a.discount_rate || 0)).slice(0, 6);
    el.innerHTML = top.map(p => renderPromoCard(p)).join("");
    el.querySelectorAll(".ptop-card").forEach(c => {
      c.addEventListener("click", () => {
        if (window.openPromosModal) window.openPromosModal();
      });
    });
  }

  function renderPromoCard(p) {
    const store = (window.STORES || {})[p.store] || { name: p.store, color: "#FF6B35", icon: "🏪" };
    const product = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x => x.id === p.product_id) : null;
    const emoji = (product && product.icon) || "🎁";
    const oldPrice = p.original_price || (product ? product.basePrice : 0);
    const newPrice = p.discounted_price || oldPrice;
    const savingPct = p.discount_rate ? Math.round(p.discount_rate * 100) : 0;
    const name = product ? product.name : (p.title || "Promo");
    const desc = p.description || "";

    return `
      <div class="ptop-card">
        <div class="ptop-card-top">
          <span class="ptop-store-logo" style="background:${store.color}22; color:${store.color}">${store.icon || "🏪"}</span>
          <span class="ptop-store-name" translate="no">${store.name}</span>
          ${savingPct > 0 ? `<span class="ptop-type">-${savingPct}%</span>` : ""}
        </div>
        <div class="ptop-image"><span class="ptop-image-emoji">${emoji}</span></div>
        <div class="ptop-info">
          <div class="ptop-title">${name}</div>
          ${desc ? `<div class="ptop-meta">${desc}</div>` : ""}
          <div class="ptop-prices">
            <span class="ptop-price-new">₪${newPrice.toFixed(2)}</span>
            ${oldPrice > newPrice ? `<span class="ptop-price-old">₪${oldPrice.toFixed(2)}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  // ---- All promos list -------------------------------------------------------
  function renderAllPromos(filterStore) {
    const el = document.getElementById("promos-list");
    const count = document.getElementById("all-promos-count");
    if (!el || typeof PROMOTIONS === "undefined") return;
    let list = PROMOTIONS;
    if (filterStore) list = list.filter(p => p.store === filterStore);

    const l = L();
    if (count) count.textContent = l.promosCount(list.length);

    if (list.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🎁</span><div>${l.emptyPromos}</div></div>`;
      return;
    }

    el.innerHTML = list.map(p => {
      const store = (window.STORES || {})[p.store] || { name: p.store, color: "#FF6B35", icon: "🏪" };
      const product = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x => x.id === p.product_id) : null;
      const emoji = (product && product.icon) || "🎁";
      const oldPrice = p.original_price || (product ? product.basePrice : 0);
      const newPrice = p.discounted_price || oldPrice;
      const savingPct = p.discount_rate ? Math.round(p.discount_rate * 100) : 0;
      const name = product ? product.name : (p.title || "Promo");
      const isSuper = savingPct >= 30 || (p.discount_rate && p.discount_rate >= 0.3);

      return `
        <div class="promo-card ${isSuper ? "super" : ""}" data-promo-store="${p.store}" data-promo-pid="${p.product_id || ""}">
          <div class="promo-store" translate="no">${store.icon || "🏪"} ${store.name}</div>
          <div class="promo-title">${emoji} ${name}</div>
          ${p.description ? `<div class="promo-desc">${p.description}</div>` : ""}
          <div style="display:flex; align-items:baseline; gap:8px; margin-top:8px;">
            <span class="ptop-price-new">₪${newPrice.toFixed(2)}</span>
            ${oldPrice > newPrice ? `<span class="ptop-price-old">₪${oldPrice.toFixed(2)}</span>` : ""}
            ${savingPct > 0 ? `<span class="ptop-saving-pill">-${savingPct}%</span>` : ""}
          </div>
          <div class="promo-badge">${isSuper ? "🔥 " : ""}${l.promoFor}</div>
        </div>`;
    }).join("");

    el.querySelectorAll(".promo-card").forEach(card => {
      card.addEventListener("click", () => {
        const pid = card.dataset.promoPid;
        if (pid && window.openProductDetail) window.openProductDetail(pid);
      });
    });
  }

  function renderPromosView() {
    renderHero();
    renderTopPromos();
    renderStoreChips();
    renderAllPromos();
  }
  window.renderPromosView = renderPromosView;

  // ---- Favs view -------------------------------------------------------------
  function renderFavsView() {
    const el = document.getElementById("favs-list");
    if (!el) return;
    const l = L();
    // Utilise state.frequency (déjà existant) ou state.favorites s'il existe
    const state = window.state || {};
    const favIds = Object.keys(state.frequency || {}).filter(id => (state.frequency[id] || 0) > 0).sort((a, b) => state.frequency[b] - state.frequency[a]);

    if (favIds.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">💔</span><div>${l.emptyFavs}</div></div>`;
      return;
    }

    el.innerHTML = favIds.slice(0, 50).map(pid => {
      const p = (typeof PRODUCTS !== "undefined") ? PRODUCTS.find(x => x.id === pid) : null;
      if (!p) return "";
      // Find cheapest store
      const prices = p.prices || {};
      const entries = Object.entries(prices).filter(([, v]) => typeof v === "number" && v > 0);
      if (entries.length === 0) return "";
      entries.sort((a, b) => a[1] - b[1]);
      const [bestStore, bestPrice] = entries[0];
      const store = (window.STORES || {})[bestStore] || { name: bestStore };
      // Has promo?
      const promo = (typeof PROMOTIONS !== "undefined") ? PROMOTIONS.find(pr => pr.product_id === pid) : null;

      return `
        <div class="fav-card" data-pid="${pid}">
          <div class="fav-card-icon">${p.icon || "📦"}</div>
          <div class="fav-card-info">
            <div class="fav-card-name">${p.name}</div>
            <div class="fav-card-prices">
              <span class="fav-card-best">₪${bestPrice.toFixed(2)}</span>
              <span class="fav-card-store">${l.cheapestAt} <strong translate="no">${store.name}</strong></span>
            </div>
            ${promo ? `<div class="fav-card-promo">🎁 Promo active</div>` : ""}
          </div>
          <button class="fav-heart" data-pid="${pid}" aria-label="Retirer">❤️</button>
        </div>`;
    }).join("");

    el.querySelectorAll(".fav-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("fav-heart")) {
          const pid = e.target.dataset.pid;
          if (state.frequency) state.frequency[pid] = 0;
          try { localStorage.setItem("prixmalin.state.v4", JSON.stringify(state)); } catch {}
          renderFavsView();
          return;
        }
        const pid = card.dataset.pid;
        if (pid && window.openProductDetail) window.openProductDetail(pid);
      });
    });
  }
  window.renderFavsView = renderFavsView;

  // ---- List view: just update cart badge -----------------------------------
  function renderListView() {
    updateCartBadge();
    // The existing app.js renderCart() handles the cart inside #cart
    if (typeof window.renderCart === "function") window.renderCart();
    renderCheapestStoreSummary();
  }
  window.renderListView = renderListView;

  function renderCheapestStoreSummary() {
    const el = document.getElementById("comparison-summary");
    if (!el) return;
    const state = window.state || {};
    const list = state.lists && state.activeListId && state.lists[state.activeListId];
    if (!list || !list.cart || Object.keys(list.cart).length === 0) {
      el.hidden = true;
      return;
    }
    if (typeof window.computeStoreTotals !== "function") {
      el.hidden = true;
      return;
    }
    try {
      const totals = window.computeStoreTotals();
      if (!totals || totals.length === 0) { el.hidden = true; return; }
      const cheapest = totals[0];
      const store = (window.STORES || {})[cheapest.store] || { name: cheapest.store };
      const next = totals[1];
      const saving = next ? (next.total - cheapest.total) : 0;
      el.hidden = false;
      el.innerHTML = `
        <div class="comparison-card-title">💸 Le moins cher</div>
        <div class="comparison-card-store" translate="no">${store.icon || "🏪"} ${store.name}</div>
        <div class="comparison-card-amount">₪${cheapest.total.toFixed(2)}</div>
        ${saving > 0 ? `<div class="comparison-card-saving">+ Économie estimée : ₪${saving.toFixed(2)} vs ${(window.STORES || {})[next.store]?.name || next.store}</div>` : ""}`;
    } catch {
      el.hidden = true;
    }
  }
  window.renderCheapestStoreSummary = renderCheapestStoreSummary;

  // ---- Cart badge (number on the List tab icon) -----------------------------
  function updateCartBadge() {
    const badge = document.getElementById("cart-tab-badge");
    if (!badge) return;
    const state = window.state || {};
    const list = state.lists && state.activeListId && state.lists[state.activeListId];
    const n = list && list.cart ? Object.values(list.cart).filter(i => i && i.qty > 0 && !i.done).length : 0;
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 99 ? "99+" : String(n);
    } else {
      badge.hidden = true;
    }
  }
  window.updateCartBadge = updateCartBadge;

  // ---- Init -----------------------------------------------------------------
  function init() {
    initTabs();
    applyTabsI18n();
    renderPromosView();
    updateCartBadge();

    // Bind "Nearby quick" button in header
    const quickNearby = document.getElementById("nearby-quick-btn");
    if (quickNearby) {
      quickNearby.addEventListener("click", () => {
        if (window.openNearbyModal) window.openNearbyModal();
      });
    }

    // Re-render when language changes (hook into lang picker buttons)
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setTimeout(() => {
          applyTabsI18n();
          // Re-render current view
          const active = document.querySelector(".view.active");
          if (active) {
            const name = active.id.replace("view-", "");
            if (name === "promos") renderPromosView();
            if (name === "favs")   renderFavsView();
            if (name === "list")   renderListView();
          }
        }, 50);
      });
    });

    // Hook cart updates so badge stays current
    const _origRenderCart = window.renderCart;
    if (typeof _origRenderCart === "function") {
      window.renderCart = function () {
        _origRenderCart.apply(this, arguments);
        updateCartBadge();
        renderCheapestStoreSummary();
      };
    }
  }

  // Wait for app.js to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
})();
