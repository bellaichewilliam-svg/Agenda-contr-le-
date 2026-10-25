// ============================================================================
// Recherche d'adresses et d'enseignes pendant la frappe (Photon, données
// OpenStreetMap, gratuit, sans clé). Le client choisit dans la liste : on
// garde l'adresse exacte, ses coordonnées, la ville et le nom de l'enseigne.
// ============================================================================

(function () {
"use strict";

const API = "https://photon.komoot.io/api/";
// Israël (pour ne proposer que des adresses du pays)
const BBOX = "34.2,29.4,35.95,33.4";
// Catégories OpenStreetMap qui correspondent à une enseigne / un lieu nommé
const POI_KEYS = ["amenity", "shop", "office", "tourism", "healthcare", "leisure", "craft", "building", "public_transport", "aeroway"];

let lastOk = false;   // le service a répondu au moins une fois
const cache = {};
let near = null;      // position du client (pour classer les enseignes de la plus proche à la plus loin)
let local = null;     // enseignes connues de HOP (commerces partenaires), proposées en premier

function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distText(p) {
  if (!near || p.lat == null) return "";
  const d = km(near, p);
  return d < 1 ? `${Math.max(50, Math.round(d * 20) * 50)} m` : `${d.toFixed(1).replace(".", ",")} km`;
}

// Adresse hors d'Israël ou écrite en arabe (Jordanie, Cisjordanie…) : jamais proposée
const FOREIGN = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
function foreign(p) {
  return (p.cc && p.cc !== "IL") || FOREIGN.test([p.label, p.brand, p.street, p.city].join(" "));
}

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s'’"\-־.]/g, "");
}

// Ville de la liste config.js correspondant au nom renvoyé par la carte
function matchCity(name) {
  const n = normalize(name);
  if (!n) return null;
  const c = CONFIG.cities.find(c => [c.fr, c.he, c.id, ...(c.aliases || [])].some(x => {
    const v = normalize(x);
    return v && (n === v || n.startsWith(v) || v.startsWith(n));
  }));
  return c ? c.id : null;
}

function toPlace(f) {
  const p = f.properties || {};
  const [lon, lat] = f.geometry.coordinates;
  const isPoi = POI_KEYS.includes(p.osm_key) && p.name && p.osm_value !== "yes";
  const streetLine = [p.street || (!isPoi && p.type !== "city" ? p.name : ""), p.housenumber].filter(Boolean).join(" ");
  const city = p.city || p.town || p.village || p.locality || p.district || p.county || "";
  return {
    lat, lon, city, type: p.type, cc: String(p.countrycode || "").toUpperCase(),
    streetName: p.street || (!isPoi ? p.name : "") || "",
    housenumber: p.housenumber || "",
    cityId: matchCity(city) || matchCity(p.district) || matchCity(p.county),
    brand: isPoi ? p.name : null,
    poi: isPoi,   // commerce trouvé sur la carte : HOP! l'apprend s'il n'est pas dans son annuaire
    osm: isPoi && p.osm_id ? { type: p.osm_type, id: p.osm_id } : null,
    street: streetLine || p.name || "",
    exact: !!(p.housenumber || isPoi),
    // Le numéro a sa propre case : il n'est pas répété dans le libellé
    // (sauf pour une enseigne : son adresse complète est affichée telle quelle)
    label: [isPoi ? p.name : null, isPoi ? streetLine : p.street || p.name, city].filter(Boolean).join(", ")
  };
}

// ---------------------------------------------------------------------------
// Annuaire HOP! des commerces (annuaire.json : restaurants, makolets, épiceries…
// de Netanya, avec adresse, téléphone et position) : cherché en premier, tout de
// suite, même si un commerce n'est pas sur la carte. Chargé à la première recherche.
// ---------------------------------------------------------------------------
let dir = null;
// Deux fiches du même commerce (même adresse, même point, un mot du nom en commun : « Pizzeria La Italia » et
// « La Italia Netanya ») : on n'en garde qu'une, l'autre nom servant encore à la recherche
// (les mots génériques ne comptent pas : pizza, burger, café, casher, le nom de la ville… ; même nom = même commerce)
const GENERIC_WORDS = new RegExp("^(netanya|נתניה|natanya|ltd|בעמ|the|la|le|les|de|du|des|bar|cafe|café|coffee|קפה|pizza|pizzeria|פיצריה|פיצה|מסעדת|מסעדה|restaurant|burger|בורגר|המבורגר|falafel|פלאפל|houmous|hummus|חומוס|chawarma|shawarma|שווארמה|schnitzel|שניצל|sushi|סושי|grill|גריל|kitchen|bakery|מאפייה|express|chicken|kebab|קבב|snack|shop|traiteur|קייטרינג|כשר|casher|kosher|zone|industrielle|center|centre|mall|קניון|herzl|הרצל|saveurs|maman|chef|house|street|salad|סלט|בריבוע|carré|carrée|bourekas|בורקס|פוקי|poke|baba|באבא|מאמא|mama|קדימה|כפר|יונה|אבן|יהודה|kadima|pita|פיתה|brochettes|שיפודי|tabun|טאבון|fricassé|פריקסה|הפריקסה)$");
const normName = v => String(v || "").toLowerCase().replace(/[^a-z\u00e0-\u00ff\u0590-\u05ff0-9]/g, "");
const nameWords = e => [e.n, e.fr].join(" ").toLowerCase().split(/[^a-z\u00e0-\u00ff\u0590-\u05ff0-9]+/).filter(w => w.length >= 4 && !GENERIC_WORDS.test(w));
const sameShop = (a, b) => (normName(a.fr) && normName(a.fr) === normName(b.fr)) || normName(a.n) === normName(b.n)
  || nameWords(a).some(w => nameWords(b).includes(w));
function dedupeDir(list) {
  const out = [], byPlace = {};
  list.forEach(e => {
    const k = e.lat + "," + e.lon + "," + String(e.s || "").trim();
    const twin = (byPlace[k] || []).find(o => sameShop(o, e));
    if (twin) { twin.alt = (twin.alt || []).concat([e.n, e.fr].filter(Boolean), e.alt || []); return; }
    (byPlace[k] = byPlace[k] || []).push(e);
    out.push(e);
  });
  return out;
}
function loadDir() {
  if (!dir) dir = fetch("annuaire.json?v=" + DIR_VERSION).then(r => (r.ok ? r.json() : [])).then(list => dedupeDir(list).map(e => Object.assign(e, {
    keys: [e.n, e.fr].concat(e.alt || []).map(normalize).filter(Boolean),
    sk: [e.n, e.fr || ""].concat(e.alt || []).join(" ").split(/[\s\-–,()]+/).map(skel).filter(Boolean)
  }))).catch(() => []);
  return dir;
}
// Squelette phonétique d'un mot, le même en hébreu et en lettres latines : « Oshi » et « אושי » → « _s »
// (consonnes seulement, voyelle de tête notée « _ »), pour trouver un nom hébreu tapé en français
const HE_SK = { "ב": "b", "ג": "g", "ד": "d", "ז": "z", "ח": "k", "ט": "t", "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m",
  "נ": "n", "ן": "n", "ס": "s", "פ": "p", "ף": "p", "צ": "c", "ץ": "c", "ק": "k", "ר": "r", "ש": "s", "ת": "t" };
function skel(w) {
  w = String(w || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f'’"׳״.]/g, "");
  if (!w) return "";
  if (/[\u0590-\u05FF]/.test(w)) {
    const lead = /^[אע]/.test(w) ? "_" : "";
    return lead + [...w].map(ch => HE_SK[ch] || "").join("");
  }
  if (!/[a-z]/.test(w)) return "";
  const lead = /^[aeiouy]/.test(w) ? "_" : "";
  w = w.replace(/ph/g, "p").replace(/sh/g, "s").replace(/ch|kh/g, "k").replace(/tz|ts/g, "§").replace(/ck/g, "k");
  return lead + [...w].map(ch => ({ b: "b", v: "b", w: "b", g: "g", j: "g", d: "d", z: "z", k: "k", c: "k", q: "k", x: "k", t: "t",
    l: "l", m: "m", n: "n", s: "s", "§": "c", p: "p", f: "p", r: "r" })[ch] || "").join("");
}
// Icône d'un restaurant selon son nom et son type (pas un burger pour tout le monde)
function foodIcon(name, kind) {
  const t = (String(name || "") + " " + String(kind || "")).toLowerCase();
  const rules = [[/sushi|סושי|יפני|japan/, "🍣"], [/pizz|פיצ/, "🍕"], [/burger|בורגר|המבורגר|mcdonald|מקדונלד/, "🍔"],
    [/סלט|salad|טבעונ|vegan/, "🥗"], [/asia|אסיי|סיני|chin|wok|ווק|thai|תאי|נודל|noodle|chung|ramen|ראמן/, "🥡"],
    [/shawarma|שווארמ|שווארמה|falafel|פלאפל|חומוס|hummus|kebab|קבב|סביח|sabich|אוכל רחוב|street/, "🥙"],
    [/גלידה|גלידר|gelat|glace|ice ?cream|יוגורט/, "🍦"], [/bagel|בייגל|מאפ|bakery|boulang|patiss|קונדיטור|עוגה|cake|donut|סופגני|croissant/, "🥐"],
    [/איטלק|ital|pasta|פסטה/, "🍝"], [/בשר|grill|גריל|steak|סטייק|אסאדו|מעשנ|smoke|bbq/, "🥩"],
    [/עוף|chicken|שניצל|schnitzel/, "🍗"], [/דגים|דג |fish|פירות ים/, "🐟"], [/כריך|sandwich|טוסט|deli|דלי/, "🥪"],
    [/פאב|pub|בירה|beer|bar\b/, "🍺"], [/קפה|cafe|café|coffee|ארומה|aroma|קופיקס|cofix|espresso/, "☕"]];
  for (const [rx, ico] of rules) if (rx.test(t)) return ico;
  return "🍽️";
}
const DIR_VERSION = "11";
// Ce que les clients tapent en français / anglais → le nom en hébreu (chaînes, mots courants)
const ALIASES = [
  ["mcdonalds", "מקדונלד"], ["mcdonald", "מקדונלד"], ["mcdo", "מקדונלד"], ["macdo", "מקדונלד"], ["burgerking", "בורגרקינג"],
  ["kfc", "kfc"], ["dominos", "דומינו"], ["domino", "דומינו"], ["pizzahut", "פיצההאט"], ["superpharm", "סופרפארם"],
  ["shufersal", "שופרסל"], ["ramilevy", "רמילוי"], ["yochananof", "יוחננוף"], ["victory", "ויקטורי"], ["osherad", "אושרעד"],
  ["aroma", "ארומה"], ["cofix", "קופיקס"], ["landwer", "לנדוור"], ["greg", "גרג"], ["cafecafe", "קפהקפה"], ["japanika", "ג'פניקה"],
  ["sushi", "סושי"], ["pizza", "פיצה"], ["pizzeria", "פיצריה"], ["shawarma", "שווארמה"], ["chawarma", "שווארמה"], ["falafel", "פלאפל"],
  ["burger", "בורגר"], ["hamburger", "המבורגר"], ["makolet", "מכולת"], ["epicerie", "מכולת"], ["pharmacie", "פארם"], ["pharmacy", "פארם"],
  ["boulangerie", "מאפיה"], ["bakery", "מאפיה"], ["patisserie", "קונדיטוריה"], ["fleurs", "פרחים"], ["fleuriste", "פרחים"],
  ["cafe", "קפה"], ["nina", "נינה"], ["samaki", "סימאקי"], ["simaki", "סימאקי"], ["golda", "גולדה"], ["humus", "חומוס"], ["houmous", "חומוס"]
].map(([a, b]) => [normalize(a), normalize(b)]);
function variants(nq) {
  const out = [nq];
  let t = nq;
  for (const [a, b] of ALIASES) if (t.includes(a)) t = t.split(a).join(b);
  if (t !== nq) out.push(t);
  return out;
}
// Nom affiché en français et en hébreu : « Nina Sushi · נינה סושי » (l'hébreu d'abord en hébreu)
function dirName(e, lang) {
  if (!e.fr || normalize(e.fr) === normalize(e.n) || e.n.includes(e.fr)) return e.n;
  return lang === "he" ? `${e.n} · ${e.fr}` : `${e.fr} · ${e.n}`;
}
// Distance d'édition (lettre oubliée, en trop, changée ou inversée) : « Samaki » ≈ « Simaki »
function editDist(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 9;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev; prev = cur;
  }
  return prev[n];
}
// Commerces partenaires HOP! (avec catalogue) : leur fiche de l'annuaire disparaît partout (recherche, carte,
// enseignes près de vous), pour qu'on ne les trouve jamais « hors catalogue »
let partners = [];
function setPartners(list) {
  partners = (list || []).filter(p => p.lat != null && p.name).map(p => ({ lat: Number(p.lat), lon: Number(p.lon),
    keys: [p.name].concat(String(p.name).split(/[·|\-–]/)).map(normalize).filter(k => k.length >= 3) }));
}
function partnerDup(e) {
  if (!partners.length || e.lat == null) return false;
  const keys = (e.keys || [e.n, e.fr].concat(e.alt || []).map(normalize)).filter(k => k && k.length >= 3);
  return partners.some(p => km(p, e) < 0.3 && p.keys.some(k => keys.some(x => x.includes(k) || k.includes(x))));
}
async function dirSearch(q, at, lang) {
  const nq = normalize(q);
  if (nq.length < 2) return [];
  const list = (await loadDir()).filter(e => !partnerDup(e));
  const vs = variants(nq);
  const words = String(q).split(/[\s,]+/).map(normalize).filter(w => w.length >= 2);
  // Mots tapés en lettres latines : on compare aussi leur squelette à celui des mots du nom (« Oshi » → אושי)
  const qsk = /[a-z]/i.test(q) && !/\d/.test(q) ? q.split(/[\s\-–,]+/).filter(w => w.length >= 2).map(skel).filter(Boolean) : [];
  const score = e => {
    let best = 9;
    for (const k of e.keys) for (const v of vs) {
      if (k === v) best = Math.min(best, 0);
      else if (k.startsWith(v)) best = Math.min(best, 1);
      else if (k.includes(v)) best = Math.min(best, 2);
    }
    // Plusieurs mots (« מקדונלד כשר », « pizza herzl ») : chaque mot se trouve dans le nom
    if (best === 9 && words.length > 1 && words.every(w => e.keys.some(k => k.includes(w)))) best = 2.5;
    if (best === 9 && qsk.length) {
      const hits = qsk.filter(x => e.sk.includes(x));
      if (hits.length >= Math.ceil(qsk.length / 2) && hits.some(x => x.length >= 2)) best = 3 + (qsk.length - hits.length) * 0.5;
    }
    return best;
  };
  const hits = list.map(e => ({ e, sc: score(e) })).filter(x => x.sc < 9);
  // Rien de trouvé : une faute de frappe ? On propose les noms les plus proches (« Vouliez-vous dire… »)
  // (aussi quand seuls des noms vaguement ressemblants sortent : une lettre de travers compte plus)
  if (!hits.some(x => x.sc <= 2.5) && nq.length >= 4 && !/\d/.test(nq)) {
    const tol = nq.length <= 6 ? 1 : 2;
    list.forEach(e => {
      const d = Math.min(...e.keys.map(k => Math.min(editDist(nq, k), k.length > nq.length ? editDist(nq, k.slice(0, nq.length)) : 9)));
      if (d > 0 && d <= tol && !hits.some(x => x.e === e)) hits.push({ e, sc: 2.6 + d * 0.2, fuzzy: true });
    });
  }
  return hits.sort((a, b) => (a.sc - b.sc) || (km(at, a.e) - km(at, b.e))).slice(0, 8)
    .map(({ e, fuzzy }) => Object.assign(dirPlace(e, lang), fuzzy ? { fuzzy: true } : {}));
}
// Une fiche de l'annuaire → une adresse choisie (recherche, ou rond 🍴 touché sur la carte)
function dirPlace(e, lang) {
  const m = String(e.s || "").match(/^(.*?)\s+(\d+\S*)$/);
  const streetName = m ? m[1] : e.s || "", housenumber = m ? m[2] : "";
  const city = e.c || "נתניה";
  const name = dirName(e, lang);
  return { lat: e.lat, lon: e.lon, city, type: "house", streetName, housenumber, hit: true, dir: true,
    cityId: matchCity(city) || nearestCity(e.lat, e.lon), brand: name, street: e.s || e.n, exact: true,
    phone: e.p || null, hours: e.h || null, kind: e.k || null, food: e.t !== "shop",
    label: [name, e.s, city].filter(Boolean).join(", ") };
}

async function search(q, lang) {
  const at = near || CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  const mine = local ? await Promise.resolve(local(q)).catch(() => []) : [];
  const known = await dirSearch(q, at, lang).catch(() => []);
  const ms = new Set(mine.map(p => normalize(p.brand)));
  const extra = mine.concat(known.filter(p => !ms.has(normalize(p.brand))));
  const list = await searchMap(q, lang).catch(e => { if (!extra.length) throw e; return []; });
  // Même commerce déjà proposé (même nom, à moins de 150 m) : pas en double
  const dup = p => p.brand && extra.some(x => x.lat != null && normalize(x.brand) === normalize(p.brand) && km(x, p) < 0.15);
  return extra.concat(list.filter(p => !dup(p)));
}
async function searchMap(q, lang) {
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  const at = near || home;
  const key = lang + "|" + q.trim().toLowerCase() + "|" + at.lat.toFixed(2) + "," + at.lon.toFixed(2);
  if (cache[key]) return cache[key];
  // Priorité forte à la distance : « Golda » donne d'abord la Golda du quartier, pas la plus connue du pays
  const base = `${API}?bbox=${BBOX}&lat=${at.lat}&lon=${at.lon}&location_bias_scale=0.1&zoom=14`
    + (lang === "fr" ? "&lang=fr" : "") + "&q=" + encodeURIComponent(q);
  // En plus, les commerces seulement : un nom court (« Nina ») n'est plus noyé sous les rues et les lieux homonymes
  const [res, poi] = await Promise.all([fetch(base + "&limit=15"),
    fetch(base + "&limit=15&" + ["amenity", "shop", "craft", "office", "healthcare"].map(k => "osm_tag=" + k).join("&")).catch(() => null)]);
  if (!res.ok) throw new Error("photon " + res.status);
  const data = await res.json();
  const pdata = poi && poi.ok ? await poi.json().catch(() => null) : null;
  lastOk = true;
  // Pas de doublons (même libellé), pas de pays/régions entières
  const seen = new Set();
  const nq = normalize(q);
  // Seulement en Israël, en hébreu / français / anglais, et pas à l'autre bout du pays (60 km au plus)
  const ok = p => !foreign(p) && km(at, p) <= 60;
  const shops = ((pdata && pdata.features) || []).map(toPlace).filter(p => p.brand && ok(p));
  const named = shops.filter(p => normalize(p.brand).includes(nq)).sort((a, b) => km(at, a) - km(at, b));
  const list = named.concat((data.features || []).map(toPlace).filter(ok), shops.filter(p => !named.includes(p))).filter(p => {
    // Seulement des rues, adresses ou enseignes (pas des villes ou régions entières)
    if (!p.brand && (!p.streetName || ["city", "district", "county", "state", "country", "locality"].includes(p.type))) return false;
    if (!p.label || seen.has(p.label)) return false;
    seen.add(p.label);
    return true;
  });
  // Enseigne d'une chaîne (Super-Pharm, poste…) : l'agence la plus proche du client d'abord
  // (les rues gardent leur place : seules les enseignes sont reclassées entre elles)
  if (near) {
    const slots = list.map((p, i) => (p.brand ? i : -1)).filter(i => i >= 0);
    const hit = p => (normalize(p.brand).includes(nq) ? 0 : 1);
    const brands = slots.map(i => list[i]).sort((a, b) => (hit(a) - hit(b)) || (km(near, a) - km(near, b)));
    slots.forEach((i, k) => { list[i] = brands[k]; });
  }
  cache[key] = list.slice(0, 20);
  return cache[key];
}

// Aucune enseigne de ce nom près du client : on cherche le nom autour de lui sur OpenStreetMap
// (Photon ne renvoie parfois que les agences les plus connues, loin du client). Plus lent : la liste
// s'affiche d'abord, ces enseignes proches s'ajoutent en tête quand elles arrivent.
const nearCache = {};
async function moreNearby(q, lang, list) {
  const at = near || CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  const nq = normalize(q);
  if (!at || q.trim().length < 3 || list.some(p => p.brand && p.lat != null && km(at, p) < 4 && (p.hit || normalize(p.brand).includes(nq)))) return [];
  const key = lang + "|" + q.trim().toLowerCase() + "|" + at.lat.toFixed(2) + "," + at.lon.toFixed(2);
  if (!nearCache[key]) nearCache[key] = nearbyByName(q, lang, at).catch(() => []);
  const extra = await nearCache[key];
  const sig = p => normalize(p.brand) + "|" + p.lat.toFixed(3) + "," + p.lon.toFixed(3);
  const seen = new Set(list.filter(p => p.brand && p.lat != null).map(sig));
  return extra.filter(p => !seen.has(sig(p)));
}

// Enseignes dont le nom (français, hébreu, anglais ou marque) contient le texte, à moins de 6 km
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
function nearestCity(lat, lon) {
  const c = CONFIG.cities.filter(c => c.lat != null).sort((a, b) => km({ lat, lon }, a) - km({ lat, lon }, b))[0];
  return c && km({ lat, lon }, c) < 8 ? c.id : null;
}
async function nearbyByName(q, lang, at) {
  const rx = q.trim().replace(/[\\^$.*+?()[\]{}|"]/g, ".");
  const query = `[out:json][timeout:8];nwr[~"^(name|brand)(:(he|en|fr|ru))?$"~"${rx}",i](around:6000,${at.lat},${at.lon});out center tags 8;`;
  let data = null;
  for (const url of OVERPASS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (res.ok) { data = await res.json(); break; }
    } catch (e) { /* serveur suivant */ } finally { clearTimeout(timer); }
  }
  if (!data) return [];
  const out = [];
  for (const e of data.elements || []) {
    const g = e.tags || {};
    const lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
    const name = g["name:" + lang] || (lang === "fr" && g["name:en"]) || g.name || g["name:he"] || g["name:en"] || g.brand;
    if (!name || lat == null || FOREIGN.test(name + " " + (g["addr:street"] || "")) || !(g.amenity || g.shop || g.office || g.tourism || g.healthcare || g.leisure || g.craft)) continue;
    const streetName = g["addr:street"] || "", housenumber = g["addr:housenumber"] || "";
    const city = g["addr:city"] || "";
    const streetLine = [streetName, housenumber].filter(Boolean).join(" ");
    out.push({
      lat, lon, city, type: "house", streetName, housenumber,
      cityId: matchCity(city) || nearestCity(lat, lon), brand: name, street: streetLine || name, exact: true, poi: true,
      phone: g.phone || g["contact:phone"] || g.mobile || g["contact:mobile"] || null,
      label: [name, streetLine, city].filter(Boolean).join(", ")
    });
  }
  return out.sort((a, b) => km(at, a) - km(at, b));
}

// Vrai numéro de téléphone d'une enseigne (OpenStreetMap), pour la commander par téléphone
const phoneCache = {};
async function phoneOf(p) {
  if (!p) return null;
  if (p.phone) return p.phone;
  if (!p.osm || !p.osm.id) return null;
  const kind = { N: "node", W: "way", R: "relation" }[p.osm.type] || "node";
  const key = kind + p.osm.id;
  if (!(key in phoneCache)) {
    phoneCache[key] = (async () => {
      for (const url of OVERPASS) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 6000);
        try {
          const res = await fetch(url, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "data=" + encodeURIComponent(`[out:json][timeout:6];${kind}(${Number(p.osm.id)});out tags;`) });
          if (!res.ok) continue;
          const g = (((await res.json()).elements || [])[0] || {}).tags || {};
          return g.phone || g["contact:phone"] || g.mobile || g["contact:mobile"] || null;
        } catch (e) { /* serveur suivant */ } finally { clearTimeout(timer); }
      }
      return null;
    })();
  }
  return phoneCache[key];
}

// Adresse la plus proche d'une position GPS (« 📍 Ma position »)
// « Ma position » : d'abord l'adresse avec numéro la plus proche, sinon la rue la plus proche
// (si aucune n'a de numéro, on demande à Nominatim, qui le connaît plus souvent)
async function reverse(lat, lon, lang) {
  const res = await fetch(`${API.replace("/api/", "/reverse")}?lat=${lat}&lon=${lon}&limit=10&radius=0.15` + (lang === "fr" ? "&lang=fr" : ""));
  if (!res.ok) throw new Error("photon " + res.status);
  const data = await res.json();
  lastOk = true;
  const here = { lat, lon };
  const list = (data.features || []).map(toPlace).filter(p => (p.streetName || p.brand) && !foreign(p))
    .map(p => Object.assign(p, { d: km(here, p) }))
    .sort((a, b) => (!!b.housenumber - !!a.housenumber) || (!!a.brand - !!b.brand) || a.d - b.d);
  const best = list.find(p => !p.brand) || list[0];
  if (best && !best.brand && (!best.housenumber || best.d > 0.08)) {
    const n = await houseNumberAt(lat, lon, lang).catch(() => null);
    if (n && (!n.street || !best.streetName || n.street === best.streetName || !best.housenumber)) {
      if (n.street) best.streetName = n.street;
      best.housenumber = n.number;
      best.street = [best.streetName, n.number].join(" ");
      best.label = [best.streetName, best.city].filter(Boolean).join(", ");
      best.exact = true;
    }
  }
  return best ? [best].concat(list.filter(p => p !== best)) : list;
}

// Numéro de rue à une position (Nominatim, OpenStreetMap)
async function houseNumberAt(lat, lon, lang) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}&accept-language=${lang === "fr" ? "fr" : "he"}`, { signal: ctl.signal });
    if (!res.ok) return null;
    const a = (await res.json()).address || {};
    return a.house_number ? { number: a.house_number, street: a.road || null } : null;
  } finally { clearTimeout(timer); }
}

// Branche la recherche sur un champ texte.
// opts : { lang(): "fr"|"he", onPick(place), onClear(), texts: { none, pick } }
function attach(input, opts) {
  const box = document.createElement("div");
  box.className = "ac-list hidden";
  box.setAttribute("role", "listbox");
  input.parentNode.style.position = "relative";
  input.parentNode.appendChild(box);
  input.setAttribute("autocomplete", "off");
  let items = [], active = -1, timer = null, seq = 0;
  // Enseigne absente de la carte : le client donne son nom, puis son adresse (rue et numéro)
  let pendingBrand = null;
  const notOnMap = q => ({ quick: true, icon: "🏪", title: (opts.texts().notOnMap || "« {q} » n'est pas sur la carte : indiquez son adresse").replace("{q}", q),
    sub: opts.texts().notOnMapSub || "", apply: () => {
      pendingBrand = q;
      input.value = "";
      input.placeholder = (opts.texts().brandAddr || "Adresse de « {q} » : rue et numéro").replace("{q}", q);
      input.focus();
    } });

  const close = () => { box.classList.add("hidden"); active = -1; };
  const render = () => {
    box.innerHTML = items.length
      ? items.map((p, i) => p.quick
        // Raccourci (« Ma position », adresse enregistrée Maison / Travail…)
        ? `<button type="button" class="ac-item quick${i === active ? " on" : ""}" data-i="${i}">
            <span class="ac-ico">${p.icon || "⭐"}</span><span><b>${UI.esc(p.title)}</b>${p.sub ? `<small>${UI.esc(p.sub)}</small>` : ""}</span></button>`
        : `<button type="button" class="ac-item${i === active ? " on" : ""}" data-i="${i}">
          <span class="ac-ico">${p.partner ? "⭐" : p.brand ? "🏪" : "📍"}</span>
          <span><b>${UI.esc(p.brand || p.street || p.city)}</b><small>${p.fuzzy && opts.texts().didYouMean ? `<i class="ac-fuzzy">${UI.esc(opts.texts().didYouMean)}</i> ` : ""}${p.partner ? `<i class="ac-partner">${UI.esc(opts.texts().partner || "")}</i> ` : p.dir && opts.texts().soon ? `<i class="ac-soon">${UI.esc(opts.texts().soon)}</i> ` : ""}${UI.esc((p.brand ? [p.street, p.city].filter(Boolean).join(", ") : p.city) + (distText(p) ? " · " + distText(p) : ""))}</small></span>
        </button>`).join("")
      : `<div class="ac-empty">${UI.esc(opts.texts().none)}</div>`;
    box.classList.remove("hidden");
  };
  const pick = i => {
    let p = items[i];
    if (!p) return;
    if (p.apply) { close(); p.apply(); return; }
    // Adresse de l'enseigne absente de la carte : la course garde son nom (et HOP! l'apprend)
    if (pendingBrand && !p.brand) {
      p = Object.assign({}, p, { brand: pendingBrand, learned: true, exact: !!p.housenumber,
        label: [pendingBrand, p.street, p.city].filter(Boolean).join(", ") });
      pendingBrand = null;
      input.placeholder = "";
    }
    input.value = p.label;
    input.dataset.picked = p.label;
    input.classList.add("ac-ok");
    close();
    opts.onPick(p);
  };

  input.addEventListener("input", () => {
    if (input.dataset.picked && input.value !== input.dataset.picked) {
      delete input.dataset.picked;
      input.classList.remove("ac-ok");
      opts.onClear();
    }
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { seq++; if (!showQuick()) close(); return; }
    // Le client tape une adresse : les raccourcis disparaissent jusqu'aux résultats
    if (items.length && items[0].quick) { items = []; close(); }
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const list = await search(q, opts.lang());
        if (mine !== seq) return;
        // Pas d'enseigne trouvée : on propose d'indiquer son adresse (le client n'est jamais bloqué)
        const offer = () => !pendingBrand && !items.some(p => p.brand && (p.hit || normalize(p.brand).includes(normalize(q)))) && /[a-zA-Z\u0590-\u05FF]{3}/.test(q) && !/\d/.test(q);
        // Ses adresses déjà utilisées (Simaki Sushi, Maison…) qui correspondent au texte : en premier
        const nq = normalize(q);
        const saved = (opts.quick ? opts.quick() : []).filter(x => x.match && normalize(x.match).includes(nq));
        items = saved.concat(list); active = -1;
        if (offer() && !saved.length) items = items.concat([notOnMap(q)]);
        render();
        const extra = await moreNearby(q, opts.lang(), list);
        if (mine !== seq || !extra.length) return;
        const found = extra.some(p => normalize(p.brand).includes(normalize(q)));
        items = extra.concat(items.filter(p => !(found && p.apply)));
        if (active >= 0) active += extra.length;
        render();
      } catch (e) {
        // Service injoignable : on le dit, et l'adresse tapée sera acceptée telle quelle
        if (mine !== seq) return;
        items = [];
        box.innerHTML = `<div class="ac-empty">⚠️ ${UI.esc(opts.texts().down)}</div>`;
        box.classList.remove("hidden");
      }
    }, 300);
  });
  input.addEventListener("keydown", e => {
    if (box.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === "Enter" && items.length) { pick(active < 0 ? 0 : active); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });
  box.addEventListener("mousedown", e => e.preventDefault()); // garder le focus
  box.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) pick(Number(b.dataset.i)); });
  input.addEventListener("blur", () => setTimeout(close, 150));
  // En touchant le champ : « Ma position » et les adresses enregistrées, tout de suite
  function showQuick() {
    const list = opts.quick ? opts.quick() : [];
    if (!list.length) return false;
    items = list; active = -1; render();
    return true;
  }
  input.addEventListener("focus", () => { if (input.value.trim().length < 3 || input.dataset.picked) showQuick(); });

  return {
    isPicked: () => !!input.dataset.picked,
    // Adresse reprise du carnet : considérée comme choisie sur la carte
    setPicked(label) { input.value = label; input.dataset.picked = label; input.classList.add("ac-ok"); close(); },
    reset() { delete input.dataset.picked; input.classList.remove("ac-ok"); close(); }
  };
}

window.Places = {
  attach, search, moreNearby, phoneOf, reverse, matchCity, km, distText, foodIcon, dirName, dirPlace, directory: () => loadDir().then(l => l.filter(e => !partnerDup(e))), setPartners, partnerDup,
  setNear(p) { near = p && p.lat != null ? { lat: p.lat, lon: p.lon } : null; },
  setLocal(fn) { local = fn; },
  get near() { return near; },
  get serviceOk() { return lastOk; }
};

})();
