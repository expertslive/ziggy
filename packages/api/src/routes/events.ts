import { Hono } from 'hono'
import {
  DEFAULT_BRANDING,
  MIN_SEARCH_LENGTH,
  type RunEventsAgendaItem,
  type FloorMap,
  type Sponsor,
  type SponsorTier,
  type EventConfig,
  type I18nOverrides,
} from '@ziggy/shared'
import { getEnv } from '../env.js'
import * as runEvents from '../lib/run-events.js'
import { findAll, findById } from '../lib/cosmos.js'

const events = new Hono()

function getEventApiKey(slug: string): string | null {
  const env = getEnv()
  if (slug !== env.eventSlug) return null
  return env.runEventsApiKey
}

// GET /api/events/:slug/config
events.get('/api/events/:slug/config', async (c) => {
  const slug = c.req.param('slug')
  const env = getEnv()

  // Try Cosmos DB first
  try {
    const config = await findById<EventConfig>('events', slug, slug)
    if (config) {
      return c.json(config)
    }
  } catch {
    // Cosmos DB not available — fall through to defaults
  }

  // Fall back to hardcoded defaults
  if (slug !== env.eventSlug) {
    return c.json({ error: 'Event not found' }, 404)
  }

  return c.json({
    slug: env.eventSlug,
    name: 'Experts Live Netherlands 2026',
    timezone: 'Europe/Amsterdam',
    languages: ['nl', 'en'],
    defaultLanguage: 'nl',
    branding: DEFAULT_BRANDING,
    days: [],
  })
})

// GET /api/events/:slug/agenda — structured agenda (days/timeslots/sessions)
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

// GET /api/events/:slug/sessions/now — sessions happening right now
events.get('/api/events/:slug/sessions/now', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const items = await runEvents.fetchRawAgenda(apiKey, slug)
    const eventTimezone = items[0]?.timeZone || 'Europe/Amsterdam'

    // Get current time in event timezone
    const now = new Date()
    const nowStr = now.toLocaleString('sv-SE', { timeZone: eventTimezone }) // "2026-06-01 14:30:00"
    const nowIso = nowStr.replace(' ', 'T') // "2026-06-01T14:30:00"

    const current: RunEventsAgendaItem[] = []
    const upcoming: RunEventsAgendaItem[] = []

    for (const item of items) {
      // Only include actual sessions
      if (item.elementType !== 1) continue

      if (item.startDate <= nowIso && nowIso < item.endDate) {
        current.push(item)
      } else if (item.startDate > nowIso) {
        upcoming.push(item)
      }
    }

    // Sort upcoming by start time and take the next timeslot
    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
    const nextTimeGroup = upcoming[0]?.startTimeGroup
    const upNext = nextTimeGroup
      ? upcoming.filter((s) => s.startTimeGroup === nextTimeGroup)
      : []

    return c.json({ current, upNext, timeZone: eventTimezone })
  } catch (err) {
    console.error('[events/sessions/now]', err)
    return c.json({ error: 'Failed to fetch current sessions' }, 502)
  }
})

// GET /api/events/:slug/speakers
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

// GET /api/events/:slug/booths
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

// GET /api/events/:slug/search?q=
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

// GET /api/events/:slug/sponsor-tiers
events.get('/api/events/:slug/sponsor-tiers', async (c) => {
  const slug = c.req.param('slug')

  try {
    const tiers = await findAll<SponsorTier>('sponsor-tiers', 'eventSlug', slug)
    return c.json(tiers)
  } catch {
    return c.json([] as SponsorTier[])
  }
})

// GET /api/events/:slug/sponsors
events.get('/api/events/:slug/sponsors', async (c) => {
  const slug = c.req.param('slug')

  try {
    const sponsors = await findAll<Sponsor>('sponsors', 'eventSlug', slug)
    return c.json(sponsors)
  } catch {
    // Cosmos DB not available — return empty array
    return c.json([] as Sponsor[])
  }
})

// GET /api/events/:slug/floor-maps
events.get('/api/events/:slug/floor-maps', async (c) => {
  const slug = c.req.param('slug')

  try {
    const floorMaps = await findAll<FloorMap>('floor-maps', 'eventSlug', slug)
    return c.json(floorMaps)
  } catch {
    // Cosmos DB not available — return empty array
    return c.json([] as FloorMap[])
  }
})

// GET /api/events/:slug/i18n-overrides
events.get('/api/events/:slug/i18n-overrides', async (c) => {
  const slug = c.req.param('slug')

  try {
    const overrides = await findAll<I18nOverrides>('i18n-overrides', 'eventSlug', slug)
    return c.json(overrides)
  } catch {
    // Cosmos DB not available — return empty array
    return c.json([] as I18nOverrides[])
  }
})

export default events
