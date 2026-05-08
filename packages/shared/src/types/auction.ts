/** Auction types — for the Octocat charity bid feature.
 *
 * Auction config lives on the shop-item itself (one item with auction
 * config = one auction). Bids are stored in a dedicated `auction-bids`
 * Cosmos container so we can write append-only without touching the
 * shop-item doc.
 *
 * Public bid views never include email/phone. Admins see the full row
 * with PII via /api/admin/.../auction/full. */

export interface AuctionConfig {
  /** Minimum amount for the very first bid, in EUR cents. */
  minStartBid: number
  /** Each new bid must be at least this many cents above the previous high. */
  minIncrement: number
  /** ISO datetime — bids submitted after this are refused.
   * Closing manually = setting `closedAt`; the `endsAt` provides a default. */
  endsAt: string
  /** ISO datetime when an admin closed the auction (or the engine auto-closed
   * because endsAt passed and a write was attempted). When set, bids are
   * rejected regardless of endsAt. */
  closedAt?: string
}

export interface AuctionBid {
  /** Cosmos id — synthetic: ts-shopItemId-random. */
  id: string
  eventSlug: string
  shopItemId: string
  ts: number
  /** Amount in EUR cents. */
  amount: number
  /** Submitted full name — admin-only. */
  name: string
  /** Submitted email — admin-only. */
  email: string
  /** Submitted phone (06-…) — admin-only. */
  phone: string
  /** Public-safe display name, e.g. "Maarten G." */
  displayName: string
  /** Paired kiosk-id when the bid was placed (null on un-paired devices). */
  kioskId?: string
  /** Anonymous session-id of the kiosk session. Used to enforce the
   * "1 bid per session" rule. */
  sessionId?: string
}

/** Public payload from GET /api/events/:slug/shop-items/:id/auction. */
export interface AuctionPublicState {
  shopItemId: string
  config: AuctionConfig
  isOpen: boolean
  /** Highest current bid, or null if there are no bids yet. */
  highest: { amount: number; displayName: string; ts: number } | null
  /** Public bid history — most recent first. PII-stripped. */
  bids: { amount: number; displayName: string; ts: number }[]
}
