import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchDashboardKiosks,
  type DashboardKiosk,
  type KioskStatus,
} from '../../lib/api'

const DOT_CLASS: Record<KioskStatus, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  stale: 'bg-gray-400',
  offline: 'bg-gray-300',
}

function relativeTime(ts: number | null): string {
  if (ts === null) return 'never'
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

export function KiosksBlock() {
  const query = useQuery<DashboardKiosk[]>({
    queryKey: ['dashboard-kiosks'],
    queryFn: fetchDashboardKiosks,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const rows = query.data ?? []
  const online = rows.filter((r) => r.status === 'online').length
  const total = rows.length

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Kiosks
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Error</p>
      ) : total === 0 ? (
        <p className="text-sm text-gray-400">No kiosks yet.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {rows.map((k) => (
              <li
                key={k.kioskId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[k.status]}`}
                    aria-label={k.status}
                  />
                  <span className="truncate text-secondary">{k.displayName}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {relativeTime(k.lastHeartbeatAt)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-gray-500">{online}/{total} online</span>
            <Link
              to="/kiosks"
              className="font-semibold text-primary hover:underline"
            >
              Manage kiosks →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
