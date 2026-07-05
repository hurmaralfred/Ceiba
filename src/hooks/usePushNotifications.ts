"use client";
// ============================================================
// usePushNotifications
// 1. Registra el Service Worker de Firebase Messaging.
// 2. Pide permiso de notificaciones al usuario.
// 3. Obtiene el FCM token y lo guarda en push_tokens.
//
// Uso: llama este hook desde /src/app/tree/page.tsx u otro
// layout autenticado, una vez al montar.
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

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;

export function usePushNotifications() {
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        // Requiere HTTPS o localhost
        if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

        // Solo si el usuario está autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Importar Firebase dinámicamente (tree-shaking)
        const { initializeApp, getApps } = await import("firebase/app");
        const { getMessaging, getToken, isSupported } = await import("firebase/messaging");

        const supported = await isSupported();
        if (!supported || cancelled) return;

        // Inicializar Firebase (singleton)
        const app = getApps().length === 0
          ? initializeApp(firebaseConfig)
          : getApps()[0];

        const messaging = getMessaging(app);

        // Registrar Service Worker y pasarle la config
        const swReg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" },
        );
        await navigator.serviceWorker.ready;
        swReg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });

        // Pedir permiso (muestra diálogo nativo del browser)
        const permission = await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;

        // Obtener FCM token
        const token = await getToken(messaging, {
          vapidKey:                    VAPID_KEY,
          serviceWorkerRegistration:   swReg,
        });

        if (!token || cancelled) return;

        // Guardar en Supabase (upsert — unique en token evita duplicados)
        const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios"
                       : /Android/.test(navigator.userAgent)           ? "android"
                       : "web";

        await supabase.from("push_tokens").upsert(
          { user_id: user.id, token, platform },
          { onConflict: "token" },
        );

        console.log("✅ Push registrado:", platform);
      } catch (err) {
        // Silencioso — el usuario puede haber bloqueado las notificaciones
        console.debug("Push registration skipped:", err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);
}
