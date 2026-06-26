"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Camera, Upload, X, Trash2, ZoomIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
  uploader?: { first_name: string; last_name: string; avatar_url?: string };
}

export default function PhotosPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    await loadPhotos();
  };

  const loadPhotos = async () => {
    const { data } = await supabase
      .from("family_photos")
      .select("*, uploader:profiles!uploaded_by(first_name, last_name, avatar_url)")
      .order("created_at", { ascending: false });
    setPhotos(data || []);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("La foto debe pesar menos de 10MB"); return; }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setCaption("");
  };

  const uploadPhoto = async () => {
    if (!pendingFile || !userId) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("family-photos")
        .upload(path, pendingFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("family-photos").getPublicUrl(path);
      const { error: dbError } = await supabase.from("family_photos").insert({
        uploaded_by: userId,
        url: urlData.publicUrl,
        storage_path: path,
        caption: caption.trim() || null,
      });
      if (dbError) throw dbError;

      toast.success("¡Foto publicada!");
      setPendingFile(null);
      setPendingPreview(null);
      setCaption("");
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
          <TreePine size={20} className="text-ceiba-300" /> Fotos familiares
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Camera size={15} /> Subir
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Upload preview */}
        {pendingPreview && (
          <div className="card">
            <div className="flex items-start gap-4">
              <img src={pendingPreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <textarea
                  className="input-field resize-none text-sm w-full"
                  rows={2}
                  placeholder="Agrega un pie de foto... (opcional)"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={uploadPhoto} disabled={uploading} className="btn-primary text-sm flex items-center gap-1.5">
                    <Upload size={14} /> {uploading ? "Subiendo..." : "Publicar foto"}
                  </button>
                  <button onClick={() => { setPendingFile(null); setPendingPreview(null); }} className="btn-secondary text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {photos.length === 0 && !pendingPreview && (
          <div className="card text-center py-14">
            <Camera size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-700 mb-2">Sin fotos todavía</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              Sube fotos de reuniones, cumpleaños o momentos especiales con tu familia.
            </p>
            <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
              <Camera size={16} className="inline mr-2" /> Subir primera foto
            </button>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="aspect-square rounded-xl overflow-hidden bg-gray-200 relative group"
              >
                <img src={photo.url} alt={photo.caption || "Foto familiar"} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={20} className="text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Photo modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto.url} alt={selectedPhoto.caption || ""} className="w-full object-cover max-h-[60vh]" />
            <div className="p-4">
              {selectedPhoto.caption && (
                <p className="text-gray-800 font-medium mb-2">{selectedPhoto.caption}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-ceiba-700 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {selectedPhoto.uploader?.avatar_url
                      ? <img src={selectedPhoto.uploader.avatar_url} className="w-full h-full object-cover" />
                      : `${selectedPhoto.uploader?.first_name?.[0]}${selectedPhoto.uploader?.last_name?.[0]}`
                    }
                  </div>
                  <span className="text-sm text-gray-600">
                    {selectedPhoto.uploader?.first_name} {selectedPhoto.uploader?.last_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(selectedPhoto.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  {selectedPhoto.uploaded_by === userId && (
                    <button onClick={() => deletePhoto(selectedPhoto)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedPhoto(null)} className="absolute top-4 right-4 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
