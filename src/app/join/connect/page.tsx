"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TreePine, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, INVERSE_RELATION, BLOOD_RELATIONS, RelationType } from "@/lib/types";
import toast from "react-hot-toast";

const RELATION_GROUPS = [
  {
    label: "Familia directa (sangre)",
    options: [
      "father", "mother", "son", "daughter",
      "brother", "sister", "half_brother", "half_sister",
      "grandfather_paternal", "grandmother_paternal",
      "grandfather_maternal", "grandmother_maternal",
      "grandson", "granddaughter", "uncle", "aunt", "cousin",
      "nephew", "niece",
    ] as RelationType[],
  },
  {
    label: "Familia política (afinidad)",
    options: [
      "spouse", "partner",
      "father_in_law", "mother_in_law",
      "brother_in_law", "sister_in_law",
      "stepfather", "stepmother", "stepchild",
    ] as RelationType[],
  },
];

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refId = searchParams.get("ref");
  const supabase = createClient();

  const [referrer, setReferrer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // What the referrer IS to me (e.g., "father")
  const [myRelationToRef, setMyRelationToRef] = useState<RelationType>("father");

  useEffect(() => {
    if (!refId) { router.push("/onboarding"); return; }
    load();
  }, [refId]);

  const load = async () => {
    // Must be logged in at this point
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const { data: p } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", refId)
      .single();

    if (!p) {
      // Referrer not found — continue to onboarding normally
      sessionStorage.removeItem("join_ref");
      router.push("/onboarding");
      return;
    }
    setReferrer(p);
    setLoading(false);
  };

  const connect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !referrer) return;
    setSaving(true);

    try {
      // referrer's relation to ME is the inverse
      const referrerRelation: RelationType = INVERSE_RELATION[myRelationToRef] || "other";
      const kind = BLOOD_RELATIONS.has(myRelationToRef) ? "blood" : "affinity";

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user.id)
        .single();

      // 1. Add referrer to MY tree
      const { data: existingRef } = await supabase
        .from("family_members")
        .select("id")
        .eq("added_by", user.id)
        .eq("profile_id", referrer.id)
        .maybeSingle();

      if (!existingRef) {
        await supabase.from("family_members").insert({
          added_by: user.id,
          profile_id: referrer.id,
          first_name: referrer.first_name,
          last_name: referrer.last_name || null,
          relation_type: myRelationToRef,
          relation_kind: kind,
        });
      }

      // 2. Add ME to referrer's tree
      const { data: existingMe } = await supabase
        .from("family_members")
        .select("id")
        .eq("added_by", referrer.id)
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!existingMe) {
        await supabase.from("family_members").insert({
          added_by: referrer.id,
          profile_id: user.id,
          first_name: myProfile?.first_name || "",
          last_name: myProfile?.last_name || null,
          email: myProfile?.email || null,
          relation_type: referrerRelation,
          relation_kind: kind,
        });
      }

      // 3. Create bidirectional relationship record
      await supabase.from("relationships").upsert({
        profile_a: referrer.id,
        profile_b: user.id,
        relation_from_a: referrerRelation,
        relation_from_b: myRelationToRef,
        relation_kind: kind,
        confirmed: true,
      });

      // 4. Notify referrer via push
      if (myProfile) {
        const relLabel = RELATION_LABELS[referrerRelation] || referrerRelation;
        fetch("/api/push/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.NEXT_PUBLIC_INTERNAL_SECRET || "",
          },
          body: JSON.stringify({
            invitedBy: referrer.id,
            joinerName: `${myProfile.first_name} ${myProfile.last_name}`,
            relationLabel: relLabel,
            message: "se unió a Ceiba por tu link",
          }),
        }).catch(() => {});
      }

      // 5. Clean up
      sessionStorage.removeItem("join_ref");

      toast.success("¡Conectado! Bienvenido a tu árbol familiar 🌳");
      router.push("/onboarding");
    } catch (err: any) {
      toast.error(err.message || "Error al conectar");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    sessionStorage.removeItem("join_ref");
    router.push("/onboarding");
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  const refLabel = RELATION_LABELS[myRelationToRef] || myRelationToRef;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">

        {/* Brand */}
        <div className="text-center mb-2">
          <TreePine size={32} className="text-ceiba-300 mx-auto mb-2" />
          <h1 className="font-display text-2xl font-bold text-white">Un último paso</h1>
          <p className="text-ceiba-400 text-sm mt-1">Conecta tu árbol con el de {referrer.first_name}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Referrer header */}
          <div className="bg-gradient-to-r from-ceiba-800 to-ceiba-600 px-6 py-5 text-white flex items-center gap-4">
            {referrer.avatar_url ? (
              <img src={referrer.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
                {referrer.first_name?.[0]}{referrer.last_name?.[0]}
              </div>
            )}
            <div>
              <p className="text-ceiba-200 text-xs mb-0.5">Te invitó a Ceiba</p>
              <h2 className="text-xl font-bold">{referrer.first_name} {referrer.last_name}</h2>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Relation picker */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                ¿Cómo es{" "}
                <span className="text-ceiba-700">{referrer.first_name}</span>{" "}
                en relación a ti?
              </p>

              <div className="space-y-3">
                {RELATION_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map(rel => (
                        <button
                          key={rel}
                          onClick={() => setMyRelationToRef(rel)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                            myRelationToRef === rel
                              ? "bg-ceiba-700 text-white border-ceiba-700"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:border-ceiba-300 hover:text-ceiba-700"
                          }`}
                        >
                          {RELATION_LABELS[rel]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-ceiba-50 rounded-2xl px-4 py-3 border border-ceiba-100">
              <p className="text-sm text-ceiba-800">
                <span className="font-bold">{referrer.first_name}</span> aparecerá en tu árbol como tu{" "}
                <span className="font-bold text-ceiba-700">{refLabel.toLowerCase()}</span> y tú
                aparecerás en su árbol como{" "}
                <span className="font-bold text-ceiba-700">
                  {(RELATION_LABELS[INVERSE_RELATION[myRelationToRef]] || "familiar").toLowerCase()}
                </span>.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={skip}
                className="px-4 py-3 rounded-2xl border border-gray-200 text-gray-400 text-sm hover:bg-gray-50 transition-colors"
              >
                Saltar
              </button>
              <button
                onClick={connect}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-3"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Check size={17} /> Conectar con {referrer.first_name}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function JoinConnectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
        <TreePine size={40} className="text-ceiba-300 animate-pulse" />
      </div>
    }>
      <ConnectContent />
    </Suspense>
  );
}
