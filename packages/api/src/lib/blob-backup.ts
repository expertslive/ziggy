/** PII backup helper — write JSON dumps of bids / nominations to Blob Storage.
 *
 * Path layout: pii-backups/<slug>/<YYYY-MM-DD>/<kind>.json (UTC date).
 * Idempotent per UTC day — overwrites the same blob if called again. */

import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'
import { getEnv } from '../env.js'

const CONTAINER = 'ziggy-pii-backups'

export type BackupKind = 'bids' | 'nominations'

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
    await _container.createIfNotExists({ access: undefined })
    _containerEnsured = true
  }
  return _container
}

function utcDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export interface BackupResult {
  url: string
  sizeBytes: number
}

export async function writeBackup(args: {
  slug: string
  kind: BackupKind
  payload: unknown
}): Promise<BackupResult> {
  const body = JSON.stringify(args.payload, null, 2)
  const blobName = `${args.slug}/${utcDateStamp()}/${args.kind}.json`
  const c = await container()
  const blob = c.getBlockBlobClient(blobName)
  await blob.upload(body, body.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    metadata: {
      eventSlug: args.slug,
      kind: args.kind,
    },
  })
  return { url: blob.url, sizeBytes: body.length }
}
