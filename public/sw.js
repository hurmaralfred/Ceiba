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
  // Always call showNotification — iOS invalidates the subscription if we don't.
  const show = (title, options) =>
    self.registration.showNotification(title, options);

  const handle = async () => {
    let data = {};
    try {
      if (event.data) data = event.data.json();
    } catch {
      // Malformed payload — still show a fallback notification.
      await show('Ceiba', {
        body: 'Tienes un mensaje nuevo',
        icon: '/icons/icon-192.png',
        tag: 'ceiba-fallback',
        data: { url: '/home' },
      });
      return;
    }

    const isSOS  = data.type === 'sos';
    const isChat = data.type === 'chat';

    // Forward to open clients for in-app toast (best-effort, never blocks notification)
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((client) => client.postMessage({ type: 'ceiba-push', payload: data }));
    } catch { /* ignore — open clients are optional */ }

    const tag     = isSOS ? 'ceiba-sos' : isChat ? `ceiba-chat-${data.roomId || 'group'}` : 'ceiba-announce';
    const vibrate = isSOS ? [300, 100, 300, 100, 300] : [200, 100, 200];

    await show(data.title || 'Ceiba', {
      body:               data.body || '',
      icon:               data.icon || '/icons/icon-192.png',
      data:               { url: data.url || '/home' },
      vibrate,
      tag,
      renotify:           true,
      requireInteraction: isSOS,
      silent:             false,
    });

    // App icon badge count
    if (self.navigator?.setAppBadge) {
      await self.navigator.setAppBadge(data.badge ?? 1).catch(() => {});
    }
  };

  event.waitUntil(handle());
});

// ── Tap on notification ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/home';
  if (self.navigator?.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window at the target URL first
        for (const client of clientList) {
          if (client.url.endsWith(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Focus any existing window and navigate it
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(url);
            return;
          }
        }
        // No window open — open a new one
        return self.clients.openWindow(url);
      })
  );
});

// ── Auto-renew push subscription ─────────────────────────────────────────────
// iOS (and other browsers) rotate push subscriptions periodically.
// Without this handler, the old endpoint gets a 410 → deleted from DB →
// user stops receiving pushes until they manually open the app.
self.addEventListener('pushsubscriptionchange', (event) => {
  const resubscribe = async () => {
    try {
      // Reuse the same VAPID options that created the original subscription
      const options = event.oldSubscription
        ? event.oldSubscription.options
        : event.newSubscription?.options;

      if (!options) return;

      const newSub = await self.registration.pushManager.subscribe(options);

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub.toJSON()),
      });
    } catch (err) {
      console.error('[SW] pushsubscriptionchange resubscribe failed:', err);
    }
  };

  event.waitUntil(resubscribe());
});
