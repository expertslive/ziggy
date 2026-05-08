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
  /** run.events session.roomGuid — used for kiosk deep-linking */
  roomGuid?: string
  /** When set, the hotspot matches sessions whose roomGuid is in this list.
   * Used when a physical hotspot represents multiple run.events rooms — e.g.
   * "Event hall 1" matching both the Event Hall 1 GUID and the combined
   * "Event Hall 1+2" GUID for the keynote/closing-note. Takes precedence
   * over roomGuid/roomName when present. */
  roomGuids?: string[]
  label: Record<string, string>
  /** Normalized 0-1 polygon coordinates [[x,y], [x,y], ...] */
  points: [number, number][]
  color?: string
}
