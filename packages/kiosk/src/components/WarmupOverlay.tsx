import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

const CORE_KEYS = ['agenda', 'now-sessions', 'event-config']
const COUNTDOWN_SECONDS = 15

export function WarmupOverlay() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null

    const evaluate = () => {
      const queries = client.getQueryCache().getAll()
      const coreLoading = queries.some(
        (q) =>
          CORE_KEYS.includes(String(q.queryKey[0])) &&
          q.state.status === 'pending' &&
          q.state.data === undefined,
      )
      if (coreLoading && !timeout) {
        timeout = setTimeout(() => setShow(true), 15_000)
      }
      if (!coreLoading) {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        setShow(false)
      }
    }

    const unsub = client.getQueryCache().subscribe(evaluate)
    evaluate()
    return () => {
      if (timeout) clearTimeout(timeout)
      unsub()
    }
  }, [client])

  // Countdown to auto-reload while the overlay is shown.
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)
  useEffect(() => {
    if (!show) {
      setSecondsLeft(COUNTDOWN_SECONDS)
      return
    }
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(tick)
  }, [show])

  useEffect(() => {
    if (show && secondsLeft === 0) {
      window.location.reload()
    }
  }, [show, secondsLeft])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-el-darker/90">
      <div className="text-4xl font-extrabold text-el-light mb-2">{t('warmup.title')}</div>
      <div className="text-el-light/70 mb-6">{t('warmup.subtitle')}</div>
      <div className="w-12 h-12 mb-6 border-4 border-el-blue/30 border-t-el-blue rounded-full animate-spin" />
      <div className="text-el-light/50 text-sm">
        {t('warmup.autoReloadIn', { seconds: secondsLeft })}
      </div>
    </div>
  )
}
