import { create } from 'zustand'
import { track } from '../lib/analytics'

type Theme = 'default' | 'high-contrast'
type FontScale = 1 | 1.2 | 1.4

interface KioskState {
  // Stable per kiosk
  eventSlug: string
  language: string
  lastInteraction: number

  // Per-session — cleared on inactivity
  selectedDayIndex: number | null
  openSessionId: number | null
  openSpeakerId: number | null
  searchQuery: string
  selectedMapId: string | null
  mapHighlightId: string | null
  agendaLabelFilter: string[]
  fontScale: FontScale
  theme: Theme

  // Actions
  touch: () => void
  setLanguage: (lang: string) => void
  openSession: (id: number | null) => void
  openSpeaker: (id: number | null) => void
  setSearchQuery: (q: string) => void
  setSelectedDayIndex: (i: number | null) => void
  setSelectedMap: (id: string | null, highlightId?: string | null) => void
  setMapHighlight: (id: string | null) => void
  toggleLabelFilter: (name: string) => void
  clearLabelFilter: () => void
  setFontScale: (s: FontScale) => void
  setTheme: (t: Theme) => void
  resetSession: () => void
}

const INITIAL_SESSION = {
  selectedDayIndex: null as number | null,
  openSessionId: null as number | null,
  openSpeakerId: null as number | null,
  searchQuery: '',
  selectedMapId: null as string | null,
  mapHighlightId: null as string | null,
  agendaLabelFilter: [] as string[],
  fontScale: 1 as FontScale,
  theme: 'default' as Theme,
}

const DEFAULT_LANGUAGE = 'nl'

export const useKioskStore = create<KioskState>()((set) => ({
  eventSlug: import.meta.env.VITE_EVENT_SLUG || 'experts-live-netherlands-2026',
  language: DEFAULT_LANGUAGE,
  lastInteraction: Date.now(),
  ...INITIAL_SESSION,

  touch: () => set({ lastInteraction: Date.now() }),
  setLanguage: (language) => {
    track('language_switch', { lang: language })
    set({ language })
  },
  openSession: (openSessionId) => {
    if (openSessionId != null) track('session_open', { sessionId: openSessionId })
    set({ openSessionId })
  },
  openSpeaker: (openSpeakerId) => {
    if (openSpeakerId != null) track('speaker_open', { speakerId: openSpeakerId })
    set({ openSpeakerId })
  },
  setSearchQuery: (searchQuery) => {
    // Don't log the query itself (privacy) — only its length, and only when
    // it's a "real" search (≥2 chars), to avoid 1-event-per-keystroke spam.
    if (searchQuery.length >= 2) track('search_query', { len: searchQuery.length })
    set({ searchQuery })
  },
  setSelectedDayIndex: (selectedDayIndex) => set({ selectedDayIndex }),
  setSelectedMap: (selectedMapId, mapHighlightId = null) => {
    if (mapHighlightId) track('deeplink_map', { mapId: selectedMapId, hotspotId: mapHighlightId })
    set({ selectedMapId, mapHighlightId })
  },
  setMapHighlight: (mapHighlightId) => set({ mapHighlightId }),
  toggleLabelFilter: (name) =>
    set((s) => ({
      agendaLabelFilter: s.agendaLabelFilter.includes(name)
        ? s.agendaLabelFilter.filter((n) => n !== name)
        : [...s.agendaLabelFilter, name],
    })),
  clearLabelFilter: () => set({ agendaLabelFilter: [] }),
  setFontScale: (fontScale) => set({ fontScale }),
  setTheme: (theme) => set({ theme }),
  resetSession: () => set({ ...INITIAL_SESSION, language: DEFAULT_LANGUAGE }),
}))
