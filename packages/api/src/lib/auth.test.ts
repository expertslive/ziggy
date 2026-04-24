import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../env.js', () => ({
  getEnv: () => ({ jwtSecret: 'x'.repeat(32), nodeEnv: 'test' }),
}))

import { signToken, verifyToken } from './auth.js'

const adminStub = { id: 'a1', email: 'e@x', passwordHash: 'h', createdAt: '' } as const

describe('JWT auth', () => {
  it('signs with ziggy issuer + ziggy-admin audience', () => {
    const token = signToken(adminStub as never)
    const decoded = jwt.decode(token) as jwt.JwtPayload
    expect(decoded.iss).toBe('ziggy')
    expect(decoded.aud).toBe('ziggy-admin')
    expect(decoded.sub).toBe('a1')
  })

  it('puts email into its own claim', () => {
    const token = signToken(adminStub as never)
    const decoded = jwt.decode(token) as jwt.JwtPayload & { email: string }
    expect(decoded.email).toBe('e@x')
  })

  it('rejects tokens signed with wrong issuer', () => {
    const bad = jwt.sign({ email: 'e@x' }, 'x'.repeat(32), {
      subject: 'a1',
      issuer: 'attacker',
      audience: 'ziggy-admin',
    })
    expect(() => verifyToken(bad)).toThrow()
  })

  it('rejects tokens signed with wrong audience', () => {
    const bad = jwt.sign({ email: 'e@x' }, 'x'.repeat(32), {
      subject: 'a1',
      issuer: 'ziggy',
      audience: 'other',
    })
    expect(() => verifyToken(bad)).toThrow()
  })

  it('accepts a freshly signed token', () => {
    const token = signToken(adminStub as never)
    const payload = verifyToken(token)
    expect(payload.email).toBe('e@x')
    expect(payload.sub).toBe('a1')
  })
})
