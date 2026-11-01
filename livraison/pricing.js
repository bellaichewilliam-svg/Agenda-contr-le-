// ============================================================================
// Calcul du prix d'une course, horaires, distances et adresses (OpenStreetMap).
// Les lignes du devis portent une clé de traduction (voir i18n.js).
// ============================================================================

(function (root) {
"use strict";

function roundTo(value, step) { return Math.round(value / step) * step; }

function haversineKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cityById(cfg, id) { return cfg.cities.find(c => c.id === id) || null; }

// Prix de base entre deux points (centres-villes ou adresses géolocalisées)
function tripPrice(a, b, pricing) {
  const km = a && b ? haversineKm(a, b) : 0;
  return { km, price: Math.max(pricing.minimum, roundTo(pricing.base + pricing.perKm * km, pricing.roundTo)) };
}

// Prix fixé à la main dans config.js pour un trajet depuis/vers la ville principale
function fixedPrice(cfg, fromId, toId, car) {
  const table = (car ? cfg.pricing.fixedCarFromHome : cfg.pricing.fixedFromHome) || {};
  if (fromId === cfg.homeCity && toId in table) return table[toId];
  if (toId === cfg.homeCity && fromId in table) return table[fromId];
  return null;
}

// Prix « petit colis » entre deux villes, pour les grilles de tarifs
function cityToCity(cfg, fromId, toId) {
  const fixed = fixedPrice(cfg, fromId, toId);
  if (fixed != null) return fixed;
  return fromId === toId ? tripPrice(null, null, cfg.pricing).price
    : tripPrice(cityById(cfg, fromId), cityById(cfg, toId), cfg.pricing).price;
}

// Point dans un contour [[lat, lon], …] (rayon lancé vers l'est)
function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, bi] = poly[i], [aj, bj] = poly[j];
    if ((ai > p.lat) !== (aj > p.lat) && p.lon < (bj - bi) * (p.lat - ai) / (aj - ai) + bi) inside = !inside;
  }
  return inside;
}
// Distance (km) d'un point à une zone : 0 dedans, sinon jusqu'au bord le plus proche
function kmToArea(p, a) {
  if (inPoly(p, a.poly)) return 0;
  const kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
  let best = Infinity;
  for (let i = 0, j = a.poly.length - 1; i < a.poly.length; j = i++) {
    const ax = (a.poly[j][1] - p.lon) * kx, ay = (a.poly[j][0] - p.lat) * ky, bx = (a.poly[i][1] - p.lon) * kx, by = (a.poly[i][0] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
// Zone à part d'un point (config.pricing.areas : zones industrielles, Kiryat HaSharon), ou null
function areaOf(cfg, cityId, p) {
  const A = cfg.pricing.areas;
  if (!A || !p || p.lat == null) return null;
  const z = A.list.find(a => a.city === cityId && (a.poly ? inPoly(p, a.poly)
    : p.lat >= a.box[0] && p.lat <= a.box[1] && p.lon >= a.box[2] && p.lon <= a.box[3]));
  return z ? z.id : null;
}

// opts : { fromCity, toCity, fromPoint, toPoint, service, urgency, size, roundTrip,
//          extraStops, discount: { kind: "promo"|"referral"|"loyalty", code, percent, max, amount } }
function computeQuote(opts, cfg) {
  const P = cfg.pricing;
  const lines = [];
  const from = cityById(cfg, opts.fromCity) || opts.fromPoint;
  const to = cityById(cfg, opts.toCity) || opts.toPoint;
  const same = opts.fromCity && opts.fromCity === opts.toCity;
  const known = same || !!(from && to);

  const trip = same || !known ? tripPrice(null, null, P) : tripPrice(from, to, P);
  const fixed = fixedPrice(cfg, opts.fromCity, opts.toCity);
  if (fixed != null) trip.price = fixed;
  // Dans la même ville : la ville ↔ une zone industrielle (ou une zone ↔ l'autre) a son propre prix
  const zf = same ? areaOf(cfg, opts.fromCity, opts.fromPoint) : null, zt = same ? areaOf(cfg, opts.toCity, opts.toPoint) : null;
  const area = same && (zf || zt) && zf !== zt && opts.fromPoint && opts.toPoint ? cfg.pricing.areas.list.find(a => a.id === (zf || zt)) : null;
  // … sauf si un livreur libre est déjà dans la zone ou tout près (course pour maintenant) : prix normal
  const near = area && opts.urgency !== "programmee" && area.poly && (opts.couriers || [])
    .some(c => c && c.lat != null && kmToArea({ lat: Number(c.lat), lon: Number(c.lon) }, area) <= (cfg.pricing.areas.nearKm || 1));
  if (area && !near) trip.price = Math.max(trip.price, cfg.pricing.areas.price);
  lines.push(area && near
    ? { key: "qBaseAreaNear", vars: { city: opts.fromCity, area: area.id }, amount: trip.price }
    : area
    ? { key: "qBaseArea", vars: { city: opts.fromCity, area: area.id }, amount: trip.price }
    : same
    ? { key: "qBaseSame", vars: { city: opts.fromCity }, amount: trip.price }
    : { key: "qBase", vars: { from: opts.fromCity, to: opts.toCity, km: Math.round(trip.km) }, amount: trip.price });

  // Gros colis : prix voiture de la grille quand il existe, sinon supplément fixe
  const car = opts.size === "gros" && fixed != null ? fixedPrice(cfg, opts.fromCity, opts.toCity, true) : null;
  const size = car != null ? Math.max(0, car - trip.price) : P.sizes[opts.size];
  if (size) lines.push({ key: "qSize_" + opts.size, amount: size });
  if (opts.urgency === "express") lines.push({ key: "qExpress", amount: P.express });
  if (opts.service === "retrait" && P.pickupPoint) lines.push({ key: "qPickup", amount: P.pickupPoint });
  // Achats : s'arrêter et acheter a toujours un prix (même sans queue, même un paquet de cigarettes),
  // quelques minutes sur place comprises, puis l'attente habituelle
  // Makolet / supermarché et cigarettes : petit achat ; tout le reste (boutique, sandwich, pharmacie…) : vrai achat en boutique
  if (opts.service === "achat" && P.purchase) lines.push(purchaseTier(cfg, opts) === "boutique" && P.purchaseShop
    ? { key: "qPurchaseShop", vars: { min: P.purchaseShopMinutes || 8 }, amount: P.purchaseShop }
    : { key: "qPurchase", vars: { min: P.purchaseMinutes || 5 }, amount: P.purchase });
  // Articles cochés au-delà de ceux compris : 2 ₪ l'article (1 ₪ pour le livreur, 1 ₪ pour HOP!)
  const PI = P.purchaseItems;
  const extra = opts.service === "achat" && PI ? Math.max(0, Math.min(opts.units || 0, PI.max) - PI.included) : 0;
  if (extra) lines.push({ key: "qItemsExtra", vars: { n: extra, inc: PI.included, each: PI.extraCourier + PI.extraHop }, amount: extra * (PI.extraCourier + PI.extraHop) });
  // Arrêts en plus : sur le chemin → moitié prix d'une course, sinon prix d'une course
  if (Array.isArray(opts.stops) && opts.stops.length) {
    const S = P.stop || { onWayPercent: 50 };
    opts.stops.forEach((s, i) => lines.push(s.onWay
      ? { key: "qStopOnWay", vars: { n: i + 1, p: S.onWayPercent }, amount: Math.round(P.base * S.onWayPercent / 100 * 2) / 2 }
      : { key: "qStopFull", vars: { n: i + 1 }, amount: P.base }));
  } else {
    const stops = Math.max(0, parseInt(opts.extraStops, 10) || 0);
    if (stops) lines.push({ key: "qStops", vars: { n: stops }, amount: stops * P.extraStop });
  }

  let subtotal = lines.reduce((s, l) => s + l.amount, 0);
  if (opts.roundTrip) {
    const amount = roundTo(subtotal * P.returnTripPercent / 100, P.roundTo);
    lines.push({ key: "qReturn", vars: { p: P.returnTripPercent }, amount });
    subtotal += amount;
  }

  const d = opts.discount;
  if (d) {
    let amount = 0, key = "qPromo";
    if (d.kind === "loyalty") { amount = Math.min(subtotal, d.max); key = "qLoyalty"; }
    else if (d.kind === "referral") { amount = d.amount; key = "qReferral"; }
    else if (d.percent) amount = Math.min(Math.round(subtotal * d.percent / 100), d.max || Infinity);
    else amount = d.amount || 0;
    amount = Math.min(amount, subtotal);
    if (amount > 0) lines.push({ key, vars: { code: d.code }, amount: -amount, discount: true });
    subtotal -= amount;
  }

  return { total: Math.max(0, subtotal), lines, known, distanceKm: known && !same ? Math.round(trip.km * 10) / 10 : (same ? 0 : null) };
}

// Jour (0-6) et heure décimale d'une date dans le fuseau de l'entreprise
function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
  }).formatToParts(date);
  const get = t => parts.find(p => p.type === t).value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, hour: parseInt(get("hour"), 10) + parseInt(get("minute"), 10) / 60 };
}

// null si l'horaire est accepté, sinon { key, vars } (message à traduire)
function checkSchedule(date, cfg, now) {
  now = now || new Date();
  if (!(date instanceof Date) || isNaN(date)) return { key: "errDate" };
  if (date - now < cfg.minLeadMinutes * 60000) return { key: "errLead", vars: { min: cfg.minLeadMinutes } };
  const { day, hour } = localParts(date, cfg.timezone);
  const slot = cfg.hours[day];
  if (!slot) return { key: "errClosedDay" };
  if (hour < slot[0] || hour > slot[1]) return { key: "errHours", vars: { open: slot[0], close: slot[1] } };
  return null;
}

function isOpenNow(cfg, now) {
  const { day, hour } = localParts(now || new Date(), cfg.timezone);
  const slot = cfg.hours[day];
  return !!slot && hour >= slot[0] && hour < slot[1];
}

// Un arrêt est « sur le chemin » si le détour (départ → arrêt → arrivée, au lieu de départ → arrivée)
// fait au plus onWayKm km à vol d'oiseau
function stopDetourKm(from, stop, to) {
  if (!from || !stop || !to) return null;
  return Math.max(0, haversineKm(from, stop) + haversineKm(stop, to) - haversineKm(from, to));
}

// Minutes estimées : distance par la route ≈ ×1,3 ; 25 km/h en ville, 50 km/h entre villes
function etaMinutes(a, b) {
  const road = haversineKm(a, b) * 1.3;
  return Math.max(1, Math.round(road / (road < 6 ? 25 : 50) * 60 + 2));
}

// --- OpenStreetMap Nominatim (gratuit, sans clé) ------------------------------
const geoCache = {};

async function geocode(address, countryCode, timeoutMs) {
  const key = countryCode + "|" + address.trim().toLowerCase();
  if (key in geoCache) return geoCache[key];
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1"
    + (countryCode ? "&countrycodes=" + countryCode : "")
    + "&q=" + encodeURIComponent(address);
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs || 4000);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl && ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const point = data.length ? { lat: +data[0].lat, lon: +data[0].lon } : null;
    geoCache[key] = point;
    return point;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Achat : « petit » (makolet / supermarché, cigarettes : rayons cfg.pricing.purchaseSmall) ou « boutique » (tout le reste).
// opts.purchaseKind = genre du rayon choisi (null : achat libre dans un commerce = boutique)
function purchaseTier(cfg, opts) {
  const small = cfg.pricing.purchaseSmall || ["shop", "tabac", "gift"];
  return opts.purchaseKind && small.includes(opts.purchaseKind) ? "petit" : "boutique";
}

// Prix voiture (gros colis) entre la ville principale et une ville, ou null
function carPrice(cfg, fromId, toId) { return cfg.pricing.carAvailable === false ? null : fixedPrice(cfg, fromId, toId, true); }

const api = { areaOf, kmToArea, computeQuote, purchaseTier, cityToCity, carPrice, cityById, checkSchedule, isOpenNow, localParts, haversineKm, etaMinutes, geocode, stopDetourKm };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.Pricing = api;

})(typeof window !== "undefined" ? window : globalThis);
