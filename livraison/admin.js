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
const openFolds = new Set();
document.addEventListener("toggle", e => {
  const k = e.target && e.target.dataset && e.target.dataset.fold;
  if (k) { if (e.target.open) openFolds.add(k); else openFolds.delete(k); }
}, true);
const foldOpen = k => openFolds.has(k) ? " open" : "";
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
    const ringNow = () => { beep(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };
    ringNow();
    ringA.timer = setInterval(ringNow, 3000);
  }
  if (!list.length && ringA.timer) { clearInterval(ringA.timer); ringA.timer = null; }
}

function alertNew(list, title) {
  beep();
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
      x => `🆕 Commande n° ${x.ref} — ${UI.money(x.price)}`);
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
  await refreshChats();
  renderAvail();
  // Ne pas effacer un champ en cours de saisie
  const typing = document.activeElement && $("#view").contains(document.activeElement)
    && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing) renderStats(); else render();
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
  $("#availTitle").textContent = on ? "🟢 Je prends des commandes immédiates" : "🔴 Complet : les clients ne peuvent que programmer pour plus tard";
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
  $("#bossOnlyText").textContent = bossOnly() ? "🔒 Seul vous recevez les courses : les livreurs ne voient rien tant que vous ne leur donnez pas une course." : "";
}

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
    Store.setOnline(false).catch(() => {});
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
  Store.setOnline(true).catch(() => {});
  UI.dutyNotice(true, "Vos clients vous voient sur la carte. Touchez ici pour revenir dans HOP! (Waze reste ouvert).");
  renderDuty();
}
// De retour dans HOP! (après Waze) : position tout de suite, écran allumé, notification « En service » remise
async function dutyBack() {
  if (duty.watch == null) return;
  duty.lastSent = 0;
  navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  UI.dutyNotice(true, "Vos clients vous voient sur la carte. Touchez ici pour revenir dans HOP! (Waze reste ouvert).");
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
    <p class="small" style="margin:4px 0">n° ${UI.esc(o.ref)} · ${UI.esc(UI.whenFr(o))}${o.first_order ? ` · <b class="new-client">🆕 Nouveau client</b>` : ""}${o.addon_ref ? ` · <b class="addon-pill">➕ Ajout à n° ${UI.esc(o.addon_ref)}${(p => p && p.courier_name ? ` (livreur : ${UI.esc(p.courier_name.split(" ")[0])})` : "")(orders.find(x => x.ref === o.addon_ref))}</b>` : ""}</p>
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
const needPhoto = o => !!(o.leave_at_door || o.photo_wanted);
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
  if (o.photo_wanted || o.leave_at_door) meta.push(`<span class="pill unpaid">📷 Photo du colis obligatoire${o.photo_wanted ? " (demandée par le client)" : " (devant la porte)"}</span>`);
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
  if (Number(o.wait_fee) > 0) meta.push(`<span class="pill unpaid">⏱️ Attente ${o.wait_minutes} min · +${UI.money(o.wait_fee)} (au livreur)</span>`);
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
  if (o.courier_id && !isMine(o)) meta.push(`<span class="pill courier-pill">🛵 ${UI.esc(o.courier_name || "Livreur")} · commission ${o.network ? "réseau " : ""}${UI.money(o.commission || 0)}${Number(o.hop_share) > 0 ? ` + part Pro ${UI.money(o.hop_share)}` : ""}</span>`);
  if (o.adult_items) meta.push(o.id_checked_at ? `<span class="pill paid">🪪 ${UI.esc(o.adult_items.replace(",", " + "))} · identité vérifiée ${UI.esc(UI.fmtTime(o.id_checked_at))}</span>` : `<span class="pill unpaid">🔞 ${UI.esc(o.adult_items.replace(",", " + "))} · pièce d'identité à vérifier</span>`);
  if (o.shop_ref) meta.push(`<span class="pill star-pill">🛍️ Sac n° ${UI.esc(o.shop_ref)}</span>`);
  if (Number(o.tip) > 0) meta.push(`<span class="pill ${o.tip_status === "promis" ? "unpaid" : "paid"}">💝 Pourboire ${UI.money(o.tip)} · ${TIP_FR[o.tip_status] || ""}</span>`
    + (o.tip_status === "promis" && !o.direct_pay ? `<button class="pill pill-btn paid" data-act="tipok" title="Le Bit du client est arrivé : le pourboire sera reversé au livreur avec son solde">✅ Pourboire reçu</button>` : ""));
  if (o.round_trip) meta.push(`<span class="pill">🔁 Aller-retour</span>`);
  if (o.extra_stops && !(o.stops || []).length) meta.push(`<span class="pill">+${o.extra_stops} arrêt(s)</span>`);
  if (o.distance_km) meta.push(`<span class="pill">${Number(o.distance_km).toFixed(0)} km</span>`);
  if (o.promo_code) meta.push(`<span class="pill">🎁 ${UI.esc(o.promo_code)} −${UI.money(o.discount || 0)}</span>`);
  meta.push(`<span class="pill">👤 ${tel(o.contact_name, o.contact_phone)}${o.company ? " · " + UI.esc(o.company) : ""}</span>`);
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
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}${when}</span>
      <span class="pill st-${UI.esc(o.status)}">${st.icon} ${st.label}</span>${o.is_test ? ` <span class="pill">🧪 Test · hors chiffre</span>` : ""}
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(o.price)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span>📍</span><div>${UI.brand(o.pickup_place)}<b><bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(UI.cityFr(o.from_city))}</b>${UI.addrDetails(o, "pickup")}${UI.addrNote(o.pickup_note)}${pickupExtra}<span class="small muted">${tel(o.pickup_contact, o.pickup_phone)}</span>${nav("pickup")}</div></div>
      ${UI.stopsLegs(o, true)}
      <div class="leg"><span>🏁</span><div>${UI.brand(o.dropoff_place)}<b><bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(UI.cityFr(o.to_city))}</b>${UI.addrDetails(o, "dropoff")}${UI.addrNote(o.dropoff_note)}${UI.doorTag(o)}<span class="small muted">${tel(o.dropoff_contact, o.dropoff_phone)}</span>${nav("dropoff")}</div></div>
    </div>
    <div class="meta">${meta.join("")}</div>
    ${o.notes ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
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
  const delivered = orders.filter(o => o.status === "livree" && !o.is_test && UI.dayKey(o.pickup_at).startsWith(month));
  $("#stMonthRev").textContent = UI.money(sum(delivered, o => Number(o.price) + Number(o.discount || 0) + Number(o.shop_share || 0)));
  $("#stMonthHop").textContent = UI.money(sum(delivered.filter(o => !isMine(o)), o => Number(o.commission || 0) + Number(o.hop_share || 0) - Number(o.discount || 0))
    + sum(planSales.filter(p => String(p.created_at).startsWith(month)), p => Number(p.amount) - Number(p.referrer_share || 0)));
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
  try { visits.data = (await Store.adminAnalytics(visits.days)) || { empty: true }; } catch (e) { visits.data = { error: true }; }
  visits.busy = false; visits.at = Date.now();
  if (tab === "visites") render();
}
const SRC_LABEL = { direct: "✍️ Direct (lien tapé, favori, appli, WhatsApp privé)", google: "🔎 Google", facebook: "📘 Facebook", instagram: "📸 Instagram",
  tiktok: "🎵 TikTok", whatsapp: "💬 WhatsApp", twitter: "🐦 X / Twitter", bing: "🔎 Bing", flyer: "🧾 Flyers (QR)", qr: "🔳 QR du kit pub",
  "qr-commerce": "🏪 QR d'un commerce (autocollant, lien du commerce)" };
const PAGE_LABEL = { index: "🏠 Accueil et commande", suivi: "📍 Suivi d'une course", commerce: "🏪 Espace commerce", "on-livre": "📦 « Ce qu'on livre »",
  recu: "🧾 Reçus", kit: "📣 Kit pub" };
const pct = (a, b) => (b ? Math.round(a * 100 / b) : 0) + " %";
function vBars(rows, key, label) {
  const max = Math.max(1, ...rows.map(r => Number(r[key]) || 0));
  return `<div class="v-bars">${rows.map(r => `<div class="v-bar" title="${UI.esc(label(r))} : ${Number(r[key]) || 0}"><b>${Number(r[key]) || ""}</b><i style="height:${Math.round((Number(r[key]) || 0) * 100 / max)}%"></i><small>${UI.esc(label(r))}</small></div>`).join("")}</div>`;
}
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
      <div class="stat"><small>Commande ouverte</small><b>${d.started}</b><em class="muted small">${pct(d.started, d.sessions)} des visites</em></div>
      <div class="stat"><small>Commandes envoyées</small><b>${d.sent}</b><em class="muted small">${pct(d.sent, d.sessions)} des visites · ${UI.money(d.sent_amount)}</em></div>
      <div class="stat"><small>Depuis l'appli installée</small><b>${d.app}</b><em class="muted small">${pct(d.app, d.sessions)} des visites</em></div>
    </div>
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
const rayPic = (x, cls) => (x.photo ? `<img class="${cls}" src="${x.photo}" alt="" />` : x.img ? `<img class="${cls}" src="img/qc/${x.img}.webp" alt="" />` : `<i class="${cls}">${x.e || "🛒"}</i>`);
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
    ${hiddenItems.length || hiddenCats.length ? `<details class="card ray-off"><summary>🚫 Masqués (${hiddenItems.length + hiddenCats.length}) : les clients ne les voient pas</summary>${hiddenCats.map(c => `<div class="ray-row off">${rayPic(c, "ray-img")}<div class="ray-txt"><b>${UI.esc(c.fr)}</b><small>catégorie entière</small></div><span class="ray-act"><button type="button" class="btn btn-sm" data-ray-chide="${c.id}" data-on="0">↩️ Rétablir</button></span></div>`).join("")}${hiddenItems.map(row).join("")}</details>` : ""}`;
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
      <label class="f">Place dans le top case<select name="sz">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${Number(val("sz", x.sz || 1)) === n ? " selected" : ""}>${n}${n === 1 ? " (petit article)" : n >= 4 ? " (gros : couches, pack)" : ""}</option>`).join("")}</select></label>
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
    view.innerHTML = list.length ? groupedByDay(list) : empty('Aucune course à venir. Partagez votre page avec le <a href="kit.html">kit pub</a> !');
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
  } else if (tab === "clients") {
    renderClients(view);
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
        <td class="num">${Number(x.reserved) ? UI.money(x.reserved) : "—"}</td><td class="num"><button class="btn btn-sm" data-credit-add="${UI.esc(c.id)}" data-name="${UI.esc(c.name)}">➕ Crédit</button></td></tr>`; }).join("") || `<tr><td colspan="4" class="muted">Pas encore de livreur.</td></tr>`}
    </tbody></table></div>
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
    <details class="fin-more" style="margin:10px 0"><summary>ℹ️ Comment c'est calculé</summary><p class="small muted" style="margin-top:8px">Nouvelles courses : les clients paient les livreurs directement, et tout passe par leur crédit HOP (carte ci-dessus) ; « ✓ Réglé » ne sert que pour un échange d'argent en dehors du crédit. Anciennes courses : les livreurs encaissaient les clients et vous versaient leur commission chaque semaine : ${UI.commissionText()}, ou ${UI.networkText()} sur les courses des commerces qu'ils ont amenés. Vous leur reversez : les courses payées à HOP (Bit, programmées, carnets), la part des commerces Pro, les codes promo, les pourboires reçus, leurs bonus réseau${CONFIG.pro.referrerPercent ? ` et ${CONFIG.pro.referrerPercent} % des abonnements Pro qu'ils ont fait signer` : " (pas de part sur les abonnements Pro pour l'instant)"}. Au-delà de ${UI.money(settings.max_debt)} dus, un livreur ne peut plus accepter de course. Attente ou achats au départ : ${UI.esc(UI.waitRule(settings))}, ajoutés au prix et versés en entier au livreur.</p></details>
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
      <details style="margin-top:8px"><summary class="small">Déjà ajoutés ou appris (<span id="dirCount">…</span>)</summary><div id="dirList" class="small"></div></details>
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
      const k = "s:" + x.id, open = x.status === "en_attente" || openFolds.has(k);
      return `<details class="order-fold shop-fold" data-shop="${UI.esc(x.id)}" data-fold="${UI.esc(k)}"${open ? " open" : ""}><summary>
        <span>${vpos(x) < 1e9 ? `<em class="vit-n" title="Position sur l'accueil">${vpos(x) + 1}</em> ` : ""}${x.status === "en_attente" ? "⏳" : x.status === "suspendu" ? "⛔" : "✅"} <b>${UI.esc(x.name)}</b>${Store.planActive(x) ? " · ⭐ Pro" : ""}${x.address ? " · " + UI.esc(x.address) : ""}</span>
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
          <details class="shop-fiche"><summary>📝 Fiche pour les clients : WhatsApp, paiement, horaires, présentation${x.whatsapp ? " · 💬 " + UI.esc(x.whatsapp) : ""}${x.pay_link || x.pay_bit ? " · 💳" : ""}</summary>
            <label class="f"><span>WhatsApp du commerce (les clients peuvent l'écrire directement)</span><input data-fiche="whatsapp" inputmode="tel" placeholder="053-373-3785" value="${UI.esc(x.whatsapp ? "0" + String(x.whatsapp).replace(/^972/, "") : "")}" /></label>
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
async function loadClients() {
  clients = (await Store.adminClients().catch(() => null)) || clients;
  if (tab === "clients") render();
}
function renderClients(view) {
  const q = clientsQ.trim().toLowerCase(), qd = q.replace(/\D/g, "");
  const withAcc = clients.filter(c => c.client_id);
  const month = today().slice(0, 7);
  const list = clients.filter(c => !q || String(c.name || "").toLowerCase().includes(q) || (qd && String(c.phone || "").replace(/\D/g, "").includes(qd)));
  const day = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
  // Client qui est aussi une enseigne (même numéro) : on le montre
  const d9 = v => String(v || "").replace(/\D/g, "").slice(-9);
  const shopOfClient = c => d9(c.phone) && shops.find(x => !x.demo && (d9(x.phone) === d9(c.phone) || d9(x.whatsapp) === d9(c.phone)));
  view.innerHTML = `
    <div class="stats">
      <div class="stat"><small>Comptes clients</small><b>${withAcc.length}</b></div>
      <div class="stat"><small>Nouveaux comptes ce mois</small><b>${withAcc.filter(c => String(c.account_at || "").startsWith(month)).length}</b></div>
      <div class="stat"><small>Clients au total</small><b>${clients.length}</b></div>
      <div class="stat"><small>Commerces · livreurs actifs</small><b>${shops.filter(x => !x.demo && x.status === "actif").length} · ${couriers.filter(c => c.role !== "admin" && c.status === "actif").length}</b></div>
    </div>
    <p class="muted small" style="margin:-8px 0 12px">Un client crée son compte dans l'appli (« Mes courses ») avec son téléphone et un mot de passe : accepté tout de suite, sans e-mail de confirmation pour l'instant. Les clients sans compte apparaissent ici d'après leur numéro de téléphone.</p>
    <div class="toolbar"><input id="clientsQ" type="search" placeholder="Rechercher un client (nom ou téléphone)" value="${UI.esc(clientsQ)}" /></div>
    ${list.length ? `<div class="orders">${list.map(c => { const k = "u:" + (c.client_id || d9(c.phone)), sh = shopOfClient(c); return `
      <details class="order-fold shop-fold" data-fold="${UI.esc(k)}"${foldOpen(k)}><summary>
        <span>${c.client_id ? "👤" : "📞"} <b>${UI.esc(c.name || "—")}</b>${sh ? " · 🏪 " + UI.esc(sh.name) : ""}${c.blocked ? " · ⛔" : ""}</span>
        <b>${Number(c.delivered || 0)} 📦</b></summary>
      <article class="order" data-client="${UI.esc(c.client_id || "")}">
        <div class="order-head">
          <span class="order-time">${UI.esc(c.name || "—")}</span>
          <span class="pill${c.client_id ? " paid" : ""}">${c.client_id ? "👤 Compte" : "Sans compte"}</span>
          ${c.blocked ? `<span class="pill" style="background:#FDE2E2;color:#9B1C1C">⛔ Bloqué</span>` : ""}
          ${sh ? `<span class="pill">🏪 Enseigne : ${UI.esc(sh.name)}</span>` : ""}
          <span class="order-price">${Number(c.delivered || 0)} livrée(s)</span>
        </div>
        <div class="kv">
          <div><span>📞</span><span>${tel(c.name, c.phone)}${c.email ? " · " + UI.esc(c.email) + (c.email_verified ? " ✅" : " (à vérifier)") : ""}</span></div>
          <div><span>📦</span><span>${Number(c.orders || 0)} commande(s) · ${UI.money(Number(c.spent || 0))} livrés${c.city ? " · " + UI.esc(UI.cityFr(c.city)) : ""}</span></div>
          <div><span>📅</span><span>${c.client_id ? "Compte créé le " + day(c.account_at) + " · " : ""}dernière commande : ${c.orders ? day(c.last_at) : "—"}</span></div>
        </div>
        <div class="actions">
          ${c.client_id ? `<button class="btn btn-sm" data-client-reset="${UI.esc(c.client_id)}" data-cname="${UI.esc(c.name || "")}">🔑 Nouveau mot de passe</button>` : ""}
          ${c.blocked ? `<button class="btn btn-sm" data-unblock="${UI.esc(c.phone)}">🔓 Débloquer</button>` : ""}
        </div>
      </article></details>`; }).join("")}</div>` : `<div class="empty card">${clients.length ? "Aucun client ne correspond." : "Aucun client pour l'instant."}</div>`}`;
}

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
  view.innerHTML = `<div class="toolbar">
      <label class="small muted">Mois <input type="month" id="billMonth" value="${billMonth}" /></label>
      <button class="btn btn-sm" id="csvBtn" ${list.length ? "" : "disabled"}>⬇️ Export CSV</button>
      <span class="small muted">💵 Espèces ${UI.money(cash)} · 📱 Bit ${UI.money(bit)} (toutes courses, livreurs compris)</span>
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

function exportCsv() {
  const cols = ["ref", "pickup_at", "company", "contact_name", "contact_phone", "service", "from_city", "to_city", "price", "promo_code", "payment_method", "payment_status", "courier_name", "commission"];
  const cell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [cols.join(";")].concat(monthOrders().sort(byTime).map(o =>
    cols.map(c => cell(c === "pickup_at" ? UI.fmtDateTime(o[c]) : c.endsWith("_city") ? UI.cityFr(o[c]) : o[c])).join(";")));
  download(`courses-${billMonth}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
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
      <button type="button" class="btn btn-sm btn-link" data-close-thread="${UI.esc(t.thread)}">✓ Terminer la discussion</button>
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
      && confirm(`${courier.name} est hors ligne : la course n° ${o.ref} l'attend dans son appli HOP! Livreur (elle s'ouvrira dès qu'il l'ouvre).\n\nL'appeler maintenant ?`))
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
      if (bit && !/^0\d{8,9}$/.test(bit)) return alert("Numéro Bit / PayBox invalide (ex. 053-373-3785).");
      changes = { whatsapp: wa || null, about: v("about") || null, hours: hours.some(h => h.h) ? hours : null, pay_link: link || null, pay_bit: bit || null };
    } else if (el.dataset.sact === "showcase") {
      changes = { showcase: !shop.showcase };
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
  UI.dutyNotice(false);
  Store.logout(); showLogin();
});
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; lastTab[groupOf(tab)] = tab; render(); if (tab === "clients") loadClients(); if (tab === "rayons") loadRayons(); } });
// Une rubrique : on retrouve son dernier onglet (sinon le premier)
const lastTab = {};
$("#admGroups").addEventListener("click", e => {
  const b = e.target.closest("[data-group]");
  if (!b) return;
  tab = lastTab[b.dataset.group] || document.querySelector(`#tabs [data-group="${b.dataset.group}"]`).dataset.tab;
  render();
  if (tab === "clients") loadClients();
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
$("#installBtn").classList.toggle("hidden", UI.inOwnApp());
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
  if (document.visibilityState === "visible") { if (duty.watch == null) UI.dutyNotice(false); else dutyBack(); }
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
UI.forgotLink($("#loginForm"), $("#loginError"));
// Lien « Mot de passe oublié » : session reprise, nouveau mot de passe, puis l'espace patron
Store.adoptLinkSession().catch(() => false).then(async how => {
  if (how === "recovery") await UI.askNewPassword();
  if (Store.session()) start(); else showLogin();
});
// Le service était en cours avant de recharger la page : on le reprend
try { if (localStorage.getItem(LS_DUTY) && Store.session()) toggleDuty(); else UI.dutyNotice(false); } catch (e) { /* ignore */ }

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
UI.iosInstallHint("HOP! Patron");
window.hopReady = true;

})();
