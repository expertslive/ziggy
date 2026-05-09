import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { KioskMeta } from '@ziggy/shared'

let store: KioskMeta[] = []

vi.mock('../lib/cosmos.js', () => ({
  ensureKiosksContainer: vi.fn(async () => {}),
  findActive: vi.fn(async (_container: string, _key: string, slug: string) =>
    store.filter((k) => k.eventSlug === slug && !k.deletedAt),
  ),
  findById: vi.fn(async (_container: string, id: string, slug: string) =>
    store.find((k) => k.id === id && k.eventSlug === slug),
  ),
  upsert: vi.fn(async (_container: string, item: KioskMeta) => {
    const i = store.findIndex((k) => k.id === item.id)
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

import adminKiosks from './admin-kiosks.js'

const SLUG = 'test-event'
const AUTH = { authorization: 'Bearer good-token' }

function makeKiosk(overrides: Partial<KioskMeta> = {}): KioskMeta {
  return {
    id: overrides.id ?? 'kiosk-ABCD',
    eventSlug: SLUG,
    displayName: 'Lobby Foyer',
    addedAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildApp() {
  return new Hono().route('/', adminKiosks)
}

beforeEach(() => {
  store = []
  vi.clearAllMocks()
})

describe('GET /api/admin/events/:slug/kiosks', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`)
    expect(res.status).toBe(401)
  })

  it('returns 401 with bad token', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      headers: { authorization: 'Bearer bad-token' },
    })
    expect(res.status).toBe(401)
  })

  it('lists active kiosks sorted by displayName asc', async () => {
    store.push(
      makeKiosk({ id: 'kiosk-A1', displayName: 'Charlie' }),
      makeKiosk({ id: 'kiosk-A2', displayName: 'alpha' }),
      makeKiosk({ id: 'kiosk-A3', displayName: 'Bravo' }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      headers: AUTH,
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as KioskMeta[]
    expect(json.map((k) => k.id)).toEqual(['kiosk-A2', 'kiosk-A3', 'kiosk-A1'])
  })

  it('excludes soft-deleted kiosks', async () => {
    store.push(
      makeKiosk({ id: 'kiosk-LIVE', displayName: 'Alive' }),
      makeKiosk({
        id: 'kiosk-DEAD',
        displayName: 'Dead',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      headers: AUTH,
    })
    const json = (await res.json()) as KioskMeta[]
    expect(json.map((k) => k.id)).toEqual(['kiosk-LIVE'])
  })
})

describe('POST /api/admin/events/:slug/kiosks', () => {
  it('creates a new kiosk record', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'kiosk-3F2A',
        displayName: 'Hall 3 Floor',
        shortCode: 'H3F',
        location: 'Hall 3 — Speakers entrance',
      }),
    })
    expect(res.status).toBe(201)
    const json = (await res.json()) as KioskMeta
    expect(json.id).toBe('kiosk-3F2A')
    expect(json.displayName).toBe('Hall 3 Floor')
    expect(json.shortCode).toBe('H3F')
    expect(json.location).toBe('Hall 3 — Speakers entrance')
    expect(json.eventSlug).toBe(SLUG)
    expect(json.addedAt).toBeDefined()
    expect(json.updatedAt).toBeDefined()
    expect(store).toHaveLength(1)
  })

  it('rejects duplicate id with 409', async () => {
    store.push(makeKiosk({ id: 'kiosk-DUP' }))
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'kiosk-DUP',
        displayName: 'Duplicate',
      }),
    })
    expect(res.status).toBe(409)
  })

  it('allows recreating a previously soft-deleted id', async () => {
    store.push(
      makeKiosk({
        id: 'kiosk-OLD',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'kiosk-OLD',
        displayName: 'Reborn',
      }),
    })
    expect(res.status).toBe(201)
  })

  it('rejects invalid id pattern', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'not-a-kiosk',
        displayName: 'Bad',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing displayName', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'kiosk-ABCD' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects bad shortCode pattern', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'kiosk-ABCD',
        displayName: 'Foo',
        shortCode: 'lowercase',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid JSON', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('rejects without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'kiosk-ABCD', displayName: 'X' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/admin/events/:slug/kiosks/:id', () => {
  it('updates displayName and bumps updatedAt', async () => {
    store.push(makeKiosk({ id: 'kiosk-UPD', displayName: 'Old' }))
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-UPD`, {
      method: 'PUT',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'New' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as KioskMeta
    expect(json.displayName).toBe('New')
    expect(store[0].displayName).toBe('New')
    expect(store[0].updatedAt).not.toBe('2025-01-01T00:00:00.000Z')
  })

  it('updates shortCode + location together', async () => {
    store.push(makeKiosk({ id: 'kiosk-MULTI' }))
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/kiosks/kiosk-MULTI`,
      {
        method: 'PUT',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ shortCode: 'AB12', location: 'Hall 1' }),
      },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as KioskMeta
    expect(json.shortCode).toBe('AB12')
    expect(json.location).toBe('Hall 1')
  })

  it('rejects empty body (must change at least one field)', async () => {
    store.push(makeKiosk({ id: 'kiosk-EMPTY' }))
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/kiosks/kiosk-EMPTY`,
      {
        method: 'PUT',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(400)
  })

  it('rejects invalid shortCode', async () => {
    store.push(makeKiosk({ id: 'kiosk-BAD' }))
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-BAD`, {
      method: 'PUT',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ shortCode: 'too-long-and-lowercase' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when missing', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/kiosks/kiosk-NOPE`,
      {
        method: 'PUT',
        headers: { ...AUTH, 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'X' }),
      },
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when soft-deleted', async () => {
    store.push(
      makeKiosk({
        id: 'kiosk-DEL',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-DEL`, {
      method: 'PUT',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'X' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-X`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'X' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/admin/events/:slug/kiosks/:id', () => {
  it('soft-deletes and returns 204; subsequent list excludes it', async () => {
    store.push(makeKiosk({ id: 'kiosk-GONE', displayName: 'Bye' }))
    const app = buildApp()
    const del = await app.request(
      `/api/admin/events/${SLUG}/kiosks/kiosk-GONE`,
      { method: 'DELETE', headers: AUTH },
    )
    expect(del.status).toBe(204)
    expect(await del.text()).toBe('')
    expect(store[0].deletedAt).toBeDefined()

    const list = await app.request(`/api/admin/events/${SLUG}/kiosks`, {
      headers: AUTH,
    })
    const json = (await list.json()) as KioskMeta[]
    expect(json).toEqual([])
  })

  it('returns 404 when already deleted', async () => {
    store.push(
      makeKiosk({
        id: 'kiosk-X',
        deletedAt: '2025-02-02T00:00:00.000Z',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-X`, {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when missing', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/kiosks/kiosk-NOPE`,
      { method: 'DELETE', headers: AUTH },
    )
    expect(res.status).toBe(404)
  })

  it('rejects without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/kiosks/kiosk-X`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })
})
