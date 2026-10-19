// ============================================================================
// Stockage des commandes.
// - Mode démo (Supabase non configuré) : localStorage de l'appareil.
// - Mode en ligne : base Supabase (API REST), partagée entre clients et livreur.
// ============================================================================

(function () {
"use strict";

const LS_ORDERS = "livraison.orders.v1";
const LS_TOKENS = "livraison.myTokens.v1";
const LS_PROFILE = "livraison.profile.v1";
const LS_SESSION = "livraison.adminSession.v1";

const sb = CONFIG.supabase || {};
const ONLINE = !!(sb.url && sb.anonKey);

const STATUSES = {
  nouvelle:  { label: "Nouvelle",       icon: "🆕" },
  confirmee: { label: "Confirmée",      icon: "✅" },
  recuperee: { label: "Colis récupéré", icon: "🛵" },
  livree:    { label: "Livrée",         icon: "📦" },
  annulee:   { label: "Annulée",        icon: "✖️" }
};

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
}

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

// --- Côté client (entreprise) --------------------------------------------------
async function createOrder(order) {
  order = Object.assign({ token: uuid(), ref: newRef(), status: "nouvelle" }, order);
  if (ONLINE) {
    await rest("/rest/v1/orders", { method: "POST", body: order, prefer: "return=minimal" });
  } else {
    order.id = uuid();
    order.created_at = new Date().toISOString();
    const all = readJSON(LS_ORDERS, []);
    all.push(order);
    writeJSON(LS_ORDERS, all);
  }
  const tokens = readJSON(LS_TOKENS, []);
  tokens.push(order.token);
  writeJSON(LS_TOKENS, tokens);
  return order;
}

async function myOrders() {
  const tokens = readJSON(LS_TOKENS, []);
  if (!tokens.length) return [];
  if (ONLINE) return rest("/rest/v1/rpc/orders_by_tokens", { method: "POST", body: { tokens } });
  return readJSON(LS_ORDERS, []).filter(o => tokens.includes(o.token));
}

async function cancelMyOrder(token) {
  if (ONLINE) return rest("/rest/v1/rpc/cancel_order", { method: "POST", body: { p_token: token } });
  const all = readJSON(LS_ORDERS, []);
  const o = all.find(x => x.token === token && x.status === "nouvelle");
  if (o) { o.status = "annulee"; writeJSON(LS_ORDERS, all); }
  return !!o;
}

function getProfile() { return readJSON(LS_PROFILE, {}); }
function saveProfile(p) { writeJSON(LS_PROFILE, p); }

// --- Côté livreur --------------------------------------------------------------
function session() { return readJSON(LS_SESSION, null); }

async function adminLogin(email, password) {
  if (!ONLINE) {
    if (password !== CONFIG.demoAdminPin) throw new Error("Code incorrect.");
    writeJSON(LS_SESSION, { demo: true });
    return;
  }
  const data = await rest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } })
    .catch(() => { throw new Error("Email ou mot de passe incorrect."); });
  writeJSON(LS_SESSION, { access_token: data.access_token, refresh_token: data.refresh_token });
}

function adminLogout() { try { localStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ } }

async function refreshSession() {
  const s = session();
  if (!s || !s.refresh_token) throw new Error("Session expirée");
  const data = await rest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } });
  writeJSON(LS_SESSION, { access_token: data.access_token, refresh_token: data.refresh_token });
}

// Requête authentifiée, avec un nouvel essai après renouvellement du jeton
async function adminRest(path, opts = {}) {
  try {
    return await rest(path, Object.assign({}, opts, { token: session().access_token }));
  } catch (e) {
    if (e.status !== 401) throw e;
    await refreshSession();
    return rest(path, Object.assign({}, opts, { token: session().access_token }));
  }
}

async function allOrders() {
  if (ONLINE) return adminRest("/rest/v1/orders?select=*&order=pickup_at.asc");
  return readJSON(LS_ORDERS, []);
}

async function updateOrder(id, changes) {
  if (ONLINE) {
    return adminRest("/rest/v1/orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: changes, prefer: "return=minimal" });
  }
  const all = readJSON(LS_ORDERS, []);
  const o = all.find(x => x.id === id);
  if (o) Object.assign(o, changes);
  writeJSON(LS_ORDERS, all);
}

window.Store = {
  ONLINE, STATUSES,
  createOrder, myOrders, cancelMyOrder, getProfile, saveProfile,
  session, adminLogin, adminLogout, allOrders, updateOrder
};

})();
