"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, ArrowLeft, Camera, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function FamilyOrbs() {
  const orbs = [
    { size: 200, top: "-12%", left: "-10%",  delay: "0s",   dur: "20s", opacity: 0.06 },
    { size: 130, top: "10%",  right: "-8%",  delay: "4s",   dur: "18s", opacity: 0.05 },
    { size: 100, top: "60%",  left: "2%",    delay: "7s",   dur: "22s", opacity: 0.07 },
    { size: 180, bottom:"-12%",right:"-8%",  delay: "2s",   dur: "25s", opacity: 0.04 },
    { size: 70,  top: "75%",  left: "55%",   delay: "10s",  dur: "16s", opacity: 0.08 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((o, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: o.size, height: o.size,
          top: (o as any).top, left: (o as any).left,
          right: (o as any).right, bottom: (o as any).bottom,
          background: i % 2 === 0
              ? `radial-gradient(circle, rgba(193,96,58,${o.opacity * 2}) 0%, rgba(193,96,58,${o.opacity}) 50%, transparent 70%)`
              : `radial-gradient(circle, rgba(92,122,82,${o.opacity * 2}) 0%, rgba(92,122,82,${o.opacity}) 50%, transparent 70%)`,
          animation: `floatOrb ${o.dur} ease-in-out ${o.delay} infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes floatOrb {
          0%   { transform: translate(0px,0px) scale(1); }
          33%  { transform: translate(10px,-15px) scale(1.04); }
          66%  { transform: translate(-6px,8px) scale(0.98); }
          100% { transform: translate(5px,-6px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

const DARK_INPUT = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const DARK_INPUT_FOCUS = "1px solid rgba(92,122,82,0.6)";

function DarkInput({ type = "text", placeholder, value, onChange, required, className = "" }: {
  type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean; className?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      className={`w-full rounded-2xl py-3.5 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all ${className}`}
      style={DARK_INPUT}
      onFocus={e => (e.currentTarget.style.border = DARK_INPUT_FOCUS)}
      onBlur={e => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)")}
    />
  );
}

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paraToken = searchParams.get("para");
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1); // 1 = nombre+foto, 2 = email+pass
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    nombre: "",      // primer + segundo nombre completo
    apellido: "",    // primer + segundo apellido completo
    email: "",
    password: "",
  });

  // Pre-fill name if coming from a personalized invite
  useEffect(() => {
    if (!paraToken) return;
    fetch(`/api/para/${paraToken}`)
      .then(r => r.json())
      .then(data => {
        if (!data.member) return;
        setForm(f => ({
          ...f,
          nombre:   data.member.first_name ?? "",
          apellido: data.member.last_name  ?? "",
        }));
      })
      .catch(() => {});
  }, [paraToken]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("La foto debe pesar menos de 5MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.apellido.trim()) {
      toast.error("Ingresa tu nombre y apellido");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error("Mínimo 6 caracteres"); return; }

    setLoading(true);
    try {
      const first_name = form.nombre.trim();
      const last_name  = form.apellido.trim();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { first_name, last_name } },
      });
      if (signUpError) throw signUpError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("No se pudo crear la cuenta");

      let avatar_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars").upload(path, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          avatar_url = urlData.publicUrl;
        }
      }

      if (avatar_url) {
        await supabase.from("profiles").update({ avatar_url }).eq("id", userId);
        // Sincronizar foto en persons (nuevo esquema)
        await supabase.from("persons").update({ profile_photo_url: avatar_url }).eq("linked_user_id", userId);
      }

      try { await fetch("/api/auth/post-register", { method: "POST" }); } catch {}

      toast.success("¡Bienvenido a Ceiba! 🌳");

      const storedPara = typeof window !== "undefined" ? sessionStorage.getItem("para_token") : null;
      const joinRef    = typeof window !== "undefined" ? sessionStorage.getItem("join_ref") : null;
      if (paraToken || storedPara) {
        const t = paraToken || storedPara;
        if (storedPara) sessionStorage.removeItem("para_token");
        router.push(`/para/${t}`);
      } else if (joinRef) {
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

  const cardStyle = {
    background: "rgba(17,24,39,0.7)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(92,122,82,0.25)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 64px rgba(0,0,0,0.5)",
  };

  return (
    <main className="min-h-screen bg-ceiba-950 flex flex-col relative overflow-hidden">
      <FamilyOrbs />
      <div className="absolute inset-0 bg-gradient-to-b from-ceiba-950/90 via-ceiba-950/60 to-ceiba-950 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(92,122,82,1) 1px, transparent 1px), linear-gradient(90deg, rgba(92,122,82,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative flex flex-col flex-1 items-center justify-center px-5 py-10">

        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-1 mb-8 group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-earth-500 to-ceiba-700 flex items-center justify-center shadow-[0_0_32px_rgba(193,96,58,0.3)]">
            <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
              <rect x="16.5" y="20" width="3" height="12" rx="1.5" fill="white" opacity="0.9"/>
              <ellipse cx="18" cy="14" rx="10" ry="8" fill="white" opacity="0.9"/>
              <ellipse cx="10" cy="18" rx="6" ry="4.5" fill="white" opacity="0.7"/>
              <ellipse cx="26" cy="18" rx="6" ry="4.5" fill="white" opacity="0.7"/>
              <ellipse cx="18" cy="8" rx="7" ry="5.5" fill="white" opacity="0.95"/>
            </svg>
          </div>
          <span className="font-display text-xl font-bold text-white mt-1">Ceiba</span>
        </Link>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={
                  s < step
                    ? { background: "rgba(92,122,82,0.25)", border: "1px solid #5c7a52", color: "#8aad7e" }
                    : s === step
                    ? { background: "linear-gradient(135deg, #c1603a, #a84f2f)", color: "white", boxShadow: "0 0 16px rgba(193,96,58,0.4)" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#4b5563" }
                }
              >
                {s < step ? <Check size={12} /> : s}
              </div>
              {s < 2 && (
                <div className="w-8 h-px transition-all duration-300"
                  style={{ background: s < step ? "rgba(92,122,82,0.5)" : "rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm">

          {/* ── STEP 1: Nombre + foto ── */}
          {step === 1 && (
            <div className="rounded-3xl p-6" style={cardStyle}>
              {/* Google at top of step 1 */}
              <button
                type="button"
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
                  if (error) toast.error("Error con Google");
                }}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 px-4 text-sm font-semibold text-white transition-all active:scale-[0.98] mb-4"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <GoogleIcon />
                Registrarse con Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600">o con correo</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              <form onSubmit={handleStep1} className="space-y-4">
                {/* Headline */}
                <div className="text-center mb-2">
                  <h2 className="text-white font-bold text-lg">¿Cómo te llamas?</h2>
                  <p className="text-gray-500 text-xs mt-1">Así aparecerás en el árbol familiar</p>
                </div>

                {/* Avatar upload — centered */}
                <div className="flex flex-col items-center gap-2 pb-1">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group"
                    style={{
                      background: photoPreview ? "transparent" : "rgba(92,122,82,0.1)",
                      border: photoPreview ? "2px solid #5c7a52" : "2px dashed rgba(92,122,82,0.4)",
                    }}
                  >
                    {photoPreview
                      ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                      : <Camera size={22} className="text-earth-400 group-hover:text-earth-300 transition-colors" />
                    }
                    {photoPreview && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={18} className="text-white" />
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-earth-400 hover:text-earth-300 font-medium transition-colors">
                    {photoPreview ? "Cambiar foto" : "Añadir foto (opcional)"}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DarkInput
                    placeholder="Nombre(s)"
                    value={form.nombre}
                    onChange={v => setForm(f => ({ ...f, nombre: v }))}
                    required
                  />
                  <DarkInput
                    placeholder="Apellido(s)"
                    value={form.apellido}
                    onChange={v => setForm(f => ({ ...f, apellido: v }))}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #c1603a 0%, #a84f2f 100%)",
                    boxShadow: "0 4px 24px rgba(193,96,58,0.4)",
                  }}
                >
                  Siguiente <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 2: Email + contraseña ── */}
          {step === 2 && (
            <div className="rounded-3xl p-6" style={cardStyle}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Back + headline */}
                <div className="flex items-center gap-3 mb-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2 className="text-white font-bold text-lg">
                      Hola, {form.nombre.split(" ")[0]} 👋
                    </h2>
                    <p className="text-gray-500 text-xs">Un paso más para entrar</p>
                  </div>
                </div>

                {/* Preview del usuario */}
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: "rgba(92,122,82,0.1)", border: "1px solid rgba(92,122,82,0.2)" }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #4a6342, #1a2417)" }}>
                    {photoPreview
                      ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                      : `${form.nombre[0] || ""}${form.apellido[0] || ""}`.toUpperCase()
                    }
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{form.nombre} {form.apellido}</p>
                    <p className="text-earth-400 text-xs">Nuevo miembro de Ceiba</p>
                  </div>
                </div>

                <DarkInput
                  type="email"
                  placeholder="Correo electrónico"
                  value={form.email}
                  onChange={v => setForm(f => ({ ...f, email: v }))}
                  required
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    className="w-full rounded-2xl py-3.5 px-4 pr-12 text-sm text-white placeholder-gray-600 outline-none transition-all"
                    style={DARK_INPUT}
                    onFocus={e => (e.currentTarget.style.border = DARK_INPUT_FOCUS)}
                    onBlur={e => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)")}
                  />
                  <button type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: loading
                      ? "rgba(168,79,47,0.5)"
                      : "linear-gradient(135deg, #c1603a 0%, #a84f2f 100%)",
                    boxShadow: loading ? "none" : "0 4px 24px rgba(193,96,58,0.4)",
                  }}
                >
                  {loading ? "Creando tu árbol..." : <>Entrar a Ceiba <ArrowRight size={16} /></>}
                </button>

                <p className="text-center text-gray-700 text-xs">
                  Al registrarte aceptas los{" "}
                  <span className="text-earth-400">términos y privacidad</span>
                </p>
              </form>
            </div>
          )}

          <p className="text-center text-gray-600 text-sm mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-earth-400 font-semibold hover:text-earth-300 transition-colors">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ceiba-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-earth-500 to-ceiba-700 animate-pulse" />
      </div>
    }>
      <RegisterFormInner />
    </Suspense>
  );
}
