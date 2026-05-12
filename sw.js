// PrixMalin service worker - mode hors-ligne
// Stratégie révisée : NETWORK-FIRST pour HTML/CSS/JS (toujours frais
// quand en ligne), CACHE-FIRST seulement pour les assets statiques rares.
// Le but : éviter que la version cachée bloque les mises à jour.

const CACHE = "prixmalin-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/products.js",
  "./data/i18n.js",
  "./data/promotions.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => clients.forEach(c => c.postMessage({ type: "sw-updated" })))
  );
});

// Helper : tente network avec timeout, fallback cache
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
      if (r && r.ok) {
        caches.open(CACHE).then(c => c.put(req, r.clone()));
      }
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

  // Ne gère que notre origine
  if (url.origin !== location.origin) return;

  // HTML/CSS/JS/JSON : toujours réseau d'abord pour avoir la dernière version
  if (/\.(html|css|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/")) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Reste (images, fonts) : cache-first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }))
  );
});
