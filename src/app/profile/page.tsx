"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Camera, Link as LinkIcon, Save, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    social_link: "",
    city: "",
    country: "",
    birth_date: "",
    phone: "",
  });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        bio: data.bio || "",
        social_link: data.social_link || "",
        city: data.city || "",
        country: data.country || "",
        birth_date: (data as any).birth_date || "",
        phone: data.phone || "",
      });
      if (data.avatar_url) setPhotoPreview(data.avatar_url);
    }
    setLoading(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("La foto debe pesar menos de 5MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.first_name.trim()) { toast.error("El nombre es obligatorio"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);

    let avatar_url = profile?.avatar_url;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = urlData.publicUrl;
      } else {
        toast.error("Error al subir la foto");
      }
    }

    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      bio: form.bio.trim() || null,
      social_link: form.social_link.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      birth_date: form.birth_date || null,
      phone: form.phone.trim() || null,
      ...(avatar_url ? { avatar_url } : {}),
    }).eq("id", user.id);

    if (error) { setSaving(false); toast.error("Error al guardar"); return; }

    // Sincronizar campos solapados en persons (nuevo esquema)
    await supabase.from("persons").update({
      first_names: form.first_name.trim(),
      last_names: form.last_name.trim() || null,
      bio: form.bio.trim() || null,
      birth_date: form.birth_date || null,
      birth_city: form.city.trim() || null,
      ...(avatar_url ? { profile_photo_url: avatar_url } : {}),
    }).eq("linked_user_id", user.id);
    // (si no existe fila en persons aún, el update no falla — simplemente afecta 0 filas)

    setSaving(false);
    toast.success("¡Perfil actualizado!");
    router.push("/tree");
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <TreePine size={20} className="text-ceiba-300" /> Mi perfil
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Foto */}
        <div className="card flex flex-col items-center py-6 gap-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full bg-ceiba-700 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden relative"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
            ) : (
              <User size={36} className="text-white" />
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-cream-50 rounded-full flex items-center justify-center shadow-md">
              <Camera size={14} className="text-ceiba-700" />
            </div>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="text-sm text-ceiba-700 font-semibold hover:underline">
            {photoPreview ? "Cambiar foto" : "Agregar foto de perfil"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Datos */}
        <div className="card space-y-4">
          <h3 className="font-bold text-ceiba-800">Información personal</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input type="text" className="input-field"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Apellido</label>
              <input type="text" className="input-field"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ceiba-700 mb-1">Red social</label>
            <div className="relative">
              <LinkIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ceiba-400" />
              <input type="url" className="input-field pl-9"
                placeholder="https://instagram.com/tuperfil"
                value={form.social_link}
                onChange={e => setForm(f => ({ ...f, social_link: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Ciudad</label>
              <input type="text" className="input-field" placeholder="Bogotá"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">País</label>
              <input type="text" className="input-field" placeholder="Colombia"
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Fecha de nacimiento</label>
              <input type="date" className="input-field"
                value={form.birth_date}
                onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Teléfono</label>
              <input type="tel" className="input-field" placeholder="+57 300..."
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ceiba-700 mb-1">Sobre mí</label>
            <textarea className="input-field resize-none" rows={3}
              placeholder="Cuéntale algo a tu familia..."
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            />
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </main>
  );
}
