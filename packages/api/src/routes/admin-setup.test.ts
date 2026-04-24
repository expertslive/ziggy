import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

const adminsItems: { email: string }[] = []

vi.mock('../lib/cosmos.js', () => ({
  getContainer: () => ({
    items: {
      query: () => ({ fetchAll: async () => ({ resources: adminsItems }) }),
      upsert: vi.fn(),
    },
  }),
  findAll: vi.fn(async () => []),
  findById: vi.fn(),
  upsert: vi.fn(async (_container: string, doc: unknown) => doc),
  deleteItem: vi.fn(),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    setupToken: 'correct-token',
    jwtSecret: 'x'.repeat(32),
    nodeEnv: 'test',
    eventSlug: 'test-event',
    runEventsApiKey: 'k',
  }),
}))

vi.mock('../lib/auth.js', () => ({
  signToken: () => 'fake-jwt',
  hashPassword: async () => 'hashed',
  comparePassword: async () => false,
}))

import admin from './admin.js'

describe('POST /api/auth/setup', () => {
  const app = new Hono().route('/', admin)

  beforeEach(() => {
    adminsItems.length = 0
  })

  it('returns 401 when X-Setup-Token missing', async () => {
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when X-Setup-Token is wrong', async () => {
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-setup-token': 'wrong-token',
      },
      body: JSON.stringify({ email: 'a@b', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when an admin already exists, regardless of token', async () => {
    adminsItems.push({ email: 'existing@x' })
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-setup-token': 'correct-token',
      },
      body: JSON.stringify({ email: 'a@b', password: 'password123' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 201 when token correct and no admin exists', async () => {
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-setup-token': 'correct-token',
      },
      body: JSON.stringify({ email: 'a@b', password: 'password123' }),
    })
    expect(res.status).toBe(201)
  })
})
