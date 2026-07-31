import { useMemo } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'

// ─── Orbital geometry (kept for interface compatibility) ─────────────────────
const ORBIT_RADII  = [0, 115, 210, 295] as const
const MAX_HOP      = 3
// Scale and opacity are tier-based.
// Tier 0 = focal, 1 = intimate circle, 2 = close family, 3 = not rendered.
const TIER_SCALES  = [1.35, 0.90, 0.68, 0.0] as const
const TIER_OPACITY = [1.0,  1.0,  0.55, 0.0] as const

// REL_ANGLE kept for reference; no longer used for positioning.
const REL_ANGLE: Record<string, number> = {
  father: -120, mother: -60,
  grandfather: -130, grandmother: -55,
  grandfather_paternal: -137, grandmother_paternal: -124,
  grandfather_maternal: -56,  grandmother_maternal: -43,
  great_grandfather: -143,    great_grandmother: -37,
  uncle: -152,  aunt: -28,
  stepfather: -116, stepmother: -64,
  son: 78,  daughter: 102,
  grandson: 84, granddaughter: 96,
  great_grandson: 82, great_granddaughter: 98,
  nephew: 128,  niece: 52,
  stepson: 88,  stepdaughter: 92, stepchild: 90,
  spouse: -6, partner: 6, husband: -6, wife: 6,
  brother: 167,  sister: -167,
  half_brother: 158, half_sister: -158,
  cousin: 155,
  father_in_law: -106, mother_in_law: -74,
  brother_in_law: 177, sister_in_law: -177,
  son_in_law: 73, daughter_in_law: 107,
  other: 45,
}
// suppress "declared but not read" — REL_ANGLE is kept as documentation of preferred angles
void REL_ANGLE

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
const TIER1_RELS = new Set([
  'father', 'mother', 'son', 'daughter',
  'spouse', 'husband', 'wife', 'partner',
  'stepfather', 'stepmother', 'stepson', 'stepdaughter', 'stepchild',
])
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

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/**
 * Resolves a human-readable Spanish label for a relation.
 */
export function resolveRelationLabel(
  inferredRelation: string | null | undefined,
  relationType: string | null | undefined,
): string {
  if (inferredRelation) {
    const fromCatalog = RELATION_LABELS[inferredRelation]
    if (fromCatalog) return fromCatalog
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
const Z_FOCAL   = 400
const Z_BANDS   = [200, 130, 60] as const

/**
 * Deterministic z-index: deeper generations are behind; within the same level,
 * nodes with a higher cy (lower on screen) appear in front (pseudo-3D depth).
 */
export function computeNodeZIndex(hopDistance: number, cy: number, isFocal: boolean): number {
  if (isFocal) return Z_FOCAL
  const band    = Z_BANDS[Math.min(hopDistance - 1, Z_BANDS.length - 1)]
  const cyBonus = Math.round(Math.min(49, Math.max(0, (cy + 300) / 600 * 49)))
  return band + cyBonus
}

/**
 * Assigns a relevance tier relative to the current focal person.
 */
export function resolveRelevanceTier(
  relationType: string | null | undefined,
  hopDistance: number,
  isFocal: boolean,
): 0 | 1 | 2 | 3 {
  if (isFocal) return 0
  if (!relationType || relationType === 'root') {
    return (hopDistance >= 2 ? 2 : 1) as 1 | 2
  }
  const typeTier: 1 | 2 | 3 = TIER1_RELS.has(relationType) ? 1
    : TIER2_RELS.has(relationType) ? 2 : 3
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

const TIER1_PRIORITY_RELS = [
  'spouse', 'husband', 'wife', 'partner',
  'father', 'mother', 'stepfather', 'stepmother',
  'son', 'daughter', 'stepson', 'stepdaughter', 'stepchild',
]

/**
 * Filters nodes to the subset rendered in the active scene.
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

  const t2Capacity = Math.max(0, maxVisible - t0.length - t1Visible.length)
  const t2Sorted = [...t2All].sort((a, b) => {
    if (a.hopDistance !== b.hopDistance) return a.hopDistance - b.hopDistance
    if (a.relationType < b.relationType) return -1
    if (a.relationType > b.relationType) return 1
    return a.id < b.id ? -1 : 1
  })
  const t2Visible = t2Sorted.slice(0, t2Capacity)
  const t2Hidden  = t2Sorted.slice(t2Capacity)

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

export interface UniverseRelationGraph {
  nodes: UniverseNode[]
  adj?: Map<string, Set<string>>
}

/**
 * Returns the Spanish relation label from `focal`'s perspective toward `target`,
 * or null when the composition is unknown.
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

// ─── Hierarchical layout ─────────────────────────────────────────────────────

/**
 * Generation offset from root (negative = ancestors, positive = descendants).
 * Formula: generationFromFocal = GENERATION_MAP[relType] - GENERATION_MAP[focalRelType]
 */
export const GENERATION_MAP: Record<string, number> = {
  root: 0,
  great_grandfather: -3, great_grandmother: -3,
  grandfather: -2, grandmother: -2,
  grandfather_paternal: -2, grandmother_paternal: -2,
  grandfather_maternal: -2, grandmother_maternal: -2,
  uncle: -1, aunt: -1,
  uncle_by_marriage: -1, aunt_by_marriage: -1,
  father: -1, mother: -1,
  stepfather: -1, stepmother: -1,
  father_in_law: -1, mother_in_law: -1,
  spouse: 0, husband: 0, wife: 0, partner: 0,
  brother: 0, sister: 0, half_brother: 0, half_sister: 0,
  cousin: 0,
  brother_in_law: 0, sister_in_law: 0,
  son: 1, daughter: 1,
  stepson: 1, stepdaughter: 1, stepchild: 1,
  son_in_law: 1, daughter_in_law: 1,
  nephew: 1, niece: 1,
  grandson: 2, granddaughter: 2,
  great_grandson: 3, great_granddaughter: 3,
  other: 0,
}

/**
 * Left-to-right sort preference within a generation row.
 * Lower value = more to the left. Groups family units together:
 * ancestors: paternal-left / maternal-right, descendants: sons-center-left / daughters-center-right.
 */
export const X_ORDER: Record<string, number> = {
  // Gen -3
  great_grandfather: -30, great_grandmother: -10,
  // Gen -2
  grandfather_paternal: -25, grandmother_paternal: -15,
  grandfather_maternal:  15, grandmother_maternal:  25,
  grandfather: -20,          grandmother:            10,
  // Gen -1
  uncle: -60, aunt: -55, uncle_by_marriage: -45, aunt_by_marriage: -40,
  father: -20,     mother:      10,
  stepfather: -25, stepmother:  15,
  father_in_law:  60, mother_in_law: 70,
  // Gen 0
  cousin: -80,
  half_brother: -55, brother: -45,
  half_sister:  -35, sister:  -25,
  brother_in_law: -15, sister_in_law: 85,
  root: 0,
  spouse: 35, husband: 35, wife: 35, partner: 35,
  // Gen +1
  son_in_law:     -50, daughter_in_law: 50,
  son:             -10, daughter:        10,
  stepson:         -15, stepdaughter:    15, stepchild: 0,
  nephew: 65, niece: 75,
  // Gen +2
  grandson: -10, granddaughter: 10,
  // Gen +3
  great_grandson: -10, great_granddaughter: 10,
  other: 0,
}

/** Vertical distance in px between adjacent generation levels. */
export const VERT_STRIDE = 165
/** Base horizontal slot width in px per node (initial even spacing). */
const SLOT_W = 115
/** Minimum gap in px between adjacent bounding-box edges after anti-collision. */
const MIN_SEP = 20

/**
 * Approximate half-width of a node's bounding box (avatar + label) at its scale.
 * Used exclusively for collision detection; does not affect node rendering.
 */
export function nodeHalfBBox(scale: number): number {
  return (scale * 72 + 28) / 2
}

/**
 * Places every node in `nodes` on a generational grid.
 * Y-axis: generation × VERT_STRIDE (ancestors above, descendants below focal).
 * X-axis: sorted by X_ORDER preference, then placed with collision-free outward propagation.
 *
 * Rows containing the focal node use outward propagation from cx=0 (O(N), zero iterations).
 * Other rows use bidirectional sweeps (safe because SLOT_W > minDist for all non-focal tiers).
 * Modifies node.cx and node.cy in-place.
 */
export function hierarchicalLayout(nodes: UniverseNode[], focalRelType: string): void {
  const focalGen = GENERATION_MAP[focalRelType] ?? 0

  const nodeGen = (n: UniverseNode): number => {
    if (n.isFocal) return 0
    return (GENERATION_MAP[n.relationType] ?? 0) - focalGen
  }

  // Group by generation level relative to focal
  const byGen = new Map<number, UniverseNode[]>()
  for (const n of nodes) {
    const g = nodeGen(n)
    if (!byGen.has(g)) byGen.set(g, [])
    byGen.get(g)!.push(n)
  }

  byGen.forEach((row, genLevel) => {
    const genY = genLevel * VERT_STRIDE

    // Sort within row: left-to-right by preference, then stable by id
    row.sort((a, b) => {
      const oa = X_ORDER[a.relationType] ?? 0
      const ob = X_ORDER[b.relationType] ?? 0
      if (oa !== ob) return oa - ob
      return a.id < b.id ? -1 : 1
    })

    // Initial placement: evenly spaced, centered at x=0
    const N = row.length
    row.forEach((n, i) => {
      n.cx = N === 1 ? 0 : (i - (N - 1) / 2) * SLOT_W
      n.cy = genY
    })

    const focalIdx = row.findIndex(n => n.isFocal)

    if (focalIdx >= 0) {
      // ── Focal row: pin focal at cx=0 and propagate outward in O(N) ──────────
      // This guarantees zero collisions without iterative sweeps, because the focal
      // node (scale=1.35) is larger than SLOT_W allows for; sweeps would need many
      // passes to converge and are invalidated by the later `focal.cx = 0` override.
      row[focalIdx].cx = 0

      // Rightward propagation: each right-side node must clear the one to its left
      for (let i = focalIdx + 1; i < row.length; i++) {
        const prev = row[i - 1]; const curr = row[i]
        const minCx = prev.cx + nodeHalfBBox(prev.scale) + nodeHalfBBox(curr.scale) + MIN_SEP
        if (curr.cx < minCx) curr.cx = minCx
      }

      // Leftward propagation: each left-side node must clear the one to its right
      for (let i = focalIdx - 1; i >= 0; i--) {
        const next = row[i + 1]; const curr = row[i]
        const maxCx = next.cx - nodeHalfBBox(next.scale) - nodeHalfBBox(curr.scale) - MIN_SEP
        if (curr.cx > maxCx) curr.cx = maxCx
      }
    } else {
      // ── Non-focal rows: SLOT_W already satisfies minDist for same-tier nodes; ─
      // bidirectional sweeps handle any mixed-tier edge cases.
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 1; i < row.length; i++) {
          const a = row[i - 1]; const b = row[i]
          const minDist = nodeHalfBBox(a.scale) + nodeHalfBBox(b.scale) + MIN_SEP
          const gap = b.cx - a.cx
          if (gap < minDist) { const push = (minDist - gap) / 2; a.cx -= push; b.cx += push }
        }
        for (let i = row.length - 2; i >= 0; i--) {
          const a = row[i]; const b = row[i + 1]
          const minDist = nodeHalfBBox(a.scale) + nodeHalfBBox(b.scale) + MIN_SEP
          const gap = b.cx - a.cx
          if (gap < minDist) { const push = (minDist - gap) / 2; a.cx -= push; b.cx += push }
        }
      }
    }
  })
}

// ─── Main layout computation (pure, exported for testing) ─────────────────────

export function computeUniverseLayout(
  focalId: string,
  profile: Profile,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
  memberLinks: MemberLink[],
): UniverseNode[] {
  // 1. Adjacency map (bidirectional)
  const adj = new Map<string, Set<string>>()
  const edge = (a: string, b: string) => {
    if (!a || !b || a === b) return
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  for (const m of members) edge('root', m.id)
  for (const e of extendedMembers) edge(e.member.id, e.parentMemberId)
  for (const l of memberLinks) edge(l.fromMemberId, l.toMemberId)
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

  // Root (profile owner)
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
      zIndex: 10 - hop,
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

  // 4. Assign positions (hierarchical layout)
  const focal = nodes.find(n => n.isFocal)
  if (!focal) return nodes

  // angleDeg is zeroed; positions are fully determined by hierarchicalLayout
  for (const n of nodes) { n.angleDeg = 0 }

  const focalRelType = focal.isRoot ? 'root' : (focal.relationType ?? 'root')
  hierarchicalLayout(nodes, focalRelType)

  // Focal is always exactly at center
  focal.cx = 0
  focal.cy = 0

  // Recompute zIndex now that cy values are set
  for (const n of nodes) {
    n.zIndex = computeNodeZIndex(n.hopDistance, n.cy, n.isFocal)
  }

  // Sort back-to-front for rendering
  nodes.sort((a, b) => a.zIndex - b.zIndex)

  return nodes
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useUniverseLayout(
  focalId: string,
  profile: Profile,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
  memberLinks: MemberLink[],
): UniverseNode[] {
  return useMemo(
    () => computeUniverseLayout(focalId, profile, members, extendedMembers, memberLinks),
    [focalId, profile, members, extendedMembers, memberLinks],
  )
}

// hashId is used by AvatarFigure for deterministic avatar appearance
export { hashId }
