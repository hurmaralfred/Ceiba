"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Eye, EyeOff, Camera, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    email: "",
    password: "",
    social_link: "",
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La foto debe pesar menos de 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.primer_nombre || !form.primer_apellido || !form.email || !form.password) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    const first_name = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_name = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");

    setLoading(true);
    try {
      // 1. Create account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { first_name, last_name },
        },
      });
      if (signUpError) throw signUpError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("No se pudo crear la cuenta");

      // 2. Upload photo if provided
      let avatar_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          avatar_url = urlData.publicUrl;
        }
      }

      // 3. Update profile with avatar and social link
      if (avatar_url || form.social_link) {
        await supabase.from("profiles").update({
          ...(avatar_url ? { avatar_url } : {}),
          ...(form.social_link ? { social_link: form.social_link.trim() } : {}),
        }).eq("id", userId);
      }

      toast.success("¡Cuenta creada!");
      // If user came from a general invite link (/join?ref=...), connect them first
      const joinRef = typeof window !== "undefined" ? sessionStorage.getItem("join_ref") : null;
      if (joinRef) {
        router.push(`/join/connect?ref=${joinRef}`);
      } else {
        router.push("/onboarding");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <TreePine size={32} className="text-ceiba-300" />
            <span className="font-display text-3xl font-bold">Ceiba</span>
          </Link>
          <p className="text-ceiba-300 mt-2">Crea tu cuenta gratis</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Photo upload */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-ceiba-300 flex items-center justify-center cursor-pointer hover:bg-ceiba-50 transition-colors overflow-hidden relative"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-ceiba-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-ceiba-700 font-semibold hover:underline"
              >
                {photoPreview ? "Cambiar foto" : "Agregar foto de perfil"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primer nombre <span className="text-red-500">*</span>
                </label>
                <input type="text" className="input-field" placeholder="ej. Joselin"
                  value={form.primer_nombre}
                  onChange={e => setForm(f => ({ ...f, primer_nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segundo nombre</label>
                <input type="text" className="input-field" placeholder="ej. Madeleyne"
                  value={form.segundo_nombre}
                  onChange={e => setForm(f => ({ ...f, segundo_nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primer apellido <span className="text-red-500">*</span>
                </label>
                <input type="text" className="input-field" placeholder="ej. Constantine"
                  value={form.primer_apellido}
                  onChange={e => setForm(f => ({ ...f, primer_apellido: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segundo apellido</label>
                <input type="text" className="input-field" placeholder="ej. Zambrano"
                  value={form.segundo_apellido}
                  onChange={e => setForm(f => ({ ...f, segundo_apellido: e.target.value }))}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico <span className="text-red-500">*</span></label>
              <input type="email" className="input-field" placeholder="tu@correo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Social link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Red social (opcional)</label>
              <div className="relative">
                <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="url" className="input-field pl-9" placeholder="https://instagram.com/tuperfil"
                  value={form.social_link}
                  onChange={e => setForm(f => ({ ...f, social_link: e.target.value }))}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-ceiba-700 font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
