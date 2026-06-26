"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TreePine, MapPin, ToggleLeft, ToggleRight, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyTreeNode, RELATION_LABELS } from "@/lib/types";
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    // Load user's location preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("location_enabled, latitude, longitude")
      .eq("id", user.id)
      .single();

    if (profile?.location_enabled) {
      setLocationEnabled(true);
      if (profile.latitude && profile.longitude) {
        setMyLocation([profile.latitude, profile.longitude]);
      }
    }

    // Load family tree (only those with location enabled)
    const { data: tree } = await supabase.rpc("get_family_tree", {
      start_profile_id: user.id,
      max_depth: 10,
    });
    setRelatives((tree || []).filter((n: FamilyTreeNode) => n.location_enabled && n.latitude && n.longitude));
    setLoading(false);
  };

  const toggleLocation = useCallback(async () => {
    if (!userId) return;
    if (!locationEnabled) {
      // Request browser location
      if (!navigator.geolocation) {
        toast.error("Tu navegador no soporta geolocalización");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const { error } = await supabase.from("profiles").update({
            location_enabled: true,
            latitude,
            longitude,
            location_updated_at: new Date().toISOString(),
          }).eq("id", userId);
          if (error) { toast.error("Error guardando ubicación"); return; }
          setMyLocation([latitude, longitude]);
          setLocationEnabled(true);
          toast.success("Ubicación activada");
        },
        () => toast.error("No se pudo obtener tu ubicación. Revisa los permisos del navegador.")
      );
    } else {
      await supabase.from("profiles").update({ location_enabled: false, latitude: null, longitude: null }).eq("id", userId);
      setLocationEnabled(false);
      setMyLocation(null);
      toast.success("Ubicación desactivada");
    }
  }, [locationEnabled, userId]);

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
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
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
                  {r.first_name[0]}{r.last_name[0]}
                </div>
                <div className="font-semibold text-sm text-gray-900 truncate">{r.first_name} {r.last_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.city || "Ubicación desconocida"}</div>
                <div className="text-xs text-ceiba-600 mt-1">{r.depth} grado{r.depth !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
