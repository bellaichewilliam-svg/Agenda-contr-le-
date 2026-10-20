// ============================================================================
// Espace livreur partenaire : inscription (engagements, assurance déclarée…),
// courses disponibles, ses courses, position GPS, commission hebdomadaire.
// ============================================================================

(function () {
"use strict";

const $ = s => document.querySelector(s);
Store.useSpace("coursier");

const TERMS = [
  "Je possède un permis de conduire valide pour mon véhicule et je le garde valide.",
  "Je déclare que mon véhicule est assuré (assurance obligatoire et responsabilité civile / tiers) et que je reste assuré tant que je livre avec HOP.",
  "HOP met en relation des clients et des livreurs indépendants : HOP n'est pas responsable des accidents, dommages, amendes, pertes ou vols survenus pendant mes courses. Je les assume, avec mon assurance.",
  "Je travaille comme indépendant : je suis enregistré comme עוסק (פטור ou מורשה), je déclare moi-même mes revenus et je remets un reçu aux clients que j'encaisse.",
  "Je suis responsable des colis qui me sont confiés, de leur état et de l'argent encaissé, de la récupération jusqu'à la livraison.",
  "Je valide « Livré » seulement une fois sur place, à l'adresse du client : l'application vérifie ma position GPS.",
  "Course acceptée mais pas faite, ou déclarée livrée mais pas reçue par le client : après vérification par HOP, le prix de la course et la valeur de la commande sont retenus sur mon versement de la semaine. Je peux répondre avec mes preuves (photo, position).",
  "Je respecte le code de la route et les règles de sécurité (casque, pas de téléphone en main en conduisant).",
  `Je verse à HOP une commission par course livrée (${UI.commissionText()} ; ${UI.networkText()} sur les courses de mes commerces), réglée chaque semaine.`,
  "Je suis poli et ponctuel. Si je ne peux plus faire une course acceptée, je la remets en attente tout de suite.",
  "Mon compte peut être suspendu si un de ces engagements n'est pas respecté."
];

let me = null;
const TIP_FR = { promis: "promis, en attente du Bit du client", recu: "reçu par HOP, versé avec votre solde", verse: "versé ✓" };
let orders = [];
let settings = { referral_bonus: CONFIG.partners.bonusPerDelivery, priority_minutes: CONFIG.partners.priorityMinutes };
let refs = { shops: [], orders: [], board: [] };
let msgs = { messages: [], replies: [] };
let balance = 0;   // ce que le livreur doit à HOP (négatif : HOP lui doit)
let pens = [];     // retenues (courses pas faites ou pas reçues), déduites du versement de la semaine
const penDue = () => pens.filter(p => p.status === "du").reduce((x, p) => x + Number(p.amount || 0), 0);
let tab = "home";   // "home" = carte + panneau du bas ; sinon une page du menu
let firstLoad = true;
const seenPool = new Set();

// --- Inscription / connexion ------------------------------------------------------
function renderWelcome() {
  $("#perks").innerHTML = [
    "Vous choisissez vos courses, quand vous voulez.",
    "Vous encaissez le client directement (espèces ou Bit).",
    `Commission de ${UI.commissionText()} sur les courses que l'appli vous apporte, réglée une fois par semaine.`,
    `Faites votre marketing : sur les courses des commerces que vous amenez, seulement ${UI.networkText()}, et ${UI.money(CONFIG.partners.bonusPerDelivery)} pour vous quand un autre livreur les fait.`,
    `${CONFIG.pro.referrerPercent} % de l'abonnement HOP! Pro des commerces que vous faites signer, pendant ${CONFIG.pro.referrerMonths} mois.`,
    "Les pourboires sont 100 % pour vous, et les codes promo sont payés par HOP, pas par vous.",
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

// Photo du top case : réduite sur le téléphone avant l'envoi
let signupTopcase = null;
async function readTopcase(file) {
  try { return await Chat.compress(file); }
  catch (e) { alert(e.message === "too_big" ? "Photo trop lourde : reprenez-la de plus près." : "Cette image ne s'ouvre pas : essayez une autre photo."); return null; }
}
async function onTopcasePicked(e) {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  signupTopcase = await readTopcase(f);
  $("#topcasePreview").classList.toggle("hidden", !signupTopcase);
  if (signupTopcase) { $("#topcasePreview").src = signupTopcase; $("#topcaseLabel").textContent = "✅ Photo ajoutée · la changer"; }
}
async function onWaitTopcase(e) {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const data = await readTopcase(f);
  if (!data) return;
  try { await Store.sendTopcase(data); route(); } catch (ex) { alert("Photo non envoyée, vérifiez la connexion."); }
}

// Mode « compléter ma fiche » : le compte existe déjà (email confirmé), il manque la fiche livreur
let completing = false;
function setCompleting(on) {
  completing = on;
  const f = $("#signupForm");
  ["email", "password"].forEach(k => { f.elements[k].disabled = on; f.elements[k].closest("label").classList.toggle("hidden", on); });
  document.querySelector("#welcome .tabs").classList.toggle("hidden", on);
  $("#completeNote").classList.toggle("hidden", !on);
  if (on) $("#completeNote").textContent = `✅ Email confirmé${Store.sessionEmail() ? " (" + Store.sessionEmail() + ")" : ""}. Il reste à remplir votre fiche et la photo du top case pour finir l'inscription.`;
  $("#signupSubmit").textContent = on ? "Terminer mon inscription" : "Envoyer mon inscription";
}

async function onSignup(e) {
  e.preventDefault();
  const f = e.target;
  const err = msg => { $("#signupError").textContent = msg; $("#signupError").classList.toggle("hidden", !msg); };
  err("");
  if (!f.reportValidity()) return;
  const v = k => f.elements[k].value.trim();
  // Photo du top case obligatoire
  if (!signupTopcase) { err("📷 Ajoutez la photo de votre top case (la caisse sur votre scooter) : elle est obligatoire."); $(".topcase-f").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  const profile = {
    name: v("name"), phone: v("phone"), bit_phone: v("bit_phone") || null, city: v("city"), vehicle: v("vehicle"),
    license_number: v("license_number") || null, license_expiry: v("license_expiry") || null,
    business_number: v("business_number") || null
  };
  try {
    if (completing) { await Store.completeCourier(profile, signupTopcase); return route(); }
    const r = await Store.signupCourier(v("email"), f.password.value, profile, signupTopcase);
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
  document.body.classList.remove("rider-on");
  $("#logoutBtn").classList.toggle("hidden", !Store.session());
  if (!Store.session()) { $("#welcome").classList.remove("hidden"); return; }
  let meErr = false;
  try { me = await Store.me(); } catch (e) { me = null; meErr = true; }
  // Le compte patron garde l'accueil client dans l'appli HOP! (voir index.html)
  let backHome = false;
  try {
    if (me) localStorage.setItem("hop.role", me.role === "admin" ? "admin" : "");
    backHome = !!me && me.role === "admin" && sessionStorage.getItem("hop.autoRider") === "1";
    sessionStorage.removeItem("hop.autoRider");
  } catch (e) { /* ignore */ }
  // Envoyé ici tout seul depuis l'accueil client alors que c'est le patron : retour à l'accueil
  if (backHome) return location.replace(/\.vercel\.app$/.test(location.hostname) && location.pathname.indexOf("/livreur/") === 0 ? "/app/" : "index.html");
  if (!me && meErr) {
    $("#welcome").classList.remove("hidden");
    showAuth("login");
    $("#loginError").textContent = "Connexion au serveur impossible : vérifiez le réseau, puis rechargez la page.";
    $("#loginError").className = "notice err";
    return;
  }
  // Connecté mais sans fiche (inscription commencée sur un autre téléphone) : compléter la fiche
  setCompleting(!me);
  if (!me) { $("#welcome").classList.remove("hidden"); showAuth("signup"); return; }
  if (me.status !== "actif") {
    const suspended = me.status === "suspendu";
    $("#waitIcon").textContent = suspended ? "⛔" : "⏳";
    $("#waitTitle").textContent = suspended ? "Compte suspendu" : `Merci ${me.name}, inscription reçue !`;
    $("#waitText").textContent = suspended
      ? "Écrivez-nous dans l'application pour en savoir plus."
      : "Envoyez vos documents en photo dans l'application (permis, carte grise, carte d'identité, attestation d'עוסק) : votre compte sera validé après vérification.";
    $("#waitWa").textContent = suspended ? "💬 Écrire à HOP" : "📷 Envoyer mes documents";
    $("#waitTopcase").classList.toggle("hidden", suspended || !!me.topcase_at);
    $("#waitWa").onclick = () => openBossChat(suspended
      ? "Bonjour, mon compte est suspendu, pouvez-vous m'expliquer ?"
      : "Bonjour, voici mes documents :", !suspended);
    $("#waiting").classList.remove("hidden");
    return;
  }
  $("#work").classList.remove("hidden");
  document.body.classList.add("rider-on");
  UI.pushSubscribe();
  $("#drawerName").textContent = me.name;
  applyRiderSettings();
  initRiderMap();
  // Après un rechargement : on reste en ligne si on l'était
  let wasOnline = false;
  try { wasOnline = localStorage.getItem("livraison.online.v1") === "1"; } catch (e) { /* ignore */ }
  if (wasOnline && duty.watch == null) toggleDuty(true); else if (duty.watch == null) Store.setOnline(false).catch(() => {});
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

// Un seul lecteur audio, débloqué au premier geste (les téléphones l'exigent)
let audioCtx = null;
function audio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) { audioCtx = null; }
  return audioCtx;
}
["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, audio, { once: true, passive: true }));

// Une note douce, façon marimba (fondamentale + harmonique, qui s'éteint en douceur)
function note(ctx, freq, at, vol, len) {
  [[1, 1], [4, 0.18]].forEach(([mult, part]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * part, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(ctx.destination);
    o.start(at); o.stop(at + len + 0.05);
  });
}

// Commande passée par téléphone par le client (commerce pas sur HOP!) : au nom de qui, prête à quelle heure
function phoneLine(o) {
  const at = o.ready_at ? new Date(o.ready_at) : null;
  const left = at ? Math.ceil((at - Date.now()) / 60000) : null;
  const hh = at ? at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  return `<div class="small pro-line">📞 Commande au nom de <b>${UI.esc(o.pickup_name || "")}</b>${o.phone_ref ? ` · n° <b>${UI.esc(o.phone_ref)}</b>` : ""} · déjà payée au commerce
    <br>${left != null && left > 0 ? `⏱️ Prête à <b>${hh}</b> (dans ${left} min) : arrivez à l'heure, pas avant` : "✅ <b>Prête</b> : allez-y"}</div>`;
}

// HOP! Pro : où en est la préparation chez le commerce, ce que le client a commandé, la part du commerce
function proLine(o) {
  const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
  const state = o.shop_status === "prete" || (left != null && left <= 0) ? "✅ <b>Commande prête</b>"
    : left != null ? `🍳 <b>Prête dans ${left} min</b> chez ${UI.esc(o.shop_name || "le commerce")}` : "🍳 En attente du commerce";
  return `<div class="small pro-line">${state}${o.shop_order ? `<br>🧾 ${UI.esc(o.shop_order)}` : ""}
    ${Number(o.shop_share) > Number(o.hop_share || 0) ? `<br>🏪 Le commerce paie ${UI.money(Number(o.shop_share) - Number(o.hop_share || 0))} de votre course : HOP vous le reverse` : ""}</div>`;
}

function beep() {
  const ctx = riderSet.sound !== false && audio();
  if (ctx) try { const t = ctx.currentTime + 0.02; note(ctx, 1046.5, t, 0.22, 0.5); note(ctx, 1318.5, t + 0.12, 0.2, 0.6); }
  catch (e) { /* audio indisponible */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// Sonnerie de nouvelle course : une petite mélodie agréable qui revient toutes les 2,5 s,
// de plus en plus fort, jusqu'à ce que le livreur accepte, refuse ou laisse passer la course
const ring = { timer: null, n: 0 };
const MELODY = [[784, 0], [988, 0.16], [1175, 0.32], [1568, 0.5], [1175, 0.8], [1568, 0.96]];   // sol, si, ré, sol…
function ringOnce() {
  const ctx = riderSet.sound !== false && audio();
  const vol = Math.min(0.32, 0.12 + ring.n * 0.04);
  ring.n++;
  if (ctx) try { const t = ctx.currentTime + 0.03; MELODY.forEach(([f, d]) => note(ctx, f, t + d, vol, 0.9)); }
  catch (e) { /* audio indisponible */ }
  if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 400]);
}
function startRing() {
  stopRing();
  ring.n = 0;
  ringOnce();
  ring.timer = setInterval(ringOnce, 2500);
}
function stopRing() {
  clearInterval(ring.timer);
  ring.timer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

async function load() {
  try {
    let card;
    [orders, settings, card] = await Promise.all([Store.listOrders(), Store.getSettings(), Store.me().catch(() => null)]);
    // Fiche à jour (déblocage par HOP, suspension…)
    if (card) me = card;
    // Parrainage et messages : un souci ici ne doit pas bloquer les courses
    const [r, m, bal, dem, acc, fc] = await Promise.all([Store.myReferrals().catch(() => null), Store.listMessages().catch(() => null),
      Store.myBalance().catch(() => null), Store.zoneDemand().catch(() => null), Store.myAcceptance().catch(() => null), Store.demandForecast().catch(() => null)]);
    pens = (await Store.myPenalties().catch(() => null)) || pens;
    if (dem) demand = dem;
    if (acc) acceptance = acc;
    if (fc) forecast = fc;
    if (r) refs = r;
    if (bal != null) balance = bal;
    if (m) { msgs = m; checkNewMessages(); }
  }
  catch (e) {
    if (e.status === 401 || /Session/.test(e.message)) { Store.logout(); return route(); }
    $("#lastSync").textContent = "⚠️ Erreur de connexion, nouvel essai bientôt.";
    return;
  }
  // Course de la fenêtre prise par un autre livreur (ou annulée) : on arrête de sonner
  if (offerShown && !pool().some(o => o.id === offerShown)) closeOffer();
  const fresh = pool().filter(o => !seenPool.has(o.id));
  // Toute course disponible encore jamais montrée s'ouvre en fenêtre (dès la 1re connexion aussi)
  // Hors ligne : ni fenêtre, ni son (la base ne montre d'ailleurs plus les courses)
  if (!blocked() && isOnline()) fresh.forEach(o => offerQueue.push(o.id));
  showNextOffer();
  if (!firstLoad && fresh.length && isOnline()) {
    if (!offerShown) beep();
    if (window.Notification && Notification.permission === "granted") {
      fresh.forEach(o => UI.notify(`🆕 Course dispo n° ${o.ref} — ${UI.money(Store.courseValue(o))}`, { body: `${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.whenFr(o)}`, tag: "hop-o-" + o.id, vibrate: [300, 150, 300], requireInteraction: true }));
    }
  }
  pool().forEach(o => seenPool.add(o.id));
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  await checkChats();
  render();
}

function weekOrders(start) {
  const end = UI.addDays(start, 6);
  return orders.filter(o => o.courier_id === me.id && o.status === "livree" && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end);
}

function card(o, kind) {
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS (moins d'une heure)" : "Dès que possible";
  // Navigation avec l'application choisie dans les réglages
  const nav = which => kind === "mine" ? `<div class="links">
      <a class="btn btn-sm btn-primary" href="${navLink(o, which)}" target="_blank" rel="noopener">🧭 Y aller (${riderSet.nav === "maps" ? "Maps" : "Waze"})</a></div>` : "";
  const telLink = (name, phone) => kind === "mine" && phone ? `<span class="small muted">${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a></span>` : "";
  let extra = "";
  if (o.service === "retrait") extra = `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° ${UI.esc(o.tracking_number || "—")}${o.retrait_code ? (kind === "mine" ? ` · code du casier <b>${UI.esc(o.retrait_code)}</b>` : " · casier avec code") : ` · au nom de ${UI.esc(o.parcel_name || "—")}`}</div>`
    + (o.appt_at ? `<div class="bag-line">📅 Rendez-vous à la poste : <b>${UI.esc(UI.fmtDateTime(o.appt_at))}</b> : soyez au guichet à l'heure</div>` : "")
    + (o.docs_status === "ok" ? `<div class="small">✅ Documents vérifiés par HOP! (${o.place_kind === "poste" ? "avis, carte d'identité, procuration, rendez-vous" : o.place_kind === "locker" ? "SMS du casier" : "avis, carte d'identité"}) : à montrer au guichet</div>` : "");
  if (o.eta_status === "attente" && new Date(o.eta_until) > Date.now()) extra += `<div class="bag-line">⏳ Vous avez annoncé ${o.eta_min} min : le client a jusqu'à ${UI.esc(new Date(o.eta_until).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))} pour refuser. Partez quand même au départ.</div>`;
  else if (o.eta_at && o.status === "confirmee" && !o.arrived_at) extra += `<div class="small">🕐 Attendu au départ vers ${UI.esc(new Date(o.eta_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))} (${o.eta_min} min annoncées)</div>`;
  if (o.service === "achat" && o.rx) extra += `<div class="bag-line">💊 Médicament sur ordonnance : carte d'identité du patient et ordonnance vérifiées par HOP!, à montrer à la pharmacie</div>`;
  if (o.post_send) extra += `<div class="bag-line">📮 Dépôt à la poste : rendez-vous <b>${UI.esc(UI.fmtDateTime(o.appt_at))}</b>. Envoi déjà payé (étiquette en photo) : n'avancez rien</div>`;
  if (o.p2p_sale) extra += `<div class="small">🤝 Vente entre particuliers : l'acheteur a déjà payé le vendeur. N'encaissez que la course, jamais le prix de l'objet</div>`;
  if (o.handoff) extra += `<div class="bag-line">🔐 Clés / objet de valeur : demandez le <b>code de remise</b> au destinataire avant de donner${o.handoff_ok_at ? " · ✅ code vérifié" : ""}</div>`;
  if (o.service === "achat") extra += `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.budget ? ` · budget ≈ ${UI.money(o.budget)}` : ""}<br>🧾 Le client règle le magasin lui-même : n'avancez rien, appelez-le depuis l'appli à la caisse</div>`;
  // Attente au départ ou temps des achats : payé au livreur au-delà des minutes offertes
  extra += Number(o.wait_fee) > 0 ? `<div class="small">⏱️ Attente payée : <b>+${UI.money(o.wait_fee)}</b> (${o.wait_minutes} min sur place), comprise dans le prix</div>`
    : kind === "pool" || o.status === "confirmee" ? `<div class="small muted">⏱️ Attente ou achats sur place : ${UI.esc(UI.waitRule(settings))}, pour vous</div>` : "";
  // Valeur de la course : prix + réduction promo (payée par HOP) + part du commerce Pro pour le livreur
  const mineShop = !!o.referrer_id && o.referrer_id === me.id;
  const total = Store.courseValue(o);
  const net = total - (kind === "pool" ? Store.commissionFor(total, settings, mineShop) : Number(o.commission || 0));
  if (o.shop_status) extra += proLine(o);
  if (o.phone_order) extra += phoneLine(o);
  if (o.adult_items) extra += `<div class="small adult-line">🔞 ${/tabac/.test(o.adult_items) ? "Tabac" : ""}${/tabac/.test(o.adult_items) && /alcool/.test(o.adult_items) ? " et " : ""}${/alcool/.test(o.adult_items) ? "alcool" : ""} : vérifiez la pièce d'identité du client (18 ans et plus) avant de donner.</div>`;
  if (o.shop_ref) extra += `<div class="bag-line">🛍️ Sac n° <b>${UI.esc(o.shop_ref)}</b> : demandez ce numéro${o.shop_name ? " chez " + UI.esc(o.shop_name) : ""}</div>`;
  if (o.rules_accepted_at) extra += `<div class="small muted">📋 Le client a accepté les conditions : max 40 × 40 × 35 cm, 15 kg, 500 ₪, rien de dangereux ni d'illégal. Colis non conforme ? Vous pouvez refuser : « ⚠️ Un souci ».</div>`;
  if (Number(o.discount) > 0) extra += `<div class="small">🎁 Code promo du client : ${UI.money(o.discount)}, payé par HOP (pas par vous)</div>`;
  const hopPaid = o.paid_to === "hop";

  let actions = "";
  if (kind === "pool") {
    actions = locked() ? `<span class="pill st-annulee">🔒 Réglez votre solde pour accepter</span>`
      : busy() ? `<span class="pill st-annulee">🔒 Livrez d'abord votre course en cours</span>`
      : `<button class="btn btn-primary" data-accept="${UI.esc(o.id)}">✅ J'accepte cette course</button><button class="btn" data-decline="${UI.esc(o.id)}">✖ Refuser</button>`;
  } else {
    // Au départ : « Je suis arrivé » lance le compteur d'attente (payée au-delà des minutes offertes)
    const w = Store.waitFee(o, settings);
    actions = (o.status === "confirmee"
        ? (o.arrived_at
            ? `<p class="wait-live">⏱️ Sur place depuis ${w.mins} min${w.fee ? ` · attente payée : <b>+${UI.money(w.fee)}</b>` : ` · ${Math.max(0, Number(settings.wait_free_min) - w.mins)} min encore offertes`}</p>`
            : `<button class="btn btn-sm btn-primary" data-act="arrivee">📍 Je suis arrivé au départ</button>`)
          + `<button class="btn btn-sm${o.arrived_at ? " btn-primary" : ""}" data-act="recuperee">🛵 Colis récupéré</button><button class="btn btn-sm" data-act="liberer">↩︎ Je ne peux plus</button>`
        : `<button class="btn btn-sm btn-primary" data-act="livree">📦 Livré (sur place)</button>`)
      + (o.docs_status && ["confirmee", "recuperee"].includes(o.status) ? `<button type="button" class="btn btn-sm btn-primary" data-docs="${UI.esc(o.id)}">📄 Documents à montrer</button>` : "")
      + `<button type="button" class="btn btn-sm" data-issue="${UI.esc(o.id)}">⚠️ Un souci</button>`
      + (hopPaid ? "" : o.payment_status !== "paye" ? `<button class="btn btn-sm" data-act="paye">💵 Encaissé</button>` : `<span class="pill paid">✓ encaissé</span>`)
      + `<button type="button" class="btn btn-sm btn-wa" data-chat="${UI.esc(o.id)}">💬 Client${chatUnread["o:" + o.id] ? ` <span class="chat-badge">${chatUnread["o:" + o.id]}</span>` : ""}</button>`
      + (o.leave_at_door && o.status === "recuperee" ? `<button type="button" class="btn btn-sm btn-wa" data-chat="${UI.esc(o.id)}" data-photo="1">📷 Photo du dépôt</button>` : "")
      + (o.dropoff_phone ? `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(o.dropoff_phone, I18N.forLang(o.lang || "fr", "trShareMsg", { url: UI.trackUrl(o) }))}">💬 Destinataire</a>` : "");
  }

  return `<article class="order${kind === "pool" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${UI.esc(when)}</span>
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(total)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span>📍</span><div>${UI.brand(o.pickup_place)}<b>${kind === "mine" ? "<bdi>" + UI.esc(o.pickup_address) + "</bdi>, " : ""}${UI.esc(UI.cityFr(o.from_city))}</b>${kind === "mine" ? UI.addrDetails(o, "pickup") + UI.addrNote(o.pickup_note) : ""}${extra}${telLink(o.pickup_contact, o.pickup_phone)}${nav("pickup")}</div></div>
      ${UI.stopsLegs(o, kind === "mine")}
      <div class="leg"><span>🏁</span><div>${UI.brand(o.dropoff_place)}<b>${kind === "mine" ? "<bdi>" + UI.esc(o.dropoff_address) + "</bdi>, " : ""}${UI.esc(UI.cityFr(o.to_city))}</b>${kind === "mine" ? UI.addrDetails(o, "dropoff") + UI.addrNote(o.dropoff_note) : ""}${UI.doorTag(o)}${telLink(o.dropoff_contact, o.dropoff_phone)}${nav("dropoff")}</div></div>
    </div>
    <div class="meta">
      <span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>
      <span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>
      <span class="pill">${UI.PAY_FR[o.payment_method] || ""}${o.payer === "destinataire" ? " · payé par le destinataire" : ""}</span>
      <span class="pill paid">Vous gagnez ${UI.money(net)}</span>
      ${Number(o.tip) > 0 ? `<span class="pill paid">💝 Pourboire ${UI.money(o.tip)} · ${TIP_FR[o.tip_status] || ""}</span>` : ""}
      ${mineShop ? `<span class="pill star-pill">⭐ Votre commerce${o.shop_name ? " : " + UI.esc(o.shop_name) : ""}${kind === "pool" ? priorityLeft(o) : ""} · commission réseau ${UI.esc(UI.networkText())}</span>` : o.shop_name ? `<span class="pill">🏪 Partenaire : ${UI.esc(o.shop_name)}</span>` : ""}
      ${o.issue && kind === "mine" ? `<span class="pill st-annulee">⚠️ Souci signalé : ${UI.esc(o.issue)}</span>` : ""}
      ${o.unlocked ? `<span class="pill paid">🔓 Débloquée par HOP : « Livré » possible sans GPS ni photo</span>` : ""}
      ${o.leave_at_door && !o.unlocked && kind === "mine" ? `<span class="pill unpaid">📷 Devant la porte : photo obligatoire avant « Livré »</span>` : ""}
      ${hopPaid ? `<span class="pill ${o.payment_status === "paye" ? "paid" : "unpaid"}">${o.payment_status === "paye" ? `✅ Déjà payée à HOP : rien à encaisser, HOP vous reverse ${UI.money(net)}` : (o.payment_method === "bit" ? "📱 Le client paie par Bit à HOP : n'encaissez rien" : "💳 Paiement d'avance à HOP en attente : n'encaissez rien")}</span>` : ""}
      ${kind === "mine" ? `<span class="pill">👤 ${UI.esc(o.contact_name)} · <a href="tel:${UI.esc(o.contact_phone)}">${UI.esc(o.contact_phone)}</a> · ${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>` : ""}
    </div>
    ${o.notes && kind === "mine" ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="actions">${actions}</div>
  </article>`;
}

// --- Finances, façon appli : gains de la semaine en gros, puis l'historique semaine par semaine ---------
const shortDate = (k, year) => new Date(k + "T12:00:00").toLocaleDateString("fr-FR", year ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
function weekGain(s) {
  const e = UI.addDays(s, 6), inW = d => UI.dayKey(d) >= s && UI.dayKey(d) <= e;
  const list = weekOrders(s);
  const courses = sum(list, Store.courierGain);
  const tips = sum(list.filter(o => ["recu", "verse"].includes(o.tip_status)), o => Number(o.tip || 0));
  const bonus = sum(refDelivered().filter(o => inW(o.pickup_at)), o => Number(o.referral_bonus || 0));
  const plans = sum((refs.plans || []).filter(p => inW(p.created_at)), p => Number(p.share || 0));
  const wpens = pens.filter(p => inW(p.created_at)), pen = sum(wpens, p => Number(p.amount || 0));
  return { s, e, list, courses, tips, bonus, plans, pens: wpens, pen, total: courses + tips + bonus + plans - pen,
    settled: list.length > 0 && list.every(o => o.commission_status === "regle"), cash: sum(list.filter(o => o.paid_to !== "hop")),
    commission: sum(list, o => Number(o.commission || 0)) };
}
function financesView(start, week, d) {
  const bal = balance + penDue();
  const cur = weekGain(start);
  const payDay = UI.addDays(start, 7 + Number(CONFIG.platform.settlementDay || 0));
  const past = [1, 2, 3, 4, 5, 6, 7, 8].map(i => weekGain(UI.addDays(start, -7 * i))).filter(w => w.list.length || w.total);
  const line = (label, v, sign) => v ? `<div class="fin-row"><span>${label}</span><b>${sign || ""}${UI.money(v)}</b></div>` : "";
  const weekItem = w => `<details class="fin-op">
      <summary><div><small>${UI.esc(shortDate(w.e))}</small><b>Semaine du ${UI.esc(shortDate(w.s))} au ${UI.esc(shortDate(w.e, true))}</b>
        <span class="muted small">${w.list.length} course(s) · ${w.settled ? "✓ Réglé" : "⏳ À régler"} · ID HOP-${w.s.replace(/-/g, "")}</span></div>
        <b class="fin-amount">${UI.money(w.total)}</b></summary>
      <div class="fin-detail">
        ${line("Courses (après commission)", w.courses)}${line("💝 Pourboires", w.tips, "+")}${line("🤝 Bonus réseau", w.bonus, "+")}${line("⭐ Abonnements Pro", w.plans, "+")}
        ${line("Encaissé auprès des clients", w.cash)}${line("Commission HOP", w.commission)}${line("💸 Retenues", w.pen, "−")}
        ${w.pens.map(p => `<p class="small pen-line">💸 −${UI.money(p.amount)}${p.order_ref ? " · course n° " + UI.esc(p.order_ref) : ""} : ${UI.esc(p.reason)}${p.status === "regle" ? " · déduite ✓" : " · sera déduite au prochain versement"}</p>`).join("")}
      </div></details>`;
  return `<div class="fin-hero">
      <small>Gains de la semaine ›</small>
      <b>${UI.money(cur.total)}</b>
      <span>${cur.list.length} course(s) · prochain règlement le ${UI.esc(new Date(payDay + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" }))}</span>
    </div>
    <div class="fin-bal ${bal > 0 ? "due" : bal < 0 ? "owed" : ""}">
      <div><small>${bal > 0 ? "À verser à HOP" : bal < 0 ? "HOP vous verse" : "Solde"}</small><b>${UI.money(Math.abs(bal))}</b></div>
      ${bal > 0 ? `<button type="button" class="btn btn-sm btn-wa" data-boss="${UI.esc(`Bonjour, je viens de verser mon solde de ${UI.money(bal)} par Bit.`)}">J'ai payé</button>` : ""}
      ${bal < 0 ? `<button type="button" class="btn btn-sm btn-wa" data-boss="${UI.esc(`Bonjour, HOP me doit ${UI.money(-bal)} cette semaine : merci de me les verser sur mon Bit ${me.bit_phone || me.phone}.`)}">Demander mon versement</button>` : ""}
    </div>
    <h3 class="fin-title">Opérations récentes</h3>
    <div class="fin-ops">${weekItem(cur).replace("<details", "<details open")}${past.map(weekItem).join("") || `<p class="muted small">Pas encore d'autre semaine.</p>`}</div>
    <details class="fin-more"><summary>Détail du solde</summary>
      ${line("Commission due (toutes semaines)", d.amountDue)}${line("Courses payées à HOP (reversées)", d.hopDue, "−")}
      ${line("Part des commerces Pro et codes promo", d.hopAdds, "−")}${line("💝 Pourboires reçus par HOP", d.tipsDue, "−")}
      ${line("🤝 Bonus réseau pas encore réglés", d.bDue, "−")}${line("⭐ Part des abonnements Pro", d.plansDue, "−")}${line("💸 Retenues (courses pas faites ou pas reçues)", penDue(), "+")}
      <div class="fin-row total"><span>${bal >= 0 ? "Reste à verser" : "HOP vous verse"}</span><b>${UI.money(Math.abs(bal))}</b></div>
      <p class="muted small">Règlement une fois par semaine, par Bit au ${UI.esc(CONFIG.bitPhone)}. Au-delà de ${UI.money(settings.max_debt)} dus, plus de nouvelles courses jusqu'au règlement.</p>
    </details>`;
}

function render() {
  const start = UI.weekStart(today());
  const week = weekOrders(start);
  const due = orders.filter(o => o.courier_id === me.id && o.status === "livree" && o.commission_status !== "regle");
  $("#stPool").textContent = pool().length;
  $("#stMine").textContent = mine().length;
  $("#stWeek").textContent = UI.money(sum(week.filter(o => o.paid_to !== "hop")));
  $("#stDue").textContent = UI.money(Math.abs(balance + penDue()));
  $("#stDueLabel").textContent = balance + penDue() >= 0 ? "Solde à verser à HOP" : "HOP vous doit";
  renderLock();
  renderHome();
  updateRiderMap();
  $("#pageStats").classList.toggle("hidden", !["mine", "pool", "week"].includes(tab));
  if (tab === "home") return;
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;

  if (tab === "pool") {
    const list = pool();
    view.innerHTML = list.length
      ? `<p class="muted small" style="margin-bottom:10px">L'adresse exacte et le contact du client s'affichent une fois la course acceptée. Le premier qui accepte la prend.</p><div class="orders">${list.map(o => card(o, "pool")).join("")}</div>`
      : empty(isOnline() ? "Pas de course disponible pour l'instant. Activez les alertes 🔔 : vous serez prévenu dès qu'une course arrive."
        : "Vous êtes hors ligne : glissez le bouton « HOP! » pour passer en ligne et recevoir des courses.");
  } else if (tab === "mine") {
    const list = mine();
    view.innerHTML = list.length ? `<div class="orders">${list.map(o => card(o, "mine")).join("")}</div>` : empty("Aucune course en cours.");
  } else if (tab === "week") {
    const amountDue = sum(due, o => Number(o.commission || 0));
    const weekBonus = sum(refDelivered().filter(o => UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= UI.addDays(start, 6)), o => Number(o.referral_bonus || 0));
    const bDue = bonusDue();
    const hopDue = sum(due.filter(o => o.paid_to === "hop" && o.payment_status === "paye"));
    // Ce que HOP ajoute : part des commerces Pro et codes promo, pourboires reçus, abonnements Pro
    const hopAdds = sum(due, o => Number(o.shop_share || 0) - Number(o.hop_share || 0) + Number(o.discount || 0));
    const tipsDue = sum(orders.filter(o => o.courier_id === me.id && o.tip_status === "recu"), o => Number(o.tip || 0));
    const plansDue = sum((refs.plans || []).filter(p => p.status !== "regle"), p => Number(p.share || 0));
    view.innerHTML = financesView(start, week, { amountDue, weekBonus, bDue, hopDue, hopAdds, tipsDue, plansDue });
  } else if (tab === "stats") {
    renderStats(view);
  } else if (tab === "settings") {
    renderSettings(view);
  } else if (tab === "help") {
    renderHelp(view);
  } else if (tab === "inbox") {
    renderInbox(view);
  } else if (tab === "zones") {
    renderZones(view);
  } else if (tab === "ref") {
    renderRef(view);
  } else {
    const exp = d => d ? `${new Date(d) < new Date() ? "⛔ expiré le" : "✅ valable jusqu'au"} ${new Date(d).toLocaleDateString("fr-FR")}` : "— (envoyez-le à HOP)";
    view.innerHTML = `<div class="card"><h3>🛡️ Permis et assurance</h3>
        <table class="prices" style="margin-top:8px">
          <tr><td>Permis n° ${UI.esc(me.license_number || "—")}</td><td>${exp(me.license_expiry)}</td></tr>
          <tr><td>Assurance</td><td>✅ déclarée le ${me.accepted_terms_at ? new Date(me.accepted_terms_at).toLocaleDateString("fr-FR") : "—"}</td></tr>
          <tr><td>N° d'עוסק</td><td>${UI.esc(me.business_number || "—")}</td></tr>
        </table>
        <p class="muted small" style="margin-top:8px">Vous avez déclaré être assuré (véhicule et responsabilité civile). Vous êtes indépendant : HOP n'est pas responsable des accidents, dommages ou pertes pendant vos courses.</p></div>
      <div class="card" style="margin-top:14px"><h3>📜 Vos engagements (acceptés le ${me.accepted_terms_at ? new Date(me.accepted_terms_at).toLocaleDateString("fr-FR") : "—"})</h3>
      <ol style="margin-top:10px;padding-inline-start:20px;display:grid;gap:6px">${TERMS.map(t => `<li>${UI.esc(t)}</li>`).join("")}</ol></div>`;
  }
}

async function onViewClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.decline) {
    el.disabled = true;
    afterDecline(await Store.declineOrder(el.dataset.decline, "autre").catch(() => null));
    return load();
  }
  if (el.dataset.accept) {
    const po = pool().find(x => x.id === el.dataset.accept);
    const eta = prompt("🛵 Dans combien de minutes êtes-vous au départ ? (le client peut refuser si c'est trop long)", String(po ? etaGuess(po) : 15));
    if (eta === null) return;
    el.disabled = true;
    const ok = await Store.acceptOrder(el.dataset.accept, Math.max(1, Math.min(180, parseInt(eta, 10) || 15))).catch(e => acceptError(e));
    if (ok === "shown") { /* message déjà affiché */ }
    else if (!ok) alert("Trop tard, un autre livreur a pris cette course.");
    else {
      openPage("mine");
      if (duty.watch == null && confirm("Course acceptée ! Rester en ligne pour que le client vous suive sur la carte ?")) toggleDuty();
    }
    return load();
  }
  if (el.dataset.act) {
    const id = el.closest("article").dataset.id;
    if (el.dataset.act === "liberer" && !confirm("Remettre cette course en attente pour un autre livreur ?")) return;
    const o = orders.find(x => x.id === id);
    // « Je suis arrivé » : la base vérifie la dernière position, on l'envoie tout de suite
    if (el.dataset.act === "arrivee" && !o.unlocked && !freeNow()) {
      el.disabled = true;
      el.textContent = "📍 Vérification de votre position…";
      try {
        const p = await currentPos();
        lastPos = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() };
        await Store.ping(lastPos.lat, lastPos.lon); duty.lastSent = Date.now();
      } catch (e) { /* la base refusera si besoin */ }
    }
    // « Livré » : seulement sur place, à l'adresse de livraison (vérifié aussi par la base)
    if (el.dataset.act === "livree") {
      el.disabled = true;
      el.textContent = "📍 Vérification de votre position…";
      if (!o.unlocked && !freeNow()) {
        const here = await checkAtDropoff(o);
        if (!here.ok) { render(); return alert(here.msg); }
        if (o.leave_at_door && !(await hasDoorPhoto(o))) { render(); alert(PHOTO_MSG); return openOrderChat(o, true); }
        // Clés ou objet de valeur : le code de remise donné par le destinataire
        if (o.handoff && !o.handoff_ok_at) {
          const code = prompt("🔐 Code de remise : demandez au destinataire son code à 4 chiffres.");
          if (code == null) { render(); return; }
          const good = await Store.courierHandoff(o.id, code).catch(e => (/too_many/.test(e.message) ? "max" : false));
          if (good !== true) { render(); return alert(good === "max" ? "🔒 Trop d'essais : appelez HOP! (le patron peut débloquer la course)." : "❌ Code incorrect : ne remettez pas, vérifiez avec le destinataire."); }
          o.handoff_ok_at = new Date().toISOString();
        }
      }
    }
    const ok = await Store.courierAction(id, el.dataset.act).catch(e => /too_far_pickup/.test(e.message) ? "farpick" : /too_far/.test(e.message) ? "far" : /photo_required/.test(e.message) ? "photo" : /handoff_required/.test(e.message) ? "handoff" : false);
    if (ok === "handoff") { render(); return alert("🔐 Code de remise manquant : demandez-le au destinataire avant de remettre."); }
    if (ok === "farpick") { render(); return alert("📍 Vous n'êtes pas encore au point de récupération : appuyez sur « Je suis arrivé » une fois sur place (le compteur d'attente démarre à ce moment-là)."); }
    if (ok === "photo") { render(); alert(PHOTO_MSG); return openOrderChat(o, true); }
    if (ok === "far") { render(); return alert(`📍 Vous n'êtes pas à l'adresse de livraison. Vous pourrez valider « Livré » une fois sur place (moins de ${deliverRadius()} m).`); }
    if (!ok) alert("Action impossible, actualisez la page.");
    else if (el.dataset.act === "livree" && o && o.paid_to !== "hop" && o.payment_status !== "paye" && confirm(`Livré ! Avez-vous encaissé ${UI.money(o.price)} ?`)) {
      await Store.courierAction(id, "paye").catch(() => alert("Encaissement non enregistré, réessayez."));
    }
    await load();
  }
}

// --- Messagerie : avec HOP, et avec le client de chaque course -------------------------------
let chatUnread = {};
let chatTotal = 0;
function openBossChat(prefill, photo) {
  Chat.open({ thread: "c:" + me.id, title: "💬 HOP! · le patron", sub: "Vos messages avec HOP", me: "courier", lang: "fr", prefill, photo,
    fetch: () => Store.chatThread("c:" + me.id), send: (b, i) => Store.chatSend("c:" + me.id, "courier", me.name, b, i), onClose: checkChats });
}
function openOrderChat(o, photo) {
  Chat.open({ thread: "o:" + o.id, title: `Course n° ${o.ref}`, sub: `${o.contact_name || "Client"} · ${o.lang === "he" ? "parle hébreu 🇮🇱" : "parle français 🇫🇷"} · HOP voit aussi`,
    me: "courier", lang: "fr", photo,
    prefill: photo ? I18N.forLang(o.lang || "fr", "msg_door", { name: o.dropoff_contact || o.contact_name || "", ref: o.ref }) : "",
    fetch: () => Store.chatThread("o:" + o.id), send: (b, i) => Store.chatSend("o:" + o.id, "courier", me.name, b, i), onClose: checkChats });
}
// Messages non lus : pastilles, son et notification à l'arrivée
async function checkChats() {
  if (!me) return;
  let recent;
  try { recent = await Store.chatRecent(); } catch (e) { return; }
  // Seulement les conversations du livreur (HOP et ses courses) : le compte patron voit aussi celles
  // des autres, qu'on ne peut pas ouvrir d'ici
  const mineThreads = new Set(["c:" + me.id].concat(orders.filter(o => o.courier_id === me.id).map(o => "o:" + o.id)));
  chatUnread = Chat.unread((recent || []).filter(m => mineThreads.has(m.thread)), "courier");
  const total = Object.values(chatUnread).reduce((s, n) => s + n, 0);
  const boss = chatUnread["c:" + me.id] || 0;
  $("#bossBadge").textContent = boss;
  $("#bossBadge").classList.toggle("hidden", !boss);
  $("#bellBadge").textContent = boss;
  $("#bellBadge").classList.toggle("hidden", !boss);
  $("#menuBadge").textContent = total;
  $("#menuBadge").classList.toggle("hidden", !total);
  if (total > chatTotal && Chat.openThread == null) {
    beep();
    UI.notify("💬 Nouveau message", { body: "Ouvrez votre espace livreur pour répondre.", tag: "hop-chat" });
  }
  chatTotal = total;
}

// --- Zones de livraison : demande en direct (seulement le Sharon ouvert pour l'instant) ------
let demand = null;
let acceptance = null;   // { accepted, declined } sur 30 jours
let forecast = null;     // commandes moyennes par heure (aujourd'hui, d'après les 4 dernières semaines)
function demandLevel(d) {
  if (!d) return null;
  const score = (Number(d.waiting) + Number(d.last_hour) / 2) / Math.max(1, Number(d.on_duty));
  return score >= 2.5 ? { label: "Forte", n: 3, cls: "hi" } : score >= 1 ? { label: "Moyenne", n: 2, cls: "mid" } : { label: "Faible", n: 1, cls: "lo" };
}
const bars = lv => `<span class="dbars ${lv.cls}">${[1, 2, 3].map(i => `<i class="${i <= lv.n ? "on" : ""}"></i>`).join("")}</span>`;
function renderZones(view) {
  const lv = demandLevel(demand);
  view.innerHTML = `<div class="card">
      <h3>Zone de livraison</h3>
      <p class="muted small" style="margin:4px 0 12px">Regardez la demande en direct et sortez quand ça vaut le coup. Pour l'instant, HOP! livre seulement dans le Sharon ; les autres zones arrivent bientôt.</p>
      <div class="zone-head"><b>Zone</b><b>Demande</b></div>
      ${CONFIG.zones.map(z => `<div class="zone-row${z.active ? "" : " off"}">
          <span class="zone-radio${z.active ? " on" : ""}"></span><b>${UI.esc(z.fr)}</b>
          <span class="zone-dem">${z.active ? (lv ? `${lv.label} ${bars(lv)}` : "…") : "Bientôt"}</span>
        </div>`).join("")}
      ${demand ? `<p class="small" style="margin-top:12px">En ce moment : <b>${demand.waiting}</b> course(s) en attente · <b>${demand.last_hour}</b> commande(s) cette dernière heure · <b>${demand.on_duty}</b> livreur(s) en ligne.</p>` : ""}
      <p class="muted small" style="margin-top:6px">Heures de pointe habituelles : ${UI.esc(CONFIG.peakHours.fr)}.</p>
    </div>
    ${forecastCard()}`;
}

// Prévisions de la journée : commandes moyennes par heure (même jour de la semaine, 4 semaines)
function forecastCard() {
  if (!forecast || !forecast.length) return "";
  const hours = forecast.map((n, h) => ({ h, n: Number(n) })).filter(x => x.h >= 8 && x.h <= 23);
  const top = Math.max(0.5, ...hours.map(x => x.n));
  const now = new Date().getHours();
  const any = hours.some(x => x.n > 0);
  return `<div class="card" style="margin-top:14px"><h3>📈 Prévisions de demande aujourd'hui</h3>
    <div class="fc-bars">${hours.map(x => `<div class="${x.h === now ? "now" : ""}"><i style="height:${Math.round(90 * x.n / top) + 3}px" class="${x.n / top > 0.66 ? "hi" : x.n / top > 0.33 ? "mid" : "lo"}"></i><span>${x.h}</span></div>`).join("")}</div>
    <p class="muted small">${any ? "Commandes moyennes par heure, d'après les 4 derniers " + new Date().toLocaleDateString("fr-FR", { weekday: "long" }) + "s. Les barres hautes : le meilleur moment pour être en ligne."
      : "Pas encore assez de commandes pour une prévision : elle se remplit avec les premières semaines."}</p></div>`;
}

// --- Signaler un souci pendant la course (HOP est prévenu, le client le voit) ----------------
const ISSUES = ["Client absent / ne répond pas", "Adresse introuvable", "Colis pas prêt au départ", "Colis abîmé",
  "Retard (circulation, attente)", "Panne ou accident", "Le client refuse le colis"];
function reportIssue(o) {
  if (!o) return;
  const send = async reason => {
    const extra = prompt(`« ${reason} » : un détail à ajouter ? (facultatif)`, "");
    if (extra === null) return;
    const text = extra.trim() ? `${reason} : ${extra.trim()}` : reason;
    const ok = await Store.courierIssue(o.id, text).catch(() => false);
    if (!ok) return alert("Souci non envoyé, vérifiez la connexion.");
    await load();
    // La conversation s'ouvre : photo ou précision pour HOP et le client
    openOrderChat(orders.find(x => x.id === o.id) || o);
  };
  Chat.choose(`⚠️ Un souci sur la course n° ${o.ref} ?`, [...ISSUES, "Autre souci"].map(r => ({ label: r, onClick: () => send(r) })));
}

// --- « Livré » seulement sur place ---------------------------------------------------------
const deliverRadius = () => Number(settings.deliver_radius || CONFIG.platform.deliverRadius);
function currentPos() {
  if (!navigator.geolocation) return Promise.reject(new Error("nogeo"));
  // En service : la position suivie en continu, si elle a moins de 20 s
  if (duty.watch != null && lastPos && Date.now() - lastPos.at < 20000) return Promise.resolve({ coords: { latitude: lastPos.lat, longitude: lastPos.lon } });
  const ask = opts => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), opts.timeout + 1000);
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(timer); resolve(p); }, e => { clearTimeout(timer); reject(e); }, opts);
  });
  // GPS précis d'abord, sinon la position réseau récente
  return ask({ enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 })
    .catch(() => ask({ enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }));
}
async function checkAtDropoff(o) {
  if (!o || o.dropoff_lat == null) return { ok: true };
  let p;
  try { p = await currentPos(); }
  catch (e) { return { ok: false, msg: "📍 Activez la localisation de votre téléphone : la livraison ne peut être validée que sur place, à l'adresse du client." }; }
  lastPos = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() };
  // La base vérifie la dernière position envoyée : on l'envoie tout de suite
  try { await Store.ping(lastPos.lat, lastPos.lon); duty.lastSent = Date.now(); } catch (e) { /* la base refusera si besoin */ }
  const m = Pricing.haversineKm(lastPos, { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) }) * 1000;
  if (m > deliverRadius()) {
    const d = m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    return { ok: false, msg: `📍 Vous êtes à ${d} de l'adresse de livraison. Vous pourrez valider « Livré » une fois sur place (moins de ${deliverRadius()} m).` };
  }
  return { ok: true };
}

// En ligne = bouton glissé et position GPS envoyée
const isOnline = () => duty.watch != null;

// --- Blocages (le patron peut tout débloquer) ----------------------------------------------
const PHOTO_MSG = "📷 Course « déposer devant la porte » : envoyez d'abord la photo du colis devant la porte dans la conversation, puis validez « Livré ».";
// Livreur débloqué par HOP jusqu'à une date
const freeNow = () => !!(me && me.unlocked_until && new Date(me.unlocked_until) > new Date());
// Solde : au-delà du plafond, plus de nouvelles courses jusqu'au règlement
const locked = () => !freeNow() && balance > Number(settings.max_debt);
// Une course récupérée doit être livrée et validée avant d'en prendre une autre
const busyOrder = () => orders.find(o => o.courier_id === me.id && o.status === "recuperee");
const busy = () => !freeNow() && !!busyOrder();
const blocked = () => locked() || busy();
function acceptError(e) {
  if (/busy/.test(e.message)) { const b = busyOrder(); alert(`🔒 Livrez d'abord votre course en cours${b ? " n° " + b.ref : ""} : validez « Livré » sur place${b && b.leave_at_door ? ", avec la photo devant la porte" : ""}. Un souci ? Écrivez à HOP.`); return "shown"; }
  if (/debt/.test(e.message)) { alert(`🔒 Vous devez ${UI.money(balance)} à HOP : réglez votre solde pour recevoir des courses.`); return "shown"; }
  return false;
}
async function hasDoorPhoto(o) {
  try { return (await Store.chatThread("o:" + o.id)).some(m => m.author === "courier" && m.image); } catch (e) { return true; /* la base vérifiera */ }
}
function renderLock() {
  const box = $("#lockBox");
  const b = busy() && busyOrder();
  box.classList.toggle("hidden", !locked() && !b && !freeNow());
  if (freeNow()) {
    box.className = "lock-box free";
    box.innerHTML = `<div><b>🔓 Débloqué par HOP</b><br><span class="small">jusqu'au ${UI.esc(UI.fmtDateTime(me.unlocked_until))}</span></div>`;
    return;
  }
  box.className = "lock-box" + (locked() || b ? "" : " hidden");
  if (!locked() && b) {
    box.innerHTML = `<div><b>🔒 Course n° ${UI.esc(b.ref)} en cours</b><br><span class="small">Validez « Livré » à l'adresse du client${b.leave_at_door ? " avec la photo devant la porte" : ""} pour prendre une autre course.</span></div>
      <button type="button" class="btn btn-wa" data-boss="${UI.esc(`Bonjour, j'ai un souci avec la course n° ${b.ref} :`)}">💬 Un souci ? Écrire à HOP</button>`;
    return;
  }
  if (!locked()) return;
  box.innerHTML = `<div><b>🔒 Vous devez ${UI.money(balance)} à HOP</b><br><span class="small">Réglez par Bit au ${UI.esc(CONFIG.bitPhone)} pour recevoir à nouveau des courses (plafond ${UI.money(settings.max_debt)}).</span></div>
    <button type="button" class="btn btn-wa" data-boss="${UI.esc(`Bonjour, je viens de régler mon solde de ${UI.money(balance)} par Bit.`)}">J'ai payé</button>`;
}

// --- Parrainage des commerces ------------------------------------------------------------
// Bonus réseau : courses de ses commerces livrées par un autre livreur (les siennes ont la commission réseau)
const refDelivered = () => refs.orders.filter(o => o.status === "livree" && !o.mine);
const bonusDue = () => sum(refDelivered().filter(o => o.referral_status !== "regle"), o => Number(o.referral_bonus || 0));
const levelOf = n => CONFIG.partners.levels.filter(l => n >= l.min).pop();
const nextLevel = n => CONFIG.partners.levels.find(l => n < l.min);
const shareLink = () => UI.appUrl("commerce.html") + "?p=" + encodeURIComponent(me.ref_code || "");

// Règle d'activité : les bonus ne sont versés que si vous avez livré au moins une course
// ces activeDays derniers jours (ou si vous êtes inscrit depuis moins longtemps)
function activity() {
  const days = Number(settings.referral_active_days || CONFIG.partners.activeDays);
  const last = orders.filter(o => o.courier_id === me.id && o.status === "livree").map(o => new Date(o.pickup_at).getTime()).sort((a, b) => b - a)[0];
  const from = Math.max(last || 0, new Date(me.created_at || 0).getTime());
  const left = Math.ceil(days - (Date.now() - from) / 86400000);
  return { days, left, active: left > 0, last };
}
function activityBox() {
  const a = activity();
  const rule = `Règle : vos bonus sont versés tant que vous livrez. Après ${a.days} jours (${Math.round(a.days / 7)} semaines) sans aucune livraison, ils s'arrêtent, et reprennent dès votre prochaine livraison.`;
  const cls = !a.active ? "act-off" : a.left <= 7 ? "act-warn" : "act-on";
  const head = !a.active ? "⛔ Bonus en pause : faites une livraison pour les réactiver"
    : a.left <= 7 ? `⚠️ Plus que ${a.left} jour(s) pour faire une livraison, sinon vos bonus s'arrêtent`
    : `✅ Vous êtes actif : vous touchez vos bonus (encore ${a.left} jours sans livraison possibles)`;
  return `<div class="act-box ${cls}"><b>${head}</b><small>${rule}</small></div>`;
}

// Temps d'avance restant sur une course de son commerce (les autres ne la voient pas encore)
function priorityLeft(o) {
  const left = Math.ceil((new Date(o.created_at).getTime() + Number(settings.priority_minutes) * 60000 - Date.now()) / 60000);
  return left > 0 ? ` · encore ${left} min rien que pour vous` : "";
}

function pitch() {
  const price = UI.money(CONFIG.pricing.fixedFromHome[CONFIG.homeCity] || CONFIG.pricing.base);
  const first = String(me.name || "").split(" ")[0];
  return `שלום! אני ${first}, שליח של ${CONFIG.businessNameHe} 🛵
משלוחים לעסק שלך החל מ-${price} בנתניה, מחיר קבוע, בלי עמלה על המכירות שלך.
מזומן או ביט, מעקב חי, קבלה.
הרשמה בחינם תוך דקה: ${shareLink()}

Bonjour ! Je suis ${first}, livreur ${CONFIG.businessName} 🛵
Vos livraisons dès ${price} dans Netanya, prix fixe, sans commission sur vos ventes.
Espèces ou Bit, suivi en direct, reçu.
Inscription gratuite en 1 minute : ${shareLink()}`;
}

function renderRef(view) {
  const bonus = Number(settings.referral_bonus);
  const delivered = refDelivered();
  const month = today().slice(0, 7);
  const monthList = delivered.filter(o => UI.dayKey(o.pickup_at).startsWith(month));
  const active = refs.shops.filter(s => s.status !== "suspendu");
  const lv = levelOf(active.length), nx = nextLevel(active.length);
  const statusLabel = { en_attente: "⏳ En vérification", actif: "✅ Partenaire", suspendu: "⛔ Suspendu" };
  const medals = ["🥇", "🥈", "🥉"];
  view.innerHTML = `
    <div class="card ref-hero">
      <h3>🤝 Amenez un commerce, gagnez à chaque livraison</h3>
      <ol class="ref-steps">
        <li><b>Proposez HOP!</b> à un restaurant, une boutique, une pharmacie… <b>de votre ville${me.city ? " (" + UI.esc(UI.cityFr(me.city)) + ")" : ""}</b>, surtout ceux qui n'ont pas de livreur. Un partenariat se fait seulement dans votre ville, pour que vous puissiez assurer leurs livraisons.</li>
        <li><b>Il s'inscrit avec votre lien</b> ou en scannant votre QR code (1 minute, gratuit).</li>
        <li><b>Ses courses vous sont proposées ${Number(settings.priority_minutes)} min avant</b> les autres livreurs, et quand vous les faites, la commission n'est que de <b>${UI.esc(UI.networkText())}</b>.</li>
        <li><b>${UI.money(bonus)} pour vous</b> sur chacune de ses courses quand un autre livreur la fait, <b>tant que vous livrez avec nous</b>.</li>
        <li><b>${CONFIG.pro.referrerPercent} % de son abonnement HOP! Pro</b> (${UI.money(CONFIG.pro.monthly * CONFIG.pro.referrerPercent / 100)} par mois) pendant ses ${CONFIG.pro.referrerMonths} premiers mois.</li>
      </ol>
      ${(refs.plans || []).length ? `<p class="small">⭐ Abonnements Pro : <b>${UI.money(sum(refs.plans, p => Number(p.share || 0)))}</b> gagnés au total, dont ${UI.money(sum(refs.plans.filter(p => p.status !== "regle"), p => Number(p.share || 0)))} pas encore versés.</p>` : ""}
      ${activityBox()}
      <div class="ref-code"><small>Votre code</small><b>${UI.esc(me.ref_code || "—")}</b></div>
      <div class="promo-row"><input readonly value="${UI.esc(shareLink())}" dir="ltr" /><button class="btn btn-sm" data-copy="${UI.esc(shareLink())}">Copier</button></div>
      <div class="btns" style="margin-top:10px">
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${UI.waShare(pitch())}">💬 Envoyer à un commerce</a>
        <button class="btn" data-qr="1">📱 Montrer mon QR code</button>
        <button class="btn" data-print="1">🖨️ Imprimer mon affiche</button>
      </div>
      <div class="qr hidden" id="refQr"></div>
      <div class="poster print-only" id="refPoster">
        <img src="logo.svg" alt="" class="poster-logo" />
        <b>Votre commerce sur HOP!</b>
        <span>העסק שלכם בהופ!</span>
        <div class="qr" id="refPosterQr"></div>
        <span>0 % de commission sur vos ventes · 0% עמלה על המכירות</span>
        <small>Scannez pour vous inscrire · סרקו להרשמה<br>Présenté par ${UI.esc(String(me.name || "").split(" ")[0])} · code ${UI.esc(me.ref_code || "")}</small>
      </div>
    </div>
    <div class="stats" style="margin-top:14px">
      <div class="stat"><small>Mes commerces</small><b>${active.length}</b></div>
      <div class="stat"><small>Livraisons ce mois</small><b>${monthList.length}</b></div>
      <div class="stat"><small>Gagné ce mois</small><b>${UI.money(sum(monthList, o => Number(o.referral_bonus || 0)))}</b></div>
      <div class="stat"><small>Gagné au total</small><b>${UI.money(sum(delivered, o => Number(o.referral_bonus || 0)))}</b></div>
    </div>
    <div class="card level-card">
      <b>${lv ? UI.esc(lv.name) : "Pas encore de niveau"}</b>
      ${nx ? `<div class="level-bar"><span style="width:${Math.round(100 * active.length / nx.min)}%"></span></div>
        <small class="muted">Plus que ${nx.min - active.length} commerce(s) pour devenir ${UI.esc(nx.name)}</small>` : `<small class="muted">Niveau maximum atteint, bravo !</small>`}
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Mes commerces</h3>
      ${refs.shops.length ? `<div class="shop-list">${refs.shops.map(sh => {
        const list = delivered.filter(o => o.shop_id === sh.id);
        return `<div class="shop-row"><div><b>${UI.esc(sh.name)}</b><small class="muted">${UI.esc(UI.cityFr(sh.city || ""))} · ${statusLabel[sh.status] || ""}</small></div>
          <div class="num"><b>${list.length}</b> livraison(s)<br><small class="muted">+${UI.money(sum(list, o => Number(o.referral_bonus || 0)))}</small></div></div>`;
      }).join("")}</div>` : `<p class="muted small" style="margin-top:6px">Aucun commerce pour l'instant. Commencez par le restaurant ou la boutique où vous passez le plus souvent !</p>`}
    </div>
    <div class="card" style="margin-top:14px">
      <h3>🏆 Classement des parrains du mois</h3>
      ${refs.board.length ? `<ol class="board">${refs.board.map((b, i) => `<li class="${b.me ? "me" : ""}"><span>${medals[i] || i + 1 + "."}</span><b>${UI.esc(b.name)}${b.me ? " (vous)" : ""}</b><small>${b.shops} commerce(s) · ${b.deliveries} livraison(s)</small></li>`).join("")}</ol>`
        : `<p class="muted small">Soyez le premier du classement !</p>`}
    </div>`;
}

// --- Messages du patron ------------------------------------------------------------------
const LS_MSG_SEEN = "livraison.msgSeen.v1";
function seenMsgs() { try { return new Set(JSON.parse(localStorage.getItem(LS_MSG_SEEN)) || []); } catch (e) { return new Set(); } }
let msgShown = null;

function myReply(id) { const r = msgs.replies.find(x => x.message_id === id && x.courier_id === me.id); return r && r.answer; }
const msgTime = m => new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const replyBtns = m => `<div class="msg-btns">
    <button class="btn btn-sm ${myReply(m.id) === "jarrive" ? "btn-primary" : ""}" data-reply="jarrive" data-msg="${UI.esc(m.id)}">🛵 J'arrive</button>
    <button class="btn btn-sm ${myReply(m.id) === "pas_dispo" ? "btn-dark" : ""}" data-reply="pas_dispo" data-msg="${UI.esc(m.id)}">😴 Pas dispo</button></div>`;

function renderMsgs() {
  const list = msgs.messages.filter(m => Date.now() - new Date(m.created_at) < 12 * 3600000).slice(0, 3);
  $("#msgs").innerHTML = list.map(m => `<div class="msg-card msg-${UI.esc(m.kind)}">
      <div><small>📣 ${m.to_courier ? "Message pour vous" : "Message du patron"} · ${msgTime(m)}</small><b>${UI.esc(m.body)}</b></div>
      ${replyBtns(m)}</div>`).join("");
}

function checkNewMessages() {
  const seen = seenMsgs();
  const fresh = msgs.messages.filter(m => !seen.has(m.id) && Date.now() - new Date(m.created_at) < 3 * 3600000);
  msgs.messages.forEach(m => seen.add(m.id));
  try { localStorage.setItem(LS_MSG_SEEN, JSON.stringify([...seen].slice(-200))); } catch (e) { /* ignore */ }
  renderMsgs();
  if (!fresh.length) return;
  const m = fresh[0];
  beep();
  UI.notify("📣 " + CONFIG.businessName, { body: m.body, tag: "hop-msg" });
  msgShown = m.id;
  $("#msgBody").textContent = m.body;
  $("#msgTime").textContent = (m.to_courier ? "Message pour vous" : "Message du patron") + " · " + msgTime(m);
  $("#msgModalBtns").innerHTML = replyBtns(m);
  $("#msgModal").classList.remove("hidden");
}

async function onReply(el) {
  const id = el.dataset.msg, answer = el.dataset.reply;
  el.disabled = true;
  try { await Store.replyMessage(id, answer); } catch (e) { el.disabled = false; return alert("Réponse non envoyée, vérifiez la connexion."); }
  const r = msgs.replies.find(x => x.message_id === id && x.courier_id === me.id);
  if (r) r.answer = answer; else msgs.replies.push({ message_id: id, courier_id: me.id, answer });
  $("#msgModal").classList.add("hidden");
  renderMsgs();
  if (answer === "jarrive" && duty.watch == null && confirm("Super ! Passer en ligne maintenant ?")) toggleDuty();
}

function onWorkClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.boss != null) return openBossChat(el.dataset.boss);
  if (el.dataset.open) return openPage(el.dataset.open);
  if (el.dataset.soundTest) { const s = riderSet.sound; riderSet.sound = true; ringOnce(); riderSet.sound = s; return; }
  if (el.dataset.notif) {
    if (!window.Notification) return alert("Les notifications ne sont pas disponibles sur ce navigateur.");
    return Notification.requestPermission().then(p => {
      UI.pushSubscribe();
      if (p === "granted" && isOnline()) UI.dutyNotice(true);
      render(); renderHome();
    });
  }
  if (el.dataset.logout) return $("#drawerLogout").click();
  if (el.dataset.issue) return reportIssue(orders.find(x => x.id === el.dataset.issue));
  // Colis à récupérer : les photos du client (avis, carte d'identité, procuration, rendez-vous) à montrer au guichet
  if (el.dataset.docs) {
    const o = orders.find(x => x.id === el.dataset.docs);
    if (!o) return;
    return Store.orderDocs(o.id).then(list => UI.photoViewer(`${UI.PLACE_FR[o.place_kind] || ""} · N° ${o.tracking_number || "—"}`,
      list.map(d => ({ label: UI.DOC_FR[d.kind] || d.kind, src: d.photo })))).catch(() => alert("Documents introuvables, vérifiez la connexion."));
  }
  if (el.dataset.chat) {
    const o = orders.find(x => x.id === el.dataset.chat);
    if (o) openOrderChat(o, !!el.dataset.photo);
    return;
  }
  if (el.dataset.reply) return onReply(el);
  if (el.dataset.copy) {
    navigator.clipboard && navigator.clipboard.writeText(el.dataset.copy).then(() => { el.textContent = "✓ Copié"; }, () => {});
    return;
  }
  if (el.dataset.print) {
    const box = $("#refPosterQr");
    if (!box.dataset.done && window.QRCode) { new QRCode(box, { text: shareLink(), width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); box.dataset.done = "1"; }
    document.body.classList.add("print-poster");
    setTimeout(() => { window.print(); document.body.classList.remove("print-poster"); }, 200);
    return;
  }
  if (el.dataset.qr) {
    const box = $("#refQr");
    box.classList.toggle("hidden");
    if (!box.dataset.done && window.QRCode) {
      new QRCode(box, { text: shareLink(), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      box.dataset.done = "1";
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
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ Express : moins d'une heure" : "Dès que possible";
  $("#offerIcon").textContent = { repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" }[o.service] || "📦";
  const total = Store.courseValue(o);
  $("#offerPrice").textContent = UI.money(total);
  const star = !!o.referrer_id && o.referrer_id === me.id;
  const com = Store.commissionFor(total, settings, star);
  $("#offerGain").textContent = `Vous gagnez ${UI.money(total - com)} (commission ${star ? "réseau " : ""}${UI.money(com)}${star ? " : c'est votre commerce ⭐" : ""})`;
  // Proposée d'abord aux livreurs en service les plus proches (vagues de wave_seconds)
  const early = !star && duty.watch != null && Date.now() - new Date(o.created_at) < 2 * Number(settings.wave_seconds) * 1000;
  $("#offerStar").innerHTML = star ? `⭐ Course de <b>votre</b> commerce ${UI.esc(o.shop_name || "")}${priorityLeft(o)}`
    : early ? "🎯 Vous êtes parmi les plus proches : elle vous est proposée en premier" : "";
  $("#offerStar").classList.toggle("hidden", !star && !early);
  $("#offerFrom").textContent = UI.cityFr(o.from_city);
  $("#offerTo").textContent = UI.cityFr(o.to_city);
  $("#offerFacts").innerHTML = [
    `🛣️ <b>${trip != null && trip >= 0.5 ? `≈ ${trip.toFixed(trip < 10 ? 1 : 0)} km` : "Dans la même ville"}</b> de trajet`,
    toPickup != null ? `🛵 À ≈ ${toPickup.toFixed(1)} km de vous` : "",
    `🕐 ${UI.esc(when)}`,
    o.paid_to === "hop" ? (o.payment_status === "paye" ? "✅ Déjà payée à HOP : rien à encaisser, HOP vous reverse le montant"
      : "📱 Payée par Bit à HOP : rien à encaisser, HOP vous reverse le montant") : `💵 Espèces : vous encaissez ${UI.money(o.price)} auprès du client`,
    `${UI.esc(UI.SERVICE_FR[o.service] || "")} · ${UI.esc(UI.SIZE_FR[o.size] || "")} · ${UI.PAY_FR[o.payment_method] || ""}`,
    o.shop_status ? proLine(o) : "",
    o.phone_order ? phoneLine(o) : "",
    o.shop_ref ? `🛍️ Sac n° <b>${UI.esc(o.shop_ref)}</b>` : "",
    o.adult_items ? "🔞 Tabac / alcool : pièce d'identité à vérifier (18 ans +)" : "",
    Array.isArray(o.stops) && o.stops.length ? `📌 ${o.stops.length} arrêt(s) en plus sur la course` : "",
    `⏱️ Attente / achats payés : ${UI.esc(UI.waitRule(settings))}${o.shop_status ? " (après l'heure annoncée, payés par le commerce)" : o.phone_order ? " (après l'heure annoncée, payés par le client)" : ""}`
  ].filter(Boolean).map(x => `<div>${x}</div>`).join("");
  $("#offerModal").classList.remove("hidden");
  startRing();
  // 40 secondes pour répondre, ensuite la course est proposée à un autre livreur
  clearInterval(offerTick);
  let left = 40;
  $("#offerTimer").textContent = `· ${left} s`;
  offerTick = setInterval(() => {
    left--;
    $("#offerTimer").textContent = left > 0 ? `· ${left} s` : "";
    if (left <= 0 && offerShown === o.id) declineOffer("sans_reponse");
  }, 1000);
  // Position pas encore connue : on la demande une fois pour afficher « à X km de vous »
  if (!lastPos && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      lastPos = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (offerShown === o.id) { offerShown = null; offerQueue.unshift(o.id); showNextOffer(); }
    }, () => {}, { maximumAge: 60000, timeout: 8000 });
  }
}

let offerTick = null;
function closeOffer() {
  clearInterval(offerTick);
  stopRing();
  $("#declineWhy").classList.add("hidden");
  $("#etaPick").classList.add("hidden");
  $("#offerAccept").classList.remove("hidden");
  $("#offerModal").classList.add("hidden");
  offerShown = null;
  setTimeout(showNextOffer, 300);
}

// Refuser : on demande pourquoi (un geste), puis la course passe tout de suite au livreur suivant
function askWhy() {
  clearInterval(offerTick);
  stopRing();
  $("#offerTimer").textContent = "";
  $("#declineWhy").classList.remove("hidden");
}
async function declineOffer(reason) {
  const id = offerShown;
  closeOffer();
  if (id) afterDecline(await Store.declineOrder(id, reason).catch(() => null));
  load();
}
// Trop de refus d'affilée : HOP l'a passé hors ligne (pour ne pas faire attendre les clients)
function afterDecline(r) {
  if (!r || !r.offline) return;
  if (duty.watch != null) toggleDuty(true);
  try { localStorage.setItem("livraison.online.v1", ""); } catch (e) { /* ignore */ }
  $("#autoOffText").textContent = `${r.max || 3} courses refusées ou sans réponse d'affilée : on vous a passé hors ligne pour ne pas faire attendre les clients. Repassez en ligne dès que vous êtes prêt à accepter des courses.`;
  $("#autoOffModal").classList.remove("hidden");
}

// Temps pour être au départ : proposé d'après la distance, le livreur choisit
const ETA_STEPS = [5, 10, 15, 20, 30, 45, 60];
function etaGuess(o) {
  const km = roadKm(lastPos, pt(o.pickup_lat, o.pickup_lon));
  const m = km == null ? 15 : Math.ceil(km * 2.5 + 3);
  return ETA_STEPS.find(x => x >= m) || 60;
}
function askEta() {
  const o = pool().find(x => x.id === offerShown);
  if (!o) return closeOffer();
  clearInterval(offerTick);
  stopRing();
  $("#offerTimer").textContent = "";
  const g = etaGuess(o);
  $("#etaChips").innerHTML = ETA_STEPS.map(m => `<button type="button" class="ch-chip${m === g ? " on" : ""}" data-eta="${m}">${m} min</button>`).join("");
  $("#etaPick").classList.remove("hidden");
  $("#offerAccept").classList.add("hidden");
}
$("#etaChips").addEventListener("click", e => { const b = e.target.closest("[data-eta]"); if (b) acceptOffer(Number(b.dataset.eta)); });
async function acceptOffer(eta) {
  const id = offerShown;
  // Avant d'accepter : dans combien de temps au départ ?
  if (typeof eta !== "number") return askEta();
  $("#etaPick").classList.add("hidden");
  $("#offerAccept").classList.remove("hidden");
  $("#offerAccept").disabled = true;
  const ok = await Store.acceptOrder(id, eta).catch(e => acceptError(e));
  $("#offerAccept").disabled = false;
  closeOffer();
  if (ok === "shown") { /* message déjà affiché */ }
  else if (!ok) alert("Trop tard, un autre livreur a pris cette course.");
  else {
    openPage("mine");
    if (duty.watch == null && confirm("Course acceptée ! Rester en ligne pour que le client vous suive sur la carte ?")) toggleDuty();
  }
  load();
}

// --- Appli livreur : réglages, pages du menu, panneau du bas, glisser pour se connecter -----
const LS_RIDER = "livraison.riderSettings.v1";
const riderSet = Object.assign({ nav: "waze", mode: "scooter", theme: "dark", sound: true },
  (() => { try { return JSON.parse(localStorage.getItem(LS_RIDER)) || {}; } catch (e) { return {}; } })());
function saveRiderSet() { try { localStorage.setItem(LS_RIDER, JSON.stringify(riderSet)); } catch (e) { /* ignore */ } }
function applyRiderSettings() {
  $("#work").classList.toggle("light", riderSet.theme === "light");
  if (rmap.tiles) rmap.tiles.getContainer().classList.toggle("tiles-dark", riderSet.theme !== "light");
}
const PAGE_TITLES = { mine: "Mes courses", pool: "Courses disponibles", zones: "Zones et demande", week: "Finances", stats: "Statistiques",
  ref: "Gagner plus", rules: "Engagements et assurance", settings: "Réglages", help: "Centre d'aide", inbox: "Messages de HOP!" };
function openPage(t) {
  tab = t;
  $("#pageTitle").textContent = PAGE_TITLES[t] || "";
  $("#page").classList.remove("hidden");
  $("#view").innerHTML = "";
  render();
}
function closePage() { tab = "home"; $("#page").classList.add("hidden"); render(); }
function closeDrawer() { $("#drawer").classList.add("hidden"); }

// Lien de navigation selon l'application choisie dans les réglages
const TRAVEL = { scooter: "driving", car: "driving", bike: "bicycling", walk: "walking" };
function navLink(o, which) {
  if (riderSet.nav === "maps") {
    const ll = (which === "pickup" ? [o.pickup_lat, o.pickup_lon] : [o.dropoff_lat, o.dropoff_lon]).filter(x => x != null).join(",");
    return "https://www.google.com/maps/dir/?api=1&travelmode=" + TRAVEL[riderSet.mode] + "&destination=" + encodeURIComponent(ll || UI.placeQuery(o, which));
  }
  return UI.wazeLink(o, which);
}

// Panneau du bas : demande, course en cours, courses disponibles, « gagner plus »
function renderHome() {
  const lv = demandLevel(demand);
  const title = !isOnline() ? "Vous êtes hors ligne" : !lv ? "Bonjour " + String(me.name || "").split(" ")[0] + " !" : lv.n === 3 ? "🔥 Ça vaut le coup de sortir !" : lv.n === 2 ? "Ça roule tranquille" : "C'est calme pour l'instant";
  const cur = mine();
  const p = pool();
  $("#sheetBody").innerHTML = `
    <div class="rd-title">${UI.esc(title)}</div>
    <div class="rd-demand">Demande de livraison ${lv ? `${bars(lv)} <b>${lv.label}</b>` : "…"}</div>
    ${cur.map(o => `<button type="button" class="rd-card course" data-tab="mine">
        <span>🛵 Course n° ${UI.esc(o.ref)} · ${o.status === "confirmee" ? "à récupérer" : "à livrer"}
          <small>${UI.esc(o.status === "confirmee" ? (o.pickup_place || o.pickup_address) : o.dropoff_address)}, ${UI.esc(UI.cityFr(o.status === "confirmee" ? o.from_city : o.to_city))}</small></span><span class="go">›</span></button>`).join("")}
    ${!isOnline() && !cur.length ? `<button type="button" class="rd-card" data-tab="zones"><span>📈 ${lv && lv.n === 3 ? "Beaucoup de commandes en ce moment : passez en ligne !" : "Passez en ligne pour recevoir des courses"}<small>Voir les prévisions de la journée</small></span><span class="go">›</span></button>` : ""}
    ${isOnline() && (p.length || !cur.length) ? (p.length ? `<button type="button" class="rd-card hot" data-tab="pool"><span>🆕 ${p.length} course(s) disponible(s)<small>Touchez pour voir et accepter</small></span><span class="go">›</span></button>`
      : `<button type="button" class="rd-card" data-tab="zones"><span>Pas de course pour l'instant<small>Les heures de pointe : ${UI.esc(CONFIG.peakHours.fr)}</small></span><span class="go">›</span></button>`) : ""}
    ${window.Notification && Notification.permission !== "granted" ? `<button type="button" class="rd-card hot" data-notif="1"><span>🔔 ${Notification.permission === "denied" ? "Notifications bloquées" : "Autorisez les notifications"}<small>${Notification.permission === "denied" ? "Chrome ⋮ → Paramètres → Notifications → autorisez HOP!, sinon pas de « En service » ni de courses appli fermée" : "Pour la notification « En service » et les nouvelles courses, même appli fermée"}</small></span><span class="go">›</span></button>` : ""}
    ${UI.inOwnApp() ? "" : `<button type="button" class="rd-card" data-install><span>📲 Mettre HOP! Livreur sur l'écran d'accueil<small>Son icône « LIVREUR », et les alertes même appli fermée</small></span><span class="go">›</span></button>`}
    <button type="button" class="rd-card" data-tab="ref"><span>🏆 Gagnez plus en amenant des commerces<small>+${UI.money(settings.referral_bonus)} sur chacune de leurs livraisons</small></span><span class="go">›</span></button>`;
  const h = $("#sheet").offsetHeight;
  if (h) $("#work").style.setProperty("--sheet-h", h + "px");
}

// État « en service » : glissière, menu, texte
function renderDuty() {
  const on = duty.watch != null;
  $("#slide").classList.toggle("on", on);
  $("#slideText").textContent = on ? "En ligne · glisser pour finir" : "Glisser pour passer en ligne";
  $("#drawerStatus").textContent = on ? "🟢 En ligne" : "Hors ligne";
  $("#drawerStatus").classList.toggle("on", on);
  if (!on) $("#dutyText").textContent = "Hors ligne : vous ne recevez pas de course. En ligne, les courses proches de vous arrivent d'abord chez vous.";
  if (me) renderHome();
  updateRiderMap();
}
// Glisser le bouton jusqu'au bout pour passer en service (ou terminer) : pas de clic par erreur
function initSlider() {
  const slide = $("#slide"), knob = $("#knob");
  let startX = null, dx = 0;
  const rtl = () => document.documentElement.dir === "rtl";
  const max = () => slide.clientWidth - knob.offsetWidth - 12;
  slide.addEventListener("pointerdown", e => { startX = e.clientX; dx = 0; slide.classList.add("dragging"); slide.setPointerCapture(e.pointerId); });
  slide.addEventListener("pointermove", e => {
    if (startX == null) return;
    dx = Math.max(0, Math.min(max(), (e.clientX - startX) * (rtl() ? -1 : 1)));
    knob.style.transform = `translateX(${rtl() ? -dx : dx}px)`;
  });
  const end = () => {
    if (startX == null) return;
    startX = null;
    slide.classList.remove("dragging");
    knob.style.transform = "";
    if (dx > max() * 0.75) toggleDuty();
  };
  slide.addEventListener("pointerup", end);
  slide.addEventListener("pointercancel", end);
  slide.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDuty(); } });
}

// --- Carte plein écran : ma position, courses disponibles, ma course ---------------------
const rmap = { map: null, tiles: null, layer: null, fitted: false };
function initRiderMap() {
  if (rmap.map || !window.L) return;
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  rmap.map = L.map("riderMap", { zoomControl: false, attributionControl: true }).setView([home.lat, home.lon], 13);
  rmap.tiles = UI.mapTiles(rmap.map, riderSet.theme !== "light");
  rmap.layer = L.layerGroup().addTo(rmap.map);
  setTimeout(() => rmap.map.invalidateSize(), 100);
}
const rpin = (emoji, cls, label) => L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18],
  html: `<div class="rd-pin ${cls || ""}">${emoji}${label ? `<span class="pin-price">${UI.esc(label)}</span>` : ""}</div>` });
function updateRiderMap() {
  if (!rmap.map || !me) return;
  rmap.layer.clearLayers();
  const pts = [];
  const add = (lat, lon, icon, popup) => {
    if (lat == null || lon == null) return;
    const m = L.marker([Number(lat), Number(lon)], { icon }).addTo(rmap.layer);
    if (popup) m.bindPopup(popup);
    pts.push([Number(lat), Number(lon)]);
  };
  pool().forEach(o => add(o.pickup_lat, o.pickup_lon, rpin({ repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" }[o.service] || "📦", "", UI.money(Store.courseValue(o))),
    `<b>Course n° ${UI.esc(o.ref)}</b><br>${UI.esc(UI.cityFr(o.from_city))} → ${UI.esc(UI.cityFr(o.to_city))} · ${UI.money(Store.courseValue(o))}`));
  mine().forEach(o => {
    add(o.pickup_lat, o.pickup_lon, rpin("📍"), `Récupération · n° ${UI.esc(o.ref)}`);
    add(o.dropoff_lat, o.dropoff_lon, rpin("🏁", "drop"), `Livraison · n° ${UI.esc(o.ref)}`);
    if (o.pickup_lat != null && o.dropoff_lat != null) L.polyline([[o.pickup_lat, o.pickup_lon], [o.dropoff_lat, o.dropoff_lon]], { color: "#FF6A13", weight: 4, dashArray: "8 8" }).addTo(rmap.layer);
  });
  if (lastPos) add(lastPos.lat, lastPos.lon, rpin("🛵", duty.watch != null ? "me" : "off"), "Vous êtes ici");
  rmap.pts = pts;
  if (!rmap.fitted && pts.length) { fitRiderMap(); rmap.fitted = true; }
}
function fitRiderMap() {
  if (!rmap.map || !rmap.pts || !rmap.pts.length) return;
  rmap.map.fitBounds(rmap.pts, { padding: [60, 60], maxZoom: 15, paddingBottomRight: [0, 260] });
}

// --- Pages : statistiques, réglages, aide, messages -----------------------------------------
function renderStats(view) {
  const done = orders.filter(o => o.courier_id === me.id && o.status === "livree");
  const gain = list => sum(list, o => Store.courierGain(o) + (["recu", "verse"].includes(o.tip_status) ? Number(o.tip || 0) : 0));
  const start = UI.weekStart(today());
  const weeks = [5, 4, 3, 2, 1, 0].map(i => {
    const s = UI.addDays(start, -7 * i), e = UI.addDays(s, 6);
    const list = done.filter(o => UI.dayKey(o.pickup_at) >= s && UI.dayKey(o.pickup_at) <= e);
    return { s, n: list.length, g: gain(list) };
  });
  const top = Math.max(1, ...weeks.map(w => w.g));
  const month = today().slice(0, 7);
  const mList = done.filter(o => UI.dayKey(o.pickup_at).startsWith(month));
  const days = {};
  done.forEach(o => { const d = new Date(o.pickup_at).toLocaleDateString("fr-FR", { weekday: "long" }); days[d] = (days[d] || 0) + 1; });
  const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
  const km = sum(done, o => Number(o.distance_km || 0) * 1.3);
  view.innerHTML = `<div class="stats">
      <div class="stat"><small>Courses ce mois</small><b>${mList.length}</b></div>
      <div class="stat"><small>Gagné ce mois</small><b>${UI.money(gain(mList))}</b></div>
      <div class="stat"><small>Courses au total</small><b>${done.length}</b></div>
      <div class="stat"><small>Moyenne par course</small><b>${UI.money(done.length ? gain(done) / done.length : 0)}</b></div>
    </div>
    <div class="card"><h3>Vos gains des 6 dernières semaines</h3>
      <div class="stat-bars">${weeks.map(w => `<div><b>${w.g ? UI.money(w.g) : ""}</b><i style="height:${Math.round(110 * w.g / top) + 4}px"></i><span>${UI.esc(UI.fmtKey(w.s).replace(/\s\d{4}$/, ""))}</span></div>`).join("")}</div>
      <p class="muted small">Gains = courses − commission HOP + pourboires reçus (hors bonus réseau et abonnements Pro).</p></div>
    <div class="card" style="margin-top:14px"><table class="prices">
      <tr><td>Meilleur jour</td><td>${best ? UI.esc(best[0]) + " (" + best[1] + " course(s))" : "—"}</td></tr>
      <tr><td>Distance parcourue (estimée)</td><td>≈ ${Math.round(km)} km</td></tr>
      <tr><td>Commerces amenés</td><td>${refs.shops.length}</td></tr>
      <tr><td>Note des clients</td><td>${(r => r ? `⭐ ${r.avg.toFixed(1).replace(".", ",")} / 5 (${r.n} avis)` : "Pas encore d'avis")(UI.ratingOf(done))}</td></tr>
      <tr><td>Taux d'acceptation (30 jours)</td><td>${acceptance && acceptance.accepted + acceptance.declined
        ? Math.round(100 * acceptance.accepted / (Number(acceptance.accepted) + Number(acceptance.declined))) + " % (" + acceptance.declined + " refus)" : "—"}</td></tr>
    </table></div>
    ${(() => {
      const notes = done.filter(o => o.rating != null && (o.rating_note || (o.rating_tags || []).length)).sort((a, b) => new Date(b.rated_at) - new Date(a.rated_at)).slice(0, 5);
      return notes.length ? `<div class="card" style="margin-top:14px"><h3>Ce que disent vos clients</h3>${notes.map(o => `<p class="small" style="margin:8px 0">${UI.esc(UI.ratingText(o))}${o.rating_note ? `<br><span class="muted">« ${UI.esc(o.rating_note)} »</span>` : ""}</p>`).join("")}</div>` : "";
    })()}`;
}
function renderSettings(view) {
  const opt = (k, v, label) => `<option value="${v}" ${riderSet[k] === v ? "selected" : ""}>${label}</option>`;
  const notif = window.Notification ? (Notification.permission === "granted" ? "🔔 Activées" : "Activer") : "Indisponible";
  view.innerHTML = `<div class="card set-list">
      <h3>Navigation</h3>
      <div class="set-row"><span>Application de navigation</span><select data-set="nav">${opt("nav", "waze", "Waze")}${opt("nav", "maps", "Google Maps")}</select></div>
      <div class="set-row"><span>Mode de déplacement</span><select data-set="mode">${opt("mode", "scooter", "Scooter / moto")}${opt("mode", "car", "Voiture")}${opt("mode", "bike", "Vélo")}${opt("mode", "walk", "À pied")}</select></div>
      <h3>Affichage et sons</h3>
      <div class="set-row"><span>Apparence</span><select data-set="theme">${opt("theme", "dark", "Sombre")}${opt("theme", "light", "Clair")}</select></div>
      <div class="set-row"><span>Son des nouvelles courses</span><select data-set="sound"><option value="1" ${riderSet.sound !== false ? "selected" : ""}>Activé</option><option value="0" ${riderSet.sound === false ? "selected" : ""}>Coupé</option></select></div>
      <div class="set-row"><span>Tester le son</span><button type="button" class="btn btn-sm" data-sound-test="1">🔊 Tester</button></div>
      <div class="set-row"><span>Alertes sur le téléphone</span><button type="button" class="btn btn-sm" data-notif="1">${notif}</button></div>
      <div class="set-row"><span>La semaine commence le</span><b>Dimanche</b></div>
      <h3>Communication</h3>
      <div class="set-row"><span>Nous envoyer un commentaire</span><button type="button" class="btn btn-sm btn-wa" data-boss="Mon avis sur l'application : ">💬 Écrire</button></div>
      <h3>Compte</h3>
      <div class="set-row"><span>${UI.esc(me.name)} · ${UI.esc(me.phone || "")}</span><button type="button" class="btn btn-sm" data-logout="1">Se déconnecter</button></div>
      <div class="set-row"><span>Engagements et assurance</span><button type="button" class="btn btn-sm" data-open="rules">Voir</button></div>
    </div>`;
}
function renderHelp(view) {
  const faq = [
    ["Comment je reçois des courses ?", "Passez en ligne : glissez le bouton « HOP! » jusqu’au bout. Les courses arrivent d’abord au livreur en ligne le plus proche du départ, puis aux autres. Une fenêtre s'ouvre avec le prix, votre gain et les kilomètres."],
    ["Comment je suis payé ?", `Vous encaissez le client en espèces. Le Bit, les courses programmées et les carnets pro sont payés à HOP, qui vous les reverse. Chaque semaine : vous versez à HOP sa commission (${UI.commissionText()}, ou ${UI.networkText()} sur vos commerces), moins vos bonus, pourboires et parts d'abonnement, ou HOP vous verse la différence. Voir « Finances ».`],
    ["Pourquoi je ne peux pas valider « Livré » ?", `Il faut être à moins de ${deliverRadius()} m de l'adresse de livraison. Pour « déposer devant la porte », envoyez d'abord la photo du colis dans la conversation de la course.`],
    ["Pourquoi je ne reçois plus de courses ?", `Soit une course récupérée n'est pas encore validée, soit votre solde dû dépasse ${UI.money(settings.max_debt)}. Le bandeau rouge vous dit quoi faire. Un souci ? HOP peut vous débloquer.`],
    ["Le client est absent, l'adresse est introuvable…", "Touchez « ⚠️ Un souci » sur la course : HOP et le client sont prévenus tout de suite, et vous continuez dans la conversation."],
    ["Comment gagner plus ?", `Amenez des commerces avec votre code (menu « Gagner plus ») : vous voyez leurs courses en premier, vous ne payez que ${UI.networkText()} de commission dessus, +${UI.money(settings.referral_bonus)} quand un autre livreur les fait, et ${CONFIG.pro.referrerPercent} % de leur abonnement HOP! Pro pendant ${CONFIG.pro.referrerMonths} mois.`],
    ["Et les pourboires ?", "Après la livraison, le client peut laisser un pourboire : il le paie à HOP par Bit, et HOP vous le reverse en entier avec votre solde de la semaine."],
    ["Le GPS se coupe ?", "Gardez l'application ouverte pendant le service : les téléphones coupent la position quand la page est fermée."]
  ];
  view.innerHTML = `<div class="card help">${faq.map(([q, a]) => `<details><summary>${UI.esc(q)}</summary><p>${UI.esc(a)}</p></details>`).join("")}
    <button type="button" class="btn btn-wa" style="margin-top:14px" data-boss="Bonjour, j'ai une question : ">💬 Poser une question à HOP</button></div>`;
}
function renderInbox(view) {
  const list = msgs.messages;
  view.innerHTML = `<button type="button" class="btn btn-wa btn-block" data-boss="">💬 Écrire à HOP${chatUnread["c:" + me.id] ? ` <span class="chat-badge">${chatUnread["c:" + me.id]}</span>` : ""}</button>
    <h3 style="margin:16px 0 8px">📣 Annonces (48 h)</h3>
    ${list.length ? list.map(m => `<div class="msg-card msg-${UI.esc(m.kind)}"><div><small>${UI.esc(UI.fmtDateTime(m.created_at))}</small><b>${UI.esc(m.body)}</b></div>${replyBtns(m)}</div>`).join("")
      : `<div class="empty card">Pas d'annonce en ce moment.</div>`}`;
}

// --- En service : position GPS ------------------------------------------------------
const duty = { watch: null, lastSent: 0, wakeLock: null };

async function sendPosition(pos) {
  lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, at: Date.now() };
  updateRiderMap();
  if (Date.now() - duty.lastSent < 15000) return;
  duty.lastSent = Date.now();
  try {
    await Store.ping(pos.coords.latitude, pos.coords.longitude);
    // Première position après le passage en ligne : les courses arrivent tout de suite
    if (duty.fresh) { duty.fresh = false; Promise.resolve(duty.onlineP).catch(() => {}).then(() => setTimeout(load, 1200)); }
    $("#dutyText").textContent = `Position envoyée à ${new Date().toLocaleTimeString("fr-FR")} · vous pouvez passer sur Waze : vous restez en ligne.`;
  } catch (e) {
    duty.lastSent = 0;
    $("#dutyText").textContent = "⚠️ Position non envoyée (connexion). Nouvel essai automatique.";
  }
}

// « HOP! » en grand quand on passe en ligne
function hopBurst() {
  const el = document.createElement("div");
  el.className = "rd-hop";
  el.innerHTML = `<b>HOP!</b><span>🟢 Vous êtes en ligne</span>`;
  $("#work").appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
async function toggleDuty(quiet) {
  if (duty.watch != null) {
    navigator.geolocation.clearWatch(duty.watch);
    duty.watch = null;
    if (duty.wakeLock) { duty.wakeLock.release().catch(() => {}); duty.wakeLock = null; }
  } else {
    if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur ce téléphone.");
    duty.fresh = true; duty.lastSent = 0;
    duty.watch = navigator.geolocation.watchPosition(sendPosition, err => {
      $("#dutyText").textContent = err.code === 1 ? "⚠️ Autorisez la localisation pour ce site." : "⚠️ Position GPS introuvable pour le moment…";
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    try { if (navigator.wakeLock) duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* facultatif */ }
  }
  // En ligne / hors ligne pour HOP : seules les personnes en ligne reçoivent des courses
  duty.onlineP = Store.setOnline(duty.watch != null).then(() => { if (duty.watch == null) load(); }).catch(() => {});
  // Notification « En service » qui reste affichée : on peut passer sur Waze et revenir en un geste
  UI.dutyNotice(duty.watch != null, "Vous recevez les courses. Touchez ici pour revenir dans HOP! (Waze reste ouvert).");
  if (duty.watch != null && !quiet) hopBurst();
  try { localStorage.setItem("livraison.online.v1", duty.watch != null ? "1" : ""); } catch (e) { /* ignore */ }
  renderDuty();
}

// --- Démarrage ------------------------------------------------------------------
let pollTimer;
renderWelcome();
document.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => showAuth(b.dataset.auth)));
$("#signupForm").addEventListener("submit", onSignup);
$("#signupForm [name=topcase]").addEventListener("change", onTopcasePicked);
$("#waitTopcaseFile").addEventListener("change", onWaitTopcase);
$("#loginForm").addEventListener("submit", onLogin);
// Se déconnecter termine aussi le service : plus de courses proposées, plus visible sur la carte
async function endAndLogout() {
  clearInterval(pollTimer);
  if (duty.watch != null) toggleDuty(true);
  await Store.setOnline(false).catch(() => {});
  try { localStorage.setItem("livraison.online.v1", ""); } catch (e) { /* ignore */ }
  UI.dutyNotice(false);
  Store.logout(); route();
}
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); endAndLogout(); });
// De retour dans HOP! (après Waze) : position tout de suite et notification « En service » remise
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || duty.watch == null) return;
  duty.lastSent = 0;
  navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  UI.dutyNotice(true, "Vous recevez les courses. Touchez ici pour revenir dans HOP! (Waze reste ouvert).");
});
$("#waitRefresh").addEventListener("click", route);
$("#drawerNav").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]");
  if (b) { closeDrawer(); openPage(b.dataset.tab); }
});
$("#menuBtn").addEventListener("click", () => $("#drawer").classList.remove("hidden"));
$("#drawer").addEventListener("click", e => { if (e.target.id === "drawer") closeDrawer(); });
$("#bellBtn").addEventListener("click", () => openPage("inbox"));
$("#pageBack").addEventListener("click", closePage);
$("#drawerLogout").addEventListener("click", () => { if (confirm("Se déconnecter ?")) endAndLogout(); });
$("#locateBtn").addEventListener("click", () => { if (rmap.map && lastPos) rmap.map.setView([lastPos.lat, lastPos.lon], 15); else fitRiderMap(); });
$("#sheetBody").addEventListener("click", e => {
  if (e.target.closest("[data-install]")) return UI.installApp("HOP! Livreur", "livreur/").then(ok => { if (ok) renderHome(); });
  const b = e.target.closest("[data-tab]");
  if (b) openPage(b.dataset.tab);
});
initSlider();
$("#view").addEventListener("click", onViewClick);
$("#view").addEventListener("change", e => {
  const k = e.target.dataset.set;
  if (!k) return;
  riderSet[k] = k === "sound" ? e.target.value === "1" : e.target.value;
  saveRiderSet();
  applyRiderSettings();
  render();
});
$("#work").addEventListener("click", onWorkClick);
$("#bossChat").addEventListener("click", () => { closeDrawer(); openBossChat(); });
$("#msgModal").addEventListener("click", e => { const el = e.target.closest("button"); if (el && el.dataset.reply) onReply(el); });
$("#msgClose").addEventListener("click", () => $("#msgModal").classList.add("hidden"));
$("#offerAccept").addEventListener("click", acceptOffer);
$("#offerSkip").addEventListener("click", closeOffer);
$("#offerDecline").addEventListener("click", askWhy);
$("#declineWhy").addEventListener("click", e => { const b = e.target.closest("[data-why]"); if (b) declineOffer(b.dataset.why); });
$("#autoOffBack").addEventListener("click", () => { $("#autoOffModal").classList.add("hidden"); if (duty.watch == null) toggleDuty(); });
$("#autoOffClose").addEventListener("click", () => $("#autoOffModal").classList.add("hidden"));
$("#autoOffChat").addEventListener("click", () => { $("#autoOffModal").classList.add("hidden"); openBossChat("Bonjour, j'ai refusé plusieurs courses parce que "); });

window.addEventListener("storage", e => { if (/livraison\.(orders|couriers|messages|shops)/.test(e.key || "") && me && me.status === "actif") load(); });
// Arrivée depuis le lien du mail de confirmation : session reprise, sinon on invite à se connecter
UI.forgotLink($("#loginForm"), $("#loginError"));
Store.adoptLinkSession().catch(() => false).then(async how => {
  if (how === "recovery") await UI.askNewPassword();
  await route();
  if (!Store.session() && /confirme=1/.test(location.search)) {
    showAuth("login");
    $("#loginError").textContent = "✅ Email confirmé ! Connectez-vous avec votre email et votre mot de passe.";
    $("#loginError").className = "notice";
  }
});

// L'application a démarré : plus de bandeau « recharger » pour les erreurs suivantes
UI.iosInstallHint("HOP! Livreur");
window.hopReady = true;

})();
