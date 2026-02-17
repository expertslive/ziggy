/** Azure Blob Storage upload helper */

import { BlobServiceClient } from '@azure/storage-blob'
import { getEnv } from '../env.js'

const CONTAINER_NAME = 'images'

let blobService: BlobServiceClient | null = null

function getClient(): BlobServiceClient {
  if (!blobService) {
    const env = getEnv()
    if (!env.storageConnectionString) {
      throw new Error('STORAGE_CONNECTION_STRING is not set')
    }
    blobService = BlobServiceClient.fromConnectionString(env.storageConnectionString)
  }
  return blobService
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadImage(
  buffer: ArrayBuffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const client = getClient()
  const containerClient = client.getContainerClient(CONTAINER_NAME)

  // Generate a unique blob name with timestamp prefix
  const ext = fileName.split('.').pop() || 'bin'
  const blobName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  })

  return blockBlobClient.url
}
