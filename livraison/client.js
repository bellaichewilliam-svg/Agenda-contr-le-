// ============================================================================
// Page client : présentation, formulaire de commande avec prix en direct, suivi.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const form = $("#orderForm");
const P = CONFIG.pricing;
const state = { distanceKm: null, routeSeq: 0 };

// --- Présentation -------------------------------------------------------------
function renderIntro() {
  UI.bindConfigText();
  $("#demoBanner").classList.toggle("hidden", Store.ONLINE);

  const open = Pricing.isOpenNow(CONFIG);
  const badge = $("#openBadge");
  badge.textContent = open ? "Ouvert maintenant" : "Fermé pour le moment — programmez votre course";
  badge.classList.toggle("closed", !open);

  const rows = [
    [`Prise en charge, ${P.includedKm} premiers km inclus`, UI.money(P.base)],
    [`Kilomètre supplémentaire`, UI.money(P.perKm)],
    ...Object.values(P.sizes).filter(s => s.extra).map(s => [s.label, "+ " + UI.money(s.extra)]),
    [`Retrait de colis à la poste`, "+ " + UI.money(P.postOfficeExtra)],
    [`Arrêt supplémentaire`, "+ " + UI.money(P.extraStop)],
    [`Aller-retour`, `+ ${P.returnTripPercent} %`],
    [`Course express (dès que possible)`, `+ ${P.expressPercent} %`]
  ];
  $("#priceTable").innerHTML = rows.map(r => `<tr><td>${UI.esc(r[0])}</td><td>${r[1]}</td></tr>`).join("");

  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  $("#hoursTable").innerHTML = days.map((d, i) => {
    const h = CONFIG.hours[i];
    return `<tr><td>${d}</td><td>${h ? `${h[0]}h – ${h[1]}h` : '<span class="muted">Fermé</span>'}</td></tr>`;
  }).join("");

  $("#footerContact").innerHTML = `📞 <a href="tel:${UI.esc(CONFIG.phoneDisplay)}">${UI.esc(CONFIG.phoneDisplay)}</a> · ✉️ <a href="mailto:${UI.esc(CONFIG.email)}">${UI.esc(CONFIG.email)}</a>`;
}

// --- Formulaire ---------------------------------------------------------------
function pad(n) { return String(n).padStart(2, "0"); }

// Premier créneau valide (par quart d'heure) après le délai minimum
function firstSlot() {
  const d = new Date(Date.now() + CONFIG.minLeadMinutes * 60000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  for (let i = 0; i < 14 * 24 * 4; i++) {
    if (!Pricing.checkSchedule(d, CONFIG)) return d;
    d.setMinutes(d.getMinutes() + 15);
  }
  return d;
}

function fillDefaults() {
  $("#sizeSelect").innerHTML = Object.entries(P.sizes)
    .map(([k, s]) => `<option value="${k}">${UI.esc(s.label)}${s.extra ? ` (+${UI.money(s.extra)})` : ""}</option>`).join("");
  $("#sizeSelect").value = "petit";

  const slot = firstSlot();
  form.date.value = `${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}`;
  form.date.min = new Date().toISOString().slice(0, 10);
  form.time.value = `${pad(slot.getHours())}:${pad(slot.getMinutes())}`;

  const p = Store.getProfile();
  ["company", "contact_name", "contact_phone", "contact_email"].forEach(k => { if (p[k]) form[k].value = p[k]; });
  if (p.pickup_address) form.pickup_address.value = p.pickup_address;
}

function val(name) { return form.elements[name].value; }

function syncVisibility() {
  const poste = val("service") === "poste";
  $("#posteFields").classList.toggle("hidden", !poste);
  $("#pickupContactWrap").classList.toggle("hidden", poste);
  $("#pickupPhoneWrap").classList.toggle("hidden", poste);
  $("#pickupLabel").textContent = poste ? "Adresse du bureau de poste" : "Adresse de récupération";
  form.pickup_address.placeholder = poste ? "Ex. Doar Israel, rue Herzl 10, Netanya" : "Rue, numéro, ville";

  const express = val("urgency") === "express";
  $("#whenFields").classList.toggle("hidden", express);
}

function pickupDate() {
  if (val("urgency") === "express") return new Date();
  const [y, m, d] = val("date").split("-").map(Number);
  const [hh, mm] = val("time").split(":").map(Number);
  if (!y || isNaN(hh)) return null;
  return new Date(y, m - 1, d, hh, mm);
}

function scheduleError() {
  if (val("urgency") === "express") {
    return Pricing.isOpenNow(CONFIG) ? null : "L'express n'est possible que pendant les horaires d'ouverture. Programmez une heure précise.";
  }
  return Pricing.checkSchedule(pickupDate(), CONFIG);
}

function currentQuote() {
  return Pricing.computeQuote({
    distanceKm: state.distanceKm,
    size: val("size"),
    service: val("service"),
    urgency: val("urgency"),
    roundTrip: form.round_trip.checked,
    extraStops: val("extra_stops")
  }, P);
}

function renderQuote() {
  const q = currentQuote();
  $("#quoteLines").innerHTML = q.lines.map(l => `<li><span>${UI.esc(l.label)}</span><span>${UI.money(l.amount)}</span></li>`).join("");
  $("#quoteTotal").textContent = (q.distanceKnown ? "" : "dès ") + UI.money(q.total);
  $("#quoteNote").textContent = q.distanceKnown
    ? "Prix ferme, calculé sur la distance par la route."
    : "La distance n'est pas encore calculée : le prix final vous sera confirmé par le livreur.";
  const err = scheduleError();
  $("#scheduleError").textContent = err || "";
  $("#scheduleError").classList.toggle("hidden", !err);
}

let routeTimer;
function scheduleRoute() {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(updateRoute, 700);
}

async function updateRoute() {
  const from = val("pickup_address").trim(), to = val("dropoff_address").trim();
  const seq = ++state.routeSeq;
  state.distanceKm = null;
  if (from.length < 5 || to.length < 5) {
    $("#routeInfo").textContent = "Saisissez les deux adresses pour calculer la distance.";
    renderQuote();
    return;
  }
  $("#routeInfo").textContent = "Calcul de la distance…";
  renderQuote();
  try {
    const a = await Pricing.geocode(from, CONFIG.countryCode);
    const b = await Pricing.geocode(to, CONFIG.countryCode);
    if (seq !== state.routeSeq) return;
    if (!a || !b) {
      $("#routeInfo").textContent = `⚠️ Adresse ${!a ? "de récupération" : "de livraison"} introuvable sur la carte. Précisez la ville, ou continuez : le livreur confirmera le prix.`;
    } else {
      const km = await Pricing.routeKm(a, b);
      if (seq !== state.routeSeq) return;
      state.distanceKm = Math.round(km * 10) / 10;
      $("#routeInfo").textContent = `🛣️ ${state.distanceKm.toFixed(1)} km par la route`;
    }
  } catch (e) {
    if (seq === state.routeSeq) $("#routeInfo").textContent = "⚠️ Calcul de distance indisponible. Le livreur confirmera le prix.";
  }
  renderQuote();
}

function showError(msg) {
  $("#formError").textContent = msg || "";
  $("#formError").classList.toggle("hidden", !msg);
}

async function submit(e) {
  e.preventDefault();
  showError("");
  const required = ["pickup_address", "dropoff_address", "company", "contact_name", "contact_phone"];
  const missing = required.find(k => !val(k).trim());
  if (missing) {
    form.elements[missing].focus();
    return showError("Merci de remplir tous les champs obligatoires (adresses, entreprise, nom, téléphone).");
  }
  const err = scheduleError();
  if (err) return showError(err);

  const q = currentQuote();
  const order = {
    service: val("service"),
    urgency: val("urgency"),
    pickup_at: pickupDate().toISOString(),
    pickup_address: val("pickup_address").trim(),
    pickup_contact: val("pickup_contact").trim() || null,
    pickup_phone: val("pickup_phone").trim() || null,
    dropoff_address: val("dropoff_address").trim(),
    dropoff_contact: val("dropoff_contact").trim() || null,
    dropoff_phone: val("dropoff_phone").trim() || null,
    size: val("size"),
    round_trip: form.round_trip.checked,
    extra_stops: parseInt(val("extra_stops"), 10) || 0,
    distance_km: q.distanceKm,
    price: q.total,
    tracking_number: val("service") === "poste" ? val("tracking_number").trim() || null : null,
    parcel_name: val("service") === "poste" ? val("parcel_name").trim() || null : null,
    has_proxy: val("service") === "poste" && form.has_proxy.checked,
    notes: val("notes").trim() || null,
    company: val("company").trim(),
    contact_name: val("contact_name").trim(),
    contact_phone: val("contact_phone").trim(),
    contact_email: val("contact_email").trim() || null
  };

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = "Envoi…";
  try {
    const saved = await Store.createOrder(order);
    Store.saveProfile({
      company: order.company, contact_name: order.contact_name,
      contact_phone: order.contact_phone, contact_email: order.contact_email,
      pickup_address: order.service === "course" ? order.pickup_address : (Store.getProfile().pickup_address || "")
    });
    $("#doneText").innerHTML = `Référence <b>${UI.esc(saved.ref)}</b> · ${UI.money(saved.price)}<br>`
      + (Store.ONLINE ? "Le livreur a reçu votre demande et va la confirmer." : "Envoyez-la au livreur sur WhatsApp pour qu'il la reçoive.");
    $("#doneWa").href = UI.waLink(CONFIG.whatsapp, UI.orderText(saved));
    $("#doneModal").classList.remove("hidden");
    form.notes.value = "";
    form.tracking_number.value = "";
    form.parcel_name.value = "";
    renderMine();
  } catch (ex) {
    showError("La commande n'a pas pu être envoyée. Vérifiez votre connexion ou contactez-nous au " + CONFIG.phoneDisplay + ".");
  } finally {
    btn.disabled = false;
    btn.textContent = "Valider la commande";
  }
}

// --- Mes courses --------------------------------------------------------------
async function renderMine() {
  const box = $("#myOrders");
  let orders;
  try { orders = await Store.myOrders(); }
  catch (e) { box.innerHTML = `<p class="notice err">Impossible de charger vos courses pour le moment.</p>`; return; }
  if (!orders.length) {
    box.innerHTML = `<div class="empty card">Aucune course pour l'instant. <a href="#commander">Commander la première →</a></div>`;
    return;
  }
  orders.sort((a, b) => new Date(b.pickup_at) - new Date(a.pickup_at));
  box.innerHTML = orders.map(o => UI.orderCard(o, {
    actions: `<div class="actions">
      <a class="btn btn-sm btn-wa" href="${UI.waLink(CONFIG.whatsapp, `Bonjour, à propos de ma course ${o.ref} :`)}" target="_blank" rel="noopener">💬 Contacter le livreur</a>
      ${o.status === "nouvelle" ? `<button class="btn btn-sm" data-cancel="${UI.esc(o.token)}">Annuler</button>` : ""}
    </div>`
  })).join("");
}

async function onListClick(e) {
  const token = e.target.dataset.cancel;
  if (!token || !confirm("Annuler cette course ?")) return;
  try { await Store.cancelMyOrder(token); } catch (ex) { alert("Annulation impossible, contactez le livreur."); }
  renderMine();
}

// --- Démarrage ----------------------------------------------------------------
renderIntro();
fillDefaults();
syncVisibility();
renderQuote();
if (val("pickup_address")) scheduleRoute();

form.addEventListener("input", e => {
  if (e.target.name === "pickup_address" || e.target.name === "dropoff_address") scheduleRoute();
  syncVisibility();
  renderQuote();
});
form.addEventListener("change", () => { syncVisibility(); renderQuote(); });
form.addEventListener("submit", submit);
$("#doneClose").addEventListener("click", () => { $("#doneModal").classList.add("hidden"); location.hash = "mes-courses"; });
$("#refreshMine").addEventListener("click", renderMine);
$("#myOrders").addEventListener("click", onListClick);
renderMine();
if (Store.ONLINE) setInterval(renderMine, 60000);

})();
