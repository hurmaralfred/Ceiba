import { describe, it, expect } from 'vitest'
import { resolveRelationLabel, computeNodeZIndex } from './useUniverseLayout'

// ─── resolveRelationLabel ─────────────────────────────────────────────────────

describe('resolveRelationLabel', () => {
  it('translates a known raw English key (direct)', () => {
    expect(resolveRelationLabel(null, 'brother')).toBe('Hermano')
  })

  it('translates inferredRelation key via catalog (D1 bug fix)', () => {
    expect(resolveRelationLabel('brother', 'other')).toBe('Hermano')
  })

  it('passes through an already-localized inferredRelation (starts uppercase, no underscores)', () => {
    expect(resolveRelationLabel('Cuñado', 'other')).toBe('Cuñado')
  })

  it('rejects an underscore key as human-readable and falls back to relationType', () => {
    expect(resolveRelationLabel('sister_in_law', 'other')).toBe('Cuñada')
  })

  it('falls back to relationType catalog when inferredRelation is null', () => {
    expect(resolveRelationLabel(null, 'nephew')).toBe('Sobrino')
  })

  it('returns "Familiar" when both inputs are null', () => {
    expect(resolveRelationLabel(null, null)).toBe('Familiar')
  })

  it('returns "Familiar" when both inputs are unknown keys', () => {
    expect(resolveRelationLabel('unknown_key', 'also_unknown')).toBe('Familiar')
  })

  it('inferredRelation catalog match beats relationType catalog', () => {
    // nephew (inferred) should win over father (relationType)
    expect(resolveRelationLabel('nephew', 'father')).toBe('Sobrino')
  })

  it('handles compound keys like sister_in_law', () => {
    expect(resolveRelationLabel(null, 'sister_in_law')).toBe('Cuñada')
  })

  it('handles half_brother', () => {
    expect(resolveRelationLabel('half_brother', null)).toBe('Medio hermano')
  })
})

// ─── computeNodeZIndex ────────────────────────────────────────────────────────

describe('computeNodeZIndex', () => {
  it('focal node always returns 400 regardless of cy', () => {
    expect(computeNodeZIndex(0, 0,   true)).toBe(400)
    expect(computeNodeZIndex(0, 300, true)).toBe(400)
    expect(computeNodeZIndex(1, 0,   true)).toBe(400)
  })

  it('orbit-1 nodes are higher than orbit-2 nodes for the same cy', () => {
    const o1 = computeNodeZIndex(1, 0, false)
    const o2 = computeNodeZIndex(2, 0, false)
    expect(o1).toBeGreaterThan(o2)
  })

  it('orbit-2 nodes are higher than orbit-3 nodes for the same cy', () => {
    const o2 = computeNodeZIndex(2, 0, false)
    const o3 = computeNodeZIndex(3, 0, false)
    expect(o2).toBeGreaterThan(o3)
  })

  it('within the same orbit, higher cy wins (D2 tiebreaker)', () => {
    const zLow  = computeNodeZIndex(1, -100, false)
    const zHigh = computeNodeZIndex(1,  100, false)
    expect(zHigh).toBeGreaterThan(zLow)
  })

  it('orbit-1 bottom never drops below orbit-2 top (bands do not overlap)', () => {
    const o1Bottom = computeNodeZIndex(1, -300, false)  // lowest orbit-1
    const o2Top    = computeNodeZIndex(2,  300, false)  // highest orbit-2
    expect(o1Bottom).toBeGreaterThan(o2Top)
  })

  it('orbit-2 bottom never drops below orbit-3 top', () => {
    const o2Bottom = computeNodeZIndex(2, -300, false)
    const o3Top    = computeNodeZIndex(3,  300, false)
    expect(o2Bottom).toBeGreaterThan(o3Top)
  })

  it('focal (400) beats the maximum selected override (350)', () => {
    // Selected override in AvatarSlot is 350; focal must be higher
    expect(computeNodeZIndex(0, 0, true)).toBeGreaterThan(350)
  })

  it('cy bonus is clamped: values beyond ±300 do not drift out of band', () => {
    const z1 = computeNodeZIndex(1, 1000, false)
    const z2 = computeNodeZIndex(1, -1000, false)
    // Still within orbit-1 band [200, 249]
    expect(z1).toBeGreaterThanOrEqual(200)
    expect(z1).toBeLessThan(250)
    expect(z2).toBeGreaterThanOrEqual(200)
  })
})
