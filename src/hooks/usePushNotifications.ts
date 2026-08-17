"use client";
// Web Push via VAPID — cubre iOS PWA (≥16.4), Android Chrome, Firefox, Edge, desktop.

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const VAPID_PUB_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_KEY_STORAGE = "ceiba-vapid-pub-key";
// Timestamp of last successful subscribe POST — avoids hammering the server
const LAST_SYNC_STORAGE = "ceiba-push-synced-at";
const SYNC_INTERVAL_MS  = 12 * 60 * 60 * 1000; // re-sync at most every 12h

export function usePushNotifications() {
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (!VAPID_PUB_KEY) return;
        if (Notification.permission !== "granted") return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Wait for the SW to be active before calling pushManager
        if (reg.installing || reg.waiting) {
          await new Promise<void>((resolve) => {
            const sw = reg.installing ?? reg.waiting!;
            sw.addEventListener("statechange", function onState() {
              if (sw.state === "activated" || sw.state === "redundant") {
                sw.removeEventListener("statechange", onState);
                resolve();
              }
            });
          });
        }
        await reg.update();

        if (cancelled) return;

        let sub = await reg.pushManager.getSubscription();

        // Force re-subscribe if the VAPID key rotated
        const storedKey = localStorage.getItem(VAPID_KEY_STORAGE);
        if (sub && storedKey !== VAPID_PUB_KEY) {
          await sub.unsubscribe();
          sub = null;
        }

        if (!sub) {
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
            });
          } catch {
            return; // permission denied or unsupported
          }
        }

        if (cancelled || !sub) return;

        // Avoid re-POSTing to the server if we already synced recently
        // (the SW's pushsubscriptionchange handles mid-session rotations)
        const lastSync = Number(localStorage.getItem(LAST_SYNC_STORAGE) ?? 0);
        const needsSync = Date.now() - lastSync > SYNC_INTERVAL_MS;

        if (!needsSync) return;

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });

        if (res.ok) {
          localStorage.setItem(VAPID_KEY_STORAGE, VAPID_PUB_KEY);
          localStorage.setItem(LAST_SYNC_STORAGE, String(Date.now()));
        }
      } catch (err) {
        console.debug("Push registration skipped:", err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}
