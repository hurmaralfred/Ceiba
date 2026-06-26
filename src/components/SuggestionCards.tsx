"use client";
import { useEffect, useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import { RELATION_LABELS, RelationshipSuggestion } from "@/lib/types";
import toast from "react-hot-toast";

export default function SuggestionCards({ onAccepted }: { onAccepted: () => void }) {
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => { loadSuggestions(); }, []);

  const loadSuggestions = async () => {
    const res = await fetch("/api/suggestions");
    if (res.ok) setSuggestions(await res.json());
  };

  const respond = async (s: RelationshipSuggestion, status: "accepted" | "rejected") => {
    setResponding(s.id);
    await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "respond",
        id: s.id,
        status,
        first_name: s.first_name,
        last_name: s.last_name,
        relation_type: s.suggested_relation,
        relation_kind: s.suggested_relation_kind,
        family_member_id: s.family_member_id,
      }),
    });
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
    setResponding(null);
    if (status === "accepted") {
      toast.success(`${s.first_name} agregado a tu árbol`);
      onAccepted();
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-ceiba-600" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Posibles familiares ({suggestions.length})
        </h2>
      </div>
      <div className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="bg-white border border-ceiba-100 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-ceiba-700">{s.suggested_by_name}</span> agregó a:
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{s.first_name} {s.last_name}</p>
                <p className="text-xs text-gray-500">
                  ¿Es tu <span className="font-semibold text-ceiba-700">
                    {RELATION_LABELS[s.suggested_relation] || s.suggested_relation}
                  </span>?
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => respond(s, "accepted")}
                  disabled={responding === s.id}
                  className="flex items-center gap-1 bg-ceiba-700 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-ceiba-800 transition-colors"
                >
                  <Check size={14} /> Sí
                </button>
                <button
                  onClick={() => respond(s, "rejected")}
                  disabled={responding === s.id}
                  className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X size={14} /> No
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
