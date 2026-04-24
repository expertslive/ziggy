import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
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

// Security headers (applied after CORS so CORS headers are set first)
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  }),
)

// Body size limit for admin writes (1 MB). Upload route has its own larger
// limit handled in-route, so exempt it here.
app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/upload') return next()
  const lim = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'Request body too large' }, 413),
  })
  return lim(c, next)
})

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
