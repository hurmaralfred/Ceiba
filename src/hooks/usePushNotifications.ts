"use client";
// Web Push via VAPID — cubre iOS PWA (≥16.4), Android Chrome, Firefox, Edge, desktop.
// FCM no es necesario para una PWA: el protocolo Web Push que usa VAPID
// ya es el mismo que Chrome usa internamente, sin necesidad de Firebase.

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const VAPID_PUB_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export function usePushNotifications() {
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (!VAPID_PUB_KEY) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Usar explícitamente nuestro sw.js — no navigator.serviceWorker.ready
        // (que podría devolver el firebase SW si fue registrado antes)
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await reg.update(); // Asegura que cargue la versión más reciente

        if (cancelled) return;

        // Pedir permiso solo si no está ya definido
        if (Notification.permission === "denied") return;
        if (Notification.permission !== "granted") {
          const result = await Notification.requestPermission();
          if (result !== "granted" || cancelled) return;
        }

        // Desuscribir y limpiar cualquier suscripción anterior a un SW diferente
        const existing = await reg.pushManager.getSubscription();
        let sub = existing;

        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
          });
        }

        if (cancelled || !sub) return;

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });

        if (res.ok) console.log("✅ Push VAPID registrado");
      } catch (err) {
        console.debug("Push registration skipped:", err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);
}

// Convierte la clave pública VAPID de base64url a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}
