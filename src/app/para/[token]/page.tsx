"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Users, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";

interface InviteData {
  member: { first_name: string; last_name: string; relation_type: string };
  inviter: { first_name: string; last_name: string; avatar_url: string | null };
  joinedCount: number;
  totalCount: number;
  already_joined?: boolean;
}

function AvatarInitials({ name, src, size = 16 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (src) {
    return <img src={src} alt={name} className={`w-${size} h-${size} rounded-2xl object-cover`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold text-white`}>
      {initials}
    </div>
  );
}

export default function ParaTokenPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();

  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const acceptedRef = useRef(false);

  useEffect(() => { init(); }, [token]);

  const init = async () => {
    // Load invite data
    const res = await fetch(`/api/para/${token}`);
    if (!res.ok) { router.push("/"); return; }
    const json = await res.json();
    if (json.already_joined) { router.push("/tree"); return; }
    setData(json);

    // Check if user is already logged in → auto-accept
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !acceptedRef.current) {
      acceptedRef.current = true;
      await acceptInvite(session.access_token);
      return;
    }

    setLoading(false);
  };

  const acceptInvite = async (accessToken: string) => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/para/${token}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success || json.already_joined) {
        router.push("/tree");
      } else {
        setAccepting(false);
        setLoading(false);
      }
    } catch {
      setAccepting(false);
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("para_token", token);
    }
    router.push(`/auth/register?para=${token}`);
  };

  if (loading || accepting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex flex-col items-center justify-center gap-4">
        <TreePine size={44} className="text-ceiba-300 animate-pulse" />
        {accepting && <p className="text-ceiba-300 text-sm">Conectando con tu familia…</p>}
      </div>
    );
  }

  if (!data) return null;

  const { member, inviter, joinedCount, totalCount } = data;
  const inviterName = `${inviter.first_name} ${inviter.last_name}`.trim();
  const memberName = member.first_name;
  const relationLabel = RELATION_LABELS[member.relation_type as RelationType] ?? member.relation_type;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-5">

        {/* Brand */}
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TreePine size={26} className="text-ceiba-300" />
            <span className="font-display text-2xl font-bold text-white">Ceiba</span>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Inviter banner */}
          <div className="bg-gradient-to-br from-ceiba-800 to-ceiba-600 px-6 py-6 text-white">
            <div className="flex items-center gap-4 mb-4">
              {inviter.avatar_url ? (
                <img src={inviter.avatar_url} alt={inviterName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg">
                  {inviterName.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
              )}
              <div>
                <p className="text-ceiba-200 text-xs font-medium mb-0.5">Mensaje de</p>
                <p className="text-xl font-bold leading-tight">{inviterName}</p>
              </div>
            </div>

            {/* Personalized message */}
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <p className="text-white text-sm leading-relaxed">
                <span className="font-bold">{memberName}</span>, te guardé un lugar en el árbol familiar como{" "}
                <span className="font-bold text-ceiba-200">mi {relationLabel.toLowerCase()}</span>.{" "}
                Únete y ve toda la familia.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
            <div className="py-4 text-center">
              <p className="text-2xl font-bold text-ceiba-700">{totalCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">familiares registrados</p>
            </div>
            <div className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">{joinedCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">ya en Ceiba</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="px-6 py-5 space-y-3">
            {[
              "Ve el árbol familiar completo",
              "Mapa en tiempo real de la familia",
              "Fotos e historias compartidas",
              "Gratis, siempre",
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-ceiba-100 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-ceiba-700" />
                </div>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}

            {/* CTA */}
            <button
              onClick={handleJoin}
              className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 mt-2"
            >
              <Users size={18} /> Reclamar mi lugar en el árbol
            </button>

            <p className="text-center text-xs text-gray-400">
              ¿Ya tienes cuenta?{" "}
              <Link href={`/auth/login?next=/para/${token}`} className="text-ceiba-600 font-medium">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-ceiba-400 text-xs">
          Ceiba es privado. Solo tu familia puede ver tu información.
        </p>
      </div>
    </main>
  );
}
