"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, X, Trash2, Pencil, Calendar, MapPin, Heart, Baby,
  GraduationCap, Users, Star, BookOpen, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, s3dInput, C } from "@/components/ui/cosmic";

interface FamilyEvent {
  id: string; created_by: string; title: string; event_type: string;
  event_date: string; description: string | null; location: string | null;
  created_at: string;
  creator?: { first_name: string; last_name: string; photo_path: string | null } | null;
}

const EVENT_TYPES = [
  { value: "birth",       label: "Nacimiento",    Icon: Baby,         accentRgb: "220,100,150", iconColor: "#dc6496" },
  { value: "marriage",    label: "Matrimonio",     Icon: Heart,        accentRgb: "220,60,80",   iconColor: "#dc3c50" },
  { value: "death",       label: "Fallecimiento",  Icon: Star,         accentRgb: "140,140,160", iconColor: "#8c8ca0" },
  { value: "graduation",  label: "Graduación",     Icon: GraduationCap,accentRgb: "60,120,240",  iconColor: "#4080f0" },
  { value: "reunion",     label: "Reunión",        Icon: Users,        accentRgb: "70,200,100",  iconColor: "#50d070" },
  { value: "anniversary", label: "Aniversario",    Icon: Calendar,     accentRgb: "212,175,55",  iconColor: "#d4af37" },
  { value: "other",       label: "Otro",           Icon: BookOpen,     accentRgb: "160,80,240",  iconColor: "#a050f0" },
];

const EMPTY_FORM = { title: "", event_type: "birth", event_date: "", description: "", location: "" };

export default function EventsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    await loadEvents();
  };

  const loadEvents = async () => {
    const res = await fetch("/api/events");
    if (res.ok) { setLoadError(false); const { events } = await res.json(); setEvents(events || []); }
    else setLoadError(true);
    setLoading(false);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (e: FamilyEvent) => {
    setEditingId(e.id);
    setForm({ title: e.title, event_type: e.event_type, event_date: e.event_date,
      description: e.description || "", location: e.location || "" });
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!form.event_date) { toast.error("La fecha es obligatoria"); return; }
    setSaving(true);
    const res = editingId
      ? await fetch("/api/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form }) })
      : await fetch("/api/events", { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error || "Error al guardar"); return; }
    toast.success(editingId ? "Evento actualizado" : "Evento registrado");
    setShowModal(false); setForm(EMPTY_FORM); setEditingId(null);
    await loadEvents();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    toast.success("Evento eliminado");
    await loadEvents();
  };

  const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[6];

  const byYear = events.reduce((acc, e) => {
    const y = new Date(e.event_date).getFullYear();
    if (!acc[y]) acc[y] = [];
    acc[y].push(e);
    return acc;
  }, {} as Record<number, FamilyEvent[]>);
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  if (loading) return <CosmicSpinner />;

  const labelStyle: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 6, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <CosmicHeader
        title="Historia familiar"
        backHref="/home"
        right={
          <button onClick={openCreate} style={{
            display: "flex", alignItems: "center", gap: 5, background: "#0c0a18", border: "none",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            boxShadow: "0 3px 0 #02010a", borderRadius: 9, padding: "6px 10px",
            color: "#d4af37", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>
            <Plus size={13} /> Agregar
          </button>
        }
      />

      <div style={{ padding: "16px 14px" }}>
        {loadError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10,
            background: "#160208", borderRadius: 14, padding: "12px 14px",
            border: "1px solid rgba(220,60,80,0.2)", marginBottom: 12 }}>
            <AlertCircle size={16} style={{ color: "rgba(220,60,80,0.7)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>No se pudieron cargar los eventos</p>
              <button onClick={loadEvents} style={{ fontSize: 11, color: "rgba(220,60,80,0.6)",
                background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reintentar</button>
            </div>
          </div>
        )}

        {!loadError && events.length === 0 && (
          <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "50px 20px",
            textAlign: "center", marginTop: 12 }}>
            <Calendar size={42} style={{ color: "rgba(212,175,55,0.2)", margin: "0 auto 14px" }} />
            <h3 style={{ fontWeight: 700, color: "#fff", fontSize: 15, marginBottom: 8 }}>Sin eventos registrados</h3>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20, lineHeight: 1.6 }}>
              Registra nacimientos, matrimonios, graduaciones y otros hitos importantes de tu familia.
            </p>
            <button onClick={openCreate} style={{
              background: "#c9a820", borderRadius: 12, padding: "11px 24px",
              color: "#030208", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
              borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
              boxShadow: "0 6px 0 #4a3c00",
            }}>Registrar primer evento</button>
          </div>
        )}

        {/* Línea de tiempo */}
        {years.length > 0 && (
          <div style={{ position: "relative" }}>
            {/* línea vertical */}
            <div style={{ position: "absolute", left: 19, top: 0, bottom: 0,
              width: 1, background: "rgba(212,175,55,0.12)" }} />

            {years.map(year => (
              <div key={year}>
                {/* Año */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 8px" }}>
                  <div style={{ width: 40, height: 26, background: "#0c0a18", borderRadius: 100,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    border: "1px solid rgba(212,175,55,0.28)", zIndex: 1,
                    boxShadow: "0 0 8px rgba(212,175,55,0.12)" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#d4af37" }}>{year}</span>
                  </div>
                  <div style={{ height: 0.5, flex: 1, background: "rgba(212,175,55,0.12)" }} />
                </div>

                {byYear[year].map(event => {
                  const t = getTypeInfo(event.event_type);
                  return (
                    <div key={event.id} style={{ display: "flex", gap: 10, marginBottom: 9 }}>
                      {/* Dot */}
                      <div style={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0, paddingTop: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0a0818",
                          border: `1.5px solid rgba(${t.accentRgb},0.4)`,
                          boxShadow: `0 0 8px rgba(${t.accentRgb},0.15)`,
                          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                          <t.Icon size={13} style={{ color: t.iconColor }} />
                        </div>
                      </div>

                      {/* Tarjeta */}
                      <div style={{ flex: 1, ...s3dCard("#0c0a18", t.accentRgb, "#040300"), padding: "11px 13px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ fontWeight: 700, color: "#fff", fontSize: 13,
                              lineHeight: 1.3, marginBottom: 4 }}>{event.title}</h3>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
                              <span style={{ fontSize: 9.5, fontWeight: 700,
                                color: t.iconColor, letterSpacing: "0.06em",
                                textTransform: "uppercase" }}>{t.label}</span>
                              <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)" }}>
                                {new Date(event.event_date).toLocaleDateString("es", { day: "numeric", month: "short" })}
                              </span>
                              {event.location && (
                                <span style={{ display: "flex", alignItems: "center", gap: 3,
                                  fontSize: 9.5, color: "rgba(255,255,255,0.35)" }}>
                                  <MapPin size={8} />{event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          {event.created_by === userId && (
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button onClick={() => openEdit(event)}
                                style={{ background: "none", border: "none", cursor: "pointer",
                                  color: "rgba(212,175,55,0.3)", padding: 3 }}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => deleteEvent(event.id)}
                                style={{ background: "none", border: "none", cursor: "pointer",
                                  color: "rgba(220,60,80,0.4)", padding: 3 }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8,
                            lineHeight: 1.55, paddingTop: 8,
                            borderTop: "0.5px solid rgba(212,175,55,0.08)" }}>
                            {event.description}
                          </p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#0c0a18",
                            border: "1px solid rgba(212,175,55,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 8, fontWeight: 700, color: "#d4af37", overflow: "hidden" }}>
                            {event.creator?.photo_path
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={event.creator.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                              : `${event.creator?.first_name?.[0] ?? ""}${event.creator?.last_name?.[0] ?? ""}`}
                          </div>
                          <span style={{ fontSize: 10, color: "rgba(212,175,55,0.35)" }}>
                            {event.creator?.first_name || "Un familiar"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)", zIndex: 50,
          display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0" }}>
          <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"),
            width: "100%", maxWidth: 480, borderRadius: "24px 24px 0 0",
            padding: "24px 20px 32px" }}>
            <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
              background: "rgba(212,175,55,0.45)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                {editingId ? "Editar evento" : "Registrar evento"}
              </span>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null); }}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "rgba(212,175,55,0.4)", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={labelStyle}>Título *</span>
                <input type="text" style={s3dInput()} placeholder="ej. Nació Valentina Hurtado"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={labelStyle}>Tipo</span>
                  <select style={{ ...s3dInput(), appearance: "none" }}
                    value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <span style={labelStyle}>Fecha *</span>
                  <input type="date" style={s3dInput()}
                    value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <span style={labelStyle}>Lugar (opcional)</span>
                <input type="text" style={s3dInput()} placeholder="ej. Bogotá, Colombia"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <span style={labelStyle}>Descripción (opcional)</span>
                <textarea style={{ ...s3dInput(), resize: "none" }} rows={3}
                  placeholder="Cuenta algo sobre este momento..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 12, cursor: "pointer",
                    background: "#0c0a1a", border: "1px solid rgba(212,175,55,0.2)",
                    color: "rgba(212,175,55,0.6)", fontWeight: 700, fontSize: 13 }}>
                  Cancelar
                </button>
                <button onClick={saveEvent} disabled={saving}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 12, cursor: saving ? "wait" : "pointer",
                    background: "#c9a820", border: "none",
                    borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                    boxShadow: "0 6px 0 #4a3c00",
                    color: "#030208", fontWeight: 700, fontSize: 13 }}>
                  {saving ? "Guardando..." : editingId ? "Guardar" : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CosmicNav />
    </div>
  );
}
