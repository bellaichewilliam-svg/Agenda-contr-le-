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
let notifTried = false;
function renderNotif(o) {
  const box = $("#notifCard"), live = ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  const can = live && window.Notification && "serviceWorker" in navigator && CONFIG.push && Store.ONLINE;
  if (can && Notification.permission === "granted" && !notifTried) { notifTried = true; UI.clientPushSubscribe(token, false); }
  const show = can && Notification.permission !== "granted";
  box.classList.toggle("hidden", !show);
  if (!show) return;
  box.innerHTML = Notification.permission === "denied" ? `<p class="small muted" style="margin:0">${UI.esc(I18N.t("trNotifDenied"))}</p>`
    : `<b>🔔 ${UI.esc(I18N.t("trNotifTitle"))}</b><p class="small muted" style="margin:4px 0 8px">${UI.esc(I18N.t("trNotifSub"))}</p>
       <button type="button" class="btn btn-primary btn-block" id="notifOn">${UI.esc(I18N.t("trNotifBtn"))}</button>`;
}
// « 📷 Je veux une photo à la livraison » : le livreur HOP! doit alors prendre la photo du colis avant « Livré »
function renderPhotoAsk(o) {
  const box = $("#photoCard");
  const live = ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  box.classList.toggle("hidden", !live || !!o.leave_at_door);
  if (!live || o.leave_at_door) return;
  box.innerHTML = o.photo_wanted ? `<p class="promo-msg ok" style="margin:0">${UI.esc(I18N.t("trPhotoOn"))}</p>`
    : `<b>📷 ${UI.esc(I18N.t("trPhotoTitle"))}</b><p class="small muted" style="margin:4px 0 8px">${UI.esc(I18N.t("trPhotoSub"))}</p>
       <button type="button" class="btn btn-block" id="photoOn">${UI.esc(I18N.t("trPhotoBtn"))}</button>`;
}
// Gros bouton « ✅ J'ai envoyé X ₪ à … » (ticket, complément, attente) ; une fois touché, un message de confirmation à la place
function sentBtn(amount, name, what) {
  if (!(Number(amount) > 0)) return "";
  const a = UI.money(amount);
  let sent = false;
  try { sent = !!sessionStorage.getItem("hop.sent." + token + "." + what + "." + a); } catch (ex) { /* pas de stockage */ }
  return sent ? `<p class="promo-msg ok">${UI.esc(I18N.t("sentOk", { name }))}</p>`
    : `<button type="button" class="btn btn-primary btn-block sent-btn" data-sent="1" data-what="${what}" data-amount="${UI.esc(a)}" data-name="${UI.esc(name)}">${UI.esc(I18N.t("sentBtn", { amount: a, name }))}</button>`;
}
const W = CONFIG.pricing.waiting;
let settings = { wait_free_min: W.freeMinutes, wait_step_min: W.stepMinutes, wait_step_price: W.stepPrice, wait_max: W.max };
Store.getSettings().then(s => { Object.assign(settings, s); UI.setZonesOpen(s.zones_open); if (order) render(); }).catch(() => {});
let map = null, markers = {}, fitted = false, courierSeen = false;

function cityLabel(id) { return CONFIG.cities.some(c => c.id === id) ? I18N.cityName(id) : id; }

function initMap() {
  if (!window.L) { $("#map").classList.add("hidden"); return; }
  const home = Pricing.cityById(CONFIG, CONFIG.homeCity);
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([home.lat, home.lon], 12);
  UI.mapTiles(map, true);
  // Toucher la carte l'ouvre en grand (la pastille du temps reste en haut)
  map.on("click", () => { if (!document.body.classList.contains("map-full")) setMapFull(true); });
}

// Sombre la nuit, clair le jour (lever / coucher du soleil à l'adresse de livraison), revu chaque minute
function applyDayNight() {
  const o = order || {}, home = Pricing.cityById(CONFIG, CONFIG.homeCity) || {};
  const lat = Number(o.dropoff_lat ?? home.lat), lon = Number(o.dropoff_lon ?? home.lon);
  const day = !UI.isNight(lat, lon);
  document.body.classList.toggle("trk-day", day);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = day ? "#FFFFFF" : "#0B0F1A";
}
applyDayNight();
setInterval(applyDayNight, 60000);

function pin(emoji) {
  if (emoji === "📍") return L.divIcon({ className: "", html: `<div class="trk-pin-shop"><span>${order && (order.service === "repas" || order.shop_id) ? "🍴" : "🏪"}</span></div>`, iconSize: [44, 52], iconAnchor: [22, 50] });
  if (emoji === "🏁") return L.divIcon({ className: "", html: `<div class="trk-pin-home"><i></i></div>`, iconSize: [52, 62], iconAnchor: [26, 60] });
  return L.divIcon({ className: "", html: `<div class="map-pin">${emoji}</div>`, iconSize: [32, 32], iconAnchor: [16, 28] });
}

function setMarker(key, lat, lon, emoji) {
  if (!map || lat == null || lon == null) return;
  if (markers[key]) markers[key].setLatLng([lat, lon]);
  else markers[key] = L.marker([lat, lon], { icon: pin(emoji), zIndexOffset: key === "courier" ? 1000 : 0 }).addTo(map);
}

// Le scooter du livreur glisse en douceur d'une position à la suivante (pas de saut)
let anim = null, routeLine = null, baseLine = null;
const scooterIcon = () => L.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23], html: `<div class="trk-scooter"><span>🛵</span></div>` });
// Le scooter regarde dans le sens de sa route (cap entre deux positions)
function headScooter(from, to) {
  const el = markers.courier && markers.courier.getElement() && markers.courier.getElement().querySelector(".trk-scooter > span");
  if (!el) return;
  const dy = to.lat - from.lat, dx = (to.lng - from.lng) * Math.cos(from.lat * Math.PI / 180);
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
  // (l'emoji roule vers la gauche : miroir quand on va vers l'est)
  el.style.transform = dx > 0 ? "scaleX(-1)" : "";
}
function moveCourier(lat, lon) {
  if (!map) return;
  if (!markers.courier) { markers.courier = L.marker([lat, lon], { icon: scooterIcon(), zIndexOffset: 1000 }).addTo(map); return; }
  const from = markers.courier.getLatLng(), to = L.latLng(lat, lon);
  if (from.equals(to)) return;
  headScooter(from, to);
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
  return r ? { big: r.text, unit: t("trMinUnit") } : { big: o.status === "nouvelle" ? "⏳" : "🛵", unit: "" };
}
function renderRing(o) {
  const show = ["nouvelle", "confirmee", "recuperee"].includes(o.status);
  $("#etaRing").classList.toggle("hidden", !show);
  $("#stRing").classList.toggle("hidden", !show);
  $("#trkPill").classList.toggle("hidden", !show);
  document.body.classList.toggle("trk-done", !show);
  const shopName = UI.bi(o.shop_name || o.pickup_place || "") || o.pickup_address || "";
  $("#stShop").textContent = [shopName, t("orderNo", { ref: o.ref })].filter(Boolean).join(" · ");
  $("#stTitle").textContent = String(lastEta.main).replace(/ (\S{1,4})$/, "\u00a0$1");
  $("#stSub").textContent = lastEta.sub;
  $("#stDetails").innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>${UI.esc(t("trDetails"))}`;
  if (!show) { $("#stSteps").innerHTML = ""; return; }
  const r = ringText(o), p = UI.PROGRESS[o.status] || 0;
  $("#pillSvg").innerHTML = UI.ringSvg(p, "hrg-pill");
  $("#pillMin").textContent = r.unit ? `${r.big} ${r.unit}` : r.big;
  $("#pillShop").textContent = shopName;
  $("#etaSvg").innerHTML = UI.ringSvg(p, "hrg-trk");
  $("#etaMin").textContent = r.big;
  $("#etaMin").classList.toggle("long", r.big.length > 4);
  $("#etaUnit").textContent = r.unit;
  // Page d'état (si ouverte, elle suit en direct)
  $("#stSvg").innerHTML = UI.ringSvg(p, "hrg-st");
  $("#stMin").textContent = r.big;
  $("#stUnit").textContent = r.unit;
  const step = FLOW.indexOf(o.status);
  $("#stSteps").innerHTML = ["trStep1", "trStep2", "trStep3", "trStep4"].map((k, i) =>
    `<li class="${i < step ? "done" : i === step ? "current" : ""}"><i></i><span>${UI.esc(t(k))}</span></li>`).join("");
}
// Le statut est sur la page (plus de fenêtre à part) : « ouvrir » = revenir au statut
function openSheet() { if (document.body.classList.contains("map-full")) setMapFull(false); $("#trkStatus").scrollIntoView({ behavior: "smooth", block: "start" }); }
function closeSheet() { /* rien : le statut fait partie de la page */ }
$("#etaRing").addEventListener("click", openSheet);
$("#trkPill").addEventListener("click", openSheet);
$("#trkBackStatus").addEventListener("click", () => setMapFull(false));
$("#trkLang").addEventListener("click", () => $("#langBtn").click());
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
  // Une belle courbe (pas un trajet routier) : commerce → vous en clair, et le livreur → son prochain arrêt en orange
  if (false && !baseLine && o.pickup_lat != null && o.dropoff_lat != null) baseLine = UI.routeLayer([o.pickup_lat, o.pickup_lon], [o.dropoff_lat, o.dropoff_lon], { color: "#98A2B3", opacity: .7, weight: 4, glow: "#FFFFFF", glowOpacity: .5 }).addTo(map);
  const tgt = o.status === "confirmee" ? [o.pickup_lat, o.pickup_lon] : o.status === "recuperee" ? [o.dropoff_lat, o.dropoff_lon] : null;
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (false && live && tgt && tgt[0] != null) routeLine = UI.routeLayer([Number(o.courier_lat), Number(o.courier_lon)], [Number(tgt[0]), Number(tgt[1])], { color: "#FF6A00" }).addTo(map);
  // Recentrer au premier affichage et quand le coursier apparaît
  if (!fitted || (live && !courierSeen)) {
    const pts = Object.values(markers).map(m => m.getLatLng());
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), fitOpts(15));
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
// Photo prise sur place par le livreur (obligatoire pour annoncer l'attente) : montrée au client avec le montant
let waPhoto = { key: null, src: "" };
async function loadWaitPhoto(o) {
  const key = o.id + o.wait_ann_at;
  if (waPhoto.key === key) return;
  waPhoto = { key, src: "" };
  try {
    const list = await Store.chatOrder(token);
    const from = new Date(o.wait_ann_at).getTime() - 6 * 60000;
    const m = (list || []).filter(x => x.author === "courier" && x.image && new Date(x.created_at).getTime() >= from).pop();
    if (waPhoto.key === key && m) { waPhoto.src = m.image; waitAsk(o); }
  } catch (e) { /* ignore */ }
}
function waitAsk(o) {
  const box = $("#waitAsk");
  const st = o.wait_ann_status, open = o.status === "confirmee" && !!st && st !== "refus";
  box.classList.toggle("hidden", !open);
  askPop(box, open && st === "attente" && Date.now() - new Date(o.wait_ann_at) < 180000, "wait:" + o.wait_ann_at);
  if (!open) { box.innerHTML = ""; box.dataset.html = ""; return; }
  // Nouvelle annonce : le téléphone vibre
  if (o.wait_ann_at && lastAnn && lastAnn !== o.wait_ann_at && navigator.vibrate) navigator.vibrate([300, 120, 300]);
  lastAnn = o.wait_ann_at;
  if (st === "attente") loadWaitPhoto(o);
  const left = Math.max(0, 180 - Math.floor((Date.now() - new Date(o.wait_ann_at)) / 1000));
  const fix = o.wait_fix != null;
  const fee = UI.money(fix ? Number(o.wait_fix) : Store.waitFeeFor(o.wait_ann_cap, settings, o));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const photo = waPhoto.src && waPhoto.key === o.id + o.wait_ann_at
    ? `<figure class="wa-photo"><img src="${UI.esc(waPhoto.src)}" alt="" /><figcaption>${UI.esc(t("waPhotoCap"))}</figcaption></figure>` : "";
  const html = st === "info" ? `<b>${UI.esc(t("waInfo", { min: o.wait_ann_min }))}</b>`
    : st === "attente" && left > 0 ? `<b>${UI.esc(fix ? t("waFixTitle") : t("waAnnTitle", { min: o.wait_ann_min }))}</b>${photo}
      <div class="wa-amount">${UI.esc(fix ? t("waAmountFix", { fee: "\u2066+" + fee + "\u2069" }) : t("waAmount", { fee: "\u2066+" + fee + "\u2069" }))}</div>
      <small>${UI.esc(fix ? t("waFixFee", { left: clock }) : t("waAnnFee", { fee, free: Store.freeMinOf(o, settings), price: UI.money(settings.wait_step_price), left: clock }))}</small>
      ${fix ? "" : `<small class="wa-rule">${UI.esc(t("waRule"))}</small>`}
      <div class="btns"><button type="button" class="btn btn-primary" data-wa-ok>${UI.esc(t("waOk"))}</button>
        <button type="button" class="btn" data-wa-drop>${UI.esc(t("waDrop"))}</button></div>`
    : `<b>${UI.esc(fix ? t("waFixAccepted", { fee }) : t("waAccepted", { fee, min: o.wait_ann_min }))}</b>`;
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
    // « Prête » seulement quand le commerce l'a dit ; temps annoncé passé sans confirmation → « termine »
    else if (o.shop_status === "prete") { if (o.status === "nouvelle") main = t("trShopReady"); else sub = t("trShopReady"); }
    else if (o.shop_status === "acceptee" && left <= 0) { if (o.status === "nouvelle") main = t("trShopAlmost", { name }); else sub = t("trShopAlmost", { name }); }
  }
  if (o.status === "refusee" && o.shop_status === "refusee") main = t("trShopRefused", { name: o.shop_name || "" });
  // Livraison demandée à partir d'une heure (écrite dans la note) : rappelée tant qu'elle n'est pas passée
  const nb = UI.notBefore(o);
  if (nb && nb > Date.now() && ["nouvelle", "confirmee"].includes(o.status)) sub = t("trNotBefore", { time: UI.fmtTime(nb) });
  if (live && o.courier_at && ["confirmee", "recuperee"].includes(o.status) && !(o.status === "confirmee" && o.arrived_at) && !sub) {
    const s = Math.max(0, Math.round((Date.now() - new Date(o.courier_at)) / 1000));
    sub = t("trUpdated", { s });
  }
  lastEta = { main, sub };
  $("#eta").innerHTML = `<small>${UI.esc(t("orderNo", { ref: o.ref }))}</small><b>${UI.esc(main)}</b>${sub ? `<small>${UI.esc(sub)}</small>` : ""}`;
}

// Carte du livreur sur la carte : prénom, « arrive dans ≈ X min · 1,2 km », appeler, écrire
function renderCourierCard(o) {
  const box = $("#trkCard"), live = o && o.courier_lat != null && ["confirmee", "recuperee"].includes(o.status);
  document.body.classList.toggle("trk-live", !!(o && ["confirmee", "recuperee"].includes(o.status)));
  $("#trkFull").classList.toggle("hidden", !live);
  box.classList.toggle("hidden", !live);
  $("#trkCardIn").classList.toggle("hidden", !live);
  if (!live) return;
  const name = String(o.courier_name || "").split(" ")[0] || t("tkCourier"), courier = { lat: o.courier_lat, lon: o.courier_lon };
  const tgt = o.status === "confirmee" ? { lat: o.pickup_lat, lon: o.pickup_lon } : { lat: o.dropoff_lat, lon: o.dropoff_lon };
  const min = tgt.lat != null ? Pricing.etaMinutes(courier, tgt) : null, km = tgt.lat != null ? (Pricing.haversineKm(courier, tgt) * 1.3).toFixed(1).replace(".", ",") : null;
  const initials = name.slice(0, 2).toUpperCase();
  const phone = String(o.courier_phone || "").replace(/[^\d+]/g, "");
  const html = `<span class="trk-ava">${UI.esc(initials)}</span><span class="trk-txt"><b>${UI.esc(min != null ? t(o.status === "confirmee" ? "tkToPickup" : "tkToDrop", { name, min }) : name)}</b><small>🛵 ${UI.esc(t("tkCourier"))}${km ? " · " + UI.esc(t("tkDist", { km })) : ""}</small></span>
    ${phone ? `<a class="trk-btn" href="tel:${UI.esc(phone)}" aria-label="${UI.esc(t("trCall"))}">📞</a>` : ""}<button type="button" class="trk-btn wa" data-trk-chat aria-label="${UI.esc(t("chOpen"))}">💬</button>`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  const inl = $("#trkCardIn");
  if (inl.dataset.html !== html) { inl.innerHTML = html; inl.dataset.html = html; }
}
$("#trkCardIn").addEventListener("click", e => { if (e.target.closest("[data-trk-chat]")) $("#chatBtn").click(); });
// Marges pour que les épingles ne passent ni sous les boutons du haut ni sous l'anneau (ou le bouton du bas en plein écran)
function fitOpts(maxZoom) {
  if (!document.body.classList.contains("trk-v2")) return { maxZoom };
  const full = document.body.classList.contains("map-full");
  return { maxZoom, paddingTopLeft: [30, full ? 100 : 80], paddingBottomRight: [30, full ? 110 : 150] };
}
function setMapFull(on) {
  document.body.classList.toggle("map-full", on);
  if (on) window.scrollTo(0, 0);
  $("#trkFull").textContent = on ? "⤡" : "⤢";
  $("#trkFull").setAttribute("aria-label", on ? t("tkSmall") : t("tkFull"));
  if (map) setTimeout(() => { map.invalidateSize(); const pts = Object.values(markers).map(m => m.getLatLng()); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), fitOpts(16)); }, 60);
}
$("#trkFull").addEventListener("click", () => setMapFull(!document.body.classList.contains("map-full")));
$("#trkCard").addEventListener("click", e => { if (e.target.closest("[data-trk-chat]")) { if (document.body.classList.contains("map-full")) setMapFull(false); $("#chatBtn").click(); } });
function render() {
  const o = order;
  I18N.apply();
  renderCourierCard(o);
  $("#brandName").innerHTML = UI.wordmark();
  document.body.classList.toggle("trk-notfound", !o);
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
  renderShopRate(o);
  renderDoneFlow(o);
  applyDayNight();

  const step = FLOW.indexOf(o.status);
  const labels = ["trStep1", "trStep2", "trStep3", "trStep4"];
  $("#steps").innerHTML = o.status === "annulee" || o.status === "refusee"
    ? `<li class="done">${UI.esc(t(o.status === "annulee" ? "trCancelled" : "trRefused"))}</li>
       ${o.status === "refusee" ? `<li style="padding-inline-start:0"><a class="btn btn-sm btn-primary" href="index.html#commander">${UI.esc(t("trRebook"))}</a></li>` : ""}`
    : labels.map((k, i) => `<li class="${i < step || (i === step && i === 3) ? "done" : i === step ? "current" : ""}">${UI.esc(t(k))}</li>`).join("");

  $("#details").innerHTML = `
    <div><span>📍</span><span><b>${UI.esc(t("trPickup"))}</b><br>${UI.brand(o.pickup_place)}<bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(cityLabel(o.from_city))}${UI.addrDetails(o, "pickup", I18N.lang)}${UI.addrNote(o.pickup_note)}</span></div>
    <div><span>🏁</span><span><b>${UI.esc(t("trDrop"))}</b><br>${UI.brand(o.dropoff_place)}<bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(cityLabel(o.to_city))}${UI.addrDetails(o, "dropoff", I18N.lang)}${UI.addrNote(o.dropoff_note)}${UI.doorTag(o, I18N.lang)}</span></div>
    ${(o.phone_order || o.shop_sent) && o.ready_at && ["nouvelle", "confirmee"].includes(o.status) ? `<div><span>📞</span><span>${UI.esc(t("trPhoneReady", { time: new Date(o.ready_at).toLocaleTimeString(I18N.lang === "he" ? "he-IL" : "fr-FR", { hour: "2-digit", minute: "2-digit" }) }))}</span></div>` : ""}
    ${docsBlock(o)}
    ${claimBlock(o)}
    ${o.admin_note && o.status !== "refusee" ? `<div><span>💬</span><span>${UI.esc(o.admin_note)}</span></div>` : ""}`;

  // Notifications sur ce téléphone (livreur accepté, en route, livré) : proposées tant que la course n'est pas finie
  renderNotif(o);
  renderPhotoAsk(o);

  const pay = $("#payBox");
  const dropped = o.status === "annulee" && Number(o.drop_fee) > 0;
  pay.classList.toggle("hidden", (o.status === "annulee" && !dropped) || o.status === "refusee");
  const bit = UI.bitFor(o);
  // Trompé de moyen de paiement : on change tant que rien n'est payé
  // (passer en espèces après coup n'est pas possible : plafond et livreur choisis pour Bit)
  // Articles payés d'avance au livreur : le détail, puis le ticket et la différence rendue (ou le complément à envoyer)
  const goodsLine = x => {
    const name = String(x.courier_name || "").split(" ")[0], ph = String(x.courier_bit || x.courier_phone || "").replace(/\D/g, "");
    const cash = x.payment_method === "cash";
    const head = `<p class="small muted" style="margin:2px 0 0">${UI.esc(t(cash ? "trGoodsSplitCash" : x.goods_after ? "trGoodsAfterSplit" : "trGoodsSplit", { ride: UI.money(x.price), goods: UI.money(x.goods_budget) }))}</p>`;
    if (x.goods_spent == null) return head;
    // Ticket après : le client envoie le montant exact du ticket au livreur, qui livre dès réception
    if (x.goods_after && !cash) {
      const due = x.goods_refund_status === "a_completer", v = { spent: UI.money(x.goods_spent), name };
      return head + `<div class="refund-box${due ? " wait-due" : ""}"><p><b>🧾 ${UI.esc(t(due ? "trGoodsAfterDue" : "trGoodsAfterOk", v))}</b></p>
        ${due && ph ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(ph)}">${UI.esc(t("bpCopy"))}</button></div>${sentBtn(x.goods_refund, name, "ticket")}` : ""}</div>`;
    }
    if (cash) return `<div class="refund-box"><p><b>🧾 ${UI.esc(t("trGoodsCash", { spent: UI.money(x.goods_spent), total: UI.money(Number(x.price) + Number(x.goods_spent)) }))}</b></p></div>`;
    const st = x.goods_refund_status, v = { spent: UI.money(x.goods_spent), diff: UI.money(x.goods_refund), name };
    return head + `<div class="refund-box${st === "a_completer" ? " wait-due" : ""}"><p><b>🧾 ${UI.esc(t(st === "a_rendre" ? "trGoodsBack" : st === "rendu" ? "trGoodsBackDone" : st === "a_completer" ? "trGoodsMore" : "trGoodsExact", v))}</b></p>
      ${st === "a_completer" && ph ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(ph)}">${UI.esc(t("bpCopy"))}</button></div>${sentBtn(x.goods_refund, name, "more")}` : ""}</div>`;
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
        ${phone ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(phone).replace(/\D/g, ""))}">${UI.esc(t("bpCopy"))}</button></div>${sentBtn(o.wait_due, who, "drop")}` : ""}</div>`
      : o.wait_status === "recu" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>` : ""}`;
  } else
  // Articles payés d'avance au commerce : ① le commerce, ② la livraison
  // (commerce sans lien ni Bit : le montant des articles et à qui le payer, quand même)
  pay.innerHTML = `${o.goods_pay && o.shop_pay ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p>${UI.goodsPay(o, o.shop_pay)}<p class="gp-step2"><b>${UI.esc(t("gpStep2", { amount: UI.money(o.price) }))}</b></p>`
    : o.shop_pay && Number(o.items_total) > 0 && o.payment_method !== "cash" ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p><div class="goods-pay todo"><b class="gp-step">${UI.esc(t("gpStep1", { name: UI.bi(o.shop_pay.name), amount: UI.money(o.items_total) }))}</b><small>${UI.esc(t("gbAsk", { name: UI.bi(o.shop_pay.name) }))}</small></div><p class="gp-step2"><b>${UI.esc(t("gpStep2", { amount: UI.money(o.price) }))}</b></p>` : ""}${refund}${missing}<small class="muted">${UI.esc(t("trPay"))}</small>
    <div class="amount">${UI.money(o.payment_method === "cash" ? Number(o.price) + Number(o.cash_goods || 0) : UI.payTotal(o))}${o.budget && !o.goods_prepay ? ` <small class="muted">${UI.esc(t("qPurchaseNote"))}</small>` : ""}</div>
    ${UI.areaWhy(o) ? `<p class="area-why-note">${UI.esc(UI.areaWhy(o))}</p>` : ""}
    ${o.goods_prepay ? goodsLine(o) : ""}
    ${Number(o.wait_fee) > 0 ? `<p class="small muted" style="margin:2px 0 0">⏱️ ${UI.esc(t("trWaitFee", { fee: UI.money(o.wait_fee), min: o.wait_minutes }))}</p>` : ""}
    ${o.wait_status === "a_payer" ? `<div class="refund-box wait-due"><p><b>${UI.esc(t("trWaitDue", { fee: UI.money(o.wait_due), name: String(o.courier_name || "").split(" ")[0], phone: o.courier_bit || o.courier_phone || "" }))}</b></p>
      ${o.courier_bit || o.courier_phone ? `<div class="bit-btns"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(o.courier_bit || o.courier_phone).replace(/\D/g, ""))}">${UI.esc(t("bpCopy"))}</button></div>${sentBtn(o.wait_due, String(o.courier_name || "").split(" ")[0], "wait")}` : ""}</div>`
      : o.wait_status === "recu" ? `<p class="promo-msg ok">${UI.esc(t("trWaitDueOk"))}</p>` : ""}
    ${o.payment_status === "paye" ? `<p class="promo-msg ok">${UI.esc(t("trPaid"))}</p>${UI.receiptNo(o) ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}">${UI.esc(t("receiptLink"))}</a>` : ""}`
      : o.payment_method === "bit"
        ? `${o.prepaid_required && !o.direct_pay ? `<p class="promo-msg bad" style="margin-top:6px">${UI.esc(t("trPrepay"))}</p>` : ""}${UI.bitPay(o)}`
        : `<div class="cash-box"><p class="cash-total">${UI.esc(t("trCashPay", { total: UI.money(Number(o.price) + Number(o.cash_goods || 0)) }))}</p>
            ${Number(o.cash_goods) > 0 ? `<small>${UI.esc(t("trCashGoods", { goods: UI.money(o.cash_goods) }))}</small><br>` : ""}
            <small>${UI.esc(Number(o.cash_note) > 0 ? t("trCashChange", { note: UI.money(o.cash_note), change: UI.money(Number(o.cash_note) - Number(o.price) - Number(o.cash_goods || 0)) }) : t("trCashExact"))}</small></div>`}
    ${canSwitch ? `<button class="btn btn-sm btn-link" id="switchPay">${UI.esc(t(o.payment_method === "bit" ? "trToCash" : "trToBit"))}</button>` : ""}`;

  // Course envoyée et payée par le commerce : rien à payer pour le client (le commerce garde son lien « &shop=1 »)
  if (o.shop_sent && o.payer === "moi" && !dropped && !new URLSearchParams(location.search).has("shop"))
    pay.innerHTML = `<p class="promo-msg ok">${UI.esc(t("trShopPaid", { shop: o.shop_name || "" }))}</p>`;
  // Livraison offerte par le commerce : seulement les articles à lui payer (s'il y en a), rien pour la livraison
  if (o.shop_pays && !dropped)
    pay.innerHTML = `${o.goods_pay && o.shop_pay ? `<p class="pay2-h">${UI.esc(t("pay2Title"))}</p>${UI.goodsPay(o, o.shop_pay)}<p class="gp-step2"><b>${UI.esc(t("gpStep2Gift", { name: UI.bi(o.shop_name || "") }))}</b></p>` : ""}
      <p class="promo-msg ok">${UI.esc(t("giftNote", { name: UI.bi(o.shop_name || "") }))}</p>`;

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
  $("#trkShare").href = $("#shareBtn").href;
  $("#trkLang").textContent = I18N.lang === "he" ? "FR" : "עב";
  $("#trkBackStatus").textContent = t("trBackStatus");
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
// Avis sur le commerce (après la livraison d'une commande chez un commerce), à part de la note du livreur
const srate = { stars: 0, note: "", sent: 0 };
function renderShopRate(o) {
  const box = $("#shopRateBox"), name = UI.bi(o.shop_name || "");
  const can = o.status === "livree" && !!o.shop_id && o.shop_rating == null && Date.now() - new Date(o.pickup_at) < 30 * 86400000;
  if (srate.sent) { box.innerHTML = `<p class="rate-thanks">${UI.esc(t("srThanks", { name }))}</p>`; box.classList.remove("hidden"); return; }
  if (o.shop_rating != null && o.shop_id) { box.innerHTML = `<p class="rate-thanks">${UI.esc(t("srYours", { name, stars: "⭐".repeat(o.shop_rating) }))}</p>`; box.classList.remove("hidden"); return; }
  box.classList.toggle("hidden", !can);
  if (!can || box.contains(document.activeElement)) return;
  const html = `<h3>${UI.esc(t("srTitle", { name }))}</h3><p class="muted small">${UI.esc(t("srSub"))}</p>
    <div class="rate-stars" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= srate.stars ? "on" : ""}" data-sstar="${n}" aria-label="${n}/5">★</button>`).join("")}</div>
    ${srate.stars ? `<textarea id="srNote" rows="2" maxlength="300" placeholder="${UI.esc(t("srPh", { name }))}">${UI.esc(srate.note)}</textarea>
      <button type="button" class="btn btn-primary btn-block" id="srSend">${UI.esc(t("srSend"))}</button>` : `<p class="muted small" style="text-align:center">${UI.esc(t("rtPick"))}</p>`}`;
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
$("#shopRateBox").addEventListener("input", e => { if (e.target.id === "srNote") srate.note = e.target.value; });
$("#shopRateBox").addEventListener("click", async e => {
  const star = e.target.closest("[data-sstar]");
  if (star) { srate.stars = Number(star.dataset.sstar); star.blur(); $("#shopRateBox").dataset.html = ""; renderShopRate(order); return; }
  if (e.target.id !== "srSend" || !order) return;
  e.target.disabled = true;
  const ok = await Store.rateShop(token, srate.stars, srate.note).catch(() => false);
  if (!ok) { e.target.disabled = false; return alert(I18N.lang === "he" ? "לא נשלח, נסו שוב." : "Non envoyé, réessayez."); }
  srate.sent = srate.stars; order.shop_rating = srate.stars;
  renderShopRate(order);
});
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

// --- Écran plein après la livraison : 5 visages + pourboire, puis petits mots, puis merci --------
// S'ouvre une fois à la livraison tant que la course n'est pas notée ; « Passer » le referme pour de bon
// (les cartes de note et de pourboire restent sur la page).
const FACES = [
  '<path d="M15 19l5 3-5 3M33 19l-5 3 5 3" stroke-width="2.6"/><path d="M15 36c3-5 15-5 18 0" stroke-width="2.8"/>',
  '<circle cx="17" cy="21" r="2.8"/><circle cx="31" cy="21" r="2.8"/><path d="M16 35c3-4.5 13-4.5 16 0" stroke-width="2.8"/>',
  '<circle cx="17" cy="21" r="2.8"/><circle cx="31" cy="21" r="2.8"/><path d="M17 32h14" stroke-width="2.8"/>',
  '<circle cx="17" cy="21" r="2.8"/><circle cx="31" cy="21" r="2.8"/><path d="M15.5 29.5c3.5 5 13.5 5 17 0" stroke-width="2.8"/>',
  '<path d="M13.5 22c1.5-3.5 5.5-3.5 7 0M27.5 22c1.5-3.5 5.5-3.5 7 0" stroke-width="2.6"/><path d="M14 28h20c0 6-4.5 9-10 9s-10-3-10-9z" class="df-mouth"/>'
];
const df = { step: 0, stars: 0, tip: 0, tags: new Set(), note: "", open: false, shown: false, err: "" };
const dfKey = o => "hop.doneflow." + o.ref;
function dfSkipped(o) { try { return localStorage.getItem(dfKey(o)) === "1"; } catch (e) { return false; } }
function renderDoneFlow(o) {
  const box = $("#doneFlow");
  if (!box) return;
  if (!df.shown) {
    const recent = Date.now() - new Date(o.delivered_at || o.pickup_at) < 7 * 86400000;
    if (o.status !== "livree" || o.rating != null || rate.sent || !recent || dfSkipped(o)) return;
    df.shown = df.open = true;
    drawDoneFlow();
  }
}
function closeDoneFlow(skip) {
  df.open = false;
  if (skip && order) { try { localStorage.setItem(dfKey(order), "1"); } catch (e) { /* ignore */ } }
  $("#doneFlow").classList.add("hidden");
  document.body.classList.remove("df-open");
}
function drawDoneFlow() {
  const box = $("#doneFlow"), o = order;
  if (!df.open || !o) return;
  const day = new Date(o.delivered_at || o.pickup_at).toLocaleDateString(I18N.lang === "he" ? "he-IL" : "fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const who = o.shop_name ? UI.bi(o.shop_name) : "HOP!";
  const canTip = !!o.courier_id && !o.tip_status;
  const tips = [0, ...(CONFIG.platform.tips || [5, 10, 15])];
  let body = "";
  if (df.step === 0) {
    body = `<div class="df-logo"><img src="hop-orange-512.png" alt="HOP!" width="132" height="132" /></div>
      <p class="df-meta">${UI.esc(who)} · ${UI.esc(day)}</p>
      <h2 class="df-title">${UI.esc(t("dfTitle"))}</h2>
      <p class="df-sub">${UI.esc(t("dfSub"))}</p>
      <div class="df-faces${df.stars ? " picked" : ""}" role="radiogroup">${FACES.map((f, i) => `<button type="button" class="df-face${df.stars === i + 1 ? " on" : ""}" data-face="${i + 1}" role="radio" aria-checked="${df.stars === i + 1}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" class="df-skin"/><g class="df-feat">${f}</g></svg><span>${UI.esc(t("dfF" + (i + 1)))}</span></button>`).join("")}</div>
      ${canTip ? `<h3 class="df-h3">${UI.esc(t("dfTipTitle"))}</h3><p class="df-sub">${UI.esc(t("dfTipSub"))}</p>
      <div class="df-tips" style="--n:${tips.length}">${tips.map(n => `<button type="button" class="df-tip${df.tip === n ? " on" : ""}" data-dftip="${n}">${UI.money(n)}</button>`).join("")}</div>` : ""}
      <div class="df-foot"><button type="button" class="df-next" id="dfNext"${df.stars ? "" : " disabled"}>${UI.esc(t("dfNext"))}</button></div>`;
  } else if (df.step === 1) {
    const tags = df.stars <= 3 ? BAD : GOOD;
    body = `<div class="df-bigface"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" class="df-skin"/><g class="df-feat">${FACES[df.stars - 1]}</g></svg></div>
      <h2 class="df-title">${UI.esc(t(df.stars <= 3 ? "dfBadQ" : "dfGoodQ"))}</h2>
      <div class="df-tags">${tags.map(k => `<button type="button" class="df-tag${df.tags.has(k) ? " on" : ""}" data-dftag="${k}">${UI.esc(t("rt_" + k))}</button>`).join("")}</div>
      <textarea id="dfNote" rows="3" maxlength="300" placeholder="${UI.esc(t("rtNotePh"))}">${UI.esc(df.note)}</textarea>
      ${df.err ? `<p class="df-err">${UI.esc(df.err)}</p>` : ""}
      <div class="df-foot"><button type="button" class="df-next" id="dfSend">${UI.esc(df.tip ? t("dfSendTip", { amount: UI.money(df.tip) }) : t("dfSend"))}</button></div>`;
  } else {
    const tipLine = df.tip ? `<p class="df-pay">${UI.esc(t("dfTipPay", { amount: UI.money(df.tip), phone: UI.bitFor(o), ref: String(o.ref).replace(/-/g, "\u2011") }))}</p><button type="button" class="df-ghost" id="dfCopy">${UI.esc(t("trCopy"))}</button>` : "";
    body = `<div class="df-logo df-ok"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 25l7 7 15-16" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h2 class="df-title">${UI.esc(t("dfThanks"))}</h2>
      <p class="df-sub">${UI.esc(t(df.stars <= 3 ? "dfLowSub" : "dfOkSub"))}</p>
      ${tipLine}
      <div class="df-foot"><button type="button" class="df-next" id="dfDone">${UI.esc(t("dfDone"))}</button></div>`;
  }
  box.innerHTML = `<div class="df-in">${df.step < 2 ? `<button type="button" class="df-skip" id="dfSkip">${UI.esc(t("dfSkip"))}</button>` : ""}${body}</div>`;
  box.classList.remove("hidden");
  document.body.classList.add("df-open");
}
$("#doneFlow").addEventListener("input", e => { if (e.target.id === "dfNote") df.note = e.target.value; });
$("#doneFlow").addEventListener("click", async e => {
  const face = e.target.closest("[data-face]");
  if (face) { const was = df.stars; df.stars = Number(face.dataset.face); if ((was <= 3) !== (df.stars <= 3)) df.tags.clear(); return drawDoneFlow(); }
  const tp = e.target.closest("[data-dftip]");
  if (tp) { df.tip = Number(tp.dataset.dftip); return drawDoneFlow(); }
  const tg = e.target.closest("[data-dftag]");
  if (tg) { df.tags.has(tg.dataset.dftag) ? df.tags.delete(tg.dataset.dftag) : df.tags.add(tg.dataset.dftag); return drawDoneFlow(); }
  const id = e.target.closest("button")?.id;
  if (id === "dfSkip") return closeDoneFlow(true);
  if (id === "dfNext" && df.stars) { df.step = 1; return drawDoneFlow(); }
  if (id === "dfCopy") { navigator.clipboard && navigator.clipboard.writeText(String(UI.bitFor(order))).catch(() => {}); e.target.textContent = "✓"; return; }
  if (id === "dfDone") return closeDoneFlow(false);
  if (id === "dfSend") {
    e.target.disabled = true;
    try {
      if (!(await Store.rateOrder(token, df.stars, [...df.tags], df.note))) throw new Error("refused");
      rate.sent = df.stars;
      if (df.tip && !(await Store.tipOrder(token, df.tip).catch(() => false))) df.tip = 0;
      df.step = 2; df.err = "";
      if (df.stars >= 4) celebrate();
      drawDoneFlow();
      load();
    } catch (ex) {
      df.err = t("rtErr");
      drawDoneFlow();
    }
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
    addon = order && ["nouvelle", "confirmee"].includes(order.status) && !order.addon_of ? await Store.orderAddonInfo(token).catch(() => addon) : null;
    if (addon && addon.ok && !addonShops) addonShops = await Store.shopsShowcase().catch(() => []);
  } catch (e) {
    return; // nouvel essai au prochain passage
  }
  render();
}

// --- Ajouter des articles du même commerce (catalogue HOP! Pro) : pendant 15 min, tant qu'elle n'est pas prête ---
let addable = null, addCart = {}, addDone = false;
// Ajouter un autre commerce proche pour 10 ₪ (pendant 15 min) : les commerces avec catalogue, ouverts, à 2 km du départ
let addon = null, addonShops = null;
const aoLeft = () => (addon && addon.ok ? Math.max(0, Math.floor((new Date(addon.until) - Date.now()) / 1000)) : 0);
function addonList() {
  if (!addon || !addonShops) return [];
  const km = (a, b) => 111.32 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180));
  return addonShops.filter(s => Number(s.products) > 0 && s.name !== (order && order.shop_name)
      && (!UI.openState(s.hours) || UI.openState(s.hours).open)
      && (addon.lat == null || s.lat == null || km({ lat: +s.lat, lon: +s.lon }, { lat: +addon.lat, lon: +addon.lon }) <= Number(addon.km || 2)))
    .slice(0, 10);
}
function addonCard() {
  const s = aoLeft(), list = addonList();
  if (!s || !list.length) return "";
  return `<div class="ao-card"><div class="ao-head"><span><b>${UI.esc(t("aoTitle"))}</b><small>${UI.esc(t("aoSub", { price: UI.money(addon.price) }))}</small></span>
      <i class="add-timer" dir="ltr">${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}<small>${UI.esc(t("aoLeft"))}</small></i></div>
    <div class="ao-shops">${list.map(x => { const logo = UI.safeImg(x.logo), ini = String(UI.bi(x.name) || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
      return `<a class="ao-shop" href="index.html?c=${encodeURIComponent(x.code)}&addon=${encodeURIComponent(token)}"><span>${logo ? `<img src="${logo}" alt="" />` : `<b>${UI.esc(ini)}</b>`}</span><small>${UI.esc(UI.bi(x.name))}</small></a>`; }).join("")}</div></div>`;
}
const canAdd = o => !!(o && o.shop_id && Array.isArray(o.items) && o.items.length && ["nouvelle", "confirmee"].includes(o.status)
  && ["attente", "acceptee"].includes(o.shop_status));
const addLeft = () => (addable ? Math.max(0, Math.floor((new Date(addable.until) - Date.now()) / 1000)) : 0);
function renderAdd() {
  const s = addLeft();
  const html = (addDone ? `<p class="add-done">${UI.esc(t("adDone"))}</p>`
    : addable && s > 0 ? `<button type="button" class="add-card" data-add-open><span><b>${UI.esc(t("adTitle"))}</b><small>${UI.esc(t("adSub"))}</small></span>
      <i class="add-timer" dir="ltr">${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}<small>${UI.esc(t("adLeft"))}</small></i></button>` : "") + addonCard();
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
$("#notifCard").addEventListener("click", async e => {
  if (e.target.id !== "notifOn") return;
  e.target.disabled = true;
  const ok = await UI.clientPushSubscribe(token, true);
  $("#notifCard").innerHTML = `<p class="promo-msg ${ok ? "ok" : "bad"}" style="margin:0">${UI.esc(I18N.t(ok ? "trNotifOn" : "trNotifDenied"))}</p>`;
  if (ok) setTimeout(() => $("#notifCard").classList.add("hidden"), 4000);
});
$("#photoCard").addEventListener("click", async e => {
  if (e.target.id !== "photoOn") return;
  e.target.disabled = true;
  const ok = await Store.clientPhotoWanted(token, true).catch(() => false);
  if (!ok) { e.target.disabled = false; return alert(I18N.t("trPhotoErr")); }
  order.photo_wanted = true;
  renderPhotoAsk(order);
});
$("#payBox").addEventListener("click", async e => {
  // « J'ai envoyé X ₪ » : un message au livreur dans la conversation (il vérifie son Bit, puis confirme)
  const sb = e.target.closest("[data-sent]");
  if (sb) {
    if (!confirm(t("sentConfirm", { amount: sb.dataset.amount, name: sb.dataset.name }))) return;
    sb.disabled = true;
    const ok = await Store.chatOrderSend(token, t("sentMsg_" + sb.dataset.what, { amount: sb.dataset.amount })).catch(() => false);
    if (!ok) { sb.disabled = false; return alert(t("sentErr")); }
    try { sessionStorage.setItem("hop.sent." + token + "." + sb.dataset.what + "." + sb.dataset.amount, "1"); } catch (ex) { /* pas de stockage */ }
    sb.outerHTML = `<p class="promo-msg ok">${UI.esc(t("sentOk", { name: sb.dataset.name }))}</p>`;
    return;
  }
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
  // Aussi pendant la livraison quand un paiement ou un ticket attend : le client voit la réponse du livreur tout de suite
  const fast = !order || ["nouvelle", "confirmee"].includes(order.status)
    || (order.status === "recuperee" && (order.payment_status !== "paye" || order.wait_status === "a_payer" || ["a_completer", "a_rendre"].includes(order.goods_refund_status)));
  setTimeout(async () => { if (!order || ["nouvelle", "confirmee", "recuperee"].includes(order.status)) await Promise.resolve(load()).catch(() => {}); livePoll(); }, fast ? 2000 : 5000);
})();
setInterval(checkChat, 15000);

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
window.hopReady = true;

})();
