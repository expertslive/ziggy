/** JWT and password helpers */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getEnv } from '../env.js'
import type { Admin } from '@ziggy/shared'

const ISSUER = 'ziggy'
const AUDIENCE = 'ziggy-admin'
const ALGO = 'HS256' as const

export interface TokenPayload {
  sub: string
  email: string
  iss: string
  aud: string
  iat: number
  exp: number
}

/** Create a signed JWT for an admin (24 h expiry) */
export function signToken(admin: Admin): string {
  const env = getEnv()
  return jwt.sign({ email: admin.email }, env.jwtSecret, {
    subject: admin.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: ALGO,
    expiresIn: '24h',
  })
}

/** Verify a JWT and return its decoded payload */
export function verifyToken(token: string): TokenPayload {
  const env = getEnv()
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: [ALGO],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (typeof decoded === 'string') throw new Error('Malformed token')
  return decoded as TokenPayload
}

/** Hash a plaintext password */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/** Compare a plaintext password with a bcrypt hash */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
