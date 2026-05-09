import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/cosmos.js', () => ({
  ensureNominationsContainer: vi.fn(async () => {}),
  upsert: vi.fn(async (_name: string, item: unknown) => item),
}))
vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    nodeEnv: 'test',
  }),
}))

import { ensureNominationsContainer, upsert } from '../lib/cosmos.js'
import nominations, { _resetRateLimitForTests } from './nominations.js'

const validBody = () => ({
  nomineeName: 'Casey Candidate',
  nomineeEmail: 'casey@example.com',
  nomineePhone: '+31 612345678',
  reason: 'Built three open-source tools used across the community.',
  nominatorName: 'Nora Nominator',
  nominatorEmail: 'nora@example.com',
  nominatorPhone: '0612345678',
  consentToShareNomineeName: true,
})

function post(app: Hono, body: unknown, headers: Record<string, string> = {}) {
  return app.request('/api/events/test-event/nominations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('POST /api/events/:slug/nominations', () => {
  const app = new Hono().route('/', nominations)

  beforeEach(() => {
    vi.clearAllMocks()
    _resetRateLimitForTests()
  })

  it('accepts a valid submission and returns id + createdAt', async () => {
    const res = await post(app, validBody(), { 'x-forwarded-for': '1.2.3.4' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; createdAt: string }
    expect(body.id).toMatch(UUID_RE)
    expect(typeof body.createdAt).toBe('string')
    expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date')

    expect(ensureNominationsContainer).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledTimes(1)
    const [container, record] = vi.mocked(upsert).mock.calls[0] as [string, Record<string, unknown>]
    expect(container).toBe('nominations')
    expect(record.eventSlug).toBe('test-event')
    expect(record.status).toBe('pending')
    expect(record.ipAddress).toBe('1.2.3.4')
    expect(record.id).toBe(body.id)
  })

  it('returns 400 when nominatorEmail is missing', async () => {
    const body = validBody() as Record<string, unknown>
    delete body.nominatorEmail
    const res = await post(app, body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string; field?: string }
    expect(json.error).toBe('Invalid payload')
    expect(json.field).toBe('nominatorEmail')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed email', async () => {
    const body = { ...validBody(), nominatorEmail: 'not-an-email' }
    const res = await post(app, body)
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when consentToShareNomineeName is false', async () => {
    const body = { ...validBody(), consentToShareNomineeName: false }
    const res = await post(app, body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string; field?: string }
    expect(json.field).toBe('consentToShareNomineeName')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('silently rejects (400) when honeypot field is non-empty', async () => {
    const body = { ...validBody(), website: 'https://spam.example' }
    const res = await post(app, body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    // Generic shape — never reveals "honeypot" to the caller.
    expect(json.error).toBe('Invalid payload')
    expect(JSON.stringify(json).toLowerCase()).not.toContain('honeypot')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('returns 429 on the 11th submission from the same IP within an hour', async () => {
    const ip = '9.9.9.9'
    for (let i = 0; i < 10; i++) {
      const res = await post(app, validBody(), { 'x-forwarded-for': ip })
      expect(res.status).toBe(200)
    }
    const res = await post(app, validBody(), { 'x-forwarded-for': ip })
    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string }
    expect(json.error).toMatch(/too many/i)
    expect(upsert).toHaveBeenCalledTimes(10)
  })

  it('uses x-forwarded-for first hop', async () => {
    const res = await post(app, validBody(), {
      'x-forwarded-for': '5.5.5.5, 10.0.0.1, 10.0.0.2',
    })
    expect(res.status).toBe(200)
    const [, record] = vi.mocked(upsert).mock.calls[0] as [string, Record<string, unknown>]
    expect(record.ipAddress).toBe('5.5.5.5')
  })
})
