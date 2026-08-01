// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

const mockServiceFrom = vi.fn()
const mockStorageFrom = vi.fn()
vi.mock('@/lib/server/family', () => ({
  getServiceClient: () => ({
    from: mockServiceFrom,
    storage: { from: mockStorageFrom },
  }),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

const { POST } = await import('./route')

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(bytes = 100, type = 'image/jpeg', name = 'photo.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

function makeRequest(file: File | null, extra?: Record<string, string>): NextRequest {
  const fd = new FormData()
  if (file) fd.append('photo', file)
  if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
  return new NextRequest('http://localhost/api/profile/photo', { method: 'POST', body: fd })
}

/**
 * Build mocks for the full happy path.
 * profiles mock handles BOTH:
 *   - select("avatar_path").eq().maybySingle()  ← read prevAvatarPath (step 3)
 *   - update({...}).eq()                        ← write new path (step 8)
 */
function setupHappyPath({
  userId = 'user-1',
  personId = 'person-1',
  prevAvatarPath = null as string | null,
  uploadError = null as { message: string } | null,
  profileSelectError = null as { message: string } | null,
  profileUpdateError = null as { message: string } | null,
  personError = null as { message: string } | null,
  publicUrl = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/user-1/person-1.jpg',
  claimError = null as { message: string } | null,
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })

  const mockRemove = vi.fn().mockResolvedValue({})
  mockStorageFrom.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl } }),
    remove: mockRemove,
  })

  mockServiceFrom.mockImplementation((table: string) => {
    if (table === 'person_claims') {
      const c: Record<string, unknown> = {}
      c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
      c['maybySingle'] = () => Promise.resolve(
        claimError
          ? { data: null, error: claimError }
          : { data: personId ? { person_id: personId } : null, error: null }
      )
      c['maybeSingle'] = c['maybySingle']
      return c
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybySingle: () => Promise.resolve({ data: { avatar_path: prevAvatarPath }, error: profileSelectError }),
            maybeSingle: () => Promise.resolve({ data: { avatar_path: prevAvatarPath }, error: profileSelectError }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: profileUpdateError }),
          catch: (fn: () => void) => Promise.resolve({ error: profileUpdateError }).catch(fn),
        }),
      }
    }
    if (table === 'persons') {
      return {
        update: () => ({ eq: () => Promise.resolve({ error: personError }) }),
      }
    }
  })

  return { mockRemove }
}

// ── auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/profile/photo — auth', () => {
  it('returns 401 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/autenticado/i)
  })
})

// ── claim resolution ──────────────────────────────────────────────────────────

describe('POST /api/profile/photo — claim', () => {
  it('returns 409 when user has no approved claim', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStorageFrom.mockReturnValue({})
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: null, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
    })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/identidad/i)
  })

  it('returns 500 when claim query errors (e.g. multiple active claims)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStorageFrom.mockReturnValue({})
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: null, error: { message: 'multiple rows returned' } })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
    })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/identidad/i)
  })

  it('resolves personId from server claim — client-supplied personId field is ignored', async () => {
    setupHappyPath({ personId: 'server-person' })
    const fd = new FormData()
    fd.append('photo', makeFile())
    fd.append('personId', 'attacker-person')
    const req = new NextRequest('http://localhost/api/profile/photo', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect((await res.json()).personId).toBe('server-person')
  })
})

// ── file validation ───────────────────────────────────────────────────────────

describe('POST /api/profile/photo — file validation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStorageFrom.mockReturnValue({})
    // claim resolves, profiles select returns prev=null, no upload needed
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-1' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
    })
  })

  it('returns 400 when photo field is absent', async () => {
    const req = new NextRequest('http://localhost/api/profile/photo', {
      method: 'POST',
      body: new FormData(),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/archivo/i)
  })

  it('returns 400 for disallowed MIME type (image/gif)', async () => {
    const res = await POST(makeRequest(makeFile(100, 'image/gif', 'photo.gif')))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/tipo/i)
  })

  it('returns 400 for disallowed MIME type (application/pdf)', async () => {
    const res = await POST(makeRequest(makeFile(100, 'application/pdf', 'doc.pdf')))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/tipo/i)
  })

  it('returns 400 when file exceeds 5 MB', async () => {
    const bigFile = makeFile(6 * 1024 * 1024, 'image/jpeg')
    const res = await POST(makeRequest(bigFile))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/5 MB/i)
  })

  it('accepts image/jpeg', async () => {
    setupHappyPath()
    const res = await POST(makeRequest(makeFile(100, 'image/jpeg')))
    expect(res.status).toBe(200)
  })

  it('accepts image/png', async () => {
    setupHappyPath()
    const res = await POST(makeRequest(makeFile(100, 'image/png', 'photo.png')))
    expect(res.status).toBe(200)
  })

  it('accepts image/webp', async () => {
    setupHappyPath()
    const res = await POST(makeRequest(makeFile(100, 'image/webp', 'photo.webp')))
    expect(res.status).toBe(200)
  })
})

// ── storage upload failure ────────────────────────────────────────────────────

describe('POST /api/profile/photo — upload failure', () => {
  it('returns 500 and does NOT write to DB when upload fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockProfileUpdate = vi.fn()
    const mockPersonUpdate = vi.fn()

    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'storage error' } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.com/p.jpg' } }),
      remove: vi.fn().mockResolvedValue({}),
    })

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-1' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }) }) }),
          update: mockProfileUpdate,
        }
      }
      if (table === 'persons') return { update: mockPersonUpdate }
    })

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)
    expect(mockProfileUpdate).not.toHaveBeenCalled()
    expect(mockPersonUpdate).not.toHaveBeenCalled()
  })
})

// ── profiles write failure ────────────────────────────────────────────────────

describe('POST /api/profile/photo — profiles write failure', () => {
  it('returns 500, deletes uploaded file, does NOT write to persons', async () => {
    const mockPersonUpdate = vi.fn()
    const { mockRemove } = setupHappyPath({ profileUpdateError: { message: 'profile DB error' } })

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-1' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: 'old/path.jpg' }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: 'old/path.jpg' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: { message: 'profile DB error' } }) }),
        }
      }
      if (table === 'persons') return { update: mockPersonUpdate }
    })

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)
    expect(mockRemove).toHaveBeenCalledWith(['member-photos/user-1/person-1.jpg'])
    expect(mockPersonUpdate).not.toHaveBeenCalled()
  })
})

// ── persons write failure + compensation ─────────────────────────────────────

describe('POST /api/profile/photo — persons write failure (compensation)', () => {
  it('returns 500, restores profiles.avatar_path to previous value, deletes uploaded file', async () => {
    const mockProfileRestore = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) })

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const mockRemove = vi.fn().mockResolvedValue({})
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.com/p.jpg' } }),
      remove: mockRemove,
    })

    let profileUpdateCallCount = 0
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-1' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: 'old/prev.jpg' }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: 'old/prev.jpg' }, error: null }) }) }),
          update: (patch: Record<string, unknown>) => {
            profileUpdateCallCount++
            if (profileUpdateCallCount === 1) {
              // First update: write new avatar_path — succeeds
              return { eq: () => Promise.resolve({ error: null }) }
            }
            // Second update (compensation): restore to previous value
            mockProfileRestore(patch)
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
      }
      if (table === 'persons') {
        return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'persons DB error' } }) }) }
      }
    })

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)

    // Compensation: profiles restored to previous value
    expect(mockProfileRestore).toHaveBeenCalledWith({ avatar_path: 'old/prev.jpg' })

    // Compensation: uploaded file deleted
    expect(mockRemove).toHaveBeenCalledWith(['member-photos/user-1/person-1.jpg'])

    expect((await res.json()).error).toMatch(/genealógicos/i)
  })

  it('null prevAvatarPath: compensation restores profiles.avatar_path to null', async () => {
    const mockProfileRestore = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) })

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.com/p.jpg' } }),
      remove: vi.fn().mockResolvedValue({}),
    })

    let profileUpdateCallCount = 0
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-1' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }) }) }),
          update: (patch: Record<string, unknown>) => {
            profileUpdateCallCount++
            if (profileUpdateCallCount === 1) return { eq: () => Promise.resolve({ error: null }) }
            mockProfileRestore(patch)
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
      }
      if (table === 'persons') {
        return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'persons error' } }) }) }
      }
    })

    await POST(makeRequest(makeFile()))
    expect(mockProfileRestore).toHaveBeenCalledWith({ avatar_path: null })
  })
})

// ── success ───────────────────────────────────────────────────────────────────

describe('POST /api/profile/photo — success', () => {
  it('returns 200 with personId and avatarUrl', async () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/user-1/person-1.jpg'
    setupHappyPath({ publicUrl: url })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.personId).toBe('person-1')
    expect(body.avatarUrl).toBe(url)
  })

  it('avatarUrl is a full HTTPS URL', async () => {
    setupHappyPath()
    const res = await POST(makeRequest(makeFile()))
    expect((await res.json()).avatarUrl).toMatch(/^https:\/\//)
  })

  it('updates profiles.avatar_path with the storage key (not full URL)', async () => {
    const mockProfileUpdateFn = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) })

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.com/photo.jpg' } }),
      remove: vi.fn(),
    })
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-99' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }) }) }),
          update: mockProfileUpdateFn,
        }
      }
      if (table === 'persons') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
    })

    await POST(makeRequest(makeFile()))
    expect(mockProfileUpdateFn).toHaveBeenCalledWith({ avatar_path: 'member-photos/user-42/person-99.jpg' })
  })

  it('updates persons.photo_path with the full public URL', async () => {
    const fullUrl = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/user-42/person-99.jpg'
    const mockPersonUpdateFn = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) })

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: fullUrl } }),
      remove: vi.fn(),
    })
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybySingle'] = () => Promise.resolve({ data: { person_id: 'person-99' }, error: null })
        c['maybeSingle'] = c['maybySingle']
        return c
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybySingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }), maybeSingle: () => Promise.resolve({ data: { avatar_path: null }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'persons') return { update: mockPersonUpdateFn }
    })

    await POST(makeRequest(makeFile()))
    expect(mockPersonUpdateFn).toHaveBeenCalledWith({ photo_path: fullUrl })
  })
})
