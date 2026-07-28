"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Cake, Camera, Calendar, RefreshCw, Bell, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type FeedItemType = "birthday" | "photo" | "event" | "announcement";

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  date: Date;
  imageUrl?: string;
  linkTo?: string;
  accent: string;
  icon: React.ReactNode;
}

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

const EVENT_LABEL: Record<string, string> = {
  birth: "Nacimiento", marriage: "Matrimonio", death: "Fallecimiento",
  graduation: "Graduación", reunion: "Reunión", anniversary: "Aniversario", other: "Evento",
};

export default function FeedPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    const res = await fetch("/api/feed");
    if (!res.ok) { setItems([]); return; }
    const { birthdays, photos, broadcasts, events } = await res.json();
    const feedItems: FeedItem[] = [];
    const now = new Date();

    (birthdays || []).forEach((p: any) => {
      const bd = new Date(p.birth_date);
      const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const days = Math.ceil((next.getTime() - now.getTime()) / 86400000);
      const isToday = days === 0 || days === 366;
      const name = `${p.first_name} ${p.last_name || ""}`.trim();
      feedItems.push({
        id: `bday-${p.person_id}`,
        type: "birthday",
        title: isToday ? `🎂 Hoy es el cumpleaños de ${p.first_name}` : `🎂 Cumpleaños de ${p.first_name} en ${days} días`,
        subtitle: name,
        date: new Date(),
        accent: "border-amber-400 bg-amber-50",
        icon: <Cake size={18} className="text-amber-600" />,
        linkTo: "/tree",
      });
    });

    (photos || []).forEach((p: any) => {
      const name = p.uploader ? `${p.uploader.first_name} ${p.uploader.last_name || ""}`.trim() : "Alguien";
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

    (events || []).forEach((e: any) => {
      const name = e.creator ? `${e.creator.first_name} ${e.creator.last_name || ""}`.trim() : "Alguien";
      feedItems.push({
        id: `event-${e.id}`,
        type: "event",
        title: `${name} registró: ${e.title}`,
        subtitle: `${EVENT_LABEL[e.event_type] || "Evento"} · ${new Date(e.event_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}`,
        date: new Date(e.created_at),
        accent: "border-purple-400 bg-purple-50",
        icon: <Calendar size={18} className="text-purple-600" />,
        linkTo: "/events",
      });
    });

    (broadcasts || []).forEach((b: any) => {
      const name = b.sender ? `${b.sender.first_name} ${b.sender.last_name || ""}`.trim() : "Un familiar";
      feedItems.push({
        id: `ann-${b.id}`,
        type: "announcement",
        title: `📢 ${name}`,
        subtitle: b.message,
        date: new Date(b.created_at),
        accent: "border-amber-400 bg-amber-50",
        icon: <Megaphone size={18} className="text-amber-600" />,
      });
    });

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
      loadFeed().finally(() => setLoading(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-40 bg-cream-50 border-b border-cream-300">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-ceiba-700" />
            <h1 className="text-lg font-bold text-ceiba-900">Actividad familiar</h1>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-full hover:bg-cream-200 transition-colors">
            <RefreshCw size={18} className={`text-ceiba-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
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
        <p className={`text-xs text-gray-500 mt-0.5 ${item.type === "announcement" ? "whitespace-pre-wrap" : "truncate"}`}>{item.subtitle}</p>
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(item.date)}</p>
      </div>
      {item.imageUrl && item.type === "photo" && (
        <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      )}
    </div>
  );
  if (item.linkTo) return <Link href={item.linkTo}>{content}</Link>;
  return content;
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
        <TreePine size={36} className="text-ceiba-700" />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Todo tranquilo por aquí</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        Cuando tus familiares suban fotos, registren eventos o envíen anuncios, aparecerán aquí.
      </p>
      <Link href="/tree" className="mt-6 btn-primary text-sm">Invitar a mi familia</Link>
    </div>
  );
}
