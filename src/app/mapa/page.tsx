"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, MapPin, X } from "lucide-react";
import { CosmicNav } from "@/components/ui/cosmic";
import type { SOSPin } from "./FamilyMapInner";

interface Person {
  name: string;
  birth_year: string | null;
}
interface Pin {
  lat: number;
  lng: number;
  city: string;
  country: string;
  people: Person[];
}

// ── Leaflet map loaded client-side only ───────────────────────────────────────
const FamilyMap = dynamic(() => import("./FamilyMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: "#030208", flexDirection: "column", gap: 12 }}>
      <MapPin size={32} style={{ color: "#d4af37", opacity: 0.5 }} />
      <span style={{ fontSize: 13, color: "rgba(212,175,55,0.5)" }}>Cargando mapa…</span>
    </div>
  ),
});

// ── Inner component that reads search params (requires Suspense) ──────────────
function MapaInner() {
  const searchParams = useSearchParams();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pin | null>(null);

  // SOS mode: center map on the person who triggered the alert
  const sosLat  = searchParams.get("lat");
  const sosLon  = searchParams.get("lon");
  const sosName = searchParams.get("name") ?? "Tu familiar";
  const sosPin: SOSPin | null = sosLat && sosLon
    ? { lat: parseFloat(sosLat), lng: parseFloat(sosLon), name: sosName }
    : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/family/map");
      if (res.ok) {
        const { pins: data } = await res.json();
        setPins(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column",
      background: "#030208", color: "#fff", overflow: "hidden", maxWidth: "100vw" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "calc(env(safe-area-inset-top, 20px) + 14px) 18px 14px",
        background: "rgba(3,2,8,0.97)", borderBottom: "0.5px solid rgba(212,175,55,0.14)",
        backdropFilter: "blur(12px)", flexShrink: 0, zIndex: 10,
      }}>
        <Link href="/home">
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
          </div>
        </Link>
        <div style={{ flex: 1 }}>
          {sosPin ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", letterSpacing: "-0.01em" }}>
                🚨 SOS — {sosPin.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(239,68,68,0.6)", marginTop: 2, letterSpacing: "0.04em" }}>
                Ubicación en tiempo real
              </div>
            </>
          ) : !loading && pins.length > 0 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                Tu historia se extiende por {pins.length} {pins.length === 1 ? "lugar" : "lugares"}
              </div>
              <div style={{ fontSize: 10, color: "rgba(242,180,60,0.45)", marginTop: 2, letterSpacing: "0.04em" }}>
                {pins.reduce((n, p) => n + p.people.length, 0)} familiares en el mapa
              </div>
            </>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Mapa familiar</div>
          )}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
          borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
          borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 5px 0 #02010a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MapPin size={16} style={{ color: sosPin ? "#ef4444" : "#d4af37" }} />
        </div>
      </div>

      {/* SOS banner */}
      {sosPin && (
        <div style={{
          background: "#b91c1c", color: "#fff",
          padding: "10px 18px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          animation: "sos-banner-pulse 1.2s ease-in-out infinite",
        }}>
          <style>{`@keyframes sos-banner-pulse{0%,100%{background:#b91c1c}50%{background:#ef4444}}`}</style>
          <span style={{ fontSize: 18 }}>🚨</span>
          <span>{sosPin.name} activó una alerta SOS — su ubicación exacta está marcada abajo</span>
        </div>
      )}

      {/* Map fills remaining height */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#0c0a18",
              border: "1.5px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={24} style={{ color: "rgba(212,175,55,0.6)" }} />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Geocodificando ubicaciones…</span>
          </div>
        ) : pins.length === 0 && !sosPin ? (
          <EmptyMap />
        ) : (
          <FamilyMap pins={pins} onSelect={setSelected} sosPin={sosPin} />
        )}

        {/* Selected pin panel */}
        {selected && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "rgba(5,3,14,0.97)",
            backdropFilter: "blur(36px)", WebkitBackdropFilter: "blur(36px)",
            borderRadius: "24px 24px 0 0",
            borderTop: "0.5px solid rgba(242,180,60,0.40)",
            boxShadow: "0 -20px 60px rgba(0,0,0,0.92), 0 0 80px rgba(242,180,60,0.06)",
            padding: "0 0 48px",
            maxHeight: "60vh", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ position: "absolute", top: -10, left: "25%", width: 200, height: 80,
              borderRadius: "50%", background: "radial-gradient(ellipse, rgba(212,175,55,0.07) 0%, transparent 65%)",
              filter: "blur(14px)", pointerEvents: "none" }} />

            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
              <div style={{ width: 32, height: 3, borderRadius: 2, background: "rgba(242,180,60,0.30)" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 20px 14px" }}>
              <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                <div style={{ position: "absolute", inset: -8, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(242,180,60,0.22) 0%, transparent 65%)",
                  filter: "blur(6px)" }} />
                <div style={{ width: 44, height: 44, borderRadius: "50%", position: "relative",
                  background: "radial-gradient(circle at 35% 28%, rgba(242,180,60,0.22) 0%, rgba(8,5,18,0.97) 65%)",
                  border: "1px solid rgba(242,180,60,0.30)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 16px rgba(242,180,60,0.15), inset 0 2px 10px rgba(120,60,220,0.18)" }}>
                  <MapPin size={18} style={{ color: "#d4af37" }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#F5EDD8", letterSpacing: "-0.01em" }}>
                  {selected.city}
                </div>
                <div style={{ fontSize: 10, color: "rgba(242,180,60,0.50)", marginTop: 2,
                  letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  {selected.country}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none",
                cursor: "pointer", padding: 6, color: "rgba(255,255,255,0.30)" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ height: 0.5,
              background: "linear-gradient(90deg, transparent, rgba(242,180,60,0.18), transparent)",
              margin: "0 20px 14px" }} />

            <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "rgba(242,180,60,0.45)" }}>
                {selected.people.length} {selected.people.length === 1 ? "familiar" : "familiares"}
              </span>
              <div style={{ flex: 1, height: 0.5, background: "rgba(242,180,60,0.08)" }} />
            </div>

            <div style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0, padding: "0 20px", flex: 1 }}>
              {selected.people.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0",
                  borderBottom: i < selected.people.length - 1
                    ? "0.5px solid rgba(242,180,60,0.06)" : "none" }}>
                  <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                    <div style={{ position: "absolute", inset: -6, borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(242,180,60,0.18) 0%, transparent 68%)",
                      filter: "blur(5px)" }} />
                    <div style={{ width: 40, height: 40, borderRadius: "50%", position: "relative",
                      background: "radial-gradient(circle at 35% 27%, rgba(242,180,60,0.22) 0%, rgba(8,5,18,0.97) 65%)",
                      border: "1px solid rgba(242,180,60,0.24)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 400, color: "#F2B43C", letterSpacing: "0.04em" }}>
                      {p.name[0]?.toUpperCase() ?? "?"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#F5EDD8" }}>{p.name}</div>
                    {p.birth_year && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2,
                        letterSpacing: "0.04em" }}>
                        n. {p.birth_year}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <CosmicNav />
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100dvh", background: "#030208", display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        <MapPin size={32} style={{ color: "rgba(212,175,55,0.4)" }} />
      </div>
    }>
      <MapaInner />
    </Suspense>
  );
}

function EmptyMap() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0c0a18",
        border: "1px solid rgba(212,175,55,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MapPin size={28} style={{ color: "rgba(212,175,55,0.4)" }} />
      </div>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Sin ubicaciones aún</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
          Agrega la ciudad y país de nacimiento a tus familiares en la galaxia para verlos aquí.
        </p>
      </div>
      <Link href="/tree" style={{ textDecoration: "none" }}>
        <div style={{ background: "#c9a820", borderRadius: 12, padding: "10px 22px",
          borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
          boxShadow: "0 6px 0 #4a3c00", fontSize: 13, fontWeight: 700, color: "#030208" }}>
          Ir a la galaxia
        </div>
      </Link>
    </div>
  );
}
