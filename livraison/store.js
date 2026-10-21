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
  replies: "livraison.replies.v1",
  requests: "livraison.requests.v1",
  declines: "livraison.declines.v1",
  sales: "livraison.carnetSales.v1",
  planSales: "livraison.planSales.v1",
  chat: "livraison.chat.v1",
  catalog: "livraison.catalog.v1",
  docs: "livraison.docs.v1",
  penalties: "livraison.penalties.v1",
  topups: "livraison.topups.v1"
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
  carnet_unit: CONFIG.partners.carnet.price / CONFIG.partners.carnet.courses,
  referral_active_days: CONFIG.partners.activeDays,
  deliver_radius: CONFIG.platform.deliverRadius,
  pro_monthly: CONFIG.pro.monthly, pro_shop_share: CONFIG.pro.shopShare, pro_lead_min: CONFIG.pro.leadMinutes,
  pro_hop_share: CONFIG.pro.hopShare, pro_hop_share_client: CONFIG.pro.hopShareClient != null ? CONFIG.pro.hopShareClient : 1, pro_referrer_pct: CONFIG.pro.referrerPercent, pro_referrer_months: CONFIG.pro.referrerMonths,
  network_pct: CONFIG.platform.networkPercent, network_min: CONFIG.platform.networkMin,
  decline_streak_max: CONFIG.platform.declineStreakMax || 3,
  idle_warn_min: 10, idle_off_min: 15, decline_hold_min: 5,
  wait_free_min: CONFIG.pricing.waiting.freeMinutes, wait_step_min: CONFIG.pricing.waiting.stepMinutes,
  wait_step_price: CONFIG.pricing.waiting.stepPrice, wait_max: CONFIG.pricing.waiting.max,
  commission_pct: CONFIG.platform.commissionPercent, commission_min: CONFIG.platform.commissionPerCourse
};

// Commission d'une course : pourcentage du prix, au moins le minimum, arrondie au demi-shekel.
// Course du réseau du livreur (commerce qu'il a amené) : taux réseau, plus bas.
function commissionFor(price, st, network) {
  st = Object.assign({}, DEFAULT_SETTINGS, st || {});
  const pct = Number(network ? st.network_pct : st.commission_pct), min = Number(network ? st.network_min : st.commission_min);
  return Math.max(min, Math.round(Number(price || 0) * pct / 100 * 2) / 2);
}
// Valeur de la course pour le livreur : prix payé + réduction (payée par HOP) + part du commerce − part de HOP
const courseValue = o => Number(o.price || 0) + Number(o.discount || 0) + Number(o.shop_share || 0) - Number(o.hop_share || 0);
// Ce que le livreur gagne sur une course (avant pourboire)
const courierGain = o => courseValue(o) - Number(o.commission || 0);

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
    // Même règle que la base : payée directement au livreur (sauf carnet)
    order.direct_pay = order.payment_method !== "carnet";
    if (order.direct_pay) Object.assign(order, { paid_to: "livreur", prepaid_required: false });
  } else {
    // Même règle que la base en ligne : commerce et parrain retrouvés ici, jamais fournis par le client
    const settings = await getSettings();
    const shops = localShops();
    const shop = order.shop_id && shops.find(x => x.id === order.shop_id && x.status !== "suspendu");
    const referrer = shop && localCouriers().find(c => c.id === shop.referrer_id);
    Object.assign(order, {
      shop_id: shop ? shop.id : null, shop_name: shop ? shop.name : null, referrer_id: referrer ? referrer.id : null,
      referral_bonus: referrer && referrer.role === "coursier" ? Number(settings.referral_bonus) : 0, referral_status: "du",
      // Paiement direct : le client paie le livreur (Bit ou PayBox) ; seul le carnet est payé d'avance à HOP
      direct_pay: order.payment_method !== "carnet", prepaid_required: false,
      paid_to: order.payment_method === "carnet" ? "hop" : "livreur"
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
    // HOP! Pro : commande d'un client chez un commerce abonné → le commerce la confirme et la prépare
    Object.assign(order, { shop_status: null, prep_minutes: null, ready_at: null, shop_share: 0, arrived_at: null, wait_fee: 0 });
    if (shop && planActive(shop) && String(order.shop_order || "").trim() && order.payment_method !== "carnet") {
      // « Le client paie » : pas de part du commerce, HOP prend sa part sur le prix payé par le client
      Object.assign(order, { shop_status: "attente", shop_share: shop.client_pays ? 0 : Number(settings.pro_shop_share), shop_order: String(order.shop_order).trim().slice(0, 1000) });
    } else order.shop_order = null;
    // Articles du catalogue : noms et prix repris du catalogue, produits disponibles seulement
    order.items_total = null;
    if (order.shop_order && Array.isArray(order.items) && order.items.length) {
      const products = localCatalog(shop.id).cat.products;
      const list = order.items.slice(0, 40).map(i => {
        const p = products.find(x => x.id === i.id && x.available);
        return p ? { id: p.id, name: p.name, price: Number(p.price), qty: Math.min(50, Math.max(1, parseInt(i.qty, 10) || 1)) } : null;
      }).filter(Boolean);
      if (list.length) {
        const note = String(order.items_note || "").trim().slice(0, 300);
        Object.assign(order, { items: list, items_total: list.reduce((s, i) => s + i.price * i.qty, 0), items_note: note || null,
          shop_order: (list.map(i => `${i.qty} × ${i.name}`).join("\n") + (note ? "\n💬 " + note : "")).slice(0, 1000) });
      } else order.items = null;
    } else order.items = null;
    // Réduction seulement avec un code (au plus 30 ₪, payée par HOP), part HOP du Pro, pas de pourboire
    Object.assign(order, {
      discount: order.promo_code ? Math.min(30, Math.max(0, Number(order.discount) || 0)) : 0,
      hop_share: order.shop_share > 0 ? Math.min(order.shop_share, Number(settings.pro_hop_share))
        : order.shop_status ? Math.min(Math.max(0, Number(order.price) || 0), Number(settings.pro_hop_share_client)) : 0,
      network: false, tip: 0, tip_status: null,
      shop_ref: shop && /^[0-9]{3}$/.test(String(order.shop_ref || "")) ? order.shop_ref : null
    });
    // « J'achète pour vous » : le client règle le magasin lui-même, le livreur n'avance jamais d'argent
    if (order.service === "achat" && !order.goods_self_pay) throw new Error("goods_pay_required");
    order.goods_self_pay = order.service === "achat";
    if (order.service === "achat" && !order.fits_topcase) throw new Error("topcase_required");
    order.fits_topcase = order.service === "achat";
    // Sans contact : type de lieu, code d'entrée (sauf maison) et n° d'appartement
    if (order.leave_at_door) {
      if (!order.dropoff_kind) throw new Error("door_kind");
      if ((order.dropoff_kind !== "maison" && !String(order.dropoff_code || "").trim()) || (order.dropoff_kind === "appartement" && !String(order.dropoff_apt || "").trim())) throw new Error("door_code");
    }
    // Colis à récupérer : même contrôle que la base (n°, nom ou code, rendez-vous à la poste), documents à vérifier
    if (order.service === "retrait") {
      if (!["poste", "superpharm", "relais", "locker", "autre"].includes(order.place_kind)) throw new Error("retrait_place");
      if (!String(order.tracking_number || "").trim()) throw new Error("retrait_tracking");
      if (order.place_kind === "locker") { if (!String(order.retrait_code || "").trim()) throw new Error("retrait_code"); }
      else { order.retrait_code = null; if (!String(order.parcel_name || "").trim()) throw new Error("retrait_name"); }
      if (order.place_kind === "poste") {
        const a = new Date(order.appt_at).getTime();
        if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) throw new Error("retrait_appt");
        order.pickup_at = new Date(a).toISOString();
      } else order.appt_at = null;
      Object.assign(order, { docs_status: "a_verifier", docs_note: null });
    } else Object.assign(order, { docs_status: null, docs_note: null, retrait_code: null });
    // Cas particuliers (même contrôle que la base) : ordonnance, dépôt à la poste, vente entre particuliers, code de remise
    if (order.service !== "achat") order.rx = false;
    if (order.service !== "colis") Object.assign(order, { post_send: false, p2p_sale: false });
    if (!order.p2p_sale) order.sale_paid = false; else if (!order.sale_paid) throw new Error("sale_unpaid");
    if (order.post_send) {
      const a = new Date(order.appt_at).getTime();
      if (!(a >= Date.now() - 15 * 60000 && a <= Date.now() + 30 * 86400000)) throw new Error("post_appt");
      order.pickup_at = new Date(Math.max(Date.now(), a - 30 * 60000)).toISOString();
    } else if (order.service !== "retrait") order.appt_at = null;
    if (order.service !== "retrait") order.docs_status = order.rx || order.post_send ? "a_verifier" : null;
    order.handoff_ok_at = null;
    order.handoff_code = order.handoff ? String(Math.floor(Math.random() * 10000)).padStart(4, "0") : null;
    // Commande passée par téléphone (commerce pas sur HOP!) : nom, déjà payée, heure « prête » (au plus 3 h)
    if (order.phone_order && !order.shop_id && order.service !== "achat") {
      if (!String(order.pickup_name || "").trim()) throw new Error("phone_name_required");
      if (!order.phone_paid) throw new Error("phone_unpaid");
      const ready = new Date(Math.min(Math.max(new Date(order.phone_ready_at || Date.now()).getTime(), Date.now()), Date.now() + 3 * 3600000));
      Object.assign(order, { pickup_name: String(order.pickup_name).trim().slice(0, 60), phone_ref: String(order.phone_ref || "").trim().slice(0, 20) || null,
        phone_ready_at: ready.toISOString(), ready_at: ready.toISOString(),
        pickup_at: new Date(Math.max(new Date(order.pickup_at).getTime(), ready.getTime())).toISOString() });
    } else Object.assign(order, { phone_order: false, pickup_name: null, phone_ref: null, phone_ready_at: null, phone_paid: false });
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
  if (o) { o.status = "annulee"; refundCarnet(o); chatStatus(o, "nouvelle"); saveLocalOrders(all); }
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
// tag : "home" (Maison), "work" (Travail) ou "other" (avec un nom) ; une seule Maison et un seul Travail.
// Une adresse nommée garde son nom quand elle resservira dans une commande.
const TAG_RANK = { home: 0, work: 1, other: 2 };
function saveAddress(a) {
  const key = [a.street, a.number, a.city, a.apt].join("|").toLowerCase();
  let list = getAddresses().filter(x => [x.street, x.number, x.city, x.apt].join("|").toLowerCase() !== key);
  const old = getAddresses().find(x => [x.street, x.number, x.city, x.apt].join("|").toLowerCase() === key);
  const tag = a.tag || (old && old.tag) || null;
  const name = a.tag ? a.name || null : (old && old.name) || null;
  if (tag === "home" || tag === "work") list = list.map(x => (x.tag === tag ? Object.assign({}, x, { tag: null, name: null }) : x));
  list.unshift(Object.assign({}, a, { tag, name, uses: ((old && old.uses) || 0) + 1, at: Date.now() }));
  const rank = x => (x.tag in TAG_RANK ? TAG_RANK[x.tag] : 9);
  list.sort((x, y) => (rank(x) - rank(y)) || (y.uses - x.uses) || (y.at - x.at));
  writeJSON(LS.addresses, list.slice(0, 10));
}
function deleteAddress(i) { const list = getAddresses(); list.splice(i, 1); writeJSON(LS.addresses, list); }
// Modifier une adresse enregistrée : Maison / Travail / autre nom, étage, appartement, code, note
function updateAddress(i, patch) {
  let list = getAddresses();
  if (!list[i]) return;
  const tag = patch.tag === "other" && !patch.name ? null : patch.tag || null;
  if (tag === "home" || tag === "work") list = list.map((x, j) => (j !== i && x.tag === tag ? Object.assign({}, x, { tag: null, name: null }) : x));
  list[i] = Object.assign({}, list[i], patch, { tag, name: tag === "other" ? patch.name : null });
  const rank = x => (x.tag in TAG_RANK ? TAG_RANK[x.tag] : 9);
  list.sort((x, y) => (rank(x) - rank(y)) || (y.uses - x.uses) || (y.at - x.at));
  writeJSON(LS.addresses, list);
}
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
    if (pending.topcase) await sendTopcase(pending.topcase).catch(() => {});
    removeKey(LS.pendingCourier);
  }
}

function logout() { removeKey(sessionKey); }

// Mot de passe oublié : Supabase envoie un lien ; en revenant, la page demande le nouveau mot de passe
async function resetPassword(email) {
  if (!ONLINE) throw new Error("Indisponible en mode démo.");
  const back = location.origin + location.pathname + "?reset=1";
  await rest("/auth/v1/recover?redirect_to=" + encodeURIComponent(back), { method: "POST", body: { email: email.toLowerCase() } });
}
async function setPassword(password) {
  if (!ONLINE) throw new Error("Indisponible en mode démo.");
  await authRest("/auth/v1/user", { method: "PUT", body: { password } });
}

// Retour du lien de confirmation du mail : Supabase met la session dans l'adresse (#access_token=…).
// On la garde, on crée la fiche préparée à l'inscription (même téléphone), puis on nettoie l'adresse.
async function adoptLinkSession() {
  if (!ONLINE || !/access_token=/.test(location.hash)) return false;
  const h = new URLSearchParams(location.hash.slice(1));
  const recovery = h.get("type") === "recovery";
  history.replaceState(null, "", location.pathname);
  let claims = {};
  try { claims = JSON.parse(atob(h.get("access_token").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch (e) { return false; }
  if (!claims.sub) return false;
  writeJSON(sessionKey, { access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), user_id: claims.sub });
  const pending = readJSON(LS.pendingCourier, null);
  if (pending && pending.email === String(claims.email || "").toLowerCase() && !(await me())) {
    await authRest("/rest/v1/couriers", { method: "POST", body: Object.assign({}, pending.profile, { id: claims.sub }), prefer: "return=minimal" });
    if (pending.topcase) await sendTopcase(pending.topcase).catch(() => {});
    removeKey(LS.pendingCourier);
  }
  return recovery ? "recovery" : true;
}

// Compte connecté sans fiche (inscription commencée sur un autre téléphone) : on complète la fiche
async function completeCourier(profile, topcase) {
  if (!ONLINE) throw new Error("Indisponible en mode démo.");
  await authRest("/rest/v1/couriers", { method: "POST", body: Object.assign({}, profile, { id: myId() }), prefer: "return=minimal" });
  if (topcase) await sendTopcase(topcase);
  removeKey(LS.pendingCourier);
}
function sessionEmail() {
  const s = session();
  try { return JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email || ""; } catch (e) { return ""; }
}

// Fiche du compte connecté (null si pas encore inscrit)
async function me() {
  const id = myId();
  if (!id) return null;
  if (!ONLINE) return localCouriers().find(c => c.id === id) || null;
  const rows = await authRest("/rest/v1/couriers?select=*&id=eq." + encodeURIComponent(id));
  return rows && rows[0] || null;
}

// Inscription d'un livreur (en attente de validation)
async function signupCourier(email, password, profile, topcase) {
  email = email.toLowerCase();
  profile = Object.assign({}, profile, { accepted_terms_at: new Date().toISOString() });
  if (!ONLINE) {
    const list = localCouriers();
    if (list.some(c => c.email === email)) throw new Error("Un compte existe déjà avec cet email.");
    const c = Object.assign({ id: uuid(), email, password, role: "coursier", status: "en_attente", created_at: new Date().toISOString() }, profile,
      topcase ? { topcase, topcase_at: new Date().toISOString() } : {});
    list.push(c);
    writeJSON(LS.couriers, list);
    writeJSON(sessionKey, { demo: true, user_id: c.id });
    return { needsConfirmation: false };
  }
  // Le lien du mail de confirmation ramène sur cette page (et non sur l'adresse par défaut du projet)
  const back = location.origin + location.pathname + "?confirme=1";
  const data = await rest("/auth/v1/signup?redirect_to=" + encodeURIComponent(back), { method: "POST", body: { email, password } })
    .catch(e => { throw new Error(/registered|exists/i.test(e.message) ? "Un compte existe déjà avec cet email." : "Inscription impossible : " + e.message); });
  // Email déjà inscrit : Supabase répond « OK » sans rien envoyer (compte sans identité) ; on le dit
  const u = data.user || data;
  if (!data.access_token && Array.isArray(u.identities) && !u.identities.length) {
    throw new Error("Un compte existe déjà avec cet email : touchez « J'ai déjà un compte » (ou « Mot de passe oublié ? »).");
  }
  if (!data.access_token) {
    // Supabase demande de confirmer l'email : la fiche sera créée à la 1re connexion
    writeJSON(LS.pendingCourier, { email, profile, topcase });
    return { needsConfirmation: true };
  }
  writeJSON(sessionKey, { access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id });
  await authRest("/rest/v1/couriers", { method: "POST", body: Object.assign({}, profile, { id: data.user.id }), prefer: "return=minimal" });
  if (topcase) await sendTopcase(topcase);
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
// En ligne : bouton « en ligne » et position de moins de duty_grace_min minutes (Waze en avant-plan, GPS en pause)
const onlineNow = c => !!(c && c.online && c.position_at && Date.now() - new Date(c.position_at) < (CONFIG.platform.dutyGraceMinutes || 60) * 60000);
const declined = (orderId, courierId) => readJSON(LS.declines, []).some(d => d.order_id === orderId && d.courier_id === courierId);
// Quand la course devient visible : commande Pro ou par téléphone → pro_lead_min min avant l'heure « prête »
function offerFrom(o, st) {
  const created = new Date(o.created_at).getTime();
  if (o.appt_at) return Math.max(created, new Date(o.appt_at) - 40 * 60000);
  return (o.shop_status || o.phone_order) && o.ready_at ? Math.max(created, new Date(o.ready_at) - Number(st.pro_lead_min) * 60000) : created;
}
function canSeeNew(o, id, st) {
  if (o.status !== "nouvelle" || o.courier_id) return false;
  // Hors ligne, ou course déjà refusée : on ne la voit plus
  if (!onlineNow(localCouriers().find(c => c.id === id)) || declined(o.id, id)) return false;
  // HOP! Pro : proposée quand le commerce a accepté, pour arriver au moment où c'est prêt
  if (o.shop_status && !["acceptee", "prete"].includes(o.shop_status)) return false;
  // Colis à récupérer : seulement quand le patron a vérifié les documents
  if (o.docs_status && o.docs_status !== "ok") return false;
  if (Date.now() < offerFrom(o, st)) return false;
  if (o.referrer_id && o.referrer_id === id) return true;
  const ranked = o.pickup_lat == null ? [] : localCouriers()
    .filter(c => c.status === "actif" && c.role === "coursier" && c.lat != null && onlineNow(c) && !declined(o.id, c.id))
    .map(c => ({ id: c.id, d: (c.lat - o.pickup_lat) ** 2 + ((c.lon - o.pickup_lon) * Math.cos(o.pickup_lat * Math.PI / 180)) ** 2 }))
    .sort((a, b) => a.d - b.d);
  const rank = ranked.findIndex(x => x.id === id);
  // Hors service : après les livreurs en service (tout de suite s'il n'y en a aucun)
  const wait = (o.referrer_id ? Number(st.priority_minutes) * 60000 : 0) + Number(st.wave_seconds) * 1000 * Math.min(rank < 0 ? ranked.length : rank, 2);
  return Date.now() - offerFrom(o, st) >= wait;
}

// Ce que le livreur doit à HOP (positif) ou HOP lui doit (négatif), même calcul que la base :
// courses pas réglées (commission − part du commerce pour lui − réduction payée par HOP − course payée à HOP)
// − pourboires reçus par HOP − bonus réseau − part des abonnements Pro
const add = (list, f) => list.reduce((s, o) => s + f(o), 0);
// Ce que le livreur doit à HOP pour une course (même règle que course_due en ligne)
function courseDue(o) {
  const share = Number(o.shop_share || 0), hop = Number(o.hop_share || 0);
  return Number(o.commission || 0) - Number(o.discount || 0)
    + (o.direct_pay ? (share > 0 ? 0 : hop) : hop - share)
    - (o.paid_to === "hop" && o.payment_status === "paye" ? Number(o.price) : 0);
}
function balanceOf(id, all, plans) {
  return add(all.filter(o => o.courier_id === id && o.status === "livree" && o.commission_status !== "regle"),
      courseDue)
    - add(all.filter(o => o.courier_id === id && o.tip_status === "recu" && !o.direct_pay), o => Number(o.tip || 0))
    - add(all.filter(o => o.referrer_id === id && o.courier_id !== id && o.status === "livree" && o.referral_status !== "regle"), o => Number(o.referral_bonus || 0))
    - add((plans || (ONLINE ? [] : readJSON(LS.planSales, []))).filter(p => p.referrer_id === id && p.referrer_status !== "regle"), p => Number(p.referrer_share || 0));
}

// Crédit HOP prépayé du livreur : recharges validées − ce qu'il doit − retenues ; réservé = courses en cours
function creditOf(id) {
  const all = localOrders();
  const tops = add(readJSON(LS.topups, []).filter(x => x.courier_id === id && x.status === "ok"), x => Number(x.amount));
  const pen = add(readJSON(LS.penalties, []).filter(p => p.courier_id === id && p.status === "du"), p => Number(p.amount));
  return { credit: tops - balanceOf(id, all) - pen,
    reserved: add(all.filter(o => o.courier_id === id && ["confirmee", "recuperee"].includes(o.status)), o => Math.max(0, courseDue(o))) };
}
async function myCredit() {
  if (ONLINE) return authRest("/rest/v1/rpc/my_credit", { method: "POST", body: {} });
  const id = myId();
  return Object.assign(creditOf(id), { topups: readJSON(LS.topups, []).filter(x => x.courier_id === id) });
}
async function declareTopup(amount) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_topup_declare", { method: "POST", body: { p_amount: amount } });
  const a = Number(amount);
  if (!(a >= 5 && a <= 2000)) throw new Error("bad_amount");
  const list = readJSON(LS.topups, []);
  if (list.filter(x => x.courier_id === myId() && x.status === "attente").length >= 3) throw new Error("too_many");
  const t = { id: uuid(), courier_id: myId(), amount: a, status: "attente", note: null, created_at: new Date().toISOString(), decided_at: null };
  writeJSON(LS.topups, [t, ...list]);
  return t.id;
}
async function adminCredits() {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_credits", { method: "POST", body: {} });
  const couriers = localCouriers();
  return { credits: couriers.filter(c => c.role === "coursier").map(c => Object.assign({ courier_id: c.id }, creditOf(c.id))),
    topups: readJSON(LS.topups, []).map(x => Object.assign({ courier_name: (couriers.find(c => c.id === x.courier_id) || {}).name || "" }, x)) };
}
async function decideTopup(id, ok) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_topup_decide", { method: "POST", body: { p_id: id, p_ok: !!ok } });
  const list = readJSON(LS.topups, []), t = list.find(x => x.id === id && x.status === "attente");
  if (!t) return false;
  Object.assign(t, { status: ok ? "ok" : "refuse", decided_at: new Date().toISOString() });
  writeJSON(LS.topups, list);
  return true;
}
async function addTopup(courierId, amount, note, paid) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_topup_add", { method: "POST", body: { p_courier: courierId, p_amount: amount, p_note: note || null, p_paid: paid !== false } });
  const a = Number(amount);
  if (!(a >= 5 && a <= 2000)) throw new Error("bad_amount");
  const t = { id: uuid(), courier_id: courierId, amount: a, status: "ok", note: note || null, created_at: new Date().toISOString(), decided_at: new Date().toISOString() };
  writeJSON(LS.topups, [t, ...readJSON(LS.topups, [])]);
  return t.id;
}
async function myBalance() {
  if (ONLINE) return Number(await authRest("/rest/v1/rpc/my_balance", { method: "POST", body: {} })) || 0;
  return balanceOf(myId(), localOrders());
}

// Démo : numéro suivant, commun aux reçus des courses et des carnets (comme receipt_seq en ligne)
function nextLocalReceipt() {
  return [...localOrders(), ...readJSON(LS.sales, [])].reduce((m, x) => Math.max(m, x.receipt_number || 0), 0) + 1;
}

// Démo : même règle que la base en ligne pour numéroter les reçus
function localReceipt(o) {
  const c = localCouriers().find(x => x.id === o.courier_id);
  if (o.status === "livree" && o.payment_status === "paye" && !o.receipt_number && o.payment_method !== "carnet" && c && c.role === "admin") {
    o.receipt_number = nextLocalReceipt();
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
    referralCheck(o, was, all, await getSettings());
    localReceipt(o);
    if (!["annulee", "refusee"].includes(was)) refundCarnet(o);
    chatStatus(o, was);
  }
  saveLocalOrders(all);
}

// Démo : chaque étape de la course s'affiche dans sa conversation (comme en ligne)
function chatStatus(o, was) {
  if (o.status !== was && ["confirmee", "recuperee", "livree", "refusee", "annulee"].includes(o.status)) {
    chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:" + o.status });
  }
}

// Bonus de parrainage seulement si le parrain livre encore avec nous (même règle qu'en ligne)
function referralCheck(o, was, all, st) {
  if (o.status !== "livree" || was === "livree" || !(Number(o.referral_bonus) > 0) || o.courier_id === o.referrer_id) return;
  const since = Date.now() - Number(st.referral_active_days) * 86400000;
  const c = localCouriers().find(x => x.id === o.referrer_id);
  const active = c && (new Date(c.created_at || 0) > since
    || all.some(x => x.courier_id === c.id && x.status === "livree" && new Date(x.pickup_at) > since));
  if (!active) o.referral_bonus = 0;
}

// Course de carnet annulée ou refusée : la course est rendue au commerce
function refundCarnet(o) {
  if (o.payment_method !== "carnet" || !["annulee", "refusee"].includes(o.status)) return;
  const shops = localShops();
  const s = shops.find(x => x.id === o.shop_id);
  if (s) { s.credits = (s.credits || 0) + 1; writeJSON(LS.shops, shops); }
}

// Champs à copier sur la course quand un livreur la prend (commission réseau si le commerce est à lui)
async function courierFields(c, o) {
  const settings = await getSettings();
  const network = !!o.referrer_id && o.referrer_id === c.id;
  return {
    status: "confirmee", courier_id: c.id, courier_name: c.name, courier_phone: c.phone, network,
    courier_bit: c.bit_phone || c.phone, commission: c.role === "admin" ? 0 : commissionFor(courseValue(o), settings, network)
  };
}

// Le patron attribue une course à un livreur (ou à lui-même)
async function assignOrder(o, courier) {
  return updateOrder(o.id, await courierFields(courier, o));
}

// Un livreur accepte une course libre (le premier qui accepte la prend)
// eta : dans combien de minutes le livreur est au départ (le client peut refuser si c'est trop long)
const etaChoice = o => ["asap", "express"].includes(o.urgency) && !o.shop_status && !o.phone_order && !o.appt_at;
async function acceptOrder(id, eta) {
  if (ONLINE) return authRest("/rest/v1/rpc/accept_order", { method: "POST", body: eta != null ? { p_id: id, p_eta: eta } : { p_id: id } });
  const all = localOrders();
  const c = localCouriers().find(x => x.id === myId() && x.status === "actif");
  const st = await getSettings();
  const o = c && all.find(x => x.id === id && (c.role === "admin" || canSeeNew(x, c.id, st)));
  if (!o || !c) return false;
  if (c.role === "coursier" && !(c.unlocked_until && new Date(c.unlocked_until) > new Date())) {
    if (balanceOf(c.id, all) > Number(st.max_debt)) throw new Error("debt");
    if (all.some(x => x.courier_id === c.id && x.status === "recuperee")) throw new Error("busy");
  }
  if (c.role === "coursier" && !onlineNow(c)) throw new Error("offline");
  const was = o.status;
  Object.assign(o, await courierFields(c, o));
  if (eta != null) {
    const m = Math.min(180, Math.max(1, Math.round(Number(eta) || 15)));
    Object.assign(o, { eta_min: m, eta_at: new Date(Date.now() + m * 60000).toISOString(),
      eta_status: etaChoice(o) ? "attente" : "ok", eta_until: etaChoice(o) ? new Date(Date.now() + 180000).toISOString() : null });
  }
  chatStatus(o, was);
  saveLocalOrders(all);
  return true;
}
// Le client : « D'accord » ou « Trop long : un autre livreur » (3 minutes pour répondre)
async function answerEta(token, ok) {
  if (ONLINE) return rest("/rest/v1/rpc/order_eta_answer", { method: "POST", body: { p_token: token, p_ok: ok } });
  const all = localOrders(), o = all.find(x => x.token === token);
  if (!o || o.status !== "confirmee" || o.eta_status !== "attente") return false;
  if (ok) { o.eta_status = "ok"; saveLocalOrders(all); return true; }
  if (Date.now() > new Date(o.eta_until)) return false;
  const declines = readJSON(LS.declines, []);
  declines.push({ order_id: o.id, courier_id: o.courier_id, created_at: new Date().toISOString() });
  writeJSON(LS.declines, declines);
  chatLocalAdd({ thread: "c:" + o.courier_id, author: "admin", author_name: "HOP!", image: null,
    body: `↩️ Course n° ${o.ref} : le client a préféré un autre livreur (${o.eta_min} min, trop long pour lui). Elle n'est plus à vous, pas de souci.` });
  Object.assign(o, { status: "nouvelle", courier_id: null, courier_name: null, courier_phone: null, courier_bit: null, commission: 0, network: false,
    eta_min: null, eta_at: null, eta_status: null, eta_until: null, eta_refusals: (o.eta_refusals || 0) + 1 });
  saveLocalOrders(all);
  return true;
}

// Livreur : "recuperee", "livree", "paye" ou "liberer" (rendre la course)
// --- Course pas reçue / pas faite : signalement du client, retenue au livreur (déduite de son versement) ----
async function claimOrder(token, note) {
  if (ONLINE) return rest("/rest/v1/rpc/order_claim", { method: "POST", body: { p_token: token, p_note: note || null } });
  const all = localOrders(), o = all.find(x => x.token === token);
  if (!o || o.status !== "livree" || o.claim_status || Date.now() - new Date(o.delivered_at || o.pickup_at) > 48 * 3600000) return false;
  Object.assign(o, { claim_status: "ouverte", claim_note: String(note || "").trim().slice(0, 300) || null, claim_at: new Date().toISOString() });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "client", author_name: o.contact_name, image: null,
    body: "⚠️ Commande pas reçue · ההזמנה לא הגיעה" + (o.claim_note ? " : " + o.claim_note : "") });
  return true;
}
async function penaltyAdd(courierId, orderId, amount, reason) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_penalty_add", { method: "POST", body: { p_courier: courierId, p_order: orderId || null, p_amount: amount, p_reason: reason } });
  const all = localOrders(), o = orderId && all.find(x => x.id === orderId);
  const p = { id: uuid(), courier_id: courierId, order_id: orderId || null, order_ref: o ? o.ref : null, amount: Math.round(Number(amount) * 100) / 100,
    reason: String(reason).trim().slice(0, 300), status: "du", created_at: new Date().toISOString(), settled_at: null };
  writeJSON(LS.penalties, [p, ...readJSON(LS.penalties, [])]);
  if (o && o.claim_status === "ouverte") { o.claim_status = "retenue"; saveLocalOrders(all); }
  chatLocalAdd({ thread: "c:" + courierId, author: "admin", author_name: "HOP!", image: null,
    body: `💸 Retenue de ${p.amount} ₪${p.order_ref ? " · course n° " + p.order_ref : ""} : ${p.reason}. Elle est déduite de votre prochain versement. Vous pouvez répondre ici avec vos preuves (photo, position).` });
  return p.id;
}
async function penaltyCancel(id) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_penalty_cancel", { method: "POST", body: { p_id: id } });
  const list = readJSON(LS.penalties, []), p = list.find(x => x.id === id && x.status === "du");
  if (!p) return false;
  p.status = "annulee";
  writeJSON(LS.penalties, list);
  chatLocalAdd({ thread: "c:" + p.courier_id, author: "admin", author_name: "HOP!", image: null, body: `✅ Retenue de ${p.amount} ₪ annulée${p.order_ref ? " (course n° " + p.order_ref + ")" : ""}.` });
  return true;
}
async function claimClose(orderId) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_claim_close", { method: "POST", body: { p_order: orderId } });
  const all = localOrders(), o = all.find(x => x.id === orderId && x.claim_status === "ouverte");
  if (!o) return false;
  o.claim_status = "classee";
  saveLocalOrders(all);
  return true;
}
async function listPenalties() {
  if (ONLINE) return (await authRest("/rest/v1/rpc/admin_penalties", { method: "POST", body: {} })) || [];
  return readJSON(LS.penalties, []);
}
async function myPenalties() {
  if (ONLINE) return (await authRest("/rest/v1/rpc/my_penalties", { method: "POST", body: {} })) || [];
  return readJSON(LS.penalties, []).filter(p => p.courier_id === myId() && p.status !== "annulee");
}
async function settlePenalties(courierId) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_penalties_settle", { method: "POST", body: { p_courier: courierId } });
  const list = readJSON(LS.penalties, []);
  list.forEach(p => { if (p.courier_id === courierId && p.status === "du") Object.assign(p, { status: "regle", settled_at: new Date().toISOString() }); });
  writeJSON(LS.penalties, list);
  return true;
}

// Code de remise (clés, objet de valeur) : le livreur tape le code donné par le destinataire
async function courierHandoff(id, code) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_handoff", { method: "POST", body: { p_id: id, p_code: code } });
  const all = localOrders(), o = all.find(x => x.id === id && x.courier_id === myId() && x.status === "recuperee" && x.handoff);
  if (!o) return false;
  o.handoff_tries = (o.handoff_tries || 0) + 1;
  if (o.handoff_tries > 5) { saveLocalOrders(all); throw new Error("too_many_tries"); }
  const ok = String(code || "").trim() === o.handoff_code;
  if (ok) o.handoff_ok_at = new Date().toISOString();
  saveLocalOrders(all);
  return ok;
}

async function courierAction(id, action) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_update", { method: "POST", body: { p_id: id, p_action: action } });
  const all = localOrders();
  const o = all.find(x => x.id === id && x.courier_id === myId());
  if (!o) return false;
  const was = o.status;
  const st = await getSettings();
  const cr = localCouriers().find(x => x.id === myId());
  const freeOf = () => o.unlocked || (cr && cr.unlocked_until && new Date(cr.unlocked_until) > new Date());
  if (action === "arrivee" && o.status === "confirmee" && !o.arrived_at) {
    // Même règle qu'en ligne : au départ seulement (le compteur d'attente démarre)
    if (!freeOf() && o.pickup_lat != null && (!cr || cr.lat == null || Date.now() - new Date(cr.position_at) > 180000
      || Pricing.haversineKm({ lat: cr.lat, lon: cr.lon }, { lat: o.pickup_lat, lon: o.pickup_lon }) * 1000 > Number(st.deliver_radius) * 1.5)) {
      throw new Error("too_far_pickup");
    }
    o.arrived_at = new Date().toISOString();
    chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:arrivee" });
  } else if (action === "recuperee" && o.status === "confirmee") {
    // Même règle qu'en ligne : en paiement direct, payé avant de récupérer la commande
    if (!freeOf() && o.direct_pay && o.paid_to === "livreur" && o.payment_status !== "paye" && cr && cr.role !== "admin") throw new Error("payment_required_pickup");
    // HOP! Pro : c'est le commerce qui paie l'attente (sa part de la livraison augmente)
    const w = waitFee(o, st);
    Object.assign(o, { status: "recuperee", wait_minutes: w.mins, wait_fee: w.fee });
    if (o.shop_status) o.shop_share = Number(o.shop_share || 0) + w.fee;
    else {
      o.price = Number(o.price) + w.fee;
      if (w.fee > 0 && o.payment_status === "paye") o.payment_status = "en_attente";
    }
  }
  else if (action === "livree" && o.status === "recuperee") {
    // Même règle qu'en ligne : sur place seulement (position de moins de 3 min, dans le rayon)
    const c = localCouriers().find(x => x.id === myId());
    const st = await getSettings();
    const free = o.unlocked || (c && c.unlocked_until && new Date(c.unlocked_until) > new Date());
    if (!free && o.dropoff_lat != null && (!c || c.lat == null || Date.now() - new Date(c.position_at) > 180000
      || Pricing.haversineKm({ lat: c.lat, lon: c.lon }, { lat: o.dropoff_lat, lon: o.dropoff_lon }) * 1000 > Number(st.deliver_radius))) {
      throw new Error("too_far");
    }
    // « Déposer devant la porte » : photo du colis obligatoire dans la conversation
    if (!free && o.leave_at_door && !chatLocal().some(m => m.thread === "o:" + o.id && m.author === "courier" && m.image)) throw new Error("photo_required");
    // Clés ou objet de valeur : le destinataire a donné le bon code de remise
    if (!free && o.handoff && !o.handoff_ok_at) throw new Error("handoff_required");
    // Paiement direct : « 💳 Paiement reçu » avant « Livré »
    if (!free && o.direct_pay && o.paid_to === "livreur" && o.payment_status !== "paye" && c && c.role !== "admin") throw new Error("payment_required");
    o.status = "livree"; o.delivered_at = new Date().toISOString(); referralCheck(o, "recuperee", all, await getSettings()); }
  else if (action === "paye" && o.paid_to !== "hop") o.payment_status = "paye";
  else if (action === "liberer" && o.status === "confirmee") {
    // Même règle qu'en ligne : déjà payé (ou « j'ai payé ») → ce livreur rembourse le client ; tout repart à zéro
    const paid = o.direct_pay && o.paid_to === "livreur" && (o.payment_status === "paye" || o.client_paid_at);
    if (paid) Object.assign(o, { refund_amount: o.price, refund_courier_id: o.courier_id, refund_courier_name: o.courier_name,
      refund_courier_phone: o.courier_bit || o.courier_phone, refund_received: o.payment_status === "paye", refund_status: "a_faire", refund_at: new Date().toISOString() });
    if (o.paid_to === "livreur") o.payment_status = "en_attente";
    Object.assign(o, { status: "nouvelle", courier_id: null, courier_name: null, courier_phone: null, courier_bit: null, commission: 0,
      client_paid_at: null, pay_missing_at: null, arrived_at: null, eta_min: null, eta_at: null, eta_status: null, eta_until: null, released_at: new Date().toISOString() });
    chatLocalAdd({ thread: "o:" + o.id, author: "system", body: paid ? "status:refund_due" : "status:released" });
    const dl = readJSON(LS.declines, []);
    if (!dl.some(d => d.order_id === o.id && d.courier_id === myId())) { dl.push({ order_id: o.id, courier_id: myId(), reason: "autre", created_at: new Date().toISOString() }); writeJSON(LS.declines, dl.slice(-500)); }
  } else return false;
  chatStatus(o, was);
  saveLocalOrders(all);
  return true;
}

// Supplément d'attente / d'achats (même calcul qu'en ligne)
function waitFee(o, st) {
  if (!o.arrived_at) return { mins: 0, fee: 0 };
  // Commande d'un commerce HOP! Pro : l'attente compte à partir de l'heure annoncée par le commerce
  const from = Math.max(new Date(o.arrived_at), o.ready_at ? new Date(o.ready_at) : 0);
  const mins = Math.max(0, Math.floor((Date.now() - from) / 60000));
  const fee = Math.min(Number(st.wait_max), Math.ceil(Math.max(0, mins - Number(st.wait_free_min)) / Number(st.wait_step_min)) * Number(st.wait_step_price));
  return { mins, fee };
}

// Livreur : en ligne / hors ligne
async function setOnline(on) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_set_online", { method: "POST", body: { p_on: !!on } });
  const list = localCouriers();
  const c = list.find(x => x.id === myId());
  if (c) { if (on && !c.online) c.decline_streak = 0; c.online = !!on; }
  writeJSON(LS.couriers, list);
}
// Livreur : refuser une course, avec la raison (elle passe tout de suite au livreur suivant).
// Trop de refus d'affilée (settings.decline_streak_max) : il passe hors ligne → { offline: true }
const DECLINE_REASONS = ["loin", "prix", "taille", "occupe", "fin", "autre", "sans_reponse"];
async function declineOrder(id, reason) {
  const r = DECLINE_REASONS.includes(reason) ? reason : "autre";
  if (ONLINE) return authRest("/rest/v1/rpc/decline_offer", { method: "POST", body: { p_id: id, p_reason: r } });
  const list = readJSON(LS.declines, []);
  if (list.some(d => d.order_id === id && d.courier_id === myId())) return { ok: true, offline: false };
  list.push({ order_id: id, courier_id: myId(), reason: r, created_at: new Date().toISOString() });
  writeJSON(LS.declines, list.slice(-500));
  const st = await getSettings(), max = Number(st.decline_streak_max || 3);
  const all = localCouriers(), c = all.find(x => x.id === myId());
  if (!c || c.role === "admin") return { ok: true, offline: false };
  c.decline_streak = Number(c.decline_streak || 0) + 1;
  let offline = false;
  if (c.decline_streak >= max) {
    Object.assign(c, { online: false, decline_streak: 0, auto_offline_at: new Date().toISOString() });
    chatLocalAdd({ thread: "c:" + c.id, author: "system", body: "status:autooff" });
    offline = true;
  }
  writeJSON(LS.couriers, all);
  return { ok: true, offline, streak: offline ? max : c.decline_streak, max };
}
// Patron : les refus des 30 derniers jours (raisons), pour voir qui refuse trop et pourquoi
async function listDeclines() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  if (ONLINE) return authRest("/rest/v1/order_declines?select=*&created_at=gte." + encodeURIComponent(since) + "&order=created_at.desc&limit=2000");
  return readJSON(LS.declines, []).filter(d => d.created_at >= since);
}
// Livreur : taux d'acceptation (30 jours) et prévisions de demande par heure
async function myAcceptance() {
  if (ONLINE) return authRest("/rest/v1/rpc/my_acceptance", { method: "POST", body: {} });
  const since = Date.now() - 30 * 86400000;
  return { accepted: localOrders().filter(o => o.courier_id === myId() && new Date(o.created_at) > since).length,
    declined: readJSON(LS.declines, []).filter(d => d.courier_id === myId() && new Date(d.created_at) > since).length };
}
async function demandForecast() {
  if (ONLINE) return authRest("/rest/v1/rpc/demand_forecast", { method: "POST", body: {} });
  const dow = new Date().getDay(), since = Date.now() - 28 * 86400000;
  const h = Array(24).fill(0);
  localOrders().filter(o => new Date(o.created_at) > since && new Date(o.created_at).getDay() === dow && !["annulee", "refusee"].includes(o.status))
    .forEach(o => { h[new Date(o.created_at).getHours()] += 0.25; });
  return h;
}

// Livreurs : commandes de chaque heure d'aujourd'hui (les vraies, pour la courbe « Aujourd'hui »)
async function todayHours() {
  if (ONLINE) return authRest("/rest/v1/rpc/today_hours", { method: "POST", body: {} });
  const h = Array(24).fill(0), d0 = new Date(); d0.setHours(0, 0, 0, 0);
  localOrders().filter(o => new Date(o.created_at) >= d0 && !["annulee", "refusee"].includes(o.status))
    .forEach(o => { h[new Date(o.created_at).getHours()] += 1; });
  return h;
}
// Livreurs : demande en direct (courses en attente, commandes de la dernière heure, livreurs en service)
async function zoneDemand() {
  if (ONLINE) return authRest("/rest/v1/rpc/zone_demand", { method: "POST", body: {} });
  const all = localOrders(), hour = Date.now() - 3600000, ten = Date.now() - 600000;
  return {
    waiting: all.filter(o => o.status === "nouvelle" && !o.courier_id).length,
    last_hour: all.filter(o => new Date(o.created_at) > hour && !["annulee", "refusee"].includes(o.status)).length,
    on_duty: localCouriers().filter(c => c.status === "actif" && onlineNow(c)).length
  };
}

// Clients : les livreurs en ligne autour (position arrondie à ≈ 500 m, sans nom)
const RATING_TAGS = { fast: "Rapide", nice: "Sympa", care: "Soigneux", found: "Bien trouvé", late: "En retard", damaged: "Colis abîmé", rude: "Pas aimable", lost: "Colis perdu" };
async function couriersNearby() {
  if (ONLINE) return rest("/rest/v1/rpc/couriers_nearby", { method: "POST", body: {} });
  const busy = new Set(localOrders().filter(o => ["confirmee", "recuperee"].includes(o.status)).map(o => o.courier_id));
  return localCouriers().filter(c => c.status === "actif" && c.lat != null && onlineNow(c))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(c => ({ lat: Math.round(c.lat * 500) / 500, lon: Math.round(c.lon * 500) / 500, free: !busy.has(c.id) }));
}

// Clients : l'annuaire des commerces partenaires vérifiés (sans téléphone ni clé)
// Enseignes apprises (absentes de la carte, indiquées par des clients) : par nom
async function placesSearch(q) {
  if (ONLINE) return rest("/rest/v1/rpc/places_search", { method: "POST", body: { p_q: q } });
  const n = String(q || "").trim().toLowerCase();
  return n.length < 2 ? [] : readJSON("livraison.knownPlaces.v1", []).filter(x => x.name.toLowerCase().includes(n)).slice(0, 5);
}
async function shopsDirectory() {
  if (ONLINE) return rest("/rest/v1/rpc/shops_directory", { method: "POST", body: {} });
  return localShops().filter(x => x.status === "actif")
    .map(x => ({ code: x.code, name: x.name, kind: x.kind, city: x.city, address: x.address, lat: x.lat, lon: x.lon, pro: planActive(x) }));
}

// Vitrine HOP! Pro : les commerces abonnés pour l'accueil, et le logo / la couverture / l'accroche du commerce
async function shopsShowcase() {
  if (ONLINE) return (await rest("/rest/v1/rpc/shops_showcase", { method: "POST", body: {} })) || [];
  const cat = readJSON(LS.catalog, {});
  return localShops().filter(x => x.status === "actif" && planActive(x))
    .map(x => ({ code: x.code, name: x.name, kind: x.kind, city: x.city, logo: x.logo || null, cover: x.cover || null, tagline: x.tagline || null,
      client_pays: !!x.client_pays, products: ((cat[x.id] || {}).products || []).filter(p => p.available).length }))
    .sort((a, b) => (!!b.cover - !!a.cover) || (!!b.logo - !!a.logo) || a.name.localeCompare(b.name));
}
// Qui paie la livraison : true = le client paie tout, false = le commerce paie sa part (12 ₪)
async function setShopClientPays(token, on) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_set_client_pays", { method: "POST", body: { p_token: token, p_on: !!on } });
  const shops = localShops(), s = shops.find(x => x.token === token);
  if (!s) return false;
  s.client_pays = !!on;
  writeJSON(LS.shops, shops);
  return true;
}
// logo / cover : null = garder, "" = enlever
async function saveShopBrand(token, b) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_brand_save", { method: "POST", body: { p_token: token, p_logo: b.logo, p_cover: b.cover, p_tagline: b.tagline || null } });
  const shops = localShops(), s = shops.find(x => x.token === token);
  if (!s) return false;
  if (b.logo != null) s.logo = b.logo || null;
  if (b.cover != null) s.cover = b.cover || null;
  s.tagline = String(b.tagline || "").trim().slice(0, 90) || null;
  writeJSON(LS.shops, shops);
  return true;
}

// HOP! Pro : le commerce accepte une commande avec un temps de préparation, la marque prête, ou la refuse
async function shopOrderAction(token, id, action, minutes, reason, ref, bags) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_order_action", { method: "POST", body: { p_token: token, p_id: id, p_action: action, p_minutes: minutes || null, p_reason: reason || null, p_ref: ref || null, p_bags: bags || null } });
  const shop = localShops().find(x => x.token === token);
  const all = localOrders();
  const o = shop && all.find(x => x.id === id && x.shop_id === shop.id);
  if (!o) return false;
  const was = o.status;
  if (action === "accepter" && o.shop_status === "attente" && o.status === "nouvelle") {
    if (!/^[0-9]{3}$/.test(String(ref || "").trim())) throw new Error("shop_ref_required");
    const m = Math.min(90, Math.max(5, Number(minutes) || 15));
    Object.assign(o, { shop_status: "acceptee", shop_ref: String(ref).trim(), prep_minutes: m, ready_at: new Date(Date.now() + m * 60000).toISOString() });
    chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:shop_ok" });
  } else if (action === "prete" && o.shop_status === "acceptee") {
    Object.assign(o, { shop_status: "prete", ready_at: new Date(Math.min(Date.now(), new Date(o.ready_at))).toISOString() });
    if (Number(bags) >= 1 && Number(bags) <= 20) o.bags_count = Number(bags);
    chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:prete" });
  } else if (action === "refuser" && o.shop_status === "attente" && o.status === "nouvelle") {
    Object.assign(o, { shop_status: "refusee", status: "refusee", admin_note: String(reason || "").trim().slice(0, 300) || null });
    chatStatus(o, was);
  } else return false;
  saveLocalOrders(all);
  return true;
}

// Client : ajouter des articles du même commerce à sa commande (15 min, tant qu'elle n'est pas prête)
async function orderAddable(token) {
  if (ONLINE) return rest("/rest/v1/rpc/order_addable", { method: "POST", body: { p_token: token } });
  return null;   // mode démo : pas d'ajout
}
async function orderAddItems(token, items, topcase) {
  if (ONLINE) return rest("/rest/v1/rpc/order_add_items", { method: "POST", body: { p_token: token, p_items: items, p_topcase: !!topcase } });
  return { ok: false, error: "demo" };
}

// Client : noter sa livraison (une fois, dans les 7 jours) ; une note basse arrive chez le patron
async function rateOrder(token, stars, tags, note) {
  if (ONLINE) return rest("/rest/v1/rpc/rate_order", { method: "POST", body: { p_token: token, p_stars: stars, p_tags: tags || [], p_note: note || null } });
  const all = localOrders();
  const o = all.find(x => x.token === token && x.status === "livree" && x.rating == null && Date.now() - new Date(x.pickup_at) < 7 * 86400000);
  if (!o || !(stars >= 1 && stars <= 5)) return false;
  const ok = (tags || []).filter(x => RATING_TAGS[x]);
  Object.assign(o, { rating: stars, rating_tags: ok, rating_note: String(note || "").trim().slice(0, 300) || null, rated_at: new Date().toISOString() });
  saveLocalOrders(all);
  if (stars <= 3 || o.rating_note) {
    chatLocalAdd({ thread: "o:" + o.id, author: "client", author_name: o.contact_name,
      body: "⭐".repeat(stars) + ` ${stars}/5` + (ok.length ? " · " + ok.map(x => RATING_TAGS[x]).join(", ") : "") + (o.rating_note ? "\n" + o.rating_note : "") });
  }
  return true;
}

// Pourboire du client après la livraison (une fois, dans les 7 jours) : 100 % pour le livreur,
// payé à HOP par Bit puis reversé au livreur quand HOP l'a reçu
async function tipOrder(token, amount) {
  if (ONLINE) return rest("/rest/v1/rpc/tip_order", { method: "POST", body: { p_token: token, p_amount: amount } });
  const n = Math.round(Number(amount));
  if (!(n >= 1 && n <= 100)) return false;
  const all = localOrders();
  const o = all.find(x => x.token === token && x.status === "livree" && x.courier_id && !x.tip_status && Date.now() - new Date(x.pickup_at) < 7 * 86400000);
  if (!o) return false;
  Object.assign(o, { tip: n, tip_status: "promis" });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:tip" });
  return true;
}

// Notifications push : le téléphone connecté (patron ou livreur) s'abonne
async function pushSubscribe(endpoint, p256dh, auth) {
  if (!ONLINE || !session()) return false;
  return authRest("/rest/v1/rpc/push_subscribe", { method: "POST", body: { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth } });
}

// Le client a payé par Bit (il le déclare) : le patron vérifie son Bit
// Livreur : « ❌ Pas reçu » (le client dit avoir payé, mais rien n'est arrivé : il doit vérifier)
async function payMissing(id) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_pay_missing", { method: "POST", body: { p_id: id } });
  const all = localOrders(), o = all.find(x => x.id === id && x.courier_id === myId() && x.payment_status !== "paye");
  if (!o) return false;
  Object.assign(o, { client_paid_at: null, pay_missing_at: new Date().toISOString() });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:pay_missing" });
  return true;
}
// Livreur : remboursements à faire (course rendue après paiement), puis « J'ai remboursé » / « Je n'avais rien reçu »
async function myRefunds() {
  if (ONLINE) return authRest("/rest/v1/rpc/my_refunds", { method: "POST", body: {} });
  return localOrders().filter(o => o.refund_courier_id === myId() && ["a_faire", "litige"].includes(o.refund_status))
    .map(o => ({ id: o.id, ref: o.ref, amount: o.refund_amount, received: o.refund_received, status: o.refund_status, at: o.refund_at, name: o.contact_name, phone: o.contact_phone }));
}
async function refundDone(id, done) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_refund_done", { method: "POST", body: { p_id: id, p_done: !!done } });
  const all = localOrders(), o = all.find(x => x.id === id && x.refund_courier_id === myId());
  if (!o) return false;
  o.refund_status = done ? "fait" : "rien_recu";
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: done ? "status:refund_done" : "status:refund_none" });
  return true;
}
// Client : « ✅ J'ai été remboursé » ou « ❌ Pas remboursé » (le patron est prévenu)
async function refundAnswer(token, ok) {
  if (ONLINE) return rest("/rest/v1/rpc/client_refund_answer", { method: "POST", body: { p_token: token, p_ok: !!ok } });
  const all = localOrders(), o = all.find(x => x.token === token && ["a_faire", "fait", "rien_recu"].includes(x.refund_status));
  if (!o) return false;
  o.refund_status = ok ? "recu" : "litige";
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: ok ? "status:refund_ok" : "status:refund_missing" });
  return true;
}
async function clientPaid(token) {
  if (ONLINE) return rest("/rest/v1/rpc/order_client_paid", { method: "POST", body: { p_token: token } });
  const all = localOrders();
  const o = all.find(x => x.token === token && x.payment_method === "bit" && x.payment_status === "en_attente" && !x.client_paid_at && !["annulee", "refusee"].includes(x.status));
  if (!o) return false;
  o.client_paid_at = new Date().toISOString();
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:client_paid" });
  return true;
}

// Le client change son moyen de paiement (espèces ↔ Bit) tant que rien n'est payé
async function setPayment(token, method) {
  if (ONLINE) return rest("/rest/v1/rpc/order_set_payment", { method: "POST", body: { p_token: token, p_method: method } });
  const all = localOrders();
  const o = all.find(x => x.token === token && ["cash", "bit"].includes(x.payment_method) && x.payment_method !== method
    && x.payment_status === "en_attente" && ["nouvelle", "confirmee", "recuperee"].includes(x.status) && !(method === "cash" && x.prepaid_required));
  if (!o) return false;
  Object.assign(o, { payment_method: method, paid_to: method === "bit" && !o.direct_pay ? "hop" : "livreur", client_paid_at: null });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "system", body: "status:pay_" + method });
  return true;
}

// HOP! Pro : le patron prolonge d'un mois (payé ou offert) ; payé → 20 % pour le livreur qui a amené le commerce
async function planExtend(shopId, paid) {
  if (ONLINE) return authRest("/rest/v1/rpc/shop_plan_extend", { method: "POST", body: { p_shop: shopId, p_paid: !!paid } });
  const st = await getSettings();
  const shops = localShops(), s = shops.find(x => x.id === shopId);
  if (!s) throw new Error("not_found");
  const today = new Date().toISOString().slice(0, 10);
  const base = new Date((planActive(s) ? s.plan_until : today) + "T12:00:00");
  base.setMonth(base.getMonth() + 1);
  s.plan_until = base.toISOString().slice(0, 10);
  writeJSON(LS.shops, shops);
  let share = 0;
  if (paid) {
    const sales = readJSON(LS.planSales, []);
    const first = sales.filter(x => x.shop_id === shopId).map(x => x.created_at).sort()[0];
    const ref = localCouriers().find(c => c.id === s.referrer_id && c.role === "coursier");
    const limit = new Date(); limit.setMonth(limit.getMonth() - Number(st.pro_referrer_months));
    if (ref && (!first || new Date(first) > limit)) share = Math.round(Number(st.pro_monthly) * Number(st.pro_referrer_pct)) / 100;
    sales.push({ id: uuid(), created_at: new Date().toISOString(), shop_id: shopId, months: 1, amount: Number(st.pro_monthly),
      referrer_id: share ? ref.id : null, referrer_share: share, referrer_status: "du" });
    writeJSON(LS.planSales, sales);
  }
  return { plan_until: s.plan_until, referrer_share: share };
}
async function listPlanSales() {
  if (ONLINE) return authRest("/rest/v1/plan_sales?select=*&order=created_at.desc");
  return readJSON(LS.planSales, []);
}
// Livreur : sa part des abonnements Pro des commerces qu'il a amenés
async function myPlanShares() {
  if (ONLINE) return authRest("/rest/v1/rpc/my_plan_shares", { method: "POST", body: {} });
  const shops = localShops();
  return readJSON(LS.planSales, []).filter(p => p.referrer_id === myId() && p.referrer_share > 0)
    .map(p => ({ created_at: p.created_at, shop: (shops.find(x => x.id === p.shop_id) || {}).name, share: p.referrer_share, status: p.referrer_status }));
}
// Patron : pourboires reversés et parts d'abonnement payées au livreur
async function settleTips(ids) {
  if (!ids.length) return;
  if (ONLINE) return authRest("/rest/v1/orders?id=in.(" + ids.map(encodeURIComponent).join(",") + ")",
    { method: "PATCH", body: { tip_status: "verse" }, prefer: "return=minimal" });
  const all = localOrders();
  all.forEach(o => { if (ids.includes(o.id)) o.tip_status = "verse"; });
  saveLocalOrders(all);
}
async function settlePlanShares(ids) {
  if (!ids.length) return;
  if (ONLINE) return authRest("/rest/v1/plan_sales?id=in.(" + ids.map(encodeURIComponent).join(",") + ")",
    { method: "PATCH", body: { referrer_status: "regle" }, prefer: "return=minimal" });
  const sales = readJSON(LS.planSales, []);
  sales.forEach(p => { if (ids.includes(p.id)) p.referrer_status = "regle"; });
  writeJSON(LS.planSales, sales);
}

// Livreur : signaler un souci sur sa course (écrit aussi dans la conversation de la course)
async function courierIssue(id, reason) {
  if (ONLINE) return authRest("/rest/v1/rpc/courier_issue", { method: "POST", body: { p_id: id, p_reason: reason } });
  const all = localOrders();
  const o = all.find(x => x.id === id && x.courier_id === myId() && ["confirmee", "recuperee"].includes(x.status));
  const c = localCouriers().find(x => x.id === myId());
  if (!o || !reason) return false;
  Object.assign(o, { issue: String(reason).slice(0, 300), issue_at: new Date().toISOString() });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + id, author: "courier", author_name: c && c.name, body: "⚠️ " + o.issue });
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
  return localCouriers().map(c => { const x = Object.assign({}, c); delete x.password; delete x.topcase; return x; });
}

// Photo du top case : le livreur l'envoie (ou la remplace), le patron l'ouvre à la demande
async function sendTopcase(dataUrl) {
  if (ONLINE) return authRest("/rest/v1/courier_photos", { method: "POST", body: { courier_id: myId(), topcase: dataUrl }, prefer: "resolution=merge-duplicates,return=minimal" });
  const list = localCouriers();
  const c = list.find(x => x.id === myId());
  if (c) Object.assign(c, { topcase: dataUrl, topcase_at: new Date().toISOString() });
  writeJSON(LS.couriers, list);
}
async function courierTopcase(id) {
  if (ONLINE) { const r = await authRest(`/rest/v1/courier_photos?courier_id=eq.${encodeURIComponent(id)}&select=topcase,created_at`); return r && r[0] ? r[0].topcase : null; }
  const c = localCouriers().find(x => x.id === id);
  return c ? c.topcase || null : null;
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
    let ref = localCouriers().find(c => c.ref_code && c.ref_code === String(data.ref_code || "").trim().toUpperCase() && c.status === "actif");
    // Partenariat seulement dans la ville du livreur
    let otherCity = null;
    if (ref && ref.city && (data.city || "") !== ref.city) { otherCity = ref.city; ref = null; }
    const shop = {
      id: uuid(), created_at: new Date().toISOString(), code: newCode(6, list.map(x => x.code)), token: uuid(), status: "en_attente",
      name: data.name, kind: data.kind, city: data.city, address: data.address, lat: data.lat, lon: data.lon,
      contact_name: data.contact_name, phone: data.phone, email: data.email, lang: data.lang, referrer_id: ref ? ref.id : null, credits: 0,
      client_pays: !!data.client_pays
    };
    list.push(shop);
    writeJSON(LS.shops, list);
    r = { code: shop.code, token: shop.token, referred: !!ref, ref_other_city: otherCity };
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

// Abonnement HOP! Pro en cours (jusqu'au plan_until inclus)
const planActive = s => !!(s && s.plan_until && s.plan_until >= new Date().toISOString().slice(0, 10));
const publicShop = s => s && s.status !== "suspendu"
  ? { id: s.id, code: s.code, name: s.name, kind: s.kind, city: s.city, address: s.address, lat: s.lat, lon: s.lon, status: s.status,
      pro: planActive(s), logo: s.logo || null, cover: s.cover || null, tagline: s.tagline || null, client_pays: !!s.client_pays,
      shop_share: s.client_pays ? 0 : DEFAULT_SETTINGS.pro_shop_share - DEFAULT_SETTINGS.pro_hop_share } : null;

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
  return {
    shop: x,
    orders: localOrders().filter(o => o.shop_id === shop.id).sort((a, b) => new Date(b.pickup_at) - new Date(a.pickup_at)),
    sales: readJSON(LS.sales, []).filter(v => v.shop_id === shop.id).reverse()
  };
}

// --- Catalogue HOP! Pro : catégories et produits du commerce ------------------------------
// Démo : { [shopId]: { categories: [...], products: [...] } } sur ce téléphone
function localCatalog(shopId) {
  const all = readJSON(LS.catalog, {});
  return { all, cat: all[shopId] || (all[shopId] = { categories: [], products: [] }) };
}
const shopOfToken = token => localShops().find(x => x.token === token) || null;
// Catalogue public d'un commerce Pro actif (pour ses clients)
async function shopCatalog(code) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_catalog", { method: "POST", body: { p_code: code } });
  const s = localShops().find(x => x.code === String(code || "").toUpperCase());
  if (!s || s.status !== "actif" || !planActive(s)) return null;
  return localCatalog(s.id).cat;
}
// Le catalogue complet, pour le commerce lui-même
async function shopCatalogMine(token) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_catalog_mine", { method: "POST", body: { p_token: token } });
  const s = shopOfToken(token);
  return s ? localCatalog(s.id).cat : null;
}
async function saveCategory(token, id, name, position) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_category_save", { method: "POST", body: { p_token: token, p_id: id || null, p_name: name, p_position: position == null ? null : position } });
  const s = shopOfToken(token);
  if (!s) throw new Error("forbidden");
  const { all, cat } = localCatalog(s.id);
  let c = id && cat.categories.find(x => x.id === id);
  if (!c) { c = { id: uuid(), position: position || 0 }; cat.categories.push(c); }
  c.name = String(name).trim().slice(0, 40);
  if (position != null) c.position = position;
  cat.categories.sort((a, b) => a.position - b.position);
  writeJSON(LS.catalog, all);
  return c.id;
}
async function deleteCategory(token, id) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_category_delete", { method: "POST", body: { p_token: token, p_id: id } });
  const s = shopOfToken(token);
  if (!s) return false;
  const { all, cat } = localCatalog(s.id);
  cat.categories = cat.categories.filter(x => x.id !== id);
  cat.products.forEach(p => { if (p.category_id === id) p.category_id = null; });
  writeJSON(LS.catalog, all);
  return true;
}
// p : { id, category_id, name, description, price, photo (null = garder, "" = enlever), available, position }
async function saveProduct(token, p) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_product_save", { method: "POST", body: { p_token: token, p_id: p.id || null, p_category: p.category_id || null,
    p_name: p.name, p_description: p.description || null, p_price: Number(p.price), p_photo: p.photo === undefined ? null : p.photo,
    p_available: p.available == null ? true : !!p.available, p_position: p.position == null ? null : p.position } });
  const s = shopOfToken(token);
  if (!s) throw new Error("forbidden");
  const { all, cat } = localCatalog(s.id);
  let x = p.id && cat.products.find(y => y.id === p.id);
  if (!x) { x = { id: uuid(), position: p.position || 0, available: true, photo: null }; cat.products.push(x); }
  Object.assign(x, { category_id: cat.categories.some(c => c.id === p.category_id) ? p.category_id : null,
    name: String(p.name).trim().slice(0, 80), description: String(p.description || "").trim().slice(0, 300) || null,
    price: Math.round(Number(p.price) * 100) / 100 });
  if (p.photo !== undefined && p.photo !== null) x.photo = p.photo || null;
  if (p.available != null) x.available = !!p.available;
  if (p.position != null) x.position = p.position;
  writeJSON(LS.catalog, all);
  return x.id;
}
async function setProductAvailable(token, id, available) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_product_available", { method: "POST", body: { p_token: token, p_id: id, p_available: !!available } });
  const s = shopOfToken(token);
  if (!s) return false;
  const { all, cat } = localCatalog(s.id);
  const x = cat.products.find(y => y.id === id);
  if (!x) return false;
  x.available = !!available;
  writeJSON(LS.catalog, all);
  return true;
}
async function deleteProduct(token, id) {
  if (ONLINE) return rest("/rest/v1/rpc/shop_product_delete", { method: "POST", body: { p_token: token, p_id: id } });
  const s = shopOfToken(token);
  if (!s) return false;
  const { all, cat } = localCatalog(s.id);
  cat.products = cat.products.filter(y => y.id !== id);
  writeJSON(LS.catalog, all);
  return true;
}

// Patron : carnet payé → reçu numéroté + courses ajoutées au commerce. Renvoie { token, receipt_number }
async function sellCarnet(shopId, method) {
  const C = CONFIG.partners.carnet;
  if (ONLINE) return authRest("/rest/v1/rpc/sell_carnet", { method: "POST", body: { p_shop: shopId, p_courses: C.courses, p_amount: C.price, p_method: method } });
  const sale = { id: uuid(), token: uuid(), shop_id: shopId, courses: C.courses, amount: C.price, payment_method: method === "cash" ? "cash" : "bit",
    receipt_number: nextLocalReceipt(), receipt_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const sales = readJSON(LS.sales, []);
  sales.push(sale);
  writeJSON(LS.sales, sales);
  const shops = localShops();
  const s = shops.find(x => x.id === shopId);
  if (s) { s.credits = (s.credits || 0) + C.courses; writeJSON(LS.shops, shops); }
  return { token: sale.token, receipt_number: sale.receipt_number };
}

// Reçu d'un carnet (lien secret)
// Reçu d'une course : émis par HOP (ses propres courses) ou par le livreur (paiement direct)
async function orderReceipt(token) {
  if (ONLINE) return rest("/rest/v1/rpc/order_receipt", { method: "POST", body: { p_token: token } });
  const o = localOrders().find(x => x.token === token);
  return o ? Object.assign({ issuer: "hop" }, o) : null;
}
// Reçu de HOP pour une recharge de crédit d'un livreur
async function topupReceipt(token) {
  if (ONLINE) return rest("/rest/v1/rpc/topup_receipt", { method: "POST", body: { p_token: token } });
  return null;
}
// Relevé du mois du livreur (AAAA-MM) : courses, commission déduite, recharges, retenues
async function myStatement(month) {
  if (ONLINE) return authRest("/rest/v1/rpc/my_statement", { method: "POST", body: { p_month: month } });
  const id = myId(), c = localCouriers().find(x => x.id === id), inM = d => String(d || "").slice(0, 7) === month;
  return { month, courier: c ? { name: c.name, phone: c.phone, business_number: c.business_number } : {},
    orders: localOrders().filter(o => o.courier_id === id && o.status === "livree" && inM(o.delivered_at || o.pickup_at))
      .map(o => Object.assign({ delivered: o.delivered_at || o.pickup_at, due: courseDue(o) }, o)),
    topups: readJSON(LS.topups, []).filter(x => x.courier_id === id && x.status === "ok" && inM(x.decided_at || x.created_at)),
    penalties: readJSON(LS.penalties, []).filter(p => p.courier_id === id && p.status === "du" && inM(p.created_at)),
    credit: creditOf(id).credit };
}
async function carnetReceipt(token) {
  if (ONLINE) return rest("/rest/v1/rpc/carnet_receipt", { method: "POST", body: { p_token: token } });
  const v = readJSON(LS.sales, []).find(x => x.token === token);
  const s = v && localShops().find(x => x.id === v.shop_id);
  return v ? Object.assign({}, v, { shop_name: s && s.name, contact_name: s && s.contact_name, phone: s && s.phone }) : null;
}

// Patron : ventes de carnets (reçus)
async function listCarnetSales() {
  if (ONLINE) return authRest("/rest/v1/carnet_sales?select=*&order=receipt_at.desc&limit=500");
  return readJSON(LS.sales, []).slice().reverse();
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
    const plans = await myPlanShares().catch(() => []);
    return { shops: shops || [], orders: orders || [], board: board || [], plans: plans || [] };
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
    orders: orders.filter(o => o.referrer_id === id).map(o => ({ id: o.id, shop_id: o.shop_id, pickup_at: o.pickup_at, status: o.status, referral_bonus: o.referral_bonus, referral_status: o.referral_status, mine: o.courier_id === id })),
    board, plans: await myPlanShares()
  };
}

// --- Demandes de devis (tournée quotidienne, carnet…) --------------------------------------
async function createRequest(r) {
  r = Object.assign({ status: "nouvelle", device_id: deviceId() }, r);
  if (ONLINE) return rest("/rest/v1/requests", { method: "POST", body: r, prefer: "return=minimal" });
  const list = readJSON(LS.requests, []);
  list.push(Object.assign({ id: uuid(), created_at: new Date().toISOString() }, r));
  writeJSON(LS.requests, list);
}
async function listRequests() {
  if (ONLINE) return authRest("/rest/v1/requests?select=*&order=created_at.desc&limit=200");
  return readJSON(LS.requests, []).slice().reverse();
}
async function updateRequest(id, changes) {
  if (ONLINE) return authRest("/rest/v1/requests?id=eq." + encodeURIComponent(id), { method: "PATCH", body: changes, prefer: "return=minimal" });
  const list = readJSON(LS.requests, []);
  const r = list.find(x => x.id === id);
  if (r) Object.assign(r, changes);
  writeJSON(LS.requests, list);
}

// --- Messagerie dans l'application ----------------------------------------------------------
// Fils : "o:<course>" (client + livreur + patron), "u:<appareil>" (service client),
//        "c:<livreur>" (livreur ↔ patron), "s:<commerce>" (commerce ↔ patron)
const chatLocal = () => readJSON(LS.chat, []);
function chatLocalAdd(m) {
  const list = chatLocal();
  list.push(Object.assign({ id: uuid(), created_at: new Date().toISOString() }, m));
  // Démo : on garde les 400 derniers messages (photos comprises) pour ne pas remplir le téléphone
  writeJSON(LS.chat, list.slice(-400));
  return true;
}
const byDate = list => list.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
const clean = s => (s && String(s).trim()) || null;

// Client : conversation de sa course (jeton secret)
async function chatOrder(token) {
  if (ONLINE) return rest("/rest/v1/rpc/chat_order", { method: "POST", body: { p_token: token } });
  const o = localOrders().find(x => x.token === token);
  return o ? byDate(chatLocal().filter(m => m.thread === "o:" + o.id)) : [];
}
async function chatOrderSend(token, body, image) {
  if (ONLINE) return rest("/rest/v1/rpc/chat_order_send", { method: "POST", body: { p_token: token, p_body: body || null, p_image: image || null } });
  const o = localOrders().find(x => x.token === token);
  return !!o && chatLocalAdd({ thread: "o:" + o.id, author: "client", author_name: o.contact_name, body: clean(body), image: image || null });
}
// Client : service client (identifiant de cet appareil)
async function chatSupport() {
  if (ONLINE) return rest("/rest/v1/rpc/chat_support", { method: "POST", body: { p_device: deviceId() } });
  return byDate(chatLocal().filter(m => m.thread === "u:" + deviceId()));
}
async function chatSupportSend(name, body, image) {
  if (ONLINE) return rest("/rest/v1/rpc/chat_support_send", { method: "POST", body: { p_device: deviceId(), p_name: name || null, p_body: body || null, p_image: image || null } });
  return chatLocalAdd({ thread: "u:" + deviceId(), author: "client", author_name: clean(name), body: clean(body), image: image || null });
}
// Commerce : sa conversation avec le patron (clé secrète)
async function chatShop(token) {
  if (ONLINE) return rest("/rest/v1/rpc/chat_shop", { method: "POST", body: { p_token: token } });
  const s = localShops().find(x => x.token === token);
  return s ? byDate(chatLocal().filter(m => m.thread === "s:" + s.id)) : [];
}
async function chatShopSend(token, body, image) {
  if (ONLINE) return rest("/rest/v1/rpc/chat_shop_send", { method: "POST", body: { p_token: token, p_body: body || null, p_image: image || null } });
  const s = localShops().find(x => x.token === token);
  return !!s && chatLocalAdd({ thread: "s:" + s.id, author: "shop", author_name: s.name, body: clean(body), image: image || null });
}
// Patron et livreurs (connectés) : lire un fil, écrire, et la liste des derniers messages
async function chatThread(thread) {
  if (ONLINE) return authRest("/rest/v1/chat_messages?select=*&order=created_at.asc&limit=300&thread=eq." + encodeURIComponent(thread));
  return byDate(chatLocal().filter(m => m.thread === thread));
}
// Message du patron à tous les clients des p_days derniers jours (conversation « service client »)
async function broadcastClients(body, days) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_broadcast_clients", { method: "POST", body: { p_body: body, p_days: days } });
  const since = Date.now() - days * 86400000;
  const devices = [...new Set(localOrders().filter(o => o.device_id && new Date(o.created_at) > since).map(o => o.device_id))];
  devices.forEach(d => chatLocalAdd({ thread: "u:" + d, author: "admin", author_name: "HOP!", body: clean(body) }));
  return devices.length;
}
// --- Colis à récupérer : documents du client (avis/SMS, carte d'identité, procuration, rendez-vous) ----------
function docsNeeded(place) { return place === "poste" ? ["avis", "identite", "procuration", "rdv"] : place === "locker" ? ["avis"] : ["avis", "identite"]; }
// Les documents d'une course (même règle que la base : order_docs_needed)
function docsFor(o) {
  return o.service === "retrait" ? docsNeeded(o.place_kind) : o.service === "achat" && o.rx ? ["identite", "ordonnance"]
    : o.service === "colis" && o.post_send ? ["rdv", "etiquette"] : [];
}
async function addOrderDoc(token, kind, photo) {
  if (ONLINE) return rest("/rest/v1/rpc/order_doc_add", { method: "POST", body: { p_token: token, p_kind: kind, p_photo: photo } });
  const all = localOrders(), o = all.find(x => x.token === token);
  if (!o || !o.docs_status || o.status !== "nouvelle" || o.docs_status === "ok" || !docsFor(o).includes(kind)) return false;
  const docs = readJSON(LS.docs, {});
  (docs[o.id] = docs[o.id] || []).push({ kind, photo, created_at: new Date().toISOString() });
  writeJSON(LS.docs, docs);
  if (o.docs_status === "refuse") {
    o.docs_status = "a_verifier";
    saveLocalOrders(all);
    chatLocalAdd({ thread: "o:" + o.id, author: "client", author_name: o.contact_name, body: "📄 Document ajouté · מסמך נוסף", image: null });
  }
  return true;
}
async function orderDocsSent(token) {
  if (ONLINE) return (await rest("/rest/v1/rpc/order_docs_sent", { method: "POST", body: { p_token: token } })) || [];
  const o = localOrders().find(x => x.token === token);
  return o ? [...new Set((readJSON(LS.docs, {})[o.id] || []).map(d => d.kind))] : [];
}
// Les photos : le patron, et le livreur de la course (vérifié par la base en ligne)
async function orderDocs(orderId) {
  if (ONLINE) return (await authRest("/rest/v1/rpc/order_docs", { method: "POST", body: { p_order: orderId } })) || [];
  return readJSON(LS.docs, {})[orderId] || [];
}
async function docsVerdict(orderId, ok, note) {
  if (ONLINE) return authRest("/rest/v1/rpc/admin_docs_verdict", { method: "POST", body: { p_order: orderId, p_ok: ok, p_note: note || null } });
  const all = localOrders(), o = all.find(x => x.id === orderId && x.docs_status && x.status === "nouvelle");
  if (!o) return false;
  Object.assign(o, { docs_status: ok ? "ok" : "refuse", docs_note: ok ? null : String(note || "").trim().slice(0, 300) || null });
  saveLocalOrders(all);
  chatLocalAdd({ thread: "o:" + o.id, author: "admin", author_name: "HOP!", image: null, body: ok
    ? "✅ Documents vérifiés : nous envoyons un livreur. · המסמכים אושרו: אנחנו שולחים שליח."
    : `📄 Il manque : ${o.docs_note || "…"} — ajoutez-le depuis le suivi de votre course. · חסר מסמך: הוסיפו אותו מדף המעקב.` });
  return true;
}

async function chatSend(thread, author, authorName, body, image) {
  const m = { thread, author, author_name: authorName || null, body: clean(body), image: image || null };
  if (ONLINE) return authRest("/rest/v1/chat_messages", { method: "POST", body: m, prefer: "return=minimal" });
  return chatLocalAdd(m);
}
// Derniers messages visibles (sans les photos, plus léger) : boîte de réception, badges
async function chatRecent() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  if (ONLINE) return authRest("/rest/v1/chat_messages?select=id,created_at,thread,author,author_name,body&order=created_at.desc&limit=1000&created_at=gte." + encodeURIComponent(since));
  const id = myId();
  const me = localCouriers().find(c => c.id === id);
  const mine = me && me.role !== "admin" ? new Set(["c:" + id, ...localOrders().filter(o => o.courier_id === id).map(o => "o:" + o.id)]) : null;
  return chatLocal().filter(m => m.created_at >= since && (!mine || mine.has(m.thread)))
    .map(m => Object.assign({}, m, { image: undefined, has_image: !!m.image })).reverse();
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
  createOrder, myOrders, cancelMyOrder, trackOrder, orderAddable, orderAddItems, getProfile, saveProfile, getAddresses, saveAddress, deleteAddress, updateAddress,
  useSpace, session, login, logout, resetPassword, setPassword, me, signupCourier, adoptLinkSession, completeCourier, sessionEmail,
  listOrders, updateOrder, assignOrder, acceptOrder, answerEta, etaChoice, courierAction, courierIssue, zoneDemand, ping,
  setOnline, declineOrder, listDeclines, myAcceptance, demandForecast, commissionFor,
  todayHours, placesSearch, couriersNearby, rateOrder, tipOrder, setPayment, clientPaid, payMissing, myRefunds, refundDone, refundAnswer, pushSubscribe, planExtend, listPlanSales, myPlanShares, settleTips, settlePlanShares,
  balanceOf, courseValue, courierGain, shopsDirectory, sendTopcase, courierTopcase, waitFee, shopOrderAction, planActive,
  listCouriers, updateCourier, settleOrders, settleReferrals,
  myBalance, myCredit, declareTopup, adminCredits, decideTopup, addTopup, courseDue, orderReceipt, topupReceipt, myStatement, shopSignup, shopByCode, shopsShowcase, saveShopBrand, setShopClientPays, shopDashboard, shopCatalog, shopCatalogMine, saveCategory, deleteCategory, saveProduct, setProductAvailable, deleteProduct, myShopTokens, rememberShopToken, shopTokenFor, listShops, updateShop, myReferrals,
  sellCarnet, carnetReceipt, listCarnetSales,
  docsNeeded, docsFor, addOrderDoc, courierHandoff,
  claimOrder, penaltyAdd, penaltyCancel, claimClose, listPenalties, myPenalties, settlePenalties, orderDocsSent, orderDocs, docsVerdict,
  chatOrder, chatOrderSend, chatSupport, chatSupportSend, chatShop, chatShopSend, chatThread, chatSend, broadcastClients, chatRecent,
  sendMessage, listMessages, replyMessage, createRequest, listRequests, updateRequest
};

})();
