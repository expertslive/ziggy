import { useQuery } from '@tanstack/react-query'
import { fetchHealth, type DashboardHealth } from '../../lib/api'

function fmtCacheAge(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  return `${min}m`
}

function fmtRelativeIso(iso: string | null): string {
  if (!iso) return '—'
  const ageMs = Date.now() - new Date(iso).getTime()
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

function StatusIcon({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={ok ? 'text-green-600' : 'text-red-600'}
        aria-label={ok ? 'ok' : 'fail'}
      >
        {ok ? '✓' : '✗'}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-secondary">{label}</span>
      <span className="shrink-0 text-right">{value}</span>
    </li>
  )
}

export function HealthBlock() {
  const query = useQuery<DashboardHealth>({
    queryKey: ['dashboard-health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Health
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-red-600">Error</p>
      ) : (
        <ul className="space-y-1.5">
          <Row
            label="run.events"
            value={
              <StatusIcon
                ok={query.data.runEvents.ok}
                label={query.data.runEvents.ok ? 'ok' : 'stale'}
              />
            }
          />
          <Row
            label="Cosmos"
            value={
              <StatusIcon
                ok={query.data.cosmos.ok}
                label={query.data.cosmos.ok ? 'ok' : 'down'}
              />
            }
          />
          <Row
            label="Storage"
            value={
              <StatusIcon
                ok={query.data.storage.ok}
                label={query.data.storage.ok ? 'ok' : 'down'}
              />
            }
          />
          <Row
            label="Cache age"
            value={<span className="text-sm text-gray-700">{fmtCacheAge(query.data.cacheAgeSec)}</span>}
          />
          <Row
            label="Last backup"
            value={<span className="text-sm text-gray-700">{fmtRelativeIso(query.data.lastBackupAt)}</span>}
          />
          <Row
            label="Errors (24h)"
            value={
              <span
                className={`text-sm font-semibold ${
                  query.data.errors24h > 0 ? 'text-red-600' : 'text-gray-700'
                }`}
              >
                {query.data.errors24h}
              </span>
            }
          />
        </ul>
      )}
    </div>
  )
}
