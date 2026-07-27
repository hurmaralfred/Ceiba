"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TreePine, MapPin, ToggleLeft, ToggleRight, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyTreeNode } from "@/lib/types";
import toast from "react-hot-toast";

// Leaflet must be loaded client-side only
const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();
  const [relatives, setRelatives] = useState<FamilyTreeNode[]>([]);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadPresence = useCallback(async () => {
    const res = await fetch("/api/presence");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "No se pudo cargar el mapa familiar");
      setLoading(false);
      return;
    }
    const { members, sharing, myLocation: mine } = await res.json();

    setLocationEnabled(!!sharing);
    setMyLocation(mine ? [mine.lat, mine.lng] : null);
    setRelatives(
      (members ?? []).map((m: any) => ({
        profile_id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        avatar_url: m.avatar_url,
        relation_path: [],
        depth: 1,
        location_enabled: true,
        latitude: m.live_lat,
        longitude: m.live_lng,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      loadPresence();
    });
  }, [loadPresence]);

  const toggleLocation = useCallback(async () => {
    if (toggling) return;
    setToggling(true);

    if (!locationEnabled) {
      if (!navigator.geolocation) {
        toast.error("Tu navegador no soporta geolocalización");
        setToggling(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const res = await fetch("/api/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            toast.error(body.error || "Error guardando ubicación");
            setToggling(false);
            return;
          }
          setMyLocation([latitude, longitude]);
          setLocationEnabled(true);
          toast.success("Ubicación activada");
          setToggling(false);
        },
        () => {
          toast.error("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
          setToggling(false);
        }
      );
    } else {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pause: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Error al desactivar ubicación");
        setToggling(false);
        return;
      }
      setLocationEnabled(false);
      setMyLocation(null);
      toast.success("Ubicación desactivada");
      setToggling(false);
    }
  }, [locationEnabled, toggling]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <TreePine size={22} className="text-ceiba-300" /> Mapa familiar
          </div>
        </div>
        <button
          onClick={toggleLocation}
          disabled={toggling}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          {locationEnabled ? <ToggleRight size={20} className="text-ceiba-300" /> : <ToggleLeft size={20} />}
          {locationEnabled ? "Ubicación activa" : "Activar ubicación"}
        </button>
      </nav>

      {/* Info banner */}
      <div className="bg-ceiba-50 border-b border-ceiba-100 px-6 py-3 text-sm text-ceiba-800 flex items-center gap-2">
        <MapPin size={16} className="text-ceiba-600 flex-shrink-0" />
        <span>
          {locationEnabled
            ? `Mostrando ${relatives.length} familiar${relatives.length !== 1 ? "es" : ""} con ubicación activa`
            : "Activa tu ubicación para aparecer en el mapa de tus familiares"}
        </span>
      </div>

      {/* Map */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin size={36} className="text-ceiba-400 mx-auto mb-2 animate-bounce" />
              <p className="text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-180px)] rounded-2xl overflow-hidden shadow-sm border border-gray-200">
            <MapView myLocation={myLocation} relatives={relatives} />
          </div>
        )}
      </div>

      {/* Relatives with location */}
      {relatives.length > 0 && (
        <div className="px-4 pb-6 max-w-4xl w-full mx-auto">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">Familiares en el mapa ({relatives.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {relatives.map(r => (
              <div key={r.profile_id} className="flex-shrink-0 bg-white border border-gray-200 rounded-xl px-4 py-3 min-w-[140px] shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-ceiba-700 text-white flex items-center justify-center font-bold text-sm mb-2">
                  {r.first_name[0]}{r.last_name ? r.last_name[0] : ""}
                </div>
                <div className="font-semibold text-sm text-gray-900 truncate">{r.first_name} {r.last_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.city || "Ubicación desconocida"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
