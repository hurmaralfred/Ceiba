"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import { MapPin, Pause, Play, CheckCircle, Clock, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";

// ── Types ─────────────────────────────────────────────────────
interface FamilyPresence {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  last_seen_at: string | null;
  live_lat: number | null;
  live_lng: number | null;
  live_location_at: string | null;
  location_sharing: boolean;
  relation_type: string;
}

// ── Helpers ────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Ahora mismo";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function activityStatus(m: FamilyPresence): "now" | "today" | "week" | "away" {
  if (!m.last_seen_at) return "away";
  const diff = (Date.now() - new Date(m.last_seen_at).getTime()) / 1000;
  if (diff < 300) return "now";      // 5 min
  if (diff < 86400) return "today";  // today
  if (diff < 604800) return "week";  // this week
  return "away";
}

const STATUS_DOT: Record<string, string> = {
  now:   "bg-ceiba-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)]",
  today: "bg-amber-400",
  week:  "bg-gray-500",
  away:  "bg-gray-700",
};

const STATUS_TEXT: Record<string, string> = {
  now:   "text-ceiba-400",
  today: "text-amber-400",
  week:  "text-gray-500",
  away:  "text-gray-600",
};

// ── Live Map (loaded dynamically to avoid SSR issues) ──────────
const LiveMap = dynamic(() => import("@/components/live/LiveMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-900 animate-pulse rounded-2xl" />,
});

// ── Main Page ──────────────────────────────────────────────────
export default function LivePage() {
  const router = useRouter();
  const supabase = createClient();

  const [members, setMembers] = useState<FamilyPresence[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  // ── Load initial data ──────────────────────────────────────
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const [{ data: profile }, presenceRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      fetch("/api/presence"),
    ]);

    setMyProfile(profile);
    setSharingLocation(profile?.location_sharing ?? true);

    const { members: data } = await presenceRes.json();
    setMembers(data || []);
    setLoading(false);
  }, []);

  // ── Update my last_seen + location ─────────────────────────
  const updatePresence = useCallback(async (lat?: number, lng?: number, pause = false) => {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, pause }),
    });
  }, []);

  // ── Start/stop geolocation watch ───────────────────────────
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setMyPos({ lat, lng });
        updatePresence(lat, lng);
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    );
  }, [updatePresence]);

  const stopWatching = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    updatePresence(undefined, undefined, true);
    setSharingLocation(false);
  }, [updatePresence]);

  // ── Realtime subscription for live location updates ────────
  const subscribeRealtime = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel("family-presence")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=neq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setMembers(prev =>
            prev.map(m => m.id === updated.id
              ? { ...m,
                  last_seen_at: updated.last_seen_at,
                  live_lat: updated.live_lat,
                  live_lng: updated.live_lng,
                  live_location_at: updated.live_location_at,
                  location_sharing: updated.location_sharing,
                }
              : m
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [supabase]);

  useEffect(() => {
    loadData();
    subscribeRealtime();
    // Start watching location if sharing enabled
    startWatching();
    // Update last_seen immediately
    updatePresence();

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Checkin ────────────────────────────────────────────────
  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      // Get fresh position for check-in
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      ).catch(() => null);

      const lat = pos?.coords.latitude ?? myPos?.lat;
      const lng = pos?.coords.longitude ?? myPos?.lng;

      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, checkin: true }),
      });

      setCheckedIn(true);
      setTimeout(() => setCheckedIn(false), 5000);
    } finally {
      setCheckingIn(false);
    }
  };

  // ── Sort members: active first ─────────────────────────────
  const sorted = [...members].sort((a, b) => {
    const order = { now: 0, today: 1, week: 2, away: 3 };
    return order[activityStatus(a)] - order[activityStatus(b)];
  });

  const activeCount = members.filter(m => activityStatus(m) !== "away").length;
  const withLocation = members.filter(m => m.live_lat && m.location_sharing);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ceiba-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ceiba-500" />
            </span>
            En vivo
          </h1>
          {/* Location toggle */}
          <button
            onClick={() => {
              if (sharingLocation) { stopWatching(); }
              else { setSharingLocation(true); startWatching(); }
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              sharingLocation
                ? "border-ceiba-700 bg-ceiba-950/60 text-ceiba-400"
                : "border-gray-700 bg-gray-800/60 text-gray-500"
            }`}
          >
            {sharingLocation ? <Play size={11} /> : <Pause size={11} />}
            {sharingLocation ? "Compartiendo" : "Pausado"}
          </button>
        </div>
        <p className="text-gray-500 text-xs">
          {activeCount > 0
            ? `${activeCount} familiar${activeCount > 1 ? "es" : ""} activo${activeCount > 1 ? "s" : ""} hoy`
            : "Nadie activo aún hoy"}
        </p>
      </header>

      {/* Map */}
      {!loading && (withLocation.length > 0 || myPos) && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 220 }}>
          <LiveMap
            members={withLocation}
            myPos={myPos}
            myName={myProfile?.first_name ?? "Tú"}
            myAvatar={myProfile?.avatar_url}
          />
        </div>
      )}

      {/* Checkin button */}
      <div className="px-4 mb-4">
        <button
          onClick={handleCheckin}
          disabled={checkingIn || checkedIn}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg ${
            checkedIn
              ? "bg-ceiba-700 text-ceiba-200 shadow-ceiba-950/50"
              : "bg-ceiba-600 hover:bg-ceiba-500 text-white shadow-ceiba-950/50 active:scale-[0.98]"
          }`}
        >
          {checkedIn
            ? <><CheckCircle size={20} /> ¡Familia notificada!</>
            : checkingIn
            ? "Enviando..."
            : <><CheckCircle size={20} /> Llegué bien</>
          }
        </button>
        <p className="text-center text-gray-600 text-xs mt-2">
          Tu ubicación actual llega a toda tu familia al instante
        </p>
      </div>

      {/* Family list */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/40 rounded-2xl animate-pulse" />
          ))
        ) : sorted.length === 0 ? (
          <div className="text-center py-12">
            <WifiOff size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">Ningún familiar en Ceiba aún</p>
          </div>
        ) : (
          sorted.map(m => {
            const status = activityStatus(m);
            const rel = RELATION_LABELS[m.relation_type as RelationType] ?? m.relation_type;
            const hasLive = m.live_lat && m.location_sharing;
            const liveAgo = hasLive ? timeAgo(m.live_location_at) : null;

            return (
              <div key={m.id}
                className="flex items-center gap-3 bg-gray-900/60 border border-white/[0.05] rounded-2xl px-4 py-3">
                {/* Avatar + status dot */}
                <div className="relative shrink-0">
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                    : <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-400">
                        {m.first_name[0]}
                      </div>
                  }
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${STATUS_DOT[status]}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {m.first_name} {m.last_name || ""}
                  </p>
                  <p className="text-gray-500 text-xs">{rel}</p>
                </div>

                {/* Status */}
                <div className="text-right shrink-0">
                  {hasLive ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <MapPin size={11} className="text-ceiba-400" />
                        <span className="text-ceiba-400 text-xs font-medium">En vivo</span>
                      </div>
                      <p className="text-gray-600 text-[10px]">{liveAgo}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock size={11} className={STATUS_TEXT[status]} />
                        <span className={`text-xs font-medium ${STATUS_TEXT[status]}`}>
                          {status === "now" ? "Activo" : "Visto"}
                        </span>
                      </div>
                      <p className="text-gray-600 text-[10px]">{timeAgo(m.last_seen_at)}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
