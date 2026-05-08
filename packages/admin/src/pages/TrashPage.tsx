import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchTrash,
  restoreFromTrash,
  permanentDelete,
  type TrashBundle,
  type TrashTarget,
} from '../lib/api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const SECTIONS: { key: TrashTarget; label: string }[] = [
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'sponsor-tiers', label: 'Sponsor tiers' },
  { key: 'floor-maps', label: 'Floor maps' },
  { key: 'shop-items', label: 'Shop items' },
]

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

export function TrashPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const q = useQuery<TrashBundle>({ queryKey: ['trash'], queryFn: fetchTrash })

  const [hardTarget, setHardTarget] = useState<{
    target: TrashTarget
    id: string
    name: string
  } | null>(null)

  const restoreMut = useMutation({
    mutationFn: (vars: { target: TrashTarget; id: string }) =>
      restoreFromTrash(vars.target, vars.id),
    onSuccess: (_, vars) => {
      toast('success', `Restored from ${vars.target}`)
      qc.invalidateQueries({ queryKey: ['trash'] })
      qc.invalidateQueries({ queryKey: [vars.target] })
    },
    onError: () => toast('error', 'Restore failed'),
  })
  const hardMut = useMutation({
    mutationFn: (vars: { target: TrashTarget; id: string }) =>
      permanentDelete(vars.target, vars.id),
    onSuccess: () => {
      toast('success', 'Permanently deleted')
      setHardTarget(null)
      qc.invalidateQueries({ queryKey: ['trash'] })
    },
    onError: () => toast('error', 'Delete failed'),
  })

  const total =
    (q.data?.sponsors.length ?? 0) +
    (q.data?.['sponsor-tiers'].length ?? 0) +
    (q.data?.['floor-maps'].length ?? 0) +
    (q.data?.['shop-items'].length ?? 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Prullenbak</h1>
        <p className="mt-1 text-sm text-gray-500">
          Verwijderde records — herstel binnen 30 dagen of permanent verwijderen.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {!q.isLoading && total === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center text-sm text-gray-400">
          Prullenbak is leeg.
        </div>
      )}

      {SECTIONS.map(({ key, label }) => {
        const items = q.data?.[key] ?? []
        if (items.length === 0) return null
        return (
          <section key={key} className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-secondary">
              {label}{' '}
              <span className="text-sm font-medium text-gray-400">({items.length})</span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Deleted</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it: { id: string; name: string; deletedAt?: string }) => (
                    <tr key={it.id}>
                      <td className="px-6 py-3 text-sm text-secondary">{it.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {fmtDate(it.deletedAt)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() =>
                            restoreMut.mutate({ target: key, id: it.id })
                          }
                          className="mr-3 text-sm font-semibold text-primary hover:underline"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() =>
                            setHardTarget({ target: key, id: it.id, name: it.name })
                          }
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete forever
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      <ConfirmDialog
        open={!!hardTarget}
        title="Permanently delete?"
        message={`"${hardTarget?.name}" will be removed for good. This cannot be undone.`}
        confirmLabel="Delete forever"
        confirmTone="danger"
        onConfirm={() =>
          hardTarget &&
          hardMut.mutate({ target: hardTarget.target, id: hardTarget.id })
        }
        onCancel={() => setHardTarget(null)}
      />
    </div>
  )
}
