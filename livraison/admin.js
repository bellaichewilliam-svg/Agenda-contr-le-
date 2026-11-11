// ============================================================================
// Espace patron : agenda, attribution aux livreurs, refus motivé, disponibilité,
// position GPS, encaissements, livreurs partenaires, paiements hebdomadaires.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const LS_SEEN = "livraison.seenIds.v1";
Store.useSpace("admin");

let orders = [], trash = [];
let couriers = [];

// Photo en grand (top case d'un livreur)
function showPhoto(src) {
  if (!src) return alert("Pas encore de photo.");
  const d = document.createElement("div");
  d.className = "modal photo-view";
  d.innerHTML = `<img src="${UI.esc(src)}" alt="Top case" /><button type="button" class="ens-x" aria-label="Fermer">✕</button>`;
  d.addEventListener("click", () => d.remove());
  document.body.appendChild(d);
}
// Documents d'un livreur (inscription, écran d'attente, photos envoyées en message) : toucher une photo l'agrandit
const DOC_FR_KIND = { permis: "🪪 Permis", carte_grise: "📗 Carte grise", identite: "🆔 Carte d'identité", osek: "🧾 Attestation d'עוסק",
  assurance: "🛡️ Assurance", autre: "📄 Document", message: "💬 Envoyé en message" };
function showDocs(name, docs) {
  if (!docs || !docs.length) return alert("Pas encore de documents.");
  const when = x => new Date(x.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  UI.photoViewer(`📄 Documents${name ? " de " + name : ""} (${docs.length})`,
    docs.map(x => ({ label: `${DOC_FR_KIND[x.kind] || "📄 Document"} · ${when(x)}`, src: UI.safeImg(x.image) })).filter(x => x.src));
}
let shops = [];
let requests = [];
let sales = [];
let planSales = [];
let clients = [];   // clients (avec ou sans compte), chargés à l'ouverture de l'onglet
let clientsQ = "", shopsQ = "";
// Fiches repliées (courses terminées, commerces) : celles que le patron a ouvertes le restent quand l'écran se rafraîchit
// (et celles qu'il a refermées restent fermées, même un commerce « à vérifier »)
const openFolds = new Set(), closedFolds = new Set();
document.addEventListener("toggle", e => {
  const k = e.target && e.target.dataset && e.target.dataset.fold;
  if (k) { if (e.target.open) { openFolds.add(k); closedFolds.delete(k); } else { openFolds.delete(k); closedFolds.add(k); ficheDirty.delete(k); } }
}, true);
const foldOpen = k => openFolds.has(k) ? " open" : "";
// Fiche d'un commerce modifiée mais pas encore enregistrée : l'écran ne se rafraîchit pas (rien n'est perdu)
const ficheDirty = new Set();
document.addEventListener("input", e => {
  const box = e.target && e.target.closest && e.target.closest(".shop-fiche[data-fold]");
  if (box) ficheDirty.add(box.dataset.fold);
}, true);
document.addEventListener("change", e => {
  const box = e.target && e.target.closest && e.target.closest(".shop-fiche[data-fold]");
  if (box) ficheDirty.add(box.dataset.fold);
}, true);
let penalties = [];   // retenues aux livreurs (courses pas faites, pas reçues)
let credits = { credits: [], topups: [] };   // crédit prépayé des livreurs et leurs recharges
let accounts = [];   // comptes (inscription finie ou pas, notifications activées), voir Store.adminAccounts
let declines = [];    // refus des 30 derniers jours (avec la raison)   // abonnements HOP! Pro payés (part du livreur qui a amené le commerce)
let msgs = { messages: [], replies: [] };
// Pubs plein écran de l'appli client (onglet 📣) : chargées à la première ouverture de l'onglet
let promos = null;
const promoForm = { open: false, img: "kit/visuels/nouveaux-story-fr.png", imgHe: "kit/visuels/nouveaux-story-he.png", own: null, ownHe: null };
let me = null;
let settings = { accepting: true, message: "", commission: CONFIG.platform.commissionPerCourse };
let tab = "agenda";
let firstLoad = true;
let histFilter = { status: "", q: "", trash: false, day: "" };
let billMonth = new Date().toISOString().slice(0, 7);
let weekOffset = 0;
let refusing = null;

// --- Connexion ------------------------------------------------------------------
function showLogin() {
  $("#dashboard").classList.add("hidden");
  $("#logoutBtn").classList.add("hidden");
  $("#loginForm").classList.remove("hidden");
  if (!Store.ONLINE) {
    $("#emailWrap").classList.add("hidden");
    $("#pwLabel").textContent = "Code d'accès";
    $("#loginHint").textContent = "Mode démo : le code est défini dans config.js (demoAdminPin). Seules les données de cet appareil sont visibles.";
  } else {
    $("#loginHint").textContent = "Connectez-vous avec votre compte patron (voir README).";
  }
}

async function onLogin(e) {
  e.preventDefault();
  const f = e.target;
  $("#loginError").classList.add("hidden");
  try {
    await Store.login(f.email.value.trim(), f.password.value);
    const who = await Store.me();
    if (!who || who.role !== "admin") {
      Store.logout();
      throw new Error("Ce compte n'est pas le compte patron. Les livreurs se connectent sur coursier.html.");
    }
    f.password.value = "";
    start();
  } catch (ex) {
    $("#loginError").textContent = ex.message;
    $("#loginError").classList.remove("hidden");
  }
}

// --- Chargement et alertes -----------------------------------------------------
function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN)) || []); } catch (e) { return new Set(); }
}
function writeSeen(ids) {
  try { localStorage.setItem(LS_SEEN, JSON.stringify([...ids])); } catch (e) { /* ignore */ }
}

// Un seul contexte audio (le navigateur en limite le nombre), réveillé si besoin
let actx = null;
function beep() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = actx;
    if (ctx.state === "suspended") ctx.resume();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) { /* audio indisponible */ }
}

// Sonnerie des commandes : elle revient toutes les 3 s tant qu'une commande attend d'être prise
// (par un livreur ou par vous) ; « 🔕 Couper » la fait taire pour les commandes déjà là, pas pour les suivantes
const ringA = { timer: null, muted: new Set() };
function waitingOrders() {
  // Commande Pro ou par téléphone : elle sonne quand on peut l'envoyer aux livreurs (quelques min avant « prête »)
  const lead = Number(settings.pro_lead_min || 8) * 60000;
  return orders.filter(o => o.status === "nouvelle" && !o.courier_id && !["attente", "refusee"].includes(o.shop_status)
    && !((o.shop_status || o.phone_order) && o.ready_at && new Date(o.ready_at) - lead > Date.now()));
}
function syncRing() {
  const list = waitingOrders().filter(o => !ringA.muted.has(o.id));
  $("#ringBar").classList.toggle("hidden", !list.length);
  if (list.length) $("#ringBar b").textContent = list.length === 1 ? `🔔 Commande n° ${list[0].ref} à prendre · ${UI.money(list[0].price)}` : `🔔 ${list.length} commandes à prendre`;
  if (list.length && !ringA.timer) {
    const ringNow = () => { ring(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };
    ringNow();
    ringA.timer = setInterval(ringNow, 3000);
  }
  if (!list.length && ringA.timer) { clearInterval(ringA.timer); ringA.timer = null; }
}

// Sonnerie HOP! des courses (choisie par le patron) : commandes à prendre et nouvelles commandes
function ring() {
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  UI.ringTone(actx, 1);
}
["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, () => { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); UI.ringLoad(actx); } catch (e) { /* audio indisponible */ } }, { once: true, passive: true }));
function alertNew(list, title, sound) {
  (sound || beep)();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (window.Notification && Notification.permission === "granted") {
    list.forEach(x => UI.notify(title(x), { body: x.body || "", tag: "hop-" + (x.ref || x.id || Math.random()) }));
  }
}

async function load() {
  try {
    [orders, couriers, settings] = await Promise.all([Store.listOrders(), Store.listCouriers(), Store.getSettings()]);
    // Courses effacées (corbeille) : hors des listes et des comptes, remises d'un toucher
    trash = orders.filter(o => o.hidden_at).sort((a, b) => byTime(b, a));
    orders = orders.filter(o => !o.hidden_at);
    UI.setZonesOpen(settings.zones_open);
    // Commerces et messages : un souci ici ne doit pas bloquer les courses
    const [sh, m, rq, sa] = await Promise.all([Store.listShops().catch(() => null), Store.listMessages().catch(() => null),
      Store.listRequests().catch(() => null), Store.listCarnetSales().catch(() => null)]);
    planSales = (await Store.listPlanSales().catch(() => null)) || planSales;
    penalties = (await Store.listPenalties().catch(() => null)) || penalties;
    credits = (await Store.adminCredits().catch(() => null)) || credits;
    declines = (await Store.listDeclines().catch(() => null)) || declines;
    accounts = (await Store.adminAccounts().catch(() => null)) || accounts;
    if (sh) shops = sh;
    // Le téléphone du patron ne garde pas la clé d'un commerce ouvert depuis ici (sinon « Inscrire mon commerce » ouvrait cet espace)
    if (sh) sh.forEach(x => { if (x.token) Store.forgetShopToken(x.token); });
    if (sa) sales = sa;
    if (rq) requests = rq;
    if (m) msgs = m;
    me = couriers.find(c => c.id === (Store.session() || {}).user_id) || me;
  } catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.logout(); return showLogin(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  const seen = readSeen();
  const freshOrders = orders.filter(o => !seen.has(o.id) && o.status === "nouvelle");
  const freshCouriers = couriers.filter(c => !seen.has(c.id) && c.status === "en_attente");
  const freshShops = shops.filter(x => !seen.has(x.id) && x.status === "en_attente");
  const freshStarts = unfinished().filter(a => !seen.has("start:" + a.id));
  const freshReqs = requests.filter(x => !seen.has(x.id) && x.status === "nouvelle");
  // Souci signalé par un livreur : alerte une seule fois par souci
  const freshIssues = orders.filter(o => o.issue && o.issue_at && !seen.has("issue:" + o.id + o.issue_at));
  if (!firstLoad && freshOrders.length && !bossId) bossAfterLoad = freshOrders[0].id;
  if (!firstLoad && freshOrders.length) {
    alertNew(freshOrders.map(o => ({ ref: o.ref, price: o.price, body: `${UI.whenFr(o)}\n${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)}` })),
      x => `🆕 Commande n° ${x.ref} — ${UI.money(x.price)}`, ring);
  }
  if (!firstLoad && freshCouriers.length) alertNew(freshCouriers, c => `👤 Nouveau livreur : ${c.name}`);
  if (!firstLoad && freshShops.length) alertNew(freshShops, x => `🏪 Nouveau commerce : ${x.name}`);
  if (!firstLoad && freshStarts.length) alertNew(freshStarts, a => `⏳ Inscription livreur commencée : ${a.email}`);
  unfinished().forEach(a => seen.add("start:" + a.id));
  orders.forEach(o => seen.add(o.id));
  couriers.forEach(c => seen.add(c.id));
  shops.forEach(x => seen.add(x.id));
  requests.forEach(x => seen.add(x.id));
  if (!firstLoad && freshReqs.length) alertNew(freshReqs, x => `📝 Demande de devis : ${x.company || x.name}`);
  if (!firstLoad && freshIssues.length) alertNew(freshIssues, o => `⚠️ Souci course n° ${o.ref} : ${o.issue}`);
  orders.filter(o => o.issue && o.issue_at).forEach(o => seen.add("issue:" + o.id + o.issue_at));
  writeSeen(seen);
  firstLoad = false;
  syncRing();
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (tab === "clients") loadClients();
  loadCarts();
  await refreshChats();
  renderAvail();
  // Ne pas effacer un champ en cours de saisie
  const typing = document.activeElement && $("#view").contains(document.activeElement)
    && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing || ficheDirty.size) renderStats(); else render();
  // Course ouverte dans la fenêtre du patron : fermée si elle est prise entre-temps ; adresse de la notification au 1er chargement
  // « Je ne prends pas de courses » : pas de service repris tout seul à l'ouverture
  if (!bossTakes() && duty.watch != null) toggleDuty();
  if (bossFirstLoad) { bossFirstLoad = false; bossFromUrl(location.href); }
  if (bossAfterLoad) { const id = bossAfterLoad; bossAfterLoad = null; bossPopup(id); }
  else if (bossId) { const o = orders.find(x => x.id === bossId); if (!o || o.status !== "nouvelle" || o.courier_id) { $("#bossModal").classList.add("hidden"); bossId = null; } }
  // Notifications qui ne servent plus (course prise, livrée, annulée, payée ; message lu) : fermées sur le téléphone
  UI.clearNotifs((k, id) => {
    if (k === "m") return !chatUnread[id];
    const o = orders.find(x => x.id === id), over = !o || ["livree", "annulee", "refusee"].includes(o.status);
    if (k === "o") return over || o.status !== "nouvelle" || !!o.courier_id;
    if (k === "pay") return over || o.payment_status === "paye";
    if (k === "late") return over;
    return false;
  });
}

// --- Disponibilité (« je suis complet ») --------------------------------------------
function renderAvail() {
  const on = settings.accepting;
  $("#avail").classList.toggle("on", on);
  $("#availTitle").textContent = on ? "🟢 Je prends des commandes immédiates" : "🔴 Fermé : les clients ne peuvent que programmer pour plus tard";
  $("#availAuto").textContent = "Automatique : ouvert dès que vous passez en service, fermé quand vous terminez. « Je suis complet » ferme à la main pendant le service.";
  $("#availBtn").textContent = on ? "Je suis complet" : "Je reprends les commandes";
  if (document.activeElement !== $("#availMsg")) $("#availMsg").value = settings.message || "";
  const takes = bossTakes();
  $("#bossTakesBtn").textContent = takes ? "🙋 Je prends des courses : OUI" : "🚫 Je prends des courses : NON";
  $("#bossTakesBtn").classList.toggle("btn-primary", takes);
  $("#bossTakesText").textContent = takes ? "" : "Vous êtes hors ligne : les courses vont directement aux livreurs. Vous voyez et entendez tout.";
  $("#bossFirstRow").classList.toggle("hidden", !takes);
  $("#duty").classList.toggle("hidden", !takes);
  const bf = $("#bossFirst"), v = bossOnly() ? "never" : String(Number(settings.boss_first_seconds ?? 60));
  if (![...bf.options].some(x => x.value === v)) bf.add(new Option(v + " s", v));
  if (document.activeElement !== bf) bf.value = v;
  $("#zonesChips").innerHTML = CONFIG.zones.map(z => `<button type="button" class="chip${UI.zoneActive(z.id) ? " on" : ""}" data-zone="${UI.esc(z.id)}">${UI.zoneActive(z.id) ? "🟢" : "⚪"} ${UI.esc(z.fr)}</button>`).join("");
  renderHoursNow();
  $("#bossOnlyText").textContent = bossOnly() ? "🔒 Seul vous recevez les courses : les livreurs ne voient rien tant que vous ne leur donnez pas une course." : "";
}

// --- Mes horaires (08/11) : le patron les change ici ; l'appli client les lit dans settings.hours ------------------
const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const bossHours = () => { const h = JSON.parse(JSON.stringify(CONFIG.hours)); Pricing.applyHours({ hours: h }, settings.hours); return h; };
const hToTime = h => { const m = Math.min(1439, Math.round(h * 60)); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const timeToH = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? Number(m[1]) + Number(m[2]) / 60 : null; };
function renderHoursNow() {
  const h = bossHours(), d = new Date().getDay(), s = h[d];
  $("#hoursNow").textContent = `🕘 Aujourd'hui : ${s ? `${Pricing.hourTxt(s[0])} – ${Pricing.hourTxt(s[1])}` : "fermé"}`;
}
function openHoursEd() {
  const ed = $("#hoursEd"), h = bossHours();
  if (!ed.classList.contains("hidden")) { ed.classList.add("hidden"); return; }
  ed.innerHTML = `<p class="small muted">Vos heures d'ouverture pour les clients (heure d'Israël). En dehors, ils peuvent programmer pour plus tard ; avant l'ouverture, l'appli s'ouvre quand même si un livreur est en service.</p>
    ${DAYS_FR.map((n, i) => `<div class="hd-row"><label class="hd-day"><input type="checkbox" name="on${i}"${h[i] ? " checked" : ""} /> ${n}</label>
      <input type="time" name="a${i}" value="${h[i] ? hToTime(h[i][0]) : "08:00"}" step="900"${h[i] ? "" : " disabled"} /> <span>→</span> <input type="time" name="b${i}" value="${h[i] ? hToTime(Math.min(h[i][1], 23.99)) : "23:00"}" step="900"${h[i] ? "" : " disabled"} /></div>`).join("")}
    <p class="hd-err hidden"></p>
    <div class="hd-btns"><button type="submit" class="btn btn-primary">Enregistrer</button><button type="button" class="btn" data-hd-cancel>Annuler</button></div>`;
  ed.classList.remove("hidden");
}
$("#hoursBtn").addEventListener("click", openHoursEd);
$("#hoursEd").addEventListener("click", e => { if (e.target.closest("[data-hd-cancel]")) $("#hoursEd").classList.add("hidden"); });
$("#hoursEd").addEventListener("change", e => {
  const m = /^on(\d)$/.exec(e.target.name || "");
  if (m) $("#hoursEd").querySelectorAll(`[name=a${m[1]}],[name=b${m[1]}]`).forEach(x => { x.disabled = !e.target.checked; });
});
$("#hoursEd").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, hours = {}, err = f.querySelector(".hd-err");
  for (let i = 0; i < 7; i++) {
    if (!f.elements["on" + i].checked) { hours[i] = null; continue; }
    const a = timeToH(f.elements["a" + i].value), b0 = timeToH(f.elements["b" + i].value), b = b0 === 0 ? 24 : b0;
    if (a == null || b == null || !(a < b)) { err.textContent = `${DAYS_FR[i]} : l'heure de fermeture doit être après l'ouverture.`; err.classList.remove("hidden"); return; }
    hours[i] = [a, b];
  }
  try {
    await Store.saveSettings({ hours });
    settings.hours = hours;
    f.classList.add("hidden");
    renderHoursNow();
    alert("✅ Horaires enregistrés : les clients les voient dès qu'ils ouvrent l'appli.");
  } catch (ex) { err.textContent = "Pas enregistré (connexion ?). Réessayez."; err.classList.remove("hidden"); }
});

async function toggleAvail() {
  const changes = { accepting: !settings.accepting, message: $("#availMsg").value.trim() || null };
  try {
    await Store.saveSettings(changes);
    Object.assign(settings, changes);
    renderAvail();
  } catch (e) { alert("Réglage non enregistré, vérifiez la connexion."); }
}

// --- En service : partage de la position GPS --------------------------------------
const duty = { watch: null, lastSent: 0, wakeLock: null };

async function sendPosition(pos) {
  const now = Date.now();
  if (now - duty.lastSent < 15000) return;
  duty.lastSent = now;
  try {
    await Store.ping(pos.coords.latitude, pos.coords.longitude);
    $("#dutyText").textContent = `Position envoyée à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · vous pouvez passer sur Waze : vous restez en service (notification « En service »).`;
  } catch (e) {
    $("#dutyText").textContent = "⚠️ Position non envoyée (connexion). Nouvel essai automatique.";
    duty.lastSent = 0;
  }
}

// En service : reste actif quand on passe sur Waze (ou qu'on recharge la page), jusqu'à « Terminer le service »
const LS_DUTY = "livraison.adminDuty.v1";
async function toggleDuty() {
  if (duty.watch != null) {
    navigator.geolocation.clearWatch(duty.watch);
    duty.watch = null;
    if (duty.wakeLock) { duty.wakeLock.release().catch(() => {}); duty.wakeLock = null; }
    try { localStorage.removeItem(LS_DUTY); } catch (e) { /* ignore */ }
    Store.setOnline(false).then(() => Store.getSettings()).then(st => { if (st) { settings.accepting = st.accepting; renderAvail(); } }).catch(() => {});
    // Hors ligne : on retire aussi la notification « 🟢 En service » de l'appli HOP! Livreur du même téléphone
    // (sinon elle reste affichée et dit « Vous recevez les courses » alors qu'on est hors ligne)
    UI.dutyNotice(false);
    renderDuty();
    return;
  }
  if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur ce téléphone.");
  duty.watch = navigator.geolocation.watchPosition(sendPosition, err => {
    $("#dutyText").textContent = err.code === 1
      ? "⚠️ Autorisez la localisation pour ce site dans les réglages du navigateur."
      : "⚠️ Position GPS introuvable pour le moment…";
  }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
  // Garder l'écran allumé : les navigateurs coupent le GPS quand l'écran s'éteint
  try { if (navigator.wakeLock) duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* facultatif */ }
  try { localStorage.setItem(LS_DUTY, "1"); } catch (e) { /* ignore */ }
  // En service = HOP! ouvert (la base passe « accepting » à vrai toute seule ; fin du service = « Fermé pour le moment »)
  Store.setOnline(true).then(() => { settings.accepting = true; renderAvail(); }).catch(() => {});
  renderDuty();
}
// De retour dans HOP! (après Waze) : position tout de suite, écran allumé, notification « En service » remise
async function dutyBack() {
  if (duty.watch == null) return;
  duty.lastSent = 0;
  navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}

function renderDuty() {
  const on = duty.watch != null;
  $("#duty").classList.toggle("on", on);
  $("#dutyTitle").textContent = on ? "🟢 En service — vos clients vous suivent sur la carte" : "⚪ Hors service";
  $("#dutyBtn").textContent = on ? "Terminer le service" : "Passer en service";
  if (!on) $("#dutyText").textContent = "Passez « en service » pour que vos clients vous voient sur la carte.";
}

// --- Outils ------------------------------------------------------------------------
const today = () => UI.dayKey(new Date().toISOString());
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const active = o => ["nouvelle", "confirmee", "recuperee"].includes(o.status);
const sum = (list, f = o => Number(o.price)) => list.reduce((s, o) => s + f(o), 0);
const isMine = o => me && o.courier_id === me.id;
const partners = () => couriers.filter(c => c.role !== "admin");
// Livreurs actifs, le plus proche du départ en premier (position GPS de moins de 10 min)
function rankedCouriers(o) {
  const fresh = c => c.lat != null && c.position_at && Date.now() - new Date(c.position_at) < 10 * 60000;
  const km = c => fresh(c) && o.pickup_lat != null ? Pricing.haversineKm({ lat: c.lat, lon: c.lon }, { lat: o.pickup_lat, lon: o.pickup_lon }) * 1.3 : null;
  return partners().filter(c => c.status === "actif")
    .map(c => ({ c, km: km(c), on: onlineOf(c).on }))
    .sort((a, b) => (b.on - a.on) || (a.km ?? 1e9) - (b.km ?? 1e9));
}

// --- Le patron d'abord : « 🔔 Nouvelle course » → je la prends, ou je la donne à un livreur ----------------
// Ouverte par la notification (même téléphone verrouillé), par « Voir » de la sonnerie, ou toute seule à l'arrivée d'une course
let bossId = null, bossAfterLoad = null, bossFirstLoad = true;
// « Je prends des courses moi-même » : non → le patron est hors ligne, les courses partent tout de suite aux livreurs
// (il voit et entend tout, et peut encore donner une course à un livreur)
const bossTakes = () => settings.boss_takes !== false;
// « Jamais : je les distribue moi-même » : les livreurs ne voient aucune course libre, le patron la prend ou la donne
const bossOnly = () => settings.boss_only === true;
// Personne ne l'a prise (2 min après que les livreurs la voient, ou aucun livreur en ligne) : le patron peut la prendre
const nobodyTook = o => !!o.nobody_at || !partners().some(c => c.status === "actif" && onlineOf(c).on);
const canTake = o => bossTakes() || nobodyTook(o);
async function toggleBossTakes() {
  const on = !bossTakes();
  if (!on && !confirm("Ne plus prendre de courses vous-même ?\n\nVous passez hors ligne, chaque course part tout de suite aux livreurs. Vous continuez de tout voir et de tout entendre, et vous pouvez encore donner une course à un livreur.")) return;
  try {
    await Store.saveSettings({ boss_takes: on });
    settings.boss_takes = on;
    if (!on && duty.watch != null) await toggleDuty();
    else if (!on) Store.setOnline(false).catch(() => {});
    if (!on) UI.dutyNotice(false);
    renderAvail(); render();
  } catch (e) { alert("Réglage non enregistré, vérifiez la connexion."); }
}
function bossPopup(id) {
  const o = orders.find(x => x.id === id);
  const m = $("#bossModal");
  if (!o || o.status !== "nouvelle" || o.courier_id) {
    m.classList.add("hidden");
    if (o && bossId !== id && o.courier_name) alert(`Course n° ${o.ref} : déjà prise par ${o.courier_name}.`);
    bossId = null;
    return;
  }
  bossId = id;
  const wait = bossOnly() ? Infinity : bossTakes() ? Math.ceil((new Date(o.created_at).getTime() + Number(settings.boss_first_seconds || 0) * 1000 - Date.now()) / 1000) : 0;
  const list = rankedCouriers(o);
  $("#bossBody").innerHTML = `
    <h3>🔔 Nouvelle course · ${UI.money(o.price)}${o.urgency === "express" ? " · ⚡ EXPRESS" : ""}</h3>
    <p class="small" style="margin:4px 0">n° ${UI.esc(o.ref)} · ${UI.esc(UI.whenFr(o))}${o.first_shop ? ` · <b class="new-client">🆕 Nouveau commerce</b>` : ""}${o.first_order ? ` · <b class="new-client">🆕 Nouveau client</b>` : ""}${o.addon_ref ? ` · <b class="addon-pill">➕ Ajout à n° ${UI.esc(o.addon_ref)}${(p => p && p.courier_name ? ` (livreur : ${UI.esc(p.courier_name.split(" ")[0])})` : "")(orders.find(x => x.ref === o.addon_ref))}</b>` : ""}</p>
    <p style="margin:6px 0"><b>${UI.esc(o.pickup_address || UI.cityFr(o.from_city))}</b> → <b>${UI.esc(o.dropoff_address || UI.cityFr(o.to_city))}</b></p>
    <p class="small muted" style="margin:0 0 12px">${bossOnly() ? "🔒 <b>Seul vous la voyez</b> : prenez-la, ou donnez-la à un livreur (il la reçoit tout de suite dans son appli)." : !bossTakes() && nobodyTook(o) ? "⚠️ <b>Personne ne l'a prise</b> : prenez-la, ou donnez-la à un livreur (même hors ligne : appelez-le, elle l'attend dans son appli)." : !bossTakes() ? "🛵 Envoyée aux livreurs : le premier qui accepte la prend. Vous pouvez aussi la donner vous-même :" : wait > 0 ? `Les livreurs la reçoivent dans ${wait} s si vous ne faites rien.` : "Les livreurs la voient déjà : le premier qui accepte la prend."}</p>
    ${canTake(o) ? `<button type="button" class="btn btn-primary btn-block" data-boss="take">✅ Je la prends</button>` : ""}
    <p class="small" style="margin:14px 0 6px"><b>🛵 La donner à :</b></p>
    <div class="boss-list">${list.length ? list.map(({ c, km }) => `<button type="button" class="btn btn-block" data-boss-give="${UI.esc(c.id)}">${onlineOf(c).on ? "🟢" : "⚪"} ${UI.esc(c.name)}${km != null ? ` · 📍 ${km.toFixed(1)} km` : ""}${onlineOf(c).on ? "" : " · hors ligne : la verra en ouvrant l'appli"}${balanceOf(c.id) > Number(settings.max_debt) ? " · 🔒 solde dû" : ""}</button>`).join("") : `<p class="small muted">Aucun livreur validé pour l'instant.</p>`}</div>
    <button type="button" class="btn btn-link btn-block" data-boss="later">${bossOnly() ? "Je décide plus tard" : bossTakes() ? "Laisser aux livreurs" : "OK, je laisse les livreurs"}</button>`;
  m.classList.remove("hidden");
}
async function onBossClick(e) {
  const o = orders.find(x => x.id === bossId);
  const give = e.target.closest("[data-boss-give]"), act = e.target.closest("[data-boss]");
  if (!give && !act) { if (e.target === $("#bossModal")) $("#bossModal").classList.add("hidden"); return; }
  $("#bossModal").classList.add("hidden");
  if (o) ringA.muted.add(o.id);
  syncRing();
  if (!o || (act && act.dataset.boss === "later")) return;
  if (give) {
    const c = couriers.find(x => x.id === give.dataset.bossGive);
    if (c) await assignTo(o, c);
    return;
  }
  if (o.docs_status && o.docs_status !== "ok" && !confirm("Les documents de ce colis ne sont pas encore validés. La prendre quand même ?")) return;
  if (duty.watch == null && confirm("Course prise. Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
  assignTo(o, me);
}
// Course d'une notification : à prendre ou donner → sa fenêtre ; sinon (prise, en route, livrée…) → sa fiche,
// ouverte et montrée dans l'historique (recherche sur son numéro)
function showOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return alert("Cette course n'existe plus.");
  if (o.status === "nouvelle" && !o.courier_id) return bossPopup(id);
  $("#bossModal").classList.add("hidden");
  histFilter = { status: "", q: o.ref, trash: false, day: "" };
  openFolds.add("o:" + o.id);
  tab = "historique"; lastTab[groupOf(tab)] = tab;
  render();
  setTimeout(() => {
    const el = document.querySelector(`#view [data-fold="o:${CSS.escape(o.id)}"], #view article[data-id="${CSS.escape(o.id)}"]`);
    if (el) { el.scrollIntoView({ block: "start", behavior: "smooth" }); el.classList.add("flash"); }
  }, 200);
}
// Photo à la livraison : obligatoire devant la porte, ou quand le client l'a demandée (« 📷 Je veux une photo »)
// Photo obligatoire seulement devant la porte (sans contact) ; demandée par le client : facultative (règle du 04/11)
const needPhoto = o => !!o.leave_at_door;
const photoDone = new Set();
document.addEventListener("change", async e => {
  const inp = e.target.closest("input[data-aphoto]");
  if (!inp || !inp.files[0]) return;
  const f = inp.files[0], id = inp.dataset.aphoto, o = orders.find(x => x.id === id);
  inp.value = "";
  if (!o) return;
  inp.closest("label").firstChild.textContent = "📷 Envoi de la photo…";
  try {
    const data = await UI.docPhoto(f);
    await Store.chatSend("o:" + o.id, "admin", "HOP!", I18N.forLang(o.lang || "fr", "rdMsgPhoto", { name: String((me && me.name) || "HOP!").split(" ")[0] }), data);
    photoDone.add(o.id);
  } catch (ex) { render(); return alert("Photo non envoyée, vérifiez la connexion et réessayez."); }
  render();
  const btn = document.querySelector(`#view article.order[data-id="${CSS.escape(id)}"] [data-status="livree"]`);
  if (btn) btn.click();
});
// Adresse ouverte par la notification : patron/?o=<course>
function bossFromUrl(url) {
  try {
    const u = new URL(url, location.href), id = u.searchParams.get("o"), tag = u.searchParams.get("tag") || "";
    if (id || tag) history.replaceState(null, "", location.pathname);
    // Notification d'un message : la conversation s'ouvre ; d'une course : sa fenêtre
    const m = tag.match(/^m-(.+)$/);
    if (m) { const th = m[1]; openAdminChat(th, threadLabel(th, []), ""); return; }
    const oid = id || (tag.match(/^(?:o|pay|refund|late)-(.+)$/) || [])[1];
    if (oid) showOrder(oid);
  } catch (e) { /* ignore */ }
}
// Solde d'un livreur (même calcul que la base) : commissions − courses payées à HOP − part Pro et promos
// payées par HOP − pourboires reçus − bonus réseau − part des abonnements Pro, pas encore réglés
const balanceOf = id => Store.balanceOf(id, orders, planSales);
// Refus d'un livreur (30 jours) : taux d'acceptation, raisons, et s'il a été passé hors ligne pour trop de refus
const WHY_FR = { loin: "trop loin", prix: "pas assez payé", taille: "trop gros", occupe: "occupé", fin: "fin de service", autre: "autre", sans_reponse: "sans réponse" };
function declineStats(c) {
  const mine = declines.filter(d => d.courier_id === c.id);
  if (!mine.length && !c.auto_offline_at) return "";
  const since = Date.now() - 30 * 86400000;
  const taken = orders.filter(o => o.courier_id === c.id && new Date(o.created_at) > since).length;
  const rate = taken + mine.length ? Math.round(100 * taken / (taken + mine.length)) : null;
  const why = {};
  mine.forEach(d => { why[d.reason || "autre"] = (why[d.reason || "autre"] || 0) + 1; });
  const top = Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${WHY_FR[k] || k} ×${n}`).join(", ");
  const bad = rate != null && rate < 60;
  const off = c.auto_offline_at && Date.now() - new Date(c.auto_offline_at) < 7 * 86400000
    ? ` · ⏸️ passé hors ligne pour refus le ${UI.esc(UI.fmtDateTime(c.auto_offline_at))}` : "";
  return `<p class="small ${bad ? "notice warn" : "muted"}" style="margin:6px 0 0">🚫 ${mine.length} refus en 30 jours${rate != null ? ` · acceptation ${rate} %` : ""}${top ? ` · ${UI.esc(top)}` : ""}${off}${bad ? " · à voir avec lui" : ""}</p>`;
}
const TIP_FR = { promis: "promis (attendre son Bit)", recu: "reçu, à reverser", verse: "reversé ✓" };

const { clientMessage, weekStart, addDays, fmtKey } = UI;

function tel(name, phone) {
  return phone ? `${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a>` : UI.esc(name || "");
}

// --- Qui a commandé (commerce + personne, gros bouton Appeler), heure « prêt » au départ, ordre de mes courses ---
const shopOf = o => String(o.shop_name || o.company || (o.pickup_place ? String(o.pickup_place).split(" · ")[0] : "") || "").trim();
function whoLine(o) {
  // Qui commande ? Un commerce (son nom d'entreprise, ou une course envoyée depuis son espace) ou un client particulier.
  // Le commerce où l'on va chercher la commande n'est PAS forcément celui qui commande : il est dit à part.
  const firm = String(o.company || (o.shop_sent ? o.shop_name : "") || "").trim();
  const place = String(o.shop_name || (o.pickup_place ? String(o.pickup_place).split(" · ")[0] : "") || "").trim();
  const ph = o.contact_phone;
  return `<div class="order-who${firm ? " is-firm" : ""}"><span class="ow-txt">
      <small class="ow-kind">${firm ? "🏪 Commande d'un commerce" : "👤 Commande d'un client"}</small>
      ${firm ? `<b class="ow-shop">${UI.esc(UI.bi(firm, "fr"))}</b><span>👤 ${UI.esc(o.contact_name || "—")}</span>` : `<b class="ow-shop">${UI.esc(o.contact_name || "—")}</b>`}
      ${place && place !== firm ? `<span class="ow-place">📍 À récupérer chez <b>${UI.esc(UI.bi(place, "fr"))}</b></span>` : ""}</span>
    ${ph ? `<a class="btn btn-sm ow-call" href="tel:${UI.esc(ph)}">📞 Appeler · <bdi>${UI.esc(ph)}</bdi></a>` : ""}</div>`;
}
function readyLine(o) {
  if (!o.pickup_ready_at || !["nouvelle", "confirmee"].includes(o.status)) return "";
  const l = Math.ceil((new Date(o.pickup_ready_at) - Date.now()) / 60000);
  return l > 0 ? `<div class="ready-line wait">⏳ Colis prêt à <em>${UI.esc(UI.fmtTime(o.pickup_ready_at))}</em> · dans ${l} min : arrivez pour cette heure</div>`
    : `<div class="ready-line ok">✅ Colis prêt (depuis ${UI.esc(UI.fmtTime(o.pickup_ready_at))})</div>`;
}
// Mes courses en cours (le patron livre aussi) : d'abord tous les départs (dans l'ordre où ils sont prêts), puis les livraisons
function myTour() {
  const list = orders.filter(o => isMine(o) && ["confirmee", "recuperee"].includes(o.status));
  if (list.length < 2) return "";
  const t0 = o => new Date(o.pickup_ready_at || o.ready_at || o.created_at || o.pickup_at).getTime();
  const picks = list.filter(o => o.status === "confirmee").sort((a, b) => t0(a) - t0(b));
  const drops = list.slice().sort((a, b) => (picks.indexOf(a) < 0 ? -1 : picks.indexOf(a)) - (picks.indexOf(b) < 0 ? -1 : picks.indexOf(b)) || t0(a) - t0(b));
  const steps = picks.map(o => ({ o, k: "pickup" })).concat(drops.map(o => ({ o, k: "dropoff" })));
  return `<div class="card my-tour"><b>🧭 Ma tournée · ${list.length} courses, dans cet ordre</b><ol>${steps.map(({ o, k }, i) => {
    const pick = k === "pickup", who = pick ? shopOf(o) || o.pickup_contact || "" : o.dropoff_contact || o.contact_name || "";
    const rl = pick && o.pickup_ready_at && new Date(o.pickup_ready_at) > Date.now() ? ` · ⏳ prêt à ${UI.esc(UI.fmtTime(o.pickup_ready_at))}` : "";
    return `<li class="${i === 0 ? "now" : ""}"><a href="#o-${UI.esc(o.id)}" data-tour-go="${UI.esc(o.id)}">${pick ? "📍 Récupérer" : "🏁 Livrer"} ${who ? `<b>${UI.esc(UI.bi(who, "fr"))}</b> · ` : ""}<bdi>${UI.esc(pick ? o.pickup_address : o.dropoff_address)}</bdi>${rl} <small>n° ${UI.esc(String(o.ref).split("-").pop())}</small></a></li>`;
  }).join("")}</ol></div>`;
}
const tourNo = o => { const l = orders.filter(x => isMine(x) && ["confirmee", "recuperee"].includes(x.status)); if (l.length < 2) return 0;
  const t0 = x => new Date(x.pickup_ready_at || x.ready_at || x.created_at || x.pickup_at).getTime();
  return l.sort((a, b) => (a.status === "recuperee") - (b.status === "recuperee") || t0(a) - t0(b)).indexOf(o) + 1; };

// --- Carte d'une course -------------------------------------------------------------
function card(o, withDay) {
  const st = Store.STATUSES[o.status] || { label: o.status, icon: "" };
  const nb = UI.notBefore(o), nbOn = nb && nb > Date.now() && !["livree", "annulee", "refusee"].includes(o.status);
  const when = nbOn ? `⏰ Pas avant ${UI.fmtTime(nb)}` : o.urgency === "programmee" ? UI.fmtTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS" : "Dès que possible";
  const nav = which => `<div class="links">
      <a class="btn btn-sm" href="${UI.wazeLink(o, which)}" target="_blank" rel="noopener">Waze</a>
      <a class="btn btn-sm" href="${UI.mapsLink(o, which)}" target="_blank" rel="noopener">Maps</a></div>`;

  let pickupExtra = "";
  if (o.service === "retrait") {
    pickupExtra = `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° <b style="display:inline">${UI.esc(o.tracking_number || "—")}</b>${o.retrait_code ? ` · code du casier <b style="display:inline">${UI.esc(o.retrait_code)}</b>` : ` · au nom de ${UI.esc(o.parcel_name || "—")}`}${o.appt_at ? ` · 📅 rendez-vous ${UI.esc(UI.fmtDateTime(o.appt_at))}` : ""}</div>`;
  } else if (o.service === "achat") {
    pickupExtra = `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.goods_after ? ` · 🧾 articles avancés par le livreur (au plus ${UI.money(o.goods_budget)}), ticket payé après${o.goods_spent != null ? ` · ticket ${UI.money(o.goods_spent)} ${o.goods_refund_status === "a_completer" ? "⏳ en attente du client" : "✅ payé"}` : ""}` : o.goods_prepay ? ` · 💳 articles payés d'avance au livreur : ${UI.money(o.goods_budget)} au plus${o.goods_spent != null ? ` · 🧾 ticket ${UI.money(o.goods_spent)}${o.goods_refund_status === "a_rendre" ? ` · ⏳ ${UI.money(o.goods_refund)} à rendre au client` : o.goods_refund_status === "rendu" ? ` · ✅ ${UI.money(o.goods_refund)} rendus` : o.goods_refund_status === "a_completer" ? ` · ⚠️ ${UI.money(o.goods_refund)} à compléter par le client` : " · compte juste"}` : " · ticket pas encore pris"}` : `${o.budget ? ` · budget ≈ ${UI.money(o.budget)}` : ""} · 🧾 réglé par le client au magasin`}</div>`;
  }

  const meta = [
    `<span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>`,
    `<span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>`,
    `<span class="pill ${o.payment_status === "paye" ? "paid" : "unpaid"}">${UI.PAY_FR[o.payment_method] || ""} · ${o.payment_status === "paye" ? "encaissé" : "à encaisser"}${o.shop_pays ? " · 🎁 livraison offerte : payée par le commerce au livreur" : o.shop_sent ? (o.payer === "destinataire" ? " · 🏪 envoyée par le commerce, payée par le client" : " · 🏪 envoyée et payée par le commerce") : o.payer === "destinataire" ? " (par le destinataire)" : ""}</span>`
  ];
  if (o.courier_id && !isMine(o) && !["annulee", "refusee"].includes(o.status)) {
    meta.push(`<button class="pill pill-btn ${o.paid_to === "hop" ? "paid" : ""}" data-act="paidto" title="Qui a reçu l'argent du client ?">${o.paid_to === "hop" ? "💳 Payée à HOP (reversée au livreur)" : "🛵 Payée au livreur"} ⇄</button>`);
  }
  // HOP! Pro : préparation chez le commerce, et sa part de la livraison
  if (o.shop_status && o.shop_status !== "refusee") meta.push(`<span class="pill">${o.shop_status === "attente" ? "🍳 Attente du commerce"
    : o.shop_status === "prete" ? "✅ Prête au commerce" : `🍳 Prête à ${UI.esc(new Date(o.ready_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))}`}${Number(o.shop_share) > 0 ? ` · commerce ${UI.money(o.shop_share)}` : ""}</span>`);
  if (o.shop_order) meta.push(`<span class="pill">🧾 ${UI.esc(o.shop_order.slice(0, 80))}</span>`);
  // Le patron passe lui-même la commande au commerce (non partenaire) : « Commandé » (n° + prête dans…), puis « Prête »
  const oShop = o.shop_id && o.status === "nouvelle" ? shops.find(x => x.id === o.shop_id && x.token) : null;
  if (oShop && o.shop_status === "attente") meta.push(`<button class="pill pill-btn unpaid" data-act="shopok" title="Vous avez passé la commande au commerce : son n° et dans combien de temps c'est prêt. Le livreur part au bon moment, le client est prévenu">✅ Commandé chez le commerce</button>`);
  if (oShop && o.shop_status === "acceptee") meta.push(`<button class="pill pill-btn paid" data-act="shopready" title="La commande est prête au commerce : le livreur peut la récupérer">✅ Prête</button>`);
  // Commerce non partenaire : comment le client paie ses articles, et ce qu'il reste à faire au patron
  if (o.goods_choice) {
    const lab = { lien: "🔗 Articles : lien de paiement du commerce", bit: "📱 Articles : Bit au livreur (avec la livraison)", especes: "💵 Articles : espèces au livreur" }[o.goods_choice] || "";
    const st = { a_payer: o.goods_choice === "lien" && !o.goods_link ? "lien à envoyer" : "à payer", declare: "le client dit avoir payé", recu: "✅ payés", pas_recu: "❌ pas reçu" }[o.goods_pay] || "";
    meta.push(`<span class="pill ${o.goods_pay === "recu" ? "paid" : o.goods_pay ? "unpaid" : ""}">${lab}${Number(o.items_total) > 0 ? " · " + UI.money(o.items_total) : ""}${st ? " · " + st : ""}</span>`);
    if (["nouvelle", "confirmee"].includes(o.status)) meta.push(`<button class="pill pill-btn" data-act="goodschoice" title="Le lien ne marche pas ? Passez au Bit sur le numéro du livreur ou aux espèces ; le client est prévenu sur WhatsApp">💳 Changer le paiement</button>`);
    if (!["annulee", "refusee", "livree"].includes(o.status) && o.goods_pay && o.goods_pay !== "recu") {
      if (o.goods_choice === "lien") meta.push(`<button class="pill pill-btn${o.goods_link ? "" : " unpaid"}" data-act="goodslink" title="Préparez la commande dans l'appli du commerce, puis collez son lien de paiement : il part au client sur WhatsApp">${o.goods_link ? "🔗 Renvoyer le lien au client" : "🔗 Envoyer le lien de paiement au client"}</button>`);
      meta.push(`<button class="pill pill-btn paid" data-act="goodsok" title="Le client a bien payé ses articles : le livreur peut les récupérer">✅ Articles payés</button><button class="pill pill-btn st-annulee" data-act="goodsko">❌ Pas reçu</button>`);
    }
  }
  // Le livreur a validé une étape alors que le GPS le voyait loin (« Valider quand même ») : visible ici
  (Array.isArray(o.gps_forced) ? o.gps_forced : []).forEach(g => meta.push(`<span class="pill unpaid" title="Le GPS le voyait loin : il a confirmé être sur place">📍 ${UI.esc({ arrivee: "Arrivée", recuperee: "Récupération", livree: "Livraison" }[g.step] || g.step)} validée hors GPS${g.m != null ? ` (à ${g.m >= 1000 ? (g.m / 1000).toFixed(1).replace(".", ",") + " km" : g.m + " m"})` : ""}${g.at ? " · " + UI.esc(UI.fmtTime(g.at)) : ""}</span>`));
  if (o.leave_at_door) meta.push(`<span class="pill unpaid">📷 Photo du colis obligatoire (devant la porte)</span>`);
  else if (o.photo_wanted) meta.push(`<span class="pill">📷 Le client aimerait une photo (facultatif)</span>`);
  // Colis à récupérer : les documents du client, à vérifier avant d'envoyer un livreur
  if (o.docs_status) {
    meta.push(`<button class="pill pill-btn ${o.docs_status === "ok" ? "paid" : o.docs_status === "refuse" ? "st-annulee" : "unpaid"}" data-act="docs" title="Voir les photos envoyées par le client">${o.docs_status === "ok" ? "✅ Documents vérifiés" : o.docs_status === "refuse" ? `📄 Demandé au client : ${UI.esc(o.docs_note || "")}` : "📄 Documents à vérifier"} · voir</button>`);
    if (o.status === "nouvelle" && o.docs_status !== "ok") meta.push(`<button class="pill pill-btn paid" data-act="docsok">✅ Documents OK : envoyer un livreur</button><button class="pill pill-btn st-annulee" data-act="docsko">✉️ Il manque…</button>`);
  }
  // Course pas reçue (signalée par le client) ou pas faite : retenue au livreur, déduite de son versement
  const LATE_FR = { libre: "⏰ En retard : personne ne l'a prise", pas_recuperee: "⏰ En retard : pas encore récupérée", pas_livree: "⏰ En retard : pas encore livrée" };
  if (o.late_alert && ["nouvelle", "confirmee", "recuperee"].includes(o.status)) meta.push(`<span class="pill st-annulee">${LATE_FR[o.late_alert] || "⏰ En retard"}</span>`);
  if (o.claim_status === "ouverte") meta.push(`<span class="pill st-annulee">⚠️ Le client dit ne pas avoir reçu${o.claim_note ? " : « " + UI.esc(o.claim_note) + " »" : ""}</span><button class="pill pill-btn paid" data-act="claimok" title="Vérifié : la course a bien été livrée">✅ Classer (bien livrée)</button>`);
  else if (o.claim_status === "classee") meta.push(`<span class="pill">✅ Signalement classé</span>`);
  penalties.filter(p => p.order_id === o.id && p.status !== "annulee").forEach(p => meta.push(`<span class="pill ${p.status === "regle" ? "paid" : "unpaid"}">💸 Retenue ${UI.money(p.amount)} · ${p.status === "regle" ? "déduite ✓" : "à déduire"}</span>${p.status === "du" ? `<button class="pill pill-btn" data-pen-cancel="${UI.esc(p.id)}">Annuler la retenue</button>` : ""}`));
  const partner = couriers.find(c => c.id === o.courier_id && c.role !== "admin");
  if (partner && ["confirmee", "recuperee", "livree", "annulee"].includes(o.status)) meta.push(`<button class="pill pill-btn st-annulee" data-act="penalty" title="Course pas faite ou pas reçue : retenue sur le versement de la semaine du livreur">💸 Retenue au livreur</button>`);
  if (o.first_shop) meta.push(`<span class="pill new-client">🆕 1re livraison pour ce commerce</span>`);
  if (o.first_order) meta.push(`<span class="pill new-client">🆕 Nouveau client · 1re commande</span>`);
  if (o.addon_ref) { const p = orders.find(x => x.ref === o.addon_ref); meta.push(`<span class="pill addon-pill">➕ Ajout à la commande n° ${UI.esc(o.addon_ref)}${p && p.courier_name ? ` · à donner à ${UI.esc(p.courier_name.split(" ")[0])}` : ""}</span>`); }
  if (o.first_order && o.status === "livree") meta.push(o.welcome_sent_at ? `<span class="pill paid">📣 Lien HOP! envoyé ✓</span>`
    : `<a class="pill pill-btn btn-wa" target="_blank" rel="noopener" data-welcome-wa="${UI.esc(o.id)}" href="${UI.esc(UI.waPersonal(o.dropoff_phone || o.contact_phone, UI.welcomeMsg(o)))}">📣 Envoyer « Livré avec HOP! » (WhatsApp)</a>`);
  if (nbOn) meta.push(`<span class="pill unpaid nb-pill">⏰ Livraison demandée à partir de ${UI.esc(UI.fmtTime(nb))}${o.not_before ? "" : " (lu dans la note)"}</span>`);
  if (o.cash_shop_after && Number(o.cash_goods) > 0 && !o.cash_shop_at && !["annulee", "refusee"].includes(o.status))
    meta.push(`<span class="pill ${o.status === "livree" && o.delivered_at && Date.now() - new Date(o.delivered_at) > 3 * 3600000 ? "st-annulee" : "unpaid"}">💵 ${UI.money(o.cash_goods)} d'articles à rapporter à ${UI.esc(o.shop_name || "le commerce")} par ${UI.esc((o.courier_name || "le livreur").split(" ")[0])}${o.status === "livree" ? " · livrée, pas encore rapportés" : ""}</span>`);
  if (o.rx) meta.push(`<span class="pill unpaid">💊 Médicament sur ordonnance</span>`);
  if (o.post_send) meta.push(`<span class="pill unpaid">📮 Dépôt à la poste · rendez-vous ${UI.esc(UI.fmtDateTime(o.appt_at))}</span>`);
  if (o.p2p_sale) meta.push(`<span class="pill">🤝 Vente entre particuliers · déjà payée au vendeur</span>`);
  if (o.handoff) meta.push(`<span class="pill ${o.handoff_ok_at ? "paid" : "unpaid"}">🔐 Code de remise${o.handoff_ok_at ? " vérifié" : ""}</span>`);
  if (o.phone_order) meta.push(`<span class="pill star-pill">📞 Commandée par tél. au nom de ${UI.esc(o.pickup_name || "")}${o.phone_ref ? " · n° " + UI.esc(o.phone_ref) : ""} · prête ${o.ready_at ? UI.fmtTime(o.ready_at) : ""}</span>`);
  if (Number(o.wait_fee) > 0) meta.push(`<span class="pill unpaid">⏱️ Attente ${o.wait_minutes} min · +${UI.money(o.wait_fee)} (au livreur)${o.wait_status === "a_payer" ? " · à encaisser" : o.wait_status === "refuse" ? " · ❌ impayée" : ""}</span>`);
  else if (o.arrived_at && o.status === "confirmee") meta.push(`<span class="pill">⏱️ Livreur au départ depuis ${Math.floor((Date.now() - new Date(o.arrived_at)) / 60000)} min</span>`);
  if (o.rating != null) meta.push(`<span class="pill ${o.rating <= 3 ? "st-annulee" : "paid"}" title="${UI.esc(o.rating_note || "")}">${UI.esc(UI.ratingText(o))}${o.rating_note ? " 💬" : ""}</span>`);
  if (o.issue) meta.push(`<button class="pill pill-btn st-annulee" data-act="issue" title="Cliquer quand le souci est réglé">⚠️ Souci signalé par le livreur : ${UI.esc(o.issue)} · ✓ réglé ?</button>`);
  if (o.leave_at_door) meta.push(`<span class="pill">🚪 Devant la porte : photo obligatoire</span>`);
  if (o.courier_id && !isMine(o) && ["confirmee", "recuperee"].includes(o.status)) {
    meta.push(`<button class="pill pill-btn ${o.unlocked ? "paid" : ""}" data-act="unlock" title="Laisser le livreur valider « Livré » sans GPS ni photo">${o.unlocked ? "🔓 Débloquée (cliquer pour rebloquer)" : "🔓 Débloquer la course"}</button>`);
  }
  if (o.payment_method === "carnet") meta.push(`<span class="pill paid">🎟️ Carnet pro</span>`);
  if (o.admin_note === "Espèces impayées à la livraison") meta.push(`<button type="button" class="btn btn-sm" data-unblock="${UI.esc(o.contact_phone)}">🔓 Débloquer le client</button>`);
  // Espèces : qui a payé quoi (client → livreur, livreur → commerce), en clair
  if (o.payment_method === "cash") {
    // Les deux côtés des espèces des articles : ce que le livreur a noté, ce que le commerce a reçu (et l'écart éventuel)
    const got = o.cash_shop_at ? Number(o.cash_shop_amount != null ? o.cash_shop_amount : o.cash_goods) : null;
    const diff = got != null && got !== Number(o.cash_goods);
    const sides = Number(o.cash_goods) > 0 ? ` · articles ${UI.money(o.cash_goods)} → livreur : ${o.cash_courier_mode ? `${o.cash_courier_mode === "avance" ? "payés au départ" : "rendus"} ✅ ${UI.esc(UI.fmtTime(o.cash_courier_at))}` : "rien noté ⏳"} · commerce : ${got != null ? `reçu ${UI.money(got)} ✅ ${UI.esc(UI.fmtTime(o.cash_shop_at))}${diff ? " ⚠️ ÉCART" : ""}` : "pas encore reçus ⏳"}` : "";
    meta.push(`<span class="pill${diff ? " st-annulee" : ""}">💵 Espèces : client ${UI.money(Number(o.price) + Number(o.cash_goods || 0))}${sides} · course ${UI.money(o.price)}${Number(o.cash_note) > 0 ? ` · billet ${UI.money(o.cash_note)}` : ""}</span>`);
  }
  if (o.payment_method === "bit" && o.payment_status !== "paye" && o.client_paid_at) meta.push(o.direct_pay && !isMine(o)
    ? `<span class="pill unpaid">💳 Le client dit avoir payé le livreur · le livreur confirme</span>`
    : `<span class="pill unpaid" title="Vérifiez votre Bit, puis marquez la course payée">💳 Le client dit avoir payé par Bit · à vérifier</span>`);
  if (o.prepaid_required) meta.push(`<span class="pill ${o.payment_status === "paye" ? "paid" : "st-annulee"}">💳 Payée d'avance : ${o.payment_status === "paye" ? "reçu ✓" : "EN ATTENTE"}</span>`);
  if (o.shop_name) {
    const ref = couriers.find(c => c.id === o.referrer_id);
    meta.push(`<span class="pill star-pill">🏪 ${UI.esc(o.shop_name)}${ref && ref.role !== "admin" ? ` · parrain ${UI.esc(ref.name)} +${UI.money(o.referral_bonus || 0)}` : ""}</span>`);
  }
  // Course donnée par le patron : le livreur doit confirmer qu'il la fera
  const hm = d => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  if (o.status === "confirmee" && o.assign_status === "attente") meta.push(`<span class="pill give-wait" title="Il voit la course dès qu'il ouvre HOP! Livreur et doit répondre">⏳ Attend la réponse de ${UI.esc(o.courier_name || "livreur")}${o.assigned_at ? " · donnée à " + hm(o.assigned_at) : ""}</span>`);
  if (["confirmee", "recuperee"].includes(o.status) && o.assign_status === "ok") meta.push(`<span class="pill give-ok">✅ ${UI.esc(o.courier_name || "Le livreur")} a confirmé${o.assign_answered_at ? " à " + hm(o.assign_answered_at) : ""}</span>`);
  if (o.status === "nouvelle" && o.assign_status === "refus") meta.push(`<span class="pill give-no">❌ ${UI.esc(o.assign_refused_name || "Le livreur")} ne peut pas${o.assign_answered_at ? " (" + hm(o.assign_answered_at) + ")" : ""} · donnez-la à un autre</span>`);
  // Attente au départ : annonce (avec photo) et réponse du client, ou montant fixé par le patron
  if (o.status === "confirmee" && o.wait_ann_status && o.wait_ann_status !== "refus") {
    const pend = Store.waitPending(o), feeA = o.wait_fix != null ? Number(o.wait_fix) : Store.waitFeeFor(o.wait_ann_cap, settings, o);
    const who = o.wait_ann_status === "info" ? "commerce prévenu" : pend ? "client : réponse en attente" : o.wait_ann_status === "ok" ? "client : accepté" : "client : sans réponse, accepté d'office";
    meta.push(`<span class="pill ${pend ? "give-wait" : "give-ok"}">${o.wait_fix != null ? `💰 Supplément fixé ${UI.money(feeA)}` : `⏳ Attente annoncée ${o.wait_ann_min} min (photo) · +${UI.money(feeA)} max`} · ${who}</span>`);
  }
  if (o.courier_id && !isMine(o)) meta.push(`<span class="pill courier-pill">🛵 ${UI.esc(o.courier_name || "Livreur")} · commission ${o.network ? "réseau " : ""}${UI.money(o.commission || 0)}${Number(o.hop_share) > 0 ? ` + part Pro ${UI.money(o.hop_share)}` : ""}</span>`);
  if (o.adult_items) meta.push(o.id_checked_at ? `<span class="pill paid">🪪 ${UI.esc(o.adult_items.replace(",", " + "))} · identité vérifiée ${UI.esc(UI.fmtTime(o.id_checked_at))}</span>` : `<span class="pill unpaid">🔞 ${UI.esc(o.adult_items.replace(",", " + "))} · pièce d'identité à vérifier</span>`);
  if (o.shop_ref) meta.push(`<span class="pill star-pill">🛍️ Sac n° ${UI.esc(o.shop_ref)}</span>`);
  if (Number(o.tip) > 0) meta.push(`<span class="pill ${o.tip_status === "promis" ? "unpaid" : "paid"}">💝 Pourboire ${UI.money(o.tip)} · ${TIP_FR[o.tip_status] || ""}</span>`
    + (o.tip_status === "promis" && !o.direct_pay ? `<button class="pill pill-btn paid" data-act="tipok" title="Le Bit du client est arrivé : le pourboire sera reversé au livreur avec son solde">✅ Pourboire reçu</button>` : ""));
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops && !(o.stops || []).length) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(0)} km</span>`);
  if (o.promo_code) meta.push(`<span class="pill">🎁 ${UI.esc(o.promo_code)} −${UI.money(o.discount || 0)}</span>`);
  meta.push(`<span class="pill">${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>`);

  const b = (status, label, cls = "") => `<button class="btn btn-sm ${cls}" data-status="${status}">${label}</button>`;
  const active = rankedCouriers(o);
  // Livreurs qui viennent de s'inscrire : on peut les valider et leur donner la course d'un coup
  const fresh_ = partners().filter(c => c.status === "en_attente");
  const steps = {
    nouvelle: (canTake(o) ? `<button class="btn btn-sm btn-primary" data-act="take">✅ Je la prends</button>` : "")
      + (active.length || fresh_.length ? `<select class="btn btn-sm" data-act="assign"><option value="">👤 Donner à un livreur…</option>${active.map(({ c, km }) => `<option value="${UI.esc(c.id)}">${UI.esc(c.name)}${km != null ? ` · 📍 ${km.toFixed(1)} km` : " · hors service"}${balanceOf(c.id) > Number(settings.max_debt) ? " · 🔒 solde dû" : ""}</option>`).join("")}${fresh_.length ? `<optgroup label="🆕 Viennent de s'inscrire (validés en même temps)">${fresh_.map(c => `<option value="${UI.esc(c.id)}">🆕 ${UI.esc(c.name)}${c.phone ? " · " + UI.esc(c.phone) : ""}</option>`).join("")}</optgroup>` : ""}</select>` : "")
      + `<button class="btn btn-sm" data-act="refuse">🚫 Je ne peux pas</button>`,
    confirmee: b("recuperee", "🛵 Colis récupéré", "btn-primary")
      // Redonner à un autre livreur (l'ancien est prévenu), ou la reprendre soi-même
      // (aussi quand c'est le patron qui l'a prise : il la redonne à un livreur, en ligne ou non — hors ligne, elle l'attend dans son appli et on peut l'appeler)
      + (o.courier_id ? `<select class="btn btn-sm" data-act="assign"><option value="">${isMine(o) ? "🔁 Donner à un livreur…" : "🔁 Donner à un autre…"}</option>${active.filter(({ c }) => c.id !== o.courier_id && c.role !== "admin").map(({ c, km }) => `<option value="${UI.esc(c.id)}">${onlineOf(c).on ? "🟢" : "⚪"} ${UI.esc(c.name)}${km != null ? ` · 📍 ${km.toFixed(1)} km` : ""}${onlineOf(c).on ? "" : " · hors ligne"}</option>`).join("")}</select>${isMine(o) ? "" : `<button class="btn btn-sm" data-act="take">✋ Je la reprends</button>`}` : "")
      + (o.shop_status ? "" : `<button class="btn btn-sm" data-act="waitfix" title="Vous seul pouvez fixer un montant ; le client doit l'accepter">💰 Supplément d'attente</button>`)
      + `<button class="btn btn-sm" data-act="release">↩︎ Remettre en attente</button>` + b("annulee", "✖ Annuler"),
    // Photo obligatoire (devant la porte, ou demandée par le client) : l'appareil photo s'ouvre, la photo part au client, puis « Livré »
    recuperee: needPhoto(o) && !photoDone.has(o.id)
      ? `<label class="btn btn-sm btn-primary">📷 Photo du colis, puis Livré<input type="file" accept="image/*" capture="environment" data-aphoto="${UI.esc(o.id)}" hidden /></label>`
      : b("livree", "📦 Livré", "btn-primary")
  };

  // Course terminée (livrée, annulée, refusée) : une ligne qu'on ouvre ; les courses à faire restent ouvertes
  const closed = ["livree", "annulee", "refusee"].includes(o.status);
  const fold = inner => closed ? `<details class="order-fold" data-id="${UI.esc(o.id)}" data-fold="o:${UI.esc(o.id)}"${foldOpen("o:" + o.id)}><summary>
      <span>${st.icon} ${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}N° ${UI.esc(o.ref)} · ${UI.esc(o.dropoff_contact || o.contact_name || "")}${o.courier_name ? " · 🛵 " + UI.esc(o.courier_name.split(" ")[0]) : ""}${o.is_test ? " · 🧪 test" : ""}</span>
      <b>${UI.money(o.price)}</b></summary>${inner}</details>` : inner;
  return fold(`
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${UI.esc(o.id)}" id="o-${UI.esc(o.id)}">
    <div class="order-head">
      ${tourNo(o) ? `<b class="tour-no" title="Ordre dans votre tournée">${tourNo(o)}</b>` : ""}<span class="order-time">${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}${when}${withDay && o.urgency !== "programmee" && !nbOn ? " · 🕐 " + UI.esc(UI.fmtTime(o.created_at || o.pickup_at)) : ""}</span>
      <span class="pill st-${UI.esc(o.status)}">${st.icon} ${st.label}</span>${o.is_test ? ` <span class="pill">🧪 Test · hors chiffre</span>` : ""}
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(o.price)}</span>
    </div>
    ${whoLine(o)}
    <div class="legs">
      <div class="leg"><span>📍</span><div>${UI.brand(o.pickup_place)}<b><bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(UI.cityFr(o.from_city))}</b>${UI.addrDetails(o, "pickup")}${UI.addrNote(o.pickup_note)}${readyLine(o)}${pickupExtra}<span class="small muted">${tel(o.pickup_contact, o.pickup_phone)}</span>${nav("pickup")}</div></div>
      ${UI.stopsLegs(o, true)}
      <div class="leg"><span>🏁</span><div>${UI.brand(o.dropoff_place)}<b><bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(UI.cityFr(o.to_city))}</b>${UI.addrDetails(o, "dropoff")}${UI.addrNote(o.dropoff_note)}${UI.doorTag(o)}<span class="small muted">${tel(o.dropoff_contact, o.dropoff_phone)}</span>${nav("dropoff")}</div></div>
    </div>
    <div class="meta">${meta.join("")}</div>
    ${o.notes ? `<p class="notice" style="margin-top:10px;white-space:pre-line">📝 ${UI.linkify(o.notes)}</p>` : ""}
    <div class="actions">
      ${steps[o.status] || ""}
      ${!["annulee", "refusee"].includes(o.status) ? `<button class="btn btn-sm" data-act="paid">${o.payment_status === "paye" ? "↩︎ Non encaissé" : "💵 Encaissé"}</button>` : ""}
      ${chatBtn("o:" + o.id, `Course n° ${o.ref}`, `${o.contact_name || "Client"} · ${o.lang === "he" ? "hébreu 🇮🇱" : "français 🇫🇷"}${o.courier_name && !isMine(o) ? " · livreur " + o.courier_name : ""}`, "💬 Client")}
      ${o.courier_id && !isMine(o) ? chatBtn("c:" + o.courier_id, `Livreur : ${o.courier_name || ""}`, "Vos messages avec ce livreur", "💬 Livreur", `Course n° ${o.ref} — `) : ""}
      ${o.leave_at_door && ["recuperee", "livree"].includes(o.status) ? chatBtn("o:" + o.id, `Course n° ${o.ref}`, "Photo du dépôt devant la porte", "📷 Photo du dépôt", I18N.forLang(o.lang || "fr", "msg_door", { name: o.dropoff_contact || o.contact_name || "", ref: o.ref }), true) : ""}
      <a class="btn btn-sm" href="${UI.trackUrl(o)}" target="_blank" rel="noopener">📍 Suivi</a>
      ${o.receipt_number ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}" target="_blank" rel="noopener">🧾 Reçu n° ${o.receipt_number}</a>`
        : o.courier_receipt_number ? `<a class="btn btn-sm" href="${UI.receiptUrl(o)}" target="_blank" rel="noopener">🧾 Reçu du livreur n° ${o.courier_receipt_number}</a>` : ""}
      ${UI.receiptNo(o) && o.contact_phone ? (m => `<a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(o.contact_phone, m))}" target="_blank" rel="noopener">💬 Reçu WhatsApp perso</a><a class="btn btn-sm" href="${UI.esc(UI.smsLink(o.contact_phone, m))}">📩 Reçu par SMS</a>`)(I18N.forLang(o.lang || "fr", "msg_receipt_full", { name: o.contact_name || "", ref: o.ref, n: UI.receiptNo(o), price: UI.money(o.price), url: UI.receiptUrl(o) })) : ""}
      ${o.receipt_number && o.contact_email ? `<a class="btn btn-sm" href="mailto:${UI.esc(o.contact_email)}?subject=${encodeURIComponent(`Reçu n° ${o.receipt_number} · קבלה מס' ${o.receipt_number}`)}&body=${encodeURIComponent(UI.clientMessage(o))}">✉️ Reçu par mail</a>` : ""}
      <button class="btn btn-sm" data-act="price">✏️ Prix</button>
      ${o.hidden_at ? "" : `<button class="btn btn-sm" data-act="test">${o.is_test ? "↩︎ Pas un essai" : "🧪 Course test"}</button>`}
      ${o.hidden_at ? `<button class="btn btn-sm btn-primary" data-act="unhide">↩︎ Remettre</button>`
        : o.is_test || ["annulee", "refusee"].includes(o.status) ? `<button class="btn btn-sm" data-act="hide">🗑️ Effacer</button>` : ""}
      <button class="btn btn-sm" data-act="ics">📅</button>
      <textarea class="admin-note" data-act="note" rows="1" placeholder="Message visible par le client sur la page de suivi…">${UI.esc(o.admin_note || "")}</textarea>
    </div>
  </article>`);
}

function groupedByDay(list) {
  const groups = {};
  list.forEach(o => { (groups[UI.dayKey(o.pickup_at)] = groups[UI.dayKey(o.pickup_at)] || []).push(o); });
  const t = today();
  return Object.keys(groups).sort().map(k => {
    const label = k === t ? "Aujourd'hui" : k < t ? `En retard — ${UI.fmtDay(groups[k][0].pickup_at)}` : UI.fmtDay(groups[k][0].pickup_at);
    return `<div class="day-title">${label} · ${groups[k].length} course(s) · ${UI.money(sum(groups[k]))}</div><div class="orders">${groups[k].sort(byTime).map(o => card(o)).join("")}</div>`;
  }).join("");
}

function agendaList() {
  const t = today();
  return orders.filter(o => !["annulee", "refusee"].includes(o.status) && (active(o) || UI.dayKey(o.pickup_at) >= t));
}

function renderStats() {
  const t = today(), month = t.slice(0, 7);
  $("#stNew").textContent = orders.filter(o => o.status === "nouvelle").length;
  $("#stToday").textContent = orders.filter(o => UI.dayKey(o.pickup_at) === t && !["annulee", "refusee"].includes(o.status)).length;
  $("#stUnpaid").textContent = UI.money(sum(orders.filter(o => isMine(o) && o.payment_status !== "paye" && ["confirmee", "recuperee", "livree"].includes(o.status))));
  // Chiffre du mois = toutes les courses livrées (les vôtres et celles des livreurs) ;
  // Com HOP = les commissions des livreurs + la part HOP des commandes Pro − les codes promo payés par HOP + les abonnements
  const monthFig = m => {
    const delivered = orders.filter(o => o.status === "livree" && !o.is_test && UI.dayKey(o.pickup_at).startsWith(m));
    return { n: delivered.length, rev: sum(delivered, o => Number(o.price) + Number(o.discount || 0) + Number(o.shop_share || 0)),
      hop: sum(delivered.filter(o => !isMine(o)), o => Number(o.commission || 0) + Number(o.hop_share || 0) - Number(o.discount || 0))
        + sum(planSales.filter(p => String(p.created_at).startsWith(m)), p => Number(p.amount) - Number(p.referrer_share || 0)) };
  };
  // Le 1er du mois, les compteurs repartent à zéro : le mois précédent reste affiché en dessous (rien n'est perdu)
  const [y, mo] = month.split("-").map(Number), prevKey = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const cur = monthFig(month), prev = monthFig(prevKey);
  const prevName = new Date(Date.UTC(mo === 1 ? y - 1 : y, (mo + 10) % 12, 15)).toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  const prevLine = (id, txt) => { const el = $(id); if (el) el.textContent = prev.n || prev.hop ? txt : ""; };
  $("#stMonthRev").textContent = UI.money(cur.rev);
  $("#stMonthHop").textContent = UI.money(cur.hop);
  prevLine("#stMonthRevPrev", `${prevName} : ${UI.money(prev.rev)} · ${prev.n} course${prev.n > 1 ? "s" : ""}`);
  prevLine("#stMonthHopPrev", `${prevName} : ${UI.money(prev.hop)}`);
  const pending = couriers.filter(c => c.status === "en_attente").length + unfinished().length;
  const pendingShops = shops.filter(x => !x.demo && x.status === "en_attente").length;
  const newReqs = requests.filter(x => x.status === "nouvelle").length;
  const fresh = orders.filter(o => o.status === "nouvelle").length;
  // Pastilles rouges : sur l'onglet et sur sa rubrique
  const badge = (sel, n) => { $(sel).textContent = n > 0 ? n : ""; };
  badge("#pendingBadge", pending); badge("#shopsBadge", pendingShops); badge("#reqBadge", newReqs); badge("#newBadge", fresh);
  badge("#gbCourses", fresh); badge("#gbLivreurs", pending); badge("#gbBusiness", pendingShops + newReqs);
}

// Tableaux sur téléphone : chaque ligne devient une fiche (libellé de la colonne à gauche, valeur à droite)
function labelTables(root) {
  root.querySelectorAll("table.bill").forEach(tb => {
    const heads = [...tb.querySelectorAll("thead th")].map(th => th.textContent.trim());
    tb.querySelectorAll("tbody tr, tfoot tr").forEach(tr => [...tr.children].forEach((td, i) => {
      if (heads[i] && !td.hasAttribute("colspan")) td.setAttribute("data-label", heads[i]);
      if (!td.textContent.trim() && !td.querySelector("button, a, select")) td.classList.add("cell-empty");
    }));
  });
}
// --- 📊 Visites du site : d'où viennent les visiteurs, ce qu'ils regardent, combien commandent ---------------
const visits = { days: 7, data: null, at: 0, busy: false };
async function loadVisits(force) {
  if (visits.busy || (!force && visits.data && Date.now() - visits.at < 60000)) return;
  visits.busy = true;
  try {
    const [d, f] = await Promise.all([Store.adminAnalytics(visits.days), Store.adminFunnel(visits.days)]);
    visits.data = d ? Object.assign(d, { funnel: f }) : { empty: true };
  } catch (e) { visits.data = { error: true }; }
  visits.busy = false; visits.at = Date.now();
  if (tab === "visites") render();
}
const SRC_LABEL = { direct: "✍️ Direct (lien tapé, favori, appli, WhatsApp privé)", google: "🔎 Google", facebook: "📘 Facebook", instagram: "📸 Instagram",
  tiktok: "🎵 TikTok", ig: "📸 Instagram", fb: "📘 Facebook", whatsapp: "💬 WhatsApp", twitter: "🐦 X / Twitter", bing: "🔎 Bing", flyer: "🧾 Flyers (QR)", qr: "🔳 QR du kit pub",
  "qr-commerce": "🏪 QR d'un commerce (autocollant, lien du commerce)", groupes: "👥 Groupes (Facebook, WhatsApp)", reseaux: "📣 Réseaux (kit pub)" };
const PAGE_LABEL = { index: "🏠 Accueil et commande", suivi: "📍 Suivi d'une course", commerce: "🏪 Espace commerce", "on-livre": "📦 « Ce qu'on livre »",
  recu: "🧾 Reçus", kit: "📣 Kit pub" };
const pct = (a, b) => (b ? Math.round(a * 100 / b) : 0) + " %";
function vBars(rows, key, label) {
  const max = Math.max(1, ...rows.map(r => Number(r[key]) || 0));
  return `<div class="v-bars">${rows.map(r => `<div class="v-bar" title="${UI.esc(label(r))} : ${Number(r[key]) || 0}"><b>${Number(r[key]) || ""}</b><i style="height:${Math.round((Number(r[key]) || 0) * 100 / max)}%"></i><small>${UI.esc(label(r))}</small></div>`).join("")}</div>`;
}
// Entonnoir : à chaque étape, combien de visites arrivent jusque-là, et ce qui bloque « Continuer »
const BLOCK_LABEL = { dropoff_address: "adresse de livraison", dropoff_number: "n° de rue (livraison)", pickup_address: "adresse de départ", pickup_number: "n° de rue (départ)",
  contact_name: "nom", contact_phone: "téléphone", dropoff_floor: "étage", dropoff_apt: "appartement", dropoff_code: "code d'entrée", shop_order: "commande au commerce (vide)",
  shopping_list: "liste de courses", fits_topcase: "case « tient dans le top case »", budget: "budget des courses", date: "date", time: "heure", shop_ref: "n° de commande du commerce" };
function funnelCard(f) {
  if (!f) return "";
  const steps = [["👀 Visites", f.visits], ["🛵 Commande ouverte", f.started], ["🛒 1er article ajouté", f.cart], ["2️⃣ Écran 2 (détails)", f.step2], ["3️⃣ Écran 3 (paiement)", f.step3], ["✅ Commande envoyée", f.sent]];
  const max = Math.max(1, Number(f.visits) || 0);
  const lbl = w => { const m = /^e(\d):(.*)$/.exec(w || ""); return m ? `Écran ${m[1]} · ${BLOCK_LABEL[m[2]] || m[2]}` : w || "?"; };
  return `<div class="card" style="margin-top:12px"><h3>🧲 Où les clients s'arrêtent</h3>
    <div class="v-rows">${steps.map(([l, n]) => `<div class="v-row"><span>${l}</span><b>${Number(n) || 0}</b><small><span class="fn-bar"><i style="width:${Math.round((Number(n) || 0) * 100 / max)}%"></i></span> ${pct(Number(n) || 0, max)} des visites</small></div>`).join("")}</div>
    ${(f.blocks || []).length ? `<p class="small" style="margin:10px 0 4px"><b>« Continuer » refusé, à cause de :</b></p><div class="v-rows">${f.blocks.map(b => `<div class="v-row"><span>⛔ ${UI.esc(lbl(b.what))}</span><b>${b.n}</b><small>${b.sessions} visite${b.sessions > 1 ? "s" : ""}</small></div>`).join("")}</div>`
      : `<p class="muted small">Les blocages s'afficheront ici dès la mise en ligne de la nouvelle version.</p>`}</div>`;
}
// Commandes ouvertes et pas envoyées (07/11) : une ligne par visite, sans nom ni téléphone (rien n'a été envoyé)
const REACH_LABEL = ["a ouvert la commande, rien rempli", "🛒 a ajouté un article", "2️⃣ est allé à l'écran 2 (détails)", "3️⃣ est allé jusqu'au paiement"];
function openedCard(list) {
  if (!Array.isArray(list)) return "";
  const hh = d => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "";
  const day = d => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
  const blk = w => { const m = /^e(\d):(.*)$/.exec(w || ""); return m ? `bloqué à l'écran ${m[1]} : ${BLOCK_LABEL[m[2]] || m[2]}` : ""; };
  return `<div class="card" id="openedCard" style="margin-top:12px;scroll-margin-top:150px"><h3>🛵 Commandes ouvertes, pas envoyées (${list.length})</h3>
    <p class="muted small" style="margin:0 0 8px">Des clients ont ouvert l'écran de commande puis sont partis sans envoyer. Rien n'a été envoyé : pas de nom ni de téléphone, seulement ce qu'ils ont fait. Ceux qui ont mis un article dans un panier avec leur téléphone sont dans l'onglet 🛒 Paniers.</p>
    ${list.length ? `<div class="v-rows">${list.map(o => `<div class="v-row"><span>${visits.days > 1 ? UI.esc(day(o.at)) + " · " : ""}<b>${hh(o.at)}</b> · ${UI.esc(SRC_LABEL[o.source] || "🔗 " + o.source)}${o.campaign ? " · " + UI.esc(o.campaign) : ""}</span>
        <b>${o.reached ? "étape " + o.reached : "0"}</b>
        <small>${UI.esc(REACH_LABEL[o.reached] || "")}${o.block ? " · ⛔ " + UI.esc(blk(o.block)) : ""}${o.shops ? "<br>🏪 A regardé : " + UI.esc(String(o.shops).split(" · HOP! ")[0]) : ""}<br>${o.device === "mobile" ? "📱" : o.device === "tablette" ? "📟" : "💻"} ${o.lang === "he" ? "🇮🇱 hébreu" : "🇫🇷 français"}${o.app ? " · appli installée" : ""} · ${o.client_orders ? `déjà client (${o.client_orders} commande${o.client_orders > 1 ? "s" : ""})` : o.returning ? "déjà venu sur HOP!" : "1ʳᵉ visite"} · parti vers ${hh(o.last_at)}</small></div>`).join("")}</div>`
      : `<p class="muted small">Aucune sur cette période.</p>`}</div>`;
}
// --- ✅ Réponses WhatsApp (patron, 08/11) ---------------------------------------------------------------
// Le client écrit sur WhatsApp (bouton « Envoyez votre liste ») : réponses toutes faites à copier, puis le lien
// « commande prête » (?liste=…) : le client met son adresse et valide dans l'appli → suivi, livreurs, paiement normaux.
const waKit = { lang: "fr", list: "", phone: "" };
function waKitTexts() {
  const base = UI.appUrl("");
  const link = base + "?" + (waKit.list.trim() ? "liste=" + encodeURIComponent(waKit.list.trim().slice(0, 1500)) + "&" : "") + "src=wa";
  const app = base + "?src=partage";
  const FR = [
    ["👋 Bonjour", "Bonjour 👋 Merci pour votre message, ici HOP! 🛵\nDites-moi ce que vous voulez : une photo de votre liste ou un vocal, c'est parfait. Et le magasin si vous en avez un en tête."],
    ["🏪 Quel magasin ?", "Vous avez un magasin préféré (supermarché, pharmacie, boulangerie…) ? Sinon on prend le plus proche de chez vous."],
    ["🕐 Pour quand ?", "Vous voulez être livré maintenant, ou plus tard ? Vous pouvez aussi choisir le jour et l'heure."],
    ["💰 Le prix", "La livraison, c'est dès 25 ₪ en ville (30 ₪ pour la zone industrielle et certains quartiers), plus un petit supplément quand on fait les courses pour vous. Vos articles sont au prix exact du ticket de caisse : le livreur vous envoie la photo. Le prix exact s'affiche dans l'appli avant de valider."],
    ["💳 Paiement", "Vous payez directement au livreur : Bit, PayBox ou espèces. Aucune carte bancaire à donner."],
    ["✅ Commande prête (lien)", "Votre commande est prête ✅\nIl ne vous reste qu'à mettre votre adresse et à valider, ça prend 30 secondes :\n" + link + "\nEnsuite, vous suivez votre livreur en direct dans l'appli 🛵", true],
    ["🌙 Fermé pour le moment", "On est fermé pour le moment, mais vous pouvez commander dès maintenant : on vous livre dès l'ouverture 🌙\n" + link, true],
    ["🔔 Relance", "Petit rappel 🙂 Votre commande vous attend ici, il manque juste votre adresse :\n" + link, true],
    ["🙏 Merci", "Merci pour votre commande 🙏 Si vous avez aimé, partagez HOP! à vos proches : " + app]
  ];
  const HE = [
    ["👋 שלום", "שלום 👋 תודה על ההודעה, כאן HOP! 🛵\nכתבו לנו מה אתם צריכים: תמונה של הרשימה או הודעה קולית, מעולה. ואת החנות, אם יש לכם העדפה."],
    ["🏪 איזו חנות?", "יש לכם חנות מועדפת (סופר, בית מרקחת, מאפייה…)? אם לא, ניקח מהקרובה אליכם."],
    ["🕐 מתי?", "רוצים את המשלוח עכשיו או מאוחר יותר? אפשר גם לבחור יום ושעה."],
    ["💰 המחיר", "המשלוח החל מ-25 ₪ בעיר (30 ₪ לאזור התעשייה ולחלק מהשכונות), ועוד תוספת קטנה כשאנחנו עושים בשבילכם את הקניות. המוצרים במחיר המדויק של הקבלה: השליח שולח לכם תמונה. המחיר המדויק מופיע באפליקציה לפני האישור."],
    ["💳 תשלום", "משלמים ישירות לשליח: ביט, פייבוקס או מזומן. לא צריך לתת כרטיס אשראי."],
    ["✅ ההזמנה מוכנה (קישור)", "ההזמנה שלכם מוכנה ✅\nנשאר רק להוסיף כתובת ולאשר, זה לוקח 30 שניות:\n" + link + "\nאחר כך עוקבים אחרי השליח בזמן אמת באפליקציה 🛵", true],
    ["🌙 סגור כרגע", "אנחנו סגורים כרגע, אבל אפשר כבר להזמין: נביא לכם ברגע שנפתח 🌙\n" + link, true],
    ["🔔 תזכורת", "תזכורת קטנה 🙂 ההזמנה שלכם מחכה כאן, חסרה רק הכתובת:\n" + link, true],
    ["🙏 תודה", "תודה על ההזמנה 🙏 אם נהניתם, שתפו את HOP! עם החברים: " + app]
  ];
  return waKit.lang === "he" ? HE : FR;
}
function waKitList() {
  return waKitTexts().map(([title, text, withLink], i) => `<div class="wk-item${withLink ? " wk-link" : ""}"><b>${UI.esc(title)}</b>
    <p dir="${waKit.lang === "he" ? "rtl" : "ltr"}">${UI.esc(text)}</p>
    <div class="wk-btns"><button type="button" class="btn btn-sm" data-wk-copy="${i}">📋 Copier</button><a class="btn btn-sm wk-wa" data-wk-wa="${i}" href="#" target="_blank" rel="noopener">WhatsApp ›</a></div></div>`).join("");
}
function renderWaKit(view) {
  view.innerHTML = `<div class="card wa-kit" id="waKit">
    <h3>✅ Réponses WhatsApp toutes faites</h3>
    <p class="muted small">Un client vous écrit (bouton « Envoyez votre liste sur WhatsApp ») : copiez une réponse et collez-la dans la conversation.
      À la fin, envoyez <b>« Commande prête »</b> : le lien ouvre HOP! avec sa liste déjà écrite. Le client met <b>son adresse et son téléphone</b> et valide :
      la commande arrive dans « À accepter » comme toutes les autres (suivi en direct, livreurs, paiement, reçu). Si le client n'y arrive pas,
      ouvrez vous-même le lien et remplissez pour lui.</p>
    <a class="btn btn-primary wk-enter" data-wk-enter href="#" target="_blank" rel="noopener">➕ Saisir moi-même la commande du client</a>
    <p class="muted small">Ouvre HOP! avec sa liste : vous mettez son adresse (maison / appartement, étage, code), son nom et son téléphone, vous validez,
      puis « 📲 Envoyer le suivi au client ». La commande arrive dans « À accepter » comme les autres : livreurs, liste à cocher, suivi en direct.</p>
    <div class="wk-lang"><button type="button" class="btn btn-sm${waKit.lang === "fr" ? " on" : ""}" data-wk-lang="fr">Français</button><button type="button" class="btn btn-sm${waKit.lang === "he" ? " on" : ""}" data-wk-lang="he">עברית</button></div>
    <label class="f full"><span>📝 La liste du client (collez ou écrivez-la : elle sera déjà remplie dans sa commande)</span>
      <textarea id="wkList" rows="4" placeholder="Ex. 2 lait, 6 œufs, 1 pain, Acamol">${UI.esc(waKit.list)}</textarea></label>
    <label class="f"><span>📱 Numéro du client (facultatif, pour le bouton WhatsApp)</span><input id="wkPhone" type="tel" inputmode="tel" placeholder="05X-XXX-XXXX" value="${UI.esc(waKit.phone)}" /></label>
    <div id="wkItems" class="wk-items">${waKitList()}</div>
  </div>`;
}
document.addEventListener("input", e => {
  if (e.target.id === "wkList") { waKit.list = e.target.value; $("#wkItems").innerHTML = waKitList(); }
  else if (e.target.id === "wkPhone") waKit.phone = e.target.value;
});
document.addEventListener("click", async e => {
  const lg = e.target.closest("[data-wk-lang]");
  if (lg) { waKit.lang = lg.dataset.wkLang; const v = $("#view"); renderWaKit(v); return; }
  const cp = e.target.closest("[data-wk-copy]");
  if (cp) {
    const txt = waKitTexts()[Number(cp.dataset.wkCopy)][1];
    try { await navigator.clipboard.writeText(txt); cp.textContent = "✓ Copié"; } catch (err) { prompt("Copiez ce texte :", txt); }
    setTimeout(() => { cp.textContent = "📋 Copier"; }, 1500);
    return;
  }
  const en = e.target.closest("[data-wk-enter]");
  if (en) { const l = waKit.list.trim(); en.href = UI.appUrl("") + "?pour=1" + (l ? "&liste=" + encodeURIComponent(l.slice(0, 1500)) : ""); return; }
  const wa = e.target.closest("[data-wk-wa]");
  if (wa) wa.href = UI.waPersonal(waKit.phone.replace(/\D/g, ""), waKitTexts()[Number(wa.dataset.wkWa)][1]);
}, true);

function renderVisits(view) {
  loadVisits();
  const d = visits.data;
  const chips = `<div class="actions" style="margin-bottom:12px">${[[1, "Aujourd'hui"], [7, "7 jours"], [30, "30 jours"], [90, "3 mois"]].map(([n, l]) =>
    `<button class="btn btn-sm${visits.days === n ? " btn-primary" : ""}" data-vdays="${n}">${l}</button>`).join("")}<button class="btn btn-sm" data-vdays="${visits.days}" title="Actualiser">↻</button></div>`
    + (d && d.by_day && d.by_day.length && visits.days > 1 ? `<p class="muted small" style="margin:-6px 0 10px">Visites comptées depuis le ${UI.esc(d.by_day[0].d.slice(8, 10) + "/" + d.by_day[0].d.slice(5, 7))} (début du suivi) : avant cette date, il n'y a rien à compter, les périodes plus longues donnent donc les mêmes chiffres.</p>` : "");
  if (!d) { view.innerHTML = chips + `<div class="empty card">Chargement des visites…</div>`; return; }
  if (d.error || d.empty) { view.innerHTML = chips + `<div class="empty card">${d.error ? "Visites indisponibles, vérifiez la connexion." : "Les visites s'affichent avec la base en ligne."}</div>`; return; }
  const days = (d.by_day || []).map(x => ({ ...x, label: x.d.slice(8, 10) + "/" + x.d.slice(5, 7) }));
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, sessions: ((d.by_hour || []).find(x => x.h === h) || {}).sessions || 0 }));
  // Une ligne par élément (lisible sur le téléphone) : nom, chiffre principal, détails
  const rows = list => list.length ? `<div class="v-rows">${list.join("")}</div>` : `<p class="muted small">Rien pour l'instant.</p>`;
  const row = (label, big, sub) => `<div class="v-row"><span>${label}</span><b>${big}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  view.innerHTML = chips + `
    <div class="stats">
      <div class="stat"><small>Visiteurs</small><b>${d.visitors}</b><em class="muted small">dont ${d.new_visitors} nouveaux</em></div>
      <div class="stat"><small>Visites</small><b>${d.sessions}</b><em class="muted small">${d.views} pages vues</em></div>
      <div class="stat" data-opened-go="1" style="cursor:pointer"><small>Commande ouverte</small><b>${d.started}</b><em class="muted small">${pct(d.started, d.sessions)} des visites · voir ›</em></div>
      <div class="stat"><small>Commandes envoyées</small><b>${d.sent}</b><em class="muted small">${pct(d.sent, d.sessions)} des visites · ${UI.money(d.sent_amount)}</em></div>
      <div class="stat"><small>Depuis l'appli installée</small><b>${d.app}</b><em class="muted small">${pct(d.app, d.sessions)} des visites</em></div>
    </div>
    ${funnelCard(d.funnel)}
    ${openedCard(d.opened)}
    <div class="card" style="margin-top:12px"><h3>📈 Visites par jour</h3>${days.length ? vBars(days, "sessions", r => r.label) : `<p class="muted small">Pas encore de visite.</p>`}</div>
    <div class="card" style="margin-top:12px"><h3>🧭 D'où ils viennent</h3>
      ${rows((d.sources || []).map(s => row(UI.esc(SRC_LABEL[s.source] || "🔗 " + s.source), `${s.sessions} visite${s.sessions > 1 ? "s" : ""}`,
        `${s.visitors} visiteur${s.visitors > 1 ? "s" : ""} · ${s.started} commande ouverte · <b>${s.sent} envoyée${s.sent > 1 ? "s" : ""}</b> (${pct(s.sent, s.sessions)})`)))}
      <p class="muted small" style="margin-top:6px">Pour savoir ce que rapporte une pub, mettez dans son lien <b>?src=</b> suivi d'un nom (ex. <code>${UI.esc(UI.appUrl("on-livre.html"))}?src=insta-octobre</code>) : elle a sa propre ligne ici. Les flyers et QR du kit pub sont déjà comptés.</p></div>
    ${(d.campaigns || []).length ? `<div class="card" style="margin-top:12px"><h3>📣 Campagnes et commerces (QR)</h3>${rows(d.campaigns.map(c =>
      row(UI.esc(c.campaign), `${c.sessions} visite${c.sessions > 1 ? "s" : ""}`, `${UI.esc(SRC_LABEL[c.source] || c.source)} · ${c.sent} envoyée${c.sent > 1 ? "s" : ""}`)))}</div>` : ""}
    <div class="card" style="margin-top:12px"><h3>🏪 Commerces les plus regardés</h3>${rows((d.shops || []).map(s =>
      row(UI.esc(s.name || s.code), `${s.views} fois`, `${s.sessions} visite${s.sessions > 1 ? "s" : ""}`)))}</div>
    <div class="card" style="margin-top:12px"><h3>📄 Pages vues</h3>${rows((d.pages || []).map(p => row(UI.esc(PAGE_LABEL[p.page] || p.page), String(p.views))))}</div>
    <div class="card" style="margin-top:12px"><h3>🕘 Heures des visites</h3>${vBars(hours, "sessions", r => String(r.h))}</div>
    <div class="card" style="margin-top:12px"><h3>📱 Appareils et langue</h3>
      <p>${(d.devices || []).map(x => `${x.device === "mobile" ? "📱" : x.device === "tablette" ? "📟" : "💻"} ${UI.esc(x.device)} : <b>${x.sessions}</b>`).join(" · ") || "—"}</p>
      <p>${(d.langs || []).map(x => `${x.lang === "he" ? "🇮🇱 hébreu" : x.lang === "fr" ? "🇫🇷 français" : UI.esc(x.lang)} : <b>${x.sessions}</b>`).join(" · ") || "—"}</p></div>
    <div class="card" style="margin-top:12px"><h3>🧾 Dernières commandes et leur source</h3>${rows((d.orders || []).map(o =>
      row(`<b>${UI.esc(o.ref || "")}</b> · ${UI.esc(UI.fmtDateTime(o.at))}`, UI.money(o.amount || 0),
        `Venue par ${UI.esc(SRC_LABEL[o.source] || o.source)}${o.first_source && o.first_source !== o.source ? ` · 1ʳᵉ visite : ${UI.esc(SRC_LABEL[o.first_source] || o.first_source)}` : ""}`)))}</div>
    <p class="muted small" style="margin-top:10px">Comptées depuis la mise en ligne des visites, sans nom ni téléphone : chaque téléphone a un numéro au hasard. Vos propres visites (patron, livreurs) ne sont pas comptées.</p>`;
}
// Rubrique de l'onglet ouvert : seuls ses onglets s'affichent ; chiffres et service seulement dans « Courses »
// --- 🧺 Rayons à cocher : les listes de produits (pharmacie, tabac, boulangerie, bébé, animaux…) modifiables -----
// Les listes de base sont dans rayons.js ; ce que le patron change part dans rayon_items / rayon_cats et
// s'applique par-dessus, tout de suite pour les clients. Rien n'est effacé : « masquer », puis « rétablir ».
const ray = { id: "pharm", loaded: false, error: false, busy: false, edit: null };
async function loadRayons(force) {
  if (!window.Rayons || ray.busy || (ray.loaded && !force)) return;
  ray.busy = true;
  try { Rayons.apply(await Store.rayonsLive()); ray.loaded = true; ray.error = false; } catch (e) { ray.error = true; }
  ray.busy = false;
  if (tab === "rayons") render();
}
const rayName = x => x.fr || x.he || "";
const rayPic = (x, cls) => (UI.safeImg(x.photo) ? `<img class="${cls}" src="${UI.safeImg(x.photo)}" alt="" loading="lazy" />` : x.img ? `<img class="${cls}" src="img/qc/${x.img}.webp" alt="" />` : `<i class="${cls}">${x.e || "🛒"}</i>`);
const rayPrice = x => (x.p ? (x.p[0] === x.p[1] ? `${x.p[0]} ₪` : `${x.p[0]}-${x.p[1]} ₪`) : "");
function renderRayons(view) {
  loadRayons();
  const r = Rayons.byId(ray.id);
  const chips = `<div class="actions ray-chips">${Rayons.ALL.map(x => `<button class="btn btn-sm${x.id === ray.id ? " btn-primary" : ""}" data-ray="${x.id}">${UI.esc(rayName(x.title))}</button>`).join("")}</div>`;
  if (!ray.loaded) { view.innerHTML = chips + `<div class="empty card">${ray.error ? "Rayons indisponibles, vérifiez la connexion." : "Chargement…"}</div>`; return; }
  const cats = r.cats.filter(c => !c.hidden), hiddenCats = r.cats.filter(c => c.hidden), hiddenItems = r.items.filter(i => i.hidden);
  const row = x => `<div class="ray-row${x.hidden ? " off" : ""}">${rayPic(x, "ray-img")}<div class="ray-txt"><b>${UI.esc(x.fr)}</b><span dir="rtl">${UI.esc(x.he)}</span><small>${[rayPrice(x), x.sz > 1 ? `${x.sz} places` : "", x.adult ? "18+" : "", x.opt ? `${x.opt.length} variantes` : "", x.added ? "ajouté" : x.edited ? "modifié" : ""].filter(Boolean).join(" · ")}</small></div>
    <span class="ray-act"><button type="button" class="btn btn-sm" data-ray-edit="${x.id}" title="Modifier">✏️</button><button type="button" class="btn btn-sm" data-ray-hide="${x.id}" data-on="${x.hidden ? 0 : 1}" title="${x.hidden ? "Rétablir" : "Masquer"}">${x.hidden ? "↩️ Rétablir" : "🚫"}</button></span></div>`;
  view.innerHTML = chips + (ray.edit ? rayForm(r) : "") + `<div class="card ray-head"><div><h3>${UI.esc(rayName(r.title))}</h3><p class="muted small">${r.items.filter(i => !i.hidden).length} produits dans ${cats.length} catégories. Ce que vous changez ici est en ligne tout de suite pour les clients (noms en français et en hébreu, photo ou pictogramme, prix indicatif en magasin).${r.id === "tabac" ? " Cigarettes : ni prix ni image (loi israélienne)." : ""}</p></div>
      <div class="actions ray-btns"><button type="button" class="btn btn-primary" data-ray-new="item">➕ Produit</button><button type="button" class="btn" data-ray-new="cat">➕ Catégorie</button></div></div>
    ${cats.map(c => `<div class="card ray-cat"><h4>${rayPic(c, "ray-img")}<span>${UI.esc(c.fr)} <small dir="rtl">${UI.esc(c.he)}</small></span><span class="ray-act"><button type="button" class="btn btn-sm" data-ray-cedit="${c.id}" title="Modifier">✏️</button><button type="button" class="btn btn-sm" data-ray-chide="${c.id}" data-on="1" title="Masquer la catégorie">🚫</button></span></h4>
      ${r.items.filter(i => i.c === c.id && !i.hidden).map(row).join("") || `<p class="muted small">Aucun produit : « ➕ Produit », puis choisissez cette catégorie.</p>`}</div>`).join("")}
    ${hiddenItems.length || hiddenCats.length ? `<details class="card ray-off" data-fold="rayoff"${foldOpen("rayoff")}><summary>🚫 Masqués (${hiddenItems.length + hiddenCats.length}) : les clients ne les voient pas</summary>${hiddenCats.map(c => `<div class="ray-row off">${rayPic(c, "ray-img")}<div class="ray-txt"><b>${UI.esc(c.fr)}</b><small>catégorie entière</small></div><span class="ray-act"><button type="button" class="btn btn-sm" data-ray-chide="${c.id}" data-on="0">↩️ Rétablir</button></span></div>`).join("")}${hiddenItems.map(row).join("")}</details>` : ""}`;
}
// Formulaire produit / catégorie : ce qui est tapé est gardé (vals) quand on choisit une image ou une photo
function rayForm(r) {
  const e = ray.edit, x = e.x || {}, isCat = e.kind === "cat", v = e.vals || {};
  const cur = { photo: e.photo !== undefined ? e.photo : x.photo, img: e.img !== undefined ? e.img : x.img, e: v.emoji !== undefined ? v.emoji : x.e };
  const val = (k, d) => (v[k] !== undefined ? v[k] : d);
  const grid = e.pick ? `<div class="ray-pick"><input id="rayPickQ" type="search" placeholder="Chercher (bread, cat, battery, bottle…)" value="${UI.esc(e.q || "")}" /><div class="ray-grid" id="rayGrid">${rayGrid(e.q, cur)}</div></div>` : "";
  return `<form class="card ray-form" id="rayForm">
    <h3>${e.x ? "✏️ Modifier" : "➕ Nouveau"} ${isCat ? "une catégorie" : "produit"} · ${UI.esc(rayName(r.title))}</h3>
    <div class="ray-pic-row">${rayPic(cur, "ray-img big")}<div class="actions ray-btns">
      <label class="btn btn-sm">📷 Photo<input type="file" accept="image/*" id="rayPhoto" hidden /></label>
      <button type="button" class="btn btn-sm" data-ray-pick="1">🖼️ Pictogramme</button>
      <label class="f ray-emoji">Emoji<input name="emoji" value="${UI.esc(cur.e || "")}" maxlength="4" /></label>
      ${cur.photo ? `<button type="button" class="btn btn-sm" data-ray-nophoto="1">✖ Sans photo</button>` : ""}</div></div>
    ${grid}
    <div class="ray-fields">
      <label class="f">Nom (français)<input name="fr" required maxlength="80" value="${UI.esc(val("fr", x.fr || ""))}" /></label>
      <label class="f">Nom (hébreu)<input name="he" dir="rtl" maxlength="80" value="${UI.esc(val("he", x.he || ""))}" placeholder="(sinon le français)" /></label>
      ${isCat ? "" : `<label class="f">Catégorie<select name="cat">${r.cats.filter(c => !c.hidden).map(c => `<option value="${c.id}"${val("cat", x.c || e.cat) === c.id ? " selected" : ""}>${UI.esc(c.fr)}</option>`).join("")}</select></label>
      <label class="f">Prix indicatif en magasin (₪), min et max<span class="ray-2"><input name="lo" type="number" min="0" step="0.5" value="${UI.esc(val("lo", x.p ? x.p[0] : ""))}" placeholder="min" /><input name="hi" type="number" min="0" step="0.5" value="${UI.esc(val("hi", x.p ? x.p[1] : ""))}" placeholder="max" /></span></label>
      <label class="f">Place dans le top case<select name="sz">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}"${Number(val("sz", x.sz || 1)) === n ? " selected" : ""}>${n}${n === 1 ? " (petit article)" : n === 8 ? " (pack de 6 bouteilles de 1,5 L)" : n >= 4 ? " (gros : couches, pack)" : ""}</option>`).join("")}</select></label>
      <label class="f">18 ans et plus<select name="adult"><option value="">Non</option><option value="tabac"${val("adult", x.adult || "") === "tabac" ? " selected" : ""}>Tabac</option><option value="alcool"${val("adult", x.adult || "") === "alcool" ? " selected" : ""}>Alcool</option></select></label>
      <label class="f ray-full">Variantes, une par ligne : français | hébreu | prix min-max (facultatif)<textarea name="opts" rows="3" placeholder="20 comprimés | 20 טבליות | 12-18&#10;50 comprimés | 50 טבליות | 25-30">${UI.esc(val("opts", (x.opt || []).map(o => [o.fr, o.he, o.p ? o.p.join("-") : ""].join(" | ")).join("\n")))}</textarea></label>`}
    </div>
    <div class="actions"><button type="submit" class="btn btn-primary">💾 Enregistrer</button><button type="button" class="btn" data-ray-cancel="1">Annuler</button><span class="muted small" id="rayMsg"></span></div></form>`;
}
const rayGrid = (q, cur) => Rayons.PICTOS.filter(n => !q || n.includes(String(q).toLowerCase().trim())).map(n => `<button type="button" class="${cur.img === n && !cur.photo ? "on" : ""}" data-ray-pic="${n}" title="${n}"><img src="img/qc/${n}.webp" alt="${n}" loading="lazy" /></button>`).join("");
function rayStash() {
  const f = $("#rayForm");
  if (!f || !ray.edit) return;
  ray.edit.vals = Object.fromEntries([...f.elements].filter(el => el.name).map(el => [el.name, el.value]));
}
// Photo d'un produit : carrée, légère (la vignette fait 52 px)
function rayCrop(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = 200, k = Math.max(w / img.width, w / img.height), sw = w / k, sh = w / k;
      const c = document.createElement("canvas");
      c.width = c.height = w;
      c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, w);
      for (const q of [0.85, 0.7, 0.55, 0.4]) { const d = c.toDataURL("image/jpeg", q); if (d.length < 80000) return resolve(d); }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
const raySlug = (s, taken) => {
  let b = String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "p";
  let id = b, n = 2;
  while (taken.includes(id)) id = `${b}-${n++}`;
  return id;
};
async function raySubmit(e) {
  e.preventDefault();
  const f = e.target, ed = ray.edit, r = Rayons.byId(ray.id), isCat = ed.kind === "cat", msg = $("#rayMsg");
  const g = k => (f.elements[k] ? f.elements[k].value.trim() : "");
  if (!g("fr")) return;
  const img = ed.img !== undefined ? ed.img : (ed.x || {}).img;
  const p = { rayon: r.id, name_fr: g("fr"), name_he: g("he") || null, img: img || null, emoji: g("emoji") || null, hidden: false };
  if (isCat) {
    p.cat_id = ed.x ? ed.x.id : raySlug(g("fr"), r.cats.map(c => c.id));
    if (!ed.x) p.position = r.cats.length;
  } else {
    p.item_id = ed.x ? ed.x.id : raySlug(g("fr"), r.items.map(i => i.id));
    p.cat = g("cat"); p.sz = Number(g("sz")) || 1; p.adult = g("adult") || null;
    p.price_lo = g("lo") === "" ? null : Number(g("lo"));
    p.price_hi = g("hi") === "" ? p.price_lo : Number(g("hi"));
    if (p.price_lo != null && p.price_hi < p.price_lo) p.price_hi = p.price_lo;
    p.opts = g("opts").split("\n").map(l => l.split("|").map(s => s.trim())).filter(a => a[0]).map(a => {
      const m = /^(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?$/.exec(a[2] || "");
      return Object.assign({ fr: a[0], he: a[1] || a[0] }, m ? { p: [Number(m[1].replace(",", ".")), Number((m[2] || m[1]).replace(",", "."))] } : {});
    });
    if (!p.opts.length) p.opts = null;
    if (ed.photo !== undefined) p.photo = ed.photo;
    if (!ed.x) p.position = r.items.length;
  }
  msg.textContent = "Enregistrement…";
  try {
    await Store.adminRayonSave(isCat ? "cat" : "item", p);
    Rayons.apply(isCat ? { cats: [p] } : { items: [p] });
    ray.edit = null; render();
  } catch (err) { msg.textContent = "Non enregistré, réessayez" + (/photo/.test(err.message || "") ? " (photo trop lourde)" : "") + "."; }
}
async function rayHide(kind, id, hidden) {
  const r = Rayons.byId(ray.id), key = kind === "cat" ? "cat_id" : "item_id";
  const p = { rayon: r.id, [key]: id, hidden };
  try { await Store.adminRayonSave(kind, p); Rayons.apply(kind === "cat" ? { cats: [p] } : { items: [p] }); render(); }
  catch (e) { alert("Non enregistré, réessayez."); }
}
const groupOf = t => (document.querySelector(`#tabs [data-tab="${t}"]`) || {}).dataset?.group || "courses";
function render() {
  ficheDirty.clear();   // l'écran est reconstruit : plus de fiche en cours de modification
  renderStats();
  const grp = groupOf(tab);
  document.querySelectorAll(".tab").forEach(b => { b.classList.toggle("on", b.dataset.tab === tab); b.classList.toggle("hidden", b.dataset.group !== grp); });
  document.querySelectorAll("#admGroups [data-group]").forEach(b => b.classList.toggle("on", b.dataset.group === grp));
  document.querySelectorAll(".adm-for-courses").forEach(el => el.classList.toggle("adm-off", grp !== "courses"));
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;
  $("#liveWrap").classList.toggle("hidden", tab !== "carte");

  if (tab === "carte") {
    view.innerHTML = "";
    updateLiveMap();
  } else if (tab === "agenda") {
    const list = agendaList();
    view.innerHTML = list.length ? myTour() + groupedByDay(list) : empty('Aucune course à venir. Partagez votre page avec le <a href="kit.html">kit pub</a> !');
  } else if (tab === "nouvelles") {
    const list = orders.filter(o => o.status === "nouvelle").sort(byTime);
    view.innerHTML = list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course à accepter 👍");
  } else if (tab === "livreurs") {
    renderCouriers(view);
  } else if (tab === "avis") {
    renderReviews(view);
  } else if (tab === "hebdo") {
    renderWeek(view);
  } else if (tab === "visites") {
    renderVisits(view);
  } else if (tab === "rayons") {
    renderRayons(view);
  } else if (tab === "commerces") {
    // La fiche « annuaire » garde ce qui est en cours de saisie quand l'écran se rafraîchit
    const keep = $("#dirCard");
    renderShops(view);
    if (keep) $("#dirCard").replaceWith(keep); else initDirCard();
  } else if (tab === "wakit") {
    // (les cases restent remplies quand l'écran se rafraîchit tout seul)
    const keep = $("#waKit");
    if (keep) view.replaceChildren(keep); else renderWaKit(view);
  } else if (tab === "clients") {
    renderClients(view);
  } else if (tab === "paniers") {
    renderCarts(view);
  } else if (tab === "jours") {
    renderDaily(view);
  } else if (tab === "messages") {
    renderMessages(view);
  } else if (tab === "demandes") {
    renderRequests(view);
  } else if (tab === "messagerie") {
    renderInbox(view);
  } else if (tab === "historique") {
    const q = histFilter.q.toLowerCase();
    // Période : aujourd'hui, hier, 7 derniers jours, ou une date choisie au calendrier
    const dk = d => UI.dayKey(d.toISOString()), now = new Date();
    const today = dk(now), yesterday = dk(new Date(now - 86400000)), weekFrom = dk(new Date(now - 6 * 86400000));
    const inDay = o => { const k = UI.dayKey(o.pickup_at), d = histFilter.day;
      return !d || (d === "today" ? k === today : d === "yesterday" ? k === yesterday : d === "week" ? k >= weekFrom && k <= today : k === d); };
    const list = orders
      .filter(inDay)
      .filter(o => !histFilter.status || o.status === histFilter.status)
      .filter(o => !q || [o.ref, o.company, o.contact_name, o.contact_phone, o.pickup_address, o.dropoff_address, o.courier_name].join(" ").toLowerCase().includes(q))
      .sort((a, b) => byTime(b, a));
    view.innerHTML = `<div class="toolbar">
        <select id="histStatus"><option value="">Tous les statuts</option>${Object.entries(Store.STATUSES).map(([k, s]) => `<option value="${k}" ${histFilter.status === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
        <input id="histQ" type="search" placeholder="Rechercher (n°, client, téléphone, adresse, livreur)" value="${UI.esc(histFilter.q)}" />
      </div>
      <div class="hist-days">
        ${[["today", "Aujourd'hui"], ["yesterday", "Hier"], ["week", "7 jours"], ["", "Tout"]].map(([k, l]) => `<button type="button" class="ch-chip${histFilter.day === k ? " on" : ""}" data-hday="${k}">${l}</button>`).join("")}
        <label class="ch-chip hist-date${/^\d{4}-/.test(histFilter.day) ? " on" : ""}">📅 <input type="date" id="histDate" max="${today}" value="${/^\d{4}-/.test(histFilter.day) ? histFilter.day : ""}" aria-label="Choisir une date" /></label>
      </div>
      ${histFilter.day && !histFilter.trash ? (() => {
        const done = list.filter(o => o.status === "livree" && !o.is_test);
        const label = histFilter.day === "today" ? "Aujourd'hui" : histFilter.day === "yesterday" ? "Hier" : histFilter.day === "week" ? "7 derniers jours" : UI.fmtDay(histFilter.day + "T12:00:00");
        return `<p class="hist-sum"><b>${UI.esc(label)}</b> · ${plural(list.length, "{n} course", "{n} courses")} · ${plural(done.length, "{n} livrée", "{n} livrées")} · ${UI.money(done.reduce((t, o) => t + Number(o.price || 0), 0))}</p>`;
      })() : ""}
      <div class="hist-clean">
        ${orders.some(o => o.is_test) ? `<button type="button" class="btn btn-sm" data-hclean="test">🗑️ Effacer ${plural(orders.filter(o => o.is_test).length, "la course test", "les {n} courses test")}</button>` : ""}
        ${orders.some(o => !o.is_test && ["annulee", "refusee"].includes(o.status)) ? `<button type="button" class="btn btn-sm" data-hclean="annul">🗑️ Effacer ${plural(orders.filter(o => !o.is_test && ["annulee", "refusee"].includes(o.status)).length, "l'annulée", "les {n} annulées / refusées")}</button>` : ""}
        ${trash.length ? `<button type="button" class="btn btn-sm btn-link" data-hclean="trash">${histFilter.trash ? "← Retour aux courses" : `🗑️ Corbeille (${trash.length})`}</button>` : ""}
      </div>
      ${histFilter.trash
        ? (trash.length ? `<p class="small muted">Courses effacées : elles ne comptent nulle part. « ↩︎ Remettre » les fait revenir.</p><div class="orders">${trash.map(o => card(o, true)).join("")}</div>` : empty("Corbeille vide."))
        : list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course.")}`;
  } else {
    renderBilling(view);
  }
  labelTables($("#view"));
}

// --- Carte en direct : livreurs, points de récupération et de livraison -----------------
const live = { map: null, layer: null, fitted: false };
const SERVICE_PIN = { repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" };

function livePin(emoji, cls) {
  return L.divIcon({ className: "", html: `<div class="map-pin ${cls || ""}">${emoji}</div>`, iconSize: [32, 32], iconAnchor: [16, 28] });
}

const point = (lat, lon) => lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null;
const fresh = c => c.position_at && Date.now() - new Date(c.position_at) < 30 * 60000;
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `le ${UI.fmtDateTime(iso)}`;
};
// En ligne = « En ligne » dans son appli et une position reçue depuis moins de duty_grace_min (comme courier_online en base) :
// c'est là qu'il reçoit les courses
function onlineOf(c) {
  const grace = Number(settings.duty_grace_min || 180) * 60000;
  const posOk = c.position_at && Date.now() - new Date(c.position_at) < grace;
  if (c.online && posOk) return { on: true, cls: "paid", text: `🟢 En ligne · position ${ago(c.position_at)}` };
  if (c.online) return { on: false, cls: "unpaid", text: `🟠 En ligne, mais sans position${c.position_at ? " depuis " + ago(c.position_at).replace(/^il y a /, "") : ""} : ne reçoit pas les courses` };
  if (c.auto_offline_at && (!c.online_at || new Date(c.auto_offline_at) >= new Date(c.online_at)) && Date.now() - new Date(c.auto_offline_at) < 864e5)
    return { on: false, cls: "st-annulee", text: `⏸️ Passé hors ligne tout seul ${ago(c.auto_offline_at)} (courses sans réponse)` };
  return { on: false, cls: "", text: `⚪ Hors ligne${c.position_at ? " · vu " + ago(c.position_at) : ""}` };
}
function onlineSummary() {
  const act = partners().filter(c => c.status === "actif");
  if (!act.length) return "";
  const on = act.filter(c => onlineOf(c).on), off = act.filter(c => !onlineOf(c).on);
  return `<div class="card" style="margin-bottom:14px">
    <b>🟢 En ligne maintenant : ${on.length} / ${act.length}</b>
    <p class="small" style="margin:6px 0 0">${on.length ? on.map(c => `🟢 ${UI.esc(c.name)}`).join(" · ") : "Aucun livreur en ligne : les courses sonnent chez vous seulement."}</p>
    ${off.length ? `<p class="small muted" style="margin:4px 0 0">${off.map(c => `${onlineOf(c).text.slice(0, 2)} ${UI.esc(c.name)}`).join(" · ")}</p>` : ""}
  </div>`;
}

// Où en est la course : étape, prochaine destination et temps estimé
function progressOf(o) {
  const c = couriers.find(x => x.id === o.courier_id);
  const pos = c && fresh(c) ? point(c.lat, c.lon) : null;
  const target = o.status === "confirmee" ? point(o.pickup_lat, o.pickup_lon) : point(o.dropoff_lat, o.dropoff_lon);
  const eta = pos && target ? Pricing.etaMinutes(pos, target) : null;
  const step = { nouvelle: 0, confirmee: 1, recuperee: 2, livree: 3 }[o.status] || 0;
  const text = o.status === "nouvelle" ? "🆕 En attente d'un livreur"
    : o.status === "confirmee" ? `🛵 En route vers la récupération${eta ? ` · ≈ ${eta} min` : ""}`
    : `📦 Colis récupéré, en route vers la livraison${eta ? ` · ≈ ${eta} min` : ""}`;
  return { c, pos, target, eta, step, text };
}

// Retard : sans livreur depuis plus de 5 min (ou à 20 min d'un horaire programmé), départ passé de 10 min sans
// récupération, heure annoncée au client dépassée de 5 min
function lateOf(o) {
  const m = iso => (iso ? Math.round((Date.now() - new Date(iso)) / 60000) : -1e9);
  const nb = UI.notBefore(o);
  if (nb && nb > Date.now()) return null;
  if (o.status === "nouvelle") {
    if (o.urgency === "programmee") return m(o.pickup_at) > -20 ? { min: Math.max(0, m(o.pickup_at) + 20), why: "sans livreur, départ programmé proche" } : null;
    return m(o.created_at) > 5 ? { min: m(o.created_at), why: "sans livreur" } : null;
  }
  if (o.status === "confirmee" && m(o.pickup_at) > 10) return { min: m(o.pickup_at), why: "pas encore récupérée" };
  if (o.status === "recuperee" && o.eta_at && m(o.eta_at) > 5) return { min: m(o.eta_at), why: "heure annoncée au client dépassée" };
  return null;
}
const riderIcon = (c, n, on) => L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0],
  html: `<div class="live-rider ${on ? "on" : "off"}"><i>🛵</i><b>${UI.esc(String(c.name || "").split(" ")[0])}</b>${n ? `<em>${n}</em>` : ""}</div>` });
function updateLiveMap() {
  if (!window.L) { $("#liveMap").innerHTML = '<p class="empty">Carte indisponible (connexion).</p>'; return; }
  if (!live.map) {
    const home = Pricing.cityById(CONFIG, CONFIG.homeCity);
    live.map = L.map("liveMap").setView([home.lat, home.lon], 12);
    UI.mapTiles(live.map, false);
    live.layer = L.layerGroup().addTo(live.map);
  }
  live.map.invalidateSize();
  live.layer.clearLayers();
  const pts = [];
  const add = (p, emoji, html, cls) => { if (!p) return; pts.push([p.lat, p.lon]); L.marker([p.lat, p.lon], { icon: livePin(emoji, cls) }).bindPopup(html).addTo(live.layer); };

  const list = orders.filter(o => ["nouvelle", "confirmee", "recuperee"].includes(o.status))
    .map(o => Object.assign({ late: lateOf(o) }, o)).sort((x, y) => (!!y.late - !!x.late) || byTime(x, y));
  list.forEach(o => {
    const pr = progressOf(o), late = o.late;
    const pick = point(o.pickup_lat, o.pickup_lon), drop = point(o.dropoff_lat, o.dropoff_lon);
    const label = `<b>N° ${UI.esc(o.ref)}</b> · ${UI.money(o.price)}<br>${UI.esc(pr.text)}${late ? `<br><b style="color:#D92D20">⚠️ En retard de ${late.min} min · ${UI.esc(late.why)}</b>` : ""}`;
    const cls = late ? "pin-late" : o.status === "nouvelle" ? "pin-wait" : "";
    if (o.status !== "recuperee") add(pick, o.status === "nouvelle" ? "🆕" : SERVICE_PIN[o.service] || "📍", `${label}<br>📍 ${UI.esc(UI.placeQuery(o, "pickup"))}`, cls);
    add(drop, "🏁", `${label}<br>🏁 ${UI.esc(UI.placeQuery(o, "dropoff"))}`, late ? "pin-late" : "");
    if (pick && drop) UI.routeLayer([pick.lat, pick.lon], [drop.lat, drop.lon], { color: late ? "#D92D20" : "#98A2B3", weight: 3, opacity: .6, glowOpacity: .3 }).addTo(live.layer);
    if (pr.pos && pr.target) UI.routeLayer([pr.pos.lat, pr.pos.lon], [pr.target.lat, pr.target.lon], { color: late ? "#D92D20" : "#FF6A13", weight: 5 }).addTo(live.layer);
  });
  // Tous les livreurs qui ont une position : en ligne (couleur, position fraîche) ou hors ligne (gris, dernière position)
  const riders = partners().filter(c => c.status === "actif" && c.lat != null).map(c => ({ c, on: onlineOf(c).on, n: list.filter(o => o.courier_id === c.id).length }));
  riders.forEach(({ c, on, n }) => {
    const p = point(c.lat, c.lon);
    if (!p) return;
    if (on) pts.push([p.lat, p.lon]);
    L.marker([p.lat, p.lon], { icon: riderIcon(c, n, on), zIndexOffset: on ? 900 : 100 })
      .bindPopup(`<b>${UI.esc(c.name)}</b>${c.role === "admin" ? " (vous)" : ""}<br>${UI.esc(onlineOf(c).text)}<br>${n} course(s) en cours${c.phone ? `<br><a href="tel:${UI.esc(String(c.phone).replace(/[^\d+]/g, ""))}">📞 ${UI.esc(c.phone)}</a>` : ""}`).addTo(live.layer);
  });
  if (!live.fitted && pts.length) { live.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); live.fitted = true; }
  live.points = pts;

  const act = partners().filter(c => c.status === "actif"), onDuty = act.filter(c => onlineOf(c).on), lateN = list.filter(o => o.late).length;
  $("#liveList").innerHTML = `<div class="live-sum"><b>${list.length} course(s) en cours</b>${lateN ? ` · <b class="late">⚠️ ${lateN} en retard</b>` : ""} · 🟢 ${onDuty.length} / ${act.length} en ligne</div>
    <div class="live-riders">${act.sort((x, y) => (onlineOf(y).on - onlineOf(x).on) || String(x.name).localeCompare(String(y.name))).map(c => { const st = onlineOf(c), n = list.filter(o => o.courier_id === c.id).length;
      return `<div class="live-r${st.on ? " on" : ""}" data-focus-c="${UI.esc(c.id)}"><span>${st.on ? "🟢" : st.text.slice(0, 2)}</span><b>${UI.esc(c.name)}${c.role === "admin" ? " (vous)" : ""}</b><small>${n ? `${n} course${n > 1 ? "s" : ""} · ` : ""}${st.on ? "position " + UI.esc(ago(c.position_at)) : UI.esc(st.text.replace(/^..\s*/, "").toLowerCase())}</small>${c.phone && c.role !== "admin" ? `<a href="tel:${UI.esc(String(c.phone).replace(/[^\d+]/g, ""))}" aria-label="Appeler">📞</a>` : ""}</div>`; }).join("")}</div>`
    + (list.length ? list.map(o => {
      const pr = progressOf(o), late = o.late;
      return `<div class="order live-item${late ? " late" : ""}" data-focus="${UI.esc(o.id)}">
        <div class="order-head"><span class="order-time">${UI.esc(UI.cityFr(o.from_city))} → ${UI.esc(UI.cityFr(o.to_city))}</span><span class="order-price">${UI.money(o.price)}</span></div>
        <div class="small">N° ${UI.esc(o.ref)} · ${pr.c ? "🛵 " + UI.esc(pr.c.name) : "sans livreur"}${pr.c && !pr.pos ? " · position inconnue" : ""}</div>
        <div class="small"><b>${UI.esc(pr.text)}</b></div>
        ${late ? `<div class="small late-line">⚠️ En retard de <b>${late.min} min</b> · ${UI.esc(late.why)}</div>` : ""}
        <div class="progress">${[0, 1, 2, 3].map(i => `<i class="${i <= pr.step ? "on" : ""}"></i>`).join("")}</div>
      </div>`;
    }).join("") : `<div class="empty card">Aucune course en cours.</div>`);
}
function focusCourier(id) {
  const c = couriers.find(x => x.id === id), p = c && point(c.lat, c.lon);
  if (p && live.map) live.map.setView([p.lat, p.lon], 15);
}

function focusOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o || !live.map) return;
  const pr = progressOf(o);
  const pts = [pr.pos, point(o.pickup_lat, o.pickup_lon), point(o.dropoff_lat, o.dropoff_lon)].filter(Boolean).map(p => [p.lat, p.lon]);
  if (pts.length) live.map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
}

// --- Livreurs partenaires ----------------------------------------------------------
function expiryPill(label, date) {
  if (!date) return `<span class="pill unpaid">${label} : date manquante</span>`;
  const expired = date < today();
  return `<span class="pill ${expired ? "st-annulee" : "paid"}">${label} ${expired ? "EXPIRÉ" : "valable"} jusqu'au ${UI.esc(new Date(date).toLocaleDateString("fr-FR"))}</span>`;
}

// Comptes créés sans fiche de livreur : l'inscription a commencé mais n'est pas finie
// Inscriptions pas terminées que le patron a effacées de sa liste (mail faux, plus de nouvelles) : gardées sur ce téléphone
const HIDDEN_SIGNUPS = "livraison.hiddenSignups.v1";
const hiddenSignups = () => { try { return JSON.parse(localStorage.getItem(HIDDEN_SIGNUPS) || "[]"); } catch (e) { return []; } };
function unfinished() { const h = hiddenSignups(); return accounts.filter(a => !a.has_fiche && !h.includes(a.id)); }
const fmtShort = iso => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", " à ");

// Où en est l'inscription : inscrit, validé, notifications (sans elles, pas de course appli fermée)
function signupLine(c) {
  const a = accounts.find(x => x.id === c.id);
  const parts = [`Inscrit le ${UI.esc(fmtShort(c.created_at))}`];
  if (c.status === "actif") parts.push(c.validated_at ? `validé le ${UI.esc(fmtShort(c.validated_at))}` : "validé");
  if (a && a.last_sign_in_at) parts.push(`dernière connexion le ${UI.esc(fmtShort(a.last_sign_in_at))}`);
  return `<div><span>📅</span><span>${parts.join(" · ")}</span></div>`;
}
function pushPill(c) {
  const a = accounts.find(x => x.id === c.id);
  if (!a) return "";
  return a.push_n ? `<span class="pill paid">🔔 Reçoit les courses appli fermée</span>`
    : `<span class="pill st-annulee" title="Il doit ouvrir l'appli HOP! Livreur et toucher « 🔔 Activer les alertes »">🔕 Notifications pas activées</span>`;
}
// Inscription pas terminée : une fiche à part pour chacun (nom, téléphone, email), pour le rappeler.
// « Confirmer son email » : quand le mail de confirmation n'arrive pas, le patron le débloque ; le livreur se
// connecte alors dans HOP! Livreur (« J'ai déjà un compte ») et sa fiche se termine
function unfinishedCard() {
  const list = unfinished();
  if (!list.length) return "";
  const url = UI.appUrl("livreur/");
  const mail = a => `mailto:${a.email || ""}?subject=${encodeURIComponent(`${CONFIG.businessName} : votre inscription livreur`)}&body=${encodeURIComponent(`Bonjour${a.name ? " " + a.name : ""},\n\nVous avez commencé votre inscription de livreur chez ${CONFIG.businessName}, mais elle n'est pas terminée. Envoyez-nous votre numéro de téléphone en réponse à ce mail, ou finissez l'inscription ici : ${url}\n\nשלום, התחלת את ההרשמה כשליח ב-${CONFIG.businessNameHe || CONFIG.businessName} אבל היא לא הסתיימה. שלח לנו את מספר הטלפון שלך בתשובה למייל הזה, או סיים את ההרשמה כאן: ${url}\n\nL'équipe ${CONFIG.businessName}`)}`;
  const sms = a => `sms:${String(a.phone).replace(/[^\d+]/g, "")}?body=${encodeURIComponent(`Bonjour${a.name ? " " + a.name : ""}, ici ${CONFIG.businessName}. Ton inscription de livreur n'est pas finie : ouvre HOP! Livreur (${url}), touche « J'ai déjà un compte », mets ton email et ton mot de passe, puis termine ta fiche. Merci !`)}`;
  return `<p class="small muted" style="margin:0 0 8px"><b>⏳ Inscriptions pas terminées (${list.length})</b> : le compte est créé, mais la fiche (véhicule, documents) n'est pas arrivée.</p>
    <div class="orders" style="margin-bottom:14px">${list.map(a => `<article class="order is-new unfinished" data-account="${UI.esc(a.id)}">
      <div class="order-head">
        <span class="order-time">${UI.esc(a.name || a.email || "Sans nom")}</span>
        <span class="pill unpaid">⏳ Inscription pas terminée</span>
      </div>
      <div class="kv">
        ${a.phone ? `<div><span>📞</span><span><a href="tel:${UI.esc(a.phone)}"><b>${UI.esc(a.phone)}</b></a></span></div>` : `<div><span>📞</span><span class="muted">Pas de téléphone (inscription faite avant le 25/10 vers 13 h)</span></div>`}
        <div><span>✉️</span><span><a dir="ltr" href="${UI.esc(mail(a))}">${UI.esc(a.email || "—")}</a></span></div>
        <div><span>📅</span><span>Commencée le ${UI.esc(fmtShort(a.created_at))}${a.last_sign_in_at ? ` · connecté le ${UI.esc(fmtShort(a.last_sign_in_at))}` : ""}</span></div>
      </div>
      <div class="meta"><span class="pill ${a.confirmed ? "paid" : "st-annulee"}">${a.confirmed ? "✅ Email confirmé : il doit se connecter et finir sa fiche" : "📧 Email pas encore confirmé : il ne peut pas se connecter"}</span></div>
      <div class="actions">
        ${a.phone ? `<a class="btn btn-sm btn-primary" href="tel:${UI.esc(a.phone)}">📞 Appeler</a><a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(a.phone, `Bonjour${a.name ? " " + a.name : ""}, ici ${CONFIG.businessName}. Ton inscription de livreur n'est pas finie : ouvre HOP! Livreur (${url}), touche « J'ai déjà un compte », mets ton email et ton mot de passe, puis termine ta fiche.`))}">🟢 WhatsApp</a><a class="btn btn-sm" href="${UI.esc(sms(a))}">💬 SMS</a>` : ""}
        ${a.confirmed ? "" : `<button type="button" class="btn btn-sm" data-confirm-mail="${UI.esc(a.id)}" title="Si le mail de confirmation n'arrive pas">✅ Confirmer son email</button>`}
        <a class="btn btn-sm" href="${UI.esc(mail(a))}">✉️ Lui écrire</a>
        <button type="button" class="btn btn-sm btn-link danger" data-hide-signup="${UI.esc(a.id)}">🗑️ Effacer de la liste</button>
      </div>
    </article>`).join("")}</div>`;
}

function renderCouriers(view) {
  const rank = c => ["en_attente", "actif", "suspendu"].indexOf(c.status) * 2 + (onlineOf(c).on ? 0 : 1);
  const list = partners().sort((a, b) => rank(a) - rank(b));
  const invite = UI.appUrl("livreur/");
  const statusLabel = { en_attente: "🆕 Inscrit · à valider", actif: "✅ Actif", suspendu: "⛔ Suspendu" };
  view.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <b>Recruter des livreurs</b>
      <p class="muted small" style="margin:4px 0 8px">Envoyez ce lien : ils s'inscrivent, acceptent les conditions (permis, assurance déclarée, HOP pas responsable…), puis vous les validez ici après avoir vu leurs documents. Le client les paie directement ; HOP prend ${UI.commissionText()} par course livrée, retirés tout de suite de leur crédit HOP (rechargé à l'avance) : rien à régler ensuite.</p>
      <div class="promo-row"><input readonly value="${UI.esc(invite)}" dir="ltr" /><a class="btn btn-sm btn-wa" href="${UI.waPersonal("", `Tu as un scooter, une voiture ou un vélo ? Deviens livreur partenaire chez ${CONFIG.businessName} : tu choisis tes courses, tu encaisses directement le client, et seulement ${UI.commissionText()} de commission par course. Inscription : ${invite}`)}">Partager</a></div>
    </div>
    ${onlineSummary()}
    ${unfinishedCard()}
    ${list.length ? `<div class="orders">${list.map(c => {
      const done = orders.filter(o => o.courier_id === c.id && o.status === "livree" && !o.is_test).length;
      const rating = UI.ratingOf(orders.filter(o => o.courier_id === c.id));
      const refus = declineStats(c);
      return `<article class="order${c.status === "en_attente" ? " is-new" : ""}" data-courier="${UI.esc(c.id)}">
        <div class="order-head">
          <span class="order-time">${UI.esc(c.name)}</span>
          <span class="pill">${statusLabel[c.status] || c.status}</span>
          <span class="order-ref">${done} course(s) livrée(s)${rating ? ` · ⭐ ${rating.avg.toFixed(1).replace(".", ",")} (${rating.n} avis)` : ""}</span>
        </div>
        ${c.status === "actif" ? (o => `<div class="online-line"><span class="pill ${o.cls}">${UI.esc(o.text)}</span></div>`)(onlineOf(c)) : ""}
        ${refus}
        <div class="kv">
          <div><span>📞</span><span>${tel("", c.phone)}${c.bit_phone ? ` · Bit ${UI.esc(c.bit_phone)}` : ""}${c.has_bit == null ? "" : ` · ${c.has_bit ? "✅ Bit" : "⚠️ pas de Bit"} ${c.has_paybox ? "✅ PayBox" : "· pas de PayBox"}`}${c.city ? " · " + UI.esc(UI.cityFr(c.city)) : ""}</span></div>
          <div><span>🛵</span><span>${UI.esc(c.vehicle || "—")} · permis n° ${UI.esc(c.license_number || "—")} · assurance ${c.insurance ? UI.esc(c.insurance) : "déclarée"}${c.business_number ? ` · n° d'entreprise ${UI.esc(c.business_number)}` : ""}</span></div>
          ${signupLine(c)}
          <div><span>📝</span><span>Conditions acceptées le ${c.accepted_terms_at ? UI.esc(new Date(c.accepted_terms_at).toLocaleDateString("fr-FR")) : "—"}</span></div>
        </div>
        <div class="meta">${c.topcase_at ? `<button type="button" class="pill pill-btn paid" data-topcase="1">📷 Voir le top case</button>` : `<span class="pill st-annulee">📷 Pas de photo du top case</span>`}${c.docs_n ? `<button type="button" class="pill pill-btn paid" data-docs="1">📄 Documents (${Number(c.docs_n)})</button>` : `<span class="pill unpaid">📄 Pas encore de documents</span>`}${expiryPill("Permis", c.license_expiry)}${c.insurance_expiry ? expiryPill("Assurance", c.insurance_expiry) : ""}${pushPill(c)}
          ${(() => { const b = balanceOf(c.id); return b > Number(settings.max_debt) ? `<span class="pill st-annulee">🔒 Bloqué : doit ${UI.money(b)}</span>` : b > 0 ? `<span class="pill unpaid">Doit ${UI.money(b)}</span>` : b < 0 ? `<span class="pill paid">Vous lui devez ${UI.money(-b)}</span>` : ""; })()}</div>
        <div class="actions">
          ${c.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-cact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-cact="suspendu">⛔ Suspendre</button>`}
          ${c.unlocked_until && new Date(c.unlocked_until) > new Date()
            ? `<button class="btn btn-sm" data-unlock="off">🔒 Rebloquer (débloqué jusqu'au ${UI.esc(UI.fmtDateTime(c.unlocked_until))})</button>`
            : `<button class="btn btn-sm" data-unlock="on" title="Solde, course en cours, GPS et photo : plus aucun blocage pendant 24 h">🔓 Débloquer 24 h</button>`}
          <button class="btn btn-sm${c.network_perks ? " btn-primary" : ""}" data-perks="${c.network_perks ? "off" : "on"}" title="Commission ${UI.esc(UI.networkText())} sur les courses de ses commerces, ${UI.esc(UI.money(settings.referral_bonus))} quand un autre livreur les fait${CONFIG.pro.referrerPercent ? `, ${CONFIG.pro.referrerPercent} % des abonnements Pro` : ""}">${c.network_perks ? "⭐ Avantages réseau : activés" : "☆ Avantages réseau : désactivés"}</button>
          ${chatBtn("c:" + c.id, `Livreur : ${c.name}`, c.phone, "💬 Message", c.status === "en_attente"
            ? `Bonjour ${c.name}, merci pour ton inscription chez ${CONFIG.businessName} ! Pour valider ton compte, envoie-moi ici en photo : permis de conduire, carte grise et carte d'identité.`
            : `Bonjour ${c.name}, `)}
          ${c.status !== "suspendu" && (accounts.find(x => x.id === c.id) || {}).push_n === 0 ? chatBtn("c:" + c.id, `Livreur : ${c.name}`, c.phone, "🔔 Lui demander d'activer les alertes",
            `Bonjour ${c.name}, ouvre l'appli HOP! Livreur et touche « 🔔 Activer les alertes » puis « Autoriser » : sinon tu ne reçois pas les courses quand l'appli est fermée.`) : ""}
          ${c.phone ? `<a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(c.phone, `Bonjour ${c.name}, `))}" title="Votre WhatsApp à vous (pas WhatsApp Business)">🟢 WhatsApp</a>` : ""}
          <textarea class="admin-note" data-cact="note" rows="1" placeholder="Note interne (documents vérifiés, remarques…)">${UI.esc(c.admin_note || "")}</textarea>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun livreur inscrit pour l'instant.</div>`}`;
}

// --- Paiements de la semaine ----------------------------------------------------------
// Crédit prépayé : les livreurs rechargent par Bit, vous validez ; la commission de HOP en est déduite à chaque course
const TOPUP_ST = { attente: "⏳ à valider", ok: "✅ validée", refuse: "❌ refusée" };
function creditsCard() {
  const pending = (credits.topups || []).filter(x => x.status === "attente");
  const byId = Object.fromEntries((credits.credits || []).map(x => [x.courier_id, x]));
  const list = partners().filter(c => c.status === "actif" || byId[c.id]);
  return `<div class="card credits-card" style="margin-bottom:14px"><h3>💳 Crédits des livreurs</h3>
    <p class="muted small" style="margin:4px 0 8px">Les clients paient les livreurs directement (Bit ou PayBox). Les livreurs rechargent leur crédit HOP par Bit au ${UI.esc(CONFIG.bitPhone)} ; la commission (${UI.esc(UI.commissionText())}) et les retenues en sont déduites, les bonus et codes promo y sont ajoutés. Sans crédit suffisant, un livreur ne peut plus accepter de course.</p>
    ${pending.length ? `<b>Recharges à vérifier sur votre Bit</b>${pending.map(x => `<div class="topup-row"><span><b>${UI.esc(x.courier_name || "")}</b> · ${UI.money(x.amount)} · ${UI.esc(new Date(x.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span>
      <span><button class="btn btn-sm btn-primary" data-topup-ok="${UI.esc(x.id)}">✅ Reçue</button> <button class="btn btn-sm" data-topup-no="${UI.esc(x.id)}">❌ Pas reçue</button></span></div>`).join("")}` : `<p class="small muted">Aucune recharge à vérifier.</p>`}
    <div class="table-scroll" style="margin-top:8px"><table class="bill"><thead><tr><th>Livreur</th><th class="num">Crédit</th><th class="num">Réservé</th><th></th></tr></thead><tbody>
      ${list.map(c => { const x = byId[c.id] || { credit: 0, reserved: 0 }; return `<tr><td>${UI.esc(c.name)}</td><td class="num"><b class="${Number(x.credit) < Number(settings.commission_min || 3) ? "neg" : ""}">${UI.money(x.credit)}</b></td>
        <td class="num">${Number(x.reserved) ? UI.money(x.reserved) : "—"}</td><td class="num"><span class="credit-btns"><button class="btn btn-sm" data-credit-add="${UI.esc(c.id)}" data-name="${UI.esc(c.name)}">➕</button> <button class="btn btn-sm" data-credit-remove="${UI.esc(c.id)}" data-name="${UI.esc(c.name)}" data-credit="${Number(x.credit) || 0}">➖</button></span></td></tr>`; }).join("") || `<tr><td colspan="4" class="muted">Pas encore de livreur.</td></tr>`}
    </tbody></table></div>
    <p class="small" style="margin:8px 0 0">🎁 Crédit de départ offert à chaque nouveau livreur validé : <b>${UI.money(settings.welcome_credit ?? 25)}</b> <button class="btn btn-sm" data-welcome-credit>Modifier</button></p>
    ${(credits.topups || []).filter(x => x.status !== "attente").slice(0, 8).map(x => `<p class="small muted topup-line">${UI.esc(x.courier_name || "")} · ${UI.money(x.amount)} · ${TOPUP_ST[x.status] || ""}${x.status === "ok" && x.paid === false ? " · offert" : ""}${x.note ? " · " + UI.esc(x.note) : ""}${x.receipt_number ? ` · <a href="${UI.esc(UI.topupReceiptUrl(x))}" target="_blank" rel="noopener">🧾 Reçu n° ${x.receipt_number}</a>` : ""}</p>`).join("")}
  </div>`;
}
function renderWeek(view) {
  const start = addDays(weekStart(today()), 7 * weekOffset);
  const end = addDays(start, 6);
  const inWeek = o => { const k = UI.dayKey(o.pickup_at); return o.status === "livree" && !o.is_test && k >= start && k <= end; };
  const rows = partners().map(c => {
    const list = orders.filter(o => o.courier_id === c.id && inWeek(o));
    const due = list.filter(o => o.commission_status !== "regle");
    // Bonus de parrainage : courses livrées au départ de ses commerces (déduits de sa commission)
    // (une course de son commerce qu'il livre lui-même : commission réseau, pas de bonus)
    const bonusList = orders.filter(o => o.referrer_id === c.id && o.courier_id !== c.id && Number(o.referral_bonus) > 0 && inWeek(o));
    const bonusDue = sum(bonusList.filter(o => o.referral_status !== "regle"), o => Number(o.referral_bonus || 0));
    const dueAmount = sum(due, o => Number(o.commission || 0));
    // Courses payées à HOP (programmées, carnets) : l'argent est chez vous, vous le reversez au livreur
    const hopPaid = list.filter(o => o.paid_to === "hop" && o.payment_status === "paye");
    const hopDue = sum(due.filter(o => o.paid_to === "hop" && o.payment_status === "paye"));
    // Payé par HOP au livreur : part des commerces Pro et codes promo, pourboires reçus, part des abonnements Pro
    const addsDue = sum(due, o => (o.direct_pay ? -(Number(o.shop_share || 0) > 0 ? 0 : Number(o.hop_share || 0)) : Number(o.shop_share || 0) - Number(o.hop_share || 0)) + Number(o.discount || 0));
    const tips = orders.filter(o => o.courier_id === c.id && o.tip_status === "recu" && !o.direct_pay);
    const plans = planSales.filter(p => p.referrer_id === c.id && p.referrer_status !== "regle" && Number(p.referrer_share) > 0);
    const extra = addsDue + sum(tips, o => Number(o.tip || 0)) + sum(plans, p => Number(p.referrer_share));
    // Retenues (courses pas faites, pas reçues) : déduites de ce que HOP lui verse
    const pens = penalties.filter(p => p.courier_id === c.id && (p.status === "du" ? UI.dayKey(p.created_at) <= end && weekOffset === 0 : p.status === "regle" && UI.dayKey(p.settled_at || p.created_at) >= start && UI.dayKey(p.settled_at || p.created_at) <= end));
    const penDue = sum(pens.filter(p => p.status === "du"), p => Number(p.amount));
    return { c, list, due, bonusList, bonusDue, hopPaid, hopDue, tips, plans, extra, pens, penDue, collected: sum(list.filter(o => o.paid_to !== "hop")), commission: sum(list, o => Number(o.commission || 0)), dueAmount, balance: dueAmount - bonusDue - hopDue - extra + penDue };
  }).filter(r => r.list.length || r.bonusList.length || r.tips.length || r.plans.length || r.pens.length);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  view.innerHTML = creditsCard() + `<div class="toolbar">
      <button class="btn btn-sm" data-week="-1">◀</button>
      <b>Semaine du ${fmtKey(start)} au ${fmtKey(end)}</b>
      <button class="btn btn-sm" data-week="1" ${weekOffset >= 0 ? "disabled" : ""}>▶</button>

    </div>
    <div class="week-sum"><small>Solde total de la semaine</small><b>${UI.money(Math.abs(total))}</b><span>${total > 0 ? "à recevoir des livreurs" : total < 0 ? "à verser aux livreurs" : "rien à régler"}</span></div>
    <details class="fin-more" data-fold="finmore"${foldOpen("finmore")} style="margin:10px 0"><summary>ℹ️ Comment c'est calculé</summary><p class="small muted" style="margin-top:8px">Nouvelles courses : les clients paient les livreurs directement, et tout passe par leur crédit HOP (carte ci-dessus) ; « ✓ Réglé » ne sert que pour un échange d'argent en dehors du crédit. Anciennes courses : les livreurs encaissaient les clients et vous versaient leur commission chaque semaine : ${UI.commissionText()}, ou ${UI.networkText()} sur les courses des commerces qu'ils ont amenés. Vous leur reversez : les courses payées à HOP (Bit, programmées, carnets), la part des commerces Pro, les codes promo, les pourboires reçus, leurs bonus réseau${CONFIG.pro.referrerPercent ? ` et ${CONFIG.pro.referrerPercent} % des abonnements Pro qu'ils ont fait signer` : " (pas de part sur les abonnements Pro pour l'instant)"}. Au-delà de ${UI.money(settings.max_debt)} dus, un livreur ne peut plus accepter de course. Attente ou achats au départ : ${UI.esc(UI.waitRule(settings))}, ajoutés au prix et versés en entier au livreur.</p></details>
    <div class="table-scroll"><table class="bill">
      <thead><tr><th>Livreur</th><th class="num">Courses</th><th class="num">Encaissé par lui</th><th class="num">💳 Payé à HOP</th><th class="num">Commission</th><th class="num">🤝 Bonus</th><th class="num">🎁 Pro, promos, 💝, ⭐</th><th class="num">💸 Retenues</th><th class="num">Solde</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr data-courier="${UI.esc(r.c.id)}"><td><b>${UI.esc(r.c.name)}</b><br><span class="small muted">${UI.esc(r.c.phone)}</span></td>
        <td class="num">${r.list.length}</td><td class="num">${UI.money(r.collected)}</td><td class="num">${r.hopPaid.length ? "−" + UI.money(sum(r.hopPaid)) : "—"}</td><td class="num">${UI.money(r.commission)}</td>
        <td class="num">${r.bonusList.length ? `−${UI.money(sum(r.bonusList, o => Number(o.referral_bonus || 0)))}<br><span class="small muted">${r.bonusList.length} livraison(s)</span>` : "—"}</td>
        <td class="num">${r.extra ? "−" + UI.money(r.extra) : "—"}</td>
        <td class="num">${r.pens.length ? `+${UI.money(sum(r.pens, p => Number(p.amount)))}<br><span class="small muted">${r.pens.map(p => UI.esc(p.order_ref ? "n° " + p.order_ref : "") + (p.status === "regle" ? " ✓" : "")).join(", ")}</span>` : "—"}</td>
        <td class="num"><b>${r.dueAmount || r.bonusDue || r.hopDue || r.extra || r.penDue ? (r.balance >= 0 ? UI.money(r.balance) + " à recevoir" : UI.money(-r.balance) + " à lui verser") : "✓ réglé"}</b></td>
        <td class="num" style="white-space:nowrap">
          ${chatBtn("c:" + r.c.id, `Livreur : ${r.c.name}`, "Récapitulatif de la semaine", "Envoyer", `Bonjour ${r.c.name}, récapitulatif de la semaine du ${fmtKey(start)} au ${fmtKey(end)} : ${r.list.length} course(s) livrée(s), ${UI.money(r.collected)} encaissés, commission ${UI.money(r.dueAmount)}${r.hopDue ? `, courses payées à HOP ${UI.money(r.hopDue)} déduites` : ""}${r.bonusDue ? `, bonus parrainage ${UI.money(r.bonusDue)} déduit` : ""}${r.penDue ? `, retenues (courses pas faites ou pas reçues) ${UI.money(r.penDue)}` : ""}. ${r.balance >= 0 ? `À me verser : ${UI.money(r.balance)} (Bit au ${CONFIG.bitPhone})` : `Je te verse ${UI.money(-r.balance)} sur ton Bit`}. Merci et bravo !`)}
          ${r.dueAmount || r.bonusDue || r.hopDue || r.extra || r.penDue ? `<button class="btn btn-sm" data-settle="${UI.esc(r.c.id)}">✓ Réglé</button>` : ""}
        </td></tr>`).join("") || `<tr><td colspan="10" class="muted">Aucune course livrée par un livreur partenaire cette semaine.</td></tr>`}</tbody>
      <tfoot><tr><th>Solde total</th><th></th><th></th><th></th><th></th><th></th><th></th><th></th><th class="num">${UI.money(total)}</th><th></th></tr></tfoot>
    </table></div>`;
  view.dataset.weekStart = start;
}

// --- Commerces partenaires --------------------------------------------------------------
const SHOP_KIND = { restaurant: "🍔 Restaurant", pressing: "👔 Pressing", boutique: "🛍️ Boutique", pharmacie: "💊 Pharmacie / beauté", bureau: "💼 Bureau / services", autre: "🏪 Autre" };

// Message au commerce avec ses deux liens, dans sa langue
function shopWelcome(x) {
  const order = UI.appUrl() + "?c=" + x.code, space = UI.appUrl("commerce.html") + "?k=" + x.token;
  return x.lang === "fr"
    ? `Bonjour ${x.contact_name || ""}, bienvenue chez ${CONFIG.businessName} ! 🛵\nPour commander une course depuis ${x.name} : ${order}\nVotre espace (vos courses, votre QR code pour vos clients) : ${space}\nÀ très vite !`
    : `שלום ${x.contact_name || ""}, ברוכים הבאים ל${CONFIG.businessNameHe}! 🛵\nלהזמנת שליח מ${x.name}: ${order}\nהאזור שלכם (המשלוחים, קוד QR ללקוחות): ${space}\nנתראה בקרוב!`;
}

// Accès du commerce par WhatsApp : le message est prêt, le patron n'a qu'à appuyer sur « Envoyer »
// (seulement aux commerces ; rien n'est envoyé aux livreurs). On retient sur ce téléphone à qui c'est parti.
const ACCESS_SENT = "livraison.shopAccessSent.v1";
const accessSent = () => { try { return JSON.parse(localStorage.getItem(ACCESS_SENT)) || {}; } catch (e) { return {}; } };
function markAccessSent(id) { try { localStorage.setItem(ACCESS_SENT, JSON.stringify(Object.assign(accessSent(), { [id]: new Date().toISOString() }))); } catch (e) { /* ignore */ } }
function shopAccessText(x) {
  const order = UI.appUrl() + "?c=" + x.code, space = UI.appUrl("commerce.html") + "?k=" + x.token;
  const hi = String(x.contact_name || "").trim(), name = UI.bi(x.name, x.lang === "fr" ? "fr" : "he");
  return x.lang === "fr"
    ? `Bonjour${hi ? " " + hi : ""}, bienvenue chez ${CONFIG.businessName} ! 🛵\n\nVoici les accès de ${name} :\n\n🔑 Votre espace commerce (commandes, catalogue et prix, photos, horaires, paiement) :\n${space}\nCe lien est personnel : gardez-le et ne le partagez pas. Astuce : ouvrez-le puis « Ajouter à l'écran d'accueil ».\n\n🏷️ Votre code commerce : ${x.code}\n\n🛒 Le lien à donner à vos clients pour commander chez vous :\n${order}\n\nUne question ? Répondez simplement à ce message.`
    : `שלום${hi ? " " + hi : ""}, ברוכים הבאים ל${CONFIG.businessNameHe}! 🛵\n\nהנה פרטי הגישה של ${name}:\n\n🔑 האזור של העסק (הזמנות, קטלוג ומחירים, תמונות, שעות, תשלום):\n${space}\nהקישור אישי: שמרו אותו ואל תעבירו אותו. טיפ: פתחו אותו ואז „הוספה למסך הבית”.\n\n🏷️ קוד העסק: ${x.code}\n\n🛒 הקישור ללקוחות שלכם, להזמנה מכם:\n${order}\n\nשאלה? פשוט ענו להודעה הזו.`;
}
function accessBtn(x) {
  const to = x.whatsapp || x.phone;
  if (!to) return "";
  const sent = accessSent()[x.id];
  return `<a class="btn btn-sm${sent ? "" : " btn-wa"}" data-access-wa="${UI.esc(x.id)}" href="${UI.esc(UI.waPersonal(to, shopAccessText(x)))}" title="Message prêt dans WhatsApp : il suffit d'appuyer sur Envoyer">🟢 ${sent ? "Renvoyer ses accès" : "Envoyer ses accès"} sur WhatsApp</a>`;
}

// Annuaire : enseignes ajoutées par le patron ou apprises des clients (absentes de la carte)
let dirPick = null;
// Catégories : les mêmes que les rubriques « Enseignes près de vous » de l'accueil client
const DIR_KINDS = [["food", "🍽️ Restaurant"], ["breakfast", "🥐 Boulangerie / pâtisserie"], ["super", "🛒 Supermarché / makolet / épicerie"],
  ["pharm", "💊 Pharmacie / beauté"], ["pressing", "👔 Pressing / laverie"], ["flower", "💐 Fleuriste"], ["mall", "🛍️ Boutique / vêtements"],
  ["tech", "📱 Téléphonie / électronique"], ["post", "📮 Poste / point relais"], ["autre", "🏪 Autre"]];
const dirKindSelect = (cur, attrs) => `<select ${attrs}>${cur ? "" : `<option value="">Catégorie…</option>`}${DIR_KINDS.map(([v, l]) => `<option value="${v}"${cur === v ? " selected" : ""}>${l}</option>`).join("")}</select>`;
async function initDirCard() {
  if (!$("#dirCard") || !window.Places) return;
  dirPick = null;
  Places.attach($("#dirAddr"), {
    lang: () => "fr",
    onPick: p => { dirPick = p; },
    onClear: () => { dirPick = null; },
    texts: () => ({ none: "Aucune adresse trouvée : ajoutez le numéro et la ville", down: "Recherche d'adresse indisponible, réessayez" })
  });
  const list = await Store.knownPlaces().catch(() => []);
  // Enseignes tapées par des clients : cachées aux autres tant qu'elles ne sont pas vérifiées (faute de frappe ?)
  const check = list.filter(x => x.verified === false && Number(x.uses || 1) < 3), ok = list.filter(x => !check.includes(x));
  const row = (x, tocheck) => `<div class="dir-row${tocheck ? " to-check" : ""}" data-place="${UI.esc(x.id)}"><span>${dirKindSelect(x.kind || "", 'class="dir-kind" data-place-kind="1" aria-label="Catégorie"')} <b>${UI.esc(x.name)}</b> · ${UI.esc(x.address)}${x.city ? ", " + UI.esc(UI.cityFr(x.city) || x.city) : ""} · ${Number(x.uses || 1)} commande(s)</span>
    <span class="dir-acts">${tocheck ? `<button type="button" class="btn btn-sm btn-primary" data-place-ok="1">✅ Existe</button><button type="button" class="btn btn-sm" data-place-fix="1">✏️ Corriger le nom</button>` : ""}<button type="button" class="btn btn-sm" data-place-del="1">Retirer</button></span></div>`;
  $("#dirCount").textContent = list.length;
  $("#dirCheck").innerHTML = check.length ? `<p class="small"><b>🔎 ${check.length} enseigne(s) tapée(s) par des clients à vérifier</b> (cachées aux autres clients jusque-là ; visibles d'office après 3 commandes)</p>${check.map(x => row(x, true)).join("")}` : "";
  $("#dirList").innerHTML = ok.map(x => row(x, false)).join("") || "Aucun pour l'instant.";
  // Changer la catégorie d'une enseigne déjà ajoutée (ou apprise d'un client)
  $("#dirCard").onchange = async e => {
    const sel = e.target.closest("[data-place-kind]");
    if (!sel) return;
    try { await Store.knownPlaceKind(sel.closest("[data-place]").dataset.place, sel.value); sel.classList.add("saved"); }
    catch (ex) { alert("Catégorie non enregistrée, vérifiez la connexion."); }
  };
}
async function saveDirPlace() {
  const fr = $("#dirFr").value.trim(), he = $("#dirHe").value.trim(), kind = $("#dirKind").value, msg = $("#dirMsg");
  if (!fr && !he) { msg.textContent = "⚠️ Indiquez au moins un nom."; return; }
  if (!kind) { msg.textContent = "⚠️ Choisissez la catégorie (restaurant, boulangerie, pressing…)."; $("#dirKind").focus(); return; }
  if (!dirPick || dirPick.lat == null) { msg.textContent = "⚠️ Choisissez l'adresse dans la liste proposée (rue et numéro)."; return; }
  const name = fr && he ? `${fr} · ${he}` : fr || he;
  const address = [dirPick.streetName || dirPick.street, dirPick.housenumber].filter(Boolean).join(" ") || dirPick.street;
  try {
    await Store.knownPlaceAdd({ name, address, city: dirPick.cityId || CONFIG.homeCity, lat: dirPick.lat, lon: dirPick.lon, kind });
    msg.textContent = `✅ « ${name} » ajouté : les clients le trouvent dès maintenant.`;
    $("#dirFr").value = ""; $("#dirHe").value = ""; $("#dirAddr").value = ""; $("#dirKind").value = ""; dirPick = null;
    initDirCard();
  } catch (ex) {
    msg.textContent = /409|duplicate|unique/i.test(String(ex && ex.message)) ? "Déjà dans l'annuaire à cette adresse." : "⚠️ Non enregistré, vérifiez la connexion.";
  }
}
// Placer une enseigne à la position voulue (0 = en premier) : on renumérote 1, 2, 3… dans le nouvel ordre
async function moveVitrine(id, to) {
  const vit = vitrineShops(), i = vit.findIndex(x => x.id === id);
  if (i < 0 || to < 0 || to >= vit.length || to === i) return render();
  const [x] = vit.splice(i, 1);
  vit.splice(to, 0, x);
  try { await Promise.all(vit.map((y, k) => (y.rank === k + 1 ? null : Store.updateShop(y.id, { rank: k + 1 }))).filter(Boolean)); await load(); }
  catch (ex) { alert("Non enregistré, vérifiez la connexion."); await load(); }
}
// Les enseignes de la vitrine de l'accueil, dans l'ordre des clients (le même que shops_showcase)
function vitrineShops() {
  return shops.filter(x => !x.demo && x.status === "actif" && (Store.planActive(x) || x.showcase))
    .sort((a, b) => ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || (!!b.cover - !!a.cover) || (!!b.logo - !!a.logo) || String(a.name).localeCompare(String(b.name)));
}
// Rangées de commerces sur l'accueil des clients : le patron les allume ou les éteint d'un geste (pour tout le monde)
const HOME_ROWS = [["open", "🟢 Ouverts maintenant", "les commerces ouverts, ceux qui ferment le plus tard d'abord ; ceux que vous choisissez passent devant, dans votre ordre (seulement quand ils sont ouverts)"],
  ["popular", "🔥 Populaires", "les commerces mis en avant (🔥) et ceux qui ont le plus de commandes"],
  ["fresh", "✨ Nouveautés", "les commerces arrivés depuis moins de 30 jours"],
  ["all", "🏪 Nos commerces partenaires", "tous les commerces partenaires, à la suite"]];
const homeRows = () => Object.assign({}, CONFIG.homeRows || {}, (settings && settings.home_rows) || {});
// Commerces à démarcher : les commerces non partenaires où nos clients commandent le plus (30 derniers jours).
// Avec ces chiffres, le patron va les voir pour un partenariat (message prêt, avec leurs vrais chiffres)
function prospectsCard() {
  const since = Date.now() - 30 * 86400000, digits = v => String(v || "").replace(/\D/g, "").slice(-9);
  const partner = sh => !!sh && !sh.cash_ok;   // les commerces où HOP! commande pour le client ont « payé au livreur »
  const groups = new Map();
  orders.filter(o => !o.is_test && !["annulee", "refusee"].includes(o.status) && new Date(o.created_at).getTime() >= since).forEach(o => {
    const sh = o.shop_id ? shops.find(x => x.id === o.shop_id) : null;
    if (sh && (partner(sh) || /^HOP/.test(sh.code || "") || sh.demo)) return;
    const name = sh ? sh.name : o.service === "achat" ? "" : String(o.pickup_place || "").trim();
    if (!name) return;
    const k = sh ? "s:" + sh.id : "p:" + name.toLowerCase();
    const g = groups.get(k) || { name, sh, phone: sh ? sh.whatsapp || sh.phone : o.pickup_phone, lang: sh ? sh.lang : "he", list: [] };
    if (!g.phone && o.pickup_phone) g.phone = o.pickup_phone;
    g.list.push(o); groups.set(k, g);
  });
  const rows = [...groups.values()].map(g => {
    const phones = g.list.map(o => digits(o.contact_phone)).filter(Boolean), count = {};
    phones.forEach(p => { count[p] = (count[p] || 0) + 1; });
    return Object.assign(g, { n: g.list.length, goods: sum(g.list, o => Number(o.items_total || 0)), clients: Object.keys(count).length,
      back: Object.values(count).filter(x => x > 1).length });
  }).sort((a, b) => b.n - a.n || b.goods - a.goods).slice(0, 12);
  const pitch = g => {
    const amount = g.goods > 0 ? UI.money(g.goods) : "";
    return g.lang === "fr"
      ? `Bonjour, ici HOP! Livraison à Netanya 🛵\nCes 30 derniers jours, nos clients ont commandé ${g.n} fois chez ${g.name}${amount ? " (" + amount + " d'achats)" : ""}, ${g.clients} clients différents${g.back ? ", dont " + g.back + " qui reviennent" : ""}. On est venus chercher chaque commande au comptoir.\nOn aimerait vous proposer un partenariat : les commandes vous arrivent directement, prêtes à l'heure, payées en ligne, avec votre page sur HOP!. On passe vous voir ?`
      : `שלום, כאן HOP! משלוחים בנתניה 🛵\nב-30 הימים האחרונים הלקוחות שלנו הזמינו ${g.n} פעמים מ${g.name}${amount ? " (קניות ב-" + amount + ")" : ""}, ${g.clients} לקוחות שונים${g.back ? ", מתוכם " + g.back + " שחוזרים" : ""}. אספנו כל הזמנה מהדלפק.\nנשמח להציע לכם שיתוף פעולה: ההזמנות מגיעות אליכם ישירות, מוכנות בזמן, משולמות אונליין, עם עמוד משלכם ב-HOP!. נקפוץ אליכם?`;
  };
  return `<details class="card adm-fold" style="margin-bottom:14px" data-fold="c:prospect"${foldOpen("c:prospect")}>
    <summary><b>📈 Commerces à démarcher</b>${rows.some(g => g.n >= 15) ? ` <span class="pill paid">🔥 ${rows.filter(g => g.n >= 15).length} prêt(s)</span>` : ""}</summary>
    <p class="muted small" style="margin:4px 0 8px">Les commerces non partenaires où nos clients commandent le plus (30 derniers jours). À partir d'environ 15 commandes par mois, allez les voir avec ces chiffres : le message est prêt, dans sa langue.</p>
    ${rows.length ? `<div class="prospects">${rows.map((g, i) => `<div class="pr-row${g.n >= 15 ? " hot" : ""}">
        <span class="pr-n">${i + 1}</span>
        <span class="pr-main"><b>${UI.esc(g.name)}</b><small>${g.n} commande(s)${g.goods > 0 ? " · " + UI.money(g.goods) + " d'achats" : ""} · ${g.clients} client(s)${g.back ? " · " + g.back + " qui reviennent" : ""}${g.n >= 15 ? " · 🔥 prêt à démarcher" : ""}</small></span>
        ${g.phone ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.waPersonal(g.phone, pitch(g)))}">💬 Proposer</a>` : `<button class="btn btn-sm" data-copy="${UI.esc(pitch(g))}" title="Pas de numéro : copier le message">📋 Message</button>`}
      </div>`).join("")}</div>` : `<p class="small">Pas encore de commande chez un commerce non partenaire ces 30 derniers jours.</p>`}
  </details>`;
}
function homeRowsCard() {
  const hr = homeRows(), vit = vitrineShops(), byCode = c => shops.find(x => x.code === c);
  return `<div class="card home-rows" style="margin-bottom:14px">
      <b>🏠 Accueil des clients : rangées de commerces</b>
      <p class="muted small" style="margin:4px 0 8px">Pour chaque rangée : l'interrupteur l'affiche ou la cache chez tous les clients, et « Choisir les commerces » vous laisse mettre ceux que vous voulez, dans l'ordre. Rien de choisi = automatique. « Mes favoris » reste toujours affiché.</p>
      <div class="hr-list">${HOME_ROWS.map(([k, label, sub]) => {
        const on = hr[k] !== false, list = hrList(hr, k).filter(byCode);
        const opts = vit.filter(x => !list.includes(x.code));
        return `<div class="hr-item${on ? " on" : ""}">
        <button type="button" class="hr-row${on ? " on" : ""}" data-homerow="${k}" aria-pressed="${on}">
          <span><b>${label}</b><small>${list.length ? `${list.length} commerce${list.length > 1 ? "s" : ""} choisi${list.length > 1 ? "s" : ""}, dans votre ordre` : "Automatique : " + sub}</small></span><i class="hr-sw" aria-hidden="true"></i><em>${on ? "Affichée" : "Cachée"}</em></button>
        <details class="hr-pick" data-fold="hr:${k}"${foldOpen("hr:" + k)}><summary>📋 Choisir les commerces et leur ordre${list.length ? ` (${list.length})` : ""}</summary>
          ${list.length ? `<ol class="hr-ol">${list.map((c, i) => `<li><span class="hr-n">${i + 1}</span><b>${UI.esc(byCode(c).name)}</b>
            <button type="button" class="hr-btn" data-hrmove="${k}|${i}|-1" ${i ? "" : "disabled"} aria-label="Monter">↑</button>
            <button type="button" class="hr-btn" data-hrmove="${k}|${i}|1" ${i < list.length - 1 ? "" : "disabled"} aria-label="Descendre">↓</button>
            <button type="button" class="hr-btn hr-del" data-hrdel="${k}|${i}" aria-label="Retirer">✕</button></li>`).join("")}</ol>`
            : `<p class="muted small" style="margin:6px 0">Aucun commerce choisi : la rangée se remplit toute seule (${sub}).</p>`}
          ${opts.length ? `<select class="hr-add" data-hradd="${k}" aria-label="Ajouter un commerce"><option value="">➕ Ajouter un commerce…</option>${opts.map(x => `<option value="${UI.esc(x.code)}">${UI.esc(x.name)}</option>`).join("")}</select>`
            : `<p class="muted small" style="margin:6px 0">${vit.length ? "Tous les commerces de l'accueil sont déjà dans la rangée." : "Aucun commerce sur l'accueil pour l'instant (HOP! Pro ou « vitrine » activée)."}</p>`}
          ${list.length ? `<button type="button" class="btn btn-sm" data-hrauto="${k}">↺ Revenir à l'automatique</button>` : ""}
        </details></div>`; }).join("")}</div>
    </div>`;
}
// Liste choisie d'une rangée (codes des commerces, dans l'ordre) ; vide = automatique
const hrList = (hr, k) => (Array.isArray(hr[k + "_list"]) ? hr[k + "_list"].slice() : []);
async function saveHomeRows(next, el) {
  if (el) el.disabled = true;
  try { await Store.saveSettings({ home_rows: next }); settings.home_rows = next; }
  catch (ex) { alert("Réglage non enregistré, vérifiez la connexion."); }
  render();
}
document.addEventListener("click", e => {
  const sw = e.target.closest("[data-homerow]"), mv = e.target.closest("[data-hrmove]"), del = e.target.closest("[data-hrdel]"), auto = e.target.closest("[data-hrauto]");
  if (!sw && !mv && !del && !auto) return;
  const hr = homeRows(), next = Object.assign({}, hr);
  if (sw) { const k = sw.dataset.homerow; next[k] = hr[k] === false; return saveHomeRows(next, sw); }
  if (auto) { if (!confirm("Vider la liste ? La rangée se remplira de nouveau toute seule.")) return; next[auto.dataset.hrauto + "_list"] = []; return saveHomeRows(next, auto); }
  const [k, i, d] = (mv || del).dataset[mv ? "hrmove" : "hrdel"].split("|"), list = hrList(hr, k).filter(c => shops.some(x => x.code === c)), n = Number(i);
  if (mv) { const j = n + Number(d); if (j < 0 || j >= list.length) return; [list[n], list[j]] = [list[j], list[n]]; }
  else list.splice(n, 1);
  next[k + "_list"] = list;
  saveHomeRows(next, mv || del);
});
document.addEventListener("change", e => {
  const sel = e.target.closest("[data-hradd]");
  if (!sel || !sel.value) return;
  const k = sel.dataset.hradd, hr = homeRows(), list = hrList(hr, k).filter(c => shops.some(x => x.code === c));
  if (!list.includes(sel.value)) list.push(sel.value);
  saveHomeRows(Object.assign({}, hr, { [k + "_list"]: list }), sel);
});
function renderShops(view) {
  const month = today().slice(0, 7);
  const viaShop = orders.filter(o => o.shop_id && o.status === "livree" && !o.is_test);
  const order = ["en_attente", "actif", "suspendu"];
  // Les vitrines de démonstration ont leur propre carte (liens à montrer aux commerces), pas dans la liste
  // À vérifier d'abord, puis les enseignes de l'accueil dans leur ordre (n° 1 en premier), puis les autres
  const vitIds = vitrineShops().map(x => x.id), vpos = x => (vitIds.includes(x.id) ? vitIds.indexOf(x.id) : 1e9);
  const all = shops.filter(x => !x.demo).sort((a, b) => (order.indexOf(a.status) - order.indexOf(b.status)) || (vpos(a) - vpos(b)));
  // Recherche : nom, code, adresse, contact ou téléphone
  const q = shopsQ.trim().toLowerCase(), qd = q.replace(/\D/g, "");
  const list = all.filter(x => !q || [x.name, x.code, x.address, x.contact_name, x.email].some(v => String(v || "").toLowerCase().includes(q))
    || (qd.length >= 3 && [x.phone, x.whatsapp].some(v => String(v || "").replace(/\D/g, "").includes(qd))));
  const demos = [["DEMO-RESTO", "🍔 Restaurant"], ["DEMO-BOULANGERIE", "🥐 Boulangerie"], ["DEMO-BOUTIQUE", "👗 Boutique"]]
    .map(([code, label]) => ({ code, label, url: UI.appUrl("index.html") + "?c=" + code, space: UI.appUrl("commerce.html") + "?demo=" + code.split("-")[1].toLowerCase() }));
  // Retirer les démos d'un geste (elles sont seulement suspendues, jamais effacées : on peut les remettre)
  const demoShops = shops.filter(x => x.demo), demoOn = demoShops.some(x => x.status === "actif");
  const signup = UI.appUrl("commerce.html") + "?inscription=1" + (me && me.ref_code ? "&p=" + me.ref_code : "");
  const statusLabel = { en_attente: "⏳ À vérifier", actif: "✅ Partenaire", suspendu: "⛔ Suspendu" };
  const bonusDue = sum(orders.filter(o => o.status === "livree" && !o.is_test && Number(o.referral_bonus) > 0 && o.referral_status !== "regle"), o => Number(o.referral_bonus));
  // Dès qu'un commerce s'inscrit : ses accès à lui envoyer, en haut de l'onglet
  const toSend = all.filter(x => x.status !== "suspendu" && !accessSent()[x.id] && (x.whatsapp || x.phone));
  const vit = vitrineShops();
  view.innerHTML = `
    ${toSend.length ? `<div class="card access-card" style="margin-bottom:14px">
      <b>📲 ${toSend.length === 1 ? "1 commerce attend ses accès" : toSend.length + " commerces attendent leurs accès"}</b>
      <p class="muted small" style="margin:4px 0 8px">Le lien de son espace (catalogue, commandes), son code et le lien pour ses clients : le message est déjà écrit dans sa langue, appuyez sur Envoyer dans WhatsApp.</p>
      ${toSend.map(x => `<div class="access-row"><span><b>${UI.esc(x.name)}</b> · ${UI.esc(x.contact_name || "")} · ${UI.esc(x.whatsapp || x.phone)}</span>${accessBtn(x)}</div>`).join("")}
    </div>` : ""}
    ${prospectsCard()}
    ${homeRowsCard()}
    <details class="card adm-fold" style="margin-bottom:14px" id="dirCard" data-fold="c:dir"${foldOpen("c:dir")}>
      <summary><b>📖 Annuaire : ajouter un commerce</b></summary>
      <p class="muted small" style="margin:4px 0 8px">Un restaurant, une makolet, une épicerie… qui ne sort pas dans la recherche : ajoutez-le ici. Il apparaît tout de suite chez tous les clients (« Catalogue à venir » tant qu'il n'est pas partenaire).</p>
      <div class="dir-add">
        <input id="dirFr" placeholder="Nom en français (ex. Oshi Sushi)" />
        <input id="dirHe" placeholder="Nom en hébreu (ex. אושי סושי)" dir="rtl" />
        ${dirKindSelect("", 'id="dirKind" aria-label="Catégorie"')}
        <div><input id="dirAddr" placeholder="Adresse : rue et numéro, puis choisir dans la liste" /></div>
        <button type="button" class="btn btn-primary btn-sm" id="dirSave">➕ Ajouter à l'annuaire</button>
        <p class="small" id="dirMsg"></p>
      </div>
      <div id="dirCheck" class="dir-check small"></div>
      <details data-fold="dirlist"${foldOpen("dirlist")} style="margin-top:8px"><summary class="small">Déjà ajoutés ou appris (<span id="dirCount">…</span>)</summary><div id="dirList" class="small"></div></details>
    </details>
    <details class="card adm-fold" style="margin-bottom:14px" data-fold="c:demo"${foldOpen("c:demo")}>
      <summary><b>🎬 Vitrines de démonstration</b></summary>
      <p class="muted small" style="margin:4px 0 8px">À montrer en rendez-vous : un restaurant, une boulangerie et une boutique avec un catalogue complet. Le commerçant voit sa future vitrine (côté client) et son espace (🧑‍🍳 : ajouter un article, changer un prix, accepter une commande) ; aucune commande ne part, rien n'est envoyé. Invisibles pour les clients.</p>
      ${demoOn ? `<div class="actions">${demos.map(d => `<a class="btn btn-sm btn-primary" href="${UI.esc(d.url)}" target="_blank" rel="noopener">${d.label}</a><a class="btn btn-sm" href="${UI.esc(d.space)}" target="_blank" rel="noopener" title="L'espace du commerçant : catalogue, prix, commandes (démo sur le téléphone)">🧑‍🍳 Espace</a><button class="btn btn-sm" data-copy="${UI.esc(d.url)}" title="Copier le lien">📋</button>`).join("")}</div>` : `<p class="small">⛔ Démos retirées : les liens ne montrent plus rien.</p>`}
      ${demoShops.length ? `<div class="actions" style="margin-top:8px"><button class="btn btn-sm" data-demos="${demoOn ? "suspendu" : "actif"}">${demoOn ? "⛔ Retirer les démos" : "✅ Remettre les démos"}</button></div>` : ""}
    </details>
    <details class="card adm-fold" style="margin-bottom:14px" data-fold="c:vit"${foldOpen("c:vit")}>
      <summary><b>🏠 Vitrine de l'accueil : ordre des enseignes</b> <span class="muted small">(${vit.length})</span></summary>
      <p class="muted small" style="margin:4px 0 8px">L'ordre dans lequel les clients voient les enseignes sur l'accueil (n° 1 en premier ; les favoris d'un client passent avant, sur son téléphone). Les HOP! Pro y sont toujours ; une enseigne sans HOP! Pro (sans commande en ligne, comme une boutique) s'y ajoute avec « 🏠 Mettre dans la vitrine » sur sa fiche.</p>
      ${vit.length ? `<ol class="vit-list">${vit.map((x, i) => `<li><span><b>${UI.esc(x.name)}</b>${Store.planActive(x) ? " · ⭐ Pro" : " · 💬 vitrine"}</span>
        <span class="vit-move"><button class="btn btn-sm" data-vmove="${UI.esc(x.id)}" data-dir="-1"${i ? "" : " disabled"} aria-label="Monter">▲</button><button class="btn btn-sm" data-vmove="${UI.esc(x.id)}" data-dir="1"${i < vit.length - 1 ? "" : " disabled"} aria-label="Descendre">▼</button></span></li>`).join("")}</ol>`
        : `<p class="small">Aucune enseigne dans la vitrine pour l'instant.</p>`}
    </details>
    <details class="card adm-fold" style="margin-bottom:14px" data-fold="c:signup"${foldOpen("c:signup")}>
      <summary><b>🏪 Inscrire un commerce partenaire</b></summary>
      <p class="muted small" style="margin:4px 0 8px">Envoyez ce lien à un restaurant ou une boutique : il s'inscrit, puis vous le validez ici après avoir vérifié qu'il existe.</p>
      <div class="actions"><button class="btn btn-sm" data-copy="${UI.esc(signup)}">📋 Copier le lien</button><a class="btn btn-sm btn-primary" href="${UI.esc(signup)}" target="_blank" rel="noopener">➕ Inscrire un commerce</a></div>
    </details>
    <div class="stats">
      <div class="stat"><small>Commerces</small><b>${shops.filter(x => !x.demo && x.status !== "suspendu").length}</b></div>
      <div class="stat"><small>À vérifier</small><b>${shops.filter(x => !x.demo && x.status === "en_attente").length}</b></div>
      <div class="stat"><small>Courses ce mois</small><b>${viaShop.filter(o => UI.dayKey(o.pickup_at).startsWith(month)).length}</b></div>
      ${bonusDue > 0 ? `<div class="stat"><small>Bonus à régler</small><b>${UI.money(bonusDue)}</b></div>` : `<div class="stat"><small>Commerces</small><b>${shops.filter(x => !x.demo).length}</b><em class="muted small">dont ${shops.filter(x => !x.demo && Store.planActive(x)).length} HOP! Pro</em></div>`}
    </div>
    <div class="toolbar"><input id="shopsQ" type="search" placeholder="🔎 Rechercher un commerce (nom, code, adresse, téléphone)" value="${UI.esc(shopsQ)}" /></div>
    ${list.length ? `<div class="orders">${list.map(x => {
      const done = viaShop.filter(o => o.shop_id === x.id);
      // Fiche repliée en une ligne (nom, état, courses) ; celles à vérifier restent ouvertes
      const k = "s:" + x.id, open = openFolds.has(k) || (x.status === "en_attente" && !closedFolds.has(k));
      return `<details class="order-fold shop-fold" data-shop="${UI.esc(x.id)}" data-fold="${UI.esc(k)}"${open ? " open" : ""}><summary>
        <span>${vpos(x) < 1e9 ? `<em class="vit-n" title="Position sur l'accueil">${vpos(x) + 1}</em> ` : ""}${x.status === "en_attente" ? "⏳" : x.status === "suspendu" ? "⛔" : x.paused ? "⏸️" : "✅"} <b>${UI.esc(x.name)}</b>${Store.planActive(x) ? " · ⭐ Pro" : ""}${x.address ? " · " + UI.esc(x.address) : ""}</span>
        ${vpos(x) < 1e9 ? `<span class="vit-move"><button class="btn btn-sm" data-vmove="${UI.esc(x.id)}" data-dir="-1"${vpos(x) ? "" : " disabled"} aria-label="Monter">▲</button><button class="btn btn-sm" data-vmove="${UI.esc(x.id)}" data-dir="1"${vpos(x) < vitIds.length - 1 ? "" : " disabled"} aria-label="Descendre">▼</button></span>` : ""}
        <b>${done.length} 🛵</b></summary>
      <article class="order${x.status === "en_attente" ? " is-new" : ""}" data-shop="${UI.esc(x.id)}">
        <div class="order-head">
          <span class="order-time">${UI.esc(x.name)}</span>
          <span class="pill">${statusLabel[x.status] || x.status}</span>
          <span class="order-ref">Code ${UI.esc(x.code)}</span>
          <span class="order-price">${done.length} course(s)</span>
        </div>
        <div class="kv">
          <div><span>🏷️</span><span><select class="dir-kind" data-sact="kind" aria-label="Catégorie">${Object.entries(SHOP_KIND).map(([v, l]) => `<option value="${v}"${(SHOP_KIND[x.kind] ? x.kind : "autre") === v ? " selected" : ""}>${l}</option>`).join("")}</select> · ${UI.esc(x.address || "")}${x.city ? ", " + UI.esc(UI.cityFr(x.city)) : ""}</span></div>
          <div><span>👤</span><span>${tel(x.contact_name, x.phone)}${x.email ? " · " + UI.esc(x.email) : ""} · ${x.lang === "fr" ? "🇫🇷" : "🇮🇱"}</span></div>
          <div><span>🤝</span><span>Parrain : <select class="dir-kind" data-sact="referrer"><option value="">Aucun</option>${couriers.map(c => `<option value="${UI.esc(c.id)}" ${c.id === x.referrer_id ? "selected" : ""}>${UI.esc(c.role === "admin" ? "Moi (pas de bonus)" : c.name + (c.city && x.city && c.city !== x.city ? " · autre ville (" + UI.cityFr(c.city) + ")" : ""))}</option>`).join("")}</select>
            · bonus générés ${UI.money(sum(done, o => Number(o.referral_bonus || 0)))}</span></div>
          ${CONFIG.partners.carnet.offered || Number(x.credits || 0) > 0 ? `<div><span>🎟️</span><span>Carnet pro : <b>${Number(x.credits || 0)}</b> course(s) restante(s)${sales.filter(v => v.shop_id === x.id).map(v =>
            ` · <a href="${UI.esc(UI.carnetReceiptUrl(v))}" target="_blank" rel="noopener">🧾 Reçu n° ${v.receipt_number}</a>`).join("")}</span></div>` : ""}
          <div><span>📅</span><span>Inscrit le ${UI.esc(new Date(x.created_at).toLocaleDateString("fr-FR"))}</span></div>
          <details class="shop-fiche" data-fold="f:${UI.esc(x.id)}"${foldOpen("f:" + x.id)}><summary>📝 Fiche pour les clients : WhatsApp, site, paiement, horaires, présentation${x.whatsapp ? " · 💬 " + UI.esc(x.whatsapp) : ""}${x.pay_link || x.pay_bit ? " · 💳" : ""}</summary>
            <label class="f"><span>WhatsApp du commerce (les clients peuvent l'écrire directement)</span><input data-fiche="whatsapp" inputmode="tel" placeholder="053-373-3785" value="${UI.esc(x.whatsapp ? "0" + String(x.whatsapp).replace(/^972/, "") : "")}" /></label>
            <label class="f"><span>🌐 Site internet ou page Instagram / Facebook du commerce (affiché aux clients, avec son numéro)</span><input data-fiche="website" type="url" inputmode="url" dir="ltr" placeholder="https://" value="${UI.esc(x.website || "")}" /></label>
            <label class="f"><span>💳 Lien de paiement du commerce (carte bancaire : Grow, Cardcom, Tranzila, PayPlus…) : les clients paient leurs articles directement au commerce</span><input data-fiche="pay_link" type="url" inputmode="url" dir="ltr" placeholder="https://" value="${UI.esc(x.pay_link || "")}" /></label>
            <label class="f"><span>Bit / PayBox du commerce</span><input data-fiche="pay_bit" inputmode="tel" placeholder="053-373-3785" value="${UI.esc(x.pay_bit || "")}" /></label>
            <label class="f"><span>Présentation (600 caractères)</span><textarea data-fiche="about" maxlength="600" rows="3" placeholder="Ce que fait le commerce, ses spécialités…">${UI.esc(x.about || "")}</textarea></label>
            ${UI.hoursEditor(x.hours)}
            <button type="button" class="btn btn-sm btn-primary" data-sact="fiche">💾 Enregistrer la fiche</button>
          </details>
          <div><span>⭐</span><span>${(() => {
            // HOP! Pro : abonnement, et ce que le commerce doit ce mois-ci (abonnement + sa part des livraisons)
            const on = Store.planActive(x), month = new Date().toISOString().slice(0, 7);
            // Paiement direct : le commerce paie sa part au livreur ; HOP ne lui facture que sa part (2 ₪)
            const bill = o => (o.direct_pay ? (Number(o.shop_share || 0) > 0 ? Number(o.hop_share || 0) : 0) : Number(o.shop_share || 0));
            const mine = done.filter(o => o.status === "livree" && !o.is_test && bill(o) > 0 && String(o.pickup_at).slice(0, 7) === month);
            const shares = sum(mine, bill);
            return (on ? `<b>HOP! Pro</b> jusqu'au ${UI.esc(UI.fmtKey(x.plan_until))} · ce mois : ${UI.money(settings.pro_monthly)} + ${mine.length} livraison(s) ${UI.money(shares)} = <b>${UI.money(Number(settings.pro_monthly) + shares)}</b>`
              : x.plan_until ? `HOP! Pro terminé le ${UI.esc(UI.fmtKey(x.plan_until))}` : "Pas d'abonnement HOP! Pro")
              + ` · 🛵 ${x.shop_pays ? "🎁 l'enseigne offre la livraison (paie toute la course au livreur)" : x.client_pays ? "le client paie la livraison" : `l'enseigne paie ${UI.money(settings.pro_shop_share)} par livraison`}`;
          })()}</span></div>
        </div>
        <div class="actions">
          ${x.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-sact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-sact="suspendu">⛔ Suspendre</button>`}
          ${CONFIG.partners.carnet.offered ? `<button class="btn btn-sm" data-sact="carnet">🎟️ Carnet payé (${UI.money(CONFIG.partners.carnet.price)}) → +${CONFIG.partners.carnet.courses} et reçu</button>
          <button class="btn btn-sm" data-sact="credits">✏️ Courses du carnet</button>` : ""}
          <button class="btn btn-sm${Store.planActive(x) ? "" : " btn-primary"}" data-sact="plan" title="Le commerce a payé ${UI.esc(UI.money(settings.pro_monthly))}">⭐ HOP! Pro : +1 mois payé</button>
          <button class="btn btn-sm" data-sact="plangift">🎁 +1 mois offert</button>
          <button class="btn btn-sm" data-sact="enrich" title="Horaires, photo et menu repris de sa page publique (seulement ce qui est vide)">🤖 Remplir sa fiche</button>
          <button class="btn btn-sm${x.paused ? " btn-primary" : ""}" data-sact="paused" title="Le commerce reste visible, mais personne ne peut commander tant qu'il est en pause">${x.paused ? "▶️ Reprendre les commandes" : "⏸️ Ne prend plus de commandes"}</button>
          <button class="btn btn-sm${x.kosher ? " btn-primary" : ""}" data-sact="kosher" title="Badge « Casher » sur sa vitrine, sa page et la carte">${x.kosher ? "✡️ Casher ✓" : "✡️ Casher ?"}</button>
          ${"featured" in x ? `<button class="btn btn-sm${x.featured ? " btn-primary" : ""}" data-sact="featured" title="Dans la rangée 🔥 Populaires de l'accueil, en tête, même sans commande ce mois-ci (l'automatique suit derrière)">${x.featured ? "🔥 Mis en avant ✓" : "🔥 Mettre en avant"}</button>` : ""}
          ${Store.planActive(x) ? `<button class="btn btn-sm" data-sact="planoff">Arrêter HOP! Pro</button>`
            : `<button class="btn btn-sm${x.showcase ? " btn-primary" : ""}" data-sact="showcase" title="Sa page (logo, photos, WhatsApp) sur l'accueil des clients, même sans HOP! Pro">${x.showcase ? "🏠 Dans la vitrine ✓" : "🏠 Mettre dans la vitrine"}</button>`}
          ${vpos(x) < 1e9 ? `<label class="vit-pos">🏠 Position sur l'accueil <select data-vpos="${UI.esc(x.id)}">${vitIds.map((_, i) => `<option value="${i + 1}"${i === vpos(x) ? " selected" : ""}>${i + 1}${i === 0 ? " (en premier)" : i === vitIds.length - 1 ? " (en dernier)" : ""}</option>`).join("")}</select></label>` : ""}
          ${accessBtn(x)}
          ${chatBtn("s:" + x.id, `Commerce : ${x.name}`, x.phone, "💬 Message", shopWelcome(x))}
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl() + "?c=" + x.code)}">🛵 Commander pour lui</a>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl("commerce.html") + "?k=" + x.token + "&vu=1")}">🔑 Son espace</a>
          <textarea class="admin-note" data-sact="note" rows="1" placeholder="Note interne (vérifié sur place, horaires…)">${UI.esc(x.admin_note || "")}</textarea>
        </div>
      </article></details>`;
    }).join("")}</div>` : `<div class="empty card">${all.length ? "Aucun commerce ne correspond à la recherche." : "Aucun commerce inscrit pour l'instant. Envoyez votre lien à un restaurant ou une boutique !"}</div>`}`;
}

// --- Clients : comptes créés, clients sans compte (par téléphone), compteurs ---------------
// ===== Paniers des clients : en cours, laissés (abandonnés), relancés, commandés ==========================
// Un panier sans changement depuis 30 min et pas commandé = abandonné. « Relancer » ouvre WhatsApp avec un message
// prêt (dans la langue du client) et le marque « relancé ».
let carts = [], cartsFilter = "abandon";
const CART_IDLE = 30 * 60000;
const cartState = c => c.status === "commande" ? "commande" : c.status === "relance" ? "relance" : Date.now() - new Date(c.updated_at) > CART_IDLE ? "abandon" : "encours";
const CART_LBL = { abandon: "😴 Abandonnés", relance: "💬 Relancés", encours: "🛒 En cours", commande: "✅ Commandés", tous: "Tous" };
async function loadCarts() {
  // (les fiches clients servent au message de relance : client déjà livré → cadeau, nouveau → 1re course réduite)
  if (!clients.length) Store.adminClients().then(c => { if (c) clients = c; }).catch(() => {});
  carts = (await Store.adminCarts().catch(() => null)) || carts;
  const n = carts.filter(c => !c.boss && cartState(c) === "abandon").length;
  const b = $("#cartsBadge"); if (b) b.textContent = n ? String(n) : "";
  if (tab === "paniers" || tab === "jours") render();
}
function cartRelance(c) {
  const he = c.lang === "he", n = (c.client_name || "").split(" ")[0];
  // Le petit plus : client déjà livré → −5 ₪ sur la livraison s'il finit aujourd'hui (même téléphone) ; nouveau → sa 1re course à prix réduit
  const d9c = String(c.client_phone || "").replace(/\D/g, "").slice(-9), known = (clients || []).find(x => String(x.phone || "").replace(/\D/g, "").slice(-9) === d9c);
  const done = !!(known && Number(known.delivered) > 0), first = (CONFIG.pricing.fixedFromHome[CONFIG.homeCity] || 25) - Number((CONFIG.promos.codes.BIENVENUE || {}).amount || 10);
  const plus = d9c.length < 9 ? "" : done
    ? (he ? "\n🎁 מתנה: 5 ₪ פחות על המשלוח אם מסיימים את ההזמנה היום, מאותו טלפון." : "\n🎁 Petit cadeau : 5 ₪ de moins sur la livraison si vous finissez votre commande aujourd'hui, depuis ce téléphone.")
    : CONFIG.promos.welcomeOn === false ? "" : (he ? `\n🎁 המשלוח הראשון שלכם רק ${first} ₪.` : `\n🎁 Votre 1re livraison ne coûte que ${first} ₪.`);
  const items = (c.items || []).slice(0, 6).map(i => `• ${i.q} × ${i.n}`).join("\n") + ((c.items || []).length > 6 ? "\n…" : "");
  const base = location.origin + "/app/", link = c.shop_code ? `${base}?c=${encodeURIComponent(c.shop_code)}${he ? "&lang=he" : ""}` : base + (he ? "?lang=he" : "");
  return he
    ? `שלום${n ? " " + n : ""} 👋\nהסל שלכם ב-HOP! מחכה לכם 🛒${c.shop_name ? " (" + c.shop_name + ")" : ""}:\n${items}\n\nנשאר רק ללחוץ "להזמנה" ו-HOP! מביאים לכם עד הבית 🛵${plus}\n👈 ${link}`
    : `Bonjour${n ? " " + n : ""} 👋\nVotre panier HOP! vous attend 🛒${c.shop_name ? " (" + c.shop_name + ")" : ""} :\n${items}\n\nIl ne reste qu'à toucher « Commander » et HOP! vous l'apporte chez vous 🛵${plus}\n👉 ${link}`;
}
// Où le client s'est arrêté (enregistré par son téléphone) : au panier, à un écran de la commande, ou après « Commander »
function cartStepLbl(c) {
  const s = String(c.step || "panier"), m = s.match(/^e(\d)\/(\d)$/);
  if (s === "envoi") return "📤 a touché « Commander »";
  if (m) return +m[1] === 1 ? "📍 à l'adresse" : +m[1] >= +m[2] ? "✅ au récapitulatif" : "📝 aux détails";
  return "🛒 au panier";
}
// --- 📅 Compta par jour : ce que HOP! (le patron) gagne, ce que gardent les livreurs, ce qui a été raté --------------
// Moi (HOP!) = mes propres courses au prix entier + les commissions et parts HOP des courses des livreurs − les réductions
// payées par HOP + les abonnements Pro. Livreurs = ce qu'ils gardent (course + réduction + part du commerce − parts HOP)
// + attentes et pourboires reçus. Raté = paniers laissés et courses annulées / refusées, comptés EN LIVRAISON :
// « si je livre » = prix de la livraison entier, « si un livreur livre » = seulement ma commission.
let dailyDays = 14;
const courierKeep = o => Number(o.price || 0) + Number(o.discount || 0) + Number(o.shop_share || 0) - Number(o.hop_share || 0) - Number(o.commission || 0);
const courierExtras = o => (Number(o.wait_fee) > 0 && o.wait_status !== "refuse" ? Number(o.wait_fee) : 0) + (Number(o.tip) > 0 && (o.tip_status === "recu" || o.direct_pay) && o.tip_status !== "promis" ? Number(o.tip) : 0);
// Prix de la livraison qu'aurait payé un panier laissé : course en ville, + l'achat pour les rayons et les boutiques HOP!
function cartDelivery(c) {
  const P = CONFIG.pricing, base = Number(P.fixedFromHome[CONFIG.homeCity] || P.base || 25);
  const kind = String(c.kind || ""), rayon = /^rayon/.test(kind) ? kind.split(":")[1] || "shop" : null;
  if ((CONFIG.hopShops || []).includes(String(c.shop_code || "").toUpperCase())) return base + Number(P.purchase || 0);
  if (rayon) return base + Number((P.purchaseSmall || []).includes(rayon) ? P.purchase || 0 : P.purchaseShop || P.purchase || 0);
  return base;
}
function renderDaily(view) {
  const days = [...Array(dailyDays)].map((_, i) => addDays(today(), -i));
  const real = carts.filter(c => !c.boss && Number(c.count) > 0 && c.status !== "commande" && c.status !== "vide" && cartState(c) !== "encours");
  const fig = k => {
    const done = orders.filter(o => o.status === "livree" && !o.is_test && UI.dayKey(o.pickup_at) === k);
    const mine = done.filter(isMine), theirs = done.filter(o => !isMine(o));
    const plans = planSales.filter(p => UI.dayKey(p.created_at) === k).reduce((a, p) => a + Number(p.amount || 0) - Number(p.referrer_share || 0), 0);
    const meRides = sum(mine, o => Number(o.price) + Number(o.shop_share || 0));
    const meCom = sum(theirs, o => Number(o.commission || 0) + Number(o.hop_share || 0) - Number(o.discount || 0));
    const lostCarts = real.filter(c => UI.dayKey(c.updated_at) === k);
    const lostOrders = orders.filter(o => ["annulee", "refusee"].includes(o.status) && !o.is_test && UI.dayKey(o.pickup_at) === k);
    const lostFull = sum(lostCarts, cartDelivery) + sum(lostOrders, o => Number(o.price) + Number(o.discount || 0));
    const lostCom = sum(lostCarts, c => Store.commissionFor(cartDelivery(c), settings)) + sum(lostOrders, o => Store.commissionFor(Number(o.price) + Number(o.discount || 0), settings));
    return { k, n: done.length, nMine: mine.length, nTheirs: theirs.length, meRides, meCom, plans, me: meRides + meCom + plans,
      couriers: sum(theirs, o => courierKeep(o) + courierExtras(o)), total: sum(done, o => Number(o.price) + Number(o.discount || 0) + Number(o.shop_share || 0)),
      nCarts: lostCarts.length, nLost: lostOrders.length, lostFull, lostCom, done, lostCarts, lostOrders };
  };
  const rows = days.map(fig);
  if (!rows.some(r => r.k === dailySel)) dailySel = rows[0].k;
  const d0 = rows.find(r => r.k === dailySel);
  const tot = rows.reduce((a, r) => { Object.keys(r).forEach(x => { if (typeof r[x] === "number") a[x] = (a[x] || 0) + r[x]; }); return a; }, {});
  const dayName = k => { const d = new Date(k + "T12:00:00"); return k === today() ? "Aujourd'hui" : k === addDays(today(), -1) ? "Hier" : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); };
  const m = n => UI.money(Math.round(n * 2) / 2);
  const busy = r => r.n || r.nCarts || r.nLost || r.plans;
  view.innerHTML = `
    <div class="toolbar">${[7, 14, 30].map(n => `<button type="button" class="btn btn-sm${n === dailyDays ? " btn-primary" : ""}" data-djdays="${n}">${n} jours</button>`).join("")}</div>
    <div class="dj-strip" id="djStrip">${rows.map(r => `<button type="button" class="dj-day${r.k === dailySel ? " on" : ""}${busy(r) ? "" : " off"}" data-djday="${r.k}">
      <small>${UI.esc(dayName(r.k))}</small><b>${r.me ? m(r.me) : "—"}</b><em>${r.n ? `${r.n} course${r.n > 1 ? "s" : ""}` : r.nCarts ? `${r.nCarts} panier${r.nCarts > 1 ? "s" : ""}` : "rien"}</em></button>`).join("")}</div>
    <div class="card dj-today"><h3>📅 ${UI.esc(dayName(d0.k))}${d0.k !== today() && d0.k !== addDays(today(), -1) ? "" : ` <span class="small muted">${UI.esc(new Date(d0.k + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))}</span>`}</h3>
      <div class="dj-grid">
        <div class="dj-me"><small>👑 Pour moi (HOP!)</small><b>${m(d0.me)}</b><span>${d0.nMine ? `${d0.nMine} course${d0.nMine > 1 ? "s" : ""} faite${d0.nMine > 1 ? "s" : ""} par moi : ${m(d0.meRides)}` : "Aucune course faite par moi"}<br>${d0.nTheirs ? `Commissions sur ${d0.nTheirs} course${d0.nTheirs > 1 ? "s" : ""} des livreurs, codes promo déduits : ${m(d0.meCom)}` : "Pas de commission"}${d0.plans ? `<br>Abonnements Pro : ${m(d0.plans)}` : ""}</span></div>
        <div><small>🛵 Pour les livreurs</small><b>${m(d0.couriers)}</b><span>${d0.nTheirs} course${d0.nTheirs > 1 ? "s" : ""} (attentes et pourboires compris)</span></div>
        <div class="dj-lost"><small>😴 Raté en livraison</small><b>${m(d0.lostFull)}</b><span>${d0.nCarts} panier${d0.nCarts > 1 ? "s" : ""} laissé${d0.nCarts > 1 ? "s" : ""}${d0.nLost ? ` · ${d0.nLost} course${d0.nLost > 1 ? "s" : ""} annulée${d0.nLost > 1 ? "s" : ""}` : ""}<br>Si je livrais moi-même : ${m(d0.lostFull)} · si un livreur livrait : ${m(d0.lostCom)} pour moi</span></div>
      </div></div>
    ${dayDetail(d0, m)}
    <div class="card dj-period"><small>Sur ${dailyDays} jours</small>
      <div class="dj-line"><span>👑 Moi</span><b>${m(tot.me || 0)}</b></div>
      <div class="dj-line"><span>🛵 Livreurs</span><b>${m(tot.couriers || 0)}</b></div>
      <div class="dj-line"><span>🧾 Total des courses (${tot.n || 0})</span><b>${m(tot.total || 0)}</b></div>
      <div class="dj-line dj-miss"><span>😴 Raté si je livre · si un livreur livre</span><b>${m(tot.lostFull || 0)} · ${m(tot.lostCom || 0)}</b></div></div>
    <details class="fin-more" style="margin-top:10px"><summary>ℹ️ Comment c'est calculé</summary><p class="small muted" style="margin-top:8px">
      <b>Moi (HOP!)</b> : les courses que je fais moi-même, au prix entier ; plus, sur les courses des livreurs, ma commission et la part HOP des commerces Pro, moins les codes promo que HOP paie ; plus les abonnements Pro.<br>
      <b>Livreurs</b> : ce qu'ils gardent (prix de la course + réduction payée par HOP + part du commerce − ce qui revient à HOP), plus les attentes et les pourboires reçus.<br>
      <b>Raté</b> : paniers laissés sans commande (pas les essais faits sur mon téléphone) et courses annulées ou refusées. On ne compte pas les articles : seulement la livraison qu'on aurait faite (course en ville, + l'achat pour les rayons et les boutiques HOP!). « Si un livreur livre » = seulement ma commission.<br>
      Seulement les courses livrées comptent (pas les essais). Jour = jour de la course, à l'heure d'Israël.</p></details>`;
  // le jour choisi reste visible dans la bande
  const on = view.querySelector(".dj-day.on"), st = view.querySelector("#djStrip");
  if (on && st) st.scrollLeft = on.offsetLeft - st.offsetLeft - (st.clientWidth - on.offsetWidth) / 2;   // sans faire bouger la page
}
let dailySel = "";
// Détail du jour choisi : chaque course (heure, client, qui l'a faite, prix, pour moi, pour le livreur),
// puis ce qui a été raté (paniers laissés, courses annulées) avec la livraison qu'on aurait faite
function dayDetail(r, m) {
  const hm = iso => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
  const done = r.done.slice().sort((a, b) => new Date(a.pickup_at) - new Date(b.pickup_at));
  const ride = o => { const me = isMine(o), hop = me ? Number(o.price) + Number(o.shop_share || 0) : hopOf(o), keep = me ? 0 : courierKeep(o) + courierExtras(o);
    return `<div class="dj-row"><span class="dj-h">${hm(o.pickup_at)}</span>
      <span class="dj-who"><b>${UI.esc(o.shop_name || o.contact_name || "Client")}</b><small>n° ${UI.esc(o.ref || "")} · ${me ? "👑 faite par moi" : "🛵 " + UI.esc(o.courier_name || courierName(o.courier_id) || "livreur")}${Number(o.discount) ? ` · 🎁 −${m(Number(o.discount))}` : ""}</small></span>
      <span class="dj-amt"><b>${m(Number(o.price) + Number(o.discount || 0) + Number(o.shop_share || 0))}</b><small>moi ${m(hop)}${me ? "" : ` · lui ${m(keep)}`}</small></span></div>`; };
  const cart = c => `<div class="dj-row dj-lostrow"><span class="dj-h">${hm(c.updated_at)}</span>
      <span class="dj-who"><b>🛒 ${UI.esc(c.shop_name || (String(c.kind || "").startsWith("rayon") ? "Rayon " + (String(c.kind).split(":")[1] || "") : "Panier"))}</b><small>${UI.esc(c.client_name || "Client sans nom")} · ${c.count} article${c.count > 1 ? "s" : ""} · arrêté ${UI.esc(cartStepLbl(c))}</small></span>
      <span class="dj-amt"><b>${m(cartDelivery(c))}</b><small>livreur : ${m(Store.commissionFor(cartDelivery(c), settings))}</small></span></div>`;
  const lost = o => `<div class="dj-row dj-lostrow"><span class="dj-h">${hm(o.pickup_at)}</span>
      <span class="dj-who"><b>❌ ${UI.esc(o.shop_name || o.contact_name || "Course")}</b><small>n° ${UI.esc(o.ref || "")} · ${o.status === "refusee" ? "refusée" : "annulée"}</small></span>
      <span class="dj-amt"><b>${m(Number(o.price) + Number(o.discount || 0))}</b><small>livreur : ${m(Store.commissionFor(Number(o.price) + Number(o.discount || 0), settings))}</small></span></div>`;
  if (!done.length && !r.lostCarts.length && !r.lostOrders.length) return `<p class="muted small" style="margin:10px 2px">Rien ce jour-là.</p>`;
  return `<div class="card dj-detail">
    ${done.length ? `<h4>🧾 Les courses (${done.length})</h4>${done.map(ride).join("")}` : ""}
    ${r.lostCarts.length || r.lostOrders.length ? `<h4>😴 Raté (${r.lostCarts.length + r.lostOrders.length}) <small class="muted">· livraison si je livre / ma commission si un livreur livre</small></h4>${r.lostOrders.map(lost).join("")}${r.lostCarts.map(cart).join("")}` : ""}
  </div>`;
}
document.addEventListener("click", e => { const d = e.target.closest("[data-djday]"); if (d) { dailySel = d.dataset.djday; render(); } });
document.addEventListener("click", e => { const b = e.target.closest("[data-djdays]"); if (b) { dailyDays = Number(b.dataset.djdays); render(); } });
function renderCarts(view) {
  // Les paniers faits depuis le téléphone du patron (essais) : mis à part, ils ne faussent pas les chiffres
  const mine = carts.filter(c => c.boss), real = carts.filter(c => !c.boss);
  const by = k => real.filter(c => k === "tous" || cartState(c) === k);
  // À relancer maintenant : abandonné depuis 1 h à 24 h, avec un numéro, jamais relancé (en tête de liste)
  const due = c => cartState(c) === "abandon" && c.client_phone && !c.remind_count && Date.now() - new Date(c.updated_at) >= 3600000 && Date.now() - new Date(c.updated_at) < 86400000;
  const list = by(cartsFilter).sort((x, y) => (due(y) - due(x)) || (new Date(y.updated_at) - new Date(x.updated_at)));
  const nDue = real.filter(due).length;
  const steps = {};
  by("abandon").forEach(c => { const l = cartStepLbl(c); steps[l] = (steps[l] || 0) + 1; });
  const nPush = real.filter(c => c.push_ok).length, waitOpen = real.filter(c => c.open_notice && !c.open_noticed_at && cartState(c) !== "commande");
  const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  // Ce qui compte pour le patron : la LIVRAISON ratée (pas la valeur des articles)
  const ab = by("abandon").filter(c => Number(c.count) > 0), lostFull = ab.reduce((a, c) => a + cartDelivery(c), 0),
    lostCom = ab.reduce((a, c) => a + Store.commissionFor(cartDelivery(c), settings), 0);
  view.innerHTML = `
    <div class="stats">
      <div class="stat"><small>Paniers abandonnés</small><b>${by("abandon").length}</b></div>
      <div class="stat"><small>Livraisons ratées (si je livre)</small><b>${UI.money(lostFull)}</b></div>
      <div class="stat"><small>Si un livreur livrait (ma commission)</small><b>${UI.money(lostCom)}</b></div>
      <div class="stat"><small>Relancés</small><b>${by("relance").length}</b></div>
      <div class="stat"><small>Commandés</small><b>${by("commande").length}</b></div>
    </div>
    ${Object.keys(steps).length ? `<p class="small cart-steps"><b>Où ils s'arrêtent :</b> ${Object.entries(steps).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${UI.esc(l)} <b>${n}</b>`).join(" · ")}</p>` : ""}
    <p class="muted small" style="margin:-4px 0 10px">🔔 ${nPush} client${nPush > 1 ? "s acceptent" : " accepte"} les notifications : leur panier laissé est relancé tout seul après 30 min (9 h – 22 h), même sans nom ni numéro.${mine.length ? ` · 🧪 ${mine.length} panier${mine.length > 1 ? "s" : ""} fait${mine.length > 1 ? "s" : ""} depuis votre téléphone (essais) : pas comptés.` : ""}</p>
    ${waitOpen.length ? `<div class="card cart-due">🔔 <b>${waitOpen.length} client${waitOpen.length > 1 ? "s" : ""} attend${waitOpen.length > 1 ? "ent" : ""} l'ouverture</b> : prévenus tout seuls par notification dès que c'est ouvert quand ils l'ont acceptée ; sinon ils ont laissé leur numéro : « 💬 Relancer » dès que vous ouvrez.</div>` : ""}
    ${nDue ? `<div class="card cart-due">⏰ <b>${nDue} panier${nDue > 1 ? "s" : ""} à relancer maintenant</b> : laissé${nDue > 1 ? "s" : ""} depuis plus d'1 h, avec un numéro. Un toucher sur « 💬 Relancer » : le message est prêt, avec le petit cadeau (−5 ₪ pour un client déjà livré, 1re course réduite pour un nouveau).</div>` : ""}
    <p class="muted small" style="margin:-8px 0 12px">Chaque client a son panier, gardé 7 jours sur son téléphone. Sans changement depuis 30 min et pas commandé : il est « abandonné ». « Relancer » ouvre WhatsApp avec un message prêt, dans sa langue. Le nom et le numéro apparaissent quand le client les a déjà donnés (compte ou commande précédente).</p>
    <div class="toolbar cart-filters">${Object.keys(CART_LBL).map(k => `<button type="button" class="btn btn-sm${k === cartsFilter ? " btn-primary" : ""}" data-cartf="${k}">${CART_LBL[k]} (${by(k).length})</button>`).join("")}
      <button type="button" class="btn btn-sm" data-cart-reload>↻</button>
      ${real.some(c => !c.client_phone) ? `<button type="button" class="btn btn-sm" data-cart-del-anon>🗑️ Supprimer les paniers sans numéro (${real.filter(c => !c.client_phone).length})</button>` : ""}</div>
    ${list.length ? `<div class="orders">${list.map(c => { const st = cartState(c); return `
      <article class="order cart-card cs-${st}">
        <div class="order-head"><span class="order-time">${UI.esc(c.client_name || "Client sans nom")}${c.lang === "he" ? " · 🇮🇱" : ""}</span><span class="pill">${CART_LBL[st]}</span>${due(c) ? `<span class="pill unpaid">⏰ À relancer</span>` : ""}${c.open_notice && st !== "commande" ? `<span class="pill unpaid">🔔 ${c.open_noticed_at ? "Prévenu de l'ouverture" : "Attend l'ouverture"}</span>` : ""}</div>
        <p class="muted small" style="margin:2px 0 8px">${c.shop_name ? "🏪 " + UI.esc(c.shop_name) + " · " : ""}${c.count} article(s)${Number(c.total) ? " · ≈ " + UI.money(Number(c.total)) : ""} · ${ago(c.updated_at)}${c.order_ref ? " · commande " + UI.esc(c.order_ref) : ""}${c.remind_count ? " · relancé " + c.remind_count + " fois" : ""}</p>
        <p class="small cart-meta">${st === "commande" ? "" : `Arrêté ${UI.esc(cartStepLbl(c))}`}${c.push_ok ? `${st === "commande" ? "" : " · "}🔔 notifications acceptées${c.push_reminded_at ? " · relancé par notification " + UI.esc(ago(c.push_reminded_at)) : ""}` : ""}</p>
        <ul class="cart-items">${(c.items || []).map(i => `<li><b>${i.q} ×</b> ${UI.esc(i.e ? i.e + " " : "")}${UI.esc(i.n)}${i.p ? ` <small>≈ ${UI.money(i.p * i.q)}</small>` : ""}</li>`).join("")}</ul>
        <div class="order-actions">${c.client_phone ? `<a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(c.client_phone, cartRelance(c)))}" target="_blank" rel="noopener" data-cart-relance="${UI.esc(c.device)}">💬 Relancer sur WhatsApp</a>
          <a class="btn btn-sm" href="tel:${UI.esc(c.client_phone)}">📞 ${UI.esc(c.client_phone)}</a>` : `<span class="muted small">Pas de numéro : le client n'a encore jamais commandé ni créé de compte.</span>`}
          <button type="button" class="btn btn-sm btn-link" data-cart-del="${UI.esc(c.device)}">🗑️ Supprimer</button></div>
      </article>`; }).join("")}</div>` : `<p class="muted">Aucun panier ici pour l'instant.</p>`}`;
}
document.addEventListener("click", e => {
  const f = e.target.closest("[data-cartf]");
  if (f) { cartsFilter = f.dataset.cartf; render(); return; }
  if (e.target.closest("[data-cart-reload]")) { loadCarts(); return; }
  // Supprimer : le panier sort de la liste (il revient seulement si le client remplit un nouveau panier)
  const del = e.target.closest("[data-cart-del]"), anon = e.target.closest("[data-cart-del-anon]");
  if (del || anon) {
    const list = del ? carts.filter(x => x.device === del.dataset.cartDel) : carts.filter(x => !x.client_phone && !x.boss);
    if (!list.length || !confirm(del ? "Supprimer ce panier de la liste ?" : `Supprimer les ${list.length} paniers sans numéro ?`)) return;
    list.forEach(c => Store.cartMark(c.device, { status: "vide" }).catch(() => null));
    carts = carts.filter(x => !list.includes(x));
    render();
    return;
  }
  const r = e.target.closest("[data-cart-relance]");
  if (r) {
    const c = carts.find(x => x.device === r.dataset.cartRelance);
    if (!c) return;
    const ch = { status: "relance", reminded_at: new Date().toISOString(), remind_count: (c.remind_count || 0) + 1 };
    Object.assign(c, ch);
    Store.cartMark(c.device, ch).catch(() => null);
    setTimeout(render, 300);
  }
});
async function loadClients() {
  clients = (await Store.adminClients().catch(() => null)) || clients;
  if (!carts.length) carts = (await Store.adminCarts().catch(() => null)) || carts;   // ceux qui ont laissé leurs coordonnées dans un panier
  if (tab === "clients") render();
}
// Adresses enregistrées dans le compte du client (Maison, Travail…) : rue, étage, appartement, code, et Waze
function clientAddrs(c) {
  const list = Array.isArray(c.addresses) ? c.addresses.filter(a => a && !a.brand && (a.street || a.lat != null)) : [];
  if (!list.length) return c.client_id ? `<div><span>🏠</span><span class="muted">Pas encore d'adresse enregistrée dans son compte</span></div>` : "";
  return list.map(a => {
    const tag = a.tag === "home" ? "Maison" : a.tag === "work" ? "Travail" : a.name || "Adresse";
    const det = [a.building ? "bât. " + a.building : "", a.floor ? "étage " + a.floor : "", a.apt ? "appt " + a.apt : "", a.code ? "code " + a.code : "", a.note || ""].filter(Boolean).join(" · ");
    const waze = a.lat != null ? `https://waze.com/ul?ll=${a.lat},${a.lon}&navigate=yes` : "";
    return `<div><span>${a.tag === "work" ? "💼" : a.tag === "home" ? "🏠" : "📍"}</span><span><b>${UI.esc(tag)}</b> : <bdi>${UI.esc([a.street, a.number].filter(Boolean).join(" "))}</bdi>${a.city ? ", " + UI.esc(UI.cityFr(a.cityId || a.city)) : ""}${det ? " · " + UI.esc(det) : ""}${waze ? ` · <a href="${UI.esc(waze)}" target="_blank" rel="noopener">🧭 Waze</a>` : ""}</span></div>`;
  }).join("");
}
function renderClients(view) {
  const q = clientsQ.trim().toLowerCase(), qd = q.replace(/\D/g, "");
  const withAcc = clients.filter(c => c.client_id);
  const month = today().slice(0, 7);
  // Ceux qui ont seulement écrit au service client (nom + téléphone), sans commander ni créer de compte : une fiche aussi
  const known = new Set(clients.map(c => String(c.phone || "").replace(/\D/g, "").slice(-9)).filter(Boolean));
  const writers = [];
  chatRecentList.forEach(m => {
    if (!String(m.thread).startsWith("u:") || m.author !== "client") return;
    const ph = (String(m.author_name || "").match(/0[\d\-\s]{8,}/) || [])[0], k = ph && ph.replace(/\D/g, "").slice(-9);
    if (!k || known.has(k)) return;
    known.add(k);
    writers.push({ name: String(m.author_name).split("·")[0].trim(), phone: ph.trim(), orders: 0, delivered: 0, spent: 0, writer: true, via: "msg" });
  });
  // … et ceux qui ont laissé nom + téléphone dans un panier, sans encore commander
  // (un client qui a déjà un compte ou des commandes : son panier en cours est joint à sa fiche)
  clients.forEach(c => { delete c.cart; });
  carts.forEach(ct => {
    const k = String(ct.client_phone || "").replace(/\D/g, "").slice(-9);
    if (k.length < 9) return;
    const w = writers.find(x => String(x.phone).replace(/\D/g, "").slice(-9) === k);
    if (w) { w.cart = ct; return; }
    if (known.has(k)) {
      const c = clients.find(x => String(x.phone || "").replace(/\D/g, "").slice(-9) === k);
      if (c && ct.status !== "commande" && ct.status !== "vide" && (!c.cart || String(ct.updated_at) > String(c.cart.updated_at))) c.cart = ct;
      return;
    }
    known.add(k);
    writers.push({ name: ct.client_name || "", phone: ct.client_phone, orders: 0, delivered: 0, spent: 0, writer: true, via: "cart", cart: ct, last_at: ct.updated_at });
  });
  const hid = hiddenClients(), keyOf = c => c.client_id || String(c.phone || "").replace(/\D/g, "").slice(-9);
  const allPeople = clients.concat(writers);
  const everyone = showHidden ? allPeople : allPeople.filter(c => !hid[keyOf(c)]);
  const nHid = allPeople.filter(c => hid[keyOf(c)]).length;
  const list = everyone.filter(c => (!onlyNew || c.writer) && (!q || String(c.name || "").toLowerCase().includes(q) || (qd && String(c.phone || "").replace(/\D/g, "").includes(qd))));
  const day = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
  // Client qui est aussi une enseigne (même numéro) : on le montre
  const d9 = v => String(v || "").replace(/\D/g, "").slice(-9);
  const shopOfClient = c => d9(c.phone) && shops.find(x => !x.demo && (d9(x.phone) === d9(c.phone) || d9(x.whatsapp) === d9(c.phone)));
  // Deux listes bien séparées : les enseignes (commerces qui envoient leurs courses) et les vrais clients
  const shopList = list.filter(c => shopOfClient(c)), clientList = list.filter(c => !shopOfClient(c));
  const realClients = everyone.filter(c => !shopOfClient(c));
  const sent = welcomeSent();
  const head = `
    <div class="stats">
      <div class="stat"><small>Comptes clients</small><b>${withAcc.length}</b></div>
      <div class="stat"><small>Nouveaux comptes ce mois</small><b>${withAcc.filter(c => String(c.account_at || "").startsWith(month)).length}</b></div>
      <div class="stat"><small>Clients au total</small><b>${realClients.length}</b></div>
      <div class="stat"><small>Inscrits sans commande</small><b>${everyone.filter(c => c.writer).length}</b></div>
      <div class="stat"><small>Clients sans compte</small><b>${realClients.filter(c => !c.client_id).length}</b></div>
      <div class="stat"><small>Commerces · livreurs actifs</small><b>${shops.filter(x => !x.demo && x.status === "actif").length} · ${couriers.filter(c => c.role !== "admin" && c.status === "actif").length}</b></div>
    </div>
    <p class="muted small" style="margin:-8px 0 12px">Un client crée son compte dans l'appli (« Mes courses ») avec son téléphone et un mot de passe : accepté tout de suite, sans e-mail de confirmation pour l'instant. Les clients sans compte apparaissent ici d'après leur numéro de téléphone.</p>
    ${(() => { // Note intelligente : ceux qui ont laissé nom + téléphone sans commander ni créer de compte
      const w = everyone.filter(c => c.writer), withCart = w.filter(c => c.cart && c.cart.count).length;
      if (!w.length && !onlyNew) return "";
      return `<div class="notice cli-note"><b>📝 ${w.length} inscrit${w.length > 1 ? "s" : ""} n'${w.length > 1 ? "ont" : "a"} pas encore commandé ni créé de compte</b>
        <span class="small">${withCart ? `${withCart} avec un panier en attente. ` : ""}Ils ont laissé leur nom et leur téléphone (panier ou service client) : un WhatsApp « Comment commander » ou une relance du panier, et ils passent souvent leur 1re commande.</span>
        <button type="button" class="btn btn-sm${onlyNew ? " btn-primary" : ""}" data-cli-onlynew>${onlyNew ? "Voir tous les clients" : (w.length > 1 ? `📝 Voir seulement ces ${w.length} inscrits` : "📝 Voir seulement cet inscrit")}</button></div>`;
    })()}
    <div class="toolbar"><input id="clientsQ" type="search" placeholder="Rechercher un client (nom ou téléphone)" value="${UI.esc(clientsQ)}" />
      ${nHid ? `<button type="button" class="btn btn-sm" data-cli-showhid>${showHidden ? "Cacher les retirés" : `🗑️ Voir les retirés (${nHid})`}</button>` : ""}</div>`;
  const fold = c => { const k = "u:" + (c.client_id || d9(c.phone)), sh = shopOfClient(c);
      // Ses vraies courses (les plus récentes d'abord), en fiche complète comme dans l'onglet Courses
      const mine = orders.filter(o => (d9(o.contact_phone) && d9(o.contact_phone) === d9(c.phone)) || (sh && o.shop_id === sh.id && o.shop_sent))
        .sort((a, b) => String(b.created_at || b.pickup_at).localeCompare(String(a.created_at || a.pickup_at))).slice(0, 15);
      return `
      <details class="order-fold shop-fold" data-fold="${UI.esc(k)}"${foldOpen(k)}><summary>
        <span>${sh ? "🏪" : c.client_id ? "👤" : c.writer ? "📝" : "📞"} <b>${UI.esc(c.name || "—")}</b>${sh && sh.name !== c.name ? " · 🏪 " + UI.esc(sh.name) : ""}${c.blocked ? " · ⛔" : ""}</span>
        <b>${Number(c.delivered || 0)} 📦</b></summary>
      <article class="order" data-client="${UI.esc(c.client_id || "")}">
        <div class="order-head">
          <span class="order-time">${UI.esc(c.name || "—")}</span>
          ${sh ? `<span class="pill paid">🏪 Commerce partenaire</span>` : `<span class="pill${c.client_id ? " paid" : ""}">${c.client_id ? "👤 Compte client" : c.writer ? "📝 Inscrit, pas encore commandé" : "📞 Sans compte client"}</span>`}
          ${c.blocked ? `<span class="pill" style="background:#FDE2E2;color:#9B1C1C">⛔ Bloqué</span>` : ""}
          <span class="order-price">${Number(c.delivered || 0)} livrée(s)</span>
        </div>
        <p class="small muted" style="margin:6px 0 2px">${sh ? "Un commerce n'a pas besoin de compte client : il envoie ses courses depuis son espace commerce (« Envoyer une course »)." : c.client_id ? "" : c.writer ? (c.via === "cart" ? "Inscrit avec son nom et son téléphone (laissés dans son panier), pas encore de commande : relancez-le ou envoyez-lui « Comment commander »." : "Inscrit avec son nom et son téléphone (au service client), pas encore de commande : envoyez-lui « Comment commander ».") : "Il commande avec son numéro de téléphone, sans avoir créé de compte (c'est permis)."}</p>
        <div class="kv">
          <div><span>📞</span><span>${tel(c.name, c.phone)}${c.email ? " · " + UI.esc(c.email) + (c.email_verified ? " ✅" : " (à vérifier)") : ""}</span></div>
          <div><span>📦</span><span>${Number(c.orders || 0)} commande(s) · ${UI.money(Number(c.spent || 0))} livrés${c.city ? " · " + UI.esc(UI.cityFr(c.city)) : ""}</span></div>
          <div><span>📅</span><span>${c.client_id ? "Compte créé le " + day(c.account_at) + " · " : ""}dernière commande : ${c.orders ? day(c.last_at) + (c.last_at ? " à " + UI.fmtTime(c.last_at) : "") : "—"}</span></div>
          ${clientAddrs(c)}
          ${c.cart && c.cart.count ? `<div><span>🛒</span><span>Panier non commandé (${UI.esc(UI.fmtDateTime(c.cart.updated_at))}) : ${UI.esc((c.cart.items || []).map(i => i.q + " × " + i.n).join(", ").slice(0, 160))}</span></div>` : ""}
        </div>
        ${mine.length ? `<details class="client-orders" data-fold="co:${UI.esc(k)}"${foldOpen("co:" + k)}><summary>📋 Voir le détail de ses courses (${mine.length}${Number(c.orders || 0) > mine.length ? " dernières" : ""})</summary>
          <div class="orders">${mine.map(o => card(o, true)).join("")}</div></details>` : ""}
        ${(() => { // Ses messages au service client (reconnus à son numéro), joints à sa fiche
          const ths = msgThreadsOf(c.phone);
          return ths.length ? `<div class="client-msgs">${ths.map(x => `<div class="cm-row"><span class="small muted">💬 ${UI.esc(UI.fmtDateTime(x.last.created_at))} · ${x.last.author === "admin" ? "Vous : " : ""}${UI.esc(String(x.last.body || "📷 Photo").slice(0, 90))}</span>
            ${chatBtn(x.thread, "💬 Client : " + (x.name || c.name || ""), c.phone || "", `💬 Ouvrir ses messages (${x.n})`)}</div>`).join("")}</div>` : "";
        })()}
        <div class="actions">
          ${!sh ? howBtn(c.phone, c.name) : ""}
          ${!sh && !c.client_id && c.phone ? `<a class="btn btn-sm${sent[d9(c.phone)] ? "" : " btn-wa"}" data-welcome="${UI.esc(d9(c.phone))}" href="${UI.esc(UI.waPersonal(c.phone, welcomeText(c)))}" target="_blank" rel="noopener" title="Message tout prêt dans WhatsApp (français + hébreu) : il suffit d'appuyer sur Envoyer">🟢 ${sent[d9(c.phone)] ? "Renvoyer « Bienvenue, créez votre compte »" : "WhatsApp : « Bienvenue, créez votre compte »"}</a>` : ""}
          ${c.client_id ? `<button class="btn btn-sm" data-client-reset="${UI.esc(c.client_id)}" data-cname="${UI.esc(c.name || "")}">🔑 Nouveau mot de passe</button>` : ""}
          ${c.blocked ? `<button class="btn btn-sm" data-unblock="${UI.esc(c.phone)}">🔓 Débloquer</button>` : ""}
          ${hid[keyOf(c)] ? `<button type="button" class="btn btn-sm" data-cli-hide="${UI.esc(keyOf(c))}" data-undo="1">↩️ Remettre dans la liste</button>`
            : `<button type="button" class="btn btn-sm btn-link" data-cli-hide="${UI.esc(keyOf(c))}">🗑️ Supprimer de la liste</button>`}
        </div>
      </article></details>`; };
  view.innerHTML = head + (list.length ? `
    <h3 class="cli-sec">👤 Clients <small>${clientList.length} · ceux qui commandent eux-mêmes dans l'appli</small></h3>
    ${clientList.length ? `<div class="orders">${clientList.map(fold).join("")}</div>` : `<div class="empty card">Aucun client ne correspond.</div>`}
    <h3 class="cli-sec">🏪 Enseignes <small>${shopList.length} · commerces partenaires qui envoient leurs courses depuis leur espace</small></h3>
    ${shopList.length ? `<div class="orders">${shopList.map(fold).join("")}</div>` : `<div class="empty card">Aucune enseigne n'a encore envoyé de course.</div>`}`
    : `<div class="empty card">${clients.length ? "Aucun client ne correspond." : "Aucun client pour l'instant."}</div>`);
}
// Clients retirés de la liste par le patron (ses courses restent dans l'historique et la compta)
const HID_CLI = "livraison.hiddenClients.v1";
let showHidden = false, onlyNew = false;
const hiddenClients = () => { try { return JSON.parse(localStorage.getItem(HID_CLI)) || {}; } catch (e) { return {}; } };
document.addEventListener("click", e => {
  if (e.target.closest("[data-cli-showhid]")) { showHidden = !showHidden; render(); return; }
  if (e.target.closest("[data-cli-onlynew]")) { onlyNew = !onlyNew; render(); return; }
  const b = e.target.closest("[data-cli-hide]");
  if (!b) return;
  const h = hiddenClients(), k = b.dataset.cliHide;
  if (b.dataset.undo) delete h[k];
  else { if (!confirm("Supprimer ce client de la liste ?\n\nSes courses restent dans l'historique et la compta. Vous pourrez le remettre avec « Voir les retirés ».")) return; h[k] = new Date().toISOString(); }
  try { localStorage.setItem(HID_CLI, JSON.stringify(h)); } catch (ex) { /* ignore */ }
  render();
});
// « Bienvenue chez HOP! » : message WhatsApp tout prêt pour un client qui a commandé sans créer de compte
const WELCOME_SENT = "livraison.welcomeSent.v1";
const welcomeSent = () => { try { return JSON.parse(localStorage.getItem(WELCOME_SENT)) || {}; } catch (e) { return {}; } };
function markWelcome(k) { try { localStorage.setItem(WELCOME_SENT, JSON.stringify(Object.assign(welcomeSent(), { [k]: new Date().toISOString() }))); } catch (e) { /* ignore */ } }
function welcomeText(c) {
  const first = String(c.name || "").trim().split(/\s+/)[0] || "";
  const link = UI.appUrl("app/") + "#mes-courses";
  return `Bonjour${first ? " " + first : ""} 😊 Merci pour votre commande avec HOP! 🛵\n`
    + `Pour commander encore plus vite la prochaine fois (vos adresses enregistrées, le suivi de vos courses), créez votre compte en 30 secondes, avec votre téléphone : ${link}\n`
    + `Bienvenue chez HOP! 🧡\n\n`
    + `שלום${first ? " " + first : ""} 😊 תודה על ההזמנה ב-HOP! 🛵\n`
    + `כדי להזמין עוד יותר מהר בפעם הבאה (כתובות שמורות, מעקב אחרי המשלוחים), פתחו חשבון ב-30 שניות עם הטלפון שלכם: ${link}\n`
    + `ברוכים הבאים ל-HOP! 🧡`;
}
document.addEventListener("click", e => { const a = e.target.closest("[data-welcome]"); if (a) { markWelcome(a.dataset.welcome); setTimeout(render, 400); } });
// Fils du service client d'un numéro (le client écrit avec « nom · téléphone ») : pour les joindre à sa fiche
function msgThreadsOf(phone) {
  const k = String(phone || "").replace(/\D/g, "").slice(-9);
  if (k.length < 9) return [];
  const by = {};
  chatRecentList.forEach(m => { if (String(m.thread).startsWith("u:")) (by[m.thread] = by[m.thread] || []).push(m); });
  return Object.entries(by).filter(([, ms]) => ms.some(m => m.author === "client" && String(m.author_name || "").replace(/\D/g, "").endsWith(k)))
    .map(([thread, ms]) => { ms.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); const who = ms.find(m => m.author === "client" && m.author_name);
      return { thread, last: ms[0], n: ms.length, name: who ? String(who.author_name).split("·")[0].trim() : "" }; });
}
// « Comment commander » : présentation + mode d'emploi, français + hébreu, tout prêt dans WhatsApp (client bloqué, nouveau client…)
function howText(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const link = UI.appUrl("app/");
  return `Bonjour${first ? " " + first : ""} 😊 Bienvenue chez HOP! 🛵\n`
    + `HOP!, c'est la livraison à Netanya : vos restos, vos courses (supermarché, makolet, pharmacie), vos colis, vos clés oubliées… on vous livre tout, au plus vite.\n\n`
    + `Pour commander, ça prend une minute : ${link}\n`
    + `1️⃣ Choisissez ce qu'on vous livre (repas, courses, colis…)\n`
    + `2️⃣ L'adresse de départ et la vôtre\n`
    + `3️⃣ Touchez « Commander » ✅\n`
    + `Pour des courses : « J'achète pour vous », écrivez votre liste, on achète et on vous livre.\n`
    + `Livraison dès 25 ₪ dans Netanya, 0 frais de service. Un souci ? Répondez ici, on vous aide 🧡\n\n`
    + `שלום${first ? " " + first : ""} 😊 ברוכים הבאים ל-HOP! 🛵\n`
    + `HOP! זה משלוחים בנתניה: מסעדות, קניות (סופר, מכולת, בית מרקחת), חבילות, מפתחות ששכחתם… אנחנו מביאים הכול, הכי מהר שאפשר.\n\n`
    + `להזמנה, זה לוקח דקה: ${link}\n`
    + `1️⃣ בוחרים מה להביא (אוכל, קניות, חבילה…)\n`
    + `2️⃣ כתובת האיסוף והכתובת שלכם\n`
    + `3️⃣ לוחצים «להזמין» ✅\n`
    + `לקניות: «קונים בשבילכם», כותבים את הרשימה, ואנחנו קונים ומביאים.\n`
    + `משלוח החל מ-25 ₪ בנתניה, בלי דמי שירות. משהו לא מסתדר? עונים כאן ואנחנו עוזרים 🧡`;
}
const howBtn = (phone, name) => phone ? `<a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(phone, howText(name)))}" target="_blank" rel="noopener" title="Présentation de HOP! et comment commander (français + hébreu), prêt dans WhatsApp">📲 WhatsApp : « Comment commander »</a>` : "";

// --- Demandes de devis (tournée quotidienne, carnet…) -------------------------------------
function renderRequests(view) {
  const topic = { tournee: "🗓️ Tournée quotidienne", carnet: "🎟️ Carnet de courses", autre: "📝 Autre besoin" };
  const list = requests.slice().sort((a, b) => (a.status === "nouvelle" ? 0 : 1) - (b.status === "nouvelle" ? 0 : 1));
  view.innerHTML = list.length ? `<div class="orders">${list.map(r => `
    <article class="order${r.status === "nouvelle" ? " is-new" : ""}" data-req="${UI.esc(r.id)}">
      <div class="order-head">
        <span class="order-time">${UI.esc(r.company || r.name)}</span>
        <span class="pill">${r.kind === "pro" ? "🏢 Pro" : "🏠 Particulier"}</span>
        <span class="pill">${topic[r.topic] || r.topic}</span>
        <span class="order-ref">${UI.esc(UI.fmtDateTime(r.created_at))}</span>
      </div>
      <div class="kv">
        <div><span>👤</span><span>${tel(r.name, r.phone)}${r.city ? " · " + UI.esc(UI.cityFr(r.city)) : ""} · ${r.lang === "he" ? "🇮🇱 hébreu" : "🇫🇷 français"}</span></div>
        ${r.frequency ? `<div><span>🔁</span><span>${UI.esc(r.frequency)}</span></div>` : ""}
        ${r.message ? `<div><span>📝</span><span>${UI.esc(r.message)}</span></div>` : ""}
      </div>
      <div class="actions">
        ${r.device_id ? chatBtn("u:" + r.device_id, `${r.company || r.name}`, `${r.name} · ${r.phone}`, "💬 Répondre", r.lang === "he" ? `שלום ${r.name}, קיבלנו את הבקשה שלכם ב${CONFIG.businessNameHe}. ` : `Bonjour ${r.name}, merci pour votre demande chez ${CONFIG.businessName}. `)
          : `<a class="btn btn-sm" href="tel:${UI.esc(r.phone)}">📞 Rappeler</a>`}
        ${r.status === "nouvelle" ? `<button class="btn btn-sm btn-primary" data-ract="traitee">✓ Traitée</button>` : `<button class="btn btn-sm" data-ract="nouvelle">↩︎ À traiter</button>`}
        <textarea class="admin-note" data-ract="note" rows="1" placeholder="Note (prix proposé, suite…)">${UI.esc(r.admin_note || "")}</textarea>
      </div>
    </article>`).join("")}</div>` : `<div class="empty card">Aucune demande pour l'instant. Les clients et les commerces demandent un devis depuis l'application (bouton « Demander un devis »).</div>`;
}

// --- Messages aux livreurs --------------------------------------------------------------
// Messages tout prêts pour les clients (français + hébreu)
const CLIENT_TPL = [
  "🛵 HOP! livre ce soir dans tout Netanya : commandez en 1 minute ! · הופ! מוביל הערב בכל נתניה: מזמינים בדקה!",
  "🍔 Un petit creux ? Commandez au restaurant, on vous l'apporte vite. · רעבים? הזמינו מהמסעדה ואנחנו נביא מהר.",
  "🙏 Merci d'être client HOP! Votre avis compte : répondez-nous ici. · תודה שאתם לקוחות הופ! נשמח לשמוע מכם כאן."
];
function clientCount(days) {
  const since = Date.now() - days * 86400000;
  return new Set(orders.filter(o => o.device_id && new Date(o.created_at) > since).map(o => o.device_id)).size;
}
// Visuels du kit pub proposés pour les pubs de l'appli (format story, FR et HE)
const KIT_PROMO_IMGS = [
  ["🏪 Votre commerce n'est pas encore sur HOP! ?", "kit/visuels/pas-encore-post-fr.png", "kit/visuels/pas-encore-post-he.png"],
  ["🦘 Hoppy : votre resto préféré ?", "kit/visuels/hoppy-resto-post-fr.png", "kit/visuels/hoppy-resto-post-he.png"],
  ["🦘 Hoppy : vos courses sont prêtes ?", "kit/visuels/hoppy-sacs-post-fr.png", "kit/visuels/hoppy-sacs-post-he.png"],
  ["🦘 Hoppy : colis, médicaments, petites courses", "kit/visuels/hoppy-porte-post-fr.png", "kit/visuels/hoppy-porte-post-he.png"],
  ["🦘 Hoppy : repéré en boutique ?", "kit/visuels/hoppy-boutique-post-fr.png", "kit/visuels/hoppy-boutique-post-he.png"],
  ["🦘 Hoppy : une envie ? Et hop !", "kit/visuels/hoppy-envie-post-fr.png", "kit/visuels/hoppy-envie-post-he.png"],
  ["🦘 Hoppy : de votre téléphone à votre porte", "kit/visuels/hoppy-telephone-post-fr.png", "kit/visuels/hoppy-telephone-post-he.png"],
  ["🦘 Hoppy : vous pensez à quoi ?", "kit/visuels/hoppy-pensez-post-fr.png", "kit/visuels/hoppy-pensez-post-he.png"],
  ["🦘 Hoppy : première course à 15 ₪", "kit/visuels/client-post-fr.png", "kit/visuels/client-post-he.png"],
  ["🦘 Hoppy : nouveaux commerces chaque semaine", "kit/visuels/visite-post-fr.png", "kit/visuels/visite-post-he.png"],
  ["🦘 Hoppy : vos hallot pour Chabbat", "kit/visuels/halot-post-fr.png", "kit/visuels/halot-post-he.png"],
  ["🦘 Hoppy : vous demandez, on livre", "kit/visuels/courses-post-fr.png", "kit/visuels/courses-post-he.png"],
  ["🦘 Hoppy : Le Marché Français chez vous", "kit/visuels/partenaire-marchefr-post-fr.png", "kit/visuels/partenaire-marchefr-post-he.png"],
  ["🦘 Hoppy : la table de Chabbat", "kit/visuels/table-post-fr.png", "kit/visuels/table-post-he.png"],
  ["🦘 Hoppy : courses avant Chabbat", "kit/visuels/chabbat-post-fr.png", "kit/visuels/chabbat-post-he.png"],
  ["🦘 Hoppy : on livre aussi vos fleurs", "kit/visuels/hoppy-fleurs-post-fr.png", "kit/visuels/hoppy-fleurs-post-he.png"],
  ["🦘 Hoppy : vos magasins préférés", "kit/visuels/hoppy-magasins-post-fr.png", "kit/visuels/hoppy-magasins-post-he.png"],
  ["Toutes vos courses (story)", "kit/visuels/courses-story-fr.png", "kit/visuels/courses-story-he.png"],
  ["Nouveaux partenaires (story)", "kit/visuels/nouveaux-story-fr.png", "kit/visuels/nouveaux-story-he.png"],
  ["Nouveaux partenaires (carré)", "kit/visuels/nouveaux-post-fr.png", "kit/visuels/nouveaux-post-he.png"],
  ["Clients : première course (story)", "kit/visuels/client-story-fr.png", "kit/visuels/client-story-he.png"]
];
const PROMO_CTA = { "": "Pas de bouton", order: "🛵 Commander maintenant", pro: "🍽️ Voir les commerces", shop: "🍽️ La carte d'un commerce", url: "🔗 Un lien" };
const ctaLabel = c => !c ? PROMO_CTA[""] : c.startsWith("shop:") ? `🍽️ ${((shops.find(x => x.code === c.slice(5)) || {}).name || c.slice(5))}` : c.startsWith("url:") ? "🔗 " + c.slice(4) : PROMO_CTA[c] || c;
function promoCard() {
  if (!promos) {
    Store.adminPromos().then(r => { promos = r || []; if (tab === "messages") render(); }, () => { promos = []; });
    return `<div class="card"><b>📱 Pubs à l'ouverture de l'appli client</b><p class="muted small">Chargement…</p></div>`;
  }
  const on = promos.filter(p => p.active).length;
  const f = promoForm, kitSel = KIT_PROMO_IMGS.findIndex(k => k[1] === f.img);
  return `<div class="card" id="promoCard">
    <b>📱 Pubs à l'ouverture de l'appli client</b>
    <p class="muted small" style="margin:4px 0 10px">À chaque ouverture de l'appli, le client voit une pub en grand, puis la suivante la fois d'après (à tour de rôle). ${on ? `<b>${on} pub(s) active(s)</b>.` : "<b>Aucune pub active</b> : l'appli s'ouvre directement."} Activez, coupez ou changez l'ordre quand vous voulez : c'est immédiat.</p>
    ${promos.length ? `<div class="promo-list">${promos.map((p, i) => `<div class="promo-row-a${p.active ? " on" : ""}" data-promo="${UI.esc(p.id)}">
        <img src="${UI.esc(p.image_fr)}" alt="" data-promo-act="view" />
        <div class="pr-txt"><b>${UI.esc(p.title)}</b><small>${UI.esc(ctaLabel(p.cta))}${p.image_he ? " · FR + HE" : " · FR seulement"}</small></div>
        <div class="pr-btns">
          <button type="button" class="btn btn-sm${p.active ? " btn-primary" : ""}" data-promo-act="toggle">${p.active ? "🟢 Active" : "⚪ Coupée"}</button>
          <button type="button" class="btn btn-sm" data-promo-act="up" ${i ? "" : "disabled"} title="Plus tôt">↑</button>
          <button type="button" class="btn btn-sm" data-promo-act="down" ${i < promos.length - 1 ? "" : "disabled"} title="Plus tard">↓</button>
          <button type="button" class="btn btn-sm" data-promo-act="del" title="Supprimer">🗑</button>
        </div></div>`).join("")}</div>` : `<p class="muted small">Aucune pub pour l'instant.</p>`}
    ${f.open ? `<div class="promo-form">
      <label class="f"><span>Titre (pour vous)</span><input id="pfTitle" maxlength="80" placeholder="ex. Soirée sushis -10 %" /></label>
      <div class="f"><span>Visuel : touchez l'image choisie</span>
        <div class="pf-grid">${KIT_PROMO_IMGS.map((k, j) => `<button type="button" class="pf-tile${j === kitSel ? " on" : ""}" data-pf-kit="${j}"><img src="${UI.esc(k[1])}" alt="" loading="lazy" /><small>${UI.esc(k[0])}</small></button>`).join("")}
          <button type="button" class="pf-tile pf-own-tile${kitSel < 0 ? " on" : ""}" data-pf-kit="own"><span>📷</span><small>Ma propre image…</small></button></div></div>
      ${kitSel < 0 ? `<div class="pf-own"><label class="btn btn-sm">📷 Image en français<input type="file" accept="image/*" id="pfOwn" hidden /></label> ${f.own ? "✅" : ""}
        <label class="btn btn-sm">📷 Image en hébreu (facultatif)<input type="file" accept="image/*" id="pfOwnHe" hidden /></label> ${f.ownHe ? "✅" : ""}
        <small class="muted">Format conseillé : portrait (1080 × 1350, comme Instagram) ou story (1080 × 1920).</small></div>` : `<img class="pf-prev" src="${UI.esc(f.img)}" alt="" />`}
      <label class="f"><span>Bouton sous la pub</span><select id="pfCta">${Object.entries(PROMO_CTA).map(([k, l]) => `<option value="${k}">${UI.esc(l)}</option>`).join("")}</select></label>
      <label class="f hidden" id="pfShopRow"><span>Quel commerce ?</span><select id="pfShop">${shops.filter(x => x.status === "actif" && !x.demo).map(x => `<option value="${UI.esc(x.code)}">${UI.esc(x.name)}</option>`).join("")}</select></label>
      <label class="f hidden" id="pfUrlRow"><span>Lien (https://…)</span><input id="pfUrl" placeholder="https://" /></label>
      <label class="small"><input type="checkbox" id="pfActive" checked /> L'activer tout de suite</label>
      <div class="promo-row"><button type="button" class="btn btn-primary" data-promo-act="save">💾 Ajouter la pub</button><button type="button" class="btn" data-promo-act="cancel">Annuler</button></div>
    </div>` : `<button type="button" class="btn btn-sm" data-promo-act="new" style="margin-top:10px">➕ Nouvelle pub</button>`}
  </div>`;
}
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "pfKit") {
    if (t.value === "own") { promoForm.img = null; promoForm.imgHe = null; }
    else { const k = KIT_PROMO_IMGS[Number(t.value)]; promoForm.img = k[1]; promoForm.imgHe = k[2]; }
    const keep = { title: $("#pfTitle").value };
    render(); $("#pfTitle").value = keep.title;
  } else if (t.id === "pfCta") {
    $("#pfShopRow").classList.toggle("hidden", t.value !== "shop");
    $("#pfUrlRow").classList.toggle("hidden", t.value !== "url");
  } else if (t.id === "pfOwn" || t.id === "pfOwnHe") {
    const file = t.files && t.files[0];
    if (!file) return;
    try {
      const data = await UI.docPhoto(file);
      promoForm[t.id === "pfOwn" ? "own" : "ownHe"] = data;
      const keep = { title: $("#pfTitle").value };
      render(); $("#pfTitle").value = keep.title;
    } catch (ex) { alert("Image illisible ou trop lourde."); }
  }
});
// Choix du visuel d'une pub : vignettes (on voit l'image avant de choisir)
document.addEventListener("click", e => {
  const b = e.target.closest("[data-pf-kit]");
  if (!b) return;
  const v = b.dataset.pfKit, titleEl = $("#pfTitle");
  let title = titleEl ? titleEl.value : "";
  if (v === "own") { promoForm.img = null; promoForm.imgHe = null; }
  else {
    const k = KIT_PROMO_IMGS[Number(v)]; promoForm.img = k[1]; promoForm.imgHe = k[2];
    if (!title.trim()) title = k[0].replace(/^🦘\s*Hoppy\s*:\s*/, "").replace(/\s*\((story|carré)\)$/, "");
  }
  render(); if ($("#pfTitle")) $("#pfTitle").value = title;
  const pv = document.querySelector(".pf-prev"); if (pv) pv.scrollIntoView({ block: "nearest", behavior: "smooth" });
});
// Lien de bienvenue au nouveau client : WhatsApp s'ouvre, l'envoi est noté sur la course
document.addEventListener("click", e => {
  const a = e.target.closest("[data-welcome-wa]");
  if (!a) return;
  const id = a.dataset.welcomeWa;
  setTimeout(async () => { try { await Store.orderWelcomeSent(id); const o = orders.find(x => x.id === id); if (o) o.welcome_sent_at = new Date().toISOString(); render(); } catch (ex) { /* noté au prochain toucher */ } }, 400);
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-promo-act]");
  if (!b) return;
  const act = b.dataset.promoAct, row = b.closest("[data-promo]"), p = row && promos.find(x => x.id === row.dataset.promo);
  const save = async (x, done) => { try { await Store.promoSave(x); promos = await Store.adminPromos(); if (done) done(); render(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); } };
  if (act === "new") { promoForm.open = true; return render(); }
  if (act === "cancel") { Object.assign(promoForm, { open: false, own: null, ownHe: null }); return render(); }
  if (act === "view" && p) return UI.photoViewer(p.title, [{ label: "FR", src: p.image_fr }].concat(p.image_he ? [{ label: "HE", src: p.image_he }] : []));
  if (act === "toggle" && p) return save(Object.assign({}, p, { active: !p.active }));
  if ((act === "up" || act === "down") && p) {
    // Nouvel ordre : on échange avec la voisine et on renumérote tout (1, 2, 3…)
    const list = promos.slice(), i = list.indexOf(p), j = act === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try { for (const [k, x] of list.entries()) if (x.position !== k + 1) await Store.promoSave(Object.assign({}, x, { position: k + 1 })); promos = await Store.adminPromos(); render(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (act === "del" && p) {
    if (!confirm(`Supprimer la pub « ${p.title} » ? (Pour l'arrêter seulement, touchez plutôt « 🟢 Active ».)`)) return;
    try { await Store.promoDelete(p.id); promos = await Store.adminPromos(); render(); } catch (ex) { alert("Non supprimée, vérifiez la connexion."); }
    return;
  }
  if (act === "save") {
    const title = $("#pfTitle").value.trim(), kind = $("#pfCta").value;
    const img = promoForm.img || promoForm.own, imgHe = promoForm.img ? promoForm.imgHe : promoForm.ownHe;
    if (!title) return alert("Donnez un titre à la pub (pour vous la retrouver).");
    if (!img) return alert("Choisissez un visuel du kit ou ajoutez votre image.");
    let cta = kind || null;
    if (kind === "shop") cta = "shop:" + $("#pfShop").value;
    if (kind === "url") { const u = $("#pfUrl").value.trim(); if (!/^https:\/\/\S{4,250}$/.test(u)) return alert("Le lien doit commencer par https://"); cta = "url:" + u; }
    const position = promos.reduce((m, x) => Math.max(m, x.position || 0), 0) + 1;
    return save({ title, image_fr: img, image_he: imgHe || null, cta, active: $("#pfActive").checked, position },
      () => Object.assign(promoForm, { open: false, own: null, ownHe: null }));
  }
});

function renderMessages(view) {
  const cliTyped = $("#cliText") ? $("#cliText").value : "";
  const act = partners().filter(c => c.status === "actif");
  const onDuty = act.filter(c => c.position_at && Date.now() - new Date(c.position_at) < 10 * 60000);
  const name = id => (couriers.find(c => c.id === id) || {}).name || "?";
  const typed = $("#msgText") ? $("#msgText").value : "";
  view.innerHTML = `${promoCard()}
    <div class="card" style="margin-top:14px">
      <b>📣 Prévenir vos livreurs</b>
      <p class="muted small" style="margin:4px 0 10px">Le message s'ouvre en grand sur leur téléphone, avec un son, et ils répondent « J'arrive » ou « Pas dispo ». ${act.length} livreur(s) actif(s), ${onDuty.length} en ligne en ce moment${onDuty.length ? " : " + onDuty.map(c => UI.esc(c.name)).join(", ") : ""}.</p>
      <div class="tpl-list">${CONFIG.courierMessages.map((m, i) => `<button class="addr-chip" data-tpl="${i}">${UI.esc(m.text)}</button>`).join("")}</div>
      <textarea id="msgText" rows="3" placeholder="Votre message…" style="width:100%;margin-top:10px">${UI.esc(typed)}</textarea>
      <div class="promo-row" style="margin-top:8px">
        <select id="msgTo"><option value="">À tous les livreurs actifs</option>${act.map(c => `<option value="${UI.esc(c.id)}">À ${UI.esc(c.name)} seulement</option>`).join("")}</select>
        <button class="btn btn-primary" id="msgSend">📣 Envoyer</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <b>🎁 Message aux clients (promo, annonce)</b>
      <p class="muted small" style="margin:4px 0 10px">Il arrive dans la conversation « service client » de chaque client (pastille sur la bulle 💬 de l'appli). Écrivez en français et en hébreu.</p>
      <div class="tpl-list">${CLIENT_TPL.map((m, i) => `<button class="addr-chip" data-ctpl="${i}">${UI.esc(m)}</button>`).join("")}</div>
      <textarea id="cliText" rows="3" placeholder="Votre message aux clients…" style="width:100%;margin-top:10px">${UI.esc(cliTyped)}</textarea>
      <div class="promo-row" style="margin-top:8px">
        <select id="cliDays">${[[30, "1 mois"], [90, "3 mois"], [365, "1 an"]].map(([d, l]) => `<option value="${d}">Clients des ${l} (${clientCount(d)})</option>`).join("")}</select>
        <button class="btn btn-primary" id="cliSend">🎁 Envoyer aux clients</button>
      </div>
    </div>
    <h3 style="margin:18px 0 8px">Derniers messages (48 h)</h3>
    ${msgs.messages.length ? `<div class="orders">${msgs.messages.map(m => {
      const r = msgs.replies.filter(x => x.message_id === m.id);
      const yes = r.filter(x => x.answer === "jarrive").map(x => UI.esc(name(x.courier_id)));
      const no = r.filter(x => x.answer === "pas_dispo").map(x => UI.esc(name(x.courier_id)));
      return `<article class="order"><div class="order-head"><span class="order-time">${UI.esc(UI.fmtDateTime(m.created_at))}</span><span class="pill">${m.to_courier ? "👤 " + UI.esc(name(m.to_courier)) : "👥 Tous"}</span></div>
        <p style="margin:8px 0"><b>${UI.esc(m.body)}</b></p>
        <div class="meta"><span class="pill paid">🛵 J'arrive : ${yes.length ? yes.join(", ") : "personne pour l'instant"}</span>${no.length ? `<span class="pill">😴 Pas dispo : ${no.join(", ")}</span>` : ""}</div></article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun message envoyé ces dernières 48 h.</div>`}`;
}

// --- Facturation clients -------------------------------------------------------------
function monthOrders() {
  return orders.filter(o => o.status === "livree" && !o.is_test && UI.dayKey(o.pickup_at).startsWith(billMonth));
}

function renderBilling(view) {
  const list = monthOrders();
  const byClient = {};
  list.forEach(o => {
    const key = o.company || o.contact_name;
    const c = byClient[key] = byClient[key] || { n: 0, total: 0, unpaid: 0, phone: o.contact_phone, device: o.device_id };
    c.n++; c.total += Number(o.price);
    if (o.payment_status !== "paye") c.unpaid += Number(o.price);
  });
  const rows = Object.entries(byClient).sort((a, b) => b[1].total - a[1].total);
  const bit = sum(list.filter(o => o.payment_method === "bit")), cash = sum(list.filter(o => o.payment_method === "cash"));
  const r = monthRecap();
  view.innerHTML = `<div class="toolbar">
      <label class="small muted">Mois <input type="month" id="billMonth" value="${billMonth}" /></label>
      <span class="small muted">💵 Espèces ${UI.money(cash)} · 📱 Bit ${UI.money(bit)} (toutes courses, livreurs compris)</span>
    </div>
    <div class="card compta-box">
      <h3>📒 Pour la comptable · ${UI.esc(monthName(billMonth))}</h3>
      <p class="small muted">Deux documents à lui envoyer chaque mois (WhatsApp ou e-mail) : le récapitulatif (PDF) et le détail de toutes les courses (Excel).</p>
      <div class="compta-grid">
        <div><small>Courses livrées</small><b>${r.n}</b></div>
        <div><small>Total des courses</small><b>${UI.money(r.gross)}</b></div>
        <div><small>Gagné par HOP!</small><b>${UI.money(r.hop)}</b></div>
        <div><small>Abonnements Pro</small><b>${UI.money(r.plans)}</b></div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="recapBtn" ${r.n || r.plans ? "" : "disabled"}>📄 Récapitulatif du mois (PDF)</button>
        <button class="btn" id="csvBtn" ${list.length ? "" : "disabled"}>📊 Détail des courses (Excel)</button>
      </div>
      <p class="small muted" style="margin-top:8px">PDF : le bouton ouvre la page d'impression ; choisissez « Enregistrer en PDF », puis envoyez le fichier. Excel : le fichier s'ouvre dans Excel ou Google Sheets.</p>
    </div>
    <table class="bill">
      <thead><tr><th>Client</th><th class="num">Courses</th><th class="num">Montant</th><th class="num">Reste dû</th><th></th></tr></thead>
      <tbody>${rows.map(([name, c]) => `<tr><td><b>${UI.esc(name)}</b><br><span class="small muted">${UI.esc(c.phone || "")}</span></td><td class="num">${c.n}</td><td class="num"><b>${UI.money(c.total)}</b></td><td class="num">${c.unpaid ? UI.money(c.unpaid) : "✓"}</td>
        <td class="num">${c.device ? chatBtn("u:" + c.device, name, c.phone || "", "Envoyer", `Bonjour, récapitulatif de vos courses ${billMonth} : ${c.n} course(s), total ${UI.money(c.total)}${c.unpaid ? `, reste à régler ${UI.money(c.unpaid)} (espèces ou Bit au ${CONFIG.bitPhone})` : ""}. Merci !`) : ""}</td></tr>`).join("")
        || `<tr><td colspan="5" class="muted">Aucune course livrée ce mois-ci.</td></tr>`}</tbody>
      <tfoot><tr><th>Total</th><th class="num">${list.length}</th><th class="num">${UI.money(sum(list))}</th><th class="num">${UI.money(rows.reduce((s, r) => s + r[1].unpaid, 0))}</th><th></th></tr></tfoot>
    </table>`;
}

// --- Exports et itinéraire ---------------------------------------------------------
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- Comptabilité : récapitulatif du mois (PDF) et détail des courses (Excel) ---------------------------
const monthName = m => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }); };
const courierName = id => (couriers.find(c => c.id === id) || {}).name || "";
const shopName = id => (shops.find(x => x.id === id) || {}).name || "";
// Ce que HOP! gagne sur une course : la course entière si c'est le patron qui l'a faite, sinon la commission
// du livreur + la part HOP! des commandes Pro − la réduction payée par HOP! (même calcul que « Com HOP du mois »)
const hopOf = o => isMine(o) ? Number(o.price) : Number(o.commission || 0) + Number(o.hop_share || 0) - Number(o.discount || 0);
function monthRecap() {
  const list = monthOrders();
  const plansL = planSales.filter(p => String(p.created_at).startsWith(billMonth));
  const by = k => list.filter(o => o.payment_method === k).reduce((a, o) => a + Number(o.price), 0);
  const plans = plansL.reduce((a, p) => a + Number(p.amount || 0), 0), plansShare = plansL.reduce((a, p) => a + Number(p.referrer_share || 0), 0);
  return {
    list, n: list.length, gross: list.reduce((a, o) => a + Number(o.price) + Number(o.discount || 0), 0), paid: list.reduce((a, o) => a + Number(o.price), 0),
    discounts: list.reduce((a, o) => a + Number(o.discount || 0), 0),
    mine: list.filter(o => isMine(o)), commissions: list.filter(o => !isMine(o)).reduce((a, o) => a + Number(o.commission || 0), 0),
    proShare: list.filter(o => !isMine(o)).reduce((a, o) => a + Number(o.hop_share || 0), 0),
    plansL, plans, plansShare, hop: list.reduce((a, o) => a + hopOf(o), 0) + plans - plansShare,
    cash: by("cash"), bit: by("bit"), carnet: by("carnet")
  };
}
function exportCsv() {
  // Colonnes en français, séparateur « ; », accents gardés : s'ouvre tel quel dans Excel / Google Sheets
  const cols = [
    ["Date", o => UI.fmtDateTime(o.pickup_at)], ["N° course", o => o.ref], ["Client", o => o.contact_name], ["Téléphone", o => o.contact_phone],
    ["Entreprise", o => o.company], ["Envoyée par le commerce", o => o.shop_sent ? shopName(o.shop_id) || o.shop_name : ""],
    ["Commerce", o => o.shop_name || shopName(o.shop_id)], ["Service", o => UI.SERVICE_FR[o.service] || o.service],
    ["Départ", o => UI.cityFr(o.from_city)], ["Arrivée", o => UI.cityFr(o.to_city)],
    ["Prix de la course (₪)", o => Number(o.price) + Number(o.discount || 0)], ["Réduction payée par HOP! (₪)", o => Number(o.discount || 0)],
    ["Payé par le client (₪)", o => Number(o.price)], ["Paiement", o => UI.PAY_FR[o.payment_method] || o.payment_method || ""], ["Encaissé", o => o.payment_status === "paye" ? "oui" : "non"],
    ["Livreur", o => isMine(o) ? "Patron (HOP!)" : courierName(o.courier_id) || o.courier_name || ""],
    ["Commission HOP! (₪)", o => isMine(o) ? 0 : Number(o.commission || 0)], ["Part HOP! Pro (₪)", o => isMine(o) ? 0 : Number(o.hop_share || 0)],
    ["Gagné par HOP! (₪)", o => hopOf(o)], ["Code promo", o => o.promo_code || ""]
  ];
  const cell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [cols.map(c => cell(c[0])).join(";")].concat(monthOrders().sort(byTime).map(o => cols.map(c => cell(c[1](o))).join(";")));
  download(`HOP-courses-${billMonth}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
}
function exportRecap() {
  const r = monthRecap(), m = UI.money, esc = UI.esc;
  const row = (l, v, b) => `<tr${b ? ' class="b"' : ""}><td>${esc(l)}</td><td class="n">${v}</td></tr>`;
  const short = d => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const pay = o => String(UI.PAY_FR[o.payment_method] || "").replace(/^[^\p{L}]+/u, "");
  const nmDisc = r.list.filter(o => !isMine(o)).reduce((a, o) => a + Number(o.discount || 0), 0);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HOP! · récapitulatif ${esc(monthName(billMonth))}</title>
<style>body{font:14px/1.45 Arial,sans-serif;color:#0F1F3D;margin:24px}h1{font-size:21px;margin:0}h2{font-size:15px;margin:22px 0 6px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:3px solid #FF6A13;padding-bottom:10px}.logo{font:800 26px Arial;background:#0F1F3D;color:#fff;padding:4px 12px;border-radius:8px}.logo i{color:#FF6A13;font-style:normal}
table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border-bottom:1px solid #e3e7ee;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap}tr.b td{font-weight:700;background:#FFF4EC}small{color:#56627A}.det td,.det th{font-size:12px;padding:5px 4px;overflow-wrap:anywhere}
@media print{body{margin:12mm}.noprint{display:none}}</style></head><body>
<div class="top"><div><h1>Récapitulatif du mois · ${esc(monthName(billMonth))}</h1><small>${esc(CONFIG.businessName)} · édité le ${esc(new Date().toLocaleDateString("fr-FR"))}</small></div><div class="logo">HOP<i>!</i></div></div>
<h2>Courses</h2><table>
${row("Courses livrées", r.n)}${row("Total des courses (prix affiché)", m(r.gross))}${row("Réductions payées par HOP! (codes promo, bienvenue)", "− " + m(r.discounts))}${row("Total payé par les clients", m(r.paid))}
${row("dont espèces", m(r.cash))}${row("dont Bit / PayBox", m(r.bit))}${r.carnet ? row("dont carnets prépayés", m(r.carnet)) : ""}</table>
<h2>Ce que gagne HOP!</h2><table>
${row(`Courses faites par le patron (${r.mine.length}), encaissées par HOP!`, m(r.mine.reduce((a, o) => a + Number(o.price), 0)))}
${row("Commissions des livreurs", m(r.commissions))}${row("Part HOP! des commandes Pro", m(r.proShare))}
${row(`Abonnements HOP! Pro (${r.plansL.length})`, m(r.plans))}${r.plansShare ? row("− part reversée aux livreurs (abonnements)", "− " + m(r.plansShare)) : ""}
${nmDisc ? row("− réductions payées par HOP! (sur les courses des livreurs)", "− " + m(nmDisc)) : ""}${row("Total gagné par HOP! ce mois", m(r.hop), true)}</table>
${r.plansL.length ? `<h2>Abonnements HOP! Pro</h2><table><tr><th>Date</th><th>Commerce</th><th class="n">Montant</th></tr>${r.plansL.map(p => `<tr><td>${esc(new Date(p.created_at).toLocaleDateString("fr-FR"))}</td><td>${esc(shopName(p.shop_id))}</td><td class="n">${m(p.amount)}</td></tr>`).join("")}</table>` : ""}
<h2>Détail des courses</h2><table class="det"><tr><th>Date</th><th>N°</th><th>Client</th><th>Livreur</th><th>Paiement</th><th class="n">Prix</th><th class="n">HOP!</th></tr>
${r.list.slice().sort(byTime).map(o => `<tr><td>${esc(short(o.pickup_at))}</td><td>${esc(o.ref || "")}</td><td>${esc(o.company || o.contact_name || "")}</td><td>${esc(isMine(o) ? "Patron" : courierName(o.courier_id))}</td><td>${esc(pay(o))}</td><td class="n">${m(o.price)}</td><td class="n">${m(hopOf(o))}</td></tr>`).join("")}</table>
<p><small>Montants en shekels (₪), tels que payés par les clients. Le détail complet est dans le fichier Excel « HOP-courses-${esc(billMonth)}.csv ».</small></p>
<p class="noprint"><button onclick="print()" style="font-size:16px;padding:10px 18px">🖨️ Imprimer / Enregistrer en PDF</button></p>
<script>setTimeout(function(){print()},500)<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { download(`HOP-recapitulatif-${billMonth}.html`, html, "text/html"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function icsEvent(o) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escTxt = s => String(s || "").replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const start = new Date(o.pickup_at);
  return [
    "BEGIN:VEVENT",
    `UID:${o.ref}@livraison`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start.getTime() + 60 * 60000)}`,
    `SUMMARY:${escTxt(`🛵 n° ${o.ref} · ${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.money(o.price)}`)}`,
    `LOCATION:${escTxt(UI.placeQuery(o, "pickup"))}`,
    `DESCRIPTION:${escTxt(UI.orderText(o))}`,
    "END:VEVENT"
  ].join("\r\n");
}

function exportIcs(list) {
  if (!list.length) return alert("Aucune course à exporter.");
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Livraison//FR", ...list.map(icsEvent), "END:VCALENDAR"].join("\r\n");
  download(list.length === 1 ? `${list[0].ref}.ics` : "courses.ics", body, "text/calendar");
}

// Google Maps : vos arrêts restants du jour, dans l'ordre des horaires
function openRoute() {
  const t = today();
  const stops = [];
  orders.filter(o => isMine(o) && ["confirmee", "recuperee"].includes(o.status) && UI.dayKey(o.pickup_at) <= t).sort(byTime).forEach(o => {
    if (o.status === "confirmee") stops.push(UI.placeQuery(o, "pickup"));
    stops.push(UI.placeQuery(o, "dropoff"));
  });
  if (!stops.length) return alert("Aucune de vos courses acceptées à faire aujourd'hui.");
  const dest = stops.pop();
  const url = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(dest)
    + (stops.length ? "&waypoints=" + encodeURIComponent(stops.slice(0, 9).join("|")) : "");
  window.open(url, "_blank", "noopener");
}

// --- Actions ---------------------------------------------------------------------------
const plural = (n, one, many) => (n <= 1 ? one : many).replace("{n}", n);   // 0 et 1 au singulier, comme en français
// Corbeille : effacer (hidden_at) ou remettre des courses ; la base refuse d'effacer une vraie course livrée
async function hideOrders(list, hide) {
  const at = hide ? new Date().toISOString() : null;
  let ko = 0;
  for (const o of list) {
    try { await Store.updateOrder(o.id, { hidden_at: at }); } catch (e) { ko++; }
  }
  if (ko) alert(`${ko} course(s) non effacée(s) : seules les courses test, annulées ou refusées peuvent l'être.`);
  await load();
  if (!trash.length && histFilter.trash) { histFilter.trash = false; render(); }
}
document.addEventListener("click", e => {
  const hd = e.target.closest("[data-hday]");
  if (hd) { histFilter.day = hd.dataset.hday; histFilter.trash = false; return render(); }
  const b = e.target.closest("[data-hclean]");
  if (!b) return;
  const k = b.dataset.hclean;
  if (k === "trash") { histFilter.trash = !histFilter.trash; return render(); }
  const list = k === "test" ? orders.filter(o => o.is_test) : orders.filter(o => !o.is_test && ["annulee", "refusee"].includes(o.status));
  if (!list.length) return;
  const what = k === "test" ? plural(list.length, "la course test", "les {n} courses test") : plural(list.length, "la course annulée", "les {n} courses annulées ou refusées");
  if (confirm(`Effacer ${what} ? ${plural(list.length, "Elle part dans la corbeille : rien n'est perdu, on peut la remettre.", "Elles partent dans la corbeille : rien n'est perdu, on peut les remettre.")}`)) hideOrders(list, true);
});

async function change(o, changes) {
  try {
    await Store.updateOrder(o.id, changes);
    Object.assign(o, changes);
    render();
    return true;
  } catch (e) {
    if (/photo_required/.test(e.message || "")) { photoDone.delete(o.id); render(); alert("📷 Photo du colis obligatoire pour cette course : touchez « 📷 Photo du colis, puis Livré »."); return false; }
    alert("La modification n'a pas pu être enregistrée.");
    return false;
  }
}

// --- Messagerie dans l'application (le patron répond en tant que « HOP! ») -------------------
let chatRecentList = [];
let chatTotal = 0;
let chatUnread = {};
function chatBtn(thread, title, sub, label, prefill, photo) {
  const n = chatUnread[thread];
  return `<button type="button" class="btn btn-sm btn-wa" data-thread="${UI.esc(thread)}" data-ctitle="${UI.esc(title)}" data-csub="${UI.esc(sub || "")}"
    ${prefill ? `data-prefill="${UI.esc(prefill)}"` : ""} ${photo ? `data-photo="1"` : ""}>${label}${n ? ` <span class="chat-badge">${n}</span>` : ""}</button>`;
}
function openAdminChat(thread, title, sub, prefill, photo) {
  Chat.open({ thread, title, sub, me: "admin", lang: "fr", prefill, photo,
    fetch: () => Store.chatThread(thread), send: (b, i) => Store.chatSend(thread, "admin", "HOP!", b, i), onClose: refreshChats });
}
// Nom d'une conversation pour la boîte de réception
function threadLabel(thread, msgs) {
  const [kind, id] = thread.split(":");
  if (kind === "o") { const o = orders.find(x => x.id === id); return o ? `🛵 Course n° ${o.ref} · ${o.contact_name}` : "🛵 Course"; }
  if (kind === "c") { const c = couriers.find(x => x.id === id); return `👤 Livreur : ${c ? c.name : "?"}`; }
  if (kind === "s") { const x = shops.find(v => v.id === id); return `🏪 Commerce : ${x ? x.name : "?"}`; }
  const m = msgs.find(v => v.author === "client" && v.author_name);
  return `💬 Client : ${m ? m.author_name : "sans nom"}`;
}
// --- Avis des livreurs (fin de service) : lus dans leurs messages au patron, rassemblés et classés ---------------
const AVIS_SEEN = "livraison.avisSeen.v1";
const RATE_OF = { "😀 Top": 2, "😐 Moyen": 1, "😕 Pas top": 0 };
function parseReviews() {
  return chatRecentList.filter(m => m.author === "courier" && /^📝 Fin de service/.test(m.body || "")).map(m => {
    const c = couriers.find(x => "c:" + x.id === m.thread);
    const r = { id: m.id, at: m.created_at, thread: m.thread, who: c ? c.name : m.author_name || "Livreur", head: String(m.body).split("\n")[0].replace(/^📝 /, ""), items: [], comment: "" };
    String(m.body).split("\n").slice(1).forEach(l => {
      const x = l.match(/^• (.+?) : (😀 Top|😐 Moyen|😕 Pas top)(?: \((.*)\))?$/);
      if (x) r.items.push({ what: x[1], rate: RATE_OF[x[2]], label: x[2], tags: x[3] ? x[3].split(", ") : [] });
      else if (/^💬 /.test(l)) r.comment = l.slice(3);
    });
    return r;
  });
}
function avisBadge() {
  const seen = (() => { try { return localStorage.getItem(AVIS_SEEN) || ""; } catch (e) { return ""; } })();
  const n = parseReviews().filter(r => r.at > seen).length;
  const el = $("#avisBadge"); if (el) { el.textContent = n || ""; el.classList.toggle("hidden", !n); }
}
function renderReviews(view) {
  const list = parseReviews();
  try { localStorage.setItem(AVIS_SEEN, new Date().toISOString()); } catch (e) { /* ignore */ }
  avisBadge();
  if (!list.length) { view.innerHTML = `<div class="card"><b>⭐ Avis des livreurs</b><p class="muted" style="margin-top:6px">Pas encore d'avis. À la fin de chaque service, vos livreurs donnent leur avis en 20 secondes (l'appli, chaque commerce, les clients, HOP!) : tout arrivera ici, rassemblé et classé.</p></div>`; return; }
  // Regroupe les notes par sujet : score (0-100), nombre, et raisons les plus citées
  const stats = {};
  list.forEach(r => r.items.forEach(it => {
    const s = stats[it.what] = stats[it.what] || { what: it.what, n: 0, sum: 0, top: 0, moyen: 0, bof: 0, tags: {} };
    s.n++; s.sum += it.rate; s[["bof", "moyen", "top"][it.rate]]++;
    it.tags.forEach(t => { s.tags[t] = (s.tags[t] || 0) + 1; });
  }));
  const score = s => Math.round(s.sum / s.n * 50);
  const tone = v => v >= 75 ? "good" : v >= 45 ? "mid" : "bad";
  const bar = s => `<div class="av-bar"><i class="t" style="flex:${s.top}"></i><i class="m" style="flex:${s.moyen}"></i><i class="b" style="flex:${s.bof}"></i></div>`;
  const reasons = s => Object.entries(s.tags).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, n]) => `<span class="av-tag">${UI.esc(t)} <b>×${n}</b></span>`).join("");
  const row = s => `<div class="av-row ${tone(score(s))}"><div class="av-name"><b>${UI.esc(s.what)}</b><small>${s.n} avis · 😀 ${s.top} · 😐 ${s.moyen} · 😕 ${s.bof}</small></div>
      <div class="av-score">${score(s)}<small>/100</small></div>${bar(s)}${Object.keys(s.tags).length ? `<div class="av-tags">${reasons(s)}</div>` : ""}</div>`;
  const all = Object.values(stats), shops = all.filter(s => s.what.startsWith("🏪")).sort((a, b) => score(a) - score(b) || b.n - a.n);
  const main = ["📱 Appli", "🙋 Clients", "🛵 HOP!"].map(w => stats[w]).filter(Boolean);
  const week = list.filter(r => Date.now() - new Date(r.at) < 7 * 86400000).length;
  const alerts = shops.filter(s => s.bof > 0);
  view.innerHTML = `
    <div class="card av-head"><b>⭐ Avis des livreurs</b><small class="muted">${list.length} avis sur 30 jours · ${week} cette semaine · donnés en fin de service</small></div>
    ${alerts.length ? `<div class="card av-alert">⚠️ <b>À regarder :</b> ${alerts.map(s => `${UI.esc(s.what.replace(/^🏪 /, ""))}${Object.keys(s.tags).length ? ` (${UI.esc(Object.entries(s.tags).sort((a, b) => b[1] - a[1])[0][0])})` : ""}`).join(" · ")}</div>` : ""}
    <div class="card"><h3>Vue d'ensemble</h3><div class="av-list">${main.map(row).join("") || `<p class="muted">—</p>`}</div></div>
    ${shops.length ? `<div class="card"><h3>🏪 Les commerces, du moins bien noté au mieux noté</h3><div class="av-list">${shops.map(row).join("")}</div></div>` : ""}
    <div class="card"><h3>💬 Derniers avis</h3><div class="av-feed">${list.slice(0, 30).map(r => `<article class="av-item">
        <div class="av-top"><b>${UI.esc(r.who)}</b><small>${UI.esc(new Date(r.at).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))} · ${UI.esc(r.head.replace(/^Fin de service · /, ""))}</small></div>
        <div class="av-chips">${r.items.map(it => `<span class="av-chip r${it.rate}">${UI.esc(it.what)} ${["😕", "😐", "😀"][it.rate]}${it.tags.length ? ` · ${UI.esc(it.tags.join(", "))}` : ""}</span>`).join("")}</div>
        ${r.comment ? `<p class="av-com">« ${UI.esc(r.comment)} »</p>` : ""}
        ${chatBtn(r.thread, `Livreur : ${r.who}`, "", "💬 Répondre")}
      </article>`).join("")}</div></div>`;
}
async function refreshChats() {
  try { chatRecentList = await Store.chatRecent(); } catch (e) { return; }
  const lastOf = {};
  chatRecentList.forEach(m => { if (!lastOf[m.thread] || m.created_at > lastOf[m.thread].created_at) lastOf[m.thread] = m; });
  chatUnread = Chat.unread(chatRecentList.filter(m => !isClosed(m.thread, lastOf[m.thread])), "admin");
  avisBadge();
  const total = Object.values(chatUnread).reduce((s, n) => s + n, 0);
  $("#chatTabBadge").textContent = total || "";
  $("#gbMessages").textContent = total || "";
  if (!firstLoad && total > chatTotal && Chat.openThread == null) {
    beep();
    // Appli en arrière-plan : la notification dit qui écrit et quoi, et ouvre cette conversation (même étiquette
    // que la notification push : elle la remplace au lieu de s'ajouter). Appli ouverte : la sonnerie et la pastille suffisent.
    const last = chatRecentList.filter(m => chatUnread[m.thread] && m.author !== "admin").sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    if (document.hidden && last) UI.notify(`💬 ${last.author_name || "Nouveau message"}`, { body: String(last.body || "📷 Photo").slice(0, 140), tag: "m-" + last.thread });
  }
  chatTotal = total;
}
// Discussions terminées (sur ce téléphone) : elles reviennent seulement si quelqu'un réécrit
const LS_CLOSED = "livraison.closedThreads.v1";
function closedThreads() { try { return JSON.parse(localStorage.getItem(LS_CLOSED)) || {}; } catch (e) { return {}; } }
function closeThread(thread) {
  const c = closedThreads();
  c[thread] = new Date().toISOString();
  try { localStorage.setItem(LS_CLOSED, JSON.stringify(c)); } catch (e) { /* ignore */ }
  Chat.markSeen && Chat.markSeen(thread);
}
const isClosed = (thread, last) => { const at = closedThreads()[thread]; return !!at && new Date(last.created_at) <= new Date(at); };
function renderInbox(view) {
  const threads = {};
  chatRecentList.forEach(m => { (threads[m.thread] = threads[m.thread] || []).push(m); });
  const list = Object.entries(threads).map(([thread, msgs]) => ({ thread, msgs, last: msgs[0] }))
    .filter(x => !isClosed(x.thread, x.last))
    .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  view.innerHTML = list.length ? `<div class="orders">${list.map(t => {
    const n = chatUnread[t.thread] || 0;
    const lastText = t.last.author === "system" ? I18N.forLang("fr", "cs_" + String(t.last.body).replace("status:", "")) : (t.last.body || "📷 Photo");
    const label = threadLabel(t.thread, t.msgs);
    return `<article class="order inbox-row${n ? " is-new" : ""}" data-thread="${UI.esc(t.thread)}" data-ctitle="${UI.esc(label)}">
      <div class="order-head"><span class="order-time">${UI.esc(label)}</span>${n ? `<span class="chat-badge">${n}</span>` : ""}<span class="order-ref">${UI.esc(UI.fmtDateTime(t.last.created_at))}</span></div>
      <p class="small muted" style="margin-top:4px">${t.last.author === "admin" ? "Vous : " : ""}${UI.esc(String(lastText).slice(0, 120))}</p>
      ${(() => { if (!t.thread.startsWith("u:")) return ""; const m = t.msgs.find(v => v.author === "client" && v.author_name), ph = m && (String(m.author_name).match(/0[\d\-\s]{8,}/) || [])[0];
        return ph ? `<div style="margin-top:6px">${howBtn(ph.trim(), String(m.author_name).split("·")[0])}</div>` : ""; })()}
      <button type="button" class="btn btn-sm btn-link" data-close-thread="${UI.esc(t.thread)}">🗑️ Terminer / supprimer la discussion</button>
    </article>`;
  }).join("")}</div>` : `<div class="empty card">Aucun message ces 30 derniers jours. Les clients, livreurs et commerces vous écrivent ici, dans l'application.</div>`;
}

function orderOf(el) {
  const art = el.closest("article.order");
  return art && (orders.find(o => o.id === art.dataset.id) || trash.find(o => o.id === art.dataset.id));
}

async function assignTo(o, courier) {
  try {
    await Store.assignOrder(o, courier);
    await load();
    // Livreur hors ligne : la course l'attend dans son appli (elle s'ouvre au premier plan) ; on peut l'appeler
    if (courier.role !== "admin" && !onlineOf(courier).on && courier.phone
      && confirm(`${courier.name} est hors ligne : la course n° ${o.ref} l'attend dans son appli HOP! Livreur. Elle s'ouvrira dès qu'il l'ouvre et il devra vous confirmer « Je la ferai » (vous le verrez ici).\n\nL'appeler maintenant ?`))
      location.href = "tel:" + String(courier.phone).replace(/[^\d+]/g, "");

  } catch (e) { alert("Attribution impossible, vérifiez la connexion."); }
}

async function onViewClick(e) {
  const ct = e.target.closest("[data-close-thread]");
  if (ct) { closeThread(ct.dataset.closeThread); await refreshChats(); return render(); }
  const th = e.target.closest("[data-thread]");
  if (th) return openAdminChat(th.dataset.thread, th.dataset.ctitle, th.dataset.csub, th.dataset.prefill, !!th.dataset.photo);
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.hideSignup) {
    const a = accounts.find(x => x.id === el.dataset.hideSignup);
    if (!confirm(`Effacer ${a && (a.name || a.email) || "cette inscription"} de la liste ?\n\nÀ faire quand il n'y a plus de nouvelles (mail faux…). S'il finit un jour son inscription, il réapparaîtra dans vos livreurs à valider.`)) return;
    try { localStorage.setItem(HIDDEN_SIGNUPS, JSON.stringify(hiddenSignups().concat(el.dataset.hideSignup))); } catch (ex) { /* ignore */ }
    render();
    return;
  }
  if (el.dataset.confirmMail) {
    const a = accounts.find(x => x.id === el.dataset.confirmMail);
    if (!confirm(`Confirmer l'email de ${a && (a.name || a.email) || "ce livreur"} ?\n\nÀ faire si le mail de confirmation n'arrive pas. Ensuite, dites-lui : ouvre HOP! Livreur → « J'ai déjà un compte » → email et mot de passe, puis termine ta fiche.`)) return;
    try { await Store.adminConfirmEmail(el.dataset.confirmMail); await load(); alert("✅ Email confirmé : il peut se connecter dans HOP! Livreur et finir sa fiche."); }
    catch (ex) { alert("Pas enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.unblock) {
    if (!confirm(`Débloquer le client ${el.dataset.unblock} ? Il pourra de nouveau commander (et payer en espèces s'il a déjà été livré).`)) return;
    const ok = await Store.adminUnblock(el.dataset.unblock).catch(() => false);
    alert(ok ? "✅ Client débloqué." : "Déblocage impossible, réessayez.");
    return;
  }
  if (el.dataset.clientReset) {
    const pw = prompt(`Nouveau mot de passe pour ${el.dataset.cname || "ce client"} (6 caractères au moins). Donnez-le-lui : il le changera s'il veut en se reconnectant.`, Math.random().toString(36).slice(2, 8));
    if (pw == null) return;
    if (pw.trim().length < 6) return alert("6 caractères au moins.");
    const ok = await Store.adminClientReset(el.dataset.clientReset, pw.trim()).catch(() => false);
    alert(ok ? `✅ Nouveau mot de passe : ${pw.trim()}\nSes anciennes connexions sont coupées.` : "Non enregistré, réessayez.");
    return;
  }
  if (el.id === "csvBtn") return exportCsv();
  if (el.id === "recapBtn") return exportRecap();
  if (el.dataset.vdays) { visits.days = Number(el.dataset.vdays); visits.data = null; render(); return loadVisits(true); }
  // Rayons à cocher (patron)
  if (el.dataset.ray) { ray.id = el.dataset.ray; ray.edit = null; return render(); }
  if (el.dataset.rayNew) { const r = Rayons.byId(ray.id); ray.edit = { kind: el.dataset.rayNew, x: null, cat: (r.cats.find(c => !c.hidden) || {}).id }; render(); return $("#rayForm input[name=fr]").focus(); }
  if (el.dataset.rayEdit) { ray.edit = { kind: "item", x: Rayons.byId(ray.id).items.find(i => i.id === el.dataset.rayEdit) }; render(); return $("#rayForm").scrollIntoView({ block: "start", behavior: "smooth" }); }
  if (el.dataset.rayCedit) { ray.edit = { kind: "cat", x: Rayons.byId(ray.id).cats.find(c => c.id === el.dataset.rayCedit) }; render(); return $("#rayForm").scrollIntoView({ block: "start", behavior: "smooth" }); }
  if (el.dataset.rayHide) return rayHide("item", el.dataset.rayHide, el.dataset.on === "1");
  if (el.dataset.rayChide) { if (el.dataset.on === "1" && !confirm("Masquer toute la catégorie et ses produits pour les clients ?")) return; return rayHide("cat", el.dataset.rayChide, el.dataset.on === "1"); }
  if (el.dataset.rayPick) { rayStash(); ray.edit.pick = !ray.edit.pick; return render(); }
  if (el.dataset.rayPic) { rayStash(); ray.edit.img = el.dataset.rayPic; ray.edit.photo = null; ray.edit.pick = false; return render(); }
  if (el.dataset.rayNophoto) { rayStash(); ray.edit.photo = null; return render(); }
  if (el.dataset.rayCancel) { ray.edit = null; return render(); }
  if (el.dataset.vmove) {
    e.preventDefault();   // (dans la ligne repliée : la fiche ne s'ouvre pas)
    el.disabled = true;
    const vit = vitrineShops(), i = vit.findIndex(x => x.id === el.dataset.vmove);
    return moveVitrine(el.dataset.vmove, i + Number(el.dataset.dir));
  }
  if (el.dataset.demos) {
    const on = el.dataset.demos === "actif";
    if (!confirm(on ? "Remettre les 3 vitrines de démonstration ?" : "Retirer les 3 vitrines de démonstration ?\n\nLeurs liens ne montreront plus rien. Rien n'est effacé : vous pourrez les remettre ici.")) return;
    try { await Promise.all(shops.filter(x => x.demo).map(x => Store.updateShop(x.id, { status: el.dataset.demos }))); await load(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.week) { weekOffset = Math.min(0, weekOffset + Number(el.dataset.week)); return render(); }
  if (el.dataset.topupOk || el.dataset.topupNo) {
    try { await Store.decideTopup(el.dataset.topupOk || el.dataset.topupNo, !!el.dataset.topupOk); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.creditAdd) {
    const a = prompt(`Crédit à ajouter à ${el.dataset.name} (₪) : recharge reçue autrement, geste commercial…`, "50");
    if (a == null) return;
    const n = Number(String(a).replace(",", "."));
    if (!(n >= 5 && n <= 2000)) return alert("Montant entre 5 et 2000 ₪.");
    const paid = confirm(`Avez-vous reçu ces ${UI.money(n)} de ${el.dataset.name} ?\nOK = argent reçu (un reçu HOP est fait)\nAnnuler = crédit offert (pas de reçu)`);
    const note = prompt("Note (facultatif) :", "") || "";
    try { await Store.addTopup(el.dataset.creditAdd, n, note, paid); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.creditRemove) {
    const a = prompt(`Crédit à retirer à ${el.dataset.name} (₪) ? Il a ${UI.money(el.dataset.credit)} aujourd'hui.`, "");
    if (a == null || !String(a).trim()) return;
    const n = Number(String(a).replace(",", "."));
    if (!(n > 0 && n <= 2000)) return alert("Montant entre 1 et 2000 ₪.");
    const why = prompt("Raison (le livreur la voit dans ses messages) :", "Crédit ajusté par HOP");
    if (why == null) return;
    try { await Store.creditRemove(el.dataset.creditRemove, n, why); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.welcomeCredit != null) {
    const a = prompt("Crédit de départ offert à chaque nouveau livreur validé (₪, 0 = aucun) :", String(settings.welcome_credit ?? 25));
    if (a == null) return;
    const n = Number(String(a).replace(",", "."));
    if (!(n >= 0 && n <= 500)) return alert("Montant entre 0 et 500 ₪.");
    try { await Store.saveSettings({ welcome_credit: n }); settings.welcome_credit = n; render(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.penCancel) {
    if (!confirm("Annuler cette retenue ? Le livreur est prévenu.")) return;
    try { await Store.penaltyCancel(el.dataset.penCancel); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.settle) {
    const start = $("#view").dataset.weekStart, end = addDays(start, 6);
    const inWeek = o => o.status === "livree" && !o.is_test && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end;
    const ids = orders.filter(o => o.courier_id === el.dataset.settle && inWeek(o) && o.commission_status !== "regle").map(o => o.id);
    const bonusIds = orders.filter(o => o.referrer_id === el.dataset.settle && inWeek(o) && o.referral_status !== "regle").map(o => o.id);
    const tipIds = orders.filter(o => o.courier_id === el.dataset.settle && o.tip_status === "recu").map(o => o.id);
    const planIds = planSales.filter(p => p.referrer_id === el.dataset.settle && p.referrer_status !== "regle").map(p => p.id);
    try {
      await Store.settleOrders(ids); await Store.settleReferrals(bonusIds);
      await Store.settleTips(tipIds); await Store.settlePlanShares(planIds);
      await Store.settlePenalties(el.dataset.settle);
      await load();
    } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.ract && el.dataset.ract !== "note") {
    const id = el.closest("[data-req]").dataset.req;
    try { await Store.updateRequest(id, { status: el.dataset.ract }); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.sact) {
    const id = el.closest("[data-shop]").dataset.shop;
    const shop = shops.find(x => x.id === id);
    let changes = { status: el.dataset.sact };
    if (el.dataset.sact === "carnet") {
      // Carnet payé : reçu numéroté, courses ajoutées, et le reçu part au commerce dans l'application
      const price = UI.money(CONFIG.partners.carnet.price);
      const method = confirm(`Avez-vous reçu ${price} de ${shop.name} par Bit ?\n(Annuler si c'était en espèces)`) ? "bit"
        : confirm(`Avez-vous reçu ${price} de ${shop.name} en espèces ?`) ? "cash" : null;
      if (!method) return;
      try {
        const r = await Store.sellCarnet(id, method);
        const url = UI.carnetReceiptUrl(r);
        const msg = shop.lang === "fr"
          ? `Bonjour ${shop.contact_name || ""}, merci ! Votre carnet de ${CONFIG.partners.carnet.courses} courses est actif. Votre reçu n° ${r.receipt_number} : ${url}`
          : `שלום ${shop.contact_name || ""}, תודה! הכרטיסייה של ${CONFIG.partners.carnet.courses} משלוחים פעילה. הקבלה מס' ${r.receipt_number}: ${url}`;
        // Le reçu part dans la conversation du commerce (son espace pro)
        await Store.chatSend("s:" + id, "admin", "HOP!", msg).catch(() => alert(`Carnet enregistré, mais le message n'est pas parti. Reçu : ${url}`));
        await load();
      } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
      return;
    } else if (el.dataset.sact === "plan" || el.dataset.sact === "plangift") {
      // +1 mois à partir de la fin en cours (ou d'aujourd'hui). Payé : la part du parrain livreur est enregistrée.
      const paid = el.dataset.sact === "plan";
      const base = Store.planActive(shop) ? new Date(shop.plan_until + "T12:00:00") : new Date();
      const end = new Date(base); end.setMonth(end.getMonth() + 1);
      if (!confirm(`HOP! Pro pour ${shop.name} jusqu'au ${UI.fmtKey(UI.dayKey(end))}, ${paid ? `payé ${UI.money(settings.pro_monthly)}` : "offert"} ?`)) return;
      try {
        const r = await Store.planExtend(id, paid);
        if (r && Number(r.referrer_share) > 0) alert(`Enregistré. ${UI.money(r.referrer_share)} pour le livreur qui a amené ce commerce, versés avec son solde.`);
        await load();
      } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
      return;
    } else if (el.dataset.sact === "enrich") {
      // Fiche automatique : horaires, photo, menu… repris de sa page publique, seulement les cases vides
      el.disabled = true; el.textContent = "🤖 Recherche en cours… (≈ 30 s)";
      try {
        const r = await Store.adminShopEnrich(id);
        alert(r && r.ok ? ((r.done || []).length ? `✅ Fiche de ${shop.name} remplie : ${r.done.join(", ")}.` : `Rien à ajouter : la fiche de ${shop.name} est déjà remplie.`)
          : `${shop.name} n'a pas été trouvé en ligne : remplissez sa fiche à la main (📝 Fiche pour les clients).`);
        await load();
      } catch (ex) { alert("Non lancé, vérifiez la connexion."); el.disabled = false; el.textContent = "🤖 Remplir sa fiche"; }
      return;
    } else if (el.dataset.sact === "fiche") {
      // Fiche visible par les clients : WhatsApp (format international), présentation, horaires de la semaine
      const box = el.closest(".shop-fiche"), v = k => box.querySelector(`[data-fiche="${k}"]`).value.trim();
      let wa = v("whatsapp").replace(/\D/g, "");
      if (wa.startsWith("0")) wa = "972" + wa.slice(1);
      if (wa && !/^[0-9]{9,15}$/.test(wa)) return alert("Numéro WhatsApp invalide (ex. 053-373-3785).");
      const hours = UI.readHours(box);
      if (hours.some(h => h.h.split(",").some(r => r && r.split("-")[0] >= r.split("-")[1]))) return alert("Horaires : l'heure de fermeture doit être après l'heure d'ouverture.");
      const link = v("pay_link");
      let bit = v("pay_bit").replace(/\D/g, "");
      if (bit.startsWith("972")) bit = "0" + bit.slice(3);
      if (link && !/^https:\/\/\S{4,250}$/.test(link)) return alert("Le lien de paiement doit commencer par https://");
      let web = v("website");
      if (web && !/^https?:\/\//i.test(web)) web = "https://" + web;
      if (web && !/^https?:\/\/\S{4,250}$/.test(web)) return alert("Site internet invalide (ex. https://www.moncommerce.co.il).");
      if (bit && !/^0\d{8,9}$/.test(bit)) return alert("Numéro Bit / PayBox invalide (ex. 053-373-3785).");
      ficheDirty.delete(box.dataset.fold);
      changes = { whatsapp: wa || null, about: v("about") || null, hours: hours.some(h => h.h) ? hours : null, pay_link: link || null, pay_bit: bit || null, website: web || null };
    } else if (el.dataset.sact === "showcase") {
      changes = { showcase: !shop.showcase };
    } else if (el.dataset.sact === "paused") {
      changes = { paused: !shop.paused };
    } else if (el.dataset.sact === "kosher") {
      changes = { kosher: !shop.kosher };
    } else if (el.dataset.sact === "featured") {
      changes = { featured: !shop.featured };
    } else if (el.dataset.sact === "planoff") {
      if (!confirm(`Arrêter HOP! Pro pour ${shop.name} ?`)) return;
      changes = { plan_until: UI.addDays(UI.dayKey(new Date()), -1) };
    } else if (el.dataset.sact === "credits") {
      const v = prompt(`Courses restantes sur le carnet de ${shop.name}`, shop.credits || 0);
      const n = parseInt(v, 10);
      if (v == null || !(n >= 0)) return;
      changes = { credits: n };
    }
    try { await Store.updateShop(id, changes); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.tpl != null) {
    const ta = $("#msgText");
    ta.value = CONFIG.courierMessages[Number(el.dataset.tpl)].text;
    ta.dataset.kind = CONFIG.courierMessages[Number(el.dataset.tpl)].kind;
    ta.focus();
    return;
  }
  if (el.dataset.ctpl != null) { $("#cliText").value = CLIENT_TPL[Number(el.dataset.ctpl)]; $("#cliText").focus(); return; }
  if (el.id === "cliSend") {
    const body = $("#cliText").value.trim(), days = Number($("#cliDays").value);
    if (!body) return $("#cliText").focus();
    if (!confirm(`Envoyer ce message à ${clientCount(days)} client(s) ?\n\n${body}`)) return;
    el.disabled = true;
    try {
      const n = await Store.broadcastClients(body, days);
      $("#cliText").value = "";
      alert(`✅ Message envoyé à ${n} client(s).`);
    } catch (ex) { alert("Message non envoyé, vérifiez la connexion."); }
    el.disabled = false;
    return;
  }
  if (el.id === "msgSend") {
    const body = $("#msgText").value.trim();
    if (!body) return $("#msgText").focus();
    el.disabled = true;
    try {
      await Store.sendMessage(body, $("#msgText").dataset.kind || "info", $("#msgTo").value || null);
      $("#msgText").value = "";
      await load();
    } catch (ex) { el.disabled = false; alert("Message non envoyé, vérifiez la connexion."); }
    return;
  }
  if (el.id === "dirSave") { saveDirPlace(); return; }
  if (el.dataset.placeOk || el.dataset.placeFix) {
    const r = el.closest("[data-place]"), cur = r.querySelector("b").textContent;
    const name = el.dataset.placeFix ? (prompt("Le bon nom de l'enseigne (ex. Simaki Sushi · סימאקי סושי)", cur) || "").trim() : "";
    if (el.dataset.placeFix && !name) return;
    try { await Store.verifyKnownPlace(r.dataset.place, name && name !== cur ? name : null); initDirCard(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.placeDel) {
    const row = el.closest("[data-place]");
    if (!confirm("Retirer ce commerce de l'annuaire ?")) return;
    try { await Store.knownPlaceDelete(row.dataset.place); row.remove(); } catch (ex) { alert("Non retiré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.copy) {
    if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.copy).then(() => { el.textContent = "✓ Copié"; }, () => {});
    return;
  }
  if (el.dataset.perks) {
    const id = el.closest("[data-courier]").dataset.courier;
    const c = couriers.find(x => x.id === id);
    const on = el.dataset.perks === "on";
    if (!confirm(on
      ? `Activer les avantages réseau pour ${c ? c.name : "ce livreur"} ?\n\nSur les courses des commerces qu'il a amenés : commission ${UI.networkText()} au lieu de ${UI.commissionText()}, ${UI.money(settings.referral_bonus)} quand un autre livreur les fait${CONFIG.pro.referrerPercent ? `, ${CONFIG.pro.referrerPercent} % de leurs abonnements HOP! Pro` : ""}. (Pour les nouvelles courses.)`
      : `Retirer les avantages réseau à ${c ? c.name : "ce livreur"} ? Ses prochaines courses repassent à ${UI.commissionText()}, sans bonus.`)) return;
    try { await Store.updateCourier(id, { network_perks: on }); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.unlock) {
    const id = el.closest("[data-courier]").dataset.courier;
    const c = couriers.find(x => x.id === id);
    const on = el.dataset.unlock === "on";
    if (on && !confirm(`Débloquer ${c.name} pendant 24 h ? Plus aucun blocage (solde dû, course en cours, GPS, photo).`)) return;
    try { await Store.updateCourier(id, { unlocked_until: on ? new Date(Date.now() + 86400000).toISOString() : null }); await load(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.docs) {
    const id = el.closest("[data-courier]").dataset.courier, cr = couriers.find(x => x.id === id);
    try { showDocs(cr ? cr.name : "", await Store.courierDocs(id)); } catch (ex) { alert("Documents introuvables, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.topcase) {
    const id = el.closest("[data-courier]").dataset.courier;
    try { showPhoto(await Store.courierTopcase(id)); } catch (ex) { alert("Photo introuvable, vérifiez la connexion."); }
    return;
  }
  if (el.dataset.cact) {
    const id = el.closest("[data-courier]").dataset.courier;
    const cr = couriers.find(x => x.id === id);
    if (el.dataset.cact === "actif" && cr && !cr.topcase_at && !confirm(`${cr.name} n'a pas encore envoyé la photo de son top case. Valider quand même ?`)) return;
    try { await Store.updateCourier(id, { status: el.dataset.cact }); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
    return;
  }
  const o = orderOf(el);
  if (!o) return;
  if (el.dataset.status) {
    if (el.dataset.status === "annulee" && !confirm(`Annuler la course n° ${o.ref} ?`)) return;
    // « Livré » à la place du livreur : on demande, pour ne pas clore une course d'un doigt qui glisse
    if (el.dataset.status === "livree" && !confirm(`Marquer la course n° ${o.ref} comme livrée${o.courier_name ? ` (à la place de ${o.courier_name})` : ""} ?`)) return;
    const changes = { status: el.dataset.status };
    // Le paiement se fait en général à la livraison : le noter déclenche aussi le reçu
    if (changes.status === "livree" && o.payment_status !== "paye" && confirm(`Livré ! Avez-vous encaissé ${UI.money(o.price)} ?`)) changes.payment_status = "paye";
    if (await change(o, changes)) {
      if (changes.payment_status) await load();

    }
  } else if (el.dataset.act === "goodslink") {
    const shop = o.shop_name || "le commerce";
    const link = prompt(`Course n° ${o.ref} : passez la commande chez ${shop} (dans son appli, « à emporter »), puis collez ici son lien de paiement.`, o.goods_link || "https://");
    if (link === null) return;
    const v = link.trim();
    if (!/^https:\/\/\S{4,600}$/.test(v)) return alert("Le lien doit commencer par https://");
    try { if (!(await Store.adminGoodsLink(o.id, v))) return alert("Non enregistré (course annulée ou déjà payée ?)."); } catch (ex) { return alert("Non enregistré, vérifiez la connexion."); }
    // Un seul message, les deux paiements en même temps : ① le lien du commerce (carte) ② la livraison par Bit au livreur
    const amount = Number(o.items_total) > 0 ? UI.money(o.items_total) : "", first = String(o.contact_name || "").split(" ")[0];
    const c = couriers.find(x => x.id === o.courier_id), cBit = c ? String(c.bit_phone || c.phone || "").replace(/\D/g, "").replace(/^972/, "0") : "", cName = c ? String(c.name || "").split(" ")[0] : "";
    const ride = UI.money(o.price), bitRide = o.payment_method === "bit" && o.payment_status !== "paye" && !o.client_paid_at;
    const rideFr = !bitRide ? (o.payment_method === "cash" ? `② La livraison (${ride}) : en espèces au livreur, à la livraison.` : "")
      : cBit ? `② La livraison (${ride}) : par Bit à votre livreur ${cName}, au ${cBit}.` : `② La livraison (${ride}) : par Bit à votre livreur, son numéro s'affiche sur votre suivi.`;
    const rideHe = !bitRide ? (o.payment_method === "cash" ? `② המשלוח (${ride}): במזומן לשליח, במסירה.` : "")
      : cBit ? `② המשלוח (${ride}): בביט לשליח ${cName}, למספר ${cBit}.` : `② המשלוח (${ride}): בביט לשליח, המספר שלו מופיע בעמוד המעקב.`;
    const msg = o.lang === "he"
      ? `שלום ${first}, כאן HOP! 🛵\n① ההזמנה שלכם מ${shop}${amount ? " (" + amount + ")" : ""}: משלמים בכרטיס אשראי בקישור: ${v}\n${rideHe ? rideHe + "\n" : ""}ברגע שהתשלום ל${shop} מתקבל, השליח יוצא לאסוף את ההזמנה שלכם.\nמעקב: ${UI.trackUrl(o)}`
      : `Bonjour ${first}, ici HOP! 🛵\n① Votre commande chez ${shop}${amount ? " (" + amount + ")" : ""} : payez par carte avec ce lien : ${v}\n${rideFr ? rideFr + "\n" : ""}Dès que ${shop} a reçu votre paiement, le livreur part récupérer votre commande.\nSuivi : ${UI.trackUrl(o)}`;
    if (o.contact_phone) window.open(UI.waPersonal(o.contact_phone, msg), "_blank");
    await load();
  } else if (el.dataset.act === "shopok" || el.dataset.act === "shopready") {
    const sh = shops.find(x => x.id === o.shop_id);
    if (!sh || !sh.token) return alert("Commerce introuvable.");
    if (el.dataset.act === "shopready") {
      try { if (!(await Store.shopOrderAction(sh.token, o.id, "prete"))) return alert("Non enregistré."); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
      return;
    }
    const ref = prompt(`Course n° ${o.ref} : n° de la commande chez ${sh.name} (les 3 derniers chiffres), donné au comptoir par le livreur.`, "");
    if (ref === null) return;
    const r = ref.replace(/\D/g, "").slice(-3);
    if (r.length !== 3) return alert("Il faut 3 chiffres (les 3 derniers du n° de commande).");
    const mins = prompt("Prête dans combien de minutes ?", "15");
    if (mins === null) return;
    const m = Math.min(90, Math.max(5, parseInt(mins, 10) || 15));
    try { if (!(await Store.shopOrderAction(sh.token, o.id, "accepter", m, null, r))) return alert("Non enregistré (commande déjà passée ou annulée ?)."); }
    catch (ex) { return alert("Non enregistré, vérifiez la connexion."); }
    const at = new Date(Date.now() + m * 60000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), first = String(o.contact_name || "").split(" ")[0];
    const msg = o.lang === "he"
      ? `שלום ${first}, כאן HOP! 🛵\nההזמנה שלכם מ${sh.name} הוזמנה (מס' ${r}) ותהיה מוכנה בסביבות ${at}. השליח יוצא לאסוף אותה ומביא אליכם.\nמעקב: ${UI.trackUrl(o)}`
      : `Bonjour ${first}, ici HOP! 🛵\nVotre commande chez ${sh.name} est passée (n° ${r}) : elle sera prête vers ${at}. Le livreur part la chercher et vous l'apporte.\nSuivi : ${UI.trackUrl(o)}`;
    if (o.contact_phone && confirm("Prévenir le client sur WhatsApp ?")) window.open(UI.waPersonal(o.contact_phone, msg), "_blank");
    await load();
  } else if (el.dataset.act === "goodschoice") {
    const cur = { lien: "1", bit: "2", especes: "3" }[o.goods_choice] || "";
    const pick = prompt(`Course n° ${o.ref} : comment le client paie ses articles ?\n1 = lien de paiement du commerce\n2 = Bit sur le numéro du livreur (articles + livraison)\n3 = espèces au livreur (articles + livraison)`, cur === "1" ? "2" : "1");
    if (pick === null) return;
    const choice = { 1: "lien", 2: "bit", 3: "especes" }[pick.trim()];
    if (!choice) return alert("Tapez 1, 2 ou 3.");
    try { if (!(await Store.adminGoodsChoice(o.id, choice))) return alert("Non enregistré (course déjà partie ou annulée ?)."); } catch (ex) { return alert("Non enregistré, vérifiez la connexion."); }
    const c = couriers.find(x => x.id === o.courier_id), bit = c ? c.bit_phone || c.phone || "" : "", cn = c ? String(c.name || "").split(" ")[0] : "";
    const goods = Number(o.items_total || 0), total = Number(o.price || 0) + goods, first = String(o.contact_name || "").split(" ")[0], he = o.lang === "he";
    const amt = `${UI.money(total)}${goods ? (he ? ` (מוצרים ${UI.money(goods)} + משלוח ${UI.money(o.price)})` : ` (articles ${UI.money(goods)} + livraison ${UI.money(o.price)})`) : ""}`;
    const msg = choice === "bit"
      ? (he ? `שלום ${first}, כאן HOP! 🛵\nלהזמנה שלכם: משלמים ${amt} בביט ${bit ? `לשליח ${cn}, למספר ${bit}` : "לשליח, המספר שלו יופיע בעמוד המעקב"}.\nמעקב: ${UI.trackUrl(o)}`
            : `Bonjour ${first}, ici HOP! 🛵\nPour votre commande, payez ${amt} par Bit ${bit ? `à votre livreur ${cn}, au ${bit}` : "à votre livreur : son numéro s'affiche sur votre suivi"}.\nSuivi : ${UI.trackUrl(o)}`)
      : choice === "especes"
      ? (he ? `שלום ${first}, כאן HOP! 🛵\nלהזמנה שלכם: משלמים ${amt} במזומן לשליח, במסירה.\nמעקב: ${UI.trackUrl(o)}` : `Bonjour ${first}, ici HOP! 🛵\nPour votre commande, vous payez ${amt} en espèces au livreur, à la livraison.\nSuivi : ${UI.trackUrl(o)}`)
      : "";
    if (msg && o.contact_phone && confirm("Prévenir le client sur WhatsApp ?")) window.open(UI.waPersonal(o.contact_phone, msg), "_blank");
    await load();
  } else if (el.dataset.act === "goodsok" || el.dataset.act === "goodsko") {
    const ok = el.dataset.act === "goodsok";
    if (!confirm(ok ? `Course n° ${o.ref} : le client a bien payé ses articles ? Le livreur pourra les récupérer.` : `Course n° ${o.ref} : paiement des articles pas reçu ? Le client est prévenu sur son suivi.`)) return;
    try { if (!(await Store.adminGoodsPay(o.id, ok))) return alert("Non enregistré."); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
  } else if (el.dataset.act === "claimok") {
    if (!confirm(`Course n° ${o.ref} : vérifié, elle a bien été livrée ? Le signalement est classé, rien n'est retenu au livreur.`)) return;
    try { await Store.claimClose(o.id); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
  } else if (el.dataset.act === "penalty") {
    // Par défaut : le prix de la course + la valeur de la commande (catalogue ou budget des achats)
    const c = couriers.find(x => x.id === o.courier_id);
    const def = Number(o.price || 0) + Number(o.items_total || 0) + (o.service === "achat" ? Number(o.budget || 0) : 0);
    const amount = prompt(`Retenue à ${c ? c.name : "ce livreur"} pour la course n° ${o.ref} (₪) : le prix de la course + la valeur de la commande, à modifier si besoin.`, String(def));
    if (amount === null) return;
    const v = Number(String(amount).replace(",", "."));
    if (!(v > 0 && v <= 5000)) return alert("Montant entre 1 et 5 000 ₪.");
    const reason = prompt("Motif (le livreur le reçoit dans sa messagerie) :", o.claim_status === "ouverte" ? "Commande déclarée livrée mais pas reçue par le client" : "Course acceptée mais pas faite");
    if (!reason || !reason.trim()) return;
    try { await Store.penaltyAdd(o.courier_id, o.id, v, reason.trim()); await load(); } catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
  } else if (el.dataset.act === "docs") {
    try {
      const list = await Store.orderDocs(o.id);
      UI.photoViewer(`Course n° ${o.ref} · ${UI.PLACE_FR[o.place_kind] || ""} · N° ${o.tracking_number || "—"}`, list.map(d => ({ label: UI.DOC_FR[d.kind] || d.kind, src: d.photo })));
    } catch (ex) { alert("Documents introuvables, vérifiez la connexion."); }
  } else if (el.dataset.act === "docsok" || el.dataset.act === "docsko") {
    const ok = el.dataset.act === "docsok";
    const note = ok ? null : prompt("Que manque-t-il ? Le client reçoit ce message (ex. : la photo de la procuration signée).");
    if (ok ? !confirm(`Documents de la course n° ${o.ref} complets et lisibles ? Elle part aux livreurs.`) : !note) return;
    try { if (!(await Store.docsVerdict(o.id, ok, note))) alert("Course déjà prise ou annulée."); await load(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
  } else if (el.dataset.act === "take") {
    if (o.docs_status && o.docs_status !== "ok" && !confirm("Les documents de ce colis ne sont pas encore validés. La prendre quand même ?")) return;
    if (duty.watch == null && confirm("Course prise. Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
    assignTo(o, me);
  } else if (el.dataset.act === "refuse") {
    refusing = o;
    $("#refuseForm").reset();
    $("#refuseModal").classList.remove("hidden");
  } else if (el.dataset.act === "waitfix") {
    // Le patron (lui seul) fixe le supplément d'attente ; le client doit l'accepter (vide = revenir au compteur 1 ₪ / min)
    const cur = o.wait_fix != null ? String(o.wait_fix).replace(".00", "") : "";
    const v = prompt(`Supplément d'attente pour la course n° ${o.ref} (en ₪, ${Number(settings.wait_max) || 60} au plus).\nLe client reçoit le montant et doit l'accepter (ou laisser tomber : la moitié de la course reste due).\nLaisser vide pour revenir au compteur (1 ₪ la minute).`, cur);
    if (v === null) return;
    const fee = v.trim() === "" ? null : Number(v.replace(",", "."));
    if (fee != null && (!isFinite(fee) || fee < 0)) return alert("Montant invalide.");
    try { const r = await Store.adminWaitFix(o.id, fee); if (!r || !r.ok) alert("Impossible : la course n'est plus en attente de récupération."); await load(); }
    catch (ex) { alert("Non enregistré, vérifiez la connexion."); }
  } else if (el.dataset.act === "release") {
    change(o, { status: "nouvelle", courier_id: null, courier_name: null, courier_phone: null, courier_bit: null, commission: 0 });
  } else if (el.dataset.act === "issue") {
    if (confirm(`Le souci de la course n° ${o.ref} est-il réglé ?`)) change(o, { issue: null, issue_at: null });
  } else if (el.dataset.act === "tipok") {
    if (confirm(`Le pourboire de ${UI.money(o.tip)} (course n° ${o.ref}) est bien arrivé sur votre Bit ? Il sera reversé à ${o.courier_name || "votre livreur"} avec son solde.`)) change(o, { tip_status: "recu" });
  } else if (el.dataset.act === "unlock") {
    if (!o.unlocked && !confirm(`Débloquer la course n° ${o.ref} ? Le livreur pourra valider « Livré » sans être à l'adresse et sans photo.`)) return;
    change(o, { unlocked: !o.unlocked });
  } else if (el.dataset.act === "paidto") {
    change(o, { paid_to: o.paid_to === "hop" ? "livreur" : "hop" });
  } else if (el.dataset.act === "paid") {
    change(o, { payment_status: o.payment_status === "paye" ? "en_attente" : "paye" });
  } else if (el.dataset.act === "price") {
    const v = prompt(`Nouveau prix pour la course n° ${o.ref} (${CONFIG.currency})`, o.price);
    const n = parseFloat(String(v).replace(",", "."));
    if (v != null && isFinite(n) && n >= 0) change(o, { price: n });
  } else if (el.dataset.act === "test") {
    // Course d'essai : gardée dans la liste, mais hors du chiffre, de la compta et des statistiques
    if (confirm(o.is_test ? `Remettre la course n° ${o.ref} dans le chiffre et la compta ?` : `Course n° ${o.ref} : c'était un essai ? Elle restera dans la liste mais ne comptera plus dans le chiffre, la compta et les statistiques.`)) change(o, { is_test: !o.is_test });
  } else if (el.dataset.act === "hide") {
    if (confirm(`Effacer la course n° ${o.ref} ? Elle part dans la corbeille (rien n'est perdu, on peut la remettre).`)) hideOrders([o], true);
  } else if (el.dataset.act === "unhide") {
    hideOrders([o], false);
  } else if (el.dataset.act === "ics") {
    exportIcs([o]);
  }
}

async function onRefuse(e) {
  e.preventDefault();
  const f = e.target;
  const o = refusing;
  const key = f.reason.value;
  const reason = key === "autre" ? f.other.value.trim() : I18N.forLang(o.lang || "fr", key);
  if (!reason) return f.other.focus();
  $("#refuseModal").classList.add("hidden");
  // Le client reçoit la raison dans la conversation de sa course (dans sa langue)
  if (await change(o, { status: "refusee", admin_note: reason })) {
    Store.chatSend("o:" + o.id, "admin", "HOP!", clientMessage(Object.assign({}, o, { status: "refusee", admin_note: reason })))
      .catch(() => alert("La course est refusée, mais le message au client n'est pas parti."));
  }
}

async function onViewChange(e) {
  const t = e.target;
  if (t.dataset.act === "note") {
    const o = orderOf(t);
    if (o && (o.admin_note || "") !== t.value) change(o, { admin_note: t.value.trim() || null });
  } else if (t.dataset.act === "assign" && t.value) {
    const o = orderOf(t);
    const c = couriers.find(x => x.id === t.value);
    if (o && c && c.status === "en_attente") {
      // Nouveau livreur : on le valide (son crédit de départ arrive), puis on lui donne la course
      if (!confirm(`Valider ${c.name} comme livreur HOP! et lui donner la course n° ${o.ref} ?${c.topcase_at ? "" : "\n(Il n'a pas encore envoyé la photo de son top case.)"}`)) { t.value = ""; return; }
      Store.updateCourier(c.id, { status: "actif" }).then(() => { c.status = "actif"; return assignTo(o, c); })
        .catch(() => alert("Validation impossible, vérifiez la connexion."));
    } else if (o && c) assignTo(o, c);
  } else if (t.dataset.ract === "note") {
    Store.updateRequest(t.closest("[data-req]").dataset.req, { admin_note: t.value.trim() || null }).catch(() => alert("Note non enregistrée."));
  } else if (t.dataset.vpos) {
    moveVitrine(t.dataset.vpos, Number(t.value) - 1);
  } else if (t.dataset.sact === "note" || t.dataset.sact === "referrer" || t.dataset.sact === "kind") {
    const id = t.closest("[data-shop]").dataset.shop;
    const changes = t.dataset.sact === "note" ? { admin_note: t.value.trim() || null } : t.dataset.sact === "kind" ? { kind: t.value } : { referrer_id: t.value || null };
    Store.updateShop(id, changes).then(load, () => alert("Non enregistré, vérifiez la connexion."));
  } else if (t.dataset.cact === "note") {
    const id = t.closest("[data-courier]").dataset.courier;
    Store.updateCourier(id, { admin_note: t.value.trim() || null }).catch(() => alert("Note non enregistrée."));
  } else if (t.id === "histStatus") { histFilter.status = t.value; render(); }
  else if (t.id === "histDate") { histFilter.day = t.value || ""; histFilter.trash = false; render(); }
  else if (t.id === "billMonth") { billMonth = t.value; render(); }
}

function onViewInput(e) {
  if (!["histQ", "clientsQ", "shopsQ"].includes(e.target.id)) return;
  const id = e.target.id;
  if (id === "clientsQ") clientsQ = e.target.value; else if (id === "shopsQ") shopsQ = e.target.value; else histFilter.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const q = $("#" + id);
  q.focus();
  q.setSelectionRange(pos, pos);
}

// --- Démarrage ------------------------------------------------------------------
let pollTimer;
async function start() {
  $("#loginForm").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#logoutBtn").classList.remove("hidden");
  try { me = await Store.me(); } catch (e) { /* rechargé par load() */ }
  Store.staffVisitorMark();   // vos propres visites de l'appli client ne comptent pas dans « Visites du site »
  $("#demoNotice").classList.toggle("hidden", Store.ONLINE);
  // Alertes déjà autorisées : nouvelles commandes et messages aussi quand HOP! est fermé
  UI.pushSubscribe();
  renderDuty();
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 10000);
  // Notification reçue (nouvelle commande, paiement, client pas remboursé…) : la page se met à jour tout de suite
  if ("serviceWorker" in navigator && !window.hopSwListen) {
    window.hopSwListen = true;
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data && e.data.hop === "refresh") load();
      // Notification touchée alors que la page était ouverte : on ouvre la course
      if (e.data && e.data.hop === "open") load().then(() => bossFromUrl(e.data.url));
    });
  }
}

$("#loginForm").addEventListener("submit", onLogin);
$("#logoutBtn").addEventListener("click", async e => {
  e.preventDefault(); clearInterval(pollTimer);
  // Se déconnecter termine aussi le service : plus visible sur la carte des clients
  if (duty.watch != null) await toggleDuty();
  else await Store.setOnline(false).catch(() => {});
  try { localStorage.removeItem(LS_DUTY); } catch (ex) { /* ignore */ }
  Store.logout(); showLogin();
});
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; lastTab[groupOf(tab)] = tab; render(); if (tab === "clients") loadClients(); if (tab === "rayons") loadRayons(); if (tab === "paniers" || tab === "jours") loadCarts(); } });
// Une rubrique : on retrouve son dernier onglet (sinon le premier)
const lastTab = {};
$("#admGroups").addEventListener("click", e => {
  const b = e.target.closest("[data-group]");
  if (!b) return;
  tab = lastTab[b.dataset.group] || document.querySelector(`#tabs [data-group="${b.dataset.group}"]`).dataset.tab;
  render();
  if (tab === "clients") loadClients();
  if (tab === "paniers" || tab === "jours") loadCarts();
  if (tab === "visites") loadVisits();
});
$("#reloadBtn").addEventListener("click", load);
$("#routeBtn").addEventListener("click", openRoute);
$("#dutyBtn").addEventListener("click", toggleDuty);
$("#availBtn").addEventListener("click", toggleAvail);
$("#refuseForm").addEventListener("submit", onRefuse);
$("#refuseCancel").addEventListener("click", () => $("#refuseModal").classList.add("hidden"));
$("#icsBtn").addEventListener("click", () => exportIcs(agendaList().filter(o => active(o) && isMine(o)).sort(byTime)));
$("#ringStop").addEventListener("click", () => { waitingOrders().forEach(o => ringA.muted.add(o.id)); syncRing(); });
$("#ringSee").addEventListener("click", () => {
  const first = waitingOrders().find(o => !ringA.muted.has(o.id));
  if (first) return bossPopup(first.id);
  tab = "nouvelles"; render(); window.scrollTo({ top: $("#tabs").offsetTop - 10, behavior: "smooth" });
});
$("#bossModal").addEventListener("click", onBossClick);
$("#bossTakesBtn").addEventListener("click", toggleBossTakes);
// Zones ouvertes aux clients : c'est le patron qui ouvre (ou referme) une zone, pour tout le monde (client, livreurs, commerces)
$("#zonesChips").addEventListener("click", async e => {
  const b = e.target.closest("[data-zone]");
  if (!b) return;
  const z = CONFIG.zones.find(x => x.id === b.dataset.zone), on = UI.zoneActive(z.id);
  if (!confirm(on ? `Fermer ${z.fr} ? Les clients ne pourront plus y commander (« bientôt »).` : `Ouvrir ${z.fr} aux clients ? Les commandes et les prix de cette zone deviennent possibles tout de suite.`)) return;
  const list = CONFIG.zones.filter(x => (x.id === z.id ? !on : UI.zoneActive(x.id))).map(x => x.id);
  try { await Store.saveSettings({ zones_open: list }); settings.zones_open = list; UI.setZonesOpen(list); renderAvail(); }
  catch (ex) { alert("Réglage non enregistré (la base en ligne doit d'abord être mise à jour)."); }
});
$("#bossFirst").addEventListener("change", async e => {
  const never = e.target.value === "never", v = never ? Number(settings.boss_first_seconds ?? 60) : Number(e.target.value);
  const changes = { boss_only: never, boss_first_seconds: v };
  try { await Store.saveSettings(changes); Object.assign(settings, changes); renderAvail(); }
  catch (ex) { alert("Réglage non enregistré, vérifiez la connexion."); renderAvail(); }
});
$("#installBtn").classList.toggle("hidden", UI.inOwnApp() || !UI.canInstall());
$("#installBtn").addEventListener("click", () => UI.installApp("HOP! Patron", "patron/").then(ok => { if (ok) $("#installBtn").classList.add("hidden"); }));
$("#notifBtn").addEventListener("click", () => {
  if (!window.Notification) return alert("Les notifications ne sont pas disponibles sur ce navigateur.");
  Notification.requestPermission().then(p => {
    $("#notifBtn").textContent = p === "granted" ? "🔔 Alertes activées" : "🔕 Alertes refusées";
    if (p === "granted") { beep(); UI.pushSubscribe(); }
  });
});
$("#view").addEventListener("click", onViewClick);
// Accès envoyés : le bouton passe en « Renvoyer » et le commerce quitte la liste « attend ses accès »
$("#view").addEventListener("click", e => {
  const a = e.target.closest("[data-access-wa]");
  if (a) { markAccessSent(a.dataset.accessWa); setTimeout(render, 800); }
});
$("#liveList").addEventListener("click", e => { if (e.target.closest("a")) return; const it = e.target.closest("[data-focus]"), r = e.target.closest("[data-focus-c]"); if (it) focusOrder(it.dataset.focus); else if (r) focusCourier(r.dataset.focusC); });
$("#liveFit").addEventListener("click", () => { if (live.map && live.points && live.points.length) live.map.fitBounds(live.points, { padding: [40, 40], maxZoom: 15 }); });
$("#view").addEventListener("change", onViewChange);
$("#view").addEventListener("submit", e => { if (e.target.id === "rayForm") raySubmit(e); });
$("#view").addEventListener("change", async e => {
  if (e.target.id !== "rayPhoto" || !e.target.files[0]) return;
  rayStash();
  try { ray.edit.photo = await rayCrop(e.target.files[0]); render(); }
  catch (err) { alert(err.message === "too_big" ? "Photo trop lourde : prenez-la moins grande." : "Photo illisible."); }
});
$("#view").addEventListener("input", e => {
  if (e.target.id !== "rayPickQ") return;
  ray.edit.q = e.target.value;
  const x = ray.edit.x || {}, cur = { img: ray.edit.img !== undefined ? ray.edit.img : x.img, photo: ray.edit.photo !== undefined ? ray.edit.photo : x.photo };
  $("#rayGrid").innerHTML = rayGrid(ray.edit.q, cur);
});
UI.bindHours($("#view"));   // horaires des fiches commerce (menus, coupure, raccourcis)
$("#view").addEventListener("input", onViewInput);
window.addEventListener("storage", e => { if (/livraison\.(orders|couriers|shops|replies|requests)/.test(e.key || "") && Store.session()) load(); });
document.addEventListener("visibilitychange", async () => {
  // Le verrou d'écran est relâché quand on quitte la page : le reprendre au retour
  if (document.visibilityState === "visible" && duty.watch != null && navigator.wakeLock) {
    try { duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
  if (document.visibilityState === "visible" && duty.watch != null) dutyBack();
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
UI.forgotLink($("#loginForm"), $("#loginError"));
// Lien « Mot de passe oublié » : session reprise, nouveau mot de passe, puis l'espace patron
Store.adoptLinkSession().catch(() => false).then(async how => {
  if (how === "recovery") await UI.askNewPassword();
  if (Store.session()) start(); else showLogin();
});
// Le service était en cours avant de recharger la page : on le reprend
// (la notification « 🟢 En service » appartient à HOP! Livreur : le Patron n'y touche jamais, sinon Android l'efface aussi chez le livreur)
try { if (localStorage.getItem(LS_DUTY) && Store.session()) toggleDuty(); } catch (e) { /* ignore */ }

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
UI.iosInstallHint("HOP! Patron");
window.hopReady = true;

})();

// 📊 « Commande ouverte » touché : descend jusqu'à la liste des commandes ouvertes et pas envoyées
document.addEventListener("click", e => {
  if (!e.target.closest || !e.target.closest("[data-opened-go]")) return;
  const c = document.getElementById("openedCard");
  if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
});
