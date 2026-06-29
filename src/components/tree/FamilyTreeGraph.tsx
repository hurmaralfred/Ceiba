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

// ── 3D sphere color palettes ──────────────────────────────────
// Each palette: { ring, hi (highlight), mid, shadow }
// Radial gradient cx=33% cy=28% creates the 3D lit-from-top-left look
interface SphereColor { ring: string; hi: string; mid: string; shadow: string }

function getNodeColor(relationType: string, kind: string): SphereColor {
  if (relationType === "root")
    return { ring: "#4ade80", hi: "#bbf7d0", mid: "#22c55e", shadow: "#052e16" };
  const gen = GENERATION[relationType] ?? 0;
  if (gen <= -2)
    return { ring: "#93c5fd", hi: "#dbeafe", mid: "#3b82f6", shadow: "#1e3a8a" }; // abuelos
  if (gen === -1) {
    if (["father_in_law","mother_in_law"].includes(relationType))
      return { ring: "#fcd34d", hi: "#fef9c3", mid: "#f59e0b", shadow: "#78350f" };
    if (["stepfather","stepmother"].includes(relationType))
      return { ring: "#fbbf24", hi: "#fef3c7", mid: "#d97706", shadow: "#451a03" };
    return { ring: "#bfdbfe", hi: "#eff6ff", mid: "#60a5fa", shadow: "#1e40af" }; // padres
  }
  if (gen === 0) {
    if (["spouse","partner"].includes(relationType))
      return { ring: "#fca5a5", hi: "#fee2e2", mid: "#f87171", shadow: "#7f1d1d" };
    if (["brother_in_law","sister_in_law"].includes(relationType))
      return { ring: "#fcd34d", hi: "#fef9c3", mid: "#f59e0b", shadow: "#78350f" };
    return { ring: "#c4b5fd", hi: "#ede9fe", mid: "#a78bfa", shadow: "#4c1d95" }; // hermanos/primos
  }
  if (gen === 1)
    return { ring: "#67e8f9", hi: "#cffafe", mid: "#22d3ee", shadow: "#0c4a6e" }; // hijos
  return { ring: "#5eead4", hi: "#ccfbf1", mid: "#2dd4bf", shadow: "#134e4a" }; // nietos
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
  isDeceased?: boolean;
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
      isDeceased: !!(m as any).is_deceased,
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
        const parentId = (m as any).parent_member_id;
        const sib = parentId
          ? members.find(s => s.id === parentId)
          : undefined;
        if (sib) addVertEdge(sib.id, m.id, m.relation_kind as "blood" | "affinity");
        else addVertEdge("root", m.id, m.relation_kind as "blood" | "affinity");
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
      // Toggle expansion of this node's extended branch
      setExpandedParents(prev => {
        const next = new Set(prev);
        if (next.has(node.memberId!)) next.delete(node.memberId!);
        else next.add(node.memberId!);
        return next;
      });
    } else if (node.memberId && !node.isExtended) {
      // Direct member without extended children → open profile
      onNodeClick?.(node.memberId);
    }
    // Extended members with no children: no-op (no profile to open)
  }, [extCountByParent, onNodeClick]);

  const EDGE_COLORS = { blood: "#86efac", affinity: "#fcd34d", peer: "#94a3b8" };

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
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600 bg-[#1c1c1c] text-gray-400" style={{fontSize: 9, fontFamily: "Georgia, serif"}}>†</span>
          Fallecido
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
            @keyframes live-ring  { 0%,100%{opacity:0.35} 50%{opacity:0.95} }
            @keyframes root-ring  { 0%,100%{opacity:0.5}  50%{opacity:1}    }
            @keyframes edge-flow  { from{stroke-dashoffset:20} to{stroke-dashoffset:0} }

            /* ── Float variants — 8 amplitudes & speeds ── */
            @keyframes fl0 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-4px)}   }
            @keyframes fl1 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-6px)}   }
            @keyframes fl2 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-3px)}   }
            @keyframes fl3 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-5.5px)} }
            @keyframes fl4 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-7px)}   }
            @keyframes fl5 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-4.5px)} }
            @keyframes fl6 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-5px)}   }
            @keyframes fl7 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-3.5px)} }

            .f0 { transform-box:fill-box; transform-origin:center; animation:fl0 3.0s ease-in-out infinite 0.0s; }
            .f1 { transform-box:fill-box; transform-origin:center; animation:fl1 3.6s ease-in-out infinite 0.7s; }
            .f2 { transform-box:fill-box; transform-origin:center; animation:fl2 2.8s ease-in-out infinite 1.3s; }
            .f3 { transform-box:fill-box; transform-origin:center; animation:fl3 3.9s ease-in-out infinite 0.4s; }
            .f4 { transform-box:fill-box; transform-origin:center; animation:fl4 3.2s ease-in-out infinite 1.9s; }
            .f5 { transform-box:fill-box; transform-origin:center; animation:fl5 4.1s ease-in-out infinite 0.9s; }
            .f6 { transform-box:fill-box; transform-origin:center; animation:fl6 3.4s ease-in-out infinite 2.5s; }
            .f7 { transform-box:fill-box; transform-origin:center; animation:fl7 2.9s ease-in-out infinite 1.6s; }

            /* ── Shimmer — gleam that sweeps across the sphere ── */
            @keyframes shimmer {
              0%, 55%, 100% { opacity: 0; transform: translateX(-18px) scaleX(0.4); }
              68%            { opacity: 0.55; transform: translateX(0px)  scaleX(1);   }
              80%            { opacity: 0;   transform: translateX(18px)  scaleX(0.4); }
            }
            .shimmer-el { transform-box:fill-box; transform-origin:center; }

            .live-pulse { animation: live-ring 2.4s ease-in-out infinite; }
            .root-pulse { animation: root-ring 2.8s ease-in-out infinite; }
            .edge-anim  { animation: edge-flow  1.6s linear infinite; }
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
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#c4b5fd" floodOpacity="0.55" />
          </filter>
          <filter id="glow-cyan"   x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#67e8f9" floodOpacity="0.55" />
          </filter>
          <filter id="shadow-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
          </filter>
          {/* Soft blur for shimmer gleam */}
          <filter id="blur-sm" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
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

        {/* Background */}
        <rect width={svgWidth} height={Math.max(380, totalHeight)} fill="url(#bg-grad)" />

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
          // Fireflies in the clearing
          const fireflies = [
            [0.20, 0.28], [0.78, 0.22], [0.50, 0.62], [0.68, 0.38],
            [0.33, 0.50], [0.62, 0.18], [0.42, 0.72], [0.85, 0.55],
            [0.14, 0.60], [0.55, 0.80],
          ] as [number, number][];

          return (
            <g style={{ pointerEvents: "none" }}>
              {/* God rays from top-center */}
              {[-28, -16, -6, 6, 16, 28].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                return (
                  <line key={`ray-${i}`}
                    x1={W / 2} y1={0}
                    x2={W / 2 + Math.sin(rad) * H * 1.6}
                    y2={H * 1.4}
                    stroke="#4ade80"
                    strokeWidth={Math.max(18, 50 - Math.abs(deg) * 0.8)}
                    opacity={0.025 - Math.abs(deg) * 0.0004}
                    strokeLinecap="butt"
                  />
                );
              })}

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

              {/* Fireflies — glowing dots in the clearing */}
              {fireflies.map(([fx, fy], i) => (
                <circle key={`ff-${i}`}
                  cx={W * fx} cy={H * fy} r={1.8}
                  fill="#86efac"
                  opacity={0.35 + (i % 4) * 0.12}
                  filter="url(#glow-green)"
                />
              ))}
            </g>
          );
        })()}

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
          {nodes.map((n, idx) => {
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
            // Extended nodes are clickable IF they have extended children; direct always clickable
            const clickable  = !isRoot && !!n.memberId && (extCount > 0 || !n.isExtended);

            // Unique gradient / clip IDs per node
            const gradId  = `sg-${n.id}`;
            const clipId  = `cp-${n.id}`;
            // Deceased nodes don't float — they're at rest
            const floatCl = isDeceased ? undefined : `f${idx % 8}`;

            // 3D sphere colors — extended nodes use muted gray
            // Deceased override: muted silver tones (filter will desaturate further)
            const hi     = isDeceased ? "#c0c0c0" : n.isExtended ? "#9ca3af" : colors.hi;
            const mid    = isDeceased ? "#5a5a5a" : n.isExtended ? "#4b5563" : colors.mid;
            const shadow = isDeceased ? "#1a1a1a" : n.isExtended ? "#111827" : colors.shadow;
            const ring   = isDeceased ? "#6b7280" : n.isExtended ? "#374151" : colors.ring;
            const nodeFilter = isDeceased ? "url(#deceased)" : undefined;

            // Glow filter
            let glowFilter = "url(#glow-blue)";
            if (isRoot) glowFilter = "url(#glow-green)";
            else if (GENERATION[n.relationType] === 1) glowFilter = "url(#glow-cyan)";
            else if (GENERATION[n.relationType] === 0) glowFilter = "url(#glow-purple)";

            // Shimmer timing per node (staggered)
            const shimmerDur = `${5 + (idx % 5)}s`;
            const shimmerDel = `${(idx * 0.8) % 4.5}s`;

            // Orbit timing
            const orbitDur  = `${2.4 + (idx % 4) * 0.4}s`;

            return (
              <g
                key={n.id}
                onClick={clickable ? () => handleNodeClick(n) : undefined}
                style={{ cursor: clickable ? "pointer" : "default" }}
                className={floatCl}
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

                {/* Pulsing live ring */}
                {isRoot && (
                  <circle cx={n.cx} cy={n.cy} r={ROOT_R + 7}
                    fill="none" stroke="#4ade80" strokeWidth="2.5" className="root-pulse" />
                )}
                {isActive && (
                  <circle cx={n.cx} cy={n.cy} r={R + 6}
                    fill="none" stroke="#4ade80" strokeWidth="2" className="live-pulse" />
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

                {/* ── Shimmer gleam — sweeps across sphere periodically ── */}
                {!isDeceased && (
                  <ellipse
                    cx={n.cx - r * 0.1}
                    cy={n.cy - r * 0.25}
                    rx={r * 0.52}
                    ry={r * 0.18}
                    fill="white"
                    filter="url(#blur-sm)"
                    clipPath={`url(#${clipId})`}
                    className="shimmer-el"
                    style={{
                      animation: `shimmer ${shimmerDur} ease-in-out infinite ${shimmerDel}`,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {/* ── Orbit dot — for living members in Ceiba ── */}
                {(isJoined || isActive) && !isDeceased && (
                  <g>
                    <circle cx={n.cx + r + 5} cy={n.cy} r={2.5}
                      fill={isActive ? "#4ade80" : "#86efac"}
                      opacity={0.9}
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${n.cx} ${n.cy}`}
                        to={`360 ${n.cx} ${n.cy}`}
                        dur={orbitDur}
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={n.cx + r + 5} cy={n.cy} r={5}
                      fill={isActive ? "#4ade80" : "#86efac"}
                      opacity={0.25}
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${n.cx} ${n.cy}`}
                        to={`360 ${n.cx} ${n.cy}`}
                        dur={orbitDur}
                        repeatCount="indefinite"
                      />
                    </circle>
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
                      fill="#15803d" stroke="#060b14" strokeWidth={1.5} />
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
