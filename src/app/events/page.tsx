"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, X, Trash2, Pencil, MapPin, Heart, Baby,
  GraduationCap, Users, Star, BookOpen, AlertCircle, Calendar, Camera, ImagePlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, s3dInput, C } from "@/components/ui/cosmic";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FamilyEvent {
  id: string; created_by: string; title: string; event_type: string;
  event_date: string; description: string | null; location: string | null;
  created_at: string;
  creator?: { first_name: string; last_name: string; photo_path: string | null } | null;
}

// ── Event type catalogue ───────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: "birth",       label: "Nacimiento",    Icon: Baby,          accentRgb: "220,100,150", iconColor: "#dc6496" },
  { value: "marriage",    label: "Matrimonio",     Icon: Heart,         accentRgb: "220,60,80",   iconColor: "#dc3c50" },
  { value: "death",       label: "Fallecimiento",  Icon: Star,          accentRgb: "140,140,160", iconColor: "#8c8ca0" },
  { value: "graduation",  label: "Graduación",     Icon: GraduationCap, accentRgb: "60,120,240",  iconColor: "#4080f0" },
  { value: "reunion",     label: "Reunión",        Icon: Users,         accentRgb: "70,200,100",  iconColor: "#50d070" },
  { value: "anniversary", label: "Aniversario",    Icon: Calendar,      accentRgb: "212,175,55",  iconColor: "#d4af37" },
  { value: "other",       label: "Otro",           Icon: BookOpen,      accentRgb: "160,80,240",  iconColor: "#a050f0" },
];

const EMPTY_FORM = { title: "", event_type: "birth", event_date: "", description: "", location: "" };

// ── Date helpers ───────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
const MONTHS_LONG  = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function contextPhrase(event: FamilyEvent): string {
  const d = new Date(event.event_date);
  const now = new Date();
  const years = now.getFullYear() - d.getFullYear();
  const isAnniversaryToday = now.getMonth() === d.getMonth() && now.getDate() === d.getDate();

  if (years === 0) return "Este mismo año";
  if (isAnniversaryToday) return `Hoy se cumplen ${years} año${years !== 1 ? "s" : ""}`;
  if (years === 1) return "Hace un año";

  switch (event.event_type) {
    case "birth":
      return `Hace ${years} años nació`;
    case "death":
      return `Hace ${years} años`;
    case "marriage":
      return `Han pasado ${years} años`;
    case "anniversary":
      return `Hace ${years} años`;
    default:
      return `Hace ${years} años`;
  }
}

function longDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

// ── Keyframes ──────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes mem-card-in {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes mem-star-twinkle {
    0%,100% { opacity:0.7; } 50% { opacity:0.2; }
  }
`;

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const router  = useRouter();
  const supabase = createClient();
  const [events,    setEvents]    = useState<FamilyEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const closeModal = () => {
    setShowModal(false); setForm(EMPTY_FORM); setEditingId(null);
    setPhotoFile(null); setPhotoPreview(null);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setPhotoFile(null); setPhotoPreview(null); setShowModal(true); };
  const openEdit = (e: FamilyEvent) => {
    setEditingId(e.id);
    setForm({ title: e.title, event_type: e.event_type, event_date: e.event_date,
      description: e.description || "", location: e.location || "" });
    setPhotoFile(null); setPhotoPreview(null);
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!form.event_date)   { toast.error("La fecha es obligatoria");  return; }
    setSaving(true);
    try {
      // 1. Subir foto a family-photos si hay una seleccionada
      if (photoFile && userId) {
        const ext = photoFile.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("family-photos").upload(path, photoFile);
        if (uploadErr) { toast.error("Error al subir la foto"); setSaving(false); return; }
        await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: path, caption: form.title.trim() }) });
      }
      // 2. Guardar el evento
      const res = editingId
        ? await fetch("/api/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form }) })
        : await fetch("/api/events", { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error || "Error al guardar"); setSaving(false); return; }
      toast.success(editingId ? "Recuerdo actualizado" : photoFile ? "¡Recuerdo y foto guardados!" : "Recuerdo guardado");
      closeModal();
      await loadEvents();
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("¿Eliminar este recuerdo?")) return;
    const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    toast.success("Recuerdo eliminado");
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

  const labelStyle: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 6, display: "block",
  };

  // ── Loading ──

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center",
      justifyContent:"center" }}>
      <div style={{ fontSize:22, color:"rgba(242,180,60,0.4)", animation:"mem-star-twinkle 2s ease-in-out infinite" }}>✦</div>
      <style>{CSS}</style>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>

      {/* Nebula background */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 110% 60% at 50% 0%, #16052a 0%, #0a0318 40%, #050212 70%, #030208 100%)" }}>
        <div style={{ position:"absolute", top:-60, left:-40, width:290, height:290, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(85,20,190,0.18) 0%,transparent 68%)", filter:"blur(30px)" }} />
        <div style={{ position:"absolute", top:-20, right:-50, width:230, height:230, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(20,50,180,0.12) 0%,transparent 68%)", filter:"blur(24px)" }} />
        <div style={{ position:"absolute", top:"40%", left:"15%", width:350, height:180, borderRadius:"50%",
          background:"radial-gradient(ellipse,rgba(212,175,55,0.06) 0%,transparent 65%)", filter:"blur(20px)" }} />
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} aria-hidden>
          {[[24,14,0.48],[76,10,0.40],[138,20,0.50],[198,9,0.36],[260,17,0.44],[320,12,0.42],
            [16,55,0.38],[90,44,0.34],[162,58,0.42],[234,46,0.36],[306,52,0.40]
          ].map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.6" fill="white" opacity={o} />)}
          <circle cx="170" cy="12" r="1.2" fill="#d4af37" opacity="0.92"
            style={{ animation:"mem-star-twinkle 4.1s ease-in-out infinite" }} />
          <circle cx="56"  cy="28" r="0.9" fill="white"   opacity="0.85"
            style={{ animation:"mem-star-twinkle 3.0s ease-in-out infinite 0.7s" }} />
        </svg>
      </div>

      <div style={{ minHeight:"100vh", color:"#fff", paddingBottom:100, position:"relative", zIndex:5 }}>
        <CosmicHeader
          title="Historia familiar"
          backHref="/home"
          right={
            <button onClick={openCreate} style={{
              display:"flex", alignItems:"center", gap:5,
              background:"rgba(8,5,18,0.95)",
              border:"none",
              borderTop:"1px solid rgba(242,180,60,0.30)",
              borderBottom:"2px solid rgba(0,0,0,0.8)",
              boxShadow:"0 4px 0 #02010a",
              borderRadius:10, padding:"6px 12px",
              color:"#d4af37", fontSize:11, fontWeight:700, cursor:"pointer",
              letterSpacing:"0.04em",
            }}>
              <Plus size={12} /> Añadir recuerdo
            </button>
          }
        />

        <div style={{ padding:"12px 14px" }}>

          {/* Error */}
          {loadError && (
            <div style={{ display:"flex", alignItems:"center", gap:10,
              background:"rgba(220,60,80,0.08)", borderRadius:14, padding:"12px 14px",
              border:"0.5px solid rgba(220,60,80,0.20)", marginBottom:12 }}>
              <AlertCircle size={16} style={{ color:"rgba(220,60,80,0.70)", flexShrink:0 }} />
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:"#fff" }}>
                  No se pudieron cargar los recuerdos
                </p>
                <button onClick={loadEvents} style={{ fontSize:11, color:"rgba(220,60,80,0.6)",
                  background:"none", border:"none", cursor:"pointer", padding:0 }}>
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loadError && events.length === 0 && (
            <div style={{ textAlign:"center", padding:"70px 24px" }}>
              <div style={{ fontSize:42, marginBottom:20, opacity:0.35,
                animation:"mem-star-twinkle 4s ease-in-out infinite" }}>✦</div>
              <h3 style={{ fontSize:20, fontWeight:700, color:"rgba(255,255,255,0.85)",
                marginBottom:10, letterSpacing:"-0.01em" }}>
                La memoria de tu familia espera
              </h3>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.30)", marginBottom:28, lineHeight:1.75,
                maxWidth:260, margin:"0 auto 28px" }}>
                Cada momento que guardas aquí se convierte en historia para las generaciones que vienen.
              </p>
              <button onClick={openCreate} style={{
                background:"rgba(242,180,60,0.12)",
                border:"0.5px solid rgba(242,180,60,0.45)",
                borderTop:"0.5px solid rgba(242,180,60,0.65)",
                borderRadius:18, padding:"13px 28px",
                color:"#F2B43C", fontWeight:600, fontSize:14,
                cursor:"pointer", letterSpacing:"0.05em",
              }}>
                ✦ Añadir primer recuerdo
              </button>
            </div>
          )}

          {/* ── Cinematic timeline ────────────────────────────────────────── */}
          {years.map((year, yi) => (
            <div key={year}>

              {/* Year chapter separator */}
              <div style={{ display:"flex", alignItems:"center", gap:14,
                padding: yi === 0 ? "12px 0 20px" : "32px 0 20px" }}>
                <div style={{ height:0.5, width:24,
                  background:"linear-gradient(90deg, transparent, rgba(242,180,60,0.22))" }} />
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.20em",
                  color:"rgba(242,180,60,0.50)", textTransform:"uppercase", flexShrink:0 }}>
                  {year}
                </span>
                <div style={{ flex:1, height:0.5,
                  background:"linear-gradient(90deg, rgba(242,180,60,0.22), transparent)" }} />
              </div>

              {/* Events for this year */}
              {byYear[year].map((event, ei) => {
                const t = getTypeInfo(event.event_type);
                const phrase = contextPhrase(event);
                return (
                  <div key={event.id} style={{
                    background:"rgba(8,5,18,0.85)",
                    backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)",
                    border:`0.5px solid rgba(${t.accentRgb},0.12)`,
                    borderTop:`0.5px solid rgba(${t.accentRgb},0.32)`,
                    borderRadius:22,
                    padding:"22px 18px 18px",
                    marginBottom:10,
                    animation:`mem-card-in 0.45s ease ${(yi * 3 + ei) * 70}ms both`,
                    boxShadow:"0 8px 32px rgba(0,0,0,0.50)",
                  }}>

                    {/* Eyebrow: date + context phrase */}
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between",
                      marginBottom:14 }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                        <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.16em",
                          textTransform:"uppercase", color:`rgba(${t.accentRgb},0.75)` }}>
                          {formatDay(event.event_date)}
                        </span>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)", letterSpacing:"0.03em",
                          fontStyle:"italic" }}>
                          {phrase}
                        </span>
                      </div>
                      {/* Edit/delete — owner only */}
                      {event.created_by === userId && (
                        <div style={{ display:"flex", gap:2 }}>
                          <button onClick={() => openEdit(event)}
                            style={{ background:"none", border:"none", cursor:"pointer",
                              color:"rgba(242,180,60,0.25)", padding:4, lineHeight:0 }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteEvent(event.id)}
                            style={{ background:"none", border:"none", cursor:"pointer",
                              color:"rgba(220,60,80,0.25)", padding:4, lineHeight:0 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Title — editorial, large */}
                    <h2 style={{ fontSize:20, fontWeight:700, color:"#F5EDD8",
                      lineHeight:1.25, letterSpacing:"-0.01em",
                      marginBottom: event.description ? 12 : 16 }}>
                      {event.title}
                    </h2>

                    {/* Description — if present, generous space */}
                    {event.description && (
                      <p style={{ fontSize:14, color:"rgba(255,255,255,0.48)", lineHeight:1.80,
                        marginBottom:16, fontStyle:"italic" }}>
                        {event.description}
                      </p>
                    )}

                    {/* Footer: location + creator */}
                    <div style={{ display:"flex", alignItems:"center", gap:14,
                      paddingTop:12, borderTop:"0.5px solid rgba(242,180,60,0.06)" }}>
                      {event.location && (
                        <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:10,
                          color:"rgba(255,255,255,0.25)", letterSpacing:"0.04em", flex:1,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          <MapPin size={9} style={{ flexShrink:0 }} />
                          {event.location}
                        </span>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0,
                        marginLeft: event.location ? 0 : "auto" }}>
                        {/* Creator luminous sphere */}
                        <div style={{ position:"relative", width:22, height:22 }}>
                          <div style={{ position:"absolute", inset:-4, borderRadius:"50%",
                            background:"radial-gradient(circle,rgba(242,180,60,0.15) 0%,transparent 68%)",
                            filter:"blur(3px)" }} />
                          <div style={{ width:22, height:22, borderRadius:"50%", position:"relative",
                            background:"radial-gradient(circle at 35% 28%, rgba(242,180,60,0.20) 0%, rgba(8,5,18,0.97) 65%)",
                            border:"1px solid rgba(242,180,60,0.22)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:8, fontWeight:600, color:"#F2B43C", overflow:"hidden" }}>
                            {event.creator?.photo_path
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={event.creator.photo_path} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                              : `${event.creator?.first_name?.[0] ?? ""}${event.creator?.last_name?.[0] ?? ""}`}
                          </div>
                        </div>
                        <span style={{ fontSize:10, color:"rgba(242,180,60,0.35)", letterSpacing:"0.03em" }}>
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

        {/* ── Añadir recuerdo modal ────────────────────────────────────────── */}
        {showModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.80)",
            backdropFilter:"blur(8px)", zIndex:50,
            display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
            {/* Sheet — scroll único, botones sticky */}
            <div style={{
              width:"100%", maxWidth:480,
              background:"rgba(6,3,16,0.98)",
              backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)",
              borderRadius:"24px 24px 0 0",
              borderTop:"0.5px solid rgba(242,180,60,0.40)",
              boxShadow:"0 -20px 60px rgba(0,0,0,0.90)",
              maxHeight:"92dvh", overflowY:"auto",
              WebkitOverflowScrolling:"touch" as any,
            }}>
              {/* Handle + título */}
              <div style={{ padding:"16px 20px 0", position:"sticky", top:0, zIndex:2,
                background:"rgba(6,3,16,0.98)",
                borderBottom:"0.5px solid rgba(242,180,60,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
                  <div style={{ width:32, height:3, borderRadius:2, background:"rgba(242,180,60,0.30)" }} />
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <span style={{ fontSize:16, fontWeight:700, color:"#F5EDD8", letterSpacing:"-0.01em" }}>
                    {editingId ? "Editar recuerdo" : "Nuevo recuerdo"}
                  </span>
                  <button onClick={closeModal}
                    style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
                      background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                      borderRadius:8, cursor:"pointer", color:"rgba(255,255,255,0.4)" }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                  {/* Foto del recuerdo */}
                  {!editingId && (
                    <div>
                      <span style={labelStyle}>Foto (opcional)</span>
                      <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 10 * 1024 * 1024) { toast.error("La foto debe pesar menos de 10 MB"); return; }
                          setPhotoFile(f);
                          setPhotoPreview(URL.createObjectURL(f));
                        }} />
                      {photoPreview ? (
                        <div style={{ position:"relative", borderRadius:14, overflow:"hidden",
                          border:"1px solid rgba(242,180,60,0.30)", marginTop:4 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoPreview} alt="" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
                          <div style={{ position:"absolute", inset:0,
                            background:"linear-gradient(to top, rgba(6,3,16,0.65) 0%, transparent 50%)" }} />
                          <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                            style={{ position:"absolute", top:8, right:8, width:28, height:28,
                              borderRadius:"50%", background:"rgba(0,0,0,0.65)", border:"1px solid rgba(255,255,255,0.15)",
                              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
                              color:"rgba(255,255,255,0.8)" }}>
                            <X size={13} />
                          </button>
                          <div style={{ position:"absolute", bottom:8, left:12,
                            fontSize:10, color:"rgba(242,180,60,0.75)", fontWeight:600, letterSpacing:"0.04em" }}>
                            Se compartirá con tu familia ✦
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => photoInputRef.current?.click()}
                          style={{ width:"100%", padding:"18px 0", borderRadius:14, cursor:"pointer",
                            background:"rgba(242,180,60,0.04)", border:"1.5px dashed rgba(242,180,60,0.22)",
                            display:"flex", flexDirection:"column", alignItems:"center", gap:8, marginTop:4 }}>
                          <div style={{ width:40, height:40, borderRadius:12,
                            background:"rgba(242,180,60,0.08)", border:"1px solid rgba(242,180,60,0.18)",
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <ImagePlus size={18} style={{ color:"rgba(242,180,60,0.55)" }} />
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:"rgba(242,180,60,0.65)" }}>Añadir foto</div>
                            <div style={{ fontSize:10, color:"rgba(255,255,255,0.22)", marginTop:2 }}>
                              Se publicará en el álbum familiar
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <span style={labelStyle}>Título *</span>
                    <input type="text" style={s3dInput()} placeholder="ej. Nació Valentina Hurtado"
                      value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div>
                      <span style={labelStyle}>Tipo</span>
                      <select style={{ ...s3dInput(), appearance:"none" }}
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
                    <span style={labelStyle}>Historia (opcional)</span>
                    <textarea style={{ ...s3dInput(), resize:"none" }} rows={3}
                      placeholder="Cuenta algo sobre este momento..."
                      value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Botones — sticky al fondo del sheet */}
              <div style={{
                position:"sticky", bottom:0, zIndex:2,
                padding:"12px 20px max(env(safe-area-inset-bottom, 20px), 20px)",
                background:"rgba(6,3,16,0.98)",
                borderTop:"0.5px solid rgba(242,180,60,0.12)",
              }}>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={closeModal}
                    style={{ flex:1, padding:"14px 0", borderRadius:14, cursor:"pointer",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(242,180,60,0.18)",
                      color:"rgba(242,180,60,0.55)", fontWeight:600, fontSize:13 }}>
                    Cancelar
                  </button>
                  <button onClick={saveEvent} disabled={saving}
                    style={{ flex:2, padding:"14px 0", borderRadius:14,
                      cursor:saving ? "wait" : "pointer",
                      background:"linear-gradient(135deg, #f0c040 0%, #c8902a 100%)",
                      border:"none",
                      boxShadow:"0 4px 18px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.22)",
                      color:"#0c0a18", fontWeight:800, fontSize:14,
                      letterSpacing:"0.02em", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : photoFile ? "✦ Guardar con foto" : "✦ Guardar recuerdo"}
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
