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
  { id: "food", icon: "🍽️", q: ['nwr["amenity"~"^(restaurant|fast_food)$"]'], r: 2500 },
  { id: "mall", icon: "🛍️", q: ['nwr["shop"~"^(mall|department_store)$"]'], r: 9000 },
  { id: "flower", icon: "💐", q: ['nwr["shop"="florist"]'], r: 6000 },
  { id: "tech", icon: "📱", q: ['nwr["shop"~"^(mobile_phone|electronics|computer)$"]'], r: 5000 }
];
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
// Même chose par Photon (rapide, déjà utilisé pour les adresses) : les plus proches d'un type de lieu
const PHOTON_TAGS = {
  pharm: ["amenity:pharmacy", "shop:chemist"], post: ["amenity:post_office", "amenity:parcel_locker"], super: ["shop:supermarket"],
  food: ["amenity:restaurant", "amenity:fast_food"], mall: ["shop:mall", "shop:department_store"], flower: ["shop:florist"],
  tech: ["shop:mobile_phone", "shop:electronics", "shop:computer"]
};
const KEEP_MS = 7 * 86400000;
const KIND_ICON = { restaurant: "🍽️", pharmacie: "💊", boutique: "🛍️", fleuriste: "💐", epicerie: "🛒", bureau: "🏢" };

function readCache(key) { try { const c = JSON.parse(localStorage.getItem(key)); return c && Date.now() - c.at < KEEP_MS ? c.items : null; } catch (e) { return null; } }
function writeCache(key, items) { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch (e) { /* plein : tant pis */ } }

// Une requête avec délai maximum (un serveur gratuit saturé ne bloque jamais l'écran)
async function fetchJson(url, opts, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
    if (!res.ok) throw new Error("http " + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}
// Le premier qui répond avec quelque chose gagne
function firstFull(promises) {
  return new Promise((resolve, reject) => {
    let left = promises.length, lastErr = new Error("empty");
    promises.forEach(p => p.then(v => { if (v && v.length) resolve(v); else if (!--left) reject(lastErr); },
      e => { lastErr = e; if (!--left) reject(lastErr); }));
  });
}
// Les serveurs Overpass en même temps (pas l'un après l'autre)
function overpass(query) {
  return firstFull(ENDPOINTS.map(url => fetchJson(url, { method: "POST", body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 12000).then(d => (d.elements && d.elements.length ? [d] : []))))
    .then(r => r[0]);
}
async function photonNear(cat, at, lang) {
  const tags = PHOTON_TAGS[cat.id];
  if (!tags) return [];
  const u = new URL("https://photon.komoot.io/reverse");
  u.searchParams.set("lat", at.lat); u.searchParams.set("lon", at.lon);
  u.searchParams.set("limit", "50"); u.searchParams.set("radius", String(Math.round(cat.r / 1000)));
  if (["fr", "en", "de"].includes(lang)) u.searchParams.set("lang", lang);
  tags.forEach(x => u.searchParams.append("osm_tag", x));
  const d = await fetchJson(u.toString(), {}, 8000);
  return (d.features || []).map(f => {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    return { name: p.name, street: p.street || "", number: p.housenumber || "", city: p.city || "", phone: null, lat: c[1], lon: c[0] };
  }).filter(x => x.name && x.lat != null);
}
async function overpassNear(cat, at, lang) {
  const body = cat.q.map(sel => `${sel}["name"](around:${cat.r},${at.lat},${at.lon});`).join("");
  const data = await overpass(`[out:json][timeout:12];(${body});out center tags 200;`);
  return (data.elements || []).map(e => fromOsm(e, lang)).filter(x => x.name && x.lat != null);
}

// Une enseigne OpenStreetMap → { name, street, number, city, lat, lon }
function fromOsm(e, lang) {
  const g = e.tags || {};
  return {
    name: g["name:" + lang] || g.name || g["name:he"] || g["name:en"] || g.brand,
    street: g["addr:street"] || "", number: g["addr:housenumber"] || "", city: g["addr:city"] || "",
    phone: g.phone || g["contact:phone"] || g.mobile || g["contact:mobile"] || null,
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
  } else if (cat.id === "food" && (items = (await Places.directory()).filter(e => e.lat != null && Places.km(at, e) * 1000 <= cat.r * 2)).length) {
    // Restaurants : l'annuaire HOP! (vrais noms, adresses, téléphones), avec l'icône de leur cuisine
    items = items.map(e => {
      const m = String(e.s || "").match(/^(.*?)\s+(\d+\S*)/);
      return { name: Places.dirName(e, lang), street: m ? m[1] : (e.s || ""), number: m ? m[2] : "", city: e.c || "נתניה", phone: e.p || null,
        lat: e.lat, lon: e.lon, icon: Places.foodIcon(e.n, e.k) };
    });
  } else {
    const key = `livraison.ens.v1.${cat.id}.${lang}.${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
    items = readCache(key);
    if (!items) {
      // Photon et Overpass en même temps : on garde la première réponse non vide (quelques secondes au plus)
      const found = await firstFull([photonNear(cat, at, lang).catch(() => []), overpassNear(cat, at, lang)]);
      const seen = new Set();
      items = found.filter(x => {
        const k = x.name + "|" + x.lat.toFixed(3) + "," + x.lon.toFixed(3);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (items.length) writeCache(key, items);
    }
    items = items.map(x => Object.assign({ icon: cat.id === "food" ? Places.foodIcon(x.name) : cat.icon }, x));
  }
  return items.map(x => Object.assign(x, { km: Places.km(at, x) })).sort((a, b) => a.km - b.km).slice(0, 80);
}

window.Enseignes = { CATS, list };

})();
