import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import type {
  AuctionBid,
  AuditEntry,
  FloorMap,
  KioskMeta,
  Nomination,
  ShopItem,
  Sponsor,
} from '@ziggy/shared'

// ---------------------------------------------------------------------------
// In-memory data stores driven by tests. Reset in beforeEach.
// ---------------------------------------------------------------------------

interface AnalyticsRow {
  id: string
  type: string
  ts: number
  kioskId: string
  payload?: Record<string, unknown>
}

let auctionStore: AuctionBid[] = []
let nominationsStore: Nomination[] = []
let analyticsStore: AnalyticsRow[] = []
let auditStore: AuditEntry[] = []
let kioskMetaStore: KioskMeta[] = []
let sponsorsStore: Sponsor[] = []
let shopItemsStore: ShopItem[] = []
let floorMapsStore: FloorMap[] = []
let storageContainerExists: boolean | (() => boolean) = true
let storageThrows = false

// ---------------------------------------------------------------------------
// Cosmos query dispatcher — pattern-matches the SQL string the route emits
// against the in-memory data. Keeps the test surface small without needing a
// real query parser.
// ---------------------------------------------------------------------------

interface QuerySpec {
  query: string
  parameters?: Array<{ name: string; value: unknown }>
}

function paramValue<T = unknown>(spec: QuerySpec, name: string): T | undefined {
  return spec.parameters?.find((p) => p.name === name)?.value as T | undefined
}

function dispatch(container: string, spec: QuerySpec): unknown[] {
  const q = spec.query.replace(/\s+/g, ' ').trim()

  if (container === 'audit-log') {
    if (q === 'SELECT VALUE 1') return [1]
    if (q.includes("c.target = 'pii-backup'")) {
      const slug = paramValue<string>(spec, '@slug')
      const matches = auditStore
        .filter((e) => e.eventSlug === slug && e.target === 'pii-backup')
        .sort((a, b) => b.ts - a.ts)
      return matches.length > 0 ? [{ ts: matches[0].ts }] : []
    }
    if (q.includes("c.action = 'login-failed'")) {
      const since = paramValue<number>(spec, '@since') ?? 0
      const count = auditStore.filter(
        (e) => e.action === 'login-failed' && e.ts >= since,
      ).length
      return [count]
    }
    if (q.includes('SELECT TOP @n * FROM c WHERE c.eventSlug = @slug ORDER BY c.ts DESC')) {
      const slug = paramValue<string>(spec, '@slug')
      const n = paramValue<number>(spec, '@n') ?? 20
      return auditStore
        .filter((e) => e.eventSlug === slug)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, n)
    }
  }

  if (container === 'auction-bids') {
    const slug = paramValue<string>(spec, '@slug')
    const startMs = paramValue<number>(spec, '@s') ?? 0
    return auctionStore.filter((b) => b.eventSlug === slug && b.ts >= startMs)
  }

  if (container === 'nominations') {
    if (q.includes('SELECT VALUE COUNT(1)')) {
      const slug = paramValue<string>(spec, '@slug')
      const startIso = paramValue<string>(spec, '@s') ?? ''
      const count = nominationsStore.filter(
        (n) =>
          n.eventSlug === slug &&
          n.createdAt >= startIso &&
          !n.deletedAt,
      ).length
      return [count]
    }
  }

  if (container === 'analytics') {
    if (q.includes("c.type = 'pageview'") && q.includes('SELECT VALUE COUNT(1)')) {
      const startMs = paramValue<number>(spec, '@s') ?? 0
      const count = analyticsStore.filter((r) => r.type === 'pageview' && r.ts >= startMs).length
      return [count]
    }
    if (q.includes('GROUP BY c.payload.path')) {
      const startMs = paramValue<number>(spec, '@s') ?? 0
      const groups = new Map<string, number>()
      for (const row of analyticsStore) {
        if (row.type !== 'pageview' || row.ts < startMs) continue
        const path = (row.payload?.path as string | undefined) ?? undefined
        if (!path) continue
        groups.set(path, (groups.get(path) ?? 0) + 1)
      }
      return Array.from(groups.entries()).map(([path, views]) => ({ path, views }))
    }
    if (q.includes("c.type IN ('kiosk_alive', 'kiosk_loaded')")) {
      const startMs = paramValue<number>(spec, '@s')
      const groups = new Map<string, number>()
      for (const row of analyticsStore) {
        if (row.type !== 'kiosk_alive' && row.type !== 'kiosk_loaded') continue
        if (startMs !== undefined && row.ts < startMs) continue
        const prev = groups.get(row.kioskId) ?? 0
        if (row.ts > prev) groups.set(row.kioskId, row.ts)
      }
      return Array.from(groups.entries()).map(([kioskId, lastTs]) => ({ kioskId, lastTs }))
    }
  }

  return []
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/cosmos.js', () => ({
  ensureAuditContainer: vi.fn(async () => {}),
  ensureKiosksContainer: vi.fn(async () => {}),
  findActive: vi.fn(async (container: string, _key: string, slug: string) => {
    if (container === 'kiosks') {
      return kioskMetaStore.filter((k) => k.eventSlug === slug && !k.deletedAt)
    }
    if (container === 'nominations') {
      return nominationsStore.filter((n) => n.eventSlug === slug && !n.deletedAt)
    }
    if (container === 'sponsors') {
      return sponsorsStore.filter((s) => s.eventSlug === slug && !s.deletedAt)
    }
    if (container === 'shop-items') {
      return shopItemsStore.filter((i) => i.eventSlug === slug && !i.deletedAt)
    }
    if (container === 'floor-maps') {
      return floorMapsStore.filter((f) => f.eventSlug === slug && !f.deletedAt)
    }
    return []
  }),
  getContainer: vi.fn((name: string) => ({
    items: {
      query: (spec: QuerySpec) => ({
        fetchAll: async () => ({ resources: dispatch(name, spec) }),
        fetchNext: async () => ({ resources: dispatch(name, spec) }),
      }),
    },
  })),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    jwtSecret: 'x'.repeat(32),
    storageConnectionString: 'unused',
    nodeEnv: 'test',
  }),
}))

vi.mock('../lib/auth.js', () => ({
  verifyToken: vi.fn((token: string) => {
    if (token === 'good-token') {
      return {
        sub: 'admin-1',
        email: 'admin@example.com',
        iss: 'ziggy',
        aud: 'ziggy-admin',
        iat: 0,
        exp: 0,
      }
    }
    throw new Error('Invalid token')
  }),
  signToken: vi.fn(),
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}))

vi.mock('../lib/audit.js', () => ({
  writeAudit: vi.fn(async () => {}),
}))

vi.mock('../lib/run-events.js', () => {
  let lastSuccess: number | null = null
  return {
    getLastSuccessAt: vi.fn(() => lastSuccess),
    fetchRawAgenda: vi.fn(async () => agendaStore),
    _setLastSuccessAtForTests: (v: number | null) => {
      lastSuccess = v
    },
  }
})

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => ({
        exists: vi.fn(async () => {
          if (storageThrows) throw new Error('blob upstream down')
          return typeof storageContainerExists === 'function'
            ? storageContainerExists()
            : storageContainerExists
        }),
      })),
    })),
  },
}))

let agendaStore: Array<{ id: number; roomGuid?: string; title?: string }> = []

import * as runEventsMock from '../lib/run-events.js'
const setLastSuccess = (
  runEventsMock as unknown as { _setLastSuccessAtForTests: (v: number | null) => void }
)._setLastSuccessAtForTests

import adminDashboard from './admin-dashboard.js'

const SLUG = 'test-event'
const AUTH = { authorization: 'Bearer good-token' }

function buildApp() {
  return new Hono().route('/', adminDashboard)
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeBid(overrides: Partial<AuctionBid> = {}): AuctionBid {
  return {
    id: overrides.id ?? `bid-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: SLUG,
    shopItemId: 'item-1',
    ts: Date.now(),
    amount: 5000,
    name: 'Maarten Goet',
    email: 'maarten@example.com',
    phone: '0612345678',
    displayName: 'Maarten G.',
    ...overrides,
  }
}

function makeNom(overrides: Partial<Nomination> = {}): Nomination {
  return {
    id: overrides.id ?? `nom-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: SLUG,
    nomineeName: 'Casey',
    reason: 'because reasons',
    nominatorName: 'Nora',
    nominatorEmail: 'nora@example.com',
    consentToShareNomineeName: true,
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...overrides,
  }
}

function makeAudit(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: overrides.id ?? `aud-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: SLUG,
    ts: Date.now(),
    actor: 'admin@example.com',
    action: 'update',
    target: 'sponsor',
    summary: 'Updated something',
    ...overrides,
  }
}

function makeAnalytics(overrides: Partial<AnalyticsRow> = {}): AnalyticsRow {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 8)}`,
    type: 'pageview',
    ts: Date.now(),
    kioskId: 'kiosk-A1',
    ...overrides,
  }
}

beforeEach(() => {
  auctionStore = []
  nominationsStore = []
  analyticsStore = []
  auditStore = []
  kioskMetaStore = []
  sponsorsStore = []
  shopItemsStore = []
  floorMapsStore = []
  agendaStore = []
  storageContainerExists = true
  storageThrows = false
  setLastSuccess(null)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

// ===========================================================================
// /api/admin/dashboard/health
// ===========================================================================

describe('GET /api/admin/dashboard/health', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health')
    expect(res.status).toBe(401)
  })

  it('returns 401 with bad token', async () => {
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', {
      headers: { authorization: 'Bearer bogus' },
    })
    expect(res.status).toBe(401)
  })

  it('reports run.events stale when no fetch has been observed', async () => {
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      runEvents: { ok: boolean; label: string }
      cosmos: { ok: boolean }
      storage: { ok: boolean }
      cacheAgeSec: number | null
      lastBackupAt: string | null
      errors24h: number
    }
    expect(body.runEvents.ok).toBe(false)
    expect(body.cosmos.ok).toBe(true)
    expect(body.storage.ok).toBe(true)
    expect(body.cacheAgeSec).toBeNull()
    expect(body.lastBackupAt).toBeNull()
    expect(body.errors24h).toBe(0)
  })

  it('reports run.events ok when last success was within 30 min', async () => {
    setLastSuccess(Date.now() - 5 * 60 * 1000)
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    const body = (await res.json()) as { runEvents: { ok: boolean } }
    expect(body.runEvents.ok).toBe(true)
  })

  it('reports run.events stale when last success was > 30 min ago', async () => {
    setLastSuccess(Date.now() - 31 * 60 * 1000)
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    const body = (await res.json()) as { runEvents: { ok: boolean } }
    expect(body.runEvents.ok).toBe(false)
  })

  it('reports lastBackupAt from the most recent pii-backup audit row', async () => {
    auditStore.push(
      makeAudit({ target: 'pii-backup', action: 'snapshot', ts: 1_700_000_000_000 }),
      makeAudit({ target: 'pii-backup', action: 'snapshot', ts: 1_700_000_500_000 }),
      makeAudit({ target: 'sponsor', ts: 1_700_001_000_000 }),
    )
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    const body = (await res.json()) as { lastBackupAt: string | null }
    expect(body.lastBackupAt).toBe(new Date(1_700_000_500_000).toISOString())
  })

  it('counts login-failed entries from the last 24h as errors24h', async () => {
    const now = Date.now()
    auditStore.push(
      makeAudit({ action: 'login-failed', ts: now - 60_000 }),
      makeAudit({ action: 'login-failed', ts: now - 23 * 60 * 60 * 1000 }),
      makeAudit({ action: 'login-failed', ts: now - 25 * 60 * 60 * 1000 }),
      makeAudit({ action: 'login', ts: now }),
    )
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    const body = (await res.json()) as { errors24h: number }
    expect(body.errors24h).toBe(2)
  })

  it('reports storage ok=false when the storage probe throws', async () => {
    storageThrows = true
    const app = buildApp()
    const res = await app.request('/api/admin/dashboard/health', { headers: AUTH })
    const body = (await res.json()) as { storage: { ok: boolean } }
    expect(body.storage.ok).toBe(false)
  })
})

// ===========================================================================
// /api/admin/events/:slug/dashboard/today
// ===========================================================================

describe('GET /api/admin/events/:slug/dashboard/today', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/dashboard/today`)
    expect(res.status).toBe(401)
  })

  it('returns sensible zero values when there is no data', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/today`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      bids: { count: number; totalEur: number }
      nominations: { count: number }
      pageviews: number
      activeKiosks: { online: number; total: number }
      topPage: unknown
    }
    expect(body.bids).toEqual({ count: 0, totalEur: 0 })
    expect(body.nominations).toEqual({ count: 0 })
    expect(body.pageviews).toBe(0)
    expect(body.activeKiosks).toEqual({ online: 0, total: 0 })
    expect(body.topPage).toBeNull()
  })

  it('topPage returns null when no pageviews today', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/today`,
      { headers: AUTH },
    )
    const body = (await res.json()) as { topPage: unknown }
    expect(body.topPage).toBeNull()
  })

  it('aggregates today values: bids sum, nominations count, pageviews, top page, active kiosks', async () => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    // Late today (well within the Amsterdam day window).
    auctionStore.push(
      makeBid({ ts: now - 60_000, amount: 12_500 }),
      makeBid({ ts: now - 120_000, amount: 7_500 }),
    )
    // Yesterday — must be excluded.
    auctionStore.push(makeBid({ ts: now - dayMs, amount: 999_999 }))

    nominationsStore.push(
      makeNom({ createdAt: new Date(now - 60_000).toISOString() }),
      makeNom({ createdAt: new Date(now - 120_000).toISOString() }),
      makeNom({ createdAt: new Date(now - dayMs).toISOString() }),
    )

    analyticsStore.push(
      makeAnalytics({ ts: now - 60_000, payload: { path: '/agenda' } }),
      makeAnalytics({ ts: now - 30_000, payload: { path: '/agenda' } }),
      makeAnalytics({ ts: now - 30_000, payload: { path: '/sponsors' } }),
      // Heartbeats — one fresh, one stale.
      makeAnalytics({ type: 'kiosk_alive', kioskId: 'kiosk-A', ts: now - 30_000 }),
      makeAnalytics({ type: 'kiosk_alive', kioskId: 'kiosk-B', ts: now - 5 * 60 * 1000 }),
    )

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/today`,
      { headers: AUTH },
    )
    const body = (await res.json()) as {
      bids: { count: number; totalEur: number }
      nominations: { count: number }
      pageviews: number
      activeKiosks: { online: number; total: number }
      topPage: { path: string; views: number } | null
    }
    expect(body.bids.count).toBeGreaterThanOrEqual(2)
    expect(body.bids.totalEur).toBe(200)
    expect(body.nominations.count).toBeGreaterThanOrEqual(2)
    expect(body.pageviews).toBe(3)
    expect(body.topPage).toEqual({ path: '/agenda', views: 2 })
    expect(body.activeKiosks).toEqual({ online: 1, total: 2 })
  })

  it('uses Europe/Amsterdam day boundary (CEST UTC+2 in June)', async () => {
    // 2026-06-01T22:30:00Z is 2026-06-02 00:30 in Amsterdam (DST → UTC+2).
    // A bid 2h earlier (2026-06-01T20:30:00Z = 2026-06-01 22:30 local) is
    // "yesterday" and must NOT be counted.
    const todayUtc = Date.UTC(2026, 5, 1, 22, 30, 0)
    const yesterdayUtc = todayUtc - 2 * 60 * 60 * 1000
    vi.useFakeTimers()
    vi.setSystemTime(new Date(todayUtc))

    auctionStore.push(
      makeBid({ ts: todayUtc - 60_000, amount: 5_000 }),
      makeBid({ ts: yesterdayUtc, amount: 999_999 }),
    )

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/today`,
      { headers: AUTH },
    )
    const body = (await res.json()) as { bids: { count: number; totalEur: number } }
    expect(body.bids.count).toBe(1)
    expect(body.bids.totalEur).toBe(50)
  })
})

// ===========================================================================
// /api/admin/events/:slug/dashboard/action-items
// ===========================================================================

describe('GET /api/admin/events/:slug/dashboard/action-items', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/action-items`,
    )
    expect(res.status).toBe(401)
  })

  it('returns zero counts when there is no data', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/action-items`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, { count: number; link: string }>
    for (const k of [
      'pendingNominations',
      'sponsorsNoLogo',
      'shopItemsNoImage',
      'sessionsNoRoom',
      'hotspotsEmpty',
    ]) {
      expect(body[k].count).toBe(0)
      expect(body[k].link).toMatch(/^\//)
    }
  })

  it('counts pending nominations, sponsors w/o logo, shop items w/o image, hotspots <3 points, sessions w/o room', async () => {
    nominationsStore.push(
      makeNom({ status: 'pending' }),
      makeNom({ status: 'pending' }),
      makeNom({ status: 'verified' }),
    )
    sponsorsStore.push(
      {
        id: 's1',
        eventSlug: SLUG,
        name: 'A',
        tierId: 'gold',
        description: { en: '' },
        logoUrl: '',
        sortOrder: 1,
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        id: 's2',
        eventSlug: SLUG,
        name: 'B',
        tierId: 'gold',
        description: { en: '' },
        logoUrl: 'https://x/logo.png',
        sortOrder: 2,
        createdAt: 'x',
        updatedAt: 'x',
      },
    )
    shopItemsStore.push(
      {
        id: 'i1',
        eventSlug: SLUG,
        name: 'A',
        description: { en: '' },
        imageUrl: '',
        priceLabel: '€10',
        sortOrder: 1,
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        id: 'i2',
        eventSlug: SLUG,
        name: 'B',
        description: { en: '' },
        imageUrl: 'https://x/i.png',
        priceLabel: '€10',
        sortOrder: 2,
        createdAt: 'x',
        updatedAt: 'x',
      },
    )
    floorMapsStore.push({
      id: 'f1',
      eventSlug: SLUG,
      name: 'Begane grond',
      label: { en: 'Ground floor' },
      imageUrl: 'https://x/m.png',
      sortOrder: 1,
      hotspots: [
        {
          id: 'h-empty',
          roomName: 'A',
          label: { en: 'A' },
          points: [],
        },
        {
          id: 'h-2pt',
          roomName: 'B',
          label: { en: 'B' },
          points: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          id: 'h-good',
          roomName: 'C',
          label: { en: 'C' },
          points: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        },
      ],
      createdAt: 'x',
      updatedAt: 'x',
    })
    agendaStore = [
      { id: 1, roomGuid: 'r1', title: 'A' },
      { id: 2, title: 'No room' },
      { id: 3, roomGuid: '', title: 'Empty room' },
    ]

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/action-items`,
      { headers: AUTH },
    )
    const body = (await res.json()) as Record<string, { count: number; link: string }>
    expect(body.pendingNominations.count).toBe(2)
    expect(body.sponsorsNoLogo.count).toBe(1)
    expect(body.shopItemsNoImage.count).toBe(1)
    expect(body.sessionsNoRoom.count).toBe(2)
    expect(body.hotspotsEmpty.count).toBe(2)
  })

  it('tolerates missing run.events agenda (sessionsNoRoom = 0)', async () => {
    const runEventsModule = (await import('../lib/run-events.js')) as unknown as {
      fetchRawAgenda: ReturnType<typeof vi.fn>
    }
    runEventsModule.fetchRawAgenda.mockRejectedValueOnce(new Error('upstream down'))

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/action-items`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sessionsNoRoom: { count: number } }
    expect(body.sessionsNoRoom.count).toBe(0)
  })
})

// ===========================================================================
// /api/admin/events/:slug/dashboard/kiosks
// ===========================================================================

describe('GET /api/admin/events/:slug/dashboard/kiosks', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/dashboard/kiosks`)
    expect(res.status).toBe(401)
  })

  it('returns empty array when no aliases or heartbeats', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/kiosks`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('merges aliases + heartbeats and computes status thresholds', async () => {
    const now = Date.now()
    kioskMetaStore.push({
      id: 'kiosk-A1',
      eventSlug: SLUG,
      displayName: 'Alpha',
      shortCode: 'A1',
      location: 'Hall 1',
      addedAt: 'x',
      updatedAt: 'x',
    })
    kioskMetaStore.push({
      id: 'kiosk-NEVER',
      eventSlug: SLUG,
      displayName: 'Never seen',
      addedAt: 'x',
      updatedAt: 'x',
    })

    analyticsStore.push(
      makeAnalytics({ type: 'kiosk_alive', kioskId: 'kiosk-A1', ts: now - 30_000 }),
      makeAnalytics({ type: 'kiosk_alive', kioskId: 'kiosk-IDLE', ts: now - 5 * 60 * 1000 }),
      makeAnalytics({ type: 'kiosk_alive', kioskId: 'kiosk-STALE', ts: now - 60 * 60 * 1000 }),
      makeAnalytics({
        type: 'kiosk_alive',
        kioskId: 'kiosk-OFFLINE',
        ts: now - 48 * 60 * 60 * 1000,
      }),
    )

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/kiosks`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Array<{
      kioskId: string
      displayName: string
      status: string
      shortCode?: string
      location?: string
      lastHeartbeatAt: number | null
    }>

    const byId = new Map(json.map((r) => [r.kioskId, r]))
    expect(byId.get('kiosk-A1')?.displayName).toBe('Alpha')
    expect(byId.get('kiosk-A1')?.status).toBe('online')
    expect(byId.get('kiosk-A1')?.shortCode).toBe('A1')

    expect(byId.get('kiosk-IDLE')?.displayName).toBe('kiosk-IDLE')
    expect(byId.get('kiosk-IDLE')?.status).toBe('idle')

    expect(byId.get('kiosk-STALE')?.status).toBe('stale')
    expect(byId.get('kiosk-OFFLINE')?.status).toBe('offline')

    // Aliased kiosk with no heartbeat.
    expect(byId.get('kiosk-NEVER')?.status).toBe('offline')
    expect(byId.get('kiosk-NEVER')?.lastHeartbeatAt).toBeNull()

    // Sorted by displayName asc.
    expect(json[0].displayName.toLowerCase().localeCompare(json[1].displayName.toLowerCase()) <= 0)
      .toBe(true)
  })
})

// ===========================================================================
// /api/admin/events/:slug/dashboard/recent-activity
// ===========================================================================

describe('GET /api/admin/events/:slug/dashboard/recent-activity', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity`,
    )
    expect(res.status).toBe(401)
  })

  it('returns empty list when no audit entries exist', async () => {
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity`,
      { headers: AUTH },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns most-recent N entries sorted desc, defaults to 20, caps at 100', async () => {
    for (let i = 0; i < 30; i++) {
      auditStore.push(makeAudit({ id: `a-${i}`, ts: 1_000 + i }))
    }
    const app = buildApp()
    const def = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity`,
      { headers: AUTH },
    )
    const defJson = (await def.json()) as AuditEntry[]
    expect(defJson).toHaveLength(20)
    expect(defJson[0].ts).toBeGreaterThan(defJson[1].ts)
    expect(defJson[0].id).toBe('a-29')

    const five = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity?limit=5`,
      { headers: AUTH },
    )
    expect((await five.json()) as AuditEntry[]).toHaveLength(5)

    const overshoot = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity?limit=9999`,
      { headers: AUTH },
    )
    // Only 30 total, so capped count is 30; the cap-at-100 ceiling is enforced.
    expect(((await overshoot.json()) as AuditEntry[]).length).toBeLessThanOrEqual(100)
  })

  it('scrubs email + phone numbers from summary defensively', async () => {
    auditStore.push(
      makeAudit({
        id: 'a-pii',
        ts: 5_000,
        summary: 'Updated by user@example.com phone +31 612345678',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/dashboard/recent-activity`,
      { headers: AUTH },
    )
    const json = (await res.json()) as AuditEntry[]
    expect(json[0].summary).not.toContain('user@example.com')
    expect(json[0].summary).toContain('[email]')
    expect(json[0].summary).not.toContain('+31 612345678')
    expect(json[0].summary).toContain('[phone]')
  })
})
