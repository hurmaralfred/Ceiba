"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Cake, UserPlus, Camera, Calendar, RefreshCw, Bell, Heart, Baby, GraduationCap, Users, Star, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

// ── Types ──────────────────────────────────────────────────────
type FeedItemType = "birthday" | "joined" | "photo" | "event";

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  date: Date;
  imageUrl?: string;
  linkTo?: string;
  accent: string; // tailwind color class
  icon: React.ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "ahora mismo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function isBirthdayToday(birthDate: string): boolean {
  const bd = new Date(birthDate);
  const today = new Date();
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
}

function isBirthdaySoon(birthDate: string, days = 7): boolean {
  const bd = new Date(birthDate);
  const today = new Date();
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= days;
}

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  birth:       { label: "Nacimiento",    icon: <Baby size={14} />,          color: "text-pink-600 bg-pink-50" },
  marriage:    { label: "Matrimonio",    icon: <Heart size={14} />,         color: "text-red-600 bg-red-50" },
  death:       { label: "Fallecimiento", icon: <Star size={14} />,          color: "text-gray-600 bg-gray-100" },
  graduation:  { label: "Graduación",    icon: <GraduationCap size={14} />, color: "text-blue-600 bg-blue-50" },
  reunion:     { label: "Reunión",       icon: <Users size={14} />,         color: "text-green-600 bg-green-50" },
  anniversary: { label: "Aniversario",   icon: <Calendar size={14} />,      color: "text-amber-600 bg-amber-50" },
  other:       { label: "Evento",        icon: <BookOpen size={14} />,      color: "text-purple-600 bg-purple-50" },
};

// ── Main component ────────────────────────────────────────────
export default function FeedPage() {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadFeed = useCallback(async (uid: string) => {
    const feedItems: FeedItem[] = [];
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // ── 1. Birthdays today & this week ─────────────────────────
    const { data: members } = await supabase
      .from("family_members")
      .select("id, first_name, last_name, relation_type, birth_date")
      .eq("added_by", uid)
      .not("birth_date", "is", null);

    (members || []).forEach(m => {
      if (!m.birth_date) return;
      const isToday = isBirthdayToday(m.birth_date);
      const isSoon = isBirthdaySoon(m.birth_date, 7);
      if (!isToday && !isSoon) return;
      const bd = new Date(m.birth_date);
      const age = new Date().getFullYear() - bd.getFullYear() + (isToday ? 0 : 1);
      const relation = RELATION_LABELS[m.relation_type as RelationType] || m.relation_type;
      feedItems.push({
        id: `bday-${m.id}`,
        type: "birthday",
        title: isToday
          ? `🎂 Hoy es el cumpleaños de ${m.first_name}`
          : `🎂 Cumpleaños de ${m.first_name} en ${Math.ceil((new Date(new Date().getFullYear(), bd.getMonth(), bd.getDate()).getTime() - Date.now()) / 86400000)} días`,
        subtitle: `${relation} · ${age} años`,
        date: new Date(), // pin to top
        accent: "border-amber-400 bg-amber-50",
        icon: <Cake size={18} className="text-amber-600" />,
        linkTo: "/tree",
      });
    });

    // ── 2. Family members who recently joined ──────────────────
    const { data: joined } = await supabase
      .from("family_members")
      .select("id, first_name, last_name, relation_type, profile_id, profiles:profile_id(created_at, avatar_url)")
      .eq("added_by", uid)
      .not("profile_id", "is", null);

    (joined || []).forEach((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (!profile?.created_at) return;
      const joinedAt = new Date(profile.created_at);
      if (joinedAt < cutoff) return;
      const relation = RELATION_LABELS[m.relation_type as RelationType] || m.relation_type;
      feedItems.push({
        id: `joined-${m.id}`,
        type: "joined",
        title: `${m.first_name} ${m.last_name || ""} se unió a Ceiba`,
        subtitle: `Tu ${relation.toLowerCase()} ya está en el árbol`,
        date: joinedAt,
        imageUrl: profile.avatar_url,
        accent: "border-green-400 bg-green-50",
        icon: <UserPlus size={18} className="text-green-600" />,
        linkTo: "/tree",
      });
    });

    // ── 3. Recent photos ───────────────────────────────────────
    const { data: photos } = await supabase
      .from("family_photos")
      .select("id, url, caption, created_at, profiles:uploaded_by(first_name, last_name, avatar_url)")
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    (photos || []).forEach((p: any) => {
      const uploader = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const name = uploader ? `${uploader.first_name} ${uploader.last_name || ""}`.trim() : "Alguien";
      feedItems.push({
        id: `photo-${p.id}`,
        type: "photo",
        title: `${name} compartió una foto`,
        subtitle: p.caption || "Sin descripción",
        date: new Date(p.created_at),
        imageUrl: p.url,
        accent: "border-blue-400 bg-blue-50",
        icon: <Camera size={18} className="text-blue-600" />,
        linkTo: "/photos",
      });
    });

    // ── 4. Recent family events ────────────────────────────────
    const { data: events } = await supabase
      .from("family_events")
      .select("id, title, event_type, event_date, created_at, profiles:created_by(first_name, last_name)")
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    (events || []).forEach((e: any) => {
      const creator = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      const name = creator ? `${creator.first_name} ${creator.last_name || ""}`.trim() : "Alguien";
      const meta = EVENT_META[e.event_type] || EVENT_META.other;
      feedItems.push({
        id: `event-${e.id}`,
        type: "event",
        title: `${name} registró: ${e.title}`,
        subtitle: `${meta.label} · ${new Date(e.event_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}`,
        date: new Date(e.created_at),
        accent: "border-purple-400 bg-purple-50",
        icon: <Calendar size={18} className="text-purple-600" />,
        linkTo: "/events",
      });
    });

    // ── Sort: birthdays first, then by date desc ───────────────
    feedItems.sort((a, b) => {
      if (a.type === "birthday" && b.type !== "birthday") return -1;
      if (b.type === "birthday" && a.type !== "birthday") return 1;
      return b.date.getTime() - a.date.getTime();
    });

    setItems(feedItems);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUserId(data.user.id);
      loadFeed(data.user.id).finally(() => setLoading(false));
    });
  }, []);

  const handleRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await loadFeed(userId);
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-ceiba-700" />
            <h1 className="text-lg font-bold text-gray-900">Actividad familiar</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={18} className={`text-gray-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyFeed />
        ) : (
          items.map(item => <FeedCard key={item.id} item={item} />)
        )}
      </main>

      <BottomNav />
    </div>
  );
}

// ── Feed Card ─────────────────────────────────────────────────
function FeedCard({ item }: { item: FeedItem }) {
  const content = (
    <div className={`bg-white rounded-2xl border-l-4 ${item.accent} shadow-sm p-4 flex items-start gap-3 active:scale-[0.98] transition-transform`}>
      <div className="shrink-0 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
        {item.imageUrl && item.type !== "photo" ? (
          <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          item.icon
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(item.date)}</p>
      </div>

      {item.imageUrl && item.type === "photo" && (
        <img
          src={item.imageUrl}
          alt=""
          className="w-14 h-14 rounded-xl object-cover shrink-0"
        />
      )}
    </div>
  );

  if (item.linkTo) {
    return <Link href={item.linkTo}>{content}</Link>;
  }
  return content;
}

// ── Empty state ───────────────────────────────────────────────
function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
        <TreePine size={36} className="text-ceiba-700" />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Todo tranquilo por aquí</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        Cuando tus familiares se unan, suban fotos o registren eventos, aparecerán aquí.
      </p>
      <Link href="/tree" className="mt-6 btn-primary text-sm">
        Invitar a mi familia
      </Link>
    </div>
  );
}
