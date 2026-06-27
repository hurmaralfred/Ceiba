"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TreePine, Check, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refId = searchParams.get("ref");
  const supabase = createClient();

  const [referrer, setReferrer] = useState<any>(null);
  const [familyCount, setFamilyCount] = useState(0);
  const [joinedCount, setJoinedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!refId) { router.push("/"); return; }
    load();
  }, [refId]);

  const load = async () => {
    // Check if already logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Already has account — go to tree
      router.push("/tree");
      return;
    }

    // Load referrer profile
    const { data: p } = await supabase
      .from("profiles").select("first_name, last_name, avatar_url").eq("id", refId).single();
    setReferrer(p);

    // Count their family
    const { data: fam } = await supabase
      .from("family_members")
      .select("id, profile_id")
      .eq("added_by", refId);
    setFamilyCount((fam || []).length);
    setJoinedCount((fam || []).filter(m => m.profile_id).length);

    setLoading(false);
  };

  const handleJoin = () => {
    // Store ref so we can connect after registration
    if (refId) sessionStorage.setItem("join_ref", refId);
    router.push("/auth/register");
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  const familyName = referrer?.last_name || "";

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">

        {/* Brand */}
        <div className="text-center mb-4">
          <TreePine size={36} className="text-ceiba-300 mx-auto mb-2" />
          <h1 className="font-display text-3xl font-bold text-white">Ceiba</h1>
          <p className="text-ceiba-400 text-sm mt-1">El árbol de tu familia</p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-ceiba-800 to-ceiba-600 px-6 py-6 text-white text-center">
            {referrer?.avatar_url ? (
              <img src={referrer.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {referrer?.first_name?.[0]}{referrer?.last_name?.[0]}
              </div>
            )}
            <h2 className="text-xl font-bold">
              {referrer ? `${referrer.first_name} ${referrer.last_name}` : "Tu familiar"}
            </h2>
            <p className="text-ceiba-200 text-sm mt-1">
              te invita a conectar {familyName ? `la familia ${familyName}` : "el árbol familiar"}
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">

            {/* Stats */}
            {familyCount > 0 && (
              <div className="flex items-center justify-center gap-6 py-3 bg-gray-50 rounded-2xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-ceiba-700">{familyCount}</p>
                  <p className="text-xs text-gray-500">familiares</p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{joinedCount}</p>
                  <p className="text-xs text-gray-500">en Ceiba</p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">{familyCount - joinedCount}</p>
                  <p className="text-xs text-gray-500">por unirse</p>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="space-y-2">
              {[
                "Ve el árbol familiar completo",
                "Mapa con dónde vive cada familiar",
                "Chat familiar organizado por ramas",
                "Fotos e historias compartidas",
                "Gratis, siempre",
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-ceiba-100 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-ceiba-700" />
                  </div>
                  <span className="text-sm text-gray-700">{b}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleJoin}
              className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 mt-2"
            >
              <Users size={18} /> Unirme a la familia
            </button>

            <p className="text-center text-xs text-gray-400">
              ¿Ya tienes cuenta?{" "}
              <Link href="/auth/login" className="text-ceiba-600 font-medium">Inicia sesión</Link>
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

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
        <TreePine size={40} className="text-ceiba-300 animate-pulse" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
