"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Camera, Save, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface ProfileForm {
  display_name: string;
  locale: string;
  timezone: string;
}

interface PersonForm {
  first_name: string;
  middle_name: string;
  first_surname: string;
  second_surname: string;
  birth_date: string;
  birth_city: string;
  birth_country: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [form, setForm] = useState<ProfileForm>({ display_name: "", locale: "", timezone: "" });

  const [personId, setPersonId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [noClaim, setNoClaim] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, avatar_path, locale, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      toast.error("Error al cargar el perfil: " + profileError.message);
    } else if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        locale: profile.locale ?? "",
        timezone: profile.timezone ?? "",
      });
      if (profile.avatar_path) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_path);
        setAvatarPreview(urlData.publicUrl);
      }
    }

    const { data: claim, error: claimError } = await supabase
      .from("person_claims")
      .select("person_id")
      .eq("user_id", user.id)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .maybeSingle();

    if (claimError) {
      toast.error("Error al verificar tu identidad reclamada: " + claimError.message);
    } else if (!claim) {
      setNoClaim(true);
    } else {
      setPersonId(claim.person_id);
      const { data: person, error: personError } = await supabase
        .from("persons")
        .select("first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country")
        .eq("id", claim.person_id)
        .maybeSingle();

      if (personError) {
        toast.error("Error al cargar tus datos genealógicos: " + personError.message);
      } else if (person) {
        setPersonForm({
          first_name: person.first_name ?? "",
          middle_name: person.middle_name ?? "",
          first_surname: person.first_surname ?? "",
          second_surname: person.second_surname ?? "",
          birth_date: person.birth_date ?? "",
          birth_city: person.birth_city ?? "",
          birth_country: person.birth_country ?? "",
        });
      }
    }

    setLoading(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("La foto debe pesar menos de 5MB"); return; }
    setPhotoFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.display_name.trim()) { toast.error("El nombre para mostrar es obligatorio"); return; }
    if (!userId) return;
    setSaving(true);

    let nextAvatarUrl: string | null = null;
    if (photoFile) {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await fetch("/api/profile/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaving(false);
        toast.error(data?.error ?? "Error al subir la foto");
        return;
      }
      nextAvatarUrl = data.avatarUrl;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim(),
        locale: form.locale.trim() || null,
        timezone: form.timezone.trim() || null,
      })
      .eq("user_id", userId);

    if (profileError) {
      setSaving(false);
      toast.error("Error al guardar el perfil: " + profileError.message);
      return;
    }

    if (personId && personForm) {
      if (!personForm.first_name.trim() || !personForm.first_surname.trim()) {
        setSaving(false);
        toast.error("Nombre y primer apellido son obligatorios");
        return;
      }
      const { error: personRpcError } = await supabase.rpc("update_person", {
        p_person_id: personId,
        p_first_name: personForm.first_name.trim(),
        p_middle_name: personForm.middle_name.trim() || null,
        p_first_surname: personForm.first_surname.trim(),
        p_second_surname: personForm.second_surname.trim() || null,
        p_birth_date: personForm.birth_date || null,
        p_birth_city: personForm.birth_city.trim() || null,
        p_birth_country: personForm.birth_country.trim() || null,
      });

      if (personRpcError) {
        setSaving(false);
        toast.error("Error al guardar tus datos genealógicos: " + personRpcError.message);
        return;
      }
    }

    setPhotoFile(null);
    setSaving(false);
    if (nextAvatarUrl) setAvatarPreview(nextAvatarUrl);
    toast.success("¡Perfil actualizado!");
    router.push("/settings");
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/settings" className="text-ceiba-300 hover:text-white transition-colors">
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
            {avatarPreview ? (
              <img src={avatarPreview} alt="Foto" className="w-full h-full object-cover" />
            ) : (
              <User size={36} className="text-white" />
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-cream-50 rounded-full flex items-center justify-center shadow-md">
              <Camera size={14} className="text-ceiba-700" />
            </div>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="text-sm text-ceiba-700 font-semibold hover:underline">
            {avatarPreview ? "Cambiar foto" : "Agregar foto de perfil"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Cuenta (profiles) */}
        <div className="card space-y-4">
          <h3 className="font-bold text-ceiba-800">Cuenta</h3>
          <div>
            <label className="block text-sm font-medium text-ceiba-700 mb-1">Nombre para mostrar <span className="text-red-500">*</span></label>
            <input type="text" className="input-field"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Idioma</label>
              <input type="text" className="input-field" placeholder="es"
                value={form.locale}
                onChange={e => setForm(f => ({ ...f, locale: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Zona horaria</label>
              <input type="text" className="input-field" placeholder="America/Bogota"
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Datos genealógicos (persons, vía person_claims) */}
        {noClaim && (
          <div className="card">
            <h3 className="font-bold text-ceiba-800 mb-1">Datos genealógicos</h3>
            <p className="text-sm text-ceiba-500">
              Todavía no tienes una identidad reclamada en el árbol familiar, así que no hay datos genealógicos que editar aquí.
            </p>
          </div>
        )}

        {personForm && (
          <div className="card space-y-4">
            <h3 className="font-bold text-ceiba-800">Datos genealógicos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input type="text" className="input-field"
                  value={personForm.first_name}
                  onChange={e => setPersonForm(f => f && ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">Segundo nombre</label>
                <input type="text" className="input-field"
                  value={personForm.middle_name}
                  onChange={e => setPersonForm(f => f && ({ ...f, middle_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">Primer apellido <span className="text-red-500">*</span></label>
                <input type="text" className="input-field"
                  value={personForm.first_surname}
                  onChange={e => setPersonForm(f => f && ({ ...f, first_surname: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">Segundo apellido</label>
                <input type="text" className="input-field"
                  value={personForm.second_surname}
                  onChange={e => setPersonForm(f => f && ({ ...f, second_surname: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ceiba-700 mb-1">Fecha de nacimiento</label>
              <input type="date" className="input-field"
                value={personForm.birth_date}
                onChange={e => setPersonForm(f => f && ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">Ciudad de nacimiento</label>
                <input type="text" className="input-field"
                  value={personForm.birth_city}
                  onChange={e => setPersonForm(f => f && ({ ...f, birth_city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ceiba-700 mb-1">País de nacimiento</label>
                <input type="text" className="input-field"
                  value={personForm.birth_country}
                  onChange={e => setPersonForm(f => f && ({ ...f, birth_country: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={16} />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </main>
  );
}
