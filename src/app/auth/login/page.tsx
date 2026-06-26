"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

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
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <TreePine size={32} className="text-ceiba-300" />
            <span className="font-display text-3xl font-bold">Ceiba</span>
          </Link>
          <p className="text-ceiba-300 mt-2">Bienvenido de vuelta</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                className="input-field"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="Tu contraseña"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            ¿No tienes cuenta?{" "}
            <Link href="/auth/register" className="text-ceiba-700 font-semibold hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
