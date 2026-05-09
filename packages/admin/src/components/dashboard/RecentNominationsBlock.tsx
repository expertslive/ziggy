import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Nomination, NominationStatus } from '@ziggy/shared'
import { fetchNominations } from '../../lib/api'

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
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

function StatusPill({ status }: { status: NominationStatus }) {
  const cls =
    status === 'verified'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800'
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  )
}

export function RecentNominationsBlock() {
  const query = useQuery<Nomination[]>({
    queryKey: ['nominations', 'all', ''],
    queryFn: () => fetchNominations({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const top = (query.data ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Recent nominations {query.data && top.length > 0 && (
          <span className="text-gray-400">({top.length})</span>
        )}
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Error</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-gray-400">No nominations yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((n) => (
            <li
              key={n.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <StatusPill status={n.status} />
                <span className="text-gray-400">·</span>
                <span className="truncate text-gray-700">
                  for <span className="text-secondary">{n.nomineeName}</span>
                </span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {relativeTime(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end border-t border-border pt-3 text-xs">
        <Link
          to="/nominations"
          className="font-semibold text-primary hover:underline"
        >
          Nominations →
        </Link>
      </div>
    </div>
  )
}
