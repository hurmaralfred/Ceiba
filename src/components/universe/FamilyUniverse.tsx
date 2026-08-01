'use client'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'
import {
  useUniverseLayout,
  selectVisibleUniverseNodes,
  BATCH_MOBILE,
  BATCH_DESKTOP,
} from './useUniverseLayout'
import { AvatarFigure } from './AvatarFigure'
import { UniverseViewport } from './UniverseViewport'
import { UniversePersonPanel } from './UniversePersonPanel'
import type { UniverseNode } from './useUniverseLayout'

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
@keyframes universeGlowPulse {
  0%, 100% { opacity: 1;    }
  50%       { opacity: 0.5; }
}
@media (prefers-reduced-motion: reduce) {
  [style*="universeSway"],
  [style*="universeBreathe"],
  [style*="universeLook"],
  [style*="universeSpin"],
  [style*="universeTwinkle"],
  [style*="universeOrbitPulse"],
  [style*="universeFloat"],
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
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FamilyUniverse({
  profile,
  members,
  extendedMembers = [],
  memberLinks = [],
  onEditMember,
  onInviteMember,
}: Props) {
  const [focalId,        setFocalId]       = useState<string>('root')
  const [selectedId,     setSelectedId]    = useState<string | null>(null)
  const [containerSize,  setContainerSize] = useState({ w: 375, h: 812 })
  const [additionalCount, setAdditionalCount] = useState(0)

  // Reset expansion whenever the focal person changes
  useEffect(() => { setAdditionalCount(0) }, [focalId])

  const isMobile  = containerSize.w < 768
  const batchSize = isMobile ? BATCH_MOBILE : BATCH_DESKTOP

  // D3: scale down the viewport so orbit-2 avatars (radius 210) clear the edges on narrow screens.
  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const halfWidth = containerSize.w / 2
    return halfWidth >= 240 ? 1 : Math.max(0.72, halfWidth / 240)
  }, [containerSize.w])

  const allNodes = useUniverseLayout(
    focalId, profile, members, extendedMembers, memberLinks,
  )

  const { visible: nodes, hiddenCount, maxExpansionReached } = useMemo(
    () => selectVisibleUniverseNodes(allNodes, containerSize.w, additionalCount),
    [allNodes, containerSize.w, additionalCount],
  )

  // Derive selected node from id so state is a plain string, not a stale object reference
  const selectedNode = useMemo(
    () => (selectedId ? nodes.find(n => n.id === selectedId) ?? null : null),
    [selectedId, nodes],
  )

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

  const handleAvatarClick = useCallback((node: UniverseNode) => {
    if (node.isFocal) return
    setSelectedId(prev => {
      if (prev === node.id) {
        // Second tap on the same avatar → refocus
        setFocalId(node.id)
        return null
      }
      return node.id
    })
  }, [])

  const handleRefocus = useCallback((id: string) => {
    setFocalId(id)
    setSelectedId(null)
  }, [])

  const handleClose = useCallback(() => setSelectedId(null), [])

  const handleExpand = useCallback(() => {
    setAdditionalCount(c => c + batchSize)
  }, [batchSize])

  const showExpandButton = (hiddenCount > 0 || maxExpansionReached) && !selectedId

  return (
    <>
      <UniverseStyles />

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onClick={handleClose}
      >
        <UniverseViewport nodes={nodes} onFocusChange={handleRefocus} viewScale={viewScale}>
          {/* Orbit guide rings (sit behind avatars) */}
          <OrbitRings width={containerSize.w} height={containerSize.h} />

          {/* Avatars */}
          {nodes.map(node => (
            <AvatarSlot
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              onClick={() => handleAvatarClick(node)}
              viewScale={viewScale}
              isNew={newNodeIds.has(node.id)}
            />
          ))}
        </UniverseViewport>

        {/* Info panel */}
        <UniversePersonPanel
          node={selectedNode}
          onClose={handleClose}
          onRefocus={handleRefocus}
          onEdit={onEditMember}
          onInvite={onInviteMember}
        />

        {/* Expand button */}
        {showExpandButton && (
          <button
            onClick={maxExpansionReached ? undefined : handleExpand}
            disabled={maxExpansionReached}
            aria-label={
              maxExpansionReached
                ? 'Has alcanzado el límite de avatares visibles'
                : `Ver ${hiddenCount} familiares más`
            }
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: maxExpansionReached
                ? 'rgba(16,12,8,0.60)'
                : 'rgba(16,12,8,0.88)',
              border: '1px solid rgba(242,180,60,0.32)',
              borderRadius: 24,
              color: maxExpansionReached
                ? 'rgba(242,180,60,0.42)'
                : 'rgba(242,180,60,0.88)',
              fontSize: 12,
              fontWeight: 500,
              padding: '7px 18px',
              cursor: maxExpansionReached ? 'default' : 'pointer',
              zIndex: 600,
              backdropFilter: 'blur(12px)',
              letterSpacing: '0.025em',
              whiteSpace: 'nowrap',
            }}
          >
            {maxExpansionReached ? 'Explorar familia completa' : `Ver ${hiddenCount} familiares más`}
          </button>
        )}
      </div>
    </>
  )
}

// ─── Avatar slot: positioned absolutely in viewport ───────────────────────────

function AvatarSlot({
  node, selected, onClick, viewScale = 1, isNew = false,
}: {
  node: UniverseNode
  selected: boolean
  onClick: () => void
  viewScale?: number
  isNew?: boolean
}) {
  // New nodes enter with fade + scale animation
  const [appeared, setAppeared] = useState(!isNew)
  useEffect(() => {
    if (!appeared) {
      const id = requestAnimationFrame(() => setAppeared(true))
      return () => cancelAnimationFrame(id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: '50%',
        top:  '50%',
        transform: `translate(calc(-50% + ${node.cx}px), calc(-50% + ${node.cy}px)) scale(${appeared ? node.scale : node.scale * 0.35})`,
        transformOrigin: 'center center',
        opacity: appeared ? node.opacity : 0,
        zIndex: selected ? 350 : node.zIndex,
        transition: [
          'transform 0.65s cubic-bezier(0.34,1.22,0.64,1)',
          'opacity  0.45s ease',
        ].join(', '),
      }}
    >
      <AvatarFigure
        node={node}
        onClick={node.isFocal ? undefined : onClick}
        highlighted={selected}
        hitAreaScale={node.scale * viewScale}
        labelVisible={node.relevanceTier <= 1}
      />
    </div>
  )
}
