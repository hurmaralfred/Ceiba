"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, Share2, Copy, ChevronLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FamilyMember, RELATION_LABELS } from "@/lib/types";
import toast from "react-hot-toast";

export default function InvitePage() {
  const router = useRouter();
  const supabase = createClient();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [generalLink, setGeneralLink] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      setUserId(user.id);
      setGeneralLink(`${window.location.origin}/join?ref=${user.id}`);

      const { data } = await supabase
        .from("family_members")
        .select("*")
        .eq("added_by", user.id)
        .is("profile_id", null);
      setMembers(data || []);
    };
    init();
  }, []);

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast.success("¡Enlace copiado!");
  };

  const sendInvite = async (member: FamilyMember) => {
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        invited_by: userId,
        family_member_id: member.id,
        email: member.email,
        relation_type: member.relation_type,
      })
      .select("token")
      .single();
    if (error) { toast.error("Error al generar invitación"); return; }
    const link = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(link);
    toast.success(`Enlace para ${member.first_name} copiado. ¡Compártelo!`);
    await supabase.from("family_members").update({ invitation_sent: true }).eq("id", member.id);
    setMembers(m => m.map(mem => mem.id === member.id ? { ...mem, invitation_sent: true } : mem));
  };

  const pendingMembers = members.filter(m => !m.invitation_sent);
  const invitedMembers = members.filter(m => m.invitation_sent);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white"><ChevronLeft size={22} /></Link>
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-300" /> Invitar familiares
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* General invite link */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-ceiba-100 rounded-xl flex items-center justify-center">
              <Share2 size={20} className="text-ceiba-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Tu enlace general</h3>
              <p className="text-xs text-gray-500">Cualquier familiar puede unirse con este link</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
            <span className="text-sm text-gray-600 flex-1 truncate">{generalLink}</span>
            <button onClick={() => copyLink(generalLink)} className="text-ceiba-700 hover:text-ceiba-900 flex-shrink-0">
              <Copy size={18} />
            </button>
          </div>
        </div>

        {/* Pending invites */}
        {pendingMembers.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">Por invitar ({pendingMembers.length})</h3>
            <div className="divide-y divide-gray-100">
              {pendingMembers.map(m => (
                <div key={m.id} className="py-3 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {m.first_name[0]}{m.last_name?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{m.first_name} {m.last_name}</div>
                    <div className="text-xs text-gray-400">{RELATION_LABELS[m.relation_type]}</div>
                    {!m.email && <div className="text-xs text-amber-500 mt-0.5">Sin correo registrado</div>}
                  </div>
                  <button
                    onClick={() => sendInvite(m)}
                    className="flex items-center gap-1 text-ceiba-700 border border-ceiba-200 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-ceiba-50 transition-colors flex-shrink-0"
                  >
                    <Send size={12} /> Invitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already invited */}
        {invitedMembers.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-500 mb-4 text-sm">Ya invitados ({invitedMembers.length})</h3>
            <div className="divide-y divide-gray-100">
              {invitedMembers.map(m => (
                <div key={m.id} className="py-3 flex items-center gap-4 opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {m.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-700 text-sm">{m.first_name} {m.last_name}</div>
                    <div className="text-xs text-gray-400">{RELATION_LABELS[m.relation_type]} · Invitado</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <div className="card text-center py-10">
            <Share2 size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Todos tus familiares ya están en Ceiba o no hay ninguno registrado aún.</p>
            <Link href="/tree" className="btn-primary mt-4 inline-block">Ver mi árbol</Link>
          </div>
        )}
      </div>
    </div>
  );
}
