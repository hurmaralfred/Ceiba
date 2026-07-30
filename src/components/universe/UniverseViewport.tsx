'use client'
import React, { useRef, useEffect, useCallback } from 'react'
import type { UniverseNode } from './useUniverseLayout'

interface Props {
  nodes: UniverseNode[]
  onFocusChange: (id: string) => void
  children: React.ReactNode
  /** Extra scale applied to the whole constellation (pinch zoom). Default 1. */
  viewScale?: number
}

// ─── Ambient background: stars + warm glow ───────────────────────────────────

function AmbientLayer({ width, height }: { width: number; height: number }) {
  const stars = useRef<{ x: number; y: number; r: number; a: number }[]>([])

  if (stars.current.length === 0) {
    // Deterministic pseudo-random star field (no Math.random to avoid SSR mismatch)
    for (let i = 0; i < 90; i++) {
      const t = i * 2654.5 // golden ratio hash step
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
      {/* Warm radial glow from center */}
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

      {/* Stars */}
      {stars.current.map((s, i) => (
        <circle
          key={i}
          cx={(s.x / 1200) * width}
          cy={(s.y / 900) * height}
          r={s.r}
          fill="white"
          opacity={s.a}
          style={{ animation: `universeTwinkle ${3 + (i % 4)}s ease-in-out ${-i * 0.3}s infinite` }}
        />
      ))}

      {/* Subtle ground arc hint at bottom */}
      <ellipse
        cx={width / 2} cy={height * 0.92}
        rx={width * 0.35} ry={12}
        fill="rgba(140,90,20,0.06)"
      />
    </svg>
  )
}

// ─── Connection lines ─────────────────────────────────────────────────────────

function ConnectionLines({
  nodes, width, height,
}: { nodes: UniverseNode[]; width: number; height: number }) {
  const focal = nodes.find(n => n.isFocal)
  if (!focal) return null

  const cx = width  / 2
  const cy = height / 2

  // Draw connections only to Tier 1 (intimate circle) — keeps the scene uncluttered
  const orbit1 = nodes.filter(n => n.relevanceTier === 1)

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width={width} height={height}
      aria-hidden
    >
      {orbit1.map(n => {
        const x1 = cx
        const y1 = cy
        const x2 = cx + n.cx
        const y2 = cy + n.cy
        // Bezier: control point pulls toward center of viewport
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

export function UniverseViewport({ nodes, onFocusChange, children, viewScale = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeRef      = useRef({ w: 0, h: 0 })
  const [size, setSize] = React.useState({ w: 375, h: 812 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      sizeRef.current = { w: width, h: height }
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Touch handling: tap to focus, future pinch-zoom
  const handleContainerTap = useCallback((e: React.MouseEvent) => {
    // Let individual avatar onClick handle focus changes
    e.stopPropagation()
  }, [])

  return (
    // Outer clipping container
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#100C08',
        touchAction: 'none',
      }}
      onClick={handleContainerTap}
    >
      {/* Ambient background */}
      <AmbientLayer width={size.w} height={size.h} />

      {/* Connection lines under avatars */}
      <ConnectionLines nodes={nodes} width={size.w} height={size.h} />

      {/* Universe space: all avatars absolutely centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${viewScale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.4s cubic-bezier(0.34,1.22,0.64,1)',
        }}
      >
        {children}
      </div>

      {/* D3: subtle left/right fade — signals avatars extend beyond viewport edges */}
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
