import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Nomination, NominationStatus } from '@ziggy/shared'
import { downloadNominationsCsv, fetchNominations } from '../lib/api'
import { useToast } from '../components/Toast'
import { NominationDetailModal } from '../components/nominations/NominationDetailModal'

type StatusFilter = NominationStatus | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
]

function fmtCreated(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusPill({ status }: { status: NominationStatus }) {
  const cls =
    status === 'verified'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800'
  const label = status[0].toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

export function NominationsPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)

  // Debounce search input → server param.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const query = useQuery<Nomination[]>({
    queryKey: ['nominations', statusFilter, debouncedSearch],
    queryFn: () =>
      fetchNominations({
        status: statusFilter,
        q: debouncedSearch || undefined,
      }),
    staleTime: 10_000,
  })

  const rows = query.data || []
  const counts = useMemo(() => {
    let pending = 0
    let verified = 0
    let rejected = 0
    for (const r of rows) {
      if (r.status === 'pending') pending++
      else if (r.status === 'verified') verified++
      else if (r.status === 'rejected') rejected++
    }
    return { total: rows.length, pending, verified, rejected }
  }, [rows])

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  )

  const handleCsv = async () => {
    setCsvBusy(true)
    try {
      await downloadNominationsCsv()
    } catch {
      toast('error', 'CSV export failed')
    } finally {
      setCsvBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Nominations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {query.isLoading
              ? 'Loading…'
              : `${counts.total} total · ${counts.pending} pending · ${counts.verified} verified · ${counts.rejected} rejected`}
          </p>
        </div>
        <button
          onClick={handleCsv}
          disabled={csvBusy}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-surface-alt disabled:opacity-40"
        >
          {csvBusy ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search nominee, nominator, reason…"
          className="w-72 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {query.isFetching && !query.isLoading && (
          <span className="text-xs text-gray-400">Refreshing…</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Nominee</th>
              <th className="px-4 py-3">Nominator</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 text-center">Consent</th>
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
                    Loading nominations…
                  </div>
                </td>
              </tr>
            )}
            {!query.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  No nominations yet.
                </td>
              </tr>
            )}
            {rows.map((n) => (
              <tr
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className="cursor-pointer hover:bg-surface-alt/60"
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                  {fmtCreated(n.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={n.status} />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-secondary">
                  {n.nomineeName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{n.nominatorName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {truncate(n.reason, 80)}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {n.consentToShareNomineeName ? (
                    <span
                      title="Consent given"
                      className="font-bold text-green-600"
                      aria-label="Consent given"
                    >
                      ✓
                    </span>
                  ) : (
                    <span className="text-gray-300" aria-label="No consent">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(n.id)
                    }}
                    className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-surface-alt"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NominationDetailModal
        nomination={selected}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
