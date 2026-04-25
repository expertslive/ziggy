/** Sponsor types (admin-managed, stored in Cosmos DB) */

export interface Sponsor {
  id: string
  eventSlug: string
  name: string
  tierId: string
  description: Record<string, string>
  logoUrl: string
  website?: string
  boothNumber?: string
  // kiosk-local: link to a hotspot on a floor map for "Show on map" deep-linking
  floorMapHotspotId?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SponsorTier {
  id: string
  eventSlug: string
  name: string
  label: Record<string, string>
  sortOrder: number
  displaySize: 'large' | 'medium' | 'small'
  createdAt: string
  updatedAt: string
}
