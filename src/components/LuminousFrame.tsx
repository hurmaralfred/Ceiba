"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Accent color (RGB) per route prefix
const ROUTE_COLORS: Array<[string, string]> = [
  ["/capsulas",   "150,90,255"],
  ["/chat",       "110,130,255"],
  ["/mapa",       "50,210,250"],
  ["/invitar",    "80,210,160"],
  ["/hoy",        "212,175,55"],
  ["/events",     "220,140,50"],
  ["/profile",    "180,110,255"],
  ["/persona",    "212,175,55"],
  ["/tree",       "212,175,55"],
  ["/home",       "212,175,55"],
  ["/onboarding", "150,90,255"],
  ["/auth",       "150,90,255"],
];

function resolveColor(pathname: string | null): string {
  if (!pathname) return "212,175,55";
  for (const [prefix, color] of ROUTE_COLORS) {
    if (pathname.startsWith(prefix)) return color;
  }
  return "212,175,55";
}

export default function LuminousFrame() {
  const pathname = usePathname();
  const [color, setColor] = useState("212,175,55");
  const [prevColor, setPrevColor] = useState("212,175,55");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const next = resolveColor(pathname);
    if (next === color) return;
    setFading(true);
    const t = setTimeout(() => {
      setPrevColor(color);
      setColor(next);
      setFading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const rgb = color;
  const alpha = fading ? 0 : 1;

  return (
    <>
      <style>{`
        @keyframes lf-pulse {
          0%,100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
        @keyframes lf-corner-glow {
          0%,100% { opacity: 0.70; transform: scale(1);    }
          50%      { opacity: 1;    transform: scale(1.18); }
        }
        @keyframes lf-edge-slide {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0;  }
        }
        @keyframes lf-edge-slide-v {
          0%   { background-position: 0 -200%; }
          100% { background-position: 0 200%;  }
        }
        .lf-wrap {
          position: fixed; inset: 0; z-index: 9998;
          pointer-events: none; overflow: hidden;
        }
        /* ── top edge ──────────────────────────────── */
        .lf-top {
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          animation: lf-pulse 3.8s ease-in-out infinite;
          background-size: 200% 100%;
          animation: lf-edge-slide 5s linear infinite, lf-pulse 3.8s ease-in-out infinite;
        }
        /* ── bottom edge ───────────────────────────── */
        .lf-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
          animation: lf-edge-slide 5s linear infinite reverse, lf-pulse 3.8s ease-in-out infinite;
          background-size: 200% 100%;
        }
        /* ── left edge ─────────────────────────────── */
        .lf-left {
          position: absolute; top: 0; bottom: 0; left: 0; width: 1.5px;
          animation: lf-edge-slide-v 6s linear infinite, lf-pulse 3.8s ease-in-out infinite;
          background-size: 100% 200%;
        }
        /* ── right edge ────────────────────────────── */
        .lf-right {
          position: absolute; top: 0; bottom: 0; right: 0; width: 1.5px;
          animation: lf-edge-slide-v 6s linear infinite reverse, lf-pulse 3.8s ease-in-out infinite;
          background-size: 100% 200%;
        }
        /* ── corner glows ──────────────────────────── */
        .lf-corner {
          position: absolute; width: 120px; height: 120px;
          border-radius: 50%; pointer-events: none;
          animation: lf-corner-glow 3.8s ease-in-out infinite;
        }
        .lf-corner-tl { top: -40px;   left: -40px;  }
        .lf-corner-tr { top: -40px;   right: -40px; animation-delay: 0.95s; }
        .lf-corner-bl { bottom: -40px; left: -40px;  animation-delay: 1.9s;  }
        .lf-corner-br { bottom: -40px; right: -40px; animation-delay: 2.85s; }

        /* ── inner glow bleeds ─────────────────────── */
        .lf-glow-top {
          position: absolute; top: 0; left: 0; right: 0; height: 90px;
          animation: lf-pulse 4.2s ease-in-out infinite 0.4s;
        }
        .lf-glow-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 90px;
          animation: lf-pulse 4.2s ease-in-out infinite 1.3s;
        }
      `}</style>

      <div
        className="lf-wrap"
        style={{ transition: "opacity 280ms ease", opacity: alpha }}
      >
        {/* ── corner glows ───────────────────────── */}
        <div className="lf-corner lf-corner-tl"
          style={{ background: `radial-gradient(circle, rgba(${rgb},0.45) 0%, transparent 70%)` }} />
        <div className="lf-corner lf-corner-tr"
          style={{ background: `radial-gradient(circle, rgba(${rgb},0.35) 0%, transparent 70%)` }} />
        <div className="lf-corner lf-corner-bl"
          style={{ background: `radial-gradient(circle, rgba(${rgb},0.35) 0%, transparent 70%)` }} />
        <div className="lf-corner lf-corner-br"
          style={{ background: `radial-gradient(circle, rgba(${rgb},0.45) 0%, transparent 70%)` }} />

        {/* ── edge lines ──────────────────────────── */}
        <div className="lf-top"
          style={{ background: `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.9) 25%, rgba(${rgb},1) 50%, rgba(${rgb},0.9) 75%, transparent 100%)`,
            boxShadow: `0 0 8px 1px rgba(${rgb},0.6)` }} />
        <div className="lf-bottom"
          style={{ background: `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.9) 25%, rgba(${rgb},1) 50%, rgba(${rgb},0.9) 75%, transparent 100%)`,
            boxShadow: `0 0 8px 1px rgba(${rgb},0.6)` }} />
        <div className="lf-left"
          style={{ background: `linear-gradient(180deg, transparent 0%, rgba(${rgb},0.8) 30%, rgba(${rgb},0.8) 70%, transparent 100%)`,
            boxShadow: `0 0 6px 1px rgba(${rgb},0.5)` }} />
        <div className="lf-right"
          style={{ background: `linear-gradient(180deg, transparent 0%, rgba(${rgb},0.8) 30%, rgba(${rgb},0.8) 70%, transparent 100%)`,
            boxShadow: `0 0 6px 1px rgba(${rgb},0.5)` }} />

        {/* ── inner ambient bleeds ─────────────────── */}
        <div className="lf-glow-top"
          style={{ background: `linear-gradient(180deg, rgba(${rgb},0.10) 0%, transparent 100%)` }} />
        <div className="lf-glow-bottom"
          style={{ background: `linear-gradient(0deg, rgba(${rgb},0.10) 0%, transparent 100%)` }} />
      </div>
    </>
  );
}
