import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuctionBid, ShopItem } from '@ziggy/shared'

let bidStore: AuctionBid[] = []
let itemStore: ShopItem[] = []

vi.mock('../lib/cosmos.js', () => ({
  ensureAuctionContainer: vi.fn(async () => {}),
  findActive: vi.fn(async (container: string, _key: string, slug: string) => {
    if (container === 'shop-items') {
      return itemStore.filter((i) => i.eventSlug === slug && !i.deletedAt)
    }
    return []
  }),
  getContainer: vi.fn((name: string) => {
    if (name !== 'auction-bids') throw new Error(`unexpected container: ${name}`)
    return {
      items: {
        query: (spec: { parameters: Array<{ name: string; value: string }> }) => ({
          fetchAll: async () => {
            const slugParam = spec.parameters.find((p) => p.name === '@s')
            const slug = slugParam?.value
            const rows = bidStore
              .filter((b) => b.eventSlug === slug)
              .sort((a, b) => b.ts - a.ts)
            return { resources: rows }
          },
        }),
      },
    }
  }),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    jwtSecret: 'x'.repeat(32),
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

import adminBids from './admin-bids.js'

const SLUG = 'test-event'
const AUTH = { authorization: 'Bearer good-token' }

const FAR_FUTURE = '2099-12-31T23:59:59.000Z'
const PAST = '2000-01-01T00:00:00.000Z'

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: overrides.id ?? 'item-1',
    eventSlug: SLUG,
    name: 'Octocat Plushie',
    description: { en: 'A cute octocat' },
    imageUrl: 'https://example.com/octocat.png',
    priceLabel: '€10',
    sortOrder: 1,
    auction: {
      minStartBid: 1000,
      minIncrement: 500,
      endsAt: FAR_FUTURE,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeBid(overrides: Partial<AuctionBid> = {}): AuctionBid {
  return {
    id: overrides.id ?? `bid-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: SLUG,
    shopItemId: 'item-1',
    ts: 1_700_000_000_000,
    amount: 5000,
    name: 'Maarten Goet',
    email: 'maarten@example.com',
    phone: '0612345678',
    displayName: 'Maarten G.',
    ...overrides,
  }
}

function buildApp() {
  return new Hono().route('/', adminBids)
}

beforeEach(() => {
  bidStore = []
  itemStore = []
  vi.clearAllMocks()
})

describe('GET /api/admin/events/:slug/bids', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids`)
    expect(res.status).toBe(401)
  })

  it('returns 401 with bad token', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids`, {
      headers: { authorization: 'Bearer bad-token' },
    })
    expect(res.status).toBe(401)
  })

  it('returns rows joined with itemName + status, sorted ts desc', async () => {
    itemStore.push(makeItem({ id: 'item-1', name: 'Octocat' }))
    bidStore.push(
      makeBid({ id: 'b-old', ts: 1_700_000_000_000, amount: 1500 }),
      makeBid({ id: 'b-new', ts: 1_700_000_010_000, amount: 2000 }),
      makeBid({ id: 'b-mid', ts: 1_700_000_005_000, amount: 1700 }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids`, {
      headers: AUTH,
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      id: string
      itemName: string
      itemId: string
      itemAuctionStatus: string
    }>
    expect(json.map((r) => r.id)).toEqual(['b-new', 'b-mid', 'b-old'])
    expect(json[0].itemName).toBe('Octocat')
    expect(json[0].itemId).toBe('item-1')
    expect(json[0].itemAuctionStatus).toBe('open')
  })

  it('?itemId= filters to one item only', async () => {
    itemStore.push(
      makeItem({ id: 'item-1', name: 'Octocat' }),
      makeItem({ id: 'item-2', name: 'Mug' }),
    )
    bidStore.push(
      makeBid({ id: 'b1', shopItemId: 'item-1', ts: 100 }),
      makeBid({ id: 'b2', shopItemId: 'item-2', ts: 200 }),
      makeBid({ id: 'b3', shopItemId: 'item-1', ts: 300 }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/bids?itemId=item-1`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Array<{ id: string; itemId: string }>
    expect(json.map((r) => r.id)).toEqual(['b3', 'b1'])
    expect(json.every((r) => r.itemId === 'item-1')).toBe(true)
  })

  it('?status=open excludes bids on closed items', async () => {
    itemStore.push(
      makeItem({ id: 'item-open', name: 'Open' }),
      makeItem({
        id: 'item-closed-flag',
        name: 'Closed by flag',
        auction: {
          minStartBid: 1000,
          minIncrement: 500,
          endsAt: FAR_FUTURE,
          closedAt: '2025-01-01T00:00:00.000Z',
        },
      }),
      makeItem({
        id: 'item-closed-time',
        name: 'Closed by time',
        auction: { minStartBid: 1000, minIncrement: 500, endsAt: PAST },
      }),
    )
    bidStore.push(
      makeBid({ id: 'b-open', shopItemId: 'item-open', ts: 100 }),
      makeBid({ id: 'b-flag', shopItemId: 'item-closed-flag', ts: 200 }),
      makeBid({ id: 'b-time', shopItemId: 'item-closed-time', ts: 300 }),
    )

    const app = buildApp()
    const open = await app.request(
      `/api/admin/events/${SLUG}/bids?status=open`,
      { headers: AUTH },
    )
    const openJson = (await open.json()) as Array<{ id: string }>
    expect(openJson.map((r) => r.id)).toEqual(['b-open'])

    const closed = await app.request(
      `/api/admin/events/${SLUG}/bids?status=closed`,
      { headers: AUTH },
    )
    const closedJson = (await closed.json()) as Array<{ id: string }>
    expect(closedJson.map((r) => r.id).sort()).toEqual(['b-flag', 'b-time'])
  })

  it('?q= matches across name, email, displayName, case-insensitive', async () => {
    itemStore.push(makeItem({ id: 'item-1' }))
    bidStore.push(
      makeBid({
        id: 'b-name',
        ts: 100,
        name: 'Wilbert van Asseldonk',
        email: 'w@example.com',
        displayName: 'Wilbert v.',
      }),
      makeBid({
        id: 'b-email',
        ts: 200,
        name: 'Jan Janssen',
        email: 'maarten@wortell.nl',
        displayName: 'Jan J.',
      }),
      makeBid({
        id: 'b-display',
        ts: 300,
        name: 'Anna Smith',
        email: 'anna@example.com',
        displayName: 'MAARTEN G.',
      }),
      makeBid({
        id: 'b-none',
        ts: 400,
        name: 'No Match',
        email: 'no@example.com',
        displayName: 'Nope',
      }),
    )

    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/bids?q=maarten`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Array<{ id: string }>
    expect(json.map((r) => r.id).sort()).toEqual(['b-display', 'b-email'])

    const upper = await app.request(
      `/api/admin/events/${SLUG}/bids?q=WILBERT`,
      { headers: AUTH },
    )
    const upperJson = (await upper.json()) as Array<{ id: string }>
    expect(upperJson.map((r) => r.id)).toEqual(['b-name'])
  })

  it('combines status + q + itemId filters', async () => {
    itemStore.push(
      makeItem({ id: 'item-1', name: 'Octo' }),
      makeItem({
        id: 'item-2',
        name: 'Closed',
        auction: { minStartBid: 1000, minIncrement: 500, endsAt: PAST },
      }),
    )
    bidStore.push(
      makeBid({
        id: 'b1',
        shopItemId: 'item-1',
        ts: 100,
        name: 'Maarten',
        displayName: 'Maarten G.',
        email: 'maarten@example.com',
      }),
      makeBid({
        id: 'b2',
        shopItemId: 'item-1',
        ts: 200,
        name: 'Other Person',
        displayName: 'Other P.',
        email: 'other@example.com',
      }),
      makeBid({
        id: 'b3',
        shopItemId: 'item-2',
        ts: 300,
        name: 'Maarten',
        displayName: 'Maarten G.',
        email: 'maarten@example.com',
      }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/bids?status=open&q=maarten&itemId=item-1`,
      { headers: AUTH },
    )
    const json = (await res.json()) as Array<{ id: string }>
    expect(json.map((r) => r.id)).toEqual(['b1'])
  })
})

describe('GET /api/admin/events/:slug/bids.csv', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids.csv`)
    expect(res.status).toBe(401)
  })

  it('emits expected columns + Content-Type + Content-Disposition', async () => {
    itemStore.push(makeItem({ id: 'item-1', name: 'Octocat' }))
    bidStore.push(makeBid({ id: 'b1' }))
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids.csv`, {
      headers: AUTH,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="bids-${SLUG}.csv"`,
    )
    const text = await res.text()
    const [header] = text.split('\r\n')
    expect(header).toBe(
      'ts,itemName,amount,name,displayName,email,phone,kioskId,sessionId,itemAuctionStatus',
    )
  })

  it('escapes commas, double quotes, and newlines per RFC 4180', async () => {
    itemStore.push(makeItem({ id: 'item-1', name: 'Octo, Cat' }))
    bidStore.push(
      makeBid({
        id: 'b1',
        ts: Date.UTC(2025, 0, 1, 12, 0, 0),
        name: 'Smith, John',
        email: 'a"b@example.com',
        displayName: 'Line1\r\nLine2',
        amount: 1234,
        phone: '0611111111',
      }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids.csv`, {
      headers: AUTH,
    })
    const text = await res.text()
    const lines = text.split('\r\n')
    // header + escaped row containing CRLF inside quotes spans 2 lines + trailing
    // empty line after final \r\n. The data row is lines[1] + lines[2].
    expect(lines[0]).toBe(
      'ts,itemName,amount,name,displayName,email,phone,kioskId,sessionId,itemAuctionStatus',
    )
    const dataRow = lines[1] + '\r\n' + lines[2]
    expect(dataRow).toContain('"Octo, Cat"')
    expect(dataRow).toContain('"Smith, John"')
    expect(dataRow).toContain('"a""b@example.com"')
    expect(dataRow).toContain('"Line1\r\nLine2"')
  })

  it('reflects an item-status mismatch in the itemAuctionStatus column', async () => {
    itemStore.push(
      makeItem({
        id: 'item-closed',
        name: 'Closed Item',
        auction: { minStartBid: 1000, minIncrement: 500, endsAt: PAST },
      }),
    )
    bidStore.push(
      makeBid({ id: 'b1', shopItemId: 'item-closed', ts: 1_700_000_000_000 }),
    )
    const app = buildApp()
    const res = await app.request(`/api/admin/events/${SLUG}/bids.csv`, {
      headers: AUTH,
    })
    const text = await res.text()
    const lines = text.split('\r\n')
    expect(lines[1].endsWith(',closed')).toBe(true)
  })

  it('honours the itemId filter', async () => {
    itemStore.push(
      makeItem({ id: 'item-1', name: 'Keep' }),
      makeItem({ id: 'item-2', name: 'Drop' }),
    )
    bidStore.push(
      makeBid({ id: 'b-keep', shopItemId: 'item-1', ts: 100 }),
      makeBid({ id: 'b-drop', shopItemId: 'item-2', ts: 200 }),
    )
    const app = buildApp()
    const res = await app.request(
      `/api/admin/events/${SLUG}/bids.csv?itemId=item-1`,
      { headers: AUTH },
    )
    const text = await res.text()
    expect(text).toContain('Keep')
    expect(text).not.toContain('Drop')
  })
})
