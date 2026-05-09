import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { Nomination } from '@ziggy/shared'

// Mutable in-memory store the cosmos mock reads from / writes to.
let store: Nomination[] = []

vi.mock('../lib/cosmos.js', () => ({
  ensureNominationsContainer: vi.fn(async () => {}),
  findActive: vi.fn(async (_container: string, _key: string, slug: string) =>
    store.filter((n) => n.eventSlug === slug && !n.deletedAt),
  ),
  findById: vi.fn(async (_container: string, id: string, slug: string) =>
    store.find((n) => n.id === id && n.eventSlug === slug),
  ),
  upsert: vi.fn(async (_container: string, item: Nomination) => {
    const i = store.findIndex((n) => n.id === item.id)
    if (i >= 0) store[i] = item
    else store.push(item)
    return item
  }),
  getContainer: vi.fn(),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    jwtSecret: 'x'.repeat(32),
    nodeEnv: 'test',
  }),
}))

vi.mock('../lib/auth.js', () => ({
  verifyToken: vi.fn((token: string) => {
    if (token === 'good-token') {
      return {
        sub: 'admin-1',
        email: 'admin@example.com',
        iss: 'ziggy',
        aud: 'ziggy-admin',
        iat: 0,
        exp: 0,
      }
    }
    throw new Error('Invalid token')
  }),
  signToken: vi.fn(),
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}))

vi.mock('../lib/audit.js', () => ({
  writeAudit: vi.fn(async () => {}),
}))

import adminNominations from './admin-nominations.js'

const SLUG = 'test-event'
const AUTH = { authorization: 'Bearer good-token' }

function makeNom(overrides: Partial<Nomination> = {}): Nomination {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    eventSlug: SLUG,
    nomineeName: 'Casey Candidate',
    nomineeEmail: 'casey@example.com',
    nomineePhone: '+31 612345678',
    reason: 'Built three open-source tools used across the community.',
    nominatorName: 'Nora Nominator',
    nominatorEmail: 'nora@example.com',
    nominatorPhone: '0612345678',
    consentToShareNomineeName: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    status: 'pending',
    ...overrides,
  }
}

function buildApp() {
  return new Hono().route('/', adminNominations)
}

beforeEach(() => {
  store = []
  vi.clearAllMocks()
})

describe('GET /api/admin/events/:slug/nominations', () => {
  it('returns 401 without a valid Bearer token', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/nominations`)
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid Bearer token', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/nominations`, {
      headers: { authorization: 'Bearer bad-token' },
    })
    expect(res.status).toBe(401)
  })

  it('lists active nominations sorted by createdAt desc', async () => {
    store.push(
      makeNom({ id: 'a', createdAt: '2025-01-01T00:00:00.000Z' }),
      makeNom({ id: 'b', createdAt: '2025-03-01T00:00:00.000Z' }),
      makeNom({ id: 'c', createdAt: '2025-02-01T00:00:00.000Z' }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/nominations`, {
      headers: AUTH,
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as Nomination[]
    expect(json.map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })

  it('excludes soft-deleted nominations', async () => {
    store.push(
      makeNom({ id: 'live', createdAt: '2025-01-01T00:00:00.000Z' }),
      makeNom({
        id: 'dead',
        createdAt: '2025-02-01T00:00:00.000Z',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/nominations`, {
      headers: AUTH,
    })
    const json = (await res.json()) as Nomination[]
    expect(json.map((n) => n.id)).toEqual(['live'])
  })

  it('filters by status=pending', async () => {
    store.push(
      makeNom({ id: 'p1', status: 'pending' }),
      makeNom({ id: 'v1', status: 'verified' }),
      makeNom({ id: 'r1', status: 'rejected' }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations?status=pending`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Nomination[]
    expect(json.map((n) => n.id)).toEqual(['p1'])
  })

  it('q matches nomineeName, nominatorName, or reason case-insensitively', async () => {
    store.push(
      makeNom({
        id: 'by-nominee',
        nomineeName: 'Foo Bar',
        nominatorName: 'X Y',
        reason: 'plain reason',
        createdAt: '2025-01-03T00:00:00.000Z',
      }),
      makeNom({
        id: 'by-nominator',
        nomineeName: 'A B',
        nominatorName: 'fOOOd Person',
        reason: 'plain',
        createdAt: '2025-01-02T00:00:00.000Z',
      }),
      makeNom({
        id: 'by-reason',
        nomineeName: 'C D',
        nominatorName: 'E F',
        reason: 'Mentioned the FOO project',
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      makeNom({
        id: 'no-match',
        nomineeName: 'No',
        nominatorName: 'Match',
        reason: 'totally other',
        createdAt: '2025-01-04T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations?q=foo`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Nomination[]
    expect(json.map((n) => n.id).sort()).toEqual(
      ['by-nominee', 'by-nominator', 'by-reason'].sort(),
    )
  })
})

describe('PATCH /api/admin/events/:slug/nominations/:id', () => {
  it('updates status and returns the new record', async () => {
    const n = makeNom({ id: 'x' })
    store.push(n)
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as Nomination
    expect(json.status).toBe('verified')
    expect(store[0].status).toBe('verified')
  })

  it('updates adminNotes and returns the new record', async () => {
    store.push(makeNom({ id: 'x' }))
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ adminNotes: 'Confirmed via LinkedIn' }),
      },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as Nomination
    expect(json.adminNotes).toBe('Confirmed via LinkedIn')
  })

  it('returns 404 when nomination is missing', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/nope`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      },
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when nomination is soft-deleted', async () => {
    store.push(makeNom({ id: 'x', deletedAt: '2025-02-02T00:00:00.000Z' }))
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      },
    )
    expect(res.status).toBe(404)
  })

  it('rejects an empty body (must change at least one field)', async () => {
    store.push(makeNom({ id: 'x' }))
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      {
        method: 'PATCH',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(400)
  })

  it('rejects a request without auth', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      },
    )
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/events/:slug/nominations/:id', () => {
  it('soft-deletes and returns 204; subsequent list excludes it', async () => {
    store.push(makeNom({ id: 'x', createdAt: '2025-01-01T00:00:00.000Z' }))
    const app = buildApp()
    const del = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      { method: 'DELETE', headers: AUTH },
    )
    expect(del.status).toBe(204)
    expect(await del.text()).toBe('')
    expect(store[0].deletedAt).toBeDefined()

    const list = await app.request(`/api/admin/events/${SLUG}/nominations`, {
      headers: AUTH,
    })
    const json = (await list.json()) as Nomination[]
    expect(json).toEqual([])
  })

  it('returns 404 when already deleted', async () => {
    store.push(
      makeNom({ id: 'x', deletedAt: '2025-02-02T00:00:00.000Z' }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      { method: 'DELETE', headers: AUTH },
    )
    expect(res.status).toBe(404)
  })

  it('rejects a request without auth', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations/x`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(401)
  })
})

describe('GET /api/admin/events/:slug/nominations.csv', () => {
  it('emits correct content-type, filename, and header row', async () => {
    store.push(
      makeNom({
        id: 'a',
        createdAt: '2025-03-01T10:00:00.000Z',
        nomineeName: 'Alice',
        nominatorName: 'Bob',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations.csv`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="nominations-${SLUG}.csv"`,
    )
    const body = await res.text()
    const [header, ...lines] = body.split('\r\n').filter(Boolean)
    expect(header).toBe(
      'createdAt,status,nomineeName,nomineeEmail,nomineePhone,reason,nominatorName,nominatorEmail,nominatorPhone,consent,adminNotes',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Alice')
    expect(lines[0]).toContain('Bob')
    expect(lines[0]).toContain('true') // consent
  })

  it('escapes commas, quotes, and newlines per RFC 4180', async () => {
    store.push(
      makeNom({
        id: 'a',
        createdAt: '2025-03-01T10:00:00.000Z',
        nomineeName: 'Last, First',
        nominatorName: 'Quote "Master"',
        reason: 'Line one\r\nLine two',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations.csv`,
      { headers: AUTH },
    )
    const body = await res.text()
    expect(body).toContain('"Last, First"')
    expect(body).toContain('"Quote ""Master"""')
    expect(body).toContain('"Line one\r\nLine two"')
  })

  it('excludes soft-deleted rows', async () => {
    store.push(
      makeNom({
        id: 'live',
        createdAt: '2025-01-01T00:00:00.000Z',
        nomineeName: 'LiveNominee',
      }),
      makeNom({
        id: 'dead',
        createdAt: '2025-02-01T00:00:00.000Z',
        nomineeName: 'DeadNominee',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations.csv`,
      { headers: AUTH },
    )
    const body = await res.text()
    expect(body).toContain('LiveNominee')
    expect(body).not.toContain('DeadNominee')
  })

  it('rejects a request without auth', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/nominations.csv`,
    )
    expect(res.status).toBe(401)
  })
})
