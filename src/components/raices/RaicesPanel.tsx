"use client";
import { useState, useRef, useEffect } from "react";
import { Send, X, Check, Trash2, Share2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const DAILY_LIMIT = 10;
const POLICY_VERSION = "1.0";

// ── Types ─────────────────────────────────────────────────────────────
interface AiSource {
  type: string;
  detail: string;
  weight?: number;
}

interface AiSuggestion {
  id?: string; // set after save
  suggestion_type: string;
  confidence: number;
  sources: AiSource[];
  suggested_data: {
    anchor_person_id?: string;
    first_name?: string;
    first_surname?: string;
    second_surname?: string;
    birth_date?: string;
    birth_city?: string;
    gender?: string;
    is_deceased?: boolean;
    notes?: string;
  };
  status?: "pending" | "approved" | "discarded";
}

interface AiFinding {
  type: string;
  description: string;
  person_ids: string[];
}

interface RaicesResponse {
  findings: AiFinding[];
  suggestions: AiSuggestion[];
  remaining_today: number;
  limit: number;
  error?: string;
}

type PanelStep = "closed" | "consent" | "chat";

// ── Component ─────────────────────────────────────────────────────────
export default function RaicesPanel() {
  const supabase = createClient();

  const [step, setStep] = useState<PanelStep>("closed");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [remaining, setRemaining] = useState<number>(DAILY_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasQueried = useRef(false);

  // ── Open panel: check consent ──────────────────────────────────────
  async function handleOpen() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get space_id lazily
      const { data: sm } = await supabase
        .from("space_memberships")
        .select("space_id")
        .limit(1)
        .maybeSingle();

      if (sm?.space_id) setSpaceId(sm.space_id);

      // Check consent
      const { data: consent } = await supabase
        .from("consents")
        .select("granted")
        .eq("user_id", user.id)
        .eq("consent_type", "ai_processing")
        .eq("granted", true)
        .maybeSingle();

      setStep(consent ? "chat" : "consent");
    } catch {
      setError("Error al iniciar Raíces.");
      setStep("chat");
    } finally {
      setLoading(false);
    }
  }

  // Focus input when chat opens
  useEffect(() => {
    if (step === "chat" && !limitReached) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [step, limitReached]);

  // ── Accept consent ─────────────────────────────────────────────────
  async function handleAcceptConsent() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("consents").insert({
        user_id: user.id,
        consent_type: "ai_processing",
        granted: true,
        policy_version: POLICY_VERSION,
      });
      setStep("chat");
    } catch {
      setError("No se pudo guardar el consentimiento.");
    } finally {
      setLoading(false);
    }
  }

  // ── Send message to edge function ──────────────────────────────────
  async function handleSend() {
    if (!message.trim() || loading || limitReached) return;
    setLoading(true);
    setError(null);
    const msg = message.trim();
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión");

      const sid = spaceId ?? await fetchSpaceId();
      if (!sid) throw new Error("No se encontró el árbol familiar.");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/raices-ai`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ space_id: sid, message: msg }),
      });

      const data: RaicesResponse = await res.json();

      if (res.status === 429) {
        setLimitReached(true);
        setRemaining(0);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Error procesando la consulta.");
        return;
      }

      // Load saved suggestions from DB (they have IDs now)
      if (data.suggestions.length > 0 && sid) {
        const { data: saved } = await supabase
          .from("ai_suggestions")
          .select("id, suggestion_type, confidence, sources, suggested_data, status")
          .eq("space_id", sid)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(data.suggestions.length);

        if (saved?.length) {
          setSuggestions(saved as AiSuggestion[]);
        } else {
          setSuggestions(data.suggestions);
        }
      } else {
        setSuggestions(data.suggestions);
      }

      setFindings(data.findings ?? []);
      setRemaining(data.remaining_today ?? DAILY_LIMIT - 1);
      if ((data.remaining_today ?? 1) <= 0) setLimitReached(true);
      hasQueried.current = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSpaceId(): Promise<string | null> {
    const { data: sm } = await supabase
      .from("space_memberships")
      .select("space_id")
      .limit(1)
      .maybeSingle();
    const sid = sm?.space_id ?? null;
    if (sid) setSpaceId(sid);
    return sid;
  }

  // ── Approve suggestion ─────────────────────────────────────────────
  async function handleApprove(sug: AiSuggestion) {
    if (!sug.id) return;
    try {
      await supabase.rpc("apply_ai_suggestion", { p_suggestion_id: sug.id });
      setApplied(prev => new Set(prev).add(sug.id!));
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
    } catch {
      setError("No se pudo aplicar la sugerencia.");
    }
  }

  // ── Discard suggestion ─────────────────────────────────────────────
  async function handleDiscard(sug: AiSuggestion) {
    if (!sug.id) return;
    try {
      await supabase
        .from("ai_suggestions")
        .update({ status: "discarded" })
        .eq("id", sug.id);
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
    } catch {
      setError("No se pudo descartar la sugerencia.");
    }
  }

  // ── WhatsApp invite for living relatives ───────────────────────────
  function whatsappHref(name: string): string {
    const text = `Hola ${name}, te encontré en el árbol familiar de Ceiba. ¿Te unirías para completar la historia de nuestra familia? 🌳\n\nceibapp.com/invitar`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function confidenceLabel(c: number): string {
    if (c >= 0.85) return "Alta confianza";
    if (c >= 0.6) return "Confianza media";
    return "Baja confianza";
  }

  function suggestionLabel(type: string): string {
    const labels: Record<string, string> = {
      add_parent: "Agregar padre/madre",
      add_child: "Agregar hijo/a",
      add_partner: "Agregar pareja",
      add_sibling: "Agregar hermano/a",
      add_person: "Agregar persona",
      correct_data: "Corregir datos",
      merge_duplicate: "Fusionar duplicado",
    };
    return labels[type] ?? type;
  }

  function fullName(data: AiSuggestion["suggested_data"]): string {
    return [data.first_name, data.first_surname, data.second_surname]
      .filter(Boolean).join(" ");
  }

  // ── Render: FAB only ───────────────────────────────────────────────
  if (step === "closed") {
    return (
      <>
        <style>{`
          .raices-fab {
            position: fixed;
            bottom: calc(164px + env(safe-area-inset-bottom));
            right: 18px;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: #1E2E4A;
            border-top: 2px solid #3a5080;
            border-left: 1.5px solid rgba(255,255,255,0.12);
            border-bottom: 4px solid #0d1a2e;
            border-right: 1.5px solid rgba(0,0,0,0.3);
            box-shadow: 0 6px 0 #08101d, 0 12px 24px rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 49;
            font-size: 18px;
            line-height: 1;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .raices-fab:hover {
            transform: scale(1.1) translateY(-2px);
            box-shadow: 0 8px 0 #08101d, 0 16px 32px rgba(30,46,74,0.8);
          }
          .raices-fab:active {
            transform: scale(0.94) translateY(2px);
            box-shadow: 0 3px 0 #08101d, 0 6px 12px rgba(0,0,0,0.5);
            border-bottom-width: 2px;
          }
          @media (min-width: 768px) {
            .raices-fab {
              bottom: calc(172px + env(safe-area-inset-bottom));
              right: 28px;
            }
          }
          @media (min-width: 1024px) {
            .raices-fab { bottom: 88px; }
          }
        `}</style>
        <button
          className="raices-fab"
          onClick={handleOpen}
          disabled={loading}
          aria-label="Abrir Raíces IA"
          title="Raíces IA"
        >
          🌿
        </button>
      </>
    );
  }

  // ── Render: consent sheet ──────────────────────────────────────────
  if (step === "consent") {
    return (
      <>
        <div
          onClick={() => setStep("closed")}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "rgba(3,2,8,0.75)", backdropFilter: "blur(5px)",
          }}
        />
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 81,
          background: "#0c0a18",
          borderTop: "1.5px solid rgba(30,46,74,0.8)",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px calc(40px + env(safe-area-inset-bottom))",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.9)",
        }}>
          {/* Handle */}
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: "rgba(30,46,74,0.5)", margin: "0 auto 24px",
          }} />

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#1E2E4A", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 22, flexShrink: 0,
            }}>🌿</div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 3 }}>
                Raíces IA
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(30,46,74,0.6)", borderRadius: 20, padding: "3px 10px",
                fontSize: 11, fontWeight: 700, color: "#8ba8d8", letterSpacing: "0.05em",
              }}>
                10 consultas gratis · cada día
              </div>
            </div>
          </div>

          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 8 }}>
            Raíces analiza tu árbol genealógico con inteligencia artificial para sugerirte conexiones familiares que podrían faltar.
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, marginBottom: 24 }}>
            Al continuar, aceptas que el contenido de tu árbol familiar (nombres, fechas, relaciones) sea procesado por Anthropic para generar sugerencias.
            Tus datos se tratan conforme a la Ley 1581 de 2012 (Colombia) y nuestra{" "}
            <span style={{ color: "#8ba8d8" }}>política de privacidad</span>.
          </p>

          {error && (
            <div style={{
              background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)",
              borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff8080",
              marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            onClick={handleAcceptConsent}
            disabled={loading}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 14, marginBottom: 10,
              background: "#1E2E4A",
              borderTop: "2px solid #3a5080",
              borderLeft: "1.5px solid rgba(255,255,255,0.1)",
              borderBottom: "4px solid #0d1a2e",
              borderRight: "1.5px solid rgba(0,0,0,0.3)",
              boxShadow: "0 6px 0 #08101d, 0 12px 24px rgba(0,0,0,0.6)",
              color: "#fff", fontSize: 15, fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Guardando…" : "Entendido, activar Raíces"}
          </button>
          <button
            onClick={() => setStep("closed")}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 14,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ahora no
          </button>
        </div>
      </>
    );
  }

  // ── Render: chat panel ─────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setStep("closed")}
        style={{
          position: "fixed", inset: 0, zIndex: 80,
          background: "rgba(3,2,8,0.75)", backdropFilter: "blur(5px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 81,
        background: "#0c0a18",
        borderTop: "1.5px solid rgba(30,46,74,0.6)",
        borderRadius: "20px 20px 0 0",
        maxHeight: "85vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.9)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 12px",
          borderBottom: "1px solid rgba(30,46,74,0.4)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🌿</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Raíces IA</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              background: "rgba(30,46,74,0.6)", color: "#8ba8d8",
              borderRadius: 20, padding: "2px 8px",
            }}>
              {remaining}/{DAILY_LIMIT} consultas
            </span>
          </div>
          <button
            onClick={() => setStep("closed")}
            style={{
              background: "transparent", border: "none",
              color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 4,
            }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

          {/* Limit reached banner */}
          {limitReached && (
            <div style={{
              background: "rgba(200,136,42,0.15)",
              border: "1px solid rgba(200,136,42,0.4)",
              borderRadius: 12, padding: "12px 14px", marginBottom: 16,
              fontSize: 13, color: "#C8882A", lineHeight: 1.5,
            }}>
              Has alcanzado el límite de {DAILY_LIMIT} consultas por hoy. Vuelve mañana para seguir explorando tu árbol. 🌿
            </div>
          )}

          {/* Anomaly findings */}
          {findings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                marginBottom: 8,
              }}>
                Anomalías detectadas
              </div>
              {findings.map((f, i) => (
                <div key={i} style={{
                  background: "rgba(255,120,40,0.1)",
                  border: "1px solid rgba(255,120,40,0.25)",
                  borderRadius: 10, padding: "10px 12px", marginBottom: 8,
                  fontSize: 13, color: "rgba(255,200,150,0.85)", lineHeight: 1.5,
                }}>
                  ⚠️ {f.description}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                marginBottom: 10,
              }}>
                Sugerencias
              </div>
              {suggestions.map((sug, i) => (
                <SuggestionCard
                  key={sug.id ?? i}
                  sug={sug}
                  onApprove={handleApprove}
                  onDiscard={handleDiscard}
                  whatsappHref={whatsappHref}
                  suggestionLabel={suggestionLabel}
                  confidenceLabel={confidenceLabel}
                  fullName={fullName}
                />
              ))}
            </div>
          )}

          {/* Empty state after query */}
          {hasQueried.current && !loading && suggestions.length === 0 && findings.length === 0 && !error && (
            <div style={{
              textAlign: "center", padding: "32px 0",
              fontSize: 14, color: "rgba(255,255,255,0.35)",
            }}>
              No encontré sugerencias nuevas para este árbol. ¡Está muy completo! 🌳
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)",
              borderRadius: 10, padding: "10px 12px", marginBottom: 12,
              fontSize: 13, color: "#ff8080",
            }}>{error}</div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div style={{
              textAlign: "center", padding: "24px 0",
              fontSize: 13, color: "rgba(255,255,255,0.35)",
            }}>
              Analizando el árbol familiar…
            </div>
          )}

          {/* Initial hint when no query yet */}
          {!hasQueried.current && !loading && (
            <div style={{
              textAlign: "center", padding: "24px 0",
              fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.6,
            }}>
              Escribe una pregunta o envía en blanco para que Raíces analice tu árbol.
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{
          padding: "10px 12px 12px",
          borderTop: "1px solid rgba(30,46,74,0.4)",
          display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={limitReached ? "Límite diario alcanzado" : "¿Quién podría faltar en el árbol?"}
            disabled={limitReached || loading}
            rows={1}
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "10px 14px",
              color: limitReached ? "rgba(255,255,255,0.2)" : "#fff",
              fontSize: 14, resize: "none", lineHeight: 1.4,
              outline: "none", fontFamily: "inherit",
              cursor: limitReached ? "not-allowed" : "text",
            }}
          />
          <button
            onClick={handleSend}
            disabled={limitReached || loading}
            style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: limitReached || loading ? "rgba(30,46,74,0.4)" : "#1E2E4A",
              border: "none", cursor: limitReached || loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: limitReached || loading ? "rgba(255,255,255,0.2)" : "#fff",
              transition: "background 0.15s",
            }}
            aria-label="Enviar"
          >
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Suggestion Card ────────────────────────────────────────────────────
interface SuggestionCardProps {
  sug: AiSuggestion;
  onApprove: (s: AiSuggestion) => void;
  onDiscard: (s: AiSuggestion) => void;
  whatsappHref: (name: string) => string;
  suggestionLabel: (t: string) => string;
  confidenceLabel: (c: number) => string;
  fullName: (d: AiSuggestion["suggested_data"]) => string;
}

function SuggestionCard({
  sug, onApprove, onDiscard, whatsappHref,
  suggestionLabel, confidenceLabel, fullName,
}: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const name = fullName(sug.suggested_data);
  const conf = Math.round(sug.confidence * 100);
  const highConf = sug.confidence >= 0.75;
  const isLiving = !sug.suggested_data.is_deceased;
  const hasId = !!sug.id;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(30,46,74,0.6)",
      borderRadius: 14, marginBottom: 12, overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{ padding: "12px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
              {suggestionLabel(sug.suggestion_type)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              {name || "Persona desconocida"}
            </div>
          </div>
          {/* Confidence badge */}
          <div style={{
            flexShrink: 0, marginLeft: 8, padding: "4px 10px", borderRadius: 20,
            background: highConf ? "rgba(122,140,110,0.25)" : "rgba(30,46,74,0.5)",
            border: `1px solid ${highConf ? "rgba(122,140,110,0.5)" : "rgba(30,46,74,0.7)"}`,
            fontSize: 11, fontWeight: 700,
            color: highConf ? "#a8c494" : "#8ba8d8",
          }}>
            {conf}%
          </div>
        </div>

        {/* Notes */}
        {sug.suggested_data.notes && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: 8 }}>
            {sug.suggested_data.notes}
          </p>
        )}

        {/* Sources */}
        {sug.sources.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {sug.sources.slice(0, 3).map((s, i) => (
              <span key={i} style={{
                padding: "3px 9px", borderRadius: 20,
                background: "rgba(200,136,42,0.15)",
                border: "1px solid rgba(200,136,42,0.3)",
                fontSize: 11, color: "#C8882A", fontWeight: 600,
              }}>
                {s.detail || s.type}
              </span>
            ))}
            {sug.sources.length > 3 && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{
                  padding: "3px 9px", borderRadius: 20, border: "none",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                +{sug.sources.length - 3}
                <ChevronDown size={10} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.15s" }} />
              </button>
            )}
          </div>
        )}
        {expanded && sug.sources.slice(3).map((s, i) => (
          <span key={i} style={{
            display: "inline-block", marginRight: 5, marginBottom: 5,
            padding: "3px 9px", borderRadius: 20,
            background: "rgba(200,136,42,0.12)",
            border: "1px solid rgba(200,136,42,0.25)",
            fontSize: 11, color: "#C8882A", fontWeight: 600,
          }}>
            {s.detail || s.type}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{
        padding: "0 14px 12px",
        display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        {/* Approve */}
        <button
          onClick={() => hasId && onApprove(sug)}
          disabled={!hasId}
          style={{
            flex: 1, minWidth: 80, padding: "10px 0", borderRadius: 10,
            background: hasId ? "#1E2E4A" : "rgba(30,46,74,0.3)",
            border: "1px solid rgba(30,46,74,0.6)",
            color: hasId ? "#fff" : "rgba(255,255,255,0.3)",
            fontSize: 13, fontWeight: 700, cursor: hasId ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          <Check size={13} strokeWidth={2.5} />
          Aprobar
        </button>

        {/* Discard */}
        <button
          onClick={() => hasId && onDiscard(sug)}
          disabled={!hasId}
          style={{
            flex: 1, minWidth: 80, padding: "10px 0", borderRadius: 10,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13, fontWeight: 600, cursor: hasId ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          <Trash2 size={13} strokeWidth={2} />
          Descartar
        </button>

        {/* WhatsApp invite (only for living people with a name) */}
        {isLiving && name && (
          <a
            href={whatsappHref(sug.suggested_data.first_name ?? name)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "#25D366",
              border: "1px solid #4ce88a",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", textDecoration: "none",
            }}
            title={`Invitar a ${name} por WhatsApp`}
          >
            <Share2 size={14} strokeWidth={2.5} />
          </a>
        )}
      </div>
    </div>
  );
}
