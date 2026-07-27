"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Check, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

// Clave de sessionStorage compartida con /auth/register: permite volver
// aquí después de crear la cuenta y completar accept_invitation ya
// autenticado. Es la ÚNICA pieza de estado que cruza esa frontera.
const PENDING_INVITE_KEY = "pending_invite_token";

interface InvitationPreview {
  id: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  person: {
    id: string;
    first_name: string;
    middle_name: string | null;
    first_surname: string;
    second_surname: string | null;
    photo_path: string | null;
  };
  inviter: {
    display_name: string;
    avatar_path: string | null;
  };
  space: {
    id: string;
    name: string;
  };
}

function fullName(p: InvitationPreview["person"]): string {
  return [p.first_name, p.first_surname].filter(Boolean).join(" ");
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const autoAcceptedRef = useRef(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = async () => {
    // get_invitation_by_token es pública (no exige sesión) y devuelve null
    // ante un token invalido, expirado-al-consultarlo o inexistente — nunca
    // lanza excepción para esos casos.
    const { data, error } = await supabase.rpc("get_invitation_by_token", {
      p_token: token,
    });

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setInvitation(data as InvitationPreview);

    // Si ya hay sesión activa, se acepta de inmediato: cubre tanto al
    // usuario que vuelve desde /auth/register tras registrarse, como a
    // quien abre el link ya con sesión iniciada de antes.
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !autoAcceptedRef.current) {
      autoAcceptedRef.current = true;
      await accept();
      return;
    }

    setLoading(false);
  };

  const accept = async () => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc("accept_invitation", {
        p_token: token,
      });
      if (error) throw error;

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      }

      toast.success(
        data?.already_accepted
          ? "Ya estabas conectado con tu familia 🌳"
          : "¡Conexión familiar confirmada! 🌳"
      );
      router.push("/tree");
    } catch (err: any) {
      setAccepting(false);
      setLoading(false);
      toast.error(err.message || "No se pudo aceptar la invitación");
    }
  };

  const goToRegister = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
    }
    router.push("/auth/register");
  };

  if (loading || accepting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex flex-col items-center justify-center gap-4">
        <TreePine size={40} className="text-ceiba-300 animate-pulse" />
        {accepting && (
          <p className="text-ceiba-300 text-sm">Conectando con tu familia…</p>
        )}
      </div>
    );
  }

  if (notFound || !invitation) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-10 flex flex-col items-center justify-center text-center">
        <TreePine size={36} className="text-ceiba-300 mb-3" />
        <h1 className="text-white text-xl font-bold mb-2">
          Este enlace ya no es válido
        </h1>
        <p className="text-ceiba-300 text-sm mb-6 max-w-xs">
          Puede haber expirado, haberse revocado, o ya haber sido usado.
          Pide a tu familiar que te envíe uno nuevo.
        </p>
        <Link href="/" className="btn-primary px-6 py-3">
          Ir a Ceiba
        </Link>
      </main>
    );
  }

  if (invitation.status !== "pending") {
    const messages: Record<string, string> = {
      expired: "Este enlace de invitación expiró.",
      revoked: "Este enlace de invitación fue cancelado.",
      accepted: "Esta invitación ya fue utilizada.",
    };
    return (
      <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-10 flex flex-col items-center justify-center text-center">
        <TreePine size={36} className="text-ceiba-300 mb-3" />
        <h1 className="text-white text-xl font-bold mb-2">
          {messages[invitation.status] ?? "Esta invitación no está activa."}
        </h1>
        <Link href="/" className="btn-primary px-6 py-3 mt-4">
          Ir a Ceiba
        </Link>
      </main>
    );
  }

  const inviterName = invitation.inviter.display_name;
  const memberName = fullName(invitation.person);

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">

        {/* Header brand */}
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TreePine size={28} className="text-ceiba-300" />
            <span className="font-display text-2xl font-bold text-white">Ceiba</span>
          </div>
          <p className="text-ceiba-400 text-xs">El árbol de tu familia</p>
        </div>

        {/* Invitation card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Inviter header */}
          <div className="bg-gradient-to-r from-ceiba-800 to-ceiba-600 px-6 py-5 text-white">
            <div className="flex items-center gap-4">
              {invitation.inviter.avatar_path ? (
                <img
                  src={invitation.inviter.avatar_path}
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
                  {inviterName[0]}
                </div>
              )}
              <div>
                <p className="text-ceiba-200 text-xs font-medium mb-0.5">Te invita</p>
                <h2 className="text-xl font-bold">{inviterName}</h2>
                <p className="text-ceiba-200 text-sm">al árbol familiar</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">

            <div className="bg-ceiba-50 rounded-2xl px-4 py-3 border border-ceiba-100">
              <p className="text-sm text-ceiba-800">
                Te guardaron un lugar en el árbol como{" "}
                <span className="font-bold text-ceiba-700">{memberName}</span>.
                Al aceptar, quedarás conectado con toda tu familia en Ceiba.
              </p>
            </div>

            {/* What they get */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Al unirte podrás</p>
              {[
                "Ver y completar el árbol familiar",
                "Ver dónde vive tu familia en el mapa",
                "Chatear con grupos de la familia",
                "Compartir fotos e historias familiares",
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check size={13} className="text-ceiba-600 shrink-0" />
                  <span className="text-xs text-gray-600">{b}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-1">
              <button
                onClick={goToRegister}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
              >
                <Users size={18} /> Crear cuenta y unirme
              </button>
              <Link
                href="/auth/login"
                className="w-full flex items-center justify-center py-2.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Ya tengo cuenta — iniciar sesión
              </Link>
            </div>

            <p className="text-center text-xs text-gray-400">
              Es gratis. Si inicias sesión en vez de registrarte, vuelve a
              abrir este enlace para completar la conexión.
            </p>
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center">
          <p className="text-ceiba-400 text-xs">
            Ceiba conecta familias de manera segura y privada.
          </p>
        </div>
      </div>
    </main>
  );
}
