"use client";
import { useState } from "react";
import Link from "next/link";
import { TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("No se pudo enviar el correo. Verifica la dirección.");
      return;
    }
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <TreePine size={32} className="text-ceiba-300" />
            <span className="font-display text-3xl font-bold">Ceiba</span>
          </Link>
          <p className="text-ceiba-300 mt-2">Recuperar contraseña</p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Revisa tu correo</h2>
              <p className="text-gray-500 text-sm mb-6">
                Te enviamos un enlace para restablecer tu contraseña a <strong>{email}</strong>.
                Puede tardar unos minutos.
              </p>
              <Link href="/auth/login" className="text-ceiba-700 font-semibold hover:underline text-sm">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-5">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
              <p className="text-center text-gray-500 text-sm mt-5">
                <Link href="/auth/login" className="text-ceiba-700 font-semibold hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
