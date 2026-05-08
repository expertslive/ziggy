/** Append-only audit log helper.
 *
 * Every admin write hits a writeAudit() call so we have a who/what/when
 * record. Failures here are logged-and-swallowed — we don't want a
 * Cosmos hiccup to block the actual mutation that already succeeded. */

import type { AuditAction, AuditEntry, AuditTarget } from '@ziggy/shared'
import { ensureAuditContainer, getContainer } from './cosmos.js'

interface RecordArgs {
  eventSlug: string
  actor: string
  action: AuditAction
  target: AuditTarget
  recordId?: string
  summary: string
  meta?: Record<string, unknown>
}

export async function writeAudit(args: RecordArgs): Promise<void> {
  try {
    await ensureAuditContainer()
    const ts = Date.now()
    const entry: AuditEntry = {
      id: `${ts}-${args.target}-${args.recordId || 'na'}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      eventSlug: args.eventSlug,
      ts,
      actor: args.actor,
      action: args.action,
      target: args.target,
      recordId: args.recordId,
      summary: args.summary,
      meta: args.meta,
    }
    const container = getContainer('audit-log')
    await container.items.create(entry)
  } catch (err) {
    // Don't throw — audit write must never block the actual mutation.
    console.warn('[audit] write failed', err)
  }
}

/** Read recent audit entries for the dashboard feed. */
export async function recentAudit(
  eventSlug: string,
  limit = 50,
): Promise<AuditEntry[]> {
  try {
    await ensureAuditContainer()
    const container = getContainer('audit-log')
    const { resources } = await container.items
      .query<AuditEntry>({
        query: `SELECT TOP @n * FROM c WHERE c.eventSlug = @slug ORDER BY c.ts DESC`,
        parameters: [
          { name: '@n', value: limit },
          { name: '@slug', value: eventSlug },
        ],
      })
      .fetchAll()
    return resources
  } catch (err) {
    console.warn('[audit] read failed', err)
    return []
  }
}
