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
let shops = [];
let requests = [];
let sales = [];
let msgs = { messages: [], replies: [] };
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
    // Commerces et messages : un souci ici ne doit pas bloquer les courses
    const [sh, m, rq, sa] = await Promise.all([Store.listShops().catch(() => null), Store.listMessages().catch(() => null),
      Store.listRequests().catch(() => null), Store.listCarnetSales().catch(() => null)]);
    if (sh) shops = sh;
    if (sa) sales = sa;
    if (rq) requests = rq;
    if (m) msgs = m;
    me = couriers.find(c => c.id === (Store.session() || {}).user_id) || me;
  } catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.logout(); return showLogin(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  const seen = readSeen();
  const freshOrders = orders.filter(o => !seen.has(o.id) && o.status === "nouvelle");
  const freshCouriers = couriers.filter(c => !seen.has(c.id) && c.status === "en_attente");
  const freshShops = shops.filter(x => !seen.has(x.id) && x.status === "en_attente");
  const freshReqs = requests.filter(x => !seen.has(x.id) && x.status === "nouvelle");
  // Souci signalé par un livreur : alerte une seule fois par souci
  const freshIssues = orders.filter(o => o.issue && o.issue_at && !seen.has("issue:" + o.id + o.issue_at));
  if (!firstLoad && freshOrders.length) {
    alertNew(freshOrders.map(o => ({ ref: o.ref, price: o.price, body: `${UI.whenFr(o)}\n${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)}` })),
      x => `🆕 Commande n° ${x.ref} — ${UI.money(x.price)}`);
  }
  if (!firstLoad && freshCouriers.length) alertNew(freshCouriers, c => `👤 Nouveau livreur : ${c.name}`);
  if (!firstLoad && freshShops.length) alertNew(freshShops, x => `🏪 Nouveau commerce : ${x.name}`);
  orders.forEach(o => seen.add(o.id));
  couriers.forEach(c => seen.add(c.id));
  shops.forEach(x => seen.add(x.id));
  requests.forEach(x => seen.add(x.id));
  if (!firstLoad && freshReqs.length) alertNew(freshReqs, x => `📝 Demande de devis : ${x.company || x.name}`);
  if (!firstLoad && freshIssues.length) alertNew(freshIssues, o => `⚠️ Souci course n° ${o.ref} : ${o.issue}`);
  orders.filter(o => o.issue && o.issue_at).forEach(o => seen.add("issue:" + o.id + o.issue_at));
  writeSeen(seen);
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  await refreshChats();
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
// Solde d'un livreur (même calcul que la base) : commissions − courses payées à HOP − bonus, non réglés
function balanceOf(id) {
  return sum(orders.filter(o => o.courier_id === id && o.status === "livree" && o.commission_status !== "regle"),
      o => Number(o.commission || 0) - (o.paid_to === "hop" && o.payment_status === "paye" ? Number(o.price) : 0))
    - sum(orders.filter(o => o.referrer_id === id && o.status === "livree" && o.referral_status !== "regle"), o => Number(o.referral_bonus || 0));
}

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
  if (o.courier_id && !isMine(o) && !["annulee", "refusee"].includes(o.status)) {
    meta.push(`<button class="pill pill-btn ${o.paid_to === "hop" ? "paid" : ""}" data-act="paidto" title="Qui a reçu l'argent du client ?">${o.paid_to === "hop" ? "💳 Payée à HOP (reversée au livreur)" : "🛵 Payée au livreur"} ⇄</button>`);
  }
  if (o.issue) meta.push(`<button class="pill pill-btn st-annulee" data-act="issue" title="Cliquer quand le souci est réglé">⚠️ Souci signalé par le livreur : ${UI.esc(o.issue)} · ✓ réglé ?</button>`);
  if (o.leave_at_door) meta.push(`<span class="pill">🚪 Devant la porte : photo obligatoire</span>`);
  if (o.courier_id && !isMine(o) && ["confirmee", "recuperee"].includes(o.status)) {
    meta.push(`<button class="pill pill-btn ${o.unlocked ? "paid" : ""}" data-act="unlock" title="Laisser le livreur valider « Livré » sans GPS ni photo">${o.unlocked ? "🔓 Débloquée (cliquer pour rebloquer)" : "🔓 Débloquer la course"}</button>`);
  }
  if (o.payment_method === "carnet") meta.push(`<span class="pill paid">🎟️ Carnet pro</span>`);
  if (o.prepaid_required) meta.push(`<span class="pill ${o.payment_status === "paye" ? "paid" : "st-annulee"}">💳 Payée d'avance : ${o.payment_status === "paye" ? "reçu ✓" : "EN ATTENTE"}</span>`);
  if (o.shop_name) {
    const ref = couriers.find(c => c.id === o.referrer_id);
    meta.push(`<span class="pill star-pill">🏪 ${UI.esc(o.shop_name)}${ref && ref.role !== "admin" ? ` · parrain ${UI.esc(ref.name)} +${UI.money(o.referral_bonus || 0)}` : ""}</span>`);
  }
  if (o.courier_id && !isMine(o)) meta.push(`<span class="pill courier-pill">🛵 ${UI.esc(o.courier_name || "Livreur")} · commission ${UI.money(o.commission || 0)}</span>`);
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(0)} km</span>`);
  if (o.promo_code) meta.push(`<span class="pill">🎁 ${UI.esc(o.promo_code)} −${UI.money(o.discount || 0)}</span>`);
  meta.push(`<span class="pill">👤 ${tel(o.contact_name, o.contact_phone)}${o.company ? " · " + UI.esc(o.company) : ""}</span>`);
  meta.push(`<span class="pill">${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>`);

  const b = (status, label, cls = "") => `<button class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
  // Livreurs actifs, le plus proche du départ en premier (position GPS de moins de 10 min)
  const fresh = c => c.lat != null && c.position_at && Date.now() - new Date(c.position_at) < 10 * 60000;
  const km = c => fresh(c) && o.pickup_lat != null ? Pricing.haversineKm({ lat: c.lat, lon: c.lon }, { lat: o.pickup_lat, lon: o.pickup_lon }) * 1.3 : null;
  const active = partners().filter(c => c.status === "actif")
    .map(c => ({ c, km: km(c) })).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  const steps = {
    nouvelle: `<button class="btn btn-sm btn-primary" data-act="take">✅ Je la prends</button>`
      + (active.length ? `<select class="btn btn-sm" data-act="assign"><option value="">👤 Donner à un livreur…</option>${active.map(({ c, km }) => `<option value="${UI.esc(c.id)}">${UI.esc(c.name)}${km != null ? ` · 📍 ${km.toFixed(1)} km` : " · hors service"}${balanceOf(c.id) > Number(settings.max_debt) ? " · 🔒 solde dû" : ""}</option>`).join("")}</select>` : "")
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
      <div class="leg"><span>📍</span><div>${UI.brand(o.pickup_place)}<b><bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(UI.cityFr(o.from_city))}</b>${UI.addrDetails(o, "pickup")}${UI.addrNote(o.pickup_note)}${pickupExtra}<span class="small muted">${tel(o.pickup_contact, o.pickup_phone)}</span>${nav("pickup")}</div></div>
      <div class="leg"><span>🏁</span><div>${UI.brand(o.dropoff_place)}<b><bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(UI.cityFr(o.to_city))}</b>${UI.addrDetails(o, "dropoff")}${UI.addrNote(o.dropoff_note)}${UI.doorTag(o)}<span class="small muted">${tel(o.dropoff_contact, o.dropoff_phone)}</span>${nav("dropoff")}</div></div>
    </div>
    <div class="meta">${meta.join("")}</div>
    ${o.notes ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="actions">
      ${steps[o.status] || ""}
      ${!["annulee", "refusee"].includes(o.status) ? `<button class="btn btn-sm" data-act="paid">${o.payment_status === "paye" ? "↩︎ Non encaissé" : "💵 Encaissé"}</button>` : ""}
      ${chatBtn("o:" + o.id, `Course n° ${o.ref}`, `${o.contact_name || "Client"} · ${o.lang === "he" ? "hébreu 🇮🇱" : "français 🇫🇷"}${o.courier_name && !isMine(o) ? " · livreur " + o.courier_name : ""}`, "💬 Client")}
      ${o.courier_id && !isMine(o) ? chatBtn("c:" + o.courier_id, `Livreur : ${o.courier_name || ""}`, "Vos messages avec ce livreur", "💬 Livreur", `Course n° ${o.ref} — `) : ""}
      ${o.leave_at_door && ["recuperee", "livree"].includes(o.status) ? chatBtn("o:" + o.id, `Course n° ${o.ref}`, "Photo du dépôt devant la porte", "📷 Photo du dépôt", I18N.forLang(o.lang || "fr", "msg_door", { name: o.dropoff_contact || o.contact_name || "", ref: o.ref }), true) : ""}
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
  const pendingShops = shops.filter(x => x.status === "en_attente").length;
  $("#shopsBadge").textContent = pendingShops ? `(${pendingShops})` : "";
  const newReqs = requests.filter(x => x.status === "nouvelle").length;
  $("#reqBadge").textContent = newReqs ? `(${newReqs})` : "";
}

function render() {
  renderStats();
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;
  $("#liveWrap").classList.toggle("hidden", tab !== "carte");

  if (tab === "carte") {
    view.innerHTML = "";
    updateLiveMap();
  } else if (tab === "agenda") {
    const list = agendaList();
    view.innerHTML = list.length ? groupedByDay(list) : empty('Aucune course à venir. Partagez votre page avec le <a href="kit.html">kit pub</a> !');
  } else if (tab === "nouvelles") {
    const list = orders.filter(o => o.status === "nouvelle").sort(byTime);
    view.innerHTML = list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course à accepter 👍");
  } else if (tab === "livreurs") {
    renderCouriers(view);
  } else if (tab === "hebdo") {
    renderWeek(view);
  } else if (tab === "commerces") {
    renderShops(view);
  } else if (tab === "messages") {
    renderMessages(view);
  } else if (tab === "demandes") {
    renderRequests(view);
  } else if (tab === "messagerie") {
    renderInbox(view);
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

// --- Carte en direct : livreurs, points de récupération et de livraison -----------------
const live = { map: null, layer: null, fitted: false };
const SERVICE_PIN = { repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" };

function livePin(emoji, cls) {
  return L.divIcon({ className: "", html: `<div class="map-pin ${cls || ""}">${emoji}</div>`, iconSize: [32, 32], iconAnchor: [16, 28] });
}

const point = (lat, lon) => lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null;
const fresh = c => c.position_at && Date.now() - new Date(c.position_at) < 30 * 60000;
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? "à l'instant" : `il y a ${m} min`; };

// Où en est la course : étape, prochaine destination et temps estimé
function progressOf(o) {
  const c = couriers.find(x => x.id === o.courier_id);
  const pos = c && fresh(c) ? point(c.lat, c.lon) : null;
  const target = o.status === "confirmee" ? point(o.pickup_lat, o.pickup_lon) : point(o.dropoff_lat, o.dropoff_lon);
  const eta = pos && target ? Pricing.etaMinutes(pos, target) : null;
  const step = { nouvelle: 0, confirmee: 1, recuperee: 2, livree: 3 }[o.status] || 0;
  const text = o.status === "nouvelle" ? "🆕 En attente d'un livreur"
    : o.status === "confirmee" ? `🛵 En route vers la récupération${eta ? ` · ≈ ${eta} min` : ""}`
    : `📦 Colis récupéré, en route vers la livraison${eta ? ` · ≈ ${eta} min` : ""}`;
  return { c, pos, target, eta, step, text };
}

function updateLiveMap() {
  if (!window.L) { $("#liveMap").innerHTML = '<p class="empty">Carte indisponible (connexion).</p>'; return; }
  if (!live.map) {
    const home = Pricing.cityById(CONFIG, CONFIG.homeCity);
    live.map = L.map("liveMap").setView([home.lat, home.lon], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(live.map);
    live.layer = L.layerGroup().addTo(live.map);
  }
  live.map.invalidateSize();
  live.layer.clearLayers();
  const pts = [];
  const add = (p, emoji, html, cls) => { if (!p) return; pts.push([p.lat, p.lon]); L.marker([p.lat, p.lon], { icon: livePin(emoji, cls) }).bindPopup(html).addTo(live.layer); };

  const list = orders.filter(o => ["nouvelle", "confirmee", "recuperee"].includes(o.status)).sort(byTime);
  list.forEach(o => {
    const pr = progressOf(o);
    const pick = point(o.pickup_lat, o.pickup_lon), drop = point(o.dropoff_lat, o.dropoff_lon);
    const label = `<b>N° ${UI.esc(o.ref)}</b> · ${UI.money(o.price)}<br>${UI.esc(pr.text)}`;
    if (o.status !== "recuperee") add(pick, o.status === "nouvelle" ? "🆕" : SERVICE_PIN[o.service] || "📍", `${label}<br>📍 ${UI.esc(UI.placeQuery(o, "pickup"))}`, o.status === "nouvelle" ? "pin-wait" : "");
    add(drop, "🏁", `${label}<br>🏁 ${UI.esc(UI.placeQuery(o, "dropoff"))}`);
    if (pick && drop) L.polyline([[pick.lat, pick.lon], [drop.lat, drop.lon]], { color: "#98A2B3", weight: 2, dashArray: "4 6" }).addTo(live.layer);
    if (pr.pos && pr.target) L.polyline([[pr.pos.lat, pr.pos.lon], [pr.target.lat, pr.target.lon]], { color: "#FF6A13", weight: 4 }).addTo(live.layer);
  });
  couriers.filter(fresh).forEach(c => {
    const n = list.filter(o => o.courier_id === c.id).length;
    add(point(c.lat, c.lon), "🛵", `<b>${UI.esc(c.name)}</b>${c.role === "admin" ? " (vous)" : ""}<br>${n} course(s) en cours · position ${ago(c.position_at)}`, "pin-courier");
  });
  if (!live.fitted && pts.length) { live.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); live.fitted = true; }
  live.points = pts;

  const onDuty = couriers.filter(fresh);
  $("#liveList").innerHTML = `<p class="small muted" style="margin-bottom:6px">🛵 En service : ${onDuty.length ? onDuty.map(c => UI.esc(c.name)).join(", ") : "personne pour l'instant"}</p>`
    + (list.length ? list.map(o => {
      const pr = progressOf(o);
      return `<div class="order live-item" data-focus="${UI.esc(o.id)}">
        <div class="order-head"><span class="order-time">${UI.esc(UI.cityFr(o.from_city))} → ${UI.esc(UI.cityFr(o.to_city))}</span><span class="order-price">${UI.money(o.price)}</span></div>
        <div class="small">N° ${UI.esc(o.ref)} · ${pr.c ? "🛵 " + UI.esc(pr.c.name) : "sans livreur"}${pr.c && !pr.pos ? " · position inconnue" : ""}</div>
        <div class="small"><b>${UI.esc(pr.text)}</b></div>
        <div class="progress">${[0, 1, 2, 3].map(i => `<i class="${i <= pr.step ? "on" : ""}"></i>`).join("")}</div>
      </div>`;
    }).join("") : `<div class="empty card">Aucune course en cours.</div>`);
}

function focusOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o || !live.map) return;
  const pr = progressOf(o);
  const pts = [pr.pos, point(o.pickup_lat, o.pickup_lon), point(o.dropoff_lat, o.dropoff_lon)].filter(Boolean).map(p => [p.lat, p.lon]);
  if (pts.length) live.map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
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
      <p class="muted small" style="margin:4px 0 8px">Envoyez ce lien : ils s'inscrivent, acceptent les conditions (permis, assurance…), puis vous les validez ici après avoir vu leurs documents. Vous prenez ${UI.commissionText()} par course livrée, réglés chaque semaine.</p>
      <div class="promo-row"><input readonly value="${UI.esc(invite)}" dir="ltr" /><a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waShare(`Tu as un scooter, une voiture ou un vélo ? Deviens livreur partenaire chez ${CONFIG.businessName} : tu choisis tes courses, tu encaisses directement le client, et seulement ${UI.commissionText()} de commission par course. Inscription : ${invite}`)}">Partager</a></div>
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
        <div class="meta">${expiryPill("Permis", c.license_expiry)}${expiryPill("Assurance", c.insurance_expiry)}
          ${(() => { const b = balanceOf(c.id); return b > Number(settings.max_debt) ? `<span class="pill st-annulee">🔒 Bloqué : doit ${UI.money(b)}</span>` : b > 0 ? `<span class="pill unpaid">Doit ${UI.money(b)}</span>` : b < 0 ? `<span class="pill paid">Vous lui devez ${UI.money(-b)}</span>` : ""; })()}</div>
        <div class="actions">
          ${c.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-cact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-cact="suspendu">⛔ Suspendre</button>`}
          ${c.unlocked_until && new Date(c.unlocked_until) > new Date()
            ? `<button class="btn btn-sm" data-unlock="off">🔒 Rebloquer (débloqué jusqu'au ${UI.esc(UI.fmtDateTime(c.unlocked_until))})</button>`
            : `<button class="btn btn-sm" data-unlock="on" title="Solde, course en cours, GPS et photo : plus aucun blocage pendant 24 h">🔓 Débloquer 24 h</button>`}
          ${chatBtn("c:" + c.id, `Livreur : ${c.name}`, c.phone, "💬 Message", c.status === "en_attente"
            ? `Bonjour ${c.name}, merci pour ton inscription chez ${CONFIG.businessName} ! Pour valider ton compte, envoie-moi ici en photo : permis de conduire, carte grise, attestation d'assurance et carte d'identité.`
            : `Bonjour ${c.name}, `)}
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
    // Bonus de parrainage : courses livrées au départ de ses commerces (déduits de sa commission)
    const bonusList = orders.filter(o => o.referrer_id === c.id && Number(o.referral_bonus) > 0 && inWeek(o));
    const bonusDue = sum(bonusList.filter(o => o.referral_status !== "regle"), o => Number(o.referral_bonus || 0));
    const dueAmount = sum(due, o => Number(o.commission || 0));
    // Courses payées à HOP (programmées, carnets) : l'argent est chez vous, vous le reversez au livreur
    const hopPaid = list.filter(o => o.paid_to === "hop" && o.payment_status === "paye");
    const hopDue = sum(due.filter(o => o.paid_to === "hop" && o.payment_status === "paye"));
    return { c, list, due, bonusList, bonusDue, hopPaid, hopDue, collected: sum(list.filter(o => o.paid_to !== "hop")), commission: sum(list, o => Number(o.commission || 0)), dueAmount, balance: dueAmount - bonusDue - hopDue };
  }).filter(r => r.list.length || r.bonusList.length);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  view.innerHTML = `<div class="toolbar">
      <button class="btn btn-sm" data-week="-1">◀</button>
      <b>Semaine du ${fmtKey(start)} au ${fmtKey(end)}</b>
      <button class="btn btn-sm" data-week="1" ${weekOffset >= 0 ? "disabled" : ""}>▶</button>
      <span class="small muted">Les livreurs encaissent les clients (espèces ou leur Bit) et vous versent ${UI.commissionText()} par course livrée, une fois par semaine. Les courses payées à HOP (programmées, carnets) leur sont reversées, et leurs bonus de parrainage déduits. Au-delà de ${UI.money(settings.max_debt)} dus, un livreur ne peut plus accepter de course.</span>
    </div>
    <table class="bill">
      <thead><tr><th>Livreur</th><th class="num">Courses</th><th class="num">Encaissé par lui</th><th class="num">💳 Payé à HOP</th><th class="num">Commission</th><th class="num">🤝 Bonus</th><th class="num">Solde</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr data-courier="${UI.esc(r.c.id)}"><td><b>${UI.esc(r.c.name)}</b><br><span class="small muted">${UI.esc(r.c.phone)}</span></td>
        <td class="num">${r.list.length}</td><td class="num">${UI.money(r.collected)}</td><td class="num">${r.hopPaid.length ? "−" + UI.money(sum(r.hopPaid)) : "—"}</td><td class="num">${UI.money(r.commission)}</td>
        <td class="num">${r.bonusList.length ? `−${UI.money(sum(r.bonusList, o => Number(o.referral_bonus || 0)))}<br><span class="small muted">${r.bonusList.length} livraison(s)</span>` : "—"}</td>
        <td class="num"><b>${r.dueAmount || r.bonusDue || r.hopDue ? (r.balance >= 0 ? UI.money(r.balance) + " à recevoir" : UI.money(-r.balance) + " à lui verser") : "✓ réglé"}</b></td>
        <td class="num" style="white-space:nowrap">
          ${chatBtn("c:" + r.c.id, `Livreur : ${r.c.name}`, "Récapitulatif de la semaine", "Envoyer", `Bonjour ${r.c.name}, récapitulatif de la semaine du ${fmtKey(start)} au ${fmtKey(end)} : ${r.list.length} course(s) livrée(s), ${UI.money(r.collected)} encaissés, commission ${UI.money(r.dueAmount)}${r.hopDue ? `, courses payées à HOP ${UI.money(r.hopDue)} déduites` : ""}${r.bonusDue ? `, bonus parrainage ${UI.money(r.bonusDue)} déduit` : ""}. ${r.balance >= 0 ? `À me verser : ${UI.money(r.balance)} (Bit au ${CONFIG.bitPhone})` : `Je te verse ${UI.money(-r.balance)} sur ton Bit`}. Merci et bravo !`)}
          ${r.dueAmount || r.bonusDue || r.hopDue ? `<button class="btn btn-sm" data-settle="${UI.esc(r.c.id)}">✓ Réglé</button>` : ""}
        </td></tr>`).join("") || `<tr><td colspan="8" class="muted">Aucune course livrée par un livreur partenaire cette semaine.</td></tr>`}</tbody>
      <tfoot><tr><th>Solde total</th><th></th><th></th><th></th><th></th><th></th><th class="num">${UI.money(total)}</th><th></th></tr></tfoot>
    </table>`;
  view.dataset.weekStart = start;
}

// --- Commerces partenaires --------------------------------------------------------------
const SHOP_KIND = { restaurant: "🍔 Restaurant", boutique: "🛍️ Boutique", pharmacie: "💊 Pharmacie / beauté", bureau: "💼 Bureau", autre: "🏪 Commerce" };

// Message au commerce avec ses deux liens, dans sa langue
function shopWelcome(x) {
  const order = UI.appUrl() + "?c=" + x.code, space = UI.appUrl("commerce.html") + "?k=" + x.token;
  return x.lang === "fr"
    ? `Bonjour ${x.contact_name || ""}, bienvenue chez ${CONFIG.businessName} ! 🛵\nPour commander une course depuis ${x.name} : ${order}\nVotre espace (vos courses, votre QR code pour vos clients) : ${space}\nÀ très vite !`
    : `שלום ${x.contact_name || ""}, ברוכים הבאים ל${CONFIG.businessNameHe}! 🛵\nלהזמנת שליח מ${x.name}: ${order}\nהאזור שלכם (המשלוחים, קוד QR ללקוחות): ${space}\nנתראה בקרוב!`;
}

function renderShops(view) {
  const month = today().slice(0, 7);
  const viaShop = orders.filter(o => o.shop_id && o.status === "livree");
  const order = ["en_attente", "actif", "suspendu"];
  const list = shops.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const signup = UI.appUrl("commerce.html") + (me && me.ref_code ? "?p=" + me.ref_code : "");
  const statusLabel = { en_attente: "⏳ À vérifier", actif: "✅ Partenaire", suspendu: "⛔ Suspendu" };
  const bonusDue = sum(orders.filter(o => o.status === "livree" && Number(o.referral_bonus) > 0 && o.referral_status !== "regle"), o => Number(o.referral_bonus));
  view.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <b>🤝 Commerces amenés par les livreurs</b>
      <p class="muted small" style="margin:4px 0 8px">Chaque livreur a son lien d'inscription pour les commerces (onglet « Parrainage » de son espace). Il gagne ${UI.money(settings.referral_bonus)} sur chaque course livrée au départ de ses commerces, tant qu'il livre avec nous (plus de bonus après ${Number(settings.referral_active_days || CONFIG.partners.activeDays)} jours sans livraison), déduit de sa commission chaque semaine, et voit leurs courses ${Number(settings.priority_minutes)} min avant les autres. Les courses peuvent être commandées dès l'inscription ; vérifiez ici que le commerce existe.</p>
      <div class="promo-row"><input readonly value="${UI.esc(signup)}" dir="ltr" /><button class="btn btn-sm" data-copy="${UI.esc(signup)}">Copier</button><a class="btn btn-sm" href="${UI.esc(signup)}" target="_blank" rel="noopener">➕ Inscrire un commerce</a></div>
    </div>
    <div class="stats">
      <div class="stat"><small>Commerces</small><b>${shops.filter(x => x.status !== "suspendu").length}</b></div>
      <div class="stat"><small>À vérifier</small><b>${shops.filter(x => x.status === "en_attente").length}</b></div>
      <div class="stat"><small>Courses ce mois</small><b>${viaShop.filter(o => UI.dayKey(o.pickup_at).startsWith(month)).length}</b></div>
      <div class="stat"><small>Bonus à régler</small><b>${UI.money(bonusDue)}</b></div>
    </div>
    ${list.length ? `<div class="orders">${list.map(x => {
      const done = viaShop.filter(o => o.shop_id === x.id);
      return `<article class="order${x.status === "en_attente" ? " is-new" : ""}" data-shop="${UI.esc(x.id)}">
        <div class="order-head">
          <span class="order-time">${UI.esc(x.name)}</span>
          <span class="pill">${statusLabel[x.status] || x.status}</span>
          <span class="order-ref">Code ${UI.esc(x.code)}</span>
          <span class="order-price">${done.length} course(s)</span>
        </div>
        <div class="kv">
          <div><span>🏷️</span><span>${UI.esc(SHOP_KIND[x.kind] || SHOP_KIND.autre)} · ${UI.esc(x.address || "")}${x.city ? ", " + UI.esc(UI.cityFr(x.city)) : ""}</span></div>
          <div><span>👤</span><span>${tel(x.contact_name, x.phone)}${x.email ? " · " + UI.esc(x.email) : ""} · ${x.lang === "fr" ? "🇫🇷" : "🇮🇱"}</span></div>
          <div><span>🤝</span><span>Parrain : <select data-sact="referrer"><option value="">Aucun</option>${couriers.map(c => `<option value="${UI.esc(c.id)}" ${c.id === x.referrer_id ? "selected" : ""}>${UI.esc(c.role === "admin" ? "Moi (pas de bonus)" : c.name)}</option>`).join("")}</select>
            · bonus générés ${UI.money(sum(done, o => Number(o.referral_bonus || 0)))}</span></div>
          <div><span>🎟️</span><span>Carnet pro : <b>${Number(x.credits || 0)}</b> course(s) restante(s)${sales.filter(v => v.shop_id === x.id).map(v =>
            ` · <a href="${UI.esc(UI.carnetReceiptUrl(v))}" target="_blank" rel="noopener">🧾 Reçu n° ${v.receipt_number}</a>`).join("")}</span></div>
          <div><span>📅</span><span>Inscrit le ${UI.esc(new Date(x.created_at).toLocaleDateString("fr-FR"))}</span></div>
        </div>
        <div class="actions">
          ${x.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-sact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-sact="suspendu">⛔ Suspendre</button>`}
          <button class="btn btn-sm" data-sact="carnet">🎟️ Carnet payé (${UI.money(CONFIG.partners.carnet.price)}) → +${CONFIG.partners.carnet.courses} et reçu</button>
          <button class="btn btn-sm" data-sact="credits">✏️ Courses du carnet</button>
          ${chatBtn("s:" + x.id, `Commerce : ${x.name}`, x.phone, "💬 Message", shopWelcome(x))}
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl() + "?c=" + x.code)}">🛵 Commander pour lui</a>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl("commerce.html") + "?k=" + x.token)}">🔑 Son espace</a>
          <textarea class="admin-note" data-sact="note" rows="1" placeholder="Note interne (vérifié sur place, horaires…)">${UI.esc(x.admin_note || "")}</textarea>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun commerce inscrit pour l'instant. Envoyez votre lien à un restaurant ou une boutique !</div>`}`;
}

// --- Demandes de devis (tournée quotidienne, carnet…) -------------------------------------
function renderRequests(view) {
  const topic = { tournee: "🗓️ Tournée quotidienne", carnet: "🎟️ Carnet de courses", autre: "📝 Autre besoin" };
  const list = requests.slice().sort((a, b) => (a.status === "nouvelle" ? 0 : 1) - (b.status === "nouvelle" ? 0 : 1));
  view.innerHTML = list.length ? `<div class="orders">${list.map(r => `
    <article class="order${r.status === "nouvelle" ? " is-new" : ""}" data-req="${UI.esc(r.id)}">
      <div class="order-head">
        <span class="order-time">${UI.esc(r.company || r.name)}</span>
        <span class="pill">${r.kind === "pro" ? "🏢 Pro" : "🏠 Particulier"}</span>
        <span class="pill">${topic[r.topic] || r.topic}</span>
        <span class="order-ref">${UI.esc(UI.fmtDateTime(r.created_at))}</span>
      </div>
      <div class="kv">
        <div><span>👤</span><span>${tel(r.name, r.phone)}${r.city ? " · " + UI.esc(UI.cityFr(r.city)) : ""} · ${r.lang === "he" ? "🇮🇱 hébreu" : "🇫🇷 français"}</span></div>
        ${r.frequency ? `<div><span>🔁</span><span>${UI.esc(r.frequency)}</span></div>` : ""}
        ${r.message ? `<div><span>📝</span><span>${UI.esc(r.message)}</span></div>` : ""}
      </div>
      <div class="actions">
        ${r.device_id ? chatBtn("u:" + r.device_id, `${r.company || r.name}`, `${r.name} · ${r.phone}`, "💬 Répondre", r.lang === "he" ? `שלום ${r.name}, קיבלנו את הבקשה שלכם ב${CONFIG.businessNameHe}. ` : `Bonjour ${r.name}, merci pour votre demande chez ${CONFIG.businessName}. `)
          : `<a class="btn btn-sm" href="tel:${UI.esc(r.phone)}">📞 Rappeler</a>`}
        ${r.status === "nouvelle" ? `<button class="btn btn-sm btn-primary" data-ract="traitee">✓ Traitée</button>` : `<button class="btn btn-sm" data-ract="nouvelle">↩︎ À traiter</button>`}
        <textarea class="admin-note" data-ract="note" rows="1" placeholder="Note (prix proposé, suite…)">${UI.esc(r.admin_note || "")}</textarea>
      </div>
    </article>`).join("")}</div>` : `<div class="empty card">Aucune demande pour l'instant. Les clients et les commerces demandent un devis depuis l'application (bouton « Demander un devis »).</div>`;
}

// --- Messages aux livreurs --------------------------------------------------------------
function renderMessages(view) {
  const act = partners().filter(c => c.status === "actif");
  const onDuty = act.filter(c => c.position_at && Date.now() - new Date(c.position_at) < 10 * 60000);
  const name = id => (couriers.find(c => c.id === id) || {}).name || "?";
  const typed = $("#msgText") ? $("#msgText").value : "";
  view.innerHTML = `
    <div class="card">
      <b>📣 Prévenir vos livreurs</b>
      <p class="muted small" style="margin:4px 0 10px">Le message s'ouvre en grand sur leur téléphone, avec un son, et ils répondent « J'arrive » ou « Pas dispo ». ${act.length} livreur(s) actif(s), ${onDuty.length} en ligne en ce moment${onDuty.length ? " : " + onDuty.map(c => UI.esc(c.name)).join(", ") : ""}.</p>
      <div class="tpl-list">${CONFIG.courierMessages.map((m, i) => `<button class="addr-chip" data-tpl="${i}">${UI.esc(m.text)}</button>`).join("")}</div>
      <textarea id="msgText" rows="3" placeholder="Votre message…" style="width:100%;margin-top:10px">${UI.esc(typed)}</textarea>
      <div class="promo-row" style="margin-top:8px">
        <select id="msgTo"><option value="">À tous les livreurs actifs</option>${act.map(c => `<option value="${UI.esc(c.id)}">À ${UI.esc(c.name)} seulement</option>`).join("")}</select>
        <button class="btn btn-primary" id="msgSend">📣 Envoyer</button>
      </div>
    </div>
    <h3 style="margin:18px 0 8px">Derniers messages (48 h)</h3>
    ${msgs.messages.length ? `<div class="orders">${msgs.messages.map(m => {
      const r = msgs.replies.filter(x => x.message_id === m.id);
      const yes = r.filter(x => x.answer === "jarrive").map(x => UI.esc(name(x.courier_id)));
      const no = r.filter(x => x.answer === "pas_dispo").map(x => UI.esc(name(x.courier_id)));
      return `<article class="order"><div class="order-head"><span class="order-time">${UI.esc(UI.fmtDateTime(m.created_at))}</span><span class="pill">${m.to_courier ? "👤 " + UI.esc(name(m.to_courier)) : "👥 Tous"}</span></div>
        <p style="margin:8px 0"><b>${UI.esc(m.body)}</b></p>
        <div class="meta"><span class="pill paid">🛵 J'arrive : ${yes.length ? yes.join(", ") : "personne pour l'instant"}</span>${no.length ? `<span class="pill">😴 Pas dispo : ${no.join(", ")}</span>` : ""}</div></article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun message envoyé ces dernières 48 h.</div>`}`;
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
    const c = byClient[key] = byClient[key] || { n: 0, total: 0, unpaid: 0, phone: o.contact_phone, device: o.device_id };
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
        <td class="num">${c.device ? chatBtn("u:" + c.device, name, c.phone || "", "Envoyer", `Bonjour, récapitulatif de vos courses ${billMonth} : ${c.n} course(s), total ${UI.money(c.total)}${c.unpaid ? `, reste à régler ${UI.money(c.unpaid)} (espèces ou Bit au ${CONFIG.bitPhone})` : ""}. Merci !`) : ""}</td></tr>`).join("")
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

// --- Messagerie dans l'application (le patron répond en tant que « HOP! ») -------------------
let chatRecentList = [];
let chatTotal = 0;
let chatUnread = {};
function chatBtn(thread, title, sub, label, prefill, photo) {
  const n = chatUnread[thread];
  return `<button type="button" class="btn btn-sm btn-wa" data-thread="${UI.esc(thread)}" data-ctitle="${UI.esc(title)}" data-csub="${UI.esc(sub || "")}"
    ${prefill ? `data-prefill="${UI.esc(prefill)}"` : ""} ${photo ? `data-photo="1"` : ""}>${label}${n ? ` <span class="chat-badge">${n}</span>` : ""}</button>`;
}
function openAdminChat(thread, title, sub, prefill, photo) {
  Chat.open({ thread, title, sub, me: "admin", lang: "fr", prefill, photo,
    fetch: () => Store.chatThread(thread), send: (b, i) => Store.chatSend(thread, "admin", "HOP!", b, i), onClose: refreshChats });
}
// Nom d'une conversation pour la boîte de réception
function threadLabel(thread, msgs) {
  const [kind, id] = thread.split(":");
  if (kind === "o") { const o = orders.find(x => x.id === id); return o ? `🛵 Course n° ${o.ref} · ${o.contact_name}` : "🛵 Course"; }
  if (kind === "c") { const c = couriers.find(x => x.id === id); return `👤 Livreur : ${c ? c.name : "?"}`; }
  if (kind === "s") { const x = shops.find(v => v.id === id); return `🏪 Commerce : ${x ? x.name : "?"}`; }
  const m = msgs.find(v => v.author === "client" && v.author_name);
  return `💬 Client : ${m ? m.author_name : "sans nom"}`;
}
async function refreshChats() {
  try { chatRecentList = await Store.chatRecent(); } catch (e) { return; }
  chatUnread = Chat.unread(chatRecentList, "admin");
  const total = Object.values(chatUnread).reduce((s, n) => s + n, 0);
  $("#chatTabBadge").textContent = total ? `(${total})` : "";
  if (!firstLoad && total > chatTotal && Chat.openThread == null) {
    beep();
    if (window.Notification && Notification.permission === "granted") new Notification("💬 Nouveau message", { body: "Ouvrez la messagerie de l'espace patron." });
  }
  chatTotal = total;
}
function renderInbox(view) {
  const threads = {};
  chatRecentList.forEach(m => { (threads[m.thread] = threads[m.thread] || []).push(m); });
  const list = Object.entries(threads).map(([thread, msgs]) => ({ thread, msgs, last: msgs[0] }))
    .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  view.innerHTML = list.length ? `<div class="orders">${list.map(t => {
    const n = chatUnread[t.thread] || 0;
    const lastText = t.last.author === "system" ? I18N.forLang("fr", "cs_" + String(t.last.body).replace("status:", "")) : (t.last.body || "📷 Photo");
    const label = threadLabel(t.thread, t.msgs);
    return `<article class="order inbox-row${n ? " is-new" : ""}" data-thread="${UI.esc(t.thread)}" data-ctitle="${UI.esc(label)}">
      <div class="order-head"><span class="order-time">${UI.esc(label)}</span>${n ? `<span class="chat-badge">${n}</span>` : ""}<span class="order-ref">${UI.esc(UI.fmtDateTime(t.last.created_at))}</span></div>
      <p class="small muted" style="margin-top:4px">${t.last.author === "admin" ? "Vous : " : ""}${UI.esc(String(lastText).slice(0, 120))}</p>
    </article>`;
  }).join("")}</div>` : `<div class="empty card">Aucun message ces 30 derniers jours. Les clients, livreurs et commerces vous écrivent ici, dans l'application.</div>`;
}

function orderOf(el) {
  const art = el.closest("article.order");
  return art && orders.find(o => o.id === art.dataset.id);
}

async function assignTo(o, courier) {
  try {
    await Store.assignOrder(o.id, courier, o.price);
    await load();

  } catch (e) { alert("Attribution impossible, vérifiez la connexion."); }
}

async function onViewClick(e) {
  const th = e.target.closest("[data-thread]");
  if (th) return openAdminChat(th.dataset.thread, th.dataset.ctitle, th.dataset.csub, th.dataset.prefill, !!th.dataset.photo);
  const el = e.target.closest("button");
  if (!el) return;
  if (el.id === "csvBtn") return exportCsv();
  if (el.dataset.week) { weekOffset = Math.min(0, weekOffset + Number(el.dataset.week)); return render(); }
  if (el.dataset.settle) {
    const start = $("#view").dataset.weekStart, end = addDays(start, 6);
    const inWeek = o => o.status === "livree" && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end;
    const ids = orders.filter(o => o.courier_id === el.dataset.settle && inWeek(o) && o.commission_status !== "regle").map(o => o.id);
    const bonusIds = orders.filter(o => o.referrer_id === el.dataset.settle && inWeek(o) && o.referral_status !== "regle").map(o => o.id);
    try { await Store.settleOrders(ids); await Store.settleReferrals(bonusIds); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.ract && el.dataset.ract !== "note") {
    const id = el.closest("[data-req]").dataset.req;
    try { await Store.updateRequest(id, { status: el.dataset.ract }); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.sact) {
    const id = el.closest("[data-shop]").dataset.shop;
    const shop = shops.find(x => x.id === id);
    let changes = { status: el.dataset.sact };
    if (el.dataset.sact === "carnet") {
      // Carnet payé : reçu numéroté, courses ajoutées, et le reçu part au commerce dans l'application
      const price = UI.money(CONFIG.partners.carnet.price);
      const method = confirm(`Avez-vous reçu ${price} de ${shop.name} par Bit ?\n(Annuler si c'était en espèces)`) ? "bit"
        : confirm(`Avez-vous reçu ${price} de ${shop.name} en espèces ?`) ? "cash" : null;
      if (!method) return;
      try {
        const r = await Store.sellCarnet(id, method);
        const url = UI.carnetReceiptUrl(r);
        const msg = shop.lang === "fr"
          ? `Bonjour ${shop.contact_name || ""}, merci ! Votre carnet de ${CONFIG.partners.carnet.courses} courses est actif. Votre reçu n° ${r.receipt_number} : ${url}`
          : `שלום ${shop.contact_name || ""}, תודה! הכרטיסייה של ${CONFIG.partners.carnet.courses} משלוחים פעילה. הקבלה מס' ${r.receipt_number}: ${url}`;
        // Le reçu part dans la conversation du commerce (son espace pro)
        await Store.chatSend("s:" + id, "admin", "HOP!", msg).catch(() => alert(`Carnet enregistré, mais le message n'est pas parti. Reçu : ${url}`));
        await load();
      } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
      return;
    } else if (el.dataset.sact === "credits") {
      const v = prompt(`Courses restantes sur le carnet de ${shop.name}`, shop.credits || 0);
      const n = parseInt(v, 10);
      if (v == null || !(n >= 0)) return;
      changes = { credits: n };
    }
    try { await Store.updateShop(id, changes); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.tpl != null) {
    const ta = $("#msgText");
    ta.value = CONFIG.courierMessages[Number(el.dataset.tpl)].text;
    ta.dataset.kind = CONFIG.courierMessages[Number(el.dataset.tpl)].kind;
    ta.focus();
    return;
  }
  if (el.id === "msgSend") {
    const body = $("#msgText").value.trim();
    if (!body) return $("#msgText").focus();
    el.disabled = true;
    try {
      await Store.sendMessage(body, $("#msgText").dataset.kind || "info", $("#msgTo").value || null);
      $("#msgText").value = "";
      await load();
    } catch (ex) { el.disabled = false; alert("Message non envoyé, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.copy) {
    if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.copy).then(() => { el.textContent = "✓ Copié"; }, () => {});
    return;
  }
  if (el.dataset.unlock) {
    const id = el.closest("[data-courier]").dataset.courier;
    const c = couriers.find(x => x.id === id);
    const on = el.dataset.unlock === "on";
    if (on && !confirm(`Débloquer ${c.name} pendant 24 h ? Plus aucun blocage (solde dû, course en cours, GPS, photo).`)) return;
    try { await Store.updateCourier(id, { unlocked_until: on ? new Date(Date.now() + 86400000).toISOString() : null }); await load(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
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
  } else if (el.dataset.act === "issue") {
    if (confirm(`Le souci de la course n° ${o.ref} est-il réglé ?`)) change(o, { issue: null, issue_at: null });
  } else if (el.dataset.act === "unlock") {
    if (!o.unlocked && !confirm(`Débloquer la course n° ${o.ref} ? Le livreur pourra valider « Livré » sans être à l'adresse et sans photo.`)) return;
    change(o, { unlocked: !o.unlocked });
  } else if (el.dataset.act === "paidto") {
    change(o, { paid_to: o.paid_to === "hop" ? "livreur" : "hop" });
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
  // Le client reçoit la raison dans la conversation de sa course (dans sa langue)
  if (await change(o, { status: "refusee", admin_note: reason })) {
    Store.chatSend("o:" + o.id, "admin", "HOP!", clientMessage(Object.assign({}, o, { status: "refusee", admin_note: reason })))
      .catch(() => alert("La course est refusée, mais le message au client n'est pas parti."));
  }
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
  } else if (t.dataset.ract === "note") {
    Store.updateRequest(t.closest("[data-req]").dataset.req, { admin_note: t.value.trim() || null }).catch(() => alert("Note non enregistrée."));
  } else if (t.dataset.sact === "note" || t.dataset.sact === "referrer") {
    const id = t.closest("[data-shop]").dataset.shop;
    const changes = t.dataset.sact === "note" ? { admin_note: t.value.trim() || null } : { referrer_id: t.value || null };
    Store.updateShop(id, changes).then(load, () => alert("Non enregistré, vérifiez la connexion."));
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
  $("#demoNotice").classList.toggle("hidden", Store.ONLINE);
  renderDuty();
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 10000);
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
$("#liveList").addEventListener("click", e => { const it = e.target.closest("[data-focus]"); if (it) focusOrder(it.dataset.focus); });
$("#liveFit").addEventListener("click", () => { if (live.map && live.points && live.points.length) live.map.fitBounds(live.points, { padding: [40, 40], maxZoom: 15 }); });
$("#view").addEventListener("change", onViewChange);
$("#view").addEventListener("input", onViewInput);
window.addEventListener("storage", e => { if (/livraison\.(orders|couriers|shops|replies|requests)/.test(e.key || "") && Store.session()) load(); });
document.addEventListener("visibilitychange", async () => {
  // Le verrou d'écran est relâché quand on quitte la page : le reprendre au retour
  if (document.visibilityState === "visible" && duty.watch != null && navigator.wakeLock) {
    try { duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
if (Store.session()) start(); else showLogin();

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
