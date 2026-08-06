'use client'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'
import {
  useUniverseLayout,
  selectVisibleUniverseNodes,
} from './useUniverseLayout'
import { AvatarFigure } from './AvatarFigure'
import { UniverseViewport } from './UniverseViewport'
import { UniversePersonPanel } from './UniversePersonPanel'
import type { UniverseNode } from './useUniverseLayout'

// ─── Relation category palette ────────────────────────────────────────────────

const RELATION_CATEGORIES: { key: string; label: string; types: string[]; color: string }[] = [
  { key: 'conyuges',     label: 'Cónyuge',       types: ['husband','wife','spouse','partner'],                                      color: '#D46090' },
  { key: 'padres',       label: 'Padres',         types: ['father','mother','parent','stepfather','stepmother'],                      color: '#E8784A' },
  { key: 'hijos',        label: 'Hijos',          types: ['son','daughter','child','stepson','stepdaughter'],                        color: '#4ABA8A' },
  { key: 'hermanos',     label: 'Hermanos',       types: ['brother','sister','sibling','half_brother','half_sister'],                color: '#5AAEE0' },
  { key: 'abuelos',      label: 'Abuelos',        types: ['grandfather','grandmother','grandparent'],                               color: '#F2B43C' },
  { key: 'nietos',       label: 'Nietos',         types: ['grandson','granddaughter','grandchild'],                                 color: '#40B8A8' },
  { key: 'bisabuelos',   label: 'Bisabuelos',     types: ['great_grandfather','great_grandmother'],                                 color: '#D4A020' },
  { key: 'bisnietos',    label: 'Bisnietos',      types: ['great_grandson','great_granddaughter'],                                  color: '#30A090' },
  { key: 'tatarabuelos', label: 'Tatarabuelos',   types: ['great_great_grandfather','great_great_grandmother'],                     color: '#C09040' },
  { key: 'tios',         label: 'Tíos',           types: ['uncle','aunt'],                                                          color: '#9A88DA' },
  { key: 'sobrinos',     label: 'Sobrinos',       types: ['nephew','niece'],                                                        color: '#A878C8' },
  { key: 'primos',       label: 'Primos',         types: ['cousin','cousin_once','cousin_twice'],                                   color: '#7878CA' },
  { key: 'suegros',      label: 'Suegros',        types: ['father_in_law','mother_in_law'],                                         color: '#C09840' },
  { key: 'cunados',      label: 'Cuñados',        types: ['brother_in_law','sister_in_law'],                                        color: '#7098C0' },
  { key: 'otros',        label: 'Otros',          types: [],                                                                        color: '#808090' },
]

function resolveRelCategory(relationType: string | undefined): string {
  if (!relationType) return 'otros'
  const t = relationType.toLowerCase().replace(/-/g, '_')
  for (const cat of RELATION_CATEGORIES) {
    if (cat.key === 'otros') continue
    if (cat.types.some(type => t === type || t.startsWith(type + '_'))) return cat.key
  }
  return 'otros'
}

function nodeHash(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) + id.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const UNIVERSE_CSS = `
@keyframes universeOrbitPulse {
  0%, 100% { opacity: 0.06; }
  50%       { opacity: 0.12; }
}
@keyframes universeGlowPulse {
  0%, 100% { opacity: 1;   }
  50%       { opacity: 0.5; }
}
@keyframes universeEmptyFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
}
@keyframes universeHintIn {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
}
@keyframes universeHintOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes universeGroupBadgeIn {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1);   }
}
@keyframes universeRelLabelIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Free-roaming drift — amplitude 150-170px so nodes genuinely cross orbit zones ── */
/* Hierarchy is expressed by color; position is free. Each path is a wide, smooth loop */
/* that takes ~30s to complete, creating slow, graceful cross-orbit encounters.         */
@keyframes nodeDrift1 {
  0%   { transform: translate(  0px,   0px); }
  14%  { transform: translate(-120px,-150px); }
  30%  { transform: translate( 100px,-160px); }
  48%  { transform: translate( 165px,  30px); }
  64%  { transform: translate(  80px, 160px); }
  80%  { transform: translate(-140px,  90px); }
  92%  { transform: translate(-160px, -60px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift2 {
  0%   { transform: translate(  0px,   0px); }
  12%  { transform: translate( 150px, -80px); }
  28%  { transform: translate(  60px,-165px); }
  46%  { transform: translate(-130px,-110px); }
  62%  { transform: translate(-165px,  50px); }
  78%  { transform: translate( -50px, 160px); }
  90%  { transform: translate( 140px, 100px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift3 {
  0%   { transform: translate(  0px,   0px); }
  16%  { transform: translate(  70px, 160px); }
  32%  { transform: translate( 160px, -20px); }
  50%  { transform: translate(  30px,-160px); }
  66%  { transform: translate(-150px, -80px); }
  82%  { transform: translate(-100px, 140px); }
  94%  { transform: translate(  50px, 100px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift4 {
  0%   { transform: translate(  0px,   0px); }
  18%  { transform: translate(-155px,  60px); }
  35%  { transform: translate( -70px,-155px); }
  52%  { transform: translate( 120px,-140px); }
  68%  { transform: translate( 165px,  70px); }
  84%  { transform: translate(  40px, 160px); }
  94%  { transform: translate(-100px, 110px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift5 {
  0%   { transform: translate(  0px,   0px); }
  20%  { transform: translate(-100px,-140px); }
  38%  { transform: translate(  80px,-160px); }
  56%  { transform: translate( 160px,  50px); }
  72%  { transform: translate(  60px, 155px); }
  86%  { transform: translate(-140px,  80px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift6 {
  0%   { transform: translate(  0px,   0px); }
  15%  { transform: translate( 110px,-155px); }
  32%  { transform: translate(-110px,-120px); }
  50%  { transform: translate(-160px,  40px); }
  65%  { transform: translate( -50px, 160px); }
  80%  { transform: translate( 150px,  90px); }
  92%  { transform: translate( 130px, -80px); }
  100% { transform: translate(  0px,   0px); }
}

/* ── Mobile: reduced drift amplitude ±22px (unique names, picked in JS) ── */
@keyframes nodeDrift1M {
  0%   { transform: translate(  0px,   0px); }
  14%  { transform: translate(-16px, -20px); }
  30%  { transform: translate( 14px, -22px); }
  48%  { transform: translate( 22px,   4px); }
  64%  { transform: translate( 11px,  22px); }
  80%  { transform: translate(-18px,  12px); }
  92%  { transform: translate(-22px,  -8px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift2M {
  0%   { transform: translate(  0px,   0px); }
  12%  { transform: translate( 20px, -11px); }
  28%  { transform: translate(  8px, -22px); }
  46%  { transform: translate(-18px, -15px); }
  62%  { transform: translate(-22px,   7px); }
  78%  { transform: translate( -7px,  22px); }
  90%  { transform: translate( 19px,  14px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift3M {
  0%   { transform: translate(  0px,   0px); }
  16%  { transform: translate( 10px,  22px); }
  32%  { transform: translate( 22px,  -3px); }
  50%  { transform: translate(  4px, -22px); }
  66%  { transform: translate(-20px, -11px); }
  82%  { transform: translate(-14px,  19px); }
  94%  { transform: translate(  7px,  14px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift4M {
  0%   { transform: translate(  0px,   0px); }
  18%  { transform: translate(-21px,   8px); }
  35%  { transform: translate(-10px, -21px); }
  52%  { transform: translate( 16px, -19px); }
  68%  { transform: translate( 22px,  10px); }
  84%  { transform: translate(  5px,  22px); }
  94%  { transform: translate(-14px,  15px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift5M {
  0%   { transform: translate(  0px,   0px); }
  20%  { transform: translate(-14px, -19px); }
  38%  { transform: translate( 11px, -22px); }
  56%  { transform: translate( 22px,   7px); }
  72%  { transform: translate(  8px,  21px); }
  86%  { transform: translate(-19px,  11px); }
  100% { transform: translate(  0px,   0px); }
}
@keyframes nodeDrift6M {
  0%   { transform: translate(  0px,   0px); }
  15%  { transform: translate( 15px, -21px); }
  32%  { transform: translate(-15px, -17px); }
  50%  { transform: translate(-22px,   5px); }
  65%  { transform: translate( -7px,  22px); }
  80%  { transform: translate( 20px,  12px); }
  92%  { transform: translate( 18px, -11px); }
  100% { transform: translate(  0px,   0px); }
}

/* ── Orbital ring spin (used by AvatarFigure) ── */
@keyframes orbitSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── Comet ── */
@keyframes cometFly {
  from { transform: translateX(-700px); opacity: 0; }
  4%   { opacity: 1; }
  88%  { opacity: 0.9; }
  96%  { opacity: 0; }
  to   { transform: translateX(calc(100vw + 700px)); opacity: 0; }
}

/* ── Shooting stars ── */
@keyframes shootStar {
  0%   { transform: translate(0,0) scaleX(0.05); opacity: 0; }
  6%   { transform: scaleX(1); opacity: 1; }
  90%  { opacity: 0.7; }
  100% { transform: translate(320px,135px) scaleX(1); opacity: 0; }
}
@keyframes shootStarB {
  0%   { transform: translate(0,0) scaleX(0.05); opacity: 0; }
  6%   { transform: scaleX(1); opacity: 1; }
  90%  { opacity: 0.7; }
  100% { transform: translate(260px,110px) scaleX(1); opacity: 0; }
}
@keyframes shootStarC {
  0%   { transform: translate(0,0) scaleX(0.05); opacity: 0; }
  6%   { transform: scaleX(1); opacity: 1; }
  90%  { opacity: 0.55; }
  100% { transform: translate(380px,160px) scaleX(1); opacity: 0; }
}

/* ── Cosmic dust ── */
@keyframes dustPulse {
  0%,100% { opacity: 0.04; }
  50%     { opacity: 0.10; }
}
@keyframes dustPulseB {
  0%,100% { opacity: 0.03; }
  50%     { opacity: 0.08; }
}
@keyframes dustDrift {
  0%,100% { transform: translate(0px,0px); }
  50%     { transform: translate(14px,10px); }
}

`

function UniverseStyles() {
  return <style dangerouslySetInnerHTML={{ __html: UNIVERSE_CSS }} />
}

// ─── Orbit rings ──────────────────────────────────────────────────────────────

function OrbitRings({ width, height }: { width: number; height: number }) {
  const cx = width  / 2
  const cy = height / 2
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height} aria-hidden>
      {[115, 210, 295].map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r}
          fill="none" stroke="rgba(242,180,60,0.06)" strokeWidth={1}
          strokeDasharray={i === 0 ? '4 8' : '2 10'}
          style={{ animation: `universeOrbitPulse ${4 + i}s ease-in-out ${-i * 1.5}s infinite` }}
        />
      ))}
    </svg>
  )
}

// ─── Cosmic background: dust clouds + shooting stars ─────────────────────────

interface StarConfig {
  top: string; left: string
  animName: string; dur: number; delay: number
  w: number; rot: number
}

function CosmicBackground() {
  // Deterministic shooting stars so no SSR mismatch
  const stars: StarConfig[] = [
    { top: '12%', left: '5%',  animName: 'shootStar',  dur: 6,  delay: 4,  w: 90,  rot: -22 },
    { top: '38%', left: '60%', animName: 'shootStarB', dur: 5,  delay: 14, w: 70,  rot: -18 },
    { top: '20%', left: '30%', animName: 'shootStarC', dur: 7,  delay: 26, w: 110, rot: -25 },
    { top: '58%', left: '78%', animName: 'shootStar',  dur: 6,  delay: 41, w: 80,  rot: -20 },
    { top: '72%', left: '15%', animName: 'shootStarB', dur: 5,  delay: 55, w: 65,  rot: -17 },
  ]

  const dusts = [
    { top: '8%',  left: '2%',  size: 340, color: '#3020a0', anim: 'dustPulse',  dur: 22, delay: 0  },
    { top: '55%', left: '70%', size: 420, color: '#1830c0', anim: 'dustPulseB', dur: 28, delay: -8 },
    { top: '20%', left: '75%', size: 280, color: '#401880', anim: 'dustPulse',  dur: 18, delay: -4 },
    { top: '65%', left: '5%',  size: 360, color: '#0c2050', anim: 'dustPulseB', dur: 32, delay: -12 },
    { top: '40%', left: '40%', size: 300, color: '#180828', anim: 'dustPulse',  dur: 24, delay: -6 },
  ]

  return (
    <>
      {/* Dust clouds */}
      {dusts.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: d.top, left: d.left,
          width: d.size, height: d.size,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${d.color} 0%, transparent 70%)`,
          filter: 'blur(55px)',
          pointerEvents: 'none',
          animation: `${d.anim} ${d.dur}s ease-in-out ${d.delay}s infinite, dustDrift ${d.dur * 1.4}s ease-in-out ${d.delay}s infinite`,
          willChange: 'opacity, transform',
          zIndex: 1,
        }} />
      ))}

      {/* Shooting stars */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: s.top, left: s.left,
          width: s.w, height: 1.5,
          borderRadius: 2,
          background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.9) 40%, rgba(255,255,240,0.6) 70%, transparent 100%)',
          transform: `rotate(${s.rot}deg)`,
          transformOrigin: 'left center',
          filter: 'drop-shadow(0 0 3px rgba(255,255,200,0.7))',
          pointerEvents: 'none',
          animation: `${s.animName} ${s.dur}s ease-in ${s.delay}s infinite`,
          willChange: 'transform, opacity',
          zIndex: 2,
        }} />
      ))}
    </>
  )
}

// ─── Comet announcement ───────────────────────────────────────────────────────

const COMET_EVENT_LABEL: Record<string, string> = {
  birth: 'Nació', marriage: 'Se casó', death: 'Falleció',
  graduation: 'Se graduó', reunion: 'Reunión', anniversary: 'Aniversario', other: 'Evento',
}

function CometAnnouncement({ topPct = 18 }: { topPct?: number }) {
  const [text, setText] = useState('')

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const evts: any[] = Array.isArray(d) ? d : (d?.events ?? [])
        if (evts.length === 0) return
        const parts = evts.slice(0, 6).map(e => {
          const label = COMET_EVENT_LABEL[e.event_type] ?? 'Evento'
          const year  = e.event_date ? new Date(e.event_date + 'T12:00:00').getFullYear() : ''
          return `${label}: ${e.title}${year ? ` (${year})` : ''}`
        })
        setText(parts.join('   ✦   '))
      })
      .catch(() => {})
  }, [])

  if (!text) return null

  return (
    <div style={{
      position: 'absolute',
      top: `${topPct}%`,
      left: 0, right: 0,
      height: 28,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 6,
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        animation: 'cometFly 88s linear infinite',
        whiteSpace: 'nowrap',
        willChange: 'transform',
      }}>
        {/* Head glow */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: 'radial-gradient(circle, #fff9c0 0%, #f2b43c 40%, transparent 100%)',
          boxShadow: '0 0 12px 4px rgba(242,180,60,0.7), 0 0 3px 1px rgba(255,255,200,0.9)',
          marginRight: 0,
        }} />

        {/* Tail */}
        <div style={{
          width: 60, height: 2, flexShrink: 0,
          background: 'linear-gradient(to left, rgba(242,180,60,0.7) 0%, rgba(242,180,60,0.15) 60%, transparent 100%)',
          filter: 'blur(1px)',
          marginRight: 10,
        }} />

        {/* Text */}
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: 'rgba(242,232,200,0.72)',
          letterSpacing: '0.04em',
          textShadow: '0 0 8px rgba(242,180,60,0.5)',
        }}>
          {text}
        </span>
      </div>
    </div>
  )
}

// ─── Relation palette ─────────────────────────────────────────────────────────

function RelationPalette({
  hiddenByCategory,
  expandedIds,
  onExpandCategory,
  onCollapseCategory,
  onCollapseAll,
}: {
  hiddenByCategory: Map<string, UniverseNode[]>
  expandedIds: Set<string>
  onExpandCategory: (key: string) => void
  onCollapseCategory: (key: string) => void
  onCollapseAll: () => void
}) {
  const [open, setOpen] = useState(false)

  const activeCategories = RELATION_CATEGORIES.filter(cat => hiddenByCategory.has(cat.key))
  const totalHidden = activeCategories.reduce((s, c) => s + (hiddenByCategory.get(c.key)?.length ?? 0), 0)
  const hasExpanded = expandedIds.size > 0

  if (activeCategories.length === 0 && !hasExpanded) return null

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', bottom: 94, left: 12, zIndex: 40 }}
    >
      {/* Expanded panel — slides up from toggle */}
      {open && (
        <div style={{
          marginBottom: 8,
          background: 'rgba(8,6,16,0.93)',
          border: '1px solid rgba(212,175,55,0.18)',
          borderRadius: 14,
          backdropFilter: 'blur(18px)',
          width: 214,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          animation: 'universeGroupBadgeIn 0.2s ease-out both',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 12px 7px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(212,175,55,0.50)',
            }}>
              Familiares ocultos
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', fontSize: 15, lineHeight: 1,
                padding: '0 2px',
              }}
            >×</button>
          </div>

          {/* Category rows */}
          <div style={{ padding: '5px 0' }}>
            {activeCategories.map(cat => {
              const catNodes = hiddenByCategory.get(cat.key)!
              const isCatExpanded = catNodes.every(n => expandedIds.has(n.id))
              return (
                <button
                  key={cat.key}
                  onClick={() => isCatExpanded ? onCollapseCategory(cat.key) : onExpandCategory(cat.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {/* Color dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cat.color, flexShrink: 0,
                    opacity: isCatExpanded ? 0.45 : 1,
                    boxShadow: isCatExpanded ? 'none' : `0 0 6px ${cat.color}80`,
                  }} />
                  {/* Count */}
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isCatExpanded ? 'rgba(255,255,255,0.28)' : cat.color,
                    minWidth: 28, textAlign: 'right', flexShrink: 0,
                  }}>
                    {isCatExpanded ? `−${catNodes.length}` : `+${catNodes.length}`}
                  </span>
                  {/* Label */}
                  <span style={{
                    fontSize: 11, fontWeight: 500, flex: 1,
                    color: isCatExpanded ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)',
                  }}>
                    {cat.label}
                  </span>
                  {/* Expanded tag */}
                  {isCatExpanded && (
                    <span style={{
                      fontSize: 8, color: 'rgba(255,255,255,0.22)',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>visible</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer — collapse all */}
          {hasExpanded && (
            <div style={{ padding: '5px 12px 9px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={onCollapseAll}
                style={{
                  width: '100%', padding: '6px 0',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, cursor: 'pointer',
                  color: 'rgba(255,255,255,0.38)',
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Colapsar todo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle pill */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px 7px 11px', borderRadius: 20,
          background: open ? 'rgba(12,10,24,0.95)' : 'rgba(12,10,24,0.82)',
          border: `1px solid ${open ? 'rgba(212,175,55,0.40)' : 'rgba(212,175,55,0.24)'}`,
          color: 'rgba(212,175,55,0.88)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.55)',
          letterSpacing: '0.03em', whiteSpace: 'nowrap',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        {/* Diamond icon */}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <polygon points="5,0 10,5 5,10 0,5" fill="rgba(212,175,55,0.70)" />
        </svg>
        {totalHidden > 0 ? `${totalHidden} ocultos` : 'Ver grupos'}
        {hasExpanded && !open && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 14, height: 14, borderRadius: '50%',
            background: 'rgba(212,175,55,0.20)',
            fontSize: 8, fontWeight: 800, color: 'rgba(212,175,55,0.65)',
          }}>
            {expandedIds.size}
          </span>
        )}
      </button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  profile: Profile
  members: FamilyMember[]
  extendedMembers?: ExtendedEntry[]
  memberLinks?: MemberLink[]
  onEditMember?: (memberId: string) => void
  onInviteMember?: (memberId: string) => void
  onAddMember?: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FamilyUniverse({
  profile,
  members,
  extendedMembers = [],
  memberLinks = [],
  onEditMember,
  onInviteMember,
  onAddMember,
}: Props) {
  const [focalId,       setFocalId]       = useState<string>('root')
  const [selectedNode,  setSelectedNode]  = useState<UniverseNode | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 375, h: 812 })
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(new Set())
  const [showExtended,  setShowExtended]  = useState(false)

  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem('ceiba_universe_hint') } catch { return true }
  })
  useEffect(() => {
    if (!showHint || members.length === 0) return
    const t = setTimeout(() => {
      setShowHint(false)
      try { localStorage.setItem('ceiba_universe_hint', '1') } catch {}
    }, 4000)
    return () => clearTimeout(t)
  }, [showHint, members.length])

  useEffect(() => { setExpandedIds(new Set()) }, [focalId])

  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const half = containerSize.w / 2
    return half >= 240 ? 1 : Math.max(0.72, half / 240)
  }, [containerSize.w])

  // On narrow screens compress node positions so orbit-2 nodes (315px radius)
  // stay within the viewport. positionScale is applied to cx/cy before render.
  const positionScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const half = containerSize.w / 2
    // Leave 20px margin: orbit-2 (315px) must fit in half-width minus margin
    return half >= 335 ? 1 : Math.min(1, (half - 20) / 315)
  }, [containerSize.w])

  const allNodes = useUniverseLayout(focalId, profile, members, extendedMembers, memberLinks)

  const hasTier2Nodes = useMemo(() => allNodes.some(n => n.relevanceTier === 2), [allNodes])

  const baseNodes = useMemo(() =>
    showExtended
      ? allNodes
      : allNodes.map(n => n.relevanceTier === 2 ? { ...n, relevanceTier: 3 as const, opacity: 0, scale: 0 } : n),
    [allNodes, showExtended],
  )

  const { visible: rawNodes, maxExpansionReached } = useMemo(
    () => selectVisibleUniverseNodes(baseNodes, containerSize.w, 0, expandedIds),
    [baseNodes, containerSize.w, expandedIds],
  )

  // Apply positionScale so nodes don't fly off screen on narrow viewports
  const nodes = useMemo(() =>
    positionScale === 1
      ? rawNodes
      : rawNodes.map(n => ({ ...n, cx: n.cx * positionScale, cy: n.cy * positionScale })),
    [rawNodes, positionScale],
  )

  // Stable list of all naturally-hidden nodes (without expansion override)
  // Used to build the category palette — doesn't change as user expands groups
  const { hiddenNodes: allHiddenNodes } = useMemo(
    () => selectVisibleUniverseNodes(baseNodes, containerSize.w, 0, new Set()),
    [baseNodes, containerSize.w],
  )

  const hiddenByCategory = useMemo(() => {
    const map = new Map<string, UniverseNode[]>()
    for (const n of allHiddenNodes) {
      const key = resolveRelCategory(n.relationType)
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return map
  }, [allHiddenNodes])

  const prevVisibleIds = useRef(new Set<string>())
  const newNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of nodes) { if (!prevVisibleIds.current.has(n.id)) ids.add(n.id) }
    return ids
  }, [nodes])
  useEffect(() => { prevVisibleIds.current = new Set(nodes.map(n => n.id)) }, [nodes])

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
  }, [])

  const handleAvatarClick = useCallback((node: UniverseNode) => {
    if (node.isFocal) return
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const handleRefocus = useCallback((id: string) => {
    setFocalId(id)
    setSelectedNode(null)
  }, [])

  const handleClose = useCallback(() => setSelectedNode(null), [])

  const handleExpandCategory = useCallback((categoryKey: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      for (const n of allHiddenNodes) {
        if (resolveRelCategory(n.relationType) === categoryKey) next.add(n.id)
      }
      return next
    })
  }, [allHiddenNodes])

  const handleCollapseCategory = useCallback((categoryKey: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      for (const n of allHiddenNodes) {
        if (resolveRelCategory(n.relationType) === categoryKey) next.delete(n.id)
      }
      return next
    })
  }, [allHiddenNodes])

  const handleCollapse = useCallback(() => setExpandedIds(new Set()), [])

  return (
    <>
      <UniverseStyles />

      <div
        ref={containerRef}
        className="unv-allow-anim"
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        onClick={handleClose}
      >
        {/* ── Cosmic background ── */}
        <CosmicBackground />

        {/* ── Comet with family events ── */}
        <CometAnnouncement topPct={18} />

        <UniverseViewport
          nodes={nodes}
          onFocusChange={handleRefocus}
          viewScale={viewScale}
          selectedId={selectedNode?.id}
        >
          <OrbitRings width={containerSize.w} height={containerSize.h} />
          {nodes.map(node => (
            <AvatarSlot
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              dimmed={!!selectedNode && selectedNode.id !== node.id && !node.isFocal}
              onClick={handleAvatarClick}
              isNew={newNodeIds.has(node.id)}
              isMobile={containerSize.w < 600}
            />
          ))}
        </UniverseViewport>

        {/* ── Relation palette ────────────────────────────────────────────── */}
        {!selectedNode && (
          <RelationPalette
            hiddenByCategory={hiddenByCategory}
            expandedIds={expandedIds}
            onExpandCategory={handleExpandCategory}
            onCollapseCategory={handleCollapseCategory}
            onCollapseAll={handleCollapse}
          />
        )}

        {/* ── Revelar familia extendida ────────────────────────────────────── */}
        {hasTier2Nodes && !showExtended && focalId === 'root' && !selectedNode && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setShowExtended(true) }}
            style={{
              position: 'absolute', bottom: 130, left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 22,
              background: 'rgba(12,10,24,0.88)',
              border: '1px solid rgba(212,175,55,0.28)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(12px)',
              cursor: 'pointer',
              color: 'rgba(212,175,55,0.85)',
              fontSize: 12, fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              zIndex: 40, whiteSpace: 'nowrap',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5"/>
              <line x1="8" y1="5" x2="8" y2="11" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="5" y1="8" x2="11" y2="8" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Ver familia extendida
          </button>
        )}

        {/* ── Back-to-root pill ── */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setFocalId('root'); setExpandedIds(new Set()) }}
          style={{
            position: 'absolute', bottom: 90, left: '50%',
            transform: `translateX(-50%) translateY(${focalId !== 'root' ? '0' : '14px'})`,
            opacity: focalId !== 'root' ? 1 : 0,
            pointerEvents: focalId !== 'root' ? 'auto' : 'none',
            transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px 8px 14px', borderRadius: 22,
            background: 'rgba(12,10,24,0.92)',
            border: '1px solid rgba(212,175,55,0.35)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer', color: '#d4af37',
            fontSize: 13, fontWeight: 600,
            zIndex: 40, whiteSpace: 'nowrap',
          }}
          aria-label="Volver a mi árbol"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10 12L6 8l4-4" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver a {profile.first_name}
        </button>

        {/* ── First-time hint ── */}
        {showHint && members.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 96, left: '50%',
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 22,
            background: 'rgba(12,10,24,0.88)',
            border: '1px solid rgba(212,175,55,0.22)',
            backdropFilter: 'blur(10px)',
            animation: 'universeHintIn 0.4s ease both, universeHintOut 0.5s ease 3.5s both',
            whiteSpace: 'nowrap',
            zIndex: 42,
          }}>
            <span style={{ fontSize: 14 }}>👆</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              Toca un familiar para ver quién es
            </span>
          </div>
        )}

        {/* ── Empty state ── */}
        {members.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            pointerEvents: 'none',
            animation: 'universeEmptyFadeIn 0.8s ease 0.4s both',
          }}>
            <p style={{
              fontSize: 14, color: 'rgba(255,255,255,0.50)',
              textAlign: 'center', lineHeight: 1.6, maxWidth: 220, margin: 0,
            }}>
              Aquí aparecerá tu familia.<br />Empieza agregando a alguien cercano.
            </p>
            {onAddMember && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onAddMember() }}
                style={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 22,
                  background: '#c9a820',
                  border: 'none',
                  borderTop: '2px solid #f5e060', borderBottom: '3px solid #6a5600',
                  boxShadow: '0 4px 0 #4a3c00, 0 8px 20px rgba(0,0,0,0.55)',
                  color: '#030208', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <line x1="8" y1="2" x2="8" y2="14" stroke="#030208" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="#030208" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Agregar primer familiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom sheet panel — OUTSIDE the container div ── */}
      <UniversePersonPanel
        node={selectedNode}
        onClose={handleClose}
        onRefocus={handleRefocus}
        onEdit={onEditMember}
        onInvite={onInviteMember}
        onAdd={onAddMember}
      />
    </>
  )
}

// ─── Avatar slot ──────────────────────────────────────────────────────────────

const DRIFT_NAMES   = ['nodeDrift1','nodeDrift2','nodeDrift3','nodeDrift4','nodeDrift5','nodeDrift6']
const DRIFT_NAMES_M = ['nodeDrift1M','nodeDrift2M','nodeDrift3M','nodeDrift4M','nodeDrift5M','nodeDrift6M']

function AvatarSlot({
  node, selected, dimmed = false, onClick, isNew = false, isMobile = false,
}: {
  node: UniverseNode
  selected: boolean
  dimmed?: boolean
  onClick: (node: UniverseNode) => void
  isNew?: boolean
  isMobile?: boolean
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [appeared, setAppeared] = useState(!isNew)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!appeared) {
      const id = requestAnimationFrame(() => setAppeared(true))
      return () => cancelAnimationFrame(id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!node.isFocal) onClick(node)
  }, [node, onClick])

  // Deterministic drift variant & timing per node
  // 28-42s duration so 150-170px sweeps are slow & graceful, not frenetic
  const hash    = nodeHash(node.id)
  const driftPool = isMobile ? DRIFT_NAMES_M : DRIFT_NAMES
  const driftName = driftPool[hash % driftPool.length]
  const driftDur  = 60 + (hash % 15)          // 60–74 s — half speed
  const driftDel  = -((hash % 35))             // -0 to -34 s offset — fully staggered phases

  return (
    <div
      ref={divRef}
      data-avatar="true"
      style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: `translate(calc(-50% + ${node.cx}px), calc(-50% + ${node.cy}px)) scale(${appeared ? node.scale * (selected ? 1.12 : 1) : node.scale * 0.3})`,
        transformOrigin: 'center center',
        opacity: appeared ? (dimmed ? Math.min(node.opacity * 0.18, 0.18) : node.opacity) : 0,
        zIndex: selected ? 350 : node.zIndex,
        filter: dimmed ? 'blur(0.5px)' : undefined,
        transition: 'transform 0.28s ease-out, opacity 0.30s ease-out, filter 0.28s ease-out',
        cursor: node.isFocal ? 'default' : 'pointer',
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Inner wrapper carries the drift animation; paused on hover for this node only */}
      <div style={{
        animation: node.isFocal ? 'none' : `${driftName} ${driftDur}s ease-in-out ${driftDel}s infinite`,
        animationPlayState: hovered ? 'paused' : 'running',
        willChange: 'transform',
      }}>
        {/* Relation label above */}
        {!node.isFocal && node.relation && (
          <div style={{
            position: 'absolute',
            bottom: '100%', left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 4,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(6,4,16,0.78)',
            border: '0.5px solid rgba(242,180,60,0.22)',
            color: 'rgba(242,180,60,0.70)',
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            whiteSpace: 'nowrap', pointerEvents: 'none',
            animation: 'universeRelLabelIn 0.4s ease both',
            userSelect: 'none',
          }}>
            {node.relation}
          </div>
        )}

        {/* Name below */}
        <div style={{
          position: 'absolute',
          top: '100%', left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 5,
          color: node.isFocal ? 'rgba(242,220,120,0.95)' : 'rgba(255,255,255,0.75)',
          fontSize: node.isFocal ? 12 : 10,
          fontWeight: node.isFocal ? 700 : 500,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
        }}>
          {node.shortName || node.name?.split(' ')[0]}
        </div>

        <AvatarFigure
          node={node}
          highlighted={selected}
        />
      </div>
    </div>
  )
}
