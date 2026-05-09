/** Kiosk metadata — admin-managed alias for kioskIds seen in heartbeats.
 *  Lets the dashboard show "Hall 3 — Speakers entrance" instead of
 *  "kiosk-3F2A". The pair-overlay uses shortCode (when set) so on-site
 *  pairing screens can match the printed card. */

export interface KioskMeta {
  /** Same value as the kioskId reported in analytics heartbeats — used as
   *  Cosmos `id` so we can read straight by kioskId without an extra index. */
  id: string
  eventSlug: string
  /** Human-readable label shown across admin UI. Required, 1-100 chars. */
  displayName: string
  /** Optional short code matched by the kiosk pair-overlay flow.
   *  2-12 chars, uppercase letters + digits. */
  shortCode?: string
  /** Optional free-text location hint, e.g. "Hall 3 — Speakers entrance". */
  location?: string
  addedAt: string
  updatedAt: string
  /** Soft-delete marker — set on DELETE, never hard-deleted. */
  deletedAt?: string
}
