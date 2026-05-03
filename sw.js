// PrixMalin service worker - mode hors-ligne
// Stratégie : Stale-While-Revalidate pour les ressources statiques,
//             Network-first pour live-prices.json (toujours frais)

const CACHE = "prixmalin-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/products.js",
  "./data/i18n.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // live-prices : network-first
  if (url.pathname.endsWith("/live-prices.json")) {
    e.respondWith(
      fetch(req).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Reste : stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchP = fetch(req).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || fetchP;
    })
  );
});
