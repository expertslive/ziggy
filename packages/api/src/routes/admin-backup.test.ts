import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuctionBid, Nomination } from '@ziggy/shared'

let bidStore: AuctionBid[] = []
let nominationStore: Nomination[] = []
let envBackupToken: string | undefined = 'cron-secret-token'

vi.mock('../lib/cosmos.js', () => ({
  ensureAuctionContainer: vi.fn(async () => {}),
  ensureNominationsContainer: vi.fn(async () => {}),
  findActive: vi.fn(async (container: string, _key: string, slug: string) => {
    if (container === 'auction-bids') {
      return bidStore.filter((b) => b.eventSlug === slug)
    }
    if (container === 'nominations') {
      return nominationStore.filter((n) => n.eventSlug === slug && !n.deletedAt)
    }
    return []
  }),
  getContainer: vi.fn(),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    jwtSecret: 'x'.repeat(32),
    storageConnectionString: 'unused-in-tests',
    nodeEnv: 'test',
    backupToken: envBackupToken,
  }),
}))

vi.mock('../lib/auth.js', () => ({
  verifyToken: vi.fn((token: string) => {
    if (token === 'good-token') {
      return {
        sub: 'admin-1',
        email: 'admin@example.com',
        iss: 'ziggy',
        aud: 'ziggy-admin',
        iat: 0,
        exp: 0,
      }
    }
    throw new Error('Invalid token')
  }),
  signToken: vi.fn(),
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}))

vi.mock('../lib/audit.js', () => ({
  writeAudit: vi.fn(async () => {}),
}))

vi.mock('../lib/blob-backup.js', () => ({
  writeBackup: vi.fn(
    async (args: { slug: string; kind: 'bids' | 'nominations'; payload: unknown }) => ({
      url: `https://example.invalid/${args.slug}/${args.kind}.json`,
      sizeBytes: JSON.stringify(args.payload, null, 2).length,
    }),
  ),
}))

import { writeAudit } from '../lib/audit.js'
import { writeBackup } from '../lib/blob-backup.js'
const writeAuditMock = vi.mocked(writeAudit)
const writeBackupMock = vi.mocked(writeBackup)

import adminBackup from './admin-backup.js'

const SLUG = 'test-event'
const URL_PATH = `/api/admin/events/${SLUG}/backup-pii`

function buildApp() {
  return new Hono().route('/', adminBackup)
}

function makeBid(overrides: Partial<AuctionBid> = {}): AuctionBid {
  return {
    id: overrides.id ?? `bid-${Math.random().toString(36).slice(2, 8)}`,
    eventSlug: SLUG,
    shopItemId: 'item-1',
    ts: 1_700_000_000_000,
    amount: 5000,
    name: 'Maarten Goet',
    email: 'maarten@example.com',
    phone: '0612345678',
    displayName: 'Maarten G.',
    ...overrides,
  }
}

function makeNom(overrides: Partial<Nomination> = {}): Nomination {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    eventSlug: SLUG,
    nomineeName: 'Casey Candidate',
    nomineeEmail: 'casey@example.com',
    nomineePhone: '+31 612345678',
    reason: 'Built three open-source tools used across the community.',
    nominatorName: 'Nora Nominator',
    nominatorEmail: 'nora@example.com',
    nominatorPhone: '0612345678',
    consentToShareNomineeName: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    status: 'pending',
    ...overrides,
  }
}

beforeEach(() => {
  bidStore = []
  nominationStore = []
  envBackupToken = 'cron-secret-token'
  writeAuditMock.mockClear()
  writeBackupMock.mockClear()
})

describe('POST /api/admin/events/:slug/backup-pii', () => {
  it('401 when no Authorization header is provided', async () => {
    const app = buildApp()
    const res = await app.request(URL_PATH, { method: 'POST' })
    expect(res.status).toBe(401)
    expect(writeBackupMock).not.toHaveBeenCalled()
    expect(writeAuditMock).not.toHaveBeenCalled()
  })

  it('401 when both JWT and token are invalid', async () => {
    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer not-a-jwt-and-not-the-token' },
    })
    expect(res.status).toBe(401)
    expect(writeBackupMock).not.toHaveBeenCalled()
    expect(writeAuditMock).not.toHaveBeenCalled()
  })

  it('401 via token path when env.backupToken is unset', async () => {
    envBackupToken = undefined
    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret-token' },
    })
    expect(res.status).toBe(401)
  })

  it('200 via valid admin JWT — audit actor is the user email', async () => {
    bidStore.push(makeBid({ id: 'b1' }), makeBid({ id: 'b2' }))
    nominationStore.push(makeNom({ id: 'n1' }))

    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      bids: number
      nominations: number
      blobUrls: { bids: string; nominations: string }
    }
    expect(body.bids).toBe(2)
    expect(body.nominations).toBe(1)
    expect(body.blobUrls.bids).toContain('bids.json')
    expect(body.blobUrls.nominations).toContain('nominations.json')

    expect(writeAuditMock).toHaveBeenCalledTimes(1)
    const auditArg = writeAuditMock.mock.calls[0][0]
    expect(auditArg.actor).toBe('admin@example.com')
    expect(auditArg.target).toBe('pii-backup')
    expect(auditArg.summary).toBe('Backed up 2 bids + 1 nominations')
  })

  it('200 via Bearer <BACKUP_TOKEN> — audit actor is token:cron', async () => {
    bidStore.push(makeBid({ id: 'b1' }))
    nominationStore.push(makeNom({ id: 'n1' }), makeNom({ id: 'n2' }))

    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret-token' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { bids: number; nominations: number }
    expect(body.bids).toBe(1)
    expect(body.nominations).toBe(2)

    const auditArg = writeAuditMock.mock.calls[0][0]
    expect(auditArg.actor).toBe('token:cron')
    expect(auditArg.summary).toBe('Backed up 1 bids + 2 nominations')
  })

  it('writes both blobs exactly once with the correct kind + payload', async () => {
    bidStore.push(makeBid({ id: 'b1', amount: 1234 }))
    nominationStore.push(makeNom({ id: 'n1', nomineeName: 'Pat' }))

    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
    })
    expect(res.status).toBe(200)

    expect(writeBackupMock).toHaveBeenCalledTimes(2)
    const calls = writeBackupMock.mock.calls.map((c) => c[0])
    const bidsCall = calls.find((c) => c.kind === 'bids')
    const nomsCall = calls.find((c) => c.kind === 'nominations')
    expect(bidsCall).toBeDefined()
    expect(nomsCall).toBeDefined()

    expect(bidsCall?.slug).toBe(SLUG)
    expect(Array.isArray(bidsCall?.payload)).toBe(true)
    expect((bidsCall?.payload as AuctionBid[])[0]?.id).toBe('b1')

    expect(nomsCall?.slug).toBe(SLUG)
    expect(Array.isArray(nomsCall?.payload)).toBe(true)
    expect((nomsCall?.payload as Nomination[])[0]?.id).toBe('n1')
  })

  it('counts in response reflect the active Cosmos rows', async () => {
    for (let i = 0; i < 5; i++) bidStore.push(makeBid({ id: `b${i}` }))
    for (let i = 0; i < 3; i++) nominationStore.push(makeNom({ id: `n${i}` }))
    nominationStore.push(
      makeNom({ id: 'n-deleted', deletedAt: '2025-01-02T00:00:00.000Z' }),
    )

    const app = buildApp()
    const res = await app.request(URL_PATH, {
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
    })
    const body = (await res.json()) as { bids: number; nominations: number }
    expect(body.bids).toBe(5)
    expect(body.nominations).toBe(3)
  })
})
