// ============================================================================
// Commerces partenaires (FR / HE) :
// - sans clé : présentation + inscription gratuite (avec le code du livreur
//   qui a amené le commerce : commerce.html?p=CODE) ;
// - avec sa clé secrète (commerce.html?k=…) : son espace — commander une
//   course depuis le commerce, lien et QR code pour ses clients, ses courses.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const t = I18N.t;
const form = $("#shopForm");
const params = new URLSearchParams(location.search);
const state = { pick: null, nameAc: null, addrAc: null, dash: null };

function phoneDigits(v) { let d = String(v || "").replace(/\D/g, ""); if (d.startsWith("972")) d = "0" + d.slice(3); return d; }
function phoneOk(v) { return /^0(5\d{8}|7\d{8}|[2-489]\d{7})$/.test(phoneDigits(v)); }

function renderStatic() {
  I18N.apply();
  $("#brandName").innerHTML = UI.wordmark(I18N.lang === "he" ? "לעסקים" : "Pro");
  const price = UI.money(CONFIG.pricing.fixedFromHome[CONFIG.homeCity] || CONFIG.pricing.base);
  $("#shopPerks").innerHTML = ["shPerk1", "shPerk2", "shPerk3", "shPerk4", "shPerk5"]
    .map(k => `<li>${UI.esc(t(k, { price }))}</li>`).join("");
  const city = $("#shopCity").value || CONFIG.homeCity;
  $("#shopCity").innerHTML = CONFIG.cities.map(c => `<option value="${c.id}">${UI.esc(I18N.cityName(c.id))}</option>`).join("");
  $("#shopCity").value = city;
  const kind = $("#shopKind").value || "restaurant";
  const kinds = t("shKinds");
  $("#shopKind").innerHTML = CONFIG.partners.kinds.map(k => `<option value="${k}">${UI.esc(kinds[k] || k)}</option>`).join("");
  $("#shopKind").value = kind;
  if (state.dash) renderSpace();
}

// --- Inscription ------------------------------------------------------------------
function onPick(p, fromName) {
  state.pick = p;
  if (fromName && p.brand) form.name.value = p.brand;
  form.address.value = p.streetName || p.street || "";
  if (state.addrAc) state.addrAc.setPicked(form.address.value);
  form.number.value = p.housenumber || "";
  if (p.cityId) form.city.value = p.cityId;
  if (!p.housenumber && !p.brand) setTimeout(() => form.number.focus(), 50);
}

function attachPlaces() {
  const texts = () => ({ none: t("addrNone"), down: t("addrDown") });
  state.nameAc = Places.attach(form.name, { lang: () => I18N.lang, texts, onPick: p => onPick(p, true), onClear: () => {} });
  state.addrAc = Places.attach(form.address, { lang: () => I18N.lang, texts, onPick: p => onPick(p, false), onClear: () => { state.pick = null; } });
}

async function submit(e) {
  e.preventDefault();
  const err = msg => { $("#shopError").textContent = msg; $("#shopError").classList.toggle("hidden", !msg); };
  err("");
  const v = k => form.elements[k].value.trim();
  if (!v("name") || !v("address") || !phoneOk(v("phone"))) {
    (!v("name") ? form.name : !v("address") ? form.address : form.phone).focus();
    return err(t("shErr"));
  }
  const btn = $("#shopSubmit");
  btn.disabled = true;
  btn.textContent = t("shSending");
  try {
    const address = `${v("address")} ${v("number")}`.trim();
    const city = Pricing.cityById(CONFIG, v("city"));
    let point = state.pick && state.pick.housenumber === v("number") ? { lat: state.pick.lat, lon: state.pick.lon } : null;
    if (!point) point = await Pricing.geocode(`${address}, ${city ? city.fr : ""}`, CONFIG.countryCode, 3000).catch(() => null);
    if (!point && state.pick) point = { lat: state.pick.lat, lon: state.pick.lon };
    const r = await Store.shopSignup({
      name: v("name"), kind: v("kind"), city: v("city"), address,
      lat: point ? point.lat : null, lon: point ? point.lon : null,
      contact_name: v("contact_name") || null, phone: v("phone"), email: v("email") || null,
      ref_code: v("ref_code").toUpperCase() || null, lang: I18N.lang
    });
    history.replaceState(null, "", location.pathname + "?k=" + r.token);
    await openSpace(r.token);
    if (r.ref_other_city) alert(t("shRefCity", { city: I18N.cityName(r.ref_other_city) }));
    window.scrollTo(0, 0);
  } catch (ex) {
    // Déjà inscrit : pas de doublon (le commerce garde son parrain et son espace)
    err(/shop_exists/.test(ex.message) ? t("shExists", { phone: CONFIG.phoneDisplay }) : t("shErrSend", { phone: CONFIG.phoneDisplay }));
  } finally {
    btn.disabled = false;
    btn.textContent = t("shSubmit");
  }
}

// --- Espace du commerce ---------------------------------------------------------------
const clientLink = s => UI.appUrl() + "?c=" + encodeURIComponent(s.code);

async function openSpace(token) {
  let d = null;
  try { d = await Store.shopDashboard(token); } catch (e) { /* message ci-dessous */ }
  if (!d || !d.shop) {
    $("#shopGone").classList.remove("hidden");
    $("#shopSignup").classList.remove("hidden");
    return;
  }
  Store.rememberShopToken(token, d.shop.code);
  state.dash = d;
  $("#shopSignup").classList.add("hidden");
  $("#shopGone").classList.add("hidden");
  $("#shopSpace").classList.remove("hidden");
  renderSpace();
}

// --- HOP! Pro : commandes des clients à préparer (avec sonnerie), abonnement et facture du mois ---
const PREP = ["attente", "acceptee", "prete"];
const today = () => new Date().toISOString().slice(0, 10);
const planOn = shop => !!(shop.plan_until && shop.plan_until >= today());
let audioCtx = null;
function audio() {
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); }
  catch (e) { audioCtx = null; }
  return audioCtx;
}
["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, audio, { once: true, passive: true }));
function note(ctx, freq, at, vol, len) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at); o.stop(at + len + 0.05);
}
// Sonnerie douce tant qu'une commande attend d'être acceptée
const ring = { timer: null };
function ringOnce() {
  const ctx = audio();
  if (ctx) try { const t0 = ctx.currentTime + 0.03; [[880, 0], [1109, 0.15], [1319, 0.3], [1760, 0.48]].forEach(([f, d]) => note(ctx, f, t0 + d, 0.25, 0.8)); } catch (e) { /* audio indisponible */ }
  if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
}
function setRing(on) {
  if (on && !ring.timer) { ringOnce(); ring.timer = setInterval(ringOnce, 3000); }
  if (!on && ring.timer) { clearInterval(ring.timer); ring.timer = null; }
}
// N° de commande tapé mais pas encore validé : gardé quand l'écran se rafraîchit
const refDraft = {};
function renderPrep() {
  const { shop, orders } = state.dash;
  // On ne redessine pas pendant que le commerce tape son n° de commande
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#spPrep [data-ref-for]")) return;
  const list = orders.filter(o => PREP.includes(o.shop_status) && ["nouvelle", "confirmee"].includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const box = $("#spPrep");
  box.classList.toggle("hidden", !planOn(shop) && !list.length);
  setRing(list.some(o => o.shop_status === "attente"));
  if (box.classList.contains("hidden")) return;
  const time = d => new Date(d).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  box.innerHTML = `<h3>${UI.esc(t("spPrepTitle"))}</h3>` + (list.length ? list.map(o => {
    const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
    const courier = o.status === "confirmee" && o.courier_name ? t("spCourier", { name: o.courier_name.split(" ")[0] }) : t("spNoCourier");
    const head = o.shop_status === "attente" ? `<b class="prep-new">${UI.esc(t("spNew"))}</b> · ${time(o.created_at)}`
      : o.shop_status === "prete" ? `<b>${UI.esc(t("spIsReady"))}</b> · ${UI.esc(courier)}`
      : `<b class="${left < 0 ? "prep-late" : ""}">${UI.esc(left < 0 ? t("spLate", { min: -left }) : t("spReadyIn", { min: Math.max(0, left) }))}</b> · ${UI.esc(courier)}`;
    const act = o.shop_status === "attente"
      ? `<label class="f prep-ref"><span>${UI.esc(t("spRefLabel"))}</span><input inputmode="numeric" maxlength="3" autocomplete="off" data-ref-for="${UI.esc(o.id)}" value="${UI.esc(refDraft[o.id] || "")}" placeholder="${UI.esc(t("spRefPh"))}" /></label>
        <small class="muted">${UI.esc(t("spAcceptIn"))}</small><div class="prep-btns">${CONFIG.pro.prepChoices.map(m =>
          `<button type="button" class="btn btn-primary" data-prep="${m}" data-id="${UI.esc(o.id)}">${UI.esc(t("spMin", { n: m }))}</button>`).join("")}
          <button type="button" class="btn btn-link" data-refuse="${UI.esc(o.id)}">${UI.esc(t("spRefuse"))}</button></div>`
      : o.shop_status === "acceptee" ? `<button type="button" class="btn btn-primary btn-block" data-ready="${UI.esc(o.id)}">${UI.esc(t("spReadyBtn"))}</button>` : "";
    return `<div class="prep-item${o.shop_status === "attente" ? " is-new" : ""}">
      <div class="prep-head">${head}${o.shop_ref ? `<b class="bag-no">${UI.esc(t("spRefShow", { n: o.shop_ref }))}</b>` : ""}<small class="muted">${UI.esc(t("orderNo", { ref: o.ref }))}</small></div>
      <p class="prep-order">🧾 ${UI.esc(o.shop_order || "")}</p>
      <small class="muted">${UI.esc(t("spClient", { name: (o.dropoff_contact || o.contact_name || "").split(" ")[0], city: I18N.cityName(o.to_city) }))}</small>
      ${act}
    </div>`;
  }).join("") : `<p class="muted small">${UI.esc(t("spPrepNone"))}</p>`);
}
function renderPlan() {
  const { shop, orders } = state.dash;
  const st = Object.assign({ pro_monthly: CONFIG.pro.monthly, pro_shop_share: CONFIG.pro.shopShare, pro_hop_share: CONFIG.pro.hopShare }, state.settings || {});
  const box = $("#spPlan");
  if (planOn(shop)) {
    const month = today().slice(0, 7);
    const done = orders.filter(o => o.status === "livree" && Number(o.shop_share) > 0 && String(o.pickup_at).slice(0, 7) === month);
    const shares = done.reduce((x, o) => x + Number(o.shop_share), 0);
    box.innerHTML = `<h3>${UI.esc(t("spPlanOn", { date: UI.fmtKey(shop.plan_until) }))}</h3>
      <p class="small" style="margin:6px 0 0">${UI.esc(t("spBill", { monthly: UI.money(st.pro_monthly), shares: UI.money(shares), n: done.length,
        total: UI.money(Number(st.pro_monthly) + shares), phone: CONFIG.bitPhone }))}</p>`;
    return;
  }
  // Le client paie la course moins la part du commerce (hors les 2 ₪ de service HOP)
  const client = UI.money(Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - (Number(st.pro_shop_share) - Number(st.pro_hop_share || 0))));
  box.innerHTML = `<h3>${UI.esc(t("spPlanTitle"))}</h3>
    <ul class="plan-list">${["spPlan1", "spPlan2", "spPlan3", "spPlan4"].map(k => `<li>${UI.esc(t(k, { monthly: UI.money(st.pro_monthly), client, share: UI.money(st.pro_shop_share) }))}</li>`).join("")}</ul>
    <button type="button" class="btn btn-primary" data-plan="1">${UI.esc(t("spPlanBtn"))}</button>`;
}
async function refreshSpace() {
  if (!state.dash) return;
  try {
    const d = await Store.shopDashboard(state.dash.shop.token);
    if (d && d.shop) { state.dash = d; renderSpace(); }
  } catch (e) { /* nouvel essai au prochain tour */ }
}
async function prepAction(id, action, minutes, reason, ref) {
  try {
    const ok = await Store.shopOrderAction(state.dash.shop.token, id, action, minutes, reason, ref);
    if (!ok) alert(t("spErr"));
    else if (action === "accepter") delete refDraft[id];
  } catch (e) { alert(/shop_ref/.test(e.message || "") ? t("spRefNeed") : t("spErr")); }
  refreshSpace();
}
$("#spPrep").addEventListener("input", e => {
  const i = e.target.closest("[data-ref-for]");
  if (!i) return;
  i.value = i.value.replace(/\D/g, "").slice(0, 3);
  refDraft[i.dataset.refFor] = i.value;
});
$("#spPrep").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.prep) {
    const input = $(`#spPrep [data-ref-for="${b.dataset.id}"]`), ref = input ? input.value.trim() : "";
    if (!/^[0-9]{3}$/.test(ref)) { alert(t("spRefNeed")); if (input) input.focus(); return; }
    return prepAction(b.dataset.id, "accepter", Number(b.dataset.prep), null, ref);
  }
  if (b.dataset.ready) return prepAction(b.dataset.ready, "prete");
  if (b.dataset.refuse) { const why = prompt(t("spRefuseWhy")); if (why !== null) prepAction(b.dataset.refuse, "refuser", null, why); }
});
$("#spPlan").addEventListener("click", e => {
  if (!e.target.closest("[data-plan]")) return;
  const { shop } = state.dash;
  openShopChat(t("spPlanMsg", { name: shop.name, code: shop.code }));
});
setInterval(() => { if (state.dash && !document.hidden) refreshSpace(); }, 15000);
Store.getSettings().then(s => { state.settings = s; if (state.dash) renderPlan(); }).catch(() => {});

// Marche à suivre : ouverte aux premières visites (et quand le commerce passe à HOP! Pro), repliable ensuite
function renderGuide(shop) {
  const pro = planOn(shop);
  const st = Object.assign({ pro_monthly: CONFIG.pro.monthly, pro_shop_share: CONFIG.pro.shopShare, pro_hop_share: CONFIG.pro.hopShare }, state.settings || {});
  const client = UI.money(Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - (Number(st.pro_shop_share) - Number(st.pro_hop_share || 0))));
  const vars = { monthly: UI.money(st.pro_monthly), share: UI.money(st.pro_shop_share), phone: CONFIG.bitPhone, client,
    n: CONFIG.partners.carnet.courses, price: UI.money(CONFIG.partners.carnet.price) };
  const keys = pro ? ["gdPro1", "gdPro2", "gdPro3", "gdPro4", "gdPro5", "gdPro6", "gdPro7"] : ["gdBase1", "gdBase2", "gdBase3", "gdBase4"];
  $("#spGuideTitle").textContent = t(pro ? "gdTitlePro" : "gdTitle");
  $("#spGuideSteps").innerHTML = keys.map(k => `<li>${UI.esc(t(k, vars))}</li>`).join("");
  const box = $("#spGuide"), key = "livraison.guideSeen." + shop.code + (pro ? ".pro" : "");
  if (!box.dataset.init) {
    box.dataset.init = "1";
    let seen = 0;
    try { seen = Number(localStorage.getItem(key)) || 0; localStorage.setItem(key, String(seen + 1)); } catch (e) { /* ignore */ }
    box.open = seen < 3;
  }
}
function renderSpace() {
  const { shop, orders } = state.dash;
  renderGuide(shop);
  renderPrep();
  renderPlan();
  const sales = state.dash.sales || [];
  $("#spTitle").textContent = t("shWelcome", { name: shop.name });
  $("#spStatus").textContent = shop.status === "actif" ? t("shActive") : t("shPending");
  $("#spOrder").href = clientLink(shop) + "#commander";
  $("#spLink").value = clientLink(shop);
  $("#spShare").href = UI.waShare(t("shShareMsg", { name: shop.name, url: clientLink(shop) }));
  $("#posterName").textContent = shop.name;
  // Espace pro : tarif, carnet de courses payé d'avance
  const C = CONFIG.partners.carnet, home = CONFIG.homeCity;
  const unit = UI.money(CONFIG.pricing.fixedFromHome[home]);
  const left = Number(shop.credits || 0);
  $("#spPro").innerHTML = `<h3>${UI.esc(t("shProTitle"))}</h3>
    <div class="pro-grid">
      <div><small>${UI.esc(t("shProUnit", { city: I18N.cityName(home) }))}</small><b>${unit}</b></div>
      <div class="pro-best"><small>${UI.esc(t("shProCarnet", { n: C.courses }))}</small><b>${UI.money(C.price)}</b><s>${UI.money(CONFIG.pricing.fixedFromHome[home] * C.courses)}</s></div>
      <div><small>${UI.esc(t("shCarnetLeft"))}</small><b>🎟️ ${left}</b></div>
    </div>
    <p class="muted small" style="margin:10px 0">${UI.esc(t("shCarnetHow", { price: UI.money(C.price), phone: CONFIG.bitPhone, code: shop.code, n: C.courses }))}</p>
    ${sales.length ? `<p class="small" style="margin:6px 0 10px">${UI.esc(t("shReceipts"))} ${sales.map(v =>
      `<a href="${UI.esc(UI.carnetReceiptUrl(v))}">🧾 ${UI.esc(t("shReceiptNo", { n: v.receipt_number }))}</a>`).join(" · ")}</p>` : ""}
    <div class="btns" style="justify-content:flex-start">
      <button type="button" class="btn btn-wa" data-buy="1">${UI.esc(t("shCarnetBuy", { price: UI.money(C.price) }))}</button>
      <a class="btn" href="index.html#devis">${UI.esc(t("offPro_cta"))} · ${UI.esc(t("rqTournee"))}</a>
    </div>`;
  const qr = $("#spQr");
  if (window.QRCode && qr.dataset.url !== clientLink(shop)) {
    qr.innerHTML = "";
    new QRCode(qr, { text: clientLink(shop), width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
    qr.dataset.url = clientLink(shop);
  }
  const month = new Date().toISOString().slice(0, 7);
  const live = orders.filter(o => !["annulee", "refusee"].includes(o.status));
  const monthList = live.filter(o => String(o.pickup_at).slice(0, 7) === month);
  $("#spMonth").textContent = monthList.length;
  $("#spSpent").textContent = UI.money(monthList.reduce((s, o) => s + Number(o.price), 0));
  $("#spAll").textContent = live.length;
  $("#spOrders").innerHTML = orders.length ? orders.slice(0, 30).map(o => `
    <div class="shop-row">
      <div><b>${UI.esc(o.dropoff_contact || o.contact_name || "")} · <bdi>${UI.esc(o.dropoff_address || "")}</bdi>, ${UI.esc(I18N.cityName(o.to_city))}</b>
        <small class="muted">${UI.esc(UI.fmtDateTime(o.pickup_at))} · ${UI.esc(t("orderNo", { ref: o.ref }))}</small></div>
      <div class="num"><span class="pill st-${UI.esc(o.status)}">${UI.esc(t("st_" + o.status))}</span><br><b>${UI.money(o.price)}</b>
        ${["nouvelle", "confirmee", "recuperee"].includes(o.status) ? `<br><a class="small" href="${UI.trackUrl(o)}">${UI.esc(t("shTrack"))}</a>` : ""}</div>
    </div>`).join("") : `<p class="muted small">${UI.esc(t("shNoOrders"))}</p>`;
}

// --- Messagerie : le commerce parle à HOP dans l'application --------------------------------
function openShopChat(prefill) {
  if (!state.dash) {
    // Pas encore inscrit : service client
    return Chat.open({ thread: "u:" + Store.deviceId(), title: t("chSupport"), sub: t("chSupportSub"), me: "client", prefill,
      fetch: () => Store.chatSupport(), send: (b, i) => Store.chatSupportSend(null, b, i), onClose: checkChat });
  }
  const { shop } = state.dash, token = shop.token;
  Chat.open({ thread: "s:" + shop.id, title: t("chShop"), sub: shop.name, me: "shop", prefill,
    fetch: () => Store.chatShop(token), send: (b, i) => Store.chatShopSend(token, b, i), onClose: checkChat });
}
async function checkChat() {
  try {
    const msgs = state.dash ? await Store.chatShop(state.dash.shop.token) : await Store.chatSupport();
    const n = Object.values(Chat.unread(msgs, state.dash ? "shop" : "client")).reduce((s, x) => s + x, 0);
    $("#fabBadge").textContent = n;
    $("#fabBadge").classList.toggle("hidden", !n);
  } catch (e) { /* nouvel essai */ }
}
$("#waFab").addEventListener("click", () => openShopChat());
$("#spPro").addEventListener("click", e => {
  if (!e.target.closest("[data-buy]")) return;
  const { shop } = state.dash;
  openShopChat(t("shCarnetMsg", { name: shop.name, code: shop.code, price: UI.money(CONFIG.partners.carnet.price) }));
});
setTimeout(checkChat, 1500);
setInterval(checkChat, 20000);

// --- Démarrage ------------------------------------------------------------------------
renderStatic();
attachPlaces();
const ref = (params.get("p") || "").trim().toUpperCase();
if (ref) {
  form.ref_code.value = ref;
  $("#refOk").classList.remove("hidden");
}
form.addEventListener("submit", submit);
form.addEventListener("focusout", e => {
  if (e.target.name === "phone" && e.target.value.trim()) e.target.classList.toggle("field-bad", !phoneOk(e.target.value));
});
$("#langBtn").addEventListener("click", () => { I18N.setLang(I18N.other()); renderStatic(); });
$("#spCopy").addEventListener("click", () => {
  if (navigator.clipboard) navigator.clipboard.writeText($("#spLink").value).then(() => { $("#spCopy").textContent = t("shCopied"); }, () => {});
});
$("#spPrint").addEventListener("click", () => { document.body.classList.add("print-poster"); window.print(); document.body.classList.remove("print-poster"); });

// Clé secrète dans l'adresse (lien envoyé au commerce), sinon celle gardée sur cet appareil
const key = params.get("k") || (ref ? null : Store.myShopTokens()[0]);
if (key) openSpace(key);
else $("#shopSignup").classList.remove("hidden");

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
