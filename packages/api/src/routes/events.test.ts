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

import { findById } from '../lib/cosmos.js'
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
