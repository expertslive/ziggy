import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SlideOver } from '../SlideOver'
import { useToast } from '../Toast'
import {
  ApiError,
  createKiosk,
  deleteKiosk,
  updateKiosk,
  type DashboardKiosk,
} from '../../lib/api'

type Mode = 'create' | 'edit'

interface Props {
  open: boolean
  mode: Mode
  /** In edit mode this is the existing row from the dashboard endpoint.
   *  In create mode it can pre-fill `kioskId` (e.g. "label me" flow) or be null. */
  kiosk: DashboardKiosk | null
  onClose: () => void
}

const KIOSK_ID_RE = /^kiosk-[A-Za-z0-9-]+$/
const SHORT_CODE_RE = /^[A-Z0-9]{2,12}$/

interface FormState {
  kioskId: string
  displayName: string
  shortCode: string
  location: string
}

function emptyForm(): FormState {
  return { kioskId: '', displayName: '', shortCode: '', location: '' }
}

function fromKiosk(k: DashboardKiosk | null): FormState {
  if (!k) return emptyForm()
  return {
    kioskId: k.kioskId,
    displayName:
      // In create mode for an unaliased kiosk, displayName falls back to
      // kioskId on the server side; don't pre-fill that as a real name.
      k.displayName === k.kioskId ? '' : k.displayName,
    shortCode: k.shortCode ?? '',
    location: k.location ?? '',
  }
}

export function KioskEditModal({ open, mode, kiosk, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [initial, setInitial] = useState<FormState>(emptyForm())
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = fromKiosk(kiosk)
    setForm(next)
    setInitial(next)
    setServerError(null)
    setConfirmDelete(false)
  }, [open, kiosk?.kioskId])

  const errors = useMemo(() => validate(form, mode), [form, mode])
  const valid = Object.keys(errors).length === 0

  const dirty = useMemo(() => {
    return (
      form.kioskId !== initial.kioskId ||
      form.displayName !== initial.displayName ||
      form.shortCode !== initial.shortCode ||
      form.location !== initial.location
    )
  }, [form, initial])

  const createMut = useMutation({
    mutationFn: () =>
      createKiosk({
        id: form.kioskId.trim(),
        displayName: form.displayName.trim(),
        ...(form.shortCode.trim() && { shortCode: form.shortCode.trim() }),
        ...(form.location.trim() && { location: form.location.trim() }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-kiosks'] })
      toast('success', 'Kiosk alias added')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Create failed'
      setServerError(msg)
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!kiosk) throw new Error('No kiosk selected')
      const payload: Record<string, string> = {}
      if (form.displayName.trim() !== (initial.displayName || '')) {
        payload.displayName = form.displayName.trim()
      }
      if (form.shortCode.trim() !== (initial.shortCode || '')) {
        payload.shortCode = form.shortCode.trim()
      }
      if (form.location.trim() !== (initial.location || '')) {
        payload.location = form.location.trim()
      }
      return updateKiosk(kiosk.kioskId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-kiosks'] })
      toast('success', 'Kiosk updated')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Update failed'
      setServerError(msg)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => {
      if (!kiosk) throw new Error('No kiosk selected')
      return deleteKiosk(kiosk.kioskId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-kiosks'] })
      toast('success', 'Alias deleted')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Delete failed'
      setServerError(msg)
    },
  })

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending

  const handleSave = () => {
    setServerError(null)
    if (!valid || !dirty || busy) return
    if (mode === 'create') createMut.mutate()
    else updateMut.mutate()
  }

  const aliasExists = mode === 'edit' && !!kiosk && kiosk.displayName !== kiosk.kioskId

  // Auto-uppercase short code as the user types.
  const onShortCodeChange = (v: string) => {
    setForm((f) => ({ ...f, shortCode: v.toUpperCase() }))
  }

  return (
    <SlideOver
      open={open}
      title={mode === 'create' ? 'Add kiosk alias' : 'Edit kiosk'}
      onClose={onClose}
    >
      <div className="space-y-5">
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Field label="Kiosk ID" error={errors.kioskId}>
          {mode === 'create' ? (
            <input
              type="text"
              value={form.kioskId}
              onChange={(e) => setForm((f) => ({ ...f, kioskId: e.target.value }))}
              placeholder="kiosk-3F2A"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <code className="block break-all rounded bg-surface-alt px-2 py-1.5 font-mono text-xs text-gray-700">
              {form.kioskId}
            </code>
          )}
          <Helper>
            {mode === 'create'
              ? 'Must look like kiosk-XXXX (8-64 chars, letters, digits, dashes).'
              : 'Read-only — the kioskId is permanent.'}
          </Helper>
        </Field>

        <Field label="Display name" error={errors.displayName}>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
            placeholder="Lobby Foyer"
            maxLength={100}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Helper>1-100 chars. Shown across admin and dashboard views.</Helper>
        </Field>

        <Field label="Short code" error={errors.shortCode} optional>
          <input
            type="text"
            value={form.shortCode}
            onChange={(e) => onShortCodeChange(e.target.value)}
            placeholder="A1B2"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm uppercase tracking-wider outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Helper>
            2-12 chars, letters and digits only — used by the kiosk pair-overlay so on-site cards can match.
          </Helper>
        </Field>

        <Field label="Location" error={errors.location} optional>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="Hall 3 — Speakers entrance"
            maxLength={200}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Helper>e.g. Hall 3 — Speakers entrance.</Helper>
        </Field>

        {/* Save / Cancel */}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-alt disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || !dirty || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {(createMut.isPending || updateMut.isPending) && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {mode === 'create' ? 'Add alias' : 'Save changes'}
          </button>
        </div>

        {/* Soft-delete (edit + alias exists) */}
        {aliasExists && (
          <div className="border-t border-border pt-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => {
                  setServerError(null)
                  setConfirmDelete(true)
                }}
                disabled={busy}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete alias
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">
                  Delete alias for this kiosk? Display name will revert to the raw ID.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-surface-alt disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteMut.isPending && (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    )}
                    Confirm delete
                  </button>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Soft-delete — the alias is hidden, but the kiosk continues to send heartbeats and will reappear unaliased.
            </p>
          </div>
        )}
      </div>
    </SlideOver>
  )
}

function validate(
  form: FormState,
  mode: Mode,
): Partial<Record<keyof FormState, string>> {
  const out: Partial<Record<keyof FormState, string>> = {}
  if (mode === 'create') {
    const id = form.kioskId.trim()
    if (!id) out.kioskId = 'Required'
    else if (id.length < 8) out.kioskId = 'Min 8 chars'
    else if (id.length > 64) out.kioskId = 'Max 64 chars'
    else if (!KIOSK_ID_RE.test(id)) out.kioskId = 'Must look like kiosk-XXXX'
  }
  const dn = form.displayName.trim()
  if (!dn) out.displayName = 'Required'
  else if (dn.length > 100) out.displayName = 'Max 100 chars'

  const sc = form.shortCode.trim()
  if (sc && !SHORT_CODE_RE.test(sc)) out.shortCode = '2-12 chars, A-Z and 0-9 only'

  const loc = form.location.trim()
  if (loc.length > 200) out.location = 'Max 200 chars'

  return out
}

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700">
        <span>{label}</span>
        {optional && <span className="text-xs text-gray-400">Optional</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-gray-500">{children}</p>
}
