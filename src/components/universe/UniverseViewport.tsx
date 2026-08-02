'use client'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { UniverseNode } from './useUniverseLayout'

interface Props {
  nodes: UniverseNode[]
  onFocusChange: (id: string) => void
  children: React.ReactNode
  /** Responsive base scale (not interactive). Default 1. */
  viewScale?: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4.0
const DRAG_THRESHOLD = 6  // px before a press becomes a pan

// ─── Ambient background: stars + warm glow ───────────────────────────────────

function AmbientLayer({ width, height }: { width: number; height: number }) {
  const stars = useRef<{ x: number; y: number; r: number; a: number }[]>([])

  if (stars.current.length === 0) {
    for (let i = 0; i < 90; i++) {
      const t = i * 2654.5
      stars.current.push({
        x: ((t * 1.618) % 1) * 1200,
        y: ((t * 2.718) % 1) * 900,
        r: 0.4 + ((t * 3.14) % 1) * 1.0,
        a: 0.15 + ((t * 1.41) % 1) * 0.4,
      })
    }
  }

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height}
      aria-hidden
    >
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#F2B43C" stopOpacity="0.06" />
          <stop offset="40%"  stopColor="#F2B43C" stopOpacity="0.025" />
          <stop offset="100%" stopColor="#F2B43C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="deepGlow" cx="50%" cy="52%" r="45%">
          <stop offset="0%"   stopColor="#8B3A10" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#8B3A10" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#centerGlow)" />
      <rect width={width} height={height} fill="url(#deepGlow)" />
      {stars.current.map((s, i) => (
        <circle
          key={i}
          cx={(s.x / 1200) * width}
          cy={(s.y / 900)  * height}
          r={s.r}
          fill="white"
          opacity={s.a}
          style={{ animation: `universeTwinkle ${3 + (i % 5)}s ease-in-out ${-i * 0.3}s infinite` }}
        />
      ))}
      <ellipse
        cx={width / 2} cy={height * 0.92}
        rx={width * 0.35} ry={12}
        fill="rgba(140,90,20,0.06)"
      />
    </svg>
  )
}

// ─── Connection lines from focal to Tier-1 nodes ─────────────────────────────

function ConnectionLines({ nodes, width, height }: { nodes: UniverseNode[]; width: number; height: number }) {
  const focal = nodes.find(n => n.isFocal)
  if (!focal) return null
  const cx = width  / 2
  const cy = height / 2
  const x1 = cx + focal.cx
  const y1 = cy + focal.cy
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height}
      aria-hidden
    >
      {nodes
        .filter(n => !n.isFocal && n.relevanceTier === 1)
        .map(n => {
          const x2 = cx + n.cx
          const y2 = cy + n.cy
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const d  = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
          return (
            <path
              key={n.id}
              d={d}
              fill="none"
              stroke="#F2B43C"
              strokeWidth={0.8}
              strokeDasharray="3 6"
              opacity={0.18}
            />
          )
        })}
    </svg>
  )
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

export function UniverseViewport({
  nodes,
  onFocusChange: _onFocusChange,
  children,
  viewScale = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 375, h: 812 })
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 })
  const [grabbing, setGrabbing] = useState(false)

  // Stable ref so wheel handler always sees fresh camera without re-binding
  const cameraRef = useRef(camera)
  useEffect(() => { cameraRef.current = camera }, [camera])

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width  / 2
    const cy = rect.height / 2
    // Offset of cursor from canvas center
    const offsetX = e.clientX - rect.left - cx
    const offsetY = e.clientY - rect.top  - cy

    const cam = cameraRef.current
    // ctrlKey is set by trackpad pinch on macOS
    const factor = e.ctrlKey
      ? Math.exp(-e.deltaY * 0.008)
      : Math.exp(-e.deltaY * 0.0015)
    const rawScale = cam.scale * factor
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale))

    // Keep world-point under cursor fixed
    const ratio = newScale / cam.scale
    const newX  = offsetX - (offsetX - cam.x) * ratio
    const newY  = offsetY - (offsetY - cam.y) * ratio
    setCamera({ x: newX, y: newY, scale: newScale })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Pointer pan ───────────────────────────────────────────────────────────

  const pointerDown  = useRef(false)
  const didDrag      = useRef(false)
  const panOrigin    = useRef({ px: 0, py: 0, cx: 0, cy: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // Don't start pan from avatars, buttons, or the panel
    const t = e.target as HTMLElement
    if (t.closest('button, [role="dialog"], [data-avatar]')) return

    containerRef.current?.setPointerCapture(e.pointerId)
    const cam = cameraRef.current
    panOrigin.current = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y }
    pointerDown.current = true
    didDrag.current = false
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDown.current) return
    const dx = e.clientX - panOrigin.current.px
    const dy = e.clientY - panOrigin.current.py
    if (!didDrag.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      didDrag.current = true
      setGrabbing(true)
    }
    if (didDrag.current) {
      setCamera(prev => ({
        ...prev,
        x: panOrigin.current.cx + dx,
        y: panOrigin.current.cy + dy,
      }))
    }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    pointerDown.current = false
    setGrabbing(false)
  }, [])

  // Intercept clicks that followed a drag so avatar panel doesn't open accidentally
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) {
      didDrag.current = false
      e.stopPropagation()
    }
  }, [])

  const combinedTransform =
    `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale * viewScale})`

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#100C08',
        touchAction: 'none',
        cursor: grabbing ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      {/* Stars / glow — fixed background, no camera transform */}
      <AmbientLayer width={size.w} height={size.h} />

      {/* Camera layer — everything here moves and scales with pan/zoom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: combinedTransform,
          transformOrigin: 'center center',
        }}
      >
        {/* Connection lines in world space */}
        <ConnectionLines nodes={nodes} width={size.w} height={size.h} />

        {/* Avatar slots + orbit rings */}
        {children}
      </div>

      {/* Edge vignette — fixed overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 500,
          background:
            'linear-gradient(to right, rgba(16,12,8,0.6) 0%, transparent 12%, transparent 88%, rgba(16,12,8,0.6) 100%)',
        }}
      />
    </div>
  )
}
