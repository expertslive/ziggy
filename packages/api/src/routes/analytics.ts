/** Analytics ingest + reporting endpoints. */

import { Hono } from 'hono'
import { z } from 'zod'
import { ensureAnalyticsContainer, getContainer } from '../lib/cosmos.js'
import { requireAuth } from '../middleware/auth.js'
import { getEnv } from '../env.js'
import * as runEvents from '../lib/run-events.js'

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
  const topSessionRows =
    ((topSessionsRaw as Array<{ sessionId: number; count: number }>) || [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

  // Look up titles for the top sessions so the UI doesn't display bare ids.
  const env = getEnv()
  const slug = env.eventSlug
  const titleById = new Map<number, string>()
  try {
    const items = await runEvents.fetchRawAgenda(slug, env.runEventsApiKey)
    for (const it of items as Array<{ id: number; title: string }>) {
      titleById.set(it.id, it.title)
    }
  } catch {
    // run.events upstream missing — fall back to id-only labels
  }
  const topSessions = topSessionRows.map((r) => ({
    sessionId: r.sessionId,
    count: r.count,
    title: titleById.get(r.sessionId),
  }))

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

// ---------------------------------------------------------------------------
// Detailed reports — power the new analytics dashboard sections.
// ---------------------------------------------------------------------------

/** Events bucketed into hourly windows for the last 24h.
 *
 * Aggregates in JS rather than letting Cosmos do the time-bucketing — the
 * agg query syntax differs by SDK version and JS over a few hundred docs
 * is comfortably fast at our event volumes. */
analytics.get('/api/admin/analytics/hourly', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const hours = Math.min(parseInt(c.req.query('hours') || '24', 10) || 24, 72)
  const since = now - hours * 60 * 60 * 1000
  let rows: Array<{ ts: number; type: string }> = []
  try {
    const { resources } = await container.items
      .query<{ ts: number; type: string }>({
        query: 'SELECT c.ts, c.type FROM c WHERE c.ts >= @t',
        parameters: [{ name: '@t', value: since }],
      })
      .fetchAll()
    rows = resources
  } catch {
    rows = []
  }

  // Bucket by hour of day in Europe/Amsterdam
  const tz = 'Europe/Amsterdam'
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  })
  const counts = new Map<string, { events: number; pageviews: number }>()
  for (const r of rows) {
    const parts = fmt.formatToParts(new Date(r.ts))
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const d = parts.find((p) => p.type === 'day')?.value
    const h = parts.find((p) => p.type === 'hour')?.value
    const key = `${y}-${m}-${d}T${h}`
    const cell = counts.get(key) || { events: 0, pageviews: 0 }
    cell.events += 1
    if (r.type === 'pageview') cell.pageviews += 1
    counts.set(key, cell)
  }

  const series = Array.from(counts.entries())
    .map(([bucket, v]) => ({
      bucket,
      events: v.events,
      pageviews: v.pageviews,
    }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1))

  return c.json({ now, hours, tz, series })
})

/** Tap counts per hotspot (last 24h). UI joins with floor-maps to color
 * polygons and label them. */
analytics.get('/api/admin/analytics/hotspot-heatmap', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const since = now - 24 * 60 * 60 * 1000
  let rows: Array<{ hotspotId: string; mapId?: string; roomName?: string; count: number }> = []
  try {
    const { resources } = await container.items
      .query<{ hotspotId: string; mapId?: string; roomName?: string; count: number }>({
        query: `SELECT c.payload.hotspotId AS hotspotId,
                       c.payload.mapId AS mapId,
                       c.payload.roomName AS roomName,
                       COUNT(1) AS count
                  FROM c
                  WHERE c.type = 'hotspot_tap' AND c.ts >= @t
                    AND IS_DEFINED(c.payload.hotspotId)
                  GROUP BY c.payload.hotspotId, c.payload.mapId, c.payload.roomName`,
        parameters: [{ name: '@t', value: since }],
      })
      .fetchAll()
    rows = resources
  } catch {
    rows = []
  }
  rows.sort((a, b) => b.count - a.count)
  return c.json({ since, taps: rows })
})

/** Search funnel for the last 24h. Returns total search_query, no-result,
 * and result-tap counts so the UI can show conversion. */
analytics.get('/api/admin/analytics/search-funnel', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const since = now - 24 * 60 * 60 * 1000
  async function countOf(type: string): Promise<number> {
    try {
      const { resources } = await container.items
        .query<number>({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.type = @t AND c.ts >= @s',
          parameters: [
            { name: '@t', value: type },
            { name: '@s', value: since },
          ],
        })
        .fetchAll()
      return (resources[0] as number) ?? 0
    } catch {
      return 0
    }
  }
  const [searches, noResults, resultTaps] = await Promise.all([
    countOf('search_query'),
    countOf('search_no_results'),
    countOf('search_result_tap'),
  ])
  return c.json({ since, searches, noResults, resultTaps })
})

/** Language switches grouped by language. */
analytics.get('/api/admin/analytics/language-split', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const since = now - 24 * 60 * 60 * 1000
  let rows: Array<{ lang: string; count: number }> = []
  try {
    const { resources } = await container.items
      .query<{ lang: string; count: number }>({
        query: `SELECT c.payload.lang AS lang, COUNT(1) AS count
                  FROM c
                  WHERE c.type = 'language_switch' AND c.ts >= @t
                    AND IS_DEFINED(c.payload.lang)
                  GROUP BY c.payload.lang`,
        parameters: [{ name: '@t', value: since }],
      })
      .fetchAll()
    rows = resources
  } catch {
    rows = []
  }
  rows.sort((a, b) => b.count - a.count)
  return c.json({ since, langs: rows })
})

/** Per-kiosk activity timeline — last N hours of pageview events grouped
 * by kiosk + page. Shows what each kiosk was actively showing. */
analytics.get('/api/admin/analytics/kiosk-timeline', requireAuth, async (c) => {
  const container = getContainer('analytics')
  const now = Date.now()
  const hours = Math.min(parseInt(c.req.query('hours') || '6', 10) || 6, 24)
  const since = now - hours * 60 * 60 * 1000
  let rows: Array<{ kioskId: string; ts: number; path?: string }> = []
  try {
    const { resources } = await container.items
      .query<{ kioskId: string; ts: number; path?: string }>({
        query: `SELECT c.kioskId, c.ts, c.payload.path AS path
                  FROM c
                  WHERE c.type = 'pageview' AND c.ts >= @t
                  ORDER BY c.ts ASC`,
        parameters: [{ name: '@t', value: since }],
      })
      .fetchAll()
    rows = resources
  } catch {
    rows = []
  }
  return c.json({ since, hours, events: rows })
})

export { analytics }
