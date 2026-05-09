/** Studiebeurs nomination types (admin-managed, stored in Cosmos DB).
 *  Public form at /nominate writes records here; admin reviews via
 *  /admin/nominations. */

export type NominationStatus = 'pending' | 'verified' | 'rejected'

export interface Nomination {
  id: string
  eventSlug: string
  // Genomineerde
  nomineeName: string
  nomineeEmail?: string
  nomineePhone?: string
  // Reden
  reason: string
  // Nominator
  nominatorName: string
  nominatorEmail: string
  nominatorPhone?: string
  // Consent — must be true on submit (consent to share nominee's name on socials).
  consentToShareNomineeName: boolean
  // Meta
  createdAt: string
  ipAddress?: string
  userAgent?: string
  status: NominationStatus
  adminNotes?: string
  /** Soft-delete marker — set on DELETE, never hard-deleted. */
  deletedAt?: string
}
