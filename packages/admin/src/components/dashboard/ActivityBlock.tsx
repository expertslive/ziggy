import { useQuery } from '@tanstack/react-query'
import { fetchRecentActivity, type AuditEntry } from '../../lib/api'

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

export function ActivityBlock() {
  const query = useQuery<AuditEntry[]>({
    queryKey: ['dashboard-activity'],
    queryFn: () => fetchRecentActivity(undefined, 20),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })

  const entries = query.data ?? []
  const last = entries[0]

  return (
    <details className="mt-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-secondary">
          <span aria-hidden>▸</span>
          Recent activity
          {last && (
            <span className="truncate text-xs font-normal text-gray-500">
              · last: {last.summary || `${last.action} ${last.target}`}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-gray-500">
          {last
            ? `${relativeTime(last.ts)} ago`
            : query.isLoading
              ? 'Loading…'
              : query.isError
                ? 'Error'
                : 'No activity'}
        </span>
      </summary>
      <div className="mt-3 border-t border-border pt-3">
        {query.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : query.isError ? (
          <p className="text-sm text-red-600">Error</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-gray-700">{e.actor}</span>
                    <span className="text-gray-400">·</span>
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                      {e.action}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-secondary">{e.target}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {relativeTime(e.ts)} ago
                  </span>
                </div>
                {e.summary && (
                  <div className="mt-0.5 text-xs text-gray-500">{e.summary}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
