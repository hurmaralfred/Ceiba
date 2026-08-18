"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActivityItem } from "@/app/api/activity/route";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return min <= 1 ? "hace un momento" : `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  return hrs === 1 ? "hace 1 hora" : `hace ${hrs} horas`;
}

function typeIcon(type: ActivityItem["type"]) {
  if (type === "memory")   return "✨";
  if (type === "reaction") return "💬";
  if (type === "photo")    return "📸";
  if (type === "joined")   return "🌱";
  return "•";
}

function typeHref(type: ActivityItem["type"]) {
  if (type === "photo") return "/photos";
  if (type === "memory") return "/muro";
  return "/hoy";
}

export default function ActividadFamiliar() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then(({ items: data }) => setItems(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <div style={{ padding: "0 14px" }}>
      {/* Eyebrow */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "rgba(212,175,55,0.4)",
        marginBottom: 12,
      }}>
        Actividad familiar · últimas 24h
      </div>

      <div style={{
        borderRadius: 18,
        background: "#0c0a18",
        borderTop: "1.5px solid rgba(212,175,55,0.18)",
        borderLeft: "1px solid rgba(212,175,55,0.08)",
        borderBottom: "3px solid #040300",
        borderRight: "1px solid rgba(0,0,0,0.5)",
        boxShadow: "0 6px 0 #040300, 0 12px 24px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>
        {items.map((item, idx) => (
          <Link
            key={item.id}
            href={typeHref(item.type)}
            style={{ textDecoration: "none", display: "block" }}
          >
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 14px",
              borderBottom: idx < items.length - 1
                ? "0.5px solid rgba(255,255,255,0.05)"
                : "none",
            }}>
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                background: "#1a1030",
                border: "1.5px solid rgba(212,175,55,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#d4af37",
                overflow: "hidden", position: "relative",
              }}>
                {item.actorPhoto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.actorPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : item.actorName[0]?.toUpperCase()}
                {/* Type badge */}
                <div style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#0c0a18", border: "1px solid rgba(212,175,55,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, lineHeight: 1,
                }}>
                  {typeIcon(item.type)}
                </div>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12, lineHeight: 1.5,
                  color: "rgba(255,255,255,0.75)",
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}>
                  <span style={{ fontWeight: 700, color: "#fff" }}>
                    {item.actorName}
                  </span>{" "}
                  {item.text}
                </p>
                <span style={{
                  fontSize: 10, color: "rgba(212,175,55,0.4)",
                  marginTop: 3, display: "block",
                }}>
                  {timeAgo(item.createdAt)}
                </span>
              </div>

              {/* Thumb */}
              {item.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbUrl}
                  alt=""
                  style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    objectFit: "cover",
                    border: "1px solid rgba(212,175,55,0.15)",
                  }}
                />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
