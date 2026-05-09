import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  downloadBidsCsv,
  fetchBids,
  type AuctionBidWithItem,
  type AuctionItemStatus,
} from '../lib/api'
import { useToast } from '../components/Toast'
import { AuctionDetailModal } from '../components/auctions/AuctionDetailModal'

type StatusFilter = AuctionItemStatus | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open auctions only' },
  { value: 'closed', label: 'Closed auctions only' },
]

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function fmtTs(ts: number): string {
  return dateFmt.format(new Date(ts))
}

function fmtAmount(cents: number): string {
  return eurFmt.format(cents / 100)
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

function StatusPill({ status }: { status: AuctionItemStatus }) {
  const cls =
    status === 'open'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status === 'open' ? 'Open' : 'Closed'}
    </span>
  )
}

export function AuctionsPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [itemIdFilter] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)

  // Debounce search input → server param.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const query = useQuery<AuctionBidWithItem[]>({
    queryKey: ['bids', statusFilter, debouncedSearch, itemIdFilter],
    queryFn: () =>
      fetchBids({
        status: statusFilter,
        q: debouncedSearch || undefined,
        itemId: itemIdFilter,
      }),
    staleTime: 10_000,
  })

  const rows = query.data || []

  const totals = useMemo(() => {
    let totalCents = 0
    for (const r of rows) totalCents += r.amount
    return { count: rows.length, totalEur: totalCents / 100 }
  }, [rows])

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  )

  const handleCsv = async () => {
    setCsvBusy(true)
    try {
      await downloadBidsCsv({
        status: statusFilter,
        q: debouncedSearch || undefined,
        itemId: itemIdFilter,
      })
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
          <h1 className="text-2xl font-bold text-secondary">Auctions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {query.isLoading
              ? 'Loading…'
              : `${totals.count} total bids · ${eurFmt.format(totals.totalEur)} total`}
          </p>
        </div>
        <button
          onClick={handleCsv}
          disabled={csvBusy || query.isLoading}
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
          placeholder="Search bidder, email, item…"
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Bidder</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
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
                      Loading bids…
                    </div>
                  </td>
                </tr>
              )}
              {!query.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    No bids yet.
                  </td>
                </tr>
              )}
              {rows.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className="cursor-pointer hover:bg-surface-alt/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {fmtTs(b.ts)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-secondary">
                    {truncate(b.itemName || '—', 40)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-secondary tabular-nums">
                    {fmtAmount(b.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {b.displayName || b.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.email ? (
                      <a
                        href={`mailto:${b.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {truncate(b.email, 28)}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.phone ? (
                      <a
                        href={`tel:${b.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {truncate(b.phone, 18)}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={b.itemAuctionStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedId(b.id)
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
      </div>

      <AuctionDetailModal
        bid={selected}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
