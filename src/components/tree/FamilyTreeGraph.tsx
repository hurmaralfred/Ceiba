"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import * as d3 from "d3";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";
import ForestAmbientLayer from "./ForestAmbientLayer";

export interface ExtendedEntry {
  member: FamilyMember;
  parentMemberId: string;
  inferredRelation?: string | null;
}

export interface MemberLink {
  fromMemberId: string;
  toMemberId: string;
  relation: string;
}

interface Props {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers?: ExtendedEntry[];
  memberLinks?: MemberLink[];
  onNodeClick?: (memberId: string) => void;
}

// ── Layout constants ──────────────────────────────────────────
const R = 28;           // circle radius
const ROOT_R = 34;      // root circle radius
const LABEL_H = 46;     // height for two-line name + relation (was 38)
const HGAP = 32;        // horizontal gap between circles (was 22)
const VGAP = 72;        // vertical gap between bottom-of-label and top-of-next-circle (was 64)
const TOP_PAD = 48;

// Slot width per node (for layout calculations)
const SLOT_W = R * 2 + HGAP;

// Jerarquía genealógica determinista. La Y de cada nodo depende EXCLUSIVAMENTE
// de este número de generación (bisabuelos -3 … bisnietos +3). Todas las claves
// de relación inferida deben tener su generación, o el nodo caería a 0.
const GENERATION: Record<string, number> = {
  great_grandfather: -3, great_grandmother: -3,
  grandfather: -2, grandmother: -2,
  grandfather_paternal: -2, grandmother_paternal: -2,
  grandfather_maternal: -2, grandmother_maternal: -2,
  father: -1, mother: -1, father_in_law: -1, mother_in_law: -1,
  stepfather: -1, stepmother: -1, uncle: -1, aunt: -1,
  brother: 0, sister: 0, half_brother: 0, half_sister: 0,
  spouse: 0, partner: 0, cousin: 0, brother_in_law: 0, sister_in_law: 0,
  son: 1, daughter: 1, stepchild: 1, nephew: 1, niece: 1,
  grandson: 2, granddaughter: 2,
  great_grandson: 3, great_granddaughter: 3,
};

const POS_HINT: Record<string, number> = {
  // ── Gen -2: abuelos maternos izq, paternos der ────────────
  grandfather_maternal: -3, grandmother_maternal: -2,
  grandfather_paternal: 2,  grandmother_paternal: 3,

  // ── Gen -1: suegros extremos, tíos laterales, padres centro ─
  mother_in_law: -6, father_in_law: 6,
  aunt: -5,          uncle: 5,
  stepmother: -1.5,  stepfather: 1.5,
  mother: -1,        father: 1,

  // ── Gen 0: primos extremo izq, hermanos juntos izq, ROOT,
  //           esposa/pareja der inmediata, cuñados der ────────
  cousin: -7,
  half_sister: -4, sister: -3, half_brother: -2, brother: -1,
  // ROOT implícito en 0
  spouse: 1, partner: 1,
  sister_in_law: 3, brother_in_law: 4,

  // ── Gen 1: hijos centro, sobrinos lados ───────────────────
  daughter: -2, son: -1, stepchild: 0, niece: 1, nephew: 2,

  // ── Gen 2: nietos ─────────────────────────────────────────
  granddaughter: -1, grandson: 1,
};

// ── 3D sphere color palettes ──────────────────────────────────
// Each palette: { ring, hi (highlight), mid, shadow }
// Radial gradient cx=33% cy=28% creates the 3D lit-from-top-left look
interface SphereColor { ring: string; hi: string; mid: string; shadow: string }

function getNodeColor(relationType: string, kind: string): SphereColor {
  if (relationType === "root")
    return { ring: "#4ade80", hi: "#bbf7d0", mid: "#22c55e", shadow: "#052e16" }; // tú — verde ceiba
  const gen = GENERATION[relationType] ?? 0;
  // Ascendentes (abuelos, bisabuelos): azul profundo
  if (gen <= -2)
    return { ring: "#93c5fd", hi: "#dbeafe", mid: "#3b82f6", shadow: "#1e3a8a" };
  if (gen === -1) {
    // Suegros / padrastros: azul más claro (afín)
    if (["father_in_law","mother_in_law","stepfather","stepmother"].includes(relationType))
      return { ring: "#bfdbfe", hi: "#eff6ff", mid: "#60a5fa", shadow: "#1e3a8a" };
    return { ring: "#93c5fd", hi: "#dbeafe", mid: "#3b82f6", shadow: "#1e3a8a" }; // padres — azul
  }
  if (gen === 0) {
    // Pareja / cónyuge: morado/violeta
    if (["spouse","partner"].includes(relationType))
      return { ring: "#c084fc", hi: "#f3e8ff", mid: "#a855f7", shadow: "#3b0764" };
    // Cuñados: morado claro (afín a pareja)
    if (["brother_in_law","sister_in_law"].includes(relationType))
      return { ring: "#d8b4fe", hi: "#faf5ff", mid: "#c084fc", shadow: "#4a044e" };
    // Hermanos / medios hermanos / primos: naranja
    return { ring: "#fdba74", hi: "#fff7ed", mid: "#f97316", shadow: "#431407" };
  }
  // Hijos / hijastros / sobrinos: verde brillante (descendientes)
  if (gen === 1)
    return { ring: "#86efac", hi: "#dcfce7", mid: "#34d399", shadow: "#064e3b" };
  // Nietos: verde más suave
  return { ring: "#6ee7b7", hi: "#d1fae5", mid: "#10b981", shadow: "#022c22" };
}

// Consistent color from name hash for avatar placeholder
function nameToHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function isRecentlyActive(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 86400000; // 24h
}

// Compact display name: shows first name + last initial when it fits
function makeDisplayName(firstName: string, lastName?: string | null): string {
  const fn = (firstName || "").trim();
  const ln = (lastName || "").trim();
  if (!ln) return fn.length > 13 ? fn.slice(0, 12) + "." : fn;
  const withInitial = `${fn} ${ln[0]}.`;
  if (withInitial.length <= 14) return withInitial;
  return fn.length > 13 ? fn.slice(0, 12) + "." : fn;
}

// Split into two display lines: line1 = first word of first_name,
// line2 = second word of first_name OR first word of last_name
function getNameLines(firstName: string, lastName?: string | null): [string, string] {
  const fnParts = (firstName || "").trim().split(/\s+/).filter(Boolean);
  const line1 = fnParts[0] ?? "";
  const line2 = fnParts[1] ?? (lastName || "").trim().split(/\s+/).filter(Boolean)[0] ?? "";
  return [line1, line2];
}

// ── Layout types ──────────────────────────────────────────────
interface LayoutNode {
  id: string;
  name: string;
  shortName: string;
  nameLine1: string;
  nameLine2: string;
  relation: string;
  relationType: string;
  generation: number;
  posHint: number;
  kind: "root" | "blood" | "affinity";
  isExtended: boolean;
  memberId?: string;
  avatarUrl?: string | null;
  isJoined?: boolean;
  isActive?: boolean;
  isDeceased?: boolean;
  cx: number; // circle center x
  cy: number; // circle center y
  r: number;  // radius
}

interface LayoutEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  kind: "blood" | "affinity" | "peer";
  // IDs de los nodos que conecta — necesarios para saber si esta arista
  // toca a la persona seleccionada o a su familia inmediata (Bloque A2).
  // Aditivo y local a este archivo (LayoutEdge no se exporta).
  fromId: string;
  toId: string;
}

function normStr(s: string) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

// \u2500\u2500 Bloque A2: familia inmediata de la persona seleccionada \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Solo un salto: padres, hijos, pareja, hermanos. Nunca abuelos, nietos,
// t\u00edos, sobrinos, cu\u00f1ados, suegros ni primos \u2014 eso queda fuera de alcance.
// Se calcula \u00daNICAMENTE con datos ya disponibles en el componente
// (members/memberLinks), sin tocar graphAdapter ni inferir relaciones
// nuevas: reusa las mismas etiquetas que ya produce edgeToRelationType.
const IMMEDIATE_PARENT_LABELS  = new Set(["father", "mother", "stepfather", "stepmother"]);
const IMMEDIATE_CHILD_LABELS   = new Set(["son", "daughter", "stepson", "stepdaughter", "stepchild"]);
const IMMEDIATE_PARTNER_LABELS = new Set(["spouse", "partner", "husband", "wife"]);
const IMMEDIATE_SIBLING_LABELS = new Set(["brother", "sister", "half_brother", "half_sister"]);

export function computeImmediateFamily(
  selectedId: string | null,
  members: FamilyMember[],
  memberLinks: MemberLink[],
): Set<string> {
  const result = new Set<string>();
  if (!selectedId) return result;

  // parentOf.get(childId)   \u2192 padres reales de childId
  // childrenOf.get(parentId) \u2192 hijos reales de parentId
  // partnersOf.get(id)      \u2192 parejas reales de id
  const parentOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  const partnersOf = new Map<string, Set<string>>();

  const addParentChild = (parentId: string, childId: string) => {
    if (!parentOf.has(childId)) parentOf.set(childId, new Set());
    parentOf.get(childId)!.add(parentId);
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, new Set());
    childrenOf.get(parentId)!.add(childId);
  };
  const addPartners = (a: string, b: string) => {
    if (!partnersOf.has(a)) partnersOf.set(a, new Set());
    partnersOf.get(a)!.add(b);
    if (!partnersOf.has(b)) partnersOf.set(b, new Set());
    partnersOf.get(b)!.add(a);
  };

  // Fuente 1: relaciones directas de la persona ra\u00edz (members[].relation_type).
  members.forEach((m) => {
    if (IMMEDIATE_PARENT_LABELS.has(m.relation_type)) addParentChild(m.id, "root");
    else if (IMMEDIATE_CHILD_LABELS.has(m.relation_type)) addParentChild("root", m.id);
    else if (IMMEDIATE_PARTNER_LABELS.has(m.relation_type)) addPartners("root", m.id);
  });

  // Fuente 2: relaciones reales entre dos personas que no son la ra\u00edz.
  // `l.relation` siempre describe "qu\u00e9 es toMemberId de fromMemberId"
  // (ver edgeToRelationType en graphAdapter.ts) \u2014 nunca se infiere aqu\u00ed.
  memberLinks.forEach((l) => {
    if (IMMEDIATE_CHILD_LABELS.has(l.relation)) addParentChild(l.fromMemberId, l.toMemberId);
    else if (l.relation === "partner" || l.relation === "spouse") addPartners(l.fromMemberId, l.toMemberId);
  });

  (parentOf.get(selectedId) ?? new Set()).forEach((id) => result.add(id));
  (childrenOf.get(selectedId) ?? new Set()).forEach((id) => result.add(id));
  (partnersOf.get(selectedId) ?? new Set()).forEach((id) => result.add(id));

  // Hermanos: comparten al menos un padre real con la persona seleccionada.
  if (selectedId === "root") {
    // Para la ra\u00edz, relation_type ya lo dice directamente \u2014 m\u00e1s robusto
    // que depender de que los padres tambi\u00e9n est\u00e9n cargados como personas.
    members.forEach((m) => {
      if (IMMEDIATE_SIBLING_LABELS.has(m.relation_type)) result.add(m.id);
    });
  } else {
    (parentOf.get(selectedId) ?? new Set()).forEach((parentId) => {
      (childrenOf.get(parentId) ?? new Set()).forEach((siblingId) => {
        if (siblingId !== selectedId) result.add(siblingId);
      });
    });
  }

  return result;
}

// ── Bloque A2 (corrección): reglas puras mínimas de interacción ────────
// Extraídas para poder probar, en aislamiento y sin DOM, que seleccionar y
// expandir/colapsar son operaciones independientes — sin abrir una
// arquitectura de estado nueva. Cada una es exactamente la lógica que usa
// su handler real en el componente, no una reimplementación paralela.

// Expandir/colapsar: opera ÚNICAMENTE sobre el set de ramas expandidas.
// No recibe ni puede tocar selectedId — la propia firma lo garantiza.
export function toggleExpandedSet(current: Set<string>, memberId: string): Set<string> {
  const next = new Set(current);
  if (next.has(memberId)) next.delete(memberId);
  else next.add(memberId);
  return next;
}

// ID de layout de la persona central: se OBTIENE de los nodos ya
// construidos (buscando relationType === "root"), nunca se asume. Si el
// esquema interno de buildLayout cambiara el id de la raíz a un UUID real,
// esta función lo seguiría encontrando sin cambios.
export function findRootNodeId(nodes: { id: string; relationType: string }[]): string {
  return nodes.find((n) => n.relationType === "root")?.id ?? "root";
}

// Exportada para permitir pruebas de integración del pipeline real
// (adaptGraph → buildLayout) sin duplicar su lógica en el test.
export function buildLayout(
  profile: Profile,
  members: FamilyMember[],
  visibleExtended: ExtendedEntry[],
  memberLinks: MemberLink[],
) {
  // Posición vertical: SIEMPRE la generación estructural que ya calculó
  // adaptGraph (relaciones parent/partner/guardian reales), nunca la
  // etiqueta de parentesco mostrada. `GENERATION[relationType]` solo es un
  // respaldo para member.generation ausente (no debería ocurrir viniendo de
  // adaptGraph, pero evita que un nodo caiga silenciosamente a la fila 0).
  const memberGenMap = new Map<string, number>();
  members.forEach(m => memberGenMap.set(m.id, m.generation ?? GENERATION[m.relation_type] ?? 0));

  // Safety-net dedup: build direct member name keys to filter any duplicates
  // that escaped the page-level filter (different name spellings, missing last names, etc.)
  const directNameKeys = new Set<string>();
  const directFirstWords = new Set<string>();
  members.forEach(m => {
    const fn = normStr(m.first_name); const ln = normStr(m.last_name || "");
    const fn0 = fn.split(" ")[0]; const ln0 = ln.split(" ")[0];
    directNameKeys.add(`${fn}|${ln}`);
    if (fn0 && ln0) directNameKeys.add(`${fn0}|${ln0}`);
    // When direct member has no last name, store sentinel so we can match
    // extended members who have that same first name WITH a last name added.
    if (!ln && fn0.length >= 4) directNameKeys.add(`${fn0}|__nolast__`);
    if (fn0.length >= 4) directFirstWords.add(fn0);
  });

  // Filter extended members before combining with direct members
  const safeExtended = visibleExtended.filter(({ member: m }) => {
    // If same profile_id as any direct member — definitely a duplicate
    if (m.profile_id && members.some(dm => dm.profile_id === m.profile_id)) return false;
    const fn = normStr(m.first_name); const ln = normStr(m.last_name || "");
    const fn0 = fn.split(" ")[0]; const ln0 = ln.split(" ")[0];
    // Full name or first-word match
    if (directNameKeys.has(`${fn}|${ln}`)) return false;
    if (fn0 && ln0 && directNameKeys.has(`${fn0}|${ln0}`)) return false;
    // Extended has last name but direct stored with no last name (or vice-versa)
    if (fn0.length >= 4 && directNameKeys.has(`${fn0}|__nolast__`)) return false;
    // Extended has no last name: first-name match against any direct member
    if (!ln && fn0.length >= 4 && directFirstWords.has(fn0)) return false;
    return true;
  });

  // Build raw node list
  const raw: Omit<LayoutNode, "cx" | "cy" | "r">[] = [
    {
      id: "root",
      name: profile.first_name,
      shortName: makeDisplayName(profile.first_name),
      nameLine1: getNameLines(profile.first_name, profile.last_name)[0],
      nameLine2: getNameLines(profile.first_name, profile.last_name)[1],
      relation: "Tú",
      relationType: "root",
      generation: 0, posHint: 0,
      kind: "root", isExtended: false,
      avatarUrl: profile.avatar_url,
      isJoined: true,
      isActive: true,
    },
    ...members.map(m => ({
      id: m.id,
      name: m.first_name + (m.last_name ? " " + m.last_name : ""),
      shortName: makeDisplayName(m.first_name, m.last_name),
      nameLine1: getNameLines(m.first_name, m.last_name)[0],
      nameLine2: getNameLines(m.first_name, m.last_name)[1],
      relation: RELATION_LABELS[m.relation_type as keyof typeof RELATION_LABELS] ?? m.relation_type,
      relationType: m.relation_type,
      generation: m.generation ?? GENERATION[m.relation_type] ?? 0,
      posHint: POS_HINT[m.relation_type] ?? 0,
      kind: m.relation_kind as "blood" | "affinity",
      isExtended: false,
      memberId: m.id,
      avatarUrl: (m as any).profile?.avatar_url ?? (m as any).photo_url ?? null,
      isJoined: !!m.profile_id,
      isActive: isRecentlyActive((m as any).profile?.last_seen_at),
      isDeceased: !!(m as any).is_deceased,
    })),
    ...safeExtended.map(({ member: m, parentMemberId, inferredRelation }) => {
      // inferredRelation ya trae la relación (con género) de esta persona
      // respecto a mí; es la ÚNICA base para su ETIQUETA. La POSICIÓN vertical
      // es un concepto aparte: usa siempre m.generation (estructural, de
      // adaptGraph). Antes se recalculaba desde GENERATION[infRel], y como el
      // mapa de etiquetas no cubre variantes con género (p. ej. "stepdaughter"
      // solo tenía "stepchild"), una hijastra caía por defecto a generación 0
      // — apareciendo junto a su padre y su madrastra en vez de con sus
      // hermanos. Al separar etiqueta de posición, ese bug desaparece.
      const infRel = (inferredRelation && inferredRelation !== "other") ? inferredRelation : null;
      const extGen = m.generation !== undefined
        ? m.generation
        : infRel
          ? (GENERATION[infRel] ?? 0)
          : (memberGenMap.get(parentMemberId) ?? 0) + (GENERATION[m.relation_type] ?? 0);
      const extHint = infRel
        ? (POS_HINT[infRel] ?? 0)
        : ((POS_HINT[members.find(pm => pm.id === parentMemberId)?.relation_type ?? ""] ?? 0)
            + (POS_HINT[m.relation_type] ?? 0) * 0.5);

      // Etiqueta y tipo: SIEMPRE desde RELATION_LABELS con la relación inferida
      // (única fuente de verdad). Sin listas ni condiciones especiales por
      // género — el género ya viene resuelto en inferredRelation.
      const finalRelType = infRel ?? m.relation_type;
      const relLabel = RELATION_LABELS[finalRelType as keyof typeof RELATION_LABELS] ?? finalRelType;

      return {
        id: m.id,
        name: m.first_name + (m.last_name ? " " + m.last_name : ""),
        shortName: makeDisplayName(m.first_name, m.last_name),
        nameLine1: getNameLines(m.first_name, m.last_name)[0],
        nameLine2: getNameLines(m.first_name, m.last_name)[1],
        relation: relLabel,
        relationType: finalRelType,
        generation: extGen,
        posHint: extHint,
        kind: m.relation_kind as "blood" | "affinity",
        isExtended: true,
        memberId: m.id,
        avatarUrl: null,
        isJoined: !!m.profile_id,
        isActive: false,
        isDeceased: !!(m as any).is_deceased,
      };
    }),
  ];

  // Group by generation and sort by posHint
  const byGen = new Map<number, typeof raw>();
  for (const n of raw) {
    if (!byGen.has(n.generation)) byGen.set(n.generation, []);
    byGen.get(n.generation)!.push(n);
  }
  for (const row of byGen.values()) row.sort((a, b) => a.posHint - b.posHint);

  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const minGen = gens[0] ?? 0;
  const maxGen = gens[gens.length - 1] ?? 0;

  // Compute canvas width based on widest row
  const maxRowCount = Math.max(...[...byGen.values()].map(r => r.length), 1);
  const svgWidth = Math.max(360, maxRowCount * SLOT_W + HGAP * 2);
  const cx = svgWidth / 2;

  // Assign positions
  const nodes: LayoutNode[] = [];
  const posMap = new Map<string, LayoutNode>();

  // Row step = 2*R (circle diameter) + LABEL_H + VGAP
  const ROW_STEP = R * 2 + LABEL_H + VGAP;

  for (const gen of gens) {
    const row = byGen.get(gen)!;
    const rowW = row.length * R * 2 + (row.length - 1) * HGAP;
    const startX = cx - rowW / 2;
    const rowCy = TOP_PAD + ROOT_R + (gen - minGen) * ROW_STEP;

    row.forEach((n, i) => {
      const r = n.id === "root" ? ROOT_R : R;
      const nodeCx = startX + i * (R * 2 + HGAP) + R;
      const node: LayoutNode = { ...n, cx: nodeCx, cy: rowCy, r };
      nodes.push(node);
      posMap.set(n.id, node);
    });
  }

  // Suppress direct-to-root for ancestors that already connect via a memberLink
  // chain (e.g. grandfather → father → root). Without this, both
  // grandfather → root AND grandfather → father are drawn, creating a long
  // crossing diagonal on top of the shorter chained connection.
  const hasAncestorChain = new Set<string>();
  memberLinks.forEach(l => {
    if ((l.relation === "son" || l.relation === "daughter") &&
        posMap.has(l.fromMemberId) && posMap.has(l.toMemberId) &&
        l.toMemberId !== "root") {
      hasAncestorChain.add(l.fromMemberId);
    }
  });

  // ── Edges ─────────────────────────────────────────────────────
  const edges: LayoutEdge[] = [];

  const addVertEdge = (fromId: string, toId: string, kind: LayoutEdge["kind"]) => {
    const from = posMap.get(fromId);
    const to = posMap.get(toId);
    if (!from || !to) return;
    // from bottom of circle → to top of circle
    edges.push({ x1: from.cx, y1: from.cy + from.r, x2: to.cx, y2: to.cy - to.r, kind, fromId, toId });
  };
  const addHorizEdge = (fromId: string, toId: string, kind: LayoutEdge["kind"]) => {
    const from = posMap.get(fromId);
    const to = posMap.get(toId);
    if (!from || !to) return;
    const fromRight = from.cx < to.cx;
    edges.push({
      x1: from.cx + (fromRight ? from.r : -from.r),
      y1: from.cy,
      x2: to.cx + (fromRight ? -to.r : to.r),
      y2: to.cy,
      kind,
      fromId,
      toId,
    });
  };

  const DIRECT_ANCESTORS = new Set(["father","mother","stepfather","stepmother","grandfather_paternal","grandmother_paternal","grandfather_maternal","grandmother_maternal"]);
  const COUPLE_TYPES     = new Set(["spouse","partner"]);
  const SIBLING_TYPES    = new Set(["brother","sister","half_brother","half_sister"]);
  const NEPHEW_NIECE     = new Set(["nephew","niece"]);
  const GRANDCHILD_TYPES = new Set(["grandson","granddaughter"]);

  // ── Doble filiación visual ────────────────────────────────────────────
  // Pareja del punto de unión: SOLO un miembro DIRECTO de root con
  // relation_type spouse|partner, generación 0 y ya posicionado en posMap.
  // Suegros, ex parejas y cuñados tienen relation_type distintos (no están
  // en COUPLE_TYPES) y quedan excluidos por construcción, no por filtro
  // adicional.
  const unionPartner = members.find(
    (m) =>
      COUPLE_TYPES.has(m.relation_type) &&
      (GENERATION[m.relation_type] ?? 0) === 0 &&
      posMap.has(m.id)
  );

  const UNION_POINT_ID = "__union:root__";
  let unionPointReady = false;
  if (unionPartner) {
    const rootPos = posMap.get("root");
    const partnerPos = posMap.get(unionPartner.id);
    if (rootPos && partnerPos) {
      // Punto sintético, nunca se agrega a `nodes` (no se renderiza como
      // círculo) — solo sirve de ancla para addVertEdge, reutilizando el
      // helper existente sin modificarlo.
      posMap.set(UNION_POINT_ID, {
        id: UNION_POINT_ID,
        name: "",
        shortName: "",
        nameLine1: "",
        nameLine2: "",
        relation: "",
        relationType: "union",
        generation: 0,
        posHint: 0,
        kind: "root",
        isExtended: false,
        avatarUrl: null,
        isJoined: false,
        isActive: false,
        cx: (rootPos.cx + partnerPos.cx) / 2,
        cy: rootPos.cy,
        r: 0,
      });
      unionPointReady = true;
    }
  }

  // Hijo compartido = existen AMBAS aristas parent reales:
  //   root → parent → hijo        (ya garantizada: el hijo está en
  //                                 `members` con relation_type son/daughter)
  //   pareja visible → parent → mismo hijo   (memberLink con relation
  //                                 EXACTAMENTE "son"|"daughter")
  // "son"/"daughter" en un memberLink solo lo produce edgeToRelationType
  // para una arista relationship_type='parent' vista desde person_a (el
  // progenitor real) — nunca desde la dirección inversa ni desde
  // partner/guardian (ver case "parent" en graphAdapter.ts). No hay
  // ambigüedad de sentido posible; no se infiere nada por apellido,
  // matrimonio, convivencia ni posición visual.
  const sharedChildIds = new Set<string>();
  const consumedLinkKeys = new Set<string>();
  if (unionPartner) {
    const directChildIds = new Set(
      members
        .filter((m) => m.relation_type === "son" || m.relation_type === "daughter")
        .map((m) => m.id)
    );
    memberLinks.forEach((l) => {
      const isParentEdge = l.relation === "son" || l.relation === "daughter";
      if (
        isParentEdge &&
        l.fromMemberId === unionPartner.id &&
        directChildIds.has(l.toMemberId) &&
        posMap.has(l.toMemberId)
      ) {
        sharedChildIds.add(l.toMemberId);
        consumedLinkKeys.add(`${l.fromMemberId}->${l.toMemberId}`);
      }
    });
  }

  members.forEach(m => {
    const gen = m.generation ?? GENERATION[m.relation_type] ?? 0;
    if (gen < 0) {
      if (DIRECT_ANCESTORS.has(m.relation_type) && !hasAncestorChain.has(m.id)) addVertEdge(m.id, "root", m.relation_kind as "blood" | "affinity");
      else if (["father_in_law","mother_in_law"].includes(m.relation_type)) addVertEdge(m.id, "root", "peer");
    } else if (gen > 0) {
      if (NEPHEW_NIECE.has(m.relation_type)) {
        const parentId = (m as any).parent_member_id;
        const sib = parentId
          ? members.find(s => s.id === parentId)
          : undefined;
        if (sib) addVertEdge(sib.id, m.id, m.relation_kind as "blood" | "affinity");
        else addVertEdge("root", m.id, m.relation_kind as "blood" | "affinity");
      } else if (GRANDCHILD_TYPES.has(m.relation_type)) {
        // Connect grandchildren to root — we don't know which child is the parent
        addVertEdge("root", m.id, m.relation_kind as "blood" | "affinity");
      } else {
        // Compartido (root Y la pareja visible tienen parent real hacia
        // este hijo) → se conecta desde el punto de unión. Exclusivo (solo
        // root) → exactamente la conexión actual, sin cambios.
        const origin = unionPointReady && sharedChildIds.has(m.id) ? UNION_POINT_ID : "root";
        addVertEdge(origin, m.id, m.relation_kind as "blood" | "affinity");
      }
    } else {
      if (COUPLE_TYPES.has(m.relation_type)) addHorizEdge("root", m.id, "peer");
    }
  });

  // NOTA: aquí NO se dibuja ninguna arista hacia `parentMemberId`. Ese campo
  // es el "ancla de profundidad 1" que calcula adaptGraph para agrupar la
  // rama, NO el progenitor real: un bisabuelo cuelga del padre/madre (p. ej.
  // Victor→Enna, Patricio→Jose). Dibujarlo producía líneas inexistentes que
  // cruzaban ramas y hacían parecer abuelos a los bisabuelos.
  // Todas las conexiones entre no-root salen de `memberLinks`, que se
  // construye desde las aristas REALES del payload.

  memberLinks.forEach(l => {
    // Ya dibujado como filiación real desde el punto de unión — evita la
    // diagonal "peer" duplicada.
    if (consumedLinkKeys.has(`${l.fromMemberId}->${l.toMemberId}`)) return;
    const from = posMap.get(l.fromMemberId);
    const to = posMap.get(l.toMemberId);
    if (!from || !to) return;

    // `relation` viene de edgeToRelationType sobre la arista real:
    //   son/daughter  ⇒ relationship_type='parent'  (fromMemberId = progenitor)
    //   partner       ⇒ relationship_type='partner'
    // Se dibuja según la relación real, no según la posición en el lienzo.
    if (l.relation === "son" || l.relation === "daughter") {
      addVertEdge(l.fromMemberId, l.toMemberId, "blood");
      return;
    }
    if (l.relation === "partner" || l.relation === "spouse") {
      addHorizEdge(l.fromMemberId, l.toMemberId, "peer");
      return;
    }
    edges.push({
      x1: from.cx, y1: from.cy,
      x2: to.cx,   y2: to.cy,
      kind: "peer",
      fromId: l.fromMemberId,
      toId: l.toMemberId,
    });
  });

  const totalHeight = TOP_PAD + ROOT_R + (maxGen - minGen) * ROW_STEP + R + LABEL_H + TOP_PAD;
  return { nodes, edges, totalHeight, svgWidth, posMap };
}

// ── Bezier path ───────────────────────────────────────────────
function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 6) return `M${x1},${y1} L${x2},${y2}`;
  const dy = y2 - y1;
  // Control points weighted 65 % toward the starting node — the path leaves
  // the parent going straight down (or up) for most of the distance, then
  // bends to the child's position.  Reduces the S-curve / diagram look.
  return `M${x1},${y1} C${x1},${y1 + dy * 0.65} ${x2},${y2 - dy * 0.35} ${x2},${y2}`;
}

// ── Main component ────────────────────────────────────────────
export default function FamilyTreeGraph({
  profile, members, extendedMembers = [], memberLinks = [], onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef   = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initialZoomApplied = useRef(false);

  // Expanded state — starts with ALL parent IDs so the full tree is visible by default
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const autoExpandedRef = useRef(false);

  // Count extended members per parent (for badge)
  const extCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    extendedMembers.forEach(e => m.set(e.parentMemberId, (m.get(e.parentMemberId) ?? 0) + 1));
    return m;
  }, [extendedMembers]);

  // Auto-expand all branches on first data load so connections are always visible
  useEffect(() => {
    if (!autoExpandedRef.current && extendedMembers.length > 0) {
      autoExpandedRef.current = true;
      setExpandedParents(new Set(extendedMembers.map(e => e.parentMemberId)));
    }
  }, [extendedMembers]);

  const visibleExtended = useMemo(
    () => extendedMembers.filter(e => expandedParents.has(e.parentMemberId)),
    [extendedMembers, expandedParents],
  );

  const { nodes, edges, totalHeight, svgWidth } = useMemo(
    () => buildLayout(profile, members, visibleExtended, memberLinks),
    [profile, members, visibleExtended, memberLinks],
  );

  // Bloque A2 (corrección): el ID de layout de la persona central se
  // OBTIENE de `nodes` (buscando relationType === "root"), nunca se asume
  // como el literal "root" de forma independiente. Si en el futuro
  // buildLayout cambiara ese id interno (p. ej. a un UUID real), este
  // componente lo seguiría encontrando correctamente sin cambios — el
  // fallback a "root" es solo defensivo (nodes siempre lo produce hoy,
  // contrato cubierto por generation.integration.test.ts vía byId("root")).
  const rootNodeId = useMemo(() => findRootNodeId(nodes), [nodes]);

  // La raíz inicia seleccionada por defecto. Clic en un nodo cambia la
  // selección; clic en el fondo del lienzo vuelve a rootNodeId (regla
  // única y consistente, ver handleBackgroundClick).
  const [selectedId, setSelectedId] = useState<string>(rootNodeId);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const immediateFamily = useMemo(
    () => computeImmediateFamily(selectedId, members, memberLinks),
    [selectedId, members, memberLinks],
  );

  // Info panel: selected node data (null when root or nothing selected)
  const selectedNode = useMemo(
    () => (selectedId && selectedId !== rootNodeId ? nodes.find(n => n.id === selectedId) ?? null : null),
    [selectedId, rootNodeId, nodes],
  );

  // Group downward edges by parent — combs for multi-child nodes, bezier for singles
  const edgeGroups = useMemo(() => {
    type EG = { d: string; kind: "blood" | "affinity" | "peer"; fromId: string; toIds: string[] };
    const downByParent = new Map<string, typeof edges>();
    const result: EG[] = [];

    for (const e of edges) {
      if (e.y2 > e.y1 + 20 && e.kind !== "peer") {
        if (!downByParent.has(e.fromId)) downByParent.set(e.fromId, []);
        downByParent.get(e.fromId)!.push(e);
      } else {
        result.push({ d: curvePath(e.x1, e.y1, e.x2, e.y2), kind: e.kind, fromId: e.fromId, toIds: [e.toId] });
      }
    }

    for (const [fromId, grp] of downByParent) {
      const sameKind = grp.every(e => e.kind === grp[0].kind);
      const sameGenY = grp.every(e => Math.abs(e.y2 - grp[0].y2) < 5);
      if (grp.length > 1 && sameKind && sameGenY) {
        const sorted = [...grp].sort((a, b) => a.x2 - b.x2);
        const spineY = grp[0].y1 + (grp[0].y2 - grp[0].y1) * 0.4;
        const parentX = grp[0].x1;
        const childY = grp[0].y2;
        // Vertical stem from parent down to the branch point, then a smooth
        // cubic-bezier branch to each child.  No horizontal bar → no org-chart
        // comb; instead the paths fan out like branches of a real tree.
        let d = `M${parentX},${grp[0].y1} L${parentX},${spineY}`;
        for (const e of sorted) {
          const mid = (spineY + childY) / 2;
          d += ` M${parentX},${spineY} C${parentX},${mid} ${e.x2},${mid} ${e.x2},${childY}`;
        }
        result.push({ d, kind: grp[0].kind, fromId, toIds: grp.map(e => e.toId) });
      } else {
        for (const e of grp) result.push({ d: curvePath(e.x1, e.y1, e.x2, e.y2), kind: e.kind, fromId: e.fromId, toIds: [e.toId] });
      }
    }
    return result;
  }, [edges]);

  // D3 zoom
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g   = d3.select(gRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 3])
      .on("zoom", e => g.attr("transform", e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);
  }, []);

  // Initial viewport: center on root node at a readable scale
  useEffect(() => {
    if (initialZoomApplied.current || !svgRef.current || !zoomRef.current || nodes.length === 0) return;
    initialZoomApplied.current = true;
    const rootNode = nodes.find(n => n.relationType === "root");
    if (!rootNode) return;
    const containerW = svgRef.current.parentElement?.clientWidth ?? 360;
    const initScale = containerW < 600 ? 0.65 : containerW < 1024 ? 0.85 : Math.min(1.0, containerW / svgWidth);
    const tx = containerW / 2 - rootNode.cx * initScale;
    const ty = 60 - rootNode.cy * initScale;
    d3.select(svgRef.current).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(initScale),
    );
  }, [nodes, svgWidth]);

  // Bloque A2 (corrección): seleccionar y expandir/colapsar son AHORA dos
  // eventos separados — antes un solo onClick en todo el nodo hacía ambas
  // cosas a la vez (causa exacta del comportamiento doble). Cada uno vive
  // en su propio elemento, con su propio onClick.
  const handleSelect = useCallback((memberId: string) => {
    setSelectedId(memberId);
  }, []);

  const handleToggleExpand = useCallback((memberId: string) => {
    setExpandedParents(prev => toggleExpandedSet(prev, memberId));
  }, []);

  // Clic en el fondo del lienzo (no en un nodo) → vuelve a rootNodeId.
  // Única regla de "limpiar selección": no hay un estado "sin selección",
  // siempre hay alguien enfocado — la raíz es el reposo natural.
  const handleBackgroundClick = useCallback(() => {
    setSelectedId(rootNodeId);
  }, [rootNodeId]);

  const EDGE_COLORS = { blood: "#86efac", affinity: "#fdba74", peer: "#c084fc" };

  // ── Forest background helpers ──────────────────────────────────
  const pineShape = (cx: number, base: number, h: number, w: number): string => {
    const hw = w / 2;
    const tw = Math.max(3, w * 0.07);
    const pts: [number, number][] = [
      [cx - tw, base],
      [cx - tw, base - h * 0.26],
      [cx - hw * 0.82, base - h * 0.26],
      [cx - hw * 0.44, base - h * 0.47],
      [cx - hw * 0.88, base - h * 0.47],
      [cx - hw * 0.48, base - h * 0.65],
      [cx - hw * 0.76, base - h * 0.65],
      [cx - hw * 0.36, base - h * 0.82],
      [cx - hw * 0.52, base - h * 0.82],
      [cx, base - h],
      [cx + hw * 0.52, base - h * 0.82],
      [cx + hw * 0.36, base - h * 0.82],
      [cx + hw * 0.76, base - h * 0.65],
      [cx + hw * 0.48, base - h * 0.65],
      [cx + hw * 0.88, base - h * 0.47],
      [cx + hw * 0.44, base - h * 0.47],
      [cx + hw * 0.82, base - h * 0.26],
      [cx + tw, base - h * 0.26],
      [cx + tw, base],
    ];
    return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  };

  const tropicalPath = (cx: number, base: number, h: number, w: number): string => {
    const hw = w / 2;
    const tw = Math.max(6, w * 0.08);
    const th = h * 0.36;
    return (
      `M ${cx - tw} ${base} L ${cx - tw} ${base - th} ` +
      `Q ${cx - hw * 0.65} ${base - h * 0.52} ${cx - hw * 1.38} ${base - h * 0.46} ` +
      `Q ${cx - hw * 1.05} ${base - h * 0.63} ${cx - hw * 0.72} ${base - h * 0.59} ` +
      `Q ${cx - hw * 0.40} ${base - h * 0.74} ${cx - hw * 0.22} ${base - h * 0.70} ` +
      `Q ${cx - hw * 0.08} ${base - h * 0.90} ${cx} ${base - h} ` +
      `Q ${cx + hw * 0.08} ${base - h * 0.90} ${cx + hw * 0.22} ${base - h * 0.70} ` +
      `Q ${cx + hw * 0.40} ${base - h * 0.74} ${cx + hw * 0.72} ${base - h * 0.59} ` +
      `Q ${cx + hw * 1.05} ${base - h * 0.63} ${cx + hw * 1.38} ${base - h * 0.46} ` +
      `Q ${cx + hw * 0.65} ${base - h * 0.52} ${cx + tw} ${base - th} ` +
      `L ${cx + tw} ${base} Z`
    );
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-green-900 bg-[#020804]">

      {/* Legend — colores por parentesco */}
      <div className="flex items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-white/5 bg-white/[0.03] text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#3b82f6"}} />
          Ascendentes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#f97316"}} />
          Hermanos
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#22c55e"}} />
          Tú
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#a855f7"}} />
          Pareja
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:"#34d399"}} />
          Hijos
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-green-400 bg-transparent" />
          Activo hoy
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-bold leading-none" style={{fontSize:7}}>+N</span>
          Expandir
        </span>
        <span className="ml-auto text-gray-700">Arrastra · Pellizca zoom</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: Math.max(380, totalHeight), background: "transparent" }}
        viewBox={`0 0 ${svgWidth} ${Math.max(380, totalHeight)}`}
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <style>{`
            /* ── Bloque A1: sin animaciones infinitas en reposo ──────────
               El árbol permanece estático mientras el usuario no interactúa. */

            /* ── Bloque A2: foco visual por selección ────────────────────
               Transiciones cortas y puntuales (150–250ms), nunca infinitas.
               Bajo prefers-reduced-motion los cambios de opacidad/escala
               siguen aplicándose (el foco sigue siendo legible) pero sin
               animarse — quedan instantáneos. */
            .edge-line {
              transition: opacity 0.2s ease, stroke-width 0.2s ease;
            }
            .node-focus-group {
              transform-box: fill-box;
              transform-origin: center;
              transition: transform 0.2s ease, opacity 0.2s ease;
            }
            .node-focus-group.is-selected {
              transform: scale(1.05);
            }
            @media (hover: hover) and (pointer: fine) {
              .node-focus-group[role="button"]:hover:not(.is-selected) {
                filter: brightness(1.18);
                transform: scale(1.04);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .edge-line, .node-focus-group, .node-focus-group.is-selected {
                transition: none;
              }
            }
          `}</style>

          {/* Sky-to-forest radial gradient — clearing in center */}
          <radialGradient id="bg-grad" cx="50%" cy="42%" r="60%">
            <stop offset="0%"   stopColor="#163d1e" />
            <stop offset="45%"  stopColor="#0b2410" />
            <stop offset="100%" stopColor="#020804" />
          </radialGradient>
          {/* Ground mist — fades in from bottom */}
          <linearGradient id="mist-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#a7f3a0" stopOpacity="0" />
            <stop offset="100%" stopColor="#a7f3a0" stopOpacity="0.07" />
          </linearGradient>
          {/* Light rays from top-center */}
          <radialGradient id="ray-grad" cx="50%" cy="0%" r="75%" gradientUnits="userSpaceOnUse"
            x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#4ade80" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </radialGradient>

          {/* Specular highlight overlay — white glow top-left */}
          <radialGradient id="specular" cx="33%" cy="28%" r="55%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.55" />
            <stop offset="45%"  stopColor="white" stopOpacity="0.10" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow-green"  x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#4ade80" floodOpacity="0.7" />
          </filter>
          <filter id="glow-blue"   x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#93c5fd" floodOpacity="0.55" />
          </filter>
          <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#c084fc" floodOpacity="0.6" />
          </filter>
          <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f97316" floodOpacity="0.6" />
          </filter>
          <filter id="glow-emerald" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#34d399" floodOpacity="0.6" />
          </filter>
          <filter id="shadow-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
          </filter>

          {/* Desaturate + darken filter for deceased nodes */}
          <filter id="deceased" x="-10%" y="-10%" width="120%" height="120%">
            <feColorMatrix type="saturate" values="0.08" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.65" />
              <feFuncG type="linear" slope="0.65" />
              <feFuncB type="linear" slope="0.65" />
            </feComponentTransfer>
          </filter>

          {/* Inner shadow to darken bottom of sphere */}
          <filter id="inner-shadow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
            <feFlood floodColor="black" floodOpacity="0.4" result="flood" />
            <feComposite in="flood" in2="SourceGraphic" operator="in" result="shadow" />
            <feOffset dx="0" dy="3" result="offset" />
            <feComposite in="SourceGraphic" in2="offset" operator="over" />
          </filter>
        </defs>

        {/* Background — clic aquí (fuera de cualquier nodo) vuelve a la raíz */}
        <rect
          width={svgWidth}
          height={Math.max(380, totalHeight)}
          fill="url(#bg-grad)"
          onClick={handleBackgroundClick}
          style={{ cursor: selectedId !== "root" ? "pointer" : "default" }}
        />

        {/* ── Forest scene — static, doesn't move with zoom ── */}
        {(() => {
          const W = svgWidth;
          const H = Math.max(380, totalHeight);
          // Far-background pine trees (very dim — depth illusion)
          const farPines = [0.08, 0.19, 0.30, 0.70, 0.81, 0.92].map((xf, i) => ({
            cx: W * xf, base: H * 0.88, h: H * (0.14 + (i % 3) * 0.05), w: W * 0.055,
          }));
          // Mid-ground tropical trees — sides
          const midLeft  = [
            { cx: W * 0.06, base: H, h: H * 0.52, w: W * 0.20 },
            { cx: W * 0.17, base: H, h: H * 0.40, w: W * 0.16 },
          ];
          const midRight = [
            { cx: W * 0.94, base: H, h: H * 0.52, w: W * 0.20 },
            { cx: W * 0.83, base: H, h: H * 0.40, w: W * 0.16 },
          ];
          // Foreground large trees — extreme edges
          const fgLeft  = { cx: -W * 0.02, base: H, h: H * 0.78, w: W * 0.28 };
          const fgRight = { cx:  W * 1.02, base: H, h: H * 0.78, w: W * 0.28 };

          return (
            <g style={{ pointerEvents: "none" }}>
              {/* Rayos de luz: movidos a ForestAmbientLayer (F3.0) — allí
                  varían de intensidad. Aquí el bosque queda estático. */}

              {/* Far background pines */}
              {farPines.map((t, i) => (
                <polygon key={`fp-${i}`}
                  points={pineShape(t.cx, t.base, t.h, t.w)}
                  fill="#071808" opacity="0.60"
                />
              ))}

              {/* Mid-ground left tropical trees */}
              {midLeft.map((t, i) => (
                <path key={`ml-${i}`}
                  d={tropicalPath(t.cx, t.base, t.h, t.w)}
                  fill={i === 0 ? "#050f06" : "#071309"}
                  opacity={i === 0 ? 0.82 : 0.65}
                />
              ))}
              {/* Mid-ground right tropical trees */}
              {midRight.map((t, i) => (
                <path key={`mr-${i}`}
                  d={tropicalPath(t.cx, t.base, t.h, t.w)}
                  fill={i === 0 ? "#050f06" : "#071309"}
                  opacity={i === 0 ? 0.82 : 0.65}
                />
              ))}

              {/* Foreground large trees — dramatic dark silhouettes */}
              <path d={tropicalPath(fgLeft.cx, fgLeft.base, fgLeft.h, fgLeft.w)}
                fill="#020603" opacity="0.95" />
              <path d={tropicalPath(fgRight.cx, fgRight.base, fgRight.h, fgRight.w)}
                fill="#020603" opacity="0.95" />

              {/* Ground mist */}
              <rect x={0} y={H * 0.80} width={W} height={H * 0.20}
                fill="url(#mist-grad)" />

              {/* Luciérnagas: movidas a ForestAmbientLayer (F3.0) — allí
                  derivan lento y aparecen/desaparecen. */}
            </g>
          );
        })()}

        {/* ── F3.0 — Respiración del Bosque ──────────────────────────────
            Capa de ambiente independiente: rayos que varían, luciérnagas
            que derivan, hoja ocasional y respiración del fondo. Detrás del
            grafo (antes de <g ref={gRef}>) y sin eventos → nunca toca nodos
            ni líneas. FamilyTreeGraph solo la renderiza. */}
        <ForestAmbientLayer width={svgWidth} height={Math.max(380, totalHeight)} />


        <g ref={gRef}>
          {/* ── Edges ── */}
          {/* Bloque A1: líneas estáticas en reposo — sin flujo de guiones
              animado. Bloque A2: jerarquía de foco — las aristas que tocan
              a la persona seleccionada Y a su familia inmediata (en ambos
              extremos) se refuerzan; el resto baja de opacidad sin perder
              legibilidad. El patrón de guiones distingue el tipo de
              relación sin depender solo del color:
                sangre (blood)    → línea sólida
                pareja/unión (peer) → patrón propio (guion largo, existente)
                afinidad/derivada  → guion corto, distinto de "peer" */}
          {edgeGroups.map((eg, i) => {
            const isPeer = eg.kind === "peer";
            const isBlood = eg.kind === "blood";
            // El punto de unión sintético cuenta como "root" para el foco.
            const effectiveFrom = eg.fromId.startsWith("__union:") ? "root" : eg.fromId;
            const endpointHighlighted = (id: string) => id === selectedId || immediateFamily.has(id);
            const isHighlighted = eg.toIds.length > 1
              ? endpointHighlighted(effectiveFrom)
              : endpointHighlighted(effectiveFrom) &&
                endpointHighlighted(eg.toIds[0].startsWith("__union:") ? "root" : eg.toIds[0]);

            return (
              <path
                key={i}
                d={eg.d}
                fill="none"
                stroke={EDGE_COLORS[eg.kind]}
                strokeWidth={isPeer ? 1.2 : (isHighlighted ? 1.9 : 1.6)}
                strokeDasharray={isPeer ? "4,3" : isBlood ? undefined : "2,3"}
                strokeLinecap="round"
                opacity={isHighlighted ? (isPeer ? 0.55 : 0.75) : (isPeer ? 0.15 : 0.2)}
                className="edge-line"
              />
            );
          })}

          {/* ── Nodes ── */}
          {/* Bloque A1: sin flotación ni brillo permanentes — los nodos
              quedan quietos en reposo. */}
          {nodes.map((n) => {
            const isRoot     = n.id === "root";
            const isJoined   = n.isJoined && !isRoot;
            const isActive   = n.isActive && !isRoot;
            const isDeceased = !!n.isDeceased;
            const r          = n.r;
            const colors     = getNodeColor(n.relationType, n.kind);
            const hasPhoto   = !!(n.avatarUrl);
            const hue        = nameToHue(n.name);

            const extCount   = n.memberId ? (extCountByParent.get(n.memberId) ?? 0) : 0;
            const isExpanded = n.memberId ? expandedParents.has(n.memberId) : false;
            // Badge visible on ALL nodes (direct and extended) that have hidden children
            const hasBadge   = extCount > 0;
            // Bloque A2 (corrección): seleccionar y expandir son eventos
            // independientes. Cualquier persona (directa o extendida, con
            // o sin rama oculta) puede seleccionarse — antes un extendido
            // sin rama oculta no era clicable en absoluto y no podía
            // enfocarse. Expandir sigue dependiendo solo de tener rama oculta.
            const canSelect  = !isRoot && !!n.memberId;
            const canExpand  = !!n.memberId && hasBadge;

            // Unique gradient / clip IDs per node
            const gradId  = `sg-${n.id}`;
            const clipId  = `cp-${n.id}`;

            // 3D sphere colors — extended nodes use muted gray
            // Deceased override: muted silver tones (filter will desaturate further)
            const hi     = isDeceased ? "#c0c0c0" : n.isExtended ? "#9ca3af" : colors.hi;
            const mid    = isDeceased ? "#5a5a5a" : n.isExtended ? "#4b5563" : colors.mid;
            const shadow = isDeceased ? "#1a1a1a" : n.isExtended ? "#111827" : colors.shadow;
            const ring   = isDeceased ? "#6b7280" : n.isExtended ? "#374151" : colors.ring;
            const nodeFilter = isDeceased ? "url(#deceased)" : undefined;

            // Glow filter — matches node color family. `n.generation` ya es
            // la posición final asignada (estructural), no se recalcula.
            const relGen = n.generation;
            let glowFilter = "url(#glow-blue)"; // ascendentes
            if (isRoot) glowFilter = "url(#glow-green)";
            else if (relGen >= 1) glowFilter = "url(#glow-emerald)"; // descendientes
            else if (relGen === 0) {
              if (["spouse","partner","brother_in_law","sister_in_law"].includes(n.relationType))
                glowFilter = "url(#glow-purple)"; // pareja
              else
                glowFilter = "url(#glow-orange)"; // hermanos
            }

            // Bloque A2: jerarquía de tres niveles.
            //   Nivel 1 — seleccionada: opacidad 1, anillo propio, escala +5%.
            //   Nivel 2 — familia inmediata: opacidad alta (0.92), normal.
            //   Nivel 3 — resto: opacidad reducida, nunca por debajo de 0.35.
            const isSelected  = n.id === selectedId;
            const isImmediate = immediateFamily.has(n.id);
            const tierOpacity = isSelected ? 1 : isImmediate ? 0.92 : 0.4;

            return (
              <g
                key={n.id}
                onClick={canSelect ? () => handleSelect(n.memberId!) : undefined}
                onKeyDown={canSelect ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(n.memberId!);
                  }
                } : undefined}
                onFocus={canSelect ? () => setFocusedId(n.id) : undefined}
                onBlur={canSelect ? () => setFocusedId(null) : undefined}
                tabIndex={canSelect ? 0 : undefined}
                role={canSelect ? "button" : undefined}
                aria-label={canSelect ? `${n.name}, ${n.relation}${n.isDeceased ? ", fallecido" : ""}` : undefined}
                className={`node-focus-group${isSelected ? " is-selected" : ""}`}
                style={{ cursor: canSelect ? "pointer" : "default", opacity: tierOpacity }}
              >
                {/* Per-node 3D sphere gradient + clip */}
                <defs>
                  <radialGradient id={gradId} cx="33%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
                    <stop offset="0%"   stopColor={hi}     />
                    <stop offset="45%"  stopColor={mid}    />
                    <stop offset="100%" stopColor={shadow} />
                  </radialGradient>
                  <clipPath id={clipId}>
                    <circle cx={n.cx} cy={n.cy} r={r - 0.5} />
                  </clipPath>
                </defs>

                {/* Tooltip nativo del navegador + accesibilidad lectores */}
                <title>{n.name}{n.relation && n.relation !== "Tú" ? ` · ${n.relation}` : ""}{n.isDeceased ? " †" : ""}</title>

                {/* Nivel 1 — anillo de selección: propio, siempre estático
                    (sin pulso). Distinto en color del anillo de raíz/activo
                    para no confundir "seleccionado" con "raíz"/"activo hoy". */}
                {isSelected && (
                  <circle cx={n.cx} cy={n.cy} r={r + 5}
                    fill="none" stroke="#f59e0b" strokeWidth="2.5" opacity={0.9} />
                )}

                {/* Anillo de foco por teclado — distinto del de selección */}
                {focusedId === n.id && !isSelected && (
                  <circle cx={n.cx} cy={n.cy} r={r + 7}
                    fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3,2" opacity={0.85} />
                )}

                {/* Anillo distintivo de raíz / activo hoy — estático en
                    reposo (Bloque A1: sin pulso infinito). */}
                {isRoot && (
                  <circle cx={n.cx} cy={n.cy} r={ROOT_R + 7}
                    fill="none" stroke="#4ade80" strokeWidth="2.5" opacity={0.75} />
                )}
                {isActive && (
                  <circle cx={n.cx} cy={n.cy} r={R + 6}
                    fill="none" stroke="#4ade80" strokeWidth="2" opacity={0.65} />
                )}

                {/* Glow backdrop */}
                {!n.isExtended && !isDeceased && (
                  <circle cx={n.cx} cy={n.cy} r={r}
                    fill={`url(#${gradId})`}
                    stroke={ring}
                    strokeWidth={isRoot ? 2.5 : 2}
                    filter={glowFilter}
                    opacity={isRoot ? 0.85 : 0.45}
                  />
                )}

                {/* ── 3D Sphere base ── */}
                <circle cx={n.cx} cy={n.cy} r={r}
                  fill={`url(#${gradId})`}
                  stroke={isDeceased ? "#4b5563" : isJoined || isActive ? "#4ade80" : ring}
                  strokeWidth={isRoot ? 2.5 : isJoined && !isDeceased ? 2.5 : 1.8}
                  filter={isDeceased ? nodeFilter : n.isExtended ? "url(#shadow-soft)" : undefined}
                  strokeDasharray={isDeceased ? "4,3" : undefined}
                />

                {/* Photo over sphere */}
                {hasPhoto && (
                  <>
                    <image
                      href={n.avatarUrl!}
                      x={n.cx - r} y={n.cy - r}
                      width={r * 2} height={r * 2}
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                      opacity={isDeceased ? 0.5 : 0.82}
                      filter={isDeceased ? nodeFilter : undefined}
                    />
                    {/* Darken bottom of photo for sphere depth */}
                    <circle cx={n.cx} cy={n.cy} r={r - 1}
                      fill="rgba(0,0,0,0.18)"
                      clipPath={`url(#${clipId})`}
                      style={{ pointerEvents: "none" }}
                    />
                  </>
                )}

                {/* Specular highlight — creates glassy 3D look */}
                <circle cx={n.cx} cy={n.cy} r={r}
                  fill="url(#specular)"
                  style={{ pointerEvents: "none" }}
                />

                {/* Bloque A1: se elimina el brillo (shimmer) que barría la
                    esfera de forma permanente — sin reemplazo estático, no
                    aporta significado en reposo. */}

                {/* Indicador de "en Ceiba" — antes orbitaba sin parar;
                    ahora es un punto fijo (Bloque A1: sin brillo continuo). */}
                {(isJoined || isActive) && !isDeceased && (
                  <g>
                    <circle cx={n.cx + r + 5} cy={n.cy} r={2.5}
                      fill={isActive ? "#4ade80" : "#86efac"}
                      opacity={0.9}
                    />
                    <circle cx={n.cx + r + 5} cy={n.cy} r={5}
                      fill={isActive ? "#4ade80" : "#86efac"}
                      opacity={0.25}
                    />
                  </g>
                )}

                {/* Initial letter if no photo */}
                {!hasPhoto && (
                  <text
                    x={n.cx} y={n.cy + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(255,255,255,0.92)"
                    fontSize={r * 0.78}
                    fontWeight="700"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.name[0]?.toUpperCase() ?? "?"}
                  </text>
                )}

                {/* Green dot for joined (not active) — hidden for deceased */}
                {isJoined && !isActive && !isDeceased && (
                  <>
                    <circle cx={n.cx + r * 0.68} cy={n.cy - r * 0.68} r={5.5}
                      fill="#5c7a52" stroke="#1a2417" strokeWidth={1.5} />
                    <circle cx={n.cx + r * 0.68} cy={n.cy - r * 0.68} r={3}
                      fill="#4ade80" style={{ pointerEvents: "none" }} />
                  </>
                )}

                {/* † Cross badge for deceased members */}
                {isDeceased && (
                  <g style={{ pointerEvents: "none" }}>
                    {/* Background circle */}
                    <circle
                      cx={n.cx + r * 0.68}
                      cy={n.cy + r * 0.68}
                      r={8}
                      fill="#1c1c1c"
                      stroke="#6b7280"
                      strokeWidth={1}
                    />
                    {/* Dagger symbol */}
                    <text
                      x={n.cx + r * 0.68}
                      y={n.cy + r * 0.68 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9ca3af"
                      fontSize={10}
                      fontWeight="500"
                      fontFamily="Georgia, serif"
                    >
                      †
                    </text>
                  </g>
                )}

                {/* +N/− expansion badge — evento PROPIO e independiente de
                    la selección (Bloque A2, corrección). stopPropagation
                    evita que el clic también dispare el onClick de
                    selección del nodo, del que este badge es hijo. */}
                {hasBadge && (
                  <g
                    onClick={canExpand ? (e) => {
                      e.stopPropagation();
                      handleToggleExpand(n.memberId!);
                    } : undefined}
                    style={{ cursor: canExpand ? "pointer" : "default" }}
                  >
                    <circle
                      cx={n.cx - r * 0.68}
                      cy={n.cy - r * 0.68}
                      r={9}
                      fill={isExpanded ? "#6b7280" : "#f59e0b"}
                      stroke="#060b14"
                      strokeWidth={1.5}
                    />
                    <text
                      x={n.cx - r * 0.68}
                      y={n.cy - r * 0.68 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={7}
                      fontWeight="800"
                      fontFamily="system-ui, sans-serif"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {isExpanded ? "−" : `+${extCount}`}
                    </text>
                  </g>
                )}

                {/* Root star */}
                {isRoot && (
                  <text
                    x={n.cx + ROOT_R * 0.68}
                    y={n.cy - ROOT_R * 0.68}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#f59e0b"
                    fontSize={12}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    ★
                  </text>
                )}

                {/* Name — up to two lines, no mid-word cuts */}
                {n.nameLine1 && (
                  <text
                    textAnchor="middle"
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    <tspan
                      x={n.cx}
                      y={n.cy + r + (n.nameLine2 ? 11 : 15)}
                      fill={n.isExtended ? "#c4cdd8" : "white"}
                      fontSize={n.isExtended ? 10 : 11}
                    >
                      {n.nameLine1}
                    </tspan>
                    {n.nameLine2 && (
                      <tspan
                        x={n.cx}
                        y={n.cy + r + 23}
                        fill={n.isExtended ? "#b8c5cf" : "rgba(255,255,255,0.90)"}
                        fontSize={n.isExtended ? 9.5 : 10}
                      >
                        {n.nameLine2}
                      </tspan>
                    )}
                  </text>
                )}

                {/* Relation */}
                <text
                  x={n.cx}
                  y={n.cy + r + (n.nameLine2 ? 35 : 26)}
                  textAnchor="middle"
                  fill={n.isExtended ? "#8b98a8" : "rgba(255,255,255,0.65)"}
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {n.relation.length > 15 ? n.relation.slice(0, 14) + "…" : n.relation}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Info panel: slides up when a non-root node is selected ── */}
      {selectedNode && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(60px + env(safe-area-inset-bottom))",
            left: 0, right: 0, zIndex: 44,
            padding: "0 12px",
            animation: "panel-in 180ms ease both",
          }}
        >
          <style>{`
            @keyframes panel-in {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @media (min-width: 1024px) {
              .node-info-panel { max-width: 340px; margin-left: auto !important; margin-right: 80px !important; }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes panel-in { from { opacity:1; transform:none; } }
            }
          `}</style>
          <div
            className="node-info-panel"
            style={{
              background: "rgba(10, 28, 13, 0.95)",
              backdropFilter: "blur(14px)",
              borderRadius: 16,
              border: "1px solid rgba(74, 222, 128, 0.18)",
              boxShadow: "0 -2px 20px rgba(0,0,0,0.4)",
              padding: "12px 14px",
              margin: "0 auto",
              maxWidth: 520,
            }}
          >
            {/* Row 1: avatar + name/relation + close */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(145deg,#7daa72,#5c7a52)",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: selectedNode.isDeceased ? "2px dashed #6b7280" : "2px solid rgba(74,222,128,0.4)",
              }}>
                {selectedNode.avatarUrl
                  ? <img src={selectedNode.avatarUrl} alt={selectedNode.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
                      {selectedNode.name[0]?.toUpperCase() ?? "?"}
                    </span>
                }
              </div>

              {/* Name + relation */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    color: "white", fontWeight: 700, fontSize: 14,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}>
                    {selectedNode.name}
                  </span>
                  {selectedNode.isDeceased && (
                    <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "Georgia, serif" }}>†</span>
                  )}
                </div>
                <div style={{ color: "rgba(167,243,160,0.75)", fontSize: 12, marginTop: 1,
                  fontFamily: "system-ui, sans-serif" }}>
                  {selectedNode.relation}
                </div>
              </div>

              {/* Close → reset to root */}
              <button
                onClick={handleBackgroundClick}
                aria-label="Cerrar panel"
                style={{
                  background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.5)", borderRadius: 8,
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Row 2: action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {selectedNode.memberId && (
                <Link
                  href={`/member/${selectedNode.memberId}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(94,138,80,0.28)", border: "1px solid rgba(74,222,128,0.22)",
                    color: "#86efac", borderRadius: 10, padding: "7px 4px",
                    fontSize: 12, fontWeight: 600, textDecoration: "none",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  Editar
                </Link>
              )}
              <Link
                href={selectedNode.memberId ? `/invitar?person=${selectedNode.memberId}` : "/invitar"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(94,138,80,0.14)", border: "1px solid rgba(74,222,128,0.14)",
                  color: "#86efac", borderRadius: 10, padding: "7px 4px",
                  fontSize: 12, fontWeight: 600, textDecoration: "none",
                  fontFamily: "system-ui, sans-serif",
                  gridColumn: selectedNode.memberId ? undefined : "1 / 2",
                }}
              >
                Invitar
              </Link>
              <button
                onClick={() => {
                  if (!selectedNode.memberId) return;
                  const url = `${window.location.origin}/member/${selectedNode.memberId}`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    navigator.share({ title: selectedNode.name, url }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(url).then(() => {
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }).catch(() => {});
                  }
                }}
                style={{
                  background: "rgba(94,138,80,0.14)", border: "1px solid rgba(74,222,128,0.14)",
                  color: "#86efac", borderRadius: 10, padding: "7px 4px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {shareCopied ? "Copiado ✓" : "Compartir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
