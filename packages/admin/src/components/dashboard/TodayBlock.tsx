import { useQuery } from '@tanstack/react-query'
import { fetchToday, type DashboardToday } from '../../lib/api'

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const numFmt = new Intl.NumberFormat('en-US')

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-secondary">{label}</span>
      <span className="shrink-0 text-right text-gray-700">{value}</span>
    </li>
  )
}

export function TodayBlock() {
  const query = useQuery<DashboardToday>({
    queryKey: ['dashboard-today'],
    queryFn: () => fetchToday(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Today
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-red-600">Error</p>
      ) : (
        <ul className="space-y-1.5">
          <Row
            label="Bids"
            value={
              <span>
                {query.data.bids.count}
                {query.data.bids.count > 0 && (
                  <span className="text-gray-400">
                    {' '}
                    ({eurFmt.format(query.data.bids.totalEur)})
                  </span>
                )}
              </span>
            }
          />
          <Row label="Nominations" value={query.data.nominations.count} />
          <Row label="Page views" value={numFmt.format(query.data.pageviews)} />
          <Row
            label="Active kiosks"
            value={`${query.data.activeKiosks.online}/${query.data.activeKiosks.total}`}
          />
          <Row
            label="Top page"
            value={
              query.data.topPage ? (
                <span className="inline-flex items-center gap-1">
                  <code className="rounded bg-surface-alt px-1 py-0.5 font-mono text-xs">
                    {query.data.topPage.path}
                  </code>
                  {query.data.topPage.views > 0 && <span>🔥</span>}
                </span>
              ) : (
                '—'
              )
            }
          />
        </ul>
      )}
    </div>
  )
}
