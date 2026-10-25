// HOP! : service worker minimal, sans cache (le site se met à jour normalement).
// Il sert uniquement aux notifications : « En service » qui reste affichée, et alertes de course.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Notification « push » envoyée par HOP! (nouvelle commande, message) : affichée même appli fermée
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  // Nouvelle course (« o-… ») : elle reste affichée, vibre longtemps et resonne à chaque renvoi (toutes les 5 s)
  const course = /^o-/.test(d.tag || "");
  // L'appli ouverte (même en arrière-plan) se met à jour tout de suite : paiement, annulation, nouvelle course…
  self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then(list => list.forEach(c => c.postMessage({ hop: "refresh", tag: d.tag || "" }))).catch(() => {});
  e.waitUntil(self.registration.showNotification(d.title || "HOP!", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icon-192.png", badge: "badge-96.png",
    requireInteraction: course, silent: false, actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
    vibrate: course ? [900, 300, 900, 300, 900, 300, 900] : [250, 120, 250], data: { url: d.url || self.registration.scope }
  }));
});

// Toucher une notification : revenir sur la page HOP! déjà ouverte (Waze reste en arrière-plan)
self.addEventListener("notificationclick", e => {
  let url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  // Bouton de la notification du patron (« Je la prends », « Donner à un livreur ») : la page ouvre la course
  if (e.action) url += (url.includes("?") ? "&" : "?") + "do=" + encodeURIComponent(e.action);
  if (e.notification.tag !== "hop-duty") e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const page = url.split("?")[0].split("#")[0];
    const open = list.find(c => c.url.split("?")[0].split("#")[0] === page) || list[0];
    // Page déjà ouverte : elle reçoit l'adresse (ex. la course à donner) et passe au premier plan
    if (open) { open.postMessage({ hop: "open", url }); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
