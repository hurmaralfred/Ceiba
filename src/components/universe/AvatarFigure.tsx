'use client'
import React, { useId, useState } from 'react'
import type { UniverseNode } from './useUniverseLayout'

// ─── Color helpers ────────────────────────────────────────────────────────────

function lighten(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, (r + (255 - r) * t) | 0)},${Math.min(255, (g + (255 - g) * t) | 0)},${Math.min(255, (b + (255 - b) * t) | 0)})`
}

function darken(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.max(0, (r * (1 - t)) | 0)},${Math.max(0, (g * (1 - t)) | 0)},${Math.max(0, (b * (1 - t)) | 0)})`
}

// ─── Deterministic hash ───────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

// ─── Palette constants ────────────────────────────────────────────────────────

const SKIN_TONES  = ['#FDDBB5', '#F0C08A', '#DDA060', '#C07838', '#8B5020', '#6A3C18']
const HAIR_COLORS = ['#2C1A0E', '#4A3010', '#8A6A2A', '#C0A860', '#D4CAAA', '#909090']
const EYE_COLORS  = ['#5B8FD0', '#6B9B60', '#8B6430', '#5A7AAA', '#7B5570', '#60908A']

const OUTFIT: Record<string, [string, string]> = {
  root:       ['#1A3A5C', '#112540'],
  ancestor:   ['#2E5318', '#3A4230'],
  descendant: ['#8B2E50', '#3A2830'],
  spouse:     ['#8B5020', '#3A3020'],
  sibling:    ['#1E4D6B', '#1A3040'],
  inlaw:      ['#4A3A7A', '#2C2848'],
  default:    ['#3A4A2A', '#202A18'],
}

// Three-channel color system — aligns with ConnectionLines visual language
const GLOW_COLOR: Record<string, string> = {
  root:       '#F2B43C',
  ancestor:   '#F2B43C',
  descendant: '#F2B43C',
  sibling:    '#F2B43C',
  spouse:     '#7BAFD4',
  inlaw:      '#B8A0D8',
  default:    '#B8A0D8',
}

// Precomputed RGB for glow colors (used in SVG rgba stops)
const GLOW_RGB: Record<string, string> = {
  '#F2B43C': '242,180,60',
  '#7BAFD4': '123,175,212',
  '#B8A0D8': '184,160,216',
}

// ─── Relationship sets ────────────────────────────────────────────────────────

const ANCESTOR_RELS = new Set([
  'father','mother','grandfather','grandmother',
  'grandfather_paternal','grandmother_paternal','grandfather_maternal','grandmother_maternal',
  'great_grandfather','great_grandmother','uncle','aunt','stepfather','stepmother',
  'father_in_law','mother_in_law',
])
const DESCENDANT_RELS = new Set([
  'son','daughter','grandson','granddaughter','great_grandson','great_granddaughter',
  'nephew','niece','stepson','stepdaughter','stepchild',
])
const SPOUSE_RELS  = new Set(['spouse','partner','husband','wife'])
const SIBLING_RELS = new Set(['brother','sister','half_brother','half_sister','cousin'])
const INLAW_RELS   = new Set(['brother_in_law','sister_in_law','son_in_law','daughter_in_law'])
const FEMALE_RELS  = new Set([
  'mother','grandmother','grandmother_paternal','grandmother_maternal','great_grandmother',
  'aunt','daughter','granddaughter','great_granddaughter','niece','sister','half_sister',
  'wife','partner','stepmother','stepdaughter','sister_in_law','mother_in_law','daughter_in_law',
])

function getOutfitKey(node: UniverseNode): string {
  if (node.relationType === 'root')           return 'root'
  if (ANCESTOR_RELS.has(node.relationType))   return 'ancestor'
  if (DESCENDANT_RELS.has(node.relationType)) return 'descendant'
  if (SPOUSE_RELS.has(node.relationType))     return 'spouse'
  if (SIBLING_RELS.has(node.relationType))    return 'sibling'
  if (INLAW_RELS.has(node.relationType))      return 'inlaw'
  return 'default'
}

function isFemale(node: UniverseNode): boolean {
  const g = node.gender?.toLowerCase() ?? ''
  if (['female', 'f', 'mujer', 'femenino'].includes(g)) return true
  return FEMALE_RELS.has(node.relationType)
}

// ─── Hair (portrait bust) ─────────────────────────────────────────────────────
// Rendered BEFORE the head ellipse so the head naturally overlaps at the hairline.
// All elements here are inside the parent clipPath to the portrait circle.

function PortraitHair({
  color, female, elder, child, style, headTopY, hairlineY, cx,
}: {
  color: string; female: boolean; elder: boolean; child: boolean; style: number
  headTopY: number; hairlineY: number; cx: number
}) {
  const hi = lighten(color, 0.40)

  if (elder && !female) {
    return (
      <path
        d={`M${cx - 16} ${headTopY + 3} C${cx - 14} ${headTopY - 4} ${cx + 14} ${headTopY - 4} ${cx + 16} ${headTopY + 3} L${cx + 15} ${hairlineY} C${cx + 9} ${hairlineY - 3} ${cx - 9} ${hairlineY - 3} ${cx - 15} ${hairlineY} Z`}
        fill={color} opacity="0.45"
      />
    )
  }

  if (female) {
    switch (style % 4) {
      case 0: // Long — cascades down both sides
        return (
          <>
            <path d={`M${cx - 16} ${headTopY + 4} C${cx - 20} ${headTopY + 16} ${cx - 21} ${headTopY + 36} ${cx - 18} ${headTopY + 54}`}
              fill={color} stroke={color} strokeWidth="12" strokeLinecap="round" />
            <path d={`M${cx + 16} ${headTopY + 4} C${cx + 20} ${headTopY + 16} ${cx + 21} ${headTopY + 36} ${cx + 18} ${headTopY + 54}`}
              fill={color} stroke={color} strokeWidth="12" strokeLinecap="round" />
            <path d={`M${cx - 16} ${headTopY + 3} C${cx - 16} ${headTopY - 9} ${cx + 16} ${headTopY - 9} ${cx + 16} ${headTopY + 3}`} fill={color} />
            <ellipse cx={cx - 4} cy={headTopY - 3} rx="6" ry="4" fill={hi} opacity="0.40" />
          </>
        )
      case 1: // Short bob
        return (
          <>
            <path d={`M${cx - 16} ${headTopY + 2} C${cx - 16} ${headTopY - 8} ${cx + 16} ${headTopY - 8} ${cx + 16} ${headTopY + 2} L${cx + 17} ${hairlineY + 14} C${cx + 15} ${hairlineY + 17} ${cx - 15} ${hairlineY + 17} ${cx - 17} ${hairlineY + 14} Z`} fill={color} />
            <ellipse cx={cx - 4} cy={headTopY - 2} rx="6" ry="4" fill={hi} opacity="0.36" />
          </>
        )
      case 2: // Medium wavy
        return (
          <>
            <path d={`M${cx - 16} ${headTopY + 4} C${cx - 20} ${headTopY + 20} ${cx - 18} ${headTopY + 38} ${cx - 15} ${headTopY + 50}`}
              fill={color} stroke={color} strokeWidth="10" strokeLinecap="round" />
            <path d={`M${cx + 16} ${headTopY + 4} C${cx + 20} ${headTopY + 20} ${cx + 18} ${headTopY + 38} ${cx + 15} ${headTopY + 50}`}
              fill={color} stroke={color} strokeWidth="10" strokeLinecap="round" />
            <path d={`M${cx - 16} ${headTopY + 2} C${cx - 16} ${headTopY - 8} ${cx + 16} ${headTopY - 8} ${cx + 16} ${headTopY + 2}`} fill={color} />
            <ellipse cx={cx - 4} cy={headTopY - 3} rx="5" ry="4" fill={hi} opacity="0.38" />
          </>
        )
      case 3: // High bun
        return (
          <>
            <circle cx={cx} cy={headTopY - 7} r="9" fill={color} />
            <circle cx={cx} cy={headTopY - 8} r="5" fill={hi} opacity="0.36" />
            <path d={`M${cx - 16} ${headTopY + 2} C${cx - 16} ${headTopY} ${cx + 16} ${headTopY} ${cx + 16} ${headTopY + 2}`} fill={color} />
            <path d={`M${cx - 14} ${headTopY + 6} C${cx - 18} ${headTopY + 20} ${cx - 15} ${headTopY + 34} ${cx - 13} ${headTopY + 42}`}
              stroke={darken(color, 0.15)} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.45" />
            <path d={`M${cx + 14} ${headTopY + 6} C${cx + 18} ${headTopY + 20} ${cx + 15} ${headTopY + 34} ${cx + 13} ${headTopY + 42}`}
              stroke={darken(color, 0.15)} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.45" />
          </>
        )
      default: return null
    }
  }

  // Male / child
  switch (style % 5) {
    case 0: // Classic short
      return (
        <>
          <path d={`M${cx - 16} ${headTopY + 2} C${cx - 16} ${headTopY - 9} ${cx + 16} ${headTopY - 9} ${cx + 16} ${headTopY + 2} L${cx + 16} ${hairlineY} C${cx + 8} ${hairlineY - 4} ${cx - 8} ${hairlineY - 4} ${cx - 16} ${hairlineY} Z`} fill={color} />
          <ellipse cx={cx - 3} cy={headTopY - 2} rx="5" ry="3.5" fill={hi} opacity="0.36" />
        </>
      )
    case 1: // Buzz
      return (
        <>
          <path d={`M${cx - 15} ${headTopY + 3} C${cx - 15} ${headTopY - 5} ${cx + 15} ${headTopY - 5} ${cx + 15} ${headTopY + 3} L${cx + 15} ${hairlineY + 1} C${cx + 8} ${hairlineY - 2} ${cx - 8} ${hairlineY - 2} ${cx - 15} ${hairlineY + 1} Z`} fill={color} opacity="0.80" />
          <ellipse cx={cx - 3} cy={headTopY} rx="4" ry="2.5" fill={hi} opacity="0.30" />
        </>
      )
    case 2: // Curly / textured
      return (
        <>
          <path d={`M${cx - 16} ${headTopY + 4} C${cx - 16} ${headTopY - 7} ${cx + 16} ${headTopY - 7} ${cx + 16} ${headTopY + 4} L${cx + 16} ${hairlineY} C${cx + 8} ${hairlineY - 4} ${cx - 8} ${hairlineY - 4} ${cx - 16} ${hairlineY} Z`} fill={color} />
          <circle cx={cx - 10} cy={headTopY - 5} r="5"   fill={color} />
          <circle cx={cx}      cy={headTopY - 7} r="5.5" fill={color} />
          <circle cx={cx + 10} cy={headTopY - 5} r="5"   fill={color} />
          <circle cx={cx - 3}  cy={headTopY - 6} r="3"   fill={hi} opacity="0.36" />
        </>
      )
    case 3: // Side-swept
      return (
        <>
          <path d={`M${cx - 16} ${headTopY + 2} C${cx - 12} ${headTopY - 9} ${cx + 16} ${headTopY - 8} ${cx + 16} ${headTopY + 2} L${cx + 16} ${hairlineY} C${cx + 6} ${hairlineY - 3} ${cx - 8} ${hairlineY - 2} ${cx - 16} ${hairlineY + 1} Z`} fill={color} />
          <path d={`M${cx - 12} ${headTopY - 1} C${cx} ${headTopY - 6} ${cx + 12} ${headTopY - 5} ${cx + 14} ${headTopY}`}
            fill="none" stroke={hi} strokeWidth="2.5" strokeLinecap="round" opacity="0.46" />
        </>
      )
    case 4: // Undercut
      return (
        <>
          <path d={`M${cx - 13} ${headTopY + 2} C${cx - 13} ${headTopY - 9} ${cx + 13} ${headTopY - 9} ${cx + 13} ${headTopY + 2} L${cx + 14} ${hairlineY} C${cx + 8} ${hairlineY - 4} ${cx - 8} ${hairlineY - 4} ${cx - 14} ${hairlineY} Z`} fill={color} />
          <ellipse cx={cx - 2} cy={headTopY - 3} rx="6" ry="4" fill={hi} opacity="0.38" />
        </>
      )
    default: return null
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  node: UniverseNode
  onClick?: () => void
  highlighted?: boolean
  hitAreaScale?: number
  /** When false (Tier 2 nodes), name and relation are hidden until hover/focus. */
  labelVisible?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AvatarFigure({ node, onClick, highlighted, hitAreaScale, labelVisible = true }: Props) {
  const rawUid = useId()
  const uid    = rawUid.replace(/:/g, '_')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const seed    = hashId(node.id)
  const cfg     = node.avatarConfig
  const female  = cfg ? cfg.gender === 'female' : isFemale(node)
  const elder   = node.ageGroup === 'elder'
  const child   = node.ageGroup === 'child'
  const oKey    = getOutfitKey(node)
  // When the user has set a custom drawn avatar, it takes priority over any uploaded photo
  const hasPhoto = !!node.avatarUrl && !cfg

  const hairStyle  = cfg ? cfg.hairStyle % (female ? 4 : 5) : (seed >> 2) % (female ? 4 : 5)
  const faceShape  = cfg?.faceShape ?? 0
  const acc        = cfg?.accessories ?? -1 // -1 = hash-based
  const hasGlasses = acc >= 0 ? (acc === 1 || acc === 3) : (!child && !hasPhoto && (seed >> 12) % 5 === 0)
  const hasBeard   = acc >= 0 ? (!female && (acc === 2 || acc === 3)) : (!female && !child && !hasPhoto && (seed >> 16) % 4 === 0)
  const hasEarrings = acc >= 0 ? (female && !child && (acc === 2 || acc === 3)) : false

  const skin       = cfg ? SKIN_TONES[cfg.skinTone % 6] : SKIN_TONES[seed % 6]
  const hairColor  = elder ? '#A8A8A8' : (cfg ? HAIR_COLORS[cfg.hairColor % 6] : HAIR_COLORS[(seed >> 4) % 6])
  const eyeColor   = cfg ? EYE_COLORS[cfg.eyeColor % 6] : EYE_COLORS[(seed >> 8) % 6]
  const [shirt]    = OUTFIT[oKey]
  const glowColor  = GLOW_COLOR[oKey]
  const glowRgb    = GLOW_RGB[glowColor] ?? '200,180,140'

  const skinLight  = lighten(skin, 0.38)
  const skinDark   = darken(skin, 0.28)
  const skinDeep   = darken(skin, 0.46)
  const shirtLight = lighten(shirt, 0.32)
  const browColor  = elder ? '#888888' : darken(hairColor, 0.10)
  const eyeDark    = darken(eyeColor, 0.38)

  const floatDelay = `-${(seed % 32) * 0.12}s`
  const floatDur   = `${3.2 + (seed % 18) * 0.12}s`
  const glowDelay  = `-${(seed % 40) * 0.07}s`

  // ── Portrait geometry ──────────────────────────────────────────────────────
  // SVG canvas 72×84. Circle: cx=36, cy=36, r=32.
  const SVG_W = 72
  const SVG_H = 84
  const CX    = 36
  const CY    = 36
  const R     = 32

  const headRX    = child ? 14   : faceShape === 1 ? 17.2 : faceShape === 2 ? 17.8 : 15.5
  const headRY    = child ? 16   : faceShape === 1 ? 16.5 : faceShape === 2 ? 16.0 : 19
  const headCY    = child ? CY + 2 : CY - 2
  const headTopY  = headCY - headRY
  const hairlineY = headCY - headRY + 7
  const eyeY      = child ? headCY - 1 : headCY - 4
  const eyeR      = child ? 6.5 : 5.0
  const browY     = eyeY - (child ? 8 : 9)
  const noseY     = headCY + (child ? 7 : 9)
  const mouthY    = headCY + (child ? 13 : 16)
  const chinY     = headCY + headRY - 1
  const earCY     = headCY + 1
  const earLX     = CX - headRX
  const earRX     = CX + headRX

  const neckTopY  = chinY + 1
  const neckBotY  = CY + R - 4

  const glowCY    = CY + R + 9
  const shadowCY  = CY + R + 13

  const outerWidth  = hitAreaScale ? Math.max(SVG_W, Math.ceil(44 / hitAreaScale)) : SVG_W
  const isClickable = !node.isFocal && !!onClick
  const showGlow    = node.isFocal || highlighted || hovered

  const deceasedFilter = node.isDeceased ? `url(#${uid}ds)` : undefined
  const dropShadow     = showGlow
    ? `drop-shadow(0 0 ${node.isFocal ? 18 : 9}px ${glowColor}${node.isFocal ? 'ee' : 'aa'})`
    : undefined

  return (
    <div
      style={{
        position: 'relative',
        width: outerWidth,
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        outline: focused ? `2px solid ${glowColor}` : '2px solid transparent',
        outlineOffset: '4px',
        borderRadius: '50%',
      }}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={isClickable ? () => setHovered(true) : undefined}
      onMouseLeave={isClickable ? () => setHovered(false) : undefined}
      onFocus={isClickable ? () => setFocused(true) : undefined}
      onBlur={isClickable ? () => setFocused(false) : undefined}
      onKeyDown={isClickable ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() }
      } : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      aria-label={isClickable ? `${node.shortName}, ${node.relation}, seleccionar` : undefined}
    >
      {/* Float wrapper */}
      <div
        style={{
          animation: !node.isFocal
            ? `universeFloat ${floatDur} ease-in-out ${floatDelay} infinite`
            : undefined,
          filter: dropShadow,
          transition: 'filter 0.3s ease',
          willChange: 'transform',
        }}
      >
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          overflow="visible"
          style={{ display: 'block', margin: '0 auto' }}
          aria-hidden
        >
          <defs>
            <clipPath id={`${uid}pc`}>
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>

            <radialGradient id={`${uid}sk`} cx="37%" cy="25%" r="74%">
              <stop offset="0%"   stopColor={skinLight} />
              <stop offset="50%"  stopColor={skin} />
              <stop offset="100%" stopColor={skinDark} />
            </radialGradient>

            <radialGradient id={`${uid}el`} cx="33%" cy="28%" r="62%">
              <stop offset="0%"   stopColor={lighten(eyeColor, 0.32)} />
              <stop offset="65%"  stopColor={eyeColor} />
              <stop offset="100%" stopColor={eyeDark} />
            </radialGradient>

            <radialGradient id={`${uid}er`} cx="33%" cy="28%" r="62%">
              <stop offset="0%"   stopColor={lighten(eyeColor, 0.32)} />
              <stop offset="65%"  stopColor={eyeColor} />
              <stop offset="100%" stopColor={eyeDark} />
            </radialGradient>

            <radialGradient id={`${uid}sh`} cx="38%" cy="20%" r="80%">
              <stop offset="0%"   stopColor={shirtLight} />
              <stop offset="100%" stopColor={shirt} />
            </radialGradient>

            <radialGradient id={`${uid}bg`} cx="50%" cy="36%" r="66%">
              <stop offset="0%"   stopColor={`rgba(${glowRgb},0.10)`} />
              <stop offset="100%" stopColor="rgba(5,3,2,0.97)" />
            </radialGradient>

            <radialGradient id={`${uid}gg`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={glowColor} stopOpacity="0.60" />
              <stop offset="55%"  stopColor={glowColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
            </radialGradient>

            {node.isDeceased && (
              <>
                {/* Desaturate + tint toward silver-blue + reduce opacity */}
                <filter id={`${uid}ds`} colorInterpolationFilters="sRGB">
                  <feColorMatrix type="saturate" values="0" />
                  {/* Tint toward cool luminous silver: lift R/B channels slightly */}
                  <feColorMatrix type="matrix" values="
                    0.82 0.06 0.14 0 0.07
                    0.06 0.82 0.14 0 0.07
                    0.06 0.08 0.88 0 0.12
                    0    0    0    0.52 0
                  " />
                </filter>
                {/* Ethereal aura gradient — diffuse glow behind avatar */}
                <radialGradient id={`${uid}aura`} cx="50%" cy="44%" r="50%">
                  <stop offset="0%"   stopColor="rgba(210,228,255,0.55)" />
                  <stop offset="35%"  stopColor="rgba(180,210,255,0.26)" />
                  <stop offset="65%"  stopColor="rgba(195,215,255,0.10)" />
                  <stop offset="100%" stopColor="rgba(180,205,255,0)" />
                </radialGradient>
                {/* Orbit path for animateMotion particles */}
                <path id={`${uid}op`}
                  d={`M${CX - (R + 15)},${CY} A${R + 15},${R + 10},0,1,0,${CX + (R + 15)},${CY} A${R + 15},${R + 10},0,1,0,${CX - (R + 15)},${CY}Z`}
                  fill="none"
                />
              </>
            )}
          </defs>

          {/* ── Ethereal aura behind avatar (unaffected by desaturate filter) ── */}
          {node.isDeceased && (
            <>
              {/* Outer diffuse glow */}
              <ellipse cx={CX} cy={CY - 3} rx={R + 24} ry={R + 20}
                fill={`url(#${uid}aura)`}
                style={{ animation: `universeGlowPulse 4s ease-in-out ${glowDelay} infinite` }}
              />
              {/* Inner luminous core */}
              <ellipse cx={CX} cy={CY - 2} rx={R + 9} ry={R + 7}
                fill="rgba(205,222,255,0.18)"
                style={{ animation: `universeGlowPulse 2.8s ease-in-out ${glowDelay} infinite` }}
              />
            </>
          )}

          <g filter={deceasedFilter}>
            {/* Glow corona (tier ≤ 1) */}
            {node.relevanceTier <= 1 && (
              <>
                <ellipse cx={CX} cy={glowCY} rx={R - 5} ry="7"
                  fill={`url(#${uid}gg)`}
                  opacity={node.isJoined === false ? 0.18 : 1}
                  style={{ animation: `universeGlowPulse 2.8s ease-in-out ${glowDelay} infinite` }}
                />
                <ellipse cx={CX} cy={glowCY + 0.5} rx={R - 15} ry="3"
                  fill="none" stroke={glowColor} strokeWidth="0.55"
                  opacity={node.isJoined === false ? 0.12 : 0.36}
                />
              </>
            )}

            {/* Ground shadow */}
            <ellipse cx={CX} cy={shadowCY} rx="12" ry="2.4" fill="rgba(0,0,0,0.20)" />

            {/* Focal spin ring */}
            {node.isFocal && (
              <circle cx={CX} cy={CY} r={R + 7}
                fill="none" stroke={glowColor}
                strokeWidth="2" strokeDasharray="5 4" opacity="0.76"
                style={{
                  animation: 'universeSpin 12s linear infinite',
                  transformOrigin: `${CX}px ${CY}px`,
                }}
              />
            )}

            {/* ══ PORTRAIT ══════════════════════════════════════════════════ */}

            {hasPhoto ? (
              <>
                <circle cx={CX} cy={CY} r={R} fill="rgba(8,6,4,0.92)" />
                <image
                  href={node.avatarUrl ?? undefined}
                  x={CX - R} y={CY - R}
                  width={R * 2} height={R * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${uid}pc)`}
                />
                {/* Inner vignette */}
                <circle cx={CX} cy={CY} r={R - 2}
                  fill="none" stroke="rgba(0,0,0,0.25)"
                  strokeWidth="5" clipPath={`url(#${uid}pc)`}
                />
              </>
            ) : (
              <g clipPath={`url(#${uid}pc)`}>
                {/* Background */}
                <circle cx={CX} cy={CY} r={R} fill={`url(#${uid}bg)`} />

                {/* Shirt / shoulders */}
                <ellipse cx={CX} cy={neckBotY + 22} rx={R + 6} ry="26" fill={`url(#${uid}sh)`} />
                {/* V-collar */}
                <path
                  d={`M${CX - 8} ${neckBotY - 2} L${CX} ${neckBotY + 7} L${CX + 8} ${neckBotY - 2}`}
                  fill="none" stroke={skin} strokeWidth="2.8" strokeLinecap="round"
                />

                {/* Neck */}
                <path
                  d={`M${CX - 6} ${neckTopY} Q${CX - 7} ${neckBotY} ${CX - 8} ${neckBotY + 2} L${CX + 8} ${neckBotY + 2} Q${CX + 7} ${neckBotY} ${CX + 6} ${neckTopY} Q${CX} ${neckTopY + 5} ${CX - 6} ${neckTopY} Z`}
                  fill={`url(#${uid}sk)`}
                />
                <ellipse cx={CX - 4} cy={neckTopY + 6} rx="3" ry="6" fill={skinDark} opacity="0.16" />
                <ellipse cx={CX + 4} cy={neckTopY + 6} rx="3" ry="6" fill={skinDark} opacity="0.16" />

                {/* Hair — rendered before head so head creates hairline naturally */}
                <PortraitHair
                  color={hairColor} female={female} elder={elder} child={child} style={hairStyle}
                  headTopY={headTopY} hairlineY={hairlineY} cx={CX}
                />

                {/* Ears */}
                <ellipse cx={earLX - 1} cy={earCY} rx="3.2" ry="4.5" fill={skin} />
                <ellipse cx={earLX - 1} cy={earCY} rx="1.6" ry="2.7" fill={skinDark} opacity="0.20" />
                <ellipse cx={earRX + 1} cy={earCY} rx="3.2" ry="4.5" fill={skin} />
                <ellipse cx={earRX + 1} cy={earCY} rx="1.6" ry="2.7" fill={skinDark} opacity="0.20" />

                {/* Earrings */}
                {hasEarrings && (
                  <>
                    <line x1={earLX - 1} y1={earCY + 4.5} x2={earLX - 1} y2={earCY + 8.5}
                      stroke={darken(hairColor, 0.05)} strokeWidth="0.9" strokeLinecap="round" />
                    <circle cx={earLX - 1} cy={earCY + 10.5} r="2.4" fill={lighten(hairColor, 0.28)} />
                    <circle cx={earLX - 1} cy={earCY + 10.5} r="1.5" fill={hairColor} />
                    <line x1={earRX + 1} y1={earCY + 4.5} x2={earRX + 1} y2={earCY + 8.5}
                      stroke={darken(hairColor, 0.05)} strokeWidth="0.9" strokeLinecap="round" />
                    <circle cx={earRX + 1} cy={earCY + 10.5} r="2.4" fill={lighten(hairColor, 0.28)} />
                    <circle cx={earRX + 1} cy={earCY + 10.5} r="1.5" fill={hairColor} />
                  </>
                )}

                {/* Head */}
                <ellipse cx={CX} cy={headCY} rx={headRX} ry={headRY} fill={`url(#${uid}sk)`} />

                {/* Subtle face shading */}
                <ellipse cx={CX - headRX + 3} cy={headCY - 2} rx="4" ry="8" fill={skinDark} opacity="0.09" />
                <ellipse cx={CX + headRX - 3} cy={headCY - 2} rx="4" ry="8" fill={skinDark} opacity="0.09" />
                <ellipse cx={CX - 2} cy={headCY - headRY + 7} rx="5" ry="4" fill="white" opacity="0.08" />
                <ellipse cx={CX} cy={chinY - 1} rx={headRX - 3} ry="4" fill={skinDark} opacity="0.08" />

                {/* Eyebrows */}
                {female ? (
                  <>
                    <path d={`M${CX - 13} ${browY + 1} Q${CX - 8} ${browY - 2} ${CX - 4} ${browY + 1}`}
                      fill="none" stroke={browColor} strokeWidth="1.6" strokeLinecap="round" />
                    <path d={`M${CX + 4} ${browY + 1} Q${CX + 8} ${browY - 2} ${CX + 13} ${browY + 1}`}
                      fill="none" stroke={browColor} strokeWidth="1.6" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d={`M${CX - 14} ${browY} Q${CX - 8} ${browY - 3} ${CX - 4} ${browY + 1}`}
                      fill="none" stroke={browColor} strokeWidth={elder ? 2.1 : child ? 1.6 : 1.9} strokeLinecap="round" />
                    <path d={`M${CX + 4} ${browY + 1} Q${CX + 8} ${browY - 3} ${CX + 14} ${browY}`}
                      fill="none" stroke={browColor} strokeWidth={elder ? 2.1 : child ? 1.6 : 1.9} strokeLinecap="round" />
                  </>
                )}

                {/* ── Left eye ── */}
                <circle cx={CX - 8} cy={eyeY} r={eyeR + 0.6} fill="white" />
                <path d={`M${CX - 8 - eyeR} ${eyeY} A${eyeR + 0.6} ${eyeR + 0.6} 0 0 1 ${CX - 8 + eyeR} ${eyeY}`}
                  fill="rgba(40,15,5,0.10)" />
                <circle cx={CX - 8} cy={eyeY} r={eyeR - 0.8} fill={`url(#${uid}el)`} />
                <circle cx={CX - 8} cy={eyeY} r={eyeR - 2.3} fill="#060100" />
                <circle cx={CX - 9.5} cy={eyeY - 1.6} r="1.5"  fill="white" opacity="0.92" />
                <circle cx={CX - 6.8} cy={eyeY + 1.2} r="0.75" fill="white" opacity="0.46" />
                <path d={`M${CX - 8 - eyeR - 0.5} ${eyeY - 0.4} Q${CX - 8} ${eyeY - eyeR - 1.5} ${CX - 8 + eyeR + 0.5} ${eyeY - 0.4}`}
                  fill="none" stroke="#070100" strokeWidth={female ? 1.7 : 1.3} strokeLinecap="round" />
                {female && (
                  <path d={`M${CX - 8 - eyeR + 1} ${eyeY + 0.5} Q${CX - 8} ${eyeY + eyeR + 0.5} ${CX - 8 + eyeR - 1} ${eyeY + 0.5}`}
                    fill="none" stroke="#070100" strokeWidth="0.8" opacity="0.46" strokeLinecap="round" />
                )}

                {/* ── Right eye ── */}
                <circle cx={CX + 8} cy={eyeY} r={eyeR + 0.6} fill="white" />
                <path d={`M${CX + 8 - eyeR} ${eyeY} A${eyeR + 0.6} ${eyeR + 0.6} 0 0 1 ${CX + 8 + eyeR} ${eyeY}`}
                  fill="rgba(40,15,5,0.10)" />
                <circle cx={CX + 8} cy={eyeY} r={eyeR - 0.8} fill={`url(#${uid}er)`} />
                <circle cx={CX + 8} cy={eyeY} r={eyeR - 2.3} fill="#060100" />
                <circle cx={CX + 6.5} cy={eyeY - 1.6} r="1.5"  fill="white" opacity="0.92" />
                <circle cx={CX + 9.2} cy={eyeY + 1.2} r="0.75" fill="white" opacity="0.46" />
                <path d={`M${CX + 8 - eyeR - 0.5} ${eyeY - 0.4} Q${CX + 8} ${eyeY - eyeR - 1.5} ${CX + 8 + eyeR + 0.5} ${eyeY - 0.4}`}
                  fill="none" stroke="#070100" strokeWidth={female ? 1.7 : 1.3} strokeLinecap="round" />
                {female && (
                  <path d={`M${CX + 8 - eyeR + 1} ${eyeY + 0.5} Q${CX + 8} ${eyeY + eyeR + 0.5} ${CX + 8 + eyeR - 1} ${eyeY + 0.5}`}
                    fill="none" stroke="#070100" strokeWidth="0.8" opacity="0.46" strokeLinecap="round" />
                )}

                {/* Elder crow's feet */}
                {elder && (
                  <>
                    <path d={`M${CX - 8 + eyeR + 0.5} ${eyeY - 0.5} Q${CX - 3} ${eyeY + 2} ${CX - 2} ${eyeY + 5}`}
                      fill="none" stroke={skinDark} strokeWidth="0.7" opacity="0.36" />
                    <path d={`M${CX + 8 - eyeR - 0.5} ${eyeY - 0.5} Q${CX + 3} ${eyeY + 2} ${CX + 2} ${eyeY + 5}`}
                      fill="none" stroke={skinDark} strokeWidth="0.7" opacity="0.36" />
                  </>
                )}

                {/* Nose */}
                <path d={`M${CX - 2.5} ${noseY - 5} Q${CX - 3.8} ${noseY - 1} ${CX - 3.2} ${noseY + 1}`}
                  fill="none" stroke={skinDeep} strokeWidth="0.85" opacity="0.48" strokeLinecap="round" />
                <path d={`M${CX + 2.5} ${noseY - 5} Q${CX + 3.8} ${noseY - 1} ${CX + 3.2} ${noseY + 1}`}
                  fill="none" stroke={skinDeep} strokeWidth="0.85" opacity="0.48" strokeLinecap="round" />
                <circle cx={CX - 3} cy={noseY + 1} r="1.1" fill={skinDeep} opacity="0.20" />
                <circle cx={CX + 3} cy={noseY + 1} r="1.1" fill={skinDeep} opacity="0.20" />

                {/* Lips */}
                <path d={`M${CX - 6.5} ${mouthY} Q${CX - 3} ${mouthY - 3} ${CX} ${mouthY - 1.5} Q${CX + 3} ${mouthY - 3} ${CX + 6.5} ${mouthY}`}
                  fill="none" stroke="#8B3020" strokeWidth={female ? 1.9 : 1.5} strokeLinecap="round" />
                <path d={`M${CX - 5.5} ${mouthY + 0.5} Q${CX} ${mouthY + 5} ${CX + 5.5} ${mouthY + 0.5}`}
                  fill="none" stroke="#8B3020" strokeWidth={female ? 2.1 : 1.7} strokeLinecap="round" />
                <path d={`M${CX - 1.8} ${mouthY + 2} Q${CX} ${mouthY + 4} ${CX + 1.8} ${mouthY + 2}`}
                  fill="none" stroke="rgba(255,210,195,0.20)" strokeWidth="1.2" strokeLinecap="round" />

                {/* Cheek blush */}
                <ellipse cx={CX - headRX + 5} cy={mouthY - 3} rx={child ? 7 : 5.5} ry={child ? 5 : 4}
                  fill="rgba(255,105,75,0.10)" />
                <ellipse cx={CX + headRX - 5} cy={mouthY - 3} rx={child ? 7 : 5.5} ry={child ? 5 : 4}
                  fill="rgba(255,105,75,0.10)" />

                {/* Beard */}
                {hasBeard && (
                  <path
                    d={`M${CX - 9} ${chinY - 9} Q${CX - 5} ${chinY + 1} ${CX} ${chinY + 2} Q${CX + 5} ${chinY + 1} ${CX + 9} ${chinY - 9} Q${CX + 4} ${chinY - 3} ${CX} ${chinY - 2} Q${CX - 4} ${chinY - 3} ${CX - 9} ${chinY - 9} Z`}
                    fill={darken(hairColor, 0.08)} opacity="0.72"
                  />
                )}

                {/* Glasses */}
                {hasGlasses && (
                  <g opacity="0.80">
                    <circle cx={CX - 8} cy={eyeY} r={eyeR + 1.6} fill="none" stroke={eyeColor} strokeWidth="1.3" />
                    <circle cx={CX + 8} cy={eyeY} r={eyeR + 1.6} fill="none" stroke={eyeColor} strokeWidth="1.3" />
                    <path d={`M${CX - 8 + eyeR + 1.6} ${eyeY} L${CX + 8 - eyeR - 1.6} ${eyeY}`}
                      stroke={eyeColor} strokeWidth="1.3" />
                    <path d={`M${CX - 8 - eyeR - 1.6} ${eyeY - 0.5} L${CX - 8 - eyeR - 4.5} ${eyeY - 1}`}
                      stroke={eyeColor} strokeWidth="1.1" />
                    <path d={`M${CX + 8 + eyeR + 1.6} ${eyeY - 0.5} L${CX + 8 + eyeR + 4.5} ${eyeY - 1}`}
                      stroke={eyeColor} strokeWidth="1.1" />
                  </g>
                )}
              </g>
            )}

            {/* ── Portrait ring ── */}
            <circle cx={CX} cy={CY} r={R}
              fill="none" stroke={glowColor}
              strokeWidth={node.isFocal ? 2.4 : 1.1}
              opacity={node.isFocal ? 0.86 : 0.30}
            />
            {node.isFocal && (
              <circle cx={CX} cy={CY} r={R - 5}
                fill="none" stroke={glowColor} strokeWidth="0.5" opacity="0.26" />
            )}

            {/* Sin cuenta */}
            {!node.isJoined && !node.isFocal && !node.isDeceased && (
              <circle cx={CX} cy={CY} r={R + 5}
                fill="none" stroke={glowColor}
                strokeWidth="0.9" strokeDasharray="3 4" opacity="0.40"
              />
            )}

            {/* Selected */}
            {highlighted && !node.isFocal && (
              <circle cx={CX} cy={CY} r={R + 4}
                fill="none" stroke={glowColor} strokeWidth="2.2" opacity="0.70" />
            )}

            {/* Hover */}
            {hovered && !node.isFocal && !highlighted && (
              <circle cx={CX} cy={CY} r={R + 4}
                fill="none" stroke={glowColor} strokeWidth="1.2" opacity="0.26" />
            )}
          </g>

          {/* ── Spiritual overlay — rendered AFTER filter group so they stay luminous ── */}
          {node.isDeceased && (
            <>
              {/* Halo arc above head */}
              <path
                d={`M${CX - R + 3},${headTopY - 3} A${R - 1},${R - 1},0,0,1,${CX + R - 3},${headTopY - 3}`}
                fill="none" stroke="rgba(225,238,255,0.85)" strokeWidth="2.0" strokeLinecap="round"
                style={{ animation: `universeGlowPulse 2.6s ease-in-out ${glowDelay} infinite` }}
              />
              {/* Outer halo ring — wider, subtler */}
              <path
                d={`M${CX - R},${headTopY - 5} A${R + 2},${R + 2},0,0,1,${CX + R},${headTopY - 5}`}
                fill="none" stroke="rgba(200,220,255,0.28)" strokeWidth="0.8" strokeLinecap="round"
              />

              {/* Sparkle star at apex of halo */}
              <g
                transform={`translate(${CX},${headTopY - 12})`}
                style={{ animation: `universeGlowPulse 1.9s ease-in-out ${glowDelay} infinite` }}
              >
                <line x1="0" y1="-5" x2="0" y2="5"   stroke="rgba(255,252,220,0.95)" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="-5" y1="0" x2="5" y2="0"   stroke="rgba(255,252,220,0.95)" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="-3" y1="-3" x2="3" y2="3"  stroke="rgba(255,252,220,0.55)" strokeWidth="0.9" strokeLinecap="round" />
                <line x1="3" y1="-3" x2="-3" y2="3"  stroke="rgba(255,252,220,0.55)" strokeWidth="0.9" strokeLinecap="round" />
              </g>

              {/* Spirit ring 1 — slow clockwise spin */}
              <circle cx={CX} cy={CY} r={R + 9}
                fill="none" stroke="rgba(195,218,255,0.25)" strokeWidth="0.9" strokeDasharray="4 6"
                style={{ animation: `universeSpin 20s linear infinite`, transformOrigin: `${CX}px ${CY}px` }}
              />
              {/* Spirit ring 2 — slow counter-clockwise */}
              <circle cx={CX} cy={CY} r={R + 16}
                fill="none" stroke="rgba(195,218,255,0.13)" strokeWidth="0.6" strokeDasharray="2 8"
                style={{ animation: `universeSpin 32s linear reverse infinite`, transformOrigin: `${CX}px ${CY}px` }}
              />

              {/* 3 orbiting light particles */}
              <circle r="1.6" fill="rgba(235,245,255,0.95)">
                <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${uid}op`} />
                </animateMotion>
              </circle>
              <circle r="1.1" fill="rgba(210,232,255,0.80)">
                <animateMotion dur="7s" begin="-2.3s" repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${uid}op`} />
                </animateMotion>
              </circle>
              <circle r="0.9" fill="rgba(255,245,200,0.85)">
                <animateMotion dur="7s" begin="-4.6s" repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${uid}op`} />
                </animateMotion>
              </circle>
            </>
          )}
        </svg>
      </div>

      {/* ── Text label ── */}
      {(() => {
        const showLabel = labelVisible || hovered || focused || highlighted
        return (
          <div
            style={{
              marginTop: 3,
              lineHeight: 1.2,
              pointerEvents: 'none',
              userSelect: 'none',
              opacity: showLabel ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: node.isDeceased
                  ? 'rgba(210,228,255,0.90)'
                  : node.isFocal ? glowColor : 'rgba(255,255,255,0.92)',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 80,
                margin: '0 auto',
                textShadow: node.isDeceased
                  ? '0 0 8px rgba(180,210,255,0.60)'
                  : node.isFocal ? `0 0 8px ${glowColor}80` : undefined,
              }}
            >
              {node.shortName}
            </div>
            <div
              style={{
                fontSize: 8.5,
                color: node.isDeceased
                  ? 'rgba(180,210,255,0.58)'
                  : node.isFocal ? glowColor : 'rgba(255,255,255,0.48)',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {node.isDeceased ? `✦ ${node.relation || 'descansando'}` : node.isFocal && node.isRoot ? '·' : node.relation}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
