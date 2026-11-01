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
// SMS prérempli (le numéro local, le texte) : marche sur Android et iPhone
function smsLink(phone, text) {
  return "sms:" + String(phone || "").replace(/[^\d+]/g, "") + "?&body=" + encodeURIComponent(text || "");
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
  return `${st.wait_free_min} min offertes, puis +${money(st.wait_step_price)} par ${Number(st.wait_step_min) === 1 ? "minute" : st.wait_step_min + " min"} (max ${money(st.wait_max)})`;
}
// Fond de carte OpenStreetMap (gratuit, sans clé) ; version sombre par un filtre sur les tuiles
// Fond de carte. Sans carrés vides quand on la déplace : les morceaux se chargent pendant le geste
// (et pas seulement au lâcher sur téléphone), on en garde une large réserve autour, et le fond
// sous la carte a la couleur de la carte (clair ou sombre) le temps qu'un morceau arrive.
function mapTiles(map, dark, fun) {
  // (le fond « coloré » de CARTO demande maintenant une clé payante : on garde OpenStreetMap, gratuit,
  // avec des couleurs plus vives sur la carte de l'accueil)
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap", className: dark ? "tiles-dark" : fun ? "tiles-fun" : "",
      updateWhenIdle: false, updateWhenZooming: false, keepBuffer: 6 }).addTo(map);
}
// Nuit ou jour à cet endroit, d'après le lever et le coucher du soleil (équation du lever du soleil,
// à une ou deux minutes près) : sert à passer le suivi en sombre la nuit et en clair le jour.
function isNight(lat, lon, when) {
  const R = Math.PI / 180, ms = when ? +when : Date.now();
  if (!isFinite(lat) || !isFinite(lon)) { lat = 32.33; lon = 34.86; }
  const n = Math.round(ms / 86400000 + 2440587.5 - 2451545 + 0.0008);
  const J = n - lon / 360, M = (357.5291 + 0.98560028 * J) % 360;
  const C = 1.9148 * Math.sin(M * R) + 0.02 * Math.sin(2 * M * R) + 0.0003 * Math.sin(3 * M * R);
  const lam = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + J + 0.0053 * Math.sin(M * R) - 0.0069 * Math.sin(2 * lam * R);
  const dec = Math.asin(Math.sin(lam * R) * Math.sin(23.44 * R));
  const cosW = (Math.sin(-0.833 * R) - Math.sin(lat * R) * Math.sin(dec)) / (Math.cos(lat * R) * Math.cos(dec));
  if (cosW > 1) return true; if (cosW < -1) return false;
  const w = Math.acos(cosW) / R / 360, toMs = jd => (jd - 2440587.5) * 86400000;
  return ms < toMs(transit - w) || ms > toMs(transit + w);
}
// Nouveau client livré : le lien « Vous avez été livré avec HOP! » et le message WhatsApp prêt à envoyer (dans sa langue)
function welcomeUrl(o) { return CONFIG.siteUrl + "app/bienvenue.html?t=" + encodeURIComponent(o.token || "") + (o.lang === "he" ? "&lang=he" : ""); }
function welcomeMsg(o) {
  const he = o.lang === "he", first = String(o.dropoff_contact || o.contact_name || "").trim().split(/\s+/)[0];
  const shop = o.shop_name ? bi(o.shop_name, he ? "he" : "fr") : "";
  return he
    ? `שלום${first ? " " + first : ""} 👋\nההזמנה שלכם${shop ? " מ" + shop : ""} נמסרה על ידי הופ! 🛵🧡\nהופ! זה פתרון המשלוחים שלכם בכל העיר: מסעדות, חנויות, קניות בסופר, חבילות, ניקוי יבש…\nכל הפרטים כאן 👉 ${welcomeUrl(o)}`
    : `Bonjour${first ? " " + first : ""} 👋\nVotre commande${shop ? " chez " + shop : ""} vous a été livrée par HOP! 🛵🧡\nHOP!, c'est votre solution de livraison dans toute la ville : restos, commerces, courses, colis, pressing…\nDécouvrez tout ici 👉 ${welcomeUrl(o)}`;
}
function waShare(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
// Patron : le WhatsApp « normal », pas WhatsApp Business, même quand Business est l'appli par défaut sur Android
// (lien intent:// vers com.whatsapp ; sans WhatsApp normal, le lien wa.me habituel)
function waPersonal(phone, text) {
  const web = phone ? waLink(phone, text || "") : waShare(text || "");
  if (!/Android/i.test(navigator.userAgent)) return web;
  const q = (phone ? "phone=" + intlPhone(phone) + "&" : "") + "text=" + encodeURIComponent(text || "");
  return `intent://send?${q}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}
// Achat « au plus proche » : on cherche ce type de magasin autour de l'adresse de livraison
const NEAR_HE = { pharm: "בית מרקחת", tabac: "פיצוציה", bakery: "מאפייה", shop: "מכולת", baby: "חנות תינוקות", pets: "חנות חיות", home: "כלי בית", gift: "חנות פרחים" };
function placeQuery(o, which) {
  if (which === "pickup" && o.pickup_near && o.pickup_lat == null) return `${NEAR_HE[o.pickup_near] || "חנות"} ${o.dropoff_address}, ${cityFr(o.to_city)}`;
  const brand = o[which + "_place"];
  return (brand ? brand + ", " : "") + (which === "pickup" ? `${o.pickup_address}, ${cityFr(o.from_city)}` : `${o.dropoff_address}, ${cityFr(o.to_city)}`);
}
// Adresse choisie sur la carte : on navigue vers ses coordonnées exactes
function exactPoint(o, which) {
  return o[which + "_exact"] && o[which + "_lat"] != null ? `${o[which + "_lat"]},${o[which + "_lon"]}` : null;
}
function wazeLink(o, which) {
  // (au plus proche : Waze cherche le type de magasin autour du client, le livreur choisit le plus proche ouvert)
  if (which === "pickup" && o.pickup_near && o.pickup_lat == null) return "https://waze.com/ul?q=" + encodeURIComponent(NEAR_HE[o.pickup_near] || "חנות")
    + (o.dropoff_lat != null ? `&ll=${o.dropoff_lat},${o.dropoff_lon}` : "");
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
// Zones ouvertes : celles que le patron a cochées (settings.zones_open), sinon « active » de config.js
let zonesOpen = null;
function setZonesOpen(list) { zonesOpen = Array.isArray(list) ? list.slice() : null; }
function zoneActive(zoneId) {
  if (zonesOpen) return zonesOpen.includes(zoneId);
  const z = (CONFIG.zones || []).find(x => x.id === zoneId);
  return !z || z.active !== false;
}
function cityActive(id) {
  if (!CONFIG.cities.some(x => x.id === id)) return true;  // autre ville tapée : vérifiée par l'adresse
  if (CONFIG.cities.some(x => x.id === id && x.closed)) return false;   // ville fermée à part (Holon)
  return zoneActive(cityZone(id));
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
// Client : notifications de sa course sur ce téléphone (livreur en route, livré), même appli fermée.
// ask = on demande l'autorisation (bouton touché) ; sinon seulement si elle est déjà donnée
async function clientPushSubscribe(token, ask) {
  const key = CONFIG.push && CONFIG.push.publicKey;
  if (!token || !key || !window.Notification || !Store.ONLINE) return false;
  try {
    if (Notification.permission === "default" && ask) await Notification.requestPermission();
    if (Notification.permission !== "granted") return false;
    const reg = await swReady;
    if (!reg || !reg.pushManager) return false;
    const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
    const appKey = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    const j = sub.toJSON();
    return !!(await Store.clientPushSubscribe(token, j.endpoint, j.keys.p256dh, j.keys.auth));
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
// « En service » : affichée une seule fois par passage en service (pas à chaque rechargement ni à chaque position) ;
// balayée, elle ne revient pas. Repasser hors ligne puis en ligne la remontre.
const DUTY_KEY = "hop.dutyShown." + location.pathname.split("/")[1];
async function dutyNotice(on, text, force) {
  // iPhone : la permission doit être demandée tout de suite, dans le geste (avant toute attente)
  const ask = on && window.Notification && Notification.permission === "default" ? Notification.requestPermission().catch(() => null) : null;
  if (!on) {
    try { localStorage.removeItem(DUTY_KEY); } catch (e) { /* ignore */ }
    const reg = await swReady.catch(() => null);
    if (reg && reg.getNotifications) (await reg.getNotifications({ tag: "hop-duty" })).forEach(n => n.close());
    return;
  }
  if (ask) await ask;
  pushSubscribe();
  let shown = false;
  try { shown = !!localStorage.getItem(DUTY_KEY); localStorage.setItem(DUTY_KEY, "1"); } catch (e) { /* ignore */ }
  if (shown && !force) return true;
  return notify("🟢 HOP! · En service", { body: text || "Vous recevez les courses. Touchez ici pour revenir dans HOP!.", tag: "hop-duty",
    requireInteraction: true, silent: true, renotify: false });
}

// Notifications déjà affichées qui ne servent plus (course prise, livrée, annulée, payée, message lu) : on les ferme.
// stale(kind, id) → true pour fermer ; kind = o, pay, refund, late, m (id = la conversation pour m)
async function clearNotifs(stale) {
  try {
    const reg = await swReady;
    if (!reg || !reg.getNotifications) return;
    (await reg.getNotifications()).forEach(n => {
      // (« hop-o-… » et « hop-chat » : anciennes notifications de l'appli ouverte, remplacées par celles-ci)
      if (n.tag === "hop-chat") return n.close();
      const m = String(n.tag || "").match(/^(?:hop-)?(o|pay|refund|late|m)-(.+)$/);
      if (m && stale(m[1], m[2])) n.close();
    });
  } catch (e) { /* ignore */ }
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

// Horaires d'un commerce [{ d: 0..6, h: "08:30-13:30,15:30-19:00" }] à l'heure d'Israël :
// { open: true, until: minutes } ou { open: false, inDays, day, at: minutes } (prochaine ouverture), null sans horaires
function openState(hours, at) {
  if (!Array.isArray(hours) || !hours.some(x => x && x.h)) return null;
  const now = new Date((at || new Date()).toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const m = now.getHours() * 60 + now.getMinutes(), day = now.getDay();
  const mins = v => { const [h, mm] = String(v).split(":").map(Number); return h * 60 + (mm || 0); };
  const ranges = d => { const x = hours.find(h => Number(h.d) === d);
    return x && x.h ? String(x.h).split(",").map(r => r.split("-")).filter(r => r.length === 2).map(([a, b]) => [mins(a), mins(b)]).sort((p, q) => p[0] - q[0]) : []; };
  const cur = ranges(day).find(([a, b]) => m >= a && m < b);
  if (cur) return { open: true, until: cur[1] };
  for (let k = 0; k < 8; k++) {
    const d = (day + k) % 7, r = ranges(d).find(([a]) => k > 0 || a > m);
    if (r) return { open: false, inDays: k, day: d, at: r[0] };
  }
  return { open: false };
}
const hhmmOf = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
// Horaires d'un commerce, à choisir dans des menus (espace commerce et panel patron) : par jour ouvert / fermé,
// heure d'ouverture et de fermeture, une 2e plage (coupure de midi), et deux raccourcis pour toute la semaine
const DAY_NAMES = { fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] };
const HOUR_CHOICES = Array.from({ length: 39 }, (_, i) => hhmmOf(300 + i * 30)).concat("24:00");   // 05:00 → minuit, toutes les 30 min
function hourSelect(k, v) {
  const list = v && !HOUR_CHOICES.includes(v) ? HOUR_CHOICES.concat(v).sort() : HOUR_CHOICES;
  return `<select data-fh="${k}">${list.map(h => `<option value="${h}"${h === v ? " selected" : ""}>${h === "24:00" ? esc(I18N.t("fiMidnight")) : h}</option>`).join("")}</select>`;
}
function hoursDay(i, h) {
  const r = String(h || "").split(",").filter(Boolean).map(x => x.split("-"));
  const [a, b] = r[0] || ["", ""], [c, d] = r[1] || ["", ""];
  return `<div class="fh-day${r.length ? " open" : ""}" data-day="${i}">
    <b>${esc((DAY_NAMES[I18N.lang] || DAY_NAMES.fr)[i])}</b>
    <label class="fh-switch"><input type="checkbox" data-fh-open${r.length ? " checked" : ""} /><i></i><small>${esc(I18N.t(r.length ? "fiOpen" : "fiClosed"))}</small></label>
    <span class="fh-times">${hourSelect("a", a || "08:30")}–${hourSelect("b", b || "19:00")}
      <span class="fh-2${c ? "" : " hidden"}">· ${hourSelect("c", c || "15:30")}–${hourSelect("d", d || "19:00")}</span>
      <button type="button" class="fh-add${c ? " hidden" : ""}" data-fh-add aria-label="+">＋ ${esc(I18N.t("fiBreak"))}</button></span>
  </div>`;
}
function hoursEditor(hours) {
  const list = Array.isArray(hours) ? hours : [];
  return `<div class="fh"><span class="fh-title">${esc(I18N.t("fiHours"))}</span>
    <div class="fh-presets"><button type="button" class="chip" data-fh-preset="copy">${esc(I18N.t("fiCopy"))}</button><button type="button" class="chip" data-fh-preset="week">${esc(I18N.t("fiWeek"))}</button></div>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => hoursDay(i, (list.find(x => Number(x.d) === i) || {}).h)).join("")}</div>`;
}
function setHoursDay(day, h) {
  const tmp = document.createElement("div");
  tmp.innerHTML = hoursDay(Number(day.dataset.day), h);
  day.replaceWith(tmp.firstElementChild);
}
function readHours(root) {
  return [...root.querySelectorAll(".fh-day")].map(day => {
    const v = k => day.querySelector(`[data-fh="${k}"]`).value;
    const on = day.querySelector("[data-fh-open]").checked, ranges = [];
    if (on && v("a") && v("b")) ranges.push(v("a") + "-" + v("b"));
    if (on && !day.querySelector(".fh-2").classList.contains("hidden") && v("c") && v("d")) ranges.push(v("c") + "-" + v("d"));
    return { d: Number(day.dataset.day), h: ranges.join(",") };
  });
}
// Une seule fois par page, sur le bloc qui contient les éditeurs d'horaires
function bindHours(root) {
  root.addEventListener("change", e => {
    const c = e.target.closest("[data-fh-open]");
    if (!c) return;
    const day = c.closest(".fh-day");
    day.classList.toggle("open", c.checked);
    day.querySelector(".fh-switch small").textContent = I18N.t(c.checked ? "fiOpen" : "fiClosed");
  });
  root.addEventListener("click", e => {
    const add = e.target.closest("[data-fh-add]");
    if (add) {
      const day = add.closest(".fh-day"), b = day.querySelector('[data-fh="b"]');
      day.querySelector(".fh-2").classList.remove("hidden"); add.classList.add("hidden");
      // Une coupure à midi : le matin finit à 13:30, l'après-midi reprend à 15:30
      if (b.value > "13:30") b.value = "13:30";
      day.querySelector('[data-fh="c"]').value = "15:30"; day.querySelector('[data-fh="d"]').value = "19:00";
      return;
    }
    const p = e.target.closest("[data-fh-preset]");
    if (!p) return;
    const box = p.closest(".fh"), days = [...box.querySelectorAll(".fh-day")];
    if (p.dataset.fhPreset === "copy") {
      const first = readHours(box)[0].h;
      days.slice(1).forEach(d => setHoursDay(d, first));
    } else days.forEach(d => setHoursDay(d, d.dataset.day === "6" ? "" : d.dataset.day === "5" ? "08:30-14:00" : "08:30-19:00"));
  });
}
// Date de la prochaine ouverture (sur ce téléphone, réglé à l'heure d'Israël)
function nextOpenDate(st, from) {
  if (!st || st.open || st.inDays == null) return null;
  const d = new Date(from || Date.now()); d.setDate(d.getDate() + st.inDays); d.setHours(Math.floor(st.at / 60), st.at % 60, 0, 0);
  return d;
}
const artImg = (k, h) => `<span class="item-art" style="--h:${h}"><img src="img/items/${k}.webp" alt="" loading="lazy" /></span>`;
// Catégorie (pharmacie, colis…) : avec le nouveau design (html.d2), l'icône 3D du kit, sinon l'illustration habituelle
const K2_CAT = ["pharm", "tabac", "bakery", "shop", "baby", "pets", "home", "gift", "pressing", "poste", "resto", "docs", "yad2", "keys", "ta"];
const catImg = (id, k, h) => document.documentElement.classList.contains("d2") && K2_CAT.includes(id)
  ? `<span class="item-art k2-art"><img src="img/k2/i-${id}.webp" alt="" loading="lazy" /></span>` : artImg(k, h);

// Article sans photo : une illustration qui lui ressemble (pressing, boulangerie, restaurant…) sur un fond coloré
const ITEM_ART = [
  [/tsitsit|ציצי/i, "tshirt", 200], [/repass|גיהוץ|iron/i, "necktie", 215], [/manteau|מעיל|veste|coat|jacket/i, "coat", 30], [/robe|שמל|dress/i, "dress", 220],
  [/chemise|חולצ|shirt/i, "tshirt", 140], [/pantalon|jean|מכנס/i, "jeans", 210], [/[ée]charpe|צעיף|scarf/i, "scarf", 350], [/blouse|jupe|חצאית/i, "blouse", 320],
  [/couverture|couette|duvet|drap|שמיכ|מצעים|סדינ/i, "bed", 250], [/tapis|שטיח|rug|carpet/i, "yarn", 205], [/à sec|a sec|יבש|dry/i, "bubbles", 290],
  [/poids|kilo|משקל|ק"ג/i, "scale", 45], [/lavage|linge|כביס|wash|laundry/i, "basket", 35], [/savon|סבון|soap/i, "soap", 320],
  [/cookie|biscuit|עוגיי/i, "cookie", 35], [/croissant|קרואסון|pain au chocolat|chocolatine/i, "croissant", 38], [/baguette|בגט/i, "baguette", 35], [/bagel|בייגל/i, "bagel", 30],
  [/pain|לחם|challah|חלה|bread/i, "bread", 35], [/anniversaire|יום הולדת|birthday/i, "bday", 330], [/cupcake|muffin|מאפין/i, "cupcake", 320],
  [/beignet|donut|doughnut|סופגני/i, "doughnut", 20], [/g[âa]teau|עוג|cake|tarte|פאי/i, "cake", 350], [/pancake|cr[êe]pe|פנקייק|קרפ/i, "pancakes", 40],
  [/caf[ée]|קפה|coffee|\bth[ée]\b|תה|latte|cappuccino/i, "coffee", 25], [/\bjus\b|מיץ|juice|smoothie|שייק/i, "juice", 100], [/pizza|פיצ/i, "pizza", 15],
  [/burger|בורגר/i, "burger", 25], [/salade|סלט|salad/i, "salad", 110], [/sushi|סושי|maki/i, "sushi", 5], [/falafel|פלאפל/i, "falafel", 80],
  [/shawarma|שווארמה|pita|פיתה|wrap|לאפה|laffa|sabich|סביח/i, "pita", 30], [/sandwich|כריך|טוסט|toast/i, "sandwich", 45], [/frites|צ'יפס|fries|chips/i, "fries", 0],
  [/glace|גליד|ice cream/i, "icecream", 40], [/\bvin\b|יין|wine/i, "wine", 330], [/poulet|עוף|chicken|שניצל|schnitzel/i, "chicken", 25],
  [/steak|viande|בשר|אנטריקוט|kebab|קבב/i, "steak", 5], [/p[âa]tes|pasta|פסטה|spaghetti/i, "pasta", 45], [/soupe|מרק|soup/i, "soup", 20],
  [/nouille|noodle|ramen|נודלס|wok|ווק/i, "noodles", 0], [/fleur|פרח|bouquet/i, "flowers", 140], [/cadeau|מתנה|gift/i, "gift", 350],
  [/m[ée]dic|תרופ|pill|pharma/i, "pill", 160], [/colis|חביל|package/i, "package", 35], [/autre|נוספ|other/i, "sparkles", 45]];
const KIND_ART = { pressing: ["basket", 35], restaurant: ["plate", 25], boutique: ["bags", 210], pharmacie: ["pill", 160], bureau: ["briefcase", 215], autre: ["store", 200] };
function itemArt(name, kind) {
  const hit = ITEM_ART.find(([rx]) => rx.test(String(name || "")));
  const [k, h] = hit ? hit.slice(1) : KIND_ART[kind] || ["bags", 25];
  return `<span class="item-art" style="--h:${h}"><img src="img/items/${k}.webp" alt="" loading="lazy" /></span>`;
}

// Carte d'un commerce HOP! Pro : accueil des clients (« Nos partenaires ») et aperçu dans l'espace du commerce
const KIND_ICON = { pressing: "👔", restaurant: "🍽️", boutique: "🛍️", pharmacie: "💊", bureau: "💼", epicerie: "🧺", traiteur: "🍱", autre: "🏪" };
// Commerce de services (pressing, bureau…) : « Hors service » plutôt que « Épuisé »
const isService = s => !!s && ["pressing", "bureau"].includes(s.kind);
// Logo d'un commerce de l'annuaire : un fichier de l'appli (img/logos/…) ou le logo officiel d'une enseigne sur Wikipédia
const dirLogo = e => { const v = String((e && e.lg) || "");
  return /^img\/logos\/[a-z0-9-]+\.(jpg|png|webp)$/.test(v) || /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/[A-Za-z0-9%._\/()\-]+$/.test(v) ? v : ""; };
const safeImg = s => (typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : "");
// Vitrines de démonstration : leurs images sont des fichiers de l'appli (img/demo/demo-resto-cover.jpg…)
const demoImg = (s, k) => (s && s.demo && /^DEMO-[A-Z]+$/.test(s.code || "") ? `img/demo/${s.code.toLowerCase()}-${k}.jpg` : "");
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
    ${items.length ? items.map((x, i) => `<figure><figcaption>${esc(x.label)} <a class="btn btn-sm" href="${esc(x.src)}" download="${esc(String(x.label || "photo").replace(/[^\w\u0590-\u05ff-]+/g, "-") + "-" + (i + 1))}.jpg">⬇ Enregistrer</a></figcaption><img src="${esc(x.src)}" alt="" /></figure>`).join("")
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
    if (o.goods_prepay) L.push(o.goods_after ? `   🧾 Articles avancés par le livreur : au plus ${money(o.goods_budget)}, le client paie le ticket exact après la photo`
      : `   💳 Articles payés d'avance au livreur : ${money(o.goods_budget)} au plus (ticket en photo, différence rendue)`);
    else if (o.budget) L.push(`   Budget : ${money(o.budget)} (réglé au magasin par le client)`);
  }
  L.push(`🏁 Livraison : ${o.dropoff_place ? "🏪 " + o.dropoff_place + ", " : ""}${o.dropoff_address}, ${cityFr(o.to_city)}`);
  if (addrDetailsText(o, "dropoff")) L.push(`   🏢 ${addrDetailsText(o, "dropoff")}`);
  if (o.dropoff_note) L.push(`   📝 ${o.dropoff_note}`);
  if (o.leave_at_door) L.push(`   🚪 DÉPOSER DEVANT LA PORTE (sans contact) + photo au client`);
  if (o.dropoff_contact || o.dropoff_phone) L.push(`   ${[o.dropoff_contact, o.dropoff_phone].filter(Boolean).join(" · ")}`);
  L.push(``, `${SIZE_FR[o.size] || o.size}${o.round_trip ? " · aller-retour" : ""}${o.extra_stops ? ` · +${o.extra_stops} arrêt(s)` : ""}`);
  if (o.notes) L.push(`📝 ${o.notes}`);
  L.push(``, `💰 ${money(o.price)} — ${PAY_FR[o.payment_method] || ""} — payé par ${o.payer === "destinataire" ? "le destinataire" : o.shop_sent ? "le commerce (quand le livreur prend le colis)" : "le client"}${o.prepaid_required ? " — 💳 À PAYER D'AVANCE" : ""}`);
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

// Fourchette affichée dans le rond (« 17-27 min ») : le temps estimé, plus une marge.
// Course pas encore prise (dès que possible) : départ dans les 10 min (Express : 5) + 5 min sur place + trajet.
function etaRange(o) {
  let m = deliveryEta(o);
  if (m == null && o && o.status === "nouvelle" && o.urgency !== "programmee" && o.pickup_lat != null && o.dropoff_lat != null)
    m = (o.urgency === "express" ? 5 : 10) + 5 + Pricing.etaMinutes({ lat: Number(o.pickup_lat), lon: Number(o.pickup_lon) }, { lat: Number(o.dropoff_lat), lon: Number(o.dropoff_lon) });
  if (m == null) return null;
  const lo = Math.max(1, Math.round(m)), hi = lo + (lo < 8 ? 3 : lo < 20 ? 6 : 10);
  return { lo, hi, text: `${lo}-${hi}` };
}
// Rond d'avancement : dégradé, ouverture en haut, point blanc au bout de l'arc (p de 0 à 1)
function ringSvg(p, gid) {
  const C = 2 * Math.PI * 50, k = Math.max(0, Math.min(1, Number(p) || 0)), gap = 0.08 * C, len = (C - gap) * k;
  const a = (-90 + (gap / 2 + len) / C * 360) * Math.PI / 180;
  const arc = (cls, d) => `<circle class="${cls}" cx="60" cy="60" r="50" stroke-dasharray="${d.toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-gap / 2).toFixed(1)}" transform="rotate(-90 60 60)"${cls === "hr-arc" ? ` stroke="url(#${gid})"` : ""}/>`;
  return `<svg class="hop-ring" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFC94D"/><stop offset=".55" stop-color="#FF8A1F"/><stop offset="1" stop-color="#FF5A0A"/></linearGradient></defs>
    ${arc("hr-track", C - gap)}${k > 0 ? arc("hr-arc", len) + `<circle class="hr-knob" cx="${(60 + 50 * Math.cos(a)).toFixed(1)}" cy="${(60 + 50 * Math.sin(a)).toFixed(1)}" r="6"/>` : ""}</svg>`;
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
// Ce que le client envoie au livreur : la course, et les articles (au maximum) quand ils sont payés d'avance
// (en espèces, une fois le ticket pris : la course + le ticket exact)
// (« ticket après » : seule la course est payée d'avance ; le ticket est envoyé à part, après la photo)
const payTotal = o => Number(o.price || 0) + (!o.goods_prepay || o.goods_after ? 0 : o.payment_method === "cash" && o.goods_spent != null ? Number(o.goods_spent) : Number(o.goods_budget || 0));
// Course vers / depuis un quartier hors centre (Agamim, zones industrielles) : pourquoi ce prix
function areaWhy(o) {
  if (!window.Pricing || !o || o.from_city !== o.to_city || !CONFIG.pricing.areas) return "";
  const pt = (la, lo) => (la != null && lo != null ? { lat: Number(la), lon: Number(lo) } : null);
  const zf = Pricing.areaOf(CONFIG, o.from_city, pt(o.pickup_lat, o.pickup_lon)), zt = Pricing.areaOf(CONFIG, o.to_city, pt(o.dropoff_lat, o.dropoff_lon));
  const base = CONFIG.pricing.fixedFromHome[o.from_city] || CONFIG.pricing.base;
  const ap = Number(CONFIG.pricing.areas.price);
  if ((!zf && !zt) || zf === zt || Number(o.price) < ap) return "";
  const z = CONFIG.pricing.areas.list.find(a => a.id === (zt || zf)), c = CONFIG.cities.find(x => x.id === o.from_city) || {};
  return I18N.t("qAreaWhy", { area: z ? z[I18N.lang] || z.fr : "", city: c[I18N.lang] || c.fr || "", price: money(ap), base: money(base) });
}
function bitPay(o) {
  const t = (k, v) => I18N.t(k, v);
  const name = String(o.courier_name || "").split(" ")[0];
  if (o.client_paid_at) return `<p class="promo-msg ok bit-pay">${esc(o.direct_pay ? t("bpThanksCourier", { name }) : t("bpThanks"))}</p>`;
  const phone = bitFor(o);
  // Paiement au livreur : son numéro n'est connu qu'une fois la course acceptée
  if (o.direct_pay && !phone) return `<p class="bit-pay muted">${esc(t("bpWaitCourier", { total: money(payTotal(o)) }))}</p>`;
  // Trois étapes, dans l'ordre, avec de gros boutons : ① le numéro ② Bit ③ « J'ai payé »
  const who = o.direct_pay ? name : "HOP!", total = money(payTotal(o)), digits = String(phone).replace(/\D/g, "");
  return `<div class="bit-pay bp-steps">
    <p class="bp-head">💳 ${esc(t("bpHead", { total, name: who }))}</p>
    <ol>
      <li><b>1</b><div><span>${esc(t("bpStep1", { name: who }))}</span>
        <button type="button" class="btn btn-block bp-num" data-bit-copy="${esc(digits)}"><span dir="ltr">${esc(digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") : phone)}</span><em>${esc(t("bpCopyShort"))}</em></button></div></li>
      <li><b>2</b><div><span>${esc(t(ANDROID ? "bpStep2" : "bpStep2Ios", { total }))}</span>
        ${ANDROID ? `<a class="btn btn-block btn-bit" href="${BIT_APP}">${esc(t("bpOpen"))}</a>` : ""}</div></li>
      <li><b>3</b><div><span>${esc(t("bpStep3"))}</span>
        <button type="button" class="btn btn-primary btn-block bp-done" data-bit-paid="${esc(o.token)}" data-name="${esc(o.direct_pay ? name : "")}" data-total="${esc(total)}">${esc(t("bpPaidBig", { total, name: who }))}</button></div></li>
    </ol>
    <small class="muted">${esc(t("bpPaybox", { ref: o.ref }))}</small>
  </div>`;
}
// Articles payés d'avance au commerce : « ① Payer EDMAR · 30 ₪ » (son lien de paiement ou son Bit), puis « J'ai payé EDMAR ».
// sp = { name, link, bit } du commerce ; le commerce confirme ensuite « Paiement reçu » et prépare
function goodsPay(o, sp) {
  const t = (k, v) => I18N.t(k, v);
  if (!o || !o.goods_pay || !sp) return "";
  const name = sp.name || "", amount = Number(o.items_total) > 0 ? money(o.items_total) : t("gpAmountShop");
  if (o.goods_pay === "recu") return `<div class="goods-pay ok"><b>✅ ${esc(t("gpOk", { name, amount }))}</b></div>`;
  if (o.goods_pay === "declare") return `<div class="goods-pay wait"><b>⏳ ${esc(t("gpWait", { name, amount }))}</b></div>`;
  const bit = String(sp.bit || "").replace(/\D/g, "");
  return `<div class="goods-pay todo">
    ${o.goods_pay === "pas_recu" ? `<p class="promo-msg bad">${esc(t("gpNo", { name }))}</p>` : ""}
    <b class="gp-step">${esc(t("gpStep1", { name, amount }))}</b>
    <small>${esc(t("gpWhy", { name }))}</small>
    <div class="bit-btns">
      ${sp.link ? `<a class="btn btn-primary gp-link" href="${esc(sp.link)}" target="_blank" rel="noopener">💳 ${esc(t("gpPayLink", { name }))}</a>` : ""}
      ${sp.link && Number(o.items_total) > 0 ? `<button type="button" class="btn btn-sm" data-bit-copy="${esc(String(Number(o.items_total)))}">${esc(t("gpCopyAmount", { amount }))}</button>` : ""}
      ${bit ? `${ANDROID ? `<a class="btn btn-sm btn-bit" href="${BIT_APP}">${esc(t("bpOpen"))}</a>` : ""}<button type="button" class="btn btn-sm" data-bit-copy="${esc(bit)}">${esc(t("gpCopyBit", { phone: bit }))}</button>` : ""}
      <button type="button" class="btn btn-sm${sp.link ? "" : " btn-primary"}" data-goods-paid="${esc(o.token)}" data-name="${esc(name)}" data-total="${esc(amount)}">${esc(t("gpPaid", { name }))}</button>
    </div></div>`;
}
document.addEventListener("click", async e => {
  const g = e.target.closest("[data-goods-paid]");
  if (g) {
    if (!confirm(I18N.t("gpConfirm", { name: g.dataset.name, total: g.dataset.total }))) return;
    g.disabled = true;
    try {
      await Store.clientGoodsPaid(g.dataset.goodsPaid);
      const box = g.closest(".goods-pay");
      if (box) { box.className = "goods-pay wait"; box.innerHTML = `<b>⏳ ${esc(I18N.t("gpWait", { name: g.dataset.name, amount: g.dataset.total }))}</b>`; }
      document.dispatchEvent(new CustomEvent("hop-goods-paid", { detail: g.dataset.goodsPaid }));
    } catch (ex) { g.disabled = false; alert(I18N.t("gpErr")); }
    return;
  }
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
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(window.I18N && I18N.lang === "he" ? "he-IL" : "fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
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
// Sans contact, en grand pour le livreur : il ne peut pas le rater
function doorBig(o, small) {
  return o.leave_at_door ? `<div class="door-big${small ? " sm" : ""}"><b>🚪 SANS CONTACT</b><span>Déposer devant la porte${o.dropoff_apt ? ` · appt ${esc(o.dropoff_apt)}` : ""}${o.dropoff_code ? ` · code ${esc(o.dropoff_code)}` : ""} · 📷 photo obligatoire avant « Livré »</span></div>` : "";
}
function doorTag(o, lang) {
  return o.leave_at_door ? `<div class="door-tag">${esc(window.I18N ? I18N.forLang(lang || "fr", "doorTag") : "🚪")}</div>` : "";
}

// Remarque sur une adresse (étage, code…), affichée sous l'adresse
// Nom de l'enseigne (Super-Pharm, restaurant…) au-dessus de l'adresse
function brand(name) { return name ? `<span class="brand-tag">🏪 <bdi>${esc(name)}</bdi></span>` : ""; }
function addrNote(note) { return note ? `<div class="addr-note">📝 ${esc(note)}</div>` : ""; }
// Texte d'un commerce écrit dans les deux langues (« Manteaux · מעילים », « EDMAR · אדמר ») :
// seulement la moitié de la langue de l'appli ; un texte dans une seule langue reste tel quel
function bi(text, lang) {
  const s = String(text == null ? "" : text), parts = s.split(/\s+·\s+/);
  if (parts.length < 2) return s;
  const isHe = x => /[\u0590-\u05FF]/.test(x), he = parts.filter(isHe), other = parts.filter(x => !isHe(x));
  if (!he.length || !other.length) return s;
  return ((lang || (window.I18N ? I18N.lang : "fr")) === "he" ? he : other).join(" · ");
}
// Accroche / description d'un commerce : la version hébreu quand l'appli est en hébreu (en français : la française, sinon l'hébreu)
function shopText(s, key, lang) {
  if (!s) return "";
  const he = (lang || (window.I18N ? I18N.lang : "fr")) === "he";
  const v = bi((he && s[key + "_he"]) || s[key] || (he ? "" : s[key + "_he"]) || "", lang);
  return he && v && !/[\u0590-\u05FF]/.test(v) ? "" : v;   // en hébreu : pas de texte resté en français
}
// Petit calendrier à la date du jour (l'emoji 📅 du téléphone affiche toujours « JUL 17 »)
function calIcon(d) {
  d = d || new Date();
  const m = d.toLocaleDateString(loc(), { month: "short" }).replace(/[.\s]/g, "").slice(0, 4).toUpperCase();
  return `<span class="cal-ico" aria-hidden="true"><span class="cal-m">${esc(m)}</span><span class="cal-d">${d.getDate()}</span></span>`;
}
// Partout dans l'appli, chaque 📅 / 🗓️ affiché devient ce calendrier à la date du jour
const CAL_RX = /\u{1F4C5}|\u{1F5D3}\uFE0F?/u;
function liveCalendars(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    const tag = n.parentNode && n.parentNode.nodeName;
    return CAL_RX.test(n.data) && !/^(OPTION|TEXTAREA|TITLE|SCRIPT|STYLE)$/.test(tag) && !(n.parentNode.closest && n.parentNode.closest("[contenteditable]"))
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
  const hits = [];
  while (walker.nextNode()) hits.push(walker.currentNode);
  hits.forEach(n => {
    const parts = n.data.split(new RegExp(CAL_RX.source, "gu")), frag = document.createDocumentFragment();
    parts.forEach((txt, i) => {
      if (i) { const t = document.createElement("template"); t.innerHTML = calIcon(); frag.appendChild(t.content); }
      if (txt) frag.appendChild(document.createTextNode(txt));
    });
    n.parentNode.replaceChild(frag, n);
  });
}
if (typeof MutationObserver !== "undefined") {
  const startCal = () => {
    liveCalendars(document.body);
    new MutationObserver(list => list.forEach(m => {
      if (m.type === "characterData") { if (m.target.parentNode) liveCalendars(m.target.parentNode); return; }
      m.addedNodes.forEach(n => { if (n.nodeType === 1) liveCalendars(n); else if (n.nodeType === 3 && n.parentNode) liveCalendars(n.parentNode); });
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) startCal(); else document.addEventListener("DOMContentLoaded", startCal);
}

// --- Visites du site (analytique du patron) : pages vues, commandes commencées / envoyées, commerces ouverts,
// et d'où vient la visite (Google, Facebook, Instagram, TikTok, WhatsApp, flyer ?src=…, QR d'un commerce ?c=…, utm_…).
// Visiteur et visite : numéros au hasard gardés sur ce téléphone, ni nom ni téléphone. Pas pour le patron ni les livreurs.
const track = (() => {
  const page = (location.pathname.split("/").filter(Boolean).pop() || "index").replace(/\.html$/, "");
  const staff = /^(admin|coursier|patron|livreur)$/.test(page);
  const cfg = CONFIG.supabase || {};
  let test = false;
  try { test = !!localStorage.getItem("hop.trackTest"); } catch (e) { /* ignore */ }
  const on = !!(cfg.url && cfg.anonKey) && !staff && !/[?&]demo=/.test(location.search) && (!LOCAL || test);
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const keep = (st, k, make) => { try { let v = st.getItem(k); if (!v) { v = make(); st.setItem(k, v); } return v; } catch (e) { return make(); } };
  const visitor = keep(localStorage, "hop.visitor", rid), session = keep(sessionStorage, "hop.session", rid);
  const q = new URLSearchParams(location.search);
  let refHost = "";
  try { refHost = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) { /* ignore */ }
  if (refHost === location.hostname) refHost = "";
  const named = h => (/(^|\.)google\./.test(h) ? "google" : /(facebook|fb)\.(com|me)$|^l\.facebook/.test(h) ? "facebook" : /instagram/.test(h) ? "instagram"
    : /tiktok/.test(h) ? "tiktok" : /whatsapp|^wa\.me$/.test(h) ? "whatsapp" : /^(t\.co|twitter\.com|x\.com)$/.test(h) ? "twitter" : /bing\./.test(h) ? "bing" : h);
  const src = q.get("utm_source") || q.get("src") || (q.get("fbclid") ? "facebook" : q.get("gclid") ? "google" : q.get("ttclid") ? "tiktok" : q.get("igshid") ? "instagram" : "")
    || (q.get("c") ? "qr-commerce" : "") || named(refHost);
  // Source de la visite : celle de la première page (gardée pour les pages suivantes de la même visite)
  let visit = null;
  try { visit = JSON.parse(sessionStorage.getItem("hop.src") || "null"); } catch (e) { /* ignore */ }
  if (!visit || (src && !visit.source)) {
    visit = { source: src || "", medium: q.get("utm_medium") || "", campaign: q.get("utm_campaign") || (q.get("c") ? String(q.get("c")).toUpperCase() : ""), ref: refHost };
    try { sessionStorage.setItem("hop.src", JSON.stringify(visit)); } catch (e) { /* ignore */ }
  }
  const first = keep(localStorage, "hop.firstSrc", () => visit.source || "direct");
  const ua = navigator.userAgent || "";
  const device = /iPad|Tablet/i.test(ua) ? "tablette" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "ordinateur";
  const app = !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
  const send = (kind, extra) => {
    if (!on) return;
    const p = Object.assign({ visitor, session, kind, page, source: visit.source || "", medium: visit.medium, campaign: visit.campaign, first_source: first,
      ref_host: visit.ref, device, lang: (window.I18N && I18N.lang) || "fr", app }, extra || {});
    fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/rpc/site_track", { method: "POST", keepalive: true,
      headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ p }) }).catch(() => {});
  };
  send("view");
  return send;
})();

// Heure écrite dans un texte (« à partir de 16 h », « vers 16h30 », « après 16:00 », « אחרי 17:00 ») → Date, ce jour-là dans le fuseau
// de l'entreprise (ou le lendemain si elle est passée depuis plus d'une heure). « avant 18 h » / « jusqu'à » / « לפני » : rien.
function zonedTime(ymd, h, mi) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const f = new Intl.DateTimeFormat("en-US", { timeZone: CONFIG.timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const g = k => Number((f.find(p => p.type === k) || {}).value);
  const wall = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return guess - (wall - guess);
}
function noteTime(text, from) {
  if (!text) return null;
  const s = String(text);
  let m = s.match(/(?:partir d[e'’]?\s*|apr[èe]s\s*|pas avant\s*|vers\s*|d[èé]s\s*|pour\s*|מ-\s*|מ\s+|אחרי\s*|החל מ-?\s*|בשעה\s*|ב-\s*)(\d{1,2})\s*(?:h|H|:|\.)?\s*(\d{2})?(?!\d)/i);
  if (!m) {
    if (/(avant|jusqu|max|לפני|עד)\s*(la |ה)?\s*\d{1,2}/i.test(s)) return null;
    m = s.match(/(?:^|[^\d/.,-])(\d{1,2})\s*(?:h|H|:)\s*(\d{2})?(?![\d/])/);
  }
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] || 0);
  if (h < 6 || h > 23 || mi > 59) return null;
  const base = from ? new Date(from) : new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
  const t = zonedTime(ymd, h, mi);
  return new Date(t < base.getTime() - 3600000 ? t + 86400000 : t);
}
// « Pas avant » d'une course : enregistré à la commande, sinon lu dans la note (anciennes commandes)
function notBefore(o) {
  if (!o) return null;
  if (o.not_before) return new Date(o.not_before);
  if (o.urgency === "programmee" || o.appt_at) return null;
  return noteTime(o.notes, o.created_at);
}
// Belle courbe entre deux points (un arc doux, pas de trajet routier) : ligne épaisse arrondie posée sur un halo clair
function curvePts(a, b, n) {
  const [la1, lo1] = [Number(a[0] != null ? a[0] : a.lat), Number(a[1] != null ? a[1] : a.lon)];
  const [la2, lo2] = [Number(b[0] != null ? b[0] : b.lat), Number(b[1] != null ? b[1] : b.lon)];
  const k = Math.cos((la1 + la2) / 2 * Math.PI / 180);
  const dx = (lo2 - lo1) * k, dy = la2 - la1;
  const mx = (lo1 + lo2) / 2, my = (la1 + la2) / 2;
  const cx = mx - dy * 0.22 / k, cy = my + dx * 0.22;
  const out = [];
  for (let i = 0; i <= (n || 28); i++) {
    const t = i / (n || 28), u = 1 - t;
    out.push([u * u * la1 + 2 * u * t * cy + t * t * la2, u * u * lo1 + 2 * u * t * cx + t * t * lo2]);
  }
  return out;
}
function routeLayer(a, b, opts) {
  const o = Object.assign({ color: "#FF6A13", weight: 6, opacity: .95, glow: "#FFFFFF", glowOpacity: .45 }, opts || {});
  const pts = curvePts(a, b);
  const g = L.featureGroup([
    L.polyline(pts, { color: o.glow, weight: o.weight + 8, opacity: o.glowOpacity, lineCap: "round", lineJoin: "round", interactive: false }),
    L.polyline(pts, { color: o.color, weight: o.weight, opacity: o.opacity, lineCap: "round", lineJoin: "round", interactive: false })
  ]);
  return g;
}

window.UI = {
  addrNote, calIcon, bi, shopText, brand, addrDetails, addrDetailsText, doorTag, doorBig,
  track, DOC_FR, docPhoto, photoViewer, proCard, safeImg, dirLogo, demoImg, isService, KIND_ICON, itemArt, artImg, catImg, openState, nextOpenDate, hhmmOf, hoursEditor, readHours, bindHours, goodsPay,
  deliveryEta, etaRange, ringSvg, PROGRESS, commissionText, networkText, stopsLegs, notify, dutyNotice, clearNotifs, iosInstallHint, cityZone, cityActive, zoneActive, welcomeUrl, welcomeMsg, setZonesOpen, receiptUrl, carnetReceiptUrl, receiptNo, areaWhy, topupReceiptUrl, referralCode, clientMessage, bitFor, bitPay, payTotal, pushSubscribe, clientPushSubscribe, askNewPassword, forgotLink, installApp, isStandalone, inOwnApp, markClientApp, wordmark, weekStart, addDays, fmtKey,
  mapTiles, isNight, waitRule, ratingOf, ratingText, esc, money, placeQuery, fmtTime, fmtDay, fmtDateTime, dayKey, noteTime, notBefore, curvePts, routeLayer, intlPhone, waLink, smsLink, waShare, waPersonal, wazeLink, mapsLink,
  cityFr, appUrl, trackUrl, orderText, whenFr, SERVICE_FR, PLACE_FR, SIZE_FR, PAY_FR
};

})();
