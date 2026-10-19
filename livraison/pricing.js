// ============================================================================
// Calcul du prix d'une course + horaires + géolocalisation des adresses.
// Fonctions pures (testables avec Node) + appels OpenStreetMap côté navigateur.
// ============================================================================

(function (root) {
"use strict";

function round(value, step) {
  return Math.round(value / step) * step;
}

// opts : { distanceKm, size, service: "course"|"poste", urgency: "programmee"|"express",
//          roundTrip, extraStops }
function computeQuote(opts, pricing) {
  const lines = [];
  const distanceKnown = typeof opts.distanceKm === "number" && isFinite(opts.distanceKm);
  const km = distanceKnown ? opts.distanceKm : 0;

  lines.push({ label: `Prise en charge (${pricing.includedKm} km inclus)`, amount: pricing.base });

  const extraKm = Math.max(0, km - pricing.includedKm);
  if (extraKm > 0) {
    lines.push({ label: `Distance : ${extraKm.toFixed(1)} km supplémentaires`, amount: extraKm * pricing.perKm });
  }

  const size = pricing.sizes[opts.size];
  if (size && size.extra) lines.push({ label: size.label, amount: size.extra });

  if (opts.service === "poste") {
    lines.push({ label: "Retrait du colis à la poste", amount: pricing.postOfficeExtra });
  }

  const stops = Math.max(0, parseInt(opts.extraStops, 10) || 0);
  if (stops) lines.push({ label: `${stops} arrêt(s) supplémentaire(s)`, amount: stops * pricing.extraStop });

  let subtotal = lines.reduce((s, l) => s + l.amount, 0);

  if (opts.roundTrip) {
    const amount = subtotal * pricing.returnTripPercent / 100;
    lines.push({ label: `Aller-retour (+${pricing.returnTripPercent} %)`, amount });
    subtotal += amount;
  }
  if (opts.urgency === "express") {
    const amount = subtotal * pricing.expressPercent / 100;
    lines.push({ label: `Express — dès que possible (+${pricing.expressPercent} %)`, amount });
    subtotal += amount;
  }

  const total = Math.max(pricing.minimum, round(subtotal, pricing.roundTo));
  return { total, lines, distanceKnown, distanceKm: distanceKnown ? km : null };
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

// Renvoie null si l'horaire est accepté, sinon un message d'erreur
function checkSchedule(date, cfg, now) {
  now = now || new Date();
  if (!(date instanceof Date) || isNaN(date)) return "Choisissez une date et une heure.";
  if (date - now < cfg.minLeadMinutes * 60000) {
    return `Merci de réserver au moins ${cfg.minLeadMinutes} minutes à l'avance (ou choisissez « Express »).`;
  }
  const { day, hour } = localParts(date, cfg.timezone);
  const slot = cfg.hours[day];
  if (!slot) return "Nous sommes fermés ce jour-là.";
  if (hour < slot[0] || hour > slot[1]) {
    return `Ce jour-là, nous travaillons de ${slot[0]}h à ${slot[1]}h.`;
  }
  return null;
}

function isOpenNow(cfg, now) {
  const { day, hour } = localParts(now || new Date(), cfg.timezone);
  const slot = cfg.hours[day];
  return !!slot && hour >= slot[0] && hour < slot[1];
}

function haversineKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- OpenStreetMap (gratuit, sans clé) --------------------------------------
const geoCache = {};

async function geocode(address, countryCode) {
  const key = countryCode + "|" + address.trim().toLowerCase();
  if (key in geoCache) return geoCache[key];
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fr"
    + (countryCode ? "&countrycodes=" + countryCode : "")
    + "&q=" + encodeURIComponent(address);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("geocode " + res.status);
  const data = await res.json();
  const point = data.length ? { lat: +data[0].lat, lon: +data[0].lon, label: data[0].display_name } : null;
  geoCache[key] = point;
  return point;
}

// Distance par la route (OSRM), à défaut à vol d'oiseau × 1,35
async function routeKm(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length) return data.routes[0].distance / 1000;
  } catch (e) { /* repli ci-dessous */ }
  return haversineKm(a, b) * 1.35;
}

const api = { computeQuote, checkSchedule, isOpenNow, localParts, haversineKm, geocode, routeKm };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.Pricing = api;

})(typeof window !== "undefined" ? window : globalThis);
