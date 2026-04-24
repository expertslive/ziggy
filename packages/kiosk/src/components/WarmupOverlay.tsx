import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

const CORE_KEYS = ['agenda', 'now-sessions', 'event-config']

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

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-el-darker/90">
      <div className="text-4xl font-extrabold text-el-light mb-2">{t('warmup.title')}</div>
      <div className="text-el-light/70 mb-6">{t('warmup.subtitle')}</div>
      <button
        className="bg-el-blue text-white px-6 py-3 rounded-xl font-bold text-lg"
        onClick={() => client.invalidateQueries()}
      >
        {t('warmup.retry')}
      </button>
    </div>
  )
}
