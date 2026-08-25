"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Bell, BellOff, BellRing, MapPin, Smile, ChevronRight, User, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, GoldDivider, C } from "@/components/ui/cosmic";

const VAPID_PUB_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

type NotifStatus = "checking" | "unsupported" | "denied" | "granted-active" | "granted-inactive" | "default";

function NotificationPanel() {
  const [status, setStatus]     = useState<NotifStatus>("checking");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const isStandalone = typeof window !== "undefined"
    && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported"); return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setStatus("denied"); return; }
    if (perm === "default") { setStatus("default"); return; }

    // granted — check if subscription exists
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "granted-active" : "granted-inactive");
    } catch {
      setStatus("granted-inactive");
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const enable = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!VAPID_PUB_KEY) { setMessage("Error de configuración del servidor."); return; }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Permiso denegado. Ve a Ajustes → Ceiba → Notificaciones para activarlas.");
        setStatus("denied");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        setStatus("granted-active");
        setMessage("✓ Notificaciones activadas. Recibirás mensajes aunque el teléfono esté bloqueado.");
      } else {
        setMessage("Error al guardar la suscripción. Intenta de nuevo.");
      }
    } catch (err: any) {
      setMessage(err?.message?.includes("gesture")
        ? "iOS requiere que pulses el botón para activar notificaciones."
        : "No se pudieron activar. Revisa los permisos en Ajustes del dispositivo.");
    } finally {
      setLoading(false);
    }
  };

  const reactivate = async () => {
    setLoading(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUB_KEY),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        setStatus("granted-active");
        setMessage("✓ Suscripción renovada. Ya recibirás notificaciones.");
      } else {
        setMessage("Error al renovar la suscripción.");
      }
    } catch {
      setMessage("No se pudo renovar. Revisa los permisos del dispositivo.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") return (
    <div style={{ padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Verificando…</div>
  );

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(212,175,55,0.38)" }} />

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px" }}>
        {status === "granted-active"
          ? <BellRing size={18} style={{ color: "#4ade80", flexShrink: 0 }} />
          : status === "denied"
          ? <BellOff size={18} style={{ color: "rgba(220,60,80,0.8)", flexShrink: 0 }} />
          : <Bell size={18} style={{ color: "rgba(212,175,55,0.6)", flexShrink: 0 }} />}

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
            {status === "granted-active"   ? "Notificaciones activas"
           : status === "granted-inactive" ? "Suscripción perdida"
           : status === "denied"           ? "Notificaciones bloqueadas"
           : status === "unsupported"      ? "No compatible"
           : "Notificaciones desactivadas"}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            {status === "granted-active"
              ? "Recibirás mensajes aunque el teléfono esté bloqueado."
              : status === "granted-inactive"
              ? "El permiso existe pero la suscripción se perdió. Reactiva para recibir notificaciones."
              : status === "denied"
              ? "Ve a Ajustes del dispositivo → Ceiba → Notificaciones y actívalas."
              : status === "unsupported"
              ? "Tu navegador no soporta notificaciones push. Instala la app para recibirlas."
              : "Activa las notificaciones para recibir mensajes cuando el teléfono esté bloqueado."}
          </p>
        </div>
      </div>

      {/* iOS not-installed warning */}
      {!isStandalone && status !== "granted-active" && status !== "denied" && status !== "unsupported" && (
        <div style={{ margin: "0 16px 12px", padding: "10px 12px", borderRadius: 10,
          background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.2)",
          display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Smartphone size={13} style={{ color: "rgba(212,175,55,0.7)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: "rgba(212,175,55,0.7)", lineHeight: 1.5 }}>
            En iOS, instala Ceiba primero: Safari → <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>. Luego abre la app instalada y activa notificaciones aquí.
          </p>
        </div>
      )}

      {/* Action button */}
      {status === "default" && (
        <div style={{ padding: "0 16px 16px" }}>
          <button onClick={enable} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700,
            color: "#030208", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            background: "linear-gradient(135deg,#f0c040,#c8902a)",
            border: "none", letterSpacing: "0.03em",
          }}>
            {loading ? "Activando…" : "🔔 Activar notificaciones"}
          </button>
        </div>
      )}

      {status === "granted-inactive" && (
        <div style={{ padding: "0 16px 16px" }}>
          <button onClick={reactivate} disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700,
            color: "#030208", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            background: "linear-gradient(135deg,#f0c040,#c8902a)",
            border: "none",
          }}>
            {loading ? "Renovando…" : "🔄 Reactivar suscripción"}
          </button>
        </div>
      )}

      {status === "granted-active" && (
        <div style={{ padding: "0 16px 16px" }}>
          <button onClick={reactivate} disabled={loading} style={{
            width: "100%", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            color: "rgba(255,255,255,0.5)", cursor: loading ? "wait" : "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {loading ? "…" : "Renovar suscripción"}
          </button>
        </div>
      )}

      {message && (
        <p style={{ margin: "0 16px 14px", fontSize: 11, lineHeight: 1.5,
          color: message.startsWith("✓") ? "rgba(74,222,128,0.85)" : "rgba(220,60,80,0.8)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return <CosmicSpinner />;

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "13px 0", borderBottom: "0.5px solid rgba(212,175,55,0.1)",
    textDecoration: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <CosmicHeader title="Ajustes" backHref="/home" />

      <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>

        {/* Cuenta */}
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 10 }}>
          Cuenta
        </div>
        <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "0 16px", marginBottom: 20 }}>
          <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1,
            background: "rgba(212,175,55,0.38)" }} />
          <Link href="/profile" style={rowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <User size={15} style={{ color: "rgba(212,175,55,0.6)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Editar perfil</span>
            </div>
            <ChevronRight size={15} style={{ color: "rgba(212,175,55,0.35)" }} />
          </Link>
          <Link href="/avatar" style={{ ...rowStyle }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Smile size={15} style={{ color: "rgba(212,175,55,0.6)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Mi avatar</span>
            </div>
            <ChevronRight size={15} style={{ color: "rgba(212,175,55,0.35)" }} />
          </Link>
          <Link href="/map" style={{ ...rowStyle, borderBottom: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={15} style={{ color: "rgba(212,175,55,0.6)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Mapa familiar</span>
            </div>
            <ChevronRight size={15} style={{ color: "rgba(212,175,55,0.35)" }} />
          </Link>
        </div>

        {/* Notificaciones */}
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 10 }}>
          Notificaciones push
        </div>
        <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), marginBottom: 20 }}>
          <NotificationPanel />
        </div>

        <GoldDivider mx={0} />

        {/* Cerrar sesión */}
        <button onClick={logout} style={{
          display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
          cursor: "pointer", color: "rgba(220,60,80,0.7)", fontSize: 13, fontWeight: 600,
          padding: "16px 0",
        }}>
          <LogOut size={15} /> Cerrar sesión
        </button>

        <p style={{ textAlign: "center", fontSize: 10, color: "rgba(212,175,55,0.2)", paddingTop: 8 }}>
          Ceiba · Tu familia, conectada · v1.0
        </p>
      </div>

      <CosmicNav />
    </div>
  );
}
