/** Confirm-with-diff modal — shown before destructive saves so the admin
 * sees exactly what's about to change. Used by the floor-map editor most
 * prominently, but the shape is generic enough for any list of records. */

interface Item {
  id: string
  name: string
}

interface DiffConfirmProps {
  open: boolean
  title: string
  /** When all three lists are empty we render a "no changes" hint. */
  added: Item[]
  removed: Item[]
  changed: Item[]
  /** Optional warning to surface above the lists, e.g. "this will replace 47
   * hotspots — make sure you took a snapshot first". */
  warning?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  saving?: boolean
}

const PREVIEW_MAX = 8

function Section({
  title,
  items,
  tone,
}: {
  title: string
  items: Item[]
  tone: 'added' | 'removed' | 'changed'
}) {
  if (items.length === 0) return null
  const dot =
    tone === 'added'
      ? 'bg-emerald-500'
      : tone === 'removed'
      ? 'bg-red-500'
      : 'bg-amber-500'
  const previewed = items.slice(0, PREVIEW_MAX)
  const overflow = items.length - previewed.length
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-secondary">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {title} ({items.length})
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-sm text-gray-700">
        {previewed.map((it) => (
          <li key={it.id}>{it.name || <span className="text-gray-400">(unnamed)</span>}</li>
        ))}
        {overflow > 0 && (
          <li className="list-none text-xs italic text-gray-400">+ {overflow} more…</li>
        )}
      </ul>
    </div>
  )
}

export function DiffConfirm({
  open,
  title,
  added,
  removed,
  changed,
  warning,
  confirmLabel = 'Save',
  onConfirm,
  onCancel,
  saving,
}: DiffConfirmProps) {
  if (!open) return null
  const totalChanges = added.length + removed.length + changed.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-secondary">{title}</h3>

        {totalChanges === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No changes detected. You can still save to update timestamps, but nothing
            will move.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            {[
              added.length > 0 && `${added.length} added`,
              removed.length > 0 && `${removed.length} removed`,
              changed.length > 0 && `${changed.length} changed`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {warning && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ {warning}
          </div>
        )}

        <div className="max-h-[40vh] overflow-y-auto">
          <Section title="Added" items={added} tone="added" />
          <Section title="Removed" items={removed} tone="removed" />
          <Section title="Changed" items={changed} tone="changed" />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
