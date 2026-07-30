import { useMemo } from 'react'
import type { Profile, FamilyMember } from '@/lib/types'
import type { ExtendedEntry, MemberLink } from '@/components/tree/FamilyTreeGraph'

// ─── Orbital geometry ───────────────────────────────────────────────────────
const ORBIT_RADII   = [0, 115, 210, 295] as const
const ORBIT_SCALES  = [1.0, 0.76, 0.56, 0.41] as const
const ORBIT_OPACITY = [1.0, 0.93, 0.76, 0.58] as const
const MAX_HOP       = 3

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
  nephew: 'Sobrino', niece: 'Sobrina',
  father_in_law: 'Suegro', mother_in_law: 'Suegra',
  brother_in_law: 'Cuñado', sister_in_law: 'Cuñada',
  son_in_law: 'Yerno', daughter_in_law: 'Nuera',
  stepfather: 'Padrastro', stepmother: 'Madrastra',
  stepson: 'Hijastro', stepdaughter: 'Hijastra', stepchild: 'Hijastro/a',
  other: 'Familiar',
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
        scale: ORBIT_SCALES[Math.min(rootHop, MAX_HOP)],
        opacity: ORBIT_OPACITY[Math.min(rootHop, MAX_HOP)],
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
      addNode({
        id: m.id,
        memberId: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        shortName: m.first_name,
        relation: RELATION_LABELS[m.relation_type] ?? 'Familiar',
        relationType: m.relation_type,
        gender: m.profile?.gender,
        avatarUrl: m.profile?.avatar_url,
        isRoot: false,
        isFocal: m.id === focalId,
        hopDistance: hop,
        orbitRadius: ORBIT_RADII[Math.min(hop, MAX_HOP)],
        angleDeg: 0,
        cx: 0, cy: 0,
        scale: ORBIT_SCALES[Math.min(hop, MAX_HOP)],
        opacity: ORBIT_OPACITY[Math.min(hop, MAX_HOP)],
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
      addNode({
        id: m.id,
        memberId: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        shortName: m.first_name,
        relation: e.inferredRelation ?? RELATION_LABELS[m.relation_type] ?? 'Familiar',
        relationType: m.relation_type,
        gender: m.profile?.gender,
        avatarUrl: m.profile?.avatar_url,
        isRoot: false,
        isFocal: m.id === focalId,
        hopDistance: hop,
        orbitRadius: ORBIT_RADII[Math.min(hop, MAX_HOP)],
        angleDeg: 0,
        cx: 0, cy: 0,
        scale: ORBIT_SCALES[Math.min(hop, MAX_HOP)],
        opacity: ORBIT_OPACITY[Math.min(hop, MAX_HOP)],
        zIndex: 10 - hop,
        ageGroup: ageGroup(m),
        isDeceased: m.is_deceased,
        isJoined: !!m.profile_id,
        parentMemberId: e.parentMemberId,
      })
    }

    // 4. Assign angles
    const focal = nodes.find(n => n.isFocal)
    if (!focal) return nodes

    // Build angle-to-orbit-1-parent map for hop-2+ nodes
    const orbit1AngleById = new Map<string, number>()

    // ── Orbit 1 ──────────────────────────────────────────────────────────────
    const orbit1 = nodes.filter(n => n.hopDistance === 1)
    if (orbit1.length > 0) {
      const items = orbit1.map(n => ({
        id: n.id,
        relationType: n.relationType,
        preferredAngle: REL_ANGLE[n.relationType] ?? (hashId(n.id) % 360) - 180,
      }))
      const angles = distributeOrbit(items, 32)
      for (const n of orbit1) {
        const a = angles.get(n.id) ?? 0
        n.angleDeg = a
        const rad = a * Math.PI / 180
        n.cx = n.orbitRadius * Math.cos(rad)
        n.cy = n.orbitRadius * Math.sin(rad)
        orbit1AngleById.set(n.id, a)
      }
    }

    // ── Orbit 2+ ─────────────────────────────────────────────────────────────
    for (let hop = 2; hop <= MAX_HOP; hop++) {
      const orbitN = nodes.filter(n => n.hopDistance === hop)
      if (orbitN.length === 0) continue

      // Map each hop-N node to its parent hop-(N-1) angle
      const parentAngleOf = (n: UniverseNode): number => {
        // Try parentMemberId first, then adjacency
        if (n.parentMemberId) {
          const pa = orbit1AngleById.get(n.parentMemberId)
          if (pa !== undefined) return pa
        }
        for (const nb of (adj.get(n.id) ?? [])) {
          const pa = orbit1AngleById.get(nb)
          if (pa !== undefined) return pa
        }
        return REL_ANGLE[n.relationType] ?? (hashId(n.id) % 360) - 180
      }

      const items = orbitN.map(n => ({
        id: n.id,
        relationType: n.relationType,
        preferredAngle: norm(parentAngleOf(n) + ((hashId(n.id) % 40) - 20)),
      }))
      const angles = distributeOrbit(items, 22)

      for (const n of orbitN) {
        const a = angles.get(n.id) ?? 0
        n.angleDeg = a
        const rad = a * Math.PI / 180
        n.cx = n.orbitRadius * Math.cos(rad)
        n.cy = n.orbitRadius * Math.sin(rad)
        orbit1AngleById.set(n.id, a) // expose to next orbit
      }
    }

    // Focal always at center
    focal.cx = 0
    focal.cy = 0

    // Sort back-to-front
    nodes.sort((a, b) => a.zIndex - b.zIndex)

    return nodes
  }, [focalId, profile, members, extendedMembers, memberLinks])
}
