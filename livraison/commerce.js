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
  if (on && !ring.timer) { ringOnce(); ring.timer = setInterval(ringOnce, 3000); }
  if (!on && ring.timer) { clearInterval(ring.timer); ring.timer = null; }
}
// N° de commande tapé mais pas encore validé : gardé quand l'écran se rafraîchit
const refDraft = {};
// Articles déjà mis dans le sac (cochés par le commerce sur ce téléphone)
const picked = {};
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
      ${Array.isArray(o.items) && o.items.length
        ? `<ul class="prep-items">${o.items.map((it, i) => `<li><label><input type="checkbox" data-pick="${UI.esc(o.id)}:${i}"${picked[o.id + ":" + i] ? " checked" : ""} /> <b>${it.qty} ×</b> <span>${UI.esc(it.name)}</span> <small class="muted">${UI.money(it.price * it.qty)}</small></label></li>`).join("")}</ul>
          ${o.items_note ? `<p class="prep-order">💬 ${UI.esc(o.items_note)}</p>` : ""}<p class="small"><b>${UI.esc(t("spItemsTotal", { total: UI.money(o.items_total) }))}</b></p>`
        : `<p class="prep-order">🧾 ${UI.esc(o.shop_order || "")}</p>`}
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
$("#spPrep").addEventListener("change", e => { const c = e.target.closest("[data-pick]"); if (c) picked[c.dataset.pick] = c.checked; });
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
function prodRow(p) {
  if (cat.edit && cat.edit.id === p.id) return prodForm(p);
  return `<div class="ct-prod${p.available ? "" : " off"}">
    ${p.photo ? `<img src="${UI.esc(p.photo)}" alt="" />` : `<span class="ct-nophoto">🍽️</span>`}
    <div class="ct-info"><b>${UI.esc(p.name)}</b><small>${UI.money(p.price)}${p.description ? " · " + UI.esc(p.description) : ""}</small></div>
    <button type="button" class="btn btn-sm ${p.available ? "" : "btn-primary"}" data-avail="${UI.esc(p.id)}">${UI.esc(t(p.available ? "ctAvail" : "ctOut"))}</button>
    <button type="button" class="btn btn-sm btn-link" data-edit="${UI.esc(p.id)}" aria-label="${UI.esc(t("ctEdit"))}">✏️</button>
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
