"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Sparkles, Clock, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, s3dInput, C } from "@/components/ui/cosmic";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Historia {
  id: string;
  title: string;
  event_type: string;
  description: string | null;
  created_at: string;
  created_by: string;
  creator?: { first_name: string; last_name: string; photo_path: string | null } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STORY_EMOJI: Record<string, string> = {
  birth: "👶", marriage: "💍", death: "✦", graduation: "🎓",
  reunion: "👨‍👩‍👧", anniversary: "🎂", other: "✨",
};
const ACCENT_MAP: Record<string, string> = {
  birth: "220,100,150", marriage: "220,60,80", death: "140,140,160",
  graduation: "60,120,240", reunion: "70,200,100", anniversary: "212,175,55", other: "160,80,240",
};

function timeLeft(createdAt: string): string {
  const ms = 86_400_000 - (Date.now() - new Date(createdAt).getTime());
  if (ms <= 0) return "Expirada";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  color: "rgba(192,168,255,0.60)", letterSpacing: "0.06em",
  textTransform: "uppercase", marginBottom: 6,
};

const CSS = `
  @keyframes story-in {
    from { opacity:0; transform:scale(0.88) translateY(12px); }
    to   { opacity:1; transform:scale(1)    translateY(0);    }
  }
  @keyframes pulse-ring {
    0%,100% { box-shadow: 0 0 0 2px rgba(160,120,255,0.5), 0 0 22px rgba(140,80,255,0.25); }
    50%      { box-shadow: 0 0 0 4px rgba(160,120,255,0.3), 0 0 32px rgba(140,80,255,0.40); }
  }
`;

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HistoriasPage() {
  const router = useRouter();
  const supabase = createClient();

  const [historias, setHistorias] = useState<Historia[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userId, setUserId]       = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [title, setTitle]         = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const { events } = await res.json();
        const cutoff = Date.now() - 86_400_000;
        const recent = (events as Historia[]).filter(
          e => new Date(e.created_at).getTime() > cutoff
        );
        setHistorias(recent);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const closeModal = () => {
    setShowModal(false);
    setTitle("");
    setDescription("");
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Escribe algo para tu historia"); return; }
    setSaving(true);
    try {
      if (photoFile && userId) {
        const ext = photoFile.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("family-photos").upload(path, photoFile);
        if (!error) {
          await fetch("/api/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath: path, caption: title.trim() }),
          });
        }
      }
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          event_type: "other",
          event_date: today,
          description: description.trim() || null,
          location: null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Historia compartida con tu familia ✦");
      closeModal();
      load();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
        {/* Nebula de fondo */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(ellipse 120% 60% at 50% 0%, #1a0830 0%, #0a0318 40%, #030208 70%)" }} />

        <div style={{ position: "relative", zIndex: 5 }}>
          <CosmicHeader
            title="Historias"
            backHref="/home"
            right={
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(8,5,18,0.95)",
                borderTop: "1px solid rgba(160,120,255,0.35)",
                borderBottom: "2px solid rgba(0,0,0,0.8)",
                border: "none",
                boxShadow: "0 4px 0 #020008",
                borderRadius: 10, padding: "6px 12px",
                color: "#c0a8ff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.04em",
              }}>
                <Plus size={12} /> Nueva historia
              </button>
            }
          />

          <div style={{ padding: "8px 14px 14px" }}>
            {/* Aviso 24h */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20,
              background: "rgba(140,80,255,0.06)", border: "0.5px solid rgba(160,120,255,0.18)",
              borderRadius: 12, padding: "9px 14px" }}>
              <Clock size={13} style={{ color: "rgba(160,120,255,0.60)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.4 }}>
                Las historias desaparecen de esta pantalla después de <strong style={{ color: "rgba(160,120,255,0.70)" }}>24 horas</strong>. Los recuerdos permanentes van en la sección Recuerdos.
              </span>
            </div>

            {/* Lista de historias */}
            {loading ? (
              <div style={{ textAlign: "center", paddingTop: 60, color: "rgba(255,255,255,0.20)", fontSize: 13 }}>
                Cargando…
              </div>
            ) : historias.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.60)", marginBottom: 8 }}>
                  Ninguna historia hoy
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", marginBottom: 28 }}>
                  Comparte algo que esté pasando ahora en tu familia.
                </div>
                <button onClick={() => setShowModal(true)} style={{
                  padding: "12px 28px", borderRadius: 14, cursor: "pointer",
                  background: "linear-gradient(135deg, #a060f0 0%, #6030c0 100%)",
                  border: "none", color: "#fff", fontWeight: 700, fontSize: 14,
                  boxShadow: "0 6px 20px rgba(140,80,255,0.35)",
                }}>
                  Crear primera historia
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {historias.map((h, i) => {
                  const emoji = STORY_EMOJI[h.event_type] ?? "✨";
                  const ac = ACCENT_MAP[h.event_type] ?? "160,80,240";
                  const remaining = timeLeft(h.created_at);
                  const isOwn = h.created_by === userId;
                  return (
                    <div key={h.id} style={{
                      borderRadius: 20, padding: "16px 16px 14px",
                      background: "rgba(10,6,22,0.90)",
                      backdropFilter: "blur(20px)",
                      border: `0.5px solid rgba(${ac},0.20)`,
                      borderTop: `1px solid rgba(${ac},0.40)`,
                      boxShadow: `0 8px 28px rgba(0,0,0,0.55), 0 0 24px rgba(${ac},0.06)`,
                      animation: `story-in 0.4s ease ${i * 60}ms both`,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {/* Avatar / emoji */}
                        <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                          background: `radial-gradient(circle at 35% 28%, rgba(${ac},0.18) 0%, rgba(6,3,16,0.96) 70%)`,
                          border: `2px solid rgba(${ac},0.50)`,
                          boxShadow: `0 0 18px rgba(${ac},0.18)`,
                          animation: isOwn ? "pulse-ring 3s ease-in-out infinite" : undefined,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                          {emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Creator + time left */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: `rgba(${ac},0.75)`, letterSpacing: "0.04em" }}>
                              {h.creator?.first_name ?? "Un familiar"}
                              {isOwn && <span style={{ fontSize: 9, color: `rgba(${ac},0.45)`, marginLeft: 5 }}>· tú</span>}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)",
                              background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 20,
                              display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={8} /> {remaining}
                            </span>
                          </div>
                          {/* Title */}
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#F5EDD8", lineHeight: 1.3, marginBottom: 4 }}>
                            {h.title}
                          </div>
                          {/* Description */}
                          {h.description && (
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                              {h.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Link a recuerdos */}
            <Link href="/events" style={{ textDecoration: "none" }}>
              <div style={{ marginTop: 28, textAlign: "center", padding: "12px 0",
                borderTop: "0.5px solid rgba(212,175,55,0.08)" }}>
                <span style={{ fontSize: 11, color: "rgba(212,175,55,0.35)", fontWeight: 600 }}>
                  ¿Buscas algo permanente? → <span style={{ color: "rgba(212,175,55,0.60)" }}>Ver Recuerdos</span>
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Modal nueva historia ─────────────────────────────────────────── */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(8px)", zIndex: 50,
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{
              width: "100%", maxWidth: 480,
              background: "rgba(8,4,20,0.98)",
              backdropFilter: "blur(32px)",
              borderRadius: "24px 24px 0 0",
              borderTop: "0.5px solid rgba(160,120,255,0.40)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.90)",
              maxHeight: "88dvh",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ flexShrink: 0, padding: "16px 20px 14px",
                borderBottom: "0.5px solid rgba(160,120,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ width: 32, height: 3, borderRadius: 2, background: "rgba(160,120,255,0.35)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#F5EDD8" }}>
                    Nueva historia
                  </span>
                  <button onClick={closeModal}
                    style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Contenido scrollable */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
                WebkitOverflowScrolling: "touch" as any, padding: "16px 20px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>

                  {/* Foto opcional */}
                  <div>
                    <span style={labelStyle}>Foto (opcional)</span>
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 10 * 1024 * 1024) { toast.error("La foto debe pesar menos de 10 MB"); return; }
                        setPhotoFile(f);
                        setPhotoPreview(URL.createObjectURL(f));
                      }} />
                    {photoPreview ? (
                      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden",
                        border: "1px solid rgba(160,120,255,0.30)", marginTop: 4 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoPreview} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                        <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                          style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28,
                            borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                            color: "rgba(255,255,255,0.8)" }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => photoInputRef.current?.click()}
                        style={{ width: "100%", padding: "16px 0", borderRadius: 14, cursor: "pointer",
                          background: "rgba(160,120,255,0.04)", border: "1.5px dashed rgba(160,120,255,0.22)",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 7, marginTop: 4 }}>
                        <ImagePlus size={18} style={{ color: "rgba(160,120,255,0.55)" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(160,120,255,0.60)" }}>Añadir foto</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <span style={labelStyle}>¿Qué está pasando? *</span>
                    <input
                      type="text"
                      style={s3dInput()}
                      placeholder="ej. Estamos en la reunión familiar"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      maxLength={120}
                    />
                  </div>

                  <div>
                    <span style={labelStyle}>Cuenta más (opcional)</span>
                    <textarea
                      style={{ ...s3dInput(), resize: "none" }}
                      rows={3}
                      placeholder="Añade detalles, contexto o lo que quieras compartir..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ background: "rgba(160,120,255,0.06)", border: "0.5px solid rgba(160,120,255,0.15)",
                    borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={12} style={{ color: "rgba(160,120,255,0.55)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
                      Visible para toda tu familia · Desaparece en 24 horas
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div style={{
                flexShrink: 0,
                padding: "12px 20px max(env(safe-area-inset-bottom, 20px), 20px)",
                background: "rgba(8,4,20,0.98)",
                borderTop: "0.5px solid rgba(160,120,255,0.12)",
              }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeModal}
                    style={{ flex: 1, padding: "14px 0", borderRadius: 14, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(160,120,255,0.18)",
                      color: "rgba(160,120,255,0.55)", fontWeight: 600, fontSize: 13 }}>
                    Cancelar
                  </button>
                  <button onClick={save} disabled={saving}
                    style={{ flex: 2, padding: "14px 0", borderRadius: 14,
                      cursor: saving ? "wait" : "pointer",
                      background: "linear-gradient(135deg, #a060f0 0%, #6030c0 100%)",
                      border: "none",
                      boxShadow: "0 4px 18px rgba(140,80,255,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                      color: "#fff", fontWeight: 800, fontSize: 14,
                      letterSpacing: "0.02em", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Compartiendo..." : "✦ Compartir historia"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <CosmicNav />
      </div>
    </>
  );
}
