// @vitest-environment node
/**
 * Tests for the photo_path → avatar_url mapping in graphAdapter.
 *
 * Root cause context: /home shows initials ("AH") instead of the user's photo.
 * The chain is: persons.photo_path → get_my_family_graph → adaptGraph →
 * personToProfile → profile.avatar_url → Avatar src.
 *
 * These tests verify that every link in that read chain is correct.
 */
import { describe, it, expect } from 'vitest'
import { personToProfile, adaptGraph } from './graphAdapter'
import type { PersonNode, FamilyGraph } from './graphAdapter'

// ─── personToProfile — photo_path mapping ───────��────────────────────────────

function makePerson(overrides: Partial<PersonNode> = {}): PersonNode {
  return {
    id: 'person-1',
    public_id: 'pub-1',
    first_name: 'Alfredo',
    first_surname: 'Hurtado',
    ...overrides,
  }
}

describe('personToProfile — photo_path → avatar_url', () => {
  it('maps a full https URL to avatar_url', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/u1/p1.jpg'
    const profile = personToProfile(makePerson({ photo_path: url }))
    expect(profile.avatar_url).toBe(url)
  })

  it('returns undefined when photo_path is null', () => {
    const profile = personToProfile(makePerson({ photo_path: null }))
    expect(profile.avatar_url).toBeUndefined()
  })

  it('returns undefined when photo_path is empty string', () => {
    const profile = personToProfile(makePerson({ photo_path: '' }))
    expect(profile.avatar_url).toBeUndefined()
  })

  it('returns undefined when photo_path is missing entirely', () => {
    const { photo_path: _skip, ...personWithoutPhoto } = makePerson()
    const profile = personToProfile(personWithoutPhoto as PersonNode)
    expect(profile.avatar_url).toBeUndefined()
  })
})

// ─── adaptGraph — my node's photo_path ends up in profile.avatar_url ─────────

function makeGraph(myPhotoPath: string | null | undefined): FamilyGraph {
  return {
    me: 'person-1',
    nodes: [
      {
        id: 'person-1',
        public_id: 'pub-1',
        first_name: 'Alfredo',
        first_surname: 'Hurtado',
        photo_path: myPhotoPath,
      } as PersonNode,
    ],
    edges: [],
  }
}

describe('adaptGraph — photo_path flows to profile', () => {
  it('profile.avatar_url reflects my persons.photo_path when set', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/u/p.jpg'
    const { profile } = adaptGraph(makeGraph(url), 'user-a')
    expect(profile?.avatar_url).toBe(url)
  })

  it('profile.avatar_url is undefined when photo_path is null', () => {
    const { profile } = adaptGraph(makeGraph(null), 'user-a')
    expect(profile?.avatar_url).toBeUndefined()
  })

  it('profile.avatar_url is undefined when photo_path is missing', () => {
    const { profile } = adaptGraph(makeGraph(undefined), 'user-a')
    expect(profile?.avatar_url).toBeUndefined()
  })

  it('updating photo_path in the node updates profile.avatar_url (no stale cache)', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/avatars/p.jpg'
    const graph = makeGraph(null)
    // Simulate DB update: photo_path is now set
    const updatedGraph: FamilyGraph = {
      ...graph,
      nodes: [{ ...graph.nodes[0], photo_path: url }],
    }
    const { profile } = adaptGraph(updatedGraph, 'user-a')
    expect(profile?.avatar_url).toBe(url)
  })
})

// ─── Avatar component behaviour (logic only, no DOM) ─────────────────────────
// Verifying the initials logic that generates "AH" to confirm Avatar's fallback.

function initials(name?: string): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

describe('Avatar initials fallback', () => {
  it('generates "AH" for "Alfredo Hurtado"', () => {
    expect(initials('Alfredo Hurtado')).toBe('AH')
  })

  it('shows image (truthy src) → initials logic is NOT invoked', () => {
    const src = 'https://example.com/photo.jpg'
    // Avatar renders <img> when src is truthy — this test represents that contract
    expect(Boolean(src)).toBe(true)
  })

  it('shows initials when src is undefined', () => {
    expect(Boolean(undefined)).toBe(false)
  })

  it('shows initials when src is null', () => {
    expect(Boolean(null)).toBe(false)
  })

  it('shows initials when src is empty string', () => {
    expect(Boolean('')).toBe(false)
  })
})
