import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdmins,
  fetchMe,
  createAdminUser,
  updateAdminUser,
  resetUserPassword,
  deleteAdminUser,
  type AdminUser,
} from '../lib/api'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormError } from '../components/FieldError'
import { SlideOver } from '../components/SlideOver'

function fmtDate(iso: string | undefined) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function UsersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const me = useQuery<AdminUser>({ queryKey: ['me'], queryFn: fetchMe })
  const list = useQuery<AdminUser[]>({ queryKey: ['admins'], queryFn: fetchAdmins })

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ email: '', displayName: '', password: '' })
  const [createError, setCreateError] = useState<unknown>(null)

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [newPw, setNewPw] = useState('')
  const [resetError, setResetError] = useState<unknown>(null)

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const createMut = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      toast('success', 'Admin created')
      setCreateOpen(false)
      setForm({ email: '', displayName: '', password: '' })
      qc.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: (err) => {
      setCreateError(err)
      toast('error', 'Failed to create admin')
    },
  })
  const updateMut = useMutation({
    mutationFn: (vars: { id: string; data: { displayName?: string; disabled?: boolean } }) =>
      updateAdminUser(vars.id, vars.data),
    onSuccess: () => {
      toast('success', 'Admin updated')
      qc.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: () => toast('error', 'Update failed'),
  })
  const resetMut = useMutation({
    mutationFn: (vars: { id: string; password: string }) =>
      resetUserPassword(vars.id, vars.password),
    onSuccess: () => {
      toast('success', 'Password reset')
      setResetTarget(null)
      setNewPw('')
      qc.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: (err) => {
      setResetError(err)
      toast('error', 'Reset failed')
    },
  })
  const deleteMut = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      toast('success', 'Admin deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: () => toast('error', 'Delete failed'),
  })

  const isMe = (u: AdminUser) => u.email === me.data?.email

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Admins</h1>
            <p className="mt-1 text-sm text-gray-500">
              Accounts that can sign in to this admin panel.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            + Add admin
          </button>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {list.isLoading && (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            Loading…
          </div>
        )}
        <ul className="space-y-3">
          {(list.data ?? []).map((u) => (
            <li key={u.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="break-all text-sm font-semibold text-secondary">
                    {u.email}
                    {isMe(u) && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        You
                      </span>
                    )}
                  </div>
                  {u.displayName && (
                    <div className="mt-0.5 text-xs text-gray-500">{u.displayName}</div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    Last login: {fmtDate(u.lastLoginAt)}
                  </div>
                </div>
                {u.disabled ? (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    Disabled
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setResetTarget(u)}
                  className="min-h-11 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-alt"
                >
                  Reset pw
                </button>
                {!isMe(u) && (
                  <>
                    <button
                      onClick={() =>
                        updateMut.mutate({
                          id: u.id,
                          data: { disabled: !u.disabled },
                        })
                      }
                      className="min-h-11 flex-1 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="min-h-11 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-white shadow-sm md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Display name</th>
              <th className="px-6 py-3">Last login</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {(list.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-3 text-sm text-secondary">
                  {u.email}
                  {isMe(u) && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      You
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">
                  {u.displayName || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{fmtDate(u.lastLoginAt)}</td>
                <td className="px-6 py-3 text-sm">
                  {u.disabled ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Disabled
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right text-sm">
                  <button
                    onClick={() => setResetTarget(u)}
                    className="mr-3 font-semibold text-primary hover:underline"
                  >
                    Reset pw
                  </button>
                  {!isMe(u) && (
                    <>
                      <button
                        onClick={() =>
                          updateMut.mutate({
                            id: u.id,
                            data: { disabled: !u.disabled },
                          })
                        }
                        className="mr-3 font-semibold text-amber-700 hover:underline"
                      >
                        {u.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create admin slide-over */}
      <SlideOver
        open={createOpen}
        title="Add admin"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <FormError error={createError} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label>
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Display name
            </label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Initial password *
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-gray-400">
              Share this with the new admin out-of-band — they should change it on
              first login.
            </p>
          </div>
          <button
            onClick={() => {
              setCreateError(null)
              createMut.mutate({
                email: form.email.trim().toLowerCase(),
                displayName: form.displayName || undefined,
                password: form.password,
              })
            }}
            disabled={createMut.isPending || !form.email || form.password.length < 8}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating…' : 'Create admin'}
          </button>
        </div>
      </SlideOver>

      {/* Reset password */}
      <SlideOver
        open={!!resetTarget}
        title={`Reset password — ${resetTarget?.email ?? ''}`}
        onClose={() => {
          setResetTarget(null)
          setNewPw('')
        }}
      >
        <div className="space-y-4">
          <FormError error={resetError} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              type="text"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-gray-400">Minimum 8 characters.</p>
          </div>
          <button
            onClick={() => {
              setResetError(null)
              if (resetTarget)
                resetMut.mutate({ id: resetTarget.id, password: newPw })
            }}
            disabled={resetMut.isPending || newPw.length < 8}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {resetMut.isPending ? 'Saving…' : 'Reset password'}
          </button>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete admin?"
        message={`${deleteTarget?.email} will lose access immediately. The audit log keeps their history.`}
        confirmLabel="Delete"
        confirmTone="danger"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
