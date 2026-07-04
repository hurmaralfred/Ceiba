"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  TreePine, Heart, Users, Eye, EyeOff,
  ChevronRight, AlertCircle, Check, ArrowLeft
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchInvitationData } from "@/lib/viral/deeplinkHandler";
import { trackEvent } from "@/lib/viral/viralAnalytics";
import toast, { Toaster } from "react-hot-toast";

// ============================================================
// Tipos
// ============================================================

interface PersonPreview {
  id: string;
  first_names: string;
  last_names: string;
  profile_photo_url?: string | null;
  birth_date?: string | null;
  birth_city?: string | null;
  gender?: string | null;
}

interface InviteData {
  invitation: { id: string; code: string; status: string; first_opened: boolean };
  invited_person: PersonPreview | null;
  inviter: PersonPreview | null;
  preview: { count: number; members: PersonPreview[] };
}

type Step = "loading" | "confirm" | "register" | "not_me" | "welcome" | "error";

// ============================================================
// Helpers
// ============================================================

function Avatar({ person, size = 64 }: { person: PersonPreview; size?: number }) {
  if (person.profile_photo_url) {
    return (
      <Image
        src={person.profile_photo_url}
        alt={person.first_names}
        width={size}
        height={size}
        className="rounded-full object-cover border-4 border-ceiba-400"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-ceiba-600 flex items-center justify-center text-white font-bold border-4 border-ceiba-400"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {person.first_names?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ============================================================
// Pantalla 1 — Loading
// ============================================================

function ScreenLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col items-center justify-center gap-6 text-white">
      <TreePine size={48} className="text-ceiba-300 animate-pulse" />
      <p className="text-ceiba-200 text-lg">Cargando tu familia...</p>
    </div>
  );
}

// ============================================================
// Pantalla 2 — ¿Este eres tú?
// ============================================================

function ScreenConfirm({
  data,
  onYes,
  onNo,
}: {
  data: InviteData;
  onYes: () => void;
  onNo: () => void;
}) {
  const { invited_person, inviter, preview } = data;
  const inviterName = inviter
    ? `${inviter.first_names} ${inviter.last_names}`.trim()
    : "Tu familiar";

  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-center py-8 gap-2">
        <TreePine size={24} className="text-ceiba-300" />
        <span className="font-display text-xl font-bold">Ceiba</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 gap-5 pb-10 max-w-sm mx-auto w-full">

        {/* Inviter */}
        <div className="flex flex-col items-center gap-2 text-center">
          {inviter && <Avatar person={inviter} size={56} />}
          <p className="text-ceiba-200 text-sm">
            <span className="font-semibold text-white">{inviterName}</span> te agregó al árbol familiar
          </p>
        </div>

        {/* Pregunta principal */}
        <h1 className="text-3xl font-bold text-center">¿Este eres tú?</h1>

        {/* Tarjeta del invitado */}
        {invited_person && (
          <div className="w-full bg-white/10 rounded-2xl p-5 flex items-center gap-4">
            <Avatar person={invited_person} size={72} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight">
                {invited_person.first_names} {invited_person.last_names}
              </p>
              {invited_person.birth_date && (
                <p className="text-ceiba-200 text-sm mt-1">
                  {new Date(invited_person.birth_date).toLocaleDateString("es", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
              )}
              {invited_person.birth_city && (
                <p className="text-ceiba-200 text-sm">{invited_person.birth_city}</p>
              )}
            </div>
          </div>
        )}

        {/* Preview del árbol */}
        {preview.count > 0 && (
          <div className="w-full bg-white/10 rounded-2xl p-4">
            <p className="text-ceiba-200 text-xs uppercase tracking-wide mb-3">
              Cuando entres vas a ver a
            </p>
            <div className="flex flex-wrap gap-2">
              {preview.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-ceiba-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.first_names[0]}
                  </div>
                  <span className="text-sm">{m.first_names}</span>
                </div>
              ))}
              {preview.count > preview.members.length && (
                <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 text-ceiba-200 text-sm">
                  +{preview.count - preview.members.length} más
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            onClick={onYes}
            className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 active:bg-ceiba-600 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
          >
            <Check size={20} />
            Sí, soy yo
          </button>
          <button
            onClick={onNo}
            className="w-full text-ceiba-300 hover:text-white text-sm py-3 transition-colors"
          >
            No, es otra persona
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Pantalla 3 — Registro inline
// ============================================================

function ScreenRegister({
  data,
  onSuccess,
  onBack,
}: {
  data: InviteData;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const invited = data.invited_person;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) Crear usuario
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: invited?.first_names ?? "",
            last_name: invited?.last_names ?? "",
            invite_code: data.invitation.code,
          },
        },
      });
      if (error) throw error;

      // 2) Llamar al post-register para crear/vincular persona
      await fetch("/api/auth/post-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: data.invitation.code }),
      }).catch(() => {});

      trackEvent("invite_converted", {
        invitation_id: data.invitation.id,
        invitation_code: data.invitation.code,
      });

      onSuccess();
    } catch (err: any) {
      toast.error(err.message ?? "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col text-white">
      <div className="flex items-center justify-between px-5 py-6">
        <button onClick={onBack} className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          <TreePine size={20} className="text-ceiba-300" />
          <span className="font-display font-bold">Ceiba</span>
        </div>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex flex-col items-center px-5 gap-6 pb-10 max-w-sm mx-auto w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Solo una cosa más</h1>
          <p className="text-ceiba-200 text-sm">
            {invited ? `Hola ${invited.first_names}, ` : ""}crea tu cuenta y entra a tu árbol.
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-full flex gap-2">
          <div className="h-1 flex-1 rounded-full bg-ceiba-500" />
          <div className="h-1 flex-1 rounded-full bg-ceiba-500" />
          <div className="h-1 flex-1 rounded-full bg-ceiba-400" />
        </div>

        <form onSubmit={handleRegister} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-2xl py-4 px-4 text-white placeholder-gray-500 bg-white/10 border border-white/10 focus:border-ceiba-400 outline-none transition-colors"
          />

          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-2xl py-4 px-4 pr-12 text-white placeholder-gray-500 bg-white/10 border border-white/10 focus:border-ceiba-400 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ceiba-300"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 disabled:opacity-50 text-white font-bold text-lg py-4 rounded-2xl transition-colors mt-2"
          >
            {loading ? "Entrando..." : "Entrar a mi árbol"}
            {!loading && <ChevronRight size={20} />}
          </button>
        </form>

        <p className="text-ceiba-300 text-xs text-center">
          Al continuar aceptas los{" "}
          <Link href="/terms" className="underline">términos</Link> y{" "}
          <Link href="/privacy" className="underline">política de privacidad</Link> de Ceiba.
        </p>

        <p className="text-ceiba-300 text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link href={`/auth/login?invite=${data.invitation.code}`} className="text-white underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Pantalla — No soy yo
// ============================================================

function ScreenNotMe({ onRegisterSeparately }: { onRegisterSeparately: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col items-center justify-center gap-6 text-white px-6 text-center">
      <AlertCircle size={48} className="text-yellow-400" />
      <h1 className="text-2xl font-bold">Entendido, no eres tú</h1>
      <p className="text-ceiba-200">¿Qué prefieres hacer?</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRegisterSeparately}
          className="w-full bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl transition-colors"
        >
          Registrarme aparte
        </button>
        <Link
          href="/"
          className="w-full text-center text-ceiba-300 hover:text-white py-3 transition-colors text-sm"
        >
          Salir
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Pantalla 4 — ¡Bienvenido a tu árbol!
// ============================================================

function ScreenWelcome({ invited }: { invited: PersonPreview | null }) {
  const router = useRouter();
  const firstName = invited?.first_names ?? "familiar";

  useEffect(() => {
    const t = setTimeout(() => router.push("/tree"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col items-center justify-center gap-8 text-white px-6 text-center">
      {/* Árbol animado */}
      <div className="relative">
        <TreePine size={80} className="text-ceiba-300 animate-bounce" />
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
          <Check size={14} className="text-white" />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-3">
          ¡Bienvenido/a a tu árbol, {firstName}!
        </h1>
        <p className="text-ceiba-200 text-lg">
          Tu familia ya te estaba esperando.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-sm">
          <Heart size={18} className="text-red-400 flex-shrink-0" />
          <span>Ya puedes ver a toda tu familia</span>
        </div>
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-sm">
          <span className="text-lg flex-shrink-0">🎂</span>
          <span>Recibirás recordatorios de cumpleaños</span>
        </div>
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-sm">
          <span className="text-lg flex-shrink-0">🚨</span>
          <span>Tu familia puede mandarte SOS si te necesitan</span>
        </div>
      </div>

      <button
        onClick={() => router.push("/tree")}
        className="flex items-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold text-lg py-4 px-8 rounded-2xl transition-colors"
      >
        Ver mi árbol
        <ChevronRight size={20} />
      </button>

      <p className="text-ceiba-300 text-xs">Entrando automáticamente en unos segundos...</p>
    </div>
  );
}

// ============================================================
// Pantalla — Error
// ============================================================

function ScreenError({ message }: { message: string }) {
  const expired = message.includes("expired");
  return (
    <div className="min-h-screen bg-ceiba-900 flex flex-col items-center justify-center gap-6 text-white px-6 text-center">
      <AlertCircle size={48} className="text-red-400" />
      <h1 className="text-2xl font-bold">
        {expired ? "Esta invitación venció" : "Invitación no encontrada"}
      </h1>
      <p className="text-ceiba-200 max-w-sm">
        {expired
          ? "El link es válido por 90 días. Pide a tu familiar que te envíe uno nuevo."
          : "El link no es válido o ya fue usado."}
      </p>
      <Link
        href="/auth/register"
        className="bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-3 px-8 rounded-2xl"
      >
        Crear cuenta de todos modos
      </Link>
    </div>
  );
}

// ============================================================
// Componente principal
// ============================================================

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [step, setStep] = useState<Step>("loading");
  const [data, setData] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!code) return;
    fetchInvitationData(code)
      .then((d) => {
        setData(d);
        trackEvent("invite_link_opened", {
          invitation_id: d.invitation?.id,
          first_open: d.invitation?.first_opened,
        });
        trackEvent("invited_onboarding_step", { step: "preview", invitation_code: code });
        setStep("confirm");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setStep("error");
      });
  }, [code]);

  if (step === "loading") return <ScreenLoading />;
  if (step === "error") return <ScreenError message={errorMsg} />;
  if (!data) return <ScreenLoading />;

  if (step === "not_me") {
    return (
      <ScreenNotMe
        onRegisterSeparately={() => router.push("/auth/register")}
      />
    );
  }

  if (step === "confirm") {
    return (
      <>
        <Toaster position="top-center" />
        <ScreenConfirm
          data={data}
          onYes={() => {
            trackEvent("invited_onboarding_step", { step: "confirm_identity", invitation_code: code });
            setStep("register");
          }}
          onNo={() => {
            trackEvent("invited_identity_rejected" as any, { invitation_code: code });
            setStep("not_me");
          }}
        />
      </>
    );
  }

  if (step === "register") {
    return (
      <>
        <Toaster position="top-center" />
        <ScreenRegister
          data={data}
          onSuccess={() => {
            trackEvent("invited_onboarding_step", { step: "welcome_home", invitation_code: code });
            setStep("welcome");
          }}
          onBack={() => setStep("confirm")}
        />
      </>
    );
  }

  if (step === "welcome") {
    return <ScreenWelcome invited={data.invited_person} />;
  }

  return null;
}
