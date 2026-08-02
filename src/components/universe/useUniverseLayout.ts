import { useMemo } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'

// ─── Orbital geometry ───────────────────────────────────────────────────────
const ORBIT_RADII  = [0, 115, 210, 295] as const
const MAX_HOP      = 3
// Scale and opacity are tier-based, not orbit-based.
// Tier 0 = focal, 1 = intimate circle, 2 = close family, 3 = not rendered.
const TIER_SCALES  = [1.35, 0.90, 0.68, 0.0] as const
const TIER_OPACITY = [1.0,  1.0,  0.55, 0.0] as const

// Preferred angle (°) per relation type, measured from 3 o'clock, clockwise positive.
// Layout principle: ancestors = upper half, descendants = lower half,
//                   spouse = right, siblings = left.
const REL_ANGLE: Record<string, number> = {
  father: -120, mother: -60,
  grandfather: -130, grandmother: -55,
  grandfather_paternal: -137, grandmother_paternal: -124,
  grandfather_maternal: -56,  grandmother_maternal: -43,
  great_grandfather: -143,    great_grandmother: -37,
  uncle: -152,  aunt: -28,
  stepfather: -116, stepmother: -64,
  // Descendants – lower half
  son: 78,  daughter: 102,
  grandson: 84, granddaughter: 96,
  great_grandson: 82, great_granddaughter: 98,
  nephew: 128,  niece: 52,
  stepson: 88,  stepdaughter: 92, stepchild: 90,
  // Spouse – right side
  spouse: -6, partner: 6, husband: -6, wife: 6,
  // Siblings – left side
  brother: 167,  sister: -167,
  half_brother: 158, half_sister: -158,
  cousin: 155,
  // In-laws
  father_in_law: -106, mother_in_law: -74,
  brother_in_law: 177, sister_in_law: -177,
  son_in_law: 73, daughter_in_law: 107,
  // Fallback
  other: 45,
}

export interface UniverseNode {
  id: string
  memberId?: string
  name: string
  shortName: string
  relation: string
  relationType: string
  gender?: string | null
  avatarUrl?: string | null
  isRoot: boolean
  isFocal: boolean
  hopDistance: number
  orbitRadius: number
  angleDeg: number
  cx: number
  cy: number
  scale: number
  opacity: number
  zIndex: number
  relevanceTier: 0 | 1 | 2 | 3
  ageGroup: 'child' | 'adult' | 'elder'
  isDeceased?: boolean
  isJoined?: boolean
  parentMemberId?: string | null
}

// ─── Hierarchical family layout ─────────────────────────────────────────────
const ROW_HEIGHT = 280  // px between generation rows
const COL_WIDTH  = 160  // px between siblings in the same row

const SPOUSE_SET  = new Set(['spouse', 'partner', 'husband', 'wife'])
const SIBLING_SET = new Set([
  'brother', 'sister', 'half_brother', 'half_sister',
  'brother_in_law', 'sister_in_law', 'cousin',
])

// Maps a relation type to a generation row relative to focal (0 = same row).
// Ancestors: negative. Descendants: positive.
function generationOf(relationType: string): number {
  switch (relationType) {
    case 'great_grandfather': case 'great_grandmother': return -3
    case 'grandfather': case 'grandmother':
    case 'grandfather_paternal': case 'grandmother_paternal':
    case 'grandfather_maternal': case 'grandmother_maternal': return -2
    case 'father': case 'mother':
    case 'stepfather': case 'stepmother':
    case 'uncle': case 'aunt':
    case 'father_in_law': case 'mother_in_law': return -1
    case 'spouse': case 'husband': case 'wife': case 'partner':
    case 'brother': case 'sister': case 'half_brother': case 'half_sister':
    case 'brother_in_law': case 'sister_in_law': case 'cousin': return 0
    case 'son': case 'daughter':
    case 'stepson': case 'stepdaughter': case 'stepchild':
    case 'nephew': case 'niece':
    case 'son_in_law': case 'daughter_in_law': return 1
    case 'grandson': case 'granddaughter': return 2
    case 'great_grandson': case 'great_granddaughter': return 3
    default: return 0
  }
}

// Assigns cx, cy to every non-focal node using generation rows.
// Focal stays at (0, 0). Siblings left, partners right, children below, parents above.
function assignHierarchicalPositions(nodes: UniverseNode[]): void {
  const focal = nodes.find(n => n.isFocal)
  if (!focal) return

  focal.cx = 0
  focal.cy = 0

  const nonFocal = nodes.filter(n => !n.isFocal)

  // Group by generation row
  const byGen = new Map<number, UniverseNode[]>()
  for (const n of nonFocal) {
    const gen = generationOf(n.relationType)
    const row = byGen.get(gen) ?? []
    row.push(n)
    byGen.set(gen, row)
  }

  for (const [gen, genNodes] of byGen) {
    const y = gen * ROW_HEIGHT

    if (gen === 0) {
      // Same row as focal: siblings left, partners then others right
      const siblings = genNodes.filter(n => SIBLING_SET.has(n.relationType))
      const partners = genNodes.filter(n => SPOUSE_SET.has(n.relationType))
      const others   = genNodes.filter(n =>
        !SIBLING_SET.has(n.relationType) && !SPOUSE_SET.has(n.relationType))

      // Siblings: placed to the left, closest sibling at -COL_WIDTH
      siblings.forEach((n, i) => {
        n.cx = -(siblings.length - i) * COL_WIDTH
        n.cy = 0
      })

      // Partners first, then other same-gen nodes, placed to the right
      ;[...partners, ...others].forEach((n, i) => {
        n.cx = (i + 1) * COL_WIDTH
        n.cy = 0
      })
    } else {
      // All other generations: distribute evenly, centered at x=0
      const sorted = [...genNodes].sort((a, b) =>
        a.id < b.id ? -1 : 1
      )
      const totalWidth = (sorted.length - 1) * COL_WIDTH
      sorted.forEach((n, i) => {
        n.cx = i * COL_WIDTH - totalWidth / 2
        n.cy = y
      })
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const RELATION_LABELS: Record<string, string> = {
  father: 'Padre', mother: 'Madre', son: 'Hijo', daughter: 'Hija',
  brother: 'Hermano', sister: 'Hermana',
  half_brother: 'Medio hermano', half_sister: 'Media hermana',
  spouse: 'Pareja', partner: 'Pareja', husband: 'Esposo', wife: 'Esposa',
  grandfather: 'Abuelo', grandmother: 'Abuela',
  grandfather_paternal: 'Abuelo paterno', grandmother_paternal: 'Abuela paterna',
  grandfather_maternal: 'Abuelo materno', grandmother_maternal: 'Abuela materna',
  great_grandfather: 'Bisabuelo', great_grandmother: 'Bisabuela',
  grandson: 'Nieto', granddaughter: 'Nieta',
  great_grandson: 'Bisnieto', great_granddaughter: 'Bisnieta',
  uncle: 'Tío', aunt: 'Tía', cousin: 'Primo/a',
  uncle_by_marriage: 'Tío político', aunt_by_marriage: 'Tía política',
  nephew: 'Sobrino', niece: 'Sobrina',
  father_in_law: 'Suegro', mother_in_law: 'Suegra',
  brother_in_law: 'Cuñado', sister_in_law: 'Cuñada',
  son_in_law: 'Yerno', daughter_in_law: 'Nuera',
  stepfather: 'Padrastro', stepmother: 'Madrastra',
  stepson: 'Hijastro', stepdaughter: 'Hijastra', stepchild: 'Hijastro/a',
  other: 'Familiar',
}

// ─── Relevance tier sets ─────────────────────────────────────────────────────
// Tier 1: intimate circle — the people you see every day
const TIER1_RELS = new Set([
  'father', 'mother', 'son', 'daughter',
  'spouse', 'husband', 'wife', 'partner',
  'stepfather', 'stepmother', 'stepson', 'stepdaughter', 'stepchild',
])
// Tier 2: close family — meaningful but secondary in this context
const TIER2_RELS = new Set([
  'brother', 'sister', 'half_brother', 'half_sister',
  'grandfather', 'grandmother',
  'grandfather_paternal', 'grandmother_paternal',
  'grandfather_maternal', 'grandmother_maternal',
  'grandson', 'granddaughter',
  'father_in_law', 'mother_in_law',
  'son_in_law', 'daughter_in_law',
  'brother_in_law', 'sister_in_law',
])
// Tier 3 (not rendered): uncle, aunt, nephew, niece, cousin, great_*, other

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/**
 * Resolves a human-readable Spanish label for a relation.
 *
 * Priority:
 *   1. Catalog lookup on inferredRelation (handles raw keys like "brother")
 *   2. inferredRelation as-is if already localized (starts uppercase, no underscores)
 *   3. Catalog lookup on relationType
 *   4. Safe fallback "Familiar"
 */
export function resolveRelationLabel(
  inferredRelation: string | null | undefined,
  relationType: string | null | undefined,
): string {
  if (inferredRelation) {
    const fromCatalog = RELATION_LABELS[inferredRelation]
    if (fromCatalog) return fromCatalog
    // Already a human label: starts with uppercase, no underscores
    if (!/[_]/.test(inferredRelation) && /^[A-ZÁÉÍÓÚÜÑ]/.test(inferredRelation)) {
      return inferredRelation
    }
  }
  if (relationType) {
    const fromCatalog = RELATION_LABELS[relationType]
    if (fromCatalog) return fromCatalog
  }
  return 'Familiar'
}

// z-index bands: focal > selected (handled at render) > orbit 1 > orbit 2 > orbit 3+
// Gaps between adjacent bands must exceed 49 (the max cy bonus) so bands never overlap.
// Orbit 1: [200, 249] | Orbit 2: [130, 179] | Orbit 3+: [60, 109]
const Z_FOCAL   = 400
const Z_BANDS   = [200, 130, 60] as const  // indexed by (hopDistance - 1)

/**
 * Deterministic z-index: deeper orbits are behind; within the same orbit,
 * nodes with a higher cy (lower on screen) appear in front (pseudo-3D depth).
 */
export function computeNodeZIndex(hopDistance: number, cy: number, isFocal: boolean): number {
  if (isFocal) return Z_FOCAL
  const band     = Z_BANDS[Math.min(hopDistance - 1, Z_BANDS.length - 1)]
  // cy ∈ [-300, +300] → bonus ∈ [0, 49]
  const cyBonus  = Math.round(Math.min(49, Math.max(0, (cy + 300) / 600 * 49)))
  return band + cyBonus
}

/**
 * Assigns a relevance tier relative to the current focal person.
 * 0 = focal, 1 = intimate circle, 2 = close family, 3 = extended (not rendered).
 *
 * Uses both relationType and hopDistance: a 'father'-typed member at hop=2 is a
 * grandparent from the focal's perspective → floor to Tier 2, not Tier 1.
 */
export function resolveRelevanceTier(
  relationType: string | null | undefined,
  hopDistance: number,
  isFocal: boolean,
): 0 | 1 | 2 | 3 {
  if (isFocal) return 0
  // profile owner is always prominent when not focal
  if (!relationType || relationType === 'root') {
    return (hopDistance >= 2 ? 2 : 1) as 1 | 2
  }
  const typeTier: 1 | 2 | 3 = TIER1_RELS.has(relationType) ? 1
    : TIER2_RELS.has(relationType) ? 2 : 3
  // hop floor: at hop=2+ a 'father'-typed node is actually a grandparent → bump to ≥Tier 2
  const hopFloor: 0 | 2 | 3 = hopDistance >= 3 ? 3 : hopDistance >= 2 ? 2 : 0
  return Math.max(typeTier, hopFloor) as 0 | 1 | 2 | 3
}

export interface VisibleUniverseSet {
  visible: UniverseNode[]
  hiddenCount: number
  hiddenNodes: UniverseNode[]
  maxExpansionReached: boolean
}

const MAX_TOTAL_MOBILE  = 11
const MAX_TOTAL_DESKTOP = 17

export const BATCH_MOBILE  = 4
export const BATCH_DESKTOP = 6
export const MAX_EXPANDED_MOBILE  = 19
export const MAX_EXPANDED_DESKTOP = 29
const EXPANDED_SCALE   = 0.55
const EXPANDED_OPACITY = 0.40

// Priority within Tier 1 when total cap forces truncation:
// spouse/partner > parents > children > rest (deterministic by index)
const TIER1_PRIORITY_RELS = [
  'spouse', 'husband', 'wife', 'partner',
  'father', 'mother', 'stepfather', 'stepmother',
  'son', 'daughter', 'stepson', 'stepdaughter', 'stepchild',
]

/**
 * Filters nodes to the subset rendered in the active scene.
 * Enforces a hard total cap (11 mobile / 17 desktop) across all tiers.
 * Tier 3 is excluded entirely. Tier 1 is priority-truncated if needed;
 * excluded Tier 1 nodes appear in hiddenNodes for "Ver más".
 */
export function selectVisibleUniverseNodes(
  nodes: UniverseNode[],
  viewportWidth: number,
  additionalCount = 0,
): VisibleUniverseSet {
  const isMobile   = viewportWidth < 768
  const maxVisible = isMobile ? MAX_TOTAL_MOBILE : MAX_TOTAL_DESKTOP

  const t0   = nodes.filter(n => n.relevanceTier === 0)
  const t1All = nodes.filter(n => n.relevanceTier === 1)
  const t2All = nodes.filter(n => n.relevanceTier === 2)
  const t3   = nodes.filter(n => n.relevanceTier === 3)

  // Tier 1: sort by priority, then truncate to remaining capacity after focal
  const t1Sorted = [...t1All].sort((a, b) => {
    const pa = TIER1_PRIORITY_RELS.indexOf(a.relationType)
    const pb = TIER1_PRIORITY_RELS.indexOf(b.relationType)
    const ia = pa === -1 ? TIER1_PRIORITY_RELS.length : pa
    const ib = pb === -1 ? TIER1_PRIORITY_RELS.length : pb
    if (ia !== ib) return ia - ib
    return a.id < b.id ? -1 : 1
  })
  const t1Capacity = maxVisible - t0.length
  const t1Visible  = t1Sorted.slice(0, t1Capacity)
  const t1Hidden   = t1Sorted.slice(t1Capacity)

  // Tier 2: fill remaining capacity after focal + visible T1
  const t2Capacity = Math.max(0, maxVisible - t0.length - t1Visible.length)
  const t2Sorted = [...t2All].sort((a, b) => {
    if (a.hopDistance !== b.hopDistance) return a.hopDistance - b.hopDistance
    if (a.relationType < b.relationType) return -1
    if (a.relationType > b.relationType) return 1
    return a.id < b.id ? -1 : 1
  })
  const t2Visible = t2Sorted.slice(0, t2Capacity)
  const t2Hidden  = t2Sorted.slice(t2Capacity)

  // T3 sorted deterministically: by hop distance, then relation type, then stable id
  const t3Sorted = [...t3].sort((a, b) => {
    if (a.hopDistance !== b.hopDistance) return a.hopDistance - b.hopDistance
    if (a.relationType < b.relationType) return -1
    if (a.relationType > b.relationType) return 1
    return a.id < b.id ? -1 : 1
  })

  const allHidden = [...t1Hidden, ...t2Hidden, ...t3Sorted]

  const maxExpanded    = isMobile ? MAX_EXPANDED_MOBILE : MAX_EXPANDED_DESKTOP
  const baseCount      = t0.length + t1Visible.length + t2Visible.length
  const expansionCap   = Math.max(0, maxExpanded - baseCount)
  const expansionCount = Math.min(additionalCount, expansionCap, allHidden.length)
  const stillHidden    = allHidden.slice(expansionCount)

  const expandedNodes: UniverseNode[] = allHidden.slice(0, expansionCount).map(n =>
    n.relevanceTier === 3
      ? { ...n, scale: EXPANDED_SCALE, opacity: EXPANDED_OPACITY }
      : n,
  )

  return {
    visible:             [...t0, ...t1Visible, ...t2Visible, ...expandedNodes],
    hiddenCount:         stillHidden.length,
    hiddenNodes:         stillHidden,
    maxExpansionReached: baseCount + expansionCount >= maxExpanded && stillHidden.length > 0,
  }
}

// ─── D2: Perspective-correct relation resolution ──────────────────────────────

// Normalize focal-relation for composition (step/half variants → base)
function normFocalRel(rel: string): string {
  switch (rel) {
    case 'stepson': case 'stepchild': return 'son'
    case 'stepdaughter':              return 'daughter'
    case 'half_brother':              return 'brother'
    case 'half_sister':               return 'sister'
    case 'stepfather':                return 'father'
    case 'stepmother':                return 'mother'
    default: return rel
  }
}

// Given focal's and target's relation-to-root keys, return the relation key
// from focal's perspective (or undefined if unknown).
function composedRelKey(focalRelToRoot: string, targetRelToRoot: string): string | undefined {
  const fr = normFocalRel(focalRelToRoot)

  if (fr === 'son' || fr === 'daughter') {
    const map: Record<string, string> = {
      wife: 'mother', husband: 'father', spouse: 'mother', partner: 'mother',
      son: 'brother',        daughter: 'sister',
      stepson: 'brother',    stepdaughter: 'sister',    stepchild: 'brother',
      father: 'grandfather', mother: 'grandmother',
      stepfather: 'grandfather', stepmother: 'grandmother',
      grandfather: 'great_grandfather', grandmother: 'great_grandmother',
      grandfather_paternal: 'great_grandfather', grandmother_paternal: 'great_grandmother',
      grandfather_maternal: 'great_grandfather', grandmother_maternal: 'great_grandmother',
      brother: 'uncle',      sister: 'aunt',
      half_brother: 'uncle', half_sister: 'aunt',
      grandson: 'nephew',    granddaughter: 'niece',
      father_in_law: 'grandfather_maternal', mother_in_law: 'grandmother_maternal',
      brother_in_law: 'uncle_by_marriage',   sister_in_law:  'aunt_by_marriage',
    }
    return map[targetRelToRoot]
  }

  if (fr === 'wife' || fr === 'husband' || fr === 'spouse' || fr === 'partner') {
    const map: Record<string, string> = {
      son: 'son',               daughter: 'daughter',
      stepson: 'stepson',       stepdaughter: 'stepdaughter', stepchild: 'stepchild',
      father: 'father_in_law',  mother: 'mother_in_law',
      stepfather: 'father_in_law', stepmother: 'mother_in_law',
      brother: 'brother_in_law', sister: 'sister_in_law',
      half_brother: 'brother_in_law', half_sister: 'sister_in_law',
      grandfather: 'grandfather', grandmother: 'grandmother',
      grandfather_paternal: 'grandfather', grandmother_paternal: 'grandmother',
      grandfather_maternal: 'grandfather', grandmother_maternal: 'grandmother',
      grandson: 'grandson',     granddaughter: 'granddaughter',
      father_in_law: 'father',   mother_in_law: 'mother',
      brother_in_law: 'brother', sister_in_law:  'sister',
    }
    return map[targetRelToRoot]
  }

  if (fr === 'father' || fr === 'mother') {
    const map: Record<string, string> = {
      son: 'grandson',       daughter: 'granddaughter',
      stepson: 'grandson',   stepdaughter: 'granddaughter',
      wife: 'daughter_in_law', husband: 'son_in_law', spouse: 'son_in_law', partner: 'son_in_law',
      brother: 'brother',    sister: 'sister',
      half_brother: 'brother', half_sister: 'sister',
      father: 'grandfather', mother: 'grandmother',
      grandfather: 'great_grandfather', grandmother: 'great_grandmother',
      grandson: 'great_grandson', granddaughter: 'great_granddaughter',
    }
    return map[targetRelToRoot]
  }

  if (fr === 'brother' || fr === 'sister') {
    const map: Record<string, string> = {
      son: 'nephew',    daughter: 'niece',
      father: 'father', mother: 'mother',
      stepfather: 'stepfather', stepmother: 'stepmother',
      wife: 'sister_in_law', husband: 'brother_in_law',
      spouse: 'sister_in_law', partner: 'sister_in_law',
      brother: 'brother',    sister: 'sister',
      half_brother: 'brother', half_sister: 'sister',
      grandfather: 'grandfather', grandmother: 'grandmother',
      grandson: 'nephew',    granddaughter: 'niece',
    }
    return map[targetRelToRoot]
  }

  return undefined
}

// Given focal's relation to root, return the relation key from focal's perspective
// for the root node itself.
function invertRelKeyForRoot(
  focalRelToRoot: string,
  rootGender: string | null | undefined,
): string | null {
  const isFemale = rootGender === 'female'
  switch (normFocalRel(focalRelToRoot)) {
    case 'son':   case 'daughter':    return isFemale ? 'mother'        : 'father'
    case 'wife':                       return 'husband'
    case 'husband':                    return 'wife'
    case 'spouse':                     return 'spouse'
    case 'partner':                    return 'partner'
    case 'father': case 'mother':      return isFemale ? 'daughter'     : 'son'
    case 'brother': case 'sister':     return isFemale ? 'sister'       : 'brother'
    case 'grandfather': case 'grandmother': return isFemale ? 'granddaughter' : 'grandson'
    case 'grandson': case 'granddaughter': return isFemale ? 'grandmother'   : 'grandfather'
    case 'father_in_law': case 'mother_in_law': return isFemale ? 'daughter_in_law' : 'son_in_law'
    case 'son_in_law': case 'daughter_in_law':  return isFemale ? 'mother_in_law'   : 'father_in_law'
    case 'brother_in_law': case 'sister_in_law': return isFemale ? 'sister_in_law'  : 'brother_in_law'
    case 'uncle': case 'aunt':         return isFemale ? 'niece'        : 'nephew'
    case 'nephew': case 'niece':       return isFemale ? 'aunt'         : 'uncle'
    default: return null
  }
}

/** Graph passed to resolveRelationFromPerspective. Contains the node list and
 *  optionally the adjacency map for future multi-hop resolution. */
export interface UniverseRelationGraph {
  nodes: UniverseNode[]
  adj?: Map<string, Set<string>>
}

/**
 * Returns the Spanish relation label from `focal`'s perspective toward `target`,
 * or null when the composition is unknown (caller keeps the original label).
 *
 * All `relationType` fields in nodes are stored relative to `root` (the profile
 * owner). This function derives the focal's perspective through inversion and
 * composition — entirely based on relation keys, never on member identity.
 *
 * Returns null when:
 *   - focal IS root (labels already correct from root's perspective)
 *   - focal and target are the same node
 *   - focal's relationType is unknown or unresolvable
 *   - no composition rule exists for the given pair
 */
export function resolveRelationFromPerspective(
  focal: UniverseNode,
  target: UniverseNode,
  root: UniverseNode,
  _graph: UniverseRelationGraph,
): string | null {
  if (focal.id === target.id) return null
  if (focal.isRoot) return null

  const focalRelToRoot = focal.relationType
  if (!focalRelToRoot || focalRelToRoot === 'root') return null

  if (target.isRoot) {
    const key = invertRelKeyForRoot(focalRelToRoot, root.gender)
    return key ? resolveRelationLabel(null, key) : null
  }

  const key = composedRelKey(focalRelToRoot, target.relationType)
  return key ? resolveRelationLabel(null, key) : null
}

/**
 * Thin adapter over resolveRelationFromPerspective using string IDs.
 * Kept for backward compatibility with existing callers.
 */
export function resolveRelationFromFocal({
  focalId,
  targetId,
  nodes,
}: {
  focalId: string
  targetId: string
  nodes: UniverseNode[]
  links?: MemberLink[]
}): string | null {
  const focalNode  = nodes.find(n => n.id === focalId)
  const targetNode = nodes.find(n => n.id === targetId)
  const rootNode   = nodes.find(n => n.isRoot)
  if (!focalNode || !targetNode || !rootNode) return null
  return resolveRelationFromPerspective(focalNode, targetNode, rootNode, { nodes })
}

const ELDER_RELS = new Set(['grandfather', 'grandmother', 'grandfather_paternal',
  'grandmother_paternal', 'grandfather_maternal', 'grandmother_maternal',
  'great_grandfather', 'great_grandmother'])
const CHILD_RELS = new Set(['son', 'daughter', 'grandson', 'granddaughter',
  'great_grandson', 'great_granddaughter', 'nephew', 'niece',
  'stepson', 'stepdaughter', 'stepchild'])

function ageGroup(m: FamilyMember): 'child' | 'adult' | 'elder' {
  if (ELDER_RELS.has(m.relation_type)) return 'elder'
  if (CHILD_RELS.has(m.relation_type)) return 'child'
  return 'adult'
}

// Normalize angle to (-180, 180]
function norm(a: number): number {
  while (a >  180) a -= 360
  while (a <= -180) a += 360
  return a
}

// ─── Angle distribution ──────────────────────────────────────────────────────

// Group by relation base angle, spread same-type members around that base,
// then do a single forward sweep to enforce minimum separation.
function distributeOrbit(
  items: Array<{ id: string; relationType: string; preferredAngle: number }>,
  minSepDeg: number,
): Map<string, number> {
  if (items.length === 0) return new Map()

  // Group by relation type; spread within group
  const byRel = new Map<string, typeof items>()
  for (const it of items) {
    const k = it.relationType
    if (!byRel.has(k)) byRel.set(k, [])
    byRel.get(k)!.push(it)
  }

  const assigned: Array<{ id: string; angle: number }> = []
  byRel.forEach((group) => {
    const base = group[0].preferredAngle
    const n = group.length
    const spread = n === 1 ? 0 : Math.min(30, (n - 1) * 18)
    group.forEach((it, i) => {
      const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * 2
      assigned.push({ id: it.id, angle: norm(base + offset) })
    })
  })

  // Sort by angle for the sweep
  assigned.sort((a, b) => a.angle - b.angle)

  // Forward sweep: push apart pairs that are too close
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < assigned.length; i++) {
      const gap = norm(assigned[i].angle - assigned[i - 1].angle)
      if (gap < minSepDeg) {
        const push = (minSepDeg - gap) / 2
        assigned[i - 1].angle = norm(assigned[i - 1].angle - push)
        assigned[i].angle     = norm(assigned[i].angle     + push)
      }
    }
  }

  return new Map(assigned.map(a => [a.id, a.angle]))
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useUniverseLayout(
  focalId: string,
  profile: Profile,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
  memberLinks: MemberLink[],
): UniverseNode[] {
  return useMemo(() => {
    // 1. Adjacency map (bidirectional)
    const adj = new Map<string, Set<string>>()
    const edge = (a: string, b: string) => {
      if (!a || !b || a === b) return
      if (!adj.has(a)) adj.set(a, new Set())
      if (!adj.has(b)) adj.set(b, new Set())
      adj.get(a)!.add(b)
      adj.get(b)!.add(a)
    }

    // root ↔ every direct member
    for (const m of members) edge('root', m.id)

    // each extended member ↔ its connector member
    for (const e of extendedMembers) edge(e.member.id, e.parentMemberId)

    // cross-member links (e.g. sibling-to-sibling edges)
    for (const l of memberLinks) edge(l.fromMemberId, l.toMemberId)

    // parent_member_id links within members array
    for (const m of members) {
      if (m.parent_member_id) edge(m.id, m.parent_member_id)
    }

    // 2. BFS from focalId
    const dist = new Map<string, number>()
    const queue: string[] = [focalId]
    dist.set(focalId, 0)
    while (queue.length > 0) {
      const cur = queue.shift()!
      const d = dist.get(cur)!
      for (const nb of (adj.get(cur) ?? [])) {
        if (!dist.has(nb)) {
          dist.set(nb, d + 1)
          queue.push(nb)
        }
      }
    }

    // 3. Build node list
    const seen = new Set<string>()
    const nodes: UniverseNode[] = []

    const addNode = (node: UniverseNode) => {
      if (seen.has(node.id)) return
      seen.add(node.id)
      nodes.push(node)
    }

    // Root (profile)
    const rootHop = dist.get('root') ?? 999
    if (rootHop <= MAX_HOP) {
      const rootTier = resolveRelevanceTier('root', rootHop, focalId === 'root')
      addNode({
        id: 'root',
        memberId: undefined,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
        shortName: profile.first_name,
        relation: 'Tú',
        relationType: 'root',
        gender: profile.gender,
        avatarUrl: profile.avatar_url,
        isRoot: true,
        isFocal: focalId === 'root',
        hopDistance: rootHop,
        orbitRadius: ORBIT_RADII[Math.min(rootHop, MAX_HOP)],
        angleDeg: 0,
        cx: 0, cy: 0,
        relevanceTier: rootTier,
        scale: TIER_SCALES[rootTier] as number,
        opacity: TIER_OPACITY[rootTier] as number,
        zIndex: 10 - rootHop,
        ageGroup: 'adult',
        isDeceased: false,
        isJoined: true,
      })
    }

    // Direct members
    for (const m of members) {
      const hop = dist.get(m.id) ?? 999
      if (hop > MAX_HOP) continue
      const tier = resolveRelevanceTier(m.relation_type, hop, m.id === focalId)
      addNode({
        id: m.id,
        memberId: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        shortName: m.first_name,
        relation: resolveRelationLabel(null, m.relation_type),
        relationType: m.relation_type,
        gender: m.profile?.gender,
        avatarUrl: m.profile?.avatar_url,
        isRoot: false,
        isFocal: m.id === focalId,
        hopDistance: hop,
        orbitRadius: ORBIT_RADII[Math.min(hop, MAX_HOP)],
        angleDeg: 0,
        cx: 0, cy: 0,
        relevanceTier: tier,
        scale: TIER_SCALES[tier] as number,
        opacity: TIER_OPACITY[tier] as number,
        zIndex: 10 - hop,  // recomputed after positions are set
        ageGroup: ageGroup(m),
        isDeceased: m.is_deceased,
        isJoined: !!m.profile_id,
        parentMemberId: m.parent_member_id,
      })
    }

    // Extended members
    for (const e of extendedMembers) {
      const m = e.member
      const hop = dist.get(m.id) ?? 999
      if (hop > MAX_HOP) continue
      const tier = resolveRelevanceTier(m.relation_type, hop, m.id === focalId)
      addNode({
        id: m.id,
        memberId: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        shortName: m.first_name,
        relation: resolveRelationLabel(e.inferredRelation, m.relation_type),
        relationType: m.relation_type,
        gender: m.profile?.gender,
        avatarUrl: m.profile?.avatar_url,
        isRoot: false,
        isFocal: m.id === focalId,
        hopDistance: hop,
        orbitRadius: ORBIT_RADII[Math.min(hop, MAX_HOP)],
        angleDeg: 0,
        cx: 0, cy: 0,
        relevanceTier: tier,
        scale: TIER_SCALES[tier] as number,
        opacity: TIER_OPACITY[tier] as number,
        zIndex: 10 - hop,
        ageGroup: ageGroup(m),
        isDeceased: m.is_deceased,
        isJoined: !!m.profile_id,
        parentMemberId: e.parentMemberId,
      })
    }

    // D2: recompute relation labels from focal's perspective when focal is not root
    if (focalId !== 'root') {
      const focalNode = nodes.find(n => n.id === focalId)
      const rootNode  = nodes.find(n => n.isRoot)
      if (focalNode && focalNode.relationType && focalNode.relationType !== 'root' && rootNode) {
        const graph: UniverseRelationGraph = { nodes, adj }
        for (const n of nodes) {
          if (n.isFocal) continue
          const label = resolveRelationFromPerspective(focalNode, n, rootNode, graph)
          if (label !== null) n.relation = label
        }
      }
    }

    // 4. Assign hierarchical positions (generation rows — no orbital geometry)
    assignHierarchicalPositions(nodes)

    // 5. Recompute zIndex now that cx/cy are set
    for (const n of nodes) {
      n.zIndex = computeNodeZIndex(n.hopDistance, n.cy, n.isFocal)
    }

    // Sort back-to-front
    nodes.sort((a, b) => a.zIndex - b.zIndex)

    return nodes
  }, [focalId, profile, members, extendedMembers, memberLinks])
}
