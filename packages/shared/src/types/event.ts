/** Ziggy event configuration (stored in Cosmos DB) */

// Public — returned by GET /api/events/:slug/config (kiosk reads this)
export interface PublicEventConfig {
  slug: string
  name: string
  timezone: string
  languages: string[]
  defaultLanguage: string
  branding: EventBranding
  days: EventDay[]
  startDate?: string
  endDate?: string
}

// Admin — returned by GET /api/admin/events/:slug/config
// Currently identical to Public; kept as a distinct type so future admin-only
// fields never accidentally leak through the public route.
export type AdminEventConfig = PublicEventConfig & {
  id: string
  createdAt: string
  updatedAt: string
}

// Legacy alias — consumers that need either shape. Prefer PublicEventConfig
// or AdminEventConfig at call sites.
export type EventConfig = AdminEventConfig

export interface EventDay {
  date: string
  label: Record<string, string>
}

export interface EventBranding {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  logoUrl?: string
  logoLightUrl?: string
  fontFamily?: string
}

export const DEFAULT_BRANDING: EventBranding = {
  primaryColor: '#0082C8',
  secondaryColor: '#1B2A5B',
  backgroundColor: '#0F1629',
  textColor: '#FFFFFF',
  fontFamily: 'Nunito',
}
