'use client'
import React, { useId, useState, useCallback } from 'react'
import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import type { UniverseNode } from './useUniverseLayout'

// ─── White background removal ─────────────────────────────────────────────────
// Runs once per sprite load; makes near-white pixels transparent so PNGs
// that DALL-E generated with solid white bg blend into the dark canvas.
function stripWhiteBg(img: HTMLImageElement): string {
  try {
    const c = document.createElement('canvas')
    c.width  = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const id = ctx.getImageData(0, 0, c.width, c.height)
    const d  = id.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      if (r > 230 && g > 230 && b > 230) {
        d[i + 3] = 0                                     // fully transparent
      } else if (r > 190 && g > 190 && b > 190) {
        const w = ((r + g + b) / 765 - 190 / 255) * 5   // soft edge
        d[i + 3] = Math.round(d[i + 3] * (1 - w))
      }
    }
    ctx.putImageData(id, 0, 0)
    return c.toDataURL('image/png')
  } catch {
    return img.src   // CORS or other error — use original
  }
}

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

const GLOW_COLOR: Record<string, string> = {
  root:       '#F2B43C',
  ancestor:   '#F2B43C',
  descendant: '#F2B43C',
  sibling:    '#F2B43C',
  spouse:     '#7BAFD4',
  inlaw:      '#B8A0D8',
  default:    '#B8A0D8',
}

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

// ─── Sprite selection ─────────────────────────────────────────────────────────
// Maps node characteristics → /public/avatars/avatar_{age}_{gender}_{variant}.png
// Falls back to DiceBear avataaars if file not found (onError).

function getSpriteUrl(node: UniverseNode, seed: number): string {
  const age     = node.ageGroup === 'elder' ? 'elder' : node.ageGroup === 'child' ? 'child' : 'adult'
  const gender  = isFemale(node) ? 'f' : 'm'
  const variant = (seed % 2) + 1
  return `/avatars/avatar_${age}_${gender}_${variant}.png`
}

function getDicebearUri(node: UniverseNode, seed: number): string {
  try {
    const BG = ['0a0618','060d1a','0d0620','080318','101030']
    const avatar = createAvatar(avataaars, {
      seed: node.id,
      size: 72,
      backgroundColor: [BG[seed % BG.length]],
    })
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatar.toString())}`
  } catch {
    return ''
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  node: UniverseNode
  onClick?: () => void
  highlighted?: boolean
  hitAreaScale?: number
  labelVisible?: boolean
}

// ─── Sprite dimensions (must match GalaxyOrbitView overlay positioning) ───────
export const SPRITE_W = 72
export const SPRITE_H = 144

// ─── Component ────────────────────────────────────────────────────────────────

export function AvatarFigure({ node, onClick, highlighted, hitAreaScale, labelVisible = true }: Props) {
  const rawUid = useId()
  const uid    = rawUid.replace(/:/g, '_')
  const [hovered,      setHovered]      = useState(false)
  const [focused,      setFocused]      = useState(false)
  const [spriteFailed, setSpriteFailed] = useState(false)
  const [cleanSrc,     setCleanSrc]     = useState<string | null>(null)

  const handleSpriteLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setCleanSrc(stripWhiteBg(e.currentTarget))
  }, [])

  const seed       = hashId(node.id)
  const oKey       = getOutfitKey(node)
  const glowColor  = GLOW_COLOR[oKey]
  const glowRgb    = GLOW_RGB[glowColor] ?? '200,180,140'

  const hasRealPhoto = !!node.avatarUrl && !node.avatarConfig
  // Sprite mode: full-body PNG from /public/avatars/
  const useSprite    = !hasRealPhoto && !spriteFailed
  const imgSrc       = hasRealPhoto ? (node.avatarUrl ?? '') : getSpriteUrl(node, seed)
  const fallbackUri  = getDicebearUri(node, seed)

  const floatDelay = `-${(seed % 40) * 0.17}s`
  const floatDur   = `${4.2 + (seed % 24) * 0.13}s`
  const glowDelay  = `-${(seed % 40) * 0.07}s`

  const isClickable = !node.isFocal && !!onClick
  const showGlow    = node.isFocal || highlighted || hovered
  const showLabel   = labelVisible || hovered || focused || highlighted

  const glowFilter = showGlow
    ? highlighted && !node.isFocal
      ? `drop-shadow(0 0 26px ${glowColor}ff) drop-shadow(0 0 60px ${glowColor}55)`
      : `drop-shadow(0 0 ${node.isFocal ? 22 : 10}px ${glowColor}${node.isFocal ? 'ff' : '99'})`
    : `drop-shadow(0 0 5px ${glowColor}33)`

  const deceasedFilter = node.isDeceased
    ? 'grayscale(0.80) brightness(0.70) sepia(0.15) hue-rotate(195deg)'
    : undefined

  const combinedFilter = [deceasedFilter, glowFilter].filter(Boolean).join(' ')

  const labelColor = node.isDeceased
    ? 'rgba(210,228,255,0.90)'
    : node.isFocal ? glowColor : 'rgba(255,255,255,0.88)'

  // ── Deceased spiritual overlay (halo arc + sparkle, rendered as SVG) ────────
  const DeceasedOverlay = node.isDeceased ? (
    <svg
      width={SPRITE_W} height={30}
      viewBox={`0 0 ${SPRITE_W} 30`}
      style={{ position:'absolute', top:-28, left:0, pointerEvents:'none', overflow:'visible' }}
      aria-hidden
    >
      <path
        d={`M8,20 A28,28,0,0,1,64,20`}
        fill="none" stroke="rgba(225,238,255,0.80)" strokeWidth="1.8" strokeLinecap="round"
        style={{ animation: `universeGlowPulse 2.6s ease-in-out ${glowDelay} infinite` }}
      />
      <g transform="translate(36,6)" style={{ animation: `universeGlowPulse 1.9s ease-in-out ${glowDelay} infinite` }}>
        <line x1="0" y1="-5" x2="0" y2="5"  stroke="rgba(255,252,220,0.95)" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="-5" y1="0" x2="5" y2="0"  stroke="rgba(255,252,220,0.95)" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="-3" y1="-3" x2="3" y2="3" stroke="rgba(255,252,220,0.55)" strokeWidth="0.9" strokeLinecap="round" />
        <line x1="3" y1="-3" x2="-3" y2="3" stroke="rgba(255,252,220,0.55)" strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </svg>
  ) : null

  return (
    <div
      style={{
        position: 'relative',
        width: SPRITE_W,
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        outline: focused ? `2px solid ${glowColor}` : '2px solid transparent',
        outlineOffset: '4px',
        borderRadius: useSprite ? '0' : '50%',
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
      {/* Float + glow wrapper */}
      <div
        style={{
          position: 'relative',
          animation: node.isFocal
            ? 'universeFocalBreathe 4.2s ease-in-out infinite'
            : `universeAlive ${floatDur} ease-in-out ${floatDelay} infinite`,
          filter: combinedFilter,
          transition: 'filter 0.3s ease',
          willChange: 'transform',
          transformOrigin: 'center bottom',
        }}
      >
        {DeceasedOverlay}

        {useSprite ? (
          // ── Full-body Pixar-style sprite ──────────────────────────────────
          <img
            src={cleanSrc ?? imgSrc}
            alt={node.shortName}
            draggable={false}
            onLoad={handleSpriteLoad}
            onError={() => setSpriteFailed(true)}
            style={{
              display: 'block',
              width: SPRITE_W,
              height: SPRITE_H,
              objectFit: 'contain',
              objectPosition: 'bottom center',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        ) : (
          // ── Circular fallback: real photo or DiceBear ─────────────────────
          <svg
            width={72} height={84}
            viewBox="0 0 72 84"
            overflow="visible"
            style={{ display:'block', margin:'0 auto' }}
            aria-hidden
          >
            <defs>
              <clipPath id={`${uid}pc`}><circle cx={36} cy={36} r={32} /></clipPath>
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
                <filter id={`${uid}ds`} colorInterpolationFilters="sRGB">
                  <feColorMatrix type="saturate" values="0.1" />
                  <feColorMatrix type="matrix" values="
                    0.82 0.06 0.14 0 0.07
                    0.06 0.82 0.14 0 0.07
                    0.06 0.08 0.88 0 0.12
                    0    0    0    0.52 0
                  " />
                </filter>
              )}
            </defs>

            <g filter={node.isDeceased ? `url(#${uid}ds)` : undefined}>
              {/* Orbital glow */}
              <ellipse cx={36} cy={79} rx={42} ry={10}
                fill={`url(#${uid}gg)`} opacity={0.55}
                style={{ animation: `universeGlowPulse 2.8s ease-in-out ${glowDelay} infinite` }}
              />

              {node.isFocal && (
                <circle cx={36} cy={36} r={39}
                  fill="none" stroke={glowColor}
                  strokeWidth="2" strokeDasharray="5 4" opacity="0.76"
                  style={{ animation:'universeSpin 12s linear infinite', transformOrigin:'36px 36px' }}
                />
              )}

              {/* Portrait circle */}
              <circle cx={36} cy={36} r={32} fill={`url(#${uid}bg)`} />
              <image
                href={spriteFailed ? fallbackUri : (node.avatarUrl ?? undefined)}
                x={4} y={4} width={64} height={64}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${uid}pc)`}
              />
              <circle cx={36} cy={36} r={30}
                fill="none" stroke="rgba(0,0,0,0.22)"
                strokeWidth="6" clipPath={`url(#${uid}pc)`}
              />
              <circle cx={36} cy={36} r={32}
                fill="none" stroke={glowColor}
                strokeWidth={node.isFocal ? 2.4 : 1.1}
                opacity={node.isFocal ? 0.86 : 0.30}
              />
              {!node.isJoined && !node.isFocal && !node.isDeceased && (
                <circle cx={36} cy={36} r={37}
                  fill="none" stroke={glowColor}
                  strokeWidth="0.9" strokeDasharray="3 4" opacity="0.40"
                />
              )}
              {highlighted && !node.isFocal && (
                <circle cx={36} cy={36} r={36}
                  fill="none" stroke={glowColor} strokeWidth="2.2" opacity="0.70"
                />
              )}
            </g>
          </svg>
        )}
      </div>

      {/* ── Text label ─────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: useSprite ? 2 : 10,
          lineHeight: 1.5,
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: showLabel ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        <div
          style={{
            fontSize: node.isFocal ? 13 : 11,
            fontWeight: node.isFocal ? 600 : 400,
            color: labelColor,
            letterSpacing: '0.06em',
            overflow: 'hidden',
            maxWidth: node.isFocal ? 120 : 80,
            margin: '0 auto',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            textShadow: node.isDeceased
              ? '0 0 10px rgba(180,210,255,0.70)'
              : node.isFocal
                ? `0 0 12px ${glowColor}90`
                : highlighted
                  ? `0 0 10px ${glowColor}80`
                  : '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          {node.shortName.split(' ')[0]}
        </div>
        {(highlighted || hovered || focused) && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 300,
              color: node.isDeceased
                ? 'rgba(180,210,255,0.55)'
                : `${glowColor}99`,
              letterSpacing: '0.10em',
              whiteSpace: 'nowrap',
              marginTop: 1,
              textTransform: 'uppercase',
            }}
          >
            {node.isDeceased
              ? `✦ ${node.relation || 'descansando'}`
              : node.isFocal && node.isRoot ? '' : node.relation}
          </div>
        )}
      </div>
    </div>
  )
}
