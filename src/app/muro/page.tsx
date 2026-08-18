"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface Author {
  name: string;
  photo: string | null;
}

interface Response {
  id: string;
  body: string;
  photo_path: string | null;
  created_at: string;
  is_mine: boolean;
  author: Author;
}

interface MuroData {
  question: string | null;
  responses: Response[];
  dates: string[];
  targetDate: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  return hrs === 1 ? "hace 1 hora" : `hace ${hrs} horas`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export default function MuroPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [activeDate, setActiveDate] = useState(today);
  const [data, setData] = useState<MuroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/muro?date=${date}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeDate); }, [activeDate, load]);

  // Reload after submit to show new response
  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => { load(activeDate); setSubmitted(false); }, 600);
      return () => clearTimeout(t);
    }
  }, [submitted, activeDate, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/muro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      if (r.ok) { setText(""); setSubmitted(true); }
    } finally {
      setSubmitting(false);
    }
  }

  const allDates = data
    ? [...new Set([today, ...(data.dates ?? [])])].sort((a, b) => b.localeCompare(a)).slice(0, 14)
    : [today];

  return (
    <div style={{ minHeight: "100vh", background: "#050410", color: "rgba(255,255,255,0.9)", fontFamily: "system-ui,sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 12px" }}>
        <Link href="/home" style={{
          width: 34, height: 34, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          textDecoration: "none", color: "rgba(255,255,255,0.5)", fontSize: 16, flexShrink: 0,
        }}>←</Link>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em" }}>Muro familiar</div>
          <div style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginTop: 1 }}>
            Recuerdos compartidos por todos
          </div>
        </div>
      </div>

      {/* ── Date pills ── */}
      <div style={{ overflowX: "auto", display: "flex", gap: 8, padding: "0 16px 16px", scrollbarWidth: "none" }}>
        {allDates.map((d) => {
          const active = d === activeDate;
          const label = isToday(d) ? "Hoy" : new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
          return (
            <button
              key={d}
              onClick={() => setActiveDate(d)}
              style={{
                flexShrink: 0, padding: "7px 16px", borderRadius: 50,
                border: active ? "1px solid rgba(212,175,55,0.6)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#d4af37" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                transition: "all 0.18s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Question ── */}
      <div style={{ margin: "0 16px 16px" }}>
        <div style={{
          background: "#0c0a18",
          borderRadius: 18,
          border: "1px solid rgba(212,175,55,0.14)",
          borderTop: "1.5px solid rgba(212,175,55,0.28)",
          padding: "16px",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(212,175,55,0.42)", marginBottom: 8,
          }}>
            {isToday(activeDate) ? "Pregunta del día" : fmtDate(activeDate)}
          </div>
          {loading ? (
            <div style={{ height: 20, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: "80%" }} />
          ) : (
            <p style={{
              fontSize: 15, color: "rgba(255,255,255,0.88)", fontStyle: "italic",
              margin: 0, lineHeight: 1.65,
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}>
              {data?.question ?? "Sin pregunta registrada para este día"}
            </p>
          )}
        </div>
      </div>

      {/* ── Responses ── */}
      <div style={{ margin: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          [0, 1].map((i) => (
            <div key={i} style={{ height: 80, background: "rgba(255,255,255,0.03)", borderRadius: 16 }} />
          ))
        ) : (data?.responses ?? []).length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 20px",
            color: "rgba(255,255,255,0.28)", fontSize: 13,
          }}>
            Nadie ha respondido aún{isToday(activeDate) ? ". ¡Sé el primero!" : "."}
          </div>
        ) : (
          (data?.responses ?? []).map((r) => (
            <ResponseCard key={r.id} response={r} />
          ))
        )}
      </div>

      {/* ── Write response (only on today) ── */}
      {isToday(activeDate) && (
        <div style={{ margin: "16px 16px 0" }}>
          <form onSubmit={submit}>
            <div style={{
              background: "#0c0a18",
              borderRadius: 18,
              border: "1px solid rgba(180,140,255,0.12)",
              borderTop: "1.5px solid rgba(180,140,255,0.28)",
              padding: "14px",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(180,140,255,0.45)", marginBottom: 10,
              }}>
                Tu respuesta
              </div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Comparte lo que sabes, lo que recuerdas…"
                rows={4}
                style={{
                  width: "100%", background: "transparent",
                  border: "none", outline: "none", resize: "none",
                  color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.6,
                  fontFamily: "system-ui, sans-serif", boxSizing: "border-box",
                  caretColor: "#d4af37",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="submit"
                  disabled={!text.trim() || submitting}
                  style={{
                    padding: "9px 22px", borderRadius: 50,
                    background: text.trim() ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                    border: text.trim() ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.07)",
                    color: text.trim() ? "#d4af37" : "rgba(255,255,255,0.2)",
                    fontSize: 12, fontWeight: 700, cursor: text.trim() ? "pointer" : "default",
                    transition: "all 0.18s",
                  }}
                >
                  {submitting ? "Guardando…" : submitted ? "✓ Compartido" : "Compartir recuerdo"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Bottom padding */}
      <div style={{ height: 48 }} />
    </div>
  );
}

function ResponseCard({ response }: { response: Response }) {
  const initials = response.author.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      background: response.is_mine ? "rgba(212,175,55,0.05)" : "#0c0a18",
      borderRadius: 16,
      border: response.is_mine
        ? "1px solid rgba(212,175,55,0.20)"
        : "1px solid rgba(255,255,255,0.06)",
      padding: "14px",
    }}>
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "#1a1030",
          border: "1.5px solid rgba(212,175,55,0.20)",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)",
        }}>
          {response.author.photo ? (
            <Image
              src={response.author.photo}
              alt={response.author.name}
              width={32} height={32}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          ) : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
            {response.is_mine ? "Tú" : response.author.name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
            {timeAgo(response.created_at)}
          </div>
        </div>
        {response.is_mine && (
          <div style={{
            fontSize: 10, fontWeight: 700, color: "rgba(212,175,55,0.5)",
            background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)",
            borderRadius: 50, padding: "2px 10px",
          }}>
            Tú
          </div>
        )}
      </div>

      {/* Body */}
      <p style={{
        margin: 0, fontSize: 14, color: "rgba(255,255,255,0.78)", lineHeight: 1.65,
        fontFamily: "Georgia, serif", fontStyle: "italic",
      }}>
        {response.body}
      </p>
    </div>
  );
}
