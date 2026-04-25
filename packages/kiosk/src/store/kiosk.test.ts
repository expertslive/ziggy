import { describe, it, expect, beforeEach } from 'vitest'
import { useKioskStore } from './kiosk'

describe('kiosk store resetSession', () => {
  beforeEach(() => {
    useKioskStore.setState(useKioskStore.getInitialState())
  })

  it('clears modals, search, filters, and ui prefs', () => {
    useKioskStore.setState({
      openSessionId: 42,
      openSpeakerId: 7,
      searchQuery: 'azure',
      selectedDayIndex: 2,
      selectedMapId: 'm1',
      mapHighlightId: 'h1',
      agendaLabelFilter: ['Security'],
      fontScale: 1.4,
      theme: 'high-contrast',
      language: 'de',
    })

    useKioskStore.getState().resetSession()

    const s = useKioskStore.getState()
    expect(s.openSessionId).toBeNull()
    expect(s.openSpeakerId).toBeNull()
    expect(s.searchQuery).toBe('')
    expect(s.selectedDayIndex).toBeNull()
    expect(s.selectedMapId).toBeNull()
    expect(s.mapHighlightId).toBeNull()
    expect(s.agendaLabelFilter).toEqual([])
    expect(s.fontScale).toBe(1)
    expect(s.theme).toBe('default')
    expect(s.language).toBe('nl')
  })

  it('does not reset eventSlug or lastInteraction', () => {
    const before = useKioskStore.getState().lastInteraction
    useKioskStore.setState({ eventSlug: 'test-event' })
    useKioskStore.getState().resetSession()
    const after = useKioskStore.getState()
    expect(after.eventSlug).toBe('test-event')
    expect(after.lastInteraction).toBe(before)
  })

  it('toggleLabelFilter adds and removes', () => {
    useKioskStore.getState().toggleLabelFilter('AI')
    expect(useKioskStore.getState().agendaLabelFilter).toEqual(['AI'])
    useKioskStore.getState().toggleLabelFilter('Cloud')
    expect(useKioskStore.getState().agendaLabelFilter).toEqual(['AI', 'Cloud'])
    useKioskStore.getState().toggleLabelFilter('AI')
    expect(useKioskStore.getState().agendaLabelFilter).toEqual(['Cloud'])
  })

  it('clearLabelFilter empties the list', () => {
    useKioskStore.getState().toggleLabelFilter('AI')
    useKioskStore.getState().toggleLabelFilter('Cloud')
    useKioskStore.getState().clearLabelFilter()
    expect(useKioskStore.getState().agendaLabelFilter).toEqual([])
  })

  it('setSelectedMap sets both mapId and highlightId', () => {
    useKioskStore.getState().setSelectedMap('m1', 'h1')
    expect(useKioskStore.getState().selectedMapId).toBe('m1')
    expect(useKioskStore.getState().mapHighlightId).toBe('h1')
  })

  it('setSelectedMap defaults highlightId to null', () => {
    useKioskStore.getState().setSelectedMap('m1')
    expect(useKioskStore.getState().selectedMapId).toBe('m1')
    expect(useKioskStore.getState().mapHighlightId).toBeNull()
  })
})
