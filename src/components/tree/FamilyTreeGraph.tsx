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

// ── Constantes de layout ──────────────────────────────────────
const NW = 115;   // node width
const NH = 52;    // node height
const HGAP = 24;  // horizontal gap between nodes
const VGAP = 72;  // vertical gap between rows
const TOP_PAD = 48;

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

// Position hint: determines horizontal order within a generation row
// Negative = left, Positive = right, 0 = center
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
  niece: -2, nephew: 2,
  granddaughter: -1, grandson: 1,
};

const KIND_COLORS = {
  root:     { fill: "#15803d", text: "#fff", stroke: "#166534" },
  blood:    { fill: "#166534", text: "#fff", stroke: "#14532d" },
  affinity: { fill: "#92400e", text: "#fff", stroke: "#78350f" },
  ext:      { fill: "#f0fdf4", text: "#166534", stroke: "#86efac" },
  extAff:   { fill: "#fffbeb", text: "#92400e", stroke: "#fcd34d" },
};

interface LayoutNode {
  id: string;
  name: string;
  relation: string;
  generation: number;
  posHint: number;
  kind: "root" | "blood" | "affinity";
  isLevel2: boolean;
  memberId?: string; // for click (level-1 members)
  x: number;
  y: number;
}

interface LayoutEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  kind: "blood" | "affinity" | "peer";
}

// Compute the logical canvas width needed for the widest row
function computeLogicalWidth(members: FamilyMember[], extendedMembers: ExtendedEntry[]): number {
  const byGen = new Map<number, number>();
  const countGen = (gen: number) => byGen.set(gen, (byGen.get(gen) ?? 0) + 1);
  countGen(0); // root
  members.forEach(m => countGen(GENERATION[m.relation_type] ?? 0));
  extendedMembers.forEach(({ member: m, parentMemberId }) => {
    const parentMember = members.find(pm => pm.id === parentMemberId);
    const pGen = GENERATION[parentMember?.relation_type ?? ""] ?? 0;
    countGen(pGen + (GENERATION[m.relation_type] ?? 0));
  });
  const maxCount = Math.max(...byGen.values(), 1);
  return Math.max(600, maxCount * (NW + HGAP) + HGAP * 2);
}

function buildLayout(
  profile: Profile,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
  memberLinks: MemberLink[],
) {
  const svgWidth = computeLogicalWidth(members, extendedMembers);
  // ── 1. Create raw nodes ──────────────────────────────────────
  const memberGenMap = new Map<string, number>();
  members.forEach(m => memberGenMap.set(m.id, GENERATION[m.relation_type] ?? 0));

  const raw: Omit<LayoutNode, "x" | "y">[] = [
    { id: "root", name: profile.first_name, relation: "Tú",
      generation: 0, posHint: 0, kind: "root", isLevel2: false },
    ...members.map(m => ({
      id: m.id,
      name: m.first_name,
      relation: RELATION_LABELS[m.relation_type as keyof typeof RELATION_LABELS] ?? m.relation_type,
      generation: GENERATION[m.relation_type] ?? 0,
      posHint: POS_HINT[m.relation_type] ?? 0,
      kind: m.relation_kind as "blood" | "affinity",
      isLevel2: false,
      memberId: m.id,
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
        id: m.id,
        name: m.first_name,
        relation: rel,
        generation: extGen,
        posHint: extHint,
        kind: m.relation_kind as "blood" | "affinity",
        isLevel2: true,
      };
    }),
  ];

  // ── 2. Group by generation, sort by posHint ──────────────────
  const byGen = new Map<number, typeof raw>();
  for (const n of raw) {
    if (!byGen.has(n.generation)) byGen.set(n.generation, []);
    byGen.get(n.generation)!.push(n);
  }
  // Sort each row by posHint
  for (const row of byGen.values()) {
    row.sort((a, b) => a.posHint - b.posHint);
  }

  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const minGen = gens[0] ?? 0;
  const maxGen = gens[gens.length - 1] ?? 0;

  // ── 3. Assign x positions ────────────────────────────────────
  const cx = svgWidth / 2;
  const nodes: LayoutNode[] = [];
  const posMap = new Map<string, LayoutNode>();

  for (const gen of gens) {
    const row = byGen.get(gen)!;
    const rowW = row.length * NW + (row.length - 1) * HGAP;
    const startX = cx - rowW / 2;
    const y = TOP_PAD + (gen - minGen) * (NH + VGAP);

    row.forEach((n, i) => {
      const node: LayoutNode = {
        ...n,
        x: startX + i * (NW + HGAP),
        y,
      };
      nodes.push(node);
      posMap.set(n.id, node);
    });
  }

  // ── 4. Build edges ───────────────────────────────────────────
  const edges: LayoutEdge[] = [];

  const addEdge = (fromId: string, toId: string, kind: LayoutEdge["kind"]) => {
    const from = posMap.get(fromId);
    const to = posMap.get(toId);
    if (!from || !to) return;
    edges.push({
      x1: from.x + NW / 2, y1: from.y + NH,
      x2: to.x + NW / 2,  y2: to.y,
      kind,
    });
  };

  // Root → direct members
  members.forEach(m => {
    const gen = GENERATION[m.relation_type] ?? 0;
    if (gen < 0) {
      // ancestor: ancestor bottom → root top
      const from = posMap.get(m.id);
      const to = posMap.get("root");
      if (from && to) edges.push({ x1: from.x + NW/2, y1: from.y + NH, x2: to.x + NW/2, y2: to.y, kind: m.relation_kind as "blood" | "affinity" });
    } else if (gen > 0) {
      // descendant: root bottom → descendant top
      addEdge("root", m.id, m.relation_kind as "blood" | "affinity");
    } else {
      // same gen: horizontal connector
      const from = posMap.get("root");
      const to = posMap.get(m.id);
      if (from && to) edges.push({ x1: from.x + NW/2, y1: from.y + NH/2, x2: to.x + NW/2, y2: to.y + NH/2, kind: m.relation_kind as "blood" | "affinity" });
    }
  });

  // Extended members → their parent direct member
  extendedMembers.forEach(({ member: m, parentMemberId }) => {
    const parent = posMap.get(parentMemberId);
    const child = posMap.get(m.id);
    if (!parent || !child) return;
    const pGen = memberGenMap.get(parentMemberId) ?? 0;
    const eGen = pGen + (GENERATION[m.relation_type] ?? 0);
    if (eGen < pGen) {
      edges.push({ x1: child.x + NW/2, y1: child.y + NH, x2: parent.x + NW/2, y2: parent.y, kind: m.relation_kind as "blood" | "affinity" });
    } else if (eGen > pGen) {
      edges.push({ x1: parent.x + NW/2, y1: parent.y + NH, x2: child.x + NW/2, y2: child.y, kind: m.relation_kind as "blood" | "affinity" });
    } else {
      edges.push({ x1: parent.x + NW/2, y1: parent.y + NH/2, x2: child.x + NW/2, y2: child.y + NH/2, kind: m.relation_kind as "blood" | "affinity" });
    }
  });

  // Member peer links (direct member ↔ direct member)
  memberLinks.forEach(l => {
    const from = posMap.get(l.fromMemberId);
    const to = posMap.get(l.toMemberId);
    if (!from || !to) return;
    edges.push({ x1: from.x + NW/2, y1: from.y + NH/2, x2: to.x + NW/2, y2: to.y + NH/2, kind: "peer" });
  });

  const totalHeight = TOP_PAD + (maxGen - minGen) * (NH + VGAP) + NH + TOP_PAD;
  return { nodes, edges, totalHeight, svgWidth };
}

// ── Elbow path (org chart connector) ─────────────────────────
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 10) {
    // horizontal connection
    return `M${x1},${y1} L${x2},${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}`;
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

  // D3 zoom/pan only
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
    <div className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-white text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-800 inline-block" /> Sangre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-800 inline-block" /> Política
        </span>
        {extendedMembers.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-green-300 bg-green-50 inline-block" /> 2° grado
          </span>
        )}
        {memberLinks.length > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="6" viewBox="0 0 14 6">
              <line x1="0" y1="3" x2="14" y2="3" stroke="#93c5fd" strokeWidth="2" strokeDasharray="4,2"/>
            </svg>
            Vínculo directo
          </span>
        )}
        <span className="ml-auto text-gray-400">Arrastra · Pellizca para zoom</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: Math.max(400, totalHeight) }}
        viewBox={`0 0 ${svgWidth} ${Math.max(400, totalHeight)}`}
        preserveAspectRatio="xMidYMin meet"
      >
        <g ref={gRef}>
          {/* Edges */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={elbowPath(e.x1, e.y1, e.x2, e.y2)}
              fill="none"
              stroke={EDGE_COLORS[e.kind]}
              strokeWidth={e.kind === "peer" ? 2 : 2.5}
              strokeDasharray={e.kind === "peer" ? "5,3" : undefined}
              strokeLinecap="round"
            />
          ))}

          {/* Nodes */}
          {nodes.map((n) => {
            const isRoot = n.id === "root";
            const isLevel2 = n.isLevel2;
            const colors = isRoot
              ? KIND_COLORS.root
              : isLevel2
                ? (n.kind === "blood" ? KIND_COLORS.ext : KIND_COLORS.extAff)
                : (n.kind === "blood" ? KIND_COLORS.blood : KIND_COLORS.affinity);
            const rx = 10;
            const clickable = !isRoot && !isLevel2 && !!n.memberId;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={clickable ? () => onNodeClick?.(n.memberId!) : undefined}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                {/* Shadow */}
                <rect
                  x={2} y={2} width={NW} height={NH} rx={rx}
                  fill="rgba(0,0,0,0.08)"
                />
                {/* Card */}
                <rect
                  width={NW} height={NH} rx={rx}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isRoot ? 2.5 : 1.5}
                />
                {/* Root star badge */}
                {isRoot && (
                  <circle cx={NW - 10} cy={10} r={7} fill="#fbbf24" />
                )}
                {/* Name */}
                <text
                  x={NW / 2} y={isLevel2 ? NH / 2 - 6 : NH / 2 - 7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={isLevel2 ? 11 : 12}
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {n.name.length > 11 ? n.name.slice(0, 10) + "…" : n.name}
                </text>
                {/* Relation badge */}
                <text
                  x={NW / 2} y={NH / 2 + 9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isLevel2 ? colors.text : "rgba(255,255,255,0.8)"}
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
