"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import {
  buildLayout,
  computeImmediateFamily,
  type ExtendedEntry,
  type MemberLink,
} from "@/components/tree/FamilyTreeGraph";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";
import { Search, ZoomIn, ZoomOut, Crosshair, ChevronUp, ChevronDown, X, Pencil, Send, Share2 } from "lucide-react";

// ── Types re-derived from buildLayout's return ──────────────────────────────
type LayoutNode   = ReturnType<typeof buildLayout>["nodes"][0];
type LayoutEdge   = ReturnType<typeof buildLayout>["edges"][0];

// ── Props (same contract as FamilyTreeGraph + action callbacks) ────────────
interface Props {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers?: ExtendedEntry[];
  memberLinks?: MemberLink[];
  onNodeClick?: (memberId: string) => void;
  onEditMember?: (memberId: string) => void;
  onInviteMember?: (memberId: string) => void;
  onShareTree?: () => void;
}

// ── Design tokens ───────────────────────────────────────────────────────────
const BG_DARK      = "#07111c";
const GOLD         = "#c4922a";
const GOLD_BRIGHT  = "#e8b84b";
const GOLD_DIM     = "rgba(196,146,42,0.35)";
const TEXT_CREAM   = "#f5edd8";
const TEXT_DIM     = "rgba(245,237,216,0.55)";
const NODE_FILL    = "#0f1f30";
const NODE_FILL_ROOT = "#132235";
const RING_ROOT    = GOLD_BRIGHT;
const RING_DEFAULT = GOLD;
const RING_DECEASED = "rgba(130,120,100,0.7)";

// ── Node sizing ─────────────────────────────────────────────────────────────
const ROOT_R = 40;
const R      = 30;
const RING_W = 2.5;

// ── Bezier edge path ────────────────────────────────────────────────────────
function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 6) return `M${x1},${y1} L${x2},${y2}`;
  const dy = y2 - y1;
  return `M${x1},${y1} C${x1},${y1 + dy * 0.35} ${x2},${y1 + dy * 0.65} ${x2},${y2}`;
}

// ── Initials from name ──────────────────────────────────────────────────────
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

// ── Deterministic hue from name (for initials bg) ──────────────────────────
function nameHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 28%, 22%)`;
}

// ── PremiumFamilyNode — single SVG node ────────────────────────────────────
function PremiumFamilyNode({
  node,
  isSelected,
  isDimmed,
  onClick,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { cx, cy, r, name, relation, relationType, avatarUrl, isDeceased } = node;
  const showPhoto = !!(avatarUrl && !imgFailed);
  const isRoot = relationType === "root";
  const ini = initials(name);
  const clipId = `clip-premium-${node.id.replace(/[^a-z0-9]/gi, "_")}`;
  const gradId = `grad-premium-${node.id.replace(/[^a-z0-9]/gi, "_")}`;
  const ringColor = isDeceased ? RING_DECEASED : isSelected ? GOLD_BRIGHT : RING_DEFAULT;
  const opacity = isDimmed ? 0.28 : 1;
  const ringWidth = isSelected ? RING_W + 1 : RING_W;
  const bgFill = isRoot ? NODE_FILL_ROOT : NODE_FILL;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer", opacity }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r - 1} />
        </clipPath>
        {/* Glow gradient for selected root */}
        {isRoot && (
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={isSelected ? 0.15 : 0.06} />
            <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>

      {/* Outer glow (root only) */}
      {isRoot && (
        <circle cx={cx} cy={cy} r={r + 14} fill={`url(#${gradId})`} />
      )}

      {/* Ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringWidth}
        style={{ filter: isSelected ? `drop-shadow(0 0 6px ${GOLD_BRIGHT})` : undefined }}
      />

      {/* Avatar background */}
      <circle cx={cx} cy={cy} r={r - 1} fill={showPhoto ? bgFill : nameHue(name)} />

      {/* Photo or initials */}
      {showPhoto ? (
        <image
          href={avatarUrl!}
          x={cx - (r - 1)}
          y={cy - (r - 1)}
          width={(r - 1) * 2}
          height={(r - 1) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={TEXT_CREAM}
          fontSize={isRoot ? 16 : 13}
          fontFamily="var(--font-playfair, Georgia, serif)"
          fontWeight="600"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {ini}
        </text>
      )}

      {/* Deceased overlay */}
      {isDeceased && (
        <circle
          cx={cx} cy={cy} r={r - 1}
          fill="rgba(0,0,0,0.45)"
          clipPath={`url(#${clipId})`}
        />
      )}

      {/* Name label */}
      <text
        x={cx}
        y={cy + r + 14}
        textAnchor="middle"
        fill={isDimmed ? TEXT_DIM : TEXT_CREAM}
        fontSize={isRoot ? 12 : 11}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={isRoot ? "600" : "500"}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {node.nameLine1}
      </text>
      {node.nameLine2 && (
        <text
          x={cx}
          y={cy + r + 27}
          textAnchor="middle"
          fill={isDimmed ? TEXT_DIM : TEXT_CREAM}
          fontSize={isRoot ? 12 : 11}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight={isRoot ? "600" : "500"}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {node.nameLine2}
        </text>
      )}

      {/* Relation label */}
      {!isRoot && (
        <text
          x={cx}
          y={cy + r + (node.nameLine2 ? 40 : 27)}
          textAnchor="middle"
          fill={GOLD_DIM}
          fontSize={9.5}
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.04em"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {relation}
        </text>
      )}
    </g>
  );
}

// ── PremiumFamilyEdges — SVG edges layer ────────────────────────────────────
function PremiumFamilyEdges({
  edges,
  selectedId,
  immediateFamily,
}: {
  edges: LayoutEdge[];
  selectedId: string;
  immediateFamily: Set<string>;
}) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {edges.map((e, i) => {
        const touches = e.fromId === selectedId || e.toId === selectedId ||
          immediateFamily.has(e.fromId) || immediateFamily.has(e.toId);
        const isHoriz = e.kind === "peer";
        const strokeColor = isHoriz ? "rgba(196,146,42,0.7)" : "rgba(196,146,42,0.45)";
        const strokeDash = isHoriz ? "6 4" : undefined;
        const opacity = touches ? 1 : 0.25;
        const d = curvePath(e.x1, e.y1, e.x2, e.y2);
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={strokeColor}
            strokeWidth={isHoriz ? 1.5 : 1.5}
            strokeDasharray={strokeDash}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </g>
  );
}

// ── TreeViewportControls — floating controls UI ─────────────────────────────
function TreeViewportControls({
  onZoomIn,
  onZoomOut,
  onCenter,
  search,
  onSearch,
  generations,
  visibleGens,
  onToggleGen,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  search: string;
  onSearch: (v: string) => void;
  generations: number[];
  visibleGens: Set<number>;
  onToggleGen: (g: number) => void;
}) {
  const minGen = Math.min(...generations);
  const maxGen = Math.max(...generations);
  const hasHidden = generations.some(g => !visibleGens.has(g));

  const glass = {
    background: "rgba(10,20,35,0.82)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(196,146,42,0.25)",
    borderRadius: "12px",
  } as React.CSSProperties;

  return (
    <>
      {/* Search bar — top */}
      <div className="absolute top-3 left-3 right-3 z-20 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar familiar…"
            className="w-full pl-8 pr-3 py-2 text-xs text-amber-50 placeholder-amber-400/40 outline-none"
            style={{ ...glass, borderRadius: "10px" }}
          />
        </div>
      </div>

      {/* Zoom + center — right side */}
      <div className="absolute right-3 bottom-20 z-20 flex flex-col gap-1.5" style={glass}>
        <button
          onClick={onZoomIn}
          className="w-9 h-9 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors"
          title="Acercar"
        >
          <ZoomIn size={16} />
        </button>
        <div style={{ height: "1px", background: "rgba(196,146,42,0.2)" }} />
        <button
          onClick={onZoomOut}
          className="w-9 h-9 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors"
          title="Alejar"
        >
          <ZoomOut size={16} />
        </button>
        <div style={{ height: "1px", background: "rgba(196,146,42,0.2)" }} />
        <button
          onClick={onCenter}
          className="w-9 h-9 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors"
          title="Centrar"
        >
          <Crosshair size={15} />
        </button>
      </div>

      {/* Generation expand controls — bottom left */}
      <div className="absolute left-3 bottom-20 z-20 flex flex-col gap-1.5">
        {minGen <= -2 && (
          <button
            onClick={() => {
              for (let g = minGen; g < -1; g++) onToggleGen(g);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors"
            style={glass}
          >
            <ChevronUp size={12} />
            {visibleGens.has(minGen) ? "Ocultar ascendientes" : "Ver ascendientes"}
          </button>
        )}
        {maxGen >= 2 && (
          <button
            onClick={() => {
              for (let g = 2; g <= maxGen; g++) onToggleGen(g);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors"
            style={glass}
          >
            <ChevronDown size={12} />
            {visibleGens.has(maxGen) ? "Ocultar descendientes" : "Ver descendientes"}
          </button>
        )}
      </div>
    </>
  );
}

// ── Info panel (selected node) ──────────────────────────────────────────────
function NodeInfoPanel({
  node,
  onClose,
  onEdit,
  onInvite,
  onShare,
}: {
  node: LayoutNode;
  onClose: () => void;
  onEdit?: () => void;
  onInvite?: () => void;
  onShare?: () => void;
}) {
  const ini = initials(node.name);
  return (
    <div
      className="absolute bottom-20 left-3 right-3 z-30 flex items-start gap-3 p-4 rounded-2xl"
      style={{
        background: "rgba(10,20,35,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(196,146,42,0.35)",
      }}
    >
      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-semibold"
        style={{
          background: node.avatarUrl ? undefined : nameHue(node.name),
          border: `2px solid ${GOLD}`,
          color: TEXT_CREAM,
          overflow: "hidden",
        }}
      >
        {node.avatarUrl
          ? <img
              src={node.avatarUrl}
              className="w-full h-full object-cover"
              alt={node.name}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          : ini
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-50 truncate">{node.name}</p>
        <p className="text-xs mt-0.5" style={{ color: `${GOLD}cc` }}>{node.relation}</p>
        {node.isDeceased && (
          <p className="text-[10px] text-gray-500 mt-0.5">Fallecido/a</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-amber-400 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
        )}
        {onInvite && !node.isJoined && (
          <button
            onClick={onInvite}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-amber-400 transition-colors"
            title="Invitar"
          >
            <Send size={14} />
          </button>
        )}
        {onShare && (
          <button
            onClick={onShare}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-amber-400 transition-colors"
            title="Compartir"
          >
            <Share2 size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-500 transition-colors"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main PremiumFamilyTree component ────────────────────────────────────────
export default function PremiumFamilyTree({
  profile,
  members,
  extendedMembers = [],
  memberLinks = [],
  onNodeClick,
  onEditMember,
  onInviteMember,
  onShareTree,
}: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const gRef    = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const containerDimsRef = useRef({ w: 0, h: 0 });
  const initialCenteredRef = useRef(false);

  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [search, setSearch]   = useState("");
  const [selectedId, setSelectedId] = useState<string>("root");

  // Track which generation levels are visible (progressive disclosure)
  const [visibleGens, setVisibleGens] = useState<Set<number>>(new Set([-1, 0, 1]));

  // Auto-expand all branches on first load
  const autoExpandedRef = useRef(false);
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

  // Filter members by visible generations
  const filteredMembers = useMemo(() => {
    const GENERATION_MAP: Record<string, number> = {
      great_grandfather: -3, great_grandmother: -3,
      grandfather: -2, grandmother: -2,
      grandfather_paternal: -2, grandmother_paternal: -2,
      grandfather_maternal: -2, grandmother_maternal: -2,
      father: -1, mother: -1, father_in_law: -1, mother_in_law: -1,
      stepfather: -1, stepmother: -1, uncle: -1, aunt: -1,
      brother: 0, sister: 0, half_brother: 0, half_sister: 0,
      spouse: 0, partner: 0, cousin: 0, brother_in_law: 0, sister_in_law: 0,
      son: 1, daughter: 1, stepchild: 1, nephew: 1, niece: 1,
      son_in_law: 1, daughter_in_law: 1,
      grandson: 2, granddaughter: 2,
      great_grandson: 3, great_granddaughter: 3,
    };
    // Always show all generations if there are few members
    if (members.length <= 10) return members;
    return members.filter(m => {
      const gen = m.generation ?? GENERATION_MAP[m.relation_type] ?? 0;
      return visibleGens.has(gen);
    });
  }, [members, visibleGens]);

  // All generation levels in the data
  const allGenerations = useMemo(() => {
    const GENERATION_MAP: Record<string, number> = {
      great_grandfather: -3, great_grandmother: -3,
      grandfather: -2, grandmother: -2,
      grandfather_paternal: -2, grandmother_paternal: -2,
      grandfather_maternal: -2, grandmother_maternal: -2,
      father: -1, mother: -1, father_in_law: -1, mother_in_law: -1,
      stepfather: -1, stepmother: -1, uncle: -1, aunt: -1,
      brother: 0, sister: 0, half_brother: 0, half_sister: 0,
      spouse: 0, partner: 0, cousin: 0, brother_in_law: 0, sister_in_law: 0,
      son: 1, daughter: 1, stepchild: 1, nephew: 1, niece: 1,
      son_in_law: 1, daughter_in_law: 1,
      grandson: 2, granddaughter: 2,
      great_grandson: 3, great_granddaughter: 3,
    };
    const gens = new Set<number>([0]);
    members.forEach(m => gens.add(m.generation ?? GENERATION_MAP[m.relation_type] ?? 0));
    return [...gens].sort((a, b) => a - b);
  }, [members]);

  const { nodes, edges, totalHeight, svgWidth } = useMemo(
    () => buildLayout(profile, filteredMembers, visibleExtended, memberLinks),
    [profile, filteredMembers, visibleExtended, memberLinks],
  );

  const rootNode = useMemo(() => nodes.find(n => n.relationType === "root"), [nodes]);
  const rootNodeId = rootNode?.id ?? "root";

  // Reset selection to root if filtered away
  useEffect(() => {
    if (selectedId !== "root" && !nodes.some(n => n.id === selectedId)) {
      setSelectedId("root");
    }
  }, [nodes, selectedId]);

  const immediateFamily = useMemo(
    () => computeImmediateFamily(selectedId, filteredMembers, memberLinks),
    [selectedId, filteredMembers, memberLinks],
  );

  const selectedNode = useMemo(
    () => (selectedId && selectedId !== rootNodeId ? nodes.find(n => n.id === selectedId) ?? null : null),
    [selectedId, rootNodeId, nodes],
  );

  // Search filter: highlight matching nodes
  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id));
  }, [search, nodes]);

  // D3 zoom setup (once on mount)
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g   = d3.select(gRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3.5])
      .on("zoom", e => g.attr("transform", e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);
  }, []);

  // Compute and apply initial centering transform
  const tryApplyInitialCenter = useCallback(() => {
    if (initialCenteredRef.current || !svgRef.current || !zoomRef.current || !rootNode) return;
    const { w, h } = containerDimsRef.current;
    if (w === 0 || h === 0) return;
    initialCenteredRef.current = true;

    // Reserve space for BottomNav (~80px) so controls don't overlap it
    const usableH = h - 80;
    // On mobile: scale to fit 3 gen rows comfortably in the visible area
    // On desktop: use a tighter scale that shows more of the tree
    const scale =
      w < 600
        ? Math.min(0.58, (usableH * 0.65) / Math.max(totalHeight, 400))
        : w < 1024
        ? 0.76
        : Math.min(0.88, w / Math.max(svgWidth, 800));

    // Horizontally center on root; vertically place root at 44% of usable area
    // so parents row clears the search bar overlay and children are visible below
    const tx = w / 2 - rootNode.cx * scale;
    const ty = usableH * 0.44 - rootNode.cy * scale;

    d3.select(svgRef.current).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }, [rootNode, totalHeight, svgWidth]);

  // ResizeObserver: track real container dimensions and trigger initial centering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    containerDimsRef.current = { w: container.clientWidth, h: container.clientHeight };
    tryApplyInitialCenter();

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerDimsRef.current = {
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        };
        tryApplyInitialCenter();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [tryApplyInitialCenter]);

  const centerOnRoot = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !rootNode) return;
    const { w, h } = containerDimsRef.current;
    const usableH = h - 80;
    const scale = w < 600 ? 0.58 : 0.76;
    const tx = w / 2 - rootNode.cx * scale;
    const ty = usableH * 0.44 - rootNode.cy * scale;
    d3.select(svgRef.current).transition().duration(400).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }, [rootNode]);

  const handleZoom = useCallback((delta: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(220).call(
      zoomRef.current.scaleBy, delta,
    );
  }, []);

  const handleToggleGen = useCallback((gen: number) => {
    setVisibleGens(prev => {
      const next = new Set(prev);
      // Toggle all gens at that level and beyond in that direction
      if (gen < 0) {
        // ancestral generations: toggle all <= gen
        for (let g = gen; g >= -3; g--) {
          if (next.has(g)) next.delete(g); else next.add(g);
        }
      } else {
        // descendant generations: toggle all >= gen
        for (let g = gen; g <= 3; g++) {
          if (next.has(g)) next.delete(g); else next.add(g);
        }
      }
      // Always keep gen 0 and -1, 1 (immediate family)
      next.add(0); next.add(-1); next.add(1);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((nodeId: string, memberId?: string) => {
    setSelectedId(nodeId);
    if (memberId && onNodeClick) onNodeClick(memberId);
  }, [onNodeClick]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedId(rootNodeId);
  }, [rootNodeId]);

  // ── Render ──────────────────────────────────────────────────────
  const svgH = Math.max(totalHeight, 480);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: "calc(100vh - 120px)",
        minHeight: 500,
        background: BG_DARK,
      }}
    >
      {/* Radial ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(20,50,80,0.55) 0%, transparent 75%)",
        }}
      />

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        onClick={handleBackgroundClick}
      >
        <g ref={gRef}>
          {/* Background rectangle to catch click events */}
          <rect
            x={-9999} y={-9999} width={99999} height={99999}
            fill="transparent"
            onClick={handleBackgroundClick}
          />

          {/* Edges (below nodes) */}
          <PremiumFamilyEdges
            edges={edges}
            selectedId={selectedId}
            immediateFamily={immediateFamily}
          />

          {/* Nodes */}
          {nodes.map(node => {
            const isSelected = node.id === selectedId;
            // Dim: if something is selected, dim non-immediate
            const hasSelection = selectedId && selectedId !== rootNodeId;
            const inFamily = node.id === selectedId || immediateFamily.has(node.id) || node.id === rootNodeId;
            const isDimmed = !!(hasSelection && !inFamily);
            // Search highlight: dim non-matching when searching
            const searchDim = searchMatch && !searchMatch.has(node.id);

            return (
              <PremiumFamilyNode
                key={node.id}
                node={node}
                isSelected={isSelected}
                isDimmed={!!(isDimmed || searchDim)}
                onClick={(e?: React.MouseEvent) => {
                  e?.stopPropagation?.();
                  handleNodeClick(node.id, node.memberId);
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Controls */}
      <TreeViewportControls
        onZoomIn={() => handleZoom(1.3)}
        onZoomOut={() => handleZoom(0.77)}
        onCenter={centerOnRoot}
        search={search}
        onSearch={setSearch}
        generations={allGenerations}
        visibleGens={visibleGens}
        onToggleGen={handleToggleGen}
      />

      {/* Info panel */}
      {selectedNode && (
        <NodeInfoPanel
          node={selectedNode}
          onClose={() => setSelectedId(rootNodeId)}
          onEdit={onEditMember ? () => onEditMember(selectedNode.memberId ?? selectedNode.id) : undefined}
          onInvite={onInviteMember ? () => onInviteMember(selectedNode.memberId ?? selectedNode.id) : undefined}
          onShare={onShareTree}
        />
      )}
    </div>
  );
}
