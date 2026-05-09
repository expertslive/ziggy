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
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-secondary">🕺 Rickrolls</span>
        <span className="font-semibold text-secondary">
          {query.isLoading ? '…' : query.isError ? '—' : total}
        </span>
      </div>
    </div>
  )
}
