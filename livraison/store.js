// ============================================================================
// Stockage des commandes, des livreurs et des réglages.
// - Mode démo (Supabase non configuré) : localStorage de l'appareil.
// - Mode en ligne : base Supabase (API REST + Auth), partagée par tous.
// ============================================================================

(function () {
"use strict";

const LS = {
  orders: "livraison.orders.v1",
  tokens: "livraison.myTokens.v1",
  profile: "livraison.profile.v1",
  couriers: "livraison.couriers.v1",
  settings: "livraison.settings.v1",
  pendingCourier: "livraison.pendingCourier.v1",
  addresses: "livraison.addresses.v1",
  device: "livraison.device.v1"
};
// Une session par espace (patron / livreur) pour pouvoir utiliser les deux
let sessionKey = "livraison.session.admin.v1";

const sb = CONFIG.supabase || {};
const ONLINE = !!(sb.url && sb.anonKey);
const DEMO_ADMIN_ID = "admin-demo";

const STATUSES = {
  nouvelle:  { label: "Nouvelle",      icon: "🆕" },
  confirmee: { label: "Acceptée",      icon: "✅" },
  recuperee: { label: "En route",      icon: "🛵" },
  livree:    { label: "Livrée",        icon: "📦" },
  refusee:   { label: "Refusée",       icon: "🚫" },
  annulee:   { label: "Annulée",       icon: "✖️" }
};
// Position du livreur montrée au client seulement pendant ces statuts
const LIVE = ["confirmee", "recuperee"];

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
}
function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function newRef() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return "C" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// --- Supabase REST ------------------------------------------------------------
async function rest(path, { method = "GET", body, token, prefer } = {}) {
  const headers = {
    apikey: sb.anonKey,
    Authorization: "Bearer " + (token || sb.anonKey),
    "Content-Type": "application/json"
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(sb.url.replace(/\/$/, "") + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = new Error((await res.text()) || res.statusText);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function session() { return readJSON(sessionKey, null); }

async function refreshSession() {
  const s = session();
  if (!s || !s.refresh_token) throw new Error("Session expirée");
  const data = await rest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
  writeJSON(sessionKey, Object.assign({}, s, { access_token: data.access_token, refresh_token: data.refresh_token }));
}

// Requête authentifiée, avec un nouvel essai après renouvellement du jeton
async function authRest(path, opts = {}) {
  try {
    return await rest(path, Object.assign({}, opts, { token: session().access_token }));
  } catch (e) {
    if (e.status !== 401) throw e;
    await refreshSession();
    return rest(path, Object.assign({}, opts, { token: session().access_token }));
  }
}

// --- Démo : tables locales ------------------------------------------------------
function localCouriers() {
  const list = readJSON(LS.couriers, []);
  if (!list.some(c => c.id === DEMO_ADMIN_ID)) {
    list.push({ id: DEMO_ADMIN_ID, role: "admin", status: "actif", name: CONFIG.businessName,
      phone: CONFIG.phoneDisplay, bit_phone: CONFIG.bitPhone, accepted_terms_at: new Date().toISOString() });
    writeJSON(LS.couriers, list);
  }
  return list;
}
function localOrders() { return readJSON(LS.orders, []); }
function saveLocalOrders(list) { writeJSON(LS.orders, list); }
function myId() { const s = session(); return s && s.user_id; }

// --- Réglages (disponibilité, commission) -----------------------------------------
const DEFAULT_SETTINGS = { accepting: true, message: "", commission: CONFIG.platform.commissionPerCourse };

async function getSettings() {
  if (ONLINE) {
    const rows = await rest("/rest/v1/settings?id=eq.1&select=*");
    return Object.assign({}, DEFAULT_SETTINGS, rows && rows[0]);
  }
  return Object.assign({}, DEFAULT_SETTINGS, readJSON(LS.settings, {}));
}

async function saveSettings(changes) {
  if (ONLINE) return authRest("/rest/v1/settings?id=eq.1", { method: "PATCH", body: changes, prefer: "return=minimal" });
  writeJSON(LS.settings, Object.assign(readJSON(LS.settings, {}), changes));
}

// --- Offre de bienvenue : une seule fois par numéro / téléphone / IP ------------------
// Identifiant de cet appareil (gardé aussi en cookie, plus difficile à effacer par erreur)
function deviceId() {
  let id = readJSON(LS.device, null);
  const m = document.cookie.match(/(?:^|; )hop_did=([^;]+)/);
  if (!id && m) id = m[1];
  if (!id) id = uuid();
  writeJSON(LS.device, id);
  document.cookie = `hop_did=${id}; max-age=${60 * 60 * 24 * 730}; path=/; SameSite=Lax`;
  return id;
}
const phoneKey = p => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("972")) d = "0" + d.slice(3); return d; };
const isWelcome = code => !!(code && (CONFIG.promos.codes[code] || {}).welcome);

// true si l'offre a déjà servi pour ce numéro ou cet appareil
async function welcomeUsed(phone) {
  const key = phoneKey(phone);
  if (ONLINE) {
    return !!(await rest("/rest/v1/rpc/welcome_used", { method: "POST", body: { p_phone: key, p_device: deviceId() } }));
  }
  const dev = deviceId();
  return localOrders().some(o => isWelcome(o.promo_code) && !["annulee", "refusee"].includes(o.status)
    && (phoneKey(o.contact_phone) === key || o.device_id === dev));
}

// --- Côté client -----------------------------------------------------------------
async function createOrder(order) {
  order = Object.assign({ token: uuid(), ref: newRef(), status: "nouvelle", payment_status: "en_attente", device_id: deviceId() }, order);
  if (!ONLINE && isWelcome(order.promo_code) && await welcomeUsed(order.contact_phone)) throw new Error("welcome_used");
  if (ONLINE) {
    await rest("/rest/v1/orders", { method: "POST", body: order, prefer: "return=minimal" });
  } else {
    order.id = uuid();
    order.created_at = new Date().toISOString();
    order.commission = 0;
    order.commission_status = "du";
    const all = localOrders();
    all.push(order);
    saveLocalOrders(all);
  }
  const tokens = readJSON(LS.tokens, []);
  tokens.push(order.token);
  writeJSON(LS.tokens, tokens);
  return order;
}

async function myOrders() {
  const tokens = readJSON(LS.tokens, []);
  if (!tokens.length) return [];
  if (ONLINE) return rest("/rest/v1/rpc/orders_by_tokens", { method: "POST", body: { tokens } });
  return localOrders().filter(o => tokens.includes(o.token));
}

async function cancelMyOrder(token) {
  if (ONLINE) return rest("/rest/v1/rpc/cancel_order", { method: "POST", body: { p_token: token } });
  const all = localOrders();
  const o = all.find(x => x.token === token && x.status === "nouvelle");
  if (o) { o.status = "annulee"; saveLocalOrders(all); }
  return !!o;
}

// Suivi d'une course : commande + position de son livreur
async function trackOrder(token) {
  if (ONLINE) return rest("/rest/v1/rpc/track_order", { method: "POST", body: { p_token: token } });
  const order = localOrders().find(o => o.token === token);
  if (!order) return null;
  const c = localCouriers().find(x => x.id === order.courier_id);
  return Object.assign({}, order, LIVE.includes(order.status) && c && c.lat != null
    ? { courier_lat: c.lat, courier_lon: c.lon, courier_at: c.position_at } : {});
}

function getProfile() { return readJSON(LS.profile, {}); }

// Carnet d'adresses du client (sur son téléphone), les plus utilisées en premier
function getAddresses() { return readJSON(LS.addresses, []); }
function saveAddress(a) {
  const key = [a.street, a.number, a.city, a.apt].join("|").toLowerCase();
  const list = getAddresses().filter(x => [x.street, x.number, x.city, x.apt].join("|").toLowerCase() !== key);
  const old = getAddresses().find(x => [x.street, x.number, x.city, x.apt].join("|").toLowerCase() === key);
  list.unshift(Object.assign({}, a, { uses: ((old && old.uses) || 0) + 1, at: Date.now() }));
  list.sort((x, y) => (y.uses - x.uses) || (y.at - x.at));
  writeJSON(LS.addresses, list.slice(0, 8));
}
function deleteAddress(i) { const list = getAddresses(); list.splice(i, 1); writeJSON(LS.addresses, list); }
function saveProfile(p) { writeJSON(LS.profile, p); }

// --- Connexion (patron et livreurs) ---------------------------------------------
// space : "admin" (espace patron) ou "coursier" (espace livreur)
function useSpace(space) { sessionKey = `livraison.session.${space}.v1`; }

async function login(email, password) {
  if (!ONLINE) {
    if (sessionKey.includes(".admin.")) {
      if (password !== CONFIG.demoAdminPin) throw new Error("Code incorrect.");
      localCouriers();
      writeJSON(sessionKey, { demo: true, user_id: DEMO_ADMIN_ID });
      return;
    }
    const c = localCouriers().find(x => x.email === email.toLowerCase() && x.password === password);
    if (!c) throw new Error("Email ou mot de passe incorrect.");
    writeJSON(sessionKey, { demo: true, user_id: c.id });
    return;
  }
  const data = await rest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } })
    .catch(() => { throw new Error("Email ou mot de passe incorrect (ou email pas encore confirmé)."); });
  writeJSON(sessionKey, { access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id });
  // Inscription faite avant confirmation de l'email : on crée la fiche maintenant
  const pending = readJSON(LS.pendingCourier, null);
  if (pending && pending.email === email.toLowerCase() && !(await me())) {
    await authRest("/rest/v1/couriers", { method: "POST", body: Object.assign({}, pending.profile, { id: data.user.id }), prefer: "return=minimal" });
    removeKey(LS.pendingCourier);
  }
}

function logout() { removeKey(sessionKey); }

// Fiche du compte connecté (null si pas encore inscrit)
async function me() {
  const id = myId();
  if (!id) return null;
  if (!ONLINE) return localCouriers().find(c => c.id === id) || null;
  const rows = await authRest("/rest/v1/couriers?select=*&id=eq." + encodeURIComponent(id));
  return rows && rows[0] || null;
}

// Inscription d'un livreur (en attente de validation)
async function signupCourier(email, password, profile) {
  email = email.toLowerCase();
  profile = Object.assign({}, profile, { accepted_terms_at: new Date().toISOString() });
  if (!ONLINE) {
    const list = localCouriers();
    if (list.some(c => c.email === email)) throw new Error("Un compte existe déjà avec cet email.");
    const c = Object.assign({ id: uuid(), email, password, role: "coursier", status: "en_attente", created_at: new Date().toISOString() }, profile);
    list.push(c);
    writeJSON(LS.couriers, list);
    writeJSON(sessionKey, { demo: true, user_id: c.id });
    return { needsConfirmation: false };
  }
  const data = await rest("/auth/v1/signup", { method: "POST", body: { email, password } })
    .catch(e => { throw new Error(/registered|exists/i.test(e.message) ? "Un compte existe déjà avec cet email." : "Inscription impossible : " + e.message); });
  if (!data.access_token) {
    // Supabase demande de confirmer l'email : la fiche sera créée à la 1re connexion
    writeJSON(LS.pendingCourier, { email, profile });
    return { needsConfirmation: true };
  }
  writeJSON(sessionKey, { access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id });
  await authRest("/rest/v1/couriers", { method: "POST", body: Object.assign({}, profile, { id: data.user.id }), prefer: "return=minimal" });
  return { needsConfirmation: false };
}

// --- Courses (patron : toutes ; livreur : libres + les siennes) --------------------
async function listOrders() {
  if (ONLINE) return authRest("/rest/v1/orders?select=*&order=pickup_at.asc");
  const all = localOrders();
  const c = localCouriers().find(x => x.id === myId());
  if (!c) return [];
  if (c.role === "admin") return all;
  if (c.status !== "actif") return [];
  return all.filter(o => o.courier_id === c.id || (o.status === "nouvelle" && !o.courier_id));
}

// Démo : même règle que la base en ligne pour numéroter les reçus
function localReceipt(o) {
  const c = localCouriers().find(x => x.id === o.courier_id);
  if (o.status === "livree" && o.payment_status === "paye" && !o.receipt_number && c && c.role === "admin") {
    o.receipt_number = localOrders().reduce((m, x) => Math.max(m, x.receipt_number || 0), 0) + 1;
    o.receipt_at = new Date().toISOString();
  }
}

// Modification libre (patron)
async function updateOrder(id, changes) {
  if (ONLINE) {
    return authRest("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: changes, prefer: "return=minimal" });
  }
  const all = localOrders();
  const o = all.find(x => x.id === id);
  if (o) { Object.assign(o, changes); localReceipt(o); }
  saveLocalOrders(all);
}

// Champs à copier sur la course quand un livreur la prend
async function courierFields(c) {
  const settings = await getSettings();
  return {
    status: "confirmee", courier_id: c.id, courier_name: c.name, courier_phone: c.phone,
    courier_bit: c.bit_phone || c.phone, commission: c.role === "admin" ? 0 : Number(settings.commission)
  };
}

// Le patron attribue une course à un livreur (ou à lui-même)
async function assignOrder(id, courier) {
  return updateOrder(id, await courierFields(courier));
}

// Un livreur accepte une course libre (le premier qui accepte la prend)
async function acceptOrder(id) {
  if (ONLINE) return authRest("/rest/v1/rpc/accept_order", { method: "POST", body: { p_id: id } });
  const all = localOrders();
  const o = all.find(x => x.id === id && x.status === "nouvelle" && !x.courier_id);
  const c = localCouriers().find(x => x.id === myId() && x.status === "actif");
  if (!o || !c) return false;
  Object.assign(o, await courierFields(c));
  saveLocalOrders(all);
  return true;
}

// Livreur : "recuperee", "livree", "paye" ou "liberer" (rendre la course)
async function courierAction(id, action) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_update", { method: "POST", body: { p_id: id, p_action: action } });
  const all = localOrders();
  const o = all.find(x => x.id === id && x.courier_id === myId());
  if (!o) return false;
  if (action === "recuperee" && o.status === "confirmee") o.status = "recuperee";
  else if (action === "livree" && o.status === "recuperee") o.status = "livree";
  else if (action === "paye") o.payment_status = "paye";
  else if (action === "liberer" && o.status === "confirmee") {
    Object.assign(o, { status: "nouvelle", courier_id: null, courier_name: null, courier_phone: null, courier_bit: null, commission: 0 });
  } else return false;
  saveLocalOrders(all);
  return true;
}

// Position GPS du compte connecté (patron ou livreur en service)
async function ping(lat, lon) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_ping", { method: "POST", body: { p_lat: lat, p_lon: lon } });
  const list = localCouriers();
  const c = list.find(x => x.id === myId());
  if (c) Object.assign(c, { lat, lon, position_at: new Date().toISOString() });
  writeJSON(LS.couriers, list);
}

// --- Gestion des livreurs (patron) ------------------------------------------------
async function listCouriers() {
  if (ONLINE) return authRest("/rest/v1/couriers?select=*&order=created_at.desc");
  return localCouriers().map(c => { const x = Object.assign({}, c); delete x.password; return x; });
}

async function updateCourier(id, changes) {
  if (ONLINE) return authRest("/rest/v1/couriers?id=eq." + encodeURIComponent(id), { method: "PATCH", body: changes, prefer: "return=minimal" });
  const list = localCouriers();
  const c = list.find(x => x.id === id);
  if (c) Object.assign(c, changes);
  writeJSON(LS.couriers, list);
}

// Marque la commission de plusieurs courses comme réglée (paiement hebdomadaire)
async function settleOrders(ids) {
  if (!ids.length) return;
  if (ONLINE) {
    return authRest("/rest/v1/orders?id=in.(" + ids.map(encodeURIComponent).join(",") + ")",
      { method: "PATCH", body: { commission_status: "regle" }, prefer: "return=minimal" });
  }
  const all = localOrders();
  all.forEach(o => { if (ids.includes(o.id)) o.commission_status = "regle"; });
  saveLocalOrders(all);
}

window.Store = {
  ONLINE, STATUSES, LIVE, LS,
  getSettings, saveSettings,
  welcomeUsed, deviceId,
  createOrder, myOrders, cancelMyOrder, trackOrder, getProfile, saveProfile, getAddresses, saveAddress, deleteAddress,
  useSpace, session, login, logout, me, signupCourier,
  listOrders, updateOrder, assignOrder, acceptOrder, courierAction, ping,
  listCouriers, updateCourier, settleOrders
};

})();
