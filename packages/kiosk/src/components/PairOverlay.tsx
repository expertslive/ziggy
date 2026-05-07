import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { kiosksByFloor, setKioskId, findKioskEntry } from '../lib/kiosks'

/** Full-screen overlay shown when a device hasn't been paired to a known
 * kiosk location yet. Volunteer picks a location from the grouped list →
 * we persist it to localStorage and dismiss the overlay. Subsequent loads
 * see the stored ID and don't show the overlay.
 *
 * Tracking only enables once a kiosk is paired (see lib/analytics.ts), so
 * test devices and laptops simply never bring up this overlay (they bypass
 * via a "skip" button or close the tab). */
export function PairOverlay({
  initialId,
  onClose,
  forceShow,
}: {
  initialId: string | null
  onClose: () => void
  forceShow?: boolean
}) {
  const [show, setShow] = useState(forceShow || !initialId)
  const groups = kiosksByFloor()

  useEffect(() => {
    setShow(forceShow || !initialId)
  }, [forceShow, initialId])

  // Allow URL `?kiosk=<id>` to silently pair on initial load — bypasses the
  // overlay entirely if the value is in the KIOSKS list. Volunteer with a
  // typed/QR-coded URL doesn't even see this UI.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('kiosk')
    if (!fromUrl) return
    const stored = setKioskId(fromUrl)
    if (stored) {
      // strip the param from URL so it doesn't leak into bookmarked links
      params.delete('kiosk')
      const newSearch = params.toString()
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
      setShow(false)
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!show) return null

  function pick(id: string) {
    setKioskId(id)
    setShow(false)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-el-darker">
      <div className="flex-1 overflow-auto px-6 sm:px-10 py-10 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-el-light mb-2">
          Apparaat instellen
        </h1>
        <p className="text-el-light/70 mb-8">
          Kies de locatie van deze kiosk. Deze keuze wordt onthouden — je hoeft 'm
          maar één keer te maken.
        </p>

        {groups.map(({ floor, items }) => (
          <section key={floor} className="mb-6">
            <h2 className="text-xs uppercase tracking-wider font-bold text-el-light/40 mb-2">
              {floor}
            </h2>
            <div className="space-y-2">
              {items.map((k) => {
                const isCurrent = initialId === k.id
                return (
                  <button
                    key={k.id}
                    onClick={() => pick(k.id)}
                    className={`w-full text-left rounded-2xl px-5 py-4 transition-colors flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-el-blue/20 ring-1 ring-el-blue text-el-light'
                        : 'bg-el-gray text-el-light active:bg-el-gray-light'
                    }`}
                  >
                    <span className="font-bold text-base">{k.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide font-bold text-el-blue">
                        Huidig
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <div className="mt-8 pt-4 border-t border-el-gray text-center">
          <button
            onClick={() => {
              setShow(false)
              onClose()
            }}
            className="text-el-light/40 text-xs hover:text-el-light/70"
          >
            Niet pairen — alleen testen
          </button>
        </div>

        {initialId && !findKioskEntry(initialId) && (
          <p className="mt-4 text-center text-xs text-el-light/40">
            Huidig opgeslagen ID: <code>{initialId}</code> (niet in lijst)
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
