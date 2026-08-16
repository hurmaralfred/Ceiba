"use client";
// Web Push via VAPID — cubre iOS PWA (≥16.4), Android Chrome, Firefox, Edge, desktop.
// FCM no es necesario para una PWA: el protocolo Web Push que usa VAPID
// ya es el mismo que Chrome usa internamente, sin necesidad de Firebase.

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const VAPID_PUB_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
// Tracks which VAPID key the current subscription was created with.
// When the key rotates, we unsubscribe and resubscribe automatically.
const VAPID_KEY_STORAGE = "ceiba-vapid-pub-key";

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

        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await reg.update();

        if (cancelled) return;

        if (Notification.permission !== "granted") return;

        let existing = await reg.pushManager.getSubscription();

        // If the VAPID key changed since the subscription was created, the old
        // subscription will be rejected by the push service. Detect key rotation
        // via localStorage and force a fresh subscription.
        const storedKey = localStorage.getItem(VAPID_KEY_STORAGE);
        if (existing && storedKey !== VAPID_PUB_KEY) {
          await existing.unsubscribe();
          existing = null;
        }

        let sub = existing;

        if (!sub) {
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
            });
          } catch {
            return;
          }
        }

        if (cancelled || !sub) return;

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });

        if (res.ok) {
          localStorage.setItem(VAPID_KEY_STORAGE, VAPID_PUB_KEY);
          console.log("✅ Push VAPID registrado");
        }
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
