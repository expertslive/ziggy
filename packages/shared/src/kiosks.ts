/** Authoritative list of physical kiosk locations for Experts Live Netherlands 2026.
 *
 * Single source of truth used by:
 *   - kiosk app: pair-overlay UI + heartbeat tagging
 *   - admin: Analytics + Dashboard fall back to this list when a heartbeat
 *     hasn't arrived yet, so volunteers see all expected kiosks even before
 *     they boot.
 *
 * Update + re-deploy if locations change pre-event. During the event leave it
 * alone — kiosks already paired keep their stored ID regardless of label
 * changes here.
 */

export interface KioskEntry {
  id: string
  label: string
  floor: 'Begane grond' | '1e verdieping' | '2e verdieping'
}

export const KIOSKS: KioskEntry[] = [
  { id: 'kiosk-registratie', label: 'Registratiebalie', floor: 'Begane grond' },
  { id: 'kiosk-trap-gh', label: 'Trap naast Grand Hall', floor: 'Begane grond' },
  { id: 'kiosk-trap-e2', label: 'Trap naar Entresol 2 (Booth 12/16)', floor: 'Begane grond' },
  { id: 'kiosk-merch', label: 'Bij Merch stand', floor: 'Begane grond' },
  { id: 'kiosk-entresol-1', label: 'Entresol 1', floor: '1e verdieping' },
  { id: 'kiosk-entresol-2', label: 'Entresol 2', floor: '1e verdieping' },
  { id: 'kiosk-lounge-1', label: 'Lounge bovenaan trap — A', floor: '2e verdieping' },
  { id: 'kiosk-lounge-2', label: 'Lounge bovenaan trap — B', floor: '2e verdieping' },
]

export function findKioskEntry(id: string | null | undefined): KioskEntry | null {
  if (!id) return null
  return KIOSKS.find((k) => k.id === id) ?? null
}
