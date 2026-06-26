"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, MapPin, Users, Share2, LogOut, User, Mail, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RELATION_LABELS } from "@/lib/types";
import toast from "react-hot-toast";

export default function TreePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const [{ data: profileData }, { data: membersData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("family_members").select("*, profile:profiles(*)").eq("added_by", user.id),
    ]);

    setProfile(profileData);
    setMembers(membersData || []);
    setLoading(false);
  };

  const sendInvite = async (member: FamilyMember) => {
    if (!member.email) {
      toast.error("Este familiar no tiene correo registrado");
      return;
    }
    // In production, this would call a Supabase Edge Function to send the email
    // For now, generate the invite link and copy it
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        invited_by: profile!.id,
        family_member_id: member.id,
        email: member.email,
        relation_type: member.relation_type,
      })
      .select("token")
      .single();

    if (error) { toast.error("Error al generar invitación"); return; }

    const inviteLink = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("¡Enlace de invitación copiado! Compártelo con tu familiar.");

    // Mark as sent
    await supabase.from("family_members").update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq("id", member.id);
    loadData();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return <LoadingScreen />;

  const bloodMembers = members.filter(m => m.relation_kind === "blood");
  const affinityMembers = members.filter(m => m.relation_kind === "affinity");
  const joinedMembers = members.filter(m => m.profile_id);
  const pendingMembers = members.filter(m => !m.profile_id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <Link href="/tree" className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={24} className="text-ceiba-300" /> Ceiba
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/map" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <MapPin size={16} /> Mapa
          </Link>
          <Link href="/invite" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Share2 size={16} /> Invitar
          </Link>
          <Link href="/profile" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <User size={16} />
          </Link>
          <button onClick={logout} className="text-ceiba-400 hover:text-white transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile header */}
        {profile && (
          <div className="card mb-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-ceiba-700 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h1>
              {profile.city && <p className="text-gray-500 text-sm">{profile.city}{profile.country ? `, ${profile.country}` : ""}</p>}
              <div className="flex gap-3 mt-2 text-sm">
                <span className="text-ceiba-700 font-semibold">{members.length} familiares</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{joinedMembers.length} en Ceiba</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{pendingMembers.length} por unirse</span>
              </div>
            </div>
            <Link href="/invite" className="btn-primary text-sm flex items-center gap-2 flex-shrink-0">
              <Share2 size={16} /> Invitar
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Familiares directos" value={bloodMembers.length} color="ceiba" />
          <StatCard label="Familia política" value={affinityMembers.length} color="earth" />
          <StatCard label="En Ceiba" value={joinedMembers.length} color="blue" />
        </div>

        {/* Family list */}
        {members.length === 0 ? (
          <div className="card text-center py-12">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Tu árbol está vacío</h3>
            <p className="text-gray-400 mb-6">Agrega familiares para empezar a construir tu red.</p>
            <Link href="/onboarding" className="btn-primary">Agregar familiares</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {bloodMembers.length > 0 && (
              <MemberGroup title="Familia de sangre" members={bloodMembers} onInvite={sendInvite} kind="blood" />
            )}
            {affinityMembers.length > 0 && (
              <MemberGroup title="Familia política" members={affinityMembers} onInvite={sendInvite} kind="affinity" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap = {
    ceiba: "text-ceiba-700 bg-ceiba-50",
    earth: "text-earth-700 bg-earth-50",
    blue: "text-blue-700 bg-blue-50",
  } as Record<string, string>;
  return (
    <div className={`rounded-2xl p-4 ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}

function MemberGroup({ title, members, onInvite, kind }: {
  title: string; members: FamilyMember[]; onInvite: (m: FamilyMember) => void; kind: string;
}) {
  return (
    <div className="card">
      <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${kind === "blood" ? "bg-ceiba-500" : "bg-earth-500"}`} />
        {title}
      </h2>
      <div className="divide-y divide-gray-100">
        {members.map(m => (
          <div key={m.id} className="py-3 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              m.profile_id ? "bg-ceiba-700 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {m.first_name[0]}{m.last_name ? m.last_name[0] : ""}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{RELATION_LABELS[m.relation_type]}</span>
                {m.profile_id && <span className="text-ceiba-600 font-medium">· En Ceiba</span>}
                {m.invitation_sent && !m.profile_id && <span className="text-amber-600">· Invitado</span>}
              </div>
            </div>
            {!m.profile_id && (
              <button
                onClick={() => onInvite(m)}
                className="flex items-center gap-1 text-ceiba-700 hover:text-ceiba-900 text-xs font-semibold border border-ceiba-200 rounded-lg px-3 py-1.5 hover:bg-ceiba-50 transition-colors"
              >
                <Send size={12} /> {m.email ? "Invitar" : "Sin correo"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <TreePine size={40} className="text-ceiba-600 mx-auto mb-3 animate-pulse" />
        <p className="text-gray-500">Cargando tu árbol...</p>
      </div>
    </div>
  );
}
