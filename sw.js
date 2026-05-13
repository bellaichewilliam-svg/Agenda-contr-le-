// כדאי v31 — service worker
// Strategie: NETWORK-FIRST pour HTML/CSS/JS (toujours frais quand en ligne)
// CACHE-FIRST seulement pour les assets statiques.

const CACHE = "kedai-v32";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/products.js",
  "./data/i18n.js",
  "./data/promotions.js",
  "./data/big-deals.js",
  "./data/stores-locations.js",
  "./data/recipes.js",
  "./data/store-brands.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, timeoutMs = 4000) {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      caches.match(req).then(c => { if (c && !settled) { settled = true; resolve(c); } });
    }, timeoutMs);
    fetch(req).then(r => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      resolve(r);
    }).catch(() => {
      if (settled) return;
      caches.match(req).then(c => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(c || new Response("", { status: 504 }));
      });
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.(html|css|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/")) {
    e.respondWith(networkFirst(req));
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }))
  );
});
