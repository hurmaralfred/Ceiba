"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TreePine, Plus, Trash2, ChevronRight, ChevronLeft, Check, Users, Network } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RelationType, RELATION_LABELS, INVERSE_RELATION } from "@/lib/types";
import toast from "react-hot-toast";

type FamilyEntry = {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  relation_type: RelationType;
  is_deceased: boolean;
  parent_member_id: string;
};

type NameMatch = {
  family_member_id: string;
  adder_id: string;
  adder_first_name: string;
  adder_last_name: string;
  relation_type: string;
  relation_kind: string;
};

const RELATION_GROUPS = [
  {
    label: "Familia directa (sangre)",
    kind: "blood" as const,
    options: [
      "father","mother","brother","sister","half_brother","half_sister",
      "son","daughter","nephew","niece",
      "grandfather_paternal","grandmother_paternal",
      "grandfather_maternal","grandmother_maternal",
      "grandson","granddaughter","uncle","aunt","cousin",
    ] as RelationType[],
  },
  {
    label: "Familia política (afinidad)",
    kind: "affinity" as const,
    options: [
      "spouse","partner","father_in_law","mother_in_law",
      "brother_in_law","sister_in_law","stepfather","stepmother","stepchild",
    ] as RelationType[],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  // Step: 0=Profile, 1=NameMatches, 2=AddFamily (only if no matches), 3=Done
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");

  const [profile, setProfile] = useState({ bio: "", birth_year: "", city: "", country: "" });
  const [members, setMembers] = useState<FamilyEntry[]>([
    { first_name: "", last_name: "", email: "", birth_date: "", relation_type: "father", is_deceased: false, parent_member_id: "" },
  ]);

  const [nameMatches, setNameMatches] = useState<NameMatch[]>([]);
  const [respondingMatch, setRespondingMatch] = useState<string | null>(null);
  const [confirmedMatches, setConfirmedMatches] = useState<NameMatch[]>([]); // confirmed in this session

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUserId(data.user.id);
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

  // ── Step 0 → 1 ────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await supabase.from("profiles").update({
        bio: profile.bio,
        birth_year: profile.birth_year ? parseInt(profile.birth_year) : null,
        city: profile.city,
        country: profile.country,
      }).eq("id", userId);

      if (userFirstName) {
        const { data: matches } = await supabase.rpc("find_name_matches", {
          p_first_name: userFirstName,
          p_last_name: userLastName || "",
          p_user_id: userId,
        });
        if (matches && matches.length > 0) {
          setNameMatches(matches);
          setStep(1);
        } else {
          setStep(2); // no matches → manual add family
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

  // ── Confirm a match ────────────────────────────────────────────────────────
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
      setConfirmedMatches(prev => [...prev, match]);
      toast.success(`¡Conectado con ${match.adder_first_name}!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRespondingMatch(null);
    }
  };

  const rejectMatch = (id: string) => {
    setNameMatches(prev => prev.filter(m => m.family_member_id !== id));
  };

  // ── After reviewing all matches ────────────────────────────────────────────
  // If user confirmed ≥1 match → tree is already partially built → skip "add family"
  const continueAfterMatches = () => {
    if (confirmedMatches.length > 0) {
      setStep(3); // skip manual add → Done
    } else {
      setStep(2); // no matches confirmed → ask to add family manually
    }
  };

  // ── Step 2: Manual add family ──────────────────────────────────────────────
  const addMember = () => {
    setMembers(m => [...m, { first_name: "", last_name: "", email: "", birth_date: "", relation_type: "mother", is_deceased: false, parent_member_id: "" }]);
  };
  const removeMember = (i: number) => setMembers(m => m.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: keyof FamilyEntry, value: string | boolean) =>
    setMembers(m => m.map((mem, idx) => idx === i ? { ...mem, [field]: value } : mem));

  const saveFamily = async () => {
    if (!userId) return;
    const valid = members.filter(m => m.first_name.trim());
    if (valid.length === 0) { toast.error("Agrega al menos un familiar"); return; }
    setLoading(true);
    try {
      const rows = valid.map(m => ({
        added_by: userId,
        first_name: m.first_name.trim(),
        last_name: m.last_name.trim() || null,
        email: m.email.trim() || null,
        birth_date: m.birth_date || null,
        relation_type: m.relation_type,
        relation_kind: RELATION_GROUPS[0].options.includes(m.relation_type) ? "blood" : "affinity",
        is_deceased: m.is_deceased,
        parent_member_id: m.parent_member_id || null,
        person_id: crypto.randomUUID(),
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 text-white mb-2">
          <TreePine size={28} className="text-ceiba-300" />
          <span className="font-display text-2xl font-bold">Ceiba</span>
        </div>
        <p className="text-ceiba-300">
          {step === 0 && "Cuéntanos sobre ti"}
          {step === 1 && "Tu familia ya está aquí"}
          {step === 2 && "Empieza tu árbol"}
          {step === 3 && "¡Bienvenido a Ceiba!"}
        </p>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2].map(i => {
          // Compactar: si no hay matches ni se mostró paso 1, skip dot de matches
          const dots = nameMatches.length > 0 || step === 1 || confirmedMatches.length > 0
            ? ["Perfil", "Conexiones", "Listo"]
            : ["Perfil", "Tu familia", "Listo"];
          const currentDot = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 1 : 2;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < currentDot ? "bg-ceiba-400 text-white" :
                i === currentDot ? "bg-white text-ceiba-800" :
                "bg-white/20 text-white/50"
              }`}>
                {i < currentDot ? <Check size={14} /> : dots[i][0]}
              </div>
              {i < 2 && <div className={`w-10 h-0.5 ${i < currentDot ? "bg-ceiba-400" : "bg-white/20"}`} />}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-lg card">

        {/* ── STEP 0: Profile ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Hola, {userFirstName || "bienvenido"}</h2>
            <p className="text-gray-500 text-sm mb-4">
              Vamos a verificar si ya estás en el árbol de alguien en Ceiba — puede que tu familia ya te esté esperando.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año de nacimiento</label>
              <input type="number" className="input-field" placeholder="ej. 1985"
                value={profile.birth_year}
                onChange={e => setProfile(p => ({ ...p, birth_year: e.target.value }))}
                min="1900" max="2020"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio <span className="text-gray-400 font-normal">(opcional)</span></label>
              <textarea className="input-field resize-none h-16" placeholder="Algo sobre ti..."
                value={profile.bio}
                onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={saveProfile} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? "Buscando tu familia..." : "Continuar"} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Name Matches ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-ceiba-100 rounded-2xl flex items-center justify-center shrink-0">
                <Network size={22} className="text-ceiba-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">¡Tu familia ya te conoce!</h2>
                <p className="text-gray-500 text-sm">
                  {nameMatches.length > 0
                    ? `${nameMatches.length + confirmedMatches.length} familiar${nameMatches.length + confirmedMatches.length > 1 ? "es te añadieron" : " te añadió"} antes de que llegaras.`
                    : confirmedMatches.length > 0
                    ? `Confirmaste ${confirmedMatches.length} conexión${confirmedMatches.length > 1 ? "es" : ""}. ¡Tu árbol ya está tomando forma!`
                    : ""}
                </p>
              </div>
            </div>

            {/* Confirmed this session */}
            {confirmedMatches.length > 0 && (
              <div className="mb-4 bg-green-50 border border-green-100 rounded-2xl p-3 space-y-1">
                {confirmedMatches.map(m => (
                  <div key={m.family_member_id} className="flex items-center gap-2 text-sm text-green-800">
                    <Check size={14} className="text-green-600 shrink-0" />
                    <span>
                      Conectado con <strong>{m.adder_first_name} {m.adder_last_name}</strong> como su{" "}
                      <strong>{RELATION_LABELS[m.relation_type as RelationType] || m.relation_type}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Pending matches */}
            {nameMatches.length > 0 ? (
              <div className="space-y-3 mb-6">
                {nameMatches.map(match => {
                  const inverseRelation = INVERSE_RELATION[match.relation_type as RelationType] || "other";
                  const relationLabel = RELATION_LABELS[match.relation_type as RelationType] || match.relation_type;
                  const myLabel = RELATION_LABELS[inverseRelation as RelationType] || inverseRelation;
                  return (
                    <div key={match.family_member_id} className="border border-ceiba-100 rounded-2xl p-4 bg-ceiba-50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-9 h-9 bg-ceiba-700 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {match.adder_first_name[0]}{match.adder_last_name?.[0] || ""}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {match.adder_first_name} {match.adder_last_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            te añadió como su <span className="font-medium text-ceiba-700">{relationLabel}</span>
                            {" "}→ él/ella sería tu <span className="font-medium text-ceiba-700">{myLabel}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Si confirmas, su árbol familiar se conecta al tuyo automáticamente.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmMatch(match)}
                          disabled={respondingMatch === match.family_member_id}
                          className="flex-1 flex items-center justify-center gap-1 bg-ceiba-700 text-white text-sm font-bold py-2 rounded-xl hover:bg-ceiba-800 transition-colors disabled:opacity-50"
                        >
                          <Check size={15} /> Sí, soy yo
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
              // All matches reviewed
              <div className={`rounded-2xl p-4 mb-6 text-center ${
                confirmedMatches.length > 0
                  ? "bg-green-50 border border-green-100"
                  : "bg-gray-50 border border-gray-100"
              }`}>
                {confirmedMatches.length > 0 ? (
                  <>
                    <p className="font-semibold text-green-800 mb-1">¡Tu árbol ya tiene conexiones!</p>
                    <p className="text-sm text-green-700">
                      Confirmaste {confirmedMatches.length} vínculo{confirmedMatches.length > 1 ? "s" : ""} familiar{confirmedMatches.length > 1 ? "es" : ""}.
                      Tu familia en Ceiba puede ver que ya llegaste.
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">Ninguna conexión confirmada. Puedes agregar tu familia manualmente.</p>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button
                onClick={continueAfterMatches}
                disabled={nameMatches.length > 0 && confirmedMatches.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-40"
              >
                {nameMatches.length > 0
                  ? "Revisar primero las sugerencias"
                  : confirmedMatches.length > 0
                  ? "Ver mi árbol →"
                  : "Agregar familia manualmente"}
                {nameMatches.length === 0 && <ChevronRight size={18} />}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Manual add family (only shown when no matches confirmed) ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Empieza tu árbol</h2>
            <p className="text-gray-500 text-sm mb-5">
              Agrega a tus familiares. Cuando ellos se registren con el mismo nombre,
              Ceiba los reconocerá y conectará sus árboles automáticamente.
            </p>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
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
                    <input type="text" className="input-field text-sm" placeholder="Nombre(s) *"
                      value={member.first_name}
                      onChange={e => updateMember(i, "first_name", e.target.value)}
                    />
                    <input type="text" className="input-field text-sm" placeholder="Apellido(s)"
                      value={member.last_name}
                      onChange={e => updateMember(i, "last_name", e.target.value)}
                    />
                  </div>

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

                  {(member.relation_type === "nephew" || member.relation_type === "niece") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        ¿Hijo/a de cuál hermano/a? <span className="text-gray-400 font-normal">(opcional)</span>
                      </label>
                      <select
                        className="input-field text-sm"
                        value={member.parent_member_id}
                        onChange={e => updateMember(i, "parent_member_id", e.target.value)}
                      >
                        <option value="">— No especificar —</option>
                        {members
                          .filter((m, idx) => idx !== i && ["brother","sister","half_brother","half_sister"].includes(m.relation_type) && m.first_name.trim())
                          .map((s, si) => (
                            <option key={si} value={`__onb_${si}`}>
                              {s.first_name} {s.last_name || ""}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fecha de nac.</label>
                      <input type="date" className="input-field text-sm"
                        value={member.birth_date}
                        onChange={e => updateMember(i, "birth_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Correo (para invitar)</label>
                      <input type="email" className="input-field text-sm" placeholder="correo@ejemplo.com"
                        value={member.email}
                        onChange={e => updateMember(i, "email", e.target.value)}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" className="sr-only"
                        checked={member.is_deceased}
                        onChange={e => updateMember(i, "is_deceased", e.target.checked)}
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors ${member.is_deceased ? "bg-gray-500" : "bg-gray-200"}`} />
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${member.is_deceased ? "translate-x-4" : ""}`} />
                    </div>
                    <span className="text-xs text-gray-600">
                      Fallecido(a) <span className="text-gray-400">— aparece con † en el árbol</span>
                    </span>
                  </label>
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

        {/* ── STEP 3: Done ───────────────────────────────────────────────────── */}
        {step === 3 && (
          <DoneStep
            confirmedCount={confirmedMatches.length}
            onTree={() => router.push("/tree")}
            onInvite={() => router.push("/invite")}
            onAddMore={() => setStep(2)}
          />
        )}
      </div>
    </main>
  );
}

function DoneStep({
  confirmedCount,
  onTree,
  onInvite,
  onAddMore,
}: {
  confirmedCount: number;
  onTree: () => void;
  onInvite: () => void;
  onAddMore: () => void;
}) {
  useEffect(() => {
    fetch("/api/email/welcome", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="text-center py-4">
      <div className="w-20 h-20 bg-ceiba-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <TreePine size={40} className="text-ceiba-600" />
      </div>
      {confirmedCount > 0 ? (
        <>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Tu árbol ya creció!</h2>
          <p className="text-gray-500 mb-2">
            Confirmaste <strong className="text-ceiba-700">{confirmedCount} conexión{confirmedCount > 1 ? "es" : ""} familiar{confirmedCount > 1 ? "es" : ""}</strong>.
            Tu familia ya puede verte en sus árboles.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            A medida que más familiares se registren, el árbol crece automáticamente.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Tu árbol está listo!</h2>
          <p className="text-gray-500 mb-6">
            Invita a tus familiares — cuando se registren con el mismo nombre,
            Ceiba los conectará automáticamente a tu árbol.
          </p>
        </>
      )}
      <div className="space-y-3">
        <button onClick={onTree} className="btn-primary w-full py-3">
          Ver mi árbol familiar
        </button>
        {confirmedCount > 0 && (
          <button onClick={onAddMore} className="btn-secondary w-full py-3">
            Agregar más familiares
          </button>
        )}
        <button onClick={onInvite} className={`w-full py-3 ${confirmedCount > 0 ? "text-sm text-ceiba-600 underline" : "btn-secondary"}`}>
          Invitar familiares por WhatsApp
        </button>
      </div>
    </div>
  );
}
