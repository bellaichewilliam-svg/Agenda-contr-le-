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

// Qui paie la livraison des clients HOP! Pro : le commerce (sa part, 12 ₪) ou le client (la course entière)
function payVars() {
  const st = Object.assign({ pro_shop_share: CONFIG.pro.shopShare, pro_hop_share: CONFIG.pro.hopShare }, state.settings || {});
  const full = Number(CONFIG.pricing.fixedFromHome[CONFIG.homeCity] || CONFIG.pricing.base);
  return { share: UI.money(st.pro_shop_share), client: UI.money(Math.max(0, full - (Number(st.pro_shop_share) - Number(st.pro_hop_share || 0)))), full: UI.money(full) };
}
// mode : "0" je paie ma part, "1" le client paie, "2" je paie toute la livraison (seulement dans l'espace, pas à l'inscription)
function payChoiceHtml(mode, note, gift) {
  const v = payVars();
  const opt = (val, i, k) => `<label class="choice"><input type="radio" name="client_pays" value="${val}"${val === mode ? " checked" : ""} />
    <span><i>${i}</i><b>${UI.esc(t(k, v))}</b><small>${UI.esc(t(k + "Note", v))}</small></span></label>`;
  return `<b class="pay-title">${UI.esc(t("payTitle"))}</b><div class="choices" style="margin-top:8px">${opt("0", "🏪", "payShop")}${opt("1", "🙋", "payClient")}${gift ? opt("2", "🎁", "payGift") + opt("3", "🤝", "payAsk") : ""}</div>
    <p class="muted small pay-msg" style="margin:8px 0 0">${UI.esc(note || t("payLater"))}</p>`;
}
function renderPay() {
  const box = $("#spPay"), shop = state.dash && state.dash.shop;
  if (!shop || box.contains(document.activeElement) && box.dataset.busy) return;
  box.innerHTML = payChoiceHtml(shop.pay_ask ? "3" : shop.shop_pays ? "2" : shop.client_pays ? "1" : "0", box.dataset.note, true);
}
function renderStatic() {
  I18N.apply();
  const pay = $("#shopPay"), chosen = pay.querySelector("input:checked");
  pay.innerHTML = payChoiceHtml(chosen ? chosen.value : "0");
  $("#brandName").innerHTML = UI.wordmark(I18N.lang === "he" ? "לעסקים" : "Pro");
  renderLanding();
  renderExtra();
  const city = $("#shopCity").value || CONFIG.homeCity;
  $("#shopCity").innerHTML = CONFIG.cities.map(c => `<option value="${c.id}">${UI.esc(I18N.cityName(c.id))}</option>`).join("");
  $("#shopCity").value = city;
  const kind = $("#shopKind").value || "restaurant";
  const kinds = t("shKinds");
  $("#shopKind").innerHTML = CONFIG.partners.kinds.map(k => `<option value="${k}">${UI.esc(kinds[k] || k)}</option>`).join("");
  $("#shopKind").value = kind;
  if (state.dash) renderSpace();
}

// --- Page de présentation : Gratuit ou HOP! Pro ---------------------------------------
const DEMO_SHOP = "DEMO-RESTO";
let plan = params.get("formule") === "pro" ? "pro" : "free";
let calcSales = 10000;
function landingVars() {
  const st = Object.assign({ pro_monthly: CONFIG.pro.monthly }, state.settings || {});
  return Object.assign(payVars(), { price: payVars().full, monthly: UI.money(st.pro_monthly), monthlyN: Number(st.pro_monthly) });
}
function renderLanding() {
  const v = landingVars(), e = k => UI.esc(t(k, v));
  const demo = UI.esc(UI.appUrl() + "?c=" + DEMO_SHOP);
  const li = keys => keys.map(k => `<li>${e(k)}</li>`).join("");
  const yes = `<b class="sl-yes" aria-label="✓">✓</b>`, no = `<span class="sl-no" aria-label="—">—</span>`;
  const row = (k, a, b) => `<tr><th scope="row">${e(k)}</th><td>${a}</td><td>${b}</td></tr>`;
  $("#shopLanding").innerHTML = `
    <section class="sl-hero">
      <div class="sl-hero-text">
        <span class="sl-kicker">${e("slKicker")}</span>
        <h1>${e("slTitle")}<br><em>${e("slTitle2")}</em></h1>
        <p>${e("slLead")}</p>
        <div class="sl-ctas">
          <a class="btn btn-primary btn-lg" href="#shopForm" data-sl-plan="free">${e("slCtaFree")}</a>
          <a class="btn btn-lg sl-ghost" href="${demo}" target="_blank" rel="noopener">${e("slCtaDemo")}</a>
        </div>
        <div class="sl-stats">
          <div><b>${e("slStat1")}</b><small>${e("slStat1s")}</small></div>
          <div><b>${UI.esc(v.full)}</b><small>${e("slStat2s")}</small></div>
          <div><b>${e("slStat3")}</b><small>${e("slStat3s")}</small></div>
        </div>
      </div>
      <div class="sl-phone" aria-hidden="true">
        <div class="sl-screen">
          <div class="sl-cover"><span>🍔</span></div>
          <div class="sl-shop"><b>${e("slMockShop")}</b><small>${e("slMockSub")}</small></div>
          ${[["slMockA", 52, "🍔"], ["slMockB", 48, "🍕"], ["slMockC", 64, "🍣"]].map(([k, p, i]) =>
            `<div class="sl-item"><i>${i}</i><span>${e(k)}<small>${UI.esc(UI.money(p))}</small></span><em>+</em></div>`).join("")}
          <div class="sl-toast"><b>${e("slMockRing")}</b><small>${e("slMockRingSub")}</small></div>
          <div class="sl-rider">${e("slMockRider")}</div>
        </div>
      </div>
    </section>

    <section class="sl-block">
      <h2>${e("slPlansTitle")}</h2>
      <p class="sl-sub">${e("slPlansSub")}</p>
      <div class="sl-plans">
        <article class="sl-plan">
          <header><span class="sl-tag">${e("slFreeTag")}</span><h3>🛵 ${e("slFreeName")}</h3>
            <div class="sl-price"><b>${e("slFreePrice")}</b><small>${e("slFreePer")}</small></div><p>${e("slFreeFor")}</p></header>
          <ul class="sl-feats">${li(["slFree1", "slFree2", "slFree3", "slFree4", "slFree5"])}</ul>
          <a class="btn btn-block btn-lg" href="#shopForm" data-sl-plan="free">${e("slFreeBtn")}</a>
        </article>
        <article class="sl-plan sl-plan-pro">
          <header><span class="sl-tag">⭐ ${e("slProTag")}</span><h3>${e("slProName")}</h3>
            <div class="sl-price"><b>${UI.esc(v.monthly)}</b><small>${e("slProPer")}</small></div><span class="sl-gift">${e("slProGift")}</span><p>${e("slProFor")}</p></header>
          <p class="sl-plus">${e("slPro0")}</p>
          <ul class="sl-feats">${li(["slPro1", "slPro2", "slPro3", "slPro4", "slPro4b", "slPro5", "slPro6"])}</ul>
          <a class="btn btn-primary btn-block btn-lg" href="#shopForm" data-sl-plan="pro">${e("slProBtn")}</a>
          <a class="sl-demo" href="${demo}" target="_blank" rel="noopener">${e("slProDemo")}</a>
        </article>
      </div>
    </section>

    <section class="sl-block">
      <h2>${e("slCmpTitle")}</h2>
      <div class="sl-table-wrap"><table class="sl-table">
        <thead><tr><th></th><th>${e("slCmpFree")}</th><th class="sl-col-pro">${e("slCmpPro")}</th></tr></thead>
        <tbody>
          ${row("slCmp1", yes, yes)}${row("slCmp2", yes, yes)}${row("slCmp3", yes, yes)}${row("slCmp4", yes, yes)}
          ${row("slCmp5", no, yes)}${row("slCmp6", no, yes)}${row("slCmp7", no, yes)}${row("slCmp8", no, yes)}
          ${row("slCmp9", "<b>0 %</b>", "<b>0 %</b>")}${row("slCmp10", "<b>0 ₪</b>", `<b>${e("slCmpMonth")}</b><small class="sl-cmp-gift">${e("slCmpGift")}</small>`)}
        </tbody>
      </table></div>
    </section>

    <section class="sl-block sl-calc">
      <h2>${e("slCalcTitle")}</h2>
      <label class="sl-range"><span>${e("slCalcSub")} <b id="slSales"></b></span>
        <input type="range" id="slSalesIn" min="2000" max="60000" step="1000" value="${calcSales}" /></label>
      <div class="sl-bars">
        <div class="sl-bar sl-bar-big"><span>${e("slCalcBig")}</span><b id="slBig"></b></div>
        <div class="sl-bar sl-bar-hop"><span>${e("slCalcHop")}</span><b id="slHop"></b></div>
      </div>
      <p class="sl-save" id="slSave"></p>
      <p class="muted small">${e("slCalcNote")}</p>
    </section>

    <section class="sl-block">
      <h2>${e("slHowTitle")}</h2>
      <ol class="sl-steps">${[1, 2, 3, 4].map(n => `<li><i>${n}</i><b>${e("slHow" + n)}</b><span>${e("slHow" + n + "s")}</span></li>`).join("")}</ol>
    </section>

    <section class="sl-block">
      <h2>${e("slFaqTitle")}</h2>
      <div class="sl-faq">${[1, 2, 3, 4, 5].map(n => `<details><summary>${e("slQ" + n)}</summary><p>${e("slA" + n)}</p></details>`).join("")}</div>
    </section>`;
  renderCalc();
  renderPlanPick();
}
function renderCalc() {
  const v = landingVars(), big = Math.round(calcSales * 0.3), diff = big - v.monthlyN;
  $("#slSales").textContent = UI.money(calcSales);
  $("#slBig").textContent = "− " + UI.money(big);
  $("#slHop").textContent = "− " + v.monthly;
  const max = Math.max(big, v.monthlyN) || 1;
  $(".sl-bar-big").style.setProperty("--w", Math.max(4, big / max * 100) + "%");
  $(".sl-bar-hop").style.setProperty("--w", Math.max(4, v.monthlyN / max * 100) + "%");
  $("#slSave").textContent = diff > 0 ? t("slCalcSave", { amount: UI.money(diff) }) : t("slCalcSmall");
}
function renderPlanPick() {
  const v = landingVars();
  const opt = (val, i, k) => `<label class="choice"><input type="radio" name="plan" value="${val}"${plan === val ? " checked" : ""} />
    <span><i>${i}</i><b>${UI.esc(t(k, v))}</b><small>${UI.esc(t(k + "Sub", v))}</small></span></label>`;
  $("#shopPlan").innerHTML = `<div class="choices">${opt("free", "🛵", "slPickFree")}${opt("pro", "⭐", "slPickPro")}</div>`;
  $("#shopPay").classList.toggle("hidden", plan !== "pro");
}
function choosePlan(p) { plan = p; renderPlanPick(); }
$("#shopLanding").addEventListener("input", e => { if (e.target.id === "slSalesIn") { calcSales = Number(e.target.value); renderCalc(); } });
document.addEventListener("click", e => {
  const a = e.target.closest("[data-sl-plan], #slSticky");
  if (!a) return;
  e.preventDefault();
  if (a.dataset.slPlan) choosePlan(a.dataset.slPlan);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => form.name.focus({ preventScroll: true }), 450);
});
$("#shopPlan").addEventListener("change", e => { if (e.target.name === "plan") choosePlan(e.target.value); });
// Bouton « Inscription gratuite » en bas de l'écran : après l'en-tête, tant que le formulaire n'est pas visible
function stickyCheck() {
  const hero = $(".sl-hero"), show = !$("#shopSignup").classList.contains("hidden") && hero &&
    hero.getBoundingClientRect().bottom < 0 && form.getBoundingClientRect().top > innerHeight * 0.85;
  $("#slSticky").classList.toggle("hidden", !show);
}
addEventListener("scroll", stickyCheck, { passive: true });

// --- Infos de base dès l'inscription (facultatif) : ce que verront les clients ----------------
const extra = { logo: "", cover: "", shown: false };
function renderExtra() {
  const box = $("#shopExtra"), keep = extra.shown ? {
    tagline: $("#sgTagline").value, about: $("#sgAbout").value, wa: $("#sgWa").value, hours: UI.readHours(box) } : null;
  extra.shown = true;
  const pic = (k, label, wide) => `<div class="sg-pic${wide ? " wide" : ""}">
      <span class="sg-pic-img">${extra[k] ? `<img src="${extra[k]}" alt="" />` : wide ? "🖼️" : "🏪"}</span>
      <span class="sg-pic-txt"><b>${UI.esc(t(label))}</b>
        <label class="btn btn-sm">${UI.esc(t(extra[k] ? "brChange" : "brAdd"))}<input type="file" accept="image/*" data-sg-pic="${k}" hidden /></label>
        ${extra[k] ? `<button type="button" class="btn btn-sm btn-link" data-sg-off="${k}">${UI.esc(t("brRemove"))}</button>` : ""}</span></div>`;
  box.innerHTML = `<h3 class="sg-h">${UI.esc(t("sgTitle"))}</h3>
    <p class="muted small" style="margin:2px 0 10px">${UI.esc(t("sgSub"))}</p>
    <div class="sg-pics">${pic("logo", "brLogo")}${pic("cover", "brCover", true)}</div>
    <label class="f wide"><span>${UI.esc(t("brTagline"))}</span><input id="sgTagline" maxlength="90" placeholder="${UI.esc(t("brTaglinePh"))}" /></label>
    <label class="f wide" style="margin-top:10px"><span>${UI.esc(t("fiAbout"))}</span><textarea id="sgAbout" rows="2" maxlength="600" placeholder="${UI.esc(t("fiAboutPh"))}"></textarea></label>
    <label class="f wide" style="margin-top:10px"><span>${UI.esc(t("fiWa"))}</span><input id="sgWa" inputmode="tel" dir="ltr" placeholder="05X-XXX-XXXX" /></label>
    ${UI.hoursEditor(keep ? keep.hours : [])}`;
  if (keep) { $("#sgTagline").value = keep.tagline; $("#sgAbout").value = keep.about; $("#sgWa").value = keep.wa; }
}
UI.bindHours($("#shopExtra"));
$("#shopExtra").addEventListener("change", async e => {
  const k = e.target.dataset && e.target.dataset.sgPic;
  if (!k || !e.target.files[0]) return;
  try { extra[k] = await (k === "logo" ? cropPhoto(e.target.files[0], 320, 320, 120000) : cropPhoto(e.target.files[0], 960, 480, 260000)); }
  catch (ex) { return alert(t("ctPhotoErr")); }
  renderExtra();
});
$("#shopExtra").addEventListener("click", e => {
  const b = e.target.closest("[data-sg-off]");
  if (b) { extra[b.dataset.sgOff] = ""; renderExtra(); }
});
// Ce que le commerce a rempli (rien = rien d'envoyé : la fiche automatique complète)
function extraValues() {
  const hours = UI.readHours($("#shopExtra"));
  return { logo: extra.logo, cover: extra.cover, tagline: $("#sgTagline").value.trim(), about: $("#sgAbout").value.trim(),
    whatsapp: $("#sgWa").value.replace(/\D/g, ""), hours: hours.some(h => h.h) ? hours : null };
}
const badRanges = hours => (hours || []).some(h => String(h.h || "").split(",").filter(Boolean).some(r => { const [a, b] = r.split("-"); return !a || !b || a >= b; }));

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
  const ex = extraValues();
  if (ex.whatsapp && !/^(0\d{8,9}|972\d{8,9})$/.test(ex.whatsapp)) { $("#sgWa").focus(); return err(t("fiWaBad")); }
  if (badRanges(ex.hours)) return err(t("fiHoursBad"));
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
      ref_code: v("ref_code").toUpperCase() || null, lang: I18N.lang,
      client_pays: plan === "pro" && (form.querySelector("[name=client_pays]:checked") || {}).value === "1"
    });
    // Les infos de base tout de suite dans sa fiche (seulement ce qui a été rempli)
    if (ex.logo || ex.cover || ex.tagline) await Store.saveShopBrand(r.token, { logo: ex.logo || null, cover: ex.cover || null, tagline: ex.tagline }).catch(() => {});
    if (ex.whatsapp || ex.about || ex.hours) await Store.shopFicheSave(r.token, { whatsapp: ex.whatsapp, about: ex.about, hours: ex.hours }).catch(() => {});
    // Puis la fiche automatique (horaires, photo, menu s'il est déjà en ligne quelque part) : l'espace se met à jour à l'arrivée
    Store.shopEnrich(r.token).then(x => {
      if (!x || !x.ok || !(x.done || []).length || !state.dash || state.dash.shop.token !== r.token) return;
      refreshSpace().then(() => { loadCatalog(); renderBrand(true); renderFiche(true); });
    }).catch(() => {});
    history.replaceState(null, "", location.pathname + "?k=" + r.token);
    await openSpace(r.token);
    if (r.ref_other_city) alert(t("shRefCity", { city: I18N.cityName(r.ref_other_city) }));
    window.scrollTo(0, 0);
    // HOP! Pro choisi : la demande d'abonnement part tout de suite au patron, dans la messagerie
    if (plan === "pro" && state.dash) openShopChat(t("spPlanMsg", { name: state.dash.shop.name, code: state.dash.shop.code }));
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
  // Le patron qui regarde l'espace d'un commerce (?vu=1) : rien n'est gardé sur son téléphone
  if (!params.has("vu")) Store.rememberShopToken(token, d.shop.code);
  state.token = token;
  state.dash = d;
  $("#shopSignup").classList.add("hidden");
  $("#shopGone").classList.add("hidden");
  $("#shopSpace").classList.remove("hidden");
  renderSpace();
  loadCatalog();
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
  if (Store.sandbox) on = false;   // démo en rendez-vous : pas de sonnerie
  if (on && !ring.timer) { ringOnce(); ring.timer = setInterval(ringOnce, 3000); }
  if (!on && ring.timer) { clearInterval(ring.timer); ring.timer = null; }
}
// N° de commande tapé mais pas encore validé : gardé quand l'écran se rafraîchit
const refDraft = {};
// « Je choisis à chaque commande » : qui paie la livraison de celle-ci (choisi en l'acceptant)
const payDraft = {};
function payPick(o) {
  const shop = state.dash.shop;
  if (!shop.pay_ask || o.shop_pays || Number(o.shop_share) > 0) return "";
  if (o.payment_method === "cash") return `<p class="small muted">${UI.esc(t("ppCash"))}</p>`;
  const v = payVars(), cur = payDraft[o.id] || "client";
  return `<div class="pay-pick" data-pay-for="${UI.esc(o.id)}"><b>${UI.esc(t("ppTitle"))}</b>
    ${[["client", "ppClient"], ["share", "ppShare"], ["shop", "ppShop"]].map(([m, k]) => `<label class="check"><input type="radio" name="pp-${UI.esc(o.id)}" value="${m}"${m === cur ? " checked" : ""} /> <span>${UI.esc(t(k, v))}</span></label>`).join("")}</div>`;
}
// Paiement direct : le commerce paie au livreur sa part de la course (12 − 2 = 10 ₪) en lui remettant la commande
// Livraison offerte par le commerce : il paie toute la course au livreur
const courierPart = o => (o.shop_pays ? Number(o.price || 0) : o.direct_pay ? Math.max(0, Number(o.shop_share || 0) - Number(o.hop_share || 0)) : 0);
function courierPay(o) {
  const amount = courierPart(o), all = !!o.shop_pays;
  if (!amount) return "";
  if (all && o.payment_status === "paye") return `<p class="small pay-courier">${UI.esc(t("spPaidCourier", { amount: UI.money(amount) }))}</p>`;
  if (!o.courier_bit) return `<p class="small pay-courier">${all ? "" : "💳 "}${UI.esc(t(all ? "spPayCourierAllLater" : "spPayCourierLater", { amount: UI.money(amount) }))}</p>`;
  const name = String(o.courier_name || "").split(" ")[0];
  return `<p class="small pay-courier">${all ? "" : "💳 "}${UI.esc(t(all ? "spPayCourierAll" : "spPayCourier", { amount: UI.money(amount), name, phone: o.courier_bit }))}
    <button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(o.courier_bit).replace(/\D/g, ""))}">${UI.esc(t("bpCopy"))}</button></p>`;
}
// Espèces : le livreur paie les articles au commerce en espèces ; le commerce le confirme (« Espèces reçues »)
function cashLine(o) {
  if (o.payment_method !== "cash" || !(Number(o.cash_goods) > 0)) return "";
  if (o.cash_shop_at) return `<p class="cash-need ok">${UI.esc(t("spCashOk", { amount: UI.money(o.cash_goods) }))}</p>`;
  // Commerce partenaire : le livreur rapporte l'argent des articles après la livraison (ou paie en prenant la commande)
  if (o.cash_shop_after) return `<div class="cash-need"><b>${UI.esc(t("spCashAfter", { amount: UI.money(o.cash_goods) }))}</b>
    ${["confirmee", "recuperee", "livree"].includes(o.status) ? `<button type="button" class="btn btn-primary btn-block" data-cash-ok="${UI.esc(o.id)}" data-after="1">${UI.esc(t("spCashBtn", { amount: UI.money(o.cash_goods) }))}</button>` : `<small>${UI.esc(t("spCashAfterWait"))}</small>`}</div>`;
  return `<div class="cash-need"><b>${UI.esc(t("spCashDue", { amount: UI.money(o.cash_goods) }))}</b>
    ${o.status === "confirmee" ? `<button type="button" class="btn btn-primary btn-block" data-cash-ok="${UI.esc(o.id)}">${UI.esc(t("spCashBtn", { amount: UI.money(o.cash_goods) }))}</button>` : `<small>${UI.esc(t("spCashWait"))}</small>`}</div>`;
}
// Ce que le commerce doit à HOP pour une livraison : sa part (avant), ou seulement la part de HOP (paiement direct)
const billPart = o => (o.direct_pay ? (Number(o.shop_share || 0) > 0 ? Number(o.hop_share || 0) : 0) : Number(o.shop_share || 0));
// Articles déjà mis dans le sac et nombre de sacs (gardés sur ce téléphone, même si on recharge la page)
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
const kept = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
const picked = kept("hop_shop_picked"), bagsDraft = kept("hop_shop_bags");
// La clé d'une coche comprend la quantité : un article dont le client a augmenté la quantité est à recocher
const pickKey = (o, it, i) => `${o.id}:${i}:${it.qty}`;
const pickedCount = o => (o.items || []).filter((it, i) => picked[pickKey(o, it, i)]).length;
// Le client a ajouté des articles : on sonne une fois et on le dit sur la commande
const seenItems = {};
function itemsChanged(list) {
  let changed = false;
  list.forEach(o => {
    const sig = JSON.stringify(o.items || null);
    if (seenItems[o.id] !== undefined && seenItems[o.id] !== sig) changed = true;
    seenItems[o.id] = sig;
  });
  if (changed) ringOnce();
}
// Préparation : chaque article à cocher, la progression, puis combien de sacs pour le livreur
function prepList(o) {
  const n = o.items.length, done = pickedCount(o), editable = o.shop_status === "acceptee";
  const added = o.items.some(it => it.added) && o.items.some((it, i) => it.added && !picked[pickKey(o, it, i)]);
  return `${added && editable ? `<p class="prep-added">${UI.esc(t("spAddedAlert"))}</p>` : ""}<ul class="prep-items">${o.items.map((it, i) => { const key = pickKey(o, it, i), on = !!picked[key];
      return `<li class="${on ? "done" : ""}${it.added ? " added" : ""}"><label><input type="checkbox" data-pick="${UI.esc(key)}"${on ? " checked" : ""}${editable ? "" : " disabled"} /> <b dir="ltr">${it.qty} ×</b> <span dir="auto">${UI.esc(it.name)}${it.added ? ` <i class="prep-new-tag">${UI.esc(t("spAdded"))}</i>` : ""}</span> <small class="muted">${UI.money(it.price * it.qty)}</small></label></li>`; }).join("")}</ul>
    ${editable ? `<p class="prep-progress${done === n ? " all" : ""}"><b>${UI.esc(done === n ? t("spAllPicked") : t("spPickedN", { n: done, total: n }))}</b><i style="width:${Math.round(done / n * 100)}%"></i></p>` : ""}`;
}
function bagsPicker(o) {
  const cur = Number(bagsDraft[o.id]) || 0;
  return `<div class="bags-pick"><span>${UI.esc(t("spBagsQ"))}</span><div>${[1, 2, 3, 4, 5, 6].map(k =>
    `<button type="button" class="ch-chip${cur === k ? " on" : ""}" data-bags-for="${UI.esc(o.id)}" data-n="${k}">${k}</button>`).join("")}</div></div>`;
}
function renderPrep() {
  const { shop, orders } = state.dash;
  // On ne redessine pas pendant que le commerce tape son n° de commande
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#spPrep [data-ref-for]")) return;
  const list = orders.filter(o => PREP.includes(o.shop_status) && ["nouvelle", "confirmee"].includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const box = $("#spPrep");
  box.classList.toggle("hidden", !planOn(shop) && !list.length);
  setRing(list.some(o => o.shop_status === "attente" || o.goods_pay === "declare"));
  itemsChanged(list);
  if (box.classList.contains("hidden")) return;
  const time = d => new Date(d).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
  box.innerHTML = `<h3>${UI.esc(t("spPrepTitle"))}</h3>` + (list.length ? list.map(o => {
    const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
    const courier = o.status === "confirmee" && o.courier_name ? t("spCourier", { name: o.courier_name.split(" ")[0] }) : t("spNoCourier");
    const nb = UI.notBefore(o), nbOn = nb && nb > Date.now();
    const head = (nbOn ? `<b class="prep-nb">⏰ ${UI.esc(t("spForTime", { time: time(nb), prep: time(new Date(nb - 10 * 60000)) }))}</b><br>` : "")
      + (o.shop_status === "attente" ? `<b class="prep-new">${UI.esc(t("spNew"))}</b> · ${time(o.created_at)}`
      : o.shop_status === "prete" ? `<b>${UI.esc(t("spIsReady"))}</b> · ${UI.esc(courier)}`
      : `<b class="${left < 0 ? "prep-late" : ""}">${UI.esc(left < 0 ? t("spLate", { min: -left }) : t("spReadyIn", { min: Math.max(0, left) }))}</b> · ${UI.esc(courier)}`);
    // Articles payés d'avance : on prépare seulement une fois le paiement reçu
    const amount = Number(o.items_total) > 0 ? UI.money(o.items_total) : "";
    // Pas de lien de paiement : le commerce encaisse lui-même les articles (le livreur n'encaisse que la livraison)
    const goods = !o.goods_pay ? (Number(o.items_total) > 0 && o.payment_method !== "cash" && !o.shop_sent ? `<p class="goods-line wait">${UI.esc(t("spGoodsSelf", { amount }))}</p>` : "")
      : o.goods_pay === "recu" ? `<p class="goods-line ok">${UI.esc(t("spGoodsOk", { amount }))}</p>`
      : o.goods_pay === "pas_recu" ? `<p class="goods-line bad">${UI.esc(t("spGoodsNo"))}</p>`
      : `<div class="goods-line ${o.goods_pay === "declare" ? "due" : "wait"}"><b>${UI.esc(t(o.goods_pay === "declare" ? "spGoodsDeclared" : "spGoodsTodo", { amount }))}</b>
          <div class="prep-btns"><button type="button" class="btn btn-primary btn-sm" data-goods-ok="${UI.esc(o.id)}">${UI.esc(t("spGoodsOkBtn"))}</button>
          ${o.goods_pay === "declare" ? `<button type="button" class="btn btn-sm" data-goods-no="${UI.esc(o.id)}">${UI.esc(t("spGoodsNoBtn"))}</button>` : ""}</div></div>`;
    const unpaid = o.goods_pay && o.goods_pay !== "recu";
    const act = o.shop_status === "attente" && unpaid ? `${goods}<small class="muted">${UI.esc(t("spGoodsWaitAccept"))}</small>
        <div class="prep-btns"><button type="button" class="btn btn-link" data-refuse="${UI.esc(o.id)}">${UI.esc(t("spRefuse"))}</button></div>`
      : o.shop_status === "attente"
      ? `${goods}${payPick(o)}<label class="f prep-ref"><span>${UI.esc(t("spRefLabel"))}</span><input inputmode="numeric" maxlength="3" autocomplete="off" data-ref-for="${UI.esc(o.id)}" value="${UI.esc(refDraft[o.id] || "")}" placeholder="${UI.esc(t("spRefPh"))}" /></label>
        <small class="muted">${UI.esc(t("spAcceptIn"))}</small><div class="prep-btns prep-accept">${CONFIG.pro.prepChoices.map(m =>
          `<button type="button" class="btn btn-primary" data-prep="${m}" data-id="${UI.esc(o.id)}">${UI.esc(t("spMin", { n: m }))}</button>`).join("")}</div>
          <button type="button" class="btn btn-link btn-sm prep-refuse" data-refuse="${UI.esc(o.id)}">${UI.esc(t("spRefuse"))}</button>`
      : o.shop_status === "acceptee" ? `${goods}${bagsPicker(o)}<button type="button" class="btn btn-primary btn-block" data-ready="${UI.esc(o.id)}">${UI.esc(t("spReadyBtn"))}</button>`
      : o.bags_count ? `<p class="bags-done">${UI.esc(t("spBags", { n: o.bags_count }))}</p>` : "";
    return `<div class="prep-item${o.shop_status === "attente" ? " is-new" : ""}">
      <div class="prep-head">${head}${o.shop_ref ? `<b class="bag-no">${UI.esc(t("spRefShow", { n: o.shop_ref }))}</b>` : ""}<small class="muted">${UI.esc(t("orderNo", { ref: o.ref }))}</small></div>
      ${Array.isArray(o.items) && o.items.length
        ? `${prepList(o)}
          ${o.items_note ? `<p class="prep-order">💬 ${UI.esc(o.items_note)}</p>` : ""}<p class="small"><b>${UI.esc(t("spItemsTotal", { total: UI.money(o.items_total) }))}</b></p>`
        : `<p class="prep-order" dir="auto">${UI.esc(o.shop_order || "")}</p>`}
      <small class="muted">${UI.esc(t("spClient", { name: (o.dropoff_contact || o.contact_name || "").split(" ")[0], city: I18N.cityName(o.to_city) }))}</small>
      ${courierPay(o)}
      ${cashLine(o)}
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
    const done = orders.filter(o => o.status === "livree" && billPart(o) > 0 && String(o.pickup_at).slice(0, 7) === month);
    const shares = done.reduce((x, o) => x + billPart(o), 0);
    box.innerHTML = `<h3>${UI.esc(t("spPlanOn", { date: UI.fmtKey(shop.plan_until) }))}</h3>
      <p class="small" style="margin:6px 0 0">${UI.esc(t(shop.client_pays && !shares ? "spBillClient" : "spBill", { monthly: UI.money(st.pro_monthly), shares: UI.money(shares), n: done.length,
        total: UI.money(Number(st.pro_monthly) + shares), phone: CONFIG.bitPhone }))}</p>`;
    return;
  }
  // Le client paie la course moins la part du commerce (hors les 2 ₪ de service HOP)
  const client = UI.money(Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - (Number(st.pro_shop_share) - Number(st.pro_hop_share || 0))));
  box.innerHTML = `<h3>${UI.esc(t("spPlanTitle"))}</h3>
    <ul class="plan-list">${["spPlan1", "spPlan2", "spPlan3", "spPlan4"].map(k => `<li>${UI.esc(t(k, Object.assign(payVars(), { monthly: UI.money(st.pro_monthly), client, share: UI.money(st.pro_shop_share) })))}</li>`).join("")}</ul>
    <button type="button" class="btn btn-primary" data-plan="1">${UI.esc(t("spPlanBtn"))}</button>`;
}
async function refreshSpace() {
  if (!state.dash) return;
  try {
    const d = await Store.shopDashboard(state.dash.shop.token);
    if (d && d.shop) { state.dash = d; renderSpace(); }
  } catch (e) { /* nouvel essai au prochain tour */ }
}
async function prepAction(id, action, minutes, reason, ref, bags) {
  try {
    const ok = await Store.shopOrderAction(state.dash.shop.token, id, action, minutes, reason, ref, bags);
    if (!ok) alert(t("spErr"));
    else if (action === "accepter") delete refDraft[id];
  } catch (e) { alert(/shop_ref/.test(e.message || "") ? t("spRefNeed") : /goods_unpaid/.test(e.message || "") ? t("spErrGoods") : t("spErr")); }
  refreshSpace();
}
$("#spPrep").addEventListener("change", e => {
  const c = e.target.closest("[data-pick]");
  if (!c) return;
  if (c.checked) picked[c.dataset.pick] = true; else delete picked[c.dataset.pick];
  keep("hop_shop_picked", picked);
  renderPrep();
});
$("#spPrep").addEventListener("input", e => {
  const i = e.target.closest("[data-ref-for]");
  if (!i) return;
  i.value = i.value.replace(/\D/g, "").slice(0, 3);
  refDraft[i.dataset.refFor] = i.value;
});
$("#spPrep").addEventListener("change", e => {
  const r = e.target.closest("[data-pay-for] input");
  if (r) payDraft[r.closest("[data-pay-for]").dataset.payFor] = r.value;
});
$("#spPrep").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.prep) {
    const input = $(`#spPrep [data-ref-for="${b.dataset.id}"]`), ref = input ? input.value.trim() : "";
    if (!/^[0-9]{3}$/.test(ref)) { alert(t("spRefNeed")); if (input) input.focus(); return; }
    // Qui paie la livraison de cette commande (au choix) : enregistré juste avant d'accepter
    const pick = $(`#spPrep [data-pay-for="${b.dataset.id}"] input:checked`);
    if (pick && pick.value !== "client") {
      b.disabled = true;
      const ok = await Store.shopOrderPay(state.dash.shop.token, b.dataset.id, pick.value).catch(() => false);
      if (!ok) { b.disabled = false; return alert(t("spErr")); }
    }
    return prepAction(b.dataset.id, "accepter", Number(b.dataset.prep), null, ref);
  }
  if (b.dataset.goodsOk || b.dataset.goodsNo) {
    if (b.dataset.goodsNo && !confirm(t("spGoodsNoConfirm"))) return;
    b.disabled = true;
    Store.shopGoodsPay(state.dash.shop.token, b.dataset.goodsOk || b.dataset.goodsNo, !!b.dataset.goodsOk)
      .then(ok => { if (!ok) alert(t("spErr")); }, () => alert(t("spErr"))).then(refreshSpace);
    return;
  }
  if (b.dataset.cashOk) {
    const o = state.dash.orders.find(x => x.id === b.dataset.cashOk);
    if (o && confirm(t("spCashConfirm", { amount: UI.money(o.cash_goods) }))) {
      if (!b.dataset.after) return prepAction(b.dataset.cashOk, "cash_ok");
      return Store.shopCashReceived(state.dash.shop.token, b.dataset.cashOk).then(ok => { if (!ok) alert(t("spErr")); refreshSpace(); }, () => alert(t("spErr")));
    }
    return;
    return;
  }
  if (b.dataset.bagsFor) { bagsDraft[b.dataset.bagsFor] = Number(b.dataset.n); keep("hop_shop_bags", bagsDraft); return renderPrep(); }
  if (b.dataset.ready) {
    const o = state.dash.orders.find(x => x.id === b.dataset.ready), bags = Number(bagsDraft[b.dataset.ready]) || 0;
    if (!bags) { alert(t("spBagsNeed")); return; }
    const left = o && Array.isArray(o.items) ? o.items.length - pickedCount(o) : 0;
    if (left > 0 && !confirm(t("spPickConfirm", { n: left }))) return;
    return prepAction(b.dataset.ready, "prete", null, null, null, bags);
  }
  if (b.dataset.refuse) { const why = prompt(t("spRefuseWhy")); if (why !== null) prepAction(b.dataset.refuse, "refuser", null, why); }
});
$("#spPlan").addEventListener("click", e => {
  if (!e.target.closest("[data-plan]")) return;
  const { shop } = state.dash;
  openShopChat(t("spPlanMsg", { name: shop.name, code: shop.code }));
});
// --- Vitrine HOP! Pro : logo, photo de couverture, phrase d'accroche (ce que voient les clients) ------
const brand = { logo: undefined, cover: undefined, shown: false, busy: false };
// Photo recadrée au centre (logo carré, couverture en bandeau), légère pour l'accueil des clients
function cropPhoto(file, w, h, maxLen) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.max(w / img.width, h / img.height);
      const sw = w / k, sh = h / k;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const data = c.toDataURL("image/jpeg", q);
        if (data.length < maxLen) return resolve(data);
      }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
function brandValues() {
  const shop = state.dash.shop, input = $("#brTagline");
  return { logo: brand.logo !== undefined ? brand.logo : shop.logo || "", cover: brand.cover !== undefined ? brand.cover : shop.cover || "",
    tagline: input ? input.value : shop.tagline || "" };
}
function brandPreview() {
  const shop = state.dash.shop, v = brandValues(), st = state.settings || {};
  const share = Number(st.pro_shop_share != null ? st.pro_shop_share : CONFIG.pro.shopShare) - Number(st.pro_hop_share != null ? st.pro_hop_share : CONFIG.pro.hopShare);
  const price = UI.money(Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - (shop.client_pays ? 0 : share)));
  const n = cat.data ? cat.data.products.filter(p => p.available).length : 0;
  $("#brPreview").innerHTML = UI.proCard({ name: shop.name, kind: shop.kind, logo: v.logo, cover: v.cover, tagline: v.tagline.trim(), code: "" },
    { kindLabel: (t("shKinds") || {})[shop.kind] || "", delivery: t("proDelivery", { price }), menu: n ? t("proMenu", { n }) : "", go: t("proGo") });
}
function renderBrand(force) {
  // Logo, couverture, accroche : pour tous les commerces (la même fiche que les commerces HOP! Pro)
  const box = $("#spBrand"), shop = state.dash.shop;
  box.classList.remove("hidden");
  // Pas redessinée par le rafraîchissement automatique : ce qui est tapé reste
  if (brand.shown && !force) return brandPreview();
  brand.shown = true;
  const v = brandValues();
  const up = (k, label) => `<div class="br-up"><span>${UI.esc(label)}</span>
    <label class="btn btn-sm${v[k] ? "" : " btn-primary"}">${UI.esc(t(v[k] ? "brChange" : "brAdd"))}<input type="file" accept="image/*" data-br="${k}" hidden /></label>
    ${v[k] ? `<button type="button" class="btn btn-sm btn-link" data-br-off="${k}">${UI.esc(t("brRemove"))}</button>` : ""}</div>`;
  box.innerHTML = `<h3>${UI.esc(t("brTitle"))}</h3>
    <p class="muted small" style="margin:4px 0 10px">${UI.esc(t("brSub"))}</p>
    <div class="br-preview" id="brPreview"></div>
    <div class="br-fields">${up("logo", t("brLogo"))}${up("cover", t("brCover"))}
      <label class="f"><span>${UI.esc(t("brTagline"))}</span><input id="brTagline" maxlength="90" value="${UI.esc(v.tagline)}" placeholder="${UI.esc(t("brTaglinePh"))}" /></label>
      <label class="f"><span>${UI.esc(t("brTaglineHe"))}</span><input id="brTaglineHe" maxlength="90" dir="rtl" lang="he" value="${UI.esc(shop.tagline_he || "")}" placeholder="לדוגמה: השווארמה הכי טובה בנתניה" /></label>
      <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-br-save${brand.busy ? " disabled" : ""}>${UI.esc(t("brSave"))}</button><span class="small" id="brMsg"></span></div>
    </div>`;
  brandPreview();
}
$("#spBrand").addEventListener("change", async e => {
  const inp = e.target.closest("[data-br]");
  if (!inp || !inp.files[0]) return;
  const logo = inp.dataset.br === "logo";
  try { brand[inp.dataset.br] = await cropPhoto(inp.files[0], logo ? 320 : 1200, logo ? 320 : 500, logo ? 150000 : 290000); }
  catch (ex) { return alert(t("ctPhotoErr")); }
  renderBrand(true);
});
$("#spBrand").addEventListener("input", e => { if (e.target.id === "brTagline") brandPreview(); });
$("#spBrand").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.brOff) { brand[b.dataset.brOff] = ""; return renderBrand(true); }
  if (b.dataset.brSave == null) return;
  const v = brandValues();
  brand.busy = true; b.disabled = true;
  try {
    const ok = await Store.saveShopBrand(state.dash.shop.token, { logo: brand.logo, cover: brand.cover, tagline: v.tagline });
    if (!ok) throw new Error("not_saved");
    const taglineHe = ($("#brTaglineHe") || {}).value || "";
    if (!(await Store.shopTextsHeSave(state.dash.shop.token, { tagline_he: taglineHe, about_he: state.dash.shop.about_he }))) throw new Error("not_saved");
    Object.assign(state.dash.shop, { logo: v.logo || null, cover: v.cover || null, tagline: v.tagline.trim() || null, tagline_he: taglineHe.trim() || null });
    brand.logo = undefined; brand.cover = undefined;
    brand.busy = false;
    renderBrand(true);
    $("#brMsg").textContent = t("brSaved");
  } catch (ex) { brand.busy = false; b.disabled = false; $("#brMsg").textContent = t("brErr"); }
});

// --- Ma page : photos de présentation (8 au plus) et message / promo aux clients qui viennent sur la page ---
const page = { gallery: null, shown: false, busy: false };
// Photo entière (pas recadrée), 1000 px au plus, légère
function galleryPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      for (const [max, q] of [[1000, 0.78], [860, 0.7], [720, 0.62], [560, 0.55]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", q);
        if (data.length < 290000) return resolve(data);
      }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
function renderPage(force) {
  const box = $("#spPage"), shop = state.dash.shop;
  box.classList.remove("hidden");
  if (page.shown && !force) return;
  page.shown = true;
  if (!page.gallery) page.gallery = (Array.isArray(shop.gallery) ? shop.gallery : []).filter(x => UI.safeImg(x));
  const g = page.gallery, promo = ($("#pgPromo") || {}).value, promoHe = ($("#pgPromoHe") || {}).value;
  box.innerHTML = `<h3>${UI.esc(t("pgTitle"))}</h3>
    <p class="muted small" style="margin:4px 0 10px">${UI.esc(t("pgSub"))}</p>
    <div class="pg-grid">${g.map((src, i) => `<figure><img src="${UI.safeImg(src)}" alt="" />
        <button type="button" class="pg-off" data-pg-off="${i}" aria-label="${UI.esc(t("brRemove"))}">✕</button></figure>`).join("")}
      ${g.length < 8 ? `<label class="pg-add"><span>📷</span><b>${UI.esc(t("pgAdd"))}</b><small>${g.length} / 8</small><input type="file" accept="image/*" multiple data-pg-add hidden /></label>` : ""}</div>
    <label class="f"><span>${UI.esc(t("pgPromo"))}</span><textarea id="pgPromo" rows="2" maxlength="300" placeholder="${UI.esc(t("pgPromoPh"))}">${UI.esc(promo != null ? promo : shop.promo || "")}</textarea></label>
    <label class="f"><span>${UI.esc(t("pgPromoHe"))}</span><textarea id="pgPromoHe" rows="2" maxlength="300" dir="rtl" lang="he" placeholder="לדוגמה: 10% הנחה על כל מארזי הלידה החודש">${UI.esc(promoHe != null ? promoHe : shop.promo_he || "")}</textarea></label>
    <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-pg-save${page.busy ? " disabled" : ""}>${UI.esc(t("pgSave"))}</button><span class="small" id="pgMsg"></span></div>`;
}
$("#spPage").addEventListener("change", async e => {
  const inp = e.target.closest("[data-pg-add]");
  if (!inp || !inp.files.length) return;
  for (const f of Array.from(inp.files).slice(0, 8 - page.gallery.length)) {
    try { page.gallery.push(await galleryPhoto(f)); } catch (ex) { alert(t("ctPhotoErr")); }
  }
  renderPage(true);
});
$("#spPage").addEventListener("click", async e => {
  const off = e.target.closest("[data-pg-off]");
  if (off) { page.gallery.splice(Number(off.dataset.pgOff), 1); return renderPage(true); }
  const b = e.target.closest("[data-pg-save]");
  if (!b) return;
  const promo = $("#pgPromo").value.trim(), promoHe = $("#pgPromoHe").value.trim();
  page.busy = true; b.disabled = true;
  try {
    if (!(await Store.shopPageSave(state.dash.shop.token, { gallery: page.gallery, promo, promo_he: promoHe }))) throw new Error("not_saved");
    Object.assign(state.dash.shop, { gallery: page.gallery.slice(), promo: promo || null, promo_he: promoHe || null });
    page.busy = false;
    renderPage(true);
    $("#pgMsg").textContent = t("pgSaved");
  } catch (ex) { page.busy = false; b.disabled = false; $("#pgMsg").textContent = t("brErr"); }
});

// --- Mes clients : ceux qui ont commandé chez lui avec HOP! (prénom seulement), et un message à tous ---------
const clients = { data: null, at: 0, open: false, msg: "", note: "" };
async function renderClients(force) {
  const box = $("#spClients"), shop = state.dash.shop;
  if (force || !clients.data || Date.now() - clients.at > 120000) {
    try { clients.data = await Store.shopClients(shop.token); clients.at = Date.now(); } catch (e) { clients.data = clients.data || { count: 0, list: [] }; }
  }
  const d = clients.data || { count: 0, list: [] }, n = Number(d.count) || 0;
  if (!clients.reviews || force) { try { clients.reviews = await Store.shopReviews(shop.code); } catch (e) { clients.reviews = clients.reviews || { count: 0, list: [] }; } }
  const rv = clients.reviews || { count: 0, list: [] };
  box.classList.remove("hidden");
  if (box.contains(document.activeElement)) return;   // (en train d'écrire : on ne redessine pas)
  const next = d.broadcast_at && new Date(new Date(d.broadcast_at).getTime() + 20 * 3600000);
  const wait = next && next > new Date();
  box.innerHTML = `<div class="sp-reviews"><h3>${UI.esc(t("spReviews"))}</h3>
    ${Number(rv.count) ? `<p class="sp-rev-avg"><b>${UI.esc(String(rv.avg).replace(".", ","))}</b> <span>${"★".repeat(Math.round(rv.avg))}</span> <small>${UI.esc(t("spReviewsAvg", { avg: String(rv.avg).replace(".", ","), n: rv.count }))}</small></p>
      ${(rv.list || []).map(v => `<div class="sh-rev"><b>${"★".repeat(v.stars)}<i>${"★".repeat(5 - v.stars)}</i></b><span>${v.note ? UI.esc(v.note) : ""}</span><small>${UI.esc(v.name || "")}${v.at ? " · " + UI.esc(UI.fmtDay(v.at)) : ""}</small></div>`).join("")}` : `<p class="muted small">${UI.esc(t("spReviewsNone"))}</p>`}</div>
    <h3>${UI.esc(t("clTitle", { n }))}</h3>
    <p class="muted small" style="margin:4px 0 10px">${UI.esc(t(n ? "clSub" : "clNone"))}</p>
    ${n ? `<label class="f"><textarea id="clMsg" rows="3" maxlength="300" placeholder="${UI.esc(t("clMsgPh"))}">${UI.esc(clients.msg)}</textarea></label>
      <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-cl-send${wait ? " disabled" : ""}>${UI.esc(t("clSend", { n }))}</button></div>
      ${wait ? `<p class="small muted">${UI.esc(t("clWait", { when: UI.fmtDateTime(next.toISOString()) }))}</p>` : ""}
      ${clients.note ? `<p class="small">${UI.esc(clients.note)}</p>` : ""}
      <details class="cl-list"${clients.open ? " open" : ""}><summary>${UI.esc(t("clMore"))}</summary>
        ${(d.list || []).map(c => `<div class="cl-row"><b>${UI.esc(c.name || "—")}</b><small>${UI.esc(t("clLast", { orders: c.orders, date: UI.fmtDay(c.last_at) }))}</small></div>`).join("")}</details>` : ""}`;
}
$("#spClients").addEventListener("input", e => { if (e.target.id === "clMsg") clients.msg = e.target.value; });
$("#spClients").addEventListener("toggle", e => { if (e.target.matches(".cl-list")) clients.open = e.target.open; }, true);
$("#spClients").addEventListener("click", async e => {
  const b = e.target.closest("[data-cl-send]");
  if (!b) return;
  const msg = ($("#clMsg") || {}).value || "";
  if (msg.trim().length < 5) return alert(t("clShort"));
  if (!confirm(t("clSend", { n: clients.data.count }) + " ?\n\n« " + msg.trim() + " »")) return;
  b.disabled = true;
  try {
    const n = await Store.shopBroadcast(state.dash.shop.token, msg.trim());
    clients.msg = ""; clients.note = t("clSent", { n });
  } catch (ex) { clients.note = /broadcast_wait/.test(ex.message || "") ? t("clWait", { when: "20 h" }) : t("spErr"); }
  b.blur();
  renderClients(true);
});

// --- Catalogue HOP! Pro : catégories et produits (photo, prix, disponible / épuisé) --------------
const cat = { data: null, edit: null, photo: undefined, busy: false, fresh: false };
async function loadCatalog() {
  try { cat.data = await Store.shopCatalogMine(state.dash.shop.token); } catch (e) { cat.data = cat.data || null; }
  renderCatalog();
}
// Photo réduite (480 px, JPEG) : légère pour les clients
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      for (const [max, q] of [[480, 0.72], [360, 0.62], [280, 0.55]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", q);
        if (data.length < 280000) return resolve(data);
      }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
function prodForm(p, catId) {
  const { categories } = cat.data;
  const photo = cat.photo !== undefined ? cat.photo : (p && p.photo) || "";
  return `<form class="ct-form" data-form="${UI.esc(p ? p.id : "new")}" action="javascript:void(0)">
    <div class="fields">
      <label class="f wide"><span>${UI.esc(t("ctName"))}</span><input name="name" maxlength="80" required value="${UI.esc(p ? p.name : "")}" /></label>
      <label class="f"><span>${UI.esc(t("ctPrice"))}</span><input name="price" inputmode="decimal" required value="${p ? UI.esc(String(p.price).replace(".", ",")) : ""}" placeholder="0" /></label>
      <label class="f"><span>${UI.esc(t("ctCat"))}</span><select name="category_id"><option value="">${UI.esc(t("ctLoose"))}</option>${categories.map(c =>
        `<option value="${UI.esc(c.id)}"${(p ? p.category_id : catId) === c.id ? " selected" : ""}>${UI.esc(c.name)}</option>`).join("")}</select></label>
      <label class="f wide"><span>${UI.esc(t("ctDesc"))}</span><textarea name="description" rows="2" maxlength="300">${UI.esc(p && p.description || "")}</textarea></label>
    </div>
    <div class="ct-photo">${photo ? `<img src="${UI.esc(photo)}" alt="" />` : `<span class="ct-nophoto">📷</span>`}
      <label class="btn btn-sm">${UI.esc(t(photo ? "ctPhotoChange" : "ctPhoto"))}<input type="file" accept="image/*" data-photo hidden /></label>
      ${photo ? `<button type="button" class="btn btn-sm btn-link" data-photo-off>${UI.esc(t("ctRemovePhoto"))}</button>` : ""}</div>
    <div class="btns" style="justify-content:flex-start">
      <button class="btn btn-primary" type="submit"${cat.busy ? " disabled" : ""}>${UI.esc(t("ctSave"))}</button>
      <button type="button" class="btn btn-link" data-cancel>${UI.esc(t("ctCancel"))}</button>
      ${p ? `<button type="button" class="btn btn-link danger" data-prod-del="${UI.esc(p.id)}">${UI.esc(t("ctDelete"))}</button>` : ""}
    </div>
  </form>`;
}
function prodRow(p, i, list) {
  if (cat.edit && cat.edit.id === p.id) return prodForm(p);
  // ▲ ▼ : le commerce range ses articles dans la catégorie (ce qu'il veut voir en haut, en premier)
  const n = list ? list.length : 1;
  const move = n > 1 ? `<span class="ct-move"><button type="button" data-move="-1" data-id="${UI.esc(p.id)}" aria-label="${UI.esc(t("ctUp"))}"${i === 0 ? " disabled" : ""}>▲</button><button type="button" data-move="1" data-id="${UI.esc(p.id)}" aria-label="${UI.esc(t("ctDown"))}"${i === n - 1 ? " disabled" : ""}>▼</button></span>` : "";
  // Comme le voit le client : l'image (ou l'illustration), le nom, le prix ; un interrupteur « en vente / épuisé »
  return `<div class="ct-prod${p.available ? "" : " off"}${move ? " has-move" : ""}">
    ${move}${UI.safeImg(p.photo) ? `<img src="${UI.safeImg(p.photo)}" alt="" />` : UI.itemArt(p.name, state.dash.shop.kind)}
    <button type="button" class="ct-info" data-edit="${UI.esc(p.id)}"><b>${UI.esc(p.name)}</b><span class="ct-price">${UI.money(p.price)}</span>${p.description ? `<small>${UI.esc(p.description)}</small>` : ""}</button>
    <button type="button" class="ct-switch${p.available ? " on" : ""}" role="switch" aria-checked="${p.available}" data-avail="${UI.esc(p.id)}"><i></i><small>${UI.esc(t(p.available ? (UI.isService(state.dash.shop) ? "ctAvailSvc" : "ctAvailShort") : (UI.isService(state.dash.shop) ? "ctOutSvc" : "ctOutShort")))}</small></button>
  </div>`;
}
function renderCatalog() {
  const box = $("#spCatalog"), shop = state.dash.shop;
  box.classList.toggle("hidden", !planOn(shop));
  if (!planOn(shop)) return;
  if (!cat.data) { box.innerHTML = `<h3>${UI.esc(t("ctTitle"))}</h3><p class="muted small">…</p>`; return; }
  const { categories, products } = cat.data;
  const groups = categories.map(c => ({ c, list: products.filter(p => p.category_id === c.id) }));
  const loose = products.filter(p => !categories.some(c => c.id === p.category_id));
  if (loose.length) groups.push({ c: { id: "", name: t("ctLoose") }, list: loose });
  const adding = c => cat.edit && !cat.edit.id && cat.edit.category_id === c.id;
  const sugg = CONFIG.partners.catalogCategories[shop.kind] || CONFIG.partners.catalogCategories.autre;
  // Un formulaire ouvert garde ce qui est déjà tapé quand la liste se redessine (photo, épuisé, rechargement)
  const open = box.querySelector("form.ct-form"), keep = open && !cat.fresh ? { id: open.dataset.form, vals: Object.fromEntries(new FormData(open)) } : null;
  cat.fresh = false;
  box.innerHTML = `<h3>${UI.esc(t("ctTitle"))}</h3>
    <p class="muted small" style="margin:4px 0 10px">${UI.esc(t("ctSub", { n: products.length, on: products.filter(p => p.available).length }))}</p>
    ${products.length > 1 ? `<p class="muted small" style="margin:-6px 0 10px">${UI.esc(t("ctMoveHint"))}</p>` : ""}
    ${!categories.length ? `<div class="notice" style="margin-bottom:10px">${UI.esc(t("ctStart"))}<br><button type="button" class="btn btn-primary btn-sm" data-suggest style="margin-top:8px">${UI.esc(t("ctSuggest", { list: sugg.map(x => x.split(" · ")[0]).join(", ") }))}</button></div>` : ""}
    ${groups.map(({ c, list }) => `<div class="ct-cat">
      <div class="ct-cat-head"><b>${UI.esc(c.name)}</b><small class="muted">${list.length}</small>
        ${c.id ? `<span><button type="button" class="btn btn-sm btn-link" data-cat-rename="${UI.esc(c.id)}">✏️</button><button type="button" class="btn btn-sm btn-link" data-cat-del="${UI.esc(c.id)}">🗑️</button></span>` : ""}</div>
      ${list.map(prodRow).join("")}
      ${adding(c) ? prodForm(null, c.id) : `<button type="button" class="btn btn-sm" data-add-prod="${UI.esc(c.id)}">${UI.esc(t("ctAddProd"))}</button>`}
    </div>`).join("")}
    ${!products.length && categories.length === 0 && adding({ id: "" }) ? prodForm(null, "") : ""}
    <div class="btns" style="justify-content:flex-start;margin-top:10px">
      <button type="button" class="btn btn-sm" data-add-cat>${UI.esc(t("ctAddCat"))}</button>
      ${!categories.length && !adding({ id: "" }) ? `<button type="button" class="btn btn-sm" data-add-prod="">${UI.esc(t("ctAddProd"))}</button>` : ""}
    </div>`;
  const g = box.querySelector("form.ct-form");
  if (keep && g && g.dataset.form === keep.id) Object.entries(keep.vals).forEach(([k, v]) => { if (g.elements[k] && typeof v === "string") g.elements[k].value = v; });
}
async function catalogDo(fn) {
  cat.busy = true;
  try { await fn(); } catch (e) { alert(/too_big|bad_image/.test(e.message || "") ? t("ctPhotoErr") : t("ctErr")); }
  cat.busy = false;
  await loadCatalog();
}
$("#spCatalog").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const token = state.dash.shop.token;
  if (b.dataset.suggest != null) {
    const sugg = CONFIG.partners.catalogCategories[state.dash.shop.kind] || CONFIG.partners.catalogCategories.autre;
    return catalogDo(async () => { for (let i = 0; i < sugg.length; i++) await Store.saveCategory(token, null, sugg[i], i + 1); });
  }
  if (b.dataset.addCat != null) {
    const name = (prompt(t("ctCatPh")) || "").trim();
    if (name) catalogDo(() => Store.saveCategory(token, null, name, cat.data.categories.length + 1));
    return;
  }
  if (b.dataset.catRename) {
    const c = cat.data.categories.find(x => x.id === b.dataset.catRename);
    const name = (prompt(t("ctCatPh"), c ? c.name : "") || "").trim();
    if (name) catalogDo(() => Store.saveCategory(token, c.id, name, c.position));
    return;
  }
  if (b.dataset.catDel) { if (confirm(t("ctDelCat"))) catalogDo(() => Store.deleteCategory(token, b.dataset.catDel)); return; }
  if (b.dataset.addProd != null) { cat.edit = { id: null, category_id: b.dataset.addProd }; cat.photo = undefined; cat.fresh = true; return renderCatalog(); }
  if (b.dataset.edit) { cat.edit = { id: b.dataset.edit }; cat.photo = undefined; cat.fresh = true; return renderCatalog(); }
  if (b.dataset.cancel != null) { cat.edit = null; cat.photo = undefined; return renderCatalog(); }
  if (b.dataset.photoOff != null) { cat.photo = ""; return renderCatalog(); }
  if (b.dataset.move) {
    // Nouvel ordre : les catégories dans l'ordre affiché, l'article échangé avec son voisin
    const { categories, products } = cat.data;
    const groups = categories.map(c => products.filter(p => p.category_id === c.id))
      .concat([products.filter(p => !categories.some(c => c.id === p.category_id))]);
    const g = groups.find(l => l.some(p => p.id === b.dataset.id));
    const i = g ? g.findIndex(p => p.id === b.dataset.id) : -1, j = i + Number(b.dataset.move);
    if (i < 0 || j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    const ids = groups.flat().map(p => p.id);
    cat.data.products = groups.flat();
    renderCatalog();
    return catalogDo(() => Store.orderProducts(token, ids));
  }
  if (b.dataset.avail) {
    const p = cat.data.products.find(x => x.id === b.dataset.avail);
    if (p) catalogDo(() => Store.setProductAvailable(token, p.id, !p.available));
    return;
  }
  if (b.dataset.prodDel) {
    if (confirm(t("ctConfirmDel"))) { cat.edit = null; catalogDo(() => Store.deleteProduct(token, b.dataset.prodDel)); }
  }
});
$("#spCatalog").addEventListener("change", async e => {
  if (!e.target.matches("[data-photo]") || !e.target.files[0]) return;
  try { cat.photo = await shrinkPhoto(e.target.files[0]); } catch (ex) { return alert(t("ctPhotoErr")); }
  renderCatalog();
});
$("#spCatalog").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, id = f.dataset.form === "new" ? null : f.dataset.form;
  const price = Number(String(f.elements.price.value).replace(",", "."));
  if (!f.elements.name.value.trim()) return f.elements.name.focus();
  if (!(price >= 0) || f.elements.price.value.trim() === "") return f.elements.price.focus();
  const p = { id, category_id: f.elements.category_id.value || null, name: f.elements.name.value, description: f.elements.description.value, price,
    photo: cat.photo === undefined ? null : cat.photo };
  if (!id) p.position = cat.data.products.length + 1;
  cat.edit = null;
  catalogDo(() => Store.saveProduct(state.dash.shop.token, p)).then(() => { cat.photo = undefined; });
});
setInterval(() => { if (state.dash && !document.hidden) refreshSpace(); }, 15000);
$("#spPay").addEventListener("change", async e => {
  if (e.target.name !== "client_pays" || !state.dash) return;
  const mode = { 0: "share", 1: "client", 2: "shop", 3: "ask" }[e.target.value], box = $("#spPay");
  box.dataset.busy = "1";
  try {
    if (!(await Store.setShopPayMode(state.dash.shop.token, mode))) throw new Error("no");
    Object.assign(state.dash.shop, { client_pays: mode !== "share", shop_pays: mode === "shop", pay_ask: mode === "ask" });
    box.dataset.note = t("paySaved");
  } catch (err) { box.dataset.note = t("payErr"); }
  delete box.dataset.busy;
  renderPay(); renderPlan(); renderGuide(state.dash.shop); renderBrand(true);
});
Store.getSettings().then(s => { state.settings = s; if (state.dash) renderPlan(); else renderLanding(); }).catch(() => {});

// Marche à suivre : ouverte aux premières visites (et quand le commerce passe à HOP! Pro), repliable ensuite
function renderGuide(shop) {
  const pro = planOn(shop);
  const st = Object.assign({ pro_monthly: CONFIG.pro.monthly, pro_shop_share: CONFIG.pro.shopShare, pro_hop_share: CONFIG.pro.hopShare }, state.settings || {});
  const client = UI.money(Math.max(0, CONFIG.pricing.fixedFromHome[CONFIG.homeCity] - (Number(st.pro_shop_share) - Number(st.pro_hop_share || 0))));
  const vars = { monthly: UI.money(st.pro_monthly), share: UI.money(st.pro_shop_share), phone: CONFIG.bitPhone, client, full: payVars().full,
    courier: UI.money(Number(st.pro_shop_share) - Number(st.pro_hop_share || 0)), hop: UI.money(st.pro_hop_share),
    n: CONFIG.partners.carnet.courses, price: UI.money(CONFIG.partners.carnet.price) };
  const keys = pro ? ["gdPro1", "gdPro2", "gdPro3", "gdPro4", "gdPro5", shop.client_pays ? "gdPro6c" : "gdPro6", "gdPro7"] : ["gdBase1", "gdBase2", CONFIG.partners.carnet.offered ? "gdBase3c" : "gdBase3", "gdBase4"];
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
// Onglet Vitrine : chaque carte se replie sur son titre (la ligne du titre est reprise dans le résumé)
// --- 📈 Mes ventes : le tableau de bord du commerce ------------------------------------------------------
const svc = { data: null, at: 0 };
async function renderStatsCard(force) {
  const box = $("#spStats"), shop = state.dash.shop;
  if (!shop) return;
  if (force || !svc.data || Date.now() - svc.at > 120000) {
    try { svc.data = await Store.shopStats(shop.token); svc.at = Date.now(); } catch (e) { svc.data = svc.data || null; }
  }
  const d = svc.data;
  box.classList.remove("hidden");
  if (!d) { box.innerHTML = `<h3>${UI.esc(t("svTitle"))}</h3><p class="muted small">${UI.esc(t("svNone"))}</p>`; foldTitles(); return; }
  const tile = (label, x) => `<div class="sv-tile"><small>${UI.esc(label)}</small><b dir="ltr">${UI.money(x.amount || 0)}</b><span>${UI.esc(t("svOrders", { n: x.n || 0 }))}</span></div>`;
  const days = d.days || [], maxD = Math.max(1, ...days.map(x => Number(x.n) || 0));
  const dayBars = days.length ? `<div class="sv-bars">${days.map(x => `<div class="sv-bar" title="${UI.esc(UI.fmtDay(x.d))} : ${x.n}"><i style="height:${Math.round(Number(x.n) * 100 / maxD)}%"></i><small>${new Date(x.d + "T12:00:00").getDate()}</small></div>`).join("")}</div>` : "";
  const hours = (d.hours || []).slice().sort((a, b) => Number(b.n) - Number(a.n)).slice(0, 3);
  const top = d.top || [];
  box.innerHTML = `<h3>${UI.esc(t("svTitle"))}</h3><p class="muted small" style="margin:4px 0 10px">${UI.esc(t("svSub"))}</p>
    ${Number((d.month || {}).n) ? `<div class="sv-tiles">${tile(t("svToday"), d.today || {})}${tile(t("svWeek"), d.week || {})}${tile(t("svMonth"), d.month || {})}</div>
      <div class="sv-grid">
        <div class="sv-box"><b>${UI.esc(t("svTop"))}</b>${top.length ? `<ol class="sv-top">${top.map(x => `<li><span>${UI.esc(UI.bi(x.name))}</span><small>${UI.esc(t("svQty", { n: x.qty }))} · ${UI.money(x.amount || 0)}</small></li>`).join("")}</ol>` : `<p class="muted small">${UI.esc(t("svTopNone"))}</p>`}</div>
        <div class="sv-box"><b>${UI.esc(t("svHours"))}</b>${hours.length ? `<p class="sv-hours">${hours.map(h => `<span>${String(h.h).padStart(2, "0")}h–${String(h.h + 1).padStart(2, "0")}h <small>· ${h.n}</small></span>`).join("")}</p>` : ""}
          ${d.basket != null ? `<b style="margin-top:8px">${UI.esc(t("svBasket"))}</b><p class="sv-basket" dir="ltr">${UI.money(d.basket)}</p>` : ""}</div>
      </div>
      ${dayBars ? `<b class="sv-h">${UI.esc(t("svDays"))}</b>${dayBars}` : ""}
      ${Number(d.clients90) ? `<p class="sv-clients">👥 <b>${UI.esc(t("svClients"))}</b> · ${UI.esc(t("svClientsSub", { r: d.repeat90 || 0, n: d.clients90 }))}</p>` : ""}`
    : `<p class="muted small">${UI.esc(t("svNone"))}</p>`}`;
  foldTitles();
}
function foldTitles() {
  document.querySelectorAll(".sp-fold").forEach(d => {
    const card = d.querySelector(".card"), h = card && card.querySelector("h3"), sum = d.querySelector("summary");
    d.classList.toggle("hidden", !card || card.classList.contains("hidden"));
    if (h && sum.textContent !== h.textContent) sum.textContent = h.textContent;
  });
}
function renderSpace() {
  const { shop, orders } = state.dash;
  renderGuide(shop);
  renderPrep();
  renderPlan();
  renderPay();
  renderBrand();
  renderPage();
  renderClients();
  renderStatsCard();
  const sales = state.dash.sales || [];
  renderHead(shop);
  renderTabs(shop);
  renderFiche();
  renderDrops();
  renderPayMeans();
  renderSend();
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
      ${C.offered ? `<div class="pro-best"><small>${UI.esc(t("shProCarnet", { n: C.courses }))}</small><b>${UI.money(C.price)}</b><s>${UI.money(CONFIG.pricing.fixedFromHome[home] * C.courses)}</s></div>` : ""}
      ${C.offered || left > 0 ? `<div><small>${UI.esc(t("shCarnetLeft"))}</small><b>🎟️ ${left}</b></div>` : ""}
    </div>
    ${C.offered ? `<p class="muted small" style="margin:10px 0">${UI.esc(t("shCarnetHow", { price: UI.money(C.price), phone: CONFIG.bitPhone, code: shop.code, n: C.courses }))}</p>` : ""}
    ${sales.length ? `<p class="small" style="margin:6px 0 10px">${UI.esc(t("shReceipts"))} ${sales.map(v =>
      `<a href="${UI.esc(UI.carnetReceiptUrl(v))}">🧾 ${UI.esc(t("shReceiptNo", { n: v.receipt_number }))}</a>`).join(" · ")}</p>` : ""}
    <div class="btns" style="justify-content:flex-start">
      ${C.offered ? `<button type="button" class="btn btn-wa" data-buy="1">${UI.esc(t("shCarnetBuy", { price: UI.money(C.price) }))}</button>` : ""}
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
        <small class="muted">${UI.esc(UI.fmtDateTime(o.pickup_at))} · ${UI.esc(t("orderNo", { ref: o.ref }))}</small>${sentLine(o)}</div>
      <div class="num"><span class="pill st-${UI.esc(o.status)}">${UI.esc(t("st_" + o.status))}</span><br><b>${UI.money(o.price)}</b>
        ${["nouvelle", "confirmee", "recuperee"].includes(o.status) ? `<br><a class="small" href="${UI.trackUrl(o)}${o.shop_sent ? "&shop=1" : ""}">${UI.esc(t("shTrack"))}</a>` : ""}</div>
    </div>`).join("") : `<p class="muted small">${UI.esc(t("shNoOrders"))}</p>`;
  foldTitles();
}

// Course envoyée par le commerce : qui paie ; « vous payez » → le Bit du livreur dès qu'il a pris la course
function sentLine(o) {
  if (!o.shop_sent) return "";
  const due = o.payer === "moi" && o.payment_method !== "cash" && o.payment_status !== "paye" && o.courier_bit && ["confirmee", "recuperee"].includes(o.status);
  const bit = String(o.courier_bit || "").replace(/\D/g, "");
  return `<small class="sd-who">${UI.esc(t(o.payer === "moi" ? "sdByYou" : "sdByClient"))}</small>`
    + (due ? `<span class="sd-due">${UI.esc(t("sdPayDue", { price: UI.money(o.price), name: String(o.courier_name || "").split(" ")[0], phone: bit }))}
      <button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(bit)}">${UI.esc(t("bpCopy"))}</button></span>` : "");
}

// --- Ma fiche pour les clients : WhatsApp, présentation, horaires (comme le patron, en libre-service) ---------
const fiche = { shown: false, busy: false };
function renderFiche(force) {
  const box = $("#spFiche"), shop = state.dash.shop;
  if (fiche.shown && !force) return;
  fiche.shown = true;
  const hours = shop.hours || [];
  box.innerHTML = `<h3>${UI.esc(t("fiTitle"))}</h3>
    <p class="muted small" style="margin:4px 0 12px">${UI.esc(t("fiSub"))}</p>
    <label class="f"><span>${UI.esc(t("fiWa"))}</span><input id="fiWa" inputmode="tel" dir="ltr" placeholder="053-373-3785" value="${UI.esc(shop.whatsapp ? "0" + String(shop.whatsapp).replace(/^972/, "") : "")}" /></label>
    <label class="f" style="margin-top:10px"><span>${UI.esc(t("fiAbout"))}</span><textarea id="fiAbout" rows="3" maxlength="600" placeholder="${UI.esc(t("fiAboutPh"))}">${UI.esc(shop.about || "")}</textarea></label>
    <label class="f" style="margin-top:10px"><span>${UI.esc(t("fiAboutHe"))}</span><textarea id="fiAboutHe" rows="3" maxlength="600" dir="rtl" lang="he" placeholder="מה אתם עושים, ההתמחויות שלכם, ממתי…">${UI.esc(shop.about_he || "")}</textarea></label>
    ${UI.hoursEditor(hours)}
    <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-fi-save${fiche.busy ? " disabled" : ""}>${UI.esc(t("fiSave"))}</button><span class="small" id="fiMsg"></span></div>`;
}
UI.bindHours($("#spFiche"));
$("#spFiche").addEventListener("click", async e => {
  const b = e.target.closest("[data-fi-save]");
  if (!b) return;
  const msg = $("#fiMsg");
  const hours = UI.readHours($("#spFiche"));
  const wa = $("#fiWa").value.replace(/\D/g, "");
  if (wa && !/^(0\d{8,9}|972\d{8,9})$/.test(wa)) { msg.textContent = t("fiWaBad"); $("#fiWa").focus(); return; }
  fiche.busy = true; b.disabled = true;
  try {
    if (!(await Store.shopFicheSave(state.dash.shop.token, { whatsapp: wa, about: $("#fiAbout").value, hours }))) throw new Error("not_saved");
    if (!(await Store.shopTextsHeSave(state.dash.shop.token, { tagline_he: state.dash.shop.tagline_he, about_he: $("#fiAboutHe").value }))) throw new Error("not_saved");
    state.dash.shop.about_he = $("#fiAboutHe").value.trim() || null;
    Object.assign(state.dash.shop, { whatsapp: wa ? (wa.startsWith("0") ? "972" + wa.slice(1) : wa) : null, about: $("#fiAbout").value.trim() || null, hours: hours.some(h => h.h) ? hours : null });
    fiche.busy = false; renderFiche(true); renderHead(state.dash.shop);
    $("#fiMsg").textContent = t("fiSaved");
  } catch (ex) { fiche.busy = false; b.disabled = false; msg.textContent = t(/bad_hours/.test(ex.message || "") ? "fiHoursBad" : "brErr"); }
});

// --- Comment les clients paient le commerce : son lien de paiement et / ou son Bit (articles payés avant la préparation) ---
const payMeans = { shown: false };
function renderPayMeans(force) {
  const box = $("#spPayMeans"), shop = state.dash.shop;
  if (payMeans.shown && !force) return;
  payMeans.shown = true;
  box.innerHTML = `<h3>${UI.esc(t("spPayTitle"))}</h3><p class="muted small" style="margin:4px 0 10px">${UI.esc(t("spPaySub"))}</p>
    <div class="pm-step"><b>${UI.esc(t("spPayStep1"))}</b>
      <input id="pmBit" inputmode="tel" dir="ltr" placeholder="053-373-3785" aria-label="${UI.esc(t("spPayBit"))}" value="${UI.esc(shop.pay_bit || "")}" /></div>
    <div class="pm-step"><b>${UI.esc(t("spPayStep2"))}</b>
      <small class="muted">${UI.esc(t("spPayHow"))}</small>
      <div class="pm-link"><input id="pmLink" type="url" inputmode="url" dir="ltr" placeholder="https://" aria-label="${UI.esc(t("spPayLink"))}" value="${UI.esc(shop.pay_link || "")}" />
        <button type="button" class="btn btn-sm" data-pm-paste>${UI.esc(t("spPayPaste"))}</button></div>
      <button type="button" class="btn btn-sm pm-test${shop.pay_link ? "" : " hidden"}" data-pm-test>${UI.esc(t("spPayTest"))}</button></div>
    <p class="small muted">${UI.esc(t("spPayCash"))}</p>
    <div class="pm-preview"><small>${UI.esc(t("spPayPreview"))}</small><div id="pmPreview"></div></div>
    <div class="btns" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-pm-save>${UI.esc(t("spPaySave"))}</button><span class="small" id="pmMsg"></span></div>`;
  payPreview();
}
// Aperçu en direct : les mêmes boutons que ceux du client
function payPreview() {
  const link = /^https:\/\/\S{4,250}$/.test($("#pmLink").value.trim()) ? $("#pmLink").value.trim() : "", bit = $("#pmBit").value.replace(/\D/g, "");
  $("#pmPreview").innerHTML = link || bit.length >= 9 ? UI.goodsPay({ goods_pay: "a_payer", items_total: 85, token: "apercu" }, { name: state.dash.shop.name, link, bit })
    : `<p class="small muted">${UI.esc(t("spPayNothing"))}</p>`;
  $("#spPayMeans .pm-test").classList.toggle("hidden", !link);
}
$("#spPayMeans").addEventListener("input", () => payPreview());
$("#spPayMeans").addEventListener("click", async e => {
  if (e.target.closest("#pmPreview")) { e.preventDefault(); e.stopPropagation(); return; }   // l'aperçu ne paie rien
  if (e.target.closest("[data-pm-paste]")) {
    const v = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText().catch(() => "") : "";
    if (v) { $("#pmLink").value = v.trim(); payPreview(); } else $("#pmLink").focus();
    return;
  }
  if (e.target.closest("[data-pm-test]")) { window.open($("#pmLink").value.trim(), "_blank", "noopener"); return; }
  const b = e.target.closest("[data-pm-save]");
  if (!b) return;
  const link = $("#pmLink").value.trim(), bit = $("#pmBit").value.replace(/\D/g, ""), msg = $("#pmMsg");
  if (link && !/^https:\/\/\S{4,250}$/.test(link)) { msg.textContent = t("spPayErrLink"); return $("#pmLink").focus(); }
  if (bit && !/^(0\d{8,9}|972\d{8,9})$/.test(bit)) { msg.textContent = t("spPayErrBit"); return $("#pmBit").focus(); }
  b.disabled = true;
  try {
    if (!(await Store.shopPaySave(state.dash.shop.token, link, bit))) throw new Error("no");
    Object.assign(state.dash.shop, { pay_link: link || null, pay_bit: bit ? (bit.startsWith("972") ? "0" + bit.slice(3) : bit) : null });
    renderPayMeans(true);
    $("#pmMsg").textContent = t("spPaySaved");
  } catch (ex) { b.disabled = false; msg.textContent = t(/bad_link/.test(ex.message || "") ? "spPayErrLink" : /bad_bit/.test(ex.message || "") ? "spPayErrBit" : "brErr"); }
});

// --- « C'est prêt » : le commerce prévient ses clients qui lui ont envoyé quelque chose (vêtements au pressing…) ---
const dropForm = {};   // commande → formulaire ouvert
function renderDrops(force) {
  const box = $("#spDrops"), list = state.dash.drops || [];
  box.classList.toggle("hidden", !list.length);
  // Un avis en cours d'écriture n'est jamais effacé par le rafraîchissement automatique
  if (!list.length || !force && box.querySelector("form")) return;
  // Par défaut : demain 10:00, ou la prochaine ouverture du commerce si ce jour-là il est fermé (chabbat…)
  let d1 = new Date(Date.now() + 86400000); d1.setHours(10, 0, 0, 0);
  const o = UI.nextOpenDate(UI.openState(state.dash.shop.hours, d1), d1);
  if (o) d1 = o;
  const day = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, "0")}-${String(d1.getDate()).padStart(2, "0")}`;
  const hm = `${String(d1.getHours()).padStart(2, "0")}:${String(d1.getMinutes()).padStart(2, "0")}`;
  const msg0 = t(state.dash.shop.kind === "pressing" ? "drMsgPressing" : "drMsgOther");
  box.innerHTML = `<h3>${UI.esc(t("drTitle"))}</h3><p class="muted small" style="margin:4px 0 10px">${UI.esc(t("drSub"))}</p>
    ${list.map(o => `<div class="drop-row">
      <div class="drop-head"><b>${UI.esc(o.first_name || "?")}</b><small class="muted">${UI.esc(UI.fmtDateTime(o.pickup_at || o.created_at))} · ${UI.esc(t("orderNo", { ref: o.ref }))}</small>
        ${o.notice_at ? `<span class="pill paid">✅ ${UI.esc(t("drSent", { when: UI.fmtDateTime(o.notice_at) }))}</span>` : ""}</div>
      ${o.notes ? `<p class="drop-notes">${UI.esc(o.notes)}</p>` : ""}
      ${dropForm[o.id] ? `<form class="drop-form" data-drop="${UI.esc(o.id)}" action="javascript:void(0)">
          <div class="fields"><label class="f"><span>${UI.esc(t("drDay"))}</span><input type="date" name="day" value="${day}" /></label>
          <label class="f"><span>${UI.esc(t("drTime"))}</span><input type="time" name="time" step="900" value="${hm}" /></label>
          <label class="f full"><span>${UI.esc(t("drMsg"))}</span><input name="msg" maxlength="300" value="${UI.esc(msg0)}" /></label></div>
          <div class="btns" style="justify-content:flex-start"><button class="btn btn-primary" type="submit">${UI.esc(t("drSend"))}</button><button type="button" class="btn btn-link" data-drop-cancel="${UI.esc(o.id)}">${UI.esc(t("ctCancel"))}</button></div>
        </form>`
        : Number(o.notices) < 3 ? `<button type="button" class="btn btn-sm${o.notice_at ? "" : " btn-primary"}" data-drop-open="${UI.esc(o.id)}">🔔 ${UI.esc(t(o.notice_at ? "drAgain" : "drReady"))}</button>` : ""}
    </div>`).join("")}`;
}
$("#spDrops").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.dropOpen) { dropForm[b.dataset.dropOpen] = true; renderDrops(true); const f = $(`#spDrops form[data-drop="${b.dataset.dropOpen}"]`); if (f) f.elements.time.focus(); }
  if (b.dataset.dropCancel) { delete dropForm[b.dataset.dropCancel]; renderDrops(true); }
});
$("#spDrops").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, id = f.dataset.drop;
  const at = f.elements.day.value && f.elements.time.value ? new Date(`${f.elements.day.value}T${f.elements.time.value}`) : null;
  try {
    if (!(await Store.shopNoticeSend(state.dash.shop.token, id, at ? at.toISOString() : null, f.elements.msg.value))) throw new Error("no");
    delete dropForm[id];
    alert(t("drOk"));
    await refreshSpace();
    renderDrops(true);
  } catch (ex) { alert(t(/notice_max/.test(ex.message || "") ? "drMax" : /bad_date/.test(ex.message || "") ? "drBadDate" : "spErr")); }
});

// En-tête : la vitrine du commerce telle que la voient ses clients, avec son abonnement
function renderHead(shop) {
  const cover = UI.safeImg(shop.cover) || UI.demoImg(shop, "cover"), logo = UI.safeImg(shop.logo) || UI.demoImg(shop, "logo"), kinds = t("shKinds") || {};
  const initials = String(shop.name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const chip = planOn(shop) ? t("spPlanOn", { date: UI.fmtKey(shop.plan_until) }) : shop.status === "actif" ? t("shActive") : t("shPending");
  const html = `<div class="sh-cover pk-${UI.esc(shop.kind || "autre")}"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${UI.KIND_ICON[shop.kind] || "🏪"}</i>`}</div>
    <div class="sh-row"><span class="pc-logo sh-logo">${logo ? `<img src="${logo}" alt="" />` : UI.esc(initials)}</span>
      <div class="sh-txt"><small class="sp-hello">${UI.esc(t("spHello"))}</small><b>${UI.esc(shop.name)}</b><small>${UI.esc(shop.tagline || kinds[shop.kind] || "")}</small></div></div>
    <p class="sp-chip${planOn(shop) ? " pro" : ""}">${UI.esc(chip)}</p>`;
  const box = $("#spHeadTop");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
// Onglets : Commandes · Catalogue · Vitrine · Compte (le dernier choisi est gardé sur cet appareil)
const TAB_KEY = "livraison.shopTab";
let spTab = (() => { try { return localStorage.getItem(TAB_KEY) || "orders"; } catch (e) { return "orders"; } })();
let lastWaiting = 0;
function renderTabs(shop) {
  const pro = planOn(shop);
  const waiting = state.dash.orders.filter(o => o.shop_status === "attente" && ["nouvelle", "confirmee"].includes(o.status)).length;
  // Une nouvelle commande arrive : on revient sur « Commandes »
  if (waiting > lastWaiting) spTab = "orders";
  lastWaiting = waiting;
  $("#spTabs [data-sp-tab=catalog]").classList.toggle("hidden", !pro);
  if (!pro && spTab === "catalog") spTab = "orders";
  $("#spTabs").querySelectorAll("[data-sp-tab]").forEach(b => { b.classList.toggle("on", b.dataset.spTab === spTab); b.setAttribute("aria-selected", b.dataset.spTab === spTab); });
  document.querySelectorAll("[data-sp-pane]").forEach(p => p.classList.toggle("hidden", p.dataset.spPane !== spTab));
  $("#spBadge").textContent = waiting;
  $("#spBadge").classList.toggle("hidden", !waiting);
}
$("#spTabs").addEventListener("click", e => {
  const b = e.target.closest("[data-sp-tab]");
  if (!b || !state.dash) return;
  spTab = b.dataset.spTab;
  try { localStorage.setItem(TAB_KEY, spTab); } catch (ex) { /* ignore */ }
  renderTabs(state.dash.shop);
  const top = $("#spTabs").getBoundingClientRect().top + scrollY - 60;
  if (scrollY > top) scrollTo({ top, behavior: "smooth" });
});

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

// Espaces déjà gardés sur ce téléphone, proposés au-dessus du formulaire d'inscription
function showKnownShops() {
  const shops = Store.myShops();
  const box = $("#shopHave");
  box.classList.toggle("hidden", !shops.length);
  box.innerHTML = shops.length ? `<span>${UI.esc(t("shHave"))}</span> ` + shops.map(x =>
    `<a class="btn btn-sm" href="commerce.html?k=${encodeURIComponent(x.token)}">${UI.esc(t("shHaveOpen", { code: x.code || "…" }))}</a>`).join(" ") : "";
}
$("#spOther").addEventListener("click", e => {
  if (e.target.closest("[data-forget]")) {
    if (!confirm(t("shForgetAsk"))) return;
    Store.forgetShopToken(state.token);
    location.href = "commerce.html?inscription=1";
  }
});

// --- « Envoyer une course » : le client a acheté et payé au magasin, HOP! lui livre -----------
// Tout ce qu'il faut au livreur est obligatoire (nom, téléphone, rue et numéro, étage, appartement, heure, qui paie) ;
// départ = le commerce (la base le reprend de sa fiche). La course se paie au livreur par Bit : le commerce
// quand il prend le colis, ou le client à la livraison.
const send = { pick: null, ac: null, ready: "0", payer: "", how: "", done: null, busy: false };
const SEND_KEYS = ["name", "phone", "street", "city", "floor", "apt", "code", "note", "at"];
// Quartier hors centre (Agamim, zones industrielles) : pourquoi ce prix
function sendAreaWhy() {
  const shop = state.dash.shop, f = $("#spSend");
  const to = (f.elements.city && f.elements.city.value) || shop.city || CONFIG.homeCity;
  return UI.areaWhy({ from_city: shop.city || CONFIG.homeCity, to_city: to, pickup_lat: shop.lat, pickup_lon: shop.lon,
    dropoff_lat: send.pick ? send.pick.lat : null, dropoff_lon: send.pick ? send.pick.lon : null, price: sendPrice() });
}
function sendPrice() {
  const shop = state.dash.shop, f = $("#spSend");
  const to = (f.elements.city && f.elements.city.value) || shop.city || CONFIG.homeCity;
  const from = shop.lat != null ? { lat: Number(shop.lat), lon: Number(shop.lon) } : null;
  const toPt = send.pick && send.pick.lat != null ? { lat: send.pick.lat, lon: send.pick.lon } : null;
  return Pricing.computeQuote({ fromCity: shop.city || CONFIG.homeCity, toCity: to, service: "colis", size: "petit", fromPoint: from, toPoint: toPt }, CONFIG).total;
}
function sendVals() {
  const f = $("#spSend"), v = {};
  SEND_KEYS.forEach(k => { if (f.elements[k]) v[k] = f.elements[k].value; });
  return v;
}
// full : redessiner le formulaire (ouverture, langue) ; sinon seulement la ligne sous le bouton (rafraîchissements)
function renderSend(full) {
  const f = $("#spSend"), shop = state.dash && state.dash.shop;
  if (!shop) return;
  $("#spOrderSub").textContent = t("shOrderSub", { price: UI.money(CONFIG.pricing.fixedFromHome[shop.city] || CONFIG.pricing.base), city: I18N.cityName(shop.city || CONFIG.homeCity) });
  if (!full || f.classList.contains("hidden")) return;
  const e = UI.esc;
  if (send.done) {
    const o = send.done, first = String(o.dropoff_contact || "").split(" ")[0];
    const when = o.ready ? t("sdWhenAt", { time: UI.fmtTime(o.pickup_at) }) : t("sdWhenNow");
    f.innerHTML = `<p class="sd-done">${e(t("sdDone", { ref: o.ref, when }))}</p>
      <p class="sd-pay">${e(t(o.payer === "moi" ? "sdDoneShop" : "sdDoneClient", { price: UI.money(o.price), how: t(o.payment_method === "cash" ? "sdHowCashW" : "sdHowBitW") }))}</p>
      <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${e(UI.waLink(o.dropoff_phone, t("sdShareMsg", { name: first, shop: shop.name, url: UI.trackUrl(o) })))}">${e(t("sdShareWa"))}</a>
      <div class="sd-done-btns"><a class="btn" href="${e(UI.trackUrl(o) + "&shop=1")}">${e(t("shTrack"))}</a>
        <button type="button" class="btn btn-primary" data-sd-new>${e(t("sdAnother"))}</button></div>`;
    return;
  }
  const v = sendVals();
  const city = v.city || shop.city || CONFIG.homeCity, price = UI.money(sendPrice());
  const fld = (k, label, attrs, cls) => `<label class="f${cls ? " " + cls : ""}"><span>${e(t(label))}</span><input name="${k}" ${attrs || ""} value="${e(v[k] || "")}" /></label>`;
  const ready = (val, label) => `<label class="choice"><input type="radio" name="ready" value="${val}"${send.ready === val ? " checked" : ""} /><span><b>${e(label)}</b></span></label>`;
  const how = (val, k) => `<label class="choice"><input type="radio" name="how" value="${val}"${send.how === val ? " checked" : ""} /><span><b>${e(t(k))}</b></span></label>`;
  const payer = (val, k) => `<label class="choice"><input type="radio" name="payer" value="${val}"${send.payer === val ? " checked" : ""} /><span><b>${e(t(k))}</b><small>${e(t(k + "D", { price }))}</small></span></label>`;
  f.innerHTML = `<div class="sd-head"><h3>${e(t("sdTitle"))}</h3><button type="button" class="btn btn-sm btn-link" data-sd-close>${e(t("sdClose"))}</button></div>
    <p class="muted small sd-sub">${e(t("sdSub"))}</p>
    <p class="sd-req">${e(t("sdReq"))}</p>
    <div class="sd-grid sd-two">
      ${fld("name", "sdName", 'required autocomplete="off" maxlength="60"')}
      ${fld("phone", "sdPhone", 'type="tel" inputmode="tel" required autocomplete="off" dir="ltr" placeholder="05X-XXX-XXXX"')}
    </div>
    ${fld("street", "sdStreet", `required autocomplete="off" placeholder="${e(t("sdStreetPh"))}"`)}
    <label class="f"><span>${e(t("sdCity"))}</span><select name="city">${CONFIG.cities.map(c => `<option value="${e(c.id)}"${c.id === city ? " selected" : ""}>${e(I18N.cityName(c.id))}</option>`).join("")}</select></label>
    <div class="sd-grid sd-three">
      ${fld("floor", "sdFloor", 'required inputmode="numeric" maxlength="10"')}
      ${fld("apt", "sdApt", 'required maxlength="10"')}
      ${fld("code", "sdCode", 'maxlength="20" dir="ltr"')}
    </div>
    ${fld("note", "sdNote", `maxlength="200" placeholder="${e(t("sdNotePh"))}"`)}
    <div class="sd-block"><b class="sd-label">${e(t("sdReady"))}</b>
      <div class="choices sd-ready">${ready("0", t("sdNow"))}${ready("15", t("sdIn", { n: 15 }))}${ready("30", t("sdIn", { n: 30 }))}${ready("at", t("sdAt"))}</div>
      <label class="f sd-at${send.ready === "at" ? "" : " hidden"}"><span>${e(t("sdAtLabel"))}</span><input type="time" name="at" value="${e(v.at || "")}" dir="ltr" /></label>
    </div>
    <div class="sd-block"><b class="sd-label">${e(t("sdPayer"))}</b>
      <div class="choices sd-payer">${payer("destinataire", "sdPayClient")}${payer("moi", "sdPayShop")}</div>
    </div>
    <div class="sd-block"><b class="sd-label">${e(t("sdHow"))}</b>
      <div class="choices sd-how">${how("cash", "sdHowCash")}${how("bit", "sdHowBit")}</div>
    </div>
    <p class="area-why-note${sendAreaWhy() ? "" : " hidden"}" id="sdArea">${e(sendAreaWhy())}</p>
    <p class="sd-goods">✓ ${e(t("sdGoods"))}</p>
    <p class="notice err hidden" id="sdErr"></p>
    <button class="btn btn-primary btn-lg btn-block sd-go" id="sdGo">${e(t("sdGo", { price }))}</button>
    <p class="muted small sd-wa">${e(t("sdWa", { phone: CONFIG.phoneDisplay }))}</p>`;
  if (send.ac && send.ac.destroy) send.ac.destroy();
  send.ac = Places.attach(f.elements.street, {
    lang: () => I18N.lang, texts: () => ({ none: t("addrNone"), down: t("addrDown") }),
    onPick: p => {
      send.pick = p;
      f.elements.street.value = [p.streetName || p.street || "", p.housenumber || ""].join(" ").trim();
      if (send.ac) send.ac.setPicked(f.elements.street.value);
      if (p.cityId && CONFIG.cities.some(c => c.id === p.cityId)) f.elements.city.value = p.cityId;
      sendRefreshPrice();
      (p.housenumber ? f.elements.floor : f.elements.street).focus();
    },
    onClear: () => { send.pick = null; sendRefreshPrice(); }
  });
}
function sendRefreshPrice() {
  const price = UI.money(sendPrice()), why = sendAreaWhy();
  $("#sdArea").textContent = why;
  $("#sdArea").classList.toggle("hidden", !why);
  $("#sdGo").textContent = t("sdGo", { price });
  document.querySelectorAll("#spSend .sd-payer .choice").forEach(c => {
    const k = c.querySelector("input").value === "moi" ? "sdPayShop" : "sdPayClient";
    c.querySelector("small").textContent = t(k + "D", { price });
  });
}
function sendErr(msg, el) {
  const box = $("#sdErr");
  box.textContent = msg || "";
  box.classList.toggle("hidden", !msg);
  if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
}
async function sendSubmit() {
  if (send.busy) return;
  const f = $("#spSend"), shop = state.dash.shop, v = sendVals();
  f.querySelectorAll(".field-bad").forEach(x => x.classList.remove("field-bad"));
  const need = ["name", "phone", "street", "floor", "apt"].filter(k => !String(v[k] || "").trim());
  if (send.ready === "at" && !v.at) need.push("at");
  need.forEach(k => f.elements[k].classList.add("field-bad"));
  if (need.length) return sendErr(t("sdErrMissing"), f.elements[need[0]]);
  if (!phoneOk(v.phone)) { f.elements.phone.classList.add("field-bad"); return sendErr(t("sdErrPhone"), f.elements.phone); }
  if (!send.payer) { f.querySelector(".sd-payer").classList.add("field-bad"); return sendErr(t("sdErrPayer"), f.querySelector(".sd-payer input")); }
  if (!send.how) { f.querySelector(".sd-how").classList.add("field-bad"); return sendErr(t("sdErrHow"), f.querySelector(".sd-how input")); }
  let at = new Date();
  if (send.ready === "15" || send.ready === "30") at = new Date(Date.now() + Number(send.ready) * 60000);
  if (send.ready === "at") {
    const [h, m] = v.at.split(":").map(Number);
    at = new Date(); at.setHours(h, m, 0, 0);
    if (at < Date.now() - 60000) at.setDate(at.getDate() + 1);
    if (at - Date.now() > 3 * 3600000) { f.elements.at.classList.add("field-bad"); return sendErr(t("sdErrAt"), f.elements.at); }
  }
  sendErr("");
  send.busy = true;
  const btn = $("#sdGo");
  btn.disabled = true;
  btn.textContent = t("sdSending");
  try {
    const city = Pricing.cityById(CONFIG, v.city);
    let pt = send.pick && send.pick.lat != null ? { lat: send.pick.lat, lon: send.pick.lon, exact: !!send.pick.housenumber } : null;
    if (!pt) {
      const g = await Pricing.geocode(`${v.street.trim()}, ${city ? city.fr : ""}`, CONFIG.countryCode, 3000).catch(() => null);
      if (g) pt = { lat: g.lat, lon: g.lon, exact: false };
    }
    const saved = await Store.createOrder({
      service: "colis", urgency: "asap", size: "petit", lang: I18N.lang,
      shop_sent: true, send_key: state.token, shop_id: shop.id,
      from_city: shop.city || CONFIG.homeCity, to_city: v.city,
      pickup_at: at.toISOString(), pickup_address: shop.address, pickup_lat: shop.lat, pickup_lon: shop.lon,
      pickup_contact: shop.name, pickup_phone: shop.phone,
      dropoff_address: v.street.trim(), dropoff_lat: pt ? pt.lat : null, dropoff_lon: pt ? pt.lon : null, dropoff_exact: !!(pt && pt.exact),
      dropoff_floor: v.floor.trim(), dropoff_apt: v.apt.trim(), dropoff_code: v.code.trim() || null,
      dropoff_note: v.note.trim() || null, dropoff_contact: v.name.trim(), dropoff_phone: phoneDigits(v.phone),
      contact_name: shop.name, contact_phone: shop.phone,
      price: sendPrice(), discount: 0, payment_method: send.how, payer: send.payer, distance_km: null
    });
    send.done = Object.assign({}, saved, { ready: send.ready !== "0", price: saved.price || sendPrice() });
    send.pick = null; send.ready = "0"; send.payer = ""; send.how = "";
    f.reset();
    renderSend(true);
    f.scrollIntoView({ block: "start", behavior: "smooth" });
    refreshSpace().catch(() => {});
  } catch (ex) {
    sendErr(/send_fields/.test(ex.message) ? t("sdErrMissing") : t("sdErrSend", { phone: CONFIG.phoneDisplay }));
  } finally {
    send.busy = false;
    if (!send.done) { btn.disabled = false; btn.textContent = t("sdGo", { price: UI.money(sendPrice()) }); }
  }
}
$("#spOrder").addEventListener("click", () => {
  const f = $("#spSend");
  send.done = null;
  f.classList.remove("hidden");
  renderSend(true);
  f.scrollIntoView({ block: "start", behavior: "smooth" });
  setTimeout(() => f.elements.name && f.elements.name.focus({ preventScroll: true }), 350);
});
$("#spSend").addEventListener("click", e => {
  if (e.target.closest("[data-sd-close]")) { $("#spSend").classList.add("hidden"); send.done = null; return; }
  if (e.target.closest("[data-sd-new]")) { send.done = null; renderSend(true); $("#spSend").elements.name.focus(); return; }
  if (e.target.closest("#sdGo")) { e.preventDefault(); sendSubmit(); }
});
$("#spSend").addEventListener("change", e => {
  const f = $("#spSend");
  if (e.target.name === "ready") {
    send.ready = e.target.value;
    f.querySelector(".sd-at").classList.toggle("hidden", send.ready !== "at");
    if (send.ready === "at") f.elements.at.focus();
  }
  if (e.target.name === "payer") { send.payer = e.target.value; f.querySelector(".sd-payer").classList.remove("field-bad"); }
  if (e.target.name === "how") { send.how = e.target.value; f.querySelector(".sd-how").classList.remove("field-bad"); }
  if (e.target.name === "city") sendRefreshPrice();
});
$("#spSend").addEventListener("input", e => { if (e.target.classList.contains("field-bad") && e.target.value.trim()) e.target.classList.remove("field-bad"); });
$("#spSend").addEventListener("submit", e => { e.preventDefault(); sendSubmit(); });

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
$("#langBtn").addEventListener("click", () => { I18N.setLang(I18N.other()); renderStatic(); renderSend(true); });
$("#spCopy").addEventListener("click", () => {
  if (navigator.clipboard) navigator.clipboard.writeText($("#spLink").value).then(() => { $("#spCopy").textContent = t("shCopied"); }, () => {});
});
$("#spPrint").addEventListener("click", () => { document.body.classList.add("print-poster"); window.print(); document.body.classList.remove("print-poster"); });

// Clé secrète dans l'adresse (lien envoyé au commerce), sinon celle gardée sur cet appareil
// Démo (commerce.html?demo=resto) : l'espace d'un commerce d'exemple, tout sur ce téléphone, rien n'est envoyé
if (Store.sandbox) {
  const bar = document.createElement("div");
  bar.className = "sandbox-bar";
  bar.innerHTML = `<span>🎬 ${UI.esc(t("sbText"))}</span><button type="button" class="btn btn-sm" data-sb-reset>${UI.esc(t("sbReset"))}</button>`;
  document.body.prepend(bar);
  bar.addEventListener("click", e => { if (e.target.closest("[data-sb-reset]")) { Store.sandboxReset(); location.reload(); } });
  Store.sandboxSeed(params.get("demo")).then(openSpace, () => $("#shopGone").classList.remove("hidden"));
} else {
  // Lien « Inscrire mon commerce » (?inscription=1) : toujours le formulaire, même si un espace est gardé ici
  const signupAsked = !!ref || params.has("inscription");
  const key = params.get("k") || (signupAsked ? null : Store.myShopTokens()[0]);
  if (key) openSpace(key);
  else { $("#shopSignup").classList.remove("hidden"); showKnownShops(); }
}

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
