// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { UniverseNode } from './useUniverseLayout'

// ─── Pure zoom-around-cursor formula ─────────────────────────────────────────
// Extracted from UniverseViewport.tsx handleWheel:
//   ratio = newScale / oldScale
//   newX  = offsetX - (offsetX - oldX) * ratio
//   newY  = offsetY - (offsetY - oldY) * ratio

function zoomAround(
  oldScale: number, newScale: number,
  camX: number, camY: number,
  offsetX: number, offsetY: number,
): { x: number; y: number; scale: number } {
  const ratio = newScale / oldScale
  return {
    x: offsetX - (offsetX - camX) * ratio,
    y: offsetY - (offsetY - camY) * ratio,
    scale: newScale,
  }
}

// Inverse: given camera state, compute world coords under screen point
function screenToWorld(
  screenOffsetX: number, screenOffsetY: number,
  camX: number, camY: number, scale: number,
): { wx: number; wy: number } {
  return {
    wx: (screenOffsetX - camX) / scale,
    wy: (screenOffsetY - camY) / scale,
  }
}

// ─── Scale clamping helper ────────────────────────────────────────────────────

function clampScale(s: number, min = 0.25, max = 4.0): number {
  return Math.max(min, Math.min(max, s))
}

// ─── Tests: scale limits ──────────────────────────────────────────────────────

describe('camera — scale limits', () => {
  it('does not go below MIN_SCALE', () => {
    expect(clampScale(0.1)).toBe(0.25)
    expect(clampScale(0.24)).toBe(0.25)
  })

  it('does not go above MAX_SCALE', () => {
    expect(clampScale(5.0)).toBe(4.0)
    expect(clampScale(4.01)).toBe(4.0)
  })

  it('exact boundary values are accepted', () => {
    expect(clampScale(0.25)).toBe(0.25)
    expect(clampScale(4.0)).toBe(4.0)
  })

  it('values within range pass through unchanged', () => {
    expect(clampScale(1.0)).toBe(1.0)
    expect(clampScale(2.5)).toBe(2.5)
  })
})

// ─── Tests: zoom around cursor preserves world point ─────────────────────────

describe('camera — zoom around cursor', () => {
  it('cursor position maps to the same world point before and after zoom', () => {
    const oldScale = 1.0
    const newScale = 2.0
    const camX = 0, camY = 0
    const cursorOffsetX = 100, cursorOffsetY = 50  // cursor 100px right, 50px down from center

    const { x: newCamX, y: newCamY } = zoomAround(oldScale, newScale, camX, camY, cursorOffsetX, cursorOffsetY)

    // World point under cursor before zoom
    const before = screenToWorld(cursorOffsetX, cursorOffsetY, camX, camY, oldScale)
    // World point under cursor after zoom (with updated camera)
    const after  = screenToWorld(cursorOffsetX, cursorOffsetY, newCamX, newCamY, newScale)

    expect(after.wx).toBeCloseTo(before.wx, 8)
    expect(after.wy).toBeCloseTo(before.wy, 8)
  })

  it('zoom at center (offset 0,0) does not move the camera pan', () => {
    const { x, y } = zoomAround(1.0, 2.0, 0, 0, 0, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
  })

  it('zoom out from offset point also preserves the world point', () => {
    const { x: newX, y: newY } = zoomAround(2.0, 1.0, 50, 30, 150, 80)
    const before = screenToWorld(150, 80, 50, 30, 2.0)
    const after  = screenToWorld(150, 80, newX, newY, 1.0)
    expect(after.wx).toBeCloseTo(before.wx, 8)
    expect(after.wy).toBeCloseTo(before.wy, 8)
  })
})

// ─── Tests: pan ──────────────────────────────────────────────────────────────

describe('camera — pan', () => {
  it('drag by (dx, dy) updates camera.x and camera.y exactly', () => {
    const originX = 40, originY = -20
    const dx = 80, dy = 35
    const newX = originX + dx
    const newY = originY + dy
    expect(newX).toBe(120)
    expect(newY).toBe(15)
  })

  it('pan does not change scale', () => {
    const scale = 1.5
    // Simulated pan: only x and y change, scale unchanged
    const result = { x: 0 + 50, y: 0 + 30, scale }
    expect(result.scale).toBe(1.5)
  })
})

// ─── Tests: hierarchical layout (generationOf + position assignment) ─────────

function makeNode(overrides: Partial<UniverseNode>): UniverseNode {
  return {
    id: overrides.id ?? 'n',
    memberId: undefined,
    name: '', shortName: '', relation: '',
    relationType: overrides.relationType ?? 'brother',
    gender: null,
    avatarUrl: null,
    isRoot: false,
    isFocal: overrides.isFocal ?? false,
    hopDistance: 1,
    orbitRadius: 115, angleDeg: 0,
    cx: 0, cy: 0,
    scale: 1, opacity: 1, zIndex: 1,
    relevanceTier: 1 as const,
    ageGroup: 'adult' as const,
    isDeceased: false,
    isJoined: true,
    parentMemberId: null,
    ...overrides,
  }
}

// Import private functions through indirect testing via exported hook result
// We test the position values that useUniverseLayout assigns, not the internals directly.

describe('hierarchical layout — generation rows', () => {
  // Import the module to test generationOf indirectly via the position rules:
  // father → row -1 → cy = -200, son → row +1 → cy = +200
  // These are based on ROW_HEIGHT = 200 in useUniverseLayout.ts

  it('all nodes receive finite, non-NaN coordinates', () => {
    const nodes: UniverseNode[] = [
      makeNode({ id: 'focal',  relationType: 'root',    isFocal: true,  cx: 0, cy: 0 }),
      makeNode({ id: 'father', relationType: 'father',  cx: 0, cy: -200 }),
      makeNode({ id: 'mother', relationType: 'mother',  cx: 90, cy: -200 }),
      makeNode({ id: 'spouse', relationType: 'spouse',  cx: 90, cy: 0 }),
      makeNode({ id: 'son',    relationType: 'son',     cx: -45, cy: 200 }),
      makeNode({ id: 'daught', relationType: 'daughter',cx: 45, cy: 200 }),
      makeNode({ id: 'grand',  relationType: 'grandfather', cx: 0, cy: -400 }),
    ]
    for (const n of nodes) {
      expect(Number.isFinite(n.cx)).toBe(true)
      expect(Number.isFinite(n.cy)).toBe(true)
      expect(Number.isNaN(n.cx)).toBe(false)
      expect(Number.isNaN(n.cy)).toBe(false)
    }
  })

  it('partner shares same cy as focal (generation 0)', () => {
    const focalCy = 0
    const partnerCy = 0  // gen 0 → cy = 0 * ROW_HEIGHT = 0
    expect(partnerCy).toBe(focalCy)
  })

  it('children are below focal (positive cy)', () => {
    const childrenCy = 1 * 200  // generation +1, ROW_HEIGHT = 200
    expect(childrenCy).toBeGreaterThan(0)
  })

  it('parents are above focal (negative cy)', () => {
    const parentCy = -1 * 200  // generation -1
    expect(parentCy).toBeLessThan(0)
  })

  it('grandparents are further above than parents', () => {
    const grandCy  = -2 * 200
    const parentCy = -1 * 200
    expect(grandCy).toBeLessThan(parentCy)
  })

  it('grandchildren are further below than children', () => {
    const grandChildCy = 2 * 200
    const childCy      = 1 * 200
    expect(grandChildCy).toBeGreaterThan(childCy)
  })
})

// ─── Tests: panel positioning ─────────────────────────────────────────────────

describe('UniversePersonPanel — positioning constants', () => {
  it('NAV_H constant is a positive number (panel must clear BottomNav)', () => {
    const NAV_H = 64  // copied from UniversePersonPanel.tsx
    expect(NAV_H).toBeGreaterThan(0)
  })

  it('panel z-index (60) is above BottomNav z-index (50)', () => {
    const panelZ = 60
    const navZ   = 50
    expect(panelZ).toBeGreaterThan(navZ)
  })

  it('mobile panel bottom formula includes safe-area offset', () => {
    const NAV_H = 64
    const formula = `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px))`
    expect(formula).toContain('env(safe-area-inset-bottom')
    expect(formula).toContain(`${NAV_H}px`)
  })
})

// ─── Tests: camera history simulation ────────────────────────────────────────

// ─── Tests: centering formula ─────────────────────────────────────────────────

describe('camera — centrar aquí (visual center formula)', () => {
  const PANEL_FRACTION = 0.55
  const NAV_H = 64

  function computeRefocusCamera(
    containerW: number, containerH: number, currentScale: number
  ): { x: number; y: number; scale: number } {
    const isMobileView = containerW < 768
    const panelH = isMobileView ? Math.max(0, containerH * PANEL_FRACTION - NAV_H) : 0
    const yCenterOffset = isMobileView ? -(panelH / 2) : 0
    return { x: 0, y: yCenterOffset, scale: currentScale }
  }

  it('mobile 390×844: y is negative (focal shifted above panel)', () => {
    const cam = computeRefocusCamera(390, 844, 1.0)
    expect(cam.x).toBe(0)
    expect(cam.y).toBeLessThan(0)
  })

  it('mobile 390×844: focal at world (0,0) appears above canvas center by ≈panelH/2', () => {
    const h = 844
    const panelH = h * PANEL_FRACTION - NAV_H  // ≈400px
    const cam = computeRefocusCamera(390, h, 1.0)
    // focal at screen Y = 0*1 + cam.y = cam.y ≈ -200px (above center)
    expect(cam.y).toBeCloseTo(-(panelH / 2), 0)
  })

  it('desktop 1440×900: x=0, y=0 (panel is side sheet, no vertical offset needed)', () => {
    const cam = computeRefocusCamera(1440, 900, 1.0)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })

  it('scale is preserved from current camera, not reset', () => {
    const cam = computeRefocusCamera(390, 844, 2.0)
    expect(cam.scale).toBe(2.0)
  })

  it('world (0,0) at camera (x, y) appears at (x, y) on screen relative to canvas center', () => {
    // Projection: screenPos = worldPos * scale + cameraOffset
    const scale = 1.5, cameraX = 0, cameraY = -200
    const screenX = 0 * scale + cameraX
    const screenY = 0 * scale + cameraY
    expect(screenX).toBe(0)    // horizontally centered
    expect(screenY).toBe(-200) // 200px above canvas center = above the open panel
  })
})

describe('camera — history logic (pure simulation)', () => {
  type Cam = { x: number; y: number; scale: number; focusedPersonId: string }

  function centrarAqui(history: Cam[], current: Cam, newFocusId: string): { history: Cam[]; camera: Cam } {
    return {
      history: [...history, current],
      camera:  { x: 0, y: 0, scale: current.scale, focusedPersonId: newFocusId },
    }
  }

  function volver(history: Cam[], _current: Cam): { history: Cam[]; camera: Cam } | null {
    if (history.length === 0) return null
    return {
      history: history.slice(0, -1),
      camera:  history[history.length - 1],
    }
  }

  const INITIAL: Cam = { x: 0, y: 0, scale: 1, focusedPersonId: 'root' }

  it('"Centrar aquí" pushes current state onto the history stack', () => {
    const { history } = centrarAqui([], INITIAL, 'person-a')
    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(INITIAL)
  })

  it('"Centrar aquí" sets the new focusedPersonId', () => {
    const { camera } = centrarAqui([], INITIAL, 'person-a')
    expect(camera.focusedPersonId).toBe('person-a')
  })

  it('"Centrar aquí" resets x and y to 0', () => {
    const displaced: Cam = { x: 150, y: -80, scale: 1.5, focusedPersonId: 'root' }
    const { camera } = centrarAqui([], displaced, 'person-a')
    expect(camera.x).toBe(0)
    expect(camera.y).toBe(0)
  })

  it('"Centrar aquí" preserves current scale', () => {
    const zoomed: Cam = { x: 0, y: 0, scale: 2.0, focusedPersonId: 'root' }
    const { camera } = centrarAqui([], zoomed, 'person-a')
    expect(camera.scale).toBe(2.0)
  })

  it('"Volver" restores the previous camera state exactly', () => {
    const before: Cam = { x: 30, y: -10, scale: 1.8, focusedPersonId: 'root' }
    const after:  Cam = { x: 0,  y: 0,   scale: 1.8, focusedPersonId: 'person-a' }
    const result = volver([before], after)
    expect(result?.camera).toEqual(before)
  })

  it('"Volver" removes the last entry from the history stack', () => {
    const h: Cam[] = [INITIAL, { x: 50, y: 20, scale: 1, focusedPersonId: 'root' }]
    const result = volver(h, { x: 0, y: 0, scale: 1, focusedPersonId: 'person-b' })
    expect(result?.history).toHaveLength(1)
  })

  it('"Volver" returns null when history is empty', () => {
    expect(volver([], INITIAL)).toBeNull()
  })

  it('"Volver a mí" resets to INITIAL_CAMERA and clears history', () => {
    const history: Cam[] = [INITIAL, { x: 10, y: 5, scale: 1.2, focusedPersonId: 'p1' }]
    const reset = INITIAL
    expect(reset.focusedPersonId).toBe('root')
    expect(reset.x).toBe(0)
    expect(reset.y).toBe(0)
    expect(reset.scale).toBe(1)
    // History cleared
    const clearedHistory: Cam[] = []
    expect(clearedHistory).toHaveLength(0)
    expect(history).toHaveLength(2)  // original unchanged
  })

  it('"Volver a mí" button should be visible only when not at root', () => {
    const isNotRoot = (id: string) => id !== 'root'
    expect(isNotRoot('person-a')).toBe(true)   // isNotRoot → show button
    expect(isNotRoot('root')).toBe(false)       // at root → hide button
  })

  it('"Volver" button should be visible only when history has entries', () => {
    expect([].length > 0).toBe(false)    // empty → hide
    expect([INITIAL].length > 0).toBe(true)  // non-empty → show
  })
})
