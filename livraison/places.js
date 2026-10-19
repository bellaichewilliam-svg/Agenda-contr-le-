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
    lat, lon, city, type: p.type,
    streetName: p.street || (!isPoi ? p.name : "") || "",
    housenumber: p.housenumber || "",
    cityId: matchCity(city) || matchCity(p.district) || matchCity(p.county),
    brand: isPoi ? p.name : null,
    street: streetLine || p.name || "",
    exact: !!(p.housenumber || isPoi),
    // Le numéro a sa propre case : il n'est pas répété dans le libellé
    // (sauf pour une enseigne : son adresse complète est affichée telle quelle)
    label: [isPoi ? p.name : null, isPoi ? streetLine : p.street || p.name, city].filter(Boolean).join(", ")
  };
}

async function search(q, lang) {
  const extra = local ? local(q) : [];
  const list = await searchMap(q, lang).catch(e => { if (!extra.length) throw e; return []; });
  const seen = new Set(extra.map(p => normalize(p.brand)));
  return extra.concat(list.filter(p => !(p.brand && seen.has(normalize(p.brand)) && near && km(near, p) < 0.15)));
}
async function searchMap(q, lang) {
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  const at = near || home;
  const key = lang + "|" + q.trim().toLowerCase() + "|" + at.lat.toFixed(2) + "," + at.lon.toFixed(2);
  if (cache[key]) return cache[key];
  // Priorité forte à la distance : « Golda » donne d'abord la Golda du quartier, pas la plus connue du pays
  const url = `${API}?limit=15&bbox=${BBOX}&lat=${at.lat}&lon=${at.lon}&location_bias_scale=0.1&zoom=14`
    + (lang === "fr" ? "&lang=fr" : "") + "&q=" + encodeURIComponent(q);
  const res = await fetch(url);
  if (!res.ok) throw new Error("photon " + res.status);
  const data = await res.json();
  lastOk = true;
  // Pas de doublons (même libellé), pas de pays/régions entières
  const seen = new Set();
  const list = (data.features || []).map(toPlace).filter(p => {
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
    const brands = slots.map(i => list[i]).sort((a, b) => km(near, a) - km(near, b));
    slots.forEach((i, k) => { list[i] = brands[k]; });
  }
  // Aucune enseigne de ce nom près du client : on cherche le nom autour de lui sur OpenStreetMap
  // (Photon ne renvoie parfois que les agences les plus connues, loin du client)
  if (near && q.trim().length >= 3 && !list.some(p => p.brand && km(near, p) < 4)) {
    const extra = await nearbyByName(q, lang, near).catch(() => []);
    const seenAt = new Set(list.filter(p => p.brand).map(p => normalize(p.brand) + "|" + p.lat.toFixed(3) + "," + p.lon.toFixed(3)));
    const add = extra.filter(p => !seenAt.has(normalize(p.brand) + "|" + p.lat.toFixed(3) + "," + p.lon.toFixed(3)));
    list.unshift(...add);
  }
  cache[key] = list;
  return list;
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
    if (!name || lat == null || !(g.amenity || g.shop || g.office || g.tourism || g.healthcare || g.leisure || g.craft)) continue;
    const streetName = g["addr:street"] || "", housenumber = g["addr:housenumber"] || "";
    const city = g["addr:city"] || "";
    const streetLine = [streetName, housenumber].filter(Boolean).join(" ");
    out.push({
      lat, lon, city, type: "house", streetName, housenumber,
      cityId: matchCity(city) || nearestCity(lat, lon), brand: name, street: streetLine || name, exact: true,
      label: [name, streetLine, city].filter(Boolean).join(", ")
    });
  }
  return out.sort((a, b) => km(at, a) - km(at, b));
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
  const list = (data.features || []).map(toPlace).filter(p => p.streetName || p.brand)
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

  const close = () => { box.classList.add("hidden"); active = -1; };
  const render = () => {
    box.innerHTML = items.length
      ? items.map((p, i) => `<button type="button" class="ac-item${i === active ? " on" : ""}" data-i="${i}">
          <span class="ac-ico">${p.partner ? "⭐" : p.brand ? "🏪" : "📍"}</span>
          <span><b>${UI.esc(p.brand || p.street || p.city)}</b><small>${p.partner ? `<i class="ac-partner">${UI.esc(opts.texts().partner || "")}</i> ` : ""}${UI.esc((p.brand ? [p.street, p.city].filter(Boolean).join(", ") : p.city) + (distText(p) ? " · " + distText(p) : ""))}</small></span>
        </button>`).join("")
      : `<div class="ac-empty">${UI.esc(opts.texts().none)}</div>`;
    box.classList.remove("hidden");
  };
  const pick = i => {
    const p = items[i];
    if (!p) return;
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
    if (q.length < 3) { close(); return; }
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const list = await search(q, opts.lang());
        if (mine !== seq) return;
        items = list; active = -1; render();
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

  return {
    isPicked: () => !!input.dataset.picked,
    // Adresse reprise du carnet : considérée comme choisie sur la carte
    setPicked(label) { input.value = label; input.dataset.picked = label; input.classList.add("ac-ok"); close(); },
    reset() { delete input.dataset.picked; input.classList.remove("ac-ok"); close(); }
  };
}

window.Places = {
  attach, search, reverse, matchCity, km, distText,
  setNear(p) { near = p && p.lat != null ? { lat: p.lat, lon: p.lon } : null; },
  setLocal(fn) { local = fn; },
  get near() { return near; },
  get serviceOk() { return lastOk; }
};

})();
