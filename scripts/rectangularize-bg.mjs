#!/usr/bin/env node
/** One-off: coerce every Begane grond hotspot polygon to a 4-corner
 *  bounding-box rectangle (uses the min/max of the existing points). The
 *  in-app polygon editor allows freehand quads which often end up slightly
 *  skewed; this normalises them so the visible polygon = the tap target. */

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const API_BASE =
  process.env.API_BASE ||
  'https://ziggy-api.mangosky-5e1b98ca.westeurope.azurecontainerapps.io'
const SLUG = 'experts-live-netherlands-2026'

function rectangularize(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

function isRect(points) {
  if (points.length !== 4) return false
  const xs = new Set(points.map((p) => p[0].toFixed(9)))
  const ys = new Set(points.map((p) => p[1].toFixed(9)))
  return xs.size === 2 && ys.size === 2
}

async function ask(p) {
  const rl = createInterface({ input, output })
  const a = await rl.question(p)
  rl.close()
  return a.trim()
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '))
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: '))

  const login = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { token } = await login.json()

  const fmRes = await fetch(`${API_BASE}/api/admin/events/${SLUG}/floor-maps`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const maps = await fmRes.json()
  const bg = maps.find((m) => m.name === 'Begane grond')

  let changed = 0
  const fixed = bg.hotspots.map((h) => {
    if (isRect(h.points)) return h
    changed += 1
    return { ...h, points: rectangularize(h.points) }
  })
  console.log(`→ rectangularising ${changed}/${bg.hotspots.length} hotspots…`)

  const put = await fetch(
    `${API_BASE}/api/admin/events/${SLUG}/floor-maps/${bg.id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ hotspots: fixed }),
    },
  )
  if (!put.ok) {
    console.error('PUT failed', put.status, await put.text())
    process.exit(1)
  }
  console.log('✅ done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
