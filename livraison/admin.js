// ============================================================================
// Espace coursier : agenda, statuts, position GPS en direct, encaissements,
// messages WhatsApp aux clients, itinéraire, facturation.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const LS_SEEN = "livraison.seenIds.v1";
let orders = [];
let tab = "agenda";
let firstLoad = true;
let histFilter = { status: "", q: "" };
let billMonth = new Date().toISOString().slice(0, 7);

// --- Connexion ------------------------------------------------------------------
function showLogin() {
  $("#dashboard").classList.add("hidden");
  $("#logoutBtn").classList.add("hidden");
  $("#loginForm").classList.remove("hidden");
  if (!Store.ONLINE) {
    $("#emailWrap").classList.add("hidden");
    $("#pwLabel").textContent = "Code d'accès";
    $("#loginHint").textContent = "Mode démo : le code est défini dans config.js (demoAdminPin). Seules les commandes passées sur cet appareil sont visibles.";
  } else {
    $("#loginHint").textContent = "Connectez-vous avec le compte coursier créé dans Supabase.";
  }
}

async function onLogin(e) {
  e.preventDefault();
  const f = e.target;
  $("#loginError").classList.add("hidden");
  try {
    await Store.adminLogin(f.email.value.trim(), f.password.value);
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

function alertNew(list) {
  beep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (window.Notification && Notification.permission === "granted") {
    list.forEach(o => new Notification(`🆕 ${o.ref} — ${UI.money(o.price)}`, {
      body: `${UI.whenFr(o)}\n${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)}\n${o.contact_name}`
    }));
  }
}

async function load() {
  try {
    orders = await Store.allOrders();
  } catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.adminLogout(); return showLogin(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  const seen = readSeen();
  const fresh = orders.filter(o => !seen.has(o.id) && o.status === "nouvelle");
  if (!firstLoad && fresh.length) alertNew(fresh);
  orders.forEach(o => seen.add(o.id));
  writeSeen(seen);
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  // Ne pas effacer un champ en cours de saisie
  const typing = document.activeElement && $("#view").contains(document.activeElement)
    && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing) renderStats(); else render();
}

// --- En service : partage de la position GPS --------------------------------------
const duty = { watch: null, lastSent: 0, wakeLock: null };

async function sendPosition(pos) {
  const now = Date.now();
  if (now - duty.lastSent < 15000) return;
  duty.lastSent = now;
  try {
    await Store.setCourierPosition(pos.coords.latitude, pos.coords.longitude);
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

// --- Rendu ----------------------------------------------------------------------
const today = () => UI.dayKey(new Date().toISOString());
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const active = o => ["nouvelle", "confirmee", "recuperee"].includes(o.status);
const sum = list => list.reduce((s, o) => s + Number(o.price), 0);

function renderStats() {
  const t = today(), month = t.slice(0, 7);
  $("#stNew").textContent = orders.filter(o => o.status === "nouvelle").length;
  $("#stToday").textContent = orders.filter(o => UI.dayKey(o.pickup_at) === t && o.status !== "annulee").length;
  $("#stUnpaid").textContent = UI.money(sum(orders.filter(o => o.payment_status !== "paye" && ["confirmee", "recuperee", "livree"].includes(o.status))));
  $("#stMonthRev").textContent = UI.money(sum(orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(month))));
}

function referralCode(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 4 ? CONFIG.promos.referral.prefix + d.slice(-4) : "";
}

// Message WhatsApp au client, dans sa langue
function clientMessage(o) {
  const l = o.lang || "fr";
  const f = (k, v) => I18N.forLang(l, k, v);
  const city = id => { const c = CONFIG.cities.find(x => x.id === id); return c ? c[l] || c.fr : id; };
  const when = o.urgency === "programmee" ? f("msg_when_at", { when: UI.whenFr(o) }) : f("msg_when_asap");
  const pay = o.payment_method === "bit" ? f("pay_bit_short", { phone: CONFIG.bitPhone }) : f("pay_cash_short");
  return f("msg_" + o.status, {
    name: o.contact_name || "", ref: o.ref, when, price: UI.money(o.price), pay,
    url: UI.trackUrl(o), to: `${o.dropoff_address}, ${city(o.to_city)}`, code: referralCode(o.contact_phone)
  });
}

function tel(name, phone) {
  return phone ? `${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a>` : UI.esc(name || "");
}

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
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(0)} km</span>`);
  if (o.promo_code) meta.push(`<span class="pill">🎁 ${UI.esc(o.promo_code)} −${UI.money(o.discount || 0)}</span>`);
  meta.push(`<span class="pill">👤 ${tel(o.contact_name, o.contact_phone)}${o.company ? " · " + UI.esc(o.company) : ""}</span>`);
  meta.push(`<span class="pill">${o.lang === "he" ? "🇮🇱 hébreu" : "🇫🇷 français"}</span>`);

  const b = (status, label, cls = "") => `<button class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
  const steps = {
    nouvelle: b("confirmee", "✅ Accepter", "btn-primary") + b("annulee", "✖ Refuser"),
    confirmee: b("recuperee", "🛵 Colis récupéré", "btn-primary") + b("annulee", "✖ Annuler"),
    recuperee: b("livree", "📦 Livré", "btn-primary")
  };

  return `
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}${when}</span>
      <span class="pill st-${UI.esc(o.status)}">${st.icon} ${st.label}</span>
      <span class="order-ref">${UI.esc(o.ref)}</span>
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
      ${o.status !== "annulee" ? `<button class="btn btn-sm" data-act="paid">${o.payment_status === "paye" ? "↩︎ Non encaissé" : "💵 Encaissé"}</button>` : ""}
      <a class="btn btn-sm btn-wa" href="${UI.waLink(o.contact_phone, clientMessage(o))}" target="_blank" rel="noopener">💬 Client</a>
      ${o.dropoff_phone ? `<a class="btn btn-sm btn-wa" href="${UI.waLink(o.dropoff_phone, I18N.forLang(o.lang || "fr", "trShareMsg", { url: UI.trackUrl(o) }))}" target="_blank" rel="noopener">💬 Destinataire</a>` : ""}
      <a class="btn btn-sm" href="${UI.trackUrl(o)}" target="_blank" rel="noopener">📍 Suivi</a>
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
  return orders.filter(o => o.status !== "annulee" && (active(o) || UI.dayKey(o.pickup_at) >= t));
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
  } else if (tab === "historique") {
    const q = histFilter.q.toLowerCase();
    const list = orders
      .filter(o => !histFilter.status || o.status === histFilter.status)
      .filter(o => !q || [o.ref, o.company, o.contact_name, o.contact_phone, o.pickup_address, o.dropoff_address].join(" ").toLowerCase().includes(q))
      .sort((a, b) => byTime(b, a));
    view.innerHTML = `<div class="toolbar">
        <select id="histStatus"><option value="">Tous les statuts</option>${Object.entries(Store.STATUSES).map(([k, s]) => `<option value="${k}" ${histFilter.status === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
        <input id="histQ" type="search" placeholder="Rechercher (client, téléphone, adresse, réf.)" value="${UI.esc(histFilter.q)}" />
      </div>
      ${list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course.")}`;
  } else {
    renderBilling(view);
  }
}

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
      <span class="small muted">💵 Espèces ${UI.money(cash)} · 📱 Bit ${UI.money(bit)}</span>
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
  const cols = ["ref", "pickup_at", "company", "contact_name", "contact_phone", "service", "from_city", "to_city", "price", "promo_code", "payment_method", "payment_status"];
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
    `SUMMARY:${escTxt(`🛵 ${o.ref} · ${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.money(o.price)}`)}`,
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

// Google Maps : tous les arrêts restants du jour, dans l'ordre des horaires
function openRoute() {
  const t = today();
  const stops = [];
  orders.filter(o => ["confirmee", "recuperee"].includes(o.status) && UI.dayKey(o.pickup_at) <= t).sort(byTime).forEach(o => {
    if (o.status === "confirmee") stops.push(UI.placeQuery(o, "pickup"));
    stops.push(UI.placeQuery(o, "dropoff"));
  });
  if (!stops.length) return alert("Aucune course acceptée à faire aujourd'hui.");
  const dest = stops.pop();
  const url = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest)
    + (stops.length ? "&waypoints=" + encodeURIComponent(stops.slice(0, 9).join("|")) : "");
  window.open(url, "_blank", "noopener");
}

// --- Actions sur une course -----------------------------------------------------
async function change(o, changes) {
  try {
    await Store.updateOrder(o.id, changes);
    Object.assign(o, changes);
    render();
  } catch (e) {
    alert("La modification n'a pas pu être enregistrée.");
  }
}

function orderOf(el) {
  const art = el.closest("article.order");
  return art && orders.find(o => o.id === art.dataset.id);
}

function onViewClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.id === "csvBtn") return exportCsv();
  const o = orderOf(el);
  if (!o) return;
  if (el.dataset.status) {
    if (el.dataset.status === "annulee" && !confirm(`Annuler la course ${o.ref} ?`)) return;
    const changes = { status: el.dataset.status };
    if (changes.status === "confirmee" && duty.watch == null) {
      if (confirm("Course acceptée. Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
    }
    change(o, changes).then(() => {
      // Proposer d'informer le client tout de suite
      if (["confirmee", "recuperee", "livree"].includes(changes.status)) {
        const a = document.querySelector(`article[data-id="${o.id}"] .btn-wa`);
        if (a) { a.style.outline = "3px solid var(--brand)"; a.scrollIntoView({ block: "nearest" }); }
      }
    });
  } else if (el.dataset.act === "paid") {
    change(o, { payment_status: o.payment_status === "paye" ? "en_attente" : "paye" });
  } else if (el.dataset.act === "price") {
    const v = prompt(`Nouveau prix pour ${o.ref} (${CONFIG.currency})`, o.price);
    const n = parseFloat(String(v).replace(",", "."));
    if (v != null && isFinite(n) && n >= 0) change(o, { price: n });
  } else if (el.dataset.act === "ics") {
    exportIcs([o]);
  }
}

function onViewChange(e) {
  const t = e.target;
  if (t.dataset.act === "note") {
    const o = orderOf(t);
    if (o && (o.admin_note || "") !== t.value) change(o, { admin_note: t.value.trim() || null });
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
function start() {
  $("#loginForm").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#logoutBtn").classList.remove("hidden");
  renderDuty();
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 15000);
}

$("#loginForm").addEventListener("submit", onLogin);
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); clearInterval(pollTimer); Store.adminLogout(); showLogin(); });
$("#tabs").addEventListener("click", e => { if (e.target.dataset.tab) { tab = e.target.dataset.tab; render(); } });
$("#reloadBtn").addEventListener("click", load);
$("#routeBtn").addEventListener("click", openRoute);
$("#dutyBtn").addEventListener("click", toggleDuty);
$("#icsBtn").addEventListener("click", () => exportIcs(agendaList().filter(active).sort(byTime)));
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
window.addEventListener("storage", e => { if (e.key === "livraison.orders.v1" && Store.session()) load(); });
document.addEventListener("visibilitychange", async () => {
  // Le verrou d'écran est relâché quand on quitte la page : le reprendre au retour
  if (document.visibilityState === "visible" && duty.watch != null && navigator.wakeLock) {
    try { duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
if (Store.session()) start(); else showLogin();

})();
