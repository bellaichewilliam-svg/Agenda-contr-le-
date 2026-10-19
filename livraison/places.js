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
    label: [isPoi ? p.name : null, p.street || (!isPoi ? p.name : ""), city].filter(Boolean).join(", ")
  };
}

async function search(q, lang) {
  const key = lang + "|" + q.trim().toLowerCase();
  if (cache[key]) return cache[key];
  const home = CONFIG.cities.find(c => c.id === CONFIG.homeCity);
  const url = `${API}?limit=7&bbox=${BBOX}&lat=${home.lat}&lon=${home.lon}`
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
  cache[key] = list;
  return list;
}

// Adresse la plus proche d'une position GPS (« 📍 Ma position »)
async function reverse(lat, lon, lang) {
  const res = await fetch(`${API.replace("/api/", "/reverse")}?lat=${lat}&lon=${lon}&limit=5` + (lang === "fr" ? "&lang=fr" : ""));
  if (!res.ok) throw new Error("photon " + res.status);
  const data = await res.json();
  lastOk = true;
  return (data.features || []).map(toPlace).filter(p => p.streetName || p.brand);
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
          <span class="ac-ico">${p.brand ? "🏪" : "📍"}</span>
          <span><b>${UI.esc(p.brand || p.street || p.city)}</b><small>${UI.esc(p.brand ? [p.street, p.city].filter(Boolean).join(", ") : p.city)}</small></span>
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

window.Places = { attach, search, reverse, matchCity, get serviceOk() { return lastOk; } };

})();
