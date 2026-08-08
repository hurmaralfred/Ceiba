"use client";
// ============================================================
// usePushNotifications
// Estrategia dual:
//   1. FCM (Firebase Cloud Messaging) — Android + Chrome desktop.
//      Guarda token en push_tokens.
//   2. VAPID Web Push — iOS Safari PWA (≥16.4) + Firefox + Edge.
//      Guarda suscripción en push_subscriptions.
//      FCM no está soportado en iOS Safari; VAPID sí lo está desde
//      iOS 16.4 cuando la app está instalada en la pantalla de inicio.
// ============================================================

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const FCM_VAPID_KEY  = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
const VAPID_PUB_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export function usePushNotifications() {
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // ── Try FCM first (Android + desktop Chrome) ─────────────────────
        let fcmRegistered = false;
        try {
          const { initializeApp, getApps } = await import("firebase/app");
          const { getMessaging, getToken, isSupported } = await import("firebase/messaging");

          const supported = await isSupported();
          if (supported && !cancelled) {
            const app = getApps().length === 0
              ? initializeApp(firebaseConfig)
              : getApps()[0];
            const messaging = getMessaging(app);

            const swReg = await navigator.serviceWorker.register(
              "/firebase-messaging-sw.js",
              { scope: "/" },
            );
            await navigator.serviceWorker.ready;
            swReg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });

            const permission = await Notification.requestPermission();
            if (permission === "granted" && !cancelled) {
              const token = await getToken(messaging, {
                vapidKey: FCM_VAPID_KEY,
                serviceWorkerRegistration: swReg,
              });
              if (token && !cancelled) {
                const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios"
                               : /Android/.test(navigator.userAgent)           ? "android"
                               : "web";
                await supabase.from("push_tokens").upsert(
                  { user_id: user.id, token, platform },
                  { onConflict: "token" },
                );
                fcmRegistered = true;
                console.log("✅ Push FCM registrado:", platform);
              }
            }
          }
        } catch {
          // FCM no disponible — continúa con VAPID
        }

        if (cancelled) return;

        // ── VAPID Web Push — iOS Safari PWA + Android + Firefox + Edge ──
        // Siempre se intenta independientemente de si FCM funcionó.
        // FCM no funciona en iOS Safari; VAPID es el único canal ahí.
        if (!VAPID_PUB_KEY) return;
        try {
          const reg = await navigator.serviceWorker.ready;
          if (!reg.pushManager) return;

          // Pedir permiso si aún no está concedido
          const currentPermission = Notification.permission;
          if (currentPermission === "denied") return;
          if (currentPermission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted" || cancelled) return;
          }

          const existing = await reg.pushManager.getSubscription();
          const sub = existing ?? await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUB_KEY,
          });

          if (cancelled) return;

          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          });
          console.log("✅ Push VAPID registrado");
        } catch {
          // VAPID no disponible en este contexto (non-PWA iOS, bloqueado, etc.)
        }
      } catch (err) {
        console.debug("Push registration skipped:", err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);
}
