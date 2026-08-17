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

interface FamilyPhoto {
  id: string; url: string; caption: string | null; created_at: string; uploader_user_id: string;
}

interface FamilyMemory {
  id: string; author_user_id: string; body: string; memory_date: string | null;
  photo_path: string | null; person_id: string | null; person_name: string | null; created_at: string;
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

const todayIso = () => new Date().toISOString().split("T")[0];
const EMPTY_FORM = () => ({ title: "", event_type: "birth", event_date: todayIso(), description: "", location: "" });

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
  const [memories,  setMemories]  = useState<FamilyMemory[]>([]);
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
  const [familyPhotos, setFamilyPhotos] = useState<FamilyPhoto[]>([]);
  const [lightboxUrl,  setLightboxUrl]  = useState<{ url: string; photoId: string; ownPhoto: boolean } | null>(null);

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
      setLoadError(false);
      const { events, memories: mems } = await res.json();
      setEvents(events || []);
      setMemories(mems || []);
    }
    else setLoadError(true);
    // Cargar fotos para mostrarlas en cada card
    fetch("/api/photos").then(r => r.ok ? r.json() : { photos: [] }).then(({ photos }) => {
      setFamilyPhotos((photos || []).map((p: any) => ({ id: p.id, url: p.url, caption: p.caption, created_at: p.created_at, uploader_user_id: p.uploader_user_id })));
    }).catch(() => {});
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
      // Notificar a toda la familia si es nuevo (no edición)
      if (!editingId) {
        fetch("/api/notify/new-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "event", title: form.title.trim() }),
        }).catch(() => {});
      }
      closeModal();
      await loadEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      toast.error(msg || "No se pudo guardar");
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

  type FeedItem =
    | { _type: "event";  _date: string; data: FamilyEvent }
    | { _type: "memory"; _date: string; data: FamilyMemory };

  const allItems: FeedItem[] = [
    ...events.map(e  => ({ _type: "event"  as const, _date: e.event_date,               data: e })),
    ...memories.map(m => ({ _type: "memory" as const, _date: m.memory_date ?? m.created_at, data: m })),
  ].sort((a, b) => b._date.localeCompare(a._date));

  const byYear = allItems.reduce((acc, item) => {
    const y = new Date(item._date).getFullYear();
    if (!acc[y]) acc[y] = [];
    acc[y].push(item);
    return acc;
  }, {} as Record<number, FeedItem[]>);
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
          title="Recuerdos de la familia"
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
          {!loadError && allItems.length === 0 && (
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

          {/* ── Muro familiar ─────────────────────────────────────────────── */}
          {years.map((year, yi) => (
            <div key={year}>

              {/* Year pill separator */}
              <div style={{ display:"flex", alignItems:"center", gap:10,
                padding: yi === 0 ? "6px 0 16px" : "22px 0 16px" }}>
                <div style={{ flex:1, height:"0.5px",
                  background:"linear-gradient(90deg, transparent, rgba(242,180,60,0.18))" }} />
                <div style={{ padding:"4px 14px",
                  background:"rgba(242,180,60,0.07)",
                  border:"0.5px solid rgba(242,180,60,0.25)", borderRadius:100 }}>
                  <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.22em",
                    color:"rgba(242,180,60,0.60)", textTransform:"uppercase" }}>
                    {year}
                  </span>
                </div>
                <div style={{ flex:1, height:"0.5px",
                  background:"linear-gradient(90deg, rgba(242,180,60,0.18), transparent)" }} />
              </div>

              {byYear[year].map((item, ei) => {

                // ── Memory card ──────────────────────────────────────────────
                if (item._type === "memory") {
                  const mem = item.data;
                  return (
                    <div key={mem.id} style={{
                      background:"rgba(9,6,22,0.92)",
                      borderRadius:20,
                      marginBottom:14,
                      overflow:"hidden",
                      boxShadow:"0 4px 24px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(120,80,200,0.20)",
                      animation:`mem-card-in 0.45s ease ${(yi * 3 + ei) * 70}ms both`,
                    }}>
                      <div style={{ display:"flex", alignItems:"center",
                        padding:"13px 14px 12px", gap:10 }}>
                        {/* Dove icon */}
                        <div style={{
                          width:42, height:42, borderRadius:"50%", flexShrink:0,
                          background:"radial-gradient(circle at 35% 28%, rgba(120,80,200,0.25) 0%, rgba(8,5,18,0.95) 70%)",
                          border:"1.5px solid rgba(120,80,200,0.40)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:20,
                        }}>
                          🕊️
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          {mem.person_name && (
                            <div style={{ fontSize:13, fontWeight:700, color:"#F5EDD8",
                              letterSpacing:"-0.01em", lineHeight:1.2 }}>
                              {mem.person_name}
                            </div>
                          )}
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop: mem.person_name ? 3 : 0, flexWrap:"wrap" as const }}>
                            <div style={{ display:"flex", alignItems:"center", gap:3,
                              background:"rgba(120,80,200,0.10)",
                              border:"0.5px solid rgba(120,80,200,0.28)",
                              borderRadius:100, padding:"2px 7px" }}>
                              <span style={{ fontSize:8.5, color:"rgba(160,120,240,0.90)", fontWeight:700,
                                letterSpacing:"0.07em", textTransform:"uppercase" as const }}>
                                Recuerdo compartido
                              </span>
                            </div>
                            {mem.memory_date && (
                              <>
                                <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)" }}>·</span>
                                <span style={{ fontSize:9, color:"rgba(255,255,255,0.30)" }}>
                                  {longDate(mem.memory_date)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ padding:"4px 16px 16px" }}>
                        <p style={{ fontSize:14, color:"rgba(255,255,255,0.70)",
                          lineHeight:1.75, margin:0, whiteSpace:"pre-wrap" as const }}>
                          {mem.body}
                        </p>
                      </div>
                    </div>
                  );
                }

                // ── Event card ───────────────────────────────────────────────
                const event = item.data;
                const t = getTypeInfo(event.event_type);
                const phrase = contextPhrase(event);
                const eventTs = new Date(event.created_at).getTime();
                const linkedPhoto = familyPhotos.find(p =>
                  p.caption?.trim().toLowerCase() === event.title.trim().toLowerCase() &&
                  Math.abs(new Date(p.created_at).getTime() - eventTs) < 120_000
                );
                const isOwn = event.created_by === userId;

                return (
                  <div key={event.id} style={{
                    background:"rgba(9,6,22,0.92)",
                    borderRadius:20,
                    marginBottom:14,
                    overflow:"hidden",
                    boxShadow:`0 4px 24px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(${t.accentRgb},0.15)`,
                    animation:`mem-card-in 0.45s ease ${(yi * 3 + ei) * 70}ms both`,
                  }}>

                    {/* ── Post header: avatar + nombre + tipo + fecha ── */}
                    <div style={{ display:"flex", alignItems:"center",
                      padding:"13px 14px 12px", gap:10 }}>
                      {/* Avatar */}
                      <div style={{
                        width:42, height:42, borderRadius:"50%", flexShrink:0, overflow:"hidden",
                        background:`radial-gradient(circle at 35% 28%, rgba(${t.accentRgb},0.25) 0%, rgba(8,5,18,0.95) 70%)`,
                        border:`1.5px solid rgba(${t.accentRgb},0.40)`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:800, color:t.iconColor,
                      }}>
                        {event.creator?.photo_path
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={event.creator.photo_path} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                          : `${event.creator?.first_name?.[0] ?? "?"}${event.creator?.last_name?.[0] ?? ""}`}
                      </div>

                      {/* Nombre + tipo + fecha */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#F5EDD8",
                          letterSpacing:"-0.01em", lineHeight:1.2 }}>
                          {event.creator?.first_name || "Un familiar"}{event.creator?.last_name ? ` ${event.creator.last_name}` : ""}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3, flexWrap:"wrap" as const }}>
                          {/* Tipo pill */}
                          <div style={{ display:"flex", alignItems:"center", gap:3,
                            background:`rgba(${t.accentRgb},0.10)`,
                            border:`0.5px solid rgba(${t.accentRgb},0.28)`,
                            borderRadius:100, padding:"2px 7px 2px 5px" }}>
                            <t.Icon size={8} style={{ color:t.iconColor }} />
                            <span style={{ fontSize:8.5, color:t.iconColor, fontWeight:700,
                              letterSpacing:"0.07em", textTransform:"uppercase" as const }}>
                              {t.label}
                            </span>
                          </div>
                          <span style={{ fontSize:9, color:"rgba(255,255,255,0.22)" }}>·</span>
                          <span style={{ fontSize:9, color:"rgba(255,255,255,0.30)" }}>
                            {longDate(event.event_date)}
                          </span>
                        </div>
                      </div>

                      {/* Editar / eliminar — solo el autor */}
                      {isOwn && (
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          <button onClick={() => openEdit(event)}
                            style={{ width:30, height:30, display:"flex", alignItems:"center",
                              justifyContent:"center",
                              background:"rgba(242,180,60,0.08)", border:"1px solid rgba(242,180,60,0.22)",
                              borderRadius:8, cursor:"pointer", color:"rgba(242,180,60,0.75)" }}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteEvent(event.id)}
                            style={{ width:30, height:30, display:"flex", alignItems:"center",
                              justifyContent:"center",
                              background:"rgba(220,60,80,0.08)", border:"1px solid rgba(220,60,80,0.22)",
                              borderRadius:8, cursor:"pointer", color:"rgba(220,60,80,0.75)" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Foto full-width (si existe) ─────────────────── */}
                    {linkedPhoto && (
                      <div
                        onClick={() => setLightboxUrl({ url: linkedPhoto.url, photoId: linkedPhoto.id, ownPhoto: linkedPhoto.uploader_user_id === userId })}
                        style={{ cursor:"pointer", position:"relative" as const, lineHeight:0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={linkedPhoto.url} alt=""
                          style={{ width:"100%", maxHeight:340, objectFit:"cover",
                            display:"block", minHeight:160 }} />
                        {/* Gradient bottom overlay */}
                        <div style={{ position:"absolute" as const, bottom:0, left:0, right:0, height:50,
                          background:"linear-gradient(to top, rgba(9,6,22,0.70) 0%, transparent 100%)",
                          pointerEvents:"none" }} />
                        {/* Hint */}
                        <div style={{ position:"absolute" as const, bottom:8, right:12,
                          fontSize:9, color:"rgba(255,255,255,0.40)", fontWeight:500,
                          letterSpacing:"0.04em" }}>
                          Toca para ampliar
                        </div>
                      </div>
                    )}

                    {/* ── Contenido ───────────────────────────────────── */}
                    <div style={{ padding: linkedPhoto ? "12px 16px 16px" : "4px 16px 16px" }}>
                      {phrase && (
                        <div style={{ fontSize:10, color:`rgba(${t.accentRgb},0.55)`,
                          fontStyle:"italic", marginBottom:6, letterSpacing:"0.02em" }}>
                          {phrase}
                        </div>
                      )}
                      <h2 style={{ fontSize:17, fontWeight:800, color:"#F5EDD8",
                        lineHeight:1.30, letterSpacing:"-0.01em",
                        marginBottom: event.description ? 8 : 0 }}>
                        {event.title}
                      </h2>
                      {event.description && (
                        <p style={{ fontSize:13, color:"rgba(255,255,255,0.50)",
                          lineHeight:1.80, margin:0 }}>
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <div style={{ display:"flex", alignItems:"center", gap:5,
                          marginTop:10, paddingTop:10,
                          borderTop:"0.5px solid rgba(255,255,255,0.05)" }}>
                          <MapPin size={9} style={{ color:"rgba(255,255,255,0.25)", flexShrink:0 }} />
                          <span style={{ fontSize:10, color:"rgba(255,255,255,0.30)",
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>
                            {event.location}
                          </span>
                        </div>
                      )}
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
            {/* Sheet — flex-column con min-height:0 en el scroll area (patrón iOS seguro) */}
            <div style={{
              width:"100%", maxWidth:480,
              background:"rgba(6,3,16,0.98)",
              backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)",
              borderRadius:"24px 24px 0 0",
              borderTop:"0.5px solid rgba(242,180,60,0.40)",
              boxShadow:"0 -20px 60px rgba(0,0,0,0.90)",
              maxHeight:"92dvh",
              display:"flex", flexDirection:"column",
              overflow:"hidden",
            }}>
              {/* Header — fijo, no scrollea */}
              <div style={{ flexShrink:0, padding:"16px 20px 14px",
                borderBottom:"0.5px solid rgba(242,180,60,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
                  <div style={{ width:32, height:3, borderRadius:2, background:"rgba(242,180,60,0.30)" }} />
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
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

              {/* Contenido scrollable — botones al final para que siempre sean alcanzables */}
              <div style={{ flex:1, minHeight:0, overflowY:"auto",
                WebkitOverflowScrolling:"touch" as any, padding:"16px 20px 0" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:14,
                  paddingBottom:"max(env(safe-area-inset-bottom), 24px)" }}>

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
                              Se compartirá con toda la familia
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

                  {/* ── Botón Publicar — dentro del scroll para que siempre sea visible ── */}
                  <div style={{ borderTop:"0.5px solid rgba(242,180,60,0.12)", paddingTop:14 }}>
                    <button onClick={saveEvent} disabled={saving}
                      style={{ width:"100%", padding:"17px 0", borderRadius:16,
                        cursor:saving ? "wait" : "pointer",
                        background: saving
                          ? "rgba(180,130,30,0.5)"
                          : "linear-gradient(135deg, #f0c040 0%, #c8902a 100%)",
                        border:"none",
                        boxShadow: saving ? "none" : "0 6px 22px rgba(212,175,55,0.40), inset 0 1px 0 rgba(255,255,255,0.25)",
                        color:"#0c0a18", fontWeight:800, fontSize:16,
                        letterSpacing:"0.01em" }}>
                      {saving ? "Publicando..." : editingId ? "Guardar cambios" : "Publicar recuerdo"}
                    </button>
                    <button onClick={closeModal}
                      style={{ width:"100%", marginTop:10, padding:"14px 0", borderRadius:14,
                        cursor:"pointer", background:"transparent",
                        border:"1px solid rgba(242,180,60,0.18)",
                        color:"rgba(242,180,60,0.55)", fontWeight:600, fontSize:13 }}>
                      Cancelar
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        <CosmicNav />

        {/* ── Lightbox de foto ────────────────────────────────────────────── */}
        {lightboxUrl && (
          <div onClick={() => setLightboxUrl(null)}
            style={{ position:"fixed", inset:0, zIndex:100,
              background:"rgba(0,0,0,0.94)", backdropFilter:"blur(12px)",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <button onClick={() => setLightboxUrl(null)}
              style={{ position:"absolute", top:"max(env(safe-area-inset-top),16px)", right:16,
                width:38, height:38, borderRadius:12,
                background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", color:"rgba(255,255,255,0.7)", fontSize:20, lineHeight:1 }}>
              ×
            </button>
            <div onClick={e => e.stopPropagation()}
              style={{ width:"100%", maxWidth:520, padding:"0 16px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxUrl.url} alt=""
                style={{ width:"100%", maxHeight:"70vh", objectFit:"contain",
                  borderRadius:18, display:"block",
                  boxShadow:"0 20px 60px rgba(0,0,0,0.80)" }} />
              {lightboxUrl.ownPhoto && (
                <button onClick={async () => {
                    const res = await fetch(`/api/photos?id=${lightboxUrl.photoId}`, { method:"DELETE" });
                    if (res.ok) {
                      setFamilyPhotos(prev => prev.filter(p => p.id !== lightboxUrl.photoId));
                      setLightboxUrl(null);
                    }
                  }}
                  style={{ display:"block", width:"100%", marginTop:18,
                    padding:"14px 0", borderRadius:14, cursor:"pointer",
                    background:"rgba(220,60,80,0.10)", border:"1px solid rgba(220,60,80,0.35)",
                    color:"rgba(220,60,80,0.80)", fontWeight:700, fontSize:14 }}>
                  Eliminar foto
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
