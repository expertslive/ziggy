/**
 * Per-(IP + email) sliding-window rate limiter for auth endpoints.
 *
 * In-process, per-container. Good enough for Ziggy's single-container API
 * deployment. Not suitable for horizontally scaled deployments (each replica
 * would keep its own counters).
 */

interface Bucket {
  count: number
  resetAt: number
}

export interface LoginRateLimiter {
  check(ip: string, email: string): boolean
  recordFailure(ip: string, email: string): void
  recordSuccess(ip: string, email: string): void
}

export function createLoginRateLimiter(opts: {
  max: number
  windowMs: number
  clock?: () => number
}): LoginRateLimiter {
  const clock = opts.clock ?? Date.now
  const buckets = new Map<string, Bucket>()
  const key = (ip: string, email: string) => `${ip}::${email.toLowerCase()}`

  function current(ip: string, email: string): Bucket {
    const k = key(ip, email)
    const b = buckets.get(k)
    const now = clock()
    if (!b || now >= b.resetAt) {
      const fresh = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(k, fresh)
      return fresh
    }
    return b
  }

  return {
    check(ip, email) {
      return current(ip, email).count < opts.max
    },
    recordFailure(ip, email) {
      current(ip, email).count++
    },
    recordSuccess(ip, email) {
      buckets.delete(key(ip, email))
    },
  }
}

export const loginRateLimiter = createLoginRateLimiter({
  max: 5,
  windowMs: 15 * 60_000,
})
