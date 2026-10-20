// ============================================================================
// Fonctions partagées : formatage, liens (WhatsApp, Waze, Maps), texte d'une course.
// ============================================================================

(function () {
"use strict";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loc() { return window.I18N && I18N.lang === "he" ? "he-IL" : "fr-FR"; }

function money(n) {
  return (Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " " + CONFIG.currency;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", timeZone: CONFIG.timezone });
}
function fmtDateTime(iso) { return fmtDay(iso) + " · " + fmtTime(iso); }
// Clé de jour AAAA-MM-JJ dans le fuseau de l'entreprise
function dayKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: CONFIG.timezone });
}

function intlPhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = CONFIG.phoneCountryPrefix + d.slice(1);
  return d;
}
function waLink(phone, text) {
  return "https://wa.me/" + intlPhone(phone) + "?text=" + encodeURIComponent(text);
}
// Lien WhatsApp sans destinataire : l'utilisateur choisit le contact
// Notes des clients : moyenne et nombre d'avis d'une liste de courses
function ratingOf(list) {
  const r = (list || []).filter(o => o.rating != null);
  return r.length ? { avg: r.reduce((x, o) => x + Number(o.rating), 0) / r.length, n: r.length } : null;
}
const RATING_FR = { fast: "Rapide", nice: "Sympa", care: "Soigneux", found: "Bien trouvé", late: "En retard", damaged: "Colis abîmé", rude: "Pas aimable", lost: "Colis perdu" };
function ratingText(o) {
  return o.rating == null ? "" : "⭐".repeat(o.rating) + ` ${o.rating}/5` + ((o.rating_tags || []).length ? " · " + o.rating_tags.map(x => RATING_FR[x] || x).join(", ") : "");
}
// Barème d'attente / d'achats en clair (patron, livreurs)
function waitRule(st) {
  return `${st.wait_free_min} min offertes, puis +${money(st.wait_step_price)} par ${st.wait_step_min} min (max ${money(st.wait_max)})`;
}
// Fond de carte OpenStreetMap (gratuit, sans clé) ; version sombre par un filtre sur les tuiles
function mapTiles(map, dark) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap", className: dark ? "tiles-dark" : "" }).addTo(map);
}
function waShare(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
function placeQuery(o, which) {
  const brand = o[which + "_place"];
  return (brand ? brand + ", " : "") + (which === "pickup" ? `${o.pickup_address}, ${cityFr(o.from_city)}` : `${o.dropoff_address}, ${cityFr(o.to_city)}`);
}
// Adresse choisie sur la carte : on navigue vers ses coordonnées exactes
function exactPoint(o, which) {
  return o[which + "_exact"] && o[which + "_lat"] != null ? `${o[which + "_lat"]},${o[which + "_lon"]}` : null;
}
function wazeLink(o, which) {
  const ll = exactPoint(o, which);
  return ll ? `https://waze.com/ul?ll=${ll}&navigate=yes` : "https://waze.com/ul?navigate=yes&q=" + encodeURIComponent(placeQuery(o, which));
}
function mapsLink(o, which) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(exactPoint(o, which) || placeQuery(o, which));
}

function cityFr(id) {
  const c = CONFIG.cities.find(x => x.id === id);
  return c ? c.fr : id;
}

// Adresse de base de l'app (pour les liens de suivi et de partage)
// Zone d'une ville (Sharon par défaut) et zone ouverte ou « bientôt »
function cityZone(id) { const c = CONFIG.cities.find(x => x.id === id); return (c && c.zone) || "sharon"; }
function cityActive(id) {
  if (!CONFIG.cities.some(x => x.id === id)) return true;  // autre ville tapée : vérifiée par l'adresse
  const z = (CONFIG.zones || []).find(x => x.id === cityZone(id));
  return !z || z.active !== false;
}

// --- Notifications : par le service worker (seule façon qui marche sur Android), sinon classiques -------
const swReady = "serviceWorker" in navigator && location.protocol !== "file:"
  ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null) : Promise.resolve(null);
async function notify(title, opts) {
  if (!window.Notification || Notification.permission !== "granted") return false;
  const o = Object.assign({ icon: "icon-192.png", badge: "badge-96.png", data: { url: location.href } }, opts || {});
  try {
    const reg = await swReady;
    if (reg && reg.showNotification) { await reg.showNotification(title, o); return true; }
    new Notification(title, o);
    return true;
  } catch (e) { return false; }
}
// Notifications push (même quand HOP! est fermé) : on abonne ce téléphone au compte connecté.
// Rien à faire si les alertes ne sont pas autorisées, en mode démo ou sans clé (config.js).
let pushDone = false;
async function pushSubscribe() {
  const key = CONFIG.push && CONFIG.push.publicKey;
  if (pushDone || !key || !window.Notification || Notification.permission !== "granted" || !Store.ONLINE || !Store.session()) return false;
  try {
    const reg = await swReady;
    if (!reg || !reg.pushManager) return false;
    const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
    const appKey = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    const j = sub.toJSON();
    pushDone = !!(await Store.pushSubscribe(j.endpoint, j.keys.p256dh, j.keys.auth));
    return pushDone;
  } catch (e) { return false; }
}
// Retour du lien « Mot de passe oublié » : on demande le nouveau mot de passe
async function askNewPassword() {
  for (;;) {
    const pw = prompt("Choisissez votre nouveau mot de passe (6 caractères minimum) :");
    if (pw == null) return false;
    if (pw.length < 6) { alert("6 caractères minimum."); continue; }
    try { await Store.setPassword(pw); alert("✅ Mot de passe changé."); return true; }
    catch (e) { alert("Impossible de changer le mot de passe : " + e.message); return false; }
  }
}
// « Mot de passe oublié ? » sous un formulaire de connexion (email dans le champ name=email)
function forgotLink(form, errEl) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-link btn-sm forgot-link";
  b.textContent = "Mot de passe oublié ?";
  b.addEventListener("click", async () => {
    const email = form.elements.email.value.trim();
    const show = (msg, ok) => { errEl.textContent = msg; errEl.className = ok ? "notice" : "notice err"; };
    if (!email) { show("Écrivez votre email ci-dessus, puis touchez « Mot de passe oublié ? »."); form.elements.email.focus(); return; }
    b.disabled = true;
    try { await Store.resetPassword(email); show("📧 Si un compte existe avec " + email + ", un lien pour changer le mot de passe vient d'être envoyé (regardez aussi les spams).", true); }
    catch (e) { show("Envoi impossible : " + e.message); }
    finally { b.disabled = false; }
  });
  form.appendChild(b);
}
// « En service » : une notification qui reste dans la barre tant que le service est en cours
async function dutyNotice(on, text) {
  // iPhone : la permission doit être demandée tout de suite, dans le geste (avant toute attente)
  const ask = on && window.Notification && Notification.permission === "default" ? Notification.requestPermission().catch(() => null) : null;
  if (!on) {
    const reg = await swReady.catch(() => null);
    if (reg && reg.getNotifications) (await reg.getNotifications({ tag: "hop-duty" })).forEach(n => n.close());
    return;
  }
  if (ask) await ask;
  pushSubscribe();
  return notify("🟢 HOP! · En service", { body: text || "Vous recevez les courses. Touchez ici pour revenir dans HOP!.", tag: "hop-duty",
    requireInteraction: true, silent: true, renotify: false });
}

// Installer l'appli sur l'écran d'accueil (icône propre à chaque espace : client, LIVREUR, PATRON)
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
function isStandalone() {
  return !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
}
// Ouvert dans la fenêtre de l'appli client HOP! (on y arrive par le bouton 🛵) : pas l'appli Livreur/Patron
let appKind = null;
try { appKind = sessionStorage.getItem("hop.app"); } catch (e) { /* ignore */ }
function inOwnApp() { return isStandalone() && appKind !== "client"; }
function markClientApp() { if (isStandalone()) { appKind = "client"; try { sessionStorage.setItem("hop.app", "client"); } catch (e) { /* ignore */ } } }
async function installApp(appName, path) {
  const url = CONFIG.siteUrl + (path || "");
  // Dans l'appli client, on ne peut pas installer une autre appli : il faut l'adresse dans Chrome
  if (isStandalone() && appKind === "client") {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    alert(`Pour installer « ${appName} » (son icône à part) : ouvrez Chrome, collez l'adresse ${url} (déjà copiée), puis menu ⋮ → « Installer l'application ».`);
    return false;
  }
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null;
    return !!(r && r.outcome === "accepted");
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  alert(ios
    ? `Sur iPhone, dans Safari : touchez Partager ⬆️ en bas de l'écran, puis « Sur l'écran d'accueil ». L'icône « ${appName} » apparaît sur votre téléphone, et les alertes marchent.`
    : `Dans Chrome, à l'adresse ${url} : menu ⋮ → « Installer l'application ». L'icône « ${appName} » apparaît avec vos applis.\n\nSi Chrome dit « déjà installée », c'est l'ancienne icône HOP! : supprimez-la, rechargez la page, puis réessayez.`);
  return false;
}

// iPhone : alertes, notification « En service » et son ne marchent que si HOP! est sur l'écran d'accueil.
// On l'explique une fois (bandeau à fermer), seulement sur iPhone et dans le navigateur.
function iosInstallHint(appName) {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  let seen = false; try { seen = localStorage.getItem("livraison.iosHint.v1") === "1"; } catch (e) { /* ignore */ }
  if (!ios || standalone || seen || document.getElementById("iosHint")) return;
  const d = document.createElement("div");
  d.id = "iosHint"; d.className = "ios-hint";
  d.innerHTML = `<div><b>📲 Sur iPhone : installez ${esc(appName || "HOP!")}</b><span>Touchez <b>Partager</b> <i>⬆️</i> puis <b>« Sur l'écran d'accueil »</b>, et ouvrez HOP! depuis l'icône : vous recevrez les alertes de courses et la notification « En service ».</span></div><button type="button" aria-label="Fermer">✕</button>`;
  d.querySelector("button").onclick = () => { d.remove(); try { localStorage.setItem("livraison.iosHint.v1", "1"); } catch (e) { /* ignore */ } };
  document.body.appendChild(d);
}

// Lien à partager : toujours vers l'adresse officielle (sauf en test sur l'ordinateur)
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
function appUrl(page) { return new URL(page || "./", CONFIG.siteUrl && !LOCAL ? CONFIG.siteUrl : location.href).href; }
function trackUrl(o) { return appUrl("suivi.html") + "?t=" + o.token; }

const SERVICE_FR = { colis: "Envoi de colis", retrait: "Retrait de colis", achat: "Achat pour le client", repas: "Repas / restaurant" };
const PLACE_FR = { poste: "Bureau de poste", superpharm: "Super-Pharm", relais: "Point relais", locker: "Casier / locker", autre: "Magasin" };
const DOC_FR = { avis: "📨 Avis / SMS", identite: "🪪 Carte d'identité", procuration: "✍️ Procuration signée", rdv: "📅 Rendez-vous à la poste" };

// Carte d'un commerce HOP! Pro : accueil des clients (« Nos partenaires ») et aperçu dans l'espace du commerce
const KIND_ICON = { restaurant: "🍔", boutique: "🛍️", pharmacie: "💊", bureau: "💼", autre: "🏪" };
const safeImg = s => (typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : "");
function proCard(s, o) {
  const cover = safeImg(s.cover), logo = safeImg(s.logo);
  const initials = String(s.name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return `<button type="button" class="pro-card pk-${esc(s.kind || "autre")}" data-pro="${esc(s.code || "")}">
    <span class="pc-cover"${cover ? ` style="background-image:url(${cover})"` : ""}>${cover ? "" : `<i>${KIND_ICON[s.kind] || "🏪"}</i>`}</span>
    <span class="pc-logo">${logo ? `<img src="${logo}" alt="" />` : esc(initials)}</span>
    <span class="pc-body"><b>${esc(s.name)}</b><small>${esc(s.tagline || o.kindLabel || "")}</small>
      <span class="pc-tags"><em>🛵 ${esc(o.delivery)}</em>${o.menu ? `<em>${esc(o.menu)}</em>` : ""}<em class="pc-go">${esc(o.go || "")}</em></span></span>
  </button>`;
}

// Photo d'un document (avis, carte d'identité…) : assez nette pour être lue au guichet, assez légère pour la base
function docPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      for (const [max, q] of [[1600, 0.7], [1400, 0.62], [1200, 0.58], [1000, 0.52], [800, 0.5]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", q);
        if (data.length < 390000) return resolve(data);
      }
      reject(new Error("too_big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
// Les documents d'une course en grand (patron, livreur au guichet)
function photoViewer(title, items) {
  const d = document.createElement("div");
  d.className = "photo-viewer";
  d.innerHTML = `<div class="pv-head"><b>${esc(title)}</b><button type="button" class="btn btn-sm" data-pv-close>✕</button></div>
    ${items.length ? items.map(x => `<figure><figcaption>${esc(x.label)}</figcaption><img src="${esc(x.src)}" alt="" /></figure>`).join("")
      : `<p class="muted">Aucun document reçu pour l'instant.</p>`}`;
  d.addEventListener("click", e => { if (e.target.closest("[data-pv-close]") || e.target === d) d.remove(); });
  document.body.appendChild(d);
}
const SIZE_FR = { petit: "Petit colis", moyen: "Colis moyen (5–15 kg)", gros: "Gros colis (15–30 kg)" };
const PAY_FR = { cash: "💵 Espèces", bit: "📱 Bit / PayBox", carnet: "🎟️ Carnet pro" };

function whenFr(o) {
  if (o.urgency === "express") return "⚡ EXPRESS : priorité, au départ tout de suite";
  if (o.urgency === "asap") return "Dès que possible : au départ dans les 10 min";
  return new Date(o.pickup_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
}

// Texte complet d'une course pour le coursier (WhatsApp, agenda)
function orderText(o) {
  const L = [`📦 Commande ${o.ref} — ${SERVICE_FR[o.service]}`, `🕐 ${whenFr(o)}`, ``];
  L.push(`📍 ${o.service === "retrait" ? PLACE_FR[o.place_kind] || "Récupération" : "Récupération"} : ${o.pickup_place ? "🏪 " + o.pickup_place + ", " : ""}${o.pickup_address}, ${cityFr(o.from_city)}`);
  if (addrDetailsText(o, "pickup")) L.push(`   🏢 ${addrDetailsText(o, "pickup")}`);
  if (o.pickup_note) L.push(`   📝 ${o.pickup_note}`);
  if (o.pickup_contact || o.pickup_phone) L.push(`   ${[o.pickup_contact, o.pickup_phone].filter(Boolean).join(" · ")}`);
  if (o.service === "retrait") {
    if (o.tracking_number) L.push(`   N° : ${o.tracking_number}`);
    if (o.parcel_name) L.push(`   Au nom de : ${o.parcel_name}`);
    if (o.appt_at) L.push(`   Rendez-vous à la poste : ${fmtDateTime(o.appt_at)}`);
    if (o.place_kind === "poste") L.push(`   Procuration : ${o.has_proxy ? "oui" : "NON"}`);
  }
  if (o.service === "achat") {
    if (o.shopping_list) L.push(`   🛒 À acheter : ${o.shopping_list}`);
    if (o.budget) L.push(`   Budget : ${money(o.budget)} (avancé, remboursé à la livraison)`);
  }
  L.push(`🏁 Livraison : ${o.dropoff_place ? "🏪 " + o.dropoff_place + ", " : ""}${o.dropoff_address}, ${cityFr(o.to_city)}`);
  if (addrDetailsText(o, "dropoff")) L.push(`   🏢 ${addrDetailsText(o, "dropoff")}`);
  if (o.dropoff_note) L.push(`   📝 ${o.dropoff_note}`);
  if (o.leave_at_door) L.push(`   🚪 DÉPOSER DEVANT LA PORTE (sans contact) + photo au client`);
  if (o.dropoff_contact || o.dropoff_phone) L.push(`   ${[o.dropoff_contact, o.dropoff_phone].filter(Boolean).join(" · ")}`);
  L.push(``, `${SIZE_FR[o.size] || o.size}${o.round_trip ? " · aller-retour" : ""}${o.extra_stops ? ` · +${o.extra_stops} arrêt(s)` : ""}`);
  if (o.notes) L.push(`📝 ${o.notes}`);
  L.push(``, `💰 ${money(o.price)} — ${PAY_FR[o.payment_method] || ""} — payé par ${o.payer === "destinataire" ? "le destinataire" : "le client"}${o.prepaid_required ? " — 💳 À PAYER D'AVANCE" : ""}`);
  if (o.promo_code) L.push(`🎁 ${o.promo_code} (-${money(o.discount || 0)})`);
  L.push(`👤 ${o.contact_name}${o.company ? " (" + o.company + ")" : ""} — ${o.contact_phone}`);
  if (o.token) L.push(``, `Suivi : ${trackUrl(o)}`);
  return L.join("\n");
}

function referralCode(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 4 ? CONFIG.promos.referral.prefix + d.slice(-4) : "";
}

// Message WhatsApp au client selon le statut de sa course, dans SA langue
// Nom de la marque en haut des pages clients : « HOP! » + « Livraison » (ou « Pro »)
function wordmark(sub) {
  const he = window.I18N && I18N.lang === "he";
  const small = sub || (he ? "משלוחים" : "Livraison");
  return `<b>${he ? "הופ" : "HOP"}<i>!</i></b><small>${esc(small)}</small>`;
}

// Minutes avant la livraison (position du livreur connue), sinon null.
// Course acceptée : trajet jusqu'au départ + 5 min sur place + trajet jusqu'à l'arrivée.
function deliveryEta(o) {
  if (!o) return null;
  // HOP! Pro : commande en préparation → l'heure annoncée par le commerce + le trajet
  const readyIn = o.ready_at && ["acceptee", "prete"].includes(o.shop_status) && ["nouvelle", "confirmee"].includes(o.status)
    ? Math.max(0, Math.ceil((new Date(o.ready_at) - Date.now()) / 60000)) : 0;
  if (readyIn > 0 && o.pickup_lat != null && o.dropoff_lat != null) {
    const p = { lat: Number(o.pickup_lat), lon: Number(o.pickup_lon) }, d = { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) };
    return readyIn + Pricing.etaMinutes(p, d);
  }
  if (o.courier_lat == null || o.dropoff_lat == null) return null;
  const c = { lat: Number(o.courier_lat), lon: Number(o.courier_lon) }, d = { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) };
  if (o.status === "recuperee") return Pricing.etaMinutes(c, d);
  if (o.status === "confirmee" && o.pickup_lat != null) {
    const p = { lat: Number(o.pickup_lat), lon: Number(o.pickup_lon) };
    return Pricing.etaMinutes(c, p) + 5 + Pricing.etaMinutes(p, d);
  }
  return null;
}
// Avancement de la course pour l'anneau (0 à 1)
const PROGRESS = { nouvelle: 0.12, confirmee: 0.4, recuperee: 0.72, livree: 1 };

// Commission HOP d'une course de livreur : 12 % du prix, au moins 3 ₪ (voir config.js)
function commissionText() { return `${CONFIG.platform.commissionPercent} % du prix (au moins ${money(CONFIG.platform.commissionPerCourse)})`; }
function networkText() { return `${CONFIG.platform.networkPercent} % (au moins ${money(CONFIG.platform.networkMin)})`; }

// Numéro Bit à payer : toujours celui de HOP (le livreur n'encaisse que les espèces)
// Paiement direct : on paie le livreur sur son numéro (Bit ou PayBox) ; avant, c'était le Bit de HOP
function bitFor(o) { return o && o.direct_pay ? o.courier_bit || "" : CONFIG.bitPhone; }

// Payer par Bit tout de suite : montant, numéro, n° de commande, « Ouvrir Bit », « Copier », « J'ai payé »
// (sur Android, le bouton ouvre l'application Bit ; sur iPhone, on copie le numéro puis on ouvre Bit)
const ANDROID = /Android/i.test(navigator.userAgent);
const BIT_APP = "intent://#Intent;package=com.bnhp.payments.paymentsapp;S.browser_fallback_url="
  + encodeURIComponent("https://play.google.com/store/apps/details?id=com.bnhp.payments.paymentsapp") + ";end";
function bitPay(o) {
  const t = (k, v) => I18N.t(k, v);
  const name = String(o.courier_name || "").split(" ")[0];
  if (o.client_paid_at) return `<p class="promo-msg ok bit-pay">${esc(o.direct_pay ? t("bpThanksCourier", { name }) : t("bpThanks"))}</p>`;
  const phone = bitFor(o);
  // Paiement au livreur : son numéro n'est connu qu'une fois la course acceptée
  if (o.direct_pay && !phone) return `<p class="bit-pay muted">${esc(t("bpWaitCourier", { total: money(o.price) }))}</p>`;
  return `<div class="bit-pay">
    <p>${esc(o.direct_pay ? t("bpSendCourier", { total: money(o.price), name, phone, ref: o.ref }) : t("bpSend", { total: money(o.price), phone, ref: o.ref }))}</p>
    <div class="bit-btns">
      ${ANDROID ? `<a class="btn btn-sm btn-bit" href="${BIT_APP}">${esc(t("bpOpen"))}</a>` : ""}
      <button type="button" class="btn btn-sm" data-bit-copy="${esc(String(phone).replace(/\D/g, ""))}">${esc(t("bpCopy"))}</button>
      <button type="button" class="btn btn-sm btn-primary" data-bit-paid="${esc(o.token)}" data-name="${esc(o.direct_pay ? name : "")}" data-total="${esc(money(o.price))}">${esc(t("bpPaid"))}</button>
    </div>
  </div>`;
}
document.addEventListener("click", async e => {
  const c = e.target.closest("[data-bit-copy]");
  if (c) {
    const done = () => { c.textContent = I18N.t("bpCopied"); };
    if (navigator.clipboard) navigator.clipboard.writeText(c.dataset.bitCopy).then(done, done); else done();
    return;
  }
  const p = e.target.closest("[data-bit-paid]");
  if (!p) return;
  // « J'ai payé » n'est pas une preuve : on fait confirmer, et le livreur vérifie sur son Bit / PayBox
  if (!confirm(I18N.t("bpConfirm", { total: p.dataset.total || "", name: p.dataset.name || "HOP!" }))) return;
  p.disabled = true;
  const ok = await Store.clientPaid(p.dataset.bitPaid).catch(() => false);
  const box = p.closest(".bit-pay");
  if (ok && box) box.outerHTML = `<p class="promo-msg ok bit-pay">${esc(p.dataset.name ? I18N.t("bpThanksCourier", { name: p.dataset.name }) : I18N.t("bpThanks"))}</p>`;
  else p.disabled = false;
});

function clientMessage(o) {
  const l = o.lang || "fr";
  const f = (k, v) => I18N.forLang(l, k, v);
  const city = id => { const c = CONFIG.cities.find(x => x.id === id); return c ? c[l] || c.fr : id; };
  const when = o.urgency === "programmee" ? f("msg_when_at", { when: whenFr(o) }) : f("msg_when_asap");
  const pay = o.payment_method === "carnet" ? f("pay_carnet")
    : o.direct_pay ? f("pay_direct_short") : o.payment_method === "bit" ? f("pay_bit_short", { phone: bitFor(o) }) : f("pay_cash_short");
  const msg = f("msg_" + o.status, {
    name: o.contact_name || "", ref: o.ref, when, price: money(o.price), pay, reason: o.admin_note || "",
    url: o.status === "refusee" ? appUrl() + "#commander" : trackUrl(o),
    to: `${o.dropoff_address}, ${city(o.to_city)}`, code: referralCode(o.contact_phone)
  });
  return receiptNo(o) ? msg + "\n" + f("msg_receipt", { url: receiptUrl(o) }) : msg;
}

function receiptUrl(o) { return appUrl("recu.html") + "?t=" + o.token; }
// Une course a un reçu : de HOP (ses propres courses) ou du livreur (paiement direct)
const receiptNo = o => o.receipt_number || o.courier_receipt_number || null;
function topupReceiptUrl(t) { return appUrl("recu.html") + "?k=" + t.token; }
function carnetReceiptUrl(sale) { return appUrl("recu.html") + "?c=" + sale.token; }

// Semaines (dimanche → samedi) sur des clés de jour AAAA-MM-JJ
function weekStart(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function fmtKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
}

// Étage / appartement / code d'une adresse, en texte (pour WhatsApp et l'agenda)
const KIND_FR = { maison: "maison", appartement: "appartement", bureau: "bureau", commerce: "commerce" };
function addrDetailsText(o, which) {
  const p = [];
  if (o[which + "_kind"]) p.push(KIND_FR[o[which + "_kind"]] || o[which + "_kind"]);
  if (o[which + "_building"]) p.push(`bâtiment ${o[which + "_building"]}`);
  if (o[which + "_floor"]) p.push(`étage ${o[which + "_floor"]}`);
  if (o[which + "_apt"]) p.push(`appt ${o[which + "_apt"]}`);
  if (o[which + "_code"]) p.push(`code ${o[which + "_code"]}`);
  return p.join(" · ");
}
function addrDetails(o, which, lang) {
  const t = k => window.I18N ? I18N.forLang(lang || "fr", k) : k;
  const p = [];
  if (o[which + "_kind"]) p.push(`<span><b>${esc(t("kind_" + o[which + "_kind"]))}</b></span>`);
  if (o[which + "_building"]) p.push(`<span><small>${esc(t("building"))}</small><b>${esc(o[which + "_building"])}</b></span>`);
  if (o[which + "_floor"]) p.push(`<span><small>${esc(t("floor"))}</small><b>${esc(o[which + "_floor"])}</b></span>`);
  if (o[which + "_apt"]) p.push(`<span><small>${esc(t("apt"))}</small><b>${esc(o[which + "_apt"])}</b></span>`);
  if (o[which + "_code"]) p.push(`<span><small>${esc(t("entryCode"))}</small><b dir="ltr">${esc(o[which + "_code"])}</b></span>`);
  return p.length ? `<div class="addr-details">${p.join("")}</div>` : "";
}
// Arrêts en plus, entre le départ et l'arrivée (avec lien Waze quand l'adresse est sur la carte)
const STOP_DO_FR = { deposer: "📦 Déposer", recuperer: "📥 Récupérer", acheter: "🛒 Acheter" };
function stopsLegs(o, full) {
  const list = Array.isArray(o.stops) ? o.stops : [];
  return list.map((s, i) => `<div class="leg leg-stop"><span>📌</span><div><small>Arrêt ${i + 1} · ${esc(STOP_DO_FR[s.todo] || STOP_DO_FR.deposer)}${s.on_way ? " · sur le chemin" : ""}</small>
      <b>${full ? `<bdi>${esc(s.address || "")}</bdi>` : esc(s.city || "")}</b>${s.note ? `<div class="addr-note">📝 ${esc(s.note)}</div>` : ""}
      ${full && s.lat != null ? `<div class="links"><a class="btn btn-sm" href="https://waze.com/ul?ll=${encodeURIComponent(s.lat + "," + s.lon)}&navigate=yes" target="_blank" rel="noopener">Waze</a></div>` : ""}</div></div>`).join("");
}
function doorTag(o, lang) {
  return o.leave_at_door ? `<div class="door-tag">${esc(window.I18N ? I18N.forLang(lang || "fr", "doorTag") : "🚪")}</div>` : "";
}

// Remarque sur une adresse (étage, code…), affichée sous l'adresse
// Nom de l'enseigne (Super-Pharm, restaurant…) au-dessus de l'adresse
function brand(name) { return name ? `<span class="brand-tag">🏪 <bdi>${esc(name)}</bdi></span>` : ""; }
function addrNote(note) { return note ? `<div class="addr-note">📝 ${esc(note)}</div>` : ""; }

window.UI = {
  addrNote, brand, addrDetails, addrDetailsText, doorTag,
  DOC_FR, docPhoto, photoViewer, proCard, safeImg, KIND_ICON,
  deliveryEta, PROGRESS, commissionText, networkText, stopsLegs, notify, dutyNotice, iosInstallHint, cityZone, cityActive, receiptUrl, carnetReceiptUrl, receiptNo, topupReceiptUrl, referralCode, clientMessage, bitFor, bitPay, pushSubscribe, askNewPassword, forgotLink, installApp, isStandalone, inOwnApp, markClientApp, wordmark, weekStart, addDays, fmtKey,
  mapTiles, waitRule, ratingOf, ratingText, esc, money, placeQuery, fmtTime, fmtDay, fmtDateTime, dayKey, intlPhone, waLink, waShare, wazeLink, mapsLink,
  cityFr, appUrl, trackUrl, orderText, whenFr, SERVICE_FR, PLACE_FR, SIZE_FR, PAY_FR
};

})();
