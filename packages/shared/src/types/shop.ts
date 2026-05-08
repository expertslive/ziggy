/** Shop item — admin-managed, sold at the event for charity */
export interface ShopItem {
  id: string
  eventSlug: string
  name: string
  description: Record<string, string>
  /** Cover image (used in the shop grid + as the first slide in the detail gallery) */
  imageUrl: string
  /** Optional extra images shown after the cover in the detail modal carousel */
  galleryUrls?: string[]
  priceLabel: string
  isHighlighted?: boolean
  sortOrder: number
  /** Optional auction config — when present, the kiosk renders the
   * auction split-pane on this item instead of the regular price label.
   * Each amount is in EUR cents; endsAt is ISO datetime. */
  auction?: {
    minStartBid: number
    minIncrement: number
    endsAt: string
    closedAt?: string
  }
  createdAt: string
  updatedAt: string
  /** Soft-delete marker — set on DELETE, cleared on restore. */
  deletedAt?: string
}
