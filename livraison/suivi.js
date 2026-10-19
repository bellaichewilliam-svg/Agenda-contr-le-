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

// Anneau du temps restant avant la livraison
function renderRing(o) {
  const min = UI.deliveryEta(o);
  const show = ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  $("#etaRing").classList.toggle("hidden", !show);
  if (!show) return;
  $("#etaMin").textContent = min != null ? min : o.status === "nouvelle" ? "⏳" : "🛵";
  $("#etaUnit").textContent = min != null ? "min" : "";
  const len = 2 * Math.PI * 44;
  $("#etaArc").style.strokeDasharray = `${len * (UI.PROGRESS[o.status] || 0)} ${len}`;
}

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

function etaBox(o) {
  const live = o.courier_lat != null;
  const courier = live && { lat: o.courier_lat, lon: o.courier_lon };
  let main, sub = "";
  if (o.status === "annulee") main = t("trCancelled");
  else if (o.status === "refusee") { main = t("trRefused"); sub = o.admin_note ? t("trReason", { r: o.admin_note }) : ""; }
  else if (o.status === "livree") { main = t("deliveredYay"); sub = t("trThanks"); }
  else if (o.status === "nouvelle") {
    main = t("trWaiting");
    if (o.urgency === "programmee") sub = t("trPlanned", { when: UI.fmtDateTime(o.pickup_at) });
  } else if (o.status === "confirmee" && o.arrived_at) {
    // Le livreur attend au départ (commande pas prête) ou fait les achats : le temps compte
    const st = settings, w = Store.waitFee(o, st);
    main = t("trArrived");
    sub = w.fee ? t("trWaitNow", { min: w.mins, fee: UI.money(w.fee) })
      : t("trWaitLeft", { min: w.mins, left: Math.max(0, st.wait_free_min - w.mins), price: UI.money(st.wait_step_price), step: st.wait_step_min });
  } else if (o.status === "confirmee") {
    if (live && o.pickup_lat != null) main = t("trEtaPickup", { min: Pricing.etaMinutes(courier, { lat: o.pickup_lat, lon: o.pickup_lon }) });
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
    ${o.admin_note && o.status !== "refusee" ? `<div><span>💬</span><span>${UI.esc(o.admin_note)}</span></div>` : ""}`;

  const pay = $("#payBox");
  pay.classList.toggle("hidden", o.status === "annulee" || o.status === "refusee");
  const bit = UI.bitFor(o);
  // Trompé de moyen de paiement : on change tant que rien n'est payé
  const canSwitch = o.payment_status !== "paye" && ["cash", "bit"].includes(o.payment_method)
    && ["nouvelle", "confirmee", "recuperee"].includes(o.status) && !(o.payment_method === "bit" && o.prepaid_required);
  const copy = `<button class="btn btn-sm" id="copyBit">${UI.esc(t("trCopy"))}</button>`;
  pay.innerHTML = `<small class="muted">${UI.esc(t("trPay"))}</small>
    <div class="amount">${UI.money(o.price)}${o.budget ? ` <small class="muted">${UI.esc(t("qPurchaseNote"))}</small>` : ""}</div>
    ${Number(o.wait_fee) > 0 ? `<p class="small muted" style="margin:2px 0 0">⏱️ ${UI.esc(t("trWaitFee", { fee: UI.money(o.wait_fee), min: o.wait_minutes }))}</p>` : ""}
    ${o.payment_status === "paye" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>`
      : o.payment_method === "bit"
        ? `${o.prepaid_required ? `<p class="promo-msg bad" style="margin-top:6px">${UI.esc(t("trPrepay"))}</p>` : ""}${UI.bitPay(o)}`
        : `<p style="margin-top:6px">💵 ${UI.esc(t("trPayCash"))}</p>`}
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

async function load() {
  try {
    order = token ? await Store.trackOrder(token) : null;
  } catch (e) {
    return; // nouvel essai au prochain passage
  }
  render();
}

$("#langBtn").addEventListener("click", () => { I18N.setLang(I18N.other()); render(); });
$("#payBox").addEventListener("click", async e => {
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
setInterval(load, 10000);
setInterval(checkChat, 15000);

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
