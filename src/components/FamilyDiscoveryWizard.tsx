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
import { RelationType, RELATION_LABELS } from "@/lib/types";
import { reverseRelation, inferRelation } from "@/lib/relations";
import { edgeToRelationType, relationTypeToGraphType, type EdgeNode } from "@/lib/graphAdapter";
import toast from "react-hot-toast";

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
  familyMemberId?: string;       // legacy: family_members.id
  personId?: string;             // nuevo: persons.id de la persona propuesta
  personProfileId: string | null; // auth.uid() de la persona (null si no está en Ceiba)
  personFirstName: string;
  personLastName: string | null;
  suggestedRelation: string;     // RelationType (e.g. "brother")
  connectorName: string;
  connectorProfileId: string;
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
  const [discovering, setDiscovering] = useState(false);
  const [done, setDone] = useState(false);
  const [altRelation, setAltRelation] = useState<string | null>(null);

  // persons.id del usuario actual (cargado en init)
  const myPersonId = useRef<string | null>(null);

  // Track who we've already proposed / traversed to avoid cycles
  const seenProfileIds = useRef(new Set<string>([userId]));
  const seenPersonIds = useRef(new Set<string>());
  const seenNameKeys = useRef(new Set<string>());
  const myTreeProfileIds = useRef(new Set<string>());

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);

    // Obtener mi persons.id
    const { data: myPersonRow } = await supabase
      .from("persons")
      .select("id")
      .eq("linked_user_id", userId)
      .single();
    myPersonId.current = myPersonRow?.id ?? null;

    // Cargar mis relaciones existentes para no proponer duplicados
    if (myPersonRow?.id) {
      const { data: myRels } = await supabase
        .from("relationships")
        .select("person_a_id, person_b_id")
        .or(`person_a_id.eq.${myPersonRow.id},person_b_id.eq.${myPersonRow.id}`)
        .eq("status", "confirmed");

      // Obtener los persons.id ya conectados y marcarlos como vistos
      const connectedPersonIds = (myRels || []).map(r =>
        r.person_a_id === myPersonRow.id ? r.person_b_id : r.person_a_id
      );
      if (connectedPersonIds.length > 0) {
        const { data: connectedPersons } = await supabase
          .from("persons")
          .select("id, linked_user_id, first_names, last_names")
          .in("id", connectedPersonIds);
        for (const p of connectedPersons || []) {
          seenPersonIds.current.add(p.id);
          if (p.linked_user_id) {
            myTreeProfileIds.current.add(p.linked_user_id);
            seenProfileIds.current.add(p.linked_user_id);
          }
          seenNameKeys.current.add(normKey(p.first_names, p.last_names));
        }
      }
    }

    // Legacy: cargar family_members propios para dedup adicional
    const { data: myTree } = await supabase
      .from("family_members")
      .select("profile_id, first_name, last_name")
      .eq("added_by", userId);
    for (const m of myTree || []) {
      if (m.profile_id) { myTreeProfileIds.current.add(m.profile_id); seenProfileIds.current.add(m.profile_id); }
      seenNameKeys.current.add(normKey(m.first_name, m.last_name));
    }

    const initial: Proposal[] = [];

    // Legacy: find_name_matches (queries family_members — datos migrados)
    const { data: matches } = await supabase.rpc("find_name_matches", {
      p_first_name: myFirstName,
      p_last_name:  myLastName || "",
      p_user_id:    userId,
    });
    for (const m of matches || []) {
      if (seenProfileIds.current.has(m.adder_id)) continue;
      seenProfileIds.current.add(m.adder_id);
      initial.push({
        id: crypto.randomUUID(),
        source: "name_match",
        familyMemberId:    m.family_member_id,
        personProfileId:   m.adder_id,
        personFirstName:   m.adder_first_name,
        personLastName:    m.adder_last_name,
        suggestedRelation: reverseRelation(m.relation_type),
        connectorName:     m.adder_first_name,
        connectorProfileId: m.adder_id,
        connectorRelationToMe: reverseRelation(m.relation_type),
        depth: 0,
      });
    }

    // Nuevo esquema: match_candidates donde soy la persona detectada como duplicado
    if (myPersonRow?.id) {
      const { data: candidates } = await supabase
        .from("match_candidates")
        .select("id, proposed_by_user_id, new_person_payload, proposed_relationship, score")
        .eq("matched_person_id", myPersonRow.id)
        .eq("status", "pending");

      for (const cand of candidates || []) {
        const proposerProfileId = cand.proposed_by_user_id as string;
        if (!proposerProfileId || seenProfileIds.current.has(proposerProfileId)) continue;

        const relTypeRaw = cand.proposed_relationship?.type as string | undefined;
        if (!relTypeRaw) continue;

        // El proponente declaró: (él) → (yo) con relType
        // Ej: si relType = "parent_of" y él es person_a → él es mi padre
        // reverseRelation de una nueva relType requiere mapeo: usamos el payload
        const payload = cand.new_person_payload || {};
        const propFirstName = payload.first_names as string ?? "Persona";
        const propLastName  = payload.last_names  as string ?? null;

        // Convertir new relationship_type → legacy RelationType para mostrar al usuario
        // parent_of (ellos→yo) → ellos son mi padre/madre (sin saber género, usamos "father")
        const legacyRelMap: Record<string, RelationType> = {
          parent_of: "father", partner_of: "spouse",
          sibling_of: "brother", half_sibling_of: "half_brother",
          guardian_of: "stepfather", adoptive_parent_of: "father",
        };
        const suggestedRel: RelationType = legacyRelMap[relTypeRaw] ?? "other";

        seenProfileIds.current.add(proposerProfileId);
        initial.push({
          id: crypto.randomUUID(),
          source: "name_match",
          familyMemberId: undefined,
          personProfileId: proposerProfileId,
          personFirstName: propFirstName,
          personLastName:  propLastName,
          suggestedRelation: suggestedRel,
          connectorName: propFirstName,
          connectorProfileId: proposerProfileId,
          connectorRelationToMe: suggestedRel,
          depth: 0,
        });
      }
    }

    setProposals(initial);
    setLoading(false);
  };

  function normKey(fn: string, ln: string | null) {
    const norm = (s: string) => (s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim();
    return `${norm(fn)}|${norm(ln || "")}`;
  }

  // ── Discover family of a confirmed person (nuevo esquema) ──────────────────
  const discoverFamily = useCallback(async (
    confirmedProfileId: string,
    myRelationToThem: string,
    connectorName: string,
    depth: number,
  ) => {
    if (depth >= 2) return;
    setDiscovering(true);

    // Buscar el persons.id del familiar confirmado
    const { data: personRow } = await supabase
      .from("persons")
      .select("id")
      .eq("linked_user_id", confirmedProfileId)
      .single();

    const newProposals: Proposal[] = [];

    if (personRow?.id) {
      // ── Nuevo esquema: leer relationships + persons ────────────────────────
      const confirmedPersonId = personRow.id;

      const { data: theirRels } = await supabase
        .from("relationships")
        .select("person_a_id, person_b_id, relationship_type")
        .or(`person_a_id.eq.${confirmedPersonId},person_b_id.eq.${confirmedPersonId}`)
        .eq("status", "confirmed");

      const otherIds = (theirRels || [])
        .map(r => r.person_a_id === confirmedPersonId ? r.person_b_id : r.person_a_id)
        .filter(id => id !== (myPersonId.current ?? ""));

      if (otherIds.length > 0) {
        const { data: otherPersons } = await supabase
          .from("persons")
          .select("id, first_names, last_names, linked_user_id, gender")
          .in("id", otherIds);

        const personMap = new Map((otherPersons || []).map(p => [p.id, p]));

        for (const rel of theirRels || []) {
          const isA = rel.person_a_id === confirmedPersonId;
          const otherId = isA ? rel.person_b_id : rel.person_a_id;
          const other = personMap.get(otherId);
          if (!other) continue;

          if (other.linked_user_id === userId) continue;
          if (other.id && seenPersonIds.current.has(other.id)) continue;
          if (other.linked_user_id && (myTreeProfileIds.current.has(other.linked_user_id) || seenProfileIds.current.has(other.linked_user_id))) continue;

          const nameKey = normKey(other.first_names, other.last_names);
          if (seenNameKeys.current.has(nameKey)) continue;

          // Relación del confirmado hacia "other" (desde perspectiva del confirmado)
          const edgeRel = edgeToRelationType(
            { person_a_id: rel.person_a_id, person_b_id: rel.person_b_id, relationship_type: rel.relationship_type } as EdgeNode,
            confirmedPersonId,
            other.gender,
          );

          const inferred = inferRelation(myRelationToThem, edgeRel);
          if (!inferred || inferred === "other") continue;

          seenPersonIds.current.add(other.id);
          if (other.linked_user_id) seenProfileIds.current.add(other.linked_user_id);
          seenNameKeys.current.add(nameKey);

          newProposals.push({
            id: crypto.randomUUID(),
            source: "discovery",
            personId: other.id,
            personProfileId: other.linked_user_id || null,
            personFirstName: other.first_names,
            personLastName:  other.last_names || null,
            suggestedRelation: inferred,
            connectorName,
            connectorProfileId: confirmedProfileId,
            connectorRelationToMe: myRelationToThem,
            depth,
          });
        }
      }
    } else {
      // ── Legacy fallback: family_members (para datos pre-migración) ─────────
      const { data: theirFamily } = await supabase
        .from("family_members")
        .select("id, profile_id, first_name, last_name, relation_type")
        .eq("added_by", confirmedProfileId);

      for (const member of theirFamily || []) {
        if (member.profile_id === userId) continue;
        if (member.profile_id && (myTreeProfileIds.current.has(member.profile_id) || seenProfileIds.current.has(member.profile_id))) continue;
        const nameKey = normKey(member.first_name, member.last_name);
        if (seenNameKeys.current.has(nameKey)) continue;

        const inferred = inferRelation(myRelationToThem, member.relation_type);
        if (!inferred || inferred === "other") continue;

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
    }

    if (newProposals.length > 0) {
      setProposals(prev => [...prev, ...newProposals]);
    }
    setDiscovering(false);
  }, [userId, supabase]);

  // ── Confirm a proposal ──────────────────────────────────────────────────────
  const confirm = useCallback(async (proposal: Proposal, overrideRelation?: string) => {
    setResponding(true);
    const relation = (overrideRelation ?? proposal.suggestedRelation) as RelationType;
    const graphRelType = relationTypeToGraphType(relation);

    try {
      const myPId = myPersonId.current;

      if (proposal.source === "name_match" && proposal.personProfileId && myPId) {
        // Buscar el persons.id del confirmado
        const { data: theirPersonRow } = await supabase
          .from("persons")
          .select("id")
          .eq("linked_user_id", proposal.personProfileId)
          .single();

        if (theirPersonRow?.id) {
          // Ambos tienen nodo en persons → insertar relación directa
          await supabase.from("relationships").insert({
            person_a_id: myPId,
            person_b_id: theirPersonRow.id,
            relationship_type: graphRelType,
            source: "wizard_confirmed",
            declared_by_user_id: userId,
            status: "confirmed",
          });
        } else {
          // Solo yo tengo nodo — usar add_relative (crea su nodo + relación)
          await supabase.rpc("add_relative", {
            p_payload: {
              first_names: proposal.personFirstName,
              last_names: proposal.personLastName || null,
            },
            p_relationship: graphRelType,
          });
        }
      } else {
        // Discovery: usar add_relative o insertar directamente si tenemos personId
        if (proposal.personId && myPId) {
          // Persona ya existe en persons → relación directa
          await supabase.from("relationships").insert({
            person_a_id: myPId,
            person_b_id: proposal.personId,
            relationship_type: graphRelType,
            source: "wizard_confirmed",
            declared_by_user_id: userId,
            status: "confirmed",
          });
        } else {
          // Persona no estaba en persons todavía → add_relative la crea
          await supabase.rpc("add_relative", {
            p_payload: {
              first_names: proposal.personFirstName,
              last_names: proposal.personLastName || null,
            },
            p_relationship: graphRelType,
          });
        }
      }

      // Track confirmed person para evitar re-proponer
      if (proposal.personProfileId) myTreeProfileIds.current.add(proposal.personProfileId);
      if (proposal.personId) seenPersonIds.current.add(proposal.personId);

      setConfirmedCount(c => c + 1);

      // Descubrir familia del familiar confirmado
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
  }, [userId, supabase, discoverFamily]);

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
  const isDone = !loading && !discovering && currentIdx >= proposals.length;

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
