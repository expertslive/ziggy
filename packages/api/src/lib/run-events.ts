import {
  RUN_EVENTS_API_BASE,
  type RunEventsAgendaItem,
  type RunEventsSpeaker,
  type RunEventsBooth,
  type RunEventsPartnership,
  type Agenda,
  type AgendaDay,
  type AgendaTimeslot,
  type AgendaSession,
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
 * Transform flat agenda items into structured days/timeslots.
 */
function transformAgenda(items: RunEventsAgendaItem[]): Agenda {
  const timeZone = items[0]?.timeZone || 'Europe/Amsterdam'

  // Group by date (extract date portion from startDate)
  const dayMap = new Map<string, RunEventsAgendaItem[]>()
  for (const item of items) {
    const date = item.startDate.substring(0, 10) // "2026-06-01"
    const existing = dayMap.get(date)
    if (existing) {
      existing.push(item)
    } else {
      dayMap.set(date, [item])
    }
  }

  // Sort dates and build structured days
  const sortedDates = [...dayMap.keys()].sort()
  const days: AgendaDay[] = sortedDates.map((date) => {
    const dayItems = dayMap.get(date)!

    // Group by startTimeGroup within the day
    const timeslotMap = new Map<string, RunEventsAgendaItem[]>()
    for (const item of dayItems) {
      const group = item.startTimeGroup
      const existing = timeslotMap.get(group)
      if (existing) {
        existing.push(item)
      } else {
        timeslotMap.set(group, [item])
      }
    }

    // Sort timeslots by time
    const sortedGroups = [...timeslotMap.keys()].sort()
    const timeslots: AgendaTimeslot[] = sortedGroups.map((group) => {
      const groupItems = timeslotMap.get(group)!

      // Find the earliest start and latest end for this timeslot
      const startDate = groupItems.reduce(
        (min, item) => (item.startDate < min ? item.startDate : min),
        groupItems[0].startDate,
      )
      const endDate = groupItems.reduce(
        (max, item) => (item.endDate > max ? item.endDate : max),
        groupItems[0].endDate,
      )

      const sessions: AgendaSession[] = groupItems.map((item) => ({
        id: item.id,
        guid: item.guid,
        title: item.title,
        description: item.description,
        roomName: item.roomName,
        roomGuid: item.roomGuid,
        startDate: item.startDate,
        endDate: item.endDate,
        startTimeGroup: item.startTimeGroup,
        elementType: item.elementType,
        elementTypeName: item.elementTypeName,
        color: item.color,
        icon: item.icon,
        labels: item.labels || [],
        speakers: item.speakers || [],
      }))

      return {
        startTimeGroup: group,
        startDate,
        endDate,
        sessions,
      }
    })

    return { date, timeslots }
  })

  return { days, timeZone }
}

/**
 * Fetch the full agenda and transform into structured format.
 * Results are cached by slug.
 */
export async function fetchAgenda(apiKey: string, slug: string): Promise<Agenda> {
  const cacheKey = `agenda:${slug}`
  const cached = cache.get<Agenda>(cacheKey)
  if (cached) return cached

  const items = await request<RunEventsAgendaItem[]>(
    apiKey,
    'POST',
    `/v2/events/${slug}/agenda`,
  )
  const agenda = transformAgenda(items)
  cache.set(cacheKey, agenda)
  return agenda
}

/**
 * Fetch raw agenda items (for "now" computation and search).
 */
export async function fetchRawAgenda(
  apiKey: string,
  slug: string,
): Promise<RunEventsAgendaItem[]> {
  const cacheKey = `agenda-raw:${slug}`
  const cached = cache.get<RunEventsAgendaItem[]>(cacheKey)
  if (cached) return cached

  const items = await request<RunEventsAgendaItem[]>(
    apiKey,
    'POST',
    `/v2/events/${slug}/agenda`,
  )
  cache.set(cacheKey, items)
  return items
}

/**
 * Fetch all speakers for an event.
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
 * Search the agenda. Uses GET and is NOT cached.
 */
export async function searchAgenda(
  apiKey: string,
  slug: string,
  query: string,
): Promise<RunEventsAgendaItem[]> {
  return request<RunEventsAgendaItem[]>(apiKey, 'GET', `/v2/events/${slug}/agenda/search`, {
    q: query,
  })
}
