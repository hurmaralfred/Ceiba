"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, MapPin, Settings, Camera, Plus, X, Pencil, Check } from "lucide-react";
import { CosmicNav, CosmicSpinner, C } from "@/components/ui/cosmic";
import { getDiceBearUrl } from "@/lib/dicebear";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PersonData {
  id: string;
  first_name: string;
  middle_name?: string | null;
  first_surname?: string | null;
  second_surname?: string | null;
  birth_date?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  photo_path?: string | null;
  created_by?: string | null;
  avatarUrl?: string | null;
  avatarConfig?: any;
  hasAccount: boolean;
  is_claimed?: boolean;
  is_deceased?: boolean;
}

interface RelativeItem {
  id: string;
  first_name: string;
  first_surname?: string | null;
  birth_year?: number | null;
  avatarUrl?: string | null;
}

interface EventItem {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description?: string | null;
}


// ── Label maps ────────────────────────────────────────────────────────────────
const RELATION_LABELS: Record<string, string> = {
  father: "Padre", mother: "Madre", son: "Hijo", daughter: "Hija",
  spouse: "Cónyuge", sibling: "Hermano/a", brother: "Hermano", sister: "Hermana",
  grandfather_paternal: "Abuelo paterno", grandmother_paternal: "Abuela paterna",
  grandfather_maternal: "Abuelo materno", grandmother_maternal: "Abuela materna",
  uncle_paternal: "Tío paterno", aunt_paternal: "Tía paterna",
  uncle_maternal: "Tío materno", aunt_maternal: "Tía materna",
  cousin: "Primo/a", nephew: "Sobrino", niece: "Sobrina",
  grandson: "Nieto", granddaughter: "Nieta",
  father_in_law: "Suegro", mother_in_law: "Suegra",
  root: "Tú", other: "Familiar",
};

const EVENT_SYMBOL: Record<string, string> = {
  birth: "✦", marriage: "◎", death: "✦", graduation: "⬟",
  reunion: "◈", anniversary: "★", other: "◇",
};

const EVENT_LABEL: Record<string, string> = {
  birth: "Nació", marriage: "Se casó", death: "Falleció",
  graduation: "Graduación", reunion: "Reunión", anniversary: "Aniversario", other: "Evento",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function birthYear(d?: string | null): number | null {
  if (!d) return null;
  return new Date(d + "T12:00:00").getFullYear();
}

function eventYear(d: string): number {
  return new Date(d + "T12:00:00").getFullYear();
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es", {
    day: "numeric", month: "long",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RelativeOrb({ rel, onClick }: { rel: RelativeItem; onClick: () => void }) {
  const src = rel.avatarUrl ?? getDiceBearUrl(rel.id);
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}>
      <div style={{
        width: 54, height: 54, borderRadius: "50%",
        border: "1.5px solid rgba(212,175,55,0.35)",
        boxShadow: "0 0 16px rgba(212,175,55,0.15)",
        overflow: "hidden", background: "#0c0a18",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={rel.first_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{rel.first_name}</p>
        {rel.birth_year && (
          <p style={{ fontSize: 10, color: "rgba(212,175,55,0.5)" }}>{rel.birth_year}</p>
        )}
      </div>
    </div>
  );
}

function EventOrb({ ev, birthCity }: { ev: EventItem; birthCity?: string | null }) {
  return (
    <div style={{
      background: "rgba(8,6,18,0.94)",
      border: "1px solid rgba(212,175,55,0.28)",
      borderRadius: 16, padding: "9px 10px",
      boxShadow: "0 0 18px rgba(212,175,55,0.1), 0 4px 14px rgba(0,0,0,0.7)",
      backdropFilter: "blur(14px)",
      width: 74, textAlign: "center",
    }}>
      <div style={{ fontSize: 14, color: "#d4af37", lineHeight: 1, marginBottom: 3 }}>
        {EVENT_SYMBOL[ev.event_type] ?? "✦"}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#d4af37", lineHeight: 1 }}>
        {eventYear(ev.event_date)}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", lineHeight: 1.3, marginTop: 2 }}>
        {EVENT_LABEL[ev.event_type] ?? "Evento"}
      </div>
      {ev.event_type === "birth" && birthCity && (
        <div style={{ fontSize: 10, color: "rgba(212,175,55,0.45)", lineHeight: 1.2, marginTop: 1 }}>
          {birthCity}
        </div>
      )}
      {ev.event_type !== "birth" && (
        <div style={{ fontSize: 10, color: "rgba(212,175,55,0.45)", lineHeight: 1.2, marginTop: 1 }}>
          {formatShortDate(ev.event_date)}
        </div>
      )}
    </div>
  );
}

type TabKey = "historia" | "galeria" | "recuerdos" | "atributos";
const TAB_LABELS: Record<TabKey, string> = {
  historia: "Historia", galeria: "Galería", recuerdos: "Recuerdos", atributos: "Atributos",
};

// ── Page ──────────────────────────────────────────────────────────────────────
function PersonaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSelf = searchParams.get("self") === "true";
  const compartir = searchParams.get("compartir") === "true";
  const { personId } = useParams<{ personId: string }>();

  const [person, setPerson] = useState<PersonData | null>(null);
  const [relatives, setRelatives] = useState<RelativeItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [relationType, setRelationType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("historia");
  const [moreOpen, setMoreOpen] = useState(false);

  const supabase = createClient();

  // Gallery state
  const [galleryPhotos, setGalleryPhotos] = useState<Array<{ id: string; photo_path: string; body: string; memory_date: string }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [textMemories, setTextMemories] = useState<Array<{ id: string; body: string; memory_date: string }>>([]);
  const [textMemoriesLoaded, setTextMemoriesLoaded] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Edit state (for unclaimed persons created by current user)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editFirstSurname, setEditFirstSurname] = useState("");
  const [editSecondSurname, setEditSecondSurname] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editBirthCity, setEditBirthCity] = useState("");
  const [editBirthCountry, setEditBirthCountry] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const editPhotoRef = useRef<HTMLInputElement>(null);

  // Memory contribution (compartir lo que sabes)
  const [showCompartirForm, setShowCompartirForm] = useState(compartir);
  const [memoryText, setMemoryText] = useState("");
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryDone, setMemoryDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!personId) return;
    fetch(`/api/persona/${personId}`)
      .then(r => { if (!r.ok) throw new Error("No autorizado"); return r.json(); })
      .then(({ person: p, relatives: rel, events: ev, relationType: rt }) => {
        setPerson(p);
        setRelatives(rel ?? []);
        setEvents(ev ?? []);
        setRelationType(rt ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [personId]);

  useEffect(() => {
    if (tab !== "recuerdos" || textMemoriesLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("family_memories")
        .select("id, body, memory_date")
        .eq("person_id", personId)
        .is("photo_path", null)
        .order("created_at", { ascending: false })
        .limit(30);
      setTextMemories((data ?? []) as any[]);
      setTextMemoriesLoaded(true);
    })();
  }, [tab, textMemoriesLoaded, supabase, personId]);

  useEffect(() => {
    if (tab !== "galeria" || galleryLoaded) return;
    setGalleryLoading(true);
    (async () => {
      const { data } = await supabase
        .from("family_memories")
        .select("id, photo_path, body, memory_date")
        .eq("person_id", personId)
        .not("photo_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      setGalleryPhotos((data ?? []).filter((d): d is typeof d & { photo_path: string } => Boolean(d.photo_path)));
      setGalleryLoaded(true);
      setGalleryLoading(false);
    })();
  }, [tab, galleryLoaded, supabase]);

  const handleGalleryUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop() ?? "jpg";
      const path = `memories/${Date.now()}.${ext}`;
      const { data: upData, error: upErr } = await supabase.storage
        .from("family-photos")
        .upload(path, uploadFile, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("family-photos").getPublicUrl(upData.path);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: spaceData } = await supabase
        .from("space_memberships")
        .select("space_id")
        .eq("person_id", personId)
        .limit(1)
        .single();
      if (!spaceData) throw new Error("Sin espacio familiar");
      await supabase.from("family_memories").insert({
        author_user_id: user!.id,
        family_space_id: (spaceData as any).space_id,
        person_id: personId,
        body: uploadCaption || `Foto de ${person?.first_name ?? "familiar"}`,
        memory_date: new Date().toISOString().slice(0, 10),
        photo_path: urlData.publicUrl,
      });
      setGalleryPhotos(prev => [{
        id: Date.now().toString(),
        photo_path: urlData.publicUrl,
        body: uploadCaption || `Foto de ${person?.first_name ?? "familiar"}`,
        memory_date: new Date().toISOString().slice(0, 10),
      }, ...prev]);
      setShowUploadForm(false);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadCaption("");
    } catch {
      // silent — stay in upload state
    } finally {
      setUploading(false);
    }
  };

  const firstName = person?.first_name ?? "";
  const fullName = person
    ? [person.first_name, person.middle_name, person.first_surname, person.second_surname].filter(Boolean).join(" ")
    : "";
  const bYear = birthYear(person?.birth_date);
  const avatarSrc = person?.avatarUrl ?? (person?.photo_path ?? (person ? getDiceBearUrl(person.id) : null));
  const relationLabel = relationType ? (RELATION_LABELS[relationType] ?? relationType) : null;

  const canEditProfile = !!(
    currentUserId &&
    person?.created_by &&
    currentUserId === person.created_by &&
    !person.is_claimed
  );

  const openEditModal = () => {
    if (!person) return;
    setEditFirstName(person.first_name ?? "");
    setEditMiddleName(person.middle_name ?? "");
    setEditFirstSurname(person.first_surname ?? "");
    setEditSecondSurname(person.second_surname ?? "");
    setEditBirthDate(person.birth_date ?? "");
    setEditBirthCity(person.birth_city ?? "");
    setEditBirthCountry(person.birth_country ?? "");
    setEditPhotoFile(null);
    setEditPhotoPreview(person.photo_path ?? null);
    setEditError("");
    setEditOpen(true);
    setMoreOpen(false);
  };

  const handleEditSave = async () => {
    setEditError("");
    if (!editFirstName.trim()) { setEditError("El nombre es requerido"); return; }
    setEditSaving(true);
    try {
      let photo_path: string | undefined;
      if (editPhotoFile) {
        const fd = new FormData();
        fd.append("photo", editPhotoFile);
        const upRes = await fetch(`/api/persona/${personId}/photo`, { method: "POST", body: fd });
        if (!upRes.ok) {
          const d = await upRes.json().catch(() => ({}));
          throw new Error(d.error ?? "Error al subir la foto");
        }
        const upData = await upRes.json();
        photo_path = upData.photo_path;
      }
      const res = await fetch(`/api/persona/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editFirstName.trim(),
          middle_name: editMiddleName.trim() || null,
          first_surname: editFirstSurname.trim() || null,
          second_surname: editSecondSurname.trim() || null,
          birth_date: editBirthDate || null,
          birth_city: editBirthCity.trim() || null,
          birth_country: editBirthCountry.trim() || null,
          ...(photo_path ? { photo_path } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al guardar");
      }
      // Refresh person data
      const freshRes = await fetch(`/api/persona/${personId}`);
      if (freshRes.ok) {
        const { person: p, relatives: rel, events: ev, relationType: rt } = await freshRes.json();
        setPerson(p);
        setRelatives(rel ?? []);
        setEvents(ev ?? []);
        setRelationType(rt ?? null);
      }
      setEditOpen(false);
    } catch (e: any) {
      setEditError(e.message ?? "Error al guardar");
    } finally {
      setEditSaving(false);
    }
  };

  const handleShareMemory = async () => {
    if (!memoryText.trim()) return;
    setMemorySaving(true);
    try {
      const res = await fetch("/api/hoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: memoryText.trim(),
          person_id: personId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al guardar");
      }
      setMemoryDone(true);
      // Refresh text memories so the new entry shows in Recuerdos tab
      setTextMemoriesLoaded(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      toast.error(msg);
      setMemorySaving(false);
    } finally {
      setMemorySaving(false);
    }
  };

  // Years display
  const yearsLine = person?.is_deceased
    ? `${bYear ?? "?"} — †`
    : bYear ? `${bYear} — Presente` : null;

  // Build floating event orbs: birth first, then other events
  const birthEvent: EventItem | null = bYear && person?.birth_date ? {
    id: "birth", title: "Nacimiento", event_type: "birth",
    event_date: person.birth_date, description: null,
  } : null;

  const floatingEvents: EventItem[] = [];
  if (birthEvent) floatingEvents.push(birthEvent);
  for (const ev of events) {
    if (floatingEvents.length >= 3) break;
    if (ev.event_type !== "birth") floatingEvents.push(ev);
  }

  const leftRel = relatives[0] ?? null;
  const rightRel = relatives[1] ?? null;

  if (loading) return <CosmicSpinner />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100, overflowX: "hidden" }}>

      {/* Floating header overlay */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        padding: "calc(env(safe-area-inset-top,20px) + 14px) 20px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(180deg, rgba(3,2,8,0.82) 0%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <button onClick={() => router.back()} style={{
          width: 38, height: 38, borderRadius: 12, background: "rgba(12,10,24,0.9)",
          border: "1px solid rgba(212,175,55,0.22)", boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "auto",
        }}>
          <ArrowLeft size={18} style={{ color: "rgba(212,175,55,0.8)" }} />
        </button>

        <div style={{ position: "relative" }}>
          <button onClick={() => setMoreOpen(v => !v)} style={{
            width: 38, height: 38, borderRadius: 12, background: "rgba(12,10,24,0.9)",
            border: "1px solid rgba(212,175,55,0.22)", boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "auto",
          }}>
            <MoreHorizontal size={18} style={{ color: "rgba(212,175,55,0.8)" }} />
          </button>
          {moreOpen && (
            <>
              {/* Invisible overlay to close menu on outside click */}
              <div onClick={() => setMoreOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 49 }} />
            <div style={{
              position: "absolute", top: 44, right: 0, zIndex: 50,
              background: "#0c0a18", border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
              minWidth: 160, pointerEvents: "auto",
            }}>
              <Link href="/tree" style={{ textDecoration: "none" }}>
                <div style={{ padding: "12px 16px", fontSize: 13, color: "#fff",
                  borderBottom: "0.5px solid rgba(212,175,55,0.1)" }}>
                  Ver en la galaxia
                </div>
              </Link>
              {canEditProfile && (
                <button onClick={openEditModal}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
                    borderBottom: "0.5px solid rgba(212,175,55,0.1)", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 16px", fontSize: 13, color: "#d4af37" }}>
                    <Pencil size={13} style={{ color: "rgba(212,175,55,0.6)" }} />
                    Editar perfil
                  </div>
                </button>
              )}
              {isSelf && (
                <Link href="/profile" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 16px", fontSize: 13, color: "#fff" }}>
                    <Settings size={13} style={{ color: "rgba(212,175,55,0.6)" }} />
                    Ajustes de perfil
                  </div>
                </Link>
              )}
            </div>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div style={{ padding: "120px 20px", textAlign: "center" }}>
          <p style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>No disponible</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{error}</p>
          <button onClick={() => router.back()} style={{
            background: "#c9a820", border: "none", borderRadius: 12, padding: "11px 24px",
            color: "#030208", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Volver
          </button>
        </div>
      ) : (
        <>
          {/* ── HERO ─────────────────────────────────────────────────────────── */}
          <div style={{
            position: "relative", minHeight: 370, overflow: "hidden",
            background: "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(28,18,65,0.75) 0%, rgba(3,2,8,0) 100%)",
          }}>
            {/* Micro-stars */}
            {[...Array(22)].map((_, i) => (
              <div key={i} style={{
                position: "absolute", borderRadius: "50%",
                width: i % 4 === 0 ? 2 : 1, height: i % 4 === 0 ? 2 : 1,
                background: "rgba(212,175,55,0.6)",
                left: `${(i * 41 + 13) % 100}%`,
                top: `${(i * 27 + 9) % 92}%`,
                opacity: 0.25 + (i % 3) * 0.18,
              }} />
            ))}

            {/* Constellation lines (SVG) */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {leftRel && (
                <line x1="86" y1="175" x2="114" y2="175"
                  stroke="rgba(212,175,55,0.22)" strokeWidth="0.7" strokeDasharray="4,7" />
              )}
              {rightRel && (
                <line x1="276" y1="175" x2="304" y2="175"
                  stroke="rgba(212,175,55,0.22)" strokeWidth="0.7" strokeDasharray="4,7" />
              )}
            </svg>

            {/* Main layout */}
            <div style={{ paddingTop: 108, display: "flex", flexDirection: "column", alignItems: "center" }}>

              {/* Portrait row */}
              <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 16px" }}>

                {/* Left relative */}
                <div style={{ width: 72, display: "flex", justifyContent: "center" }}>
                  {leftRel && (
                    <RelativeOrb rel={leftRel} onClick={() => router.push(`/persona/${leftRel.id}`)} />
                  )}
                </div>

                {/* Portrait */}
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: 160, height: 160 }}>
                    {/* Outer halo */}
                    <div style={{
                      position: "absolute", inset: -20, borderRadius: "50%",
                      border: "1px solid rgba(212,175,55,0.1)",
                      boxShadow: "0 0 50px rgba(212,175,55,0.08), inset 0 0 30px rgba(212,175,55,0.04)",
                    }} />
                    {/* Mid ring */}
                    <div style={{
                      position: "absolute", inset: -10, borderRadius: "50%",
                      border: "1px solid rgba(212,175,55,0.18)",
                    }} />
                    {/* Portrait ring */}
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      background: "conic-gradient(from 15deg,#d4af37 0%,#f5e070 16%,#8a6012 32%,#6030b0 48%,#2044c0 64%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)",
                      padding: 3,
                      boxShadow: "0 0 55px rgba(212,175,55,0.38), 0 8px 32px rgba(0,0,0,0.7)",
                    }}>
                      <div style={{
                        width: "100%", height: "100%", borderRadius: "50%",
                        background: "#0c0a18", overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {avatarSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarSrc} alt={firstName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 44, fontWeight: 800, color: "#d4af37" }}>
                            {firstName[0] ?? "?"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right relative */}
                <div style={{ width: 72, display: "flex", justifyContent: "center" }}>
                  {rightRel && (
                    <RelativeOrb rel={rightRel} onClick={() => router.push(`/persona/${rightRel.id}`)} />
                  )}
                </div>
              </div>

              {/* Name / years / relation */}
              <div style={{ textAlign: "center", padding: "14px 24px 20px", zIndex: 5 }}>
                <h1 style={{
                  fontSize: 34, fontWeight: 800, color: "#fff",
                  letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 5,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}>
                  {fullName || firstName}
                </h1>
                {yearsLine && (
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 8, fontWeight: 500 }}>
                    {yearsLine}
                  </p>
                )}
                {isSelf && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)",
                    borderRadius: 100, padding: "5px 14px", marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#d4af37" }}>Tú</span>
                  </div>
                )}
                {!isSelf && relationLabel && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 11, color: "#d4af37", lineHeight: 1 }}>✦</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#d4af37" }}>{relationLabel}</span>
                  </div>
                )}
                {person?.birth_city && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    marginTop: 6, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                    <MapPin size={10} />
                    <span>{[person.birth_city, person.birth_country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Floating event orbs */}
            {floatingEvents[0] && (
              <div style={{ position: "absolute", top: 72, right: 8, zIndex: 5 }}>
                <EventOrb ev={floatingEvents[0]} birthCity={person?.birth_city} />
              </div>
            )}
            {floatingEvents[1] && (
              <div style={{ position: "absolute", top: 140, left: 2, zIndex: 5 }}>
                <EventOrb ev={floatingEvents[1]} />
              </div>
            )}
            {floatingEvents[2] && (
              <div style={{ position: "absolute", bottom: 56, right: 8, zIndex: 5 }}>
                <EventOrb ev={floatingEvents[2]} />
              </div>
            )}
          </div>

          {/* ── COMPARTIR MEMORIA ───────────────────────────────────────────── */}
          {showCompartirForm && person?.is_deceased && (
            <div style={{
              margin: "0 16px 4px", padding: "18px 18px 20px",
              background: "linear-gradient(145deg,#0d0b10 0%,#080608 100%)",
              border: "1px solid rgba(180,140,255,0.25)",
              borderRadius: 18,
            }}>
              {memoryDone ? (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🕊️</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#c8aaff", marginBottom: 6 }}>
                    ¡Gracias por compartir!
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 14 }}>
                    Tu recuerdo quedó guardado. Otros familiares podrán leerlo,
                    confirmar fechas o agregar más detalles.
                  </p>
                  <button
                    onClick={() => setTab("recuerdos")}
                    style={{
                      padding: "9px 20px", borderRadius: 50, border: "none", cursor: "pointer",
                      background: "rgba(180,140,255,0.15)",
                      borderTop: "1.5px solid rgba(180,140,255,0.3)",
                      color: "rgba(200,170,255,0.9)", fontSize: 12, fontWeight: 700,
                    }}
                  >
                    Ver recuerdos →
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(180,140,255,0.9)", marginBottom: 4 }}>
                    🕊️ ¿Qué sabes sobre {person.first_name}?
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, lineHeight: 1.5 }}>
                    Escribe una fecha aproximada, un lugar, una historia o cualquier dato que recuerdes.
                    Otros familiares podrán confirmarlo o agregar más.
                  </p>
                  <textarea
                    value={memoryText}
                    onChange={e => setMemoryText(e.target.value)}
                    placeholder={`Ej: Creo que ${person.first_name} nació alrededor de 1920 en Bogotá...`}
                    rows={3}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(180,140,255,0.2)", borderRadius: 12,
                      padding: "10px 12px", color: "#fff", fontSize: 13,
                      lineHeight: 1.5, resize: "none", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={handleShareMemory}
                    disabled={memorySaving || !memoryText.trim()}
                    style={{
                      marginTop: 10, width: "100%", padding: "11px 0",
                      borderRadius: 50, border: "none", cursor: "pointer",
                      background: memoryText.trim() ? "rgba(180,140,255,0.18)" : "rgba(255,255,255,0.05)",
                      color: memoryText.trim() ? "rgba(200,170,255,0.9)" : "rgba(255,255,255,0.2)",
                      fontSize: 13, fontWeight: 700,
                      borderTop: memoryText.trim() ? "1.5px solid rgba(180,140,255,0.35)" : "1.5px solid transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    {memorySaving ? "Guardando..." : "Compartir recuerdo"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── TABS ─────────────────────────────────────────────────────────── */}
          <div style={{
            display: "flex", borderBottom: "0.5px solid rgba(212,175,55,0.14)",
            padding: "0 12px", background: "rgba(3,2,8,0.98)",
            position: "sticky", top: 0, zIndex: 20,
          }}>
            {(Object.keys(TAB_LABELS) as TabKey[]).map(t => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "13px 4px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? "#d4af37" : "rgba(255,255,255,0.32)",
                  borderBottom: active ? "2px solid #d4af37" : "2px solid transparent",
                  transition: "color 0.15s ease, border-color 0.15s ease",
                }}>
                  {TAB_LABELS[t]}
                </button>
              );
            })}
          </div>

          {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}
          <div style={{ padding: "20px 16px", maxWidth: 500, margin: "0 auto" }}>

            {/* HISTORIA TAB */}
            {tab === "historia" && (
              <div>

                {isSelf && (
                  <div style={{
                    background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)",
                    borderRadius: 16, padding: "14px 16px", marginBottom: 20,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
                        Tu historia en Ceiba
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                        Conectado con {relatives.length} familiar{relatives.length !== 1 ? "es" : ""} en Ceiba.
                      </p>
                    </div>
                    <Link href="/profile" style={{ textDecoration: "none",
                      background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: 10, padding: "7px 14px",
                      fontSize: 11, fontWeight: 700, color: "#d4af37", flexShrink: 0 }}>
                      Editar
                    </Link>
                  </div>
                )}

                {[...(birthEvent ? [birthEvent] : []), ...events].length === 0 ? (
                  <div style={{ padding: "48px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 14, opacity: 0.3 }}>✦</div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                      Sin momentos registrados
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, lineHeight: 1.5 }}>
                      Agrega un primer momento para comenzar{"\n"}la historia de {firstName}.
                    </p>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    {/* Timeline vertical line */}
                    <div style={{
                      position: "absolute", left: 15, top: 20, bottom: 20,
                      width: 1,
                      background: "linear-gradient(180deg,rgba(212,175,55,0.45) 0%,rgba(212,175,55,0.06) 100%)",
                    }} />
                    {[...(birthEvent ? [birthEvent] : []), ...events.slice(0, 6)].map((ev) => {
                      const isGold = ev.event_type === "birth";
                      const col = isGold ? "212,175,55"
                        : ev.event_type === "marriage" ? "220,120,60"
                        : ev.event_type === "death" ? "160,160,190"
                        : ev.event_type === "graduation" ? "60,130,240"
                        : "160,80,240";
                      return (
                        <div key={ev.id} style={{ display: "flex", gap: 18, marginBottom: 18 }}>
                          {/* Dot */}
                          <div style={{
                            position: "relative", zIndex: 2, flexShrink: 0,
                            width: 30, display: "flex", alignItems: "flex-start", justifyContent: "center",
                            paddingTop: 16,
                          }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%",
                              background: `rgba(${col},0.15)`,
                              border: `1.5px solid rgba(${col},0.55)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 8, color: `rgba(${col},0.9)`,
                            }}>
                              {EVENT_SYMBOL[ev.event_type] ?? "•"}
                            </div>
                          </div>
                          {/* Card */}
                          <div style={{
                            flex: 1, background: "rgba(12,10,24,0.85)", borderRadius: 14,
                            padding: "13px 15px",
                            borderTop: `1.5px solid rgba(${col},0.22)`,
                            borderLeft: `1px solid rgba(${col},0.1)`,
                            borderBottom: "2px solid rgba(0,0,0,0.5)",
                            borderRight: "1px solid rgba(0,0,0,0.4)",
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: `rgb(${col})`, marginBottom: 3 }}>
                              {eventYear(ev.event_date)}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.35, marginBottom: 3 }}>
                              {ev.event_type === "birth" && person?.birth_city
                                ? `Nació en ${person.birth_city}${person.birth_country ? `, ${person.birth_country}` : ""}`
                                : ev.title}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                              {formatDate(ev.event_date)}
                            </div>
                            {ev.description && (
                              <div style={{
                                fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 7,
                                fontStyle: "italic", lineHeight: 1.55,
                              }}>
                                {ev.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* GALERÍA TAB */}
            {tab === "galeria" && (
              <div>
                {/* Hidden file input */}
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadFile(f);
                    setUploadPreview(URL.createObjectURL(f));
                    setShowUploadForm(true);
                  }} />

                {/* Lightbox */}
                {lightboxSrc && (
                  <div onClick={() => setLightboxSrc(null)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 100,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightboxSrc} alt="" style={{ maxWidth: "100%", maxHeight: "90vh",
                      borderRadius: 12, objectFit: "contain" }} />
                    <button onClick={() => setLightboxSrc(null)}
                      style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.1)",
                        border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <X size={18} />
                    </button>
                  </div>
                )}

                {/* Upload form */}
                {showUploadForm && uploadPreview && (
                  <div style={{ marginBottom: 16, background: "rgba(12,10,24,0.95)", borderRadius: 16,
                    padding: 16, border: "1px solid rgba(212,175,55,0.2)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadPreview} alt="" style={{ width: "100%", maxHeight: 220,
                      objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
                    <input
                      type="text"
                      placeholder="Añadir una descripción…"
                      value={uploadCaption}
                      onChange={e => setUploadCaption(e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(212,175,55,0.18)", borderRadius: 10,
                        padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none",
                        marginBottom: 12, boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowUploadForm(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(""); }}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "transparent",
                          border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)",
                          fontSize: 13, cursor: "pointer" }}>
                        Cancelar
                      </button>
                      <button onClick={handleGalleryUpload} disabled={uploading}
                        style={{ flex: 2, padding: "11px 0", borderRadius: 12,
                          background: uploading ? "rgba(212,175,55,0.15)" : "rgba(212,175,55,0.2)",
                          border: "1px solid rgba(212,175,55,0.4)", color: "#d4af37",
                          fontSize: 13, fontWeight: 700, cursor: uploading ? "default" : "pointer" }}>
                        {uploading ? "Subiendo…" : "Guardar foto"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add photo button */}
                {!showUploadForm && (
                  <button onClick={() => photoInputRef.current?.click()}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: "13px 0", borderRadius: 14, marginBottom: 16,
                      background: "rgba(212,175,55,0.07)",
                      border: "1px dashed rgba(212,175,55,0.28)",
                      color: "rgba(212,175,55,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <Plus size={15} />
                    Agregar foto al álbum
                  </button>
                )}

                {/* Grid */}
                {galleryLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <CosmicSpinner />
                  </div>
                ) : galleryPhotos.length === 0 ? (
                  <div style={{ padding: "36px 0", textAlign: "center" }}>
                    <Camera size={32} style={{ color: "rgba(212,175,55,0.25)", marginBottom: 12 }} />
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 1.6 }}>
                      Todavía no hay fotos en el álbum.<br />
                      Sé el primero en agregar una.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                    {galleryPhotos.map(p => (
                      <div key={p.id} onClick={() => setLightboxSrc(p.photo_path)}
                        style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden",
                          background: "rgba(255,255,255,0.04)", cursor: "pointer" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photo_path} alt={p.body}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* RECUERDOS TAB */}
            {tab === "recuerdos" && (() => {
              const eventMemories = events.filter(ev => ev.description && ev.description.length > 0);
              const hasAny = eventMemories.length > 0 || textMemories.length > 0;
              return !hasAny ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 14, opacity: 0.3 }}>◈</div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    Sin recuerdos todavía
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, lineHeight: 1.5 }}>
                    Los momentos especiales de {firstName}<br />vivirán aquí.
                  </p>
                  {person?.is_deceased && (
                    <button
                      onClick={() => { setMemoryDone(false); setMemoryText(""); setShowCompartirForm(true); setTab("historia"); }}
                      style={{
                        marginTop: 20, padding: "10px 22px", borderRadius: 50,
                        background: "rgba(180,140,255,0.1)", border: "1.5px solid rgba(180,140,255,0.25)",
                        color: "rgba(200,170,255,0.8)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      🕊️ Compartir un recuerdo
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {textMemories.map(m => (
                    <div key={m.id} style={{
                      background: "rgba(180,140,255,0.05)", borderRadius: 14, padding: "14px 16px",
                      border: "1px solid rgba(180,140,255,0.15)",
                    }}>
                      <div style={{ fontSize: 11, color: "rgba(180,140,255,0.45)", marginBottom: 6 }}>
                        🕊️ {formatDate(m.memory_date)}
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                  {eventMemories.slice(0, 5).map(ev => (
                    <div key={ev.id} style={{
                      background: "rgba(12,10,24,0.85)", borderRadius: 14, padding: "15px 16px",
                      border: "1px solid rgba(212,175,55,0.1)",
                    }}>
                      <div style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginBottom: 4 }}>
                        {formatDate(ev.event_date)} · {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 7, lineHeight: 1.3 }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, fontStyle: "italic" }}>
                        "{ev.description}"
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ATRIBUTOS TAB */}
            {tab === "atributos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {person?.birth_date && (
                  <AttrRow icon="✦" iconColor="212,175,55" label="Fecha de nacimiento"
                    value={formatDate(person.birth_date)} />
                )}
                {(person?.birth_city || person?.birth_country) && (
                  <AttrRow icon="◎" iconColor="60,130,220" label="Lugar de nacimiento"
                    value={[person.birth_city, person.birth_country].filter(Boolean).join(", ")} />
                )}
                {person?.hasAccount && (
                  <AttrRow icon="✓" iconColor="40,200,100" label="Cuenta Ceiba" value="Conectado a Ceiba" />
                )}
                {!person?.birth_date && !person?.birth_city && !person?.hasAccount && (
                  <div style={{ padding: "48px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.25 }}>◇</div>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin atributos registrados</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <CosmicNav />

      {/* ── EDIT MODAL (unclaimed profiles only) ───────────────────────────── */}
      {editOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end" }}
          onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div style={{ width: "100%", background: "#06030f", borderRadius: "24px 24px 0 0",
            padding: "20px 16px calc(env(safe-area-inset-bottom,16px) + 24px)",
            border: "1px solid rgba(212,175,55,0.2)", borderBottom: "none",
            maxHeight: "92dvh", overflowY: "auto" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>Editar perfil</div>
                <div style={{ fontSize: 10, color: "rgba(212,175,55,0.45)", marginTop: 2 }}>
                  Solo tú puedes editar hasta que el familiar reclame su cuenta
                </div>
              </div>
              <button onClick={() => setEditOpen(false)}
                style={{ marginLeft: "auto", background: "none", border: "none",
                  color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Photo picker — label wrapper for reliable iOS file picker */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <label htmlFor="edit-photo-input" style={{ display: "block", position: "relative", cursor: "pointer" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
                  border: "2px solid rgba(212,175,55,0.4)", background: "#0c0a18" }}>
                  {editPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editPhotoPreview} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 28, color: "rgba(212,175,55,0.3)" }}>
                      {(editFirstName || person?.first_name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26,
                  borderRadius: "50%", background: "#d4af37", border: "2px solid #06030f",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Camera size={12} style={{ color: "#030208" }} />
                </div>
              </label>
              <input
                id="edit-photo-input"
                ref={editPhotoRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setEditPhotoFile(f);
                  if (editPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(editPhotoPreview);
                  setEditPhotoPreview(URL.createObjectURL(f));
                }}
              />
            </div>
            <div style={{ textAlign: "center", fontSize: 10, color: "rgba(212,175,55,0.4)", marginBottom: 20 }}>
              Toca la foto para cambiarla
            </div>

            {/* Fields */}
            {[
              { label: "Nombre*", value: editFirstName, set: setEditFirstName, placeholder: "Nombre" },
              { label: "Segundo nombre", value: editMiddleName, set: setEditMiddleName, placeholder: "Opcional" },
              { label: "Primer apellido", value: editFirstSurname, set: setEditFirstSurname, placeholder: "Apellido" },
              { label: "Segundo apellido", value: editSecondSurname, set: setEditSecondSurname, placeholder: "Opcional" },
              { label: "Ciudad de nacimiento", value: editBirthCity, set: setEditBirthCity, placeholder: "Ciudad" },
              { label: "País de nacimiento", value: editBirthCountry, set: setEditBirthCountry, placeholder: "País" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(212,175,55,0.5)", marginBottom: 6 }}>{label}</div>
                <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  style={{ width: "100%", background: "#0a0618", border: "1.5px solid rgba(212,175,55,0.2)",
                    borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 14,
                    boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
            ))}

            {/* Birth date */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(212,175,55,0.5)", marginBottom: 6 }}>Fecha de nacimiento</div>
              <input type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)}
                style={{ width: "100%", background: "#0a0618", border: "1.5px solid rgba(212,175,55,0.2)",
                  borderRadius: 12, padding: "11px 14px",
                  color: editBirthDate ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 14,
                  boxSizing: "border-box" }} />
            </div>

            {editError && (
              <div style={{ fontSize: 12, color: "#ff6b8a", marginBottom: 12, textAlign: "center" }}>
                {editError}
              </div>
            )}

            <button onClick={handleEditSave} disabled={editSaving}
              style={{ width: "100%", background: editSaving ? "rgba(212,175,55,0.08)" : "rgba(212,175,55,0.16)",
                border: "1.5px solid rgba(212,175,55,0.45)", borderRadius: 16,
                color: editSaving ? "rgba(212,175,55,0.35)" : "#d4af37",
                padding: "14px", cursor: editSaving ? "default" : "pointer",
                fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8 }}>
              {editSaving ? "Guardando…" : <><Check size={16} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PersonaPage() {
  return (
    <Suspense fallback={null}>
      <PersonaPageInner />
    </Suspense>
  );
}

function AttrRow({ icon, iconColor, label, value }: {
  icon: string; iconColor: string; label: string; value: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "rgba(12,10,24,0.85)", borderRadius: 14, padding: "14px 16px",
      border: `1px solid rgba(${iconColor},0.1)`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: `rgba(${iconColor},0.08)`,
        border: `1px solid rgba(${iconColor},0.15)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: `rgba(${iconColor},0.8)`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 9.5, fontWeight: 700, color: "rgba(212,175,55,0.45)",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</div>
      </div>
    </div>
  );
}
