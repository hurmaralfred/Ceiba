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
import type { UniverseNode } from './useUniverseLayout'

// ─── Floating person card ─────────────────────────────────────────────────────

const CARD_CSS = `
@keyframes unvCardIn {
  from { opacity: 0; transform: translate(-50%, calc(-100% + 10px)); }
  to   { opacity: 1; transform: translate(-50%, -100%); }
}
@keyframes unvCardInBelow {
  from { opacity: 0; transform: translate(-50%, -10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
`

interface CardAnchor { x: number; y: number; below: boolean }

function UniversePersonCard({
  node, anchor, onClose, onRefocus, onEdit, onInvite, onAdd,
}: {
  node: UniverseNode
  anchor: CardAnchor
  onClose: () => void
  onRefocus?: (id: string) => void
  onEdit?: (memberId: string) => void
  onInvite?: (memberId: string) => void
  onAdd?: () => void
}) {
  const safeX = Math.max(108, Math.min(anchor.x, (typeof window !== 'undefined' ? window.innerWidth : 390) - 108))

  const baseTransform = anchor.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
  const animName = anchor.below ? 'unvCardInBelow' : 'unvCardIn'

  return (
    <div
      style={{
        position: 'fixed',
        left: safeX,
        top: anchor.below ? anchor.y + 10 : anchor.y - 10,
        transform: baseTransform,
        width: 240,
        zIndex: 700,
        background: 'rgba(6,4,16,0.97)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '0.5px solid rgba(242,180,60,0.24)',
        borderTop: '0.5px solid rgba(242,180,60,0.40)',
        borderRadius: 22,
        boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(242,180,60,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
        padding: '20px 18px 16px',
        animation: `${animName} 0.26s cubic-bezier(0.34,1.22,0.64,1) both`,
        pointerEvents: 'auto',
      }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Relation eyebrow */}
      <div style={{
        fontSize: 9, letterSpacing: '0.14em', fontWeight: 600,
        color: 'rgba(242,180,60,0.65)', textTransform: 'uppercase', marginBottom: 8,
      }}>
        {node.relation}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: '#F5EDD8',
        lineHeight: 1.2, marginBottom: 14,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
      }}>
        {node.name}
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
        {node.isJoined  && <CardChip color="#2A6B3A" text="En Ceiba" />}
        {!node.isJoined && <CardChip color="#5C4A20" text="Sin cuenta" />}
        {node.isDeceased && <CardChip color="#4A4040" text="Fallecido/a" />}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7 }}>
        <CardBtn primary label="Centrar" onClick={() => { onRefocus?.(node.id); onClose() }} />
        {node.memberId && onEdit && (
          <CardBtn label="Editar" onClick={() => { onClose(); onEdit(node.memberId!) }} />
        )}
        {node.memberId && !node.isJoined && onInvite && (
          <CardBtn label="Invitar" onClick={() => { onClose(); onInvite(node.memberId!) }} />
        )}
        {onAdd && (
          <CardBtn label="+ Familiar" onClick={() => { onClose(); onAdd() }} />
        )}
      </div>
    </div>
  )
}

function CardChip({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      background: color + '28', border: `0.5px solid ${color}60`,
      color: 'rgba(255,255,255,0.65)', borderRadius: 20, fontSize: 9,
      padding: '3px 9px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
    }}>{text}</span>
  )
}

function CardBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flex: primary ? 1 : undefined,
      padding: '9px 14px', minHeight: 38,
      borderRadius: 12, cursor: 'pointer',
      border: primary ? '0.5px solid rgba(242,180,60,0.50)' : '0.5px solid rgba(255,255,255,0.12)',
      background: primary ? 'rgba(242,180,60,0.12)' : 'rgba(255,255,255,0.04)',
      color: primary ? '#F2B43C' : 'rgba(255,255,255,0.60)',
      fontSize: 12, fontWeight: primary ? 600 : 400,
      whiteSpace: 'nowrap', letterSpacing: '0.04em',
    }}>{label}</button>
  )
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const UNIVERSE_CSS = `
@keyframes universeSway {
  0%, 100% { transform: rotate(-1.5deg); }
  50%       { transform: rotate( 1.5deg); }
}
@keyframes universeBreathe {
  0%, 100% { transform: scaleY(1);     }
  50%       { transform: scaleY(1.02); }
}
@keyframes universeLook {
  0%, 80%, 100% { transform: rotate(0deg);  }
  85%            { transform: rotate( 9deg); }
  92%            { transform: rotate(-7deg); }
}
@keyframes universeSpin {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes universeTwinkle {
  0%, 100% { opacity: var(--star-a, 0.25); }
  50%       { opacity: calc(var(--star-a, 0.25) * 0.4); }
}
@keyframes universeOrbitPulse {
  0%, 100% { opacity: 0.07; }
  50%       { opacity: 0.13; }
}
@keyframes universeFloat {
  0%, 100% { transform: translateY(0px);  }
  50%       { transform: translateY(-5px); }
}
@keyframes universeAlive {
  0%   { transform: rotate(-3.5deg) translateY(0px);    }
  20%  { transform: rotate(-1.2deg) translateY(-3px);   }
  50%  { transform: rotate( 3.5deg) translateY(0px);    }
  80%  { transform: rotate( 1.2deg) translateY(-3px);   }
  100% { transform: rotate(-3.5deg) translateY(0px);    }
}
@keyframes universeFocalBreathe {
  0%, 100% { transform: scale(1.000); }
  50%       { transform: scale(1.012); }
}
@keyframes universeGlowPulse {
  0%, 100% { opacity: 1;    }
  50%       { opacity: 0.5; }
}
@keyframes universeEmptyFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
}
@keyframes universeTapHintOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="universeSway"],
  [style*="universeBreathe"],
  [style*="universeLook"],
  [style*="universeSpin"],
  [style*="universeTwinkle"],
  [style*="universeOrbitPulse"],
  [style*="universeFloat"],
  [style*="universeAlive"],
  [style*="universeFocalBreathe"],
  [style*="universeGlowPulse"] {
    animation: none !important;
  }
}
`

function UniverseStyles() {
  return <style dangerouslySetInnerHTML={{ __html: UNIVERSE_CSS }} />
}

// ─── Orbit rings (visual guide) ───────────────────────────────────────────────

function OrbitRings({ width, height }: { width: number; height: number }) {
  const cx = width  / 2
  const cy = height / 2
  const radii = [115, 210, 295]
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height}
      aria-hidden
    >
      {radii.map((r, i) => (
        <circle
          key={r}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(242,180,60,0.06)"
          strokeWidth={1}
          strokeDasharray={i === 0 ? '4 8' : '2 10'}
          style={{ animation: `universeOrbitPulse ${4 + i}s ease-in-out ${-i * 1.5}s infinite` }}
        />
      ))}
    </svg>
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
  const [cardAnchor,    setCardAnchor]    = useState<CardAnchor | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 375, h: 812 })
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(new Set())
  const [showTapHint,   setShowTapHint]   = useState(() => {
    try { return !localStorage.getItem('ceiba_tap_hint_seen') } catch { return false }
  })

  useEffect(() => {
    if (!showTapHint) return
    const t = setTimeout(() => {
      setShowTapHint(false)
      try { localStorage.setItem('ceiba_tap_hint_seen', '1') } catch { /* */ }
    }, 4000)
    return () => clearTimeout(t)
  }, [showTapHint])

  // Reset expansion whenever the focal person changes
  useEffect(() => { setExpandedIds(new Set()) }, [focalId])

  // D3: scale down the viewport so orbit-2 avatars (radius 210) clear the edges on narrow screens.
  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const halfWidth = containerSize.w / 2
    return halfWidth >= 240 ? 1 : Math.max(0.72, halfWidth / 240)
  }, [containerSize.w])

  const [showExtended, setShowExtended] = useState(false)

  const allNodes = useUniverseLayout(
    focalId, profile, members, extendedMembers, memberLinks,
  )

  const hasTier2Nodes = useMemo(() => allNodes.some(n => n.relevanceTier === 2), [allNodes])

  // Hide extended family (tier 2) until user taps "Revelar"
  const baseNodes = useMemo(() =>
    showExtended
      ? allNodes
      : allNodes.map(n => n.relevanceTier === 2 ? { ...n, relevanceTier: 3 as const, opacity: 0, scale: 0 } : n),
    [allNodes, showExtended],
  )

  const { visible: nodes, hiddenCount, hiddenNodes: hiddenNodesList, maxExpansionReached } = useMemo(
    () => selectVisibleUniverseNodes(baseNodes, containerSize.w, 0, expandedIds),
    [baseNodes, containerSize.w, expandedIds],
  )

  // The shallowest hop level among all currently hidden nodes.
  // Clicking any "+" reveals all hidden nodes at this level (progressive expansion inward→outward).
  const minHiddenHop = useMemo(() => {
    if (!hiddenNodesList.length) return null
    return Math.min(...hiddenNodesList.map(n => n.hopDistance))
  }, [hiddenNodesList])

  // Track which node IDs are newly entering the visible set (for reveal animation)
  const prevVisibleIds = useRef(new Set<string>())
  const newNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of nodes) {
      if (!prevVisibleIds.current.has(n.id)) ids.add(n.id)
    }
    return ids
  }, [nodes])
  useEffect(() => {
    prevVisibleIds.current = new Set(nodes.map(n => n.id))
  }, [nodes])

  // Track container size for orbit rings
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
  }, [])

  const handleAvatarClick = useCallback((node: UniverseNode, anchor: CardAnchor) => {
    if (node.isFocal) return
    setSelectedNode(prev => {
      if (prev?.id === node.id) { setCardAnchor(null); return null }
      setCardAnchor(anchor)
      return node
    })
  }, [])

  const handleRefocus = useCallback((id: string) => {
    setFocalId(id)
    setSelectedNode(null)
  }, [])

  const handleClose = useCallback(() => { setSelectedNode(null); setCardAnchor(null) }, [])

  // Reveal all hidden nodes at the shallowest hop level (progressive outward expansion)
  const handleExpand = useCallback(() => {
    if (minHiddenHop === null) return
    setExpandedIds(prev => {
      const next = new Set(prev)
      for (const n of hiddenNodesList) {
        if (n.hopDistance === minHiddenHop) next.add(n.id)
      }
      return next
    })
  }, [minHiddenHop, hiddenNodesList])

  const handleCollapse = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  return (
    <>
      <UniverseStyles />
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onClick={handleClose}
      >
        <UniverseViewport nodes={nodes} onFocusChange={handleRefocus} viewScale={viewScale} selectedId={selectedNode?.id}>
          {/* Orbit guide rings (sit behind avatars) */}
          <OrbitRings width={containerSize.w} height={containerSize.h} />

          {/* Avatars */}
          {nodes.map(node => (
            <AvatarSlot
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              dimmed={selectedNode !== null && selectedNode.id !== node.id && !node.isFocal}
              onClick={handleAvatarClick}
              viewScale={viewScale}
              isNew={newNodeIds.has(node.id)}
              showExpand={
                node.isFocal
                  ? (expandedIds.size > 0 || (hiddenCount > 0 && !maxExpansionReached)) && !selectedNode
                  : hiddenCount > 0 && !maxExpansionReached && !selectedNode && expandedIds.size === 0
              }
              isExpanded={node.isFocal && expandedIds.size > 0}
              onExpand={node.isFocal && expandedIds.size > 0 ? handleCollapse : handleExpand}
            />
          ))}
        </UniverseViewport>

        {/* Revelar familia extendida — visible when tier 2 nodes exist and are hidden */}
        {hasTier2Nodes && !showExtended && focalId === 'root' && !selectedNode && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setShowExtended(true) }}
            style={{
              position: 'absolute',
              bottom: 130,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 20,
              background: 'rgba(12,10,24,0.82)',
              border: '1px solid rgba(212,175,55,0.22)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer',
              color: 'rgba(212,175,55,0.75)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              zIndex: 40,
              whiteSpace: 'nowrap',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="rgba(212,175,55,0.6)" strokeWidth="1.5"/>
              <line x1="8" y1="5" x2="8" y2="11" stroke="rgba(212,175,55,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="5" y1="8" x2="11" y2="8" stroke="rgba(212,175,55,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Revelar familia extendida
          </button>
        )}

        {/* Back-to-root pill — visible when a non-root person is the focal */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setFocalId('root'); setExpandedIds(new Set()) }}
          style={{
            position: 'absolute',
            bottom: 90,
            left: '50%',
            transform: `translateX(-50%) translateY(${focalId !== 'root' ? '0' : '12px'})`,
            opacity: focalId !== 'root' ? 1 : 0,
            pointerEvents: focalId !== 'root' ? 'auto' : 'none',
            transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.34,1.2,0.64,1)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px 7px 12px',
            borderRadius: 20,
            background: 'rgba(12,10,24,0.88)',
            border: '1px solid rgba(212,175,55,0.30)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.10)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            color: '#d4af37',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
            zIndex: 40,
            whiteSpace: 'nowrap',
          }}
          aria-label="Volver a mi árbol"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10 12L6 8l4-4" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver a {profile.first_name}
        </button>

        {/* First-visit hint — tap avatar to re-center */}
        {showTapHint && members.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(12,10,24,0.82)',
            border: '1px solid rgba(212,175,55,0.22)',
            backdropFilter: 'blur(8px)',
            animation: 'universeEmptyFadeIn 0.5s ease both, universeTapHintOut 0.5s ease 3.5s both',
            whiteSpace: 'nowrap',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12l7 7 7-7" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em' }}>
              Toca un familiar para ver opciones y re-centrar
            </span>
          </div>
        )}

        {/* Empty-state hint — shown when the user has no family members yet */}
        {members.length === 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              pointerEvents: 'none',
              animation: 'universeEmptyFadeIn 0.8s ease 0.4s both',
            }}
          >
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
              textAlign: 'center',
              lineHeight: 1.55,
              maxWidth: 220,
              margin: 0,
            }}>
              Aquí aparecerá tu familia.<br />Empieza agregando a alguien cercano.
            </p>
            {onAddMember && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onAddMember() }}
                style={{
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 20,
                  background: '#c9a820',
                  border: 'none',
                  borderTop: '2px solid #f5e060',
                  borderBottom: '3px solid #6a5600',
                  boxShadow: '0 4px 0 #4a3c00, 0 8px 20px rgba(0,0,0,0.55)',
                  color: '#030208',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
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

        {/* Floating person card — dismisses on click outside */}
        {selectedNode && cardAnchor && (
          <UniversePersonCard
            node={selectedNode}
            anchor={cardAnchor}
            onClose={handleClose}
            onRefocus={handleRefocus}
            onEdit={onEditMember}
            onInvite={onInviteMember}
            onAdd={onAddMember}
          />
        )}
      </div>
    </>
  )
}

// ─── Avatar slot: positioned absolutely in viewport ───────────────────────────

function AvatarSlot({
  node, selected, dimmed = false, onClick, viewScale = 1, isNew = false, showExpand = false, onExpand, isExpanded = false,
}: {
  node: UniverseNode
  selected: boolean
  dimmed?: boolean
  onClick: (node: UniverseNode, anchor: CardAnchor) => void
  viewScale?: number
  isNew?: boolean
  showExpand?: boolean
  onExpand?: () => void
  isExpanded?: boolean
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  // New nodes enter with fade + scale animation
  const [appeared, setAppeared] = useState(!isNew)
  useEffect(() => {
    if (!appeared) {
      const id = requestAnimationFrame(() => setAppeared(true))
      return () => cancelAnimationFrame(id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (node.isFocal) return
    const rect = divRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const top = rect.top
    const below = top < 180  // too close to top — show card below
    onClick(node, { x: cx, y: below ? rect.bottom : top, below })
  }, [node, onClick])

  return (
    <div
      ref={divRef}
      data-avatar="true"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: '50%',
        top:  '50%',
        transform: `translate(calc(-50% + ${node.cx}px), calc(-50% + ${node.cy}px)) scale(${appeared ? node.scale * (selected ? 1.14 : 1) : node.scale * 0.35})`,
        transformOrigin: 'center center',
        opacity: appeared ? (dimmed ? Math.min(node.opacity * 0.18, 0.18) : node.opacity) : 0,
        zIndex: selected ? 350 : node.zIndex,
        filter: dimmed ? 'blur(0.4px)' : undefined,
        transition: [
          'transform 0.5s cubic-bezier(0.34,1.22,0.64,1)',
          'opacity  0.4s ease',
          'filter   0.4s ease',
        ].join(', '),
      }}
      onClick={e => e.stopPropagation()}
    >
      <AvatarFigure
        node={node}
        onClick={node.isFocal ? undefined : handleClick}
        highlighted={selected}
        hitAreaScale={node.scale * viewScale}
        labelVisible={node.relevanceTier <= 2}
      />
      {showExpand && (
        <button
          data-avatar="true"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onExpand?.() }}
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: isExpanded
              ? 'radial-gradient(circle at 38% 32%, #9b8a3a 0%, #6a5a18 55%, #3a3008 100%)'
              : 'radial-gradient(circle at 38% 32%, #f5e060 0%, #c9a820 55%, #7a5c00 100%)',
            border: '2px solid rgba(3,2,8,0.92)',
            boxShadow: '0 3px 10px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(212,175,55,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 20,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
          aria-label={isExpanded ? 'Colapsar familiares' : 'Mostrar más familiares'}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            {!isExpanded && (
              <line x1="8" y1="3" x2="8" y2="13" stroke="#030208" strokeWidth="2.8" strokeLinecap="round"/>
            )}
            <line x1="3" y1="8" x2="13" y2="8" stroke="#030208" strokeWidth="2.8" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

