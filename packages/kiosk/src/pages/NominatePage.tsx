import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { BareLayout } from '../components/nominate/BareLayout'
import { Hero } from '../components/nominate/Hero'
import { SuccessScreen } from '../components/nominate/SuccessScreen'
import { useNominateLang } from '../i18n/nominate'

const EVENT_SLUG =
  (import.meta.env.VITE_EVENT_SLUG as string | undefined) ||
  'experts-live-netherlands-2026'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

const REASON_MAX = 1000

type FormState = {
  nomineeName: string
  nomineeEmail: string
  nomineePhone: string
  reason: string
  nominatorName: string
  nominatorEmail: string
  nominatorPhone: string
  consent: boolean
  website: string
}

const EMPTY_FORM: FormState = {
  nomineeName: '',
  nomineeEmail: '',
  nomineePhone: '',
  reason: '',
  nominatorName: '',
  nominatorEmail: '',
  nominatorPhone: '',
  consent: false,
  website: '',
}

const inputCls =
  'w-full min-h-12 text-base rounded-xl bg-el-light/40 border border-el-blue/20 focus:border-el-blue focus:ring-2 focus:ring-el-blue/30 outline-none px-4 py-2 text-el-dark placeholder:text-el-dark/40'

/** Public Studiebeurs nomination flow. Lives outside the kiosk shell and
 *  is reachable only by direct URL or QR. Renders a hero band, a single
 *  card form (nominee + reason + nominator + consent), and swaps to the
 *  SuccessScreen on a 200 response from POST /api/events/:slug/nominations. */
export function NominatePage() {
  const { t } = useNominateLang()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const reset = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setSubmitting(false)
    setSubmitted(false)
  }

  const update =
    <K extends keyof FormState>(key: K) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value =
        e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.value
      setForm((prev) => ({ ...prev, [key]: value }) as FormState)
    }

  const trimmedReason = form.reason
  const reasonLen = trimmedReason.length
  const reasonOver = reasonLen > REASON_MAX

  const canSubmit =
    !submitting &&
    form.nomineeName.trim().length > 0 &&
    form.reason.trim().length > 0 &&
    !reasonOver &&
    form.nominatorName.trim().length > 0 &&
    form.nominatorEmail.trim().length > 0 &&
    form.consent

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    const body: Record<string, unknown> = {
      nomineeName: form.nomineeName.trim(),
      reason: form.reason.trim(),
      nominatorName: form.nominatorName.trim(),
      nominatorEmail: form.nominatorEmail.trim(),
      consentToShareNomineeName: form.consent,
    }
    const optionals: Array<[keyof FormState, string]> = [
      ['nomineeEmail', 'nomineeEmail'],
      ['nomineePhone', 'nomineePhone'],
      ['nominatorPhone', 'nominatorPhone'],
    ]
    for (const [src, dst] of optionals) {
      const v = (form[src] as string).trim()
      if (v.length > 0) body[dst] = v
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/events/${EVENT_SLUG}/nominations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (res.ok) {
        setSubmitted(true)
        return
      }
      if (res.status === 429) {
        setError(t('errorRateLimit'))
      } else {
        setError(t('errorGeneric'))
      }
      setShakeKey((k) => k + 1)
    } catch {
      setError(t('errorGeneric'))
      setShakeKey((k) => k + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BareLayout>
      <Hero />
      {submitted ? (
        <SuccessScreen onAgain={reset} />
      ) : (
        <main className="max-w-lg mx-auto px-4 py-6">
          <p className="text-el-dark/80 mb-4 leading-relaxed">{t('intro')}</p>
          <motion.form
            key={shakeKey}
            onSubmit={handleSubmit}
            aria-busy={submitting}
            animate={shakeKey > 0 ? { x: [0, -8, 8, -4, 4, 0] } : undefined}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 space-y-6"
          >
            {/* Honeypot — bots fill it, humans don't. */}
            <div className="sr-only" aria-hidden="true">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={update('website')}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <fieldset disabled={submitting} className="contents">
              <Section title={t('sectionNominee')}>
                <Field label={t('nomineeNameRequired')}>
                  <input
                    type="text"
                    value={form.nomineeName}
                    onChange={update('nomineeName')}
                    autoComplete="name"
                    autoCapitalize="words"
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label={t('nomineeEmail')}>
                  <input
                    type="email"
                    inputMode="email"
                    value={form.nomineeEmail}
                    onChange={update('nomineeEmail')}
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    className={inputCls}
                  />
                </Field>
                <Field label={t('nomineePhone')}>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.nomineePhone}
                    onChange={update('nomineePhone')}
                    autoComplete="tel"
                    className={inputCls}
                  />
                </Field>
              </Section>

              <Section title={t('sectionReason')}>
                <Field label={t('reasonRequired')}>
                  <textarea
                    value={form.reason}
                    onChange={update('reason')}
                    placeholder={t('reasonPlaceholder')}
                    rows={5}
                    maxLength={REASON_MAX}
                    required
                    className={`${inputCls} py-3 resize-y min-h-32`}
                  />
                  <div
                    className={`mt-1 text-xs text-right tabular-nums ${
                      reasonOver ? 'text-red-600 font-semibold' : 'text-el-dark/50'
                    }`}
                  >
                    {t('charCounter').replace('{n}', String(reasonLen))}
                  </div>
                </Field>
              </Section>

              <Section title={t('sectionNominator')} hint={t('sectionNominatorHint')}>
                <Field label={t('nominatorNameRequired')}>
                  <input
                    type="text"
                    value={form.nominatorName}
                    onChange={update('nominatorName')}
                    autoComplete="name"
                    autoCapitalize="words"
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label={t('nominatorEmailRequired')}>
                  <input
                    type="email"
                    inputMode="email"
                    value={form.nominatorEmail}
                    onChange={update('nominatorEmail')}
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label={t('nominatorPhone')}>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.nominatorPhone}
                    onChange={update('nominatorPhone')}
                    autoComplete="tel"
                    className={inputCls}
                  />
                </Field>
              </Section>

              <div>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={update('consent')}
                    className="mt-1 w-5 h-5 accent-el-blue shrink-0"
                  />
                  <span className="text-sm leading-relaxed text-el-dark/85">
                    {t('consent')}{' '}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full min-h-12 rounded-xl bg-el-blue text-white text-base font-semibold inline-flex items-center justify-center gap-2 transition-opacity ${
                  !canSubmit ? 'opacity-60 cursor-not-allowed' : 'active:bg-el-blue/90'
                }`}
              >
                {submitting ? (
                  <>
                    <Spinner />
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  <span>{t('submit')}</span>
                )}
              </button>

              <p className="text-xs text-el-dark/50 leading-relaxed">{t('privacy')}</p>
            </fieldset>
          </motion.form>
        </main>
      )}
    </BareLayout>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-el-dark">{title}</h2>
        {hint && <p className="text-xs text-el-dark/55 mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  // Required indicator: the label string already carries " *" for required
  // fields; we colorise it inline so it's the conventional red asterisk
  // without forcing a second prop on every Field call site.
  const starIdx = label.lastIndexOf(' *')
  const hasStar = starIdx === label.length - 2
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-el-dark/85 mb-1">
        {hasStar ? (
          <>
            {label.slice(0, starIdx)}{' '}
            <span className="text-red-600" aria-hidden="true">
              *
            </span>
          </>
        ) : (
          label
        )}
      </span>
      {children}
    </label>
  )
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}
