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
  createdAt: string
  updatedAt: string
}
