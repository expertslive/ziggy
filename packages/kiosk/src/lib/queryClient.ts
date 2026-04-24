import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'ziggy-query-cache',
})

export const BUILD_HASH = (import.meta.env.VITE_BUILD_HASH as string | undefined) || 'dev'
