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

// ─── Camera ───────────────────────────────────────────────────────────────────

export type CameraState = {
  x: number
  y: number
  scale: number
  focusedPersonId: string
}

const MIN_SCALE    = 0.5   // 0.25 is too small to read labels on any viewport
const MAX_SCALE    = 4.0
const DEFAULT_SCALE = 1.0
const ZOOM_STEP    = 0.25
const NAV_H        = 64    // BottomNav height (keep in sync with UniversePersonPanel)
const PANEL_FRACTION = 0.55 // mobile panel max-height is 55dvh

const INITIAL_CAMERA: CameraState = { x: 0, y: 0, scale: DEFAULT_SCALE, focusedPersonId: 'root' }

// ─── Camera controls ─────────────────────────────────────────────────────────

function CameraControls({
  onZoomIn, onZoomOut, onReset, onBack, onBackToRoot, canBack, isNotRoot,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onBack: () => void
  onBackToRoot: () => void
  canBack: boolean
  isNotRoot: boolean
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 700,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'auto',
    }}>
      {/* Zoom controls grouped */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <CamBtn onClick={onZoomIn}  label="Acercar" icon="+" />
        <CamBtn onClick={onZoomOut} label="Alejar"  icon="−" />
      </div>

      <CamBtn onClick={onReset} label="Centrar" icon="⊙" />

      {canBack && (
        <CamBtn onClick={onBack} label="Volver" icon="←" highlight />
      )}
      {isNotRoot && (
        <CamBtn onClick={onBackToRoot} label="Inicio" icon="⌂" />
      )}
    </div>
  )
}

function CamBtn({
  onClick, label, icon, highlight,
}: {
  onClick: () => void
  label: string
  icon: string
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        minWidth: 48,
        height: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        background: highlight
          ? 'rgba(242,180,60,0.22)'
          : 'rgba(10,8,5,0.90)',
        border: highlight
          ? '1.5px solid rgba(242,180,60,0.70)'
          : '1px solid rgba(242,180,60,0.35)',
        borderRadius: 12,
        color: 'rgba(242,180,60,0.95)',
        fontSize: 16,
        lineHeight: 1,
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
        transition: 'background 0.15s, border-color 0.15s',
        touchAction: 'none',
        userSelect: 'none',
        padding: '4px 8px',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 8, letterSpacing: '0.04em', opacity: 0.8 }}>{label}</span>
    </button>
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
  // ── Single camera source of truth ─────────────────────────────────────────
  const [camera,        setCamera]        = useState<CameraState>(INITIAL_CAMERA)
  const [cameraHistory, setCameraHistory] = useState<CameraState[]>([])

  // focalId derived from camera — single source, no divergence possible
  const focalId = camera.focusedPersonId

  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [containerSize,   setContainerSize]   = useState({ w: 375, h: 812 })
  const [additionalCount, setAdditionalCount] = useState(0)

  // Reset expansion when focal changes
  useEffect(() => { setAdditionalCount(0) }, [focalId])

  const isMobile  = containerSize.w < 768
  const batchSize = isMobile ? BATCH_MOBILE : BATCH_DESKTOP

  // Responsive base scale — narrow screens shrink the whole constellation
  const viewScale = useMemo(() => {
    if (containerSize.w <= 0) return 1
    const halfWidth = containerSize.w / 2
    return halfWidth >= 240 ? 1 : Math.max(0.72, halfWidth / 240)
  }, [containerSize.w])

  const allNodes = useUniverseLayout(focalId, profile, members, extendedMembers, memberLinks, containerSize.w, containerSize.h)

  const { visible: nodes, hiddenCount, maxExpansionReached } = useMemo(
    () => selectVisibleUniverseNodes(allNodes, containerSize.w, additionalCount),
    [allNodes, containerSize.w, additionalCount],
  )

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find(n => n.id === selectedId) ?? null : null),
    [selectedId, nodes],
  )

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

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
  }, [])

  // ── Camera handlers ────────────────────────────────────────────────────────

  // Called by viewport when wheel/drag changes x, y, scale
  const handleCameraChange = useCallback((cam: { x: number; y: number; scale: number }) => {
    setCamera(prev => ({ ...prev, ...cam }))
  }, [])

  // "Centrar aquí" — save current state, switch focal person, center in visible area.
  // After focalId changes the layout recomputes placing the new focal at world (0,0).
  // x=0 centers horizontally. y must account for the panel covering the bottom on mobile:
  //   panelH ≈ PANEL_FRACTION * containerH - NAV_H
  //   yCenterOffset = -panelH / 2  (shift content up so focal lands in the visible zone)
  // On desktop the panel is a side sheet, so y stays 0.
  const handleRefocus = useCallback((id: string) => {
    setCameraHistory(prev => [...prev, camera])
    const isMobileView = containerSize.w < 768
    const panelH = isMobileView
      ? Math.max(0, containerSize.h * PANEL_FRACTION - NAV_H)
      : 0
    const yCenterOffset = isMobileView ? -(panelH / 2) : 0
    setCamera(prev => ({ x: 0, y: yCenterOffset, scale: prev.scale, focusedPersonId: id }))
    setSelectedId(null)
  }, [camera, containerSize])

  // "Volver" — restore previous camera state
  const handleBack = useCallback(() => {
    setCameraHistory(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setCamera(last)
      return prev.slice(0, -1)
    })
    setSelectedId(null)
  }, [])

  // "Volver a mí" — reset to initial state centered on root
  const handleBackToRoot = useCallback(() => {
    setCamera(INITIAL_CAMERA)
    setCameraHistory([])
    setSelectedId(null)
  }, [])

  // Zoom control buttons act around the viewport center (x=0, y=0 offset)
  const handleZoomIn = useCallback(() => {
    setCamera(prev => ({
      ...prev,
      scale: Math.min(MAX_SCALE, parseFloat((prev.scale + ZOOM_STEP).toFixed(3))),
    }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setCamera(prev => ({
      ...prev,
      scale: Math.max(MIN_SCALE, parseFloat((prev.scale - ZOOM_STEP).toFixed(3))),
    }))
  }, [])

  const handleResetView = useCallback(() => {
    setCamera(prev => ({ ...prev, x: 0, y: 0, scale: DEFAULT_SCALE }))
  }, [])

  // ── Avatar interaction ─────────────────────────────────────────────────────

  const handleAvatarClick = useCallback((node: UniverseNode) => {
    if (node.isFocal) return
    setSelectedId(prev => {
      if (prev === node.id) {
        handleRefocus(node.id)
        return null
      }
      return node.id
    })
  }, [handleRefocus])

  const handleClose = useCallback(() => setSelectedId(null), [])

  const handleExpand = useCallback(() => {
    setAdditionalCount(c => c + batchSize)
  }, [batchSize])

  const showExpandButton = (hiddenCount > 0 || maxExpansionReached) && !selectedId
  const canBack   = cameraHistory.length > 0
  const isNotRoot = focalId !== 'root'

  return (
    <>
      <UniverseStyles />

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onClick={handleClose}
      >
        <UniverseViewport
          nodes={nodes}
          camera={camera}
          onCameraChange={handleCameraChange}
          onFocusChange={handleRefocus}
          viewScale={viewScale}
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
        >
          {/* Avatars — inside camera transform layer */}
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

        {/* Panel — outside camera layer, fixed above BottomNav */}
        <UniversePersonPanel
          node={selectedNode}
          onClose={handleClose}
          onRefocus={handleRefocus}
          onEdit={onEditMember}
          onInvite={onInviteMember}
        />

        {/* Camera controls — fixed top-right, outside transform */}
        <CameraControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleResetView}
          onBack={handleBack}
          onBackToRoot={handleBackToRoot}
          canBack={canBack}
          isNotRoot={isNotRoot}
        />

        {/* Expand button — above BottomNav */}
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
