#!/usr/bin/env node
/**
 * Recreate Begane grond hotspots after the floor-map data was wiped.
 *
 * Strategy:
 *  - Booth hotspots reuse the existing UUIDs that sponsors already point to
 *    via `floorMapHotspotId`. That way the sponsor → hotspot links stay
 *    intact and we don't have to rewrite 27 sponsor records.
 *  - Hall + utility hotspots get fresh UUIDs.
 *  - Every hotspot starts as a small 3% × 3% rectangle laid out in a grid
 *    along the bottom of the floor-map image, off the printed plan. The
 *    HotspotEditor lets you drag polygons, so the user moves each to its
 *    real location after this seed runs.
 *
 * Usage:
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/seed-bg-hotspots.mjs
 */

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomUUID } from 'node:crypto'

const API_BASE = process.env.API_BASE
if (!API_BASE) {
  console.error('Set API_BASE to the API origin before running this script.')
  process.exit(2)
}
const SLUG = 'experts-live-netherlands-2026'

// Existing sponsor → hotspot ID map (reuse to preserve sponsor links)
const BOOTHS = [
  ['Booth 1', 'cb4f225d-77f8-4c6c-85a7-bd83dd6a2278'],
  ['Booth 2', '8e48301b-5fa1-4cf1-9907-b8cca055e6d3'],
  ['Booth 3', 'fdd78a36-c934-41f3-8e5e-1d3fda06cccd'],
  ['Booth 4', '86672478-5847-4d01-96a2-d948b78067d0'],
  ['Booth 5', '6b216271-baf9-4863-a099-a31fb127fe33'],
  ['Booth 6', '3d152f57-2d4a-422d-9915-df6a0d5f74b3'],
  ['Booth 7', '85b6e51d-d5bd-4a31-86f6-53dbd9a60dd7'],
  ['Booth 8', 'a4c8e86e-ae73-4145-88b5-6d9cd34ac5db'],
  ['Booth 9', 'f180acaf-e0e8-4619-9675-223906fba8f7'],
  ['Booth 10', '55bc9847-2fb0-4ea0-8471-17da528e3702'],
  ['Booth 11', 'cea1edf9-fac0-4b8d-b9a3-5f86643ab867'],
  ['Booth 12', '2f3ec238-4f27-4fb9-bbc8-e203fec83b95'],
  ['Booth 13', '889dfc0e-9a15-4a41-97f0-8fbd1071cc1e'],
  ['Booth 14', 'da7cb74f-6fb3-4a09-bf75-8bad1de1454b'],
  ['Booth 15', '1b7d975f-bcb2-46ba-b235-11851f04bdc5'],
  ['Booth 16', 'de99f597-b381-4665-ae3e-565a13420132'],
  ['Booth 17', '7dc74d3e-2368-4166-a3e8-b5cdefd1bc24'],
  ['Booth 18', '89c41498-d761-4a4b-a09f-6223ac07a819'],
  ['Booth 19', '5085e713-3ddb-47ad-9e79-76898d877733'],
  ['Booth 20', 'e4a5be3e-8940-4033-9a35-b426bcdd7286'],
  ['Booth 21', '1ad35e8b-989a-4b50-ac12-b25950019b2d'],
  ['Booth 22', '5d7fbeee-fc5d-425e-bc89-84b33afaa325'],
  ['Booth 23', '36055e04-751d-4917-acd1-1f0b89817d1a'],
  ['Booth 25', '5a9cc4cb-bcd1-46b0-8e85-04c1e27b75f4'],
  ['Booth 27', '69361d9c-211b-4458-b1d0-66c4b8dfcc08'],
  ['Booth 29', 'a3523cc0-a680-4b6d-ba54-2097af8bf4bc'],
  ['Booth (Experts Inside)', '26b5a043-93ba-4d2e-b939-4acc644f49e6'],
]

const UTILITY = [
  'Merchandise',
  'Registratie',
  'Photo wall',
  'Garderobe',
  'Toiletten',
  'Toiletten',
  'Trappen',
  'Lift',
  'Dietary needs',
  'Dietary needs',
  'Eten/drinken',
  'Eten/drinken',
  'Eten/drinken',
]

const HALLS = [
  {
    name: 'Grand hall',
    roomGuid: '8459c521-2408-44c3-b1e2-b92de7a2c3fa',
  },
  {
    name: 'Event hall 2',
    roomGuid: 'fa7839e2-5f86-4690-8a3b-de134ef48153',
    roomGuids: [
      'fa7839e2-5f86-4690-8a3b-de134ef48153', // Event Hall 2
      'aabd4d1f-44c7-4d91-add4-b4ef32911727', // Event Hall 1+2 combined (keynote/closing/Politie)
    ],
  },
]

// Place each placeholder in a strip along the bottom of the image. The
// strips sit at y ∈ [0.92..0.99] so the floor plan itself stays uncovered
// — the user drags each up into position. Booths get the bottom strip,
// utility hotspots the next, halls the highest.
function placeholderRect(row, col, rows) {
  const W = 0.022
  const H = 0.022
  const yBottom = 0.99
  const yStep = H + 0.005
  const cols = Math.ceil(rows[row].count / 1)
  const xStart = 0.005
  const xStep = (1.0 - 2 * xStart) / Math.max(cols, 1)
  const x0 = xStart + col * xStep
  const x1 = x0 + W
  const y1 = yBottom - row * yStep
  const y0 = y1 - H
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

async function ask(prompt) {
  const rl = createInterface({ input, output })
  const a = await rl.question(prompt)
  rl.close()
  return a.trim()
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

  console.log('→ fetching floor maps…')
  const fmRes = await fetch(`${API_BASE}/api/admin/events/${SLUG}/floor-maps`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const maps = await fmRes.json()
  const bg = maps.find((m) => m.name === 'Begane grond')
  if (!bg) {
    console.error('no Begane grond map found')
    process.exit(1)
  }

  // Preserve any hotspots that already exist (e.g. the surviving Event hall 1).
  // We'll only add ones whose names aren't already there or whose IDs don't
  // collide.
  const existingNames = new Set(bg.hotspots.map((h) => h.roomName.toLowerCase()))
  const existingIds = new Set(bg.hotspots.map((h) => h.id))

  // Three rows: booths (bottom), utility (middle), halls (top of strip)
  const rows = [
    { kind: 'booth', count: BOOTHS.length },
    { kind: 'util', count: UTILITY.length },
    { kind: 'hall', count: HALLS.length },
  ]

  const newHotspots = []

  // Halls (row 2, top strip)
  HALLS.forEach((h, i) => {
    if (existingNames.has(h.name.toLowerCase())) return
    newHotspots.push({
      id: randomUUID(),
      roomName: h.name,
      roomGuid: h.roomGuid,
      ...(h.roomGuids ? { roomGuids: h.roomGuids } : {}),
      label: {},
      points: placeholderRect(2, i, rows),
    })
  })

  // Utility (row 1, middle strip)
  UTILITY.forEach((name, i) => {
    newHotspots.push({
      id: randomUUID(),
      roomName: name,
      label: {},
      points: placeholderRect(1, i, rows),
    })
  })

  // Booths (row 0, bottom strip) — reuse sponsor-pointed UUIDs
  BOOTHS.forEach(([name, id], i) => {
    if (existingIds.has(id)) return
    newHotspots.push({
      id,
      roomName: name,
      label: {},
      points: placeholderRect(0, i, rows),
    })
  })

  if (newHotspots.length === 0) {
    console.log('→ nothing to add (all already present)')
    return
  }

  const all = [...bg.hotspots, ...newHotspots]
  console.log(`→ adding ${newHotspots.length} placeholder hotspots (now ${all.length} total)`)

  const put = await fetch(
    `${API_BASE}/api/admin/events/${SLUG}/floor-maps/${bg.id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ hotspots: all }),
    },
  )
  if (!put.ok) {
    console.error('PUT failed', put.status, await put.text())
    process.exit(1)
  }
  console.log('✅ done — open the HotspotEditor and drag each placeholder onto its real spot.')
  console.log('   URL: https://ziggy-admin.expertslive.dev/floor-maps/' + bg.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
