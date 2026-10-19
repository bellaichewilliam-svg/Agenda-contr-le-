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
let map = null, markers = {}, fitted = false, courierSeen = false;

function cityLabel(id) { return CONFIG.cities.some(c => c.id === id) ? I18N.cityName(id) : id; }

function initMap() {
  if (!window.L) { $("#map").classList.add("hidden"); return; }
  const home = Pricing.cityById(CONFIG, CONFIG.homeCity);
  map = L.map("map", { zoomControl: true }).setView([home.lat, home.lon], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap"
  }).addTo(map);
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
  else if (o.status === "livree") { main = t("trStep4") + " 📦"; sub = t("trThanks"); }
  else if (o.status === "nouvelle") {
    main = t("trWaiting");
    if (o.urgency === "programmee") sub = t("trPlanned", { when: UI.fmtDateTime(o.pickup_at) });
  } else if (o.status === "confirmee") {
    if (live && o.pickup_lat != null) main = t("trEtaPickup", { min: Pricing.etaMinutes(courier, { lat: o.pickup_lat, lon: o.pickup_lon }) });
    else { main = t("trStep2"); sub = o.urgency === "programmee" ? t("trPlanned", { when: UI.fmtDateTime(o.pickup_at) }) : t("trNoGps"); }
  } else if (o.status === "recuperee") {
    if (live && o.dropoff_lat != null) main = t("trEtaDrop", { min: Pricing.etaMinutes(courier, { lat: o.dropoff_lat, lon: o.dropoff_lon }) });
    else { main = t("trStep3"); sub = t("trNoGps"); }
  }
  if (live && o.courier_at && ["confirmee", "recuperee"].includes(o.status)) {
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
  const copy = `<button class="btn btn-sm" id="copyBit">${UI.esc(t("trCopy"))}</button>`;
  pay.innerHTML = `<small class="muted">${UI.esc(t("trPay"))}</small>
    <div class="amount">${UI.money(o.price)}${o.budget ? ` <small class="muted">${UI.esc(t("qPurchaseNote"))}</small>` : ""}</div>
    ${o.payment_status === "paye" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>`
      : o.payment_method === "bit"
        ? `${o.prepaid_required ? `<p class="promo-msg bad" style="margin-top:6px">${UI.esc(t("trPrepay"))}</p>` : ""}<p style="margin:6px 0">${UI.esc(t("trPayBit", { phone: bit, ref: o.ref }))}</p>${copy}`
        : `<p style="margin-top:6px">💵 ${UI.esc(t("trPayCash"))}</p>`}`;

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
  $("#shareBtn").href = UI.waShare(t("trShareMsg", { url: location.href }));
  updateMap(o);
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
$("#payBox").addEventListener("click", e => {
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
