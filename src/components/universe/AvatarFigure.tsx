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

// ─── Deterministic parameters ─────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

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

const GLOW_COLOR: Record<string, string> = {
  root:       '#F2B43C',
  ancestor:   '#6BDBA4',
  descendant: '#FF7090',
  spouse:     '#B07AFF',
  sibling:    '#60C0FF',
  inlaw:      '#C0A0FF',
  default:    '#80C0A0',
}

const ANCESTOR_RELS   = new Set(['father','mother','grandfather','grandmother',
  'grandfather_paternal','grandmother_paternal','grandfather_maternal',
  'grandmother_maternal','great_grandfather','great_grandmother','uncle','aunt',
  'stepfather','stepmother','father_in_law','mother_in_law'])
const DESCENDANT_RELS = new Set(['son','daughter','grandson','granddaughter',
  'great_grandson','great_granddaughter','nephew','niece','stepson','stepdaughter','stepchild'])
const SPOUSE_RELS     = new Set(['spouse','partner','husband','wife'])
const SIBLING_RELS    = new Set(['brother','sister','half_brother','half_sister','cousin'])
const INLAW_RELS      = new Set(['brother_in_law','sister_in_law','son_in_law','daughter_in_law'])

const FEMALE_RELS = new Set(['mother','grandmother','grandmother_paternal','grandmother_maternal',
  'great_grandmother','aunt','daughter','granddaughter','great_granddaughter','niece',
  'sister','half_sister','wife','partner','stepmother','stepdaughter','sister_in_law',
  'mother_in_law','daughter_in_law'])

function getOutfitKey(node: UniverseNode): string {
  if (node.relationType === 'root')                    return 'root'
  if (ANCESTOR_RELS.has(node.relationType))            return 'ancestor'
  if (DESCENDANT_RELS.has(node.relationType))          return 'descendant'
  if (SPOUSE_RELS.has(node.relationType))              return 'spouse'
  if (SIBLING_RELS.has(node.relationType))             return 'sibling'
  if (INLAW_RELS.has(node.relationType))               return 'inlaw'
  return 'default'
}

function isFemale(node: UniverseNode): boolean {
  const g = node.gender?.toLowerCase() ?? ''
  if (['female', 'f', 'mujer', 'femenino'].includes(g)) return true
  return FEMALE_RELS.has(node.relationType)
}

// ─── Hair ────────────────────────────────────────────────────────────────────

function Hair({ uid, color, female, elder, child }: {
  uid: string; color: string; female: boolean; elder: boolean; child: boolean
}) {
  const clip = `url(#${uid}hc)`
  if (elder && !female) {
    return (
      <path
        d="M12 22 C14 9 46 9 48 22 L46 17 C43 8 17 8 14 17 Z"
        fill={color} opacity="0.55"
      />
    )
  }
  if (female) {
    return (
      <>
        <rect x="7" y="7" width="46" height="26" rx="9" fill={color} clipPath={clip} />
        <path
          d={elder
            ? 'M9 38 C3 50 2 64 6 78 C8 70 9 57 13 50 Z'
            : 'M9 38 C2 56 1 80 6 102 C8 90 10 68 14 56 Z'
          }
          fill={color}
        />
        <path
          d={elder
            ? 'M51 38 C57 50 58 64 54 78 C52 70 51 57 47 50 Z'
            : 'M51 38 C58 56 59 80 54 102 C52 90 50 68 46 56 Z'
          }
          fill={color}
        />
      </>
    )
  }
  // Male / child
  return (
    <rect
      x="7" y="7"
      width="46" height={child ? 24 : 26}
      rx="9"
      fill={color}
      clipPath={clip}
    />
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  node: UniverseNode
  onClick?: () => void
  highlighted?: boolean
  hitAreaScale?: number
  /** When false (Tier 2 nodes), name and relation are hidden until hover/focus. */
  labelVisible?: boolean
}

export function AvatarFigure({ node, onClick, highlighted, hitAreaScale, labelVisible = true }: Props) {
  const rawUid  = useId()
  const uid     = rawUid.replace(/:/g, '_')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const seed   = hashId(node.id)
  const female = isFemale(node)
  const elder  = node.ageGroup === 'elder'
  const child  = node.ageGroup === 'child'
  const oKey   = getOutfitKey(node)

  const skin       = SKIN_TONES[seed % 6]
  const hairColor  = elder ? '#A8A8A8' : HAIR_COLORS[(seed >> 4) % 6]
  const eyeColor   = EYE_COLORS[(seed >> 8) % 6]
  const [shirt, pants] = OUTFIT[oKey]
  const glowColor  = GLOW_COLOR[oKey]
  const shoe       = darken(pants, 0.35)
  const skinLight  = lighten(skin, 0.32)
  const skinDark   = darken(skin, 0.22)
  const shirtLight = lighten(shirt, 0.28)
  const browColor  = elder ? '#888888' : darken(hairColor, 0.15)

  // Animation timing offsets (vary per character so they don't sync)
  const breathDelay = `-${(seed % 35) * 0.1}s`
  const swayDelay   = `-${(seed % 28) * 0.15}s`
  const swayDur     = `${4.0 + (seed % 24) * 0.1}s`
  const floatDelay  = `-${(seed % 32) * 0.12}s`
  const floatDur    = `${3.2 + (seed % 18) * 0.12}s`
  const glowDelay   = `-${(seed % 40) * 0.07}s`

  // Child vs adult geometry
  const isChild    = child
  const totalH     = isChild ? 130 : 168
  const swayOrigin = isChild ? 113 : 137
  const footY      = isChild ? 114 : 137
  const legLen     = isChild ? 26  : 37
  const legStartY  = footY - legLen - 2
  const armY       = isChild ? 64  : 66
  const armH       = isChild ? 18  : 24
  const armPivotY  = isChild ? 73  : 78
  const handCY     = isChild ? 81  : 90
  const torsoBot   = isChild ? 88  : 100
  const torsoCX    = 30
  const torsoMidY  = (62 + torsoBot) / 2
  const glowCY     = footY + 12
  const shadowCY   = footY + 15

  // Minimum 44px tap target after parent CSS scale. outerWidth * scale >= 44.
  const outerWidth = hitAreaScale ? Math.max(60, Math.ceil(44 / hitAreaScale)) : 60

  const isClickable = !node.isFocal && !!onClick
  const showGlow    = node.isFocal || highlighted || hovered

  const deceasedFilter = node.isDeceased ? `url(#${uid}ds)` : undefined
  const dropShadow     = showGlow
    ? `drop-shadow(0 0 ${node.isFocal ? 14 : 7}px ${glowColor}${node.isFocal ? 'dd' : '99'})`
    : undefined

  return (
    <div
      style={{
        position: 'relative',
        width: outerWidth,
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        outline: focused ? `2px solid ${glowColor}` : '2px solid transparent',
        outlineOffset: '3px',
        borderRadius: '4px',
      }}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={isClickable ? () => setHovered(true) : undefined}
      onMouseLeave={isClickable ? () => setHovered(false) : undefined}
      onFocus={isClickable ? () => setFocused(true) : undefined}
      onBlur={isClickable ? () => setFocused(false) : undefined}
      onKeyDown={isClickable ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      } : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      aria-label={isClickable ? `${node.shortName}, ${node.relation}, seleccionar` : undefined}
    >
      {/* Float wrapper: all non-focal characters gently float up/down */}
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
          width={60}
          height={totalH}
          viewBox={`0 0 60 ${totalH}`}
          overflow="visible"
          style={{ display: 'block', margin: '0 auto' }}
          aria-hidden
        >
          <defs>
            {/* Sphere-shaded head (top-left highlight → simulates depth) */}
            <radialGradient id={`${uid}hg`} cx="33%" cy="27%" r="68%">
              <stop offset="0%"   stopColor={skinLight} />
              <stop offset="52%"  stopColor={skin} />
              <stop offset="100%" stopColor={skinDark} />
            </radialGradient>

            {/* Shirt gradient */}
            <radialGradient id={`${uid}sg`} cx="35%" cy="22%" r="82%">
              <stop offset="0%"   stopColor={shirtLight} />
              <stop offset="100%" stopColor={shirt} />
            </radialGradient>

            {/* Glow ring gradient */}
            <radialGradient id={`${uid}gg`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={glowColor} stopOpacity="0.72" />
              <stop offset="55%"  stopColor={glowColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
            </radialGradient>

            {/* Hair clip path (clips to head circle) */}
            <clipPath id={`${uid}hc`}>
              <circle cx="30" cy="30" r="23.5" />
            </clipPath>

            {/* Desaturate filter for deceased */}
            {node.isDeceased && (
              <filter id={`${uid}ds`}>
                <feColorMatrix type="saturate" values="0.1" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.65" />
                </feComponentTransfer>
              </filter>
            )}
          </defs>

          <g filter={deceasedFilter}>
            {/* ── Glow orbital ring (ground platform) ──────────────────── */}
            <ellipse
              cx="30" cy={glowCY} rx="27" ry="9"
              fill={`url(#${uid}gg)`}
              style={{ animation: `universeGlowPulse 2.8s ease-in-out ${glowDelay} infinite` }}
            />
            {/* Ring outline line */}
            <ellipse
              cx="30" cy={glowCY + 0.5} rx="19" ry="4.5"
              fill="none"
              stroke={glowColor}
              strokeWidth="0.75"
              opacity="0.45"
            />

            {/* Ground shadow */}
            <ellipse cx="30" cy={shadowCY} rx="13" ry="3.2" fill="rgba(0,0,0,0.20)" />

            {/* ── Focal ground ring: spins at foot level, not head ─────── */}
            {node.isFocal && (
              <ellipse
                cx="30" cy={glowCY}
                rx="31" ry="12"
                fill="none"
                stroke={glowColor}
                strokeWidth="2.4"
                strokeDasharray="5 4"
                opacity="0.85"
                style={{
                  animation: 'universeSpin 12s linear infinite',
                  transformOrigin: `30px ${glowCY}px`,
                }}
              />
            )}

            {/* ── Sway group: full body rocks from foot pivot ───────────── */}
            <g
              style={{
                transformOrigin: `30px ${swayOrigin}px`,
                animation: `universeSway ${swayDur} ease-in-out ${swayDelay} infinite`,
              }}
            >
              {/* SHOES */}
              <ellipse cx="18" cy={footY} rx={isChild ? 7 : 8} ry={isChild ? 4.2 : 5} fill={shoe} />
              <ellipse cx="42" cy={footY} rx={isChild ? 7 : 8} ry={isChild ? 4.2 : 5} fill={shoe} />

              {/* PANTS / LEGS */}
              <rect x="13" y={legStartY} width="13" height={legLen} rx="5" fill={pants} />
              <rect x="34" y={legStartY} width="13" height={legLen} rx="5" fill={pants} />

              {/* ── Breathe group: torso + arms ──────────────────────────── */}
              <g
                style={{
                  transformOrigin: `${torsoCX}px ${torsoMidY}px`,
                  animation: `universeBreathe 3.8s ease-in-out ${breathDelay} infinite`,
                }}
              >
                {/* Shirt body */}
                <path
                  d={isChild
                    ? `M15 62 Q10 64 10 ${torsoBot} L50 ${torsoBot} Q50 64 45 62 Z`
                    : `M12 64 Q7 68 8 ${torsoBot} L52 ${torsoBot} Q53 68 48 64 Z`
                  }
                  fill={`url(#${uid}sg)`}
                />

                {/* V-neck collar (skin visible between collar opening) */}
                <path
                  d={isChild ? 'M23 62 L30 70 L37 62' : 'M24 64 L30 73 L36 64'}
                  fill="none"
                  stroke={skin}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* LEFT arm + hand */}
                <g transform={`rotate(${isChild ? -10 : -8} 8 ${armPivotY})`}>
                  <rect x="3" y={armY} width="10" height={armH} rx="5" fill={shirt} />
                  <circle cx="5.5" cy={handCY} r="5.2" fill={skin} />
                </g>

                {/* RIGHT arm + hand */}
                <g transform={`rotate(${isChild ? 10 : 8} 52 ${armPivotY})`}>
                  <rect x="47" y={armY} width="10" height={armH} rx="5" fill={shirt} />
                  <circle cx="54.5" cy={handCY} r="5.2" fill={skin} />
                </g>
              </g>

              {/* NECK */}
              <rect
                x="24" y="52"
                width="12" height={isChild ? 11 : 13}
                rx="4"
                fill={skin}
              />

              {/* ── HEAD + FACE (look-around animation) ──────────────────── */}
              <g
                style={{
                  transformOrigin: '30px 30px',
                  animation: `universeLook 9s ease-in-out ${swayDelay} infinite`,
                }}
              >
                {/* Ears */}
                <ellipse cx="8.5" cy="30" rx="3.5" ry="4.5" fill={skin} />
                <ellipse cx="8.5" cy="30" rx="2"   ry="2.8" fill={skinDark} opacity="0.2" />
                <ellipse cx="51.5" cy="30" rx="3.5" ry="4.5" fill={skin} />
                <ellipse cx="51.5" cy="30" rx="2"   ry="2.8" fill={skinDark} opacity="0.2" />

                {/* Head sphere with shading gradient */}
                <circle cx="30" cy="30" r="22" fill={`url(#${uid}hg)`} />

                {/* Hair (clipped to head) */}
                <Hair uid={uid} color={hairColor} female={female} elder={elder} child={child} />

                {/* Eyebrows */}
                <path
                  d="M14.5 22 Q19.5 19 24.5 22"
                  fill="none" stroke={browColor}
                  strokeWidth="1.9" strokeLinecap="round"
                />
                <path
                  d="M35.5 22 Q40.5 19 45.5 22"
                  fill="none" stroke={browColor}
                  strokeWidth="1.9" strokeLinecap="round"
                />

                {/* ── LEFT EYE ── */}
                {/* Sclera (white of eye) */}
                <circle cx="19" cy="28" r="6"   fill="white" />
                {/* Iris (colored) */}
                <circle cx="19.5" cy="28.5" r="4.2" fill={eyeColor} />
                {/* Pupil */}
                <circle cx="19.8" cy="28.8" r="2.5" fill="#080200" />
                {/* Catchlight (upper-left highlight = Pixar signature) */}
                <circle cx="17.6" cy="26.8" r="1.3" fill="white" opacity="0.9" />
                {/* Upper eyelid line */}
                <path
                  d="M13.5 27.5 Q19 24 24.5 27.5"
                  fill="none" stroke="#0A0200"
                  strokeWidth="1.4" strokeLinecap="round"
                />

                {/* ── RIGHT EYE ── */}
                <circle cx="41" cy="28" r="6"   fill="white" />
                <circle cx="40.5" cy="28.5" r="4.2" fill={eyeColor} />
                <circle cx="40.2" cy="28.8" r="2.5" fill="#080200" />
                <circle cx="38.4" cy="26.8" r="1.3" fill="white" opacity="0.9" />
                <path
                  d="M35.5 27.5 Q41 24 46.5 27.5"
                  fill="none" stroke="#0A0200"
                  strokeWidth="1.4" strokeLinecap="round"
                />

                {/* Nose (gentle suggestion) */}
                <path
                  d="M27.5 37.5 Q30 41 32.5 37.5"
                  fill="none" stroke={skinDark}
                  strokeWidth="1.1" strokeLinecap="round"
                />

                {/* Smile / mouth */}
                <path
                  d="M22 44 Q30 51.5 38 44"
                  fill="none" stroke="#6A2818"
                  strokeWidth="1.9" strokeLinecap="round"
                />

                {/* Cheek blush */}
                <circle cx="12.5" cy="37" r="5.5" fill="rgba(255,130,110,0.17)" />
                <circle cx="47.5" cy="37" r="5.5" fill="rgba(255,130,110,0.17)" />

                {/* Highlight ring when selected */}
                {highlighted && !node.isFocal && (
                  <circle
                    cx="30" cy="30" r="25.5"
                    fill="none"
                    stroke={glowColor}
                    strokeWidth="1.8"
                    opacity="0.6"
                  />
                )}

                {/* Hover ring */}
                {hovered && !node.isFocal && !highlighted && (
                  <circle
                    cx="30" cy="30" r="25.5"
                    fill="none"
                    stroke={glowColor}
                    strokeWidth="1.2"
                    opacity="0.35"
                  />
                )}
              </g>
            </g>
          </g>
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
                color: node.isFocal ? glowColor : 'rgba(255,255,255,0.92)',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 72,
                margin: '0 auto',
                textShadow: node.isFocal ? `0 0 8px ${glowColor}80` : undefined,
              }}
            >
              {node.shortName}
            </div>
            <div
              style={{
                fontSize: 8.5,
                color: node.isFocal ? glowColor : 'rgba(255,255,255,0.48)',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {node.isFocal ? '·' : node.relation}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
