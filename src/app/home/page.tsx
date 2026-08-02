"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home, TreePine, Send, Camera, Settings, Bell,
  Users, Layers, BookOpen, Image as ImageIcon,
  ChevronRight, Calendar, Cake, UserPlus, Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import { parseGrowthStats, type CeibaGrowthStats } from "@/lib/growthStats";
import type { Profile, FamilyMember, RelationType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomNavigation, type NavItem } from "@/components/ui/BottomNavigation";
import GamificationWidget from "@/components/GamificationWidget";

// ── Tipos locales ───────────────────────────────────────────────────────────
interface FeedEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description: string | null;
}
interface FeedBirthday {
  person_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
}

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { href: "/home",     icon: Home,     label: "Inicio"  },
  { href: "/feed",     icon: Bell,     label: "Feed"    },
  { href: "/invitar",  icon: Send,     label: "Invitar", center: true },
  { href: "/photos",   icon: Camera,   label: "Fotos"   },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

// ── Utilidades ──────────────────────────────────────────────────────────────
function getGreeting(firstName: string) {
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const sub = h < 12 ? "Un buen momento para recordar a los tuyos" : h < 19 ? "Tu familia sigue creciendo" : "Recuerda a los que amas";
  return { saludo, sub, firstName };
}

function daysUntil(birth_date: string): number {
  const today = new Date();
  const bd = new Date(birth_date);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 365 ? 0 : diff;
}

function birthdayLabel(days: number, birth_date: string): string {
  if (days === 0) return "Hoy · cumpleaños";
  if (days === 1) return "Mañana · cumpleaños";
  const bd = new Date(birth_date);
  const month = bd.toLocaleDateString("es", { month: "short" });
  return `${bd.getDate()} ${month} · cumpleaños`;
}

function eventLabel(event_date: string, event_type: string): string {
  const d = new Date(event_date);
  const month = d.toLocaleDateString("es", { month: "short" });
  const typeLabel: Record<string, string> = {
    birth: "Nacimiento", marriage: "Matrimonio", graduation: "Graduación",
    reunion: "Reunión", anniversary: "Aniversario", death: "Fallecimiento", other: "Evento",
  };
  return `${d.getDate()} ${month} · ${typeLabel[event_type] ?? "Evento"}`;
}

function formatEventDate(d: string): string {
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  birth: "Nacimiento", marriage: "Matrimonio", graduation: "Graduación",
  reunion: "Reunión", anniversary: "Aniversario", death: "Fallecimiento", other: "Evento",
};

const STATUS_MSG: Record<number, string> = {
  0: "Comienza tu árbol familiar",
  1: "Tu familia da sus primeros pasos",
  2: "Tu familia empieza a conectarse",
  3: "Tu árbol está creciendo",
  4: "Tu árbol florece",
  5: "Tu árbol está completo",
};

// ── Anillo de progreso ──────────────────────────────────────────────────────
function ProgressRing({ score, total }: { score: number; total: number }) {
  const r = 68, circ = 2 * Math.PI * r;
  const dash = circ * (total > 0 ? score / total : 0);
  return (
    <svg width="152" height="152" viewBox="0 0 152 152" aria-hidden>
      <circle cx="76" cy="76" r={r} fill="none" stroke="#eedfc6" strokeWidth="7" />
      <circle cx="76" cy="76" r={r} fill="none"
        stroke="#c1603a" strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 76 76)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-cream-300 ${className}`} />;
}

// ── Página ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile]           = useState<Profile | null>(null);
  const [members, setMembers]           = useState<FamilyMember[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [growthStats, setGrowthStats]   = useState<CeibaGrowthStats | null>(null);
  const [events, setEvents]             = useState<FeedEvent[]>([]);
  const [birthdays, setBirthdays]       = useState<FeedBirthday[]>([]);
  const [photoCount, setPhotoCount]     = useState(0);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const [graphRes, statsRes, feedRes, eventsRes] = await Promise.allSettled([
      supabase.rpc("get_my_family_graph", { p_depth: 4 }),
      supabase.rpc("get_ceiba_growth_stats"),
      fetch("/api/feed"),
      fetch("/api/events"),
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

    if (statsRes.status === "fulfilled" && !statsRes.value.error) {
      setGrowthStats(parseGrowthStats(statsRes.value.data));
    }

    if (feedRes.status === "fulfilled") {
      try {
        const res = feedRes.value;
        if (res.ok) {
          const data = await res.json();
          setBirthdays((data.birthdays || []).slice(0, 5));
          setPhotoCount((data.photos || []).length);
        }
      } catch {}
    }

    if (eventsRes.status === "fulfilled") {
      try {
        const res = eventsRes.value;
        if (res.ok) {
          const data = await res.json();
          setEvents((data.events || []).slice(0, 6));
        }
      } catch {}
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Métricas derivadas ────────────────────────────────────────────────────
  const firstName = profile?.first_name ?? "";
  const { saludo, sub } = getGreeting(firstName || "tú");

  const PARENT_TYPES: RelationType[]  = ["father", "mother"];
  const PARTNER_TYPES: RelationType[] = ["spouse", "partner", "husband", "wife"];
  const CHILD_TYPES: RelationType[]   = ["son", "daughter"];
  const SIBLING_TYPES: RelationType[] = ["brother", "sister"];

  const score = [
    !!profile?.avatar_url,
    members.some(m => PARENT_TYPES.includes(m.relation_type as RelationType)),
    members.some(m => SIBLING_TYPES.includes(m.relation_type as RelationType)),
    members.some(m => PARTNER_TYPES.includes(m.relation_type as RelationType)),
    members.some(m => CHILD_TYPES.includes(m.relation_type as RelationType)),
  ].filter(Boolean).length;
  const total = 5;
  const statusMsg = STATUS_MSG[Math.min(score, 5)] ?? STATUS_MSG[3];

  const generations = members.length > 0
    ? Math.max(0, ...members.map(m => Math.abs(m.generation ?? 0))) + 1
    : 0;

  const STATS = [
    { icon: <Users size={20} className="text-earth-500"  />, value: visibleCount, label: "Familiares",    bg: "bg-earth-100", href: "/tree"   },
    { icon: <Layers size={20} className="text-ceiba-600" />, value: generations,  label: "Generaciones", bg: "bg-ceiba-100", href: "/tree"   },
    { icon: <BookOpen size={20} className="text-gold-500" />, value: events.length, label: "Historias",  bg: "bg-gold-100",  href: "/events" },
    { icon: <ImageIcon size={20} className="text-earth-400" />, value: photoCount, label: "Fotos",       bg: "bg-earth-50",  href: "/photos" },
  ];

  // Actividad: cumpleaños próximos + eventos recientes (máx 3 en total)
  const upcomingBirthdays = birthdays
    .map(b => ({ ...b, days: daysUntil(b.birth_date) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 2);

  const activityEvents = events.slice(0, Math.max(0, 3 - upcomingBirthdays.length));
  const featuredEvent = events[0] ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28"
      style={{ background: "linear-gradient(180deg, #ede3d0 0%, #f7edd9 28%, #fdf8f1 100%)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-cream-400/70"
        style={{ background: "rgba(253,248,241,0.92)" }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <TreePine size={19} className="text-ceiba-600" strokeWidth={2} />
            <span className="font-display font-bold text-title text-brown-800 tracking-tight">Ceiba</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/feed"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-300 transition-colors">
              <Bell size={19} className="text-brown-400" />
            </Link>
            {loading || !profile ? (
              <div className="w-9 h-9 rounded-full bg-cream-300 animate-pulse" />
            ) : (
              <Link href="/profile">
                <Avatar size="sm"
                  name={`${profile.first_name} ${profile.last_name}`}
                  src={profile.avatar_url ?? undefined}
                  ring ringColor="terra"
                />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 space-y-8 pt-6">

        {/* ── Saludo ─────────────────────────────────────────────────────── */}
        <section className="pt-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <>
              <p className="text-caption text-brown-400 font-medium mb-1"
                style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {saludo}
              </p>
              <h1 className="font-display font-bold text-brown-800"
                style={{ fontSize: "2.25rem", lineHeight: "1.08", letterSpacing: "-0.02em" }}>
                {firstName}
              </h1>
              <p className="text-body text-brown-500 mt-2">{sub}</p>
              {growthStats && (
                <p className="text-caption text-brown-400 mt-1">
                  {growthStats.totalActivePersons} personas en Ceiba
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Hero de progreso ───────────────────────────────────────────── */}
        <section>
          {loading ? (
            <Skeleton className="h-72 rounded-3xl" />
          ) : (
            <div className="rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #f0dfc8 0%, #ead4b8 100%)",
                boxShadow: "0 10px 28px rgba(193,96,58,0.16), 0 4px 8px rgba(193,96,58,0.10)",
              }}>

              <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 gap-4">
                {/* Anillo + avatar */}
                <div className="relative">
                  <ProgressRing score={score} total={total} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar size="xl"
                      name={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`}
                      src={profile?.avatar_url ?? undefined}
                      ring ringColor="terra"
                    />
                  </div>
                </div>

                {/* Copy */}
                <div>
                  <p className="font-display font-bold text-brown-800"
                    style={{ fontSize: "1.375rem", lineHeight: "1.3", letterSpacing: "-0.01em" }}>
                    {statusMsg}
                  </p>
                  <p className="text-caption text-brown-500 mt-1">
                    {score} de {total} secciones completadas
                  </p>
                </div>

                {/* CTA único */}
                <Button variant="primary" size="lg" pill fullWidth
                  icon={<UserPlus size={17} />}
                  onClick={() => router.push("/invitar")}>
                  Invitar familiar
                </Button>
              </div>

              {/* Enlace discreto */}
              <Link href="/tree">
                <div className="flex items-center justify-center gap-2 px-6 py-3 border-t hover:bg-black/5 transition-colors"
                  style={{ borderColor: "rgba(193,96,58,0.15)" }}>
                  <TreePine size={14} className="text-brown-500" />
                  <span className="text-caption text-brown-500 font-medium">Ver árbol familiar</span>
                  <ChevronRight size={13} className="text-brown-400" />
                </div>
              </Link>
            </div>
          )}
        </section>

        {/* ── Métricas ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Tu familia" className="mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {STATS.map(({ icon, value, label, bg, href }) => (
              <Link key={label} href={href}>
                <div className="rounded-2xl p-4 cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.75)",
                    boxShadow: "0 1px 4px rgba(193,96,58,0.10), 0 1px 2px rgba(193,96,58,0.06)",
                    border: "1px solid rgba(227,206,176,0.6)",
                  }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                      {icon}
                    </div>
                    <ChevronRight size={14} className="text-brown-300 mt-1 shrink-0" />
                  </div>
                  <p className="font-display font-bold text-brown-800"
                    style={{ fontSize: "1.75rem", lineHeight: "1", letterSpacing: "-0.02em" }}>
                    {loading ? "—" : value}
                  </p>
                  <p className="text-caption text-brown-400 mt-0.5">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Actividad reciente ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Actividad reciente"
            icon={<Calendar size={17} />}
            action={
              <Link href="/events"
                className="text-caption text-earth-500 font-medium hover:text-earth-600">
                Ver todo
              </Link>
            }
            className="mb-3"
          />

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : upcomingBirthdays.length === 0 && activityEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar size={22} className="text-earth-300" />}
              title="Sin actividad aún"
              description="Los cumpleaños y eventos de tu familia aparecerán aquí."
              action={
                <Button size="sm" variant="secondary"
                  onClick={() => router.push("/events")}>
                  Agregar evento
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.75)",
                boxShadow: "0 1px 4px rgba(193,96,58,0.10)",
                border: "1px solid rgba(227,206,176,0.6)",
              }}>
              {upcomingBirthdays.map((b, i) => (
                <div key={b.person_id} className="flex items-center gap-3 px-4 py-3.5"
                  style={i > 0 ? { borderTop: "1px solid rgba(238,223,198,0.8)" } : {}}>
                  <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center shrink-0">
                    <Cake size={16} className="text-gold-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold text-brown-800 truncate">
                      {b.first_name} {b.last_name}
                    </p>
                    <p className="text-caption text-brown-400">
                      {birthdayLabel(b.days, b.birth_date)}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-brown-300 shrink-0" />
                </div>
              ))}
              {activityEvents.map((ev, i) => (
                <Link key={ev.id} href="/events">
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream-100/50 transition-colors"
                    style={{ borderTop: "1px solid rgba(238,223,198,0.8)" }}>
                    <div className="w-10 h-10 rounded-full bg-earth-100 flex items-center justify-center shrink-0">
                      <Calendar size={16} className="text-earth-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-semibold text-brown-800 truncate">{ev.title}</p>
                      <p className="text-caption text-brown-400">
                        {eventLabel(ev.event_date, ev.event_type)}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-brown-300 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Gamificación ────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Tu progreso" icon={<Trophy size={17} />} className="mb-3" />
          <GamificationWidget />
        </section>

        {/* ── Historia destacada ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Historia destacada"
            icon={<BookOpen size={17} />}
            action={
              <Link href="/events"
                className="text-caption text-earth-500 font-medium hover:text-earth-600">
                Ver todas
              </Link>
            }
            className="mb-3"
          />

          {loading ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : featuredEvent ? (
            <Link href="/events">
              <div className="rounded-2xl p-5 cursor-pointer"
                style={{
                  background: "linear-gradient(145deg, #f5e8d4 0%, #f0dfc8 100%)",
                  boxShadow: "0 4px 12px rgba(193,96,58,0.12), 0 2px 4px rgba(193,96,58,0.08)",
                  border: "1px solid rgba(193,96,58,0.12)",
                }}>
                <Badge variant="terra" size="sm" className="mb-3">
                  {EVENT_TYPE_LABEL[featuredEvent.event_type] ?? "Evento"}
                </Badge>
                <p className="font-display font-semibold text-brown-800 mb-2"
                  style={{ fontSize: "1.125rem", lineHeight: "1.35" }}>
                  {featuredEvent.title}
                </p>
                {featuredEvent.description && (
                  <p className="font-display text-brown-600 mb-3"
                    style={{ fontStyle: "italic", fontSize: "0.9375rem", lineHeight: "1.6" }}>
                    "{featuredEvent.description}"
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-caption text-brown-400 flex items-center gap-1.5">
                    <Calendar size={11} />
                    {formatEventDate(featuredEvent.event_date)}
                  </p>
                  <ChevronRight size={14} className="text-brown-400" />
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={<BookOpen size={22} className="text-earth-300" />}
              title="Aún no hay historias"
              description="Registra los momentos importantes de tu familia."
              action={
                <Button size="sm" onClick={() => router.push("/events")}
                  icon={<Calendar size={14} />}>
                  Agregar historia
                </Button>
              }
            />
          )}
        </section>

      </main>

      <BottomNavigation items={NAV_ITEMS} variant="light" />
    </div>
  );
}
