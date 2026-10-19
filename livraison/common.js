// ============================================================================
// Fonctions partagées : formatage, liens (WhatsApp, Waze, Maps) et carte d'une course.
// ============================================================================

(function () {
"use strict";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function money(n) {
  return (Math.round(n * 100) / 100).toLocaleString(CONFIG.locale, { maximumFractionDigits: 2 }) + " " + CONFIG.currency;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(CONFIG.locale, { weekday: "long", day: "numeric", month: "long", timeZone: CONFIG.timezone });
}
function fmtDateTime(iso) { return fmtDay(iso) + " à " + fmtTime(iso); }
// Clé de jour AAAA-MM-JJ dans le fuseau de l'entreprise
function dayKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: CONFIG.timezone });
}

function intlPhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = CONFIG.phoneCountryPrefix + d.slice(1);
  return d;
}
function waLink(phone, text) {
  return "https://wa.me/" + intlPhone(phone) + "?text=" + encodeURIComponent(text);
}
function wazeLink(address) { return "https://waze.com/ul?navigate=yes&q=" + encodeURIComponent(address); }
function mapsLink(address) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address); }

const SERVICE_LABEL = { course: "Course", poste: "Retrait à la poste" };

function orderText(o) {
  const lines = [
    `📦 Nouvelle commande ${o.ref}`,
    `${SERVICE_LABEL[o.service]}${o.urgency === "express" ? " — ⚡ EXPRESS" : ""}`,
    `🕐 ${o.urgency === "express" ? "Dès que possible" : fmtDateTime(o.pickup_at)}`,
    ``,
    `📍 Récupération : ${o.pickup_address}`
  ];
  if (o.pickup_contact || o.pickup_phone) lines.push(`   ${[o.pickup_contact, o.pickup_phone].filter(Boolean).join(" · ")}`);
  if (o.service === "poste") {
    if (o.tracking_number) lines.push(`   N° de suivi : ${o.tracking_number}`);
    if (o.parcel_name) lines.push(`   Au nom de : ${o.parcel_name}`);
    lines.push(`   Procuration : ${o.has_proxy ? "oui" : "non"}`);
  }
  lines.push(`🏁 Livraison : ${o.dropoff_address}`);
  if (o.dropoff_contact || o.dropoff_phone) lines.push(`   ${[o.dropoff_contact, o.dropoff_phone].filter(Boolean).join(" · ")}`);
  lines.push(``, `Colis : ${(CONFIG.pricing.sizes[o.size] || {}).label || o.size}`);
  if (o.round_trip) lines.push(`Aller-retour`);
  if (o.extra_stops) lines.push(`Arrêts supplémentaires : ${o.extra_stops}`);
  if (o.notes) lines.push(`Note : ${o.notes}`);
  lines.push(``, `💰 Prix : ${money(o.price)}${o.distance_km != null ? ` (${Number(o.distance_km).toFixed(1)} km)` : " (distance à confirmer)"}`);
  lines.push(`👤 ${o.company} — ${o.contact_name} — ${o.contact_phone}`);
  return lines.join("\n");
}

const FLOW = ["nouvelle", "confirmee", "recuperee", "livree"];

// Carte HTML d'une course. opts.admin ajoute les liens de navigation et d'appel.
function orderCard(o, opts = {}) {
  const st = Store.STATUSES[o.status] || { label: o.status, icon: "" };
  const step = FLOW.indexOf(o.status);
  const when = o.urgency === "express"
    ? `⚡ Express · ${fmtDay(o.pickup_at)}`
    : `${fmtTime(o.pickup_at)}${opts.admin ? "" : " · " + fmtDay(o.pickup_at)}`;
  const tel = (name, phone) => phone
    ? `${esc(name || "")} · <a href="tel:${esc(phone)}">${esc(phone)}</a>`
    : esc(name || "");
  const navLinks = addr => opts.admin
    ? `<div class="links"><a class="btn btn-sm" href="${wazeLink(addr)}" target="_blank" rel="noopener">Waze</a><a class="btn btn-sm" href="${mapsLink(addr)}" target="_blank" rel="noopener">Google Maps</a></div>`
    : "";

  const meta = [
    `<span class="pill">${SERVICE_LABEL[o.service]}</span>`,
    `<span class="pill">${esc((CONFIG.pricing.sizes[o.size] || {}).label || o.size)}</span>`
  ];
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km != null) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(1)} km</span>`);
  if (opts.admin) meta.push(`<span class="pill">🏢 ${esc(o.company)} · ${tel(o.contact_name, o.contact_phone)}</span>`);

  const poste = o.service === "poste"
    ? `<div class="small muted">N° de suivi : <b style="display:inline">${esc(o.tracking_number || "—")}</b> · au nom de ${esc(o.parcel_name || "—")} · procuration : ${o.has_proxy ? "oui" : "non"}</div>`
    : "";

  return `
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${esc(o.id || "")}" data-token="${esc(o.token || "")}">
    <div class="order-head">
      <span class="order-time">${when}</span>
      <span class="pill st-${esc(o.status)}">${st.icon} ${st.label}</span>
      <span class="order-ref">${esc(o.ref)}</span>
      <span class="order-price">${money(o.price)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span class="pin">📍</span><div><b>${esc(o.pickup_address)}</b>${poste}<span class="small muted">${tel(o.pickup_contact, o.pickup_phone)}</span>${navLinks(o.pickup_address)}</div></div>
      <div class="leg"><span class="pin">🏁</span><div><b>${esc(o.dropoff_address)}</b><span class="small muted">${tel(o.dropoff_contact, o.dropoff_phone)}</span>${navLinks(o.dropoff_address)}</div></div>
    </div>
    <div class="meta">${meta.join("")}</div>
    ${o.notes ? `<p class="notice" style="margin-top:10px">📝 ${esc(o.notes)}</p>` : ""}
    ${!opts.admin && o.admin_note ? `<p class="notice warn" style="margin-top:10px">💬 Livreur : ${esc(o.admin_note)}</p>` : ""}
    ${o.status !== "annulee" ? `<div class="progress">${FLOW.map((_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>` : ""}
    ${opts.actions || ""}
  </article>`;
}

function bindConfigText() {
  document.querySelectorAll("[data-bind]").forEach(el => { el.textContent = CONFIG[el.dataset.bind]; });
  document.title = document.title.replace("Coursier Express", CONFIG.businessName);
}

window.UI = { esc, money, fmtTime, fmtDay, fmtDateTime, dayKey, intlPhone, waLink, wazeLink, mapsLink, orderText, orderCard, bindConfigText, SERVICE_LABEL };

})();
