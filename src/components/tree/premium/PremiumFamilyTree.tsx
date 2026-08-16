"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import {
  buildLayout,
  computeImmediateFamily,
  type ExtendedEntry,
  type MemberLink,
} from "@/components/tree/FamilyTreeGraph";
import { FamilyMember, Profile } from "@/lib/types";
import {
  Search, ZoomIn, ZoomOut, Crosshair,
  ChevronUp, ChevronDown, Users,
  GitFork, List, MapPin, X, Pencil, Send, Share2,
} from "lucide-react";

type LayoutNode = ReturnType<typeof buildLayout>["nodes"][0];
type LayoutEdge = ReturnType<typeof buildLayout>["edges"][0];

// ── Visual radii ──────────────────────────────────────────────────────────────
const ROOT_R_V   = 48;
const SPOUSE_R_V = 42;
const PARENT_R_V = 40;
const R_V        = 38;
const LBL_GAP    = 12;

// ── Warm constellation palette ────────────────────────────────────────────────
const BG         = "#0E0B09";
const GOLD       = "#F2C94C";
const GOLD_SOFT  = "rgba(242,201,76,0.38)";
const GOLD_DIM   = "rgba(242,201,76,0.16)";
const TERRA      = "#D4836A";
const TERRA_SOFT = "rgba(212,131,106,0.36)";
const STEEL      = "#8E9AAF";
const STEEL_SOFT = "rgba(142,154,175,0.34)";
const CREAM      = "#EDE8DF";
const CREAM_DIM  = "rgba(237,232,223,0.28)";
const NODE_FILL  = "#1E1610";
const NODE_ROOT  = "#261C12";
const RING_DEAD  = "rgba(140,128,116,0.44)";
const EDGE_BASE  = "rgba(200,150,60,0.11)";
const EDGE_LIT   = "rgba(242,193,80,0.52)";

const GLASS: React.CSSProperties = {
  background: "rgba(14,11,9,0.88)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(200,150,60,0.18)",
};

// ── Relation type sets ────────────────────────────────────────────────────────
const CORE_TYPES = new Set([
  "father","mother","spouse","partner",
  "brother","sister","half_brother","half_sister",
  "son","daughter",
]);
const ANCESTOR_TYPES = new Set([
  "grandfather","grandmother",
  "grandfather_paternal","grandmother_paternal",
  "grandfather_maternal","grandmother_maternal",
  "great_grandfather","great_grandmother",
]);
const DESCENDANT_TYPES = new Set([
  "grandson","granddaughter","great_grandson","great_granddaughter",
]);
const OTHER_TYPES = new Set([
  "uncle","aunt","nephew","niece","cousin",
  "father_in_law","mother_in_law","brother_in_law","sister_in_law",
  "son_in_law","daughter_in_law","stepfather","stepmother","stepchild",
]);
const ANC_INF  = new Set(["grandfather","grandmother","great_grandfather","great_grandmother"]);
const DESC_INF = new Set(["grandson","granddaughter","great_grandson","great_granddaughter"]);
const OTH_INF  = new Set(["uncle","aunt","cousin","nephew","niece"]);

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers?: ExtendedEntry[];
  memberLinks?: MemberLink[];
  onNodeClick?: (memberId: string) => void;
  onEditMember?: (memberId: string) => void;
  onInviteMember?: (memberId: string) => void;
  onShareTree?: () => void;
  onSwitchToList?: () => void;
  onSwitchToMap?: () => void;
  familyCount?: number;
  onlinePersonIds?: Set<string>;
}

// ── Static star field (deterministic, no Math.random at render) ───────────────
const STARS = Array.from({ length: 26 }, (_, i) => {
  const a = ((i + 1) * 2654435761) >>> 0;
  const b = (a ^ (a >>> 16)) >>> 0;
  const c = (b * 1234567) >>> 0;
  return {
    x: (a % 9973) / 9973 * 100,
    y: (b % 9973) / 9973 * 100,
    r: 0.45 + (i % 4) * 0.13,
    o: 0.07 + (c % 100) * 0.0019,
    twinkle: i % 3 === 0, // every 3rd star twinkles
    delay: (i * 0.83) % 6,
  };
});

// ── Ambient dust particles (slower, larger, for foreground depth) ─────────────
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const a = ((i + 7) * 3141592653) >>> 0;
  const b = (a ^ (a >>> 13)) >>> 0;
  const c = (b * 9876543) >>> 0;
  return {
    x: (a % 9001) / 9001 * 100,
    y: (b % 9001) / 9001 * 100,
    r: 0.9 + (i % 5) * 0.22,
    o: 0.04 + (c % 60) * 0.0012,
    dur: 14 + (i * 2.3) % 12,
    delay: (i * 1.7) % 14,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : (p[0]?.[0] ?? "?").toUpperCase();
}

function nameHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 20%, 19%)`;
}

function nodeVR(rt: string): number {
  if (rt === "root") return ROOT_R_V;
  if (rt === "spouse" || rt === "partner") return SPOUSE_R_V;
  if (rt === "father" || rt === "mother") return PARENT_R_V;
  return R_V;
}

function nodeRingColor(rt: string, isDeceased: boolean, isSelected: boolean): string {
  if (isDeceased) return RING_DEAD;
  if (rt === "root") return GOLD;
  if (ANCESTOR_TYPES.has(rt)) return isSelected ? "#E8A882" : TERRA;
  if (OTHER_TYPES.has(rt)) return isSelected ? "#A8B4C8" : STEEL;
  return isSelected ? GOLD : GOLD_SOFT;
}

function nodeBaseOpacity(rt: string): number {
  if (rt === "root") return 1;
  if (ANCESTOR_TYPES.has(rt)) return 0.87;
  if (DESCENDANT_TYPES.has(rt)) return 0.90;
  if (OTHER_TYPES.has(rt)) return 0.83;
  return 0.95;
}

function nodeRelationColor(rt: string): string {
  if (ANCESTOR_TYPES.has(rt)) return TERRA_SOFT;
  if (OTHER_TYPES.has(rt)) return STEEL_SOFT;
  return GOLD_DIM;
}

// Soft bezier curves — no rigid orthogonal lines
function constellationPath(x1: number, y1: number, x2: number, y2: number, kind: string): string {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (kind === "peer") {
    if (Math.abs(dy) < 4) {
      const mx = (x1 + x2) / 2;
      const bow = -Math.abs(dx) * 0.055;
      return `M${x1},${y1} Q${mx},${y1 + bow} ${x2},${y2}`;
    }
    return `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2} ${x2},${y2}`;
  }

  if (Math.abs(dx) < 2) return `M${x1},${y1} L${x2},${y2}`;
  const c1y = y1 + dy * 0.42;
  const c2y = y2 - dy * 0.42;
  return `M${x1},${y1} C${x1},${c1y} ${x2},${c2y} ${x2},${y2}`;
}

// ── Constellation edges ───────────────────────────────────────────────────────
function ConstellationEdges({
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
        const lit =
          e.fromId === selectedId || e.toId === selectedId ||
          immediateFamily.has(e.fromId) || immediateFamily.has(e.toId);
        const d = constellationPath(e.x1, e.y1, e.x2, e.y2, e.kind);
        // Stagger shimmer delay so all light beads aren't synchronized
        const shimmerDelay = `${((i * 0.41) % 3.5).toFixed(2)}s`;
        return (
          <g key={i}>
            {/* Base thread — slightly thicker for ambient presence */}
            <path
              d={d}
              fill="none"
              stroke={lit ? EDGE_LIT : EDGE_BASE}
              strokeWidth={lit ? 1.6 : 1.0}
              strokeLinecap="round"
              filter={lit ? "url(#edge-glow)" : undefined}
              style={{ transition: "stroke 260ms ease, stroke-width 260ms ease" }}
            />
            {/* Traveling light bead — lit edges only */}
            {lit && (
              <path
                d={d}
                fill="none"
                stroke="rgba(255,230,110,0.72)"
                strokeWidth={2.2}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.07 0.93"
                filter="url(#edge-glow)"
                className="edge-shimmer"
                style={{ animationDelay: shimmerDelay }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── Family node ───────────────────────────────────────────────────────────────
function FamilyNode({
  node,
  isSelected,
  isHovered,
  isDimmed,
  revealAnim,
  isOnline,
  onClick,
  onHover,
  onUnhover,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  revealAnim: boolean;
  isOnline: boolean;
  onClick: () => void;
  onHover: () => void;
  onUnhover: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { cx, cy, name, avatarUrl, isDeceased, relationType } = node;
  const vr      = nodeVR(relationType);
  const isRoot  = relationType === "root";
  const showPic = !!(avatarUrl && !imgFailed);
  const ini     = initials(name);
  const uid     = node.id.replace(/[^a-z0-9]/gi, "_");
  const clipId  = `clip-pf-${uid}`;
  const gradId  = `glow-pf-${uid}`;

  const ringColor = nodeRingColor(relationType, isDeceased ?? false, isSelected);
  const ringW     = isRoot ? 2.4 : isSelected ? 2 : 1.5;
  const baseOp    = nodeBaseOpacity(relationType);

  return (
    <g
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
      className={revealAnim ? "node-reveal" : undefined}
      style={{
        cursor: "pointer",
        opacity: isDimmed ? 0.22 : baseOp,
        transform: isHovered ? "scale(1.03)" : undefined,
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: "opacity 280ms ease, transform 150ms ease",
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={vr - 1} />
        </clipPath>
        {isRoot && (
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#E8A830" stopOpacity={isSelected ? 0.55 : 0.32} />
            <stop offset="50%"  stopColor={GOLD}    stopOpacity={isSelected ? 0.18 : 0.10} />
            <stop offset="100%" stopColor={GOLD}    stopOpacity={0} />
          </radialGradient>
        )}
      </defs>

      {/* Root ambient glow — large, volumetric, breathing */}
      {isRoot && (
        <>
          <circle cx={cx} cy={cy} r={vr + 72} fill={`url(#${gradId})`} className="root-breathe" style={{ pointerEvents: "none" }} />
          <circle cx={cx} cy={cy} r={vr + 28} fill={`url(#${gradId})`} className="root-breathe" style={{ pointerEvents: "none", animationDelay: "0.8s" }} />
        </>
      )}

      {/* Ambient halo — soft diffuse ring behind the main ring */}
      <circle cx={cx} cy={cy} r={vr + 16}
        fill="none"
        stroke={ringColor}
        strokeWidth={isRoot ? 10 : 7}
        strokeOpacity={isRoot ? 0.14 : 0.07}
        style={{ pointerEvents: "none" }}
      />
      <circle cx={cx} cy={cy} r={vr + 8}
        fill="none"
        stroke={ringColor}
        strokeWidth={isRoot ? 6 : 4}
        strokeOpacity={isRoot ? 0.10 : 0.05}
        style={{ pointerEvents: "none" }}
      />

      {/* Selection outer ring — breathing pulse */}
      {isSelected && (
        <circle cx={cx} cy={cy} r={vr + 6}
          fill="none" stroke={ringColor} strokeWidth={1.2}
          className="node-pulse"
        />
      )}

      {/* Hover glow ring */}
      {isHovered && !isSelected && (
        <circle cx={cx} cy={cy} r={vr + 7}
          fill="none" stroke={ringColor} strokeWidth={0.8}
          style={{ opacity: 0.28 }}
        />
      )}

      {/* Main ring */}
      <circle
        cx={cx} cy={cy} r={vr}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringW}
        filter={isRoot ? "url(#root-ring-glow)" : undefined}
        style={{
          filter: !isRoot && isSelected
            ? `drop-shadow(0 0 6px ${ringColor}99)`
            : undefined,
          transition: "filter 220ms ease",
        }}
      />

      {/* Avatar fill */}
      <circle cx={cx} cy={cy} r={vr - 1} fill={showPic ? (isRoot ? NODE_ROOT : NODE_FILL) : nameHue(name)} />

      {/* Photo */}
      {showPic && (
        <image
          href={avatarUrl!}
          x={cx - (vr - 1)} y={cy - (vr - 1)}
          width={(vr - 1) * 2} height={(vr - 1) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Sphere highlight — top-left volumetric light source */}
      <circle
        cx={cx} cy={cy} r={vr - 1}
        fill={isRoot ? "url(#sphere-highlight-root)" : "url(#sphere-highlight)"}
        clipPath={`url(#${clipId})`}
        style={{ pointerEvents: "none" }}
      />

      {/* Inner depth shadow — bottom-right for 3D volume */}
      <circle
        cx={cx} cy={cy} r={vr - 1}
        fill="url(#sphere-depth)"
        clipPath={`url(#${clipId})`}
        style={{ pointerEvents: "none" }}
      />

      {/* Initials fallback */}
      {!showPic && (
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fill={CREAM}
          fontSize={isRoot ? 18 : 14}
          fontFamily="var(--font-playfair, Georgia, serif)"
          fontWeight="600"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {ini}
        </text>
      )}

      {/* Deceased overlay */}
      {isDeceased && (
        <circle cx={cx} cy={cy} r={vr - 1} fill="rgba(0,0,0,0.34)" clipPath={`url(#${clipId})`} />
      )}

      {/* Online presence dot — bottom-right of avatar */}
      {isOnline && (
        <>
          <circle
            cx={cx + vr * 0.707} cy={cy + vr * 0.707} r={5.5}
            fill="#030208"
            style={{ pointerEvents: "none" }}
          />
          <circle
            cx={cx + vr * 0.707} cy={cy + vr * 0.707} r={4}
            fill="#4ade80"
            className="online-dot"
            style={{ pointerEvents: "none" }}
          />
        </>
      )}

      {/* Name line 1 */}
      <text
        x={cx} y={cy + vr + LBL_GAP}
        textAnchor="middle"
        fill={isDimmed ? CREAM_DIM : CREAM}
        fontSize={isRoot ? 12 : 10}
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight={isRoot ? "700" : "500"}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {node.nameLine1}
      </text>

      {/* Name line 2 */}
      {node.nameLine2 && (
        <text
          x={cx} y={cy + vr + LBL_GAP + 13}
          textAnchor="middle"
          fill={isDimmed ? CREAM_DIM : CREAM}
          fontSize={isRoot ? 12 : 10}
          fontFamily="system-ui,-apple-system,sans-serif"
          fontWeight={isRoot ? "700" : "500"}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {node.nameLine2}
        </text>
      )}

      {/* Relation label */}
      {!isRoot && (
        <text
          x={cx}
          y={cy + vr + LBL_GAP + (node.nameLine2 ? 26 : 13)}
          textAnchor="middle"
          fill={nodeRelationColor(relationType)}
          fontSize={8}
          fontFamily="system-ui,-apple-system,sans-serif"
          letterSpacing="0.06em"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {node.relation}
        </text>
      )}
    </g>
  );
}

// ── Node info panel ───────────────────────────────────────────────────────────
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
  const ringColor = nodeRingColor(node.relationType, node.isDeceased ?? false, false);
  return (
    <div
      className="absolute bottom-20 left-3 right-3 z-30 flex items-start gap-3 p-4"
      style={{ ...GLASS, borderRadius: "16px" }}
    >
      <div
        className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-semibold text-base"
        style={{
          background: node.avatarUrl ? undefined : nameHue(node.name),
          border: `2px solid ${ringColor}`,
          color: CREAM,
        }}
      >
        {node.avatarUrl ? (
          <img src={node.avatarUrl} className="w-full h-full object-cover" alt={node.name}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : ini}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <p className="font-semibold text-sm truncate" style={{ color: CREAM }}>{node.name}</p>
        <p className="text-xs mt-0.5" style={{ color: ringColor + "cc" }}>{node.relation}</p>
        {node.isDeceased && <p className="text-[10px] mt-0.5" style={{ color: CREAM_DIM }}>Fallecido/a</p>}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
        {onEdit && (
          <button onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: GOLD }} title="Editar">
            <Pencil size={14} />
          </button>
        )}
        {onInvite && !node.isJoined && (
          <button onClick={onInvite}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: GOLD }} title="Invitar">
            <Send size={14} />
          </button>
        )}
        {onShare && (
          <button onClick={onShare}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: GOLD }} title="Compartir">
            <Share2 size={14} />
          </button>
        )}
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          style={{ color: CREAM_DIM }} title="Cerrar">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PremiumFamilyTree({
  profile,
  members,
  extendedMembers = [],
  memberLinks = [],
  onNodeClick,
  onEditMember,
  onInviteMember,
  onShareTree,
  onSwitchToList,
  onSwitchToMap,
  familyCount,
  onlinePersonIds,
}: Props) {
  const svgRef       = useRef<SVGSVGElement>(null);
  const gRef         = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef      = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const dimsRef      = useRef({ w: 0, h: 0 });
  const centeredRef  = useRef(false);

  const [expandAncestors,   setExpandAncestors]   = useState(false);
  const [expandDescendants, setExpandDescendants] = useState(false);
  const [expandOthers,      setExpandOthers]      = useState(false);
  const [selectedId,  setSelectedId]  = useState<string>("root");
  const [hoveredId,   setHoveredId]   = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [showSearch,  setShowSearch]  = useState(false);

  // ── Filtered members ───────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => members.filter(m => {
    const rt = m.relation_type;
    if (CORE_TYPES.has(rt))                           return true;
    if (expandAncestors   && ANCESTOR_TYPES.has(rt))  return true;
    if (expandDescendants && DESCENDANT_TYPES.has(rt)) return true;
    if (expandOthers      && OTHER_TYPES.has(rt))     return true;
    return false;
  }), [members, expandAncestors, expandDescendants, expandOthers]);

  const filteredExtended = useMemo(() => extendedMembers.filter(e => {
    const rel = e.inferredRelation ?? "";
    if (expandAncestors   && ANC_INF.has(rel))  return true;
    if (expandDescendants && DESC_INF.has(rel)) return true;
    if (expandOthers      && OTH_INF.has(rel))  return true;
    return false;
  }), [extendedMembers, expandAncestors, expandDescendants, expandOthers]);

  // ── Layout (immutable buildLayout) ────────────────────────────────────────
  const { nodes, edges, totalHeight, svgWidth } = useMemo(
    () => buildLayout(profile, filteredMembers, filteredExtended, memberLinks),
    [profile, filteredMembers, filteredExtended, memberLinks],
  );

  const rootNode   = useMemo(() => nodes.find(n => n.relationType === "root"), [nodes]);
  const rootNodeId = rootNode?.id ?? "root";

  const immediateFamily = useMemo(
    () => computeImmediateFamily(selectedId, filteredMembers, memberLinks),
    [selectedId, filteredMembers, memberLinks],
  );

  const selectedNode = useMemo(
    () => selectedId && selectedId !== rootNodeId ? nodes.find(n => n.id === selectedId) ?? null : null,
    [selectedId, rootNodeId, nodes],
  );

  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id));
  }, [search, nodes]);

  const hasAncestors = useMemo(
    () => members.some(m => ANCESTOR_TYPES.has(m.relation_type))
       || extendedMembers.some(e => ANC_INF.has(e.inferredRelation ?? "")),
    [members, extendedMembers],
  );
  const hasDescendants = useMemo(
    () => members.some(m => DESCENDANT_TYPES.has(m.relation_type))
       || extendedMembers.some(e => DESC_INF.has(e.inferredRelation ?? "")),
    [members, extendedMembers],
  );
  const hasOthers = useMemo(
    () => members.some(m => OTHER_TYPES.has(m.relation_type))
       || extendedMembers.some(e => OTH_INF.has(e.inferredRelation ?? "")),
    [members, extendedMembers],
  );

  // Deselect if selected node leaves visible set
  useEffect(() => {
    if (selectedId !== rootNodeId && !nodes.some(n => n.id === selectedId)) {
      setSelectedId(rootNodeId);
    }
  }, [nodes, selectedId, rootNodeId]);

  // Re-center on expansion change
  useEffect(() => {
    centeredRef.current = false;
  }, [expandAncestors, expandDescendants, expandOthers]);

  // ── D3 zoom ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const g    = d3.select(gRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.10, 5])
      .on("zoom", ev => g.attr("transform", ev.transform));
    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
  }, []);

  // ── Initial centering ──────────────────────────────────────────────────────
  const applyInitialCenter = useCallback(() => {
    if (centeredRef.current || !svgRef.current || !zoomRef.current || !rootNode) return;
    const { w, h } = dimsRef.current;
    if (w === 0 || h === 0) return;
    centeredRef.current = true;
    const scale = w < 600 ? 0.9 : w < 1024 ? 0.95 : 1.0;
    // Center on tree bounding box midpoint so leftmost nodes aren't clipped
    const R_MAX = 48;
    const xs = nodes.map(n => n.cx);
    const treeMidX = (Math.min(...xs) - R_MAX + Math.max(...xs) + R_MAX) / 2;
    const tx = w / 2 - treeMidX * scale;
    const ty = (h - 80) * 0.44 - rootNode.cy * scale;
    d3.select(svgRef.current).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }, [rootNode, nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    dimsRef.current = { w: el.clientWidth, h: el.clientHeight };
    applyInitialCenter();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        dimsRef.current = { w: entry.contentRect.width, h: entry.contentRect.height };
        applyInitialCenter();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyInitialCenter]);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const centerOnRoot = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !rootNode) return;
    const { w, h } = dimsRef.current;
    const scale    = w < 600 ? 0.9 : w < 1024 ? 0.95 : 1.0;
    const R_MAX = 48;
    const xs = nodes.map(n => n.cx);
    const treeMidX = (Math.min(...xs) - R_MAX + Math.max(...xs) + R_MAX) / 2;
    const tx = w / 2 - treeMidX * scale;
    const ty = (h - 80) * 0.44 - rootNode.cy * scale;
    d3.select(svgRef.current)
      .transition().duration(380)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [rootNode, nodes]);

  const handleZoom = useCallback((delta: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, delta);
  }, []);

  const handleNodeClick = useCallback((nodeId: string, memberId?: string) => {
    setSelectedId(nodeId);
    if (memberId && onNodeClick) onNodeClick(memberId);
  }, [onNodeClick]);

  const handleDeselect = useCallback(() => setSelectedId(rootNodeId), [rootNodeId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: "calc(100vh - 80px)", background: BG, borderRadius: "0 0 12px 12px" }}
    >
      {/* Warm depth gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 45%, #1A1008 0%, #0E0B09 100%)",
          zIndex: 0,
        }}
      />

      {/* Star field — fixed to viewport */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x.toFixed(2)}%`}
            cy={`${s.y.toFixed(2)}%`}
            r={s.r}
            fill={`rgba(237,232,223,${s.o.toFixed(3)})`}
            className={s.twinkle ? "star-twinkle" : undefined}
            style={s.twinkle ? {
              animationDuration: `${3.8 + s.delay * 0.6}s`,
              animationDelay: `${s.delay}s`,
              // CSS custom properties for opacity variation per star
              ["--star-base-op" as string]: s.o.toFixed(3),
              ["--star-peak-op" as string]: Math.min(s.o * 3.2, 0.55).toFixed(3),
            } : undefined}
          />
        ))}
      </svg>

      {/* Ambient dust particles — closer layer, slow drift */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={`${p.x.toFixed(2)}%`}
            cy={`${p.y.toFixed(2)}%`}
            r={p.r}
            fill={`rgba(242,201,76,${p.o.toFixed(3)})`}
            className="particle-drift"
            style={{
              animationDuration: `${p.dur.toFixed(1)}s`,
              animationDelay: `${p.delay.toFixed(1)}s`,
            }}
          />
        ))}
      </svg>

      {/* Graph SVG */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: "block", position: "relative", zIndex: 2 }}
        onClick={handleDeselect}
      >
        <defs>
          {/* Reveal animation for expanded nodes */}
          <style>{`
            @keyframes node-reveal {
              from { opacity: 0; transform: scale(0.96) translateY(12px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            .node-reveal {
              animation: node-reveal 280ms ease forwards;
              transform-box: fill-box;
              transform-origin: center;
            }

            /* Traveling light bead along lit connections */
            @keyframes edge-shimmer {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: -1; }
            }
            .edge-shimmer {
              animation: edge-shimmer 3.5s linear infinite;
            }

            /* Slow breathing pulse on selected node's outer ring */
            @keyframes node-pulse {
              0%, 100% { transform: scale(1);    opacity: 0.38; }
              50%       { transform: scale(1.12); opacity: 0.12; }
            }
            .node-pulse {
              animation: node-pulse 2.4s ease-in-out infinite;
              transform-box: fill-box;
              transform-origin: center;
            }

            /* Root halo gentle breathing */
            @keyframes root-breathe {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.62; }
            }
            .root-breathe {
              animation: root-breathe 4.2s ease-in-out infinite;
            }

            /* Ambient particle vertical drift */
            @keyframes particle-drift {
              0%        { transform: translateY(0px);  }
              33%       { transform: translateY(-7px); }
              66%       { transform: translateY(-3px); }
              100%      { transform: translateY(0px);  }
            }
            .particle-drift {
              transform-box: fill-box;
              transform-origin: center;
              animation: particle-drift linear infinite;
            }

            /* Star twinkle */
            @keyframes star-twinkle {
              0%, 100% { opacity: var(--star-base-op, 0.12); }
              50%       { opacity: var(--star-peak-op, 0.30); }
            }
            .star-twinkle {
              animation: star-twinkle ease-in-out infinite;
            }

            /* Online presence dot pulse */
            @keyframes online-dot-pulse {
              0%, 100% { opacity: 1;    transform: scale(1); }
              50%       { opacity: 0.6; transform: scale(1.35); }
            }
            .online-dot {
              animation: online-dot-pulse 1.6s ease-in-out infinite;
              transform-box: fill-box;
              transform-origin: center;
            }

            @media (prefers-reduced-motion: reduce) {
              .node-reveal, .edge-shimmer, .node-pulse,
              .root-breathe, .particle-drift, .star-twinkle,
              .online-dot {
                animation: none;
              }
            }
          `}</style>

          {/* Glow filter for lit connections */}
          <filter id="edge-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong glow for root node ring */}
          <filter id="root-ring-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Warm radial behind root node — volumetric sun-like glow */}
          <radialGradient id="root-warm-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#3D2510" stopOpacity="1"    />
            <stop offset="22%"  stopColor="#2E1B0E" stopOpacity="0.90" />
            <stop offset="52%"  stopColor="#1A1008" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#0E0B09" stopOpacity="0"    />
          </radialGradient>

          {/* Sphere highlight — top-left light source, applied over node fill */}
          <radialGradient id="sphere-highlight" cx="38%" cy="30%" r="55%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="rgba(255,235,140,0.18)" />
            <stop offset="42%"  stopColor="rgba(255,235,140,0.05)" />
            <stop offset="100%" stopColor="rgba(255,235,140,0)"    />
          </radialGradient>

          {/* Richer highlight for root node */}
          <radialGradient id="sphere-highlight-root" cx="36%" cy="28%" r="58%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="rgba(255,240,160,0.32)" />
            <stop offset="38%"  stopColor="rgba(242,201,76,0.10)"  />
            <stop offset="100%" stopColor="rgba(242,201,76,0)"     />
          </radialGradient>

          {/* Inner depth shadow — bottom-right darken for 3D volume */}
          <radialGradient id="sphere-depth" cx="65%" cy="72%" r="55%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="rgba(0,0,0,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)"    />
          </radialGradient>
        </defs>

        <g ref={gRef}>
          {/* Click-to-deselect background */}
          <rect x={-99999} y={-99999} width={199999} height={199999} fill="transparent" onClick={handleDeselect} />

          {/* Volumetric warm glow in graph space — two layers for depth */}
          {rootNode && (
            <>
              <circle
                cx={rootNode.cx} cy={rootNode.cy} r={560}
                fill="url(#root-warm-bg)"
                className="root-breathe"
                style={{ pointerEvents: "none" }}
              />
              <circle
                cx={rootNode.cx} cy={rootNode.cy} r={310}
                fill="url(#root-warm-bg)"
                className="root-breathe"
                style={{ pointerEvents: "none", animationDelay: "1.4s" }}
              />
            </>
          )}

          <ConstellationEdges
            edges={edges}
            selectedId={selectedId}
            immediateFamily={immediateFamily}
          />

          {nodes.map(node => {
            const isSelected     = node.id === selectedId;
            const hasSelection   = selectedId !== rootNodeId;
            const inFamily       = node.id === selectedId || node.id === rootNodeId || immediateFamily.has(node.id);
            const dimBySelection = hasSelection && !inFamily;
            const dimBySearch    = !!(searchMatch && !searchMatch.has(node.id));
            const revealAnim     =
              (expandAncestors   && ANCESTOR_TYPES.has(node.relationType)) ||
              (expandDescendants && DESCENDANT_TYPES.has(node.relationType)) ||
              (expandOthers      && OTHER_TYPES.has(node.relationType));

            return (
              <FamilyNode
                key={node.id}
                node={node}
                isSelected={isSelected}
                isHovered={hoveredId === node.id}
                isDimmed={dimBySelection || dimBySearch}
                revealAnim={revealAnim}
                isOnline={!!(onlinePersonIds && node.memberId && onlinePersonIds.has(node.memberId))}
                onClick={() => handleNodeClick(node.id, node.memberId)}
                onHover={() => setHoveredId(node.id)}
                onUnhover={() => setHoveredId(null)}
              />
            );
          })}
        </g>
      </svg>

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 pointer-events-none">

        {/* View switcher + family count */}
        <div
          className="flex items-center gap-0.5 pointer-events-auto"
          style={{ ...GLASS, borderRadius: "10px", padding: "4px 6px" }}
        >
          <span
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(242,201,76,0.14)", color: GOLD }}
          >
            <GitFork size={13} />
          </span>

          {onSwitchToList && (
            <button
              onClick={onSwitchToList}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: "rgba(237,232,223,0.42)" }}
              title="Vista lista"
            >
              <List size={13} />
            </button>
          )}

          {onSwitchToMap && (
            <button
              onClick={onSwitchToMap}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: "rgba(237,232,223,0.42)" }}
              title="Vista mapa"
            >
              <MapPin size={13} />
            </button>
          )}

          {familyCount != null && (
            <span
              className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(242,201,76,0.13)",
                color: GOLD,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {familyCount}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div
          className="flex items-center gap-1.5 pointer-events-auto transition-all"
          style={{ ...GLASS, borderRadius: "10px", padding: "4px 8px" }}
        >
          {showSearch ? (
            <>
              <Search size={12} style={{ color: `${GOLD}80`, flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar…"
                autoFocus
                className="w-28 text-xs bg-transparent outline-none"
                style={{ color: CREAM }}
              />
              <button onClick={() => { setSearch(""); setShowSearch(false); }} style={{ color: CREAM_DIM }}>
                <X size={11} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              style={{ color: "rgba(237,232,223,0.42)" }}
              title="Buscar familiar"
            >
              <Search size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── ZOOM CONTROLS ────────────────────────────────────────────── */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col gap-2">
        {(
          [
            { delta: 1.28, Icon: ZoomIn,    label: "Acercar" },
            { delta: 0.78, Icon: ZoomOut,   label: "Alejar"  },
            { delta: 0,    Icon: Crosshair, label: "Centrar" },
          ] as const
        ).map(({ delta, Icon, label }) => (
          <button
            key={label}
            onClick={delta === 0 ? centerOnRoot : () => handleZoom(delta)}
            title={label}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
            style={{
              background: "rgba(26,22,20,0.60)",
              border: "1px solid rgba(212,131,106,0.14)",
              color: "rgba(212,131,106,0.40)",
              opacity: 0.72,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = GOLD;
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(212,131,106,0.40)";
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.72";
            }}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>

      {/* ── EXPANSION CONTROLS ───────────────────────────────────────── */}
      <div className="absolute left-3 bottom-24 z-20 flex flex-col gap-1.5">
        {hasAncestors && (
          <button
            onClick={() => setExpandAncestors(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors"
            style={{
              ...GLASS,
              borderRadius: "9px",
              color: expandAncestors ? TERRA : "rgba(237,232,223,0.50)",
            }}
          >
            <ChevronUp size={11} />
            {expandAncestors ? "Ocultar ascendientes" : "Ver ascendientes"}
          </button>
        )}
        {hasDescendants && (
          <button
            onClick={() => setExpandDescendants(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors"
            style={{
              ...GLASS,
              borderRadius: "9px",
              color: expandDescendants ? GOLD : "rgba(237,232,223,0.50)",
            }}
          >
            <ChevronDown size={11} />
            {expandDescendants ? "Ocultar descendientes" : "Ver descendientes"}
          </button>
        )}
        {hasOthers && (
          <button
            onClick={() => setExpandOthers(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors"
            style={{
              ...GLASS,
              borderRadius: "9px",
              color: expandOthers ? STEEL : "rgba(237,232,223,0.50)",
            }}
          >
            <Users size={11} />
            {expandOthers ? "Ocultar otros parientes" : "Mostrar otros parientes"}
          </button>
        )}
      </div>

      {/* ── NODE INFO PANEL ───────────────────────────────────────────── */}
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
