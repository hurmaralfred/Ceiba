'use client'
import React, { useState, useCallback, useMemo } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'
import { useUniverseLayout } from './useUniverseLayout'
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
  const [focalId,       setFocalId]       = useState<string>('root')
  const [selectedNode,  setSelectedNode]  = useState<UniverseNode | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 375, h: 812 })

  // D3: scale down the viewport so orbit-2 avatars (radius 210) clear the edges on narrow screens.
  // 240 = orbit-2 radius (210) + half of a scaled avatar (~30). Never scale above 1.0.
  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const halfWidth = containerSize.w / 2
    return halfWidth >= 240 ? 1 : Math.max(0.72, halfWidth / 240)
  }, [containerSize.w])

  const nodes = useUniverseLayout(
    focalId, profile, members, extendedMembers, memberLinks,
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
        // D3: compensate for viewScale so tap targets stay ≥44px
        hitAreaScale={node.scale * viewScale}
      />
    </div>
  )
}
