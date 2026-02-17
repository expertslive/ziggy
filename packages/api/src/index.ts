import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { getEnv } from './env.js'
import health from './routes/health.js'
import events from './routes/events.js'
import admin from './routes/admin.js'

const app = new Hono()

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

const env = getEnv()

// Request logging
app.use('*', logger())

// CORS - permissive in development, restrictive in production
if (env.nodeEnv === 'production') {
  app.use(
    '*',
    cors({
      origin: [
        'https://ziggy.expertslive.dev',
        'https://victorious-plant-071edeb03.6.azurestaticapps.net',
      ],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  )
} else {
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route('/', health)
app.route('/', events)
app.route('/', admin)

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = env.port

console.log(`Ziggy API starting on port ${port} (${env.nodeEnv})`)

serve({
  fetch: app.fetch,
  port,
})

console.log(`Ziggy API running at http://localhost:${port}`)
