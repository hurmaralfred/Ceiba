"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TreePine, Plus, Trash2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RelationType, RELATION_LABELS } from "@/lib/types";
import toast from "react-hot-toast";

type FamilyEntry = {
  first_name: string;
  last_name: string;
  email: string;
  relation_type: RelationType;
};

const STEPS = ["Tu perfil", "Tu familia", "¡Listo!"];

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

  const [profile, setProfile] = useState({ bio: "", birth_year: "", city: "", country: "" });
  const [members, setMembers] = useState<FamilyEntry[]>([
    { first_name: "", last_name: "", email: "", relation_type: "father" },
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setUserId(data.user.id);
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
      setStep(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
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
      setStep(2);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < step ? "bg-ceiba-400 text-white" :
              i === step ? "bg-white text-ceiba-800" :
              "bg-white/20 text-white/50"
            }`}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-10 h-0.5 ${i < step ? "bg-ceiba-400" : "bg-white/20"}`} />
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
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Family */}
        {step === 1 && (
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
              <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button onClick={saveFamily} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? "Guardando..." : "Finalizar"} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
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
