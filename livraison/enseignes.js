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
  { id: "breakfast", icon: "🥐", q: ['nwr["shop"~"^(bakery|pastry|confectionery)$"]', 'nwr["craft"="bakery"]'], r: 4000 },
  { id: "pressing", icon: "👔", q: ['nwr["shop"~"^(dry_cleaning|laundry)$"]'], r: 5000 },
  { id: "pharm", icon: "💊", q: ['nwr["amenity"="pharmacy"]', 'nwr["shop"="chemist"]'], r: 6000 },
  { id: "post", icon: "📮", q: ['nwr["amenity"="post_office"]', 'nwr["amenity"="parcel_locker"]'], r: 6000 },
  { id: "super", icon: "🛒", q: ['nwr["shop"~"^(supermarket|convenience)$"]'], r: 5000 },
  { id: "kiosk", icon: "🍾", q: ['nwr["shop"~"^(kiosk|tobacco|convenience|alcohol|beverages)$"]'], r: 4000 },
  { id: "food", icon: "🍽️", q: ['nwr["amenity"~"^(restaurant|fast_food)$"]'], r: 2500 },
  { id: "mall", icon: "🛍️", q: ['nwr["shop"~"^(mall|department_store)$"]'], r: 9000 },
  { id: "flower", icon: "💐", q: ['nwr["shop"="florist"]'], r: 6000 },
  { id: "tech", icon: "📱", q: ['nwr["shop"~"^(mobile_phone|electronics|computer)$"]'], r: 5000 },
  { id: "baby", icon: "👶", q: ['nwr["shop"~"^(baby_goods|toys)$"]'], r: 8000 },
  { id: "pet", icon: "🐾", q: ['nwr["shop"="pet"]'], r: 6000 },
  { id: "home", icon: "🔌", q: ['nwr["shop"~"^(hardware|doityourself|houseware|variety_store)$"]'], r: 6000 }
];
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
// Même chose par Photon (rapide, déjà utilisé pour les adresses) : les plus proches d'un type de lieu
const PHOTON_TAGS = {
  breakfast: ["shop:bakery", "shop:pastry", "shop:confectionery"], pressing: ["shop:dry_cleaning", "shop:laundry"],
  pharm: ["amenity:pharmacy", "shop:chemist"], post: ["amenity:post_office", "amenity:parcel_locker"], super: ["shop:supermarket", "shop:convenience"],
  kiosk: ["shop:kiosk", "shop:tobacco", "shop:convenience", "shop:alcohol"],
  food: ["amenity:restaurant", "amenity:fast_food"], mall: ["shop:mall", "shop:department_store"], flower: ["shop:florist"],
  tech: ["shop:mobile_phone", "shop:electronics", "shop:computer"], baby: ["shop:baby_goods", "shop:toys"], pet: ["shop:pet"],
  home: ["shop:hardware", "shop:doityourself", "shop:houseware", "shop:variety_store"]
};
const KEEP_MS = 7 * 86400000;
// Petit-déjeuner : ce qu'on cherche dans les noms et les types de l'annuaire
const dirText = e => [e.n, e.fr, e.k].concat(e.alt || []).join(" ");
const BREAKFAST = /מאפ|בולנז|בולנג|קונדיטור|פטיסרי|בייקרי|bakery|boulang|patiss|p[âa]tisserie|croissant|קרואסון|בגט|baguette|brioche|בריוש|moulin|traiteur|קייטרינג|מעדני|bagel|בייגל|טאבון|לחם/i;
const PRESSING = /מכבס|ניקוי יבש|גיהוץ|pressing|laverie|blanchisserie|nettoyage [àa] sec|dry.?clean|laundry/i;
const FRENCH = /צרפת|בולנז|בולנג|boulang|fran[cç]ais|moulin|מולן|מולאן|parisien|פריזי|baguette|בגט|croissant|brioche/i;
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
  const d = await fetchJson(u.toString(), {}, 6000);
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

// Les commerces ajoutés à l'annuaire par le patron, avec leur catégorie (une fois par visite)
let knownP = null;
async function knownFor(cat, at) {
  if (!knownP) knownP = Promise.resolve(window.Store && Store.placesMap ? Store.placesMap() : []).catch(() => []);
  return ((await knownP) || []).filter(x => x.kind === cat.id && x.lat != null && Places.km(at, x) * 1000 <= cat.r * 2)
    .map(x => { const m = String(x.address || "").match(/^(.*?)\s+(\d+\S*)$/);
      return { name: x.name, street: m ? m[1] : (x.address || ""), number: m ? m[2] : "", city: x.city || "", lat: Number(x.lat), lon: Number(x.lon), icon: cat.icon, known: true }; });
}
const nnKey = v => String(v || "").toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]/g, "");
const sameShop = (a, b) => Places.km(a, b) < 0.15 && (nnKey(a.name).includes(nnKey(b.name)) || nnKey(b.name).includes(nnKey(a.name)));
const withKnown = (items, known) => items.concat(known.filter(k => !items.some(x => sameShop(x, k))));

// Partenaires HOP! d'une catégorie (selon leur métier) : toujours en tête de la liste, même un peu plus loin
const KIND_CAT = { restaurant: "food", pressing: "pressing", pharmacie: "pharm", boutique: "mall", fleuriste: "flower", epicerie: "super" };
async function partnersOf(catId) {
  if (catId === "hop") return [];
  const shops = (await Store.shopsDirectory().catch(() => [])) || [];
  return shops.filter(x => x.lat != null && KIND_CAT[x.kind] === catId).map(x => ({
    name: x.name, street: x.address || "", number: "", city: x.city || "", lat: Number(x.lat), lon: Number(x.lon),
    partner: true, code: x.code, icon: KIND_ICON[x.kind] || "⭐" }));
}
function withPartners(items, partners, at) {
  if (!partners.length) return items;
  const rest = items.filter(x => !(x.partner && partners.some(p => p.code === x.code)) && !partners.some(p => Places.km(p, x) < 0.15));
  return partners.map(x => Object.assign(x, { km: Places.km(at, x) })).concat(rest).slice(0, 80);
}

// Enseignes d'une catégorie autour d'un point, de la plus proche à la plus loin (les partenaires HOP! d'abord)
async function list(catId, at, lang, onMore) {
  const partners = await partnersOf(catId);
  // La carte ne répond pas : les partenaires s'affichent quand même
  const items = await listNear(catId, at, lang, onMore && (more => onMore(withPartners(more, partners, at)))).catch(e => { if (partners.length) return []; throw e; });
  return withPartners(items, partners, at);
}
async function listNear(catId, at, lang, onMore) {
  const cat = CATS.find(c => c.id === catId);
  if (!cat) return [];
  const known = cat.id === "hop" ? [] : await knownFor(cat, at);
  let items;
  if (cat.id === "hop") {
    items = ((await Store.shopsDirectory()) || []).filter(s => s.lat != null).map(s => ({
      name: s.name, street: s.address || "", number: "", city: s.city || "", lat: Number(s.lat), lon: Number(s.lon),
      partner: true, code: s.code, icon: KIND_ICON[s.kind] || "⭐"
    }));
  } else if (cat.id === "breakfast" || cat.id === "pressing") {
    // Petit-déjeuner : boulangeries (françaises d'abord), pâtisseries, traiteurs ; pressing : pressings et laveries.
    // L'annuaire HOP! + ceux de la carte
    const rx = cat.id === "pressing" ? PRESSING : BREAKFAST;
    const dir = (await Places.directory()).filter(e => e.lat != null && Places.km(at, e) * 1000 <= cat.r * 2 && rx.test(dirText(e)));
    // Les commerces partenaires HOP! du même métier en tête (EDMAR pour le pressing…)
    const [shops, show] = await Promise.all([Store.shopsDirectory().catch(() => []), Store.shopsShowcase().catch(() => [])]);
    const tagOf = code => ((show || []).find(x => x.code === code) || {}).tagline || "";
    // (un restaurant qui sert aussi des bagels — Nini deli — n'est pas une boulangerie : pour un restaurant, seul son nom compte)
    const metier = x => (cat.id === "pressing" && x.kind === "pressing") || rx.test(x.kind === "restaurant" ? x.name : x.name + " " + tagOf(x.code));
    const partners = (shops || []).filter(x => x.lat != null && metier(x)).map(x => ({
      name: x.name, street: x.address || "", number: "", city: x.city || "", lat: Number(x.lat), lon: Number(x.lon),
      partner: true, code: x.code, icon: cat.id === "pressing" ? "👔" : "⭐", french: true }));
    const fromDir0 = partners.concat(dir.map(e => {
      const m = String(e.s || "").match(/^(.*?)\s+(\d+\S*)/);
      return { name: Places.dirName(e, lang), street: m ? m[1] : (e.s || ""), number: m ? m[2] : "", city: e.c || "נתניה", phone: e.p || null,
        lat: e.lat, lon: e.lon, lg: e.lg, icon: cat.id === "pressing" ? "👔" : FRENCH.test(dirText(e)) ? "🥖" : /קייטרינג|traiteur|מעדני/i.test(dirText(e)) ? "🍱" : "🥐",
        french: cat.id === "breakfast" && FRENCH.test(dirText(e)) };
    }).filter(x => !partners.some(d => Places.km(d, x) < 0.15)));
    const fromDir = withKnown(fromDir0, known);
    const key = `livraison.ens.v1.${cat.id}.${lang}.${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
    const nn = v => String(v || "").toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]/g, "");
    // Les boulangeries françaises en tête (à distance égale), puis les plus proches
    const merge = fromMap => fromDir.concat(fromMap.filter(x => !fromDir.some(d => Places.km(d, x) < 0.15 && (nn(d.name).includes(nn(x.name)) || nn(x.name).includes(nn(d.name)))))
      .map(x => Object.assign({ icon: cat.icon }, x)))
      .map(x => Object.assign(x, { km: Places.km(at, x) })).sort((a, b) => (a.km - (a.partner ? 99 : a.french ? 1 : 0)) - (b.km - (b.partner ? 99 : b.french ? 1 : 0))).slice(0, 80);
    const cached = readCache(key);
    if (cached) return merge(cached);
    const net = firstFull([photonNear(cat, at, lang).catch(() => []), overpassNear(cat, at, lang)]).catch(() => [])
      .then(fromMap => { if (fromMap.length) writeCache(key, fromMap); return fromMap; });
    // L'annuaire HOP! s'affiche tout de suite ; la carte complète la liste quand elle répond
    if (fromDir.length && onMore) { net.then(m => { if (m.length) onMore(merge(m)); }); return merge([]); }
    return merge(await net);
  } else if (cat.id === "food" && (items = (await Places.directory()).filter(e => e.lat != null && Places.km(at, e) * 1000 <= cat.r * 2)).length) {
    // Restaurants : l'annuaire HOP! (vrais noms, adresses, téléphones), avec l'icône de leur cuisine
    items = items.map(e => {
      const m = String(e.s || "").match(/^(.*?)\s+(\d+\S*)/);
      return { name: Places.dirName(e, lang), street: m ? m[1] : (e.s || ""), number: m ? m[2] : "", city: e.c || "נתניה", phone: e.p || null,
        lat: e.lat, lon: e.lon, lg: e.lg, icon: Places.foodIcon(e.n, e.k) };
    });
    items = withKnown(items, known);
  } else {
    const key = `livraison.ens.v1.${cat.id}.${lang}.${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
    items = readCache(key);
    if (!items) {
      // Photon et Overpass en même temps : on garde la première réponse non vide (quelques secondes au plus)
      // (rien sur la carte, mais des commerces de l'annuaire HOP! : on montre ceux-là)
      const found = await firstFull([photonNear(cat, at, lang).catch(() => []), overpassNear(cat, at, lang)]).catch(e => { if (known.length) return []; throw e; });
      const seen = new Set();
      items = found.filter(x => {
        const k = x.name + "|" + x.lat.toFixed(3) + "," + x.lon.toFixed(3);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (items.length) writeCache(key, items);
    }
    items = withKnown(items.map(x => Object.assign({ icon: cat.id === "food" ? Places.foodIcon(x.name) : cat.icon }, x)), known);
  }
  return items.map(x => Object.assign(x, { km: Places.km(at, x) })).sort((a, b) => a.km - b.km).slice(0, 80);
}

// Préchargement discret (une fois tous les 7 jours) : la liste s'ouvre ensuite instantanément
function warm(at, lang) {
  ["pressing", "pharm", "post", "super"].reduce((p, id) => p.then(() => {
    const cat = CATS.find(c => c.id === id);
    const key = `livraison.ens.v1.${id}.${lang}.${at.lat.toFixed(2)},${at.lon.toFixed(2)}`;
    if (readCache(key)) return;
    return photonNear(cat, at, lang).then(items => { if (items.length) writeCache(key, items); }).catch(() => {});
  }), Promise.resolve());
}

window.Enseignes = { CATS, list, warm };

})();
