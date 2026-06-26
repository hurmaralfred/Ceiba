"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ChevronLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: profile.first_name,
      last_name: profile.last_name,
      bio: profile.bio,
      birth_year: profile.birth_year,
      city: profile.city,
      country: profile.country,
      phone: profile.phone,
    }).eq("id", profile.id!);
    setSaving(false);
    if (error) toast.error("Error al guardar"); else toast.success("Perfil actualizado");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white"><ChevronLeft size={22} /></Link>
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-300" /> Mi perfil
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Avatar */}
        <div className="card mb-6 flex flex-col items-center py-8">
          <div className="w-24 h-24 rounded-3xl bg-ceiba-700 text-white flex items-center justify-center text-4xl font-bold mb-3">
            {profile.first_name?.[0]}{profile.last_name?.[0]}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h2>
          {profile.city && <p className="text-gray-400 text-sm mt-1">{profile.city}, {profile.country}</p>}
        </div>

        <div className="card space-y-4">
          <h3 className="font-bold text-gray-800 mb-2">Información personal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" className="input-field"
                value={profile.first_name || ""}
                onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input type="text" className="input-field"
                value={profile.last_name || ""}
                onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" className="input-field" placeholder="+52 555 555 5555"
              value={profile.phone || ""}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" className="input-field"
                value={profile.city || ""}
                onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input type="text" className="input-field"
                value={profile.country || ""}
                onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año de nacimiento</label>
            <input type="number" className="input-field" min="1900" max="2020"
              value={profile.birth_year || ""}
              onChange={e => setProfile(p => ({ ...p, birth_year: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea className="input-field resize-none h-24"
              value={profile.bio || ""}
              onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              placeholder="Cuéntales algo a tus familiares..."
            />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={18} /> {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
