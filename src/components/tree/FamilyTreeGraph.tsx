"use client";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";

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
const NW = 118;
const NH = 50;
const HGAP = 26;
const VGAP = 80;
const TOP_PAD = 52;

const GENERATION: Record<string, number> = {
  grandfather_paternal: -2, grandmother_paternal: -2,
  grandfather_maternal: -2, grandmother_maternal: -2,
  father: -1, mother: -1, father_in_law: -1, mother_in_law: -1,
  stepfather: -1, stepmother: -1, uncle: -1, aunt: -1,
  brother: 0, sister: 0, half_brother: 0, half_sister: 0,
  spouse: 0, partner: 0, cousin: 0, brother_in_law: 0, sister_in_law: 0,
  son: 1, daughter: 1, stepchild: 1, nephew: 1, niece: 1,
  grandson: 2, granddaughter: 2,
};

const POS_HINT: Record<string, number> = {
  grandfather_maternal: -3, grandmother_maternal: -2,
  grandfather_paternal: 2,  grandmother_paternal: 3,
  mother: -1, father: 1,
  mother_in_law: -4, father_in_law: 4,
  stepmother: -2, stepfather: 2,
  aunt: -5, uncle: 5,
  half_sister: -2, sister: -1,
  spouse: 1, partner: 1,
  half_brother: 2, brother: 3,
  sister_in_law: -3, brother_in_law: 3,
  cousin: 4,
  daughter: -1, son: 1, stepchild: 0,
  niece: -3, nephew: 3,
  granddaughter: -1, grandson: 1,
};

// ── Shape system ──────────────────────────────────────────────
function nodePath(shape: string, w: number, h: number): string {
  switch (shape) {
    case "hexagon": {
      const m = h * 0.28;
      return `M${m},0 L${w - m},0 L${w},${h / 2} L${w - m},${h} L${m},${h} L0,${h / 2} Z`;
    }
    case "shield": {
      const c = 15;
      return `M${c},0 L${w - c},0 L${w},${c} L${w},${h} L0,${h} L0,${c} Z`;
    }
    case "arch": {
      const r = h / 2;
      return `M0,${r} Q0,0 ${r},0 L${w - r},0 Q${w},0 ${w},${r} L${w},${h} L0,${h} Z`;
    }
    case "diamond": {
      return `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`;
    }
    case "parallelogram": {
      const s = 12;
      return `M${s},0 L${w},0 L${w - s},${h} L0,${h} Z`;
    }
    case "arrow_down": {
      const n = 14;
      return `M0,0 L${w},0 L${w},${h - n} L${w / 2},${h} L0,${h - n} Z`;
    }
    case "pill": {
      const r = h / 2;
      return `M${r},0 A${r},${r} 0 0,0 ${r},${h} L${w - r},${h} A${r},${r} 0 0,0 ${w - r},0 Z`;
    }
    case "octagon": {
      const c = 12;
      return `M${c},0 L${w - c},0 L${w},${c} L${w},${h - c} L${w - c},${h} L${c},${h} L0,${h - c} L0,${c} Z`;
    }
    default: {
      const r = 11;
      return `M${r},0 L${w - r},0 Q${w},0 ${w},${r} L${w},${h - r} Q${w},${h} ${w - r},${h} L${r},${h} Q0,${h} 0,${h - r} L0,${r} Q0,0 ${r},0 Z`;
    }
  }
}

const RELATION_SHAPE: Record<string, string> = {
  root: "hexagon",
  grandfather_paternal: "shield", grandmother_paternal: "shield",
  grandfather_maternal: "shield", grandmother_maternal: "shield",
  father: "arch", mother: "arch",
  father_in_law: "arch", mother_in_law: "arch",
  stepfather: "arch", stepmother: "arch",
  uncle: "octagon", aunt: "octagon",
  brother: "parallelogram", sister: "parallelogram",
  half_brother: "parallelogram", half_sister: "parallelogram",
  brother_in_law: "parallelogram", sister_in_law: "parallelogram",
  cousin: "octagon",
  spouse: "diamond", partner: "diamond",
  son: "arrow_down", daughter: "arrow_down", stepchild: "arrow_down",
  nephew: "arrow_down", niece: "arrow_down",
  grandson: "pill", granddaughter: "pill",
};

// ── Style system ──────────────────────────────────────────────
// Each style has two gradient stops + stroke + glow color
interface NodeStyle {
  gradTop: string;
  gradBottom: string;
  stroke: string;
  glowColor: string;
  text: string;
  gradId: string;
  glowId: string;
  isLight?: boolean; // for level-2 nodes
}

// Gradient & glow definitions — loaded into SVG <defs>
const GRAD_DEFS: [string, string, string][] = [
  // [id, topColor, bottomColor]
  ["gr-root", "#1db954", "#052e16"],
  ["gr-gp",   "#4f8ef7", "#1e3a8a"],
  ["gr-par",  "#60a5fa", "#1e40af"],
  ["gr-il",   "#f59e0b", "#7c2d12"],
  ["gr-sp",   "#f87171", "#7f1d1d"],
  ["gr-sib",  "#a78bfa", "#4c1d95"],
  ["gr-ch",   "#22d3ee", "#0c4a6e"],
  ["gr-gc",   "#2dd4bf", "#134e4a"],
  ["gr-ext",  "#34d399", "#14532d"],
  ["gr-ext2",    "#f0fdf4", "#dcfce7"],
  ["gr-ext2aff", "#fffbeb", "#fef3c7"],
];

const GLOW_DEFS: [string, string][] = [
  // [filterId, glowColor]
  ["gw-root", "#4ade80"],
  ["gw-gp",   "#93c5fd"],
  ["gw-par",  "#bfdbfe"],
  ["gw-il",   "#fcd34d"],
  ["gw-sp",   "#fca5a5"],
  ["gw-sib",  "#c4b5fd"],
  ["gw-ch",   "#67e8f9"],
  ["gw-gc",   "#5eead4"],
  ["gw-ext",  "#86efac"],
];

const STYLES: Record<string, NodeStyle> = {
  root: { gradTop: "#1db954", gradBottom: "#052e16", stroke: "#4ade80", glowColor: "#4ade80", text: "#fff", gradId: "gr-root", glowId: "gw-root" },
  gp:   { gradTop: "#4f8ef7", gradBottom: "#1e3a8a", stroke: "#93c5fd", glowColor: "#93c5fd", text: "#fff", gradId: "gr-gp",  glowId: "gw-gp"  },
  par:  { gradTop: "#60a5fa", gradBottom: "#1e40af", stroke: "#bfdbfe", glowColor: "#bfdbfe", text: "#fff", gradId: "gr-par", glowId: "gw-par" },
  il:   { gradTop: "#f59e0b", gradBottom: "#7c2d12", stroke: "#fcd34d", glowColor: "#fcd34d", text: "#fff", gradId: "gr-il",  glowId: "gw-il"  },
  sp:   { gradTop: "#f87171", gradBottom: "#7f1d1d", stroke: "#fca5a5", glowColor: "#fca5a5", text: "#fff", gradId: "gr-sp",  glowId: "gw-sp"  },
  sib:  { gradTop: "#a78bfa", gradBottom: "#4c1d95", stroke: "#c4b5fd", glowColor: "#c4b5fd", text: "#fff", gradId: "gr-sib", glowId: "gw-sib" },
  ch:   { gradTop: "#22d3ee", gradBottom: "#0c4a6e", stroke: "#67e8f9", glowColor: "#67e8f9", text: "#fff", gradId: "gr-ch",  glowId: "gw-ch"  },
  gc:   { gradTop: "#2dd4bf", gradBottom: "#134e4a", stroke: "#5eead4", glowColor: "#5eead4", text: "#fff", gradId: "gr-gc",  glowId: "gw-gc"  },
  ext:  { gradTop: "#34d399", gradBottom: "#14532d", stroke: "#86efac", glowColor: "#86efac", text: "#fff", gradId: "gr-ext", glowId: "gw-ext" },
  ext2:    { gradTop: "#f0fdf4", gradBottom: "#dcfce7", stroke: "#86efac", glowColor: "none", text: "#166534", gradId: "gr-ext2",    glowId: "", isLight: true },
  ext2aff: { gradTop: "#fffbeb", gradBottom: "#fef3c7", stroke: "#fcd34d", glowColor: "none", text: "#92400e", gradId: "gr-ext2aff", glowId: "", isLight: true },
};

function getStyle(relationType: string, kind: string, isLevel2: boolean): NodeStyle {
  if (isLevel2) return kind === "blood" ? STYLES.ext2 : STYLES.ext2aff;
  switch (relationType) {
    case "root": return STYLES.root;
    case "grandfather_paternal": case "grandmother_paternal":
    case "grandfather_maternal": case "grandmother_maternal": return STYLES.gp;
    case "father": case "mother": case "stepfather": case "stepmother": return STYLES.par;
    case "father_in_law": case "mother_in_law": return STYLES.il;
    case "spouse": case "partner": return STYLES.sp;
    case "brother": case "sister": case "half_brother": case "half_sister": return STYLES.sib;
    case "brother_in_law": case "sister_in_law": return STYLES.il;
    case "son": case "daughter": case "stepchild":
    case "nephew": case "niece": return STYLES.ch;
    case "grandson": case "granddaughter": return STYLES.gc;
    case "uncle": case "aunt": case "cousin": return kind === "blood" ? STYLES.ext : STYLES.il;
    default: return kind === "blood" ? STYLES.ext : STYLES.il;
  }
}

// ── Layout types ──────────────────────────────────────────────
interface LayoutNode {
  id: string;
  name: string;
  relation: string;
  relationType: string;
  generation: number;
  posHint: number;
  kind: "root" | "blood" | "affinity";
  isLevel2: boolean;
  memberId?: string;
  avatarUrl?: string;
  isJoined?: boolean;
  x: number;
  y: number;
}

interface LayoutEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  kind: "blood" | "affinity" | "peer";
}

function computeLogicalWidth(members: FamilyMember[], extendedMembers: ExtendedEntry[]): number {
  const byGen = new Map<number, number>();
  const countGen = (gen: number) => byGen.set(gen, (byGen.get(gen) ?? 0) + 1);
  countGen(0);
  members.forEach(m => countGen(GENERATION[m.relation_type] ?? 0));
  extendedMembers.forEach(({ member: m, parentMemberId }) => {
    const parentMember = members.find(pm => pm.id === parentMemberId);
    const pGen = GENERATION[parentMember?.relation_type ?? ""] ?? 0;
    countGen(pGen + (GENERATION[m.relation_type] ?? 0));
  });
  const maxCount = Math.max(...byGen.values(), 1);
  return Math.max(620, maxCount * (NW + HGAP) + HGAP * 2);
}

function buildLayout(
  profile: Profile,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
  memberLinks: MemberLink[],
) {
  const svgWidth = computeLogicalWidth(members, extendedMembers);
  const memberGenMap = new Map<string, number>();
  members.forEach(m => memberGenMap.set(m.id, GENERATION[m.relation_type] ?? 0));

  const raw: Omit<LayoutNode, "x" | "y">[] = [
    {
      id: "root", name: profile.first_name, relation: "Tú", relationType: "root",
      generation: 0, posHint: 0, kind: "root", isLevel2: false,
      avatarUrl: profile.avatar_url, isJoined: true,
    },
    ...members.map(m => ({
      id: m.id,
      name: m.first_name,
      relation: RELATION_LABELS[m.relation_type as keyof typeof RELATION_LABELS] ?? m.relation_type,
      relationType: m.relation_type,
      generation: GENERATION[m.relation_type] ?? 0,
      posHint: POS_HINT[m.relation_type] ?? 0,
      kind: m.relation_kind as "blood" | "affinity",
      isLevel2: false,
      memberId: m.id,
      avatarUrl: (m as any).profile?.avatar_url,
      isJoined: !!m.profile_id,
    })),
    ...extendedMembers.map(({ member: m, parentMemberId, inferredRelation }) => {
      const parentGen = memberGenMap.get(parentMemberId) ?? 0;
      const parentMember = members.find(pm => pm.id === parentMemberId);
      const parentHint = POS_HINT[parentMember?.relation_type ?? ""] ?? 0;
      const extGen = parentGen + (GENERATION[m.relation_type] ?? 0);
      const extHint = parentHint + (POS_HINT[m.relation_type] ?? 0) * 0.5;
      const rel = inferredRelation
        ? (RELATION_LABELS[inferredRelation as keyof typeof RELATION_LABELS] ?? inferredRelation)
        : (RELATION_LABELS[m.relation_type as keyof typeof RELATION_LABELS] ?? m.relation_type);
      return {
        id: m.id, name: m.first_name, relation: rel, relationType: m.relation_type,
        generation: extGen, posHint: extHint,
        kind: m.relation_kind as "blood" | "affinity",
        isLevel2: true,
      };
    }),
  ];

  const byGen = new Map<number, typeof raw>();
  for (const n of raw) {
    if (!byGen.has(n.generation)) byGen.set(n.generation, []);
    byGen.get(n.generation)!.push(n);
  }
  for (const row of byGen.values()) row.sort((a, b) => a.posHint - b.posHint);

  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const minGen = gens[0] ?? 0;
  const maxGen = gens[gens.length - 1] ?? 0;

  const cx = svgWidth / 2;
  const nodes: LayoutNode[] = [];
  const posMap = new Map<string, LayoutNode>();

  for (const gen of gens) {
    const row = byGen.get(gen)!;
    const rowW = row.length * NW + (row.length - 1) * HGAP;
    const startX = cx - rowW / 2;
    const y = TOP_PAD + (gen - minGen) * (NH + VGAP);
    row.forEach((n, i) => {
      const node: LayoutNode = { ...n, x: startX + i * (NW + HGAP), y };
      nodes.push(node);
      posMap.set(n.id, node);
    });
  }

  const edges: LayoutEdge[] = [];
  const addEdge = (fromId: string, toId: string, kind: LayoutEdge["kind"]) => {
    const from = posMap.get(fromId);
    const to = posMap.get(toId);
    if (!from || !to) return;
    edges.push({ x1: from.x + NW / 2, y1: from.y + NH, x2: to.x + NW / 2, y2: to.y, kind });
  };

  // ── Edge rules ────────────────────────────────────────────────
  // Only draw lines for relationships that have a clear parent→child meaning.
  // Siblings, cousins, tíos, cuñados appear in their generation row without line
  // (their position already communicates the relationship).
  const SIBLING_TYPES   = new Set(["brother","sister","half_brother","half_sister"]);
  const NEPHEW_NIECE    = new Set(["nephew","niece"]);
  const GRANDCHILD_TYPES = new Set(["grandson","granddaughter"]);
  // Direct ancestors that draw a line to root
  const DIRECT_ANCESTORS = new Set([
    "father","mother","stepfather","stepmother",
    "grandfather_paternal","grandmother_paternal",
    "grandfather_maternal","grandmother_maternal",
  ]);
  // In-laws that draw a line to root (optional — kept subtle)
  const INLAW_ANCESTORS = new Set(["father_in_law","mother_in_law"]);
  // Spouse/partner: horizontal link
  const COUPLE_TYPES = new Set(["spouse","partner"]);

  members.forEach(m => {
    const gen = GENERATION[m.relation_type] ?? 0;

    if (gen < 0) {
      // Only direct ancestors and in-law parents get a connecting line
      if (DIRECT_ANCESTORS.has(m.relation_type)) {
        const from = posMap.get(m.id);
        const to   = posMap.get("root");
        if (from && to) edges.push({
          x1: from.x + NW / 2, y1: from.y + NH,
          x2: to.x + NW / 2,   y2: to.y,
          kind: m.relation_kind as "blood" | "affinity",
        });
      } else if (INLAW_ANCESTORS.has(m.relation_type)) {
        const from = posMap.get(m.id);
        const to   = posMap.get("root");
        if (from && to) edges.push({
          x1: from.x + NW / 2, y1: from.y + NH,
          x2: to.x + NW / 2,   y2: to.y,
          kind: "peer", // dashed — in-law, not blood ancestor
        });
      }
      // uncle, aunt → no line (appears in parent row but not connected to root)

    } else if (gen > 0) {
      if (NEPHEW_NIECE.has(m.relation_type)) {
        // Connect from the sibling that "owns" this nephew/niece
        const sibling = members.find(s => SIBLING_TYPES.has(s.relation_type));
        if (sibling) addEdge(sibling.id, m.id, m.relation_kind as "blood" | "affinity");
        // If no sibling found, no line (don't connect to root — would be confusing)
      } else if (GRANDCHILD_TYPES.has(m.relation_type)) {
        // Connect from root's child (son/daughter) if available
        const child = members.find(s => ["son","daughter"].includes(s.relation_type));
        addEdge(child?.id ?? "root", m.id, m.relation_kind as "blood" | "affinity");
      } else {
        // son, daughter, stepchild → connect from root
        addEdge("root", m.id, m.relation_kind as "blood" | "affinity");
      }

    } else {
      // Gen 0 (same generation): only draw a line for spouse/partner
      if (COUPLE_TYPES.has(m.relation_type)) {
        const from = posMap.get("root");
        const to   = posMap.get(m.id);
        if (from && to) edges.push({
          x1: from.x + NW / 2, y1: from.y + NH / 2,
          x2: to.x + NW / 2,   y2: to.y + NH / 2,
          kind: "peer", // dashed heart-line between partners
        });
      }
      // siblings, cousins, in-laws (same gen) → no line
    }
  });

  extendedMembers.forEach(({ member: m, parentMemberId }) => {
    const parent = posMap.get(parentMemberId);
    const child = posMap.get(m.id);
    if (!parent || !child) return;
    const pGen = memberGenMap.get(parentMemberId) ?? 0;
    const eGen = pGen + (GENERATION[m.relation_type] ?? 0);
    if (eGen < pGen) {
      edges.push({ x1: child.x + NW / 2, y1: child.y + NH, x2: parent.x + NW / 2, y2: parent.y, kind: m.relation_kind as "blood" | "affinity" });
    } else if (eGen > pGen) {
      edges.push({ x1: parent.x + NW / 2, y1: parent.y + NH, x2: child.x + NW / 2, y2: child.y, kind: m.relation_kind as "blood" | "affinity" });
    } else {
      edges.push({ x1: parent.x + NW / 2, y1: parent.y + NH / 2, x2: child.x + NW / 2, y2: child.y + NH / 2, kind: m.relation_kind as "blood" | "affinity" });
    }
  });

  memberLinks.forEach(l => {
    const from = posMap.get(l.fromMemberId);
    const to = posMap.get(l.toMemberId);
    if (!from || !to) return;
    edges.push({ x1: from.x + NW / 2, y1: from.y + NH / 2, x2: to.x + NW / 2, y2: to.y + NH / 2, kind: "peer" });
  });

  const totalHeight = TOP_PAD + (maxGen - minGen) * (NH + VGAP) + NH + TOP_PAD;
  return { nodes, edges, totalHeight, svgWidth };
}

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 10) return `M${x1},${y1} L${x2},${y2}`;
  const midY = (y1 + y2) / 2;
  return `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}`;
}

// ── Mini shape for legend ─────────────────────────────────────
function LegendShape({ shape, gradId, stroke }: { shape: string; gradId: string; stroke: string }) {
  const w = 20; const h = 14;
  return (
    <svg width={w} height={h} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <defs>
        <linearGradient id={`lg-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={STYLES[gradId.replace("gr-","")]?.gradTop ?? "#888"} />
          <stop offset="100%" stopColor={STYLES[gradId.replace("gr-","")]?.gradBottom ?? "#444"} />
        </linearGradient>
      </defs>
      <path d={nodePath(shape, w, h)} fill={`url(#lg-${gradId})`} stroke={stroke} strokeWidth={0.8} />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────
export default function FamilyTreeGraph({
  profile, members, extendedMembers = [], memberLinks = [], onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  const { nodes, edges, totalHeight, svgWidth } = useMemo(
    () => buildLayout(profile, members, extendedMembers, memberLinks),
    [profile, members, extendedMembers, memberLinks],
  );

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 2.5])
        .on("zoom", (e) => g.attr("transform", e.transform)),
    );
  }, []);

  const EDGE_COLORS = { blood: "#86efac", affinity: "#fcd34d", peer: "#93c5fd" };

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-[#0a0f1a]">
      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur text-xs text-gray-300 flex-wrap">
        {[
          { label: "Tú",       shape: "hexagon",       style: STYLES.root },
          { label: "Abuelos",  shape: "shield",        style: STYLES.gp   },
          { label: "Padres",   shape: "arch",          style: STYLES.par  },
          { label: "Hermanos", shape: "parallelogram", style: STYLES.sib  },
          { label: "Esposo/a", shape: "diamond",       style: STYLES.sp   },
          { label: "Hijos",    shape: "arrow_down",    style: STYLES.ch   },
          { label: "Nietos",   shape: "pill",          style: STYLES.gc   },
          { label: "Tíos",     shape: "octagon",       style: STYLES.ext  },
        ].map(({ label, shape, style }) => (
          <span key={label} className="flex items-center gap-1.5">
            <svg width={20} height={14} style={{ display: "inline-block", verticalAlign: "middle" }}>
              <defs>
                <linearGradient id={`leg-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={style.gradTop} />
                  <stop offset="100%" stopColor={style.gradBottom} />
                </linearGradient>
              </defs>
              <path d={nodePath(shape, 20, 14)} fill={`url(#leg-${label})`} stroke={style.stroke} strokeWidth={0.8} />
            </svg>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block ring-1 ring-green-300" />
          En Ceiba
        </span>
        <span className="ml-auto text-gray-500">Arrastra · Pellizca para zoom</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: Math.max(420, totalHeight), background: "transparent" }}
        viewBox={`0 0 ${svgWidth} ${Math.max(420, totalHeight)}`}
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          {/* Animations */}
          <style>{`
            @keyframes ceiba-glow-pulse {
              0%, 100% { opacity: 0.50; }
              50%       { opacity: 0.90; }
            }
            @keyframes ceiba-glow-pulse-root {
              0%, 100% { opacity: 0.75; }
              50%       { opacity: 1.00; }
            }
            @keyframes ceiba-edge-flow {
              from { stroke-dashoffset: 24; }
              to   { stroke-dashoffset: 0; }
            }
            .glow-pulse      { animation: ceiba-glow-pulse      3.2s ease-in-out infinite; }
            .glow-pulse-root { animation: ceiba-glow-pulse-root 2.5s ease-in-out infinite; }
            .edge-flow       { animation: ceiba-edge-flow       1.8s linear infinite; }
          `}</style>

          {/* Gradient fills — userSpaceOnUse so y=0..NH maps to top-to-bottom per node */}
          {GRAD_DEFS.map(([id, top, bottom]) => (
            <linearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={NH}>
              <stop offset="0%" stopColor={top} />
              <stop offset="100%" stopColor={bottom} />
            </linearGradient>
          ))}

          {/* Shine overlay — white highlight in top half */}
          <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={NH}>
            <stop offset="0%"   stopColor="white" stopOpacity="0.20" />
            <stop offset="50%"  stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Light shine for level-2 nodes */}
          <linearGradient id="shine-dark" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={NH}>
            <stop offset="0%"   stopColor="white" stopOpacity="0.50" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Colored glow filters per category */}
          {GLOW_DEFS.map(([id, color]) => (
            <filter key={id} id={id} x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={color} floodOpacity="0.50" />
            </filter>
          ))}

          {/* Subtle dark shadow for level-2 nodes */}
          <filter id="shadow-sm" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Dark radial vignette bg for atmosphere */}
        <radialGradient id="bg-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#111827" />
          <stop offset="100%" stopColor="#060b14" />
        </radialGradient>
        <rect width={svgWidth} height={Math.max(420, totalHeight)} fill="url(#bg-vignette)" />

        <g ref={gRef}>
          {/* Edges */}
          {edges.map((e, i) => {
            const isPeer = e.kind === "peer";
            const isBlood = e.kind === "blood";
            return (
              <path
                key={i}
                d={elbowPath(e.x1, e.y1, e.x2, e.y2)}
                fill="none"
                stroke={EDGE_COLORS[e.kind]}
                strokeWidth={isPeer ? 1.5 : 2}
                strokeDasharray={isPeer ? "5,3" : isBlood ? "8,6" : undefined}
                strokeLinecap="round"
                opacity={isPeer ? 0.45 : 0.7}
                className={isBlood ? "edge-flow" : undefined}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const isRoot = n.id === "root";
            const isLevel2 = n.isLevel2;
            const isJoined = n.isJoined && !isRoot;
            const style = getStyle(n.relationType, n.kind, isLevel2);
            const shape = isLevel2 ? "default" : (RELATION_SHAPE[n.relationType] ?? "default");
            const clickable = !isRoot && !isLevel2 && !!n.memberId;

            const hasAvatar = !!(n.avatarUrl && (isJoined || isRoot));
            const textX = NW / 2;

            // Stroke: joined gets bright green, otherwise the style's stroke
            const strokeColor = isJoined ? "#4ade80" : style.stroke;
            const strokeW = isRoot ? 2 : isJoined ? 2 : 1.5;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={clickable ? () => onNodeClick?.(n.memberId!) : undefined}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                {/* Glow — only for direct (non-level2) nodes; pulses for joined/root */}
                {!isLevel2 && style.glowId && (
                  <path
                    d={nodePath(shape, NW, NH)}
                    fill={`url(#${style.gradId})`}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    filter={`url(#${style.glowId})`}
                    opacity={isRoot ? 0.8 : 0.55}
                    className={isRoot ? "glow-pulse-root" : (isJoined ? "glow-pulse" : undefined)}
                  />
                )}

                {/* Main shape with gradient */}
                <path
                  d={nodePath(shape, NW, NH)}
                  fill={`url(#${style.gradId})`}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  filter={isLevel2 ? "url(#shadow-sm)" : undefined}
                />

                {/* Semi-dark overlay for text readability when photo is shown */}
                {hasAvatar && (
                  <path
                    d={nodePath(shape, NW, NH)}
                    fill="rgba(0,0,0,0.45)"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Shine overlay */}
                <path
                  d={nodePath(shape, NW, NH)}
                  fill={`url(#${isLevel2 ? "shine-dark" : "shine"})`}
                  style={{ pointerEvents: "none" }}
                />

                {/* Root star badge */}
                {isRoot && (
                  <>
                    <circle cx={NW - 12} cy={12} r={10} fill="#f59e0b" opacity={0.95} />
                    <text x={NW - 12} y={16} textAnchor="middle" fontSize={11} fill="#fff" fontFamily="system-ui">★</text>
                  </>
                )}

                {/* Avatar — fills the geometric shape as a semi-transparent overlay */}
                {hasAvatar && (
                  <>
                    <clipPath id={`clip-${n.id}`}>
                      <path d={nodePath(shape, NW, NH)} />
                    </clipPath>
                    <image
                      href={n.avatarUrl}
                      x={0} y={0}
                      width={NW} height={NH}
                      clipPath={`url(#clip-${n.id})`}
                      preserveAspectRatio="xMidYMid slice"
                      opacity={0.38}
                    />
                  </>
                )}

                {/* Green dot for joined members without avatar */}
                {isJoined && !n.avatarUrl && (
                  <>
                    <circle cx={NW - 9} cy={9} r={6} fill="#15803d" />
                    <circle cx={NW - 9} cy={9} r={3.5} fill="#4ade80" />
                  </>
                )}

                {/* Name */}
                <text
                  x={textX}
                  y={isLevel2 ? NH / 2 - 5 : NH / 2 - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={style.text}
                  fontSize={isLevel2 ? 10 : 12}
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  style={{ letterSpacing: "0.01em" }}
                >
                  {n.name.length > 11 ? n.name.slice(0, 10) + "…" : n.name}
                </text>

                {/* Relation label */}
                <text
                  x={textX}
                  y={NH / 2 + 9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={style.isLight ? style.text : "rgba(255,255,255,0.65)"}
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                >
                  {n.relation.length > 14 ? n.relation.slice(0, 13) + "…" : n.relation}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
