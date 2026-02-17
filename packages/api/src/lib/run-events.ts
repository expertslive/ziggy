import {
  RUN_EVENTS_API_BASE,
  type RunEventsAgenda,
  type RunEventsSpeaker,
  type RunEventsBooth,
  type RunEventsPartnership,
  type RunEventsSession,
} from '@ziggy/shared'
import * as cache from './cache.js'

/**
 * Make an authenticated request to the run.events API.
 */
async function request<T>(
  apiKey: string,
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  let url = `${RUN_EVENTS_API_BASE}${path}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const response = await fetch(url, {
    method,
    headers: {
      ApiKey: apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    throw new Error(`run.events API error ${response.status} for ${method} ${path}: ${body}`)
  }

  return response.json() as Promise<T>
}

/**
 * Fetch the full agenda for an event.
 * Results are cached by slug.
 */
export async function fetchAgenda(apiKey: string, slug: string): Promise<RunEventsAgenda> {
  const cacheKey = `agenda:${slug}`
  const cached = cache.get<RunEventsAgenda>(cacheKey)
  if (cached) return cached

  const data = await request<RunEventsAgenda>(apiKey, 'POST', `/v2/events/${slug}/agenda`)
  cache.set(cacheKey, data)
  return data
}

/**
 * Fetch all speakers for an event.
 * Results are cached by slug.
 */
export async function fetchSpeakers(apiKey: string, slug: string): Promise<RunEventsSpeaker[]> {
  const cacheKey = `speakers:${slug}`
  const cached = cache.get<RunEventsSpeaker[]>(cacheKey)
  if (cached) return cached

  const data = await request<RunEventsSpeaker[]>(apiKey, 'POST', `/v2/events/${slug}/speakers`)
  cache.set(cacheKey, data)
  return data
}

/**
 * Fetch all booths for an event.
 * Results are cached by slug.
 */
export async function fetchBooths(apiKey: string, slug: string): Promise<RunEventsBooth[]> {
  const cacheKey = `booths:${slug}`
  const cached = cache.get<RunEventsBooth[]>(cacheKey)
  if (cached) return cached

  const data = await request<RunEventsBooth[]>(apiKey, 'POST', `/v2/events/${slug}/booths`)
  cache.set(cacheKey, data)
  return data
}

/**
 * Fetch all partnerships for an event.
 * Results are cached by slug.
 */
export async function fetchPartnerships(
  apiKey: string,
  slug: string,
): Promise<RunEventsPartnership[]> {
  const cacheKey = `partnerships:${slug}`
  const cached = cache.get<RunEventsPartnership[]>(cacheKey)
  if (cached) return cached

  const data = await request<RunEventsPartnership[]>(
    apiKey,
    'POST',
    `/v2/events/${slug}/partnerships`,
  )
  cache.set(cacheKey, data)
  return data
}

/**
 * Search the agenda for an event.
 * This uses GET (unlike most run.events endpoints) and is NOT cached
 * since search queries vary widely.
 */
export async function searchAgenda(
  apiKey: string,
  slug: string,
  query: string,
): Promise<RunEventsSession[]> {
  return request<RunEventsSession[]>(apiKey, 'GET', `/v2/events/${slug}/agenda/search`, {
    q: query,
  })
}
