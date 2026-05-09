/** Admin audit log entry — one row per write to a Cosmos container.
 *
 * Stored in its own `audit-log` container, partition key `/eventSlug`.
 * Append-only and TTL'd (default 365 days) — never updated, never
 * deleted by app code. */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'snapshot'
  | 'restore-snapshot'
  | 'login'
  | 'login-failed'
  | 'password-change'

/** Concrete record types we track. The recordId is whatever document
 * ID lives in the target container (uuid, slug, slug:lang, etc.). */
export type AuditTarget =
  | 'sponsor'
  | 'sponsor-tier'
  | 'floor-map'
  | 'shop-item'
  | 'booth-override'
  | 'i18n-overrides'
  | 'event-config'
  | 'admin'
  | 'snapshot'
  | 'auction'
  | 'nomination'

export interface AuditEntry {
  /** ts-actor-target-recordId-random — synthetic for ordering. */
  id: string
  eventSlug: string
  ts: number
  /** Email of the admin who performed the action. */
  actor: string
  action: AuditAction
  target: AuditTarget
  recordId?: string
  /** Short human-readable summary, e.g. "Updated sponsor 'KPN'" or
   * "Replaced 50 hotspots on Begane grond". Surfaced verbatim in the
   * audit feed UI; do not put secrets here. */
  summary: string
  /** Optional structured detail — e.g. { added: 3, removed: 1, changed: 2 }
   * for a hotspot diff. Kept small (< 1 KB). */
  meta?: Record<string, unknown>
}
