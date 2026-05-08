import { useQuery } from '@tanstack/react-query'
import { fetchEventConfig } from '../lib/api'

/** Red banner shown when event is "live" (between startDate and endDate
 *  on the event-config doc, or one hour before startDate). Pre-event we
 *  surface a yellow countdown. Drives admin attention to the live state
 *  so changes feel deliberate. */
export function EventLiveBanner() {
  const cfg = useQuery({
    queryKey: ['event-config'],
    queryFn: fetchEventConfig,
    refetchInterval: 60_000,
    retry: false,
  })

  if (!cfg.data) return null
  const start = cfg.data.startDate ? new Date(cfg.data.startDate).getTime() : null
  const end = cfg.data.endDate ? new Date(cfg.data.endDate).getTime() : null
  const now = Date.now()
  if (!start || !end) return null

  // Banner kicks in 1 hour before start so the "doors open" buffer is also
  // treated as live for change-control purposes.
  const liveStart = start - 60 * 60 * 1000

  if (now < liveStart) {
    const hours = Math.round((liveStart - now) / (60 * 60_000))
    if (hours > 48) return null // keep the chrome quiet until ~2 days out
    return (
      <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
        Event starts in {hours}h — book a snapshot, then double-check every change.
      </div>
    )
  }
  if (now < end) {
    return (
      <div className="bg-red-600 px-4 py-2 text-center text-xs font-semibold text-white">
        ⚠ EVENT LIVE — every change ships to attendees in &lt;5 min via cache TTL. Take a snapshot before risky edits.
      </div>
    )
  }
  return null
}
