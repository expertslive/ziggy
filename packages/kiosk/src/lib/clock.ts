import { useEffect, useState } from 'react'

export function getSimulatedNow(override: string | undefined | null): Date {
  if (!override) return new Date()
  const parsed = new Date(override)
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
