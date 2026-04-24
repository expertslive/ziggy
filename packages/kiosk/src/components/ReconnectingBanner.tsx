import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function ReconnectingBanner() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null

    const evaluate = () => {
      const queries = client.getQueryCache().getAll()
      const anyError = queries.some((q) => q.state.status === 'error')
      if (anyError && !timeout) {
        timeout = setTimeout(() => setShow(true), 10_000)
      }
      if (!anyError) {
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
    <div className="bg-yellow-500 text-black text-center py-2 text-sm font-medium">
      {t('reconnecting')}
    </div>
  )
}
