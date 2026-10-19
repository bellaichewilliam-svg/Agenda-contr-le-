// ============================================================================
// Enseignes près du client, par catégorie : commerces partenaires HOP, pharmacies,
// poste, supermarchés, restaurants… (données OpenStreetMap via Overpass, gratuit,
// sans clé ; gardées 7 jours sur le téléphone). Chaque enseigne a son adresse et
// sa distance ; le client la choisit comme départ ou comme arrivée.
// ============================================================================

(function () {
"use strict";

const CATS = [
  { id: "hop", icon: "⭐" },
  { id: "pharm", icon: "💊", q: ['nwr["amenity"="pharmacy"]', 'nwr["shop"="chemist"]'], r: 6000 },
  { id: "post", icon: "📮", q: ['nwr["amenity"="post_office"]', 'nwr["amenity"="parcel_locker"]'], r: 6000 },
  { id: "super", icon: "🛒", q: ['nwr["shop"="supermarket"]'], r: 5000 },
  { id: "food", icon: "🍔", q: ['nwr["amenity"~"^(restaurant|fast_food)$"]'], r: 2500 },
  { id: "mall", icon: "🛍️", q: ['nwr["shop"~"^(mall|department_store)$"]'], r: 9000 },
  { id: "flower", icon: "💐", q: ['nwr["shop"="florist"]'], r: 6000 },
  { id: "tech", icon: "📱", q: ['nwr["shop"~"^(mobile_phone|electronics|computer)$"]'], r: 5000 }
];
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const KEEP_MS = 7 * 86400000;
const KIND_ICON = { restaurant: "🍔", pharmacie: "💊", boutique: "🛍️", fleuriste: "💐", epicerie: "🛒", bureau: "🏢" };

function readCache(key) { try { const c = JSON.parse(localStorage.getItem(key)); return c && Date.now() - c.at < KEEP_MS ? c.items : null; } catch (e) { return null; } }
function writeCache(key, items) { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch (e) { /* plein : tant pis */ } }

async function overpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      clearTimeout(timer);
      if (res.ok) return await res.json();
      lastErr = new Error("overpass " + res.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Une enseigne OpenStreetMap → { name, street, number, city, lat, lon }
function fromOsm(e, lang) {
  const g = e.tags || {};
  return {
    name: g["name:" + lang] || g.name || g["name:he"] || g["name:en"] || g.brand,
    street: g["addr:street"] || "", number: g["addr:housenumber"] || "", city: g["addr:city"] || "",
    lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon
  };
}

// Enseignes d'une catégorie autour d'un point, de la plus proche à la plus loin
async function list(catId, at, lang) {
  const cat = CATS.find(c => c.id === catId);
  if (!cat) return [];
  let items;
  if (cat.id === "hop") {
    items = ((await Store.shopsDirectory()) || []).filter(s => s.lat != null).map(s => ({
      name: s.name, street: s.address || "", number: "", city: s.city || "", lat: Number(s.lat), lon: Number(s.lon),
      partner: true, code: s.code, icon: KIND_ICON[s.kind] || "⭐"
    }));
  } else {
    const key = `livraison.ens.v1.${cat.id}.${lang}.${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
    items = readCache(key);
    if (!items) {
      const body = cat.q.map(sel => `${sel}["name"](around:${cat.r},${at.lat},${at.lon});`).join("");
      const data = await overpass(`[out:json][timeout:20];(${body});out center tags 200;`);
      const seen = new Set();
      items = (data.elements || []).map(e => fromOsm(e, lang)).filter(x => {
        if (!x.name || x.lat == null) return false;
        const k = x.name + "|" + x.lat.toFixed(3) + "," + x.lon.toFixed(3);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      writeCache(key, items);
    }
    items = items.map(x => Object.assign({ icon: cat.icon }, x));
  }
  return items.map(x => Object.assign(x, { km: Places.km(at, x) })).sort((a, b) => a.km - b.km).slice(0, 80);
}

window.Enseignes = { CATS, list };

})();
