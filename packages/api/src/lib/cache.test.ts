import { describe, it, expect, beforeEach } from 'vitest'
import * as cache from './cache.js'

describe('cache last-good layer', () => {
  beforeEach(() => cache.clear())

  it('returns live value when fresh', () => {
    cache.set('k', 'v1', 1000)
    expect(cache.get<string>('k')).toBe('v1')
    expect(cache.getOrStale<string>('k')).toBe('v1')
  })

  it('returns last-good when live has expired', async () => {
    cache.set('k', 'v1', 1)
    await new Promise((r) => setTimeout(r, 10))
    expect(cache.get<string>('k')).toBeUndefined()
    expect(cache.getOrStale<string>('k')).toBe('v1')
  })

  it('updates last-good on set', () => {
    cache.set('k', 'v1', 1000)
    cache.set('k', 'v2', 1000)
    expect(cache.getOrStale<string>('k')).toBe('v2')
  })

  it('returns undefined when neither live nor last-good exist', () => {
    expect(cache.getOrStale<string>('missing')).toBeUndefined()
  })

  it('hasLastGood returns true iff ever set', () => {
    expect(cache.hasLastGood('k')).toBe(false)
    cache.set('k', 'v', 1000)
    expect(cache.hasLastGood('k')).toBe(true)
    cache.invalidate('k')
    expect(cache.hasLastGood('k')).toBe(false)
  })
})
