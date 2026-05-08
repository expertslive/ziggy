import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSponsors, fetchSponsorTiers, fetchShopItems, fetchFloorMaps } from '../lib/api'

interface Item {
  id: string
  label: string
  hint?: string
  to: string
}

const PAGES: Item[] = [
  { id: 'page:dashboard', label: 'Dashboard', to: '/' },
  { id: 'page:sponsors', label: 'Sponsors', to: '/sponsors' },
  { id: 'page:tiers', label: 'Sponsor tiers', to: '/tiers' },
  { id: 'page:shop', label: 'Shop items', to: '/shop-items' },
  { id: 'page:maps', label: 'Floor maps', to: '/floor-maps' },
  { id: 'page:images', label: 'Images', to: '/images' },
  { id: 'page:config', label: 'Event config', to: '/config' },
  { id: 'page:i18n', label: 'Translations', to: '/i18n' },
  { id: 'page:analytics', label: 'Analytics', to: '/analytics' },
  { id: 'page:snapshots', label: 'Snapshots', to: '/snapshots' },
  { id: 'page:trash', label: 'Trash', to: '/trash' },
  { id: 'page:users', label: 'Admins', to: '/users' },
  { id: 'page:profile', label: 'Profile', to: '/profile' },
]

/** Cmd+K / Ctrl+K palette: fuzzy-search pages and admin records, jump
 * to them. Mounted once at the App root. */
export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  // Toggle on Cmd/Ctrl + K, close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setActiveIdx(0)
        return
      }
      if (open && e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Lazy fetch records when palette opens for the first time
  const sponsors = useQuery({
    queryKey: ['sponsors'],
    queryFn: fetchSponsors,
    enabled: open,
  })
  const tiers = useQuery({
    queryKey: ['sponsor-tiers'],
    queryFn: fetchSponsorTiers,
    enabled: open,
  })
  const shop = useQuery({
    queryKey: ['shop-items'],
    queryFn: fetchShopItems,
    enabled: open,
  })
  const maps = useQuery({
    queryKey: ['floor-maps'],
    queryFn: fetchFloorMaps,
    enabled: open,
  })

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [...PAGES]
    for (const s of sponsors.data ?? []) {
      out.push({
        id: `sponsor:${s.id}`,
        label: `Sponsor: ${s.name}`,
        hint: s.boothNumber ? `Booth ${s.boothNumber}` : undefined,
        to: `/sponsors`,
      })
    }
    for (const t of tiers.data ?? []) {
      out.push({ id: `tier:${t.id}`, label: `Tier: ${t.name}`, to: '/tiers' })
    }
    for (const it of shop.data ?? []) {
      out.push({ id: `shop:${it.id}`, label: `Shop: ${it.name}`, to: '/shop-items' })
    }
    for (const m of maps.data ?? []) {
      out.push({
        id: `map:${m.id}`,
        label: `Floor map: ${m.name}`,
        hint: `${m.hotspots?.length ?? 0} hotspots`,
        to: `/floor-maps/${m.id}`,
      })
    }
    return out
  }, [sponsors.data, tiers.data, shop.data, maps.data])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 30)
    return items
      .filter((it) => it.label.toLowerCase().includes(q))
      .slice(0, 30)
  }, [items, q])

  useEffect(() => {
    setActiveIdx(0)
  }, [query, open])

  if (!open) return null

  function pick(it: Item) {
    setOpen(false)
    setQuery('')
    navigate(it.to)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIdx((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              const it = filtered[activeIdx]
              if (it) pick(it)
            }
          }}
          placeholder="Jump to anything…"
          className="w-full border-b border-border px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">No matches.</li>
          ) : (
            filtered.map((it, i) => (
              <li
                key={it.id}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm ${
                  i === activeIdx ? 'bg-primary/10' : 'hover:bg-surface-alt'
                }`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(it)}
              >
                <span className="text-secondary">{it.label}</span>
                {it.hint && (
                  <span className="ml-3 text-xs text-gray-400">{it.hint}</span>
                )}
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-border bg-surface-alt px-3 py-2 text-[11px] text-gray-500">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>⌘K toggles</span>
        </div>
      </div>
    </div>
  )
}
