import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchBids, type AuctionBidWithItem } from '../../lib/api'

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function relativeTime(ts: number): string {
  const ageMs = Date.now() - ts
  if (ageMs < 0) return 'now'
  const sec = Math.floor(ageMs / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  return `${day}d`
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

export function RecentBidsBlock() {
  const query = useQuery<AuctionBidWithItem[]>({
    queryKey: ['bids', 'all', '', undefined],
    queryFn: () => fetchBids({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const top = (query.data ?? [])
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Recent bids {query.data && top.length > 0 && (
          <span className="text-gray-400">({top.length})</span>
        )}
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Error</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-gray-400">No bids yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-semibold text-secondary tabular-nums">
                  {eurFmt.format(b.amount / 100)}
                </span>
                <span className="text-gray-400">·</span>
                <span className="truncate text-gray-700">
                  {truncate(b.itemName || '—', 24)}
                </span>
                <span className="text-gray-400">·</span>
                <span className="truncate text-gray-500">
                  {b.displayName || b.name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {relativeTime(b.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end border-t border-border pt-3 text-xs">
        <Link to="/auctions" className="font-semibold text-primary hover:underline">
          Auctions →
        </Link>
      </div>
    </div>
  )
}
