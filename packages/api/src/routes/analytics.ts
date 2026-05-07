/** Analytics ingest + reporting endpoints. */

import { Hono } from 'hono'
import { z } from 'zod'
import { ensureAnalyticsContainer, getContainer } from '../lib/cosmos.js'
import { requireAuth } from '../middleware/auth.js'

const analytics = new Hono()

// ---------------------------------------------------------------------------
// Ingest: POST /api/analytics/event
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'kiosk_loaded',
  'kiosk_alive',
  'pageview',
  'session_open',
  'speaker_open',
  'sponsor_open',
  'shop_item_open',
  'hotspot_tap',
  'floor_switch',
  'pinch_zoom_used',
  'deeplink_room',
  'deeplink_booth',
  'deeplink_map',
  'search_query',
  'search_no_results',
  'search_result_tap',
  'language_switch',
  'refresh_button',
  'session_end',
  'data_fetch_error',
] as const

const eventSchema = z.object({
  v: z.literal(1),
  type: z.enum(EVENT_TYPES),
  ts: z.number().int().positive(),
  kioskId: z.string().min(8).max(64).regex(/^kiosk-/),
  sessionId: z.string().min(8).max(64),
  payload: z.record(z.string(), z.unknown()).optional(),
})

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(200),
})

/** POST /api/analytics/event — ingest a batch of events from a kiosk. */
analytics.post('/api/analytics/event', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }

  // Lazy-create the container on first ingest if it's missing — avoids needing
  // a separate provisioning step for a brand-new env.
  await ensureAnalyticsContainer().catch(() => null)
  const container = getContainer('analytics')
  const writes = parsed.data.events.map((evt) => {
    // Use a synthetic id: ts-kioskId-sessionId-type ensures decent
    // uniqueness without needing UUIDs from the client.
    const id = `${evt.ts}-${evt.kioskId}-${evt.sessionId.substring(0, 8)}-${evt.type}-${Math.random().toString(36).slice(2, 6)}`
    return container.items.create({ id, ...evt }).catch(() => null)
  })
  await Promise.all(writes)
  return c.json({ ok: true, accepted: parsed.data.events.length })
})

// ---------------------------------------------------------------------------
// Reporting (admin-only): GET /api/admin/analytics/summary
// ---------------------------------------------------------------------------

/** Lightweight summary for the live dashboard.
 *  - totalLastHour: count of events in the last hour
 *  - perKiosk: count per kiosk-id (active ones first)
 *  - topSessions: 5 most-opened sessions (by session_open count)
 *  - searchNoResults: top 5 no-result search lengths (proxy for "what did
 *    people search that didn't yield")
 *  - lastHeartbeats: { kioskId → last alive timestamp }
 */
analytics.get('/api/admin/analytics/summary', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const hourAgo = now - 60 * 60 * 1000

  // Total events last hour
  const totalLastHour = await container.items
    .query({
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.ts >= @t',
      parameters: [{ name: '@t', value: hourAgo }],
    })
    .fetchAll()
    .then((r) => (r.resources[0] as number) ?? 0)
    .catch(() => 0)

  // Per kiosk (last hour)
  const perKioskRaw = await container.items
    .query({
      query:
        'SELECT c.kioskId, COUNT(1) AS count FROM c WHERE c.ts >= @t GROUP BY c.kioskId',
      parameters: [{ name: '@t', value: hourAgo }],
    })
    .fetchAll()
    .then((r) => r.resources)
    .catch(() => [])
  const perKiosk = (perKioskRaw as Array<{ kioskId: string; count: number }>) || []

  // Top sessions (last 24h)
  const dayAgo = now - 24 * 60 * 60 * 1000
  const topSessionsRaw = await container.items
    .query({
      query: `SELECT c.payload.sessionId AS sessionId, COUNT(1) AS count
              FROM c
              WHERE c.type = 'session_open' AND c.ts >= @t AND IS_DEFINED(c.payload.sessionId)
              GROUP BY c.payload.sessionId`,
      parameters: [{ name: '@t', value: dayAgo }],
    })
    .fetchAll()
    .then((r) => r.resources)
    .catch(() => [])
  const topSessions = ((topSessionsRaw as Array<{ sessionId: number; count: number }>) || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // No-result searches (last 24h): bucket by query length as a proxy for
  // "people searched for things that didn't exist". We deliberately don't log
  // the query text (privacy).
  const noResultsRaw = await container.items
    .query({
      query: `SELECT c.payload.len AS len, COUNT(1) AS count
              FROM c
              WHERE c.type = 'search_no_results' AND c.ts >= @t AND IS_DEFINED(c.payload.len)
              GROUP BY c.payload.len`,
      parameters: [{ name: '@t', value: dayAgo }],
    })
    .fetchAll()
    .then((r) => r.resources)
    .catch(() => [])
  const searchNoResults = ((noResultsRaw as Array<{ len: number; count: number }>) || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Last heartbeat per kiosk
  const heartbeatsRaw = await container.items
    .query({
      query: `SELECT c.kioskId, MAX(c.ts) AS lastTs
              FROM c
              WHERE c.type IN ('kiosk_alive', 'kiosk_loaded')
              GROUP BY c.kioskId`,
    })
    .fetchAll()
    .then((r) => r.resources)
    .catch(() => [])
  const lastHeartbeats: Record<string, number> = {}
  for (const row of (heartbeatsRaw as Array<{ kioskId: string; lastTs: number }>) || []) {
    lastHeartbeats[row.kioskId] = row.lastTs
  }

  return c.json({
    now,
    totalLastHour,
    perKiosk: perKiosk.sort((a, b) => b.count - a.count),
    topSessions,
    searchNoResults,
    lastHeartbeats,
  })
})

export { analytics }
