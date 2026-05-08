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
import {
  findAll,
  findActive,
  findDeleted,
  findById,
  upsert,
  deleteItem,
  getContainer,
} from '../lib/cosmos.js'
import { uploadImage } from '../lib/storage.js'
import { detectImageType } from '../lib/magic-bytes.js'
import * as runEvents from '../lib/run-events.js'
import * as cache from '../lib/cache.js'
import { writeAudit, recentAudit } from '../lib/audit.js'
import {
  takeSnapshot,
  listSnapshots,
  readSnapshot,
  restoreSnapshot,
  deleteSnapshot,
} from '../lib/snapshots.js'
import { getEnv } from '../env.js'
import type { TokenPayload } from '../lib/auth.js'
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

/** Pull the authenticated admin's full token payload from the request.
 * Hono's stricter typing on route handlers rejects `c.get('admin')` with
 * an arbitrary key, so we centralize the cast here. Returns undefined for
 * routes that don't run under requireAuth. */
function currentAdmin(c: Context): TokenPayload | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c.get as any)('admin') as TokenPayload | undefined
}

/** Pull the authenticated admin's email from the request. Routes mounted
 * under requireAuth always have this; for routes that don't (login/setup
 * fall back to the supplied email or '<system>'). */
function actorEmail(c: Context, fallback = '<system>'): string {
  return currentAdmin(c)?.email || fallback
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
    void writeAudit({
      eventSlug: getEnv().eventSlug,
      actor: emailRaw,
      action: 'login-failed',
      target: 'admin',
      summary: `Login failed (no such account) from ${ip}`,
    })
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  if (adminUser.disabled) {
    loginRateLimiter.recordFailure(ip, emailRaw)
    void writeAudit({
      eventSlug: getEnv().eventSlug,
      actor: emailRaw,
      action: 'login-failed',
      target: 'admin',
      recordId: adminUser.id,
      summary: `Login refused (account disabled) from ${ip}`,
    })
    return c.json({ error: 'Account disabled — contact an admin.' }, 403)
  }

  const valid = await comparePassword(body.password, adminUser.passwordHash)
  if (!valid) {
    loginRateLimiter.recordFailure(ip, emailRaw)
    void writeAudit({
      eventSlug: getEnv().eventSlug,
      actor: emailRaw,
      action: 'login-failed',
      target: 'admin',
      summary: `Login failed (bad password) from ${ip}`,
    })
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  loginRateLimiter.recordSuccess(ip, emailRaw)
  // Stamp last-login (don't await — non-critical to the response).
  adminUser.lastLoginAt = new Date().toISOString()
  void upsert('admins', adminUser).catch(() => {})

  const token = signToken(adminUser)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: adminUser.email,
    action: 'login',
    target: 'admin',
    recordId: adminUser.id,
    summary: `Logged in from ${ip}`,
  })

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
  const sponsors = await findActive<Sponsor>('sponsors', 'eventSlug', slug)
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'create',
    target: 'sponsor',
    recordId: created.id,
    summary: `Created sponsor "${data.name}"`,
  })
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'sponsor',
    recordId: id,
    summary: `Updated sponsor "${updated.name}"`,
    meta: { fields: Object.keys(patch) },
  })
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/sponsors/:id — soft delete by default.
 * Pass ?hard=true to permanently remove (used by the trash page). */
admin.delete('/api/admin/events/:slug/sponsors/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const hard = c.req.query('hard') === 'true'
  const existing = await findById<Sponsor>('sponsors', id, slug)
  if (!existing) return c.json({ error: 'Sponsor not found' }, 404)

  if (hard) {
    try {
      await deleteItem('sponsors', id, slug)
    } catch {
      return c.json({ error: 'Sponsor not found' }, 404)
    }
  } else {
    await upsert('sponsors', { ...existing, deletedAt: new Date().toISOString() })
  }
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'sponsor',
    recordId: id,
    summary: `${hard ? 'Permanently deleted' : 'Soft-deleted'} sponsor "${existing.name}"`,
  })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Sponsor Tiers CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/sponsor-tiers */
admin.get('/api/admin/events/:slug/sponsor-tiers', async (c) => {
  const slug = c.req.param('slug')
  const tiers = await findActive<SponsorTier>('sponsor-tiers', 'eventSlug', slug)
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'create',
    target: 'sponsor-tier',
    recordId: created.id,
    summary: `Created sponsor tier "${data.name}"`,
  })
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'sponsor-tier',
    recordId: id,
    summary: `Updated sponsor tier "${updated.name}"`,
    meta: { fields: Object.keys(patch) },
  })
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/sponsor-tiers/:id — soft by default. */
admin.delete('/api/admin/events/:slug/sponsor-tiers/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const hard = c.req.query('hard') === 'true'
  const existing = await findById<SponsorTier>('sponsor-tiers', id, slug)
  if (!existing) return c.json({ error: 'Sponsor tier not found' }, 404)

  if (hard) {
    try {
      await deleteItem('sponsor-tiers', id, slug)
    } catch {
      return c.json({ error: 'Sponsor tier not found' }, 404)
    }
  } else {
    await upsert('sponsor-tiers', { ...existing, deletedAt: new Date().toISOString() })
  }
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'sponsor-tier',
    recordId: id,
    summary: `${hard ? 'Permanently deleted' : 'Soft-deleted'} sponsor tier "${existing.name}"`,
  })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Floor Maps CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/floor-maps — active only */
admin.get('/api/admin/events/:slug/floor-maps', async (c) => {
  const slug = c.req.param('slug')
  const maps = await findActive<FloorMap>('floor-maps', 'eventSlug', slug)
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
      ...(h.roomGuids !== undefined && { roomGuids: h.roomGuids }),
      label: stripUndefined(h.label),
      points: h.points,
    })),
    createdAt: now,
    updatedAt: now,
  }

  const created = await upsert('floor-maps', floorMap)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'create',
    target: 'floor-map',
    recordId: created.id,
    summary: `Created floor map "${data.name}" (${floorMap.hotspots.length} hotspots)`,
  })
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

  // Auto-snapshot before any floor-map PUT that touches hotspots — the
  // shape that hurt us last time. Cheap insurance: ~100 KB, ~1 second.
  if (patch.hotspots !== undefined) {
    try {
      await takeSnapshot({
        eventSlug: slug,
        capturedBy: actorEmail(c),
        reason: `auto-pre-floor-map-put-${id.slice(0, 8)}`,
      })
    } catch (err) {
      // Snapshot failure should never block the actual mutation — log and continue.
      console.warn('[snapshots] auto pre-PUT snapshot failed', err)
    }
  }

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
        ...(h.roomGuids !== undefined && { roomGuids: h.roomGuids }),
        label: stripUndefined(h.label),
        points: h.points,
      })),
    }),
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }

  const result = await upsert('floor-maps', updated)
  // Hotspot diff is the most-watched signal here — flag big swings so the
  // audit feed makes "you replaced the whole map" obvious at a glance.
  const beforeCount = existing.hotspots?.length ?? 0
  const afterCount = updated.hotspots.length
  const fields = Object.keys(patch)
  const summary =
    patch.hotspots !== undefined
      ? `Updated floor map "${updated.name}" — hotspots: ${beforeCount} → ${afterCount}`
      : `Updated floor map "${updated.name}"`
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'floor-map',
    recordId: id,
    summary,
    meta: { fields, beforeCount, afterCount },
  })
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/floor-maps/:id — soft by default. */
admin.delete('/api/admin/events/:slug/floor-maps/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const hard = c.req.query('hard') === 'true'
  const existing = await findById<FloorMap>('floor-maps', id, slug)
  if (!existing) return c.json({ error: 'Floor map not found' }, 404)

  if (hard) {
    try {
      await deleteItem('floor-maps', id, slug)
    } catch {
      return c.json({ error: 'Floor map not found' }, 404)
    }
  } else {
    await upsert('floor-maps', { ...existing, deletedAt: new Date().toISOString() })
  }
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'floor-map',
    recordId: id,
    summary: `${hard ? 'Permanently deleted' : 'Soft-deleted'} floor map "${existing.name}"`,
  })
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'event-config',
    recordId: slug,
    summary: `Updated event config`,
    meta: { fields: Object.keys(patch) },
  })
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'i18n-overrides',
    recordId: id,
    summary: `Updated ${lang} translation overrides (${Object.keys(data.overrides).length} keys)`,
  })
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
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'booth-override',
    recordId: doc.id,
    summary: `Set booth ${boothId} → hotspot ${parsed.data.floorMapHotspotId ?? '(none)'}`,
  })
  return c.json(result)
})

// ---------------------------------------------------------------------------
// Shop Items CRUD
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/shop-items */
admin.get('/api/admin/events/:slug/shop-items', async (c) => {
  const slug = c.req.param('slug')
  const items = await findActive<ShopItem>('shop-items', 'eventSlug', slug)
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
    ...(data.galleryUrls !== undefined && { galleryUrls: data.galleryUrls }),
    priceLabel: data.priceLabel,
    isHighlighted: data.isHighlighted,
    sortOrder: data.sortOrder,
    createdAt: now,
    updatedAt: now,
  }
  const created = await upsert('shop-items', item)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'create',
    target: 'shop-item',
    recordId: created.id,
    summary: `Created shop item "${data.name || created.id}"`,
  })
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
    ...(patch.galleryUrls !== undefined && { galleryUrls: patch.galleryUrls }),
    ...(patch.priceLabel !== undefined && { priceLabel: patch.priceLabel }),
    ...(patch.isHighlighted !== undefined && { isHighlighted: patch.isHighlighted }),
    ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
    id,
    eventSlug: slug,
    updatedAt: new Date().toISOString(),
  }
  const result = await upsert('shop-items', updated)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'shop-item',
    recordId: id,
    summary: `Updated shop item "${updated.name || id}"`,
    meta: { fields: Object.keys(patch) },
  })
  return c.json(result)
})

/** DELETE /api/admin/events/:slug/shop-items/:id — soft by default. */
admin.delete('/api/admin/events/:slug/shop-items/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')
  const hard = c.req.query('hard') === 'true'
  const existing = await findById<ShopItem>('shop-items', id, slug)
  if (!existing) return c.json({ error: 'Shop item not found' }, 404)

  if (hard) {
    try {
      await deleteItem('shop-items', id, slug)
    } catch {
      return c.json({ error: 'Shop item not found' }, 404)
    }
  } else {
    await upsert('shop-items', { ...existing, deletedAt: new Date().toISOString() })
  }
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'shop-item',
    recordId: id,
    summary: `${hard ? 'Permanently deleted' : 'Soft-deleted'} shop item "${existing.name}"`,
  })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Trash (soft-deleted records)
// ---------------------------------------------------------------------------

const TRASH_TARGETS = {
  sponsors: { container: 'sponsors', auditTarget: 'sponsor' as const },
  'sponsor-tiers': { container: 'sponsor-tiers', auditTarget: 'sponsor-tier' as const },
  'floor-maps': { container: 'floor-maps', auditTarget: 'floor-map' as const },
  'shop-items': { container: 'shop-items', auditTarget: 'shop-item' as const },
} as const

type TrashKey = keyof typeof TRASH_TARGETS

/** GET /api/admin/events/:slug/trash — every soft-deleted record per type. */
admin.get('/api/admin/events/:slug/trash', async (c) => {
  const slug = c.req.param('slug')
  const [sponsors, tiers, floorMaps, shopItems] = await Promise.all([
    findDeleted<Sponsor>('sponsors', 'eventSlug', slug),
    findDeleted<SponsorTier>('sponsor-tiers', 'eventSlug', slug),
    findDeleted<FloorMap>('floor-maps', 'eventSlug', slug),
    findDeleted<ShopItem>('shop-items', 'eventSlug', slug),
  ])
  return c.json({
    sponsors,
    'sponsor-tiers': tiers,
    'floor-maps': floorMaps,
    'shop-items': shopItems,
  })
})

/** POST /api/admin/events/:slug/trash/:target/:id/restore — clears deletedAt. */
admin.post('/api/admin/events/:slug/trash/:target/:id/restore', async (c) => {
  const slug = c.req.param('slug')
  const target = c.req.param('target') as TrashKey
  const id = c.req.param('id')
  const cfg = TRASH_TARGETS[target]
  if (!cfg) return c.json({ error: 'Unknown trash target' }, 400)

  const existing = await findById<{ id: string; deletedAt?: string; name?: string }>(
    cfg.container,
    id,
    slug,
  )
  if (!existing) return c.json({ error: 'Not found' }, 404)
  // Cosmos has no "delete property" — write back without it.
  const { deletedAt: _ignored, ...rest } = existing
  await upsert(cfg.container, rest)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'restore',
    target: cfg.auditTarget,
    recordId: id,
    summary: `Restored ${cfg.auditTarget} "${existing.name ?? id}"`,
  })
  return c.json({ ok: true })
})

/** DELETE /api/admin/events/:slug/trash/:target/:id — hard remove. */
admin.delete('/api/admin/events/:slug/trash/:target/:id', async (c) => {
  const slug = c.req.param('slug')
  const target = c.req.param('target') as TrashKey
  const id = c.req.param('id')
  const cfg = TRASH_TARGETS[target]
  if (!cfg) return c.json({ error: 'Unknown trash target' }, 400)
  const existing = await findById<{ id: string; name?: string }>(cfg.container, id, slug)
  try {
    await deleteItem(cfg.container, id, slug)
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: cfg.auditTarget,
    recordId: id,
    summary: `Permanently deleted ${cfg.auditTarget} "${existing?.name ?? id}" from trash`,
  })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Audit log feed (read-only)
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/audit-log?limit=50 */
admin.get('/api/admin/events/:slug/audit-log', async (c) => {
  const slug = c.req.param('slug')
  const raw = c.req.query('limit')
  const limit = Math.min(Math.max(parseInt(raw || '50', 10) || 50, 1), 500)
  const entries = await recentAudit(slug, limit)
  return c.json(entries)
})

// ---------------------------------------------------------------------------
// Snapshots (Cosmos JSON dumps in Blob Storage)
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/snapshots — list all snapshots, newest first. */
admin.get('/api/admin/events/:slug/snapshots', async (c) => {
  const slug = c.req.param('slug')
  const items = await listSnapshots(slug)
  return c.json(items)
})

/** POST /api/admin/events/:slug/snapshots — take a new snapshot now.
 * Body: { reason?: string }. */
admin.post('/api/admin/events/:slug/snapshots', async (c) => {
  const slug = c.req.param('slug')
  let reason: string | undefined
  try {
    const body = (await c.req.json()) as { reason?: string }
    reason = body?.reason
  } catch {
    // empty body is fine
  }
  const meta = await takeSnapshot({
    eventSlug: slug,
    capturedBy: actorEmail(c),
    reason,
  })
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'snapshot',
    target: 'snapshot',
    recordId: meta.name,
    summary: `Took snapshot${reason ? ` (${reason})` : ''}`,
    meta: { sizeBytes: meta.sizeBytes },
  })
  return c.json(meta, 201)
})

/** GET /api/admin/events/:slug/snapshots/:name — download a single snapshot.
 * `:name` is URL-encoded (contains slashes). */
admin.get('/api/admin/events/:slug/snapshots/:name{.+}', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))
  const payload = await readSnapshot(name)
  return c.json(payload)
})

/** POST /api/admin/events/:slug/snapshots/:name/restore — replay snapshot
 * upserts back into Cosmos. Auto-snapshots first as a safety net. */
admin.post('/api/admin/events/:slug/snapshots/:name{.+}/restore', async (c) => {
  const slug = c.req.param('slug')
  const name = decodeURIComponent(c.req.param('name'))
  // Take a pre-restore snapshot so the user can roll back if the chosen
  // snapshot turns out to be wrong.
  let preMeta
  try {
    preMeta = await takeSnapshot({
      eventSlug: slug,
      capturedBy: actorEmail(c),
      reason: `auto-pre-restore`,
    })
  } catch (err) {
    return c.json({ error: 'Could not take pre-restore snapshot', detail: String(err) }, 500)
  }
  const result = await restoreSnapshot(name)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'restore-snapshot',
    target: 'snapshot',
    recordId: name,
    summary: `Restored from snapshot ${name.split('/').pop()}`,
    meta: { restored: result.restored, preRestoreSnapshot: preMeta.name },
  })
  return c.json({ ...result, preRestoreSnapshot: preMeta.name })
})

/** DELETE /api/admin/events/:slug/snapshots/:name — remove a snapshot blob. */
admin.delete('/api/admin/events/:slug/snapshots/:name{.+}', async (c) => {
  const slug = c.req.param('slug')
  const name = decodeURIComponent(c.req.param('name'))
  await deleteSnapshot(name)
  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'snapshot',
    recordId: name,
    summary: `Deleted snapshot ${name.split('/').pop()}`,
  })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Cache status + manual refresh — for the dashboard "sync health" card.
// ---------------------------------------------------------------------------

/** GET /api/admin/cache — returns live cache entries with expiry. */
admin.get('/api/admin/cache', async (c) => {
  return c.json({ now: Date.now(), entries: cache.status() })
})

/** POST /api/admin/cache/refresh — nukes the in-memory cache. Next request
 * for any cached key will hit run.events. Used when admins suspect stale
 * data and don't want to wait for the 5-min TTL. */
admin.post('/api/admin/cache/refresh', async (c) => {
  const before = cache.status().length
  cache.clear()
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: actorEmail(c),
    action: 'update',
    target: 'event-config',
    summary: `Cleared run.events cache (${before} entries)`,
  })
  return c.json({ ok: true, cleared: before })
})

// ---------------------------------------------------------------------------
// Pre-event readiness — derived snapshot of what's missing/incomplete.
// ---------------------------------------------------------------------------

/** GET /api/admin/events/:slug/readiness — checklist powering the dashboard.
 *
 * Each check returns { id, label, status: 'ok'|'warn'|'fail', detail }.
 * Failures are blockers (no sponsors at all); warnings are common gaps that
 * don't crash anything (one sponsor missing a logo). */
admin.get('/api/admin/events/:slug/readiness', async (c) => {
  const slug = c.req.param('slug')
  type Check = {
    id: string
    label: string
    status: 'ok' | 'warn' | 'fail'
    detail: string
  }
  const checks: Check[] = []

  const [sponsors, tiers, floorMaps, shopItems, eventConfig, i18n] =
    await Promise.all([
      findActive<Sponsor>('sponsors', 'eventSlug', slug),
      findActive<SponsorTier>('sponsor-tiers', 'eventSlug', slug),
      findActive<FloorMap>('floor-maps', 'eventSlug', slug),
      findActive<ShopItem>('shop-items', 'eventSlug', slug),
      findById<AdminEventConfig>('events', slug, slug),
      findAll<I18nOverrides>('i18n-overrides', 'eventSlug', slug),
    ])

  checks.push({
    id: 'event-config',
    label: 'Event config',
    status: eventConfig ? 'ok' : 'fail',
    detail: eventConfig ? `Set: ${eventConfig.name}` : 'Missing — kiosk has no event metadata',
  })

  checks.push({
    id: 'sponsors-count',
    label: 'Sponsors',
    status: sponsors.length === 0 ? 'fail' : sponsors.length < 5 ? 'warn' : 'ok',
    detail: `${sponsors.length} sponsors`,
  })

  const missingTier = sponsors.filter((s) => !tiers.find((t) => t.id === s.tierId))
  if (missingTier.length > 0) {
    checks.push({
      id: 'sponsor-tier-link',
      label: 'Sponsor tier links',
      status: 'fail',
      detail: `${missingTier.length} sponsor(s) reference an unknown tier`,
    })
  }

  const noLogo = sponsors.filter((s) => !s.logoUrl)
  if (noLogo.length > 0) {
    checks.push({
      id: 'sponsor-logos',
      label: 'Sponsor logos',
      status: 'warn',
      detail: `${noLogo.length} sponsor(s) without a logo`,
    })
  }

  checks.push({
    id: 'floor-maps',
    label: 'Floor maps',
    status: floorMaps.length === 0 ? 'fail' : 'ok',
    detail: `${floorMaps.length} map(s), ${floorMaps.reduce(
      (s, m) => s + (m.hotspots?.length ?? 0),
      0,
    )} hotspots total`,
  })

  const orphanedSponsors = sponsors.filter(
    (s) =>
      s.floorMapHotspotId &&
      !floorMaps.some((m) =>
        m.hotspots.some((h) => h.id === s.floorMapHotspotId),
      ),
  )
  if (orphanedSponsors.length > 0) {
    checks.push({
      id: 'sponsor-hotspot-links',
      label: 'Sponsor → hotspot links',
      status: 'warn',
      detail: `${orphanedSponsors.length} sponsor(s) point at a hotspot that no longer exists`,
    })
  }

  checks.push({
    id: 'shop-items',
    label: 'Shop items',
    status: shopItems.length === 0 ? 'warn' : 'ok',
    detail: `${shopItems.length} item(s)`,
  })

  // i18n coverage: count records that lack a description in any supported lang
  const langs = ['nl', 'en', 'de', 'fr']
  const sponsorMissing = sponsors.filter((s) =>
    langs.some((l) => !s.description || !s.description[l]),
  )
  if (sponsorMissing.length > 0) {
    checks.push({
      id: 'sponsor-i18n',
      label: 'Sponsor translations',
      status: 'warn',
      detail: `${sponsorMissing.length} sponsor(s) missing one or more languages`,
    })
  }
  const shopMissing = shopItems.filter((s) =>
    langs.some((l) => !s.description || !s.description[l]),
  )
  if (shopMissing.length > 0) {
    checks.push({
      id: 'shop-i18n',
      label: 'Shop item translations',
      status: 'warn',
      detail: `${shopMissing.length} shop item(s) missing one or more languages`,
    })
  }

  return c.json({
    checks,
    i18nOverrideCount: i18n.length,
  })
})

// ---------------------------------------------------------------------------
// Rooms (read-only) — feeds the hotspot editor's roomGuid picker so admins
// don't have to copy GUIDs by hand.
// ---------------------------------------------------------------------------

interface RoomEntry {
  guid: string
  name: string
  /** Number of agenda sessions referencing this room. */
  sessionCount: number
}

/** GET /api/admin/events/:slug/rooms */
admin.get('/api/admin/events/:slug/rooms', async (c) => {
  const slug = c.req.param('slug')
  let rooms: RoomEntry[] = []
  try {
    const env = getEnv()
    const items = await runEvents.fetchRawAgenda(slug, env.runEventsApiKey)
    const map = new Map<string, RoomEntry>()
    for (const it of items as Array<{ roomGuid?: string; roomName?: string }>) {
      const guid = it.roomGuid
      if (!guid) continue
      const existing = map.get(guid)
      if (existing) {
        existing.sessionCount += 1
      } else {
        map.set(guid, {
          guid,
          name: it.roomName || guid,
          sessionCount: 1,
        })
      }
    }
    rooms = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.warn('[rooms] fetch failed', err)
  }
  return c.json(rooms)
})

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

interface PublicAdmin {
  id: string
  email: string
  displayName?: string
  lastLoginAt?: string
  disabled?: boolean
  createdAt: string
}

function toPublicAdmin(a: Admin): PublicAdmin {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    lastLoginAt: a.lastLoginAt,
    disabled: a.disabled,
    createdAt: a.createdAt,
  }
}

async function findAdminByEmail(email: string): Promise<Admin | undefined> {
  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({
      query: 'SELECT * FROM c WHERE c.email = @e',
      parameters: [{ name: '@e', value: email }],
    })
    .fetchAll()
  return resources[0]
}

async function findAdminById(id: string): Promise<Admin | undefined> {
  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }],
    })
    .fetchAll()
  return resources[0]
}

async function listAllAdmins(): Promise<Admin[]> {
  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({ query: 'SELECT * FROM c' })
    .fetchAll()
  return resources
}

async function countEnabledAdmins(): Promise<number> {
  const all = await listAllAdmins()
  return all.filter((a) => !a.disabled).length
}

/** GET /api/admin/me — current admin's own profile. */
admin.get('/api/admin/me', async (c) => {
  const payload = currentAdmin(c)!
  const me = await findAdminByEmail(payload.email)
  if (!me) return c.json({ error: 'Account no longer exists' }, 404)
  return c.json(toPublicAdmin(me))
})

/** PUT /api/admin/me — update own displayName. */
admin.put('/api/admin/me', async (c) => {
  const payload = currentAdmin(c)!
  const me = await findAdminByEmail(payload.email)
  if (!me) return c.json({ error: 'Account no longer exists' }, 404)
  const body = (await c.req.json()) as { displayName?: string }
  if (body.displayName !== undefined && body.displayName.length > 100) {
    return c.json({ error: 'displayName too long' }, 400)
  }
  const updated: Admin = {
    ...me,
    displayName: body.displayName,
    updatedAt: new Date().toISOString(),
  }
  await upsert('admins', updated)
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: payload.email,
    action: 'update',
    target: 'admin',
    recordId: me.id,
    summary: `Updated own profile`,
  })
  return c.json(toPublicAdmin(updated))
})

/** POST /api/admin/me/password — change own password. Requires current pw. */
admin.post('/api/admin/me/password', async (c) => {
  const payload = currentAdmin(c)!
  const me = await findAdminByEmail(payload.email)
  if (!me) return c.json({ error: 'Account no longer exists' }, 404)
  const body = (await c.req.json()) as {
    currentPassword?: string
    newPassword?: string
  }
  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: 'currentPassword and newPassword required' }, 400)
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters' }, 400)
  }
  const ok = await comparePassword(body.currentPassword, me.passwordHash)
  if (!ok) return c.json({ error: 'Current password is incorrect' }, 401)

  const updated: Admin = {
    ...me,
    passwordHash: await hashPassword(body.newPassword),
    updatedAt: new Date().toISOString(),
  }
  await upsert('admins', updated)
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: payload.email,
    action: 'password-change',
    target: 'admin',
    recordId: me.id,
    summary: `Changed own password`,
  })
  return c.json({ ok: true })
})

/** GET /api/admin/users — list all admin accounts. */
admin.get('/api/admin/users', async (c) => {
  const all = await listAllAdmins()
  return c.json(all.map(toPublicAdmin))
})

/** POST /api/admin/users — create another admin. */
admin.post('/api/admin/users', async (c) => {
  const body = (await c.req.json()) as {
    email?: string
    displayName?: string
    password?: string
  }
  if (!body.email || !body.password) {
    return c.json({ error: 'email and password required' }, 400)
  }
  if (body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }
  const existing = await findAdminByEmail(body.email.toLowerCase())
  if (existing) return c.json({ error: 'An admin with this email already exists' }, 409)

  const newAdmin: Admin = {
    id: crypto.randomUUID(),
    email: body.email.toLowerCase(),
    displayName: body.displayName,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date().toISOString(),
  }
  await upsert('admins', newAdmin)
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: actorEmail(c),
    action: 'create',
    target: 'admin',
    recordId: newAdmin.id,
    summary: `Created admin account ${newAdmin.email}`,
  })
  return c.json(toPublicAdmin(newAdmin), 201)
})

/** PUT /api/admin/users/:id — update displayName/disabled on another admin. */
admin.put('/api/admin/users/:id', async (c) => {
  const id = c.req.param('id')
  const target = await findAdminById(id)
  if (!target) return c.json({ error: 'Admin not found' }, 404)
  const body = (await c.req.json()) as { displayName?: string; disabled?: boolean }

  // Block self-disable + last-enabled-admin lockout.
  const me = currentAdmin(c)!
  if (body.disabled === true) {
    if (target.email === me.email) {
      return c.json({ error: "You can't disable your own account" }, 400)
    }
    const enabledCount = await countEnabledAdmins()
    if (enabledCount <= 1 && !target.disabled) {
      return c.json({ error: "Can't disable the last enabled admin" }, 400)
    }
  }

  const updated: Admin = {
    ...target,
    displayName:
      body.displayName !== undefined ? body.displayName : target.displayName,
    disabled: body.disabled !== undefined ? body.disabled : target.disabled,
    updatedAt: new Date().toISOString(),
  }
  await upsert('admins', updated)
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: actorEmail(c),
    action: 'update',
    target: 'admin',
    recordId: id,
    summary: `Updated admin ${target.email}`,
    meta: { fields: Object.keys(body) },
  })
  return c.json(toPublicAdmin(updated))
})

/** POST /api/admin/users/:id/reset-password — set a new password for another admin. */
admin.post('/api/admin/users/:id/reset-password', async (c) => {
  const id = c.req.param('id')
  const target = await findAdminById(id)
  if (!target) return c.json({ error: 'Admin not found' }, 404)
  const body = (await c.req.json()) as { newPassword?: string }
  if (!body.newPassword || body.newPassword.length < 8) {
    return c.json({ error: 'newPassword must be at least 8 characters' }, 400)
  }
  const updated: Admin = {
    ...target,
    passwordHash: await hashPassword(body.newPassword),
    updatedAt: new Date().toISOString(),
  }
  await upsert('admins', updated)
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: actorEmail(c),
    action: 'password-change',
    target: 'admin',
    recordId: id,
    summary: `Reset password for ${target.email}`,
  })
  return c.json({ ok: true })
})

/** DELETE /api/admin/users/:id — hard-delete another admin. */
admin.delete('/api/admin/users/:id', async (c) => {
  const id = c.req.param('id')
  const target = await findAdminById(id)
  if (!target) return c.json({ error: 'Admin not found' }, 404)
  const me = currentAdmin(c)!
  if (target.email === me.email) {
    return c.json({ error: "You can't delete your own account" }, 400)
  }
  const enabledCount = await countEnabledAdmins()
  if (enabledCount <= 1 && !target.disabled) {
    return c.json({ error: "Can't delete the last enabled admin" }, 400)
  }

  try {
    await deleteItem('admins', id, target.email)
  } catch {
    return c.json({ error: 'Admin not found' }, 404)
  }
  void writeAudit({
    eventSlug: getEnv().eventSlug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'admin',
    recordId: id,
    summary: `Deleted admin account ${target.email}`,
  })
  return c.json({ ok: true })
})

export default admin
