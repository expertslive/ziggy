import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, setupAdmin, setToken } from '../lib/api'

const EVENT_KIOSK_URL =
  (import.meta.env.VITE_KIOSK_URL as string | undefined) ||
  'https://ziggy.expertslive.dev'

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'live now'
  const days = Math.floor(ms / 86_400_000)
  const hrs = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (days > 0) return `${days}d ${hrs}h`
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

export function LoginPage() {
  const navigate = useNavigate()
  const [isSetup, setIsSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [eventName, setEventName] = useState<string | null>(null)
  const [eventStart, setEventStart] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  // Pull a tiny bit of public event info to brand the splash. The login
  // page is unauthenticated; fetchEventConfig requires auth, so we hit
  // the public events endpoint directly.
  useEffect(() => {
    const slug = 'experts-live-netherlands-2026'
    fetch(`/api/events/${slug}/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg) return
        setEventName(cfg.name)
        if (cfg.startDate) setEventStart(new Date(cfg.startDate).getTime())
      })
      .catch(() => {
        // Private endpoint also works if logged in — but here we just want
        // public splash info, no auth.
      })
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = isSetup ? setupAdmin : login
      const res = await fn(email, password)
      setToken(res.token)
      navigate('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg.includes('404') || msg.includes('No admin')) {
        setIsSetup(true)
        setError('No admin account exists yet. Create the first admin below.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-secondary/95 to-primary p-6">
      {/* Decorative grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Floating glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl md:grid-cols-2">
        {/* Left: branding panel */}
        <div className="hidden flex-col justify-between bg-gradient-to-b from-secondary to-secondary/80 p-10 text-white md:flex">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
              Z
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Ziggy Admin</h1>
            <p className="mt-1 text-sm text-white/70">
              {eventName || 'Experts Live conference management'}
            </p>
          </div>

          <div className="space-y-5 text-sm">
            {eventStart && (
              <div>
                <p className="text-xs uppercase tracking-wider text-white/50">
                  Event starts in
                </p>
                <p className="mt-0.5 text-2xl font-bold">
                  {fmtCountdown(eventStart - now)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">
                Live kiosk
              </p>
              <a
                href={EVENT_KIOSK_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-white/90 underline-offset-2 hover:underline"
              >
                {EVENT_KIOSK_URL.replace(/^https?:\/\//, '')} ↗
              </a>
            </div>
          </div>

          <p className="text-xs text-white/50">
            Anonymous analytics enabled. No personal data is logged.
          </p>
        </div>

        {/* Right: form */}
        <div className="bg-white p-10">
          <div className="mb-6 md:hidden">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">
              Z
            </div>
            <h1 className="mt-3 text-xl font-bold text-secondary">Ziggy Admin</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <h2 className="text-lg font-bold text-secondary">
              {isSetup ? 'Create first admin' : 'Sign in'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {isSetup
                ? 'Bootstrap the first admin account.'
                : 'Sign in with your admin email + password.'}
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Min. 8 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {loading
                ? 'Please wait…'
                : isSetup
                ? 'Create admin & sign in'
                : 'Sign in'}
            </button>

            {!isSetup && (
              <button
                type="button"
                onClick={() => setIsSetup(true)}
                className="mt-3 w-full text-center text-xs text-gray-500 hover:text-primary"
              >
                First time? Set up admin account
              </button>
            )}
            {isSetup && (
              <button
                type="button"
                onClick={() => {
                  setIsSetup(false)
                  setError('')
                }}
                className="mt-3 w-full text-center text-xs text-gray-500 hover:text-primary"
              >
                Already have an account? Sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
