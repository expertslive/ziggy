import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Nomination } from '@ziggy/shared'
import { ensureNominationsContainer, upsert } from '../lib/cosmos.js'
import { NominationSubmitSchema } from '../schemas/nomination.js'

const nominations = new Hono()

// ---------------------------------------------------------------------------
// In-memory rate limit (per source IP). Two windows: 10/hour and 50/day.
// Module-level state — fine to lose on container restart.
// ---------------------------------------------------------------------------

interface IpBucket {
  hourCount: number
  hourResetAt: number
  dayCount: number
  dayResetAt: number
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const HOURLY_LIMIT = 10
const DAILY_LIMIT = 50

const buckets = new Map<string, IpBucket>()

/** Returns true when the request is allowed; mutates the bucket on allow. */
export function checkAndConsumeRateLimit(ip: string, now = Date.now()): boolean {
  let b = buckets.get(ip)
  if (!b || now >= b.hourResetAt || now >= b.dayResetAt) {
    if (!b) {
      b = {
        hourCount: 0,
        hourResetAt: now + HOUR_MS,
        dayCount: 0,
        dayResetAt: now + DAY_MS,
      }
      buckets.set(ip, b)
    } else {
      if (now >= b.hourResetAt) {
        b.hourCount = 0
        b.hourResetAt = now + HOUR_MS
      }
      if (now >= b.dayResetAt) {
        b.dayCount = 0
        b.dayResetAt = now + DAY_MS
      }
    }
  }
  if (b.hourCount >= HOURLY_LIMIT) return false
  if (b.dayCount >= DAILY_LIMIT) return false
  b.hourCount += 1
  b.dayCount += 1
  return true
}

/** Test-only — clear all rate-limit buckets. */
export function _resetRateLimitForTests(): void {
  buckets.clear()
}

function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

// ---------------------------------------------------------------------------
// POST /api/events/:slug/nominations
// ---------------------------------------------------------------------------

nominations.post('/api/events/:slug/nominations', async (c) => {
  const eventSlug = c.req.param('slug')
  const ip = clientIp(c)
  const userAgent = c.req.header('user-agent') ?? undefined

  if (!checkAndConsumeRateLimit(ip)) {
    console.warn('[nominations] rate-limited', { eventSlug, ip })
    return c.json({ error: 'Too many submissions, try later' }, 429)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = NominationSubmitSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const field = first?.path?.[0]
    return c.json(
      {
        error: 'Invalid payload',
        ...(typeof field === 'string' ? { field } : {}),
      },
      400,
    )
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const record: Nomination = {
    id,
    eventSlug,
    nomineeName: parsed.data.nomineeName,
    nomineeEmail: parsed.data.nomineeEmail,
    nomineePhone: parsed.data.nomineePhone,
    reason: parsed.data.reason,
    nominatorName: parsed.data.nominatorName,
    nominatorEmail: parsed.data.nominatorEmail.toLowerCase(),
    nominatorPhone: parsed.data.nominatorPhone,
    consentToShareNomineeName: parsed.data.consentToShareNomineeName,
    createdAt,
    ipAddress: ip,
    userAgent,
    status: 'pending',
  }

  try {
    await ensureNominationsContainer()
    await upsert<Nomination>('nominations', record)
  } catch (err) {
    console.error('[nominations] write failed', {
      id,
      eventSlug,
      ip,
      err: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Could not save nomination' }, 500)
  }

  console.log('[nominations] accepted', {
    id,
    eventSlug,
    ip,
    userAgent,
    status: record.status,
  })

  return c.json({ id, createdAt })
})

export default nominations
