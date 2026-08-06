'use client'
import React from 'react'
import type { UniverseNode } from './useUniverseLayout'

export const STAR_R  = 36
export const STAR_SZ = 72

// Legacy aliases kept for GalaxyOrbitView compatibility
export const SPRITE_W = STAR_SZ
export const SPRITE_H = STAR_SZ

// ── Relation color palette ────────────────────────────────────────────────────
const REL_COLOR: Record<string, string> = {
  father: '#E8784A', mother: '#E8784A', parent: '#E8784A',
  stepfather: '#E8784A', stepmother: '#E8784A',
  grandfather: '#F2B43C', grandmother: '#F2B43C', grandparent: '#F2B43C',
  great_grandfather: '#D4A020', great_grandmother: '#D4A020',
  son: '#4ABA8A', daughter: '#4ABA8A', child: '#4ABA8A',
  stepson: '#4ABA8A', stepdaughter: '#4ABA8A',
  grandson: '#40B8A8', granddaughter: '#40B8A8', grandchild: '#40B8A8',
  great_grandson: '#30A090', great_granddaughter: '#30A090',
  brother: '#5AAEE0', sister: '#5AAEE0', sibling: '#5AAEE0',
  half_brother: '#5AAEE0', half_sister: '#5AAEE0',
  husband: '#D46090', wife: '#D46090', spouse: '#D46090', partner: '#D46090',
  uncle: '#9A88DA', aunt: '#9A88DA', nephew: '#9A88DA', niece: '#9A88DA',
  cousin: '#7878CA', cousin_once: '#7878CA', cousin_twice: '#7878CA',
  father_in_law: '#C09840', mother_in_law: '#C09840',
  brother_in_law: '#7098C0', sister_in_law: '#7098C0',
}

function resolveColor(relationType: string | undefined, isDeceased: boolean, isFocal: boolean): string {
  if (isFocal)    return '#F2C040'
  if (isDeceased) return '#9090A8'
  if (!relationType) return '#8080C0'
  const key = relationType.toLowerCase().replace(/-/g, '_')
  if (REL_COLOR[key]) return REL_COLOR[key]
  for (const [k, v] of Object.entries(REL_COLOR)) {
    if (key.startsWith(k)) return v
  }
  return '#8080C0'
}

// Darken a hex color by `factor` (0–1)
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 0xff) * factor)
  const g = Math.round(((n >>  8) & 0xff) * factor)
  const b = Math.round(( n        & 0xff) * factor)
  return `rgb(${r},${g},${b})`
}

function getInitials(node: UniverseNode): string {
  const name = node.shortName || node.name || '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Circumference helpers for orbit ring dasharray
function circ(r: number) { return +(2 * Math.PI * r).toFixed(1) }

interface Props {
  node: UniverseNode
  onClick?: () => void
  highlighted?: boolean
  hitAreaScale?: number
  labelVisible?: boolean
  /** Pass true from GalaxyOrbitView (canvas draws the star; this overlay is photo-only) */
  overlayOnly?: boolean
}

export function AvatarFigure({ node, onClick, highlighted, overlayOnly = false }: Props) {
  const photoUrl = node.avatarUrl ?? null
  if (overlayOnly && !photoUrl) return null

  const color    = resolveColor(node.relationType, node.isDeceased ?? false, node.isFocal)
  const colorDim = darken(color, 0.45)
  const isFocal  = node.isFocal
  const inits    = getInitials(node)

  const uid    = node.id.replace(/[^a-zA-Z0-9]/g, '_')
  const ids = {
    halo:    `ah_${uid}`,
    midGlow: `mg_${uid}`,
    grad:    `ag_${uid}`,
    shadow:  `as_${uid}`,
    clip:    `ac_${uid}`,
  }

  const R  = STAR_R          // 36 — center of SVG
  const sR = isFocal ? 27 : 22  // sphere radius
  const ringR   = sR + 9         // orbit ring radius
  const ringC   = circ(ringR)    // circumference
  const arcLen  = +(ringC * 0.28).toFixed(1)  // 28% visible arc
  const gapLen  = +(ringC * 0.72).toFixed(1)  // 72% gap

  return (
    <svg
      width={STAR_SZ}
      height={STAR_SZ}
      viewBox={`0 0 ${STAR_SZ} ${STAR_SZ}`}
      style={{ display: 'block', userSelect: 'none', overflow: 'visible' }}
      onClick={onClick}
      aria-hidden
    >
      <defs>
        {/* Outer ambient halo */}
        <radialGradient id={ids.halo} cx="50%" cy="45%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity={highlighted ? 0.60 : 0.32} />
          <stop offset="65%"  stopColor={color} stopOpacity={highlighted ? 0.12 : 0.06} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* Mid glow — tight wrap just outside sphere */}
        <radialGradient id={ids.midGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity={highlighted ? 0.45 : 0.22} />
          <stop offset="55%"  stopColor={color} stopOpacity="0.07" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* 3-D sphere gradient — bright top-left, deep shadow bottom-right */}
        <radialGradient id={ids.grad} cx="32%" cy="26%" r="68%">
          <stop offset="0%"   stopColor="#fff"    stopOpacity="0.42" />
          <stop offset="20%"  stopColor={color}   stopOpacity="0.98" />
          <stop offset="68%"  stopColor={colorDim} stopOpacity="0.92" />
          <stop offset="100%" stopColor={darken(color, 0.28)} stopOpacity="0.80" />
        </radialGradient>

        {/* Shadow overlay for depth — dark from bottom-right */}
        <radialGradient id={ids.shadow} cx="72%" cy="72%" r="58%">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {photoUrl && (
          <clipPath id={ids.clip}>
            <circle cx={R} cy={R} r={sR - 1} />
          </clipPath>
        )}
      </defs>

      {/* ── Layer 1: Outer corona ── */}
      <circle cx={R} cy={R} r={R - 2} fill={`url(#${ids.halo})`} />

      {/* ── Layer 2: Mid glow (tight to sphere) ── */}
      <circle cx={R} cy={R} r={sR + 10} fill={`url(#${ids.midGlow})`} />

      {/* ── Focal extra pulsing rings (behind sphere) ── */}
      {isFocal && (
        <>
          <circle cx={R} cy={R} r={sR + 22}
            fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.12"
            style={{ animation: 'universeGlowPulse 4.8s ease-in-out -2s infinite' }}
          />
          <circle cx={R} cy={R} r={sR + 14}
            fill="none" stroke={color} strokeWidth="0.7" strokeOpacity="0.22"
            style={{ animation: 'universeGlowPulse 3.6s ease-in-out -0.8s infinite' }}
          />
        </>
      )}

      {/* ── Layer 3: Main sphere ── */}
      <circle cx={R} cy={R} r={sR} fill={`url(#${ids.grad})`} />

      {/* ── Layer 4: Shadow overlay (bottom-right depth) ── */}
      <circle cx={R} cy={R} r={sR} fill={`url(#${ids.shadow})`} />

      {/* ── Layer 5: Sphere rim ── */}
      <circle
        cx={R} cy={R} r={sR}
        fill="none"
        stroke={color}
        strokeWidth={highlighted ? 2.2 : 1.1}
        strokeOpacity={highlighted ? 0.98 : 0.65}
      />

      {/* ── Layer 6: Photo or initials ── */}
      {photoUrl ? (
        <>
          <image
            href={photoUrl}
            x={R - sR} y={R - sR}
            width={sR * 2} height={sR * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${ids.clip})`}
          />
          {/* Gold arc decoration on photo nodes */}
          <circle
            cx={R} cy={R} r={sR + 3}
            fill="none"
            stroke={isFocal ? color : 'rgba(212,175,55,0.55)'}
            strokeWidth="1.2"
            strokeOpacity={highlighted ? 0.85 : 0.45}
            strokeDasharray={`${arcLen} ${gapLen}`}
            style={{
              animation: `orbitSpin ${isFocal ? 14 : 10}s linear infinite`,
              transformOrigin: `${R}px ${R}px`,
            }}
          />
        </>
      ) : (
        <>
          {/* Initials */}
          <text
            x={R} y={R + (isFocal ? 6 : 4.5)}
            textAnchor="middle"
            fontSize={isFocal ? 16 : 13}
            fontWeight="800"
            fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
            fill="rgba(255,255,255,0.95)"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {inits}
          </text>

          {/* Top-left specular highlight */}
          <ellipse
            cx={R - sR * 0.26} cy={R - sR * 0.28}
            rx={sR * 0.38} ry={sR * 0.22}
            fill="white" opacity="0.28"
          />
          {/* Tiny specular sparkle dot */}
          <circle
            cx={R - sR * 0.32} cy={R - sR * 0.34}
            r={sR * 0.07}
            fill="white" opacity="0.65"
          />
        </>
      )}

      {/* ── Layer 7: Orbital spinning ring ── */}
      {!isFocal && (
        <circle
          cx={R} cy={R} r={ringR}
          fill="none"
          stroke={color}
          strokeWidth="0.9"
          strokeOpacity={highlighted ? 0.75 : 0.42}
          strokeDasharray={`${arcLen} ${gapLen}`}
          style={{
            animation: 'orbitSpin 10s linear infinite',
            transformOrigin: `${R}px ${R}px`,
          }}
        />
      )}

      {/* ── Focal: primary pulsing ring ── */}
      {isFocal && (
        <circle
          cx={R} cy={R} r={sR + 6}
          fill="none"
          stroke={color}
          strokeWidth="1.0"
          strokeOpacity="0.40"
          style={{ animation: 'universeGlowPulse 2.4s ease-in-out infinite' }}
        />
      )}

      {/* ── Focal: 4 star points (N / E / S / W) ── */}
      {isFocal && (
        <>
          {/* North */}
          <polygon
            points={`${R},${R - sR - 3} ${R + 1.8},${R - sR - 9} ${R},${R - sR - 15} ${R - 1.8},${R - sR - 9}`}
            fill={color} opacity="0.75"
          />
          {/* East */}
          <polygon
            points={`${R + sR + 3},${R} ${R + sR + 9},${R - 1.8} ${R + sR + 15},${R} ${R + sR + 9},${R + 1.8}`}
            fill={color} opacity="0.75"
          />
          {/* South */}
          <polygon
            points={`${R},${R + sR + 3} ${R + 1.8},${R + sR + 9} ${R},${R + sR + 15} ${R - 1.8},${R + sR + 9}`}
            fill={color} opacity="0.75"
          />
          {/* West */}
          <polygon
            points={`${R - sR - 3},${R} ${R - sR - 9},${R - 1.8} ${R - sR - 15},${R} ${R - sR - 9},${R + 1.8}`}
            fill={color} opacity="0.75"
          />
        </>
      )}

      {/* ── Invisible hit area ── */}
      {onClick && (
        <circle cx={R} cy={R} r={R} fill="transparent" style={{ cursor: 'pointer' }} />
      )}
    </svg>
  )
}
