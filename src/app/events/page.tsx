"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Plus, X, Trash2, Pencil, Calendar, MapPin, Heart, Baby, GraduationCap, Users, Star, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface FamilyEvent {
  id: string;
  created_by: string;
  title: string;
  event_type: string;
  event_date: string;
  description: string | null;
  location: string | null;
  created_at: string;
  creator?: { first_name: string; last_name: string; photo_path: string | null } | null;
}

const EVENT_TYPES = [
  { value: "birth",        label: "Nacimiento",    icon: <Baby size={16} />,          color: "bg-pink-100 text-pink-700" },
  { value: "marriage",     label: "Matrimonio",    icon: <Heart size={16} />,         color: "bg-red-100 text-red-700" },
  { value: "death",        label: "Fallecimiento", icon: <Star size={16} />,          color: "bg-gray-100 text-gray-600" },
  { value: "graduation",   label: "Graduación",    icon: <GraduationCap size={16} />, color: "bg-blue-100 text-blue-700" },
  { value: "reunion",      label: "Reunión",       icon: <Users size={16} />,         color: "bg-green-100 text-green-700" },
  { value: "anniversary",  label: "Aniversario",   icon: <Calendar size={16} />,      color: "bg-amber-100 text-amber-700" },
  { value: "other",        label: "Otro",          icon: <BookOpen size={16} />,      color: "bg-purple-100 text-purple-700" },
];

const EMPTY_FORM = { title: "", event_type: "birth", event_date: "", description: "", location: "" };

export default function EventsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (res.ok) {
      const { events } = await res.json();
      setEvents(events || []);
    }
    setLoading(false);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (e: FamilyEvent) => {
    setEditingId(e.id);
    setForm({
      title: e.title, event_type: e.event_type, event_date: e.event_date,
      description: e.description || "", location: e.location || "",
    });
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!form.event_date) { toast.error("La fecha es obligatoria"); return; }
    setSaving(true);
    const res = editingId
      ? await fetch("/api/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...form }),
        })
      : await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    setSaving(false);
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error || "Error al guardar"); return; }
    toast.success(editingId ? "Evento actualizado" : "Evento registrado");
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
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
    const year = new Date(e.event_date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(e);
    return acc;
  }, {} as Record<number, FamilyEvent[]>);
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg sticky top-0 z-10">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold flex-1">
          <TreePine size={20} className="text-ceiba-300" /> Historia familiar
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Plus size={15} /> Agregar
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-4 pb-28">
        {events.length === 0 && (
          <div className="card text-center py-14 mt-4">
            <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-700 mb-2">Sin eventos registrados</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              Registra nacimientos, matrimonios, graduaciones y otros hitos importantes de tu familia.
            </p>
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} className="inline mr-2" /> Registrar primer evento
            </button>
          </div>
        )}

        {years.length > 0 && (
          <div className="relative">
            <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-1">
              {years.map(year => (
                <div key={year}>
                  <div className="flex items-center gap-3 py-3 relative">
                    <div className="w-14 h-7 bg-ceiba-800 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm">
                      <span className="text-xs font-bold text-white">{year}</span>
                    </div>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>

                  {byYear[year].map((event, idx) => {
                    const typeInfo = getTypeInfo(event.event_type);
                    const isLast = idx === byYear[year].length - 1;
                    return (
                      <div key={event.id} className={`flex gap-3 ${isLast ? "mb-2" : "mb-1"}`}>
                        <div className="flex flex-col items-center shrink-0 w-14">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-sm border-2 border-white ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </div>
                        </div>
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 mb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-sm leading-tight">{event.title}</h3>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeInfo.color}`}>
                                  {typeInfo.icon && <span className="[&>svg]:w-2.5 [&>svg]:h-2.5">{typeInfo.icon}</span>}
                                  {typeInfo.label}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {new Date(event.event_date).toLocaleDateString("es", { day: "numeric", month: "short" })}
                                </span>
                                {event.location && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                    <MapPin size={9} />{event.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            {event.created_by === userId && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEdit(event)}
                                  className="text-gray-200 hover:text-ceiba-500 transition-colors p-0.5">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => deleteEvent(event.id)}
                                  className="text-gray-200 hover:text-red-400 transition-colors p-0.5">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {event.description && (
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed border-t border-gray-50 pt-2">
                              {event.description}
                            </p>
                          )}

                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-4 h-4 rounded-full bg-ceiba-200 overflow-hidden flex items-center justify-center text-ceiba-700 text-[9px] font-bold shrink-0">
                              {event.creator?.photo_path
                                ? <img src={event.creator.photo_path} className="w-full h-full object-cover" alt="" />
                                : `${event.creator?.first_name?.[0] ?? ""}${event.creator?.last_name?.[0] ?? ""}`}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              Registrado por {event.creator?.first_name || "un familiar"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editingId ? "Editar evento" : "Registrar evento familiar"}</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
                <input type="text" className="input-field" placeholder="ej. Nació Valentina Hurtado"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="input-field" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-500">*</span></label>
                  <input type="date" className="input-field"
                    value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lugar (opcional)</label>
                <input type="text" className="input-field" placeholder="ej. Bogotá, Colombia"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea className="input-field resize-none" rows={3}
                  placeholder="Cuenta algo sobre este momento..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null); }} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={saveEvent} disabled={saving} className="flex-1 btn-primary">
                  {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
