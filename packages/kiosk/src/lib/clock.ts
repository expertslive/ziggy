import { useEffect, useState } from 'react'

/** Parse an event-local time string (no TZ offset, e.g. "2026-06-02T16:50:00")
 * as Amsterdam time. The event runs entirely within CEST (June = UTC+2),
 * so we hardcode the offset rather than pulling in date-fns-tz. Returns an
 * absolute Date, suitable for comparing against `getSimulatedNow()` or
 * `new Date()` regardless of the device's timezone. */
export function eventLocalToDate(s: string): Date {
  // If the string already carries an offset (`+`, `-`, or `Z`), trust it.
  if (/[+\-Z]\d{2}/.test(s.slice(10)) || s.endsWith('Z')) return new Date(s)
  return new Date(`${s}+02:00`)
}

export function getSimulatedNow(override: string | undefined | null): Date {
  if (!override) return new Date()
  // URL query strings decode `+` as a space (form-urlencoded), and a
  // round-trip through React Router can additionally turn the space into
  // `%20` and re-introduce a literal `+`, leaving us with strings like
  // `T11:15:00 02:00`, `T11:15:00 +02:00`, or `T11:15:00  02:00` (double
  // space). Collapse any combination of whitespace and `+` chars before a
  // trailing `HH:MM` offset back into a single `+`, so any of the variants
  // parses as a valid ISO 8601 instant.
  const repaired = override.replace(/[\s+]+(\d\d:\d\d)$/, '+$1')
  const parsed = new Date(repaired)
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

export function useClockTick(intervalMs = 30_000): Date {
  const override =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('now')
      : null
  const [now, setNow] = useState(() => getSimulatedNow(override))
  useEffect(() => {
    if (override) return // Frozen in override mode
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, override])
  return now
}
