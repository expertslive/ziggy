import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchMe,
  updateMe,
  changeOwnPassword,
  type AdminUser,
} from '../lib/api'
import { useToast } from '../components/Toast'
import { FormError } from '../components/FieldError'
import { useTheme, type ThemePref } from '../lib/theme'

export function ProfilePage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const me = useQuery<AdminUser>({ queryKey: ['me'], queryFn: fetchMe })

  const [displayName, setDisplayName] = useState('')
  useEffect(() => {
    if (me.data) setDisplayName(me.data.displayName || '')
  }, [me.data])

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwError, setPwError] = useState<unknown>(null)
  const [profileError, setProfileError] = useState<unknown>(null)

  const profileMut = useMutation({
    mutationFn: (name: string) => updateMe(name),
    onSuccess: () => {
      toast('success', 'Profile updated')
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      setProfileError(err)
      toast('error', 'Failed to save')
    },
  })

  const pwMut = useMutation({
    mutationFn: (vars: { current: string; next: string }) =>
      changeOwnPassword(vars.current, vars.next),
    onSuccess: () => {
      toast('success', 'Password changed')
      setCurrentPw('')
      setNewPw('')
      setNewPw2('')
    },
    onError: (err) => {
      setPwError(err)
      toast('error', 'Failed to change password')
    },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Your admin account.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-secondary">Account</h2>
          <FormError error={profileError} />
          <div className="mt-3">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              value={me.data?.email || ''}
              disabled
              className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-400">
              Email is the login + audit identity — change it by creating a new
              account and deleting the old one.
            </p>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maarten Goet"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => {
              setProfileError(null)
              profileMut.mutate(displayName)
            }}
            disabled={profileMut.isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {profileMut.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-secondary">Change password</h2>
          <FormError error={pwError} />
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Current password
              </label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                New password (again)
              </label>
              <input
                type="password"
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {newPw && newPw2 && newPw !== newPw2 && (
              <p className="text-xs text-red-600">Passwords don't match.</p>
            )}
            {newPw && newPw.length < 8 && (
              <p className="text-xs text-red-600">Minimum 8 characters.</p>
            )}
          </div>
          <button
            onClick={() => {
              setPwError(null)
              pwMut.mutate({ current: currentPw, next: newPw })
            }}
            disabled={
              pwMut.isPending ||
              !currentPw ||
              !newPw ||
              newPw !== newPw2 ||
              newPw.length < 8
            }
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pwMut.isPending ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-secondary">Appearance</h2>
        <ThemePicker />
      </div>
    </div>
  )
}

function ThemePicker() {
  const { pref, resolved, setPref } = useTheme()
  const options: { value: ThemePref; label: string; hint: string }[] = [
    { value: 'light', label: 'Light', hint: 'Always light' },
    { value: 'dark', label: 'Dark', hint: 'Always dark' },
    { value: 'system', label: 'System', hint: 'Match your OS setting' },
  ]
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => setPref(o.value)}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              pref === o.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-surface-alt'
            }`}
          >
            <div className="font-semibold">{o.label}</div>
            <div className="text-xs text-gray-500">{o.hint}</div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Currently rendering in {resolved} mode. Choice is stored per-browser.
      </p>
    </div>
  )
}
