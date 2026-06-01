import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboardKiosks,
  type DashboardKiosk,
  type KioskStatus,
} from '../lib/api'
import { useToast } from '../components/Toast'
import { KioskEditModal } from '../components/kiosks/KioskEditModal'

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; kiosk: DashboardKiosk | null }
  | { open: true; mode: 'edit'; kiosk: DashboardKiosk }

const STATUS_META: Record<
  KioskStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  online: { label: 'online', dotClass: 'bg-green-500', textClass: 'text-green-700' },
  idle: { label: 'idle', dotClass: 'bg-yellow-500', textClass: 'text-yellow-700' },
  stale: { label: 'stale', dotClass: 'bg-gray-400', textClass: 'text-gray-600' },
  offline: { label: 'offline', dotClass: 'bg-red-500', textClass: 'text-red-700' },
}

function relativeTime(ts: number | null): string {
  if (ts === null) return 'never'
  const ageMs = Date.now() - ts
  if (ageMs < 0) return 'just now'
  const sec = Math.floor(ageMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function StatusDot({ status }: { status: KioskStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dotClass}`}
        aria-label={meta.label}
      />
      <span className={`text-xs font-medium ${meta.textClass}`}>{meta.label}</span>
    </span>
  )
}

export function KiosksPage() {
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedSearch(searchInput.trim().toLowerCase()),
      250,
    )
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const query = useQuery<DashboardKiosk[]>({
    queryKey: ['dashboard-kiosks'],
    queryFn: fetchDashboardKiosks,
    staleTime: 10_000,
  })

  const rows = query.data || []

  const counts = useMemo(() => {
    let aliased = 0
    for (const r of rows) {
      // An aliased row is one where the dashboard chose a custom displayName
      // instead of falling back to kioskId.
      if (r.displayName && r.displayName !== r.kioskId) aliased++
    }
    return { aliased, total: rows.length }
  }, [rows])

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows
    const q = debouncedSearch
    return rows.filter((r) => {
      const haystack = [
        r.displayName,
        r.kioskId,
        r.location ?? '',
        r.shortCode ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, debouncedSearch])

  const copyKioskId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      toast('success', 'Kiosk ID copied')
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      toast('error', 'Copy failed')
    }
  }

  const openCreate = (preset?: DashboardKiosk) => {
    setModal({ open: true, mode: 'create', kiosk: preset ?? null })
  }
  const openEdit = (k: DashboardKiosk) => {
    setModal({ open: true, mode: 'edit', kiosk: k })
  }
  const closeModal = () => setModal({ open: false })

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Kiosks</h1>
            <p className="mt-1 text-sm text-gray-500">
              {query.isLoading
                ? 'Loading…'
                : `${counts.aliased} aliased · ${counts.total} total seen`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Add alias
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, ID, location, code…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-72"
        />
        <Legend />
        {query.isFetching && !query.isLoading && (
          <span className="text-xs text-gray-400">Refreshing…</span>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {query.isLoading && (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            Loading kiosks…
          </div>
        )}
        {!query.isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            {rows.length === 0
              ? "No kiosks yet — they'll appear here once they heartbeat in or you add an alias manually."
              : 'No kiosks match your search.'}
          </div>
        )}
        <ul className="space-y-3">
          {filtered.map((k) => {
            const aliased = k.displayName !== k.kioskId
            return (
              <li
                key={k.kioskId}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {aliased ? (
                      <div className="text-sm font-semibold text-secondary">
                        {k.displayName}
                      </div>
                    ) : (
                      <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-500">
                        {k.kioskId}
                      </code>
                    )}
                    {k.location && (
                      <div className="mt-1 text-xs text-gray-500">{k.location}</div>
                    )}
                  </div>
                  <StatusDot status={k.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {k.shortCode && (
                    <span className="inline-flex rounded-full bg-surface-alt px-2 py-0.5 font-mono text-xs font-semibold uppercase text-gray-700">
                      {k.shortCode}
                    </span>
                  )}
                  {aliased && (
                    <code className="font-mono text-xs text-gray-400">{k.kioskId}</code>
                  )}
                  <span className="ml-auto">{relativeTime(k.lastHeartbeatAt)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => (aliased ? openEdit(k) : openCreate(k))}
                    className="min-h-11 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-surface-alt"
                  >
                    {aliased ? 'Edit' : 'Add alias'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyKioskId(k.kioskId)}
                    className="min-h-11 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-surface-alt"
                  >
                    {copiedId === k.kioskId ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Short code</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Kiosk ID</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading kiosks…
                    </div>
                  </td>
                </tr>
              )}
              {!query.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    {rows.length === 0
                      ? "No kiosks yet — they'll appear here once they heartbeat in or you add an alias manually."
                      : 'No kiosks match your search.'}
                  </td>
                </tr>
              )}
              {filtered.map((k) => {
                const aliased = k.displayName !== k.kioskId
                return (
                  <tr key={k.kioskId} className="hover:bg-surface-alt/60">
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusDot status={k.status} />
                    </td>
                    <td className="px-4 py-3">
                      {aliased ? (
                        <span className="text-sm font-medium text-secondary">
                          {k.displayName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-500">
                            {k.kioskId}
                          </code>
                          <button
                            type="button"
                            onClick={() => openCreate(k)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            label me
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {k.shortCode ? (
                        <span className="inline-flex rounded-full bg-surface-alt px-2 py-0.5 font-mono text-xs font-semibold uppercase text-gray-700">
                          {k.shortCode}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {k.location ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => copyKioskId(k.kioskId)}
                        title="Click to copy"
                        className="rounded font-mono text-xs text-gray-500 hover:bg-surface-alt hover:text-gray-700"
                      >
                        {copiedId === k.kioskId ? 'Copied!' : k.kioskId}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {relativeTime(k.lastHeartbeatAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => (aliased ? openEdit(k) : openCreate(k))}
                          className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-surface-alt"
                        >
                          {aliased ? 'Edit' : 'Add'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <KioskEditModal
        open={modal.open}
        mode={modal.open ? modal.mode : 'create'}
        kiosk={modal.open ? modal.kiosk : null}
        onClose={closeModal}
      />
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      {(['online', 'idle', 'stale', 'offline'] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${STATUS_META[s].dotClass}`} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  )
}
