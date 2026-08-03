"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home, TreePine, BookOpen, Camera, User,
  Bell, Menu, Heart, MessageCircle, Bookmark,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adaptGraph, type FamilyGraph } from "@/lib/graphAdapter";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import type { Profile, FamilyMember } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { BottomNavigation, type NavItem } from "@/components/ui/BottomNavigation";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FeedBirthday {
  person_id: string; first_name: string; last_name: string; birth_date: string;
}
interface FeedPhoto {
  id: string; url: string; caption: string | null; created_at: string;
  uploader?: { first_name: string; last_name: string };
}
interface FeedEvent {
  id: string; title: string; event_type: string; event_date: string;
  description: string | null; created_at: string;
  creator?: { first_name: string; last_name: string };
}
interface FeedBroadcast {
  id: string; message: string; created_at: string;
  sender?: { first_name: string; last_name: string };
}
type BirthdayWithDays = FeedBirthday & { days: number };

// ── Navegación ────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { href: "/home",    icon: Home,     label: "Inicio"   },
  { href: "/tree",    icon: TreePine, label: "Árbol"    },
  { href: "/events",  icon: BookOpen, label: "Historias", center: true },
  { href: "/photos",  icon: Camera,   label: "Álbumes"  },
  { href: "/profile", icon: User,     label: "Perfil"   },
];

// ── Utilidades ────────────────────────────────────────────────────────────────
function daysUntil(birth_date: string): number {
  const today = new Date();
  const bd = new Date(birth_date);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 365 ? 0 : diff;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "ahora mismo";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

const EVENT_LABEL: Record<string, string> = {
  birth: "Nacimiento", marriage: "Matrimonio", graduation: "Graduación",
  reunion: "Reunión", anniversary: "Aniversario", death: "Fallecimiento", other: "Evento",
};

const AVATAR_COLORS = ["#6b3a1f", "#1a3a26", "#3d1e6b", "#1e3a6b", "#6b1a3a", "#1a3a4e"];

function avatarColor(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-cream-300 ${className}`} />;
}

function LaurelDivider() {
  return (
    <svg width="90" height="16" viewBox="0 0 90 16" style={{ margin: "7px 0", opacity: 0.8 }} aria-hidden>
      <path d="M45,8 C38,4 29,2 21,5 C15,7 9,8 4,7"   stroke="#c1603a" strokeWidth="1"   fill="none" strokeLinecap="round"/>
      <path d="M45,8 C52,4 61,2 69,5 C75,7 81,8 86,7" stroke="#c1603a" strokeWidth="1"   fill="none" strokeLinecap="round"/>
      <path d="M21,5 C18,3 16,2 14,4"                  stroke="#c1603a" strokeWidth=".8"  fill="none"/>
      <path d="M69,5 C72,3 74,2 76,4"                  stroke="#c1603a" strokeWidth=".8"  fill="none"/>
      <circle cx="45" cy="8" r="2.5" fill="#c1603a"/>
    </svg>
  );
}

function AvatarInitials({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.32, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// Tarjeta "Historia destacada" — cumpleaños
function FeaturedBirthdayCard({ birthday }: { birthday: BirthdayWithDays }) {
  const age = new Date().getFullYear() - new Date(birthday.birth_date).getFullYear();
  return (
    <Link href={`/persona/${birthday.person_id}`}>
      <div style={{
        margin: "12px 16px 0", borderRadius: 20, overflow: "hidden",
        background: "#f5e3c0", boxShadow: "0 6px 24px rgba(193,96,58,0.18)",
      }}>
        <div style={{ display: "flex" }}>
          {/* Texto izquierdo */}
          <div style={{ flex: 1, padding: "16px 8px 12px 18px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "#c1603a", borderRadius: 100, padding: "4px 11px", marginBottom: 12,
            }}>
              <span style={{ fontSize: 9 }}>⭐</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>Historia destacada</span>
            </div>
            <div style={{ fontSize: 12, color: "#3d1e0a", fontWeight: 500, marginBottom: 2 }}>Hoy cumple</div>
            <div style={{ lineHeight: 0.9, marginBottom: 4 }}>
              <span className="font-display" style={{ fontSize: 54, fontWeight: 800, color: "#c1603a", letterSpacing: "-3px" }}>{age}</span>
              <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#c1603a" }}> años</span>
            </div>
            <LaurelDivider />
            <div style={{ fontSize: 11, color: "#6b3a1f", marginBottom: 3 }}>celebra con</div>
            <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: "#c1603a", lineHeight: 1.2 }}>
              {birthday.first_name} {birthday.last_name}
            </div>
          </div>
          {/* Foto / placeholder */}
          <div style={{ width: "38%", background: "#d4b896", position: "relative", minHeight: 190 }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, opacity: 0.45 }}>🎂</div>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 34, background: "linear-gradient(to right, #f5e3c0, transparent)" }} />
          </div>
        </div>
        <div style={{ borderTop: "0.5px solid rgba(193,96,58,0.2)", padding: "9px 18px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b3a1f", fontWeight: 600 }}>
            Familia unida <span style={{ color: "#c1603a" }}>♥</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Tarjeta "Historia destacada" — evento
function FeaturedEventCard({ event }: { event: FeedEvent }) {
  return (
    <Link href="/events">
      <div style={{
        margin: "12px 16px 0", borderRadius: 20, overflow: "hidden",
        background: "#f5e3c0", boxShadow: "0 6px 24px rgba(193,96,58,0.18)",
      }}>
        <div style={{ padding: "18px 18px 14px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "#c1603a", borderRadius: 100, padding: "4px 11px", marginBottom: 12,
          }}>
            <span style={{ fontSize: 9 }}>⭐</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>Historia destacada</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b3a1f", marginBottom: 6 }}>
            {EVENT_LABEL[event.event_type] ?? "Evento"} · {new Date(event.event_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: "#3d1e0a", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            {event.title}
          </div>
          {event.description && (
            <>
              <LaurelDivider />
              <div style={{ fontStyle: "italic", fontSize: 13, color: "#6b3a1f", lineHeight: 1.5 }}>
                "{event.description}"
              </div>
            </>
          )}
        </div>
        <div style={{ borderTop: "0.5px solid rgba(193,96,58,0.2)", padding: "9px 18px" }}>
          <span style={{ fontSize: 12, color: "#6b3a1f", fontWeight: 600 }}>
            Familia unida <span style={{ color: "#c1603a" }}>♥</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Tarjeta de foto — estilo social
function PhotoCard({ photo }: { photo: FeedPhoto }) {
  const name = photo.uploader
    ? `${photo.uploader.first_name} ${photo.uploader.last_name || ""}`.trim()
    : "Un familiar";
  return (
    <div style={{ background: "#fff", margin: "10px 16px 0", borderRadius: 18, overflow: "hidden", border: "0.5px solid rgba(193,96,58,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 9px" }}>
        <AvatarInitials name={name} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e0e06", lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 10, color: "#a07050" }}>{timeAgo(photo.created_at)}</div>
        </div>
        <div style={{ color: "#c0a080", fontSize: 18, letterSpacing: 2 }}>···</div>
      </div>
      {photo.caption && (
        <div style={{ padding: "0 14px 9px", fontSize: 13, color: "#3d1e0a", lineHeight: 1.4 }}>{photo.caption}</div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption || ""} style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }} />
      <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 16, borderTop: "0.5px solid #f5e8d4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#a07050", fontWeight: 600 }}>
          <Heart size={14} /> Reaccionar
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#a07050", fontWeight: 600 }}>
          <MessageCircle size={14} /> Comentar
        </div>
        <div style={{ marginLeft: "auto", color: "#c0a080" }}><Bookmark size={14} /></div>
      </div>
    </div>
  );
}

// Tarjeta de evento — estilo social
function EventCard({ event }: { event: FeedEvent }) {
  const name = event.creator
    ? `${event.creator.first_name} ${event.creator.last_name || ""}`.trim()
    : "Un familiar";
  return (
    <Link href="/events">
      <div style={{ background: "#fff", margin: "10px 16px 0", borderRadius: 18, overflow: "hidden", border: "0.5px solid rgba(193,96,58,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 9px" }}>
          <AvatarInitials name={name} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e0e06" }}>{name}</div>
            <div style={{ fontSize: 10, color: "#a07050" }}>{timeAgo(event.created_at)}</div>
          </div>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{
            display: "inline-block", background: "#f5e3c0", borderRadius: 100,
            padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#6b3a1f", marginBottom: 7,
          }}>
            {EVENT_LABEL[event.event_type] ?? "Evento"} · {new Date(event.event_date).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1e0e06", lineHeight: 1.3 }}>{event.title}</div>
          {event.description && (
            <div style={{ fontSize: 12, color: "#6b3a1f", marginTop: 5, lineHeight: 1.4, fontStyle: "italic" }}>
              "{event.description}"
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Tarjeta de anuncio
function BroadcastCard({ broadcast }: { broadcast: FeedBroadcast }) {
  const name = broadcast.sender
    ? `${broadcast.sender.first_name} ${broadcast.sender.last_name || ""}`.trim()
    : "Un familiar";
  return (
    <div style={{ background: "#fff8f0", margin: "10px 16px 0", borderRadius: 18, overflow: "hidden", border: "0.5px solid rgba(193,96,58,0.15)", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <AvatarInitials name={name} size={32} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e0e06" }}>{name}</div>
          <div style={{ fontSize: 10, color: "#a07050" }}>📢 Anuncio · {timeAgo(broadcast.created_at)}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#3d1e0a", lineHeight: 1.5 }}>{broadcast.message}</div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [members, setMembers]       = useState<FamilyMember[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [visibleCount, setVisibleCount] = useState(0);
  const [birthdays, setBirthdays]   = useState<FeedBirthday[]>([]);
  const [photos, setPhotos]         = useState<FeedPhoto[]>([]);
  const [events, setEvents]         = useState<FeedEvent[]>([]);
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const [graphRes, feedRes] = await Promise.allSettled([
      supabase.rpc("get_my_family_graph", { p_depth: 4 }),
      fetch("/api/feed"),
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
          setPhotos((data.photos   || []).slice(0, 6));
          setEvents((data.events   || []).slice(0, 8));
          setBroadcasts((data.broadcasts || []).slice(0, 3));
        }
      } catch {}
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Datos derivados ───────────────────────────────────────────────────────
  const allBirthdays: BirthdayWithDays[] = birthdays.map(b => ({ ...b, days: daysUntil(b.birth_date) }));
  const featuredBirthday = allBirthdays.find(b => b.days === 0) ?? null;
  const featuredEvent    = events[0] ?? null;

  // Feed mixto ordenado por fecha
  type MixedItem =
    | { type: "photo";     data: FeedPhoto;     date: number }
    | { type: "event";     data: FeedEvent;     date: number }
    | { type: "broadcast"; data: FeedBroadcast; date: number };

  const feedItems: MixedItem[] = [
    ...photos.map(p => ({ type: "photo"     as const, data: p, date: new Date(p.created_at).getTime() })),
    ...events.slice(featuredBirthday ? 0 : 1).map(e => ({ type: "event" as const, data: e, date: new Date(e.created_at).getTime() })),
    ...broadcasts.map(b => ({ type: "broadcast" as const, data: b, date: new Date(b.created_at).getTime() })),
  ].sort((a, b) => b.date - a.date).slice(0, 10);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28" style={{ background: "#fdf5e8" }}>

      {/* ── Header + Tabs (sticky unidos) ─────────────────────────────── */}
      <div className="sticky top-0 z-40"
        style={{ background: "rgba(253,245,232,0.96)", backdropFilter: "blur(10px)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 8px", borderBottom: "0.5px solid rgba(193,96,58,0.08)" }}>
          <Link href="/settings">
            <Menu size={20} style={{ color: "#6b3a1f" }} aria-label="Menú" />
          </Link>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
              <TreePine size={15} style={{ color: "#c1603a" }} />
              <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: "#3d1e0a", letterSpacing: "-0.5px" }}>
                Ceiba
              </span>
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", color: "#c1603a", textTransform: "uppercase", marginTop: -2 }}>
              Nuestras raíces
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/feed">
              <Bell size={20} style={{ color: "#6b3a1f" }} />
            </Link>
            {loading || !profile ? (
              <div className="animate-pulse" style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8d4b4" }} />
            ) : (
              <Link href="/profile">
                <div style={{ borderRadius: "50%", outline: "2.5px solid rgba(228,160,40,0.5)", outlineOffset: "2px" }}>
                  <Avatar size="sm"
                    name={`${profile.first_name} ${profile.last_name}`}
                    src={profile.avatar_url ?? undefined}
                    ring ringColor="terra"
                  />
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs horizontales */}
        <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid rgba(193,96,58,0.12)" }}>
          {/* "Para ti" — activo */}
          <div style={{ flex: 1, padding: "8px 0 7px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#c1603a", position: "relative", cursor: "default" }}>
            Para ti
            <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 2, background: "#c1603a", borderRadius: 2 }} />
          </div>
          {([{ label: "Familia", href: "/tree" }, { label: "Historias", href: "/events" }, { label: "Álbumes", href: "/photos" }]).map(({ label, href }) => (
            <Link key={label} href={href} style={{ flex: 1, padding: "8px 0 7px", textAlign: "center", display: "block", fontSize: 12, fontWeight: 600, color: "#a07050", textDecoration: "none" }}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Tarjeta destacada ──────────────────────────────────────────── */}
      {loading ? (
        <Skeleton className="mx-4 mt-3 h-52" />
      ) : featuredBirthday ? (
        <FeaturedBirthdayCard birthday={featuredBirthday} />
      ) : featuredEvent ? (
        <FeaturedEventCard event={featuredEvent} />
      ) : null}

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 px-4 mt-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : feedItems.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🌱</div>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: "#3d1e0a", marginBottom: 8 }}>
            Tu familia está comenzando
          </div>
          <div style={{ fontSize: 13, color: "#a07050", lineHeight: 1.6 }}>
            Sube fotos, registra eventos e invita a tu familia para empezar a construir sus memorias.
          </div>
          <Link href="/invitar">
            <div style={{ marginTop: 20, display: "inline-block", background: "#c1603a", borderRadius: 100, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Invitar a mi familia
            </div>
          </Link>
        </div>
      ) : (
        <div style={{ paddingBottom: 12 }}>
          {feedItems.map(item => {
            if (item.type === "photo")     return <PhotoCard     key={`p-${item.data.id}`} photo={item.data}     />;
            if (item.type === "event")     return <EventCard     key={`e-${item.data.id}`} event={item.data}     />;
            if (item.type === "broadcast") return <BroadcastCard key={`b-${item.data.id}`} broadcast={item.data} />;
          })}
        </div>
      )}

      <BottomNavigation items={NAV_ITEMS} variant="light" />
    </div>
  );
}
