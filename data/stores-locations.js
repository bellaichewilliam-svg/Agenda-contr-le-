// Magasins physiques par enseigne (échantillon représentatif des principales villes israéliennes)
// Format : { name, lat, lon, address, delivery: bool, hours: "..." }
//
// Note : adresses vérifiées partiellement via les sources officielles. Les
// chaînes ne publient pas toutes leurs ~30-67 magasins sur des API ouvertes.
// Pour une liste complète, l'utilisateur doit consulter le store locator
// officiel de chaque enseigne (URL dans STORE_FINDERS).

const STORE_LOCATIONS = {
  rami_levy: [
    { name: "Rami Levy Bnei Brak", lat: 32.0859, lon: 34.8316, address: "Mivtsa Kadesh 66, Bnei Brak", delivery: true, hours: "Dim-Mar 8h-22h, Mer-Jeu 7h30-23h, Ven 7h30-15h30" },
    { name: "Rami Levy Talpiot Jérusalem", lat: 31.7497, lon: 35.2192, address: "HaUman 8, Talpiot, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Rami Levy Givat Shaul", lat: 31.7867, lon: 35.1853, address: "Beit HaDfus 14, Givat Shaul, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Rami Levy Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "Sakharov 31, Rishon LeZion", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Ashdod", lat: 31.7996, lon: 34.6437, address: "HaShita 12, Ashdod", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Haïfa Hutzot", lat: 32.7940, lon: 35.0423, address: "Hutzot HaMifratz, Haïfa", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Beersheba", lat: 31.2589, lon: 34.7980, address: "HaPlada 25, Beersheba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Petah Tikva", lat: 32.0878, lon: 34.8867, address: "HaHistadrut 21, Petah Tikva", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Netanya Cinema Gil", lat: 32.3140, lon: 34.8645, address: "HaOrzim 4, Netanya (Cinema Gil)", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h30-15h30" },
    { name: "Rami Levy Netanya Hartom", lat: 32.2880, lon: 34.8568, address: "Hartom 12, Netanya", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Hadera", lat: 32.4340, lon: 34.9196, address: "HaNassi 50, Hadera", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Modiin", lat: 31.8951, lon: 35.0102, address: "Yitzhak Rabin 36, Modiin", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Ra'anana", lat: 32.1847, lon: 34.8703, address: "Ahuza 91, Ra'anana", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Kfar Saba", lat: 32.1782, lon: 34.9075, address: "Weizmann 162, Kfar Saba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" }
  ],
  shufersal: [
    { name: "Shufersal Deal Dizengoff", lat: 32.0826, lon: 34.7740, address: "Dizengoff 50, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-16h" },
    { name: "Shufersal Big Givat Shaul", lat: 31.7867, lon: 35.1853, address: "Beit HaDfus 12, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Shufersal Sheli Carmel", lat: 32.8050, lon: 34.9819, address: "HaNassi 124, Haïfa", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Express Ramat Aviv", lat: 32.1108, lon: 34.7919, address: "Einstein 40, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-16h" },
    { name: "Shufersal Deal Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Hatkuma 25, Petah Tikva", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Shufersal Deal Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "Rothschild 10, Rishon LeZion", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Yesh Beersheba", lat: 31.2589, lon: 34.7980, address: "Henrietta Szold 11, Beersheba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Deal Netanya Poleg", lat: 32.2970, lon: 34.8560, address: "HaMelacha 32, Netanya (Poleg)", delivery: true, hours: "Dim-Mer 10h-22h, Jeu 10h-24h, Ven 8h-14h" },
    { name: "Shufersal Sheli Netanya", lat: 32.3340, lon: 34.8580, address: "Smilansky 13, Netanya", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Deal Hadera", lat: 32.4340, lon: 34.9196, address: "HaGdud HaIvri 1, Hadera", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Deal Herzliya", lat: 32.1640, lon: 34.8489, address: "Sokolov 36, Herzliya", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-16h" },
    { name: "Shufersal Deal Ra'anana", lat: 32.1847, lon: 34.8703, address: "Ahuza 121, Ra'anana", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" }
  ],
  carrefour: [
    { name: "Carrefour Hyper Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Em HaMoshavot 94, Petah Tikva", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Bnei Brak", lat: 32.0832, lon: 34.8338, address: "Jabotinsky 35, Bnei Brak", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "HaArbaa 10, Rishon LeZion", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Ashdod", lat: 31.7996, lon: 34.6437, address: "Sderot Tagor 1, Ashdod", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Holon", lat: 32.0117, lon: 34.7794, address: "Sokolov 29, Holon", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" }
  ],
  yochananof: [
    { name: "Yochananof Netanya", lat: 32.3140, lon: 34.8645, address: "HaOrzim 2, Netanya (Cinema Gil)", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-15h" },
    { name: "Yochananof Tel Aviv Yehuda HaLevi", lat: 32.0644, lon: 34.7700, address: "Yehuda HaLevi 28, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-15h" },
    { name: "Yochananof Holon", lat: 32.0117, lon: 34.7794, address: "Sokolov 41, Holon", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Hatkuma 14, Petah Tikva", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "Yotam 17, Rishon LeZion", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Beersheba", lat: 31.2589, lon: 34.7980, address: "Tuviahu 29, Beersheba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Ashkelon", lat: 31.6688, lon: 34.5742, address: "Ben Gurion 50, Ashkelon", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Rehovot", lat: 31.8930, lon: 34.8120, address: "Bilu 24, Rehovot", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" }
  ],
  victory: [
    { name: "Victory Tel Aviv Ahad Ha'Am", lat: 32.0664, lon: 34.7702, address: "Ahad Ha'Am 13, Tel Aviv", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-16h" },
    { name: "Victory Ramat Gan", lat: 32.0683, lon: 34.8248, address: "Herzl 42, Ramat Gan", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Victory Netanya", lat: 32.3140, lon: 34.8645, address: "HaOrzim 4, Netanya", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Victory Hadera", lat: 32.4340, lon: 34.9196, address: "Rothschild 89, Hadera", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Victory Herzliya", lat: 32.1640, lon: 34.8489, address: "Sapir 16, Herzliya", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Victory Holon", lat: 32.0117, lon: 34.7794, address: "Pinchas Lavon 5, Holon", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" }
  ],
  tiv_taam: [
    { name: "Tiv Taam Tel Aviv Allenby", lat: 32.0664, lon: 34.7702, address: "Allenby 99, Tel Aviv", delivery: true, hours: "Lun-Sam 9h-22h, Dim 9h-23h" },
    { name: "Tiv Taam Ramat Gan", lat: 32.0683, lon: 34.8248, address: "Hashalom 23, Ramat Gan", delivery: true, hours: "Lun-Sam 9h-22h" },
    { name: "Tiv Taam Herzliya", lat: 32.1640, lon: 34.8489, address: "Sokolov 6, Herzliya", delivery: true, hours: "Lun-Sam 9h-22h" }
  ],
  osher_ad: [
    { name: "Osher Ad Netanya", lat: 32.3093, lon: 34.8780, address: "Tom Lantos 60, Netanya (Naimi Mall)", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Osher Ad Bnei Brak", lat: 32.0832, lon: 34.8338, address: "Hashniayim 4, Bnei Brak", delivery: false, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Osher Ad Modiin Illit", lat: 31.9344, lon: 35.0464, address: "Yehuda HaNasi 8, Modiin Illit", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Osher Ad Beit Shemesh", lat: 31.7510, lon: 34.9885, address: "Nahar HaYarden 2, Beit Shemesh", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Osher Ad Jérusalem Givat Shaul", lat: 31.7867, lon: 35.1853, address: "Avraham Stern 16, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Osher Ad Ashdod", lat: 31.7996, lon: 34.6437, address: "HaMelacha 18, Ashdod", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" }
  ],
  boom: [
    { name: "Boom Lod", lat: 31.9510, lon: 34.8956, address: "Hertzl 50, Lod", delivery: false, hours: "Dim-Jeu 8h-21h, Ven 7h-14h" },
    { name: "Boom Ashdod", lat: 31.7996, lon: 34.6437, address: "Hapardes 12, Ashdod", delivery: false, hours: "Dim-Jeu 8h-21h, Ven 7h-14h" },
    { name: "Boom Beersheba", lat: 31.2589, lon: 34.7980, address: "Hashlomim 8, Beersheba", delivery: false, hours: "Dim-Jeu 8h-21h, Ven 7h-14h" }
  ],
  hatzi_hinam: [
    { name: "Hatzi Hinam Bnei Brak", lat: 32.0832, lon: 34.8338, address: "Hashomer 3, Bnei Brak", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Hatzi Hinam Modiin Illit", lat: 31.9344, lon: 35.0464, address: "Acharei HaNevi'im 16, Modiin Illit", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Hatzi Hinam Jérusalem Sanhedria", lat: 31.7997, lon: 35.2003, address: "Bar Ilan 64, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" },
    { name: "Hatzi Hinam Beitar Illit", lat: 31.6939, lon: 35.1183, address: "Ahi Akiva 6, Beitar Illit", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-14h" }
  ]
};

// Magasins de proximité (24/7 ou convenience) - seulement géoloc, pas de
// comparaison de prix car gamme limitée et premium par nature.
const STORE_LOCATIONS_EXTRA = {
  ampm: {
    name: "AM:PM",
    color: "#0ea5e9",
    icon: "AM",
    note: "24/7 · Tel Aviv & alentours · Convenience",
    locations: [
      { name: "AM:PM Dizengoff", lat: 32.0826, lon: 34.7740, address: "Dizengoff 99, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Ibn Gvirol", lat: 32.0780, lon: 34.7825, address: "Ibn Gvirol 80, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Allenby", lat: 32.0664, lon: 34.7702, address: "Allenby 60, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Florentin", lat: 32.0556, lon: 34.7686, address: "Florentin 26, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Rothschild", lat: 32.0633, lon: 34.7714, address: "Rothschild 35, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Ramat Aviv", lat: 32.1108, lon: 34.7919, address: "Brodetsky 41, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Neve Tzedek", lat: 32.0631, lon: 34.7642, address: "Yehuda HaLevi 14, Tel Aviv", delivery: true, hours: "24/7" },
      { name: "AM:PM Yafo", lat: 32.0500, lon: 34.7561, address: "Yefet 23, Yafo", delivery: true, hours: "24/7" },
      { name: "AM:PM Herzliya", lat: 32.1640, lon: 34.8489, address: "Sokolov 28, Herzliya", delivery: true, hours: "24/7" },
      { name: "AM:PM Ramat Gan", lat: 32.0683, lon: 34.8248, address: "Bialik 30, Ramat Gan", delivery: true, hours: "24/7" }
    ]
  }
};

// URLs des store locators officiels (pour trouver TOUS les magasins de chaque chaîne)
const STORE_FINDERS = {
  rami_levy:   "https://www.rami-levy.co.il/he/branches",
  shufersal:   "https://www.shufersal.co.il/online/he/Stores",
  carrefour:   "https://www.carrefour.co.il/branches",
  yochananof:  "https://www.yochananof.co.il/branches",
  victory:     "https://www.victoryonline.co.il/branches",
  tiv_taam:    "https://tivtaam.co.il/branches",
  osher_ad:    "https://www.osherad.co.il/branches",
  boom:        null,
  hatzi_hinam: "https://www.hazi-hinam.co.il/branches"
};

// Sites en ligne pour chaque enseigne (commande/livraison)
const STORE_WEBSITES = {
  rami_levy:   "https://www.rami-levy.co.il",
  shufersal:   "https://www.shufersal.co.il",
  carrefour:   "https://www.carrefour.co.il",
  yochananof:  "https://www.yochananof.co.il",
  victory:     "https://www.victoryonline.co.il",
  tiv_taam:    "https://tivtaam.co.il",
  osher_ad:    "https://www.osherad.co.il",
  boom:        null,
  hatzi_hinam: "https://www.hazi-hinam.co.il"
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Distance maximale typique de livraison par enseigne (en km)
// Au-delà, on considère que le magasin ne livre pas chez toi.
// Basé sur les zones de livraison annoncées par les enseignes.
const DELIVERY_RADIUS_KM = {
  rami_levy:   12,   // Rami Levy livre dans sa ville + cités voisines
  shufersal:   10,   // Shufersal livre dans la zone urbaine
  carrefour:   15,   // Carrefour Hyper a une grande zone
  yochananof:  10,
  victory:     8,    // Victory zone limitée
  tiv_taam:    12,
  osher_ad:    8,
  hatzi_hinam: 10,
  boom:        0     // Boom = retrait magasin uniquement
};

function deliversToUser(chain, store, distanceKm) {
  if (!store.delivery) return false;
  const radius = DELIVERY_RADIUS_KM[chain] || 10;
  return distanceKm <= radius;
}

function nearestStores(userLat, userLon, perChain = 1, maxDistanceKm = 30) {
  const out = {};
  Object.entries(STORE_LOCATIONS).forEach(([chain, stores]) => {
    const withDist = stores
      .map(s => ({ ...s, distance: haversineKm(userLat, userLon, s.lat, s.lon) }))
      .filter(s => s.distance <= maxDistanceKm);
    withDist.forEach(s => { s.deliversHere = deliversToUser(chain, s, s.distance); });
    withDist.sort((a, b) => a.distance - b.distance);
    if (withDist.length > 0) out[chain] = withDist.slice(0, perChain);
  });
  return out;
}

// Magasins de proximité dans le rayon de l'utilisateur
function nearestExtraStores(userLat, userLon, maxDistanceKm = 15) {
  const out = {};
  Object.entries(STORE_LOCATIONS_EXTRA).forEach(([chainId, info]) => {
    const withDist = info.locations
      .map(s => ({ ...s, distance: haversineKm(userLat, userLon, s.lat, s.lon) }))
      .filter(s => s.distance <= maxDistanceKm);
    withDist.sort((a, b) => a.distance - b.distance);
    if (withDist.length > 0) {
      out[chainId] = { name: info.name, color: info.color, icon: info.icon, note: info.note, store: withDist[0] };
    }
  });
  return out;
}

function wazeURL(lat, lon) { return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`; }
function googleMapsURL(lat, lon) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`; }

if (typeof module !== "undefined") {
  module.exports = { STORE_LOCATIONS, STORE_LOCATIONS_EXTRA, STORE_WEBSITES, STORE_FINDERS, DELIVERY_RADIUS_KM, haversineKm, nearestStores, nearestExtraStores, deliversToUser, wazeURL, googleMapsURL };
}

