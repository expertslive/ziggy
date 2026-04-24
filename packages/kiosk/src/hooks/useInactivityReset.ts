import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKioskStore } from '../store/kiosk'

const INACTIVITY_TIMEOUT = 60_000

export function useInactivityReset() {
  const navigate = useNavigate()
  const lastInteraction = useKioskStore((s) => s.lastInteraction)
  const resetSession = useKioskStore((s) => s.resetSession)

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (elapsed >= INACTIVITY_TIMEOUT) {
        resetSession()
        navigate('/now', { replace: true })
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lastInteraction, navigate, resetSession])
}
