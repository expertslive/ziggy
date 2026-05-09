/** Aggregate dashboard endpoints for the admin SPA.
 *
 * Five JWT-gated endpoints that roll up cross-system state for the
 * single-screen dashboard:
 *   GET  /api/admin/dashboard/health
 *   GET  /api/admin/events/:slug/dashboard/today
 *   GET  /api/admin/events/:slug/dashboard/action-items
 *   GET  /api/admin/events/:slug/dashboard/kiosks
 *   GET  /api/admin/events/:slug/dashboard/recent-activity */

import { Hono } from 'hono'
import { BlobServiceClient } from '@azure/storage-blob'
import {
  KIOSKS,
  type AuctionBid,
  type AuditEntry,
  type FloorMap,
  type KioskMeta,
  type Nomination,
  type ShopItem,
  type Sponsor,
} from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import {
  ensureAuditContainer,
  ensureKiosksContainer,
  findActive,
  getContainer,
} from '../lib/cosmos.js'
import { oldestEntryAgeSec } from '../lib/cache.js'
import { getLastSuccessAt, fetchRawAgenda } from '../lib/run-events.js'
import { getEnv } from '../env.js'

const adminDashboard = new Hono()

adminDashboard.use('/api/admin/dashboard/*', requireAuth)
adminDashboard.use('/api/admin/events/:slug/dashboard/*', requireAuth)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Return the epoch ms of the start of today (Europe/Amsterdam local 00:00).
 * Computed dependency-free via Intl: formatting `now` with the timezone gives
 * us the local Y-M-D, then we walk back hours/minutes/seconds from `now` to
 * land on the local midnight. */
function startOfAmsterdamDayMs(now: number = Date.now()): number {
  const tz = 'Europe/Amsterdam'
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = fmt.formatToParts(new Date(now))
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const h = get('hour')
  const m = get('minute')
  const s = get('second')
  const ms = new Date(now).getMilliseconds()
  return now - (((h * 60 + m) * 60 + s) * 1000 + ms)
}

const RUN_EVENTS_FRESH_WINDOW_MS = 30 * 60 * 1000

// ---------------------------------------------------------------------------
// GET /api/admin/dashboard/health
// ---------------------------------------------------------------------------

interface HealthCheck {
  ok: boolean
  label: string
}

interface HealthResponse {
  runEvents: HealthCheck
  cosmos: HealthCheck
  storage: HealthCheck
  cacheAgeSec: number | null
  lastBackupAt: string | null
  errors24h: number
}

async function probeCosmos(): Promise<HealthCheck> {
  try {
    await ensureAuditContainer()
    const container = getContainer('audit-log')
    await container.items
      .query<number>({ query: 'SELECT VALUE 1' })
      .fetchNext()
    return { ok: true, label: 'Cosmos DB reachable' }
  } catch (err) {
    return { ok: false, label: `Cosmos DB unreachable: ${(err as Error).message}` }
  }
}

async function probeStorage(): Promise<HealthCheck> {
  try {
    const env = getEnv()
    if (!env.storageConnectionString) {
      return { ok: false, label: 'Storage connection string not configured' }
    }
    const blob = BlobServiceClient.fromConnectionString(env.storageConnectionString)
    const exists = await blob.getContainerClient('ziggy-pii-backups').exists()
    return exists
      ? { ok: true, label: 'Blob Storage reachable' }
      : { ok: true, label: 'Blob Storage reachable (container will be created on first backup)' }
  } catch (err) {
    return { ok: false, label: `Blob Storage unreachable: ${(err as Error).message}` }
  }
}

async function lastBackupIso(eventSlug: string): Promise<string | null> {
  try {
    await ensureAuditContainer()
    const container = getContainer('audit-log')
    const { resources } = await container.items
      .query<{ ts: number }>({
        query: `SELECT TOP 1 c.ts FROM c
                  WHERE c.eventSlug = @slug AND c.target = 'pii-backup'
                  ORDER BY c.ts DESC`,
        parameters: [{ name: '@slug', value: eventSlug }],
      })
      .fetchAll()
    const top = resources[0]
    return top?.ts ? new Date(top.ts).toISOString() : null
  } catch {
    return null
  }
}

/** No `outcome` column exists on audit entries — failed actions are tracked
 * via specific actions like `login-failed`. We use that as the proxy for
 * "errors in the last 24h". Cross-partition over a one-day TTL window is
 * cheap on the audit container. */
async function errorsLast24h(): Promise<number> {
  try {
    await ensureAuditContainer()
    const container = getContainer('audit-log')
    const since = Date.now() - 24 * 60 * 60 * 1000
    const { resources } = await container.items
      .query<number>({
        query: `SELECT VALUE COUNT(1) FROM c
                  WHERE c.action = 'login-failed' AND c.ts >= @since`,
        parameters: [{ name: '@since', value: since }],
      })
      .fetchAll()
    return (resources[0] as number) ?? 0
  } catch {
    return 0
  }
}

adminDashboard.get('/api/admin/dashboard/health', async (c) => {
  const env = getEnv()
  const lastSuccess = getLastSuccessAt()
  const runEventsOk =
    lastSuccess !== null && Date.now() - lastSuccess < RUN_EVENTS_FRESH_WINDOW_MS

  const [cosmos, storage, lastBackupAt, errors24h] = await Promise.all([
    probeCosmos(),
    probeStorage(),
    lastBackupIso(env.eventSlug),
    errorsLast24h(),
  ])

  const body: HealthResponse = {
    runEvents: {
      ok: runEventsOk,
      label: lastSuccess
        ? `Last successful fetch ${Math.floor((Date.now() - lastSuccess) / 1000)}s ago`
        : 'No successful run.events fetch yet',
    },
    cosmos,
    storage,
    cacheAgeSec: oldestEntryAgeSec(),
    lastBackupAt,
    errors24h,
  }

  return c.json(body)
})

// ---------------------------------------------------------------------------
// GET /api/admin/events/:slug/dashboard/today
// ---------------------------------------------------------------------------

interface TodayResponse {
  bids: { count: number; totalEur: number }
  nominations: { count: number }
  pageviews: number
  activeKiosks: { online: number; total: number }
  topPage: { path: string; views: number } | null
}

async function bidsToday(slug: string, startMs: number): Promise<{ count: number; totalEur: number }> {
  try {
    const container = getContainer('auction-bids')
    const { resources } = await container.items
      .query<AuctionBid>({
        query: `SELECT * FROM c WHERE c.eventSlug = @slug AND c.ts >= @s`,
        parameters: [
          { name: '@slug', value: slug },
          { name: '@s', value: startMs },
        ],
      })
      .fetchAll()
    const totalCents = resources.reduce((sum, b) => sum + (b.amount ?? 0), 0)
    return { count: resources.length, totalEur: Math.round(totalCents / 100) }
  } catch {
    return { count: 0, totalEur: 0 }
  }
}

async function nominationsToday(slug: string, startMs: number): Promise<number> {
  try {
    const container = getContainer('nominations')
    const startIso = new Date(startMs).toISOString()
    const { resources } = await container.items
      .query<number>({
        query: `SELECT VALUE COUNT(1) FROM c
                  WHERE c.eventSlug = @slug AND c.createdAt >= @s
                    AND (NOT IS_DEFINED(c.deletedAt) OR c.deletedAt = null)`,
        parameters: [
          { name: '@slug', value: slug },
          { name: '@s', value: startIso },
        ],
      })
      .fetchAll()
    return (resources[0] as number) ?? 0
  } catch {
    return 0
  }
}

async function pageviewsToday(startMs: number): Promise<number> {
  try {
    const container = getContainer('analytics')
    const { resources } = await container.items
      .query<number>({
        query: `SELECT VALUE COUNT(1) FROM c
                  WHERE c.type = 'pageview' AND c.ts >= @s`,
        parameters: [{ name: '@s', value: startMs }],
      })
      .fetchAll()
    return (resources[0] as number) ?? 0
  } catch {
    return 0
  }
}

async function topPageToday(startMs: number): Promise<{ path: string; views: number } | null> {
  try {
    const container = getContainer('analytics')
    const { resources } = await container.items
      .query<{ path?: string; views: number }>({
        query: `SELECT c.payload.path AS path, COUNT(1) AS views
                  FROM c
                  WHERE c.type = 'pageview' AND c.ts >= @s
                    AND IS_DEFINED(c.payload.path)
                  GROUP BY c.payload.path`,
        parameters: [{ name: '@s', value: startMs }],
      })
      .fetchAll()
    const sorted = [...resources].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    const top = sorted[0]
    if (!top || !top.path) return null
    return { path: top.path, views: top.views }
  } catch {
    return null
  }
}

interface KioskStatusCounts {
  online: number
  total: number
}

async function activeKiosksCounts(): Promise<KioskStatusCounts> {
  try {
    const container = getContainer('analytics')
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const { resources } = await container.items
      .query<{ kioskId: string; lastTs: number }>({
        query: `SELECT c.kioskId, MAX(c.ts) AS lastTs
                  FROM c
                  WHERE c.type IN ('kiosk_alive', 'kiosk_loaded') AND c.ts >= @s
                  GROUP BY c.kioskId`,
        parameters: [{ name: '@s', value: dayAgo }],
      })
      .fetchAll()
    const now = Date.now()
    const online = resources.filter((r) => now - r.lastTs < 2 * 60 * 1000).length
    return { online, total: resources.length }
  } catch {
    return { online: 0, total: 0 }
  }
}

adminDashboard.get('/api/admin/events/:slug/dashboard/today', async (c) => {
  const slug = c.req.param('slug')
  const startMs = startOfAmsterdamDayMs()

  const [bids, nominationsCount, pageviews, activeKiosks, topPage] = await Promise.all([
    bidsToday(slug, startMs),
    nominationsToday(slug, startMs),
    pageviewsToday(startMs),
    activeKiosksCounts(),
    topPageToday(startMs),
  ])

  const body: TodayResponse = {
    bids,
    nominations: { count: nominationsCount },
    pageviews,
    activeKiosks,
    topPage,
  }
  return c.json(body)
})

// ---------------------------------------------------------------------------
// GET /api/admin/events/:slug/dashboard/action-items
// ---------------------------------------------------------------------------

interface ActionItem {
  count: number
  link: string
}

interface ActionItemsResponse {
  pendingNominations: ActionItem
  sponsorsNoLogo: ActionItem
  shopItemsNoImage: ActionItem
  sessionsNoRoom: ActionItem
  hotspotsEmpty: ActionItem
}

function emptyish(value: string | undefined | null): boolean {
  return !value || value.trim() === ''
}

adminDashboard.get('/api/admin/events/:slug/dashboard/action-items', async (c) => {
  const slug = c.req.param('slug')
  const env = getEnv()

  const [nominations, sponsors, shopItems, floorMaps, agenda] = await Promise.all([
    findActive<Nomination>('nominations', 'eventSlug', slug).catch(() => [] as Nomination[]),
    findActive<Sponsor>('sponsors', 'eventSlug', slug).catch(() => [] as Sponsor[]),
    findActive<ShopItem>('shop-items', 'eventSlug', slug).catch(() => [] as ShopItem[]),
    findActive<FloorMap>('floor-maps', 'eventSlug', slug).catch(() => [] as FloorMap[]),
    fetchRawAgenda(env.runEventsApiKey, slug).catch(() => []),
  ])

  const pendingNominations = nominations.filter((n) => n.status === 'pending').length
  const sponsorsNoLogo = sponsors.filter((s) => emptyish(s.logoUrl)).length
  const shopItemsNoImage = shopItems.filter((i) => emptyish(i.imageUrl)).length
  const sessionsNoRoom = agenda.filter((s) => emptyish(s.roomGuid)).length

  let hotspotsEmpty = 0
  for (const map of floorMaps) {
    for (const h of map.hotspots ?? []) {
      if (!h.points || h.points.length < 3) hotspotsEmpty += 1
    }
  }

  const body: ActionItemsResponse = {
    pendingNominations: { count: pendingNominations, link: '/nominations' },
    sponsorsNoLogo: { count: sponsorsNoLogo, link: '/sponsors' },
    shopItemsNoImage: { count: shopItemsNoImage, link: '/shop-items' },
    sessionsNoRoom: { count: sessionsNoRoom, link: '/event-config' },
    hotspotsEmpty: { count: hotspotsEmpty, link: '/floor-maps' },
  }
  return c.json(body)
})

// ---------------------------------------------------------------------------
// GET /api/admin/events/:slug/dashboard/kiosks
// ---------------------------------------------------------------------------

type KioskStatus = 'online' | 'idle' | 'stale' | 'offline'

interface DashboardKiosk {
  kioskId: string
  displayName: string
  shortCode?: string
  location?: string
  lastHeartbeatAt: number | null
  status: KioskStatus
}

function statusFor(lastHeartbeatAt: number | null, now: number): KioskStatus {
  if (lastHeartbeatAt === null) return 'offline'
  const ageMs = now - lastHeartbeatAt
  if (ageMs <= 2 * 60 * 1000) return 'online'
  if (ageMs <= 10 * 60 * 1000) return 'idle'
  if (ageMs <= 24 * 60 * 60 * 1000) return 'stale'
  return 'offline'
}

async function loadAliases(slug: string): Promise<Map<string, KioskMeta>> {
  try {
    await ensureKiosksContainer()
    const rows = await findActive<KioskMeta>('kiosks', 'eventSlug', slug)
    return new Map(rows.map((r) => [r.id, r]))
  } catch {
    return new Map()
  }
}

async function loadHeartbeats(): Promise<Map<string, number>> {
  try {
    const container = getContainer('analytics')
    const { resources } = await container.items
      .query<{ kioskId: string; lastTs: number }>({
        query: `SELECT c.kioskId, MAX(c.ts) AS lastTs
                  FROM c
                  WHERE c.type IN ('kiosk_alive', 'kiosk_loaded')
                  GROUP BY c.kioskId`,
      })
      .fetchAll()
    return new Map(resources.map((r) => [r.kioskId, r.lastTs]))
  } catch {
    return new Map()
  }
}

adminDashboard.get('/api/admin/events/:slug/dashboard/kiosks', async (c) => {
  const slug = c.req.param('slug')
  const [aliases, heartbeats] = await Promise.all([loadAliases(slug), loadHeartbeats()])

  // Canonical KIOSKS (from @ziggy/shared) seed the result so volunteers see
  // every expected kiosk pre-event, even before any heartbeat has arrived.
  // Cosmos aliases override the canonical label; heartbeats from unknown
  // kioskIds (e.g. a paired test device) still get included on top.
  const kioskIds = new Set<string>([
    ...KIOSKS.map((k) => k.id),
    ...aliases.keys(),
    ...heartbeats.keys(),
  ])
  const now = Date.now()
  const rows: DashboardKiosk[] = Array.from(kioskIds).map((kioskId) => {
    const alias = aliases.get(kioskId)
    const canonical = KIOSKS.find((k) => k.id === kioskId)
    const lastHeartbeatAt = heartbeats.get(kioskId) ?? null
    const displayName = alias?.displayName ?? canonical?.label ?? kioskId
    const location = alias?.location ?? canonical?.floor
    return {
      kioskId,
      displayName,
      ...(alias?.shortCode !== undefined && { shortCode: alias.shortCode }),
      ...(location !== undefined && { location }),
      lastHeartbeatAt,
      status: statusFor(lastHeartbeatAt, now),
    }
  })

  rows.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  return c.json(rows)
})

// ---------------------------------------------------------------------------
// GET /api/admin/events/:slug/dashboard/easter-eggs
// ---------------------------------------------------------------------------

interface EasterEggsResponse {
  rickrolls: { today: number; total: number; lastAt: string | null }
}

async function rickrollStats(): Promise<EasterEggsResponse['rickrolls']> {
  const startMs = startOfAmsterdamDayMs()
  try {
    const container = getContainer('analytics')
    const [totalRes, todayRes, lastRes] = await Promise.all([
      container.items
        .query<number>({
          query: `SELECT VALUE COUNT(1) FROM c WHERE c.type = 'easter_egg_rickrolled'`,
        })
        .fetchAll(),
      container.items
        .query<number>({
          query: `SELECT VALUE COUNT(1) FROM c
                    WHERE c.type = 'easter_egg_rickrolled' AND c.ts >= @s`,
          parameters: [{ name: '@s', value: startMs }],
        })
        .fetchAll(),
      container.items
        .query<number>({
          query: `SELECT VALUE MAX(c.ts) FROM c WHERE c.type = 'easter_egg_rickrolled'`,
        })
        .fetchAll(),
    ])
    const total = (totalRes.resources[0] as number) ?? 0
    const today = (todayRes.resources[0] as number) ?? 0
    const lastTs = (lastRes.resources[0] as number | undefined) ?? null
    return {
      today,
      total,
      lastAt: lastTs ? new Date(lastTs).toISOString() : null,
    }
  } catch {
    return { today: 0, total: 0, lastAt: null }
  }
}

adminDashboard.get('/api/admin/events/:slug/dashboard/easter-eggs', async (c) => {
  const rickrolls = await rickrollStats()
  const body: EasterEggsResponse = { rickrolls }
  return c.json(body)
})

// ---------------------------------------------------------------------------
// GET /api/admin/events/:slug/dashboard/recent-activity?limit=20
// ---------------------------------------------------------------------------

/** Defensive PII scrub on the audit `summary` field. The schema is supposed
 * to be PII-free already, but if a future caller drops an email or phone
 * into a summary by mistake we mask it here so the dashboard doesn't leak. */
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g

function scrubSummary(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]')
}

adminDashboard.get('/api/admin/events/:slug/dashboard/recent-activity', async (c) => {
  const slug = c.req.param('slug')
  const rawLimit = parseInt(c.req.query('limit') ?? '20', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100)

  let entries: AuditEntry[] = []
  try {
    await ensureAuditContainer()
    const container = getContainer('audit-log')
    const { resources } = await container.items
      .query<AuditEntry>({
        query: `SELECT TOP @n * FROM c
                  WHERE c.eventSlug = @slug
                  ORDER BY c.ts DESC`,
        parameters: [
          { name: '@n', value: limit },
          { name: '@slug', value: slug },
        ],
      })
      .fetchAll()
    entries = resources
  } catch {
    entries = []
  }

  const cleaned = entries.map((e) => ({
    ...e,
    summary: scrubSummary(e.summary),
  }))

  return c.json(cleaned)
})

export default adminDashboard
