"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Camera, Upload, X, Trash2, ZoomIn, Tag, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyMember, RELATION_LABELS, RelationType } from "@/lib/types";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface PhotoTag {
  id: string;
  member_id: string | null;
  profile_id: string | null;
  member_name: string;
}

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
  uploader?: { first_name: string; last_name: string; avatar_url?: string };
  tags?: PhotoTag[];
}

export default function PhotosPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos]               = useState<Photo[]>([]);
  const [members, setMembers]             = useState<FamilyMember[]>([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [userId, setUserId]               = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [caption, setCaption]             = useState("");
  const [pendingFile, setPendingFile]     = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingTags, setPendingTags]     = useState<FamilyMember[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [filterMember, setFilterMember]   = useState<string | null>(null); // member_name filter

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    const { data: mem } = await supabase
      .from("family_members")
      .select("*")
      .eq("added_by", user.id)
      .order("first_name");
    setMembers(mem || []);
    await loadPhotos();
  };

  const loadPhotos = async () => {
    const { data } = await supabase
      .from("family_photos")
      .select("*, uploader:profiles!uploaded_by(first_name, last_name, avatar_url)")
      .order("created_at", { ascending: false });

    // Load tags for all photos
    const photos = data || [];
    if (photos.length > 0) {
      const { data: allTags } = await supabase
        .from("photo_tags")
        .select("*")
        .in("photo_id", photos.map((p: any) => p.id));
      const tagsByPhoto: Record<string, PhotoTag[]> = {};
      (allTags || []).forEach((t: any) => {
        if (!tagsByPhoto[t.photo_id]) tagsByPhoto[t.photo_id] = [];
        tagsByPhoto[t.photo_id].push(t);
      });
      setPhotos(photos.map((p: any) => ({ ...p, tags: tagsByPhoto[p.id] || [] })));
    } else {
      setPhotos([]);
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

  const toggleTag = (member: FamilyMember) => {
    setPendingTags(prev =>
      prev.find(m => m.id === member.id)
        ? prev.filter(m => m.id !== member.id)
        : [...prev, member]
    );
  };

  const uploadPhoto = async () => {
    if (!pendingFile || !userId) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("family-photos").upload(path, pendingFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("family-photos").getPublicUrl(path);
      const { data: photo, error: dbError } = await supabase
        .from("family_photos")
        .insert({ uploaded_by: userId, url: urlData.publicUrl, storage_path: path, caption: caption.trim() || null })
        .select("id").single();
      if (dbError || !photo) throw dbError;

      // Insert tags
      if (pendingTags.length > 0) {
        await supabase.from("photo_tags").insert(
          pendingTags.map(m => ({
            photo_id: photo.id,
            member_id: m.id,
            profile_id: m.profile_id || null,
            member_name: `${m.first_name} ${m.last_name || ""}`.trim(),
            tagged_by: userId,
          }))
        );
      }

      toast.success("¡Foto publicada!");
      fetch("/api/notify/new-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "photo", caption: caption.trim() || null }),
      }).catch(() => {});
      setPendingFile(null); setPendingPreview(null);
      setCaption(""); setPendingTags([]); setShowTagPicker(false);
      await loadPhotos();
    } catch {
      toast.error("Error al subir la foto");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    await supabase.storage.from("family-photos").remove([photo.storage_path]);
    await supabase.from("family_photos").delete().eq("id", photo.id);
    setSelectedPhoto(null);
    toast.success("Foto eliminada");
    await loadPhotos();
  };

  const addTagToSelected = async (member: FamilyMember) => {
    if (!selectedPhoto || !userId) return;
    const already = selectedPhoto.tags?.find(t => t.member_id === member.id);
    if (already) {
      await supabase.from("photo_tags").delete().eq("id", already.id);
    } else {
      await supabase.from("photo_tags").insert({
        photo_id: selectedPhoto.id,
        member_id: member.id,
        profile_id: member.profile_id || null,
        member_name: `${member.first_name} ${member.last_name || ""}`.trim(),
        tagged_by: userId,
      });
    }
    await loadPhotos();
    // Refresh selected
    const refreshed = (await supabase.from("family_photos")
      .select("*, uploader:profiles!uploaded_by(first_name, last_name, avatar_url)")
      .eq("id", selectedPhoto.id).single()).data;
    const { data: tags } = await supabase.from("photo_tags").select("*").eq("photo_id", selectedPhoto.id);
    if (refreshed) setSelectedPhoto({ ...refreshed, tags: tags || [] });
  };

  // Unique tagged people for filter bar
  const allTaggedPeople = Array.from(
    new Map(photos.flatMap(p => p.tags || []).map(t => [t.member_name, t])).values()
  );

  const visiblePhotos = filterMember
    ? photos.filter(p => p.tags?.some(t => t.member_name === filterMember))
    : photos;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
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

        {/* Upload panel */}
        {pendingPreview && (
          <div className="card space-y-3">
            <div className="flex items-start gap-4">
              <img src={pendingPreview} alt="Preview" className="w-28 h-28 object-cover rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <textarea className="input-field resize-none text-sm w-full" rows={2}
                  placeholder="Pie de foto... (opcional)" value={caption} onChange={e => setCaption(e.target.value)} />
                {/* Tag button */}
                <button onClick={() => setShowTagPicker(v => !v)}
                  className="flex items-center gap-1.5 text-ceiba-700 text-sm font-medium border border-ceiba-200 rounded-xl px-3 py-1.5 bg-ceiba-50 w-full justify-center">
                  <Tag size={14} />
                  {pendingTags.length > 0
                    ? `${pendingTags.length} etiquetado${pendingTags.length !== 1 ? "s" : ""}`
                    : "Etiquetar familiares"}
                </button>
              </div>
            </div>

            {/* Tag chips */}
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingTags.map(m => (
                  <span key={m.id} onClick={() => toggleTag(m)}
                    className="flex items-center gap-1 bg-ceiba-100 text-ceiba-800 text-xs font-semibold rounded-full px-3 py-1 cursor-pointer">
                    {m.first_name} <X size={10} />
                  </span>
                ))}
              </div>
            )}

            {/* Tag picker */}
            {showTagPicker && members.length > 0 && (
              <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                {members.map(m => {
                  const tagged = !!pendingTags.find(pt => pt.id === m.id);
                  return (
                    <button key={m.id} onClick={() => toggleTag(m)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tagged ? "bg-ceiba-50" : "hover:bg-gray-50"}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${tagged ? "bg-ceiba-200 text-ceiba-800" : "bg-gray-100 text-gray-600"}`}>
                        {m.first_name[0]}{m.last_name?.[0] || ""}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-400">{RELATION_LABELS[m.relation_type as RelationType]}</p>
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
                className="btn-secondary text-sm px-4">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Filter bar by tagged person */}
        {allTaggedPeople.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <button onClick={() => setFilterMember(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                !filterMember ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-white text-gray-600 border-gray-200"}`}>
              Todas
            </button>
            {allTaggedPeople.map(t => (
              <button key={t.member_name} onClick={() => setFilterMember(t.member_name === filterMember ? null : t.member_name)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  filterMember === t.member_name ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-white text-gray-600 border-gray-200"}`}>
                {t.member_name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* Empty */}
        {visiblePhotos.length === 0 && !pendingPreview && (
          <div className="card text-center py-14">
            <Camera size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-700 mb-2">
              {filterMember ? `Sin fotos de ${filterMember.split(" ")[0]}` : "Sin fotos todavía"}
            </h3>
            {!filterMember && (
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary mt-4">
                <Camera size={16} className="inline mr-2" /> Subir primera foto
              </button>
            )}
          </div>
        )}

        {/* Photo grid */}
        {visiblePhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {visiblePhotos.map(photo => (
              <button key={photo.id} onClick={() => setSelectedPhoto(photo)}
                className="aspect-square rounded-xl overflow-hidden bg-gray-200 relative group">
                <img src={photo.url} alt={photo.caption || "Foto familiar"} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <ZoomIn size={16} className="text-white ml-auto" />
                </div>
                {/* Tag count badge */}
                {(photo.tags?.length ?? 0) > 0 && (
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                    <Tag size={8} /> {photo.tags!.length}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Photo modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden w-full sm:max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={selectedPhoto.url} alt={selectedPhoto.caption || ""}
                className="w-full object-cover max-h-[55vh]" />
              <button onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {selectedPhoto.caption && (
                <p className="text-gray-800 font-medium text-sm">{selectedPhoto.caption}</p>
              )}

              {/* Tags */}
              {(selectedPhoto.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPhoto.tags!.map(t => (
                    <span key={t.id} className="bg-ceiba-100 text-ceiba-800 text-xs font-semibold rounded-full px-2.5 py-1">
                      {t.member_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Add tag inline */}
              {selectedPhoto.uploaded_by === userId && members.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-xs text-ceiba-600 font-medium cursor-pointer list-none">
                    <Tag size={12} /> Etiquetar a alguien
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {members.slice(0, 12).map(m => {
                      const tagged = selectedPhoto.tags?.some(t => t.member_id === m.id);
                      return (
                        <button key={m.id} onClick={() => addTagToSelected(m)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition-colors ${
                            tagged ? "bg-ceiba-700 text-white border-ceiba-700" : "bg-white text-gray-600 border-gray-200 hover:border-ceiba-400"}`}>
                          {m.first_name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-ceiba-700 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
                    {selectedPhoto.uploader?.avatar_url
                      ? <img src={selectedPhoto.uploader.avatar_url} className="w-full h-full object-cover" alt="" />
                      : `${selectedPhoto.uploader?.first_name?.[0]}${selectedPhoto.uploader?.last_name?.[0]}`}
                  </div>
                  <span className="text-xs text-gray-500">
                    {selectedPhoto.uploader?.first_name} · {new Date(selectedPhoto.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {selectedPhoto.uploaded_by === userId && (
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
