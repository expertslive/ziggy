import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSnapshots,
  takeSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  backupPii,
  fetchHealth,
  type SnapshotMeta,
} from '../lib/api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const ageMs = Date.now() - new Date(iso).getTime()
  if (ageMs < 0) return 'just now'
  const sec = Math.floor(ageMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SnapshotsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const q = useQuery<SnapshotMeta[]>({
    queryKey: ['snapshots'],
    queryFn: fetchSnapshots,
  })

  const [reason, setReason] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<SnapshotMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SnapshotMeta | null>(null)

  const createMut = useMutation({
    mutationFn: (r: string | undefined) => takeSnapshot(r),
    onSuccess: () => {
      toast('success', 'Snapshot taken')
      setReason('')
      qc.invalidateQueries({ queryKey: ['snapshots'] })
    },
    onError: () => toast('error', 'Snapshot failed'),
  })
  const restoreMut = useMutation({
    mutationFn: (name: string) => restoreSnapshot(name),
    onSuccess: (data) => {
      const counts = Object.entries(data.restored)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')
      toast('success', `Restored: ${counts}`)
      setRestoreTarget(null)
      qc.invalidateQueries({ queryKey: ['snapshots'] })
      qc.invalidateQueries({ queryKey: ['sponsors'] })
      qc.invalidateQueries({ queryKey: ['sponsor-tiers'] })
      qc.invalidateQueries({ queryKey: ['floor-maps'] })
      qc.invalidateQueries({ queryKey: ['shop-items'] })
      qc.invalidateQueries({ queryKey: ['event-config'] })
    },
    onError: () => toast('error', 'Restore failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteSnapshot(name),
    onSuccess: () => {
      toast('success', 'Snapshot deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['snapshots'] })
    },
    onError: () => toast('error', 'Delete failed'),
  })

  // PII backup is a separate spoor — bids and nominations are append-only PII
  // we never want to "restore" (rolling back live entries is destructive).
  // The dashboard's lastBackupAt powers the "Last run" line; reusing that
  // query keeps a single source of truth.
  const health = useQuery({ queryKey: ['dashboard-health'], queryFn: fetchHealth })
  const piiMut = useMutation({
    mutationFn: () => backupPii(),
    onSuccess: (data) => {
      toast('success', `Backed up ${data.bids} bids + ${data.nominations} nominations`)
      qc.invalidateQueries({ queryKey: ['dashboard-health'] })
    },
    onError: () => toast('error', 'PII backup failed'),
  })

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Snapshots</h1>
          <p className="mt-1 text-sm text-gray-500">
            Self-service Cosmos backups — restore everything in one click.
          </p>
        </div>
      </div>

      {/* PII backup (bids + nominations) — separate from snapshots; never restored. */}
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-secondary">
              PII backup (bids + nominations)
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Daily JSON dump to Blob Storage. Append-only PII — never restored,
              just preserved. Last run: {relativeTime(health.data?.lastBackupAt)}.
            </p>
          </div>
          <button
            onClick={() => piiMut.mutate()}
            disabled={piiMut.isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {piiMut.isPending ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
      </div>

      {/* Take new snapshot */}
      <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-secondary">Take a snapshot now</h2>
        <p className="mt-1 text-xs text-gray-500">
          Captures sponsors, tiers, floor maps, shop items, event config, i18n
          and booth overrides into a single JSON in Blob Storage. Auto-snapshots
          run before destructive PUTs already; this is for manual milestones
          ("before adding 2026 sponsors", etc.).
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, e.g. 'before sponsor reorg')"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => createMut.mutate(reason || undefined)}
            disabled={createMut.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {createMut.isPending ? 'Taking…' : 'Snapshot now'}
          </button>
        </div>
      </div>

      {/* Snapshot list */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Captured at</th>
              <th className="px-6 py-3">By</th>
              <th className="px-6 py-3">Reason</th>
              <th className="px-6 py-3">Size</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  No snapshots yet — take one above.
                </td>
              </tr>
            )}
            {(q.data ?? []).map((s) => (
              <tr key={s.name}>
                <td className="px-6 py-3 text-sm text-secondary">{fmtDate(s.capturedAt)}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{s.capturedBy}</td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  {s.reason || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-6 py-3 text-sm font-mono text-gray-600">
                  {fmtSize(s.sizeBytes)}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => setRestoreTarget(s)}
                    className="mr-3 text-sm font-semibold text-primary hover:underline"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore from snapshot?"
        message={`This will overwrite every sponsor, tier, floor map, shop item and config with the snapshot from ${
          restoreTarget ? fmtDate(restoreTarget.capturedAt) : ''
        }. A pre-restore snapshot is taken automatically so you can roll back. Continue?`}
        confirmLabel="Restore"
        confirmTone="warning"
        onConfirm={() => restoreTarget && restoreMut.mutate(restoreTarget.name)}
        onCancel={() => setRestoreTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete snapshot?"
        message={`Permanently remove the snapshot from ${
          deleteTarget ? fmtDate(deleteTarget.capturedAt) : ''
        }. Cannot be undone.`}
        confirmLabel="Delete"
        confirmTone="danger"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.name)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
