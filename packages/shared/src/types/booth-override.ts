/** Booth override document — kiosk-local metadata layered over run.events booth data */
export interface BoothOverride {
  /** Composite id: `${eventSlug}:${boothId}` */
  id: string
  eventSlug: string
  boothId: string
  floorMapHotspotId?: string
  updatedAt: string
}
