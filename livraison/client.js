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
// Commande en 3 petits écrans (1. quoi et où · 2. précisions · 3. vous et le paiement)
const wiz = { on: !!(form && form.querySelector("[data-wiz]")), step: 1, n: 2, probe: false, lastTarget: null, toast: null };
const state = { pharma: {}, pharmaCat: "", shop: null, pro: null, promo: null, promoMsg: "", fromPoint: null, toPoint: null, mine: [], settings: { accepting: true }, pick: { from: null, to: null }, stops: [] };
const ac = {};

// --- Écrans : l'accueil ne garde que l'essentiel ; la commande, « Mes courses » et « Tout savoir »
// (tarifs, autres distances, idées, offres, FAQ) s'ouvrent à part, au moment voulu ---------------
const VIEW_OF = { accueil: "home", commander: "order", "mes-courses": "mine" };
const VIEW_HASH = { order: "commander", mine: "mes-courses", infos: "infos" };
const viewOf = el => { const sec = el && el.closest && el.closest("body > section"); return sec ? VIEW_OF[sec.id] || "infos" : null; };
const viewTitle = () => { $("#viewTitle").textContent = { order: t("ordTitle"), mine: t("navMine"), infos: t("infosTitle") }[document.body.dataset.view] || ""; };
// Retour du téléphone : chaque écran retrouve l'endroit où on l'avait laissé (pas de retour en haut, rien de perdu)
const scrollMem = {};
try { history.scrollRestoration = "manual"; } catch (e) { /* vieux navigateur */ }
function setView(v, push) {
  if (!v || document.body.dataset.view === v) return false;
  if (document.body.dataset.view) scrollMem[document.body.dataset.view] = window.scrollY;
  document.body.dataset.view = v;
  viewTitle();
  // Analytique : la commande ouverte (une fois par visite)
  if (v === "order") { let s = null; try { s = sessionStorage.getItem("hop.started"); sessionStorage.setItem("hop.started", "1"); } catch (e) { /* ignore */ } if (!s) UI.track("order_start"); }
  if (push) { history.pushState(null, "", v === "home" ? location.pathname : "#" + VIEW_HASH[v]); here = location.href; }
  window.scrollTo(0, 0);
  // (retour en arrière : on redescend là où on était, une fois l'écran dessiné)
  const back = !push && scrollMem[v];
  if (back) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, back)));
  // La carte de l'accueil était cachée : elle reprend sa vraie taille (sinon des bandes restent vides)
  if (v === "home") requestAnimationFrame(() => { if (home.map) home.map.invalidateSize(); try { ensureDefaultTo(); } catch (e) { /* ignore */ } });
  if (v === "order") requestAnimationFrame(() => { if (wiz.on) wizLabels(); });
  return true;
}
// Un champ de l'adresse repliée en fiche doit être corrigé (erreur à l'envoi) : les champs reviennent
const nativeFocus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (o) {
  // Vérification d'un écran (« Continuer ») : on note seulement le champ à corriger, sans y aller
  // Adresse enregistrée sans code d'entrée : on le demande dans sa fiche résumée, sans rouvrir toute l'adresse
  const sumCode = this === form.dropoff_code && form.classList.contains("to-saved") ? $("#toSum [data-sum-code]") : null;
  if (wiz.probe && form.contains(this)) { wiz.lastTarget = sumCode || this; return; }
  if (sumCode) { if (wiz.on) wizReveal(sumCode); sumCode.closest(".sum-code").classList.add("need"); return nativeFocus.call(sumCode, o); }
  if (wiz.on && form.contains(this)) wizReveal(this);
  if (this.closest && this.closest(".drop-addr") && form.classList.contains("to-saved")) { state.toOpen = true; renderToSum(); }
  return nativeFocus.call(this, o);
};
// Tout ce qui « fait défiler jusqu'à » une partie de la page ouvre d'abord le bon écran
const nativeScrollIntoView = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (o) {
  if (wiz.probe && form.contains(this)) { wiz.lastTarget = this; return; }
  if (wiz.on && form.contains(this)) wizReveal(this);
  setView(viewOf(this), true); return nativeScrollIntoView.call(this, o);
};
function routeHash() {
  if (document.documentElement.classList.contains("vit")) {
    const ch = document.getElementById("accueil"), c = location.hash === "#course";
    if (ch && ch.classList.contains("course") !== c) {
      ch.classList.toggle("course", c);
      if (!c) {
        ch.classList.remove("when-open"); try { setMapOpen(false); } catch (e) { /* accueil pas encore prêt */ }
        // Retour de la carte : la vitrine reprend là où on l'avait laissée
        const y = typeof state !== "undefined" && state.vitY;
        if (y && document.body.dataset.view === "home") requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      }
    }
  }
  const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  setView(el ? viewOf(el) || "home" : "home");
  if (el && !/^(accueil|commander|mes-courses|infos)$/.test(el.id)) requestAnimationFrame(() => nativeScrollIntoView.call(el, { block: "start" }));
}
// Bouton retour du téléphone : il ferme d'abord la fenêtre ouverte (vérification des adresses, panier,
// fiche article…) et on reste sur le même écran, au lieu de changer de page sous la fenêtre
let here = location.href;
const MODAL_CLOSE = { checkModal: "#checkBack", itemSheet: "#itemClose", cartSheet: "#cartClose", ensModal: "#ensClose", buyInfo: "#biClose",
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
  // Commande en 3 écrans : le retour revient à l'écran d'avant (pas à l'accueil)
  if (wiz.on && location.hash === "#commander") {
    const n = (history.state && history.state.wiz) || 1, y = history.state && history.state.y;
    if (n !== wiz.step) { wizGo(n, y != null, true); if (y != null) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y))); }
  }
}
window.addEventListener("hashchange", () => { if (location.href !== here) routeHash(); here = location.href; });
window.addEventListener("popstate", () => { onBack(); here = location.href; });
routeHash();

// Nouveau design (html.d2) : icônes 3D du kit (img/k2), même cadre pour toutes les catégories
const D2 = document.documentElement.classList.contains("d2");
// Accueil vitrine (demande du patron du 06/11/2026) : adresse et heure en haut, recherche, rubriques en grandes vignettes
// colorées, bandeaux qui défilent (commerces à la une + rayons), commerces ; la carte ne s'ouvre que pour une course libre
const VIT = document.documentElement.classList.contains("vit");
function vitOn() { const ch = document.getElementById("accueil"); return VIT && !!ch && !ch.classList.contains("course"); }
// Petit scooter décoratif du bouton Commander (le libellé reste le vrai texte traduit)
const SCOOT_SVG = `<svg class="k2-scoot" viewBox="1 2 35 20" overflow="visible" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 3h4.2c.6 0 1 .3 1.2.8l2.4 6.4a5.5 5.5 0 1 1-2.2 1l-.7-1.8-4.3 6.1a1 1 0 0 1-.8.4h-6.9a5.5 5.5 0 1 1-10.6-2.6A3 3 0 0 1 4.8 10H15l3.6-4H20V5h-1V3zM6.8 15.5a2.6 2.6 0 1 0 5.1.6zM26.3 13a2.6 2.6 0 1 0 1.2-.2l.9 2.3-1.9.7zM9 4h5a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2z"/></svg>`;
const K2_BG = { pharm: ["#013335", "#027363"], tabac: ["#28071E", "#531A3E"], bakery: ["#411C05", "#B35D1B"], shop: ["#081F39", "#0E2847"], baby: ["#021D3E", "#0F365C"],
  pets: ["#013936", "#106D61"], home: ["#051932", "#0D2D4F"], gift: ["#2E071E", "#45112F"] };
const K2_FOND = { pharm: "pharmacie", tabac: "cigarettes-alcool", bakery: "boulangerie", shop: "courses", baby: "bebe-enfants", pets: "animaux", home: "maison-depannage", gift: "fleurs-cadeaux" };
const K2_ICON = { ta: 1,  pharm: 1, tabac: 1, bakery: 1, shop: 1, baby: 1, pets: 1, home: 1, gift: 1, pressing: 1, poste: 1, resto: 1, docs: 1, yad2: 1, keys: 1 };
const k2Icon = (id, e) => `<span class="k2-ic${e ? " k2-e" : ""}"><img src="img/k2/${e ? "e" : "i"}-${id}.webp" alt="" loading="lazy" decoding="async" /></span>`;
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
  $("#perkWelcome").textContent = PROMOS.welcomeOn === false ? "" : t("perkWelcome", { price: money(welcomePrice()) });
  $("#perkWelcome").classList.toggle("hidden", PROMOS.welcomeOn === false);
  const avail = state.settings.accepting;
  // Accueil vitrine : la pastille « Commandez maintenant, on vous livre dès l'ouverture » suffit (pas de doublon),
  // sauf si le patron a écrit son propre message de fermeture
  $("#availBanner").classList.toggle("hidden", avail || (vitOn() && !(state.settings.message || "").trim()));
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
      service: ex.set.service, urgency: ex.set.urgency, size: ex.set.size || "petit", roundTrip: ex.set.round_trip, purchaseKind: ex.id
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
    ${PROMOS.welcomeOn === false ? "" : `<div class="card offer hot"><div class="ico">🎁</div><h3>${UI.esc(t("offWelcome_t", { price: money(welcomePrice()) }))}</h3><p>${UI.esc(t("offWelcome_d", { amount: money(PROMOS.codes.BIENVENUE.amount) }))}</p></div>`}
    <div class="card offer"><div class="ico">🤝</div><h3>${t("offRef_t")}</h3><p>${UI.esc(t("offRef_d", { amount: money(PROMOS.referral.amount) }))}</p></div>
    ${PROMOS.loyalty.on ? `<div class="card offer"><div class="ico">⭐</div><h3>${t("offLoyal_t")}</h3><p>${UI.esc(t("offLoyal_d", { every: PROMOS.loyalty.every, max: money(PROMOS.loyalty.max) }))}</p></div>` : ""}
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

// Offre de 1re course (arrêtée par le patron le 05/11/2026 : PROMOS.welcomeOn = false) : encore possible pour ce client ?
const welcomeOpen = () => PROMOS.welcomeOn !== false && !state.welcomeUsed;
// Code de bienvenue selon la langue (BIENVENUE / BRUCHIM)
function welcomeCode() { return I18N.lang === "he" ? "BRUCHIM" : "BIENVENUE"; }

// Prix d'appel : prix barré + prix de la première course si le client n'a encore rien commandé
function renderQuick() {
  const from = $("#quickFrom").value, to = $("#quickTo").value;
  const full = Pricing.cityToCity(CONFIG, from, to);
  const first = activeOrders().length === 0 && welcomeOpen();
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

// Numéro et site d'une enseigne (bulle de la carte, fiche « Infos », commande par téléphone) :
// on appelle d'un geste, et le site s'ouvre à côté (son adresse courte : « aroma.co.il », ou « Instagram »)
const telOf = n => String(n || "").split(/[;,]/)[0].trim();
const telHref = n => "tel:" + telOf(n).replace(/[^\d+]/g, "");
const webOf = u => { u = String(u || "").trim(); if (u && !/^https?:\/\//i.test(u)) u = "https://" + u; return /^https?:\/\/[^\s"'<>]{4,}$/i.test(u) ? u : ""; };
function siteLabel(u) {
  try { const h = new URL(u).hostname.replace(/^(www|m)\./, ""); return /(^|\.)instagram\.com$/.test(h) ? "Instagram" : /(^|\.)facebook\.com$/.test(h) ? "Facebook" : h; }
  catch (e) { return t("shSite"); }
}
// Numéro d'un commerce partenaire : son téléphone, sinon son WhatsApp (enregistré en 972…)
const shopNum = s => (s && s.cash_ok && !/^HOP/.test(s.code || "") ? CONFIG.bitPhone : s && (s.phone || (s.whatsapp ? "0" + String(s.whatsapp).replace(/^972/, "") : ""))) || "";
// WhatsApp affiché : celui de HOP! pour un commerce géré par HOP! (c'est HOP! qui répond), sinon celui du commerce
const shopWa = s => String((s && s.cash_ok && !/^HOP/.test(s.code || "") ? CONFIG.whatsapp : s && s.whatsapp) || "").replace(/\D/g, "");
function contactRow(num, web) {
  const tel = telOf(num), url = webOf(web);
  if (!tel && !url) return "";
  return `<div class="rp-contact">${tel ? `<a href="${UI.esc(telHref(tel))}" data-shop-call>📞 <bdi dir="ltr">${UI.esc(tel)}</bdi></a>` : ""}${url
    ? `<a href="${UI.esc(url)}" target="_blank" rel="noopener">🌐 <bdi dir="ltr">${UI.esc(siteLabel(url))}</bdi></a>` : ""}</div>`;
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
    const url = webOf(p.website);
    box.innerHTML = (num
      ? `<a class="btn btn-sm btn-wa" href="${UI.esc(telHref(num))}" data-shop-call>📞 ${UI.esc(t("phCall", { name: p.brand }))} · <bdi dir="ltr">${UI.esc(telOf(num))}</bdi></a>`
      : `<small class="muted">${UI.esc(t("phNoNumber", { name: p.brand }))}</small>`)
      + (url ? `<a class="btn btn-sm shop-site" href="${UI.esc(url)}" target="_blank" rel="noopener">🌐 ${UI.esc(t("phSite"))} · <bdi dir="ltr">${UI.esc(siteLabel(url))}</bdi></a>` : "");
  };
  if (callFor === p) return;
  callFor = p;
  box.innerHTML = `<small class="muted">${UI.esc(t("phFinding"))}</small>`;
  Places.phoneOf(p).then(show, () => show(null));
}
function phoneOn() { return phoneOrderOk() && form.phone_order.checked; }
// Commerce HOP! sans paiement en ligne (on commande et on paie directement chez lui) : « Appelez le commerce », puis
// « Elle sera prête dans… » (10, 20, 30 min…) : le livreur est envoyé pour arriver quand c'est prêt (comme une commande par téléphone)
const noPayReadyOn = () => !!(proShopOn() && shopNoPay());
function renderNoPayReady() {
  const box = $("#noPayReady");
  if (!box) return;
  const on = noPayReadyOn();
  box.classList.toggle("hidden", !on);
  if (!on) { box.innerHTML = ""; box.dataset.html = ""; return; }
  const sh = state.shop, name = UI.bi(sh.name), tel = sh.phone || (sh.whatsapp ? "0" + String(sh.whatsapp).replace(/\D/g, "").replace(/^972/, "") : "");
  const html = `<b class="npr-h">📞 ${UI.esc(t("nprTitle", { name }))}</b>
    <small>${UI.esc(t("nprSub", { name }))}</small>
    <div class="npr-btns">${tel ? `<a class="btn btn-primary npr-call" href="${UI.esc(telHref(tel))}" data-shop-call><span>📞 ${UI.esc(t("phCall", { name }))}</span><small dir="ltr">${UI.esc(telOf(tel))}</small></a>` : ""}
      ${sh.whatsapp ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${UI.esc(UI.waLink(sh.whatsapp, t("nopayMsg", { name })))}">💬 WhatsApp</a>` : ""}</div>
    <b class="npr-h">⏱️ ${UI.esc(t("nprReady"))}</b>
    <div class="rate-tags npr-chips">${PH_READY.map(n => `<button type="button" class="ch-chip${state.phoneReady === n ? " on" : ""}" data-ready="${n}">${UI.esc(n ? (n === 60 ? t("nprHour") : t("phMin", { n })) : t("phNow"))}</button>`).join("")}</div>
    <small>${UI.esc(t("nprRule"))}</small>`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
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
const readyAsk = () => ["colis", "repas"].includes(val("service")) && val("urgency") !== "programmee" && !proShopOn() && !phoneOn() && !noPayReadyOn() && !shopMode();
function pickReady(v) {
  form.querySelectorAll('input[name="pickup_ready"]').forEach(r => { r.checked = r.value === String(v); r.closest(".ch-chip").classList.toggle("on", r.checked); });
}
form.addEventListener("change", e => { if (e.target.name === "pickup_ready") pickReady(e.target.value); });
function syncVisibility() {
  const svc = val("service");
  form.notes.closest("label").toggleAttribute("data-more", !!(state.shop && proShopOn()) && !val("notes").trim());
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
  $("#pickupSub").textContent = near || svc === "retrait" ? "" : t("pkSub");
  form.pickup_address.placeholder = svc === "retrait" ? t("placeAddrPh") : t("pkSearchPh");
  $("#whenFields").classList.toggle("hidden", val("urgency") !== "programmee");
  try { renderSlots(); } catch (e) { /* au tout début du chargement : redessiné au passage suivant */ }
  // « Le colis est prêt : tout de suite / dans 15, 30 min, 1 h » : course dès que possible, colis ou repas à récupérer
  // (pas pour un commerce HOP! Pro ni une commande par téléphone : ils ont déjà leur heure « prête »)
  const readyOn = readyAsk();
  $("#readyChips").classList.toggle("hidden", !readyOn);
  pickReady(readyOn ? val("pickup_ready") || "0" : "0");
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
  // « Qui paie la course ? » retiré (demande du patron, 04/11) : c'est toujours le client qui commande
  const payerOn = false;
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
function loyaltyDue() { return !!PROMOS.loyalty.on && (deliveredCount() + 1) % PROMOS.loyalty.every === 0; }

function validatePromo(raw) {
  const code = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { promo: null, msg: "" };
  const first = activeOrders().length === 0;
  const def = PROMOS.codes[code];
  if (def && def.welcome && PROMOS.welcomeOn === false) return { promo: null, msg: t("promoBad"), bad: true };
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

function refuseWelcome(kind) {
  state.promo = null;
  // Même bureau / même maison (même porte) déjà livré avec l'offre : on le dit gentiment, avec une astuce
  const msg = (kind && (t("errWelcomeAddr") || {})[kind]) || t("errWelcomeUsed");
  $("#promoMsg").textContent = msg;
  $("#promoMsg").className = "promo-msg bad";
  renderQuote();
  renderQuick();
  showError(msg);
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
  if (!state.promo && cartGiftDue()) return { kind: "gift", code: "PANIER", amount: CART_GIFT.off };
  return state.promo;
}
// 🎁 Panier retrouvé (règle du patron, 02/11) : un client qui a DÉJÀ fait sa 1re commande (celle à prix réduit) et revient
// finir un panier laissé depuis 30 min à 24 h : −5 ₪ sur la livraison. Au plus une fois par semaine sur ce téléphone.
const CART_GIFT = { off: 5, minMin: 30, maxH: 24, everyDays: 7 }, LS_GIFT = "livraison.cartGift.v1";
var cartAtStart;   // panier retrouvé au lancement de l'appli (rempli plus bas, une fois le panier lu)
function cartGiftDue(atHome) {
  const c = cartAtStart;
  if (!c || !(c.snap && c.snap.count)) return false;
  const age = Date.now() - c.at;
  if (age < CART_GIFT.minMin * 60000 || age > CART_GIFT.maxH * 3600000) return false;
  if (!Array.isArray(state.mine) || !state.mine.some(o => o.status === "livree")) return false;
  let last = 0;
  try { last = Number(localStorage.getItem(LS_GIFT)) || 0; } catch (e) { /* ignore */ }
  if (Date.now() - last < CART_GIFT.everyDays * 86400000) return false;
  return atHome ? true : cartSnap().count > 0;
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
// Ajout à une commande en cours (autre commerce, même adresse) : livraison au prix fixe, pendant 15 min
const addonOn = () => !!(state.addon && proShopOn() && Date.now() < new Date(state.addon.until).getTime() + 60000);
async function initAddon(tok) {
  const info = await Store.orderAddonInfo(tok).catch(() => null);
  if (!info || !info.ok) return;
  const p = await Store.trackOrder(tok).catch(() => null);
  if (!p) return;
  state.addon = { id: info.id, ref: info.ref, until: info.until, price: Number(info.price) || 10 };
  // Même client, même adresse : rien à retaper
  if (p.contact_name && !val("contact_name").trim()) form.contact_name.value = p.contact_name;
  if (p.contact_phone && !val("contact_phone").trim()) form.contact_phone.value = p.contact_phone;
  const m = String(p.dropoff_address || "").match(/^(.*?)\s+(\d+[\w/-]*)$/);
  applySavedAddr("to", { street: m ? m[1] : p.dropoff_address, number: m ? m[2] : "", cityId: p.to_city, city: p.to_city, lat: p.dropoff_lat, lon: p.dropoff_lon,
    brand: p.dropoff_place || null, exact: !!p.dropoff_exact, building: p.dropoff_building, floor: p.dropoff_floor, apt: p.dropoff_apt, code: p.dropoff_code,
    note: p.dropoff_note, kind: p.dropoff_apt ? "appartement" : p.dropoff_floor ? "bureau" : "maison" });
  if (p.dropoff_phone && String(p.dropoff_phone).replace(/\D/g, "").slice(-9) !== String(p.contact_phone || "").replace(/\D/g, "").slice(-9)) {
    form.drop_me.checked = false; form.dropoff_contact.value = p.dropoff_contact || ""; form.dropoff_phone.value = p.dropoff_phone;
  }
  renderAddonBar(); renderQuote();
}
function renderAddonBar() {
  const bar = $("#addonBar");
  if (!bar) return;
  const on = addonOn(), s = on ? Math.max(0, Math.floor((new Date(state.addon.until) - Date.now()) / 1000)) : 0;
  bar.classList.toggle("hidden", !on || !s);
  if (on && s) bar.textContent = t("aoBar", { ref: state.addon.ref, price: money(state.addon.price), time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` });
  if (state.addon && !s && bar.dataset.on) { bar.dataset.on = ""; renderQuote(); }
  if (on && s) bar.dataset.on = "1";
}
setInterval(renderAddonBar, 1000);
function currentQuote() {
  if (addonOn()) return { total: state.addon.price, known: true, distanceKm: 0, lines: [{ key: "qAddon", vars: { ref: state.addon.ref }, amount: state.addon.price }] };
  let q = baseQuote();
  if (!proShopOn()) return q;
  // Boutique HOP! : c'est un achat, déjà compté dans baseQuote (petit achat + articles au-delà des 6 compris)
  if (shopBuy() && !shopGift() && !hopBuyOn()) {
    const fee = Number(CONFIG.pricing.purchase || 5);
    q = Object.assign({}, q, { total: q.total + fee, lines: q.lines.concat([{ key: "qShopBuy", vars: { name: UI.bi(state.shop.name) }, amount: fee }]) });
  }
  if (shopGift()) return Object.assign({}, q, { total: 0, course: q.total, gift: true,
    lines: q.lines.concat([{ key: "qShopGift", vars: { name: UI.bi(state.shop.name) }, amount: -q.total, discount: true }]) });
  // Le commerce paie sa part (12 − 2 = 10 ₪ de moins pour le client), sauf s'il a choisi « le client paie »
  const share = Math.min(q.total, state.shop.client_pays ? 0
    : Number(state.shop.shop_share != null ? state.shop.shop_share : CONFIG.pro.shopShare - CONFIG.pro.hopShare));
  if (!(share > 0)) return q;
  return Object.assign({}, q, { total: q.total - share, lines: q.lines.concat([{ key: "qShopShare", vars: { name: UI.bi(state.shop.name) }, amount: -share, discount: true }]) });
}
// Achats : ce que couvre le supplément (articles et minutes compris) et ce qui s'ajoute seulement si nécessaire.
// Tout vient des vraies règles (config / réglages en ligne) : rien n'est changé dans les prix.
function buyInfo(q) {
  const lines = (q || {}).lines || [], buy = lines.find(l => l.key === "qPurchase" || l.key === "qPurchaseShop");
  if (!buy) return null;
  const PI = CONFIG.pricing.purchaseItems || {}, st = state.settings || {};
  const items = PI.included && (hopBuyOn() || rayonOn()) ? { inc: hopBuyOn() ? HOP_INC : PI.included, each: PI.extraCourier + PI.extraHop, max: PI.max } : null;
  return { buy, base: lines.find(l => /^qBase/.test(l.key)), items, min: Math.max(Number(st.wait_free_min || 0), Number((buy.vars || {}).min || 0)),
    wait: st.wait_step_price != null ? { price: Number(st.wait_step_price), step: Number(st.wait_step_min || 1) } : null };
}
// Zones à part d'une ville (Agamim, zones industrielles…) : prix fixe dans la ville, areas.price entre la ville et une zone
function zoneInfo(city) {
  const A = CONFIG.pricing.areas || {}, list = (A.list || []).filter(z => z.city === city);
  return list.length && A.price ? { names: list.map(z => z[I18N.lang] || z.fr), price: Number(A.price), city } : null;
}
function openBuyInfo() {
  const q = currentQuote(), bi = buyInfo(q) || {}, base = bi.base || (q.lines || []).find(l => /^qBase/.test(l.key));
  const zi = base && zoneInfo((base.vars || {}).city || (base.vars || {}).from);
  if (!bi.buy && !zi) return;
  const row = (ico, title, sub, amt) => `<div class="bi-row"><i aria-hidden="true">${ico}</i><span><b>${UI.esc(title)}</b>${sub ? `<small>${UI.esc(sub)}</small>` : ""}</span>${amt ? `<em>${amt}</em>` : ""}</div>`;
  const m = n => `<bdi dir="ltr">${UI.esc(money(n))}</bdi>`;   // montant toujours lisible, en hébreu aussi
  const incl = !bi.buy ? [] : [bi.items ? t("biInclItems", { n: bi.items.inc }) : "", t("biInclMin", { n: bi.min }), t("biInclTicket"), t("biInclFees")].filter(Boolean);
  const ifs = !bi.buy ? "" : [bi.items ? row("🧺", t("biIfItem"), t("biIfItemSub", { max: bi.items.max }), UI.esc(t("biIfItemV", { each: "§" })).replace("§", m(bi.items.each))) : "",
    bi.wait ? row("⏱️", t("biIfWait"), t("biIfWaitSub", { min: bi.min }), bi.wait.step === 1 ? UI.esc(t("biIfWaitV", { price: "§" })).replace("§", m(bi.wait.price)) : UI.esc(t("biIfWaitVN", { price: "§", n: bi.wait.step })).replace("§", m(bi.wait.price))) : ""].join("");
  $("#biBody").innerHTML = `<h3 class="bi-title">${UI.esc(t("biTitle"))}</h3>
    <div class="bi-card">${base ? row("🛵", lineLabel(base), zi ? t("biDelivCity", { city: cityLabel(zi.city) }) : t("biDelivSub"), m(base.amount)) : ""}${bi.buy ? row("🛒", t("biBuy"), t("biBuySub"), "+ " + m(bi.buy.amount)) : ""}</div>
    ${zi ? `<p class="bi-h">${UI.esc(t("biZonesH"))}</p><div class="bi-card bi-if">${row("📍", zi.names.join(", "), t("biZonesSub", { city: cityLabel(zi.city) }), m(zi.price))}</div>` : ""}
    ${incl.length ? `<p class="bi-h">${UI.esc(t("biIncl"))}</p><ul class="bi-incl">${incl.map(x => `<li>${UI.esc(x)}</li>`).join("")}</ul>` : ""}
    ${ifs ? `<p class="bi-h">${UI.esc(t("biIf"))}</p><div class="bi-card bi-if">${ifs}</div>` : ""}
    <button type="button" class="btn btn-primary btn-lg bi-ok" data-bi-ok>${UI.esc(t("biOk"))}</button>`;
  $("#buyInfo").classList.remove("hidden");
  biOpenedAt = Date.now();
}
// (un « toucher fantôme » juste après l'ouverture ne referme pas la fenêtre par le fond)
let biOpenedAt = 0;
document.addEventListener("click", e => {
  if (e.target.closest("[data-buy-info]")) { e.preventDefault(); return openBuyInfo(); }
  if ((e.target.id === "buyInfo" && Date.now() - biOpenedAt > 400) || e.target.closest("#biClose") || e.target.closest("[data-bi-ok]")) $("#buyInfo").classList.add("hidden");
});
function baseQuote() {
  if (val("payment_method") === "carnet" && carnetOk()) {
    return { total: carnetUnit(), known: true, distanceKm: 0, lines: [{ key: "qCarnet", vars: { n: state.pro.credits - 1 }, amount: carnetUnit() }] };
  }
  return Pricing.computeQuote({
    fromCity: nearMode() ? cityOf("to") : cityOf("from"), toCity: cityOf("to"),
    fromPoint: nearMode() ? state.toPoint : state.fromPoint, toPoint: state.toPoint,
    service: hopBuyOn() ? "achat" : val("service"), urgency: val("urgency"), size: val("size"), quickBuy: tobaccoOnly(),
    units: hopBuyOn() ? cartCount() : rayonUnits(), purchaseKind: hopBuyOn() ? "shop" : purchaseKind(), itemsIncluded: hopBuyOn() ? HOP_INC : null,
    couriers: (home.nearby || []).filter(c => c.free),
    roundTrip: form.round_trip.checked, stops: state.stops.map(s => ({ onWay: stopOnWay(s) })),
    discount: currentDiscount()
  }, CONFIG);
}
// Genre de l'achat : rayon makolet / supermarché ou tabac = petit achat (5 ₪) ; tout le reste = vrai achat en boutique (8 ₪)
function purchaseKind() {
  if (val("service") !== "achat") return null;
  const r = rayonOn();
  return r ? r.kind : tobaccoOnly() ? "tabac" : null;
}
const boutiqueBuy = () => val("service") === "achat" && !proShopOn() && Pricing.purchaseTier(CONFIG, { purchaseKind: purchaseKind() }) === "boutique";
// Seulement des cigarettes (« 2 Marlboro ») : achat express, pas de temps d'achats compté
function tobaccoOnly() {
  if (val("service") !== "achat") return false;
  const parts = shopListText().split(/[\n,;+]|\bet\b/).map(x => x.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(x => TOBACCO_RE.test(x));
}

// « Pourquoi 30 ₪ et pas 25 ? » : la course touche un quartier hors du centre
// Première course : -10 ₪ quel que soit le prix (25 → 15 ₪ ; quartier à 30 → 20 ₪), expliqué au client
const welcomeLine = q => (q.lines || []).find(l => l.discount && l.vars && /^(BIENVENUE|BRUCHIM)$/i.test(l.vars.code || ""));
function welcomeWhy(q) {
  const l = welcomeLine(q);
  if (!l) return "";
  const off = Math.abs(l.amount);
  return `<li class="area-why"><span>${UI.esc(t("qWelcomeWhy", { off: money(off), before: money(Number(q.total) + off), price: money(q.total) }))}</span></li>`;
}
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
  if (wiz.on) return;
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
const shopNoPay = () => !!((proShopOn() || shopDropOn()) && state.shop && !state.shop.pay_link && !state.shop.pay_bit && !state.shop.cash_ok);
// Boutique HOP! (commerce « payé au livreur ») : le client paie tout au livreur à la livraison, en espèces (articles + livraison)
const shopCashOnly = () => !!(proShopOn() && state.shop && state.shop.cash_ok && !state.shop.pay_link && !state.shop.pay_bit);
// Articles achetés pour le client (l'argent des articles passe par le livreur) : c'est un achat, + le prix d'un petit achat (5 ₪)
// Commerce non partenaire (HOP! commande pour le client, ex. McDonald's) : le client choisit comment payer ses articles :
// 🔗 le lien de paiement du commerce (envoyé par HOP!, livraison normale), 📱 Bit à HOP! avant, ou 💵 espèces au livreur.
// Les boutiques HOP! (code HOP…, ex. les jus) restent en espèces au livreur.
const linkOk = () => shopCashOnly() && !/^HOP/.test(state.shop.code || "");
const hasShopGoods = () => cartCount() > 0 || !!val("shop_order").trim();
// Boutique HOP! (jus, Carrefour, BOOOM) : Bit au livreur (choisi d'office, demande du patron) ou espèces (pas de lien) ;
// McDonald's : lien, Bit au livreur ou espèces
const goodsChoice = () => (!shopCashOnly() ? null : !linkOk() ? (["bit", "especes"].includes(state.goodsChoice) ? state.goodsChoice : "bit")
  : ["lien", "bit", "especes"].includes(state.goodsChoice) ? state.goodsChoice : "lien");
// (aussi une commande écrite à la main dans un commerce « payé au livreur ») ; avec le lien, le client paie le commerce lui-même
const shopBuy = () => !!(proShopOn() && !linkOk() && (cartCount() > 0 || (shopCashOnly() && !!val("shop_order").trim())) && !shopPrepay()
  && (shopCashOnly() ? goodsChoice() !== "lien" : val("payment_method") === "cash"));
function applyCashOnly() {
  if (shopCashOnly() && hasShopGoods() && goodsChoice() === "bit" && val("payment_method") !== "bit") form.querySelector('input[name=payment_method][value=bit]').checked = true;
  // Bit reste toujours proposé à côté d'Espèces (le client peut changer d'avis) ; seul un commerce à lien de paiement
  // (McDonald's…) le cache quand les articles sont payés en espèces au livreur
  const only = shopCashOnly() && linkOk() && hasShopGoods() && goodsChoice() === "especes", bit = form.querySelector('input[name=payment_method][value=bit]');
  bit.closest(".choice").classList.toggle("hidden", only);
  if (only && val("payment_method") !== "cash") form.querySelector('input[name=payment_method][value=cash]').checked = true;
}
// Texte de la ligne « vos articles » : payés au commerce, au livreur, par lien ou par Bit à HOP!
const itemsKey = base => (hopBuyOn() ? base + "Hop" + (goodsChoice() === "especes" ? "Cash" : "Bit") : linkOk() && goodsChoice() === "lien" ? base + "Link" : shopCashOnly() && goodsChoice() === "bit" ? base + "Bit" : shopBuy() ? base + "Cash" : base);
function renderGoodsChoice() {
  const box = $("#goodsChoiceBox");
  if (!box) return;
  const on = proShopOn() && shopCashOnly();
  box.classList.toggle("hidden", !on);
  if (!on) { box.innerHTML = ""; box.dataset.html = ""; return; }
  const c = goodsChoice(), name = UI.bi(state.shop.name), fee = Number(CONFIG.pricing.purchase || 5);
  const opt = (v, ic, title, sub, best) => `<button type="button" class="gc-opt${c === v ? " on" : ""}" data-goods-choice="${v}" aria-pressed="${c === v}"><i aria-hidden="true">${ic}</i>
    <span><b>${UI.esc(title)}${best ? ` <em>${UI.esc(t("gcBest"))}</em>` : ""}</b><small>${UI.esc(sub)}</small></span></button>`;
  const html = `<p class="gc-title">${UI.esc(t("gcTitle"))}</p>`
    + (linkOk() ? opt("lien", "🔗", t("gcLink", { name }), t("gcLinkSub", { name }), true) : "") + opt("bit", "📱", t("gcBit"), t(hopBuyOn() ? "gcBitSubHop" : "gcBitSub", { fee })) + opt("especes", "💵", t("gcCash"), t(hopBuyOn() ? "gcCashSubHop" : "gcCashSub", { fee }));
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-goods-choice]");
  if (!b) return;
  state.goodsChoice = b.dataset.goodsChoice;
  renderQuote();
});
// Le client touche « Espèces » ou « Bit » en bas : c'est aussi le choix pour les articles (sinon Bit, choisi d'office,
// reviendrait tout seul et Espèces ne se cocherait jamais)
// (noté dès le toucher : « click » et « input » arrivent avant « change », et le prix recalculé entre-temps recochait Bit)
["click", "input", "change"].forEach(ev => form.addEventListener(ev, e => {
  if (e.target.name !== "payment_method" || !e.target.checked || !shopCashOnly() || linkOk()) return;
  if (e.target.value === "cash") state.goodsChoice = "especes";
  else if (e.target.value === "bit") state.goodsChoice = "bit";
}, true));
function noPayBox(titleKey, noTitle) {
  const sh = state.shop, name = UI.bi(sh.name), num = sh.whatsapp || sh.phone || "";
  const shown = num ? (String(num).replace(/\D/g, "").replace(/^972/, "0")) : "";
  return `<div class="nopay${noTitle ? " bare" : ""}">${noTitle ? "" : `<b>💬 ${UI.esc(t(titleKey || "nopayTitle", { name }))}</b>`}
    <p><i>1</i><span>${UI.esc(t("nopay1", { name }))}</span></p>
    <p><i>2</i><span>${UI.esc(t("nopay2"))}</span></p>
    <p><i>3</i><span>${UI.esc(t("nopay3"))}</span></p>
    ${num ? `<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${UI.esc(UI.waLink(num, t("nopayMsg", { name })))}">${UI.esc(t("nopayBtn", { name }))}</a>
      <small class="nopay-num">WhatsApp : <bdi>${UI.esc(shown)}</bdi></small>` : `<small>${UI.esc(t("nopayNoNum"))}</small>`}</div>`;
}
// Le même mode d'emploi, replié en une ligne au-dessus du catalogue : les produits passent en premier
function noPayMini() {
  const name = UI.bi(state.shop.name);
  return `<details class="nopay-mini"><summary><i>💬</i><span><b>${UI.esc(t("nopayMini", { name }))}</b><small>${UI.esc(t("nopayMiniSub"))}</small></span></summary>${noPayBox(null, true)}</details>`;
}
const shopPrepay = () => !!(proShopOn() && (state.shop.pay_link || state.shop.pay_bit) && (cartCount() || val("shop_order").trim()));
const cashGoods = () => (proShopOn() && cartCount() && !shopPrepay() && !(shopCashOnly() && goodsChoice() !== "especes") ? cartTotal() : goodsPrepay() ? goodsBudget() : 0);
// Espèces impossibles pour cette commande (mêmes règles que le serveur : plafond, et articles avancés par le livreur
// seulement après une 1re course livrée) : dit sous le choix « Espèces » tout de suite, pas en erreur après l'envoi
// Nouveaux clients : en espèces, tout compris (articles + livraison), au plus cash_first_max (100 ₪) tant qu'ils n'ont pas
// cash_first_orders (3) courses livrées. 0 = pas de plafond « nouveau client » (règle coupée, ou historique inconnu : la base décide)
function cashFirstCap() {
  const s = state.settings || {}, n = Number(s.cash_first_orders), max = Number(s.cash_first_max);
  if (!(n > 0) || !(max > 0) || !Array.isArray(state.mine) || state.mineError) return 0;
  return state.mine.filter(o => o.status === "livree").length < n ? max : 0;
}
function cashIssue(q) {
  // Le plafond ne concerne que ce que le livreur avance lui-même (achats) ; les articles d'un commerce partenaire sont encaissés
  // chez le client et rapportés au commerce, sans avance
  const adv = goodsPrepay() ? goodsBudget() : 0;
  if (Number(q.total) + adv > cashMax()) return { hard: true, text: t("errCashMax", { max: money(cashMax()) }) };
  const cap = cashFirstCap();
  if (cap && Number(q.total) + cashGoods() > cap) return { hard: true, text: t("errCashNew", { max: money(cap), n: Number(state.settings.cash_first_orders) }) };
  return null;
}
function renderCash() {
  const on = val("payment_method") === "cash";
  const issue = cashIssue(currentQuote());
  $("#cashChoice").classList.toggle("choice-off", !!(issue && issue.hard));
  $("#cashSmall").textContent = issue && issue.hard ? t("pay_cash_off", { max: money(cashMax()) }) : t("pay_cash_d2", { max: money(Number((state.settings || {}).cash_first_max) || 100) });
  $("#cashBox").classList.toggle("hidden", !on);
  if (!on) return;
  const q = currentQuote(), goods = cashGoods(), total = Number(q.total) + goods;
  $("#cashIssue").classList.toggle("hidden", !issue);
  $("#cashIssue").textContent = issue ? issue.text : "";
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
  // Commerce où HOP! commande pour le client (McDonald's…) : le choix du client (lien de paiement par carte, Bit au livreur, espèces)
  const gc = shopCashOnly() ? goodsChoice() : null;
  const goodsHow = hopBuyOn() ? t("gbHopTicket") : shopPrepay() ? t("gbPrepay", { name, how }) : gc === "lien" ? t("gbLinkAfter", { name }) : gc === "bit" ? t("gbBitCourier")
    : cash && cashGoods() ? t("gbCash") : t("gbAsk", { name });
  box.innerHTML = `<b class="gb-h">${UI.esc(t("gbTitle"))}</b>
    <div class="gb-row"><span><b>${UI.esc(t("gbGoods", { name }))}</b><small>${UI.esc(goodsHow)}</small></span>${goods ? `<b class="gb-amt" dir="ltr">${money(goods)}</b>` : `<small class="gb-free">${UI.esc(t("gbGoodsFree", { name }))}</small>`}</div>
    <div class="gb-row"><span><b>${UI.esc(t("gbRide"))}</b><small>${UI.esc(t(cash ? "gbRideCash" : "gbRideHow"))}</small></span><b class="gb-amt" dir="ltr">${money(q.total)}</b></div>
    ${goods ? `<div class="gb-row gb-total"><span><b>${UI.esc(t("gbTotal"))}</b></span><b class="gb-amt" dir="ltr">${money(goods + Number(q.total))}</b></div>` : ""}
    <small class="gb-never">${UI.esc(t("gbNever"))}</small>`;
}
// Carte « Le livreur avance vos courses » : espèces / Bit et l'appoint choisis directement ici (mêmes champs que l'étape paiement)
$("#goodsModeBox").addEventListener("click", e => {
  const pay = e.target.closest("[data-gm-pay]"), nb = e.target.closest("[data-gm-note]");
  if (!pay && !nb) return;
  e.preventDefault();
  if (pay) {
    if (pay.classList.contains("off")) return;
    const r = form.querySelector(`input[name=payment_method][value=${pay.dataset.gmPay}]`);
    if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
  } else form.cash_note.value = nb.dataset.gmNote;
  renderCash();
  renderQuote();
});
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
  const cashErr = !cash ? "" : b + Number(q.total) > cashMax() ? t("errCashMax", { max: money(cashMax()) }) : "";
  form.budget.closest("label").querySelector("span").textContent = t("gmGoods") + " (₪)";
  // « Le livreur avance vos courses » : 3 étapes, le total à payer, puis espèces / Bit et l'appoint, au même endroit
  const g = rayonGoods(), mid = g ? Math.round(g.mid) : 0, ride = Number(q.total) || 0;
  const cashOff = b + ride > cashMax(), note = Number(form.cash_note.value) || 0;
  const notes = [50, 100, 200].filter(n => n >= (mid || b) + ride);
  const step = (n, txt) => `<div class="gm-st"><span>${n}</span><p>${txt}</p></div>`;
  const strong = (txt, bold) => UI.esc(txt).replace(UI.esc(bold), `<b>${UI.esc(bold)}</b>`);
  sum.innerHTML = `<div class="gm-steps">
      ${step(1, b ? strong(t("gmStep1", { max: money(b) }), money(b)) : UI.esc(t("gmGoodsFree")))}
      ${step(2, UI.esc(t("gmStep2")))}
      ${step(3, UI.esc(t(cash ? "gmStep3Cash" : "gmStep3Bit")))}
    </div>
    <div class="gm-total">
      <div><span>🛵 ${UI.esc(t("gmRide"))}</span><b dir="ltr">${money(ride)}</b></div>
      <div><span>🧾 ${UI.esc(t("gmArts"))}</span><b class="o" dir="ltr">${mid ? "≈ " + money(mid) : b ? "≤ " + money(b) : "—"}</b></div>
      <div class="tot"><span>${UI.esc(t("gmToPay"))}</span><b dir="ltr">${mid ? "≈ " + money(mid + ride) : b ? "≤ " + money(b + ride) : money(ride)}</b></div>
    </div>
    <span class="kind-label">${UI.esc(t("gmPayQ"))}</span>
    <div class="gm-pays">
      <button type="button" class="gm-pay${cash ? " on" : ""}${cashOff ? " off" : ""}" data-gm-pay="cash"><i>💵</i>${UI.esc(t("gmCash"))}</button>
      <button type="button" class="gm-pay${!cash ? " on" : ""}" data-gm-pay="bit"><i>📱</i>${UI.esc(t("gmBit"))}</button>
    </div>
    ${cashOff ? `<small class="gm-cap bad">${UI.esc(t("gmCashOff", { max: money(cashMax()) }))}</small>` : ""}
    ${cash && !cashOff ? `<span class="kind-label">${UI.esc(t("gmChangeQ"))}</span>
      <div class="gm-notes"><button type="button" class="ch-chip${!note ? " on" : ""}" data-gm-note="0">${!note ? "✓ " : ""}${UI.esc(t("gmExact"))}</button>${notes.map(n =>
        `<button type="button" class="ch-chip${note === n ? " on" : ""}" data-gm-note="${n}">${note === n ? "✓ " : ""}${UI.esc(t("gmNote", { n: money(n) }))}</button>`).join("")}</div>
      <p class="gm-ok">${UI.esc(note ? t("gmOkNote", { change: money(Math.max(0, note - (mid || b) - ride)) }) : t("gmOkExact"))}</p>` : ""}
    ${cashErr && !cashOff ? `<small class="gm-cap bad">${UI.esc(cashErr)}</small>` : ""}
    <small class="gm-how">${UI.esc(t("gmBudgetLine", { max: b ? money(b) : "—" }))}</small>
    <small class="gm-cap${over ? " bad" : ""}">${UI.esc(t(over ? "errGoodsCap" : "gmCap", capVars()))}</small>`;
}
function pharmaLines() {
  const r = rayonOn();
  if (!r) return [];
  return rayonPicked(r).map(([k, q]) => {
    const e = rayonEntry(r, k);
    if (!e) return null;
    // (le prix indicatif aide le livreur à voir un prix anormal ; « ×N » reste en fin de ligne : la base compte les articles)
    return `${e.x.e} ${phName(e.x)}${e.v ? " · " + phName(e.v) : ""}${e.p || e.pb ? ` (≈ ${priceTxt(e.p || e.pb)})` : ""} ×${q}`;
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
// Une heure écrite dans le mot au livreur (« à partir de 16 h ») : dite tout de suite, et envoyée comme « pas avant »
function noteNotBefore() { return val("urgency") === "programmee" ? null : UI.noteTime(val("notes")); }
function renderNoteTime() {
  const d = noteNotBefore(), el = $("#noteTime");
  el.classList.toggle("hidden", !d);
  el.textContent = d ? t("noteTime", { time: UI.fmtTime(d) }) : "";
}
// Article sans photo : le petit logo du commerce (jamais une illustration au hasard), sinon l'illustration par nom
function shopArt(p) {
  const logo = state.shop && UI.safeImg(state.shop.logo);
  return logo ? `<span class="item-art logo-art"><img src="${logo}" alt="" loading="lazy" /></span>` : UI.itemArt(p.name, state.shop && state.shop.kind);
}
const notesText = () => (val("service") === "achat" ? val("notes").trim() : pharmaLines().concat(val("notes").trim() ? [val("notes").trim()] : []).join("\n"));
// Rayon façon grande appli de courses : recherche, rubriques en une ligne collante, produits en grille (3 par ligne)
const phNorm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-֑ͯ-ׇ]/g, "");
function renderPharma() {
  const box = $("#pharmaBox"), r = rayonOn();
  box.classList.toggle("hidden", !r);
  if (!r) return;
  const cats = Rayons.cats(r), items = Rayons.items(r);
  if (!cats.some(c => c.id === state.pharmaCat)) state.pharmaCat = (cats[0] || {}).id;
  // Le cadre (avec la recherche) n'est construit qu'une fois par rayon : on peut taper sans perdre le clavier
  if (box.dataset.ray !== r.id || !box.querySelector(".ph-shell")) {
    state.phQ = "";
    box.innerHTML = `<div class="ph-shell"><div class="ph-top"></div>
      <label class="ph-search"><span aria-hidden="true">🔎</span><input type="search" data-ph-q enterkeyhint="search" autocomplete="off" /></label>
      <div class="ph-rest"></div></div>`;
    box.dataset.ray = r.id; box.dataset.top = ""; box.dataset.rest = "";
  }
  const qIn = box.querySelector("[data-ph-q]");
  qIn.placeholder = t("phSearchPh");
  // Image d'un produit ou d'une catégorie : photo du patron, sinon pictogramme, sinon emoji
  const pic = x => (UI.safeImg(x.photo) ? `<img src="${UI.safeImg(x.photo)}" alt="" loading="lazy" />` : x.img ? `<img src="img/qc/${x.img}.webp" alt="" loading="lazy" />` : `<i>${x.e}</i>`);
  const picked = rayonPicked(r), n = picked.reduce((a, [, q]) => a + q, 0);
  const inCat = c => picked.filter(([k]) => (r.items.find(i => i.id === k.slice(r.id.length + 1).split("|")[0]) || {}).c === c).reduce((a, [, q]) => a + q, 0);
  const key = (x, o) => `${r.id}:${x.id}|${o}`;
  const top = `<div class="ph-head"><b>${UI.esc(phName(r.title))}</b><small>${UI.esc(t(val("service") === "achat" ? "phSub" : "phSubNotes"))}</small>${r.id === "tabac" ? "" : `<button type="button" class="ph-share" data-share-ray="${UI.esc(r.id)}" aria-label="${UI.esc(t("shareShop"))}">${SHARE_SVG}</button>`}</div>
    ${rayonMeter(n)}`;
  // Recherche : dans tout le rayon (français et hébreu), sinon la rubrique choisie
  const q = phNorm((state.phQ || "").trim());
  const shown = q ? items.filter(x => phNorm(x.fr + " " + x.he + " " + (x.opt || []).map(o => o.fr + " " + o.he).join(" ")).includes(q)) : items.filter(x => x.c === state.pharmaCat);
  const cur = cats.find(c => c.id === state.pharmaCat);
  const rows = shown.length > 0 && shown.every(x => !x.img && !UI.safeImg(x.photo));
  const card = x => {
    const sel = Number((state.pharmaOpt || {})[r.id + ":" + x.id] || 0), k = key(x, x.opt ? sel : 0), qn = state.pharma[k] || 0;
    // Prix indicatif affiché sur chaque produit (tabac compris : prix approximatif du paquet, demande du patron)
    const o = x.opt && x.opt[sel], pr = (o && o.p) || x.p || (o && o.pb) || x.pb;
    const step = qn ? `<span class="cg-qty"><button type="button" data-ph-minus="${k}" aria-label="−">−</button><b>${qn}</b><button type="button" data-ph-plus="${k}" aria-label="+">+</button></span>`
      : `<button type="button" class="cg-plus" data-ph-plus="${k}" aria-label="${UI.esc(t("cgAdd"))} ${UI.esc(phName(x))}">+</button>`;
    const sel2 = x.opt ? `<select data-ph-opt="${r.id}:${x.id}" aria-label="${UI.esc(phName(x))}">${x.opt.map((o2, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${UI.esc(phName(o2))}${state.pharma[key(x, i)] ? ` (×${state.pharma[key(x, i)]})` : ""}</option>`).join("")}</select>` : "";
    // Rubrique sans images (tabac : la loi interdit les visuels) : une liste nette, une ligne par produit, prix bien visible
    if (rows) return `<div class="ph-line${qn ? " in" : ""}"><span class="pl-txt"><b>${UI.esc(phName(x))}${x.adult ? ` <i class="ph-18">18+</i>` : ""}</b>${sel2}</span>
      ${pr ? `<span class="pl-price"><b>≈ ${priceTxt(pr)}</b>${x.c === "cig" && x.id !== "cartouche" ? `<small>${UI.esc(t("phPerPack"))}</small>` : ""}</span>` : ""}
      <span class="pl-act">${step}</span></div>`;
    return `<div class="ph-item${qn ? " in" : ""}" data-ph-open="${UI.esc(x.id)}">
      <div class="ph-pic${x.photo ? " photo" : ""}${UI.extPic(x.photo) ? " pack" : ""}">${pic(x)}
        ${qn ? `<span class="cg-qty"><button type="button" data-ph-minus="${k}" aria-label="−">−</button><b>${qn}</b><button type="button" data-ph-plus="${k}" aria-label="+">+</button></span>`
          : `<button type="button" class="cg-plus" data-ph-plus="${k}" aria-label="${UI.esc(t("cgAdd"))} ${UI.esc(phName(x))}">+</button>`}</div>
      <div class="ph-info"><span class="ph-price">${pr ? `≈ ${priceTxt(pr)}` : ""}</span>
      <b class="ph-name">${UI.esc(phName(x))}${x.adult ? ` <i class="ph-18">18+</i>` : ""}</b>
      <span class="ph-slot">${x.opt ? `<select data-ph-opt="${r.id}:${x.id}" aria-label="${UI.esc(phName(x))}">${x.opt.map((o, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${UI.esc(phName(o))}${state.pharma[key(x, i)] ? ` (×${state.pharma[key(x, i)]})` : ""}</option>`).join("")}</select>` : ""}</span></div>
    </div>`;
  };
  const rest = `<div class="ph-cats" role="tablist">${cats.map(c => { const k = inCat(c.id), on = !q && state.pharmaCat === c.id;
      return `<button type="button" class="ph-cat${on ? " on" : ""}" role="tab" data-ph-cat="${c.id}" aria-selected="${on}">${pic(c)}<span>${UI.esc(phName(c))}</span>${k ? `<em>${k}</em>` : ""}</button>`; }).join("")}</div>
    <p class="ph-cur">${q ? `<b>${UI.esc(t("phFound", { n: shown.length, q: state.phQ.trim() }))}</b>` : cur ? `${pic(cur)}<b>${UI.esc(phName(cur))}</b><small>${UI.esc(t("phCount2", { n: shown.length }))}</small>` : ""}</p>
    ${rows && shown.some(x => x.pb) ? `<p class="ph-pnote">${UI.esc(t("phPriceNote"))}</p>` : ""}
    ${shown.length ? `<div class="ph-list${rows ? " ph-lines" : " ph-tiles"}">${shown.map(card).join("")}</div>` : `<p class="ph-none">${UI.esc(t("phNone"))}</p>`}
    ${q ? "" : (i => { const prev = cats[i - 1], next = cats[i + 1];
      // En bas de la liste : passer au rayon suivant (ou revenir) sans remonter
      return `<div class="ph-nav">${prev ? `<button type="button" class="ph-prev" data-ph-cat="${prev.id}" data-ph-nav="1">‹ ${UI.esc(phName(prev))}</button>` : "<span></span>"}
        ${next ? `<button type="button" class="ph-next" data-ph-cat="${next.id}" data-ph-nav="1">${UI.esc(t("phNext"))} : ${UI.esc(phName(next))} ›</button>` : ""}</div>`; })(cats.findIndex(c => c.id === state.pharmaCat))}
    ${n ? `<div class="ph-sum"><b>${UI.esc(t("phSum", { n }))}</b>${(g => g ? `<span class="ph-goods">${UI.esc(t("phGoods", { mid: g.mid }))}</span>` : "")(rayonGoods())}<small>${pharmaLines().map(UI.esc).join("<br>")}</small>${supportWho() ? "" : `<button type="button" class="btn btn-ghost btn-block cs-keep" data-cart-keep>📲 ${UI.esc(t("cartKeepBtn"))}</button>`}<button type="button" class="cs-clear" data-cart-clear>🗑 ${UI.esc(t("cartClear"))}</button></div>` : ""}`;
  box.style.setProperty("--rc", r.color);
  if (box.dataset.top !== top) { box.querySelector(".ph-top").innerHTML = top; box.dataset.top = top; }
  if (box.dataset.rest !== rest) { box.querySelector(".ph-rest").innerHTML = rest; box.dataset.rest = rest; }
  // Les rubriques restent collées sous la barre du haut ; la rubrique choisie reste visible dans la ligne
  const bar = ["#viewBar", ".topbar"].map(s2 => document.querySelector(s2)).find(el => el && el.offsetHeight);
  if (bar) box.style.setProperty("--ph-top", (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight - 1 + "px");
  const on = box.querySelector(".ph-cat.on"), row = box.querySelector(".ph-cats");
  if (on && row) { const a2 = on.getBoundingClientRect(), b2 = row.getBoundingClientRect(); if (a2.left < b2.left || a2.right > b2.right) row.scrollLeft += (a2.left + a2.width / 2) - (b2.left + b2.width / 2); }
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
// Encart : texte court et complet (3 exemples, puis le nombre de produits), jamais coupé : la carte garde sa taille
function k2Sub(text) {
  const [list, rest] = String(text).split("…");
  if (rest == null) return text;
  const items = list.split(",").map(x => x.trim()).filter(Boolean).slice(0, 3).join(", ");
  const count = rest.trim().split(/[.,]/)[0].trim();
  return count || items;
}
function renderHomePharma() {
  if (!window.Rayons) return;
  if (D2) {
    // Grands encarts façon maquette : illustration du kit, vrai titre et vrai texte des rayons, bouton visible
    // (accueil vitrine : les commerces à la une passent devant, avec leur photo et leur logo)
    const bans = VIT ? vitBanners() : [];
    const html = `<div class="hp-row k2-row">${bans.join("")}${Rayons.ALL.map(r => {
      const on = state.homeKind === r.kind, title = phName(r.card).replace(/^\P{L}+/u, "");
      const bg = K2_BG[r.kind] || ["#0F1D36", "#1C3157"];
      return `<button type="button" class="k2-card${K2_FOND[r.kind] ? " hop-fond-" + K2_FOND[r.kind] : ""}${on ? " on" : ""}" data-pharma-go="${r.id}" style="--c1:${bg[0]};--c2:${bg[1]}">
        <span class="k2-txt"><em>${UI.esc(t(on ? "hpOnTag" : "hpTag"))}</em><b>${UI.esc(title)}</b>
          <small>${UI.esc(on ? t("hpOnSub") : k2Sub(phName(r.cardSub).replace("{n}", Rayons.items(r).length)))}</small>
          <span class="k2-go">${UI.esc(t("k2Discover"))} <i aria-hidden="true">›</i></span></span>
        <img class="k2-img" src="img/k2/e-${r.kind}.webp" alt="" loading="lazy" decoding="async" /></button>`;
    }).join("")}</div><div class="k2-dots" aria-hidden="true">${bans.concat(Rayons.ALL).map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>`;
    if ($("#homePharma").dataset.html === html) return;
    $("#homePharma").innerHTML = html; $("#homePharma").dataset.html = html;
    const row = $("#homePharma .k2-row");
    row.addEventListener("scroll", () => {
      const w = row.firstElementChild ? row.firstElementChild.offsetWidth + 12 : 1, i = Math.round(Math.abs(row.scrollLeft) / w);
      $("#homePharma .k2-dots").querySelectorAll("i").forEach((d, j) => d.classList.toggle("on", j === i));
    }, { passive: true });
    return;
  }
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
  // (en premier : même si « restaurant » était déjà choisi avant, on montre les restaurants, pas la commande)
  // Accueil vitrine : « Repas de restaurant » montre les restaurants sur HOP! (leurs vrais menus), pas la carte
  if (vitOn() && id === "resto" && (state.showcase || []).some(x => x.kind === "restaurant")) {
    Object.assign(scFilter, { kind: "restaurant", open: false, kosher: false });
    renderShowcase(); $("#homeFilters").classList.remove("hidden");
    // (le filtre « Restaurant » bien en vue dans sa rangée)
    requestAnimationFrame(() => { const r = $("#homeFilters"), on = r && r.querySelector(".ch-chip.on"); if (on) { const a = r.getBoundingClientRect(), b = on.getBoundingClientRect(); r.scrollLeft += (b.left + b.width / 2) - (a.left + a.width / 2); } });
    requestAnimationFrame(() => { const b = $("#homeProBox"), bar = document.querySelector(".topbar");
      if (b) window.scrollTo({ top: Math.max(0, b.getBoundingClientRect().top + window.scrollY - ((bar && bar.offsetHeight) || 0) - 8), behavior: "smooth" }); });
    UI.track("home_resto");
    return;
  }
  // Même type de course, rien d'autre de choisi : on reprend la commande
  if (state.homeKind === id && !state.shop) return goPharma();
  // Sinon on repart de la liste : le commerce ouvert avant (la fiche Nini…) ou le magasin choisi avant
  // (une pharmacie pour une commande de pain…) est oublié
  if (state.shop) leaveShop(true);
  const f = state.pick.from;
  if (f && f.brand) clearHomeAddr("from", true);
  if (state.homeKind === id) state.homeKind = null;   // (applyKind le remet, sans l'enlever)
  // Pharmacie, tabac, makolet… : pas de magasin à choisir, on va droit aux produits (le livreur va au plus proche)
  if (RAYON_KINDS.includes(id)) {
    applyKind(id);
    // Livré chez le client : son adresse enregistrée (la dernière livrée, sinon Maison) est mise d'office
    if (!state.pick.to && !val("dropoff_address").trim()) { const d = defaultDropAddr(); if (d) applySavedAddr("to", d); }
    return goPharma();
  }
  // Nouveau design : « Repas de restaurant » ouvre la grande carte des restaurants (logos, numéro, site),
  // on touche le sien et la commande remonte ; pas de liste par-dessus l'accueil
  if (D2 && id === "resto" && !state.pick.from) { applyKind(id); if (vitOn()) enterCourse(); setMapOpen(true); return; }
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
$("#pharmaBox").addEventListener("input", e => {
  if (!e.target.matches("[data-ph-q]")) return;
  e.stopPropagation();
  state.phQ = e.target.value;
  renderPharma();
});
$("#pharmaBox").addEventListener("keydown", e => { if (e.target.matches("[data-ph-q]") && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
$("#pharmaBox").addEventListener("click", e => {
  const c = e.target.closest("[data-ph-cat]"), plus = e.target.closest("[data-ph-plus]"), minus = e.target.closest("[data-ph-minus]");
  state.pharmaMsg = "";
  if (c) {
    state.pharmaCat = c.dataset.phCat;
    // Changé depuis le bas de la liste : on remonte au début du rayon
    state.phQ = ""; const qi = $("#pharmaBox [data-ph-q]"); if (qi) qi.value = "";
    requestAnimationFrame(() => { const h = $("#pharmaBox .ph-rest"); if (h && (c.dataset.phNav || h.getBoundingClientRect().top < 0)) h.scrollIntoView({ block: "start", behavior: "smooth" }); });
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
  saveDraft();  cartPersist();
});
// Toucher un produit (pas son « + » ni son choix) : sa fiche s'ouvre, comme dans les catalogues des commerces
$("#pharmaBox").addEventListener("click", e => {
  const it = e.target.closest("[data-ph-open]");
  if (!it || e.target.closest("button, select, input, a")) return;
  openRayItem(it.dataset.phOpen);
});
const rayIt = { id: null, opt: 0, qty: 1 };
function openRayItem(id) {
  const r = rayonOn(), x = r && r.items.find(i => i.id === id);
  if (!x) return;
  rayIt.id = id; rayIt.opt = Number((state.pharmaOpt || {})[r.id + ":" + id] || 0); rayIt.qty = 1;
  renderRayItem();
  $("#rayItem").classList.remove("hidden");
}
function renderRayItem() {
  let m = $("#rayItem");
  if (!m) {
    m = document.createElement("div"); m.id = "rayItem"; m.className = "modal hidden item-sheet ray-item"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="modal-box"><button type="button" class="it-x" data-ri-close aria-label="✕">✕</button><div id="rayItemBody"></div>
      <p class="ri-msg hidden" id="rayItemMsg"></p>
      <div class="it-bar"><div class="it-qty"><button type="button" data-ri-qty="-1" aria-label="−">−</button><b id="rayItemQty">1</b><button type="button" data-ri-qty="1" aria-label="+">+</button></div>
      <button type="button" class="btn btn-primary it-add" data-ri-add></button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => {
      if (e.target === m || e.target.closest("[data-ri-close]")) return m.classList.add("hidden");
      const q = e.target.closest("[data-ri-qty]"), o = e.target.closest("[data-ri-opt]");
      if (q) { rayIt.qty = Math.max(1, Math.min(20, rayIt.qty + Number(q.dataset.riQty))); return renderRayItem(); }
      if (o) { rayIt.opt = Number(o.dataset.riOpt); return renderRayItem(); }
      if (!e.target.closest("[data-ri-add]")) return;
      // Même règle que le « + » : 24 articles au plus, et tout doit tenir dans le top case
      const r = rayonOn(), k = `${r.id}:${rayIt.id}|${rayIt.opt}`, en = rayonEntry(r, k);
      let added = 0, msg = "";
      for (let i = 0; i < rayIt.qty; i++) {
        if (rayonUnits() >= PI.max) { msg = t("phMax", { max: PI.max }); break; }
        if (en && rayonPlace() + en.sz > PI.topcase) { msg = t("phFull"); break; }
        state.pharma[k] = (state.pharma[k] || 0) + 1; added++;
      }
      if (added) {
        state.pharmaOpt = Object.assign(state.pharmaOpt || {}, { [r.id + ":" + rayIt.id]: rayIt.opt });
        rayonAdult();
        if (rayonUnits() > 0) form.fits_topcase.checked = true;
        renderPharma(); renderQuote(); saveDraft(); cartPersist(); renderCartIcon();
      }
      if (msg) { $("#rayItemMsg").textContent = msg; $("#rayItemMsg").classList.remove("hidden"); if (!added) return; }
      if (!msg) m.classList.add("hidden");
    });
  }
  const r = rayonOn(), x = r && r.items.find(i => i.id === rayIt.id);
  if (!x) return;
  const o = x.opt && x.opt[rayIt.opt], pr = (o && o.p) || x.p || (o && o.pb) || x.pb, ph = UI.safeImg(x.photo);
  const k = `${r.id}:${x.id}|${x.opt ? rayIt.opt : 0}`, inCart = state.pharma[k] || 0;
  const other = I18N.lang === "he" ? x.fr : x.he;
  $("#rayItemBody").innerHTML = `<div class="it-pic${ph ? " ri-photo" : " ri-picto"}">${ph ? `<img src="${ph}"${UI.imgCors(ph)} alt="" />` : x.img ? `<img src="img/qc/${x.img}.webp" alt="" />` : `<i>${UI.esc(x.e || "🛒")}</i>`}</div>
    <div class="it-txt"><h3><bdi>${UI.esc(phName(x))}</bdi>${x.adult ? ` <i class="ph-18">18+</i>` : ""}</h3>${other && other !== phName(x) ? `<p class="ri-other"><bdi>${UI.esc(other)}</bdi></p>` : ""}
      <div class="it-prow"><span class="cg-price">${pr ? `≈ ${UI.esc(priceTxt(pr))}` : UI.esc(t("ryNoPrice"))}</span>${inCart ? `<span class="it-unit">🛒 ${inCart}</span>` : ""}</div>
      ${x.opt ? `<p class="it-size-h">${UI.esc(t("riChoose"))}</p><div class="it-sizes" role="radiogroup">${x.opt.map((v, i) => `<button type="button" class="it-size${i === rayIt.opt ? " on" : ""}" role="radio" aria-checked="${i === rayIt.opt}" data-ri-opt="${i}"><b>${UI.esc(phName(v))}</b>${v.p ? `<small>≈ ${UI.esc(priceTxt(v.p))}</small>` : ""}${state.pharma[`${r.id}:${x.id}|${i}`] ? `<em>${state.pharma[`${r.id}:${x.id}|${i}`]}×</em>` : ""}</button>`).join("")}</div>` : ""}
      <p class="ri-note">${UI.esc(t("ryCartNote"))}</p></div>`;
  $("#rayItemQty").textContent = rayIt.qty;
  $("#rayItemMsg").classList.add("hidden");
  const each = pr ? priceMid(pr) : 0;
  m.querySelector("[data-ri-add]").innerHTML = `<span>${UI.esc(t("itAdd"))}</span>${each ? `<b>≈ ${UI.esc(money(each * rayIt.qty))}</b>` : ""}`;
}
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
  try { renderMulti(); } catch (e) { /* (pas encore prêt au tout début) */ }
  applyCashOnly();
  renderGoodsChoice();
  renderShopBanner();
  renderShopList();
  renderPharma();
  const q = currentQuote();
  // Courses faites par HOP (ou commande chez un commerce Pro) : les articles au prix du magasin, en plus
  const goods = val("service") === "achat" || proShopOn();
  const bi = buyInfo(q);
  $("#quoteLines").innerHTML = q.lines.map(l => bi && l === bi.buy
    // Achat : un intitulé simple, et en petit ce qui est compris ; le détail au toucher
    ? `<li class="q-buy"><span><span>${UI.esc(t("qBuyT"))}</span><small class="q-sub">${UI.esc(bi.items ? t("qBuySubItems", { n: bi.items.inc, min: bi.min }) : t("qBuySubMin", { min: bi.min }))}
        · <button type="button" class="q-more" data-buy-info>${UI.esc(t("qBuyMore"))}</button></small></span><span dir="ltr">${money(l.amount)}</span></li>`
    : l.key === "qBaseSame" && zoneInfo(l.vars.city)
    // Prix fixe dans la ville ; les zones à part (30 ₪) expliquées au toucher
    ? `<li class="q-buy"><span><span>${UI.esc(lineLabel(l))}</span><small class="q-sub">${UI.esc(t("qFixedCity", { city: cityLabel(l.vars.city) }))}
        · <button type="button" class="q-more" data-buy-info>${UI.esc(t("qBuyMore"))}</button></small></span><span dir="ltr">${money(l.amount)}</span></li>`
    : `<li class="${l.discount ? "disc" : ""}"><span>${UI.esc(lineLabel(l))}</span><span dir="ltr">${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}</span></li>`).join("")
    // Pas de frais cachés : on le montre noir sur blanc
    + `<li class="zero"><span>${UI.esc(t("qService"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + `<li class="zero"><span>${UI.esc(t("qSmall"))}</span><span dir="ltr">${t("qZero")}</span></li>`
    + (goods && proShopOn() && cartCount() ? `<li class="goods"><span>${UI.esc(t(itemsKey("qItems"), { total: money(cartTotal()), name: UI.bi(state.shop.name) }))}</span></li>` : "")
    // Achats payés au livreur : le montant des articles (au maximum) est dans le prix, comme la course
    + (goods && goodsPrepay() && !goodsAfter() ? `<li class="goods-amt"><span>${UI.esc(t("qGoodsMax"))}</span><span dir="ltr">${goodsBudget() ? money(goodsBudget()) : "—"}</span></li>` : "")
    + (goods && goodsAfter() ? `<li class="goods"><span>${UI.esc(t("qGoodsAfter", { max: goodsBudget() ? money(goodsBudget()) : "—" }))}</span></li>` : "")
    + (goods && !goodsAfter() && !(proShopOn() && cartCount()) ? `<li class="goods"><span>${UI.esc(t(proShopOn() ? "qGoodsPro" : goodsPrepay() ? "qGoodsPre" : "qGoods"))}</span></li>` : "")
    + (phoneOn() ? `<li class="goods"><span>${UI.esc(t("qGoodsPhone"))}</span></li>` : "")
    // Zone hors centre (Agamim, zones industrielles) : on explique tout de suite pourquoi ce n'est pas le prix habituel
    + areaWhy(q) + welcomeWhy(q);
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
  const hint = withMax ? "" : items ? t(itemsKey("barItems"), { total: money(items), name: UI.bi(state.shop.name) })
    : unpriced && r0.id === "tabac" ? t("barGoodsShop") : est && !unpriced ? t("barGoodsEst", { mid: est.mid, tot: Number(q.total) + est.mid }) : goods ? t("barGoodsHint") : "";
  $("#mobileHint").textContent = addonOn() ? t("qAddon", { ref: state.addon.ref }) : hint;
  $("#mobileHint").classList.toggle("hidden", !hint);
  $("#mobileHint").classList.toggle("mb-goods", !!(est && !unpriced && !withMax && !items && !addonOn()));
  $("#submitBtn").textContent = wiz.on && wiz.step < wiz.n ? t("wizNext") : t("submit", { total: money(all) });
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
  // Vrai achat en boutique : le plus simple et le moins cher, c'est de commander en direct (on ne paie que la livraison)
  // Fleurs : bouquet déjà commandé chez son fleuriste = simple retrait, au prix de la livraison
  const flowers = val("service") === "achat" && !proShopOn() && purchaseKind() === "gift";
  const ridePrice = money(((q.lines || []).find(l => /^qBase/.test(l.key)) || { amount: CONFIG.pricing.base }).amount);
  const direct = boutiqueBuy() || flowers ? `<div class="direct-tip">
    <img class="dt-hoppy" src="img/hoppy-mini.webp" alt="" width="74" height="120" loading="lazy" decoding="async" />
    <div class="dt-body"><em class="dt-tag">${UI.esc(t("qDirectTag"))}</em>
      <b>${escHop(t(flowers ? "qDirectFlowT" : "qDirectT"))}</b>
      <span>${escHop(t(flowers ? "qDirectFlowS" : "qDirectS", { price: ridePrice }))}</span>
      <button type="button" class="dt-btn" data-direct-ready>${escHop(t(flowers ? "qDirectFlowBtn" : "qDirectBtn", { price: ridePrice }))}</button></div>
    <p class="dt-soon">${escHop(t("qDirectSoon"))}</p></div>` : "";
  $("#quoteNote").innerHTML = `${direct}${UI.esc(main.join(" "))}${more.length ? ` <details class="q-more"${$("#quoteNote").querySelector("details[open]") ? " open" : ""}><summary>${UI.esc(t("qMore"))}</summary>${UI.esc(more.join(" "))}</details>` : ""}`;
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

// --- Commande en 2 écrans (patron, 08/11 : 1. quoi et où · 2. précisions, vous et le paiement) -------------------------------------------------------------
// Chaque bloc porte data-wiz="1|2|3" (un bloc à cheval : "1 2"), les options rares data-more (repliées).
// Les règles ne changent pas : « Continuer » lance les mêmes contrôles que l'envoi et s'arrête
// seulement sur un problème de l'écran affiché (ou d'avant).
function wizStepOf(el) {
  const w = el && el.closest && el.closest("[data-wiz]");
  if (!w) return el && el.closest && el.closest("#summary") ? wiz.n : null;
  const st = w.dataset.wiz.split(" ").map(Number);
  return st.includes(wiz.step) ? wiz.step : st[0];
}
// Une option déjà choisie (idée de l'accueil, brouillon, adresse enregistrée) : les options restent ouvertes
function wizUsedMore() {
  if (state.stops.length || val("payer") === "destinataire" || !form.drop_me.checked) return true;
  return ["post_send", "p2p_sale", "handoff", "round_trip", "leave_at_door"].some(n => form.elements[n] && form.elements[n].checked)
    || ["pickup_building", "pickup_floor", "pickup_apt", "pickup_code", "pickup_note"].some(n => val(n).trim());
}
// Un bloc dont tout est caché sur cet écran (ex. « Où récupérer ? » à l'écran 2 pour un colis) disparaît
function wizEmpty() {
  if (!wiz.on) return;
  // Formulaire caché (on est sur l'accueil) : rien n'a de taille, tout paraîtrait vide ; on recalcule à l'ouverture
  // de la commande (sinon « Adresse de livraison » restait cachée jusqu'à un rafraîchissement)
  if (!form.getClientRects().length) { form.querySelectorAll("fieldset.wiz-empty").forEach(fs => fs.classList.remove("wiz-empty")); return; }
  form.querySelectorAll("fieldset[data-wiz]").forEach(fs => {
    fs.classList.remove("wiz-empty");
    const kids = [...fs.children].filter(k => k.tagName !== "LEGEND");
    const inner = kids.flatMap(k => (k.matches(".fields") ? [...k.children] : [k]));
    if (inner.length && !inner.some(k => k.getClientRects().length)) fs.classList.add("wiz-empty");
  });
}
function wizLabels() {
  if (!wiz.on) return;
  wizEmpty();
  const n = wiz.step;
  $("#wizStepTxt").textContent = t("wizStep", { n, of: wiz.n });
  $("#wizTitle").textContent = t("wizT" + n);
  $("#wizBack").classList.toggle("off", n === 1);
  form.querySelectorAll(".wiz-seg i").forEach((i, k) => i.classList.toggle("on", k < n));
  const more = form.classList.contains("wiz-more");
  form.querySelectorAll("[data-wiz-more] b").forEach(b => { b.textContent = t(more ? "wizLess" : "wizMore"); });
  if (n < wiz.n) $("#submitBtn").textContent = t("wizNext");
  $("#mobileGo").textContent = n < wiz.n ? t("wizNext") : t("navOrder");
}
// Un écran sans rien à remplir (adresse enregistrée complète, commande chez un commerce) : on passe par-dessus
function wizStepEmpty(n) {
  const was = form.dataset.step;
  form.dataset.step = String(n);
  wizEmpty();
  const any = [...form.querySelectorAll("fieldset[data-wiz]")].some(fs => fs.dataset.wiz.split(" ").includes(String(n)) && !fs.classList.contains("wiz-empty") && fs.getClientRects().length);
  form.dataset.step = was;
  wizEmpty();
  return !any;
}
function wizGo(n, stay, fromBack) {
  if (!wiz.on) return;
  // (noté avant toute vérification : en vérifiant, l'écran change un instant de hauteur)
  const y0 = wiz.y0 != null ? wiz.y0 : window.scrollY; wiz.y0 = null;
  if (n === 2 && n !== wiz.step && wiz.n >= 3 && proShopOn() && wizStepEmpty(2)) n = wiz.step < 2 ? 3 : 1;
  const was = wiz.step;
  wiz.step = Math.max(1, Math.min(wiz.n, n));
  // Écran suivant : une page de plus dans l'historique (le retour du téléphone revient à l'écran d'avant)
  // (l'endroit de la page est noté sur l'écran qu'on quitte, pour y revenir pile)
  if (!fromBack && wiz.step > was && document.body.dataset.view === "order") {
    try { history.replaceState(Object.assign({}, history.state, { y: y0 }), ""); } catch (e) { /* ignore */ }
    history.pushState({ wiz: wiz.step }, "", "#commander"); here = location.href;
  }
  form.dataset.step = wiz.step;
  cartStepSet("e" + wiz.step + "/" + wiz.n);
  if (wizUsedMore()) form.classList.add("wiz-more");
  wizShowErr("");
  renderQuote();
  wizLabels();
  if (!stay) requestAnimationFrame(() => { const bar = $("#wizBar"); if (bar) window.scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 76), behavior: "smooth" }); });
}
// Un champ d'un autre écran (ou dans les options) doit être corrigé : on l'affiche d'abord
function wizReveal(el) {
  const st = wizStepOf(el);
  if (st && st !== wiz.step) wizGo(st, true);
  if (el.closest && el.closest("[data-more]") && !form.classList.contains("wiz-more")) { form.classList.add("wiz-more"); wizLabels(); }
}
function wizNext() {
  if (!wiz.on) return;
  wiz.y0 = window.scrollY;
  wiz.probe = true; wiz.lastTarget = null;
  let ok = false;
  try { ok = validateOrder(); } finally { wiz.probe = false; }
  const msg = $("#formError").textContent, tgt = wiz.lastTarget;
  const st = ok ? wiz.n + 1 : tgt ? wizStepOf(tgt) || wiz.step : wiz.step;
  if (st > wiz.step) { showError(""); UI.track && UI.track("order_step_" + (wiz.step + 1)); return wizGo(wiz.step + 1); }
  // Le problème est sur cet écran (ou un écran d'avant) : on y va et on le montre
  if (UI.track) UI.track("order_block", { page: ("e" + wiz.step + ":" + (tgt ? tgt.name || tgt.id || tgt.className : "?")).slice(0, 40) });
  showError(msg);
  if (tgt) { if (typeof tgt.focus === "function" && tgt.matches("input, select, textarea, button")) tgt.focus(); else tgt.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
function wizShowErr(msg) {
  let box = $("#wizToast");
  if (!box) { box = document.createElement("div"); box.id = "wizToast"; box.className = "wiz-toast hidden"; box.setAttribute("role", "alert"); document.body.appendChild(box); }
  clearTimeout(wiz.toast);
  box.textContent = msg || "";
  box.classList.toggle("hidden", !msg);
  if (msg) wiz.toast = setTimeout(() => box.classList.add("hidden"), 7000);
}
if (wiz.on) {
  form.classList.add("wiz");
  form.dataset.step = "1";
  $("#wizBack").addEventListener("click", () => { if (history.state && history.state.wiz === wiz.step && wiz.step > 1) history.back(); else wizGo(wiz.step - 1); });
  form.addEventListener("change", () => requestAnimationFrame(wizEmpty));
  form.addEventListener("click", e => {
    if (!e.target.closest("[data-wiz-more]")) return;
    form.classList.toggle("wiz-more");
    wizLabels();
  });
}

function showError(msg) {
  $("#formError").textContent = msg || "";
  $("#formError").classList.toggle("hidden", !msg);
  // Commande en 3 écrans : le message s'affiche aussi sur l'écran du problème
  if (msg && wiz.on && !wiz.probe) wizShowErr(msg);
  else if (!msg) wizShowErr("");
}
const showErrorFalse = msg => { showError(msg); return false; };

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
  // Une autre adresse choisie (pas « Ma position ») : les numéros voisins proposés ne valent plus
  if (!p.gps) { const old = document.querySelector(`.num-chips[data-for="${prefixOf(which)}"]`); if (old) old.remove(); }
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

// « Récupérer où ? » : le client tape un produit (eau, couches, Acamol, sushi…) au lieu d'un magasin.
// On lui propose le rayon HOP! qui l'a (le livreur va au magasin le plus proche) et les catalogues des commerces.
// Recherche intelligente (06/11/2026) : synonymes FR / HE / translittération (pain = לחם = lehem), singulier / pluriel,
// petites fautes de frappe ; les synonymes viennent de la base (search_synonyms, le patron peut en ajouter)
const synNorm = x => phNorm(String(x || "").replace(/œ/gi, "oe")).replace(/\s+/g, " ").trim();
let SYN = [];
Store.searchSynonyms().then(l => { if (Array.isArray(l)) SYN = l.map(g => (g || []).map(synNorm)); }).catch(() => {});
function searchTerms(q) {
  const n = synNorm(q), out = new Set([n]);
  if (n.length > 3 && /[sx]$/.test(n)) out.add(n.slice(0, -1));
  for (const g of SYN) if ([...out].some(t => g.includes(t))) g.forEach(w => out.add(w));
  return [...out].filter(t => t.length >= 2);
}
// Distance d'édition (fautes de frappe), arrêtée dès qu'elle dépasse max
function editDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); low = Math.min(low, cur[j]); }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function rayonHits(q, max) {
  const n = synNorm(q);
  if (n.length < 3 || !window.Rayons) return [];
  const terms = searchTerms(q), out = [], seen = new Set();
  // Début d'un mot seulement (« eau » ne trouve pas « gâteau », « מים » pas « קונדומים ») ; les courses du quotidien d'abord
  const at = (txt, k) => k === 0 || /[\s(/'-]/.test(txt[k - 1]);
  const word = txt => { let best = -1; for (const t of terms) for (let k = txt.indexOf(t); k >= 0; k = txt.indexOf(t, k + 1)) if (at(txt, k)) { if (best < 0 || k < best) best = k; break; } return best; };
  const all = [];
  for (const r of Rayons.ALL) for (const i of Rayons.items(r)) {
    const name = synNorm(`${i.fr} ${i.he}`), opts = synNorm((i.opt || []).map(o => `${o.fr} ${o.he}`).join(" "));
    all.push({ r, i, name, opts });
    const k = word(name), ko = k < 0 ? word(opts) : -1;
    if (k < 0 && ko < 0) continue;
    out.push({ r, i, s: (k === 0 ? 0 : k > 0 ? 1 : 2) * 2 + (r.id === "super" ? 0 : 1) });
  }
  // Rien trouvé : une faute de frappe ? (« chocolta », « bnaane ») : un mot du produit presque pareil
  if (!out.length && n.length >= 4) {
    const lim = n.length >= 7 ? 2 : 1;
    for (const x of all) {
      const ws = `${x.name} ${x.opts}`.split(/[\s(/,'-]+/).filter(w => w.length >= 3);
      let d = lim + 1, at0 = false;
      ws.forEach((w, k) => { const e = editDist(n, w, lim); if (e < d || (e === d && k === 0)) { d = e; at0 = k === 0; } });
      // (le mot presque pareil au début du nom passe devant : « chocolta » → « Chocolat » avant « Lait chocolaté »)
      if (d <= lim) out.push({ r: x.r, i: x.i, s: 10 + d * 4 + (at0 ? 0 : 2) + (x.r.id === "super" ? 0 : 1) });
    }
  }
  return out.sort((a, b) => a.s - b.s).filter(x => { const key = phNorm(x.i.fr); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, max);
}
function goRayonFind(r, q) {
  goKind(r.kind);
  state.phQ = q;
  renderPharma();
  const qIn = document.querySelector("#pharmaBox [data-ph-q]");
  if (qIn) qIn.value = q;
}
const prodSuggest = q => rayonHits(q, 4).map(({ r, i }) => ({ quick: true, prod: true, icon: i.e || "🛒",
  title: I18N.lang === "he" ? i.he || i.fr : i.fr, sub: t("acRayon", { rayon: phName(r.title) }), apply: () => goRayonFind(r, q) }));
// « Où acheter ? » : on cherche un magasin ou une adresse, jamais un produit (demande du patron, 06/11/2026)
const buySuggest = q => (val("service") === "achat" ? [] : prodSuggest(q));
const buySuggestLater = q => (val("service") === "achat" ? Promise.resolve([]) : prodSuggestLater(q));
async function prodSuggestLater(q) {
  if (phNorm(q).trim().length < 3) return [];
  // Produit de nos rayons (eau, lait…) : seulement les commerces qui en vendent vraiment, pas les restaurants
  const staple = rayonHits(q, 1).length > 0;
  // Un résultat par commerce : « 61 articles “eau” chez HOP! chez Carrefour · dès 2,5 ₪ » ; le toucher ouvre le commerce
  // avec la recherche déjà remplie (tous les articles trouvés, pas un seul)
  const shops = ((await Store.productsSearchShops(q)) || []).filter(p => !staple || !/restaurant|resto|cafe/i.test(p.kind || ""));
  const qq = q.trim();
  return shops.slice(0, 4).map(p => ({ quick: true, prod: true, top: true, icon: "⭐",
    title: t(Number(p.n) > 1 ? "acShopHits" : "acShopHit", { n: p.n, q: qq, shop: UI.bi(p.shop) }),
    sub: (Number(p.n) > 1 ? t("acFrom", { price: money(p.min) }) : money(p.min)) + ((p.sample || []).length ? " · " + p.sample.slice(0, 2).map(x => UI.bi(String(x).replace(/\s*\[[^\]]*\]\s*$/, ""))).join(", ") : ""),
    apply: () => { state.findItem = null; state.cgQNext = qq; state.shopDir = ""; loadShop(p.code); } }));
}
// Hauteur réelle de la barre du bas (elle grandit avec le détail du prix) : « Voir la commande » se pose au-dessus, jamais dessous
(function watchMobileBar() {
  const bar = document.getElementById("mobileBar");
  if (!bar || !window.ResizeObserver) return;
  new ResizeObserver(() => { const h = bar.offsetHeight; if (h) document.documentElement.style.setProperty("--mb-h", h + "px"); }).observe(bar);
})();
function attachPlaces() {
  ["from", "to"].forEach(which => {
    ac[which] = Places.attach(form.elements[which === "from" ? "pickup_address" : "dropoff_address"], {
      lang: () => I18N.lang,
      texts: () => ({ none: t("addrNone"), down: t("addrDown"), partner: t("ensPartner"), notOnMap: t("addrNotOnMap"), notOnMapSub: t("addrNotOnMapSub"), brandAddr: t("addrBrandAddr"), soon: t("addrSoon"), didYouMean: t("addrDidYou") }),
      onPick: p => onPlacePicked(which, p),
      quick: () => quickPlaces(which, false),
      suggest: which === "from" ? buySuggest : null,
      groceryOnly: which === "from" ? (q => val("service") === "achat" && rayonHits(q, 1).length > 0) : null,
      suggestLater: which === "from" ? buySuggestLater : null,
      streetsOnly: which === "to",
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

// Netanya d'abord : nos clients habitent Netanya, leurs adresses de Netanya (ou de la ville de départ) passent en tête
function cityRank(a) {
  const c = a && (a.cityId || a.city), from = (typeof cityOf === "function" && cityOf("from")) || CONFIG.homeCity;
  return c === from ? 0 : c === CONFIG.homeCity ? 1 : 2;
}
const byCityFirst = (x, y) => cityRank(x.a || x) - cityRank(y.a || y);
function tagName(a) { return a.tag === "home" ? t("tagHome") : a.tag === "work" ? t("tagWork") : a.tag ? a.name : ""; }
// Raccourcis de la liste des adresses : « Ma position » puis les adresses enregistrées
function quickPlaces(which, isHome) {
  const after = () => { const p = state.pick[which]; if (p && home.ac[which]) home.ac[which].setPicked(p.label); if (p && ac[which]) ac[which].setPicked(p.label); syncHome(); };
  // « Où acheter ? » : ni « Ma position » ni la maison, seulement les commerces enregistrés (la recherche trouve les autres)
  if (which === "from" && val("service") === "achat") return (val("shopping_list") + val("notes")).trim() ? [] : Store.getAddresses().filter(a => a.brand).sort(byCityFirst).slice(0, 6).map(a => ({ quick: true, icon: addrIcon(a), title: addrLabel(a), sub: "",
    match: addrLabel(a), apply: () => { applySavedAddr(which, a); after(); } }));
  const list = [{ quick: true, icon: "📍", title: t("myPosChip").replace(/^📍\s*/, ""), sub: t("qpPosSub"), apply: async () => {
    const err = await locateInto(which);
    if (err) (isHome ? showHomeErr : showError)(t(err)); else after();
  } }];
  // Livraison : chez le client, jamais à l'adresse d'un commerce enregistré (les commerces restent pour « Récupérer où ? »)
  const other = state.pick[which === "from" ? "to" : "from"];
  Store.getAddresses().filter(a => (which !== "to" || !a.brand) && !(other && isSavedPick(other, a))).sort(byCityFirst).slice(0, 10).forEach(a => list.push({ quick: true, icon: addrIcon(a), title: tagName(a) || addrLabel(a), sub: tagName(a) ? addrLabel(a) : "",
    match: [tagName(a), addrLabel(a)].join(" "),
    apply: () => { applySavedAddr(which, a); after(); } }));
  return list;
}

function renderSavedAddrs() {
  const list = Store.getAddresses();
  if (list.length) setTimeout(() => { try { ensureDefaultTo(); } catch (e) { /* ignore */ } }, 0);
  if (home.ac.from) renderHomeStatic();
  // Comme dans les applis : 🏠 Maison et 💼 Travail toujours proposés (à ajouter s'ils manquent), puis les autres adresses
  const slot = tag => { const i = list.findIndex(a => a.tag === tag); return i >= 0
    ? `<button type="button" class="addr-chip tagged" data-addr="${i}">${addrChip(list[i])}</button>`
    : `<button type="button" class="addr-chip add" data-add-tag="${tag}">＋ ${tag === "home" ? "🏠 " + UI.esc(t("tagHome")) : "💼 " + UI.esc(t("tagWork"))}</button>`; };
  const others = list.map((a, i) => ({ a, i })).filter(x => x.a.tag !== "home" && x.a.tag !== "work").sort(byCityFirst).slice(0, 4);
  const html = `<small>${UI.esc(t("savedTitle"))}</small>${slot("home")}${slot("work")}`
    + others.map(x => `<button type="button" class="addr-chip" data-addr="${x.i}">${addrChip(x.a)}</button>`).join("")
    + `<button type="button" class="addr-chip add" data-add-tag="other">＋ ${UI.esc(t("asAddOther"))}</button>`;
  document.querySelectorAll(".saved-addrs").forEach(box => { box.classList.remove("hidden"); box.dataset.key = ""; box.innerHTML = box.dataset.for === "to" ? toAddrsHtml(list) : box.dataset.for === "from" ? fromAddrsHtml(list) : html; });
  markAddrChips();
}
// « Récupérer où ? » : la recherche d'abord (voir styles), puis une liste propre : Ma position, puis les adresses et
// commerces enregistrés (une ligne chacun : nom en gras, adresse dessous) ; celle choisie est cochée
function fromAddrsHtml(list) {
  const sub = a => UI.esc([`${a.street || ""} ${a.number || ""}`.trim(), cityLabel(a.cityId || a.city)].filter(Boolean).join(", ") + (a.apt ? ` · ${t("aptShort")} ${a.apt}` : ""));
  const title = a => a.brand ? UI.bi(a.brand) : tagName(a) || `${a.street || ""} ${a.number || ""}`.trim();
  // adresse sans nom : la rue en titre, seulement la ville (et l'appartement) dessous
  const line = a => a.brand || tagName(a) ? sub(a) : UI.esc(cityLabel(a.cityId || a.city) + (a.apt ? ` · ${t("aptShort")} ${a.apt}` : ""));
  const ico = a => a.brand ? "🏪" : a.tag === "home" ? "🏠" : a.tag === "work" ? "💼" : "📍";
  // « Où acheter ? » : jamais la maison ni « Ma position » ; les magasins qui vont avec la commande (demande du patron, 06/11/2026)
  // (ses commerces enregistrés, restaurants compris, seulement tant qu'il n'a pas dit ce qu'il veut)
  if (val("service") === "achat") return buyShopsHtml((val("shopping_list") + val("notes")).trim() ? [] : list.map((a, i) => ({ a, i })).filter(x => x.a.brand).sort(byCityFirst).slice(0, 4), ico, title, line);
  // (l'adresse déjà choisie pour la livraison n'est jamais proposée comme départ, et inversement)
  const rows = list.map((a, i) => ({ a, i })).filter(x => !(state.pick.to && isSavedPick(state.pick.to, x.a))).sort(byCityFirst).slice(0, 6);
  return `<p class="pk-h">${UI.esc(t("pkSaved"))}</p><div class="pk-list">
    <button type="button" class="pk-row pk-pos" data-geo="from"><i aria-hidden="true">🧭</i><span><b>${UI.esc(t("pkPos"))}</b><small>${UI.esc(t("pkPosSub"))}</small></span></button>
    ${rows.map(x => `<button type="button" class="pk-row" data-addr="${x.i}"><i aria-hidden="true">${ico(x.a)}</i><span><b>${UI.esc(title(x.a))}</b><small>${line(x.a)}</small></span><em class="sa-tick" aria-hidden="true">✓</em></button>`).join("")}
  </div>`;
}
// Les magasins pour la commande : d'après ce qu'il a écrit (lait, pain → supermarchés ; Acamol → pharmacies…),
// les boutiques HOP! qui ont ces produits (HOP! chez Carrefour…), « le plus proche » (le livreur choisit), ses commerces enregistrés
const RAY_ENS = { super: "super", pharm: "pharm", bakery: "breakfast", baby: "baby", pets: "pet", home: "home", gift: "flower", tabac: "super" };
function buyCats() {
  const txt = [val("shopping_list"), val("notes")].join(",");
  const cats = [];
  parseList(txt).concat(txt.trim() && !parseList(txt).length ? [{ name: txt }] : []).forEach(it => {
    const h = rayonHits(it.name, 1)[0], c = h && RAY_ENS[h.r.id];
    if (c && !cats.includes(c)) cats.push(c);
  });
  return cats.length ? cats.slice(0, 3) : ["super"];
}
function buyShopsHtml(saved, ico, title, line) {
  const cats = buyCats();
  const hop = cats.includes("super") ? (state.showcase || []).filter(x => isHopShop(x) && x.products).slice(0, 2) : [];
  const row = (attrs, icon, b, sm) => `<button type="button" class="pk-row" ${attrs}><i aria-hidden="true">${icon}</i><span><b>${b}</b><small>${sm}</small></span></button>`;
  return `<p class="pk-h">${UI.esc(t("pkBuyH"))}</p><div class="pk-list">
    ${hop.map(x => row(`data-pro="${UI.esc(x.code)}"`, "🛒", escHop(UI.bi(x.name)), UI.esc(t("pkHopSub")))).join("")}
    ${cats.map(c => row(`data-buy-ens="${c}"`, "🏪", UI.esc(String(t("ens_" + c)).replace(/^\P{L}+/u, "")), UI.esc(t("pkEnsSub")))).join("")}
    ${row("data-buy-near", "🧭", UI.esc(String(t("pkNear")).replace(/^\P{L}+/u, "")), UI.esc(t("pkNearSub")))}
    ${saved.map(x => `<button type="button" class="pk-row" data-addr="${x.i}"><i aria-hidden="true">${ico(x.a)}</i><span><b>${UI.esc(title(x.a))}</b><small>${line(x.a)}</small></span><em class="sa-tick" aria-hidden="true">✓</em></button>`).join("")}
  </div>`;
}
document.addEventListener("click", e => {
  const en = e.target.closest(".saved-addrs [data-buy-ens]");
  if (en) return openEns(en.dataset.buyEns);
  if (e.target.closest(".saved-addrs [data-buy-near]")) { form.nearest_store.checked = true; form.nearest_store.dispatchEvent(new Event("change", { bubbles: true })); return; }
  const pr = e.target.closest(".saved-addrs [data-pro]");
  if (pr) { state.shopDir = ""; loadShop(pr.dataset.pro); }
});
// « Où livrer ? » : on livre le client chez lui → 🏠 Maison en grande carte, 💼 Travail en plus petit, les autres adresses
// repliées en une ligne ; jamais un commerce enregistré (il reste proposé seulement pour « Récupérer où ? »)
function toAddrsHtml(list) {
  const idx = tag => list.findIndex(a => a.tag === tag && !a.brand);
  const sub = a => UI.esc([`${a.street || ""} ${a.number || ""}`.trim(), cityLabel(a.cityId || a.city)].filter(Boolean).join(", ") + (a.apt ? ` · ${t("aptShort")} ${a.apt}` : ""));
  const h = idx("home"), w = idx("work");
  // Adresse enregistrée déjà choisie : seulement SA carte (pas de « Travail », « Autres adresses »…) ; « Changer d'adresse » rouvre la liste
  const pi = list.findIndex(a => !a.brand && isSavedPick(state.pick.to, a));
  const pickName = a => a.tag === "home" ? t("tagHome") : a.tag === "work" ? t("tagWork") : a.name || t("asOther");
  if (pi >= 0 && !state.toOpen && !state.toChoose) {
    // Au plus simple : UNE carte (où, et les détails en petit) et UN bouton « Changer »
    const a = list[pi], tg = a.tag === "home" || a.tag === "work" ? a.tag : "other", det = addrDet(a);
    return `<div class="sa-card sa-${tg} on sa-picked"><i aria-hidden="true">${tg === "home" ? "🏠" : tg === "work" ? "💼" : "📍"}</i>
      <span><b>${UI.esc(pickName(a))}</b><small>${sub(a)}</small></span>
      <button type="button" class="sa-change" data-sum-change>${UI.esc(t("sumChangeShort"))}</button>${det ? `<small class="sa-det">${UI.esc(det)}</small>` : ""}${farNote(a)}</div>`;
  }
  // Liste propre (comme « Récupérer où ? ») : Maison, Travail, les autres adresses, puis « Une autre adresse »
  const rows = list.map((a, i) => ({ a, i })).filter(x => !x.a.brand && !(state.pick.from && isSavedPick(state.pick.from, x.a)))
    .sort((x, y) => byCityFirst(x, y) || ({ home: 0, work: 1 }[x.a.tag] ?? 2) - ({ home: 0, work: 1 }[y.a.tag] ?? 2)).slice(0, 6);
  const rTitle = a => tagName(a) || `${a.street || ""} ${a.number || ""}`.trim();
  const rLine = a => tagName(a) ? sub(a) : UI.esc(cityLabel(a.cityId || a.city) + (a.apt ? ` · ${t("aptShort")} ${a.apt}` : ""));
  const rIco = a => a.tag === "home" ? "🏠" : a.tag === "work" ? "💼" : "📍";
  const addRow = tag => `<button type="button" class="pk-row pk-add" data-add-tag="${tag}"><i aria-hidden="true">${tag === "home" ? "🏠" : "💼"}</i><span><b>＋ ${UI.esc(t(tag === "home" ? "tagHome" : "tagWork"))}</b><small>${UI.esc(t("pkAddSub"))}</small></span></button>`;
  return `<div class="pk-list">${rows.map(x => `<button type="button" class="pk-row" data-addr="${x.i}" data-addr-tag="${x.a.tag || "other"}"><i aria-hidden="true">${rIco(x.a)}</i><span><b>${UI.esc(rTitle(x.a))}</b><small>${rLine(x.a)}</small></span><em class="sa-tick" aria-hidden="true">✓</em></button>`).join("")}
    ${h < 0 ? addRow("home") : ""}${w < 0 ? addRow("work") : ""}
    <button type="button" class="pk-row pk-new" data-sum-other><i aria-hidden="true">✏️</i><span><b>${UI.esc(t("sumOther"))}</b><small>${UI.esc(t("pkOtherSub"))}</small></span></button></div>
    ${pi >= 0 && state.toChoose ? `<button type="button" class="sa-link sa-edit" data-sum-edit="${pi}">${UI.esc(t("accEdit"))} · ${UI.esc(pickName(list[pi]))}</button>` : ""}`;
}
// Adresse de livraison dans une autre ville que le départ : on le dit clairement sur la carte (prix entre deux villes)
function farNote(a) {
  const to = a.cityId || a.city, from = cityOf("from") || CONFIG.homeCity;
  if (!to || !from || to === from) return "";
  return `<small class="sa-far">🚗 ${UI.esc(t("saFar", { city: cityLabel(to), from: cityLabel(from) }))}</small>`;
}
// Détails d'une adresse enregistrée, en une ligne (type, bâtiment, étage, code, note)
function addrDet(a) {
  return [a.kind ? t("kind_" + a.kind) : "", a.building ? t("building") + " : " + a.building : "", a.floor ? t("floor") + " : " + a.floor : "",
    NO_CODE.test(a.code || "") ? t("noCode") : a.code ? t("entryCode") + " : " + a.code : "", a.note || ""].filter(Boolean).join(" · ");
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
  // Le code d'entrée (ou « Pas de code d'entrée ») est gardé dans l'adresse : on ne le redemande plus à la commande
  $("#asNoCodeLbl").textContent = t("noCode"); $("#asNoCode").checked = !!(a && NO_CODE.test(a.code || ""));
  $("#asCode").value = a && !NO_CODE.test(a.code || "") ? a.code || "" : ""; $("#asCode").disabled = $("#asNoCode").checked;
  $("#asNote").value = a ? a.note || "" : "";
  $("#asErr").classList.add("hidden");
  $("#asDel").classList.toggle("hidden", sheet.idx < 0);
  if (!sheet.ac) sheet.ac = Places.attach($("#asAddr"), {
    lang: () => I18N.lang, streetsOnly: true,
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
  // Appartement (n° d'appartement ou étage) : le code d'entrée ou « Pas de code d'entrée », pour ne plus le demander ensuite
  const code = $("#asNoCode").checked ? t("noCodeVal") : $("#asCode").value.trim();
  if (($("#asApt").value.trim() || $("#asFloor").value.trim()) && !code) { $("#asCode").focus(); return err(t("asNeedCode")); }
  const cityId = p.cityId || cityIdOf(p.city, p);
  const addr = { street: p.streetName || (p.brand ? "" : p.street) || "", number, brand: p.brand || null,
    city: p.city || cityId, cityId: CONFIG.cities.some(c => c.id === cityId) ? cityId : null, lat: p.lat, lon: p.lon, exact: !!(p.exact || number),
    floor: $("#asFloor").value.trim() || null, apt: $("#asApt").value.trim() || null, code: code || null,
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
$("#asNoCode").addEventListener("change", e => { $("#asCode").disabled = e.target.checked; if (e.target.checked) $("#asCode").value = ""; });
$("#asDel").addEventListener("click", () => { if (sheet.idx >= 0 && confirm(t("accDelete") + " ?")) { Store.deleteAddress(sheet.idx); closeAddrSheet(); renderSavedAddrs(); renderAccount(); } });
$("#asPos").addEventListener("click", async () => {
  const b = $("#asPos"); b.disabled = true; b.textContent = t("geoLocating");
  try {
    const pos = await myPosition(); setHomePos(pos);
    const r = (await Places.reverse(pos.lat, pos.lon, I18N.lang, pos.acc))[0];
    if (!r) throw new Error("none");
    sheet.pick = Object.assign(r, { lat: pos.lat, lon: pos.lon, exact: true });
    sheet.ac.setPicked(r.label);
    if (r.housenumber) $("#asNo").value = r.housenumber;
    numChipsFor($("#asNo"), "as", r.nearNums);
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
  if (box) { box.classList.toggle("is-house", v === "maison"); box.classList.toggle("is-office", v === "bureau"); }   // bureau : pas de code d'entrée
}
// « Pas de code d'entrée » : la case remplit le code (le livreur le lit sur sa fiche) et le bloque
const NO_CODE = /^(Pas de code|אין קוד)( d['’]entrée| כניסה)?$/;
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
  if (which === "to") { state.toOpen = false; state.toChoose = false; }
  const label = [a.brand, a.street, cityLabel(a.cityId || a.city)].filter(Boolean).join(", ");
  const sel = form.elements[which + "_city"];
  if (a.cityId) sel.value = a.cityId; else { sel.value = OTHER; form.elements[which + "_other"].value = a.city || ""; }
  form.elements[pre + "_number"].value = a.number || "";
  DETAIL.forEach(k => { form.elements[pre + "_" + k].value = a[k] || ""; });
  if (pre === "dropoff") { form.dropoff_nocode.checked = NO_CODE.test(a.code || ""); syncNoCode(); }
  form.elements[pre + "_note"].value = a.note || "";
  // Adresse enregistrée sans type de lieu : on le devine (appartement s'il y a un n° d'appartement, bureau pour « Travail »,
  // maison sinon) ; le client peut toujours le changer dans « Modifier ». Jamais de commande bloquée pour ça.
  setKind(pre, a.kind || (a.brand ? null : a.apt ? "appartement" : a.tag === "work" ? "bureau" : (a.tag || a.street) ? "maison" : null));
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
// Position du téléphone : on écoute le GPS quelques secondes et on garde la plus précise
// (la 1re réponse vient souvent du Wi-Fi, à 50-100 m près : de quoi tomber sur l'immeuble d'à côté)
// Navigateur intégré d'une appli (Facebook, Instagram, Messenger, TikTok…) : position et adresses enregistrées souvent absentes
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|Messenger|musical_ly|TikTok|Line\//i.test(navigator.userAgent || "");
function myPosition(maxMs) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("nogeo"));
    let best = null, id = null, done = false;
    const finish = () => { if (done) return; done = true; if (id != null) navigator.geolocation.clearWatch(id); best ? resolve(best) : reject(new Error("nogeo")); };
    id = navigator.geolocation.watchPosition(p => {
      const c = p.coords, acc = Number(c.accuracy) || 999;
      if (!best || acc < best.acc) best = { lat: c.latitude, lon: c.longitude, acc };
      if (acc <= 20) finish();
    }, err => { if (!best) { done = true; if (id != null) navigator.geolocation.clearWatch(id); reject(err); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    setTimeout(finish, maxMs || 7000);
  });
}
// Adresse à la position du téléphone ; renvoie la clé du message d'erreur, ou null
async function locateInto(which) {
  let pos;
  try { pos = await myPosition(); } catch (e) { return inAppBrowser() ? "geoInApp" : "geoDenied"; }
  setHomePos(pos);
  let list = [];
  try { list = await Places.reverse(pos.lat, pos.lon, I18N.lang, pos.acc); } catch (e) { /* message ci-dessous */ }
  const p = list[0];
  if (!p) return "geoNone";
  // Le point exact est celui du téléphone (plus précis que le centre de la rue)
  Object.assign(p, { lat: pos.lat, lon: pos.lon, exact: true, gps: true });
  onPlacePicked(which, p, true);
  if (ac[which]) ac[which].setPicked(p.label);
  numChips(which, p.nearNums);
  return null;
}
// Les numéros voisins de la rue, à toucher pour corriger d'un geste (le GPS se trompe parfois d'un immeuble)
function numChips(which, nums) {
  const pre = prefixOf(which), input = form.elements[pre + "_number"];
  if (input) numChipsFor(input, pre, nums);
}
function numChipsFor(input, key, nums) {
  const label = input.closest("label") || input;
  let box = document.querySelector(`.num-chips[data-for="${key}"]`);
  if (!box) { box = document.createElement("div"); box.className = "num-chips full"; box.dataset.for = key; label.after(box); }
  const list = (nums || []).filter(Boolean);
  if (list.length < 2) { box.remove(); return; }
  const cur = input.value.trim();
  box.innerHTML = `<small>${UI.esc(t("numCheck"))}</small>` + list.map(n => `<button type="button" class="ch-chip${n === cur ? " on" : ""}" data-num="${UI.esc(n)}">${UI.esc(n)}</button>`).join("");
  box.onclick = e => {
    const b = e.target.closest("[data-num]");
    if (!b) return;
    input.value = b.dataset.num;
    input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    box.querySelectorAll("[data-num]").forEach(x => x.classList.toggle("on", x === b));
  };
}
async function useMyPosition(which, btn) {
  btn.disabled = true;
  btn.textContent = t("geoLocating");
  showError("");
  try {
    // Jamais d'attente sans fin (navigateur de Facebook / Instagram : le téléphone ne répond parfois jamais) : 15 s au plus
    const err = await Promise.race([locateInto(which), new Promise(r => setTimeout(() => r(inAppBrowser() ? "geoInApp" : "geoNone"), 15000))]);
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
// L'adresse du client se met toute seule dans « Votre adresse » (dès qu'il en a une : au démarrage, quand ses adresses
// arrivent de son compte, en revenant à l'accueil). Il ne la retape jamais ; il peut la changer. S'il l'a effacée exprès, on ne la remet pas.
function ensureDefaultTo() {
  if (state.toCleared || state.pick.to || val("dropoff_address").trim() || /[?&]c=/.test(location.search)) return;
  const d = defaultDropAddr();
  if (!d) return;
  applySavedAddr("to", d);
  try { syncHome(); } catch (e) { /* accueil pas encore prêt */ }
}
// Adresse proposée d'office : seulement dans la même ville que le départ (ou la ville de HOP!). Jamais une adresse
// d'une autre ville en silence (ex. « Maison » enregistrée à Herzliya → 105 ₪ sans que le client comprenne).
function defaultDropAddr() {
  const city = (state.pick.from && state.pick.from.cityId) || CONFIG.homeCity;
  const list = Store.getAddresses().filter(a => !a.brand && (a.cityId || a.city) === city);
  let last = null;
  try { last = localStorage.getItem(LS_LAST_DROP); } catch (e) { /* ignore */ }
  return (last && list.find(a => addrKey(a) === last)) || list.find(a => a.tag === "home") || list.find(a => a.tag === "work") || null;
}
// L'adresse enregistrée choisie est marquée (pleine, ✓) dans « Mes adresses »
const isSavedPick = (p, a) => !!(p && a && a.lat != null && p.lat === a.lat && p.lon === a.lon && String(p.housenumber || "") === String(a.number || ""));
function markAddrChips() {
  const list = Store.getAddresses();
  // « Récupérer où ? » suit l'adresse de livraison choisie (elle n'y est jamais proposée) et le type de course
  const fk = JSON.stringify([state.pick.to && state.pick.to.label, val("service"), !!(val("shopping_list") + val("notes")).trim(), list.length]);
  document.querySelectorAll('.saved-addrs[data-for="from"]').forEach(box => { if (box.dataset.fk !== fk) { box.dataset.fk = fk; box.innerHTML = fromAddrsHtml(list); } });
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
  // La liste « Où livrer » suit : une seule carte quand l'adresse est choisie, toute la liste quand on change
  const key = `${i}|${state.toOpen ? 1 : 0}|${state.toChoose ? 1 : 0}|${a ? addrDet(a) + "|" + addrKey(a) : ""}`;
  document.querySelectorAll('.saved-addrs[data-for="to"]').forEach(box => {
    if (box.dataset.key === key || box.classList.contains("hidden")) return;
    box.dataset.key = key;
    box.innerHTML = toAddrsHtml(list);
    box.querySelectorAll("[data-addr]").forEach(b => b.classList.toggle("on", isSavedPick(state.pick.to, list[Number(b.dataset.addr)])));
  });
  // La carte dit tout ; la fiche en dessous ne sert plus qu'au code d'entrée s'il manque (appartement)
  const needCode = on && !state.toChoose && (a.kind || kindOf("dropoff")) === "appartement" && !String(a.code || "").trim();
  $("#toSum").classList.toggle("hidden", !needCode);
  if (!needCode) return;
  const html = `<div class="sum-code" data-i="${i}"><label class="f"><span>${UI.esc(t("entryCode"))}</span><input data-sum-code inputmode="text" autocomplete="off" placeholder="${UI.esc(t("codePh"))}" /></label>
      <label class="check"><input type="checkbox" data-sum-nocode /> <span>${UI.esc(t("noCode"))}</span></label></div>`;
  if ($("#toSum").dataset.html !== html) { $("#toSum").innerHTML = html; $("#toSum").dataset.html = html; }
}
// Code tapé dans la fiche résumée : dans la commande tout de suite, et gardé dans l'adresse (on ne le redemande plus)
$("#toSum").addEventListener("input", e => { if (e.target.matches("[data-sum-code]")) { form.dropoff_code.value = e.target.value; form.dropoff_nocode.checked = false; syncNoCode(); } });
$("#toSum").addEventListener("change", e => {
  const box = e.target.closest(".sum-code");
  if (!box) return;
  const i = Number(box.dataset.i), none = e.target.matches("[data-sum-nocode]") && e.target.checked;
  const code = none ? t("noCodeVal") : (box.querySelector("[data-sum-code]").value || "").trim();
  if (!code) return;
  form.dropoff_nocode.checked = none; form.dropoff_code.value = code; syncNoCode();
  try { Store.updateAddress(i, { code }); } catch (ex) { /* ignore */ }
  renderToSum(); renderSavedAddrs(); renderQuote();
});
document.addEventListener("click", e => {
  const ed = e.target.closest("[data-sum-edit]");
  if (ed) { const a = Store.getAddresses()[Number(ed.dataset.sumEdit)]; if (a) openAddrSheet(a.tag || "other", "to", Number(ed.dataset.sumEdit)); return; }
  if (e.target.closest("[data-sum-change]")) { state.toChoose = true; renderToSum(); return; }
});
// Une autre adresse (sans l'enregistrer), depuis la liste « Changer d'adresse » : les champs reviennent, vides
document.addEventListener("click", e => {
  if (!e.target.closest("[data-sum-other]")) return;
  state.toChoose = false;
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
// « Installer l'application » (comme dans HOP! Livreur) : dans Mes courses / mon compte, tant que HOP! n'est pas installée
const hopLtr = v => UI.esc(v).replace(/HOP!/g, '<bdi dir="ltr">HOP!</bdi>');
function renderInstallClient() {
  const ic = $("#installClient");
  if (!ic) return;
  // Appli installée mais alertes pas encore autorisées (iPhone : la demande ne peut venir que d'un toucher)
  const askNotif = UI.isStandalone() && window.Notification && Notification.permission !== "granted" && !!(CONFIG.push && CONFIG.push.publicKey);
  if (askNotif) {
    const denied = Notification.permission === "denied";
    ic.classList.remove("hidden");
    ic.innerHTML = `<div class="ic-row"><img src="icon-192.png" alt="" width="48" height="48" /><span><b>${hopLtr(t("notifT"))}</b><small>${hopLtr(t(denied ? "notifDenied" : "notifSub"))}</small></span></div>
      ${denied ? "" : `<button type="button" class="btn btn-primary btn-block" data-notif-client>🔔 ${UI.esc(t("notifBtn"))}</button>`}`;
    return;
  }
  const show = UI.canInstall();
  ic.classList.toggle("hidden", !show);
  if (show) ic.innerHTML = `<div class="ic-row"><img src="icon-192.png" alt="" width="48" height="48" /><span><b>${hopLtr(t("instT"))}</b><small>${hopLtr(t("instSub"))}</small></span></div>
    <button type="button" class="btn btn-primary btn-block" data-install-client>📲 ${UI.esc(t("instBtn"))}</button>`;
}
document.addEventListener("click", e => { if (e.target.closest("[data-install-client]")) UI.installApp("HOP!", "app/").then(ok => { if (ok) renderInstallClient(); }); });
// « Activer les notifications » (appli client installée) : la demande part du toucher (obligatoire sur iPhone),
// puis ce téléphone est inscrit : à sa dernière course (et aux suivantes, par son numéro), sinon au téléphone seul
document.addEventListener("click", async e => {
  if (!e.target.closest("[data-notif-client]")) return;
  try { if (Notification.permission === "default") await Notification.requestPermission(); } catch (x) { /* ignore */ }
  if (Notification.permission === "granted") {
    const last = (state.mine || []).find(o => o && o.token);
    const ok = last ? await UI.clientPushSubscribe(last.token, false) : await UI.cartPushSubscribe(false);
    toastCart(t(ok ? "notifOk" : "notifFail"));
  }
  renderInstallClient();
});
function renderAccount() {
  renderInstallClient();
  // Un livreur connecté sur ce téléphone : son espace en un geste depuis l'appli principale
  let rider = false;
  try { rider = !!localStorage.getItem("livraison.session.coursier.v1"); } catch (e) { /* ignore */ }
  // (plus de bouton livreur en haut : « Devenir livreur » est en bas de l'accueil, rubrique Explorer)
  const nr = $("#navRider");
  if (nr) { nr.classList.toggle("mine", rider); nr.title = rider ? t("navRiderMine") : t("navRider"); }
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

// Tous les contrôles de la commande, rangés dans l'ordre des 3 écrans (1. quoi et où · 2. précisions · 3. vous et le paiement) :
// le premier problème trouvé s'affiche sur son écran (mêmes règles qu'avant, seul l'ordre a changé)
function validateOrder() {
  // Vitrine de démonstration (montrée aux commerces) : on peut tout essayer, sauf envoyer une vraie course
  if (state.shop && state.shop.demo) return showErrorFalse(t("errDemoShop"));
  // Commerce mis en pause par le patron : visible, mais pas de commande pour le moment
  if (state.shop && state.shop.paused && proShopOn()) return showErrorFalse(t("shPaused"));
  const near = nearMode();
  const fromCity = near ? cityOf("to") : cityOf("from"), toCity = cityOf("to");
  const required = [near ? null : "pickup_address", "dropoff_address"].filter(Boolean);
  const missing = required.find(k => !val(k).trim());
  if (missing || !fromCity || !toCity) {
    if (missing) form.elements[missing].focus();
    return showErrorFalse(t(missing === "dropoff_address" ? "errDropAddr" : "errRequired"));
  }
  // Adresses : uniquement celles proposées par la carte (si le service répond)
  if (Places.serviceOk && ((!near && !ac.from.isPicked()) || !ac.to.isPicked())) {
    form.elements[!near && !ac.from.isPicked() ? "pickup_address" : "dropoff_address"].focus();
    return showErrorFalse(t("errAddrPick"));
  }
  const isBrand = w => !!(state.pick[w] && state.pick[w].brand && !needsNo(state.pick[w]));
  const missingNo = [["from", "pickup_number"], ["to", "dropoff_number"]].find(([w, k]) => !(near && w === "from") && !isBrand(w) && !val(k).trim());
  if (missingNo) { form.elements[missingNo[1]].focus(); return showErrorFalse(t("errHouseNo")); }
  const err = scheduleError();
  if (err) return showErrorFalse(t(err.key, err.vars));
  // Zones pas encore ouvertes (ex. Tel Aviv) : « bientôt »
  const closedCity = [fromCity, toCity].find(c => !UI.cityActive(c));
  if (closedCity) return showErrorFalse(t("errZone", { city: cityLabel(closedCity) }));
  // Écran 2 : les précisions
  // Catalogue sans article : c'est le panier qu'on montre (la précision reste facultative, jamais signalée) ;
  // boutique HOP! : au moins un article du catalogue (le livreur fait les courses d'après la liste)
  if (proShopOn() && !cartCount() && (hopBuyOn() || !val("shop_order").trim())) {
    if (catalogOn()) { $("#catalogBox").scrollIntoView({ block: "start", behavior: "smooth" }); return showErrorFalse(t("errCartEmpty", { name: UI.bi(state.shop.name) })); }
    form.shop_order.focus(); return showErrorFalse(t("errShopOrder", { name: UI.bi(state.shop.name) }));
  }
  if (shopSelf() && !/^[0-9]{3}$/.test(val("shop_ref").trim())) { form.shop_ref.focus(); return showErrorFalse(t("errShopRef")); }
  if (noPayReadyOn() && state.phoneReady == null) { $("#noPayReady").scrollIntoView({ block: "center" }); return showErrorFalse(t("errNprReady", { name: UI.bi(state.shop.name) })); }
  if (phoneOn()) {
    if (!val("pickup_name").trim()) { form.pickup_name.focus(); return showErrorFalse(t("errPhoneName")); }
    if (state.phoneReady == null) { $("#phReadyChips").scrollIntoView({ block: "center" }); return showErrorFalse(t("errPhoneReady")); }
    if (!form.phone_paid.checked) { form.phone_paid.focus(); return showErrorFalse(t("errPhonePaid")); }
  }
  if (val("service") === "achat" && shopListText().trim().length < 3) { form.shopping_list.focus(); return showErrorFalse(t("errShopList")); }
  const badPhone = [form.drop_me.checked ? null : "dropoff_phone", val("service") !== "retrait" && !near ? "pickup_phone" : null]
    .find(k => k && val(k).trim() && !phoneOk(val(k)));
  if (badPhone) { form.elements[badPhone].focus(); return showErrorFalse(t("errPhone")); }
  if (goodsPrepay() && !goodsBudget()) { form.budget.focus(); return showErrorFalse(t("errGoodsBudget")); }
  if (goodsPrepay() && goodsBudget() > goodsCap()) { form.budget.focus(); return showErrorFalse(t("errGoodsCap", capVars())); }
  if (val("service") === "achat" && !form.fits_topcase.checked) { form.fits_topcase.focus(); return showErrorFalse(t("errTopcase")); }
  // Arrivée chez quelqu'un (pas un commerce) : tout ce qu'il faut pour trouver la porte (maison / appartement / bureau,
  // étage, n° d'appartement, code ou « pas de code ») : le patron le veut toujours (08/11), commande en 2 écrans ou non
  if (!(state.pick.to && state.pick.to.brand)) {
    const k = kindOf("dropoff"), flat = k === "appartement";
    const miss = !k ? "Kind" : (flat || k === "bureau") && !val("dropoff_floor").trim() ? "Floor"
      : flat && !val("dropoff_apt").trim() ? "Apt" : flat && !val("dropoff_code").trim() ? "Code" : null;
    // Adresse enregistrée affichée en fiche résumée : on la rouvre pour que le client voie les cases à choisir
    if (miss && form.classList.contains("to-saved")) { state.toOpen = true; renderToSum(); }
    if (miss === "Kind") { form.querySelector('[data-kind="dropoff"]').scrollIntoView({ block: "center" }); return showErrorFalse(t("errToKind")); }
    if (miss) { form.elements["dropoff_" + miss.toLowerCase()].focus(); return showErrorFalse(t("errTo" + miss)); }
  }
  // Sans contact : le livreur doit pouvoir arriver jusqu'à la porte (type de lieu, code d'entrée, n° d'appartement)
  if (form.leave_at_door.checked) {
    const k = kindOf("dropoff");
    if (!k) { form.querySelector('[data-kind="dropoff"]').scrollIntoView({ block: "center" }); return showErrorFalse(t("errDoorKind")); }
    if (k === "appartement" && !val("dropoff_code").trim()) { form.dropoff_code.focus(); return showErrorFalse(t("errDoorCode")); }
    if (k === "appartement" && !val("dropoff_apt").trim()) { form.dropoff_apt.focus(); return showErrorFalse(t("errDoorCode")); }
  }
  // Colis à récupérer : tout ce qu'il faut au guichet, avant d'envoyer la commande
  if (val("service") === "retrait") {
    const place = val("place_kind"), locker = place === "locker";
    if (!val("tracking_number").trim()) { form.tracking_number.focus(); return showErrorFalse(t("errTracking")); }
    if (locker ? !val("retrait_code").trim() : !val("parcel_name").trim()) { (locker ? form.retrait_code : form.parcel_name).focus(); return showErrorFalse(t(locker ? "errRetraitCode" : "errParcelName")); }
    if (place === "poste") {
      const a = new Date(val("appt_at")).getTime();
      if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) { form.appt_at.focus(); return showErrorFalse(t("errAppt")); }
    }
  }
  // Dépôt à la poste : rendez-vous ; vente entre particuliers : déjà payée au vendeur
  if (val("service") === "colis" && form.post_send.checked) {
    const a = new Date(val("appt_at")).getTime();
    if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) { form.appt_at.focus(); return showErrorFalse(t("errPostAppt")); }
  }
  if (val("service") === "colis" && form.p2p_sale.checked && !form.sale_paid.checked) { form.sale_paid.focus(); return showErrorFalse(t("errSaleUnpaid")); }
  // Les photos demandées (colis à récupérer, ordonnance, dépôt à la poste)
  const missDoc = docsMissing();
  if (missDoc) {
    $("#docsBox").scrollIntoView({ block: "center" });
    return showErrorFalse(t("errDoc", { doc: t(missDoc === "identite" && val("service") === "achat" ? "doc_identite_rx" : "doc_" + missDoc) }));
  }
  if (val("service") === "achat" && adultItems().length) {
    if (!form.adult_ok.checked) { form.adult_ok.focus(); return showErrorFalse(t("errAdult")); }
    if (form.has_alcohol.checked && alcoholForbiddenAt(pickupDate() || new Date())) return showErrorFalse(t("errAlcoholHours"));
  }
  const badStop = state.stops.findIndex(s => !stopPoint(s));
  if (badStop >= 0) { $(`#stopsList [data-stop-addr="${badStop}"]`).focus(); return showErrorFalse(t("errStopPick")); }
  // Écran 3 : vos coordonnées
  const missMe = ["contact_name", "contact_phone"].find(k => !val(k).trim());
  if (missMe) { form.elements[missMe].focus(); return showErrorFalse(t("errRequired")); }
  if (!phoneOk(val("contact_phone"))) { form.contact_phone.focus(); return showErrorFalse(t("errPhone")); }
  // Espèces au-dessus du plafond : refusé ici (le serveur le refuserait aussi), le client choisit Bit sans perdre sa commande
  if (val("payment_method") === "cash") { const ci = cashIssue(currentQuote()); if (ci && ci.hard) { $("#cashBox").scrollIntoView({ block: "center" }); return showErrorFalse(ci.text); } }
  return true;
}

async function submit(e) {
  e.preventDefault();
  // Écrans 1 et 2 : « Continuer » (Entrée ou bouton) passe à l'écran suivant
  if (wiz.on && wiz.step < wiz.n) { wizNext(); return; }
  showError("");
  cartStepSet("envoi");
  if (!validateOrder()) return;
  const near = nearMode();
  const fromCity = near ? cityOf("to") : cityOf("from"), toCity = cityOf("to");
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
      purchase_min: svc === "achat" && CONFIG.pricing.purchase ? (boutiqueBuy() ? CONFIG.pricing.purchaseShopMinutes || 8 : CONFIG.pricing.purchaseMinutes || 5) : null,
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
      not_before: noteNotBefore() ? noteNotBefore().toISOString() : null,
      cash_note: val("payment_method") === "cash" ? Number(form.cash_note.value) || 0 : null,
      payer: val("payer"),
      notes: [shopDropOn() && cartCount() ? `🧺 ${t("cgDropNote", { name: state.shop.name })}\n` + cartLines().map(l => `${l.qty} × ${l.p.name}`).join("\n") : "", notesText()].filter(Boolean).join("\n") || null,
      // Articles du catalogue : la base reprend noms et prix, et écrit la liste à préparer
      shop_order: proShopOn() ? (cartCount() ? cartLines().map(l => `${l.qty} × ${l.p.name}`).join("\n") + (val("shop_order").trim() ? "\n💬 " + val("shop_order").trim() : "") : val("shop_order").trim()) : null,
      items: proShopOn() && cartCount() ? cartLines().map(l => ({ id: l.p.id, qty: l.qty })) : null,
      items_note: proShopOn() && cartCount() ? [cartLines().filter(l => modText(l.p.id, "fr")).map(l => `${UI.bi(baseOf(l.p), "fr")}${sizeOf(l.p) ? " (" + UI.bi(sizeOf(l.p), "fr") + ")" : ""} : ${modText(l.p.id, "fr")}`).join(" | "), val("shop_order").trim()].filter(Boolean).join(" | ").slice(0, 300) || null : null,
      goods_choice: proShopOn() && shopCashOnly() && hasShopGoods() ? goodsChoice() : null,
      shop_ref: shopSelf() ? val("shop_ref").trim() : null,
      phone_order: phoneOn() || noPayReadyOn(),
      pickup_name: phoneOn() ? val("pickup_name").trim() : noPayReadyOn() ? (val("contact_name").trim() || null) : null,
      phone_ref: phoneOn() ? val("phone_ref").trim() || null : null,
      phone_paid: (phoneOn() && form.phone_paid.checked) || noPayReadyOn(),
      phone_ready_at: phoneOn() || noPayReadyOn() ? new Date(Date.now() + (state.phoneReady || 0) * 60000).toISOString() : null,
      ...(readyAsk() && Number(val("pickup_ready")) > 0 ? { pickup_ready_at: new Date(Date.now() + Number(val("pickup_ready")) * 60000).toISOString() } : {}),
      company: val("company").trim() || null,
      contact_name: val("contact_name").trim(),
      contact_phone: formatPhone(val("contact_phone").trim()),
      contact_email: val("contact_email").trim() || null,
      // Départ = le commerce du lien : la course compte pour lui (et pour le livreur qui l'a amené)
      shop_id: state.shop && pf && pf.shopId === state.shop.id ? state.shop.id : null,
      addon_of: addonOn() ? state.addon.id : null,
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
    if (state.shop && order.items) { try { const m = JSON.parse(localStorage.getItem(LS_REORDER) || "{}"); m[saved.ref] = state.shop.code; localStorage.setItem(LS_REORDER, JSON.stringify(m)); } catch (e) { /* ignore */ } }
    if (order.promo_code === "PANIER") { try { localStorage.setItem(LS_GIFT, String(Date.now())); } catch (e) { /* ignore */ } cartAtStart = null; }
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
    cartDone();
    rememberAddresses(saved, pf, pt);
    // Paiement direct : le client paiera son livreur (Bit ou PayBox) dès qu'il accepte ; avant : Bit à HOP tout de suite
    // Deux paiements, dans l'ordre : ① les articles au commerce, tout de suite ; ② la livraison au livreur
    // Commerce sans lien ni Bit : on rappelle quand même combien payer pour les articles, et à qui
    // ② la livraison : au livreur, ou offerte par le commerce
    const gift2 = () => (saved.shop_pays ? t("gpStep2Gift", { name: UI.bi(state.shop.name) }) : t("gpStep2", { amount: money(saved.price) }));
    // Commerce non partenaire : ① lien du commerce envoyé par HOP!, ou Bit à HOP! avant la commande
    const gc = order.goods_choice, gcName = UI.bi(state.shop ? state.shop.name : ""), gcAmount = cartCount() ? money(cartTotal()) : t("gpAmountShop");
    if (gc === "lien") Object.assign(saved, { goods_pay: "a_payer", goods_choice: gc, items_total: cartCount() ? cartTotal() : saved.items_total || 0 });
    if (gc === "bit") Object.assign(saved, { goods_choice: gc, items_total: cartCount() ? cartTotal() : saved.items_total || 0 });
    const gcHtml = gc === "lien" ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p><div class="goods-pay wait"><b>${UI.esc(t("gcDoneLink", { name: gcName, amount: gcAmount }))}</b></div><p class="gp-step2"><b>${UI.esc(gift2())}</b></p>`
      : gc === "bit" ? `<p class="promo-msg ok">${UI.esc(t("gcDoneBit", { amount: gcAmount }))}</p>` : "";
    const goodsAsk = !gp && !gcHtml && proShopOn() && cartCount() && saved.payment_method !== "cash"
      ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p><div class="goods-pay todo"><b class="gp-step">${UI.esc(t("gpStep1", { name: UI.bi(state.shop.name), amount: money(cartTotal()) }))}</b><small>${UI.esc(t("gbAsk", { name: UI.bi(state.shop.name) }))}</small></div><p class="gp-step2"><b>${UI.esc(gift2())}</b></p>` : "";
    $("#donePrepay").innerHTML = gcHtml + goodsAsk + (gp ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p>${UI.goodsPay(saved, gp)}<p class="gp-step2"><b>${UI.esc(gift2())}</b></p>` : "")
      + (saved.shop_pays ? `<p class="promo-msg ok">${UI.esc(t("giftNote", { name: UI.bi(state.shop.name) }))}</p>` : saved.payment_method === "bit"
        ? (saved.prepaid_required && !saved.direct_pay ? `<p class="promo-msg bad">${UI.esc(t("trPrepay"))}</p>` : "") + UI.bitPay(saved)
        : gp || gcHtml ? "" : UI.esc(t("donePrepay", { total: money(saved.price), phone: CONFIG.bitPhone, ref: saved.ref })));
    $("#donePrepay").classList.toggle("hidden", !gp && !gcHtml && !goodsAsk && (saved.payment_method === "carnet" || (saved.payment_method !== "bit" && !saved.prepaid_required)));
    if (saved.payment_method === "carnet" && state.pro) state.pro.credits--;
    confetti();
    hopBurst(t("hopSent"));
    if (wiz.on) wizGo(1, true);
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
    // Le suivi est dans l'appli : « Envoyer le suivi » seulement quand quelqu'un d'autre reçoit la course
    const d9 = v => String(v || "").replace(/\D/g, "").slice(-9);
    $("#doneShare").classList.toggle("hidden", !saved.dropoff_phone || d9(saved.dropoff_phone) === d9(saved.contact_phone));
    // Commande saisie par le patron : le suivi part au client sur WhatsApp (son numéro), en français et en hébreu
    if (forClient) {
      const msg = I18N.forLang("fr", "trShareMsg", { url: UI.trackUrl(saved) }) + "\n\n" + I18N.forLang("he", "trShareMsg", { url: UI.trackUrl(saved) });
      $("#doneShare").href = UI.waPersonal(saved.contact_phone, msg);
      $("#doneShare").textContent = t("forClientSend");
      $("#doneShare").classList.remove("hidden");
      form.contact_name.value = ""; form.contact_phone.value = "";
    }
    renderMultiDone(saved);
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
    if (/welcome_used/.test(ex.message)) { state.welcomeUsed = true; refuseWelcome((String(ex.message).match(/welcome_used_addr:(\w+)/) || [])[1]); return; }
    if (/carnet_/.test(ex.message)) { if (state.pro) state.pro.credits = 0; syncVisibility(); return showError(t("errCarnet")); }
    if (/cash_max/.test(ex.message)) return showError(t("errCashMax", { max: money(cashMax()) }));
    if (/cash_first_max/.test(ex.message)) return showError(t("errCashNew", { max: money(Number((state.settings || {}).cash_first_max) || 100), n: Number((state.settings || {}).cash_first_orders) || 3 }));
    if (/cash_first/.test(ex.message)) return showError(t("errCashFirst"));
    if (/demo_shop/.test(ex.message)) return showError(t("errDemoShop"));
    if (/cash_note_small/.test(ex.message)) return showError(t("errCashNote"));
    if (/addon_expired/.test(ex.message)) { state.addon = null; renderAddonBar(); renderQuote(); return showError(t("errAddonExpired")); }
    if (/client_blocked/.test(ex.message)) return showError(t("errBlocked"));
    if (/alcohol_hours/.test(ex.message)) return showError(t("errAlcoholHours"));
    if (/phone_name_required/.test(ex.message)) return showError(t("errPhoneName"));
    if (/phone_unpaid/.test(ex.message)) return showError(t("errPhonePaid"));
    if (/goods_pay_required/.test(ex.message)) return showError(t("errGoodsPay"));
    if (/goods_cash/.test(ex.message)) return showError(t("errGoodsCash"));
    if (/shop_paused/.test(ex.message)) return showError(t("shPaused"));
    if (/goods_cap_/.test(ex.message)) { const cap = Number((/goods_cap_(\d+)/.exec(ex.message) || [])[1]) || goodsCap(); return showError(t("errGoodsCap", { cap: money(cap), more: cap < 300 ? t("gmCapNew") : "" })); }
    if (/goods_budget_required/.test(ex.message)) return showError(t("errGoodsBudget"));
    if (/goods_prepay_bit/.test(ex.message)) return showError(t("errGoodsBit"));
    if (/topcase_required/.test(ex.message)) return showError(t("errTopcase"));
    // Commerce fermé (la base refuse « tout de suite ») : on passe en « Programmer », à son ouverture
    if (/shop_closed/.test(ex.message) && state.shop) {
      const st = UI.openState(state.shop.hours), at = UI.nextOpenDate(st);
      if (at) { const d = new Date(at.getTime() + 15 * 60000); form.elements.urgency.value = "programmee"; form.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; form.time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; state.shopSched = d; syncVisibility(); renderQuote(); }
      return showError(t("errShopClosed", { name: shopShortName(), opens: openLabel(st) }));
    }
    if (/door_kind/.test(ex.message)) return showError(t("errDoorKind"));
    if (/door_code/.test(ex.message)) return showError(t("errDoorCode"));
    if (/retrait_tracking/.test(ex.message)) return showError(t("errTracking"));
    if (/retrait_name/.test(ex.message)) return showError(t("errParcelName"));
    if (/retrait_code/.test(ex.message)) return showError(t("errRetraitCode"));
    if (/retrait_appt/.test(ex.message)) return showError(t("errAppt"));
    if (/post_appt/.test(ex.message)) return showError(t("errPostAppt"));
    if (/sale_unpaid/.test(ex.message)) return showError(t("errSaleUnpaid"));
    console.warn("envoi", ex && ex.message, ex && ex.stack && ex.stack.split("\n").slice(0, 3).join(" / "));
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
  renderCartIcon();
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
    ${L.on ? `<div class="card club"><h3>⭐ ${t("loyaltyTitle")}</h3>
      <div class="stamps">${stamps}</div>
      <p class="muted small">${loyaltyDue() ? t("loyaltyNext") : UI.esc(t("loyaltyText", { n, every: L.every, left: L.every - 1 - n }))}</p></div>` : ""}
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
  const live = o => ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  box.innerHTML = list.map(o => UI.swipeRow(`
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
    </article>`, [
      live(o) ? { icon: "📍", label: t("swTrack"), href: UI.trackUrl(o), cls: "sw-blue" } : UI.receiptNo(o) ? { icon: "🧾", label: t("swReceipt"), href: UI.receiptUrl(o) } : null,
      { icon: "💬", label: t("swChat"), attrs: `data-chat="${UI.esc(o.token)}"`, cls: "sw-green" },
      o.status === "nouvelle" ? { icon: "✖", label: t("cancel"), attrs: `data-cancel="${UI.esc(o.token)}"`, cls: "sw-red" } : null
    ], "sw-order")).join("") + `<p class="sw-hint">${UI.esc(t("swHintOrder"))}</p>`;
}

// --- Messagerie : la course (livreur + service client) ou le service client -----------------
let chatUnread = {};
let chatTotal = 0;
function openOrderChat(o) {
  Chat.open({ thread: "o:" + o.id, title: t("chOrder", { ref: o.ref }), sub: t("chOrderSub"), me: "client",
    fetch: () => Store.chatOrder(o.token), send: (b, i) => Store.chatOrderSend(o.token, b, i), onClose: checkChats });
}
// Service client : jamais de message anonyme ; sans nom ni téléphone, on les demande d'abord (gardés sur le téléphone)
function supportWho() {
  const p = Store.getProfile(), acct = (Store.clientAccount() || {}).client;
  const name = String(p.contact_name || (acct && acct.name) || "").trim(), phone = String(p.contact_phone || (acct && acct.phone) || "").trim();
  return name.length >= 2 && phoneOk(phone) ? { name, phone } : null;
}
function askWho(then, kind) {
  const m = $("#whoModal"), fm = $("#whoForm"), p = Store.getProfile();
  // Même petite fenêtre pour le service client et pour le panier (textes adaptés)
  $("#whoTitle").textContent = t(kind === "cart" ? "whoCartTitle" : "whoTitle");
  $("#whoSub").textContent = t(kind === "cart" ? "whoCartSub" : "whoSub");
  fm.who_name.value = p.contact_name || ""; fm.who_phone.value = p.contact_phone || "";
  $("#whoErr").textContent = "";
  m.dir = document.documentElement.dir;
  m.classList.remove("hidden");
  setTimeout(() => (fm.who_name.value ? fm.who_phone : fm.who_name).focus(), 60);
  fm.onsubmit = e => {
    e.preventDefault();
    const name = fm.who_name.value.trim(), phone = fm.who_phone.value.trim();
    if (name.length < 2) { fm.who_name.focus(); $("#whoErr").textContent = t("whoErrName"); return; }
    if (!phoneOk(phone)) { fm.who_phone.focus(); $("#whoErr").textContent = t("errPhone"); return; }
    Store.saveProfile(Object.assign({}, Store.getProfile(), { contact_name: name, contact_phone: formatPhone(phone) }));
    if (form.contact_name && !val("contact_name").trim()) form.contact_name.value = name;
    if (form.contact_phone && !val("contact_phone").trim()) form.contact_phone.value = formatPhone(phone);
    m.classList.add("hidden");
    then();
  };
}
$("#whoClose").addEventListener("click", () => $("#whoModal").classList.add("hidden"));
$("#whoModal").addEventListener("click", e => { if (e.target.id === "whoModal") $("#whoModal").classList.add("hidden"); });
function openSupport(prefill) {
  if (!supportWho()) return askWho(() => openSupport(prefill));
  const p = Object.assign({}, Store.getProfile(), { contact_name: supportWho().name, contact_phone: supportWho().phone });
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
  const cb = e.target.closest("[data-cancel]"), token = cb && cb.dataset.cancel;
  if (!token || !confirm(t("cancelConfirm"))) return;
  try { await Store.cancelMyOrder(token); } catch (ex) { alert(t("cancelFail")); }
  loadMine();
}

// --- Langue et rendu global ---------------------------------------------------------
function renderAll() {
  I18N.apply();
  wizLabels();
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
  try { state.settings = await Store.getSettings(); UI.setZonesOpen(state.settings.zones_open); } catch (e) { /* on garde « disponible » */ }
  renderStatic();
  renderQuote();
  renderShowcase();   // les rangées de l'accueil choisies par le patron
}

// --- Catalogue du commerce HOP! Pro : le client choisit ses articles (payés directement au commerce) ---
state.catalog = null; state.cart = {};
// Produit épuisé = hors ligne : le client ne le voit plus du tout (le commerçant le remet en vente dans son espace)
const cgProducts = () => ((state.catalog && state.catalog.products) || []).filter(p => p.available !== false || bossEditOn());
// Mode patron (le téléphone du patron) : un crayon ✏️ sur chaque produit, les produits masqués restent visibles (grisés)
const bossEditOn = () => !!(state.boss && state.bossEdit !== false);
// Photos de produits sur fond blanc (détourées : McDonald's, épicerie…) : montrées en entier et centrées, sur fond blanc,
// au lieu d'être coupées par le cadre. Les vraies photos (plat posé sur une table) restent en plein cadre.
const whitePics = new Map();
function checkWhitePic(img) {
  const src = img.currentSrc || img.src;
  if (!src || !img.naturalWidth) return;
  if (UI.extPic(src)) { img.classList.add("pic-white"); return; }   // photo d'un magasin : produit sur fond blanc
  const k = src.length + ":" + src.slice(-80);
  if (!whitePics.has(k)) {
    try {
      const n = 24, c = document.createElement("canvas");
      c.width = n; c.height = n;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, n, n);
      const d = g.getImageData(0, 0, n, n).data;
      let white = 0, all = 0;
      for (let i = 0; i < n; i++) for (const [x, y] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) {
        const o = (y * n + x) * 4; all++;
        if ((d[o] > 225 && d[o + 1] > 225 && d[o + 2] > 225) || d[o + 3] < 24) white++;
      }
      whitePics.set(k, white / all > 0.6);   // fond blanc sur la plupart des bords (le produit peut toucher un bord)
    } catch (e) { return; }   // photo d'un autre site (lecture interdite) : on la laisse telle quelle
  }
  img.classList.toggle("pic-white", whitePics.get(k));
}
document.addEventListener("load", e => {
  const el = e.target;
  if (el && el.tagName === "IMG" && el.closest(".cg-pic, .cg-tpic, .it-pic, .cs-pic")) checkWhitePic(el);
}, true);

// Tailles d'un même menu (ex. McDonald's petit / moyen / grand) : des articles « Nom · שם [Grand · גדולה] » de la même rubrique.
// Une seule carte (« dès 49 ₪ »), la taille se choisit dans la fiche de l'article ; le panier garde la taille choisie
const SIZE_RX = /\s*\[([^\]]+)\]\s*$/;
const baseOf = p => String((p && p.name) || "").replace(SIZE_RX, "");
const sizeOf = p => ((String((p && p.name) || "").match(SIZE_RX) || [])[1] || "");
const sizesOf = p => (sizeOf(p) ? cgProducts().filter(x => x.category_id === p.category_id && sizeOf(x) && baseOf(x) === baseOf(p)) : [p]);
const pName = p => UI.bi(baseOf(p)) + (sizeOf(p) ? " · " + UI.bi(sizeOf(p)) : "");
const groupFirst = list => list.filter((p, i) => !sizeOf(p) || list.findIndex(x => sizeOf(x) && x.category_id === p.category_id && baseOf(x) === baseOf(p)) === i);
const groupQty = p => sizesOf(p).reduce((n, x) => n + (state.cart[x.id] || 0), 0);
const groupPrice = p => { const sz = sizesOf(p); return sz.length > 1 ? t("cgFrom", { price: UI.money(Math.min(...sz.map(x => Number(x.price)))) }) : UI.money(p.price); };
// Burger, menu, tortilla… : le client peut retirer des ingrédients (« sans oignons », « sans ketchup ») et écrire une demande.
// Gardé par article (state.cartMods), écrit en clair dans la commande (le patron le recopie au commerce)
const MODS = ["onion", "pickle", "ketchup", "mustard", "sauce", "lettuce", "tomato", "cheese"];
// « Sans … » seulement pour ce qui est vraiment dans l'article : les ingrédients écrits dans sa description
// (« sans cornichons » n'apparaît que s'il y a des cornichons). Restaurant casher (viande) : jamais de « sans fromage ».
const MOD_RX = {
  onion: /oignon|בצל/i, pickle: /cornichon|pickle|concombre mariné|חמוצ|מלפפון חמוץ/i, ketchup: /ketchup|קטשופ/i, mustard: /moutarde|חרדל/i,
  sauce: /sauce|aïoli|aioli|mayo|רוטב|איולי|מיונז/i, lettuce: /salade|laitue|iceberg|roquette|חסה|רוקט/i, tomato: /tomate|עגבני/i,
  cheese: /fromage|cheddar|cheese|גבינ|צ'דר|צ׳דר/i,
};
const shopMods = p => {
  const txt = String((p && p.description) || "").replace(/rondelles? d'oignons?|oignons? frits?|טבעות בצל/gi, "");
  const kosher = isKosher(state.shop) || /casher|cacher|כשר/i.test((state.shop && state.shop.name) || "");
  return MODS.filter(k => MOD_RX[k].test(txt) && !(k === "cheese" && kosher));
};
const modsFor = p => /burger|royal|mac|chicken|cheese|steak|tortilla|wrap|sandwich|crunch|crispy|המבורגר|בורגר|טורטי|צ'יקן|רויאל|סנדוויץ/i.test(`${(p && p.name) || ""} ${(p && p.description) || ""}`);
// Menus McDonald's : le client choisit sa boisson (comprise dans le menu, sans supplément)
// Boissons avec supplément (Fuze Tea, jus d'orange) : un article caché du catalogue « Supplément boisson : … » est ajouté au panier
// avec la même quantité que le menu (le prix est donc compté par la base, comme les autres articles)
const MENU_DRINKS = [["coke", "Coca-Cola", "קוקה קולה"], ["zero", "Coca-Cola Zero", "קוקה קולה זירו"], ["sprite", "Sprite", "ספרייט"],
  ["fanta", "Fanta", "פאנטה"], ["grape", "Raisin", "ענבים"], ["soda", "Eau gazeuse", "סודה"], ["water", "Eau", "מים"],
  ["fuze", "Fuze Tea pêche", "פיוז טי אפרסק", true], ["orange", "Jus d'orange pressé", "תפוזים סחוט", true]];
// Menus tortilla McDonald's : le goût de chaque tortilla est à choisir (2 choix pour « 2 Tortillas »)
const TORT_FLAVORS = [["steak", "Chicken Steak", "צ'יקן סטייק"], ["crispy", "Crispy Chicken", "קריספי צ'יקן"], ["hot", "Crispy Chicken épicé 🌶", "קריספי צ'יקן חריף 🌶"]];
const isMcd = () => /^MCD/i.test((state.shop && state.shop.code) || "");
// Seulement les menus « Tortilla » et « 2 Tortillas » (pas les tortillas seules ni les formules, dont le goût est déjà dans le nom)
const flavorCount = p => (isMcd() && /^(2 )?Tortillas? · /.test((p && p.name) || "") ? (/^2\s/.test(p.name) ? 2 : 1) : 0);
const flavorName = (k, lang) => { const d = TORT_FLAVORS.find(x => x[0] === k); return d ? (lang === "fr" ? `${d[1]} (${d[2]})` : (I18N.lang === "he" ? d[2] : d[1])) : ""; };
// Menus avec frites : frites (comprises) ou potato géant (+9 ₪), et « en plus » : mini chou-fleur (+15 ₪), rondelles d'oignon (+14 ₪)
const MENU_SIDES = [["fries", "Frites", "צ'יפס"], ["potato", "Potato géant", "פוטטו ענק", true]];
const MENU_EXTRAS = [["cauli", "Mini chou-fleur", "מיני כרובית", true], ["rings", "Rondelles d'oignon", "טבעות בצל", true]];
const optName = (list, k, lang) => { const d = list.find(x => x[0] === k); return d ? (lang === "fr" ? `${d[1]} (${d[2]})` : (I18N.lang === "he" ? d[2] : d[1])) : ""; };
const isAddon = p => /^Supplément (boisson|menu)/i.test((p && p.name) || "");
const cgShown = () => cgProducts().filter(p => !isAddon(p));
const addonOf = (list, k) => { const d = list.find(x => x[0] === k); return d && d[3] ? cgProducts().find(p => isAddon(p) && p.name.includes(d[1])) || null : null; };
const drinkAddon = k => addonOf(MENU_DRINKS, k);
const menuDrinks = () => MENU_DRINKS.filter(d => !d[3] || drinkAddon(d[0]));
const menuSides = () => MENU_SIDES.filter(d => !d[3] || addonOf(MENU_SIDES, d[0]));
const menuExtras = () => MENU_EXTRAS.filter(d => addonOf(MENU_EXTRAS, d[0]));
// Les suppléments choisis pour un article (boisson, accompagnement, en plus)
const modAddons = m => [m && m.drink && drinkAddon(m.drink), m && m.side && addonOf(MENU_SIDES, m.side), ...((m && m.extras) || []).map(k => addonOf(MENU_EXTRAS, k))].filter(Boolean);
function syncAddons() {
  const addons = cgProducts().filter(isAddon);
  if (!addons.length) return;
  const want = {};
  for (const [id, q] of Object.entries(state.cart || {})) {
    if (!(q > 0) || addons.some(a => a.id === id)) continue;
    for (const a of modAddons((state.cartMods || {})[id])) want[a.id] = (want[a.id] || 0) + q;
  }
  for (const a of addons) { if (want[a.id]) state.cart[a.id] = want[a.id]; else delete state.cart[a.id]; }
}
// Un vrai menu (boisson comprise) : pas les produits seuls (« sans frites ni boisson »), ni les suppléments
const needsDrink = p => isMcd() && !isAddon(p) && !/ni boisson|sans boisson/i.test((p && p.description) || "") && /boisson|Menu enfant/i.test(`${(p && p.name) || ""} ${(p && p.description) || ""}`);
const needsSide = p => isMcd() && !isAddon(p) && /frites et boisson/i.test((p && p.description) || "");
const drinkName = (k, lang) => { const d = MENU_DRINKS.find(x => x[0] === k); return d ? (lang === "fr" ? `${d[1]} (${d[2]})` : (I18N.lang === "he" ? d[2] : d[1])) : ""; };
const modText = (id, lang) => {
  const m = (state.cartMods || {})[id];
  if (!m) return "";
  // Dans la commande (lue par le patron), toujours en français ; à l'écran, dans la langue du client
  const fr = { onion: "oignons", pickle: "cornichons", ketchup: "ketchup", mustard: "moutarde", sauce: "sauce", lettuce: "salade", tomato: "tomate", cheese: "fromage" };
  const lab = k => (lang === "fr" ? "sans " + fr[k] : t("modNo") + " " + t("mod_" + k));
  const drink = m.drink ? (lang === "fr" ? "boisson : " : t("drinkLbl") + " : ") + drinkName(m.drink, lang) : "";
  const fl = (m.flavors || []).filter(Boolean);
  const flavor = fl.length ? (lang === "fr" ? "goût : " : t("flavorLbl") + " : ") + fl.map(k => flavorName(k, lang)).join(" + ") : "";
  const side = m.side && m.side !== "fries" ? (lang === "fr" ? "accompagnement : " : t("sideLbl") + " : ") + optName(MENU_SIDES, m.side, lang) : "";
  const extras = (m.extras || []).length ? (lang === "fr" ? "en plus : " : t("extraLbl") + " : ") + m.extras.map(k => optName(MENU_EXTRAS, k, lang)).join(", ") : "";
  return [flavor, drink, side, extras, ...(m.off || []).map(lab), m.note ? "« " + m.note + " »" : ""].filter(Boolean).join(", ");
};
// Taille proposée en ouvrant la fiche : celle déjà au panier, sinon la moyenne / normale, sinon la première
function sizeDefault(p) {
  const sz = sizesOf(p);
  return sz.find(x => state.cart[x.id]) || sz.find(x => /moyen|normal|regular|רגיל|בינוני/i.test(sizeOf(x))) || sz[0] || p;
}
const cartLines = () => { syncAddons(); return cgProducts().filter(p => p.available && state.cart[p.id] > 0).map(p => ({ p, qty: state.cart[p.id] })); };
const cartCount = () => cartLines().filter(l => !isAddon(l.p)).reduce((s, l) => s + l.qty, 0);
const cartTotal = () => cartLines().reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
const shopDropOn = () => !!(state.shop && state.shop.pro && state.pick.to && state.pick.to.shopId === state.shop.id);
const catalogOn = () => (proShopOn() || shopDropOn()) && cgProducts().length > 0;
async function loadCatalogFor(shop) {
  const seq = shopSeq;
  state.catalog = null; state.cart = {};
  renderCatalog();   // l'ancien menu disparaît tout de suite (jamais les plats d'un autre commerce)
  if (!shop || !shop.pro) return;
  // Réseau du téléphone qui coupe : on réessaie (3 fois, de plus en plus espacé) au lieu de laisser le commerce sans menu
  let cat = null;
  for (let i = 0; i < 3 && !cat; i++) {
    if (i) await new Promise(r => setTimeout(r, 1200 * i));
    if (seq !== shopSeq) return;
    try { cat = await Store.shopCatalog(shop.code); } catch (e) { cat = null; }
  }
  // Le client a touché un autre commerce entre-temps : ce menu-là n'est plus le bon
  if (seq !== shopSeq || !state.shop || state.shop.code !== shop.code) return;
  state.catalog = cat;
  multiRestore(shop.code);
  renderCatalog();
  renderQuote();
  if (state.boss) bossMapLoad(shop.code);
}

// ===== Mode patron sur la page client (règle du 04/11) : le patron change un produit là où le client le voit =====
// Nom (français · hébreu), prix, visible ou masqué. Boutiques HOP! (mises à jour toutes seules depuis le magasin) :
// le choix du patron reste par-dessus chaque mise à jour, et « Revenir au magasin » remet ce que dit le magasin.
function bossBar() {
  const n = ((state.catalog && state.catalog.products) || []).filter(p => p.available === false).length;
  return `<div class="boss-bar"><span>👑 <b>Mode patron</b>${bossEditOn() ? ` · touchez ✏️ sur un produit${n ? ` · ${n} masqué${n > 1 ? "s" : ""}` : ""}` : " · vue client"}</span>
    <button type="button" class="btn btn-sm" data-boss-toggle>${bossEditOn() ? "👁️ Vue client" : "✏️ Modifier"}</button></div>`;
}
async function bossMapLoad(code) {
  try { const m = await Store.adminShopBoss(code); if (state.shop && state.shop.code === code) { state.bossMap = m || {}; renderCatalog(); } } catch (e) { /* le crayon marche quand même */ }
}
const isHeTxt = x => /[\u0590-\u05FF]/.test(x);
function bossEdit(id) {
  const all = (state.catalog && state.catalog.products) || [], p0 = all.find(x => x.id === id);
  if (!p0) return;
  const group = sizeOf(p0) ? all.filter(x => x.category_id === p0.category_id && sizeOf(x) && baseOf(x) === baseOf(p0)) : [p0];
  let p = p0;
  const box = document.createElement("div");
  box.className = "boss-sheet";
  const draw = () => {
    const parts = String(p.name || "").split(/\s+·\s+/), he = parts.filter(isHeTxt).join(" · "), fr = parts.filter(x => !isHeTxt(x)).join(" · ");
    const bm = (state.bossMap || {})[p.id], hop = isHopShop(state.shop);
    box.innerHTML = `<form class="bs-card" novalidate>
      <div class="bs-head"><b>✏️ Modifier le produit</b><button type="button" class="bs-x" data-bs-close aria-label="Fermer">✕</button></div>
      ${group.length > 1 ? `<label class="f">Taille<select data-bs-var>${group.map(x => `<option value="${UI.esc(x.id)}"${x.id === p.id ? " selected" : ""}>${UI.esc(UI.bi(sizeOf(x)) || UI.bi(x.name))} · ${UI.esc(money(x.price))}</option>`).join("")}</select></label>` : ""}
      <label class="f">Nom en français<input name="fr" maxlength="60" value="${UI.esc(fr)}" /></label>
      <label class="f">Nom en hébreu<input name="he" maxlength="60" dir="rtl" value="${UI.esc(he)}" /></label>
      <label class="f">Prix (₪)<input name="price" inputmode="decimal" value="${UI.esc(String(p.price).replace(".", ","))}" /></label>
      ${bm && bm.src_price != null && Number(bm.src_price) !== Number(p.price) ? `<small class="bs-src">Prix du magasin : ${UI.esc(money(bm.src_price))}</small>` : ""}
      <label class="bs-vis"><input type="checkbox" name="vis"${p.available !== false ? " checked" : ""} /> <span>Visible pour les clients</span></label>
      <p class="bs-err hidden"></p>
      <div class="bs-btns"><button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        ${hop && bm ? `<button type="button" class="btn btn-block" data-bs-reset>↩️ Revenir au magasin</button>` : ""}</div>
      ${hop ? `<small class="bs-note">Boutique HOP! : votre choix reste, même après les mises à jour automatiques du magasin.</small>` : ""}
    </form>`;
  };
  draw();
  document.body.appendChild(box);
  const close = () => box.remove();
  const done = async ch => {
    const err = box.querySelector(".bs-err"), btns = box.querySelectorAll("button");
    btns.forEach(b => { b.disabled = true; });
    try {
      const r = await Store.adminShopProductSet(p.id, ch);
      if (r) Object.assign(p, { name: r.name, price: Number(r.price), available: r.available });
      state.bossMap = state.bossMap || {};
      if (r && r.boss) state.bossMap[p.id] = Object.assign({}, state.bossMap[p.id], { src_price: r.src_price }); else delete state.bossMap[p.id];
      close();
      box.dataset.html = "";
      renderCatalog(); renderQuote();
      toastCart(ch.reset ? "↩️ Remis comme au magasin" : "✅ Enregistré : vos clients le voient tout de suite");
    } catch (ex) {
      btns.forEach(b => { b.disabled = false; });
      err.textContent = "Pas enregistré (connexion ?). Réessayez.";
      err.classList.remove("hidden");
    }
  };
  box.addEventListener("click", e => {
    if (e.target === box || e.target.closest("[data-bs-close]")) return close();
    if (e.target.closest("[data-bs-reset]")) { e.preventDefault(); done({ reset: true }); }
  });
  box.addEventListener("change", e => { if (e.target.matches("[data-bs-var]")) { p = group.find(x => x.id === e.target.value) || p; draw(); } });
  box.addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, fr = f.fr.value.trim().replace(/\s+/g, " "), he = f.he.value.trim().replace(/\s+/g, " ");
    const price = Number(String(f.price.value).replace(",", ".").replace(/[^\d.]/g, ""));
    const err = box.querySelector(".bs-err");
    if (!fr && !he) { err.textContent = "Le nom ne peut pas être vide."; err.classList.remove("hidden"); return; }
    if (!(price >= 0 && price <= 5000) || String(f.price.value).trim() === "") { err.textContent = "Prix invalide."; err.classList.remove("hidden"); return; }
    const name = [fr, he].filter(Boolean).join(" · ");
    const ch = {};
    if (name !== p.name) ch.name = name;
    if (Math.abs(price - Number(p.price)) > 0.001) ch.price = price;
    if (f.vis.checked !== (p.available !== false)) ch.available = f.vis.checked;
    if (!Object.keys(ch).length) return close();
    done(ch);
  });
}
// Épiceries / supermarchés (HOP! chez Carrefour, BOOOM, Marché Français…) : fiches produits en cartes, 2 par ligne,
// photo sur fond blanc, prix en grand, contenance et prix au 100 g / 100 ml (comme les applis de supermarché)
// (étendu à tous les commerces sauf restaurants et services, demande du patron du 06/11/2026 : pâtisserie, traiteur, boutique…)
const grocShop = () => !!(state.shop && !/restaurant/.test(String(state.shop.kind || "")) && !UI.isService(state.shop));
// Cartes produits dans TOUS les catalogues (restaurants et services compris, demande du patron du 06/11/2026) ;
// la contenance et le prix au 100 g restent pour les commerces de produits (grocShop)
const tileShop = () => !!state.shop;
// Ligne du bas des cartes (2 lignes fixes, toutes les cartes à la même hauteur) : contenance + prix au 100 g,
// sinon les tailles à choisir, sinon (restaurant, service) le début de la description
function tileMeta(p, multi) {
  if (grocShop() && !multi && packInfo(p)) return `<span class="cg-meta"><span dir="ltr">${UI.esc(packInfo(p).label)}</span><span dir="ltr">${UI.esc(unitPrice(p))}</span></span>`;
  if (multi && sizesOf(p).length > 1) return `<span class="cg-meta cg-mtxt">${UI.esc(sizesOf(p).map(x => UI.bi(sizeOf(x))).join(" · "))}</span>`;
  if (!grocShop() && p.description) return `<span class="cg-meta cg-mtxt">${UI.esc(UI.bi(p.description))}</span>`;
  return `<span class="cg-meta"></span>`;
}
// Contenance lue dans le nom (« 6 × 1,5 L », « 200 גרם », « 1 ק"ג ») : total en g ou ml, et un libellé court
const PACK_RE = /(?:(\d+)\s*[×xX*]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grammes?|ml|cl|l|litres?|ליטר|גרם|גר'?|ק[״"]ג|קילו|מ[״"]ל)(?![a-zà-ÿ])/i;
function packInfo(p) {
  const raw = String(UI.bi(baseOf(p)) || ""), all = String(p.name || "");
  const m = PACK_RE.exec(raw) || PACK_RE.exec(all);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1, v = Number(String(m[2]).replace(",", ".")), u = m[3].toLowerCase();
  if (!v || !isFinite(v)) return null;
  const kind = /^(kg|g|gr|gramm|גרם|גר|ק|קילו)/.test(u) ? "g" : "ml";
  const per = /^(kg|ק|קילו)/.test(u) ? 1000 : /^(l|litre|ליטר)/.test(u) ? 1000 : /^cl/.test(u) ? 10 : 1;
  const total = n * v * per;
  const fmt = x => String(Math.round(x * 100) / 100).replace(".", ",");
  const unit = kind === "g" ? (per === 1000 ? "kg" : "g") : (per === 1000 ? "L" : per === 10 ? "cl" : "ml");
  return { total, kind, label: (n > 1 ? n + " × " : "") + fmt(v) + " " + unit };
}
// Prix au 100 g / 100 ml (cartes) ou au kg / litre (fiche ouverte)
function unitPrice(p, big) {
  const k = packInfo(p), price = Number(p.price);
  if (!k || !k.total || !price) return "";
  const base = big ? 1000 : 100, val = price / k.total * base;
  const u = k.kind === "g" ? (big ? "kg" : "100g") : (big ? "L" : "100ml");
  return money(Math.round(val * 100) / 100) + "/" + u;
}
function renderCatalog() {
  const box = $("#catalogBox"), on = catalogOn();
  box.classList.toggle("hidden", !on);
  $("#shopOrderBox").classList.toggle("with-cg", on);
  document.body.classList.toggle("cg-cart-on", on && cartCount() > 0);
  form.shop_order.placeholder = on ? t(hopBuyOn() ? "hopNotePh" : "cgNotePh") : t("spOrderPh");
  $("#shopWa").classList.toggle("hidden", !(state.shop && hopBuyOn()) || document.documentElement.classList.contains("for-client"));
  if (state.shop && proShopOn()) $("#shopOrderLabel").textContent = on ? t("cgNoteLabel", { name: UI.bi(state.shop.name) }) : t("spOrderLabel", { name: UI.bi(state.shop.name) });
  if (!on) { box.innerHTML = ""; box.dataset.html = ""; box.dataset.shell = ""; return; }
  const cats = state.catalog.categories.filter(c => cgShown().some(p => p.category_id === c.id));
  const hasLoose = cgShown().some(p => !cats.some(c => c.id === p.category_id));
  // Le menu entier par rubriques ; les onglets mènent à leur rubrique et suivent le défilement
  const allSecs = cats.map(c => ({ id: c.id, title: UI.bi(c.name), items: groupFirst(cgShown().filter(p => p.category_id === c.id)) }))
    .concat(hasLoose ? [{ id: "_", title: cats.length ? t("cgOther") : "", items: groupFirst(cgShown().filter(p => !cats.some(c => c.id === p.category_id))) }] : []);
  // Recherche dans le catalogue (nom, description, français et hébreu, sans accents)
  const cq = phNorm(state.cgQ || "");
  // (début d'un mot : « eau » trouve « Eau minérale », pas « gâteau » ; le choix entre crochets ne compte pas)
  const cqHit = txt => { for (let k = txt.indexOf(cq); k >= 0; k = txt.indexOf(cq, k + 1)) if (k === 0 || /[\s(/'·-]/.test(txt[k - 1])) return true; return false; };
  const sections = cq ? allSecs.map(x => Object.assign({}, x, { items: x.items.filter(p => cqHit(phNorm(`${String(p.name).replace(/\s*\[[^\]]*\]\s*$/, "")} ${p.description || ""}`))) })).filter(x => x.items.length) : allSecs;
  const n = cartCount();
  // Façon appli de livraison : onglets collants, lignes d'articles avec grande image, panier flottant en bas
  // (Plus de rangée « Les incontournables » : elle répétait les premiers articles du menu, en doublon — demande du patron)
  const head = `${cats.length > 1 && !cq ? `<div class="cg-cats" role="tablist">${sections.filter(x => x.title).map(x =>
      `<button type="button" class="cg-tab" data-cg-cat="${UI.esc(x.id)}">${UI.esc(x.title)}</button>`).join("")}</div>` : ""}`;
  // Le champ de recherche est posé une seule fois par commerce (il garde le clavier et ce qui est tapé)
  if (box.dataset.shell !== state.shop.code + I18N.lang) {
    box.innerHTML = `<div class="cg-head"><label class="cg-search"><span aria-hidden="true">🔍</span><input type="search" data-cg-q enterkeyhint="search" autocomplete="off" /></label><div class="cg-head-tabs"></div></div><div class="cg-body"></div>`;
    box.dataset.shell = state.shop.code + I18N.lang; box.dataset.html = ""; box.dataset.head = "";
    state.cgQ = state.cgQNext || ""; state.cgQNext = "";
    if (state.cgQ) box.querySelector("[data-cg-q]").value = state.cgQ;
  }
  const qIn = box.querySelector("[data-cg-q]");
  qIn.placeholder = t("cgSearch", { name: UI.bi(state.shop.name) });
  if (box.dataset.head !== head) { box.querySelector(".cg-head-tabs").innerHTML = head; box.dataset.head = head; }
  const html = `${state.boss ? bossBar() : ""}${shopNoPay() ? noPayMini() : ""}
    ${cq && !sections.length ? `<p class="cg-none">${UI.esc(t("cgNone", { q: state.cgQ.trim() }))}</p>` : ""}
    ${sections.map(sec => `${sec.title ? `<h4 class="cg-sec" data-cg-sec="${UI.esc(sec.id)}">${UI.esc(sec.title)}</h4>` : ""}<div class="cg-grid${tileShop() ? " cg-tiles" : ""}${tileShop() && sec.items.length === 1 ? " cg-one" : ""}">${sec.items.map(p => {
      // Taille ou boisson à choisir : le « + » ouvre la fiche de l'article
      const q = groupQty(p), multi = sizesOf(p).length > 1 || needsDrink(p), photo = UI.safeImg(p.photo);
      const bm = bossEditOn() && (state.bossMap || {})[p.id];
      return `<div class="cg-item${p.available ? "" : " off"}${q ? " in" : ""}${bm ? " boss-ch" : ""}" data-cg-open="${UI.esc(p.id)}">
        <div class="cg-info"><b>${q ? `<em class="cg-n"><bdi>${q}×</bdi></em> ` : ""}<bdi>${UI.esc(UI.bi(baseOf(p)))}</bdi></b>${p.description ? `<small>${UI.esc(UI.bi(p.description))}</small>` : ""}<span class="cg-price">${UI.esc(groupPrice(p))}</span>${multi ? `<span class="cg-sizes">${UI.esc(sizesOf(p).map(x => UI.bi(sizeOf(x))).join(" · "))}</span>` : ""}${tileShop() ? tileMeta(p, multi) : ""}</div>
        <div class="cg-pic">${photo ? `<img src="${photo}"${UI.imgCors(photo)} alt="" loading="lazy" />` : shopArt(p)}
        ${bossEditOn() ? `<button type="button" class="cg-boss" data-boss-edit="${UI.esc(p.id)}" aria-label="Modifier">✏️</button>` : ""}
        ${!p.available ? `<span class="cg-out">${bossEditOn() ? "🙈 Masqué" : UI.esc(t(UI.isService(state.shop) ? "cgOutSvc" : "cgOut"))}</span>`
          : multi ? `<button type="button" class="cg-plus" data-cg-pick="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">${q ? `<b>${q}</b>` : "+"}</button>`
          : q ? `<span class="cg-qty"><button type="button" data-cg-minus="${UI.esc(p.id)}" aria-label="−">−</button><b>${q}</b><button type="button" data-cg-plus="${UI.esc(p.id)}" aria-label="+">+</button></span>`
          : `<button type="button" class="cg-plus" data-cg-plus="${UI.esc(p.id)}" aria-label="${UI.esc(t("cgAdd"))}">+</button>`}</div>
      </div>`;
    }).join("")}</div>`).join("")}
    ${(state.shop.pay_link || state.shop.pay_bit) && proShopOn() ? `<div class="pay2">
        <b>${UI.esc(t("pay2Title"))}</b>
        <p><i>1</i><span>${UI.esc(t("pay2Goods", { name: UI.bi(state.shop.name), amount: n ? money(cartTotal()) : "" }))}</span></p>
        <p><i>2</i><span>${UI.esc(t("pay2Ride"))}</span></p>
        <small>${UI.esc(t("pay2Note"))}</small></div>`
      : shopCashOnly() ? ""
      : shopCashOnly() ? `<div class="pay2 pay1"><b>${UI.esc(t("pay1Title"))}</b><p><i>💵</i><span>${UI.esc(t("pay1Body", { amount: n ? money(cartTotal()) : "" }))}</span></p></div>`
      : shopNoPay() ? `<p class="cg-pay">${UI.esc(t("nopayShort", { name: UI.bi(state.shop.name) }))}</p>`
      : `<p class="cg-pay">${UI.esc(t("cgPayShop", { name: UI.bi(state.shop.name) }))}</p>`}
    ${n && hopBuyOn() ? hopMeter(n) : ""}
    ${n ? `<button type="button" class="cg-cart" data-cg-go><span class="cg-cart-n">${n}</span><b>${UI.esc(t("cgSee"))}</b><span>${UI.esc(money(cartTotal()))}</span></button>`
      : `<p class="cg-empty">${UI.esc(t("cgEmpty"))}</p>`}`;
  // Redessiné seulement si quelque chose a changé (un toucher n'est jamais perdu)
  if (box.dataset.html !== html) { box.querySelector(".cg-body").innerHTML = html; box.dataset.html = html; }
  if (state.findItem) {
    const id = state.findItem; state.findItem = null;
    // Produit touché dans la recherche de l'accueil : sa fiche s'ouvre tout de suite (photo, prix, Ajouter)
    if (state.findOpen) { state.findOpen = false; if (cgProducts().some(p => p.id === id)) setTimeout(() => openItem(id), 250); }
    requestAnimationFrame(() => { const el = box.querySelector(`.cg-item[data-cg-open="${CSS.escape(id)}"]`) || box.querySelector(`[data-cg-open="${CSS.escape(id)}"]`); if (el) { el.classList.add("cg-found"); el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => el.classList.remove("cg-found"), 4000); } });
  }
  // Les onglets restent collés juste sous la barre du haut (« ‹ Accueil · Ma commande »)
  const bar = ["#viewBar", ".topbar"].map(q => document.querySelector(q)).find(el => el && el.offsetHeight);
  if (bar) box.style.setProperty("--cg-top", (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight - 1 + "px");
  syncCgTabs();
}
// Boutique HOP! : le livreur fait les courses → 24 articles au plus et la place du top case (comme les rayons) ;
// un article de trop n'est pas ajouté, on le dit
const hopPlaces = () => cartLines().reduce((n, l) => n + l.qty * Store.hopPlace(l.p.name), 0);
function hopCartFix(id) {
  if (!hopBuyOn() || !state.cart[id]) return;
  let cut = false;
  while (state.cart[id] > 0 && (cartCount() > PI.max || hopPlaces() > PI.topcase)) { state.cart[id]--; cut = true; }
  if (!state.cart[id]) delete state.cart[id];
  if (cut) toastCart(t("phFull"));
}
// Jauge sous le panier : articles (6 compris, puis +2 ₪ l'article) et place prise dans le top case
function hopMeter(n) {
  const place = Math.min(100, Math.round(hopPlaces() / PI.topcase * 100)), extra = Math.max(0, n - HOP_INC), each = PI.extraCourier + PI.extraHop;
  const lvl = place >= 100 || n >= PI.max ? "full" : place >= 75 || n > HOP_INC ? "warn" : "ok";
  return `<div class="ph-meter hop-meter ${lvl}"><div class="pm-row"><b>🛵 ${UI.esc(t("phTopcase", { p: place }))}</b><span>${UI.esc(t("phCount", { n, max: PI.max }))}</span></div>
    <div class="pm-bar"><i style="width:${place}%"></i></div>
    <small>${UI.esc(extra ? t("phExtra", { n: extra, each, inc: HOP_INC }) : t("phIncluded", { inc: HOP_INC, each, max: PI.max }))}</small></div>`;
}
// Onglet allumé = la rubrique en cours de lecture
const cgEdge = () => { const h = $("#catalogBox .cg-head"); return h ? (parseFloat(getComputedStyle(h).top) || 0) + h.offsetHeight + 12 : 0; };
function syncCgTabs() {
  // Le bloc recherche + rubriques se colle juste sous les barres du haut (leur vraie position à l'écran)
  const cb = $("#catalogBox");
  if (cb && cb.querySelector(".cg-head")) {
    const low = ["#viewBar", ".topbar"].map(q => document.querySelector(q)).filter(el => el && el.offsetHeight && /fixed|sticky/.test(getComputedStyle(el).position))
      .reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom), 0);
    if (low > 0) cb.style.setProperty("--cg-top", Math.round(low) - 1 + "px");
  }
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
$("#catalogBox").addEventListener("input", e => {
  if (!e.target.matches("[data-cg-q]")) return;
  e.stopPropagation();
  state.cgQ = e.target.value;
  renderCatalog();
});
$("#catalogBox").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[data-cg-q]")) { e.preventDefault(); e.target.blur(); } });
$("#catalogBox").addEventListener("click", e => {
  const be = e.target.closest("[data-boss-edit]"), bt = e.target.closest("[data-boss-toggle]");
  if (be) { e.preventDefault(); e.stopPropagation(); return bossEdit(be.dataset.bossEdit); }
  if (bt) { e.preventDefault(); state.bossEdit = !bossEditOn(); return renderCatalog(); }
  const b = e.target.closest("button");
  if (!b) { const card = e.target.closest("[data-cg-open]"); if (card) openItem(card.dataset.cgOpen); return; }
  // « Voir la commande » : le panier s'ouvre (articles, quantités, total), puis « Continuer »
  if (b.dataset.cgGo != null) return openCart();
  if (b.dataset.cgCat != null) {
    const h = $("#catalogBox").querySelector(`[data-cg-sec="${CSS.escape(b.dataset.cgCat)}"]`);
    if (h) scrollTo({ top: scrollY + h.getBoundingClientRect().top - cgEdge() + 4, behavior: "smooth" });
    return;
  }
  if (b.dataset.cgPick) return openItem(b.dataset.cgPick);
  if (b.dataset.cgPlus) { state.cart[b.dataset.cgPlus] = Math.min(50, (state.cart[b.dataset.cgPlus] || 0) + 1); hopCartFix(b.dataset.cgPlus); }
  else if (b.dataset.cgMinus) state.cart[b.dataset.cgMinus] = Math.max(0, (state.cart[b.dataset.cgMinus] || 0) - 1);
  else return;
  renderCatalog();
  renderQuote();
  saveDraft();  cartPersist();
});

document.addEventListener("input", e => { if (e.target.matches && e.target.matches("[data-it-note]")) item.note = e.target.value; });
// Fiche d'un article : grande image, description, prix, quantité, « Ajouter · total »
const item = { id: null, qty: 1 };
function openItem(id) {
  let p = cgProducts().find(x => x.id === id);
  if (!p) return;
  if (sizesOf(p).length > 1 && !state.cart[p.id]) p = sizeDefault(p);
  item.id = p.id; item.qty = Math.max(1, state.cart[p.id] || 1);
  const m0 = (state.cartMods || {})[p.id] || {};
  item.off = [...(m0.off || [])]; item.note = m0.note || ""; item.drink = m0.drink || ""; item.needDrink = false; item.flavors = [...(m0.flavors || [])]; item.side = m0.side || "fries"; item.extras = [...(m0.extras || [])];
  $("#itemSheet").classList.toggle("groc", tileShop());
  renderItem();
  $("#itemSheet").classList.remove("hidden");
}
function renderItem() {
  const p = cgProducts().find(x => x.id === item.id);
  if (!p) return;
  const inCart = state.cart[p.id] || 0, photo = UI.safeImg(p.photo);
  $("#itemBody").innerHTML = `<div class="it-pic">${photo ? `<img src="${photo}"${UI.imgCors(photo)} alt="" />` : shopArt(p)}</div>
    <div class="it-txt"><h3><bdi>${UI.esc(UI.bi(baseOf(p)))}</bdi></h3>${grocShop() && packInfo(p) ? `<p class="it-pack"><bdi dir="ltr">${UI.esc(packInfo(p).label)}</bdi></p>` : ""}<div class="it-prow"><span class="cg-price">${UI.money(p.price)}</span>${grocShop() && unitPrice(p, true) ? `<span class="it-unit"><bdi dir="ltr">${UI.esc(unitPrice(p, true))}</bdi></span>` : ""}</div>
      ${sizesOf(p).length > 1 ? `<p class="it-size-h">${UI.esc(t("itSize"))}</p><div class="it-sizes" role="radiogroup">${sizesOf(p).map(x => `<button type="button" class="it-size${x.id === p.id ? " on" : ""}" role="radio" aria-checked="${x.id === p.id}" data-it-size="${UI.esc(x.id)}"><b>${UI.esc(UI.bi(sizeOf(x)))}</b><small>${UI.esc(UI.money(x.price))}</small>${state.cart[x.id] ? `<em>${state.cart[x.id]}×</em>` : ""}</button>`).join("")}</div>` : ""}
      ${p.description ? `<p>${UI.esc(UI.bi(p.description))}</p>` : ""}
      ${p.available ? Array.from({ length: flavorCount(p) }, (_, i) => `<p class="it-size-h">${UI.esc(t("flavorTitle"))}${flavorCount(p) > 1 ? ` ${i + 1}` : ""}</p>${item.needDrink && !(item.flavors || [])[i] ? `<p class="it-need">${UI.esc(t("flavorNeed"))}</p>` : ""}
        <div class="it-mods it-drinks it-flavors" role="radiogroup">${TORT_FLAVORS.map(([k]) => { const on = (item.flavors || [])[i] === k;
          return `<button type="button" class="it-mod${on ? " on" : ""}" role="radio" aria-checked="${on}" data-it-flavor="${i}:${k}">${on ? "✓ " : ""}${UI.esc(flavorName(k))}</button>`; }).join("")}</div>`).join("") : ""}
      ${needsDrink(p) && p.available ? `<p class="it-size-h">${UI.esc(t("drinkTitle"))}</p>${item.needDrink && !item.drink ? `<p class="it-need">${UI.esc(t("drinkNeed"))}</p>` : ""}
        <div class="it-mods it-drinks" role="radiogroup">${menuDrinks().map(([k]) => { const a = drinkAddon(k);
          return `<button type="button" class="it-mod${item.drink === k ? " on" : ""}" role="radio" aria-checked="${item.drink === k}" data-it-drink="${k}">${item.drink === k ? "✓ " : ""}${UI.esc(drinkName(k))}${a ? ` <small>+${UI.esc(money(a.price))}</small>` : ""}</button>`; }).join("")}</div>` : ""}
      ${needsSide(p) && p.available && menuSides().length > 1 ? `<p class="it-size-h">${UI.esc(t("sideTitle"))}</p>
        <div class="it-mods it-drinks" role="radiogroup">${menuSides().map(([k]) => { const a = addonOf(MENU_SIDES, k), on = (item.side || "fries") === k;
          return `<button type="button" class="it-mod${on ? " on" : ""}" role="radio" aria-checked="${on}" data-it-side="${k}">${on ? "✓ " : ""}${UI.esc(optName(MENU_SIDES, k))}${a ? ` <small>+${UI.esc(money(a.price))}</small>` : ""}</button>`; }).join("")}</div>` : ""}
      ${needsSide(p) && p.available && menuExtras().length ? `<p class="it-size-h">${UI.esc(t("extraTitle"))}</p>
        <div class="it-mods it-drinks">${menuExtras().map(([k]) => { const a = addonOf(MENU_EXTRAS, k), on = (item.extras || []).includes(k);
          return `<button type="button" class="it-mod${on ? " on" : ""}" aria-pressed="${on}" data-it-extra="${k}">${on ? "✓ " : "＋ "}${UI.esc(optName(MENU_EXTRAS, k))} <small>+${UI.esc(money(a.price))}</small></button>`; }).join("")}</div>` : ""}
      ${modsFor(p) && p.available ? `${shopMods(p).length ? `<p class="it-size-h">${UI.esc(t("modTitle"))}</p>` : ""}<div class="it-mods">${shopMods(p).map(k => `<button type="button" class="it-mod${(item.off || []).includes(k) ? " on" : ""}" aria-pressed="${(item.off || []).includes(k)}" data-it-mod="${k}">${(item.off || []).includes(k) ? "✕ " : ""}${UI.esc(t("modNo"))} ${UI.esc(t("mod_" + k))}</button>`).join("")}</div>
        <input class="it-note" data-it-note maxlength="80" placeholder="${UI.esc(t("modNotePh"))}" value="${UI.esc(item.note || "")}" />` : ""}
      ${p.available ? "" : `<p class="it-out">${UI.esc(t(UI.isService(state.shop) ? "cgOutSvc" : "cgOut"))}</p>`}</div>`;
  $("#itemQty").textContent = item.qty;
  $("#itemAdd").disabled = !p.available;
  const extra = modAddons({ drink: needsDrink(p) ? item.drink : "", side: needsSide(p) ? item.side : "", extras: needsSide(p) ? item.extras : [] })
    .reduce((s, a) => s + Number(a.price || 0), 0);
  $("#itemAdd").innerHTML = `<span>${UI.esc(t(inCart ? "itUpdate" : "itAdd"))}</span><b>${UI.esc(money((Number(p.price) + extra) * item.qty))}</b>`;
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
    const id = UI.esc(p.id);
    // Supplément de boisson : suit tout seul la quantité des menus, pas de boutons
    if (isAddon(p)) return `<div class="cs-row cs-addon"><span class="cs-txt"><b><bdi>${UI.esc(pName(p))}</bdi></b><small>${qty} × ${UI.esc(money(p.price))} = ${UI.esc(money(Number(p.price) * qty))}</small></span></div>`;
    // On glisse la ligne : Supprimer · + 1 · Modifier (les − / + restent là pour ceux qui ne glissent pas)
    return UI.swipeRow(`<div class="cs-row"><span class="cs-pic">${photo ? `<img src="${photo}"${UI.imgCors(photo)} alt="" />` : shopArt(p)}</span>
      <span class="cs-txt"><b><bdi>${UI.esc(pName(p))}</bdi></b>${modText(p.id) ? `<em class="cs-mods">${UI.esc(modText(p.id))}</em>` : ""}<small>${UI.esc(money(Number(p.price) * qty))}</small></span>
      <span class="it-qty cs-qty"><button type="button" data-cs-minus="${id}" aria-label="−">${qty > 1 ? "−" : "🗑"}</button><b>${qty}</b><button type="button" data-cs-plus="${id}" aria-label="+">+</button></span></div>`,
      [{ icon: "🗑", label: t("swDel"), attrs: `data-cs-del="${id}"`, cls: "sw-red" }, { icon: "＋", label: t("swDup"), attrs: `data-cs-plus="${id}"` },
        { icon: "✏️", label: t("swEdit"), attrs: `data-cs-edit="${id}"` }]);
  }).join("") + `<p class="sw-hint">${UI.esc(t("swHint"))}</p>`;
  $("#cartSum").textContent = money(cartTotal());
  const rest = form.shop_order.value.trim();
  $("#cartRest").classList.toggle("hidden", !rest);
  $("#cartRest").innerHTML = rest ? `📝 ${UI.esc(rest)}<small>${UI.esc(t("csRestS"))}</small>` : "";
  renderMulti();
  cartExtras();
  const nm = state.shop ? shopShortName() : "";
  let keep = $("#cartKeep");
  if (!keep) { keep = document.createElement("div"); keep.id = "cartKeep"; $("#cartNote").after(keep); }
  keep.innerHTML = (supportWho() ? "" : `<button type="button" class="btn btn-ghost btn-block cs-keep" data-cart-keep>📲 ${UI.esc(t("cartKeepBtn"))}</button>`)
    + `<button type="button" class="cs-clear" data-cart-clear>🗑 ${UI.esc(t("cartClear"))}</button>`;
  if (state.shop && shopCashOnly()) $("#cartNote").textContent = t(linkOk() ? "gcCart" : "gcCartHop");
  else if (state.shop && !state.shop.pay_link && !state.shop.pay_bit) {
    // Pas de paiement en ligne chez ce commerce : on commande d'abord chez lui, puis HOP! va chercher la commande
    const tel = String(state.shop.phone || state.shop.whatsapp || "").split(/[;,]/)[0].replace(/[^\d+]/g, "");
    $("#cartNote").innerHTML = `<b class="cs-steps-t">${escHop(t("csNoPayT", { name: nm }))}</b>
      <ol class="cs-steps"><li><i>1</i><span>${UI.esc(t("csNoPay1", { name: nm }))}</span></li><li><i>2</i><span>${escHop(t("csNoPay2"))}</span></li></ol>
      ${tel ? `<a class="btn btn-ghost cs-call" href="tel:${UI.esc(tel)}">📞 ${UI.esc(t("csCall", { name: nm }))}</a>` : ""}`;
  } else $("#cartNote").textContent = t(shopPrepay() ? "csNotePrepay" : "csNote", { name: state.shop ? UI.bi(state.shop.name) : "" });
}
// Panier : le prix de la livraison dit tout de suite (et la 1re livraison à prix réduit), et si c'est fermé :
// l'heure d'ouverture, la commande déjà programmée, « 🔔 Prévenez-moi à l'ouverture »
// (1re livraison : seulement au prix normal de la ville, le seul qu'on sait calculer d'avance sans se tromper)
function firstDelivPrice(s) {
  const base = CONFIG.pricing.fixedFromHome[CONFIG.homeCity];
  if (!s || s.shop_pays || addonOn() || activeOrders().length || !welcomeOpen() || proPrice(s) !== base) return null;
  const w = welcomePrice();
  return w < base ? w : null;
}
function cartExtras() {
  const s = state.shop;
  let box = $("#cartInfo");
  if (!box) { box = document.createElement("div"); box.id = "cartInfo"; $("#cartNote").before(box); }
  if (!s) { box.innerHTML = ""; return; }
  const fp = firstDelivPrice(s);
  const why = isHopShop(s) && !addonOn() && buyInfo(currentQuote()) ? ` <button type="button" class="cs-why" data-buy-info>${UI.esc(t("csWhy", { fee: money(Number(CONFIG.pricing.purchase || 0)) }))} <i aria-hidden="true">ⓘ</i></button>` : "";
  const deliv = s.shop_pays ? "" : `<p class="cs-deliv">${UI.esc(t("csDeliv", { price: money(addonOn() ? state.addon.price : proPrice(s)) }))}${fp != null ? ` · <b>${UI.esc(t("csDelivFirst", { price: money(fp) }))}</b>` : ""}${why}</p>`;
  const st = shopState(s), shut = !!(st && st.open === false && !st.hop), closed = shut || !state.settings.accepting;
  let cl = "";
  if (closed) {
    const when = shut ? openLabel(st) : "";
    cl = `<div class="cs-closed"><b>${escHop(t("ccClosed", { name: shut ? shopShortName() : "HOP!" }))}</b>
      ${state.shopSched && val("urgency") === "programmee" ? `<small>${UI.esc(t("ccSched", { when: UI.fmtDateTime(state.shopSched) }))}</small>` : when ? `<small>${UI.esc(when)}</small>` : ""}
      ${state.openNotice ? `<span class="cs-notified">${UI.esc(t("ccNotified"))}</span>` : `<button type="button" class="btn btn-sm cs-notify" data-open-notice>${UI.esc(t("ccNotify"))}</button>`}</div>`;
  }
  box.innerHTML = cl + deliv;
}
// « Prévenez-moi à l'ouverture » : par notification si le client l'accepte, sinon son numéro (HOP! le prévient)
document.addEventListener("click", async e => {
  if (!e.target.closest("[data-open-notice]")) return;
  const done = () => {
    state.openNotice = true;
    const s = cartSnap();
    if (s.count) cartSync(s);
    if (!$("#cartSheet").classList.contains("hidden")) renderCart();
    toastCart(t("ccNotified"));
  };
  if (await UI.cartPushSubscribe(true) || supportWho()) return done();
  askWho(done, "cart");
});
// « Garder mon panier » (facultatif) : nom + téléphone, pour retrouver le panier et être rappelé
document.addEventListener("click", e => {
  if (!e.target.closest("[data-cart-keep]")) return;
  askWho(() => { cartSync(cartSnap()); if (!$("#cartSheet").classList.contains("hidden")) renderCart(); renderPharma(); }, "cart");
});
$("#cartSheet").addEventListener("click", e => {
  if (e.target.id === "cartSheet" || e.target.closest("#cartClose") || e.target.closest("#cartMore")) return $("#cartSheet").classList.add("hidden");
  const del = e.target.closest("[data-cs-del]"), edit = e.target.closest("[data-cs-edit]");
  if (edit) { $("#cartSheet").classList.add("hidden"); openItem(edit.dataset.csEdit); return; }
  if (del) {
    delete state.cart[del.dataset.csDel];
    renderCatalog(); renderQuote(); saveDraft(); cartPersist();
    if (cartCount()) renderCart(); else $("#cartSheet").classList.add("hidden");
    return;
  }
  const plus = e.target.closest("[data-cs-plus]"), minus = e.target.closest("[data-cs-minus]");
  if (plus || minus) {
    const id = (plus || minus).dataset[plus ? "csPlus" : "csMinus"];
    state.cart[id] = Math.max(0, Math.min(50, (state.cart[id] || 0) + (plus ? 1 : -1)));
    if (plus) hopCartFix(id);
    renderCatalog(); renderQuote(); saveDraft(); renderCart(); cartPersist();
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
  const md = e.target.closest("[data-it-mod]");
  if (md) { const k = md.dataset.itMod; item.off = (item.off || []).includes(k) ? item.off.filter(x => x !== k) : [...(item.off || []), k]; return renderItem(); }
  const dk = e.target.closest("[data-it-drink]");
  if (dk) { item.drink = dk.dataset.itDrink; return renderItem(); }
  const fk = e.target.closest("[data-it-flavor]");
  if (fk) { const [i, k] = fk.dataset.itFlavor.split(":"); item.flavors = [...(item.flavors || [])]; item.flavors[+i] = k; return renderItem(); }
  const sd = e.target.closest("[data-it-side]");
  if (sd) { item.side = sd.dataset.itSide; return renderItem(); }
  const ex = e.target.closest("[data-it-extra]");
  if (ex) { const k = ex.dataset.itExtra; item.extras = (item.extras || []).includes(k) ? item.extras.filter(x => x !== k) : [...(item.extras || []), k]; return renderItem(); }
  const sz = e.target.closest("[data-it-size]");
  if (sz) { item.id = sz.dataset.itSize; item.qty = Math.max(1, state.cart[item.id] || item.qty || 1); return renderItem(); }
  if (e.target.closest("#itemMinus")) { item.qty = Math.max(1, item.qty - 1); return renderItem(); }
  if (e.target.closest("#itemPlus")) { item.qty = Math.min(50, item.qty + 1); return renderItem(); }
  const add = e.target.closest("#itemAdd"), del = e.target.closest("#itemDel");
  if (!add && !del) return;
  // Menu : la boisson est obligatoire avant d'ajouter
  const cur = cgProducts().find(x => x.id === item.id);
  const flavOk = !cur || Array.from({ length: flavorCount(cur) }, (_, i) => (item.flavors || [])[i]).every(Boolean);
  if (add && cur && ((needsDrink(cur) && !item.drink) || !flavOk)) {
    item.needDrink = true; renderItem();
    const h = $("#itemBody .it-need"); if (h) h.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  state.cart[item.id] = add ? item.qty : 0;
  if (add) hopCartFix(item.id);
  state.cartMods = state.cartMods || {};
  const flavors = cur ? (item.flavors || []).slice(0, flavorCount(cur)) : [];
  const side = cur && needsSide(cur) && item.side !== "fries" ? item.side || "" : "", extras = cur && needsSide(cur) ? item.extras || [] : [];
  if (add && ((item.off || []).length || (item.note || "").trim() || item.drink || flavors.length || side || extras.length))
    state.cartMods[item.id] = { off: item.off || [], note: (item.note || "").trim().slice(0, 80), drink: item.drink || "", flavors, side, extras };
  else delete state.cartMods[item.id];
  $("#itemSheet").classList.add("hidden");
  renderCatalog(); renderQuote(); saveDraft(); cartPersist();
});

// --- Commerce partenaire (lien index.html?c=CODE) : départ rempli depuis le commerce ----------
// HOP! Pro : le départ est un commerce abonné → le client écrit sa commande, le commerce la prépare
const shopPicked = () => !!(state.shop && state.pick.from && state.pick.from.shopId === state.shop.id);
const proShopOn = () => shopPicked() && !!state.shop.pro && val("payment_method") !== "carnet";
// Boutique HOP! (CONFIG.hopShops : HOP! chez Carrefour, HOP! chez BOOOM) : le livreur HOP! fait les courses = un achat
// (petit achat comme le supermarché, 6 articles compris puis +2 ₪ l'article, même maximum et même top case)
const isHopShop = s => !!(s && (CONFIG.hopShops || []).includes(String(s.code || "").toUpperCase()));
const hopBuyOn = () => proShopOn() && isHopShop(state.shop);
// Boutiques HOP! (Carrefour, BOOOM) : ouvertes quand le patron est en service (« accepting », règle du 04/11)
// ET dans les horaires qu'il leur a mis (s'il en a mis : 04/11 soir, BOOOM 9 h 30 – 19 h) ; « Fermé pour le moment » sinon
function shopState(s) {
  if (isHopShop(s)) return state.settings.accepting ? UI.openState(s.hours) : { open: false, hop: true };
  return UI.openState(s.hours);
}
const HOP_INC = (CONFIG.pricing.purchaseItems || {}).hopIncluded || 6;
// Fiche du commerce : présentation, adresse, horaires (ouvert / fermé maintenant), WhatsApp pour le joindre
const DAYS = { fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] };
// « Ouvert · ferme à 19:00 » / « Fermé · ouvre demain à 08:30 » / « Fermé · ouvre lundi à 08:30 »
function openLabel(st) {
  if (!st) return "";
  if (st.hop) return t("shClosedNow");
  if (st.open) return t("stOpenUntil", { time: UI.hhmmOf(st.until) });
  if (st.inDays == null) return t("shClosed");
  const time = UI.hhmmOf(st.at);
  // (le jour en toutes lettres plutôt que « demain » : à 3 h du matin, « demain » ne veut plus rien dire)
  return st.inDays === 0 ? t("stOpensAt", { time })
    : t("stOpensDay", { day: (DAYS[I18N.lang] || DAYS.fr)[st.day].toLowerCase(), time });
}
function shopOpenNow(hours) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const today = (hours || []).find(x => Number(x.d) === now.getDay());
  const m = now.getHours() * 60 + now.getMinutes(), mins = v => { const [h, mm] = v.split(":").map(Number); return h * 60 + (mm || 0); };
  return !!(today && today.h && String(today.h).split(",").some(r => { const [a, b] = r.split("-"); return a && b && m >= mins(a) && m < mins(b); }));
}
function shopInfo(s, noWa) {
  if (!s || !(s.whatsapp || s.phone || s.website || s.about || s.about_he || (s.hours && s.hours.length))) return "";
  const tel = telOf(shopNum(s)), url = webOf(s.website);
  const days = DAYS[I18N.lang] || DAYS.fr, today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();
  const fmt = h => (h ? String(h).split(",").map(r => r.replace("-", "–")).join(" · ") : t("shClosed"));
  const hours = (s.hours || []).slice().sort((a, b) => a.d - b.d);
  const open = hours.length && shopOpenNow(hours);
  const wa = noWa ? "" : shopWa(s);
  // Boutique HOP! (Carrefour, BOOOM, Panzer…) : c'est HOP! qu'on appelle pour commander, pas le magasin
  const own = isHopShop(s), hop = hopRun(s) || own, waText = encodeURIComponent(t(hop ? "shWaHelloHop" : "shWaHello", { name: UI.bi(s.name) }));
  return `<div class="sh-info">
    ${UI.shopText(s, "about") ? `<p class="sh-about">${UI.esc(UI.shopText(s, "about"))}</p>` : ""}
    <div class="sh-lines">
      ${s.address ? `<div class="sh-line"><span>📍</span><b><bdi>${UI.esc(s.address)}</bdi>${s.city ? ", " + UI.esc(cityLabel(cityIdOf(s.city, s) || s.city)) : ""}</b></div>` : ""}
      ${hours.length ? `<div class="sh-line"><span>🕘</span><b class="sh-open ${open ? "on" : "off"}">${UI.esc(openLabel(UI.openState(hours)) || t(open ? "shOpenNow" : "shClosedNow"))}</b>
        <small>${UI.esc(t("shToday"))} : ${UI.esc(fmt((hours.find(x => Number(x.d) === today) || {}).h))}</small></div>` : ""}
      ${tel ? `<a class="sh-line sh-link" href="${UI.esc(telHref(tel))}" data-shop-call><span>📞</span><b><bdi dir="ltr">${UI.esc(tel)}</bdi></b><small>${UI.esc(t(own ? "shCallHopShop" : hop ? "shCallHopSub" : "shCallSub"))}</small></a>` : ""}
      ${url ? `<a class="sh-line sh-link" href="${UI.esc(url)}" target="_blank" rel="noopener"><span>🌐</span><b><bdi dir="ltr">${UI.esc(siteLabel(url))}</bdi></b><small>${UI.esc(t("shSiteSub"))}</small></a>` : ""}
    </div>
    ${wa ? `<a class="sh-wa" href="https://wa.me/${UI.esc(wa)}?text=${waText}" target="_blank" rel="noopener">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8C29 8.7 23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.2 16 5.2S26.9 10 26.9 15.8 22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a9 9 0 0 1-2.6-1.6 9.8 9.8 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.6 4.9c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>
        <span><b>${UI.esc(t(hop ? "shWaHop" : "shWa"))}</b><small>${UI.esc(t(own ? "shWaHopShopSub" : hop ? "shWaHopSub" : "shWaSub", { name: UI.bi(s.name) }))}</small></span></a>` : ""}
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
// Note moyenne d'un commerce (vitrine) et ses derniers avis, chargés quand on ouvre le pli
const scOf = s => (state.showcase || []).find(x => x.code === s.code) || s;
function shopStars(s) {
  const x = scOf(s);
  return Number(x.ratings) > 0 ? `<small class="sh-stars">${UI.esc(t("shReviews", { avg: String(x.rating).replace(".", ","), n: x.ratings }))}</small>` : "";
}
function shopReviewsFold(s) {
  const x = scOf(s);
  if (!(Number(x.ratings) > 0)) return "";
  return `<details class="sh-reviews" data-reviews="${UI.esc(s.code)}"><summary>${UI.esc(t("shReviewsSee"))} · ${UI.esc(t("shReviews", { avg: String(x.rating).replace(".", ","), n: x.ratings }))}</summary><div class="sh-rev-list">…</div></details>`;
}
$("#shopHero").addEventListener("toggle", async e => {
  const d = e.target.closest("details[data-reviews]");
  if (!d || !d.open || d.dataset.loaded) return;
  d.dataset.loaded = "1";
  try {
    const r = await Store.shopReviews(d.dataset.reviews);
    d.querySelector(".sh-rev-list").innerHTML = (r && r.list && r.list.length) ? r.list.map(v => `<div class="sh-rev"><b>${"★".repeat(v.stars)}<i>${"★".repeat(5 - v.stars)}</i></b><span>${v.note ? UI.esc(v.note) : ""}</span><small>${UI.esc(v.name || "")}${v.at ? " · " + UI.esc(UI.fmtDay(v.at)) : ""}</small></div>`).join("") : `<p class="muted small">${UI.esc(t("shReviewsNone"))}</p>`;
  } catch (err) { d.querySelector(".sh-rev-list").textContent = t("shReviewsNone"); }
}, true);
// Une seule ligne sous le nom : ouvert / fermé, prix de la livraison, et deux boutons (WhatsApp, Infos)
const WA_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8C29 8.7 23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.2 16 5.2S26.9 10 26.9 15.8 22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a9 9 0 0 1-2.6-1.6 9.8 9.8 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.1 1.1-1.1 2.7 1.2 3.1 1.3 3.3 2.3 3.5 5.6 4.9c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3z"/></svg>`;
// Commerce non partenaire géré par HOP! (le patron commande pour le client) : son WhatsApp et son téléphone sont ceux de HOP!
const hopRun = s => !!(s && s.cash_ok && !/^HOP/.test(s.code || ""));
function shopMeta(s) {
  const st = UI.openState(s.hours), wa = shopWa(s), hop = hopRun(s);
  const fp = firstDelivPrice(s);
  const price = s.shop_pays ? "🎁 " + t("scGift") : "🛵 " + t("proDelivery", { price: money(addonOn() ? state.addon.price : proPrice(s)) }) + (fp != null ? " · 🎁 " + t("delivFirst", { price: money(fp) }) : "");
  return `<div class="sh-meta">
      <div class="sh-meta-l">${st ? `<b class="sh-dot ${st.open ? "on" : "off"}"><i></i>${UI.esc(openLabel(st))}</b>` : ""}
        <small>${UI.esc(price)} · ${UI.esc(t("qZero"))} ${UI.esc(t("qService").toLowerCase())}</small></div>
      <div class="sh-meta-r">${wa ? `<a class="sh-ic sh-ic-wa" href="https://wa.me/${UI.esc(wa)}?text=${encodeURIComponent(t(hop ? "shWaHelloHop" : "shWaHello", { name: UI.bi(s.name) }))}" target="_blank" rel="noopener" aria-label="${UI.esc(t(hop ? "shWaHop" : "shWa"))}">${WA_SVG}</a>` : ""}
        <button type="button" class="sh-ic sh-ic-info" data-sh-info="1"><i>i</i><span>${UI.esc(t("shInfoBtn"))}</span></button></div>
    </div>${s.paused ? `<p class="sh-paused">⏸️ ${UI.esc(t("shPaused"))}</p>` : ""}${st && (st.open || st.inDays != null) ? `<p class="sh-last15">⏰ ${UI.esc(t("shLast15"))}</p>` : ""}${hop && (wa || s.phone) ? `<p class="sh-hop-note">${UI.esc(t("shHopNote", { name: UI.bi(s.name) }))}</p>` : ""}`;
}
// Fiche « Infos » (s'ouvre par-dessus) : photos, présentation, adresse, horaires, WhatsApp, avis
function shopSheet(s) {
  return `<div class="sh-sheet${state.shInfo ? " open" : ""}" data-sh-sheet="1" aria-hidden="${state.shInfo ? "false" : "true"}">
      <div class="sh-sheet-box" role="dialog" aria-modal="true" aria-label="${UI.esc(UI.bi(s.name))}">
        <div class="sh-sheet-head"><b>${UI.esc(UI.bi(s.name))}</b><button type="button" class="sh-sheet-x" data-sh-close="1" aria-label="${UI.esc(t("close") || "×")}">✕</button></div>
        ${shopGallery(s)}${shopInfo(s)}${shopReviewsFold(s)}
      </div></div>`;
}
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
    // Commerce Pro : vitrine compacte (photo, logo, nom, une ligne d'infos) et les produits juste dessous
    const compact = !!s.pro;
    const html = `${s.demo ? `<p class="sh-demo">🎬 <span>${UI.esc(t("shDemo"))} <a href="commerce.html?demo=${UI.esc(String(s.code).split("-")[1].toLowerCase())}">${UI.esc(t("shDemoSpace"))}</a></span></p>` : ""}<div class="sh-cover pk-${UI.esc(s.kind || "autre")}${!cover && logo ? " auto" : ""}"${cover ? ` style="background-image:url(${cover})"` : !cover && logo ? ` style="--logo:url(${logo})"` : ""}>${cover || logo ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}${s.demo ? "" : `<button type="button" class="sh-share" data-share-shop aria-label="${UI.esc(t("shareShop"))}">${SHARE_SVG}<span>${UI.esc(t("shareShop"))}</span></button>`}</div>
      <div class="sh-row"><span class="pc-logo sh-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
        <div class="sh-txt"><b>${UI.esc(UI.bi(s.name))}</b>${isKosher(s) ? kosherTag("k-lg") : ""}<small>${UI.esc(UI.shopText(s, "tagline") || kinds[s.kind] || "")}</small>${shopStars(s)}</div></div>
      ${compact ? shopMeta(s) : `${shopReviewsFold(s)}
      ${UI.openState(s.hours) ? `<p class="sh-status ${UI.openState(s.hours).open ? "on" : "off"}"><i></i>${UI.esc(openLabel(UI.openState(s.hours)))}</p>` : ""}`}
      ${UI.shopText(s, "promo") ? `<p class="sh-promo"><i>📣</i><span>${UI.esc(UI.shopText(s, "promo"))}</span></p>` : ""}
      ${s.pro && !compact ? `<div class="pc-tags sh-tags"><em>${s.shop_pays ? "🎁 " + UI.esc(t("scGift")) : "🛵 " + UI.esc(t("proDelivery", { price: money(addonOn() ? state.addon.price : proPrice(s)) }))}</em><em>🧾 ${UI.esc(t("qZero"))} ${UI.esc(t("qService").toLowerCase())}</em></div>` : ""}
      ${schedLine()}
      ${shopTwoWay() ? `<div class="sh-dir" role="group">
        <button type="button" class="${side === "to" ? "on" : ""}" data-shop-dir="to"><i>🧺</i><span><b>${UI.esc(t("shDirTo"))}</b><small>${UI.esc(t("shDirToSub", { name: UI.bi(s.name) }))}</small></span></button>
        <button type="button" class="${side === "from" ? "on" : ""}" data-shop-dir="from"><i>👔</i><span><b>${UI.esc(t("shDirFrom"))}</b><small>${UI.esc(t("shDirFromSub", { name: UI.bi(s.name) }))}</small></span></button>
      </div>` : ""}
      ${compact ? shopSheet(s) : `${shopGallery(s)}
      ${vit ? shopInfo(s, true) + noPayBox("vitTitle") : shopInfo(s)}`}`;
    if (hero.dataset.html !== html) { hero.innerHTML = html; hero.dataset.html = html; }
  }
  const compactOn = !!(showHero && s.pro);
  if (compactOn) $("#shopBanner").classList.add("hidden");
  document.body.classList.toggle("shop-compact", compactOn);
  if (on) $("#shopBannerText").textContent = t(side === "to" ? "shBannerTo" : "shBanner", { name: UI.bi(state.shop.name) });
  const pro = proShopOn();
  // Commerce à l'arrivée (pressing : on lui apporte les vêtements) : le catalogue seul, sans commande à préparer
  $("#shopOrderBox").classList.toggle("hidden", !pro && !shopDropOn());
  form.shop_order.closest("label").classList.toggle("hidden", !pro);
  $("#shopOrderNote").classList.toggle("hidden", !pro);
  $("#shopRefBox").classList.toggle("hidden", !shopSelf());
  if (pro) {
    $("#shopOrderLabel").textContent = t("spOrderLabel", { name: UI.bi(state.shop.name) });
    $("#shopOrderNote").textContent = t(linkOk() ? "spOrderNoteLink" : hopBuyOn() ? "spOrderNoteHopBuy" : shopCashOnly() ? "spOrderNoteHop" : shopNoPay() ? "spOrderNoteDirect" : "spOrderNote", { name: UI.bi(state.shop.name) });
  }
  renderNoPayReady();
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

// ===== Panier dans plusieurs magasins (patron, 08/11) ===========================================================
// Le client passe d'un magasin à l'autre : son panier n'est plus perdu, il est gardé (« garé »). Récapitulatif dans le
// panier et sur la commande : magasin 1 (livraison normale) + magasin 2 (+10 ₪ : une autre adresse à récupérer, même
// trajet, tout livré ensemble). On valide le 1er, puis chaque autre en un toucher : c'est l'« ajout à la commande »
// déjà vérifié par la base (orders_ab_addon : même client, même adresse, magasin à 2 km, 15 min, prix addon_price).
const LS_MULTI = "livraison.multi.v1";
state.multi = (() => { try { const m = JSON.parse(localStorage.getItem(LS_MULTI)) || {};
  Object.keys(m).forEach(k => { if (!m[k] || Date.now() - m[k].at > 7 * 86400000) delete m[k]; }); return m; } catch (e) { return {}; } })();
const multiSave = () => { try { localStorage.setItem(LS_MULTI, JSON.stringify(state.multi)); } catch (e) { /* ignore */ } };
const multiList = () => Object.values(state.multi).filter(m => m && (!state.shop || m.code !== state.shop.code));
const addonPrice = () => Number(state.settings.addon_price) || 10;
const addonKm = () => Number(state.settings.addon_km) || 2;
// Coordonnées d'un magasin : les siennes, sinon celles de la vitrine
const shopXY = x => { if (!x) return null; if (x.lat != null && x.lon != null) return x; const sc = (state.showcase || []).find(z => z.code === x.code); return sc && sc.lat != null ? sc : null; };
const kmBetween = (a, b) => { a = shopXY(a); b = shopXY(b); return a && b ? 111.32 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180)) : null; };
// Prix de la livraison de ce magasin en plus : 10 ₪ s'il est à 2 km du magasin principal, sinon une course normale
function multiFee(m) {
  // (coordonnées du magasin garé : reprises de la vitrine si elles manquaient au moment de le garer)
  if (m.lat == null) { const sc = (state.showcase || []).find(x => x.code === m.code); if (sc) { m.lat = sc.lat; m.lon = sc.lon; if (m.price == null) m.price = proPrice(sc); } }
  const d = kmBetween(state.shop, m);
  return d != null && d <= addonKm() ? { price: addonPrice(), near: true } : { price: m.price || addonPrice(), near: false };
}
function multiPark() {
  if (!state.shop || !state.catalog || !cartCount() || addonOn() || state.shop.demo || document.documentElement.classList.contains("for-client")) return;
  const s = state.shop;
  state.multi[s.code] = { code: s.code, name: UI.bi(s.name), short: shopShortName(), lat: s.lat, lon: s.lon, price: proPrice(s),
    cart: Object.assign({}, state.cart), mods: Object.assign({}, state.cartMods || {}), note: form.shop_order.value || "",
    lines: cartLines().filter(l => !isAddon(l.p)).map(l => ({ n: pName(l.p), q: l.qty })), count: cartCount(), total: cartTotal(), at: Date.now() };
  multiSave();
  toastCart(t("multiParked", { name: shopShortName() }));
}
// Page rechargée ou lien d'un autre magasin : le panier gardé sur le téléphone (autre magasin) est garé aussi
function multiParkStored(code) {
  // (lu directement : au démarrage, ce code passe avant la partie « panier gardé » plus bas)
  let c = null;
  try { c = JSON.parse(localStorage.getItem("livraison.cart.v1")); if (c && Date.now() - c.at > 7 * 86400000) c = null; } catch (e) { c = null; }
  if (!c || !c.shop || !c.snap || c.shop.code === code || state.multi[c.shop.code] || !c.snap.count) return;
  const sc = (state.showcase || []).find(x => x.code === c.shop.code) || null, nm = String(c.snap.shop_name || c.shop.code);
  state.multi[c.shop.code] = { code: c.shop.code, name: nm, short: nm.split(" · ")[0], lat: sc && sc.lat, lon: sc && sc.lon, price: sc ? proPrice(sc) : null,
    cart: c.cart || {}, mods: c.mods || {}, note: "", lines: (c.snap.items || []).map(i => ({ n: i.n, q: i.q })), count: c.snap.count, total: Number(c.snap.total) || 0, at: Date.now() };
  multiSave();
  toastCart(t("multiParked", { name: nm.split(" · ")[0] }));
}
function multiRestore(code) {
  const m = state.multi[code];
  if (!m) return;
  const ids = cgProducts().filter(p => p.available).map(p => p.id);
  state.cart = Object.fromEntries(Object.entries(m.cart || {}).filter(([id, q]) => ids.includes(id) && q > 0));
  state.cartMods = Object.fromEntries(Object.entries(m.mods || {}).filter(([id]) => state.cart[id]));
  if (m.note && !form.shop_order.value.trim()) form.shop_order.value = m.note;
  delete state.multi[code]; multiSave();
}
function multiHtml(withBtns) {
  const list = multiList();
  if (!list.length || !state.shop || !proShopOn()) return "";
  const q = currentQuote(), main = q && q.total != null ? money(q.total) : money(proPrice(state.shop));
  const rows = list.map((m, i) => { const f = multiFee(m);
    return `<div class="mb-row"><span><b>${i + 2}. ${UI.esc(m.short || m.name)}</b><small>${UI.esc(t("multiItems", { n: m.count, sum: money(Math.round(m.total * 10) / 10) }))}</small></span>
      <em>+${UI.esc(money(f.price))}</em>${withBtns ? `<span class="mb-btns"><button type="button" data-multi-go="${UI.esc(m.code)}">${UI.esc(t("multiSee"))}</button><button type="button" data-multi-del="${UI.esc(m.code)}" aria-label="✕">✕</button></span>` : ""}</div>`; }).join("");
  const near = list.every(m => multiFee(m).near);
  return `<b class="mb-t">🛍️ ${UI.esc(t("multiTitle", { n: list.length + 1 }))}</b>
    <div class="mb-row"><span><b>1. ${UI.esc(shopShortName())}</b><small>${UI.esc(t("multiItems", { n: cartCount(), sum: money(cartTotal()) }))}</small></span><em>${UI.esc(main)}</em></div>${rows}
    <small class="mb-why">${UI.esc(t(near ? "multiWhy" : "multiWhyFar", { price: money(addonPrice()), km: addonKm() }))}</small>
    <small class="mb-how">${UI.esc(t("multiHow", { name: shopShortName() }))}</small>`;
}
function renderMulti() {
  const h1 = multiHtml(true), h2 = multiHtml(false);
  if ($("#multiCart")) { $("#multiCart").innerHTML = h1; $("#multiCart").classList.toggle("hidden", !h1); }
  if ($("#multiSum")) { $("#multiSum").innerHTML = h2; $("#multiSum").classList.toggle("hidden", !h2); }
}
// Commande envoyée : chaque autre magasin garé se valide en un toucher (ajout à cette commande, adresse déjà remplie)
function renderMultiDone(saved) {
  // L'ajout se rattache toujours à la 1re commande (la base refuse un ajout d'un ajout)
  if (saved && !saved.addon_of) state.multiRoot = saved.token;
  const tok = saved && (saved.addon_of ? state.multiRoot : saved.token);
  if (saved) saved = Object.assign({}, saved, { token: tok });
  const box = $("#multiDone"), list = Object.values(state.multi).filter(m => m && (!saved || m.code !== saved.shop_code));
  box.classList.toggle("hidden", !list.length || !saved || !saved.token);
  if (!list.length || !saved || !saved.token) { box.innerHTML = ""; return; }
  box.innerHTML = `<b class="mb-t">🛍️ ${UI.esc(t("multiNextT"))}</b>` + list.map(m => `<button type="button" class="btn btn-primary btn-block mb-next" data-multi-next="${UI.esc(m.code)}" data-tok="${UI.esc(saved.token)}">
    ➕ ${UI.esc(t("multiNext", { name: m.short || m.name, price: money(multiFee(m).price) }))}</button>`).join("")
    + `<small class="mb-why">${UI.esc(t("multiNextS"))}</small>`;
}
document.addEventListener("click", async e => {
  const go = e.target.closest("[data-multi-go]"), del = e.target.closest("[data-multi-del]"), nx = e.target.closest("[data-multi-next]");
  if (!go && !del && !nx) return;
  e.preventDefault();
  if (del) { delete state.multi[del.dataset.multiDel]; multiSave(); renderMulti(); renderCartIcon(); return; }
  $("#cartSheet").classList.add("hidden");
  if (go) { await loadShop(go.dataset.multiGo); return; }
  // Magasin suivant : ajout à la commande qui vient de partir (même adresse, livraison 10 ₪)
  $("#doneModal").classList.add("hidden");
  setView("order", true);
  await loadShop(nx.dataset.multiNext, true);
  await initAddon(nx.dataset.tok);
  renderCatalog(); renderQuote();
  if (cartCount()) setTimeout(openCart, 300);
});

// Chaque ouverture de commerce a son numéro : une réponse en retard d'un commerce touché avant est ignorée
let shopSeq = 0;
async function loadShop(code, stay) {
  if (state.shop && state.shop.code !== code) multiPark();
  else if (!state.shop) multiParkStored(code);
  const seq = ++shopSeq;
  // On vide tout de suite le menu affiché : rien du commerce précédent ne doit rester pendant le chargement
  state.catalog = null; state.cart = {};
  renderCatalog();
  let shop = null;
  try { shop = await Store.shopByCode(code); } catch (e) { shop = null; }
  if (seq !== shopSeq) return;
  state.shop = shop;
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
  // (HOP! ne prend pas de course maintenant : pareil, on programme d'office au premier créneau)
  const noNow = shut || !state.settings.accepting;
  // Fermé : pas de choix à faire, le calendrier est là tout de suite (jour et heure déjà mis), on passe à la suite
  const was = form.classList.contains("no-now");
  form.classList.toggle("no-now", noNow);
  $("#whenClosed").textContent = noNow ? t("slNoNow") : "";
  if (was !== noNow) setTimeout(renderShopBanner, 0);
  exInput.disabled = !exOk || noNow;
  exInput.closest(".choice").classList.toggle("disabled", !exOk || noNow);
  asapInput.disabled = noNow;
  asapInput.closest(".choice").classList.toggle("disabled", noNow);
  if (noNow && !form.querySelector('input[name=urgency][value=programmee]').checked) {
    form.querySelector('input[name=urgency][value=programmee]').checked = true;
    if (!shut) state.autoSched = true;
    syncVisibility(); renderQuote();
  } else if (!noNow && state.autoSched && val("urgency") === "programmee") {
    // HOP! reprend les courses : l'heure mise d'office (pas choisie par le client) redevient « Dès que possible »
    state.autoSched = false; asapInput.checked = true;
    syncVisibility(); renderQuote();
  } else if (!exOk && exInput.checked) asapInput.checked = true;
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-ob-plan]")) return;
  const w = $("#homeWhen");
  if (!w) return;
  if (vitOn()) { $("#accueil").classList.add("when-open"); renderSlots(); }
  w.scrollIntoView({ behavior: "smooth", block: "center" });
  w.classList.remove("flash"); void w.offsetWidth; w.classList.add("flash");
});
function renderOpenBadge() {
  renderWhenHints();
  const open = openNow(), online = (home.nearby || []).length;
  // Fermé : on dit pourquoi (tous en course, ou personne de connecté) plutôt qu'un simple « Fermé »
  const key = !state.settings.accepting ? "closedNow"
    : open ? (courierFree() || !online ? "openNow" : "openBusy")
    : online ? "allBusy" : "allOff";
  const txt = t(key);
  if (D2 && !open) {
    // Nouveau design : une fine pastille sur une ligne (la carte reste dégagée) + « Programmer »
    const short = (t("k2Short") || {})[key] || txt.split(" · ")[0];
    // Fermé : « Commandez maintenant, on vous livre dès l'ouverture » (patron, 08/11) : la commande part programmée d'office
    $("#openBadge").innerHTML = `<span class="ob-txt">${UI.esc(short)}</span>${key === "allBusy" ? `<button type="button" class="ob-plan" data-ob-plan>${UI.esc(t("k2PlanShort"))} ›</button>` : ""}`;
    $("#openBadge").title = txt;
  } else $("#openBadge").textContent = txt;
  $("#openBadge").classList.toggle("closed", !open);
  vitRender();
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
  if (which === "to" && !quiet) state.toCleared = true;
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

// --- Accueil vitrine ---------------------------------------------------------------------------------
// Bandeaux des commerces à la une : ceux que le patron met en avant (🔥), sinon les boutiques HOP! ; photo, logo, accroche
function vitBanners() {
  try {
    const list = (state.showcase || []).filter(s => UI.safeImg(s.cover) && !s.paused && (s.featured || isHopShop(s)))
      .sort((a, b) => (!!b.featured - !!a.featured) || ((a.rank != null ? Number(a.rank) : 99) - (b.rank != null ? Number(b.rank) : 99))).slice(0, 4);
    return list.map(s => {
      const st = shopState(s), shut = st && !st.open, logo = UI.safeImg(s.logo);
      const recent = s.created_at && Date.now() - new Date(s.created_at) < 30 * 86400000;
      const sub = isHopShop(s) ? t("vitBanHop") : firstPhrase(UI.shopText(s, "tagline")) || t("vitBanAny");
      return `<button type="button" class="k2-card vit-ban" data-pro="${UI.esc(s.code)}">
        <img class="vb-cover" src="${UI.safeImg(s.cover)}" alt="" loading="lazy" decoding="async" />
        <span class="k2-txt"><em>${UI.esc(t(recent ? "hpTag" : "vitBanTop"))}</em><b>${escHop(UI.bi(s.name))}</b><small>${UI.esc(sub)}</small>
          <span class="k2-go">${UI.esc(t(shut ? "k2Prog" : "k2Discover"))} <i aria-hidden="true">›</i></span></span>
        ${logo ? `<span class="vb-logo"><img src="${logo}" alt="" loading="lazy" /></span>` : ""}</button>`;
    });
  } catch (e) { return []; }
}
// Course libre (colis, documents, commerce hors appli) : la carte et les adresses s'ouvrent ; le retour revient à la vitrine
function enterCourse(focusWhich) {
  if (!VIT) return;
  const ch = $("#accueil");
  setView("home", false);
  if (!ch.classList.contains("course")) {
    ch.classList.add("course"); ch.classList.remove("when-open");
    state.vitY = window.scrollY;
    if (location.hash !== "#course") { history.pushState(null, "", location.pathname + location.search + "#course"); here = location.href; state.courseFromVit = true; }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { if (home.map) { home.map.invalidateSize(); renderHomeMap(true); } });
    UI.track("home_course");
  }
  if (focusWhich) setTimeout(() => { const i = homeInput(focusWhich); if (i) nativeFocus.call(i); }, 320);
}
function leaveCourse() {
  if (state.courseFromVit && location.hash === "#course") { state.courseFromVit = false; history.back(); return; }
  history.replaceState(null, "", location.pathname + location.search); here = location.href; routeHash();
}
// Haut de la vitrine : l'adresse de livraison, l'heure, et une fine pastille si on ne peut pas partir maintenant
function vitRender() {
  if (!VIT || !$("#vitAddr")) return;
  try { vitRenderNow(); } catch (e) { /* accueil pas encore prêt : redessiné au prochain passage */ }
}
function vitRenderNow() {
  const street = val("dropoff_address").split(",")[0].trim(), no = val("dropoff_number").trim();
  const txt = street ? (no && !new RegExp("\\b" + no + "\\b").test(street) ? `${street} ${no}` : street) : "";
  const saved = txt && Store.getAddresses().find(a => !a.brand && state.pick.to && a.lat != null && Math.abs(a.lat - state.pick.to.lat) < 1e-4 && Math.abs(a.lon - state.pick.to.lon) < 1e-4);
  const tag = saved && saved.tag ? (saved.tag === "home" ? "🏠" : saved.tag === "work" ? "💼" : "") : "";
  $("#vitAddrTxt").innerHTML = txt ? `<bdi>${UI.esc(txt)}</bdi>` : UI.esc(t("vitAddrPick"));
  $("#vitAddr > i").textContent = tag || "📍";
  const cur = currentWhen(), opt = whenOptions().find(o => o.id === cur);
  const at = val("urgency") === "programmee" && pickupDate();
  $("#vitWhenTxt").textContent = cur === "now" ? t("hmNow").replace(/^\P{L}+/u, "")
    : at ? vitWhenShort(at) : t({ in1h: "hmIn1h", tonight: "hmTonight", tomorrow: "hmTomorrow", opens: "hmOpens", other: "vitOther" }[cur] || "vitOther", { h: (opt && (opt.h || (opt.d ? hhmm(opt.d) : ""))) || "" });
  $("#vitWhen").classList.toggle("on", $("#accueil").classList.contains("when-open"));
  const open = openNow(), st = $("#vitStatus");
  if (!open) {
    const short = ($("#openBadge .ob-txt") || $("#openBadge")).textContent.trim();
    st.innerHTML = `<span>${UI.esc(short)}</span>${$("#openBadge [data-ob-plan]") ? `<button type="button" class="ob-plan" data-ob-plan>${UI.esc(t("k2PlanShort"))} ›</button>` : ""}`;
  }
  st.classList.toggle("hidden", open);
  const base = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity)), city = I18N.cityName(CONFIG.homeCity);
  $("#vitCoursePrice").textContent = t("vitCoursePrice", { city, price: base });
  const zone = money(((CONFIG.pricing || {}).areas || {}).price || 30);
  const trust = [t("vitTrust1"), t("vitTrust2", { price: base, city, zone })].map(x => `<span>${UI.esc(x)}</span>`).join("");
  if ($("#vitTrust").dataset.html !== trust) { $("#vitTrust").innerHTML = trust; $("#vitTrust").dataset.html = trust; }
}
// « Qu'est-ce qu'on vous apporte ? » : ce que le client écrit devient sa commande (« J'achète pour vous » : le livreur
// va au magasin et l'achète), même dans un commerce qui n'est pas sur HOP!
function startFreeOrder(q) {
  q = String(q || "").trim();
  if (norm(q).length < 2) return;
  $("#homeFindList").classList.add("hidden");
  $("#homeFind").value = ""; $("#homeFind").blur();
  UI.track("home_any", { q: q.slice(0, 40) });
  goKind("shop");
  const cur = form.shopping_list.value.trim();
  form.shopping_list.value = cur && !cur.includes(q) ? cur + "\n" + q : cur || q;
  form.shopping_list.rows = Math.min(9, Math.max(3, form.shopping_list.value.split("\n").length + 1));
  form.shopping_list.dispatchEvent(new Event("input", { bubbles: true }));
  // On montre tout de suite la liste écrite (sinon on arrivait en haut du rayon, « 0 / 24 articles » : on croyait que
  // rien n'avait marché), avec un petit éclat
  setTimeout(() => {
    const box = form.shopping_list.closest("label") || form.shopping_list;
    box.scrollIntoView({ block: "center", behavior: "smooth" });
    box.classList.remove("list-flash"); void box.offsetWidth; box.classList.add("list-flash");
    toastCart(t("listReady"));
  }, 650);
}
// Exemples qui s'écrivent tout seuls dans la recherche (on comprend tout de suite qu'on peut tout demander)
function vitTypewriter() {
  const inp = $("#homeFind");
  if (!inp) return;
  let i = 0, n = 0, wait = 0;
  setInterval(() => {
    if (document.hidden || document.activeElement === inp || inp.value || !vitOn()) return;
    const list = t("vitAskEx");
    if (!Array.isArray(list) || !list.length) return;
    if (wait > 0) { wait--; return; }
    const ex = list[i % list.length];
    n++;
    inp.placeholder = "🔎 " + ex.slice(0, n);
    if (n >= ex.length) { n = 0; i++; wait = 22; }
  }, 70);
}
// « Quand » en court : 21:00 · Demain 09:00 · Ven. 09:00 (jamais coupé)
function vitWhenShort(at) {
  const d = new Date(at), h = hhmm(d), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  if (diff === 0) return t("vitToday", { h });
  if (diff === 1) return t("vitTomorrow", { h });
  const nm = (DAYS[I18N.lang] || DAYS.fr)[d.getDay()];
  return `${I18N.lang === "he" ? nm : nm.slice(0, 3) + "."} ${h}`;
}
let goField = () => {};
function initVitrine() {
  const h = $("#homeProBox .ch-h");
  if (h) { h.dataset.i18n = "vitShopsT"; h.textContent = t("vitShopsT"); }
  if (!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) vitTypewriter();
  const find = $("#homeProBox .sc-find");
  if (find) $("#vitHero").appendChild(find);
  // Idées en un geste : elles remplissent la recherche (la liste montre tout de suite la magie de Hoppy)
  const ideas = document.createElement("div");
  ideas.className = "vit-ideas"; ideas.id = "vitIdeas";
  $("#vitHero").appendChild(ideas);
  const drawIdeas = () => { const l = t("vitIdeas"); ideas.innerHTML = Array.isArray(l) ? l.map((x, i) => `<button type="button" data-idea="${i}">${UI.esc(x[0])}</button>`).join("") : ""; };
  drawIdeas(); window.addEventListener("hop:lang", drawIdeas);
  ideas.addEventListener("click", e => {
    const b = e.target.closest("[data-idea]"); if (!b) return;
    const x = (t("vitIdeas") || [])[Number(b.dataset.idea)];
    if (!x) return;
    if (!x[1]) return goField(addrReady("to") ? "from" : "to");
    const inp = $("#homeFind"); inp.value = x[1]; inp.focus(); homeFind(x[1]);
  });
  // (une seule page : l'adresse et la course libre se remplissent ici, sans changer d'écran)
  goField = which => { const i = homeInput(which); if (!i) return; nativeScrollIntoView.call(i.closest(".ch-line") || i, { block: "center", behavior: "smooth" }); setTimeout(() => nativeFocus.call(i, { preventScroll: true }), 380); };
  $("#vitAddr").addEventListener("click", () => goField("to"));
  $("#vitWhen").addEventListener("click", () => { $("#accueil").classList.toggle("when-open"); renderSlots(); vitRender(); });
  $("#homeWhen").addEventListener("click", e => { const w = e.target.closest("[data-when]"); if (w && w.dataset.when !== "other") setTimeout(() => { $("#accueil").classList.remove("when-open"); vitRender(); }, 0); });
  $("#vitCourse").addEventListener("click", () => goField(addrReady("to") ? "from" : "to"));
  $("#homeBack").addEventListener("click", leaveCourse);
  // Bandeaux : ils défilent seuls (toutes les 5 s), s'arrêtent quand on les touche
  let touchAt = 0;
  document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest("#homePharma")) touchAt = Date.now(); }, true);
  setInterval(() => {
    const row = $("#homePharma .k2-row");
    if (!row || document.hidden || !vitOn() || document.body.dataset.view !== "home" || Date.now() - touchAt < 9000) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = row.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !row.firstElementChild) return;
    const w = row.firstElementChild.offsetWidth + 12, n = row.children.length, i = Math.round(Math.abs(row.scrollLeft) / w), nx = (i + 1) % n;
    row.scrollTo({ left: (isRtl() ? -1 : 1) * nx * w, behavior: nx ? "smooth" : "auto" });
  }, 5000);
  vitRender();
}
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
      suggest: which === "from" ? buySuggest : null,
      groceryOnly: which === "from" ? (q => val("service") === "achat" && rayonHits(q, 1).length > 0) : null,
      suggestLater: which === "from" ? buySuggestLater : null,
      streetsOnly: which === "to",
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
      const pos = await myPosition(3500);
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
      // (un commerce enregistré sert de départ, jamais d'adresse de livraison)
      // (accueil vitrine : une adresse perso est l'adresse de LIVRAISON ; un commerce enregistré reste le départ)
      if (addr) applySavedAddr(addr.brand || (!VIT && !state.pick.from) ? "from" : "to", addr);
      return;
    }
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
    const fv = e.target.closest("[data-fav]");
    if (fv) { e.stopPropagation(); toggleFav(fv.dataset.fav); return renderEnsList(); }
    const sh = e.target.closest("[data-ens-shop], [data-pro]");
    if (sh) { $("#ensModal").classList.add("hidden"); state.shopDir = ""; loadShop(sh.dataset.ensShop || sh.dataset.pro); }
  });
  if (VIT) initVitrine();
  state.partnersReady = loadPartners();
  loadShowcase();
  initHomeMap();
  // Position déjà autorisée : on centre la carte sur le client (sans rien lui demander)
  if (navigator.permissions && navigator.geolocation) {
    navigator.permissions.query({ name: "geolocation" }).then(r => {
      if (r.state === "granted") myPosition(3500).then(pos => { setHomePos(pos); renderHomeMap(true); renderLive(); }, () => {});
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
  if (listParam.trim()) setTimeout(() => {
    form.shopping_list.value = ""; startFreeOrder(listParam);
  }, 400);
  else if (kindParam && EXAMPLES.some(x => x.id === kindParam && !x.set.to_city)) setTimeout(() => goKind(kindParam), 400);
  else setTimeout(showAppPromo, 1500);
  // Sur téléphone, la bulle « Nous écrire » remonte au-dessus du bouton Commander
  if ("IntersectionObserver" in window) new IntersectionObserver(es => document.body.classList.toggle("in-home", es[0].isIntersecting)).observe($("#homeSheet"));
}

// Pub plein écran à l'ouverture de l'appli (celles que le patron a activées dans son panel) : une autre à chaque
// ouverture, à tour de rôle. Jamais par-dessus une commande en cours, une page de commerce ou une autre fenêtre.
const LS_PROMO = "livraison.promo.v1";
async function showAppPromo() {
  if (shopCode || kindParam || listParam || document.body.dataset.view !== "home" || Object.keys(state.cart || {}).length
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

// Nouvelle version de l'appli mise en ligne pendant que le téléphone la gardait en arrière-plan : au retour, on recharge
// si le client est sur l'accueil ou sur le 1er écran d'un commerce (son panier est gardé sur le téléphone et rouvert après).
// Avant, un panier en cours bloquait la mise à jour : le téléphone restait des jours sur l'ancienne version.
// En pleine commande (adresse, paiement…), on attend : rien n'est perdu.
const reloadSafe = () => document.body.dataset.view === "home"
  || (!!state.shop && !!cartStored() && Number(form.dataset.step || 1) <= 1);
async function checkNewVersion() {
  const mine = ((document.querySelector('script[src*="client.js"]') || {}).src || "").match(/[?&]v=(\d+)/);
  if (!mine || !reloadSafe()) return;
  try {
    const html = await (await fetch(`${location.pathname}?fresh=${Date.now()}`, { cache: "no-store" })).text();
    const live = html.match(/client\.js\?v=(\d+)/);
    if (!live || live[1] === mine[1] || !reloadSafe()) return;
    if (document.body.dataset.view !== "home") { try { sessionStorage.setItem("hop.reopenCart", "1"); } catch (e) { /* ignore */ } }
    location.reload();
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
    const q = Pricing.computeQuote({ fromCity: homeCity, toCity: homeCity, service: ex.set.service, size: ex.set.size || "petit", roundTrip: ex.set.round_trip, purchaseKind: ex.id }, CONFIG);
    const art = KIND_ART[ex.id];
    return `<button type="button" class="ch-kind${state.homeKind === ex.id ? " on" : ""}" data-kind="${ex.id}">${!D2 && RAYON_KINDS.includes(ex.id) ? `<em class="kind-new">${UI.esc(t("hpNew"))}</em>` : ""}${D2 && K2_ICON[ex.id] ? k2Icon(ex.id, VIT && !!K2_FOND[ex.id]) : art ? UI.artImg(art[0], art[1]) : `<i>${ex.icon}</i>`}<b>${UI.esc(t("ex_" + ex.id + "_t"))}</b></button>`;
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
  state.autoSched = false;
  if (id === "now") form.elements.urgency.value = "asap";
  else {
    form.elements.urgency.value = "programmee";
    if (opt.d) { form.date.value = `${opt.d.getFullYear()}-${pad(opt.d.getMonth() + 1)}-${pad(opt.d.getDate())}`; form.time.value = hhmm(opt.d); }
  }
  syncVisibility();
  renderQuote();
  if (id === "other") fieldsetOf('legend[data-i18n="s4"]').scrollIntoView({ behavior: "smooth", block: "start" });
}
// « Programmer » : de vrais boutons, le jour puis l'heure, seulement les créneaux possibles (horaires de HOP!,
// délai minimum, commerce ouvert à ce moment-là) ; les champs date / heure restent derrière, cachés
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function slotDays() {
  const lead = CONFIG.minLeadMinutes * 60000, out = [];
  const ok = d => d - Date.now() >= lead && !Pricing.checkSchedule(d, CONFIG) && shopOpenAt(d);
  for (let i = 0; i < 9 && out.length < 7; i++) {
    const day = new Date(); day.setDate(day.getDate() + i); day.setHours(0, 0, 0, 0);
    const times = [];
    for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) { const d = new Date(day); d.setMinutes(m); if (ok(d)) times.push(d); }
    if (times.length) out.push({ i, day, times });
  }
  return out;
}
function slotsHtml(days, cur, tm) {
  if (!days.length) return `<p class="sl-none">${UI.esc(t("slNone"))}</p>`;
  const names = DAYS[I18N.lang] || DAYS.fr;
  const dayLbl = x => (x.i === 0 ? t("slToday") : `${names[x.day.getDay()]} ${x.day.getDate()}`);
  return `<b class="sl-h">${UI.esc(t("slDay"))}</b><div class="sl-row sl-days">${days.map(x => `<button type="button" class="sl-chip${x === cur ? " on" : ""}" data-sl-day="${dkey(x.day)}">${UI.esc(dayLbl(x))}</button>`).join("")}</div>
      <b class="sl-h">${UI.esc(t("slTime"))}</b><div class="sl-row sl-times">${cur.times.map(d => `<button type="button" class="sl-chip${tm && d.getTime() === tm.getTime() ? " on" : ""}" data-sl-time="${hhmm(d)}">${hhmm(d)}</button>`).join("")}</div>`;
}
function paintSlots(box, html) {
  if (box.dataset.html === html) return;
  box.innerHTML = html; box.dataset.html = html;
  // Le jour et l'heure choisis bien en vue dans leur rangée (sans faire bouger la page)
  requestAnimationFrame(() => box.querySelectorAll(".sl-row .on").forEach(on => {
    const r = on.parentNode, a = r.getBoundingClientRect(), b = on.getBoundingClientRect();
    if (a.width) r.scrollLeft += (b.left + b.width / 2) - (a.left + a.width / 2);
  }));
}
function renderSlots() {
  const box = $("#slotPick"), hb = VIT && $("#homeSlots"), prog = val("urgency") === "programmee";
  if (!prog && !hb) return;
  const days = slotDays();
  let cur = days.find(x => dkey(x.day) === val("date")), tm = prog && cur && cur.times.find(d => hhmm(d) === val("time"));
  if (prog && box) {
    $("#whenFields").classList.toggle("sl-on", !!days.length);
    // Heure vide, passée ou fermée : le premier créneau possible (le même jour quand on peut)
    if (days.length && !tm) { cur = cur || days[0]; tm = cur.times[0]; form.date.value = dkey(tm); form.time.value = hhmm(tm); }
    paintSlots(box, slotsHtml(days, cur, tm));
  }
  // Accueil vitrine, « Quand » ouvert : les mêmes boutons (le jour regardé reste affiché tant qu'on n'a pas choisi l'heure)
  if (hb) {
    const look = days.find(x => dkey(x.day) === state.slDay);
    paintSlots(hb, slotsHtml(days, look || (prog && cur) || days[0], tm));
  }
}
function onSlotClick(e) {
  const db = e.target.closest("[data-sl-day]"), tb = e.target.closest("[data-sl-time]"), home = e.currentTarget.id === "homeSlots";
  if (!db && !tb) return;
  const prog = val("urgency") === "programmee";
  if (db) {
    state.slDay = db.dataset.slDay;
    // (sur l'accueil, sans heure programmée : on regarde seulement les heures de ce jour-là)
    if (home && !prog) return renderSlots();
    const x = slotDays().find(y => dkey(y.day) === db.dataset.slDay);
    if (!x) return;
    const d = x.times.find(y => hhmm(y) === val("time")) || x.times[0];
    form.date.value = dkey(d); form.time.value = hhmm(d);
  } else {
    const on = e.currentTarget.querySelector(".sl-days .on");
    if (on) form.date.value = on.dataset.slDay;
    form.time.value = tb.dataset.slTime;
    if (!prog) { form.querySelector('input[name=urgency][value=programmee]').checked = true; state.slDay = null; }
    if (home) setTimeout(() => { $("#accueil").classList.remove("when-open"); vitRender(); }, 0);
  }
  if (state.shopSched) state.shopSched = pickupDate();
  state.autoSched = false;   // choisi par le client : on n'y touche plus
  form.time.dispatchEvent(new Event("change", { bubbles: true }));
  renderShopBanner();
}
$("#slotPick").addEventListener("click", onSlotClick);
// « Changer » sur la vitrine du commerce : on descend au calendrier
document.addEventListener("click", e => { if (e.target.closest("[data-sl-goto]")) { const f = $("#slotPick"); if (f) f.closest("fieldset").scrollIntoView({ behavior: "smooth", block: "center" }); } });
// Vitrine du commerce, course programmée (fermé maintenant, ou à l'ouverture) : le jour et l'heure en haut + « Changer »
function schedLine() {
  try {
    const at = val("urgency") === "programmee" && (state.shopSched || form.classList.contains("no-now")) && pickupDate();
    return at ? `<p class="sh-sched"><span>${UI.esc(t("slBanner"))} <b class="sl-when">${UI.esc(vitWhenLong(at))}</b></span><button type="button" class="sh-sched-go" data-sl-goto>${UI.esc(t("slChange"))} ›</button></p>` : "";
  } catch (e) { return ""; }
}
// « Dimanche 8 · 10:30 » / « Aujourd'hui · 10:30 » (le jour en toutes lettres, jamais « demain »)
function vitWhenLong(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const names = DAYS[I18N.lang] || DAYS.fr;
  return `${day.getTime() === today.getTime() ? t("slToday") : `${names[d.getDay()]} ${d.getDate()}`} · ${hhmm(d)}`;
}
$("#homeSlots").addEventListener("click", onSlotClick);

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
  // (nouveau design : plus de grande fenêtre par-dessus l'accueil ; les restaurants se choisissent sur la carte)
  if (!D2 && state.homeKind && cat && !state.pick.from && !RAYON_KINDS.includes(id)) openEns(cat);
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

// --- 🔁 « Commander à nouveau » : les commandes déjà passées, les plus fréquentes d'abord (puis la dernière) ---------
// Commande dans un commerce : un toucher ouvre le commerce avec les mêmes articles dans le panier et la même adresse ;
// course simple : mêmes adresses, même type de course.
const LS_REORDER = "livraison.reorder.v1";
const addrOfOrder = (o, pre) => {
  const lat = Number(o[pre + "_lat"]), lon = Number(o[pre + "_lon"]), txt = String(o[pre + "_address"] || "").trim();
  if (!txt || !isFinite(lat) || !isFinite(lon) || (!lat && !lon)) return null;
  const m = /^(.*?)[\s,]+(\d+[א-תa-zA-Z]?)$/.exec(txt), city = pre === "pickup" ? o.from_city : o.to_city;
  return { street: m ? m[1] : txt, number: m ? m[2] : "", cityId: city, city, lat, lon, exact: true, kind: o[pre + "_kind"] || null,
    building: o[pre + "_building"] || "", floor: o[pre + "_floor"] || "", apt: o[pre + "_apt"] || "", code: o[pre + "_code"] || "", note: o[pre + "_note"] || "" };
};
function reorderList() {
  const done = (state.mine || []).filter(o => !["annulee", "refusee"].includes(o.status) && !o.is_test);
  const groups = {};
  done.forEach(o => {
    const items = Array.isArray(o.items) ? o.items.filter(i => i && i.id) : [];
    const key = items.length && o.shop_name ? "s|" + o.shop_name + "|" + items.map(i => i.id + ":" + i.qty).sort().join(",")
      : "t|" + o.service + "|" + Number(o.pickup_lat).toFixed(4) + "," + Number(o.pickup_lon).toFixed(4) + "|" + Number(o.dropoff_lat).toFixed(4) + "," + Number(o.dropoff_lon).toFixed(4);
    const g = groups[key] = groups[key] || { key, n: 0, o, items };
    g.n++;
    if (new Date(o.created_at || o.pickup_at) > new Date(g.o.created_at || g.o.pickup_at)) g.o = o;
  });
  const last = Object.values(groups).sort((a, b) => new Date(b.o.created_at || b.o.pickup_at) - new Date(a.o.created_at || a.o.pickup_at))[0];
  return Object.values(groups).filter(g => g.items.length || (addrOfOrder(g.o, "pickup") && addrOfOrder(g.o, "dropoff")))
    .sort((a, b) => (b.n - a.n) || (new Date(b.o.created_at || b.o.pickup_at) - new Date(a.o.created_at || a.o.pickup_at)))
    .slice(0, 6).map(g => Object.assign(g, { last: g === last }));
}
const shopCodeOfOrder = o => {
  try { const m = JSON.parse(localStorage.getItem(LS_REORDER) || "{}"); if (m[o.ref]) return m[o.ref]; } catch (e) { /* ignore */ }
  const n = String(o.shop_name || "").trim().toLowerCase();
  const hit = (state.showcase || []).concat(state.partners || []).find(x => String(x.name || "").trim().toLowerCase() === n);
  return hit ? hit.code : null;
};
function renderReorder() {
  const box = $("#homeRepeat");
  if (!box) return;
  const list = reorderList();
  if (!list.length) { box.innerHTML = ""; return; }
  const short = a => a ? `${a.street} ${a.number}`.trim() : "";
  const sc = o => (state.showcase || []).find(x => String(x.name || "").trim().toLowerCase() === String(o.shop_name || "").trim().toLowerCase());
  const card = (g, i) => {
    const o = g.o, shop = g.items.length, logo = shop && sc(o) ? UI.safeImg(sc(o).logo) : null;
    const lines = shop ? String(o.shop_order || "").split("\n").filter(l => l && !/^💬/.test(l))
      .map(l => { const m = /^(\d+)\s*×\s*(.*)$/.exec(l); return m ? `${m[1]} × ${UI.bi(m[2])}` : UI.bi(l); }) : [];
    // (adresses isolées : deux adresses en hébreu ne se mélangent pas ; flèche dans le sens de la langue)
    const title = shop ? escHop(UI.bi(o.shop_name)) : `<bdi>${UI.esc(short(addrOfOrder(o, "pickup")))}</bdi> ${I18N.lang === "he" ? "←" : "→"} <bdi>${UI.esc(short(addrOfOrder(o, "dropoff")))}</bdi>`;
    const sub = shop ? lines.slice(0, 2).join(" · ") + (lines.length > 2 ? ` +${lines.length - 2}` : "") : (t("svc_" + o.service) || "");
    const tag = g.n > 1 && i === 0 ? `⭐ ${t("reoOften", { n: g.n })}` : g.last ? `🕘 ${t("reoLast")}` : g.n > 1 ? t("reoTimes", { n: g.n }) : "";
    return `<button type="button" class="ro-card" data-reorder="${i}">
      <span class="ro-top"><i class="ro-ico">${logo ? `<img src="${UI.esc(logo)}" alt="" />` : shop ? "🛍️" : "📦"}</i>${tag ? `<em class="ro-tag">${UI.esc(tag)}</em>` : ""}</span>
      <b class="ro-title">${title}</b><small class="ro-sub">${UI.esc(sub)}</small>
      <span class="ro-go">🔁 ${UI.esc(t("reoGo"))}</span></button>`;
  };
  state.reorder = list;
  const html = `<h3 class="ch-h">${UI.esc(t("reoTitle"))}</h3><div class="ro-row">${list.map(card).join("")}</div>`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
async function reorderGo(i) {
  const g = (state.reorder || [])[i];
  if (!g) return;
  const o = g.o, savedTo = Store.getAddresses().find(a => !a.brand && a.lat != null && Math.abs(a.lat - Number(o.dropoff_lat)) < 1e-4 && Math.abs(a.lon - Number(o.dropoff_lon)) < 1e-4);
  const to = savedTo || addrOfOrder(o, "dropoff");
  const code = g.items.length ? shopCodeOfOrder(o) : null;
  UI.track("reorder", { kind: code ? "shop" : "trip", n: g.n });
  if (code) {
    state.findItem = null; state.cgQNext = ""; state.shopDir = "";
    await loadShop(code);
    if (!state.shop) return showHomeErr(t("reoGone"));
    const have = new Map(cgProducts().filter(p => p.available).map(p => [p.id, p]));
    let missing = 0;
    state.cart = {};
    g.items.forEach(it => { if (have.has(it.id)) state.cart[it.id] = Math.min(50, Number(it.qty) || 1); else missing++; });
    if (to) applySavedAddr("to", to);
    renderCatalog(); renderQuote();
    if (cartCount()) { openCart(); if (missing) setTimeout(() => alert(t(missing > 1 ? "reoMissingN" : "reoMissing1", { n: missing })), 300); }
    else alert(t("reoAllGone"));
    return;
  }
  const from = Store.getAddresses().find(a => a.lat != null && Math.abs(a.lat - Number(o.pickup_lat)) < 1e-4 && Math.abs(a.lon - Number(o.pickup_lon)) < 1e-4) || addrOfOrder(o, "pickup");
  if (from) applySavedAddr("from", from);
  if (to) applySavedAddr("to", to);
  if (o.service) form.elements.service.value = o.service;
  if (o.size && !(o.size === "gros" && P.carAvailable === false)) form.elements.size.value = o.size;
  syncVisibility(); renderQuote(); syncHome();
  homeGo();
}
document.addEventListener("click", e => { const b = e.target.closest("[data-reorder]"); if (b) { e.preventDefault(); reorderGo(Number(b.dataset.reorder)); } });

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
  const first = activeOrders().length === 0 && welcomeOpen();
  if (ready) {
    const q = currentQuote();
    $("#homeGoPrice").textContent = (q.known ? "" : t("from") + " ") + money(q.total);
    const wl = welcomeLine(q);
    $("#homeGoSub").textContent = wl ? t("hmGoFirstOff", { off: money(Math.abs(wl.amount)), before: money(Number(q.total) + Math.abs(wl.amount)), price: money(q.total) })
      : t("hmGoKm", { from: cityLabel(cityOf("from")), to: cityLabel(cityOf("to")) });
  } else {
    $("#homeGoPrice").textContent = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity));
    $("#homeGoSub").textContent = first ? t("hmGoFirst", { price: money(welcomePrice()) }) : t("hmGoKm", { from: I18N.cityName(CONFIG.homeCity), to: I18N.cityName(CONFIG.homeCity) });
  }
  if (D2) $("#homeGo").innerHTML = `${SCOOT_SVG}<span>${UI.esc(t(ready ? "hmGoNext" : "hmGo"))}</span>`;
  else $("#homeGo").textContent = t(ready ? "hmGoNext" : "hmGo");
  const base = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity));
  $("#homeFair").textContent = t("fairText", { price: ready && val("service") !== "achat" ? money(currentQuote().total) : base });
  $("#homeFairShop").textContent = t("fairShop", { price: ready && val("service") === "achat" ? money(currentQuote().total) : base });
  renderReorder();
  vitRender();
  const key = JSON.stringify([state.fromPoint, state.toPoint]);
  if (key !== home.key) { home.key = key; renderHomeMap(true); renderLive(); }
}

function homeGo() {
  // Liste de Hoppy (ou recherche) ouverte : « Commander » en bas fait comme « Commander cette liste » (jamais une
  // course vide qui oublie ce que le client vient d'écrire)
  const fl = $("#homeFindList"), go = fl && !fl.classList.contains("hidden") && fl.querySelector("[data-mg-go]");
  if (go) { go.click(); return; }
  const q = $("#homeFind") && $("#homeFind").value.trim();
  if (vitOn() && q && norm(q).length >= 2) { startFreeOrder(q); return; }
  showHomeErr("");
  for (const which of ["from", "to"]) {
    if (addrReady(which)) continue;
    const typed = !!val(prefixOf(which) + "_address").trim();
    if (typed && state.pick[which]) { showHomeErr(t("hmNeedNo")); homeNo(which).focus(); }
    else homeInput(which).focus();
    return;
  }
  // Tout est prêt pour les adresses : on continue là où il manque quelque chose
  if (wiz.on) { setView("order", true); wizGo(1, true); wizNext(); return; }
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
  // Nouveau design : la carte suit le jour et la nuit (le filtre de nuit est dans styles.css), sinon le réglage du téléphone
  const dark = !D2 && matchMedia("(prefers-color-scheme: dark)").matches;
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
  if (D2) {
    const route = $("#accueil .ch-route");
    if (route && route.nextElementSibling !== b && !on) route.after(b);
    b.innerHTML = on ? `<span class="mb-ico">⌃</span><b>${UI.esc(t("hmMapClose").replace(/^\S+\s/, ""))}</b>`
      : `<svg class="mb-map" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.6 6.2a1 1 0 0 0-.6.9v12.4a.6.6 0 0 0 .8.6L9 18l6 2.2 5.4-2.2a1 1 0 0 0 .6-.9V4.7a.6.6 0 0 0-.8-.6L15 6.2 9 4zm0 0v14m6-11.8V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><b>${UI.esc(t("hmMapOpen").replace(/^\S+\s/, ""))}</b><span class="mb-go">›</span>`;
    return;
  }
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
          ${contactRow(e.partner ? shopNum(e.partner) : e.p, e.partner ? e.partner.website : e.w)}
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
  return { lat: Number(sh.lat), lon: Number(sh.lon), brand: sh.name, phone: shopNum(sh) || null, website: sh.website || null, partner: true, partnerCode: sh.code, kind: sh.kind || null,
    streetName: m ? m[1] : sh.address || "", housenumber: m ? m[2] : "", street: sh.address || "", city: cityLabel(cityId || sh.city), cityId, exact: true,
    label: [sh.name, sh.address, cityLabel(cityId || sh.city)].filter(Boolean).join(", ") };
}
// --- Vitrine : les commerces HOP! Pro abonnés, mis en avant sur l'accueil (logo, photo, accroche) -------
state.showcase = [];
function proPrice(s) {
  // Boutique HOP! : la course + le petit achat (25 + 5 = 30 ₪ dans Netanya)
  if (isHopShop(s)) return CONFIG.pricing.fixedFromHome[CONFIG.homeCity] + Number(CONFIG.pricing.purchase || 0);
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
// Accroche d'un commerce sur sa carte : la première phrase seulement (complète, jamais coupée au milieu)
const firstPhrase = v => String(v || "").split(/\s[·•|–-]\s|\.\s/)[0].replace(/\.$/, "").trim();
// Carte d'un commerce, compacte : bannière, logo, catégorie, ouvert / fermé, livraison ; toute la carte s'ouvre au toucher
function shopCard(s) {
  const cover = UI.safeImg(s.cover), logo = UI.safeImg(s.logo), fav = favs().includes(s.code), st = shopState(s);
  const initials = String(UI.bi(s.name) || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return `<div class="sc-card pk-${UI.esc(s.kind || "autre")}" data-pro="${UI.esc(s.code)}" role="button" tabindex="0">
    <span class="sc-cover${!cover && logo ? " auto" : ""}"${cover ? ` style="background-image:url(${cover})"` : !cover && logo ? ` style="--logo:url(${logo})"` : ""}>${cover || logo ? "" : `<i>${UI.KIND_ICON[s.kind] || "🏪"}</i>`}
      ${st && !st.open ? `<em class="sc-closed"><span><b>🌙 ${UI.esc(t("scClosedShort"))}</b>${(lb => lb ? `<small>${UI.esc(lb)}</small>` : "")(openLabel(st).replace(/^[^·]*·\s*/, "").replace(/^(Fermé|סגור)$/, ""))}</span></em>` : ""}${isKosher(s) ? kosherTag("k-on-cover") : ""}${s.kind && s.kind !== "autre" && (t("shKinds") || {})[s.kind] ? `<em class="sc-kind">${UI.esc(t("shKinds")[s.kind])}</em>` : ""}</span>
    <button type="button" class="sc-fav${fav ? " on" : ""}" data-fav="${UI.esc(s.code)}" aria-label="♥">${fav ? "♥" : "♡"}</button>
    <span class="sc-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
    <span class="sc-body"><b>${UI.esc(UI.bi(s.name))}</b>
      ${s.paused ? `<small class="sc-meta sc-paused">⏸️ ${UI.esc(t("scPaused"))}</small>` : ""}
      ${st || Number(s.ratings) > 0 ? `<small class="sc-meta sc-st">${Number(s.ratings) > 0 ? `<b class="sc-star">${UI.esc(t("scRating", { avg: String(s.rating).replace(".", ","), n: s.ratings }))}</b>${st ? " · " : ""}` : ""}${st ? `<i class="sc-dot ${st.open ? "on" : "off"}"></i>${UI.esc(D2 && st.open ? openLabel(st).split(" · ")[0] : openLabel(st))}` : ""}</small>` : ""}
      <small class="sc-meta">${s.shop_pays ? `🎁 ${UI.esc(t("scGift"))}` : `🛵 ${UI.esc(money(proPrice(s)))}`}${s.products ? " · " + UI.esc(t("proMenu", { n: s.products })) : s.pro === false ? " · " + UI.esc(t("scWa")) : ""}</small>
      ${UI.shopText(s, "tagline") && !D2 ? `<small class="sc-tag">${UI.esc(firstPhrase(UI.shopText(s, "tagline")))}</small>` : ""}</span>
    ${st && !st.open ? `<span class="sc-prog-btn">${UI.calIcon()} ${UI.esc(t(D2 ? "k2Prog" : "scProgOrder"))}</span>` : `<span class="sc-go" aria-label="${UI.esc(t("proGo"))}">›</span>`}
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
  const isOpen = s => { const st = shopState(s); return !st || st.open; };
  // Favoris du client d'abord, puis les enseignes placées par HOP! (position 1 = en premier), puis les ouvertes
  const rk = s => (s.rank != null ? Number(s.rank) : Infinity);
  // (ouverts toujours devant les fermés : un commerce fermé le soir fait partir le client)
  all.sort((a, b) => (f.includes(b.code) - f.includes(a.code)) || (isOpen(b) - isOpen(a)) || (rk(a) - rk(b) || 0));
  // Ouvert jusqu'à quelle heure (sans horaires : toute la journée)
  const until = s => { const st = shopState(s); return !st ? 1440 : st.open ? st.until : -1; };
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
  const open = placed.filter(isOpen).concat(rest.filter(isOpen)), closed = placed.filter(s => !isOpen(s)).concat(rest.filter(s => !isOpen(s)));
  const stories = `<div class="sc-stories">${all.map(s => `<button type="button" class="sc-story${isOpen(s) ? "" : " closed"}" data-pro="${UI.esc(s.code)}">
        ${shopLogo(s, "sc-ring")}${isKosher(s) ? `<i class="k-dot" title="${UI.esc(t("kosher"))}">${KOSHER_STAR}</i>` : ""}<i class="sc-sdot ${isOpen(s) ? "on" : "off"}"></i><b>${UI.esc(UI.bi(s.name))}</b></button>`).join("")}</div>`;
  // Façon appli de livraison, dès qu'il y a de quoi : rangées « Mes favoris », « Ouverts maintenant », « Populaires »
  // (commandes du mois), « Nouveautés » (arrivés depuis 30 jours), puis tous ; sinon une seule rangée
  const row = (title, items, sub) => (items.length ? `<h4 class="sc-row-h"><span>${UI.esc(title)}</span>${sub ? `<small>${UI.esc(sub)}</small>` : ""}</h4><div class="pro-row">${items.map(shopCard).join("")}</div>` : "");
  const recent = s => s.created_at && Date.now() - new Date(s.created_at) < 30 * 86400000;
  let body;
  if (list.length >= 4 && none) {
    // « Ouverts maintenant » : ceux qui ferment le plus tard d'abord (le soir, on voit tout de suite qui livre encore)
    const favL = list.filter(s => f.includes(s.code)), openL = list.filter(isOpen).sort((a, b) => until(b) - until(a));
    // Mis en avant par le patron (🔥 dans son panel) d'abord, puis l'automatique : les commandes des 30 derniers jours
    const pop = list.filter(s => s.featured || Number(s.orders30) > 0).sort((a, b) => (!!b.featured - !!a.featured) || (Number(b.orders30) - Number(a.orders30))).slice(0, 8);
    const fresh = list.filter(recent).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    // « Populaires », « Nouveautés », « Nos commerces partenaires » : le patron les allume ou les éteint
    // (Espace patron → 🏪 Commerces → 🏠 Accueil des clients) ; config.js → homeRows n'est que la valeur de départ
    const HR = Object.assign({}, CONFIG.homeRows || {}, (state.settings && state.settings.home_rows) || {});
    // Commerces choisis par le patron pour une rangée, dans son ordre ; rien de choisi = l'automatique
    const pick = (k, auto) => { const l = Array.isArray(HR[k + "_list"]) ? HR[k + "_list"] : []; const m = l.map(c => list.find(s => s.code === c)).filter(Boolean); return m.length ? m : auto; };
    // « Ouverts maintenant » : les commerces choisis par le patron passent devant, dans son ordre (s'ils sont ouverts), puis les autres ouverts
    const openPick = (Array.isArray(HR.open_list) ? HR.open_list : []).map(c => openL.find(s => s.code === c)).filter(Boolean);
    const openRow = openPick.concat(openL.filter(s => !openPick.includes(s)));
    body = row(t("rowFavs"), favL) + (HR.open === false ? "" : row(t("rowOpen"), openRow)) + (HR.popular === false ? "" : row(t("rowPop"), pick("popular", pop))) + (HR.fresh === false ? "" : row(t("rowNew"), pick("fresh", fresh))) + (HR.all === false ? "" : row(t("rowAll"), pick("all", open.concat(closed))));
  } else body = list.length ? `<div class="pro-row">${open.concat(closed).map(shopCard).join("")}</div>` : `<p class="muted small sc-empty">${UI.esc(t("scNoneF"))}</p>`;
  const html = stories + body;
  if ($("#homePro").dataset.html !== html) { $("#homePro").innerHTML = html; $("#homePro").dataset.html = html; }
  if (VIT) { renderHomePharma(); $("#homeFilters").classList.toggle("hidden", all.length < 6); }
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
  // Une liste (« 2 lait, du pain, 6 œufs ») : Hoppy la comprend et la range, avec les vrais produits
  if (VIT && parseList(q).length >= 2) return vitMagic(q, box, seq);
  const sc = code => (state.showcase || []).find(x => x.code === code) || {};
  const shops = (state.showcase || []).filter(s => norm(`${s.name} ${(t("shKinds") || {})[s.kind] || ""} ${s.tagline || ""} ${s.tagline_he || ""}`).includes(n)).slice(0, 5);
  const staple = rayonHits(q, 1).length > 0;
  const render = products => {
    if (seq !== findSeq) return;
    if (VIT) return vitFindRender(q, products, shops, staple, box);
    if (staple) products = products.filter(p => !/restaurant|resto|cafe/i.test(p.kind || ""));
    const prodHtml = products.slice(0, 8).map(p => `<button type="button" data-find-pro="${UI.esc(p.code)}" data-find-item="${UI.esc(p.id)}"><span class="fi-pic">${UI.safeImg(sc(p.code).logo) ? `<img src="${UI.safeImg(sc(p.code).logo)}" alt="" />` : (UI.KIND_ICON[p.kind] || "🍽️")}</span><span class="fi-txt"><b>${UI.esc(UI.bi(p.name))}</b><small>${UI.esc(t("findAt", { shop: UI.bi(p.shop) }))}${p.category ? " · " + UI.esc(UI.bi(p.category)) : ""}</small></span><span class="fi-price" dir="ltr">${money(p.price)}</span></button>`).join("");
    const shopHtml = shops.map(s => `<button type="button" data-find-pro="${UI.esc(s.code)}"><span class="fi-pic">${UI.safeImg(s.logo) ? `<img src="${UI.safeImg(s.logo)}" alt="" />` : (UI.KIND_ICON[s.kind] || "🏪")}</span><span class="fi-txt"><b>${UI.esc(UI.bi(s.name))}</b><small>${UI.esc((t("shKinds") || {})[s.kind] || "")}${UI.shopText(s, "tagline") ? " · " + UI.esc(UI.shopText(s, "tagline")) : ""}</small></span></button>`).join("");
    // Les rayons HOP! (eau, couches, Acamol…) : le livreur va au magasin le plus proche
    const rayHtml = rayonHits(q, 4).map(({ r, i }) => `<button type="button" data-find-ray="${UI.esc(r.id)}"><span class="fi-pic">${UI.esc(i.e || "🛒")}</span><span><b>${UI.esc(phName(i))}</b><small>${UI.esc(t("acRayon", { rayon: phName(r.title) }))}</small></span></button>`).join("");
    // Accueil vitrine : en premier, « On vous l'apporte » (n'importe quoi, de n'importe quel commerce : le livreur l'achète)
    const anyHtml = VIT ? `<button type="button" class="fi-any" data-find-any><span class="fi-pic">🛵</span><span class="fi-txt"><b>${UI.esc(t("vitAny", { q: q.trim().slice(0, 60) }))}</b><small>${UI.esc(t("vitAnySub"))}</small></span><span class="fi-go" aria-hidden="true">›</span></button>` : "";
    box.innerHTML = anyHtml + (rayHtml ? `<h5>${UI.esc(t("findRayons"))}</h5>${rayHtml}` : "") + (prodHtml ? `<h5>${UI.esc(t("findProducts"))}</h5>${prodHtml}` : "") + (shopHtml ? `<h5>${UI.esc(t("findShops"))}</h5>${shopHtml}` : "")
      || `<p class="fi-none">${UI.esc(t("findNone", { q }))}</p>`;
    box.classList.remove("hidden");
  };
  render([]);
  try { render(await Store.productsSearch(q)); } catch (e) { /* les commerces suffisent */ }
  UI.track("home_find", { q: q.slice(0, 40) });
}
$("#homeFind").addEventListener("input", e => { clearTimeout(findTimer); findTimer = setTimeout(() => homeFind(e.target.value), 250); });
// Résultats de la vitrine : « On vous l'apporte », puis les produits rangés PAR COMMERCE (logo, nom, « Tout voir »)
// en cartes avec photo et prix (un toucher ouvre la fiche du produit dans son commerce), les courses HOP! (rayons), les commerces
function vitFindRender(q, products, shops, staple, box) {
  if (staple) products = products.filter(p => !/restaurant|resto|cafe/i.test(p.kind || ""));
  const sc = code => (state.showcase || []).find(x => x.code === code) || {};
  const qa = UI.esc(q.trim());
  const any = `<button type="button" class="fi-any" data-find-any><span class="fi-pic">🛵</span><span class="fi-txt"><b>${UI.esc(t("vitAny", { q: q.trim().slice(0, 60) }))}</b><small>${UI.esc(t("vitAnySub"))}</small></span><span class="fi-go" aria-hidden="true">›</span></button>`;
  const groups = [];
  products.forEach(p => { let g = groups.find(x => x.code === p.code); if (!g) groups.push(g = { code: p.code, shop: p.shop, kind: p.kind, items: [] }); g.items.push(p); });
  const card = (attrs, pic, white, price, name) => `<button type="button" class="fr-card" ${attrs}><span class="fr-pic${white ? " white" : ""}">${pic}</span>
    <span class="fr-price">${price}</span><span class="fr-nm">${name}</span></button>`;
  const prodHtml = groups.map(g => {
    const logo = UI.safeImg(sc(g.code).logo);
    return `<section class="fr-group"><div class="fr-head"><span class="fr-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(UI.KIND_ICON[g.kind] || "🏪")}</span>
      <span class="fr-name"><b>${escHop(UI.bi(g.shop))}</b><small>${UI.esc(t(g.items.length === 1 ? "vitFindN1" : "vitFindN", { n: g.items.length }))}</small></span>
      <button type="button" class="fr-all" data-find-pro="${UI.esc(g.code)}" data-find-q="${qa}">${UI.esc(t("vitFindAll"))} ›</button></div>
      <div class="fr-row">${g.items.slice(0, 12).map(p => { const ph = UI.safeImg(p.photo);
        return card(`data-find-pro="${UI.esc(p.code)}" data-find-item="${UI.esc(p.id)}" data-find-open="1"`, ph ? `<img src="${ph}"${UI.imgCors(ph)} alt="" loading="lazy" />` : `<i>${UI.esc(UI.KIND_ICON[g.kind] || "🛍️")}</i>`,
          !!ph && UI.extPic(ph), `<bdi dir="ltr">${UI.esc(money(p.price))}</bdi>`, UI.esc(UI.bi(p.name))); }).join("")}</div></section>`;
  }).join("");
  const rays = rayonHits(q, 8);
  const rayHtml = rays.length ? `<section class="fr-group"><div class="fr-head"><span class="fr-logo hop">🛒</span><span class="fr-name"><b>${escHop(t("vitFindRay").replace(/^\P{L}+/u, ""))}</b><small>${UI.esc(t("vitFindRaySub"))}</small></span></div>
    <div class="fr-row">${rays.map(({ r, i }) => { const ph = UI.safeImg(i.photo) || (i.img ? `img/qc/${i.img}.webp` : ""), pr = i.p || (i.opt && i.opt[0] && (i.opt[0].p || i.opt[0].pb)) || i.pb;
      return card(`data-find-ray="${UI.esc(r.id)}"`, ph ? `<img src="${ph}" alt="" loading="lazy" />` : `<i>${UI.esc(i.e || "🛒")}</i>`, true, pr ? `≈ <bdi dir="ltr">${priceTxt(pr)}</bdi>` : "&nbsp;", UI.esc(phName(i))); }).join("")}</div></section>` : "";
  const shopHtml = shops.length ? `<h5>${UI.esc(t("vitFindShops"))}</h5>` + shops.map(s => `<button type="button" data-find-pro="${UI.esc(s.code)}"><span class="fi-pic">${UI.safeImg(s.logo) ? `<img src="${UI.safeImg(s.logo)}" alt="" />` : (UI.KIND_ICON[s.kind] || "🏪")}</span><span class="fi-txt"><b>${escHop(UI.bi(s.name))}</b><small>${UI.esc((t("shKinds") || {})[s.kind] || "")}</small></span></button>`).join("") : "";
  // (les rayons d'abord pour les courses du quotidien : lait, eau, couches…)
  box.innerHTML = any + (staple ? rayHtml + prodHtml : prodHtml + rayHtml) + shopHtml;
  box.classList.remove("hidden");
}
// --- ✨ « Dites-le à Hoppy » : une phrase → la liste rangée, avec le vrai produit, sa photo, son prix et le total ----------
const LIST_SPLIT = /\s*(?:,|،|;|\n|\+|\s(?:et|and|puis|avec)\s|\sוגם\s|\sו(?=[\u05d0-\u05ea]{2}))\s*/i;
function parseList(q) {
  return String(q || "").split(LIST_SPLIT).map(x => x.trim()).filter(x => norm(x).length >= 2).slice(0, 8).map(p => {
    let qty = 1, name = p, m = /^(\d{1,2})\s*(?:x|×|\*)?\s+(.+)$/i.exec(p) || /^(\d{1,2})(?:x|×)\s*(.+)$/i.exec(p);
    if (m) { qty = Number(m[1]); name = m[2]; } else if ((m = /^(.+?)\s*(?:x|×|\*)\s*(\d{1,2})$/i.exec(p))) { qty = Number(m[2]); name = m[1]; }
    // « 6 œufs », « 12 rouleaux » : le nombre fait partie du produit (une boîte), pas 6 boîtes
    if (qty > 5) { qty = 1; name = p; }
    name = name.replace(/^(?:(?:du|de la|des|un|une|le|la|les)\s+|(?:de l|l)['’]\s*)/i, "").trim() || p;
    return { qty: Math.max(1, Math.min(20, qty)), name, raw: p };
  });
}
const magicCache = new Map();
// Tous les produits trouvés pour un article (tous les magasins), le meilleur d'abord ; et le produit des courses HOP!
// Note d'un produit pour un mot cherché (« pain », « 6 œufs »…) : > 0 = c'est bien ce produit (même règle partout :
// liste de Hoppy, recherche dans le catalogue d'un magasin)
function mgScorer(q) {
    const nn = phNorm(q).trim(), wantDiet = /diet|zero|light|דיאט|זירו|לייט/i.test(q);
    const esc = nn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Nom sans la marque (« Tnuva · Lait 1 % » → « lait 1 % », « Brossard - Pain d'épices » → « pain d'épices »)
    const clean = x => phNorm(UI.bi(x.name)).replace(/^[^·]*·\s*/, "").replace(/^[^-–]+\s[-–]\s+/, "");
    // « pain » = du pain, pas du « pain d'épices » ni du « pain au chocolat » : le mot cherché suivi de « d' / de / au… »
    // décrit un autre produit
    const other = new RegExp("^" + esc + "s?\\s+(d['’]|de\\s|du\\s|des\\s|au\\s|aux\\s|à\\s|a\\s|en\\s)");
    const score = x => { const a = phNorm(UI.bi(x.name)), b = clean(x); let sc = 0;
      const wd = new RegExp("^" + esc + "(s|x)?(\\s|$|[^a-z\u0590-\u05ff])");
      if (wd.test(b) || wd.test(a)) sc += 30; else if (b.startsWith(nn) || a.startsWith(nn)) sc += 15;
      else if (new RegExp("(^|[^a-z\u0590-\u05ff])" + esc).test(a)) sc += 5; else return -99;   // « œufs » n'est pas dans « bœuf »
      if (other.test(b)) sc -= 28;
      // « 6 œufs » = des œufs, pas des « œufs mayonnaise » : d'autres mots que le produit (hors taille, marque, %) = un autre produit
      const rest = b.replace(new RegExp("(^|\\s)" + esc + "\\S*"), " ").replace(/\[[^\]]*\]|\([^)]*\)/g, " ");
      if ((rest.match(/[a-z\u00e0-\u00ff\u0590-\u05ff]{3,}/g) || []).some(w => !/^(pack|lot|bio|frais|fraiche|frais|maxi|mini|grand|gros|petit|classique|nature|blanc|blancs|extra|tranche|tranches|bouteille|carton|boite|sachet|paquet)$/.test(w))) sc -= 12;
      // Plats tout prêts (traiteur, restaurant) : seulement si c'est exactement ce qui est écrit
      if (/traiteur|restaurant|resto|cafe/i.test(x.kind || "")) sc -= 10;
      if (!wantDiet && /diet|zero|light|דיאט|זירו|לייט/i.test(x.name)) sc -= 25;
      return sc - a.length / 40; };
  return score;
}
function magicFind(name) {
  const k = norm(name);
  if (!magicCache.has(k)) magicCache.set(k, (async () => {
    let prods = [];
    // « 6 œufs » : on cherche « œufs » (le nombre reste affiché sur la ligne)
    const q = String(name).replace(/^\d+\s*(x|×)?\s*/i, "").trim() || name;
    try { prods = (await Store.productsSearch(q)) || []; } catch (e) { /* les rayons suffisent */ }
    const score = mgScorer(q);
    const cands = prods.filter(x => !/restaurant|resto|cafe/i.test(x.kind || "") && score(x) > 0).sort((a, b) => score(b) - score(a)).slice(0, 12);
    // Un vrai produit d'un magasin seulement s'il correspond bien ; sinon les courses HOP! (pain, œufs…) passent devant
    return { cands, strong: !!cands.length && score(cands[0]) >= 25, r: rayonHits(q, 1)[0] || null };
  })());
  return magicCache.get(k);
}
const rayPrice = i => { const o = i.opt && i.opt[0], pr = i.p || (o && (o.p || o.pb)) || i.pb; return !pr ? 0 : Array.isArray(pr) ? priceMid(pr) : Number(pr) || 0; };
const mgShopName = code => { const x = (state.showcase || []).find(z => z.code === code); return x ? UI.bi(x.name) : ""; };
async function vitMagic(q, box, seq) {
  const items = parseList(q);
  const head = `<div class="mg-head"><b>${UI.esc(t("mgTitle"))}</b><small>${UI.esc(t("mgN", { n: items.length }))}</small></div>`;
  box.innerHTML = `<div class="mg">${head}${items.map(i => `<div class="mg-row wait"><span class="mg-pic"><i class="mg-spin"></i></span><span class="mg-txt"><b>${UI.esc(i.qty > 1 ? i.qty + " × " : "")}${UI.esc(i.name)}</b><small>${UI.esc(t("mgWait"))}</small></span></div>`).join("")}</div>`;
  box.classList.remove("hidden");
  const res = await Promise.all(items.map(i => magicFind(i.name)));
  if (seq !== findSeq) return;
  // Choix de départ : le meilleur produit trouvé, sinon les courses HOP!, sinon « on le trouve pour vous »
  state.magic = { q, open: -1, lines: items.map((it, k) => ({ qty: it.qty, name: it.name, cands: res[k].cands, r: res[k].r, pick: res[k].strong ? 0 : res[k].r ? "r" : res[k].cands.length ? 0 : "x", on: true })) };
  renderMagic(true);
  UI.track("home_magic", { n: items.length });
}
const mgLineCost = l => l.pick === "r" ? rayPrice(l.r.i) * l.qty : typeof l.pick === "number" ? Number(l.cands[l.pick].price) * l.qty : 0;
// Magasins qui ont TOUTE la liste : le total chez chacun (meilleur produit de ce magasin pour chaque article)
function mgShopsAll(lines) {
  const on = lines.filter(l => l.on);
  if (!on.length) return [];
  const codes = new Set(); on.forEach(l => l.cands.forEach(c => codes.add(c.code)));
  return [...codes].map(code => {
    let sum = 0;
    for (const l of on) { const i = typeof l.pick === "number" && l.cands[l.pick].code === code ? l.pick : l.cands.findIndex(c => c.code === code); if (i < 0) return null; sum += Number(l.cands[i].price) * l.qty; }
    return { code, sum, shop: (on.map(l => l.cands.find(c => c.code === code)).find(Boolean) || {}).shop || mgShopName(code) };
  }).filter(Boolean).sort((a, b) => a.sum - b.sum).slice(0, 3);
}
function renderMagic(anim) {
  const m = state.magic, box = $("#homeFindList");
  if (!m) return;
  const lines = m.lines, on = lines.filter(l => l.on);
  const sum = on.reduce((a, l) => a + mgLineCost(l), 0);
  const pic = (ph, white) => `<span class="mg-pic${white ? " white" : ""}">${ph}</span>`;
  const rows = lines.map((l, k) => {
    if (!l.on) return "";
    let picH, title, sub, price;
    if (typeof l.pick === "number") {
      const c = l.cands[l.pick], ph = UI.safeImg(c.photo);
      picH = pic(ph ? `<img src="${ph}"${UI.imgCors(ph)} alt="" loading="lazy" />` : "🛍️", ph && UI.extPic(ph));
      title = UI.esc(UI.bi(c.name)); sub = escHop(t("mgAt", { shop: UI.bi(c.shop) })); price = `<bdi dir="ltr">${UI.esc(money(Number(c.price) * l.qty))}</bdi>`;
    } else if (l.pick === "r") {
      const ph = UI.safeImg(l.r.i.photo) || (l.r.i.img ? `img/qc/${l.r.i.img}.webp` : ""), v = rayPrice(l.r.i) * l.qty;
      picH = pic(ph ? `<img src="${ph}" alt="" loading="lazy" />` : UI.esc(l.r.i.e || "🛒"), true);
      title = UI.esc(phName(l.r.i)); sub = escHop(t("mgRay")); price = v ? `≈ <bdi dir="ltr">${UI.esc(money(v))}</bdi>` : "";
    } else { picH = pic("🛵"); title = UI.esc(l.name); sub = UI.esc(t("mgAny")); price = ""; }
    const alts = l.cands.length + (l.r ? 1 : 0) > 1 || (l.cands.length && l.r);
    const open = m.open === k;
    const altRow = open ? `<div class="mg-alts">${l.cands.map((c, i) => { const ph = UI.safeImg(c.photo);
        return `<button type="button" class="mg-alt${l.pick === i ? " on" : ""}" data-mg-pick="${k}:${i}"><span class="fr-pic${ph && UI.extPic(ph) ? " white" : ""}">${ph ? `<img src="${ph}"${UI.imgCors(ph)} alt="" loading="lazy" />` : "🛍️"}</span><span class="fr-price"><bdi dir="ltr">${UI.esc(money(c.price))}</bdi></span><span class="fr-nm">${UI.esc(UI.bi(c.name))}</span><span class="mg-alt-shop">${escHop(UI.bi(c.shop))}</span></button>`; }).join("")}
        ${l.r ? `<button type="button" class="mg-alt${l.pick === "r" ? " on" : ""}" data-mg-pick="${k}:r"><span class="fr-pic white">${UI.safeImg(l.r.i.photo) || l.r.i.img ? `<img src="${UI.safeImg(l.r.i.photo) || `img/qc/${l.r.i.img}.webp`}" alt="" loading="lazy" />` : UI.esc(l.r.i.e || "🛒")}</span><span class="fr-price">${rayPrice(l.r.i) ? `≈ <bdi dir="ltr">${UI.esc(money(rayPrice(l.r.i)))}</bdi>` : "&nbsp;"}</span><span class="fr-nm">${UI.esc(phName(l.r.i))}</span><span class="mg-alt-shop">${escHop(t("mgRayShort"))}</span></button>` : ""}
        <button type="button" class="mg-alt${l.pick === "x" ? " on" : ""}" data-mg-pick="${k}:x"><span class="fr-pic"><i>🛵</i></span><span class="fr-price">&nbsp;</span><span class="fr-nm">${UI.esc(t("mgLetHop"))}</span><span class="mg-alt-shop">${UI.esc(l.name)}</span></button></div>` : "";
    return `<div class="mg-item${open ? " open" : ""}"><div class="mg-row${anim ? "" : " still"}" style="--d:${k * 90}ms">
      <button type="button" class="mg-main" data-mg-row="${k}">${picH}<span class="mg-txt"><b>${title}</b><small>${sub}${alts ? ` · <u>${UI.esc(t(open ? "mgClose" : "mgChange"))}</u>` : ""}</small></span></button>
      <span class="mg-side"><span class="mg-price">${price}</span><span class="mg-qty"><button type="button" data-mg-qty="${k}:-1" aria-label="−">${l.qty > 1 ? "−" : "✕"}</button><b>${l.qty}</b><button type="button" data-mg-qty="${k}:1" aria-label="+">+</button></span></span>
    </div>${altRow}</div>`;
  }).join("");
  const shops = mgShopsAll(lines), fee = money(Pricing.cityToCity(CONFIG, CONFIG.homeCity, CONFIG.homeCity));
  const shopBtns = shops.map((x, i) => `<button type="button" class="mg-cart" data-mg-shop="${UI.esc(x.code)}"><span>🛒 ${escHop(t("mgAllAt", { shop: String(UI.bi(x.shop)).replace(/^HOP!\u200E?\s*(?:chez\s+|ב)/i, "") }))}</span><b><bdi dir="ltr">${UI.esc(money(Math.round(x.sum * 10) / 10))}</bdi></b>${shops.length > 1 && i === 0 ? `<em>${UI.esc(t("mgCheapest"))}</em>` : ""}</button>`).join("");
  const n = on.reduce((a, l) => a + l.qty, 0);
  box.innerHTML = `<div class="mg"><div class="mg-head"><b>${UI.esc(t("mgTitle"))}</b><small>${UI.esc(t("mgN", { n }))}</small></div>
    <div class="mg-list">${rows || `<p class="fi-none">${UI.esc(t("mgEmpty"))}</p>`}</div>
    <div class="mg-add" data-mg-add><input type="text" enterkeyhint="done" autocomplete="off" placeholder="${UI.esc(t("mgAddPh"))}" aria-label="${UI.esc(t("mgAddBtn"))}" /><button type="button" data-mg-add-go>${UI.esc(t("mgAddBtn"))}</button></div>
    ${on.length ? `<div class="mg-sum"><b>${sum ? UI.esc(t("mgTotal", { sum: money(Math.round(sum * 10) / 10) })) : ""}</b><small>${UI.esc(t("mgFee", { fee }))}</small></div>
    <div class="mg-acts">${shopBtns}<button type="button" class="mg-go${shops.length ? " alt" : ""}" data-mg-go>${UI.esc(t("mgGo"))}</button></div>
    <a class="mg-wa" data-wa-list data-wa-from="magic" href="#" target="_blank" rel="noopener">${UI.esc(t("mgWa"))}</a>` : ""}</div>`;
  box.classList.remove("hidden");
}
// « ➕ Ajouter un article » sous la liste : n'importe quel produit de n'importe quel magasin (ou des courses HOP!),
// cherché comme le reste ; les choix déjà faits (quantités, magasins) ne bougent pas
async function mgAdd(txt) {
  const m = state.magic, items = parseList(txt).length ? parseList(txt) : [{ qty: 1, name: txt }];
  if (!m || !items.length) return;
  const res = await Promise.all(items.map(i => magicFind(i.name)));
  if (state.magic !== m) return;
  items.forEach((it, k) => m.lines.push({ qty: it.qty, name: it.name, cands: res[k].cands, r: res[k].r, pick: res[k].strong ? 0 : res[k].r ? "r" : res[k].cands.length ? 0 : "x", on: true }));
  const inp = $("#homeFind"); inp.value = inp.value.trim().replace(/[,،;]\s*$/, "") + ", " + txt; m.q = inp.value;
  renderMagic(false);
  const list = $("#homeFindList .mg-list"); if (list) list.scrollTop = list.scrollHeight;
  UI.track("home_magic_add", { n: items.length });
}
function mgAddGo(f) {
  const inp = f.querySelector("input"), v = inp.value.trim();
  if (norm(v).length < 2) return inp.focus();
  inp.value = ""; inp.disabled = true;
  mgAdd(v).finally(() => { const i2 = $("#homeFindList [data-mg-add] input"); if (i2) i2.disabled = false; });
}
$("#homeFindList").addEventListener("keydown", e => { const f = e.key === "Enter" && e.target.closest("[data-mg-add]"); if (f) { e.preventDefault(); mgAddGo(f); } });
$("#homeFindList").addEventListener("click", e => { const b = e.target.closest("[data-mg-add-go]"); if (b) mgAddGo(b.closest("[data-mg-add]")); });
// La liste telle que le livreur la lira (produit, magasin, prix indicatif)
function mgText() {
  return state.magic.lines.filter(l => l.on).map(l => {
    const q = l.qty > 1 ? l.qty + " × " : "";
    if (typeof l.pick === "number") { const c = l.cands[l.pick]; return `${q}${UI.bi(c.name)} (${UI.bi(c.shop)}, ${money(Number(c.price) * l.qty)})`; }
    if (l.pick === "r") return `${q}${phName(l.r.i)}`;
    return `${q}${l.name}`;
  }).join("\n");
}
$("#homeFindList").addEventListener("click", e => {
  const m = state.magic;
  if (!m || !e.target.closest(".mg")) return;
  const row = e.target.closest("[data-mg-row]"), pk = e.target.closest("[data-mg-pick]"), qt = e.target.closest("[data-mg-qty]"), sh = e.target.closest("[data-mg-shop]");
  if (row) { const k = Number(row.dataset.mgRow), l = m.lines[k]; if (l.cands.length + (l.r ? 1 : 0) >= 1) { m.open = m.open === k ? -1 : k; renderMagic(false); } return; }
  if (pk) { const [k, v] = pk.dataset.mgPick.split(":"); m.lines[k].pick = v === "r" || v === "x" ? v : Number(v); m.open = -1; renderMagic(false); return; }
  if (qt) { const [k, d] = qt.dataset.mgQty.split(":").map(Number), l = m.lines[k]; l.qty += d; if (l.qty < 1) { l.on = false; l.qty = 1; } l.qty = Math.min(20, l.qty); renderMagic(false); return; }
  if (sh) return magicToCart(sh.dataset.mgShop);
  if (e.target.closest("[data-mg-go]")) {
    // Des articles choisis viennent d'un magasin sur HOP! (ex. HOP! chez Carrefour) : la commande part chez lui, articles
    // dans le panier (jamais « le magasin le plus proche ») ; le reste de la liste va dans la précision pour ce magasin
    const cnt = {};
    m.lines.filter(l => l.on && typeof l.pick === "number").forEach(l => { const c = l.cands[l.pick].code; if (c) cnt[c] = (cnt[c] || 0) + 1; });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (best) return magicToCart(best, true);
    return startFreeOrder(mgText());
  }
});
// Téléphone : toucher la liste ne ferme pas le clavier (sinon la page bouge sous le doigt et le toucher tombe à côté)
$("#homeFindList").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
async function magicToCart(code, withRest) {
  const m = state.magic;
  if (!m || !code) return;
  // Les lignes sans produit de ce magasin dans la recherche : on les cherche ensuite dans SON catalogue (pain, œufs…)
  const left = withRest ? m.lines.filter(l => l.on && !l.cands.some(c => c.code === code)) : [];
  // Pour chaque article : le produit choisi s'il est de ce magasin, sinon le meilleur de ce magasin
  const want = m.lines.filter(l => l.on).map(l => { const i = typeof l.pick === "number" && l.cands[l.pick].code === code ? l.pick : l.cands.findIndex(c => c.code === code); return i >= 0 ? { id: l.cands[i].id, qty: l.qty } : null; }).filter(Boolean);
  $("#homeFindList").classList.add("hidden"); $("#homeFind").value = ""; $("#homeFind").blur();
  state.findItem = null; state.cgQNext = ""; state.shopDir = "";
  UI.track("home_magic_cart", { shop_code: code, n: want.length });
  await loadShop(code);
  if (!state.shop) return;
  const have = new Set(cgProducts().filter(p => p.available).map(p => p.id));
  want.forEach(w => { if (have.has(w.id)) state.cart[w.id] = Math.min(50, (state.cart[w.id] || 0) + w.qty); });
  // Chaque ligne restante : le meilleur produit de ce catalogue (même règle que la liste de Hoppy) ; sinon, elle part
  // dans la précision pour ce magasin (rien ne se perd)
  const avail = cgProducts().filter(p => p.available), rest = [];
  left.forEach(l => {
    const q = String(l.name).replace(/^\d+\s*(x|×)?\s*/i, "").replace(/^(du|de la|de l'|des|un|une|le|la|les|d')\s*/i, "").trim() || l.name;
    const sc = mgScorer(q), best = avail.map(p => [p, sc(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
    if (best) state.cart[best[0].id] = Math.min(50, (state.cart[best[0].id] || 0) + l.qty);
    else rest.push((l.qty > 1 ? l.qty + " × " : "") + (l.pick === "r" && l.r ? phName(l.r.i) : l.name));
  });
  if (rest.length && form.shop_order) {
    const cur = form.shop_order.value.trim();
    form.shop_order.value = (cur ? cur + "\n" : "") + t("mgAlso") + " " + rest.join(", ");
    form.shop_order.dispatchEvent(new Event("input", { bubbles: true }));
  }
  renderCatalog(); renderQuote();
  if (cartCount()) setTimeout(openCart, 250);
}
// Vitrine : dès qu'on écrit, la recherche remonte en haut de l'écran (les résultats ont toute la place)
function vitFindTop() {
  if (!VIT) return;
  const inp = $("#homeFind"), bar = document.querySelector(".topbar");
  const y = inp.getBoundingClientRect().top + window.scrollY - ((bar && bar.offsetHeight) || 0) - 12;
  if (Math.abs(window.scrollY - y) > 8) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}
$("#homeFind").addEventListener("focus", () => setTimeout(vitFindTop, 120));
$("#homeFind").addEventListener("input", vitFindTop);
$("#homeFind").addEventListener("keydown", e => {
  if (e.key !== "Enter" || !VIT) return;
  e.preventDefault();
  const q = e.target.value.trim();
  if (norm(q).length < 2) return;
  if (parseList(q).length >= 2 && state.magic) return startFreeOrder(mgText());
  startFreeOrder(q);
});
$("#homeFind").addEventListener("focus", e => { if (norm(e.target.value).length >= 2) homeFind(e.target.value); });
// (toucher une idée sous la recherche, « Ma liste de courses »… ouvre la liste : elle ne doit pas se refermer aussitôt)
document.addEventListener("click", e => { if (!(e.composedPath ? e.composedPath() : [e.target]).some(n => n.classList && (n.classList.contains("sc-find") || n.classList.contains("vit-ideas")))) $("#homeFindList").classList.add("hidden"); });
// Retoucher la recherche déjà remplie (même sans quitter le champ) : la liste revient
$("#homeFind").addEventListener("click", e => { if (norm(e.target.value).length >= 2 && $("#homeFindList").classList.contains("hidden")) homeFind(e.target.value); });
$("#homeFindList").addEventListener("click", e => {
  if (e.target.closest("[data-find-any]")) return startFreeOrder($("#homeFind").value.trim());
  if (e.target.closest(".mg")) return;
  const ry = e.target.closest("[data-find-ray]");
  if (ry) { const r = Rayons.byId(ry.dataset.findRay); $("#homeFindList").classList.add("hidden"); if (r) goRayonFind(r, $("#homeFind").value.trim()); return; }
  const b = e.target.closest("[data-find-pro]");
  if (!b) return;
  state.findItem = b.dataset.findItem || null;
  state.findOpen = !!b.dataset.findOpen;
  state.cgQNext = b.dataset.findQ || "";
  $("#homeFindList").classList.add("hidden");
  state.shopDir = ""; loadShop(b.dataset.findPro);
});
$("#homePro").addEventListener("click", e => {
  const f = e.target.closest("[data-fav]");
  if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); }
}, true);
$("#homePro").addEventListener("keydown", e => { const c = e.target.closest("[data-pro]"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); c.click(); } });
async function loadShowcase() {
  // La dernière liste gardée sur le téléphone s'affiche tout de suite ; la base la remplace dès qu'elle répond
  if (!state.showcase.length) { try { const kept = JSON.parse(localStorage.getItem("livraison.showcase.v1") || "null"); if (Array.isArray(kept) && kept.length) { state.showcase = kept; renderShowcase(); } } catch (e) { /* ignore */ } }
  try { state.showcase = (await Store.shopsShowcase()) || []; } catch (e) { /* base lente : on garde ce qui est affiché */ }
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
// Le vrai logo d'un partenaire HOP! (celui de sa boutique), jamais un simple dessin
const partnerLogo = x => (x && x.partner && x.code ? UI.safeImg(((state.showcase || []).find(s => s.code === x.code) || {}).logo) : "") || "";
function renderEnsList() {
  const n = norm($("#ensFilter").value);
  ens.shown = ens.items.filter(x => !n || norm(x.name + " " + x.street).includes(n));
  const dist = x => (x.km < 1 ? `${Math.max(50, Math.round(x.km * 20) * 50)} m` : `${x.km.toFixed(1).replace(".", ",")} km`);
  // Nouveau design : nos partenaires de la rubrique en belles cartes (photo, logo, ouvert / fermé, Programmer),
  // puis les autres commerces du quartier en liste simple
  const cards = D2 ? ens.shown.map(x => x.partner && x.code && (state.showcase || []).find(s => s.code === x.code)).filter(Boolean)
    .filter((s, i, a) => a.findIndex(z => z.code === s.code) === i) : [];
  const shownCodes = new Set(cards.map(s => s.code));
  const top = cards.length ? `<h4 class="ens-h">${UI.esc(t("ensOurs"))}</h4><div class="pro-row ens-pro">${cards.map(shopCard).join("")}</div>` : "";
  const rest = ens.shown.map((x, i) => [x, i]).filter(([x]) => !(x.code && shownCodes.has(x.code)));
  $("#ensList").innerHTML = top + (cards.length && rest.length ? `<h4 class="ens-h">${UI.esc(t("ensOthers"))}</h4>` : "") + (!ens.shown.length ? "" : rest.map(([x, i]) => {
    const addr = [`${x.street} ${x.number}`.trim(), x.city ? cityLabel(cityIdOf(x.city) || x.city) : ""].filter(Boolean).join(", ");
    // Enseigne inscrite sur HOP! : on entre dans sa boutique (catalogue), en touchant la ligne ou le bouton
    return `<div class="ens-item${x.partner && x.code ? " ens-partner" : ""}"${x.partner && x.code ? ` data-ens-shop="${UI.esc(x.code)}"` : ""}>
      <span class="ens-ico">${(lg => lg ? `<img src="${UI.esc(lg)}" alt="" loading="lazy" />` : x.icon)(partnerLogo(x) || UI.dirLogo(x))}</span>
      <div class="ens-main"><b>${UI.esc(UI.bi(x.name))}${x.partner ? ` <i class="ac-partner">${UI.esc(t("ensPartner"))}</i>` : ""}</b>${x.partner ? "" : `<i class="ac-soon">${UI.esc(t("addrSoon"))}</i>`}
        <small>${UI.esc(addr || t("ensAddrLater"))} · ${dist(x)}</small></div>
      <div class="ens-act">${x.partner && x.code ? `<button type="button" class="btn btn-sm btn-primary" data-ens-shop="${UI.esc(x.code)}">${UI.esc(t("ensShop"))}</button>`
        : `<button type="button" class="btn btn-sm btn-primary" data-ens-pick="from" data-i="${i}">${UI.esc(t("ensFrom"))}</button>
        <button type="button" class="btn btn-sm" data-ens-pick="to" data-i="${i}">${UI.esc(t("ensTo"))}</button>`}</div>
    </div>`;
  }).join("")) + (ens.shown.length ? "" : `<p class="ens-empty">${UI.esc(t("ensNone"))}</p>`);
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
// Lien « Ajouter un autre commerce » du suivi : la commande à laquelle on ajoute (livraison à 10 ₪)
const addonToken = new URLSearchParams(location.search).get("addon");
// Lien « commande prête » envoyé par le patron sur WhatsApp (?liste=…) : « J'achète pour vous » avec la liste déjà écrite,
// le client met son adresse et valide (la commande passe par l'appli : suivi, livreurs, paiement comme d'habitude)
const listParam = (new URLSearchParams(location.search).get("liste") || "").slice(0, 1500);
// Commande saisie par le patron pour un client WhatsApp (?pour=1, panneau → ✅ Réponses WhatsApp) : adresse, nom et
// téléphone du client (rien de l'appareil du patron : ni ses adresses, ni son nom), puis « Envoyer le suivi au client »
const forClient = (() => { let on = new URLSearchParams(location.search).get("pour") === "1";
  try { if (on) sessionStorage.setItem("hop.forClient", "1"); else on = sessionStorage.getItem("hop.forClient") === "1"; } catch (e) { /* ignore */ }
  return on; })();
if (forClient) {
  Object.assign(Store, { getAddresses: () => [], saveAddress: () => {}, getProfile: () => ({}), saveProfile: () => {} });
  document.documentElement.classList.add("for-client");
  form.insertAdjacentHTML("afterbegin", `<p class="for-client-note" data-i18n="forClientNote"></p>`);
}
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
if (shopCode) loadShop(shopCode).then(() => { if (addonToken) initAddon(addonToken); });
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
  if (e.target.name === "notes" || e.target.name === "urgency") renderNoteTime();
  syncVisibility();
  renderQuote();
});
// Choix d'un service ou d'un moment (hors « programmer ») : on passe à l'étape suivante
form.addEventListener("change", e => {
  if (e.target.name === "service" && e.isTrusted) state.svcChosen = true;   // choisi à la main : on n'y touche plus
  if (e.target.name === "urgency" && e.isTrusted) state.autoSched = false;
  // « Où acheter ? » : la maison ou le travail n'est jamais le magasin ; la liste des magasins suit la commande
  if (e.target.name === "service" || e.target.name === "shopping_list" || e.target.name === "notes") {
    const p = state.pick.from;
    if (val("service") === "achat" && p && !p.brand && !p.nearest && Store.getAddresses().some(a => !a.brand && isSavedPick(p, a))) clearHomeAddr("from", true);
    renderSavedAddrs();
  }
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
  if (activeOrders().length === 0 && welcomeOpen() && !state.promo) { form.promo.value = welcomeCode(); applyPromo(); }
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
  multiPark();
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
  if (e.target.closest("[data-sh-info]")) { state.shInfo = true; return renderShopBanner(); }
  if (e.target.closest("[data-sh-close]") || e.target.matches("[data-sh-sheet]")) { state.shInfo = false; return renderShopBanner(); }
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
  try { window.dispatchEvent(new Event("hop:lang")); } catch (e) { /* vieux navigateur */ }
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
  // (pas de départ automatique vers le suivi quand il reste un autre panier à valider)
  if (!el || !$("#donePrepay").classList.contains("hidden") || !$("#doneWa").classList.contains("hidden") || !$("#multiDone").classList.contains("hidden")) { if (el) el.classList.add("hidden"); return; }
  let n = 8;
  const tick = () => { el.textContent = t("doneAuto", { n }); el.classList.remove("hidden"); if (n-- <= 0) { clearInterval(doneTimer); location.href = UI.trackUrl(saved); } };
  tick(); doneTimer = setInterval(tick, 1000);
}
["click", "input", "touchstart"].forEach(ev => $("#doneModal").addEventListener(ev, () => { if (doneTimer) { clearInterval(doneTimer); doneTimer = null; $("#doneAuto").classList.add("hidden"); } }, { passive: true }));
$("#refreshMine").addEventListener("click", loadMine);
$("#myOrders").addEventListener("click", onListClick);
$("#waFab").addEventListener("click", openChatMenu);
form.addEventListener("change", e => {
  const m = /^(pickup|dropoff)_kind$/.exec(e.target.name || "");
  if (!m) return;
  setKind(m[1], e.target.value);
  // Adresse enregistrée : le type de lieu choisi y est gardé (on ne le redemande plus)
  const w = m[1] === "pickup" ? "from" : "to", list = Store.getAddresses(), i = list.findIndex(a => isSavedPick(state.pick[w], a));
  if (i >= 0 && !list[i].brand && list[i].kind !== e.target.value) { try { Store.updateAddress(i, { kind: e.target.value }); renderToSum(); } catch (ex) { /* ignore */ } }
});
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
  if (rd) { state.phoneReady = Number(rd.dataset.ready); renderNoPayReady(); return renderPhone(); }
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
$("#mobileGo").addEventListener("click", e => {
  e.preventDefault();
  if (wiz.on && wiz.step < wiz.n) return wizNext();
  $("#summary").scrollIntoView({ behavior: "smooth", block: "center" });
});

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
// Accueil : l'adresse du client (dernière livrée, sinon Maison) est déjà dans « Livrer à » ; il choisit ensuite quoi / où récupérer
try { ensureDefaultTo(); } catch (e) { /* ignore */ }
// Fenêtre de l'appli client : l'espace livreur ouvert d'ici proposera d'installer sa propre appli
UI.markClientApp();

// Ouvert depuis Facebook / Instagram : bandeau « ouvrez HOP! dans votre navigateur » (position et adresses enregistrées)
(function inAppBar() {
  if (!inAppBrowser()) return;
  try { if (sessionStorage.getItem("hop.inAppOff")) return; } catch (e) { /* ignore */ }
  const android = /Android/i.test(navigator.userAgent), bar = document.createElement("div");
  bar.className = "inapp-bar";
  const url = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  const draw = () => { bar.innerHTML = `<span>🌐 ${UI.esc(t("inAppMsg"))}</span>${android ? `<a class="btn btn-sm" href="${UI.esc(url)}">${UI.esc(t("inAppBtn"))}</a>` : `<b>${UI.esc(t("inAppIos"))}</b>`}<button type="button" class="ia-x" aria-label="✕">✕</button>`; };
  draw();
  bar.addEventListener("click", e => { if (e.target.closest(".ia-x")) { bar.remove(); try { sessionStorage.setItem("hop.inAppOff", "1"); } catch (x) { /* ignore */ } } });
  document.body.appendChild(bar);
})();
// Téléphone du patron : mode patron sur la page client (crayon ✏️ sur chaque produit)
Store.amBoss().then(b => { if (!b) return; state.boss = true; if (state.shop) { renderCatalog(); bossMapLoad(state.shop.code); } }).catch(() => {});
// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

// ===== Panier : gardé 7 jours sur le téléphone, enregistré pour le patron (paniers abandonnés, relances) =====
// Un seul panier à la fois : les produits d'un commerce (catalogue) ou les articles d'un rayon (pharmacie, makolet…).
// Il se met à jour seulement quand le client ajoute ou enlève un article : quitter la page ne le vide pas.
const LS_CART = "livraison.cart.v1", CART_DAYS = 7;
function cartSnap() {
  if (state.shop && cartLines().length) {
    const lines = cartLines();
    return { kind: "shop", shop_code: state.shop.code, shop_name: UI.bi(state.shop.name),
      items: lines.map(l => ({ n: UI.bi(l.p.name), q: l.qty, p: Number(l.p.price) || null })), count: cartCount(), total: cartTotal() };
  }
  const r = rayonOn();
  const picked = r ? rayonPicked(r) : [];
  if (picked.length) {
    // Prix indicatif seulement quand il est affiché au client (jamais pour le tabac)
    const items = picked.map(([k, q]) => { const e = rayonEntry(r, k); return e ? { n: phName(e.x) + (e.v ? " · " + phName(e.v) : ""), e: e.x.e, q, p: e.p ? priceMid(e.p) : null } : null; }).filter(Boolean);
    return { kind: "rayon:" + r.id, shop_name: phName(r.card).replace(/^\P{L}+/u, ""), items, count: items.reduce((a, i) => a + i.q, 0),
      total: items.reduce((a, i) => a + (i.p || 0) * i.q, 0) || null };
  }
  return { kind: null, items: [], count: 0, total: null };
}
const cartStored = () => { try { const c = JSON.parse(localStorage.getItem(LS_CART)); return c && Date.now() - c.at < CART_DAYS * 86400000 ? c : null; } catch (e) { return null; } };
cartAtStart = cartStored();
let cartSyncT = null, cartSent = "";
// L'étape où en est le client (panier, écrans de la commande, envoi) : le patron voit où il s'arrête
let cartStep = "panier";
function cartStepSet(s) {
  if (s === cartStep) return;
  cartStep = s;
  const snap = cartSnap();
  if (snap.count) cartSync(snap);
}
// Le téléphone du patron : ses paniers d'essai sont mis à part dans l'onglet Paniers
let bossDev = false;
try { bossDev = !!localStorage.getItem("livraison.session.admin.v1") || localStorage.getItem("livraison.demoBoss") === "1"; } catch (e) { /* ignore */ }
if (!bossDev) Store.amBoss().then(v => { if (v) bossDev = true; }).catch(() => {});
function cartSync(snap) {
  clearTimeout(cartSyncT);
  cartSyncT = setTimeout(() => {
    const prof = Store.getProfile() || {};
    const body = Object.assign({}, snap, { lang: I18N.lang, name: prof.contact_name || "", phone: prof.contact_phone || "",
      step: cartStep, boss: bossDev, open_notice: !!state.openNotice });
    const key = JSON.stringify(body);
    if (key === cartSent) return;
    cartSent = key;
    Store.cartSave(body).catch(() => { cartSent = ""; });
  }, 2000);
}
// Panier : dès le premier article, le nom et le téléphone (pour garder le panier et pouvoir rappeler le client).
// Redemandés à chaque nouvel article tant qu'ils manquent ; la commande les exige de toute façon.
var cartLastCount = ((cartStored() || {}).snap || {}).count || 0;   // panier retrouvé au lancement : on ne redemande pas tout de suite
// (Avant : une fenêtre « nom + téléphone » s'ouvrait dès le 1er article : la plupart des clients partaient là.
// Maintenant on ne coupe plus le client : il garde son panier s'il le veut, depuis le panier lui-même.)
function cartWho(snap) {
  const grew = snap.count > cartLastCount;
  cartLastCount = snap.count;
  if (grew && snap.count === 1) { UI.track("cart_add", { shop_code: state.shop ? state.shop.code : null, page: String(snap.kind || "").slice(0, 40) }); setTimeout(cartNotifAsk, 1500); }
}
// 1er article : « On vous prévient ? » (une fine barre, une fois tous les 3 jours au plus). Accepté : ce téléphone recevra
// « 🛒 Votre panier vous attend » 30 min après, même sans nom ni numéro (et ses notifications de commande ensuite)
const LS_CN = "livraison.cartNotifAsked.v1";
function cartNotifAsk() {
  if (!window.Notification || !(CONFIG.push && CONFIG.push.publicKey)) return;
  if (Notification.permission === "granted") { UI.cartPushSubscribe(false); return; }
  if (Notification.permission !== "default" || !cartSnap().count) return;
  let last = 0;
  try { last = Number(localStorage.getItem(LS_CN)) || 0; } catch (e) { /* ignore */ }
  if (Date.now() - last < 3 * 86400000) return;
  try { localStorage.setItem(LS_CN, String(Date.now())); } catch (e) { /* ignore */ }
  let bar = $("#cartNotif");
  if (!bar) { bar = document.createElement("div"); bar.id = "cartNotif"; bar.className = "cart-notif"; document.body.appendChild(bar); }
  bar.innerHTML = `<span>${UI.esc(t("cnAsk"))}</span><button type="button" class="btn btn-sm btn-primary" data-cn-yes>${UI.esc(t("cnYes"))}</button><button type="button" class="cn-x" data-cn-no aria-label="✕">✕</button>`;
  bar.classList.remove("hidden");
}
document.addEventListener("click", async e => {
  const yes = e.target.closest("[data-cn-yes]"), no = e.target.closest("[data-cn-no]");
  if (!yes && !no) return;
  const bar = $("#cartNotif");
  if (bar) bar.classList.add("hidden");
  if (yes && await UI.cartPushSubscribe(true)) toastCart(t("cnOk"));
});
function cartPersist() {
  const snap = cartSnap();
  cartWho(snap);
  try {
    if (snap.count) localStorage.setItem(LS_CART, JSON.stringify({ at: Date.now(), snap, cart: state.cart, mods: state.cartMods || {}, pharma: state.pharma, pharmaOpt: state.pharmaOpt,
      homeKind: state.homeKind, shop: snap.kind === "shop" ? { code: state.shop.code, dir: state.shopDir || "" } : null }));
    else localStorage.removeItem(LS_CART);
  } catch (e) { /* stockage plein */ }
  renderCartIcon();
  cartSync(snap);
}
// « Vider le panier » (panier d'un commerce, rayon, ou panier gardé 7 jours) : tout repart à zéro, le patron le voit « vide »
function cartClearAll() {
  state.cart = {}; state.cartMods = {}; state.pharma = {}; state.pharmaMsg = "";
  const sh = $("#cartSheet"); if (sh) sh.classList.add("hidden");
  try { renderCatalog(); } catch (e) { /* pas de commerce ouvert */ }
  try { renderPharma(); } catch (e) { /* ignore */ }
  renderQuote(); saveDraft(); cartPersist(); cartDone();
  toastCart(t("cartCleared"));
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-cart-clear]")) return;
  e.preventDefault(); e.stopPropagation();
  if (window.confirm(t("cartClearQ"))) cartClearAll();
}, true);
function cartDone() {
  try { localStorage.removeItem(LS_CART); } catch (e) { /* ignore */ }
  renderCartIcon();
}
function renderCartIcon() {
  const b = $("#tbCart");
  if (!b) return;
  let parked = 0;
  try { parked = multiList().reduce((a, m) => a + (Number(m.count) || 0), 0); } catch (e) { /* pas encore prêt */ }
  const c = cartStored(), n = (c ? c.snap.count : 0) + parked;
  // Accueil : une fine pastille pour reprendre le panier gardé sur ce téléphone
  let pill = $("#homeCartPill");
  if (!pill && $("#homeNotices")) { pill = document.createElement("button"); pill.type = "button"; pill.id = "homeCartPill"; pill.className = "cart-resume hidden"; $("#homeNotices").before(pill); }
  if (pill) {
    pill.classList.toggle("hidden", !n);
    const gift = n && cartGiftDue(true);
    if (n) pill.innerHTML = `🛒 <b>${UI.esc(t("cartResume", { n }))}</b>${gift ? ` <em class="cr-gift"><bdi dir="ltr">🎁 −${UI.esc(money(CART_GIFT.off))}</bdi></em>` : c && c.snap && c.snap.shop_name ? ` <small>${UI.esc(c.snap.shop_name)}</small>` : ""} <i>›</i><span class="cr-x" role="button" tabindex="0" data-cart-clear aria-label="${UI.esc(t("cartClear"))}">✕</span>`;
  }
  // Petit saut de la pastille quand un article arrive dans le panier
  const nb = $("#tbCartN"), was = Number(nb.dataset.n || 0);
  nb.textContent = n > 99 ? "99+" : String(n); nb.dataset.n = n;
  if (n > was) { nb.classList.remove("pop"); void nb.offsetWidth; nb.classList.add("pop"); }
  $("#tbCartN").classList.toggle("hidden", !n);
  b.setAttribute("aria-label", n ? t("cartIconN", { n }) : t("cartIcon"));
}
// Toucher le panier : on retrouve ses articles là où il les avait mis
async function openStoredCart() {
  const c = cartStored();
  // Seulement un panier gardé dans un autre magasin : on y retourne, avec ses articles
  if (!c) { const m = multiList()[0]; if (m) { await loadShop(m.code, true); setTimeout(() => { if (cartCount()) openCart(); }, 400); return; } emptyCartSheet(); return; }
  if (c.shop) {
    if (!state.shop || state.shop.code !== c.shop.code) { state.shopDir = c.shop.dir || ""; await loadShop(c.shop.code, true); }
    const ids = cgProducts().map(p => p.id);
    state.cart = Object.fromEntries(Object.entries(c.cart || {}).filter(([id, q]) => ids.includes(id) && q > 0));
    state.cartMods = Object.fromEntries(Object.entries(c.mods || {}).filter(([id]) => state.cart[id]));
    renderCatalog(); renderQuote(); saveDraft();
    if (cartCount()) openCart(); else { cartDone(); toastCart(t("cartGone")); }
    return;
  }
  if (state.shop) leaveShop(true);
  state.pharma = Object.assign({}, c.pharma || {}); state.pharmaOpt = Object.assign({}, c.pharmaOpt || {});
  if (c.homeKind) { state.homeKind = null; applyKind(c.homeKind); }
  goPharma();
  // Le bouton panier ouvre un vrai panier : la liste des produits choisis (− / +, total), puis « Continuer »
  setTimeout(openRayCart, 350);
}
// --- Panier des rayons HOP! (pharmacie, courses, bébé…) : comme le panier d'un magasin -------------------------
function rayLines() {
  const out = [];
  for (const r of (window.Rayons ? Rayons.ALL : [])) for (const [k, q] of rayonPicked(r)) {
    const [rid, rest] = [r.id, k.slice(r.id.length + 1)], [iid, oi] = rest.split("|");
    const it = r.items.find(i => i.id === iid);
    if (!it) continue;
    const o = it.opt && it.opt[Number(oi) || 0], pr = (o && o.p) || it.p || (o && o.pb) || it.pb;
    const unit = !pr ? 0 : Array.isArray(pr) ? priceMid(pr) : Number(pr) || 0;
    out.push({ k, q, r, it, o, unit, rid });
  }
  return out;
}
function openRayCart() {
  if (!rayLines().length) return;
  renderRayCart();
  $("#rayCart").classList.remove("hidden");
}
function renderRayCart() {
  let m = $("#rayCart");
  if (!m) {
    m = document.createElement("div"); m.id = "rayCart"; m.className = "modal hidden item-sheet cart-sheet"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="modal-box"><button type="button" class="it-x" data-ry-close aria-label="✕">✕</button><h3 class="cs-title" id="rayCartTitle"></h3>
      <div class="cs-list" id="rayCartBody"></div><div class="cs-total"><span id="rayCartTot"></span><b id="rayCartSum"></b></div><p class="cs-note" id="rayCartNote"></p>
      <div class="cs-btns"><button type="button" class="btn btn-primary btn-lg" data-ry-go></button><button type="button" class="btn btn-ghost btn-block" data-ry-more></button>
      <button type="button" class="cs-clear" data-cart-clear>🗑 <span></span></button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => {
      if (e.target === m || e.target.closest("[data-ry-close]")) return m.classList.add("hidden");
      const b = e.target.closest("[data-ry-plus], [data-ry-minus]");
      if (b) {
        const k = b.dataset.ryPlus || b.dataset.ryMinus, plus = !!b.dataset.ryPlus;
        state.pharma[k] = Math.max(0, (state.pharma[k] || 0) + (plus ? 1 : -1));
        if (!state.pharma[k]) delete state.pharma[k];
        try { renderPharma(); } catch (er) { /* ignore */ }
        renderQuote(); saveDraft(); cartPersist();
        if (!rayLines().length) { m.classList.add("hidden"); return; }
        return renderRayCart();
      }
      if (e.target.closest("[data-ry-more]")) { m.classList.add("hidden"); return goPharma(); }
      if (e.target.closest("[data-ry-go]")) { m.classList.add("hidden"); const g = $("#mobileGo"); if (g) g.click(); }
    });
  }
  const lines = rayLines(), sum = lines.reduce((a, l) => a + l.unit * l.q, 0), n = lines.reduce((a, l) => a + l.q, 0);
  const pic = it => { const ph = UI.safeImg(it.photo) || (it.img ? `img/qc/${it.img}.webp` : ""); return ph ? `<img src="${ph}" alt="" />` : `<i>${UI.esc(it.e || "🛒")}</i>`; };
  $("#rayCartTitle").textContent = t("ryCartTitle", { n });
  $("#rayCartBody").innerHTML = lines.map(l => `<div class="cs-row"><span class="cs-pic white">${pic(l.it)}</span>
    <span class="cs-txt"><b><bdi>${UI.esc(phName(l.it))}</bdi></b>${l.o ? `<em class="cs-mods">${UI.esc(phName(l.o))}</em>` : ""}<small>${l.unit ? `≈ ${UI.esc(money(l.unit * l.q))}` : UI.esc(t("ryNoPrice"))}</small></span>
    <span class="it-qty cs-qty"><button type="button" data-ry-minus="${UI.esc(l.k)}" aria-label="−">${l.q > 1 ? "−" : "🗑"}</button><b>${l.q}</b><button type="button" data-ry-plus="${UI.esc(l.k)}" aria-label="+">+</button></span></div>`).join("");
  $("#rayCartTot").textContent = t("ryCartTot");
  $("#rayCartSum").textContent = sum ? "≈ " + money(Math.round(sum)) : "";
  $("#rayCartNote").textContent = t("ryCartNote");
  m.querySelector("[data-ry-go]").textContent = t("ryCartGo");
  m.querySelector("[data-ry-more]").textContent = "+ " + t("ryCartMore");
  m.querySelector("[data-cart-clear] span").textContent = t("cartClear");
}
// Panier vide : la marche à suivre quand le commerce n'est pas encore sur HOP! (commander chez lui, puis la livraison ici)
// « HOP! » toujours lisible dans une phrase en hébreu
// « Ma commande est déjà prête » : on passe en simple retrait au commerce (prix de la livraison seule)
document.addEventListener("click", e => {
  const b = e.target.closest("[data-direct-ready]");
  if (!b) return;
  e.preventDefault();
  form.elements.service.value = "colis";
  syncVisibility();
  renderQuote();
  const f = form.pickup_address;
  if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => f.focus(), 350); }
  const n = form.notes;
  if (n && !n.value.trim()) n.value = t("qDirectReadyNote");
});
const escHop = v => UI.esc(v).replace(/HOP!\u200E?/g, '<bdi dir="ltr">HOP!</bdi>').replace(/\u2066([^\u2069]*)\u2069/g, '<bdi dir="ltr">$1</bdi>');
function emptyCartSheet() {
  const old = $("#emptyCart"); if (old) old.remove();
  const box = document.createElement("div");
  box.className = "modal item-sheet cart-sheet"; box.id = "emptyCart"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  box.innerHTML = `<div class="modal-box">
      <button type="button" class="it-x" data-ec-close aria-label="✕">✕</button>
      <img class="hoppy-pop" src="img/hoppy-mini.webp" alt="" width="74" height="120" decoding="async" />
      <h3 class="cs-title">${UI.esc(t("csEmptyT"))}</h3>
      <div class="cs-smart"><b class="cs-steps-t">${escHop(t("csSmartT"))}</b>
        <ol class="cs-steps"><li><i>1</i><span>${escHop(t("csStep1"))}</span></li><li><i>2</i><span>${escHop(t("csStep2"))}</span></li></ol></div>
      <div class="cs-btns"><button type="button" class="btn btn-primary btn-lg" data-ec-start>${D2 ? SCOOT_SVG : "🛵"} <span>${UI.esc(t("csStart"))}</span></button>
        <button type="button" class="btn btn-link" data-ec-shops>${UI.esc(t("csShops"))} ›</button></div></div>`;
  box.addEventListener("click", e => {
    if (e.target === box || e.target.closest("[data-ec-close]")) return box.remove();
    if (e.target.closest("[data-ec-start]")) { box.remove(); if (document.body.dataset.view !== "home") location.hash = "#accueil"; setTimeout(() => { const i = $("#homeTo"); if (i) { i.scrollIntoView({ block: "center", behavior: "smooth" }); i.focus({ preventScroll: true }); } }, 250); }
    if (e.target.closest("[data-ec-shops]")) { box.remove(); if (document.body.dataset.view !== "home") location.hash = "#accueil"; setTimeout(() => { const b = $("#homeProBox"); if (b) b.scrollIntoView({ block: "start", behavior: "smooth" }); }, 250); }
  });
  document.body.appendChild(box);
}
// --- Partager : l'appli, un commerce, un rayon (le lien s'ouvre directement au bon endroit) -------------
// Téléphone : la feuille de partage du téléphone (WhatsApp, Instagram, SMS…) ; ordinateur : lien copié + WhatsApp.
// ?src=partage : les visites venues d'un partage ont leur ligne dans 📊 Visites (onglet Compta du panel).
// La bulle « 💬 Nous écrire » se cache tant que la liste de recherche / de Hoppy est ouverte (elle recouvrait
// « Commander cette liste » : on touchait la bulle au lieu du bouton)
new MutationObserver(() => $("#waFab").classList.toggle("fab-off", !$("#homeFindList").classList.contains("hidden")))
  .observe($("#homeFindList"), { attributes: true, attributeFilter: ["class"] });
// Le message WhatsApp avec ce que le client a déjà choisi : liste de Hoppy, panier d'un magasin, liste « J'achète pour vous »
function waListMsg(from) {
  let list = "";
  try {
    if (from === "magic" && state.magic) list = mgText();
    else if (state.shop && proShopOn() && cartCount()) list = t("waListAt", { name: UI.bi(state.shop.name) }) + "\n" + cgProducts().filter(p => state.cart[p.id]).map(p => `${state.cart[p.id]} × ${UI.bi(p.name)}`).join("\n") + (form.shop_order.value.trim() ? "\n" + form.shop_order.value.trim() : "");
    else if (form.shopping_list.value.trim()) list = form.shopping_list.value.trim();
  } catch (e) { list = ""; }
  return list ? t("waListText").replace(/\n\n\n/, "\n" + list + "\n\n") : t("waListText");
}
// « Envoyez votre liste sur WhatsApp » (patron, 08/11) : photo, vocal ou texte, au WhatsApp de HOP!, qui crée la commande
document.addEventListener("click", e => {
  const a = e.target.closest("[data-wa-list]");
  if (!a) return;
  a.href = UI.waLink(CONFIG.whatsapp, waListMsg(a.dataset.waFrom));
  if (UI.track) UI.track("wa_list", { page: a.dataset.waFrom || (a.classList.contains("vit-wa") ? "accueil" : "commande") });
}, true);
const SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const shareBase = () => UI.appUrl("");
async function shareLink(url, text) {
  if (navigator.share) {
    try { await navigator.share({ title: "HOP!", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text + " " + url); toastCart(t("shareCopied")); } catch (e) { /* ignore */ }
  window.open(UI.waShare(text + " " + url), "_blank", "noopener");
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-share-app], [data-share-shop], [data-share-ray]");
  if (!a) return;
  e.preventDefault(); e.stopPropagation();
  if (a.hasAttribute("data-share-app")) return shareLink(shareBase() + "?src=partage", t("shareAppText"));
  if (a.hasAttribute("data-share-shop") && state.shop) {
    const s = state.shop;
    return shareLink(shareBase() + "?c=" + encodeURIComponent(s.code) + "&src=partage", (/HOP!/.test(UI.bi(s.name)) ? t("shareShopText2", { name: UI.bi(s.name) }) : t("shareShopText", { name: UI.bi(s.name) })));
  }
  const r = a.dataset.shareRay && Rayons.byId(a.dataset.shareRay);
  if (r) shareLink(shareBase() + "?k=" + encodeURIComponent(r.kind) + "&src=partage", t("shareRayText", { name: phName(r.title) }));
}, true);
function toastCart(msg) {
  const d = document.createElement("div");
  d.className = "cart-toast"; d.setAttribute("role", "status"); d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.classList.add("out"), 2200); setTimeout(() => d.remove(), 2600);
}
if ($("#tbCart")) {
  $("#tbCart").addEventListener("click", openStoredCart);
  document.addEventListener("click", e => { if (e.target.closest("#homeCartPill") && !e.target.closest("[data-cart-clear]")) openStoredCart(); });
  // « On livre quand même » : n'importe quel commerce → la case « On récupère où ? » de l'accueil
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-any-shop]")) return;
    const i = $("#homeFrom");
    if (!i) return;
    i.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => i.focus({ preventScroll: true }), 400);
  });
  renderCartIcon();
  // Un panier gardé d'une autre visite : le patron le voit aussi (avec le nom et le n° si le client est connu)
  const c0 = cartStored();
  if (c0) cartSync(c0.snap);
  if (c0 && window.Notification && Notification.permission === "granted") UI.cartPushSubscribe(false);
  // Rechargé pour une nouvelle version pendant que le client remplissait son panier : on le lui rouvre
  let reopen = false;
  try { reopen = sessionStorage.getItem("hop.reopenCart") === "1"; sessionStorage.removeItem("hop.reopenCart"); } catch (e) { /* ignore */ }
  // (la notification « 🛒 Votre panier vous attend » ouvre l'appli avec ?cart=1 : le panier s'ouvre tout de suite)
  if ((reopen || new URLSearchParams(location.search).has("cart")) && c0) setTimeout(() => openStoredCart().catch(() => {}), 600);
}

})();

