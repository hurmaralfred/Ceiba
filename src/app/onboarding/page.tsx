"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TreePine, Plus, Trash2, ChevronRight, ChevronLeft, Check, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RelationType, RELATION_LABELS, INVERSE_RELATION } from "@/lib/types";
import toast from "react-hot-toast";

type FamilyEntry = {
  first_name: string;
  last_name: string;
  email: string;
  relation_type: RelationType;
};

type NameMatch = {
  family_member_id: string;
  adder_id: string;
  adder_first_name: string;
  adder_last_name: string;
  relation_type: string;
  relation_kind: string;
};

// Steps: 0=Profile, 1=NameMatches (conditional), 2=AddFamily, 3=Done
const STEPS = ["Tu perfil", "Conexiones", "Tu familia", "¡Listo!"];

const RELATION_GROUPS = [
  {
    label: "Familia directa (sangre)",
    kind: "blood" as const,
    options: ["father","mother","brother","sister","son","daughter","grandfather_paternal","grandmother_paternal","grandfather_maternal","grandmother_maternal","grandson","granddaughter","uncle","aunt","cousin"] as RelationType[],
  },
  {
    label: "Familia política (afinidad)",
    kind: "affinity" as const,
    options: ["spouse","partner","father_in_law","mother_in_law","brother_in_law","sister_in_law","stepfather","stepmother","stepchild"] as RelationType[],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");

  const [profile, setProfile] = useState({ bio: "", birth_year: "", city: "", country: "" });
  const [members, setMembers] = useState<FamilyEntry[]>([
    { first_name: "", last_name: "", email: "", relation_type: "father" },
  ]);

  // Name match step
  const [nameMatches, setNameMatches] = useState<NameMatch[]>([]);
  const [respondingMatch, setRespondingMatch] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUserId(data.user.id);
      // Load the user's name from their profile (set by trigger on registration)
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.user.id)
        .single();
      if (prof) {
        setUserFirstName(prof.first_name || "");
        setUserLastName(prof.last_name || "");
      }
    });
  }, []);

  const addMember = () => {
    setMembers(m => [...m, { first_name: "", last_name: "", email: "", relation_type: "mother" }]);
  };

  const removeMember = (i: number) => {
    setMembers(m => m.filter((_, idx) => idx !== i));
  };

  const updateMember = (i: number, field: keyof FamilyEntry, value: string) => {
    setMembers(m => m.map((mem, idx) => idx === i ? { ...mem, [field]: value } : mem));
  };

  const saveProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({
        bio: profile.bio,
        birth_year: profile.birth_year ? parseInt(profile.birth_year) : null,
        city: profile.city,
        country: profile.country,
      }).eq("id", userId);
      if (error) throw error;

      // Check for name matches
      if (userFirstName && userLastName) {
        const { data: matches } = await supabase.rpc("find_name_matches", {
          p_first_name: userFirstName,
          p_last_name: userLastName,
          p_user_id: userId,
        });
        if (matches && matches.length > 0) {
          setNameMatches(matches);
          setStep(1); // Show matches step
        } else {
          setStep(2); // Skip to add family
        }
      } else {
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmMatch = async (match: NameMatch) => {
    if (!userId) return;
    setRespondingMatch(match.family_member_id);
    try {
      const { error } = await supabase.rpc("confirm_name_match", {
        p_family_member_id: match.family_member_id,
        p_user_id: userId,
      });
      if (error) throw error;
      setNameMatches(prev => prev.filter(m => m.family_member_id !== match.family_member_id));
      toast.success(`¡Conectado con ${match.adder_first_name}!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRespondingMatch(null);
    }
  };

  const rejectMatch = (family_member_id: string) => {
    setNameMatches(prev => prev.filter(m => m.family_member_id !== family_member_id));
  };

  const saveFamily = async () => {
    if (!userId) return;
    const valid = members.filter(m => m.first_name.trim());
    if (valid.length === 0) {
      toast.error("Agrega al menos un familiar");
      return;
    }
    setLoading(true);
    try {
      const rows = valid.map(m => ({
        added_by: userId,
        first_name: m.first_name.trim(),
        last_name: m.last_name.trim() || null,
        email: m.email.trim() || null,
        relation_type: m.relation_type,
        relation_kind: RELATION_GROUPS[0].options.includes(m.relation_type) ? "blood" : "affinity",
      }));
      const { error } = await supabase.from("family_members").insert(rows);
      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Visual step index (0-based for the dots, skipping the conditional step)
  const visualStep = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : 3;
  const hasMatches = nameMatches.length > 0 || step === 1;
  const displaySteps = hasMatches ? STEPS : ["Tu perfil", "Tu familia", "¡Listo!"];
  const displayStep = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? (hasMatches ? 2 : 1) : (hasMatches ? 3 : 2);

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 text-white mb-2">
          <TreePine size={28} className="text-ceiba-300" />
          <span className="font-display text-2xl font-bold">Ceiba</span>
        </div>
        <p className="text-ceiba-300">Comencemos a construir tu árbol</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {displaySteps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < displayStep ? "bg-ceiba-400 text-white" :
              i === displayStep ? "bg-white text-ceiba-800" :
              "bg-white/20 text-white/50"
            }`}>
              {i < displayStep ? <Check size={16} /> : i + 1}
            </div>
            {i < displaySteps.length - 1 && (
              <div className={`w-10 h-0.5 ${i < displayStep ? "bg-ceiba-400" : "bg-white/20"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg card">
        {/* Step 0: Profile */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Cuéntanos un poco sobre ti</h2>
            <p className="text-gray-500 text-sm mb-4">Estos datos son opcionales pero ayudan a tus familiares a encontrarte.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año de nacimiento</label>
              <input type="number" className="input-field" placeholder="ej. 1985"
                value={profile.birth_year}
                onChange={e => setProfile(p => ({ ...p, birth_year: e.target.value }))}
                min="1900" max="2020"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" className="input-field" placeholder="Donde vives"
                value={profile.city}
                onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input type="text" className="input-field" placeholder="Tu país"
                value={profile.country}
                onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio (opcional)</label>
              <textarea className="input-field resize-none h-20" placeholder="Algo sobre ti..."
                value={profile.bio}
                onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={saveProfile} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? "Buscando conexiones..." : "Continuar"} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Name Matches */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-ceiba-100 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-ceiba-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">¡Alguien ya te conoce!</h2>
                <p className="text-gray-500 text-sm">Estas personas te agregaron antes de que te unieras.</p>
              </div>
            </div>

            {nameMatches.length > 0 ? (
              <div className="space-y-3 mb-6">
                {nameMatches.map(match => {
                  const inverseRelation = INVERSE_RELATION[match.relation_type as RelationType] || "other";
                  const relationLabel = RELATION_LABELS[match.relation_type as RelationType] || match.relation_type;
                  const myLabel = RELATION_LABELS[inverseRelation as RelationType] || inverseRelation;
                  return (
                    <div key={match.family_member_id} className="border border-ceiba-100 rounded-2xl p-4 bg-ceiba-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 bg-ceiba-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {match.adder_first_name[0]}{match.adder_last_name?.[0] || ""}
                            </div>
                            <span className="font-semibold text-gray-900">
                              {match.adder_first_name} {match.adder_last_name}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 ml-10">
                            te agregó como su{" "}
                            <span className="font-semibold text-ceiba-700">{relationLabel}</span>
                          </p>
                          <p className="text-xs text-gray-400 ml-10 mt-0.5">
                            Aparecerías en su árbol como su {relationLabel} y él/ella como tu {myLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => confirmMatch(match)}
                          disabled={respondingMatch === match.family_member_id}
                          className="flex-1 flex items-center justify-center gap-1 bg-ceiba-700 text-white text-sm font-bold py-2 rounded-xl hover:bg-ceiba-800 transition-colors disabled:opacity-50"
                        >
                          <Check size={16} /> Sí, soy yo
                        </button>
                        <button
                          onClick={() => rejectMatch(match.family_member_id)}
                          disabled={respondingMatch === match.family_member_id}
                          className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-600 text-sm font-bold py-2 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          No soy yo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-ceiba-50 rounded-2xl p-4 mb-6 text-center text-ceiba-700 font-medium">
                ¡Listo! Conexiones confirmadas.
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button onClick={() => setStep(2)} className="btn-primary flex items-center gap-2">
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Family */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Agrega a tus familiares</h2>
            <p className="text-gray-500 text-sm mb-5">
              Empieza con los que conoces. Después podrás invitarlos para que se unan y el árbol crezca solo.
            </p>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {members.map((member, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-600">Familiar {i + 1}</span>
                    {members.length > 1 && (
                      <button onClick={() => removeMember(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" className="input-field text-sm" placeholder="Nombre *"
                      value={member.first_name}
                      onChange={e => updateMember(i, "first_name", e.target.value)}
                    />
                    <input type="text" className="input-field text-sm" placeholder="Apellido"
                      value={member.last_name}
                      onChange={e => updateMember(i, "last_name", e.target.value)}
                    />
                  </div>
                  <input type="email" className="input-field text-sm" placeholder="Correo (para invitarlo)"
                    value={member.email}
                    onChange={e => updateMember(i, "email", e.target.value)}
                  />
                  <select
                    className="input-field text-sm"
                    value={member.relation_type}
                    onChange={e => updateMember(i, "relation_type", e.target.value as RelationType)}
                  >
                    {RELATION_GROUPS.map(group => (
                      <optgroup key={group.kind} label={group.label}>
                        {group.options.map(opt => (
                          <option key={opt} value={opt}>{RELATION_LABELS[opt]}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={addMember} className="mt-4 w-full border-2 border-dashed border-ceiba-300 rounded-xl py-3 text-ceiba-700 font-semibold flex items-center justify-center gap-2 hover:bg-ceiba-50 transition-colors">
              <Plus size={18} /> Agregar otro familiar
            </button>

            <div className="flex justify-between pt-4 mt-2">
              <button onClick={() => setStep(nameMatches.length > 0 ? 1 : 0)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button onClick={saveFamily} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? "Guardando..." : "Finalizar"} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-ceiba-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TreePine size={40} className="text-ceiba-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Tu árbol está listo!</h2>
            <p className="text-gray-500 mb-8">
              Ahora invita a tus familiares para que la red crezca. Cuantos más se unan, más conexiones descubrirás.
            </p>
            <div className="space-y-3">
              <button onClick={() => router.push("/tree")} className="btn-primary w-full">
                Ver mi árbol familiar
              </button>
              <button onClick={() => router.push("/invite")} className="btn-secondary w-full">
                Invitar familiares ahora
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
