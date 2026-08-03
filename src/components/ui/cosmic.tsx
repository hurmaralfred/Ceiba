"use client";
/**
 * Sistema de diseño cósmico (negro galaxia + oro).
 * Importar desde aquí para mantener coherencia visual en toda la app.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TreePine, BookOpen, Camera, User, ArrowLeft, type LucideIcon } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
export const C = {
  bg:           "#030208",
  bgCard:       "#0c0a18",
  bgCardAlt:    "#0a0818",
  gold:         "#d4af37",
  goldDim:      "rgba(212,175,55,0.28)",
  goldFaint:    "rgba(212,175,55,0.12)",
  white:        "#ffffff",
  textMuted:    "rgba(255,255,255,0.55)",
  textDim:      "rgba(212,175,55,0.5)",
  shadowDeep:   "rgba(0,0,0,0.85)",
} as const;

// ── Helpers de estilo 3D ──────────────────────────────────────────────────────
export function s3dCard(
  bg: string, ar: string, sh: string, glow = 0.09
): React.CSSProperties {
  return {
    borderRadius: 18, background: bg, position: "relative", overflow: "hidden",
    borderTop:    `1.5px solid rgba(${ar},0.4)`,
    borderLeft:   `1px solid rgba(${ar},0.18)`,
    borderBottom: `3px solid ${sh}`,
    borderRight:  `1px solid rgba(0,0,0,0.6)`,
    boxShadow:    `0 7px 0 ${sh}, 0 12px 22px rgba(0,0,0,0.85), 0 0 20px rgba(${ar},${glow})`,
  };
}

export function s3dGoldCard(): React.CSSProperties {
  return s3dCard("#0c0a18", "212,175,55", "#040300", 0.1);
}

export function s3dChip(): React.CSSProperties {
  return {
    background: "#0c0a1a",
    borderTop:    "1px solid rgba(212,175,55,0.28)",
    borderLeft:   "1px solid rgba(212,175,55,0.12)",
    borderBottom: "2px solid #000",
    borderRight:  "1px solid rgba(0,0,0,0.5)",
    boxShadow:    "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.6)",
    borderRadius: 100, padding: "5px 12px",
    display: "flex", alignItems: "center", gap: 5,
  };
}

export function s3dInput(): React.CSSProperties {
  return {
    width: "100%", background: "#0c0a1a", border: "none",
    borderTop:    "1px solid rgba(212,175,55,0.28)",
    borderLeft:   "1px solid rgba(212,175,55,0.12)",
    borderBottom: "2px solid #000",
    borderRight:  "1px solid rgba(0,0,0,0.5)",
    boxShadow:    "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.5)",
    borderRadius: 10, padding: "10px 12px",
    color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as const,
  };
}

export function s3dGoldBtn(disabled = false): React.CSSProperties {
  return {
    width: "100%", padding: "14px 0", borderRadius: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#6a5600" : "#c9a820",
    borderTop:    "2px solid #f5e060",
    borderLeft:   "1.5px solid rgba(255,240,100,0.5)",
    borderBottom: "4px solid #6a5600",
    borderRight:  "1.5px solid rgba(0,0,0,0.4)",
    boxShadow:    "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7), 0 0 20px rgba(212,175,55,0.25)",
    color: "#030208", fontSize: 15, fontWeight: 800,
    letterSpacing: "0.04em", position: "relative" as const,
    overflow: "hidden" as const, border: "none",
  };
}

export function s3dRowItem(): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "13px 0",
    borderBottom: "0.5px solid rgba(212,175,55,0.1)",
  };
}

// Línea de brillo superior en tarjetas
export function CardShine({ ar }: { ar: string }) {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: "18%", right: "18%",
        height: 1, background: `rgba(${ar},0.42)` }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 18, pointerEvents: "none",
        background: `radial-gradient(circle at 85% 15%, rgba(${ar},0.22) 0%, transparent 50%)` }} />
    </>
  );
}

// ── Sección label ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em",
      textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ── Divisor dorado ────────────────────────────────────────────────────────────
export function GoldDivider({ mx = 20 }: { mx?: number }) {
  return (
    <div style={{ height: 0.5, margin: `12px ${mx}px`,
      background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.28),transparent)" }} />
  );
}

// ── Spinner de carga ──────────────────────────────────────────────────────────
export function CosmicSpinner() {
  return (
    <div style={{ minHeight: "100vh", background: "#030208",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <TreePine size={36} style={{ color: "#d4af37", opacity: 0.6 }} />
    </div>
  );
}

// ── Header de página interior (con botón back) ────────────────────────────────
export function CosmicHeader({
  title, backHref = "/home", right,
}: {
  title: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "52px 20px 14px",
      borderBottom: "0.5px solid rgba(212,175,55,0.14)",
    }}>
      <Link href={backHref}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
          borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
          borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
        </div>
      </Link>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>{title}</div>
      <div style={{ width: 36, display: "flex", justifyContent: "center" }}>{right ?? null}</div>
    </div>
  );
}

// ── Navegación inferior cósmica ───────────────────────────────────────────────
const NAV_ITEMS: Array<{ href: string; Icon: LucideIcon; label: string; center?: boolean }> = [
  { href: "/home",    Icon: Home,     label: "Inicio"   },
  { href: "/tree",    Icon: TreePine, label: "Árbol"    },
  { href: "/events",  Icon: BookOpen, label: "Historias", center: true },
  { href: "/photos",  Icon: Camera,   label: "Álbumes"  },
  { href: "/profile", Icon: User,     label: "Perfil"   },
];

export function CosmicNav() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(3,2,8,0.97)",
      borderTop: "0.5px solid rgba(212,175,55,0.18)",
      padding: "10px 14px 20px",
      display: "flex", alignItems: "flex-end", justifyContent: "space-around",
      backdropFilter: "blur(12px)",
    }}>
      {NAV_ITEMS.map(({ href, Icon, label, center }) => {
        if (center) return (
          <Link key={href} href={href}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%", background: "#c9a820", flexShrink: 0,
              borderTop: "2px solid #f5e060", borderLeft: "1.5px solid rgba(255,240,100,0.5)",
              borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
              boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.8), 0 0 24px rgba(212,175,55,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: -20, position: "relative",
            }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 22%,rgba(255,255,255,0.32) 0%,transparent 55%)" }} />
              <Icon size={22} style={{ color: "#030208", position: "relative" }} />
            </div>
          </Link>
        );
        const active = pathname === href || pathname?.startsWith(href + "/");
        const color = active ? "#d4af37" : "rgba(212,175,55,0.28)";
        return (
          <Link key={href} href={href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
            <Icon size={22} style={{ color }} />
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
