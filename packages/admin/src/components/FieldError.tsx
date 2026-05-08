import { fieldErrorAt } from '../lib/api'

/** Inline per-field validation error. Pass the API error caught from a
 * mutation and the form-field path; renders a small red message when
 * there's a matching zod issue, otherwise nothing. */
export function FieldError({
  error,
  path,
}: {
  error: unknown
  path: string | (string | number)[]
}) {
  const msg = fieldErrorAt(error, path)
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}

/** Top-of-form generic error banner for non-field errors (auth, network,
 * 5xx). Skips zod-issue errors since those render per-field. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const issues = (error as { issues?: unknown[] }).issues
    if (Array.isArray(issues) && issues.length > 0) {
      return (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Sommige velden zijn ongeldig. Zie de meldingen onder elk veld.
        </div>
      )
    }
  }
  const msg = error instanceof Error ? error.message : 'Er ging iets mis.'
  return (
    <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}
    </div>
  )
}
