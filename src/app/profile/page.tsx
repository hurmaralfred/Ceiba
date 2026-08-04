"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Save, User, Smile, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, s3dInput, s3dGoldBtn, SectionLabel, C } from "@/components/ui/cosmic";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "rgba(212,175,55,0.5)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
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
  const [initials, setInitials] = useState("?");

  const [form, setForm] = useState<ProfileForm>({ display_name: "", locale: "", timezone: "" });
  const [personId, setPersonId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [noClaim, setNoClaim] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_path, locale, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        locale: profile.locale ?? "",
        timezone: profile.timezone ?? "",
      });
      const parts = (profile.display_name || "").split(" ");
      setInitials((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? ""));
      if (profile.avatar_path) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_path);
        setAvatarPreview(urlData.publicUrl);
      }
    }

    const { data: claim } = await supabase
      .from("person_claims")
      .select("person_id")
      .eq("user_id", user.id)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .maybeSingle();

    if (!claim) {
      setNoClaim(true);
    } else {
      setPersonId(claim.person_id);
      const { data: person } = await supabase
        .from("persons")
        .select("first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country")
        .eq("id", claim.person_id)
        .maybeSingle();

      if (person) {
        setPersonForm({
          first_name: person.first_name ?? "",
          middle_name: person.middle_name ?? "",
          first_surname: person.first_surname ?? "",
          second_surname: person.second_surname ?? "",
          birth_date: person.birth_date ?? "",
          birth_city: person.birth_city ?? "",
          birth_country: person.birth_country ?? "",
        });
        if (!profile?.display_name) {
          const init = (person.first_name?.[0] ?? "") + (person.first_surname?.[0] ?? "");
          setInitials(init);
        }
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

    if (photoFile) {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const res = await fetch("/api/profile/photo", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaving(false);
        toast.error(body.error || "Error al subir la foto");
        return;
      }
      const { avatarUrl } = await res.json();
      if (avatarUrl) setAvatarPreview(avatarUrl);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: form.display_name.trim(), locale: form.locale.trim() || null, timezone: form.timezone.trim() || null })
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
        toast.error("Error al guardar datos genealógicos: " + personRpcError.message);
        return;
      }
    }

    setPhotoFile(null);
    setSaving(false);
    toast.success("¡Perfil actualizado!");
    router.push("/settings");
  };

  if (loading) return <CosmicSpinner />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <style>{`
        @keyframes ring-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ring-breathe { 0%,100%{opacity:0.85;box-shadow:0 0 28px rgba(212,175,55,0.35)} 50%{opacity:1;box-shadow:0 0 55px rgba(212,175,55,0.65),0 0 90px rgba(212,175,55,0.2)} }
      `}</style>
      <CosmicHeader title="Mi perfil" backHref="/settings" />

      <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 8 }}>
          <div onClick={() => fileInputRef.current?.click()}
            style={{ width: 112, height: 112, borderRadius: "50%", background: "#0c0a18", cursor: "pointer",
              padding: 3, position: "relative",
              backgroundImage: "conic-gradient(from 15deg,#d4af37 0%,#f5e070 16%,#8a6012 32%,#6030b0 48%,#2044c0 64%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)",
              animation: "ring-spin 7s linear infinite, ring-breathe 3.5s ease-in-out infinite" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0c0a18",
              overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarPreview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 32, fontWeight: 800, color: "#d4af37" }}>{initials || <User size={32} style={{ color: "#d4af37" }} />}</span>}
            </div>
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 24, height: 24, borderRadius: "50%",
              background: "#0c0a18", border: "1.5px solid rgba(212,175,55,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={12} style={{ color: "#d4af37" }} />
            </div>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "rgba(212,175,55,0.6)", fontWeight: 600 }}>
            {avatarPreview ? "Cambiar foto" : "Agregar foto"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
        </div>

        {/* Avatar builder */}
        <Link href="/avatar" style={{ textDecoration: "none" }}>
          <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "13px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(212,175,55,0.35)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0a0818",
                border: "1px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Smile size={15} style={{ color: "rgba(212,175,55,0.7)" }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Mi avatar</p>
                <p style={{ fontSize: 11, color: "rgba(212,175,55,0.4)" }}>Personaliza tu figura en el árbol</p>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: "rgba(212,175,55,0.35)" }} />
          </div>
        </Link>

        {/* Cuenta */}
        <div>
          <SectionLabel>Cuenta</SectionLabel>
          <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(212,175,55,0.35)" }} />
            <Field label="Nombre para mostrar *">
              <input type="text" style={s3dInput()} value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Idioma">
                <input type="text" style={s3dInput()} placeholder="es" value={form.locale}
                  onChange={e => setForm(f => ({ ...f, locale: e.target.value }))} />
              </Field>
              <Field label="Zona horaria">
                <input type="text" style={s3dInput()} placeholder="America/Bogota" value={form.timezone}
                  onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
              </Field>
            </div>
          </div>
        </div>

        {/* Datos genealógicos */}
        <div>
          <SectionLabel>Datos genealógicos</SectionLabel>
          {noClaim && (
            <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "16px" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                Todavía no tienes una identidad reclamada en el árbol, así que no hay datos genealógicos que editar aquí.
              </p>
            </div>
          )}
          {personForm && (
            <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(212,175,55,0.35)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Nombre *">
                  <input type="text" style={s3dInput()} value={personForm.first_name}
                    onChange={e => setPersonForm(f => f && ({ ...f, first_name: e.target.value }))} />
                </Field>
                <Field label="Segundo nombre">
                  <input type="text" style={s3dInput()} value={personForm.middle_name}
                    onChange={e => setPersonForm(f => f && ({ ...f, middle_name: e.target.value }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Primer apellido *">
                  <input type="text" style={s3dInput()} value={personForm.first_surname}
                    onChange={e => setPersonForm(f => f && ({ ...f, first_surname: e.target.value }))} />
                </Field>
                <Field label="Segundo apellido">
                  <input type="text" style={s3dInput()} value={personForm.second_surname}
                    onChange={e => setPersonForm(f => f && ({ ...f, second_surname: e.target.value }))} />
                </Field>
              </div>
              <Field label="Fecha de nacimiento">
                <input type="date" style={{ ...s3dInput(), colorScheme: "dark" }} value={personForm.birth_date}
                  onChange={e => setPersonForm(f => f && ({ ...f, birth_date: e.target.value }))} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Ciudad de nacimiento">
                  <input type="text" style={s3dInput()} value={personForm.birth_city}
                    onChange={e => setPersonForm(f => f && ({ ...f, birth_city: e.target.value }))} />
                </Field>
                <Field label="País">
                  <input type="text" style={s3dInput()} value={personForm.birth_country}
                    onChange={e => setPersonForm(f => f && ({ ...f, birth_country: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Guardar */}
        <button onClick={save} disabled={saving} style={s3dGoldBtn(saving)}>
          <Save size={14} style={{ display: "inline", marginRight: 7, verticalAlign: "middle" }} />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <CosmicNav />
    </div>
  );
}
