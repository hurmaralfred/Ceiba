"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, FamilyMember } from "@/lib/types";
import { RELATION_LABELS } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";
import { AvatarFigure } from "./AvatarFigure";
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
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GOLD   = "#d4af37";
const BG     = "#030208";
const TILT   = 0.68;
const BASE_ORBIT_FRACS = [0.21, 0.375, 0.52] as const;
const BASE_SPEEDS      = [0.0032, 0.0022, 0.0012] as const;
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
function nodePos(n: OrbitNode, cx: number, cy: number, w: number, t: number) {
  const r = baseOrbitR(n.orbit, w) * n.rVar;
  const wobble = 1 + n.wobAmp * Math.sin(t * n.wobFreq + n.wobPhase);
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
const COMET_MSGS = [
  '⭐ Mamá compartió una foto',
  '🎂 Cumpleaños de Sofía · mañana',
  '✨ Papá actualizó su historia',
  '📸 Ana subió recuerdos',
  '🌟 5 años de la reunión familiar',
]
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
  return <AvatarFigure node={uNode} />;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GalaxyOrbitView({
  profile, members, extendedMembers, memberLinks,
  onViewMember, onEditMember, onInviteMember, onAddMember,
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
  const [overlayNodes, setOverlayNodes] = useState<OrbitNode[]>([]);
  useEffect(() => { memberLinksRef.current = memberLinks; }, [memberLinks]);

  const [selectedNode, setSelectedNode] = useState<OrbitNode | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 1 | 2 | 3>>({});
  const [selPos, setSelPos] = useState<{ x: number; y: number; r: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeSetRef = useRef<Set<string>>(new Set());

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
        const { nx: px, ny: py } = nodePos(n, cx, cy, w, t - 1);
        const nr0 = scaledNR(n.orbit, depthOf(n.angle));
        if (Math.hypot(mouseRef.current.x - (px + n.repX), mouseRef.current.y - (py + n.repY)) < nr0 + 22) {
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
        const hov   = n.id === hoveredId;
        const sel   = selectedRef.current === n.id;
        const frz   = !sel && (frozenIdsRef.current.has(n.id) || hovFrozen.has(n.id));
        const eff   = sel || frz ? 0 : n.speed;
        n.angle += eff;
        const { nx, ny } = nodePos(n, cx, cy, w, t);
        return { n, nx, ny, depth, nr, hov, sel, ghost };
      });

      // ── Phase 2: separation force (prevents collisions) ──────────────────────
      const COMFORT = 1.9;   // comfort zone = 1.9× combined radii
      const FORCE_K = 1.4;   // push strength per frame
      const DAMP    = 0.78;  // velocity decay (< 1 prevents runaway)
      const MAX_REP = 55;    // max pixel displacement
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
        .sort((a, b) => a.ny - b.ny);

      // Update HTML avatar overlay positions directly (no React re-render)
      all.forEach(({ n, nx, ny, nr, ghost }) => {
        const el = avatarElemRefs.current.get(n.id);
        if (!el) return;
        if (ghost || n.deceased) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
          el.style.transform = `translate(${nx - 36}px, ${ny - 36}px) scale(${nr / 36})`;
        }
      });

      all.forEach(({ n, nx, ny, depth, nr, hov, sel, ghost }) => {
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
          // ── Cold silver — clearly different, still visible
          const sil = "175,200,225";
          const dA = dAlpha * .72;
          ctx.save(); ctx.globalAlpha = dA * .55;
          drawGlow(ctx, nx, ny, nr * 4, sil, .35); ctx.restore();
          ctx.save(); ctx.globalAlpha = dA * .55;
          drawSpikes(ctx, nx, ny, nr * 3.5, sil, .60); ctx.restore();
          ctx.save(); ctx.globalAlpha = dA;
          drawGlow(ctx, nx, ny, nr * .9, sil, .50);
          ctx.fillStyle = "rgba(175,200,230,0.52)";
          ctx.beginPath(); ctx.arc(nx, ny, nr*.42, 0, Math.PI*2); ctx.fill();
          // Memorial cross
          ctx.strokeStyle = "rgba(200,220,245,0.68)"; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(nx, ny - nr*.32); ctx.lineTo(nx, ny + nr*.32);
          ctx.moveTo(nx - nr*.20, ny - nr*.08); ctx.lineTo(nx + nr*.20, ny - nr*.08);
          ctx.stroke(); ctx.restore();
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
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .72 : .28);
          drawGlow(ctx, nx, ny, nr * 5.5, rgb, .40); ctx.restore();

          // Orb glow rings (artifact style — smooth radial bloom instead of spikes)
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .95 : .60);
          drawGlow(ctx, nx, ny, nr * 3.8, rgb, .52 + (hov || sel ? .25 : 0)); ctx.restore();
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .82 : .40);
          drawGlow(ctx, nx, ny, nr * 2.0, rgb, .78); ctx.restore();

          // Pulse ring
          if (sel) {
            const pf = (Math.sin(t * .10) + 1) / 2;
            ctx.save(); ctx.globalAlpha = .55 + pf * .28;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.arc(nx, ny, nr + 8 + pf * 5, 0, Math.PI*2); ctx.stroke();
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
          ctx.save(); ctx.globalAlpha = dAlpha * (hov||sel ? 1 : .82);
          ctx.strokeStyle = joined ? (hov||sel ? "#ffe97a" : GOLD) : "rgba(200,180,255,0.75)";
          ctx.lineWidth = hov||sel ? 2.5 : 1.6;
          ctx.shadowColor = joined ? (hov||sel ? '#ffe97a' : '#D4AF37') : 'rgba(185,158,235,0.7)';
          ctx.shadowBlur = hov||sel ? 16 : 8;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();

          // Name — hierarchy: selected always, orbit 1 always, rest only on hover
          const showLabel = sel || hov || n.orbit === 1;
          if (showLabel) {
            ctx.save(); ctx.globalAlpha = dAlpha * (sel||hov ? 1 : 0.68);
            const lbl2 = sel||hov ? n.name : n.firstName;
            ctx.font = `${sel||hov ? 700 : 500} ${sel||hov ? 14 : 12}px -apple-system,sans-serif`;
            const lw2 = Math.min(ctx.measureText(lbl2).width + 14, 150);
            ctx.fillStyle = "rgba(3,2,8,0.88)";
            ctx.beginPath(); ctx.roundRect(nx - lw2/2, ny + nr + 5, lw2, 19, 5); ctx.fill();
            ctx.fillStyle = sel||hov
              ? "rgba(255,255,255,0.97)"
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

      // ── Comet notifications ────────────────────────────────────────────────
      _cometTimer++
      if (_cometTimer > 340 && _comets.length < 2) {
        _cometTimer = 0
        _comets.push({
          x: -80, y: h * (0.18 + Math.random() * 0.38),
          sp: 3.2 + Math.random() * 2,
          msg: COMET_MSGS[_cometIdx++ % COMET_MSGS.length],
          life: 0, ml: 270,
        })
      }
      for (let ci = _comets.length - 1; ci >= 0; ci--) {
        const c = _comets[ci]
        c.x += c.sp; c.life++
        if (c.life > c.ml || c.x > w + 80) { _comets.splice(ci, 1); continue }
        const fade = c.life < 22 ? c.life / 22 : c.life > c.ml - 32 ? (c.ml - c.life) / 32 : 1
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
  const getNodeAt = useCallback((mx: number, my: number): OrbitNode | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const w = c.offsetWidth, h = c.offsetHeight;
    const cx = w / 2, cy = h / 2;
    const t = tRef.current;
    return nodesRef.current.find(n => {
      const { nx, ny } = nodePos(n, cx, cy, w, t);
      return Math.hypot(mx - nx, my - ny) < scaledNR(n.orbit, depthOf(n.angle)) + 18;
    }) ?? null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit  = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      // Unfreeze previous selection + its connections
      const prevFrozen = frozenIdsRef.current;
      nodesRef.current.forEach(n => {
        if (prevFrozen.has(n.id) || n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      // Compute new frozen set: selected node + all directly connected members
      const newFrozen = new Set<string>([hit.id]);
      memberLinksRef.current.forEach(lk => {
        if (lk.fromMemberId === hit.id) newFrozen.add(lk.toMemberId);
        if (lk.toMemberId   === hit.id) newFrozen.add(lk.fromMemberId);
      });
      nodesRef.current.forEach(n => { if (newFrozen.has(n.id)) n.speed = 0; });
      frozenIdsRef.current = newFrozen;
      selectedRef.current  = hit.id;
      setSelectedNode({ ...hit, speed: 0 });
    } else {
      // Tap on empty space — unfreeze everything
      nodesRef.current.forEach(n => {
        if (frozenIdsRef.current.has(n.id) || n.id === selectedRef.current)
          n.speed = n.baseSpeed;
      });
      frozenIdsRef.current = new Set();
      selectedRef.current  = null;
      setSelectedNode(null);
    }
  }, [getNodeAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

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
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      <style>{`
        @keyframes gov-up {
          from { opacity:0; transform:translateX(-50%) translateY(18px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0);    }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{ width:"100%", height:"100%", display:"block", touchAction:"none", cursor:"pointer" }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => { mouseRef.current = { x:-9999, y:-9999 }; }}
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

      {/* ── Member panel ── */}
      {selectedNode && (
        <div style={{
          position:"absolute", bottom:84, left:"50%",
          transform:"translateX(-50%)",
          width:"min(304px, calc(100vw - 32px))",
          background:"rgba(5,2,12,0.97)",
          backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
          border:"0.5px solid rgba(212,175,55,0.30)",
          borderTop:"1px solid rgba(212,175,55,0.55)",
          borderRadius:22, padding:"16px 18px",
          boxShadow:"0 24px 64px rgba(0,0,0,0.95)",
          animation:"gov-up 0.20s cubic-bezier(.22,.8,.36,1)",
          zIndex:30,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{
              width:48, height:48, borderRadius:"50%", flexShrink:0, overflow:"hidden",
              border:`1.5px solid rgba(212,175,55,${selectedNode.joined ? "0.55" : "0.22"})`,
              background: selectedNode.deceased ? "rgba(150,180,210,0.10)" : "rgba(212,175,55,0.08)",
            }}>
              {selectedNode.avatarUrl
                ? <img src={selectedNode.avatarUrl} alt={selectedNode.firstName}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <div style={{
                    width:"100%", height:"100%", display:"flex",
                    alignItems:"center", justifyContent:"center",
                    fontSize:18, fontWeight:700,
                    color: selectedNode.deceased ? "rgba(180,200,225,0.70)"
                         : selectedNode.joined ? GOLD : "rgba(184,160,216,0.85)",
                  }}>
                    {selectedNode.deceased ? "✝" : selectedNode.firstName[0]?.toUpperCase()}
                  </div>
              }
            </div>

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontSize:15, fontWeight:700,
                color: selectedNode.deceased ? "rgba(180,200,225,0.85)" : "#fff",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                fontStyle: selectedNode.deceased ? "italic" : "normal",
              }}>
                {selectedNode.name}
              </div>
              <div style={{ marginTop:2 }}>
                <div style={{
                  fontSize:12, fontWeight:600,
                  color: selectedNode.deceased ? "rgba(180,200,225,0.65)"
                       : selectedNode.joined ? "rgba(245,220,100,0.80)" : "rgba(200,180,255,0.75)",
                }}>
                  {(RELATION_LABELS as Record<string, string>)[selectedNode.relationType] ?? selectedNode.relationType}
                  {selectedNode.deceased ? " · En memoria" : ""}
                  {selectedNode.joined && !selectedNode.deceased ? " · Conectado" : ""}
                </div>
                <div style={{
                  fontSize:8, letterSpacing:"0.10em", textTransform:"uppercase", marginTop:2,
                  color: selectedNode.deceased ? "rgba(150,180,210,0.38)" : "rgba(212,175,55,0.35)",
                }}>
                  {["Órbita directa","Órbita extendida","Órbita afinidad"][selectedNode.orbit-1]}
                </div>
              </div>
            </div>

            <button onClick={close} style={{
              background:"none", border:"none", cursor:"pointer",
              color:"rgba(255,255,255,0.22)", fontSize:22, lineHeight:1, padding:0, flexShrink:0,
            }}>×</button>
          </div>


          {/* Expandir / Contraer — primary action */}
          <button onClick={() => {
            const isExp = expandedId === selectedNode.id;
            setExpandedId(isExp ? null : selectedNode.id);
          }} style={{
            width:"100%", padding:"14px 0", borderRadius:14, cursor:"pointer",
            fontSize:15, fontWeight:700, marginBottom:8,
            background: expandedId === selectedNode.id
              ? "rgba(212,175,55,0.22)" : "rgba(212,175,55,0.10)",
            border:"1px solid rgba(212,175,55,0.50)", color:GOLD,
          }}>
            {expandedId === selectedNode.id ? "✦ Contraer familia" : "✦ Expandir familia"}
          </button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { onEditMember(selectedNode.id); close(); }} style={{
              flex:1, padding:"12px 0", borderRadius:13, cursor:"pointer",
              fontSize:13, fontWeight:600, background:"rgba(255,255,255,0.05)",
              border:"0.5px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.80)",
            }}>
              Editar
            </button>
            {!selectedNode.joined && (
              <button onClick={() => { onInviteMember(selectedNode.id); close(); }} style={{
                flex:1, padding:"12px 0", borderRadius:13, cursor:"pointer",
                fontSize:13, fontWeight:700, background:"#c9a820",
                borderTop:"1.5px solid #f5e060", borderBottom:"2.5px solid #6a5600",
                border:"none", color:"#030208",
              }}>
                Invitar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Avatar HTML overlay (positioned above canvas, below panels) ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {overlayNodes.filter(n => !n.deceased).map(n => (
          <div
            key={n.id}
            ref={el => { avatarElemRefs.current.set(n.id, el); }}
            style={{
              position: 'absolute', top: 0, left: 0,
              transformOrigin: '36px 36px',
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
    </div>
  );
}
