'use client'
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
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

// ─── Ambient background: galaxy nebula + deep star field ─────────────────────

interface StarEntry {
  nx: number; ny: number; r: number; a: number
  twSpeed: number; twPhase: number
  twinkles: boolean; bright: boolean
  rgb: readonly [number, number, number]
}

function generateStarField(): StarEntry[] {
  const stars: StarEntry[] = []

  // Population 1 — micro stars: static background fog
  for (let i = 0; i < 280; i++) {
    const t = i * 2654.5
    stars.push({
      nx: (t * 1.6180339887) % 1, ny: (t * 2.7182818284) % 1,
      r:  0.2 + ((t * 3.1415926535) % 1) * 0.3,
      a:  0.06 + ((t * 1.4142135623) % 1) * 0.18,
      twSpeed: 1, twPhase: 0, twinkles: false, bright: false,
      rgb: [255, 255, 255] as const,
    })
  }

  // Population 2 — normal stars: twinkle + subtle color tints
  const TINTS: readonly (readonly [number, number, number])[] = [
    [255,255,255],[255,255,255],[255,255,255],[255,255,255],[255,255,255],
    [255,255,255],[255,255,255],
    [200, 220, 255],  // blue tint
    [255, 248, 210],  // warm yellow
    [255, 215, 210],  // reddish
  ]
  for (let i = 0; i < 100; i++) {
    const t = (i + 280) * 2654.5
    stars.push({
      nx: (t * 1.6180339887) % 1, ny: (t * 2.7182818284) % 1,
      r:  0.4 + ((t * 3.1415926535) % 1) * 0.8,
      a:  0.18 + ((t * 1.4142135623) % 1) * 0.30,
      twSpeed: 0.3 + ((t * 0.5) % 1) * 0.6,
      twPhase: (t * 7.3890560989) % (Math.PI * 2),
      twinkles: true, bright: false,
      rgb: TINTS[i % 10] as [number, number, number],
    })
  }

  // Population 3 — bright stars: glow halos + vivid twinkle
  const BRIGHT_TINTS: readonly (readonly [number, number, number])[] = [
    [255, 255, 255], [255, 255, 255], [255, 255, 255],
    [225, 240, 255],  // blue-white
    [255, 248, 225],  // warm white
  ]
  for (let i = 0; i < 18; i++) {
    const t = (i + 380) * 2654.5
    stars.push({
      nx: (t * 1.6180339887) % 1, ny: (t * 2.7182818284) % 1,
      r:  1.0 + ((t * 3.1415926535) % 1) * 1.2,
      a:  0.55 + ((t * 1.4142135623) % 1) * 0.35,
      twSpeed: 0.25 + ((t * 0.5) % 1) * 0.4,
      twPhase: (t * 7.3890560989) % (Math.PI * 2),
      twinkles: true, bright: true,
      rgb: BRIGHT_TINTS[i % 5] as [number, number, number],
    })
  }

  return stars
}

// Nebula definitions — driftX/driftY are slow oscillation multipliers (radians/unit-t)
const NEBULAE = [
  { nx: 0.50, ny: 0.45, rFrac: 0.38, aspect: 0.84, rgb: [90,  42,  8] as const, peak: 0.30, dx: 0.031, dy: 0.019, breathe: 0.13 }, // warm amber core
  { nx: 0.18, ny: 0.35, rFrac: 0.30, aspect: 0.83, rgb: [12,  38, 95] as const, peak: 0.23, dx: 0.024, dy: 0.037, breathe: 0.16 }, // deep blue left
  { nx: 0.82, ny: 0.58, rFrac: 0.28, aspect: 0.78, rgb: [55,  15, 90] as const, peak: 0.21, dx: 0.041, dy: 0.022, breathe: 0.14 }, // violet right
  { nx: 0.50, ny: 0.85, rFrac: 0.45, aspect: 0.36, rgb: [65,  25,  5] as const, peak: 0.15, dx: 0.018, dy: 0.029, breathe: 0.10 }, // amber dust horizon
  { nx: 0.50, ny: 0.12, rFrac: 0.32, aspect: 0.44, rgb: [10,  50, 60] as const, peak: 0.13, dx: 0.027, dy: 0.015, breathe: 0.12 }, // teal top wisp
  { nx: 0.28, ny: 0.68, rFrac: 0.22, aspect: 0.82, rgb: [70,  12, 55] as const, peak: 0.13, dx: 0.035, dy: 0.043, breathe: 0.18 }, // magenta lower-left
  { nx: 0.62, ny: 0.38, rFrac: 0.20, aspect: 0.80, rgb: [110, 60, 10] as const, peak: 0.18, dx: 0.022, dy: 0.031, breathe: 0.15 }, // gold dust offset
] as const

interface ShootingStar { x: number; y: number; vx: number; vy: number; life: number; len: number }

function AmbientLayer({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stars = useMemo(() => generateStarField(), [])
  const shootingRef = useRef<ShootingStar | null>(null)
  const nextShootRef = useRef(18 + Math.random() * 20) // first one between 18-38s

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const cx = width  * 0.50
    const cy = height * 0.46
    const D  = Math.max(width, height)
    let t = 0
    let raf: number

    function frame() {
      t += 0.012  // ~0.72 units/s at 60 fps

      // 1. Deep space radial gradient
      const bg = ctx.createRadialGradient(cx, cy * 0.88, 0, cx, cy, D * 0.92)
      bg.addColorStop(0,    '#211008')
      bg.addColorStop(0.20, '#130B12')
      bg.addColorStop(0.50, '#080614')
      bg.addColorStop(0.80, '#050410')
      bg.addColorStop(1,    '#030208')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      // 2. Nebula clouds — additive screen blend + animated drift & breathe
      ctx.globalCompositeOperation = 'screen'
      for (let i = 0; i < NEBULAE.length; i++) {
        const n = NEBULAE[i]
        const driftX = Math.sin(t * n.dx + i * 1.37) * 0.025 * width
        const driftY = Math.cos(t * n.dy + i * 0.91) * 0.020 * height
        const x  = n.nx * width  + driftX
        const y  = n.ny * height + driftY
        const peak = Math.min(0.99, n.peak * (1 + n.breathe * Math.sin(t * 0.07 + i * 1.8)))
        const rx = n.rFrac * D
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(1, n.aspect)
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
        const [r, g, b] = n.rgb
        grd.addColorStop(0,    `rgba(${r},${g},${b},${peak.toFixed(3)})`)
        grd.addColorStop(0.45, `rgba(${r},${g},${b},${(peak * 0.45).toFixed(3)})`)
        grd.addColorStop(0.80, `rgba(${r},${g},${b},${(peak * 0.12).toFixed(3)})`)
        grd.addColorStop(1,    `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      ctx.globalCompositeOperation = 'source-over'

      // 3. Stars — three populations
      for (const s of stars) {
        const x  = s.nx * width
        const y  = s.ny * height
        const tw = s.twinkles
          ? 0.5 + 0.5 * Math.sin(t / s.twSpeed + s.twPhase)
          : 1
        const a = s.a * tw

        if (s.bright) {
          const hR = s.r * 5
          const [r, g, b] = s.rgb
          const glow = ctx.createRadialGradient(x, y, 0, x, y, hR)
          glow.addColorStop(0,   `rgba(${r},${g},${b},${+(a * 0.55).toFixed(3)})`)
          glow.addColorStop(0.4, `rgba(${r},${g},${b},${+(a * 0.15).toFixed(3)})`)
          glow.addColorStop(1,   `rgba(${r},${g},${b},0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, hR, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${+a.toFixed(3)})`
        ctx.fill()
      }

      // 4. Shooting star — spawns periodically, fades in/out
      if (t >= nextShootRef.current && !shootingRef.current) {
        const angle = (0.15 + Math.random() * 0.25) * Math.PI  // downward-right arc
        const speed = 4.5 + Math.random() * 3.5
        shootingRef.current = {
          x: Math.random() * width * 0.7,
          y: Math.random() * height * 0.4,
          vx:  Math.cos(angle) * speed,
          vy:  Math.sin(angle) * speed,
          life: 1,
          len: 60 + Math.random() * 80,
        }
        nextShootRef.current = t + 15 + Math.random() * 22
      }
      const ss = shootingRef.current
      if (ss) {
        ss.x += ss.vx
        ss.y += ss.vy
        ss.life -= 0.022
        if (ss.life <= 0) {
          shootingRef.current = null
        } else {
          const tail = ctx.createLinearGradient(ss.x - ss.vx * 6, ss.y - ss.vy * 6, ss.x, ss.y)
          const a = Math.min(1, ss.life * 2)
          tail.addColorStop(0, `rgba(255,255,240,0)`)
          tail.addColorStop(1, `rgba(255,255,240,${(a * 0.9).toFixed(2)})`)
          ctx.strokeStyle = tail
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(ss.x - ss.vx * (ss.len / ss.vx), ss.y - ss.vy * (ss.len / ss.vx))
          ctx.lineTo(ss.x, ss.y)
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(frame)
    }

    frame()
    return () => cancelAnimationFrame(raf)
  }, [width, height, stars])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden
    />
  )
}

// ─── Connection lines — 3-channel visual system ───────────────────────────────
// blood:    gold solid   — sanguínea
// marriage: blue dashed  — matrimonial
// political: violet dotted — político-legal

const CONN_STYLES = {
  blood:    { stroke: '#F2B43C', dash: '',    width: 0.8, opacity: 0.11 },
  marriage: { stroke: '#7BAFD4', dash: '7 5', width: 0.8, opacity: 0.08 },
  political:{ stroke: '#B8A0D8', dash: '3 7', width: 0.6, opacity: 0.06 },
} as const

function ConnectionLines({ nodes, width, height }: { nodes: UniverseNode[]; width: number; height: number }) {
  const cx = width  / 2
  const cy = height / 2
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  // Build edges: each non-focal node → its orbitParentId
  const edges = nodes
    .filter(n => !n.isFocal && n.orbitParentId)
    .map(n => {
      const parent = nodeById.get(n.orbitParentId!)
      return parent ? { from: parent, to: n, channel: n.connectionChannel } : null
    })
    .filter(Boolean) as Array<{ from: UniverseNode; to: UniverseNode; channel: 'blood' | 'marriage' | 'political' }>

  if (edges.length === 0) return null

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height}
      aria-hidden
    >
      <defs>
        <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {edges.map(({ from, to, channel }, idx) => {
        const x1 = cx + from.cx
        const y1 = cy + from.cy
        const x2 = cx + to.cx
        const y2 = cy + to.cy
        const mx = (x1 + x2) / 2 + (cy - y1) * 0.08
        const my = (y1 + y2) / 2 + (cx - x1) * 0.08
        const d  = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
        const st = CONN_STYLES[channel]
        const lineOpacity = st.opacity
          * (to.isDeceased ? 0.45 : 1)
          * (to.isJoined === false ? 0.75 : 1)
        const pathId = `cp-${from.id.slice(-6)}-${to.id.slice(-6)}`
        const dur = `${3.8 + (idx % 5) * 0.7}s`
        const delay = `${-(idx % 4) * 1.1}s`
        return (
          <g key={`${from.id}-${to.id}`}>
            <path
              id={pathId}
              d={d}
              fill="none"
              stroke={st.stroke}
              strokeWidth={st.width}
              strokeDasharray={st.dash || undefined}
              strokeLinecap="round"
              opacity={lineOpacity}
            />
            {/* Energy particle flowing parent → child */}
            <circle r={1.4} fill={st.stroke} opacity={lineOpacity * 1.4} filter="url(#particle-glow)">
              <animateMotion dur={dur} begin={delay} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${pathId}`}/>
              </animateMotion>
            </circle>
          </g>
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
