import { useQuery } from '@tanstack/react-query'
import { fetchAnalyticsSummary, type AnalyticsSummary } from '../lib/api'
import { useFloorMaps } from '../lib/hooks'

const KIOSK_LABELS: Record<string, string> = {
  'kiosk-registratie': 'Registratiebalie',
  'kiosk-trap-gh': 'Trap naast Grand Hall',
  'kiosk-trap-e2': 'Trap naar Entresol 2',
  'kiosk-merch': 'Bij Merch stand',
  'kiosk-entresol-1': 'Entresol 1',
  'kiosk-entresol-2': 'Entresol 2',
  'kiosk-lounge-1': 'Lounge — A',
  'kiosk-lounge-2': 'Lounge — B',
}

const HEARTBEAT_ACTIVE_MS = 3 * 60_000

function formatLastSeen(now: number, ts: number | undefined): string {
  if (!ts) return 'never'
  const diff = now - ts
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / (60 * 60_000))}h ago`
}

export function AnalyticsPage() {
  const q = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: fetchAnalyticsSummary,
    refetchInterval: 30_000,
  })
  const fm = useFloorMaps()

  const allKioskIds = Object.keys(KIOSK_LABELS)
  const data = q.data
  const now = data?.now ?? Date.now()

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live event metrics — auto-refresh every 30s
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {q.isFetching ? 'refreshing…' : data ? `updated ${formatLastSeen(Date.now(), now)}` : ''}
        </div>
      </div>

      {q.isError && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load analytics. Make sure the API is running and you are signed in.
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Events last hour</p>
          <p className="mt-1 text-4xl font-bold text-secondary">
            {data ? data.totalLastHour : '-'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            All event types — taps, opens, searches, heartbeats…
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Active kiosks</p>
          <p className="mt-1 text-4xl font-bold text-secondary">
            {data
              ? `${
                  Object.values(data.lastHeartbeats || {}).filter(
                    (ts) => now - ts < HEARTBEAT_ACTIVE_MS,
                  ).length
                } / ${allKioskIds.length}`
              : '-'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Heartbeat within last 3 min</p>
        </div>
      </div>

      {/* Per-kiosk breakdown */}
      <div className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-secondary">Kiosks</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-alt">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Kiosk</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Events / h</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Last heartbeat</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {allKioskIds.map((id) => {
                const eventCount = data?.perKiosk.find((p) => p.kioskId === id)?.count ?? 0
                const ts = data?.lastHeartbeats?.[id]
                const isActive = ts ? now - ts < HEARTBEAT_ACTIVE_MS : false
                return (
                  <tr key={id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-secondary">{KIOSK_LABELS[id] || id}</div>
                      <div className="text-xs text-gray-400">{id}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{eventCount}</td>
                    <td className="px-4 py-2 text-gray-700">{formatLastSeen(now, ts)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {isActive ? 'Online' : 'Offline'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top sessions + no-result searches */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Top sessions opened (24h)</h2>
          {!data || data.topSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.topSessions.map((s) => (
                <li key={s.sessionId} className="flex items-center justify-between">
                  <span className="text-gray-700">Session #{s.sessionId}</span>
                  <span className="font-mono font-bold text-secondary">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Cross-reference IDs with the agenda to find titles.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">No-result searches (24h)</h2>
          {!data || data.searchNoResults.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.searchNoResults.map((s) => (
                <li key={s.len} className="flex items-center justify-between">
                  <span className="text-gray-700">Length {s.len} chars</span>
                  <span className="font-mono font-bold text-secondary">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Query text is not stored (privacy) — only length is logged.
          </p>
        </div>
      </div>

      {/* Tiny footer: floor maps loaded — confirms admin API is healthy */}
      {fm.isError && (
        <div className="mt-6 text-xs text-amber-600">
          Note: floor map fetch failed — API health may be degraded.
        </div>
      )}
    </div>
  )
}
