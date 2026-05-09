import { useEffect, useRef, useState } from 'react'

/** Live kiosk preview — embeds the public kiosk in an iframe. The iframe
 *  is rendered at the device's actual viewport size (so the kiosk SPA
 *  thinks it's running at native resolution), then CSS-scaled to fit
 *  the admin layout. That way 1080×1920 stays 9:16 visually too. */

const KIOSK_BASE =
  (import.meta.env.VITE_KIOSK_URL as string | undefined) ||
  'https://ziggy.expertslive.dev'

const PAGES: { path: string; label: string }[] = [
  { path: '/now', label: 'Now' },
  { path: '/agenda', label: 'Agenda' },
  { path: '/map', label: 'Map' },
  { path: '/sponsors', label: 'Sponsors' },
  { path: '/shop', label: 'Shop' },
  { path: '/info', label: 'Info' },
  { path: '/search', label: 'Search' },
  { path: '/speakers', label: 'Speakers' },
]

/** Native device viewports. The iframe renders at these exact px so
 *  the kiosk SPA's responsive logic behaves the same as in the field. */
const DEVICES = {
  kiosk: { w: 1920, h: 1080, label: 'Kiosk · 1920×1080 (16:9)' },
  'ipad-portrait': { w: 768, h: 1024, label: 'iPad portrait · 768×1024 (3:4)' },
  'ipad-landscape': { w: 1024, h: 768, label: 'iPad landscape · 1024×768 (4:3)' },
  iphone: { w: 390, h: 844, label: 'iPhone · 390×844' },
} as const

type DeviceKey = keyof typeof DEVICES

/** Visual height cap — width is measured at runtime from the surrounding
 *  card so the preview always fits the admin layout regardless of how
 *  wide the user's window is. */
const MAX_DISPLAY_HEIGHT = 720

const DEVICE_BUTTON_LABELS: Record<DeviceKey, string> = {
  kiosk: 'Kiosk',
  'ipad-portrait': 'iPad portrait',
  'ipad-landscape': 'iPad landscape',
  iphone: 'iPhone',
}

export function PreviewPage() {
  const [active, setActive] = useState('/now')
  const [iframeKey, setIframeKey] = useState(0)
  const [device, setDevice] = useState<DeviceKey>('kiosk')

  // Measure the available width inside the surrounding card so the kiosk
  // preview never spills past the right edge regardless of the user's
  // window size. Falls back to the device's native width on first paint.
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState<number>(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerW(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dims = DEVICES[device]
  const widthCap = containerW > 0 ? containerW : dims.w
  const scale = Math.min(MAX_DISPLAY_HEIGHT / dims.h, widthCap / dims.w, 1)
  const displayW = Math.round(dims.w * scale)
  const displayH = Math.round(dims.h * scale)

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Kiosk preview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Iframe rendered at native device resolution and scaled down — what
            you see is what attendees see.
          </p>
        </div>
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          ↻ Reload
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PAGES.map((p) => (
          <button
            key={p.path}
            onClick={() => setActive(p.path)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              active === p.path
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 ring-1 ring-border hover:bg-surface-alt'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(Object.keys(DEVICES) as DeviceKey[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                device === d
                  ? 'bg-secondary text-white'
                  : 'bg-white text-gray-600 ring-1 ring-border'
              }`}
            >
              {DEVICE_BUTTON_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex justify-center rounded-xl border border-border bg-gray-100 p-6 shadow-inner"
      >
        {/* Outer wrapper takes the *display* size — so layout reserves only
         *  the space the scaled iframe actually occupies. */}
        <div
          className="relative overflow-hidden rounded-lg border-4 border-gray-800 bg-black shadow-lg"
          style={{ width: displayW, height: displayH }}
        >
          <iframe
            key={`${active}-${iframeKey}-${device}`}
            src={`${KIOSK_BASE}${active}?adminPreview=1`}
            title={`Kiosk preview ${active}`}
            style={{
              width: dims.w,
              height: dims.h,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: 0,
              display: 'block',
            }}
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">
        {dims.label} · scaled to {Math.round(scale * 100)}% ·{' '}
        <span className="font-mono">
          {KIOSK_BASE}
          {active}
        </span>
      </p>
    </div>
  )
}
