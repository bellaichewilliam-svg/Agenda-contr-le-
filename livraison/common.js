// ============================================================================
// Fonctions partagées : formatage, liens (WhatsApp, Waze, Maps), texte d'une course.
// ============================================================================

(function () {
"use strict";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loc() { return window.I18N && I18N.lang === "he" ? "he-IL" : "fr-FR"; }

function money(n) {
  return (Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " " + CONFIG.currency;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", timeZone: CONFIG.timezone });
}
function fmtDateTime(iso) { return fmtDay(iso) + " · " + fmtTime(iso); }
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
// Lien WhatsApp sans destinataire : l'utilisateur choisit le contact
function waShare(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
function placeQuery(o, which) {
  return which === "pickup" ? `${o.pickup_address}, ${cityFr(o.from_city)}` : `${o.dropoff_address}, ${cityFr(o.to_city)}`;
}
function wazeLink(o, which) { return "https://waze.com/ul?navigate=yes&q=" + encodeURIComponent(placeQuery(o, which)); }
function mapsLink(o, which) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(placeQuery(o, which)); }

function cityFr(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? c.fr : id;
}

// Adresse de base de l'app (pour les liens de suivi et de partage)
function appUrl(page) { return new URL(page || "./", location.href).href; }
function trackUrl(o) { return appUrl("suivi.html") + "?t=" + o.token; }

const SERVICE_FR = { colis: "Envoi de colis", retrait: "Retrait de colis", achat: "Achat pour le client", repas: "Repas / restaurant" };
const PLACE_FR = { poste: "Bureau de poste", superpharm: "Super-Pharm", relais: "Point relais", autre: "Magasin" };
const SIZE_FR = { petit: "Petit colis", moyen: "Colis moyen (5–15 kg)", gros: "Gros colis (15–30 kg)" };
const PAY_FR = { cash: "💵 Espèces", bit: "📱 Bit" };

function whenFr(o) {
  if (o.urgency === "express") return "⚡ EXPRESS (moins d'1 h)";
  if (o.urgency === "asap") return "Dès que possible (dans les 3 h)";
  return new Date(o.pickup_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}

// Texte complet d'une course pour le coursier (WhatsApp, agenda)
function orderText(o) {
  const L = [`📦 Commande ${o.ref} — ${SERVICE_FR[o.service]}`, `🕐 ${whenFr(o)}`, ``];
  L.push(`📍 ${o.service === "retrait" ? PLACE_FR[o.place_kind] || "Récupération" : "Récupération"} : ${o.pickup_address}, ${cityFr(o.from_city)}`);
  if (o.pickup_contact || o.pickup_phone) L.push(`   ${[o.pickup_contact, o.pickup_phone].filter(Boolean).join(" · ")}`);
  if (o.service === "retrait") {
    if (o.tracking_number) L.push(`   N° : ${o.tracking_number}`);
    if (o.parcel_name) L.push(`   Au nom de : ${o.parcel_name}`);
    if (o.place_kind === "poste") L.push(`   Procuration : ${o.has_proxy ? "oui" : "NON"}`);
  }
  if (o.service === "achat") {
    if (o.shopping_list) L.push(`   🛒 À acheter : ${o.shopping_list}`);
    if (o.budget) L.push(`   Budget : ${money(o.budget)} (avancé, remboursé à la livraison)`);
  }
  L.push(`🏁 Livraison : ${o.dropoff_address}, ${cityFr(o.to_city)}`);
  if (o.dropoff_contact || o.dropoff_phone) L.push(`   ${[o.dropoff_contact, o.dropoff_phone].filter(Boolean).join(" · ")}`);
  L.push(``, `${SIZE_FR[o.size] || o.size}${o.round_trip ? " · aller-retour" : ""}${o.extra_stops ? ` · +${o.extra_stops} arrêt(s)` : ""}`);
  if (o.notes) L.push(`📝 ${o.notes}`);
  L.push(``, `💰 ${money(o.price)} — ${PAY_FR[o.payment_method] || ""} — payé par ${o.payer === "destinataire" ? "le destinataire" : "le client"}`);
  if (o.promo_code) L.push(`🎁 ${o.promo_code} (-${money(o.discount || 0)})`);
  L.push(`👤 ${o.contact_name}${o.company ? " (" + o.company + ")" : ""} — ${o.contact_phone}`);
  if (o.token) L.push(``, `Suivi : ${trackUrl(o)}`);
  return L.join("\n");
}

function referralCode(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 4 ? CONFIG.promos.referral.prefix + d.slice(-4) : "";
}

// Message WhatsApp au client selon le statut de sa course, dans SA langue
function clientMessage(o) {
  const l = o.lang || "fr";
  const f = (k, v) => I18N.forLang(l, k, v);
  const city = id => { const c = CONFIG.cities.find(x => x.id === id); return c ? c[l] || c.fr : id; };
  const when = o.urgency === "programmee" ? f("msg_when_at", { when: whenFr(o) }) : f("msg_when_asap");
  const pay = o.payment_method === "bit" ? f("pay_bit_short", { phone: o.courier_bit || CONFIG.bitPhone }) : f("pay_cash_short");
  const msg = f("msg_" + o.status, {
    name: o.contact_name || "", ref: o.ref, when, price: money(o.price), pay, reason: o.admin_note || "",
    url: o.status === "refusee" ? appUrl() + "#commander" : trackUrl(o),
    to: `${o.dropoff_address}, ${city(o.to_city)}`, code: referralCode(o.contact_phone)
  });
  return o.receipt_number ? msg + "\n" + f("msg_receipt", { url: receiptUrl(o) }) : msg;
}

function receiptUrl(o) { return appUrl("recu.html") + "?t=" + o.token; }

// Semaines (dimanche → samedi) sur des clés de jour AAAA-MM-JJ
function weekStart(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function fmtKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
}

window.UI = {
  receiptUrl, referralCode, clientMessage, weekStart, addDays, fmtKey,
  esc, money, placeQuery, fmtTime, fmtDay, fmtDateTime, dayKey, intlPhone, waLink, waShare, wazeLink, mapsLink,
  cityFr, appUrl, trackUrl, orderText, whenFr, SERVICE_FR, PLACE_FR, SIZE_FR, PAY_FR
};

})();
