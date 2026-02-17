/** run.events API base URL */
export const RUN_EVENTS_API_BASE = 'https://modesty.runevents.net'

/** Cache TTL for run.events data (5 minutes) */
export const CACHE_TTL_MS = 5 * 60 * 1000

/** Kiosk inactivity timeout before auto-reset (60 seconds) */
export const INACTIVITY_TIMEOUT_MS = 60 * 1000

/** Minimum search query length (run.events requires 4+) */
export const MIN_SEARCH_LENGTH = 4

/** Supported languages */
export const SUPPORTED_LANGUAGES = ['nl', 'en', 'de', 'da', 'fr', 'it', 'el'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/** Default languages enabled for a new event */
export const DEFAULT_LANGUAGES: SupportedLanguage[] = ['nl', 'en']
