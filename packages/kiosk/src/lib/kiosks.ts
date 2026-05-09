/** Kiosk-side helpers around the canonical KIOSKS list (now in @ziggy/shared
 *  so admin/dashboard endpoints can use the same source of truth). */

import { KIOSKS, findKioskEntry, type KioskEntry } from '@ziggy/shared'
export { KIOSKS, findKioskEntry, type KioskEntry }

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

/** Group kiosks by floor for the pair-overlay dropdown. Returns entries in
 * BG → 1e → 2e order. */
export function kiosksByFloor(): Array<{ floor: KioskEntry['floor']; items: KioskEntry[] }> {
  const order: KioskEntry['floor'][] = ['Begane grond', '1e verdieping', '2e verdieping']
  return order.map((floor) => ({
    floor,
    items: KIOSKS.filter((k) => k.floor === floor),
  }))
}
