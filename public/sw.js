// Service worker pour les notifications push (voir Jalon "notifications
// push"). Contrairement aux notifications navigateur (lib/notifications.js),
// celles-ci continuent de fonctionner même quand l'application/l'onglet est
// complètement fermé, car c'est le navigateur lui-même (via son propre
// service en arrière-plan) qui reçoit l'événement "push" et réveille ce
// fichier pour afficher la notification.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch {
    donnees = { titre: "Révision", corps: event.data ? event.data.text() : "" };
  }

  const titre = donnees.titre || "Révision";
  const options = {
    body: donnees.corps || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: donnees.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

// Au clic sur la notification : ramène au premier plan un onglet déjà
// ouvert sur l'application si possible, sinon en ouvre un nouveau — plutôt
// que d'ouvrir systématiquement un nouvel onglet.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((listeClients) => {
      for (const client of listeClients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    })
  );
});
