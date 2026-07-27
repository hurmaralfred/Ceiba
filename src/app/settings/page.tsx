"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, LogOut, Bell, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <TreePine size={20} className="text-ceiba-300" /> Privacidad y ajustes
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6 pb-24 space-y-4">

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-ceiba-700" />
            <h2 className="font-bold text-ceiba-800">Notificaciones</h2>
          </div>
          <p className="text-sm text-ceiba-500 leading-relaxed">
            Ceiba te notifica cuando un familiar se une, acepta una conexión o confirma una sugerencia.
            Las notificaciones se activan automáticamente al instalar la app.
          </p>
          <p className="text-xs text-ceiba-400 mt-2">
            Para desactivarlas, ve a la configuración de tu dispositivo → Ceiba → Notificaciones.
          </p>
        </div>

        {/* Account */}
        <div className="card">
          <h2 className="font-bold text-ceiba-800 mb-4">Cuenta</h2>
          <Link href="/profile" className="flex items-center justify-between py-3 border-b border-cream-200 hover:bg-cream-100 -mx-2 px-2 rounded-xl transition-colors">
            <span className="text-sm font-medium text-ceiba-700">Editar perfil</span>
            <ArrowLeft size={14} className="text-ceiba-400 rotate-180" />
          </Link>
          <Link href="/map" className="flex items-center justify-between py-3 border-b border-cream-200 hover:bg-cream-100 -mx-2 px-2 rounded-xl transition-colors">
            <span className="text-sm font-medium text-ceiba-700 flex items-center gap-2"><MapPin size={14} /> Ubicación y mapa familiar</span>
            <ArrowLeft size={14} className="text-ceiba-400 rotate-180" />
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-500 hover:text-red-700 font-medium text-sm mt-4 transition-colors"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 pb-4">
          Ceiba · Tu familia, conectada · v1.0
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
