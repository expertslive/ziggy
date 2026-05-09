import { useQuery } from '@tanstack/react-query'
import { fetchEasterEggs, type DashboardEasterEggs } from '../../lib/api'

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return '—'
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

export function EasterEggsBlock() {
  const query = useQuery<DashboardEasterEggs>({
    queryKey: ['dashboard-easter-eggs'],
    queryFn: () => fetchEasterEggs(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Easter eggs
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-red-600">Error</p>
      ) : (
        <>
          <p className="text-sm text-secondary">
            🕺 Rickrolls today:{' '}
            <span className="font-semibold">{query.data.rickrolls.today}</span>{' '}
            <span className="text-gray-400">·</span> total:{' '}
            <span className="font-semibold">{query.data.rickrolls.total}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {query.data.rickrolls.lastAt
              ? `last triggered ${relativeTime(query.data.rickrolls.lastAt)} ago`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Search &lsquo;42&rsquo; on a kiosk to trigger.
          </p>
        </>
      )}
    </div>
  )
}
