import { Hono } from 'hono'
import {
  DEFAULT_BRANDING,
  MIN_SEARCH_LENGTH,
  type EventConfig,
  type RunEventsSession,
  type FloorMap,
  type Sponsor,
} from '@ziggy/shared'
import { getEnv } from '../env.js'
import * as runEvents from '../lib/run-events.js'

const events = new Hono()

/**
 * Middleware-like helper: validates that the slug matches the configured event
 * and returns the API key. Returns null and sends a 404 if the slug is invalid.
 */
function getEventApiKey(slug: string): string | null {
  const env = getEnv()
  if (slug !== env.eventSlug) return null
  return env.runEventsApiKey
}

// ---------------------------------------------------------------------------
// GET /api/events/:slug/config
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/config', (c) => {
  const slug = c.req.param('slug')
  const env = getEnv()

  if (slug !== env.eventSlug) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const config: Omit<EventConfig, 'id' | 'apiKey' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'> = {
    slug: env.eventSlug,
    name: 'Experts Live Netherlands 2026',
    timezone: 'Europe/Amsterdam',
    languages: ['nl', 'en'],
    defaultLanguage: 'nl',
    branding: DEFAULT_BRANDING,
    days: [],
  }

  return c.json(config)
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/agenda
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/agenda', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const agenda = await runEvents.fetchAgenda(apiKey, slug)
    return c.json(agenda)
  } catch (err) {
    console.error('[events/agenda]', err)
    return c.json({ error: 'Failed to fetch agenda' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/sessions/now
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/sessions/now', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const agenda = await runEvents.fetchAgenda(apiKey, slug)

    // Compute current time in the event timezone
    const eventTimezone = 'Europe/Amsterdam'
    const now = new Date()
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: eventTimezone }))

    const currentSessions: RunEventsSession[] = []

    for (const day of agenda.days) {
      for (const timeslot of day.timeslots) {
        for (const session of timeslot.sessions) {
          const startsAt = new Date(
            new Date(session.startsAt).toLocaleString('en-US', { timeZone: eventTimezone }),
          )
          const endsAt = new Date(
            new Date(session.endsAt).toLocaleString('en-US', { timeZone: eventTimezone }),
          )

          if (startsAt <= nowInTz && nowInTz <= endsAt) {
            currentSessions.push(session)
          }
        }
      }
    }

    return c.json(currentSessions)
  } catch (err) {
    console.error('[events/sessions/now]', err)
    return c.json({ error: 'Failed to fetch current sessions' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/speakers
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/speakers', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const speakers = await runEvents.fetchSpeakers(apiKey, slug)
    return c.json(speakers)
  } catch (err) {
    console.error('[events/speakers]', err)
    return c.json({ error: 'Failed to fetch speakers' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/booths
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/booths', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const booths = await runEvents.fetchBooths(apiKey, slug)
    return c.json(booths)
  } catch (err) {
    console.error('[events/booths]', err)
    return c.json({ error: 'Failed to fetch booths' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/search?q=
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/search', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  const query = c.req.query('q') || ''
  if (query.length < MIN_SEARCH_LENGTH) {
    return c.json(
      { error: `Search query must be at least ${MIN_SEARCH_LENGTH} characters` },
      400,
    )
  }

  try {
    const results = await runEvents.searchAgenda(apiKey, slug, query)
    return c.json(results)
  } catch (err) {
    console.error('[events/search]', err)
    return c.json({ error: 'Failed to search agenda' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/sponsors (placeholder - Cosmos DB later)
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/sponsors', (c) => {
  const slug = c.req.param('slug')
  const env = getEnv()
  if (slug !== env.eventSlug) return c.json({ error: 'Event not found' }, 404)

  const sponsors: Sponsor[] = []
  return c.json(sponsors)
})

// ---------------------------------------------------------------------------
// GET /api/events/:slug/floor-maps (placeholder - Cosmos DB later)
// ---------------------------------------------------------------------------
events.get('/api/events/:slug/floor-maps', (c) => {
  const slug = c.req.param('slug')
  const env = getEnv()
  if (slug !== env.eventSlug) return c.json({ error: 'Event not found' }, 404)

  const floorMaps: FloorMap[] = []
  return c.json(floorMaps)
})

export default events
