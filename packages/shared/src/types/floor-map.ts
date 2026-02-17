/** Floor map types (admin-managed, stored in Cosmos DB) */

export interface FloorMap {
  id: string
  eventSlug: string
  name: string
  label: Record<string, string>
  imageUrl: string
  sortOrder: number
  hotspots: Hotspot[]
  createdAt: string
  updatedAt: string
}

/** A tappable polygon region on a floor map */
export interface Hotspot {
  id: string
  roomName: string
  roomId?: string
  label: Record<string, string>
  /** Normalized 0-1 polygon coordinates [[x,y], [x,y], ...] */
  points: [number, number][]
  color?: string
}
