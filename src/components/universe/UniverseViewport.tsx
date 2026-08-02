'use client'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { UniverseNode } from './useUniverseLayout'

interface CameraXYS { x: number; y: number; scale: number }

interface Props {
  nodes: UniverseNode[]
  camera: CameraXYS
  onCameraChange: (cam: CameraXYS) => void
  onFocusChange: (id: string) => void
  children: React.ReactNode
  /** Responsive base scale (not interactive). Default 1. */
  viewScale?: number
  minScale?: number
  maxScale?: number
}

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

const DRAG_THRESHOLD = 6 // px — above this distance a pointer move becomes a drag

export function UniverseViewport({
  nodes,
  camera,
  onCameraChange,
  onFocusChange: _onFocusChange,
  children,
  viewScale = 1,
  minScale = 0.25,
  maxScale = 4.0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 375, h: 812 })

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

  // ── Drag / pan state ──────────────────────────────────────────────────────

  // Whether we're currently in a drag (not just pressed)
  const dragActive   = useRef(false)
  // True if pointer moved past DRAG_THRESHOLD during this press session
  const didDrag      = useRef(false)

  // Single-pointer pan tracking
  const panOrigin    = useRef({ px: 0, py: 0, cx: 0, cy: 0 })

  // Multi-touch pinch tracking
  const touches      = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef     = useRef<{ dist: number; midX: number; midY: number; camScale: number; camX: number; camY: number } | null>(null)

  // Stable camera ref so handlers don't need camera in deps
  const cameraRef    = useRef(camera)
  useEffect(() => { cameraRef.current = camera }, [camera])

  // ── Wheel — zoom around cursor ────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect    = container.getBoundingClientRect()
    const cx      = rect.width  / 2
    const cy      = rect.height / 2
    const offsetX = e.clientX - rect.left - cx
    const offsetY = e.clientY - rect.top  - cy

    const cam = cameraRef.current
    // ctrlKey is set by trackpad pinch gesture on macOS
    const zoomFactor = e.ctrlKey
      ? Math.exp(-e.deltaY * 0.008)   // trackpad pinch — finer
      : Math.exp(-e.deltaY * 0.0015)  // mouse wheel — coarser

    const rawScale = cam.scale * zoomFactor
    const newScale = Math.max(minScale, Math.min(maxScale, rawScale))

    // Keep world point under cursor fixed
    const ratio = newScale / cam.scale
    const newX  = offsetX - (offsetX - cam.x) * ratio
    const newY  = offsetY - (offsetY - cam.y) * ratio

    onCameraChange({ x: newX, y: newY, scale: newScale })
  }, [minScale, maxScale, onCameraChange])

  // Attach wheel listener as non-passive (required to call preventDefault inside viewport)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Pointer — pan + drag detection ───────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return  // left button only for mouse
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (touches.current.size === 1) {
      // Single pointer — prepare pan
      containerRef.current?.setPointerCapture(e.pointerId)
      const cam = cameraRef.current
      panOrigin.current = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y }
      dragActive.current = false
      didDrag.current    = false
    } else if (touches.current.size === 2) {
      // Two pointers — start pinch
      const pts = [...touches.current.values()]
      const dist  = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const midX  = (pts[0].x + pts[1].x) / 2
      const midY  = (pts[0].y + pts[1].y) / 2
      const cam   = cameraRef.current
      pinchRef.current = { dist, midX, midY, camScale: cam.scale, camX: cam.x, camY: cam.y }
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = [...touches.current.values()]
    const container = containerRef.current
    if (!container) return

    if (pts.length >= 2 && pinchRef.current) {
      // ── Pinch zoom ──
      const [p1, p2] = pts
      const dist  = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const midX  = (p1.x + p2.x) / 2
      const midY  = (p1.y + p2.y) / 2

      const pr    = pinchRef.current
      const factor  = dist / pr.dist
      const rawScale = pr.camScale * factor
      const newScale = Math.max(minScale, Math.min(maxScale, rawScale))

      const rect  = container.getBoundingClientRect()
      const cx    = rect.width  / 2
      const cy    = rect.height / 2
      const offsetX = midX - rect.left - cx
      const offsetY = midY - rect.top  - cy
      const ratio = newScale / pr.camScale
      const newX  = offsetX - (offsetX - pr.camX) * ratio
      const newY  = offsetY - (offsetY - pr.camY) * ratio

      onCameraChange({ x: newX, y: newY, scale: newScale })
      didDrag.current = true

    } else if (pts.length === 1) {
      // ── Pan ──
      const dx = e.clientX - panOrigin.current.px
      const dy = e.clientY - panOrigin.current.py

      if (!dragActive.current) {
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          dragActive.current = true
          didDrag.current    = true
        }
      }

      if (dragActive.current) {
        onCameraChange({
          x:     panOrigin.current.cx + dx,
          y:     panOrigin.current.cy + dy,
          scale: cameraRef.current.scale,
        })
      }
    }
  }, [minScale, maxScale, onCameraChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
    try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    if (touches.current.size < 2) pinchRef.current = null
    if (touches.current.size === 0) dragActive.current = false
  }, [])

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
    if (touches.current.size < 2) pinchRef.current = null
    if (touches.current.size === 0) dragActive.current = false
  }, [])

  // Suppress clicks that followed a drag so avatar panels don't open accidentally
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) {
      didDrag.current = false
      e.stopPropagation()
    }
  }, [])

  // Cursor style based on drag state
  const [pointerDown, setPointerDown] = useState(false)
  const cursorStyle = pointerDown && dragActive.current ? 'grabbing' : 'grab'

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
        cursor: cursorStyle,
        userSelect: 'none',
      }}
      onClickCapture={handleClickCapture}
      onPointerDown={e => { setPointerDown(true); handlePointerDown(e) }}
      onPointerMove={handlePointerMove}
      onPointerUp={e => { setPointerDown(false); handlePointerUp(e) }}
      onPointerCancel={e => { setPointerDown(false); handlePointerCancel(e) }}
    >
      {/* Stars / glow — fixed background, does not transform with camera */}
      <AmbientLayer width={size.w} height={size.h} />

      {/* Camera layer — everything here moves and scales with the camera */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: combinedTransform,
          transformOrigin: 'center center',
          transition: 'none', // transitions handled by individual nodes
        }}
      >
        {/* Connection lines drawn in world space */}
        <ConnectionLines nodes={nodes} width={size.w} height={size.h} />

        {/* Avatar slots */}
        {children}
      </div>

      {/* Edge vignette — fixed overlay, above camera layer */}
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
