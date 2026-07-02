"use client";
/**
 * FamilyDiscoveryWizard
 *
 * Wizard encadenado de descubrimiento familiar:
 * 1. Arranca con find_name_matches → "¿Eres el hermano de Hugo?"
 * 2. Al confirmar, carga el árbol de esa persona y propone su familia
 *    con la relación inferida → "Hugo tiene un hijo. ¿Es tu sobrino?"
 * 3. Encadena hasta profundidad 2 para relaciones cercanas.
 * 4. Maneja padrastro/madrastra automáticamente.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Check, X, HelpCircle, ChevronRight, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  RelationType, RELATION_LABELS, INVERSE_RELATION, BLOOD_RELATIONS,
} from "@/lib/types";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function reverseRel(rel: string): string {
  const map: Record<string, string> = {
    father: "son", mother: "son", son: "father", daughter: "mother",
    brother: "brother", sister: "sister",
    half_brother: "half_brother", half_sister: "half_sister",
    spouse: "spouse", partner: "partner",
    uncle: "nephew", aunt: "niece",
    nephew: "uncle", niece: "aunt",
    cousin: "cousin",
    grandfather_paternal: "grandson", grandmother_paternal: "grandson",
    grandfather_maternal: "grandson", grandmother_maternal: "grandson",
    grandson: "grandfather_paternal", granddaughter: "grandmother_paternal",
    father_in_law: "son", mother_in_law: "son",
    brother_in_law: "brother_in_law", sister_in_law: "sister_in_law",
    stepfather: "stepchild", stepmother: "stepchild", stepchild: "stepfather",
  };
  return map[rel] ?? rel;
}

function inferRel(parentRel: string, childRel: string): string | null {
  switch (parentRel) {
    case "spouse": case "partner":
      if (childRel === "son")       return "son";
      if (childRel === "daughter")  return "daughter";
      if (childRel === "stepchild") return "stepchild";
      if (["brother","half_brother"].includes(childRel)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRel))   return "sister_in_law";
      if (childRel === "father")    return "father_in_law";
      if (childRel === "mother")    return "mother_in_law";
      if (childRel === "nephew")    return "nephew";
      if (childRel === "niece")     return "niece";
      break;
    case "brother": case "sister": case "half_brother": case "half_sister":
      if (childRel === "son")       return "nephew";
      if (childRel === "daughter")  return "niece";
      if (childRel === "stepchild") return "nephew";
      if (["father","stepfather"].includes(childRel))   return "father";
      if (["mother","stepmother"].includes(childRel))   return "mother";
      if (["brother","half_brother"].includes(childRel)) return "brother";
      if (["sister","half_sister"].includes(childRel))   return "sister";
      if (["uncle","father_in_law"].includes(childRel)) return "uncle";
      if (["aunt","mother_in_law"].includes(childRel))  return "aunt";
      if (["spouse","partner"].includes(childRel))      return "brother_in_law";
      if (childRel === "cousin")   return "cousin";
      if (childRel === "nephew")   return "nephew";
      if (childRel === "niece")    return "niece";
      break;
    case "brother_in_law": case "sister_in_law":
      if (childRel === "son")       return "nephew";
      if (childRel === "daughter")  return "niece";
      if (["brother","half_brother"].includes(childRel)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRel))   return "sister_in_law";
      if (["spouse","partner"].includes(childRel))       return "brother_in_law";
      if (childRel === "father")    return "father_in_law";
      if (childRel === "mother")    return "mother_in_law";
      break;
    case "father": case "stepfather":
      if (childRel === "son")       return "brother";
      if (childRel === "daughter")  return "sister";
      if (childRel === "stepchild") return "brother";
      if (["brother","half_brother"].includes(childRel)) return "uncle";
      if (["sister","half_sister"].includes(childRel))   return "aunt";
      // Father's parents = PATERNAL grandparents
      if (childRel === "father")    return "grandfather_paternal";
      if (childRel === "mother")    return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRel)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRel)) return "grandmother_paternal";
      if (["spouse","partner"].includes(childRel)) return "stepmother";
      if (childRel === "nephew")    return "cousin";
      if (childRel === "niece")     return "cousin";
      if (childRel === "cousin")    return "cousin";
      if (childRel === "uncle")     return "uncle";
      if (childRel === "aunt")      return "aunt";
      break;
    case "mother": case "stepmother":
      if (childRel === "son")       return "brother";
      if (childRel === "daughter")  return "sister";
      if (childRel === "stepchild") return "brother";
      if (["brother","half_brother"].includes(childRel)) return "uncle";
      if (["sister","half_sister"].includes(childRel))   return "aunt";
      // Mother's parents = MATERNAL grandparents
      if (childRel === "father")    return "grandfather_maternal";
      if (childRel === "mother")    return "grandmother_maternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRel)) return "grandfather_maternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRel)) return "grandmother_maternal";
      if (["spouse","partner"].includes(childRel)) return "stepfather";
      if (childRel === "nephew")    return "cousin";
      if (childRel === "niece")     return "cousin";
      if (childRel === "cousin")    return "cousin";
      if (childRel === "uncle")     return "uncle";
      if (childRel === "aunt")      return "aunt";
      break;
    case "father_in_law": case "mother_in_law":
      if (["brother","half_brother"].includes(childRel)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRel))   return "sister_in_law";
      if (childRel === "son")       return "brother_in_law";
      if (childRel === "daughter")  return "sister_in_law";
      break;
    case "cousin":
      if (childRel === "son" || childRel === "daughter") return "cousin";
      if (childRel === "stepchild") return "cousin";
      if (["brother","half_brother","sister","half_sister"].includes(childRel)) return "cousin";
      if (["spouse","partner"].includes(childRel)) return "cousin";
      if (childRel === "father")   return "uncle";
      if (childRel === "mother")   return "aunt";
      if (childRel === "uncle")    return "uncle";
      if (childRel === "aunt")     return "aunt";
      break;
    case "son": case "daughter": case "stepchild":
      if (childRel === "son")       return "grandson";
      if (childRel === "daughter")  return "granddaughter";
      if (["spouse","partner"].includes(childRel)) return "son";
      break;
    case "uncle": case "aunt":
      if (childRel === "son" || childRel === "daughter") return "cousin";
      if (childRel === "stepchild") return "cousin";
      if (["brother","half_brother"].includes(childRel)) return "uncle";
      if (["sister","half_sister"].includes(childRel))   return "aunt";
      if (["spouse","partner"].includes(childRel)) return parentRel === "uncle" ? "aunt" : "uncle";
      if (childRel === "father")    return "grandfather_paternal";
      if (childRel === "mother")    return "grandmother_paternal";
      break;
    case "grandfather_paternal": case "grandfather_maternal":
    case "grandmother_paternal": case "grandmother_maternal":
      if (childRel === "son")       return "uncle";
      if (childRel === "daughter")  return "aunt";
      if (childRel === "stepchild") return "uncle";
      if (childRel === "grandson")  return "uncle";
      if (childRel === "granddaughter") return "aunt";
      if (["brother","half_brother"].includes(childRel)) return "uncle";
      if (["sister","half_sister"].includes(childRel))   return "aunt";
      if (childRel === "father")    return "grandfather_paternal";
      if (childRel === "mother")    return "grandmother_paternal";
      break;
    case "nephew": case "niece":
      if (childRel === "son")       return "nephew";
      if (childRel === "daughter")  return "niece";
      if (["father","stepfather"].includes(childRel)) return "brother";
      if (["mother","stepmother"].includes(childRel)) return "sister";
      if (childRel === "uncle")     return "brother";
      if (childRel === "aunt")      return "sister";
      if (["brother","half_brother"].includes(childRel)) return "nephew";
      if (["sister","half_sister"].includes(childRel))   return "niece";
      if (childRel === "cousin")    return "cousin";
      break;
    case "grandson": case "granddaughter":
      if (childRel === "son")       return "grandson";
      if (childRel === "daughter")  return "granddaughter";
      break;
  }
  return null;
}

// Relations worth traversing at depth > 0
const DEEP_TRAVERSE = new Set([
  "father","mother","stepfather","stepmother",
  "grandfather_paternal","grandfather_maternal",
  "grandmother_paternal","grandmother_maternal",
  "uncle","aunt","brother","sister","half_brother","half_sister",
  "brother_in_law","sister_in_law","father_in_law","mother_in_law",
]);

// Alternate relation options for ambiguous cases
// Covers: gender ambiguity (hijo/hija), step vs bio, half-siblings
const ALT_RELATIONS: Partial<Record<string, { label: string; relation: RelationType }[]>> = {
  // Género ambiguo — no sabemos si el usuario es hombre o mujer
  father:       [{ label: "Padre", relation: "father" },       { label: "Madre", relation: "mother" }],
  mother:       [{ label: "Madre", relation: "mother" },       { label: "Padre", relation: "father" }],
  son:          [{ label: "Hijo", relation: "son" },           { label: "Hija", relation: "daughter" }],
  daughter:     [{ label: "Hija", relation: "daughter" },      { label: "Hijo", relation: "son" }],
  grandson:     [{ label: "Nieto", relation: "grandson" },     { label: "Nieta", relation: "granddaughter" }],
  granddaughter:[{ label: "Nieta", relation: "granddaughter"}, { label: "Nieto", relation: "grandson" }],
  nephew:       [{ label: "Sobrino", relation: "nephew" },     { label: "Sobrina", relation: "niece" }],
  niece:        [{ label: "Sobrina", relation: "niece" },      { label: "Sobrino", relation: "nephew" }],
  uncle:        [{ label: "Tío", relation: "uncle" },          { label: "Tía", relation: "aunt" }],
  aunt:         [{ label: "Tía", relation: "aunt" },           { label: "Tío", relation: "uncle" }],
  brother:      [{ label: "Hermano", relation: "brother" },    { label: "Hermana", relation: "sister" }, { label: "Medio hermano", relation: "half_brother" }],
  sister:       [{ label: "Hermana", relation: "sister" },     { label: "Hermano", relation: "brother" }, { label: "Media hermana", relation: "half_sister" }],
  // Padrastro/madrastra vs padre/madre biológico
  stepmother:   [{ label: "Madrastra", relation: "stepmother" }, { label: "Madre", relation: "mother" }],
  stepfather:   [{ label: "Padrastro", relation: "stepfather" }, { label: "Padre", relation: "father" }],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ProposalSource = "name_match" | "discovery";

interface Proposal {
  id: string;
  source: ProposalSource;
  // For name_match: family_members.id that has this user's name
  familyMemberId?: string;
  // The person being proposed
  personProfileId: string | null;  // null = not in Ceiba yet
  personFirstName: string;
  personLastName: string | null;
  // Suggested relation FROM ME to this person
  suggestedRelation: string;
  // Context: "Según Hugo Hurtado..."
  connectorName: string;
  connectorProfileId: string;
  // How the connector relates to ME (so we can discover further)
  connectorRelationToMe: string;
  depth: number;
}

interface Props {
  userId: string;
  myFirstName: string;
  myLastName: string | null;
  onDone: (confirmedCount: number) => void;
  onSkip: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FamilyDiscoveryWizard({
  userId, myFirstName, myLastName, onDone, onSkip,
}: Props) {
  const supabase = createClient();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [done, setDone] = useState(false);
  const [altRelation, setAltRelation] = useState<string | null>(null);

  // Track who we've already proposed / traversed to avoid cycles
  const seenProfileIds = useRef(new Set<string>([userId]));
  const seenNameKeys = useRef(new Set<string>());
  const myTreeProfileIds = useRef(new Set<string>());

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);

    // Load my existing tree so we don't propose duplicates
    const { data: myTree } = await supabase
      .from("family_members")
      .select("profile_id, first_name, last_name")
      .eq("added_by", userId);

    for (const m of myTree || []) {
      if (m.profile_id) myTreeProfileIds.current.add(m.profile_id);
      seenNameKeys.current.add(normKey(m.first_name, m.last_name));
    }

    // Find name matches
    const { data: matches } = await supabase.rpc("find_name_matches", {
      p_first_name: myFirstName,
      p_last_name:  myLastName || "",
      p_user_id:    userId,
    });

    const initial: Proposal[] = (matches || []).map((m: any) => ({
      id: crypto.randomUUID(),
      source: "name_match" as const,
      familyMemberId:    m.family_member_id,
      personProfileId:   m.adder_id,  // the adder IS the person we're connecting with
      personFirstName:   m.adder_first_name,
      personLastName:    m.adder_last_name,
      suggestedRelation: inverseRelation(m.relation_type),
      connectorName:     m.adder_first_name,
      connectorProfileId: m.adder_id,
      connectorRelationToMe: inverseRelation(m.relation_type),
      depth: 0,
    }));

    setProposals(initial);
    setLoading(false);
  };

  function normKey(fn: string, ln: string | null) {
    const norm = (s: string) => (s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().split(" ")[0];
    return `${norm(fn)}|${norm(ln || "")}`;
  }

  function inverseRelation(rel: string): string {
    const inv: Record<string, string> = {
      father: "son", mother: "son", son: "father", daughter: "mother",
      brother: "brother", sister: "sister",
      half_brother: "half_brother", half_sister: "half_sister",
      nephew: "uncle", niece: "aunt", uncle: "nephew", aunt: "niece",
      cousin: "cousin", spouse: "spouse", partner: "partner",
      grandfather_paternal: "grandson", grandmother_paternal: "grandson",
      grandfather_maternal: "grandson", grandmother_maternal: "grandson",
      grandson: "grandfather_paternal", granddaughter: "grandmother_paternal",
      father_in_law: "son", mother_in_law: "son",
      brother_in_law: "brother_in_law", sister_in_law: "sister_in_law",
      stepfather: "stepchild", stepmother: "stepchild", stepchild: "stepfather",
    };
    return inv[rel] ?? rel;
  }

  // ── Discover family of a confirmed person ───────────────────────────────────
  const discoverFamily = useCallback(async (
    confirmedProfileId: string,
    myRelationToThem: string,
    connectorName: string,
    depth: number,
  ) => {
    if (depth >= 2) return;

    const { data: theirFamily } = await supabase
      .from("family_members")
      .select("id, profile_id, first_name, last_name, relation_type, relation_kind")
      .eq("added_by", confirmedProfileId);

    const newProposals: Proposal[] = [];

    for (const member of theirFamily || []) {
      // Skip myself
      if (member.profile_id === userId) continue;

      // Skip if already in my tree
      if (member.profile_id && myTreeProfileIds.current.has(member.profile_id)) continue;
      if (seenProfileIds.current.has(member.profile_id || "")) continue;

      const nameKey = normKey(member.first_name, member.last_name);
      if (seenNameKeys.current.has(nameKey)) continue;

      // Compute MY relation to this member
      const inferred = inferRel(myRelationToThem, member.relation_type);
      if (!inferred || inferred === "other") continue;

      // Mark as seen to avoid proposing twice
      if (member.profile_id) seenProfileIds.current.add(member.profile_id);
      seenNameKeys.current.add(nameKey);

      newProposals.push({
        id: crypto.randomUUID(),
        source: "discovery",
        familyMemberId: member.id,
        personProfileId: member.profile_id || null,
        personFirstName: member.first_name,
        personLastName:  member.last_name || null,
        suggestedRelation: inferred,
        connectorName,
        connectorProfileId: confirmedProfileId,
        connectorRelationToMe: myRelationToThem,
        depth,
      });
    }

    if (newProposals.length > 0) {
      setProposals(prev => [...prev, ...newProposals]);
    }
  }, [userId, supabase]);

  // ── Confirm a proposal ──────────────────────────────────────────────────────
  const confirm = useCallback(async (proposal: Proposal, overrideRelation?: string) => {
    setResponding(true);
    const relation = (overrideRelation ?? proposal.suggestedRelation) as RelationType;
    const kind = BLOOD_RELATIONS.has(relation) ? "blood" : "affinity";
    const inverse = INVERSE_RELATION[relation] ?? relation;

    try {
      if (proposal.source === "name_match" && proposal.familyMemberId) {
        // Confirm the name match (links the record + creates reciprocal)
        await supabase.rpc("confirm_name_match", {
          p_family_member_id: proposal.familyMemberId,
          p_user_id: userId,
        });
        // Also ensure we have a clean record in MY tree for them
        const { data: existing } = await supabase
          .from("family_members")
          .select("id")
          .eq("added_by", userId)
          .eq("profile_id", proposal.personProfileId)
          .maybeSingle();

        if (!existing && proposal.personProfileId) {
          await supabase.from("family_members").insert({
            added_by: userId,
            profile_id: proposal.personProfileId,
            first_name: proposal.personFirstName,
            last_name: proposal.personLastName || null,
            relation_type: relation,
            relation_kind: kind,
            person_id: proposal.personProfileId,
          });
        }
      } else {
        // Discovery: add to MY tree
        const upsertData: any = {
          added_by: userId,
          first_name: proposal.personFirstName,
          last_name: proposal.personLastName || null,
          relation_type: relation,
          relation_kind: kind,
          person_id: proposal.personProfileId ?? crypto.randomUUID(),
        };
        if (proposal.personProfileId) upsertData.profile_id = proposal.personProfileId;

        await supabase.from("family_members").insert(upsertData);

        // Add reciprocal if they're in Ceiba
        if (proposal.personProfileId) {
          const { data: existingRec } = await supabase
            .from("family_members")
            .select("id")
            .eq("added_by", proposal.personProfileId)
            .eq("profile_id", userId)
            .maybeSingle();

          if (!existingRec) {
            await supabase.from("family_members").insert({
              added_by: proposal.personProfileId,
              profile_id: userId,
              first_name: myFirstName,
              last_name: myLastName || null,
              relation_type: inverse,
              relation_kind: kind,
              person_id: userId,
            });
          }
        }
      }

      // Track confirmed person
      if (proposal.personProfileId) {
        myTreeProfileIds.current.add(proposal.personProfileId);
      }

      setConfirmedCount(c => c + 1);

      // Discover their family (if they're in Ceiba and relation is worth traversing)
      if (proposal.personProfileId && DEEP_TRAVERSE.has(relation)) {
        await discoverFamily(
          proposal.personProfileId,
          relation,
          proposal.personFirstName,
          proposal.depth + 1,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar");
    } finally {
      setResponding(false);
      setAltRelation(null);
      advance();
    }
  }, [userId, myFirstName, myLastName, supabase, discoverFamily]);

  // ── Skip a proposal ─────────────────────────────────────────────────────────
  const skip = useCallback(() => {
    setAltRelation(null);
    advance();
  }, []);

  const advance = useCallback(() => {
    setCurrentIdx(prev => {
      const next = prev + 1;
      return next;
    });
  }, []);

  // Check if wizard is done
  const current = proposals[currentIdx];
  const isDone = !loading && currentIdx >= proposals.length;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-ceiba-950/95 flex flex-col items-center justify-center px-6">
        <div className="w-8 h-8 border-2 border-ceiba-400/30 border-t-ceiba-300 rounded-full animate-spin mb-4" />
        <p className="text-ceiba-300 text-sm">Buscando tus conexiones...</p>
      </div>
    );
  }

  if (isDone || proposals.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-ceiba-950/95 flex flex-col items-center justify-center px-6 text-center">
        <div className="bg-ceiba-800/60 border border-ceiba-700/40 rounded-3xl p-8 max-w-sm w-full">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} className="text-green-400" />
          </div>
          {confirmedCount > 0 ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">
                ¡Tu árbol creció!
              </h2>
              <p className="text-ceiba-300 text-sm mb-6">
                Conectaste con <span className="text-white font-bold">{confirmedCount} familiar{confirmedCount > 1 ? "es" : ""}</span>.
                Tu árbol se construyó automáticamente.
              </p>
            </>
          ) : proposals.length === 0 ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">
                Sin conexiones por ahora
              </h2>
              <p className="text-ceiba-300 text-sm mb-6">
                Cuando alguien te agregue a su árbol, aparecerá aquí.
                Por ahora agrega a tu familia manualmente.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">
                Listo por ahora
              </h2>
              <p className="text-ceiba-300 text-sm mb-6">
                Puedes seguir conectando familiares desde tu árbol cuando quieras.
              </p>
            </>
          )}
          <button
            onClick={() => onDone(confirmedCount)}
            className="w-full bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold py-3 rounded-2xl transition-colors"
          >
            Ver mi árbol
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const relLabel = RELATION_LABELS[current.suggestedRelation as RelationType] ?? current.suggestedRelation;
  const alts = ALT_RELATIONS[current.suggestedRelation];
  const displayRelation = altRelation ?? current.suggestedRelation;
  const displayLabel = RELATION_LABELS[displayRelation as RelationType] ?? displayRelation;

  const progress = Math.round((currentIdx / Math.max(proposals.length, 1)) * 100);
  const remaining = proposals.length - currentIdx;

  return (
    <div className="fixed inset-0 z-50 bg-ceiba-950/97 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-safe pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-ceiba-400" />
            <span className="text-ceiba-300 text-xs font-medium uppercase tracking-wide">
              Descubriendo tu familia
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-ceiba-500 text-xs hover:text-ceiba-300 transition-colors"
          >
            Saltar por ahora
          </button>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-ceiba-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-ceiba-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-ceiba-500 text-xs mt-1.5 text-right">
          {remaining} {remaining === 1 ? "conexión" : "conexiones"} por confirmar
        </p>
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-6">
        <div className="w-full max-w-sm">
          {/* Person card */}
          <div className="bg-ceiba-900/80 border border-ceiba-700/40 rounded-3xl overflow-hidden shadow-2xl">

            {/* Context header */}
            <div className="bg-ceiba-800/60 px-5 py-3 border-b border-ceiba-700/30">
              <p className="text-ceiba-400 text-xs">
                {current.source === "name_match"
                  ? `${current.connectorName} ya te agregó a su árbol`
                  : `Familiar de ${current.connectorName}`
                }
              </p>
            </div>

            {/* Person info */}
            <div className="px-5 py-6 text-center">
              {/* Avatar placeholder */}
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: `hsl(${nameHue(current.personFirstName)}, 45%, 30%)` }}
              >
                {current.personFirstName[0]?.toUpperCase()}
                {current.personLastName?.[0]?.toUpperCase()}
              </div>

              <h2 className="text-xl font-bold text-white mb-1">
                {current.personFirstName} {current.personLastName}
              </h2>

              {/* Relation question */}
              <div className="mt-4 mb-2">
                <p className="text-ceiba-300 text-sm mb-2">
                  {current.source === "name_match"
                    ? `¿Es ${current.personFirstName} tu...?`
                    : `${current.connectorName} tiene ${articleFor(current.suggestedRelation)} ${relLabel.toLowerCase()}. ¿Es tuyo/a también?`
                  }
                </p>

                {/* Relation badge */}
                <div className="inline-flex items-center gap-2 bg-ceiba-700/40 border border-ceiba-600/30 rounded-full px-4 py-2 mb-1">
                  <span className="text-lg">{emojiFor(displayRelation)}</span>
                  <span className="text-white font-bold text-base">{displayLabel}</span>
                </div>

                {/* Alt relation selector (e.g., padre vs padrastro) */}
                {alts && alts.length > 1 && (
                  <div className="flex justify-center gap-2 mt-2 flex-wrap">
                    {alts.map(alt => (
                      <button
                        key={alt.relation}
                        onClick={() => setAltRelation(
                          altRelation === alt.relation ? null : alt.relation
                        )}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          (altRelation ?? current.suggestedRelation) === alt.relation
                            ? "bg-ceiba-600 border-ceiba-500 text-white"
                            : "bg-transparent border-ceiba-700 text-ceiba-400 hover:border-ceiba-500"
                        }`}
                      >
                        {alt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-5 pb-6 grid grid-cols-3 gap-2">
              {/* No */}
              <button
                onClick={skip}
                disabled={responding}
                className="flex flex-col items-center gap-1.5 bg-red-900/30 border border-red-800/40 text-red-400 rounded-2xl py-4 hover:bg-red-900/50 transition-colors disabled:opacity-40"
              >
                <X size={22} />
                <span className="text-xs font-semibold">No</span>
              </button>

              {/* No sé */}
              <button
                onClick={skip}
                disabled={responding}
                className="flex flex-col items-center gap-1.5 bg-ceiba-800/40 border border-ceiba-700/30 text-ceiba-400 rounded-2xl py-4 hover:bg-ceiba-800/60 transition-colors disabled:opacity-40"
              >
                <HelpCircle size={22} />
                <span className="text-xs font-semibold">No sé</span>
              </button>

              {/* Sí */}
              <button
                onClick={() => confirm(current, altRelation ?? undefined)}
                disabled={responding}
                className="flex flex-col items-center gap-1.5 bg-green-800/40 border border-green-700/40 text-green-400 rounded-2xl py-4 hover:bg-green-800/60 transition-colors disabled:opacity-40"
              >
                {responding ? (
                  <div className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                ) : (
                  <Check size={22} />
                )}
                <span className="text-xs font-semibold">Sí</span>
              </button>
            </div>
          </div>

          {/* Upcoming preview */}
          {proposals.length - currentIdx > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2 text-ceiba-600 text-xs">
              <ChevronRight size={12} />
              <span>Después: {proposals[currentIdx + 1]?.personFirstName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Util ──────────────────────────────────────────────────────────────────────

function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function emojiFor(rel: string): string {
  const map: Record<string, string> = {
    father: "👨", mother: "👩", son: "👦", daughter: "👧",
    brother: "🧑", sister: "👱‍♀️", half_brother: "🧑", half_sister: "👱‍♀️",
    nephew: "👦", niece: "👧", spouse: "💑", partner: "🤝",
    uncle: "👨", aunt: "👩", cousin: "🧑‍🤝‍🧑",
    grandfather_paternal: "👴", grandmother_paternal: "👵",
    grandfather_maternal: "👴", grandmother_maternal: "👵",
    grandson: "👦", granddaughter: "👧",
    father_in_law: "👨", mother_in_law: "👩",
    brother_in_law: "🧑", sister_in_law: "👱‍♀️",
    stepfather: "👨", stepmother: "👩", stepchild: "🧒",
  };
  return map[rel] ?? "👤";
}

function articleFor(rel: string): string {
  const femenine = new Set(["daughter","sister","niece","aunt","cousin","mother",
    "grandmother_paternal","grandmother_maternal","granddaughter",
    "mother_in_law","sister_in_law","stepmother","half_sister"]);
  return femenine.has(rel) ? "una" : "un";
}
