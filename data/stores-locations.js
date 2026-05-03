// Magasins physiques par enseigne (échantillon représentatif des principales villes israéliennes)
// Format : { name, lat, lon, address, delivery: bool, hours: "..." }
//
// Note : données indicatives basées sur les implantations connues. Pour une
// précision parfaite, le scraper officiel pourra récupérer la liste complète
// depuis les sites des enseignes.

const STORE_LOCATIONS = {
  rami_levy: [
    { name: "Rami Levy Bnei Brak", lat: 32.0832, lon: 34.8338, address: "Rabbi Akiva 90, Bnei Brak", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Rami Levy Talpiot", lat: 31.7497, lon: 35.2192, address: "HaUman 8, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Rami Levy Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "Sakharov 31, Rishon LeZion", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Ashdod", lat: 31.7996, lon: 34.6437, address: "HaShita 12, Ashdod", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Haïfa", lat: 32.7940, lon: 35.0423, address: "Hutzot HaMifratz, Haïfa", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" },
    { name: "Rami Levy Beersheba", lat: 31.2589, lon: 34.7980, address: "HaPlada 25, Beersheba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" }
  ],
  shufersal: [
    { name: "Shufersal Deal Dizengoff", lat: 32.0826, lon: 34.7740, address: "Dizengoff 50, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-16h" },
    { name: "Shufersal Big Givat Shaul", lat: 31.7867, lon: 35.1853, address: "Beit HaDfus 12, Jérusalem", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 6h-15h" },
    { name: "Shufersal Sheli Carmel", lat: 32.8050, lon: 34.9819, address: "HaNassi 124, Haïfa", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-16h" },
    { name: "Shufersal Express Ramat Aviv", lat: 32.1108, lon: 34.7919, address: "Einstein 40, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-16h" },
    { name: "Shufersal Deal Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Hatkuma 25, Petah Tikva", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 6h-15h" }
  ],
  carrefour: [
    { name: "Carrefour Hyper Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Em HaMoshavot 94, Petah Tikva", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Bnei Brak", lat: 32.0832, lon: 34.8338, address: "Jabotinsky 35, Bnei Brak", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Rishon LeZion", lat: 31.9730, lon: 34.7925, address: "HaArbaa 10, Rishon LeZion", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Carrefour Ashdod", lat: 31.7996, lon: 34.6437, address: "Sderot Tagor 1, Ashdod", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" }
  ],
  yochananof: [
    { name: "Yochananof Tel Aviv", lat: 32.0644, lon: 34.7700, address: "Yehuda HaLevi 28, Tel Aviv", delivery: true, hours: "Dim-Jeu 7h-23h, Ven 7h-15h" },
    { name: "Yochananof Holon", lat: 32.0117, lon: 34.7794, address: "Sokolov 41, Holon", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Petah Tikva", lat: 32.0878, lon: 34.8867, address: "Hatkuma 14, Petah Tikva", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" },
    { name: "Yochananof Beersheba", lat: 31.2589, lon: 34.7980, address: "Tuviahu 29, Beersheba", delivery: true, hours: "Dim-Jeu 7h-22h, Ven 7h-15h" }
  ],
  victory: [
    { name: "Victory Tel Aviv", lat: 32.0853, lon: 34.7818, address: "Allenby 37, Tel Aviv", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-16h" },
    { name: "Victory Ramat Gan", lat: 32.0683, lon: 34.8248, address: "Bialik 70, Ramat Gan", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" },
    { name: "Victory Netanya", lat: 32.3215, lon: 34.8533, address: "Herzl 60, Netanya", delivery: true, hours: "Dim-Jeu 8h-22h, Ven 7h-15h" }
  ],
  tiv_taam: [
    { name: "Tiv Taam Tel Aviv", lat: 32.0664, lon: 34.7702, address: "Allenby 99, Tel Aviv", delivery: true, hours: "Lun-Sam 9h-22h, Dim 9h-23h" },
    { name: "Tiv Taam Ramat Gan", lat: 32.0683, lon: 34.8248, address: "Hashalom 23, Ramat Gan", delivery: true, hours: "Lun-Sam 9h-22h" },
    { name: "Tiv Taam Herzliya", lat: 32.1640, lon: 34.8489, address: "Sokolov 6, Herzliya", delivery: true, hours: "Lun-Sam 9h-22h" }
  ],
  osher_ad: [
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

// Distance Haversine entre 2 coordonnées (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function nearestStores(userLat, userLon, perChain = 1) {
  const out = {};
  Object.entries(STORE_LOCATIONS).forEach(([chain, stores]) => {
    const withDist = stores.map(s => ({ ...s, distance: haversineKm(userLat, userLon, s.lat, s.lon) }));
    withDist.sort((a, b) => a.distance - b.distance);
    out[chain] = withDist.slice(0, perChain);
  });
  return out;
}

function wazeURL(lat, lon) { return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`; }
function googleMapsURL(lat, lon) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`; }

if (typeof module !== "undefined") {
  module.exports = { STORE_LOCATIONS, STORE_WEBSITES, haversineKm, nearestStores, wazeURL, googleMapsURL };
}
