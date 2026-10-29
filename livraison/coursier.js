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
  "Course acceptée mais pas faite, ou déclarée livrée mais pas reçue par le client : après vérification par HOP, le prix de la course et la valeur de la commande sont retenus sur mon crédit HOP. Je peux répondre avec mes preuves (photo, position).",
  "Je respecte le code de la route et les règles de sécurité (casque, pas de téléphone en main en conduisant).",
  `Mes clients me paient directement. Je recharge à l'avance mon crédit HOP : la commission de HOP (${UI.commissionText()} ; ${UI.networkText()} sur les courses de mes commerces) en est déduite à chaque course livrée.`,
  "Je suis poli et ponctuel. Si je ne peux plus faire une course acceptée, je la remets en attente tout de suite.",
  "Mon compte peut être suspendu si un de ces engagements n'est pas respecté."
];

let me = null;
const TIP_FR = { promis: "promis, en attente du Bit du client", recu: "reçu par HOP, versé avec votre solde", verse: "versé ✓" };
let orders = [];
const refOn = () => !!CONFIG.partners.courierProgram;   // programme « Gagner plus » ouvert aux livreurs
let settings = { referral_bonus: CONFIG.partners.bonusPerDelivery, priority_minutes: CONFIG.partners.priorityMinutes };
// Passé hors ligne par HOP! : on le dit clairement
const hrs = m => m >= 120 ? `${Math.floor(m / 60)} h` : `${m} min`;
const autoOffText = () => `${Number(settings.miss_streak_max || 2)} courses ont sonné sans réponse, ou HOP! n'avait plus de nouvelles de vous depuis ${hrs(Number(settings.idle_off_min || 180))} (sans course en cours) : on vous a passé hors ligne pour ne pas faire attendre les clients. Repassez en ligne dès que vous êtes prêt à accepter des courses.`;
const DUTY_TEXT = "Vous recevez les courses, même écran éteint : gardez le téléphone sur vous, ça sonne. Touchez ici pour revenir dans HOP! (Waze reste ouvert).";
let refs = { shops: [], orders: [], board: [] };
let msgs = { messages: [], replies: [] };
let balance = 0;   // ce que le livreur doit à HOP (négatif : HOP lui doit)
let pens = [];     // retenues (courses pas faites ou pas reçues), déduites du crédit
let wallet = { credit: 0, reserved: 0, topups: [] };
let refunds = [];  // courses rendues après paiement : le client est à rembourser   // crédit prépayé : la commission de HOP en est déduite
const penDue = () => pens.filter(p => p.status === "du").reduce((x, p) => x + Number(p.amount || 0), 0);
let tab = "home";   // "home" = carte + panneau du bas ; sinon une page du menu
let firstLoad = true;
const seenPool = new Set();

// --- Inscription / connexion ------------------------------------------------------
function renderWelcome() {
  $("#perks").innerHTML = [
    "Vous choisissez vos courses, quand vous voulez.",
    "Vos clients vous paient directement : espèces, ou Bit / PayBox sur votre numéro.",
    `Vous êtes payé directement par le client. Commission HOP : ${UI.commissionText()} par course, retirée de votre crédit HOP (rechargé à l'avance) : rien à régler en fin de semaine.`,
    ...(refOn() ? [`Faites votre marketing : sur les courses des commerces que vous amenez, seulement ${UI.networkText()}, et ${UI.money(CONFIG.partners.bonusPerDelivery)} pour vous quand un autre livreur les fait.`] : []),
    ...(refOn() && CONFIG.pro.referrerPercent ? [`${CONFIG.pro.referrerPercent} % de l'abonnement HOP! Pro des commerces que vous faites signer, pendant ${CONFIG.pro.referrerMonths} mois.`] : []),
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

// Documents du livreur : une photo par document, réduite avant l'envoi ; ils arrivent sur sa fiche chez le patron
const DOC_KINDS = [["permis", "🪪 Permis de conduire"], ["carte_grise", "📗 Carte grise"], ["identite", "🆔 Carte d'identité"], ["osek", "🧾 Attestation d'עוסק"]];
const signupDocs = {};
function docsGrid(box, have, prefix) {
  box.innerHTML = DOC_KINDS.map(([k, label]) => `<label class="doc-pick${have[k] ? " ok" : ""}">
      <span>${have[k] ? "✅" : "📷"} ${UI.esc(label)}</span><small>${have[k] ? "Ajouté · changer" : "Prendre ou choisir"}</small>
      <input type="file" accept="image/*" data-doc="${k}" data-docs="${prefix}" hidden /></label>`).join("");
}
let waitDocsSent = {};
document.addEventListener("change", async e => {
  const inp = e.target.closest("input[data-doc]");
  if (!inp || !inp.files[0]) return;
  const f = inp.files[0]; inp.value = "";
  const data = await readTopcase(f);
  if (!data) return;
  if (inp.dataset.docs === "signup") { signupDocs[inp.dataset.doc] = data; return docsGrid($("#signupDocs"), signupDocs, "signup"); }
  try { await Store.sendCourierDoc(inp.dataset.doc, data); waitDocsSent[inp.dataset.doc] = true; docsGrid($("#waitDocsGrid"), waitDocsSent, "wait"); }
  catch (ex) { alert("Photo non envoyée, vérifiez la connexion."); }
});
docsGrid($("#signupDocs"), signupDocs, "signup");

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
    business_number: v("business_number") || null,
    has_bit: f.elements.has_bit.checked, has_paybox: f.elements.has_paybox.checked
  };
  try {
    const docs = Object.entries(signupDocs).map(([kind, image]) => ({ kind, image }));
    if (completing) { await Store.completeCourier(profile, signupTopcase, docs); return route(); }
    const r = await Store.signupCourier(v("email"), f.password.value, profile, signupTopcase, docs);
    if (r.needsConfirmation) {
      showAuth("login");
      $("#loginError").textContent = "Inscription enregistrée ! Connectez-vous ici avec votre email et votre mot de passe (si ça ne passe pas, touchez le lien reçu par mail).";
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
// Carte « Installez HOP! Livreur » : à l'accueil et en attente de validation, sauf déjà dans l'appli livreur
function showInstallCard(on) {
  const card = $("#installCard");
  card.classList.toggle("hidden", !on || UI.inOwnApp());
  if (UI.isStandalone && UI.isStandalone()) $("#installText").textContent = "Vous êtes dans l'appli client « HOP! ». Pour livrer, installez l'autre icône, « HOP! Livreur », et ouvrez-la à la place : tout y est.";
}
async function route() {
  ["#welcome", "#waiting", "#work"].forEach(s => $(s).classList.add("hidden"));
  showInstallCard(false);
  document.body.classList.remove("rider-on");
  $("#logoutBtn").classList.toggle("hidden", !Store.session());
  if (!Store.session()) { $("#welcome").classList.remove("hidden"); showInstallCard(true); return; }
  let meErr = false;
  try { me = await Store.me(); } catch (e) { me = null; meErr = true; }
  // Un vrai livreur ira directement dans son espace depuis l'appli HOP! ; le patron garde l'accueil client (voir index.html)
  if (me) try { localStorage.setItem("hop.role", me.role === "admin" ? "admin" : "coursier"); } catch (e) { /* ignore */ }
  if (!me && meErr) {
    $("#welcome").classList.remove("hidden");
    showAuth("login");
    $("#loginError").textContent = "Connexion au serveur impossible : vérifiez le réseau, puis rechargez la page.";
    $("#loginError").className = "notice err";
    return;
  }
  // Connecté mais sans fiche (inscription commencée sur un autre téléphone), ou fiche ouverte par HOP avec
  // seulement son nom et son téléphone : il la complète (permis, Bit, top case, conditions)
  const toFill = !me || (me.status === "en_attente" && !me.accepted_terms_at);
  setCompleting(toFill);
  if (toFill) {
    if (me) { const f = $("#signupForm"); ["name", "phone", "city", "vehicle"].forEach(k => { if (me[k] && f.elements[k] && !f.elements[k].value) f.elements[k].value = me[k]; }); }
    $("#welcome").classList.remove("hidden"); showInstallCard(true); showAuth("signup"); return;
  }
  if (me.status !== "actif") {
    const suspended = me.status === "suspendu";
    $("#waitIcon").textContent = suspended ? "⛔" : "⏳";
    $("#waitTitle").textContent = suspended ? "Compte suspendu" : `Merci ${me.name}, inscription reçue !`;
    $("#waitText").textContent = suspended
      ? "Écrivez-nous dans l'application pour en savoir plus."
      : (me.docs_n ? `✅ ${me.docs_n} document(s) reçu(s). Ajoutez ceux qui manquent (permis, carte grise, carte d'identité, attestation d'עוסק) : votre compte sera validé après vérification.`
        : "Ajoutez vos documents en photo ci-dessous (permis, carte grise, carte d'identité, attestation d'עוסק) : votre compte sera validé après vérification.");
    $("#waitWa").textContent = "💬 Écrire à HOP";
    $("#waitDocs").classList.toggle("hidden", suspended);
    if (!suspended) docsGrid($("#waitDocsGrid"), waitDocsSent, "wait");
    $("#waitTopcase").classList.toggle("hidden", suspended || !!me.topcase_at);
    $("#waitWa").onclick = () => openBossChat(suspended
      ? "Bonjour, mon compte est suspendu, pouvez-vous m'expliquer ?"
      : "Bonjour,", !suspended);
    $("#waiting").classList.remove("hidden");
    showInstallCard(true);
    return;
  }
  $("#work").classList.remove("hidden");
  document.body.classList.add("rider-on");
  UI.pushSubscribe();
  $("#drawerName").textContent = me.name;
  applyRiderSettings();
  initRiderMap();
  // Après un rechargement : on reste en ligne seulement si HOP! nous voit encore en ligne. Passé hors ligne par le serveur
  // (courses sans réponse, ou aucune nouvelle depuis 3 h) : on ne repasse jamais en ligne tout seul, même le lendemain.
  let wasOnline = false;
  try { wasOnline = localStorage.getItem("livraison.online.v1") === "1"; } catch (e) { /* ignore */ }
  if (wasOnline && me.online === false) {
    try { localStorage.setItem("livraison.online.v1", ""); } catch (e) { /* ignore */ }
    if (me.auto_offline_at) {
      $("#autoOffText").textContent = autoOffText();
      $("#autoOffModal").classList.remove("hidden");
    }
    wasOnline = false;
  }
  if (wasOnline && duty.watch == null) toggleDuty(true);
  // Hors service : la notification « 🟢 En service » restée d'avant (appli fermée, passé hors ligne par HOP!) s'en va
  else if (duty.watch == null) { Store.setOnline(false).catch(() => {}); UI.dutyNotice(false); }
  load();
  clearTimeout(pollTimer);
  livePoll();
}

// --- Courses ------------------------------------------------------------------------
const byTime = (a, b) => new Date(a.pickup_at) - new Date(b.pickup_at);
const sum = (list, f = o => Number(o.price)) => list.reduce((s, o) => s + f(o), 0);
const today = () => UI.dayKey(new Date().toISOString());
// Courses refusées par moi : elles ne reviennent pas (le patron voit toutes les commandes, il faut les cacher ici)
// … pendant decline_hold_min minutes (5) : si personne d'autre ne l'a prise, elle revient (« Personne d'autre ne l'a prise »)
const declinedAt = new Map(), backAgain = new Set();
const holdMs = () => (Number(settings && settings.decline_hold_min) || 5) * 60000;
const declinedRecently = id => declinedAt.has(id) && Date.now() - declinedAt.get(id) < holdMs();
const markDeclined = id => { declinedAt.set(id, Date.now()); backAgain.delete(id); };
const pool = () => orders.filter(o => o.status === "nouvelle" && !o.courier_id && !declinedRecently(o.id)).sort(byTime);
// (avec un abandon du client dont la moitié de la course reste à encaisser)
const mine = () => orders.filter(o => o.courier_id === me.id && (["confirmee", "recuperee"].includes(o.status)
  || (o.status === "annulee" && o.wait_status === "a_payer"))).sort(byTime);

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

// Paiement direct : le client paie le livreur (Bit ou PayBox sur son numéro), le commerce Pro lui paie sa part
const shopPart = o => Math.max(0, Number(o.shop_share || 0) - Number(o.hop_share || 0));
// Espèces : ce que le client paie au livreur, et ce que le livreur doit avoir sur lui (articles + monnaie)
const cashTotal = o => Number(o.price) + Number(o.cash_goods || 0);
function cashNeedLine(o) {
  if (o.payment_method !== "cash" || !(Number(o.cash_need) > 0)) return "";
  const goods = Number(o.cash_goods || 0), change = Number(o.cash_change || 0);
  return `<div class="cash-need">💵 Il vous faut <b>${UI.money(o.cash_need)}</b> en espèces sur vous : ${[goods ? `${UI.money(goods)} pour payer ${UI.esc(o.shop_name || "le commerce")}` : "", change ? `${UI.money(change)} de monnaie à rendre` : ""].filter(Boolean).join(" + ")}</div>`;
}
async function cashOk(o) {
  if (!o || o.payment_method !== "cash" || !(Number(o.cash_need) > 0)) return true;
  if (!confirm(`💵 Course en espèces : avez-vous bien ${UI.money(o.cash_need)} en espèces SUR VOUS, maintenant ?\n\nSi vous arrivez sans les espèces : la course repart à un autre livreur, ${UI.money(settings.cash_penalty || 10)} retenus sur votre crédit et ${settings.cash_ban_days || 7} jours sans courses en espèces.`)) return false;
  const r = await Store.courierCashOk(o.id).catch(e => (/cash_banned/.test(e.message) ? "ban" : false));
  if (r === "ban") { alert("🔒 Pas de course avec espèces pour l'instant : vous n'aviez pas les espèces la dernière fois."); return false; }
  return !!r;
}
// Livraison offerte par le commerce : c'est lui qui paie toute la course, par Bit, en remettant la commande
const giftShop = o => UI.esc(o.shop_name || "Le commerce");
function payLine(o) {
  if (o.shop_pays) return `🎁 <b>${giftShop(o)}</b> vous paie <b>${UI.money(o.price)}</b> par Bit <b>en vous remettant la commande</b> · le client ne paie rien`;
  // Course envoyée par le commerce (son client a déjà acheté) : le commerce paie en donnant le colis, ou le client à la livraison
  if (o.shop_sent) {
    const how = o.payment_method === "cash" ? "en espèces" : "par Bit";
    return o.payer === "moi"
      ? `🏪 <b>${UI.esc(o.shop_name || "Le commerce")}</b> vous paie <b>${UI.money(o.price)}</b> ${how} <b>quand vous prenez le colis</b>`
      : `🙋 Le client vous paie <b>${UI.money(o.price)}</b> ${how} <b>à la livraison</b>`;
  }
  if (o.payment_method === "cash") {
    const goods = Number(o.cash_goods || 0), note = Number(o.cash_note || 0);
    return `💵 <b>Espèces</b> : le ${o.payer === "destinataire" ? "destinataire" : "client"} vous paie <b>${UI.money(cashTotal(o))}</b> à la livraison`
      + (goods && o.goods_prepay ? (o.goods_spent != null ? ` (ticket ${UI.money(goods)} + course ${UI.money(o.price)})` : ` (articles au plus ${UI.money(goods)} que vous payez au magasin, puis le ticket exact + course ${UI.money(o.price)})`)
        : goods ? ` (articles ${UI.money(goods)} que vous payez au commerce + course ${UI.money(o.price)})` : "")
      + (note ? ` · il paie avec <b>${UI.money(note)}</b> : rendez-lui <b>${UI.money(note - cashTotal(o))}</b>` : " · il prépare l'appoint");
  }
  if (o.paid_to === "hop") return o.payment_status === "paye" ? "✅ Déjà payée à HOP : rien à encaisser, HOP vous reverse le montant"
    : "📱 Payée par Bit à HOP : rien à encaisser, HOP vous reverse le montant";
  if (!o.direct_pay) return `💵 Espèces : vous encaissez ${UI.money(o.price)} auprès du client`;
  return `💳 Le ${o.payer === "destinataire" ? "destinataire" : "client"} vous paie <b>${UI.money(UI.payTotal(o))}</b> par Bit ou PayBox sur votre numéro`
    + (o.goods_after ? ` : la course. Les articles : le ticket exact, envoyé à part après la photo (au plus ${UI.money(o.goods_budget)})`
      : o.goods_prepay ? ` (course ${UI.money(o.price)} + articles ${UI.money(o.goods_budget)} au plus)` : "")
    + (shopPart(o) ? ` · 🏪 le commerce vous paie <b>${UI.money(shopPart(o))}</b> par Bit en vous remettant la commande` : "");
}
// Argent de la course en une case de couleur, en haut de la fiche : vert « déjà payé, rien à encaisser »,
// orange « à encaisser » avec qui paie, combien, comment et quand (le doute « payé ou pas ? » n'existe plus)
function moneyBox(o) {
  const how = o.payment_method === "cash" ? "en espèces" : "par Bit";
  const total = o.payment_method === "cash" ? cashTotal(o) : UI.payTotal(o);
  const box = (ok, big, sub) => `<div class="money-box ${ok ? "ok" : "due"}"><b>${big}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const goodsPaid = o.shop_sent ? "🛍️ Les articles sont déjà payés au magasin : ne les encaissez pas" : "";
  if (o.payment_status === "paye") return box(true, `✅ Déjà payé · rien à encaisser`,
    [o.paid_to === "hop" ? "Payé à HOP!, qui vous reverse le montant" : `Vous avez reçu ${UI.money(total)} ${how}`, goodsPaid].filter(Boolean).join("<br>"));
  if (o.paid_to === "hop") return box(true, "✅ Rien à encaisser", "Le client paie HOP! directement, HOP! vous reverse le montant");
  if (o.shop_pays) return box(false, `💰 À encaisser au commerce : ${UI.money(o.price)} par Bit`,
    `${giftShop(o)} vous paie en vous donnant la commande.<br>🎁 Livraison offerte : le client ne paie rien`);
  if (o.shop_sent && o.payer === "moi") return box(false, `💰 À encaisser au commerce : ${UI.money(o.price)} ${how}`,
    `${UI.esc(o.shop_name || "Le commerce")} vous paie en vous donnant le colis.<br>🙋 Le client ne paie rien : tout est déjà payé au magasin`);
  if (o.shop_sent) return box(false, `💰 À encaisser chez le client : ${UI.money(o.price)} ${how}`, `${goodsPaid}. Seulement la livraison, à l'arrivée`);
  if (o.payment_method === "cash") return box(false, `💰 À encaisser chez le client : ${UI.money(total)} en espèces`, "À la livraison");
  return box(false, `💰 À recevoir par Bit : ${UI.money(total)}`, "Sur votre numéro, avant de récupérer la commande");
}
// Colis en route : prévenir le client d'un toucher (« j'arrive dans 5 min », « je suis en bas »)
let onWaySent = {};
try { onWaySent = JSON.parse(sessionStorage.getItem("hop.onway") || "{}") || {}; } catch (e) { /* ignore */ }
const onWayBtns = o => [["5", "🛵 J'arrive dans 5 min"], ["here", "📍 Je suis en bas"]].map(([k, l]) =>
  `<button type="button" class="btn btn-sm" data-onway="${k}" data-id="${UI.esc(o.id)}">${onWaySent[o.id + k] ? "✓ " : ""}${l}</button>`).join("");
// Fiches repliées ouvertes par le livreur : elles le restent quand l'écran se rafraîchit
const openFolds = new Set();
document.addEventListener("toggle", e => {
  const k = e.target && e.target.dataset && e.target.dataset.fold;
  if (k) { if (e.target.open) openFolds.add(k); else openFolds.delete(k); }
}, true);
// Mes dernières courses livrées : en petit, à ouvrir (au cas où : client, adresse, paiement, reçu)
function doneList() {
  const done = orders.filter(o => o.courier_id === me.id && o.status === "livree")
    .sort((a, b) => new Date(b.delivered_at || b.pickup_at) - new Date(a.delivered_at || a.pickup_at)).slice(0, 15);
  if (!done.length) return "";
  // Coordonnées du client (nom, téléphone, adresse exacte, message) : seulement sur la dernière course,
  // pendant 30 min après la livraison ; ensuite, la fiche ne garde que le n°, le prix et le paiement
  const fresh = o => o === done[0] && Date.now() - new Date(o.delivered_at || o.pickup_at).getTime() < DONE_OPEN_MIN * 60000;
  return `<h3 class="done-title">🕘 Mes dernières courses livrées</h3><div class="done-list">${done.map(o => `<details class="done-row" data-fold="d:${UI.esc(o.id)}"${openFolds.has("d:" + o.id) ? " open" : ""}>
    <summary><span>✅ N° ${UI.esc(o.ref)} · ${UI.esc(UI.fmtDateTime(o.delivered_at || o.pickup_at))}</span><b>${UI.money(o.price)}</b></summary>
    ${fresh(o) ? doneBody(o) : `<div class="done-body">
      <p>📍 ${UI.esc(UI.cityFr(o.from_city))} → 🏁 ${UI.esc(UI.cityFr(o.to_city))}</p>
      <p>${o.payment_method === "cash" ? "💵 Espèces" : "📱 Bit"} · ${o.payment_status === "paye" ? "✓ payé" : "⚠️ pas marqué payé"}</p>
      <p class="muted small">🔒 Les coordonnées du client ne restent visibles que 30 min après la livraison. Un souci ? Écrivez à HOP!.</p>
    </div>`}</details>`).join("")}</div>`;
}
const DONE_OPEN_MIN = 30;
function doneBody(o) {
  return `<div class="done-body">
      <p>📍 <bdi>${UI.esc(o.pickup_place || o.pickup_address || "")}</bdi>, ${UI.esc(UI.cityFr(o.from_city))}</p>
      <p>🏁 <bdi>${UI.esc(o.dropoff_address || "")}</bdi>, ${UI.esc(UI.cityFr(o.to_city))}${o.dropoff_floor ? ` · étage ${UI.esc(o.dropoff_floor)}` : ""}${o.dropoff_apt ? ` · appt ${UI.esc(o.dropoff_apt)}` : ""}</p>
      <p>👤 ${UI.esc(o.dropoff_contact || o.contact_name || "")}${(o.dropoff_phone || o.contact_phone) ? ` · <a href="tel:${UI.esc(o.dropoff_phone || o.contact_phone)}">${UI.esc(o.dropoff_phone || o.contact_phone)}</a>` : ""}</p>
      <p>${o.payment_method === "cash" ? "💵 Espèces" : "📱 Bit"} · ${o.payment_status === "paye" ? "✓ payé" : "⚠️ pas marqué payé"}${UI.receiptNo(o) ? ` · <a href="${UI.esc(UI.receiptUrl(o))}" target="_blank" rel="noopener">🧾 Reçu</a>` : ""}</p>
      <button type="button" class="btn btn-sm btn-wa" data-chat="${UI.esc(o.id)}">💬 Écrire au client</button>
      <p class="muted small">🔒 Visible encore ${Math.max(1, Math.ceil(DONE_OPEN_MIN - (Date.now() - new Date(o.delivered_at || o.pickup_at).getTime()) / 60000))} min, puis les coordonnées du client sont masquées.</p>
    </div>`;
}
// Payé comment ? Deux gros boutons : le livreur dit ce qu'il a vraiment reçu (Bit ou espèces), sans autre question
function paidHowBtns(o) {
  const a = UI.money(UI.payTotal(o));
  return `<div class="paid-how"><b>${o.shop_pays ? `${giftShop(o)} vous a payé ${a} ?` : `Le client vous a payé ${a} ?`}</b>
    <button class="btn btn-primary" data-paidhow="bit" data-id="${UI.esc(o.id)}">📱 Payé par Bit</button>
    <button class="btn btn-primary" data-paidhow="cash" data-id="${UI.esc(o.id)}">💵 Payé en espèces</button></div>`;
}
// HOP! Pro : où en est la préparation chez le commerce, ce que le client a commandé, la part du commerce
function proLine(o) {
  const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
  const state = o.shop_status === "prete" || (left != null && left <= 0) ? "✅ <b>Commande prête</b>"
    : left != null ? `🍳 <b>Prête dans ${left} min</b> chez ${UI.esc(o.shop_name || "le commerce")}` : "🍳 En attente du commerce";
  return `<div class="small pro-line">${state}${o.shop_order ? `<br>🧾 ${UI.esc(o.shop_order)}` : ""}
    ${shopPart(o) && !o.direct_pay ? `<br>🏪 Le commerce paie ${UI.money(shopPart(o))} de votre course : HOP vous le reverse` : ""}</div>`;
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

const paidSeen = new Set();
async function load() {
  try {
    let card;
    [orders, settings, card] = await Promise.all([Store.listOrders(), Store.getSettings(), Store.me().catch(() => null)]);
    // Fiche à jour (déblocage par HOP, suspension…)
    if (card) { me = card; serverWentOffline(card); }
    // Parrainage et messages : un souci ici ne doit pas bloquer les courses
    const [r, m, bal, dem, acc, fc] = await Promise.all([Store.myReferrals().catch(() => null), Store.listMessages().catch(() => null),
      Store.myBalance().catch(() => null), Store.zoneDemand().catch(() => null), Store.myAcceptance().catch(() => null), Store.demandForecast().catch(() => null)]);
    const th = await Store.todayHours().catch(() => null);
    if (th) todayReal = th.map(Number);
    pens = (await Store.myPenalties().catch(() => null)) || pens;
    // L'heure du refus vient de la base (c'est elle qui décide quand la course revient)
    ((await Store.listDeclines().catch(() => null)) || []).forEach(d => { if (d.courier_id === me.id) declinedAt.set(d.order_id, new Date(d.created_at).getTime()); });
    wallet = (await Store.myCredit().catch(() => null)) || wallet;
    refunds = (await Store.myRefunds().catch(() => null)) || refunds;
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
  if (offerShown && offerMate && !pool().some(o => o.id === offerMate)) { const id = offerShown; closeOffer(); offerQueue.unshift(id); }
  // Refusée il y a plus de 5 min et toujours libre : elle revient en fenêtre
  pool().forEach(o => { if (declinedAt.has(o.id) && !backAgain.has(o.id)) { backAgain.add(o.id); seenPool.delete(o.id); } });
  const fresh = pool().filter(o => !seenPool.has(o.id));
  // Toute course disponible encore jamais montrée s'ouvre en fenêtre (dès la 1re connexion aussi)
  // Hors ligne : ni fenêtre, ni son (la base ne montre d'ailleurs plus les courses)
  // Déjà une course récupérée : seulement une course vraiment sur le chemin (3 au plus en tout)
  if (!locked() && isOnline() && mine().length < MAX_ORDERS) fresh.forEach(o => { if (!busy() || Store.onWay(lastPos, mine(), o)) offerQueue.push(o.id); });
  showNextOffer();
  if (!firstLoad && fresh.length && isOnline()) {
    if (!offerShown) beep();
    // Appli en arrière-plan seulement (ouverte, la fenêtre de la course suffit) ; même étiquette que la notification
    // push de cette course : l'une remplace l'autre, jamais deux fois la même
    if (document.hidden && window.Notification && Notification.permission === "granted") {
      fresh.forEach(o => UI.notify(`🆕 Course dispo n° ${o.ref} — ${UI.money(Store.courseValue(o))}`, { body: `${UI.cityFr(o.from_city)} → ${UI.cityFr(o.to_city)} · ${UI.whenFr(o)}`, tag: "o-" + o.id, vibrate: [300, 150, 300], requireInteraction: true }));
    }
  }
  pool().forEach(o => seenPool.add(o.id));
  // Notifications qui ne servent plus (course prise par un autre, livrée, annulée, payée) : fermées sur le téléphone
  UI.clearNotifs((k, id) => {
    if (k === "m") return false;
    const o = orders.find(x => x.id === id);
    const over = !o || ["livree", "annulee", "refusee"].includes(o.status) || (!!o.courier_id && o.courier_id !== me.id);
    return k === "pay" ? over || o.payment_status === "paye" : over;
  });
  // Le client dit avoir payé (paiement direct) : on prévient le livreur, une fois par course
  mine().filter(o => o.direct_pay && o.paid_to !== "hop" && o.client_paid_at && o.payment_status !== "paye" && !paidSeen.has(o.id)).forEach(o => {
    paidSeen.add(o.id);
    if (firstLoad) return;
    // (le son et le pop-up : showAsk ; ici la notification, utile si HOP! est en arrière-plan)
    UI.notify(`💳 Le client dit avoir payé · n° ${o.ref}`, { body: "Vérifiez votre Bit / PayBox, puis touchez « 📱 Payé par Bit » (ou « 💵 Payé en espèces ») pour récupérer la commande.", tag: "pay-" + o.id, vibrate: [300, 150, 300] });
  });
  watchAnswers();
  watchGiven();
  showAsk();
  firstLoad = false;
  $("#lastSync").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  await checkChats();
  render();
  // Appli ouverte en touchant une notification : on va directement à la course ou à la conversation
  if (notifFirst) { notifFirst = false; openFromNotif(location.href); }
}
let notifFirst = true;

// --- Pop-up « réponse attendue » : rien à chercher dans la liste, ça s'ouvre au premier plan ----------------
// Le client dit avoir payé → « Paiement reçu » / « Pas reçu » ; le client a répondu (heure, attente) → on le dit
const askLater = new Set();
const askInfo = [];
const answerPrev = new Map();
const payPending = o => o.direct_pay && o.paid_to !== "hop" && o.payment_method !== "cash" && o.client_paid_at && o.payment_status !== "paye"
  && !(o.pay_missing_at && new Date(o.pay_missing_at) >= new Date(o.client_paid_at));
// Course donnée par HOP! (même quand il était hors ligne) : elle s'ouvre au premier plan, avec le son, dès qu'il
// ouvre l'appli — le patron peut l'appeler : « ouvre HOP!, il y a une course pour toi »
const LS_MINE = "livraison.mineSeen.v1";
const acceptedHere = new Set();
let mineSeen = null;
function watchGiven() {
  if (!mineSeen) { try { mineSeen = new Set(JSON.parse(localStorage.getItem(LS_MINE) || "[]")); } catch (e) { mineSeen = new Set(); } }
  let changed = false;
  mine().filter(o => o.status === "confirmee").forEach(o => {
    if (mineSeen.has(o.id)) return;
    mineSeen.add(o.id); changed = true;
    if (acceptedHere.has(o.id)) return;
    askInfo.push(`📦 <b>HOP! vous a donné une course</b><br>Course n° ${UI.esc(o.ref)} · pour vous : <b>${UI.money(Store.courierGain(o))}</b>
      <br>📍 ${UI.esc(o.pickup_place || o.pickup_address)}, ${UI.esc(UI.cityFr(o.from_city))}<br>🏁 ${UI.esc(o.dropoff_address)}, ${UI.esc(UI.cityFr(o.to_city))}
      ${isOnline() ? "" : "<br><b>Passez en ligne</b> pour que le client vous suive sur la carte."}`);
  });
  if (changed) try { localStorage.setItem(LS_MINE, JSON.stringify([...mineSeen].slice(-200))); } catch (e) { /* ignore */ }
}
function watchAnswers() {
  orders.filter(o => o.courier_id === me.id).forEach(o => {
    const prev = answerPrev.get(o.id), now = { eta: o.eta_status, wait: o.wait_ann_status, status: o.status };
    answerPrev.set(o.id, now);
    if (!prev || firstLoad) return;
    if (prev.eta === "attente" && now.eta === "ok" && o.status === "confirmee")
      askInfo.push(`✅ <b>Le client accepte votre heure</b><br>Course n° ${UI.esc(o.ref)} : allez au départ (${UI.esc(o.eta_min || "")} min).`);
    if (prev.wait === "attente" && now.wait === "ok")
      askInfo.push(`✅ <b>Le client accepte d'attendre</b><br>Course n° ${UI.esc(o.ref)} : l'attente annoncée sera payée.`);
    if (prev.wait === "attente" && now.wait === "refus")
      askInfo.push(`❌ <b>Le client a laissé tomber</b><br>Course n° ${UI.esc(o.ref)} : la moitié de la course vous est due.`);
  });
}
function showAsk() {
  const modal = $("#askModal"), box = $("#askBox");
  const o = mine().find(x => payPending(x) && !askLater.has(x.id + x.client_paid_at));
  let html = "", key = "";
  if (o) {
    key = "pay:" + o.id + o.client_paid_at;
    html = `<div class="offer-top"><span>💳</span><b>Le client dit avoir payé</b></div>
      <div class="ask-amount">${UI.money(UI.payTotal(o))}</div>${o.goods_prepay && !o.goods_after ? `<p class="small">dont ${UI.money(o.goods_budget)} pour les articles (au plus)</p>` : o.goods_after ? `<p class="small">La course. Le ticket viendra à part, après la photo.</p>` : ""}
      <p class="small">Course n° ${UI.esc(o.ref)} · ${UI.esc(o.contact_name || "")}<br>Vérifiez votre Bit / PayBox maintenant.</p>
      <button class="btn btn-primary" data-ask-paid="${UI.esc(o.id)}">✅ Paiement reçu</button>
      <button class="btn" data-ask-missing="${UI.esc(o.id)}">❌ Pas reçu</button>
      <button class="btn btn-link" data-ask-later="${UI.esc(o.id + o.client_paid_at)}">Vérifier plus tard</button>`;
  } else if (askInfo.length) {
    key = "info:" + askInfo[0];
    html = `<p class="msg-body">${askInfo[0]}</p><button class="btn btn-primary" data-ask-ok>OK</button>`;
  }
  if (!html) { modal.classList.add("hidden"); modal.dataset.key = ""; return; }
  if (modal.dataset.key === key && !modal.classList.contains("hidden")) return;
  const fresh = modal.dataset.key !== key;
  modal.dataset.key = key;
  box.innerHTML = html;
  modal.classList.remove("hidden");
  if (fresh) { beep(); try { if (navigator.vibrate) navigator.vibrate([400, 150, 400]); } catch (e) { /* ignore */ } }
}
$("#askBox").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.askOk != null) { askInfo.shift(); return showAsk(); }
  if (b.dataset.askLater) { askLater.add(b.dataset.askLater); return showAsk(); }
  b.disabled = true;
  if (b.dataset.askPaid) {
    const ok = await Store.courierAction(b.dataset.askPaid, "paye").catch(() => false);
    if (!ok) { b.disabled = false; return alert("Paiement non enregistré, réessayez."); }
  }
  if (b.dataset.askMissing) {
    const ok = await Store.payMissing(b.dataset.askMissing).then(() => true).catch(() => false);
    if (!ok) { b.disabled = false; return alert("Pas enregistré, réessayez."); }
  }
  $("#askModal").classList.add("hidden");
  load();
});

function weekOrders(start) {
  const end = UI.addDays(start, 6);
  return orders.filter(o => o.courier_id === me.id && o.status === "livree" && UI.dayKey(o.pickup_at) >= start && UI.dayKey(o.pickup_at) <= end);
}

function card(o, kind) {
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ EXPRESS : priorité, allez-y directement, sans autre course" : "Dès que possible";
  // Navigation avec l'application choisie dans les réglages
  const nav = which => kind === "mine" ? `<div class="links">
      <a class="btn btn-sm btn-primary" href="${navLink(o, which)}" target="_blank" rel="noopener">🧭 Y aller (${riderSet.nav === "maps" ? "Maps" : "Waze"})</a></div>` : "";
  const telLink = (name, phone) => kind === "mine" && phone ? `<span class="small muted">${UI.esc(name || "")} · <a href="tel:${UI.esc(phone)}">${UI.esc(phone)}</a></span>` : "";
  let extra = "";
  // Course groupée avec une autre des miennes : dans quel ordre livrer
  const twin = kind === "mine" && ["confirmee", "recuperee"].includes(o.status) && mine().find(x => x.id !== o.id && Store.pairOk(x, o));
  if (twin) {
    const d = x => Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +x.dropoff_lat, +x.dropoff_lon);
    extra += `<div class="bag-line">🔗 Groupée avec la course n° ${UI.esc(twin.ref)} : récupérez les deux, puis livrez ${d(o) <= d(twin) ? "<b>celle-ci d'abord</b> (la plus proche)" : `d'abord la n° ${UI.esc(twin.ref)} (la plus proche)`}.</div>`;
  }
  if (o.service === "retrait") extra += `<div class="small">${UI.esc(UI.PLACE_FR[o.place_kind] || "")} · N° ${UI.esc(o.tracking_number || "—")}${o.retrait_code ? (kind === "mine" ? ` · code du casier <b>${UI.esc(o.retrait_code)}</b>` : " · casier avec code") : ` · au nom de ${UI.esc(o.parcel_name || "—")}`}</div>`
    + (o.appt_at ? `<div class="bag-line">📅 Rendez-vous à la poste : <b>${UI.esc(UI.fmtDateTime(o.appt_at))}</b> : soyez au guichet à l'heure</div>` : "")
    + (o.docs_status === "ok" ? `<div class="small">✅ Documents vérifiés par HOP! (${o.place_kind === "poste" ? "avis, carte d'identité, procuration, rendez-vous" : o.place_kind === "locker" ? "SMS du casier" : "avis, carte d'identité"}) : à montrer au guichet</div>` : "");
  if (o.eta_status === "attente" && o.status === "confirmee" && new Date(o.eta_until) > Date.now()) {
    const s = Math.max(0, Math.round((new Date(o.eta_until) - Date.now()) / 1000));
    extra += `<div class="bag-line">⏳ Vous avez annoncé ${o.eta_min} min : le client a encore <b>${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}</b> pour refuser ce temps. Partez quand même au départ.</div>`;
  }
  else if (o.eta_at && o.status === "confirmee" && !o.arrived_at) extra += `<div class="small">🕐 Attendu au départ vers ${UI.esc(new Date(o.eta_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))} (${o.eta_min} min annoncées)</div>`;
  if (o.service === "achat" && o.rx) extra += `<div class="bag-line">💊 Médicament sur ordonnance : carte d'identité du patient et ordonnance vérifiées par HOP!, à montrer à la pharmacie</div>`;
  if (o.post_send) extra += `<div class="bag-line">📮 Dépôt à la poste : rendez-vous <b>${UI.esc(UI.fmtDateTime(o.appt_at))}</b>. Envoi déjà payé (étiquette en photo) : n'avancez rien</div>`;
  if (o.p2p_sale) extra += `<div class="small">🤝 Vente entre particuliers : l'acheteur a déjà payé le vendeur. N'encaissez que la course, jamais le prix de l'objet</div>`;
  if (o.handoff) extra += `<div class="bag-line">🔐 Clés / objet de valeur : demandez le <b>code de remise</b> au destinataire avant de donner${o.handoff_ok_at ? " · ✅ code vérifié" : ""}</div>`;
  if (o.service === "achat") extra += `<div class="small">🛒 ${UI.esc(o.shopping_list || "—")}${o.budget && !o.goods_prepay ? ` · budget ≈ ${UI.money(o.budget)}` : ""}${o.purchase_min ? `<br>⏱️ ${o.purchase_min} min d'achats comprises dans le prix ; au-delà, annoncez l'attente` : ""}<br>${o.goods_prepay && o.payment_method === "cash"
    ? `💵 <b>Espèces : vous payez le magasin, ${UI.money(o.goods_budget)} au plus</b> (vous avez annoncé avoir les espèces). 🧾 Photo du ticket, puis le client vous paie la course + le ticket exact à la livraison.`
    : o.goods_after ? `🧾 <b>Vous avancez les articles : ${UI.money(o.goods_budget)} au plus.</b> Le client paie d'abord la course (« 📱 Payé par Bit » ✅), puis vous achetez. Plus cher que ${UI.money(o.goods_budget)} ? Appelez-le avant de payer. 🧾 Photo du ticket : le client vous envoie le montant exact par Bit, touchez « Ticket reçu », puis livrez.`
    : o.goods_prepay ? `💳 <b>Articles payés d'avance : ${UI.money(o.goods_budget)} au plus</b>, avec la course. N'achetez qu'après « 📱 Payé par Bit » ✅ et payez le magasin avec cet argent. Plus cher ? Le client vous envoie d'abord le complément. Puis 🧾 photo du ticket et la différence rendue par Bit avant « Livré ».`
    : "🧾 Le client règle le magasin lui-même : n'avancez rien, appelez-le depuis l'appli à la caisse"}</div>`;
  // Attente au départ ou temps des achats : payé au livreur au-delà des minutes offertes
  extra += Number(o.wait_fee) > 0 ? `<div class="small">⏱️ Attente payée : <b>+${UI.money(o.wait_fee)}</b> (${o.wait_minutes} min sur place), comprise dans le prix</div>`
    : kind === "pool" || o.status === "confirmee" ? `<div class="small muted">⏱️ Attente ou achats sur place : ${UI.esc(UI.waitRule(settings))}, pour vous</div>` : "";
  // Valeur de la course : prix + réduction promo (payée par HOP) + part du commerce Pro pour le livreur
  const mineShop = !!o.referrer_id && o.referrer_id === me.id;
  const total = Store.courseValue(o);
  const net = total - (kind === "pool" ? Store.commissionFor(total, settings, mineShop) : Number(o.commission || 0));
  if (kind === "pool") extra = readyBanner(o) + cashNeedLine(o) + `<div class="small">${payLine(o)}</div>` + extra;
  if (kind === "mine" || kind === "pool") extra = moneyBox(o) + extra;
  if (o.shop_status) extra += proLine(o);
  if (o.phone_order) extra += phoneLine(o);
  if (o.adult_items) extra += `<div class="small adult-line">🔞 ${/tabac/.test(o.adult_items) ? "Tabac" : ""}${/tabac/.test(o.adult_items) && /alcool/.test(o.adult_items) ? " et " : ""}${/alcool/.test(o.adult_items) ? "alcool" : ""} : vérifiez la pièce d'identité du client (18 ans et plus) avant de donner.</div>`;
  if (o.shop_ref && kind !== "mine") extra += `<div class="bag-line">🛍️ Sac n° <b>${UI.esc(o.shop_ref)}</b> : demandez ce numéro${o.shop_name ? " chez " + UI.esc(o.shop_name) : ""}${Number(o.bags_count) ? ` · <b>${o.bags_count}</b> sac(s)` : ""}</div>`;
  if (o.rules_accepted_at) extra += `<div class="small muted">📋 Le client a accepté les conditions : max 40 × 40 × 35 cm, 15 kg, 500 ₪, rien de dangereux ni d'illégal. Colis non conforme ? Vous pouvez refuser : « ⚠️ Un souci ».</div>`;
  if (Number(o.discount) > 0) extra += `<div class="small">🎁 Code promo du client : ${UI.money(o.discount)}, payé par HOP (pas par vous)</div>`;
  if (kind === "mine" && o.payment_method === "cash") {
    extra += `<div class="small pay-direct">${payLine(o)}${o.payment_status === "paye" ? " · ✅ encaissé" : ""}</div>`;
  }
  const hopPaid = o.paid_to === "hop";
  if (kind === "mine" && o.direct_pay && !hopPaid && o.payment_method !== "cash") extra += `<div class="small pay-direct${o.client_paid_at && o.payment_status !== "paye" ? " pay-claimed" : ""}">${payLine(o)}${o.payment_status === "paye" ? " · ✅ reçu"
    : o.client_paid_at ? `<br><b>📲 Le client dit avoir payé : vérifiez votre Bit / PayBox, puis touchez « 📱 Payé par Bit ».</b>`
    : ` · à recevoir <b>avant de récupérer la commande</b>`}</div>`;
  // Course acceptée, Bit pas encore reçu : on demande tout de suite le paiement au client (SMS ou WhatsApp, prêts à envoyer)
  if (kind === "mine" && o.status === "confirmee" && o.direct_pay && !hopPaid && o.payment_method === "bit" && o.payment_status !== "paye" && !o.client_paid_at && !o.shop_sent && !o.shop_pays && o.contact_phone) {
    const amount = UI.money(UI.payTotal(o)), bit = o.courier_bit || me.bit_phone || me.phone || "";
    const msg = I18N.forLang(o.lang || "fr", "payAskMsg", { name: String(me.name || o.courier_name || "").split(" ")[0], ref: o.ref, total: amount, phone: bit, url: UI.trackUrl(o) });
    extra += `<div class="pay-ask"><b>⏳ Le client doit vous payer ${amount} par Bit avant que vous partiez récupérer</b>
      <small>HOP! lui a déjà envoyé votre numéro. Pour aller plus vite, envoyez-lui la demande :</small>
      <div class="pay-ask-btns"><a class="btn btn-sm btn-primary" href="${UI.esc(UI.smsLink(o.contact_phone, msg))}">📩 Demander par SMS</a>
      <a class="btn btn-sm btn-wa" href="${UI.esc(UI.waPersonal(o.contact_phone, msg))}" target="_blank" rel="noopener">💬 Par WhatsApp</a></div>
      <small>Dès que l'argent est sur votre Bit : touchez « 📱 Payé par Bit » (ou « 💵 Payé en espèces »).</small></div>`;
  }

  let actions = "";
  if (kind === "pool") {
    actions = locked() ? `<span class="pill st-annulee">💳 Rechargez votre crédit HOP pour accepter</span>`
      : mine().length >= MAX_ORDERS ? `<span class="pill st-annulee">🔒 ${MAX_ORDERS} courses au plus en même temps : livrez d'abord</span>`
      : busy() && !Store.onWay(lastPos, mine(), o) ? `<span class="pill st-annulee">🔒 Livrez d'abord votre course en cours</span>`
      : `<button class="btn btn-primary" data-accept="${UI.esc(o.id)}">✅ J'accepte cette course</button><button class="btn" data-decline="${UI.esc(o.id)}">✖ Refuser</button>`;
  } else {
    // Au départ : « Je suis arrivé » lance le compteur d'attente (payée au-delà des minutes offertes)
    const w = Store.waitFee(o, settings);
    if (o.status === "annulee") actions = `<p class="wait-live">💳 Le client vous doit <b>${UI.money(o.wait_due)}</b> (moitié de la course, vous vous êtes déplacé) par Bit / PayBox</p>
      <button class="btn btn-sm btn-primary" data-act="attente_recue">✅ Reçu</button><button class="btn btn-sm" data-act="attente_refusee">❌ Le client ne paie pas</button>`;
    else actions = goodsActs(o) + (o.status === "confirmee"
        ? (o.arrived_at
            ? `<p class="wait-live">⏱️ Sur place depuis ${w.mins} min${w.fee ? ` · attente payée : <b>+${UI.money(w.fee)}</b>` : w.unannounced ? "" : ` · ${Math.max(0, Store.freeMinOf(o, settings) - w.mins)} min ${o.purchase_min ? "d'achats comprises" : "encore offertes"}`}</p>${waitAnn(o)}`
            : `<button class="btn btn-sm btn-primary" data-act="arrivee">📍 Je suis arrivé au départ</button>`)
          + `<button class="btn btn-sm${o.arrived_at ? " btn-primary" : ""}" data-act="recuperee">🛵 Colis récupéré</button><button class="btn btn-sm" data-act="liberer">↩︎ Je ne peux plus</button>`
        : o.wait_status === "a_payer"
          ? `<p class="wait-live">⏱️ Supplément d'attente : <b>${UI.money(o.wait_due)}</b> à encaisser par Bit / PayBox avant de livrer (la course est déjà payée)</p>
             <button class="btn btn-sm btn-primary" data-act="attente_recue">✅ Supplément reçu</button><button class="btn btn-sm" data-act="attente_refusee">❌ Le client ne paie pas</button>`
          : idCheckBox(o) + (needPhoto(o) && !photoDone.has(o.id) ? photoBtn(o, true) : `<button class="btn btn-sm btn-primary" data-act="livree"${idNeeded(o) ? " disabled" : ""}>📦 Livré (sur place)</button>`) + onWayBtns(o))
      + (o.docs_status && ["confirmee", "recuperee"].includes(o.status) ? `<button type="button" class="btn btn-sm btn-primary" data-docs="${UI.esc(o.id)}">📄 Documents à montrer</button>` : "")
      + `<button type="button" class="btn btn-sm" data-issue="${UI.esc(o.id)}">⚠️ Un souci</button>`
      + (o.payment_method === "cash" && o.status === "confirmee" && Number(o.cash_need) > 0 && !o.cash_shop_at ? `<button class="btn btn-sm" data-act="pas_especes">😕 Je n'ai pas les espèces</button>` : "")
      + (o.payment_method === "cash" ? (o.status === "recuperee" && o.payment_status !== "paye"
          ? `<button class="btn btn-sm btn-primary" data-act="paye">💵 Espèces encaissées (${UI.money(cashTotal(o))})</button><button class="btn btn-sm" data-paidhow="bit" data-id="${UI.esc(o.id)}">📱 Payé par Bit</button><button class="btn btn-sm" data-act="cash_impaye">❌ Le client ne paie pas</button>`
          : o.payment_status === "paye" ? `<span class="pill paid">✓ encaissé</span>` : "")
        : hopPaid ? "" : o.payment_status !== "paye" ? (o.direct_pay ? paidHowBtns(o) : `<button class="btn btn-sm" data-act="paye">💵 Encaissé</button>`) : `<span class="pill paid">✓ ${o.direct_pay ? "payé" : "encaissé"}</span>`)
      + (o.direct_pay && !hopPaid && o.client_paid_at && o.payment_status !== "paye" ? `<button class="btn btn-sm" data-paymissing="${UI.esc(o.id)}">❌ Pas reçu</button>` : "")
      + `<button type="button" class="btn btn-sm btn-wa" data-chat="${UI.esc(o.id)}">💬 Client${chatUnread["o:" + o.id] ? ` <span class="chat-badge">${chatUnread["o:" + o.id]}</span>` : ""}</button>`
      + (o.status === "recuperee" && (!needPhoto(o) || photoDone.has(o.id)) ? photoBtn(o, false) : "")
      + (o.dropoff_phone ? `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${UI.waLink(o.dropoff_phone, I18N.forLang(o.lang || "fr", "trShareMsg", { url: UI.trackUrl(o) }))}">💬 Destinataire</a>` : "");
  }

  if (kind === "mine") return mineCard(o, { when, extra, actions, total, net, hopPaid, mineShop });
  return `<article class="order${kind === "pool" ? " is-new" : ""}" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${UI.esc(when)}</span>
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(total)}</span>
    </div>
    <div class="legs">
      <div class="leg"><span>📍</span><div>${UI.brand(o.pickup_place)}<b><bdi>${UI.esc(o.pickup_address)}</bdi>, ${UI.esc(UI.cityFr(o.from_city))}</b>${kind === "mine" ? UI.addrDetails(o, "pickup") + UI.addrNote(o.pickup_note) : ""}${extra}${telLink(o.pickup_contact, o.pickup_phone)}${nav("pickup")}</div></div>
      ${UI.stopsLegs(o, kind === "mine")}
      <div class="leg"><span>🏁</span><div>${UI.brand(o.dropoff_place)}<b><bdi>${UI.esc(o.dropoff_address)}</bdi>, ${UI.esc(UI.cityFr(o.to_city))}</b>${kind === "mine" ? UI.addrDetails(o, "dropoff") + UI.addrNote(o.dropoff_note) : ""}${UI.doorBig(o, true)}${telLink(o.dropoff_contact, o.dropoff_phone)}${nav("dropoff")}</div></div>
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
      ${needPhoto(o) && kind === "mine" ? `<span class="pill unpaid">${photoWhy(o)}</span>` : ""}
      ${o.goods_pay === "recu" ? `<span class="pill paid">✅ Articles déjà payés au commerce par le client : rien à avancer</span>` : ""}
      ${hopPaid ? `<span class="pill ${o.payment_status === "paye" ? "paid" : "unpaid"}">${o.payment_status === "paye" ? `✅ Déjà payée à HOP : rien à encaisser, HOP vous reverse ${UI.money(net)}` : (o.payment_method === "bit" ? "📱 Le client paie par Bit à HOP : n'encaissez rien" : "💳 Paiement d'avance à HOP en attente : n'encaissez rien")}</span>` : ""}
      ${kind === "mine" ? `<span class="pill">👤 ${UI.esc(o.contact_name)} · <a href="tel:${UI.esc(o.contact_phone)}">${UI.esc(o.contact_phone)}</a> · ${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>` : ""}
    </div>
    ${o.notes && kind === "mine" ? `<p class="notice" style="margin-top:10px">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="actions">${actions}</div>
  </article>`;
}

// --- Ma course, ultra simple : l'étape à faire, DÉPART puis ARRIVÉE en gros, numéros en gras, Waze ------
const WAZE_SVG = `<svg class="waze-ico" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#33CCFF"/><path d="M12 25c0-7 5.5-12 12.5-12S37 18 37 25c0 4-2 6.5-4.5 8l1 3-4-1.5c-1.5.5-3.3.8-5 .8-2 0-3.6-.4-5-1-1 1.6-3 2.4-5 1.6l1.6-2.6C13.3 31.6 12 28.6 12 25z" fill="#fff" stroke="#0B1222" stroke-width="2"/><circle cx="20.5" cy="23" r="1.8" fill="#0B1222"/><circle cx="28.5" cy="23" r="1.8" fill="#0B1222"/><path d="M20 28c2.6 2.4 6.4 2.4 9 0" fill="none" stroke="#0B1222" stroke-width="2" stroke-linecap="round"/></svg>`;
function navBtn(o, which) {
  return `<a class="btn-waze" href="${navLink(o, which)}" target="_blank" rel="noopener">${riderSet.nav === "maps" ? "🧭" : WAZE_SVG}<span>${which === "pickup" ? (o.pickup_near && o.pickup_lat == null ? "Chercher le plus proche" : "Aller au départ") : "Aller chez le client"} · ${riderSet.nav === "maps" ? "Maps" : "Waze"}</span></a>`;
}
function callBig(name, phone) {
  return phone ? `<a class="call-big" href="tel:${UI.esc(phone)}">📞 <b>${UI.esc(phone)}</b>${name ? `<span>${UI.esc(name)}</span>` : ""}</a>` : "";
}
// Commande prête ? Le temps qui reste, en direct (commerce Pro ou commande par téléphone)
function readyChip(o) {
  if (o.status !== "confirmee" || !(o.ready_at || o.shop_status)) return "";
  const left = o.ready_at ? Math.ceil((new Date(o.ready_at) - Date.now()) / 60000) : null;
  return o.shop_status === "prete" || (left != null && left <= 0) ? `<span class="ready-chip ok">✅ Prête</span>`
    : left != null ? `<span class="ready-chip">⏳ Prête dans <b>${left} min</b></span>` : `<span class="ready-chip">🍳 En préparation</span>`;
}
// Dès que ça sonne : prête ou pas, et dans combien de temps (commerce, commande par téléphone, rendez-vous, heure programmée)
function readiness(o) {
  const mins = d => Math.ceil((new Date(d) - Date.now()) / 60000);
  const hh = d => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dur = m => m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
  const READY = { ok: true, text: "✅ Commande <b>PRÊTE</b> : allez-y" };
  if (o.shop_status || o.phone_order) {
    if (o.shop_status === "prete") return READY;
    if (!o.ready_at) return { ok: false, text: `🍳 <b>Pas encore prête</b> : en préparation${o.shop_name ? " chez " + UI.esc(o.shop_name) : ""}` };
    const l = mins(o.ready_at);
    return l <= 0 ? READY : { ok: false, left: l, text: `⏳ <b>Pas encore prête</b> : prête dans <b>${dur(l)}</b> (à ${hh(o.ready_at)})` };
  }
  if (o.appt_at && mins(o.appt_at) > 0) return { ok: false, left: mins(o.appt_at), text: `📅 Rendez-vous à <b>${hh(o.appt_at)}</b> (dans ${dur(mins(o.appt_at))})` };
  if (o.urgency === "programmee" && o.pickup_at && mins(o.pickup_at) > 0)
    return { ok: false, left: mins(o.pickup_at), text: `📅 À récupérer à <b>${hh(o.pickup_at)}</b> (dans ${dur(mins(o.pickup_at))})` };
  return { ok: true, text: o.service === "achat" ? "✅ <b>Prêt</b> : les achats peuvent commencer tout de suite" : "✅ <b>Prêt</b> : à récupérer tout de suite" };
}
function readyBanner(o, etaToPickup) {
  const r = readiness(o);
  let tip = "";
  if (r.left != null && etaToPickup != null) tip = etaToPickup >= r.left ? "Vous arrivez pile quand c'est prêt"
    : `Vous êtes à ${etaToPickup} min : partez dans ${r.left - etaToPickup} min, pas avant`;
  return `<div class="ready-banner ${r.ok ? "ok" : "wait"}">${r.text}${tip ? `<small>${tip}</small>` : ""}</div>`;
}
// Espèces, dans le bloc du point en cours : payer le commerce au départ, encaisser le client à l'arrivée
function cashStop(o, which, now) {
  if (o.payment_method !== "cash" || !now) return "";
  // (achat sans partenaire : le livreur paie le magasin, au plus le maximum prévu, puis photo du ticket)
  if (which === "pickup" && o.goods_prepay) return o.goods_spent != null ? `<div class="cash-stop ok">🧾 Ticket <b>${UI.money(o.goods_spent)}</b> payé au magasin</div>`
    : `<div class="cash-stop">💵 Payez le magasin en espèces : <b>${UI.money(o.goods_budget)}</b> au plus<small>puis 🧾 photo du ticket ; le client vous rembourse à la livraison</small></div>`;
  if (which === "pickup" && Number(o.cash_goods) > 0) return o.cash_shop_at ? `<div class="cash-stop ok">✅ ${UI.esc(o.shop_name || "Le commerce")} a reçu vos <b>${UI.money(o.cash_goods)}</b></div>`
    : `<div class="cash-stop">💵 Payez <b>${UI.money(o.cash_goods)}</b> en espèces au commerce<small>il touche « Espèces reçues », puis vous récupérez la commande</small></div>`;
  if (which === "dropoff" && o.payment_status !== "paye") {
    const note = Number(o.cash_note || 0), tot = cashTotal(o);
    return `<div class="cash-stop">💵 Encaissez <b>${UI.money(tot)}</b> en espèces<small>${note ? `il paie avec ${UI.money(note)} : rendez <b>${UI.money(note - tot)}</b>` : "il a préparé l'appoint"}</small></div>`;
  }
  return "";
}
// Le n° à montrer au commerce (sac HOP! Pro ou commande par téléphone) et les sacs à prendre, en très gros
function showRef(o) {
  const n = o.shop_ref || o.phone_ref, bags = Number(o.bags_count) || 0;
  if (!n && !bags) return "";
  return `<button type="button" class="show-ref" data-showref="${UI.esc(o.id)}">
    <span>📢 À montrer ${o.shop_name ? "chez " + UI.esc(o.shop_name) : "au commerce"} · touchez pour agrandir</span>
    ${n ? `<b>N° ${UI.esc(n)}</b>` : ""}${o.phone_order && o.pickup_name ? `<em>au nom de ${UI.esc(o.pickup_name)}</em>` : ""}
    ${bags ? `<small>🛍️ ${bags} sac${bags > 1 ? "s" : ""} à prendre</small>` : ""}</button>`;
}
function refFull(o) {
  const n = o.shop_ref || o.phone_ref, bags = Number(o.bags_count) || 0;
  const el = document.createElement("div");
  el.className = "ref-full";
  el.innerHTML = `<span>${o.shop_name ? UI.esc(o.shop_name) : "Commande"}</span>${n ? `<b>${UI.esc(n)}</b>` : ""}
    ${o.phone_order && o.pickup_name ? `<em>${UI.esc(o.pickup_name)}</em>` : ""}${bags ? `<small>🛍️ ${bags} sac${bags > 1 ? "s" : ""}</small>` : ""}
    <p class="muted">Touchez pour fermer</p>`;
  el.addEventListener("click", () => el.remove());
  document.body.appendChild(el);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-showref]");
  if (!b) return;
  const o = mine().find(x => x.id === b.dataset.showref);
  if (o) refFull(o);
});
// Attente au départ : le livreur l'annonce tout de suite, le client accepte (ou laisse tomber)
function waitAnn(o) {
  const pro = !!o.shop_status;
  const chips = (list, plus) => `<div class="wait-chips">${list.map(m => `<button type="button" class="ch-chip" data-wait-ann="${UI.esc(o.id)}" data-min="${m}">${plus ? "+" : ""}${m} min</button>`).join("")}</div>`;
  if (!o.wait_ann_status) return `<div class="wait-ann"><b>${pro ? "⏳ Pas prête ? Prévenez le client du retard" : "⏳ On vous annonce une attente ? Dites-le tout de suite au client"}</b>${chips([5, 10, 15, 20, 30])}
    ${pro ? "" : `<small>Sans annonce, l'attente n'est pas payée.</small>`}</div>`;
  const left = Math.max(0, 180 - Math.floor((Date.now() - new Date(o.wait_ann_at)) / 1000));
  const fee = UI.money(Store.waitFeeFor(o.wait_ann_cap, settings, o));
  const st = o.wait_ann_status === "info" ? `ℹ️ Client prévenu : environ <b>${o.wait_ann_min} min</b> de retard (l'attente est payée par le commerce)`
    : o.wait_ann_status === "attente" && left > 0 ? `⏳ Annoncé au client : <b>${o.wait_ann_min} min</b> (+${fee} max) · sa réponse… <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</b>`
    : `✅ ${o.wait_ann_status === "ok" ? "Le client accepte" : "Accepté d'office (pas de réponse)"} : jusqu'à <b>${o.wait_ann_cap} min</b> sur place, <b>+${fee}</b> max`;
  return `<div class="wait-ann ${o.wait_ann_status === "attente" && left > 0 ? "pending" : "ok"}">${st}<small>Encore de l'attente ?</small>${chips([5, 10], true)}</div>`;
}
// Plusieurs courses à récupérer au même endroit (même commerce, à moins de 80 m) : « commande 1 sur 2 »,
// une à la fois ; une fois la première récupérée, on passe à la suivante
function pickupGroup(o) {
  const near = x => x.pickup_lat != null && o.pickup_lat != null
    && Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +x.pickup_lat, +x.pickup_lon) < 0.08;
  return mine().filter(x => x.id === o.id || (near(x) && ["confirmee", "recuperee"].includes(x.status)));
}
function pickupRank(o) {
  const g = pickupGroup(o);
  if (g.length < 2 || !g.some(x => x.status === "confirmee")) return null;
  const done = g.filter(x => x.status === "recuperee").length;
  return { k: Math.min(g.length, done + 1), n: g.length, group: g, current: g.find(x => x.status === "confirmee") };
}
// Achat payé d'avance : 🧾 ticket du magasin (photo + montant), puis la différence rendue (ou le complément reçu)
function goodsActs(o) {
  if (!o.goods_prepay || !["confirmee", "recuperee"].includes(o.status) || (o.payment_method !== "cash" && o.payment_status !== "paye")) return "";
  const id = UI.esc(o.id);
  if (o.goods_spent == null) return `<button type="button" class="btn btn-sm btn-primary" data-goods-ticket="${id}">🧾 Ticket du magasin (photo + montant)</button>`;
  if (o.goods_refund_status === "a_rendre") return `<p class="wait-live">💸 Rendez <b>${UI.money(o.goods_refund)}</b> au client par Bit (ticket ${UI.money(o.goods_spent)} sur ${UI.money(o.goods_budget)} reçus)</p>
    <button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(o.contact_phone || "").replace(/\D/g, ""))}">📋 Copier son numéro</button><button type="button" class="btn btn-sm btn-primary" data-goods-refund="rendu" data-id="${id}">✅ C'est rendu</button>`;
  if (o.goods_after && o.goods_refund_status === "a_completer") return `<p class="wait-live">🧾 Ticket <b>${UI.money(o.goods_spent)}</b> envoyé au client : il vous envoie ce montant par Bit. Livrez dès réception.</p>
    <button type="button" class="btn btn-sm btn-primary" data-goods-refund="complement" data-id="${id}">✅ Ticket reçu (${UI.money(o.goods_refund)})</button>`;
  if (o.goods_refund_status === "a_completer") return `<p class="wait-live">⚠️ Ticket ${UI.money(o.goods_spent)} : il manque <b>${UI.money(o.goods_refund)}</b>. Le client vous les envoie par Bit <b>avant</b> que vous payiez le magasin.</p>
    <button type="button" class="btn btn-sm btn-primary" data-goods-refund="complement" data-id="${id}">✅ Complément reçu</button>`;
  return `<span class="pill paid">🧾 Ticket ${UI.money(o.goods_spent)}${o.goods_after ? " payé par le client" : ""}${o.goods_refund_status === "rendu" ? ` · ${UI.money(o.goods_refund)} rendus` : ""} ✓</span>`;
}
function mineStep(o, hopPaid) {
  if (o.status === "annulee") return `❌ Le client a laissé tomber (attente) : la moitié de la course vous est due`;
  // Course envoyée par un commerce : le commerce paie en donnant le colis, ou le client à la livraison (Bit ou espèces)
  if (o.shop_pays && o.payment_status !== "paye") return o.status === "recuperee" ? "3️⃣ Livrez le client"
    : `1️⃣ Au départ : ${o.shop_name || "le commerce"} vous paie ${UI.money(o.price)} par Bit en vous donnant la commande`;
  if (o.shop_sent && o.payment_status !== "paye") {
    const how = o.payment_method === "cash" ? "en espèces" : "par Bit";
    if (o.payer === "moi") return o.status === "recuperee" ? "3️⃣ Livrez le client" : `1️⃣ Au départ : ${o.shop_name || "le commerce"} vous paie ${UI.money(o.price)} ${how} en vous donnant le colis`;
    return o.status === "recuperee" ? `3️⃣ Livrez : le client vous paie ${UI.money(o.price)} ${how}` : `2️⃣ Allez au départ · le client paie ${UI.money(o.price)} ${how} à la livraison`;
  }
  if (o.payment_method === "cash" && o.goods_prepay && o.goods_spent == null) return `2️⃣ Au magasin : payez les articles en espèces (au plus ${UI.money(o.goods_budget)}), puis 🧾 photo du ticket`;
  if (o.payment_method === "cash") return o.status === "recuperee" ? `3️⃣ Livrez et encaissez ${UI.money(cashTotal(o))} en espèces`
    : Number(o.cash_goods) > 0 && !o.cash_shop_at && !o.goods_prepay ? `2️⃣ Au départ : payez ${UI.money(o.cash_goods)} en espèces au commerce` : "2️⃣ Allez au départ · le client paie en espèces à la livraison";
  if (o.goods_prepay && o.payment_status === "paye" && ["confirmee", "recuperee"].includes(o.status)) {
    if (o.goods_spent == null) return o.goods_after ? `2️⃣ Au magasin : avancez les articles (au plus ${UI.money(o.goods_budget)}), puis 🧾 photo du ticket`
      : "2️⃣ Au magasin : achetez avec l'argent reçu, puis 🧾 photo du ticket";
    if (o.goods_after && o.goods_refund_status === "a_completer") return `3️⃣ Le client vous envoie le ticket (${UI.money(o.goods_refund)}) par Bit : « Ticket reçu », puis livrez`;
    if (o.goods_refund_status === "a_completer") return `2️⃣ Attendez le complément de ${UI.money(o.goods_refund)} avant de payer le magasin`;
    if (o.goods_refund_status === "a_rendre") return `${o.status === "recuperee" ? "3️⃣" : "2️⃣"} Rendez ${UI.money(o.goods_refund)} au client par Bit, puis livrez`;
  }
  if (o.status === "recuperee") return "3️⃣ Livrez le client";
  if (o.direct_pay && !hopPaid && o.payment_status !== "paye") return `1️⃣ Faites-vous payer ${o.goods_after ? "la course, " : ""}${UI.money(UI.payTotal(o))} (Bit / PayBox)${o.goods_prepay ? " avant d'acheter quoi que ce soit" : ", puis allez au départ"}`;
  const r = o.status === "confirmee" && pickupRank(o);
  if (r) return o.arrived_at ? `2️⃣ Récupérez la commande ${r.k} sur ${r.n}` : `2️⃣ Allez au départ · ${r.n} commandes à récupérer`;
  return o.arrived_at ? "2️⃣ Récupérez la commande" : "2️⃣ Allez au départ";
}
// Mêmes client et adresse pour plusieurs de mes courses (souvent deux enseignes) : chacune se valide à part
function sameClient(o) {
  const ph = v => String(v || "").replace(/\D/g, "").slice(-9);
  return mine().filter(x => x.id !== o.id && ["confirmee", "recuperee"].includes(x.status)
    && ((ph(x.contact_phone) && ph(x.contact_phone) === ph(o.contact_phone))
      || Store.kmBetween(+x.dropoff_lat, +x.dropoff_lon, +o.dropoff_lat, +o.dropoff_lon) < 0.06));
}
const twinName = x => `n° ${x.ref}${x.shop_name ? " · " + x.shop_name : x.pickup_place ? " · " + String(x.pickup_place).split(" · ")[0] : ""}`;
function mineCard(o, x) {
  const to = o.status === "recuperee";
  const stop = (which, label, now) => {
    const pre = which === "pickup" ? "pickup" : "dropoff", city = which === "pickup" ? o.from_city : o.to_city;
    const phone = which === "pickup" ? o.pickup_phone : (o.dropoff_phone || o.contact_phone);
    const name = which === "pickup" ? (o.pickup_contact || o.shop_name || "") : (o.dropoff_contact || o.contact_name);
    return `<section class="stop-block${now ? " now" : " done"}">
      <div class="stop-tag">${label}${which === "pickup" ? readyChip(o) : ""}</div>
      <div class="stop-addr">${UI.brand(o[pre + "_place"])}<bdi>${UI.esc(o[pre + "_address"])}</bdi>, ${UI.esc(UI.cityFr(city))}</div>
      ${which === "pickup" && o.pickup_near ? `<div class="small near-tip">📍 Le magasin le plus proche du client. Fermé ? Allez au suivant ouvert : pas de contrôle GPS au départ.</div>` : ""}
      ${which === "pickup" && !to ? showRef(o) : ""}${cashStop(o, which, now)}
      ${which === "dropoff" && sameClient(o).length ? `<div class="twin-line">👥 Même client : <b>${sameClient(o).length + 1} commandes</b> (celle-ci + ${sameClient(o).map(t => UI.esc(twinName(t))).join(", ")}).<br>Touchez « Livré » sur <b>chaque</b> commande, une par enseigne.</div>` : ""}
      ${UI.addrDetails(o, pre)}${UI.addrNote(o[pre + "_note"])}${which === "dropoff" ? UI.doorBig(o, true) : ""}
      ${callBig(name, phone)}
      ${now ? navBtn(o, which) : ""}
    </section>`;
  };
  return `<article class="order mine-card" data-id="${UI.esc(o.id)}">
    <div class="order-head">
      <span class="order-time">${UI.esc(x.when)}</span>
      <span class="order-ref">N° ${UI.esc(o.ref)}</span>
      <span class="order-price">${UI.money(x.total)}</span>
    </div>
    <div class="mine-step">${UI.esc(mineStep(o, x.hopPaid))}${tripKm(o) ? ` <span class="mine-km">🛣️ ${tripKm(o)}</span>` : ""}</div>
    ${UI.doorBig(o)}
    ${stop("pickup", "📍 DÉPART", !to)}
    ${UI.stopsLegs(o, true)}
    ${stop("dropoff", "🏁 ARRIVÉE", to)}
    ${o.dropoff_phone && o.dropoff_phone !== o.contact_phone ? `<div class="client-line">👤 Client : ${UI.esc(o.contact_name)} · <a href="tel:${UI.esc(o.contact_phone)}"><b>${UI.esc(o.contact_phone)}</b></a></div>` : ""}
    ${o.notes ? `<p class="mine-note">📝 ${UI.esc(o.notes)}</p>` : ""}
    <div class="mine-extra">${x.extra}
      ${needPhoto(o) ? `<div class="small">${photoWhy(o)}</div>` : ""}
      ${o.goods_pay === "recu" ? `<div class="small pay-direct">✅ Articles déjà payés au commerce : rien à avancer</div>` : ""}
      ${x.hopPaid ? `<div class="small pay-direct">${o.payment_status === "paye" ? "✅ Déjà payée à HOP : rien à encaisser" : "📱 Le client paie HOP : n'encaissez rien"}</div>` : ""}</div>
    <div class="actions">${x.actions}</div>
    <details class="more"><summary>Plus d'infos</summary><div class="meta">
      <span class="pill">${UI.esc(UI.SERVICE_FR[o.service] || o.service)}</span>
      <span class="pill">${UI.esc(UI.SIZE_FR[o.size] || o.size)}</span>
      <span class="pill">${UI.PAY_FR[o.payment_method] || ""}</span>
      <span class="pill paid">Vous gagnez ${UI.money(x.net)}</span>
      ${Number(o.tip) > 0 ? `<span class="pill paid">💝 Pourboire ${UI.money(o.tip)} · ${TIP_FR[o.tip_status] || ""}</span>` : ""}
      ${x.mineShop ? `<span class="pill star-pill">⭐ Votre commerce${o.shop_name ? " : " + UI.esc(o.shop_name) : ""}</span>` : o.shop_name ? `<span class="pill">🏪 ${UI.esc(o.shop_name)}</span>` : ""}
      <span class="pill">${o.lang === "he" ? "🇮🇱 parle hébreu" : "🇫🇷 parle français"}</span>
      ${o.issue ? `<span class="pill st-annulee">⚠️ Souci signalé : ${UI.esc(o.issue)}</span>` : ""}
      ${o.unlocked ? `<span class="pill paid">🔓 Débloquée par HOP</span>` : ""}
    </div></details>
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
// Solde qui change : la page s'ouvre sur le montant vu la dernière fois, puis il défile jusqu'au nouveau,
// avec « +12 ₪ » / « −4 ₪ » à côté. Le dernier montant vu est gardé sur ce téléphone, par livreur.
const SEEN_KEY = k => `livraison.seen.${me && me.id}.${k}`;
const seenGet = k => { try { const v = localStorage.getItem(SEEN_KEY(k)); return v == null ? null : Number(v); } catch (e) { return null; } };
const seenSet = (k, v) => { try { localStorage.setItem(SEEN_KEY(k), String(v)); } catch (e) { /* ignore */ } };
const moneyRunning = {};
function moneyAnim(key, value) {
  const prev = seenGet(key), from = moneyRunning[key] ? moneyRunning[key].shown : prev;
  const start = from == null || Math.abs(from - value) < 0.01 ? value : from;
  return `<b class="money-anim" data-money="${UI.esc(key)}" data-to="${value}" data-from="${start}">${UI.money(start)}</b>`;
}
function runMoneyAnims(root) {
  root.querySelectorAll("[data-money]").forEach(el => {
    const key = el.dataset.money, to = Number(el.dataset.to), from = Number(el.dataset.from);
    if (Math.abs(to - from) < 0.01) { seenSet(key, to); delete moneyRunning[key]; return; }
    const run = moneyRunning[key] || (moneyRunning[key] = { t0: performance.now() + 450, from, to, shown: from });
    run.to = to;
    const diff = to - run.from;
    el.insertAdjacentHTML("afterend", `<span class="money-delta ${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : "−"}${UI.money(Math.abs(diff))}</span>`);
    const step = now => {
      if (!el.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - run.t0) / 1100)), e = 1 - Math.pow(1 - p, 3);
      run.shown = p >= 1 ? run.to : Math.round((run.from + (run.to - run.from) * e) * 2) / 2;
      el.textContent = UI.money(run.shown);
      if (p < 1) requestAnimationFrame(step);
      else { seenSet(key, run.to); delete moneyRunning[key]; el.classList.add("money-done"); }
    };
    requestAnimationFrame(step);
  });
}
// Crédit HOP prépayé : le livreur recharge par Bit à HOP, puis le déclare ; le patron valide
const TOPUP_FR = { attente: "⏳ à valider par HOP", ok: "✅ validée", refuse: "❌ pas reçue" };
let topupPick = null;
function creditView() {
  const credit = Number(wallet.credit || 0), avail = available();
  const pending = (wallet.topups || []).filter(x => x.status === "attente");
  return `<div class="credit-card${avail < Number(settings.commission_min || 3) ? " low" : ""}">
      <div class="credit-top"><div><small>💳 Mon crédit HOP</small>${moneyAnim("credit", credit)}
        ${Number(wallet.reserved) > 0 ? `<span class="small">dont ${UI.money(wallet.reserved)} réservés pour vos courses en cours</span>` : ""}</div></div>
      <p class="small" style="margin:6px 0 0">Vos clients vous paient directement. La commission de HOP (${UI.esc(UI.commissionText())}) est déduite de ce crédit à chaque course livrée : rechargez-le à l'avance.</p>
      <div class="rate-tags" style="margin-top:10px">${[50, 100, 200].map(n => `<button type="button" class="ch-chip${topupPick === n ? " on" : ""}" data-topup-pick="${n}">${UI.money(n)}</button>`).join("")}</div>
      ${topupPick ? `<p class="small" style="margin:8px 0 0">1. Envoyez <b>${UI.money(topupPick)}</b> par Bit au <b dir="ltr">${UI.esc(CONFIG.bitPhone)}</b> (HOP).<br>2. Touchez « J'ai rechargé » : HOP vérifie et l'ajoute à votre crédit.</p>
        <div class="btns" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn btn-sm" data-bit-copy="${UI.esc(String(CONFIG.bitPhone).replace(/\D/g, ""))}">📋 Copier le numéro</button>
        <button type="button" class="btn btn-sm btn-primary" data-topup-send="${topupPick}">✅ J'ai rechargé ${UI.money(topupPick)}</button></div>` : ""}
      ${(wallet.topups || []).slice(0, 6).map(x => `<p class="small topup-line">${UI.money(x.amount)} · ${UI.esc(new Date(x.created_at).toLocaleDateString("fr-FR"))} · ${TOPUP_FR[x.status] || ""}${x.status === "ok" && x.paid === false ? " · offerte par HOP" : ""}${x.note ? " · " + UI.esc(x.note) : ""}${x.receipt_number ? ` · <a href="${UI.esc(UI.topupReceiptUrl(x))}" target="_blank" rel="noopener">🧾 Reçu HOP n° ${x.receipt_number}</a>` : ""}</p>`).join("")}
      <div class="btns" style="justify-content:flex-start;margin-top:10px">${[0, 1].map(i => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const m = d.toISOString().slice(0, 7);
        return `<a class="btn btn-sm" href="${UI.esc(UI.appUrl("recu.html") + "?m=" + m)}" target="_blank" rel="noopener">📄 Relevé de ${UI.esc(d.toLocaleDateString("fr-FR", { month: "long" }))}</a>`; }).join("")}</div>
      ${pending.length ? `<p class="muted small">HOP valide vos recharges dès réception.</p>` : ""}
    </div>`;
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
      ${moneyAnim("week:" + start, cur.total)}
      <span>${cur.list.length} course(s) · prochain règlement le ${UI.esc(new Date(payDay + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" }))}</span>
    </div>
    ${creditView()}
    <h3 class="fin-title">Opérations récentes</h3>
    <div class="fin-ops">${weekItem(cur).replace("<details", "<details open")}${past.map(weekItem).join("") || `<p class="muted small">Pas encore d'autre semaine.</p>`}</div>
    <details class="fin-more"><summary>Détail du solde</summary>
      ${line("Commission due (toutes semaines)", d.amountDue)}${line("Courses payées à HOP (reversées)", d.hopDue, "−")}
      ${line("Part des commerces Pro et codes promo", d.hopAdds, "−")}${line("💝 Pourboires reçus par HOP", d.tipsDue, "−")}
      ${line("🤝 Bonus réseau pas encore réglés", d.bDue, "−")}${line("⭐ Part des abonnements Pro", d.plansDue, "−")}${line("💸 Retenues (courses pas faites ou pas reçues)", penDue(), "+")}
      <div class="fin-row total"><span>${bal >= 0 ? "Déduit de votre crédit" : "Ajouté à votre crédit"}</span><b>${UI.money(Math.abs(bal))}</b></div>
      <p class="muted small">Tout passe par votre crédit HOP : la commission et les retenues en sont déduites ; les bonus, parts d'abonnement et codes promo payés par HOP y sont ajoutés.</p>
    </details>`;
}

function render() {
  const start = UI.weekStart(today());
  const week = weekOrders(start);
  const due = orders.filter(o => o.courier_id === me.id && o.status === "livree" && o.commission_status !== "regle");
  $("#stPool").textContent = pool().length;
  $("#stMine").textContent = mine().length;
  $("#stWeek").textContent = UI.money(sum(week.filter(o => o.paid_to !== "hop")));
  $("#stDue").textContent = UI.money(Number(wallet.credit || 0));
  $("#stDueLabel").textContent = "💳 Crédit HOP";
  renderLock();
  renderHome();
  updateRiderMap();
  $("#pageStats").classList.toggle("hidden", !["mine", "pool", "week"].includes(tab));
  if (tab === "home") return;
  const view = $("#view");
  const empty = msg => `<div class="empty card">${msg}</div>`;

  if (tab === "pool") {
    const list = pool();
    view.innerHTML = refundCards() + (list.length
      ? `<p class="muted small" style="margin-bottom:10px">Le nom et le téléphone du client s'affichent une fois la course acceptée. Le premier qui accepte la prend.</p>${bundleCards(list)}<div class="orders">${list.map(o => card(o, "pool")).join("")}</div>`
      : empty(isOnline() ? "Pas de course disponible pour l'instant. Activez les alertes 🔔 : vous serez prévenu dès qu'une course arrive."
        : "Vous êtes hors ligne : glissez le bouton « HOP! » pour passer en ligne et recevoir des courses."));
  } else if (tab === "mine") {
    const list = mine(), shown = new Set();
    const blocks = list.map(o => {
      if (shown.has(o.id)) return "";
      const r = pickupRank(o);
      if (!r) { shown.add(o.id); return card(o, "mine"); }
      // Au même départ : seulement la commande à récupérer maintenant, les autres en liste
      r.group.forEach(x => shown.add(x.id));
      const place = r.current.pickup_place || r.current.shop_name || r.current.pickup_address;
      return `<div class="pick-group">
        <div class="pick-head"><span>📦 ${r.n} commandes à récupérer${place ? ` chez <b>${UI.esc(place)}</b>` : ""}</span>
          <b class="pick-count">${r.k} sur ${r.n}</b></div>
        ${card(r.current, "mine")}
        <div class="pick-rest">${r.group.filter(x => x.id !== r.current.id).map(x => `<div class="pick-line ${x.status === "recuperee" ? "ok" : ""}">
          ${x.status === "recuperee" ? "✅" : "⏳"} N° <b>${UI.esc(x.ref)}</b> · ${UI.esc(x.contact_name || "")}${x.shop_ref ? ` · sac n° <b>${UI.esc(x.shop_ref)}</b>` : ""}
          <small>${x.status === "recuperee" ? "récupérée" : "ensuite"}</small></div>`).join("")}</div>
      </div>`;
    }).join("");
    view.innerHTML = (list.length ? `<div class="orders">${blocks}</div>` : empty("Aucune course en cours.")) + doneList();
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
    runMoneyAnims(view);
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
  } else if (tab === "ref" && refOn()) {
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

// À la caisse : photo du ticket (réduite sur le téléphone), puis son montant ; le client la reçoit dans ses messages
let ticketInput;
function goodsTicket(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  if (!ticketInput) {
    ticketInput = document.createElement("input");
    Object.assign(ticketInput, { type: "file", accept: "image/*" });
    ticketInput.setAttribute("capture", "environment");
    ticketInput.hidden = true;
    document.body.appendChild(ticketInput);
  }
  ticketInput.value = "";
  ticketInput.onchange = async () => {
    const f = ticketInput.files[0];
    if (!f) return;
    let photo;
    try { photo = await UI.docPhoto(f); } catch (e) { return alert("Photo illisible, reprenez-la."); }
    const a = prompt(`🧾 Montant total du ticket (₪) ?\n${o.payment_method === "cash" || o.goods_after ? "Maximum prévu" : "Payé d'avance"} : ${UI.money(o.goods_budget)}`);
    if (a == null) return;
    const amount = Math.round(parseFloat(String(a).replace(",", ".")) * 100) / 100;
    if (!(amount > 0)) return alert("Montant incorrect.");
    const r = await Store.courierGoodsTicket(o.id, amount, photo).catch(e => ({ err: e.message }));
    if (!r || r.err) return alert(/not_paid/.test((r && r.err) || "") ? "💳 Le client doit d'abord vous payer (« 📱 Payé par Bit »)." : "Ticket non enregistré, réessayez.");
    const d = Number(r.refund);
    alert(r.after ? `✅ Ticket envoyé au client : il vous envoie ${UI.money(amount)} par Bit. Touchez « Ticket reçu » dès que c'est arrivé, puis livrez.` : r.cash ? `✅ Ticket envoyé au client. À la livraison, encaissez ${UI.money(r.cash)} en espèces (course + ticket).` : d > 0 ? `✅ Ticket envoyé au client. Rendez-lui ${UI.money(d)} par Bit, puis « C'est rendu ».`
      : d < 0 ? `⚠️ Il manque ${UI.money(-d)} : le client est prévenu. Attendez son complément avant de payer le magasin.` : "✅ Ticket envoyé au client : compte juste.");
    load();
  };
  ticketInput.click();
}
async function onViewClick(e) {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.install) return UI.installApp("HOP! Livreur", "livreur/").then(ok => { if (ok) render(); });
  if (await onRefundClick(e)) return;
  if (el.dataset.goodsTicket) return goodsTicket(el.dataset.goodsTicket);
  if (el.dataset.goodsRefund) {
    const o = orders.find(x => x.id === el.dataset.id);
    if (!o || !confirm(el.dataset.goodsRefund === "rendu" ? `💸 Avez-vous bien rendu ${UI.money(o.goods_refund)} au client par Bit ?` : o.goods_after ? `✅ Avez-vous bien reçu ${UI.money(o.goods_refund)} du client (le ticket) sur votre Bit ?` : `✅ Avez-vous bien reçu le complément de ${UI.money(o.goods_refund)} ?`)) return;
    el.disabled = true;
    const ok = await Store.courierGoodsRefund(o.id, el.dataset.goodsRefund).catch(() => false);
    if (!ok) alert("Pas enregistré, réessayez.");
    return load();
  }
  if (el.dataset.onway) {
    // Message tout prêt, dans la langue du client : il le reçoit dans sa conversation et en notification
    const o = orders.find(x => x.id === el.dataset.id);
    if (!o) return;
    el.disabled = true;
    const key = el.dataset.onway === "here" ? "rdMsgHere" : "rdMsgOnWay";
    try {
      await Store.chatSend("o:" + o.id, "courier", me.name, I18N.forLang(o.lang || "fr", key, { name: String(me.name || "").split(" ")[0] }));
      onWaySent[o.id + el.dataset.onway] = 1;
      try { sessionStorage.setItem("hop.onway", JSON.stringify(onWaySent)); } catch (ex) { /* ignore */ }
    } catch (ex) { alert("Message non envoyé, réessayez."); }
    return render();
  }
  if (el.dataset.paidhow) {
    const o = orders.find(x => x.id === el.dataset.id);
    if (!o) return;
    el.disabled = true;
    const ok = await Store.courierPaidHow(o.id, el.dataset.paidhow).catch(() => false);
    if (!ok) { el.disabled = false; return alert("Paiement non enregistré, réessayez."); }
    Object.assign(o, { payment_status: "paye", payment_method: el.dataset.paidhow });
    render();
    return load();
  }
  if (el.dataset.paymissing) {
    if (!confirm("Rien reçu sur votre Bit / PayBox ? Le client sera prévenu de vérifier son paiement.")) return;
    el.disabled = true;
    await Store.payMissing(el.dataset.paymissing).catch(() => alert("Pas enregistré, réessayez."));
    return load();
  }
  if (el.dataset.topupPick) { topupPick = Number(el.dataset.topupPick); return render(); }
  if (el.dataset.topupSend) {
    el.disabled = true;
    try { await Store.declareTopup(Number(el.dataset.topupSend)); topupPick = null; alert("✅ Merci ! HOP vérifie votre Bit et ajoute la recharge à votre crédit."); }
    catch (err) { alert(/too_many/.test(err.message) ? "Vous avez déjà des recharges en attente : HOP les valide dès réception." : "Recharge non enregistrée, réessayez."); }
    return load();
  }
  if (el.dataset.decline) {
    el.disabled = true;
    markDeclined(el.dataset.decline);
    afterDecline(await Store.declineOrder(el.dataset.decline, "autre").catch(() => null));
    return load();
  }
  if (el.dataset.bundle) {
    const [a, b] = el.dataset.bundle.split(",");
    const po = pool().find(x => x.id === a);
    const eta = prompt("🛵 Dans combien de minutes êtes-vous au départ ? (les clients peuvent refuser si c'est trop long)", String(po ? etaGuess(po) : 15));
    if (eta === null) return;
    el.disabled = true;
    const ok = await acceptTwo(a, b, Math.max(1, Math.min(180, parseInt(eta, 10) || 15)));
    if (ok === "shown") { /* message déjà affiché */ }
    else if (!ok) alert("Trop tard, un autre livreur a pris ces courses.");
    else openPage("mine");
    return load();
  }
  if (el.dataset.accept) {
    const po = pool().find(x => x.id === el.dataset.accept);
    if (!(await cashOk(po))) return;
    const eta = prompt("🛵 Dans combien de minutes êtes-vous au départ ? (le client peut refuser si c'est trop long)", String(po ? etaGuess(po) : 15));
    if (eta === null) return;
    el.disabled = true;
    acceptedHere.add(el.dataset.accept);
    const ok = await Store.acceptOrder(el.dataset.accept, Math.max(1, Math.min(180, parseInt(eta, 10) || 15))).catch(e => acceptError(e));
    if (ok === "shown") { /* message déjà affiché */ }
    else if (!ok) alert("Trop tard, un autre livreur a pris cette course.");
    else {
      openPage("mine");
      if (duty.watch == null && confirm("Course acceptée ! Rester en ligne pour que le client vous suive sur la carte ?")) toggleDuty();
    }
    return load();
  }
  if (el.dataset.waitAnn) {
    const o = orders.find(x => x.id === el.dataset.waitAnn);
    if (!o || !confirm(o.shop_status ? `Prévenir le client : environ ${el.dataset.min} min de retard ?`
      : `Annoncer ${o.wait_ann_status ? "encore " : ""}${el.dataset.min} min d'attente au client ? Il accepte ou laisse tomber (3 min pour répondre, sinon c'est accepté).`)) return;
    el.disabled = true;
    const r = await Store.courierWaitAnnounce(o.id, Number(el.dataset.min)).catch(() => null);
    if (!r || !r.ok) alert("Annonce impossible, actualisez la page.");
    return load();
  }
  if (el.dataset.act) {
    const id = el.closest("article").dataset.id;
    const o = orders.find(x => x.id === id);
    const paidMe = o && o.direct_pay && o.paid_to !== "hop" && (o.payment_status === "paye" || o.client_paid_at);
    if (el.dataset.act === "liberer" && !confirm(paidMe
      ? `⚠️ Le client vous a déjà payé (ou dit l'avoir fait) ${UI.money(UI.payTotal(o))}. Si vous rendez la course, vous devez le rembourser tout de suite par Bit / PayBox, et vous ne recevrez plus de course avant. Rendre la course ?`
      : "Remettre cette course en attente pour un autre livreur ? Le client est prévenu tout de suite.")) return;
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
    if (el.dataset.act === "livree" && o.direct_pay && o.paid_to !== "hop" && o.payment_status !== "paye" && !o.unlocked && !freeNow()) {
      if (o.payment_method !== "cash") return alert(`Touchez d'abord comment le client vous a payé ${UI.money(UI.payTotal(o))} : « 📱 Payé par Bit » ou « 💵 Payé en espèces ».`);
      if (!confirm(`💵 Avez-vous bien encaissé ${UI.money(cashTotal(o))} en espèces ?`)) {
        return alert("Le client doit vous payer avant « Livré » : espèces, ou Bit sur votre numéro (« 📱 Payé par Bit »).");
      }
      const okPay = await Store.courierAction(id, "paye").catch(() => false);
      if (!okPay) return alert("Paiement non enregistré, réessayez.");
      o.payment_status = "paye";
    }
    if (el.dataset.act === "pas_especes" && !confirm(`😕 Vous n'avez pas les espèces ? La course repart tout de suite à un autre livreur, ${UI.money(settings.cash_penalty || 10)} sont retenus sur votre crédit et vous n'aurez plus de course en espèces pendant ${settings.cash_ban_days || 7} jours.`)) return;
    if (el.dataset.act === "cash_impaye" && !confirm(`❌ Le client ne vous paie pas ${UI.money(cashTotal(o))} en espèces ? Gardez la commande : HOP! est prévenu, le client est bloqué et HOP! décide.`)) return;
    if (el.dataset.act === "paye" && o.payment_method === "cash" && !confirm(`💵 Avez-vous bien encaissé ${UI.money(cashTotal(o))} en espèces ?`)) return;
    if (el.dataset.act === "attente_refusee" && !confirm(`Le client refuse de payer ${UI.money(o.wait_due)} ? HOP! est prévenu et s'en occupe.`)) return;
    if (el.dataset.act === "livree") {
      if (idNeeded(o)) { render(); return alert("🔞 Tabac / alcool : cochez d'abord « J'ai vérifié la pièce d'identité » (18 ans ou plus)."); }
      el.disabled = true;
      // Photo du colis obligatoire (devant la porte, ou demandée par le client) : pour tout le monde, même débloquée
      if (needPhoto(o) && !photoDone.has(o.id) && !(await hasDoorPhoto(o))) { render(); return alert(PHOTO_MSG); }
      el.textContent = "📍 Vérification de votre position…";
      if (!o.unlocked && !freeNow()) {
        const here = await checkAtDropoff(o);
        if (!here.ok) { render(); return alert(here.msg); }
        // Clés ou objet de valeur : le code de remise donné par le destinataire
        if (o.handoff && !o.handoff_ok_at) {
          const code = prompt("🔐 Code de remise : demandez au destinataire son code à 4 chiffres.");
          if (code == null) { render(); return; }
          const good = await Store.courierHandoff(o.id, code).catch(e => (/too_many/.test(e.message) ? "max" : false));
          if (good !== true) { render(); return alert(good === "max" ? "🔒 Trop d'essais : appelez HOP! (HOP! peut débloquer la course)." : "❌ Code incorrect : ne remettez pas, vérifiez avec le destinataire."); }
          o.handoff_ok_at = new Date().toISOString();
        }
      }
    }
    const ok = await Store.courierAction(id, el.dataset.act).catch(e => /payment_required/.test(e.message) ? "pay" : /too_far_recup/.test(e.message) ? "farrecup" : /too_far_pickup/.test(e.message) ? "farpick" : /too_far/.test(e.message) ? "far" : /photo_required/.test(e.message) ? "photo" : /handoff_required/.test(e.message) ? "handoff" : /wait_unpaid/.test(e.message) ? "wait" : /cash_shop/.test(e.message) ? "cash" : /ticket_required/.test(e.message) ? "ticket" : /goods_refund_pending/.test(e.message) ? "refund" : /goods_bought/.test(e.message) ? "bought" : false);
    if (ok === "ticket") { render(); return alert("🧾 Touchez d'abord « Ticket du magasin » : photo du ticket et son montant."); }
    if (ok === "refund") { render(); return alert(o.goods_refund_status === "a_completer" ? (o.goods_after ? "🧾 Le client doit d'abord vous envoyer le montant du ticket : touchez « Ticket reçu »." : "⚠️ Le client doit d'abord vous envoyer le complément : touchez « Complément reçu ».") : "💸 Rendez d'abord la différence au client par Bit, puis touchez « C'est rendu »."); }
    if (ok === "bought") { render(); return alert("🧾 Les articles sont déjà achetés : vous ne pouvez plus rendre la course. Écrivez à HOP! en cas de souci."); }
    if (ok === "cash") { render(); return alert(`💵 ${o.shop_name || "Le commerce"} doit d'abord toucher « Espèces reçues » (vous lui payez ${UI.money(o.cash_goods)} en espèces).`); }
    if (ok === "wait") { render(); return alert("⏱️ Touchez d'abord « Supplément reçu » (ou « Le client ne paie pas ») pour l'attente."); }
    if (ok === "pay") { render(); return alert(el.dataset.act === "recuperee" && o && (o.shop_sent || o.shop_pays)
      ? `🏪 ${o.shop_name || "Le commerce"} doit vous payer ${UI.money(o.price)} par Bit avant que vous preniez le colis. Vérifiez votre Bit, puis touchez « 📱 Payé par Bit » (ou « 💵 Payé en espèces »).`
      : el.dataset.act === "recuperee"
      ? "💳 Le client doit vous payer avant que vous récupériez la commande. Attendez son paiement (Bit / PayBox), vérifiez-le, puis touchez « 📱 Payé par Bit » (ou « 💵 Payé en espèces »)."
      : "💳 Touchez d'abord « 📱 Payé par Bit » ou « 💵 Payé en espèces » une fois que le client vous a payé."); }
    if (ok === "handoff") { render(); return alert("🔐 Code de remise manquant : demandez-le au destinataire avant de remettre."); }
    if (ok === "farpick") { render(); return alert("📍 Vous n'êtes pas encore au point de récupération : appuyez sur « Je suis arrivé » une fois sur place (le compteur d'attente démarre à ce moment-là)."); }
    if (ok === "farrecup") { render(); return alert(`📍 Vous n'êtes pas au point de récupération : « Colis récupéré » se valide sur place (moins de ${Math.round(deliverRadius() * 1.5)} m), GPS activé.`); }
    if (ok === "photo") { photoDone.delete(id); render(); return alert(PHOTO_MSG); }
    if (ok === "far") { render(); return alert(`📍 Vous n'êtes pas à l'adresse de livraison. Vous pourrez valider « Livré » une fois sur place (moins de ${deliverRadius()} m).`); }
    if (!ok) alert("Action impossible, actualisez la page.");
    else if (el.dataset.act === "livree" && o && o.paid_to !== "hop" && o.payment_status !== "paye" && confirm(`Livré ! Avez-vous encaissé ${UI.money(UI.payTotal(o))} ?`)) {
      await Store.courierAction(id, "paye").catch(() => alert("Encaissement non enregistré, réessayez."));
    }
    // Même client, autre enseigne : on rappelle de valider aussi l'autre commande
    if (ok && el.dataset.act === "livree" && o) {
      const left = sameClient(o).filter(t => t.status === "recuperee");
      if (left.length) alert(`✅ Commande n° ${o.ref} livrée.\n👥 Ce client a aussi : ${left.map(twinName).join(", ")}.\nTouchez « Livré » sur ${left.length > 1 ? "chacune" : "celle-ci"} aussi.`);
    }
    await load();
  }
}

// --- Messagerie : avec HOP, et avec le client de chaque course -------------------------------
let chatUnread = {};
let chatTotal = 0;
function openBossChat(prefill, photo) {
  Chat.open({ thread: "c:" + me.id, title: "💬 HOP!", sub: "Vos messages avec l'équipe HOP!", me: "courier", lang: "fr", prefill, photo,
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
  // Message lu (ou conversation d'une course finie) : sa notification se ferme
  UI.clearNotifs((k, id) => k === "m" && !chatUnread[id]);
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
let forecast = null;
let todayReal = null;     // vraies commandes de chaque heure d'aujourd'hui     // commandes moyennes par heure (aujourd'hui, d'après les 4 dernières semaines)
function demandLevel(d) {
  if (!d) return null;
  const score = (Number(d.waiting) + Number(d.last_hour) / 2) / Math.max(1, Number(d.on_duty));
  return score >= 2.5 ? { label: "Forte", n: 3, cls: "hi" } : score >= 1 ? { label: "Moyenne", n: 2, cls: "mid" } : { label: "Faible", n: 1, cls: "lo" };
}
const bars = lv => `<span class="dbars ${lv.cls}">${[1, 2, 3].map(i => `<i class="${i <= lv.n ? "on" : ""}"></i>`).join("")}</span>`;
function renderZones(view) {
  view.innerHTML = `<div class="card">
      <h3>Zone de livraison</h3>
      <p class="muted small" style="margin:4px 0 12px">HOP! livre dans toutes les zones ci-dessous${CONFIG.cities.some(c => c.closed) ? ` (sauf ${UI.esc(CONFIG.cities.filter(c => c.closed).map(c => c.fr).join(", "))} pour l'instant)` : ""}.</p>
      ${CONFIG.zones.map(z => `<div class="zone-row${z.active ? "" : " off"}">
          <span class="zone-radio${z.active ? " on" : ""}"></span><b>${UI.esc(z.fr)}</b>
          <span class="zone-dem">${z.active ? `<span class="zone-open">Ouverte</span>` : "À venir"}</span>
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
const PHOTO_MSG = "📷 Photo du colis obligatoire : touchez « 📷 Photo du colis, puis Livré », prenez la photo, elle part au client et la course est validée.";
// Photo à la livraison : obligatoire devant la porte, ou quand le client l'a demandée (« 📷 Je veux une photo »)
const needPhoto = o => !!(o.leave_at_door || o.photo_wanted);
const photoWhy = o => o.leave_at_door ? "📷 Devant la porte : photo obligatoire avant « Livré »" : "📷 Le client a demandé une photo : obligatoire avant « Livré »";
const photoDone = new Set();
// Tabac / alcool : le livreur coche « j'ai vérifié la pièce d'identité » avant de pouvoir livrer
const idChecked = new Set();
const idNeeded = o => !!o.adult_items && !o.id_checked_at && !idChecked.has(o.id);
const idCheckBox = o => (o.adult_items ? `<label class="check id-check${idNeeded(o) ? "" : " ok"}"><input type="checkbox" data-idcheck="${UI.esc(o.id)}"${idNeeded(o) ? "" : " checked disabled"} /> <span>🪪 J'ai vérifié la pièce d'identité : <b>18 ans ou plus</b> (${/tabac/.test(o.adult_items) ? "tabac" : ""}${/tabac/.test(o.adult_items) && /alcool/.test(o.adult_items) ? " + " : ""}${/alcool/.test(o.adult_items) ? "alcool" : ""})</span></label>` : "");
// Bouton qui ouvre directement l'appareil photo ; la photo part dans la conversation du client, puis (then) « Livré »
const photoBtn = (o, then) => `<label class="btn btn-sm${then ? " btn-primary" : " btn-wa"}">${then ? "📷 Photo du colis, puis Livré" : "📷 Photo au client"}<input type="file" accept="image/*" capture="environment" data-dphoto="${UI.esc(o.id)}"${then ? ' data-then="livree"' : ""} hidden /></label>`;
document.addEventListener("change", async e => {
  const inp = e.target.closest("input[data-dphoto]");
  if (!inp || !inp.files[0]) return;
  const f = inp.files[0], id = inp.dataset.dphoto, then = inp.dataset.then;
  inp.value = "";
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const lbl = inp.closest("label");
  if (lbl) lbl.firstChild.textContent = "📷 Envoi de la photo…";
  try {
    const data = await UI.docPhoto(f);
    await Store.chatSend("o:" + o.id, "courier", me.name, I18N.forLang(o.lang || "fr", "rdMsgPhoto", { name: String(me.name || "").split(" ")[0] }), data);
    photoDone.add(o.id);
  } catch (ex) { render(); return alert("Photo non envoyée, vérifiez la connexion et réessayez."); }
  render();
  // Photo envoyée : on valide « Livré » tout de suite (position, code de remise… comme d'habitude)
  if (then === "livree") { const b = document.querySelector(`article[data-id="${CSS.escape(id)}"] [data-act="livree"]`); if (b) b.click(); }
});
// Livreur débloqué par HOP jusqu'à une date
const freeNow = () => !!(me && me.unlocked_until && new Date(me.unlocked_until) > new Date());
// Crédit prépayé : il doit couvrir au moins la commission minimum de HOP (le patron aussi, quand il fait une course)
const available = () => Number(wallet.credit || 0) - Number(wallet.reserved || 0);
const locked = () => !freeNow() && me && Store.ONLINE && available() < Number(settings.commission_min || 3);
// Une course récupérée doit être livrée et validée avant d'en prendre une autre
const busyOrder = () => orders.find(o => o.courier_id === me.id && o.status === "recuperee");
const busy = () => !freeNow() && !!busyOrder();
const MAX_ORDERS = (CONFIG.grouping || {}).maxOrders || 3;
const blocked = () => locked() || busy();
// Courses groupables dans la liste : « Prendre les 2 » (arrivées proches, même coin de départ)
function bundleCards(list) {
  const used = new Set(), out = [];
  list.forEach(a => {
    if (used.has(a.id)) return;
    const b = list.find(x => !used.has(x.id) && x.id !== a.id && Store.pairOk(a, x));
    if (!b) return;
    used.add(a.id); used.add(b.id);
    const gap = Math.round(Store.kmBetween(+a.dropoff_lat, +a.dropoff_lon, +b.dropoff_lat, +b.dropoff_lon) * 1000 / 50) * 50;
    const same = Store.kmBetween(+a.pickup_lat, +a.pickup_lon, +b.pickup_lat, +b.pickup_lon) < 0.08;
    out.push(`<div class="bundle-card"><div>🔗 <b>N° ${UI.esc(a.ref)} + n° ${UI.esc(b.ref)}</b> : ${same ? "même départ" : "2 commerces voisins"}, arrivées à ${gap} m l'une de l'autre · ${UI.money(Store.courseValue(a) + Store.courseValue(b))} les deux</div>
      <button type="button" class="btn btn-primary btn-sm" data-bundle="${UI.esc(a.id)},${UI.esc(b.id)}">✅ Prendre les 2</button></div>`);
  });
  return out.join("");
}
function acceptError(e) {
  if (/refund_pending/.test(e.message)) { alert("💸 Remboursez d'abord le client de la course que vous avez rendue, puis touchez « J'ai remboursé ». Ensuite vous pourrez reprendre des courses."); return "shown"; }
  if (/express_busy/.test(e.message)) { alert("⚡ Course express : elle est réservée à un livreur sans autre course, qui y va directement. Terminez d'abord votre course en cours."); return "shown"; }
  if (/express_running/.test(e.message)) { alert("⚡ Vous avez une course express en cours : livrez-la d'abord, sans autre course."); return "shown"; }
  if (/max3/.test(e.message)) { alert(`🔒 ${MAX_ORDERS} courses au plus en même temps : livrez d'abord une de vos courses.`); return "shown"; }
  if (/busy/.test(e.message)) { const b = busyOrder(); alert(`🔒 Livrez d'abord votre course en cours${b ? " n° " + b.ref : ""} : validez « Livré » sur place${b && b.leave_at_door ? ", avec la photo devant la porte" : ""}. Un souci ? Écrivez à HOP.`); return "shown"; }
  if (/debt/.test(e.message)) { alert(`🔒 Vous devez ${UI.money(balance)} à HOP : réglez votre solde pour recevoir des courses.`); return "shown"; }
  if (/cash_confirm/.test(e.message)) { alert("💵 Confirmez d'abord que vous avez les espèces sur vous."); return "shown"; }
  if (/cash_banned/.test(e.message)) { alert("🔒 Pas de course avec espèces pour l'instant : vous n'aviez pas les espèces la dernière fois."); return "shown"; }
  if (/credit_low/.test(e.message)) { alert(`💳 Crédit HOP insuffisant (${UI.money(available())}) pour la commission de cette course : rechargez-le dans « Finances ».`); openPage("week"); return "shown"; }
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
  box.innerHTML = `<div><b>💳 Crédit HOP : ${UI.money(available())}</b><br><span class="small">Rechargez votre crédit (Bit au ${UI.esc(CONFIG.bitPhone)}) pour recevoir des courses : la commission de HOP en est déduite à chaque course.</span></div>
    <button type="button" class="btn btn-primary" data-go-credit>💳 Recharger</button>`;
  box.querySelector("[data-go-credit]").onclick = () => openPage("week");
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
        <li><b>Ses courses vous sont proposées ${Number(settings.priority_minutes)} min avant</b> les autres livreurs${me.network_perks ? `, et quand vous les faites, la commission n'est que de <b>${UI.esc(UI.networkText())}</b>` : ""}.</li>
        ${me.network_perks ? `<li><b>${UI.money(bonus)} pour vous</b> sur chacune de ses courses quand un autre livreur la fait, <b>tant que vous livrez avec nous</b>.</li>
        ${CONFIG.pro.referrerPercent ? `<li><b>${CONFIG.pro.referrerPercent} % de son abonnement HOP! Pro</b> (${UI.money(CONFIG.pro.monthly * CONFIG.pro.referrerPercent / 100)} par mois) pendant ses ${CONFIG.pro.referrerMonths} premiers mois.</li>` : ""}`
          : `<li>⭐ <b>Avantages réseau</b>, accordés par HOP aux livreurs les mieux notés : commission de ${UI.esc(UI.networkText())} seulement sur ses courses, ${UI.money(bonus)} quand un autre livreur la fait${CONFIG.pro.referrerPercent ? `, et ${CONFIG.pro.referrerPercent} % de son abonnement HOP! Pro` : ""}.</li>`}
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
// Le ton HOP! : « Salut les Hopers ! » pour tous, « Salut Dan ! » pour un message perso
const msgHello = m => m.to_courier ? `👋 Salut ${String((me && me.name) || "").split(" ")[0] || "à toi"} !` : "👋 Salut les Hopers !";
// Les messages s'affichent en pop-up seulement (et dans la cloche 🔔), pas dans le panneau
function renderMsgs() { $("#msgs").innerHTML = ""; }

function checkNewMessages() {
  const seen = seenMsgs();
  const fresh = msgs.messages.filter(m => !seen.has(m.id) && Date.now() - new Date(m.created_at) < 3 * 3600000);
  msgs.messages.forEach(m => seen.add(m.id));
  try { localStorage.setItem(LS_MSG_SEEN, JSON.stringify([...seen].slice(-200))); } catch (e) { /* ignore */ }
  renderMsgs();
  if (!fresh.length) return;
  const m = fresh[0];
  beep();
  UI.notify(msgHello(m), { body: m.body, tag: "hop-msg" });
  msgShown = m.id;
  $("#msgBody").textContent = m.body;
  $("#msgTime").textContent = msgHello(m) + " · " + msgTime(m);
  $("#msgModalBtns").innerHTML = "";   // un message à lire, pas de réponse à donner
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
    // Bloquées : le navigateur ne redemande plus, on explique où les réactiver
    if (Notification.permission === "denied") return alert("Alertes bloquées sur ce téléphone.\n\nChrome : ⋮ → Paramètres → Paramètres des sites → Notifications → autorisez " + location.host + ".\nSans alertes : pas de « En service » ni de nouvelles courses appli fermée.");
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
// Longueur de la course (départ → arrivée, par la route) : « ≈ 2,3 km », ou rien si on ne sait pas
function tripKm(o) {
  const km = roadKm(pt(o.pickup_lat, o.pickup_lon), pt(o.dropoff_lat, o.dropoff_lon)) ?? (o.distance_km != null ? Number(o.distance_km) * 1.3 : null);
  return km != null && km >= 0.1 ? `≈ ${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km` : "";
}
function pt(lat, lon) { return lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null; }

// Petite carte du trajet dans la proposition : vous → départ(s) 🏪 → clients 1, 2
const omap = { map: null, layer: null };
function drawOfferMap(picks, drops) {
  const box = $("#offerMap");
  const pts = [];
  if (!box) return;
  if (!window.L) { box.classList.add("hidden"); return; }
  if (!omap.map) {
    omap.map = L.map(box, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false });
    UI.mapTiles(omap.map, riderSet.theme !== "light");
    omap.layer = L.layerGroup().addTo(omap.map);
  }
  omap.layer.clearLayers();
  const pin = (html, cls) => L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="om-pin ${cls}">${html}</div>` });
  const add = (lat, lon, icon) => { if (lat == null || lon == null) return; pts.push([+lat, +lon]); L.marker([+lat, +lon], { icon, interactive: false }).addTo(omap.layer); };
  if (lastPos) add(lastPos.lat, lastPos.lon, L.divIcon({ className: "", iconSize: [16, 16], iconAnchor: [8, 8], html: `<div class="om-me"></div>` }));
  picks.forEach(x => add(x.pickup_lat, x.pickup_lon, pin("🏪", "pick")));
  drops.forEach((x, i) => add(x.dropoff_lat, x.dropoff_lon, pin(drops.length > 1 ? String(i + 1) : "🏁", "drop")));
  if (pts.length > 1) L.polyline(pts, { color: "#0F1F3D", weight: 4, opacity: .85 }).addTo(omap.layer);
  box.classList.toggle("hidden", pts.length < 2);
  if (pts.length < 2) return;
  setTimeout(() => { omap.map.invalidateSize(false); omap.map.fitBounds(pts, { padding: [28, 28], maxZoom: 16, animate: false }); }, 60);
}

function showNextOffer() {
  if (offerShown) return;
  let o;
  while (offerQueue.length && !o) {
    const id = offerQueue.shift();
    o = pool().find(x => x.id === id);
  }
  if (!o) return;
  offerShown = o.id;
  // Regroupement : une autre course disponible part du même coin et arrive à côté → une seule fenêtre pour les deux
  const mate = mine().length + 2 <= MAX_ORDERS && !busy() ? pool().find(x => x.id !== o.id && Store.pairOk(o, x)) : null;
  offerMate = mate ? mate.id : null;
  if (mate) { const i = offerQueue.indexOf(mate.id); if (i >= 0) offerQueue.splice(i, 1); seenPool.add(mate.id); }
  // Ou elle va dans le même coin qu'une course que j'ai déjà (pas encore récupérée) : « sur votre chemin »
  const onWay = !mate && Store.onWay(lastPos, mine(), o);
  const pick = pt(o.pickup_lat, o.pickup_lon), drop = pt(o.dropoff_lat, o.dropoff_lon);
  const trip = roadKm(pick, drop) ?? (o.distance_km != null ? Number(o.distance_km) * 1.3 : null);
  const toPickup = roadKm(lastPos, pick);
  const when = o.urgency === "programmee" ? UI.fmtDateTime(o.pickup_at) : o.urgency === "express" ? "⚡ Express : priorité, allez-y directement, sans autre course" : "Dès que possible";
  $("#offerIcon").textContent = { repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" }[o.service] || "📦";
  const total = Store.courseValue(o);
  const star = !!o.referrer_id && o.referrer_id === me.id;
  const com = Store.commissionFor(total, settings, star);
  $("#offerTitle").textContent = mate ? "2 courses d'un coup !" : onWay ? "➕ Une course en plus ?" : "Nouvelle course !";
  if (mate) {
    const t2 = Store.courseValue(mate), c2 = Store.commissionFor(t2, settings, !!mate.referrer_id && mate.referrer_id === me.id);
    $("#offerIcon").textContent = "📦📦";
    $("#offerPrice").textContent = UI.money(total + t2);
    $("#offerGain").textContent = `Pour vous : ${UI.money(total - com + t2 - c2)} pour les deux`;
  } else {
    $("#offerPrice").textContent = UI.money(total);
    $("#offerGain").textContent = `Pour vous : ${UI.money(total - com)}${star ? " · ⭐ votre commerce" : ""}`;
  }
  // Proposée d'abord aux livreurs en service les plus proches (vagues de wave_seconds)
  const early = !star && duty.watch != null && Date.now() - new Date(o.created_at) < 2 * Number(settings.wave_seconds) * 1000;
  const again = backAgain.has(o.id);
  const dropGap = (a, b) => Math.round(Store.kmBetween(+a.dropoff_lat, +a.dropoff_lon, +b.dropoff_lat, +b.dropoff_lon) * 1000 / 50) * 50;
  $("#offerStar").innerHTML = onWay ? `🔗 <b>Vraiment sur votre chemin</b> : ${onWay.status === "recuperee" ? "départ sur votre route" : Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +onWay.pickup_lat, +onWay.pickup_lon) < 0.08 ? "même départ" : "départ à côté (autre commerce)"} que votre course n° ${UI.esc(onWay.ref)}, arrivées à ${dropGap(onWay, o)} m l'une de l'autre${mine().length >= 2 ? ` (ce sera votre ${mine().length + 1}e course, le maximum)` : ""}.<br><b>Voulez-vous accepter cette course en plus ?</b>`
    : again ? "↩️ Personne d'autre ne l'a prise : elle vous est reproposée"
    : star ? `⭐ Course de <b>votre</b> commerce ${UI.esc(o.shop_name || "")}${priorityLeft(o)}`
    : early ? "🎯 Vous êtes parmi les plus proches : elle vous est proposée en premier" : "";
  $("#offerStar").classList.toggle("hidden", !star && !early && !again && !onWay);
  const place = (brand, addr, city) => `${brand ? `🏪 ${UI.esc(brand)}<br>` : ""}<bdi>${UI.esc(addr || "")}</bdi>${addr ? ", " : ""}${UI.esc(UI.cityFr(city))}`;
  const pickEta = lastPos && pick ? etaMin({ lat: lastPos.lat, lon: lastPos.lon }, pick) : null;
  // Mis à jour pendant que ça sonne (le commerce peut la marquer prête entre-temps)
  const showReady = () => { $("#offerReady").innerHTML = readyBanner(pool().find(x => x.id === o.id) || o, pickEta); };
  showReady();
  // Deux courses : livrer d'abord l'arrivée la plus proche du départ
  const order2 = mate ? [o, mate].sort((a, b) => Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +a.dropoff_lat, +a.dropoff_lon) - Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +b.dropoff_lat, +b.dropoff_lon)) : null;
  const samePick = mate && Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +mate.pickup_lat, +mate.pickup_lon) < 0.08;
  $("#offerFrom").innerHTML = !mate || samePick ? place(o.pickup_place, o.pickup_address, o.from_city)
    : [o, mate].map((x, i) => `${i + 1}. ${place(x.pickup_place, x.pickup_address, x.from_city)}`).join("<br>");
  $("#offerTo").innerHTML = mate ? `<details class="offer-drops"><summary>Livraisons multiples <span>(2 arrêts)</span></summary>${order2.map((x, i) => `<p>${["1️⃣", "2️⃣"][i]} ${place(x.dropoff_place, x.dropoff_address, x.to_city)}</p>`).join("")}</details>`
    : place(o.dropoff_place, o.dropoff_address, o.to_city);
  if (o.leave_at_door || (mate && mate.leave_at_door)) $("#offerTo").insertAdjacentHTML("beforeend", UI.doorBig(o.leave_at_door ? o : mate, true));
  const tour = mate ? Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +order2[0].dropoff_lat, +order2[0].dropoff_lon) * 1.3
    + Store.kmBetween(+order2[0].dropoff_lat, +order2[0].dropoff_lon, +order2[1].dropoff_lat, +order2[1].dropoff_lon) * 1.3 : null;
  // Le tour en un coup d'œil : « 4 arrêts · 2,3 km » (de vous jusqu'au dernier client) et la carte du trajet
  const picks = mate && !samePick ? [o, mate] : [o];
  const drops = mate ? order2 : [o];
  const legKm = (mate ? tour + (samePick ? 0 : Store.kmBetween(+o.pickup_lat, +o.pickup_lon, +mate.pickup_lat, +mate.pickup_lon) * 1.3) : trip || 0) + (toPickup || 0);
  $("#offerStops").innerHTML = `<b>${picks.length + drops.length} arrêts</b>${legKm >= 0.1 ? ` · ${legKm.toFixed(1).replace(".", ",")} km en tout` : ""}`;
  drawOfferMap(picks, drops);
  $("#offerFacts").innerHTML = [
    mate ? `🔗 <b>2 courses groupées</b> (n° ${UI.esc(order2[0].ref)} puis n° ${UI.esc(order2[1].ref)}) : ${samePick ? "même départ" : "2 commerces voisins"}, arrivées à <b>${dropGap(o, mate)} m</b> l'une de l'autre · ≈ ${tour.toFixed(1)} km en tout` : "",
    mate ? "" : `🛣️ <b>${trip != null && trip >= 0.5 ? `≈ ${trip.toFixed(trip < 10 ? 1 : 0)} km` : "Dans la même ville"}</b> de trajet`,
    toPickup != null ? `🛵 Départ à <b>${etaMin({ lat: lastPos.lat, lon: lastPos.lon }, pick)} min</b> de vous (≈ ${toPickup.toFixed(1)} km)` : "",
    trip != null && !mate ? `🏁 Puis <b>${Math.max(1, Math.round(trip / (trip < 6 ? 25 : 50) * 60 + 2))} min</b> jusqu'au client` : "",
    `🕐 ${UI.esc(when)}`,
    mate ? `💳 Chaque client paie sa course : <b>${UI.money(total)}</b> (n° ${UI.esc(o.ref)}) et <b>${UI.money(Store.courseValue(mate))}</b> (n° ${UI.esc(mate.ref)})` : payLine(o),
    cashNeedLine(o),
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
    if (left % 5 === 0) showReady();
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

let offerTick = null, offerMate = null;
function closeOffer() {
  offerMate = null;
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
  if (id) markDeclined(id);
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

// Deux courses groupées : les deux d'un coup ; si l'autre vient d'être prise, celle-ci seule
async function acceptTwo(id, mateId, eta) {
  acceptedHere.add(id); acceptedHere.add(mateId);
  try { await Store.acceptBundle([id, mateId], eta); return true; }
  catch (e) {
    // L'autre vient d'être prise (ou la base ne connaît pas encore les courses groupées) : celle-ci seule
    if (!/bundle_taken|bundle_invalid|PGRST202/.test(e.message) && e.status !== 404) return acceptError(e);
    const one = await Store.acceptOrder(id, eta).catch(x => acceptError(x));
    if (one && one !== "shown") alert("L'autre course vient d'être prise par un autre livreur : vous avez celle-ci.");
    return one;
  }
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
  if (!(await cashOk(pool().find(x => x.id === id)))) return closeOffer();
  $("#etaPick").classList.add("hidden");
  $("#offerAccept").classList.remove("hidden");
  $("#offerAccept").disabled = true;
  const mateId = offerMate;
  acceptedHere.add(id);
  const ok = mateId ? await acceptTwo(id, mateId, eta) : await Store.acceptOrder(id, eta).catch(e => acceptError(e));
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
  const m = rmap.gl && rmap.gl.getMaplibreMap();
  if (m) m.setStyle(VSTYLE[riderSet.theme === "light" ? "light" : "dark"]);
}
const PAGE_TITLES = { mine: "Mes courses", pool: "Courses disponibles", zones: "Zones et demande", week: "Finances", stats: "Statistiques",
  ref: "Gagner plus", rules: "Engagements et assurance", settings: "Réglages", help: "Centre d'aide", inbox: "Messages de HOP!" };
function openPage(t) {
  if (t === "ref" && !refOn()) t = "home";
  if (t === "home") return closePage();
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
  // Même départ : une seule carte, celle de la commande à récupérer maintenant (« 1 sur 2 »)
  const cur = mine().filter(o => { const r = pickupRank(o); return !r || r.current.id === o.id; });
  const p = pool();
  $("#sheetBody").innerHTML = `${refundCards()}
    <div class="rd-title">${UI.esc(title)}</div>
    <div class="rd-demand">Demande de livraison ${lv ? `${bars(lv)} <b>${lv.label}</b>` : "…"}</div>
    ${cur.map(o => `<button type="button" class="rd-card course" data-tab="mine">
        <span><span class="rc-head"><b class="rc-amt">${UI.esc(UI.money(Store.courseValue(o) - Number(o.commission || 0)))}</b><span class="rc-who">${UI.esc(o.shop_name || o.pickup_place || o.contact_name || "")}<small>n° ${UI.esc(o.ref)}${tripKm(o) ? ` · ${tripKm(o)}` : ""}</small></span></span>
          <em class="rc-step">${UI.esc(mineStep(o, o.paid_to === "hop"))}</em>
          <small class="${o.status === "confirmee" ? "now" : ""}">📍 ${UI.esc(o.pickup_place || o.pickup_address)}, ${UI.esc(UI.cityFr(o.from_city))}</small>
          <small class="${o.status === "recuperee" ? "now" : ""}">🏁 ${UI.esc(o.dropoff_address)}, ${UI.esc(UI.cityFr(o.to_city))}</small></span><span class="go">›</span></button>`).join("")}
    ${!isOnline() && !cur.length ? `<button type="button" class="rd-card" data-tab="zones"><span>📈 ${lv && lv.n === 3 ? "Beaucoup de commandes en ce moment : passez en ligne !" : "Passez en ligne pour recevoir des courses"}<small>Voir les prévisions de la journée</small></span><span class="go">›</span></button>` : ""}
    ${isOnline() && (p.length || !cur.length) ? (p.length ? `<button type="button" class="rd-card hot" data-tab="pool"><span>🆕 ${p.length} course(s) disponible(s)<small>Touchez pour voir et accepter</small></span><span class="go">›</span></button>`
      : `<button type="button" class="rd-line" data-tab="zones">⏰ Pas de course · pointe ${UI.esc(CONFIG.peakHours.fr)}<span class="go">›</span></button>`) : ""}
    ${window.Notification && Notification.permission !== "granted" ? `<button type="button" class="rd-line rd-alert" data-notif="1" title="Pour « En service » et les nouvelles courses, même appli fermée">${Notification.permission === "denied" ? "🔕 Alertes bloquées : touchez pour voir comment" : "🔔 Activer les alertes"}<span class="go">›</span></button>` : ""}
    ${!isOnline() && !UI.inOwnApp() ? `<button type="button" class="rd-card" data-install="1"><span>📲 Installer HOP! Livreur<small>Son icône « LIVREUR » à part, et les courses qui sonnent appli fermée</small></span><span class="go">›</span></button>` : ""}
    ${!isOnline() && refOn() ? `<button type="button" class="rd-card" data-tab="ref"><span>🏆 Gagnez plus en amenant des commerces<small>${me.network_perks ? `+${UI.money(settings.referral_bonus)} sur chacune de leurs livraisons` : "Leurs courses vous sont proposées en premier"}</small></span><span class="go">›</span></button>` : ""}`;
  [...$("#sheetBody").querySelectorAll(".rd-card")].forEach((c, i) => c.classList.toggle("rd-more", i >= 2));
  $("#dutyText").classList.toggle("rd-more", !/⚠️/.test($("#dutyText").textContent));
  if (sheetState() === "expanded") renderToday();
  sheetHeight();
}
// Remboursement à faire : en haut de l'accueil et des courses disponibles, tant qu'il n'est pas fait
function refundCards() {
  return refunds.map(r => `<div class="rd-card refund-card"><span>💸 Remboursez <b>${UI.money(r.amount)}</b> à ${UI.esc(r.name || "votre client")}
      <small>Par Bit / PayBox au <a href="tel:${UI.esc(r.phone || "")}"><b>${UI.esc(r.phone || "")}</b></a> · course n° ${UI.esc(r.ref)}${r.status === "litige" ? " · ⚠️ le client dit ne pas avoir été remboursé" : ""}.
      Pas de nouvelle course tant que ce n'est pas fait.</small>
      <span class="refund-btns"><button type="button" class="btn btn-sm btn-primary" data-refund-done="${UI.esc(r.id)}">✅ J'ai remboursé</button>${r.received ? "" : `<button type="button" class="btn btn-sm" data-refund-none="${UI.esc(r.id)}">Je n'avais rien reçu</button>`}</span></span></div>`).join("");
}
async function onRefundClick(e) {
  const d = e.target.closest("[data-refund-done], [data-refund-none]");
  if (!d) return false;
  const done = d.hasAttribute("data-refund-done");
  if (!confirm(done ? "Vous avez bien renvoyé l'argent au client par Bit / PayBox ?" : "Vous n'avez vraiment rien reçu de ce client ? (il pourra le contester, HOP vérifie)")) return true;
  d.disabled = true;
  await Store.refundDone(d.dataset.refundDone || d.dataset.refundNone, done).catch(() => alert("Pas enregistré, réessayez."));
  await load();
  return true;
}
// Hauteur du panneau du bas : le bouton « me centrer » et le cadrage de la carte restent au-dessus
function sheetHeight() {
  const h = $("#sheet").offsetHeight;
  if (h) $("#work").style.setProperty("--sheet-h", h + "px");
  // Le panneau a changé de taille : on recadre la carte pour que la course reste visible au-dessus
  if (h && Math.abs(h - (rmap.sheetH || 0)) > 40) { rmap.sheetH = h; if (rmap.fitted) setTimeout(fitRiderMap, 50); }
  return h || 0;
}
// Panneau du bas qu'on glisse vers le bas (ou qu'on touche) pour voir toute la carte : la course, ses 2 points et le trajet
// Trois positions, sans défilement : réduit (la carte entière), normal (l'essentiel), grand (tout + la journée)
function sheetState() { const c = $("#sheet").classList; return c.contains("collapsed") ? "collapsed" : c.contains("expanded") ? "expanded" : "normal"; }
function setSheetState(st) {
  const sheet = $("#sheet");
  sheet.classList.toggle("collapsed", st === "collapsed");
  sheet.classList.toggle("expanded", st === "expanded");
  if (st !== "expanded") sheet.scrollTop = 0;
  $("#work").classList.toggle("sheet-big", st === "expanded");
  try { localStorage.setItem("livraison.sheetCollapsed.v1", st === "collapsed" ? "1" : ""); } catch (e) { /* ignore */ }
  if (st === "expanded") renderToday();
  sheetHeight();
  fitRiderMap();
}
function setSheet(collapsed) { setSheetState(collapsed ? "collapsed" : "normal"); }
function initSheetDrag() {
  const sheet = $("#sheet");
  let y0 = null, dy = 0, fromGrab = false;
  // On glisse n'importe où sur le panneau (sauf sur un bouton, un lien ou la glissière « HOP! »)
  sheet.addEventListener("pointerdown", e => {
    fromGrab = !!e.target.closest("#sheetGrab");
    if (!fromGrab && e.target.closest("button, a, input, select, textarea, .rd-slide")) return;
    y0 = e.clientY; dy = 0; sheet.classList.add("dragging");
    try { sheet.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  });
  sheet.addEventListener("pointermove", e => {
    if (y0 == null) return;
    dy = e.clientY - y0;
    if (Math.abs(dy) > 6) sheet.style.transform = `translateY(${Math.max(-60, Math.min(dy, sheetState() === "expanded" ? sheet.offsetHeight - 300 : 30))}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    sheet.classList.remove("dragging");
    sheet.style.transform = "";
    const st = sheetState();
    // Deux positions : normal (le plus bas, toujours lisible) et grand (« Aujourd'hui »)
    if (Math.abs(dy) < 8) { setSheetState(st === "expanded" ? "normal" : "expanded"); return; }   // un appui sur le panneau : monter / descendre
    if (dy > 40) setSheetState("normal");          // vers le bas
    else if (dy < -30) setSheetState("expanded");  // vers le haut
  };
  sheet.addEventListener("pointerup", end);
  sheet.addEventListener("pointercancel", end);
  try { localStorage.removeItem("livraison.sheetCollapsed.v1"); } catch (e) { /* ignore */ }
}

// --- Panneau remonté : « Aujourd'hui » — l'afflux heure par heure, mes chiffres du jour --------------
// Courbe habituelle d'une journée de livraison (midi et soir), le vendredi plus tôt (avant Chabbat), le samedi le soir ;
// elle monte avec les vraies commandes de ce jour de la semaine (4 semaines) et la demande en direct.
const TYPICAL = { 8: 1, 9: 1.2, 10: 1.6, 11: 3, 12: 6, 13: 7, 14: 5, 15: 2.6, 16: 2.6, 17: 4, 18: 6.5, 19: 8, 20: 8, 21: 6, 22: 3.2, 23: 1.6 };
function todayCurve() {
  const dow = new Date().getDay(), now = new Date().getHours();
  const base = Object.assign({}, TYPICAL);
  if (dow === 5) Object.assign(base, { 10: 4, 11: 7, 12: 8, 13: 8, 14: 6, 15: 3, 16: 1, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0 });
  if (dow === 6) Object.assign(base, { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 1, 19: 5, 20: 8, 21: 8, 22: 6, 23: 4 });
  const hist = (forecast || []).map(Number), htop = Math.max(0, ...hist);
  const lv = demandLevel(demand), boost = lv ? [1, 1, 1.25, 1.6][lv.n] : 1;
  const real = todayReal || [], rtop = Math.max(0, ...real, ...hist);
  const hours = Object.keys(base).map(Number).map(h => {
    // À venir : la prévision (courbe habituelle + historique) ; passé et en cours : les vraies commandes du jour
    let v = base[h] / 8;
    if (htop > 0) v = v * 0.5 + (hist[h] || 0) / htop * 0.5;
    if (h === now) v *= boost;
    const n = real[h] || 0, isReal = h <= now && real.length > 0;
    if (isReal && rtop > 0) v = h === now ? Math.max(n / rtop, v * 0.4) : n / rtop;
    else if (isReal) v = v * 0.25;
    return { h, v: Math.min(1.25, v), n, real: isReal };
  });
  return { hours, now, lv, total: real.reduce((a, b) => a + Number(b || 0), 0) };
}
function renderToday() {
  const box = $("#todayBox");
  if (!box) return;
  const { hours, now, lv, total } = todayCurve();
  const top = Math.max(0.3, ...hours.map(x => x.v));
  const peaks = hours.filter(x => x.v / top >= 0.8).map(x => x.h);
  const ranges = [];
  peaks.forEach(h => { const r = ranges[ranges.length - 1]; if (r && r[1] === h - 1) r[1] = h; else ranges.push([h, h]); });
  const next = hours.find(x => x.h > now && x.v / top >= 0.8);
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const done = orders.filter(o => o.courier_id === me.id && o.status === "livree" && new Date(o.delivered_at || o.pickup_at) >= t0);
  const gain = done.reduce((a, o) => a + Store.courierGain(o) + (["recu", "verse"].includes(o.tip_status) ? Number(o.tip || 0) : 0), 0);
  box.innerHTML = `<div class="today">
      <div class="today-head"><b>📊 Aujourd'hui</b><span>${lv ? `Maintenant : <b>${lv.label}</b> ${bars(lv)}` : ""}</span>
        <button type="button" class="today-close" data-sheet-down="1" aria-label="Réduire">⌄ Réduire</button></div>
      <div class="today-chart">${hours.map(x => `<div class="${x.h === now ? "now" : ""}${x.real ? " real" : " fc"}">
          ${x.real && x.n ? `<em>${x.n}</em>` : ""}<i style="height:${Math.round(8 + 80 * x.v / top)}%" class="${x.v / top >= 0.8 ? "hi" : x.v / top >= 0.45 ? "mid" : "lo"}"></i><span>${x.h}</span></div>`).join("")}</div>
      <p class="today-legend"><span class="lg real"></span> Vraies commandes aujourd'hui : <b>${total}</b> <span class="lg fc"></span> Prévision</p>
      <p class="today-peak">🔥 Pics : ${ranges.map(r => `${r[0]} h–${r[1] + 1} h`).join(" et ") || "—"}${next ? ` · le prochain dans <b>${next.h - now} h</b>` : ""}</p>
      <div class="today-stats">
        <div><small>Courses</small><b>${done.length}</b></div>
        <div><small>Gagné</small><b>${UI.money(gain)}</b></div>
        <div><small>Par course</small><b>${UI.money(done.length ? gain / done.length : 0)}</b></div>
        <div><small>Crédit HOP</small><b>${UI.money(available())}</b></div>
      </div>
      <p class="today-how">🎯 Le plus proche d'abord · ⚡ Express aux livreurs libres · 💳 payé avant de récupérer</p></div>`;
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
const rmap = { map: null, tiles: null, gl: null, layer: null, fitted: false };
function initRiderMap() {
  if (rmap.map || !window.L) return;
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  rmap.map = L.map("riderMap", { zoomControl: false, attributionControl: true }).setView([home.lat, home.lon], 13);
  rmap.tiles = UI.mapTiles(rmap.map, riderSet.theme !== "light");
  rmap.layer = L.layerGroup().addTo(rmap.map);
  vectorMap();
  setTimeout(() => rmap.map.invalidateSize(), 100);
}
// Belle carte (OpenFreeMap : vectorielle, gratuite, sans clé, noms en français ou en anglais quand ils existent).
// Chargée après la carte OpenStreetMap, qui reste si elle ne vient pas (pas de WebGL, réseau, service coupé).
const ML = "https://unpkg.com/maplibre-gl@4.7.1/dist/", MLL = "https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js";
const VSTYLE = { dark: "https://tiles.openfreemap.org/styles/dark", light: "https://tiles.openfreemap.org/styles/liberty" };
const LABEL = ["coalesce", ["get", "name:fr"], ["get", "name_en"], ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
let mlLoad = null;
function loadScript(src) {
  return new Promise((ok, ko) => { const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = ko; document.head.appendChild(el); });
}
function vectorMap() {
  if (!mlLoad) {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = ML + "maplibre-gl.css";
    document.head.appendChild(css);
    mlLoad = loadScript(ML + "maplibre-gl.js").then(() => loadScript(MLL));
  }
  mlLoad.then(() => {
    if (rmap.gl || !L.maplibreGL) return;
    const gl = L.maplibreGL({ style: VSTYLE[riderSet.theme === "light" ? "light" : "dark"], attribution: "© OpenFreeMap © OpenStreetMap" }).addTo(rmap.map);
    const m = gl.getMaplibreMap();
    if (!m) { rmap.map.removeLayer(gl); return; }
    let ok = false;
    m.on("style.load", () => {
      // Noms lisibles : français, sinon anglais, sinon le nom local
      m.getStyle().layers.forEach(l => {
        const tf = l.type === "symbol" && m.getLayoutProperty(l.id, "text-field");
        if (tf && /name/.test(JSON.stringify(tf))) m.setLayoutProperty(l.id, "text-field", LABEL);
      });
    });
    m.once("load", () => { ok = true; if (rmap.tiles) { rmap.map.removeLayer(rmap.tiles); rmap.tiles = null; } });
    m.on("error", () => { if (!ok && rmap.gl) { rmap.map.removeLayer(rmap.gl); rmap.gl = null; } });
    // Appli mise en arrière-plan : le téléphone peut reprendre la carte graphique → carte vide au retour
    m.on("webglcontextlost", () => { rmap.glLost = true; });
    rmap.gl = gl;
  }).catch(() => {});
}
// De retour dans HOP! : la carte se redessine (et se reconstruit si le téléphone l'a vidée)
function reviveRiderMap() {
  if (!rmap.map) return;
  rmap.map.invalidateSize(false);
  const m = rmap.gl && rmap.gl.getMaplibreMap();
  const gl = m && m.painter && m.painter.context && m.painter.context.gl;
  if (rmap.gl && (rmap.glLost || !m || (gl && gl.isContextLost && gl.isContextLost()))) {
    rmap.map.removeLayer(rmap.gl);
    rmap.gl = null; rmap.glLost = false;
    // La carte simple tout de suite, puis la belle carte par-dessus
    if (!rmap.tiles) rmap.tiles = UI.mapTiles(rmap.map, riderSet.theme !== "light");
    vectorMap();
  } else if (m) { m.resize(); m.triggerRepaint(); }
  if (rmap.tiles && rmap.tiles.redraw) rmap.tiles.redraw();
  updateRiderMap();
}
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
  if (hiddenAt) setTimeout(reviveRiderMap, 150);
});
window.addEventListener("pageshow", e => { if (e.persisted) setTimeout(reviveRiderMap, 150); });
// Bulle façon appli de livraison, posée sur le point : « 🏪 Récupération · 5 min »
const rbubble = (emoji, cls, title, min) => L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18],
  html: `<div class="rd-pin ${cls || ""}">${emoji}<span class="pin-bubble ${cls || ""}"><b>${UI.esc(title)}</b>${min != null ? `<em>${min} min</em>` : ""}</span></div>` });
const etaMin = (a, b) => (a && b ? Pricing.etaMinutes(a, b) : null);
const rpin = (emoji, cls, label) => L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18],
  html: `<div class="rd-pin ${cls || ""}">${emoji}${label ? `<span class="pin-price">${UI.esc(label)}</span>` : ""}</div>` });
function updateWazeFab() {
  const fab = $("#wazeFab");
  if (!fab) return;
  const cur = mine()[0];
  fab.classList.toggle("hidden", !cur);
  if (!cur) return;
  const which = cur.status === "recuperee" ? "dropoff" : "pickup";
  fab.href = navLink(cur, which);
  fab.dataset.step = which === "pickup" ? "1" : "2";
  fab.title = which === "pickup" ? "Itinéraire vers le départ" : "Itinéraire vers le client";
  fab.innerHTML = (riderSet.nav === "maps" ? "🧭" : WAZE_SVG) + `<i>${which === "pickup" ? "📍" : "🏁"}</i>`;
}
function updateRiderMap() {
  updateWazeFab();
  if (!rmap.map || !me) return;
  rmap.layer.clearLayers();
  const pts = [];
  const add = (lat, lon, icon, popup) => {
    if (lat == null || lon == null) return;
    const m = L.marker([Number(lat), Number(lon)], { icon }).addTo(rmap.layer);
    if (popup) m.bindPopup(popup);
    pts.push([Number(lat), Number(lon)]);
  };
  const here = lastPos ? { lat: lastPos.lat, lon: lastPos.lon } : null;
  pool().forEach(o => add(o.pickup_lat, o.pickup_lon, rpin({ repas: "🍔", retrait: "📮", achat: "🛒", colis: "📦" }[o.service] || "📦", "",
      UI.money(Store.courseValue(o)) + (here && o.pickup_lat != null ? ` · à ${etaMin(here, pt(o.pickup_lat, o.pickup_lon))} min` : "")),
    `<b>Course n° ${UI.esc(o.ref)}</b><br>${UI.esc(UI.cityFr(o.from_city))} → ${UI.esc(UI.cityFr(o.to_city))} · ${UI.money(Store.courseValue(o))}`));
  mine().forEach(o => {
    // Temps sur la carte : jusqu'au départ (depuis moi), puis jusqu'au client (en passant par le départ si pas encore récupéré)
    const pick = pt(o.pickup_lat, o.pickup_lon), drop = pt(o.dropoff_lat, o.dropoff_lon), got = o.status === "recuperee";
    const toPick = got ? null : etaMin(here, pick);
    const toDrop = got ? etaMin(here, drop) : (etaMin(pick, drop) != null ? (toPick || 0) + etaMin(pick, drop) + (o.arrived_at ? 0 : 2) : null);
    add(o.pickup_lat, o.pickup_lon, got ? rpin("📍", "done") : rbubble("🏪", "pick", "Récupération", toPick), `Récupération · n° ${UI.esc(o.ref)}`);
    add(o.dropoff_lat, o.dropoff_lon, rbubble("🏁", "drop", "Livraison", toDrop), `Livraison · n° ${UI.esc(o.ref)}`);
    if (o.pickup_lat != null && o.dropoff_lat != null) L.polyline([[o.pickup_lat, o.pickup_lon], [o.dropoff_lat, o.dropoff_lon]], { color: "#FF6A13", weight: 4, dashArray: "8 8" }).addTo(rmap.layer);
  });
  // Moi sur la carte : le même petit logo que côté client (« ! » orange qui clignote en service, gris hors service)
  if (lastPos) add(lastPos.lat, lastPos.lon, L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15],
    html: `<div class="ch-scoot${duty.watch != null ? "" : " busy"}"><b>!</b></div>` }), "Vous êtes ici");
  rmap.pts = pts;
  // Nouvelle course acceptée : on recadre sur ses 2 points et le trajet
  const curId = (mine()[0] || {}).id || null;
  if ((!rmap.fitted || curId !== rmap.curId) && pts.length) { rmap.curId = curId; fitRiderMap(); rmap.fitted = true; }
}
// Bouton « me centrer » : la position du téléphone maintenant (pas une ancienne), au milieu de la carte visible
function centerOn(lat, lon) {
  if (!rmap.map) return;
  rmap.map.setView([lat, lon], 16, { animate: false });
  rmap.map.panBy([0, Math.round(($("#sheet").offsetHeight || 0) / 2)], { animate: false });
}
function locateMe() {
  if (lastPos) centerOn(lastPos.lat, lastPos.lon);
  if (!navigator.geolocation) return;
  const btn = $("#locateBtn");
  btn.classList.add("busy");
  navigator.geolocation.getCurrentPosition(pos => {
    btn.classList.remove("busy");
    lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, at: Date.now() };
    updateRiderMap();
    centerOn(lastPos.lat, lastPos.lon);
    if (duty.watch != null) sendPosition(pos);
  }, err => {
    btn.classList.remove("busy");
    if (err.code === 1) alert("Autorisez la localisation pour HOP! (réglages du navigateur) pour vous voir sur la carte.");
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}
// Cadrage : la course en cours (récupération, livraison, moi) si il y en a une, sinon tout ; au-dessus du panneau du bas
function fitRiderMap() {
  if (!rmap.map || !rmap.pts || !rmap.pts.length) return;
  rmap.map.invalidateSize(false);   // la carte a pu être cachée ou redimensionnée : sinon le cadrage est faux
  const cur = mine()[0];
  const pts = cur ? [[cur.pickup_lat, cur.pickup_lon], [cur.dropoff_lat, cur.dropoff_lon]].filter(p => p[0] != null && p[1] != null).map(p => p.map(Number)) : [];
  if (cur && lastPos) pts.push([lastPos.lat, lastPos.lon]);
  const sheet = $("#sheet").offsetHeight || 260;
  rmap.map.fitBounds(pts.length ? pts : rmap.pts, { paddingTopLeft: [40, 80], paddingBottomRight: [40, sheet + 30], maxZoom: 16, animate: false });
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
      <p class="muted small">Gains = courses − commission HOP + pourboires reçus${refOn() ? " (hors bonus réseau et abonnements Pro)" : ""}.</p></div>
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
      ${UI.inOwnApp() ? "" : `<h3>Application</h3>
      <div class="set-row"><span>HOP! Livreur sur l'écran d'accueil<small class="muted" style="display:block">Son icône « LIVREUR » à part, même si l'appli client HOP! est déjà installée</small></span><button type="button" class="btn btn-sm btn-primary" data-install="1">📲 Installer</button></div>`}
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
    ["Comment je suis payé ?", `Directement : le client vous paie la course en espèces (le montant exact, indiqué sur la course) ou par Bit / PayBox sur votre numéro (avant « Livré », touchez « 📱 Payé par Bit » ou « 💵 Payé en espèces »), et le commerce HOP! Pro vous paie sa part en vous remettant la commande. HOP n'encaisse rien pour vous : sa commission (${UI.commissionText()}${refOn() ? `, ou ${UI.networkText()} sur vos commerces` : ""}) est déduite de votre crédit HOP, que vous rechargez à l'avance par Bit (« Finances »).${refOn() ? " Les bonus et parts d'abonnement y sont ajoutés." : ""}`],
    ["Pourquoi je ne peux pas valider « Livré » ?", `Il faut être à moins de ${deliverRadius()} m de l'adresse de livraison. Pour « déposer devant la porte », envoyez d'abord la photo du colis dans la conversation de la course.`],
    ["Pourquoi je ne reçois plus de courses ?", `Soit une course récupérée n'est pas encore validée, soit votre crédit HOP ne couvre plus la commission d'une course. Le bandeau vous dit quoi faire : rechargez dans « Finances ». Un souci ? HOP peut vous débloquer.`],
    ["Je peux mettre le téléphone dans la poche ?", `Oui : vous restez en ligne écran éteint, et chaque nouvelle course fait sonner le téléphone (activez « Alertes sur le téléphone » dans les Réglages). Vous passez hors ligne seulement si ${Number(settings.miss_streak_max || 2)} courses sonnent d'affilée sans que vous répondiez (ni « Accepter » ni « Refuser »), ou si HOP! n'a plus de nouvelles de vous depuis ${hrs(Number(settings.idle_off_min || 180))}.`],
    ["Le client est absent, l'adresse est introuvable…", "Touchez « ⚠️ Un souci » sur la course : HOP et le client sont prévenus tout de suite, et vous continuez dans la conversation."],
    ...(!refOn() ? [] : [["Comment gagner plus ?", me.network_perks
      ? `Amenez des commerces avec votre code (menu « Gagner plus ») : vous voyez leurs courses en premier, vous ne payez que ${UI.networkText()} de commission dessus, +${UI.money(settings.referral_bonus)} quand un autre livreur les fait${CONFIG.pro.referrerPercent ? `, et ${CONFIG.pro.referrerPercent} % de leur abonnement HOP! Pro pendant ${CONFIG.pro.referrerMonths} mois` : ""}.`
      : `Amenez des commerces avec votre code (menu « Gagner plus ») : vous voyez leurs courses en premier. Les livreurs les mieux notés peuvent recevoir de HOP les avantages réseau : ${UI.networkText()} de commission seulement sur ces courses, +${UI.money(settings.referral_bonus)} quand un autre livreur les fait${CONFIG.pro.referrerPercent ? `, et ${CONFIG.pro.referrerPercent} % de leur abonnement HOP! Pro` : ""}.`]]),
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
    ${list.length ? list.map(m => `<div class="msg-card msg-${UI.esc(m.kind)}"><div><small>${UI.esc(UI.fmtDateTime(m.created_at))}</small><b>${UI.esc(m.body)}</b></div></div>`).join("")
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
    $("#dutyText").textContent = "";
  } catch (e) {
    duty.lastSent = 0;
    $("#dutyText").textContent = "⚠️ Position non envoyée (connexion). Nouvel essai automatique.";
  }
}

// HOP! ouvert à l'écran : on donne des nouvelles chaque minute, même à l'arrêt (sinon le GPS ne renvoie rien)
setInterval(() => {
  if (duty.watch == null || document.visibilityState !== "visible" || !lastPos || Date.now() - duty.lastSent < 60000) return;
  sendPosition({ coords: { latitude: lastPos.lat, longitude: lastPos.lon } });
}, 20000);

// Passé hors ligne par HOP! (courses sans réponse, trop de refus, aucune nouvelle depuis 3 h) : on coupe aussi ici
function serverWentOffline(card) {
  if (duty.watch == null || !card || card.online || !card.auto_offline_at || !duty.since) return;
  if (new Date(card.auto_offline_at).getTime() < duty.since) return;
  toggleDuty(true);
  try { localStorage.setItem("livraison.online.v1", ""); } catch (e) { /* ignore */ }
  $("#autoOffText").textContent = autoOffText();
  $("#autoOffModal").classList.remove("hidden");
}

// « HOP! » en grand quand on passe en ligne
function hopBurst() {
  const el = document.createElement("div");
  el.className = "rd-hop";
  el.innerHTML = `<b>HOP!</b><span>🟢 Vous êtes en ligne</span>`;
  $("#work").appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
// --- Fin de service : le bilan, puis un avis en quelques gestes, envoyé au patron dans ses messages ---------------
const RATE = [["top", "😀", "Top"], ["moyen", "😐", "Moyen"], ["bof", "😕", "Pas top"]];
const SHIFT_TAGS = {
  app: ["GPS / carte", "Temps annoncés faux", "Trop de notifications", "Lent / bug", "Difficile à comprendre"],
  shop: ["Commande pas prête", "Longue attente", "Mauvais accueil", "Mal emballé", "Mauvais n° de sac"],
  client: ["Injoignable", "Mauvaise adresse", "Paiement en retard", "Pas aimable", "Longue attente"],
  hop: ["Pas assez de courses", "Réponse lente", "Prix des courses", "Règles pas claires"]
};
const shift = { since: 0, rates: {}, tags: {} };
const fmtDur = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
function shiftDone() {
  return orders.filter(o => o.courier_id === me.id && o.status === "livree" && new Date(o.delivered_at || o.pickup_at).getTime() >= shift.since);
}
// Les commerces (ou lieux de départ) où il est passé pendant ce service, 3 au plus
function shiftShops() {
  const seen = new Map();
  shiftDone().forEach(o => { const n = o.shop_name || String(o.pickup_place || "").split(" · ")[0]; if (n && !seen.has(n)) seen.set(n, o.shop_id || n); });
  return [...seen.keys()].slice(0, 3);
}
function openShift(since) {
  shift.since = since; shift.rates = {}; shift.tags = {};
  const done = shiftDone();
  // Service très court sans course (un essai, un faux geste) : on ne demande rien
  if (!done.length && Date.now() - since < 10 * 60000) return;
  renderShift();
  $("#shiftModal").classList.remove("hidden");
}
function renderShift() {
  const done = shiftDone(), shops = shiftShops();
  const gain = done.reduce((a, o) => a + Store.courseValue(o) - Number(o.commission || 0) + (o.tip_status === "recu" ? Number(o.tip || 0) : 0), 0);
  const block = (key, icon, title, sub) => {
    const r = shift.rates[key];
    const tags = r && r !== "top" ? SHIFT_TAGS[key.startsWith("shop:") ? "shop" : key] : null;
    return `<section class="sh-q"><b>${icon} ${UI.esc(title)}</b>${sub ? `<small>${UI.esc(sub)}</small>` : ""}
      <div class="sh-rates">${RATE.map(([v, e, l]) => `<button type="button" class="${r === v ? "on " + v : ""}" data-rate="${UI.esc(key)}" data-v="${v}"><i>${e}</i>${l}</button>`).join("")}</div>
      ${tags ? `<div class="sh-tags">${tags.map(t => `<button type="button" class="chip${(shift.tags[key] || []).includes(t) ? " on" : ""}" data-tag="${UI.esc(key)}" data-t="${UI.esc(t)}">${UI.esc(t)}</button>`).join("")}</div>` : ""}
    </section>`;
  };
  $("#shiftBox").innerHTML = `<button type="button" class="sh-x" data-shift-close aria-label="Fermer">✕</button>
    <div class="sh-head"><span>🏁</span><h3>Fin de service · merci ${UI.esc(String(me.name || "").split(" ")[0])} !</h3></div>
    <div class="sh-sum">
      <div><b>${fmtDur(Date.now() - shift.since)}</b><small>en ligne</small></div>
      <div><b>${done.length}</b><small>course${done.length > 1 ? "s" : ""} livrée${done.length > 1 ? "s" : ""}</small></div>
      <div><b>${UI.money(gain)}</b><small>pour vous</small></div>
    </div>
    <p class="muted small sh-lead">Votre avis en 20 secondes : il part directement à HOP! et nous aide à améliorer l'appli</p>
    ${block("app", "📱", "L'appli HOP!", "Courses, carte, temps annoncés, notifications")}
    ${shops.map(n => block("shop:" + n, "🏪", n, "Comment ça s'est passé au retrait ?")).join("")}
    ${done.length ? block("client", "🙋", "Les clients", "Accueil, adresse, paiement") : ""}
    ${block("hop", "🛵", "HOP! (l'équipe, l'aide)", "Les courses, les réponses, les règles")}
    <label class="f sh-com"><span>💬 Un mot pour HOP! (facultatif)</span><textarea id="shiftCom" rows="2" maxlength="500" placeholder="Une idée, un souci, un compliment…"></textarea></label>
    <div class="btns"><button type="button" class="btn btn-primary btn-block" data-shift-send>📨 Envoyer mon avis</button>
      <button type="button" class="btn btn-link btn-block" data-shift-close>Pas maintenant</button></div>`;
}
$("#shiftModal").addEventListener("click", async e => {
  const r = e.target.closest("[data-rate]"), tg = e.target.closest("[data-tag]");
  if (r) { const com = $("#shiftCom").value; shift.rates[r.dataset.rate] = r.dataset.v; if (r.dataset.v === "top") delete shift.tags[r.dataset.rate]; renderShift(); $("#shiftCom").value = com; return; }
  if (tg) {
    const com = $("#shiftCom").value, list = shift.tags[tg.dataset.tag] = shift.tags[tg.dataset.tag] || [], i = list.indexOf(tg.dataset.t);
    if (i >= 0) list.splice(i, 1); else list.push(tg.dataset.t);
    renderShift(); $("#shiftCom").value = com; return;
  }
  if (e.target.closest("[data-shift-close]") || e.target === $("#shiftModal")) { $("#shiftModal").classList.add("hidden"); return; }
  const send = e.target.closest("[data-shift-send]");
  if (!send) return;
  const com = $("#shiftCom").value.trim();
  if (!Object.keys(shift.rates).length && !com) return alert("Touchez au moins un 😀 😐 😕, ou écrivez un mot.");
  const done = shiftDone(), label = { top: "😀 Top", moyen: "😐 Moyen", bof: "😕 Pas top" };
  const line = (key, title) => shift.rates[key] ? `• ${title} : ${label[shift.rates[key]]}${(shift.tags[key] || []).length ? " (" + shift.tags[key].join(", ") + ")" : ""}` : "";
  const text = [`📝 Fin de service · ${fmtDur(Date.now() - shift.since)} en ligne · ${done.length} course(s) livrée(s)`,
    line("app", "📱 Appli"), ...shiftShops().map(n => line("shop:" + n, "🏪 " + n)), line("client", "🙋 Clients"), line("hop", "🛵 HOP!"),
    com ? `💬 ${com}` : ""].filter(Boolean).join("\n");
  send.disabled = true; send.textContent = "Envoi…";
  try {
    await Store.chatSend("c:" + me.id, "courier", me.name, text);
    $("#shiftBox").innerHTML = `<div class="sh-thanks"><span>🙏</span><h3>Merci, c'est bien envoyé à HOP!</h3><p class="muted">Bon repos, et à très vite sur HOP!</p>
      <button type="button" class="btn btn-primary btn-block" data-shift-close>Fermer</button></div>`;
  } catch (ex) { send.disabled = false; send.textContent = "📨 Envoyer mon avis"; alert("Non envoyé, vérifiez la connexion."); }
});

async function toggleDuty(quiet) {
  if (duty.watch != null) {
    navigator.geolocation.clearWatch(duty.watch);
    duty.watch = null;
    if (duty.wakeLock) { duty.wakeLock.release().catch(() => {}); duty.wakeLock = null; }
  } else {
    if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur ce téléphone.");
    duty.fresh = true; duty.lastSent = 0; duty.since = Date.now() - 5000;
    duty.watch = navigator.geolocation.watchPosition(sendPosition, err => {
      $("#dutyText").textContent = err.code === 1 ? "⚠️ Autorisez la localisation pour ce site." : "⚠️ Position GPS introuvable pour le moment…";
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    try { if (navigator.wakeLock) duty.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* facultatif */ }
  }
  // En ligne / hors ligne pour HOP : seules les personnes en ligne reçoivent des courses
  duty.onlineP = Store.setOnline(duty.watch != null).then(() => { if (duty.watch == null) load(); }).catch(() => {});
  // Notification « En service » qui reste affichée : on peut passer sur Waze et revenir en un geste
  UI.dutyNotice(duty.watch != null, DUTY_TEXT, !quiet);
  if (duty.watch != null && !quiet) hopBurst();
  // Il termine son service lui-même : le bilan et l'avis rapide (après la mise à jour des courses)
  if (duty.watch == null && !quiet && duty.since) { const since = duty.since; duty.onlineP.then(() => setTimeout(() => openShift(since), 600)); }
  try { localStorage.setItem("livraison.online.v1", duty.watch != null ? "1" : ""); } catch (e) { /* ignore */ }
  renderDuty();
}

// --- Démarrage ------------------------------------------------------------------
let pollTimer;
// En direct : toutes les 5 s quand une course est proposée ou en cours, sinon toutes les 15 s ;
// et tout de suite quand une notification arrive (paiement, annulation, nouvelle course…)
function livePoll() {
  clearTimeout(pollTimer);
  const hot = mine().length || pool().length || offerShown || refunds.length;
  // Une réponse du client est attendue (heure, attente, paiement) : toutes les 2 s, pour la voir tout de suite
  const waiting = mine().some(o => o.eta_status === "attente" || o.wait_ann_status === "attente" || (o.direct_pay && o.payment_status !== "paye" && o.status === "recuperee"));
  pollTimer = setTimeout(async () => { await load(); livePoll(); }, waiting ? 2000 : hot ? 5000 : 15000);
}
// Notification touchée : la conversation ou la course dont elle parle s'ouvre
function openFromNotif(url) {
  let tag = "";
  try { tag = new URL(url, location.href).searchParams.get("tag") || ""; } catch (e) { return; }
  if (!tag || !me) return;
  history.replaceState(null, "", location.pathname);
  const m = tag.match(/^m-(.+)$/);
  if (m && m[1] === "c:" + me.id) return openBossChat();
  const id = m ? (m[1].match(/^o:(.+)$/) || [])[1] : (tag.match(/^(?:o|pay|refund)-(.+)$/) || [])[1];
  const o = id && orders.find(x => x.id === id);
  if (m && o) return openOrderChat(o);
  if (!o && !m) return alert("Cette course n'est plus disponible : un autre livreur l'a prise, ou elle a été annulée.");
  if (o && o.courier_id === me.id && o.status === "livree") {
    // Course déjà livrée : sa fiche dans « Mes dernières courses livrées », ouverte
    openFolds.add("d:" + o.id); openPage("mine"); render();
    return setTimeout(() => { const el = document.querySelector(`[data-fold="d:${CSS.escape(o.id)}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 300);
  }
  if (o && o.courier_id === me.id) { openPage("mine"); setTimeout(() => { const el = document.querySelector(`.mine-card[data-id="${CSS.escape(id)}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 300); }
  else if (o) openPage("pool");
}
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
  if (e.data && e.data.hop === "refresh" && me) load();
  if (e.data && e.data.hop === "open" && me) load().then(() => openFromNotif(e.data.url));
});
renderWelcome();
document.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => showAuth(b.dataset.auth)));
$("#signupForm").addEventListener("submit", onSignup);
$("#signupForm [name=topcase]").addEventListener("change", onTopcasePicked);
$("#waitTopcaseFile").addEventListener("change", onWaitTopcase);
$("#loginForm").addEventListener("submit", onLogin);
// Se déconnecter termine aussi le service : plus de courses proposées, plus visible sur la carte
async function endAndLogout() {
  clearTimeout(pollTimer);
  if (duty.watch != null) toggleDuty(true);
  await Store.setOnline(false).catch(() => {});
  try { localStorage.setItem("livraison.online.v1", ""); } catch (e) { /* ignore */ }
  UI.dutyNotice(false);
  Store.logout(); route();
}
$("#logoutBtn").addEventListener("click", e => { e.preventDefault(); endAndLogout(); });
// De retour dans HOP! (après Waze) : position tout de suite et notification « En service » remise
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (duty.watch == null) return UI.dutyNotice(false);
  // D'abord : HOP! nous a-t-il passé hors ligne pendant ce temps ? (sinon on afficherait « Vous recevez les courses » à tort)
  const card = await Store.me().catch(() => null);
  if (card) { me = card; serverWentOffline(card); }
  if (duty.watch == null) return;
  duty.lastSent = 0;
  navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  UI.dutyNotice(true, DUTY_TEXT);
});
$("#waitRefresh").addEventListener("click", route);
$('#drawerNav [data-tab="ref"]').classList.toggle("hidden", !refOn());
$("#drawerNav").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]");
  if (b) { closeDrawer(); openPage(b.dataset.tab); }
});
$("#menuBtn").addEventListener("click", () => $("#drawer").classList.remove("hidden"));
// Bouton « retour » du téléphone : il ferme ce qui est ouvert (conversation, fenêtre, menu, page)
// et ne fait jamais sortir de l'espace livreur (pas de retour sur l'accueil client)
history.replaceState({ hop: "base" }, "");
history.pushState({ hop: "stay" }, "");
window.addEventListener("popstate", () => {
  history.pushState({ hop: "stay" }, "");
  const pick = document.querySelector(".chat-modal:not(.chat-wrap)");
  if (pick) return pick.remove();
  const chat = document.querySelector(".chat-wrap:not(.hidden) .chat-x");
  if (chat) return chat.click();
  if (!$("#msgModal").classList.contains("hidden")) return $("#msgClose").click();
  if (!$("#autoOffModal").classList.contains("hidden")) return $("#autoOffClose").click();
  if (!$("#drawer").classList.contains("hidden")) return closeDrawer();
  if (!$("#page").classList.contains("hidden")) return closePage();
});
$("#drawer").addEventListener("click", e => { if (e.target.id === "drawer") closeDrawer(); });
$("#bellBtn").addEventListener("click", () => openPage("inbox"));
$("#pageBack").addEventListener("click", closePage);
$("#drawerLogout").addEventListener("click", () => { if (confirm("Se déconnecter ?")) endAndLogout(); });
$("#locateBtn").addEventListener("click", locateMe);
$("#installCard").addEventListener("click", e => {
  if (e.target.closest("[data-install-card]")) UI.installApp("HOP! Livreur", "livreur/").then(ok => { if (ok) showInstallCard(false); });
});
$("#sheet").addEventListener("click", e => {
  if (e.target.closest("[data-sheet-up]")) setSheetState("expanded");
  else if (e.target.closest("[data-sheet-down]")) setSheetState("normal");
});
$("#sheetBody").addEventListener("click", async e => {
  if (await onRefundClick(e)) return;
  if (e.target.closest("[data-install]")) return UI.installApp("HOP! Livreur", "livreur/").then(ok => { if (ok) renderHome(); });
  const b = e.target.closest("[data-tab]");
  if (b) openPage(b.dataset.tab);
});
initSlider();
initSheetDrag();
$("#view").addEventListener("click", onViewClick);
$("#view").addEventListener("change", e => {
  // Pièce d'identité vérifiée (tabac / alcool) : le bouton « Livré » s'ouvre, et c'est gardé sur la course
  if (e.target.dataset.idcheck) {
    const id = e.target.dataset.idcheck;
    if (e.target.checked) { idChecked.add(id); Store.courierIdChecked(id).catch(() => {}); } else idChecked.delete(id);
    return render();
  }
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
