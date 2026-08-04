"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, TreePine, BookOpen, Camera, User, Bell, Menu,
  Users, GitBranch, Image as ImageIcon, Gift, Send,
  Trophy, ChevronRight, Cake, Sparkles, X, MessageCircle, Map,
} from "lucide-react";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import type { Profile, FamilyMember } from "@/lib/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FeedBirthday {
  person_id: string; first_name: string; last_name: string; birth_date: string;
}
interface FeedPhoto { id: string; url: string; caption: string | null; created_at: string; }
interface FeedEvent { id: string; title: string; event_type: string; event_date: string; description: string | null; created_at: string; }
type BirthdayWithDays = FeedBirthday & { days: number };
interface FamilyRosterMember {
  person_id: string; user_id: string;
  first_name: string; last_name: string; photo_path: string | null;
}

interface KinshipSuggestion {
  id: string; score: number;
  evidence: Array<{ type: string; weight: number; detail: string }>;
  person_a: { id: string; first_name: string; first_surname: string } | null;
  person_b: { id: string; first_name: string; first_surname: string } | null;
  space_a: { id: string; name: string } | null;
  space_b: { id: string; name: string } | null;
}

// ── Helpers de estilo 3D ──────────────────────────────────────────────────────
function s3dCard(bg: string, ar: string, sh: string, glow = 0.1): React.CSSProperties {
  return {
    borderRadius: 18, background: bg, position: "relative", overflow: "hidden",
    borderTop: `1.5px solid rgba(${ar},0.5)`, borderLeft: `1px solid rgba(${ar},0.22)`,
    borderBottom: `4px solid ${sh}`, borderRight: `1px solid rgba(0,0,0,0.65)`,
    boxShadow: `0 8px 0 ${sh}, 0 16px 32px rgba(0,0,0,0.92), 0 0 32px rgba(${ar},${glow})`,
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  };
}
function s3dIcon(bg: string, ar: string, sh: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 11, background: bg, flexShrink: 0,
    borderTop: `1.5px solid rgba(${ar},0.55)`, borderLeft: `1px solid rgba(${ar},0.22)`,
    borderBottom: `2.5px solid ${sh}`, borderRight: `1px solid rgba(0,0,0,0.55)`,
    boxShadow: `0 4px 0 ${sh}, 0 7px 14px rgba(0,0,0,0.75), 0 0 12px rgba(${ar},0.18)`,
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  };
}
function s3dChip(): React.CSSProperties {
  return {
    background: "#0c0a1a",
    borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
    borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.5)",
    boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.6)",
    borderRadius: 100, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5,
  };
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function daysUntil(birth_date: string): number {
  const today = new Date();
  const bd = new Date(birth_date);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 365 ? 0 : diff;
}

// ── Fondo galáctico completo ──────────────────────────────────────────────────
// ── Family constellation: 3 orbital rings, each slowly rotating ─────────────
// dx/dy are offsets from SVG center (150,150). Colors signal family line.
// Gold=#F2B43C (focal line), Blue=#7BAFD4 (maternal/paternal), Copper=#c87830 (siblings), Lavender=#B8A0D8 (extended)
const ORBIT_INNER = [
  { dx:  40, dy: -55, r: 6.5, color: '#F2B43C', glow: 'rgba(242,180,60,0.75)'  },
  { dx:  60, dy:  32, r: 6.0, color: '#7BAFD4', glow: 'rgba(123,175,212,0.70)' },
  { dx: -52, dy:  45, r: 6.5, color: '#F2B43C', glow: 'rgba(242,180,60,0.75)'  },
  { dx: -65, dy: -22, r: 5.5, color: '#c87830', glow: 'rgba(200,120,48,0.70)'  },
] as const

const ORBIT_MID = [
  { dx: 105, dy:   0, r: 4.5, color: '#F2B43C', glow: 'rgba(242,180,60,0.60)'  },
  { dx:  32, dy:  99, r: 4.0, color: '#c87830', glow: 'rgba(200,120,48,0.60)'  },
  { dx: -95, dy:  42, r: 4.5, color: '#7BAFD4', glow: 'rgba(123,175,212,0.60)' },
  { dx: -58, dy: -88, r: 4.0, color: '#F2B43C', glow: 'rgba(242,180,60,0.60)'  },
  { dx:  80, dy: -68, r: 3.8, color: '#B8A0D8', glow: 'rgba(184,160,216,0.55)' },
] as const

const ORBIT_OUTER = [
  { dx:   0, dy:-132, r: 2.8, color: '#d4af37', glow: 'rgba(212,175,55,0.50)'  },
  { dx:  98, dy: -86, r: 2.5, color: '#B8A0D8', glow: 'rgba(184,160,216,0.50)' },
  { dx: 132, dy:   0, r: 3.0, color: '#7BAFD4', glow: 'rgba(123,175,212,0.50)' },
  { dx:  88, dy: 100, r: 2.5, color: '#d4af37', glow: 'rgba(212,175,55,0.50)'  },
  { dx: -75, dy: 108, r: 2.8, color: '#B8A0D8', glow: 'rgba(184,160,216,0.50)' },
  { dx:-132, dy:   0, r: 2.2, color: '#d4af37', glow: 'rgba(212,175,55,0.50)'  },
] as const

function GalaxyHero({ children, avatarInitial, avatarUrl, firstName, lastName, visibleCount, historyCount, birthdaysThisMonth }: {
  children: React.ReactNode;
  avatarInitial: string;
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  visibleCount: number;
  historyCount: number;
  birthdaysThisMonth: number;
}) {
  const statsLine = birthdaysThisMonth > 0
    ? `${visibleCount} personas  ·  🎂 ${birthdaysThisMonth} cumpleaños próximos`
    : historyCount > 0
      ? `${visibleCount} personas  ·  ✨ ${historyCount} ${historyCount === 1 ? "recuerdo" : "recuerdos"}`
      : `${visibleCount} personas en tu constelación`

  return (
    <div style={{ position: "relative", overflow: "hidden", paddingBottom: 36, textAlign: "center",
      background: "radial-gradient(ellipse 120% 80% at 50% 0%, #12082a 0%, #060318 45%, #030208 100%)" }}>

      <style>{`
        @keyframes twinkle-a { 0%,100%{opacity:.9;transform:scale(1)} 50%{opacity:.25;transform:scale(.7)} }
        @keyframes twinkle-b { 0%,100%{opacity:.6;transform:scale(1)} 40%{opacity:.1;transform:scale(.6)} }
        @keyframes twinkle-c { 0%,100%{opacity:.75;transform:scale(1)} 60%{opacity:.3;transform:scale(.8)} }
        @keyframes core-pulse { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.85;transform:scale(1.08)} }
        @keyframes slow-drift { 0%{transform:translateY(0) translateX(0) scale(1)} 33%{transform:translateY(-14px) translateX(8px) scale(1.15)} 66%{transform:translateY(-6px) translateX(-5px) scale(0.9)} 100%{transform:translateY(0) translateX(0) scale(1)} }
        @keyframes shoot { 0%{opacity:0;transform:translateX(0) translateY(0)} 5%{opacity:1} 100%{opacity:0;transform:translateX(-160px) translateY(60px)} }
        @keyframes name-glow { 0%,100%{text-shadow:0 0 20px rgba(212,175,55,0.0)} 50%{text-shadow:0 0 28px rgba(212,175,55,0.45)} }
        @keyframes bday-glow { 0%,100%{box-shadow:0 8px 0 #040300,0 16px 32px rgba(0,0,0,0.92),0 0 28px rgba(212,175,55,0.22)} 50%{box-shadow:0 8px 0 #040300,0 16px 32px rgba(0,0,0,0.92),0 0 55px rgba(212,175,55,0.5),0 0 90px rgba(212,175,55,0.15)} }
        @keyframes section-glow { 0%,100%{opacity:.5} 50%{opacity:.85} }
        @keyframes orbit-ring-cw  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes orbit-ring-ccw { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes corona-pulse   { 0%,100%{opacity:0.35;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        a:active > div { transform: scale(0.97) translateY(1px) !important; }
        button:active { transform: scale(0.97) !important; }
      `}</style>

      {/* Deep nebula layers */}
      <div style={{ position:"absolute", top:-60, left:-60, width:280, height:280, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(circle,rgba(100,30,220,0.22) 0%,transparent 70%)", filter:"blur(30px)" }} />
      <div style={{ position:"absolute", top:-40, right:-50, width:240, height:240, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(circle,rgba(20,60,200,0.18) 0%,transparent 70%)", filter:"blur(24px)" }} />
      <div style={{ position:"absolute", top:80, left:"20%", width:320, height:180, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(ellipse,rgba(212,175,55,0.1) 0%,transparent 65%)", filter:"blur(20px)" }} />
      <div style={{ position:"absolute", bottom:-20, left:"10%", width:260, height:140, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(ellipse,rgba(80,20,160,0.14) 0%,transparent 70%)", filter:"blur(18px)" }} />

      {/* Star field */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} aria-hidden>
        {[
          [22,18,0.5],[58,32,0.4],[110,8,0.55],[178,22,0.42],[230,14,0.5],[280,28,0.38],[318,12,0.48],
          [8,65,0.45],[44,78,0.38],[92,54,0.5],[148,68,0.4],[196,44,0.45],[248,72,0.35],[302,58,0.48],
          [18,120,0.4],[62,108,0.38],[120,132,0.42],[168,98,0.5],[222,118,0.36],[274,104,0.44],[312,128,0.4],
          [30,170,0.45],[78,158,0.38],[136,182,0.42],[184,162,0.48],[238,176,0.35],[290,164,0.44],
        ].map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.65" fill="white" opacity={o} />)}
        <circle cx="40"  cy="24"  r="1.1" fill="white"   opacity="0.9"  style={{ animation:"twinkle-a 3.1s ease-in-out infinite" }} />
        <circle cx="288" cy="18"  r="1.0" fill="white"   opacity="0.8"  style={{ animation:"twinkle-b 2.7s ease-in-out infinite 0.4s" }} />
        <circle cx="72"  cy="140" r="0.9" fill="white"   opacity="0.75" style={{ animation:"twinkle-c 3.5s ease-in-out infinite 0.9s" }} />
        <circle cx="310" cy="178" r="1.0" fill="white"   opacity="0.75" style={{ animation:"twinkle-c 2.8s ease-in-out infinite 1.1s" }} />
        <circle cx="160" cy="12"  r="1.4" fill="#d4af37" opacity="0.95" style={{ animation:"twinkle-b 4.1s ease-in-out infinite" }} />
        <circle cx="228" cy="16"  r="1.2" fill="#f0d060" opacity="0.88" style={{ animation:"twinkle-a 3.4s ease-in-out infinite 1.5s" }} />
        <line x1="260" y1="40" x2="295" y2="28" stroke="white" strokeWidth="0.8" opacity="0"
          style={{ animation:"shoot 8s linear infinite 2s", transformOrigin:"260px 40px" }} />
        <line x1="80"  y1="18" x2="118" y2="6"  stroke="white" strokeWidth="0.7" opacity="0"
          style={{ animation:"shoot 8s linear infinite 5.5s", transformOrigin:"80px 18px" }} />
      </svg>

      {/* Slow-drift particles — imperceptible until ~10s */}
      {[
        { x: 42,  y: 165, d: 48 }, { x: 72,  y: 108, d: 55 },
        { x: 252, y: 132, d: 43 }, { x: 284, y: 172, d: 61 },
        { x: 158, y: 198, d: 50 }, { x: 108, y: 184, d: 57 },
        { x: 22,  y: 220, d: 44 }, { x: 296, y: 210, d: 53 },
      ].map(({ x, y, d }, i) => (
        <div key={i} style={{ position:"absolute", left:x, top:y, width:1.5, height:1.5, borderRadius:"50%",
          background:"rgba(212,175,55,0.45)", pointerEvents:"none",
          animation:`slow-drift ${d}s ease-in-out infinite ${i * 5.5}s` }} />
      ))}

      {/* Top bar */}
      {children}

      {/* Avatar + family constellation */}
      <div style={{ position:"relative", display:"inline-block", marginBottom:14, zIndex:5 }}>

        {/* Ambient core glow */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          width:240, height:240, borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(circle,rgba(130,60,230,0.16) 0%,rgba(212,175,55,0.07) 40%,transparent 70%)",
          filter:"blur(16px)", animation:"core-pulse 4.5s ease-in-out infinite" }} />

        {/* Family constellation — 3 orbital rings, each slowly rotating */}
        <svg width="300" height="300" viewBox="0 0 300 300"
          style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
            pointerEvents:"none", overflow:"visible" }} aria-hidden>
          <defs>
            <filter id="sglow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="cglow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="10"/>
            </filter>
          </defs>
          {/* Avatar corona — gravitational center, breathes outward */}
          <circle cx="150" cy="150" r="72" fill="rgba(212,175,55,0.11)" filter="url(#cglow)"/>
          <circle cx="150" cy="150" r="56" fill="none" stroke="rgba(242,180,60,0.24)" strokeWidth="0.7"
            style={{ animation:"corona-pulse 4s ease-in-out infinite" }}/>
          <circle cx="150" cy="150" r="66" fill="none" stroke="rgba(242,180,60,0.11)" strokeWidth="0.5"
            style={{ animation:"corona-pulse 4s ease-in-out infinite 1.5s" }}/>
          <circle cx="150" cy="150" r="78" fill="none" stroke="rgba(242,180,60,0.06)" strokeWidth="0.4"
            style={{ animation:"corona-pulse 4s ease-in-out infinite 3s" }}/>
          {/* Orbital paths — gravitational trajectories, barely visible */}
          <circle cx="150" cy="150" r="68"  fill="none" stroke="rgba(212,175,55,0.04)" strokeWidth="0.45"
            style={{ animation:"section-glow 9s ease-in-out infinite" }}/>
          <circle cx="150" cy="150" r="105" fill="none" stroke="rgba(212,175,55,0.03)" strokeWidth="0.35"
            style={{ animation:"section-glow 12s ease-in-out infinite 3s" }}/>
          <circle cx="150" cy="150" r="132" fill="none" stroke="rgba(212,175,55,0.02)" strokeWidth="0.3"
            style={{ animation:"section-glow 15s ease-in-out infinite 6s" }}/>
          {/* Inner orbit — 4 intimate planets, 65s CW */}
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-cw 65s linear infinite" }}>
            {ORBIT_INNER.map((n,i) => (
              <g key={i}>
                <circle cx={n.dx} cy={n.dy} r={n.r*4.5} fill={n.color} opacity="0.10" filter="url(#sglow)"/>
                <circle cx={n.dx} cy={n.dy} r={n.r*2}   fill={n.color} opacity="0.07"/>
                <circle cx={n.dx} cy={n.dy} r={n.r}      fill={n.color} opacity="0.94"
                  style={{ filter:`drop-shadow(0 0 ${Math.round(n.r*1.5)}px ${n.glow})` }}/>
                <circle cx={n.dx - n.r*0.35} cy={n.dy - n.r*0.38} r={n.r*0.28} fill="white" opacity="0.55"/>
              </g>
            ))}
          </g>
          {/* Mid orbit — 5 close family planets, 95s CCW */}
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-ccw 95s linear infinite" }}>
            {ORBIT_MID.map((n,i) => (
              <g key={i}>
                <circle cx={n.dx} cy={n.dy} r={n.r*4.5} fill={n.color} opacity="0.09" filter="url(#sglow)"/>
                <circle cx={n.dx} cy={n.dy} r={n.r*2}   fill={n.color} opacity="0.06"/>
                <circle cx={n.dx} cy={n.dy} r={n.r}      fill={n.color} opacity="0.90"
                  style={{ filter:`drop-shadow(0 0 ${Math.round(n.r*1.2)}px ${n.glow})` }}/>
                <circle cx={n.dx - n.r*0.32} cy={n.dy - n.r*0.35} r={n.r*0.25} fill="white" opacity="0.45"/>
              </g>
            ))}
          </g>
          {/* Outer orbit — 6 extended planets, 135s CW */}
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-cw 135s linear infinite" }}>
            {ORBIT_OUTER.map((n,i) => (
              <g key={i}>
                <circle cx={n.dx} cy={n.dy} r={n.r*5}   fill={n.color} opacity="0.08" filter="url(#sglow)"/>
                <circle cx={n.dx} cy={n.dy} r={n.r*2}   fill={n.color} opacity="0.05"/>
                <circle cx={n.dx} cy={n.dy} r={n.r}      fill={n.color} opacity="0.85"
                  style={{ filter:`drop-shadow(0 0 ${Math.round(n.r)}px ${n.glow})` }}/>
                <circle cx={n.dx - n.r*0.28} cy={n.dy - n.r*0.32} r={n.r*0.22} fill="white" opacity="0.38"/>
              </g>
            ))}
          </g>
        </svg>

        {/* Avatar */}
        <div style={{ width:104, height:104, borderRadius:"50%", background:"#0c0a18",
          display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:2,
          boxShadow:"inset 0 3px 28px rgba(120,60,220,0.3), inset 0 -3px 14px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(212,175,55,0.18)" }}>
          <div style={{ position:"absolute", inset:0, borderRadius:"50%",
            background:"radial-gradient(circle at 35% 25%,rgba(212,175,55,0.18) 0%,transparent 55%)" }} />
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={firstName}
              style={{ width:104, height:104, borderRadius:"50%", objectFit:"cover", position:"relative" }} />
          ) : (
            <span style={{ fontSize:40, color:"#d4af37", fontWeight:800, position:"relative",
              textShadow:"0 0 20px rgba(212,175,55,0.6)" }}>
              {avatarInitial}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:0.3, marginBottom:5,
        position:"relative", zIndex:5, animation:"name-glow 5s ease-in-out infinite" }}>
        {firstName || "Cargando..."}
      </div>

      {/* Universe label */}
      <div style={{ fontSize:10, color:"rgba(212,175,55,0.55)", fontStyle:"italic",
        marginBottom:10, position:"relative", zIndex:5, letterSpacing:"0.08em" }}>
        Tu universo familiar
      </div>

      {/* Narrative stats */}
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", position:"relative", zIndex:5,
        letterSpacing:"0.03em" }}>
        {statsLine}
      </div>
    </div>
  );
}

// ── Orbe nebulosa (legacy, kept for other uses) ───────────────────────────────
function NebulaOrb({ top, left, right, color, size = 220 }: {
  top?: number; left?: number; right?: number; color: string; size?: number;
}) {
  return (
    <div style={{
      position: "absolute", top, left, right,
      width: size, height: size, borderRadius: "50%", pointerEvents: "none",
      background: `radial-gradient(circle,${color} 0%,transparent 70%)`,
    }} />
  );
}

// ── Brillo superior de tarjeta ────────────────────────────────────────────────
function CardShine({ ar }: { ar: string }) {
  return (
    <>
      {/* Línea superior brillante */}
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%",
        height: 1, background: `rgba(${ar},0.6)` }} />
      {/* Gradiente de luz entrando por arriba */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 50,
        borderRadius: "18px 18px 0 0", pointerEvents: "none",
        background: `linear-gradient(to bottom, rgba(${ar},0.12) 0%, transparent 100%)` }} />
      {/* Reflejo esquina */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 18, pointerEvents: "none",
        background: `radial-gradient(circle at 88% 12%, rgba(${ar},0.2) 0%, transparent 45%)` }} />
    </>
  );
}

// ── Navegación cósmica ────────────────────────────────────────────────────────
function CosmicNav({ pathname, suggCount = 0 }: { pathname: string; suggCount?: number }) {
  const items = [
    { href: "/home",    Icon: Home,     label: "Inicio"   },
    { href: "/tree",    Icon: TreePine, label: "Árbol"    },
    { href: "/events",  Icon: BookOpen, label: "Historias", center: true },
    { href: "/photos",  Icon: Camera,   label: "Álbumes"  },
    { href: "/profile", Icon: User,     label: "Perfil"   },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(3,2,8,0.97)", borderTop: "0.5px solid rgba(212,175,55,0.18)",
      padding: "10px 14px 20px", display: "flex", alignItems: "flex-end",
      justifyContent: "space-around", backdropFilter: "blur(12px)",
    }}>
      {items.map(({ href, Icon, label, center }) => {
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
        const active = pathname === href;
        const color = active ? "#d4af37" : "rgba(212,175,55,0.28)";
        const showBadge = href === "/home" && suggCount > 0;
        return (
          <Link key={href} href={href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
            <div style={{ position: "relative" }}>
              <Icon size={22} style={{ color }} />
              {showBadge && (
                <div style={{
                  position: "absolute", top: -5, right: -7,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: "#d4af37", border: "1.5px solid #030208",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#030208", padding: "0 3px", lineHeight: 1,
                }}>
                  {suggCount > 9 ? "9+" : suggCount}
                </div>
              )}
            </div>
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HomePage() {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile,      setProfile]      = useState<Profile | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [members,      setMembers]      = useState<FamilyMember[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [birthdays,    setBirthdays]    = useState<FeedBirthday[]>([]);
  const [photos,       setPhotos]       = useState<FeedPhoto[]>([]);
  const [events,       setEvents]       = useState<FeedEvent[]>([]);
  const [suggestions,  setSuggestions]  = useState<KinshipSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [roster,       setRoster]       = useState<FamilyRosterMember[]>([]);
  const [myUserId,     setMyUserId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setMyUserId(user.id);

    // Redirigir si hay datos sin confirmar (persona agregada por otro)
    const statusRes = await fetch("/api/profile/data-status");
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status.needsConfirmation) { router.replace("/confirmar-datos"); return; }
    }

    const [graphRes, feedRes, sugRes, rosterRes] = await Promise.allSettled([
      supabase.rpc("get_my_family_graph", { p_depth: 4 }),
      fetch("/api/feed"),
      fetch("/api/suggestions"),
      fetch("/api/family/roster"),
    ]);

    if (graphRes.status === "fulfilled" && !graphRes.value.error) {
      const graph = graphRes.value.data as FamilyGraph | null;
      if (graph?.me) {
        const { profile: p, members: m, extendedMembers: em } = adaptGraph(graph, user.id);
        setProfile(p);
        setMembers(m);
        setVisibleCount(buildVisibleMembers(m, em).length);
      }
    }

    if (feedRes.status === "fulfilled") {
      try {
        const res = feedRes.value;
        if (res.ok) {
          const data = await res.json();
          setBirthdays((data.birthdays || []).slice(0, 10));
          setPhotos((data.photos   || []).slice(0, 10));
          setEvents((data.events   || []).slice(0, 10));
        }
      } catch {}
    }

    if (sugRes.status === "fulfilled") {
      try {
        const res = sugRes.value;
        if (res.ok) {
          const { suggestions: sug } = await res.json();
          setSuggestions((sug ?? []).slice(0, 3));
        }
      } catch {}
    }

    if (rosterRes.status === "fulfilled") {
      try {
        const res = rosterRes.value;
        if (res.ok) {
          const { members } = await res.json();
          setRoster(members ?? []);
        }
      } catch {}
    }
  }, [router, supabase]);

  const handleDismiss = useCallback(async (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Datos derivados ───────────────────────────────────────────────────────
  const rosterUserIds = roster.map(m => m.user_id);
  const onlineIds = useFamilyPresence(myUserId, rosterUserIds);
  const onlineFamily = roster.filter(m => onlineIds.has(m.user_id));

  const allBirthdays: BirthdayWithDays[] = birthdays.map(b => ({ ...b, days: daysUntil(b.birth_date) }));
  const todayBirthday    = allBirthdays.find(b => b.days === 0) ?? null;
  const upcomingBirthday = !todayBirthday
    ? allBirthdays.filter(b => b.days > 0).sort((a, b) => a.days - b.days)[0] ?? null
    : null;
  const spotlightBirthday = todayBirthday ?? upcomingBirthday;
  const firstName = profile?.first_name ?? "";
  const avatarInitial = firstName[0]?.toUpperCase() ?? "?";

  // Momento del día — aniversario primero, luego frases específicas con datos reales
  const contextMessage = (() => {
    const today  = new Date();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // 1. Aniversario exacto hoy
    const anniversary = events.find(e => {
      const ed = new Date(e.event_date);
      return ed.getMonth() === todayM && ed.getDate() === todayD && ed.getFullYear() < today.getFullYear();
    });
    if (anniversary) {
      const years = today.getFullYear() - new Date(anniversary.event_date).getFullYear();
      return `Hoy hace ${years} año${years !== 1 ? "s" : ""}: "${anniversary.title}".`;
    }

    // 2. Cumpleaños próximo dentro de 3 días (aún no cubierto por Caso C en el hero)
    const verySoon = allBirthdays.filter(b => b.days > 0 && b.days <= 3).sort((a, b) => a.days - b.days)[0];
    if (verySoon) {
      return verySoon.days === 1
        ? `Mañana es el cumpleaños de ${verySoon.first_name}. ¿Ya sabes qué le vas a decir?`
        : `En ${verySoon.days} días cumple años ${verySoon.first_name} ${verySoon.last_name}.`;
    }

    // 3. Evento reciente esta semana
    const freshEvent = events.find(e => (Date.now() - new Date(e.created_at).getTime()) < 7 * 86_400_000);
    if (freshEvent) {
      return `Esta semana se añadió una nueva historia: "${freshEvent.title}".`;
    }

    // 4. Fallbacks específicos con datos reales de la familia
    const n = visibleCount;
    const h = events.length;
    const p = photos.length;
    const dayIndex = Math.floor(Date.now() / 86_400_000);

    const pool: string[] = [
      n > 1 ? `Tu familia tiene ${n} personas. Cada una guarda una historia única.` : "Empieza construyendo tu árbol. La primera persona lo cambia todo.",
      h > 0 ? `${h} historia${h !== 1 ? "s" : ""} documentada${h !== 1 ? "s" : ""} en tu árbol. Cada una, un regalo para el futuro.` : "La primera historia que escribas será el inicio de algo que vivirá para siempre.",
      p > 0 ? `${p} foto${p !== 1 ? "s" : ""} en tu álbum. Los recuerdos visuales son los que más duran.` : "Una foto hoy se convierte en un tesoro en veinte años.",
      n > 5 ? `¿Cuándo fue la última vez que hablaste con alguien de tu árbol de ${n} personas?` : "Cada persona que añades es una raíz más en el árbol.",
      "Los momentos que no se documentan desaparecen. Los que sí, permanecen.",
      h > 0 ? `Tu familia ya ha escrito ${h} capítulo${h !== 1 ? "s" : ""} de su historia.` : "Escribe el primer capítulo de la historia de tu familia.",
    ].filter(Boolean);

    return pool[dayIndex % pool.length];
  })();

  // Stats — invitan a explorar, no describen el vacío
  const birthdaysThisMonth = allBirthdays.filter(b => b.days > 0 && b.days <= 30).length;
  const historyCount = events.length;
  const recentMemories = [
    ...photos.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 7 * 86_400_000),
    ...events.filter(e => (Date.now() - new Date(e.created_at).getTime()) < 7 * 86_400_000),
  ].length;

  // Tarjeta dinámica — elige el contenido más relevante del momento
  const dynamicCard: { type: "evento" | "foto" | "cumple" | "mensaje"; label: string; title: string; subtitle: string; href: string; imageUrl?: string } = (() => {
    // 1. Evento histórico publicado recientemente (≤7 días)
    const freshEvent = events.find(e => (Date.now() - new Date(e.created_at).getTime()) < 7 * 86_400_000);
    if (freshEvent) return {
      type: "evento", label: "Historia reciente",
      title: freshEvent.title,
      subtitle: freshEvent.description?.slice(0, 80) ?? "Un momento guardado en tu historia familiar.",
      href: "/events",
    };
    // 2. Foto reciente (≤7 días)
    const freshPhoto = photos.find(p => (Date.now() - new Date(p.created_at).getTime()) < 7 * 86_400_000);
    if (freshPhoto) return {
      type: "foto", label: "Recuerdo del día",
      title: freshPhoto.caption ?? "Un recuerdo familiar",
      subtitle: "Foto añadida recientemente a tu álbum.",
      href: "/photos",
      imageUrl: freshPhoto.url,
    };
    // 3. Cumpleaños próximo ≤14 días
    const soon = allBirthdays.filter(b => b.days > 0 && b.days <= 14).sort((a, b) => a.days - b.days)[0];
    if (soon) return {
      type: "cumple", label: `En ${soon.days} día${soon.days !== 1 ? "s" : ""}`,
      title: `Cumpleaños de ${soon.first_name}`,
      subtitle: `${soon.first_name} ${soon.last_name} cumple años pronto. ¿Ya le preparaste algo?`,
      href: `/persona/${soon.person_id}`,
    };
    // 4. Evento futuro próximo
    const nextEvent = events.filter(e => new Date(e.event_date) > new Date()).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
    if (nextEvent) return {
      type: "evento", label: "Próximamente",
      title: nextEvent.title,
      subtitle: nextEvent.description?.slice(0, 80) ?? "Un evento importante se acerca.",
      href: "/events",
    };
    // 5. Fallback — mensaje del contexto
    return {
      type: "mensaje", label: "Hoy",
      title: "Tu historia continúa",
      subtitle: contextMessage,
      href: "/events",
    };
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#030208", paddingBottom: 100, color: "#fff" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <GalaxyHero
        avatarInitial={avatarInitial}
        avatarUrl={profile?.avatar_url}
        firstName={profile?.first_name ?? ""}
        lastName={profile?.last_name ?? ""}
        visibleCount={visibleCount}
        historyCount={historyCount}
        birthdaysThisMonth={birthdaysThisMonth}
      >
        {/* Barra de navegación superior */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "50px 20px 20px", position: "relative", zIndex: 5 }}>
          <Link href="/settings">
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
              borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
              borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.6)",
              boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Menu size={18} style={{ color: "rgba(212,175,55,0.75)" }} />
            </div>
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <TreePine size={15} style={{ color: "#d4af37" }} />
              <span style={{ fontSize: 21, fontWeight: 700, color: "#d4af37", letterSpacing: 2.5 }}>CEIBA</span>
              <span style={{ fontSize: 12, color: "#f0d060" }}>✦</span>
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.24em",
              color: "rgba(212,175,55,0.45)", textTransform: "uppercase", marginTop: 2 }}>
              Nuestras raíces
            </div>
          </div>
          <Link href="/feed">
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0c0a1a",
              borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
              borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.6)",
              boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} style={{ color: "rgba(212,175,55,0.75)" }} />
            </div>
          </Link>
        </div>
      </GalaxyHero>

      {/* Stats integradas en hero — sin cajas */}

      {/* ── EN LÍNEA AHORA ──────────────────────────────────────────────── */}
      {onlineFamily.length > 0 && (
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid rgba(212,175,55,0.1)" }}>
          <style>{`@keyframes home-online-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}`}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
              animation: "home-online-pulse 2s infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(34,197,94,0.75)" }}>En línea ahora</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {onlineFamily.slice(0, 6).map(m => (
              <Link key={m.user_id} href="/chat" style={{ textDecoration: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1a1030",
                    border: "2px solid rgba(34,197,94,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: "#d4af37", overflow: "hidden" }}>
                    {m.photo_path
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : `${m.first_name[0] ?? ""}${(m.last_name || "")[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11,
                    borderRadius: "50%", background: "#22c55e", border: "2px solid #030208",
                    animation: "home-online-pulse 2s infinite" }} />
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600,
                  maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "center" }}>{m.first_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Divisor atmosférico — nebula + línea + constelación */}
      <div style={{ position: "relative", margin: "0 0 2px", height: 48, overflow: "hidden" }}>
        {/* Capa de luz nebulosa */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 280, height: 48, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.12) 0%, rgba(80,30,120,0.06) 40%, transparent 70%)",
          filter: "blur(8px)" }} />
        {/* Línea divisoria */}
        <div style={{ position: "absolute", top: "50%", left: "12%", right: "12%",
          height: 0.5, background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.28),transparent)",
          transform: "translateY(-50%)" }} />
        {/* Partículas decorativas — 5 estrellas pequeñas */}
        {[
          { l: "18%", t: "28%", s: 7, a: "twinkle-a", d: "0s",   op: 0.30 },
          { l: "35%", t: "62%", s: 6, a: "twinkle-c", d: "-1.2s", op: 0.22 },
          { l: "50%", t: "22%", s: 9, a: "twinkle-b", d: "-0.7s", op: 0.40 },
          { l: "67%", t: "68%", s: 6, a: "twinkle-a", d: "-2.1s", op: 0.20 },
          { l: "82%", t: "30%", s: 7, a: "twinkle-c", d: "-1.5s", op: 0.28 },
        ].map((p, i) => (
          <span key={i} style={{
            position: "absolute", left: p.l, top: p.t,
            fontSize: p.s, color: "#d4af37", opacity: p.op,
            animation: `${p.a} ${3.5 + i * 0.8}s ease-in-out ${p.d} infinite`,
            pointerEvents: "none",
          }}>✦</span>
        ))}
      </div>

      {/* ══ MOMENTO DEL DÍA ══════════════════════════════════════════════ */}
      <div style={{ padding: "14px 14px 0" }}>

        {/* — Caso A: Cumpleaños HOY — card dominante */}
        {todayBirthday && (
          <Link href={`/persona/${todayBirthday.person_id}`}>
            <div style={{
              borderRadius: 22, background: "linear-gradient(145deg,#1a0f00 0%,#0f0800 60%,#0a0500 100%)",
              position: "relative", overflow: "hidden", minHeight: 200,
              borderTop: "2px solid rgba(212,175,55,0.75)", borderLeft: "1px solid rgba(212,175,55,0.32)",
              borderBottom: "5px solid #040200", borderRight: "1px solid rgba(0,0,0,0.7)",
              animation: "bday-glow 3s ease-in-out infinite",
            }}>
              {/* Nebula de fondo */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse at 20% 60%, rgba(212,175,55,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(200,120,48,0.12) 0%, transparent 45%)" }} />
              {/* Línea superior */}
              <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                background: "rgba(212,175,55,0.7)" }} />
              {/* Etiqueta */}
              <div style={{ position: "absolute", top: 16, right: 16,
                background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.35)",
                borderRadius: 100, padding: "3px 10px",
                fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "#d4af37",
                textTransform: "uppercase" }}>Hoy</div>
              <div style={{ padding: "22px 20px 20px", position: "relative" }}>
                <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🎂</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.65)", marginBottom: 6 }}>
                  Cumpleaños de hoy
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 6 }}>
                  {todayBirthday.first_name} {todayBirthday.last_name}
                </div>
                <div style={{ fontSize: 13, color: "rgba(212,175,55,0.6)", marginBottom: 20 }}>
                  {new Date().getFullYear() - new Date(todayBirthday.birth_date).getFullYear()} años
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#d4af37", color: "#030208", borderRadius: 12,
                  padding: "10px 22px", fontSize: 13, fontWeight: 800,
                  boxShadow: "0 4px 0 #6a5600, 0 8px 20px rgba(212,175,55,0.4)" }}>
                  🎉 Felicitar ahora
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* — Caso B: Foto reciente (últimas 24h) — card dominante */}
        {!todayBirthday && photos.length > 0 && (() => {
          const recent = photos.find(p => (Date.now() - new Date(p.created_at).getTime()) < 86_400_000);
          if (!recent) return null;
          return (
            <Link href="/photos">
              <div style={{
                borderRadius: 22, background: "#0a060e", position: "relative", overflow: "hidden", minHeight: 200,
                borderTop: "2px solid rgba(160,100,40,0.6)", borderLeft: "1px solid rgba(160,100,40,0.25)",
                borderBottom: "5px solid #030104", borderRight: "1px solid rgba(0,0,0,0.7)",
                boxShadow: "0 8px 0 #030104, 0 16px 32px rgba(0,0,0,0.92), 0 0 32px rgba(160,100,40,0.12)",
              }}>
                {recent.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recent.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }} />
                )}
                <div style={{ position: "absolute", inset: 0,
                  background: "linear-gradient(to top, rgba(10,6,14,0.95) 0%, rgba(10,6,14,0.5) 50%, transparent 100%)" }} />
                <div style={{ position: "absolute", top: 16, right: 16,
                  background: "rgba(200,120,48,0.15)", border: "1px solid rgba(200,120,48,0.4)",
                  borderRadius: 100, padding: "3px 10px",
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "#c87830",
                  textTransform: "uppercase" }}>Nueva foto</div>
                <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "rgba(200,120,48,0.7)", marginBottom: 6 }}>📸 Foto nueva en el álbum</div>
                  {recent.caption && (
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 14, lineHeight: 1.3 }}>
                      {recent.caption}
                    </div>
                  )}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                    background: "rgba(200,120,48,0.15)", border: "1px solid rgba(200,120,48,0.4)",
                    color: "#c87830", borderRadius: 12, padding: "8px 18px", fontSize: 12, fontWeight: 700 }}>
                    Ver foto →
                  </div>
                </div>
              </div>
            </Link>
          );
        })()}

        {/* — Caso C: Próximo cumpleaños (≤ 7 días) — card dominante */}
        {!todayBirthday && !(photos.find(p => (Date.now() - new Date(p.created_at).getTime()) < 86_400_000)) && upcomingBirthday && upcomingBirthday.days <= 7 && (
          <Link href={`/persona/${upcomingBirthday.person_id}`}>
            <div style={{
              borderRadius: 22, background: "linear-gradient(145deg,#0e0a00 0%,#080600 100%)",
              position: "relative", overflow: "hidden", minHeight: 180,
              borderTop: "2px solid rgba(212,175,55,0.45)", borderLeft: "1px solid rgba(212,175,55,0.2)",
              borderBottom: "5px solid #030200", borderRight: "1px solid rgba(0,0,0,0.7)",
              boxShadow: "0 8px 0 #030200, 0 16px 32px rgba(0,0,0,0.92), 0 0 32px rgba(212,175,55,0.1)",
            }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse at 15% 50%, rgba(212,175,55,0.1) 0%, transparent 55%)" }} />
              <div style={{ position: "absolute", top: 16, right: 16,
                background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)",
                borderRadius: 100, padding: "3px 10px",
                fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(212,175,55,0.75)",
                textTransform: "uppercase" }}>
                En {upcomingBirthday.days} {upcomingBirthday.days === 1 ? "día" : "días"}
              </div>
              <div style={{ padding: "22px 20px 20px", position: "relative" }}>
                <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 10 }}>🎁</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.5)", marginBottom: 6 }}>
                  Próximo cumpleaños
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 14 }}>
                  {upcomingBirthday.first_name} {upcomingBirthday.last_name}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
                  color: "#d4af37", borderRadius: 12, padding: "8px 18px", fontSize: 12, fontWeight: 700 }}>
                  Preparar mensaje →
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* — Caso D: Momento del día — siempre específico, nunca genérico */}
        {!todayBirthday && !(photos.find(p => (Date.now() - new Date(p.created_at).getTime()) < 86_400_000)) && !(upcomingBirthday && upcomingBirthday.days <= 7) && (
          <Link href={events.length > 0 ? "/events" : "/tree"} style={{ textDecoration: "none" }}>
            <div style={{
              borderRadius: 22,
              background: "linear-gradient(145deg,#09080f 0%,#060510 80%,#08060e 100%)",
              position: "relative", overflow: "hidden", minHeight: 170,
              borderTop: "1.5px solid rgba(212,175,55,0.22)", borderLeft: "1px solid rgba(212,175,55,0.09)",
              borderBottom: "4px solid #020108", borderRight: "1px solid rgba(0,0,0,0.65)",
              boxShadow: "0 8px 0 #020108, 0 16px 32px rgba(0,0,0,0.92), 0 0 60px rgba(212,175,55,0.05)",
            }}>
              {/* Nebula de fondo — atmosférica */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse at 18% 55%, rgba(212,175,55,0.09) 0%, transparent 52%), radial-gradient(ellipse at 82% 30%, rgba(80,30,120,0.07) 0%, transparent 45%)" }} />
              {/* Constelación decorativa — tres estrellas con tamaño variado */}
              <div style={{ position: "absolute", top: 22, right: 22, display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ fontSize: 7, color: "rgba(212,175,55,0.25)", animation: "twinkle-b 5.1s ease-in-out infinite" }}>✦</span>
                <span style={{ fontSize: 11, color: "rgba(212,175,55,0.35)", animation: "twinkle-a 3.8s ease-in-out infinite" }}>✦</span>
                <span style={{ fontSize: 6, color: "rgba(212,175,55,0.18)", animation: "twinkle-c 6.3s ease-in-out infinite" }}>✦</span>
              </div>
              <div style={{ padding: "26px 22px 22px", position: "relative" }}>
                {/* Etiqueta de contexto */}
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.42)", marginBottom: 14 }}>
                  Momento del día
                </div>
                {/* Mensaje principal — grande, emocional */}
                <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.88)",
                  lineHeight: 1.45, marginBottom: 16, maxWidth: 280 }}>
                  {contextMessage}
                </div>
                {/* Call to action sutil */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, color: "rgba(212,175,55,0.45)", fontWeight: 600 }}>
                    {events.length > 0 ? "Ver historias" : "Empezar a escribir"}
                  </span>
                  <ChevronRight size={11} style={{ color: "rgba(212,175,55,0.35)" }} />
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* ══ ACCESOS RÁPIDOS ══════════════════════════════════════════════ */}
      <div style={{ padding: "18px 14px 0" }}>
        {/* Conectar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(212,175,55,0.38)", marginBottom: 10, paddingLeft: 2 }}>Conectar</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { href: "/tree",    Icon: TreePine,      label: "Árbol",   color: "#d4af37", border: "rgba(212,175,55,0.2)" },
              { href: "/chat",    Icon: MessageCircle, label: "Chat",    color: "#9898b8", border: "rgba(130,130,160,0.16)" },
              { href: "/invitar", Icon: Send,          label: "Invitar", color: "#d4af37", border: "rgba(212,175,55,0.18)" },
            ].map(({ href, Icon, label, color, border }) => (
              <Link key={href} href={href} style={{ textDecoration: "none", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color, opacity: 0.85 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                    {label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recordar */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(200,120,48,0.38)", marginBottom: 10, paddingLeft: 2 }}>Recordar</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { href: "/events", Icon: BookOpen, label: "Historia", color: "#c87830", border: "rgba(160,100,40,0.22)" },
              { href: "/photos", Icon: Camera,   label: "Álbum",   color: "#c87830", border: "rgba(160,100,40,0.22)" },
              { href: "/mapa",   Icon: Map,      label: "Mapa",    color: "#9898b8", border: "rgba(130,130,160,0.16)" },
            ].map(({ href, Icon, label, color, border }) => (
              <Link key={href} href={href} style={{ textDecoration: "none", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color, opacity: 0.85 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                    {label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── FUNCIONES ────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 14px", position: "relative" }}>
        {/* Glow atmosférico */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 300, height: 300, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, rgba(80,30,160,0.04) 40%, transparent 70%)",
          filter: "blur(24px)", animation: "section-glow 6s ease-in-out infinite" }} />
        {/* ── Momento del día — tratamiento editorial ─────────────────── */}
        <Link href={dynamicCard.href} style={{ display: "block", marginBottom: 9 }}>
          <div style={{
            borderRadius: 20,
            background: dynamicCard.type === "mensaje" ? "#07050f" : "#08070e",
            position: "relative", overflow: "hidden", minHeight: 160,
            border: "1px solid rgba(212,175,55,0.10)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(212,175,55,0.06)",
          }}>
            {/* Foto de fondo — mucho más presente si existe */}
            {dynamicCard.imageUrl && (
              <>
                <div style={{ position: "absolute", inset: 0, borderRadius: 20, overflow: "hidden", zIndex: 0 }}>
                  <img src={dynamicCard.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.32 }} />
                </div>
                <div style={{ position: "absolute", inset: 0, borderRadius: 20, zIndex: 1,
                  background: "linear-gradient(to bottom, rgba(7,5,15,0.3) 0%, rgba(7,5,15,0.85) 70%)" }} />
              </>
            )}
            {/* Nebula de fondo cuando no hay foto */}
            {!dynamicCard.imageUrl && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
                background: "radial-gradient(ellipse at 20% 40%, rgba(212,175,55,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 70%, rgba(80,30,120,0.08) 0%, transparent 45%)" }} />
            )}
            <div style={{ padding: "22px 20px 20px", position: "relative", zIndex: 2 }}>
              {/* Eyebrow */}
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
                color: dynamicCard.type === "mensaje" ? "rgba(152,152,184,0.45)" : "rgba(212,175,55,0.5)",
                marginBottom: 12 }}>
                {dynamicCard.type === "mensaje" ? "Momento del día" : dynamicCard.label}
              </div>
              {/* Título editorial */}
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.25,
                letterSpacing: "-0.01em" }}>
                {dynamicCard.title}
              </div>
              {/* Cuerpo con más aire */}
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.75, marginBottom: 18 }}>
                {dynamicCard.subtitle}
              </div>
              {/* CTA mínimo */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                  color: dynamicCard.type === "mensaje" ? "rgba(152,152,184,0.5)" : "rgba(212,175,55,0.6)",
                  borderBottom: `1px solid ${dynamicCard.type === "mensaje" ? "rgba(152,152,184,0.2)" : "rgba(212,175,55,0.2)"}`,
                  paddingBottom: 1 }}>
                  Abrir
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Mapa familiar — neutro oscuro */}
        <Link href="/mapa">
          <div style={{ ...s3dCard("#0a0a14","130,130,160","#03030a"), marginBottom: 9 }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(130,130,160,0.25)" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: "#0c0c1c",
                borderTop: "1.5px solid rgba(130,130,160,0.32)", borderBottom: "2px solid #03030a",
                borderLeft: "1px solid rgba(130,130,160,0.14)", borderRight: "1px solid rgba(0,0,0,0.55)",
                boxShadow: "0 4px 0 #03030a, 0 6px 10px rgba(0,0,0,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Map size={19} style={{ color: "#9898b8" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Mapa familiar</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                  De dónde venimos · ciudades de origen
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
          </div>
        </Link>

        {/* Invitar — oro (acción principal) */}
        <Link href="/invitar">
          <div style={{ ...s3dCard("#0c0a02","212,175,55","#040300",0.14), marginBottom: 9 }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(212,175,55,0.4)" }} />
            <div style={{ position: "absolute", top: -8, right: -8, width: 70, height: 70,
              borderRadius: "50%", background: "radial-gradient(circle,rgba(212,175,55,0.14) 0%,transparent 70%)",
              pointerEvents: "none" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ ...s3dIcon("#100c02","212,175,55","#040300"), marginBottom: 0, width: 40, height: 40, borderRadius: 13 }}>
                <Send size={19} style={{ color: "#d4af37" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Invitar a mi familia</div>
                <div style={{ fontSize: 10, color: "rgba(212,175,55,0.55)" }}>Haz crecer tu árbol familiar</div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(212,175,55,0.45)" }} />
            </div>
          </div>
        </Link>

        {/* ── Coincidencias familiares ──────────────────────────────────── */}
        {suggestions.filter(s => !dismissedIds.has(s.id)).length > 0 && (
          <div style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9, paddingTop: 6 }}>
              <Sparkles size={12} style={{ color: "#d4af37" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.65)",
                letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Posibles conexiones
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suggestions.filter(s => !dismissedIds.has(s.id)).map(s => {
                if (!s.person_a || !s.person_b) return null;
                const nameA = `${s.person_a.first_name} ${s.person_a.first_surname}`.trim();
                const nameB = `${s.person_b.first_name} ${s.person_b.first_surname}`.trim();
                const pct   = Math.round(s.score * 100);
                const top   = s.evidence[0];
                const EVIDENCE: Record<string, string> = {
                  surname: "Apellido", birth_city: "Ciudad natal", birth_decade: "Época de nacimiento", birth_country: "País",
                };
                return (
                  <div key={s.id} style={{
                    ...s3dCard("#0c0a02","212,175,55","#040300",0.08),
                    padding: "13px 13px 11px",
                  }}>
                    <div style={{ position: "absolute", top: 0, left: "18%", right: "18%",
                      height: 1, background: "rgba(212,175,55,0.35)" }} />

                    {/* header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                      <Sparkles size={12} style={{ color: "#d4af37" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.11em",
                        textTransform: "uppercase", color: "rgba(212,175,55,0.55)", flex: 1 }}>
                        Posible conexión
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d4af37",
                        background: "rgba(212,175,55,0.1)", padding: "2px 8px", borderRadius: 20 }}>
                        {pct}% coincidencia
                      </span>
                      <button onClick={() => handleDismiss(s.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2,
                          color: "rgba(255,255,255,0.2)", lineHeight: 0, marginLeft: 2 }}>
                        <X size={14} />
                      </button>
                    </div>

                    {/* personas */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                      {[{ name: nameA, space: s.space_a?.name }, { name: nameB, space: s.space_b?.name }].map((p, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          {i === 1 && (
                            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                              background: "rgba(212,175,55,0.08)", border: "1px dashed rgba(212,175,55,0.3)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 800, color: "rgba(212,175,55,0.4)" }}>?</div>
                          )}
                          <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "rgba(212,175,55,0.1)", border: "1.5px solid rgba(212,175,55,0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, color: "#d4af37" }}>
                            {p.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                            {p.space && (
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.space}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* evidencia */}
                    {top && (
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 10px" }}>
                        {EVIDENCE[top.type] || top.type}:&nbsp;
                        <span style={{ color: "#d4af37", fontWeight: 600 }}>{top.detail}</span>
                        {s.evidence.length > 1 && (
                          <span style={{ color: "rgba(212,175,55,0.35)" }}> +{s.evidence.length - 1} más</span>
                        )}
                      </p>
                    )}

                    {/* acciones */}
                    <div style={{ display: "flex", gap: 7 }}>
                      <Link href={`/sugerencias/${s.id}`} style={{ textDecoration: "none", flex: 1 }}>
                        <button style={{ width: "100%", padding: "8px 0", borderRadius: 10, cursor: "pointer",
                          background: "#c9a820", border: "none",
                          borderTop: "1.5px solid rgba(255,240,100,0.45)", borderBottom: "2.5px solid #6a5600",
                          boxShadow: "0 5px 0 #4a3c00, 0 8px 16px rgba(0,0,0,0.6)",
                          color: "#030208", fontSize: 12, fontWeight: 700 }}>
                          Ver y confirmar
                        </button>
                      </Link>
                      <button onClick={() => handleDismiss(s.id)}
                        style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                          background: "#0c0a18", border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600 }}>
                        No es familia
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Spotlight de cumpleaños — oro */}
        {spotlightBirthday && (
          <Link href={`/persona/${spotlightBirthday.person_id}`}>
            <div style={{ ...s3dCard("#100c02","212,175,55","#040300",0.14), marginBottom: 9 }}>
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
                background: "rgba(212,175,55,0.5)" }} />
              <div style={{ position: "absolute", top: -6, left: -6, width: 55, height: 55,
                borderRadius: "50%", background: "radial-gradient(circle,rgba(212,175,55,0.25) 0%,transparent 70%)",
                pointerEvents: "none" }} />
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, position: "relative" }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: "#181202", flexShrink: 0,
                  borderTop: "1.5px solid rgba(212,175,55,0.5)", borderLeft: "1px solid rgba(212,175,55,0.22)",
                  borderBottom: "2px solid #040300", borderRight: "1px solid rgba(0,0,0,0.5)",
                  boxShadow: "0 5px 0 #040300, 0 8px 14px rgba(0,0,0,0.6), 0 0 12px rgba(212,175,55,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gift size={20} style={{ color: "#d4af37" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                    textTransform: "uppercase", color: "#d4af37", marginBottom: 2 }}>
                    {spotlightBirthday.days === 0 ? "¡Hoy!" : `En ${spotlightBirthday.days} días`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 1 }}>
                    Cumpleaños de {spotlightBirthday.first_name} {spotlightBirthday.last_name}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(212,175,55,0.5)" }}>
                    {new Date().getFullYear() - new Date(spotlightBirthday.birth_date).getFullYear()} años
                  </div>
                </div>
                <ChevronRight size={17} style={{ color: "rgba(212,175,55,0.4)" }} />
              </div>
            </div>
          </Link>
        )}

        {/* Logros — oro oscuro */}
        <Link href="/profile">
          <div style={s3dCard("#0a0802","212,175,55","#030200")}>
            <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
              background: "rgba(212,175,55,0.42)" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.52)", marginBottom: 4 }}>
                  Logros familiares
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Tu árbol crece</div>
                <div style={{ height: 5, background: "rgba(212,175,55,0.08)", borderRadius: 100, overflow: "hidden",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)" }}>
                  <div style={{
                    width: `${Math.min(100, Math.round((visibleCount / 100) * 100))}%`,
                    height: "100%", background: "#d4af37", borderRadius: 100,
                    boxShadow: "0 0 8px rgba(212,175,55,0.6)",
                    transition: "width 0.8s ease",
                  }} />
                </div>
                <div style={{ fontSize: 9, color: "rgba(212,175,55,0.4)", marginTop: 5 }}>
                  {visibleCount} de 100 familiares
                </div>
              </div>
              <Trophy size={33} style={{ color: "#d4af37", flexShrink: 0 }} />
            </div>
          </div>
        </Link>
      </div>

      {/* Navegación inferior cósmica */}
      <CosmicNav pathname={pathname ?? "/home"} suggCount={suggestions.filter(s => !dismissedIds.has(s.id)).length} />
    </div>
  );
}
