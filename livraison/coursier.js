// ============================================================================
// Espace livreur partenaire : inscription (engagements permis/assurance…),
// courses disponibles, ses courses, position GPS, commission hebdomadaire.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
Store.useSpace("coursier");

const COMMISSION = CONFIG.platform.commissionPerCourse;
const TERMS = [
  "Je possède un permis de conduire valide pour mon véhicule et je le garde valide.",
  "Mon véhicule est assuré (assurance obligatoire et responsabilité civile / tiers). Je préviens immédiatement si mon assurance change ou expire.",
  "Je travaille comme indépendant : je suis enregistré comme עוסק (פטור ou מורשה), je déclare moi-même mes revenus et je remets un reçu aux clients que j'encaisse.",
  "Je suis responsable des colis qui me sont confiés, de leur état et de l'argent encaissé, de la récupération jusqu'à la livraison.",
  "Je respecte le code de la route et les règles de sécurité (casque, pas de téléphone en main en conduisant).",
  `Je verse ${UI.money(COMMISSION)} de commission par course livrée, chaque semaine, par Bit.`,
  "Je suis poli et ponctuel. Si je ne peux plus faire une course acceptée, je la remets en attente tout de suite.",
  "Mon compte peut être suspendu si un de ces engagements n'est pas respecté."
];

let me = null;
let orders = [];
let tab = "pool";
let firstLoad = true;
const seenPool = new Set();

// --- Inscription / connexion ------------------------------------------------------
function renderWelcome() {
  $("#perks").innerHTML = [
    "Vous choisissez vos courses, quand vous voulez.",
    "Vous encaissez le client directement (espèces ou Bit).",
    `Seulement ${UI.money(COMMISSION)} de commission par course livrée, réglés une fois par semaine.`,
    "Pas d'abonnement, pas de frais d'inscription."
  ].map(x => `<li>✅ ${UI.esc(x)}</li>`).join("");
  $("#citySelect").innerHTML = CONFIG.cities.map(c => `<option value="${c.id}">${UI.esc(c.fr)}</option>`).join("");
  $("#citySelect").value = CONFIG.homeCity;
  $("#terms").innerHTML = TERMS.map((t, i) =>
    `<label class="check" style="align-items:flex-start"><input type="checkbox" name="term${i}" required /> <span>${UI.esc(t)}</span></label>`).join("");
}

function showAuth(which) {
  document.querySelectorAll("[data-auth]").forEach(b => b.classList.toggle("on", b.dataset.auth === which));
  $("#signupForm").style.display = which === "signup" ? "" : "none";
  $("#loginForm").style.display = which === "login" ? "" : "none";
}

async function onSignup(e) {
  e.preventDefault();
  const f = e.target;
  const err = msg => { $("#signupError").textContent = msg; $("#signupError").classList.toggle("hidden", !msg); };
  err("");
  if (!f.reportValidity()) return;
  const v = k => f.elements[k].value.trim();
  const profile = {
    name: v("name"), phone: v("phone"), bit_phone: v("bit_phone") || null, city: v("city"), vehicle: v("vehicle"),
    license_number: v("license_number") || null, license_expiry: v("license_expiry") || null,
    insurance: v("insurance") || null, insurance_expiry: v("insurance_expiry") || null,
    business_number: v("business_number") || null
  };
  try {
    const r = await Store.signupCourier(v("email"), f.password.value, profile);
    if (r.needsConfirmation) {
      showAuth("login");
      $("#loginError").textContent = "Inscription enregistrée ! Confirmez votre email (lien reçu par mail), puis connectez-vous ici.";
      $("#loginError").className = "notice";
      return;
    }
    route();
  } catch (ex) { err(ex.message); }
}

async function onLogin(e) {
  e.preventDefault();
  const f = e.target;
  $("#loginError").classList.add("hidden");
  try {
    await Store.login(f.email.value.trim(), f.password.value);
    route();
  } catch (ex) {
    $("#loginError").textContent = ex.message;
    $("#loginError").className = "notice err";
  }
}

// --- Aiguillage selon l'état du compte ----------------------------------------------
async function route() {
  ["#welcome", "#waiting", "#work"].forEach(s => $(s).classList.add("hidden"));
  $("#logoutBtn").classList.toggle("hidden", !Store.session());
  if (!Store.session()) { $("#welcome").classList.remove("hidden"); return; }
  try { me = await Store.me(); } catch (e) { me = null; }
  if (!me) { Store.logout(); return route(); }
  if (me.status !== "actif") {
    const suspended = me.status === "suspendu";
    $("#waitIcon").textContent = suspended ? "⛔" : "⏳";
    $("#waitTitle").textContent = suspended ? "Compte suspendu" : `Merci ${me.name}, inscription reçue !`;
    $("#waitText").textContent = suspended
      ? "Contactez-nous sur WhatsApp pour en savoir plus."
      : "Envoyez vos documents (permis, carte grise, assurance, carte d'identité, attestation d'עוסק) : votre compte sera validé après vérification.";
    $("#waitWa").href = UI.waLink(CONFIG.whatsapp, suspended
      ? `Bonjour, c'est ${me.name} (livreur). Mon compte est suspendu, pouvez-vous m'expliquer ?`
      : `Bonjour, c'est ${me.name}, je viens de m'inscrire comme livreur. Voici mes documents :`);
    $("#waiting").classList.remove("hidden");
    return;
  }
  $("#work").classList.remove("hidden");
  load();
  clearInterval(pollTimer);
  pollTimer = setInterval(load, 15000);
}

// --- Courses ------------------------------------------------------------------------
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const sum = (list, f = o => Number(o.price)) => list.reduce((s, o) => s + f(o), 0);
const today = () => UI.dayKey(new Date().toISOString());
const pool = () => orders.filter(o => o.status === "nouvelle" && !o.courier_id).sort(byTime);
const mine = () => orders.filter(o => o.courier_id === me.id && ["confirmee", "recuperee"].includes(o.status)).sort(byTime);

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) { /* audio indisponible */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

async function load() {
  try { orders = await Store.listOrders(); }
  catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.logout(); return route(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  const fresh = pool().filter(o => !seenPool.has(o.id));
  // Toute course disponible encore jamais montrée s'ouvre en fenêtre (dès la 1re connexion aussi)
  fresh.forEach(o => offerQueue.push(o.id));
  showNextOffer();
  if (!firstLoad && fresh.length) {
    beep();
    if (window.Notification && Notification.permission === "granted") {
      fresh.forEach(o => new Notification(`🆕 Course dispo n° ${o.ref} — ${UI.money(o.price)}`, { body: `${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.whenFr(o)}` }));
    }
  }
  pool().forEach(o => seenPool.add(o.id));
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  render();
}

function weekOrders(start) {
  const end = UI.addDays(start, 6);
  return orders.filter(o => o.courier_id === me.id && o.status === "livree" && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end);
}

function card(o, kind) {
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS (moins d'1 h)" : "Dès que possible";
  const nav = which => kind === "mine" ? `<div class="links">
      <a class="btn btn-sm" href="${UI.wazeLink(o, which)}" target="_blank" rel="noopener">Waze</a>
      <a class="btn btn-sm" href="${UI.mapsLink(o, which)}" target="_blank" rel="noopener">Maps</a></div>` : "";
  const telLink = (name, phone) => kind === "mine" && phone ? `<span class="small muted">${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a></span>` : "";
  let extra = "";
  if (o.service === "retrait") extra = `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° ${UI.esc(o.tracking_number || "—")} · au nom de ${UI.esc(o.parcel_name || "—")}${o.place_kind === "poste" ? ` · procuration : ${o.has_proxy ? "✅" : "❌"}` : ""}</div>`;
  if (o.service === "achat") extra = `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.budget ? ` · budget ${UI.money(o.budget)} à avancer` : ""}</div>`;
  const net = Number(o.price) - (kind === "pool" ? COMMISSION : Number(o.commission || 0));

  let actions = "";
  if (kind === "pool") {
    actions = `<button class="btn btn-primary" data-accept="${UI.esc(o.id)}">✅ J'accepte cette course</button>`;
  } else {
    actions = (o.status === "confirmee"
        ? `<button class="btn btn-sm btn-primary" data-act="recuperee">🛵 Colis récupéré</button><button class="btn btn-sm" data-act="liberer">↩︎ Je ne peux plus</button>`
        : `<button class="btn btn-sm btn-primary" data-act="livree">📦 Livré</button>`)
      + (o.payment_status !== "paye" ? `<button class="btn btn-sm" data-act="paye">💵 Encaissé</button>` : `<span class="pill paid">✓ encaissé</span>`)
      + `<a class="btn btn-sm btn-wa" data-wa="client" target="_blank" rel="noopener" href="${UI.waLink(o.contact_phone, UI.clientMessage(o))}">💬 Client</a>`
      + (o.dropoff_phone ? `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(o.dropoff_phone, I18N.forLang(o.lang || "fr", "trShareMsg", { url: UI.trackUrl(o) }))}">💬 Destinataire</a>` : "");
  }

  return `<article class="order${kind === "pool" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${UI.esc(when)}</span>
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(o.price)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span>📍</span><div><b>${kind === "mine" ? UI.esc(o.pickup_address) + ", " : ""}${UI.esc(UI.cityFr(o.from_city))}</b>${kind === "mine" ? UI.addrNote(o.pickup_note) : ""}${extra}${telLink(o.pickup_contact, o.pickup_phone)}${nav("pickup")}</div></div>
      <div class="leg"><span>🏁</span><div><b>${kind === "mine" ? UI.esc(o.dropoff_address) + ", " : ""}${UI.esc(UI.cityFr(o.to_city))}</b>${kind === "mine" ? UI.addrNote(o.dropoff_note) : ""}${telLink(o.dropoff_contact, o.dropoff_phone)}${nav("dropoff")}</div></div>
    </div>
    <div class="meta">
      <span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>
      <span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>
      <span class="pill">${UI.PAY_FR[o.payment_method] || ""}${o.payer === "destinataire" ? " · payé par le destinataire" : ""}</span>
      <span class="pill paid">Vous gagnez ${UI.money(net)}</span>
      ${kind === "mine" ? `<span class="pill">👤 ${UI.esc(o.contact_name)} · <a href="tel:${UI.esc(o.contact_phone)}">${UI.esc(o.contact_phone)}</a> · ${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>` : ""}
    </div>
    ${o.notes && kind === "mine" ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="actions">${actions}</div>
  </article>`;
}

function render() {
  const start = UI.weekStart(today());
  const week = weekOrders(start);
  const due = orders.filter(o => o.courier_id === me.id && o.status === "livree" && o.commission_status !== "regle");
  $("#stPool").textContent = pool().length;
  $("#stMine").textContent = mine().length;
  $("#stWeek").textContent = UI.money(sum(week));
  $("#stDue").textContent = UI.money(sum(due, o => Number(o.commission || 0)));
  document.querySelectorAll("#tabs .tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;

  if (tab === "pool") {
    const list = pool();
    view.innerHTML = list.length
      ? `<p class="muted small" style="margin-bottom:10px">L'adresse exacte et le contact du client s'affichent une fois la course acceptée. Le premier qui accepte la prend.</p><div class="orders">${list.map(o => card(o, "pool")).join("")}</div>`
      : empty("Pas de course disponible pour l'instant. Activez les alertes 🔔 : vous serez prévenu dès qu'une course arrive.");
  } else if (tab === "mine") {
    const list = mine();
    view.innerHTML = list.length ? `<div class="orders">${list.map(o => card(o, "mine")).join("")}</div>` : empty("Aucune course en cours.");
  } else if (tab === "week") {
    const amountDue = sum(due, o => Number(o.commission || 0));
    view.innerHTML = `<div class="card">
        <h3>Semaine du ${UI.fmtKey(start)} au ${UI.fmtKey(UI.addDays(start, 6))}</h3>
        <table class="prices" style="margin-top:8px">
          <tr><td>Courses livrées</td><td>${week.length}</td></tr>
          <tr><td>Encaissé auprès des clients</td><td>${UI.money(sum(week))}</td></tr>
          <tr><td>Commission de la semaine</td><td>${UI.money(sum(week, o => Number(o.commission || 0)))}</td></tr>
          <tr><td>Vous gagnez cette semaine</td><td>${UI.money(sum(week) - sum(week, o => Number(o.commission || 0)))}</td></tr>
          <tr><td><b>Reste à verser (toutes semaines)</b></td><td><b>${UI.money(amountDue)}</b></td></tr>
        </table>
        <p class="muted small" style="margin:10px 0">Le paiement se fait une fois par semaine, par Bit au ${UI.esc(CONFIG.bitPhone)}.</p>
        ${amountDue ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${UI.waLink(CONFIG.whatsapp, `Bonjour, c'est ${me.name}. Je viens de verser ma commission de ${UI.money(amountDue)} par Bit.`)}">J'ai payé ma commission</a>` : ""}
      </div>`;
  } else {
    view.innerHTML = `<div class="card"><h3>Vos engagements (acceptés le ${me.accepted_terms_at ? new Date(me.accepted_terms_at).toLocaleDateString("fr-FR") : "—"})</h3>
      <ol style="margin-top:10px;padding-inline-start:20px;display:grid;gap:6px">${TERMS.map(t => `<li>${UI.esc(t)}</li>`).join("")}</ol></div>`;
  }
}

async function onViewClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.accept) {
    el.disabled = true;
    const ok = await Store.acceptOrder(el.dataset.accept).catch(() => false);
    if (!ok) alert("Trop tard, un autre livreur a pris cette course.");
    else {
      tab = "mine";
      if (duty.watch == null && confirm("Course acceptée ! Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
    }
    return load();
  }
  if (el.dataset.act) {
    const id = el.closest("article").dataset.id;
    if (el.dataset.act === "liberer" && !confirm("Remettre cette course en attente pour un autre livreur ?")) return;
    const o = orders.find(x => x.id === id);
    const ok = await Store.courierAction(id, el.dataset.act).catch(() => false);
    if (!ok) alert("Action impossible, actualisez la page.");
    else if (el.dataset.act === "livree" && o && o.payment_status !== "paye" && confirm(`Livré ! Avez-vous encaissé ${UI.money(o.price)} ?`)) {
      await Store.courierAction(id, "paye").catch(() => alert("Encaissement non enregistré, réessayez."));
    }
    await load();
    if (["recuperee", "livree"].includes(el.dataset.act)) {
      const a = document.querySelector(`article[data-id="${id}"] [data-wa="client"]`);
      if (a) a.style.outline = "3px solid var(--brand)";
    }
  }
}

// --- Fenêtre « nouvelle course » : montant, trajet, kilomètres ------------------------
const offerQueue = [];
let offerShown = null;
let lastPos = null;

// Distance par la route estimée (vol d'oiseau × 1,3) entre deux points connus
function roadKm(a, b) { return a && b ? Pricing.haversineKm(a, b) * 1.3 : null; }
function pt(lat, lon) { return lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null; }

function showNextOffer() {
  if (offerShown) return;
  let o;
  while (offerQueue.length && !o) {
    const id = offerQueue.shift();
    o = pool().find(x => x.id === id);
  }
  if (!o) return;
  offerShown = o.id;
  const pick = pt(o.pickup_lat, o.pickup_lon), drop = pt(o.dropoff_lat, o.dropoff_lon);
  const trip = roadKm(pick, drop) ?? (o.distance_km != null ? Number(o.distance_km) * 1.3 : null);
  const toPickup = roadKm(lastPos, pick);
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ Express : moins d'1 h" : "Dès que possible";
  $("#offerIcon").textContent = { repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" }[o.service] || "📦";
  $("#offerPrice").textContent = UI.money(o.price);
  $("#offerGain").textContent = `Vous gagnez ${UI.money(Number(o.price) - COMMISSION)} (commission ${UI.money(COMMISSION)})`;
  $("#offerFrom").textContent = UI.cityFr(o.from_city);
  $("#offerTo").textContent = UI.cityFr(o.to_city);
  $("#offerFacts").innerHTML = [
    `🛣️ <b>${trip != null && trip >= 0.5 ? `≈ ${trip.toFixed(trip < 10 ? 1 : 0)} km` : "Dans la même ville"}</b> de trajet`,
    toPickup != null ? `🛵 À ≈ ${toPickup.toFixed(1)} km de vous` : "",
    `🕐 ${UI.esc(when)}`,
    `${UI.esc(UI.SERVICE_FR[o.service] || "")} · ${UI.esc(UI.SIZE_FR[o.size] || "")} · ${UI.PAY_FR[o.payment_method] || ""}`
  ].filter(Boolean).map(x => `<div>${x}</div>`).join("");
  $("#offerModal").classList.remove("hidden");
  // Position pas encore connue : on la demande une fois pour afficher « à X km de vous »
  if (!lastPos && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      lastPos = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (offerShown === o.id) { offerShown = null; offerQueue.unshift(o.id); showNextOffer(); }
    }, () => {}, { maximumAge: 60000, timeout: 8000 });
  }
}

function closeOffer() {
  $("#offerModal").classList.add("hidden");
  offerShown = null;
  setTimeout(showNextOffer, 300);
}

async function acceptOffer() {
  const id = offerShown;
  $("#offerAccept").disabled = true;
  const ok = await Store.acceptOrder(id).catch(() => false);
  $("#offerAccept").disabled = false;
  closeOffer();
  if (!ok) alert("Trop tard, un autre livreur a pris cette course.");
  else {
    tab = "mine";
    if (duty.watch == null && confirm("Course acceptée ! Passer en service pour que le client vous suive sur la carte ?")) toggleDuty();
  }
  load();
}

// --- En service : position GPS ------------------------------------------------------
const duty = { watch: null, lastSent: 0, wakeLock: null };

async function sendPosition(pos) {
  lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  if (Date.now() - duty.lastSent < 15000) return;
  duty.lastSent = Date.now();
  try {
    await Store.ping(pos.coords.latitude, pos.coords.longitude);
    $("#dutyText").textContent = `Position envoyée à ${new Date().toLocaleTimeString("fr-FR")} · gardez cette page ouverte.`;
  } catch (e) {
    duty.lastSent = 0;
    $("#dutyText").textContent = "⚠️ Position non envoyée (connexion). Nouvel essai automatique.";
  }
}

async function toggleDuty() {
  if (duty.watch != null) {
    navigator.geolocation.clearWatch(duty.watch);
    duty.watch = null;
    if (duty.wakeLock) { duty.wakeLock.release().catch(() => {}); duty.wakeLock = null; }
  } else {
    if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur ce téléphone.");
    duty.watch = navigator.geolocation.watchPosition(sendPosition, err => {
      $("#dutyText").textContent = err.code === 1 ? "⚠️ Autorisez la localisation pour ce site." : "⚠️ Position GPS introuvable pour le moment…";
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    try { if (navigator.wakeLock) duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* facultatif */ }
  }
  const on = duty.watch != null;
  $("#duty").classList.toggle("on", on);
  $("#dutyTitle").textContent = on ? "🟢 En service — vos clients vous suivent" : "⚪ Hors service";
  $("#dutyBtn").textContent = on ? "Terminer le service" : "Passer en service";
}

// --- Démarrage ------------------------------------------------------------------
let pollTimer;
renderWelcome();
document.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => showAuth(b.dataset.auth)));
$("#signupForm").addEventListener("submit", onSignup);
$("#loginForm").addEventListener("submit", onLogin);
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); clearInterval(pollTimer); Store.logout(); route(); });
$("#waitRefresh").addEventListener("click", route);
$("#tabs").addEventListener("click", e => { if (e.target.dataset.tab) { tab = e.target.dataset.tab; render(); } });
$("#view").addEventListener("click", onViewClick);
$("#dutyBtn").addEventListener("click", toggleDuty);
$("#offerAccept").addEventListener("click", acceptOffer);
$("#offerSkip").addEventListener("click", closeOffer);
$("#notifBtn").addEventListener("click", () => {
  if (!window.Notification) return alert("Les notifications ne sont pas disponibles sur ce navigateur.");
  Notification.requestPermission().then(p => { $("#notifBtn").textContent = p === "granted" ? "🔔 Alertes activées" : "🔕 Alertes refusées"; });
});
window.addEventListener("storage", e => { if (/livraison\.(orders|couriers)/.test(e.key || "") && me && me.status === "actif") load(); });
route();

})();
