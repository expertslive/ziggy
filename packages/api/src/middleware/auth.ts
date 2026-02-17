/** JWT auth middleware for admin endpoints */

import type { Context, Next } from 'hono'
import { verifyToken } from '../lib/auth.js'

/**
 * Hono middleware that verifies the Authorization: Bearer <token> header.
 * On success it stores the decoded JWT payload on the context via c.set('admin', ...).
 */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = header.slice(7) // strip "Bearer "
  try {
    const payload = verifyToken(token)
    c.set('admin', payload)
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  await next()
}
