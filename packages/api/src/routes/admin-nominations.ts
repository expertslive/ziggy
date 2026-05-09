/** Admin endpoints for studiebeurs nominations: list, PATCH, soft-delete, CSV. */

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Nomination } from '@ziggy/shared'
import { requireAuth } from '../middleware/auth.js'
import {
  ensureNominationsContainer,
  findActive,
  findById,
  upsert,
} from '../lib/cosmos.js'
import { writeAudit } from '../lib/audit.js'
import { AdminNominationPatchSchema } from '../schemas/nomination.js'
import type { TokenPayload } from '../lib/auth.js'

function actorEmail(c: Context): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (c.get as any)('admin') as TokenPayload | undefined
  return payload?.email || '<system>'
}

const adminNominations = new Hono()

adminNominations.use('/api/admin/events/:slug/nominations', requireAuth)
adminNominations.use('/api/admin/events/:slug/nominations.csv', requireAuth)
adminNominations.use('/api/admin/events/:slug/nominations/*', requireAuth)

async function listActive(slug: string): Promise<Nomination[]> {
  await ensureNominationsContainer()
  const rows = await findActive<Nomination>('nominations', 'eventSlug', slug)
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/** GET /api/admin/events/:slug/nominations?status=&q= */
adminNominations.get('/api/admin/events/:slug/nominations', async (c) => {
  const slug = c.req.param('slug')
  const status = c.req.query('status')
  const q = c.req.query('q')?.trim().toLowerCase()

  let rows = await listActive(slug)

  if (status === 'pending' || status === 'verified' || status === 'rejected') {
    rows = rows.filter((r) => r.status === status)
  }

  if (q) {
    rows = rows.filter(
      (r) =>
        r.nomineeName.toLowerCase().includes(q) ||
        r.nominatorName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q),
    )
  }

  return c.json(rows)
})

/** PATCH /api/admin/events/:slug/nominations/:id */
adminNominations.patch('/api/admin/events/:slug/nominations/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = AdminNominationPatchSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)
  }

  await ensureNominationsContainer()
  const existing = await findById<Nomination>('nominations', id, slug)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'Nomination not found' }, 404)
  }

  const patch = parsed.data
  const updated: Nomination = {
    ...existing,
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.adminNotes !== undefined && { adminNotes: patch.adminNotes }),
  }

  const result = await upsert<Nomination>('nominations', updated)

  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'update',
    target: 'nomination',
    recordId: id,
    summary: `Updated nomination ${id.slice(0, 8)}`,
    meta: {
      fields: Object.keys(patch),
      ...(patch.status !== undefined && { status: patch.status }),
    },
  })

  console.log('[admin-nominations] patched', {
    id,
    eventSlug: slug,
    status: result.status,
  })

  return c.json(result)
})

/** DELETE /api/admin/events/:slug/nominations/:id — soft-delete only. */
adminNominations.delete('/api/admin/events/:slug/nominations/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = c.req.param('id')

  await ensureNominationsContainer()
  const existing = await findById<Nomination>('nominations', id, slug)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'Nomination not found' }, 404)
  }

  await upsert<Nomination>('nominations', {
    ...existing,
    deletedAt: new Date().toISOString(),
  })

  void writeAudit({
    eventSlug: slug,
    actor: actorEmail(c),
    action: 'delete',
    target: 'nomination',
    recordId: id,
    summary: `Soft-deleted nomination ${id.slice(0, 8)}`,
  })

  console.log('[admin-nominations] soft-deleted', { id, eventSlug: slug })

  return c.body(null, 204)
})

// ---------------------------------------------------------------------------
// CSV export — RFC 4180. Wrap in quotes if the field contains a comma,
// double-quote, CR, or LF; double any internal quote.
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'createdAt',
  'status',
  'nomineeName',
  'nomineeEmail',
  'nomineePhone',
  'reason',
  'nominatorName',
  'nominatorEmail',
  'nominatorPhone',
  'consent',
  'adminNotes',
] as const

function csvEscape(value: string | undefined | null | boolean): string {
  if (value === undefined || value === null) return ''
  const s = typeof value === 'boolean' ? (value ? 'true' : 'false') : value
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowToCsv(n: Nomination): string {
  return [
    n.createdAt,
    n.status,
    n.nomineeName,
    n.nomineeEmail,
    n.nomineePhone,
    n.reason,
    n.nominatorName,
    n.nominatorEmail,
    n.nominatorPhone,
    n.consentToShareNomineeName,
    n.adminNotes,
  ]
    .map(csvEscape)
    .join(',')
}

/** GET /api/admin/events/:slug/nominations.csv */
adminNominations.get('/api/admin/events/:slug/nominations.csv', async (c) => {
  const slug = c.req.param('slug')
  const rows = await listActive(slug)

  const header = CSV_COLUMNS.join(',')
  const body = [header, ...rows.map(rowToCsv)].join('\r\n') + '\r\n'

  console.log('[admin-nominations] csv export', { eventSlug: slug, count: rows.length })

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="nominations-${slug}.csv"`,
    },
  })
})

export default adminNominations
