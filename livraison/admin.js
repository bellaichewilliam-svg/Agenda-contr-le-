// ============================================================================
// Espace livreur : agenda des courses, changements de statut, alertes, facturation.
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
    $("#loginHint").textContent = "Connectez-vous avec le compte livreur créé dans Supabase.";
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
    [0, 0.25].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) { /* audio indisponible */ }
}

function alertNew(list) {
  beep();
  if (window.Notification && Notification.permission === "granted") {
    list.forEach(o => new Notification(`🆕 Course ${o.ref} — ${UI.money(o.price)}`, {
      body: `${o.urgency === "express" ? "EXPRESS" : UI.fmtDateTime(o.pickup_at)}\n${o.pickup_address} → ${o.dropoff_address}\n${o.company}`
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
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit" });
  // Ne pas effacer un champ en cours de saisie
  const typing = document.activeElement && $("#view").contains(document.activeElement)
    && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing) renderStats(); else render();
}

// --- Rendu ----------------------------------------------------------------------
const today = () => UI.dayKey(new Date().toISOString());
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const active = o => ["nouvelle", "confirmee", "recuperee"].includes(o.status);

function renderStats() {
  const t = today(), month = t.slice(0, 7);
  const todays = orders.filter(o => UI.dayKey(o.pickup_at) === t && o.status !== "annulee");
  const sum = list => list.reduce((s, o) => s + Number(o.price), 0);
  $("#stNew").textContent = orders.filter(o => o.status === "nouvelle").length;
  $("#stToday").textContent = todays.length;
  $("#stTodayRev").textContent = UI.money(sum(todays.filter(o => o.status === "livree")));
  $("#stMonthRev").textContent = UI.money(sum(orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(month))));
}

function clientMessage(o) {
  const name = o.contact_name ? `Bonjour ${o.contact_name}, ` : "Bonjour, ";
  switch (o.status) {
    case "confirmee": return `${name}votre course ${o.ref} est confirmée ✅\n${o.urgency === "express" ? "Je pars dès que possible." : "Récupération " + UI.fmtDateTime(o.pickup_at) + "."}\nPrix : ${UI.money(o.price)}`;
    case "recuperee": return `${name}le colis de la course ${o.ref} est récupéré 🛵 Je suis en route vers ${o.dropoff_address}.`;
    case "livree": return `${name}la course ${o.ref} a bien été livrée 📦 Merci pour votre confiance !`;
    case "annulee": return `${name}la course ${o.ref} est annulée.`;
    default: return `${name}j'ai bien reçu votre course ${o.ref}.`;
  }
}

function actionsFor(o) {
  const b = (status, label, cls = "") => `<button class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
  const steps = {
    nouvelle: b("confirmee", "✅ Confirmer", "btn-primary") + b("annulee", "✖ Refuser"),
    confirmee: b("recuperee", "🛵 Colis récupéré", "btn-primary") + b("annulee", "✖ Annuler"),
    recuperee: b("livree", "📦 Livré", "btn-primary")
  };
  return `<div class="actions">
    ${steps[o.status] || ""}
    <a class="btn btn-sm btn-wa" href="${UI.waLink(o.contact_phone, clientMessage(o))}" target="_blank" rel="noopener">💬 Prévenir le client</a>
    <button class="btn btn-sm" data-act="price">✏️ Prix</button>
    <button class="btn btn-sm" data-act="ics">📅</button>
    <textarea class="admin-note" data-act="note" rows="1" placeholder="Message visible par le client (ex. retard, prix ajusté)…">${UI.esc(o.admin_note || "")}</textarea>
  </div>`;
}

const card = o => UI.orderCard(o, { admin: true, actions: actionsFor(o) });

function groupedByDay(list) {
  const groups = {};
  list.forEach(o => { (groups[UI.dayKey(o.pickup_at)] = groups[UI.dayKey(o.pickup_at)] || []).push(o); });
  const t = today();
  return Object.keys(groups).sort().map(k => {
    const label = k === t ? "Aujourd'hui" : k < t ? `En retard — ${UI.fmtDay(groups[k][0].pickup_at)}` : UI.fmtDay(groups[k][0].pickup_at);
    return `<div class="day-title">${label} · ${groups[k].length} course(s)</div><div class="orders">${groups[k].sort(byTime).map(card).join("")}</div>`;
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
    view.innerHTML = list.length ? groupedByDay(list) : empty("Aucune course à venir. Partagez votre page de commande à vos clients !");
  } else if (tab === "nouvelles") {
    const list = orders.filter(o => o.status === "nouvelle").sort(byTime);
    view.innerHTML = list.length ? `<div class="orders">${list.map(card).join("")}</div>` : empty("Aucune course à confirmer 👍");
  } else if (tab === "historique") {
    const q = histFilter.q.toLowerCase();
    const list = orders
      .filter(o => !histFilter.status || o.status === histFilter.status)
      .filter(o => !q || [o.ref, o.company, o.contact_name, o.pickup_address, o.dropoff_address].join(" ").toLowerCase().includes(q))
      .sort((a, b) => byTime(b, a));
    view.innerHTML = `<div class="toolbar">
        <select id="histStatus"><option value="">Tous les statuts</option>${Object.entries(Store.STATUSES).map(([k, s]) => `<option value="${k}" ${histFilter.status === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
        <input id="histQ" type="search" placeholder="Rechercher (client, adresse, réf.)" value="${UI.esc(histFilter.q)}" />
      </div>
      ${list.length ? `<div class="orders">${list.map(o => card(o).replace('class="order-time">', `class="order-time">${UI.fmtDay(o.pickup_at)} · `)).join("")}</div>` : empty("Aucune course.")}`;
  } else {
    renderBilling(view);
  }
}

function monthOrders() {
  return orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(billMonth));
}

function renderBilling(view) {
  const list = monthOrders();
  const byCompany = {};
  list.forEach(o => {
    const c = byCompany[o.company] = byCompany[o.company] || { n: 0, total: 0, phone: o.contact_phone, email: o.contact_email };
    c.n++; c.total += Number(o.price);
  });
  const rows = Object.entries(byCompany).sort((a, b) => b[1].total - a[1].total);
  const total = rows.reduce((s, r) => s + r[1].total, 0);
  view.innerHTML = `<div class="toolbar">
      <label class="small muted">Mois <input type="month" id="billMonth" value="${billMonth}" /></label>
      <button class="btn btn-sm" id="csvBtn" ${list.length ? "" : "disabled"}>⬇️ Exporter le détail (CSV)</button>
    </div>
    <p class="muted small" style="margin-bottom:10px">Courses livrées pendant le mois, par client.</p>
    <table class="bill">
      <thead><tr><th>Client</th><th class="num">Courses</th><th class="num">Montant</th><th></th></tr></thead>
      <tbody>${rows.map(([name, c]) => `<tr><td><b>${UI.esc(name)}</b><br><span class="small muted">${UI.esc(c.phone || "")} ${UI.esc(c.email || "")}</span></td><td class="num">${c.n}</td><td class="num"><b>${UI.money(c.total)}</b></td>
        <td class="num"><a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(c.phone, `Bonjour, voici le récapitulatif de vos courses pour ${billMonth} : ${c.n} course(s), total ${UI.money(c.total)}. Merci !`)}">Envoyer</a></td></tr>`).join("")
        || `<tr><td colspan="4" class="muted">Aucune course livrée ce mois-ci.</td></tr>`}</tbody>
      <tfoot><tr><th>Total</th><th class="num">${list.length}</th><th class="num">${UI.money(total)}</th><th></th></tr></tfoot>
    </table>`;
}

// --- Exports --------------------------------------------------------------------
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  const cols = ["ref", "pickup_at", "company", "contact_name", "contact_phone", "service", "pickup_address", "dropoff_address", "distance_km", "price"];
  const cell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [cols.join(";")].concat(monthOrders().sort(byTime).map(o =>
    cols.map(c => cell(c === "pickup_at" ? UI.fmtDateTime(o[c]) : o[c])).join(";")));
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
    `SUMMARY:${escTxt(`🛵 ${o.ref} · ${o.company} · ${UI.money(o.price)}`)}`,
    `LOCATION:${escTxt(o.pickup_address)}`,
    `DESCRIPTION:${escTxt(UI.orderText(o))}`,
    "END:VEVENT"
  ].join("\r\n");
}

function exportIcs(list) {
  if (!list.length) return alert("Aucune course à exporter.");
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Livraison//FR", ...list.map(icsEvent), "END:VCALENDAR"].join("\r\n");
  download(list.length === 1 ? `${list[0].ref}.ics` : "courses.ics", body, "text/calendar");
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
    change(o, { status: el.dataset.status });
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
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 20000);
}

UI.bindConfigText();
$("#loginForm").addEventListener("submit", onLogin);
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); clearInterval(pollTimer); Store.adminLogout(); showLogin(); });
$("#tabs").addEventListener("click", e => { if (e.target.dataset.tab) { tab = e.target.dataset.tab; render(); } });
$("#reloadBtn").addEventListener("click", load);
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

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
if (Store.session()) start(); else showLogin();

})();
