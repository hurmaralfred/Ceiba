"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Check, X, Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, INVERSE_RELATION, BLOOD_RELATIONS, RelationType } from "@/lib/types";
import toast from "react-hot-toast";

interface FamilyPreviewMember {
  first_name: string;
  last_name: string | null;
  relation_type: string;
  profile_id: string | null;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [invitation, setInvitation] = useState<any>(null);
  const [inviter, setInviter] = useState<any>(null);
  const [familyPreview, setFamilyPreview] = useState<FamilyPreviewMember[]>([]);
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

    // Load a preview of the inviter's family (first 8 members)
    const { data: fam } = await supabase
      .from("family_members")
      .select("first_name, last_name, relation_type, profile_id")
      .eq("added_by", inv.invited_by)
      .limit(8);
    setFamilyPreview(fam || []);

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

      // 2. Inverse relation
      const inviterRelation = invitation.relation_type as RelationType;
      const myRelation: RelationType = INVERSE_RELATION[inviterRelation] || "other";
      const myRelationKind = BLOOD_RELATIONS.has(myRelation) ? "blood" : "affinity";

      // 3. Bidirectional relationship
      await supabase.from("relationships").upsert({
        profile_a: invitation.invited_by,
        profile_b: user.id,
        relation_from_a: inviterRelation,
        relation_from_b: myRelation,
        relation_kind: myRelationKind,
        confirmed: true,
      });

      // 4. Link family_member to profile
      if (invitation.family_member_id) {
        await supabase.from("family_members")
          .update({ profile_id: user.id })
          .eq("id", invitation.family_member_id);
      }

      // 5. Add inviter to MY family tree
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

      // 6. Generate suggestions
      const { data: myProfile } = await supabase
        .from("profiles").select("first_name, last_name").eq("id", user.id).single();

      supabase.rpc("generate_family_suggestions", {
        p_adder_id: invitation.invited_by,
        p_first_name: myProfile?.first_name || "",
        p_last_name: myProfile?.last_name || "",
        p_relation_type: inviterRelation,
        p_family_member_id: invitation.family_member_id,
      });

      supabase.rpc("generate_reverse_suggestions", {
        p_new_user_id: user.id,
        p_connector_id: invitation.invited_by,
        p_my_relation: myRelation,
      });

      // 7. Push + email al invitador
      if (myProfile) {
        const joinerName = `${myProfile.first_name} ${myProfile.last_name}`;
        const relLabel = RELATION_LABELS[inviterRelation] || inviterRelation;
        const secret = process.env.NEXT_PUBLIC_INTERNAL_SECRET || "";

        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": secret },
          body: JSON.stringify({ invitedBy: invitation.invited_by, joinerName, relationLabel: relLabel }),
        });

        fetch("/api/email/member-joined", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": secret },
          body: JSON.stringify({
            to: inviter?.email,
            ownerName: inviter?.first_name,
            joinerName,
            relationLabel: relLabel,
          }),
        });
      }

      toast.success("¡Conexión familiar confirmada! 🌳");
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

  const inviterRelation = RELATION_LABELS[invitation.relation_type as RelationType] || invitation.relation_type;
  const myRelation = INVERSE_RELATION[invitation.relation_type as RelationType] || "other";
  const myLabel = RELATION_LABELS[myRelation] || myRelation;
  const joinedCount = familyPreview.filter(m => m.profile_id).length;
  const totalCount = familyPreview.length;

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
              {inviter?.avatar_url ? (
                <img src={inviter.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30" />
              ) : (
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
                  {inviter?.first_name?.[0]}{inviter?.last_name?.[0]}
                </div>
              )}
              <div>
                <p className="text-ceiba-200 text-xs font-medium mb-0.5">Te invita</p>
                <h2 className="text-xl font-bold">{inviter?.first_name} {inviter?.last_name}</h2>
                <p className="text-ceiba-200 text-sm">Tu {myLabel.toLowerCase()}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">

            {/* Relation explain */}
            <div className="bg-ceiba-50 rounded-2xl px-4 py-3 border border-ceiba-100">
              <p className="text-sm text-ceiba-800">
                <span className="font-bold">{inviter?.first_name}</span> te ha registrado como su{" "}
                <span className="font-bold text-ceiba-700">{inviterRelation.toLowerCase()}</span> en su árbol familiar.
                Al aceptar, él aparecerá en tu árbol como tu{" "}
                <span className="font-bold text-ceiba-700">{myLabel.toLowerCase()}</span>.
              </p>
            </div>

            {/* Family preview */}
            {familyPreview.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users size={15} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Ya están en el árbol
                  </span>
                  {joinedCount > 0 && (
                    <span className="ml-auto text-xs text-green-600 font-semibold">
                      {joinedCount} en Ceiba
                    </span>
                  )}
                </div>

                {/* Mini tree preview */}
                <div className="grid grid-cols-4 gap-2">
                  {familyPreview.slice(0, 8).map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                        m.profile_id
                          ? "bg-green-100 text-green-700 ring-2 ring-green-400"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {m.first_name[0]}{m.last_name?.[0] || ""}
                      </div>
                      <span className="text-[9px] text-gray-500 text-center leading-tight truncate w-full text-center">
                        {m.first_name}
                      </span>
                    </div>
                  ))}
                </div>

                {totalCount > 0 && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    {totalCount} familiar{totalCount !== 1 ? "es" : ""} registrado{totalCount !== 1 ? "s" : ""}
                    {joinedCount > 0 ? ` · ${joinedCount} ya en Ceiba` : ""}
                  </p>
                )}
              </div>
            )}

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
            <div className="flex gap-3 pt-1">
              <button
                onClick={accept}
                disabled={accepting}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-base"
              >
                {accepting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Check size={18} /> Aceptar y unirme
                  </>
                )}
              </button>
              <Link href="/" className="flex items-center justify-center px-4 rounded-2xl border border-gray-200 text-gray-400 hover:bg-gray-50">
                <X size={18} />
              </Link>
            </div>

            <p className="text-center text-xs text-gray-400">
              Es gratis. Si no tienes cuenta, te llevamos a crear una.
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
