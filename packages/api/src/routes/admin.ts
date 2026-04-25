/** Admin CRUD routes */

import { Hono } from 'hono'
import type { Context } from 'hono'
import type {
  Admin,
  LoginRequest,
  Sponsor,
  SponsorTier,
  FloorMap,
  AdminEventConfig,
  I18nOverrides,
  BoothOverride,
  ShopItem,
} from '@ziggy/shared'
import { DEFAULT_BRANDING } from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import { loginRateLimiter } from '../middleware/rate-limit.js'
import { signToken, hashPassword, comparePassword } from '../lib/auth.js'
import { findAll, findById, upsert, deleteItem, getContainer } from '../lib/cosmos.js'
import { uploadImage } from '../lib/storage.js'
import { detectImageType } from '../lib/magic-bytes.js'
import { getEnv } from '../env.js'
import {
  SponsorSchema,
  SponsorTierSchema,
  FloorMapSchema,
  EventConfigSchema,
  I18nOverridesSchema,
  BoothOverrideSchema,
  ShopItemSchema,
} from '../schemas/admin.js'

function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * The admin zod schemas model i18n records as objects with one optional key
 * per supported language, so the derived `.data` type is
 * `Record<string, string | undefined>`. Our shared types use
 * `Record<string, string>` (omit keys you don't have). Drop undefined values
 * before persisting so the two shapes line up.
 */
function stripUndefined(rec: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

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

  const ip = clientIp(c)
  const emailRaw = (body.email || '').toLowerCase()
  if (!loginRateLimiter.check(ip, emailRaw)) {
    return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
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
    loginRateLimiter.recordFailure(ip, emailRaw)
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await comparePassword(body.password, adminUser.passwordHash)
  if (!valid) {
    loginRateLimiter.recordFailure(ip, emailRaw)
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  loginRateLimiter.recordSuccess(ip, emailRaw)
  const token = signToken(adminUser)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return c.json({ token, expiresAt })
})

/** POST /api/auth/setup — bootstrap first admin (only if zero admins exist) */
admin.post('/api/auth/setup', async (c) => {
  const env = getEnv()
  if (!env.setupToken) {
    return c.json({ error: 'Setup disabled' }, 503)
  }

  const providedToken = c.req.header('X-Setup-Token') || ''
  if (providedToken !== env.setupToken) {
    return c.json({ error: 'Invalid setup token' }, 401)
  }

  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({ query: 'SELECT * FROM c' })
    .fetchAll()

  const body = await c.req.json<LoginRequest>()

  const ip = clientIp(c)
  const emailRaw = (body.email || '').toLowerCase()
  if (!loginRateLimiter.check(ip, emailRaw)) {
    return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
  }

  if (resources.length > 0) {
    // NOTE: do NOT recordFailure here — this is not a brute-force-able path,
    // and counting it would let an attacker DoS the rate-limit bucket even
    // though setup is already safely disabled.
    return c.json({ error: 'Admin already exists. Setup is disabled.' }, 403)
  }

  if (!body.email || !body.password) {
    loginRateLimiter.recordFailure(ip, emailRaw)
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const newAdmin: Admin = {
    id: 'bootstrap',
    email: body.email,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date().toISOString(),
  }

  try {
    await upsert('admins', newAdmin)
  } catch {
    // Race: another request created the bootstrap admin first. Not a
    // brute-force attempt — skip recording.
    return c.json({ error: 'Admin already exists.' }, 409)
  }

  loginRateLimiter.recordSuccess(ip, emailRaw)
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

  const maxSize = 25 * 1024 * 1024
  if (file.size > maxSize) {
    return c.json({ error: 'File too large. Maximum size is 25 MB.' }, 400)
  }

  const buffer = await file.arrayBuffer()
  const detected = detectImageType(buffer)
  if (!detected) {
    return c.json({ error: 'Unsupported file type. Only JPEG, PNG, WebP accepted.' }, 400)
  }

  try {
    const url = await uploadImage(buffer, detected)
    return c.json({ url })
  } catch (err) {
    console.error('[admin/upload] failed:', err instanceof Error ? err.message : err)
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
  const body = await c.req.json()
  const parsed = SponsorSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const data = parsed.data
  const now = new Date().toISOString()

  const sponsor: Sponsor = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: data.name,
    tierId: data.tierId,
    description: stripUndefined(data.description),
    logoUrl: data.logoUrl,
    logoOnDark: data.logoOnDark,
    website: data.website,
    boothNumber: data.boothNumber,
    floorMapHotspotId: data.floorMapHotspotId,
    sortOrder: data.sortOrder,
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

  const body = await c.req.json()
  const parsed = SponsorSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data

  const updated: Sponsor = {
    ...existing,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.tierId !== undefined && { tierId: patch.tierId }),
    ...(patch.logoUrl !== undefined && { logoUrl: patch.logoUrl }),
    ...(patch.logoOnDark !== undefined && { logoOnDark: patch.logoOnDark }),
    ...(patch.website !== undefined && { website: patch.website }),
    ...(patch.boothNumber !== undefined && { boothNumber: patch.boothNumber }),
    ...(patch.floorMapHotspotId !== undefined && {
      floorMapHotspotId: patch.floorMapHotspotId,
    }),
    ...(patch.description !== undefined && {
      description: stripUndefined(patch.description),
    }),
    ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
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
  const body = await c.req.json()
  const parsed = SponsorTierSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const data = parsed.data
  const now = new Date().toISOString()

  const tier: SponsorTier = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: data.name,
    label: stripUndefined(data.label),
    sortOrder: data.sortOrder,
    displaySize: data.displaySize,
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

  const body = await c.req.json()
  const parsed = SponsorTierSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data

  const updated: SponsorTier = {
    ...existing,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.label !== undefined && { label: stripUndefined(patch.label) }),
    ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
    ...(patch.displaySize !== undefined && { displaySize: patch.displaySize }),
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
  const body = await c.req.json()
  const parsed = FloorMapSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const data = parsed.data
  const now = new Date().toISOString()

  const floorMap: FloorMap = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: data.name,
    label: stripUndefined(data.label),
    imageUrl: data.imageUrl,
    sortOrder: data.sortOrder,
    hotspots: data.hotspots.map((h) => ({
      id: h.id,
      roomName: h.roomName,
      ...(h.roomGuid !== undefined && { roomGuid: h.roomGuid }),
      label: stripUndefined(h.label),
      points: h.points,
    })),
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

  const body = await c.req.json()
  const parsed = FloorMapSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data

  const updated: FloorMap = {
    ...existing,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.label !== undefined && { label: stripUndefined(patch.label) }),
    ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
    ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
    ...(patch.hotspots !== undefined && {
      hotspots: patch.hotspots.map((h) => ({
        id: h.id,
        roomName: h.roomName,
        ...(h.roomGuid !== undefined && { roomGuid: h.roomGuid }),
        label: stripUndefined(h.label),
        points: h.points,
      })),
    }),
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
  const config = await findById<AdminEventConfig>('events', slug, slug)
  if (!config) return c.json({ error: 'Event config not found' }, 404)
  return c.json(config)
})

/** PUT /api/admin/events/:slug/config */
admin.put('/api/admin/events/:slug/config', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = EventConfigSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data

  const existing = await findById<AdminEventConfig>('events', slug, slug)
  const now = new Date().toISOString()

  const normalizedDays = patch.days?.map((d) => ({
    date: d.date,
    label: stripUndefined(d.label),
  }))

  const config: AdminEventConfig = {
    id: slug,
    slug,
    name: patch.name ?? existing?.name ?? '',
    timezone: patch.timezone ?? existing?.timezone ?? 'Europe/Amsterdam',
    startDate: patch.startDate ?? existing?.startDate,
    endDate: patch.endDate ?? existing?.endDate,
    days: normalizedDays ?? existing?.days ?? [],
    languages: patch.languages ?? existing?.languages ?? ['en'],
    defaultLanguage: patch.defaultLanguage ?? existing?.defaultLanguage ?? 'en',
    branding: patch.branding ?? existing?.branding ?? DEFAULT_BRANDING,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const result = await upsert('events', config)
  return c.json(result)
})

// ---------------------------------------------------------------------------
// I18n Overrides
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/i18n-overrides */
admin.get('/api/admin/events/:slug/i18n-overrides', async (c) => {
  const slug = c.req.param('slug')
  const overrides = await findAll<I18nOverrides>('i18n-overrides', 'eventSlug', slug)
  return c.json(overrides)
})

/** PUT /api/admin/events/:slug/i18n-overrides/:lang */
admin.put('/api/admin/events/:slug/i18n-overrides/:lang', async (c) => {
  const slug = c.req.param('slug')
  const lang = c.req.param('lang')
  const body = await c.req.json()
  const parsed = I18nOverridesSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const data = parsed.data
  const now = new Date().toISOString()

  // Use a deterministic ID based on slug + language
  const id = `${slug}_${lang}`

  const doc: I18nOverrides = {
    id,
    eventSlug: slug,
    language: lang,
    overrides: data.overrides,
    updatedAt: now,
  }

  const result = await upsert('i18n-overrides', doc)
  return c.json(result)
})

// ---------------------------------------------------------------------------
// Booth overrides (kiosk-local booth metadata — e.g. floor-map hotspot link)
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/booth-overrides */
admin.get('/api/admin/events/:slug/booth-overrides', async (c) => {
  const slug = c.req.param('slug')
  const items = await findAll<BoothOverride>('booth-overrides', 'eventSlug', slug)
  return c.json(items)
})

/** PUT /api/admin/events/:slug/booth-overrides/:boothId */
admin.put('/api/admin/events/:slug/booth-overrides/:boothId', async (c) => {
  const slug = c.req.param('slug')
  const boothId = c.req.param('boothId')
  const body = await c.req.json()
  const parsed = BoothOverrideSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const now = new Date().toISOString()
  const doc: BoothOverride = {
    id: `${slug}:${boothId}`,
    eventSlug: slug,
    boothId,
    floorMapHotspotId: parsed.data.floorMapHotspotId,
    updatedAt: now,
  }
  const result = await upsert('booth-overrides', doc)
  return c.json(result)
})

// ---------------------------------------------------------------------------
// Shop Items CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/shop-items */
admin.get('/api/admin/events/:slug/shop-items', async (c) => {
  const slug = c.req.param('slug')
  const items = await findAll<ShopItem>('shop-items', 'eventSlug', slug)
  return c.json(items)
})

/** POST /api/admin/events/:slug/shop-items */
admin.post('/api/admin/events/:slug/shop-items', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = ShopItemSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const data = parsed.data
  const now = new Date().toISOString()
  const item: ShopItem = {
    id: crypto.randomUUID(),
    eventSlug: slug,
    name: data.name,
    description: stripUndefined(data.description),
    imageUrl: data.imageUrl,
    priceLabel: data.priceLabel,
    isHighlighted: data.isHighlighted,
    sortOrder: data.sortOrder,
    createdAt: now,
    updatedAt: now,
  }
  const created = await upsert('shop-items', item)
  return c.json(created, 201)
})

/** PUT /api/admin/events/:slug/shop-items/:id */
admin.put('/api/admin/events/:slug/shop-items/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const existing = await findById<ShopItem>('shop-items', id, slug)
  if (!existing) return c.json({ error: 'Shop item not found' }, 404)

  const body = await c.req.json()
  const parsed = ShopItemSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }
  const patch = parsed.data
  const updated: ShopItem = {
    ...existing,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.description !== undefined && {
      description: stripUndefined(patch.description),
    }),
    ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
    ...(patch.priceLabel !== undefined && { priceLabel: patch.priceLabel }),
    ...(patch.isHighlighted !== undefined && { isHighlighted: patch.isHighlighted }),
    ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }
  const result = await upsert('shop-items', updated)
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/shop-items/:id */
admin.delete('/api/admin/events/:slug/shop-items/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  try {
    await deleteItem('shop-items', id, slug)
  } catch {
    return c.json({ error: 'Shop item not found' }, 404)
  }
  return c.json({ ok: true })
})

export default admin
