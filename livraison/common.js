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
// Notes des clients : moyenne et nombre d'avis d'une liste de courses
function ratingOf(list) {
  const r = (list || []).filter(o => o.rating != null);
  return r.length ? { avg: r.reduce((x, o) => x + Number(o.rating), 0) / r.length, n: r.length } : null;
}
const RATING_FR = { fast: "Rapide", nice: "Sympa", care: "Soigneux", found: "Bien trouvé", late: "En retard", damaged: "Colis abîmé", rude: "Pas aimable", lost: "Colis perdu" };
function ratingText(o) {
  return o.rating == null ? "" : "⭐".repeat(o.rating) + ` ${o.rating}/5` + ((o.rating_tags || []).length ? " · " + o.rating_tags.map(x => RATING_FR[x] || x).join(", ") : "");
}
// Barème d'attente / d'achats en clair (patron, livreurs)
function waitRule(st) {
  return `${st.wait_free_min} min offertes, puis +${money(st.wait_step_price)} par ${st.wait_step_min} min (max ${money(st.wait_max)})`;
}
// Fond de carte OpenStreetMap (gratuit, sans clé) ; version sombre par un filtre sur les tuiles
function mapTiles(map, dark) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap", className: dark ? "tiles-dark" : "" }).addTo(map);
}
function waShare(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
function placeQuery(o, which) {
  const brand = o[which + "_place"];
  return (brand ? brand + ", " : "") + (which === "pickup" ? `${o.pickup_address}, ${cityFr(o.from_city)}` : `${o.dropoff_address}, ${cityFr(o.to_city)}`);
}
// Adresse choisie sur la carte : on navigue vers ses coordonnées exactes
function exactPoint(o, which) {
  return o[which + "_exact"] && o[which + "_lat"] != null ? `${o[which + "_lat"]},${o[which + "_lon"]}` : null;
}
function wazeLink(o, which) {
  const ll = exactPoint(o, which);
  return ll ? `https://waze.com/ul?ll=${ll}&navigate=yes` : "https://waze.com/ul?navigate=yes&q=" + encodeURIComponent(placeQuery(o, which));
}
function mapsLink(o, which) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(exactPoint(o, which) || placeQuery(o, which));
}

function cityFr(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? c.fr : id;
}

// Adresse de base de l'app (pour les liens de suivi et de partage)
// Zone d'une ville (Sharon par défaut) et zone ouverte ou « bientôt »
function cityZone(id) { const c = CONFIG.cities.find(x => x.id === id); return (c && c.zone) || "sharon"; }
function cityActive(id) {
  if (!CONFIG.cities.some(x => x.id === id)) return true;  // autre ville tapée : vérifiée par l'adresse
  const z = (CONFIG.zones || []).find(x => x.id === cityZone(id));
  return !z || z.active !== false;
}

function appUrl(page) { return new URL(page || "./", location.href).href; }
function trackUrl(o) { return appUrl("suivi.html") + "?t=" + o.token; }

const SERVICE_FR = { colis: "Envoi de colis", retrait: "Retrait de colis", achat: "Achat pour le client", repas: "Repas / restaurant" };
const PLACE_FR = { poste: "Bureau de poste", superpharm: "Super-Pharm", relais: "Point relais", autre: "Magasin" };
const SIZE_FR = { petit: "Petit colis", moyen: "Colis moyen (5–15 kg)", gros: "Gros colis (15–30 kg)" };
const PAY_FR = { cash: "💵 Espèces", bit: "📱 Bit", carnet: "🎟️ Carnet pro" };

function whenFr(o) {
  if (o.urgency === "express") return "⚡ EXPRESS (moins d'une heure)";
  if (o.urgency === "asap") return "Dès que possible (dans les 3 h)";
  return new Date(o.pickup_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}

// Texte complet d'une course pour le coursier (WhatsApp, agenda)
function orderText(o) {
  const L = [`📦 Commande ${o.ref} — ${SERVICE_FR[o.service]}`, `🕐 ${whenFr(o)}`, ``];
  L.push(`📍 ${o.service === "retrait" ? PLACE_FR[o.place_kind] || "Récupération" : "Récupération"} : ${o.pickup_place ? "🏪 " + o.pickup_place + ", " : ""}${o.pickup_address}, ${cityFr(o.from_city)}`);
  if (addrDetailsText(o, "pickup")) L.push(`   🏢 ${addrDetailsText(o, "pickup")}`);
  if (o.pickup_note) L.push(`   📝 ${o.pickup_note}`);
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
  L.push(`🏁 Livraison : ${o.dropoff_place ? "🏪 " + o.dropoff_place + ", " : ""}${o.dropoff_address}, ${cityFr(o.to_city)}`);
  if (addrDetailsText(o, "dropoff")) L.push(`   🏢 ${addrDetailsText(o, "dropoff")}`);
  if (o.dropoff_note) L.push(`   📝 ${o.dropoff_note}`);
  if (o.leave_at_door) L.push(`   🚪 DÉPOSER DEVANT LA PORTE (sans contact) + photo au client`);
  if (o.dropoff_contact || o.dropoff_phone) L.push(`   ${[o.dropoff_contact, o.dropoff_phone].filter(Boolean).join(" · ")}`);
  L.push(``, `${SIZE_FR[o.size] || o.size}${o.round_trip ? " · aller-retour" : ""}${o.extra_stops ? ` · +${o.extra_stops} arrêt(s)` : ""}`);
  if (o.notes) L.push(`📝 ${o.notes}`);
  L.push(``, `💰 ${money(o.price)} — ${PAY_FR[o.payment_method] || ""} — payé par ${o.payer === "destinataire" ? "le destinataire" : "le client"}${o.prepaid_required ? " — 💳 À PAYER D'AVANCE" : ""}`);
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
// Nom de la marque en haut des pages clients : « HOP! » + « Livraison » (ou « Pro »)
function wordmark(sub) {
  const he = window.I18N && I18N.lang === "he";
  const small = sub || (he ? "משלוחים" : "Livraison");
  return `<b>${he ? "הופ" : "HOP"}<i>!</i></b><small>${esc(small)}</small>`;
}

// Minutes avant la livraison (position du livreur connue), sinon null.
// Course acceptée : trajet jusqu'au départ + 5 min sur place + trajet jusqu'à l'arrivée.
function deliveryEta(o) {
  if (!o) return null;
  // HOP! Pro : commande en préparation → l'heure annoncée par le commerce + le trajet
  const readyIn = o.ready_at && ["acceptee", "prete"].includes(o.shop_status) && ["nouvelle", "confirmee"].includes(o.status)
    ? Math.max(0, Math.ceil((new Date(o.ready_at) - Date.now()) / 60000)) : 0;
  if (readyIn > 0 && o.pickup_lat != null && o.dropoff_lat != null) {
    const p = { lat: Number(o.pickup_lat), lon: Number(o.pickup_lon) }, d = { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) };
    return readyIn + Pricing.etaMinutes(p, d);
  }
  if (o.courier_lat == null || o.dropoff_lat == null) return null;
  const c = { lat: Number(o.courier_lat), lon: Number(o.courier_lon) }, d = { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) };
  if (o.status === "recuperee") return Pricing.etaMinutes(c, d);
  if (o.status === "confirmee" && o.pickup_lat != null) {
    const p = { lat: Number(o.pickup_lat), lon: Number(o.pickup_lon) };
    return Pricing.etaMinutes(c, p) + 5 + Pricing.etaMinutes(p, d);
  }
  return null;
}
// Avancement de la course pour l'anneau (0 à 1)
const PROGRESS = { nouvelle: 0.12, confirmee: 0.4, recuperee: 0.72, livree: 1 };

// Commission HOP d'une course de livreur : 12 % du prix, au moins 3 ₪ (voir config.js)
function commissionText() { return `${CONFIG.platform.commissionPercent} % du prix (au moins ${money(CONFIG.platform.commissionPerCourse)})`; }

// Numéro Bit à payer : toujours celui de HOP (le livreur n'encaisse que les espèces)
function bitFor() { return CONFIG.bitPhone; }

function clientMessage(o) {
  const l = o.lang || "fr";
  const f = (k, v) => I18N.forLang(l, k, v);
  const city = id => { const c = CONFIG.cities.find(x => x.id === id); return c ? c[l] || c.fr : id; };
  const when = o.urgency === "programmee" ? f("msg_when_at", { when: whenFr(o) }) : f("msg_when_asap");
  const pay = o.payment_method === "carnet" ? f("pay_carnet")
    : o.payment_method === "bit" ? f("pay_bit_short", { phone: bitFor(o) }) : f("pay_cash_short");
  const msg = f("msg_" + o.status, {
    name: o.contact_name || "", ref: o.ref, when, price: money(o.price), pay, reason: o.admin_note || "",
    url: o.status === "refusee" ? appUrl() + "#commander" : trackUrl(o),
    to: `${o.dropoff_address}, ${city(o.to_city)}`, code: referralCode(o.contact_phone)
  });
  return o.receipt_number ? msg + "\n" + f("msg_receipt", { url: receiptUrl(o) }) : msg;
}

function receiptUrl(o) { return appUrl("recu.html") + "?t=" + o.token; }
function carnetReceiptUrl(sale) { return appUrl("recu.html") + "?c=" + sale.token; }

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

// Étage / appartement / code d'une adresse, en texte (pour WhatsApp et l'agenda)
function addrDetailsText(o, which) {
  const p = [];
  if (o[which + "_building"]) p.push(`bâtiment ${o[which + "_building"]}`);
  if (o[which + "_floor"]) p.push(`étage ${o[which + "_floor"]}`);
  if (o[which + "_apt"]) p.push(`appt ${o[which + "_apt"]}`);
  if (o[which + "_code"]) p.push(`code ${o[which + "_code"]}`);
  return p.join(" · ");
}
function addrDetails(o, which, lang) {
  const t = k => window.I18N ? I18N.forLang(lang || "fr", k) : k;
  const p = [];
  if (o[which + "_building"]) p.push(`<span><small>${esc(t("building"))}</small><b>${esc(o[which + "_building"])}</b></span>`);
  if (o[which + "_floor"]) p.push(`<span><small>${esc(t("floor"))}</small><b>${esc(o[which + "_floor"])}</b></span>`);
  if (o[which + "_apt"]) p.push(`<span><small>${esc(t("apt"))}</small><b>${esc(o[which + "_apt"])}</b></span>`);
  if (o[which + "_code"]) p.push(`<span><small>${esc(t("entryCode"))}</small><b dir="ltr">${esc(o[which + "_code"])}</b></span>`);
  return p.length ? `<div class="addr-details">${p.join("")}</div>` : "";
}
function doorTag(o, lang) {
  return o.leave_at_door ? `<div class="door-tag">${esc(window.I18N ? I18N.forLang(lang || "fr", "doorTag") : "🚪")}</div>` : "";
}

// Remarque sur une adresse (étage, code…), affichée sous l'adresse
// Nom de l'enseigne (Super-Pharm, restaurant…) au-dessus de l'adresse
function brand(name) { return name ? `<span class="brand-tag">🏪 <bdi>${esc(name)}</bdi></span>` : ""; }
function addrNote(note) { return note ? `<div class="addr-note">📝 ${esc(note)}</div>` : ""; }

window.UI = {
  addrNote, brand, addrDetails, addrDetailsText, doorTag,
  deliveryEta, PROGRESS, commissionText, cityZone, cityActive, receiptUrl, carnetReceiptUrl, referralCode, clientMessage, bitFor, wordmark, weekStart, addDays, fmtKey,
  mapTiles, waitRule, ratingOf, ratingText, esc, money, placeQuery, fmtTime, fmtDay, fmtDateTime, dayKey, intlPhone, waLink, waShare, wazeLink, mapsLink,
  cityFr, appUrl, trackUrl, orderText, whenFr, SERVICE_FR, PLACE_FR, SIZE_FR, PAY_FR
};

})();
