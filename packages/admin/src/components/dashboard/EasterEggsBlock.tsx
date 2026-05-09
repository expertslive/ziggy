import { useQuery } from '@tanstack/react-query'
import { fetchEasterEggs, type DashboardEasterEggs } from '../../lib/api'

export function EasterEggsBlock() {
  const query = useQuery<DashboardEasterEggs>({
    queryKey: ['dashboard-easter-eggs'],
    queryFn: () => fetchEasterEggs(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const total = query.data?.rickrolls.total ?? 0

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Easter eggs
      </h2>
      <p className="text-sm text-secondary">
        🕺 Rickrolls:{' '}
        <span className="font-semibold">
          {query.isLoading ? '…' : query.isError ? '—' : total}
        </span>
      </p>
    </div>
  )
}
