"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Share2, Copy, ChevronLeft, MessageCircle, CheckCircle2, Clock, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyMember, Profile, RELATION_LABELS, RelationType } from "@/lib/types";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export default function InvitePage() {
  const router = useRouter();
  const supabase = createClient();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalJoined, setTotalJoined] = useState(0);
  const [generalLink, setGeneralLink] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Record<string, string>>({}); // memberId → token

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const { data: p } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const origin = window.location.origin;
    setGeneralLink(`${origin}/join?ref=${user.id}`);

    const { data } = await supabase
      .from("family_members")
      .select("*")
      .eq("added_by", user.id);

    const all = data || [];
    setMembers(all);
    setTotalJoined(all.filter(m => m.profile_id).length);

    // Pre-load existing invitation tokens
    const { data: invs } = await supabase
      .from("invitations")
      .select("family_member_id, token")
      .eq("invited_by", user.id)
      .eq("status", "pending");
    const map: Record<string, string> = {};
    (invs || []).forEach(i => { if (i.family_member_id) map[i.family_member_id] = i.token; });
    setPendingInvites(map);
  };

  const getOrCreateInvite = async (member: FamilyMember): Promise<string | null> => {
    if (!profile) return null;

    // Use existing token if available
    if (pendingInvites[member.id]) {
      return `${window.location.origin}/invite/${pendingInvites[member.id]}`;
    }

    const { data, error } = await supabase
      .from("invitations")
      .insert({
        invited_by: profile.id,
        family_member_id: member.id,
        email: member.email || null,
        relation_type: member.relation_type,
      })
      .select("token")
      .single();

    if (error || !data) { toast.error("Error generando enlace"); return null; }

    setPendingInvites(prev => ({ ...prev, [member.id]: data.token }));
    await supabase.from("family_members").update({ invitation_sent: true }).eq("id", member.id);
    setMembers(m => m.map(mem => mem.id === member.id ? { ...mem, invitation_sent: true } : mem));

    return `${window.location.origin}/invite/${data.token}`;
  };

  const shareOnWhatsApp = async (member: FamilyMember) => {
    const link = await getOrCreateInvite(member);
    if (!link) return;

    const relation = RELATION_LABELS[member.relation_type as RelationType] || member.relation_type;
    const familyName = profile?.last_name || "nuestra familia";
    const msg = `Hola ${member.first_name}! 👋\n\nTe invito a *Ceiba*, la app donde la familia ${familyName} se conecta en un árbol familiar.\n\nYa somos *${members.length} familiares* registrados${totalJoined > 0 ? ` y ${totalJoined} ya están en la app` : ""}. Apareces como mi *${relation.toLowerCase()}*.\n\n🌳 Únete aquí:\n${link}`;

    window.open(whatsappUrl(msg), "_blank");
  };

  const copyInviteLink = async (member: FamilyMember) => {
    const link = await getOrCreateInvite(member);
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success(`Enlace de ${member.first_name} copiado`);
  };

  const copyGeneralLink = async () => {
    await navigator.clipboard.writeText(generalLink);
    toast.success("Enlace general copiado");
  };

  const shareGeneralWhatsApp = () => {
    const familyName = profile?.last_name || "nuestra familia";
    const msg = `Hola! 🌳\n\nNuestra familia *${familyName}* está en *Ceiba*, una app para conectar el árbol familiar.\n\nSomos ${members.length} familiares registrados${totalJoined > 0 ? ` y ${totalJoined} ya están en la app` : ""}. ¡Únete!\n\n${generalLink}`;
    window.open(whatsappUrl(msg), "_blank");
  };

  const pending = members.filter(m => !m.profile_id && !m.invitation_sent);
  const invited = members.filter(m => !m.profile_id && m.invitation_sent);
  const joined  = members.filter(m => !!m.profile_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg sticky top-0 z-40">
        <Link href="/tree" className="text-ceiba-300 hover:text-white"><ChevronLeft size={22} /></Link>
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-300" /> Invitar familiares
        </div>
        {/* Progress chip */}
        {members.length > 0 && (
          <div className="ml-auto bg-white/15 rounded-full px-3 py-1 text-xs font-semibold">
            {totalJoined}/{members.length} en Ceiba
          </div>
        )}
      </nav>

      <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-5">

        {/* General link card */}
        <div className="bg-gradient-to-br from-ceiba-800 to-ceiba-600 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={16} className="text-ceiba-200" />
            <span className="text-xs font-semibold text-ceiba-200 uppercase tracking-wide">Tu enlace familiar</span>
          </div>
          <p className="font-bold text-lg mb-1">
            Familia {profile?.last_name || ""}
          </p>
          <p className="text-sm text-ceiba-200 mb-4">
            Cualquier familiar puede unirse con este link, aunque no lo tengas registrado.
          </p>
          <div className="flex gap-2">
            <button
              onClick={shareGeneralWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold rounded-xl py-2.5 text-sm active:scale-95 transition-transform"
            >
              <MessageCircle size={16} /> Compartir en WhatsApp
            </button>
            <button
              onClick={copyGeneralLink}
              className="bg-white/20 rounded-xl px-3 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Pending (never invited) */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3 px-1">
              Por invitar ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onWhatsApp={() => shareOnWhatsApp(m)}
                  onCopy={() => copyInviteLink(m)}
                  status="pending"
                />
              ))}
            </div>
          </section>
        )}

        {/* Already invited */}
        {invited.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-3 px-1">
              Invitados · esperando que entren ({invited.length})
            </h2>
            <div className="space-y-2">
              {invited.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onWhatsApp={() => shareOnWhatsApp(m)}
                  onCopy={() => copyInviteLink(m)}
                  status="invited"
                />
              ))}
            </div>
          </section>
        )}

        {/* Already joined */}
        {joined.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-400 mb-3 px-1 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-green-500" />
              Ya en Ceiba ({joined.length})
            </h2>
            <div className="space-y-2">
              {joined.map(m => (
                <MemberRow key={m.id} member={m} status="joined" />
              ))}
            </div>
          </section>
        )}

        {members.length === 0 && (
          <div className="card text-center py-12">
            <TreePine size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Agrega familiares al árbol primero para poder invitarlos.</p>
            <Link href="/tree" className="btn-primary">Ir al árbol</Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// ── Member Row ────────────────────────────────────────────────
function MemberRow({
  member, onWhatsApp, onCopy, status,
}: {
  member: FamilyMember;
  onWhatsApp?: () => void;
  onCopy?: () => void;
  status: "pending" | "invited" | "joined";
}) {
  const relation = RELATION_LABELS[member.relation_type as RelationType] || member.relation_type;
  const initials = `${member.first_name[0]}${member.last_name?.[0] || ""}`;

  return (
    <div className={`bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border ${
      status === "joined" ? "border-green-100 opacity-70" :
      status === "invited" ? "border-amber-100" : "border-gray-100"
    }`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
        status === "joined" ? "bg-green-100 text-green-700" :
        status === "invited" ? "bg-amber-100 text-amber-700" :
        "bg-gray-100 text-gray-600"
      }`}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">
          {member.first_name} {member.last_name || ""}
        </p>
        <p className="text-xs text-gray-400">{relation}</p>
      </div>

      {/* Actions */}
      {status === "joined" && (
        <CheckCircle2 size={18} className="text-green-500 shrink-0" />
      )}
      {status === "invited" && (
        <div className="flex items-center gap-2 shrink-0">
          <Clock size={14} className="text-amber-400" />
          <button onClick={onWhatsApp} className="text-[#25D366] border border-[#25D366]/30 rounded-lg px-2 py-1 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform">
            <MessageCircle size={11} /> Reenviar
          </button>
        </div>
      )}
      {status === "pending" && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onWhatsApp}
            className="flex items-center gap-1 bg-[#25D366] text-white rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-transform"
          >
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button
            onClick={onCopy}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg border border-gray-200"
          >
            <Copy size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
