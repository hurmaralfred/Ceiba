"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Share, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let cachedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedPrompt = e as BeforeInstallPromptEvent;
  });
}

const DISMISS_KEY = "ceiba_install_dismissed";
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed as PWA or running inside Capacitor native shell
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (typeof (window as any).Capacitor !== "undefined") return;

    // Dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86400000) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (cachedPrompt) setPrompt(cachedPrompt);

    const handler = (e: Event) => {
      e.preventDefault();
      cachedPrompt = e as BeforeInstallPromptEvent;
      setPrompt(cachedPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show after 3s — also recheck Capacitor in case bridge wasn't ready at mount
    const t = setTimeout(() => {
      if (typeof (window as any).Capacitor !== "undefined") return;
      setShow(true);
    }, 3000);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") { setShow(false); cachedPrompt = null; }
    } else {
      // Browser didn't fire beforeinstallprompt (already dismissed, policy, etc.)
      // Fall back to manual instructions page.
      window.location.href = "/instalar";
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 300,
      borderRadius: 20,
      background: "#0c0a18",
      borderTop: "1.5px solid rgba(212,175,55,0.4)",
      borderLeft: "1px solid rgba(212,175,55,0.18)",
      borderBottom: "3px solid #040300",
      borderRight: "1px solid rgba(0,0,0,0.6)",
      boxShadow: "0 8px 0 #040300, 0 16px 32px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.12)",
      padding: "16px 16px 18px",
      animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(120%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Dismiss */}
      <button onClick={dismiss} style={{
        position: "absolute", top: 12, right: 12, background: "none", border: "none",
        cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 4,
      }}>
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: "rgba(212,175,55,0.1)", border: "1.5px solid rgba(212,175,55,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Smartphone size={20} style={{ color: "#d4af37" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>
            Instala Ceiba en tu celular
          </p>
          <p style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", margin: 0 }}>
            Acceso rápido desde tu pantalla de inicio
          </p>
        </div>
      </div>

      {isIOS ? (
        /* iOS: instrucciones visuales */
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {["1. Toca", "2. «Agregar a inicio»", "3. «Agregar»"].map((step, i) => (
              <div key={i} style={{
                flex: 1, textAlign: "center", fontSize: 10, fontWeight: 600,
                color: "rgba(255,255,255,0.55)", lineHeight: 1.3,
              }}>
                {i === 0
                  ? <><Share size={14} style={{ display: "block", margin: "0 auto 3px", color: "#d4af37" }} />{step}</>
                  : step}
              </div>
            ))}
          </div>
          <Link href="/instalar" onClick={dismiss} style={{
            display: "block", textAlign: "center", fontSize: 11,
            color: "rgba(212,175,55,0.45)", textDecoration: "underline", marginTop: 4,
          }}>
            Ver instrucciones detalladas →
          </Link>
        </div>
      ) : (
        /* Android: botón nativo */
        <button onClick={install} style={{
          width: "100%", padding: "13px 0", borderRadius: 13, border: "none",
          cursor: "pointer", marginBottom: 8,
          background: "#c9a820",
          borderTop: "2px solid #f5e060",
          borderBottom: "3.5px solid #6a5600",
          boxShadow: "0 7px 0 #4a3c00, 0 12px 22px rgba(0,0,0,0.7), 0 0 20px rgba(212,175,55,0.2)",
          color: "#030208", fontSize: 14, fontWeight: 800,
        }}>
          Instalar app
        </button>
      )}

      <button onClick={dismiss} style={{
        width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
        background: "transparent", cursor: "pointer",
        color: "rgba(255,255,255,0.25)", fontSize: 12,
      }}>
        Ahora no
      </button>
    </div>
  );
}
