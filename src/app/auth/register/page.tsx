"use client";
import type { CeibaEvent } from "@/lib/viral/viralAnalytics";

// Carga diferida: el SDK de Amplitude ya lo inicializa el layout; importarlo aquí
// de forma estática lo sumaba al tamaño inicial de la página.
const trackEvent = (event: CeibaEvent, properties?: Record<string, any>) => {
  import("@/lib/viral/viralAnalytics")
    .then((m) => m.trackEvent(event, properties))
    .catch(() => {});
};
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
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
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    nombre: "",      // primer + segundo nombre completo
    apellido: "",    // primer + segundo apellido completo
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.apellido.trim()) { toast.error("Ingresa tu nombre y apellido"); return; }
    if (form.password.length < 6) { toast.error("La contraseña necesita al menos 6 caracteres"); return; }

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

      if (!authData.session) {
        toast.success("Revisa tu correo para confirmar tu cuenta");
        router.push("/auth/login?registered=1");
        return;
      }

      trackEvent("sign_up_complete", { from_invite: !!(typeof window !== "undefined" && sessionStorage.getItem("pending_invite_token")) });
      toast.success("¡Bienvenido a Ceiba! ✨");

      // Si llegamos aqui desde /invite/[token] (invitacion personalizada),
      // volvemos ahi ya autenticados para completar accept_invitation.
      const pendingInviteToken = typeof window !== "undefined"
        ? sessionStorage.getItem("pending_invite_token")
        : null;

      router.refresh();
      if (pendingInviteToken) {
        sessionStorage.removeItem("pending_invite_token");
        router.push(`/invite/${pendingInviteToken}`);
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#12082a 0%,#0a0520 100%)", boxShadow:"0 0 32px rgba(212,175,55,0.30), inset 0 1px 0 rgba(212,175,55,0.25)" }}>
            <svg width="30" height="30" viewBox="0 0 38 38" fill="none">
              <ellipse cx="19" cy="19" rx="15" ry="5.5" stroke="rgba(212,175,55,0.45)" strokeWidth="0.8" fill="none" transform="rotate(-25 19 19)"/>
              <path d="M19 19 Q24 13 28 10" stroke="rgba(212,175,55,0.65)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              <path d="M19 19 Q14 25 10 28" stroke="rgba(212,175,55,0.55)" strokeWidth="1" strokeLinecap="round" fill="none"/>
              <path d="M19 19 Q13 14 10 10" stroke="rgba(212,175,55,0.5)" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
              <path d="M19 19 Q25 24 28 28" stroke="rgba(212,175,55,0.45)" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
              <circle cx="25" cy="12" r="1.2" fill="rgba(255,240,180,0.9)"/>
              <circle cx="12" cy="26" r="1.1" fill="rgba(255,240,180,0.8)"/>
              <circle cx="12" cy="13" r="0.9" fill="rgba(212,175,55,0.7)"/>
              <circle cx="26" cy="25" r="0.8" fill="rgba(212,175,55,0.65)"/>
              <path d="M19 13.5 L19.6 17.4 L19 21 L18.4 17.4 Z" fill="rgba(255,245,200,0.92)"/>
              <path d="M13.5 19 L17.4 19.6 L21 19 L17.4 18.4 Z" fill="rgba(255,245,200,0.92)"/>
              <circle cx="19" cy="19" r="2.2" fill="rgba(255,245,200,0.95)"/>
              <circle cx="19" cy="19" r="1" fill="white"/>
            </svg>
          </div>
          <span className="font-display text-xl font-bold text-white mt-1">Ceiba</span>
        </Link>

        <div className="w-full max-w-sm">

          <div className="rounded-3xl p-6" style={cardStyle}>
            <div className="text-center mb-5">
              <h1 className="text-white font-bold text-xl">Crea tu cuenta</h1>
              <p className="text-gray-500 text-xs mt-1">Gratis · tarda menos de un minuto</p>
            </div>

              {/* Google: el camino más corto (un toque) */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { isCapacitor, signInWithGoogleCapacitor, CAPACITOR_OAUTH_REDIRECT } = await import("@/lib/capacitor-oauth");
                    if (isCapacitor()) {
                      const { data, error } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: CAPACITOR_OAUTH_REDIRECT, skipBrowserRedirect: true },
                      });
                      if (error || !data.url) throw error ?? new Error("No OAuth URL");
                      const code = await signInWithGoogleCapacitor(data.url);
                      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                      if (sessionError) throw sessionError;
                      router.push("/home");
                      return;
                    }
                    const { error } = await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: `${window.location.origin}/auth/callback` },
                    });
                    if (error) throw error;
                  } catch { toast.error("Error con Google"); }
                }}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 px-4 text-sm font-semibold text-white transition-all active:scale-[0.98] mb-4"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <GoogleIcon />
                Continuar con Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600">o con correo</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <DarkInput
                    placeholder="Nombre"
                    value={form.nombre}
                    onChange={v => setForm(f => ({ ...f, nombre: v }))}
                    required
                  />
                  <DarkInput
                    placeholder="Apellido"
                    value={form.apellido}
                    onChange={v => setForm(f => ({ ...f, apellido: v }))}
                    required
                  />
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
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                  {loading ? "Creando tu cuenta..." : <>Crear cuenta <ArrowRight size={16} /></>}
                </button>

                <p className="text-center text-gray-600 text-xs">
                  Al continuar aceptas los{" "}
                  <Link href="/terminos" className="text-earth-400 underline">términos</Link>
                  {" "}y la{" "}
                  <Link href="/privacidad" className="text-earth-400 underline">privacidad</Link>
                </p>
              </form>
          </div>

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
        <div className="w-12 h-12 rounded-2xl animate-pulse" style={{ background:"linear-gradient(135deg,#12082a,#0a0520)" }} />
      </div>
    }>
      <RegisterFormInner />
    </Suspense>
  );
}
