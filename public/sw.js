// Ceiba Service Worker
const CACHE_NAME = 'ceiba-v3';
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

  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const isSOS  = data.type === 'sos';
  const isChat = data.type === 'chat';

  // 1. Forward payload to every open client so the app can show an in-app toast.
  //    We never suppress the system notification because iOS requires showNotification
  //    to be called on every push event or it invalidates the subscription.
  const forwardPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'ceiba-push', payload: data });
      });
    });

  // 2. System notification — different tags so SOS never replaces chat.
  const tag      = isSOS ? 'ceiba-sos' : isChat ? `ceiba-chat-${data.roomId || 'group'}` : 'ceiba-announce';
  const vibrate  = isSOS ? [300, 100, 300, 100, 300] : [200, 100, 200];

  const notifOptions = {
    body:             data.body,
    icon:             data.icon || '/icons/icon-192.png',
    badge:            '/icons/icon-192.png',
    data:             { url: data.url || '/home' },
    vibrate,
    tag,
    renotify:         true,
    requireInteraction: isSOS,   // SOS stays visible until the user taps it
    silent:           false,
  };

  // Set/increment app icon badge
  const badgePromise = self.navigator?.setAppBadge
    ? self.navigator.setAppBadge(data.badge ?? 1).catch(() => {})
    : Promise.resolve();

  const notifPromise = self.registration.showNotification(data.title, notifOptions);

  event.waitUntil(Promise.all([forwardPromise, notifPromise, badgePromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/home';

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
