"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, INVERSE_RELATION, BLOOD_RELATIONS, RelationType } from "@/lib/types";
import toast from "react-hot-toast";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [invitation, setInvitation] = useState<any>(null);
  const [inviter, setInviter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => { loadInvitation(); }, []);

  const loadInvitation = async () => {
    const { data: inv } = await supabase
      .from("invitations")
      .select("*, invited_by_profile:profiles!invited_by(*)")
      .eq("token", params.token)
      .single();

    if (!inv || inv.status !== "pending") {
      toast.error("Esta invitación no es válida o ya fue usada");
      router.push("/");
      return;
    }
    setInvitation(inv);
    setInviter(inv.invited_by_profile);
    setLoading(false);
  };

  const accept = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      sessionStorage.setItem("pending_invite", params.token as string);
      router.push("/auth/register");
      return;
    }
    setAccepting(true);
    try {
      // 1. Mark invitation accepted
      await supabase.from("invitations").update({
        status: "accepted",
        accepted_by: user.id,
      }).eq("token", params.token);

      // 2. Determine inverse relation
      const inviterRelation = invitation.relation_type as RelationType;
      const myRelation: RelationType = INVERSE_RELATION[inviterRelation] || "other";
      const myRelationKind = BLOOD_RELATIONS.has(myRelation) ? "blood" : "affinity";

      // 3. Create bidirectional relationship
      await supabase.from("relationships").upsert({
        profile_a: invitation.invited_by,
        profile_b: user.id,
        relation_from_a: inviterRelation,
        relation_from_b: myRelation,
        relation_kind: myRelationKind,
        confirmed: true,
      });

      // 4. Link family_member record to the new profile
      if (invitation.family_member_id) {
        await supabase.from("family_members")
          .update({ profile_id: user.id })
          .eq("id", invitation.family_member_id);
      }

      // 5. KEY FIX: Add inviter to MY family members so they appear in my tree
      const { data: existingMember } = await supabase
        .from("family_members")
        .select("id")
        .eq("added_by", user.id)
        .eq("profile_id", invitation.invited_by)
        .single();

      if (!existingMember) {
        await supabase.from("family_members").insert({
          added_by: user.id,
          profile_id: invitation.invited_by,
          first_name: inviter.first_name,
          last_name: inviter.last_name,
          email: inviter.email,
          relation_type: myRelation,
          relation_kind: myRelationKind,
        });
      }

      // 6. Bidirectional suggestions
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      // Forward: suggest acceptor to inviter's network
      supabase.rpc("generate_family_suggestions", {
        p_adder_id: invitation.invited_by,
        p_first_name: myProfile?.first_name || "",
        p_last_name: myProfile?.last_name || "",
        p_relation_type: inviterRelation,
        p_family_member_id: invitation.family_member_id,
      }).catch(() => {});
      // Reverse: suggest inviter's family to acceptor
      supabase.rpc("generate_reverse_suggestions", {
        p_new_user_id: user.id,
        p_connector_id: invitation.invited_by,
        p_my_relation: myRelation,
      }).catch(() => {});

      // 7. Send push notification to inviter

      if (myProfile) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.NEXT_PUBLIC_INTERNAL_SECRET || "",
          },
          body: JSON.stringify({
            invitedBy: invitation.invited_by,
            joinerName: `${myProfile.first_name} ${myProfile.last_name}`,
            relationLabel: RELATION_LABELS[inviterRelation] || inviterRelation,
          }),
        }).catch(() => {});
      }

      toast.success("¡Conexión familiar confirmada!");
      router.push("/tree");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  const relationLabel = RELATION_LABELS[invitation.relation_type as RelationType] || invitation.relation_type;
  const myRelation = INVERSE_RELATION[invitation.relation_type as RelationType] || "other";
  const myLabel = RELATION_LABELS[myRelation] || myRelation;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <TreePine size={48} className="text-ceiba-300 mx-auto mb-3" />
          <h1 className="font-display text-3xl font-bold text-white">Ceiba</h1>
        </div>

        <div className="card text-center">
          <div className="w-16 h-16 bg-ceiba-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {inviter?.first_name?.[0]}{inviter?.last_name?.[0]}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {inviter?.first_name} {inviter?.last_name}
          </h2>
          <p className="text-gray-500 mb-2">
            te invita a conectar como{" "}
            <span className="font-semibold text-ceiba-700">{relationLabel}</span> suyo en Ceiba.
          </p>
          <div className="bg-ceiba-50 rounded-xl px-4 py-3 mb-6 text-sm text-ceiba-800">
            Al aceptar, {inviter?.first_name} aparecerá en tu árbol como tu{" "}
            <span className="font-bold">{myLabel}</span>.
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-600">
            Ceiba conecta lazos familiares, cerca o lejos. Es completamente gratis.
          </div>

          <div className="flex gap-3">
            <button
              onClick={accept}
              disabled={accepting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Check size={18} /> {accepting ? "Conectando..." : "Aceptar y unirme"}
            </button>
            <Link href="/" className="btn-secondary flex items-center justify-center gap-2 px-4">
              <X size={18} />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Si aún no tienes cuenta, te llevaremos a crear una gratis.
          </p>
        </div>
      </div>
    </main>
  );
}
