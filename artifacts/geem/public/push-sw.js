/* Geem Push Notification Service Worker */

// ── Offline cache warm-up (ERP only) ──────────────────────────────────────────
// On every SW activation, pre-fetch the pages the user needs most so they are
// immediately available offline — even on the very first visit.
// Uses the same 'geem-admin-api-v4' cache that Workbox's NetworkFirst rules
// read from, so there is no duplication — we are just pre-populating it.
if (/erp\.geem\.pk/.test(self.location.hostname) || self.location.hostname === 'localhost') {
  self.addEventListener('activate', event => {
    const WARM_URLS = [
      '/api/inventory?limit=200&page=1',
      '/api/customers?limit=200&page=1',
      '/api/products?limit=200',
      '/api/brands',
      '/api/categories',
      '/api/dashboard',
      '/api/settings',
    ];
    event.waitUntil(
      caches.open('geem-admin-api-v4').then(cache =>
        Promise.allSettled(
          WARM_URLS.map(url =>
            fetch(url, { credentials: 'include' })
              .then(r => { if (r.ok && r.status === 200) return cache.put(url, r); })
              .catch(() => { /* server not reachable during activation — skip */ })
          )
        )
      )
    );
  });
}
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Geem", body: event.data.text() }; }

  const title = data.title || "Geem";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "geem-notification",
    data: { url: data.url || "/" },
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
