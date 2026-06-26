"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Plus, X, Trash2, Calendar, MapPin, Heart, Baby, GraduationCap, Users, Star, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface FamilyEvent {
  id: string;
  created_by: string;
  title: string;
  event_type: string;
  event_date: string;
  description: string | null;
  location: string | null;
  created_at: string;
  creator?: { first_name: string; last_name: string; avatar_url?: string };
}

const EVENT_TYPES = [
  { value: "birth",        label: "Nacimiento",    icon: <Baby size={16} />,         color: "bg-pink-100 text-pink-700" },
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

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    await loadEvents();
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from("family_events")
      .select("*, creator:profiles!created_by(first_name, last_name, avatar_url)")
      .order("event_date", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!form.event_date) { toast.error("La fecha es obligatoria"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("family_events").insert({
      created_by: user.id,
      title: form.title.trim(),
      event_type: form.event_type,
      event_date: form.event_date,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Evento registrado");
    setShowModal(false);
    setForm(EMPTY_FORM);
    await loadEvents();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    await supabase.from("family_events").delete().eq("id", id);
    toast.success("Evento eliminado");
    await loadEvents();
  };

  const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[6];

  const formatDate = (d: string) => new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  // Group events by year
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> Agregar
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {events.length === 0 && (
          <div className="card text-center py-14">
            <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-700 mb-2">Sin eventos registrados</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              Registra nacimientos, matrimonios, graduaciones y otros hitos importantes de tu familia.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={16} className="inline mr-2" /> Registrar primer evento
            </button>
          </div>
        )}

        {years.map(year => (
          <div key={year}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-sm font-bold text-gray-400">{year}</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
            <div className="space-y-3">
              {byYear[year].map(event => {
                const typeInfo = getTypeInfo(event.event_type);
                return (
                  <div key={event.id} className="card flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                      {typeInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900">{event.title}</h3>
                        {event.created_by === userId && (
                          <button onClick={() => deleteEvent(event.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                        <span>{formatDate(event.event_date)}</span>
                        {event.location && <span className="flex items-center gap-0.5"><MapPin size={10} />{event.location}</span>}
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{event.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 rounded-full bg-ceiba-200 overflow-hidden flex items-center justify-center text-ceiba-700 text-xs font-bold">
                          {event.creator?.avatar_url
                            ? <img src={event.creator.avatar_url} className="w-full h-full object-cover" />
                            : `${event.creator?.first_name?.[0]}${event.creator?.last_name?.[0]}`}
                        </div>
                        <span className="text-xs text-gray-400">{event.creator?.first_name} {event.creator?.last_name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Registrar evento familiar</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-gray-600">
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
                <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={saveEvent} disabled={saving} className="flex-1 btn-primary">
                  {saving ? "Guardando..." : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
