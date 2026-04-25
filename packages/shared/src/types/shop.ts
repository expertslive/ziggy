/** Shop item — admin-managed, sold at the event for charity */
export interface ShopItem {
  id: string
  eventSlug: string
  name: string
  description: Record<string, string>
  imageUrl: string
  priceLabel: string
  isHighlighted?: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
