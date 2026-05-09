/** Admin CRUD for kiosk metadata: list, create, update, soft-delete. */

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { KioskMeta } from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import {
  ensureKiosksContainer,
  findActive,
  findById,
  upsert,
} from '../lib/cosmos.js'
import { writeAudit } from '../lib/audit.js'
import {
  KioskMetaCreateSchema,
  KioskMetaUpdateSchema,
} from '../schemas/kiosk-meta.js'
import type { TokenPayload } from '../lib/auth.js'

function actorEmail(c: Context): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (c.get as any)('admin') as TokenPayload | undefined
  return payload?.email || '<system>'
}

const adminKiosks = new Hono()

adminKiosks.use('/api/admin/events/:slug/kiosks', requireAuth)
adminKiosks.use('/api/admin/events/:slug/kiosks/*', requireAuth)

/** GET /api/admin/events/:slug/kiosks — active only, sorted by displayName asc. */
adminKiosks.get('/api/admin/events/:slug/kiosks', async (c) => {
  const slug = c.req.param('slug')
  await ensureKiosksContainer()
  const rows = await findActive<KioskMeta>('kiosks', 'eventSlug', slug)
  rows.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
  return c.json(rows)
})

/** POST /api/admin/events/:slug/kiosks — create alias for an existing kioskId. */
adminKiosks.post('/api/admin/events/:slug/kiosks', async (c) => {
  const slug = c.req.param('slug')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = KioskMetaCreateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }

  await ensureKiosksContainer()

  const existing = await findById<KioskMeta>('kiosks', parsed.data.id, slug)
  if (existing && !existing.deletedAt) {
    return c.json({ error: 'Kiosk with this id already exists' }, 409)
  }

  const now = new Date().toISOString()
  const record: KioskMeta = {
    id: parsed.data.id,
    eventSlug: slug,
    displayName: parsed.data.displayName,
    ...(parsed.data.shortCode !== undefined && { shortCode: parsed.data.shortCode }),
    ...(parsed.data.location !== undefined && { location: parsed.data.location }),
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  }

  const result = await upsert<KioskMeta>('kiosks', record)

  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'create',
    target: 'kiosk',
    recordId: record.id,
    summary: `Created kiosk alias ${record.id}`,
  })

  console.log('[admin-kiosks] created', { id: record.id, eventSlug: slug })

  return c.json(result, 201)
})

/** PUT /api/admin/events/:slug/kiosks/:id — partial update. */
adminKiosks.put('/api/admin/events/:slug/kiosks/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = KioskMetaUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }

  await ensureKiosksContainer()
  const existing = await findById<KioskMeta>('kiosks', id, slug)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'Kiosk not found' }, 404)
  }

  const patch = parsed.data
  const updated: KioskMeta = {
    ...existing,
    ...(patch.displayName !== undefined && { displayName: patch.displayName }),
    ...(patch.shortCode !== undefined && { shortCode: patch.shortCode }),
    ...(patch.location !== undefined && { location: patch.location }),
    updatedAt: new Date().toISOString(),
  }

  const result = await upsert<KioskMeta>('kiosks', updated)

  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'kiosk',
    recordId: id,
    summary: `Updated kiosk ${id}`,
    meta: { fields: Object.keys(patch) },
  })

  console.log('[admin-kiosks] updated', { id, eventSlug: slug })

  return c.json(result)
})

/** DELETE /api/admin/events/:slug/kiosks/:id — soft-delete only. */
adminKiosks.delete('/api/admin/events/:slug/kiosks/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  await ensureKiosksContainer()
  const existing = await findById<KioskMeta>('kiosks', id, slug)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'Kiosk not found' }, 404)
  }

  await upsert<KioskMeta>('kiosks', {
    ...existing,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'kiosk',
    recordId: id,
    summary: `Soft-deleted kiosk ${id}`,
  })

  console.log('[admin-kiosks] soft-deleted', { id, eventSlug: slug })

  return c.body(null, 204)
})

export default adminKiosks
