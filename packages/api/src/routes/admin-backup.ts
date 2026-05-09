/** PII backup endpoint.
 *
 * POST /api/admin/events/:slug/backup-pii dumps the active bids and
 * nominations for the slug to Blob Storage. Auth accepts either a valid
 * admin JWT or `Authorization: Bearer <BACKUP_TOKEN>` (constant-time
 * compared) so an unattended cron can call this without a session. */

import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AuctionBid, Nomination } from '@ziggy/shared'
import { verifyToken, type TokenPayload } from '../lib/auth.js'
import {
  ensureAuctionContainer,
  ensureNominationsContainer,
  findActive,
} from '../lib/cosmos.js'
import { writeAudit } from '../lib/audit.js'
import { writeBackup } from '../lib/blob-backup.js'
import { getEnv } from '../env.js'

const adminBackup = new Hono()

type AuthResult =
  | { kind: 'jwt'; actor: string }
  | { kind: 'token' }
  | { kind: 'fail' }

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual requires equal-length buffers; if lengths differ we still
  // run a compare against `a` itself to keep the work constant, then return false.
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

function authenticate(c: Context): AuthResult {
  const header = c.req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) return { kind: 'fail' }
  const provided = header.slice(7)

  const env = getEnv()
  if (env.backupToken && tokenMatches(provided, env.backupToken)) {
    return { kind: 'token' }
  }

  try {
    const payload = verifyToken(provided) as TokenPayload
    return { kind: 'jwt', actor: payload.email || payload.sub || '<admin>' }
  } catch {
    return { kind: 'fail' }
  }
}

adminBackup.post('/api/admin/events/:slug/backup-pii', async (c) => {
  const auth = authenticate(c)
  if (auth.kind === 'fail') {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const slug = c.req.param('slug')

  await Promise.all([ensureAuctionContainer(), ensureNominationsContainer()])

  const [bids, nominations] = await Promise.all([
    findActive<AuctionBid>('auction-bids', 'eventSlug', slug),
    findActive<Nomination>('nominations', 'eventSlug', slug),
  ])

  const [bidsBlob, nomsBlob] = await Promise.all([
    writeBackup({ slug, kind: 'bids', payload: bids }),
    writeBackup({ slug, kind: 'nominations', payload: nominations }),
  ])

  const actor = auth.kind === 'token' ? 'token:cron' : auth.actor
  void writeAudit({
    eventSlug: slug,
    actor,
    action: 'snapshot',
    target: 'pii-backup',
    summary: `Backed up ${bids.length} bids + ${nominations.length} nominations`,
    meta: {
      bids: bids.length,
      nominations: nominations.length,
      bidsSizeBytes: bidsBlob.sizeBytes,
      nominationsSizeBytes: nomsBlob.sizeBytes,
    },
  })

  console.log('[admin-backup] pii backup', {
    eventSlug: slug,
    via: auth.kind,
    bids: bids.length,
    nominations: nominations.length,
  })

  return c.json({
    bids: bids.length,
    nominations: nominations.length,
    blobUrls: {
      bids: bidsBlob.url,
      nominations: nomsBlob.url,
    },
  })
})

export default adminBackup
