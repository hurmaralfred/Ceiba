"use client";

import { useEffect, useState } from "react";

const ROOT_R  = 34;
const DSCALE  = 2; // canvas resolution multiplier (2× for retina)

interface Props {
  cx: number;
  rootY: number;
  ancY: number;
  ancHalf: number;
  ancToRoot: number;
  hasAnc: boolean;
  svgWidth: number;
  totalHeight: number;
}

// ── Deterministic Park-Miller LCG ─────────────────────────────────────────
function mkRand(seed: number) {
  let s = (Math.abs(Math.round(seed)) % 2147483646) + 1;
  return (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Core renderer ─────────────────────────────────────────────────────────
function renderTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  rootY: number,
  ancY: number,
  ancHalf: number,
  ancToRoot: number,
  hasAnc: boolean,
  W: number,
  H: number,
) {
  const rng = mkRand(Math.round(cx) * 7 + Math.round(rootY) * 13);

  const tTopY    = hasAnc ? ancY + 8 : rootY - ROOT_R * 2.4;
  const trunkBot = rootY + ROOT_R + 6;
  const span     = rootY - tTopY;

  const hwTop  = Math.max(7,  Math.min(12,  span * 0.038));
  const hwRoot = Math.max(24, Math.min(42,  ROOT_R + 4));
  const hwBot  = Math.max(18, Math.min(32,  ROOT_R * 0.85));

  // ── 0. Ambient glows (transparent canvas — composites over SVG bg) ────
  // Gold halo from root node upward
  {
    const g = ctx.createRadialGradient(cx, rootY, 0, cx, rootY, ancHalf * 1.4);
    g.addColorStop(0,    "rgba(220,155,35,0.22)");
    g.addColorStop(0.30, "rgba(175,115,20,0.12)");
    g.addColorStop(0.65, "rgba(100,70,10,0.04)");
    g.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Green canopy ambient
  if (hasAnc) {
    const g = ctx.createRadialGradient(cx, ancY - ancToRoot * 0.15, 0, cx, ancY - ancToRoot * 0.15, ancHalf * 1.5);
    g.addColorStop(0,    "rgba(22,80,38,0.18)");
    g.addColorStop(0.45, "rgba(14,55,25,0.08)");
    g.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. Canopy leaf mass ───────────────────────────────────────────────
  if (hasAnc) {
    // Large diffuse blobs (background depth)
    for (let i = 0; i < 60; i++) {
      const t = rng();
      const w = ancHalf * (0.55 + 0.50 * Math.sin(t * Math.PI));
      const x = cx + (rng() * 2 - 1) * w;
      const y = ancY - ancToRoot * 0.28 + t * ancToRoot * 0.58;
      const r = 28 + rng() * 72;
      const hue   = 108 + rng() * 38;
      const sat   = 30 + rng() * 22;
      const light = 7  + rng() * 12;
      const alpha = 0.06 + rng() * 0.10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,   `hsla(${hue},${sat}%,${light}%,${alpha})`);
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Individual leaf clusters — these give the silhouette its organic shape
    for (let i = 0; i < 48; i++) {
      const t = rng();
      const w = ancHalf * (0.40 + 0.62 * Math.sin(t * Math.PI));
      const cx2 = cx + (rng() * 2 - 1) * w;
      const cy2 = ancY - ancToRoot * 0.32 + t * ancToRoot * 0.52;
      const clusterR = 16 + rng() * 36;
      const leafN    = 6 + Math.floor(rng() * 10);

      for (let j = 0; j < leafN; j++) {
        const lr = rng() * clusterR;
        const la = rng() * Math.PI * 2;
        const lx = cx2 + lr * Math.cos(la);
        const ly = cy2 + lr * Math.sin(la);
        const leafR = 6 + rng() * 16;
        const hue   = 110 + rng() * 36;
        const sat   = 44 + rng() * 26;
        const light = 11 + rng() * 20;
        const alpha = 0.42 + rng() * 0.45;
        const lg = ctx.createRadialGradient(
          lx - leafR * 0.22, ly - leafR * 0.22, 0,
          lx, ly, leafR,
        );
        lg.addColorStop(0,   `hsla(${hue},${sat}%,${light + 7}%,${alpha})`);
        lg.addColorStop(0.65,`hsla(${hue - 4},${sat - 5}%,${light}%,${alpha * 0.55})`);
        lg.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, ly, leafR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Light-catching tips (warm golden-green, top-center)
    for (let i = 0; i < 22; i++) {
      const x = cx + (rng() * 2 - 1) * ancHalf * 0.65;
      const y = ancY - ancToRoot * 0.32 + rng() * ancToRoot * 0.38;
      const r = 4 + rng() * 9;
      const hue = 78 + rng() * 42;
      ctx.fillStyle = `hsla(${hue},62%,52%,${0.14 + rng() * 0.20})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 3. Branch system ──────────────────────────────────────────────────
  function branch(
    x: number, y: number,
    angle: number, len: number, w: number,
    depth: number,
  ): void {
    if (depth <= 0 || len < 3.5 || w < 0.8) return;

    const ex = x + Math.sin(angle) * len;
    const ey = y - Math.cos(angle) * len;
    const cpx = x + Math.sin(angle) * len * 0.48 + (rng() - 0.5) * w * 2.8;
    const cpy = y - Math.cos(angle) * len * 0.48 + (rng() - 0.5) * w * 2.2;

    const dr  = depth / 5;
    const bh  = 26 + rng() * 14;
    const bs  = 52 + dr * 14;
    const bl  = 12 + dr * 18;
    const ba  = 0.50 + dr * 0.30;

    // Shadow base
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
    ctx.strokeStyle = `rgba(8,3,0,${ba * 0.40})`;
    ctx.lineWidth   = w + 2.5;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Bark body
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
    ctx.strokeStyle = `hsla(${bh},${bs}%,${bl}%,${ba})`;
    ctx.lineWidth   = w;
    ctx.stroke();

    // Warm highlight
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.quadraticCurveTo(cpx + 1, cpy, ex + 1, ey);
    ctx.strokeStyle = `rgba(190,118,52,${0.16 + dr * 0.14})`;
    ctx.lineWidth   = w * 0.30;
    ctx.stroke();

    if (depth > 1) {
      const kids    = rng() > 0.28 ? 3 : 2;
      const spread  = 0.52 + rng() * 0.36;
      for (let i = 0; i < kids; i++) {
        const t = i / (kids - 1);
        const childAngle = angle + (t - 0.5) * 2 * spread + (rng() - 0.5) * 0.14;
        branch(ex, ey, childAngle, len * (0.58 + rng() * 0.18), w * (0.58 + rng() * 0.14), depth - 1);
      }
    }
  }

  if (hasAnc) {
    const mainN = 5;
    for (let i = 0; i < mainN; i++) {
      const t  = i / (mainN - 1);
      const a  = (t - 0.5) * Math.PI * 0.88;
      const l  = ancToRoot * (0.28 + rng() * 0.18);
      const sw = 4.2 + (1 - Math.abs(t - 0.5) * 2) * 2.8;
      branch(cx, tTopY, a, l, sw, 5);
    }
  }

  // ── 4. Trunk ──────────────────────────────────────────────────────────
  {
    const lx0 = cx - hwTop,  ly0 = tTopY;
    const lx1 = cx - hwRoot, ly1 = rootY;
    const lxb = cx - hwBot,  lyb = trunkBot;
    const rx0 = cx + hwTop,  ry0 = tTopY;
    const rx1 = cx + hwRoot, ry1 = rootY;
    const rxb = cx + hwBot,  ryb = trunkBot;

    const c1lx = lx0 - 4,        c1ly = ly0 + span * 0.30;
    const c2lx = lx1 - 5,        c2ly = ly1 - span * 0.28;
    const c1rx = rx0 + 4,        c1ry = ry0 + span * 0.30;
    const c2rx = rx1 + 5,        c2ry = ry1 - span * 0.28;

    // Full trunk shape
    ctx.beginPath();
    ctx.moveTo(lx0, ly0);
    ctx.bezierCurveTo(c1lx, c1ly, c2lx, c2ly, lx1, ly1);
    ctx.lineTo(lxb, lyb);
    ctx.lineTo(rxb, ryb);
    ctx.lineTo(rx1, ry1);
    ctx.bezierCurveTo(c2rx, c2ry, c1rx, c1ry, rx0, ry0);
    ctx.closePath();

    // Bark cross-section gradient
    const bark = ctx.createLinearGradient(cx - hwRoot, 0, cx + hwRoot, 0);
    bark.addColorStop(0,    "#0b0503");
    bark.addColorStop(0.09, "#2c1508");
    bark.addColorStop(0.27, "#5a2e10");
    bark.addColorStop(0.44, "#88481c");
    bark.addColorStop(0.54, "#a25e26");
    bark.addColorStop(0.67, "#6a3a14");
    bark.addColorStop(0.86, "#2e1208");
    bark.addColorStop(1,    "#090402");
    ctx.fillStyle = bark;
    ctx.fill();

    // Bark texture — vertical cracks clipped to trunk shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx0, ly0);
    ctx.bezierCurveTo(c1lx, c1ly, c2lx, c2ly, lx1, ly1);
    ctx.lineTo(lxb, lyb);
    ctx.lineTo(rxb, ryb);
    ctx.lineTo(rx1, ry1);
    ctx.bezierCurveTo(c2rx, c2ry, c1rx, c1ry, rx0, ry0);
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < 30; i++) {
      const tx  = cx - hwRoot + rng() * hwRoot * 2;
      const ty0 = tTopY + rng() * span * 0.48;
      const ty1 = ty0 + 22 + rng() * span * 0.42;
      const wob = (rng() - 0.5) * 7;
      const da  = rng() > 0.52;
      ctx.beginPath();
      ctx.moveTo(tx, ty0);
      ctx.quadraticCurveTo(tx + wob, (ty0 + ty1) / 2, tx + (rng() - 0.5) * 5, ty1);
      ctx.strokeStyle = da
        ? `rgba(5,2,0,${0.04 + rng() * 0.09})`
        : `rgba(210,130,56,${0.02 + rng() * 0.05})`;
      ctx.lineWidth = 0.6 + rng() * 1.8;
      ctx.stroke();
    }
    ctx.restore();

    // Left shadow strip (depth illusion)
    ctx.beginPath();
    ctx.moveTo(lx0, ly0);
    ctx.bezierCurveTo(c1lx, c1ly, c2lx, c2ly, lx1, ly1);
    ctx.lineTo(lxb, lyb);
    ctx.lineTo(lxb + hwBot * 0.48, lyb);
    ctx.lineTo(lx1 + hwRoot * 0.46, ly1);
    ctx.bezierCurveTo(c2lx + hwRoot * 0.44, c2ly, c1lx + hwTop * 0.40, c1ly, lx0 + hwTop * 0.36, ly0);
    ctx.closePath();
    const shad = ctx.createLinearGradient(cx - hwRoot, 0, cx, 0);
    shad.addColorStop(0,    "rgba(3,1,0,0.72)");
    shad.addColorStop(0.55, "rgba(3,1,0,0.18)");
    shad.addColorStop(1,    "rgba(3,1,0,0)");
    ctx.fillStyle = shad;
    ctx.fill();

    // Central highlight sheen
    ctx.beginPath();
    ctx.moveTo(cx - 5, tTopY);
    ctx.bezierCurveTo(cx - 5, tTopY + span * 0.32, cx - 6, tTopY + span * 0.66, cx - 3, rootY);
    ctx.lineTo(cx + 4, rootY);
    ctx.bezierCurveTo(cx + 6, tTopY + span * 0.66, cx + 5, tTopY + span * 0.32, cx + 5, tTopY);
    ctx.closePath();
    const hi = ctx.createLinearGradient(cx - 5, 0, cx + 5, 0);
    hi.addColorStop(0,    "rgba(250,165,72,0)");
    hi.addColorStop(0.32, "rgba(250,175,82,0.54)");
    hi.addColorStop(0.56, "rgba(245,168,78,0.64)");
    hi.addColorStop(1,    "rgba(240,155,65,0)");
    ctx.fillStyle = hi;
    ctx.fill();
  }

  // ── 5. Roots ──────────────────────────────────────────────────────────
  {
    const rb       = trunkBot;
    const maxRootY = Math.min(rb + 170, H - 6);
    const roots = [
      { sf: -0.68, ef: -1.02, dy: 58, w: 7.0 },
      { sf: -0.34, ef: -0.44, dy: 74, w: 5.2 },
      { sf:  0.00, ef:  0.00, dy: 84, w: 7.8 },
      { sf:  0.34, ef:  0.44, dy: 74, w: 5.2 },
      { sf:  0.68, ef:  1.02, dy: 58, w: 7.0 },
    ];

    const fade = ctx.createLinearGradient(0, rb, 0, maxRootY);
    fade.addColorStop(0,    "rgba(84,40,14,1)");
    fade.addColorStop(0.42, "rgba(56,24,8,0.60)");
    fade.addColorStop(1,    "rgba(8,3,1,0)");

    for (const { sf, ef, dy, w } of roots) {
      const sx = cx + sf * hwBot;
      const ex = cx + ef * 95;
      const ey = Math.min(rb + dy, maxRootY);
      const cpx = sx * 0.32 + ex * 0.68;
      const cpy = rb + dy * 0.38;

      ctx.beginPath();
      ctx.moveTo(sx, rb);
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.strokeStyle = fade;
      ctx.lineWidth   = w;
      ctx.lineCap     = "round";
      ctx.stroke();

      // Bark sheen on root
      ctx.beginPath();
      ctx.moveTo(sx + 1.5, rb);
      ctx.quadraticCurveTo(cpx + 1.5, cpy, ex + 1.5, ey);
      ctx.strokeStyle = "rgba(190,105,46,0.22)";
      ctx.lineWidth   = w * 0.30;
      ctx.stroke();
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function LivingTreeScene({
  cx, rootY, ancY, ancHalf, ancToRoot, hasAnc, svgWidth, totalHeight,
}: Props) {
  const [href, setHref] = useState<string>("");
  const H = Math.max(380, totalHeight);

  useEffect(() => {
    const canvas       = document.createElement("canvas");
    canvas.width       = svgWidth * DSCALE;
    canvas.height      = H * DSCALE;
    const ctx          = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(DSCALE, DSCALE);
    renderTree(ctx, cx, rootY, ancY, ancHalf, ancToRoot, hasAnc, svgWidth, H);
    setHref(canvas.toDataURL("image/png"));
  }, [cx, rootY, ancY, ancHalf, ancToRoot, hasAnc, svgWidth, H]);

  if (!href) return null;

  return (
    <image
      href={href}
      x={0}
      y={0}
      width={svgWidth}
      height={H}
      preserveAspectRatio="none"
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
