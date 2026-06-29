"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
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
const R = 28;           // circle radius
const ROOT_R = 34;      // root circle radius
const LABEL_H = 38;     // height for name + relation labels below circle
const HGAP = 22;        // horizontal gap between circles
const VGAP = 64;        // vertical gap between bottom-of-label and top-of-next-circle
const TOP_PAD = 48;

// Slot width per node (for layout calculations)
const SLOT_W = R * 2 + HGAP;

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

// ── Color per relation ─────────────────────────────────────────
function getNodeColor(relationType: string, kind: string): { ring: string; bg: string } {
  if (relationType === "root")  return { ring: "#4ade80", bg: "#052e16" };
  const gen = GENERATION[relationType] ?? 0;
  if (gen <= -2) return { ring: "#93c5fd", bg: "#1e3a8a" }; // abuelos — blue
  if (gen === -1) {
    if (["father_in_law","mother_in_law"].includes(relationType)) return { ring: "#fcd34d", bg: "#78350f" };
    if (["stepfather","stepmother"].includes(relationType))        return { ring: "#fbbf24", bg: "#451a03" };
    return { ring: "#bfdbfe", bg: "#1e40af" }; // padres — blue
  }
  if (gen === 0) {
    if (["spouse","partner"].includes(relationType))               return { ring: "#fca5a5", bg: "#7f1d1d" };
    if (["brother_in_law","sister_in_law"].includes(relationType)) return { ring: "#fcd34d", bg: "#78350f" };
    return { ring: "#c4b5fd", bg: "#4c1d95" }; // siblings/cousins — purple
  }
  if (gen === 1) return { ring: "#67e8f9", bg: "#0c4a6e" }; // children — cyan
  return { ring: "#5eead4", bg: "#134e4a" }; // grandchildren — teal
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

// ── Layout types ──────────────────────────────────────────────
interface LayoutNode {
  id: string;
  name: string;
  shortName: string;
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
  cx: number; // circle center x
  cy: number; // circle center y
  r: number;  // radius
}

interface LayoutEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  kind: "blood" | "affinity" | "peer";
}

function buildLayout(
  profile: Profile,
  members: FamilyMember[],
  visibleExtended: ExtendedEntry[],
  memberLinks: MemberLink[],
) {
  const memberGenMap = new Map<string, number>();
  members.forEach(m => memberGenMap.set(m.id, GENERATION[m.relation_type] ?? 0));

  // Build raw node list
  const raw: Omit<LayoutNode, "cx" | "cy" | "r">[] = [
    {
      id: "root",
      name: profile.first_name,
      shortName: profile.first_name.slice(0, 10),
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
      shortName: m.first_name.slice(0, 10),
      relation: RELATION_LABELS[m.relation_type as keyof typeof RELATION_LABELS] ?? m.relation_type,
      relationType: m.relation_type,
      generation: GENERATION[m.relation_type] ?? 0,
      posHint: POS_HINT[m.relation_type] ?? 0,
      kind: m.relation_kind as "blood" | "affinity",
      isExtended: false,
      memberId: m.id,
      avatarUrl: (m as any).profile?.avatar_url ?? null,
      isJoined: !!m.profile_id,
      isActive: isRecentlyActive((m as any).profile?.last_seen_at),
    })),
    ...visibleExtended.map(({ member: m, parentMemberId, inferredRelation }) => {
      const parentGen = memberGenMap.get(parentMemberId) ?? 0;
      const parentMember = members.find(pm => pm.id === parentMemberId);
      const parentHint = POS_HINT[parentMember?.relation_type ?? ""] ?? 0;
      const extGen = parentGen + (GENERATION[m.relation_type] ?? 0);
      const extHint = parentHint + (POS_HINT[m.relation_type] ?? 0) * 0.5;

      const isGreatGrandparent = extGen <= -3 && !!inferredRelation &&
        (inferredRelation.includes("grandfather") || inferredRelation.includes("grandmother"));
      const finalRelType = isGreatGrandparent ? "bisabuelo" : (inferredRelation || m.relation_type);
      const relLabel = isGreatGrandparent
        ? (["father","grandfather_paternal","grandfather_maternal"].includes(m.relation_type) ? "Bisabuelo" : "Bisabuela")
        : (RELATION_LABELS[finalRelType as keyof typeof RELATION_LABELS] ?? finalRelType);

      return {
        id: m.id,
        name: m.first_name + (m.last_name ? " " + m.last_name : ""),
        shortName: m.first_name.slice(0, 10),
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

  // ── Edges ─────────────────────────────────────────────────────
  const edges: LayoutEdge[] = [];

  const addVertEdge = (fromId: string, toId: string, kind: LayoutEdge["kind"]) => {
    const from = posMap.get(fromId);
    const to = posMap.get(toId);
    if (!from || !to) return;
    // from bottom of circle → to top of circle
    edges.push({ x1: from.cx, y1: from.cy + from.r, x2: to.cx, y2: to.cy - to.r, kind });
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
    });
  };

  const DIRECT_ANCESTORS = new Set(["father","mother","stepfather","stepmother","grandfather_paternal","grandmother_paternal","grandfather_maternal","grandmother_maternal"]);
  const COUPLE_TYPES     = new Set(["spouse","partner"]);
  const SIBLING_TYPES    = new Set(["brother","sister","half_brother","half_sister"]);
  const NEPHEW_NIECE     = new Set(["nephew","niece"]);
  const GRANDCHILD_TYPES = new Set(["grandson","granddaughter"]);

  members.forEach(m => {
    const gen = GENERATION[m.relation_type] ?? 0;
    if (gen < 0) {
      if (DIRECT_ANCESTORS.has(m.relation_type)) addVertEdge(m.id, "root", m.relation_kind as "blood" | "affinity");
      else if (["father_in_law","mother_in_law"].includes(m.relation_type)) addVertEdge(m.id, "root", "peer");
    } else if (gen > 0) {
      if (NEPHEW_NIECE.has(m.relation_type)) {
        const sib = members.find(s => SIBLING_TYPES.has(s.relation_type));
        if (sib) addVertEdge(sib.id, m.id, m.relation_kind as "blood" | "affinity");
      } else if (GRANDCHILD_TYPES.has(m.relation_type)) {
        const child = members.find(s => ["son","daughter"].includes(s.relation_type));
        addVertEdge(child?.id ?? "root", m.id, m.relation_kind as "blood" | "affinity");
      } else {
        addVertEdge("root", m.id, m.relation_kind as "blood" | "affinity");
      }
    } else {
      if (COUPLE_TYPES.has(m.relation_type)) addHorizEdge("root", m.id, "peer");
    }
  });

  visibleExtended.forEach(({ member: m, parentMemberId }) => {
    const parent = posMap.get(parentMemberId);
    const child = posMap.get(m.id);
    if (!parent || !child) return;
    const pGen = memberGenMap.get(parentMemberId) ?? 0;
    const eGen = pGen + (GENERATION[m.relation_type] ?? 0);
    if (eGen !== pGen) {
      const upper = eGen < pGen ? m.id : parentMemberId;
      const lower = eGen < pGen ? parentMemberId : m.id;
      addVertEdge(upper, lower, m.relation_kind as "blood" | "affinity");
    } else {
      addHorizEdge(parentMemberId, m.id, "peer");
    }
  });

  memberLinks.forEach(l => {
    const from = posMap.get(l.fromMemberId);
    const to = posMap.get(l.toMemberId);
    if (!from || !to) return;
    edges.push({
      x1: from.cx, y1: from.cy,
      x2: to.cx,   y2: to.cy,
      kind: "peer",
    });
  });

  const totalHeight = TOP_PAD + ROOT_R + (maxGen - minGen) * ROW_STEP + R + LABEL_H + TOP_PAD;
  return { nodes, edges, totalHeight, svgWidth, posMap };
}

// ── Bezier path ───────────────────────────────────────────────
function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 6) return `M${x1},${y1} L${x2},${y2}`;
  const mid = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
}

// ── Main component ────────────────────────────────────────────
export default function FamilyTreeGraph({
  profile, members, extendedMembers = [], memberLinks = [], onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef   = useRef<SVGGElement>(null);

  // Which direct members have their extended branch expanded
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Count extended members per parent (for badge)
  const extCountByParent = useMemo(() => {
    const m = new Map<string, number>();
    extendedMembers.forEach(e => m.set(e.parentMemberId, (m.get(e.parentMemberId) ?? 0) + 1));
    return m;
  }, [extendedMembers]);

  const visibleExtended = useMemo(
    () => extendedMembers.filter(e => expandedParents.has(e.parentMemberId)),
    [extendedMembers, expandedParents],
  );

  const { nodes, edges, totalHeight, svgWidth } = useMemo(
    () => buildLayout(profile, members, visibleExtended, memberLinks),
    [profile, members, visibleExtended, memberLinks],
  );

  // D3 zoom
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g   = d3.select(gRef.current);
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 3])
        .on("zoom", e => g.attr("transform", e.transform)),
    );
  }, []);

  const handleNodeClick = useCallback((node: LayoutNode) => {
    const extCount = node.memberId ? (extCountByParent.get(node.memberId) ?? 0) : 0;
    if (extCount > 0 && node.memberId) {
      // Toggle expansion
      setExpandedParents(prev => {
        const next = new Set(prev);
        if (next.has(node.memberId!)) next.delete(node.memberId!);
        else next.add(node.memberId!);
        return next;
      });
    } else if (node.memberId && !node.isExtended) {
      onNodeClick?.(node.memberId);
    }
  }, [extCountByParent, onNodeClick]);

  const EDGE_COLORS = { blood: "#86efac", affinity: "#fcd34d", peer: "#94a3b8" };

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-800 bg-[#060b14]">

      {/* Hint bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5 bg-white/[0.03] text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-green-400" />
          Activo hoy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-600" />
          En Ceiba
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white font-bold" style={{fontSize: 8}}>+N</span>
          Toca para expandir
        </span>
        <span className="ml-auto">Arrastra · Pellizca para zoom</span>
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
            @keyframes live-ring {
              0%, 100% { opacity: 0.35; }
              50%       { opacity: 0.95; }
            }
            @keyframes root-ring {
              0%, 100% { opacity: 0.5; }
              50%       { opacity: 1; }
            }
            @keyframes edge-flow {
              from { stroke-dashoffset: 20; }
              to   { stroke-dashoffset: 0; }
            }
            .live-pulse { animation: live-ring 2.4s ease-in-out infinite; }
            .root-pulse { animation: root-ring 2.8s ease-in-out infinite; }
            .edge-anim  { animation: edge-flow  1.6s linear infinite; }
          `}</style>

          {/* Radial bg */}
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="#0f1929" />
            <stop offset="100%" stopColor="#04080f" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow-green" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#4ade80" floodOpacity="0.7" />
          </filter>
          <filter id="glow-blue" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#93c5fd" floodOpacity="0.5" />
          </filter>
          <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#c4b5fd" floodOpacity="0.5" />
          </filter>
          <filter id="glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#67e8f9" floodOpacity="0.5" />
          </filter>
          <filter id="shadow-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Background */}
        <rect width={svgWidth} height={Math.max(380, totalHeight)} fill="url(#bg-grad)" />

        <g ref={gRef}>
          {/* ── Edges ── */}
          {edges.map((e, i) => {
            const isPeer = e.kind === "peer";
            const isBlood = e.kind === "blood";
            return (
              <path
                key={i}
                d={curvePath(e.x1, e.y1, e.x2, e.y2)}
                fill="none"
                stroke={EDGE_COLORS[e.kind]}
                strokeWidth={isPeer ? 1.2 : 1.8}
                strokeDasharray={isPeer ? "4,3" : isBlood ? "6,5" : undefined}
                strokeLinecap="round"
                opacity={isPeer ? 0.35 : 0.6}
                className={isBlood ? "edge-anim" : undefined}
              />
            );
          })}

          {/* ── Nodes ── */}
          {nodes.map(n => {
            const isRoot    = n.id === "root";
            const isJoined  = n.isJoined && !isRoot;
            const isActive  = n.isActive && !isRoot;
            const r         = n.r;
            const { ring, bg } = getNodeColor(n.relationType, n.kind);
            const hasPhoto  = !!(n.avatarUrl);
            const hue       = nameToHue(n.name);
            const avatarBg  = hasPhoto ? bg : `hsl(${hue}, 45%, 30%)`;

            const extCount   = n.memberId ? (extCountByParent.get(n.memberId) ?? 0) : 0;
            const isExpanded = n.memberId ? expandedParents.has(n.memberId) : false;
            const hasBadge   = extCount > 0 && !n.isExtended;
            const clickable  = !isRoot && (!n.isExtended || false);

            // Glow filter selection
            let glowFilter = "url(#glow-blue)";
            if (isRoot) glowFilter = "url(#glow-green)";
            else if (["son","daughter","stepchild","nephew","niece"].includes(n.relationType)) glowFilter = "url(#glow-cyan)";
            else if (GENERATION[n.relationType] === 0) glowFilter = "url(#glow-purple)";

            return (
              <g
                key={n.id}
                onClick={clickable ? () => handleNodeClick(n) : undefined}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                {/* Pulsing live ring (active members) */}
                {isRoot && (
                  <circle
                    cx={n.cx} cy={n.cy} r={ROOT_R + 6}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                    className="root-pulse"
                  />
                )}
                {isActive && (
                  <circle
                    cx={n.cx} cy={n.cy} r={R + 5}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                    className="live-pulse"
                  />
                )}

                {/* Glow backdrop for primary nodes */}
                {!n.isExtended && (
                  <circle
                    cx={n.cx} cy={n.cy} r={r}
                    fill={bg}
                    stroke={ring}
                    strokeWidth={isRoot ? 2.5 : 2}
                    filter={glowFilter}
                    opacity={isRoot ? 0.9 : 0.5}
                  />
                )}

                {/* Main circle */}
                <circle
                  cx={n.cx} cy={n.cy} r={r}
                  fill={avatarBg}
                  stroke={isJoined ? "#4ade80" : isActive ? "#4ade80" : n.isExtended ? "#374151" : ring}
                  strokeWidth={isRoot ? 2.5 : isJoined ? 2 : 1.5}
                  filter={n.isExtended ? "url(#shadow-soft)" : undefined}
                />

                {/* Photo clip */}
                {hasPhoto && (
                  <>
                    <clipPath id={`cp-${n.id}`}>
                      <circle cx={n.cx} cy={n.cy} r={r - 1} />
                    </clipPath>
                    <image
                      href={n.avatarUrl!}
                      x={n.cx - r} y={n.cy - r}
                      width={r * 2} height={r * 2}
                      clipPath={`url(#cp-${n.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    {/* Dark overlay so text is readable */}
                    <circle cx={n.cx} cy={n.cy} r={r - 1} fill="rgba(0,0,0,0.3)" clipPath={`url(#cp-${n.id})`} />
                  </>
                )}

                {/* Initial letter if no photo */}
                {!hasPhoto && (
                  <text
                    x={n.cx} y={n.cy + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={r * 0.75}
                    fontWeight="700"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {n.name[0]?.toUpperCase() ?? "?"}
                  </text>
                )}

                {/* Green dot for joined (not active — active already has ring) */}
                {isJoined && !isActive && (
                  <circle
                    cx={n.cx + r * 0.68}
                    cy={n.cy - r * 0.68}
                    r={5}
                    fill="#15803d"
                    stroke="#060b14"
                    strokeWidth={1.5}
                  />
                )}
                {isJoined && !isActive && (
                  <circle
                    cx={n.cx + r * 0.68}
                    cy={n.cy - r * 0.68}
                    r={3}
                    fill="#4ade80"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* +N expansion badge */}
                {hasBadge && (
                  <g>
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

                {/* Name */}
                <text
                  x={n.cx}
                  y={n.cy + r + 14}
                  textAnchor="middle"
                  fill={n.isExtended ? "#9ca3af" : "white"}
                  fontSize={n.isExtended ? 9 : 11}
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {n.shortName}
                </text>

                {/* Relation */}
                <text
                  x={n.cx}
                  y={n.cy + r + 27}
                  textAnchor="middle"
                  fill={n.isExtended ? "#6b7280" : "rgba(255,255,255,0.55)"}
                  fontSize={8.5}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {n.relation.length > 13 ? n.relation.slice(0, 12) + "…" : n.relation}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
