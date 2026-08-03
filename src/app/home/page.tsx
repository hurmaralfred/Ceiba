"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, TreePine, BookOpen, Camera, User, Bell, Menu,
  Users, GitBranch, Image as ImageIcon, Gift, Send,
  Trophy, ChevronRight, Cake, Sparkles, X, MessageCircle,
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

// ── Campo de estrellas ────────────────────────────────────────────────────────
function StarField() {
  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="16"  cy="20"  r="0.8" fill="white" opacity="0.7"/>
      <circle cx="306" cy="16"  r="0.7" fill="white" opacity="0.55"/>
      <circle cx="10"  cy="82"  r="0.9" fill="white" opacity="0.45"/>
      <circle cx="320" cy="58"  r="0.8" fill="white" opacity="0.6"/>
      <circle cx="36"  cy="150" r="0.7" fill="white" opacity="0.4"/>
      <circle cx="302" cy="138" r="0.9" fill="white" opacity="0.5"/>
      <circle cx="60"  cy="26"  r="0.6" fill="white" opacity="0.45"/>
      <circle cx="270" cy="30"  r="0.7" fill="white" opacity="0.5"/>
      <circle cx="42"  cy="105" r="0.8" fill="white" opacity="0.38"/>
      <circle cx="280" cy="100" r="0.6" fill="white" opacity="0.42"/>
      <circle cx="18"  cy="196" r="0.7" fill="white" opacity="0.45"/>
      <circle cx="312" cy="188" r="0.8" fill="white" opacity="0.55"/>
      <circle cx="154" cy="15"  r="1.2" fill="#d4af37" opacity="0.95"/>
      <circle cx="94"  cy="12"  r="1"   fill="#d4af37" opacity="0.85"/>
      <circle cx="232" cy="20"  r="1"   fill="#d4af37" opacity="0.8"/>
      <circle cx="114" cy="50"  r="0.9" fill="#f0d060" opacity="0.9"/>
      <circle cx="214" cy="46"  r="0.8" fill="#f0d060" opacity="0.85"/>
      <circle cx="70"  cy="130" r="1"   fill="#d4af37" opacity="0.7"/>
      <circle cx="254" cy="124" r="0.9" fill="#d4af37" opacity="0.72"/>
      <circle cx="130" cy="190" r="0.8" fill="#d4af37" opacity="0.75"/>
      <circle cx="200" cy="184" r="0.9" fill="#d4af37" opacity="0.7"/>
      <circle cx="30"  cy="48"  r="1.4" fill="white"   opacity="0.82"/>
      <circle cx="304" cy="42"  r="1.3" fill="white"   opacity="0.78"/>
      <line x1="30"  y1="45" x2="30"  y2="51" stroke="white"   strokeWidth="0.4" opacity="0.6"/>
      <line x1="27"  y1="48" x2="33"  y2="48" stroke="white"   strokeWidth="0.4" opacity="0.6"/>
      <line x1="304" y1="39" x2="304" y2="45" stroke="white"   strokeWidth="0.4" opacity="0.55"/>
      <line x1="301" y1="42" x2="307" y2="42" stroke="white"   strokeWidth="0.4" opacity="0.55"/>
      <line x1="154" y1="12" x2="154" y2="18" stroke="#d4af37" strokeWidth="0.5" opacity="0.7"/>
      <line x1="151" y1="15" x2="157" y2="15" stroke="#d4af37" strokeWidth="0.5" opacity="0.7"/>
    </svg>
  );
}

// ── Orbe nebulosa ─────────────────────────────────────────────────────────────
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
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: 28, textAlign: "center" }}>
        {/* Nebulas */}
        <NebulaOrb top={-40} left={-50}   color="rgba(110,40,220,0.12)" size={240} />
        <NebulaOrb top={-30} right={-40}  color="rgba(30,70,220,0.1)"  size={220} />
        <NebulaOrb top={60}  left={undefined} color="rgba(212,175,55,0.11)" size={300} />
        {/* Estrellas */}
        <StarField />

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

        {/* Avatar con anillo cósmico */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 15, zIndex: 5 }}>
          {/* Halo difuminado exterior */}
          <div style={{ position: "absolute", inset: -14, borderRadius: "50%", filter: "blur(7px)",
            background: "conic-gradient(from 0deg,rgba(212,175,55,0.35),rgba(130,60,230,0.3),rgba(40,80,230,0.25),rgba(40,210,190,0.2),rgba(212,175,55,0.35))" }} />
          {/* Anillo cónico nítido */}
          <div style={{ position: "absolute", inset: -5, borderRadius: "50%",
            background: "conic-gradient(from 15deg,#d4af37 0%,#f5e070 16%,#8a6012 32%,#6030b0 48%,#2044c0 64%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)" }} />
          {/* Gap de separación */}
          <div style={{ position: "absolute", inset: -1, borderRadius: "50%", background: "#030208" }} />
          {/* Cuerpo del avatar */}
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#0c0a18",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2,
            borderTop: "1px solid rgba(212,175,55,0.15)",
            boxShadow: "inset 0 2px 20px rgba(120,60,220,0.2), inset 0 -2px 10px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 28%,rgba(212,175,55,0.14) 0%,transparent 60%)" }} />
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={firstName}
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", position: "relative" }} />
            ) : (
              <span style={{ fontSize: 38, color: "#d4af37", fontWeight: 800, position: "relative" }}>
                {avatarInitial}
              </span>
            )}
          </div>
        </div>

        {/* Nombre y tagline */}
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: 0.5, marginBottom: 3,
          position: "relative", zIndex: 5 }}>
          {profile ? `${profile.first_name} ${profile.last_name}` : "Cargando..."}
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(212,175,55,0.65)", fontStyle: "italic",
          marginBottom: 18, position: "relative", zIndex: 5, letterSpacing: "0.03em" }}>
          Guardiana de la memoria familiar
        </div>

        {/* Chips de estadísticas 3D */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center",
          padding: "0 20px", position: "relative", zIndex: 5 }}>
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
