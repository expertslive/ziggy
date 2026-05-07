import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'

/** Wrapper around react-router's `useNavigate` that preserves the current
 * search-string. Used so the `?now=...` override (and any future query-string
 * flag) survives in-app navigation — clicking through tabs/buttons won't drop
 * the test-mode setting. Production has no query string, so this is a no-op
 * outside of testing. */
export function useNavigateKeepingSearch() {
  const navigate = useNavigate()
  return useCallback(
    (to: string) => {
      const search = typeof window !== 'undefined' ? window.location.search : ''
      navigate(search ? `${to}${search}` : to)
    },
    [navigate],
  )
}
