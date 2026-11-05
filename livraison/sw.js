// HOP! : service worker minimal, sans cache (le site se met à jour normalement).
// Il sert uniquement aux notifications : « En service » qui reste affichée, et alertes de course.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Notifications déjà vues (touchées ou balayées) : gardées en mémoire (Cache Storage, survit à l'arrêt du worker)
// pour que les renvois suivants de la même alerte ne resonnent plus et ne ressurgissent plus en haut de l'écran
const SEEN = "hop-seen-v1";
// (clé = l'alerte + son titre : « Course annulée » ou « HOP! vous a donné une course » restent de vraies nouvelles alertes)
const seenKey = (tag, title) => new Request(self.registration.scope + "__seen/" + encodeURIComponent(tag + "|" + (title || "")));
const markSeen = (tag, title) => tag && tag !== "hop-duty" ? caches.open(SEEN).then(c => c.put(seenKey(tag, title), new Response(String(Date.now())))).catch(() => {}) : Promise.resolve();
const isSeen = (tag, title) => !tag ? Promise.resolve(false) : caches.open(SEEN).then(c => c.match(seenKey(tag, title))).then(r => !!r).catch(() => false);
// Nettoyage : on oublie les alertes vues depuis plus de 2 jours
const purgeSeen = () => caches.open(SEEN).then(c => c.keys().then(ks => Promise.all(ks.map(k => c.match(k).then(r => r && r.text()).then(v => { if (Date.now() - Number(v || 0) > 2 * 86400000) return c.delete(k); })))) ).catch(() => {});
self.addEventListener("notificationclose", e => { e.waitUntil(markSeen(e.notification.tag || "", e.notification.title)); });

// Notification « push » envoyée par HOP! (nouvelle commande, message) : affichée même appli fermée
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  // Nouvelle course (« o-… ») : elle reste affichée, vibre longtemps et resonne à chaque renvoi (toutes les 5 s)
  const course = /^o-/.test(d.tag || "");
  // Passé hors ligne par HOP! (appli en veille) : la notification « 🟢 En service » n'a plus lieu d'être
  const off = /^⏸️/.test(d.title || "") ? self.registration.getNotifications({ tag: "hop-duty" }).then(l => l.forEach(n => n.close())).catch(() => {}) : null;
  // L'appli ouverte (même en arrière-plan) se met à jour tout de suite : paiement, annulation, nouvelle course…
  self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then(list => list.forEach(c => c.postMessage({ hop: "refresh", tag: d.tag || "" }))).catch(() => {});
  // Déjà vue (touchée / balayée) ou appli ouverte à l'écran (elle sonne elle-même) : plus de renvoi qui ressurgit
  const visible = self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then(list => list.some(c => c.visibilityState === "visible" && c.focused !== false)).catch(() => false);
  e.waitUntil(Promise.all([off, isSeen(d.tag || "", d.title || "HOP!"), visible, purgeSeen()]).then(([, seen, vis]) => {
    if (vis && d.tag && /^(o|boss|ring)-/.test(d.tag)) return self.registration.getNotifications({ tag: d.tag }).then(l => { if (l.length) return; return show(true); });
    return show(seen);
  }));
  function show(quiet) {
    return self.registration.showNotification(d.title || "HOP!", {
      body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag && !quiet, icon: "icon-192.png", badge: "badge-96.png",
      requireInteraction: course && !quiet, silent: !!quiet, actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
      vibrate: quiet ? [] : course ? [900, 300, 900, 300, 900, 300, 900] : [250, 120, 250], data: { url: d.url || self.registration.scope }
    });
  }
});

// Toucher une notification : revenir sur la page HOP! déjà ouverte (Waze reste en arrière-plan)
self.addEventListener("notificationclick", e => {
  let url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  // La page ouvre directement ce dont parle la notification (« m-… » : la conversation, « o-… » / « pay-… » : la course)
  const tag = e.notification.tag || "";
  if (/^(m|o|pay|refund|late)-/.test(tag) && !/[?&]tag=/.test(url)) url += (url.includes("?") ? "&" : "?") + "tag=" + encodeURIComponent(tag);
  // Bouton de la notification du patron (« Je la prends », « Donner à un livreur ») : la page ouvre la course
  if (e.action) url += (url.includes("?") ? "&" : "?") + "do=" + encodeURIComponent(e.action);
  if (e.notification.tag !== "hop-duty") { e.notification.close(); e.waitUntil(markSeen(tag, e.notification.title)); }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const page = url.split("?")[0].split("#")[0];
    const open = list.find(c => c.url.split("?")[0].split("#")[0] === page) || list[0];
    // Page déjà ouverte : elle reçoit l'adresse (ex. la course à donner) et passe au premier plan
    if (open) { open.postMessage({ hop: "open", url }); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
