"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, MapPin, Cake, Link as LinkIcon, Eye, Shield, LogOut, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface PrivacySettings {
  location_enabled: boolean;
  privacy_birth_date: boolean;
  privacy_social_link: boolean;
  privacy_map: boolean;
}

function Toggle({ enabled, onChange, label, description, icon }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-ceiba-50 flex items-center justify-center text-ceiba-700 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 text-sm">{label}</div>
        <div className="text-xs text-gray-500 leading-relaxed">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-ceiba-600" : "bg-gray-300"}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState<PrivacySettings>({
    location_enabled: false,
    privacy_birth_date: true,
    privacy_social_link: true,
    privacy_map: true,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("profiles")
      .select("location_enabled, privacy_birth_date, privacy_social_link, privacy_map")
      .eq("id", user.id)
      .single();
    if (data) setSettings({
      location_enabled: data.location_enabled ?? false,
      privacy_birth_date: data.privacy_birth_date ?? true,
      privacy_social_link: data.privacy_social_link ?? true,
      privacy_map: data.privacy_map ?? true,
    });
    setLoading(false);
  };

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", userId!);
    if (error) {
      setSettings(settings); // revert
      toast.error("Error al guardar");
    } else {
      toast.success("Preferencia guardada");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <TreePine size={20} className="text-ceiba-300" /> Privacidad y ajustes
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6 pb-24 space-y-4">

        {/* Privacy */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-ceiba-700" />
            <h2 className="font-bold text-gray-800">Privacidad</h2>
          </div>
          <p className="text-xs text-gray-400 mb-2">Controla qué información comparte Ceiba con tu familia.</p>

          <Toggle
            enabled={settings.location_enabled}
            onChange={v => updateSetting("location_enabled", v)}
            label="Compartir ubicación"
            description="Apareces en el mapa familiar cuando activas esto."
            icon={<MapPin size={16} />}
          />
          <Toggle
            enabled={settings.privacy_map}
            onChange={v => updateSetting("privacy_map", v)}
            label="Visible en el mapa"
            description="Tu ubicación es visible para tus familiares conectados."
            icon={<Eye size={16} />}
          />
          <Toggle
            enabled={settings.privacy_birth_date}
            onChange={v => updateSetting("privacy_birth_date", v)}
            label="Mostrar fecha de nacimiento"
            description="Tu familia verá tu cumpleaños en el widget de próximos cumpleaños."
            icon={<Cake size={16} />}
          />
          <Toggle
            enabled={settings.privacy_social_link}
            onChange={v => updateSetting("privacy_social_link", v)}
            label="Mostrar red social"
            description="Tu link de Instagram, Facebook u otra red es visible en tu perfil."
            icon={<LinkIcon size={16} />}
          />
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-ceiba-700" />
            <h2 className="font-bold text-gray-800">Notificaciones</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Ceiba te notifica cuando un familiar se une, acepta una conexión o confirma una sugerencia.
            Las notificaciones se activan automáticamente al instalar la app.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Para desactivarlas, ve a la configuración de tu dispositivo → Ceiba → Notificaciones.
          </p>
        </div>

        {/* Account */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">Cuenta</h2>
          <Link href="/profile" className="flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors">
            <span className="text-sm font-medium text-gray-700">Editar perfil</span>
            <ArrowLeft size={14} className="text-gray-400 rotate-180" />
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
