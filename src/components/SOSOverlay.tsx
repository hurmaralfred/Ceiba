"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  senderName: string;
  timestamp: number;
  onDismiss: () => void;
}

export function SOSOverlay({ senderName, timestamp, onDismiss }: Props) {
  const router = useRouter();

  useEffect(() => {
    // Vibration — long urgent pattern
    if ("vibrate" in navigator) {
      navigator.vibrate([400, 100, 400, 100, 400, 200, 400, 100, 400]);
    }

    // Alarm tone via Web Audio API
    try {
      const ctx = new AudioContext();
      const beep = (freq: number, startAt: number, dur: number) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + startAt + 0.02);
        gain.gain.setValueAtTime(0.28, ctx.currentTime + startAt + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + dur);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + dur);
      };
      // Three-beep alarm, twice
      [0, 0.35, 0.70, 1.5, 1.85, 2.20].forEach((t, i) => beep(i % 2 === 0 ? 880 : 1100, t, 0.28));
    } catch {
      // AudioContext may require a gesture on some browsers — silent fallback
    }

    // Flash the browser tab title
    const original = document.title;
    let toggle = false;
    const iv = setInterval(() => {
      document.title = toggle ? "🚨 SOS — EMERGENCIA" : "⚠️ CEIBA URGENTE";
      toggle = !toggle;
    }, 600);

    return () => {
      clearInterval(iv);
      document.title = original;
    };
  }, []);

  const age = Date.now() - timestamp;
  const minutesAgo = Math.max(0, Math.floor(age / 60000));
  const timeLabel = minutesAgo === 0 ? "Ahora mismo" : `Hace ${minutesAgo} min`;

  return (
    <>
      <style>{`
        @keyframes sos-flash  { 0%,100%{background:#b91c1c} 50%{background:#ef4444} }
        @keyframes sos-icon   { 0%,100%{transform:scale(1) rotate(-3deg)} 50%{transform:scale(1.18) rotate(3deg)} }
        @keyframes sos-ring   { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.8)} 70%{box-shadow:0 0 0 40px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes sos-text   { 0%,100%{opacity:1} 50%{opacity:0.65} }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "#b91c1c",
        animation: "sos-flash 0.8s ease-in-out infinite",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        overflowY: "auto",
      }}>

        {/* Ripple icon */}
        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "sos-ring 1.2s ease-out infinite, sos-icon 0.9s ease-in-out infinite",
          marginBottom: 32,
          fontSize: 64,
        }}>
          🚨
        </div>

        {/* SOS text */}
        <div style={{
          fontSize: 52, fontWeight: 900, color: "#fff",
          letterSpacing: 14, marginBottom: 12,
          animation: "sos-text 0.8s ease-in-out infinite",
          fontFamily: "system-ui, sans-serif",
        }}>
          S O S
        </div>

        <div style={{
          fontSize: 22, fontWeight: 800, color: "#fff",
          textAlign: "center", lineHeight: 1.3, marginBottom: 8,
          maxWidth: 280,
        }}>
          {senderName} activó<br />una alerta de emergencia
        </div>

        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.65)",
          marginBottom: 48,
        }}>
          {timeLabel}
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => { onDismiss(); router.push("/home"); }}
          style={{
            background: "#fff", color: "#b91c1c",
            fontWeight: 900, fontSize: 18,
            padding: "20px 56px", borderRadius: 100,
            border: "none", cursor: "pointer",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            marginBottom: 20,
            width: "100%", maxWidth: 300,
          }}
        >
          Ver ahora →
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600, fontSize: 14,
            padding: "14px 32px", borderRadius: 100,
            border: "1.5px solid rgba(255,255,255,0.3)",
            cursor: "pointer",
            width: "100%", maxWidth: 300,
          }}
        >
          Entendido — estoy bien
        </button>
      </div>
    </>
  );
}
