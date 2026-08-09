"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Share, MoreVertical, Plus, CheckCircle } from "lucide-react";

export default function InstalarPage() {
  const [tab, setTab] = useState<"ios" | "android">("ios");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const ua = navigator.userAgent.toLowerCase();
    if (!/iphone|ipad|ipod/.test(ua)) setTab("android");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#030208", color: "#fff", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top,20px) + 14px) 20px 16px", textAlign: "center",
        borderBottom: "0.5px solid rgba(212,175,55,0.14)",
        background: "rgba(3,2,8,0.97)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={22} style={{ color: "#d4af37" }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: "#d4af37" }}>Ceiba</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          Instala la app en tu celular
        </p>
      </div>

      <div style={{ flex: 1, padding: "24px 20px 40px", maxWidth: 480, margin: "0 auto", width: "100%" }}>

        {installed ? (
          /* Ya instalada */
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <CheckCircle size={56} style={{ color: "#64c878", marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>¡Ya tienes Ceiba instalada!</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>
              Estás usando la app desde tu pantalla de inicio.
            </p>
            <Link href="/home">
              <button style={{
                background: "#c9a820", border: "none", borderRadius: 14, padding: "13px 32px",
                borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                boxShadow: "0 6px 0 #4a3c00, 0 10px 20px rgba(0,0,0,0.6)",
                color: "#030208", fontWeight: 800, fontSize: 15, cursor: "pointer",
              }}>
                Ir al inicio
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Tab selector */}
            <div style={{
              display: "flex", background: "#0c0a18", borderRadius: 14, padding: 4,
              border: "0.5px solid rgba(212,175,55,0.14)", marginBottom: 28,
            }}>
              {(["ios", "android"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 11, border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: tab === t ? "#1a1428" : "transparent",
                  color: tab === t ? "#d4af37" : "rgba(255,255,255,0.3)",
                  boxShadow: tab === t ? "0 2px 8px rgba(0,0,0,0.6)" : "none",
                  transition: "all 0.2s",
                }}>
                  {t === "ios" ? "iPhone / iPad" : "Android"}
                </button>
              ))}
            </div>

            {tab === "ios" ? <IOSSteps /> : <AndroidSteps />}

            {/* Compartir link */}
            <div style={{
              marginTop: 28, padding: "14px 16px", borderRadius: 16,
              background: "#0c0a18", border: "0.5px solid rgba(212,175,55,0.14)",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                ¿Quieres que un familiar instale Ceiba?
              </p>
              <p style={{ fontSize: 13, color: "#d4af37", fontWeight: 700, marginBottom: 10 }}>
                ceibapp.com/instalar
              </p>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: "Instala Ceiba", url: "https://ceibapp.com/instalar" });
                  } else {
                    navigator.clipboard.writeText("https://ceibapp.com/instalar");
                  }
                }}
                style={{
                  background: "#c9a820", border: "none", borderRadius: 10, padding: "9px 20px",
                  borderTop: "1.5px solid #f5e060", borderBottom: "2.5px solid #6a5600",
                  boxShadow: "0 5px 0 #4a3c00, 0 8px 16px rgba(0,0,0,0.6)",
                  color: "#030208", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Compartir por WhatsApp u otro
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "rgba(212,175,55,0.12)", border: "1.5px solid rgba(212,175,55,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, color: "#d4af37",
      }}>{n}</div>
      <div style={{ flex: 1, paddingTop: 6, fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

function IOSSteps() {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "rgba(212,175,55,0.5)", marginBottom: 20 }}>
        En Safari — iPhone o iPad
      </p>

      <Step n={1}>
        Abre <strong style={{ color: "#fff" }}>ceibapp.com</strong> en <strong style={{ color: "#fff" }}>Safari</strong>.
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", display: "block", marginTop: 2 }}>
          No funciona desde Chrome ni Firefox en iOS.
        </span>
      </Step>

      <Step n={2}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          Toca el botón
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: "#1a3a6a", borderRadius: 8, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, color: "#4a9eff" }}>
            <Share size={14} /> Compartir
          </span>
          en la barra inferior de Safari.
        </div>
      </Step>

      <Step n={3}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          Desplázate hacia abajo y toca
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: "#1a1a2a", borderRadius: 8, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Plus size={13} /> Agregar a pantalla de inicio
          </span>
        </div>
      </Step>

      <Step n={4}>
        Toca <strong style={{ color: "#fff" }}>Agregar</strong> en la esquina superior derecha. ¡Listo!
      </Step>

      <div style={{
        background: "rgba(212,175,55,0.06)", borderRadius: 14, padding: "12px 14px",
        border: "0.5px solid rgba(212,175,55,0.15)", marginTop: 4,
      }}>
        <p style={{ fontSize: 12, color: "rgba(212,175,55,0.6)", margin: 0, lineHeight: 1.6 }}>
          💡 La app se abrirá sin la barra de navegación del navegador, como una app nativa.
        </p>
      </div>
    </div>
  );
}

function AndroidSteps() {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "rgba(212,175,55,0.5)", marginBottom: 20 }}>
        En Chrome — Android
      </p>

      <Step n={1}>
        Abre <strong style={{ color: "#fff" }}>ceibapp.com</strong> en <strong style={{ color: "#fff" }}>Chrome</strong>.
      </Step>

      <Step n={2}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          Toca el menú
          <span style={{ display: "inline-flex", alignItems: "center",
            background: "#1a1a2a", borderRadius: 8, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
            <MoreVertical size={13} /> ⋮
          </span>
          arriba a la derecha.
        </div>
      </Step>

      <Step n={3}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          Toca
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: "#1a1a2a", borderRadius: 8, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Plus size={13} /> Agregar a pantalla de inicio
          </span>
        </div>
      </Step>

      <Step n={4}>
        Toca <strong style={{ color: "#fff" }}>Instalar</strong> en el diálogo que aparece. ¡Listo!
      </Step>

      <div style={{
        background: "rgba(100,200,120,0.06)", borderRadius: 14, padding: "12px 14px",
        border: "0.5px solid rgba(100,200,120,0.15)", marginTop: 4,
      }}>
        <p style={{ fontSize: 12, color: "rgba(100,200,120,0.6)", margin: 0, lineHeight: 1.6 }}>
          💡 En muchos Android Chrome muestra un banner automático de instalación al pie de la pantalla.
        </p>
      </div>
    </div>
  );
}
