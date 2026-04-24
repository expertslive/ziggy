import { describe, it, expect, beforeEach } from 'vitest'
import { createLoginRateLimiter } from './rate-limit.js'

describe('createLoginRateLimiter', () => {
  const NOW = 1_000_000_000
  let now = NOW
  const clock = () => now

  beforeEach(() => {
    now = NOW
  })

  it('allows first 5 failed attempts from same ip+email', () => {
    const rl = createLoginRateLimiter({ max: 5, windowMs: 15 * 60_000, clock })
    for (let i = 0; i < 5; i++) {
      expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
      rl.recordFailure('1.2.3.4', 'a@b')
    }
    expect(rl.check('1.2.3.4', 'a@b')).toBe(false)
  })

  it('clears counter on success', () => {
    const rl = createLoginRateLimiter({ max: 5, windowMs: 15 * 60_000, clock })
    for (let i = 0; i < 4; i++) rl.recordFailure('1.2.3.4', 'a@b')
    rl.recordSuccess('1.2.3.4', 'a@b')
    for (let i = 0; i < 5; i++) expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
  })

  it('resets after window elapses', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 1000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.2.3.4', 'a@b')
    expect(rl.check('1.2.3.4', 'a@b')).toBe(false)
    now = NOW + 2000
    expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
  })

  it('isolates different ips', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 60_000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.1.1.1', 'a@b')
    expect(rl.check('1.1.1.1', 'a@b')).toBe(false)
    expect(rl.check('2.2.2.2', 'a@b')).toBe(true)
  })

  it('isolates different emails from same ip', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 60_000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.1.1.1', 'a@b')
    expect(rl.check('1.1.1.1', 'a@b')).toBe(false)
    expect(rl.check('1.1.1.1', 'other@b')).toBe(true)
  })

  it('case-insensitive email matching', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 60_000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.1.1.1', 'A@B')
    expect(rl.check('1.1.1.1', 'a@b')).toBe(false)
  })
})
