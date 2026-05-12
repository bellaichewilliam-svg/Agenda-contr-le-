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
    // Count promos per store (PROMOTIONS uses `chain` not `store`)
    const promosByStore = {};
    promos.forEach(p => { promosByStore[p.chain] = (promosByStore[p.chain] || 0) + 1; });

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

  // ---- Helper: extract usable info from a real PROMOTIONS entry --------------
  // PROMOTIONS uses: chain, type, products[], pct, fixed, n, m, price, title, desc, validUntil
  function promoInfo(p) {
    const store = (window.STORES || {})[p.chain] || { name: p.chain || "Magasin", color: "#FF6B35", icon: "🏪" };
    let product = null;
    if (p.products && p.products.length && typeof PRODUCTS !== "undefined") {
      product = PRODUCTS.find(x => x.id === p.products[0]);
    } else if (p.category && typeof PRODUCTS !== "undefined") {
      product = PRODUCTS.find(x => x.category === p.category);
    }
    const emoji = (product && product.icon) || "🎁";
    const name = p.title || (product ? product.name : "Promo");

    // Compute prices when we know the base
    let baseP = product && product.prices ? product.prices[p.chain] : null;
    let newP = baseP;
    let savedAmount = 0;
    let savedPct = 0;
    if (baseP) {
      if (p.pct) { newP = baseP * (1 - p.pct / 100); savedAmount = baseP - newP; savedPct = p.pct; }
      else if (p.type === "n_for_m" && p.n && p.m) { newP = baseP * p.m / p.n; savedAmount = baseP - newP; savedPct = Math.round((1 - p.m / p.n) * 100); }
      else if (p.type === "second_pct" && p.pct) { newP = baseP * (1 - p.pct / 200); savedAmount = baseP - newP; savedPct = Math.round(p.pct / 2); }
      else if (p.fixed) { savedAmount = p.fixed; newP = Math.max(0, baseP - p.fixed); savedPct = Math.round((p.fixed / baseP) * 100); }
      else if (p.type === "n_for_price" && p.n && p.price) { newP = p.price / p.n; savedAmount = baseP - newP; savedPct = Math.round((1 - newP / baseP) * 100); }
    } else if (p.pct) {
      savedPct = p.pct;
    } else if (p.type === "n_for_m" && p.n && p.m) {
      savedPct = Math.round((1 - p.m / p.n) * 100);
    }

    let typeBadge = "";
    if (p.type === "n_for_m" && p.n === 2 && p.m === 1) typeBadge = "1+1";
    else if (p.type === "n_for_m") typeBadge = `${p.n}=${p.m}`;
    else if (p.type === "second_pct") typeBadge = `2ème −${p.pct}%`;
    else if (p.type === "n_for_price") typeBadge = `${p.n} = ₪${p.price}`;
    else if (p.pct) typeBadge = `−${p.pct}%`;
    else if (p.fixed) typeBadge = `−₪${p.fixed}`;

    const isSuper = (p.fixed && p.fixed >= 15) || (p.pct && p.pct >= 25) || (p.type === "n_for_m" && (p.n - p.m) >= 2);

    return { store, product, emoji, name, baseP, newP, savedAmount, savedPct, typeBadge, isSuper, desc: p.desc };
  }

  // ---- All promos list (alimentaires) ---------------------------------------
  function renderAllPromos(filterChain) {
    const el = document.getElementById("promos-list");
    const count = document.getElementById("all-promos-count");
    if (!el || typeof PROMOTIONS === "undefined") return;
    let list = PROMOTIONS;
    if (filterChain) list = list.filter(p => p.chain === filterChain);

    const l = L();
    if (count) count.textContent = l.promosCount(list.length);

    if (list.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🎁</span><div>${l.emptyPromos}</div></div>`;
      return;
    }

    el.innerHTML = list.map(p => {
      const info = promoInfo(p);
      const pricesHTML = info.baseP ? `
        <div style="display:flex; align-items:baseline; gap:8px; margin-top:8px;">
          <span class="ptop-price-new">${formatPriceSafe(info.newP)}</span>
          <span class="ptop-price-old">${formatPriceSafe(info.baseP)}</span>
          ${info.savedPct > 0 ? `<span class="ptop-saving-pill">−${info.savedPct}%</span>` : ""}
        </div>` : (info.typeBadge ? `<div style="margin-top:8px"><span class="ptop-saving-pill">${info.typeBadge}</span></div>` : "");

      return `
        <div class="promo-card ${info.isSuper ? "super" : ""}" data-promo-pid="${(p.products && p.products[0]) || ""}">
          <div class="promo-store"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${info.store.color};vertical-align:middle;margin-right:4px"></span><span translate="no">${info.store.name}</span></div>
          <div class="promo-title">${info.emoji} ${info.name}</div>
          ${info.desc ? `<div class="promo-desc">${info.desc}</div>` : ""}
          ${pricesHTML}
          <div class="promo-badge">${info.isSuper ? "🔥 SUPER " : ""}${l.promoFor}</div>
        </div>`;
    }).join("");

    el.querySelectorAll(".promo-card").forEach(card => {
      card.addEventListener("click", () => {
        const pid = card.dataset.promoPid;
        if (pid && window.openProductDetail) window.openProductDetail(pid);
      });
    });
  }

  function formatPriceSafe(n) {
    if (typeof window.formatPrice === "function") return window.formatPrice(n);
    return "₪" + (Math.round(n * 100) / 100).toFixed(2);
  }

  function renderPromosView() {
    renderHero();
    // NOTE: renderTopPromos is defined in app.js — let it run there
    if (typeof window.renderTopPromos === "function") window.renderTopPromos();
    renderStoreChips();
    renderDealCategories();
    renderBigDeals();
    renderAllPromos();
  }
  window.renderPromosView = renderPromosView;

  // ---- Big Deals (non-alimentaire) ----------------------------------------
  let _activeDealCat = null;

  function renderDealCategories() {
    const el = document.getElementById("deal-categories");
    if (!el || typeof BIG_CATEGORIES === "undefined") return;
    const counts = (typeof countBigDealsByCategory === "function") ? countBigDealsByCategory() : {};
    const total = (typeof BIG_DEALS !== "undefined") ? BIG_DEALS.length : 0;

    const allBtn = `<button class="deal-cat-pill ${_activeDealCat === null ? "active" : ""}" data-deal-cat="">✨ Tout <span class="cat-count">${total}</span></button>`;
    const cats = Object.entries(BIG_CATEGORIES).map(([id, c]) => {
      const n = counts[id] || 0;
      if (n === 0) return "";
      return `<button class="deal-cat-pill ${_activeDealCat === id ? "active" : ""}" data-deal-cat="${id}">${c.name} <span class="cat-count">${n}</span></button>`;
    }).filter(Boolean).join("");

    el.innerHTML = allBtn + cats;
    el.querySelectorAll(".deal-cat-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.dealCat;
        _activeDealCat = cat || null;
        renderDealCategories();
        renderBigDeals();
      });
    });
  }

  function renderBigDeals() {
    const el = document.getElementById("big-deals-grid");
    const count = document.getElementById("big-deals-count");
    if (!el || typeof BIG_DEALS === "undefined") return;
    const deals = _activeDealCat ? BIG_DEALS.filter(d => d.category === _activeDealCat) : BIG_DEALS;
    if (count) count.textContent = `${deals.length} offres`;

    if (deals.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="emoji">🎁</span><div>Aucune offre dans cette catégorie</div></div>`;
      return;
    }

    el.innerHTML = deals.map(d => {
      const store = (window.BIG_STORES || {})[d.store] || { name: d.store, color: "#FF6B35", icon: "🏪" };
      const cat = (window.BIG_CATEGORIES || {})[d.category] || { color: "#FF6B35" };
      const savePct = d.discount_rate ? Math.round(d.discount_rate * 100) : 0;
      const validDate = d.valid_until ? new Date(d.valid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";

      // Use real image if provided, otherwise fake card with emoji + brand
      const c1 = cat.color, c2 = shade(cat.color, -20);
      const imgHtml = d.image
        ? `<img class="deal-card-img-real" src="${d.image}" alt="${d.name}" loading="lazy" />`
        : `<div class="deal-card-img-fake" style="--cat-color:${c1}; --cat-color-2:${c2}; background:linear-gradient(135deg,${c1} 0%,${c2} 100%);">
             <span class="deal-card-img-emoji">${d.emoji || "🎁"}</span>
             ${d.brand ? `<span class="deal-card-img-brand">${d.brand}</span>` : ""}
           </div>`;

      return `
        <div class="deal-card" data-deal-id="${d.id}">
          <div class="deal-card-img">
            ${imgHtml}
            ${savePct > 0 ? `<span class="deal-card-discount">-${savePct}%</span>` : ""}
          </div>
          <div class="deal-card-body">
            <div class="deal-card-store">
              <span class="store-dot" style="background:${store.color}"></span>
              <span translate="no">${store.name}</span>
            </div>
            <div class="deal-card-name">${d.name}</div>
            <div class="deal-card-prices">
              <span class="deal-card-new">₪${d.discounted_price}</span>
              ${d.original_price > d.discounted_price ? `<span class="deal-card-old">₪${d.original_price}</span>` : ""}
            </div>
            ${validDate ? `<div class="deal-card-until">⏰ Jusqu'au ${validDate}</div>` : ""}
          </div>
        </div>`;
    }).join("");

    el.querySelectorAll(".deal-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.dealId;
        const deal = BIG_DEALS.find(d => d.id === id);
        if (deal) openBigDealModal(deal);
      });
    });
  }

  // Utility: shade a hex color by percentage
  function shade(hex, percent) {
    if (!hex || hex[0] !== "#") return hex;
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8)  & 0xff) + amt));
    const B = Math.min(255, Math.max(0, ( num        & 0xff) + amt));
    return "#" + ((R << 16) | (G << 8) | B).toString(16).padStart(6, "0");
  }

  function openBigDealModal(deal) {
    const modal = document.getElementById("product-modal");
    const content = modal && modal.querySelector(".pm-content");
    if (!content) return;
    const store = (window.BIG_STORES || {})[deal.store] || { name: deal.store, color: "#FF6B35", icon: "🏪" };
    const cat = (window.BIG_CATEGORIES || {})[deal.category] || { color: "#FF6B35", name: deal.category };
    const savePct = deal.discount_rate ? Math.round(deal.discount_rate * 100) : 0;
    const saving = deal.original_price - deal.discounted_price;

    content.innerHTML = `
      <div class="modal-head">
        <h3>${deal.emoji || "🎁"} ${deal.name}</h3>
        <button class="modal-close" onclick="document.getElementById('product-modal').classList.remove('open')">×</button>
      </div>
      <div style="padding:20px 24px;">
        <div style="height:180px; border-radius:16px; background:linear-gradient(135deg,${cat.color},${shade(cat.color,-20)}); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin-bottom:16px;">
          <span style="font-size:96px; line-height:1; filter: drop-shadow(0 4px 12px rgba(0,0,0,.2));">${deal.emoji || "🎁"}</span>
          ${deal.brand ? `<span style="background:rgba(0,0,0,.35); color:white; font-size:12px; font-weight:800; padding:4px 12px; border-radius:999px; letter-spacing:.1em; text-transform:uppercase;">${deal.brand}</span>` : ""}
        </div>
        <div class="pm-cat" style="background:${cat.color}22; color:${cat.color};">${cat.name}</div>
        <div style="display:flex; align-items:baseline; gap:12px; margin:14px 0;">
          <span style="font-size:32px; font-weight:900; color:var(--brand); font-variant-numeric:tabular-nums;">₪${deal.discounted_price}</span>
          <span style="font-size:16px; color:var(--muted); text-decoration:line-through;">₪${deal.original_price}</span>
          ${savePct > 0 ? `<span class="ptop-saving-pill">-${savePct}%</span>` : ""}
        </div>
        ${deal.description ? `<p class="pm-desc">${deal.description}</p>` : ""}
        <div class="pm-section-title">Disponible chez</div>
        <div class="pm-price-row" style="cursor:default;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="store-mini" style="background:${store.color}; min-width:32px; height:32px; font-size:14px;">${store.icon || "🏪"}</span>
            <div>
              <div class="pm-store-name" translate="no">${store.name}</div>
              <div style="font-size:11px;color:var(--muted);">Économie ₪${saving.toFixed(0)}</div>
            </div>
          </div>
          <button class="btn primary sm" onclick="document.getElementById('product-modal').classList.remove('open');" style="margin-left:auto;">OK</button>
        </div>
        ${deal.valid_until ? `<div class="setting-hint" style="margin-top:14px; text-align:center;">⏰ Offre valable jusqu'au ${new Date(deal.valid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>` : ""}
      </div>`;
    modal.classList.add("open");
  }

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
