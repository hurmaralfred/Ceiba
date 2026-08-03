"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cake, Camera, Calendar, RefreshCw, Megaphone, AlertCircle, Bell, Sparkles, Heart, Star, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CosmicNav, CosmicHeader, s3dCard, C } from "@/components/ui/cosmic";

type FeedItemType = "birthday" | "photo" | "event" | "announcement" | "anniversary_birth" | "anniversary_death";

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  date: Date;
  imageUrl?: string;
  linkTo?: string;
  accentRgb: string;
  icon: React.ReactNode;
  isToday?: boolean;
  birthdayAge?: number | null;
  birthdayFirstName?: string;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "ahora mismo";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24); if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

const EVENT_LABEL: Record<string, string> = {
  birth: "Nacimiento", marriage: "Matrimonio", death: "Fallecimiento",
  graduation: "Graduación", reunion: "Reunión", anniversary: "Aniversario", other: "Evento",
};

interface KinshipSuggestion {
  id: string;
  score: number;
  evidence: Array<{ type: string; weight: number; detail: string }>;
  person_a: { id: string; first_name: string; first_surname: string; second_surname?: string } | null;
  person_b: { id: string; first_name: string; first_surname: string; second_surname?: string } | null;
  space_a: { id: string; name: string } | null;
  space_b: { id: string; name: string } | null;
}

export default function FeedPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [suggestions, setSuggestions] = useState<KinshipSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    const [feedRes, sugRes] = await Promise.all([
      fetch("/api/feed"),
      fetch("/api/suggestions"),
    ]);
    if (!feedRes.ok) { setFeedError(true); return; }
    setFeedError(false);
    const { birthdays, photos, broadcasts, events, anniversaries } = await feedRes.json();
    if (sugRes.ok) {
      const { suggestions: sug } = await sugRes.json();
      setSuggestions(sug ?? []);
    }
    const feedItems: FeedItem[] = [];
    const now = new Date();

    (birthdays || []).forEach((p: any) => {
      const bd = new Date(p.birth_date);
      const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const days = Math.round((next.getTime() - now.getTime()) / 86400000);
      const isToday = days <= 0 || days >= 365;
      const birthYear = parseInt(p.birth_date.split("-")[0]);
      feedItems.push({
        id: `bday-${p.person_id}`, type: "birthday",
        title: isToday ? `¡Hoy cumple años ${p.first_name}!` : `Cumpleaños de ${p.first_name} en ${days} días`,
        subtitle: `${p.first_name} ${p.last_name || ""}`.trim(),
        date: new Date(), accentRgb: "212,175,55",
        icon: <Cake size={16} style={{ color: "#d4af37" }} />,
        linkTo: `/persona/${p.person_id}`, isToday,
        birthdayAge: birthYear > 1900 ? now.getFullYear() - birthYear : null,
        birthdayFirstName: p.first_name,
      });
    });

    (photos || []).forEach((p: any) => {
      const name = p.uploader ? `${p.uploader.first_name} ${p.uploader.last_name || ""}`.trim() : "Alguien";
      feedItems.push({
        id: `photo-${p.id}`, type: "photo",
        title: `${name} compartió una foto`,
        subtitle: p.caption || "Sin descripción",
        date: new Date(p.created_at), accentRgb: "60,120,240",
        icon: <Camera size={16} style={{ color: "#4080f0" }} />,
        imageUrl: p.url, linkTo: "/photos",
      });
    });

    (events || []).forEach((e: any) => {
      const name = e.creator ? `${e.creator.first_name} ${e.creator.last_name || ""}`.trim() : "Alguien";
      feedItems.push({
        id: `event-${e.id}`, type: "event",
        title: `${name} registró: ${e.title}`,
        subtitle: `${EVENT_LABEL[e.event_type] || "Evento"} · ${new Date(e.event_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}`,
        date: new Date(e.created_at), accentRgb: "160,80,240",
        icon: <Calendar size={16} style={{ color: "#a050f0" }} />,
        linkTo: "/events",
      });
    });

    (broadcasts || []).forEach((b: any) => {
      const name = b.sender ? `${b.sender.first_name} ${b.sender.last_name || ""}`.trim() : "Un familiar";
      feedItems.push({
        id: `ann-${b.id}`, type: "announcement",
        title: `${name}`,
        subtitle: b.message, date: new Date(b.created_at), accentRgb: "220,140,40",
        icon: <Megaphone size={16} style={{ color: "#dc9030" }} />,
      });
    });

    (anniversaries || []).forEach((a: any) => {
      const isBirth = a.type === "birth";
      feedItems.push({
        id: `ann-${a.type}-${a.person_id}`,
        type: isBirth ? "anniversary_birth" : "anniversary_death",
        title: isBirth
          ? `Hoy hace ${a.years} años nació ${a.first_name} ${a.last_name || ""}`.trim()
          : `Hoy hace ${a.years} años falleció ${a.first_name} ${a.last_name || ""}`.trim(),
        subtitle: isBirth ? `Un recuerdo especial de la historia familiar` : `En su memoria`,
        date: new Date(),
        accentRgb: isBirth ? "212,175,55" : "160,140,200",
        icon: isBirth
          ? <Star size={16} style={{ color: "#d4af37" }} />
          : <Heart size={16} style={{ color: "#a08cc8" }} />,
        linkTo: `/persona/${a.person_id}`,
      });
    });

    const typeOrder = (t: FeedItemType) => {
      if (t === "birthday") return 0;
      if (t === "anniversary_birth" || t === "anniversary_death") return 1;
      return 2;
    };
    feedItems.sort((a, b) => {
      const od = typeOrder(a.type) - typeOrder(b.type);
      if (od !== 0) return od;
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

  const handleRefresh = async () => { setRefreshing(true); await loadFeed(); setRefreshing(false); };
  const handleDismiss = async (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <CosmicHeader
        title="Actividad familiar"
        backHref="/home"
        right={
          <button onClick={handleRefresh} disabled={refreshing}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <RefreshCw size={17} style={{ color: "rgba(212,175,55,0.5)",
              animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </button>
        }
      />

      <div style={{ padding: "14px 14px 0" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 68, borderRadius: 16, background: "#0c0a18",
                opacity: 0.4, animation: "pulse 2s infinite" }} />
            ))}
          </div>
        ) : feedError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 0", textAlign: "center" }}>
            <AlertCircle size={36} style={{ color: "rgba(220,60,80,0.5)", marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              No se pudo cargar la actividad
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
              Revisa tu conexión e intenta de nuevo.
            </p>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ background: "#c9a820", border: "none", borderRadius: 10, padding: "10px 22px",
                color: "#030208", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyFeed />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const todayBdays = items.filter(i => i.type === "birthday" && i.isToday);
              if (todayBdays.length === 0) return null;
              return <BirthdayHeroCard birthdays={todayBdays} />;
            })()}
            {suggestions.filter(s => !dismissedIds.has(s.id)).map(s => (
              <KinshipCard key={s.id} suggestion={s} onDismiss={handleDismiss} />
            ))}
            {items.filter(i => !(i.type === "birthday" && i.isToday)).map(item => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <CosmicNav />
    </div>
  );
}

function BirthdayHeroCard({ birthdays }: { birthdays: FeedItem[] }) {
  const single = birthdays.length === 1;
  const names = birthdays.map(b => b.birthdayFirstName || b.subtitle.split(" ")[0]).join(" y ");
  const heroLink = single && birthdays[0].linkTo ? birthdays[0].linkTo : "/feed";
  return (
    <Link href={heroLink}>
      <div style={{
        borderRadius: 20, padding: "20px",
        background: "#100c02", position: "relative", overflow: "hidden",
        borderTop: "1.5px solid rgba(212,175,55,0.5)", borderLeft: "1px solid rgba(212,175,55,0.22)",
        borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "0 7px 0 #040300, 0 12px 22px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.2)",
        textAlign: "center",
      }}>
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
          background: "rgba(212,175,55,0.55)" }} />
        <div style={{ fontSize: 48, marginBottom: 8, lineHeight: 1 }}>🎂</div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1.2 }}>
          {single ? `¡Hoy cumple años ${names}!` : `¡Hoy cumplen años ${names}!`}
        </p>
        {single && birthdays[0].birthdayAge && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#d4af37", fontWeight: 600 }}>
            {birthdays[0].birthdayAge} años
          </p>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(212,175,55,0.5)" }}>
          Toca para ver en el árbol familiar →
        </p>
      </div>
    </Link>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const inner = (
    <div style={{
      ...s3dCard("#0c0a18", item.accentRgb, "#040300"),
      padding: "12px 13px",
      display: "flex", alignItems: "flex-start", gap: 11,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0a0818", flexShrink: 0,
        borderTop: `1px solid rgba(${item.accentRgb},0.35)`, borderBottom: "1.5px solid #000",
        boxShadow: `0 3px 0 #030208, 0 0 10px rgba(${item.accentRgb},0.12)`,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {item.imageUrl && item.type !== "photo"
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />
          : item.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 2 }}>
          {item.title}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: item.type === "announcement" ? "pre-wrap" : "nowrap",
          marginBottom: 3 }}>
          {item.subtitle}
        </p>
        <p style={{ fontSize: 10, color: "rgba(212,175,55,0.35)" }}>{timeAgo(item.date)}</p>
      </div>
      {item.imageUrl && item.type === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt=""
          style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0,
            border: "1px solid rgba(60,120,240,0.2)" }} />
      )}
    </div>
  );
  if (item.linkTo) return <Link href={item.linkTo}>{inner}</Link>;
  return inner;
}

const EVIDENCE_LABEL: Record<string, string> = {
  surname: "Apellido compartido",
  birth_city: "Misma ciudad",
  birth_decade: "Misma generación",
  birth_country: "Mismo país",
};

function KinshipCard({ suggestion, onDismiss }: { suggestion: KinshipSuggestion; onDismiss: (id: string) => void }) {
  const { id, score, evidence, person_a, person_b, space_a, space_b } = suggestion;
  if (!person_a || !person_b) return null;
  const nameA = `${person_a.first_name} ${person_a.first_surname}`.trim();
  const nameB = `${person_b.first_name} ${person_b.first_surname}`.trim();
  const pct = Math.round(score * 100);
  const topEvidence = evidence[0];

  return (
    <div style={{
      ...s3dCard("#0c0a18", "100,200,120", "#000c04"),
      padding: "14px 14px 12px", position: "relative", overflow: "hidden",
    }}>
      {/* top shine */}
      <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1,
        background: "rgba(100,200,120,0.5)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle at 85% 15%, rgba(100,200,120,0.08) 0%, transparent 50%)" }} />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} style={{ color: "#64c878" }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "rgba(100,200,120,0.7)" }}>
          Posible conexión familiar
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700,
          color: "#64c878", background: "rgba(100,200,120,0.12)",
          padding: "2px 8px", borderRadius: 20 }}>
          {pct}% coincidencia
        </span>
      </div>

      {/* people row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <PersonChip name={nameA} spaceName={space_a?.name} accentRgb="100,200,120" />
        <div style={{ flexShrink: 0, color: "rgba(100,200,120,0.5)", fontSize: 16 }}>—</div>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(100,200,120,0.15)",
          border: "1px dashed rgba(100,200,120,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(100,200,120,0.6)" }}>?</span>
        </div>
        <div style={{ flexShrink: 0, color: "rgba(100,200,120,0.5)", fontSize: 16 }}>—</div>
        <PersonChip name={nameB} spaceName={space_b?.name} accentRgb="100,200,120" />
      </div>

      {/* evidence badge */}
      {topEvidence && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
          {EVIDENCE_LABEL[topEvidence.type] || topEvidence.type}:&nbsp;
          <span style={{ color: "#64c878", fontWeight: 600 }}>{topEvidence.detail}</span>
          {evidence.length > 1 && (
            <span style={{ color: "rgba(100,200,120,0.4)" }}> +{evidence.length - 1} más</span>
          )}
        </div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Link href={`/sugerencias/${id}`} style={{ textDecoration: "none", flex: 1 }}>
          <button style={{ width: "100%", padding: "8px 0", borderRadius: 10, cursor: "pointer",
            background: "#18a836", border: "none",
            borderTop: "1.5px solid rgba(100,230,130,0.5)", borderBottom: "2.5px solid #0a5c1c",
            boxShadow: "0 5px 0 #073d13, 0 8px 16px rgba(0,0,0,0.6)",
            color: "#fff", fontSize: 12, fontWeight: 700 }}>
            Ver detalle y confirmar
          </button>
        </Link>
        <button onClick={() => onDismiss(id)}
          style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer",
            background: "#0c0a18", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600 }}>
          No es familia
        </button>
      </div>
    </div>
  );
}

function PersonChip({ name, spaceName, accentRgb }: { name: string; spaceName?: string; accentRgb: string }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `rgba(${accentRgb},0.15)`, border: `1.5px solid rgba(${accentRgb},0.4)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color: `rgb(${accentRgb})` }}>
        {initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
        {spaceName && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spaceName}</p>
        )}
      </div>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div style={{ padding: "40px 4px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0c0a18",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
          border: "1px solid rgba(212,175,55,0.18)" }}>
          <Bell size={26} style={{ color: "rgba(212,175,55,0.4)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
          Todo tranquilo por aquí
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", maxWidth: 260, lineHeight: 1.6, margin: "0 auto" }}>
          El feed se llena cuando tu familia está en Ceiba. Da el primer paso:
        </p>
      </div>

      {/* CTA 1: Agregar familiares */}
      <Link href="/tree" style={{ textDecoration: "none" }}>
        <div style={{
          background: "#0c0a18", borderRadius: 16, padding: "14px 16px",
          borderTop: "1.5px solid rgba(212,175,55,0.22)", borderLeft: "1px solid rgba(212,175,55,0.1)",
          borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.5)",
          boxShadow: "0 6px 0 #040300, 0 10px 20px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,175,55,0.12)",
            border: "1.5px solid rgba(212,175,55,0.3)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Plus size={20} style={{ color: "#d4af37" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Agregar familiares al árbol</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>
              Cada persona que agregas trae contenido al feed
            </p>
          </div>
          <span style={{ marginLeft: "auto", color: "rgba(212,175,55,0.4)", fontSize: 18 }}>›</span>
        </div>
      </Link>

      {/* CTA 2: Invitar familia */}
      <Link href="/invitar" style={{ textDecoration: "none" }}>
        <div style={{
          background: "rgba(212,175,55,0.08)", borderRadius: 16, padding: "14px 16px",
          borderTop: "1.5px solid rgba(212,175,55,0.35)", borderLeft: "1px solid rgba(212,175,55,0.15)",
          borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.5)",
          boxShadow: "0 6px 0 #040300, 0 10px 20px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,175,55,0.15)",
            border: "1.5px solid rgba(212,175,55,0.4)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Users size={20} style={{ color: "#d4af37" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#d4af37", margin: 0 }}>Invitar a mi familia por WhatsApp</p>
            <p style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", margin: "2px 0 0" }}>
              Cuantos más se unan, más vivo está el feed
            </p>
          </div>
          <span style={{ marginLeft: "auto", color: "rgba(212,175,55,0.5)", fontSize: 18 }}>›</span>
        </div>
      </Link>
    </div>
  );
}
