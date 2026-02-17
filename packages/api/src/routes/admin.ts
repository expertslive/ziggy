/** Admin CRUD routes */

import { Hono } from 'hono'
import type {
  Admin,
  LoginRequest,
  Sponsor,
  SponsorTier,
  FloorMap,
  EventConfig,
} from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import { signToken, hashPassword, comparePassword } from '../lib/auth.js'
import { findAll, findById, upsert, deleteItem, getContainer } from '../lib/cosmos.js'
import { uploadImage } from '../lib/storage.js'

const admin = new Hono()

// ---------------------------------------------------------------------------
// Auth routes (no auth middleware required)
// ---------------------------------------------------------------------------

/** POST /api/auth/login */
admin.post('/api/auth/login', async (c) => {
  const body = await c.req.json<LoginRequest>()
  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  // Look up admin by email (email is partition key for admins container)
  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: body.email }],
    })
    .fetchAll()

  const adminUser = resources[0]
  if (!adminUser) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await comparePassword(body.password, adminUser.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = signToken(adminUser)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return c.json({ token, expiresAt })
})

/** POST /api/auth/setup — bootstrap first admin (only if zero admins exist) */
admin.post('/api/auth/setup', async (c) => {
  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({ query: 'SELECT * FROM c' })
    .fetchAll()

  if (resources.length > 0) {
    return c.json({ error: 'Admin already exists. Setup is disabled.' }, 403)
  }

  const body = await c.req.json<LoginRequest>()
  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const newAdmin: Admin = {
    id: crypto.randomUUID(),
    email: body.email,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date().toISOString(),
  }

  await upsert('admins', newAdmin)

  const token = signToken(newAdmin)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return c.json({ token, expiresAt }, 201)
})

// ---------------------------------------------------------------------------
// All routes below require auth
// ---------------------------------------------------------------------------

admin.use('/api/admin/*', requireAuth)

// ---------------------------------------------------------------------------
// Image Upload
// ---------------------------------------------------------------------------

/** POST /api/admin/upload — upload an image to Azure Blob Storage */
admin.post('/api/admin/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided. Send a "file" field as multipart form data.' }, 400)
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: `Unsupported file type: ${file.type}` }, 400)
  }

  const maxSize = 10 * 1024 * 1024 // 10 MB
  if (file.size > maxSize) {
    return c.json({ error: 'File too large. Maximum size is 10 MB.' }, 400)
  }

  try {
    const buffer = await file.arrayBuffer()
    const url = await uploadImage(buffer, file.name, file.type)
    return c.json({ url })
  } catch (err) {
    console.error('[admin/upload]', err)
    return c.json({ error: 'Failed to upload image' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Sponsors CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/sponsors */
admin.get('/api/admin/events/:slug/sponsors', async (c) => {
  const slug = c.req.param('slug')
  const sponsors = await findAll<Sponsor>('sponsors', 'eventSlug', slug)
  return c.json(sponsors)
})

/** POST /api/admin/events/:slug/sponsors */
admin.post('/api/admin/events/:slug/sponsors', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json<Partial<Sponsor>>()
  const now = new Date().toISOString()

  const sponsor: Sponsor = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: body.name || '',
    tierId: body.tierId || '',
    description: body.description || {},
    logoUrl: body.logoUrl || '',
    website: body.website,
    boothNumber: body.boothNumber,
    sortOrder: body.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  }

  const created = await upsert('sponsors', sponsor)
  return c.json(created, 201)
})

/** PUT /api/admin/events/:slug/sponsors/:id */
admin.put('/api/admin/events/:slug/sponsors/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const existing = await findById<Sponsor>('sponsors', id, slug)
  if (!existing) return c.json({ error: 'Sponsor not found' }, 404)

  const body = await c.req.json<Partial<Sponsor>>()
  const updated: Sponsor = {
    ...existing,
    ...body,
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }

  const result = await upsert('sponsors', updated)
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/sponsors/:id */
admin.delete('/api/admin/events/:slug/sponsors/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  try {
    await deleteItem('sponsors', id, slug)
  } catch {
    return c.json({ error: 'Sponsor not found' }, 404)
  }
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Sponsor Tiers CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/sponsor-tiers */
admin.get('/api/admin/events/:slug/sponsor-tiers', async (c) => {
  const slug = c.req.param('slug')
  const tiers = await findAll<SponsorTier>('sponsor-tiers', 'eventSlug', slug)
  return c.json(tiers)
})

/** POST /api/admin/events/:slug/sponsor-tiers */
admin.post('/api/admin/events/:slug/sponsor-tiers', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json<Partial<SponsorTier>>()
  const now = new Date().toISOString()

  const tier: SponsorTier = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: body.name || '',
    label: body.label || {},
    sortOrder: body.sortOrder ?? 0,
    displaySize: body.displaySize || 'medium',
    createdAt: now,
    updatedAt: now,
  }

  const created = await upsert('sponsor-tiers', tier)
  return c.json(created, 201)
})

/** PUT /api/admin/events/:slug/sponsor-tiers/:id */
admin.put('/api/admin/events/:slug/sponsor-tiers/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const existing = await findById<SponsorTier>('sponsor-tiers', id, slug)
  if (!existing) return c.json({ error: 'Sponsor tier not found' }, 404)

  const body = await c.req.json<Partial<SponsorTier>>()
  const updated: SponsorTier = {
    ...existing,
    ...body,
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }

  const result = await upsert('sponsor-tiers', updated)
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/sponsor-tiers/:id */
admin.delete('/api/admin/events/:slug/sponsor-tiers/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  try {
    await deleteItem('sponsor-tiers', id, slug)
  } catch {
    return c.json({ error: 'Sponsor tier not found' }, 404)
  }
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Floor Maps CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/floor-maps */
admin.get('/api/admin/events/:slug/floor-maps', async (c) => {
  const slug = c.req.param('slug')
  const maps = await findAll<FloorMap>('floor-maps', 'eventSlug', slug)
  return c.json(maps)
})

/** POST /api/admin/events/:slug/floor-maps */
admin.post('/api/admin/events/:slug/floor-maps', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json<Partial<FloorMap>>()
  const now = new Date().toISOString()

  const floorMap: FloorMap = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: body.name || '',
    label: body.label || {},
    imageUrl: body.imageUrl || '',
    sortOrder: body.sortOrder ?? 0,
    hotspots: body.hotspots || [],
    createdAt: now,
    updatedAt: now,
  }

  const created = await upsert('floor-maps', floorMap)
  return c.json(created, 201)
})

/** PUT /api/admin/events/:slug/floor-maps/:id */
admin.put('/api/admin/events/:slug/floor-maps/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const existing = await findById<FloorMap>('floor-maps', id, slug)
  if (!existing) return c.json({ error: 'Floor map not found' }, 404)

  const body = await c.req.json<Partial<FloorMap>>()
  const updated: FloorMap = {
    ...existing,
    ...body,
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }

  const result = await upsert('floor-maps', updated)
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/floor-maps/:id */
admin.delete('/api/admin/events/:slug/floor-maps/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  try {
    await deleteItem('floor-maps', id, slug)
  } catch {
    return c.json({ error: 'Floor map not found' }, 404)
  }
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Event Config
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/config */
admin.get('/api/admin/events/:slug/config', async (c) => {
  const slug = c.req.param('slug')
  const config = await findById<EventConfig>('events', slug, slug)
  if (!config) return c.json({ error: 'Event config not found' }, 404)
  return c.json(config)
})

/** PUT /api/admin/events/:slug/config */
admin.put('/api/admin/events/:slug/config', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json<Partial<EventConfig>>()

  const existing = await findById<EventConfig>('events', slug, slug)
  const now = new Date().toISOString()

  const config: EventConfig = {
    id: slug,
    slug,
    name: body.name ?? existing?.name ?? '',
    apiKey: body.apiKey ?? existing?.apiKey ?? '',
    timezone: body.timezone ?? existing?.timezone ?? 'Europe/Amsterdam',
    startDate: body.startDate ?? existing?.startDate ?? '',
    endDate: body.endDate ?? existing?.endDate ?? '',
    days: body.days ?? existing?.days ?? [],
    languages: body.languages ?? existing?.languages ?? ['en'],
    defaultLanguage: body.defaultLanguage ?? existing?.defaultLanguage ?? 'en',
    branding: body.branding ?? existing?.branding ?? {
      primaryColor: '#0082C8',
      secondaryColor: '#1B2A5B',
      backgroundColor: '#0F1629',
      textColor: '#FFFFFF',
      fontFamily: 'Nunito',
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const result = await upsert('events', config)
  return c.json(result)
})

export default admin
