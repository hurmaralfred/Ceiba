"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Bell, MapPin, Smile, ChevronRight, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, GoldDivider, C } from "@/components/ui/cosmic";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      setLoading(false);
    });
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
          Notificaciones
        </div>
        <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "16px", marginBottom: 20 }}>
          <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1,
            background: "rgba(212,175,55,0.38)" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, position: "relative" }}>
            <Bell size={15} style={{ color: "rgba(212,175,55,0.6)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 6 }}>
                Ceiba te notifica cuando un familiar se une, acepta una conexión o confirma una sugerencia.
              </p>
              <p style={{ fontSize: 11, color: "rgba(212,175,55,0.38)" }}>
                Para desactivarlas, ve a Ajustes del dispositivo → Ceiba → Notificaciones.
              </p>
            </div>
          </div>
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
