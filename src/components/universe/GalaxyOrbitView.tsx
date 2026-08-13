"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, FamilyMember } from "@/lib/types";
import { RELATION_LABELS } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";
import { AvatarFigure, STAR_R } from "./AvatarFigure";
import type { UniverseNode } from "./useUniverseLayout";

// ── Orbit cold-start seed ─────────────────────────────────────────────────────
const ORBIT_1 = new Set([
  "father","mother","spouse","partner","son","daughter",
  "stepson","stepdaughter","step_son","step_daughter",
]);
const ORBIT_2 = new Set([
  "brother","sister","half_brother","half_sister","step_brother","step_sister",
  "grandfather","grandmother",
  "grandfather_paternal","grandmother_paternal",
  "grandfather_maternal","grandmother_maternal",
  "uncle","aunt","nephew","niece",
  "grandson","granddaughter","great_grandson","great_granddaughter",
]);
function seedOrbit(rel: string, kind?: string | null): 1 | 2 | 3 {
  if (ORBIT_1.has(rel)) return 1;
  if (ORBIT_2.has(rel)) return 2;
  if (kind === "affinity") return 3;
  return 2;
}

// ── Deterministic hash from member id ─────────────────────────────────────────
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (Math.imul(33, h) ^ id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrbitNode {
  id: string;
  name: string;
  firstName: string;
  orbit: 1 | 2 | 3;
  angle: number;
  baseSpeed: number;
  speed: number;
  deceased: boolean;
  joined: boolean;
  relationType: string;
  avatarUrl: string | null;
  // Per-node orbital character (seeded from id — stable across renders)
  tiltVar: number;   // ±0.12 on top of TILT
  rVar: number;      // 0.88–1.12 orbit radius multiplier
  offX: number;      // ±28px center offset X
  offY: number;      // ±18px center offset Y
  wobAmp: number;
  wobFreq: number;
  wobPhase: number;
  repX: number;      // separation offset X (px) — updated each frame
  repY: number;      // separation offset Y (px)
}

export interface GalaxyOrbitViewProps {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers: ExtendedEntry[];
  memberLinks: MemberLink[];
  onViewMember: (id: string) => void;
  onEditMember: (id: string) => void;
  onInviteMember: (id: string) => void;
  onAddMember: () => void;
  /** person_ids of family members currently online */
  onlinePersonIds?: Set<string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GOLD   = "#d4af37";
const BG     = "#030208";
const TILT   = 0.68;
const BASE_ORBIT_FRACS = [0.21, 0.375, 0.52] as const;
const BASE_SPEEDS      = [0.0029, 0.002, 0.0011] as const;
// Direction is now per-node (from hash), not per-orbit
const BASE_NR          = [36, 28, 22] as const;
const DEPTH_SCALE      = 0.80;

function baseOrbitR(orbit: 1 | 2 | 3, w: number) { return BASE_ORBIT_FRACS[orbit-1] * w; }
function baseNodeR(orbit: 1 | 2 | 3) { return BASE_NR[orbit-1]; }
function depthOf(angle: number) { return (Math.sin(angle) + 1) / 2; }
function scaledNR(orbit: 1 | 2 | 3, depth: number) {
  return baseNodeR(orbit) * (1 - DEPTH_SCALE / 2 + depth * DEPTH_SCALE);
}

// ── Color by generational hierarchy ──────────────────────────────────────────
function memberRgb(relationType: string): string {
  if (relationType.includes('grandfather') || relationType.includes('grandmother') ||
      relationType.includes('great_grandfather') || relationType.includes('great_grandmother'))
    return '255,200,80';   // amber — grandparents / great-grandparents
  if (relationType === 'father' || relationType === 'mother' ||
      relationType === 'stepfather' || relationType === 'stepmother' ||
      relationType === 'step_father' || relationType === 'step_mother')
    return '255,155,60';   // orange — parents
  if (relationType === 'spouse' || relationType === 'partner')
    return '255,130,175';  // rose — partner
  if (relationType === 'son' || relationType === 'daughter' ||
      relationType === 'stepson' || relationType === 'stepdaughter' ||
      relationType === 'step_son' || relationType === 'step_daughter')
    return '100,230,150';  // mint — children
  if (relationType === 'brother' || relationType === 'sister' ||
      relationType === 'half_brother' || relationType === 'half_sister' ||
      relationType === 'step_brother' || relationType === 'step_sister')
    return '90,195,255';   // sky — siblings
  if (relationType === 'uncle' || relationType === 'aunt' ||
      relationType === 'nephew' || relationType === 'niece')
    return '200,160,255';  // lavender — uncles/aunts/nephews/nieces
  if (relationType.includes('grandson') || relationType.includes('granddaughter'))
    return '80,220,180';   // teal — grandchildren
  return '185,158,235';    // default purple
}

// Per-node position — unique ellipse per member
// Pass wb=1 to suppress wobble (use when node is frozen)
function nodePos(n: OrbitNode, cx: number, cy: number, w: number, t: number, wb?: number) {
  const r = baseOrbitR(n.orbit, w) * n.rVar;
  const wobble = wb ?? (1 + n.wobAmp * Math.sin(t * n.wobFreq + n.wobPhase));
  const tilt = TILT + n.tiltVar;
  const nx = cx + n.offX + r * wobble * Math.cos(n.angle);
  const ny = cy + n.offY + r * wobble * tilt * Math.sin(n.angle);
  return { nx, ny, r, tilt };
}

// ── Image cache ───────────────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | null>();
function loadImg(url: string): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!;
  imgCache.set(url, null);
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload  = () => imgCache.set(url, img);
  img.onerror = () => imgCache.set(url, null);
  img.src = url; return null;
}

// ── Star spike drawing ────────────────────────────────────────────────────────
function drawSpikes(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number,
  rgb: string, alpha: number,
) {
  const pairs = [
    { ang: 0,               lm: 1.0, am: 1.0, lw: 1.0 },
    { ang: Math.PI / 2,     lm: 1.0, am: 1.0, lw: 1.0 },
    { ang: Math.PI / 4,     lm: 0.62, am: .55, lw: .55 },
    { ang: Math.PI * 3 / 4, lm: 0.62, am: .55, lw: .55 },
  ];
  pairs.forEach(({ ang, lm, am, lw }) => {
    const cos = Math.cos(ang), sin = Math.sin(ang), sl = len * lm, a = alpha * am;
    for (const dir of [-1, 1]) {
      const ex = x + cos * sl * dir, ey = y + sin * sl * dir;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0,    `rgba(${rgb},${(a*.95).toFixed(2)})`);
      g.addColorStop(.25,  `rgba(${rgb},${(a*.48).toFixed(2)})`);
      g.addColorStop(.65,  `rgba(${rgb},${(a*.12).toFixed(2)})`);
      g.addColorStop(1,    `rgba(${rgb},0)`);
      ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
    }
  });
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(2)})`); g.addColorStop(1, "transparent");
  ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2);
}
function drawImgCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) { ctx.drawImage(img, cx-r, cy-r, r*2, r*2); return; }
  const scale = Math.max((r*2)/iw, (r*2)/ih);
  const sw = (r*2)/scale, sh = (r*2)/scale;
  ctx.drawImage(img, (iw-sw)/2, (ih-sh)/2, sw, sh, cx-r, cy-r, r*2, r*2);
}
function drawSphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  const g = ctx.createRadialGradient(x - r*.30, y - r*.30, r*.02, x, y, r);
  g.addColorStop(0,   `rgba(255,255,255,${(alpha*.44).toFixed(2)})`);
  g.addColorStop(0.48,`rgba(255,255,255,${(alpha*.05).toFixed(2)})`);
  g.addColorStop(1,   `rgba(0,0,0,${(alpha*.52).toFixed(2)})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
}

// ── Moving dust clouds (6 independent, slow Lissajous drift) ─────────────────
const DUST = [
  { bx:.20, by:.30, r:.46, rgb:"88,10,200",  a:.19, fx:.00021, fy:.00014, px:1.0, py:0.7, amp:.14 },
  { bx:.78, by:.62, r:.38, rgb:"10,48,185",  a:.17, fx:.00016, fy:.00022, px:0.6, py:1.1, amp:.11 },
  { bx:.48, by:.42, r:.28, rgb:"195,90,8",   a:.14, fx:.00028, fy:.00012, px:1.3, py:0.5, amp:.09 },
  { bx:.30, by:.72, r:.32, rgb:"170,8,75",   a:.11, fx:.00012, fy:.00025, px:0.8, py:1.4, amp:.12 },
  { bx:.68, by:.22, r:.26, rgb:"5,160,115",  a:.09, fx:.00024, fy:.00018, px:1.5, py:0.9, amp:.10 },
  { bx:.55, by:.80, r:.34, rgb:"120,55,200", a:.12, fx:.00018, fy:.00020, px:0.9, py:1.2, amp:.08 },
] as const;

// ── Shooting star channels (prime-like periods → feels random) ────────────────
const SHOTS = [
  { period:390, offset:  0, bx:.12, by:.07, ang:.22, len:120, lw:1.5 },
  { period:290, offset:145, bx:.74, by:.13, ang:.32, len: 90, lw:1.2 },
  { period:520, offset:220, bx:.38, by:.04, ang:.17, len:140, lw:1.8 },
  { period:340, offset: 80, bx:.86, by:.35, ang:.40, len: 80, lw:1.0 },
] as const;

// ── Comet notification system ─────────────────────────────────────────────────
const _comets: Array<{ x: number; y: number; sp: number; msg: string; life: number; ml: number }> = []
let _cometTimer = 0
let _cometIdx   = 0

// ── OrbitAvatar: wraps AvatarFigure for use inside the canvas overlay ────────
function OrbitAvatar({ node }: { node: OrbitNode }) {
  const uNode: UniverseNode = {
    id: node.id,
    memberId: node.id,
    name: node.name,
    shortName: node.firstName,
    relation: node.relationType,
    relationType: node.relationType,
    gender: "unknown",
    avatarUrl: node.avatarUrl,
    avatarConfig: undefined,
    isRoot: false,
    isFocal: false,
    hopDistance: node.orbit,
    orbitRadius: 0,
    angleDeg: 0,
    cx: 0,
    cy: 0,
    scale: 1,
    opacity: 1,
    zIndex: 10,
    relevanceTier: node.orbit,
    ageGroup: "adult",
    isDeceased: node.deceased,
    isJoined: node.joined,
    parentMemberId: null,
    connectionChannel: "blood" as const,
    orbitParentId: null,
  };
  return <AvatarFigure node={uNode} overlayOnly />;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GalaxyOrbitView({
  profile, members, extendedMembers, memberLinks,
  onViewMember, onEditMember, onInviteMember, onAddMember,
  onlinePersonIds,
}: GalaxyOrbitViewProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const nodesRef    = useRef<OrbitNode[]>([]);
  const tRef        = useRef(0);
  const mouseRef    = useRef({ x: -9999, y: -9999 });
  const selectedRef    = useRef<string | null>(null);
  const frozenIdsRef   = useRef<Set<string>>(new Set());
  const memberLinksRef = useRef(memberLinks);
  const avatarElemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const onlinePersonIdsRef = useRef<Set<string>>(onlinePersonIds ?? new Set());
  const [overlayNodes, setOverlayNodes] = useState<OrbitNode[]>([]);
  useEffect(() => { memberLinksRef.current = memberLinks; }, [memberLinks]);
  useEffect(() => { onlinePersonIdsRef.current = onlinePersonIds ?? new Set(); }, [onlinePersonIds]);

  const [selectedNode, setSelectedNode] = useState<OrbitNode | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 1 | 2 | 3>>({});
  const [selPos, setSelPos] = useState<{ x: number; y: number; r: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeSetRef = useRef<Set<string>>(new Set());

  // Zoom / pan state (CSS transform on innerDivRef — no re-render needed)
  const innerDivRef    = useRef<HTMLDivElement>(null);
  const scaleRef       = useRef(1);
  const panRef         = useRef({ x: 0, y: 0 });
  const pinchDistRef   = useRef<number | null>(null);
  const panTouchRef    = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef  = useRef<{ x: number; y: number } | null>(null);
  const didDragRef     = useRef(false);
  const lastTapRef     = useRef(0);

  useEffect(() => { if (profile.avatar_url) loadImg(profile.avatar_url); }, [profile.avatar_url]);

  // Recompute which nodes are "active" (foreground) vs "dormant" (ghost)
  useEffect(() => {
    const orbit1Ids = new Set(nodesRef.current.filter(n => n.orbit === 1).map(n => n.id));
    if (!expandedId) {
      // Default: only direct family is active
      activeSetRef.current = orbit1Ids;
      return;
    }
    // Expanded: orbit1 + the expanded node + its connections
    const connected = new Set<string>([expandedId]);
    memberLinks.forEach(lk => {
      if (lk.fromMemberId === expandedId) connected.add(lk.toMemberId);
      if (lk.toMemberId   === expandedId) connected.add(lk.fromMemberId);
    });
    extendedMembers.forEach(e => {
      if (e.parentMemberId === expandedId) connected.add(e.member.id);
    });
    activeSetRef.current = new Set([...orbit1Ids, ...connected]);
  }, [expandedId, memberLinks, extendedMembers]);

  // Recompute overlay position whenever selected node or its orbit changes
  useEffect(() => {
    if (!selectedNode) { setSelPos(null); return; }
    const c = canvasRef.current;
    if (!c) return;
    const w = c.offsetWidth, h = c.offsetHeight;
    const node = nodesRef.current.find(n => n.id === selectedNode.id);
    if (!node) return;
    const { nx, ny } = nodePos(node, w / 2, h / 2, w, node.angle);
    setSelPos({ x: nx, y: ny, r: scaledNR(node.orbit, depthOf(node.angle)) });
  }, [selectedNode]);

  // ── Build nodes ──────────────────────────────────────────────────────────
  useEffect(() => {
    const seen = new Set<string>();
    const raw: OrbitNode[] = [];

    const build = (
      id: string, firstName: string, lastName: string | undefined,
      relationType: string, relationKind: string | null | undefined,
      isDeceased: boolean, profileId: string | undefined,
      avatarUrl: string | null,
    ) => {
      if (seen.has(id)) return;
      seen.add(id);
      const orbit: 1 | 2 | 3 = overrides[id] ?? seedOrbit(relationType, relationKind);
      const h = hashId(id);
      // Per-node direction (CW or CCW) from hash bit
      const sign = ((h >> 2) & 1) ? 1 : -1;
      // Per-node speed variation ±35% on top of per-orbit base
      const speedVar = 0.65 + ((h >> 4) % 70) / 100;
      const spd = BASE_SPEEDS[orbit-1] * sign * speedVar;
      if (avatarUrl) loadImg(avatarUrl);
      raw.push({
        id,
        name: `${firstName}${lastName ? " " + lastName : ""}`,
        firstName, orbit,
        angle: 0, baseSpeed: spd, speed: spd,
        deceased: isDeceased, joined: !!profileId,
        relationType, avatarUrl,
        // Orbital character from hash
        tiltVar:  ((h % 480) - 240) / 1000,           // ±0.24 — more path variety
        rVar:     0.82 + ((h >> 8) % 360) / 1000,    // 0.82–1.18
        offX:     ((h >> 12) % 72) - 36,              // ±36 px
        offY:     ((h >> 16) % 48) - 24,              // ±24 px
        wobAmp:   0.06 + ((h >> 20) % 120) / 1000,   // 0.06–0.18 — big wobble
        wobFreq:  0.0002 + ((h >> 24) % 120) / 100000, // 0.0002–0.0014
        wobPhase: ((h >> 28) % 628) / 100,
        repX: 0, repY: 0,
      });
    };

    members.forEach(m => build(m.id, m.first_name, m.last_name, m.relation_type,
      m.relation_kind, !!m.is_deceased, m.profile_id, m.profile?.avatar_url ?? null));

    extendedMembers.forEach(e => build(e.member.id, e.member.first_name, e.member.last_name,
      e.inferredRelation || "other", e.member.relation_kind,
      !!(e.member as any).is_deceased, e.member.profile_id,
      (e.member as any).profile?.avatar_url ?? null));

    // Space starting angles evenly per orbit
    const groups: Record<number, OrbitNode[]> = { 1: [], 2: [], 3: [] };
    raw.forEach(n => groups[n.orbit].push(n));
    [1, 2, 3].forEach(o => {
      const g = groups[o];
      if (!g.length) return;
      const step = (Math.PI * 2) / g.length;
      // Stagger starting angles using hash for non-uniform initial spread
      g.forEach((n, i) => {
        const h = hashId(n.id);
        n.angle = -Math.PI / 2 + step * i + (((h >> 3) % 20) - 10) / 100;
      });
    });

    // Preserve paused node angle
    if (selectedRef.current) {
      const prev = nodesRef.current.find(n => n.id === selectedRef.current);
      if (prev) {
        const next = raw.find(n => n.id === prev.id);
        if (next) { next.speed = 0; next.angle = prev.angle; }
      }
    }
    nodesRef.current = raw;
    setOverlayNodes([...raw]);
    // Seed initial active set: orbit 1 always active by default
    activeSetRef.current = new Set(raw.filter(n => n.orbit === 1).map(n => n.id));
  }, [members, extendedMembers, overrides]);

  // ── Draw loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      const cx = w / 2, cy = h / 2;
      const t = ++tRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);

      // ── Moving galactic dust clouds
      DUST.forEach((d, i) => {
        const px = d.bx + Math.sin(t * d.fx * d.px + i * 1.1) * d.amp;
        const py = d.by + Math.cos(t * d.fy * d.py + i * 0.7) * d.amp * .7;
        const gx = px * w, gy = py * h, gr = d.r * w;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0,   `rgba(${d.rgb},${d.a})`);
        g.addColorStop(0.45, `rgba(${d.rgb},${(d.a * .38).toFixed(2)})`);
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });

      // ── Background star field
      for (let i = 0; i < 180; i++) {
        const sx = ((i * 137.508) % 100) / 100 * w;
        const sy = ((i * 97.318)  % 100) / 100 * h;
        const bright = i % 13 === 0;
        const sr = bright ? 1.3 : 0.25 + (i % 4) * .14;
        const baseA = bright ? .60 : .06 + (i % 9) * .048;
        const tw = bright ? (Math.sin(t * .022 + i * .8) * .30 + .70) : 1;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(baseA * tw).toFixed(2)})`; ctx.fill();
        if (bright) {
          ctx.save(); ctx.globalAlpha = baseA * tw * .55;
          ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = .4;
          for (const ang of [0, Math.PI / 2]) {
            const cos = Math.cos(ang), sin = Math.sin(ang);
            ctx.beginPath(); ctx.moveTo(sx - cos*3, sy - sin*3);
            ctx.lineTo(sx + cos*3, sy + sin*3); ctx.stroke();
          }
          ctx.restore();
        }
      }

      // ── Multiple shooting stars (independent prime-period channels)
      SHOTS.forEach(sh => {
        const phase = (t + sh.offset) % sh.period;
        if (phase >= 55) return;
        const prog = phase / 55;
        const len = sh.len;
        const cos = Math.cos(sh.ang), sin = Math.sin(sh.ang);
        const ex = sh.bx * w + prog * len * cos;
        const ey = sh.by * h + prog * len * sin;
        const a = Math.sin(prog * Math.PI) * .88;
        // Trail gradient
        const sg = ctx.createLinearGradient(ex - len*.55*cos, ey - len*.55*sin, ex, ey);
        sg.addColorStop(0, "rgba(255,255,255,0)");
        sg.addColorStop(.5, `rgba(255,248,225,${(a*.55).toFixed(2)})`);
        sg.addColorStop(1,  `rgba(255,255,255,${a.toFixed(2)})`);
        ctx.save(); ctx.strokeStyle = sg; ctx.lineWidth = sh.lw;
        ctx.beginPath();
        ctx.moveTo(ex - len*.55*cos, ey - len*.55*sin);
        ctx.lineTo(ex, ey); ctx.stroke();
        // Sparkle at tip
        ctx.save(); ctx.globalAlpha = a * .7;
        drawGlow(ctx, ex, ey, 8, "255,248,220", .65);
        ctx.restore();
        ctx.restore();
      });

      // ── Galactic core nebula — warm glow emanating from the center
      const gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.52);
      gc.addColorStop(0,    "rgba(255,210,80,0.26)");
      gc.addColorStop(0.07, "rgba(195,130,45,0.14)");
      gc.addColorStop(0.20, "rgba(85,40,130,0.09)");
      gc.addColorStop(0.42, "rgba(22,10,58,0.05)");
      gc.addColorStop(1,    "transparent");
      ctx.save(); ctx.fillStyle = gc; ctx.fillRect(0, 0, w, h); ctx.restore();

      // ── Per-node true orbital paths (unique ellipse per star, very faint)
      const activeSet2 = activeSetRef.current;
      nodesRef.current.forEach(n => {
        const isActive = activeSet2.size === 0 || activeSet2.has(n.id);
        const rgb2 = n.joined ? "212,175,55" : "185,158,235";
        const baseAl = [0.060, 0.036, 0.020][n.orbit - 1];
        const al2 = isActive ? baseAl : baseAl * 0.35;
        const r2 = baseOrbitR(n.orbit, w) * n.rVar;
        const tilt2 = TILT + n.tiltVar;
        ctx.save();
        ctx.globalAlpha = al2;
        ctx.strokeStyle = `rgba(${rgb2},1)`;
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        const STEPS = 60;
        for (let i = 0; i <= STEPS; i++) {
          const a = (i / STEPS) * Math.PI * 2;
          const ox = cx + n.offX + r2 * Math.cos(a);
          const oy = cy + n.offY + r2 * tilt2 * Math.sin(a);
          i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      });

      // ── Constellation connections ──────────────────────────────────────────
      {
        // Build position map for all orbit nodes
        const posMap = new Map<string, { nx: number; ny: number; nr: number }>()
        let hovConnId: string | null = null
        for (const n of nodesRef.current) {
          const { nx: nxRaw, ny: nyRaw } = nodePos(n, cx, cy, w, t)
          const nx2 = nxRaw + n.repX, ny2 = nyRaw + n.repY
          const nr2 = scaledNR(n.orbit, depthOf(n.angle))
          posMap.set(n.id, { nx: nx2, ny: ny2, nr: nr2 })
          if (Math.hypot(mouseRef.current.x - nx2, mouseRef.current.y - ny2) < nr2 + 22)
            hovConnId = n.id
        }

        // Helper: draw one constellation line
        function drawConstLine(
          ax: number, ay: number, bx: number, by: number,
          lit: boolean, baseAlpha: number
        ) {
          ctx.save()
          if (lit) {
            ctx.strokeStyle = `rgba(212,175,55,0.88)`
            ctx.lineWidth = 1.7
            ctx.shadowColor = '#d4af37'
            ctx.shadowBlur = 14
          } else {
            ctx.strokeStyle = `rgba(180,165,230,${baseAlpha})`
            ctx.lineWidth = 0.7
            ctx.shadowBlur = 0
          }
          const mxL = (ax + bx) / 2 + (by - ay) * 0.07
          const myL = (ay + by) / 2 - (bx - ax) * 0.07
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.quadraticCurveTo(mxL, myL, bx, by)
          ctx.stroke()
          ctx.restore()
        }

        // 1. Nucleus → each orbit-1 node (always visible — guarantees lines show)
        const NR_PX = 48 // nucleus radius, matches the draw code below
        for (const n of nodesRef.current) {
          if (n.orbit !== 1) continue
          const pos = posMap.get(n.id)
          if (!pos) continue
          const lit = hovConnId === n.id
          // Offset endpoints to the surface of each body, not their centers
          const dx = pos.nx - cx, dy = pos.ny - cy
          const dist = Math.hypot(dx, dy) || 1
          const ax = cx  + (dx / dist) * NR_PX
          const ay = cy  + (dy / dist) * NR_PX
          const bx = pos.nx - (dx / dist) * pos.nr
          const by = pos.ny - (dy / dist) * pos.nr
          drawConstLine(ax, ay, bx, by, lit, 0.38)
        }

        // 2. Non-root member-to-member edges (grandparent↔parent, spouse↔child, etc.)
        memberLinksRef.current.forEach(link => {
          const pa = posMap.get(link.fromMemberId)
          const pb = posMap.get(link.toMemberId)
          if (!pa || !pb) return
          const lit = hovConnId === link.fromMemberId || hovConnId === link.toMemberId
          drawConstLine(pa.nx, pa.ny, pb.nx, pb.ny, lit, 0.14)
        })
      }

      // ── Phase 1: compute base positions & advance angles ─────────────────────
      const activeSet = activeSetRef.current;

      // Pre-pass: find which node the mouse is over → freeze it + connections
      let hoveredId: string | null = null;
      for (const n of nodesRef.current) {
        if (activeSet.size > 0 && !activeSet.has(n.id)) continue;
        const { nx: px, ny: py } = nodePos(n, cx, cy, w, t);
        const nr0 = scaledNR(n.orbit, depthOf(n.angle));
        if (Math.hypot(mouseRef.current.x - (px + n.repX), mouseRef.current.y - (py + n.repY)) < nr0 + 28) {
          hoveredId = n.id; break;
        }
      }
      const hovFrozen = new Set<string>();
      if (hoveredId) {
        hovFrozen.add(hoveredId);
        memberLinksRef.current.forEach(lk => {
          if (lk.fromMemberId === hoveredId) hovFrozen.add(lk.toMemberId);
          if (lk.toMemberId   === hoveredId) hovFrozen.add(lk.fromMemberId);
        });
      }

      const raw = nodesRef.current.map(n => {
        const depth = depthOf(n.angle);
        const ghost = activeSet.size > 0 && !activeSet.has(n.id);
        const nr    = scaledNR(n.orbit, depth) * (ghost ? 0.40 : 1);
        const hov    = n.id === hoveredId;
        const hovFrz = hovFrozen.has(n.id);   // hovered node OR directly connected
        const sel    = selectedRef.current === n.id;
        const frz    = !sel && (frozenIdsRef.current.has(n.id) || hovFrz);
        const eff    = sel || frz ? 0 : n.speed;
        n.angle += eff;
        // Frozen nodes use wobble=1 so position is perfectly still
        const { nx, ny } = nodePos(n, cx, cy, w, t, (sel || frz) ? 1 : undefined);
        return { n, nx, ny, depth, nr, hov, hovFrz, sel, ghost };
      });

      // ── Phase 2: separation force (prevents collisions) ──────────────────────
      // Sprites are 144px tall — need more horizontal breathing room to avoid overlap
      const COMFORT = 2.8;   // comfort zone (was 1.9 for circles, bumped for tall sprites)
      const FORCE_K = 1.6;   // push strength per frame
      const DAMP    = 0.78;  // velocity decay (< 1 prevents runaway)
      const MAX_REP = 90;    // max pixel displacement (was 55)
      for (let i = 0; i < raw.length; i++) {
        for (let j = i + 1; j < raw.length; j++) {
          const a = raw[i], b = raw[j];
          const ax = a.nx + a.n.repX, ay = a.ny + a.n.repY;
          const bx = b.nx + b.n.repX, by = b.ny + b.n.repY;
          const dx = ax - bx, dy = ay - by;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minD = (a.nr + b.nr) * COMFORT;
          if (dist < minD) {
            const push = (minD - dist) / minD * FORCE_K;
            const fx = (dx / dist) * push, fy = (dy / dist) * push;
            // Paused/frozen nodes act as obstacles but don't move
            const aStop = a.sel || frozenIdsRef.current.has(a.n.id) || hovFrozen.has(a.n.id);
            const bStop = b.sel || frozenIdsRef.current.has(b.n.id) || hovFrozen.has(b.n.id);
            if (!aStop) { a.n.repX += fx; a.n.repY += fy; }
            if (!bStop) { b.n.repX -= fx; b.n.repY -= fy; }
          }
        }
      }
      raw.forEach(({ n }) => {
        n.repX = Math.max(-MAX_REP, Math.min(MAX_REP, n.repX * DAMP));
        n.repY = Math.max(-MAX_REP, Math.min(MAX_REP, n.repY * DAMP));
      });

      // ── Phase 3: apply offset, sort back-to-front ────────────────────────────
      const all = raw
        .map(r => ({ ...r, nx: r.nx + r.n.repX, ny: r.ny + r.n.repY }))
        .sort((a, b) => {
          // hover group renders on top of everyone else
          if (a.hovFrz !== b.hovFrz) return a.hovFrz ? 1 : -1;
          return a.ny - b.ny;
        });

      // Update HTML avatar overlay positions directly (no React re-render)
      all.forEach(({ n, nx, ny, nr, ghost, hovFrz }) => {
        const el = avatarElemRefs.current.get(n.id);
        if (!el) return;
        if (ghost) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
          // Feet (bottom of sprite) land near the orbital platform glow
          el.style.transform = `translate(${nx - STAR_R}px, ${ny - STAR_R}px) scale(${nr / STAR_R})`;
          el.style.zIndex = hovFrz ? '10' : '1';
        }
      });

      all.forEach(({ n, nx, ny, depth, nr, hov, hovFrz, sel, ghost }) => {
        // Ghost nodes: faint distant star, no name, still tappable
        if (ghost) {
          const ga = 0.10 + depth * 0.08;
          ctx.save(); ctx.globalAlpha = ga;
          drawGlow(ctx, nx, ny, nr * 3, "180,160,255", .30);
          ctx.fillStyle = "rgba(200,185,255,0.70)";
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.fill();
          ctx.restore();
          return;
        }
        const dAlpha = 0.25 + depth * 0.75;
        const img = n.avatarUrl ? loadImg(n.avatarUrl) : null;
        const spikeLen = nr * (sel ? 6.5 : hov ? 5.5 : 3.8);

        if (n.deceased) {
          // ── Cold silver atmosphere + dark base (AvatarFigure overlay renders on top)
          const sil = "175,200,225";
          const dA = dAlpha * .72;
          ctx.save(); ctx.globalAlpha = dA * .50;
          drawGlow(ctx, nx, ny, nr * 4, sil, .35); ctx.restore();
          ctx.save(); ctx.globalAlpha = dA * .45;
          drawSpikes(ctx, nx, ny, nr * 3.2, sil, .55); ctx.restore();
          // Dark base circle for avatar
          ctx.save(); ctx.globalAlpha = dA;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.clip();
          ctx.fillStyle = "rgba(3,2,8,0.95)"; ctx.fillRect(nx-nr, ny-nr, nr*2, nr*2);
          ctx.restore();
          // Silver rim
          ctx.save(); ctx.globalAlpha = dA * .85;
          ctx.strokeStyle = "rgba(175,200,225,0.75)"; ctx.lineWidth = 1.4;
          ctx.shadowColor = "rgba(175,200,225,0.4)"; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.stroke();
          ctx.shadowBlur = 0; ctx.restore();
          // Name — italic, silver pill
          ctx.save(); ctx.globalAlpha = dA * .88;
          ctx.font = `italic 600 11px -apple-system,sans-serif`;
          const lbl = n.firstName;
          const lw = ctx.measureText(lbl).width + 12;
          ctx.fillStyle = "rgba(3,2,8,0.85)";
          ctx.beginPath(); ctx.roundRect(nx - lw/2, ny + nr + 5, lw, 17, 4); ctx.fill();
          ctx.fillStyle = "rgba(175,205,235,0.85)";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(lbl, nx, ny + nr + 13); ctx.restore();
        } else {
          const joined = n.joined;
          const rgb = memberRgb(n.relationType);

          // ── Generation decoration: grandparent corona / parent ring ──────────
          const isGrandparent = n.relationType.includes('grandfather') || n.relationType.includes('grandmother')
          const isParent = n.relationType === 'father' || n.relationType === 'mother' ||
                           n.relationType === 'stepfather' || n.relationType === 'stepmother' ||
                           n.relationType === 'step_father' || n.relationType === 'step_mother'

          if (isGrandparent) {
            const spikes = 18
            const outerR = nr * 1.62 * (1 + Math.sin(t * 0.0019 + n.wobPhase) * 0.04)
            const innerR = nr * 1.06
            ctx.save()
            ctx.globalAlpha = dAlpha * 0.52
            ctx.fillStyle = 'rgba(255,215,0,0.48)'
            ctx.shadowColor = '#FFD700'
            ctx.shadowBlur = 24
            ctx.beginPath()
            for (let i = 0; i <= spikes * 2; i++) {
              const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
              const r2 = i % 2 === 0 ? outerR : innerR
              i === 0 ? ctx.moveTo(nx + Math.cos(ang) * r2, ny + Math.sin(ang) * r2)
                      : ctx.lineTo(nx + Math.cos(ang) * r2, ny + Math.sin(ang) * r2)
            }
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }

          if (isParent) {
            ctx.save()
            ctx.translate(nx, ny)
            ctx.scale(1, 0.26)
            ctx.strokeStyle = `rgba(${rgb},0.42)`
            ctx.lineWidth = 3.5
            ctx.shadowColor = joined ? '#F5D080' : 'rgba(185,158,235,0.5)'
            ctx.shadowBlur = 11
            ctx.beginPath()
            ctx.arc(0, 0, nr * 1.65, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
          }

          // Outer nebula halo
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .72 : hovFrz ? .52 : .28);
          drawGlow(ctx, nx, ny, nr * 5.5, rgb, .40); ctx.restore();

          // Orb glow rings
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .95 : hovFrz ? .82 : .60);
          drawGlow(ctx, nx, ny, nr * 3.8, rgb, .52 + (hov || sel ? .25 : hovFrz ? .12 : 0)); ctx.restore();
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .82 : hovFrz ? .65 : .40);
          drawGlow(ctx, nx, ny, nr * 2.0, rgb, .78); ctx.restore();

          // Pulse ring (selected)
          if (sel) {
            const pf = (Math.sin(t * .10) + 1) / 2;
            ctx.save(); ctx.globalAlpha = .55 + pf * .28;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.arc(nx, ny, nr + 8 + pf * 5, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
          }

          // Online presence ring — pulsing green heartbeat
          if (onlinePersonIdsRef.current.has(n.id)) {
            const pf = (Math.sin(t * 0.07 + n.wobPhase) + 1) / 2;
            // Outer expanding ring
            ctx.save();
            ctx.globalAlpha = dAlpha * (0.25 + pf * 0.30);
            ctx.strokeStyle = "rgba(74,222,128,0.6)";
            ctx.lineWidth = 1.5;
            ctx.shadowColor = "rgba(74,222,128,0.9)";
            ctx.shadowBlur = 14 + pf * 10;
            ctx.beginPath(); ctx.arc(nx, ny, nr + 10 + pf * 6, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            // Inner tight ring
            ctx.save();
            ctx.globalAlpha = dAlpha * (0.65 + pf * 0.30);
            ctx.strokeStyle = "rgba(74,222,128,0.95)";
            ctx.lineWidth = 2;
            ctx.shadowColor = "rgba(74,222,128,1)";
            ctx.shadowBlur = 8 + pf * 6;
            ctx.beginPath(); ctx.arc(nx, ny, nr + 3, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }

          // Inner tight glow
          ctx.save(); ctx.globalAlpha = dAlpha;
          drawGlow(ctx, nx, ny, nr * 1.9, rgb, .72); ctx.restore();

          // Core — dark circle base (AvatarFigure HTML overlay renders on top)
          ctx.save(); ctx.globalAlpha = dAlpha;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.clip();
          const sg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
          sg.addColorStop(0,   'rgba(4,2,16,0.96)');
          sg.addColorStop(0.6, 'rgba(8,4,28,0.92)');
          sg.addColorStop(1,   `rgba(${rgb},0.32)`);
          ctx.fillStyle = sg;
          ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
          ctx.restore();
          // 3D sphere highlight
          ctx.save(); ctx.globalAlpha = dAlpha * 0.28;
          drawSphere(ctx, nx, ny, nr, 0.4);
          ctx.restore();

          // Glowing rim — all nodes
          ctx.save(); ctx.globalAlpha = dAlpha * (hov||sel ? 1 : hovFrz ? .96 : .82);
          ctx.strokeStyle = joined ? (hov||sel||hovFrz ? "#ffe97a" : GOLD) : "rgba(200,180,255,0.75)";
          ctx.lineWidth = hov||sel ? 2.5 : hovFrz ? 2.1 : 1.6;
          ctx.shadowColor = joined ? (hov||sel ? '#ffe97a' : hovFrz ? '#FFD060' : '#D4AF37') : 'rgba(185,158,235,0.7)';
          ctx.shadowBlur = hov||sel ? 16 : hovFrz ? 12 : 8;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();

          // ── Unique per-node stellar corona ────────────────────────────────
          // wobPhase is a deterministic seed (0–2π) unique per node
          {
            const s       = n.wobPhase                              // seed
            const rays    = 7 + Math.floor((s / (Math.PI * 2)) * 6)  // 7–12 rays
            const rot     = s + t * 0.00007                         // slow unique rotation
            const baseLen = nr * (hov || sel ? 1.8 : 1.3)
            ctx.save()
            ctx.globalAlpha = dAlpha * (hov || sel ? 0.72 : 0.38)
            ctx.lineCap = 'round'
            ctx.shadowColor = `rgba(${rgb},0.9)`
            ctx.shadowBlur   = nr * 0.6
            for (let i = 0; i < rays; i++) {
              const ang = rot + (i / rays) * Math.PI * 2
              // Alternate long/short rays seeded by wobPhase
              const lenFactor = i % 2 === 0
                ? 1.0 + 0.45 * Math.abs(Math.sin(s * (i + 1.3)))
                : 0.48 + 0.30 * Math.abs(Math.cos(s * (i + 0.7)))
              const rayEnd = nr + baseLen * lenFactor
              ctx.strokeStyle = `rgba(${rgb},${i % 2 === 0 ? 0.85 : 0.45})`
              ctx.lineWidth   = i % 2 === 0 ? 1.4 : 0.8
              ctx.beginPath()
              ctx.moveTo(nx + Math.cos(ang) * (nr + 1), ny + Math.sin(ang) * (nr + 1))
              ctx.lineTo(nx + Math.cos(ang) * rayEnd,   ny + Math.sin(ang) * rayEnd)
              ctx.stroke()
            }
            ctx.shadowBlur = 0
            ctx.restore()
          }

          // Name — always for hover group, orbit 1 always, rest only on direct hover/sel
          const showLabel = sel || hov || hovFrz || n.orbit === 1;
          if (showLabel) {
            ctx.save(); ctx.globalAlpha = dAlpha * (sel||hov ? 1 : hovFrz ? 0.92 : 0.68);
            const lbl2 = sel||hov||hovFrz ? n.name : n.firstName;
            ctx.font = `${sel||hov||hovFrz ? 700 : 500} ${sel||hov||hovFrz ? 13 : 12}px -apple-system,sans-serif`;
            const lw2 = Math.min(ctx.measureText(lbl2).width + 14, 160);
            ctx.fillStyle = "rgba(3,2,8,0.90)";
            ctx.beginPath(); ctx.roundRect(nx - lw2/2, ny + nr + 5, lw2, 19, 5); ctx.fill();
            ctx.fillStyle = sel||hov
              ? "rgba(255,255,255,0.97)"
              : hovFrz
                ? (joined ? "rgba(255,235,120,0.96)" : "rgba(220,205,255,0.96)")
                : (joined ? "rgba(245,220,100,0.88)" : "rgba(210,190,255,0.88)");
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(lbl2, nx, ny + nr + 14); ctx.restore();
          }
        }
      });

      // ── Nucleus (user — dominant center star)
      const NR = 48; // nucleus — sun of the system
      const pulse = (Math.sin(t * .038) + 1) / 2;

      // Rotating decorative rings (3 independent, different tilts & speeds)
      const rings = [
        { r: NR + 22, tilt: .38, speed: t * .000175,  lw: 1.0, al: .32 },
        { r: NR + 42, tilt: .55, speed: t * -.00011,  lw: .8,  al: .22 },
        { r: NR + 64, tilt: .28, speed: t * .000075,  lw: .6,  al: .14 },
      ];
      rings.forEach(ring => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.speed);
        ctx.strokeStyle = `rgba(212,175,55,${ring.al})`;
        ctx.lineWidth = ring.lw;
        ctx.setLineDash([5, 9]);
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.r, ring.r * ring.tilt, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });

      // Solar corona — multi-layer radial glow
      ctx.save(); drawGlow(ctx, cx, cy, w * .38, "212,175,55", .12 + pulse * .05); ctx.restore();
      ctx.save(); drawGlow(ctx, cx, cy, NR * 5.5, "240,200,80", .28 + pulse * .10); ctx.restore();
      ctx.save(); drawGlow(ctx, cx, cy, NR * 2.8, "255,232,120", .55 + pulse * .18); ctx.restore();

      // 8-pointed star polygon (slowly rotating behind photo)
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(t * 0.00025);
      const pts = 8, ro2 = NR * 2.5, ri2 = NR * 1.55;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI / pts) - Math.PI / 2;
        const r2 = i % 2 === 0 ? ro2 : ri2;
        i === 0 ? ctx.moveTo(r2 * Math.cos(a), r2 * Math.sin(a))
                : ctx.lineTo(r2 * Math.cos(a), r2 * Math.sin(a));
      }
      ctx.closePath();
      const starG = ctx.createRadialGradient(0, 0, NR, 0, 0, ro2);
      starG.addColorStop(0,   "rgba(255,230,100,0.50)");
      starG.addColorStop(0.55,"rgba(212,175,55,0.18)");
      starG.addColorStop(1,   "transparent");
      ctx.fillStyle = starG; ctx.fill(); ctx.restore();

      // Diffraction spikes
      ctx.save(); drawSpikes(ctx, cx, cy, NR * 3.2 + pulse * 12, "255,240,150", .98); ctx.restore();
      ctx.save(); drawGlow(ctx, cx, cy, NR * 1.35, "255,245,180", .82); ctx.restore();

      // Pulse halo ring
      ctx.save(); ctx.globalAlpha = .14 + pulse * .14;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, NR + 18 + pulse * 10, 0, Math.PI*2); ctx.stroke(); ctx.restore();

      // Photo circle
      const profileImg = profile.avatar_url ? loadImg(profile.avatar_url) : null;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, NR, 0, Math.PI*2); ctx.clip();
      ctx.fillStyle = "rgba(28,16,4,0.98)"; ctx.fillRect(cx-NR, cy-NR, NR*2, NR*2);
      if (profileImg) {
        drawImgCover(ctx, profileImg, cx, cy, NR);
      } else {
        // Núcleo sin foto — inicial grande, dorada
        const nsg = ctx.createRadialGradient(cx - NR*.28, cy - NR*.28, NR*.04, cx, cy, NR);
        nsg.addColorStop(0,    "rgba(212,175,55,0.82)");
        nsg.addColorStop(0.55, "rgba(212,175,55,0.38)");
        nsg.addColorStop(1,    "rgba(120,90,10,0.06)");
        ctx.fillStyle = nsg; ctx.fillRect(cx-NR, cy-NR, NR*2, NR*2);
        ctx.font = `800 ${Math.round(NR * 0.80)}px -apple-system,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,242,140,0.97)";
        ctx.fillText(profile.first_name[0]?.toUpperCase() ?? "?", cx, cy + NR * 0.04);
      }
      ctx.restore();
      // 3D sphere highlight on nucleus
      ctx.save(); drawSphere(ctx, cx, cy, NR, 1); ctx.restore();
      ctx.save(); ctx.strokeStyle = "#ffe060"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, NR, 0, Math.PI*2); ctx.stroke(); ctx.restore();

      // Name pill
      ctx.save(); ctx.font = "700 12px -apple-system,sans-serif";
      const pl = profile.first_name;
      const plw = ctx.measureText(pl).width + 16;
      ctx.fillStyle = "rgba(3,2,8,0.92)";
      ctx.beginPath(); ctx.roundRect(cx - plw/2, cy + NR + 7, plw, 18, 5); ctx.fill();
      ctx.fillStyle = "rgba(245,220,100,0.95)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(pl, cx, cy + NR + 17); ctx.restore();

      // ── Comet notifications — real family data, 60% slower ────────────────
      _cometTimer++
      if (_cometTimer > 340 && _comets.length < 2) {
        _cometTimer = 0
        // Build messages from actual family nodes
        const liveNodes = nodesRef.current.filter(n => !n.deceased)
        const joinedNodes = liveNodes.filter(n => n.joined)
        const cometMsgs: string[] = []
        joinedNodes.forEach(n => {
          const rel = (RELATION_LABELS as Record<string, string>)[n.relationType] ?? n.relationType
          cometMsgs.push(`✦ ${n.name} · ${rel} · en Ceiba`)
        })
        liveNodes.filter(n => !n.joined).forEach(n => {
          const rel = (RELATION_LABELS as Record<string, string>)[n.relationType] ?? n.relationType
          cometMsgs.push(`🌟 ${n.name} · ${rel}`)
        })
        if (liveNodes.length > 0) cometMsgs.push(`👨‍👩‍👧 ${liveNodes.length} personas en tu galaxia`)
        if (joinedNodes.length > 0) cometMsgs.push(`✨ ${joinedNodes.length} familiares conectados en Ceiba`)
        const msgs = cometMsgs.length > 0 ? cometMsgs : [`🌟 Tu universo familiar te espera`]
        _comets.push({
          x: -80, y: h * (0.18 + Math.random() * 0.38),
          sp: (1.28 + Math.random() * 0.8),   // 40% of original speed (~60% slower)
          msg: msgs[_cometIdx++ % msgs.length],
          life: 0, ml: 680,
        })
      }
      for (let ci = _comets.length - 1; ci >= 0; ci--) {
        const c = _comets[ci]
        c.x += c.sp; c.life++
        if (c.life > c.ml || c.x > w + 80) { _comets.splice(ci, 1); continue }
        const fade = c.life < 30 ? c.life / 30 : c.life > c.ml - 60 ? (c.ml - c.life) / 60 : 1
        ctx.save()
        ctx.globalAlpha = fade
        const tg = ctx.createLinearGradient(c.x - 85, c.y, c.x, c.y)
        tg.addColorStop(0, 'transparent')
        tg.addColorStop(1, `rgba(240,200,100,${(fade * 0.72).toFixed(2)})`)
        ctx.strokeStyle = tg; ctx.lineWidth = 2.2
        ctx.beginPath(); ctx.moveTo(c.x - 85, c.y); ctx.lineTo(c.x, c.y); ctx.stroke()
        ctx.fillStyle = '#fffce0'; ctx.shadowColor = '#f0c040'; ctx.shadowBlur = 18
        ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2); ctx.fill()
        if (c.life > 28) {
          ctx.font = '500 11px -apple-system,sans-serif'
          ctx.fillStyle = 'rgba(255,240,200,0.85)'
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(212,175,55,0.45)'
          ctx.fillText(c.msg, c.x + 12, c.y)
        }
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [profile]);

  // ── Interaction ───────────────────────────────────────────────────────────

  // Apply zoom/pan CSS transform directly to inner div (no React re-render)
  const applyTransform = useCallback(() => {
    if (!innerDivRef.current) return;
    const { x, y } = panRef.current;
    const s = scaleRef.current;
    innerDivRef.current.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  }, []);

  // Accept raw client coords and unscale them to canvas logical space
  const getNodeAt = useCallback((clientX: number, clientY: number): OrbitNode | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0) return null;
    const cssScale = rect.width / c.offsetWidth;
    const mx = (clientX - rect.left) / cssScale;
    const my = (clientY - rect.top) / cssScale;
    const w = c.offsetWidth, h = c.offsetHeight;
    const cx = w / 2, cy = h / 2;
    const t = tRef.current;
    return nodesRef.current.find(n => {
      const { nx, ny } = nodePos(n, cx, cy, w, t);
      return Math.hypot(mx - (nx + n.repX), my - (ny + n.repY)) < scaledNR(n.orbit, depthOf(n.angle)) + 18;
    }) ?? null;
  }, []);

  // Shared selection logic used by both pointer (desktop) and touch (mobile)
  const selectAt = useCallback((clientX: number, clientY: number) => {
    const hit = getNodeAt(clientX, clientY);
    if (hit) {
      const prevFrozen = frozenIdsRef.current;
      nodesRef.current.forEach(n => {
        if (prevFrozen.has(n.id) || n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      const newFrozen = new Set<string>([hit.id]);
      memberLinksRef.current.forEach(lk => {
        if (lk.fromMemberId === hit.id) newFrozen.add(lk.toMemberId);
        if (lk.toMemberId   === hit.id) newFrozen.add(lk.fromMemberId);
      });
      nodesRef.current.forEach(n => { if (newFrozen.has(n.id)) n.speed = 0; });
      frozenIdsRef.current = newFrozen;
      selectedRef.current  = hit.id;
      activeSetRef.current = new Set([...activeSetRef.current, ...newFrozen]);
      setSelectedNode({ ...hit, speed: 0 });
    } else {
      nodesRef.current.forEach(n => {
        if (frozenIdsRef.current.has(n.id) || n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      frozenIdsRef.current = new Set();
      selectedRef.current  = null;
      activeSetRef.current = new Set(nodesRef.current.filter(n => n.orbit === 1).map(n => n.id));
      setSelectedNode(null);
    }
  }, [getNodeAt]);

  // Desktop pointer events (mouse only — touch handled separately)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    selectAt(e.clientX, e.clientY);
  }, [selectAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0) return;
    const cssScale = rect.width / c.offsetWidth;
    mouseRef.current = { x: (e.clientX - rect.left) / cssScale, y: (e.clientY - rect.top) / cssScale };
  }, []);

  // Mobile touch events — pinch-to-zoom + pan + tap
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.hypot(dx, dy);
      didDragRef.current = true;
      panTouchRef.current = null;
    } else if (e.touches.length === 1) {
      panTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pinchDistRef.current = null;
      didDragRef.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const factor = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      const newScale = Math.max(0.35, Math.min(4, scaleRef.current * factor));
      const f = newScale / scaleRef.current;
      // Zoom around midpoint of the two fingers
      const midCX = (t0.clientX + t1.clientX) / 2;
      const midCY = (t0.clientY + t1.clientY) / 2;
      const outerEl = innerDivRef.current?.parentElement;
      if (outerEl) {
        const r = outerEl.getBoundingClientRect();
        const fpx = midCX - r.left;
        const fpy = midCY - r.top;
        panRef.current = {
          x: fpx * (1 - f) + panRef.current.x * f,
          y: fpy * (1 - f) + panRef.current.y * f,
        };
      }
      scaleRef.current = newScale;
      applyTransform();
    } else if (e.touches.length === 1 && panTouchRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - panTouchRef.current.x;
      const dy = touch.clientY - panTouchRef.current.y;
      panTouchRef.current = { x: touch.clientX, y: touch.clientY };
      if (touchStartRef.current) {
        const totalDist = Math.hypot(
          touch.clientX - touchStartRef.current.x,
          touch.clientY - touchStartRef.current.y,
        );
        if (totalDist > 8) didDragRef.current = true;
      }
      if (didDragRef.current) {
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
        applyTransform();
      }
    }
  }, [applyTransform]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) {
      if (!didDragRef.current && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          // Double-tap → reset zoom and pan
          scaleRef.current = 1;
          panRef.current = { x: 0, y: 0 };
          applyTransform();
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          selectAt(touch.clientX, touch.clientY);
        }
      }
      panTouchRef.current = null;
      touchStartRef.current = null;
      didDragRef.current = false;
    }
  }, [selectAt, applyTransform]);

  const shift = useCallback((nodeId: string, dir: "in" | "out") => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const next = (dir === "in" ? node.orbit - 1 : node.orbit + 1) as 1 | 2 | 3;
    if (next < 1 || next > 3) return;
    setOverrides(prev => ({ ...prev, [nodeId]: next }));
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, orbit: next } : prev);
  }, []);

  const close = useCallback(() => {
    const frozen = frozenIdsRef.current;
    nodesRef.current.forEach(n => {
      if (frozen.has(n.id) || n.id === selectedRef.current) n.speed = n.baseSpeed;
    });
    frozenIdsRef.current = new Set();
    selectedRef.current  = null;
    activeSetRef.current = new Set(nodesRef.current.filter(n => n.orbit === 1).map(n => n.id));
    setSelectedNode(null);
  }, []);

  return (
    <div
      style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => { mouseRef.current = { x:-9999, y:-9999 }; }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes gov-up {
          from { opacity:0; transform:translateX(-50%) translateY(18px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0);    }
        }
      `}</style>

      {/* Inner div receives the CSS zoom+pan transform */}
      <div
        ref={innerDivRef}
        style={{ position:"absolute", inset:0, transformOrigin:"0 0" }}
      >

      <canvas
        ref={canvasRef}
        style={{ width:"100%", height:"100%", display:"block", touchAction:"none", cursor:"pointer" }}
        onPointerDown={handlePointerDown}
      />

      {/* ── Orbit buttons on star ── */}
      {selectedNode && selPos && (
        <>
          {selectedNode.orbit > 1 && (
            <button
              onClick={() => shift(selectedNode.id, "in")}
              style={{
                position:"absolute",
                left: selPos.x - selPos.r - 36,
                top:  selPos.y - 18,
                width:32, height:32, borderRadius:"50%",
                fontSize:20, fontWeight:700, lineHeight:"32px",
                textAlign:"center", padding:0, cursor:"pointer",
                color:"rgba(212,175,55,0.95)",
                background:"rgba(5,2,12,0.85)",
                border:"1px solid rgba(212,175,55,0.40)",
                backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
                zIndex:40, pointerEvents:"auto",
              }}>−</button>
          )}
          {selectedNode.orbit < 3 && (
            <button
              onClick={() => shift(selectedNode.id, "out")}
              style={{
                position:"absolute",
                left: selPos.x + selPos.r + 4,
                top:  selPos.y - 18,
                width:32, height:32, borderRadius:"50%",
                fontSize:20, fontWeight:700, lineHeight:"32px",
                textAlign:"center", padding:0, cursor:"pointer",
                color:"rgba(212,175,55,0.95)",
                background:"rgba(5,2,12,0.85)",
                border:"1px solid rgba(212,175,55,0.40)",
                backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
                zIndex:40, pointerEvents:"auto",
              }}>+</button>
          )}
        </>
      )}

      {/* ── Floating info card — anchored near the selected node ── */}
      {selectedNode && selPos && (() => {
        const cardW = 216;
        const cw = canvasRef.current?.offsetWidth ?? 800;
        const cardX = Math.max(12, Math.min(selPos.x - cardW / 2, cw - cardW - 12));
        const aboveY = selPos.y - selPos.r - 126;
        const cardY = aboveY > 56 ? aboveY : selPos.y + selPos.r + 14;
        return (
          <div style={{
            position:"absolute", left:cardX, top:cardY, width:cardW,
            background:"rgba(4,2,10,0.72)",
            backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)",
            border:"0.5px solid rgba(212,175,55,0.28)",
            borderTop:"1px solid rgba(212,175,55,0.48)",
            borderRadius:16, padding:"11px 13px",
            boxShadow:"0 12px 40px rgba(0,0,0,0.75)",
            animation:"gov-up 0.18s cubic-bezier(.22,.8,.36,1)",
            zIndex:30,
          }}>
            {/* Name + relation + close */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:9 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:14, fontWeight:700, color: selectedNode.deceased ? "rgba(175,205,235,0.90)" : "#fff",
                  fontStyle: selectedNode.deceased ? "italic" : "normal",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>
                  {selectedNode.name}
                </div>
                <div style={{ fontSize:11, fontWeight:600, marginTop:2,
                  color: selectedNode.deceased ? "rgba(175,200,225,0.60)"
                       : selectedNode.joined ? "rgba(245,220,100,0.78)" : "rgba(200,180,255,0.72)" }}>
                  {(RELATION_LABELS as Record<string, string>)[selectedNode.relationType] ?? selectedNode.relationType}
                  {selectedNode.deceased ? " · En memoria" : ""}
                  {selectedNode.joined && !selectedNode.deceased ? " · Conectado" : ""}
                </div>
              </div>
              <button onClick={close} style={{
                background:"none", border:"none", cursor:"pointer",
                color:"rgba(255,255,255,0.28)", fontSize:18, lineHeight:1, padding:0, flexShrink:0, marginTop:1,
              }}>×</button>
            </div>
            {/* Actions */}
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setExpandedId(expandedId === selectedNode.id ? null : selectedNode.id)} style={{
                flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontSize:11, fontWeight:700,
                background: expandedId === selectedNode.id ? "rgba(212,175,55,0.20)" : "rgba(212,175,55,0.09)",
                border:"1px solid rgba(212,175,55,0.42)", color:GOLD,
              }}>
                {expandedId === selectedNode.id ? "Contraer" : "Ver familia"}
              </button>
              <button onClick={() => { onEditMember(selectedNode.id); close(); }} style={{
                flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontSize:11, fontWeight:600,
                background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.15)",
                color:"rgba(255,255,255,0.78)",
              }}>Editar</button>
              {!selectedNode.joined && (
                <button onClick={() => { onInviteMember(selectedNode.id); close(); }} style={{
                  flex:1, padding:"7px 0", borderRadius:9, cursor:"pointer", fontSize:11, fontWeight:700,
                  background:"#c9a820", border:"none", color:"#030208",
                }}>Invitar</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Avatar HTML overlay (positioned above canvas, below panels) ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {overlayNodes.map(n => (
          <div
            key={n.id}
            ref={el => { avatarElemRefs.current.set(n.id, el); }}
            style={{
              position: 'absolute', top: 0, left: 0,
              transformOrigin: `${STAR_R}px ${STAR_R}px`,
              willChange: 'transform',
              pointerEvents: 'none',
              display: 'none',
            }}
          >
            <OrbitAvatar node={n} />
          </div>
        ))}
      </div>

      {/* ── Add member — almost invisible, never competes ── */}
      <button onClick={onAddMember} aria-label="Agregar familiar" style={{
        position:"absolute", bottom:18, right:14,
        width:32, height:32, borderRadius:"50%",
        background:"transparent",
        border:"1px solid rgba(212,175,55,0.20)",
        color:"rgba(212,175,55,0.40)", fontSize:18, fontWeight:400,
        cursor:"pointer", display:"flex", alignItems:"center",
        justifyContent:"center", zIndex:20, lineHeight:1,
      }}>
        +
      </button>

      </div>{/* end innerDivRef */}
    </div>
  );
}
