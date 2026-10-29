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
const state = { pharma: {}, pharmaCat: "", shop: null, pro: null, promo: null, promoMsg: "", fromPoint: null, toPoint: null, mine: [], settings: { accepting: true }, pick: { from: null, to: null }, stops: [] };
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
  // Analytique : la commande ouverte (une fois par visite)
  if (v === "order") { let s = null; try { s = sessionStorage.getItem("hop.started"); sessionStorage.setItem("hop.started", "1"); } catch (e) { /* ignore */ } if (!s) UI.track("order_start"); }
  if (push) { history.pushState(null, "", v === "home" ? location.pathname : "#" + VIEW_HASH[v]); here = location.href; }
  window.scrollTo(0, 0);
  // La carte de l'accueil était cachée : elle reprend sa vraie taille (sinon des bandes restent vides)
  if (v === "home") requestAnimationFrame(() => { if (home.map) home.map.invalidateSize(); });
  return true;
}
// Un champ de l'adresse repliée en fiche doit être corrigé (erreur à l'envoi) : les champs reviennent
const nativeFocus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (o) {
  if (this.closest && this.closest(".drop-addr") && form.classList.contains("to-saved")) { state.toOpen = true; renderToSum(); }
  return nativeFocus.call(this, o);
};
// Tout ce qui « fait défiler jusqu'à » une partie de la page ouvre d'abord le bon écran
const nativeScrollIntoView = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (o) { setView(viewOf(this), true); return nativeScrollIntoView.call(this, o); };
function routeHash() {
  const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  setView(el ? viewOf(el) || "home" : "home");
  if (el && !/^(accueil|commander|mes-courses|infos)$/.test(el.id)) requestAnimationFrame(() => nativeScrollIntoView.call(el, { block: "start" }));
}
// Bouton retour du téléphone : il ferme d'abord la fenêtre ouverte (vérification des adresses, panier,
// fiche article…) et on reste sur le même écran, au lieu de changer de page sous la fenêtre
let here = location.href;
const MODAL_CLOSE = { checkModal: "#checkBack", itemSheet: "#itemClose", cartSheet: "#cartClose", ensModal: "#ensClose",
  noticeModal: "#noticeClose", addrSheet: "#asClose", rulesModal: "#rulesClose", reqModal: "#reqClose", doneModal: "#doneClose" };
function closeTopModal() {
  const open = [...document.querySelectorAll("body > .modal:not(.hidden)")].pop();
  if (!open) return false;
  const btn = MODAL_CLOSE[open.id] && document.querySelector(MODAL_CLOSE[open.id]);
  if (btn) btn.click(); else open.classList.add("hidden");
  return true;
}
function onBack() {
  const popped = location.href;
  // (si la fenêtre emmène ailleurs en se fermant, comme « Voir mes courses », on la laisse faire)
  if (closeTopModal()) { if (location.href === popped && popped !== here) history.pushState(null, "", here); return; }
  routeHash();
}
window.addEventListener("hashchange", () => { if (location.href !== here) routeHash(); here = location.href; });
window.addEventListener("popstate", () => { onBack(); here = location.href; });
routeHash();

// Exemples cliquables : ils pré-remplissent le formulaire
const EXAMPLES = [
  // Nouveautés en tête : boulangeries (petit-déjeuner) et pressing
  // Boulangerie : on achète pour le client, comme la pharmacie ou la makolet (même prix)
  { id: "bakery", icon: "🥐", set: { service: "achat" } },
  { id: "pressing", icon: "👔", set: { service: "colis" } },
  { id: "poste", icon: "📮", set: { service: "retrait", place_kind: "poste" } },
  // Pharmacie : « Acheter pour moi » ; la commande s'écrit dans le message au livreur (pas encore de catalogue)
  { id: "pharm", icon: "💊", set: { service: "achat" } },
  // Cigarettes & alcool : « Acheter pour moi » (18 ans et plus), produits à cocher
  { id: "tabac", icon: "🍾", set: { service: "achat" } },
  // Nouvelles rubriques à cocher : bébé & enfants, animaux, maison & dépannage (fleurs & cadeaux plus bas)
  { id: "baby", icon: "👶", set: { service: "achat" } },
  { id: "pets", icon: "🐾", set: { service: "achat" } },
  { id: "home", icon: "🔌", set: { service: "achat" } },
  { id: "resto", icon: "🍔", set: { service: "repas", urgency: "express" } },
  { id: "docs",  icon: "📄", set: { service: "colis", round_trip: true } },
  { id: "yad2",  icon: "🛋️", set: { service: "colis", size: "moyen" } },
  { id: "keys",  icon: "🔑", set: { service: "colis", urgency: "express" } },
  { id: "shop",  icon: "🛒", set: { service: "achat" } },
  // Fleurs & cadeaux : on achète pour le client (rayon à cocher), livré à l'heure choisie
  { id: "gift",  icon: "💐", set: { service: "achat", urgency: "programmee" } },
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

  const proPrice = b => b.pro ? `${money(CONFIG.pro.monthly)} / ${I18N.lang === "he" ? "חודש" : "mois"}` : typeof b.price === "object" ? b.price[I18N.lang] || b.price.fr : b.price;
  const pro = PROMOS.business.filter(b => !b.carnet || CONFIG.partners.carnet.offered).map(b => `<li><span>${UI.esc(b[I18N.lang] || b.fr)}</span><b>${UI.esc(proPrice(b))}</b></li>`).join("");
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
  // Les zones à part (zones industrielles, Kiryat HaSharon) juste sous « Dans Netanya »
  const A = P.areas, areaRows = A ? A.list.filter(z => z.city === home).map(z => `<div class="pg-row pg-area"><span>${UI.esc(I18N.cityName(home))} ⇄ ${UI.esc(z[I18N.lang] || z.fr)}
      <small class="muted">${UI.esc(t("pgAreaNear", { price: money(P.fixedFromHome[home] || P.base) }))}</small></span><b>${money(A.price)}</b></div>`).join("") : "";
  if (areaRows) { const first = $("#priceGrid .pg-row"); if (first) first.insertAdjacentHTML("afterend", areaRows); }

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
  const near = nearMode();
  form.classList.toggle("near-mode", near);
  $("#nearNote").classList.toggle("hidden", !near);
  if (near) $("#nearNote").textContent = t("nearNote", { shop: t("near_" + state.homeKind) });
  $("#pickupLegend").textContent = t(near ? "s2_near" : svc === "retrait" ? "s2_retrait" : svc === "achat" ? "s2_achat" : "s2");
  form.pickup_address.placeholder = svc === "retrait" ? t("placeAddrPh") : t("addressPh");
  $("#whenFields").classList.toggle("hidden", val("urgency") !== "programmee");
  // Commande chez une enseigne (HOP! Pro ou vitrine) : seulement l'essentiel (articles, adresse du client, heure, mot pour le livreur, paiement)
  const side = shopMode();
  form.classList.toggle("shop-mode", !!side);
  form.classList.toggle("shop-from", side === "from");
  form.classList.toggle("shop-to", side === "to");
  $("#sizeLegend").textContent = t(side ? "s5Shop" : "s5");
  const sched = val("urgency") === "programmee";
  // Livraison offerte par le commerce : pas de choix de paiement (le commerce paie le livreur par Bit)
  const gift = shopGift();
  $("#giftNote").classList.toggle("hidden", !gift);
  if (gift) {
    $("#giftNote").textContent = t("giftNote", { name: UI.bi(state.shop.name) });
    if (val("payment_method") !== "bit") form.querySelector('input[name=payment_method][value=bit]').checked = true;
    form.payer.value = "moi";
  }
  $("#payChoices").classList.toggle("hidden", gift);
  const payerOn = !gift && val("service") === "colis" && !shopMode();
  form.payer.closest("label").classList.toggle("hidden", !payerOn);
  if (!payerOn) form.payer.value = "moi";
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

// Commerce de la course (départ ou arrivée) : le livreur y passe à l'heure de départ, ou ~25 min après pour l'y déposer
function shopVisitAt(at) {
  const side = shopSide();
  return at && side ? (side === "to" ? new Date(at.getTime() + 25 * 60000) : at) : null;
}
// Le commerce est-il ouvert quand le livreur y passe ? (pas d'horaires renseignés : toujours oui)
function shopOpenAt(at) {
  const s = state.shop, when = shopVisitAt(at);
  if (!when || !s || !s.hours) return true;
  const st = UI.openState(s.hours, when);
  return !st || st.open;
}
const shopShortName = () => String(UI.bi(state.shop.name)).split(" · ")[0];
function scheduleError() {
  const u = val("urgency");
  if (!state.settings.accepting && u !== "programmee") return { key: "errNotAccepting" };
  // Pas de course chez un commerce fermé à cette heure-là
  if (!shopOpenAt(pickupDate())) return { key: "errShopClosed", vars: { name: shopShortName(), opens: openLabel(UI.openState(state.shop.hours)) } };
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

// Livraison offerte par le commerce : le client ne paie rien, le commerce paie toute la course au livreur
const shopGift = () => !!(proShopOn() && state.shop.shop_pays);
function currentQuote() {
  const q = baseQuote();
  if (!proShopOn()) return q;
  if (shopGift()) return Object.assign({}, q, { total: 0, course: q.total, gift: true,
    lines: q.lines.concat([{ key: "qShopGift", vars: { name: UI.bi(state.shop.name) }, amount: -q.total, discount: true }]) });
  // Le commerce paie sa part (12 − 2 = 10 ₪ de moins pour le client), sauf s'il a choisi « le client paie »
  const share = Math.min(q.total, state.shop.client_pays ? 0
    : Number(state.shop.shop_share != null ? state.shop.shop_share : CONFIG.pro.shopShare - CONFIG.pro.hopShare));
  if (!(share > 0)) return q;
  return Object.assign({}, q, { total: q.total - share, lines: q.lines.concat([{ key: "qShopShare", vars: { name: UI.bi(state.shop.name) }, amount: -share, discount: true }]) });
}
function baseQuote() {
  if (val("payment_method") === "carnet" && carnetOk()) {
    return { total: carnetUnit(), known: true, distanceKm: 0, lines: [{ key: "qCarnet", vars: { n: state.pro.credits - 1 }, amount: carnetUnit() }] };
  }
  return Pricing.computeQuote({
    fromCity: nearMode() ? cityOf("to") : cityOf("from"), toCity: cityOf("to"),
    fromPoint: nearMode() ? state.toPoint : state.fromPoint, toPoint: state.toPoint,
    service: val("service"), urgency: val("urgency"), size: val("size"), quickBuy: tobaccoOnly(), units: rayonUnits(),
    couriers: (home.nearby || []).filter(c => c.free),
    roundTrip: form.round_trip.checked, stops: state.stops.map(s => ({ onWay: stopOnWay(s) })),
    discount: currentDiscount()
  }, CONFIG);
}
// Seulement des cigarettes (« 2 Marlboro ») : achat express, pas de temps d'achats compté
function tobaccoOnly() {
  if (val("service") !== "achat") return false;
  const parts = shopListText().split(/[\n,;+]|\bet\b/).map(x => x.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(x => TOBACCO_RE.test(x));
}

// « Pourquoi 30 ₪ et pas 25 ? » : la course touche un quartier hors du centre
function areaWhy(q) {
  const l = q.lines.find(x => x.key === "qBaseArea");
  if (!l) return "";
  const z = (CONFIG.pricing.areas.list || []).find(x => x.id === l.vars.area);
  const base = CONFIG.pricing.fixedFromHome[l.vars.city] || CONFIG.pricing.base;
  return `<li class="area-why"><span>${UI.esc(t("qAreaWhy", { area: z ? z[I18N.lang] || z.fr : "", city: cityLabel(l.vars.city), price: money(l.amount), base: money(base) }))}</span></li>`;
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
    [fieldsetOf("#pickupLegend"), nearMode() ? rayonUnits() > 0 || shopListText().trim().length >= 3 : filled("pickup_address") && (filled("pickup_number") || !!(state.pick.from && state.pick.from.brand))],
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
// Le commerce a un lien de paiement ou un Bit : les articles lui sont payés d'avance (jamais avancés par le livreur)
// Commerce Pro sans paiement en ligne (ni lien, ni Bit) : le client commande et paie chez lui par WhatsApp,
// demande l'heure exacte où c'est prêt, puis commande ici la livraison (pas d'attente, pas de supplément)
const shopNoPay = () => !!((proShopOn() || shopDropOn()) && state.shop && !state.shop.pay_link && !state.shop.pay_bit);
function noPayBox(titleKey) {
  const sh = state.shop, name = UI.bi(sh.name), num = sh.whatsapp || sh.phone || "";
  const shown = num ? (String(num).replace(/\D/g, "").replace(/^972/, "0")) : "";
  return `<div class="nopay"><b>💬 ${UI.esc(t(titleKey || "nopayTitle", { name }))}</b>
    <p><i>1</i><span>${UI.esc(t("nopay1", { name }))}</span></p>
    <p><i>2</i><span>${UI.esc(t("nopay2"))}</span></p>
    <p><i>3</i><span>${UI.esc(t("nopay3"))}</span></p>
    ${num ? `<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${UI.esc(UI.waLink(num, t("nopayMsg", { name })))}">${UI.esc(t("nopayBtn", { name }))}</a>
      <small class="nopay-num">WhatsApp : <bdi>${UI.esc(shown)}</bdi></small>` : `<small>${UI.esc(t("nopayNoNum"))}</small>`}</div>`;
}
const shopPrepay = () => !!(proShopOn() && (state.shop.pay_link || state.shop.pay_bit) && (cartCount() || val("shop_order").trim()));
const cashGoods = () => (proShopOn() && cartCount() && !shopPrepay() ? cartTotal() : goodsPrepay() ? goodsBudget() : 0);
function renderCash() {
  const on = val("payment_method") === "cash";
  $("#cashBox").classList.toggle("hidden", !on);
  if (!on) return;
  const q = currentQuote(), goods = cashGoods(), total = Number(q.total) + goods;
  $("#cashTotal").textContent = t(goods ? (goodsPrepay() ? "cashTotalMax" : "cashTotalGoods") : "cashTotal", { total: money(total), goods: money(goods), course: money(q.total) });
  // (le billet choisi reste choisi ; s'il ne suffit plus, on le dit au moment d'envoyer)
  const cur = Number(form.cash_note.value) || 0;
  const notes = [0, 50, 100, 200].filter(n => n === 0 || n >= total || n === cur);
  // Redessiné seulement si ça change (sinon un toucher pendant la sortie d'un champ serait perdu)
  const chips = notes.map(n => `<button type="button" class="ch-chip${(Number(form.cash_note.value) || 0) === n ? " on" : ""}" data-cash-note="${n}">${n ? money(n) : UI.esc(t("cashExact"))}</button>`).join("");
  if ($("#cashNotes").dataset.html !== chips) { $("#cashNotes").innerHTML = chips; $("#cashNotes").dataset.html = chips; }
  const n = Number(form.cash_note.value) || 0;
  $("#cashRule").textContent = (n && n < total ? t("errCashNote") + " " : n ? t("cashChange", { change: money(n - total) }) + " " : "") + t("cashRule", { max: money(cashMax()) });
}
// Étape « Paiement » d'une commande chez un commerce : combien on paie au commerce, comment, et la livraison à part
function renderGoodsBox(q) {
  const box = $("#goodsBox");
  const on = proShopOn() && (cartCount() > 0 || !!val("shop_order").trim());
  box.classList.toggle("hidden", !on);
  if (!on) { box.innerHTML = ""; return; }
  const name = UI.bi(state.shop.name), goods = cartCount() ? cartTotal() : 0, cash = val("payment_method") === "cash";
  const bit = String(state.shop.pay_bit || "");
  const how = [state.shop.pay_link ? t("gbHowLink") : "", bit ? t("gbHowBit", { phone: bit }) : ""].filter(Boolean).join(t("gbHowOr"));
  const goodsHow = shopPrepay() ? t("gbPrepay", { name, how }) : cash && cashGoods() ? t("gbCash") : t("gbAsk", { name });
  box.innerHTML = `<b class="gb-h">${UI.esc(t("gbTitle"))}</b>
    <div class="gb-row"><span><b>${UI.esc(t("gbGoods", { name }))}</b><small>${UI.esc(goodsHow)}</small></span>${goods ? `<b class="gb-amt" dir="ltr">${money(goods)}</b>` : `<small class="gb-free">${UI.esc(t("gbGoodsFree", { name }))}</small>`}</div>
    <div class="gb-row"><span><b>${UI.esc(t("gbRide"))}</b><small>${UI.esc(t(cash ? "gbRideCash" : "gbRideHow"))}</small></span><b class="gb-amt" dir="ltr">${money(q.total)}</b></div>
    ${goods ? `<div class="gb-row gb-total"><span><b>${UI.esc(t("gbTotal"))}</b></span><b class="gb-amt" dir="ltr">${money(goods + Number(q.total))}</b></div>` : ""}
    <small class="gb-never">${UI.esc(t("gbNever"))}</small>`;
}
$("#cashNotes").addEventListener("click", e => {
  const b = e.target.closest("[data-cash-note]");
  if (!b) return;
  form.cash_note.value = b.dataset.cashNote;
  renderCash();
});

// --- Rayons à cocher (pharmacie, tabac & alcool, boulangerie, makolet) : pour les magasins qui n'ont pas
// encore leur catalogue. state.pharma = { "pharm:huggies|2": 1, "tabac:marlboro|0": 2 } (rayon:produit|variante → quantité)
const rayonRe = r => new RegExp(r.re, "i");
// Le rayon de la commande : celui de la tuile choisie ; sans tuile, celui du magasin de départ (d'après son nom)
function rayonOn() {
  if (!window.Rayons || proShopOn()) return null;
  const k = Rayons.byKind(state.homeKind);
  const p = state.pick.from, name = p ? String(p.brand || p.label || "") : "";
  const r = k || (!state.homeKind && name && Rayons.ALL.find(x => rayonRe(x).test(name))) || null;
  return r && val("service") === "achat" ? r : null;
}
const pharmaOn = () => !!rayonOn();
// Rayon choisi par sa tuile (pharmacie, tabac, makolet, bébé…) : le client ne choisit pas le magasin,
// le livreur va au plus proche de l'adresse de livraison (ouvert). Pas d'adresse de départ à remplir.
const nearMode = () => !!state.homeKind && RAYON_KINDS.includes(state.homeKind) && !state.shop && val("service") === "achat";
// Le magasin du rayon le plus proche de l'adresse de livraison (3 km au plus) : le point Waze du livreur
const NEAR_CAT = { pharm: "pharm", tabac: "kiosk", bakery: "breakfast", shop: "super", baby: "baby", pets: "pet", home: "home", gift: "flower" };
async function nearestShop(kind, at) {
  if (!window.Enseignes || !at || at.lat == null || !NEAR_CAT[kind]) return null;
  try {
    const items = await Promise.race([Enseignes.list(NEAR_CAT[kind], { lat: at.lat, lon: at.lon }, I18N.lang), new Promise(r => setTimeout(() => r([]), 6000))]);
    const best = (items || []).filter(x => x.lat != null).map(x => Object.assign({}, x, { km: Places.km(at, x) })).sort((a, b) => a.km - b.km)[0];
    return best && best.km <= 3 ? best : null;
  } catch (e) { return null; }
}
const NEAR_FR = { pharm: "Pharmacie", tabac: "Kiosque / tabac", bakery: "Boulangerie", shop: "Makolet / supermarché", baby: "Magasin bébé ou pharmacie", pets: "Animalerie", home: "Quincaillerie / bazar", gift: "Fleuriste" };
const phName = x => (I18N.lang === "he" ? x.he : x.fr) || x.fr || x.he || "";
const rayonPicked = r => Object.entries(state.pharma).filter(([k, q]) => q > 0 && k.startsWith(r.id + ":"));
// Produit + variante d'une clé « rayon:produit|variante » ; son prix indicatif et sa place (la variante peut avoir les siens)
function rayonEntry(r, k) {
  const [id, o] = k.slice(r.id.length + 1).split("|"), x = r.items.find(i => i.id === id);
  if (!x) return null;
  const v = x.opt && x.opt[Number(o)];
  // pb : prix caché (tabac), compté dans le total mais jamais affiché sur le produit
  return { x, v, p: (v && v.p) || x.p || null, pb: (v && v.pb) || x.pb || null, sz: (v && v.sz) || x.sz || 1 };
}
const PI = CONFIG.pricing.purchaseItems || { included: 10, max: 24, extraCourier: 1, extraHop: 1, topcase: 30 };
const rayonUnits = () => { const r = rayonOn(); return r ? rayonPicked(r).reduce((a, [, q]) => a + q, 0) : 0; };
const rayonPlace = () => { const r = rayonOn(); return r ? rayonPicked(r).reduce((a, [k, q]) => a + q * ((rayonEntry(r, k) || {}).sz || 1), 0) : 0; };
// Ce que coûteront les articles au magasin (fourchette, prix indicatifs ; le tabac n'a pas de prix)
function rayonGoods() {
  const r = rayonOn();
  if (!r) return null;
  let lo = 0, hi = 0, mid = 0, any = false;
  rayonPicked(r).forEach(([k, q]) => { const e = rayonEntry(r, k), p = e && (e.p || e.pb); if (p) { lo += p[0] * q; hi += p[1] * q; mid += priceMid(p) * q; any = true; } });
  return any ? { lo, hi, mid } : null;
}
// Un seul prix indicatif affiché (le milieu de la fourchette relevée en magasin) ; le maximum (hi) sert au budget
const priceMid = p => Math.round((Number(p[0]) + Number(p[1])) / 2);
const priceTxt = p => `${priceMid(p)} ₪`;
// « Acheter pour moi » sans partenaire : le client paie la course d'avance par Bit (ça l'engage), le livreur avance
// les articles (au plus le budget), envoie la photo du ticket, et le client lui envoie le montant exact avant la
// livraison (goods_after). Au plus 200 ₪ d'articles, 100 ₪ tant que le client a moins de 3 courses livrées (la base
// vérifie aussi). En espèces : le client paie la course + le ticket exact à la livraison.
const goodsPrepay = () => val("service") === "achat" && !proShopOn() && val("goods_mode") !== "self";
const goodsAfter = () => goodsPrepay() && val("payment_method") !== "cash";
const goodsCap = () => ((state.mine || []).filter(o => o.status === "livree").length >= 3 ? 200 : 100);
const goodsMin = () => { const g = rayonGoods(); return g ? Math.ceil(g.hi) : 0; };
const goodsBudget = () => Math.max(goodsMin(), Math.round(parseFloat(val("budget")) || 0));
const capVars = () => ({ cap: money(goodsCap()), more: goodsCap() < 200 ? t("gmCapNew") : "" });
function renderGoodsMode(q) {
  const box = $("#goodsModeBox"), achat = val("service") === "achat" && !proShopOn(), pre = achat && goodsPrepay();
  box.classList.toggle("hidden", !achat);
  box.classList.toggle("gm-pre", pre);
  if (!achat) return;
  // Le maximum des articles suit les produits cochés (prix indicatifs les plus hauts) tant que le client ne l'a pas changé
  // (jamais moins que les produits cochés : le chiffre affiché est celui payé)
  if (document.activeElement !== form.budget && (form.budget.dataset.manual !== "1" || (parseFloat(val("budget")) || 0) < goodsMin())) form.budget.value = goodsMin() || "";
  const sum = $("#goodsSum");
  if (!pre) { sum.innerHTML = `<p class="notice">${UI.esc(t("budgetNote"))}</p>`; return; }
  const b = goodsBudget(), cap = goodsCap(), over = b > cap, cash = val("payment_method") === "cash";
  // Espèces (même règle que les catalogues) : le livreur avance les articles, le client paie la course + le ticket exact
  // à la livraison ; total ≤ plafond des espèces, et seulement après une 1re course livrée
  const done = (state.mine || []).some(o => o.status === "livree");
  const cashErr = !cash ? "" : !done ? t("gmCashFirst") : b + Number(q.total) > cashMax() ? t("errCashMax", { max: money(cashMax()) }) : "";
  form.budget.closest("label").querySelector("span").textContent = t("gmGoods") + " (₪)";
  sum.innerHTML = `<small class="gm-how">${UI.esc(t(goodsMin() ? "gmGoodsD" : "gmGoodsFree"))}</small>
    <div class="gb-row"><span><b>${UI.esc(t("gmRide"))}</b></span><b class="gb-amt" dir="ltr">${money(q.total)}</b></div>
    <div class="gb-row gb-total"><span><b>${UI.esc(t(cash ? "gmTotalCash" : "gmTotalAfter"))}</b></span><b class="gb-amt" dir="ltr">${cash ? (b ? money(b + Number(q.total)) : "—") : money(q.total)}</b></div>
    <small class="gm-how">${UI.esc(cash ? t("gmHowCash") : t("gmHowAfter", { max: b ? money(b) : "—" }))}</small>
    ${cashErr ? `<small class="gm-cap bad">${UI.esc(cashErr)}</small>` : ""}
    <small class="gm-cap${over ? " bad" : ""}">${UI.esc(t(over ? "errGoodsCap" : "gmCap", capVars()))}</small>`;
}
function pharmaLines() {
  const r = rayonOn();
  if (!r) return [];
  return rayonPicked(r).map(([k, q]) => {
    const e = rayonEntry(r, k);
    if (!e) return null;
    // (le prix indicatif aide le livreur à voir un prix anormal ; « ×N » reste en fin de ligne : la base compte les articles)
    return `${e.x.e} ${phName(e.x)}${e.v ? " · " + phName(e.v) : ""}${e.p ? ` (≈ ${priceTxt(e.p)})` : ""} ×${q}`;
  }).filter(Boolean);
}
// Tabac / alcool cochés : les cases « 18 ans et plus » suivent
function rayonAdult() {
  const r = rayonOn();
  if (!r) return;
  const kinds = new Set(rayonPicked(r).map(([k]) => (Rayons.items(r).find(i => i.id === k.slice(r.id.length + 1).split("|")[0]) || {}).adult).filter(Boolean));
  // Coché par les produits du rayon, décoché quand ils partent (un autre rayon, un article enlevé) ; ce que le
  // client a coché lui-même reste
  const auto = state.adultAuto || (state.adultAuto = {});
  [["tabac", form.has_tobacco], ["alcool", form.has_alcohol]].forEach(([k, f]) => {
    if (kinds.has(k)) { if (!f.checked) { f.checked = true; auto[k] = true; } }
    else if (auto[k]) { f.checked = false; auto[k] = false; }
  });
  syncAdult();
}
// Ce que lit le livreur : les produits cochés, puis ce que le client a écrit
const shopListText = () => pharmaLines().concat(val("shopping_list").trim() ? [val("shopping_list").trim()] : []).join("\n");
const notesText = () => (val("service") === "achat" ? val("notes").trim() : pharmaLines().concat(val("notes").trim() ? [val("notes").trim()] : []).join("\n"));
function renderPharma() {
  const box = $("#pharmaBox"), r = rayonOn();
  box.classList.toggle("hidden", !r);
  if (!r) return;
  const cats = Rayons.cats(r), items = Rayons.items(r);
  if (!cats.some(c => c.id === state.pharmaCat)) state.pharmaCat = (cats[0] || {}).id;
  // Image d'un produit ou d'une catégorie : photo du patron, sinon pictogramme, sinon emoji
  const pic = x => (x.photo ? `<img src="${x.photo}" alt="" loading="lazy" />` : x.img ? `<img src="img/qc/${x.img}.webp" alt="" loading="lazy" />` : `<i>${x.e}</i>`);
  const picked = rayonPicked(r), n = picked.reduce((a, [, q]) => a + q, 0);
  const inCat = c => picked.filter(([k]) => (r.items.find(i => i.id === k.slice(r.id.length + 1).split("|")[0]) || {}).c === c).reduce((a, [, q]) => a + q, 0);
  const key = (x, o) => `${r.id}:${x.id}|${o}`;
  const html = `<div class="ph-head"><b>${UI.esc(phName(r.title))}</b><small>${UI.esc(t(val("service") === "achat" ? "phSub" : "phSubNotes"))}</small></div>
    ${rayonMeter(n)}
    <p class="ph-cats-h">${UI.esc(t("phCatsHint", { n: cats.length }))}</p>
    <div class="ph-cats">${cats.map(c => { const k = inCat(c.id); return `<button type="button" class="ph-cat${state.pharmaCat === c.id ? " on" : ""}" data-ph-cat="${c.id}" aria-pressed="${state.pharmaCat === c.id}">${pic(c)}<span>${UI.esc(phName(c))}</span>${k ? `<em>${k}</em>` : ""}</button>`; }).join("")}</div>
    <p class="ph-cur">${(cur => cur ? `${pic(cur)}<b>${UI.esc(phName(cur))}</b>` : "")(cats.find(c => c.id === state.pharmaCat))}</p>
    <div class="ph-list">${items.filter(x => x.c === state.pharmaCat).map(x => {
      const sel = Number((state.pharmaOpt || {})[r.id + ":" + x.id] || 0), k = key(x, x.opt ? sel : 0), q = state.pharma[k] || 0;
      const pr = (x.opt && x.opt[sel] && x.opt[sel].p) || x.p;
      return `<div class="ph-item${q ? " in" : ""}${x.img || x.photo ? "" : " no-img"}">${x.img || x.photo ? `<span class="ph-ico${x.photo ? " photo" : ""}">${pic(x)}</span>` : ""}<span class="ph-name"><b>${UI.esc(phName(x))}${x.adult ? ` <i class="ph-18">18+</i>` : ""}</b>${pr ? `<small class="ph-price">≈ ${priceTxt(pr)}</small>` : ""}
        ${x.opt ? `<select data-ph-opt="${r.id}:${x.id}" aria-label="${UI.esc(phName(x))}">${x.opt.map((o, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${UI.esc(phName(o))}${state.pharma[key(x, i)] ? ` (×${state.pharma[key(x, i)]})` : ""}</option>`).join("")}</select>` : ""}</span>
        ${q ? `<span class="cg-qty"><button type="button" data-ph-minus="${k}" aria-label="−">−</button><b>${q}</b><button type="button" data-ph-plus="${k}" aria-label="+">+</button></span>`
          : `<button type="button" class="cg-plus" data-ph-plus="${k}" aria-label="${UI.esc(t("cgAdd"))}">+</button>`}</div>`;
    }).join("")}</div>
    ${(i => { const prev = cats[i - 1], next = cats[i + 1], rtl = document.documentElement.dir === "rtl";
      // En bas de la liste : passer au rayon suivant (ou revenir) sans remonter
      return `<div class="ph-nav">${prev ? `<button type="button" class="ph-prev" data-ph-cat="${prev.id}" data-ph-nav="1">${rtl ? "›" : "‹"} ${UI.esc(phName(prev))}</button>` : "<span></span>"}
        ${next ? `<button type="button" class="ph-next" data-ph-cat="${next.id}" data-ph-nav="1">${UI.esc(t("phNext"))} : ${UI.esc(phName(next))} ${rtl ? "‹" : "›"}</button>` : ""}</div>`; })(cats.findIndex(c => c.id === state.pharmaCat))}
    ${n ? `<div class="ph-sum"><b>${UI.esc(t("phSum", { n }))}</b>${(g => g ? `<span class="ph-goods">${UI.esc(t("phGoods", { mid: g.mid }))}</span>` : "")(rayonGoods())}<small>${pharmaLines().map(UI.esc).join("<br>")}</small></div>` : ""}`;
  box.style.setProperty("--rc", r.color);
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
// Jauge : combien d'articles (10 compris, puis +2 ₪ l'article, 24 au plus) et la place prise dans le top case
function rayonMeter(n) {
  const place = Math.min(100, Math.round(rayonPlace() / PI.topcase * 100)), extra = Math.max(0, n - PI.included);
  const lvl = place >= 100 || n >= PI.max ? "full" : place >= 75 || n > PI.included ? "warn" : "ok";
  return `<div class="ph-meter ${lvl}"><div class="pm-row"><b>🛵 ${UI.esc(t("phTopcase", { p: place }))}</b><span>${UI.esc(t("phCount", { n, max: PI.max }))}</span></div>
    <div class="pm-bar"><i style="width:${place}%"></i></div>
    <small>${UI.esc(extra ? t("phExtra", { n: extra, each: PI.extraCourier + PI.extraHop, inc: PI.included }) : t("phIncluded", { inc: PI.included, each: PI.extraCourier + PI.extraHop, max: PI.max }))}</small>
    ${state.pharmaMsg ? `<p class="pm-msg">${UI.esc(state.pharmaMsg)}</p>` : ""}</div>`;
}
// Accueil : les rayons mis en avant (pharmacie, tabac & alcool, boulangerie, makolet), en cartes qui défilent
// Les changements du patron (produits ajoutés, photos, prix) : le cache local tout de suite, la base ensuite
function loadRayonsLive() {
  if (!window.Rayons) return;
  Rayons.apply(Store.rayonsCached());
  Store.rayonsLive().then(live => { if (!live) return; Rayons.apply(live); renderHomePharma(); if (rayonOn()) renderQuote(); }).catch(() => {});
}
function renderHomePharma() {
  if (!window.Rayons) return;
  $("#homePharma").innerHTML = `<div class="hp-row">${Rayons.ALL.map(r => {
    const on = state.homeKind === r.kind;
    return `<button type="button" class="hp-card${on ? " on" : ""}" data-pharma-go="${r.id}" style="--rc:${r.color}">
    <span class="hp-imgs">${r.show.map(k => `<img src="img/qc/${k}.webp" alt="" />`).join("")}</span>
    <span class="hp-txt"><em>${UI.esc(t(on ? "hpOnTag" : "hpTag"))}</em><b>${UI.esc(phName(r.card))}</b><small>${UI.esc(on ? t("hpOnSub") : phName(r.cardSub).replace("{n}", Rayons.items(r).length))}</small></span>
    <span class="hp-go">${UI.esc(t("hpGo"))} ›</span></button>`;
  }).join("")}</div>`;
}
function goPharma() {
  setView("order", true);
  renderQuote();
  requestAnimationFrame(() => { const b = $("#pharmaBox"); if (b && !b.classList.contains("hidden")) b.scrollIntoView({ block: "start", behavior: "smooth" }); else window.scrollTo(0, 0); });
}
// « Qu'est-ce qu'on livre ? » (tuiles) et cartes des rayons : on choisit, et on avance — d'abord le magasin
// le plus proche quand il y a une liste (pharmacie, boulangerie, poste…), puis la commande avec ses produits
function goKind(id) {
  // Même type de course, rien d'autre de choisi : on reprend la commande
  if (state.homeKind === id && !state.shop) return goPharma();
  // Sinon on repart de la liste : le commerce ouvert avant (la fiche Nini…) ou le magasin choisi avant
  // (une pharmacie pour une commande de pain…) est oublié
  if (state.shop) leaveShop(true);
  const f = state.pick.from;
  if (f && f.brand) clearHomeAddr("from", true);
  if (state.homeKind === id) state.homeKind = null;   // (applyKind le remet, sans l'enlever)
  // Pharmacie, tabac, makolet… : pas de magasin à choisir, on va droit aux produits (le livreur va au plus proche)
  if (RAYON_KINDS.includes(id)) { applyKind(id); return goPharma(); }
  state.pharmaGo = true;
  applyKind(id);
  if (state.pick.from || $("#ensModal").classList.contains("hidden")) { state.pharmaGo = false; goPharma(); }
}
$("#homePharma").addEventListener("click", e => {
  const b = e.target.closest("[data-pharma-go]");
  if (!b) return;
  goKind(Rayons.byId(b.dataset.pharmaGo).kind);
});
$("#ensClose").addEventListener("click", () => { if (state.pharmaGo) { state.pharmaGo = false; goPharma(); } });
$("#ensModal").addEventListener("click", e => { if (e.target.id === "ensModal" && state.pharmaGo) { state.pharmaGo = false; goPharma(); } });
$("#pharmaBox").addEventListener("click", e => {
  const c = e.target.closest("[data-ph-cat]"), plus = e.target.closest("[data-ph-plus]"), minus = e.target.closest("[data-ph-minus]");
  state.pharmaMsg = "";
  if (c) {
    state.pharmaCat = c.dataset.phCat;
    // Changé depuis le bas de la liste : on remonte au début du rayon
    if (c.dataset.phNav) requestAnimationFrame(() => { const h = $("#pharmaBox .ph-cur"); if (h) h.scrollIntoView({ block: "start", behavior: "smooth" }); });
  }
  else if (plus) {
    // 24 articles au plus, et tout doit tenir dans le top case
    const r = rayonOn(), e = r && rayonEntry(r, plus.dataset.phPlus);
    if (rayonUnits() >= PI.max) state.pharmaMsg = t("phMax", { max: PI.max });
    else if (e && rayonPlace() + e.sz > PI.topcase) state.pharmaMsg = t("phFull");
    else state.pharma[plus.dataset.phPlus] = (state.pharma[plus.dataset.phPlus] || 0) + 1;
  }
  else if (minus) { const k = minus.dataset.phMinus; state.pharma[k] = Math.max(0, (state.pharma[k] || 0) - 1); if (!state.pharma[k]) delete state.pharma[k]; }
  else return;
  if (plus) rayonAdult();
  // Les articles cochés tiennent dans le top case (la jauge le vérifie) : la case est cochée pour le client
  if (rayonUnits() > 0) form.fits_topcase.checked = true;
  renderPharma();
  renderQuote();
  saveDraft();
});
$("#pharmaBox").addEventListener("change", e => {
  const s = e.target.closest("[data-ph-opt]");
  if (!s) return;
  state.pharmaOpt = Object.assign(state.pharmaOpt || {}, { [s.dataset.phOpt]: Number(s.value) });
  saveDraft();
  renderPharma();
});
// « Acheter pour moi » : tant que le magasin n'a pas son catalogue sur HOP!, la commande s'écrit dans le message au livreur
function renderShopList() {
  const p = state.pick.from, name = p && p.brand ? UI.bi(String(p.brand).split(",")[0]) : "";
  const r = rayonOn();
  $("#shopListLabel").textContent = r ? phName(r.more) : name ? t("shopListAt", { name }) : t("shoppingList");
  // Chaque rayon a son exemple (pas « Acamol » dans Animaux) ; la note « pas de catalogue » n'a pas lieu d'être avec un rayon
  form.shopping_list.placeholder = r && r.ph ? phName(r.ph) : t("shoppingListPh");
  $("#noCatNote").textContent = name ? t("shopNoCat", { name }) : t("shopNoCatAny");
  $("#noCatNote").classList.toggle("hidden", !!r);
  // Tabac / alcool : seulement là où on en vend ; ordonnance : seulement en pharmacie (sans rayon : tout reste possible)
  const svcAchat = val("service") === "achat";
  if (r) rayonAdult();   // (à chaque rendu : changement de rayon, article ajouté ou enlevé)
  const noAdult = !svcAchat || (r && !Rayons.items(r).some(i => i.adult));
  document.querySelector(".adult-box").classList.toggle("hidden", noAdult);
  // Cases invisibles : rien ne doit rester coché (sinon la commande serait bloquée sans que le client voie pourquoi)
  if (noAdult && (form.has_tobacco.checked || form.has_alcohol.checked)) { form.has_tobacco.checked = form.has_alcohol.checked = form.adult_ok.checked = false; syncAdult(); }
  form.rx.closest("label").classList.toggle("hidden", !svcAchat || (r && r.id !== "pharm"));
}
function renderQuote() {
  renderShopBanner();
  renderShopList();
  renderPharma();
  const q = currentQuote();
  // Courses faites par HOP (ou commande chez un commerce Pro) : les articles au prix du magasin, en plus
  const goods = val("service") === "achat" || proShopOn();
  $("#quoteLines").innerHTML = q.lines.map(l =>
    `<li class="${l.discount ? "disc" : ""}"><span>${UI.esc(lineLabel(l))}</span><span dir="ltr">${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}</span></li>`).join("")
    // Pas de frais cachés : on le montre noir sur blanc
    + `<li class="zero"><span>${UI.esc(t("qService"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + `<li class="zero"><span>${UI.esc(t("qSmall"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + (goods && proShopOn() && cartCount() ? `<li class="goods"><span>${UI.esc(t("qItems", { total: money(cartTotal()), name: UI.bi(state.shop.name) }))}</span></li>` : "")
    // Achats payés au livreur : le montant des articles (au maximum) est dans le prix, comme la course
    + (goods && goodsPrepay() && !goodsAfter() ? `<li class="goods-amt"><span>${UI.esc(t("qGoodsMax"))}</span><span dir="ltr">${goodsBudget() ? money(goodsBudget()) : "—"}</span></li>` : "")
    + (goods && goodsAfter() ? `<li class="goods"><span>${UI.esc(t("qGoodsAfter", { max: goodsBudget() ? money(goodsBudget()) : "—" }))}</span></li>` : "")
    + (goods && !goodsAfter() && !(proShopOn() && cartCount()) ? `<li class="goods"><span>${UI.esc(t(proShopOn() ? "qGoodsPro" : goodsPrepay() ? "qGoodsPre" : "qGoods"))}</span></li>` : "")
    + (phoneOn() ? `<li class="goods"><span>${UI.esc(t("qGoodsPhone"))}</span></li>` : "")
    // Zone hors centre (Agamim, zones industrielles) : on explique tout de suite pourquoi ce n'est pas le prix habituel
    + areaWhy(q);
  // (achats en espèces : course + articles au maximum ; « ticket après » par Bit : la course seule d'avance)
  const all = Number(q.total) + (val("service") === "achat" && goodsPrepay() && !goodsAfter() ? goodsBudget() : 0);
  const total = (q.known ? "" : t("from") + " ") + money(all);
  $("#quoteTotal").textContent = total;
  $("#mobileTotal").textContent = total;
  // Barre du bas : c'est la livraison (les articles se paient à part, ou sont comptés au maximum)
  const withMax = all > Number(q.total), items = proShopOn() && cartCount() ? cartTotal() : 0;
  $("#mobileLbl").textContent = t(withMax ? "barMax" : "barDelivery");
  // Articles d'un rayon : la fourchette des prix indicatifs ; cigarettes (sans prix) : le prix du magasin, sans calcul
  const r0 = goods ? rayonOn() : null, est = r0 ? rayonGoods() : null;
  const unpriced = r0 ? rayonPicked(r0).some(([k]) => { const e = rayonEntry(r0, k); return e && !e.p && !e.pb; }) : false;
  const hint = withMax ? "" : items ? t("barItems", { total: money(items), name: UI.bi(state.shop.name) })
    : unpriced && r0.id === "tabac" ? t("barGoodsShop") : est && !unpriced ? t("barGoodsEst", { mid: est.mid }) : goods ? t("barGoodsHint") : "";
  $("#mobileHint").textContent = hint;
  $("#mobileHint").classList.toggle("hidden", !hint);
  $("#submitBtn").textContent = t("submit", { total: money(all) });
  const notes = [];
  if (!q.known) notes.push(t("qUnknown"));
  if (proShopOn() && state.shop.pay_ask) notes.push(t("askNote", { name: UI.bi(state.shop.name) }));
  if (val("service") === "achat") notes.push(goodsAfter() ? t("qPurchaseNoteAfter", { ride: money(q.total), goods: money(goodsBudget()) })
    : goodsPrepay() ? t("qPurchaseNotePre2", { ride: money(q.total), goods: money(goodsBudget()) }) : t("qPurchaseNote"));
  const st = state.settings;
  if (st.wait_step_price != null) notes.push(t("qWait", { free: st.wait_free_min, step: Number(st.wait_step_min) === 1 ? t("stepMin1") : t("stepMinN", { n: st.wait_step_min }), price: money(st.wait_step_price), max: money(st.wait_max) }));
  const sched = val("urgency") === "programmee";
  notes.push(val("payment_method") === "carnet" ? t("payNoteCarnet")
    : val("payment_method") === "bit" ? t(sched ? "payNoteBit" : "payNoteBitNow", { phone: CONFIG.bitPhone }) : t("payNoteCash2"));
  renderGoodsMode(q);
  renderCash();
  renderGoodsBox(q);
  // L'essentiel visible ; la règle d'attente (longue) derrière « En savoir plus »
  const main = notes.filter(n => !n.startsWith(t("qWait").slice(0, 12))), more = notes.filter(n => !main.includes(n));
  $("#quoteNote").innerHTML = `${UI.esc(main.join(" "))}${more.length ? ` <details class="q-more"${$("#quoteNote").querySelector("details[open]") ? " open" : ""}><summary>${UI.esc(t("qMore"))}</summary>${UI.esc(more.join(" "))}</details>` : ""}`;
  updateProgress();
  const err = scheduleError();
  $("#scheduleError").textContent = err ? t(err.key, err.vars) : "";
  $("#scheduleError").classList.toggle("hidden", !err);
  syncHome();
}

$("#doneNotif").addEventListener("click", async e => {
  e.currentTarget.disabled = true;
  const ok = await UI.clientPushSubscribe(e.currentTarget.dataset.token, true);
  e.currentTarget.textContent = t(ok ? "trNotifOn" : "trNotifDenied");
});

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
  // À la livraison, bâtiment, étage, appartement et code restent toujours affichés (même chez une enseigne :
  // un client peut habiter au-dessus, un bureau être au 3e) ; seul le départ chez une enseigne les cache
  if (which === "to") on = false;
  const pre = prefixOf(which);
  form.elements[pre + "_address"].closest(".fields").classList.toggle("brand-mode", !!on);
  if (on) DETAIL.forEach(k => { form.elements[pre + "_" + k].value = ""; });
}

function onPlacePicked(which, p, quiet) {
  // Partenaire avec catalogue (HOP! Pro) choisi dans la recherche ou sur la carte : on ouvre sa boutique
  const stay = pc => !(state.partners.find(x => x.code === pc) || {}).pro;
  if (which === "from" && p.partnerCode) { state.shopDir = "from"; loadShop(p.partnerCode, stay(p.partnerCode)); return; }
  if (which === "to" && p.partnerCode && p.kind && BOTH_WAYS.includes(p.kind)) { state.shopDir = "to"; loadShop(p.partnerCode, stay(p.partnerCode)); return; }
  state.pick[which] = p;
  // Le champ du formulaire porte l'adresse choisie avant le calcul du prix
  if (ac[which] && ac[which].pickedLabel() !== p.label) ac[which].setPicked(p.label);
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
  markAddrChips();
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
// « Pas de code d'entrée » : la case remplit le code (le livreur le lit sur sa fiche) et le bloque
const NO_CODE = /^(Pas de code|אין קוד)$/;
function syncNoCode() { form.dropoff_code.readOnly = form.dropoff_nocode.checked; }
form.dropoff_nocode.addEventListener("change", () => {
  form.dropoff_code.value = form.dropoff_nocode.checked ? t("noCodeVal") : NO_CODE.test(form.dropoff_code.value) ? "" : form.dropoff_code.value;
  syncNoCode();
});
// Conditions de livraison d'objets : pour tout envoi, sauf un repas ou une commande chez un commerce HOP! Pro
const needsRules = () => val("service") !== "repas" && !proShopOn() && !shopMode();
function openRules() { $("#rulesModal").classList.remove("hidden"); }

function applySavedAddr(which, a) {
  const pre = prefixOf(which);
  if (which === "to") state.toOpen = false;
  const label = [a.brand, a.street, cityLabel(a.cityId || a.city)].filter(Boolean).join(", ");
  const sel = form.elements[which + "_city"];
  if (a.cityId) sel.value = a.cityId; else { sel.value = OTHER; form.elements[which + "_other"].value = a.city || ""; }
  form.elements[pre + "_number"].value = a.number || "";
  DETAIL.forEach(k => { form.elements[pre + "_" + k].value = a[k] || ""; });
  if (pre === "dropoff") { form.dropoff_nocode.checked = NO_CODE.test(a.code || ""); syncNoCode(); }
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
  markAddrChips();
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
    const done = ok => { $("#checkModal").classList.add("hidden"); $("#checkOk").onclick = $("#checkBack").onclick = $("#checkClose").onclick = $("#checkModal").onclick = null; resolve(ok ? legs : null); };
    $("#checkOk").onclick = () => {
      if (rules && !$("#rulesOk").checked) { $("#rulesErr").classList.remove("hidden"); return; }
      legs.rulesOk = rules;
      done(true);
    };
    // Corriger, la croix ou un toucher à côté de la fenêtre : retour au formulaire
    $("#checkBack").onclick = $("#checkClose").onclick = () => done(false);
    $("#checkModal").onclick = e => { if (e.target.id === "checkModal") done(false); };
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
  if (!o.pickup_near) save("from", pf, o.from_city);
  save("to", pt, o.to_city);
  // La dernière adresse livrée : proposée d'office à la prochaine commande chez une enseigne
  const pre = prefixOf("to");
  try { localStorage.setItem(LS_LAST_DROP, addrKey({ street: pt ? (pt.streetName || pt.brand || "") : val(pre + "_address").trim().replace(/\s+\d+[^\s,]*$/, ""),
    number: val(pre + "_number").trim(), city: pt ? pt.city || o.to_city : o.to_city, apt: o[pre + "_apt"] })); } catch (e) { /* ignore */ }
}
const LS_LAST_DROP = "livraison.lastDrop.v1";
const addrKey = a => [a.street, a.number, a.city, a.apt].join("|").toLowerCase();
// Commande chez une enseigne : on livre d'office à la dernière adresse livrée, sinon à la Maison (le client peut changer)
function defaultDropAddr() {
  const list = Store.getAddresses().filter(a => !a.brand);
  let last = null;
  try { last = localStorage.getItem(LS_LAST_DROP); } catch (e) { /* ignore */ }
  return (last && list.find(a => addrKey(a) === last)) || list.find(a => a.tag === "home") || null;
}
// L'adresse enregistrée choisie est marquée (pleine, ✓) dans « Mes adresses »
const isSavedPick = (p, a) => !!(p && a && a.lat != null && p.lat === a.lat && p.lon === a.lon && String(p.housenumber || "") === String(a.number || ""));
function markAddrChips() {
  const list = Store.getAddresses();
  document.querySelectorAll(".saved-addrs").forEach(box => {
    const p = state.pick[box.dataset.for];
    box.querySelectorAll("[data-addr]").forEach(b => b.classList.toggle("on", isSavedPick(p, list[Number(b.dataset.addr)])));
  });
  renderToSum();
}
// Livraison à une adresse enregistrée : une fiche résumée au lieu de tous les champs (on la change dans « Modifier »)
function renderToSum() {
  const list = Store.getAddresses(), i = list.findIndex(a => isSavedPick(state.pick.to, a)), a = list[i];
  const on = !!a && !state.toOpen;
  form.classList.toggle("to-saved", on);
  $("#toSum").classList.toggle("hidden", !on);
  if (!on) return;
  const det = [a.kind ? t("kind_" + a.kind) : "", a.building ? t("building") + " : " + a.building : "", a.floor ? t("floor") + " : " + a.floor : "",
    NO_CODE.test(a.code || "") ? t("noCode") : a.code ? t("entryCode") + " : " + a.code : "", a.note || ""].filter(Boolean);
  const html = `<b>${addrChip(a)}</b>${det.length ? `<small>${det.map(UI.esc).join(" · ")}</small>` : ""}
    <span class="addr-sum-btns"><button type="button" class="btn btn-sm" data-sum-edit="${i}">${UI.esc(t("accEdit"))}</button>
      <button type="button" class="btn btn-sm btn-link" data-sum-other>📍 ${UI.esc(t("sumOther"))}</button></span>`;
  if ($("#toSum").dataset.html !== html) { $("#toSum").innerHTML = html; $("#toSum").dataset.html = html; }
}
$("#toSum").addEventListener("click", e => {
  const ed = e.target.closest("[data-sum-edit]");
  if (ed) { const a = Store.getAddresses()[Number(ed.dataset.sumEdit)]; if (a) openAddrSheet(a.tag || "other", "to", Number(ed.dataset.sumEdit)); return; }
  if (!e.target.closest("[data-sum-other]")) return;
  // Une autre adresse (sans l'enregistrer) : les champs reviennent, vides
  state.toOpen = true;
  state.pick.to = null; state.toPoint = null;
  if (ac.to) ac.to.reset();
  form.dropoff_address.value = ""; form.dropoff_number.value = "";
  DETAIL.forEach(k => { form.elements["dropoff_" + k].value = ""; });
  form.dropoff_note.value = ""; form.dropoff_nocode.checked = false; syncNoCode();
  setKind("dropoff", null); setBrandMode("to", false);
  renderQuote(); renderSaveBtns();
  form.dropoff_address.focus();
});

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
  // « 28/28-1 », « 28 א », « 28, appt 4 » : c'est le n° 28 qu'on cherche sur la carte
  number = (String(number || "").match(/\d+/) || [String(number || "")])[0];
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
  // Vitrine de démonstration (montrée aux commerces) : on peut tout essayer, sauf envoyer une vraie course
  if (state.shop && state.shop.demo) return showError(t("errDemoShop"));
  const near = nearMode();
  const fromCity = near ? cityOf("to") : cityOf("from"), toCity = cityOf("to");
  const required = [near ? null : "pickup_address", "dropoff_address", "contact_name", "contact_phone"].filter(Boolean);
  const missing = required.find(k => !val(k).trim());
  if (missing || !fromCity || !toCity) {
    if (missing) form.elements[missing].focus();
    return showError(t("errRequired"));
  }
  // Adresses : uniquement celles proposées par la carte (si le service répond)
  if (Places.serviceOk && ((!near && !ac.from.isPicked()) || !ac.to.isPicked())) {
    form.elements[!near && !ac.from.isPicked() ? "pickup_address" : "dropoff_address"].focus();
    return showError(t("errAddrPick"));
  }
  const badPhone = ["contact_phone", form.drop_me.checked ? null : "dropoff_phone", val("service") !== "retrait" && !near ? "pickup_phone" : null]
    .find(k => k && val(k).trim() && !phoneOk(val(k)));
  if (badPhone) { form.elements[badPhone].focus(); return showError(t("errPhone")); }
  const isBrand = w => !!(state.pick[w] && state.pick[w].brand && !needsNo(state.pick[w]));
  const missingNo = [["from", "pickup_number"], ["to", "dropoff_number"]].find(([w, k]) => !(near && w === "from") && !isBrand(w) && !val(k).trim());
  if (missingNo) { form.elements[missingNo[1]].focus(); return showError(t("errHouseNo")); }
  const err = scheduleError();
  if (err) return showError(t(err.key, err.vars));
  if (proShopOn() && !val("shop_order").trim() && !cartCount()) { form.shop_order.focus(); return showError(t(catalogOn() ? "errCart" : "errShopOrder", { name: UI.bi(state.shop.name) })); }
  if (shopSelf() && !/^[0-9]{3}$/.test(val("shop_ref").trim())) { form.shop_ref.focus(); return showError(t("errShopRef")); }
  if (phoneOn()) {
    if (!val("pickup_name").trim()) { form.pickup_name.focus(); return showError(t("errPhoneName")); }
    if (state.phoneReady == null) { $("#phReadyChips").scrollIntoView({ block: "center" }); return showError(t("errPhoneReady")); }
    if (!form.phone_paid.checked) { form.phone_paid.focus(); return showError(t("errPhonePaid")); }
  }
  if (val("service") === "achat" && shopListText().trim().length < 3) { form.shopping_list.focus(); return showError(t("errShopList")); }
  if (goodsPrepay() && !goodsBudget()) { form.budget.focus(); return showError(t("errGoodsBudget")); }
  if (goodsPrepay() && goodsBudget() > goodsCap()) { form.budget.focus(); return showError(t("errGoodsCap", capVars())); }
  if (val("service") === "achat" && !form.fits_topcase.checked) { form.fits_topcase.focus(); return showError(t("errTopcase")); }
  // Arrivée chez quelqu'un (pas un commerce) : tout ce qu'il faut pour trouver la porte, sinon pas d'envoi
  if (!(state.pick.to && state.pick.to.brand)) {
    const k = kindOf("dropoff"), flat = k === "appartement";
    const miss = !k ? "Kind" : (flat || k === "bureau") && !val("dropoff_floor").trim() ? "Floor"
      : flat && !val("dropoff_apt").trim() ? "Apt" : flat && !val("dropoff_code").trim() ? "Code" : null;
    if (miss === "Kind") { form.querySelector('[data-kind="dropoff"]').scrollIntoView({ block: "center" }); return showError(t("errToKind")); }
    if (miss) { form.elements["dropoff_" + miss.toLowerCase()].focus(); return showError(t("errTo" + miss)); }
  }
  // Un mot pour le livreur : seulement s'il manque une précision (un appartement sans étage ni n°)
  const vague = (near ? ["dropoff"] : ["pickup", "dropoff"]).find(pre => { const w = pre === "pickup" ? "from" : "to";
    return !(state.pick[w] && state.pick[w].brand) && kindOf(pre) === "appartement" && !val(pre + "_floor").trim() && !val(pre + "_apt").trim(); });
  if (vague && notesText().length < 3) { form.elements[vague + "_apt"].focus(); return showError(t("errNotes")); }
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
    const pf = near ? null : state.pick.from, pt = state.pick.to;
    const pNo = near ? "" : val("pickup_number").trim(), dNo = val("dropoff_number").trim();
    // (au plus proche : le texte pour le livreur, en français comme son appli)
    const pAddr = near ? `🏪 Au plus proche du client : ${NEAR_FR[state.homeKind] || "magasin"} (au choix du livreur, ouvert)` : fullAddress(pf, val("pickup_address").trim(), pNo);
    const dAddr = fullAddress(pt, val("dropoff_address").trim(), dNo);
    const [pick0, drop0] = await Promise.all([
      near ? null : pf ? exactPoint(pf, pNo, UI.cityFr(fromCity)) : locate(pAddr, fromCity, state.fromPoint),
      pt ? exactPoint(pt, dNo, UI.cityFr(toCity)) : locate(dAddr, toCity, state.toPoint)
    ]);
    // Le client vérifie ses adresses sur la carte (et corrige l'épingle s'il le faut)
    // Le nom du restaurant / commerce d'abord : « Smash It · דגניה 47 », pas seulement la rue
    const named = (p, a) => (p && p.brand && !a.includes(p.brand) ? `${p.brand} · ${a}` : a);
    // Au plus proche : on cherche tout de suite le magasin le plus proche de l'arrivée (le livreur reçoit son point Waze) ;
    // rien trouvé : Waze cherchera ce type de magasin autour du client
    const nearShop = near ? await nearestShop(state.homeKind, drop0) : null;
    const nearAddr = nearShop ? (`${nearShop.street || ""} ${nearShop.number || ""}`.trim() || nearShop.name) : "";
    const checked = await confirmAddresses(nearShop ? { lat: nearShop.lat, lon: nearShop.lon, exact: true } : pick0, drop0,
      nearShop ? `🏪 ${nearShop.name} · ${nearAddr} (${t("nearClosest")})` : named(pf, pAddr), named(pt, dAddr), fromCity, toCity);
    if (!checked) return;
    const pick = near && !nearShop ? null : checked.pick, drop = checked.drop;
    const pv = k => (near ? "" : val(k).trim());
    const order = {
      lang: I18N.lang,
      service: svc,
      urgency: val("urgency"),
      pickup_at: pickupDate().toISOString(),
      from_city: fromCity,
      pickup_address: nearShop ? nearAddr : pAddr,
      pickup_place: pf ? pf.brand : nearShop ? nearShop.name : null,
      pickup_near: near ? state.homeKind : null,
      pickup_learned: learnIt(pf),
      pickup_kind: svc !== "retrait" && !near ? kindOf("pickup") : null,
      dropoff_kind: kindOf("dropoff"),
      rules_accepted_at: checked.rulesOk ? new Date().toISOString() : null,
      pickup_building: svc !== "retrait" ? pv("pickup_building") || null : null,
      pickup_floor: svc !== "retrait" ? pv("pickup_floor") || null : null,
      pickup_apt: svc !== "retrait" ? pv("pickup_apt") || null : null,
      pickup_code: svc !== "retrait" ? pv("pickup_code") || null : null,
      pickup_exact: !!(pick && pick.exact),
      pickup_note: pv("pickup_note") || null,
      pickup_lat: pick && pick.lat != null ? pick.lat : null, pickup_lon: pick && pick.lon != null ? pick.lon : null,
      pickup_contact: svc !== "retrait" ? pv("pickup_contact") || null : null,
      pickup_phone: svc !== "retrait" && pv("pickup_phone") ? formatPhone(pv("pickup_phone")) : null,
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
      shopping_list: svc === "achat" ? shopListText() || null : null,
      purchase_min: svc === "achat" && CONFIG.pricing.purchase ? CONFIG.pricing.purchaseMinutes || 5 : null,
      budget: svc === "achat" ? (goodsPrepay() ? goodsBudget() : parseFloat(val("budget"))) || null : null,
      // Articles : payés d'avance au livreur (avec la course), ou réglés au magasin par le client lui-même
      goods_prepay: goodsPrepay(),
      goods_budget: goodsPrepay() ? goodsBudget() : 0,
      goods_after: goodsAfter(),
      goods_self_pay: svc === "achat" && !goodsPrepay(),
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
      price: q.gift ? q.course : q.total,
      promo_code: disc ? (disc.key === "qLoyalty" ? "FIDELITE" : disc.vars.code) : null,
      discount: disc ? -disc.amount : 0,
      payment_method: val("payment_method"),
      cash_note: val("payment_method") === "cash" ? Number(form.cash_note.value) || 0 : null,
      payer: val("payer"),
      notes: [shopDropOn() && cartCount() ? `🧺 ${t("cgDropNote", { name: state.shop.name })}\n` + cartLines().map(l => `${l.qty} × ${l.p.name}`).join("\n") : "", notesText()].filter(Boolean).join("\n") || null,
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
    // Articles à payer d'avance au commerce : on garde de quoi l'afficher après la commande
    const gp = shopPrepay() ? { name: state.shop.name, link: state.shop.pay_link || null, bit: state.shop.pay_bit || null, total: cartTotal() } : null;
    const saved = await Store.createOrder(order);
    // (la base marque la livraison offerte ; l'écran de confirmation le sait déjà)
    if (q.gift) saved.shop_pays = true;
    UI.track("order_sent", { order_ref: saved.ref, amount: Number(saved.price) || 0, shop_code: state.shop ? state.shop.code : null });
    try { sessionStorage.removeItem("hop.started"); } catch (e) { /* ignore */ }
    if (gp) Object.assign(saved, { goods_pay: "a_payer", items_total: gp.total || saved.items_total || 0 });
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
    // Deux paiements, dans l'ordre : ① les articles au commerce, tout de suite ; ② la livraison au livreur
    // Commerce sans lien ni Bit : on rappelle quand même combien payer pour les articles, et à qui
    // ② la livraison : au livreur, ou offerte par le commerce
    const gift2 = () => (saved.shop_pays ? t("gpStep2Gift", { name: UI.bi(state.shop.name) }) : t("gpStep2", { amount: money(saved.price) }));
    const goodsAsk = !gp && proShopOn() && cartCount() && saved.payment_method !== "cash"
      ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p><div class="goods-pay todo"><b class="gp-step">${UI.esc(t("gpStep1", { name: UI.bi(state.shop.name), amount: money(cartTotal()) }))}</b><small>${UI.esc(t("gbAsk", { name: UI.bi(state.shop.name) }))}</small></div><p class="gp-step2"><b>${UI.esc(gift2())}</b></p>` : "";
    $("#donePrepay").innerHTML = goodsAsk + (gp ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p>${UI.goodsPay(saved, gp)}<p class="gp-step2"><b>${UI.esc(gift2())}</b></p>` : "")
      + (saved.shop_pays ? `<p class="promo-msg ok">${UI.esc(t("giftNote", { name: UI.bi(state.shop.name) }))}</p>` : saved.payment_method === "bit"
        ? (saved.prepaid_required && !saved.direct_pay ? `<p class="promo-msg bad">${UI.esc(t("trPrepay"))}</p>` : "") + UI.bitPay(saved)
        : gp ? "" : UI.esc(t("donePrepay", { total: money(saved.price), phone: CONFIG.bitPhone, ref: saved.ref })));
    $("#donePrepay").classList.toggle("hidden", !gp && !goodsAsk && (saved.payment_method === "carnet" || (saved.payment_method !== "bit" && !saved.prepaid_required)));
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

    $("#doneText").innerHTML = UI.esc(t("doneText", { ref: saved.ref, total: money(saved.shop_pays ? 0 : UI.payTotal(saved)) }));
    $("#doneSub").textContent = t(Store.ONLINE ? "doneOnline" : "doneDemo") + (Store.docsFor(saved).length ? " " + t(docsFailed ? "errDocsUpload" : "doneDocs") : "") + (saved.handoff ? " " + t("doneHandoff") : "");
    $("#doneWa").href = UI.waLink(CONFIG.whatsapp, UI.orderText(saved));
    $("#doneWa").classList.toggle("hidden", Store.ONLINE);
    $("#doneTrack").href = UI.trackUrl(saved);
    // Notifications de la course sur ce téléphone : tout de suite si déjà autorisées, sinon un bouton
    $("#doneNotif").dataset.token = saved.token;
    const canNotif = window.Notification && Store.ONLINE && CONFIG.push;
    $("#doneNotif").classList.toggle("hidden", !canNotif || Notification.permission !== "default");
    if (canNotif && Notification.permission === "granted") UI.clientPushSubscribe(saved.token, false);
    const shareMsg = I18N.forLang(saved.lang, "trShareMsg", { url: UI.trackUrl(saved) });
    $("#doneShare").href = saved.dropoff_phone ? UI.waLink(saved.dropoff_phone, shareMsg) : UI.waShare(shareMsg);
    $("#doneModal").classList.remove("hidden");
    doneAuto(saved);
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
    form.dropoff_nocode.checked = false; syncNoCode();
    form.phone_order.checked = false; form.phone_paid.checked = false; form.fits_topcase.checked = false;
    form.querySelector('input[name=goods_mode][value=prepay]').checked = true; form.budget.dataset.manual = "";
    ["rx", "post_send", "p2p_sale", "sale_paid", "handoff"].forEach(k => { form.elements[k].checked = false; }); state.phoneReady = null;
    state.cart = {}; renderCatalog();
    state.pharma = {}; state.pharmaOpt = {};
    $("#coordsBox").dataset.editing = "";
    renderSavedAddrs();
    await loadMine();
  } catch (ex) {
    if (/welcome_used/.test(ex.message)) { state.welcomeUsed = true; refuseWelcome(); return; }
    if (/carnet_/.test(ex.message)) { if (state.pro) state.pro.credits = 0; syncVisibility(); return showError(t("errCarnet")); }
    if (/cash_max/.test(ex.message)) return showError(t("errCashMax", { max: money(cashMax()) }));
    if (/cash_first/.test(ex.message)) return showError(t("errCashFirst"));
    if (/demo_shop/.test(ex.message)) return showError(t("errDemoShop"));
    if (/cash_note_small/.test(ex.message)) return showError(t("errCashNote"));
    if (/client_blocked/.test(ex.message)) return showError(t("errBlocked"));
    if (/alcohol_hours/.test(ex.message)) return showError(t("errAlcoholHours"));
    if (/phone_name_required/.test(ex.message)) return showError(t("errPhoneName"));
    if (/phone_unpaid/.test(ex.message)) return showError(t("errPhonePaid"));
    if (/goods_pay_required/.test(ex.message)) return showError(t("errGoodsPay"));
    if (/goods_cap_/.test(ex.message)) { const cap = Number((/goods_cap_(\d+)/.exec(ex.message) || [])[1]) || goodsCap(); return showError(t("errGoodsCap", { cap: money(cap), more: cap < 300 ? t("gmCapNew") : "" })); }
    if (/goods_budget_required/.test(ex.message)) return showError(t("errGoodsBudget"));
    if (/goods_prepay_bit/.test(ex.message)) return showError(t("errGoodsBit"));
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
  // Message du commerce à ses clients (nouveautés, promo) : « Commander chez … »
  if (n.kind === "promo") return `<div class="notice-card promo${n.seen_at ? "" : " new"}">
    <span class="nt-ico">📣</span>
    <div class="nt-txt"><b>${UI.esc(t("ntPromo", { name: UI.bi(n.shop_name) }))}</b>${n.message ? `<p>${UI.esc(n.message)}</p>` : ""}<small>🕘 ${UI.esc(UI.fmtDateTime(n.created_at))}</small></div>
    <div class="nt-btns"><button type="button" class="btn btn-primary btn-sm" data-nt-shop="${UI.esc(n.id)}">${UI.esc(t("ntShop", { name: UI.bi(n.shop_name) }))}</button>
      <button type="button" class="btn btn-link btn-sm" data-nt-later="${UI.esc(n.id)}">${UI.esc(t("ntOk"))}</button></div>
  </div>`;
  return `<div class="notice-card${n.seen_at ? "" : " new"}">
    <span class="nt-ico">${UI.KIND_ICON[n.shop_kind] || "🏪"}</span>
    <div class="nt-txt"><b>${UI.esc(t("ntTitle", { name: n.shop_name }))}</b>
      ${n.message ? `<p>« ${UI.esc(n.message)} »</p>` : ""}<small>🕘 ${UI.esc(noticeWhen(n))}</small></div>
    <div class="nt-btns"><button type="button" class="btn btn-primary btn-sm" data-nt-book="${UI.esc(n.id)}">${UI.calIcon()} ${UI.esc(String(t("ntBook")).replace("📅", "").trim())}</button>
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
  const b = e.target.closest("[data-nt-book], [data-nt-later], [data-nt-shop], #noticeClose");
  if (!b) return;
  if (b.id === "noticeClose") { $("#noticeModal").classList.add("hidden"); return; }
  const n = noticeOf(b.dataset.ntBook || b.dataset.ntLater || b.dataset.ntShop);
  if (!n) return;
  if (b.dataset.ntBook) return bookNotice(n);
  noticeSeen(n);
  if (b.dataset.ntShop) { n.done = true; $("#noticeModal").classList.add("hidden"); renderNotices(); state.shopDir = ""; return loadShop(n.shop_code); }
  if (n.kind === "promo") n.done = true;
  $("#noticeModal").classList.add("hidden");
  renderNotices();
});
setInterval(() => { if (!document.hidden) loadNotices(); }, 60000);

// --- Compte client : téléphone + mot de passe, accepté tout de suite (sans e-mail de confirmation pour l'instant) ---
const loginUi = { mode: "create", open: false };
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
  box.innerHTML = `<details class="lg-fold"${loginUi.open ? " open" : ""}><summary><h3>${UI.esc(t("lgTitle"))}</h3><p class="muted small">${UI.esc(t("lgSub"))}</p></summary>
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
    </form></details>`;
}
async function accountSubmit(fn, msgEl, btn) {
  msgEl.textContent = ""; msgEl.classList.remove("err");
  btn.disabled = true;
  try { await fn(); return true; }
  catch (ex) { msgEl.textContent = accErr(ex); msgEl.classList.add("err"); return false; }
  finally { btn.disabled = false; }
}
$("#loginCard").addEventListener("toggle", e => { if (e.target.matches(".lg-fold")) loginUi.open = e.target.open; }, true);
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
  if (state.shop && proShopOn()) $("#shopOrderLabel").textContent = on ? t("cgNoteLabel", { name: UI.bi(state.shop.name) }) : t("spOrderLabel", { name: UI.bi(state.shop.name) });
  if (!on) { box.innerHTML = ""; box.dataset.html = ""; return; }
  const cats = state.catalog.categories.filter(c => cgProducts().some(p => p.category_id === c.id));
  const hasLoose = cgProducts().some(p => !cats.some(c => c.id === p.category_id));
  // Le menu entier par rubriques ; les onglets mènent à leur rubrique et suivent le défilement
  const sections = cats.map(c => ({ id: c.id, title: UI.bi(c.name), items: cgProducts().filter(p => p.category_id === c.id) }))
    .concat(hasLoose ? [{ id: "_", title: cats.length ? t("cgOther") : "", items: cgProducts().filter(p => !cats.some(c => c.id === p.category_id)) }] : []);
  const n = cartCount();
  // Façon appli de livraison : onglets collants, lignes d'articles avec grande image, panier flottant en bas
  // Les incontournables : les premiers articles du menu, en grandes cartes qui défilent
  const pic = p => (UI.safeImg(p.photo) ? `<img src="${UI.safeImg(p.photo)}" alt="" loading="lazy" />` : UI.itemArt(p.name, state.shop.kind));
  const top = cgProducts().filter(p => p.available).slice(0, 8);
  const html = `<b class="cg-title">${UI.esc(t("cgTitle", { name: UI.bi(state.shop.name) }))}</b>
    ${shopNoPay() ? noPayBox() : ""}
    ${cgProducts().length >= 5 ? `<div class="cg-top"><h4 class="cg-sec">${UI.esc(t("cgTop"))}</h4><div class="cg-top-row">${top.map(p => { const q = state.cart[p.id] || 0;
      return `<div class="cg-tcard${q ? " in" : ""}" data-cg-open="${UI.esc(p.id)}"><div class="cg-tpic">${pic(p)}
        <button type="button" class="cg-plus" data-cg-plus="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">${q ? `<b>${q}</b>` : "+"}</button></div>
        <span class="cg-price">${UI.money(p.price)}</span><b><bdi>${UI.esc(UI.bi(p.name))}</bdi></b></div>`; }).join("")}</div></div>` : ""}
    ${cats.length > 1 ? `<div class="cg-cats" role="tablist">${sections.filter(x => x.title).map(x =>
      `<button type="button" class="cg-tab" data-cg-cat="${UI.esc(x.id)}">${UI.esc(x.title)}</button>`).join("")}</div>` : ""}
    ${sections.map(sec => `${sec.title ? `<h4 class="cg-sec" data-cg-sec="${UI.esc(sec.id)}">${UI.esc(sec.title)}</h4>` : ""}<div class="cg-grid">${sec.items.map(p => {
      const q = state.cart[p.id] || 0, photo = UI.safeImg(p.photo);
      return `<div class="cg-item${p.available ? "" : " off"}${q ? " in" : ""}" data-cg-open="${UI.esc(p.id)}">
        <div class="cg-info"><b>${q ? `<em class="cg-n"><bdi>${q}×</bdi></em> ` : ""}<bdi>${UI.esc(UI.bi(p.name))}</bdi></b>${p.description ? `<small>${UI.esc(UI.bi(p.description))}</small>` : ""}<span class="cg-price">${UI.money(p.price)}</span></div>
        <div class="cg-pic">${photo ? `<img src="${photo}" alt="" loading="lazy" />` : UI.itemArt(p.name, state.shop.kind)}
        ${!p.available ? `<span class="cg-out">${UI.esc(t(UI.isService(state.shop) ? "cgOutSvc" : "cgOut"))}</span>`
          : q ? `<span class="cg-qty"><button type="button" data-cg-minus="${UI.esc(p.id)}" aria-label="−">−</button><b>${q}</b><button type="button" data-cg-plus="${UI.esc(p.id)}" aria-label="+">+</button></span>`
          : `<button type="button" class="cg-plus" data-cg-plus="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">+</button>`}</div>
      </div>`;
    }).join("")}</div>`).join("")}
    ${(state.shop.pay_link || state.shop.pay_bit) && proShopOn() ? `<div class="pay2">
        <b>${UI.esc(t("pay2Title"))}</b>
        <p><i>1</i><span>${UI.esc(t("pay2Goods", { name: UI.bi(state.shop.name), amount: n ? money(cartTotal()) : "" }))}</span></p>
        <p><i>2</i><span>${UI.esc(t("pay2Ride"))}</span></p>
        <small>${UI.esc(t("pay2Note"))}</small></div>`
      : shopNoPay() ? `<p class="cg-pay">${UI.esc(t("nopayShort", { name: UI.bi(state.shop.name) }))}</p>`
      : `<p class="cg-pay">${UI.esc(t("cgPayShop", { name: UI.bi(state.shop.name) }))}</p>`}
    ${n ? `<button type="button" class="cg-cart" data-cg-go><span class="cg-cart-n">${n}</span><b>${UI.esc(t("cgSee"))}</b><span>${UI.esc(money(cartTotal()))}</span></button>`
      : `<p class="cg-empty">${UI.esc(t("cgEmpty"))}</p>`}`;
  // Redessiné seulement si quelque chose a changé (un toucher n'est jamais perdu)
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  if (state.findItem) {
    const id = state.findItem; state.findItem = null;
    requestAnimationFrame(() => { const el = box.querySelector(`.cg-item[data-cg-open="${CSS.escape(id)}"]`) || box.querySelector(`[data-cg-open="${CSS.escape(id)}"]`); if (el) { el.classList.add("cg-found"); el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => el.classList.remove("cg-found"), 4000); } });
  }
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
  // « Voir la commande » : le panier s'ouvre (articles, quantités, total), puis « Continuer »
  if (b.dataset.cgGo != null) return openCart();
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
    <div class="it-txt"><h3><bdi>${UI.esc(UI.bi(p.name))}</bdi></h3><span class="cg-price">${UI.money(p.price)}</span>
      ${p.description ? `<p>${UI.esc(UI.bi(p.description))}</p>` : ""}
      ${p.available ? "" : `<p class="it-out">${UI.esc(t(UI.isService(state.shop) ? "cgOutSvc" : "cgOut"))}</p>`}</div>`;
  $("#itemQty").textContent = item.qty;
  $("#itemAdd").disabled = !p.available;
  $("#itemAdd").innerHTML = `<span>${UI.esc(t(inCart ? "itUpdate" : "itAdd"))}</span><b>${UI.esc(money(Number(p.price) * item.qty))}</b>`;
  $("#itemDel").classList.toggle("hidden", !inCart);
}
// Le panier : modifier les quantités, voir le total, puis continuer vers l'adresse ou le récapitulatif
function openCart() {
  if (!cartCount()) return;
  renderCart();
  $("#cartSheet").classList.remove("hidden");
}
function renderCart() {
  const lines = cartLines();
  if (!lines.length) { $("#cartSheet").classList.add("hidden"); return; }
  $("#cartTitle").textContent = t("csTitle", { name: state.shop ? UI.bi(state.shop.name) : "" });
  $("#cartBody").innerHTML = lines.map(({ p, qty }) => {
    const photo = UI.safeImg(p.photo);
    return `<div class="cs-row"><span class="cs-pic">${photo ? `<img src="${photo}" alt="" />` : UI.itemArt(p.name, state.shop && state.shop.kind)}</span>
      <span class="cs-txt"><b><bdi>${UI.esc(UI.bi(p.name))}</bdi></b><small>${UI.esc(money(Number(p.price) * qty))}</small></span>
      <span class="it-qty cs-qty"><button type="button" data-cs-minus="${UI.esc(p.id)}" aria-label="−">${qty > 1 ? "−" : "🗑"}</button><b>${qty}</b><button type="button" data-cs-plus="${UI.esc(p.id)}" aria-label="+">+</button></span></div>`;
  }).join("");
  $("#cartSum").textContent = money(cartTotal());
  $("#cartNote").textContent = t(shopPrepay() ? "csNotePrepay" : "csNote", { name: state.shop ? UI.bi(state.shop.name) : "" });
}
$("#cartSheet").addEventListener("click", e => {
  if (e.target.id === "cartSheet" || e.target.closest("#cartClose") || e.target.closest("#cartMore")) return $("#cartSheet").classList.add("hidden");
  const plus = e.target.closest("[data-cs-plus]"), minus = e.target.closest("[data-cs-minus]");
  if (plus || minus) {
    const id = (plus || minus).dataset[plus ? "csPlus" : "csMinus"];
    state.cart[id] = Math.max(0, Math.min(50, (state.cart[id] || 0) + (plus ? 1 : -1)));
    renderCatalog(); renderQuote(); saveDraft(); renderCart();
    return;
  }
  if (e.target.closest("#cartGo")) {
    $("#cartSheet").classList.add("hidden");
    // La suite : l'adresse de livraison, ou le récapitulatif si tout est rempli
    const next = stepStates().slice(1).find(([fs, ok]) => fs && !ok && fs !== $("#shopOrderBox") && fs.offsetParent);
    (next ? next[0] : $("#summary")).scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
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
function shopInfo(s, noWa) {
  if (!s || !(s.whatsapp || s.about || s.about_he || (s.hours && s.hours.length))) return "";
  const days = DAYS[I18N.lang] || DAYS.fr, today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();
  const fmt = h => (h ? String(h).split(",").map(r => r.replace("-", "–")).join(" · ") : t("shClosed"));
  const hours = (s.hours || []).slice().sort((a, b) => a.d - b.d);
  const open = hours.length && shopOpenNow(hours);
  const wa = noWa ? "" : String(s.whatsapp || "").replace(/\D/g, "");
  const waText = encodeURIComponent(t("shWaHello", { name: UI.bi(s.name) }));
  return `<div class="sh-info">
    ${UI.shopText(s, "about") ? `<p class="sh-about">${UI.esc(UI.shopText(s, "about"))}</p>` : ""}
    <div class="sh-lines">
      ${s.address ? `<div class="sh-line"><span>📍</span><b><bdi>${UI.esc(s.address)}</bdi>${s.city ? ", " + UI.esc(cityLabel(cityIdOf(s.city, s) || s.city)) : ""}</b></div>` : ""}
      ${hours.length ? `<div class="sh-line"><span>🕘</span><b class="sh-open ${open ? "on" : "off"}">${UI.esc(openLabel(UI.openState(hours)) || t(open ? "shOpenNow" : "shClosedNow"))}</b>
        <small>${UI.esc(t("shToday"))} : ${UI.esc(fmt((hours.find(x => Number(x.d) === today) || {}).h))}</small></div>` : ""}
    </div>
    ${wa ? `<a class="sh-wa" href="https://wa.me/${UI.esc(wa)}?text=${waText}" target="_blank" rel="noopener">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8C29 8.7 23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.2 16 5.2S26.9 10 26.9 15.8 22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a9 9 0 0 1-2.6-1.6 9.8 9.8 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.6 4.9c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>
        <span><b>${UI.esc(t("shWa"))}</b><small>${UI.esc(t("shWaSub", { name: UI.bi(s.name) }))}</small></span></a>` : ""}
    ${hours.length ? `<details class="sh-hours"><summary>${UI.esc(t("shAllHours"))}</summary><table>${hours.map(x =>
      `<tr class="${Number(x.d) === today ? "today" : ""}"><th>${UI.esc(days[x.d])}</th><td>${UI.esc(fmt(x.h))}</td></tr>`).join("")}</table></details>` : ""}
  </div>`;
}
// Photos de présentation de l'enseigne (8 au plus) : une rangée qui défile, en grand au toucher
const shopPhotos = s => (Array.isArray(s && s.gallery) ? s.gallery : []).map(UI.safeImg).filter(Boolean).slice(0, 8);
function shopGallery(s) {
  const g = shopPhotos(s);
  return g.length ? `<div class="sh-gallery" role="list">${g.map((src, i) => `<button type="button" role="listitem" data-sh-photo="${i}" aria-label="${UI.esc(t("shPhoto", { n: i + 1 }))}"><img src="${src}" alt="" loading="lazy" /></button>`).join("")}</div>` : "";
}
// Le commerce est-il dans la course (au départ ou à l'arrivée) ?
const shopSide = () => (shopPicked() ? "from" : state.shop && state.pick.to && state.pick.to.shopId === state.shop.id ? "to" : "");
// Toute enseigne choisie (HOP! Pro ou vitrine comme Bloovi) : son adresse est connue, pas de champs à remplir
const shopMode = () => (state.shop ? shopSide() : "");
function renderShopBanner() {
  const side = shopSide(), on = !!side;
  $("#shopBanner").classList.toggle("hidden", !on);
  // Commerce HOP! Pro : sa vitrine en haut de la commande (photo, logo, accroche), comme dans les applis de livraison
  const s = state.shop, hero = $("#shopHero"), showHero = !!(on && s && (s.pro || s.logo || s.cover || s.promo || shopPhotos(s).length));
  hero.classList.toggle("hidden", !showHero);
  if (showHero) {
    const cover = UI.safeImg(s.cover) || UI.demoImg(s, "cover"), logo = UI.safeImg(s.logo) || UI.demoImg(s, "logo"), kinds = t("shKinds") || {};
    const initials = String(UI.bi(s.name) || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    // Enseigne sans commande en ligne (vitrine) : sa présentation, puis comment commander chez elle par WhatsApp
    const vit = !s.pro && !s.demo && side === "from";
    const html = `${s.demo ? `<p class="sh-demo">🎬 <span>${UI.esc(t("shDemo"))} <a href="commerce.html?demo=${UI.esc(String(s.code).split("-")[1].toLowerCase())}">${UI.esc(t("shDemoSpace"))}</a></span></p>` : ""}<div class="sh-cover pk-${UI.esc(s.kind || "autre")}"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}</div>
      <div class="sh-row"><span class="pc-logo sh-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
        <div class="sh-txt"><b>${UI.esc(UI.bi(s.name))}</b>${isKosher(s) ? kosherTag("k-lg") : ""}<small>${UI.esc(UI.shopText(s, "tagline") || kinds[s.kind] || "")}</small></div></div>
      ${UI.openState(s.hours) ? `<p class="sh-status ${UI.openState(s.hours).open ? "on" : "off"}"><i></i>${UI.esc(openLabel(UI.openState(s.hours)))}</p>` : ""}
      ${UI.shopText(s, "promo") ? `<p class="sh-promo"><i>📣</i><span>${UI.esc(UI.shopText(s, "promo"))}</span></p>` : ""}
      ${s.pro ? `<div class="pc-tags sh-tags"><em>${s.shop_pays ? "🎁 " + UI.esc(t("scGift")) : "🛵 " + UI.esc(t("proDelivery", { price: money(proPrice(s)) }))}</em><em>🧾 ${UI.esc(t("qZero"))} ${UI.esc(t("qService").toLowerCase())}</em></div>` : ""}
      ${state.shopSched && val("urgency") === "programmee" ? `<p class="sh-sched">🗓️ ${UI.esc(t("shSched", { name: UI.bi(s.name), when: UI.fmtDateTime(state.shopSched) }))}</p>` : ""}
      ${shopTwoWay() ? `<div class="sh-dir" role="group">
        <button type="button" class="${side === "to" ? "on" : ""}" data-shop-dir="to"><i>🧺</i><span><b>${UI.esc(t("shDirTo"))}</b><small>${UI.esc(t("shDirToSub", { name: UI.bi(s.name) }))}</small></span></button>
        <button type="button" class="${side === "from" ? "on" : ""}" data-shop-dir="from"><i>👔</i><span><b>${UI.esc(t("shDirFrom"))}</b><small>${UI.esc(t("shDirFromSub", { name: UI.bi(s.name) }))}</small></span></button>
      </div>` : ""}
      ${shopGallery(s)}
      ${vit ? shopInfo(s, true) + noPayBox("vitTitle") : shopInfo(s)}`;
    if (hero.dataset.html !== html) { hero.innerHTML = html; hero.dataset.html = html; }
  }
  if (on) $("#shopBannerText").textContent = t(side === "to" ? "shBannerTo" : "shBanner", { name: UI.bi(state.shop.name) });
  const pro = proShopOn();
  // Commerce à l'arrivée (pressing : on lui apporte les vêtements) : le catalogue seul, sans commande à préparer
  $("#shopOrderBox").classList.toggle("hidden", !pro && !shopDropOn());
  form.shop_order.closest("label").classList.toggle("hidden", !pro);
  $("#shopOrderNote").classList.toggle("hidden", !pro);
  $("#shopRefBox").classList.toggle("hidden", !shopSelf());
  if (pro) {
    $("#shopOrderLabel").textContent = t("spOrderLabel", { name: UI.bi(state.shop.name) });
    $("#shopOrderNote").textContent = t("spOrderNote", { name: UI.bi(state.shop.name) });
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
  if (dir === "from" && !state.pick.to) { const d = defaultDropAddr(); if (d) applySavedAddr("to", d); }
  if (other === "from" && !state.pick.from) setTimeout(() => form.pickup_address.focus({ preventScroll: true }), 300);
  // Commerce fermé maintenant : la course est programmée d'office pour son ouverture (le client peut changer)
  const st = UI.openState(s.hours), at = UI.nextOpenDate(st);
  if (!at) state.shopSched = null;
  if (at && (val("urgency") === "asap" || state.shopSched)) {
    const d = new Date(at.getTime() + 15 * 60000);
    form.elements.urgency.value = "programmee";
    form.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    form.time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    state.shopSched = d;
  }
  // Enseigne : le service va de soi (repas pour un restaurant, sinon une course simple)
  { form.elements.service.value = s.kind === "restaurant" ? "repas" : "colis"; state.svcChosen = true; }
  syncVisibility(); renderQuote();
  renderShopBanner();
  renderWhenHints();
}

async function loadShop(code, stay) {
  try { state.shop = await Store.shopByCode(code); } catch (e) { state.shop = null; }
  if (!state.shop) return;
  UI.track("shop_view", { shop_code: state.shop.code });
  // Sur le téléphone du commerce : son carnet pro
  const token = Store.shopTokenFor(state.shop.code);
  if (token) {
    try {
      const d = await Store.shopDashboard(token);
      if (d && d.shop) state.pro = { token, credits: Number(d.shop.credits || 0) };
    } catch (e) { /* pas de carnet */ }
  }
  applyShop();
  try { sessionStorage.setItem(SS_SHOP, JSON.stringify({ code: state.shop.code, dir: state.shopDir || "" })); } catch (e) { /* ignore */ }
  const cat = loadCatalogFor(state.shop);
  if (!stay) setTimeout(() => $("#commander").scrollIntoView({ behavior: "smooth" }), 300);
  return cat;
}
// Commerce ouvert dans cet onglet : un rechargement de la page le rouvre (pas une nouvelle ouverture de l'appli)
const SS_SHOP = "livraison.openShop.v1";
const forgetOpenShop = () => { try { sessionStorage.removeItem(SS_SHOP); } catch (e) { /* ignore */ } };

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
  // Enseigne fermée maintenant : seulement « Programmer » (à son heure d'ouverture)
  const shut = !!(state.shop && shopSide() && !shopOpenAt(new Date())), asapInput = form.querySelector('input[name=urgency][value=asap]');
  if (shut) { const lb = t("shClosedShort", { name: shopShortName() }); $("#asapSmall").textContent = lb; ex.textContent = lb; }
  exInput.disabled = !exOk || shut;
  exInput.closest(".choice").classList.toggle("disabled", !exOk || shut);
  asapInput.disabled = shut;
  asapInput.closest(".choice").classList.toggle("disabled", shut);
  if (shut && !form.querySelector('input[name=urgency][value=programmee]').checked) {
    form.querySelector('input[name=urgency][value=programmee]').checked = true;
    syncVisibility(); renderQuote();
  } else if (!exOk && exInput.checked) asapInput.checked = true;
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
// (les rayons à cocher en premier — pharmacie, tabac & alcool, boulangerie, makolet : c'est nouveau, il faut les voir)
const RAYON_KINDS = ["pharm", "tabac", "bakery", "shop", "baby", "pets", "home", "gift"];
const HOME_KINDS = EXAMPLES.filter(e => !e.set.to_city).sort((a, b) => (RAYON_KINDS.indexOf(a.id) + 1 || 99) - (RAYON_KINDS.indexOf(b.id) + 1 || 99));
const homeInput = which => $(which === "from" ? "#homeFrom" : "#homeTo");
const homeNo = which => $(which === "from" ? "#homeFromNo" : "#homeToNo");
const isRtl = () => document.documentElement.dir === "rtl";
// ✕ : effacer l'adresse d'un geste (le texte, le numéro, le point sur la carte), et on peut retaper tout de suite
const syncHomeX = which => $(`[data-hclear="${which}"]`).classList.toggle("hidden", !homeInput(which).value);
function clearHomeAddr(which, quiet) {
  const input = homeInput(which), pre = prefixOf(which);
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  state.pick[which] = null; state[which + "Point"] = null;
  form.elements[pre + "_address"].value = ""; form.elements[pre + "_number"].value = ""; homeNo(which).value = "";
  if (home.ac[which]) home.ac[which].reset();
  if (ac[which]) ac[which].reset();
  setBrandMode(which, false);
  renderQuote(); renderShopBanner(); renderSaveBtns(); syncHome();
  if (!quiet) input.focus();
}
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
    input.addEventListener("input", () => { form.elements[pre + "_address"].value = input.value; syncHomeX(which); renderQuote(); });
    $(`[data-hclear="${which}"]`).addEventListener("click", () => clearHomeAddr(which));
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
      if (home.map) home.map.flyTo([pos.lat, pos.lon], Math.max(home.map.getZoom(), 17), { duration: 0.6 });
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
    if (k) return goKind(k.dataset.kind);
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
    if (b) return pickEnseigne(b.dataset.ensPick, ens.shown[Number(b.dataset.i)]);
    const sh = e.target.closest("[data-ens-shop]");
    if (sh) { $("#ensModal").classList.add("hidden"); state.shopDir = ""; loadShop(sh.dataset.ensShop); }
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
  // Commerces toujours à jour, même dans une appli ouverte depuis des heures : ceux qui ouvrent ou ferment,
  // les nouveaux partenaires et leurs vitrines. Relus à chaque retour dans l'appli et toutes les 5 min ;
  // l'écran n'est redessiné que si quelque chose a changé (rien ne bouge sous le doigt du client).
  // « Ouvert / Fermé » suit l'heure : les vitrines sont recalculées chaque minute.
  let shopsAt = Date.now(), hiddenAt = 0;
  const refreshShops = async () => {
    shopsAt = Date.now();
    const [dir, sc] = await Promise.all([Store.shopsDirectory().catch(() => null), Store.shopsShowcase().catch(() => null)]);
    if (dir && JSON.stringify(dir.filter(x => x.lat != null)) !== JSON.stringify(state.partners)) state.partnersReady = loadPartners();
    if (sc && JSON.stringify(sc) !== JSON.stringify(state.showcase)) loadShowcase(); else renderShowcase();
  };
  setInterval(() => { if (!document.hidden) renderShowcase(); }, 60000);
  setInterval(() => { if (!document.hidden) refreshShops(); }, 5 * 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - shopsAt > 15000) refreshShops();
    if (hiddenAt && Date.now() - hiddenAt > 5 * 60000) checkNewVersion();
    // Retour dans l'appli après 30 min ou plus : la pub suivante, comme à l'ouverture
    if (hiddenAt && Date.now() - hiddenAt > 30 * 60000) setTimeout(showAppPromo, 900);
  });
  window.addEventListener("pageshow", e => { if (e.persisted) refreshShops(); });
  if (kindParam && EXAMPLES.some(x => x.id === kindParam && !x.set.to_city)) setTimeout(() => goKind(kindParam), 400);
  else setTimeout(showAppPromo, 1500);
  // Sur téléphone, la bulle « Nous écrire » remonte au-dessus du bouton Commander
  if ("IntersectionObserver" in window) new IntersectionObserver(es => document.body.classList.toggle("in-home", es[0].isIntersecting)).observe($("#homeSheet"));
}

// Pub plein écran à l'ouverture de l'appli (celles que le patron a activées dans son panel) : une autre à chaque
// ouverture, à tour de rôle. Jamais par-dessus une commande en cours, une page de commerce ou une autre fenêtre.
const LS_PROMO = "livraison.promo.v1";
async function showAppPromo() {
  if (shopCode || kindParam || document.body.dataset.view !== "home" || Object.keys(state.cart || {}).length
    || document.querySelector(".promo-modal") || !$("#noticeModal").classList.contains("hidden")) return;
  let list;
  try { list = ((await Store.appPromos()) || []).filter(p => p.image_fr); } catch (e) { return; }
  if (!list.length) return;
  let last = -1;
  try { last = (JSON.parse(localStorage.getItem(LS_PROMO)) || {}).i; } catch (e) { /* première fois */ }
  const i = (Number.isInteger(last) ? last + 1 : 0) % list.length, p = list[i];
  try { localStorage.setItem(LS_PROMO, JSON.stringify({ i, at: Date.now() })); } catch (e) { /* stockage plein */ }
  const src = (I18N.lang === "he" && p.image_he) || p.image_fr, kind = String(p.cta || "").split(":")[0];
  // L'image d'abord : la fenêtre ne s'ouvre que si elle est prête (rien de vide à l'écran)
  const ok = await new Promise(res => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = src; setTimeout(() => res(false), 5000); });
  if (!ok || document.body.dataset.view !== "home" || document.querySelector(".promo-modal")) return;
  const box = document.createElement("div");
  box.className = "promo-modal";
  box.setAttribute("role", "dialog");
  box.innerHTML = `<div class="pm-card">
      <button type="button" class="pm-close" data-pm-close aria-label="${UI.esc(t("promoClose"))}">✕</button>
      <img class="pm-img" src="${UI.esc(src)}" alt="${UI.esc(p.title || "")}" />
      ${kind ? `<button type="button" class="btn btn-primary pm-go" data-pm-go>${UI.esc((t("promoGo") || {})[kind] || "OK")}</button>` : ""}
      ${list.length > 1 ? `<div class="pm-dots">${list.map((x, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div>` : ""}
    </div>`;
  const close = () => { box.classList.add("out"); setTimeout(() => box.remove(), 220); };
  box.addEventListener("click", e => {
    if (e.target === box || e.target.closest("[data-pm-close]")) return close();
    if (!e.target.closest("[data-pm-go]") && !e.target.closest(".pm-img")) return;
    close();
    if (kind === "order") setView("order", true);
    else if (kind === "pro") { const el = $("#homePro"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (kind === "shop") loadShop(p.cta.slice(5));
    else if (kind === "url") window.open(p.cta.slice(4), "_blank", "noopener");
  });
  document.body.appendChild(box);
}

// Nouvelle version de l'appli mise en ligne pendant que le téléphone la gardait en arrière-plan : au retour,
// si le client est sur l'accueil sans panier en cours, on recharge (sinon on attend, rien n'est perdu)
async function checkNewVersion() {
  const mine = ((document.querySelector('script[src*="client.js"]') || {}).src || "").match(/[?&]v=(\d+)/);
  if (!mine || document.body.dataset.view !== "home" || Object.keys(state.cart || {}).length) return;
  try {
    const html = await (await fetch(`${location.pathname}?fresh=${Date.now()}`, { cache: "no-store" })).text();
    const live = html.match(/client\.js\?v=(\d+)/);
    if (live && live[1] !== mine[1] && document.body.dataset.view === "home") location.reload();
  } catch (e) { /* hors ligne : on garde la version ouverte */ }
}

function showHomeErr(msg) { $("#homeErr").textContent = msg || ""; $("#homeErr").classList.toggle("hidden", !msg); }

// Types de course, raccourcis d'heure et adresses enregistrées (selon la langue)
// Illustrations en relief des types de course et des catégories d'enseignes (img/items)
const KIND_ART = { tabac: ["wine", 280], bakery: ["croissant", 38], pressing: ["basket", 35], poste: ["mailbox", 205], pharm: ["pill", 160], resto: ["burger", 25], docs: ["docs", 215],
  yad2: ["couch", 30], keys: ["key", 45], shop: ["cart", 140], gift: ["flowers", 330], ta: ["scooter", 15],
  baby: ["baby", 330], pets: ["dog", 30], home: ["plug", 210] };
function renderHomeStatic() {
  const homeCity = CONFIG.homeCity;
  $("#homeKinds").innerHTML = HOME_KINDS.map(ex => {
    const q = Pricing.computeQuote({ fromCity: homeCity, toCity: homeCity, service: ex.set.service, size: ex.set.size || "petit", roundTrip: ex.set.round_trip }, CONFIG);
    const art = KIND_ART[ex.id];
    return `<button type="button" class="ch-kind${state.homeKind === ex.id ? " on" : ""}" data-kind="${ex.id}">${RAYON_KINDS.includes(ex.id) ? `<em class="kind-new">${UI.esc(t("hpNew"))}</em>` : ""}${art ? UI.artImg(art[0], art[1]) : `<i>${ex.icon}</i>`}<b>${UI.esc(t("ex_" + ex.id + "_t"))}</b></button>`;
  }).join("");
  loadRayonsLive();
  renderHomePharma();
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
  const ok = d => d - Date.now() >= lead && !Pricing.checkSchedule(d, CONFIG) && shopOpenAt(d);
  const out = [];
  if (openNow() && shopOpenAt(new Date())) out.push({ id: "now" });
  // Commerce fermé maintenant : « À l'ouverture » (15 min après), l'heure prise d'office en choisissant le commerce
  const shut = shopSide() && state.shop.hours ? UI.openState(state.shop.hours) : null, opens = shut && !shut.open && UI.nextOpenDate(shut);
  if (opens) {
    const d = new Date(opens.getTime() + 15 * 60000);
    if (ok(d)) out.push({ id: "opens", d, h: shut.inDays ? `${(DAYS[I18N.lang] || DAYS.fr)[shut.day].toLowerCase()} ${hhmm(d)}` : hhmm(d) });
  }
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
  // Heure programmée déjà passée (brouillon de la veille), ou prise d'office pour un commerce qu'on a retiré : retour à « Maintenant »
  const at = val("urgency") === "programmee" && pickupDate();
  if (at && (at < Date.now() || (state.shopSched && !shopSide()))) {
    form.elements.urgency.value = "asap"; state.shopSched = null;
    syncVisibility();
  }
  const cur = currentWhen();
  $("#homeWhen").innerHTML = whenOptions().map(o => `<button type="button" class="ch-chip${cur === o.id ? " on" : ""}" data-when="${o.id}">${UI.esc(t({ now: "hmNow", in1h: "hmIn1h", tonight: "hmTonight", tomorrow: "hmTomorrow", opens: "hmOpens", other: "hmOther" }[o.id], { h: o.h || (o.d ? hhmm(o.d) : "") }))}</button>`).join("");
  const planned = val("urgency") === "programmee" && pickupDate();
  // Commerce fermé maintenant : on le dit clairement (et quand il ouvre), avant l'heure programmée
  const st = shopSide() && state.shop.hours ? UI.openState(state.shop.hours) : null;
  const closed = st && !st.open ? t("hmShopClosed", { name: shopShortName(), opens: openLabel(st) }) : "";
  const note = [closed, planned ? t("hmPlanned", { when: UI.fmtDateTime(planned) }) : ""].filter(Boolean).join(" ");
  $("#homeWhenNote").textContent = note;
  $("#homeWhenNote").classList.toggle("hidden", !note);
  $("#homeWhenNote").classList.toggle("ch-note-closed", !!closed);
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
  const cat = { poste: "post", pharm: "pharm", resto: "food", shop: "super", gift: "flower", bakery: "breakfast", pressing: "pressing", baby: "baby", pets: "pet", home: "home" }[id];
  if (state.homeKind && cat && !state.pick.from && !RAYON_KINDS.includes(id)) openEns(cat);
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
    form.elements[prefixOf(w) + "_address"].closest(".fields").classList.toggle("brand-mode", w === "from" && !!(p && p.brand));
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
      if (p) { if (home.ac[which].pickedLabel() !== p.label) home.ac[which].setPicked(p.label); }
      else { home.ac[which].reset(); input.value = val(pre + "_address"); }
    }
    syncHomeX(which);
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
    .setView([c.lat, c.lon], 14);
  $("#homeZoomIn").addEventListener("click", () => home.map.zoomIn());
  $("#homeZoomOut").addEventListener("click", () => home.map.zoomOut());
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  UI.mapTiles(home.map, dark, true);
  addEventListener("resize", () => home.map.invalidateSize());
  initRestos();
  initHomeGrip();
}
// Volet de l'accueil (téléphone) : on le glisse vers le bas, ou on touche la poignée, pour voir toute la carte
// Bouton « Voir la carte » : une vraie petite carte au trésor (image, couleurs, il bouge un peu)
function renderMapBtn() {
  const b = $("#homeMapBtn");
  if (!b) return;
  const on = $("#accueil").classList.contains("map-open");
  let n = 0;
  try { n = restos.list.filter(e => !e.offMap).length; } catch (e) { /* carte pas encore prête */ }
  b.innerHTML = on ? `<span class="mb-ico">⌃</span><b>${UI.esc(t("hmMapClose").replace(/^\S+\s/, ""))}</b>`
    : `<img src="img/qc/worldmap.webp" alt="" /><span class="mb-txt"><b>${UI.esc(t("hmMapOpen").replace(/^\S+\s/, ""))}</b>${n ? `<small>${UI.esc(t("hmMapSub", { n }))}</small>` : ""}</span><span class="mb-go">›</span>`;
}
function setMapOpen(on) {
  const ch = $("#accueil");
  if (!ch || ch.classList.contains("map-open") === !!on) return;
  ch.classList.toggle("map-open", !!on);
  renderMapBtn();
  if (home.map && restos.layer) { restos.key = ""; drawRestos(); }   // grande carte : tout l'annuaire ; accueil : les partenaires
  if (on) scrollTo({ top: 0, behavior: "smooth" });
  // La carte change de taille pendant l'animation : on la recale à la fin
  setTimeout(() => { if (home.map) { home.map.invalidateSize(); drawRestos(); } }, 330);
}
function initHomeGrip() {
  const grip = $("#homeGrip"), sheet = $("#homeSheet");
  if (!grip || !sheet) return;
  let y0 = null, moved = false;
  const start = y => { y0 = y; moved = false; };
  const move = y => { if (y0 == null) return; const dy = y - y0; if (Math.abs(dy) > 30) { moved = true; setMapOpen(dy > 0); y0 = null; } };
  // On attrape le haut du volet (la poignée, ou le haut de la feuille quand la page est en haut)
  sheet.addEventListener("touchstart", e => { const r = sheet.getBoundingClientRect(); if (e.touches[0].clientY - r.top < 56 && scrollY < 8) start(e.touches[0].clientY); }, { passive: true });
  // Pendant le geste sur le volet, la page ne bouge pas (et le navigateur n'actualise pas la page en tirant vers le bas)
  sheet.addEventListener("touchmove", e => { if (y0 != null) { if (e.cancelable) e.preventDefault(); move(e.touches[0].clientY); } }, { passive: false });
  sheet.addEventListener("touchend", () => { y0 = null; });
  grip.addEventListener("pointerdown", e => start(e.clientY));
  addEventListener("pointermove", e => { if (e.pointerType === "mouse" && y0 != null) move(e.clientY); });
  addEventListener("pointerup", () => { y0 = null; });
  grip.addEventListener("click", () => { if (!moved) setMapOpen(!$("#accueil").classList.contains("map-open")); moved = false; });
  const btn = $("#homeMapBtn");
  if (btn) { renderMapBtn(); btn.addEventListener("click", () => setMapOpen(!$("#accueil").classList.contains("map-open"))); }
}
// Restaurants de l'annuaire sur la carte : un point de loin, un rond 🍴 de près, et leur nom en zoomant encore.
// On en touche un : « Récupérer ici » le met en départ.
const restos = { layer: null, list: [], key: "", filter: "", seen: new Set() };
// Chaque cuisine a sa couleur sur la carte (sushi rose, pizza rouge, burger jaune…)
const FOOD_COLOR = { "🍣": "#EC4899", "🍕": "#EF4444", "🍔": "#F59E0B", "🥗": "#22C55E", "🥡": "#F97316", "🥙": "#CA8A04", "🍦": "#A855F7",
  "🥐": "#D97706", "🍝": "#F43F5E", "🥩": "#B91C1C", "🍗": "#EA580C", "🐟": "#0EA5E9", "🥪": "#65A30D", "🍺": "#EAB308", "☕": "#92400E", "🍽️": "#FF6A13" };
const restoMatch = e => !restos.filter || (restos.filter === "👑" ? !!e.partner : Places.foodIcon(e.n, e.k) === restos.filter);
// Filtres en haut de la carte : « Tout », « 👑 HOP! », puis les cuisines les plus présentes (🍕 Pizza 23…)
function renderMapCats() {
  const box = $("#homeMapCats");
  if (!box) return;
  const count = {};
  restos.list.forEach(e => { if (e.offMap) return; const k = Places.foodIcon(e.n, e.k); if (k !== "🍽️") count[k] = (count[k] || 0) + 1; });
  const fk = t("fk") || {}, hop = restos.list.filter(e => e.partner).length;
  // Les envies du soir d'abord (pizza, sushi, burger…), le bar en dernier
  const ORDER = ["🍕", "🍣", "🍔", "🥙", "🥗", "🥡", "🍝", "☕", "🥐", "🍦", "🥩", "🍗", "🐟", "🥪", "🍺"];
  const cats = ORDER.filter(k => count[k] >= 2).map(k => [k, count[k]]);
  const chip = (k, label, n) => `<button type="button" class="mc-chip${restos.filter === k ? " on" : ""}" data-mapcat="${k}"${k && FOOD_COLOR[k] ? ` style="--pc:${FOOD_COLOR[k]}"` : ""}>${label}${n ? ` <small>${n}</small>` : ""}</button>`;
  box.innerHTML = chip("", "✨ " + t("mcAll"), 0) + (hop ? chip("👑", "👑 HOP!", hop) : "") + cats.map(([k, n]) => chip(k, `${k} ${UI.esc(fk[k] || "")}`, n)).join("");
}
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
    // Un partenaire remplace sa fiche de l'annuaire (jamais son nom « hors catalogue ») ; un lieu appris ne fait pas doublon
    restos.list = restos.list.filter(e => !Places.partnerDup(e));
    extra.forEach(x => { if (x.n && isFinite(x.lat) && isFinite(x.lon) && (x.partner || !twin(x))) restos.list.push(x); });
  } catch (e) { /* la carte garde l'annuaire */ }
  // Position par défaut (beaucoup de restaurants de rues différentes sur le même point) : pas sur la carte, la recherche les trouve
  const streets = {};
  restos.list.forEach(e => { const k = e.lat.toFixed(4) + "," + e.lon.toFixed(4); (streets[k] = streets[k] || new Set()).add(String(e.s || "").split(" ")[0]); });
  restos.list = restos.list.map(e => (streets[e.lat.toFixed(4) + "," + e.lon.toFixed(4)].size >= 3 ? Object.assign({}, e, { offMap: true }) : e));
  home.map.on("zoomend moveend", drawRestos);
  renderMapCats();
  renderMapBtn();
  $("#homeMapCats").addEventListener("click", e => {
    const b = e.target.closest("[data-mapcat]");
    if (!b) return;
    restos.filter = restos.filter === b.dataset.mapcat ? "" : b.dataset.mapcat;
    renderMapCats();
    drawRestos();
    // Rien de ce type sur l'écran : on recule pour en montrer
    if (restos.filter && home.map.getZoom() > 13 && !restos.list.some(x => restoMatch(x) && !x.offMap && home.map.getBounds().contains([x.lat, x.lon]))) home.map.setZoom(13);
  });
  home.map.on("popupclose", () => { restos.open = false; drawRestos(); });
  // On fait glisser la carte ou on zoome : la bulle se ferme, et les commerces du nouvel endroit s'affichent
  home.map.on("dragstart zoomstart", () => { if (restos.open) home.map.closePopup(); });
  home.map.on("popupopen", e => {
    restos.open = true;
    const box = e.popup.getElement();
    if (box) box.querySelectorAll("[data-resto]").forEach(b => b.addEventListener("click", () => { pickResto(restos.list[Number(b.dataset.resto)]); home.map.closePopup(); }));
    // Bulle ouverte : les bandeaux du haut et les boutons de la carte s'effacent, et la carte glisse pour que la bulle
    // entière (et son bouton « Commander ») tienne dans la partie visible : ni sous le volet du bas, ni coupée sur un côté
    $("#accueil").classList.add("pop-open");
    if (box) requestAnimationFrame(() => {
      const r = box.getBoundingClientRect(), map = home.map.getContainer().getBoundingClientRect();
      const sheet = $("#homeSheet"), sheetTop = sheet && sheet.offsetParent ? sheet.getBoundingClientRect().top : map.bottom;
      const top = map.top + 10, bottom = Math.min(map.bottom, sheetTop) - 12, left = map.left + 8, right = map.right - 8;
      const dy = r.height > bottom - top || r.top < top ? r.top - top : r.bottom > bottom ? r.bottom - bottom : 0;
      const dx = r.left < left ? r.left - left : r.right > right ? r.right - right : 0;
      if (dx || dy) home.map.panBy([Math.round(dx), Math.round(dy)], { animate: true });
    });
  });
  home.map.on("popupclose", () => $("#accueil").classList.remove("pop-open"));
  drawRestos();
  if (Store.fixAddressBrands(freshBrand)) { renderHomeStatic(); syncHome(); }   // « Mes adresses » et « Refaire la dernière course » avec le bon nom
}
const restoName = e => UI.bi(I18N.lang === "fr" && e.fr ? e.fr : e.n);
function drawRestos() {
  if (restos.open) return;   // une bulle est ouverte : on ne redessine pas (elle se fermerait)
  const z = home.map.getZoom(), el = home.map.getContainer();
  // Les noms dès la vue de départ (sans chevauchement) ; de très loin, de simples points
  el.classList.toggle("rz-far", z < 13);
  el.classList.toggle("rz-names", z >= 13);
  if (z < 12) { restos.layer.clearLayers(); restos.key = ""; return; }
  const bounds = home.map.getBounds().pad(0.5), c = home.map.getCenter();   // un peu autour de l'écran : déjà là quand on se déplace
  // Plusieurs commerces au même endroit (centre commercial) : chacun son rond, écartés en cercle autour du point
  // (au-delà de 10, le dernier rond regroupe le reste : « nom +3 ») ; de loin, un seul rond « nom +2 »
  const groups = {};
  const compact = !$("#accueil").classList.contains("map-open");
  restos.list.forEach((e, i) => {
    if (e.offMap || !restoMatch(e) || !bounds.contains([e.lat, e.lon])) return;
    if (compact && !e.partner) return;   // accueil : seulement nos partenaires, lisibles ; tout l'annuaire sur la grande carte
    const k = e.lat.toFixed(4) + "," + e.lon.toFixed(4);
    (groups[k] = groups[k] || []).push(i);
  });
  const spread = [];
  Object.values(groups).forEach(ids => {
    const e0 = restos.list[ids[0]];
    if (ids.length === 1 || z < 14) { spread.push({ ids, e: e0, pos: [e0.lat, e0.lon] }); return; }
    const n = Math.min(ids.length, 10), r = 16 + 3 * n, p0 = home.map.project([e0.lat, e0.lon], z);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + 2 * Math.PI * k / n, ll = home.map.unproject(p0.add([r * Math.cos(a), r * Math.sin(a)]), z);
      spread.push({ ids: k === n - 1 ? ids.slice(k) : [ids[k]], e: restos.list[ids[k]], pos: [ll.lat, ll.lng] });
    }
  });
  const shown = spread.sort((a, b2) => c.distanceTo(a.pos) - c.distanceTo(b2.pos)).slice(0, z >= 15 ? 300 : 350);
  // Noms : seulement ceux qui ne se chevauchent pas (les plus proches du centre d'abord)
  const boxes = [], isHop = g => g.ids.some(i => restos.list[i].partner), hasLogo = g => !!UI.dirLogo(g.e);
  // Les partenaires HOP! d'abord (leur nom est toujours affiché), puis les commerces qui ont un logo
  shown.filter(isHop).concat(shown.filter(g => !isHop(g) && hasLogo(g)), shown.filter(g => !isHop(g) && !hasLogo(g))).forEach(g => {
    if (z < 13) return;
    const name = restoName(g.e), pt = home.map.latLngToContainerPoint(g.pos);
    const w = Math.min(22, name.length) * 6.6 + (g.ids.length > 1 ? 22 : 0) + 44, box = [pt.x - 14, pt.y - 13, pt.x + w, pt.y + 13];
    g.label = !boxes.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
    if (g.label) boxes.push(box);
  });
  const key = I18N.lang + ":" + restos.filter + ":" + z + ":" + (compact ? "c" : "f") + ":" + (state.showcase || []).length + ":" + Math.floor(Date.now() / 300000) + ":" + shown.map(g => g.ids.join("+") + (g.label ? "L" : "")).join(",");
  if (key === restos.key) return;   // mêmes restaurants : rien à refaire (pas de clignotement)
  restos.key = key;
  restos.layer.clearLayers();
  // Les commerces qui arrivent à l'écran « sautent » en place (pas ceux qui y étaient déjà)
  const seen = new Set();
  let popN = 0;
  shown.forEach(g => {
    const id = g.ids.join("+"), pop = !restos.seen.has(id) && popN < 60;
    seen.add(id);
    if (pop) popN++;
    const name = restoName(g.e), more = g.ids.length - 1;
    const label = (g.ids.some(i => restos.list[i].partner) ? "👑 " : "") + (name.length > 22 ? name.slice(0, 21) + "…" : name) + (more ? ` +${more}` : "")
      + (g.ids.some(i => { const p = restos.list[i].partner, st = p && UI.openState(p.hours); return st && !st.open; }) ? ` · ${t("pinClosed")}` : "");
    // L'icône de sa cuisine (🍕 🍣 🍔…), un partenaire HOP! en orange ; les noms affichés passent devant
    // Partenaire HOP! : son logo (celui de sa vitrine), sinon l'icône de son métier
    const pe = g.ids.map(i => restos.list[i]).find(e => e.partner), hop = !!pe;
    // Partenaire fermé en ce moment : pastille grise et « fermé » à côté du nom (le vert = ouvert)
    const pst = hop ? UI.openState(pe.partner.hours) : null, shut = !!(pst && !pst.open);
    // Logo : celui de la vitrine d'un partenaire, sinon celui d'un commerce de l'annuaire (img/logos/…)
    const dirLogo = UI.dirLogo(g.e);   // le logo du commerce dont le nom est affiché (pas celui d'un voisin du groupe)
    const logo = hop ? UI.safeImg(((state.showcase || []).find(x => x.code === pe.partner.code) || {}).logo) || dirLogo : dirLogo;
    const ico = logo ? `<img src="${logo}" alt="" />` : hop ? (UI.KIND_ICON[pe.partner.kind] || "⭐") : Places.foodIcon(g.e.n, g.e.k);
    // Le logo d'un partenaire grossit à mesure qu'on zoome (34 px à la vue de départ, jusqu'à 84 px tout près)
    const lg = !logo ? 26 : hop ? ({ 13: 28, 14: 30, 15: 34, 16: 40, 17: 52, 18: 66 })[z] || (z > 18 ? 84 : 28)
      : ({ 13: 22, 14: 24, 15: 26, 16: 30, 17: 36, 18: 44 })[z] || (z > 18 ? 52 : 22);   // commerce de l'annuaire : plus petit qu'un partenaire
    L.marker(g.pos, { zIndexOffset: hop ? 400 : g.label ? -500 : -1000, keyboard: false, icon: L.divIcon({ className: "", iconSize: [lg, lg], iconAnchor: [lg / 2, lg / 2],
      html: `<div class="resto-pin${more ? " many" : ""}${hop ? " hop" : ""}${shut ? " shut" : ""}${logo ? " has-logo" : ""}${!g.label && !hop && z < 17 ? " small" : ""}${pop ? " pop" : ""}" style="--pc:${FOOD_COLOR[Places.foodIcon(g.e.n, g.e.k)] || "#FF6A13"};${pop ? `--pd:${(popN % 20) * 18}ms;` : ""}${logo ? `--lg:${lg}px` : ""}"><b>${ico}</b>${g.label ? `<span>${UI.esc(label)}</span>` : ""}</div>` }) })
      .bindPopup(`<div class="resto-pop">${g.ids.slice(0, 8).map(i => { const e = restos.list[i], name = UI.bi(Places.dirName(e, I18N.lang)), pl = rowLogo(e); return `<div class="rp-row">
          <div class="rp-head">${pl ? `<span class="rp-logo"><img src="${pl}" alt="" /></span>` : ""}<span><b>${UI.esc(name)}</b><em class="rp-kind">${UI.esc(restoKind(e))}</em>${e.partner ? `<i class="ac-partner">${UI.esc(t("ensPartner"))}</i>` : ""}${e.partner && e.partner.kosher ? kosherTag() : ""}${partnerState(e)}${e.s ? `<small>${UI.esc(e.s)}</small>` : ""}${e.partner ? "" : `<i class="ac-soon">${UI.esc(t("addrSoon"))}</i>`}</span></div>
          <button type="button" class="btn btn-primary btn-sm" data-resto="${i}">${UI.esc(e.partner ? t(partnerShut(e) ? "restoSchedule" : "restoOrder", { name: String(name).split(" · ")[0] }) : t("restoTake"))}</button></div>`; }).join("")}</div>`,
        { closeButton: false, offset: [0, -6], maxWidth: 260, maxHeight: 210, autoPanPaddingTopLeft: [12, 150], autoPanPaddingBottomRight: [76, 24] })
      .addTo(restos.layer);
  });
  restos.seen = seen;
}
// Logo d'un commerce dans la bulle : celui de sa vitrine (partenaire) ou de l'annuaire (img/logos/…)
function rowLogo(e) {
  if (e.partner) { const sc = (state.showcase || []).find(x => x.code === e.partner.code); if (sc && UI.safeImg(sc.logo)) return UI.safeImg(sc.logo); }
  return UI.dirLogo(e);
}
// Ce qu'est le commerce : « 👔 Pressing », « 🍕 Pizza »… (la cuisine se lit dans son nom ou sa fiche) ;
// un partenaire a en plus son badge vert « 👑 Partenaire HOP! »
function restoKind(e) {
  if (e.partner) return (t("shKinds") || {})[e.partner.kind] || "⭐";
  const ico = Places.foodIcon(e.n, e.k), fk = t("fk") || {};
  return `${ico} ${fk[ico] || fk["🍽️"] || ""}`;
}
// Un nom mal tapé resté dans « Mes adresses » (« Samaki » au lieu de « Simaki ») : on reprend le nom de l'annuaire
// du commerce au même endroit (même squelette de consonnes), et on le corrige une fois pour toutes
const consonants = s => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z\u05d0-\u05ea]/g, "").replace(/[aeiouy]/g, "");
function freshBrand(a) {
  if (!a || !a.brand || a.lat == null || !restos.list.length) return a && a.brand;
  const c = consonants(String(a.brand).split(" · ")[0]);
  if (!c) return a.brand;
  const hit = restos.list.find(e => !e.partner && Math.abs(e.lat - a.lat) < 0.0004 && Math.abs(e.lon - a.lon) < 0.0004
    && [e.n, e.fr].concat(e.alt || []).some(n => { const k = consonants(n); return k.length >= 3 && (k === c || k.startsWith(c) || c.startsWith(k)); }));
  return hit ? Places.dirName(hit, I18N.lang) : a.brand;
}
function pickResto(e) {
  if (!e) return;
  setMapOpen(false);   // le commerce choisi : le volet remonte pour finir la commande
  if (e.partner) { onPlacePicked("from", partnerPlace(e.partner)); return; }   // commerce partenaire : sa vitrine
  const p = Object.assign(Places.dirPlace(e, I18N.lang), e.known ? { known: true, food: Places.foodIcon(e.n) !== "🍽️" } : {});
  if (home.ac.from) home.ac.from.setPicked(p.label);
  onPlacePicked("from", p, true);
  renderHomeMap(true);
  if (!state.pick.to) setTimeout(() => homeInput("to").focus({ preventScroll: true }), 60);
}
// Ouvert / fermé d'un partenaire (bulle de la carte)
const partnerShut = e => { const st = e.partner && UI.openState(e.partner.hours); return !!(st && !st.open); };
function partnerState(e) {
  const st = e.partner && UI.openState(e.partner.hours);
  return st ? `<small class="rp-st ${st.open ? "on" : "off"}">${UI.esc((st.open ? "🟢 " : "🌙 ") + openLabel(st))}</small>` : "";
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
  if (pts.length > 1) home.map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])), Object.assign({ maxZoom: 16 }, pad));
  else {
    home.map.setView([pts[0].lat, pts[0].lon], 16, { animate: false });   // de près dès le départ : les noms des commerces autour
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
  else if (state.fromPoint && state.toPoint) renderQuote();   // un livreur arrive près d'une zone : le prix suit
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
  if (s && (s.client_pays || s.pro === false)) return CONFIG.pricing.fixedFromHome[CONFIG.homeCity];
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
// Badge « Casher » des partenaires (case cochée par le patron) : vitrine, page du commerce, carte
function isKosher(s) { return !!(s && (s.kosher || (state.partners || []).some(p => p.code === s.code && p.kosher))); }
// Sceau : étoile de David blanche dans un rond bleu, puis « Casher / כשר »
const KOSHER_STAR = `<svg class="k-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l7.6 13.2H4.4zM12 20.8L4.4 7.6h15.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
function kosherTag(cls) { return `<em class="k-badge${cls ? " " + cls : ""}">${KOSHER_STAR}${UI.esc(t("kosher"))}</em>`; }
// Carte d'un commerce, compacte : bannière, logo, catégorie, ouvert / fermé, livraison ; toute la carte s'ouvre au toucher
function shopCard(s) {
  const cover = UI.safeImg(s.cover), logo = UI.safeImg(s.logo), fav = favs().includes(s.code), st = UI.openState(s.hours);
  const initials = String(UI.bi(s.name) || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return `<div class="sc-card pk-${UI.esc(s.kind || "autre")}" data-pro="${UI.esc(s.code)}" role="button" tabindex="0">
    <span class="sc-cover"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}
      ${st && !st.open ? `<em class="sc-closed"><span><b>🌙 ${UI.esc(t("scClosedShort"))}</b>${(lb => lb ? `<small>${UI.esc(lb)}</small>` : "")(openLabel(st).replace(/^[^·]*·\s*/, "").replace(/^(Fermé|סגור)$/, ""))}</span></em>` : ""}${isKosher(s) ? kosherTag("k-on-cover") : ""}${s.kind && s.kind !== "autre" && (t("shKinds") || {})[s.kind] ? `<em class="sc-kind">${UI.esc(t("shKinds")[s.kind])}</em>` : ""}</span>
    <button type="button" class="sc-fav${fav ? " on" : ""}" data-fav="${UI.esc(s.code)}" aria-label="♥">${fav ? "♥" : "♡"}</button>
    <span class="sc-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
    <span class="sc-body"><b>${UI.esc(UI.bi(s.name))}</b>
      <small class="sc-meta">${st ? `<i class="sc-dot ${st.open ? "on" : "off"}"></i>${UI.esc(openLabel(st))} · ` : ""}${s.shop_pays ? `🎁 ${UI.esc(t("scGift"))}` : `🛵 ${UI.esc(money(proPrice(s)))}`}${s.products ? " · " + UI.esc(t("proMenu", { n: s.products })) : s.pro === false ? " · " + UI.esc(t("scWa")) : ""}</small>
      ${UI.shopText(s, "tagline") ? `<small class="sc-tag">${UI.esc(UI.shopText(s, "tagline"))}</small>` : ""}</span>
    ${st && !st.open ? `<span class="sc-prog-btn">${UI.calIcon()} ${UI.esc(t("scProgOrder"))}</span>` : `<span class="sc-go" aria-label="${UI.esc(t("proGo"))}">›</span>`}
  </div>`;
}
// Vitrine : les logos de tous les partenaires en haut, puis tous en grandes cartes photo (les ouverts d'abord) ;
// un fermé garde sa belle carte, avec « Fermé · ouvre à … » sur la photo et « Programmer une commande » en option
function shopLogo(s, cls) {
  const logo = UI.safeImg(s.logo), initials = String(UI.bi(s.name) || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return `<span class="${cls}">${logo ? `<img src="${logo}" alt="" />` : `<b>${UI.esc(initials)}</b>`}</span>`;
}
// Filtre de la vitrine (chips) : tous / ouverts / casher / un métier
const scFilter = { kind: "", open: false, kosher: false };
function renderShowcase() {
  const all = (state.showcase || []).slice(), f = favs();
  const isOpen = s => { const st = UI.openState(s.hours); return !st || st.open; };
  // Favoris du client d'abord, puis les enseignes placées par HOP! (position 1 = en premier), puis les ouvertes
  const rk = s => (s.rank != null ? Number(s.rank) : Infinity);
  all.sort((a, b) => (f.includes(b.code) - f.includes(a.code)) || (rk(a) - rk(b) || 0) || (isOpen(b) - isOpen(a)));
  $("#homeProBox").classList.toggle("hidden", !all.length);
  // Filtres : seulement les métiers présents
  const kinds = [...new Set(all.map(s => s.kind).filter(Boolean))];
  const chip = (k, on, label) => `<button type="button" class="ch-chip${on ? " on" : ""}" data-scf="${k}">${UI.esc(label)}</button>`;
  const none = !scFilter.kind && !scFilter.open && !scFilter.kosher;
  $("#homeFilters").innerHTML = chip("all", none, t("scAll")) + chip("open", scFilter.open, t("scOpenF"))
    + (all.some(isKosher) ? chip("kosher", scFilter.kosher, t("scKosherF")) : "")
    + kinds.map(k => chip("k:" + k, scFilter.kind === k, (t("shKinds") || {})[k] || k)).join("");
  const list = all.filter(s => (!scFilter.kind || s.kind === scFilter.kind) && (!scFilter.open || isOpen(s)) && (!scFilter.kosher || isKosher(s)));
  const placed = list.filter(s => rk(s) < Infinity || f.includes(s.code)), rest = list.filter(s => !placed.includes(s));
  const open = placed.concat(rest.filter(isOpen)), closed = rest.filter(s => !isOpen(s));
  const stories = `<div class="sc-stories">${all.map(s => `<button type="button" class="sc-story${isOpen(s) ? "" : " closed"}" data-pro="${UI.esc(s.code)}">
        ${shopLogo(s, "sc-ring")}${isKosher(s) ? `<i class="k-dot" title="${UI.esc(t("kosher"))}">${KOSHER_STAR}</i>` : ""}<i class="sc-sdot ${isOpen(s) ? "on" : "off"}"></i><b>${UI.esc(UI.bi(s.name))}</b></button>`).join("")}</div>`;
  // Façon appli de livraison, dès qu'il y a de quoi : rangées « Mes favoris », « Ouverts maintenant », « Populaires »
  // (commandes du mois), « Nouveautés » (arrivés depuis 30 jours), puis tous ; sinon une seule rangée
  const row = (title, items, sub) => (items.length ? `<h4 class="sc-row-h"><span>${UI.esc(title)}</span>${sub ? `<small>${UI.esc(sub)}</small>` : ""}</h4><div class="pro-row">${items.map(shopCard).join("")}</div>` : "");
  const recent = s => s.created_at && Date.now() - new Date(s.created_at) < 30 * 86400000;
  let body;
  if (list.length >= 4 && none) {
    const favL = list.filter(s => f.includes(s.code)), openL = list.filter(isOpen);
    const pop = list.filter(s => Number(s.orders30) > 0).sort((a, b) => Number(b.orders30) - Number(a.orders30)).slice(0, 8);
    const fresh = list.filter(recent).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    body = row(t("rowFavs"), favL) + row(t("rowOpen"), openL) + row(t("rowPop"), pop) + row(t("rowNew"), fresh) + row(t("rowAll"), open.concat(closed));
  } else body = list.length ? `<div class="pro-row">${open.concat(closed).map(shopCard).join("")}</div>` : `<p class="muted small sc-empty">${UI.esc(t("scNoneF"))}</p>`;
  const html = stories + body;
  if ($("#homePro").dataset.html !== html) { $("#homePro").innerHTML = html; $("#homePro").dataset.html = html; }
}
$("#homeFilters").addEventListener("click", e => {
  const b = e.target.closest("[data-scf]");
  if (!b) return;
  const k = b.dataset.scf;
  if (k === "all") Object.assign(scFilter, { kind: "", open: false, kosher: false });
  else if (k === "open") scFilter.open = !scFilter.open;
  else if (k === "kosher") scFilter.kosher = !scFilter.kosher;
  else scFilter.kind = scFilter.kind === k.slice(2) ? "" : k.slice(2);
  UI.track("home_filter", { f: k });
  renderShowcase();
});
// Recherche d'un plat, d'un produit ou d'un commerce : les commerces de la vitrine tout de suite, les produits
// de tous les catalogues (base) ensuite ; un produit ouvre son commerce et se met en avant dans le menu
let findTimer = null, findSeq = 0;
async function homeFind(q) {
  const box = $("#homeFindList"), n = norm(q);
  if (n.length < 2) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const seq = ++findSeq;
  const sc = code => (state.showcase || []).find(x => x.code === code) || {};
  const shops = (state.showcase || []).filter(s => norm(`${s.name} ${(t("shKinds") || {})[s.kind] || ""} ${s.tagline || ""} ${s.tagline_he || ""}`).includes(n)).slice(0, 5);
  const render = products => {
    if (seq !== findSeq) return;
    const prodHtml = products.slice(0, 8).map(p => `<button type="button" data-find-pro="${UI.esc(p.code)}" data-find-item="${UI.esc(p.id)}"><span class="fi-pic">${UI.safeImg(sc(p.code).logo) ? `<img src="${UI.safeImg(sc(p.code).logo)}" alt="" />` : (UI.KIND_ICON[p.kind] || "🍽️")}</span><span class="fi-txt"><b>${UI.esc(UI.bi(p.name))}</b><small>${UI.esc(t("findAt", { shop: UI.bi(p.shop) }))}${p.category ? " · " + UI.esc(UI.bi(p.category)) : ""}</small></span><span class="fi-price" dir="ltr">${money(p.price)}</span></button>`).join("");
    const shopHtml = shops.map(s => `<button type="button" data-find-pro="${UI.esc(s.code)}"><span class="fi-pic">${UI.safeImg(s.logo) ? `<img src="${UI.safeImg(s.logo)}" alt="" />` : (UI.KIND_ICON[s.kind] || "🏪")}</span><span class="fi-txt"><b>${UI.esc(UI.bi(s.name))}</b><small>${UI.esc((t("shKinds") || {})[s.kind] || "")}${UI.shopText(s, "tagline") ? " · " + UI.esc(UI.shopText(s, "tagline")) : ""}</small></span></button>`).join("");
    box.innerHTML = (prodHtml ? `<h5>${UI.esc(t("findProducts"))}</h5>${prodHtml}` : "") + (shopHtml ? `<h5>${UI.esc(t("findShops"))}</h5>${shopHtml}` : "")
      || `<p class="fi-none">${UI.esc(t("findNone", { q }))}</p>`;
    box.classList.remove("hidden");
  };
  render([]);
  try { render(await Store.productsSearch(q)); } catch (e) { /* les commerces suffisent */ }
  UI.track("home_find", { q: q.slice(0, 40) });
}
$("#homeFind").addEventListener("input", e => { clearTimeout(findTimer); findTimer = setTimeout(() => homeFind(e.target.value), 250); });
$("#homeFind").addEventListener("focus", e => { if (norm(e.target.value).length >= 2) homeFind(e.target.value); });
document.addEventListener("click", e => { if (!e.target.closest(".sc-find")) $("#homeFindList").classList.add("hidden"); });
$("#homeFindList").addEventListener("click", e => {
  const b = e.target.closest("[data-find-pro]");
  if (!b) return;
  state.findItem = b.dataset.findItem || null;
  $("#homeFindList").classList.add("hidden");
  state.shopDir = ""; loadShop(b.dataset.findPro);
});
$("#homePro").addEventListener("click", e => {
  const f = e.target.closest("[data-fav]");
  if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); }
}, true);
$("#homePro").addEventListener("keydown", e => { const c = e.target.closest("[data-pro]"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); c.click(); } });
async function loadShowcase() {
  try { state.showcase = (await Store.shopsShowcase()) || []; } catch (e) { state.showcase = []; }
  if (home.map && restos.layer) drawRestos();   // les logos des partenaires sur la carte
  renderShowcase();
}

async function loadPartners() {
  try { state.partners = ((await Store.shopsDirectory()) || []).filter(x => x.lat != null); } catch (e) { state.partners = []; }
  Places.setPartners(state.partners);
  // En tapant « Fal… », le commerce partenaire Falafel Haim sort en premier
  // … puis les enseignes que HOP! a apprises (absentes de la carte, indiquées par des clients)
  Places.setLocal(async q => {
    const n = norm(q);
    if (n.length < 2) return [];
    // Nom du partenaire, ou son type (« salade », « pizza »…) d'après son métier, son accroche et ses plats phares
    const krx = Places.kindRx(q), sc = code => (state.showcase || []).find(x => x.code === code) || {};
    const kindText = x => `${x.name} ${(t("shKinds") || {})[x.kind] || ""} ${sc(x.code).tagline || ""} ${sc(x.code).tagline_he || ""} ${(sc(x.code).top || []).map(p => p.name).join(" ")}`.toLowerCase();
    const mine = state.partners.filter(x => norm(x.name).includes(n) || (krx && krx.test(kindText(x)))).slice(0, 5).map(partnerPlace);
    const learned = ((await Store.placesSearch(q).catch(() => [])) || [])
      .filter(x => !mine.some(m => norm(m.brand) === norm(x.name)) && x.lat != null).map(learnedPlace);
    return mine.concat(learned);
  });
  renderHomeStatic();
  setTimeout(() => {
    const c0 = Pricing.cityById(CONFIG, CONFIG.homeCity);
    if (window.Enseignes) Enseignes.warm(home.pos || { lat: c0.lat, lon: c0.lon }, I18N.lang);
  }, 5000);
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
  try {
    ens.items = await Enseignes.list(catId, at, I18N.lang, more => {
      if (mine === ens.seq) { ens.items = more; renderEnsList(); }
    });
  }
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
    // Enseigne inscrite sur HOP! : on entre dans sa boutique (catalogue), en touchant la ligne ou le bouton
    return `<div class="ens-item${x.partner && x.code ? " ens-partner" : ""}"${x.partner && x.code ? ` data-ens-shop="${UI.esc(x.code)}"` : ""}>
      <span class="ens-ico">${UI.dirLogo(x) ? `<img src="${UI.esc(UI.dirLogo(x))}" alt="" loading="lazy" />` : x.icon}</span>
      <div class="ens-main"><b>${UI.esc(UI.bi(x.name))}${x.partner ? ` <i class="ac-partner">${UI.esc(t("ensPartner"))}</i>` : ""}</b>${x.partner ? "" : `<i class="ac-soon">${UI.esc(t("addrSoon"))}</i>`}
        <small>${UI.esc(addr || t("ensAddrLater"))} · ${dist(x)}</small></div>
      <div class="ens-act">${x.partner && x.code ? `<button type="button" class="btn btn-sm btn-primary" data-ens-shop="${UI.esc(x.code)}">${UI.esc(t("ensShop"))}</button>`
        : `<button type="button" class="btn btn-sm btn-primary" data-ens-pick="from" data-i="${i}">${UI.esc(t("ensFrom"))}</button>
        <button type="button" class="btn btn-sm" data-ens-pick="to" data-i="${i}">${UI.esc(t("ensTo"))}</button>`}</div>
    </div>`;
  }).join("") : `<p class="ens-empty">${UI.esc(t("ensNone"))}</p>`;
}
// Enseigne choisie : adresse complétée par la carte si OpenStreetMap ne la connaît pas
async function pickEnseigne(which, x) {
  if (!x) return;
  $("#ensModal").classList.add("hidden");
  // Pressing partenaire : « Livrer ici » = on vient chercher vos vêtements pour le commerce
  if (x.partner && (which === "from" || ens.cat === "pressing")) { state.shopDir = which; loadShop(x.code, true); return; }
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
  // Venu de « La pharmacie livrée » : la pharmacie choisie, on passe tout de suite aux produits
  if (state.pharmaGo) { state.pharmaGo = false; goPharma(); return; }
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
// Lien « Ce qu'on livre » (on-livre.html) : ?k=pharm ouvre directement cette catégorie
const kindParam = new URLSearchParams(location.search).get("k");
// Adresse nettoyée (paramètres laissés par une ancienne version ou un rechargement forcé)
if (location.search) history.replaceState(null, "", location.pathname + location.hash);
I18N.apply();
fillCitySelects();
fillDefaults();
attachPlaces();
initHome();
renderAll();
// Rechargement sur la page d'un commerce : on le rouvre, avec le panier et ce qui était rempli
let reopenShop = null;
if (!shopCode && location.hash === "#commander") { try { reopenShop = JSON.parse(sessionStorage.getItem(SS_SHOP)); } catch (e) { /* ignore */ } }
if (!reopenShop || !reopenShop.code) reopenShop = null;
if (shopCode) loadShop(shopCode);
else if (reopenShop) {
  state.shopDir = reopenShop.dir || "";
  loadShop(reopenShop.code, true).then(() => {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { /* ignore */ }
    const ids = cgProducts().map(p => p.id);
    if (d && d.cart && ids.length) { state.cart = Object.fromEntries(Object.entries(d.cart).filter(([id, q]) => ids.includes(id) && q > 0)); renderCatalog(); renderQuote(); }
  });
} else forgetOpenShop();
// Connecté : profil à jour (nom, adresses) depuis le compte, puis ses courses de tous ses téléphones
Store.clientRefresh().catch(() => null).finally(loadMine);
loadSettings();

form.addEventListener("input", e => {
  if (/_other$/.test(e.target.name)) scheduleOtherGeocode();
  if (e.target.name === "promo") { state.promo = null; $("#promoMsg").textContent = ""; }
  if (e.target.name === "promo" && e.target.value.trim()) $("#promoFold").open = true;
  if (e.target.name === "budget") form.budget.dataset.manual = val("budget") ? "1" : "";
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
// On quitte le commerce choisi (« Ne plus commander chez… », ou une autre tuile de l'accueil)
function leaveShop(quiet) {
  const side = shopSide() || "from";
  forgetOpenShop();
  state.shop = null;
  state.cart = {};
  state.pick[side] = null; state[side + "Point"] = null;
  if (ac[side]) ac[side].reset();
  if (home.ac && home.ac[side]) home.ac[side].reset();
  form.elements[prefixOf(side) + "_address"].value = "";
  form.elements[prefixOf(side) + "_number"].value = "";
  setBrandMode(side, false);
  renderShopBanner();
  renderCatalog();
  renderQuote();
  renderWhenHints();
  if (!quiet) form.elements[prefixOf(side) + "_address"].focus();
}
$("#shopBannerOff").addEventListener("click", () => leaveShop());
// Pressing : on vient chercher les vêtements chez le client (→ pressing) ou on les ramène (pressing →)
// Une photo en grand (‹ › pour passer à la suivante, toucher le fond pour fermer)
function openShopPhoto(i) {
  const g = shopPhotos(state.shop);
  if (!g.length) return;
  let k = (Number(i) + g.length) % g.length;
  const d = document.createElement("div");
  d.className = "sh-viewer";
  const draw = () => {
    d.innerHTML = `<img src="${g[k]}" alt="" /><button type="button" class="shv-x" data-shv="x" aria-label="✕">✕</button>
      ${g.length > 1 ? `<button type="button" class="shv-prev" data-shv="-1" aria-label="‹">‹</button><button type="button" class="shv-next" data-shv="1" aria-label="›">›</button><small>${k + 1} / ${g.length}</small>` : ""}`;
  };
  draw();
  d.addEventListener("click", e => {
    const c = e.target.closest("[data-shv]");
    if (c && c.dataset.shv !== "x") { k = (k + Number(c.dataset.shv) + g.length) % g.length; return draw(); }
    if (c || e.target === d) d.remove();
  });
  document.body.appendChild(d);
}
$("#shopHero").addEventListener("click", e => {
  const ph = e.target.closest("[data-sh-photo]");
  if (ph) return openShopPhoto(ph.dataset.shPhoto);
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
  // La carte de l'accueil et son bouton changent de langue aussi (noms des commerces en hébreu / en français)
  renderMapBtn();
  if (home.map && restos.layer) { restos.key = ""; if (restos.open) home.map.closePopup(); drawRestos(); }
  $("#quickGo").textContent = t(quickWhen === "later" ? "quickCtaLater" : "quickCta");
});
$("#doneClose").addEventListener("click", () => { $("#doneModal").classList.add("hidden"); location.hash = "mes-courses"; });
// Le suivi s'ouvre tout seul après la commande (8 s), sauf si le client touche l'écran (il veut lire, activer
// les alertes, créer son compte…) ou s'il a un paiement à faire d'abord
let doneTimer = null;
function doneAuto(saved) {
  clearInterval(doneTimer);
  const el = $("#doneAuto");
  if (!el || !$("#donePrepay").classList.contains("hidden") || !$("#doneWa").classList.contains("hidden")) { if (el) el.classList.add("hidden"); return; }
  let n = 8;
  const tick = () => { el.textContent = t("doneAuto", { n }); el.classList.remove("hidden"); if (n-- <= 0) { clearInterval(doneTimer); location.href = UI.trackUrl(saved); } };
  tick(); doneTimer = setInterval(tick, 1000);
}
["click", "input", "touchstart"].forEach(ev => $("#doneModal").addEventListener(ev, () => { if (doneTimer) { clearInterval(doneTimer); doneTimer = null; $("#doneAuto").classList.add("hidden"); } }, { passive: true }));
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
  renderQuote();
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
    try { localStorage.setItem(LS_DRAFT, JSON.stringify({ at: Date.now(), values, pick: state.pick, phoneReady: state.phoneReady, cart: state.cart, pharma: state.pharma, pharmaCat: state.pharmaCat, pharmaOpt: state.pharmaOpt, homeKind: state.homeKind })); } catch (e) { /* plein */ }
  };
  if (now === true) write(); else draftTimer = setTimeout(write, 300);
}
function clearDraft() { clearTimeout(draftTimer); forgetOpenShop(); try { localStorage.removeItem(LS_DRAFT); } catch (e) { /* ignore */ } }
function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { /* ignore */ }
  if (!d || Date.now() - d.at > 2 * 3600000 || new URLSearchParams(location.search).get("c")) return;
  // Une commande commencée chez un commerce (fiche, catalogue) ne revient pas toute seule à l'ouverture de l'appli
  if (!reopenShop && d.pick && ["from", "to"].some(w => d.pick[w] && (d.pick[w].shopId || d.pick[w].partnerCode))) { clearDraft(); return; }
  ["from", "to"].forEach(w => { if (d.pick && d.pick[w] && !d.pick[w].partnerCode && !d.pick[w].shopId) onPlacePicked(w, d.pick[w], true); });
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
  if (d.pharma) state.pharma = d.pharma;
  if (d.pharmaOpt) state.pharmaOpt = d.pharmaOpt;
  // Le rayon et sa catégorie reviennent tels quels après un rafraîchissement
  if (d.homeKind && !state.homeKind && EXAMPLES.some(e => e.id === d.homeKind)) applyKind(d.homeKind);
  if (d.pharmaCat) state.pharmaCat = d.pharmaCat;
  syncNoCode();
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
