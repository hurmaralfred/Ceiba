"use client";
import { useEffect, useState, useRef } from "react";

const STORAGE_KEY = "ceiba:rotate_hint_dismissed";

export default function RotateHintWeb() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden, reveal after check
  const frameRef = useRef<number | null>(null);
  const rotRef = useRef(0);
  const dirRef = useRef(1);
  const iconRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") return; // already dismissed forever
    setDismissed(false);

    const check = () => {
      setPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Wobble animation via rAF — no React re-renders per frame
  useEffect(() => {
    if (dismissed || !portrait) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    const tick = () => {
      rotRef.current += dirRef.current * 0.9;
      if (rotRef.current > 22) dirRef.current = -1;
      if (rotRef.current < -22) dirRef.current = 1;
      if (iconRef.current) {
        iconRef.current.style.transform = `rotate(${rotRef.current}deg)`;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [dismissed, portrait]);

  if (dismissed || !portrait) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div style={{
      position: "absolute", bottom: 70, left: 0, right: 0,
      display: "flex", justifyContent: "center",
      zIndex: 999, pointerEvents: "none",
    }}>
      <button
        onClick={dismiss}
        style={{
          pointerEvents: "auto",
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(8,6,18,0.93)",
          border: "1px solid rgba(212,175,55,0.40)",
          borderRadius: 999, padding: "13px 18px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          cursor: "pointer", fontFamily: "inherit", maxWidth: 310,
        }}
      >
        {/* Phone icon */}
        <div ref={iconRef} style={{ flexShrink: 0, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{
            width: 16, height: 22, borderRadius: 3,
            border: "1.5px solid #d4af37",
            background: "rgba(212,175,55,0.10)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            <div style={{ width: 10, height: 13, borderRadius: 1, background: "rgba(212,175,55,0.28)" }} />
            <div style={{ width: 6, height: 1.5, borderRadius: 1, background: "#d4af37" }} />
          </div>
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            color: "#d4af37", fontSize: 12, fontWeight: 700, lineHeight: 1,
          }}>↻</span>
        </div>

        {/* Text */}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#d4af37", letterSpacing: "0.02em" }}>
            Gira tu teléfono
          </div>
          <div style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginTop: 2 }}>
            Horizontal para ver la galaxia completa
          </div>
        </div>

        {/* Close */}
        <span style={{ color: "rgba(212,175,55,0.45)", fontSize: 12, paddingLeft: 4, flexShrink: 0 }}>✕</span>
      </button>
    </div>
  );
}
