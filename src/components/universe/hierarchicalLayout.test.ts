import { describe, it, expect } from 'vitest'
import {
  computeUniverseLayout,
  GENERATION_MAP,
  VERT_STRIDE,
  nodeHalfBBox,
} from './useUniverseLayout'
import type { Profile, FamilyMember } from '@/lib/types'
import type { UniverseNode } from './useUniverseLayout'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProfile: Profile = {
  id: 'root-profile',
  first_name: 'Alfredo',
  last_name: 'Hurtado',
  location_enabled: false,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

function makeMember(id: string, relation_type: string, overrides: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id,
    added_by: 'root-profile',
    first_name: 'Person',
    relation_type: relation_type as FamilyMember['relation_type'],
    relation_kind: 'blood',
    invitation_sent: false,
    created_at: '2024-01-01',
    ...overrides,
  }
}

function layout(members: FamilyMember[]): UniverseNode[] {
  return computeUniverseLayout('root', mockProfile, members, [], [])
}

/** Returns true if no two nodes in the same generation row have overlapping bounding boxes. */
function noOverlap(nodes: UniverseNode[]): boolean {
  // Group by rounded cy
  const byY = new Map<number, UniverseNode[]>()
  for (const n of nodes) {
    const key = Math.round(n.cy)
    if (!byY.has(key)) byY.set(key, [])
    byY.get(key)!.push(n)
  }
  for (const row of byY.values()) {
    const sorted = [...row].sort((a, b) => a.cx - b.cx)
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]; const b = sorted[i]
      const minDist = nodeHalfBBox(a.scale) + nodeHalfBBox(b.scale)
      if (b.cx - a.cx < minDist) return false
    }
  }
  return true
}

// ─── GENERATION_MAP sanity ───────────────────────────────────────────────────

describe('GENERATION_MAP', () => {
  it('ancestors have negative generation values', () => {
    expect(GENERATION_MAP['father']).toBe(-1)
    expect(GENERATION_MAP['grandfather']).toBe(-2)
    expect(GENERATION_MAP['great_grandfather']).toBe(-3)
  })

  it('descendants have positive generation values', () => {
    expect(GENERATION_MAP['son']).toBe(1)
    expect(GENERATION_MAP['grandson']).toBe(2)
    expect(GENERATION_MAP['great_grandson']).toBe(3)
  })

  it('lateral and spouse relations are at generation 0', () => {
    expect(GENERATION_MAP['spouse']).toBe(0)
    expect(GENERATION_MAP['brother']).toBe(0)
    expect(GENERATION_MAP['sister']).toBe(0)
    expect(GENERATION_MAP['root']).toBe(0)
  })
})

// ─── Generational ordering (cy values) ───────────────────────────────────────

describe('hierarchical layout — generational ordering', () => {
  it('parents (father/mother) are above focal (cy < 0)', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('m', 'mother')])
    const father = nodes.find(n => n.id === 'f')!
    const mother = nodes.find(n => n.id === 'm')!
    expect(father.cy).toBeLessThan(0)
    expect(mother.cy).toBeLessThan(0)
  })

  it('children (son/daughter) are below focal (cy > 0)', () => {
    const nodes = layout([makeMember('s', 'son'), makeMember('d', 'daughter')])
    const son      = nodes.find(n => n.id === 's')!
    const daughter = nodes.find(n => n.id === 'd')!
    expect(son.cy).toBeGreaterThan(0)
    expect(daughter.cy).toBeGreaterThan(0)
  })

  it('grandparents are above parents (cy_gp < cy_parent)', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('gf', 'grandfather')])
    const father = nodes.find(n => n.id === 'f')!
    const gf     = nodes.find(n => n.id === 'gf')!
    expect(gf.cy).toBeLessThan(father.cy)
  })

  it('grandchildren are below children (cy_gc > cy_child)', () => {
    const nodes = layout([makeMember('s', 'son'), makeMember('gs', 'grandson')])
    const son      = nodes.find(n => n.id === 's')!
    const grandson = nodes.find(n => n.id === 'gs')!
    expect(grandson.cy).toBeGreaterThan(son.cy)
  })

  it('spouse shares focal generation (cy === 0)', () => {
    const nodes = layout([makeMember('sp', 'spouse')])
    expect(nodes.find(n => n.id === 'sp')!.cy).toBe(0)
  })

  it('siblings share focal generation (cy === 0)', () => {
    const nodes = layout([makeMember('b', 'brother'), makeMember('si', 'sister')])
    expect(nodes.find(n => n.id === 'b')!.cy).toBe(0)
    expect(nodes.find(n => n.id === 'si')!.cy).toBe(0)
  })

  it('generation vertical stride matches VERT_STRIDE constant', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('s', 'son')])
    const father = nodes.find(n => n.id === 'f')!
    const son    = nodes.find(n => n.id === 's')!
    expect(father.cy).toBe(-VERT_STRIDE)
    expect(son.cy).toBe(VERT_STRIDE)
  })

  it('3-level ancestry: great-grandfather < grandfather < parent < focal', () => {
    const nodes = layout([
      makeMember('f', 'father'),
      makeMember('gf', 'grandfather'),
      makeMember('ggf', 'great_grandfather'),
    ])
    const father = nodes.find(n => n.id === 'f')!
    const gf     = nodes.find(n => n.id === 'gf')!
    const ggf    = nodes.find(n => n.id === 'ggf')!
    expect(ggf.cy).toBeLessThan(gf.cy)
    expect(gf.cy).toBeLessThan(father.cy)
    expect(father.cy).toBeLessThan(0)
  })
})

// ─── Couple ordering (pairs in same generation) ───────────────────────────────

describe('hierarchical layout — couple positioning', () => {
  it('father and mother share the same generation row (cy equal)', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('m', 'mother')])
    const father = nodes.find(n => n.id === 'f')!
    const mother = nodes.find(n => n.id === 'm')!
    expect(father.cy).toBe(mother.cy)
  })

  it('spouse appears to the right of focal (cx > 0)', () => {
    const nodes = layout([makeMember('sp', 'spouse'), makeMember('b', 'brother')])
    const spouse  = nodes.find(n => n.id === 'sp')!
    expect(spouse.cx).toBeGreaterThan(0)
  })

  it('father appears to the left of mother (cx_father < cx_mother)', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('m', 'mother')])
    const father = nodes.find(n => n.id === 'f')!
    const mother = nodes.find(n => n.id === 'm')!
    expect(father.cx).toBeLessThan(mother.cx)
  })
})

// ─── No bounding-box overlap ──────────────────────────────────────────────────

describe('hierarchical layout — no overlap', () => {
  it('two children do not overlap', () => {
    const nodes = layout([makeMember('s1', 'son'), makeMember('s2', 'son')])
    expect(noOverlap(nodes)).toBe(true)
  })

  it('two parents do not overlap', () => {
    const nodes = layout([makeMember('f', 'father'), makeMember('m', 'mother')])
    expect(noOverlap(nodes)).toBe(true)
  })

  it('eight siblings do not overlap', () => {
    const members = Array.from({ length: 8 }, (_, i) =>
      makeMember(`sib${i}`, i % 2 === 0 ? 'brother' : 'sister'),
    )
    const nodes = layout(members)
    expect(noOverlap(nodes)).toBe(true)
  })

  it('full nuclear family does not overlap', () => {
    const nodes = layout([
      makeMember('f', 'father'), makeMember('m', 'mother'),
      makeMember('b', 'brother'), makeMember('si', 'sister'),
      makeMember('sp', 'spouse'),
      makeMember('s1', 'son'), makeMember('s2', 'daughter'),
      makeMember('gf', 'grandfather'), makeMember('gm', 'grandmother'),
    ])
    expect(noOverlap(nodes)).toBe(true)
  })

  it('3-generation family does not overlap', () => {
    const nodes = layout([
      makeMember('f', 'father'), makeMember('m', 'mother'),
      makeMember('gf', 'grandfather'), makeMember('gm', 'grandmother'),
      makeMember('sp', 'spouse'),
      makeMember('s1', 'son'), makeMember('s2', 'son'),
      makeMember('gs1', 'grandson'), makeMember('gs2', 'granddaughter'),
    ])
    expect(noOverlap(nodes)).toBe(true)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('hierarchical layout — determinism', () => {
  it('same input produces identical cx/cy on repeated calls', () => {
    const members = [
      makeMember('f', 'father'), makeMember('m', 'mother'),
      makeMember('sp', 'spouse'), makeMember('s1', 'son'),
      makeMember('b', 'brother'),
    ]
    const a = computeUniverseLayout('root', mockProfile, members, [], [])
    const b = computeUniverseLayout('root', mockProfile, members, [], [])
    for (const na of a) {
      const nb = b.find(n => n.id === na.id)!
      expect(na.cx).toBe(nb.cx)
      expect(na.cy).toBe(nb.cy)
    }
  })
})

// ─── Long names do not affect layout positions ────────────────────────────────

describe('hierarchical layout — long names', () => {
  it('a very long first_name does not shift sibling positions', () => {
    const shortA = computeUniverseLayout('root', mockProfile, [
      makeMember('s1', 'son', { first_name: 'A' }),
      makeMember('s2', 'son', { first_name: 'B' }),
    ], [], [])
    const longA = computeUniverseLayout('root', mockProfile, [
      makeMember('s1', 'son', { first_name: 'Nombre Extremadamente Largo Que No Debería Mover Nada' }),
      makeMember('s2', 'son', { first_name: 'B' }),
    ], [], [])
    const s1Short = shortA.find(n => n.id === 's1')!
    const s1Long  = longA.find(n => n.id === 's1')!
    const s2Short = shortA.find(n => n.id === 's2')!
    const s2Long  = longA.find(n => n.id === 's2')!
    expect(s1Short.cx).toBe(s1Long.cx)
    expect(s1Short.cy).toBe(s1Long.cy)
    expect(s2Short.cx).toBe(s2Long.cx)
    expect(s2Short.cy).toBe(s2Long.cy)
  })
})

// ─── Scalability — many siblings ─────────────────────────────────────────────

describe('hierarchical layout — scalability', () => {
  it('12 siblings: no overlaps and all at generation 0 (cy === 0)', () => {
    const members = Array.from({ length: 12 }, (_, i) =>
      makeMember(`sib${i}`, i % 2 === 0 ? 'brother' : 'sister'),
    )
    const nodes = layout(members)
    const siblings = nodes.filter(n => n.id.startsWith('sib'))
    siblings.forEach(n => expect(n.cy).toBe(0))
    expect(noOverlap(nodes)).toBe(true)
  })

  it('mixed family: focal stays at cx=0, cy=0', () => {
    const nodes = layout([
      makeMember('f', 'father'), makeMember('m', 'mother'),
      makeMember('sp', 'spouse'),
      makeMember('s1', 'son'), makeMember('s2', 'daughter'), makeMember('s3', 'son'),
      makeMember('b1', 'brother'), makeMember('b2', 'brother'), makeMember('si1', 'sister'),
    ])
    const focal = nodes.find(n => n.isFocal)!
    expect(focal.cx).toBe(0)
    expect(focal.cy).toBe(0)
  })
})
