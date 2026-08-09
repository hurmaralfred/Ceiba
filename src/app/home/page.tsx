"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getDiceBearUrl } from "@/lib/dicebear";
import {
  Home, TreePine, BookOpen, User, Bell, Menu,
  Users, GitBranch, Send,
  Trophy, ChevronRight, CalendarDays, Sparkles, X, MessageCircle, Map, Share2, Lock,
} from "lucide-react";
import BirthdayCardFeed from "@/components/BirthdayCardFeed";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { useFamilyNotifications } from "@/hooks/useFamilyNotifications";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import type { Profile, FamilyMember } from "@/lib/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FeedBirthday {
  person_id: string; first_name: string; last_name: string; birth_date: string;
}
interface FeedPhoto { id: string; url: string; caption: string | null; created_at: string; uploader_user_id?: string; }
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

// ── Nodo estadística ─────────────────────────────────────────────────────────
function StatNode({ icon: Icon, value, label }: {
  icon: React.ElementType; value: number; label: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 62, height: 62, borderRadius: "50%",
        background: "rgba(6,4,18,0.80)",
        border: "1px solid rgba(212,175,55,0.22)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 0 22px rgba(212,175,55,0.07), 0 4px 18px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      }}>
        <Icon size={11} style={{ color: "#d4af37", opacity: 0.65 }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: "#d4af37", lineHeight: 1 }}>{value}</span>
      </div>
      <span style={{ fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,0.32)", textAlign: "center",
        letterSpacing: "0.04em", lineHeight: 1.3, maxWidth: 62, whiteSpace: "pre-line" }}>
        {label}
      </span>
    </div>
  );
}

// ── Fila de grupos familiares ─────────────────────────────────────────────────
const GROUP_AVATARS: Record<string, string> = {
  padres:   "/avatars/avatar_elder_m_1.png",
  pareja:   "/avatars/avatar_adult_f_1.png",
  hijos:    "/avatars/avatar_child_m_1.png",
  hermanos: "/avatars/avatar_adult_m_2.png",
  abuelos:  "/avatars/avatar_elder_f_1.png",
};

function FamilyRow({ members }: { members: FamilyMember[] }) {
  const GROUPS = [
    { key: "padres",   label: "Padres",    types: ["father","stepfather","mother","stepmother","parent"] },
    { key: "pareja",   label: "Pareja",    types: ["husband","wife","spouse","partner"] },
    { key: "hijos",    label: "Hijos",     types: ["son","daughter","child","stepson","stepdaughter"] },
    { key: "hermanos", label: "Hermanos",  types: ["brother","sister","sibling","half_brother","half_sister"] },
    { key: "abuelos",  label: "Abuelos",   types: ["grandfather","grandmother","grandparent"] },
  ];
  const groups = GROUPS.map(g => {
    const ms = members.filter(m => {
      const t = (m.relation_type ?? "").toLowerCase().replace(/-/g,"_");
      return g.types.some(type => t === type || t.startsWith(type+"_"));
    });
    return { ...g, count: ms.length, first: ms[0] ?? null };
  }).filter(g => g.count > 0).slice(0, 5);

  if (groups.length === 0) return null;

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "rgba(212,175,55,0.4)", marginBottom: 14 }}>
        Familia cercana
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-around" }}>
        {groups.map(g => {
          const realSrc = g.first?.profile?.avatar_url ?? null;
          const fallbackSrc = GROUP_AVATARS[g.key] ?? "/avatars/avatar_adult_m_1.png";
          const imgSrc = realSrc ?? fallbackSrc;
          return (
            <Link key={g.key} href="/tree" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 58, height: 58, borderRadius: "50%",
                background: "#0e0c1e",
                border: "1.5px solid rgba(212,175,55,0.28)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.65), 0 0 0 3px rgba(212,175,55,0.07)",
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt={g.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{g.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(212,175,55,0.75)" }}>{g.count}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function GalaxyHero({ children, avatarInitial, avatarUrl, firstName, visibleCount, directCount, generationsCount, historyCount }: {
  children: React.ReactNode;
  avatarInitial: string;
  avatarUrl?: string | null;
  firstName: string;
  visibleCount: number;
  directCount: number;
  generationsCount: number;
  historyCount: number;
}) {
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
        @keyframes home-ring-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes home-ring-breathe { 0%,100%{opacity:0.72;transform:scale(1)} 50%{opacity:1;transform:scale(1.055)} }
        @keyframes btn-float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
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

      {/* Avatar + constelación — centrado */}
      <div style={{ position:"relative", width:"100%", display:"flex",
        justifyContent:"center", marginBottom:10, zIndex:5 }}>

        {/* Constelación + avatar — centro */}
        <div style={{ position:"relative", display:"inline-block", flexShrink:0 }}>
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
          {/* Avatar corona — gravitational center, breathes outward — radii tuned for 135px avatar (r≈67.5) */}
          <circle cx="150" cy="150" r="90"  fill="rgba(212,175,55,0.09)" filter="url(#cglow)"/>
          <circle cx="150" cy="150" r="82"  fill="none" stroke="rgba(242,180,60,0.22)" strokeWidth="0.7"
            style={{ animation:"corona-pulse 4s ease-in-out infinite" }}/>
          <circle cx="150" cy="150" r="96"  fill="none" stroke="rgba(242,180,60,0.10)" strokeWidth="0.5"
            style={{ animation:"corona-pulse 4s ease-in-out infinite 1.5s" }}/>
          <circle cx="150" cy="150" r="110" fill="none" stroke="rgba(242,180,60,0.05)" strokeWidth="0.4"
            style={{ animation:"corona-pulse 4s ease-in-out infinite 3s" }}/>
          {/* Orbital paths — gravitational trajectories, barely visible */}
          <circle cx="150" cy="150" r="68"  fill="none" stroke="rgba(212,175,55,0.04)" strokeWidth="0.45"
            style={{ animation:"section-glow 9s ease-in-out infinite" }}/>
          <circle cx="150" cy="150" r="105" fill="none" stroke="rgba(212,175,55,0.03)" strokeWidth="0.35"
            style={{ animation:"section-glow 12s ease-in-out infinite 3s" }}/>
          <circle cx="150" cy="150" r="132" fill="none" stroke="rgba(212,175,55,0.02)" strokeWidth="0.3"
            style={{ animation:"section-glow 15s ease-in-out infinite 6s" }}/>
          {/* Background gas giants — very slow drift, appear behind orbital rings */}
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-cw 265s linear infinite -55s" }}>
            <circle cx="70" cy="-54" r="26" fill="rgba(200,100,18,0.86)" style={{ filter:"drop-shadow(0 0 18px rgba(200,120,48,0.82))" }}/>
            <ellipse cx="70" cy="-50" rx="26" ry="5.5" fill="rgba(255,195,75,0.24)"/>
            <ellipse cx="70" cy="-58" rx="26" ry="4" fill="rgba(130,45,0,0.22)"/>
            <circle cx="61" cy="-63" r="9" fill="white" opacity="0.18"/>
            <circle cx="70" cy="-54" r="38" fill="rgba(200,100,18,0.06)"/>
          </g>
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-ccw 188s linear infinite -35s" }}>
            <circle cx="-74" cy="56" r="17" fill="rgba(88,148,228,0.82)" style={{ filter:"drop-shadow(0 0 11px rgba(110,170,255,0.68))" }}/>
            <circle cx="-81" cy="49" r="6" fill="white" opacity="0.22"/>
            <ellipse cx="-74" cy="56" rx="27" ry="6" fill="none" stroke="rgba(150,200,255,0.38)" strokeWidth="2.5"/>
            <circle cx="-74" cy="56" r="26" fill="rgba(88,148,228,0.05)"/>
          </g>
          <g transform="translate(150,150)" style={{ transformOrigin:"0px 0px", animation:"orbit-ring-cw 318s linear infinite -90s" }}>
            <circle cx="-50" cy="-71" r="12" fill="rgba(160,120,228,0.84)" style={{ filter:"drop-shadow(0 0 9px rgba(180,140,255,0.72))" }}/>
            <circle cx="-57" cy="-78" r="4.5" fill="white" opacity="0.24"/>
            <circle cx="-50" cy="-71" r="20" fill="rgba(160,120,228,0.06)"/>
          </g>
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

        {/* Avatar — 30% larger (104→135px) with living animated ring */}
        <div style={{ position:"relative", width:135, height:135, zIndex:2 }}>
          {/* Pulse glow — breathes independently */}
          <div style={{ position:"absolute", inset:-16, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(242,180,60,0.30) 0%, rgba(130,60,230,0.10) 40%, transparent 70%)",
            animation:"home-ring-breathe 3.5s ease-in-out infinite", pointerEvents:"none" }} />
          {/* Conic ring — rotates continuously */}
          <div style={{ position:"absolute", inset:-7, borderRadius:"50%",
            background:"conic-gradient(from 0deg, rgba(242,180,60,0.95) 0deg, rgba(200,120,48,0.55) 80deg, rgba(184,160,216,0.30) 160deg, rgba(123,175,212,0.55) 230deg, rgba(242,180,60,0.80) 295deg, rgba(242,180,60,0.95) 360deg)",
            animation:"home-ring-spin 7s linear infinite",
            filter:"blur(1.5px)", pointerEvents:"none" }} />
          {/* Dark gap between ring and photo */}
          <div style={{ position:"absolute", inset:-1, borderRadius:"50%",
            background:"#030208", pointerEvents:"none", zIndex:1 }} />
          {/* Photo */}
          <div style={{ width:135, height:135, borderRadius:"50%", background:"#0c0a18",
            display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:2,
            boxShadow:"inset 0 3px 28px rgba(120,60,220,0.3), inset 0 -3px 14px rgba(0,0,0,0.7)" }}>
            <div style={{ position:"absolute", inset:0, borderRadius:"50%",
              background:"radial-gradient(circle at 35% 25%,rgba(212,175,55,0.18) 0%,transparent 55%)" }} />
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={firstName}
                style={{ width:135, height:135, borderRadius:"50%", objectFit:"cover", position:"relative" }} />
            ) : (
              <span style={{ fontSize:52, color:"#d4af37", fontWeight:800, position:"relative",
                textShadow:"0 0 20px rgba(212,175,55,0.6)" }}>
                {avatarInitial}
              </span>
            )}
          </div>
        </div>
        </div>{/* /center */}

      </div>{/* /avatar row */}

      {/* Name */}
      <div style={{ fontSize:25, fontWeight:800, color:"#fff", letterSpacing:0.2, marginBottom:4,
        position:"relative", zIndex:5, animation:"name-glow 5s ease-in-out infinite" }}>
        {firstName || "Cargando..."}
      </div>

      {/* Universe label */}
      <div style={{ fontSize:11, color:"rgba(212,175,55,0.48)",
        marginBottom:14, position:"relative", zIndex:5, letterSpacing:"0.05em" }}>
        Tu universo familiar
      </div>

      {/* Stats strip — 4 métricas en línea horizontal */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        marginBottom:24, position:"relative", zIndex:5 }}>
        <div style={{ padding:"0 14px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#d4af37", lineHeight:1 }}>{visibleCount}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.40)", textTransform:"uppercase",
            letterSpacing:"0.08em", marginTop:3, lineHeight:1 }}>familiares</div>
        </div>
        <div style={{ width:1, height:24, background:"rgba(212,175,55,0.16)", flexShrink:0 }} />
        <div style={{ padding:"0 14px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#d4af37", lineHeight:1 }}>{directCount}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.40)", textTransform:"uppercase",
            letterSpacing:"0.08em", marginTop:3, lineHeight:1 }}>conexiones</div>
        </div>
        <div style={{ width:1, height:24, background:"rgba(212,175,55,0.16)", flexShrink:0 }} />
        <div style={{ padding:"0 14px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#d4af37", lineHeight:1 }}>{generationsCount}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.40)", textTransform:"uppercase",
            letterSpacing:"0.08em", marginTop:3, lineHeight:1 }}>generaciones</div>
        </div>
        <div style={{ width:1, height:24, background:"rgba(212,175,55,0.16)", flexShrink:0 }} />
        <div style={{ padding:"0 14px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#d4af37", lineHeight:1 }}>{historyCount}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.40)", textTransform:"uppercase",
            letterSpacing:"0.08em", marginTop:3, lineHeight:1 }}>recuerdos</div>
        </div>
      </div>

    </div>
  );
}

// ── Botón circular 3D flotante ────────────────────────────────────────────────
function CircleBtn({ icon: Icon, label, href, color, shadowColor, delay = 0, badge = 0 }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string; href: string;
  color: string;    // "r,g,b"
  shadowColor: string; // hex for 3D depth shadow
  delay?: number;
  badge?: number;
}) {
  return (
    <Link href={href} style={{ display:"flex", flexDirection:"column", alignItems:"center",
      gap:8, flexShrink:0, textDecoration:"none" }}>
      <div style={{ position:"relative", width:72, height:72,
        animation:`btn-float 3.8s ease-in-out infinite ${delay}s` }}>
        {badge > 0 && (
          <div style={{
            position:"absolute", top:-4, right:-4, zIndex:10,
            minWidth:18, height:18, borderRadius:9,
            background:"#ef4444", color:"#fff",
            fontSize:10, fontWeight:800, lineHeight:1,
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"0 4px",
            boxShadow:"0 2px 6px rgba(0,0,0,0.6), 0 0 10px rgba(239,68,68,0.7)",
            border:"1.5px solid rgba(255,255,255,0.2)",
          }}>
            {badge > 99 ? "99+" : badge}
          </div>
        )}
        <div style={{
          width:72, height:72, borderRadius:"50%",
          background:[
            `radial-gradient(circle at 38% 28%, rgba(${color},0.55) 0%, rgba(${color},0.12) 40%, rgba(3,1,8,0.96) 70%)`,
          ].join(","),
          border:`2px solid rgba(${color},0.80)`,
          boxShadow:[
            `0 10px 0 ${shadowColor}`,
            `0 18px 36px rgba(0,0,0,0.95)`,
            `0 0 40px rgba(${color},0.35)`,
            `0 0 80px rgba(${color},0.12)`,
            `inset 0 2px 0 rgba(255,255,255,0.32)`,
            `inset 0 -3px 8px rgba(0,0,0,0.70)`,
            `inset 2px 0 6px rgba(255,255,255,0.06)`,
          ].join(","),
          display:"flex", alignItems:"center", justifyContent:"center",
          position:"relative", overflow:"hidden",
        }}>
          {/* Top dome highlight */}
          <div style={{ position:"absolute", top:0, left:"8%", right:"8%", height:"52%",
            background:"radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.06) 55%, transparent 80%)",
            borderRadius:"50%", pointerEvents:"none" }}/>
          {/* Side rim light */}
          <div style={{ position:"absolute", top:"12%", bottom:"12%", left:0, width:"18%",
            background:"linear-gradient(to right, rgba(255,255,255,0.10) 0%, transparent 100%)",
            borderRadius:"50% 0 0 50%", pointerEvents:"none" }}/>
          <Icon size={26} style={{ color:`rgb(${color})`, position:"relative",
            filter:`drop-shadow(0 0 10px rgba(${color},0.90)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))` }}/>
        </div>
      </div>
      <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.62)",
        textAlign:"center", letterSpacing:"0.01em", lineHeight:1.35,
        maxWidth:68, whiteSpace:"pre-line" }}>
        {label}
      </span>
    </Link>
  );
}

// ── Shortcut secundario (también visible en nav inferior) ─────────────────────
function QuickLink({ icon: Icon, label, href, color }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string; href: string; color: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
        padding: "12px 6px 10px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(212,175,55,0.1)",
      }}>
        <Icon size={17} style={{ color: `rgb(${color})`, opacity: 0.7 }} />
        <span style={{
          fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.42)",
          textAlign: "center", lineHeight: 1.2, letterSpacing: "0.01em",
        }}>{label}</span>
      </div>
    </Link>
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
    { href: "/home",      Icon: Home,     label: "Inicio"   },
    { href: "/tree",      Icon: TreePine, label: "Árbol"    },
    { href: "/hoy", Icon: CalendarDays, label: "Un día como hoy", center: true },
    { href: "/events",    Icon: BookOpen, label: "Recuerdos" },
    { href: "/profile",   Icon: User,     label: "Perfil"   },
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
  const [allEvents,    setAllEvents]    = useState<FeedEvent[]>([]);
  const [suggestions,  setSuggestions]  = useState<KinshipSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [roster,       setRoster]       = useState<FamilyRosterMember[]>([]);
  const [myUserId,     setMyUserId]     = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<FeedPhoto | null>(null);
  const [unreadChats,  setUnreadChats]  = useState(0);
  const [pendingCapsulas, setPendingCapsulas] = useState(0);

  // Force dark body background — globals.css uses cream which bleeds through
  useEffect(() => {
    document.body.style.background = '#030208';
    return () => { document.body.style.background = ''; };
  }, []);

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

    const [graphRes, feedRes, sugRes, rosterRes, eventsRes, chatRes, capsulasRes] = await Promise.allSettled([
      supabase.rpc("get_my_family_graph", { p_depth: 4 }),
      fetch("/api/feed"),
      fetch("/api/suggestions"),
      fetch("/api/family/roster"),
      fetch("/api/events"),
      fetch("/api/chat/rooms"),
      fetch("/api/capsulas"),
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

    if (eventsRes.status === "fulfilled") {
      try {
        const res = eventsRes.value;
        if (res.ok) {
          const { events: ev } = await res.json();
          setAllEvents(ev ?? []);
        }
      } catch {}
    }

    if (chatRes.status === "fulfilled") {
      try {
        const res = chatRes.value;
        if (res.ok) {
          const { conversations } = await res.json();
          const count = (conversations ?? []).filter((c: any) => c.unread).length;
          setUnreadChats(count);
          // Update app icon badge (iOS 17+ / Android Chrome / desktop)
          if ("setAppBadge" in navigator) {
            if (count > 0) navigator.setAppBadge(count).catch(() => {});
            else navigator.clearAppBadge().catch(() => {});
          }
        }
      } catch {}
    }

    if (capsulasRes.status === "fulfilled") {
      try {
        const res = capsulasRes.value;
        if (res.ok) {
          const { capsulas } = await res.json();
          // Cápsulas para mí que aún no he abierto (locked or unlocked but unopened)
          const pending = (capsulas ?? []).filter((c: any) => c.is_recipient && !c.opened_at).length;
          setPendingCapsulas(pending);
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
  // Notificaciones en tiempo real (cumpleaños + nuevas historias/recuerdos)
  useFamilyNotifications(myUserId, allBirthdays);
  const todayBirthday    = allBirthdays.find(b => b.days === 0) ?? null;
  const upcomingBirthday = !todayBirthday
    ? allBirthdays.filter(b => b.days > 0).sort((a, b) => a.days - b.days)[0] ?? null
    : null;
  const rosterPersonIds = new Set(roster.map(m => m.person_id));
  const firstName = profile?.first_name ?? "";
  const avatarInitial = firstName[0]?.toUpperCase() ?? "?";


  // Stats — invitan a explorar, no describen el vacío
  const birthdaysThisMonth = allBirthdays.filter(b => b.days > 0 && b.days <= 30).length;
  const historyCount = events.length;
  const directCount = members.length;
  const generationsCount = (() => {
    const types = new Set(members.map(m => m.relation_type ?? ""));
    let gen = 1;
    if ([...types].some(t => t.includes("grand"))) gen = Math.max(gen, 2);
    if ([...types].some(t => t.includes("great_grand"))) gen = Math.max(gen, 3);
    if ([...types].some(t => t.includes("great_great"))) gen = Math.max(gen, 4);
    return gen;
  })();
  const recentMemories = [
    ...photos.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 7 * 86_400_000),
    ...events.filter(e => (Date.now() - new Date(e.created_at).getTime()) < 7 * 86_400_000),
  ].length;


  return (
    <div style={{ minHeight: "100vh", background: "#030208", paddingBottom: 100, color: "#fff" }}>


      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <GalaxyHero
        avatarInitial={avatarInitial}
        avatarUrl={profile?.avatar_url ?? getDiceBearUrl(profile?.first_name ?? 'user')}
        firstName={profile?.first_name ?? ""}
        visibleCount={visibleCount}
        directCount={directCount}
        generationsCount={generationsCount}
        historyCount={historyCount}
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
            <div style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "#0c0a1a",
              borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
              borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.6)",
              boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} style={{ color: "rgba(212,175,55,0.75)" }} />
              {suggestions.filter(s => !dismissedIds.has(s.id)).length > 0 && (
                <div style={{
                  position: "absolute", top: -3, right: -3,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "#d4af37", border: "1.5px solid #030208",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 800, color: "#030208", lineHeight: 1,
                }}>
                  {suggestions.filter(s => !dismissedIds.has(s.id)).length}
                </div>
              )}
            </div>
          </Link>
        </div>
      </GalaxyHero>

      {/* ── FAMILIA DIRECTA ─────────────────────────────────────────────── */}
      <FamilyRow members={members} />

      {/* ── EMPTY STATE — sin familia aún ──────────────────────────────── */}
      {profile !== null && members.length === 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            borderRadius: 18, padding: "22px 20px",
            background: "linear-gradient(135deg, #0e0b1f 0%, #0a0818 100%)",
            border: "1px solid rgba(212,175,55,0.18)",
            borderTop: "1.5px solid rgba(212,175,55,0.3)",
            boxShadow: "0 4px 0 #000, 0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              Tu árbol está esperando
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 18 }}>
              Agrega a tu primer familiar para comenzar a construir tu universo familiar.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/tree" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "13px 20px", borderRadius: 14,
                  background: "linear-gradient(135deg, #c9a820, #a07010)",
                  borderBottom: "2.5px solid #6a5600",
                  boxShadow: "0 5px 0 #4a3c00, 0 8px 20px rgba(0,0,0,0.5)",
                  fontSize: 14, fontWeight: 800, color: "#030208",
                }}>
                  <Users size={16} style={{ color: "#030208" }} />
                  Agregar mi primer familiar
                </div>
              </Link>
              <Link href="/invitar" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 20px", borderRadius: 14,
                  background: "rgba(212,175,55,0.06)",
                  border: "1px solid rgba(212,175,55,0.2)",
                  fontSize: 13, fontWeight: 700, color: "rgba(212,175,55,0.8)",
                }}>
                  <Send size={14} style={{ color: "rgba(212,175,55,0.7)" }} />
                  Invitar a un familiar
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── CTA PRINCIPAL ───────────────────────────────────────────────── */}
      {members.length > 0 && (
        <div style={{ padding: "16px 16px 0" }}>
          <Link href="/tree" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "16px 24px", borderRadius: 16,
              background: "linear-gradient(135deg, #c9a820 0%, #a07010 100%)",
              borderTop: "1.5px solid rgba(255,240,100,0.38)",
              borderBottom: "3px solid #6a5600",
              boxShadow: "0 6px 0 #4a3c00, 0 10px 28px rgba(0,0,0,0.55), 0 0 28px rgba(212,175,55,0.2)",
              color: "#030208",
              fontSize: 15, fontWeight: 800, letterSpacing: "0.01em",
            }}>
              <TreePine size={18} style={{ color: "#030208" }} />
              Ver mi galaxia completa
              <ChevronRight size={16} style={{ color: "rgba(3,2,8,0.55)" }} />
            </div>
          </Link>
        </div>
      )}

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

      {/* Divisor */}
      <div style={{ margin: "20px 16px 0", height: 1,
        background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.18), transparent)" }} />

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

        {/* — Caso C: Próximo cumpleaños (≤ 7 días) — card dominante */}
        {!todayBirthday && upcomingBirthday && upcomingBirthday.days <= 7 && (
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

      </div>

      {/* ══ ACCESOS RÁPIDOS ══════════════════════════════════════════════ */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(212,175,55,0.4)", marginBottom: 16 }}>
          Accesos rápidos
        </div>
        {/* Tier 1 — funciones no duplicadas en la navegación inferior */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px 8px", marginBottom: 16 }}>
          <CircleBtn icon={MessageCircle} label="Chat"      href="/chat"     color="160,170,245" shadowColor="#050328" delay={0}   badge={unreadChats} />
          <CircleBtn icon={Lock}          label="Cápsulas"  href="/capsulas" color="150,90,255"  shadowColor="#060010" delay={0.4} badge={pendingCapsulas} />
          <CircleBtn icon={Map}           label="Mapa"      href="/mapa"     color="80,220,250"  shadowColor="#02101e" delay={0.8} />
          <CircleBtn icon={Send}          label="Invitar"   href="/invitar"  color="212,175,55"  shadowColor="#362000" delay={1.2} />
        </div>
        {/* Tier 2 — accesos también visibles en la navegación inferior */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <QuickLink icon={CalendarDays} label="Un día hoy" href="/hoy"    color="212,175,55" />
          <QuickLink icon={BookOpen}     label="Recuerdos"  href="/events" color="242,180,60" />
          <QuickLink icon={Trophy}       label="Logros"     href="/profile" color="210,150,40" />
        </div>
      </div>

      {/* ── GALERÍA FAMILIAR ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div style={{ padding: "20px 0 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "rgba(212,175,55,0.4)", marginBottom: 16, paddingLeft: 16 }}>
            Fotos de la familia
          </div>
          <div style={{
            display: "flex", gap: 14,
            overflowX: "auto", paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
            scrollbarWidth: "none",
          }}>
            {photos.map((photo, idx) => {
              const tilt = idx % 2 === 0 ? "rotate(-2deg)" : "rotate(1.5deg)";
              return (
                <div
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  style={{
                    flexShrink: 0,
                    width: 140, height: 160,
                    borderRadius: 4,
                    overflow: "visible",
                    cursor: "pointer",
                    position: "relative",
                    transform: tilt,
                    transition: "transform 0.2s ease",
                  }}>
                  {/* Polaroid frame */}
                  <div style={{
                    width: "100%", height: "100%",
                    background: "#fff",
                    borderRadius: 4,
                    padding: "8px 8px 28px",
                    boxSizing: "border-box",
                    boxShadow: "0 8px 0 rgba(0,0,0,0.35), 0 14px 36px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.25)",
                    display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ flex: 1, overflow: "hidden", borderRadius: 2 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.caption ?? ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                    {photo.caption && (
                      <div style={{
                        fontSize: 8.5, color: "rgba(0,0,0,0.5)", textAlign: "center",
                        marginTop: 6, fontFamily: "cursive",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        lineHeight: 1.3,
                      }}>
                        {photo.caption}
                      </div>
                    )}
                  </div>
                  {/* Gold pin */}
                  <div style={{
                    position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)",
                    width: 12, height: 12, borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, #ffe066, #b8860b)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.6), 0 0 8px rgba(212,175,55,0.4)",
                    zIndex: 2,
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FUNCIONES ────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 14px", position: "relative" }}>
        {/* Glow atmosférico */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 300, height: 300, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, rgba(80,30,160,0.04) 40%, transparent 70%)",
          filter: "blur(24px)", animation: "section-glow 6s ease-in-out infinite" }} />
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

        {/* Feed de cumpleaños — Sprint 0 */}
        <BirthdayCardFeed birthdays={allBirthdays} rosterPersonIds={rosterPersonIds} />

      </div>

      {/* Navegación inferior cósmica */}
      <CosmicNav pathname={pathname ?? "/home"} suggCount={suggestions.filter(s => !dismissedIds.has(s.id)).length} />

      {/* ── Lightbox de foto ─────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div onClick={() => setLightboxPhoto(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.94)", backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {/* Cerrar */}
          <button onClick={() => setLightboxPhoto(null)}
            style={{ position: "absolute", top: "max(env(safe-area-inset-top), 16px)", right: 16,
              width: 38, height: 38, borderRadius: 12,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 20, lineHeight: 1 }}>
            ×
          </button>

          {/* Foto completa */}
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 520, padding: "0 16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxPhoto.url} alt=""
              style={{ width: "100%", maxHeight: "70vh", objectFit: "contain",
                borderRadius: 18, display: "block",
                boxShadow: "0 20px 60px rgba(0,0,0,0.80)" }} />

            {lightboxPhoto.caption && (
              <p style={{ marginTop: 14, fontSize: 15, fontWeight: 700,
                color: "#F5EDD8", textAlign: "center", lineHeight: 1.4 }}>
                {lightboxPhoto.caption}
              </p>
            )}

            {/* Botón eliminar — solo si es la foto del usuario actual */}
            {lightboxPhoto.uploader_user_id === myUserId && (
              <button onClick={async () => {
                  const res = await fetch(`/api/photos?id=${lightboxPhoto.id}`, { method: "DELETE" });
                  if (res.ok) {
                    setPhotos(prev => prev.filter(p => p.id !== lightboxPhoto.id));
                    setLightboxPhoto(null);
                  }
                }}
                style={{ display: "block", width: "100%", marginTop: 18,
                  padding: "14px 0", borderRadius: 14, cursor: "pointer",
                  background: "rgba(220,60,80,0.10)", border: "1px solid rgba(220,60,80,0.35)",
                  color: "rgba(220,60,80,0.80)", fontWeight: 700, fontSize: 14 }}>
                Eliminar foto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
