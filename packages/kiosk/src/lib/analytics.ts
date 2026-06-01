/** Lightweight analytics tracker for the kiosk.
 *
 * Tracking is *off* unless the device has been paired to a kiosk location
 * (kiosks.ts). On a paired kiosk:
 *  - events are queued in localStorage
 *  - a flusher posts batches to /api/analytics/event every 30s
 *  - an inactivity-reset emits a `session_end` event with the elapsed
 *    time (= one visitor's interaction window)
 *
 * Test devices (no pair) silently no-op all calls. Auto-fallback IDs
 * (kiosk-auto-...) and explicit kiosk-test-... prefixes are also silent.
 *
 * Privacy posture: we ship anonymized counters and IDs only. No personal
 * data, no IP storage, no fingerprinting. */

import { getKioskId } from './kiosks'

const ENDPOINT = '/api/analytics/event'
const QUEUE_KEY = 'ziggy.analytics.queue'
const SESSION_ID_KEY = 'ziggy.analytics.sessionId'
const SESSION_START_KEY = 'ziggy.analytics.sessionStartMs'
const FLUSH_INTERVAL_MS = 30_000
const MAX_QUEUE_LENGTH = 1000
const MAX_EVENTS_PER_MINUTE = 60

interface RawEvent {
  type: string
  ts: number
  payload?: Record<string, unknown>
}

interface QueuedEvent extends RawEvent {
  kioskId: string
  sessionId: string
  v: 1
}

/** Returns the active kiosk-ID iff it's a real one and tracking should run. */
function activeKioskId(): string | null {
  const id = getKioskId()
  if (!id) return null
  if (id.startsWith('kiosk-auto-') || id.startsWith('kiosk-test-')) return null
  if (!id.startsWith('kiosk-')) return null
  return id
}

/** Anonymous per-visitor session UUID. Re-generated on inactivity-reset. */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = newUuid()
    window.localStorage.setItem(SESSION_ID_KEY, id)
    window.localStorage.setItem(SESSION_START_KEY, String(Date.now()))
  }
  return id
}

function newUuid(): string {
  // Crypto.randomUUID() is fine on all modern browsers. Fallback to a
  // hex-string from getRandomValues if missing (older Safari).
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const a = new Uint8Array(16)
  if (c) c.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readQueue(): QueuedEvent[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : []
  } catch {
    return []
  }
}

function writeQueue(q: QueuedEvent[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // Storage full or denied — drop silently
  }
}

// Simple in-memory rate limiter (max 60 events per kiosk per minute) so a
// runaway loop can't fill localStorage / Cosmos with junk.
const rateWindow: number[] = []
function withinRateLimit(): boolean {
  const now = Date.now()
  const cutoff = now - 60_000
  while (rateWindow.length && rateWindow[0] < cutoff) rateWindow.shift()
  if (rateWindow.length >= MAX_EVENTS_PER_MINUTE) return false
  rateWindow.push(now)
  return true
}

/** Record an event. No-op when the kiosk isn't paired or rate-limit is hit. */
export function track(type: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const kioskId = activeKioskId()
  if (!kioskId) return
  if (!withinRateLimit()) return

  const sessionId = getOrCreateSessionId()
  const evt: QueuedEvent = {
    type,
    ts: Date.now(),
    kioskId,
    sessionId,
    v: 1,
    ...(payload ? { payload } : {}),
  }
  const q = readQueue()
  q.push(evt)
  // Cap to prevent runaway storage growth on long offline periods
  if (q.length > MAX_QUEUE_LENGTH) q.splice(0, q.length - MAX_QUEUE_LENGTH)
  writeQueue(q)
}

/** Mark the end of one visitor's session (called from inactivity-reset).
 * Emits `session_end` with the elapsed time, then clears the session-id
 * so the next visitor gets a fresh anonymous id. */
export function endSession() {
  if (typeof window === 'undefined') return
  const startMs = Number(window.localStorage.getItem(SESSION_START_KEY) || 0)
  const sessionId = window.localStorage.getItem(SESSION_ID_KEY)
  if (sessionId && startMs) {
    track('session_end', { durationMs: Date.now() - startMs })
  }
  window.localStorage.removeItem(SESSION_ID_KEY)
  window.localStorage.removeItem(SESSION_START_KEY)
}

let flushing = false
async function flush() {
  if (flushing) return
  // Note: we don't gate on navigator.onLine. Embedded kiosk browsers
  // (PixioDisplay) misreport offline=true while the network is fine, which
  // strands the queue forever. The fetch below already handles real
  // failures and retries on the next interval.
  if (typeof window === 'undefined') return
  const q = readQueue()
  if (q.length === 0) return
  flushing = true
  try {
    const batch = q.slice(0, 100) // ship in chunks of 100
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    })
    if (res.ok) {
      // Drop the shipped slice; keep the rest for next round
      const rest = q.slice(batch.length)
      writeQueue(rest)
    }
    // On non-ok: keep the queue, retry next interval
  } catch {
    // Network / CORS / whatever — retry next interval
  } finally {
    flushing = false
  }
}

let started = false
export function startAnalytics() {
  if (started || typeof window === 'undefined') return
  started = true
  // Flush on interval
  setInterval(flush, FLUSH_INTERVAL_MS)
  // Flush opportunistically on visibility change + before unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', () => flush())
  // First flush soon after page load (catch any leftovers from previous tabs).
  // Ship within ~1s so the kiosk shows up online in admin quickly after
  // pairing, instead of waiting up to 30s for the next interval.
  setTimeout(flush, 1_000)
}
