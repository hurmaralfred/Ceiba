"use client";

/**
 * OrganicTrunk — warm-bark trunk, blurred canopy crown, and fading roots.
 *
 * Adapts the approved prototype visual to real layout coordinates from
 * buildLayout(). Pointer-events: none throughout.
 *
 * Coordinate contract:
 *   cx        — horizontal center of the root user node
 *   rootY     — vertical center of the root user node
 *   ancY      — topmost visible ancestor Y (same row as great-grandparents)
 *   ancHalf   — half-width of the ancestor horizontal spread
 *   ancToRoot — rootY − ancY  (distance from ancestors to user)
 *   hasAnc    — whether any ancestor nodes exist
 *   svgWidth  — total canvas width (for canopy scaling)
 *   totalHeight — total canvas height (for root fade)
 */

const ROOT_R = 34;

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

// Unique ID prefix to avoid collisions with existing defs in FamilyTreeGraph
const P = "ot";

export default function OrganicTrunk({
  cx, rootY, ancY, ancHalf, ancToRoot, hasAnc, svgWidth, totalHeight,
}: Props) {

  // ── Trunk geometry ──────────────────────────────────────────────────────
  const tTopY     = hasAnc ? ancY + 6 : rootY - ROOT_R * 2.2;
  const trunkBotY = rootY + ROOT_R + 4;
  const span      = rootY - tTopY;           // trunk height in px

  // Half-widths at top / root level / base (mirror the prototype proportions)
  const hwTop  = Math.max(7,  Math.min(11, span * 0.038));
  const hwRoot = Math.max(26, Math.min(38, ROOT_R + 2));
  const hwBot  = Math.max(20, Math.min(30, ROOT_R * 0.82));

  // Left edge bezier: narrow at top → widens smoothly to root level
  const lx0 = cx - hwTop;
  const lx1 = cx - hwRoot;
  const rx0 = cx + hwTop;
  const rx1 = cx + hwRoot;

  // Closed trunk path (left edge down, bottom, right edge up)
  const trunkPath =
    `M${f(lx0)},${f(tTopY)}` +
    `C${f(lx0 - 4)},${f(tTopY + span * 0.30)}` +
    ` ${f(lx1 - 5)},${f(tTopY + span * 0.68)}` +
    ` ${f(lx1)},${f(rootY)}` +
    `L${f(cx - hwBot)},${f(trunkBotY)}` +
    `L${f(cx + hwBot)},${f(trunkBotY)}` +
    `L${f(rx1)},${f(rootY)}` +
    `C${f(rx1 + 5)},${f(tTopY + span * 0.68)}` +
    ` ${f(rx0 + 4)},${f(tTopY + span * 0.30)}` +
    ` ${f(rx0)},${f(tTopY)}Z`;

  // Central highlight strip (roundness / bark sheen from light)
  const hiPath =
    `M${f(cx - 5)},${f(tTopY)}` +
    `C${f(cx - 5)},${f(tTopY + span * 0.32)}` +
    ` ${f(cx - 6)},${f(tTopY + span * 0.68)}` +
    ` ${f(cx - 4)},${f(rootY)}` +
    `L${f(cx + 4)},${f(rootY)}` +
    `C${f(cx + 6)},${f(tTopY + span * 0.68)}` +
    ` ${f(cx + 5)},${f(tTopY + span * 0.32)}` +
    ` ${f(cx + 5)},${f(tTopY)}Z`;

  // Left-side shadow strip (depth / rounded-cylinder illusion)
  const shadowPath =
    `M${f(lx0)},${f(tTopY)}` +
    `C${f(lx0 - 4)},${f(tTopY + span * 0.30)}` +
    ` ${f(lx1 - 5)},${f(tTopY + span * 0.68)}` +
    ` ${f(lx1)},${f(rootY)}` +
    `L${f(cx - hwBot)},${f(trunkBotY)}` +
    `L${f(cx - hwBot * 0.55)},${f(trunkBotY)}` +
    `L${f(cx - hwRoot * 0.55)},${f(rootY)}` +
    `C${f(cx - hwRoot * 0.42)},${f(tTopY + span * 0.65)}` +
    ` ${f(cx - hwTop * 0.4)},${f(tTopY + span * 0.28)}` +
    ` ${f(cx - hwTop * 0.35)},${f(tTopY)}Z`;

  // ── Canopy geometry ────────────────────────────────────────────────────
  // Ellipse centers expressed relative to ancY / ancHalf so they scale
  const canopyBotY   = ancY + ancToRoot * 0.42 + 20;   // where mask fades to 0
  const canopyFadeY0 = hasAnc ? ancY - ancToRoot * 0.5 : tTopY;

  // ── Roots ──────────────────────────────────────────────────────────────
  const rb       = trunkBotY;                           // root branch origin Y
  const rootBotY = Math.min(rb + 162, totalHeight - 8);

  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        {/* ── Bark gradient (horizontal cross-section light) ── */}
        <linearGradient id={`${P}-bark`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#140804" />
          <stop offset="12%"  stopColor="#3e2010" />
          <stop offset="32%"  stopColor="#6e4020" />
          <stop offset="50%"  stopColor="#9a5e2c" />
          <stop offset="68%"  stopColor="#6e4020" />
          <stop offset="88%"  stopColor="#3e2010" />
          <stop offset="100%" stopColor="#100604" />
        </linearGradient>

        {/* ── Highlight strip (warm center sheen) ── */}
        <linearGradient id={`${P}-bark-hi`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#e0a050" stopOpacity="0"    />
          <stop offset="38%"  stopColor="#f0c060" stopOpacity="0.50" />
          <stop offset="55%"  stopColor="#e8b858" stopOpacity="0.60" />
          <stop offset="100%" stopColor="#e0a050" stopOpacity="0"    />
        </linearGradient>

        {/* ── Left shadow (cylinder depth illusion) ── */}
        <linearGradient id={`${P}-bark-shad`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#060402" stopOpacity="0.65" />
          <stop offset="22%"  stopColor="#060402" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#060402" stopOpacity="0"    />
        </linearGradient>

        {/* ── Canopy vertical fade mask ── */}
        <linearGradient
          id={`${P}-canopy-vfade`}
          gradientUnits="userSpaceOnUse"
          x1="0" y1={f(canopyFadeY0)}
          x2="0" y2={f(canopyBotY)}
        >
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="58%"  stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${P}-canopy-mk`}>
          <rect
            x={-30}
            y={canopyFadeY0 - 100}
            width={svgWidth + 60}
            height={canopyBotY - canopyFadeY0 + 120}
            fill={`url(#${P}-canopy-vfade)`}
          />
        </mask>

        {/* ── Canopy blur filter ── */}
        <filter id={`${P}-canopy-f`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="20" />
        </filter>

        {/* ── Root fade mask ── */}
        <linearGradient
          id={`${P}-root-fade`}
          gradientUnits="userSpaceOnUse"
          x1="0" y1={f(rb)}
          x2="0" y2={f(rootBotY)}
        >
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${P}-root-mk`}>
          <rect
            x={cx - 160}
            y={rb}
            width={320}
            height={rootBotY - rb}
            fill={`url(#${P}-root-fade)`}
          />
        </mask>
      </defs>

      {/* ── Canopy — blurred ellipses with bottom fade ── */}
      {hasAnc && (
        <g
          filter={`url(#${P}-canopy-f)`}
          mask={`url(#${P}-canopy-mk)`}
          opacity={0.56}
        >
          {/* Main mass — sized to ancestor horizontal spread */}
          <ellipse
            cx={cx}
            cy={ancY - ancToRoot * 0.12}
            rx={Math.min(ancHalf * 0.92, svgWidth * 0.44)}
            ry={Math.max(42, ancToRoot * 0.30 + 20)}
            fill="#2a7230"
          />
          {/* Left lobe — reaches lateral ancestors */}
          <ellipse
            cx={cx - ancHalf * 0.64}
            cy={ancY + ancToRoot * 0.04}
            rx={Math.min(ancHalf * 0.62, svgWidth * 0.28)}
            ry={Math.max(32, ancToRoot * 0.24 + 16)}
            fill="#208a28"
          />
          {/* Right lobe */}
          <ellipse
            cx={cx + ancHalf * 0.66}
            cy={ancY}
            rx={Math.min(ancHalf * 0.60, svgWidth * 0.26)}
            ry={Math.max(30, ancToRoot * 0.22 + 14)}
            fill="#248c2e"
          />
          {/* Top crown accent (off-center for organic asymmetry) */}
          <ellipse
            cx={cx + ancHalf * 0.08}
            cy={ancY - ancToRoot * 0.22}
            rx={Math.min(ancHalf * 0.36, svgWidth * 0.14)}
            ry={Math.max(22, ancToRoot * 0.16 + 10)}
            fill="#3aaa44"
          />
          {/* Center-left fill */}
          <ellipse
            cx={cx - ancHalf * 0.32}
            cy={ancY - ancToRoot * 0.10}
            rx={Math.min(ancHalf * 0.40, svgWidth * 0.14)}
            ry={Math.max(20, ancToRoot * 0.14 + 8)}
            fill="#1c6028"
          />
          {/* Center-right fill */}
          <ellipse
            cx={cx + ancHalf * 0.34}
            cy={ancY - ancToRoot * 0.08}
            rx={Math.min(ancHalf * 0.38, svgWidth * 0.13)}
            ry={Math.max(18, ancToRoot * 0.13 + 7)}
            fill="#1e6228"
          />
          {/* Far-left tip — bridges to extreme lateral ancestors */}
          <ellipse
            cx={cx - ancHalf * 0.88}
            cy={ancY + ancToRoot * 0.10}
            rx={Math.min(ancHalf * 0.36, svgWidth * 0.16)}
            ry={Math.max(20, ancToRoot * 0.14 + 8)}
            fill="#1a7824"
          />
          {/* Far-right tip */}
          <ellipse
            cx={cx + ancHalf * 0.90}
            cy={ancY + ancToRoot * 0.08}
            rx={Math.min(ancHalf * 0.34, svgWidth * 0.15)}
            ry={Math.max(18, ancToRoot * 0.13 + 7)}
            fill="#1c7826"
          />
        </g>
      )}

      {/* ── Trunk — three layers for bark depth ── */}

      {/* Main bark fill */}
      <path d={trunkPath} fill={`url(#${P}-bark)`} opacity={0.92} />

      {/* Central highlight (warm sheen, roundness) */}
      <path d={hiPath} fill={`url(#${P}-bark-hi)`} opacity={0.78} />

      {/* Left-side shadow (depth, cylinder illusion) */}
      <path d={shadowPath} fill={`url(#${P}-bark-shad)`} opacity={0.55} />

      {/* ── Roots — 5 downward curves, fading out ── */}
      <g mask={`url(#${P}-root-mk)`} opacity={0.78}>
        {/* Far left */}
        <path
          d={`M${f(cx - 22)},${f(rb)} C${f(cx - 38)},${f(rb + 18)} ${f(cx - 65)},${f(rb + 36)} ${f(cx - 85)},${f(rb + 60)}`}
          stroke="#5c3a1e" strokeWidth={5.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M${f(cx - 22)},${f(rb)} C${f(cx - 38)},${f(rb + 18)} ${f(cx - 65)},${f(rb + 36)} ${f(cx - 85)},${f(rb + 60)}`}
          stroke="#906040" strokeWidth={2}   fill="none" strokeLinecap="round" opacity={0.40}
        />
        {/* Mid-left */}
        <path
          d={`M${f(cx - 11)},${f(rb + 2)} C${f(cx - 18)},${f(rb + 28)} ${f(cx - 24)},${f(rb + 50)} ${f(cx - 28)},${f(rb + 78)}`}
          stroke="#4a2e14" strokeWidth={4}   fill="none" strokeLinecap="round"
        />
        {/* Center */}
        <path
          d={`M${f(cx)},${f(rb + 3)} C${f(cx)},${f(rb + 32)} ${f(cx)},${f(rb + 58)} ${f(cx)},${f(rb + 86)}`}
          stroke="#5c3a1e" strokeWidth={6.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M${f(cx)},${f(rb + 3)} C${f(cx)},${f(rb + 32)} ${f(cx)},${f(rb + 58)} ${f(cx)},${f(rb + 86)}`}
          stroke="#906040" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.35}
        />
        {/* Mid-right */}
        <path
          d={`M${f(cx + 11)},${f(rb + 2)} C${f(cx + 18)},${f(rb + 28)} ${f(cx + 24)},${f(rb + 50)} ${f(cx + 28)},${f(rb + 78)}`}
          stroke="#4a2e14" strokeWidth={4}   fill="none" strokeLinecap="round"
        />
        {/* Far right */}
        <path
          d={`M${f(cx + 22)},${f(rb)} C${f(cx + 38)},${f(rb + 18)} ${f(cx + 65)},${f(rb + 36)} ${f(cx + 85)},${f(rb + 60)}`}
          stroke="#5c3a1e" strokeWidth={5.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M${f(cx + 22)},${f(rb)} C${f(cx + 38)},${f(rb + 18)} ${f(cx + 65)},${f(rb + 36)} ${f(cx + 85)},${f(rb + 60)}`}
          stroke="#906040" strokeWidth={2}   fill="none" strokeLinecap="round" opacity={0.40}
        />
      </g>
    </g>
  );
}

function f(n: number): string { return n.toFixed(1); }
