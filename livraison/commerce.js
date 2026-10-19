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
  $("#waFab").href = UI.waLink(CONFIG.whatsapp, t("chatMsg") + " ");
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

function renderSpace() {
  const { shop, orders } = state.dash;
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
  const buyMsg = t("shCarnetMsg", { name: shop.name, code: shop.code, price: UI.money(C.price) });
  $("#spPro").innerHTML = `<h3>${UI.esc(t("shProTitle"))}</h3>
    <div class="pro-grid">
      <div><small>${UI.esc(t("shProUnit", { city: I18N.cityName(home) }))}</small><b>${unit}</b></div>
      <div class="pro-best"><small>${UI.esc(t("shProCarnet", { n: C.courses }))}</small><b>${UI.money(C.price)}</b><s>${UI.money(CONFIG.pricing.fixedFromHome[home] * C.courses)}</s></div>
      <div><small>${UI.esc(t("shCarnetLeft"))}</small><b>🎟️ ${left}</b></div>
    </div>
    <p class="muted small" style="margin:10px 0">${UI.esc(t("shCarnetHow", { price: UI.money(C.price), phone: CONFIG.bitPhone, code: shop.code, n: C.courses }))}</p>
    <a class="btn btn-wa" target="_blank" rel="noopener" href="${UI.waLink(CONFIG.whatsapp, buyMsg)}">${UI.esc(t("shCarnetBuy", { price: UI.money(C.price) }))}</a>`;
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
