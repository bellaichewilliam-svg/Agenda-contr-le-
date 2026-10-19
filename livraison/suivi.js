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

function updateMap(o) {
  if (!map) return;
  setMarker("pickup", o.pickup_lat, o.pickup_lon, "📍");
  setMarker("drop", o.dropoff_lat, o.dropoff_lon, "🏁");
  const live = o.courier_lat != null;
  if (live) setMarker("courier", o.courier_lat, o.courier_lon, "🛵");
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
  $("#brandName").textContent = I18N.businessName();
  if (!o) {
    $("#eta").innerHTML = `<b>${UI.esc(t("trNotFound"))}</b>`;
    ["#steps", "#details"].forEach(s => { $(s).closest(".card").classList.add("hidden"); });
    return;
  }
  etaBox(o);

  const step = FLOW.indexOf(o.status);
  const labels = ["trStep1", "trStep2", "trStep3", "trStep4"];
  $("#steps").innerHTML = o.status === "annulee" || o.status === "refusee"
    ? `<li class="done">${UI.esc(t(o.status === "annulee" ? "trCancelled" : "trRefused"))}</li>
       ${o.status === "refusee" ? `<li style="padding-inline-start:0"><a class="btn btn-sm btn-primary" href="index.html#commander">${UI.esc(t("trRebook"))}</a></li>` : ""}`
    : labels.map((k, i) => `<li class="${i < step || (i === step && i === 3) ? "done" : i === step ? "current" : ""}">${UI.esc(t(k))}</li>`).join("");

  $("#details").innerHTML = `
    <div><span>📍</span><span><b>${UI.esc(t("trPickup"))}</b><br>${UI.esc(o.pickup_address)}, ${UI.esc(cityLabel(o.from_city))}</span></div>
    <div><span>🏁</span><span><b>${UI.esc(t("trDrop"))}</b><br>${UI.esc(o.dropoff_address)}, ${UI.esc(cityLabel(o.to_city))}</span></div>
    ${o.admin_note && o.status !== "refusee" ? `<div><span>💬</span><span>${UI.esc(o.admin_note)}</span></div>` : ""}`;

  const pay = $("#payBox");
  pay.classList.toggle("hidden", o.status === "annulee" || o.status === "refusee");
  const bit = o.courier_bit || CONFIG.bitPhone;
  const copy = `<button class="btn btn-sm" id="copyBit">${UI.esc(t("trCopy"))}</button>`;
  pay.innerHTML = `<small class="muted">${UI.esc(t("trPay"))}</small>
    <div class="amount">${UI.money(o.price)}${o.budget ? ` <small class="muted">${UI.esc(t("qPurchaseNote"))}</small>` : ""}</div>
    ${o.payment_status === "paye" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>`
      : o.payment_method === "bit"
        ? `<p style="margin:6px 0">${UI.esc(t("trPayBit", { phone: bit, ref: o.ref }))}</p>${copy}`
        : `<p style="margin-top:6px">💵 ${UI.esc(t("trPayCash"))}</p>`}`;

  // Discussion directe : avec le livreur attribué, ou avec l'administration
  const hasCourier = !!o.courier_phone && ["confirmee", "recuperee"].includes(o.status);
  const first = (o.courier_name || "").split(" ")[0];
  const about = t("orderNo", { ref: o.ref }) + " — ";
  $("#noCourier").classList.toggle("hidden", hasCourier || o.status !== "nouvelle");
  ["#waCourier", "#callCourier"].forEach(s => $(s).classList.toggle("hidden", !hasCourier));
  if (hasCourier) {
    $("#waCourier").textContent = t("chatCourier", { name: first });
    $("#waCourier").href = UI.waLink(o.courier_phone, about);
    $("#callCourier").textContent = t("callCourier", { name: first });
    $("#callCourier").href = "tel:" + o.courier_phone;
  }
  $("#waAdmin").href = UI.waLink(CONFIG.whatsapp, about);
  $("#callAdmin").href = "tel:" + CONFIG.phoneDisplay;
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
  const bit = (order && order.courier_bit) || CONFIG.bitPhone;
  if (navigator.clipboard) navigator.clipboard.writeText(bit.replace(/\D/g, "")).then(done, done);
  else done();
});
window.addEventListener("storage", e => { if (/livraison\.(orders|courier)/.test(e.key || "")) load(); });

I18N.apply();
initMap();
load();
setInterval(load, 10000);

})();
