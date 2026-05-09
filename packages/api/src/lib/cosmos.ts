/** Cosmos DB client and CRUD helpers */

import { CosmosClient, PartitionKeyKind, type Container } from '@azure/cosmos'
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

/** Ensure the analytics container exists with /kioskId partition + 90-day TTL.
 * Idempotent — does nothing if it already exists. */
let analyticsEnsured = false
export async function ensureAnalyticsContainer(): Promise<void> {
  if (analyticsEnsured) return
  const db = getClient().database(DATABASE_NAME)
  await db.containers.createIfNotExists({
    id: 'analytics',
    partitionKey: { paths: ['/kioskId'], kind: PartitionKeyKind.Hash },
    defaultTtl: 7776000, // 90 days
  })
  analyticsEnsured = true
}

/** Ensure the audit-log container exists with /eventSlug partition + 365-day TTL.
 * Idempotent. */
let auditEnsured = false
export async function ensureAuditContainer(): Promise<void> {
  if (auditEnsured) return
  const db = getClient().database(DATABASE_NAME)
  await db.containers.createIfNotExists({
    id: 'audit-log',
    partitionKey: { paths: ['/eventSlug'], kind: PartitionKeyKind.Hash },
    defaultTtl: 31_536_000, // 365 days
  })
  auditEnsured = true
}

/** Ensure the auction-bids container exists. Partitioned by eventSlug
 * (matches the rest of admin-managed data). 90-day TTL — bids are PII
 * and we don't need them past two months post-event. */
let auctionEnsured = false
export async function ensureAuctionContainer(): Promise<void> {
  if (auctionEnsured) return
  const db = getClient().database(DATABASE_NAME)
  await db.containers.createIfNotExists({
    id: 'auction-bids',
    partitionKey: { paths: ['/eventSlug'], kind: PartitionKeyKind.Hash },
    defaultTtl: 7_776_000, // 90 days
  })
  auctionEnsured = true
}

/** Ensure the nominations container exists. Partitioned by eventSlug.
 * 180-day TTL — nominations are PII tied to a specific scholarship cycle
 * (winner announced ~30 days post-event), so half a year covers
 * follow-up + dispute window with a buffer. */
let nominationsEnsured = false
export async function ensureNominationsContainer(): Promise<void> {
  if (nominationsEnsured) return
  const db = getClient().database(DATABASE_NAME)
  await db.containers.createIfNotExists({
    id: 'nominations',
    partitionKey: { paths: ['/eventSlug'], kind: PartitionKeyKind.Hash },
    defaultTtl: 15_552_000, // 180 days
  })
  nominationsEnsured = true
}

/** Ensure the kiosks container exists. Partitioned by eventSlug. No TTL —
 * admin-managed config. Holds display-name/short-code aliases for the
 * kiosk-IDs that show up in analytics heartbeats. */
let kiosksEnsured = false
export async function ensureKiosksContainer(): Promise<void> {
  if (kiosksEnsured) return
  const db = getClient().database(DATABASE_NAME)
  await db.containers.createIfNotExists({
    id: 'kiosks',
    partitionKey: { paths: ['/eventSlug'], kind: PartitionKeyKind.Hash },
  })
  kiosksEnsured = true
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Find all items in a container matching a partition key value.
 * The partition key field name varies per container, so we pass the field name
 * and build a parameterised query. Includes soft-deleted records — for the
 * common case of "everything except trash" use findActive instead.
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

/** Find all items NOT soft-deleted. Containers without a deletedAt field
 * still match because IS_DEFINED returns false for absent properties. */
export async function findActive<T>(
  containerName: string,
  partitionKey: string,
  partitionValue: string,
): Promise<T[]> {
  const container = getContainer(containerName)
  const { resources } = await container.items
    .query({
      query: `SELECT * FROM c WHERE c.${partitionKey} = @val AND (NOT IS_DEFINED(c.deletedAt) OR c.deletedAt = null)`,
      parameters: [{ name: '@val', value: partitionValue }],
    })
    .fetchAll()
  return resources as T[]
}

/** Find only soft-deleted items — used by the trash page. */
export async function findDeleted<T>(
  containerName: string,
  partitionKey: string,
  partitionValue: string,
): Promise<T[]> {
  const container = getContainer(containerName)
  const { resources } = await container.items
    .query({
      query: `SELECT * FROM c WHERE c.${partitionKey} = @val AND IS_DEFINED(c.deletedAt) AND c.deletedAt != null`,
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
