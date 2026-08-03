"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X, Trash2, ZoomIn, Tag, UserCheck, AlertCircle, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, s3dInput, C } from "@/components/ui/cosmic";

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

export default function PhotosPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<RosterMember[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [filterMember, setFilterMember] = useState<string | null>(null);

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
      for (const m of pendingTags) {
        await fetch("/api/photos/tags", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId, personId: m.person_id }) });
      }
      toast.success("¡Foto publicada!");
      setPendingFile(null); setPendingPreview(null);
      setCaption(""); setPendingTags([]); setShowTagPicker(false);
      await loadPhotos();
    } catch (e: any) {
      toast.error("Error al subir la foto" + (e?.message ? `: ${e.message}` : ""));
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

  const allTaggedPeople = Array.from(
    new Map(photos.flatMap(p => p.tags || []).map(t => [t.person_id, t])).values());
  const visiblePhotos = filterMember ? photos.filter(p => p.tags?.some(t => t.person_id === filterMember)) : photos;

  if (loading) return <CosmicSpinner />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <CosmicHeader
        title="Álbum familiar"
        backHref="/home"
        right={
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#0c0a18", border: "none",
              borderTop: "1px solid rgba(220,140,40,0.35)", borderBottom: "2px solid #000",
              boxShadow: "0 3px 0 #02010a", borderRadius: 9, padding: "6px 10px",
              color: "#dc9030", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={13} /> Subir
          </button>
        }
      />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" style={{ display: "none" }} onChange={handleFileSelect} />

      <div style={{ padding: "14px 14px" }}>
        {loadError && !pendingPreview && (
          <div style={{ display: "flex", alignItems: "center", gap: 10,
            background: "#160208", borderRadius: 14, padding: "12px 14px",
            border: "1px solid rgba(220,60,80,0.2)", marginBottom: 12 }}>
            <AlertCircle size={16} style={{ color: "rgba(220,60,80,0.7)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>No se pudieron cargar las fotos</p>
              <button onClick={loadPhotos} style={{ fontSize: 11, color: "rgba(220,60,80,0.5)",
                background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reintentar</button>
            </div>
          </div>
        )}

        {/* Pending upload */}
        {pendingPreview && (
          <div style={{ ...s3dCard("#0c0a18","220,140,40","#060300"), padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPreview} alt="Preview"
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, flexShrink: 0,
                  border: "1px solid rgba(220,140,40,0.2)" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea style={{ ...s3dInput(), resize: "none", fontSize: 12 }} rows={2}
                  placeholder="Pie de foto... (opcional)" value={caption} onChange={e => setCaption(e.target.value)} />
                <button onClick={() => setShowTagPicker(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0818",
                    borderTop: "1px solid rgba(220,140,40,0.28)", borderBottom: "2px solid #000",
                    boxShadow: "0 3px 0 #02010a", borderRadius: 9, padding: "8px 12px",
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
                      border: "1px solid rgba(220,140,40,0.3)", color: "#dc9030",
                      fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {m.first_name} <X size={9} />
                  </button>
                ))}
              </div>
            )}

            {showTagPicker && members.length > 0 && (
              <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", maxHeight: 160, overflowY: "auto",
                border: "1px solid rgba(220,140,40,0.15)" }}>
                {members.map(m => {
                  const tagged = !!pendingTags.find(pt => pt.person_id === m.person_id);
                  return (
                    <button key={m.person_id} onClick={() => toggleTag(m)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", textAlign: "left", cursor: "pointer", border: "none",
                        background: tagged ? "rgba(220,140,40,0.1)" : "#0c0a18",
                        borderBottom: "0.5px solid rgba(220,140,40,0.08)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#0a0818",
                        border: `1px solid rgba(220,140,40,${tagged ? 0.4 : 0.15})`,
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

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={uploadPhoto} disabled={uploading}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: "#c9a820", border: "none",
                  borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                  boxShadow: "0 6px 0 #4a3c00", borderRadius: 12,
                  color: "#030208", fontWeight: 700, fontSize: 13, padding: "11px 0", cursor: "pointer" }}>
                <Upload size={13} /> {uploading ? "Subiendo..." : "Publicar"}
              </button>
              <button onClick={() => { setPendingFile(null); setPendingPreview(null); setPendingTags([]); setShowTagPicker(false); }}
                style={{ padding: "11px 16px", borderRadius: 12, background: "#0c0a1a",
                  border: "1px solid rgba(212,175,55,0.2)", color: "rgba(212,175,55,0.5)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Filtros por persona */}
        {allTaggedPeople.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
            <button onClick={() => setFilterMember(null)}
              style={{ flexShrink: 0, borderRadius: 100, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                background: !filterMember ? "#c9a820" : "transparent",
                border: `1px solid ${!filterMember ? "#c9a820" : "rgba(212,175,55,0.25)"}`,
                color: !filterMember ? "#030208" : "rgba(212,175,55,0.5)", cursor: "pointer" }}>
              Todas
            </button>
            {allTaggedPeople.map(t => (
              <button key={t.person_id} onClick={() => setFilterMember(t.person_id === filterMember ? null : t.person_id)}
                style={{ flexShrink: 0, borderRadius: 100, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                  background: filterMember === t.person_id ? "#c9a820" : "transparent",
                  border: `1px solid ${filterMember === t.person_id ? "#c9a820" : "rgba(212,175,55,0.25)"}`,
                  color: filterMember === t.person_id ? "#030208" : "rgba(212,175,55,0.5)", cursor: "pointer" }}>
                {t.first_name}
              </button>
            ))}
          </div>
        )}

        {/* Cuadrícula */}
        {visiblePhotos.length === 0 && !pendingPreview && (
          <div style={{ ...s3dCard("#0c0a18","220,140,40","#060300"), padding: "50px 20px", textAlign: "center" }}>
            <Camera size={42} style={{ color: "rgba(220,140,40,0.2)", margin: "0 auto 14px" }} />
            <h3 style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>
              {filterMember ? "Sin fotos de este familiar" : "Sin fotos todavía"}
            </h3>
            {!filterMember && (
              <button onClick={() => fileInputRef.current?.click()}
                style={{ marginTop: 8, background: "#c9a820", borderRadius: 12, padding: "11px 24px",
                  color: "#030208", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
                  borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600", boxShadow: "0 6px 0 #4a3c00" }}>
                Subir primera foto
              </button>
            )}
          </div>
        )}

        {visiblePhotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
            {visiblePhotos.map(photo => (
              <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                style={{ aspectRatio: "1/1", borderRadius: 10, overflow: "hidden",
                  background: "#0c0a18", position: "relative", cursor: "pointer",
                  border: "1px solid rgba(220,140,40,0.12)" } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption || "Foto familiar"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {(photo.tags?.length ?? 0) > 0 && (
                  <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.65)",
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

      {/* Lightbox */}
      {selectedPhoto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
          backdropFilter: "blur(8px)", zIndex: 50,
          display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setSelectedPhoto(null)}>
          <div style={{ ...s3dCard("#0c0a18","220,140,40","#060300"),
            width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPhoto.url} alt={selectedPhoto.caption || ""}
                style={{ width: "100%", objectFit: "cover", maxHeight: "55vh" }} />
              <button onClick={() => setSelectedPhoto(null)}
                style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32,
                  background: "rgba(0,0,0,0.6)", borderRadius: "50%", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "14px 16px 20px" }}>
              {selectedPhoto.caption && (
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 10 }}>
                  {selectedPhoto.caption}
                </p>
              )}
              {(selectedPhoto.tags?.length ?? 0) > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {selectedPhoto.tags.map(t => (
                    <span key={t.person_id} style={{
                      background: "rgba(220,140,40,0.12)", border: "1px solid rgba(220,140,40,0.28)",
                      color: "#dc9030", fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "3px 10px" }}>
                      {t.first_name} {t.last_name}
                    </span>
                  ))}
                </div>
              )}
              {selectedPhoto.uploader_user_id === userId && members.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, listStyle: "none" }}>
                    <Tag size={11} /> Etiquetar a alguien
                  </summary>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {members.slice(0, 12).map(m => {
                      const tagged = selectedPhoto.tags?.some(t => t.person_id === m.person_id);
                      return (
                        <button key={m.person_id} onClick={() => addTagToSelected(m)}
                          style={{ fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "4px 10px",
                            background: tagged ? "#c9a820" : "transparent",
                            border: `1px solid ${tagged ? "#c9a820" : "rgba(212,175,55,0.25)"}`,
                            color: tagged ? "#030208" : "rgba(212,175,55,0.5)", cursor: "pointer" }}>
                          {m.first_name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0c0a18",
                    border: "1px solid rgba(212,175,55,0.2)", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#d4af37" }}>
                    {selectedPhoto.uploader?.photo_path
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={selectedPhoto.uploader.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : `${selectedPhoto.uploader?.first_name?.[0] ?? ""}${selectedPhoto.uploader?.last_name?.[0] ?? ""}`}
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(212,175,55,0.4)" }}>
                    {selectedPhoto.uploader?.first_name} · {new Date(selectedPhoto.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {selectedPhoto.uploader_user_id === userId && (
                  <button onClick={() => deletePhoto(selectedPhoto)}
                    style={{ background: "none", border: "none", cursor: "pointer",
                      color: "rgba(220,60,80,0.5)", padding: 4 }}>
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
  );
}
