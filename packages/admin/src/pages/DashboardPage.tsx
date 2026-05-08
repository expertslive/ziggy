import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchAnalyticsSummary,
  fetchAuditLog,
  fetchCacheStatus,
  fetchReadiness,
  fetchSnapshots,
  takeSnapshot,
  refreshCache,
  type AnalyticsSummary,
  type AuditEntry,
  type CacheStatusEntry,
  type ReadinessCheck,
  type SnapshotMeta,
} from '../lib/api'
import { useToast } from '../components/Toast'

const KIOSK_LABELS: Record<string, string> = {
  'kiosk-registratie': 'Reg',
  'kiosk-trap-gh': 'Trap GH',
  'kiosk-trap-e2': 'Trap E2',
  'kiosk-merch': 'Merch',
  'kiosk-entresol-1': 'Entresol 1',
  'kiosk-entresol-2': 'Entresol 2',
  'kiosk-lounge-1': 'Lounge A',
  'kiosk-lounge-2': 'Lounge B',
}
const KIOSK_IDS = Object.keys(KIOSK_LABELS)
const HEARTBEAT_ACTIVE_MS = 3 * 60_000

function fmtAgo(now: number, ts: number | undefined) {
  if (!ts) return 'never'
  const d = now - ts
  if (d < 60_000) return `${Math.round(d / 1000)}s`
  if (d < 60 * 60_000) return `${Math.round(d / 60_000)}m`
  if (d < 24 * 60 * 60_000) return `${Math.round(d / 3600_000)}h`
  return `${Math.round(d / 86_400_000)}d`
}

function fmtAbs(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-NL', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DashboardPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const summary = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: fetchAnalyticsSummary,
    refetchInterval: 30_000,
  })
  const audit = useQuery<AuditEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => fetchAuditLog(20),
    refetchInterval: 60_000,
  })
  const cacheQ = useQuery<{ now: number; entries: CacheStatusEntry[] }>({
    queryKey: ['cache-status'],
    queryFn: fetchCacheStatus,
    refetchInterval: 30_000,
  })
  const readiness = useQuery<{ checks: ReadinessCheck[]; i18nOverrideCount: number }>({
    queryKey: ['readiness'],
    queryFn: fetchReadiness,
    refetchInterval: 5 * 60_000,
  })
  const snapshots = useQuery<SnapshotMeta[]>({
    queryKey: ['snapshots'],
    queryFn: fetchSnapshots,
    refetchInterval: 5 * 60_000,
  })

  const refreshMut = useMutation({
    mutationFn: refreshCache,
    onSuccess: () => {
      toast('success', 'Cache cleared')
      qc.invalidateQueries({ queryKey: ['cache-status'] })
    },
    onError: () => toast('error', 'Refresh failed'),
  })
  const snapMut = useMutation({
    mutationFn: () => takeSnapshot('manual-from-dashboard'),
    onSuccess: () => {
      toast('success', 'Snapshot taken')
      qc.invalidateQueries({ queryKey: ['snapshots'] })
    },
    onError: () => toast('error', 'Snapshot failed'),
  })

  const now = summary.data?.now ?? Date.now()
  const onlineKiosks = KIOSK_IDS.filter((id) => {
    const ts = summary.data?.lastHeartbeats?.[id]
    return ts && now - ts < HEARTBEAT_ACTIVE_MS
  })
  const lastSnapshot = snapshots.data?.[0]
  const failedChecks = readiness.data?.checks.filter((c) => c.status === 'fail') ?? []
  const warnChecks = readiness.data?.checks.filter((c) => c.status === 'warn') ?? []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live operational view — auto-refreshes.
        </p>
      </div>

      {/* Top stat row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Events / hour"
          value={summary.data ? String(summary.data.totalLastHour) : '—'}
        />
        <StatTile
          label="Kiosks online"
          value={
            summary.data
              ? `${onlineKiosks.length} / ${KIOSK_IDS.length}`
              : '—'
          }
        />
        <StatTile
          label="Readiness blockers"
          value={
            readiness.data
              ? `${failedChecks.length} fail · ${warnChecks.length} warn`
              : '—'
          }
          tone={
            failedChecks.length > 0
              ? 'bad'
              : warnChecks.length > 0
              ? 'warn'
              : 'good'
          }
        />
        <StatTile
          label="Last backup"
          value={
            lastSnapshot
              ? fmtAgo(Date.now(), new Date(lastSnapshot.capturedAt).getTime())
              : 'never'
          }
        />
      </div>

      {/* Kiosk grid */}
      <Card title="Kiosks">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KIOSK_IDS.map((id) => {
            const ts = summary.data?.lastHeartbeats?.[id]
            const isOnline = ts ? now - ts < HEARTBEAT_ACTIVE_MS : false
            return (
              <div
                key={id}
                className={`rounded-lg border p-3 ${
                  isOnline
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-sm font-bold text-secondary">
                    {KIOSK_LABELS[id]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {isOnline ? 'online' : 'offline'} · last seen {fmtAgo(now, ts)}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Two column: readiness + audit feed */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Pre-event readiness">
          {!readiness.data ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : readiness.data.checks.length === 0 ? (
            <p className="text-sm text-emerald-700">All checks passing.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {readiness.data.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <StatusDot status={c.status} />
                  <div className="min-w-0">
                    <div className="font-semibold text-secondary">{c.label}</div>
                    <div className="text-xs text-gray-500">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent admin activity">
          {!audit.data || audit.data.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audit.data.slice(0, 12).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-secondary">{e.summary}</div>
                    <div className="text-xs text-gray-400">
                      {e.actor} · {fmtAbs(new Date(e.ts).toISOString())}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                    {e.action}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Sync health + backup quick-actions */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card
          title="run.events sync health"
          action={
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {refreshMut.isPending ? 'Refreshing…' : 'Refresh now'}
            </button>
          }
        >
          {!cacheQ.data || cacheQ.data.entries.length === 0 ? (
            <p className="text-sm text-gray-400">
              Cache is empty — next request will hit run.events.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {cacheQ.data.entries.map((e) => (
                <li
                  key={e.key}
                  className="flex items-center justify-between gap-3 font-mono text-xs"
                >
                  <span className="truncate text-gray-700">{e.key}</span>
                  <span className="shrink-0 text-gray-500">
                    expires in {Math.max(0, Math.round(e.remainingMs / 1000))}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Backups"
          action={
            <Link
              to="/snapshots"
              className="text-xs font-semibold text-primary hover:underline"
            >
              All snapshots →
            </Link>
          }
        >
          <button
            onClick={() => snapMut.mutate()}
            disabled={snapMut.isPending}
            className="mb-3 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {snapMut.isPending ? 'Snapshotting…' : 'Take snapshot now'}
          </button>
          {!lastSnapshot ? (
            <p className="text-sm text-gray-400">No snapshots yet.</p>
          ) : (
            <p className="text-sm text-gray-700">
              Last:{' '}
              <span className="font-mono text-xs">
                {fmtAbs(lastSnapshot.capturedAt)}
              </span>{' '}
              by <span className="text-gray-500">{lastSnapshot.capturedBy}</span>
              {lastSnapshot.reason && (
                <>
                  {' '}
                  ({lastSnapshot.reason})
                </>
              )}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-secondary">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
      ? 'text-amber-700'
      : tone === 'bad'
      ? 'text-red-700'
      : 'text-secondary'
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'fail' }) {
  const cls =
    status === 'ok'
      ? 'bg-emerald-500'
      : status === 'warn'
      ? 'bg-amber-500'
      : 'bg-red-500'
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />
}
