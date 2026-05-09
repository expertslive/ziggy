import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchActionItems, type DashboardActionItems } from '../../lib/api'

const LABELS: Record<keyof DashboardActionItems, string> = {
  pendingNominations: 'pending nominations',
  sponsorsNoLogo: 'sponsors without logo',
  shopItemsNoImage: 'shop items without image',
  sessionsNoRoom: 'sessions without room',
  hotspotsEmpty: 'empty hotspots',
}

export function ActionItemsBlock() {
  const navigate = useNavigate()
  const query = useQuery<DashboardActionItems>({
    queryKey: ['dashboard-action-items'],
    queryFn: () => fetchActionItems(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const items = query.data
    ? (Object.keys(LABELS) as (keyof DashboardActionItems)[])
        .map((key) => ({ key, ...query.data![key] }))
        .filter((i) => i.count > 0)
    : []

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Action items {query.data && items.length > 0 && (
          <span className="text-gray-400">({items.length})</span>
        )}
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-red-600">Error</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">✓ All clear</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.key}>
              <button
                type="button"
                onClick={() => navigate(i.link)}
                className="flex w-full items-center justify-between gap-2 rounded text-left text-sm hover:bg-surface-alt"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-amber-500" aria-hidden>⚠</span>
                  <span className="text-secondary">
                    <span className="font-semibold">{i.count}</span>{' '}
                    <span className="text-gray-600">{LABELS[i.key]}</span>
                  </span>
                </span>
                <span className="shrink-0 text-gray-400">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
