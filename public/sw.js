// PASAKJA service worker: makes the app installable, shows an offline page when a
// page can't load, and shows push notifications. It never caches ride or account data.
const OFFLINE_CACHE = 'pasakja-offline-v1';
const OFFLINE_FILES = ['/offline.html', '/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== OFFLINE_CACHE).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Only page loads are handled: if the network fails, show the offline page.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});

// Payload sent by api/web_push.php: { title, body, url, tag }.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'PASAKJA';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }));
});

// Tapping a notification opens PASAKJA (reusing an open window) at the right screen.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target).catch(() => undefined);
        return undefined;
      }
    }
    return self.clients.openWindow(target);
  })());
});
