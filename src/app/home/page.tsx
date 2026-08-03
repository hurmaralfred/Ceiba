"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home, TreePine, Send, Camera, Settings, Bell,
  Users, ChevronRight, Calendar, Cake, Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import { parseGrowthStats, type CeibaGrowthStats } from "@/lib/growthStats";
import type { Profile, FamilyMember } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
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
type BirthdayWithDays = FeedBirthday & { days: number };

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { href: "/home",     icon: Home,     label: "Inicio"  },
  { href: "/feed",     icon: Bell,     label: "Feed"    },
  { href: "/invitar",  icon: Send,     label: "Invitar", center: true },
  { href: "/photos",   icon: Camera,   label: "Fotos"   },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

// ── Utilidades ──────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
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

// ── Componentes de apoyo ─────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-cream-300 ${className}`} />;
}

function BirthdaySpotlight({ birthdays }: { birthdays: BirthdayWithDays[] }) {
  const single = birthdays.length === 1;
  const first = birthdays[0];
  const names = birthdays.map(b => b.first_name).join(" y ");
  const age = single && first.birth_date
    ? new Date().getFullYear() - new Date(first.birth_date).getFullYear()
    : null;

  return (
    <Link href={single ? `/persona/${first.person_id}` : "/feed"}>
      <div style={{
        background: "#f59e0b",
        borderRadius: 18,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
      }}>
        <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>🎂</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#78350f", marginBottom: 2,
          }}>
            Hoy en tu familia
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#78350f", lineHeight: 1.2 }}>
            {single ? `¡Hoy cumple años ${names}!` : `¡Hoy cumplen años ${names}!`}
          </div>
          {single && age && (
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>{age} años</div>
          )}
        </div>
        <div style={{
          background: "rgba(120,53,15,0.18)", borderRadius: 9,
          padding: "6px 11px", fontSize: 11, fontWeight: 700,
          color: "#78350f", flexShrink: 0,
        }}>
          Ver →
        </div>
      </div>
    </Link>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile]           = useState<Profile | null>(null);
  const [members, setMembers]           = useState<FamilyMember[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const saludo = getGreeting();

  const generations = members.length > 0
    ? Math.max(0, ...members.map(m => Math.abs(m.generation ?? 0))) + 1
    : 0;

  const allBirthdaysWithDays: BirthdayWithDays[] = birthdays.map(b => ({
    ...b, days: daysUntil(b.birth_date),
  }));

  const todayBirthdays = allBirthdaysWithDays.filter(b => b.days === 0);

  const activityBirthdays = allBirthdaysWithDays
    .filter(b => b.days > 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 2);

  const activityEvents = events.slice(0, Math.max(0, 3 - activityBirthdays.length));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28" style={{ background: "#fdf8f1" }}>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div style={{
        background: "#1a3a26",
        borderRadius: "0 0 28px 28px",
        padding: "12px 20px 0",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Leaf decoration */}
        <svg
          style={{ position: "absolute", right: -6, top: 0, opacity: 0.07, pointerEvents: "none" }}
          width="110" height="180" viewBox="0 0 110 180" aria-hidden
        >
          <path d="M55,172 C25,142 10,90 16,40 C22,6 48,0 55,2 C62,0 88,6 94,40 C100,90 85,142 55,172Z" fill="white"/>
          <path d="M55,172 L55,2" stroke="rgba(0,0,0,0.5)" strokeWidth={1} fill="none"/>
          <path d="M55,48 C40,40 24,38 16,40" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
          <path d="M55,68 C36,60 20,58 13,62" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
          <path d="M55,90 C34,80 18,78 11,83" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
          <path d="M55,48 C70,40 86,38 94,40" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
          <path d="M55,68 C74,60 90,58 97,62" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
          <path d="M55,90 C76,80 92,78 99,83" stroke="rgba(0,0,0,0.4)" strokeWidth={0.8} fill="none"/>
        </svg>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TreePine size={18} style={{ color: "#7ab88a" }} />
            <span className="font-display" style={{ color: "rgba(255,255,255,0.92)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>
              Ceiba
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/feed">
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={15} style={{ color: "rgba(255,255,255,0.8)" }} />
              </div>
            </Link>
            <Link href="/profile">
              {loading || !profile ? (
                <div className="animate-pulse" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
              ) : (
                <div style={{ borderRadius: "50%", outline: "3px solid rgba(228,160,40,0.4)", outlineOffset: "2px" }}>
                  <Avatar size="sm"
                    name={`${profile.first_name} ${profile.last_name}`}
                    src={profile.avatar_url ?? undefined}
                    ring ringColor="terra"
                  />
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Name + avatar row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 22 }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
              {saludo}
            </div>
            {loading ? (
              <div className="animate-pulse" style={{ width: 150, height: 42, borderRadius: 8, background: "rgba(255,255,255,0.1)" }} />
            ) : (
              <h1 className="font-display" style={{ color: "#fff", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>
                {firstName || "Hola"}
              </h1>
            )}
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 10 }}>
              <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>{visibleCount}</span>
              {" familiares · "}
              <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>{generations}</span>
              {" generaciones"}
            </div>
          </div>

          {loading || !profile ? (
            <div className="animate-pulse" style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
          ) : (
            <Link href="/profile">
              <div style={{ borderRadius: "50%", outline: "3px solid rgba(228,160,40,0.4)", outlineOffset: "2px", flexShrink: 0 }}>
                <Avatar size="md"
                  name={`${profile.first_name} ${profile.last_name}`}
                  src={profile.avatar_url ?? undefined}
                  ring ringColor="terra"
                />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-5">

        {/* Birthday spotlight */}
        {!loading && todayBirthdays.length > 0 && (
          <BirthdaySpotlight birthdays={todayBirthdays} />
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Familiares",   value: visibleCount, href: "/tree",   icon: <Users    size={16} className="text-ceiba-600" /> },
            { label: "Generaciones", value: generations,  href: "/tree",   icon: <TreePine size={16} className="text-ceiba-600" /> },
            { label: "Fotos",        value: photoCount,   href: "/photos", icon: <Camera   size={16} className="text-ceiba-600" /> },
          ].map(({ label, value, href, icon }) => (
            <Link key={label} href={href}>
              <div style={{
                background: "#fff",
                borderRadius: 14,
                padding: "12px 8px",
                textAlign: "center",
                border: "0.5px solid rgba(193,96,58,0.12)",
                cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>{icon}</div>
                <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#1a3a26", letterSpacing: "-1px", lineHeight: 1 }}>
                  {loading ? "—" : value}
                </div>
                <div style={{ fontSize: 9, color: "#a07050", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 3 }}>
                  {label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Tu árbol / gamification */}
        <section>
          <SectionHeader title="Tu árbol" icon={<Trophy size={17} />} className="mb-3" />
          <GamificationWidget />
        </section>

        {/* Actividad reciente */}
        <section>
          <SectionHeader
            title="Actividad reciente"
            icon={<Calendar size={17} />}
            action={
              <Link href="/events" className="text-caption text-earth-500 font-medium hover:text-earth-600">
                Ver todo
              </Link>
            }
            className="mb-3"
          />

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : activityBirthdays.length === 0 && activityEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar size={22} className="text-earth-300" />}
              title="Sin actividad aún"
              description="Los cumpleaños y eventos de tu familia aparecerán aquí."
              action={
                <Button size="sm" variant="secondary" onClick={() => router.push("/events")}>
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
              {activityBirthdays.map((b, i) => (
                <Link key={b.person_id} href={`/persona/${b.person_id}`}>
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream-100/50 transition-colors"
                    style={i > 0 ? { borderTop: "1px solid rgba(238,223,198,0.8)" } : {}}>
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Cake size={16} className="text-amber-500" />
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
                </Link>
              ))}
              {activityEvents.map((ev, i) => (
                <Link key={ev.id} href="/events">
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream-100/50 transition-colors"
                    style={{ borderTop: (i > 0 || activityBirthdays.length > 0) ? "1px solid rgba(238,223,198,0.8)" : undefined }}>
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

      </main>

      <BottomNavigation items={NAV_ITEMS} variant="light" />
    </div>
  );
}
