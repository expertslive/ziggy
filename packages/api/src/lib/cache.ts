import { CACHE_TTL_MS } from '@ziggy/shared'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/**
 * Get a cached value by key.
 * Returns undefined if the key is missing or expired.
 */
export function get<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined

  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }

  return entry.value as T
}

/**
 * Set a cached value with an optional TTL.
 * Defaults to CACHE_TTL_MS (5 minutes) from shared constants.
 */
export function set<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Invalidate (remove) a cached entry by key.
 */
export function invalidate(key: string): void {
  store.delete(key)
}

/**
 * Clear all cached entries. Useful for testing.
 */
export function clear(): void {
  store.clear()
}
