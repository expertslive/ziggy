import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKioskStore } from '../store/kiosk'
import { endSession } from '../lib/analytics'

const INACTIVITY_TIMEOUT = 60_000

export function useInactivityReset() {
  const navigate = useNavigate()
  const lastInteraction = useKioskStore((s) => s.lastInteraction)
  const resetSession = useKioskStore((s) => s.resetSession)

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (elapsed >= INACTIVITY_TIMEOUT) {
        // Emit a session_end analytics event with the visitor's elapsed
        // interaction window BEFORE clearing session state.
        endSession()
        resetSession()
        navigate('/now', { replace: true })
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lastInteraction, navigate, resetSession])
}
