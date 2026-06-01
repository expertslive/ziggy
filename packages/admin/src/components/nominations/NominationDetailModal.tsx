import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Nomination, NominationStatus } from '@ziggy/shared'
import { SlideOver } from '../SlideOver'
import { ConfirmDialog } from '../ConfirmDialog'
import { useToast } from '../Toast'
import { deleteNomination, patchNomination } from '../../lib/api'

interface Props {
  nomination: Nomination | null
  open: boolean
  onClose: () => void
}

const STATUS_LABEL: Record<NominationStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
}

function StatusPill({ status }: { status: NominationStatus }) {
  const cls =
    status === 'verified'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function fmtDateTimeLong(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NominationDetailModal({ nomination, open, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  // Sync local notes draft whenever the selected nomination changes.
  useEffect(() => {
    setNotes(nomination?.adminNotes || '')
    setCopied(false)
  }, [nomination?.id, nomination?.adminNotes])

  const patchMut = useMutation({
    mutationFn: (data: { status?: NominationStatus; adminNotes?: string }) =>
      patchNomination(nomination!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominations'] })
      toast('success', 'Nomination updated')
    },
    onError: () => toast('error', 'Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteNomination(nomination!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominations'] })
      toast('success', 'Nomination deleted')
      setConfirmDelete(false)
      onClose()
    },
    onError: () => toast('error', 'Delete failed'),
  })

  if (!nomination) {
    return <SlideOver open={open} title="Nomination" onClose={onClose}><div /></SlideOver>
  }

  const dirty = (notes || '') !== (nomination.adminNotes || '')

  const handleStatus = (status: NominationStatus) => {
    if (status === nomination.status) return
    patchMut.mutate({ status })
  }

  const handleSaveNotes = () => {
    if (!dirty) return
    patchMut.mutate({ adminNotes: notes })
  }

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(nomination.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard not available — fail silently; the ID is still visible.
    }
  }

  return (
    <>
      <SlideOver open={open} title="Nomination" onClose={onClose}>
        <div className="space-y-6">
          {/* Top: status + consent */}
          <div className="flex items-center justify-between">
            <StatusPill status={nomination.status} />
            <div className="text-xs text-gray-500">
              Consent:{' '}
              {nomination.consentToShareNomineeName ? (
                <span className="font-semibold text-green-700">Yes</span>
              ) : (
                <span className="font-semibold text-gray-400">No</span>
              )}
            </div>
          </div>

          {/* Status buttons */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Set status
            </div>
            <div className="flex flex-wrap gap-2">
              {(['pending', 'verified', 'rejected'] as const).map((s) => {
                const active = nomination.status === s
                const base =
                  'min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50'
                const tone =
                  s === 'verified'
                    ? active
                      ? 'border-green-300 bg-green-100 text-green-800'
                      : 'border-border bg-white text-gray-600 hover:bg-green-50'
                    : s === 'rejected'
                      ? active
                        ? 'border-red-300 bg-red-100 text-red-800'
                        : 'border-border bg-white text-gray-600 hover:bg-red-50'
                      : active
                        ? 'border-yellow-300 bg-yellow-100 text-yellow-800'
                        : 'border-border bg-white text-gray-600 hover:bg-yellow-50'
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatus(s)}
                    disabled={patchMut.isPending}
                    className={`${base} ${tone}`}
                  >
                    Mark {STATUS_LABEL[s].toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Meta */}
          <Section title="Meta">
            <Field label="Created">{fmtDateTimeLong(nomination.createdAt)}</Field>
            <Field label="ID">
              <div className="flex items-center gap-2">
                <code className="break-all rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-700">
                  {nomination.id}
                </code>
                <button
                  type="button"
                  onClick={copyId}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </Field>
            {nomination.ipAddress && (
              <Field label="IP">
                <code className="font-mono text-xs text-gray-500">
                  {nomination.ipAddress}
                </code>
              </Field>
            )}
            {nomination.userAgent && (
              <Field label="User-Agent">
                <code className="break-all font-mono text-[11px] text-gray-500">
                  {nomination.userAgent}
                </code>
              </Field>
            )}
          </Section>

          {/* Nominee */}
          <Section title="Nominee">
            <Field label="Name">
              <span className="font-medium text-secondary">{nomination.nomineeName}</span>
            </Field>
            {nomination.nomineeEmail && (
              <Field label="Email">
                <a
                  href={`mailto:${nomination.nomineeEmail}`}
                  className="text-primary hover:underline"
                >
                  {nomination.nomineeEmail}
                </a>
              </Field>
            )}
            {nomination.nomineePhone && (
              <Field label="Phone">
                <a
                  href={`tel:${nomination.nomineePhone}`}
                  className="text-primary hover:underline"
                >
                  {nomination.nomineePhone}
                </a>
              </Field>
            )}
          </Section>

          {/* Reason */}
          <Section title="Reason">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {nomination.reason}
            </p>
          </Section>

          {/* Nominator */}
          <Section title="Nominator">
            <Field label="Name">
              <span className="font-medium text-secondary">{nomination.nominatorName}</span>
            </Field>
            <Field label="Email">
              <a
                href={`mailto:${nomination.nominatorEmail}`}
                className="text-primary hover:underline"
              >
                {nomination.nominatorEmail}
              </a>
            </Field>
            {nomination.nominatorPhone && (
              <Field label="Phone">
                <a
                  href={`tel:${nomination.nominatorPhone}`}
                  className="text-primary hover:underline"
                >
                  {nomination.nominatorPhone}
                </a>
              </Field>
            )}
          </Section>

          {/* Admin notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Admin notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes — not shown to anyone outside admin."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={!dirty || patchMut.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {patchMut.isPending ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>

          {/* Soft-delete */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Delete nomination
            </button>
            <p className="mt-2 text-xs text-gray-400">
              Soft-delete — the record is hidden from the list and CSV export, but kept in the database.
            </p>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete nomination?"
        message="This will hide the nomination from the admin list and CSV export. It can still be recovered from the database if needed."
        confirmLabel="Delete"
        confirmTone="danger"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface-alt/50 p-3 text-sm">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-3">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="min-w-0 text-sm text-gray-700 sm:col-span-2">{children}</div>
    </div>
  )
}
