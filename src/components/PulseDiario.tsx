"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";

interface Memory {
  id: string;
  body: string;
  memory_date: string;
  photo_path: string | null;
  author: { name: string; photo: string | null };
  years_ago: number;
}

export default function PulseDiario() {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hoy")
      .then((r) => r.ok ? r.json() : { memories: [] })
      .then(({ memories }) => {
        const valid = (memories ?? []).filter((m: Memory) => m.years_ago >= 1);
        setMemory(valid[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !memory) return null;

  const yearLabel =
    memory.years_ago === 1 ? "hace 1 año" : `hace ${memory.years_ago} años`;
  const preview =
    memory.body.length > 120 ? memory.body.slice(0, 117) + "…" : memory.body;

  return (
    <div style={{ padding: "0 14px" }}>
      {/* Section eyebrow */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "rgba(212,175,55,0.4)",
        marginBottom: 12,
      }}>
        Un día como hoy
      </div>

      <Link href="/hoy" style={{ textDecoration: "none", display: "block" }}>
        <div style={{
          borderRadius: 20,
          background: "#0c0a18",
          borderTop: "1.5px solid rgba(212,175,55,0.3)",
          borderLeft: "1px solid rgba(212,175,55,0.14)",
          borderBottom: "4px solid #040300",
          borderRight: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 8px 0 #040300, 0 16px 32px rgba(0,0,0,0.85), 0 0 28px rgba(212,175,55,0.07)",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Ambient glow */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 15% 50%, rgba(212,175,55,0.06) 0%, transparent 60%)",
          }} />

          {/* Photo strip */}
          {memory.photo_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={memory.photo_path}
              alt=""
              style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }}
            />
          )}

          <div style={{ padding: "14px 16px 16px", position: "relative" }}>
            {/* Year badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(212,175,55,0.08)",
              border: "1px solid rgba(212,175,55,0.22)",
              borderRadius: 100, padding: "3px 10px",
              marginBottom: 10,
            }}>
              <Clock size={10} style={{ color: "#d4af37" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#d4af37", letterSpacing: "0.06em" }}>
                {yearLabel}
              </span>
            </div>

            {/* Memory text */}
            <p style={{
              fontSize: 14, lineHeight: 1.65,
              color: "rgba(255,255,255,0.82)",
              margin: "0 0 12px",
              wordBreak: "break-word",
            }}>
              {preview}
            </p>

            {/* Author + CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "#1a1030", border: "1.5px solid rgba(212,175,55,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#d4af37", overflow: "hidden",
                }}>
                  {memory.author.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={memory.author.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    : memory.author.name[0]}
                </div>
                <span style={{ fontSize: 11, color: "rgba(212,175,55,0.6)", fontWeight: 600 }}>
                  {memory.author.name}
                </span>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)",
              }}>
                Ver más <ChevronRight size={13} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
