import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchActionItems, type DashboardActionItems } from '../../lib/api'

const LABELS: Record<keyof DashboardActionItems, string> = {
  pendingNominations: 'Pending nominations',
  sponsorsNoLogo: 'Sponsors with logo',
  shopItemsNoImage: 'Shop items with image',
  sessionsNoRoom: 'Sessions assigned to rooms',
  hotspotsEmpty: 'Floor map hotspots complete',
}

export function ReadinessBlock() {
  const query = useQuery<DashboardActionItems>({
    queryKey: ['dashboard-action-items'],
    queryFn: () => fetchActionItems(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const keys = Object.keys(LABELS) as (keyof DashboardActionItems)[]
  const data = query.data
  const okCount = data ? keys.filter((k) => data[k].count === 0).length : 0
  const total = keys.length
  const overall = data
    ? okCount === total
      ? '🟢'
      : '🟠'
    : '⚪'

  return (
    <details className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-secondary">
          <span aria-hidden>▸</span>
          Event readiness
          <span aria-hidden>{overall}</span>
        </span>
        <span className="text-xs text-gray-500">
          {data ? `(${okCount}/${total} OK)` : query.isLoading ? 'Loading…' : 'Error'}
        </span>
      </summary>
      <div className="mt-3 border-t border-border pt-3">
        {query.isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : query.isError || !data ? (
          <p className="text-sm text-red-600">Error</p>
        ) : (
          <ul className="space-y-1.5">
            {keys.map((k) => {
              const item = data[k]
              const ok = item.count === 0
              return (
                <li
                  key={k}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{ok ? '✅' : '⚠'}</span>
                    <span className="text-secondary">{LABELS[k]}</span>
                    {!ok && (
                      <span className="text-xs text-gray-500">
                        ({item.count} to fix)
                      </span>
                    )}
                  </span>
                  {!ok && (
                    <Link
                      to={item.link}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Fix →
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </details>
  )
}
