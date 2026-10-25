// ============================================================================
// Espace patron : agenda, attribution aux livreurs, refus motivé, disponibilité,
// position GPS, encaissements, livreurs partenaires, paiements hebdomadaires.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
const LS_SEEN = "livraison.seenIds.v1";
Store.useSpace("admin");

let orders = [];
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
let clientsQ = "";
let penalties = [];   // retenues aux livreurs (courses pas faites, pas reçues)
let credits = { credits: [], topups: [] };   // crédit prépayé des livreurs et leurs recharges
let accounts = [];   // comptes (inscription finie ou pas, notifications activées), voir Store.adminAccounts
let declines = [];    // refus des 30 derniers jours (avec la raison)   // abonnements HOP! Pro payés (part du livreur qui a amené le commerce)
let msgs = { messages: [], replies: [] };
let me = null;
let settings = { accepting: true, message: "", commission: CONFIG.platform.commissionPerCourse };
let tab = "agenda";
let firstLoad = true;
let histFilter = { status: "", q: "" };
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
    // Commerces et messages : un souci ici ne doit pas bloquer les courses
    const [sh, m, rq, sa] = await Promise.all([Store.listShops().catch(() => null), Store.listMessages().catch(() => null),
      Store.listRequests().catch(() => null), Store.listCarnetSales().catch(() => null)]);
    planSales = (await Store.listPlanSales().catch(() => null)) || planSales;
    penalties = (await Store.listPenalties().catch(() => null)) || penalties;
    credits = (await Store.adminCredits().catch(() => null)) || credits;
    declines = (await Store.listDeclines().catch(() => null)) || declines;
    accounts = (await Store.adminAccounts().catch(() => null)) || accounts;
    if (sh) shops = sh;
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
  const bf = $("#bossFirst"), v = String(Number(settings.boss_first_seconds ?? 60));
  if (![...bf.options].some(x => x.value === v)) bf.add(new Option(v + " s", v));
  if (document.activeElement !== bf) bf.value = v;
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
  const wait = bossTakes() ? Math.ceil((new Date(o.created_at).getTime() + Number(settings.boss_first_seconds || 0) * 1000 - Date.now()) / 1000) : 0;
  const list = rankedCouriers(o);
  $("#bossBody").innerHTML = `
    <h3>🔔 Nouvelle course · ${UI.money(o.price)}${o.urgency === "express" ? " · ⚡ EXPRESS" : ""}</h3>
    <p class="small" style="margin:4px 0">n° ${UI.esc(o.ref)} · ${UI.esc(UI.whenFr(o))}</p>
    <p style="margin:6px 0"><b>${UI.esc(o.pickup_address || UI.cityFr(o.from_city))}</b> → <b>${UI.esc(o.dropoff_address || UI.cityFr(o.to_city))}</b></p>
    <p class="small muted" style="margin:0 0 12px">${!bossTakes() && nobodyTook(o) ? "⚠️ <b>Personne ne l'a prise</b> : prenez-la, ou donnez-la à un livreur (même hors ligne : appelez-le, elle l'attend dans son appli)." : !bossTakes() ? "🛵 Envoyée aux livreurs : le premier qui accepte la prend. Vous pouvez aussi la donner vous-même :" : wait > 0 ? `Les livreurs la reçoivent dans ${wait} s si vous ne faites rien.` : "Les livreurs la voient déjà : le premier qui accepte la prend."}</p>
    ${canTake(o) ? `<button type="button" class="btn btn-primary btn-block" data-boss="take">✅ Je la prends</button>` : ""}
    <p class="small" style="margin:14px 0 6px"><b>🛵 La donner à :</b></p>
    <div class="boss-list">${list.length ? list.map(({ c, km }) => `<button type="button" class="btn btn-block" data-boss-give="${UI.esc(c.id)}">${onlineOf(c).on ? "🟢" : "⚪"} ${UI.esc(c.name)}${km != null ? ` · 📍 ${km.toFixed(1)} km` : ""}${onlineOf(c).on ? "" : " · hors ligne : la verra en ouvrant l'appli"}${balanceOf(c.id) > Number(settings.max_debt) ? " · 🔒 solde dû" : ""}</button>`).join("") : `<p class="small muted">Aucun livreur validé pour l'instant.</p>`}</div>
    <button type="button" class="btn btn-link btn-block" data-boss="later">${bossTakes() ? "Laisser aux livreurs" : "OK, je laisse les livreurs"}</button>`;
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
// Adresse ouverte par la notification : patron/?o=<course>
function bossFromUrl(url) {
  try {
    const id = new URL(url, location.href).searchParams.get("o");
    if (id) { history.replaceState(null, "", location.pathname); bossPopup(id); }
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
  const when = o.urgency === "programmee" ? UI.fmtTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS" : "Dès que possible";
  const nav = which => `<div class="links">
      <a class="btn btn-sm" href="${UI.wazeLink(o, which)}" target="_blank" rel="noopener">Waze</a>
      <a class="btn btn-sm" href="${UI.mapsLink(o, which)}" target="_blank" rel="noopener">Maps</a></div>`;

  let pickupExtra = "";
  if (o.service === "retrait") {
    pickupExtra = `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° <b style="display:inline">${UI.esc(o.tracking_number || "—")}</b>${o.retrait_code ? ` · code du casier <b style="display:inline">${UI.esc(o.retrait_code)}</b>` : ` · au nom de ${UI.esc(o.parcel_name || "—")}`}${o.appt_at ? ` · 📅 rendez-vous ${UI.esc(UI.fmtDateTime(o.appt_at))}` : ""}</div>`;
  } else if (o.service === "achat") {
    pickupExtra = `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.budget ? ` · budget ≈ ${UI.money(o.budget)}` : ""} · 🧾 réglé par le client au magasin</div>`;
  }

  const meta = [
    `<span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>`,
    `<span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>`,
    `<span class="pill ${o.payment_status === "paye" ? "paid" : "unpaid"}">${UI.PAY_FR[o.payment_method] || ""} · ${o.payment_status === "paye" ? "encaissé" : "à encaisser"}${o.payer === "destinataire" ? " (par le destinataire)" : ""}</span>`
  ];
  if (o.courier_id && !isMine(o) && !["annulee", "refusee"].includes(o.status)) {
    meta.push(`<button class="pill pill-btn ${o.paid_to === "hop" ? "paid" : ""}" data-act="paidto" title="Qui a reçu l'argent du client ?">${o.paid_to === "hop" ? "💳 Payée à HOP (reversée au livreur)" : "🛵 Payée au livreur"} ⇄</button>`);
  }
  // HOP! Pro : préparation chez le commerce, et sa part de la livraison
  if (o.shop_status && o.shop_status !== "refusee") meta.push(`<span class="pill">${o.shop_status === "attente" ? "🍳 Attente du commerce"
    : o.shop_status === "prete" ? "✅ Prête au commerce" : `🍳 Prête à ${UI.esc(new Date(o.ready_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))}`}${Number(o.shop_share) > 0 ? ` · commerce ${UI.money(o.shop_share)}` : ""}</span>`);
  if (o.shop_order) meta.push(`<span class="pill">🧾 ${UI.esc(o.shop_order.slice(0, 80))}</span>`);
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
  if (o.payment_method === "cash") meta.push(`<span class="pill">💵 Espèces : client ${UI.money(Number(o.price) + Number(o.cash_goods || 0))}${Number(o.cash_goods) > 0 ? ` · articles ${UI.money(o.cash_goods)} au commerce ${o.cash_shop_at ? "✅ reçus" : "⏳"}` : ""} · course ${UI.money(o.price)}${Number(o.cash_note) > 0 ? ` · billet ${UI.money(o.cash_note)}` : ""}</span>`);
  if (o.payment_method === "bit" && o.payment_status !== "paye" && o.client_paid_at) meta.push(o.direct_pay && !isMine(o)
    ? `<span class="pill unpaid">💳 Le client dit avoir payé le livreur · le livreur confirme</span>`
    : `<span class="pill unpaid" title="Vérifiez votre Bit, puis marquez la course payée">💳 Le client dit avoir payé par Bit · à vérifier</span>`);
  if (o.prepaid_required) meta.push(`<span class="pill ${o.payment_status === "paye" ? "paid" : "st-annulee"}">💳 Payée d'avance : ${o.payment_status === "paye" ? "reçu ✓" : "EN ATTENTE"}</span>`);
  if (o.shop_name) {
    const ref = couriers.find(c => c.id === o.referrer_id);
    meta.push(`<span class="pill star-pill">🏪 ${UI.esc(o.shop_name)}${ref && ref.role !== "admin" ? ` · parrain ${UI.esc(ref.name)} +${UI.money(o.referral_bonus || 0)}` : ""}</span>`);
  }
  if (o.courier_id && !isMine(o)) meta.push(`<span class="pill courier-pill">🛵 ${UI.esc(o.courier_name || "Livreur")} · commission ${o.network ? "réseau " : ""}${UI.money(o.commission || 0)}${Number(o.hop_share) > 0 ? ` + part Pro ${UI.money(o.hop_share)}` : ""}</span>`);
  if (o.adult_items) meta.push(`<span class="pill unpaid">🔞 ${UI.esc(o.adult_items.replace(",", " + "))} · pièce d'identité</span>`);
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
      + (o.courier_id && !isMine(o) ? `<select class="btn btn-sm" data-act="assign"><option value="">🔁 Donner à un autre…</option>${active.filter(({ c }) => c.id !== o.courier_id).map(({ c }) => `<option value="${UI.esc(c.id)}">${onlineOf(c).on ? "🟢" : "⚪"} ${UI.esc(c.name)}</option>`).join("")}</select><button class="btn btn-sm" data-act="take">✋ Je la reprends</button>` : "")
      + `<button class="btn btn-sm" data-act="release">↩︎ Remettre en attente</button>` + b("annulee", "✖ Annuler"),
    recuperee: b("livree", "📦 Livré", "btn-primary")
  };

  return `
  <article class="order${o.status === "nouvelle" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${withDay ? UI.esc(UI.fmtDay(o.pickup_at)) + " · " : ""}${when}</span>
      <span class="pill st-${UI.esc(o.status)}">${st.icon} ${st.label}</span>
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
      ${o.receipt_number && o.contact_email ? `<a class="btn btn-sm" href="mailto:${UI.esc(o.contact_email)}?subject=${encodeURIComponent(`Reçu n° ${o.receipt_number} · קבלה מס' ${o.receipt_number}`)}&body=${encodeURIComponent(UI.clientMessage(o))}">✉️ Reçu par mail</a>` : ""}
      <button class="btn btn-sm" data-act="price">✏️ Prix</button>
      <button class="btn btn-sm" data-act="ics">📅</button>
      <textarea class="admin-note" data-act="note" rows="1" placeholder="Message visible par le client sur la page de suivi…">${UI.esc(o.admin_note || "")}</textarea>
    </div>
  </article>`;
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
  const delivered = orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(month));
  $("#stMonthRev").textContent = UI.money(sum(delivered, o => Number(o.price) + Number(o.discount || 0) + Number(o.shop_share || 0)));
  $("#stMonthHop").textContent = UI.money(sum(delivered.filter(o => !isMine(o)), o => Number(o.commission || 0) + Number(o.hop_share || 0) - Number(o.discount || 0))
    + sum(planSales.filter(p => String(p.created_at).startsWith(month)), p => Number(p.amount) - Number(p.referrer_share || 0)));
  const pending = couriers.filter(c => c.status === "en_attente").length + unfinished().length;
  const pendingShops = shops.filter(x => x.status === "en_attente").length;
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
// Rubrique de l'onglet ouvert : seuls ses onglets s'affichent ; chiffres et service seulement dans « Courses »
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
  } else if (tab === "hebdo") {
    renderWeek(view);
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
    const list = orders
      .filter(o => !histFilter.status || o.status === histFilter.status)
      .filter(o => !q || [o.ref, o.company, o.contact_name, o.contact_phone, o.pickup_address, o.dropoff_address, o.courier_name].join(" ").toLowerCase().includes(q))
      .sort((a, b) => byTime(b, a));
    view.innerHTML = `<div class="toolbar">
        <select id="histStatus"><option value="">Tous les statuts</option>${Object.entries(Store.STATUSES).map(([k, s]) => `<option value="${k}" ${histFilter.status === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
        <input id="histQ" type="search" placeholder="Rechercher (n°, client, téléphone, adresse, livreur)" value="${UI.esc(histFilter.q)}" />
      </div>
      ${list.length ? `<div class="orders">${list.map(o => card(o, true)).join("")}</div>` : empty("Aucune course.")}`;
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

  const list = orders.filter(o => ["nouvelle", "confirmee", "recuperee"].includes(o.status)).sort(byTime);
  list.forEach(o => {
    const pr = progressOf(o);
    const pick = point(o.pickup_lat, o.pickup_lon), drop = point(o.dropoff_lat, o.dropoff_lon);
    const label = `<b>N° ${UI.esc(o.ref)}</b> · ${UI.money(o.price)}<br>${UI.esc(pr.text)}`;
    if (o.status !== "recuperee") add(pick, o.status === "nouvelle" ? "🆕" : SERVICE_PIN[o.service] || "📍", `${label}<br>📍 ${UI.esc(UI.placeQuery(o, "pickup"))}`, o.status === "nouvelle" ? "pin-wait" : "");
    add(drop, "🏁", `${label}<br>🏁 ${UI.esc(UI.placeQuery(o, "dropoff"))}`);
    if (pick && drop) L.polyline([[pick.lat, pick.lon], [drop.lat, drop.lon]], { color: "#98A2B3", weight: 2, dashArray: "4 6" }).addTo(live.layer);
    if (pr.pos && pr.target) L.polyline([[pr.pos.lat, pr.pos.lon], [pr.target.lat, pr.target.lon]], { color: "#FF6A13", weight: 4 }).addTo(live.layer);
  });
  couriers.filter(fresh).forEach(c => {
    const n = list.filter(o => o.courier_id === c.id).length;
    add(point(c.lat, c.lon), "🛵", `<b>${UI.esc(c.name)}</b>${c.role === "admin" ? " (vous)" : ""}<br>${n} course(s) en cours · position ${ago(c.position_at)}`, "pin-courier");
  });
  if (!live.fitted && pts.length) { live.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); live.fitted = true; }
  live.points = pts;

  const onDuty = couriers.filter(c => c.status === "actif" && onlineOf(c).on);
  $("#liveList").innerHTML = `<p class="small muted" style="margin-bottom:6px">🟢 En ligne : ${onDuty.length ? onDuty.map(c => UI.esc(c.name) + (c.role === "admin" ? " (vous)" : "")).join(", ") : "personne pour l'instant"}</p>`
    + (list.length ? list.map(o => {
      const pr = progressOf(o);
      return `<div class="order live-item" data-focus="${UI.esc(o.id)}">
        <div class="order-head"><span class="order-time">${UI.esc(UI.cityFr(o.from_city))} → ${UI.esc(UI.cityFr(o.to_city))}</span><span class="order-price">${UI.money(o.price)}</span></div>
        <div class="small">N° ${UI.esc(o.ref)} · ${pr.c ? "🛵 " + UI.esc(pr.c.name) : "sans livreur"}${pr.c && !pr.pos ? " · position inconnue" : ""}</div>
        <div class="small"><b>${UI.esc(pr.text)}</b></div>
        <div class="progress">${[0, 1, 2, 3].map(i => `<i class="${i <= pr.step ? "on" : ""}"></i>`).join("")}</div>
      </div>`;
    }).join("") : `<div class="empty card">Aucune course en cours.</div>`);
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
function unfinished() { return accounts.filter(a => !a.has_fiche); }
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
      const done = orders.filter(o => o.courier_id === c.id && o.status === "livree").length;
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
  const inWeek = o => { const k = UI.dayKey(o.pickup_at); return o.status === "livree" && k >= start && k <= end; };
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
function renderShops(view) {
  const month = today().slice(0, 7);
  const viaShop = orders.filter(o => o.shop_id && o.status === "livree");
  const order = ["en_attente", "actif", "suspendu"];
  // Les vitrines de démonstration ont leur propre carte (liens à montrer aux commerces), pas dans la liste
  const list = shops.filter(x => !x.demo).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const demos = [["DEMO-RESTO", "🍔 Restaurant"], ["DEMO-BOULANGERIE", "🥐 Boulangerie"], ["DEMO-BOUTIQUE", "👗 Boutique"]]
    .map(([code, label]) => ({ code, label, url: UI.appUrl("index.html") + "?c=" + code, space: UI.appUrl("commerce.html") + "?demo=" + code.split("-")[1].toLowerCase() }));
  // Retirer les démos d'un geste (elles sont seulement suspendues, jamais effacées : on peut les remettre)
  const demoShops = shops.filter(x => x.demo), demoOn = demoShops.some(x => x.status === "actif");
  const signup = UI.appUrl("commerce.html") + (me && me.ref_code ? "?p=" + me.ref_code : "");
  const statusLabel = { en_attente: "⏳ À vérifier", actif: "✅ Partenaire", suspendu: "⛔ Suspendu" };
  const bonusDue = sum(orders.filter(o => o.status === "livree" && Number(o.referral_bonus) > 0 && o.referral_status !== "regle"), o => Number(o.referral_bonus));
  view.innerHTML = `
    <div class="card" style="margin-bottom:14px" id="dirCard">
      <b>📖 Annuaire : ajouter un commerce</b>
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
    </div>
    <div class="card" style="margin-bottom:14px">
      <b>🎬 Vitrines de démonstration</b>
      <p class="muted small" style="margin:4px 0 8px">À montrer en rendez-vous : un restaurant, une boulangerie et une boutique avec un catalogue complet. Le commerçant voit sa future vitrine (côté client) et son espace (🧑‍🍳 : ajouter un article, changer un prix, accepter une commande) ; aucune commande ne part, rien n'est envoyé. Invisibles pour les clients.</p>
      ${demoOn ? `<div class="actions">${demos.map(d => `<a class="btn btn-sm btn-primary" href="${UI.esc(d.url)}" target="_blank" rel="noopener">${d.label}</a><a class="btn btn-sm" href="${UI.esc(d.space)}" target="_blank" rel="noopener" title="L'espace du commerçant : catalogue, prix, commandes (démo sur le téléphone)">🧑‍🍳 Espace</a><button class="btn btn-sm" data-copy="${UI.esc(d.url)}" title="Copier le lien">📋</button>`).join("")}</div>` : `<p class="small">⛔ Démos retirées : les liens ne montrent plus rien.</p>`}
      ${demoShops.length ? `<div class="actions" style="margin-top:8px"><button class="btn btn-sm" data-demos="${demoOn ? "suspendu" : "actif"}">${demoOn ? "⛔ Retirer les démos" : "✅ Remettre les démos"}</button></div>` : ""}
    </div>
    <div class="card" style="margin-bottom:14px">
      <b>🏪 Inscrire un commerce partenaire</b>
      <p class="muted small" style="margin:4px 0 8px">Envoyez ce lien à un restaurant ou une boutique : il s'inscrit, puis vous le validez ici après avoir vérifié qu'il existe.</p>
      <div class="actions"><button class="btn btn-sm" data-copy="${UI.esc(signup)}">📋 Copier le lien</button><a class="btn btn-sm btn-primary" href="${UI.esc(signup)}" target="_blank" rel="noopener">➕ Inscrire un commerce</a></div>
    </div>
    <div class="stats">
      <div class="stat"><small>Commerces</small><b>${shops.filter(x => x.status !== "suspendu").length}</b></div>
      <div class="stat"><small>À vérifier</small><b>${shops.filter(x => x.status === "en_attente").length}</b></div>
      <div class="stat"><small>Courses ce mois</small><b>${viaShop.filter(o => UI.dayKey(o.pickup_at).startsWith(month)).length}</b></div>
      ${bonusDue > 0 ? `<div class="stat"><small>Bonus à régler</small><b>${UI.money(bonusDue)}</b></div>` : `<div class="stat"><small>HOP! Pro</small><b>${shops.filter(x => Store.planActive(x)).length}</b></div>`}
    </div>
    ${list.length ? `<div class="orders">${list.map(x => {
      const done = viaShop.filter(o => o.shop_id === x.id);
      return `<article class="order${x.status === "en_attente" ? " is-new" : ""}" data-shop="${UI.esc(x.id)}">
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
            const mine = done.filter(o => o.status === "livree" && bill(o) > 0 && String(o.pickup_at).slice(0, 7) === month);
            const shares = sum(mine, bill);
            return (on ? `<b>HOP! Pro</b> jusqu'au ${UI.esc(UI.fmtKey(x.plan_until))} · ce mois : ${UI.money(settings.pro_monthly)} + ${mine.length} livraison(s) ${UI.money(shares)} = <b>${UI.money(Number(settings.pro_monthly) + shares)}</b>`
              : x.plan_until ? `HOP! Pro terminé le ${UI.esc(UI.fmtKey(x.plan_until))}` : "Pas d'abonnement HOP! Pro")
              + ` · 🛵 ${x.client_pays ? "le client paie la livraison" : `l'enseigne paie ${UI.money(settings.pro_shop_share)} par livraison`}`;
          })()}</span></div>
        </div>
        <div class="actions">
          ${x.status !== "actif" ? `<button class="btn btn-sm btn-primary" data-sact="actif">✅ Valider</button>` : `<button class="btn btn-sm" data-sact="suspendu">⛔ Suspendre</button>`}
          ${CONFIG.partners.carnet.offered ? `<button class="btn btn-sm" data-sact="carnet">🎟️ Carnet payé (${UI.money(CONFIG.partners.carnet.price)}) → +${CONFIG.partners.carnet.courses} et reçu</button>
          <button class="btn btn-sm" data-sact="credits">✏️ Courses du carnet</button>` : ""}
          <button class="btn btn-sm${Store.planActive(x) ? "" : " btn-primary"}" data-sact="plan" title="Le commerce a payé ${UI.esc(UI.money(settings.pro_monthly))}">⭐ HOP! Pro : +1 mois payé</button>
          <button class="btn btn-sm" data-sact="plangift">🎁 +1 mois offert</button>
          ${Store.planActive(x) ? `<button class="btn btn-sm" data-sact="planoff">Arrêter HOP! Pro</button>` : ""}
          ${chatBtn("s:" + x.id, `Commerce : ${x.name}`, x.phone, "💬 Message", shopWelcome(x))}
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl() + "?c=" + x.code)}">🛵 Commander pour lui</a>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="${UI.esc(UI.appUrl("commerce.html") + "?k=" + x.token)}">🔑 Son espace</a>
          <textarea class="admin-note" data-sact="note" rows="1" placeholder="Note interne (vérifié sur place, horaires…)">${UI.esc(x.admin_note || "")}</textarea>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty card">Aucun commerce inscrit pour l'instant. Envoyez votre lien à un restaurant ou une boutique !</div>`}`;
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
  view.innerHTML = `
    <div class="stats">
      <div class="stat"><small>Comptes clients</small><b>${withAcc.length}</b></div>
      <div class="stat"><small>Nouveaux comptes ce mois</small><b>${withAcc.filter(c => String(c.account_at || "").startsWith(month)).length}</b></div>
      <div class="stat"><small>Clients au total</small><b>${clients.length}</b></div>
      <div class="stat"><small>Commerces · livreurs actifs</small><b>${shops.filter(x => x.status === "actif").length} · ${couriers.filter(c => c.role !== "admin" && c.status === "actif").length}</b></div>
    </div>
    <p class="muted small" style="margin:-8px 0 12px">Un client crée son compte dans l'appli (« Mes courses ») avec son téléphone et un mot de passe : accepté tout de suite, sans e-mail de confirmation pour l'instant. Les clients sans compte apparaissent ici d'après leur numéro de téléphone.</p>
    <div class="toolbar"><input id="clientsQ" type="search" placeholder="Rechercher un client (nom ou téléphone)" value="${UI.esc(clientsQ)}" /></div>
    ${list.length ? `<div class="orders">${list.map(c => `
      <article class="order" data-client="${UI.esc(c.client_id || "")}">
        <div class="order-head">
          <span class="order-time">${UI.esc(c.name || "—")}</span>
          <span class="pill${c.client_id ? " paid" : ""}">${c.client_id ? "👤 Compte" : "Sans compte"}</span>
          ${c.blocked ? `<span class="pill" style="background:#FDE2E2;color:#9B1C1C">⛔ Bloqué</span>` : ""}
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
      </article>`).join("")}</div>` : `<div class="empty card">${clients.length ? "Aucun client ne correspond." : "Aucun client pour l'instant."}</div>`}`;
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
function renderMessages(view) {
  const cliTyped = $("#cliText") ? $("#cliText").value : "";
  const act = partners().filter(c => c.status === "actif");
  const onDuty = act.filter(c => c.position_at && Date.now() - new Date(c.position_at) < 10 * 60000);
  const name = id => (couriers.find(c => c.id === id) || {}).name || "?";
  const typed = $("#msgText") ? $("#msgText").value : "";
  view.innerHTML = `
    <div class="card">
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
  return orders.filter(o => o.status === "livree" && UI.dayKey(o.pickup_at).startsWith(billMonth));
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
async function change(o, changes) {
  try {
    await Store.updateOrder(o.id, changes);
    Object.assign(o, changes);
    render();
    return true;
  } catch (e) {
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
async function refreshChats() {
  try { chatRecentList = await Store.chatRecent(); } catch (e) { return; }
  const lastOf = {};
  chatRecentList.forEach(m => { if (!lastOf[m.thread] || m.created_at > lastOf[m.thread].created_at) lastOf[m.thread] = m; });
  chatUnread = Chat.unread(chatRecentList.filter(m => !isClosed(m.thread, lastOf[m.thread])), "admin");
  const total = Object.values(chatUnread).reduce((s, n) => s + n, 0);
  $("#chatTabBadge").textContent = total || "";
  $("#gbMessages").textContent = total || "";
  if (!firstLoad && total > chatTotal && Chat.openThread == null) {
    beep();
    UI.notify("💬 Nouveau message", { body: "Ouvrez la messagerie de l'espace patron.", tag: "hop-chat" });
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
  return art && orders.find(o => o.id === art.dataset.id);
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
    const inWeek = o => o.status === "livree" && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end;
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
  } else if (t.dataset.sact === "note" || t.dataset.sact === "referrer" || t.dataset.sact === "kind") {
    const id = t.closest("[data-shop]").dataset.shop;
    const changes = t.dataset.sact === "note" ? { admin_note: t.value.trim() || null } : t.dataset.sact === "kind" ? { kind: t.value } : { referrer_id: t.value || null };
    Store.updateShop(id, changes).then(load, () => alert("Non enregistré, vérifiez la connexion."));
  } else if (t.dataset.cact === "note") {
    const id = t.closest("[data-courier]").dataset.courier;
    Store.updateCourier(id, { admin_note: t.value.trim() || null }).catch(() => alert("Note non enregistrée."));
  } else if (t.id === "histStatus") { histFilter.status = t.value; render(); }
  else if (t.id === "billMonth") { billMonth = t.value; render(); }
}

function onViewInput(e) {
  if (e.target.id !== "histQ" && e.target.id !== "clientsQ") return;
  const id = e.target.id;
  if (id === "clientsQ") clientsQ = e.target.value; else histFilter.q = e.target.value;
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
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; lastTab[groupOf(tab)] = tab; render(); if (tab === "clients") loadClients(); } });
// Une rubrique : on retrouve son dernier onglet (sinon le premier)
const lastTab = {};
$("#admGroups").addEventListener("click", e => {
  const b = e.target.closest("[data-group]");
  if (!b) return;
  tab = lastTab[b.dataset.group] || document.querySelector(`#tabs [data-group="${b.dataset.group}"]`).dataset.tab;
  render();
  if (tab === "clients") loadClients();
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
$("#bossFirst").addEventListener("change", async e => {
  const v = Number(e.target.value);
  try { await Store.saveSettings({ boss_first_seconds: v }); settings.boss_first_seconds = v; }
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
$("#liveList").addEventListener("click", e => { const it = e.target.closest("[data-focus]"); if (it) focusOrder(it.dataset.focus); });
$("#liveFit").addEventListener("click", () => { if (live.map && live.points && live.points.length) live.map.fitBounds(live.points, { padding: [40, 40], maxZoom: 15 }); });
$("#view").addEventListener("change", onViewChange);
UI.bindHours($("#view"));   // horaires des fiches commerce (menus, coupure, raccourcis)
$("#view").addEventListener("input", onViewInput);
window.addEventListener("storage", e => { if (/livraison\.(orders|couriers|shops|replies|requests)/.test(e.key || "") && Store.session()) load(); });
document.addEventListener("visibilitychange", async () => {
  // Le verrou d'écran est relâché quand on quitte la page : le reprendre au retour
  if (document.visibilityState === "visible" && duty.watch != null && navigator.wakeLock) {
    try { duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ }
  }
  if (document.visibilityState === "visible") dutyBack();
});

if (window.Notification && Notification.permission === "granted") $("#notifBtn").textContent = "🔔 Alertes activées";
UI.forgotLink($("#loginForm"), $("#loginError"));
// Lien « Mot de passe oublié » : session reprise, nouveau mot de passe, puis l'espace patron
Store.adoptLinkSession().catch(() => false).then(async how => {
  if (how === "recovery") await UI.askNewPassword();
  if (Store.session()) start(); else showLogin();
});
// Le service était en cours avant de recharger la page : on le reprend
try { if (localStorage.getItem(LS_DUTY) && Store.session()) toggleDuty(); } catch (e) { /* ignore */ }

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
UI.iosInstallHint("HOP! Patron");
window.hopReady = true;

})();
