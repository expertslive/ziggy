import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/cosmos.js', () => ({
  findById: vi.fn(),
  findAll: vi.fn(async () => []),
}))
vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    nodeEnv: 'test',
  }),
}))
vi.mock('../lib/run-events.js', () => ({
  fetchRawAgenda: vi.fn(),
  fetchSpeakers: vi.fn(async () => []),
  fetchBooths: vi.fn(async () => []),
  fetchPartnerships: vi.fn(async () => []),
  searchAgenda: vi.fn(async () => []),
  fetchAgenda: vi.fn(async () => ({ days: [], timeZone: 'Europe/Amsterdam' })),
}))

import { findById } from '../lib/cosmos.js'
import * as runEvents from '../lib/run-events.js'
import events from './events.js'

const SECRET_KEYS = ['apiKey', 'passwordHash', 'connectionString', 'token', 'secret', 'clientSecret']

function assertNoSecretShapedKeys(obj: unknown, path = '$'): void {
  if (obj === null || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    for (const secret of SECRET_KEYS) {
      if (k.toLowerCase().includes(secret.toLowerCase())) {
        throw new Error(`Secret-shaped key "${k}" at ${path}`)
      }
    }
    assertNoSecretShapedKeys(v, `${path}.${k}`)
  }
}

describe('GET /api/events/:slug/config', () => {
  const app = new Hono().route('/', events)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no secret-shaped keys even when Cosmos doc contains them', async () => {
    vi.mocked(findById).mockResolvedValueOnce({
      id: 'test-event',
      slug: 'test-event',
      name: 'Test',
      timezone: 'Europe/Amsterdam',
      languages: ['en'],
      defaultLanguage: 'en',
      branding: {
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        backgroundColor: '#ffffff',
        textColor: '#000000',
      },
      days: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      // Simulated leak — should be projected out
      apiKey: 'LEAK-123',
      passwordHash: 'LEAK-456',
    } as never)

    const res = await app.request('/api/events/test-event/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    assertNoSecretShapedKeys(body)
  })

  it('falls back to defaults when Cosmos is unavailable and still returns no secrets', async () => {
    vi.mocked(findById).mockRejectedValueOnce(new Error('cosmos down'))
    const res = await app.request('/api/events/test-event/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    assertNoSecretShapedKeys(body)
  })
})

describe('GET /api/events/:slug/sessions/now', () => {
  const app = new Hono().route('/', events)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns currentBreaks for elementType=2 items running now', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T11:00:00Z'))
    vi.mocked(runEvents.fetchRawAgenda).mockResolvedValueOnce([
      {
        id: 1, guid: 'g1', title: 'Lunch', roomName: 'Foyer', roomGuid: 'r1',
        startDate: '2026-06-02T12:30:00', endDate: '2026-06-02T13:30:00',
        startTimeGroup: '12:30', elementType: 2, elementTypeName: 'NonContent',
        timeZone: 'Europe/Amsterdam', labels: [], speakers: [],
        description: null, color: null, icon: null,
      },
    ] as never)
    const res = await app.request('/api/events/test-event/sessions/now')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current).toEqual([])
    expect(body.currentBreaks).toHaveLength(1)
    expect(body.currentBreaks[0].title).toBe('Lunch')
    expect(body.currentBreaks[0].elementType).toBe(2)
    vi.useRealTimers()
  })

  it('returns current sessions and empty currentBreaks during a session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T08:30:00Z'))
    vi.mocked(runEvents.fetchRawAgenda).mockResolvedValueOnce([
      {
        id: 2, guid: 'g2', title: 'Keynote', roomName: 'Plenary', roomGuid: 'r2',
        startDate: '2026-06-02T10:00:00', endDate: '2026-06-02T11:00:00',
        startTimeGroup: '10:00', elementType: 1, elementTypeName: 'Session',
        timeZone: 'Europe/Amsterdam', labels: [], speakers: [],
        description: null, color: null, icon: null,
      },
    ] as never)
    const res = await app.request('/api/events/test-event/sessions/now')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current).toHaveLength(1)
    expect(body.currentBreaks).toEqual([])
    vi.useRealTimers()
  })
})
