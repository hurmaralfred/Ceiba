"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, TreePine, MapPin, Cake, Link as LinkIcon,
  MessageCircle, UserCheck, Calendar, Users, Share2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

interface MemberDetail {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  relation_type: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  added_at: string;
  profile_id: string | null;
  invite_token: string | null;
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    social_link: string | null;
    city: string | null;
    country: string | null;
    bio: string | null;
    created_at: string;
  } | null;
}

const RELATION_LABELS: Record<string, string> = {
  padre: "Padre", madre: "Madre", hijo: "Hijo", hija: "Hija",
  hermano: "Hermano", hermana: "Hermana", abuelo: "Abuelo", abuela: "Abuela",
  nieto: "Nieto", nieta: "Nieta", tío: "Tío", tía: "Tía",
  primo: "Primo", prima: "Prima", esposo: "Esposo", esposa: "Esposa",
  cónyuge: "Cónyuge", otro: "Familiar",
};

function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatBirthDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

function getDaysUntilBirthday(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const supabase = createClient();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { init(); }, [memberId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setMyUserId(user.id);

    const { data } = await supabase
      .from("family_members")
      .select("*")
      .eq("id", memberId)
      .eq("added_by", user.id)
      .maybeSingle();

    if (!data) { setNotFound(true); setLoading(false); return; }

    let profile = null;
    if (data.profile_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, social_link, city, country, bio, created_at")
        .eq("id", data.profile_id)
        .maybeSingle();
      profile = p;
    }

    setMember({ ...data, profile });
    setLoading(false);
  };

  const startDM = async () => {
    if (!member?.profile_id || !myUserId) return;

    const { data: myRooms } = await supabase
      .from("chat_room_members").select("room_id").eq("user_id", myUserId);
    const myRoomIds = (myRooms || []).map(r => r.room_id);

    if (myRoomIds.length > 0) {
      const { data: otherRooms } = await supabase
        .from("chat_room_members").select("room_id")
        .eq("user_id", member.profile_id).in("room_id", myRoomIds);
      const shared = (otherRooms || []).map(r => r.room_id);

      if (shared.length > 0) {
        const { data: rooms } = await supabase
          .from("chat_rooms").select("id").in("id", shared).eq("type", "direct");
        if (rooms && rooms.length > 0) { router.push(`/chat/${rooms[0].id}`); return; }
      }
    }

    const { data: room } = await supabase
      .from("chat_rooms").insert({ type: "direct", created_by: myUserId }).select("id").single();
    if (!room) return;
    await supabase.from("chat_room_members").insert([
      { room_id: room.id, user_id: myUserId },
      { room_id: room.id, user_id: member.profile_id },
    ]);
    router.push(`/chat/${room.id}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <Users size={48} className="text-gray-300" />
      <p className="text-gray-500">Familiar no encontrado</p>
      <Link href="/tree" className="btn-primary">Volver al árbol</Link>
    </div>
  );

  if (!member) return null;

  const displayName = member.profile
    ? `${member.profile.first_name} ${member.profile.last_name}`
    : `${member.first_name} ${member.last_name}`;

  const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarUrl = member.profile?.avatar_url;
  const isOnCeiba = !!member.profile_id;
  const relation = RELATION_LABELS[member.relation] || member.relation;

  const daysUntil = member.birth_date ? getDaysUntilBirthday(member.birth_date) : null;
  const birthdayLabel = daysUntil === 0 ? "🎉 ¡Hoy!" : daysUntil === 1 ? "🎂 Mañana" : daysUntil !== null ? `En ${daysUntil} días` : null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="font-display text-lg font-bold">Perfil familiar</div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">

        {/* Hero card */}
        <div className="card text-center">
          <div className="flex flex-col items-center gap-3">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full overflow-hidden bg-ceiba-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : initials}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <span className="inline-block mt-1 px-3 py-1 bg-ceiba-100 text-ceiba-800 text-sm font-semibold rounded-full">
                {relation}
              </span>
            </div>

            {/* Ceiba badge */}
            {isOnCeiba ? (
              <div className="flex items-center gap-1.5 text-ceiba-700 text-sm font-medium">
                <UserCheck size={16} /> En Ceiba
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs text-gray-400">Aún no se ha unido a Ceiba</div>
                {member.invite_token && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${member.first_name}, te guardé un lugar en el árbol familiar de Ceiba. Entra aquí 🌳: https://ceiba.app/para/${member.invite_token}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                  >
                    <Share2 size={15} /> Invitar por WhatsApp
                  </a>
                )}
              </div>
            )}

            {/* Action buttons */}
            {isOnCeiba && member.profile_id !== myUserId && (
              <button
                onClick={startDM}
                className="flex items-center gap-2 bg-ceiba-700 hover:bg-ceiba-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm mt-1"
              >
                <MessageCircle size={16} /> Enviar mensaje
              </button>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="card divide-y divide-gray-100">
          <h2 className="font-bold text-gray-800 pb-3">Información</h2>

          {member.birth_date && (
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Cake size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">{formatBirthDate(member.birth_date)}</div>
                <div className="text-xs text-gray-400">
                  {getAge(member.birth_date)} años
                  {birthdayLabel && <span className="ml-2 font-semibold text-amber-600">{birthdayLabel}</span>}
                </div>
              </div>
            </div>
          )}

          {(member.profile?.city || member.profile?.country) && (
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <MapPin size={16} />
              </div>
              <div className="text-sm font-medium text-gray-700">
                {[member.profile.city, member.profile.country].filter(Boolean).join(", ")}
              </div>
            </div>
          )}

          {member.profile?.social_link && (
            <div className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                <LinkIcon size={16} />
              </div>
              <a
                href={member.profile.social_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline truncate"
              >
                {member.profile.social_link.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            </div>
          )}

          <div className="flex items-center gap-3 py-3">
            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 flex-shrink-0">
              <Calendar size={16} />
            </div>
            <div className="text-xs text-gray-400">
              Agregado el {new Date(member.added_at || "").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Bio */}
        {member.profile?.bio && (
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-2">Sobre {member.profile.first_name}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{member.profile.bio}</p>
          </div>
        )}

        {/* Member since */}
        {member.profile?.created_at && (
          <div className="card flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-ceiba-50 flex items-center justify-center text-ceiba-700 flex-shrink-0">
              <TreePine size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-ceiba-700">Miembro de Ceiba</div>
              <div className="text-xs text-gray-400">
                Desde {new Date(member.profile.created_at).toLocaleDateString("es", { month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </main>
  );
}
