#!/usr/bin/env node
/**
 * One-off fix for the three new "Begane grond" hotspots:
 *   - Grand hall      → Grand Hall (single roomGuid)
 *   - Event hall 1    → matches both Event Hall 1 AND combined Event Hall 1+2
 *   - Event hall 2    → matches both Event Hall 2 AND combined Event Hall 1+2
 *
 * Also coerces the polygons to perfect bounding-box rectangles (the polygon
 * editor lets you draw freehand quads which don't always have aligned edges).
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node scripts/fix-event-halls.mjs
 *
 * Optional: set API_BASE to override the default prod API.
 */

import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'

const API_BASE =
  process.env.API_BASE ||
  'https://ziggy-api.mangosky-5e1b98ca.westeurope.azurecontainerapps.io'
const SLUG = 'experts-live-netherlands-2026'

// run.events room GUIDs — discovered by inspecting the live agenda
const ROOM_GUID = {
  GRAND_HALL: '8459c521-2408-44c3-b1e2-b92de7a2c3fa',
  EVENT_HALL_COMBINED: 'aabd4d1f-44c7-4d91-add4-b4ef32911727',
  EVENT_HALL_1: 'f6ce558a-67f9-4d20-9cda-5adb0914ac74',
  EVENT_HALL_2: 'fa7839e2-5f86-4690-8a3b-de134ef48153',
}

// Hotspots to patch, keyed by current roomName (case-sensitive — that's how
// they live in Cosmos right now).
const PATCHES = {
  'Grand hall': {
    newRoomName: 'Grand hall',
    roomGuid: ROOM_GUID.GRAND_HALL,
    roomGuids: undefined,
  },
  'Event hall 1': {
    newRoomName: 'Event hall 1',
    roomGuid: ROOM_GUID.EVENT_HALL_1,
    roomGuids: [ROOM_GUID.EVENT_HALL_1, ROOM_GUID.EVENT_HALL_COMBINED],
  },
  'Event hall 2': {
    newRoomName: 'Event hall 2',
    roomGuid: ROOM_GUID.EVENT_HALL_2,
    roomGuids: [ROOM_GUID.EVENT_HALL_2, ROOM_GUID.EVENT_HALL_COMBINED],
  },
}

function rectangularize(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  // CCW from top-left
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

async function ask(prompt) {
  const rl = createInterface({ input, output })
  const answer = await rl.question(prompt)
  rl.close()
  return answer.trim()
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '))
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: '))

  console.log('→ logging in…')
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) {
    console.error(`login failed: ${loginRes.status} ${await loginRes.text()}`)
    process.exit(1)
  }
  const { token } = await loginRes.json()

  console.log('→ fetching floor maps…')
  const fmRes = await fetch(`${API_BASE}/api/admin/events/${SLUG}/floor-maps`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!fmRes.ok) {
    console.error(`fetch failed: ${fmRes.status} ${await fmRes.text()}`)
    process.exit(1)
  }
  const maps = await fmRes.json()
  const bg = maps.find((m) => m.name === 'Begane grond')
  if (!bg) {
    console.error('no "Begane grond" floor map found')
    process.exit(1)
  }
  console.log(`→ found "${bg.name}" with ${bg.hotspots.length} hotspots`)

  let changed = 0
  const newHotspots = bg.hotspots.map((h) => {
    const patch = PATCHES[h.roomName]
    if (!patch) return h
    const before = JSON.stringify({ pts: h.points, gid: h.roomGuid, gids: h.roomGuids })
    const fixed = {
      ...h,
      roomName: patch.newRoomName,
      points: rectangularize(h.points),
      roomGuid: patch.roomGuid,
      ...(patch.roomGuids ? { roomGuids: patch.roomGuids } : {}),
    }
    const after = JSON.stringify({ pts: fixed.points, gid: fixed.roomGuid, gids: fixed.roomGuids })
    if (before !== after) {
      changed += 1
      console.log(`  ✓ ${h.roomName} — rectangle + roomGuids`)
    }
    return fixed
  })

  if (changed === 0) {
    console.log('→ nothing to do (already correct)')
    return
  }

  console.log(`→ PUT ${changed} updated hotspot(s)…`)
  const putRes = await fetch(
    `${API_BASE}/api/admin/events/${SLUG}/floor-maps/${bg.id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ hotspots: newHotspots }),
    },
  )
  if (!putRes.ok) {
    console.error(`PUT failed: ${putRes.status} ${await putRes.text()}`)
    process.exit(1)
  }
  console.log('✅ done — kiosk picks up via the public floor-maps cache (≤5 min).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
