import { useState } from 'react'

/** Live kiosk preview — embeds the public kiosk in an iframe so admins
 *  can see what attendees see while editing. */

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

const DEVICES = {
  kiosk: { w: 540, h: 960, label: 'Kiosk (1080×1920 @ 50%)' },
  tablet: { w: 600, h: 800, label: 'Tablet portrait' },
  phone: { w: 375, h: 700, label: 'Phone' },
} as const

export function PreviewPage() {
  const [active, setActive] = useState('/now')
  const [iframeKey, setIframeKey] = useState(0)
  const [device, setDevice] = useState<keyof typeof DEVICES>('kiosk')
  const dims = DEVICES[device]

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Kiosk preview</h1>
          <p className="mt-1 text-sm text-gray-500">
            See what attendees see — useful for verifying admin changes
            without walking to a kiosk.
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
        <div className="ml-auto flex items-center gap-2">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                device === d
                  ? 'bg-secondary text-white'
                  : 'bg-white text-gray-600 ring-1 ring-border'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center rounded-xl border border-border bg-gray-100 p-6 shadow-inner">
        <iframe
          key={`${active}-${iframeKey}-${device}`}
          src={`${KIOSK_BASE}${active}?adminPreview=1`}
          title={`Kiosk preview ${active}`}
          className="rounded-lg border-4 border-gray-800 bg-black shadow-lg"
          style={{ width: dims.w, height: dims.h, border: 0 }}
        />
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">
        {dims.label} · <span className="font-mono">{KIOSK_BASE}{active}</span>
      </p>
    </div>
  )
}
