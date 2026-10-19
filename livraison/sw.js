// HOP! : service worker minimal, sans cache (le site se met à jour normalement).
// Il sert uniquement aux notifications : « En service » qui reste affichée, et alertes de course.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Toucher une notification : revenir sur la page HOP! déjà ouverte (Waze reste en arrière-plan)
self.addEventListener("notificationclick", e => {
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  if (e.notification.tag !== "hop-duty") e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const page = url.split("?")[0].split("#")[0];
    const open = list.find(c => c.url.split("?")[0].split("#")[0] === page) || list[0];
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
