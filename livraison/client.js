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
const state = { shop: null, pro: null, promo: null, promoMsg: "", fromPoint: null, toPoint: null, mine: [], settings: { accepting: true }, pick: { from: null, to: null }, stops: [] };
const ac = {};

// --- Écrans : l'accueil ne garde que l'essentiel ; la commande, « Mes courses » et « Tout savoir »
// (tarifs, autres distances, idées, offres, FAQ) s'ouvrent à part, au moment voulu ---------------
const VIEW_OF = { accueil: "home", commander: "order", "mes-courses": "mine" };
const VIEW_HASH = { order: "commander", mine: "mes-courses", infos: "infos" };
const viewOf = el => { const sec = el && el.closest && el.closest("body > section"); return sec ? VIEW_OF[sec.id] || "infos" : null; };
const viewTitle = () => { $("#viewTitle").textContent = { order: t("ordTitle"), mine: t("navMine"), infos: t("infosTitle") }[document.body.dataset.view] || ""; };
function setView(v, push) {
  if (!v || document.body.dataset.view === v) return false;
  document.body.dataset.view = v;
  viewTitle();
  if (push) history.pushState(null, "", v === "home" ? location.pathname : "#" + VIEW_HASH[v]);
  window.scrollTo(0, 0);
  // La carte de l'accueil était cachée : elle reprend sa vraie taille (sinon des bandes restent vides)
  if (v === "home") requestAnimationFrame(() => { if (home.map) home.map.invalidateSize(); });
  return true;
}
// Tout ce qui « fait défiler jusqu'à » une partie de la page ouvre d'abord le bon écran
const nativeScrollIntoView = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (o) { setView(viewOf(this), true); return nativeScrollIntoView.call(this, o); };
function routeHash() {
  const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  setView(el ? viewOf(el) || "home" : "home");
  if (el && !/^(accueil|commander|mes-courses|infos)$/.test(el.id)) requestAnimationFrame(() => nativeScrollIntoView.call(el, { block: "start" }));
}
window.addEventListener("hashchange", routeHash);
window.addEventListener("popstate", routeHash);
routeHash();

// Exemples cliquables : ils pré-remplissent le formulaire
const EXAMPLES = [
  // Nouveautés en tête : boulangeries (petit-déjeuner) et pressing
  { id: "bakery", icon: "🥐", set: { service: "repas" } },
  { id: "pressing", icon: "👔", set: { service: "colis" } },
  { id: "poste", icon: "📮", set: { service: "retrait", place_kind: "poste" } },
  { id: "pharm", icon: "💊", set: { service: "retrait", place_kind: "superpharm" } },
  { id: "resto", icon: "🍔", set: { service: "repas", urgency: "express" } },
  { id: "docs",  icon: "📄", set: { service: "colis", round_trip: true } },
  { id: "yad2",  icon: "🛋️", set: { service: "colis", size: "moyen" } },
  { id: "keys",  icon: "🔑", set: { service: "colis", urgency: "express" } },
  { id: "shop",  icon: "🛒", set: { service: "achat" } },
  { id: "gift",  icon: "💐", set: { service: "colis", urgency: "programmee" } },
  { id: "ta",    icon: "🏙️", set: { service: "colis", from_city: CONFIG.homeCity, to_city: "raanana" } }
];

function val(name) { const el = form.elements[name]; return el ? el.value : ""; }
function money(n) { return UI.money(n); }
function cityLabel(id) { return CONFIG.cities.some(c => c.id === id) ? I18N.cityName(id) : id; }

// --- Listes de villes ---------------------------------------------------------
function fillCitySelects() {
  document.querySelectorAll(".city-select").forEach(sel => {
    const current = sel.value;
    // Villes des zones pas encore ouvertes : visibles mais « bientôt »
    const opts = CONFIG.cities.map(c => UI.cityActive(c.id) ? `<option value="${c.id}">${UI.esc(c[I18N.lang])}</option>`
      : `<option value="${c.id}" disabled>${UI.esc(c[I18N.lang])} · ${UI.esc(t("soon"))}</option>`);
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
  renderOpenBadge();
  $("#expressSmall").textContent = `${t("w_express_d")} · +${money(P.express)}`;
  renderWhenHints();
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

  // Zones ouvertes d'abord (par prix), puis les villes « bientôt »
  const rows = CONFIG.cities.map(c => ({ c, price: Pricing.cityToCity(CONFIG, home, c.id), open: UI.cityActive(c.id) }))
    .sort((a, b) => (b.open - a.open) || (a.price - b.price));
  $("#priceGrid").innerHTML = rows.map(r => `<div class="pg-row"><span>${r.c.id === home
    ? UI.esc(t("within", { city: I18N.cityName(home) }))
    : `${UI.esc(I18N.cityName(home))} ⇄ ${UI.esc(r.c[I18N.lang])}`}</span><b>${!UI.cityActive(r.c.id) ? `<small class="muted">${UI.esc(t("soon"))}</small>` : money(r.price)}${Pricing.carPrice(CONFIG, home, r.c.id) != null
      ? ` <small class="muted" title="${UI.esc(t("xBig"))}">🚗 ${money(Pricing.carPrice(CONFIG, home, r.c.id))}</small>` : ""}</b></div>`).join("");

  const extras = [["xExpress", "+ " + money(P.express)], ...(P.pickupPoint ? [["xPickup", "+ " + money(P.pickupPoint)]] : []), ...(P.purchase ? [["xPurchase", "+ " + money(P.purchase)]] : []),
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

// Commande par téléphone chez un commerce pas sur HOP! : repas, ou départ d'une enseigne (pas pour les achats)
const PH_READY = [0, 10, 15, 20, 30, 45, 60];
function phoneOrderOk() { return !proShopOn() && val("service") !== "achat" && (val("service") === "repas" || !!(state.pick.from && state.pick.from.brand)); }
// Le vrai numéro de l'enseigne (carte OpenStreetMap) : on appelle d'ici, la commande en cours reste enregistrée
let callFor = null;
function renderShopCall() {
  const p = state.pick.from, box = $("#shopCall");
  if (!phoneOrderOk() || !p || !p.brand) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const show = num => {
    if (state.pick.from !== p) return;
    box.innerHTML = num
      ? `<a class="btn btn-sm btn-wa" href="tel:${UI.esc(String(num).split(/[;,]/)[0].replace(/[^\d+]/g, ""))}" data-shop-call>📞 ${UI.esc(t("phCall", { name: p.brand }))} · <bdi>${UI.esc(String(num).split(/[;,]/)[0])}</bdi></a>`
      : `<small class="muted">${UI.esc(t("phNoNumber", { name: p.brand }))}</small>`;
  };
  if (callFor === p) return;
  callFor = p;
  box.innerHTML = `<small class="muted">${UI.esc(t("phFinding"))}</small>`;
  Places.phoneOf(p).then(show, () => show(null));
}
function phoneOn() { return phoneOrderOk() && form.phone_order.checked; }
function renderPhone() {
  $("#phoneBox").classList.toggle("hidden", !phoneOrderOk());
  renderShopCall();
  $("#phoneFields").classList.toggle("hidden", !phoneOn());
  // Boutons créés une fois (par langue) puis seulement mis à jour : un toucher n'est jamais perdu
  const box = $("#phReadyChips");
  if (box.dataset.lang !== I18N.lang) {
    box.innerHTML = PH_READY.map(n => `<button type="button" class="ch-chip" data-ready="${n}">${UI.esc(n ? t("phMin", { n }) : t("phNow"))}</button>`).join("");
    box.dataset.lang = I18N.lang;
  }
  box.querySelectorAll("[data-ready]").forEach(el => el.classList.toggle("on", Number(el.dataset.ready) === state.phoneReady));
}

// --- Colis à récupérer : les documents demandés selon le lieu (photos), envoyés avec la commande ---------
const docs = {};
let docsKey = "";
function renderDocs() {
  const box = $("#docsBox");
  if (!box) return;
  const need = Store.docsFor(curOrderKind());
  box.classList.toggle("hidden", !need.length);
  const rx = val("service") === "achat" && form.rx.checked;
  const key = need.map(k => k + (docs[k] ? "+" : "")).join(",") + I18N.lang;
  if (key === docsKey) return;
  docsKey = key;
  box.innerHTML = need.length ? `<h4>${UI.esc(t("docsTitle"))}</h4><p>${UI.esc(t("docsWhy"))}</p>
    ${need.map(k => `<div class="doc-row${docs[k] ? " ok" : ""}">
      ${docs[k] ? `<img src="${docs[k]}" alt="" />` : `<span class="doc-ph">📄</span>`}
      <span class="doc-label">${UI.esc(t(k === "identite" && rx ? "doc_identite_rx" : "doc_" + k))}${docs[k] ? `<br><b>${UI.esc(t("docOk"))}</b>` : ""}</span>
      <label class="btn btn-sm${docs[k] ? "" : " btn-primary"}">${UI.esc(t(docs[k] ? "docChange" : "docAdd"))}<input type="file" accept="image/*" data-doc="${k}" hidden /></label>
    </div>`).join("")}
    <p style="margin-top:8px">${UI.esc(t("docsPrivacy"))}</p>` : "";
}
// Ce que demande la course en cours de saisie (même règle que la base : order_docs_needed)
function curOrderKind() {
  return { service: val("service"), place_kind: val("place_kind"), rx: form.rx.checked, post_send: form.post_send.checked };
}
function docsMissing() {
  return Store.docsFor(curOrderKind()).find(k => !docs[k]);
}

// « C'est moi qui reçois » : pas besoin de redonner son nom et son numéro (ceux de « Vos coordonnées »)
function syncDropMe() {
  const me = form.drop_me.checked;
  form.querySelectorAll(".drop-other").forEach(el => el.classList.toggle("hidden", me));
  const name = val("contact_name").trim(), phone = val("contact_phone").trim();
  $("#dropMeWho").textContent = !me ? "" : name || phone ? t("dropMeWho", { who: [name, phone].filter(Boolean).join(" · ") }) : t("dropMeNote");
}
function syncVisibility() {
  const svc = val("service");
  renderPhone();
  syncDropMe();
  // Gros colis (voiture) : seulement quand une voiture est disponible
  const gros = form.querySelector('input[name=size][value=gros]');
  gros.closest(".choice").classList.toggle("hidden", P.carAvailable === false);
  if (P.carAvailable === false && gros.checked) form.querySelector('input[name=size][value=moyen]').checked = true;
  form.classList.remove("svc-colis", "svc-retrait", "svc-achat", "svc-repas", "place-poste");
  form.classList.add("svc-" + svc);
  form.classList.remove("place-locker", "post-send");
  if (svc === "colis" && form.post_send.checked) form.classList.add("post-send");
  form.querySelector(".sale-paid").classList.toggle("hidden", !(svc === "colis" && form.p2p_sale.checked));
  $("#apptNote").textContent = t(svc === "colis" ? "apptNoteSend" : "apptNote");
  if (svc === "retrait" && val("place_kind") === "poste") form.classList.add("place-poste");
  if (svc === "retrait" && val("place_kind") === "locker") form.classList.add("place-locker");
  renderDocs();
  // Supermarché : rappel « petites courses seulement » (le top case du scooter)
  const sp = state.pick.from && (state.pick.from.brand || state.pick.from.streetName || "");
  $("#superNote").classList.toggle("hidden", !(svc === "achat" && /rami|רמי|shufersal|שופרסל|victory|ויקטורי|yochananof|יוחננוף|osher|אושר עד|tiv ta|טיב טעם|carrefour|קרפור|yeinot|יינות|mega|מגה|super|סופר/i.test(sp || "")));
  $("#pickupLegend").textContent = t(svc === "retrait" ? "s2_retrait" : svc === "achat" ? "s2_achat" : "s2");
  form.pickup_address.placeholder = svc === "retrait" ? t("placeAddrPh") : t("addressPh");
  $("#whenFields").classList.toggle("hidden", val("urgency") !== "programmee");
  // Commande chez un commerce HOP! Pro : seulement l'essentiel (articles, adresse du client, heure, mot pour le livreur, paiement)
  const side = shopMode();
  form.classList.toggle("shop-mode", !!side);
  form.classList.toggle("shop-from", side === "from");
  form.classList.toggle("shop-to", side === "to");
  $("#sizeLegend").textContent = t(side ? "s5Shop" : "s5");
  const sched = val("urgency") === "programmee";
  // Carnet pro proposé seulement quand il s'applique
  const carnet = carnetOk();
  $("#carnetChoice").classList.toggle("hidden", !carnet);
  if (carnet) $("#carnetSmall").textContent = t("pay_carnet_d", { n: state.pro.credits });
  const carnetOn = carnet && val("payment_method") === "carnet";
  // Bit ou PayBox directement au livreur, espèces (montant exact, billet du client), ou carnet pro du commerce
  if (!carnet && val("payment_method") === "carnet") form.querySelector('input[name=payment_method][value=bit]').checked = true;
  $("#bitSmall").textContent = t("pay_bit_d", { phone: CONFIG.bitPhone });
  $("#cashSmall").textContent = t("pay_cash_d2", { max: money(cashMax()) });
  renderCash();
  $("#prepayNote").classList.add("hidden");
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
  if (u === "asap") return openNow() ? new Date() : firstSlot();
  const [y, m, d] = val("date").split("-").map(Number);
  const [hh, mm] = val("time").split(":").map(Number);
  if (!y || isNaN(hh)) return null;
  return new Date(y, m - 1, d, hh, mm);
}

function scheduleError() {
  const u = val("urgency");
  if (!state.settings.accepting && u !== "programmee") return { key: "errNotAccepting" };
  if (u === "asap") return null;
  if (u === "express") return openNow() ? null : { key: "errExpressClosed" };
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
    && val("urgency") !== "express" && !form.round_trip.checked && !state.stops.length
    && ["colis", "repas"].includes(val("service")));
}
const carnetUnit = () => Number(state.settings.carnet_unit || CONFIG.partners.carnet.price / CONFIG.partners.carnet.courses);

function currentQuote() {
  const q = baseQuote();
  if (!proShopOn()) return q;
  // Le commerce paie sa part (12 − 2 = 10 ₪ de moins pour le client), sauf s'il a choisi « le client paie »
  const share = Math.min(q.total, state.shop.client_pays ? 0
    : Number(state.shop.shop_share != null ? state.shop.shop_share : CONFIG.pro.shopShare - CONFIG.pro.hopShare));
  if (!(share > 0)) return q;
  return Object.assign({}, q, { total: q.total - share, lines: q.lines.concat([{ key: "qShopShare", vars: { name: state.shop.name }, amount: -share, discount: true }]) });
}
function baseQuote() {
  if (val("payment_method") === "carnet" && carnetOk()) {
    return { total: carnetUnit(), known: true, distanceKm: 0, lines: [{ key: "qCarnet", vars: { n: state.pro.credits - 1 }, amount: carnetUnit() }] };
  }
  return Pricing.computeQuote({
    fromCity: cityOf("from"), toCity: cityOf("to"),
    fromPoint: state.fromPoint, toPoint: state.toPoint,
    service: val("service"), urgency: val("urgency"), size: val("size"),
    roundTrip: form.round_trip.checked, stops: state.stops.map(s => ({ onWay: stopOnWay(s) })),
    discount: currentDiscount()
  }, CONFIG);
}

function lineLabel(l) {
  const v = Object.assign({}, l.vars);
  if (v.from) v.from = cityLabel(v.from);
  if (v.to) v.to = cityLabel(v.to);
  if (v.city) v.city = cityLabel(v.city);
  if (v.area) { const z = (CONFIG.pricing.areas.list || []).find(x => x.id === v.area); v.area = z ? z[I18N.lang] || z.fr : v.area; }
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
    [$("#coordsBox"), filled("contact_name") && phoneOk(val("contact_phone"))],
    ...(proShopOn() ? [[$("#shopOrderBox"), filled("shop_order") || cartCount() > 0]] : [])
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

// --- Espèces : le client paie tout au livreur (articles + livraison) ; il dit avec quel billet ---------
const cashMax = () => Number((state.settings && state.settings.cash_max) || 200);
const cashGoods = () => (proShopOn() && cartCount() ? cartTotal() : 0);
function renderCash() {
  const on = val("payment_method") === "cash";
  $("#cashBox").classList.toggle("hidden", !on);
  if (!on) return;
  const q = currentQuote(), goods = cashGoods(), total = Number(q.total) + goods;
  $("#cashTotal").textContent = t(goods ? "cashTotalGoods" : "cashTotal", { total: money(total), goods: money(goods), course: money(q.total) });
  // (le billet choisi reste choisi ; s'il ne suffit plus, on le dit au moment d'envoyer)
  const cur = Number(form.cash_note.value) || 0;
  const notes = [0, 50, 100, 200].filter(n => n === 0 || n >= total || n === cur);
  // Redessiné seulement si ça change (sinon un toucher pendant la sortie d'un champ serait perdu)
  const chips = notes.map(n => `<button type="button" class="ch-chip${(Number(form.cash_note.value) || 0) === n ? " on" : ""}" data-cash-note="${n}">${n ? money(n) : UI.esc(t("cashExact"))}</button>`).join("");
  if ($("#cashNotes").dataset.html !== chips) { $("#cashNotes").innerHTML = chips; $("#cashNotes").dataset.html = chips; }
  const n = Number(form.cash_note.value) || 0;
  $("#cashRule").textContent = (n && n < total ? t("errCashNote") + " " : n ? t("cashChange", { change: money(n - total) }) + " " : "") + t("cashRule", { max: money(cashMax()) });
}
$("#cashNotes").addEventListener("click", e => {
  const b = e.target.closest("[data-cash-note]");
  if (!b) return;
  form.cash_note.value = b.dataset.cashNote;
  renderCash();
});

function renderQuote() {
  renderShopBanner();
  const q = currentQuote();
  // Courses faites par HOP (ou commande chez un commerce Pro) : les articles au prix du magasin, en plus
  const goods = val("service") === "achat" || proShopOn();
  $("#quoteLines").innerHTML = q.lines.map(l =>
    `<li class="${l.discount ? "disc" : ""}"><span>${UI.esc(lineLabel(l))}</span><span dir="ltr">${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}</span></li>`).join("")
    // Pas de frais cachés : on le montre noir sur blanc
    + `<li class="zero"><span>${UI.esc(t("qService"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + `<li class="zero"><span>${UI.esc(t("qSmall"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + (goods && proShopOn() && cartCount() ? `<li class="goods"><span>${UI.esc(t("qItems", { total: money(cartTotal()), name: state.shop.name }))}</span></li>` : "")
    + (goods && !(proShopOn() && cartCount()) ? `<li class="goods"><span>${UI.esc(t(proShopOn() ? "qGoodsPro" : "qGoods"))}</span></li>` : "")
    + (phoneOn() ? `<li class="goods"><span>${UI.esc(t("qGoodsPhone"))}</span></li>` : "");
  const total = (q.known ? "" : t("from") + " ") + money(q.total);
  $("#quoteTotal").textContent = total;
  $("#mobileTotal").textContent = total;
  $("#submitBtn").textContent = t("submit", { total: money(q.total) });
  const notes = [];
  if (!q.known) notes.push(t("qUnknown"));
  if (val("service") === "achat") notes.push(t("qPurchaseNote"));
  const st = state.settings;
  if (st.wait_step_price != null) notes.push(t("qWait", { free: st.wait_free_min, step: Number(st.wait_step_min) === 1 ? t("stepMin1") : t("stepMinN", { n: st.wait_step_min }), price: money(st.wait_step_price), max: money(st.wait_max) }));
  const sched = val("urgency") === "programmee";
  notes.push(val("payment_method") === "carnet" ? t("payNoteCarnet")
    : val("payment_method") === "bit" ? t(sched ? "payNoteBit" : "payNoteBitNow", { phone: CONFIG.bitPhone }) : t("payNoteCash2"));
  renderCash();
  $("#quoteNote").textContent = notes.join(" ");
  updateProgress();
  const err = scheduleError();
  $("#scheduleError").textContent = err ? t(err.key, err.vars) : "";
  $("#scheduleError").classList.toggle("hidden", !err);
  syncHome();
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
// Enseigne absente de la carte, indiquée par le client sur une rue sans numéro : on demande le numéro
const needsNo = p => !!(p && p.learned && !p.housenumber);
function setBrandMode(which, on) {
  const pre = prefixOf(which);
  form.elements[pre + "_address"].closest(".fields").classList.toggle("brand-mode", !!on);
  if (on) DETAIL.forEach(k => { form.elements[pre + "_" + k].value = ""; });
}

function onPlacePicked(which, p, quiet) {
  if (which === "from" && p.partnerCode) { state.shopDir = "from"; loadShop(p.partnerCode, true); return; }
  if (which === "to" && p.partnerCode && p.kind && BOTH_WAYS.includes(p.kind)) { state.shopDir = "to"; loadShop(p.partnerCode, true); return; }
  state.pick[which] = p;
  // Le champ du formulaire porte l'adresse choisie avant le calcul du prix
  if (ac[which] && form.elements[prefixOf(which) + "_address"].value !== p.label) ac[which].setPicked(p.label);
  setBrandMode(which, !!p.brand && !needsNo(p));
  const sel = form.elements[which + "_city"];
  if (p.cityId) sel.value = p.cityId;
  else if (p.city) { sel.value = OTHER; form.elements[which + "_other"].value = p.city; }
  state[which + "Point"] = { lat: p.lat, lon: p.lon };
  // Numéro de rue : rempli si la carte le connaît, sinon on invite à le saisir (sauf enseigne)
  const num = form.elements[which === "from" ? "pickup_number" : "dropoff_number"];
  num.value = p.housenumber || "";
  // (sauf si le client est déjà passé à un autre champ entre-temps)
  const addr = form.elements[prefixOf(which) + "_address"];
  if (!quiet && !p.housenumber && (!p.brand || needsNo(p))) setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || a === addr) num.focus(); }, 50);
  // Départ dans un restaurant (annuaire, carte) : c'est un repas, pas un colis
  // Un pressing n'est jamais un repas : c'est une course d'objets (vêtements)
  if (which === "from" && isPressing(p) && val("service") === "repas" && !state.svcChosen) form.elements.service.value = "colis";
  if (which === "from" && p.food && !isPressing(p) && val("service") === "colis" && !state.homeKind && !state.svcChosen) {
    form.elements.service.value = "repas";
    state.homeKind = "resto";
    renderHomeStatic();
  }
  if (which === "from" && val("service") === "retrait" && p.brand) {
    const kind = detectPlaceKind(p.brand);
    if (kind) form.place_kind.value = kind;
  }
  syncVisibility();
  renderQuote();
  renderShopBanner();
  renderSaveBtns();
  if (which === "to" && form.nearest_store.checked) applyNearest();
  if (which === "from") renderWhenHints();
}

// --- Arrêts en plus (au plus CONFIG.pricing.stop.maxStops) : moitié prix s'ils sont sur le chemin ---------
const STOP = CONFIG.pricing.stop || { onWayKm: 1.5, onWayPercent: 50, maxStops: 2 };
const stopPoint = s => (s.place && s.place.lat != null ? { lat: Number(s.place.lat), lon: Number(s.place.lon) } : null);
function stopDetour(s) {
  const c = city => { const x = Pricing.cityById(CONFIG, city); return x ? { lat: x.lat, lon: x.lon } : null; };
  return Pricing.stopDetourKm(state.fromPoint || c(cityOf("from")), stopPoint(s), state.toPoint || c(cityOf("to")));
}
function stopOnWay(s) { const d = stopDetour(s); return d != null && d <= STOP.onWayKm; }
function renderStopInfo() {
  state.stops.forEach((s, i) => {
    const el = $(`#stopsList [data-stop="${i}"] .stop-way`);
    if (!el) return;
    const d = stopDetour(s);
    el.textContent = d == null ? "" : stopOnWay(s) ? t("stOnWay") : t("stOffWay", { km: d.toFixed(1).replace(".", I18N.lang === "he" ? "." : ",") });
    el.classList.toggle("off", d != null && !stopOnWay(s));
  });
  $("#addStop").classList.toggle("hidden", state.stops.length >= STOP.maxStops);
  form.extra_stops.value = state.stops.length;
}
function renderStops() {
  $("#stopsList").innerHTML = state.stops.map((s, i) => `<div class="stop-row" data-stop="${i}">
      <div class="stop-head"><b>📌 ${UI.esc(t("stN", { n: i + 1 }))}</b><span class="stop-way"></span><button type="button" class="btn btn-link btn-sm" data-stop-del="${i}">${UI.esc(t("stRemove"))}</button></div>
      <div class="stop-fields">
        <label class="f"><input data-stop-addr="${i}" value="${UI.esc(s.label || "")}" placeholder="${UI.esc(t("stAddrPh"))}" /></label>
        <label class="f stop-no"><input data-stop-no="${i}" value="${UI.esc(s.number || "")}" placeholder="${UI.esc(t("stNoPh"))}" autocomplete="off" /></label>
      </div>
      <div class="stop-do">${["deposer", "recuperer", "acheter"].map(k => `<button type="button" class="ch-chip${s.todo === k ? " on" : ""}" data-stop-do="${i}" data-v="${k}">${UI.esc(t("stDo_" + k))}</button>`).join("")}</div>
      <label class="f"><input data-stop-note="${i}" value="${UI.esc(s.note || "")}" placeholder="${UI.esc(t("stNotePh"))}" /></label>
    </div>`).join("");
  state.stops.forEach((s, i) => {
    Places.attach($(`#stopsList [data-stop-addr="${i}"]`), {
      lang: () => I18N.lang,
      texts: () => ({ none: t("addrNone"), down: t("addrDown"), partner: t("ensPartner"), notOnMap: t("addrNotOnMap"), notOnMapSub: t("addrNotOnMapSub"), brandAddr: t("addrBrandAddr"), soon: t("addrSoon"), didYouMean: t("addrDidYou") }),
      onPick: p => { s.place = p; s.label = p.label; renderStopInfo(); renderQuote(); },
      onClear: () => { s.place = null; s.label = ""; renderStopInfo(); renderQuote(); }
    });
  });
  renderStopInfo();
}
function stopsForOrder() {
  return state.stops.map(s => ({
    address: [s.place ? (s.place.brand ? s.place.brand + ", " : "") + (s.place.streetName || s.place.street || "") : s.label, s.number].filter(Boolean).join(" ").trim(),
    city: s.place ? s.place.city || null : null, lat: s.place ? s.place.lat : null, lon: s.place ? s.place.lon : null,
    todo: s.todo || "deposer", note: (s.note || "").trim() || null, on_way: stopOnWay(s)
  }));
}

// --- Tabac et alcool : 18 ans et plus, pas d'alcool entre 23 h et 6 h ; achat au plus près du client ---------
const TOBACCO_RE = /cigar|clope|tabac|marlboro|winston|camel|נובלס|סיגרי|טבק|סיגר/i;
const ALCOHOL_RE = /alcool|bi[eè]re|\bvins?\b|vodka|whisk|arak|rhum|champagne|tequila|\bgin\b|liqueur|בירה|יין|וודקה|ערק|ויסקי|אלכוהול|שמפניה/i;
const adultItems = () => [form.has_tobacco.checked && "tabac", form.has_alcohol.checked && "alcool"].filter(Boolean);
function alcoholForbiddenAt(d) { if (!d) return false; const h = Pricing.localParts(d, CONFIG.timezone).hour; return h >= 23 || h < 6; }
function syncAdult() {
  const achat = val("service") === "achat";
  const any = achat && adultItems().length > 0;
  $("#adultOkBox").classList.toggle("hidden", !any);
  $("#alcoholNote").classList.toggle("hidden", !(achat && form.has_alcohol.checked && alcoholForbiddenAt(pickupDate() || new Date())));
}
// « Le plus proche de chez moi » : le départ devient l'adresse du client, le livreur choisit le magasin
function applyNearest() {
  const on = val("service") === "achat" && form.nearest_store.checked;
  form.classList.toggle("near-on", on);
  // Plus besoin de l'adresse du magasin, ni de contact sur place
  [form.pickup_address, form.pickup_number, form.from_city, form.pickup_contact, form.pickup_phone].forEach(el => el && el.closest("label").classList.toggle("hidden", on));
  ['.saved-addrs[data-for="from"]', '[data-geo="from"]', '[data-kind="pickup"]', '[data-details="pickup"]'].forEach(q => {
    const el = form.querySelector(q); if (el) (el.closest(".addr-tools") || el).classList.toggle("near-hide", on);
  });
  if (!on && state.pick.from && state.pick.from.nearest) {
    state.pick.from = null; state.fromPoint = null; form.pickup_address.value = ""; setBrandMode("from", false); renderQuote();
  }
  if (!on || !state.pick.to) return;
  const p = Object.assign({}, state.pick.to, { brand: t("nearBrand"), partnerCode: null, nearest: true });
  p.label = [p.brand, cityLabel(p.cityId || p.city)].filter(Boolean).join(", ");
  onPlacePicked("from", p, true);
}

function attachPlaces() {
  ["from", "to"].forEach(which => {
    ac[which] = Places.attach(form.elements[which === "from" ? "pickup_address" : "dropoff_address"], {
      lang: () => I18N.lang,
      texts: () => ({ none: t("addrNone"), down: t("addrDown"), partner: t("ensPartner"), notOnMap: t("addrNotOnMap"), notOnMapSub: t("addrNotOnMapSub"), brandAddr: t("addrBrandAddr"), soon: t("addrSoon"), didYouMean: t("addrDidYou") }),
      onPick: p => onPlacePicked(which, p),
      quick: () => quickPlaces(which, false),
      onClear: () => { state.pick[which] = null; setBrandMode(which, false); renderQuote(); renderShopBanner(); renderSaveBtns(); }
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

// 🏠 Maison, 💼 Travail, ⭐ un nom choisi, 🏪 une enseigne, 📍 une adresse
function addrIcon(a) { return a.tag === "home" ? "🏠" : a.tag === "work" ? "💼" : a.tag ? "⭐" : a.brand ? "🏪" : "📍"; }
function addrChip(a) {
  const name = a.tag === "home" ? t("tagHome") : a.tag === "work" ? t("tagWork") : a.tag ? a.name : "";
  return `${addrIcon(a)} ${name ? `<b>${UI.esc(name)}</b> · ` : ""}${UI.esc(addrLabel(a))}`;
}

function tagName(a) { return a.tag === "home" ? t("tagHome") : a.tag === "work" ? t("tagWork") : a.tag ? a.name : ""; }
// Raccourcis de la liste des adresses : « Ma position » puis les adresses enregistrées
function quickPlaces(which, isHome) {
  const after = () => { const p = state.pick[which]; if (p && home.ac[which]) home.ac[which].setPicked(p.label); if (p && ac[which]) ac[which].setPicked(p.label); syncHome(); };
  const list = [{ quick: true, icon: "📍", title: t("myPosChip").replace(/^📍\s*/, ""), sub: t("qpPosSub"), apply: async () => {
    const err = await locateInto(which);
    if (err) (isHome ? showHomeErr : showError)(t(err)); else after();
  } }];
  Store.getAddresses().slice(0, 10).forEach(a => list.push({ quick: true, icon: addrIcon(a), title: tagName(a) || addrLabel(a), sub: tagName(a) ? addrLabel(a) : "",
    match: [tagName(a), addrLabel(a)].join(" "),
    apply: () => { applySavedAddr(which, a); after(); } }));
  return list;
}

function renderSavedAddrs() {
  const list = Store.getAddresses();
  if (home.ac.from) renderHomeStatic();
  // Comme dans les applis : 🏠 Maison et 💼 Travail toujours proposés (à ajouter s'ils manquent), puis les autres adresses
  const slot = tag => { const i = list.findIndex(a => a.tag === tag); return i >= 0
    ? `<button type="button" class="addr-chip tagged" data-addr="${i}">${addrChip(list[i])}</button>`
    : `<button type="button" class="addr-chip add" data-add-tag="${tag}">＋ ${tag === "home" ? "🏠 " + UI.esc(t("tagHome")) : "💼 " + UI.esc(t("tagWork"))}</button>`; };
  const others = list.map((a, i) => ({ a, i })).filter(x => x.a.tag !== "home" && x.a.tag !== "work").slice(0, 4);
  const html = `<small>${UI.esc(t("savedTitle"))}</small>${slot("home")}${slot("work")}`
    + others.map(x => `<button type="button" class="addr-chip" data-addr="${x.i}">${addrChip(x.a)}</button>`).join("")
    + `<button type="button" class="addr-chip add" data-add-tag="other">＋ ${UI.esc(t("asAddOther"))}</button>`;
  document.querySelectorAll(".saved-addrs").forEach(box => { box.classList.remove("hidden"); box.innerHTML = html; });
}

// --- Fenêtre « Ajouter / modifier une adresse » (Maison, Travail, autre) ----------------------
const sheet = { tag: null, which: null, idx: -1, pick: null, ac: null };
function openAddrSheet(tag, which, idx) {
  const list = Store.getAddresses(), a = idx >= 0 ? list[idx] : list.find(x => tag !== "other" && x.tag === tag);
  Object.assign(sheet, { tag, which: which || null, idx: a ? list.indexOf(a) : -1, pick: null });
  const titleKey = tag === "home" ? "tagHome" : tag === "work" ? "tagWork" : "asOther";
  $("#asTitle").textContent = (tag === "home" ? "🏠 " : tag === "work" ? "💼 " : "⭐ ") + t(titleKey);
  [["asNameLbl", "tagNamePh"], ["asAddrLbl", "asAddrLbl"], ["asNoLbl", "asNoLbl"], ["asFloorLbl", "floor"], ["asAptLbl", "apt"], ["asCodeLbl", "entryCode"], ["asNoteLbl", "addrNote"]]
    .forEach(([id, k]) => { $("#" + id).textContent = t(k); });
  $("#asPos").textContent = t("myPosChip"); $("#asSave").textContent = t("asSave"); $("#asDel").textContent = "✕ " + t("accDelete");
  document.querySelector("#addrSheet .as-name").classList.toggle("hidden", tag !== "other");
  $("#asName").value = a && a.tag === "other" ? a.name || "" : "";
  $("#asNo").value = a ? a.number || "" : ""; $("#asFloor").value = a ? a.floor || "" : ""; $("#asApt").value = a ? a.apt || "" : "";
  $("#asCode").value = a ? a.code || "" : ""; $("#asNote").value = a ? a.note || "" : "";
  $("#asErr").classList.add("hidden");
  $("#asDel").classList.toggle("hidden", sheet.idx < 0);
  if (!sheet.ac) sheet.ac = Places.attach($("#asAddr"), {
    lang: () => I18N.lang,
    texts: () => ({ none: t("addrNone"), down: t("addrDown"), partner: t("ensPartner"), notOnMap: t("addrNotOnMap"), notOnMapSub: t("addrNotOnMapSub"), brandAddr: t("addrBrandAddr"), soon: t("addrSoon"), didYouMean: t("addrDidYou") }),
    onPick: p => { sheet.pick = p; $("#asErr").classList.add("hidden"); if (p.housenumber && !$("#asNo").value) $("#asNo").value = p.housenumber; if (!p.housenumber && !p.brand) setTimeout(() => $("#asNo").focus(), 50); },
    onClear: () => { sheet.pick = null; }
  });
  if (a) {
    sheet.pick = { lat: a.lat, lon: a.lon, streetName: a.street, housenumber: a.number, brand: a.brand, cityId: a.cityId, city: a.city, exact: a.exact,
      label: [a.brand, a.street, cityLabel(a.cityId || a.city)].filter(Boolean).join(", ") };
    sheet.ac.setPicked(sheet.pick.label);
  } else { sheet.ac.reset(); $("#asAddr").value = ""; }
  $("#addrSheet").classList.remove("hidden");
  setTimeout(() => (tag === "other" && !a ? $("#asName") : a ? $("#asNo") : $("#asAddr")).focus(), 80);
}
function closeAddrSheet() { $("#addrSheet").classList.add("hidden"); }
function saveAddrSheet() {
  const err = m => { $("#asErr").textContent = m; $("#asErr").classList.remove("hidden"); };
  const p = sheet.pick, name = $("#asName").value.trim();
  if (sheet.tag === "other" && !name) return err(t("asNeedName"));
  if (!p || p.lat == null) return err(t("asNeedAddr"));
  const number = $("#asNo").value.trim() || p.housenumber || "";
  if (!number && !p.brand) return err(t("errHouseNo"));
  const cityId = p.cityId || cityIdOf(p.city, p);
  const addr = { street: p.streetName || (p.brand ? "" : p.street) || "", number, brand: p.brand || null,
    city: p.city || cityId, cityId: CONFIG.cities.some(c => c.id === cityId) ? cityId : null, lat: p.lat, lon: p.lon, exact: !!(p.exact || number),
    floor: $("#asFloor").value.trim() || null, apt: $("#asApt").value.trim() || null, code: $("#asCode").value.trim() || null,
    note: $("#asNote").value.trim() || null, building: null, kind: null, tag: sheet.tag, name: sheet.tag === "other" ? name : null };
  if (sheet.idx >= 0) Store.deleteAddress(sheet.idx);
  Store.saveAddress(addr);
  closeAddrSheet();
  if (sheet.which) applySavedAddr(sheet.which, addr);
  renderSavedAddrs();
  renderAccount();
}
$("#asClose").addEventListener("click", closeAddrSheet);
$("#addrSheet").addEventListener("click", e => { if (e.target.id === "addrSheet") closeAddrSheet(); });
$("#asSave").addEventListener("click", saveAddrSheet);
$("#asDel").addEventListener("click", () => { if (sheet.idx >= 0 && confirm(t("accDelete") + " ?")) { Store.deleteAddress(sheet.idx); closeAddrSheet(); renderSavedAddrs(); renderAccount(); } });
$("#asPos").addEventListener("click", async () => {
  const b = $("#asPos"); b.disabled = true; b.textContent = t("geoLocating");
  try {
    const pos = await myPosition(); setHomePos(pos);
    const r = (await Places.reverse(pos.lat, pos.lon, I18N.lang))[0];
    if (!r) throw new Error("none");
    sheet.pick = Object.assign(r, { lat: pos.lat, lon: pos.lon, exact: true });
    sheet.ac.setPicked(r.label);
    if (r.housenumber) $("#asNo").value = r.housenumber;
  } catch (e) { $("#asErr").textContent = t("geoDenied"); $("#asErr").classList.remove("hidden"); }
  b.disabled = false; b.textContent = t("myPosChip");
});
// « ＋ Maison », « ＋ Travail », « ＋ Autre adresse » : partout (commande, compte)
document.addEventListener("click", e => {
  const b = e.target.closest("[data-add-tag]");
  if (!b) return;
  const box = b.closest(".saved-addrs");
  openAddrSheet(b.dataset.addTag, box ? box.dataset.for : null, -1);
});

// --- Type de lieu (maison, appartement, bureau, commerce) : une maison n'a pas d'étage ni d'appartement ---
function kindOf(pre) { const r = form.querySelector(`input[name="${pre}_kind"]:checked`); return r ? r.value : null; }
function setKind(pre, v) {
  form.querySelectorAll(`input[name="${pre}_kind"]`).forEach(r => { r.checked = r.value === v; r.closest(".ch-chip").classList.toggle("on", r.checked); });
  const box = form.querySelector(`[data-details="${pre}"]`);
  if (box) box.classList.toggle("is-house", v === "maison");
}
// Conditions de livraison d'objets : pour tout envoi, sauf un repas ou une commande chez un commerce HOP! Pro
const needsRules = () => val("service") !== "repas" && !proShopOn() && !shopMode();
function openRules() { $("#rulesModal").classList.remove("hidden"); }

function applySavedAddr(which, a) {
  const pre = prefixOf(which);
  const label = [a.brand, a.street, cityLabel(a.cityId || a.city)].filter(Boolean).join(", ");
  const sel = form.elements[which + "_city"];
  if (a.cityId) sel.value = a.cityId; else { sel.value = OTHER; form.elements[which + "_other"].value = a.city || ""; }
  form.elements[pre + "_number"].value = a.number || "";
  DETAIL.forEach(k => { form.elements[pre + "_" + k].value = a[k] || ""; });
  form.elements[pre + "_note"].value = a.note || "";
  setKind(pre, a.kind || null);
  state.pick[which] = { lat: a.lat, lon: a.lon, streetName: a.street, housenumber: a.number, brand: a.brand, cityId: a.cityId, city: a.city, label, exact: a.exact };
  setBrandMode(which, !!a.brand);
  state[which + "Point"] = a.lat != null ? { lat: a.lat, lon: a.lon } : null;
  if (ac[which]) ac[which].setPicked(label);
  syncVisibility();
  renderQuote();
  renderShopBanner();
  renderSaveBtns();
  // « Le plus proche de chez moi » : le départ suit aussi une adresse enregistrée choisie pour l'arrivée
  if (which === "to" && form.nearest_store.checked) applyNearest();
}

// --- « 📍 Ma position » et « ⭐ Enregistrer cette adresse » -----------------------------------
function renderSaveBtns() {
  ["from", "to"].forEach(w => {
    const b = form.querySelector(`[data-save-addr="${w}"]`);
    if (!b) return;
    b.classList.toggle("hidden", !state.pick[w]);
    b.textContent = t("saveAddr");
    // Plus d'adresse choisie : les choix Maison / Travail disparaissent aussi
    if (!state.pick[w] && b.parentNode) b.parentNode.querySelectorAll(".save-tags").forEach(x => x.remove());
  });
}
function myPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("nogeo"));
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  });
}
// Adresse à la position du téléphone ; renvoie la clé du message d'erreur, ou null
async function locateInto(which) {
  let pos;
  try { pos = await myPosition(); } catch (e) { return "geoDenied"; }
  setHomePos(pos);
  let list = [];
  try { list = await Places.reverse(pos.lat, pos.lon, I18N.lang); } catch (e) { /* message ci-dessous */ }
  const p = list[0];
  if (!p) return "geoNone";
  // Le point exact est celui du téléphone (plus précis que le centre de la rue)
  Object.assign(p, { lat: pos.lat, lon: pos.lon, exact: true, gps: true });
  onPlacePicked(which, p, true);
  if (ac[which]) ac[which].setPicked(p.label);
  return null;
}
async function useMyPosition(which, btn) {
  btn.disabled = true;
  btn.textContent = t("geoLocating");
  showError("");
  try {
    const err = await locateInto(which);
    if (err) showError(t(err));
    else if (!val(prefixOf(which) + "_number").trim()) { form.elements[prefixOf(which) + "_number"].focus(); showError(t("errHouseNo")); }
  } finally {
    btn.disabled = false;
    btn.textContent = t("useMyPos");
  }
}
// « ⭐ Enregistrer » : on choisit Maison, Travail ou un autre nom
function askSaveTag(which, btn) {
  const tools = btn.parentNode;
  tools.querySelectorAll(".save-tags").forEach(x => x.remove());
  const box = document.createElement("span");
  box.className = "save-tags";
  box.innerHTML = [["home", "🏠 " + t("tagHome")], ["work", "💼 " + t("tagWork")], ["other", "⭐ " + t("tagOther")]]
    .map(([k, l]) => `<button type="button" class="btn btn-sm" data-save-tag="${k}" data-for="${which}">${UI.esc(l)}</button>`).join("");
  btn.classList.add("hidden");
  tools.appendChild(box);
}
function saveCurrentAddress(which, btn, tag) {
  const p = state.pick[which];
  if (!p) { btn.closest(".addr-tools") && btn.closest(".addr-tools").querySelectorAll(".save-tags").forEach(x => x.remove()); return showError(t("asNeedAddr")); }
  let name = null;
  if (tag === "other") {
    name = (prompt(t("tagNamePh")) || "").trim().slice(0, 30);
    if (!name) return;
  }
  if (!p) return;
  const pre = prefixOf(which), cityId = cityOf(which);
  Store.saveAddress({
    street: p.streetName || p.brand || "", number: val(pre + "_number").trim(), brand: p.brand || null,
    city: p.city || cityId, cityId: CONFIG.cities.some(c => c.id === cityId) ? cityId : null,
    lat: p.lat, lon: p.lon, exact: !!p.exact,
    building: val(pre + "_building").trim() || null, floor: val(pre + "_floor").trim() || null,
    apt: val(pre + "_apt").trim() || null, code: val(pre + "_code").trim() || null, note: val(pre + "_note").trim() || null,
    kind: kindOf(pre), tag: tag || null, name
  });
  const tools = btn.closest(".addr-tools");
  if (tools) {
    tools.querySelectorAll(".save-tags").forEach(x => x.remove());
    const b = tools.querySelector("[data-save-addr]");
    if (b) { b.classList.remove("hidden"); b.textContent = t("addrSaved"); }
  }
  renderSavedAddrs();
  renderAccount();
}

// --- Vérification des adresses sur la carte avant d'envoyer la commande ------------------------
let checkMap = null;
function confirmAddresses(pick, drop, pAddr, dAddr, fromCity, toCity) {
  return new Promise(resolve => {
    const legs = { pick: Object.assign({}, pick), drop: Object.assign({}, drop) };
    const moved = { pick: false, drop: false };
    const renderLegs = () => {
      $("#checkLegs").innerHTML = `<div><b>${UI.esc(t("ckFrom"))}</b> · <bdi>${UI.esc(pAddr)}</bdi>, ${UI.esc(cityLabel(fromCity))} ${moved.pick ? `<small>${UI.esc(t("ckMoved"))}</small>` : ""}</div>
        <div><b>${UI.esc(t("ckTo"))}</b> · <bdi>${UI.esc(dAddr)}</bdi>, ${UI.esc(cityLabel(toCity))} ${moved.drop ? `<small>${UI.esc(t("ckMoved"))}</small>` : ""}</div>`;
    };
    renderLegs();
    const rules = needsRules();
    $("#rulesOkBox").classList.toggle("hidden", !rules);
    $("#rulesOk").checked = false;
    $("#rulesErr").classList.add("hidden");
    $("#checkModal").classList.remove("hidden");
    const hasMap = window.L && legs.pick && legs.drop && legs.pick.lat != null && legs.drop.lat != null;
    $("#checkMap").classList.toggle("hidden", !hasMap);
    if (hasMap) {
      if (!checkMap) {
        checkMap = L.map("checkMap", { zoomControl: true, attributionControl: false });
        UI.mapTiles(checkMap, false);
      }
      checkMap.eachLayer(l => { if (l instanceof L.Marker) checkMap.removeLayer(l); });
      const pin = e => L.divIcon({ className: "", html: `<div class="check-pin">${e}</div>`, iconSize: [30, 30], iconAnchor: [15, 28] });
      [["pick", "📍"], ["drop", "🏁"]].forEach(([k, e]) => {
        const m = L.marker([legs[k].lat, legs[k].lon], { draggable: true, icon: pin(e) }).addTo(checkMap);
        m.on("dragend", () => { const ll = m.getLatLng(); Object.assign(legs[k], { lat: ll.lat, lon: ll.lng, exact: true }); moved[k] = true; renderLegs(); });
      });
      setTimeout(() => {
        checkMap.invalidateSize();
        checkMap.fitBounds([[legs.pick.lat, legs.pick.lon], [legs.drop.lat, legs.drop.lon]], { padding: [40, 40], maxZoom: 17 });
      }, 60);
    }
    const done = ok => { $("#checkModal").classList.add("hidden"); $("#checkOk").onclick = $("#checkBack").onclick = null; resolve(ok ? legs : null); };
    $("#checkOk").onclick = () => {
      if (rules && !$("#rulesOk").checked) { $("#rulesErr").classList.remove("hidden"); return; }
      legs.rulesOk = rules;
      done(true);
    };
    $("#checkBack").onclick = () => done(false);
  });
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
      building: o[pre + "_building"], floor: o[pre + "_floor"], apt: o[pre + "_apt"], code: o[pre + "_code"], note: o[pre + "_note"],
      kind: o[pre + "_kind"]
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
  // Un livreur connecté sur ce téléphone : son espace en un geste depuis l'appli principale
  let rider = false;
  try { rider = !!localStorage.getItem("livraison.session.coursier.v1"); } catch (e) { /* ignore */ }
  $("#navRider").classList.toggle("mine", rider);
  $("#navRider").title = rider ? t("navRiderMine") : t("navRider");
  const p = Store.getProfile();
  const known = isReturning();
  $("#navMine").textContent = known ? t("hello", { name: p.contact_name.split(" ")[0] }) : t("navMe");
  const editing = $("#coordsBox").dataset.editing === "1";
  $("#coordsSummary").classList.toggle("hidden", !known || editing);
  $("#coordsFields").classList.toggle("hidden", known && !editing);
  syncDropMe();
  $("#coordsText").textContent = known ? `${p.contact_name} · ${p.contact_phone}${p.company ? " · " + p.company : ""}` : "";

  // Le carnet d'adresses s'affiche dès la première adresse enregistrée (même avant la première commande)
  const card = $("#accountCard");
  const addrs = Store.getAddresses();
  card.classList.toggle("hidden", !known && !addrs.length);
  if (!known && !addrs.length) return;
  card.innerHTML = `<h3>${UI.esc(t("accTitle"))}</h3>
    ${known ? `<p class="muted small">${UI.esc(t("accSaved"))}</p>
    <p style="margin-top:8px"><b>${UI.esc(p.contact_name)}</b> · <span dir="ltr">${UI.esc(p.contact_phone)}</span>${p.contact_email ? " · " + UI.esc(p.contact_email) : ""}
      · ${UI.esc(t("accOrders", { n: activeOrders().length }))}</p>` : ""}
    <b style="display:block;margin-top:10px">${UI.esc(t("accAddrs"))}</b>
    <div class="acc-add">${["home", "work"].filter(k => !addrs.some(x => x.tag === k)).map(k =>
      `<button type="button" class="addr-chip add" data-add-tag="${k}">＋ ${k === "home" ? "🏠 " + UI.esc(t("tagHome")) : "💼 " + UI.esc(t("tagWork"))}</button>`).join("")}
      <button type="button" class="addr-chip add" data-add-tag="other">＋ ${UI.esc(t("asAddOther"))}</button></div>
    ${addrs.length ? `<ul>${addrs.map((a, i) => state.editAddr === i ? addrEditForm(a, i) : `<li><span>${addrChip(a)}</span>
        <span class="acc-addr-btns"><button type="button" class="btn btn-sm btn-link" data-edit-addr="${i}">${UI.esc(t("accEdit"))}</button>
        <button type="button" class="btn btn-sm btn-link" data-del-addr="${i}">✕ ${UI.esc(t("accDelete"))}</button></span></li>`).join("")}</ul>`
      : `<p class="muted small">${UI.esc(t("accNoAddr"))}</p>`}`;
}
// Modifier une adresse enregistrée : son nom (Maison, Travail, autre) et les détails pour le livreur
function addrEditForm(a, i) {
  const field = (f, k) => `<label class="f"><span>${UI.esc(t(k))}</span><input data-ae="${f}" value="${UI.esc(a[f] || "")}" /></label>`;
  return `<li class="addr-edit"><div>
    <b>${addrIcon(a)} ${UI.esc(addrLabel(a))}</b>
    <div class="save-tags">${[["home", "🏠 " + t("tagHome")], ["work", "💼 " + t("tagWork")], ["other", "⭐ " + t("tagOther")]].map(([k, l]) =>
      `<button type="button" class="btn btn-sm${a.tag === k ? " btn-primary" : ""}" data-edit-tag="${k}">${UI.esc(l)}</button>`).join("")}</div>
    <label class="f ae-name${a.tag === "other" ? "" : " hidden"}"><span>${UI.esc(t("tagNamePh"))}</span><input data-ae="name" maxlength="30" value="${UI.esc(a.tag === "other" ? a.name || "" : "")}" /></label>
    <div class="ae-grid">${field("floor", "floor")}${field("apt", "apt")}${field("code", "entryCode")}</div>
    ${field("note", "addrNote")}
    <p class="muted small">${UI.esc(t("aeStreetHint"))}</p>
    <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary btn-sm" data-ae-save="${i}">${UI.esc(t("ctSave"))}</button>
      <button type="button" class="btn btn-sm btn-link" data-ae-cancel>${UI.esc(t("ctCancel"))}</button></div>
  </div></li>`;
}

function resetPlaces() {
  ["from", "to"].forEach(w => { state.pick[w] = null; if (ac[w]) ac[w].reset(); });
}

// Coordonnées exactes de « rue + numéro » choisis (sinon celles de la rue)
async function exactPoint(p, number, cityName) {
  if (!p) return null;
  if ((p.shopId || p.gps) && p.lat != null) return { lat: p.lat, lon: p.lon, exact: true };
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
  const badPhone = ["contact_phone", form.drop_me.checked ? null : "dropoff_phone", val("service") !== "retrait" ? "pickup_phone" : null]
    .find(k => k && val(k).trim() && !phoneOk(val(k)));
  if (badPhone) { form.elements[badPhone].focus(); return showError(t("errPhone")); }
  const isBrand = w => !!(state.pick[w] && state.pick[w].brand && !needsNo(state.pick[w]));
  const missingNo = [["from", "pickup_number"], ["to", "dropoff_number"]].find(([w, k]) => !isBrand(w) && !val(k).trim());
  if (missingNo) { form.elements[missingNo[1]].focus(); return showError(t("errHouseNo")); }
  const err = scheduleError();
  if (err) return showError(t(err.key, err.vars));
  if (proShopOn() && !val("shop_order").trim() && !cartCount()) { form.shop_order.focus(); return showError(t(catalogOn() ? "errCart" : "errShopOrder", { name: state.shop.name })); }
  if (shopSelf() && !/^[0-9]{3}$/.test(val("shop_ref").trim())) { form.shop_ref.focus(); return showError(t("errShopRef")); }
  if (phoneOn()) {
    if (!val("pickup_name").trim()) { form.pickup_name.focus(); return showError(t("errPhoneName")); }
    if (state.phoneReady == null) { $("#phReadyChips").scrollIntoView({ block: "center" }); return showError(t("errPhoneReady")); }
    if (!form.phone_paid.checked) { form.phone_paid.focus(); return showError(t("errPhonePaid")); }
  }
  if (val("service") === "achat" && !form.goods_self_pay.checked) { form.goods_self_pay.focus(); return showError(t("errGoodsPay")); }
  if (val("service") === "achat" && !form.fits_topcase.checked) { form.fits_topcase.focus(); return showError(t("errTopcase")); }
  // Un mot pour le livreur : seulement s'il manque une précision (un appartement sans étage ni n°)
  const vague = ["pickup", "dropoff"].find(pre => { const w = pre === "pickup" ? "from" : "to";
    return !(state.pick[w] && state.pick[w].brand) && kindOf(pre) === "appartement" && !val(pre + "_floor").trim() && !val(pre + "_apt").trim(); });
  if (vague && val("notes").trim().length < 3) { form.elements[vague + "_apt"].focus(); return showError(t("errNotes")); }
  // Sans contact : le livreur doit pouvoir arriver jusqu'à la porte (type de lieu, code d'entrée, n° d'appartement)
  if (form.leave_at_door.checked) {
    const k = kindOf("dropoff");
    if (!k) { form.querySelector('[data-kind="dropoff"]').scrollIntoView({ block: "center" }); return showError(t("errDoorKind")); }
    if (k !== "maison" && !val("dropoff_code").trim()) { form.dropoff_code.focus(); return showError(t("errDoorCode")); }
    if (k === "appartement" && !val("dropoff_apt").trim()) { form.dropoff_apt.focus(); return showError(t("errDoorCode")); }
  }
  // Colis à récupérer : tout ce qu'il faut au guichet, avant d'envoyer la commande
  if (val("service") === "retrait") {
    const place = val("place_kind"), locker = place === "locker";
    if (!val("tracking_number").trim()) { form.tracking_number.focus(); return showError(t("errTracking")); }
    if (locker ? !val("retrait_code").trim() : !val("parcel_name").trim()) { (locker ? form.retrait_code : form.parcel_name).focus(); return showError(t(locker ? "errRetraitCode" : "errParcelName")); }
    if (place === "poste") {
      const a = new Date(val("appt_at")).getTime();
      if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) { form.appt_at.focus(); return showError(t("errAppt")); }
    }
  }
  // Dépôt à la poste : rendez-vous ; vente entre particuliers : déjà payée au vendeur
  if (val("service") === "colis" && form.post_send.checked) {
    const a = new Date(val("appt_at")).getTime();
    if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) { form.appt_at.focus(); return showError(t("errPostAppt")); }
  }
  if (val("service") === "colis" && form.p2p_sale.checked && !form.sale_paid.checked) { form.sale_paid.focus(); return showError(t("errSaleUnpaid")); }
  // Les photos demandées (colis à récupérer, ordonnance, dépôt à la poste)
  const missDoc = docsMissing();
  if (missDoc) {
    $("#docsBox").scrollIntoView({ block: "center" });
    return showError(t("errDoc", { doc: t(missDoc === "identite" && val("service") === "achat" ? "doc_identite_rx" : "doc_" + missDoc) }));
  }
  if (val("service") === "achat" && adultItems().length) {
    if (!form.adult_ok.checked) { form.adult_ok.focus(); return showError(t("errAdult")); }
    if (form.has_alcohol.checked && alcoholForbiddenAt(pickupDate() || new Date())) return showError(t("errAlcoholHours"));
  }
  const badStop = state.stops.findIndex(s => !stopPoint(s));
  if (badStop >= 0) { $(`#stopsList [data-stop-addr="${badStop}"]`).focus(); return showError(t("errStopPick")); }
  // Zones pas encore ouvertes (ex. Tel Aviv) : « bientôt »
  const closedCity = [fromCity, toCity].find(c => !UI.cityActive(c));
  if (closedCity) return showError(t("errZone", { city: cityLabel(closedCity) }));
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
    // Réduction du client (code promo, fidélité, parrainage) : pas la part payée par le commerce Pro
    const disc = q.lines.find(l => l.discount && l.key !== "qShopShare");
    const svc = val("service");
    const pf = state.pick.from, pt = state.pick.to;
    const pNo = val("pickup_number").trim(), dNo = val("dropoff_number").trim();
    const pAddr = fullAddress(pf, val("pickup_address").trim(), pNo);
    const dAddr = fullAddress(pt, val("dropoff_address").trim(), dNo);
    const [pick0, drop0] = await Promise.all([
      pf ? exactPoint(pf, pNo, UI.cityFr(fromCity)) : locate(pAddr, fromCity, state.fromPoint),
      pt ? exactPoint(pt, dNo, UI.cityFr(toCity)) : locate(dAddr, toCity, state.toPoint)
    ]);
    // Le client vérifie ses adresses sur la carte (et corrige l'épingle s'il le faut)
    // Le nom du restaurant / commerce d'abord : « Smash It · דגניה 47 », pas seulement la rue
    const named = (p, a) => (p && p.brand && !a.includes(p.brand) ? `${p.brand} · ${a}` : a);
    const checked = await confirmAddresses(pick0, drop0, named(pf, pAddr), named(pt, dAddr), fromCity, toCity);
    if (!checked) return;
    const pick = checked.pick, drop = checked.drop;
    const order = {
      lang: I18N.lang,
      service: svc,
      urgency: val("urgency"),
      pickup_at: pickupDate().toISOString(),
      from_city: fromCity,
      pickup_address: pAddr,
      pickup_place: pf ? pf.brand : null,
      pickup_learned: learnIt(pf),
      pickup_kind: svc !== "retrait" ? kindOf("pickup") : null,
      dropoff_kind: kindOf("dropoff"),
      rules_accepted_at: checked.rulesOk ? new Date().toISOString() : null,
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
      has_proxy: svc === "retrait" && val("place_kind") === "poste" && !!docs.procuration,
      retrait_code: svc === "retrait" && val("place_kind") === "locker" ? val("retrait_code").trim() : null,
      appt_at: (svc === "retrait" && val("place_kind") === "poste") || (svc === "colis" && form.post_send.checked) ? new Date(val("appt_at")).toISOString() : null,
      rx: svc === "achat" && form.rx.checked,
      post_send: svc === "colis" && form.post_send.checked,
      p2p_sale: svc === "colis" && form.p2p_sale.checked,
      sale_paid: svc === "colis" && form.p2p_sale.checked && form.sale_paid.checked,
      handoff: svc === "colis" && form.handoff.checked,
      shopping_list: svc === "achat" ? val("shopping_list").trim() || null : null,
      budget: svc === "achat" ? parseFloat(val("budget")) || null : null,
      goods_self_pay: svc === "achat" && form.goods_self_pay.checked,
      fits_topcase: svc === "achat" && form.fits_topcase.checked,
      to_city: toCity,
      dropoff_address: dAddr,
      dropoff_place: pt ? pt.brand : null,
      dropoff_learned: learnIt(pt),
      dropoff_building: val("dropoff_building").trim() || null,
      dropoff_floor: val("dropoff_floor").trim() || null,
      dropoff_apt: val("dropoff_apt").trim() || null,
      dropoff_code: val("dropoff_code").trim() || null,
      leave_at_door: form.leave_at_door.checked,
      prepaid_required: val("urgency") === "programmee",
      dropoff_exact: !!(drop && drop.exact),
      dropoff_note: val("dropoff_note").trim() || null,
      dropoff_lat: drop ? drop.lat : null, dropoff_lon: drop ? drop.lon : null,
      dropoff_contact: (form.drop_me.checked ? val("contact_name") : val("dropoff_contact")).trim() || null,
      dropoff_phone: form.drop_me.checked ? (val("contact_phone").trim() ? formatPhone(val("contact_phone").trim()) : null)
        : val("dropoff_phone").trim() ? formatPhone(val("dropoff_phone").trim()) : null,
      size: val("size"),
      round_trip: form.round_trip.checked,
      extra_stops: state.stops.length,
      stops: state.stops.length ? stopsForOrder() : null,
      adult_items: svc === "achat" && adultItems().length ? adultItems().join(",") : null,
      distance_km: q.distanceKm,
      price: q.total,
      promo_code: disc ? (disc.key === "qLoyalty" ? "FIDELITE" : disc.vars.code) : null,
      discount: disc ? -disc.amount : 0,
      payment_method: val("payment_method"),
      cash_note: val("payment_method") === "cash" ? Number(form.cash_note.value) || 0 : null,
      payer: val("payer"),
      notes: [shopDropOn() && cartCount() ? `🧺 ${t("cgDropNote", { name: state.shop.name })}\n` + cartLines().map(l => `${l.qty} × ${l.p.name}`).join("\n") : "", val("notes").trim()].filter(Boolean).join("\n") || null,
      // Articles du catalogue : la base reprend noms et prix, et écrit la liste à préparer
      shop_order: proShopOn() ? (cartCount() ? cartLines().map(l => `${l.qty} × ${l.p.name}`).join("\n") + (val("shop_order").trim() ? "\n💬 " + val("shop_order").trim() : "") : val("shop_order").trim()) : null,
      items: proShopOn() && cartCount() ? cartLines().map(l => ({ id: l.p.id, qty: l.qty })) : null,
      items_note: proShopOn() && cartCount() ? val("shop_order").trim() || null : null,
      shop_ref: shopSelf() ? val("shop_ref").trim() : null,
      phone_order: phoneOn(),
      pickup_name: phoneOn() ? val("pickup_name").trim() : null,
      phone_ref: phoneOn() ? val("phone_ref").trim() || null : null,
      phone_paid: phoneOn() && form.phone_paid.checked,
      phone_ready_at: phoneOn() ? new Date(Date.now() + state.phoneReady * 60000).toISOString() : null,
      company: val("company").trim() || null,
      contact_name: val("contact_name").trim(),
      contact_phone: formatPhone(val("contact_phone").trim()),
      contact_email: val("contact_email").trim() || null,
      // Départ = le commerce du lien : la course compte pour lui (et pour le livreur qui l'a amené)
      shop_id: state.shop && pf && pf.shopId === state.shop.id ? state.shop.id : null,
      // Course vers le commerce (pressing : on vient chercher les vêtements) : il pourra prévenir le client quand c'est prêt
      drop_shop_id: state.shop && pt && pt.shopId === state.shop.id ? state.shop.id : null,
      // Clé du commerce, seulement pour payer avec son carnet (la base la vérifie puis l'efface)
      shop_token: val("payment_method") === "carnet" && carnetOk() ? state.pro.token : null
    };
    if (!order.shop_token) delete order.shop_token;
    const firstOrder = activeOrders().length === 0;
    const saved = await Store.createOrder(order);
    // Les photos des documents partent juste après la commande (le patron les vérifie avant d'envoyer un livreur)
    let docsFailed = false;
    if (Store.docsFor(saved).length) {
      $("#submitBtn").textContent = t("docsSending");
      for (const k of Store.docsFor(saved)) {
        if (!docs[k]) continue;
        try { if (!(await Store.addOrderDoc(saved.token, k, docs[k]))) docsFailed = true; } catch (e) { docsFailed = true; }
      }
      Object.keys(docs).forEach(k => delete docs[k]);
      docsKey = "";
      renderDocs();
    }
    clearDraft();
    rememberAddresses(saved, pf, pt);
    // Paiement direct : le client paiera son livreur (Bit ou PayBox) dès qu'il accepte ; avant : Bit à HOP tout de suite
    $("#donePrepay").innerHTML = saved.payment_method === "bit"
      ? (saved.prepaid_required && !saved.direct_pay ? `<p class="promo-msg bad">${UI.esc(t("trPrepay"))}</p>` : "") + UI.bitPay(saved)
      : UI.esc(t("donePrepay", { total: money(saved.price), phone: CONFIG.bitPhone, ref: saved.ref }));
    $("#donePrepay").classList.toggle("hidden", saved.payment_method === "carnet" || (saved.payment_method !== "bit" && !saved.prepaid_required));
    if (saved.payment_method === "carnet" && state.pro) state.pro.credits--;
    confetti();
    hopBurst(t("hopSent"));
    // Pas encore de compte : un mot de passe et c'est fait (nom et téléphone viennent de la commande)
    const da = $("#doneAccount");
    if (Store.ONLINE && !Store.clientAccount()) {
      da.innerHTML = `<b>${UI.esc(t("lgDoneTitle"))}</b><p class="small" style="margin:4px 0 8px">${UI.esc(t("lgDoneSub"))}</p>
        <form class="lg-quick" id="doneAccForm"><input type="password" name="pw" minlength="6" autocomplete="new-password" placeholder="${UI.esc(t("lgPass"))}" required />
        <button class="btn btn-primary btn-sm">${UI.esc(t("lgGoCreate"))}</button></form><p class="small lg-msg" id="doneAccMsg"></p>`;
      da.classList.remove("hidden");
    } else {
      da.textContent = t("doneAccount");
      da.classList.toggle("hidden", !firstOrder || !!Store.clientAccount());
    }
    Store.saveProfile({ company: order.company, contact_name: order.contact_name, contact_phone: order.contact_phone, contact_email: order.contact_email });

    $("#doneText").innerHTML = UI.esc(t("doneText", { ref: saved.ref, total: money(saved.price) }));
    $("#doneSub").textContent = t(Store.ONLINE ? "doneOnline" : "doneDemo") + (Store.docsFor(saved).length ? " " + t(docsFailed ? "errDocsUpload" : "doneDocs") : "") + (saved.handoff ? " " + t("doneHandoff") : "");
    $("#doneWa").href = UI.waLink(CONFIG.whatsapp, UI.orderText(saved));
    $("#doneWa").classList.toggle("hidden", Store.ONLINE);
    $("#doneTrack").href = UI.trackUrl(saved);
    const shareMsg = I18N.forLang(saved.lang, "trShareMsg", { url: UI.trackUrl(saved) });
    $("#doneShare").href = saved.dropoff_phone ? UI.waLink(saved.dropoff_phone, shareMsg) : UI.waShare(shareMsg);
    $("#doneModal").classList.remove("hidden");
    ["notes", "shop_order", "shop_ref", "pickup_name", "phone_ref", "tracking_number", "parcel_name", "retrait_code", "appt_at", "shopping_list", "budget", "promo", "pickup_address", "pickup_number", "pickup_note", "pickup_building", "pickup_floor", "pickup_apt", "pickup_code", "dropoff_address", "dropoff_number", "dropoff_note", "dropoff_building", "dropoff_floor", "dropoff_apt", "dropoff_code", "dropoff_contact", "dropoff_phone"]
      .forEach(k => { form.elements[k].value = ""; });
    form.drop_me.checked = true; syncDropMe();
    setKind("pickup", null); setKind("dropoff", null);
    state.stops = []; renderStops();
    state.promo = null;
    $("#promoMsg").textContent = "";
    resetPlaces();
    applyShop();
    form.leave_at_door.checked = false;
    form.phone_order.checked = false; form.phone_paid.checked = false; form.goods_self_pay.checked = false; form.fits_topcase.checked = false;
    ["rx", "post_send", "p2p_sale", "sale_paid", "handoff"].forEach(k => { form.elements[k].checked = false; }); state.phoneReady = null;
    state.cart = {}; renderCatalog();
    $("#coordsBox").dataset.editing = "";
    renderSavedAddrs();
    await loadMine();
  } catch (ex) {
    if (/welcome_used/.test(ex.message)) { state.welcomeUsed = true; refuseWelcome(); return; }
    if (/carnet_/.test(ex.message)) { if (state.pro) state.pro.credits = 0; syncVisibility(); return showError(t("errCarnet")); }
    if (/cash_max/.test(ex.message)) return showError(t("errCashMax", { max: money(cashMax()) }));
    if (/cash_first/.test(ex.message)) return showError(t("errCashFirst"));
    if (/cash_note_small/.test(ex.message)) return showError(t("errCashNote"));
    if (/client_blocked/.test(ex.message)) return showError(t("errBlocked"));
    if (/alcohol_hours/.test(ex.message)) return showError(t("errAlcoholHours"));
    if (/phone_name_required/.test(ex.message)) return showError(t("errPhoneName"));
    if (/phone_unpaid/.test(ex.message)) return showError(t("errPhonePaid"));
    if (/goods_pay_required/.test(ex.message)) return showError(t("errGoodsPay"));
    if (/topcase_required/.test(ex.message)) return showError(t("errTopcase"));
    if (/door_kind/.test(ex.message)) return showError(t("errDoorKind"));
    if (/door_code/.test(ex.message)) return showError(t("errDoorCode"));
    if (/retrait_tracking/.test(ex.message)) return showError(t("errTracking"));
    if (/retrait_name/.test(ex.message)) return showError(t("errParcelName"));
    if (/retrait_code/.test(ex.message)) return showError(t("errRetraitCode"));
    if (/retrait_appt/.test(ex.message)) return showError(t("errAppt"));
    if (/post_appt/.test(ex.message)) return showError(t("errPostAppt"));
    if (/sale_unpaid/.test(ex.message)) return showError(t("errSaleUnpaid"));
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
  renderLogin();
  loadNotices();
}

// --- « C'est prêt » : un commerce prévient son client par HOP (vêtements prêts au pressing…) ----------
state.notices = [];
const noticeShown = new Set();
async function loadNotices() {
  const tokens = (state.mine || []).map(o => o.token).filter(Boolean);
  try { state.notices = (await Store.clientNotices(tokens)) || []; } catch (e) { return; }
  renderNotices();
}
const noticeWhen = n => (n.ready_from && new Date(n.ready_from) > Date.now()
  ? t("ntFrom", { when: UI.fmtDateTime(n.ready_from) }) : t("ntNow"));
function noticeCard(n) {
  return `<div class="notice-card${n.seen_at ? "" : " new"}">
    <span class="nt-ico">${UI.KIND_ICON[n.shop_kind] || "🏪"}</span>
    <div class="nt-txt"><b>${UI.esc(t("ntTitle", { name: n.shop_name }))}</b>
      ${n.message ? `<p>« ${UI.esc(n.message)} »</p>` : ""}<small>🕘 ${UI.esc(noticeWhen(n))}</small></div>
    <div class="nt-btns"><button type="button" class="btn btn-primary btn-sm" data-nt-book="${UI.esc(n.id)}">${UI.esc(t("ntBook"))}</button>
      ${n.seen_at ? "" : `<button type="button" class="btn btn-link btn-sm" data-nt-later="${UI.esc(n.id)}">${UI.esc(t("ntLater"))}</button>`}</div>
  </div>`;
}
function renderNotices() {
  // Sur l'accueil : les avis pas encore traités (7 jours), le plus récent en premier
  const list = state.notices.filter(n => !n.done && Date.now() - new Date(n.created_at) < 7 * 86400000);
  const box = $("#homeNotices"), html = list.slice(0, 3).map(noticeCard).join("");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  // Un nouvel avis : une fenêtre qui ne passe pas inaperçue (une seule fois)
  const fresh = list.find(n => !n.seen_at && !noticeShown.has(n.id));
  if (fresh && $("#noticeModal").classList.contains("hidden")) {
    noticeShown.add(fresh.id);
    $("#noticeBody").innerHTML = noticeCard(fresh);
    $("#noticeModal").classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
}
const noticeOf = id => state.notices.find(n => n.id === id);
function noticeSeen(n) { if (!n.seen_at) { n.seen_at = new Date().toISOString(); Store.clientNoticeSeen(n.token, n.id).catch(() => {}); } }
// « Programmer mon Hoper » : départ du commerce, arrivée chez le client (l'adresse de la course d'avant), à l'heure où c'est prêt
async function bookNotice(n) {
  noticeSeen(n); n.done = true;
  $("#noticeModal").classList.add("hidden");
  state.shopDir = "from";
  await loadShop(n.shop_code, true);
  if (n.addr) {
    const m = String(n.addr).match(/^(.*?)\s+(\d+[a-zA-Zא-ת]?)$/);
    const cityId = CONFIG.cities.some(c => c.id === n.city) ? n.city : null;
    applySavedAddr("to", { street: m ? m[1] : n.addr, number: m ? m[2] : "", cityId, city: n.city, lat: n.lat, lon: n.lon, exact: n.lat != null });
  }
  let at = n.ready_from && new Date(n.ready_from);
  // Prêt un jour où le commerce est fermé (chabbat…) : à sa prochaine ouverture
  if (at && state.shop) { const st = UI.openState(state.shop.hours, at), o = UI.nextOpenDate(st, at); if (o) at = new Date(o.getTime() + 15 * 60000); }
  if (at && at - Date.now() > 20 * 60000) {
    const d = new Date(Math.ceil(at.getTime() / 900000) * 900000);
    form.elements.urgency.value = "programmee";
    form.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    form.time.value = hhmm(d);
  } else form.elements.urgency.value = "asap";
  syncVisibility();
  renderQuote();
  renderNotices();
  $("#commander").scrollIntoView({ behavior: "smooth" });
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-nt-book], [data-nt-later], #noticeClose");
  if (!b) return;
  if (b.id === "noticeClose") { $("#noticeModal").classList.add("hidden"); return; }
  const n = noticeOf(b.dataset.ntBook || b.dataset.ntLater);
  if (!n) return;
  if (b.dataset.ntBook) return bookNotice(n);
  noticeSeen(n);
  $("#noticeModal").classList.add("hidden");
  renderNotices();
});
setInterval(() => { if (!document.hidden) loadNotices(); }, 60000);

// --- Compte client : téléphone + mot de passe, accepté tout de suite (sans e-mail de confirmation pour l'instant) ---
const loginUi = { mode: "create" };
const ACC_ERR = { phone_exists: "lgErrExists", bad_login: "lgErrBad", locked: "lgErrLocked", weak_password: "lgErrWeak",
  bad_phone: "lgErrPhone", bad_email: "lgErrEmail", name_required: "lgErrName", demo: "lgDemo" };
const accErr = ex => t(ACC_ERR[Object.keys(ACC_ERR).find(k => String(ex && ex.message).includes(k))] || "lgErrNet");
function renderLogin() {
  const box = $("#loginCard"), acct = Store.clientAccount();
  if (!Store.ONLINE) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const c = acct && acct.client || {};
  const key = (acct ? "on:" + [c.id, c.name, c.phone, c.email, c.blocked].join("|") : "off:" + loginUi.mode) + ":" + I18N.lang;
  if (box.dataset.key === key) return;   // ne pas effacer ce qui est en train d'être tapé
  box.dataset.key = key;
  if (acct) {
    box.innerHTML = `<div class="lg-on"><div><h3>${UI.esc(t("lgOn", { name: c.name || "" }))}</h3>
        <p class="muted small">${UI.esc(t("lgOnSub"))}</p>
        <p class="small" style="margin-top:4px"><span dir="ltr">${UI.esc(c.phone || "")}</span>${c.email ? " · " + UI.esc(c.email) : ""}</p></div>
      <button type="button" class="btn btn-sm" id="lgOut">${UI.esc(t("lgOut"))}</button></div>
      ${c.blocked ? `<p class="notice warn" style="margin-top:8px">${UI.esc(t("lgBlocked"))}</p>` : ""}`;
    return;
  }
  const p = Store.getProfile(), create = loginUi.mode === "create";
  const f = (name, label, attrs, val) => `<label class="f"><span>${UI.esc(t(label))}</span><input name="${name}" ${attrs} value="${UI.esc(val || "")}" /></label>`;
  box.innerHTML = `<h3>${UI.esc(t("lgTitle"))}</h3>
    <p class="muted small">${UI.esc(t("lgSub"))}</p>
    <div class="lg-tabs"><button type="button" class="ch-chip${create ? " on" : ""}" data-lg-mode="create">${UI.esc(t("lgCreate"))}</button>
      <button type="button" class="ch-chip${create ? "" : " on"}" data-lg-mode="login">${UI.esc(t("lgLogin"))}</button></div>
    <form id="lgForm" class="lg-form" novalidate>
      ${create ? f("lg_name", "lgName", 'autocomplete="name" maxlength="80"', p.contact_name) : ""}
      ${f("lg_phone", "lgPhone", 'type="tel" inputmode="tel" autocomplete="tel" dir="ltr"', p.contact_phone)}
      ${f("lg_pass", "lgPass", `type="password" minlength="6" autocomplete="${create ? "new-password" : "current-password"}"`, "")}
      ${create ? f("lg_email", "lgEmail", 'type="email" autocomplete="email" dir="ltr"', p.contact_email) : ""}
      <button class="btn btn-primary">${UI.esc(t(create ? "lgGoCreate" : "lgGoLogin"))}</button>
      <p class="small lg-msg" id="lgMsg"></p>
      ${create ? "" : `<p class="muted small">${UI.esc(t("lgForgot"))}</p>`}
    </form>`;
}
async function accountSubmit(fn, msgEl, btn) {
  msgEl.textContent = ""; msgEl.classList.remove("err");
  btn.disabled = true;
  try { await fn(); return true; }
  catch (ex) { msgEl.textContent = accErr(ex); msgEl.classList.add("err"); return false; }
  finally { btn.disabled = false; }
}
$("#loginCard").addEventListener("click", async e => {
  const m = e.target.closest("[data-lg-mode]");
  if (m) { loginUi.mode = m.dataset.lgMode; return renderLogin(); }
  if (e.target.closest("#lgOut")) {
    await Store.clientLogout();
    loginUi.mode = "login";
    return loadMine();
  }
});
$("#loginCard").addEventListener("submit", async e => {
  if (e.target.id !== "lgForm") return;
  e.preventDefault();
  const fm = e.target, v = n => (fm[n] ? fm[n].value.trim() : "");
  const ok = await accountSubmit(() => loginUi.mode === "create"
      ? Store.clientRegister(v("lg_name"), v("lg_phone"), v("lg_email"), fm.lg_pass.value)
      : Store.clientLogin(v("lg_phone"), fm.lg_pass.value), $("#lgMsg"), fm.querySelector("button.btn-primary"));
  if (!ok) return;
  // Ses coordonnées et ses adresses arrivent du compte : la commande est déjà remplie
  const p = Store.getProfile();
  ["contact_name", "contact_phone", "contact_email"].forEach(k => { if (p[k] && !form[k].value) form[k].value = p[k]; });
  renderSavedAddrs();
  await loadMine();
});
$("#doneAccount").addEventListener("submit", async e => {
  if (e.target.id !== "doneAccForm") return;
  e.preventDefault();
  const p = Store.getProfile(), fm = e.target;
  const ok = await accountSubmit(() => Store.clientRegister(p.contact_name, p.contact_phone, p.contact_email, fm.pw.value), $("#doneAccMsg"), fm.querySelector("button"));
  if (ok) { $("#doneAccount").textContent = t("lgDoneOk"); loadMine(); }
});

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
  // Annulées : plus affichées ; refusées : 2 h, le temps de lire la raison et de recommander
  const list = state.mine.filter(shownInMine).sort((a, b) => new Date(b.created_at || b.pickup_at) - new Date(a.created_at || a.pickup_at));
  if (!list.length) { box.innerHTML = `<div class="empty card">${t("mineEmpty")} <a href="#commander">${t("mineFirst")}</a></div>`; return; }
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
          ${o.status === "livree" && o.rating == null && Date.now() - new Date(o.pickup_at) < 7 * 86400000 ? `<a class="btn btn-sm btn-primary" href="${UI.trackUrl(o)}">${UI.esc(t("rtCta"))}</a>` : ""}
          ${o.rating != null ? `<span class="pill paid">${"⭐".repeat(o.rating)}</span>` : ""}
          ${UI.receiptNo(o) ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}">${t("receiptLink")}</a>` : ""}
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
function shownInMine(o) {
  if (o.status === "annulee") return false;
  return o.status !== "refusee" || Date.now() - new Date(o.updated_at || o.created_at || o.pickup_at) < 2 * 3600000;
}
const chatOrders = () => state.mine.filter(shownInMine).filter(o => !["annulee"].includes(o.status)
  && (["nouvelle", "confirmee", "recuperee"].includes(o.status) || Date.now() - new Date(o.pickup_at) < 2 * 86400000));
function openChatMenu() {
  const list = chatOrders();
  if (!list.length) return openSupport();
  Chat.choose(t("chWho"), [
    ...list.map(o => ({ label: t("chMyOrder", { ref: o.ref }), badge: chatUnread["o:" + o.id], onClick: () => openOrderChat(o) })),
    { label: "💬 " + t("chSupport"), badge: chatUnread["u:" + Store.deviceId()], onClick: () => openSupport() }
  ]);
}
// --- Bulle ronde de la course en cours : temps restant avant la livraison -----------------------
// La bulle se retrouve aussi en haut du panneau de l'accueil (sans rien cacher)
function mirrorEtaBubble() {
  const el = $("#etaBubble"), card = $("#homeEta");
  card.classList.toggle("hidden", el.classList.contains("hidden"));
  card.href = el.getAttribute("href") || "#";
  // (le dégradé du rond a son propre nom dans la copie : la bulle d'origine peut être cachée)
  card.innerHTML = el.innerHTML.replace(/ id="(?!hrg-)[^"]*"/g, "").replace(/hrg-eb/g, "hrg-home");
}
async function renderEtaBubble() {
  await renderEtaBubbleInner();
  mirrorEtaBubble();
}
async function renderEtaBubbleInner() {
  const live = state.mine.filter(o => ["nouvelle", "confirmee", "recuperee"].includes(o.status))
    .sort((a, b) => ["recuperee", "confirmee", "nouvelle"].indexOf(a.status) - ["recuperee", "confirmee", "nouvelle"].indexOf(b.status))[0];
  const el = $("#etaBubble");
  const toRate = !live && state.mine.filter(o => o.status === "livree" && o.rating == null && Date.now() - new Date(o.pickup_at) < 6 * 3600000)
    .sort((a, b) => new Date(b.pickup_at) - new Date(a.pickup_at))[0];
  el.classList.toggle("hidden", !live && !toRate);
  document.body.classList.toggle("has-eta", !!(live || toRate));
  if (toRate) {
    el.href = UI.trackUrl(toRate);
    $("#ebMin").textContent = "⭐"; $("#ebMin").classList.remove("long");
    $("#ebUnit").textContent = "";
    $("#ebTitle").textContent = t("rtCta");
    $("#ebSub").textContent = t("orderNo", { ref: toRate.ref });
    $("#ebSvg").innerHTML = UI.ringSvg(1, "hrg-eb");
    return;
  }
  if (!live) return;
  let o = live;
  try { o = (await Store.trackOrder(live.token)) || live; } catch (e) { /* on garde la course connue */ }
  const r = UI.etaRange(o);
  el.href = UI.trackUrl(o);
  $("#ebMin").textContent = r ? r.text : o.status === "nouvelle" ? "⏳" : "🛵";
  $("#ebMin").classList.toggle("long", !!r && r.text.length > 4);
  $("#ebUnit").textContent = r ? "min" : "";
  $("#ebTitle").innerHTML = `<span class="eb-scoot">🛵</span> ${UI.esc(t(o.status === "nouvelle" ? "trWaiting" : o.status === "confirmee" ? "trStep2" : "trStep3"))}`;
  $("#ebSub").textContent = t("orderNo", { ref: o.ref });
  $("#ebSvg").innerHTML = UI.ringSvg(UI.PROGRESS[o.status] || 0, "hrg-eb");
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
  renderEtaBubble();
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
  renderLogin();
  viewTitle();
  renderShopBanner();
  renderHomeStatic();
  renderShowcase();
  syncHome();
  renderLive();
}

async function loadSettings() {
  try { state.settings = await Store.getSettings(); } catch (e) { /* on garde « disponible » */ }
  renderStatic();
  renderQuote();
}

// --- Catalogue du commerce HOP! Pro : le client choisit ses articles (payés directement au commerce) ---
state.catalog = null; state.cart = {};
const cgProducts = () => (state.catalog && state.catalog.products) || [];
const cartLines = () => cgProducts().filter(p => p.available && state.cart[p.id] > 0).map(p => ({ p, qty: state.cart[p.id] }));
const cartCount = () => cartLines().reduce((s, l) => s + l.qty, 0);
const cartTotal = () => cartLines().reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
const shopDropOn = () => !!(state.shop && state.shop.pro && state.pick.to && state.pick.to.shopId === state.shop.id);
const catalogOn = () => (proShopOn() || shopDropOn()) && cgProducts().length > 0;
async function loadCatalogFor(shop) {
  state.catalog = null; state.cart = {};
  if (!shop || !shop.pro) return renderCatalog();
  try { state.catalog = await Store.shopCatalog(shop.code); } catch (e) { state.catalog = null; }
  renderCatalog();
  renderQuote();
}
function renderCatalog() {
  const box = $("#catalogBox"), on = catalogOn();
  box.classList.toggle("hidden", !on);
  $("#shopOrderBox").classList.toggle("with-cg", on);
  document.body.classList.toggle("cg-cart-on", on && cartCount() > 0);
  form.shop_order.placeholder = on ? t("cgNotePh") : t("spOrderPh");
  if (state.shop && proShopOn()) $("#shopOrderLabel").textContent = on ? t("cgNoteLabel", { name: state.shop.name }) : t("spOrderLabel", { name: state.shop.name });
  if (!on) { box.innerHTML = ""; box.dataset.html = ""; return; }
  const cats = state.catalog.categories.filter(c => cgProducts().some(p => p.category_id === c.id));
  const hasLoose = cgProducts().some(p => !cats.some(c => c.id === p.category_id));
  // Le menu entier par rubriques ; les onglets mènent à leur rubrique et suivent le défilement
  const sections = cats.map(c => ({ id: c.id, title: c.name, items: cgProducts().filter(p => p.category_id === c.id) }))
    .concat(hasLoose ? [{ id: "_", title: cats.length ? t("cgOther") : "", items: cgProducts().filter(p => !cats.some(c => c.id === p.category_id)) }] : []);
  const n = cartCount();
  // Façon appli de livraison : onglets collants, lignes d'articles avec grande image, panier flottant en bas
  // Les incontournables : les premiers articles du menu, en grandes cartes qui défilent
  const pic = p => (UI.safeImg(p.photo) ? `<img src="${UI.safeImg(p.photo)}" alt="" loading="lazy" />` : UI.itemArt(p.name, state.shop.kind));
  const top = cgProducts().filter(p => p.available).slice(0, 8);
  const html = `<b class="cg-title">${UI.esc(t("cgTitle", { name: state.shop.name }))}</b>
    ${cgProducts().length >= 5 ? `<div class="cg-top"><h4 class="cg-sec">${UI.esc(t("cgTop"))}</h4><div class="cg-top-row">${top.map(p => { const q = state.cart[p.id] || 0;
      return `<div class="cg-tcard${q ? " in" : ""}" data-cg-open="${UI.esc(p.id)}"><div class="cg-tpic">${pic(p)}
        <button type="button" class="cg-plus" data-cg-plus="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">${q ? `<b>${q}</b>` : "+"}</button></div>
        <span class="cg-price">${UI.money(p.price)}</span><b><bdi>${UI.esc(p.name)}</bdi></b></div>`; }).join("")}</div></div>` : ""}
    ${cats.length > 1 ? `<div class="cg-cats" role="tablist">${sections.filter(x => x.title).map(x =>
      `<button type="button" class="cg-tab" data-cg-cat="${UI.esc(x.id)}">${UI.esc(x.title)}</button>`).join("")}</div>` : ""}
    ${sections.map(sec => `${sec.title ? `<h4 class="cg-sec" data-cg-sec="${UI.esc(sec.id)}">${UI.esc(sec.title)}</h4>` : ""}<div class="cg-grid">${sec.items.map(p => {
      const q = state.cart[p.id] || 0, photo = UI.safeImg(p.photo);
      return `<div class="cg-item${p.available ? "" : " off"}${q ? " in" : ""}" data-cg-open="${UI.esc(p.id)}">
        <div class="cg-info"><b>${q ? `<em class="cg-n"><bdi>${q}×</bdi></em> ` : ""}<bdi>${UI.esc(p.name)}</bdi></b>${p.description ? `<small>${UI.esc(p.description)}</small>` : ""}<span class="cg-price">${UI.money(p.price)}</span></div>
        <div class="cg-pic">${photo ? `<img src="${photo}" alt="" loading="lazy" />` : UI.itemArt(p.name, state.shop.kind)}
        ${!p.available ? `<span class="cg-out">${UI.esc(t("cgOut"))}</span>`
          : q ? `<span class="cg-qty"><button type="button" data-cg-minus="${UI.esc(p.id)}" aria-label="−">−</button><b>${q}</b><button type="button" data-cg-plus="${UI.esc(p.id)}" aria-label="+">+</button></span>`
          : `<button type="button" class="cg-plus" data-cg-plus="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">+</button>`}</div>
      </div>`;
    }).join("")}</div>`).join("")}
    <p class="cg-pay">${UI.esc(t("cgPayShop", { name: state.shop.name }))}</p>
    ${n ? `<button type="button" class="cg-cart" data-cg-go><span class="cg-cart-n">${n}</span><b>${UI.esc(t("cgSee"))}</b><span>${UI.esc(money(cartTotal()))}</span></button>`
      : `<p class="cg-empty">${UI.esc(t("cgEmpty"))}</p>`}`;
  // Redessiné seulement si quelque chose a changé (un toucher n'est jamais perdu)
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  // Les onglets restent collés juste sous la barre du haut (« ‹ Accueil · Ma commande »)
  const bar = ["#viewBar", ".topbar"].map(q => document.querySelector(q)).find(el => el && el.offsetHeight);
  if (bar) box.style.setProperty("--cg-top", (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight - 1 + "px");
  syncCgTabs();
}
// Onglet allumé = la rubrique en cours de lecture
const cgEdge = () => { const tabs = $("#catalogBox .cg-cats"); return tabs ? (parseFloat(getComputedStyle(tabs).top) || 0) + tabs.offsetHeight + 12 : 0; };
function syncCgTabs() {
  const tabs = $("#catalogBox .cg-cats");
  if (!tabs) return;
  const secs = [...$("#catalogBox").querySelectorAll("[data-cg-sec]")], edge = cgEdge();
  const cur = secs.filter(h => h.getBoundingClientRect().top <= edge + 40).pop() || secs[0];
  tabs.querySelectorAll(".cg-tab").forEach(b => {
    const on = !!cur && b.dataset.cgCat === cur.dataset.cgSec;
    if (on && !b.classList.contains("on")) {
      const r = b.getBoundingClientRect(), tr = tabs.getBoundingClientRect();
      if (r.left < tr.left) tabs.scrollLeft += r.left - tr.left - 12; else if (r.right > tr.right) tabs.scrollLeft += r.right - tr.right + 12;
    }
    b.classList.toggle("on", on);
  });
}
let cgTick = 0;
addEventListener("scroll", () => { if (!cgTick) cgTick = requestAnimationFrame(() => { cgTick = 0; syncCgTabs(); }); }, { passive: true });
$("#catalogBox").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) { const card = e.target.closest("[data-cg-open]"); if (card) openItem(card.dataset.cgOpen); return; }
  // Panier : on passe à la suite (adresse de livraison, ou le récapitulatif si tout est rempli)
  if (b.dataset.cgGo != null) {
    const next = stepStates().slice(1).find(([fs, ok]) => fs && !ok && fs !== $("#shopOrderBox") && fs.offsetParent);
    return (next ? next[0] : $("#summary")).scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (b.dataset.cgCat != null) {
    const h = $("#catalogBox").querySelector(`[data-cg-sec="${CSS.escape(b.dataset.cgCat)}"]`);
    if (h) scrollTo({ top: scrollY + h.getBoundingClientRect().top - cgEdge() + 4, behavior: "smooth" });
    return;
  }
  if (b.dataset.cgPlus) state.cart[b.dataset.cgPlus] = Math.min(50, (state.cart[b.dataset.cgPlus] || 0) + 1);
  else if (b.dataset.cgMinus) state.cart[b.dataset.cgMinus] = Math.max(0, (state.cart[b.dataset.cgMinus] || 0) - 1);
  else return;
  renderCatalog();
  renderQuote();
  saveDraft();
});

// Fiche d'un article : grande image, description, prix, quantité, « Ajouter · total »
const item = { id: null, qty: 1 };
function openItem(id) {
  const p = cgProducts().find(x => x.id === id);
  if (!p) return;
  item.id = id; item.qty = Math.max(1, state.cart[id] || 1);
  renderItem();
  $("#itemSheet").classList.remove("hidden");
}
function renderItem() {
  const p = cgProducts().find(x => x.id === item.id);
  if (!p) return;
  const inCart = state.cart[p.id] || 0, photo = UI.safeImg(p.photo);
  $("#itemBody").innerHTML = `<div class="it-pic">${photo ? `<img src="${photo}" alt="" />` : UI.itemArt(p.name, state.shop.kind)}</div>
    <div class="it-txt"><h3><bdi>${UI.esc(p.name)}</bdi></h3><span class="cg-price">${UI.money(p.price)}</span>
      ${p.description ? `<p>${UI.esc(p.description)}</p>` : ""}
      ${p.available ? "" : `<p class="it-out">${UI.esc(t("cgOut"))}</p>`}</div>`;
  $("#itemQty").textContent = item.qty;
  $("#itemAdd").disabled = !p.available;
  $("#itemAdd").innerHTML = `<span>${UI.esc(t(inCart ? "itUpdate" : "itAdd"))}</span><b>${UI.esc(money(Number(p.price) * item.qty))}</b>`;
  $("#itemDel").classList.toggle("hidden", !inCart);
}
$("#itemSheet").addEventListener("click", e => {
  if (e.target.id === "itemSheet" || e.target.closest("#itemClose")) return $("#itemSheet").classList.add("hidden");
  if (e.target.closest("#itemMinus")) { item.qty = Math.max(1, item.qty - 1); return renderItem(); }
  if (e.target.closest("#itemPlus")) { item.qty = Math.min(50, item.qty + 1); return renderItem(); }
  const add = e.target.closest("#itemAdd"), del = e.target.closest("#itemDel");
  if (!add && !del) return;
  state.cart[item.id] = add ? item.qty : 0;
  $("#itemSheet").classList.add("hidden");
  renderCatalog(); renderQuote(); saveDraft();
});

// --- Commerce partenaire (lien index.html?c=CODE) : départ rempli depuis le commerce ----------
// HOP! Pro : le départ est un commerce abonné → le client écrit sa commande, le commerce la prépare
const shopPicked = () => !!(state.shop && state.pick.from && state.pick.from.shopId === state.shop.id);
const proShopOn = () => shopPicked() && !!state.shop.pro && val("payment_method") !== "carnet";
// Fiche du commerce : présentation, adresse, horaires (ouvert / fermé maintenant), WhatsApp pour le joindre
const DAYS = { fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] };
// « Ouvert · ferme à 19:00 » / « Fermé · ouvre demain à 08:30 » / « Fermé · ouvre lundi à 08:30 »
function openLabel(st) {
  if (!st) return "";
  if (st.open) return t("stOpenUntil", { time: UI.hhmmOf(st.until) });
  if (st.inDays == null) return t("shClosed");
  const time = UI.hhmmOf(st.at);
  return st.inDays === 0 ? t("stOpensAt", { time }) : st.inDays === 1 ? t("stOpensTomorrow", { time })
    : t("stOpensDay", { day: (DAYS[I18N.lang] || DAYS.fr)[st.day].toLowerCase(), time });
}
function shopOpenNow(hours) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const today = (hours || []).find(x => Number(x.d) === now.getDay());
  const m = now.getHours() * 60 + now.getMinutes(), mins = v => { const [h, mm] = v.split(":").map(Number); return h * 60 + (mm || 0); };
  return !!(today && today.h && String(today.h).split(",").some(r => { const [a, b] = r.split("-"); return a && b && m >= mins(a) && m < mins(b); }));
}
function shopInfo(s) {
  if (!s || !(s.whatsapp || s.about || (s.hours && s.hours.length))) return "";
  const days = DAYS[I18N.lang] || DAYS.fr, today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();
  const fmt = h => (h ? String(h).split(",").map(r => r.replace("-", "–")).join(" · ") : t("shClosed"));
  const hours = (s.hours || []).slice().sort((a, b) => a.d - b.d);
  const open = hours.length && shopOpenNow(hours);
  const wa = String(s.whatsapp || "").replace(/\D/g, "");
  const waText = encodeURIComponent(t("shWaHello", { name: s.name }));
  return `<div class="sh-info">
    ${s.about ? `<p class="sh-about">${UI.esc(s.about)}</p>` : ""}
    <div class="sh-lines">
      ${s.address ? `<div class="sh-line"><span>📍</span><b><bdi>${UI.esc(s.address)}</bdi>${s.city ? ", " + UI.esc(cityLabel(cityIdOf(s.city, s) || s.city)) : ""}</b></div>` : ""}
      ${hours.length ? `<div class="sh-line"><span>🕘</span><b class="sh-open ${open ? "on" : "off"}">${UI.esc(openLabel(UI.openState(hours)) || t(open ? "shOpenNow" : "shClosedNow"))}</b>
        <small>${UI.esc(t("shToday"))} : ${UI.esc(fmt((hours.find(x => Number(x.d) === today) || {}).h))}</small></div>` : ""}
    </div>
    ${wa ? `<a class="sh-wa" href="https://wa.me/${UI.esc(wa)}?text=${waText}" target="_blank" rel="noopener">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8C29 8.7 23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.2 16 5.2S26.9 10 26.9 15.8 22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a9 9 0 0 1-2.6-1.6 9.8 9.8 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.6 4.9c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>
        <span><b>${UI.esc(t("shWa"))}</b><small>${UI.esc(t("shWaSub", { name: s.name }))}</small></span></a>` : ""}
    ${hours.length ? `<details class="sh-hours"><summary>${UI.esc(t("shAllHours"))}</summary><table>${hours.map(x =>
      `<tr class="${Number(x.d) === today ? "today" : ""}"><th>${UI.esc(days[x.d])}</th><td>${UI.esc(fmt(x.h))}</td></tr>`).join("")}</table></details>` : ""}
  </div>`;
}
// Le commerce est-il dans la course (au départ ou à l'arrivée) ?
const shopSide = () => (shopPicked() ? "from" : state.shop && state.pick.to && state.pick.to.shopId === state.shop.id ? "to" : "");
const shopMode = () => (state.shop && state.shop.pro ? shopSide() : "");
function renderShopBanner() {
  const side = shopSide(), on = !!side;
  $("#shopBanner").classList.toggle("hidden", !on);
  // Commerce HOP! Pro : sa vitrine en haut de la commande (photo, logo, accroche), comme dans les applis de livraison
  const s = state.shop, hero = $("#shopHero"), showHero = !!(on && s && (s.pro || s.logo || s.cover));
  hero.classList.toggle("hidden", !showHero);
  if (showHero) {
    const cover = UI.safeImg(s.cover), logo = UI.safeImg(s.logo), kinds = t("shKinds") || {};
    const initials = String(s.name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    const html = `<div class="sh-cover pk-${UI.esc(s.kind || "autre")}"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}</div>
      <div class="sh-row"><span class="pc-logo sh-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
        <div class="sh-txt"><b>${UI.esc(s.name)}</b><small>${UI.esc(s.tagline || kinds[s.kind] || "")}</small></div></div>
      ${UI.openState(s.hours) ? `<p class="sh-status ${UI.openState(s.hours).open ? "on" : "off"}"><i></i>${UI.esc(openLabel(UI.openState(s.hours)))}</p>` : ""}
      ${s.pro ? `<div class="pc-tags sh-tags"><em>🛵 ${UI.esc(t("proDelivery", { price: money(proPrice(s)) }))}</em><em>🧾 ${UI.esc(t("qZero"))} ${UI.esc(t("qService").toLowerCase())}</em></div>` : ""}
      ${state.shopSched && val("urgency") === "programmee" ? `<p class="sh-sched">🗓️ ${UI.esc(t("shSched", { name: s.name, when: UI.fmtDateTime(state.shopSched) }))}</p>` : ""}
      ${shopTwoWay() ? `<div class="sh-dir" role="group">
        <button type="button" class="${side === "to" ? "on" : ""}" data-shop-dir="to"><i>🧺</i><span><b>${UI.esc(t("shDirTo"))}</b><small>${UI.esc(t("shDirToSub", { name: s.name }))}</small></span></button>
        <button type="button" class="${side === "from" ? "on" : ""}" data-shop-dir="from"><i>👔</i><span><b>${UI.esc(t("shDirFrom"))}</b><small>${UI.esc(t("shDirFromSub", { name: s.name }))}</small></span></button>
      </div>` : ""}
      ${shopInfo(s)}`;
    if (hero.dataset.html !== html) { hero.innerHTML = html; hero.dataset.html = html; }
  }
  if (on) $("#shopBannerText").textContent = t(side === "to" ? "shBannerTo" : "shBanner", { name: state.shop.name });
  const pro = proShopOn();
  // Commerce à l'arrivée (pressing : on lui apporte les vêtements) : le catalogue seul, sans commande à préparer
  $("#shopOrderBox").classList.toggle("hidden", !pro && !shopDropOn());
  form.shop_order.closest("label").classList.toggle("hidden", !pro);
  $("#shopOrderNote").classList.toggle("hidden", !pro);
  $("#shopRefBox").classList.toggle("hidden", !shopSelf());
  if (pro) {
    $("#shopOrderLabel").textContent = t("spOrderLabel", { name: state.shop.name });
    $("#shopOrderNote").textContent = t("spOrderNote", { name: state.shop.name });
  }
  renderCatalog();
}

const PRESSING_RX = /pressing|laverie|blanchisserie|teinturerie|dry ?clean|laundr|ניקוי יבש|מכבס/i;
const isPressing = p => !!p && (p.kind === "pressing" || PRESSING_RX.test(p.brand || ""));
// Dans quel sens ? Un restaurant est toujours au départ. Un pressing : on vient chercher les vêtements chez le client
// et on les y apporte (« to »), ou on les récupère au pressing et on les ramène (« from »). L'adresse du commerce
// reste toujours d'un côté ou de l'autre, jamais perdue.
const BOTH_WAYS = ["pressing"];
const shopTwoWay = () => !!(state.shop && BOTH_WAYS.includes(state.shop.kind));
function applyShop() {
  const s = state.shop;
  if (!s) return;
  const dir = shopTwoWay() && state.shopDir !== "from" ? "to" : "from", other = dir === "from" ? "to" : "from";
  const m = String(s.address || "").match(/^(.*?)\s+(\d+[a-zA-Zא-ת]?)$/);
  // Le commerce était de l'autre côté : on libère ce côté (pour l'adresse du client)
  if (state.pick[other] && state.pick[other].shopId === s.id) {
    state.pick[other] = null; state[other + "Point"] = null;
    if (ac[other]) ac[other].reset();
    if (home.ac && home.ac[other]) home.ac[other].reset();
    form.elements[prefixOf(other) + "_address"].value = "";
    form.elements[prefixOf(other) + "_number"].value = "";
    setBrandMode(other, false);
  }
  applySavedAddr(dir, { brand: s.name, street: m ? m[1] : s.address || "", number: m ? m[2] : "", cityId: CONFIG.cities.some(c => c.id === s.city) ? s.city : null,
    city: s.city, lat: s.lat, lon: s.lon, exact: s.lat != null });
  state.pick[dir].shopId = s.id;
  if (other === "from" && !state.pick.from) setTimeout(() => form.pickup_address.focus({ preventScroll: true }), 300);
  // Commerce fermé maintenant : la course est programmée d'office pour son ouverture (le client peut changer)
  state.shopSched = null;
  const st = UI.openState(s.hours), at = UI.nextOpenDate(st);
  if (at && val("urgency") === "asap") {
    const d = new Date(at.getTime() + 15 * 60000);
    form.elements.urgency.value = "programmee";
    form.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    form.time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    state.shopSched = d;
  }
  // Commerce HOP! Pro : le service va de soi (repas pour un restaurant, sinon une course simple)
  if (s.kind === "restaurant" || s.pro) { form.elements.service.value = s.kind === "restaurant" ? "repas" : "colis"; state.svcChosen = true; }
  syncVisibility(); renderQuote();
  renderShopBanner();
}

async function loadShop(code, stay) {
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
  loadCatalogFor(state.shop);
  if (!stay) setTimeout(() => $("#commander").scrollIntoView({ behavior: "smooth" }), 300);
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
  // Carnet mis de côté par le patron : plus proposé dans les demandes
  const carnetOpt = f.topic.querySelector('option[value="carnet"]');
  if (carnetOpt) { carnetOpt.hidden = carnetOpt.disabled = !CONFIG.partners.carnet.offered; }
  f.topic.value = topic === "carnet" && !CONFIG.partners.carnet.offered ? "tournee" : topic || "tournee";
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

// --- Accueil façon appli : carte, « Où on livre ? », livreurs autour, raccourcis ------------
const home = { map: null, pins: {}, line: null, scoots: [], ac: {}, pos: null, nearby: [], key: "", when: "now" };
// Ouvert : aux horaires, et à toute heure dès qu'un livreur libre est en ligne (le patron compris)
const courierFree = () => (home.nearby || []).some(c => c.free);
function openNow() { return !!state.settings.accepting && (Pricing.isOpenNow(CONFIG) || courierFree()); }
// « Dès que possible » / « Express » : une vraie estimation selon les livreurs libres près du départ
// (pas de « dans les 3 heures » pour un repas : soit un livreur arrive vite, soit on le dit)
function etaToPickup() {
  const free = (home.nearby || []).filter(c => c.free);
  if (!free.length) return null;
  const c0 = Pricing.cityById(CONFIG, cityOf("from")) || Pricing.cityById(CONFIG, CONFIG.homeCity);
  const target = state.fromPoint || home.pos || { lat: c0.lat, lon: c0.lon };
  return Math.max(3, Math.min(...free.map(c => Pricing.etaMinutes({ lat: Number(c.lat), lon: Number(c.lon) }, target))));
}
function renderWhenHints() {
  if (!$("#asapSmall")) return;
  const eta = etaToPickup(), online = (home.nearby || []).length, food = val("service") === "repas";
  // Dès que possible : proposée par vagues, et un livreur peut la prendre en finissant sa course → une fourchette.
  // Express : le livreur libre le plus proche, tout de suite, sans autre course → le temps le plus court.
  const asap = eta != null ? t(food ? "wEtaFoodRange" : "wEtaRange", { min: eta, max: eta + 10 })
    : online ? t("wBusy") : food || !Pricing.isOpenNow(CONFIG) ? t("wNone") : t("w_asap_d");
  $("#asapSmall").textContent = asap;
  const ex = $("#expressSmall"), exInput = form.querySelector('input[name=urgency][value=express]');
  const exOk = eta != null;
  ex.textContent = exOk ? `${t("wExpressEta", { min: eta })} · +${money(P.express)}` : t("wExpressNone");
  exInput.disabled = !exOk;
  exInput.closest(".choice").classList.toggle("disabled", !exOk);
  if (!exOk && exInput.checked) form.querySelector('input[name=urgency][value=asap]').checked = true;
}
function renderOpenBadge() {
  renderWhenHints();
  const open = openNow(), online = (home.nearby || []).length;
  // Fermé : on dit pourquoi (tous en course, ou personne de connecté) plutôt qu'un simple « Fermé »
  const key = !state.settings.accepting ? "closedNow"
    : open ? (courierFree() || !online ? "openNow" : "openBusy")
    : online ? "allBusy" : "allOff";
  $("#openBadge").textContent = t(key);
  $("#openBadge").classList.toggle("closed", !open);
  return open;
}
// Le commerce commande lui-même une course (son téléphone) : n° de commande à 3 chiffres pour le sac
const shopSelf = () => shopPicked() && !!state.pro && !proShopOn();
const HOME_KINDS = EXAMPLES.filter(e => !e.set.to_city);
const homeInput = which => $(which === "from" ? "#homeFrom" : "#homeTo");
const homeNo = which => $(which === "from" ? "#homeFromNo" : "#homeToNo");
const isRtl = () => document.documentElement.dir === "rtl";
const addrReady = which => { const pre = prefixOf(which); const p = state.pick[which];
  return !!val(pre + "_address").trim() && (!!val(pre + "_number").trim() || !!(p && p.brand)); };

function initHome() {
  ["from", "to"].forEach(which => {
    const input = homeInput(which), pre = prefixOf(which);
    home.ac[which] = Places.attach(input, {
      lang: () => I18N.lang,
      texts: () => ({ none: t("addrNone"), down: t("addrDown"), partner: t("ensPartner"), notOnMap: t("addrNotOnMap"), notOnMapSub: t("addrNotOnMapSub"), brandAddr: t("addrBrandAddr"), soon: t("addrSoon"), didYouMean: t("addrDidYou") }),
      onPick: p => {
        onPlacePicked(which, p, true);
        if (ac[which]) ac[which].setPicked(p.label);
        // Rue sans numéro : on le demande tout de suite, sur place
        if (!p.housenumber && !p.brand) setTimeout(() => homeNo(which).focus(), 60);
        else if (which === "from" && !state.pick.to) setTimeout(() => homeInput("to").focus(), 60);
      },
      quick: () => quickPlaces(which, true),
      onClear: () => {
        state.pick[which] = null;
        if (ac[which]) ac[which].reset();
        setBrandMode(which, false);
        renderQuote(); renderShopBanner(); renderSaveBtns();
      }
    });
    // Adresse tapée sans la choisir dans la liste : elle part telle quelle dans le formulaire
    input.addEventListener("input", () => { form.elements[pre + "_address"].value = input.value; renderQuote(); });
    homeNo(which).addEventListener("input", e => { form.elements[pre + "_number"].value = e.target.value; $("#homeErr").classList.add("hidden"); renderQuote(); });
  });
  $("#homeSwap").addEventListener("click", swapRoute);
  $("#homeGo").addEventListener("click", homeGo);
  // ◎ : la carte se centre sur moi (point bleu), bien zoomée
  $("#homeLocate").addEventListener("click", async () => {
    const b = $("#homeLocate");
    if (b.classList.contains("busy")) return;
    b.classList.add("busy");
    try {
      const pos = await myPosition();
      setHomePos(pos); renderHomeMap(false); renderLive();
      if (home.map) home.map.flyTo([pos.lat, pos.lon], Math.max(home.map.getZoom(), 16), { duration: 0.6 });
      showHomeErr("");
    } catch (e) { showHomeErr(t("geoDenied")); }
    finally { b.classList.remove("busy"); }
  });
  $("#homeSheet").addEventListener("click", async e => {
    const g = e.target.closest("[data-hgeo]");
    if (g) {
      g.disabled = true;
      g.classList.add("busy");
      try {
        // « 📍 Ma position » des raccourcis : le départ s'il est vide, sinon l'arrivée
        const which = g.dataset.hgeo === "auto" ? (!state.pick.from ? "from" : "to") : g.dataset.hgeo;
        const err = await locateInto(which);
        if (err) showHomeErr(t(err));
        else {
          renderLive();
          if (!val(prefixOf(which) + "_number").trim()) { showHomeErr(t("hmNeedNo")); homeNo(which).focus(); }
        }
      } finally { g.disabled = false; g.classList.remove("busy"); }
      return;
    }
    const k = e.target.closest("[data-kind]");
    if (k) return applyKind(k.dataset.kind);
    const w = e.target.closest("[data-when]");
    if (w) return applyWhen(w.dataset.when);
    const a = e.target.closest("[data-haddr]");
    if (a) {
      const addr = Store.getAddresses()[Number(a.dataset.haddr)];
      if (addr) applySavedAddr(!state.pick.from ? "from" : "to", addr);
      return;
    }
    if (e.target.closest("#homeRepeatBtn")) repeatLast();
    const en = e.target.closest("[data-ens]");
    if (en) openEns(en.dataset.ens);
    const pr = e.target.closest("[data-pro]");
    if (pr && pr.dataset.pro) { state.shopDir = ""; loadShop(pr.dataset.pro); }
  });
  $("#ensCats").addEventListener("click", e => { const b = e.target.closest("[data-ens]"); if (b) openEns(b.dataset.ens); });
  $("#ensFilter").addEventListener("input", renderEnsList);
  $("#ensClose").addEventListener("click", () => $("#ensModal").classList.add("hidden"));
  $("#ensModal").addEventListener("click", e => {
    if (e.target.id === "ensModal") return $("#ensModal").classList.add("hidden");
    if (e.target.closest("[data-ens-retry]")) return openEns(ens.cat);
    const b = e.target.closest("[data-ens-pick]");
    if (b) pickEnseigne(b.dataset.ensPick, ens.shown[Number(b.dataset.i)]);
  });
  state.partnersReady = loadPartners();
  loadShowcase();
  initHomeMap();
  // Position déjà autorisée : on centre la carte sur le client (sans rien lui demander)
  if (navigator.permissions && navigator.geolocation) {
    navigator.permissions.query({ name: "geolocation" }).then(r => {
      if (r.state === "granted") myPosition().then(pos => { setHomePos(pos); renderHomeMap(true); renderLive(); }, () => {});
    }).catch(() => {});
  }
  loadNearby();
  // Livreurs en ligne : vérifié toutes les 5 s (un livreur qui se déconnecte disparaît tout de suite)
  setInterval(() => { if (!document.hidden) loadNearby(); }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadNearby(); });
  // Sur téléphone, la bulle « Nous écrire » remonte au-dessus du bouton Commander
  if ("IntersectionObserver" in window) new IntersectionObserver(es => document.body.classList.toggle("in-home", es[0].isIntersecting)).observe($("#homeSheet"));
}

function showHomeErr(msg) { $("#homeErr").textContent = msg || ""; $("#homeErr").classList.toggle("hidden", !msg); }

// Types de course, raccourcis d'heure et adresses enregistrées (selon la langue)
// Illustrations en relief des types de course et des catégories d'enseignes (img/items)
const KIND_ART = { bakery: ["croissant", 38], pressing: ["basket", 35], poste: ["mailbox", 205], pharm: ["pill", 160], resto: ["burger", 25], docs: ["docs", 215],
  yad2: ["couch", 30], keys: ["key", 45], shop: ["cart", 140], gift: ["flowers", 330], ta: ["scooter", 15] };
function renderHomeStatic() {
  const homeCity = CONFIG.homeCity;
  $("#homeKinds").innerHTML = HOME_KINDS.map(ex => {
    const q = Pricing.computeQuote({ fromCity: homeCity, toCity: homeCity, service: ex.set.service, size: ex.set.size || "petit", roundTrip: ex.set.round_trip }, CONFIG);
    const art = KIND_ART[ex.id];
    return `<button type="button" class="ch-kind${state.homeKind === ex.id ? " on" : ""}" data-kind="${ex.id}">${art ? UI.artImg(art[0], art[1]) : `<i>${ex.icon}</i>`}<b>${UI.esc(t("ex_" + ex.id + "_t"))}</b><small>${money(q.total)}</small></button>`;
  }).join("");
  const list = Store.getAddresses().slice(0, 5);
  $("#homeChips").innerHTML = `<button type="button" class="ch-chip" data-hgeo="auto">${UI.esc(t("myPosChip"))}</button>`
    + list.map((a, i) => `<button type="button" class="ch-chip" data-haddr="${i}">${addrChip(a)}</button>`).join("");
  renderWhen();
  $("#homeEns").innerHTML = Enseignes.CATS.filter(c => c.id !== "hop" || state.partners.length)
    .map(c => `<button type="button" class="ch-chip" data-ens="${c.id}">${UI.esc(t("ens_" + c.id))}</button>`).join("");
}

// Raccourcis d'heure : maintenant, dans 1 h, ce soir, demain matin (seulement s'ils sont possibles)
function whenOptions() {
  const lead = CONFIG.minLeadMinutes * 60000;
  const ok = d => d - Date.now() >= lead && !Pricing.checkSchedule(d, CONFIG);
  const out = [];
  if (openNow()) out.push({ id: "now" });
  const in1 = new Date(Date.now() + 3600000); in1.setSeconds(0, 0); in1.setMinutes(Math.ceil(in1.getMinutes() / 15) * 15);
  if (ok(in1)) out.push({ id: "in1h", d: in1 });
  const eve = new Date(); eve.setHours(19, 0, 0, 0);
  if (ok(eve) && eve - in1 > 1800000) out.push({ id: "tonight", d: eve });
  const tm = new Date(); tm.setDate(tm.getDate() + 1); tm.setHours(9, 0, 0, 0);
  for (let i = 0; i < 12 && !ok(tm); i++) tm.setMinutes(tm.getMinutes() + 30);
  if (ok(tm)) out.push({ id: "tomorrow", d: tm });
  out.push({ id: "other" });
  return out;
}
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function currentWhen() {
  if (val("urgency") !== "programmee") return "now";
  const opt = whenOptions().find(o => o.d && `${o.d.getFullYear()}-${pad(o.d.getMonth() + 1)}-${pad(o.d.getDate())}` === val("date") && hhmm(o.d) === val("time"));
  return opt ? opt.id : "other";
}
function renderWhen() {
  const cur = currentWhen();
  $("#homeWhen").innerHTML = whenOptions().map(o => `<button type="button" class="ch-chip${cur === o.id ? " on" : ""}" data-when="${o.id}">${UI.esc(t({ now: "hmNow", in1h: "hmIn1h", tonight: "hmTonight", tomorrow: "hmTomorrow", other: "hmOther" }[o.id], { h: o.d ? hhmm(o.d) : "" }))}</button>`).join("");
  const planned = val("urgency") === "programmee" && pickupDate();
  $("#homeWhenNote").textContent = planned ? t("hmPlanned", { when: UI.fmtDateTime(planned) }) : "";
  $("#homeWhenNote").classList.toggle("hidden", !planned);
}
function applyWhen(id) {
  const opt = whenOptions().find(o => o.id === id);
  if (!opt) return;
  if (id === "now") form.elements.urgency.value = "asap";
  else {
    form.elements.urgency.value = "programmee";
    if (opt.d) { form.date.value = `${opt.d.getFullYear()}-${pad(opt.d.getMonth() + 1)}-${pad(opt.d.getDate())}`; form.time.value = hhmm(opt.d); }
  }
  syncVisibility();
  renderQuote();
  if (id === "other") fieldsetOf('legend[data-i18n="s4"]').scrollIntoView({ behavior: "smooth", block: "start" });
}

// Type de course choisi d'un geste (un 2e appui revient au colis simple), sans toucher aux adresses
function applyKind(id) {
  const ex = EXAMPLES.find(e => e.id === id);
  state.homeKind = state.homeKind === id ? null : id;
  form.elements.service.value = "colis";
  form.elements.size.value = "petit";
  form.round_trip.checked = false;
  if (state.homeKind) Object.entries(ex.set).forEach(([k, v]) => {
    if (k === "urgency") return;   // l'heure se choisit avec les raccourcis
    const el = form.elements[k];
    if (el && el.type === "checkbox") el.checked = v; else if (el) el.value = v;
  });
  syncVisibility();
  renderQuote();
  renderHomeStatic();
  // Poste, Super-Pharm, restaurant… sans départ choisi : on propose tout de suite les plus proches
  const cat = { poste: "post", pharm: "pharm", resto: "food", shop: "super", gift: "flower", bakery: "breakfast", pressing: "pressing" }[id];
  if (state.homeKind && cat && !state.pick.from) openEns(cat);
}

// Inverser départ et arrivée
function swapRoute() {
  ["address", "number", "building", "floor", "apt", "code", "note"].forEach(k => {
    const a = form.elements["pickup_" + k], b = form.elements["dropoff_" + k];
    [a.value, b.value] = [b.value, a.value];
  });
  [form.from_city.value, form.to_city.value] = [form.to_city.value, form.from_city.value];
  [form.from_other.value, form.to_other.value] = [form.to_other.value, form.from_other.value];
  [state.pick.from, state.pick.to] = [state.pick.to, state.pick.from];
  [state.fromPoint, state.toPoint] = [state.toPoint, state.fromPoint];
  ["from", "to"].forEach(w => {
    const p = state.pick[w];
    if (p) { ac[w].setPicked(p.label); home.ac[w].setPicked(p.label); } else { ac[w].reset(); home.ac[w].reset(); }
    form.elements[prefixOf(w) + "_address"].closest(".fields").classList.toggle("brand-mode", !!(p && p.brand));
  });
  syncVisibility();
  renderQuote();
  renderShopBanner();
  renderSaveBtns();
}

// « Refaire » la dernière course : mêmes adresses, même type, d'un seul geste
function lastTrip() {
  const o = state.mine.filter(x => !["annulee", "refusee"].includes(x.status))
    .sort((a, b) => new Date(b.created_at || b.pickup_at) - new Date(a.created_at || a.pickup_at))[0];
  if (!o) return null;
  const list = Store.getAddresses();
  const near = (a, lat, lon) => a.lat != null && lat != null && Math.abs(a.lat - lat) < 1e-5 && Math.abs(a.lon - lon) < 1e-5;
  const from = list.find(a => near(a, Number(o.pickup_lat), Number(o.pickup_lon)));
  const to = list.find(a => near(a, Number(o.dropoff_lat), Number(o.dropoff_lon)));
  return from && to ? { o, from, to } : null;
}
function repeatLast() {
  const r = lastTrip();
  if (!r) return;
  applySavedAddr("from", r.from);
  applySavedAddr("to", r.to);
  if (r.o.service) form.elements.service.value = r.o.service;
  if (r.o.size && !(r.o.size === "gros" && P.carAvailable === false)) form.elements.size.value = r.o.size;
  syncVisibility();
  renderQuote();
}

// Le formulaire et l'accueil restent synchronisés (adresses, numéro, heure, prix, carte)
function syncHome() {
  if (!home.ac.from) return;
  ["from", "to"].forEach(which => {
    const input = homeInput(which), p = state.pick[which], pre = prefixOf(which);
    if (document.activeElement !== input) {
      if (p) { if (input.value !== p.label) home.ac[which].setPicked(p.label); }
      else { home.ac[which].reset(); input.value = val(pre + "_address"); }
    }
    const no = homeNo(which);
    // Une rue (pas une enseigne) : la case N° est toujours là, pré-remplie si la carte connaît le numéro
    const street = !!p && !p.brand;
    no.classList.toggle("hidden", !street);
    if (document.activeElement !== no) no.value = val(pre + "_number");
    no.classList.toggle("need", street && !val(pre + "_number").trim());
  });
  const name = (Store.getProfile().contact_name || "").trim().split(" ")[0];
  $("#homeHello").textContent = name ? t("hmHello", { name }) : t("hmHelloNew");
  renderWhen();
  const ready = addrReady("from") && addrReady("to");
  const first = activeOrders().length === 0 && !state.welcomeUsed;
  if (ready) {
    const q = currentQuote();
    $("#homeGoPrice").textContent = (q.known ? "" : t("from") + " ") + money(q.total);
    $("#homeGoSub").textContent = t("hmGoKm", { from: cityLabel(cityOf("from")), to: cityLabel(cityOf("to")) });
  } else {
    $("#homeGoPrice").textContent = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity));
    $("#homeGoSub").textContent = first ? t("hmGoFirst", { price: money(welcomePrice()) }) : t("hmGoKm", { from: I18N.cityName(CONFIG.homeCity), to: I18N.cityName(CONFIG.homeCity) });
  }
  $("#homeGo").textContent = t(ready ? "hmGoNext" : "hmGo");
  const base = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity));
  $("#homeFair").textContent = t("fairText", { price: ready && val("service") !== "achat" ? money(currentQuote().total) : base });
  $("#homeFairShop").textContent = t("fairShop", { price: ready && val("service") === "achat" ? money(currentQuote().total) : base });
  const r = lastTrip();
  $("#homeRepeat").innerHTML = r && !ready ? `<button type="button" class="ch-repeat" id="homeRepeatBtn"><span>🔁</span><div><b>${UI.esc(t("hmRepeat"))}</b>
      <small>${UI.esc(t("hmRepeatSub", { from: r.from.brand || `${r.from.street} ${r.from.number}`.trim(), to: r.to.brand || `${r.to.street} ${r.to.number}`.trim() }))}</small></div><b>${money(r.o.price)}</b></button>` : "";
  const key = JSON.stringify([state.fromPoint, state.toPoint]);
  if (key !== home.key) { home.key = key; renderHomeMap(true); renderLive(); }
}

function homeGo() {
  showHomeErr("");
  for (const which of ["from", "to"]) {
    if (addrReady(which)) continue;
    const typed = !!val(prefixOf(which) + "_address").trim();
    if (typed && state.pick[which]) { showHomeErr(t("hmNeedNo")); homeNo(which).focus(); }
    else homeInput(which).focus();
    return;
  }
  // Tout est prêt pour les adresses : on continue là où il manque quelque chose
  const missing = stepStates().find(([fs, ok]) => fs && !ok);
  (missing ? missing[0] : $("#summary")).scrollIntoView({ behavior: "smooth", block: missing ? "start" : "center" });
}

// --- Carte de l'accueil -----------------------------------------------------------------
function initHomeMap() {
  if (home.map || !window.L) return;
  const c = Pricing.cityById(CONFIG, CONFIG.homeCity);
  // Carte vivante : on la déplace au doigt, on zoome à deux doigts ou avec + / − (pas avec la molette : la page défile)
  home.map = L.map("homeMap", { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: true, touchZoom: true, doubleClickZoom: true })
    .setView([c.lat, c.lon], 13);
  $("#homeZoomIn").addEventListener("click", () => home.map.zoomIn());
  $("#homeZoomOut").addEventListener("click", () => home.map.zoomOut());
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  UI.mapTiles(home.map, dark);
  addEventListener("resize", () => home.map.invalidateSize());
  initRestos();
}
// Restaurants de l'annuaire sur la carte : un point de loin, un rond 🍴 de près, et leur nom en zoomant encore.
// On en touche un : « Récupérer ici » le met en départ.
const restos = { layer: null, list: [], key: "" };
async function initRestos() {
  restos.layer = L.layerGroup().addTo(home.map);
  // La carte : les restaurants seulement (pas les magasins ni les pharmacies de l'annuaire)
  try { restos.list = (await Places.directory()).filter(e => e.lat != null && e.lon != null && e.t !== "shop"); } catch (e) { restos.list = []; }
  // + les commerces partenaires et ceux ajoutés par le patron ou appris des clients (pas encore dans l'annuaire)
  try {
    await Promise.race([state.partnersReady, new Promise(r => setTimeout(r, 4000))]).catch(() => {});
    const nn = v => norm(v).replace(/[^a-z0-9\u0590-\u05ff]/g, "");
    const twin = x => restos.list.some(e => Math.abs(e.lat - x.lat) < 0.0015 && Math.abs(e.lon - x.lon) < 0.0015
      && [e.n, e.fr].concat(e.alt || []).some(k => nn(k) && (nn(k).includes(nn(x.n)) || nn(x.n).includes(nn(k)))));
    const extra = (state.partners || []).map(sh => ({ n: sh.name, s: sh.address || "", c: sh.city || "", lat: Number(sh.lat), lon: Number(sh.lon), partner: sh }))
      .concat(((await Store.placesMap().catch(() => [])) || []).map(x => ({ n: x.name, s: x.address || "", c: cityLabel(cityIdOf(x.city, x) || x.city), lat: Number(x.lat), lon: Number(x.lon), known: true })));
    extra.forEach(x => { if (x.n && isFinite(x.lat) && isFinite(x.lon) && !twin(x)) restos.list.push(x); });
  } catch (e) { /* la carte garde l'annuaire */ }
  // Position par défaut (beaucoup de restaurants de rues différentes sur le même point) : pas sur la carte, la recherche les trouve
  const streets = {};
  restos.list.forEach(e => { const k = e.lat.toFixed(4) + "," + e.lon.toFixed(4); (streets[k] = streets[k] || new Set()).add(String(e.s || "").split(" ")[0]); });
  restos.list = restos.list.map(e => (streets[e.lat.toFixed(4) + "," + e.lon.toFixed(4)].size >= 3 ? Object.assign({}, e, { offMap: true }) : e));
  home.map.on("zoomend moveend", drawRestos);
  home.map.on("popupclose", () => { restos.open = false; drawRestos(); });
  home.map.on("popupopen", e => {
    restos.open = true;
    const box = e.popup.getElement();
    if (box) box.querySelectorAll("[data-resto]").forEach(b => b.addEventListener("click", () => { pickResto(restos.list[Number(b.dataset.resto)]); home.map.closePopup(); }));
  });
  drawRestos();
}
const restoName = e => (I18N.lang === "fr" && e.fr ? e.fr : e.n);
function drawRestos() {
  if (restos.open) return;   // une bulle est ouverte : on ne redessine pas (elle se fermerait)
  const z = home.map.getZoom(), el = home.map.getContainer();
  el.classList.toggle("rz-far", z < 15);
  el.classList.toggle("rz-names", z >= 16);
  if (z < 13) { restos.layer.clearLayers(); restos.key = ""; return; }
  const bounds = home.map.getBounds().pad(0.15), c = home.map.getCenter();
  // Plusieurs restaurants au même endroit (centre commercial) : un seul rond « nom +2 »
  const groups = {};
  restos.list.forEach((e, i) => {
    if (e.offMap || !bounds.contains([e.lat, e.lon])) return;
    const k = e.lat.toFixed(4) + "," + e.lon.toFixed(4);
    (groups[k] = groups[k] || []).push(i);
  });
  const shown = Object.values(groups).map(ids => ({ ids, e: restos.list[ids[0]] }))
    .sort((a, b2) => c.distanceTo([a.e.lat, a.e.lon]) - c.distanceTo([b2.e.lat, b2.e.lon])).slice(0, z >= 15 ? 150 : 250);
  // Noms : seulement ceux qui ne se chevauchent pas (les plus proches du centre d'abord)
  const boxes = [];
  shown.forEach(g => {
    if (z < 16) return;
    const name = restoName(g.e), pt = home.map.latLngToContainerPoint([g.e.lat, g.e.lon]);
    const w = Math.min(22, name.length) * 6.4 + (g.ids.length > 1 ? 22 : 0) + 30, box = [pt.x - 12, pt.y - 10, pt.x + w, pt.y + 10];
    g.label = !boxes.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
    if (g.label) boxes.push(box);
  });
  const key = I18N.lang + ":" + z + ":" + shown.map(g => g.ids.join("+") + (g.label ? "L" : "")).join(",");
  if (key === restos.key) return;   // mêmes restaurants : rien à refaire (pas de clignotement)
  restos.key = key;
  restos.layer.clearLayers();
  shown.forEach(g => {
    const name = restoName(g.e), more = g.ids.length - 1;
    const label = (name.length > 22 ? name.slice(0, 21) + "…" : name) + (more ? ` +${more}` : "");
    L.marker([g.e.lat, g.e.lon], { zIndexOffset: -1000, keyboard: false, icon: L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 12],
      html: `<div class="resto-pin${more ? " many" : ""}"><b>🍴</b>${g.label ? `<span>${UI.esc(label)}</span>` : ""}</div>` }) })
      .bindPopup(`<div class="resto-pop">${g.ids.slice(0, 8).map(i => { const e = restos.list[i]; return `<div class="rp-row">
          <span><b>${UI.esc(Places.dirName(e, I18N.lang))}</b>${e.s ? `<small>${UI.esc(e.s)}</small>` : ""}</span>
          <button type="button" class="btn btn-primary btn-sm" data-resto="${i}">${UI.esc(t("restoTake"))}</button></div>`; }).join("")}</div>`,
        { closeButton: false, offset: [0, -6], autoPanPaddingTopLeft: [12, 140], autoPanPaddingBottomRight: [70, 20] })
      .addTo(restos.layer);
  });
}
function pickResto(e) {
  if (!e) return;
  if (e.partner) { onPlacePicked("from", partnerPlace(e.partner)); return; }   // commerce partenaire : sa vitrine
  const p = Object.assign(Places.dirPlace(e, I18N.lang), e.known ? { known: true, food: Places.foodIcon(e.n) !== "🍽️" } : {});
  if (home.ac.from) home.ac.from.setPicked(p.label);
  onPlacePicked("from", p, true);
  renderHomeMap(true);
  if (!state.pick.to) setTimeout(() => homeInput("to").focus({ preventScroll: true }), 60);
}
const divIcon = (html, size) => L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
function renderHomeMap(refit) {
  if (!home.map) return;
  const place = (key, pt, html, size, anchorBottom) => {
    if (!pt) { if (home.pins[key]) { home.map.removeLayer(home.pins[key]); delete home.pins[key]; } return; }
    const icon = anchorBottom ? L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size] }) : divIcon(html, size);
    if (home.pins[key]) home.pins[key].setLatLng([pt.lat, pt.lon]);
    else home.pins[key] = L.marker([pt.lat, pt.lon], { icon, zIndexOffset: 500, interactive: false }).addTo(home.map);
  };
  place("me", home.pos, `<div class="ch-me"></div>`, 24);
  place("from", state.fromPoint, `<div class="ch-pin">📍</div>`, 32, true);
  place("to", state.toPoint, `<div class="ch-pin">🏁</div>`, 32, true);
  if (home.line) { home.map.removeLayer(home.line); home.line = null; }
  if (state.fromPoint && state.toPoint) {
    home.line = L.polyline([[state.fromPoint.lat, state.fromPoint.lon], [state.toPoint.lat, state.toPoint.lon]],
      { color: "#FF6A13", weight: 4, dashArray: "8 10", opacity: .9 }).addTo(home.map);
  }
  if (refit) homeFit();
}
function homeFit() {
  const pts = [state.fromPoint, state.toPoint].filter(Boolean);
  if (!pts.length && home.pos) pts.push(home.pos);
  if (!pts.length) return;
  const mobile = innerWidth <= 860;
  const side = mobile ? 0 : $("#homeSheet").offsetWidth + 40;
  const pad = isRtl() ? { paddingTopLeft: [50, 90], paddingBottomRight: [side + 50, 50] } : { paddingTopLeft: [side + 50, 90], paddingBottomRight: [50, 50] };
  if (pts.length > 1) home.map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])), Object.assign({ maxZoom: 15 }, pad));
  else {
    home.map.setView([pts[0].lat, pts[0].lon], 15, { animate: false });
    if (side) home.map.panBy([isRtl() ? side / 2 : -side / 2, 0], { animate: false });
  }
}

// Livreurs en ligne autour : un scooter par livreur, à sa position (arrondie à ≈ 200 m).
// Il ne bouge que quand le livreur bouge vraiment : il glisse alors jusqu'à sa nouvelle place.
async function loadNearby() {
  const wasOpen = openNow();
  try { home.nearby = (await Store.couriersNearby()) || []; } catch (e) { return; }
  // Un livreur passe en ligne (ou hors ligne) en dehors des horaires : « Ouvert » et « Maintenant » suivent
  if (renderOpenBadge() !== wasOpen) { renderWhen(); renderQuote(); }
  if (home.map) {
    // Deux livreurs dans le même carré : on les écarte un peu (≈ 30 m) pour voir les deux
    const seen = {};
    const pts = home.nearby.slice(0, 25).map(c => {
      const lat = Number(c.lat), lon = Number(c.lon), k = lat + "," + lon, n = seen[k] = (seen[k] || 0) + 1;
      const a = n * 2.4, r = n > 1 ? 0.0003 : 0;
      return { lat: lat + Math.sin(a) * r, lon: lon + Math.cos(a) * r * 1.2, free: !!c.free };
    });
    while (home.scoots.length > pts.length) home.map.removeLayer(home.scoots.pop().m);
    pts.forEach((p, i) => {
      // Rond blanc, « ! » orange de HOP! qui clignote (gris et fixe si le livreur est déjà en course)
      const icon = () => divIcon(`<div class="ch-scoot${p.free ? "" : " busy"}"><b>!</b></div>`, 30);
      const s = home.scoots[i];
      if (!s) {
        home.scoots.push({ m: L.marker([p.lat, p.lon], { icon: icon(), interactive: false }).addTo(home.map), cur: p, free: p.free });
        return;
      }
      if (s.free !== p.free) { s.m.setIcon(icon()); s.free = p.free; }
      glideScooter(s, p);
    });
  }
  renderLive();
}
function glideScooter(s, to) {
  const from = s.cur;
  s.cur = { lat: to.lat, lon: to.lon };
  if (from.lat === to.lat && from.lon === to.lon) return;
  if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) { s.m.setLatLng([to.lat, to.lon]); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / 1500), e = k * (2 - k);
    s.m.setLatLng([from.lat + (to.lat - from.lat) * e, from.lon + (to.lon - from.lon) * e]);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function renderLive() {
  const el = $("#homeLive");
  if (!openNow()) { el.classList.add("hidden"); return; }
  const free = home.nearby.filter(c => c.free);
  const c0 = Pricing.cityById(CONFIG, CONFIG.homeCity);
  const target = state.fromPoint || home.pos || { lat: c0.lat, lon: c0.lon };
  if (free.length) {
    const min = Math.min(...free.map(c => Pricing.etaMinutes({ lat: Number(c.lat), lon: Number(c.lon) }, target)));
    el.textContent = t("hmLive", { n: home.nearby.length, min: Math.max(3, min) });
  } else el.textContent = t(home.nearby.length ? "hmLiveBusy" : "hmLiveNone", { n: home.nearby.length });
  el.classList.remove("hidden");
}

// --- Enseignes : commerces partenaires en tête, puis pharmacies, poste… les plus proches d'abord -----
const ens = { cat: null, items: [], shown: [], seq: 0 };
state.partners = [];
function setHomePos(pos) { home.pos = pos; Places.setNear(pos); }
const norm = v => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s'’"\-־.]/g, "");
const cityIdOf = (city, pt) => (CONFIG.cities.some(c => c.id === city) ? city : Places.matchCity(city))
  || (pt && pt.lat != null ? CONFIG.cities.slice().sort((a, b) => Places.km(a, pt) - Places.km(b, pt))[0].id : null);
// Un commerce choisi qui n'est pas encore dans la base HOP! (indiqué par le client, ou trouvé sur la carte) :
// il est enregistré avec la commande, puis retrouvé par les autres clients (recherche et carte)
const learnIt = p => !!(p && p.brand && (p.learned || (p.poi && !p.dir && !p.partner && !p.known && !p.nearest)));
function learnedPlace(x) {
  const cityId = cityIdOf(x.city, x);
  const m = String(x.address || "").match(/^(.*?)\s+(\d+[a-zA-Zא-ת]?)$/);
  return { lat: Number(x.lat), lon: Number(x.lon), brand: x.name, learned: true, known: true, streetName: m ? m[1] : x.address, housenumber: m ? m[2] : "",
    street: x.address, city: cityLabel(cityId || x.city), cityId, exact: true,
    label: [x.name, x.address, cityLabel(cityId || x.city)].filter(Boolean).join(", ") };
}
function partnerPlace(sh) {
  const cityId = cityIdOf(sh.city, sh);
  const m = String(sh.address || "").match(/^(.*?)\s+(\d+[a-zA-Zא-ת]?)$/);
  return { lat: Number(sh.lat), lon: Number(sh.lon), brand: sh.name, phone: sh.phone || null, partner: true, partnerCode: sh.code, kind: sh.kind || null,
    streetName: m ? m[1] : sh.address || "", housenumber: m ? m[2] : "", street: sh.address || "", city: cityLabel(cityId || sh.city), cityId, exact: true,
    label: [sh.name, sh.address, cityLabel(cityId || sh.city)].filter(Boolean).join(", ") };
}
// --- Vitrine : les commerces HOP! Pro abonnés, mis en avant sur l'accueil (logo, photo, accroche) -------
state.showcase = [];
function proPrice(s) {
  if (s && s.client_pays) return CONFIG.pricing.fixedFromHome[CONFIG.homeCity];
  const st = state.settings || {};
  const share = Number(st.pro_shop_share != null ? st.pro_shop_share : CONFIG.pro.shopShare) - Number(st.pro_hop_share != null ? st.pro_hop_share : CONFIG.pro.hopShare);
  return Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - share);
}
// Favoris (cœur) : gardés sur ce téléphone, affichés en premier
const LS_FAVS = "livraison.favs.v1";
const favs = () => { try { return JSON.parse(localStorage.getItem(LS_FAVS)) || []; } catch (e) { return []; } };
function toggleFav(code) {
  const f = favs(), i = f.indexOf(code);
  if (i >= 0) f.splice(i, 1); else f.unshift(code);
  try { localStorage.setItem(LS_FAVS, JSON.stringify(f.slice(0, 50))); } catch (e) { /* ignore */ }
  renderShowcase();
}
// Grande carte d'un commerce : photo, logo, ouvert / fermé, livraison, et ses premiers articles illustrés
function shopCard(s) {
  const cover = UI.safeImg(s.cover), logo = UI.safeImg(s.logo), fav = favs().includes(s.code), st = UI.openState(s.hours);
  const initials = String(s.name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const top = (s.top || []).slice(0, 4);
  return `<div class="sc-card pk-${UI.esc(s.kind || "autre")}" data-pro="${UI.esc(s.code)}" role="button" tabindex="0">
    <span class="sc-cover"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}
      ${st && !st.open ? `<em class="sc-closed">${UI.esc(t("scClosed"))}</em>` : ""}</span>
    <button type="button" class="sc-fav${fav ? " on" : ""}" data-fav="${UI.esc(s.code)}" aria-label="♥">${fav ? "♥" : "♡"}</button>
    <span class="sc-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
    <span class="sc-body"><b>${UI.esc(s.name)}</b>
      <small>${st ? `<i class="sc-dot ${st.open ? "on" : "off"}"></i>${UI.esc(openLabel(st))} · ` : ""}🛵 ${UI.esc(money(proPrice(s)))}${s.products ? " · " + UI.esc(t("proMenu", { n: s.products })) : ""}</small>
      ${s.tagline ? `<small class="sc-tag">${UI.esc(s.tagline)}</small>` : ""}</span>
    ${top.length ? `<span class="sc-top">${top.map(p => `<span class="sc-ti">${UI.itemArt(p.name, s.kind)}<em>${UI.esc(money(p.price))}</em></span>`).join("")}</span>` : ""}
    <span class="sc-go">${UI.esc(st && !st.open ? t("scSchedule") : t("proGo"))}</span>
  </div>`;
}
function renderShowcase() {
  const list = (state.showcase || []).slice(), f = favs();
  list.sort((a, b) => (f.includes(b.code) - f.includes(a.code)) || ((UI.openState(b.hours) || {}).open === true) - ((UI.openState(a.hours) || {}).open === true));
  $("#homeProBox").classList.toggle("hidden", !list.length);
  const html = list.map(shopCard).join("");
  if ($("#homePro").dataset.html !== html) { $("#homePro").innerHTML = html; $("#homePro").dataset.html = html; }
}
$("#homePro").addEventListener("click", e => {
  const f = e.target.closest("[data-fav]");
  if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); }
}, true);
$("#homePro").addEventListener("keydown", e => { const c = e.target.closest("[data-pro]"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); c.click(); } });
async function loadShowcase() {
  try { state.showcase = (await Store.shopsShowcase()) || []; } catch (e) { state.showcase = []; }
  renderShowcase();
}

async function loadPartners() {
  try { state.partners = ((await Store.shopsDirectory()) || []).filter(x => x.lat != null); } catch (e) { state.partners = []; }
  // En tapant « Fal… », le commerce partenaire Falafel Haim sort en premier
  // … puis les enseignes que HOP! a apprises (absentes de la carte, indiquées par des clients)
  Places.setLocal(async q => {
    const n = norm(q);
    if (n.length < 2) return [];
    const mine = state.partners.filter(x => norm(x.name).includes(n)).slice(0, 3).map(partnerPlace);
    const learned = ((await Store.placesSearch(q).catch(() => [])) || [])
      .filter(x => !mine.some(m => norm(m.brand) === norm(x.name)) && x.lat != null).map(learnedPlace);
    return mine.concat(learned);
  });
  renderHomeStatic();
}
async function openEns(catId) {
  ens.cat = catId;
  const mine = ++ens.seq;
  const c0 = Pricing.cityById(CONFIG, CONFIG.homeCity);
  const at = home.pos || { lat: c0.lat, lon: c0.lon };
  $("#ensModal").dir = document.documentElement.dir;
  $("#ensModal").classList.remove("hidden");
  $("#ensSub").textContent = home.pos ? t("ensNearYou") : t("ensNearCity", { city: I18N.cityName(CONFIG.homeCity) });
  $("#ensCats").innerHTML = Enseignes.CATS.filter(c => c.id !== "hop" || state.partners.length)
    .map(c => `<button type="button" class="ch-chip${c.id === catId ? " on" : ""}" data-ens="${c.id}">${UI.esc(t("ens_" + c.id))}</button>`).join("");
  $("#ensFilter").value = "";
  $("#ensList").innerHTML = `<p class="ens-empty">⏳ ${UI.esc(t("ensLoading"))}</p>`;
  try { ens.items = await Enseignes.list(catId, at, I18N.lang); }
  catch (e) {
    if (mine === ens.seq) $("#ensList").innerHTML = `<p class="ens-empty">⚠️ ${UI.esc(t("ensDown"))}<br><button type="button" class="btn btn-sm" data-ens-retry style="margin-top:10px">${UI.esc(t("ensRetry"))}</button></p>`;
    return;
  }
  if (mine === ens.seq) renderEnsList();
}
function renderEnsList() {
  const n = norm($("#ensFilter").value);
  ens.shown = ens.items.filter(x => !n || norm(x.name + " " + x.street).includes(n));
  const dist = x => (x.km < 1 ? `${Math.max(50, Math.round(x.km * 20) * 50)} m` : `${x.km.toFixed(1).replace(".", ",")} km`);
  $("#ensList").innerHTML = ens.shown.length ? ens.shown.map((x, i) => {
    const addr = [`${x.street} ${x.number}`.trim(), x.city ? cityLabel(cityIdOf(x.city) || x.city) : ""].filter(Boolean).join(", ");
    return `<div class="ens-item">
      <span class="ens-ico">${x.icon}</span>
      <div class="ens-main"><b>${UI.esc(x.name)}${x.partner ? ` <i class="ac-partner">${UI.esc(t("ensPartner"))}</i>` : ""}</b>
        <small>${UI.esc(addr || t("ensAddrLater"))} · ${dist(x)}</small></div>
      <div class="ens-act"><button type="button" class="btn btn-sm btn-primary" data-ens-pick="from" data-i="${i}">${UI.esc(t("ensFrom"))}</button>
        <button type="button" class="btn btn-sm" data-ens-pick="to" data-i="${i}">${UI.esc(t("ensTo"))}</button></div>
    </div>`;
  }).join("") : `<p class="ens-empty">${UI.esc(t("ensNone"))}</p>`;
}
// Enseigne choisie : adresse complétée par la carte si OpenStreetMap ne la connaît pas
async function pickEnseigne(which, x) {
  if (!x) return;
  $("#ensModal").classList.add("hidden");
  if (x.partner && which === "from") { state.shopDir = "from"; loadShop(x.code, true); return; }
  let { street, number, city } = x;
  if (!street) {
    try { const r = (await Places.reverse(x.lat, x.lon, I18N.lang))[0]; if (r) { street = r.streetName; number = number || r.housenumber; city = city || r.city; } }
    catch (e) { /* on garde le nom et le point exact */ }
  }
  const cityId = cityIdOf(city, x);
  const p = { lat: x.lat, lon: x.lon, brand: x.name, phone: x.phone || null, streetName: street || "", housenumber: number || "", city: city || cityLabel(cityId),
    cityId, street: [street, number].filter(Boolean).join(" "), exact: true,
    label: [x.name, [street, number].filter(Boolean).join(" "), cityLabel(cityId || city)].filter(Boolean).join(", ") };
  onPlacePicked(which, p, true);
  if (ac[which]) ac[which].setPicked(p.label);
  if (which === "from" && !state.pick.to) setTimeout(() => homeInput("to").focus(), 80);
}

// « HOP! » en grand quand la commande part
function hopBurst(text) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "hop-burst";
  el.innerHTML = `<b>HOP!</b><span>${UI.esc(text || "")}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// --- Démarrage ---------------------------------------------------------------------
// Lien d'un commerce partenaire (lu avant de nettoyer l'adresse)
const shopCode = new URLSearchParams(location.search).get("c");
// Adresse nettoyée (paramètres laissés par une ancienne version ou un rechargement forcé)
if (location.search) history.replaceState(null, "", location.pathname + location.hash);
I18N.apply();
fillCitySelects();
fillDefaults();
attachPlaces();
initHome();
renderAll();
if (shopCode) loadShop(shopCode);
// Connecté : profil à jour (nom, adresses) depuis le compte, puis ses courses de tous ses téléphones
Store.clientRefresh().catch(() => null).finally(loadMine);
loadSettings();

form.addEventListener("input", e => {
  if (/_other$/.test(e.target.name)) scheduleOtherGeocode();
  if (e.target.name === "promo") { state.promo = null; $("#promoMsg").textContent = ""; }
  syncVisibility();
  renderQuote();
});
// Choix d'un service ou d'un moment (hors « programmer ») : on passe à l'étape suivante
form.addEventListener("change", e => {
  if (e.target.name === "service" && e.isTrusted) state.svcChosen = true;   // choisi à la main : on n'y touche plus
  if (e.target.name === "service" || (e.target.name === "urgency" && e.target.value !== "programmee")) goNext(e.target.closest("fieldset"));
});
form.addEventListener("change", e => {
  if (/_city$/.test(e.target.name)) scheduleOtherGeocode();
  syncVisibility();
  renderQuote();
});
form.addEventListener("submit", submit);
// Photo d'un document : réduite sur le téléphone puis gardée jusqu'à l'envoi de la commande
$("#docsBox").addEventListener("change", async e => {
  const inp = e.target.closest("[data-doc]");
  if (!inp || !inp.files[0]) return;
  e.stopPropagation();
  try { docs[inp.dataset.doc] = await UI.docPhoto(inp.files[0]); } catch (ex) { return showError(t("errDocPhoto")); }
  renderDocs();
});
form.addEventListener("input", e => { if (PROFILE_FIELDS.includes(e.target.name)) rememberProfile(); });
["input", "change"].forEach(ev => form.addEventListener(ev, e => { if (["drop_me", "contact_name", "contact_phone"].includes(e.target.name)) syncDropMe(); }));
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
  const side = shopSide() || "from";
  state.shop = null;
  state.pick[side] = null; state[side + "Point"] = null;
  if (ac[side]) ac[side].reset();
  if (home.ac && home.ac[side]) home.ac[side].reset();
  form.elements[prefixOf(side) + "_address"].value = "";
  form.elements[prefixOf(side) + "_number"].value = "";
  setBrandMode(side, false);
  renderShopBanner();
  renderQuote();
  form.elements[prefixOf(side) + "_address"].focus();
});
// Pressing : on vient chercher les vêtements chez le client (→ pressing) ou on les ramène (pressing →)
$("#shopHero").addEventListener("click", e => {
  const b = e.target.closest("[data-shop-dir]");
  if (!b || b.dataset.shopDir === shopSide()) return;
  state.shopDir = b.dataset.shopDir;
  applyShop();
  renderQuote();
  saveDraft();
});
$("#coordsEdit").addEventListener("click", () => { $("#coordsBox").dataset.editing = "1"; renderAccount(); form.contact_name.focus(); });
$("#accountCard").addEventListener("click", e => {
  const ed = e.target.closest("[data-edit-addr]");
  if (ed) { const i = Number(ed.dataset.editAddr), a = Store.getAddresses()[i]; if (a) openAddrSheet(a.tag || "other", null, i); return; }
  const tg = e.target.closest("[data-edit-tag]");
  if (tg) {
    // Toucher le nom déjà choisi l'enlève ; « Autre nom » ouvre le champ du nom
    const li = tg.closest(".addr-edit"), on = !tg.classList.contains("btn-primary");
    li.querySelectorAll("[data-edit-tag]").forEach(x => x.classList.toggle("btn-primary", on && x === tg));
    li.querySelector(".ae-name").classList.toggle("hidden", !(on && tg.dataset.editTag === "other"));
    if (on && tg.dataset.editTag === "other") li.querySelector('[data-ae="name"]').focus();
    return;
  }
  if (e.target.closest("[data-ae-cancel]")) { state.editAddr = null; renderAccount(); return; }
  const sv = e.target.closest("[data-ae-save]");
  if (sv) {
    const li = sv.closest(".addr-edit"), v = f => li.querySelector(`[data-ae="${f}"]`).value.trim() || null;
    const sel = li.querySelector("[data-edit-tag].btn-primary"), tag = sel ? sel.dataset.editTag : null;
    const name = tag === "other" ? (v("name") || "").slice(0, 30) : null;
    if (tag === "other" && !name) { li.querySelector('[data-ae="name"]').focus(); return; }
    Store.updateAddress(Number(sv.dataset.aeSave), { tag, name, floor: v("floor"), apt: v("apt"), code: v("code"), note: v("note") });
    state.editAddr = null;
    renderSavedAddrs();
    renderAccount();
    return;
  }
  const b = e.target.closest("[data-del-addr]");
  if (!b) return;
  state.editAddr = null;
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
form.addEventListener("change", e => { const m = /^(pickup|dropoff)_kind$/.exec(e.target.name || ""); if (m) setKind(m[1], e.target.value); });
form.addEventListener("change", e => {
  if (e.target.name === "nearest_store" || e.target.name === "service") applyNearest();
  if (["has_tobacco", "has_alcohol", "service", "urgency", "date", "time"].includes(e.target.name)) syncAdult();
  if (e.target.name === "service") renderWhenHints();
});
form.shopping_list.addEventListener("input", () => {
  const v = form.shopping_list.value;
  if (TOBACCO_RE.test(v)) form.has_tobacco.checked = true;
  if (ALCOHOL_RE.test(v)) form.has_alcohol.checked = true;
  syncAdult();
});
$("#addStop").addEventListener("click", () => { if (state.stops.length < STOP.maxStops) { state.stops.push({ todo: "deposer" }); renderStops(); renderQuote(); $(`#stopsList [data-stop-addr="${state.stops.length - 1}"]`).focus(); } });
$("#stopsList").addEventListener("click", e => {
  const del = e.target.closest("[data-stop-del]");
  if (del) { state.stops.splice(Number(del.dataset.stopDel), 1); renderStops(); return renderQuote(); }
  const d = e.target.closest("[data-stop-do]");
  if (d) { state.stops[Number(d.dataset.stopDo)].todo = d.dataset.v; d.parentNode.querySelectorAll(".ch-chip").forEach(c => c.classList.toggle("on", c === d)); }
});
$("#stopsList").addEventListener("input", e => {
  const n = e.target.dataset.stopNo, note = e.target.dataset.stopNote;
  if (n != null) state.stops[Number(n)].number = e.target.value;
  if (note != null) state.stops[Number(note)].note = e.target.value;
});
document.addEventListener("click", e => { if (e.target.closest("[data-rules]")) { e.preventDefault(); openRules(); } });
$("#rulesClose").addEventListener("click", () => $("#rulesModal").classList.add("hidden"));
$("#rulesModal").addEventListener("click", e => { if (e.target.id === "rulesModal") $("#rulesModal").classList.add("hidden"); });
form.addEventListener("click", e => {
  const rd = e.target.closest("[data-ready]");
  if (rd) { state.phoneReady = Number(rd.dataset.ready); return renderPhone(); }
  const g = e.target.closest("[data-geo]");
  if (g) return useMyPosition(g.dataset.geo, g);
  const s = e.target.closest("[data-save-addr]");
  if (s) return askSaveTag(s.dataset.saveAddr, s);
  const tg = e.target.closest("[data-save-tag]");
  if (tg) saveCurrentAddress(tg.dataset.for, tg, tg.dataset.saveTag);
});
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

// Commande en cours gardée sur le téléphone (2 h) : si le client appelle le commerce et que le téléphone
// ferme HOP! pendant l'appel, il retrouve tout en revenant
const LS_DRAFT = "livraison.draft.v1";
let draftTimer = null;
function saveDraft(now) {
  clearTimeout(draftTimer);
  const write = () => {
    const values = {};
    [...form.elements].forEach(el => {
      if (!el.name || el.type === "file" || el.type === "password") return;
      if (el.type === "radio") { if (el.checked) values[el.name] = el.value; }
      else if (el.type === "checkbox") values[el.name] = el.checked;
      else values[el.name] = el.value;
    });
    try { localStorage.setItem(LS_DRAFT, JSON.stringify({ at: Date.now(), values, pick: state.pick, phoneReady: state.phoneReady, cart: state.cart })); } catch (e) { /* plein */ }
  };
  if (now === true) write(); else draftTimer = setTimeout(write, 300);
}
function clearDraft() { clearTimeout(draftTimer); try { localStorage.removeItem(LS_DRAFT); } catch (e) { /* ignore */ } }
function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { /* ignore */ }
  if (!d || Date.now() - d.at > 2 * 3600000 || new URLSearchParams(location.search).get("c")) return;
  // Une commande commencée chez un commerce (fiche, catalogue) ne revient pas toute seule à l'ouverture de l'appli
  if (d.pick && ["from", "to"].some(w => d.pick[w] && (d.pick[w].shopId || d.pick[w].partnerCode))) { clearDraft(); return; }
  ["from", "to"].forEach(w => { if (d.pick && d.pick[w] && !d.pick[w].partnerCode) onPlacePicked(w, d.pick[w], true); });
  Object.entries(d.values || {}).forEach(([k, v]) => {
    const el = form.elements[k];
    if (!el) return;
    if (el instanceof RadioNodeList || (el.length && el[0] && el[0].type === "radio")) {
      const r = form.querySelector(`input[name="${k}"][value="${CSS.escape(String(v))}"]`);
      if (r) r.checked = true;
    } else if (el.type === "checkbox") el.checked = !!v;
    else if (el.type !== "radio") el.value = v;
  });
  if (d.phoneReady != null) state.phoneReady = d.phoneReady;
  syncVisibility();
  renderQuote();
}
form.addEventListener("input", saveDraft);
form.addEventListener("change", saveDraft);
document.addEventListener("click", e => { if (e.target.closest("[data-shop-call], [data-ready]")) saveDraft(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden) saveDraft(true); });
try { restoreDraft(); } catch (e) { /* brouillon illisible : on repart de zéro */ }
// Fenêtre de l'appli client : l'espace livreur ouvert d'ici proposera d'installer sa propre appli
UI.markClientApp();

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
