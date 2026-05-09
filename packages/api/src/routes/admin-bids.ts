/** Admin endpoints for event-wide auction bids: list (JSON) + CSV export.
 *
 * Each row joins the parent shop-item to add `itemName` and a derived
 * `itemAuctionStatus` (`'closed'` if the item's auction has `closedAt` or
 * `endsAt` is in the past — otherwise `'open'`). */

import { Hono } from 'hono'
import type { AuctionBid, ShopItem } from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import { findActive } from '../lib/cosmos.js'
import { listAllBids } from '../lib/auction.js'

const adminBids = new Hono()

adminBids.use('/api/admin/events/:slug/bids', requireAuth)
adminBids.use('/api/admin/events/:slug/bids.csv', requireAuth)

type AuctionStatus = 'open' | 'closed'

interface AuctionBidWithItem extends AuctionBid {
  itemId: string
  itemName: string
  itemAuctionStatus: AuctionStatus
}

function statusOf(item: ShopItem | undefined, now = Date.now()): AuctionStatus {
  if (!item || !item.auction) return 'closed'
  if (item.auction.closedAt) return 'closed'
  return now < new Date(item.auction.endsAt).getTime() ? 'open' : 'closed'
}

async function buildJoinedRows(
  slug: string,
  now = Date.now(),
): Promise<AuctionBidWithItem[]> {
  const [bids, items] = await Promise.all([
    listAllBids(slug),
    findActive<ShopItem>('shop-items', 'eventSlug', slug),
  ])
  const itemsById = new Map(items.map((i) => [i.id, i]))
  return bids
    .map((b) => {
      const item = itemsById.get(b.shopItemId)
      return {
        ...b,
        itemId: b.shopItemId,
        itemName: item?.name ?? '',
        itemAuctionStatus: statusOf(item, now),
      }
    })
    .sort((a, b) => b.ts - a.ts)
}

/** GET /api/admin/events/:slug/bids?status=&q=&itemId= */
adminBids.get('/api/admin/events/:slug/bids', async (c) => {
  const slug = c.req.param('slug')
  const status = c.req.query('status')
  const itemId = c.req.query('itemId')
  const q = c.req.query('q')?.trim().toLowerCase()

  let rows = await buildJoinedRows(slug)

  if (itemId) {
    rows = rows.filter((r) => r.itemId === itemId)
  }

  if (status === 'open' || status === 'closed') {
    rows = rows.filter((r) => r.itemAuctionStatus === status)
  }

  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.displayName.toLowerCase().includes(q),
    )
  }

  return c.json(rows)
})

// ---------------------------------------------------------------------------
// CSV export — RFC 4180. Wrap in quotes if the field contains a comma,
// double-quote, CR, or LF; double any internal quote.
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'ts',
  'itemName',
  'amount',
  'name',
  'displayName',
  'email',
  'phone',
  'kioskId',
  'sessionId',
  'itemAuctionStatus',
] as const

function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const s = typeof value === 'number' ? String(value) : value
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowToCsv(b: AuctionBidWithItem): string {
  return [
    new Date(b.ts).toISOString(),
    b.itemName,
    b.amount,
    b.name,
    b.displayName,
    b.email,
    b.phone,
    b.kioskId,
    b.sessionId,
    b.itemAuctionStatus,
  ]
    .map(csvEscape)
    .join(',')
}

/** GET /api/admin/events/:slug/bids.csv */
adminBids.get('/api/admin/events/:slug/bids.csv', async (c) => {
  const slug = c.req.param('slug')
  const status = c.req.query('status')
  const itemId = c.req.query('itemId')
  const q = c.req.query('q')?.trim().toLowerCase()

  let rows = await buildJoinedRows(slug)

  if (itemId) {
    rows = rows.filter((r) => r.itemId === itemId)
  }
  if (status === 'open' || status === 'closed') {
    rows = rows.filter((r) => r.itemAuctionStatus === status)
  }
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.displayName.toLowerCase().includes(q),
    )
  }

  const header = CSV_COLUMNS.join(',')
  const body = [header, ...rows.map(rowToCsv)].join('\r\n') + '\r\n'

  console.log('[admin-bids] csv export', {
    eventSlug: slug,
    count: rows.length,
    ...(itemId && { itemId }),
    ...(status && { status }),
  })

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="bids-${slug}.csv"`,
    },
  })
})

export default adminBids
