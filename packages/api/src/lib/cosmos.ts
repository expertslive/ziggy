/** Cosmos DB client and CRUD helpers */

import { CosmosClient, type Container } from '@azure/cosmos'
import { getEnv } from '../env.js'

let client: CosmosClient | null = null

function getClient(): CosmosClient {
  if (!client) {
    const env = getEnv()
    if (!env.cosmosConnectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not set')
    }
    client = new CosmosClient(env.cosmosConnectionString)
  }
  return client
}

const DATABASE_NAME = 'ziggy'

export function getContainer(name: string): Container {
  return getClient().database(DATABASE_NAME).container(name)
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Find all items in a container matching a partition key value.
 * The partition key field name varies per container, so we pass the field name
 * and build a parameterised query.
 */
export async function findAll<T>(
  containerName: string,
  partitionKey: string,
  partitionValue: string,
): Promise<T[]> {
  const container = getContainer(containerName)
  const { resources } = await container.items
    .query({
      query: `SELECT * FROM c WHERE c.${partitionKey} = @val`,
      parameters: [{ name: '@val', value: partitionValue }],
    })
    .fetchAll()
  return resources as T[]
}

/** Find a single item by id and partition key value */
export async function findById<T>(
  containerName: string,
  id: string,
  partitionValue: string,
): Promise<T | undefined> {
  const container = getContainer(containerName)
  try {
    const { resource } = await container.item(id, partitionValue).read()
    return (resource as T) ?? undefined
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 404
    ) {
      return undefined
    }
    throw err
  }
}

/** Upsert (create or replace) an item */
export async function upsert<T extends { id: string }>(
  containerName: string,
  item: T,
): Promise<T> {
  const container = getContainer(containerName)
  const { resource } = await container.items.upsert(item as unknown as Record<string, unknown>)
  return resource as unknown as T
}

/** Delete an item by id and partition key value */
export async function deleteItem(
  containerName: string,
  id: string,
  partitionValue: string,
): Promise<void> {
  const container = getContainer(containerName)
  await container.item(id, partitionValue).delete()
}
