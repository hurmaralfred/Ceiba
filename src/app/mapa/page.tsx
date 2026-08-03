"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, MapPin, Users, X } from "lucide-react";

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

export default function MapaPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pin | null>(null);

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
      background: "#030208", color: "#fff", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "52px 18px 14px",
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
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Mapa familiar</div>
          {!loading && (
            <div style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", marginTop: 1 }}>
              {pins.length} {pins.length === 1 ? "lugar" : "lugares"} ·{" "}
              {pins.reduce((n, p) => n + p.people.length, 0)} personas
            </div>
          )}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
          borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
          borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 5px 0 #02010a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MapPin size={16} style={{ color: "#d4af37" }} />
        </div>
      </div>

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
        ) : pins.length === 0 ? (
          <EmptyMap />
        ) : (
          <FamilyMap pins={pins} onSelect={setSelected} />
        )}

        {/* Selected pin sheet */}
        {selected && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "#0c0a18", borderRadius: "20px 20px 0 0",
            borderTop: "1px solid rgba(212,175,55,0.22)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.8)",
            padding: "0 0 40px",
            maxHeight: "55vh", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(212,175,55,0.25)" }} />
            </div>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 12px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: "#160e02",
                borderTop: "1.5px solid rgba(212,175,55,0.4)", borderBottom: "2px solid #060300",
                borderLeft: "1px solid rgba(212,175,55,0.18)", borderRight: "1px solid rgba(0,0,0,0.5)",
                boxShadow: "0 4px 0 #060300", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MapPin size={17} style={{ color: "#d4af37" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{selected.city}</div>
                <div style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginTop: 1 }}>{selected.country}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none",
                cursor: "pointer", padding: 6 }}>
                <X size={18} style={{ color: "rgba(255,255,255,0.4)" }} />
              </button>
            </div>
            {/* Divider */}
            <div style={{ height: 0.5, background: "rgba(212,175,55,0.1)", margin: "0 18px 12px" }} />
            {/* People list */}
            <div style={{ overflowY: "auto", padding: "0 18px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <Users size={12} style={{ color: "rgba(212,175,55,0.5)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.5)" }}>
                  {selected.people.length} {selected.people.length === 1 ? "familiar" : "familiares"}
                </span>
              </div>
              {selected.people.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", borderBottom: i < selected.people.length - 1
                    ? "0.5px solid rgba(212,175,55,0.07)" : "none" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#18102a",
                    border: "1.5px solid rgba(212,175,55,0.2)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#d4af37" }}>
                    {p.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
                    {p.birth_year && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
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
    </div>
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
          Agrega la ciudad y país de nacimiento a tus familiares en el árbol para verlos aquí.
        </p>
      </div>
      <Link href="/tree" style={{ textDecoration: "none" }}>
        <div style={{ background: "#c9a820", borderRadius: 12, padding: "10px 22px",
          borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
          boxShadow: "0 6px 0 #4a3c00", fontSize: 13, fontWeight: 700, color: "#030208" }}>
          Ir al árbol
        </div>
      </Link>
    </div>
  );
}
