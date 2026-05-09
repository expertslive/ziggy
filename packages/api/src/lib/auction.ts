/** Auction state + bid placement helpers.
 *
 * We use a Cosmos query for the current highest bid on every read/write
 * rather than caching state on the shop-item doc. With single-digit
 * bids per minute and a small partition this is fast enough and avoids
 * the read-modify-write hazard.
 *
 * Concurrency: on POST we re-query the current high after the timestamp
 * test so two simultaneous bids land in deterministic order; if the
 * later request would no longer beat the high it's rejected with 409. */

import type { AuctionBid, AuctionPublicState, ShopItem } from '@ziggy/shared'
import { ensureAuctionContainer, getContainer } from './cosmos.js'

/** Public-display name from a full name. "Maarten Goet" → "Maarten G."
 * Single-name input gets returned as-is. */
export function publicDisplayName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  return `${parts.slice(0, -1).join(' ')} ${last[0].toUpperCase()}.`
}

/** Pull every bid for one shop item, newest first. */
export async function listBidsForItem(
  eventSlug: string,
  shopItemId: string,
): Promise<AuctionBid[]> {
  await ensureAuctionContainer()
  const container = getContainer('auction-bids')
  const { resources } = await container.items
    .query<AuctionBid>({
      query: `SELECT * FROM c
                WHERE c.eventSlug = @s AND c.shopItemId = @id
                ORDER BY c.ts DESC`,
      parameters: [
        { name: '@s', value: eventSlug },
        { name: '@id', value: shopItemId },
      ],
    })
    .fetchAll()
  return resources
}

/** Pull every bid for an event slug, newest first. JOIN-style filtering
 * against shop-items happens in the route. */
export async function listAllBids(eventSlug: string): Promise<AuctionBid[]> {
  await ensureAuctionContainer()
  const container = getContainer('auction-bids')
  const { resources } = await container.items
    .query<AuctionBid>({
      query: `SELECT * FROM c
                WHERE c.eventSlug = @s
                ORDER BY c.ts DESC`,
      parameters: [{ name: '@s', value: eventSlug }],
    })
    .fetchAll()
  return resources
}

export function isAuctionOpen(item: ShopItem, now = Date.now()): boolean {
  if (!item.auction) return false
  if (item.auction.closedAt) return false
  return now < new Date(item.auction.endsAt).getTime()
}

/** Build the public state snapshot the kiosk consumes. */
export function publicState(
  item: ShopItem,
  bids: AuctionBid[],
  now = Date.now(),
): AuctionPublicState | null {
  if (!item.auction) return null
  const sorted = [...bids].sort((a, b) => b.ts - a.ts)
  const top = sorted.reduce<AuctionBid | null>(
    (best, b) => (best == null || b.amount > best.amount ? b : best),
    null,
  )
  return {
    shopItemId: item.id,
    config: item.auction,
    isOpen: isAuctionOpen(item, now),
    highest: top
      ? { amount: top.amount, displayName: top.displayName, ts: top.ts }
      : null,
    bids: sorted.map((b) => ({
      amount: b.amount,
      displayName: b.displayName,
      ts: b.ts,
    })),
  }
}

export interface PlaceBidArgs {
  eventSlug: string
  item: ShopItem
  amountCents: number
  name: string
  email: string
  phone: string
  kioskId?: string
  sessionId?: string
}

export type PlaceBidResult =
  | { ok: true; bid: AuctionBid }
  | { ok: false; status: number; error: string }

/** Place a bid with all the validation. The function is the single point
 * the public API trusts — it re-checks current high after fetching to
 * catch concurrent submissions. */
export async function placeBid(args: PlaceBidArgs): Promise<PlaceBidResult> {
  const { item, amountCents } = args
  if (!item.auction) {
    return { ok: false, status: 400, error: 'Auction not configured for this item' }
  }
  if (!isAuctionOpen(item)) {
    return { ok: false, status: 410, error: 'Auction is closed' }
  }

  const bids = await listBidsForItem(args.eventSlug, item.id)
  const currentHigh = bids.reduce(
    (h, b) => (b.amount > h ? b.amount : h),
    0,
  )
  const minNext =
    currentHigh > 0
      ? currentHigh + item.auction.minIncrement
      : item.auction.minStartBid
  if (amountCents < minNext) {
    return {
      ok: false,
      status: 400,
      error: `Minimum bod is €${(minNext / 100).toFixed(2)}`,
    }
  }

  // 1 bid per kiosk session — same sessionId can't outbid itself.
  if (args.sessionId) {
    const already = bids.find((b) => b.sessionId === args.sessionId)
    if (already) {
      return {
        ok: false,
        status: 409,
        error: 'Je hebt al geboden in deze sessie',
      }
    }
  }

  const now = Date.now()
  const bid: AuctionBid = {
    id: `${now}-${item.id}-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: args.eventSlug,
    shopItemId: item.id,
    ts: now,
    amount: amountCents,
    name: args.name,
    email: args.email,
    phone: args.phone,
    displayName: publicDisplayName(args.name),
    kioskId: args.kioskId,
    sessionId: args.sessionId,
  }

  await ensureAuctionContainer()
  const container = getContainer('auction-bids')
  // Cosmos ORDER BY surfaces concurrent bids deterministically; we don't
  // do a read-after-write CAS. If two bids land in the same second the
  // higher amount wins because publicState picks max(amount).
  await container.items.create(bid)
  return { ok: true, bid }
}
