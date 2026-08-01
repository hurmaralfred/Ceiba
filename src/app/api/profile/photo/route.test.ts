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

function setupHappyPath({
  userId = 'user-1',
  personId = 'person-1',
  uploadError = null as { message: string } | null,
  profileError = null as { message: string } | null,
  personError = null as { message: string } | null,
  publicUrl = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/user-1/person-1.jpg',
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })

  mockStorageFrom.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl } }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  })

  mockServiceFrom.mockImplementation((table: string) => {
    if (table === 'person_claims') {
      const c: Record<string, unknown> = {}
      c['select'] = () => c
      c['eq'] = () => c
      c['is'] = () => c
      c['maybeSingle'] = () => Promise.resolve({ data: { person_id: personId } })
      return c
    }
    if (table === 'profiles') {
      return { update: () => ({ eq: () => Promise.resolve({ error: profileError }) }) }
    }
    if (table === 'persons') {
      return { update: () => ({ eq: () => Promise.resolve({ error: personError }) }) }
    }
  })
}

// ── auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/profile/photo — auth', () => {
  it('returns 401 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/autenticado/i)
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
        c['maybeSingle'] = () => Promise.resolve({ data: null })
        return c
      }
    })
    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/identidad/i)
  })

  it('resolves personId from server claim — client cannot dictate it', async () => {
    // Even if the client appended a different personId in the form, the endpoint
    // reads person_claims server-side using the authenticated userId.
    setupHappyPath({ personId: 'server-person' })
    const fd = new FormData()
    fd.append('photo', makeFile())
    fd.append('personId', 'attacker-person')  // client-supplied, must be ignored
    const req = new NextRequest('http://localhost/api/profile/photo', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.personId).toBe('server-person')
  })
})

// ── file validation ───────────────────────────────────────────────────────────

describe('POST /api/profile/photo — file validation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const c: Record<string, unknown> = {}
    c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
    c['maybeSingle'] = () => Promise.resolve({ data: { person_id: 'person-1' } })
    mockServiceFrom.mockReturnValue(c)
    mockStorageFrom.mockReturnValue({})
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
        c['maybeSingle'] = () => Promise.resolve({ data: { person_id: 'person-1' } })
        return c
      }
      if (table === 'profiles') return { update: mockProfileUpdate }
      if (table === 'persons') return { update: mockPersonUpdate }
    })

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)
    expect(mockProfileUpdate).not.toHaveBeenCalled()
    expect(mockPersonUpdate).not.toHaveBeenCalled()
  })
})

// ── DB failure rollback ───────────────────────────────────────────────────────

describe('POST /api/profile/photo — DB failure rollback', () => {
  it('removes uploaded file and returns 500 when DB update fails', async () => {
    const mockRemove = vi.fn().mockResolvedValue({})

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.com/p.jpg' } }),
      remove: mockRemove,
    })
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'person_claims') {
        const c: Record<string, unknown> = {}
        c['select'] = () => c; c['eq'] = () => c; c['is'] = () => c
        c['maybeSingle'] = () => Promise.resolve({ data: { person_id: 'person-1' } })
        return c
      }
      if (table === 'profiles') {
        return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'profile DB error' } }) }) }
      }
      if (table === 'persons') {
        return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
      }
    })

    const res = await POST(makeRequest(makeFile()))
    expect(res.status).toBe(500)
    expect(mockRemove).toHaveBeenCalledWith(['member-photos/user-1/person-1.jpg'])
    expect((await res.json()).error).toMatch(/guardar/i)
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
    const body = await res.json()
    expect(body.avatarUrl).toMatch(/^https:\/\//)
  })

  it('updates profiles.avatar_path (storage key, not full URL)', async () => {
    const mockProfileEq = vi.fn().mockResolvedValue({ error: null })
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileEq })

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
        c['maybeSingle'] = () => Promise.resolve({ data: { person_id: 'person-99' } })
        return c
      }
      if (table === 'profiles') return { update: mockProfileUpdate }
      if (table === 'persons') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
    })

    await POST(makeRequest(makeFile()))
    expect(mockProfileUpdate).toHaveBeenCalledWith({ avatar_path: 'member-photos/user-42/person-99.jpg' })
    expect(mockProfileEq).toHaveBeenCalledWith('user_id', 'user-42')
  })

  it('updates persons.photo_path with the full public URL', async () => {
    const fullUrl = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/user-42/person-99.jpg'
    const mockPersonEq = vi.fn().mockResolvedValue({ error: null })
    const mockPersonUpdate = vi.fn().mockReturnValue({ eq: mockPersonEq })

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
        c['maybeSingle'] = () => Promise.resolve({ data: { person_id: 'person-99' } })
        return c
      }
      if (table === 'profiles') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
      if (table === 'persons') return { update: mockPersonUpdate }
    })

    await POST(makeRequest(makeFile()))
    expect(mockPersonUpdate).toHaveBeenCalledWith({ photo_path: fullUrl })
    expect(mockPersonEq).toHaveBeenCalledWith('id', 'person-99')
  })
})
