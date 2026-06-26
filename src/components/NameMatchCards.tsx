"use client";
import { useEffect, useState } from "react";
import { Check, X, UserCheck } from "lucide-react";
import { RELATION_LABELS, INVERSE_RELATION, RelationType } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

type NameMatch = {
  family_member_id: string;
  adder_id: string;
  adder_first_name: string;
  adder_last_name: string;
  relation_type: string;
  relation_kind: string;
};

export default function NameMatchCards({ onAccepted }: { onAccepted: () => void }) {
  const supabase = createClient();
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadMatches(); }, []);

  const loadMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    if (!profile?.first_name || !profile?.last_name) { setLoaded(true); return; }
    const { data } = await supabase.rpc("find_name_matches", {
      p_first_name: profile.first_name,
      p_last_name: profile.last_name,
      p_user_id: user.id,
    });
    setMatches(data || []);
    setLoaded(true);
  };

  const confirm = async (match: NameMatch) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setResponding(match.family_member_id);
    const { error } = await supabase.rpc("confirm_name_match", {
      p_family_member_id: match.family_member_id,
      p_user_id: user.id,
    });
    if (error) { toast.error(error.message); setResponding(null); return; }
    setMatches(prev => prev.filter(m => m.family_member_id !== match.family_member_id));
    setResponding(null);
    toast.success(`¡Conectado con ${match.adder_first_name}!`);
    onAccepted();
  };

  const dismiss = (family_member_id: string) => {
    setMatches(prev => prev.filter(m => m.family_member_id !== family_member_id));
  };

  if (!loaded || matches.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck size={16} className="text-blue-600" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Alguien te agregó antes de que entraras ({matches.length})
        </h2>
      </div>
      <div className="space-y-3">
        {matches.map(match => {
          const inverseRelation = INVERSE_RELATION[match.relation_type as RelationType] || "other";
          const relationLabel = RELATION_LABELS[match.relation_type as RelationType] || match.relation_type;
          const myLabel = RELATION_LABELS[inverseRelation as RelationType] || inverseRelation;
          return (
            <div key={match.family_member_id} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-semibold text-blue-800">
                  {match.adder_first_name} {match.adder_last_name}
                </span>{" "}
                te agregó como su{" "}
                <span className="font-semibold text-blue-700">{relationLabel}</span>
              </p>
              <p className="text-xs text-gray-400 mb-3">
                ¿Eres tú? Al confirmar aparecerás como su {relationLabel} y él/ella como tu {myLabel}.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => confirm(match)}
                  disabled={responding === match.family_member_id}
                  className="flex items-center gap-1 bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 flex-1 justify-center"
                >
                  <Check size={14} /> Sí, soy yo
                </button>
                <button
                  onClick={() => dismiss(match.family_member_id)}
                  disabled={responding === match.family_member_id}
                  className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors flex-1 justify-center"
                >
                  <X size={14} /> No soy yo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
