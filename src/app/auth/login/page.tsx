"use client";
import { useState } from "react";
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

// Animated background orbs representing family members
function FamilyOrbs() {
  const orbs = [
    { size: 180, top: "-10%", left: "-8%",  delay: "0s",   dur: "18s", opacity: 0.07 },
    { size: 120, top: "15%",  right: "-5%", delay: "3s",   dur: "22s", opacity: 0.06 },
    { size: 90,  top: "55%",  left: "5%",   delay: "6s",   dur: "16s", opacity: 0.08 },
    { size: 200, bottom:"-15%",right:"-10%",delay: "1.5s", dur: "24s", opacity: 0.05 },
    { size: 60,  top: "70%",  left: "60%",  delay: "9s",   dur: "14s", opacity: 0.09 },
    { size: 140, top: "35%",  left: "50%",  delay: "4s",   dur: "20s", opacity: 0.04 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: o.size,
            height: o.size,
            top: (o as any).top,
            left: (o as any).left,
            right: (o as any).right,
            bottom: (o as any).bottom,
            background: i % 2 === 0
              ? `radial-gradient(circle, rgba(193,96,58,${o.opacity * 2}) 0%, rgba(193,96,58,${o.opacity}) 50%, transparent 70%)`
              : `radial-gradient(circle, rgba(92,122,82,${o.opacity * 2}) 0%, rgba(92,122,82,${o.opacity}) 50%, transparent 70%)`,
            animation: `floatOrb ${o.dur} ease-in-out ${o.delay} infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatOrb {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(12px, -18px) scale(1.05); }
          66%  { transform: translate(-8px, 10px) scale(0.97); }
          100% { transform: translate(6px, -8px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { toast.error("Error con Google"); setGoogleLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(form);
      if (error) throw error;
      router.push("/tree");
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-ceiba-950 flex flex-col relative overflow-hidden">

      <FamilyOrbs />

      {/* Top gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-ceiba-950/90 via-ceiba-950/60 to-ceiba-950 pointer-events-none" />

      {/* Grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(92,122,82,1) 1px, transparent 1px), linear-gradient(90deg, rgba(92,122,82,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative flex flex-col flex-1 items-center justify-center px-5 py-10">

        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-1 mb-10 group">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-earth-500 to-ceiba-700 flex items-center justify-center shadow-[0_0_40px_rgba(193,96,58,0.35)] group-hover:shadow-[0_0_60px_rgba(193,96,58,0.5)] transition-shadow">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                {/* Ceiba tree silhouette */}
                <rect x="16.5" y="20" width="3" height="12" rx="1.5" fill="white" opacity="0.9"/>
                <ellipse cx="18" cy="14" rx="10" ry="8" fill="white" opacity="0.9"/>
                <ellipse cx="10" cy="18" rx="6" ry="4.5" fill="white" opacity="0.7"/>
                <ellipse cx="26" cy="18" rx="6" ry="4.5" fill="white" opacity="0.7"/>
                <ellipse cx="18" cy="8" rx="7" ry="5.5" fill="white" opacity="0.95"/>
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-earth-400 border-2 border-ceiba-950 animate-pulse" />
          </div>
          <span className="font-display text-2xl font-bold text-white mt-2 tracking-tight">Ceiba</span>
          <span className="text-earth-300 text-xs font-medium tracking-widest uppercase">Tu árbol familiar</span>
        </Link>

        {/* Headline */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-white text-3xl font-bold leading-tight mb-2">
            Tu familia<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-earth-400 to-earth-300">te espera</span>
          </h1>
          <p className="text-ceiba-300 text-sm">Inicia sesión y reconéctate con tu árbol</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div
            className="rounded-3xl p-6 space-y-4"
            style={{
              background: "rgba(17,24,39,0.7)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(92,122,82,0.25)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 px-4 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <GoogleIcon />
              {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">o con correo</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-2xl py-3.5 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={e => e.currentTarget.style.border = "1px solid rgba(92,122,82,0.6)"}
                  onBlur={e => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full rounded-2xl py-3.5 px-4 pr-12 text-sm text-white placeholder-gray-600 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={e => e.currentTarget.style.border = "1px solid rgba(92,122,82,0.6)"}
                  onBlur={e => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-xs text-earth-400 hover:text-earth-300 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
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
                {loading ? "Entrando..." : <>Iniciar sesión <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-600 text-sm mt-6">
            ¿No tienes cuenta?{" "}
            <Link href="/auth/register" className="text-earth-400 font-semibold hover:text-earth-300 transition-colors">
              Regístrate gratis
            </Link>
          </p>
        </div>

        {/* Social proof */}
        <div className="mt-10 flex items-center gap-2 text-xs text-gray-600">
          <div className="flex -space-x-1.5">
            {["#4a6342","#3d5235","#5c7a52","#8aad7e","#c1603a"].map((c, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-ceiba-950 flex items-center justify-center text-white font-bold text-[8px]"
                style={{ background: c }}
              >
                {["A","M","J","C","L"][i]}
              </div>
            ))}
          </div>
          <span>Miles de familias ya preservan sus memorias</span>
        </div>
      </div>
    </main>
  );
}
