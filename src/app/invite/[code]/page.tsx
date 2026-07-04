"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { TreePine, Users, Heart, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { fetchInvitationData } from "@/lib/viral/deeplinkHandler";
import { trackEvent } from "@/lib/viral/viralAnalytics";

// ============================================================
// Tipos
// ============================================================

interface PersonPreview {
  id: string;
  first_names: string;
  last_names: string;
  profile_photo_url?: string | null;
}

interface InviteData {
  invitation: { id: string; code: string; status: string; first_opened: boolean };
  invited_person: PersonPreview | null;
  inviter: PersonPreview | null;
  preview: { count: number; members: PersonPreview[] };
}

// ============================================================
// Componente
// ============================================================

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    fetchInvitationData(code)
      .then((d) => {
        setData(d);
        trackEvent("invite_link_opened", {
          invitation_id: d.invitation?.id,
          first_open: d.invitation?.first_opened,
        });
      })
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [code]);

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-ceiba-900 flex flex-col items-center justify-center gap-4 text-white">
        <TreePine size={40} className="text-ceiba-300 animate-pulse" />
        <p className="text-ceiba-200">Cargando tu árbol familiar...</p>
      </div>
    );
  }

  // ---------- Error ----------
  if (error || !data) {
    const expired = error?.includes("expired");
    return (
      <div className="min-h-screen bg-ceiba-900 flex flex-col items-center justify-center gap-6 text-white px-6 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <h1 className="text-2xl font-bold">
          {expired ? "Esta invitacion vencio" : "Invitacion no encontrada"}
        </h1>
        <p className="text-ceiba-200 max-w-sm">
          {expired
            ? "El link es valido por 90 dias. Pide a tu familiar que te envie uno nuevo."
            : "El link no es valido o ya fue usado."}
        </p>
        <Link
          href="/auth/signup"
          className="mt-4 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-3 px-8 rounded-xl"
        >
          Crear cuenta de todos modos
        </Link>
      </div>
    );
  }

  const { invited_person, inviter, preview } = data;
  const invitedName = invited_person
    ? `${invited_person.first_names} ${invited_person.last_names}`.trim()
    : "alguien de tu familia";
  const inviterName = inviter
    ? `${inviter.first_names} ${inviter.last_names}`.trim()
    : "Tu familiar";

  // URL de registro con el codigo pre-cargado
  const signupUrl = `/auth/signup?invite=${code}&name=${encodeURIComponent(invited_person?.first_names ?? "")}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-900 to-ceiba-800 flex flex-col items-center justify-start text-white">
      {/* Header */}
      <div className="w-full flex items-center justify-center py-8 gap-2">
        <TreePine size={28} className="text-ceiba-300" />
        <span className="font-display text-2xl font-bold">Ceiba</span>
      </div>

      {/* Tarjeta principal */}
      <div className="w-full max-w-sm mx-auto px-4 flex flex-col gap-6 pb-12">

        {/* Inviter */}
        <div className="flex flex-col items-center gap-3 text-center">
          {inviter?.profile_photo_url ? (
            <Image
              src={inviter.profile_photo_url}
              alt={inviterName}
              width={72}
              height={72}
              className="rounded-full border-4 border-ceiba-400 object-cover"
            />
          ) : (
            <div className="w-18 h-18 rounded-full bg-ceiba-600 flex items-center justify-center">
              <Users size={32} className="text-ceiba-300" />
            </div>
          )}
          <p className="text-ceiba-200 text-sm">
            <span className="font-semibold text-white">{inviterName}</span> te invita a unirte al arbol familiar
          </p>
        </div>

        {/* Mensaje principal */}
        <div className="bg-white/10 rounded-2xl p-5 text-center">
          <Heart size={24} className="text-ceiba-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">
            {invited_person ? `Hola, ${invited_person.first_names}` : "Tu familia te espera"}
          </h1>
          <p className="text-ceiba-200 text-sm leading-relaxed">
            {invited_person
              ? `${inviterName} ya te tiene en el arbol. En 30 segundos puedes ver a toda la familia.`
              : "En 30 segundos puedes ver a toda la familia en un solo lugar."}
          </p>
        </div>

        {/* Preview del arbol */}
        {preview.count > 0 && (
          <div className="bg-white/10 rounded-2xl p-5">
            <p className="text-ceiba-200 text-xs mb-3 uppercase tracking-wide">
              Cuando entres vas a ver
            </p>
            <div className="flex flex-wrap gap-2">
              {preview.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  {m.profile_photo_url ? (
                    <Image
                      src={m.profile_photo_url}
                      alt={m.first_names}
                      width={24}
                      height={24}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-ceiba-600 flex items-center justify-center text-xs font-bold">
                      {m.first_names[0]}
                    </div>
                  )}
                  <span className="text-sm">{m.first_names}</span>
                </div>
              ))}
              {preview.count > preview.members.length && (
                <div className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-2 text-ceiba-200 text-sm">
                  +{preview.count - preview.members.length} mas
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={signupUrl}
          className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 active:bg-ceiba-600 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
          onClick={() => trackEvent("invite_converted", { invitation_id: data.invitation.id })}
        >
          Ver mi arbol familiar
          <ChevronRight size={20} />
        </Link>

        <p className="text-center text-ceiba-300 text-xs">
          Ya tienes cuenta?{" "}
          <Link href={`/auth/login?invite=${code}`} className="underline">
            Inicia sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
