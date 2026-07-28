"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Camera, Upload, X, Trash2, ZoomIn, Tag, UserCheck, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface RosterMember {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

interface PhotoTag {
  person_id: string;
  first_name: string;
  last_name: string;
}

interface Photo {
  id: string;
  uploader_user_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  created_at: string;
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
    if (rosterRes.ok) {
      const { members } = await rosterRes.json();
      setMembers(members || []);
    }
    await loadPhotos();
  };

  const loadPhotos = async () => {
    const res = await fetch("/api/photos");
    if (res.ok) {
      setLoadError(false);
      const { photos } = await res.json();
      setPhotos(photos || []);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("La foto debe pesar menos de 10MB"); return; }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setCaption("");
    setPendingTags([]);
  };

  const toggleTag = (member: RosterMember) => {
    setPendingTags(prev =>
      prev.find(m => m.person_id === member.person_id)
        ? prev.filter(m => m.person_id !== member.person_id)
        : [...prev, member]
    );
  };

  const uploadPhoto = async () => {
    if (!pendingFile || !userId) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("family-photos").upload(path, pendingFile);
      if (uploadError) throw uploadError;

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, caption: caption.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      const photoId = body.photo.id;
      for (const m of pendingTags) {
        await fetch("/api/photos/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId, personId: m.person_id }),
        });
      }

      toast.success("¡Foto publicada!");
      setPendingFile(null); setPendingPreview(null);
      setCaption(""); setPendingTags([]); setShowTagPicker(false);
      await loadPhotos();
    } catch (e: any) {
      toast.error("Error al subir la foto" + (e?.message ? `: ${e.message}` : ""));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    const res = await fetch(`/api/photos?id=${photo.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    setSelectedPhoto(null);
    toast.success("Foto eliminada");
    await loadPhotos();
  };

  const addTagToSelected = async (member: RosterMember) => {
    if (!selectedPhoto) return;
    const already = selectedPhoto.tags?.find(t => t.person_id === member.person_id);
    const method = already ? "DELETE" : "POST";
    await fetch("/api/photos/tags", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: selectedPhoto.id, personId: member.person_id }),
    });
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
    new Map(photos.flatMap(p => p.tags || []).map(t => [t.person_id, t])).values()
  );

  const visiblePhotos = filterMember
    ? photos.filter(p => p.tags?.some(t => t.person_id === filterMember))
    : photos;

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg sticky top-0 z-10">
        <Link href="/tree" className="text-ceiba-300 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold flex-1">
          <TreePine size={20} className="text-ceiba-300" /> Fotos familiares
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
          <Camera size={15} /> Subir
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-4">
        {loadError && !pendingPreview && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">No se pudieron cargar las fotos</p>
              <button onClick={loadPhotos} className="text-xs text-red-500 underline mt-0.5">Reintentar</button>
            </div>
          </div>
        )}

        {pendingPreview && (
          <div className="card space-y-3">
            <div className="flex items-start gap-4">
              <img src={pendingPreview} alt="Preview" className="w-28 h-28 object-cover rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <textarea className="input-field resize-none text-sm w-full" rows={2}
                  placeholder="Pie de foto... (opcional)" value={caption} onChange={e => setCaption(e.target.value)} />
                <button onClick={() => setShowTagPicker(v => !v)}
                  className="flex items-center gap-1.5 text-ceiba-700 text-sm font-medium border border-ceiba-200 rounded-xl px-3 py-1.5 bg-ceiba-50 w-full justify-center">
                  <Tag size={14} />
                  {pendingTags.length > 0 ? `${pendingTags.length} etiquetado${pendingTags.length !== 1 ? "s" : ""}` : "Etiquetar familiares"}
                </button>
              </div>
            </div>

            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingTags.map(m => (
                  <span key={m.person_id} onClick={() => toggleTag(m)}
                    className="flex items-center gap-1 bg-ceiba-100 text-ceiba-800 text-xs font-semibold rounded-full px-3 py-1 cursor-pointer">
                    {m.first_name} <X size={10} />
                  </span>
                ))}
              </div>
            )}

            {showTagPicker && members.length > 0 && (
              <div className="border border-cream-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                {members.map(m => {
                  const tagged = !!pendingTags.find(pt => pt.person_id === m.person_id);
                  return (
                    <button key={m.person_id} onClick={() => toggleTag(m)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tagged ? "bg-ceiba-50" : "hover:bg-cream-100"}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${tagged ? "bg-ceiba-200 text-ceiba-800" : "bg-cream-200 text-ceiba-600"}`}>
                        {m.first_name[0]}{m.last_name?.[0] || ""}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-ceiba-900">{m.first_name} {m.last_name}</p>
                      </div>
                      {tagged && <UserCheck size={15} className="text-ceiba-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={uploadPhoto} disabled={uploading} className="btn-primary text-sm flex items-center gap-1.5 flex-1 justify-center">
                <Upload size={14} /> {uploading ? "Subiendo..." : "Publicar foto"}
              </button>
              <button onClick={() => { setPendingFile(null); setPendingPreview(null); setPendingTags([]); setShowTagPicker(false); }}
                className="btn-secondary text-sm px-4">Cancelar</button>
            </div>
          </div>
        )}

        {allTaggedPeople.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <button onClick={() => setFilterMember(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${!filterMember ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-cream-50 text-ceiba-600 border-cream-300"}`}>
              Todas
            </button>
            {allTaggedPeople.map(t => (
              <button key={t.person_id} onClick={() => setFilterMember(t.person_id === filterMember ? null : t.person_id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${filterMember === t.person_id ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-cream-50 text-ceiba-600 border-cream-300"}`}>
                {t.first_name}
              </button>
            ))}
          </div>
        )}

        {visiblePhotos.length === 0 && !pendingPreview && (
          <div className="card text-center py-14">
            <Camera size={48} className="text-ceiba-200 mx-auto mb-4" />
            <h3 className="font-bold text-ceiba-700 mb-2">
              {filterMember ? "Sin fotos de este familiar" : "Sin fotos todavía"}
            </h3>
            {!filterMember && (
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary mt-4">
                <Camera size={16} className="inline mr-2" /> Subir primera foto
              </button>
            )}
          </div>
        )}

        {visiblePhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {visiblePhotos.map(photo => (
              <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                className="aspect-square rounded-xl overflow-hidden bg-cream-300 relative group">
                <img src={photo.url} alt={photo.caption || "Foto familiar"} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <ZoomIn size={16} className="text-white ml-auto" />
                </div>
                {(photo.tags?.length ?? 0) > 0 && (
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                    <Tag size={8} /> {photo.tags.length}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedPhoto(null)}>
          <div className="bg-cream-50 rounded-t-3xl sm:rounded-3xl overflow-hidden w-full sm:max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={selectedPhoto.url} alt={selectedPhoto.caption || ""} className="w-full object-cover max-h-[55vh]" />
              <button onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {selectedPhoto.caption && <p className="text-ceiba-800 font-medium text-sm">{selectedPhoto.caption}</p>}

              {(selectedPhoto.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPhoto.tags.map(t => (
                    <span key={t.person_id} className="bg-ceiba-100 text-ceiba-800 text-xs font-semibold rounded-full px-2.5 py-1">
                      {t.first_name} {t.last_name}
                    </span>
                  ))}
                </div>
              )}

              {selectedPhoto.uploader_user_id === userId && members.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-xs text-ceiba-600 font-medium cursor-pointer list-none">
                    <Tag size={12} /> Etiquetar a alguien
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {members.slice(0, 12).map(m => {
                      const tagged = selectedPhoto.tags?.some(t => t.person_id === m.person_id);
                      return (
                        <button key={m.person_id} onClick={() => addTagToSelected(m)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition-colors ${tagged ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-cream-50 text-ceiba-600 border-cream-300 hover:border-ceiba-400"}`}>
                          {m.first_name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-ceiba-700 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
                    {selectedPhoto.uploader?.photo_path
                      ? <img src={selectedPhoto.uploader.photo_path} className="w-full h-full object-cover" alt="" />
                      : `${selectedPhoto.uploader?.first_name?.[0] ?? ""}${selectedPhoto.uploader?.last_name?.[0] ?? ""}`}
                  </div>
                  <span className="text-xs text-ceiba-500">
                    {selectedPhoto.uploader?.first_name} · {new Date(selectedPhoto.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {selectedPhoto.uploader_user_id === userId && (
                  <button onClick={() => deletePhoto(selectedPhoto)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
