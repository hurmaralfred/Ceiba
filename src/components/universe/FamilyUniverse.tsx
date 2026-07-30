'use client'
import React, { useState, useCallback, useMemo } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'
import { useUniverseLayout, selectVisibleUniverseNodes } from './useUniverseLayout'
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
  const [focalId,        setFocalId]        = useState<string>('root')
  const [selectedNode,   setSelectedNode]   = useState<UniverseNode | null>(null)
  const [containerSize,  setContainerSize]  = useState({ w: 375, h: 812 })
  const [showMorePanel,  setShowMorePanel]  = useState(false)

  // D3: scale down the viewport so orbit-2 avatars (radius 210) clear the edges on narrow screens.
  // 240 = orbit-2 radius (210) + half of a scaled avatar (~30). Never scale above 1.0.
  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const halfWidth = containerSize.w / 2
    return halfWidth >= 240 ? 1 : Math.max(0.72, halfWidth / 240)
  }, [containerSize.w])

  const allNodes = useUniverseLayout(
    focalId, profile, members, extendedMembers, memberLinks,
  )

  const { visible: nodes, hiddenCount, hiddenNodes } = useMemo(
    () => selectVisibleUniverseNodes(allNodes, containerSize.w),
    [allNodes, containerSize.w],
  )

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
    // Single tap: open info panel
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const handleRefocus = useCallback((id: string) => {
    setFocalId(id)
    setSelectedNode(null)
    setShowMorePanel(false)
  }, [])

  const handleClose = useCallback(() => setSelectedNode(null), [])

  return (
    <>
      <UniverseStyles />

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <UniverseViewport nodes={nodes} onFocusChange={handleRefocus} viewScale={viewScale}>
          {/* Orbit guide rings (sit behind avatars) */}
          <OrbitRings width={containerSize.w} height={containerSize.h} />

          {/* Avatars */}
          {nodes.map(node => (
            <AvatarSlot
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              onClick={() => handleAvatarClick(node)}
              viewScale={viewScale}
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

        {/* Hidden family indicator — hide when info panel or more panel is open */}
        {hiddenCount > 0 && !showMorePanel && !selectedNode && (
          <HiddenFamilyBadge
            count={hiddenCount}
            onOpen={() => setShowMorePanel(true)}
          />
        )}

        {/* Hidden family panel */}
        {showMorePanel && (
          <HiddenFamilyPanel
            nodes={hiddenNodes}
            onClose={() => setShowMorePanel(false)}
            onRefocus={handleRefocus}
          />
        )}
      </div>
    </>
  )
}

// ─── Hidden family badge ──────────────────────────────────────────────────────

function HiddenFamilyBadge({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label={`Ver ${count} familiares más`}
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(16,12,8,0.88)',
        border: '1px solid rgba(242,180,60,0.32)',
        borderRadius: 24,
        color: 'rgba(242,180,60,0.88)',
        fontSize: 12,
        fontWeight: 500,
        padding: '7px 18px',
        cursor: 'pointer',
        zIndex: 600,
        backdropFilter: 'blur(12px)',
        letterSpacing: '0.025em',
        whiteSpace: 'nowrap',
      }}
    >
      Ver {count} familiares más
    </button>
  )
}

// ─── Hidden family panel ──────────────────────────────────────────────────────

function HiddenFamilyPanel({
  nodes, onClose, onRefocus,
}: {
  nodes: UniverseNode[]
  onClose: () => void
  onRefocus: (id: string) => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.48)',
          zIndex: 700,
        }}
      />
      <div
        role="dialog"
        aria-label="Más familia"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '60%',
          background: '#1C1510',
          borderTop: '1px solid rgba(242,180,60,0.18)',
          borderRadius: '16px 16px 0 0',
          zIndex: 800,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: 'rgba(242,180,60,0.88)', fontSize: 14, fontWeight: 600 }}>
            Más familia ({nodes.length})
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: 22,
              cursor: 'pointer', lineHeight: 1, padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0 16px' }}>
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => node.memberId && onRefocus(node.memberId)}
              disabled={!node.memberId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                cursor: node.memberId ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'rgba(242,180,60,0.45)',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500 }}>
                  {node.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>
                  {node.relation}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Avatar slot: positioned absolutely in viewport ───────────────────────────

function AvatarSlot({
  node, selected, onClick, viewScale = 1,
}: {
  node: UniverseNode
  selected: boolean
  onClick: () => void
  viewScale?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top:  '50%',
        transform: `translate(calc(-50% + ${node.cx}px), calc(-50% + ${node.cy}px)) scale(${node.scale})`,
        transformOrigin: 'center center',
        opacity: node.opacity,
        // D2: selected node rises above all peers except the focal (focal=400)
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
