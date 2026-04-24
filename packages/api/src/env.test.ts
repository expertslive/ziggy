import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getEnv } from './env.js'

describe('getEnv in production', () => {
  const orig = { ...process.env }

  beforeEach(() => {
    process.env = { ...orig }
  })

  afterEach(() => {
    process.env = orig
  })

  it('throws when JWT_SECRET missing in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/JWT_SECRET/)
  })

  it('throws when JWT_SECRET shorter than 32 chars', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'short'
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/JWT_SECRET/)
  })

  it('throws when COSMOS_CONNECTION_STRING missing in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(32)
    delete process.env.COSMOS_CONNECTION_STRING
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/COSMOS/)
  })

  it('throws when STORAGE_CONNECTION_STRING missing in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(32)
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    delete process.env.STORAGE_CONNECTION_STRING
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/STORAGE/)
  })

  it('throws when RUN_EVENTS_API_KEY missing in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(32)
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    delete process.env.RUN_EVENTS_API_KEY
    expect(() => getEnv()).toThrow(/RUN_EVENTS/)
  })

  it('does not throw in development when secrets missing', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(() => getEnv()).not.toThrow()
  })

  it('returns valid config in production when all secrets set', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(32)
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs2'
    process.env.RUN_EVENTS_API_KEY = 'k'
    const env = getEnv()
    expect(env.nodeEnv).toBe('production')
    expect(env.jwtSecret.length).toBe(32)
  })
})
