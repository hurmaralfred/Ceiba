// Ceiba Service Worker
const CACHE_NAME = 'ceiba-v2';
const STATIC_ASSETS = ['/', '/tree', '/map'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept: Supabase, external origins, or API routes
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful HTML/static responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback: serve from cache if available, otherwise let it fail naturally
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Return a minimal offline response instead of undefined (which causes "Failed to fetch")
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const notifPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { url: data.url || '/chat' },
    vibrate: [200, 100, 200],
    tag: 'ceiba-chat',
    renotify: true,
  });

  // Set app icon badge (iOS 17+ / Android Chrome)
  const badgePromise = self.navigator?.setAppBadge
    ? self.navigator.setAppBadge(data.badge ?? 1).catch(() => {})
    : Promise.resolve();

  event.waitUntil(Promise.all([notifPromise, badgePromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/chat';

  // Clear badge when user taps the notification
  if (self.navigator?.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
