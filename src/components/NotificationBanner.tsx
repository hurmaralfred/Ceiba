"use client";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

const VAPID_PUB_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function NotificationBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    // Solo mostrar si es PWA instalada o desktop — en browser tab normal es menos útil
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone || window.innerWidth >= 768) {
      // Slight delay so it doesn't flash on every page load
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
    // En móvil sin instalar, mostrar igual — el banner explica que deben instalar
    const t = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setShow(false); return; }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();

      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setDone(true);
      setTimeout(() => setShow(false), 2000);
    } catch (e) {
      console.debug("Notification enable failed:", e);
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 999,
      background: "#0e0b1f",
      border: "1px solid rgba(212,175,55,0.35)",
      borderRadius: 16,
      padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
      animation: "slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: "linear-gradient(135deg,#c9a820,#6a5600)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={17} style={{ color: "#030208" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {done ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: "#d4af37", margin: 0 }}>
            ✓ Notificaciones activadas
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>
              Activar notificaciones
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}>
              Recibe mensajes aunque no estés en la app
            </p>
          </>
        )}
      </div>

      {!done && (
        <button
          onClick={enable}
          disabled={loading}
          style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            color: "#030208", background: "linear-gradient(135deg,#f0c040,#c8902a)",
            border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1,
          }}>
          {loading ? "…" : "Activar"}
        </button>
      )}

      <button
        onClick={() => setShow(false)}
        style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <X size={15} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
    </div>
  );
}
