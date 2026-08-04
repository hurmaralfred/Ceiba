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
const GOLD    = "#d4af37";
const BG      = "#030208";
const TILT    = 0.70;
const SPEEDS  = [0.009, 0.006, 0.003] as const;
const SIGNS   = [1, -1, 1] as const;
// Base radii as fraction of canvas width, per orbit
const ORBIT_FRACS = [0.195, 0.345, 0.475] as const;
// Base node radius per orbit (before depth scaling)
const BASE_NR = [15, 12, 9] as const;
// Depth scale: front nodes are 75% larger than back nodes
const DEPTH_SCALE = 0.75;

function orbitR(orbit: 1 | 2 | 3, w: number) { return ORBIT_FRACS[orbit - 1] * w; }
function baseNR(orbit: 1 | 2 | 3) { return BASE_NR[orbit - 1]; }
// depth ∈ [0, 1]: 0 = back (top of ellipse), 1 = front (bottom)
function depthOf(angle: number) { return (Math.sin(angle) + 1) / 2; }
function scaledNR(orbit: 1 | 2 | 3, depth: number) {
  return baseNR(orbit) * (1 - DEPTH_SCALE / 2 + depth * DEPTH_SCALE);
}

// ── Image cache ───────────────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | null>();
function loadImg(url: string): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!;
  imgCache.set(url, null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload  = () => imgCache.set(url, img);
  img.onerror = () => imgCache.set(url, null);
  img.src = url;
  return null;
}

// ── Star drawing helpers ──────────────────────────────────────────────────────

/**
 * Draw telescope-style diffraction spikes (4 bidirectional rays).
 * Primary pair: 0° / 90° (longer, brighter)
 * Secondary pair: 45° / 135° (shorter, dimmer)
 */
function drawSpikes(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  len: number,
  rgbStr: string,   // e.g. "245,220,120"
  alpha: number,    // 0-1
) {
  const pairs = [
    { ang: 0,              lenMult: 1.0, aMult: 1.0, lw: 1.0 },
    { ang: Math.PI / 2,    lenMult: 1.0, aMult: 1.0, lw: 1.0 },
    { ang: Math.PI / 4,    lenMult: 0.6, aMult: 0.55, lw: 0.6 },
    { ang: Math.PI * 3 / 4, lenMult: 0.6, aMult: 0.55, lw: 0.6 },
  ];
  pairs.forEach(({ ang, lenMult, aMult, lw }) => {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const slen = len * lenMult;
    const a = alpha * aMult;
    for (const dir of [-1, 1]) {
      const ex = x + cos * slen * dir;
      const ey = y + sin * slen * dir;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0,    `rgba(${rgbStr},${(a * 0.95).toFixed(2)})`);
      g.addColorStop(0.25, `rgba(${rgbStr},${(a * 0.50).toFixed(2)})`);
      g.addColorStop(0.6,  `rgba(${rgbStr},${(a * 0.15).toFixed(2)})`);
      g.addColorStop(1,    `rgba(${rgbStr},0)`);
      ctx.save();
      ctx.strokeStyle = g;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  rgbStr: string,
  alpha: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgbStr},${alpha.toFixed(2)})`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GalaxyOrbitView({
  profile, members, extendedMembers,
  onViewMember, onInviteMember, onAddMember,
}: GalaxyOrbitViewProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const nodesRef    = useRef<OrbitNode[]>([]);
  const tRef        = useRef(0);
  const mouseRef    = useRef({ x: -9999, y: -9999 });
  const selectedRef = useRef<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<OrbitNode | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 1 | 2 | 3>>({});

  useEffect(() => {
    if (profile.avatar_url) loadImg(profile.avatar_url);
  }, [profile.avatar_url]);

  // ── Build nodes ──────────────────────────────────────────────────────────
  useEffect(() => {
    const seen = new Set<string>();
    const raw: OrbitNode[] = [];

    members.forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const orbit: 1 | 2 | 3 = overrides[m.id] ?? seedOrbit(m.relation_type, m.relation_kind);
      const spd = SPEEDS[orbit - 1] * SIGNS[orbit - 1];
      const avatarUrl = m.profile?.avatar_url ?? null;
      if (avatarUrl) loadImg(avatarUrl);
      raw.push({ id: m.id, name: `${m.first_name}${m.last_name ? " " + m.last_name : ""}`,
        firstName: m.first_name, orbit, angle: 0, baseSpeed: spd, speed: spd,
        deceased: !!m.is_deceased, joined: !!m.profile_id,
        relationType: m.relation_type, avatarUrl });
    });

    extendedMembers.forEach(e => {
      if (seen.has(e.member.id)) return;
      seen.add(e.member.id);
      const orbit: 1 | 2 | 3 = overrides[e.member.id] ??
        seedOrbit(e.inferredRelation || "other", e.member.relation_kind);
      const spd = SPEEDS[orbit - 1] * SIGNS[orbit - 1];
      const avatarUrl = (e.member as any).profile?.avatar_url ?? null;
      if (avatarUrl) loadImg(avatarUrl);
      raw.push({ id: e.member.id,
        name: `${e.member.first_name}${e.member.last_name ? " " + e.member.last_name : ""}`,
        firstName: e.member.first_name, orbit, angle: 0, baseSpeed: spd, speed: spd,
        deceased: !!(e.member as any).is_deceased, joined: !!e.member.profile_id,
        relationType: e.inferredRelation || "other", avatarUrl });
    });

    const groups: Record<number, OrbitNode[]> = { 1: [], 2: [], 3: [] };
    raw.forEach(n => groups[n.orbit].push(n));
    [1, 2, 3].forEach(o => {
      const g = groups[o];
      if (!g.length) return;
      const step = (Math.PI * 2) / g.length;
      g.forEach((n, i) => { n.angle = -Math.PI / 2 + step * i; });
    });

    if (selectedRef.current) {
      const prev = nodesRef.current.find(n => n.id === selectedRef.current);
      if (prev) {
        const next = raw.find(n => n.id === prev.id);
        if (next) { next.speed = 0; next.angle = prev.angle; }
      }
    }
    nodesRef.current = raw;
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
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // ── Nebulae
      const nebulae = [
        { x: .18, y: .26, r: .55, c: "90,12,210", a: .22 },
        { x: .82, y: .72, r: .46, c: "10,52,185", a: .18 },
        { x: .54, y: .44, r: .32, c: "200,100,8", a: .14 },
        { x: .28, y: .78, r: .34, c: "180,10,80",  a: .10 },
        { x: .72, y: .24, r: .28, c: "5,165,120",  a: .09 },
        { x: .50, y: .50, r: .20, c: "120,60,200", a: .07 },
      ] as const;
      nebulae.forEach(n => {
        const g = ctx.createRadialGradient(w*n.x, h*n.y, 0, w*n.x, h*n.y, w*n.r);
        g.addColorStop(0, `rgba(${n.c},${n.a})`);
        g.addColorStop(0.5, `rgba(${n.c},${(n.a * .35).toFixed(2)})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });

      // ── Background stars (tiny, fixed, some twinkle)
      for (let i = 0; i < 160; i++) {
        const sx = ((i * 137.508) % 100) / 100 * w;
        const sy = ((i * 97.318)  % 100) / 100 * h;
        const big = i % 13 === 0;
        const sr = big ? 1.2 : 0.3 + (i % 4) * 0.15;
        const baseA = big ? 0.60 : 0.08 + (i % 9) * 0.05;
        const tw = big ? (Math.sin(t * .025 + i * .7) * .28 + .72) : 1;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(baseA * tw).toFixed(2)})`; ctx.fill();
        // Big stars get a tiny cross
        if (big) {
          ctx.save(); ctx.globalAlpha = baseA * tw * .6;
          ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = .4;
          for (const ang of [0, Math.PI / 2]) {
            const cos = Math.cos(ang), sin = Math.sin(ang);
            ctx.beginPath(); ctx.moveTo(sx - cos*3, sy - sin*3);
            ctx.lineTo(sx + cos*3, sy + sin*3); ctx.stroke();
          }
          ctx.restore();
        }
      }

      // ── Shooting star
      const sPhase = Math.floor(t / 280) % 5;
      const sT = t % 280;
      if (sT < 50) {
        const starts: [number,number][] = [[.15,.08],[.72,.18],[.33,.62],[.88,.38],[.45,.04]];
        const [bx, by] = starts[sPhase];
        const prog = sT / 50;
        const len = 100, ang = Math.PI * .22;
        const ex = bx*w + prog*len*Math.cos(ang), ey = by*h + prog*len*Math.sin(ang);
        const a = Math.sin(prog * Math.PI) * .8;
        const sg = ctx.createLinearGradient(ex - 35, ey - 35, ex, ey);
        sg.addColorStop(0, "rgba(255,255,255,0)");
        sg.addColorStop(0.6, `rgba(255,250,230,${(a*.6).toFixed(2)})`);
        sg.addColorStop(1, `rgba(255,255,255,${a.toFixed(2)})`);
        ctx.save(); ctx.strokeStyle = sg; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ex - len*.5*Math.cos(ang), ey - len*.5*Math.sin(ang));
        ctx.lineTo(ex, ey); ctx.stroke();
        ctx.restore();
      }

      // ── Orbit rings (ellipses)
      ([1, 2, 3] as const).forEach(orbit => {
        const r = orbitR(orbit, w);
        const al = [.18, .11, .07][orbit - 1];
        ctx.save();
        ctx.strokeStyle = `rgba(212,175,55,${al})`;
        ctx.lineWidth = .8; ctx.setLineDash([2, 9]);
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * TILT, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(212,175,55,${al * 1.3})`;
        ctx.font = "6.5px -apple-system,sans-serif"; ctx.textAlign = "center";
        ctx.fillText(["DIRECTA","EXTENDIDA","AFINIDAD"][orbit - 1], cx, cy - r * TILT - 6);
        ctx.restore();
      });

      // ── Collect all nodes, sort by Y (depth) back-to-front
      const all = nodesRef.current.map(n => {
        // Compute hover BEFORE advancing angle (uses last frame's position)
        const rPre = orbitR(n.orbit, w);
        const nxPre = cx + rPre * Math.cos(n.angle);
        const nyPre = cy + rPre * TILT * Math.sin(n.angle);
        const hov = Math.hypot(mouseRef.current.x - nxPre, mouseRef.current.y - nyPre) <
          scaledNR(n.orbit, depthOf(n.angle)) + 18;
        const sel = selectedRef.current === n.id;
        // Hover slows to 5% of base speed; selected stops completely
        const effectiveSpeed = sel ? 0 : hov ? n.baseSpeed * 0.05 : n.speed;
        n.angle += effectiveSpeed;
        const r  = orbitR(n.orbit, w);
        const nx = cx + r * Math.cos(n.angle);
        const ny = cy + r * TILT * Math.sin(n.angle);
        const depth = depthOf(n.angle);
        const nr = scaledNR(n.orbit, depth);
        return { n, nx, ny, depth, nr, hov, sel };
      });
      // Paint back-to-front (lower Y = further back in perspective)
      all.sort((a, b) => a.ny - b.ny);

      all.forEach(({ n, nx, ny, depth, nr, hov, sel }) => {
        // Global depth alpha: back nodes are significantly dimmer
        const dAlpha = 0.28 + depth * 0.72;
        const img = n.avatarUrl ? loadImg(n.avatarUrl) : null;

        if (n.deceased) {
          // ── Deceased: cold silver/blue, clearly visible but different
          const silver = "180,200,220";
          const dA = dAlpha * 0.75; // slightly dimmer but still visible

          // Soft glow
          ctx.save(); ctx.globalAlpha = dA * .6;
          drawGlow(ctx, nx, ny, nr * 3.5, silver, .35);
          ctx.restore();

          // Ethereal spikes (cross only, cold color)
          ctx.save(); ctx.globalAlpha = dA * .5;
          drawSpikes(ctx, nx, ny, nr * (hov ? 4.5 : 3.5), silver, .65);
          ctx.restore();

          // Soft core
          ctx.save(); ctx.globalAlpha = dA;
          drawGlow(ctx, nx, ny, nr * .9, silver, .55);
          // Center — dim white circle
          ctx.fillStyle = `rgba(180,200,225,0.55)`;
          ctx.beginPath(); ctx.arc(nx, ny, nr * .45, 0, Math.PI * 2); ctx.fill();
          // Memorial cross
          ctx.strokeStyle = "rgba(200,220,240,0.70)"; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nx, ny - nr * .3); ctx.lineTo(nx, ny + nr * .3);
          ctx.moveTo(nx - nr * .2, ny - nr * .08); ctx.lineTo(nx + nr * .2, ny - nr * .08);
          ctx.stroke();
          ctx.restore();

          // Name label (always, italic, silver)
          ctx.save(); ctx.globalAlpha = dA * .85;
          const label = n.firstName;
          const lw = ctx.measureText(label).width + 10;
          const lh = 16;
          ctx.fillStyle = "rgba(3,2,8,0.82)";
          ctx.beginPath();
          ctx.roundRect(nx - lw / 2, ny + nr + 5, lw, lh, 4);
          ctx.fill();
          ctx.fillStyle = "rgba(180,200,225,0.85)";
          ctx.font = `italic 11px -apple-system,sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, nx, ny + nr + 13);
          ctx.restore();

        } else {
          // ── Living: warm gold (joined) or lavender (pending)
          const joined = n.joined;
          const rgb = joined ? "245,220,100" : "180,155,230";
          const spikeLen = nr * (sel ? 6 : hov ? 5.2 : 3.8);

          // Outer nebula glow (large, soft)
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .7 : .28);
          drawGlow(ctx, nx, ny, nr * 5, rgb, .45);
          ctx.restore();

          // Diffraction spikes
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? .95 : .75);
          drawSpikes(ctx, nx, ny, spikeLen, rgb, hov || sel ? .95 : .80);
          ctx.restore();

          // Pulse ring when selected
          if (sel) {
            const pf = (Math.sin(t * .10) + 1) / 2;
            ctx.save(); ctx.globalAlpha = .55 + pf * .25;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(nx, ny, nr + 8 + pf * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }

          // Inner glow (tight)
          ctx.save(); ctx.globalAlpha = dAlpha;
          drawGlow(ctx, nx, ny, nr * 1.8, rgb, .70);
          ctx.restore();

          // ── Core: photo or bright star center
          ctx.save(); ctx.globalAlpha = dAlpha;
          if (img) {
            // Circular photo clip
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = "rgba(8,5,18,0.95)"; ctx.fillRect(nx-nr, ny-nr, nr*2, nr*2);
            ctx.drawImage(img, nx - nr, ny - nr, nr * 2, nr * 2);
          } else {
            // Bright glowing core
            drawGlow(ctx, nx, ny, nr * .9, rgb, .90);
            // White center dot
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.beginPath(); ctx.arc(nx, ny, nr * .38, 0, Math.PI * 2); ctx.fill();
            // Initial
            ctx.fillStyle = "#030208";
            ctx.font = `bold ${Math.max(8, Math.round(nr * .55))}px -apple-system,sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
          }
          ctx.restore();

          // Photo ring
          if (img) {
            ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? 1 : .85);
            ctx.strokeStyle = joined ? (hov || sel ? "#ffe97a" : GOLD) : "rgba(200,180,255,0.75)";
            ctx.lineWidth = hov || sel ? 2.5 : 1.8;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }

          // ── Name label — solid pill, always visible
          ctx.save(); ctx.globalAlpha = dAlpha * (hov || sel ? 1 : .78);
          const label2 = hov || sel ? n.name : n.firstName;
          const fs = hov || sel ? 12 : 11;
          ctx.font = `${hov || sel ? 700 : 500} ${fs}px -apple-system,sans-serif`;
          const lw2 = Math.min(ctx.measureText(label2).width + 14, 120);
          const lh2 = fs + 7;
          ctx.fillStyle = "rgba(3,2,8,0.88)";
          ctx.beginPath();
          ctx.roundRect(nx - lw2 / 2, ny + nr + 5, lw2, lh2, 5);
          ctx.fill();
          ctx.fillStyle = hov || sel
            ? "rgba(255,255,255,0.97)"
            : (joined ? "rgba(245,220,100,0.90)" : "rgba(200,180,255,0.88)");
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label2, nx, ny + nr + 5 + lh2 / 2);
          ctx.restore();
        }
      });

      // ── Nucleus (profile user) — brightest star at center
      const pulse = (Math.sin(t * .040) + 1) / 2;
      // Outer pulse ring
      ctx.save(); ctx.globalAlpha = .12 + pulse * .12;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 40 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // Large glow
      ctx.save();
      drawGlow(ctx, cx, cy, 60, "212,175,55", .30 + pulse * .12);
      ctx.restore();
      // Spikes for the user nucleus
      ctx.save();
      drawSpikes(ctx, cx, cy, 55 + pulse * 6, "245,228,140", .90);
      ctx.restore();
      // Tight inner glow
      ctx.save(); drawGlow(ctx, cx, cy, 28, "255,240,160", .70); ctx.restore();
      // Photo or initial
      const profileImg = profile.avatar_url ? loadImg(profile.avatar_url) : null;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "rgba(28,16,4,0.98)"; ctx.fillRect(cx-22, cy-22, 44, 44);
      if (profileImg) {
        ctx.drawImage(profileImg, cx-22, cy-22, 44, 44);
      } else {
        ctx.fillStyle = BG;
        ctx.font = "bold 12px -apple-system,sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(profile.first_name[0]?.toUpperCase() || "?", cx, cy);
      }
      ctx.restore();
      // Gold ring around nucleus
      ctx.save(); ctx.strokeStyle = "#ffe060"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      // Name pill
      ctx.save();
      const profileLabel = profile.first_name;
      ctx.font = "600 11px -apple-system,sans-serif";
      const plw = ctx.measureText(profileLabel).width + 14;
      ctx.fillStyle = "rgba(3,2,8,0.88)";
      ctx.beginPath(); ctx.roundRect(cx - plw/2, cy + 27, plw, 18, 5); ctx.fill();
      ctx.fillStyle = "rgba(245,220,100,0.90)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(profileLabel, cx, cy + 36);
      ctx.restore();

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
    return nodesRef.current.find(n => {
      const r  = orbitR(n.orbit, w);
      const nx = cx + r * Math.cos(n.angle);
      const ny = cy + r * TILT * Math.sin(n.angle);
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
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
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
        onPointerLeave={() => { mouseRef.current = { x: -9999, y: -9999 }; }}
      />

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
          {/* Header */}
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
                         : selectedNode.joined   ? GOLD
                         : "rgba(184,160,216,0.85)",
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
                  color: selectedNode.deceased
                    ? "rgba(180,200,225,0.65)"
                    : selectedNode.joined ? "rgba(245,220,100,0.80)" : "rgba(200,180,255,0.75)",
                }}>
                  {(RELATION_LABELS as Record<string, string>)[selectedNode.relationType] ?? selectedNode.relationType}
                  {selectedNode.deceased ? " · En memoria" : ""}
                  {selectedNode.joined && !selectedNode.deceased ? " · Conectado" : ""}
                </div>
                <div style={{
                  fontSize:8, letterSpacing:"0.10em", textTransform:"uppercase", marginTop:2,
                  color: selectedNode.deceased
                    ? "rgba(150,180,210,0.38)"
                    : "rgba(212,175,55,0.35)",
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

          {/* Acercar / alejar */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, justifyContent:"center" }}>
            {(["in","out"] as const).map(dir => {
              const disabled = dir === "in" ? selectedNode.orbit === 1 : selectedNode.orbit === 3;
              return (
                <button key={dir} onClick={() => !disabled && shift(selectedNode.id, dir)}
                  style={{
                    padding:"4px 12px", fontSize:10, fontWeight:600, letterSpacing:"0.06em",
                    cursor: disabled ? "default" : "pointer",
                    color: `rgba(212,175,55,${disabled ? .18 : .75})`,
                    background:"transparent",
                    border:`0.5px solid rgba(212,175,55,${disabled ? .08 : .22})`,
                    borderRadius:8,
                  }}>
                  {dir === "in" ? "← acercar" : "alejar →"}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:5, justifyContent:"center", marginBottom:12 }}>
            {([1,2,3] as const).map(o => (
              <div key={o} style={{
                width: o===selectedNode.orbit ? 8 : 5,
                height: o===selectedNode.orbit ? 8 : 5,
                borderRadius:"50%",
                background: o===selectedNode.orbit ? GOLD : "rgba(212,175,55,0.18)",
                transition:"all 0.2s ease",
              }} />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { onViewMember(selectedNode.id); close(); }} style={{
              flex:1, padding:"11px 0", borderRadius:13, cursor:"pointer",
              fontSize:13, fontWeight:600, letterSpacing:"0.03em",
              background:"rgba(212,175,55,0.08)",
              border:"0.5px solid rgba(212,175,55,0.28)",
              color: GOLD,
            }}>
              Ver perfil
            </button>
            {!selectedNode.joined && (
              <button onClick={() => { onInviteMember(selectedNode.id); close(); }} style={{
                flex:1, padding:"11px 0", borderRadius:13, cursor:"pointer",
                fontSize:13, fontWeight:700,
                background:"#c9a820",
                borderTop:"1.5px solid #f5e060",
                borderBottom:"2.5px solid #6a5600",
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
        width:48, height:48, borderRadius:"50%",
        background:"#c9a820",
        borderTop:"2px solid #f5e060",
        borderLeft:"1.5px solid rgba(255,240,100,0.4)",
        borderBottom:"4px solid #6a5600",
        borderRight:"1.5px solid rgba(0,0,0,0.4)",
        boxShadow:"0 6px 0 #4a3c00, 0 10px 22px rgba(0,0,0,0.75)",
        color:"#030208", fontSize:26, fontWeight:800,
        cursor:"pointer", display:"flex",
        alignItems:"center", justifyContent:"center",
        zIndex:20, lineHeight:1,
      }}>
        +
      </button>
    </div>
  );
}
