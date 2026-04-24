import { Hono } from 'hono'
import { getEnv } from '../env.js'
import * as runEvents from '../lib/run-events.js'

const warmup = new Hono()

warmup.get('/api/warmup', async (c) => {
  const env = getEnv()
  const slug = env.eventSlug
  const apiKey = env.runEventsApiKey
  if (!apiKey) return c.json({ ok: false, error: 'No API key' }, 503)

  const results = await Promise.allSettled([
    runEvents.fetchRawAgenda(apiKey, slug),
    runEvents.fetchSpeakers(apiKey, slug),
    runEvents.fetchBooths(apiKey, slug),
    runEvents.fetchPartnerships(apiKey, slug),
  ])

  const warmed = results.map((r, i) => ({
    source: ['agenda', 'speakers', 'booths', 'partnerships'][i],
    ok: r.status === 'fulfilled',
  }))

  const allOk = warmed.every((w) => w.ok)
  return c.json({ ok: allOk, warmed }, allOk ? 200 : 503)
})

export default warmup
