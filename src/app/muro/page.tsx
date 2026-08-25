"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import toast, { Toaster } from "react-hot-toast";

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

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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
      else toast.error("No se pudo cargar el muro familiar");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeDate); }, [activeDate, load]);

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
        // Always send the active question so it gets persisted for future readers
        body: JSON.stringify({ body: text.trim(), question_text: data?.question ?? undefined }),
      });
      if (r.ok) { setText(""); setSubmitted(true); }
      else { const d = await r.json().catch(() => ({})); toast.error(d.error || "No se pudo publicar tu respuesta"); }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  const allDates = data
    ? [...new Set([today, ...(data.dates ?? [])])].sort((a, b) => b.localeCompare(a)).slice(0, 14)
    : [today];

  const question = data?.question ?? null;
  const responses = data?.responses ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#050410", color: "rgba(255,255,255,0.9)", fontFamily: "system-ui,sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1a1a2e", color: "#fff" } }} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 12px" }}>
        <Link href="/home" style={{
          width: 34, height: 34, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          textDecoration: "none", color: "rgba(255,255,255,0.5)", fontSize: 16, flexShrink: 0,
        }}>←</Link>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Muro familiar</div>
          <div style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginTop: 1 }}>
            Recuerdos compartidos por todos
          </div>
        </div>
      </div>

      {/* ── Date pills ── */}
      <div style={{ overflowX: "auto", display: "flex", gap: 8, padding: "0 16px 16px", scrollbarWidth: "none" }}>
        {allDates.map((d) => {
          const active = d === activeDate;
          const label = isToday(d)
            ? "Hoy"
            : new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
          return (
            <button key={d} onClick={() => setActiveDate(d)} style={{
              flexShrink: 0, padding: "7px 16px", borderRadius: 50,
              border: active ? "1px solid rgba(212,175,55,0.6)" : "1px solid rgba(255,255,255,0.08)",
              background: active ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
              color: active ? "#d4af37" : "rgba(255,255,255,0.4)",
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Question card ── */}
      <div style={{ margin: "0 16px 20px" }}>
        <div style={{
          background: "#0c0a18", borderRadius: 18,
          border: "1px solid rgba(212,175,55,0.14)",
          borderTop: "1.5px solid rgba(212,175,55,0.30)",
          padding: "16px",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(212,175,55,0.42)", marginBottom: 8,
          }}>
            {isToday(activeDate) ? "Pregunta del día" : fmtDate(activeDate)}
          </div>
          {loading ? (
            <div style={{ height: 18, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: "75%" }} />
          ) : question ? (
            <p style={{
              fontSize: 15, color: "rgba(255,255,255,0.90)", fontStyle: "italic",
              margin: 0, lineHeight: 1.65,
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}>
              {question}
            </p>
          ) : (
            <p style={{
              fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5,
            }}>
              No hay pregunta registrada para este día.
            </p>
          )}
        </div>
      </div>

      {/* ── Write response (today only, above responses so it's immediately visible) ── */}
      {isToday(activeDate) && (
        <div style={{ margin: "0 16px 20px" }}>
          <form onSubmit={submit}>
            <div style={{
              background: "#0c0a18", borderRadius: 18,
              border: "1px solid rgba(180,140,255,0.12)",
              borderTop: "1.5px solid rgba(180,140,255,0.30)",
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
                rows={3}
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

      {/* ── Section label ── */}
      {!loading && responses.length > 0 && (
        <div style={{
          padding: "0 16px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.18)",
        }}>
          {responses.length} {responses.length === 1 ? "respuesta" : "respuestas"}
        </div>
      )}

      {/* ── Responses ── */}
      <div style={{ margin: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          [0, 1].map((i) => (
            <div key={i} style={{ height: 80, background: "rgba(255,255,255,0.03)", borderRadius: 16 }} />
          ))
        ) : responses.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "28px 20px",
            color: "rgba(255,255,255,0.25)", fontSize: 13,
          }}>
            {isToday(activeDate)
              ? "Sé el primero en compartir algo hoy."
              : "Nadie compartió nada en este día."}
          </div>
        ) : (
          responses.map((r) => (
            <ResponseCard key={r.id} response={r} question={question} isPast={!isToday(activeDate)} />
          ))
        )}
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}

function ResponseCard({ response, question, isPast }: {
  response: Response;
  question: string | null;
  isPast: boolean;
}) {
  const initials = response.author.name
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      background: response.is_mine ? "rgba(212,175,55,0.05)" : "#0c0a18",
      borderRadius: 16,
      border: response.is_mine
        ? "1px solid rgba(212,175,55,0.22)"
        : "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
    }}>
      {/* Question context stripe — only on past dates when there IS a question,
          so the card makes sense standalone without scrolling up */}
      {isPast && question && (
        <div style={{
          padding: "9px 14px",
          background: "rgba(212,175,55,0.06)",
          borderBottom: "1px solid rgba(212,175,55,0.10)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>💬</span>
          <p style={{
            margin: 0, fontSize: 11, color: "rgba(212,175,55,0.65)",
            fontStyle: "italic", lineHeight: 1.5,
            fontFamily: "Georgia, serif",
          }}>
            {question}
          </p>
        </div>
      )}

      <div style={{ padding: "14px" }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#1a1030", border: "1.5px solid rgba(212,175,55,0.20)",
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
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>
              {new Date(response.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Body */}
        <p style={{
          margin: 0, fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 1.65,
          fontFamily: "Georgia, serif", fontStyle: "italic",
        }}>
          {response.body}
        </p>
      </div>
    </div>
  );
}
