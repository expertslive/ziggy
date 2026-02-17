/** JWT and password helpers */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getEnv } from '../env.js'
import type { Admin } from '@ziggy/shared'

export interface JwtPayload {
  sub: string // admin email
  iss: string
  iat: number
  exp: number
}

/** Create a signed JWT for an admin (24 h expiry) */
export function signToken(admin: Admin): string {
  const env = getEnv()
  return jwt.sign({ sub: admin.email, iss: 'ziggy' }, env.jwtSecret, {
    expiresIn: '24h',
  })
}

/** Verify a JWT and return its decoded payload */
export function verifyToken(token: string): JwtPayload {
  const env = getEnv()
  return jwt.verify(token, env.jwtSecret) as JwtPayload
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
