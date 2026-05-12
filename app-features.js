// ============================================================================
// כדאי v25 — All features in fictional/demo mode
// Tout est en stub : onboarding, profil, notifs, chat IA, achievements,
// premium, favoris, pull-to-refresh, voice, stories, sponsored.
// Données 100% fictives en attendant le vrai backend.
// ============================================================================

(function () {
  "use strict";

  // ============== FAKE DATA ==================================================
  const FAKE_USER = {
    name: "Sarah",
    avatar: "👩",
    email: "sarah@example.com",
    location: "Netanya, Israël",
    member_since: "Mars 2026",
    savings_this_month: 247,
    savings_total: 1850,
    deals_used: 34,
    streak_days: 12,
    level: 3,
    next_level_in: 6,
    is_premium: false
  };

  const FAKE_NOTIFS = [
    { id: 1, icon: "🎁", title: "Nouvelle promo sur ta liste !", text: "Nutella -23% chez Osher Ad — tu l'avais en favori", time: "il y a 8 min", unread: true },
    { id: 2, icon: "🔥", title: "SUPER deal du jour", text: "Pâtes Osem 1+1 chez Shufersal jusqu'à demain", time: "il y a 2h", unread: true },
    { id: 3, icon: "💚", title: "Tu as économisé 35₪ hier", text: "Bravo ! +15 points achievement débloqués", time: "hier", unread: false },
    { id: 4, icon: "📍", title: "3 nouvelles offres près de toi", text: "Victory Netanya HaOrzim vient d'ajouter des promos", time: "hier", unread: false },
    { id: 5, icon: "👨‍👩‍👧", title: "Marie a ajouté du lait à ta liste", text: "Liste partagée 'Courses maison'", time: "il y a 2j", unread: false }
  ];

  const FAKE_ACHIEVEMENTS = [
    { id: "first_save", icon: "🌱", title: "Première économie", desc: "Tu as économisé pour la 1ère fois", earned: true, date: "12 mar 2026" },
    { id: "saver_100", icon: "💵", title: "100₪ économisés", desc: "Atteint 100₪ d'économies cumulées", earned: true, date: "18 mar 2026" },
    { id: "streak_7", icon: "🔥", title: "Une semaine de chasse", desc: "7 jours consécutifs sur l'app", earned: true, date: "25 mar 2026" },
    { id: "saver_500", icon: "💰", title: "500₪ économisés", desc: "Atteint 500₪ d'économies cumulées", earned: true, date: "8 avr 2026" },
    { id: "deal_hunter", icon: "🎯", title: "Chasseur de deals", desc: "30 promos utilisées", earned: true, date: "2 mai 2026" },
    { id: "social", icon: "📤", title: "Partageur", desc: "Partage 5 listes avec tes proches", earned: false, progress: "3/5" },
    { id: "saver_1000", icon: "👑", title: "Champion 1000₪", desc: "Atteint 1000₪ d'économies cumulées", earned: false, progress: "1850/1000 ✓" },
    { id: "explorer", icon: "🗺️", title: "Explorateur", desc: "Visite 5 magasins différents", earned: false, progress: "2/5" }
  ];

  const FAKE_CHAT_MESSAGES = [
    { from: "ai", text: "Salut Sarah ! 👋 Je suis ton assistant כדאי. Je peux t'aider à trouver les meilleures promos, te suggérer des recettes économiques, ou comparer les magasins. Que veux-tu faire ?" }
  ];

  const FAKE_CHAT_SUGGESTIONS = [
    "🔍 Trouve-moi des promos pâtes",
    "🍝 Une recette pas chère pour ce soir ?",
    "📍 Quel magasin est le moins cher ?",
    "📋 Aide-moi à faire ma liste pour Shabbat"
  ];

  // Faux scenario : réponses IA pré-écrites
  const FAKE_AI_RESPONSES = {
    "promos": "J'ai trouvé 3 super promos sur les pâtes aujourd'hui :\n\n🔥 **Osem 500g** — 1+1 chez Shufersal (jusqu'au 20 mai)\n💚 **Barilla** — -25% chez Rami Levy\n🎁 **Pâtes complètes** — 3 paquets à 15₪ chez Victory\n\nEn moyenne tu économises 12₪. Veux-tu que je les ajoute à ta liste ?",
    "recette": "Voici une idée de **pasta tomate-thon** pour 4 personnes, ~28₪ total :\n\n• Pâtes 500g (3.22₪ chez Shufersal en promo)\n• Tomates 1kg (8₪)\n• Thon 2 boîtes (9₪)\n• Oignon + huile + ail (~7₪)\n\nTemps : 20 min. Veux-tu la recette détaillée ?",
    "magasin": "D'après ton historique, **Osher Ad Tom Lantos** est ton magasin le plus économique (en moyenne -8% vs Carrefour pour tes achats habituels).\n\nMais cette semaine, **Rami Levy HaOrzim** a 4 super promos sur tes favoris — ça pourrait valoir le détour.",
    "shabbat": "Pour Shabbat à 6 personnes, je te propose :\n\n🍞 **Pain hallah** chez Rami Levy (en promo -20%)\n🐟 **Saumon 1kg** chez Tiv Taam\n🍷 **Vin Yarden** (deal 3 pour 100₪ chez Carrefour 🔥)\n🥗 **Salades** Osher Ad\n🍰 **Gâteau** Yochananof\n\nTotal estimé : 245₪ (au lieu de 320₪)\nVeux-tu que je crée la liste ?"
  };

  const FAKE_STORIES = [
    { store: "rami_levy", title: "Promo Shabbat", thumbnail: "🕯️", color: "#dc2626" },
    { store: "shufersal", title: "Hot deals semaine", thumbnail: "🔥", color: "#16a34a" },
    { store: "osher_ad", title: "Nouveau catalogue", thumbnail: "📋", color: "#0891b2" },
    { store: "victory", title: "Solde été", thumbnail: "☀️", color: "#f59e0b" },
    { store: "yochananof", title: "Bio & frais", thumbnail: "🌿", color: "#9333ea" },
    { store: "boom", title: "Mega deal", thumbnail: "💥", color: "#ec4899" },
    { store: "carrefour", title: "Produits France", thumbnail: "🥐", color: "#1d4ed8" }
  ];

  // ============== STATE =====================================================
  const FEAT = {
    onboardingDone: getLS("kedai.onboarded") === "1",
    notifs: FAKE_NOTIFS.slice(),
    favorites: JSON.parse(getLS("kedai.favs") || "[]"),
    chatOpen: false,
    notifsOpen: false,
    profileOpen: false
  };
  function setLS(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function getLS(k) { try { return localStorage.getItem(k); } catch { return null; } }

  // ============== UI INJECTION ==============================================
  function injectTopActions() {
    const ta = document.querySelector(".top-actions");
    if (!ta) return;
    if (document.getElementById("notif-btn")) return;
    const html = `
      <button class="icon-btn notif-bell" id="notif-btn" aria-label="Notifications">
        🔔<span class="notif-count" id="notif-count" hidden></span>
      </button>
      <button class="icon-btn" id="profile-btn" aria-label="Profil">${FAKE_USER.avatar}</button>
    `;
    ta.insertAdjacentHTML("afterbegin", html);
    updateNotifBadge();
    document.getElementById("notif-btn").addEventListener("click", openNotifs);
    document.getElementById("profile-btn").addEventListener("click", openProfile);
  }

  function injectChatFab() {
    if (document.getElementById("chat-fab")) return;
    const fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.className = "chat-fab";
    fab.setAttribute("aria-label", "Assistant IA");
    fab.innerHTML = '<span class="chat-fab-icon">💬</span><span class="chat-fab-pulse"></span>';
    document.body.appendChild(fab);
    fab.addEventListener("click", openChat);
  }

  function injectStoriesBar() {
    const promosView = document.getElementById("view-promos");
    if (!promosView || document.getElementById("stories-bar")) return;
    const bar = document.createElement("div");
    bar.id = "stories-bar";
    bar.className = "stories-bar";
    const stores = (typeof STORES !== "undefined") ? STORES : {};
    bar.innerHTML = FAKE_STORIES.map(s => {
      const store = stores[s.store] || {};
      return `
        <button class="story" data-store="${s.store}">
          <div class="story-ring" style="background:linear-gradient(135deg,${s.color},${shade(s.color, -20)})">
            <div class="story-emoji">${s.thumbnail}</div>
          </div>
          <div class="story-label" translate="no">${store.name || s.store}</div>
        </button>`;
    }).join("");
    const sub = promosView.querySelector(".view-subtitle");
    if (sub && sub.nextSibling) promosView.insertBefore(bar, sub.nextSibling);
    else promosView.insertBefore(bar, promosView.firstChild);
    bar.querySelectorAll(".story").forEach(b => {
      b.addEventListener("click", () => showToast("📖 Catalogue " + (stores[b.dataset.store]?.name || b.dataset.store) + " (démo)"));
    });
  }

  function injectGlobalSearchInTopbar() {
    const topbar = document.querySelector(".topbar-inner");
    if (!topbar || document.getElementById("global-search")) return;
    const wrap = document.createElement("div");
    wrap.className = "global-search-wrap";
    wrap.innerHTML = `
      <div class="global-search-box">
        <span class="gs-icon">🔍</span>
        <input id="global-search" type="text" placeholder="Cherche une promo, un produit, un magasin..." />
        <button class="gs-voice" id="voice-btn" aria-label="Recherche vocale">🎤</button>
      </div>
    `;
    topbar.appendChild(wrap);
    document.getElementById("voice-btn").addEventListener("click", () => {
      showToast("🎤 Recherche vocale : bientôt disponible");
    });
    document.getElementById("global-search").addEventListener("focus", () => {
      if (window.showView) window.showView("list");
      setTimeout(() => {
        const real = document.getElementById("search-input");
        if (real) real.focus();
      }, 250);
    });
  }

  // ============== ONBOARDING ================================================
  function showOnboarding() {
    if (FEAT.onboardingDone) return;
    const ov = document.createElement("div");
    ov.className = "onboarding-overlay";
    ov.id = "onboarding";
    ov.innerHTML = `
      <div class="onb-card">
        <div class="onb-screens" id="onb-screens">
          <div class="onb-screen active" data-step="0">
            <div class="onb-emoji">🎁</div>
            <h2>Bienvenue sur כדאי</h2>
            <p>Économise jusqu'à <strong>250₪/mois</strong> sur tes courses en Israël grâce aux meilleures promos vérifiées chaque jour.</p>
          </div>
          <div class="onb-screen" data-step="1">
            <div class="onb-emoji">🏪</div>
            <h2>Tes magasins préférés</h2>
            <p>Sélectionne 2-3 enseignes que tu fréquentes — on personnalisera ton feed.</p>
            <div class="onb-stores" id="onb-stores"></div>
          </div>
          <div class="onb-screen" data-step="2">
            <div class="onb-emoji">🔔</div>
            <h2>Reçois les alertes</h2>
            <p>Active les notifications pour être prévenu quand TES produits sont en promo.</p>
            <button class="btn primary onb-allow">Activer les notifications</button>
            <button class="btn ghost onb-skip">Plus tard</button>
          </div>
        </div>
        <div class="onb-dots">
          <span class="onb-dot active"></span>
          <span class="onb-dot"></span>
          <span class="onb-dot"></span>
        </div>
        <div class="onb-actions">
          <button class="btn ghost" id="onb-prev" hidden>Précédent</button>
          <button class="btn primary" id="onb-next">Suivant →</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const storesEl = ov.querySelector("#onb-stores");
    const stores = (typeof STORES !== "undefined") ? STORES : {};
    storesEl.innerHTML = Object.entries(stores).map(([id, s]) =>
      `<button class="onb-store" data-store-id="${id}"><span class="onb-store-icon" style="background:${s.color}">${s.icon || "🏪"}</span><span>${s.name}</span></button>`
    ).join("");
    storesEl.querySelectorAll(".onb-store").forEach(b => b.addEventListener("click", () => b.classList.toggle("selected")));

    let step = 0;
    const screens = ov.querySelectorAll(".onb-screen");
    const dots = ov.querySelectorAll(".onb-dot");
    const nextBtn = ov.querySelector("#onb-next");
    const prevBtn = ov.querySelector("#onb-prev");

    function go(to) {
      step = Math.max(0, Math.min(2, to));
      screens.forEach((s, i) => s.classList.toggle("active", i === step));
      dots.forEach((d, i) => d.classList.toggle("active", i === step));
      prevBtn.hidden = step === 0;
      nextBtn.textContent = step === 2 ? "Commencer 🎉" : "Suivant →";
    }
    nextBtn.addEventListener("click", () => {
      if (step === 2) {
        setLS("kedai.onboarded", "1");
        const selected = [...storesEl.querySelectorAll(".onb-store.selected")].map(b => b.dataset.storeId);
        setLS("kedai.favStores", JSON.stringify(selected));
        ov.classList.add("closing");
        setTimeout(() => ov.remove(), 400);
        showToast("🎉 Bienvenue sur כדאי !");
      } else { go(step + 1); }
    });
    prevBtn.addEventListener("click", () => go(step - 1));
    ov.querySelector(".onb-allow")?.addEventListener("click", () => {
      showToast("🔔 Notifications activées (démo)");
    });
    ov.querySelector(".onb-skip")?.addEventListener("click", () => nextBtn.click());
  }

  // ============== NOTIFICATIONS PANEL =======================================
  function updateNotifBadge() {
    const badge = document.getElementById("notif-count");
    if (!badge) return;
    const n = FEAT.notifs.filter(x => x.unread).length;
    if (n > 0) { badge.textContent = n; badge.hidden = false; }
    else { badge.hidden = true; }
  }
  function openNotifs() {
    let panel = document.getElementById("notifs-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "notifs-panel";
      panel.className = "side-panel notifs-panel";
      panel.innerHTML = `
        <div class="sp-head">
          <h3>🔔 Notifications</h3>
          <button class="modal-close" id="notifs-close">×</button>
        </div>
        <div class="sp-actions">
          <button class="link-btn" id="mark-all-read">Tout marquer comme lu</button>
        </div>
        <div class="sp-body" id="notifs-body"></div>
      `;
      document.body.appendChild(panel);
      panel.querySelector("#notifs-close").addEventListener("click", () => panel.classList.remove("open"));
      panel.querySelector("#mark-all-read").addEventListener("click", () => {
        FEAT.notifs.forEach(n => n.unread = false);
        renderNotifs();
        updateNotifBadge();
      });
    }
    renderNotifs();
    panel.classList.add("open");
  }
  function renderNotifs() {
    const body = document.getElementById("notifs-body");
    if (!body) return;
    body.innerHTML = FEAT.notifs.map(n => `
      <div class="notif-row ${n.unread ? "unread" : ""}" data-id="${n.id}">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-info">
          <div class="notif-title">${n.title}</div>
          <div class="notif-text">${n.text}</div>
          <div class="notif-time">${n.time}</div>
        </div>
      </div>`).join("");
    body.querySelectorAll(".notif-row").forEach(r => r.addEventListener("click", () => {
      const id = +r.dataset.id;
      const n = FEAT.notifs.find(x => x.id === id);
      if (n) { n.unread = false; renderNotifs(); updateNotifBadge(); }
    }));
  }

  // ============== PROFILE PANEL =============================================
  function openProfile() {
    let panel = document.getElementById("profile-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "profile-panel";
      panel.className = "side-panel profile-panel";
      document.body.appendChild(panel);
    }
    renderProfile(panel);
    panel.classList.add("open");
  }
  function renderProfile(panel) {
    const lvl = FAKE_USER.level;
    const earned = FAKE_ACHIEVEMENTS.filter(a => a.earned).length;
    panel.innerHTML = `
      <div class="sp-head">
        <h3>${FAKE_USER.avatar} Mon profil</h3>
        <button class="modal-close" id="profile-close">×</button>
      </div>
      <div class="sp-body">
        <div class="profile-hero">
          <div class="profile-avatar">${FAKE_USER.avatar}</div>
          <div class="profile-info">
            <div class="profile-name">${FAKE_USER.name}</div>
            <div class="profile-loc">📍 ${FAKE_USER.location}</div>
            <div class="profile-level">⭐ Niveau ${lvl} — Plus que ${FAKE_USER.next_level_in} deals pour le niveau ${lvl+1}</div>
            <div class="profile-progress"><div class="profile-progress-fill" style="width:${100 - (FAKE_USER.next_level_in * 10)}%"></div></div>
          </div>
        </div>
        <div class="profile-stats">
          <div class="pstat"><div class="pstat-value">${FAKE_USER.savings_this_month}₪</div><div class="pstat-label">Économisé ce mois</div></div>
          <div class="pstat"><div class="pstat-value">${FAKE_USER.savings_total}₪</div><div class="pstat-label">Total économies</div></div>
          <div class="pstat"><div class="pstat-value">${FAKE_USER.deals_used}</div><div class="pstat-label">Deals utilisés</div></div>
          <div class="pstat"><div class="pstat-value">🔥 ${FAKE_USER.streak_days}j</div><div class="pstat-label">Streak quotidien</div></div>
        </div>
        <div class="premium-banner ${FAKE_USER.is_premium ? "active" : ""}">
          <div class="premium-banner-info">
            <div class="premium-banner-title">👑 Passe Premium</div>
            <div class="premium-banner-sub">Alertes illimitées · pas de pub · 10₪/mois</div>
          </div>
          <button class="btn primary" id="upgrade-btn">Découvrir</button>
        </div>
        <h4 class="sp-section">🏆 Achievements (${earned}/${FAKE_ACHIEVEMENTS.length})</h4>
        <div class="achievements-grid">
          ${FAKE_ACHIEVEMENTS.map(a => `
            <div class="achievement ${a.earned ? "earned" : "locked"}">
              <div class="ach-icon">${a.icon}</div>
              <div class="ach-info">
                <div class="ach-title">${a.title}</div>
                <div class="ach-desc">${a.desc}</div>
                ${a.earned ? `<div class="ach-date">Obtenu ${a.date}</div>` : `<div class="ach-progress">${a.progress || ""}</div>`}
              </div>
            </div>`).join("")}
        </div>
        <h4 class="sp-section">⚙️ Paramètres</h4>
        <div class="profile-list">
          <button class="profile-row"><span>🔔</span> Notifications<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>🌍</span> Langue<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>📍</span> Adresse de livraison<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>💳</span> Cashback bancaire<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>🔒</span> Confidentialité<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>📄</span> CGU & Mentions<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>💬</span> Aide & support<span class="row-arrow">›</span></button>
          <button class="profile-row"><span>📱</span> À propos · v29 démo<span class="row-arrow">›</span></button>
        </div>
        <div class="profile-foot">Membre depuis ${FAKE_USER.member_since}</div>
      </div>`;
    panel.querySelector("#profile-close").addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("#upgrade-btn")?.addEventListener("click", openPremium);
    panel.querySelectorAll(".profile-row").forEach(r => r.addEventListener("click", () => showToast("Fonction démo")));
  }

  // ============== PREMIUM MODAL =============================================
  function openPremium() {
    let m = document.getElementById("premium-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "premium-modal";
      m.className = "modal";
      m.innerHTML = `
        <div class="modal-card premium-card">
          <button class="modal-close" id="premium-close" style="position:absolute;top:14px;right:14px;z-index:2">×</button>
          <div class="premium-hero"><div class="premium-crown">👑</div><h2>כדאי <span>Premium</span></h2><p>Économise encore plus, sans limite.</p></div>
          <ul class="premium-features">
            <li>✅ Alertes illimitées sur tes favoris</li>
            <li>✅ Comparateur de prix temps réel</li>
            <li>✅ Pas de publicités</li>
            <li>✅ Analyse de tes habitudes</li>
            <li>✅ Mode famille (5 comptes)</li>
            <li>✅ Cashback bonus +1%</li>
            <li>✅ Support prioritaire</li>
            <li>✅ Accès anticipé aux deals VIP</li>
          </ul>
          <div class="premium-plans">
            <button class="premium-plan"><div class="pp-name">Mensuel</div><div class="pp-price">10₪<span>/mois</span></div><div class="pp-sub">Sans engagement</div></button>
            <button class="premium-plan recommended"><span class="pp-badge">−25% 🔥</span><div class="pp-name">Annuel</div><div class="pp-price">89₪<span>/an</span></div><div class="pp-sub">Éco 31₪</div></button>
          </div>
          <div class="premium-foot">7 jours d'essai gratuit · annulable à tout moment</div>
        </div>`;
      document.body.appendChild(m);
      m.querySelector("#premium-close").addEventListener("click", () => m.classList.remove("open"));
      m.querySelectorAll(".premium-plan").forEach(p => p.addEventListener("click", () => {
        showToast("🎉 Essai 7 jours démarré (démo)");
        m.classList.remove("open");
      }));
    }
    m.classList.add("open");
  }

  // ============== CHAT IA PANEL =============================================
  function openChat() {
    let p = document.getElementById("chat-panel");
    if (!p) {
      p = document.createElement("div");
      p.id = "chat-panel";
      p.className = "chat-panel";
      p.innerHTML = `
        <div class="chat-head">
          <div class="chat-head-info"><div class="chat-avatar">🤖</div><div><div class="chat-name">Assistant כדאי</div><div class="chat-status"><span class="chat-dot"></span> En ligne</div></div></div>
          <button class="modal-close" id="chat-close">×</button>
        </div>
        <div class="chat-body" id="chat-body"></div>
        <div class="chat-suggestions" id="chat-sugg"></div>
        <div class="chat-input-row"><input id="chat-input" type="text" placeholder="Pose-moi une question..." /><button class="btn primary" id="chat-send">→</button></div>`;
      document.body.appendChild(p);
      p.querySelector("#chat-close").addEventListener("click", () => p.classList.remove("open"));
      p.querySelector("#chat-send").addEventListener("click", () => sendChat());
      p.querySelector("#chat-input").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
    }
    renderChat();
    p.classList.add("open");
  }
  function renderChat() {
    const body = document.getElementById("chat-body");
    const sugg = document.getElementById("chat-sugg");
    if (!body) return;
    body.innerHTML = FAKE_CHAT_MESSAGES.map(m => `<div class="chat-msg ${m.from}">${m.text.replace(/\n/g, "<br>")}</div>`).join("");
    sugg.innerHTML = FAKE_CHAT_SUGGESTIONS.map(s => `<button class="chat-sugg-btn">${s}</button>`).join("");
    sugg.querySelectorAll(".chat-sugg-btn").forEach(b => b.addEventListener("click", () => sendChat(b.textContent)));
    body.scrollTop = body.scrollHeight;
  }
  function sendChat(txt) {
    const input = document.getElementById("chat-input");
    const message = (txt || input.value).trim();
    if (!message) return;
    input.value = "";
    FAKE_CHAT_MESSAGES.push({ from: "me", text: message });
    renderChat();
    document.getElementById("chat-body").insertAdjacentHTML("beforeend", '<div class="chat-msg ai typing"><span></span><span></span><span></span></div>');
    setTimeout(() => {
      let reply = "Je suis en mode démo. Quand je serai connecté à Claude, je pourrai vraiment t'aider à analyser tes courses, trouver les meilleurs deals, suggérer des recettes selon ton budget, et plus encore !";
      const lm = message.toLowerCase();
      if (lm.includes("promo") || lm.includes("pâte")) reply = FAKE_AI_RESPONSES.promos;
      else if (lm.includes("recette") || lm.includes("soir")) reply = FAKE_AI_RESPONSES.recette;
      else if (lm.includes("magasin")) reply = FAKE_AI_RESPONSES.magasin;
      else if (lm.includes("shabbat") || lm.includes("samedi")) reply = FAKE_AI_RESPONSES.shabbat;
      FAKE_CHAT_MESSAGES.push({ from: "ai", text: reply });
      renderChat();
    }, 900);
  }

  // ============== FAVORITES (heart on cards) =================================
  function injectFavoriteButtons() {
    document.querySelectorAll(".prod-card:not([data-fav-injected])").forEach(card => {
      card.setAttribute("data-fav-injected", "1");
      const heart = document.createElement("button");
      heart.className = "fav-heart-btn";
      heart.innerHTML = "🤍";
      heart.setAttribute("aria-label", "Ajouter aux favoris");
      heart.addEventListener("click", e => {
        e.stopPropagation();
        const pid = card.dataset.pid || card.querySelector("[data-pid]")?.dataset.pid;
        toggleFav(pid, heart);
      });
      card.appendChild(heart);
    });
  }
  function toggleFav(pid, heart) {
    if (!pid) return;
    const i = FEAT.favorites.indexOf(pid);
    if (i >= 0) {
      FEAT.favorites.splice(i, 1);
      heart.innerHTML = "🤍";
      showToast("💔 Retiré des favoris");
    } else {
      FEAT.favorites.push(pid);
      heart.innerHTML = "❤️";
      heart.classList.add("burst");
      setTimeout(() => heart.classList.remove("burst"), 600);
      showToast("❤️ Ajouté ! Tu seras prévenu des promos");
    }
    setLS("kedai.favs", JSON.stringify(FEAT.favorites));
  }

  // ============== PULL-TO-REFRESH ===========================================
  function setupPullToRefresh() {
    let startY = 0, pull = 0, pulling = false;
    const ind = document.createElement("div");
    ind.className = "ptr-indicator";
    ind.innerHTML = '<div class="ptr-spinner">🔄</div><div class="ptr-text">Tirer pour rafraîchir</div>';
    document.body.appendChild(ind);
    document.addEventListener("touchstart", e => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (!pulling) return;
      pull = e.touches[0].clientY - startY;
      if (pull > 0 && pull < 150) {
        ind.style.transform = `translate(-50%, ${pull - 60}px) rotate(${pull * 2}deg)`;
        ind.classList.add("visible");
        ind.querySelector(".ptr-text").textContent = pull > 80 ? "Relâcher !" : "Tirer pour rafraîchir";
      }
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (pulling && pull > 80) {
        showToast("🔄 Rafraîchissement...");
        setTimeout(() => {
          if (window.renderPromosView) window.renderPromosView();
          showToast("✅ Promos à jour !");
        }, 800);
      }
      pulling = false; pull = 0;
      ind.classList.remove("visible");
      ind.style.transform = "";
    }, { passive: true });
  }

  // ============== SHARED HELPERS ============================================
  function shade(hex, p) {
    if (!hex || hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1), 16);
    const a = Math.round(2.55 * p);
    const R = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + a));
    const G = Math.min(255, Math.max(0, ((n >> 8)  & 0xff) + a));
    const B = Math.min(255, Math.max(0, ( n        & 0xff) + a));
    return "#" + ((R << 16) | (G << 8) | B).toString(16).padStart(6, "0");
  }
  function showToast(msg) {
    if (typeof window.showToast === "function" && window.showToast !== showToast) {
      window.showToast(msg);
      return;
    }
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show", "visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("show", "visible"), 2800);
  }

  // ============== CART GRAND TOTAL (fix: app.js renderCart pas sur window) =====
  let _lastCartSig = "";
  let _cachedCartEl = null, _cachedActionsEl = null;
  function ensureCartTotal() {
    const cart = _cachedCartEl || (_cachedCartEl = document.getElementById("cart"));
    const actions = _cachedActionsEl || (_cachedActionsEl = document.getElementById("cart-actions"));
    if (!cart || !actions) return;
    let bar = document.getElementById("cart-total-bar");
    // Calcule le total : on lit le state si dispo, sinon on additionne les .cart-item-total visibles
    let total = 0;
    let count = 0;
    let storeName = "";
    try {
      const state = window.state;
      const list = state?.lists?.[state?.activeListId];
      if (list?.cart) {
        const items = Object.entries(list.cart);
        count = items.filter(([, it]) => it && it.qty > 0).length;
        if (typeof window.computeStoreTotals === "function") {
          const totals = window.computeStoreTotals();
          // computeStoreTotals returns map {storeId: {store,total,...}}
          const arr = Object.values(totals || {}).filter(t => t.total > 0 && t.available > 0);
          arr.sort((a, b) => a.total - b.total);
          if (arr[0]) {
            total = arr[0].total;
            const S = (typeof STORES !== "undefined") ? STORES[arr[0].store] : null;
            storeName = S?.name || arr[0].store;
          }
        }
      }
    } catch {}

    // Fallback : somme des .cart-item-total visibles
    if (total === 0) {
      const totals = cart.querySelectorAll(".cart-item-total");
      totals.forEach(el => {
        const m = (el.textContent || "").match(/[\d.,]+/);
        if (m) total += parseFloat(m[0].replace(",", ".")) || 0;
      });
      count = cart.querySelectorAll(".cart-item:not(.done)").length;
    }

    if (count === 0 || total === 0) {
      if (bar) { bar.remove(); _lastCartSig = ""; }
      return;
    }

    const sig = `${count}|${total.toFixed(2)}|${storeName}`;
    if (sig === _lastCartSig && bar) return;  // change detection: skip redundant writes
    _lastCartSig = sig;

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cart-total-bar";
      bar.className = "cart-total-bar";
      actions.parentNode.insertBefore(bar, actions);
    }
    bar.innerHTML = `
      <div class="ctb-left">
        <div class="ctb-label">${count} article${count > 1 ? "s" : ""} ${storeName ? "· moins cher chez" : ""}</div>
        ${storeName ? `<div class="ctb-store" translate="no">🏪 ${storeName}</div>` : ""}
      </div>
      <div class="ctb-right">
        <div class="ctb-amount">₪${total.toFixed(2)}</div>
        <div class="ctb-hint">Total estimé</div>
      </div>`;
  }
  setInterval(ensureCartTotal, 600);

  // ============== BOOT ======================================================
  function boot() {
    injectTopActions();
    injectChatFab();
    injectStoriesBar();
    injectGlobalSearchInTopbar();
    setupPullToRefresh();
    // MutationObserver scoped — réagit aux nouveaux prod-card sans polling
    const setupFavObserver = () => {
      const containers = [
        document.getElementById("promos-list"),
        document.getElementById("big-deals-grid"),
        document.getElementById("browse-grid"),
        document.getElementById("favs-list"),
      ].filter(Boolean);
      if (containers.length === 0) { setTimeout(setupFavObserver, 400); return; }
      let scheduled = false;
      const obs = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; injectFavoriteButtons(); });
      });
      containers.forEach(c => obs.observe(c, { childList: true, subtree: false }));
      injectFavoriteButtons();
    };
    setupFavObserver();
    if (!FEAT.onboardingDone) setTimeout(showOnboarding, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 200));
  } else {
    setTimeout(boot, 200);
  }

  window.KEDAI_FEAT = FEAT;
  window.openOnboarding = () => { setLS("kedai.onboarded", ""); FEAT.onboardingDone = false; showOnboarding(); };
})();

// ============== v29 — Render BIG_STORES once (no polling) ====================
(function () {
  let rendered = false;
  function renderBigStoreChips() {
    if (rendered) return true;
    const el = document.getElementById("big-store-chips");
    if (!el || typeof BIG_STORES === "undefined") return false;
    const stores = BIG_STORES;
    const deals = (typeof BIG_DEALS !== "undefined") ? BIG_DEALS : [];
    const counts = {};
    deals.forEach(d => { counts[d.store] = (counts[d.store] || 0) + 1; });
    el.innerHTML = Object.entries(stores).map(([id, s]) => {
      const n = counts[id] || 0;
      return `
        <button class="store-chip" data-big-store="${id}" style="color:${s.color}">
          <div class="store-chip-logo" style="background:${s.color}">${s.icon || "🏪"}</div>
          <div class="store-chip-name" translate="no">${s.name}</div>
          ${n > 0 ? `<div class="store-chip-promos">${n} deals</div>` : ""}
        </button>`;
    }).join("");
    // Event delegation — un seul listener au lieu de N
    el.addEventListener("click", e => {
      const btn = e.target.closest(".store-chip[data-big-store]");
      if (!btn) return;
      const id = btn.dataset.bigStore;
      if (typeof window.showToast === "function") window.showToast("Catalogue " + (stores[id]?.name || id) + " (démo)");
    });
    rendered = true;
    return true;
  }
  // One-shot avec retry exponentiel jusqu'à 5s max (au cas où DOM/data pas prêts)
  function retry(delays) {
    if (renderBigStoreChips()) return;
    const d = delays.shift();
    if (d != null) setTimeout(() => retry(delays), d);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => retry([100, 300, 800, 2000]));
  } else {
    retry([100, 300, 800, 2000]);
  }
})();
