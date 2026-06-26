"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    email: "",
    password: "",
  });

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
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { first_name, last_name },
        },
      });
      if (error) throw error;
      toast.success("¡Cuenta creada! Revisa tu correo para confirmarla.");
      router.push("/onboarding");
    } catch (err: any) {
      toast.error(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <TreePine size={32} className="text-ceiba-300" />
            <span className="font-display text-3xl font-bold">Ceiba</span>
          </Link>
          <p className="text-ceiba-300 mt-2">Crea tu cuenta gratis</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primer nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ej. Joselin"
                  value={form.primer_nombre}
                  onChange={e => setForm(f => ({ ...f, primer_nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segundo nombre
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ej. Madeleyne"
                  value={form.segundo_nombre}
                  onChange={e => setForm(f => ({ ...f, segundo_nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primer apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ej. Constantine"
                  value={form.primer_apellido}
                  onChange={e => setForm(f => ({ ...f, primer_apellido: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segundo apellido
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ej. Zambrano"
                  value={form.segundo_apellido}
                  onChange={e => setForm(f => ({ ...f, segundo_apellido: e.target.value }))}
                />
              </div>
            </div>

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
                  placeholder="Mínimo 6 caracteres"
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
