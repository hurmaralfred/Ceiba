// ============================================================
// Firebase Messaging Service Worker — Ceiba
// Maneja notificaciones push en background (app no en foco).
// ============================================================

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// La config se recibe cuando el cliente llama a
//   navigator.serviceWorker.register('/firebase-messaging-sw.js')
// y luego postMessage({type:'FIREBASE_CONFIG', config:{...}})
// O bien se puede hardcodear aquí (los valores son públicos).
let messaging = null;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const { title, body } = payload.notification ?? {};
        if (!title) return;

        self.registration.showNotification(title, {
          body:    body ?? "",
          icon:    "/icons/icon-192.png",
          badge:   "/icons/badge-72.png",
          vibrate: [200, 100, 200],
          data:    payload.data ?? {},
          actions: [{ action: "open", title: "Ver árbol" }],
        });
      });
    }
  }
});

// Fallback: si se inicializa con self.__firebase_config (compat clásico)
if (typeof self.__firebase_config !== "undefined" && firebase.apps.length === 0) {
  firebase.initializeApp(self.__firebase_config);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    if (!title) return;
    self.registration.showNotification(title, {
      body:    body ?? "",
      icon:    "/icons/icon-192.png",
      badge:   "/icons/badge-72.png",
      vibrate: [200, 100, 200],
      data:    payload.data ?? {},
    });
  });
}

// Clic en notificación → abrir/enfocar la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "https://ceibapp.com/tree";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const existing = cs.find(c => c.url.startsWith("https://ceibapp.com"));
      return existing ? existing.focus() : clients.openWindow(url);
    }),
  );
});
