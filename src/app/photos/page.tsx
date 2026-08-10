"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X, Trash2, Tag, UserCheck, AlertCircle, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dInput, C } from "@/components/ui/cosmic";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RosterMember {
  person_id: string; user_id: string; first_name: string; last_name: string; photo_path: string | null;
}
interface PhotoTag { person_id: string; first_name: string; last_name: string; }
interface Photo {
  id: string; uploader_user_id: string; storage_path: string; url: string;
  caption: string | null; created_at: string;
  uploader: { first_name: string; last_name: string; photo_path: string | null } | null;
  tags: PhotoTag[];
}

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes alb-hero-in   { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
  @keyframes alb-card-in   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes alb-twinkle   { 0%,100%{opacity:0.7} 50%{opacity:0.2} }
  @keyframes alb-pulse-glow{ 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
`;

// ── Person album card ──────────────────────────────────────────────────────────

function PersonAlbum({
  person, photos, isActive, onClick,
}: {
  person: PhotoTag; photos: Photo[]; isActive: boolean; onClick: () => void;
}) {
  const mine = photos.filter(p => p.tags?.some(t => t.person_id === person.person_id));
  const preview = mine.slice(0, 4);

  return (
    <button onClick={onClick} style={{
      width: 148, flexShrink: 0, borderRadius: 18, overflow: "hidden", cursor: "pointer",
      background: "rgba(8,5,18,0.92)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `0.5px solid rgba(242,180,60,${isActive ? 0.65 : 0.12})`,
      borderTop: `0.5px solid rgba(242,180,60,${isActive ? 0.80 : 0.22})`,
      boxShadow: isActive ? "0 0 24px rgba(242,180,60,0.18), 0 8px 24px rgba(0,0,0,0.60)" : "0 4px 18px rgba(0,0,0,0.50)",
      transition: "box-shadow 0.2s, border-color 0.2s",
      animation: "alb-card-in 0.4s ease",
    }}>
      {/* 2×2 collage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, height: 122 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: "#0c0a18", overflow: "hidden", position: "relative" }}>
            {preview[i]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview[i].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%",
                  background: `radial-gradient(circle at 50% 50%, rgba(242,180,60,0.05) 0%, transparent 70%)` }} />}
          </div>
        ))}
      </div>
      {/* Label */}
      <div style={{ padding: "10px 12px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#F5EDD8",
          textAlign: "left", marginBottom: 3, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis" }}>
          {person.first_name} {person.last_name}
        </div>
        <div style={{ fontSize: 10, color: `rgba(242,180,60,${isActive ? 0.75 : 0.40})`,
          textAlign: "left", letterSpacing: "0.04em" }}>
          {mine.length} {mine.length === 1 ? "foto" : "fotos"}
        </div>
      </div>
    </button>
  );
}

// ── Decade album card ──────────────────────────────────────────────────────────

function DecadeAlbum({
  decade, photos, isActive, onClick,
}: {
  decade: number; photos: Photo[]; isActive: boolean; onClick: () => void;
}) {
  const cover = photos[0];
  return (
    <button onClick={onClick} style={{
      width: 130, height: 120, flexShrink: 0, borderRadius: 18, overflow: "hidden",
      cursor: "pointer", position: "relative",
      border: `0.5px solid rgba(242,180,60,${isActive ? 0.65 : 0.12})`,
      boxShadow: isActive ? "0 0 20px rgba(242,180,60,0.18)" : "0 4px 14px rgba(0,0,0,0.50)",
      animation: "alb-card-in 0.4s ease",
    }}>
      {cover
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ width: "100%", height: "100%", background: "#0c0a18" }} />}
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(0deg, rgba(3,2,8,0.90) 0%, rgba(3,2,8,0.30) 60%, transparent 100%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#F5EDD8", letterSpacing: "-0.01em",
          lineHeight: 1 }}>
          {decade}s
        </div>
        <div style={{ fontSize: 9, color: "rgba(242,180,60,0.55)", letterSpacing: "0.06em", marginTop: 2 }}>
          {photos.length} fotos
        </div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PhotosPage() {
  const router  = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos,       setPhotos]       = useState<Photo[]>([]);
  const [members,      setMembers]      = useState<RosterMember[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [loadError,    setLoadError]    = useState(false);
  const [userId,       setUserId]       = useState<string | null>(null);
  const [selectedPhoto,setSelectedPhoto]= useState<Photo | null>(null);
  const [caption,      setCaption]      = useState("");
  const [pendingFile,  setPendingFile]  = useState<File | null>(null);
  const [pendingPreview,setPendingPreview]= useState<string | null>(null);
  const [pendingTags,  setPendingTags]  = useState<RosterMember[]>([]);
  const [showTagPicker,setShowTagPicker]= useState(false);
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const [filterDecade, setFilterDecade] = useState<number | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    const rosterRes = await fetch("/api/family/roster");
    if (rosterRes.ok) { const { members } = await rosterRes.json(); setMembers(members || []); }
    await loadPhotos();
  };

  const loadPhotos = async () => {
    const res = await fetch("/api/photos");
    if (res.ok) { setLoadError(false); const { photos } = await res.json(); setPhotos(photos || []); }
    else setLoadError(true);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("La foto debe pesar menos de 10MB"); return; }
    setPendingFile(file); setPendingPreview(URL.createObjectURL(file));
    setCaption(""); setPendingTags([]);
  };

  const toggleTag = (member: RosterMember) =>
    setPendingTags(prev =>
      prev.find(m => m.person_id === member.person_id)
        ? prev.filter(m => m.person_id !== member.person_id)
        : [...prev, member]);

  const uploadPhoto = async () => {
    if (!pendingFile || !userId) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("family-photos").upload(path, pendingFile);
      if (uploadError) throw uploadError;
      const res = await fetch("/api/photos", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, caption: caption.trim() || null }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const photoId = body.photo.id;
      const tagErrors: string[] = [];
      for (const m of pendingTags) {
        const tagRes = await fetch("/api/photos/tags", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId, personId: m.person_id }) });
        if (!tagRes.ok) {
          const tagBody = await tagRes.json().catch(() => ({}));
          tagErrors.push(tagBody.error ?? `${m.first_name} ${m.last_name}`);
        }
      }
      if (tagErrors.length > 0) {
        toast.error(`Foto publicada, pero algunas etiquetas no se guardaron: ${tagErrors.join(", ")}`);
      } else {
        toast.success("¡Foto publicada!");
      }
      setPendingFile(null); setPendingPreview(null);
      setCaption(""); setPendingTags([]); setShowTagPicker(false);
      await loadPhotos();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("Error al subir la foto" + (msg ? `: ${msg}` : ""));
    } finally { setUploading(false); }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    const res = await fetch(`/api/photos?id=${photo.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    setSelectedPhoto(null); toast.success("Foto eliminada");
    await loadPhotos();
  };

  const addTagToSelected = async (member: RosterMember) => {
    if (!selectedPhoto) return;
    const already = selectedPhoto.tags?.find(t => t.person_id === member.person_id);
    await fetch("/api/photos/tags", { method: already ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: selectedPhoto.id, personId: member.person_id }) });
    await loadPhotos();
    setSelectedPhoto(prev => {
      if (!prev) return prev;
      const tags = already
        ? prev.tags.filter(t => t.person_id !== member.person_id)
        : [...prev.tags, { person_id: member.person_id, first_name: member.first_name, last_name: member.last_name }];
      return { ...prev, tags };
    });
  };

  const clearFilters = () => { setFilterMember(null); setFilterDecade(null); };

  const togglePersonFilter = (pid: string) => {
    setFilterDecade(null);
    setFilterMember(prev => prev === pid ? null : pid);
  };

  const toggleDecadeFilter = (d: number) => {
    setFilterMember(null);
    setFilterDecade(prev => prev === d ? null : d);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allTaggedPeople = Array.from(
    new Map(photos.flatMap(p => p.tags || []).map(t => [t.person_id, t])).values());

  const byDecade: Record<number, Photo[]> = {};
  photos.forEach(p => {
    const decade = Math.floor(new Date(p.created_at).getFullYear() / 10) * 10;
    if (!byDecade[decade]) byDecade[decade] = [];
    byDecade[decade].push(p);
  });
  const decades = Object.keys(byDecade).map(Number).sort((a, b) => b - a);
  const showDecades = decades.length > 1;

  const years  = photos.map(p => new Date(p.created_at).getFullYear());
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear();
  const maxYear = new Date().getFullYear();

  const isFiltered = filterMember !== null || filterDecade !== null;
  const visiblePhotos = filterMember
    ? photos.filter(p => p.tags?.some(t => t.person_id === filterMember))
    : filterDecade
      ? byDecade[filterDecade] || []
      : photos;

  const filterLabel = filterMember
    ? (allTaggedPeople.find(p => p.person_id === filterMember)?.first_name ?? "")
    : filterDecade
      ? `Años ${filterDecade}`
      : null;

  const labelStyle: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 6, display: "block",
  };
  const eyebrowStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
    textTransform: "uppercase", color: "rgba(242,180,60,0.40)",
    marginBottom: 10, display: "block",
  };

  if (loading) return <CosmicSpinner />;

  return (
    <>
      <style>{CSS}</style>

      {/* Nebula background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 110% 60% at 50% 0%, #16052a 0%, #0a0318 40%, #050212 70%, #030208 100%)" }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(85,20,190,0.16) 0%, transparent 68%)", filter: "blur(28px)" }} />
        <div style={{ position: "absolute", top: -20, left: -50, width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,50,180,0.10) 0%, transparent 68%)", filter: "blur(22px)" }} />
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
          {[[28,13,0.45],[82,9,0.38],[144,18,0.48],[210,11,0.34],[278,16,0.42],
            [22,52,0.36],[100,40,0.32],[175,56,0.40],[250,44,0.34]].map(([x,y,o],i) =>
            <circle key={i} cx={x} cy={y} r="0.6" fill="white" opacity={o} />)}
          <circle cx="162" cy="11" r="1.1" fill="#d4af37" opacity="0.88"
            style={{ animation: "alb-twinkle 3.8s ease-in-out infinite" }} />
        </svg>
      </div>

      <div style={{ minHeight: "100vh", color: "#fff", paddingBottom: 100, position: "relative", zIndex: 5 }}>
        <CosmicHeader
          title="Álbum familiar"
          backHref="/home"
          right={
            <button onClick={() => fileInputRef.current?.click()} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(8,5,18,0.95)",
              border: "none",
              borderTop: "1px solid rgba(242,180,60,0.30)",
              borderBottom: "2px solid rgba(0,0,0,0.8)",
              boxShadow: "0 4px 0 #02010a",
              borderRadius: 10, padding: "6px 12px",
              color: "#d4af37", fontSize: 11, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.04em",
            }}>
              ✦ Subir foto
            </button>
          }
        />
        <input ref={fileInputRef} type="file" accept="image/*"
          style={{ display: "none" }} onChange={handleFileSelect} />

        <div style={{ padding: "12px 14px" }}>

          {/* ── Error ─── */}
          {loadError && !pendingPreview && (
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              background: "rgba(220,60,80,0.08)", borderRadius: 14, padding: "12px 14px",
              border: "0.5px solid rgba(220,60,80,0.20)", marginBottom: 12 }}>
              <AlertCircle size={16} style={{ color: "rgba(220,60,80,0.70)", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>No se pudieron cargar las fotos</p>
                <button onClick={loadPhotos} style={{ fontSize: 11, color: "rgba(220,60,80,0.6)",
                  background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reintentar</button>
              </div>
            </div>
          )}

          {/* ── Pending upload panel ────────────────────────────────────────── */}
          {pendingPreview && (
            <div style={{
              background: "rgba(8,5,18,0.90)", backdropFilter: "blur(20px)",
              borderRadius: 22, border: "0.5px solid rgba(220,140,40,0.18)",
              borderTop: "0.5px solid rgba(220,140,40,0.38)",
              padding: 16, marginBottom: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.60)",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingPreview} alt="Preview"
                  style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 14, flexShrink: 0,
                    border: "0.5px solid rgba(220,140,40,0.22)" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={labelStyle}>Descripción</span>
                  <textarea style={{ ...s3dInput(), resize: "none", fontSize: 12 }} rows={2}
                    placeholder="¿Cuándo fue esto? ¿Quiénes están?" value={caption} onChange={e => setCaption(e.target.value)} />
                  <button onClick={() => setShowTagPicker(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(8,5,18,0.95)",
                      borderTop: "0.5px solid rgba(220,140,40,0.28)",
                      borderBottom: "2px solid #000",
                      boxShadow: "0 3px 0 #02010a",
                      borderRadius: 10, padding: "8px 12px",
                      color: "#dc9030", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none" }}>
                    <Tag size={12} />
                    {pendingTags.length > 0 ? `${pendingTags.length} etiquetado${pendingTags.length !== 1 ? "s" : ""}` : "Etiquetar familiares"}
                  </button>
                </div>
              </div>

              {pendingTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {pendingTags.map(m => (
                    <button key={m.person_id} onClick={() => toggleTag(m)}
                      style={{ display: "flex", alignItems: "center", gap: 4,
                        background: "rgba(220,140,40,0.15)", borderRadius: 100, padding: "4px 10px",
                        border: "0.5px solid rgba(220,140,40,0.30)", color: "#dc9030",
                        fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {m.first_name} <X size={9} />
                    </button>
                  ))}
                </div>
              )}

              {showTagPicker && members.length > 0 && (
                <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", maxHeight: 160, overflowY: "auto",
                  border: "0.5px solid rgba(220,140,40,0.15)" }}>
                  {members.map(m => {
                    const tagged = !!pendingTags.find(pt => pt.person_id === m.person_id);
                    return (
                      <button key={m.person_id} onClick={() => toggleTag(m)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", textAlign: "left", cursor: "pointer", border: "none",
                          background: tagged ? "rgba(220,140,40,0.10)" : "rgba(8,5,18,0.95)",
                          borderBottom: "0.5px solid rgba(220,140,40,0.08)" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#0a0818",
                          border: `0.5px solid rgba(220,140,40,${tagged ? 0.4 : 0.15})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#dc9030", flexShrink: 0 }}>
                          {m.first_name[0]}{m.last_name?.[0] || ""}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", flex: 1 }}>
                          {m.first_name} {m.last_name}
                        </span>
                        {tagged && <UserCheck size={13} style={{ color: "#dc9030" }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={uploadPhoto} disabled={uploading}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "rgba(242,180,60,0.12)",
                    border: "0.5px solid rgba(242,180,60,0.45)",
                    borderTop: "0.5px solid rgba(242,180,60,0.65)",
                    borderRadius: 14, color: "#F2B43C", fontWeight: 700, fontSize: 13,
                    padding: "12px 0", cursor: uploading ? "wait" : "pointer",
                    letterSpacing: "0.04em" }}>
                  <Upload size={13} /> {uploading ? "Subiendo..." : "✦ Publicar recuerdo"}
                </button>
                <button onClick={() => { setPendingFile(null); setPendingPreview(null); setPendingTags([]); setShowTagPicker(false); }}
                  style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(8,5,18,0.95)",
                    border: "0.5px solid rgba(212,175,55,0.18)", color: "rgba(212,175,55,0.45)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Hero cover ──────────────────────────────────────────────────── */}
          {photos.length > 0 && !pendingPreview && !isFiltered && (
            <div style={{ position: "relative", height: 220, borderRadius: 22, overflow: "hidden",
              marginBottom: 22, animation: "alb-hero-in 0.7s ease",
              border: "0.5px solid rgba(242,180,60,0.12)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.70)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[0].url} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0,
                background: "linear-gradient(0deg, rgba(3,2,8,0.94) 0%, rgba(3,2,8,0.50) 45%, rgba(3,2,8,0.18) 100%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "18px 22px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "rgba(242,180,60,0.55)", marginBottom: 8 }}>
                  Nuestros recuerdos
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#F5EDD8",
                  letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {photos.length} {photos.length === 1 ? "fotografía" : "fotografías"}
                </div>
                {years.length > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 5, letterSpacing: "0.05em" }}>
                    {minYear === maxYear ? `${minYear}` : `${minYear} · · · ${maxYear}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Smart albums — by person ────────────────────────────────────── */}
          {allTaggedPeople.length > 0 && !pendingPreview && !isFiltered && (
            <div style={{ marginBottom: 22 }}>
              <span style={eyebrowStyle}>Por familiar</span>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                {allTaggedPeople.map(person => (
                  <PersonAlbum
                    key={person.person_id}
                    person={person}
                    photos={photos}
                    isActive={filterMember === person.person_id}
                    onClick={() => togglePersonFilter(person.person_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Smart albums — by decade ────────────────────────────────────── */}
          {showDecades && !pendingPreview && !isFiltered && (
            <div style={{ marginBottom: 22 }}>
              <span style={eyebrowStyle}>Por época</span>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                {decades.map(d => (
                  <DecadeAlbum
                    key={d}
                    decade={d}
                    photos={byDecade[d]}
                    isActive={filterDecade === d}
                    onClick={() => toggleDecadeFilter(d)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Filter header when active ───────────────────────────────────── */}
          {isFiltered && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={clearFilters}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none",
                  border: "none", cursor: "pointer", color: "rgba(242,180,60,0.55)", padding: 0, fontSize: 11 }}>
                <ChevronLeft size={14} /> Todos los recuerdos
              </button>
              <div style={{ flex: 1, height: 0.5, background: "rgba(242,180,60,0.10)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#F5EDD8", letterSpacing: "0.04em" }}>
                {filterLabel}
              </span>
            </div>
          )}

          {/* ── Grid title ─────────────────────────────────────────────────── */}
          {photos.length > 0 && !pendingPreview && (
            <span style={eyebrowStyle}>
              {isFiltered ? `Fotos · ${filterLabel}` : "Todos los recuerdos"}
            </span>
          )}

          {/* ── Empty state ─────────────────────────────────────────────────── */}
          {visiblePhotos.length === 0 && !pendingPreview && (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <div style={{ fontSize: 42, marginBottom: 18, opacity: 0.25,
                animation: "alb-twinkle 4s ease-in-out infinite" }}>
                <Camera size={42} style={{ margin: "0 auto" }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.80)",
                marginBottom: 10, letterSpacing: "-0.01em" }}>
                {isFiltered ? `Sin fotos de ${filterLabel}` : "La historia aún no tiene imágenes"}
              </h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", marginBottom: 26, lineHeight: 1.75 }}>
                {!isFiltered && "Cada foto que subes se convierte en un recuerdo para siempre."}
              </p>
              {!isFiltered && (
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ background: "rgba(242,180,60,0.12)",
                    border: "0.5px solid rgba(242,180,60,0.45)",
                    borderTop: "0.5px solid rgba(242,180,60,0.65)",
                    borderRadius: 18, padding: "13px 28px",
                    color: "#F2B43C", fontWeight: 600, fontSize: 14,
                    cursor: "pointer", letterSpacing: "0.05em" }}>
                  ✦ Subir primera foto
                </button>
              )}
            </div>
          )}

          {/* ── Photo grid ─────────────────────────────────────────────────── */}
          {visiblePhotos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
              {visiblePhotos.map((photo, i) => (
                <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                  style={{ aspectRatio: "1/1", borderRadius: 10, overflow: "hidden",
                    background: "#0c0a18", position: "relative", cursor: "pointer",
                    border: "0.5px solid rgba(220,140,40,0.10)",
                    animation: `alb-card-in 0.3s ease ${i * 30}ms both`,
                  } as React.CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || "Foto familiar"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {(photo.tags?.length ?? 0) > 0 && (
                    <div style={{ position: "absolute", bottom: 5, left: 5,
                      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                      color: "#d4af37", fontSize: 9, fontWeight: 700, borderRadius: 100,
                      padding: "2px 6px", display: "flex", alignItems: "center", gap: 3 }}>
                      <Tag size={7} /> {photo.tags.length}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Lightbox ────────────────────────────────────────────────────────── */}
        {selectedPhoto && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(12px)", zIndex: 50,
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setSelectedPhoto(null)}>
            <div style={{
              width: "100%", maxWidth: 480,
              background: "rgba(6,3,16,0.98)",
              backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
              borderRadius: "24px 24px 0 0",
              borderTop: "0.5px solid rgba(242,180,60,0.35)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.92)",
              overflow: "hidden",
            }} onClick={e => e.stopPropagation()}>
              {/* Photo */}
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedPhoto.url} alt={selectedPhoto.caption || ""}
                  style={{ width: "100%", objectFit: "cover", maxHeight: "55vh", display: "block" }} />
                <button onClick={() => setSelectedPhoto(null)}
                  style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34,
                    background: "rgba(0,0,0,0.60)", backdropFilter: "blur(8px)",
                    borderRadius: "50%", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#fff" }}>
                  <X size={15} />
                </button>
              </div>

              {/* Context panel */}
              <div style={{ padding: "16px 20px 36px" }}>
                {/* Caption */}
                {selectedPhoto.caption && (
                  <p style={{ fontSize: 14, color: "#F5EDD8", fontWeight: 600,
                    marginBottom: 14, lineHeight: 1.6, fontStyle: "italic" }}>
                    {selectedPhoto.caption}
                  </p>
                )}

                {/* Tagged people */}
                {(selectedPhoto.tags?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={eyebrowStyle}>En esta foto</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedPhoto.tags.map(t => (
                        <div key={t.person_id} style={{ display: "flex", alignItems: "center", gap: 6,
                          background: "rgba(220,140,40,0.10)",
                          border: "0.5px solid rgba(220,140,40,0.28)",
                          borderRadius: 100, padding: "5px 12px 5px 6px" }}>
                          {/* mini luminous sphere */}
                          <div style={{ width: 22, height: 22, borderRadius: "50%",
                            background: "radial-gradient(circle at 35% 28%, rgba(242,180,60,0.20) 0%, rgba(8,5,18,0.97) 65%)",
                            border: "0.5px solid rgba(242,180,60,0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 8, fontWeight: 700, color: "#F2B43C", flexShrink: 0 }}>
                            {t.first_name[0]}{t.last_name?.[0] ?? ""}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#dc9030" }}>
                            {t.first_name} {t.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tag editing — owner only */}
                {selectedPhoto.uploader_user_id === userId && members.length > 0 && (
                  <details style={{ marginBottom: 14 }}>
                    <summary style={{ fontSize: 11, color: "rgba(212,175,55,0.45)", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5, listStyle: "none",
                      letterSpacing: "0.04em", fontWeight: 600 }}>
                      <Tag size={11} /> Etiquetar a alguien
                    </summary>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {members.slice(0, 12).map(m => {
                        const tagged = selectedPhoto.tags?.some(t => t.person_id === m.person_id);
                        return (
                          <button key={m.person_id} onClick={() => addTagToSelected(m)}
                            style={{ fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "5px 12px",
                              background: tagged ? "rgba(220,140,40,0.15)" : "transparent",
                              border: `0.5px solid rgba(220,140,40,${tagged ? 0.45 : 0.20})`,
                              color: tagged ? "#dc9030" : "rgba(212,175,55,0.40)", cursor: "pointer" }}>
                            {m.first_name}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Footer: uploader + date + delete */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: 12, borderTop: "0.5px solid rgba(242,180,60,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Uploader sphere */}
                    <div style={{ position: "relative", width: 28, height: 28 }}>
                      <div style={{ position: "absolute", inset: -4, borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(242,180,60,0.12) 0%, transparent 68%)",
                        filter: "blur(3px)" }} />
                      <div style={{ width: 28, height: 28, borderRadius: "50%", position: "relative",
                        background: "radial-gradient(circle at 35% 28%, rgba(242,180,60,0.18) 0%, rgba(8,5,18,0.97) 65%)",
                        border: "0.5px solid rgba(242,180,60,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: "#F2B43C", overflow: "hidden" }}>
                        {selectedPhoto.uploader?.photo_path
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={selectedPhoto.uploader.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : `${selectedPhoto.uploader?.first_name?.[0] ?? ""}${selectedPhoto.uploader?.last_name?.[0] ?? ""}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(242,180,60,0.38)", letterSpacing: "0.03em" }}>
                      {selectedPhoto.uploader?.first_name} ·{" "}
                      {new Date(selectedPhoto.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {selectedPhoto.uploader_user_id === userId && (
                    <button onClick={() => deletePhoto(selectedPhoto)}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        color: "rgba(220,60,80,0.40)", padding: 6, lineHeight: 0 }}>
                      <Trash2 size={15} />
                    </button>
                  )}
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
