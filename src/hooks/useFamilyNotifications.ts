"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

// Evita duplicados mostrando cada notificación de cumpleaños una sola vez al día
function getBirthdayNotifKey() {
  return `ceiba-bday-notif-${new Date().toDateString()}`;
}

function sendBrowserNotif(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icons/icon-192x192.png", badge: "/icons/icon-72x72.png" });
  }
}

export function useFamilyNotifications(
  userId: string | null,
  birthdays: Array<{ person_id: string; first_name: string; last_name: string; birth_date: string; days: number }>
) {
  const supabase = createClient();
  const birthdayNotifSent = useRef(false);

  // ── Pedir permiso de notificaciones ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Notificación de cumpleaños al cargar el home ────────────────────────────
  useEffect(() => {
    if (!birthdays.length || birthdayNotifSent.current) return;
    const key = getBirthdayNotifKey();
    if (typeof window !== "undefined" && localStorage.getItem(key)) return;

    const todayBdays = birthdays.filter(b => b.days === 0);
    if (!todayBdays.length) return;

    birthdayNotifSent.current = true;
    if (typeof window !== "undefined") localStorage.setItem(key, "1");

    todayBdays.forEach(b => {
      const name = `${b.first_name} ${b.last_name}`;
      toast(`🎂 Hoy cumple años ${name}. ¡Salúdale!`, { duration: 8000, icon: "🎂" });
      sendBrowserNotif(`🎂 Cumpleaños de ${name}`, "Entra a Ceiba para enviarle un saludo familiar.");
    });
  }, [birthdays]);

  // ── Suscripción Realtime — nuevas historias y recuerdos ────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("ceiba-family-events-notif")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "family_events" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new;
          if (!row || row.created_by === userId) return;

          const msOld = Date.now() - new Date(row.created_at).getTime();
          const isHistoria = msOld < 86_400_000;
          const eventTitle = row.title as string ?? "Nueva publicación";

          if (isHistoria) {
            toast(`✨ Nueva historia: "${eventTitle}"`, { duration: 6000, icon: "✨" });
            sendBrowserNotif("✨ Nueva historia familiar", eventTitle);
          } else {
            toast(`📚 Nuevo recuerdo: "${eventTitle}"`, { duration: 6000, icon: "📚" });
            sendBrowserNotif("📚 Nuevo recuerdo familiar", eventTitle);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);
}
