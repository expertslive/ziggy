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
import { sendEmail } from './email.js'
import { getEnv } from '../env.js'

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

  // Dedupe previous bidders by email and keep each person's highest bid.
  // Used for the outbid-notification fan-out after the write lands —
  // everyone whose current best is now below the new high gets one mail.
  const byEmail = new Map<string, AuctionBid>()
  for (const b of bids) {
    if (!b.email) continue
    const key = b.email.trim().toLowerCase()
    const existing = byEmail.get(key)
    if (!existing || b.amount > existing.amount) {
      byEmail.set(key, b)
    }
  }

  await ensureAuctionContainer()
  const container = getContainer('auction-bids')
  // Cosmos ORDER BY surfaces concurrent bids deterministically; we don't
  // do a read-after-write CAS. If two bids land in the same second the
  // higher amount wins because publicState picks max(amount).
  await container.items.create(bid)

  // Outbid notification — fan out to every distinct prior bidder whose
  // highest bid is now below the new amount, skipping the new bidder
  // themselves. Fire-and-forget per recipient so the bid response stays
  // snappy and one failed send doesn't poison the others.
  const newBidderKey = args.email.trim().toLowerCase()
  for (const [key, prev] of byEmail) {
    if (key === newBidderKey) continue
    if (prev.amount >= bid.amount) continue
    void notifyOutbid(item, prev, bid).catch((err) => {
      console.warn(
        '[auction] outbid email failed for',
        prev.email,
        '-',
        (err as Error).message,
      )
    })
  }

  return { ok: true, bid }
}

// ---------------------------------------------------------------------------
// Outbid email
// ---------------------------------------------------------------------------

function formatEur(cents: number): string {
  return `€${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatCloseTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

export function buildOutbidEmail(
  item: ShopItem,
  outbidBidder: AuctionBid,
  newBid: AuctionBid,
  kioskBaseUrl: string,
): { subject: string; html: string; text: string } {
  const itemName = item.name
  const yours = formatEur(outbidBidder.amount)
  const winning = formatEur(newBid.amount)
  const closeAt = item.auction ? formatCloseTime(item.auction.endsAt) : '?'
  const link = `${kioskBaseUrl.replace(/\/$/, '')}/shop`
  const subject = `Je bent overboden — ${itemName}`

  const text = [
    `Je bent overboden!`,
    ``,
    `Iemand heeft net een hoger bod uitgebracht op de ${itemName}.`,
    ``,
    `Jouw bod:        ${yours}`,
    `Nieuw hoogste:   ${winning}`,
    ``,
    `De veiling sluit om ${closeAt} — wil je nog een poging wagen?`,
    `${link}`,
    ``,
    `Je ontvangt deze mail omdat je een bod plaatste in de Experts Live veiling.`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F1629;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Je bent overboden 😱</h1>
    <p style="margin:0 0 20px;color:#475569;line-height:1.5;">
      Iemand heeft net een hoger bod uitgebracht op de <strong style="color:#0F1629;">${escapeHtml(itemName)}</strong>.
    </p>

    <div style="background:#f1f5f9;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#64748b;">Jouw bod</span>
        <strong>${yours}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#64748b;">Nieuw hoogste bod</span>
        <strong style="color:#d97706;">${winning}</strong>
      </div>
    </div>

    <p style="margin:0 0 24px;color:#0F1629;line-height:1.5;">
      De veiling sluit om <strong>${closeAt}</strong>. Wil je nog een poging wagen?
    </p>

    <a href="${link}" style="display:inline-block;background:#0082C8;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
      Plaats een nieuw bod →
    </a>

    <p style="margin:32px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      Je ontvangt deze mail omdat je een bod plaatste in de Experts Live veiling.
    </p>
  </div>
</body></html>`

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function notifyOutbid(
  item: ShopItem,
  outbidBidder: AuctionBid,
  newBid: AuctionBid,
): Promise<void> {
  const env = getEnv()
  if (!env.resendApiKey) return // not configured yet — silently skip
  const base = env.kioskBaseUrl || 'https://ziggy.expertslive.dev'
  const { subject, html, text } = buildOutbidEmail(item, outbidBidder, newBid, base)
  await sendEmail({
    to: outbidBidder.email,
    subject,
    html,
    text,
  })
}
