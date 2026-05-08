import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchImages,
  deleteImageBlob,
  type ImageBlob,
} from '../lib/api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ImagesPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const q = useQuery<ImageBlob[]>({ queryKey: ['images'], queryFn: fetchImages })
  const [filter, setFilter] = useState<'all' | 'used' | 'orphan'>('all')
  const [deleteTarget, setDeleteTarget] = useState<ImageBlob | null>(null)

  const deleteMut = useMutation({
    mutationFn: deleteImageBlob,
    onSuccess: () => {
      toast('success', 'Image deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['images'] })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast('error', msg)
    },
  })

  const all = q.data ?? []
  const orphans = all.filter((b) => b.usedBy.length === 0)
  const filtered =
    filter === 'used'
      ? all.filter((b) => b.usedBy.length > 0)
      : filter === 'orphan'
      ? orphans
      : all
  const totalBytes = all.reduce((s, b) => s + b.sizeBytes, 0)
  const orphanBytes = orphans.reduce((s, b) => s + b.sizeBytes, 0)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast('success', 'URL copied')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Images</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every uploaded image. {all.length} total ({fmtSize(totalBytes)});{' '}
          <span className={orphans.length ? 'text-amber-700' : ''}>
            {orphans.length} orphan ({fmtSize(orphanBytes)})
          </span>
          .
        </p>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {(['all', 'used', 'orphan'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === k
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 ring-1 ring-border hover:bg-surface-alt'
            }`}
          >
            {k}{' '}
            <span className="ml-1 text-[10px] opacity-70">
              ({k === 'all' ? all.length : k === 'used' ? all.length - orphans.length : orphans.length})
            </span>
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {!q.isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center text-sm text-gray-400">
          No images.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <div
            key={b.name}
            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
          >
            <div className="relative aspect-video bg-gray-100">
              <img
                src={b.url}
                alt={b.name}
                className="h-full w-full object-contain"
                loading="lazy"
              />
              {b.usedBy.length === 0 && (
                <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Orphan
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="text-xs text-gray-500">{fmtDate(b.uploadedAt)}</div>
              <div className="mt-0.5 font-mono text-[11px] text-gray-700 truncate">
                {b.name}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {fmtSize(b.sizeBytes)}
                {b.contentType ? ` · ${b.contentType}` : ''}
              </div>
              {b.usedBy.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                  {b.usedBy.slice(0, 3).map((u, i) => (
                    <li key={i} className="truncate">
                      <span className="font-mono text-gray-400">{u.kind}</span>:{' '}
                      {u.label}
                    </li>
                  ))}
                  {b.usedBy.length > 3 && (
                    <li className="text-gray-400">+ {b.usedBy.length - 3} more</li>
                  )}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => copy(b.url)}
                  className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-surface-alt"
                >
                  Copy URL
                </button>
                {b.usedBy.length === 0 && (
                  <button
                    onClick={() => setDeleteTarget(b)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete image?"
        message={`This is unreferenced — safe to remove. The blob is gone for good.`}
        confirmLabel="Delete"
        confirmTone="danger"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.name)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
