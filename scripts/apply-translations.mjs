#!/usr/bin/env node
/**
 * Apply DE+FR (and where missing NL+EN) translations from
 * scripts/translations.json to every sponsor + shop-item via the admin
 * API. Idempotent — runs each PUT independently and skips records
 * whose target description for a given lang is already non-empty AND
 * matches what we'd set.
 *
 * Usage:
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/apply-translations.mjs
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_BASE = process.env.API_BASE
if (!API_BASE) {
  console.error('Set API_BASE to the API origin before running this script.')
  process.exit(2)
}
const SLUG = 'experts-live-netherlands-2026'

async function ask(prompt) {
  const rl = createInterface({ input, output })
  const a = await rl.question(prompt)
  rl.close()
  return a.trim()
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '))
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: '))
  const data = JSON.parse(
    await readFile(join(__dirname, 'translations.json'), 'utf8'),
  )

  console.log('→ logging in…')
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) {
    console.error('login failed', await loginRes.text())
    process.exit(1)
  }
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}` }

  // Sponsors
  console.log('→ fetching sponsors…')
  const spRes = await fetch(`${API_BASE}/api/admin/events/${SLUG}/sponsors`, {
    headers: auth,
  })
  const sponsors = await spRes.json()

  let sponsorPuts = 0
  for (const sponsor of sponsors) {
    const tr = data.sponsors[sponsor.id]
    if (!tr) {
      console.log(`  · skip (no translations) ${sponsor.name}`)
      continue
    }
    const desc = { ...(sponsor.description ?? {}) }
    let changed = false
    for (const lang of ['nl', 'en', 'de', 'fr']) {
      const next = tr[lang]
      if (!next) continue
      if ((desc[lang] || '').trim() === next.trim()) continue
      // Don't overwrite an existing non-empty value with something different
      // unless the existing value is empty. The translations file is
      // intentionally additive: we only fill blanks.
      if ((desc[lang] || '').trim() && (desc[lang] || '').trim() !== next.trim()) {
        if (lang === 'nl' || lang === 'en') {
          // For NL/EN, the source file shouldn't differ from what's already
          // there (we generated translations FROM these). Skip.
          continue
        }
      }
      desc[lang] = next
      changed = true
    }
    if (!changed) {
      console.log(`  · ok    ${sponsor.name}`)
      continue
    }
    const put = await fetch(
      `${API_BASE}/api/admin/events/${SLUG}/sponsors/${sponsor.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ description: desc }),
      },
    )
    if (!put.ok) {
      console.error(`  ✗ ${sponsor.name}: ${put.status} ${await put.text()}`)
      continue
    }
    sponsorPuts += 1
    console.log(`  ✓ ${sponsor.name}`)
  }

  // Shop items
  console.log('→ fetching shop items…')
  const shRes = await fetch(`${API_BASE}/api/admin/events/${SLUG}/shop-items`, {
    headers: auth,
  })
  const shop = await shRes.json()

  let shopPuts = 0
  for (const it of shop) {
    const tr = data.shop[it.id]
    if (!tr) {
      console.log(`  · skip (no translations) ${it.name}`)
      continue
    }
    const desc = { ...(it.description ?? {}) }
    let changed = false
    for (const lang of ['nl', 'en', 'de', 'fr']) {
      const next = tr[lang]
      if (!next) continue
      if ((desc[lang] || '').trim() === next.trim()) continue
      if ((desc[lang] || '').trim() && (desc[lang] || '').trim() !== next.trim()) {
        if (lang === 'nl' || lang === 'en') continue
      }
      desc[lang] = next
      changed = true
    }
    if (!changed) {
      console.log(`  · ok    ${it.name}`)
      continue
    }
    const put = await fetch(
      `${API_BASE}/api/admin/events/${SLUG}/shop-items/${it.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ description: desc }),
      },
    )
    if (!put.ok) {
      console.error(`  ✗ ${it.name}: ${put.status} ${await put.text()}`)
      continue
    }
    shopPuts += 1
    console.log(`  ✓ ${it.name}`)
  }

  console.log(
    `\n✅ done — ${sponsorPuts} sponsor PUTs, ${shopPuts} shop-item PUTs.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
