#!/usr/bin/env node
/**
 * Snapshot every admin-managed Cosmos container into a single timestamped
 * JSON file under `backups/`. Cheap insurance after the May-7 floor-map
 * incident — periodic Cosmos backups still exist, but a self-service
 * snapshot we can re-PUT in seconds is worth keeping.
 *
 * Usage:
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/backup-all.mjs
 *
 * Output: backups/<event-slug>-YYYY-MM-DD-HHMM.json
 *
 * Restore (manual): pick the relevant section out of the JSON and PUT it
 * via the corresponding `/api/admin/events/:slug/<container>/:id` endpoint.
 * The existing seed-bg-hotspots.mjs / fix-event-halls.mjs scripts are
 * good templates.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const API_BASE =
  process.env.API_BASE ||
  'https://ziggy-api.mangosky-5e1b98ca.westeurope.azurecontainerapps.io'
const SLUG = process.env.EVENT_SLUG || 'experts-live-netherlands-2026'
const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = join(__dirname, '..', 'backups')

// Each entry: [json key in output, GET path]. Order is alphabetised so
// diffs between snapshots stay stable.
const SECTIONS = [
  ['booth-overrides', `/api/admin/events/${SLUG}/booth-overrides`],
  ['event-config', `/api/admin/events/${SLUG}/config`],
  ['floor-maps', `/api/admin/events/${SLUG}/floor-maps`],
  ['i18n-overrides', `/api/admin/events/${SLUG}/i18n-overrides`],
  ['shop-items', `/api/admin/events/${SLUG}/shop-items`],
  ['sponsor-tiers', `/api/admin/events/${SLUG}/sponsor-tiers`],
  ['sponsors', `/api/admin/events/${SLUG}/sponsors`],
]

async function ask(prompt) {
  const rl = createInterface({ input, output })
  const a = await rl.question(prompt)
  rl.close()
  return a.trim()
}

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '))
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: '))

  console.log('→ logging in…')
  const login = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) {
    console.error('login failed', await login.text())
    process.exit(1)
  }
  const { token } = await login.json()
  const auth = { Authorization: `Bearer ${token}` }

  const snapshot = {
    eventSlug: SLUG,
    apiBase: API_BASE,
    capturedAt: new Date().toISOString(),
    sections: {},
  }

  for (const [key, path] of SECTIONS) {
    process.stdout.write(`  ${key.padEnd(18, ' ')}`)
    const res = await fetch(`${API_BASE}${path}`, { headers: auth })
    if (!res.ok) {
      console.log(`  ✗ ${res.status}`)
      snapshot.sections[key] = { error: res.status, body: await res.text() }
      continue
    }
    const body = await res.json()
    snapshot.sections[key] = body
    const n = Array.isArray(body) ? body.length : 1
    console.log(`  ✓ ${n} item${n === 1 ? '' : 's'}`)
  }

  await mkdir(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, `${SLUG}-${timestamp()}.json`)
  await writeFile(file, JSON.stringify(snapshot, null, 2))
  console.log(`\n✅ wrote ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
