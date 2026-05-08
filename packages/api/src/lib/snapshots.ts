/** Cosmos snapshot helpers — store full-event JSON dumps in Blob Storage.
 *
 * Each snapshot is a single .json blob that contains every admin-managed
 * Cosmos container for the event. This sits next to the Cosmos periodic
 * backup as a self-service "oh-shit" lifeline that admins can list and
 * restore from in seconds without a Microsoft support ticket. */

import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'
import { getEnv } from '../env.js'
import { findAll, findById, upsert } from './cosmos.js'
import type {
  AdminEventConfig,
  BoothOverride,
  FloorMap,
  I18nOverrides,
  ShopItem,
  Sponsor,
  SponsorTier,
} from '@ziggy/shared'

const CONTAINER = 'snapshots'

let _client: BlobServiceClient | null = null
function client(): BlobServiceClient {
  if (_client) return _client
  const env = getEnv()
  if (!env.storageConnectionString) {
    throw new Error('STORAGE_CONNECTION_STRING is not set')
  }
  _client = BlobServiceClient.fromConnectionString(env.storageConnectionString)
  return _client
}

let _container: ContainerClient | null = null
let _containerEnsured = false
async function container(): Promise<ContainerClient> {
  if (_container && _containerEnsured) return _container
  _container = client().getContainerClient(CONTAINER)
  if (!_containerEnsured) {
    // Private — admin-only data. No public access.
    await _container.createIfNotExists({ access: undefined })
    _containerEnsured = true
  }
  return _container
}

export interface SnapshotPayload {
  eventSlug: string
  capturedAt: string
  capturedBy: string
  reason?: string
  sections: {
    sponsors: Sponsor[]
    'sponsor-tiers': SponsorTier[]
    'floor-maps': FloorMap[]
    'shop-items': ShopItem[]
    'event-config': AdminEventConfig | null
    'i18n-overrides': I18nOverrides[]
    'booth-overrides': BoothOverride[]
  }
}

export interface SnapshotMeta {
  /** Blob name — used as the snapshot ID in admin URLs. */
  name: string
  capturedAt: string
  capturedBy: string
  reason?: string
  sizeBytes: number
}

/** Capture every admin-managed container for `eventSlug` and write it as
 * a single blob. Returns the snapshot meta. */
export async function takeSnapshot(args: {
  eventSlug: string
  capturedBy: string
  reason?: string
}): Promise<SnapshotMeta> {
  const slug = args.eventSlug
  const [
    sponsors,
    tiers,
    floorMaps,
    shopItems,
    eventConfig,
    i18nOverrides,
    boothOverrides,
  ] = await Promise.all([
    findAll<Sponsor>('sponsors', 'eventSlug', slug),
    findAll<SponsorTier>('sponsor-tiers', 'eventSlug', slug),
    findAll<FloorMap>('floor-maps', 'eventSlug', slug),
    findAll<ShopItem>('shop-items', 'eventSlug', slug),
    findById<AdminEventConfig>('events', slug, slug),
    findAll<I18nOverrides>('i18n-overrides', 'eventSlug', slug),
    findAll<BoothOverride>('booth-overrides', 'eventSlug', slug),
  ])

  const payload: SnapshotPayload = {
    eventSlug: slug,
    capturedAt: new Date().toISOString(),
    capturedBy: args.capturedBy,
    reason: args.reason,
    sections: {
      sponsors,
      'sponsor-tiers': tiers,
      'floor-maps': floorMaps,
      'shop-items': shopItems,
      'event-config': eventConfig ?? null,
      'i18n-overrides': i18nOverrides,
      'booth-overrides': boothOverrides,
    },
  }

  const body = JSON.stringify(payload)
  const stamp = payload.capturedAt.replace(/[:.]/g, '-')
  const safeReason = (args.reason || 'manual')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')
  const blobName = `${slug}/${stamp}-${safeReason || 'snapshot'}.json`
  const c = await container()
  const blob = c.getBlockBlobClient(blobName)
  await blob.upload(body, body.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    metadata: {
      eventSlug: slug,
      capturedBy: args.capturedBy,
      reason: args.reason || 'manual',
    },
  })
  return {
    name: blobName,
    capturedAt: payload.capturedAt,
    capturedBy: args.capturedBy,
    reason: args.reason,
    sizeBytes: body.length,
  }
}

/** List recent snapshots for an event, newest first. */
export async function listSnapshots(eventSlug: string): Promise<SnapshotMeta[]> {
  const c = await container()
  const out: SnapshotMeta[] = []
  for await (const blob of c.listBlobsFlat({
    prefix: `${eventSlug}/`,
    includeMetadata: true,
  })) {
    out.push({
      name: blob.name,
      capturedAt:
        (blob.metadata?.capturedat as string | undefined) ||
        blob.properties.createdOn?.toISOString() ||
        '',
      capturedBy: (blob.metadata?.capturedby as string | undefined) || '<unknown>',
      reason: blob.metadata?.reason as string | undefined,
      sizeBytes: blob.properties.contentLength ?? 0,
    })
  }
  out.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
  return out
}

/** Read a snapshot's full payload by blob name. */
export async function readSnapshot(name: string): Promise<SnapshotPayload> {
  const c = await container()
  const blob = c.getBlockBlobClient(name)
  const buffer = await blob.downloadToBuffer()
  return JSON.parse(buffer.toString('utf-8')) as SnapshotPayload
}

/** Restore a snapshot — upserts every record from the payload back into
 * Cosmos. Existing records with the same id get overwritten. Records
 * present in Cosmos but absent from the snapshot are *not* deleted (we
 * don't want a stale snapshot to wipe new sponsors). */
export async function restoreSnapshot(name: string): Promise<{
  restored: Record<string, number>
}> {
  const payload = await readSnapshot(name)
  const restored: Record<string, number> = {}

  const sections: Array<[string, string, unknown[]]> = [
    ['sponsors', 'sponsors', payload.sections.sponsors],
    ['sponsor-tiers', 'sponsor-tiers', payload.sections['sponsor-tiers']],
    ['floor-maps', 'floor-maps', payload.sections['floor-maps']],
    ['shop-items', 'shop-items', payload.sections['shop-items']],
    ['i18n-overrides', 'i18n-overrides', payload.sections['i18n-overrides']],
    ['booth-overrides', 'booth-overrides', payload.sections['booth-overrides']],
  ]

  for (const [label, container, items] of sections) {
    for (const item of items) {
      await upsert(container, item as { id: string })
    }
    restored[label] = items.length
  }
  if (payload.sections['event-config']) {
    await upsert('events', payload.sections['event-config'])
    restored['event-config'] = 1
  }

  return { restored }
}

/** Hard delete a snapshot blob. */
export async function deleteSnapshot(name: string): Promise<void> {
  const c = await container()
  await c.getBlockBlobClient(name).deleteIfExists()
}
