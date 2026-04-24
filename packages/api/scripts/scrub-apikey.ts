/**
 * Deploy migration: scrub any `apiKey` field from existing Cosmos `events`
 * documents. Runs once; idempotent.
 *
 * Usage: tsx --env-file=packages/api/.env packages/api/scripts/scrub-apikey.ts
 */
import { CosmosClient } from '@azure/cosmos'

const conn = process.env.COSMOS_CONNECTION_STRING
if (!conn) {
  console.error('COSMOS_CONNECTION_STRING not set')
  process.exit(1)
}

const client = new CosmosClient(conn)
const container = client.database('ziggy').container('events')

const { resources } = await container.items
  .query('SELECT * FROM c')
  .fetchAll()

let scrubbed = 0
for (const doc of resources) {
  if (doc.apiKey !== undefined) {
    const { apiKey, ...rest } = doc
    await container.items.upsert(rest)
    console.log(`Scrubbed apiKey from ${doc.id} (was: "${String(apiKey).slice(0, 4)}…")`)
    scrubbed++
  }
}

console.log(`Done. Scrubbed ${scrubbed} of ${resources.length} events documents.`)
