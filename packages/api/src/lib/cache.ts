import { CACHE_TTL_MS } from '@ziggy/shared'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const live = new Map<string, CacheEntry<unknown>>()
const lastGood = new Map<string, unknown>()

/**
 * Get a cached value by key.
 * Returns undefined if the key is missing or expired.
 */
export function get<T>(key: string): T | undefined {
  const entry = live.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    live.delete(key)
    return undefined
  }
  return entry.value as T
}

/**
 * Get a fresh value if present, otherwise fall back to the last-good value.
 * Returns undefined only if nothing has ever been cached under this key.
 */
export function getOrStale<T>(key: string): T | undefined {
  const fresh = get<T>(key)
  if (fresh !== undefined) return fresh
  return lastGood.get(key) as T | undefined
}

/**
 * Set a cached value with an optional TTL.
 * Also updates the last-good store, which has no expiry.
 * Defaults to CACHE_TTL_MS (5 minutes) from shared constants.
 */
export function set<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS): void {
  live.set(key, { value, expiresAt: Date.now() + ttlMs })
  lastGood.set(key, value)
}

/**
 * Invalidate (remove) a cached entry by key, including its last-good value.
 */
export function invalidate(key: string): void {
  live.delete(key)
  lastGood.delete(key)
}

/**
 * Clear all cached entries. Useful for testing.
 */
export function clear(): void {
  live.clear()
  lastGood.clear()
}

/**
 * Returns true if a last-good value exists for this key.
 */
export function hasLastGood(key: string): boolean {
  return lastGood.has(key)
}
