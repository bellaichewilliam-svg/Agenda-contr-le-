// ============================================================================
// Espace patron : agenda, attribution aux livreurs, refus motivé, disponibilité,
// position GPS, encaissements, livreurs partenaires, paiements hebdomadaires.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const LS_SEEN = "livraison.seenIds.v1";
Store.useSpace("admin");

let orders = [];
let couriers = [];
let me = null;
let settings = { accepting: true, message: "", commission: CONFIG.platform.commissionPerCourse };
let tab = "agenda";
let firstLoad = true;
let histFilter = { status: "", q: "" };
let billMonth = new Date().toISOString().slice(0, 7);
let weekOffset = 0;
let refusing = null;

// --- Connexion ------------------------------------------------------------------
function showLogin() {
  $("#dashboard").classList.add("hidden");
  $("#logoutBtn").classList.add("hidden");
  $("#loginForm").classList.remove("hidden");
  if (!Store.ONLINE) {
    $("#emailWrap").classList.add("hidden");
    $("#pwLabel").textContent = "Code d'accès";
    $("#loginHint").textContent = "Mode démo : le code est défini dans config.js (demoAdminPin). Seules les données de cet appareil sont visibles.";
  } else {
    $("#loginHint").textContent = "Connectez-vous avec votre compte patron (voir README).";
  }
}

async function onLogin(e) {
  e.preventDefault();
  const f = e.target;
  $("#loginError").classList.add("hidden");
  try {
    await Store.login(f.email.value.trim(), f.password.value);
    const who = await Store.me();
    if (!who || who.role !== "admin") {
      Store.logout();
      throw new Error("Ce compte n'est pas le compte patron. Les livreurs se connectent sur coursier.html.");
    }
    f.password.value = "";
    start();
  } catch (ex) {
    $("#loginError").textContent = ex.message;
    $("#loginError").classList.remove("hidden");
  }
}

// --- Chargement et alertes -----------------------------------------------------
function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN)) || []); } catch (e) { return new Set(); }
}
function writeSeen(ids) {
  try { localStorage.setItem(LS_SEEN, JSON.stringify([...ids])); } catch (e) { /* ignore */ }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) { /* audio indisponible */ }
}

function alertNew(list, title) {
  beep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (window.Notification && Notification.permission === "granted") {
    list.forEach(x => new Notification(title(x), { body: x.body || "" }));
  }
}

async function load() {
  try {
    [orders, couriers, settings] = await Promise.all([Store.listOrders(), Store.listCouriers(), Store.getSettings()]);
    me = couriers.find(c => c.id === (Store.session() || {}).user_id) || me;
  } catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.logout(); return showLogin(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  const seen = readSeen();
  const freshOrders = orders.filter(o => !seen.has(o.id) && o.status === "nouvelle");
  const freshCouriers = couriers.filter(c => !seen.has(c.id) && c.status === "en_attente");
  if (!firstLoad && freshOrders.length) {
    alertNew(freshOrders.map(o => ({ ref: o.ref, price: o.price, body: `${UI.whenFr(o)}\n${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)}` })),
      x => `🆕 Commande n° ${x.ref} — ${UI.money(x.price)}`);
  }
  if (!firstLoad && freshCouriers.length) alertNew(freshCouriers, c => `👤 Nouveau livreur : ${c.name}`);
  orders.forEach(o => seen.add(o.id));
  couriers.forEach(c => seen.add(c.id));
  writeSeen(seen);
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  renderAvail();
  // Ne pas effacer un champ en cours de saisie
  const typing = document.activeElement && $("#view").contains(document.activeElement)
    && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing) renderStats(); else render();
}

// --- Disponibilité (« je suis complet ») --------------------------------------------
function renderAvail() {
  const on = settings.accepting;
  $("#avail").classList.toggle("on", on);
  $("#availTitle").textContent = on ? "🟢 Je prends des commandes immédiates" : "🔴 Complet : les clients ne peuvent que programmer pour plus tard";
  $("#availBtn").textContent = on ? "Je suis complet" : "Je reprends les commandes";
  if (document.activeElement !== $("#availMsg")) $("#availMsg").value = settings.message || "";
}

async function toggleAvail() {
  const changes = { accepting: !settings.accepting, message: $("#availMsg").value.trim() || null };
  try {
    await Store.saveSettings(changes);
    Object.assign(settings, changes);
    renderAvail();
  } catch (e) { alert("Réglage non enregistré, vérifiez la connexion."); }
}

// --- En service : partage de la position GPS --------------------------------------
const duty = { watch: null, lastSent: 0, wakeLock: null };

async function sendPosition(pos) {
  const now = Date.now();
  if (now - duty.lastSent < 15000) return;
  duty.lastSent = now;
  try {
    await Store.ping(pos.coords.latitude, pos.coords.longitude);
    $("#dutyText").textContent = `Position envoyée à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · gardez cette page ouverte pendant la tournée.`;
  } catch (e) {
    $("#dutyText").textContent = "⚠️ Position non envoyée (connexion). Nouvel essai automatique.";
    duty.lastSent = 0;
  }
}

async function toggleDuty() {
  if (duty.watch != null) {
    navigator.geolocation.clearWatch(duty.watch);
    duty.watch = null;
    if (duty.wakeLock) { duty.wakeLock.release().catch(() => {}); duty.wakeLock = null; }
    renderDuty();
    return;
  }
  if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur ce téléphone.");
  duty.watch = navigator.geolocation.watchPosition(sendPosition, err => {
    $("#dutyText").textContent = err.code === 1
      ? "⚠️ Autorisez la localisation pour ce site dans les réglages du navigateur."
      : "⚠️ Position GPS introuvable pour le moment…";
  }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
  // Garder l'écran allumé : les navigateurs coupent le GPS quand l'écran s'éteint
  try { if (navigator.wakeLock) duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* facultatif */ }
  renderDuty();
}

function renderDuty() {
  const on = duty.watch != null;
  $("#duty").classList.toggle("on", on);
  $("#dutyTitle").textContent = on ? "🟢 En service — vos clients vous suivent sur la carte" : "⚪ Hors service";
  $("#dutyBtn").textContent = on ? "Terminer le service" : "Passer en service";
  if (!on) $("#dutyText").textContent = "Passez « en service » pour que vos clients vous voient sur la carte.";
}

// --- Outils ------------------------------------------------------------------------
const today = () => UI.dayKey(new Date().toISOString());
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const active = o => ["nouvelle", "confirmee", "recuperee"].includes(o.status);
const sum = (list, f = o => Number(o.price)) => list.reduce((s, o) => s + f(o), 0);
const isMine = o => me && o.courier_id === me.id;
const partners = () => couriers.filter(c => c.role !== "admin");

const { clientMessage, weekStart, addDays, fmtKey } = UI;

function tel(name, phone) {
  return phone ? `${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a>` : UI.esc(name || "");
}

// --- Carte d'une course -------------------------------------------------------------
function card(o, withDay) {
  const st = Store.STATUSES[o.status] || { label: o.status, icon: "" };
  const when = o.urgency === "programmee" ? UI.fmtTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS" : "Dès que possible";
  const nav = which => `<div class="links">
      <a class="btn btn-sm" href="${UI.wazeLink(o, which)}" target="_blank" rel="noopener">Waze</a>
      <a class="btn btn-sm" href="${UI.mapsLink(o, which)}" target="_blank" rel="noopener">Maps</a></div>`;

  let pickupExtra = "";
  if (o.service === "retrait") {
    pickupExtra = `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° <b style="display:inline">${UI.esc(o.tracking_number || "—")}</b> · au nom de ${UI.esc(o.parcel_name || "—")}${o.place_kind === "poste" ? ` · procuration : ${o.has_proxy ? "✅" : "❌ à demander"}` : ""}</div>`;
  } else if (o.service === "achat") {
    pickupExtra = `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.budget ? ` · budget ${UI.money(o.budget)} (à avancer)` : ""}</div>`;
  }

  const meta = [
    `<span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>`,
    `<span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>`,
    `<span class="pill ${o.payment_status === "paye" ? "paid" : "unpaid"}">${UI.PAY_FR[o.payment_method] || ""} · ${o.payment_status === "paye" ? "encaissé" : "à encaisser"}${o.payer === "destinataire" ? " (par le destinataire)" : ""}</span>`
  ];
  if (o.courier_id && !isMine(o)) meta.push(`<span class="pill courier-pill">🛵 ${UI.esc(o.courier_name || "Livreur")} · commission ${UI.money(o.commission || 0)}</span>`);
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(0)} km</span>`);
  if (o.promo_code) meta.push(`<span class="pill">🎁 ${UI.esc(o.promo_code)} −${UI.money(o.discount || 0)}</span>`);
  meta.push(`<span class="pill">👤 ${tel(o.contact_name, o.contact_phone)}${o.company ? " · " + UI.esc(o.company) : ""}</span>`);
  meta.push(`<span class="pill">${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>`);

  const b = (status, label, cls = "") => `<button class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
  const active = partners().filter(c => c.status === "actif");
  const steps = {
    nouvelle: `<button class="btn btn-sm btn-primary" data-act="take">✅ Je la prends</button>`
      + (active.length ? `<select class="btn btn-sm" data-act="assign"><option value="">👤 Donner à un livreur…</option>${active.map(c => `<option value="${UI.esc(c.id)}">${UI.esc(c.name)}</option>`).join("")}</select>` : "")
      + `<button class="btn btn-sm" data-act="refuse">🚫 Je ne peux pas</button>`,
    confirmee: b("recuperee", "🛵 Colis récupéré", "btn-primary") + `<button class="btn btn-sm" data-act="release">↩︎ Remettre en attente</button>` + b("annulee", "✖ Annuler"),
    recuperee: b("livree", "📦 Livré", "btn-primary")
  };

  return `
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}${when}</span>
      <span class="pill st-${UI.esc(o.status)}">${st.icon} ${st.label}</span>
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(o.price)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span>📍</span><div><b>${UI.esc(o.pickup_address)}, ${UI.esc(UI.cityFr(o.from_city))}</b>${pickupExtra}<span class="small muted">${tel(o.pickup_contact, o.pickup_phone)}</span>${nav("pickup")}</div></div>
      <div class="leg"><span>🏁</span><div><b>${UI.esc(o.dropoff_address)}, ${UI.esc(UI.cityFr(o.to_city))}</b><span class="small muted">${tel(o.dropoff_contact, o.dropoff_phone)}</span>${nav("dropoff")}</div></div>
    </div>
    <div class="meta">${meta.join("")}</div>
    ${o.notes ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="actions">
      ${steps[o.status] || ""}
      ${!["annulee", "refusee"].includes(o.status) ? `<button class="btn btn-sm" data-act="paid">${o.payment_status === "paye" ? "↩︎ Non encaissé" : "💵 Encaissé"}</button>` : ""}
      <a class="btn btn-sm btn-wa" data-wa="client" href="${UI.waLink(o.contact_phone, clientMessage(o))}" target="_blank" rel="noopener">💬 Client</a>
      ${o.dropoff_phone && !["annulee", "refusee"].includes(o.status) ? `<a class="btn btn-sm btn-wa" href="${UI.waLink(o.dropoff_phone, I18N.forLang(o.lang || "fr", "trShareMsg", { url: UI.trackUrl(o) }))}" target="_blank" rel="noopener">💬 Destinataire</a>` : ""}
      ${o.courier_phone && !isMine(o) ? `<a class="btn btn-sm btn-wa" href="${UI.waLink(o.courier_phone, `Course n° ${o.ref} — `)}" target="_blank" rel="noopener">💬 Livreur</a>` : ""}
      <a class="btn btn-sm" href="${UI.trackUrl(o)}" target="_blank" rel="noopener">📍 Suivi</a>
      ${o.receipt_number ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}" target="_blank" rel="noopener">🧾 Reçu n° ${o.receipt_number}</a>` : ""}
      ${o.receipt_number && o.contact_email ? `<a class="btn btn-sm" href="mailto:${UI.esc(o.contact_email)}?subject=${encodeURIComponent(`Reçu n° ${o.receipt_number} · קבלה מס' ${o.receipt_number}`)}&body=${encodeURIComponent(UI.clientMessage(o))}">✉️ Reçu par mail</a>` : ""}
      <button class="btn btn-sm" data-act="price">✏️ Prix</button>
      <button class="btn btn-sm" data-act="ics">📅</button>
      <textarea class="admin-note" data-act="note" rows="1" placeholder="Message visible par le client sur la page de suivi…">${UI.esc(o.admin_note || "")}</textarea>
    </div>
  </article>`;
}

function groupedByDay(list) {
  const groups = {};
  list.forEach(o => { (groups[UI.dayKey(o.pickup_at)] = groups[UI.dayKey(o.pickup_at)] || []).push(o); });
  const t = today();
  return Object.keys(groups).sort().map(k => {
    const label = k === t ? "Aujourd'hui" : k < t ? `En retard — ${UI.fmtDay(groups[k][0].pickup_at)}` : UI.fmtDay(groups[k][0].pickup_at);
    return `<div class="day-title">${label} · ${groups[k].length} course(s) · ${UI.money(sum(groups[k]))}</div><div class="orders">${groups[k].sort(byTime).map(o => card(o)).join("")}</div>`;
  }).join("");
}

function agendaList() {
  const t = today();
  return orders.filter(o => !["annulee", "refusee"].includes(o.status) && (active(o) || UI.dayKey(o.pickup_at) >= t));
}

function renderStats() {
  const t = today(), month = t.slice(0, 7);
  $("#stNew").textContent = orders.filter(o => o.status === "nouvelle").length;
  $("#stToday").textContent = orders.filter(o => UI.dayKey(o.pickup_at) === t && !["annulee", "refusee"].includes(o.status)).length;
  $("#stUnpaid").textContent = UI.money(sum(orders.filter(o => isMine(o) && o.payment_status !== "paye" && ["confirmee", "recuperee", "livree"].includes(o.status))));
  // Chiffre du mois = vos courses + les commissions des livreurs
  const delivered = orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(month));
  $("#stMonthRev").textContent = UI.money(sum(delivered.filter(isMine)) + sum(delivered.filter(o => !isMine(o)), o => Number(o.commission || 0)));
  const pending = couriers.filter(c => c.status === "en_attente").length;
  $("#pendingBadge").textContent = pending ? `(${pending})` : "";
}

function render() {
  renderStats();
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;

  if (tab === "agenda") {
    const list = agendaList();
    view.innerHTML = list.length ? groupedByDay(list) : empty('Aucune course à venir. Partagez votre page avec le <a href="kit.html">kit pub</a> !');
  } else if (tab === "nouvelles") {
    const list = orders.filter(o => o.status === "nouvelle").sort(byTime);
    view.innerHTML = list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course à accepter 👍");
  } else if (tab === "livreurs") {
    renderCouriers(view);
  } else if (tab === "hebdo") {
    renderWeek(view);
  } else if (tab === "historique") {
    const q = histFilter.q.toLowerCase();
    const list = orders
      .filter(o => !histFilter.status || o.status === histFilter.status)
      .filter(o => !q || [o.ref, o.company, o.contact_name, o.contact_phone, o.pickup_address, o.dropoff_address, o.courier_name].join(" ").toLowerCase().includes(q))
      .sort((a, b) => byTime(b, a));
    view.innerHTML = `<div class="toolbar">
        <select id="histStatus"><option value="">Tous les statuts</option>${Object.entries(Store.STATUSES).map(([k, s]) => `<option value="${k}" ${histFilter.status === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
        <input id="histQ" type="search" placeholder="Rechercher (n°, client, téléphone, adresse, livreur)" value="${UI.esc(histFilter.q)}" />
      </div>
      ${list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course.")}`;
  } else {
    renderBilling(view);
  }
}

// --- Livreurs partenaires ----------------------------------------------------------
function expiryPill(label, date) {
  if (!date) return `<span class="pill unpaid">${label} : date manquante</span>`;
  const expired = date < today();
  return `<span class="pill ${expired ? "st-annulee" : "paid"}">${label} ${expired ? "EXPIRÉ" : "valable"} jusqu'au ${UI.esc(new Date(date).toLocaleDateString("fr-FR"))}</span>`;
}

function renderCouriers(view) {
  const list = partners().sort((a, b) => ["en_attente", "actif", "suspendu"].indexOf(a.status) - ["en_attente", "actif", "suspendu"].indexOf(b.status));
  const invite = UI.appUrl("coursier.html");
  const statusLabel = { en_attente: "⏳ En attente", actif: "✅ Actif", suspendu: "⛔ Suspendu" };
  view.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <b>Recruter des livreurs</b>
      <p class="muted small" style="margin:4px 0 8px">Envoyez ce lien : ils s'inscrivent, acceptent les conditions (permis, assurance…), puis vous les validez ici après avoir vu leurs documents. Vous prenez ${UI.money(settings.commission)} par course livrée, réglés chaque semaine.</p>
      <div class="promo-row"><input readonly value="${UI.esc(invite)}" dir="ltr" /><a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waShare(`Tu as un scooter, une voiture ou un vélo ? Deviens livreur partenaire chez ${CONFIG.businessName} : tu choisis tes courses, tu encaisses directement le client, et seulement ${UI.money(settings.commission)} de commission par course. Inscription : ${invite}`)}">Partager</a></div>
    </div>
    ${list.length ? `<div class="orders">${list.map(c => {
      const done = orders.filter(o => o.courier_id === c.id && o.status === "livree").length;
      return `<article class="order${c.status === "en_attente" ? " is-new" : ""}" data-courier="${UI.esc(c.id)}">
        <div class="order-head">
          <span class="order-time">${UI.esc(c.name)}</span>
          <span class="pill">${statusLabel[c.status] || c.status}</span>
          <span class="order-ref">${done} course(s) livrée(s)</span>
        </div>
        <div class="kv">
          <div><span>📞</span><span>${tel("", c.phone)}${c.bit_phone ? ` · Bit ${UI.esc(c.bit_phone)}` : ""}${c.city ? " · " + UI.esc(UI.cityFr(c.city)) : ""}</span></div>
          <div><span>🛵</span><span>${UI.esc(c.vehicle || "—")} · permis n° ${UI.esc(c.license_number || "—")} · assurance ${UI.esc(c.insurance || "—")}${c.business_number ? ` · n° d'entreprise ${UI.esc(c.business_number)}` : ""}</span></div>
          <div><span>📝</span><span>Conditions acceptées le ${c.accepted_terms_at ? UI.esc(new Date(c.accepted_terms_at).toLocaleDateString("fr-FR")) : "—"}</span></div>
        </div>
        <div class="meta">${expiryPill("Permis", c.license_expiry)}${expiryPill("Assurance", c.insurance_expiry)}</div>
        <div class="actions">
          ${c.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-cact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-cact="suspendu">⛔ Suspendre</button>`}
          <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(c.phone, c.status === "en_attente"
            ? `Bonjour ${c.name}, merci pour ton inscription chez ${CONFIG.businessName} ! Pour valider ton compte, envoie-moi en photo : permis de conduire, carte grise, attestation d'assurance et carte d'identité.`
            : `Bonjour ${c.name}, `)}">💬 WhatsApp</a>
          <textarea class="admin-note" data-cact="note" rows="1" placeholder="Note interne (documents vérifiés, remarques…)">${UI.esc(c.admin_note || "")}</textarea>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun livreur inscrit pour l'instant.</div>`}`;
}

// --- Paiements de la semaine ----------------------------------------------------------
function renderWeek(view) {
  const start = addDays(weekStart(today()), 7 * weekOffset);
  const end = addDays(start, 6);
  const inWeek = o => { const k = UI.dayKey(o.pickup_at); return o.status === "livree" && k >= start && k <= end; };
  const rows = partners().map(c => {
    const list = orders.filter(o => o.courier_id === c.id && inWeek(o));
    const due = list.filter(o => o.commission_status !== "regle");
    return { c, list, due, collected: sum(list), commission: sum(list, o => Number(o.commission || 0)), dueAmount: sum(due, o => Number(o.commission || 0)) };
  }).filter(r => r.list.length);
  const total = rows.reduce((s, r) => s + r.dueAmount, 0);
  view.innerHTML = `<div class="toolbar">
      <button class="btn btn-sm" data-week="-1">◀</button>
      <b>Semaine du ${fmtKey(start)} au ${fmtKey(end)}</b>
      <button class="btn btn-sm" data-week="1" ${weekOffset >= 0 ? "disabled" : ""}>▶</button>
      <span class="small muted">Les livreurs encaissent les clients directement et vous versent ${UI.money(settings.commission)} par course livrée, une fois par semaine.</span>
    </div>
    <table class="bill">
      <thead><tr><th>Livreur</th><th class="num">Courses</th><th class="num">Encaissé par lui</th><th class="num">Commission</th><th class="num">Reste à verser</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr data-courier="${UI.esc(r.c.id)}"><td><b>${UI.esc(r.c.name)}</b><br><span class="small muted">${UI.esc(r.c.phone)}</span></td>
        <td class="num">${r.list.length}</td><td class="num">${UI.money(r.collected)}</td><td class="num">${UI.money(r.commission)}</td>
        <td class="num"><b>${r.dueAmount ? UI.money(r.dueAmount) : "✓ réglé"}</b></td>
        <td class="num" style="white-space:nowrap">
          <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(r.c.phone, `Bonjour ${r.c.name}, récapitulatif de la semaine du ${fmtKey(start)} au ${fmtKey(end)} : ${r.list.length} course(s) livrée(s), ${UI.money(r.collected)} encaissés. Commission à me verser : ${UI.money(r.dueAmount)} (Bit au ${CONFIG.bitPhone}). Merci et bravo !`)}">Envoyer</a>
          ${r.dueAmount ? `<button class="btn btn-sm" data-settle="${UI.esc(r.c.id)}">✓ Réglé</button>` : ""}
        </td></tr>`).join("") || `<tr><td colspan="6" class="muted">Aucune course livrée par un livreur partenaire cette semaine.</td></tr>`}</tbody>
      <tfoot><tr><th>Total à recevoir</th><th></th><th></th><th></th><th class="num">${UI.money(total)}</th><th></th></tr></tfoot>
    </table>`;
  view.dataset.weekStart = start;
}

// --- Facturation clients -------------------------------------------------------------
function monthOrders() {
  return orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(billMonth));
}

function renderBilling(view) {
  const list = monthOrders();
  const byClient = {};
  list.forEach(o => {
    const key = o.company || o.contact_name;
    const c = byClient[key] = byClient[key] || { n: 0, total: 0, unpaid: 0, phone: o.contact_phone };
    c.n++; c.total += Number(o.price);
    if (o.payment_status !== "paye") c.unpaid += Number(o.price);
  });
  const rows = Object.entries(byClient).sort((a, b) => b[1].total - a[1].total);
  const bit = sum(list.filter(o => o.payment_method === "bit")), cash = sum(list.filter(o => o.payment_method === "cash"));
  view.innerHTML = `<div class="toolbar">
      <label class="small muted">Mois <input type="month" id="billMonth" value="${billMonth}" /></label>
      <button class="btn btn-sm" id="csvBtn" ${list.length ? "" : "disabled"}>⬇️ Export CSV</button>
      <span class="small muted">💵 Espèces ${UI.money(cash)} · 📱 Bit ${UI.money(bit)} (toutes courses, livreurs compris)</span>
    </div>
    <table class="bill">
      <thead><tr><th>Client</th><th class="num">Courses</th><th class="num">Montant</th><th class="num">Reste dû</th><th></th></tr></thead>
      <tbody>${rows.map(([name, c]) => `<tr><td><b>${UI.esc(name)}</b><br><span class="small muted">${UI.esc(c.phone || "")}</span></td><td class="num">${c.n}</td><td class="num"><b>${UI.money(c.total)}</b></td><td class="num">${c.unpaid ? UI.money(c.unpaid) : "✓"}</td>
        <td class="num"><a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(c.phone, `Bonjour, récapitulatif de vos courses ${billMonth} : ${c.n} course(s), total ${UI.money(c.total)}${c.unpaid ? `, reste à régler ${UI.money(c.unpaid)} (espèces ou Bit au ${CONFIG.bitPhone})` : ""}. Merci !`)}">Envoyer</a></td></tr>`).join("")
        || `<tr><td colspan="5" class="muted">Aucune course livrée ce mois-ci.</td></tr>`}</tbody>
      <tfoot><tr><th>Total</th><th class="num">${list.length}</th><th class="num">${UI.money(sum(list))}</th><th class="num">${UI.money(rows.reduce((s, r) => s + r[1].unpaid, 0))}</th><th></th></tr></tfoot>
    </table>`;
}

// --- Exports et itinéraire ---------------------------------------------------------
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  const cols = ["ref", "pickup_at", "company", "contact_name", "contact_phone", "service", "from_city", "to_city", "price", "promo_code", "payment_method", "payment_status", "courier_name", "commission"];
  const cell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [cols.join(";")].concat(monthOrders().sort(byTime).map(o =>
    cols.map(c => cell(c === "pickup_at" ? UI.fmtDateTime(o[c]) : c.endsWith("_city") ? UI.cityFr(o[c]) : o[c])).join(";")));
  download(`courses-${billMonth}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

function icsEvent(o) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escTxt = s => String(s || "").replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const start = new Date(o.pickup_at);
  return [
    "BEGIN:VEVENT",
    `UID:${o.ref}@livraison`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start.getTime() + 60 * 60000)}`,
    `SUMMARY:${escTxt(`🛵 n° ${o.ref} · ${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.money(o.price)}`)}`,
    `LOCATION:${escTxt(UI.placeQuery(o, "pickup"))}`,
    `DESCRIPTION:${escTxt(UI.orderText(o))}`,
    "END:VEVENT"
  ].join("\r\n");
}

function exportIcs(list) {
  if (!list.length) return alert("Aucune course à exporter.");
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Livraison//FR", ...list.map(icsEvent), "END:VCALENDAR"].join("\r\n");
  download(list.length === 1 ? `${list[0].ref}.ics` : "courses.ics", body, "text/calendar");
}

// Google Maps : vos arrêts restants du jour, dans l'ordre des horaires
function openRoute() {
  const t = today();
  const stops = [];
  orders.filter(o => isMine(o) && ["confirmee", "recuperee"].includes(o.status) && UI.dayKey(o.pickup_at) <= t).sort(byTime).forEach(o => {
    if (o.status === "confirmee") stops.push(UI.placeQuery(o, "pickup"));
    stops.push(UI.placeQuery(o, "dropoff"));
  });
  if (!stops.length) return alert("Aucune de vos courses acceptées à faire aujourd'hui.");
  const dest = stops.pop();
  const url = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest)
    + (stops.length ? "&waypoints=" + encodeURIComponent(stops.slice(0, 9).join("|")) : "");
  window.open(url, "_blank", "noopener");
}

// --- Actions ---------------------------------------------------------------------------
async function change(o, changes) {
  try {
    await Store.updateOrder(o.id, changes);
    Object.assign(o, changes);
    render();
    return true;
  } catch (e) {
    alert("La modification n'a pas pu être enregistrée.");
    return false;
  }
}

// Met en avant le bouton WhatsApp « Client » après un changement à annoncer
function highlightClientWa(o) {
  const a = document.querySelector(`article[data-id="${o.id}"] [data-wa="client"]`);
  if (a) { a.style.outline = "3px solid var(--brand)"; a.scrollIntoView({ block: "nearest" }); }
}

function orderOf(el) {
  const art = el.closest("article.order");
  return art && orders.find(o => o.id === art.dataset.id);
}

async function assignTo(o, courier) {
  try {
    await Store.assignOrder(o.id, courier);
    await load();
    const fresh = orders.find(x => x.id === o.id);
    if (fresh) highlightClientWa(fresh);
  } catch (e) { alert("Attribution impossible, vérifiez la connexion."); }
}

async function onViewClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.id === "csvBtn") return exportCsv();
  if (el.dataset.week) { weekOffset = Math.min(0, weekOffset + Number(el.dataset.week)); return render(); }
  if (el.dataset.settle) {
    const start = $("#view").dataset.weekStart, end = addDays(start, 6);
    const ids = orders.filter(o => o.courier_id === el.dataset.settle && o.status === "livree" && o.commission_status !== "regle"
      && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end).map(o => o.id);
    try { await Store.settleOrders(ids); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.cact) {
    const id = el.closest("[data-courier]").dataset.courier;
    try { await Store.updateCourier(id, { status: el.dataset.cact }); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  const o = orderOf(el);
  if (!o) return;
  if (el.dataset.status) {
    if (el.dataset.status === "annulee" && !confirm(`Annuler la course n° ${o.ref} ?`)) return;
    const changes = { status: el.dataset.status };
    // Le paiement se fait en général à la livraison : le noter déclenche aussi le reçu
    if (changes.status === "livree" && o.payment_status !== "paye" && confirm(`Livré ! Avez-vous encaissé ${UI.money(o.price)} ?`)) changes.payment_status = "paye";
    if (await change(o, changes)) {
      if (changes.payment_status) await load();
      highlightClientWa(orders.find(x => x.id === o.id) || o);
    }
  } else if (el.dataset.act === "take") {
    if (duty.watch == null && confirm("Course prise. Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
    assignTo(o, me);
  } else if (el.dataset.act === "refuse") {
    refusing = o;
    $("#refuseForm").reset();
    $("#refuseModal").classList.remove("hidden");
  } else if (el.dataset.act === "release") {
    change(o, { status: "nouvelle", courier_id: null, courier_name: null, courier_phone: null, courier_bit: null, commission: 0 });
  } else if (el.dataset.act === "paid") {
    change(o, { payment_status: o.payment_status === "paye" ? "en_attente" : "paye" });
  } else if (el.dataset.act === "price") {
    const v = prompt(`Nouveau prix pour la course n° ${o.ref} (${CONFIG.currency})`, o.price);
    const n = parseFloat(String(v).replace(",", "."));
    if (v != null && isFinite(n) && n >= 0) change(o, { price: n });
  } else if (el.dataset.act === "ics") {
    exportIcs([o]);
  }
}

async function onRefuse(e) {
  e.preventDefault();
  const f = e.target;
  const o = refusing;
  const key = f.reason.value;
  const reason = key === "autre" ? f.other.value.trim() : I18N.forLang(o.lang || "fr", key);
  if (!reason) return f.other.focus();
  $("#refuseModal").classList.add("hidden");
  // La course quitte l'agenda : on ouvre tout de suite WhatsApp avec le message au client
  const wa = window.open("", "_blank");
  if (await change(o, { status: "refusee", admin_note: reason })) {
    if (wa) wa.location.href = UI.waLink(o.contact_phone, clientMessage(o));
  } else if (wa) wa.close();
}

async function onViewChange(e) {
  const t = e.target;
  if (t.dataset.act === "note") {
    const o = orderOf(t);
    if (o && (o.admin_note || "") !== t.value) change(o, { admin_note: t.value.trim() || null });
  } else if (t.dataset.act === "assign" && t.value) {
    const o = orderOf(t);
    const c = couriers.find(x => x.id === t.value);
    if (o && c) assignTo(o, c);
  } else if (t.dataset.cact === "note") {
    const id = t.closest("[data-courier]").dataset.courier;
    Store.updateCourier(id, { admin_note: t.value.trim() || null }).catch(() => alert("Note non enregistrée."));
  } else if (t.id === "histStatus") { histFilter.status = t.value; render(); }
  else if (t.id === "billMonth") { billMonth = t.value; render(); }
}

function onViewInput(e) {
  if (e.target.id !== "histQ") return;
  histFilter.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const q = $("#histQ");
  q.focus();
  q.setSelectionRange(pos, pos);
}

// --- Démarrage ------------------------------------------------------------------
let pollTimer;
async function start() {
  $("#loginForm").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#logoutBtn").classList.remove("hidden");
  try { me = await Store.me(); } catch (e) { /* rechargé par load() */ }
  renderDuty();
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 15000);
}

$("#loginForm").addEventListener("submit", onLogin);
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); clearInterval(pollTimer); Store.logout(); showLogin(); });
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; render(); } });
$("#reloadBtn").addEventListener("click", load);
$("#routeBtn").addEventListener("click", openRoute);
$("#dutyBtn").addEventListener("click", toggleDuty);
$("#availBtn").addEventListener("click", toggleAvail);
$("#refuseForm").addEventListener("submit", onRefuse);
$("#refuseCancel").addEventListener("click", () => $("#refuseModal").classList.add("hidden"));
$("#icsBtn").addEventListener("click", () => exportIcs(agendaList().filter(o => active(o) && isMine(o)).sort(byTime)));
$("#notifBtn").addEventListener("click", () => {
  if (!window.Notification) return alert("Les notifications ne sont pas disponibles sur ce navigateur.");
  Notification.requestPermission().then(p => {
    $("#notifBtn").textContent = p === "granted" ? "🔔 Alertes activées" : "🔕 Alertes refusées";
    if (p === "granted") beep();
  });
});
$("#view").addEventListener("click", onViewClick);
$("#view").addEventListener("change", onViewChange);
$("#view").addEventListener("input", onViewInput);
window.addEventListener("storage", e => { if (/livraison\.(orders|couriers)/.test(e.key || "") && Store.session()) load(); });
document.addEventListener("visibilitychange", async () => {
  // Le verrou d'écran est relâché quand on quitte la page : le reprendre au retour
  if (document.visibilityState === "visible" && duty.watch != null && navigator.wakeLock) {
    try { duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
if (Store.session()) start(); else showLogin();

})();
