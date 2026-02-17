/** Ziggy event configuration (stored in Cosmos DB) */

export interface EventConfig {
  id: string
  slug: string
  name: string
  apiKey: string
  timezone: string
  startDate: string
  endDate: string
  days: EventDay[]
  languages: string[]
  defaultLanguage: string
  branding: EventBranding
  createdAt: string
  updatedAt: string
}

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
