import { describe, it, expect } from 'vitest'
import {
  resolveRelationLabel,
  computeNodeZIndex,
  resolveRelevanceTier,
  selectVisibleUniverseNodes,
  resolveRelationFromFocal,
  resolveRelationFromPerspective,
  BATCH_MOBILE,
  BATCH_DESKTOP,
  MAX_EXPANDED_MOBILE,
  MAX_EXPANDED_DESKTOP,
} from './useUniverseLayout'
import type { UniverseNode } from './useUniverseLayout'

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

// ─── resolveRelevanceTier ─────────────────────────────────────────────────────

describe('resolveRelevanceTier', () => {
  it('focal → Tier 0', () => {
    expect(resolveRelevanceTier('father', 0, true)).toBe(0)
    expect(resolveRelevanceTier('root',   0, true)).toBe(0)
  })

  it('spouse at hop=1 → Tier 1', () => {
    expect(resolveRelevanceTier('wife',    1, false)).toBe(1)
    expect(resolveRelevanceTier('husband', 1, false)).toBe(1)
    expect(resolveRelevanceTier('spouse',  1, false)).toBe(1)
    expect(resolveRelevanceTier('partner', 1, false)).toBe(1)
  })

  it('father/mother at hop=1 → Tier 1', () => {
    expect(resolveRelevanceTier('father', 1, false)).toBe(1)
    expect(resolveRelevanceTier('mother', 1, false)).toBe(1)
  })

  it('son/daughter at hop=1 → Tier 1', () => {
    expect(resolveRelevanceTier('son',      1, false)).toBe(1)
    expect(resolveRelevanceTier('daughter', 1, false)).toBe(1)
  })

  it('stepparent/stepchild at hop=1 → Tier 1', () => {
    expect(resolveRelevanceTier('stepfather',   1, false)).toBe(1)
    expect(resolveRelevanceTier('stepmother',   1, false)).toBe(1)
    expect(resolveRelevanceTier('stepson',      1, false)).toBe(1)
    expect(resolveRelevanceTier('stepdaughter', 1, false)).toBe(1)
  })

  it('brother/sister at hop=1 → Tier 2', () => {
    expect(resolveRelevanceTier('brother',      1, false)).toBe(2)
    expect(resolveRelevanceTier('sister',       1, false)).toBe(2)
    expect(resolveRelevanceTier('half_brother', 1, false)).toBe(2)
    expect(resolveRelevanceTier('half_sister',  1, false)).toBe(2)
  })

  it('grandparents at hop=1 → Tier 2', () => {
    expect(resolveRelevanceTier('grandfather',           1, false)).toBe(2)
    expect(resolveRelevanceTier('grandmother',           1, false)).toBe(2)
    expect(resolveRelevanceTier('grandfather_paternal',  1, false)).toBe(2)
    expect(resolveRelevanceTier('grandmother_maternal',  1, false)).toBe(2)
  })

  it('grandchildren at hop=1 → Tier 2', () => {
    expect(resolveRelevanceTier('grandson',     1, false)).toBe(2)
    expect(resolveRelevanceTier('granddaughter',1, false)).toBe(2)
  })

  it('in-laws at hop=1 → Tier 2', () => {
    expect(resolveRelevanceTier('father_in_law',  1, false)).toBe(2)
    expect(resolveRelevanceTier('mother_in_law',  1, false)).toBe(2)
    expect(resolveRelevanceTier('brother_in_law', 1, false)).toBe(2)
    expect(resolveRelevanceTier('sister_in_law',  1, false)).toBe(2)
    expect(resolveRelevanceTier('son_in_law',     1, false)).toBe(2)
    expect(resolveRelevanceTier('daughter_in_law',1, false)).toBe(2)
  })

  it('uncle/aunt at hop=1 → Tier 3', () => {
    expect(resolveRelevanceTier('uncle', 1, false)).toBe(3)
    expect(resolveRelevanceTier('aunt',  1, false)).toBe(3)
  })

  it('nephew/niece → Tier 3', () => {
    expect(resolveRelevanceTier('nephew', 1, false)).toBe(3)
    expect(resolveRelevanceTier('niece',  1, false)).toBe(3)
  })

  it('great_grandfather → Tier 3 regardless of hop', () => {
    expect(resolveRelevanceTier('great_grandfather', 1, false)).toBe(3)
    expect(resolveRelevanceTier('great_grandfather', 2, false)).toBe(3)
  })

  it('unknown relation → Tier 3', () => {
    expect(resolveRelevanceTier('other',   1, false)).toBe(3)
    expect(resolveRelevanceTier(null,      2, false)).toBe(2)
    expect(resolveRelevanceTier(undefined, 1, false)).toBe(1)
  })

  it('hop floor: Tier 1 relation at hop=2 → Tier 2 (grandparent perspective)', () => {
    // 'father' typed at hop=2 means the focal sees them as a grandparent
    expect(resolveRelevanceTier('father', 2, false)).toBe(2)
    expect(resolveRelevanceTier('mother', 2, false)).toBe(2)
    expect(resolveRelevanceTier('son',    2, false)).toBe(2)
  })

  it('hop floor: any relation at hop=3 → Tier 3', () => {
    expect(resolveRelevanceTier('father',  3, false)).toBe(3)
    expect(resolveRelevanceTier('brother', 3, false)).toBe(3)
    expect(resolveRelevanceTier('wife',    3, false)).toBe(3)
  })

  it('root relationType → Tier 1 at hop=1, Tier 2 at hop=2', () => {
    expect(resolveRelevanceTier('root', 1, false)).toBe(1)
    expect(resolveRelevanceTier('root', 2, false)).toBe(2)
  })
})

// ─── selectVisibleUniverseNodes ───────────────────────────────────────────────

function makeNode(
  overrides: Partial<UniverseNode> & { id: string; relevanceTier: 0|1|2|3 },
): UniverseNode {
  return {
    memberId: overrides.id,
    name: overrides.id,
    shortName: overrides.id,
    relation: 'Familiar',
    relationType: 'other',
    gender: null,
    avatarUrl: null,
    isRoot: false,
    isFocal: false,
    hopDistance: 1,
    orbitRadius: 115,
    angleDeg: 0,
    cx: 0,
    cy: 0,
    scale: 0.9,
    opacity: 1,
    zIndex: 200,
    ageGroup: 'adult',
    isDeceased: false,
    isJoined: false,
    parentMemberId: null,
    connectionChannel: 'blood' as const,
    orbitParentId: null,
    ...overrides,
  }
}

describe('selectVisibleUniverseNodes', () => {
  it('focal (Tier 0) is always visible', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
    ]
    const { visible } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.map(n => n.id)).toContain('focal')
  })

  it('Tier 1 nodes are all visible', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'spouse', relevanceTier: 1 }),
      makeNode({ id: 'father', relevanceTier: 1 }),
      makeNode({ id: 'mother', relevanceTier: 1 }),
    ]
    const { visible } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.length).toBe(4)
  })

  it('Tier 3 nodes are excluded entirely', () => {
    const nodes = [
      makeNode({ id: 'focal',  relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'uncle',  relevanceTier: 3 }),
      makeNode({ id: 'niece',  relevanceTier: 3 }),
    ]
    const { visible, hiddenCount, hiddenNodes } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.length).toBe(1)
    expect(hiddenCount).toBe(2)
    expect(hiddenNodes.map(n => n.id)).toEqual(expect.arrayContaining(['uncle', 'niece']))
  })

  it('mobile total cap: 12 T2 nodes → 10 visible, 2 hidden (total 11)', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 12 }, (_, i) =>
        makeNode({ id: `t2-${i}`, relevanceTier: 2 }),
      ),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.length).toBe(11)
    expect(visible.filter(n => n.relevanceTier === 2).length).toBe(10)
    expect(hiddenCount).toBe(2)
  })

  it('desktop total cap: 18 T2 nodes → 16 visible, 2 hidden (total 17)', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 18 }, (_, i) =>
        makeNode({ id: `t2-${i}`, relevanceTier: 2 }),
      ),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 1280)
    expect(visible.length).toBe(17)
    expect(visible.filter(n => n.relevanceTier === 2).length).toBe(16)
    expect(hiddenCount).toBe(2)
  })

  it('T2 selection is deterministic when total exceeds cap', () => {
    const nodes = [
      makeNode({ id: 'focal',  relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'z-last',  relevanceTier: 2, relationType: 'sister' }),
      makeNode({ id: 'a-first', relevanceTier: 2, relationType: 'brother' }),
      makeNode({ id: 'm-mid',   relevanceTier: 2, relationType: 'brother' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeNode({ id: `extra${i}`, relevanceTier: 2, relationType: 'grandson' }),
      ),
    ]
    // 1 focal + 12 T2 = 13 > 11 on mobile → 10 T2 visible
    const r1 = selectVisibleUniverseNodes(nodes, 375).visible.map(n => n.id).sort()
    const r2 = selectVisibleUniverseNodes([...nodes].reverse(), 375).visible.map(n => n.id).sort()
    expect(r1).toEqual(r2)
    expect(r1.filter(id => id !== 'focal').length).toBe(10)
  })

  it('empty dataset returns empty visible', () => {
    const { visible, hiddenCount } = selectVisibleUniverseNodes([], 375)
    expect(visible.length).toBe(0)
    expect(hiddenCount).toBe(0)
  })

  it('fewer nodes than limit returns all visible', () => {
    const nodes = [
      makeNode({ id: 'focal',  relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'spouse', relevanceTier: 1 }),
      makeNode({ id: 'sib',    relevanceTier: 2 }),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.length).toBe(3)
    expect(hiddenCount).toBe(0)
  })

  it('hiddenCount includes T1/T2 overflow and all T3', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 12 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2 })),
      makeNode({ id: 'uncle', relevanceTier: 3 }),
      makeNode({ id: 'niece', relevanceTier: 3 }),
    ]
    // mobile: 1 focal + 12 T2 + 2 T3; cap=11 → 10 T2 visible, 2 T2 hidden + 2 T3 = 4 hidden
    const { hiddenCount } = selectVisibleUniverseNodes(nodes, 375)
    expect(hiddenCount).toBe(4)
  })

  it('T1 truncated by priority when T1 alone exceeds limit', () => {
    const nodes = [
      makeNode({ id: 'focal',  relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'wife',   relevanceTier: 1, relationType: 'wife' }),
      makeNode({ id: 'father', relevanceTier: 1, relationType: 'father' }),
      makeNode({ id: 'mother', relevanceTier: 1, relationType: 'mother' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeNode({ id: `child${i}`, relevanceTier: 1, relationType: 'son' }),
      ),
    ]
    // 1 focal + 12 T1 = 13 > 11 → only 10 T1 visible
    const { visible, hiddenNodes } = selectVisibleUniverseNodes(nodes, 375)
    expect(visible.length).toBe(11)
    const visibleIds = visible.map(n => n.id)
    // Spouse/parents always survive truncation (highest priority)
    expect(visibleIds).toContain('wife')
    expect(visibleIds).toContain('father')
    expect(visibleIds).toContain('mother')
    // 2 lowest-priority children go to hiddenNodes
    const hiddenT1 = hiddenNodes.filter(n => n.relevanceTier === 1)
    expect(hiddenT1.length).toBe(2)
  })
})

// ─── expansion — additionalCount ─────────────────────────────────────────────

describe('expansion — additionalCount', () => {
  it('exports have the expected values', () => {
    expect(BATCH_MOBILE).toBe(4)
    expect(BATCH_DESKTOP).toBe(6)
    expect(MAX_EXPANDED_MOBILE).toBe(19)
    expect(MAX_EXPANDED_DESKTOP).toBe(29)
  })

  it('additionalCount=0 returns same base set, maxExpansionReached=false when hidden exist', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 15 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2 })),
    ]
    const { visible, hiddenCount, maxExpansionReached } = selectVisibleUniverseNodes(nodes, 375, 0)
    expect(visible.length).toBe(11)   // base mobile cap unchanged
    expect(hiddenCount).toBe(5)
    expect(maxExpansionReached).toBe(false)
  })

  it('additionalCount=4 on mobile reveals 4 more hidden nodes', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 15 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2 })),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 375, 4)
    expect(visible.length).toBe(15)   // 11 base + 4 expanded
    expect(hiddenCount).toBe(1)
  })

  it('additionalCount=6 on desktop reveals 6 more hidden nodes', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 25 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2 })),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 1280, 6)
    expect(visible.length).toBe(23)   // 17 base + 6 expanded
    expect(hiddenCount).toBe(3)       // 25 - 16 base - 6 expanded = 3
  })

  it('T3 nodes receive scale/opacity override when expanded', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'uncle', relevanceTier: 3, scale: 0, opacity: 0 }),
    ]
    const { visible } = selectVisibleUniverseNodes(nodes, 375, 1)
    const uncle = visible.find(n => n.id === 'uncle')
    expect(uncle).toBeDefined()
    expect(uncle!.scale).toBeGreaterThan(0)
    expect(uncle!.opacity).toBeGreaterThan(0)
  })

  it('T2 nodes keep their own scale/opacity when expanded (no override)', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 12 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2, scale: 0.68, opacity: 0.55 })),
    ]
    const { visible } = selectVisibleUniverseNodes(nodes, 375, 1)
    const expanded = visible.find(n => n.id === 't2-10')!
    expect(expanded.scale).toBe(0.68)
    expect(expanded.opacity).toBe(0.55)
  })

  it('maxExpansionReached when total visible hits mobile cap and hidden remain', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      ...Array.from({ length: 30 }, (_, i) => makeNode({ id: `t2-${i}`, relevanceTier: 2 })),
    ]
    // base=11, expansionCap=19-11=8 → ask for 8
    const { visible, hiddenCount, maxExpansionReached } = selectVisibleUniverseNodes(nodes, 375, 8)
    expect(visible.length).toBe(MAX_EXPANDED_MOBILE)
    expect(hiddenCount).toBeGreaterThan(0)
    expect(maxExpansionReached).toBe(true)
  })

  it('maxExpansionReached=false when there are no hidden after expansion', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      makeNode({ id: 't3a', relevanceTier: 3 }),
    ]
    // Expand to reveal the only hidden node
    const { hiddenCount, maxExpansionReached } = selectVisibleUniverseNodes(nodes, 375, 1)
    expect(hiddenCount).toBe(0)
    expect(maxExpansionReached).toBe(false)
  })

  it('T3 expansion order: by hopDistance asc, then relationType asc, then id asc', () => {
    const nodes = [
      makeNode({ id: 'focal',    relevanceTier: 0, isFocal: true }),
      makeNode({ id: 'c-uncle',  relevanceTier: 3, relationType: 'uncle',  hopDistance: 2 }),
      makeNode({ id: 'b-niece',  relevanceTier: 3, relationType: 'niece',  hopDistance: 1 }),
      makeNode({ id: 'a-nephew', relevanceTier: 3, relationType: 'nephew', hopDistance: 1 }),
    ]
    // First expanded = hop=1, relType 'nephew' < 'niece' → 'a-nephew'
    const { visible } = selectVisibleUniverseNodes(nodes, 375, 1)
    expect(visible.find(n => n.id === 'a-nephew')).toBeDefined()
    expect(visible.find(n => n.id === 'b-niece')).toBeUndefined()
    expect(visible.find(n => n.id === 'c-uncle')).toBeUndefined()
  })

  it('asking for more than available reveals all hidden without error', () => {
    const nodes = [
      makeNode({ id: 'focal', relevanceTier: 0, isFocal: true }),
      makeNode({ id: 't3a', relevanceTier: 3 }),
      makeNode({ id: 't3b', relevanceTier: 3 }),
    ]
    const { visible, hiddenCount } = selectVisibleUniverseNodes(nodes, 375, 999)
    // Both T3 revealed, within expansionCap
    expect(visible.find(n => n.id === 't3a')).toBeDefined()
    expect(visible.find(n => n.id === 't3b')).toBeDefined()
    expect(hiddenCount).toBe(0)
  })
})

// ─── resolveRelationFromFocal ─────────────────────────────────────────────────

function makeSceneNodes(
  focalId: string,
  members: Array<{ id: string; relType: string; gender?: string | null }>,
  rootGender?: string,
): UniverseNode[] {
  const isRootFocal = focalId === 'root'
  const rootNode = makeNode({
    id: 'root',
    relevanceTier: isRootFocal ? 0 : 1,
    isFocal: isRootFocal,
    relationType: 'root',
    gender: rootGender ?? 'male',
    isRoot: true,
  })
  const memberNodes = members.map(m =>
    makeNode({
      id: m.id,
      relevanceTier: m.id === focalId ? 0 : 1,
      isFocal: m.id === focalId,
      relationType: m.relType,
      gender: m.gender ?? null,
    }),
  )
  return [rootNode, ...memberNodes]
}

describe('resolveRelationFromFocal', () => {
  it('returns null when focal is root (labels already correct)', () => {
    const nodes = makeSceneNodes('root', [{ id: 'ez', relType: 'son' }])
    expect(resolveRelationFromFocal({ focalId: 'root', targetId: 'ez', nodes })).toBeNull()
  })

  it('returns null when focalId === targetId', () => {
    const nodes = makeSceneNodes('ez', [{ id: 'ez', relType: 'son' }])
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'ez', nodes })).toBeNull()
  })

  it('Ezequiel focal (son): Alfredo (root, male) → Padre', () => {
    const nodes = makeSceneNodes('ez', [{ id: 'ez', relType: 'son' }])
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'root', nodes })).toBe('Padre')
  })

  it('Tatiana focal (daughter): Alfredo (root, male) → Padre', () => {
    const nodes = makeSceneNodes('tatiana', [{ id: 'tatiana', relType: 'daughter' }])
    expect(resolveRelationFromFocal({ focalId: 'tatiana', targetId: 'root', nodes })).toBe('Padre')
  })

  it('son focal: Alfredo (root, female) → Madre', () => {
    const nodes = makeSceneNodes('ez', [{ id: 'ez', relType: 'son' }], 'female')
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'root', nodes })).toBe('Madre')
  })

  it('Ezequiel focal (son): Joselin (wife of root) → Madre', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez', relType: 'son' },
      { id: 'joselin', relType: 'wife', gender: 'female' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'joselin', nodes })).toBe('Madre')
  })

  it('Ezequiel focal (son): Tatiana (daughter of root) → Hermana', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez', relType: 'son' },
      { id: 'tatiana', relType: 'daughter' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'tatiana', nodes })).toBe('Hermana')
  })

  it('Tatiana focal (daughter): Ezequiel (son of root) → Hermano', () => {
    const nodes = makeSceneNodes('tatiana', [
      { id: 'tatiana', relType: 'daughter' },
      { id: 'ez', relType: 'son' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'tatiana', targetId: 'ez', nodes })).toBe('Hermano')
  })

  it('Tatiana focal (daughter): Joselin (wife of root) → Madre', () => {
    const nodes = makeSceneNodes('tatiana', [
      { id: 'tatiana', relType: 'daughter' },
      { id: 'joselin', relType: 'wife' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'tatiana', targetId: 'joselin', nodes })).toBe('Madre')
  })

  it('Joselin focal (wife): Alfredo (root, male) → Esposo', () => {
    const nodes = makeSceneNodes('joselin', [{ id: 'joselin', relType: 'wife' }])
    expect(resolveRelationFromFocal({ focalId: 'joselin', targetId: 'root', nodes })).toBe('Esposo')
  })

  it('Joselin focal (wife): Ezequiel (son of root) → Hijo', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin', relType: 'wife' },
      { id: 'ez', relType: 'son' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'joselin', targetId: 'ez', nodes })).toBe('Hijo')
  })

  it('Joselin focal (wife): Tatiana (daughter of root) → Hija', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin', relType: 'wife' },
      { id: 'tatiana', relType: 'daughter' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'joselin', targetId: 'tatiana', nodes })).toBe('Hija')
  })

  it('father focal: son of root → Nieto', () => {
    const nodes = makeSceneNodes('abuelo', [
      { id: 'abuelo', relType: 'father' },
      { id: 'child', relType: 'son' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'abuelo', targetId: 'child', nodes })).toBe('Nieto')
  })

  it('returns null for unknown composition (e.g. cousin of root)', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez', relType: 'son' },
      { id: 'primo', relType: 'cousin' },
    ])
    expect(resolveRelationFromFocal({ focalId: 'ez', targetId: 'primo', nodes })).toBeNull()
  })
})

// ─── resolveRelationFromPerspective ──────────────────────────────────────────

describe('resolveRelationFromPerspective', () => {
  // Helper: extract typed node references from a makeSceneNodes result
  function get(nodes: UniverseNode[], id: string): UniverseNode {
    const n = nodes.find(n => n.id === id)
    if (!n) throw new Error(`node '${id}' not found`)
    return n
  }

  // ── Null / guard cases ────────────────────────────────────────────────────

  it('returns null when focal.isRoot is true', () => {
    const nodes = makeSceneNodes('root', [{ id: 'ez', relType: 'son' }])
    const root = get(nodes, 'root')
    const ez   = get(nodes, 'ez')
    expect(resolveRelationFromPerspective(root, ez, root, { nodes })).toBeNull()
  })

  it('returns null when focal and target are the same node', () => {
    const nodes = makeSceneNodes('ez', [{ id: 'ez', relType: 'son' }])
    const ez   = get(nodes, 'ez')
    const root = get(nodes, 'root')
    expect(resolveRelationFromPerspective(ez, ez, root, { nodes })).toBeNull()
  })

  // ── Regression: root as target ────────────────────────────────────────────

  it('son focal: root (male) → Padre', () => {
    const nodes = makeSceneNodes('ez', [{ id: 'ez', relType: 'son' }])
    expect(resolveRelationFromPerspective(get(nodes, 'ez'), get(nodes, 'root'), get(nodes, 'root'), { nodes })).toBe('Padre')
  })

  it('wife focal: root (male) → Esposo', () => {
    const nodes = makeSceneNodes('joselin', [{ id: 'joselin', relType: 'wife' }])
    expect(resolveRelationFromPerspective(get(nodes, 'joselin'), get(nodes, 'root'), get(nodes, 'root'), { nodes })).toBe('Esposo')
  })

  // ── Phase 5.1: gaps — son/daughter focal + in-law targets ────────────────

  it('FOCO EZEQUIEL: Washington (father_in_law of root) → Abuelo materno', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez',         relType: 'son' },
      { id: 'washington', relType: 'father_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'ez'), get(nodes, 'washington'), get(nodes, 'root'), { nodes }))
      .toBe('Abuelo materno')
  })

  it('FOCO EZEQUIEL: Lourdes (mother_in_law of root) → Abuela materna', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez',      relType: 'son' },
      { id: 'lourdes', relType: 'mother_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'ez'), get(nodes, 'lourdes'), get(nodes, 'root'), { nodes }))
      .toBe('Abuela materna')
  })

  it('FOCO EZEQUIEL: Yerik (brother_in_law of root) → Tío político', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez',    relType: 'son' },
      { id: 'yerik', relType: 'brother_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'ez'), get(nodes, 'yerik'), get(nodes, 'root'), { nodes }))
      .toBe('Tío político')
  })

  it('FOCO EZEQUIEL: Cindy (sister_in_law of root) → Tía política', () => {
    const nodes = makeSceneNodes('ez', [
      { id: 'ez',    relType: 'son' },
      { id: 'cindy', relType: 'sister_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'ez'), get(nodes, 'cindy'), get(nodes, 'root'), { nodes }))
      .toBe('Tía política')
  })

  // ── Phase 5.1: gaps — wife/husband focal + in-law targets ────────────────

  it('FOCO JOSELIN: Washington (father_in_law of root) → Padre', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin',    relType: 'wife' },
      { id: 'washington', relType: 'father_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'joselin'), get(nodes, 'washington'), get(nodes, 'root'), { nodes }))
      .toBe('Padre')
  })

  it('FOCO JOSELIN: Lourdes (mother_in_law of root) → Madre', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin', relType: 'wife' },
      { id: 'lourdes', relType: 'mother_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'joselin'), get(nodes, 'lourdes'), get(nodes, 'root'), { nodes }))
      .toBe('Madre')
  })

  it('FOCO JOSELIN: Yerik (brother_in_law of root) → Hermano', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin', relType: 'wife' },
      { id: 'yerik',   relType: 'brother_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'joselin'), get(nodes, 'yerik'), get(nodes, 'root'), { nodes }))
      .toBe('Hermano')
  })

  it('FOCO JOSELIN: Cindy (sister_in_law of root) → Hermana', () => {
    const nodes = makeSceneNodes('joselin', [
      { id: 'joselin', relType: 'wife' },
      { id: 'cindy',   relType: 'sister_in_law' },
    ])
    expect(resolveRelationFromPerspective(get(nodes, 'joselin'), get(nodes, 'cindy'), get(nodes, 'root'), { nodes }))
      .toBe('Hermana')
  })
})
