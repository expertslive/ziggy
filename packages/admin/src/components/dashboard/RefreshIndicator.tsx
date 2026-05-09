import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDashboardKiosks } from '../../lib/api'

const DASHBOARD_QUERY_KEYS: (string | unknown)[][] = [
  ['dashboard-kiosks'],
  ['dashboard-health'],
  ['dashboard-today'],
  ['dashboard-action-items'],
  ['dashboard-activity'],
  ['bids', 'all', '', undefined],
  ['nominations', 'all', ''],
]

function fmtAge(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return 'just now'
  const sec = Math.floor(ms / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

export function RefreshIndicator() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['dashboard-kiosks'],
    queryFn: fetchDashboardKiosks,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const [, setTick] = useState(0)

  useEffect(() => {
    const handle = window.setInterval(() => setTick((t) => t + 1), 5000)
    return () => window.clearInterval(handle)
  }, [])

  const updatedAt = query.dataUpdatedAt
  const ageMs = updatedAt ? Date.now() - updatedAt : 0
  const fetching = query.isFetching

  const handleRefresh = () => {
    for (const key of DASHBOARD_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: key })
    }
  }

  const title = updatedAt
    ? `Last updated ${new Date(updatedAt).toLocaleString('nl-NL')}`
    : 'Not yet updated'

  return (
    <button
      type="button"
      onClick={handleRefresh}
      title={title}
      className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs text-gray-500 hover:border-border hover:bg-surface-alt"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          fetching ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
        }`}
        aria-hidden
      />
      <span>{updatedAt ? `updated ${fmtAge(ageMs)}` : 'updating…'}</span>
    </button>
  )
}
