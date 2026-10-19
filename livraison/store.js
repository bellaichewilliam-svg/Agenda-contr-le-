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
  device: "livraison.device.v1",
  shops: "livraison.shops.v1",
  shopTokens: "livraison.shopTokens.v1",
  shopCodes: "livraison.shopCodes.v1",
  messages: "livraison.messages.v1",
  replies: "livraison.replies.v1"
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
function newCode(len, taken) {
  let c;
  do { c = Array.from(crypto.getRandomValues(new Uint8Array(len)), b => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31]).join(""); }
  while (taken.includes(c));
  return c;
}
function localCouriers() {
  const list = readJSON(LS.couriers, []);
  let changed = false;
  if (!list.some(c => c.id === DEMO_ADMIN_ID)) {
    list.push({ id: DEMO_ADMIN_ID, role: "admin", status: "actif", name: CONFIG.businessName,
      phone: CONFIG.phoneDisplay, bit_phone: CONFIG.bitPhone, accepted_terms_at: new Date().toISOString() });
    changed = true;
  }
  list.forEach(c => { if (!c.ref_code) { c.ref_code = newCode(5, list.map(x => x.ref_code)); changed = true; } });
  if (changed) writeJSON(LS.couriers, list);
  return list;
}
function localShops() { return readJSON(LS.shops, []); }
function localOrders() { return readJSON(LS.orders, []); }
function saveLocalOrders(list) { writeJSON(LS.orders, list); }
function myId() { const s = session(); return s && s.user_id; }

// --- Réglages (disponibilité, commission) -----------------------------------------
const DEFAULT_SETTINGS = {
  accepting: true, message: "", commission: CONFIG.platform.commissionPerCourse,
  referral_bonus: CONFIG.partners.bonusPerDelivery, priority_minutes: CONFIG.partners.priorityMinutes,
  wave_seconds: CONFIG.platform.waveSeconds, max_debt: CONFIG.platform.maxDebt,
  carnet_unit: CONFIG.partners.carnet.price / CONFIG.partners.carnet.courses
};

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
    // Même règle que la base en ligne : commerce et parrain retrouvés ici, jamais fournis par le client
    const settings = await getSettings();
    const shops = localShops();
    const shop = order.shop_id && shops.find(x => x.id === order.shop_id && x.status !== "suspendu");
    const referrer = shop && localCouriers().find(c => c.id === shop.referrer_id);
    Object.assign(order, {
      shop_id: shop ? shop.id : null, shop_name: shop ? shop.name : null, referrer_id: referrer ? referrer.id : null,
      referral_bonus: referrer && referrer.role === "coursier" ? Number(settings.referral_bonus) : 0, referral_status: "du",
      paid_to: order.prepaid_required ? "hop" : "livreur"
    });
    // Carnet pro : seulement le commerce lui-même (sa clé), dans Netanya, s'il lui reste des courses
    if (order.payment_method === "carnet") {
      if (!shop || shop.token !== order.shop_token || order.from_city !== "netanya" || order.to_city !== "netanya") throw new Error("carnet_invalid");
      if (!(shop.credits > 0)) throw new Error("carnet_empty");
      shop.credits--;
      writeJSON(LS.shops, shops);
      Object.assign(order, { price: Number(settings.carnet_unit), payment_status: "paye", paid_to: "hop", promo_code: null, discount: 0 });
    }
    delete order.shop_token;
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
  if (o) { o.status = "annulee"; refundCarnet(o); saveLocalOrders(all); }
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
  const st = await getSettings();
  return all.filter(o => o.courier_id === c.id || canSeeNew(o, c.id, st));
}

// Course libre visible (même règle que la base en ligne) : tout de suite pour le parrain du
// commerce ; sinon par vagues, le livreur en service le plus proche du départ d'abord.
function canSeeNew(o, id, st) {
  if (o.status !== "nouvelle" || o.courier_id) return false;
  if (o.referrer_id && o.referrer_id === id) return true;
  const fresh = Date.now() - 10 * 60000;
  const ranked = o.pickup_lat == null ? [] : localCouriers()
    .filter(c => c.status === "actif" && c.role === "coursier" && c.lat != null && new Date(c.position_at) > fresh)
    .map(c => ({ id: c.id, d: (c.lat - o.pickup_lat) ** 2 + ((c.lon - o.pickup_lon) * Math.cos(o.pickup_lat * Math.PI / 180)) ** 2 }))
    .sort((a, b) => a.d - b.d);
  const rank = ranked.findIndex(x => x.id === id);
  const wait = (o.referrer_id ? Number(st.priority_minutes) * 60000 : 0) + Number(st.wave_seconds) * 1000 * Math.min(rank < 0 ? 2 : rank, 2);
  return Date.now() - new Date(o.created_at) >= wait;
}

// Ce que le livreur doit à HOP (positif) ou HOP lui doit (négatif), courses pas encore réglées
function balanceOf(id, all) {
  return all.filter(o => o.courier_id === id && o.status === "livree" && o.commission_status !== "regle")
      .reduce((s, o) => s + Number(o.commission || 0) - (o.paid_to === "hop" && o.payment_status === "paye" ? Number(o.price) : 0), 0)
    - all.filter(o => o.referrer_id === id && o.status === "livree" && o.referral_status !== "regle")
      .reduce((s, o) => s + Number(o.referral_bonus || 0), 0);
}

async function myBalance() {
  if (ONLINE) return Number(await authRest("/rest/v1/rpc/my_balance", { method: "POST", body: {} })) || 0;
  return balanceOf(myId(), localOrders());
}

// Démo : même règle que la base en ligne pour numéroter les reçus
function localReceipt(o) {
  const c = localCouriers().find(x => x.id === o.courier_id);
  if (o.status === "livree" && o.payment_status === "paye" && !o.receipt_number && o.payment_method !== "carnet" && c && c.role === "admin") {
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
  if (o) {
    const was = o.status;
    Object.assign(o, changes);
    localReceipt(o);
    if (!["annulee", "refusee"].includes(was)) refundCarnet(o);
  }
  saveLocalOrders(all);
}

// Course de carnet annulée ou refusée : la course est rendue au commerce
function refundCarnet(o) {
  if (o.payment_method !== "carnet" || !["annulee", "refusee"].includes(o.status)) return;
  const shops = localShops();
  const s = shops.find(x => x.id === o.shop_id);
  if (s) { s.credits = (s.credits || 0) + 1; writeJSON(LS.shops, shops); }
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
  const c = localCouriers().find(x => x.id === myId() && x.status === "actif");
  const st = await getSettings();
  const o = c && all.find(x => x.id === id && (c.role === "admin" || canSeeNew(x, c.id, st)));
  if (!o || !c) return false;
  if (c.role === "coursier" && balanceOf(c.id, all) > Number(st.max_debt)) return false;
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
  else if (action === "paye" && o.paid_to !== "hop") o.payment_status = "paye";
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

// --- Paiement hebdomadaire des bonus de parrainage (patron) ------------------------------
async function settleReferrals(ids) {
  if (!ids.length) return;
  if (ONLINE) {
    return authRest("/rest/v1/orders?id=in.(" + ids.map(encodeURIComponent).join(",") + ")",
      { method: "PATCH", body: { referral_status: "regle" }, prefer: "return=minimal" });
  }
  const all = localOrders();
  all.forEach(o => { if (ids.includes(o.id)) o.referral_status = "regle"; });
  saveLocalOrders(all);
}

// --- Commerces partenaires ---------------------------------------------------------------
// Inscription d'un commerce (sans compte) : renvoie { code, token } et garde le lien secret sur l'appareil
async function shopSignup(data) {
  let r;
  if (ONLINE) r = await rest("/rest/v1/rpc/shop_signup", { method: "POST", body: { p: data } });
  else {
    const list = localShops();
    const same = x => phoneKey(x.phone) === phoneKey(data.phone)
      || (String(x.name).trim().toLowerCase() === String(data.name).trim().toLowerCase() && (x.city || "") === (data.city || ""));
    if (list.some(same)) throw new Error("shop_exists");
    const ref = localCouriers().find(c => c.ref_code && c.ref_code === String(data.ref_code || "").trim().toUpperCase() && c.status === "actif");
    const shop = {
      id: uuid(), created_at: new Date().toISOString(), code: newCode(6, list.map(x => x.code)), token: uuid(), status: "en_attente",
      name: data.name, kind: data.kind, city: data.city, address: data.address, lat: data.lat, lon: data.lon,
      contact_name: data.contact_name, phone: data.phone, email: data.email, lang: data.lang, referrer_id: ref ? ref.id : null, credits: 0
    };
    list.push(shop);
    writeJSON(LS.shops, list);
    r = { code: shop.code, token: shop.token, referred: !!ref };
  }
  rememberShopToken(r.token, r.code);
  return r;
}

function myShopTokens() { return readJSON(LS.shopTokens, []); }
// Clé secrète gardée sur l'appareil du commerce (pour son espace et son carnet)
function rememberShopToken(token, code) {
  const tokens = myShopTokens().filter(x => x !== token);
  tokens.unshift(token);
  writeJSON(LS.shopTokens, tokens);
  if (code) writeJSON(LS.shopCodes, Object.assign(readJSON(LS.shopCodes, {}), { [code]: token }));
}
function shopTokenFor(code) { return readJSON(LS.shopCodes, {})[String(code || "").toUpperCase()] || null; }

const publicShop = s => s && s.status !== "suspendu"
  ? { id: s.id, code: s.code, name: s.name, kind: s.kind, city: s.city, address: s.address, lat: s.lat, lon: s.lon, status: s.status } : null;

async function shopByCode(code) {
  if (!code) return null;
  if (ONLINE) return rest("/rest/v1/rpc/shop_public", { method: "POST", body: { p_code: code } });
  return publicShop(localShops().find(x => x.code === String(code).toUpperCase()));
}

// Espace du commerce : sa fiche et ses courses
async function shopDashboard(token) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_dashboard", { method: "POST", body: { p_token: token } });
  const shop = localShops().find(x => x.token === token);
  if (!shop) return { shop: null, orders: [] };
  const x = Object.assign({}, shop); delete x.referrer_id; delete x.admin_note;
  return { shop: x, orders: localOrders().filter(o => o.shop_id === shop.id).sort((a, b) => new Date(b.pickup_at) - new Date(a.pickup_at)) };
}

// Patron : tous les commerces
async function listShops() {
  if (ONLINE) return authRest("/rest/v1/shops?select=*&order=created_at.desc");
  return localShops().slice().reverse();
}
async function updateShop(id, changes) {
  if (ONLINE) return authRest("/rest/v1/shops?id=eq." + encodeURIComponent(id), { method: "PATCH", body: changes, prefer: "return=minimal" });
  const list = localShops();
  const s = list.find(x => x.id === id);
  if (s) Object.assign(s, changes);
  writeJSON(LS.shops, list);
}

// Livreur : ses commerces, les courses qui lui rapportent un bonus, le classement du mois
async function myReferrals() {
  if (ONLINE) {
    const [shops, orders, board] = await Promise.all([
      authRest("/rest/v1/rpc/my_shops", { method: "POST", body: {} }),
      authRest("/rest/v1/rpc/my_referral_orders", { method: "POST", body: {} }),
      authRest("/rest/v1/rpc/referral_leaderboard", { method: "POST", body: {} })
    ]);
    return { shops: shops || [], orders: orders || [], board: board || [] };
  }
  const id = myId();
  const month = new Date().toISOString().slice(0, 7);
  const shops = localShops();
  const orders = localOrders();
  const board = localCouriers().filter(c => c.role === "coursier" && c.status === "actif").map(c => ({
    name: String(c.name || "").split(" ")[0], me: c.id === id,
    shops: shops.filter(s => s.referrer_id === c.id && s.status !== "suspendu").length,
    deliveries: orders.filter(o => o.referrer_id === c.id && o.status === "livree" && String(o.pickup_at).slice(0, 7) === month).length
  })).filter(x => x.shops > 0 || x.me).sort((a, b) => (b.shops - a.shops) || (b.deliveries - a.deliveries)).slice(0, 10);
  return {
    shops: shops.filter(s => s.referrer_id === id).reverse().map(s => ({ id: s.id, code: s.code, name: s.name, kind: s.kind, city: s.city, status: s.status, created_at: s.created_at })),
    orders: orders.filter(o => o.referrer_id === id).map(o => ({ id: o.id, shop_id: o.shop_id, pickup_at: o.pickup_at, status: o.status, referral_bonus: o.referral_bonus, referral_status: o.referral_status })),
    board
  };
}

// --- Messages du patron aux livreurs ------------------------------------------------------
async function sendMessage(body, kind, toCourier) {
  const m = { body, kind: kind || "info", to_courier: toCourier || null };
  if (ONLINE) return authRest("/rest/v1/messages", { method: "POST", body: m, prefer: "return=minimal" });
  const list = readJSON(LS.messages, []);
  list.push(Object.assign({ id: uuid(), created_at: new Date().toISOString() }, m));
  writeJSON(LS.messages, list.slice(-100));
}

// Messages des dernières 48 h (patron : tous ; livreur : ceux pour lui ou pour tous)
async function listMessages() {
  const since = new Date(Date.now() - 48 * 3600000).toISOString();
  if (ONLINE) {
    const [messages, replies] = await Promise.all([
      authRest("/rest/v1/messages?select=*&order=created_at.desc&created_at=gte." + encodeURIComponent(since)),
      authRest("/rest/v1/message_replies?select=*&created_at=gte." + encodeURIComponent(since))
    ]);
    return { messages: messages || [], replies: replies || [] };
  }
  const id = myId();
  const admin = id === DEMO_ADMIN_ID;
  const messages = readJSON(LS.messages, []).filter(m => m.created_at >= since && (admin || !m.to_courier || m.to_courier === id)).reverse();
  const replies = readJSON(LS.replies, []).filter(r => admin || r.courier_id === id);
  return { messages, replies };
}

async function replyMessage(messageId, answer) {
  if (ONLINE) {
    return authRest("/rest/v1/message_replies?on_conflict=message_id,courier_id", { method: "POST",
      body: { message_id: messageId, courier_id: myId(), answer }, prefer: "resolution=merge-duplicates,return=minimal" });
  }
  const list = readJSON(LS.replies, []).filter(r => !(r.message_id === messageId && r.courier_id === myId()));
  list.push({ message_id: messageId, courier_id: myId(), answer, created_at: new Date().toISOString() });
  writeJSON(LS.replies, list);
}

window.Store = {
  ONLINE, STATUSES, LIVE, LS,
  getSettings, saveSettings,
  welcomeUsed, deviceId,
  createOrder, myOrders, cancelMyOrder, trackOrder, getProfile, saveProfile, getAddresses, saveAddress, deleteAddress,
  useSpace, session, login, logout, me, signupCourier,
  listOrders, updateOrder, assignOrder, acceptOrder, courierAction, ping,
  listCouriers, updateCourier, settleOrders, settleReferrals,
  myBalance, shopSignup, shopByCode, shopDashboard, myShopTokens, rememberShopToken, shopTokenFor, listShops, updateShop, myReferrals,
  sendMessage, listMessages, replyMessage
};

})();
