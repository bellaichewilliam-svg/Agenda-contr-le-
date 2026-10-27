// ============================================================================
// Suivi d'une course en direct : étapes, carte avec le coursier, temps estimé, paiement.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const t = I18N.t;
const token = new URLSearchParams(location.search).get("t");
const FLOW = ["nouvelle", "confirmee", "recuperee", "livree"];
let order = null;
const W = CONFIG.pricing.waiting;
let settings = { wait_free_min: W.freeMinutes, wait_step_min: W.stepMinutes, wait_step_price: W.stepPrice, wait_max: W.max };
Store.getSettings().then(s => { Object.assign(settings, s); if (order) render(); }).catch(() => {});
let map = null, markers = {}, fitted = false, courierSeen = false;

function cityLabel(id) { return CONFIG.cities.some(c => c.id === id) ? I18N.cityName(id) : id; }

function initMap() {
  if (!window.L) { $("#map").classList.add("hidden"); return; }
  const home = Pricing.cityById(CONFIG, CONFIG.homeCity);
  map = L.map("map", { zoomControl: true }).setView([home.lat, home.lon], 12);
  UI.mapTiles(map, false);
}

function pin(emoji) {
  return L.divIcon({ className: "", html: `<div class="map-pin">${emoji}</div>`, iconSize: [32, 32], iconAnchor: [16, 28] });
}

function setMarker(key, lat, lon, emoji) {
  if (!map || lat == null || lon == null) return;
  if (markers[key]) markers[key].setLatLng([lat, lon]);
  else markers[key] = L.marker([lat, lon], { icon: pin(emoji), zIndexOffset: key === "courier" ? 1000 : 0 }).addTo(map);
}

// Le scooter du livreur glisse en douceur d'une position à la suivante (pas de saut)
let anim = null;
const scooterIcon = () => L.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23], html: `<div class="trk-scooter">🛵</div>` });
function moveCourier(lat, lon) {
  if (!map) return;
  if (!markers.courier) { markers.courier = L.marker([lat, lon], { icon: scooterIcon(), zIndexOffset: 1000 }).addTo(map); return; }
  const from = markers.courier.getLatLng(), to = L.latLng(lat, lon);
  if (from.equals(to)) return;
  cancelAnimationFrame(anim);
  const t0 = performance.now(), dur = 9000;   // jusqu'à la prochaine mise à jour (10 s)
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    markers.courier.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]);
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

// Rond du temps restant avant la livraison (« 17-27 min ») ; touché, il ouvre la page d'état
let lastEta = { main: "", sub: "" };
function ringText(o) {
  const r = UI.etaRange(o);
  return r ? { big: r.text, unit: "min" } : { big: o.status === "nouvelle" ? "⏳" : "🛵", unit: "" };
}
function renderRing(o) {
  const show = ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  $("#etaRing").classList.toggle("hidden", !show);
  if (!show) { closeSheet(); return; }
  const r = ringText(o), p = UI.PROGRESS[o.status] || 0;
  $("#etaSvg").innerHTML = UI.ringSvg(p, "hrg-trk");
  $("#etaMin").textContent = r.big;
  $("#etaMin").classList.toggle("long", r.big.length > 4);
  $("#etaUnit").textContent = r.unit;
  // Page d'état (si ouverte, elle suit en direct)
  $("#stSvg").innerHTML = UI.ringSvg(p, "hrg-st");
  $("#stMin").textContent = r.big;
  $("#stUnit").textContent = r.unit;
  $("#stShop").textContent = o.shop_name || o.pickup_place || o.pickup_address || "";
  $("#stTitle").textContent = lastEta.main;
  $("#stSub").textContent = lastEta.sub;
  const step = FLOW.indexOf(o.status);
  $("#stSteps").innerHTML = ["trStep1", "trStep2", "trStep3", "trStep4"].map((k, i) =>
    `<li class="${i < step ? "done" : i === step ? "current" : ""}"><i></i><span>${UI.esc(t(k))}</span></li>`).join("");
  $("#stDetails").textContent = "🧾 " + t("trDetails");
}
function openSheet() { $("#stSheet").classList.remove("hidden"); document.body.classList.add("st-open"); }
function closeSheet() { $("#stSheet").classList.add("hidden"); document.body.classList.remove("st-open"); }
$("#etaRing").addEventListener("click", openSheet);
$("#stClose").addEventListener("click", closeSheet);
$("#stHelp").addEventListener("click", () => { closeSheet(); $("#chatBtn").click(); });
["#stReceipt", "#stDetails"].forEach(id => $(id).addEventListener("click", () => {
  closeSheet(); $("#details").scrollIntoView({ behavior: "smooth", block: "start" });
}));

function updateMap(o) {
  if (!map) return;
  setMarker("pickup", o.pickup_lat, o.pickup_lon, "📍");
  setMarker("drop", o.dropoff_lat, o.dropoff_lon, "🏁");
  const live = o.courier_lat != null;
  if (live) moveCourier(Number(o.courier_lat), Number(o.courier_lon));
  else if (markers.courier) { map.removeLayer(markers.courier); delete markers.courier; }
  // Recentrer au premier affichage et quand le coursier apparaît
  if (!fitted || (live && !courierSeen)) {
    const pts = Object.values(markers).map(m => m.getLatLng());
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
    fitted = true;
  }
  courierSeen = live;
}

// Réponse attendue du client (heure du livreur, attente annoncée) : en pop-up au premier plan, avec vibreur
// et son, pour ne pas la rater ; une seule alerte par question
const askedPop = new Set();
function askPop(box, on, key) {
  box.classList.toggle("ask-pop", !!on);
  document.body.classList.toggle("asking", !!document.querySelector(".ask-pop"));
  if (!on || askedPop.has(key)) return;
  askedPop.add(key);
  try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]); } catch (e) { /* ignore */ }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t0 => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + 0.2); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.2); });
  } catch (e) { /* ignore */ }
  if (window.Notification && Notification.permission === "granted") UI.notify("HOP! · " + t("trAskNotif"), { tag: "hop-ask-" + key, vibrate: [400, 150, 400], requireInteraction: true });
}

// Le livreur a dit dans combien de temps il est au départ : le client accepte, ou préfère un autre livreur
let others = null;
function etaAsk(o) {
  const box = $("#etaAsk");
  const open = o.status === "confirmee" && o.eta_status === "attente" && new Date(o.eta_until) > Date.now();
  box.classList.toggle("hidden", !open);
  askPop(box, open, "eta:" + o.eta_until);
  if (!open) { box.innerHTML = ""; return; }
  const left = Math.max(0, Math.round((new Date(o.eta_until) - Date.now()) / 1000));
  const time = new Date(o.eta_at).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  const n = others == null ? null : others;
  box.innerHTML = `<b>${UI.esc(t("trEtaAsk", { name: (o.courier_name || "").split(" ")[0] || t("a_courier"), min: o.eta_min, time }))}</b>
    ${n != null ? `<small>${UI.esc(n ? t("trEtaOthers", { n }) : t("trEtaNone"))}</small>` : ""}
    <div class="btns"><button type="button" class="btn btn-primary" data-eta-ok>${UI.esc(t("trEtaOk"))}</button>
      <button type="button" class="btn" data-eta-no>${UI.esc(t("trEtaNo"))}</button></div>
    <small class="muted">${UI.esc(t("trEtaAuto", { s: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }))}</small>`;
}
async function countOthers(o) {
  // Autres livreurs en ligne et libres près du départ (pour décider)
  try {
    const list = (await Store.couriersNearby()) || [];
    others = o.pickup_lat == null ? list.filter(c => c.free).length
      : list.filter(c => c.free && Pricing.haversineKm({ lat: o.pickup_lat, lon: o.pickup_lon }, c) < 5).length;
  } catch (e) { others = null; }
}
$("#etaAsk").addEventListener("click", async e => {
  const ok = !!e.target.closest("[data-eta-ok]"), no = !!e.target.closest("[data-eta-no]");
  if ((!ok && !no) || !order) return;
  e.target.closest("button").disabled = true;
  const r = await Store.answerEta(token, ok).catch(() => false);
  if (r && no) alert(t("trEtaRefused"));
  load();
});
setInterval(() => { if (order) { etaAsk(order); waitAsk(order); } }, 1000);

// Attente annoncée par le livreur au départ : le client accepte, ou laisse tomber (la moitié de la course reste due)
let lastAnn = null;
function waitAsk(o) {
  const box = $("#waitAsk");
  const st = o.wait_ann_status, open = o.status === "confirmee" && !!st && st !== "refus";
  box.classList.toggle("hidden", !open);
  askPop(box, open && st === "attente" && Date.now() - new Date(o.wait_ann_at) < 180000, "wait:" + o.wait_ann_at);
  if (!open) { box.innerHTML = ""; return; }
  // Nouvelle annonce : le téléphone vibre
  if (o.wait_ann_at && lastAnn && lastAnn !== o.wait_ann_at && navigator.vibrate) navigator.vibrate([300, 120, 300]);
  lastAnn = o.wait_ann_at;
  const left = Math.max(0, 180 - Math.floor((Date.now() - new Date(o.wait_ann_at)) / 1000));
  const fee = UI.money(Store.waitFeeFor(o.wait_ann_cap, settings, o));
  const html = st === "info" ? `<b>${UI.esc(t("waInfo", { min: o.wait_ann_min }))}</b>`
    : st === "attente" && left > 0 ? `<b>${UI.esc(t("waAnnTitle", { min: o.wait_ann_min }))}</b>
      <small>${UI.esc(t("waAnnFee", { fee, free: Store.freeMinOf(o, settings), price: UI.money(settings.wait_step_price), left: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }))}</small>
      <div class="btns"><button type="button" class="btn btn-primary" data-wa-ok>${UI.esc(t("waOk"))}</button>
        <button type="button" class="btn" data-wa-drop>${UI.esc(t("waDrop"))}</button></div>`
    : `<b>${UI.esc(t("waAccepted", { fee, min: o.wait_ann_min }))}</b>`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
$("#waitAsk").addEventListener("click", async e => {
  const ok = !!e.target.closest("[data-wa-ok]"), drop = !!e.target.closest("[data-wa-drop]");
  if ((!ok && !drop) || !order) return;
  if (drop && !confirm(t("waDropConfirm", { half: UI.money(Math.round(Number(order.price)) / 2) }))) return;
  e.target.closest("button").disabled = true;
  const r = await Store.clientWaitAnswer(token, ok).catch(() => null);
  if (!r || !r.ok) alert(t("waTooLate"));
  load();
});

function etaBox(o) {
  const live = o.courier_lat != null;
  const courier = live && { lat: o.courier_lat, lon: o.courier_lon };
  let main, sub = "";
  if (o.status === "annulee") { main = Number(o.drop_fee) > 0 ? t("trDropped") : t("trCancelled"); if (Number(o.drop_fee) > 0) sub = t("trDroppedSub", { fee: UI.money(o.drop_fee) }); }
  else if (o.status === "refusee") { main = t("trRefused"); sub = o.admin_note ? t("trReason", { r: o.admin_note }) : ""; }
  else if (o.status === "livree") { main = t("deliveredYay"); sub = t("trThanks"); }
  else if (o.status === "nouvelle") {
    // Jamais dans l'inconnu : course rendue par son livreur, ou refusée par un livreur → on le dit
    const released = o.released_at && Date.now() - new Date(o.released_at) < 30 * 60000;
    main = released ? t("trReleased") : t("trWaiting");
    if (o.urgency === "programmee") sub = t("trPlanned", { when: UI.fmtDateTime(o.pickup_at) });
    else if (!released && Number(o.offer_declines) > 0) sub = t("trDeclined");
  } else if (o.status === "confirmee" && o.arrived_at) {
    // Le livreur attend au départ (commande pas prête) ou fait les achats : le temps compte
    const st = settings, w = Store.waitFee(o, st);
    main = t("trArrived");
    sub = w.fee ? t("trWaitNow", { min: w.mins, fee: UI.money(w.fee) })
      : t("trWaitLeft", { min: w.mins, left: Math.max(0, Store.freeMinOf(o, st) - w.mins), price: UI.money(st.wait_step_price), step: Number(st.wait_step_min) === 1 ? t("stepMin1") : t("stepMinN", { n: st.wait_step_min }) });
  } else if (o.status === "confirmee") {
    // Le plus long entre le GPS et le temps annoncé par le livreur (il peut finir une autre course)
    const said = o.eta_at ? Math.ceil((new Date(o.eta_at) - Date.now()) / 60000) : 0;
    if (live && o.pickup_lat != null) main = t("trEtaPickup", { min: Math.max(Pricing.etaMinutes(courier, { lat: o.pickup_lat, lon: o.pickup_lon }), said) });
    else if (o.eta_at && new Date(o.eta_at) > Date.now()) main = t("trEtaLine", { time: new Date(o.eta_at).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" }) });
    else { main = t("trStep2"); sub = o.urgency === "programmee" ? t("trPlanned", { when: UI.fmtDateTime(o.pickup_at) }) : t("trNoGps"); }
  } else if (o.status === "recuperee") {
    if (live && o.dropoff_lat != null) main = t("trEtaDrop", { min: Pricing.etaMinutes(courier, { lat: o.dropoff_lat, lon: o.dropoff_lon }) });
    else { main = t("trStep3"); sub = t("trNoGps"); }
  }
  // HOP! Pro : où en est la préparation chez le commerce
  if (o.shop_status && ["nouvelle", "confirmee"].includes(o.status)) {
    const name = o.shop_name || "";
    const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
    if (o.shop_status === "attente") { main = t("trShopWait", { name }); sub = ""; }
    else if (o.shop_status === "acceptee" && left > 0) { sub = o.status === "confirmee" ? main : ""; main = t("trShopPrep", { name, min: left }); }
    else if (o.shop_status === "prete" || (o.shop_status === "acceptee" && left <= 0)) { if (o.status === "nouvelle") main = t("trShopReady"); else sub = t("trShopReady"); }
  }
  if (o.status === "refusee" && o.shop_status === "refusee") main = t("trShopRefused", { name: o.shop_name || "" });
  if (live && o.courier_at && ["confirmee", "recuperee"].includes(o.status) && !(o.status === "confirmee" && o.arrived_at) && !sub) {
    const s = Math.max(0, Math.round((Date.now() - new Date(o.courier_at)) / 1000));
    sub = t("trUpdated", { s });
  }
  lastEta = { main, sub };
  $("#eta").innerHTML = `<small>${UI.esc(t("orderNo", { ref: o.ref }))}</small><b>${UI.esc(main)}</b>${sub ? `<small>${UI.esc(sub)}</small>` : ""}`;
}

function render() {
  const o = order;
  I18N.apply();
  $("#brandName").innerHTML = UI.wordmark();
  if (!o) {
    $("#eta").innerHTML = `<b>${UI.esc(t("trNotFound"))}</b>`;
    ["#steps", "#details"].forEach(s => { $(s).closest(".card").classList.add("hidden"); });
    return;
  }
  etaBox(o);
  etaAsk(o);
  waitAsk(o);
  renderAdd();
  renderRing(o);
  renderRate(o);
  renderTip(o);

  const step = FLOW.indexOf(o.status);
  const labels = ["trStep1", "trStep2", "trStep3", "trStep4"];
  $("#steps").innerHTML = o.status === "annulee" || o.status === "refusee"
    ? `<li class="done">${UI.esc(t(o.status === "annulee" ? "trCancelled" : "trRefused"))}</li>
       ${o.status === "refusee" ? `<li style="padding-inline-start:0"><a class="btn btn-sm btn-primary" href="index.html#commander">${UI.esc(t("trRebook"))}</a></li>` : ""}`
    : labels.map((k, i) => `<li class="${i < step || (i === step && i === 3) ? "done" : i === step ? "current" : ""}">${UI.esc(t(k))}</li>`).join("");

  $("#details").innerHTML = `
    <div><span>📍</span><span><b>${UI.esc(t("trPickup"))}</b><br>${UI.brand(o.pickup_place)}<bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(cityLabel(o.from_city))}${UI.addrDetails(o, "pickup", I18N.lang)}${UI.addrNote(o.pickup_note)}</span></div>
    <div><span>🏁</span><span><b>${UI.esc(t("trDrop"))}</b><br>${UI.brand(o.dropoff_place)}<bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(cityLabel(o.to_city))}${UI.addrDetails(o, "dropoff", I18N.lang)}${UI.addrNote(o.dropoff_note)}${UI.doorTag(o, I18N.lang)}</span></div>
    ${o.phone_order && o.ready_at && ["nouvelle", "confirmee"].includes(o.status) ? `<div><span>📞</span><span>${UI.esc(t("trPhoneReady", { time: new Date(o.ready_at).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" }) }))}</span></div>` : ""}
    ${docsBlock(o)}
    ${claimBlock(o)}
    ${o.admin_note && o.status !== "refusee" ? `<div><span>💬</span><span>${UI.esc(o.admin_note)}</span></div>` : ""}`;

  const pay = $("#payBox");
  const dropped = o.status === "annulee" && Number(o.drop_fee) > 0;
  pay.classList.toggle("hidden", (o.status === "annulee" && !dropped) || o.status === "refusee");
  const bit = UI.bitFor(o);
  // Trompé de moyen de paiement : on change tant que rien n'est payé
  // (passer en espèces après coup n'est pas possible : plafond et livreur choisis pour Bit)
  // Articles payés d'avance au livreur : le détail, puis le ticket et la différence rendue (ou le complément à envoyer)
  const goodsLine = x => {
    const name = String(x.courier_name || "").split(" ")[0], ph = String(x.courier_bit || x.courier_phone || "").replace(/\D/g, "");
    const head = `<p class="small muted" style="margin:2px 0 0">${UI.esc(t("trGoodsSplit", { ride: UI.money(x.price), goods: UI.money(x.goods_budget) }))}</p>`;
    if (x.goods_spent == null) return head;
    const st = x.goods_refund_status, v = { spent: UI.money(x.goods_spent), diff: UI.money(x.goods_refund), name };
    return head + `<div class="refund-box${st === "a_completer" ? " wait-due" : ""}"><p><b>🧾 ${UI.esc(t(st === "a_rendre" ? "trGoodsBack" : st === "rendu" ? "trGoodsBackDone" : st === "a_completer" ? "trGoodsMore" : "trGoodsExact", v))}</b></p>
      ${st === "a_completer" && ph ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(ph)}">${UI.esc(t("bpCopy"))}</button></div>` : ""}</div>`;
  };
  const canSwitch = !o.direct_pay && o.payment_status !== "paye" && o.payment_method === "cash"
    && ["nouvelle", "confirmee", "recuperee"].includes(o.status) && !(o.payment_method === "bit" && o.prepaid_required);
  const copy = `<button class="btn btn-sm" id="copyBit">${UI.esc(t("trCopy"))}</button>`;
  // Course rendue après paiement : le premier livreur rembourse, le client confirme
  const rname = String(o.refund_courier_name || "").split(" ")[0], ramount = UI.money(o.refund_amount || 0);
  const refund = !o.refund_status ? ""
    : o.refund_status === "recu" ? `<p class="promo-msg ok">${UI.esc(t("trRefundOk"))}</p>`
    : o.refund_status === "litige" ? `<p class="promo-msg bad">${UI.esc(t("trRefundLitige"))}</p>`
    : `<div class="refund-box"><p>${UI.esc(t(o.refund_status === "fait" ? "trRefundDone" : o.refund_status === "rien_recu" ? "trRefundNone" : Number(o.drop_fee) > 0 ? "trDropRefund" : "trRefundDue", { name: rname, amount: ramount }))}</p>
        <div class="bit-btns"><button type="button" class="btn btn-sm btn-primary" data-refund="1">${UI.esc(t("trRefundYes"))}</button>
        <button type="button" class="btn btn-sm" data-refund="0">${UI.esc(t("trRefundNo"))}</button></div></div>`;
  const missing = o.pay_missing_at && !o.client_paid_at && o.payment_status !== "paye" ? `<p class="promo-msg bad">${UI.esc(t("trPayMissing"))}</p>` : "";
  if (dropped) {
    const who = String(o.courier_name || "").split(" ")[0], phone = o.courier_bit || o.courier_phone || "";
    pay.innerHTML = `${refund}<small class="muted">${UI.esc(t("trPay"))}</small><div class="amount">${UI.money(o.drop_fee)}</div>
      ${o.wait_status === "a_payer" ? `<div class="refund-box wait-due"><p><b>${UI.esc(t("trDropDue", { fee: UI.money(o.wait_due), name: who, phone }))}</b></p>
        ${phone ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(phone).replace(/\D/g, ""))}">${UI.esc(t("bpCopy"))}</button></div>` : ""}</div>`
      : o.wait_status === "recu" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>` : ""}`;
  } else
  // Articles payés d'avance au commerce : ① le commerce, ② la livraison
  // (commerce sans lien ni Bit : le montant des articles et à qui le payer, quand même)
  pay.innerHTML = `${o.goods_pay && o.shop_pay ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p>${UI.goodsPay(o, o.shop_pay)}<p class="gp-step2"><b>${UI.esc(t("gpStep2", { amount: UI.money(o.price) }))}</b></p>`
    : o.shop_pay && Number(o.items_total) > 0 && o.payment_method !== "cash" ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p><div class="goods-pay todo"><b class="gp-step">${UI.esc(t("gpStep1", { name: UI.bi(o.shop_pay.name), amount: UI.money(o.items_total) }))}</b><small>${UI.esc(t("gbAsk", { name: UI.bi(o.shop_pay.name) }))}</small></div><p class="gp-step2"><b>${UI.esc(t("gpStep2", { amount: UI.money(o.price) }))}</b></p>` : ""}${refund}${missing}<small class="muted">${UI.esc(t("trPay"))}</small>
    <div class="amount">${UI.money(o.payment_method === "cash" ? Number(o.price) + Number(o.cash_goods || 0) : UI.payTotal(o))}${o.budget && !o.goods_prepay ? ` <small class="muted">${UI.esc(t("qPurchaseNote"))}</small>` : ""}</div>
    ${o.goods_prepay ? goodsLine(o) : ""}
    ${Number(o.wait_fee) > 0 ? `<p class="small muted" style="margin:2px 0 0">⏱️ ${UI.esc(t("trWaitFee", { fee: UI.money(o.wait_fee), min: o.wait_minutes }))}</p>` : ""}
    ${o.wait_status === "a_payer" ? `<div class="refund-box wait-due"><p><b>${UI.esc(t("trWaitDue", { fee: UI.money(o.wait_due), name: String(o.courier_name || "").split(" ")[0], phone: o.courier_bit || o.courier_phone || "" }))}</b></p>
      ${o.courier_bit || o.courier_phone ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(o.courier_bit || o.courier_phone).replace(/\D/g, ""))}">${UI.esc(t("bpCopy"))}</button></div>` : ""}</div>`
      : o.wait_status === "recu" ? `<p class="promo-msg ok">${UI.esc(t("trWaitDueOk"))}</p>` : ""}
    ${o.payment_status === "paye" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>${UI.receiptNo(o) ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}">${UI.esc(t("receiptLink"))}</a>` : ""}`
      : o.payment_method === "bit"
        ? `${o.prepaid_required && !o.direct_pay ? `<p class="promo-msg bad" style="margin-top:6px">${UI.esc(t("trPrepay"))}</p>` : ""}${UI.bitPay(o)}`
        : `<div class="cash-box"><p class="cash-total">${UI.esc(t("trCashPay", { total: UI.money(Number(o.price) + Number(o.cash_goods || 0)) }))}</p>
            ${Number(o.cash_goods) > 0 ? `<small>${UI.esc(t("trCashGoods", { goods: UI.money(o.cash_goods) }))}</small><br>` : ""}
            <small>${UI.esc(Number(o.cash_note) > 0 ? t("trCashChange", { note: UI.money(o.cash_note), change: UI.money(Number(o.cash_note) - Number(o.price) - Number(o.cash_goods || 0)) }) : t("trCashExact"))}</small></div>`}
    ${canSwitch ? `<button class="btn btn-sm btn-link" id="switchPay">${UI.esc(t(o.payment_method === "bit" ? "trToCash" : "trToBit"))}</button>` : ""}`;

  // Discussion directe : avec le livreur attribué, ou avec l'administration
  const hasCourier = !!o.courier_phone && ["confirmee", "recuperee"].includes(o.status);
  const first = (o.courier_name || "").split(" ")[0];
  $("#noCourier").classList.toggle("hidden", hasCourier || o.status !== "nouvelle");
  // Pendant la course, on peut aussi appeler son livreur ; tout le reste passe par la messagerie
  $("#callCourier").classList.toggle("hidden", !hasCourier);
  if (hasCourier) {
    $("#callCourier").textContent = t("callCourier", { name: first });
    $("#callCourier").href = "tel:" + o.courier_phone;
  }
  $("#shareBtn").href = UI.waShare(t("trShareMsg", { url: UI.appUrl("suivi.html") + location.search }));
  updateMap(o);
}

// --- Note de la livraison : étoiles, petits mots, et un message pour le livreur ----------------
const GOOD = ["fast", "nice", "care", "found"], BAD = ["late", "damaged", "rude", "lost"];
const rate = { stars: 0, tags: new Set(), sent: null, celebrated: false };
function renderRate(o) {
  const box = $("#rateBox");
  const canRate = o.status === "livree" && o.rating == null && Date.now() - new Date(o.pickup_at) < 7 * 86400000;
  if (o.status === "livree" && !rate.celebrated) { rate.celebrated = true; celebrate(); }
  if (rate.sent) { box.innerHTML = `<p class="rate-thanks">${UI.esc(t(rate.sent <= 3 ? "rtLowThanks" : "rtThanks"))}</p>`; box.classList.remove("hidden"); return; }
  if (o.rating != null) {
    box.innerHTML = `<p class="rate-thanks">${UI.esc(t("rtYours", { stars: "⭐".repeat(o.rating) }))}</p>`;
    box.classList.remove("hidden");
    return;
  }
  box.classList.toggle("hidden", !canRate);
  if (!canRate || box.dataset.ready) return;
  box.dataset.ready = "1";
  drawRate();
}
function drawRate() {
  const box = $("#rateBox");
  const tags = rate.stars && rate.stars <= 3 ? BAD : GOOD;
  const first = (order.courier_name || "").split(" ")[0];
  box.innerHTML = `<h3>${UI.esc(t("rtTitle"))}</h3><p class="muted small">${UI.esc(t("rtSub"))}${first ? " · 🛵 " + UI.esc(first) : ""}</p>
    <div class="rate-stars" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= rate.stars ? "on" : ""}" data-star="${n}" aria-label="${n}/5">★</button>`).join("")}</div>
    ${rate.stars ? `<div class="rate-tags">${tags.map(k => `<button type="button" class="ch-chip${rate.tags.has(k) ? " on" : ""}" data-tag="${k}">${UI.esc(t("rt_" + k))}</button>`).join("")}</div>
      <textarea id="rateNote" rows="2" maxlength="300" placeholder="${UI.esc(t("rtNotePh"))}">${UI.esc(rate.note || "")}</textarea>
      <p class="notice err hidden" id="rateErr"></p>
      <button type="button" class="btn btn-primary btn-block" id="rateSend">${UI.esc(t("rtSend"))}</button>` : `<p class="muted small" style="text-align:center">${UI.esc(t("rtPick"))}</p>`}`;
}
$("#rateBox").addEventListener("input", e => { if (e.target.id === "rateNote") rate.note = e.target.value; });
$("#rateBox").addEventListener("click", async e => {
  const star = e.target.closest("[data-star]");
  if (star) {
    const was = rate.stars;
    rate.stars = Number(star.dataset.star);
    if ((was <= 3) !== (rate.stars <= 3)) rate.tags.clear();   // on change de liste de mots
    drawRate();
    return;
  }
  const tag = e.target.closest("[data-tag]");
  if (tag) { rate.tags.has(tag.dataset.tag) ? rate.tags.delete(tag.dataset.tag) : rate.tags.add(tag.dataset.tag); drawRate(); return; }
  if (e.target.id === "rateSend") {
    e.target.disabled = true;
    try {
      const ok = await Store.rateOrder(token, rate.stars, [...rate.tags], rate.note);
      if (!ok) throw new Error("refused");
      rate.sent = rate.stars;
      if (rate.stars >= 4) celebrate();
      load();
    } catch (ex) {
      $("#rateErr").textContent = t("rtErr");
      $("#rateErr").classList.remove("hidden");
      e.target.disabled = false;
    }
  }
});
// --- Pourboire : 100 % pour le livreur (payé à HOP par Bit, reversé au livreur) ----------------
const tip = { pick: null };
function renderTip(o) {
  const box = $("#tipBox");
  const first = (o.courier_name || "").split(" ")[0];
  const amount = UI.money(o.tip);
  if (o.tip_status) {
    box.innerHTML = o.tip_status === "promis"
      ? `<p class="rate-thanks">${UI.esc(t("tpPay", { amount, phone: UI.bitFor(o), ref: o.ref }))}</p><button class="btn btn-sm" id="copyTipBit">${UI.esc(t("trCopy"))}</button>`
      : `<p class="rate-thanks">${UI.esc(t("tpDone", { amount }))}</p>`;
    box.classList.remove("hidden");
    return;
  }
  const can = o.status === "livree" && o.courier_id && Date.now() - new Date(o.pickup_at) < 7 * 86400000;
  box.classList.toggle("hidden", !can);
  if (!can) return;
  box.innerHTML = `<h3>${UI.esc(first ? t("tpTitle", { name: first }) : t("tpTitleAnon"))}</h3><p class="muted small">${UI.esc(t("tpSub"))}</p>
    <div class="rate-tags">${(CONFIG.platform.tips || [5, 10, 15]).map(n => `<button type="button" class="ch-chip${tip.pick === n ? " on" : ""}" data-tip="${n}">${UI.money(n)}</button>`).join("")}</div>
    <p class="notice err hidden" id="tipErr"></p>
    ${tip.pick ? `<button type="button" class="btn btn-primary btn-block" id="tipSend">${UI.esc(t("tpSend", { amount: UI.money(tip.pick) }))}</button>` : ""}`;
}
$("#tipBox").addEventListener("click", async e => {
  const b = e.target.closest("[data-tip]");
  if (b) { tip.pick = Number(b.dataset.tip); return renderTip(order); }
  if (e.target.id === "copyTipBit") { navigator.clipboard && navigator.clipboard.writeText(String(UI.bitFor(order))).catch(() => {}); return; }
  if (e.target.id !== "tipSend") return;
  e.target.disabled = true;
  try {
    if (!(await Store.tipOrder(token, tip.pick))) throw new Error("refused");
    await load();
  } catch (ex) {
    $("#tipErr").textContent = t("tpErr");
    $("#tipErr").classList.remove("hidden");
    e.target.disabled = false;
  }
});

// Pluie d'emojis à la livraison (et pour une belle note)
function celebrate() {
  const box = $("#confetti");
  if (!box || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  box.innerHTML = Array.from({ length: 30 }, () => {
    const e = ["🎉", "📦", "🛵", "✨", "🧡", "⭐"][Math.floor(Math.random() * 6)];
    return `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * .6).toFixed(2)}s;animation-duration:${(1.6 + Math.random()).toFixed(2)}s">${e}</i>`;
  }).join("");
  setTimeout(() => { box.innerHTML = ""; }, 3200);
}

document.addEventListener("hop-goods-paid", () => load());
async function load() {
  try {
    order = token ? await Store.trackOrder(token) : null;
    if (order && order.eta_status === "attente") await countOthers(order);
    if (order && order.docs_status && order.status === "nouvelle") docsSent = await Store.orderDocsSent(token).catch(() => docsSent);
    addable = canAdd(order) ? await Store.orderAddable(token).catch(() => addable) : null;
  } catch (e) {
    return; // nouvel essai au prochain passage
  }
  render();
}

// --- Ajouter des articles du même commerce (catalogue HOP! Pro) : pendant 15 min, tant qu'elle n'est pas prête ---
let addable = null, addCart = {}, addDone = false;
const canAdd = o => !!(o && o.shop_id && Array.isArray(o.items) && o.items.length && ["nouvelle", "confirmee"].includes(o.status)
  && ["attente", "acceptee"].includes(o.shop_status));
const addLeft = () => (addable ? Math.max(0, Math.floor((new Date(addable.until) - Date.now()) / 1000)) : 0);
function renderAdd() {
  const s = addLeft();
  const html = addDone ? `<p class="add-done">${UI.esc(t("adDone"))}</p>`
    : addable && s > 0 ? `<button type="button" class="add-card" data-add-open><span><b>${UI.esc(t("adTitle"))}</b><small>${UI.esc(t("adSub"))}</small></span>
      <i class="add-timer" dir="ltr">${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}<small>${UI.esc(t("adLeft"))}</small></i></button>` : "";
  ["#addBox", "#stAdd"].forEach(id => { if ($(id).innerHTML !== html) $(id).innerHTML = html; });
  $("#addBox").classList.toggle("hidden", !html);
}
setInterval(renderAdd, 1000);
const addTotal = () => (addable ? addable.products.reduce((x, p) => x + Number(p.price) * (addCart[p.id] || 0), 0) : 0);
function renderAddList() {
  $("#adList").innerHTML = addable.products.map(p => { const q = addCart[p.id] || 0, photo = UI.safeImg(p.photo);
    return `<div class="add-item${q ? " in" : ""}">${photo ? `<img src="${photo}" alt="" loading="lazy" />` : ""}
      <span class="add-name"><b>${UI.esc(p.name)}</b>${p.description ? `<small>${UI.esc(p.description)}</small>` : ""}<em>${UI.money(p.price)}</em></span>
      <span class="add-qty">${q ? `<button type="button" data-ad-minus="${UI.esc(p.id)}">−</button><b>${q}</b>` : ""}<button type="button" data-ad-plus="${UI.esc(p.id)}">+</button></span></div>`; }).join("");
  const total = addTotal();
  $("#adOk").textContent = total ? t("adOk", { total: UI.money(total) }) : t("adOkEmpty");
}
function openAdd() {
  if (!addable) return;
  addCart = {};
  $("#adHead").textContent = t("adHead", { name: addable.shop || "" });
  $("#adInfo").textContent = t("adInfo");
  $("#adTopTxt").textContent = t("adTop");
  $("#adTop").checked = false;
  $("#adCancel").textContent = t("adCancel");
  $("#adErr").classList.add("hidden");
  renderAddList();
  $("#addModal").classList.remove("hidden");
}
document.addEventListener("click", e => { if (e.target.closest("[data-add-open]")) { closeSheet(); openAdd(); } });
$("#adList").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.adPlus) addCart[b.dataset.adPlus] = Math.min(50, (addCart[b.dataset.adPlus] || 0) + 1);
  if (b.dataset.adMinus) addCart[b.dataset.adMinus] = Math.max(0, (addCart[b.dataset.adMinus] || 0) - 1);
  $("#adErr").classList.add("hidden");
  renderAddList();
});
$("#adCancel").addEventListener("click", () => $("#addModal").classList.add("hidden"));
$("#adTop").addEventListener("change", () => $("#adErr").classList.add("hidden"));
$("#adOk").addEventListener("click", async () => {
  const items = Object.entries(addCart).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
  const err = m => { $("#adErr").textContent = t(m); $("#adErr").classList.remove("hidden"); };
  if (!items.length) return err("adNeedItem");
  if (!$("#adTop").checked) return err("adNeedTop");
  $("#adOk").disabled = true;
  const r = await Store.orderAddItems(token, items, true).catch(() => null);
  $("#adOk").disabled = false;
  if (!r || !r.ok) return err(r && r.error === "too_late" ? "adTooLate" : r && r.error === "topcase" ? "adNeedTop" : "adErrGen");
  $("#addModal").classList.add("hidden");
  addDone = true; setTimeout(() => { addDone = false; renderAdd(); }, 8000);
  load();
});

// Colis à récupérer : où en sont les documents, et ajouter celui qui manque
let docsSent = [];
function docsBlock(o) {
  const time = d => new Date(d).toLocaleString(I18N.lang === "he" ? "he-IL" : "fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  let html = o.appt_at ? `<div><span>📅</span><span>${UI.esc(t("trAppt", { time: time(o.appt_at) }))}</span></div>` : "";
  // Clés ou objet de valeur : le code à donner au destinataire (le livreur le demande avant de remettre)
  if (o.handoff_code && !["livree", "annulee", "refusee"].includes(o.status)) html += `<div><span>🔐</span><span><b>${UI.esc(t("trHandoff", { code: o.handoff_code }))}</b></span></div>`;
  if (o.status !== "nouvelle" || !o.docs_status) return html;
  const need = Store.docsFor(o);
  const sent = need.filter(k => docsSent.includes(k)).map(k => t("ds_" + k)).join(", ");
  if (o.docs_status === "ok") return html + `<div><span>✅</span><span>${UI.esc(t("trDocsOk"))}</span></div>`;
  html += `<div class="tr-docs"><span>📄</span><span>${UI.esc(o.docs_status === "refuse" ? t("trDocsMissing", { note: o.docs_note || "…" }) : t("trDocsWait"))}
    ${sent ? `<br><small class="muted">${UI.esc(t("trDocsSent", { list: sent }))}</small>` : ""}
    <span class="tr-doc-add"><select data-tr-kind>${need.map(k => `<option value="${k}">${UI.esc(t("ds_" + k))}</option>`).join("")}</select>
      <label class="btn btn-sm${o.docs_status === "refuse" ? " btn-primary" : ""}">📷 ${UI.esc(t("trDocsAdd"))}<input type="file" accept="image/*" data-tr-doc hidden /></label></span></span></div>`;
  return html;
}
// Commande pas reçue : le client le signale dans les 48 h après « Livré » (le patron est prévenu tout de suite)
function claimBlock(o) {
  if (o.claim_status === "ouverte") return `<div><span>⚠️</span><span>${UI.esc(t("trClaimSent"))}</span></div>`;
  if (o.claim_status) return `<div><span>✅</span><span>${UI.esc(t("trClaimDone"))}</span></div>`;
  if (o.status !== "livree" || Date.now() - new Date(o.delivered_at || o.pickup_at) > 48 * 3600000) return "";
  return `<div><span>❓</span><span><button type="button" class="btn btn-sm btn-link danger" data-claim>${UI.esc(t("trClaimBtn"))}</button></span></div>`;
}
$("#details").addEventListener("click", async e => {
  if (!e.target.closest("[data-claim]") || !order) return;
  const note = prompt(t("trClaimAsk"));
  if (note === null) return;
  const ok = await Store.claimOrder(token, note).catch(() => false);
  if (!ok) alert(t("trClaimErr"));
  load();
});
$("#details").addEventListener("change", async e => {
  const inp = e.target.closest("[data-tr-doc]");
  if (!inp || !inp.files[0] || !order) return;
  const kind = $("#details [data-tr-kind]").value;
  inp.closest("label").classList.add("busy");
  try {
    const ok = await Store.addOrderDoc(token, kind, await UI.docPhoto(inp.files[0]));
    if (!ok) throw new Error("refused");
  } catch (ex) { alert(t("errDocPhoto")); }
  load();
});

$("#langBtn").addEventListener("click", () => { I18N.setLang(I18N.other()); render(); });
$("#payBox").addEventListener("click", async e => {
  const rf = e.target.closest("[data-refund]");
  if (rf) {
    rf.disabled = true;
    await Store.refundAnswer(token, rf.dataset.refund === "1").catch(() => false);
    return load();
  }
  if (e.target.id === "switchPay") {
    e.target.disabled = true;
    const ok = await Store.setPayment(token, order.payment_method === "bit" ? "cash" : "bit").catch(() => false);
    if (!ok) { e.target.disabled = false; e.target.textContent = t("trSwitchErr"); return; }
    return load();
  }
  if (e.target.id !== "copyBit") return;
  const done = () => { e.target.textContent = t("trCopied"); };
  const bit = CONFIG.bitPhone;
  if (navigator.clipboard) navigator.clipboard.writeText(bit.replace(/\D/g, "")).then(done, done);
  else done();
});
window.addEventListener("storage", e => { if (/livraison\.(orders|courier)/.test(e.key || "")) load(); });

// Messagerie de la course : le client, son livreur et le service client
function openChat() {
  if (!order) return;
  Chat.open({ thread: "o:" + order.id, title: t("chOrder", { ref: order.ref }), sub: t("chOrderSub"), me: "client",
    fetch: () => Store.chatOrder(token), send: (b, i) => Store.chatOrderSend(token, b, i), onClose: checkChat });
}
let lastUnread = 0;
async function checkChat() {
  if (!order) return;
  try {
    const n = Chat.unread(await Store.chatOrder(token), "client")["o:" + order.id] || 0;
    $("#chatBadge").textContent = n;
    $("#chatBadge").classList.toggle("hidden", !n);
    if (n > lastUnread && navigator.vibrate) navigator.vibrate([150, 80, 150]);
    lastUnread = n;
  } catch (e) { /* nouvel essai */ }
}
$("#chatBtn").addEventListener("click", openChat);

I18N.apply();
initMap();
load().then(checkChat);
// En direct : toutes les 5 s pendant la course
// En direct : toutes les 2 s tant qu'un livreur peut accepter ou poser une question (heure, attente), sinon 5 s
(function livePoll() {
  const fast = !order || ["nouvelle", "confirmee"].includes(order.status);
  setTimeout(async () => { if (!order || ["nouvelle", "confirmee", "recuperee"].includes(order.status)) await Promise.resolve(load()).catch(() => {}); livePoll(); }, fast ? 2000 : 5000);
})();
setInterval(checkChat, 15000);

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
