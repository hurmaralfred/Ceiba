"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, FamilyMember } from "@/lib/types";
import { RELATION_LABELS } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";

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
const BASE_ORBIT_FRACS = [0.195, 0.345, 0.475] as const;
const BASE_SPEEDS      = [0.0085, 0.0058, 0.0032] as const;
// Direction is now per-node (from hash), not per-orbit
const BASE_NR          = [36, 28, 22] as const;
const DEPTH_SCALE      = 0.80;

function baseOrbitR(orbit: 1 | 2 | 3, w: number) { return BASE_ORBIT_FRACS[orbit-1] * w; }
function baseNodeR(orbit: 1 | 2 | 3) { return BASE_NR[orbit-1]; }
function depthOf(angle: number) { return (Math.sin(angle) + 1) / 2; }
function scaledNR(orbit: 1 | 2 | 3, depth: number) {
  return baseNodeR(orbit) * (1 - DEPTH_SCALE / 2 + depth * DEPTH_SCALE);
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
  const selectedRef = useRef<string | null>(null);

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

      // ── Orbit guide rings (faint, dashed ellipses per orbit level)
      ([1, 2, 3] as const).forEach(orbit => {
        const r = baseOrbitR(orbit, w);
        const al = [.10, .06, .04][orbit-1];
        ctx.save();
        ctx.strokeStyle = `rgba(212,175,55,${al})`;
        ctx.lineWidth = .6; ctx.setLineDash([2, 12]);
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * TILT, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(212,175,55,${al * 1.4})`;
        ctx.font = "6px -apple-system,sans-serif"; ctx.textAlign = "center";
        ctx.fillText(["DIRECTA","EXTENDIDA","AFINIDAD"][orbit-1], cx, cy - r * TILT - 7);
        ctx.restore();
      });

      // ── Phase 1: compute base positions & advance angles ─────────────────────
      const activeSet = activeSetRef.current;
      const raw = nodesRef.current.map(n => {
        const { nx: nxPre, ny: nyPre } = nodePos(n, cx, cy, w, t - 1);
        const depth = depthOf(n.angle);
        const ghost = activeSet.size > 0 && !activeSet.has(n.id);
        const nr    = scaledNR(n.orbit, depth) * (ghost ? 0.40 : 1);
        const hov = !ghost && Math.hypot(
          mouseRef.current.x - (nxPre + n.repX),
          mouseRef.current.y - (nyPre + n.repY),
        ) < nr + 22;
        const sel = selectedRef.current === n.id;
        const eff = sel ? 0 : hov ? n.baseSpeed * 0.04 : n.speed;
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
            // Paused (selected) nodes act as obstacles but don't move
            if (!a.sel) { a.n.repX += fx; a.n.repY += fy; }
            if (!b.sel) { b.n.repX -= fx; b.n.repY -= fy; }
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
          const rgb = joined ? "245,220,100" : "185,158,235";

          // Outer nebula halo
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .72 : .28);
          drawGlow(ctx, nx, ny, nr * 5.5, rgb, .40); ctx.restore();

          // Diffraction spikes
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .98 : .78);
          drawSpikes(ctx, nx, ny, spikeLen, rgb, hov || sel ? .95 : .80); ctx.restore();

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

          // Core (photo or bright star)
          ctx.save(); ctx.globalAlpha = dAlpha;
          ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.clip();
          ctx.fillStyle = "rgba(8,5,18,0.95)"; ctx.fillRect(nx-nr, ny-nr, nr*2, nr*2);
          if (img) {
            drawImgCover(ctx, img, nx, ny, nr);
          } else {
            drawGlow(ctx, nx, ny, nr * .95, rgb, .92);
            ctx.fillStyle = "rgba(255,255,255,0.96)";
            ctx.beginPath(); ctx.arc(nx, ny, nr*.36, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#030208";
            ctx.font = `bold ${Math.max(7, Math.round(nr*.55))}px -apple-system,sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
          }
          ctx.restore();
          // 3D sphere highlight
          ctx.save(); ctx.globalAlpha = dAlpha;
          drawSphere(ctx, nx, ny, nr, 1);
          ctx.restore();

          // Photo ring
          if (img) {
            ctx.save(); ctx.globalAlpha = dAlpha * (hov||sel ? 1 : .85);
            ctx.strokeStyle = joined ? (hov||sel ? "#ffe97a" : GOLD) : "rgba(200,180,255,0.75)";
            ctx.lineWidth = hov||sel ? 2.5 : 1.8;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
          }

          // Name pill — solid, always readable
          ctx.save(); ctx.globalAlpha = dAlpha * (hov||sel ? 1 : .90);
          const lbl2 = hov||sel ? n.name : n.firstName;
          ctx.font = `${hov||sel ? 700 : 600} ${hov||sel ? 14 : 13}px -apple-system,sans-serif`;
          const lw2 = Math.min(ctx.measureText(lbl2).width + 16, 150);
          ctx.fillStyle = "rgba(3,2,8,0.92)";
          ctx.beginPath(); ctx.roundRect(nx - lw2/2, ny + nr + 5, lw2, 20, 6); ctx.fill();
          ctx.fillStyle = hov||sel
            ? "rgba(255,255,255,0.97)"
            : (joined ? "rgba(245,220,100,0.95)" : "rgba(210,190,255,0.92)");
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(lbl2, nx, ny + nr + 15); ctx.restore();
        }
      });

      // ── Nucleus (user — dominant center star)
      const NR = 38; // nucleus radius — big and clear
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

      // Outer pulse halo
      ctx.save(); ctx.globalAlpha = .12 + pulse * .12;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, NR + 14 + pulse * 8, 0, Math.PI*2); ctx.stroke(); ctx.restore();

      // Large glow + spikes
      ctx.save(); drawGlow(ctx, cx, cy, NR * 3.5, "212,175,55", .35 + pulse * .15); ctx.restore();
      ctx.save(); drawSpikes(ctx, cx, cy, NR * 2.8 + pulse * 10, "248,230,140", .95); ctx.restore();
      ctx.save(); drawGlow(ctx, cx, cy, NR * 1.2, "255,242,160", .75); ctx.restore();

      // Photo circle
      const profileImg = profile.avatar_url ? loadImg(profile.avatar_url) : null;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, NR, 0, Math.PI*2); ctx.clip();
      ctx.fillStyle = "rgba(28,16,4,0.98)"; ctx.fillRect(cx-NR, cy-NR, NR*2, NR*2);
      if (profileImg) {
        drawImgCover(ctx, profileImg, cx, cy, NR);
      } else {
        ctx.fillStyle = BG;
        ctx.font = `bold ${Math.round(NR * .55)}px -apple-system,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(profile.first_name[0]?.toUpperCase() || "?", cx, cy);
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
      nodesRef.current.forEach(n => {
        if (n.id === hit.id)                   n.speed = 0;
        else if (n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      selectedRef.current = hit.id;
      setSelectedNode({ ...hit, speed: 0 });
    } else {
      nodesRef.current.forEach(n => {
        if (n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      selectedRef.current = null;
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
    nodesRef.current.forEach(n => {
      if (n.id === selectedRef.current) n.speed = n.baseSpeed;
    });
    selectedRef.current = null;
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

      {/* ── Add member ── */}
      <button onClick={onAddMember} aria-label="Agregar familiar" style={{
        position:"absolute", bottom:24, right:20,
        width:48, height:48, borderRadius:"50%", background:"#c9a820",
        borderTop:"2px solid #f5e060", borderLeft:"1.5px solid rgba(255,240,100,0.4)",
        borderBottom:"4px solid #6a5600", borderRight:"1.5px solid rgba(0,0,0,0.4)",
        boxShadow:"0 6px 0 #4a3c00, 0 10px 22px rgba(0,0,0,0.75)",
        color:"#030208", fontSize:26, fontWeight:800,
        cursor:"pointer", display:"flex", alignItems:"center",
        justifyContent:"center", zIndex:20, lineHeight:1,
      }}>
        +
      </button>
    </div>
  );
}
