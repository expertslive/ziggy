/** Azure Blob Storage upload helper */

import { BlobServiceClient, type BlockBlobParallelUploadOptions } from '@azure/storage-blob'
import { getEnv } from '../env.js'
import { type AllowedImageType, extensionFor } from './magic-bytes.js'

const CONTAINER = 'images'

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

/**
 * Upload a validated image buffer to Azure Blob Storage.
 * Blob name is a random UUID plus extension derived from the sniffed type —
 * the user-supplied filename is never used.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadImage(
  buffer: ArrayBuffer,
  type: AllowedImageType,
): Promise<string> {
  const container = client().getContainerClient(CONTAINER)
  const blobName = `${crypto.randomUUID()}${extensionFor(type)}`
  const blob = container.getBlockBlobClient(blobName)
  // Note: Azure Blob metadata keys must be valid C# identifiers (no hyphens),
  // so X-Content-Type-Options can't be set as metadata. The kiosk SWA sets
  // nosniff globally for HTML/JS responses; for blob URLs the browser still
  // honors the explicit Content-Type below.
  const options: BlockBlobParallelUploadOptions = {
    blobHTTPHeaders: {
      blobContentType: type,
      blobCacheControl: 'public, max-age=31536000, immutable',
      blobContentDisposition: 'inline',
    },
  }
  await blob.uploadData(Buffer.from(buffer), options)
  return blob.url
}
