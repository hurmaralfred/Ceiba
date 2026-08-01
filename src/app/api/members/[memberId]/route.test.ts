// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

const mockCanEditPerson = vi.fn()
const mockServiceFrom = vi.fn()
vi.mock('@/lib/server/family', () => ({
  getServiceClient: () => ({ from: mockServiceFrom }),
  canEditPerson: mockCanEditPerson,
}))

// Reset all mock implementations before every test to prevent Once() queue leaks
beforeEach(() => { vi.resetAllMocks() })

// ─── Import under test (after mocks are in place) ─────────────────────────────

const { PATCH } = await import('./route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, memberId = 'person-1') {
  const req = new NextRequest(`http://localhost/api/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { req, params: { memberId } }
}

/** Builds a Supabase query chain that ends both maybySingle and single with `result`. */
function singleChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const end = () => Promise.resolve(result)
  chain.select   = () => chain
  chain.eq       = () => chain
  chain.update   = () => chain
  chain.insert   = () => Promise.resolve({ data: null, error: null })
  chain.maybeSingle = end
  chain.single   = end
  return chain
}

/** Chain where maybySingle returns the person but single returns the updated result. */
function updateChain(
  person: { id: string; created_by: string },
  updated: unknown,
) {
  const chain: Record<string, unknown> = {}
  chain.select      = () => chain
  chain.eq          = () => chain
  chain.update      = () => chain
  chain.insert      = () => Promise.resolve({ data: null, error: null })
  chain.maybySingle = () => Promise.resolve({ data: person, error: null }) // typo guard
  chain.maybeSingle = () => Promise.resolve({ data: person, error: null })
  chain.single      = () => Promise.resolve({ data: updated, error: null })
  return chain
}

// ─── Authentication ───────────────────────────────────────────────────────────

describe('PATCH /api/members/[memberId] — authentication', () => {
  it('returns 401 when no session exists', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const { req, params } = makeRequest({ first_name: 'Ana' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/autenticado/i)
  })
})

// ─── Authorization ────────────────────────────────────────────────────────────

describe('PATCH /api/members/[memberId] — authorization', () => {
  it('returns 404 when the person does not exist', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(singleChain({ data: null, error: null }))

    const { req, params } = makeRequest({ first_name: 'Ana' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(404)
  })

  it('returns 403 when authenticated user has no permission over a foreign person', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(singleChain({ data: { id: 'person-1', created_by: 'user-b' }, error: null }))
    mockCanEditPerson.mockResolvedValueOnce(false)

    const { req, params } = makeRequest({ first_name: 'Ana' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/permiso/i)
  })

  it('calls canEditPerson with the correct userId and personId', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(singleChain({ data: { id: 'person-42', created_by: 'user-b' }, error: null }))
    mockCanEditPerson.mockResolvedValueOnce(false)

    const { req, params } = makeRequest({ first_name: 'Ana' }, 'person-42')
    await PATCH(req, { params: { memberId: 'person-42' } })

    expect(mockCanEditPerson).toHaveBeenCalledWith(
      expect.anything(),
      'person-42',
      'user-a',
      'user-b',
    )
  })

  it('does not call update when authorization fails', async () => {
    const updateSpy = vi.fn()
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue({
      ...singleChain({ data: { id: 'person-1', created_by: 'user-b' }, error: null }),
      update: updateSpy,
    })
    mockCanEditPerson.mockResolvedValueOnce(false)

    const { req, params } = makeRequest({ first_name: 'Ana' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(403)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// ─── Authorized update ────────────────────────────────────────────────────────

describe('PATCH /api/members/[memberId] — authorized update', () => {
  it('returns 200 with the updated person for an authorized user', async () => {
    const person = { id: 'person-1', created_by: 'user-a' }
    const updated = { id: 'person-1', first_name: 'Carlos' }

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(updateChain(person, updated))
    mockCanEditPerson.mockResolvedValueOnce(true)

    const { req, params } = makeRequest({ first_name: 'Carlos' })
    const res = await PATCH(req, { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.person).toMatchObject({ first_name: 'Carlos' })
  })

  it('service role is used for DB writes (not client RLS)', async () => {
    // Verified structurally: the route imports getServiceClient() from server/family.ts,
    // which is instantiated with SUPABASE_SERVICE_ROLE_KEY (not the anon key).
    // This test confirms canEditPerson receives the service client, not the auth client.
    const person = { id: 'person-1', created_by: 'user-a' }
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(updateChain(person, person))
    mockCanEditPerson.mockResolvedValueOnce(true)

    const { req, params } = makeRequest({ first_name: 'X' })
    await PATCH(req, { params })

    // canEditPerson's first arg is the service client (has 'from' from mockServiceFrom)
    const serviceArg = mockCanEditPerson.mock.calls[0][0]
    expect(typeof serviceArg.from).toBe('function')
  })
})

// ─── photo_path validation ────────────────────────────────────────────────────

describe('PATCH /api/members/[memberId] — photo_path validation', () => {
  function setupAuthorized(person = { id: 'person-1', created_by: 'user-a' }) {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(updateChain(person, person))
    mockCanEditPerson.mockResolvedValueOnce(true)
  }

  it('rejects photo_path that starts with javascript:', async () => {
    setupAuthorized()
    const { req, params } = makeRequest({ photo_path: 'javascript:alert(1)' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/https/i)
  })

  it('rejects photo_path with http (non-https)', async () => {
    setupAuthorized()
    const { req, params } = makeRequest({ photo_path: 'http://evil.com/img.png' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })

  it('rejects a data: URI as photo_path', async () => {
    setupAuthorized()
    const { req, params } = makeRequest({ photo_path: 'data:image/png;base64,abc' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })

  it('rejects empty body with neither first_name nor photo_path', async () => {
    setupAuthorized()
    const { req, params } = makeRequest({})
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/requerido/i)
  })

  it('accepts a valid https photo_path from Supabase storage', async () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/avatars/member-photos/u/p.jpg'
    const person = { id: 'person-1', created_by: 'user-a' }
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(updateChain(person, { ...person, photo_path: url }))
    mockCanEditPerson.mockResolvedValueOnce(true)

    const { req, params } = makeRequest({ photo_path: url })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
  })

  it('accepts null photo_path alongside first_name (clears the photo)', async () => {
    const person = { id: 'person-1', created_by: 'user-a' }
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } } })
    mockServiceFrom.mockReturnValue(updateChain(person, { ...person, photo_path: null }))
    mockCanEditPerson.mockResolvedValueOnce(true)

    const { req, params } = makeRequest({ first_name: 'Ana', photo_path: null })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
  })
})
