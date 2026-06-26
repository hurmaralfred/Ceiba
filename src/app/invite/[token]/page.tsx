"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS } from "@/lib/types";
import toast from "react-hot-toast";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [invitation, setInvitation] = useState<any>(null);
  const [inviter, setInviter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, []);

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
      // Save token in sessionStorage and redirect to register
      sessionStorage.setItem("pending_invite", params.token as string);
      router.push("/auth/register");
      return;
    }
    setAccepting(true);
    try {
      // Mark invitation as accepted
      await supabase.from("invitations").update({
        status: "accepted",
        accepted_by: user.id,
      }).eq("token", params.token);

      // Create relationship between the two users
      const inverseMap: Record<string, string> = {
        father: "son", mother: "daughter", son: "father", daughter: "mother",
        brother: "brother", sister: "sister", spouse: "spouse", partner: "partner",
        grandfather_paternal: "grandson", grandfather_maternal: "grandson",
        grandmother_paternal: "granddaughter", grandmother_maternal: "granddaughter",
        uncle: "nephew", aunt: "niece", cousin: "cousin",
        father_in_law: "son_in_law", mother_in_law: "son_in_law",
        brother_in_law: "brother_in_law", sister_in_law: "sister_in_law",
        stepfather: "stepchild", stepmother: "stepchild", stepchild: "stepparent",
        other: "other",
      };
      await supabase.from("relationships").upsert({
        profile_a: invitation.invited_by,
        profile_b: user.id,
        relation_from_a: invitation.relation_type,
        relation_from_b: inverseMap[invitation.relation_type] || "other",
        relation_kind: "blood",
        confirmed: true,
      });

      // Link family member record to the new profile
      if (invitation.family_member_id) {
        await supabase.from("family_members").update({ profile_id: user.id }).eq("id", invitation.family_member_id);
      }

      // Send push notification to the inviter
      const joinerProfile = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single();
      if (joinerProfile.data) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.NEXT_PUBLIC_INTERNAL_SECRET || "",
          },
          body: JSON.stringify({
            invitedBy: invitation.invited_by,
            joinerName: `${joinerProfile.data.first_name} ${joinerProfile.data.last_name}`,
            relationLabel: RELATION_LABELS[invitation.relation_type as keyof typeof RELATION_LABELS] || invitation.relation_type,
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {inviter?.first_name} {inviter?.last_name}
          </h2>
          <p className="text-gray-500 mb-6">
            te invita a conectar como{" "}
            <span className="font-semibold text-ceiba-700">
              {RELATION_LABELS[invitation.relation_type as keyof typeof RELATION_LABELS] || invitation.relation_type}
            </span>{" "}
            en su árbol familiar.
          </p>

          <div className="bg-ceiba-50 rounded-xl p-4 mb-6 text-sm text-ceiba-800">
            Ceiba es una app para conectar y descubrir lazos familiares, cerca o lejos.
            Es completamente gratis.
          </div>

          <div className="flex gap-3">
            <button onClick={accept} disabled={accepting} className="btn-primary flex-1 flex items-center justify-center gap-2">
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
