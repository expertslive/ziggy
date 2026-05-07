/** Authoritative list of physical kiosk locations for Experts Live Netherlands 2026.
 *
 * Each entry produces a row in the pair-overlay dropdown that volunteers see
 * on event-morning when setting up a kiosk. The `id` is what gets stored in
 * `localStorage.ziggy.kioskId` and tagged on every analytics event, so it
 * needs to be stable across deploys. The `label` is what humans read.
 *
 * Update this file (and re-deploy) if locations change. Pre-event tweaks are
 * fine; during the event, leave it alone — kiosks already paired will keep
 * their stored ID even if labels here change later.
 */

export interface KioskEntry {
  id: string
  label: string
  floor: 'Begane grond' | '1e verdieping' | '2e verdieping'
}

export const KIOSKS: KioskEntry[] = [
  { id: 'kiosk-registratie',  label: 'Registratiebalie',                      floor: 'Begane grond' },
  { id: 'kiosk-trap-gh',      label: 'Trap naast Grand Hall',                 floor: 'Begane grond' },
  { id: 'kiosk-trap-e2',      label: 'Trap naar Entresol 2 (Booth 12/16)',    floor: 'Begane grond' },
  { id: 'kiosk-merch',        label: 'Bij Merch stand',                       floor: 'Begane grond' },
  { id: 'kiosk-entresol-1',   label: 'Entresol 1',                            floor: '1e verdieping' },
  { id: 'kiosk-entresol-2',   label: 'Entresol 2',                            floor: '1e verdieping' },
  { id: 'kiosk-lounge-1',     label: 'Lounge bovenaan trap — A',              floor: '2e verdieping' },
  { id: 'kiosk-lounge-2',     label: 'Lounge bovenaan trap — B',              floor: '2e verdieping' },
]

/** localStorage key under which the paired kiosk ID is stored. */
export const KIOSK_ID_STORAGE_KEY = 'ziggy.kioskId'

/** Read the currently paired kiosk ID, or null if not yet paired. */
export function getKioskId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KIOSK_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Set (or clear) the kiosk ID. Validates against the known list — accepts
 * an arbitrary string only if it starts with the `kiosk-` prefix and isn't
 * empty, so we never silently store garbage. Returns the value actually
 * persisted (null when cleared, or the stored id). */
export function setKioskId(id: string | null): string | null {
  if (typeof window === 'undefined') return null
  try {
    if (!id) {
      window.localStorage.removeItem(KIOSK_ID_STORAGE_KEY)
      return null
    }
    const trimmed = id.trim()
    if (!trimmed.startsWith('kiosk-') || trimmed.length < 8) return null
    window.localStorage.setItem(KIOSK_ID_STORAGE_KEY, trimmed)
    return trimmed
  } catch {
    return null
  }
}

/** Lookup the friendly label/floor for a stored kiosk ID, or null if it
 * isn't in the known KIOSKS list. */
export function findKioskEntry(id: string | null): KioskEntry | null {
  if (!id) return null
  return KIOSKS.find((k) => k.id === id) ?? null
}

/** Group kiosks by floor for the pair-overlay dropdown. Returns entries in
 * BG → 1e → 2e order. */
export function kiosksByFloor(): Array<{ floor: KioskEntry['floor']; items: KioskEntry[] }> {
  const order: KioskEntry['floor'][] = ['Begane grond', '1e verdieping', '2e verdieping']
  return order.map((floor) => ({
    floor,
    items: KIOSKS.filter((k) => k.floor === floor),
  }))
}
