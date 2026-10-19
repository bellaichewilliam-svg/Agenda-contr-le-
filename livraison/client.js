// ============================================================================
// Page client : accueil, exemples, offres, commande avec prix en direct,
// codes promo / parrainage / fidélité, suivi des courses.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const t = I18N.t;
const form = $("#orderForm");
const P = CONFIG.pricing;
const PROMOS = CONFIG.promos;
const OTHER = "__other";
const state = { shop: null, pro: null, promo: null, promoMsg: "", fromPoint: null, toPoint: null, mine: [], settings: { accepting: true }, pick: { from: null, to: null } };
const ac = {};

// Exemples cliquables : ils pré-remplissent le formulaire
const EXAMPLES = [
  { id: "poste", icon: "📮", set: { service: "retrait", place_kind: "poste" } },
  { id: "pharm", icon: "💊", set: { service: "retrait", place_kind: "superpharm" } },
  { id: "resto", icon: "🍔", set: { service: "repas", urgency: "express" } },
  { id: "docs",  icon: "📄", set: { service: "colis", round_trip: true } },
  { id: "yad2",  icon: "🛋️", set: { service: "colis", size: "moyen" } },
  { id: "keys",  icon: "🔑", set: { service: "colis", urgency: "express" } },
  { id: "shop",  icon: "🛒", set: { service: "achat" } },
  { id: "gift",  icon: "💐", set: { service: "colis", urgency: "programmee" } },
  { id: "ta",    icon: "🏙️", set: { service: "colis", from_city: CONFIG.homeCity, to_city: "tel-aviv" } }
];

function val(name) { const el = form.elements[name]; return el ? el.value : ""; }
function money(n) { return UI.money(n); }
function cityLabel(id) { return CONFIG.cities.some(c => c.id === id) ? I18N.cityName(id) : id; }

// --- Listes de villes ---------------------------------------------------------
function fillCitySelects() {
  document.querySelectorAll(".city-select").forEach(sel => {
    const current = sel.value;
    const opts = CONFIG.cities.map(c => `<option value="${c.id}">${UI.esc(c[I18N.lang])}</option>`);
    if (sel.classList.contains("with-other")) opts.push(`<option value="${OTHER}">${UI.esc(t("otherCity"))}</option>`);
    sel.innerHTML = opts.join("");
    sel.value = current || CONFIG.homeCity;
  });
}

// --- Sections d'accueil ----------------------------------------------------------
function renderStatic() {
  $("#brandName").innerHTML = UI.wordmark();
  $("#footerName").textContent = I18N.businessName();
  document.title = `${I18N.businessName()} · ${t("orderTitle")}`;
  $("#perkWelcome").textContent = t("perkWelcome", { price: money(welcomePrice()) });
  const avail = state.settings.accepting;
  $("#availBanner").classList.toggle("hidden", avail);
  $("#availText").textContent = (state.settings.message || "").trim() || t("closedBanner");
  const open = Pricing.isOpenNow(CONFIG) && avail;
  $("#openBadge").textContent = t(open ? "openNow" : "closedNow");
  $("#openBadge").classList.toggle("closed", !open);
  $("#expressSmall").textContent = `${t("w_express_d")} · +${money(P.express)}`;
  $("#bitSmall").textContent = t("pay_bit_d", { phone: CONFIG.bitPhone });
  $("#footerContact").innerHTML = `<a href="#" data-support="1">💬 ${UI.esc(t("chatFab"))}</a>`;

  const home = CONFIG.homeCity;
  $("#examples").innerHTML = EXAMPLES.map(ex => {
    const q = Pricing.computeQuote({
      fromCity: ex.set.from_city || home, toCity: ex.set.to_city || home,
      service: ex.set.service, urgency: ex.set.urgency, size: ex.set.size || "petit", roundTrip: ex.set.round_trip
    }, CONFIG);
    return `<button type="button" class="example" data-ex="${ex.id}">
      <span class="ex-ico">${ex.icon}</span>
      <b>${UI.esc(t("ex_" + ex.id + "_t"))}</b>
      <small>${UI.esc(t("ex_" + ex.id + "_d"))}</small>
      <span class="ex-price">${UI.esc(t("from"))} ${money(q.total)}</span>
    </button>`;
  }).join("");

  const pro = PROMOS.business.map(b => `<li><span>${UI.esc(b[I18N.lang] || b.fr)}</span><b>${UI.esc(typeof b.price === "object" ? b.price[I18N.lang] || b.price.fr : b.price)}</b></li>`).join("");
  $("#offers").innerHTML = `
    <div class="card offer hot"><div class="ico">🎁</div><h3>${UI.esc(t("offWelcome_t", { price: money(welcomePrice()) }))}</h3><p>${UI.esc(t("offWelcome_d", { amount: money(PROMOS.codes.BIENVENUE.amount) }))}</p></div>
    <div class="card offer"><div class="ico">🤝</div><h3>${t("offRef_t")}</h3><p>${UI.esc(t("offRef_d", { amount: money(PROMOS.referral.amount) }))}</p></div>
    <div class="card offer"><div class="ico">⭐</div><h3>${t("offLoyal_t")}</h3><p>${UI.esc(t("offLoyal_d", { every: PROMOS.loyalty.every, max: money(PROMOS.loyalty.max) }))}</p></div>
    <div class="card offer"><div class="ico">🏢</div><h3>${t("offPro_t")}</h3><ul class="pro-list">${pro}</ul>
      <button type="button" class="btn btn-sm btn-primary" style="margin-top:10px" data-devis="tournee">${t("offPro_cta")}</button></div>`;

  const rows = CONFIG.cities.map(c => ({ c, price: Pricing.cityToCity(CONFIG, home, c.id) })).sort((a, b) => a.price - b.price);
  $("#priceGrid").innerHTML = rows.map(r => `<div class="pg-row"><span>${r.c.id === home
    ? UI.esc(t("within", { city: I18N.cityName(home) }))
    : `${UI.esc(I18N.cityName(home))} ⇄ ${UI.esc(r.c[I18N.lang])}`}</span><b>${money(r.price)}${Pricing.carPrice(CONFIG, home, r.c.id) != null
      ? ` <small class="muted" title="${UI.esc(t("xBig"))}">🚗 ${money(Pricing.carPrice(CONFIG, home, r.c.id))}</small>` : ""}</b></div>`).join("");

  const extras = [["xExpress", "+ " + money(P.express)], ["xPickup", "+ " + money(P.pickupPoint)], ["xPurchase", "+ " + money(P.purchase)],
    ["xMedium", "+ " + money(P.sizes.moyen)], ...(P.carAvailable === false ? [] : [["xBig", t("xBigCar")]]), ["xStop", "+ " + money(P.extraStop)], ["xReturn", `+ ${P.returnTripPercent} %`]];
  $("#extrasTable").innerHTML = extras.map(e => `<tr><td>${UI.esc(t(e[0]))}</td><td>${e[1]}</td></tr>`).join("");

  const days = t("days");
  $("#hoursTable").innerHTML = days.map((d, i) => {
    const h = CONFIG.hours[i];
    return `<tr><td>${d}</td><td dir="ltr">${h ? `${h[0]}:00 – ${h[1]}:00` : `<span class="muted">${t("closed")}</span>`}</td></tr>`;
  }).join("");
}

// Prix d'une course dans la ville principale avec l'offre de bienvenue (15 ₪)
function welcomePrice() {
  return Pricing.computeQuote({ fromCity: CONFIG.homeCity, toCity: CONFIG.homeCity, size: "petit",
    discount: Object.assign({ kind: "promo", code: "BIENVENUE" }, PROMOS.codes.BIENVENUE) }, CONFIG).total;
}

// Code de bienvenue selon la langue (BIENVENUE / BRUCHIM)
function welcomeCode() { return I18N.lang === "he" ? "BRUCHIM" : "BIENVENUE"; }

// Prix d'appel : prix barré + prix de la première course si le client n'a encore rien commandé
function renderQuick() {
  const from = $("#quickFrom").value, to = $("#quickTo").value;
  const full = Pricing.cityToCity(CONFIG, from, to);
  const first = activeOrders().length === 0 && !state.welcomeUsed;
  const code = welcomeCode();
  const promo = Object.assign({ kind: "promo", code }, PROMOS.codes[code]);
  const withPromo = first ? Pricing.computeQuote({ fromCity: from, toCity: to, size: "petit", discount: promo }, CONFIG).total : full;
  const priceEl = $("#quickPrice");
  priceEl.textContent = money(withPromo);
  priceEl.classList.remove("pop"); void priceEl.offsetWidth; priceEl.classList.add("pop");
  $("#quickOld").textContent = money(full);
  $("#quickOld").classList.toggle("hidden", withPromo === full);
  $("#quickWelcome").textContent = t("quickWelcome", { code });
  $("#quickWelcome").classList.toggle("hidden", withPromo === full);
}

// --- Formulaire -----------------------------------------------------------------
function pad(n) { return String(n).padStart(2, "0"); }

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
  const slot = firstSlot();
  form.date.value = `${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}`;
  form.date.min = new Date().toISOString().slice(0, 10);
  form.time.value = `${pad(slot.getHours())}:${pad(slot.getMinutes())}`;
  form.from_city.value = form.to_city.value = CONFIG.homeCity;
  $("#quickFrom").value = CONFIG.homeCity;
  $("#quickTo").value = CONFIG.homeCity;
  $("#quickDate").value = form.date.value;
  $("#quickDate").min = form.date.min;
  $("#quickTime").value = form.time.value;
  const p = Store.getProfile();
  ["company", "contact_name", "contact_phone", "contact_email"].forEach(k => { if (p[k]) form[k].value = p[k]; });
}

function syncVisibility() {
  const svc = val("service");
  // Gros colis (voiture) : seulement quand une voiture est disponible
  const gros = form.querySelector('input[name=size][value=gros]');
  gros.closest(".choice").classList.toggle("hidden", P.carAvailable === false);
  if (P.carAvailable === false && gros.checked) form.querySelector('input[name=size][value=moyen]').checked = true;
  form.classList.remove("svc-colis", "svc-retrait", "svc-achat", "svc-repas", "place-poste");
  form.classList.add("svc-" + svc);
  if (svc === "retrait" && val("place_kind") === "poste") form.classList.add("place-poste");
  $("#pickupLegend").textContent = t(svc === "retrait" ? "s2_retrait" : svc === "achat" ? "s2_achat" : "s2");
  form.pickup_address.placeholder = svc === "retrait" ? t("placeAddrPh") : t("addressPh");
  $("#whenFields").classList.toggle("hidden", val("urgency") !== "programmee");
  const sched = val("urgency") === "programmee";
  const cash = form.querySelector('input[name=payment_method][value=cash]');
  cash.disabled = sched;
  cash.closest(".choice").classList.toggle("disabled", sched);
  if (sched && cash.checked) form.querySelector('input[name=payment_method][value=bit]').checked = true;
  form.payer.querySelector('option[value=destinataire]').disabled = sched;
  if (sched) form.payer.value = "moi";
  // Carnet pro proposé seulement quand il s'applique
  const carnet = carnetOk();
  $("#carnetChoice").classList.toggle("hidden", !carnet);
  if (carnet) $("#carnetSmall").textContent = t("pay_carnet_d", { n: state.pro.credits });
  const carnetOn = carnet && val("payment_method") === "carnet";
  if (!carnet && val("payment_method") === "carnet") form.querySelector('input[name=payment_method][value=cash]').checked = !sched;
  if (!carnet && sched) form.querySelector('input[name=payment_method][value=bit]').checked = true;
  $("#bitSmall").textContent = t("pay_bit_d", { phone: CONFIG.bitPhone });
  $("#prepayNote").classList.toggle("hidden", !sched || carnetOn);
  document.querySelectorAll(".other-city").forEach(el => {
    el.classList.toggle("hidden", val(el.dataset.for + "_city") !== OTHER);
  });
}

function cityOf(which) {
  const v = val(which + "_city");
  return v === OTHER ? val(which + "_other").trim() : v;
}

function pickupDate() {
  const u = val("urgency");
  if (u === "express") return new Date();
  if (u === "asap") return Pricing.isOpenNow(CONFIG) ? new Date() : firstSlot();
  const [y, m, d] = val("date").split("-").map(Number);
  const [hh, mm] = val("time").split(":").map(Number);
  if (!y || isNaN(hh)) return null;
  return new Date(y, m - 1, d, hh, mm);
}

function scheduleError() {
  const u = val("urgency");
  if (!state.settings.accepting && u !== "programmee") return { key: "errNotAccepting" };
  if (u === "asap") return null;
  if (u === "express") return Pricing.isOpenNow(CONFIG) ? null : { key: "errExpressClosed" };
  return Pricing.checkSchedule(pickupDate(), CONFIG);
}

// --- Réductions -------------------------------------------------------------------
function activeOrders() { return state.mine.filter(o => !["annulee", "refusee"].includes(o.status)); }
function deliveredCount() { return state.mine.filter(o => o.status === "livree").length; }
function ownReferralCode(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 4 ? PROMOS.referral.prefix + d.slice(-4) : null;
}
function loyaltyDue() { return (deliveredCount() + 1) % PROMOS.loyalty.every === 0; }

function validatePromo(raw) {
  const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { promo: null, msg: "" };
  const first = activeOrders().length === 0;
  const def = PROMOS.codes[code];
  if (def) {
    if (def.firstOrderOnly && !first) return { promo: null, msg: t("promoFirstOnly"), bad: true };
    if (def.welcome && state.welcomeUsed) return { promo: null, msg: t("errWelcomeUsed"), bad: true };
    return { promo: Object.assign({ kind: "promo", code }, def), msg: t("promoOk") };
  }
  const ref = PROMOS.referral;
  if (new RegExp("^" + ref.prefix + "\\d{4}$").test(code)) {
    if (code === ownReferralCode(val("contact_phone"))) return { promo: null, msg: t("promoOwn"), bad: true };
    if (!first) return { promo: null, msg: t("promoFirstOnly"), bad: true };
    return { promo: { kind: "referral", code, amount: ref.amount }, msg: t("promoOk") };
  }
  return { promo: null, msg: t("promoBad"), bad: true };
}

function refuseWelcome() {
  state.promo = null;
  $("#promoMsg").textContent = t("errWelcomeUsed");
  $("#promoMsg").className = "promo-msg bad";
  renderQuote();
  renderQuick();
  showError(t("errWelcomeUsed"));
}

function applyPromo() {
  const r = validatePromo(val("promo"));
  state.promo = r.promo;
  $("#promoMsg").textContent = r.msg;
  $("#promoMsg").className = "promo-msg " + (r.bad ? "bad" : "ok");
  renderQuote();
}

function currentDiscount() {
  if (loyaltyDue()) return { kind: "loyalty", code: "FIDELITE", max: PROMOS.loyalty.max };
  return state.promo;
}

// Carnet pro : le commerce lui-même (sa clé sur cet appareil), course simple dans Netanya
function carnetOk() {
  const pf = state.pick.from;
  return !!(state.pro && state.pro.credits > 0 && state.shop && pf && pf.shopId === state.shop.id
    && cityOf("from") === CONFIG.homeCity && cityOf("to") === CONFIG.homeCity && val("size") === "petit"
    && val("urgency") !== "express" && !form.round_trip.checked && !(parseInt(val("extra_stops"), 10) > 0)
    && ["colis", "repas"].includes(val("service")));
}
const carnetUnit = () => Number(state.settings.carnet_unit || CONFIG.partners.carnet.price / CONFIG.partners.carnet.courses);

function currentQuote() {
  if (val("payment_method") === "carnet" && carnetOk()) {
    return { total: carnetUnit(), known: true, distanceKm: 0, lines: [{ key: "qCarnet", vars: { n: state.pro.credits - 1 }, amount: carnetUnit() }] };
  }
  return Pricing.computeQuote({
    fromCity: cityOf("from"), toCity: cityOf("to"),
    fromPoint: state.fromPoint, toPoint: state.toPoint,
    service: val("service"), urgency: val("urgency"), size: val("size"),
    roundTrip: form.round_trip.checked, extraStops: val("extra_stops"),
    discount: currentDiscount()
  }, CONFIG);
}

function lineLabel(l) {
  const v = Object.assign({}, l.vars);
  if (v.from) v.from = cityLabel(v.from);
  if (v.to) v.to = cityLabel(v.to);
  if (v.city) v.city = cityLabel(v.city);
  let s = t(l.key, v);
  if (l.key === "qBase" && l.vars.km) s += ` · ${t("qDist", { km: l.vars.km })}`;
  return s;
}

// --- Remplissage rapide et fun : progression, ✅ par étape, défilement automatique ---
const fieldsetOf = sel => { const el = form.querySelector(sel); return el && el.closest("fieldset"); };
function stepStates() {
  const filled = n => !!val(n).trim();
  return [
    [fieldsetOf('legend[data-i18n="s1"]'), true],
    [fieldsetOf('legend[data-i18n="s4"]'), !scheduleError()],
    [fieldsetOf("#pickupLegend"), filled("pickup_address") && (filled("pickup_number") || !!(state.pick.from && state.pick.from.brand))],
    [fieldsetOf('legend[data-i18n="s3"]'), filled("dropoff_address") && (filled("dropoff_number") || !!(state.pick.to && state.pick.to.brand))],
    [$("#coordsBox"), filled("contact_name") && phoneOk(val("contact_phone"))]
  ];
}
function updateProgress() {
  const steps = stepStates();
  steps.forEach(([fs, ok]) => fs && fs.classList.toggle("step-done", ok));
  const done = steps.filter(s => s[1]).length, left = steps.length - done;
  const pct = Math.round(done / steps.length * 100);
  $("#fpFill").style.width = pct + "%";
  $("#fpScooter").style.insetInlineStart = `calc(${pct}% - 14px)`;
  $("#fpText").textContent = left ? t("fpLeft", { n: left }) : t("fpDone");
  $("#formProgress").classList.toggle("complete", !left);
}
function goNext(fs) {
  let next = fs && fs.nextElementSibling;
  while (next && next.tagName !== "FIELDSET") next = next.nextElementSibling;
  if (next) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
}

// Pluie d'emojis quand la commande part
function confetti() {
  const box = $("#confetti");
  if (!box || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  box.innerHTML = Array.from({ length: 36 }, () => {
    const e = ["🎉", "📦", "🛵", "✨", "🧡", "🎁"][Math.floor(Math.random() * 6)];
    return `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * .6).toFixed(2)}s;animation-duration:${(1.6 + Math.random()).toFixed(2)}s">${e}</i>`;
  }).join("");
  setTimeout(() => { box.innerHTML = ""; }, 3200);
}

function renderQuote() {
  const q = currentQuote();
  $("#quoteLines").innerHTML = q.lines.map(l =>
    `<li class="${l.discount ? "disc" : ""}"><span>${UI.esc(lineLabel(l))}</span><span dir="ltr">${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}</span></li>`).join("");
  const total = (q.known ? "" : t("from") + " ") + money(q.total);
  $("#quoteTotal").textContent = total;
  $("#mobileTotal").textContent = total;
  $("#submitBtn").textContent = t("submit", { total: money(q.total) });
  const notes = [];
  if (!q.known) notes.push(t("qUnknown"));
  if (val("service") === "achat") notes.push(t("qPurchaseNote"));
  const sched = val("urgency") === "programmee";
  notes.push(val("payment_method") === "carnet" ? t("payNoteCarnet")
    : val("payment_method") === "bit" ? t(sched ? "payNoteBit" : "payNoteBitNow", { phone: CONFIG.bitPhone }) : t("payNoteCash"));
  $("#quoteNote").textContent = notes.join(" ");
  updateProgress();
  const err = scheduleError();
  $("#scheduleError").textContent = err ? t(err.key, err.vars) : "";
  $("#scheduleError").classList.toggle("hidden", !err);
}

// Ville hors liste : on géolocalise le nom de la ville pour estimer le prix
let otherTimer;
function scheduleOtherGeocode() {
  clearTimeout(otherTimer);
  otherTimer = setTimeout(async () => {
    for (const which of ["from", "to"]) {
      const name = val(which + "_city") === OTHER ? val(which + "_other").trim() : "";
      state[which + "Point"] = name.length > 1 ? await Pricing.geocode(name, CONFIG.countryCode, 4000) : null;
    }
    renderQuote();
  }, 800);
}

function applyExample(id) {
  const ex = EXAMPLES.find(e => e.id === id);
  form.reset();
  resetPlaces();
  fillDefaults();
  Object.entries(ex.set).forEach(([k, v]) => {
    const el = form.elements[k];
    if (el instanceof RadioNodeList) el.value = v;
    else if (el.type === "checkbox") el.checked = v;
    else el.value = v;
  });
  state.promo = null;
  $("#promoMsg").textContent = "";
  syncVisibility();
  renderQuote();
  $("#commander").scrollIntoView({ behavior: "smooth" });
}

// --- Téléphones israéliens : vérification et mise en forme ---------------------------
// Accepte 05X-XXX-XXXX (portable), 0X-XXX-XXXX (fixe), 07X… et +972…
function phoneDigits(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}
function phoneOk(v) { return /^0(5\d{8}|7\d{8}|[2-489]\d{7})$/.test(phoneDigits(v)); }
function formatPhone(v) {
  const d = phoneDigits(v);
  if (/^0[57]\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (/^0\d{8}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return v;
}

// Coordonnées mémorisées dès la saisie (pas seulement après une commande réussie)
const PROFILE_FIELDS = ["company", "contact_name", "contact_phone", "contact_email"];
function rememberProfile() {
  const p = Store.getProfile();
  PROFILE_FIELDS.forEach(k => { p[k] = val(k).trim(); });
  Store.saveProfile(p);
}

function showError(msg) {
  $("#formError").textContent = msg || "";
  $("#formError").classList.toggle("hidden", !msg);
}

// --- Adresses choisies dans la liste (carte) -----------------------------------------
// Repère le type de lieu de retrait d'après le nom de l'enseigne
function detectPlaceKind(brand) {
  if (/super.?pharm|סופר.?פארם/i.test(brand)) return "superpharm";
  if (/דואר|doar|israel post|post office|bureau de poste/i.test(brand)) return "poste";
  if (/locker|לוקר|נקודת איסוף|pick.?up|relais/i.test(brand)) return "relais";
  return null;
}

// Enseigne (magasin, restaurant, poste…) : pas de bâtiment / étage / appt / code, N° facultatif
function setBrandMode(which, on) {
  const pre = prefixOf(which);
  form.elements[pre + "_address"].closest(".fields").classList.toggle("brand-mode", !!on);
  if (on) DETAIL.forEach(k => { form.elements[pre + "_" + k].value = ""; });
}

function onPlacePicked(which, p) {
  state.pick[which] = p;
  setBrandMode(which, !!p.brand);
  const sel = form.elements[which + "_city"];
  if (p.cityId) sel.value = p.cityId;
  else if (p.city) { sel.value = OTHER; form.elements[which + "_other"].value = p.city; }
  state[which + "Point"] = { lat: p.lat, lon: p.lon };
  // Numéro de rue : rempli si la carte le connaît, sinon on invite à le saisir (sauf enseigne)
  const num = form.elements[which === "from" ? "pickup_number" : "dropoff_number"];
  num.value = p.housenumber || "";
  if (!p.housenumber && !p.brand) setTimeout(() => num.focus(), 50);
  if (which === "from" && val("service") === "retrait" && p.brand) {
    const kind = detectPlaceKind(p.brand);
    if (kind) form.place_kind.value = kind;
  }
  syncVisibility();
  renderQuote();
  renderShopBanner();
}

function attachPlaces() {
  ["from", "to"].forEach(which => {
    ac[which] = Places.attach(form.elements[which === "from" ? "pickup_address" : "dropoff_address"], {
      lang: () => I18N.lang,
      texts: () => ({ none: t("addrNone"), down: t("addrDown") }),
      onPick: p => onPlacePicked(which, p),
      onClear: () => { state.pick[which] = null; setBrandMode(which, false); renderQuote(); renderShopBanner(); }
    });
  });
}

// --- Carnet d'adresses et compte client (enregistrés sur le téléphone) -----------------
const DETAIL = ["building", "floor", "apt", "code"];
const prefixOf = which => (which === "from" ? "pickup" : "dropoff");

function addrLabel(a) {
  const city = cityLabel(a.cityId || a.city);
  return [a.brand, `${a.street} ${a.number}`.trim(), city].filter(Boolean).join(", ") + (a.apt ? ` · ${t("aptShort")} ${a.apt}` : "");
}

function renderSavedAddrs() {
  const list = Store.getAddresses();
  document.querySelectorAll(".saved-addrs").forEach(box => {
    box.classList.toggle("hidden", !list.length);
    box.innerHTML = list.length ? `<small>${UI.esc(t("savedTitle"))}</small>` + list.slice(0, 5).map((a, i) =>
      `<button type="button" class="addr-chip" data-addr="${i}">${a.brand ? "🏪" : "📍"} ${UI.esc(addrLabel(a))}</button>`).join("") : "";
  });
}

function applySavedAddr(which, a) {
  const pre = prefixOf(which);
  const label = [a.brand, a.street, cityLabel(a.cityId || a.city)].filter(Boolean).join(", ");
  const sel = form.elements[which + "_city"];
  if (a.cityId) sel.value = a.cityId; else { sel.value = OTHER; form.elements[which + "_other"].value = a.city || ""; }
  form.elements[pre + "_number"].value = a.number || "";
  DETAIL.forEach(k => { form.elements[pre + "_" + k].value = a[k] || ""; });
  form.elements[pre + "_note"].value = a.note || "";
  state.pick[which] = { lat: a.lat, lon: a.lon, streetName: a.street, housenumber: a.number, brand: a.brand, cityId: a.cityId, city: a.city, label, exact: a.exact };
  setBrandMode(which, !!a.brand);
  state[which + "Point"] = a.lat != null ? { lat: a.lat, lon: a.lon } : null;
  if (ac[which]) ac[which].setPicked(label);
  syncVisibility();
  renderQuote();
  renderShopBanner();
}

function rememberAddresses(o, pf, pt) {
  const save = (which, p, cityId) => {
    const pre = prefixOf(which);
    const number = val(pre + "_number").trim();
    Store.saveAddress({
      street: p ? (p.streetName || p.brand || "") : val(pre + "_address").trim().replace(/\s+\d+[^\s,]*$/, ""),
      number, brand: p ? p.brand : null, city: p ? p.city || cityId : cityId,
      cityId: CONFIG.cities.some(c => c.id === cityId) ? cityId : null,
      lat: o[pre + "_lat"], lon: o[pre + "_lon"], exact: o[pre + "_exact"],
      building: o[pre + "_building"], floor: o[pre + "_floor"], apt: o[pre + "_apt"], code: o[pre + "_code"], note: o[pre + "_note"]
    });
  };
  save("from", pf, o.from_city);
  save("to", pt, o.to_city);
}

function isReturning() {
  const p = Store.getProfile();
  return !!(p.contact_name && phoneOk(p.contact_phone));
}

// Client connu : ses coordonnées sont repliées en une ligne « Marc · 052-… ✏️ »
function renderAccount() {
  const p = Store.getProfile();
  const known = isReturning();
  $("#navMine").textContent = known ? t("hello", { name: p.contact_name.split(" ")[0] }) : t("navMine");
  const editing = $("#coordsBox").dataset.editing === "1";
  $("#coordsSummary").classList.toggle("hidden", !known || editing);
  $("#coordsFields").classList.toggle("hidden", known && !editing);
  $("#coordsText").textContent = known ? `${p.contact_name} · ${p.contact_phone}${p.company ? " · " + p.company : ""}` : "";

  const card = $("#accountCard");
  card.classList.toggle("hidden", !known);
  if (!known) return;
  const addrs = Store.getAddresses();
  card.innerHTML = `<h3>${UI.esc(t("accTitle"))}</h3>
    <p class="muted small">${UI.esc(t("accSaved"))}</p>
    <p style="margin-top:8px"><b>${UI.esc(p.contact_name)}</b> · <span dir="ltr">${UI.esc(p.contact_phone)}</span>${p.contact_email ? " · " + UI.esc(p.contact_email) : ""}
      · ${UI.esc(t("accOrders", { n: activeOrders().length }))}</p>
    <b style="display:block;margin-top:10px">${UI.esc(t("accAddrs"))}</b>
    ${addrs.length ? `<ul>${addrs.map((a, i) => `<li><span>${a.brand ? "🏪" : "📍"} ${UI.esc(addrLabel(a))}</span>
        <button type="button" class="btn btn-sm btn-link" data-del-addr="${i}">✕ ${UI.esc(t("accDelete"))}</button></li>`).join("")}</ul>`
      : `<p class="muted small">${UI.esc(t("accNoAddr"))}</p>`}`;
}

function resetPlaces() {
  ["from", "to"].forEach(w => { state.pick[w] = null; if (ac[w]) ac[w].reset(); });
}

// Coordonnées exactes de « rue + numéro » choisis (sinon celles de la rue)
async function exactPoint(p, number, cityName) {
  if (!p) return null;
  if (p.shopId && p.lat != null) return { lat: p.lat, lon: p.lon, exact: true };
  if (p.housenumber && p.housenumber === number) return { lat: p.lat, lon: p.lon, exact: p.exact !== false };
  if (p.streetName) {
    try {
      const list = await Places.search(`${p.streetName} ${number} ${cityName}`, I18N.lang);
      const hit = list.find(x => x.housenumber === number && x.streetName === p.streetName);
      if (hit) return { lat: hit.lat, lon: hit.lon, exact: true };
    } catch (e) { /* on garde la position de la rue */ }
  }
  return { lat: p.lat, lon: p.lon, exact: !!p.brand && !p.streetName };
}

// Adresse enregistrée : rue (ou texte tapé) + numéro
function fullAddress(p, typed, number) {
  const street = p ? (p.streetName || p.brand || p.label) : typed.replace(/\s+\d+[^\s,]*$/, "");
  return `${street} ${number}`.trim();
}

async function locate(address, cityId, point) {
  const c = Pricing.cityById(CONFIG, cityId);
  const name = c ? c.fr : cityId;
  const found = address ? await Pricing.geocode(`${address}, ${name}`, CONFIG.countryCode, 3000) : null;
  return found || (c ? { lat: c.lat, lon: c.lon } : point);
}

async function submit(e) {
  e.preventDefault();
  showError("");
  const fromCity = cityOf("from"), toCity = cityOf("to");
  const required = ["pickup_address", "dropoff_address", "contact_name", "contact_phone"];
  const missing = required.find(k => !val(k).trim());
  if (missing || !fromCity || !toCity) {
    if (missing) form.elements[missing].focus();
    return showError(t("errRequired"));
  }
  // Adresses : uniquement celles proposées par la carte (si le service répond)
  if (Places.serviceOk && (!ac.from.isPicked() || !ac.to.isPicked())) {
    form.elements[!ac.from.isPicked() ? "pickup_address" : "dropoff_address"].focus();
    return showError(t("errAddrPick"));
  }
  const badPhone = ["contact_phone", "dropoff_phone", val("service") !== "retrait" ? "pickup_phone" : null]
    .find(k => k && val(k).trim() && !phoneOk(val(k)));
  if (badPhone) { form.elements[badPhone].focus(); return showError(t("errPhone")); }
  const isBrand = w => !!(state.pick[w] && state.pick[w].brand);
  const missingNo = [["from", "pickup_number"], ["to", "dropoff_number"]].find(([w, k]) => !isBrand(w) && !val(k).trim());
  if (missingNo) { form.elements[missingNo[1]].focus(); return showError(t("errHouseNo")); }
  const err = scheduleError();
  if (err) return showError(t(err.key, err.vars));
  if (state.promo) {
    const r = validatePromo(val("promo"));
    state.promo = r.promo;
  }
  // Bienvenue : vérifiée aussi sur le numéro et cet appareil (et l'IP côté base en ligne)
  if (state.promo && state.promo.welcome) {
    try { state.welcomeUsed = await Store.welcomeUsed(val("contact_phone")); } catch (e) { /* la base vérifiera */ }
    if (state.welcomeUsed) { refuseWelcome(); return; }
  }

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = t("sending");
  try {
    const q = currentQuote();
    const disc = q.lines.find(l => l.discount);
    const svc = val("service");
    const pf = state.pick.from, pt = state.pick.to;
    const pNo = val("pickup_number").trim(), dNo = val("dropoff_number").trim();
    const pAddr = fullAddress(pf, val("pickup_address").trim(), pNo);
    const dAddr = fullAddress(pt, val("dropoff_address").trim(), dNo);
    const [pick, drop] = await Promise.all([
      pf ? exactPoint(pf, pNo, UI.cityFr(fromCity)) : locate(pAddr, fromCity, state.fromPoint),
      pt ? exactPoint(pt, dNo, UI.cityFr(toCity)) : locate(dAddr, toCity, state.toPoint)
    ]);
    const order = {
      lang: I18N.lang,
      service: svc,
      urgency: val("urgency"),
      pickup_at: pickupDate().toISOString(),
      from_city: fromCity,
      pickup_address: pAddr,
      pickup_place: pf ? pf.brand : null,
      pickup_building: svc !== "retrait" ? val("pickup_building").trim() || null : null,
      pickup_floor: svc !== "retrait" ? val("pickup_floor").trim() || null : null,
      pickup_apt: svc !== "retrait" ? val("pickup_apt").trim() || null : null,
      pickup_code: svc !== "retrait" ? val("pickup_code").trim() || null : null,
      pickup_exact: !!(pick && pick.exact),
      pickup_note: val("pickup_note").trim() || null,
      pickup_lat: pick ? pick.lat : null, pickup_lon: pick ? pick.lon : null,
      pickup_contact: svc !== "retrait" ? val("pickup_contact").trim() || null : null,
      pickup_phone: svc !== "retrait" && val("pickup_phone").trim() ? formatPhone(val("pickup_phone").trim()) : null,
      place_kind: svc === "retrait" ? val("place_kind") : null,
      tracking_number: svc === "retrait" ? val("tracking_number").trim() || null : null,
      parcel_name: svc === "retrait" ? val("parcel_name").trim() || null : null,
      has_proxy: svc === "retrait" && val("place_kind") === "poste" && form.has_proxy.checked,
      shopping_list: svc === "achat" ? val("shopping_list").trim() || null : null,
      budget: svc === "achat" ? parseFloat(val("budget")) || null : null,
      to_city: toCity,
      dropoff_address: dAddr,
      dropoff_place: pt ? pt.brand : null,
      dropoff_building: val("dropoff_building").trim() || null,
      dropoff_floor: val("dropoff_floor").trim() || null,
      dropoff_apt: val("dropoff_apt").trim() || null,
      dropoff_code: val("dropoff_code").trim() || null,
      leave_at_door: form.leave_at_door.checked,
      prepaid_required: val("urgency") === "programmee",
      dropoff_exact: !!(drop && drop.exact),
      dropoff_note: val("dropoff_note").trim() || null,
      dropoff_lat: drop ? drop.lat : null, dropoff_lon: drop ? drop.lon : null,
      dropoff_contact: val("dropoff_contact").trim() || null,
      dropoff_phone: val("dropoff_phone").trim() ? formatPhone(val("dropoff_phone").trim()) : null,
      size: val("size"),
      round_trip: form.round_trip.checked,
      extra_stops: parseInt(val("extra_stops"), 10) || 0,
      distance_km: q.distanceKm,
      price: q.total,
      promo_code: disc ? (disc.key === "qLoyalty" ? "FIDELITE" : disc.vars.code) : null,
      discount: disc ? -disc.amount : 0,
      payment_method: val("payment_method"),
      payer: val("payer"),
      notes: val("notes").trim() || null,
      company: val("company").trim() || null,
      contact_name: val("contact_name").trim(),
      contact_phone: formatPhone(val("contact_phone").trim()),
      contact_email: val("contact_email").trim() || null,
      // Départ = le commerce du lien : la course compte pour lui (et pour le livreur qui l'a amené)
      shop_id: state.shop && pf && pf.shopId === state.shop.id ? state.shop.id : null,
      // Clé du commerce, seulement pour payer avec son carnet (la base la vérifie puis l'efface)
      shop_token: val("payment_method") === "carnet" && carnetOk() ? state.pro.token : null
    };
    if (!order.shop_token) delete order.shop_token;
    const firstOrder = activeOrders().length === 0;
    const saved = await Store.createOrder(order);
    rememberAddresses(saved, pf, pt);
    $("#donePrepay").textContent = t("donePrepay", { total: money(saved.price), phone: CONFIG.bitPhone, ref: saved.ref });
    $("#donePrepay").classList.toggle("hidden", !saved.prepaid_required || saved.payment_method === "carnet");
    if (saved.payment_method === "carnet" && state.pro) state.pro.credits--;
    confetti();
    $("#doneAccount").textContent = t("doneAccount");
    $("#doneAccount").classList.toggle("hidden", !firstOrder);
    Store.saveProfile({ company: order.company, contact_name: order.contact_name, contact_phone: order.contact_phone, contact_email: order.contact_email });

    $("#doneText").innerHTML = UI.esc(t("doneText", { ref: saved.ref, total: money(saved.price) }));
    $("#doneSub").textContent = t(Store.ONLINE ? "doneOnline" : "doneDemo");
    $("#doneWa").href = UI.waLink(CONFIG.whatsapp, UI.orderText(saved));
    $("#doneWa").classList.toggle("hidden", Store.ONLINE);
    $("#doneTrack").href = UI.trackUrl(saved);
    const shareMsg = I18N.forLang(saved.lang, "trShareMsg", { url: UI.trackUrl(saved) });
    $("#doneShare").href = saved.dropoff_phone ? UI.waLink(saved.dropoff_phone, shareMsg) : UI.waShare(shareMsg);
    $("#doneModal").classList.remove("hidden");
    ["notes", "tracking_number", "parcel_name", "shopping_list", "budget", "promo", "pickup_address", "pickup_number", "pickup_note", "pickup_building", "pickup_floor", "pickup_apt", "pickup_code", "dropoff_address", "dropoff_number", "dropoff_note", "dropoff_building", "dropoff_floor", "dropoff_apt", "dropoff_code", "dropoff_contact", "dropoff_phone"]
      .forEach(k => { form.elements[k].value = ""; });
    state.promo = null;
    $("#promoMsg").textContent = "";
    resetPlaces();
    applyShop();
    form.leave_at_door.checked = false;
    $("#coordsBox").dataset.editing = "";
    renderSavedAddrs();
    await loadMine();
  } catch (ex) {
    if (/welcome_used/.test(ex.message)) { state.welcomeUsed = true; refuseWelcome(); return; }
    if (/carnet_/.test(ex.message)) { if (state.pro) state.pro.credits = 0; syncVisibility(); return showError(t("errCarnet")); }
    showError(t("errSend", { phone: CONFIG.phoneDisplay }));
  } finally {
    btn.disabled = false;
    renderQuote();
  }
}

// --- Mes courses, fidélité, parrainage ------------------------------------------
async function loadMine() {
  try { state.mine = await Store.myOrders(); state.mineError = false; }
  catch (e) { state.mineError = true; }
  // Offre de bienvenue déjà utilisée avec ce numéro / cet appareil ?
  const phone = Store.getProfile().contact_phone;
  try { state.welcomeUsed = await Store.welcomeUsed(phone || ""); } catch (e) { /* vérifié à l'envoi */ }
  renderMine();
  renderQuote();
  renderQuick();
  renderAccount();
}

function renderClub() {
  const L = PROMOS.loyalty;
  const n = deliveredCount() % L.every;
  const stamps = Array.from({ length: L.every }, (_, i) => `<i class="${i < n ? "on" : ""}${i === L.every - 1 ? " gift" : ""}">${i === L.every - 1 ? "🎁" : i < n ? "✓" : ""}</i>`).join("");
  const code = ownReferralCode(Store.getProfile().contact_phone);
  const url = UI.appUrl();
  const refMsg = code && t("refMsg", { name: I18N.businessName(), code, amount: money(PROMOS.referral.amount), url });
  $("#clubCards").innerHTML = `
    <div class="card club"><h3>⭐ ${t("loyaltyTitle")}</h3>
      <div class="stamps">${stamps}</div>
      <p class="muted small">${loyaltyDue() ? t("loyaltyNext") : UI.esc(t("loyaltyText", { n, every: L.every, left: L.every - 1 - n }))}</p></div>
    ${code ? `<div class="card club"><h3>🤝 ${t("refTitle")}</h3>
      <div class="ref-code" dir="ltr">${code}</div>
      <p class="muted small">${UI.esc(t("refText", { amount: money(PROMOS.referral.amount) }))}</p>
      <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waShare(refMsg)}">${t("refShare")}</a></div>` : ""}`;
}

function whenLabel(o) {
  if (o.urgency === "express") return t("expressLabel") + " · " + UI.fmtDay(o.pickup_at);
  if (o.urgency === "asap") return t("asapLabel") + " · " + UI.fmtDay(o.pickup_at);
  return UI.fmtDateTime(o.pickup_at);
}

function renderMine() {
  renderClub();
  const box = $("#myOrders");
  if (state.mineError) { box.innerHTML = `<p class="notice err">${t("loadFail")}</p>`; return; }
  if (!state.mine.length) {
    box.innerHTML = `<div class="empty card">${t("mineEmpty")} <a href="#commander">${t("mineFirst")}</a></div>`;
    return;
  }
  const list = state.mine.slice().sort((a, b) => new Date(b.created_at || b.pickup_at) - new Date(a.created_at || a.pickup_at));
  box.innerHTML = list.map(o => `
    <article class="mini-order">
      <div class="mo-ico">${{ colis: "📦", retrait: "📮", achat: "🛒", repas: "🍔" }[o.service] || "📦"}</div>
      <div class="mo-main">
        <b>${UI.esc(cityLabel(o.from_city))} → ${UI.esc(cityLabel(o.to_city))}</b>
        <small>${UI.esc(whenLabel(o))}</small>
        <small class="order-no">${UI.esc(t("orderNo", { ref: o.ref }))}</small>
        ${o.status === "refusee" ? `<p class="notice warn" style="margin-top:6px">${UI.esc(t("trRefused"))}${o.admin_note ? " " + UI.esc(t("trReason", { r: o.admin_note })) : ""} <a href="#commander">${UI.esc(t("trRebook"))}</a></p>`
          : o.admin_note ? `<p class="notice" style="margin-top:6px">💬 ${UI.esc(o.admin_note)}</p>` : ""}
        <div class="mo-actions">
          ${["nouvelle", "confirmee", "recuperee"].includes(o.status) ? `<a class="btn btn-sm btn-primary" href="${UI.trackUrl(o)}">${t("track")}</a>` : ""}
          ${o.receipt_number ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}">${t("receiptLink")}</a>` : ""}
          <button type="button" class="btn btn-sm btn-wa" data-chat="${UI.esc(o.token)}">${UI.esc(t("chOpen"))}${chatUnread["o:" + o.id] ? ` <span class="chat-badge">${chatUnread["o:" + o.id]}</span>` : ""}</button>
          ${o.status === "nouvelle" ? `<button class="btn btn-sm btn-link" data-cancel="${UI.esc(o.token)}">${t("cancel")}</button>` : ""}
        </div>
      </div>
      <div class="mo-side"><span class="pill st-${UI.esc(o.status)}">${t("st_" + o.status)}</span><b>${money(o.price)}</b></div>
    </article>`).join("");
}

// --- Messagerie : la course (livreur + service client) ou le service client -----------------
let chatUnread = {};
let chatTotal = 0;
function openOrderChat(o) {
  Chat.open({ thread: "o:" + o.id, title: t("chOrder", { ref: o.ref }), sub: t("chOrderSub"), me: "client",
    fetch: () => Store.chatOrder(o.token), send: (b, i) => Store.chatOrderSend(o.token, b, i), onClose: checkChats });
}
function openSupport(prefill) {
  const p = Store.getProfile();
  Chat.open({ thread: "u:" + Store.deviceId(), title: t("chSupport"), sub: t("chSupportSub"), me: "client", prefill,
    fetch: () => Store.chatSupport(),
    send: (b, i) => Store.chatSupportSend([p.contact_name, p.contact_phone].filter(Boolean).join(" · "), b, i), onClose: checkChats });
}
// Courses à suivre dans la messagerie : en cours, ou terminées depuis moins de 2 jours
const chatOrders = () => state.mine.filter(o => !["annulee"].includes(o.status)
  && (["nouvelle", "confirmee", "recuperee"].includes(o.status) || Date.now() - new Date(o.pickup_at) < 2 * 86400000));
function openChatMenu() {
  const list = chatOrders();
  if (!list.length) return openSupport();
  Chat.choose(t("chWho"), [
    ...list.map(o => ({ label: t("chMyOrder", { ref: o.ref }), badge: chatUnread["o:" + o.id], onClick: () => openOrderChat(o) })),
    { label: "💬 " + t("chSupport"), badge: chatUnread["u:" + Store.deviceId()], onClick: () => openSupport() }
  ]);
}
// Messages non lus : pastille sur le bouton « Nous écrire », vibration à l'arrivée
async function checkChats() {
  try {
    const lists = await Promise.all([Store.chatSupport(), ...chatOrders().map(o => Store.chatOrder(o.token))]);
    chatUnread = Chat.unread(lists.flat(), "client");
  } catch (e) { return; }
  const total = Object.values(chatUnread).reduce((s, n) => s + n, 0);
  $("#fabBadge").textContent = total;
  $("#fabBadge").classList.toggle("hidden", !total);
  if (total > chatTotal && navigator.vibrate) navigator.vibrate([150, 80, 150]);
  chatTotal = total;
  renderMine();
}

async function onListClick(e) {
  const chat = e.target.closest("[data-chat]");
  if (chat) { const o = state.mine.find(x => x.token === chat.dataset.chat); if (o) openOrderChat(o); return; }
  const token = e.target.dataset.cancel;
  if (!token || !confirm(t("cancelConfirm"))) return;
  try { await Store.cancelMyOrder(token); } catch (ex) { alert(t("cancelFail")); }
  loadMine();
}

// --- Langue et rendu global ---------------------------------------------------------
function renderAll() {
  I18N.apply();
  fillCitySelects();
  renderStatic();
  renderQuick();
  syncVisibility();
  renderQuote();
  renderMine();
  renderSavedAddrs();
  renderAccount();
  renderShopBanner();
}

async function loadSettings() {
  try { state.settings = await Store.getSettings(); } catch (e) { /* on garde « disponible » */ }
  renderStatic();
  renderQuote();
}

// --- Commerce partenaire (lien index.html?c=CODE) : départ rempli depuis le commerce ----------
function renderShopBanner() {
  const on = !!(state.shop && state.pick.from && state.pick.from.shopId === state.shop.id);
  $("#shopBanner").classList.toggle("hidden", !on);
  if (on) $("#shopBannerText").textContent = t("shBanner", { name: state.shop.name });
}

function applyShop() {
  const s = state.shop;
  if (!s) return;
  applySavedAddr("from", { brand: s.name, street: s.address || "", number: "", cityId: CONFIG.cities.some(c => c.id === s.city) ? s.city : null,
    city: s.city, lat: s.lat, lon: s.lon, exact: s.lat != null });
  state.pick.from.shopId = s.id;
  if (s.kind === "restaurant") { form.elements.service.value = "repas"; syncVisibility(); renderQuote(); }
  renderShopBanner();
}

async function loadShop(code) {
  try { state.shop = await Store.shopByCode(code); } catch (e) { state.shop = null; }
  if (!state.shop) return;
  // Sur le téléphone du commerce : son carnet pro
  const token = Store.shopTokenFor(state.shop.code);
  if (token) {
    try {
      const d = await Store.shopDashboard(token);
      if (d && d.shop) state.pro = { token, credits: Number(d.shop.credits || 0) };
    } catch (e) { /* pas de carnet */ }
  }
  applyShop();
  setTimeout(() => $("#commander").scrollIntoView({ behavior: "smooth" }), 300);
}

// --- Demande de devis (tournée quotidienne, carnet…) : pro ou particulier, dans l'application --
let reqKind = "pro";
function openRequest(topic) {
  const f = $("#reqForm");
  $("#reqCity").innerHTML = CONFIG.cities.map(c => `<option value="${c.id}">${UI.esc(c[I18N.lang])}</option>`).join("");
  $("#reqCity").value = CONFIG.homeCity;
  const p = Store.getProfile();
  if (!f.name.value && p.contact_name) f.name.value = p.contact_name;
  if (!f.phone.value && p.contact_phone) f.phone.value = p.contact_phone;
  if (!f.company.value && p.company) f.company.value = p.company;
  f.topic.value = topic || "tournee";
  $("#reqError").classList.add("hidden");
  $("#reqDone").classList.add("hidden");
  $("#reqSend").classList.remove("hidden");
  $("#reqModal").classList.remove("hidden");
}
function setReqKind(k) {
  reqKind = k;
  document.querySelectorAll("#reqKind [data-kind]").forEach(b => b.classList.toggle("on", b.dataset.kind === k));
  $("#reqCompany").classList.toggle("hidden", k !== "pro");
}
async function sendRequest(e) {
  e.preventDefault();
  const f = e.target, v = k => f.elements[k].value.trim();
  const err = $("#reqError");
  if (!v("name") || !phoneOk(v("phone")) || (reqKind === "pro" && !v("company"))) {
    err.textContent = t("rqErr"); err.classList.remove("hidden"); return;
  }
  err.classList.add("hidden");
  const btn = $("#reqSend");
  btn.disabled = true;
  try {
    await Store.createRequest({ kind: reqKind, topic: v("topic"), name: v("name"), company: reqKind === "pro" ? v("company") : null,
      phone: formatPhone(v("phone")), city: v("city"), frequency: v("frequency") || null, message: v("message") || null, lang: I18N.lang });
    $("#reqDone").textContent = t("rqDone");
    $("#reqDone").classList.remove("hidden");
    btn.classList.add("hidden");
    f.frequency.value = f.message.value = "";
  } catch (ex) {
    err.textContent = t("errSend", { phone: CONFIG.phoneDisplay }); err.classList.remove("hidden");
  } finally { btn.disabled = false; }
}

// --- Démarrage ---------------------------------------------------------------------
// Lien d'un commerce partenaire (lu avant de nettoyer l'adresse)
const shopCode = new URLSearchParams(location.search).get("c");
// Adresse nettoyée (paramètres laissés par une ancienne version ou un rechargement forcé)
if (location.search) history.replaceState(null, "", location.pathname + location.hash);
I18N.apply();
fillCitySelects();
fillDefaults();
renderAll();
attachPlaces();
if (shopCode) loadShop(shopCode);
loadMine();
loadSettings();

form.addEventListener("input", e => {
  if (/_other$/.test(e.target.name)) scheduleOtherGeocode();
  if (e.target.name === "promo") { state.promo = null; $("#promoMsg").textContent = ""; }
  syncVisibility();
  renderQuote();
});
// Choix d'un service ou d'un moment (hors « programmer ») : on passe à l'étape suivante
form.addEventListener("change", e => {
  if (e.target.name === "service" || (e.target.name === "urgency" && e.target.value !== "programmee")) goNext(e.target.closest("fieldset"));
});
form.addEventListener("change", e => {
  if (/_city$/.test(e.target.name)) scheduleOtherGeocode();
  syncVisibility();
  renderQuote();
});
form.addEventListener("submit", submit);
form.addEventListener("input", e => { if (PROFILE_FIELDS.includes(e.target.name)) rememberProfile(); });
// Mise en forme du numéro quand on quitte le champ (052-123-4567)
form.addEventListener("focusout", e => {
  if (!/_phone$/.test(e.target.name || "") || !e.target.value.trim()) return;
  e.target.value = formatPhone(e.target.value);
  e.target.classList.toggle("field-bad", !phoneOk(e.target.value));
  if (e.target.name === "contact_phone") rememberProfile();
});
form.promo.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } });
$("#promoBtn").addEventListener("click", applyPromo);
$("#examples").addEventListener("click", e => { const b = e.target.closest("[data-ex]"); if (b) applyExample(b.dataset.ex); });
$("#quickFrom").addEventListener("change", renderQuick);
$("#quickTo").addEventListener("change", renderQuick);
$("#quickSwap").addEventListener("click", () => {
  const a = $("#quickFrom").value;
  $("#quickFrom").value = $("#quickTo").value;
  $("#quickTo").value = a;
  renderQuick();
});
$("#quickGo").addEventListener("click", () => {
  form.from_city.value = $("#quickFrom").value;
  form.to_city.value = $("#quickTo").value;
  // Première commande : le code de bienvenue est déjà appliqué
  if (activeOrders().length === 0 && !state.welcomeUsed && !state.promo) { form.promo.value = welcomeCode(); applyPromo(); }
  if (quickWhen === "later") {
    form.elements.urgency.value = "programmee";
    form.date.value = $("#quickDate").value;
    form.time.value = $("#quickTime").value;
  }
  syncVisibility();
  renderQuote();
  $("#commander").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => form.pickup_address.focus({ preventScroll: true }), 600);
});
document.querySelectorAll(".saved-addrs").forEach(box => box.addEventListener("click", e => {
  const b = e.target.closest("[data-addr]");
  if (!b) return;
  const a = Store.getAddresses()[Number(b.dataset.addr)];
  if (a) applySavedAddr(box.dataset.for, a);
}));
document.addEventListener("click", e => { const b = e.target.closest("[data-devis]"); if (b) openRequest(b.dataset.devis); });
$("#reqKind").addEventListener("click", e => { const b = e.target.closest("[data-kind]"); if (b) setReqKind(b.dataset.kind); });
$("#reqForm").addEventListener("submit", sendRequest);
$("#reqClose").addEventListener("click", () => $("#reqModal").classList.add("hidden"));
// Lien direct vers la demande de devis (ex. depuis l'espace pro : index.html#devis)
if (location.hash === "#devis") setTimeout(() => openRequest("tournee"), 300);
$("#shopBannerOff").addEventListener("click", () => {
  state.shop = null;
  state.pick.from = null;
  if (ac.from) ac.from.reset();
  form.pickup_address.value = "";
  setBrandMode("from", false);
  renderShopBanner();
  renderQuote();
  form.pickup_address.focus();
});
$("#coordsEdit").addEventListener("click", () => { $("#coordsBox").dataset.editing = "1"; renderAccount(); form.contact_name.focus(); });
$("#accountCard").addEventListener("click", e => {
  const b = e.target.closest("[data-del-addr]");
  if (!b) return;
  Store.deleteAddress(Number(b.dataset.delAddr));
  renderSavedAddrs();
  renderAccount();
});
let quickWhen = "now";
document.querySelector(".seg").addEventListener("click", e => {
  const b = e.target.closest("[data-when]");
  if (!b) return;
  quickWhen = b.dataset.when;
  b.parentNode.querySelectorAll(".seg-btn").forEach(x => x.classList.toggle("on", x === b));
  $("#quickWhen").classList.toggle("hidden", quickWhen !== "later");
  $("#quickGo").textContent = t(quickWhen === "later" ? "quickCtaLater" : "quickCta");
});
$("#langBtn").addEventListener("click", () => {
  I18N.setLang(I18N.other());
  renderAll();
  $("#quickGo").textContent = t(quickWhen === "later" ? "quickCtaLater" : "quickCta");
});
$("#doneClose").addEventListener("click", () => { $("#doneModal").classList.add("hidden"); location.hash = "mes-courses"; });
$("#refreshMine").addEventListener("click", loadMine);
$("#myOrders").addEventListener("click", onListClick);
$("#waFab").addEventListener("click", openChatMenu);
document.addEventListener("click", e => { if (e.target.closest("[data-support]")) { e.preventDefault(); openSupport(); } });
setTimeout(checkChats, 1500);
setInterval(checkChats, 20000);
$("#mobileGo").addEventListener("click", e => { e.preventDefault(); $("#summary").scrollIntoView({ behavior: "smooth", block: "center" }); });

// Barre du bas : visible dans le formulaire, cachée quand le récapitulatif est à l'écran
if ("IntersectionObserver" in window) {
  const bar = $("#mobileBar");
  let inForm = false, summaryVisible = false;
  const update = () => bar.classList.toggle("show", inForm && !summaryVisible);
  new IntersectionObserver(es => { inForm = es[0].isIntersecting; update(); }).observe(form);
  new IntersectionObserver(es => { summaryVisible = es[0].isIntersecting; update(); }).observe($("#summary"));
}
if (Store.ONLINE) setInterval(() => { loadMine(); loadSettings(); }, 60000);

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
