"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { getDiceBearUrl } from "@/lib/dicebear";
import {
  Sparkles, BookOpen, Bell, Menu,
  Users, Send,
  Trophy, CalendarDays, X, MessageCircle, Map, Lock,
} from "lucide-react";
import BirthdayCardFeed from "@/components/BirthdayCardFeed";
import PulseDiario from "@/components/PulseDiario";
import ActividadFamiliar from "@/components/ActividadFamiliar";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { useFamilyNotifications } from "@/hooks/useFamilyNotifications";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import type { Profile, FamilyMember } from "@/lib/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FeedBirthday {
  person_id: string; first_name: string; last_name: string; birth_date: string;
  is_deceased?: boolean; age_would_be?: number;
}
interface DeceasedWithoutDate {
  person_id: string; first_name: string; last_name: string;
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

// ── Helpers de estilo Linaje ──────────────────────────────────────────────────
function linCard(): React.CSSProperties {
  return {
    borderRadius: 16, background: "#FDFCFA", position: "relative", overflow: "hidden",
    border: "1px solid #DDD8CF",
    boxShadow: "0 2px 8px rgba(30,46,74,0.07), 0 1px 2px rgba(30,46,74,0.04)",
    transition: "box-shadow 0.15s ease",
  };
}
function linCardNavy(): React.CSSProperties {
  return {
    borderRadius: 16, background: "#1E2E4A", position: "relative", overflow: "hidden",
    border: "1px solid #162338",
    boxShadow: "0 4px 16px rgba(30,46,74,0.20), 0 1px 4px rgba(30,46,74,0.12)",
  };
}
function linIcon(color: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10, background: color, flexShrink: 0,
    boxShadow: "0 2px 6px rgba(30,46,74,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
  };
}
function linChip(active = false): React.CSSProperties {
  return {
    background: active ? "rgba(200,136,42,0.10)" : "#F4F1EC",
    border: active ? "1px solid rgba(200,136,42,0.30)" : "1px solid #DDD8CF",
    borderRadius: 100, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5,
    fontSize: 10, color: active ? "#C8882A" : "#6B6258", fontWeight: 600,
  };
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function parseBDParts(s: string): [number, number] {
  // "YYYY-MM-DD" → [month 0-indexed, day]
  // Never use new Date(s) for month/day: YYYY-MM-DD parses as UTC midnight,
  // which shifts the date back one day in UTC-5 (Colombia/Bogotá).
  const parts = s.split("-");
  return [+parts[1] - 1, +parts[2]];
}

function daysUntil(birth_date: string): number {
  const today = new Date();
  const [bm, bd] = parseBDParts(birth_date);
  if (bm === today.getMonth() && bd === today.getDate()) return 0;
  const next = new Date(today.getFullYear(), bm, bd);
  if (next <= today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
        textTransform: "uppercase", color: "#9A9084", marginBottom: 14 }}>
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
                background: "#F4F1EC",
                border: "2px solid #DDD8CF",
                boxShadow: "0 2px 8px rgba(30,46,74,0.10)",
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt={g.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#6B6258" }}>{g.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#C8882A" }}>{g.count}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LinajeHero({ children, avatarInitial, avatarUrl, firstName }: {
  children: React.ReactNode;
  avatarInitial: string;
  avatarUrl?: string | null;
  firstName: string;
}) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", paddingBottom: 8, textAlign: "center",
      background: "#1E2E4A",
    }}>
      {/* Subtle warm overlay */}
      <div style={{ position:"absolute", top:0, right:0, width:200, height:200, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(circle,rgba(200,136,42,0.12) 0%,transparent 70%)" }} />
      <div style={{ position:"absolute", bottom:0, left:0, width:160, height:160, borderRadius:"50%", pointerEvents:"none",
        background:"radial-gradient(circle,rgba(122,140,110,0.10) 0%,transparent 70%)" }} />


      {/* Top bar */}
      {children}

      {/* Avatar — centrado */}
      <div style={{ position:"relative", width:"100%", display:"flex",
        justifyContent:"center", marginBottom:10, zIndex:5 }}>

        <div style={{ position:"relative", display:"inline-block", flexShrink:0 }}>

        {/* Avatar ring — decorative */}
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
          {/* Subtle ring — Linaje */}
          <circle cx="150" cy="150" r="58" fill="none" stroke="rgba(200,136,42,0.30)" strokeWidth="1"/>
          <circle cx="150" cy="150" r="66" fill="none" stroke="rgba(200,136,42,0.12)" strokeWidth="0.6"/>
        </svg>

        {/* Avatar */}
        <div style={{ position:"relative", width:90, height:90, zIndex:2 }}>
          <div style={{
            width:90, height:90, borderRadius:"50%",
            background:"rgba(255,255,255,0.12)",
            border: "3px solid rgba(200,136,42,0.55)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 20px rgba(0,0,0,0.25)",
          }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={firstName}
                style={{ width:90, height:90, borderRadius:"50%", objectFit:"cover" }} />
            ) : (
              <span style={{ fontSize:36, color:"#C8882A", fontWeight:800 }}>
                {avatarInitial}
              </span>
            )}
          </div>
        </div>
        </div>{/* /center */}

      </div>{/* /avatar row */}

      {/* Name */}
      <div style={{ fontSize:22, fontWeight:700, color:"#FDFCFA", letterSpacing:0.2, marginBottom:4,
        position:"relative", zIndex:5, fontFamily:"var(--font-fraunces), Georgia, serif" }}>
        {firstName || "Cargando..."}
      </div>

      {/* Tagline */}
      <div style={{ fontSize:11, color:"rgba(200,136,42,0.80)",
        marginBottom:14, position:"relative", zIndex:5, letterSpacing:"0.06em", fontWeight:500 }}>
        Tu linaje familiar
      </div>

      {/* Bottom breathing room */}
      <div style={{ height: 12 }} />

    </div>
  );
}

// ── Botón de acción rápida — Linaje ──────────────────────────────────────────
function LinajeBtn({ icon: Icon, label, href, accent = false, badge = 0 }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string; href: string;
  accent?: boolean;
  badge?: number;
}) {
  return (
    <Link href={href} style={{ display:"flex", flexDirection:"column", alignItems:"center",
      gap:6, flexShrink:0, textDecoration:"none" }}>
      <div style={{ position:"relative" }}>
        {badge > 0 && (
          <div style={{
            position:"absolute", top:-4, right:-4, zIndex:10,
            minWidth:16, height:16, borderRadius:8,
            background:"#ef4444", color:"#fff",
            fontSize:9, fontWeight:800, lineHeight:1,
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"0 4px",
            border:"1.5px solid #FDFCFA",
          }}>
            {badge > 99 ? "99+" : badge}
          </div>
        )}
        <div style={{
          width:56, height:56, borderRadius:16,
          background: accent ? "#C8882A" : "#FDFCFA",
          border: accent ? "1px solid #A56B1A" : "1px solid #DDD8CF",
          boxShadow: accent
            ? "0 4px 12px rgba(200,136,42,0.25)"
            : "0 2px 8px rgba(30,46,74,0.09)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"transform 0.12s ease",
        }}>
          <Icon size={22} style={{ color: accent ? "#fff" : "#1E2E4A" }}/>
        </div>
      </div>
      <span style={{ fontSize:10, fontWeight:500, color:"#6B6258",
        textAlign:"center", lineHeight:1.3, maxWidth:56, whiteSpace:"pre-line" }}>
        {label}
      </span>
    </Link>
  );
}


// ── Página principal ──────────────────────────────────────────────────────────
export default function HomePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [members,      setMembers]      = useState<FamilyMember[]>([]);
  const [allGenSpan,   setAllGenSpan]   = useState(1);
  const [visibleCount, setVisibleCount] = useState(0);
  const [birthdays,    setBirthdays]    = useState<FeedBirthday[]>([]);
  const [deceasedWithoutDate, setDeceasedWithoutDate] = useState<DeceasedWithoutDate[]>([]);
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
  const [dailyQuestion, setDailyQuestion] = useState<string | null>(null);
  const [answerOpen,    setAnswerOpen]    = useState(false);
  const [answerText,    setAnswerText]    = useState("");
  const [answerSent,    setAnswerSent]    = useState(false);
  const [answerBusy,    setAnswerBusy]    = useState(false);


  const load = useCallback(async () => {
    let user: any;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) { router.push("/auth/login"); return; }
      user = data.user;
    } catch {
      router.push("/auth/login");
      return;
    }
    if (!user) { router.push("/auth/login"); return; }
    setMyUserId(user.id);

    // Redirigir si hay datos sin confirmar (persona agregada por otro)
    const statusRes = await fetch("/api/profile/data-status");
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status.needsConfirmation) { router.replace("/confirmar-datos"); return; }
    }

    const [graphRes, feedRes, sugRes, rosterRes, eventsRes, chatRes, capsulasRes, questionRes] = await Promise.allSettled([
      supabase.rpc("get_my_family_graph", { p_depth: 4 }),
      fetch("/api/feed?birthdayDays=365"),
      fetch("/api/suggestions"),
      fetch("/api/family/roster"),
      fetch("/api/events"),
      fetch("/api/chat/rooms"),
      fetch("/api/capsulas"),
      fetch("/api/pregunta-del-dia"),
    ]);

    if (graphRes.status === "fulfilled" && !graphRes.value.error) {
      const graph = graphRes.value.data as FamilyGraph | null;
      if (graph?.me) {
        const { profile: p, members: m, extendedMembers: em } = adaptGraph(graph, user.id);
        setProfile(p);
        setMembers(m);
        setVisibleCount(buildVisibleMembers(m, em).length);
        const allGens = [
          ...m.map(x => x.generation ?? 0),
          ...em.map(x => x.member.generation ?? 0),
          0,
        ];
        setAllGenSpan(Math.max(...allGens) - Math.min(...allGens) + 1);
      }
    }

    if (feedRes.status === "fulfilled") {
      try {
        const res = feedRes.value;
        if (res.ok) {
          const data = await res.json();
          setBirthdays((data.birthdays || []).slice(0, 10));
          setDeceasedWithoutDate(data.deceasedWithoutDate || []);
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

    if (questionRes.status === "fulfilled") {
      try {
        const res = questionRes.value;
        if (res.ok) {
          const { question } = await res.json();
          if (question) setDailyQuestion(question);
        }
      } catch {}
    }
  }, [router, supabase]);

  const handleDismiss = useCallback(async (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
  }, []);

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!answerText.trim() || answerBusy) return;
    setAnswerBusy(true);
    try {
      const r = await fetch("/api/muro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: answerText.trim(), question_text: dailyQuestion ?? undefined }),
      });
      if (!r.ok) throw new Error("Error al guardar respuesta");
      setAnswerText("");
      setAnswerSent(true);
      setAnswerOpen(false);
    } catch (err: any) {
      const { toast } = await import("react-hot-toast");
      toast.error(err?.message || "No se pudo enviar la respuesta");
    } finally {
      setAnswerBusy(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  const [greetBusy, setGreetBusy] = useState(false);
  async function greetPerson(personId: string) {
    const userId = rosterPersonMap[personId];
    if (!userId) { router.push("/chat"); return; }
    if (greetBusy) return;
    setGreetBusy(true);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });
      const body = await res.json();
      router.push(`/chat/${body.roomId}`);
    } catch {
      router.push("/chat");
    } finally {
      setGreetBusy(false);
    }
  }

  // ── Datos derivados ───────────────────────────────────────────────────────
  const rosterUserIds = roster.map(m => m.user_id);
  const onlineIds = useFamilyPresence(myUserId, rosterUserIds);
  const onlineFamily = roster.filter(m => onlineIds.has(m.user_id));

  const allBirthdays: BirthdayWithDays[] = birthdays.map(b => ({ ...b, days: daysUntil(b.birth_date) }));
  // Notificaciones en tiempo real (cumpleaños + nuevas historias/recuerdos)
  useFamilyNotifications(myUserId, allBirthdays);
  const liveBirthdays    = allBirthdays.filter(b => !b.is_deceased);
  const todayBirthday    = liveBirthdays.find(b => b.days === 0) ?? null;
  const upcomingBirthday = !todayBirthday
    ? liveBirthdays.filter(b => b.days > 0).sort((a, b) => a.days - b.days)[0] ?? null
    : null;
  // Fallecidos: solo mostrar si HOY es exactamente su cumpleaños
  const deceasedBirthday = allBirthdays
    .find(b => b.is_deceased && b.days === 0) ?? null;

  // Rotate daily through deceased members with no known birth date
  const dailyDeceasedQuestion = deceasedWithoutDate.length > 0
    ? deceasedWithoutDate[Math.floor(Date.now() / 86400000) % deceasedWithoutDate.length]
    : null;

  // Map person_id → user_id para identificar usuarios registrados en el feed de cumpleaños
  const rosterPersonIds = new Set(roster.map(m => m.person_id));
  const rosterPersonMap: Record<string, string> = Object.fromEntries(roster.map(m => [m.person_id, m.user_id]));
  const firstName = profile?.first_name ?? "";
  const avatarInitial = firstName[0]?.toUpperCase() ?? "?";


  // Stats — invitan a explorar, no describen el vacío
  const birthdaysThisMonth = allBirthdays.filter(b => b.days > 0 && b.days <= 30).length;
  const historyCount = allEvents.length;
  const activeCount  = roster.length;
  const generationsCount = allGenSpan;
  const recentMemories = [
    ...photos.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 7 * 86_400_000),
    ...events.filter(e => (Date.now() - new Date(e.created_at).getTime()) < 7 * 86_400_000),
  ].length;


  return (
    <div style={{ minHeight: "100vh", background: "#F4F1EC", paddingBottom: 100, color: "#1A1612", position: "relative" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <LinajeHero
        avatarInitial={avatarInitial}
        avatarUrl={profile?.avatar_url ?? getDiceBearUrl(profile?.first_name ?? 'user')}
        firstName={profile?.first_name ?? ""}
      >
        {/* Barra de navegación superior */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "50px 20px 20px", position: "relative", zIndex: 5 }}>
          <Link href="/settings">
            <div style={{ width: 36, height: 36, borderRadius: 11,
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Menu size={18} style={{ color: "rgba(255,255,255,0.80)" }} />
            </div>
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#FDFCFA", letterSpacing: 2,
                fontFamily: "var(--font-fraunces), Georgia, serif" }}>CEIBA</span>
            </div>
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.20em",
              color: "rgba(200,136,42,0.70)", textTransform: "uppercase", marginTop: 2, textAlign: "center" }}>
              Nuestras raíces
            </div>
          </div>
          <Link href="/feed">
            <div style={{ position: "relative", width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} style={{ color: "rgba(255,255,255,0.80)" }} />
              {suggestions.filter(s => !dismissedIds.has(s.id)).length > 0 && (
                <div style={{
                  position: "absolute", top: -3, right: -3,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "#C8882A", border: "1.5px solid #1E2E4A",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1,
                }}>
                  {suggestions.filter(s => !dismissedIds.has(s.id)).length}
                </div>
              )}
            </div>
          </Link>
        </div>
      </LinajeHero>

      {/* ── PULSO CHIPS ─────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:8, padding:"12px 18px 4px", flexWrap:"wrap" }}>
        {recentMemories > 0 && (
          <span style={{ background:"#FDFCFA", border:"1px solid #DDD8CF",
            borderRadius:20, padding:"5px 12px", fontSize:10, color:"#6B6258", fontWeight:600 }}>
            {recentMemories} recuerdos esta semana
          </span>
        )}
        {!todayBirthday && birthdaysThisMonth > 0 && (
          <span style={{ background:"rgba(200,136,42,0.08)", border:"1px solid rgba(200,136,42,0.22)",
            borderRadius:20, padding:"5px 12px", fontSize:10, color:"#C8882A", fontWeight:600 }}>
            🎂 {birthdaysThisMonth} cumpleaños este mes
          </span>
        )}
      </div>

      {/* Divisor */}
      <div style={{ margin: "16px 16px 0", height: 1,
        background: "linear-gradient(90deg, transparent, #DDD8CF, transparent)" }} />

      {/* ══ MOMENTO DEL DÍA ══════════════════════════════════════════════ */}
      <div style={{ padding: "14px 14px 0" }}>

        {/* — Caso A: Cumpleaños HOY — card dominante */}
        {todayBirthday && (
          <div style={{
            ...linCardNavy(),
            minHeight: 180,
          }}>
            {/* Acento warm top */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
              background:"linear-gradient(90deg,#C8882A,rgba(200,136,42,0.3))", borderRadius:"16px 16px 0 0" }} />
            <div style={{ position:"absolute", top:14, right:14,
              background:"rgba(200,136,42,0.15)", border:"1px solid rgba(200,136,42,0.35)",
              borderRadius:100, padding:"3px 10px",
              fontSize:9, fontWeight:800, letterSpacing:"0.14em", color:"#C8882A",
              textTransform:"uppercase" }}>Hoy</div>
            <div style={{ padding:"22px 20px 20px", position:"relative" }}>
              <div style={{ fontSize:48, lineHeight:1, marginBottom:12 }}>🎂</div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
                textTransform:"uppercase", color:"rgba(200,136,42,0.70)", marginBottom:6 }}>
                Cumpleaños de hoy
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:"#FDFCFA", lineHeight:1.1, marginBottom:6,
                fontFamily:"var(--font-fraunces), Georgia, serif" }}>
                {todayBirthday.first_name} {todayBirthday.last_name}
              </div>
              <div style={{ fontSize:13, color:"rgba(200,136,42,0.60)", marginBottom:20 }}>
                {new Date().getFullYear() - new Date(todayBirthday.birth_date).getFullYear()} años
              </div>
              <button
                onClick={() => greetPerson(todayBirthday.person_id)}
                disabled={greetBusy}
                style={{ display:"inline-flex", alignItems:"center", gap:8,
                  background:"#C8882A", color:"#fff", borderRadius:50,
                  padding:"12px 26px", fontSize:13, fontWeight:700,
                  border:"none", cursor:"pointer",
                  boxShadow:"0 4px 12px rgba(200,136,42,0.30)",
                  opacity:greetBusy ? 0.7 : 1 }}>
                {greetBusy ? "Abriendo chat…" : "🎉 Felicitar ahora"}
              </button>
            </div>
          </div>
        )}

        {/* — Caso C: Próximo cumpleaños — tira compacta */}
        {!todayBirthday && upcomingBirthday && (() => {
          const [ubm, ubd] = parseBDParts(upcomingBirthday.birth_date);
          const bdDate = new Date(
            new Date().getFullYear(), ubm, ubd
          ).toLocaleDateString("es", { day: "numeric", month: "long" });
          const isClose = upcomingBirthday.days <= 7;
          return (
            <div style={{
              ...linCard(),
              border: isClose ? "1px solid rgba(200,136,42,0.30)" : "1px solid #DDD8CF",
              padding: "13px 16px",
              display: "flex", alignItems: "center", gap: 13,
            }}>
              <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>
                {upcomingBirthday.days <= 3 ? "🎂" : "🎁"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1612",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {upcomingBirthday.first_name} {upcomingBirthday.last_name}
                </div>
                <div style={{ fontSize: 11, color: isClose ? "#C8882A" : "#9A9084", marginTop: 2 }}>
                  {upcomingBirthday.days === 1 ? "Mañana" : `En ${upcomingBirthday.days} días`}
                  {!isClose && ` · ${bdDate}`}
                </div>
              </div>
              <div style={{
                padding: "6px 12px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                background: isClose ? "rgba(200,136,42,0.10)" : "#F4F1EC",
                color: isClose ? "#C8882A" : "#9A9084",
                border: isClose ? "1px solid rgba(200,136,42,0.25)" : "1px solid #DDD8CF",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {upcomingBirthday.days === 1 ? "Mañana 🎂" : `${upcomingBirthday.days}d 🎁`}
              </div>
            </div>
          );
        })()}

        {/* — Caso Fallecido: hoy es el cumpleaños de alguien que ya no está — */}
        {deceasedBirthday && (
          <div style={{ ...linCard(), padding:"20px 20px 18px" }}>
            <div style={{ position:"absolute", top:14, right:14,
              background:"rgba(122,140,110,0.12)", border:"1px solid rgba(122,140,110,0.28)",
              borderRadius:100, padding:"3px 10px",
              fontSize:9, fontWeight:700, letterSpacing:"0.14em", color:"#7A8C6E",
              textTransform:"uppercase" }}>
              En su memoria
            </div>
            <div style={{ fontSize:36, lineHeight:1, marginBottom:10 }}>🕊️</div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"#7A8C6E", marginBottom:6 }}>
              Hoy en tu linaje
            </div>
            <div style={{ fontSize:18, fontWeight:700, color:"#1A1612", lineHeight:1.2, marginBottom:6,
              fontFamily:"var(--font-fraunces), Georgia, serif" }}>
              {deceasedBirthday.first_name} {deceasedBirthday.last_name}
            </div>
            <div style={{ fontSize:13, color:"#6B6258", lineHeight:1.5 }}>
              Hoy estaría cumpliendo {deceasedBirthday.age_would_be} años
            </div>
          </div>
        )}

        {/* — Caso D: sin cumpleaños registrados — invita a completar perfiles */}
        {!todayBirthday && !upcomingBirthday && !deceasedBirthday && (
          <div style={{ ...linCard(), padding:"20px 20px 18px" }}>
            <div style={{ fontSize:36, lineHeight:1, marginBottom:10 }}>🎂</div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"#7A8C6E", marginBottom:6 }}>
              Celebra a tu familia
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:"#1A1612", lineHeight:1.3, marginBottom:8,
              fontFamily:"var(--font-fraunces), Georgia, serif" }}>
              Agrega las fechas de nacimiento
            </div>
            <div style={{ fontSize:12, color:"#6B6258", lineHeight:1.5 }}>
              Con {visibleCount} familiares en tu linaje, habrá cumpleaños que celebrar cada semana.
            </div>
          </div>
        )}

      </div>

      {/* ── PREGUNTA DEL DÍA ─────────────────────────────────────────── */}
      <div style={{ padding:"16px 14px 0" }}>
        <div style={{ ...linCard(), padding:"16px" }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em",
            textTransform:"uppercase", color:"#9A9084", marginBottom:10 }}>
            Pregunta del día
          </div>
          <p style={{ fontSize:14, color:"#3D3428", fontStyle:"italic",
            margin:"0 0 14px", lineHeight:1.6, fontFamily:"var(--font-fraunces), Georgia, serif" }}>
            {dailyQuestion ?? "..."}
          </p>

          {/* ── Inline answer form ── */}
          {answerSent ? (
            <div style={{ marginBottom:10 }}>
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 14px", borderRadius:14,
                background:"rgba(122,140,110,0.10)",
                border:"1px solid rgba(122,140,110,0.25)",
              }}>
                <span style={{ fontSize:12, color:"#7A8C6E", fontWeight:700 }}>
                  ✓ Respuesta compartida con tu familia
                </span>
                <Link href="/muro" style={{
                  fontSize:11, color:"#C8882A",
                  textDecoration:"none", fontWeight:700,
                }}>
                  Ver muro →
                </Link>
              </div>
            </div>
          ) : answerOpen ? (
            <form onSubmit={submitAnswer} style={{ marginBottom:10 }}>
              <textarea
                autoFocus
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder="Comparte lo que sabes o recuerdas…"
                rows={3}
                style={{
                  width:"100%", boxSizing:"border-box",
                  background:"#F4F1EC",
                  border:"1px solid #DDD8CF",
                  borderRadius:12, padding:"10px 12px",
                  color:"#1A1612", fontSize:13, lineHeight:1.6,
                  fontFamily:"var(--font-fraunces), Georgia, serif", fontStyle:"italic",
                  resize:"none", outline:"none", caretColor:"#C8882A",
                  marginBottom:8,
                }}
              />
              <div style={{ display:"flex", gap:8 }}>
                <button type="button" onClick={() => { setAnswerOpen(false); setAnswerText(""); }}
                  style={{
                    flex:1, padding:"10px", borderRadius:50,
                    background:"transparent", border:"1px solid #DDD8CF",
                    color:"#9A9084", fontSize:12, fontWeight:600, cursor:"pointer",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={!answerText.trim() || answerBusy}
                  style={{
                    flex:2, padding:"10px", borderRadius:50,
                    background: answerText.trim() ? "#1E2E4A" : "#F4F1EC",
                    border: answerText.trim() ? "1px solid #162338" : "1px solid #DDD8CF",
                    color: answerText.trim() ? "#fff" : "#9A9084",
                    fontSize:12, fontWeight:700, cursor: answerText.trim() ? "pointer" : "default",
                    transition:"all 0.18s",
                  }}>
                  {answerBusy ? "Guardando…" : "Compartir con la familia"}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setAnswerOpen(true)}
                style={{
                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"10px", borderRadius:50, cursor:"pointer",
                  background:"#1E2E4A", fontFamily:"inherit",
                  border:"none",
                  color:"#fff", fontSize:12, fontWeight:600,
                }}>
                ✍️ Escribe tu respuesta
              </button>
              <Link href="/capsulas" style={{ textDecoration:"none", flex:1 }}>
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"10px", borderRadius:50,
                  background:"rgba(200,136,42,0.10)",
                  border:"1px solid rgba(200,136,42,0.25)",
                  color:"#C8882A", fontSize:12, fontWeight:600,
                }}>
                  🎥 Graba en video
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>


      {/* ── FAMILIA DIRECTA ─────────────────────────────────────────────── */}
      <FamilyRow members={members} />

      {/* ── EMPTY STATE — sin familia aún ──────────────────────────────── */}
      {profile !== null && members.length === 0 && visibleCount === 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ ...linCard(), padding:"22px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1612", marginBottom: 6,
              fontFamily:"var(--font-fraunces), Georgia, serif" }}>
              Tu linaje te está esperando
            </div>
            <div style={{ fontSize: 13, color: "#6B6258", lineHeight: 1.6, marginBottom: 18 }}>
              Agrega a tu primer familiar para comenzar a construir tu árbol genealógico.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/tree" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "13px 20px", borderRadius: 50,
                  background: "#1E2E4A",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  boxShadow: "0 4px 12px rgba(30,46,74,0.25)",
                }}>
                  <Users size={16} style={{ color: "#fff" }} />
                  Agregar mi primer familiar
                </div>
              </Link>
              <Link href="/invitar" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 20px", borderRadius: 14,
                  background: "rgba(200,136,42,0.08)",
                  border: "1px solid rgba(200,136,42,0.22)",
                  fontSize: 13, fontWeight: 600, color: "#C8882A",
                }}>
                  <Send size={14} style={{ color: "#C8882A" }} />
                  Invitar a un familiar
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── CTA PRINCIPAL ───────────────────────────────────────────────── */}
      {visibleCount > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 4px" }}>
          <Link href="/tree" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "#1E2E4A",
              border: "1px solid #162338",
              boxShadow: "0 4px 16px rgba(30,46,74,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={26} style={{ color: "rgba(200,136,42,0.90)" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9A9084",
              letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>
              Ver mi árbol
            </span>
          </Link>
        </div>
      )}

      {/* ── EN LÍNEA AHORA ──────────────────────────────────────────────── */}
      {onlineFamily.length > 0 && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E4DC" }}>
          <style>{`@keyframes home-online-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}`}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
              animation: "home-online-pulse 2s infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#7A8C6E" }}>En línea ahora</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {onlineFamily.slice(0, 6).map(m => (
              <Link key={m.user_id} href="/chat" style={{ textDecoration: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EDE9E1",
                    border: "2px solid rgba(34,197,94,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "#1E2E4A", overflow: "hidden" }}>
                    {m.photo_path
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : `${m.first_name[0] ?? ""}${(m.last_name || "")[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11,
                    borderRadius: "50%", background: "#22c55e", border: "2px solid #F4F1EC",
                    animation: "home-online-pulse 2s infinite" }} />
                </div>
                <span style={{ fontSize: 10, color: "#9A9084", fontWeight: 500,
                  maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "center" }}>{m.first_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ PULSO DIARIO — recuerdos del mismo día en años anteriores ═══ */}
      <div style={{ marginTop: 20 }}>
        <PulseDiario />
      </div>

      {/* ══ ACTIVIDAD FAMILIAR — últimas 24h ════════════════════════════ */}
      <div style={{ marginTop: 20 }}>
        <ActividadFamiliar />
      </div>

      {/* ══ ACCESOS RÁPIDOS ══════════════════════════════════════════════ */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#9A9084", marginBottom: 16 }}>
          Accesos rápidos
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px 8px", marginBottom: 22 }}>
          <LinajeBtn icon={CalendarDays}  label={"Un día\ncomo hoy"} href="/hoy"     />
          <LinajeBtn icon={Lock}          label="Cápsulas"           href="/capsulas" badge={pendingCapsulas} />
          <LinajeBtn icon={Map}           label="Mapa"               href="/mapa"     />
          <LinajeBtn icon={Send}          label="Invitar"            href="/invitar"  accent />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px 8px" }}>
          <LinajeBtn icon={MessageCircle} label="Chat"      href="/chat"    badge={unreadChats} />
          <LinajeBtn icon={BookOpen}      label="Recuerdos" href="/muro"    />
          <LinajeBtn icon={Trophy}        label="Logros"    href="/profile" />
        </div>
      </div>

      {/* ── GALERÍA FAMILIAR ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div style={{ padding: "20px 0 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#9A9084", marginBottom: 16, paddingLeft: 16 }}>
            Fotos de la familia
          </div>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 10,
            justifyContent: "center",
            paddingLeft: 16, paddingRight: 16, paddingBottom: 8,
          }}>
            {photos.map((photo, idx) => {
              const tilt = idx % 2 === 0 ? "rotate(-1.5deg)" : "rotate(1deg)";
              return (
                <div
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  style={{
                    width: 68, height: 68,
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    position: "relative",
                    transform: tilt,
                    border: "2px solid #FDFCFA",
                    boxShadow: "0 2px 8px rgba(30,46,74,0.14)",
                    flexShrink: 0,
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption ?? ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FUNCIONES ────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 14px 14px", position: "relative" }}>
        {/* ── Coincidencias familiares ──────────────────────────────────── */}
        {suggestions.filter(s => !dismissedIds.has(s.id)).length > 0 && (
          <div style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9, paddingTop: 6 }}>
              <Sparkles size={12} style={{ color: "#C8882A" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9A9084",
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
                  <div key={s.id} style={{ ...linCard(), padding:"13px 13px 11px" }}>
                    {/* header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                      <Sparkles size={12} style={{ color: "#C8882A" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.11em",
                        textTransform: "uppercase", color: "#9A9084", flex: 1 }}>
                        Posible conexión
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#C8882A",
                        background: "rgba(200,136,42,0.10)", padding: "2px 8px", borderRadius: 20 }}>
                        {pct}% coincidencia
                      </span>
                      <button onClick={() => handleDismiss(s.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2,
                          color: "#C8C0B2", lineHeight: 0, marginLeft: 2 }}>
                        <X size={14} />
                      </button>
                    </div>

                    {/* personas */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                      {[{ name: nameA, space: s.space_a?.name }, { name: nameB, space: s.space_b?.name }].map((p, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          {i === 1 && (
                            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                              background: "rgba(200,136,42,0.08)", border: "1px dashed rgba(200,136,42,0.30)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, color: "rgba(200,136,42,0.55)" }}>?</div>
                          )}
                          <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "#EAF0F8", border: "1.5px solid #DDD8CF",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "#1E2E4A" }}>
                            {p.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1612", margin: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                            {p.space && (
                              <p style={{ fontSize: 10, color: "#9A9084", margin: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.space}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* evidencia */}
                    {top && (
                      <p style={{ fontSize: 11, color: "#6B6258", margin: "0 0 10px" }}>
                        {EVIDENCE[top.type] || top.type}:&nbsp;
                        <span style={{ color: "#C8882A", fontWeight: 600 }}>{top.detail}</span>
                        {s.evidence.length > 1 && (
                          <span style={{ color: "rgba(200,136,42,0.45)" }}> +{s.evidence.length - 1} más</span>
                        )}
                      </p>
                    )}

                    {/* acciones */}
                    <div style={{ display: "flex", gap: 7 }}>
                      <Link href={`/sugerencias/${s.id}`} style={{ textDecoration: "none", flex: 1 }}>
                        <button style={{ width: "100%", padding: "10px 0", borderRadius: 50, cursor: "pointer",
                          background: "#1E2E4A", border: "none",
                          color: "#fff", fontSize: 12, fontWeight: 700 }}>
                          Ver y confirmar
                        </button>
                      </Link>
                      <button onClick={() => handleDismiss(s.id)}
                        style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                          background: "#F4F1EC", border: "1px solid #DDD8CF",
                          color: "#9A9084", fontSize: 12, fontWeight: 600 }}>
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
        <BirthdayCardFeed birthdays={allBirthdays} rosterPersonMap={rosterPersonMap} />

      </div>

      {/* ── MEMORIA VIVA — pregunta diaria sobre fallecido sin fecha ── */}
      {dailyDeceasedQuestion && (
        <div style={{ padding:"14px 14px 0" }}>
          <div style={{ ...linCard(), padding:"16px" }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"#7A8C6E", marginBottom:10 }}>
              🕊️ Memoria familiar
            </div>
            <p style={{ fontSize:14, color:"#3D3428", fontStyle:"italic",
              margin:"0 0 14px", lineHeight:1.6, fontFamily:"var(--font-fraunces), Georgia, serif" }}>
              ¿Quién sabe cuántos años tendría hoy{" "}
              <span style={{ color:"#1E2E4A", fontWeight:700 }}>
                {dailyDeceasedQuestion.first_name} {dailyDeceasedQuestion.last_name}
              </span>?
            </p>
            <Link href={`/persona/${dailyDeceasedQuestion.person_id}?compartir=true`} style={{ textDecoration:"none" }}>
              <div style={{
                display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
                padding:"10px 20px", borderRadius:50,
                background:"#1E2E4A",
                color:"#fff", fontSize:12, fontWeight:600,
              }}>
                Compartir lo que sabes →
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── INVITE CTA (condicional) ──────────────────────────────────── */}
      {members.length > 0 && members.length < 5 && (
        <div style={{ padding:"14px 14px 0" }}>
          <div style={{ ...linCard(),
            padding:"13px 14px",
            display:"flex", alignItems:"center", gap:12,
          }}>
            <span style={{ fontSize:28, flexShrink:0 }}>👥</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, color:"#1A1612", margin:"0 0 2px" }}>
                Invita a más familiares
              </p>
              <p style={{ fontSize:10, color:"#9A9084", margin:0 }}>
                Tu linaje tiene {visibleCount} personas — crécelo
              </p>
            </div>
            <Link href="/invitar" style={{ textDecoration:"none", flexShrink:0 }}>
              <div style={{
                padding:"9px 18px", borderRadius:50,
                background:"#C8882A",
                color:"#fff", fontSize:12, fontWeight:700,
                boxShadow:"0 4px 10px rgba(200,136,42,0.25)",
              }}>
                Invitar
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Navegación inferior */}
      <BottomNav />

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
