import { useQuery } from '@tanstack/react-query'
import {
  fetchAnalyticsSummary,
  fetchHourly,
  fetchHotspotHeatmap,
  fetchSearchFunnel,
  fetchLanguageSplit,
  type AnalyticsSummary,
  type HourlyResponse,
  type HotspotTap,
  type SearchFunnel,
  type LangSplit,
} from '../lib/api'
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
  const hourlyQ = useQuery<HourlyResponse>({
    queryKey: ['analytics-hourly'],
    queryFn: () => fetchHourly(24),
    refetchInterval: 60_000,
  })
  const heatmapQ = useQuery<{ since: number; taps: HotspotTap[] }>({
    queryKey: ['analytics-heatmap'],
    queryFn: fetchHotspotHeatmap,
    refetchInterval: 60_000,
  })
  const funnelQ = useQuery<SearchFunnel>({
    queryKey: ['analytics-funnel'],
    queryFn: fetchSearchFunnel,
    refetchInterval: 60_000,
  })
  const langQ = useQuery<LangSplit>({
    queryKey: ['analytics-lang'],
    queryFn: fetchLanguageSplit,
    refetchInterval: 60_000,
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

      {/* Hourly chart */}
      <div className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-secondary">Events per hour (last 24h)</h2>
        <HourlyBars data={hourlyQ.data} />
      </div>

      {/* Top sessions + no-result searches + search funnel + lang split */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Top sessions opened (24h)</h2>
          {!data || data.topSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.topSessions.map((s) => (
                <li key={s.sessionId} className="flex items-start justify-between gap-3">
                  <span className="text-gray-700 truncate">
                    {s.title || (
                      <span className="text-gray-400">Session #{s.sessionId}</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-secondary">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Search funnel (24h)</h2>
          <SearchFunnelView data={funnelQ.data} />
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

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-secondary">Language switches (24h)</h2>
          {!langQ.data || langQ.data.langs.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {langQ.data.langs.map((l) => (
                <li key={l.lang} className="flex items-center justify-between">
                  <span className="font-mono text-gray-700">{l.lang.toUpperCase()}</span>
                  <span className="font-mono font-bold text-secondary">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Hotspot heatmap */}
      <div className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-secondary">Top hotspot taps (24h)</h2>
        {!heatmapQ.data || heatmapQ.data.taps.length === 0 ? (
          <p className="text-sm text-gray-400">No taps yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {heatmapQ.data.taps.slice(0, 12).map((t) => {
              const max = heatmapQ.data!.taps[0].count
              const pct = max ? Math.round((t.count / max) * 100) : 0
              return (
                <li
                  key={t.hotspotId}
                  className="flex items-center gap-2 text-gray-700"
                >
                  <span className="w-32 truncate">
                    {t.roomName || (
                      <span className="text-gray-400">{t.hotspotId.slice(0, 8)}</span>
                    )}
                  </span>
                  <span className="relative flex-1 h-3 rounded bg-gray-100">
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-primary/60"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-mono text-xs">{t.count}</span>
                </li>
              )
            })}
          </ul>
        )}
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

function HourlyBars({ data }: { data?: HourlyResponse }) {
  if (!data || data.series.length === 0) {
    return <p className="text-sm text-gray-400">No data yet.</p>
  }
  const max = Math.max(...data.series.map((s) => s.events), 1)
  return (
    <div className="flex items-end gap-1 h-40 overflow-x-auto">
      {data.series.map((s) => {
        const h = s.bucket.split('T')[1] || '?'
        const day = s.bucket.split('T')[0] || ''
        const eventsPct = (s.events / max) * 100
        return (
          <div
            key={s.bucket}
            className="flex flex-col items-center min-w-[18px]"
            title={`${day} ${h}:00 — ${s.events} events (${s.pageviews} pageviews)`}
          >
            <div className="flex h-32 w-full flex-col justify-end">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${eventsPct}%` }}
              />
            </div>
            <span className="mt-1 text-[10px] text-gray-400">{h}</span>
          </div>
        )
      })}
    </div>
  )
}

function SearchFunnelView({ data }: { data?: SearchFunnel }) {
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>
  if (data.searches === 0) {
    return <p className="text-sm text-gray-400">No searches yet.</p>
  }
  const noResultPct = Math.round((data.noResults / data.searches) * 100)
  const tapPct = Math.round((data.resultTaps / data.searches) * 100)
  return (
    <div className="space-y-3 text-sm">
      <Stat label="Searches" value={data.searches} />
      <Stat
        label="No-result"
        value={data.noResults}
        suffix={`(${noResultPct}%)`}
        tone="warn"
      />
      <Stat
        label="Result tapped"
        value={data.resultTaps}
        suffix={`(${tapPct}%)`}
        tone="good"
      />
      <p className="text-xs text-gray-400">
        Higher tap-rate is better. High no-result-rate suggests the agenda or
        place corpus is missing what people search for.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string
  value: number
  suffix?: string
  tone?: 'good' | 'warn'
}) {
  const valueClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
      ? 'text-amber-700'
      : 'text-secondary'
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`text-xl font-bold ${valueClass}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span>}
      </span>
    </div>
  )
}
