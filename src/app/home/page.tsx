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
    borderTop: `1.5px solid rgba(${ar},0.4)`, borderLeft: `1px solid rgba(${ar},0.18)`,
    borderBottom: `3px solid ${sh}`, borderRight: `1px solid rgba(0,0,0,0.6)`,
    boxShadow: `0 7px 0 ${sh}, 0 12px 22px rgba(0,0,0,0.85), 0 0 20px rgba(${ar},${glow})`,
  };
}
function s3dIcon(bg: string, ar: string, sh: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 11, background: bg, flexShrink: 0,
    borderTop: `1.5px solid rgba(${ar},0.48)`, borderLeft: `1px solid rgba(${ar},0.2)`,
    borderBottom: `2px solid ${sh}`, borderRight: `1px solid rgba(0,0,0,0.55)`,
    boxShadow: `0 4px 0 ${sh}, 0 6px 10px rgba(0,0,0,0.65)`,
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
function GalaxyHero({ children, avatarInitial, avatarUrl, firstName, lastName }: {
  children: React.ReactNode;
  avatarInitial: string;
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
}) {
  return (
    <div style={{ position: "relative", overflow: "hidden", paddingBottom: 32, textAlign: "center",
      background: "radial-gradient(ellipse 120% 80% at 50% 0%, #12082a 0%, #060318 45%, #030208 100%)" }}>

      <style>{`
        @keyframes twinkle-a { 0%,100%{opacity:.9;transform:scale(1)} 50%{opacity:.25;transform:scale(.7)} }
        @keyframes twinkle-b { 0%,100%{opacity:.6;transform:scale(1)} 40%{opacity:.1;transform:scale(.6)} }
        @keyframes twinkle-c { 0%,100%{opacity:.75;transform:scale(1)} 60%{opacity:.3;transform:scale(.8)} }
        @keyframes ring-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ring-spin-r{ from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes core-pulse { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.85;transform:scale(1.12)} }
        @keyframes dust-float { 0%,100%{opacity:0;transform:translateY(0) translateX(0)} 25%{opacity:.6} 50%{opacity:.3;transform:translateY(-18px) translateX(6px)} 75%{opacity:.5;transform:translateY(-8px) translateX(-4px)} }
        @keyframes shoot { 0%{opacity:0;transform:translateX(0) translateY(0)} 5%{opacity:1} 100%{opacity:0;transform:translateX(-160px) translateY(60px)} }
        @keyframes name-glow { 0%,100%{text-shadow:0 0 20px rgba(212,175,55,0.0)} 50%{text-shadow:0 0 28px rgba(212,175,55,0.45)} }
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

      {/* Star field — layered with twinkle animations */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} aria-hidden>
        {/* Static dim stars */}
        {[
          [22,18,0.5],[58,32,0.4],[110,8,0.55],[178,22,0.42],[230,14,0.5],[280,28,0.38],[318,12,0.48],
          [8,65,0.45],[44,78,0.38],[92,54,0.5],[148,68,0.4],[196,44,0.45],[248,72,0.35],[302,58,0.48],
          [18,120,0.4],[62,108,0.38],[120,132,0.42],[168,98,0.5],[222,118,0.36],[274,104,0.44],[312,128,0.4],
          [30,170,0.45],[78,158,0.38],[136,182,0.42],[184,162,0.48],[238,176,0.35],[290,164,0.44],
          [14,220,0.4],[66,208,0.38],[126,228,0.45],[182,212,0.42],[240,224,0.36],[296,216,0.44],
        ].map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.65" fill="white" opacity={o} />)}

        {/* Twinkling white stars */}
        <circle cx="40"  cy="24"  r="1.1" fill="white" opacity="0.9" style={{ animation:"twinkle-a 3.1s ease-in-out infinite" }} />
        <circle cx="288" cy="18"  r="1.0" fill="white" opacity="0.8" style={{ animation:"twinkle-b 2.7s ease-in-out infinite 0.4s" }} />
        <circle cx="72"  cy="140" r="0.9" fill="white" opacity="0.75" style={{ animation:"twinkle-c 3.5s ease-in-out infinite 0.9s" }} />
        <circle cx="256" cy="152" r="1.0" fill="white" opacity="0.7" style={{ animation:"twinkle-a 2.9s ease-in-out infinite 1.3s" }} />
        <circle cx="20"  cy="190" r="0.9" fill="white" opacity="0.8" style={{ animation:"twinkle-b 3.3s ease-in-out infinite 0.6s" }} />
        <circle cx="310" cy="178" r="1.0" fill="white" opacity="0.75" style={{ animation:"twinkle-c 2.8s ease-in-out infinite 1.1s" }} />
        <circle cx="140" cy="30"  r="0.8" fill="white" opacity="0.7" style={{ animation:"twinkle-a 3.6s ease-in-out infinite 0.3s" }} />

        {/* Gold stars */}
        <circle cx="160" cy="12"  r="1.4" fill="#d4af37" opacity="0.95" style={{ animation:"twinkle-b 4.1s ease-in-out infinite" }} />
        <circle cx="96"  cy="10"  r="1.1" fill="#d4af37" opacity="0.85" style={{ animation:"twinkle-c 3.8s ease-in-out infinite 0.7s" }} />
        <circle cx="228" cy="16"  r="1.2" fill="#f0d060" opacity="0.88" style={{ animation:"twinkle-a 3.4s ease-in-out infinite 1.5s" }} />
        <circle cx="52"  cy="196" r="1.0" fill="#d4af37" opacity="0.7" style={{ animation:"twinkle-b 4.3s ease-in-out infinite 0.2s" }} />
        <circle cx="268" cy="200" r="1.1" fill="#d4af37" opacity="0.72" style={{ animation:"twinkle-c 3.9s ease-in-out infinite 1.8s" }} />

        {/* Cross sparkles */}
        <g style={{ animation:"twinkle-a 5s ease-in-out infinite" }}>
          <circle cx="32" cy="50" r="1.5" fill="white" opacity="0.85" />
          <line x1="32" y1="46" x2="32" y2="54" stroke="white" strokeWidth="0.5" opacity="0.6"/>
          <line x1="28" y1="50" x2="36" y2="50" stroke="white" strokeWidth="0.5" opacity="0.6"/>
        </g>
        <g style={{ animation:"twinkle-b 4.5s ease-in-out infinite 1.2s" }}>
          <circle cx="300" cy="44" r="1.4" fill="white" opacity="0.8" />
          <line x1="300" y1="40" x2="300" y2="48" stroke="white" strokeWidth="0.45" opacity="0.55"/>
          <line x1="296" y1="44" x2="304" y2="44" stroke="white" strokeWidth="0.45" opacity="0.55"/>
        </g>
        <g style={{ animation:"twinkle-c 5.2s ease-in-out infinite 2.1s" }}>
          <circle cx="162" cy="13" r="1.3" fill="#f5e060" opacity="0.9" />
          <line x1="162" y1="9"  x2="162" y2="17" stroke="#f5e060" strokeWidth="0.55" opacity="0.7"/>
          <line x1="158" y1="13" x2="166" y2="13" stroke="#f5e060" strokeWidth="0.55" opacity="0.7"/>
        </g>

        {/* Shooting stars */}
        <line x1="260" y1="40" x2="295" y2="28" stroke="white" strokeWidth="0.8" opacity="0"
          style={{ animation:"shoot 8s linear infinite 2s", transformOrigin:"260px 40px" }} />
        <line x1="80"  y1="18" x2="118" y2="6"  stroke="white" strokeWidth="0.7" opacity="0"
          style={{ animation:"shoot 8s linear infinite 5.5s", transformOrigin:"80px 18px" }} />
      </svg>

      {/* Dust particles */}
      {[
        [30,160,2.8],[55,110,3.4],[240,130,2.6],[275,170,3.1],[150,200,2.9],[100,180,3.6],
      ].map(([x,y,d],i) => (
        <div key={i} style={{ position:"absolute", left:x, top:y, width:2, height:2, borderRadius:"50%",
          background:"rgba(212,175,55,0.5)", pointerEvents:"none",
          animation:`dust-float ${d}s ease-in-out infinite ${i*0.6}s` }} />
      ))}

      {/* Top bar */}
      {children}

      {/* Galactic core behind avatar */}
      <div style={{ position:"relative", display:"inline-block", marginBottom:16, zIndex:5 }}>
        {/* Outer ambient glow — very large, very soft */}
        <div style={{ position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:260, height:260, borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(circle,rgba(130,60,230,0.18) 0%,rgba(212,175,55,0.08) 40%,transparent 70%)",
          filter:"blur(16px)", animation:"core-pulse 4s ease-in-out infinite" }} />
        {/* Mid glow */}
        <div style={{ position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:170, height:170, borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(circle,rgba(212,175,55,0.22) 0%,rgba(100,40,200,0.15) 50%,transparent 70%)",
          filter:"blur(10px)", animation:"core-pulse 3.2s ease-in-out infinite 0.5s" }} />

        {/* Outer slow-spinning ring */}
        <div style={{ position:"absolute", inset:-22, borderRadius:"50%", pointerEvents:"none",
          background:"conic-gradient(from 0deg,rgba(212,175,55,0.0) 0%,rgba(212,175,55,0.3) 25%,rgba(130,60,230,0.25) 50%,rgba(40,80,220,0.2) 75%,rgba(212,175,55,0.0) 100%)",
          animation:"ring-spin 18s linear infinite", filter:"blur(4px)" }} />

        {/* Inner sharp ring — faster, opposite direction */}
        <div style={{ position:"absolute", inset:-8, borderRadius:"50%", pointerEvents:"none",
          background:"conic-gradient(from 15deg,#d4af37 0%,#f5e070 12%,rgba(212,175,55,0.1) 25%,#7040c0 38%,#2050c8 52%,rgba(40,80,220,0.1) 65%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)",
          animation:"ring-spin-r 9s linear infinite" }} />

        {/* Gap ring */}
        <div style={{ position:"absolute", inset:-2, borderRadius:"50%", background:"#030208", pointerEvents:"none" }} />

        {/* Avatar body */}
        <div style={{ width:120, height:120, borderRadius:"50%", background:"#0c0a18",
          display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:2,
          boxShadow:"inset 0 3px 28px rgba(120,60,220,0.3), inset 0 -3px 14px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.12)" }}>
          <div style={{ position:"absolute", inset:0, borderRadius:"50%",
            background:"radial-gradient(circle at 35% 25%,rgba(212,175,55,0.2) 0%,transparent 55%)" }} />
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={firstName}
              style={{ width:120, height:120, borderRadius:"50%", objectFit:"cover", position:"relative" }} />
          ) : (
            <span style={{ fontSize:46, color:"#d4af37", fontWeight:800, position:"relative",
              textShadow:"0 0 20px rgba(212,175,55,0.6)" }}>
              {avatarInitial}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize:23, fontWeight:800, color:"#fff", letterSpacing:0.4, marginBottom:4,
        position:"relative", zIndex:5, animation:"name-glow 5s ease-in-out infinite" }}>
        {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Cargando..."}
      </div>

      {/* Tagline */}
      <div style={{ fontSize:10.5, color:"rgba(212,175,55,0.6)", fontStyle:"italic",
        marginBottom:20, position:"relative", zIndex:5, letterSpacing:"0.06em" }}>
        ✦ Guardián de la memoria familiar ✦
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
      <div style={{ position: "absolute", top: 0, left: "18%", right: "18%",
        height: 1, background: `rgba(${ar},0.42)` }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 18, pointerEvents: "none",
        background: `radial-gradient(circle at 85% 15%, rgba(${ar},0.22) 0%, transparent 50%)` }} />
    </>
  );
}

// ── Navegación cósmica ────────────────────────────────────────────────────────
function CosmicNav({ pathname }: { pathname: string }) {
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

  return (
    <div style={{ minHeight: "100vh", background: "#030208", paddingBottom: 100, color: "#fff" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <GalaxyHero
        avatarInitial={avatarInitial}
        avatarUrl={profile?.avatar_url}
        firstName={profile?.first_name ?? ""}
        lastName={profile?.last_name ?? ""}
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
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
              <TreePine size={13} style={{ color: "#d4af37" }} />
              <span style={{ fontSize: 17, fontWeight: 700, color: "#d4af37", letterSpacing: 2 }}>CEIBA</span>
              <span style={{ fontSize: 11, color: "#f0d060" }}>✦</span>
            </div>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.22em",
              color: "rgba(212,175,55,0.45)", textTransform: "uppercase", marginTop: 1 }}>
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

      {/* Chips de estadísticas 3D */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center",
        padding: "0 20px 20px", position: "relative", zIndex: 5,
        marginTop: -8,
        background: "linear-gradient(to bottom, rgba(6,3,24,0.6) 0%, transparent 100%)" }}>
        <div style={s3dChip()}>
          <Users size={12} style={{ color: "#d4af37" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            {visibleCount} familiares
          </span>
        </div>
        <div style={s3dChip()}>
          <GitBranch size={12} style={{ color: "#d4af37" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            {events.length} momentos
          </span>
        </div>
        <div style={s3dChip()}>
          <ImageIcon size={12} style={{ color: "#d4af37" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            {photos.length} fotos
          </span>
        </div>
      </div>

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

      {/* Divisor dorado */}
      <div style={{ height: 0.5,
        background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent)",
        margin: "0 20px" }} />

      {/* ── FUNCIONES ────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#d4af37", letterSpacing: "0.1em",
            textTransform: "uppercase" }}>Descubre tu historia</span>
          <span style={{ fontSize: 10, color: "rgba(212,175,55,0.42)" }}>Ver todo →</span>
        </div>

        {/* Grid 2×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>

          {/* Mi Árbol — verde */}
          <Link href="/tree">
            <div style={{ ...s3dCard("#071410","70,200,100","#020704"), minHeight: 110 }}>
              <CardShine ar="70,200,100" />
              <div style={{ padding: "12px 12px 10px", position: "relative" }}>
                <div style={s3dIcon("#091c12","70,200,100","#020704")}>
                  <TreePine size={19} style={{ color: "#50d070" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Mi Árbol</div>
                <div style={{ fontSize: 10, color: "rgba(70,200,100,0.65)" }}>{visibleCount} familiares</div>
              </div>
            </div>
          </Link>

          {/* Álbum Familiar — ámbar */}
          <Link href="/photos">
            <div style={{ ...s3dCard("#160c02","220,140,40","#060300"), minHeight: 110 }}>
              <CardShine ar="220,140,40" />
              <div style={{ padding: "12px 12px 10px", position: "relative" }}>
                <div style={s3dIcon("#1a1004","220,140,40","#060300")}>
                  <Camera size={19} style={{ color: "#dc9030" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Álbum Familiar</div>
                <div style={{ fontSize: 10, color: "rgba(220,140,40,0.7)" }}>{photos.length} recuerdos</div>
              </div>
            </div>
          </Link>

          {/* Historia Familiar — púrpura */}
          <Link href="/events">
            <div style={{ ...s3dCard("#0e0618","160,80,240","#050310"), minHeight: 110 }}>
              <CardShine ar="160,80,240" />
              <div style={{ padding: "12px 12px 10px", position: "relative" }}>
                <div style={s3dIcon("#120820","160,80,240","#060412")}>
                  <BookOpen size={19} style={{ color: "#a050f0" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Historia Familiar</div>
                <div style={{ fontSize: 10, color: "rgba(160,80,240,0.7)" }}>{events.length} momentos</div>
              </div>
            </div>
          </Link>

          {/* Cumpleaños — rosa */}
          <Link href="/feed">
            <div style={{ ...s3dCard("#160208","220,60,120","#050102"), minHeight: 110 }}>
              <CardShine ar="220,60,120" />
              <div style={{ padding: "12px 12px 10px", position: "relative" }}>
                <div style={s3dIcon("#1c0610","220,60,120","#080104")}>
                  <Cake size={19} style={{ color: "#dc3c78" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Cumpleaños</div>
                <div style={{ fontSize: 10, color: "rgba(220,60,120,0.7)" }}>
                  {allBirthdays.filter(b => b.days <= 30).length} próximos
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Mensajes — ancho completo, índigo */}
        <Link href="/chat">
          <div style={{ ...s3dCard("#04050f","100,120,240","#010108"), marginBottom: 9 }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(100,120,240,0.38)" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: "#060718",
                borderTop: "1.5px solid rgba(100,120,240,0.48)", borderBottom: "2px solid #010108",
                borderLeft: "1px solid rgba(100,120,240,0.2)", borderRight: "1px solid rgba(0,0,0,0.55)",
                boxShadow: "0 4px 0 #010108, 0 6px 10px rgba(0,0,0,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageCircle size={19} style={{ color: "#6478f0" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Mensajes familiares</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {onlineFamily.length > 0 && (
                    <>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
                        animation: "home-online-pulse 2s infinite" }} />
                      <span style={{ fontSize: 10, color: "rgba(34,197,94,0.7)" }}>
                        {onlineFamily.length} familiar{onlineFamily.length > 1 ? "es" : ""} en línea
                      </span>
                    </>
                  )}
                  {onlineFamily.length === 0 && (
                    <span style={{ fontSize: 10, color: "rgba(100,120,240,0.6)" }}>Chat privado familiar</span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(100,120,240,0.5)" }} />
            </div>
          </div>
        </Link>

        {/* Mapa familiar — ancho completo, cian */}
        <Link href="/mapa">
          <div style={{ ...s3dCard("#021416","40,200,200","#000a0a"), marginBottom: 9 }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(40,200,200,0.38)" }} />
            <div style={{ position: "absolute", top: -10, right: -10, width: 80, height: 80,
              borderRadius: "50%", background: "radial-gradient(circle,rgba(40,200,200,0.16) 0%,transparent 70%)",
              pointerEvents: "none" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: "#041a1a",
                borderTop: "1.5px solid rgba(40,200,200,0.48)", borderBottom: "2px solid #000a0a",
                borderLeft: "1px solid rgba(40,200,200,0.2)", borderRight: "1px solid rgba(0,0,0,0.55)",
                boxShadow: "0 4px 0 #000a0a, 0 6px 10px rgba(0,0,0,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Map size={19} style={{ color: "#28c8c8" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Mapa familiar</div>
                <div style={{ fontSize: 10, color: "rgba(40,200,200,0.6)" }}>
                  De dónde venimos · ciudades de origen
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(40,200,200,0.45)" }} />
            </div>
          </div>
        </Link>

        {/* Invitar — ancho completo, azul */}
        <Link href="/invitar">
          <div style={{ ...s3dCard("#040616","60,120,240","#010208"), marginBottom: 9 }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(60,120,240,0.38)" }} />
            <div style={{ position: "absolute", top: -8, right: -8, width: 70, height: 70,
              borderRadius: "50%", background: "radial-gradient(circle,rgba(60,120,240,0.22) 0%,transparent 70%)",
              pointerEvents: "none" }} />
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
              <div style={{ ...s3dIcon("#06081c","60,120,240","#010210"), marginBottom: 0, width: 40, height: 40, borderRadius: 13 }}>
                <Send size={19} style={{ color: "#4080f0" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Invitar a mi familia</div>
                <div style={{ fontSize: 10, color: "rgba(60,120,240,0.65)" }}>Haz crecer tu árbol familiar</div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(60,120,240,0.5)" }} />
            </div>
          </div>
        </Link>

        {/* ── Coincidencias familiares ──────────────────────────────────── */}
        {suggestions.filter(s => !dismissedIds.has(s.id)).length > 0 && (
          <div style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9, paddingTop: 6 }}>
              <Sparkles size={12} style={{ color: "#64c878" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(100,200,120,0.75)",
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
                    borderRadius: 18, background: "#050e07", position: "relative", overflow: "hidden",
                    borderTop: "1.5px solid rgba(100,200,120,0.35)", borderLeft: "1px solid rgba(100,200,120,0.15)",
                    borderBottom: "3px solid #000c04", borderRight: "1px solid rgba(0,0,0,0.6)",
                    boxShadow: "0 7px 0 #000c04, 0 12px 22px rgba(0,0,0,0.85), 0 0 18px rgba(100,200,120,0.07)",
                    padding: "13px 13px 11px",
                  }}>
                    <div style={{ position: "absolute", top: 0, left: "18%", right: "18%",
                      height: 1, background: "rgba(100,200,120,0.4)" }} />

                    {/* header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                      <Sparkles size={12} style={{ color: "#64c878" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.11em",
                        textTransform: "uppercase", color: "rgba(100,200,120,0.65)", flex: 1 }}>
                        Posible conexión
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64c878",
                        background: "rgba(100,200,120,0.12)", padding: "2px 8px", borderRadius: 20 }}>
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
                              background: "rgba(100,200,120,0.12)", border: "1px dashed rgba(100,200,120,0.4)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 800, color: "rgba(100,200,120,0.55)" }}>?</div>
                          )}
                          <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "rgba(100,200,120,0.14)", border: "1.5px solid rgba(100,200,120,0.35)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, color: "#64c878" }}>
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
                        <span style={{ color: "#64c878", fontWeight: 600 }}>{top.detail}</span>
                        {s.evidence.length > 1 && (
                          <span style={{ color: "rgba(100,200,120,0.4)" }}> +{s.evidence.length - 1} más</span>
                        )}
                      </p>
                    )}

                    {/* acciones */}
                    <div style={{ display: "flex", gap: 7 }}>
                      <Link href={`/sugerencias/${s.id}`} style={{ textDecoration: "none", flex: 1 }}>
                        <button style={{ width: "100%", padding: "8px 0", borderRadius: 10, cursor: "pointer",
                          background: "#18a836", border: "none",
                          borderTop: "1.5px solid rgba(100,230,130,0.5)", borderBottom: "2.5px solid #0a5c1c",
                          boxShadow: "0 5px 0 #073d13, 0 8px 16px rgba(0,0,0,0.6)",
                          color: "#fff", fontSize: 12, fontWeight: 700 }}>
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
                  <div style={{ width: "60%", height: "100%", background: "#d4af37", borderRadius: 100,
                    boxShadow: "0 0 8px rgba(212,175,55,0.6)" }} />
                </div>
              </div>
              <Trophy size={33} style={{ color: "#d4af37", flexShrink: 0 }} />
            </div>
          </div>
        </Link>
      </div>

      {/* Navegación inferior cósmica */}
      <CosmicNav pathname={pathname ?? "/home"} />
    </div>
  );
}
