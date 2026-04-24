# Event-Ready Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship production hardening, attendee-UX finishing touches, and event-critical security fixes for Experts Live NL 2026 (2026-06-01/02).

**Architecture:** Eight buckets sequenced by risk. Security P0s first (real current exposure). Then vitest test infrastructure, remaining security hardening, reliability layer, global state refactor, and finally per-feature UX improvements that depend on the refactored store. TDD for all API and schema work. Component/behavior tests for kiosk state logic. Manual verification for pure visual work.

**Tech Stack:** Hono (API) + vitest + zod; React 19 + TanStack Query v5 + Zustand + Tailwind v4 (kiosk); Azure Container Apps + Static Web Apps + Cosmos + Blob.

**Spec:** `docs/superpowers/specs/2026-04-24-event-ready-polish-design.md`

---

## Phase 0 — Test infrastructure

No tests exist in any package. Add `vitest` to `api` and `kiosk` so every subsequent API schema/validation task is testable.

### Task 0.1: Add vitest to the API package

**Files:**
- Modify: `packages/api/package.json`
- Create: `packages/api/vitest.config.ts`

- [ ] **Step 1: Add vitest as dev dep**

```bash
pnpm --filter @ziggy/api add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Add test script**

Edit `packages/api/package.json` scripts block:

```json
{
  "scripts": {
    "dev": "tsx watch --env-file=.env src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create vitest config**

Create `packages/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Smoke test the runner**

Create `packages/api/src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `pnpm --filter @ziggy/api test`
Expected: 1 test passes.

- [ ] **Step 5: Remove smoke file and commit**

Delete `packages/api/src/smoke.test.ts`.

```bash
git add packages/api/
git commit -m "chore(api): add vitest test runner"
```

### Task 0.2: Add vitest + React Testing Library to the kiosk package

**Files:**
- Modify: `packages/kiosk/package.json`
- Create: `packages/kiosk/vitest.config.ts`
- Create: `packages/kiosk/src/test-setup.ts`

- [ ] **Step 1: Install deps**

```bash
pnpm --filter @ziggy/kiosk add -D vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom
```

- [ ] **Step 2: Add scripts**

Edit `packages/kiosk/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Vitest config**

Create `packages/kiosk/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Setup file**

Create `packages/kiosk/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Smoke test & commit**

Create `packages/kiosk/src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => { expect(true).toBe(true) })
})
```

Run: `pnpm --filter @ziggy/kiosk test`
Expected: pass.

Delete smoke file, commit:

```bash
git add packages/kiosk/
git commit -m "chore(kiosk): add vitest + react testing library"
```

---

## Phase 1 — Security P0s (config leak + setup lockdown)

### Task 1.1: Split public/admin event config types

**Files:**
- Modify: `packages/shared/src/types/event.ts`

- [ ] **Step 1: Read current shape**

Read `packages/shared/src/types/event.ts`. Identify every consumer of `EventConfig.apiKey` via grep:

```bash
grep -rn "apiKey" packages/shared/src packages/api/src packages/admin/src packages/kiosk/src
```

Note the hits — they will all be touched below.

- [ ] **Step 2: Introduce the split**

Replace the `EventConfig` export with:

```ts
// Public — returned by GET /api/events/:slug/config (kiosk reads this)
export interface PublicEventConfig {
  slug: string
  name: string
  timezone: string
  languages: string[]
  defaultLanguage: string
  branding: Branding
  days: Array<{ date: string; label: Record<string, string> }>
  startDate?: string
  endDate?: string
}

// Admin — returned by GET /api/admin/events/:slug/config
// Currently identical to Public; kept as a distinct type so future admin-only
// fields never accidentally leak through the public route.
export type AdminEventConfig = PublicEventConfig & {
  id: string
  createdAt: string
  updatedAt: string
}

// Legacy alias — consumers that need either shape.
// Prefer PublicEventConfig or AdminEventConfig at call sites.
export type EventConfig = AdminEventConfig
```

`apiKey` is removed entirely. The runtime uses `env.RUN_EVENTS_API_KEY`; the stored Cosmos field was dead weight.

- [ ] **Step 3: Rebuild shared**

```bash
pnpm build:shared
```

Expected: no type errors in the shared build itself. Downstream type errors in api/admin will be fixed in the next task.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "refactor(shared): split PublicEventConfig from AdminEventConfig, drop apiKey"
```

### Task 1.2: Scrub `apiKey` from API admin write path

**Files:**
- Modify: `packages/api/src/routes/admin.ts:337-369`

- [ ] **Step 1: Remove the field**

In the `PUT /api/admin/events/:slug/config` handler at `admin.ts:337-369`, delete the line `apiKey: body.apiKey ?? existing?.apiKey ?? '',`. Also drop any `startDate`/`endDate` handling if they are in the removed path — keep consistent with `AdminEventConfig`.

Replace the whole `config` construction with an allowlisted builder:

```ts
const config: AdminEventConfig = {
  id: slug,
  slug,
  name: body.name ?? existing?.name ?? '',
  timezone: body.timezone ?? existing?.timezone ?? 'Europe/Amsterdam',
  startDate: body.startDate ?? existing?.startDate,
  endDate: body.endDate ?? existing?.endDate,
  days: body.days ?? existing?.days ?? [],
  languages: body.languages ?? existing?.languages ?? ['en'],
  defaultLanguage: body.defaultLanguage ?? existing?.defaultLanguage ?? 'en',
  branding: body.branding ?? existing?.branding ?? DEFAULT_BRANDING,
  createdAt: existing?.createdAt ?? now,
  updatedAt: now,
}
```

Import `AdminEventConfig` + `DEFAULT_BRANDING` from `@ziggy/shared`.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ziggy/api typecheck
```

Fix any remaining `apiKey` references in the api package. Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add packages/api/
git commit -m "fix(api): drop apiKey from admin event config write path"
```

### Task 1.3: Explicit public projection on `GET /api/events/:slug/config`

**Files:**
- Modify: `packages/api/src/routes/events.ts:24-56`
- Create: `packages/api/src/routes/events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/routes/events.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

// Mock cosmos before importing the route
vi.mock('../lib/cosmos.js', () => ({
  findById: vi.fn(),
  findAll: vi.fn(async () => []),
}))
vi.mock('../env.js', () => ({
  getEnv: () => ({
    eventSlug: 'test-event',
    runEventsApiKey: 'test-key',
    nodeEnv: 'test',
  }),
}))

import { findById } from '../lib/cosmos.js'
import events from './events.js'

const SECRET_KEYS = ['apiKey', 'passwordHash', 'connectionString', 'token', 'secret', 'clientSecret']

function assertNoSecretShapedKeys(obj: unknown, path = '$'): void {
  if (obj === null || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    for (const secret of SECRET_KEYS) {
      if (k.toLowerCase().includes(secret.toLowerCase())) {
        throw new Error(`Secret-shaped key "${k}" at ${path}`)
      }
    }
    assertNoSecretShapedKeys(v, `${path}.${k}`)
  }
}

describe('GET /api/events/:slug/config', () => {
  const app = new Hono().route('/', events)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no secret-shaped keys even when Cosmos doc contains them', async () => {
    vi.mocked(findById).mockResolvedValueOnce({
      id: 'test-event',
      slug: 'test-event',
      name: 'Test',
      timezone: 'Europe/Amsterdam',
      languages: ['en'],
      defaultLanguage: 'en',
      branding: { primaryColor: '#000', secondaryColor: '#fff', backgroundColor: '#fff', textColor: '#000' },
      days: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      // Simulated leak — should be projected out
      apiKey: 'LEAK-123',
      passwordHash: 'LEAK-456',
    } as never)

    const res = await app.request('/api/events/test-event/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    assertNoSecretShapedKeys(body)
  })

  it('falls back to defaults when Cosmos is unavailable and still returns no secrets', async () => {
    vi.mocked(findById).mockRejectedValueOnce(new Error('cosmos down'))
    const res = await app.request('/api/events/test-event/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    assertNoSecretShapedKeys(body)
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @ziggy/api test -- events.test
```

Expected: FAIL — current code uses `return c.json(config)` which leaks all fields.

- [ ] **Step 3: Fix the route**

Replace `events.ts:29-34` (the `if (config) return c.json(config)` branch) with an explicit projection:

```ts
if (config) {
  const publicConfig: PublicEventConfig = {
    slug: config.slug,
    name: config.name,
    timezone: config.timezone,
    languages: config.languages,
    defaultLanguage: config.defaultLanguage,
    branding: config.branding,
    days: config.days,
    startDate: config.startDate,
    endDate: config.endDate,
  }
  return c.json(publicConfig)
}
```

Change the type parameter of `findById` to `AdminEventConfig`. Change the `return c.json({...})` fallback at line 44-55 to use a `PublicEventConfig` literal too. Import `PublicEventConfig` from `@ziggy/shared`.

- [ ] **Step 4: Re-run test**

```bash
pnpm --filter @ziggy/api test -- events.test
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/
git commit -m "fix(api): explicit public projection on /api/events/:slug/config + regression test"
```

### Task 1.4: Scrub script for any existing Cosmos `apiKey` values

**Files:**
- Create: `packages/api/scripts/scrub-apikey.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * Deploy migration: scrub any `apiKey` field from existing Cosmos `events`
 * documents. Runs once; idempotent.
 *
 * Usage: tsx --env-file=.env packages/api/scripts/scrub-apikey.ts
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
```

- [ ] **Step 2: Commit (do NOT run yet — run during deploy)**

```bash
git add packages/api/scripts/scrub-apikey.ts
git commit -m "chore(api): scrub script for legacy apiKey cosmos field"
```

Operator action during deploy window (documented in deploy notes, Task 9.1): run the script once, rotate the run.events key if any document had a value.

### Task 1.5: Lock down `/api/auth/setup`

**Files:**
- Modify: `packages/api/src/env.ts`
- Modify: `packages/api/src/routes/admin.ts:56-85`
- Create: `packages/api/src/routes/admin-setup.test.ts`

- [ ] **Step 1: Add SETUP_TOKEN to env**

Edit `packages/api/src/env.ts`:

```ts
export interface EnvConfig {
  port: number
  eventSlug: string
  runEventsApiKey: string
  nodeEnv: 'development' | 'production' | 'test'
  cosmosConnectionString: string
  jwtSecret: string
  storageConnectionString: string
  setupToken: string
}

export function getEnv(): EnvConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    eventSlug: process.env.EVENT_SLUG || 'experts-live-netherlands-2026',
    runEventsApiKey: process.env.RUN_EVENTS_API_KEY || '',
    nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development',
    cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING || '',
    jwtSecret: process.env.JWT_SECRET || crypto.randomUUID() + crypto.randomUUID(),
    storageConnectionString: process.env.STORAGE_CONNECTION_STRING || '',
    setupToken: process.env.SETUP_TOKEN || '',
  }
}
```

- [ ] **Step 2: Write failing tests for the locked-down handler**

Create `packages/api/src/routes/admin-setup.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

const adminsItems: { email: string }[] = []

vi.mock('../lib/cosmos.js', () => ({
  getContainer: () => ({
    items: {
      query: () => ({ fetchAll: async () => ({ resources: adminsItems }) }),
      upsert: vi.fn(),
    },
  }),
  findAll: vi.fn(async () => []),
  findById: vi.fn(),
  upsert: vi.fn(),
  deleteItem: vi.fn(),
}))

vi.mock('../env.js', () => ({
  getEnv: () => ({
    setupToken: 'correct-token',
    jwtSecret: 'x'.repeat(32),
    nodeEnv: 'test',
  }),
}))

vi.mock('../lib/auth.js', () => ({
  signToken: () => 'fake-jwt',
  hashPassword: async () => 'hashed',
  comparePassword: async () => false,
}))

import admin from './admin.js'

describe('POST /api/auth/setup', () => {
  const app = new Hono().route('/', admin)

  beforeEach(() => {
    adminsItems.length = 0
  })

  it('returns 503 when SETUP_TOKEN env unset', async () => {
    vi.doMock('../env.js', () => ({
      getEnv: () => ({ setupToken: '', jwtSecret: 'x'.repeat(32), nodeEnv: 'test' }),
    }))
    // Re-import
    const { default: adminFresh } = await import('./admin.js?t=1')
    const app2 = new Hono().route('/', adminFresh)
    const res = await app2.request('/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b', password: 'x' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 401 when X-Setup-Token missing or wrong', async () => {
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b', password: 'x' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when an admin already exists, regardless of token', async () => {
    adminsItems.push({ email: 'existing@x' })
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-setup-token': 'correct-token',
      },
      body: JSON.stringify({ email: 'a@b', password: 'x' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 201 when token correct and no admin exists', async () => {
    const res = await app.request('/api/auth/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-setup-token': 'correct-token',
      },
      body: JSON.stringify({ email: 'a@b', password: 'password123' }),
    })
    expect(res.status).toBe(201)
  })
})
```

Run: `pnpm --filter @ziggy/api test -- admin-setup.test`
Expected: FAIL (current handler is public + unauthenticated).

- [ ] **Step 3: Implement the lockdown**

Replace the `admin.post('/api/auth/setup', ...)` body in `admin.ts:57-85` with:

```ts
admin.post('/api/auth/setup', async (c) => {
  const env = getEnv()
  if (!env.setupToken) {
    return c.json({ error: 'Setup disabled' }, 503)
  }

  const providedToken = c.req.header('X-Setup-Token') || ''
  if (providedToken !== env.setupToken) {
    return c.json({ error: 'Invalid setup token' }, 401)
  }

  const container = getContainer('admins')
  const { resources } = await container.items
    .query<Admin>({ query: 'SELECT * FROM c' })
    .fetchAll()

  if (resources.length > 0) {
    return c.json({ error: 'Admin already exists. Setup is disabled.' }, 403)
  }

  const body = await c.req.json<LoginRequest>()
  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const newAdmin: Admin = {
    id: 'bootstrap',
    email: body.email,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date().toISOString(),
  }

  try {
    await upsert('admins', newAdmin)
  } catch (err) {
    // Race: another request created the bootstrap admin first.
    return c.json({ error: 'Admin already exists.' }, 409)
  }

  const token = signToken(newAdmin)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  return c.json({ token, expiresAt }, 201)
})
```

Add `import { getEnv } from '../env.js'` at top of file if missing.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ziggy/api test -- admin-setup.test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/
git commit -m "fix(api): lock down /api/auth/setup behind SETUP_TOKEN + fixed bootstrap id"
```

---

## Phase 2 — Security P1s

### Task 2.1: Fail-fast env validation

**Files:**
- Modify: `packages/api/src/env.ts`
- Create: `packages/api/src/env.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getEnv } from './env.js'

describe('getEnv in production', () => {
  const orig = { ...process.env }

  beforeEach(() => {
    process.env = { ...orig }
  })

  afterEach(() => {
    process.env = orig
  })

  it('throws when JWT_SECRET missing in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/JWT_SECRET/)
  })

  it('throws when JWT_SECRET shorter than 32 chars', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'short'
    process.env.COSMOS_CONNECTION_STRING = 'cs'
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/JWT_SECRET/)
  })

  it('throws when COSMOS_CONNECTION_STRING missing in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(32)
    delete process.env.COSMOS_CONNECTION_STRING
    process.env.STORAGE_CONNECTION_STRING = 'cs'
    process.env.RUN_EVENTS_API_KEY = 'k'
    expect(() => getEnv()).toThrow(/COSMOS/)
  })

  it('does not throw in development when secrets missing', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(() => getEnv()).not.toThrow()
  })
})
```

Run: `pnpm --filter @ziggy/api test -- env.test`
Expected: FAIL.

- [ ] **Step 2: Implement fail-fast**

Replace `packages/api/src/env.ts`:

```ts
export interface EnvConfig {
  port: number
  eventSlug: string
  runEventsApiKey: string
  nodeEnv: 'development' | 'production' | 'test'
  cosmosConnectionString: string
  jwtSecret: string
  storageConnectionString: string
  setupToken: string
}

function requireInProd(name: string, value: string, nodeEnv: string): void {
  if (nodeEnv === 'production' && !value) {
    throw new Error(`${name} must be set in production`)
  }
}

export function getEnv(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development'
  const jwtSecret =
    process.env.JWT_SECRET ||
    (nodeEnv === 'production' ? '' : crypto.randomUUID() + crypto.randomUUID())

  if (nodeEnv === 'production') {
    requireInProd('JWT_SECRET', process.env.JWT_SECRET || '', nodeEnv)
    if ((process.env.JWT_SECRET || '').length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production')
    }
    requireInProd('COSMOS_CONNECTION_STRING', process.env.COSMOS_CONNECTION_STRING || '', nodeEnv)
    requireInProd('STORAGE_CONNECTION_STRING', process.env.STORAGE_CONNECTION_STRING || '', nodeEnv)
    requireInProd('RUN_EVENTS_API_KEY', process.env.RUN_EVENTS_API_KEY || '', nodeEnv)
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    eventSlug: process.env.EVENT_SLUG || 'experts-live-netherlands-2026',
    runEventsApiKey: process.env.RUN_EVENTS_API_KEY || '',
    nodeEnv,
    cosmosConnectionString: process.env.COSMOS_CONNECTION_STRING || '',
    jwtSecret,
    storageConnectionString: process.env.STORAGE_CONNECTION_STRING || '',
    setupToken: process.env.SETUP_TOKEN || '',
  }
}
```

Run tests: `pnpm --filter @ziggy/api test -- env.test`. Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add packages/api/
git commit -m "feat(api): fail-fast env validation in production"
```

### Task 2.2: Explicit JWT verification options

**Files:**
- Modify: `packages/api/src/lib/auth.ts`
- Create: `packages/api/src/lib/auth.test.ts`

- [ ] **Step 1: Read current file**

Read `packages/api/src/lib/auth.ts`. Identify `signToken` and `verifyToken` implementations.

- [ ] **Step 2: Failing test**

Create `packages/api/src/lib/auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../env.js', () => ({
  getEnv: () => ({ jwtSecret: 'x'.repeat(32), nodeEnv: 'test' }),
}))

import { signToken, verifyToken } from './auth.js'

describe('JWT auth', () => {
  const adminStub = { id: 'a1', email: 'e@x', passwordHash: 'h', createdAt: '' }

  it('signs with ziggy issuer + ziggy-admin audience', () => {
    const token = signToken(adminStub as never)
    const decoded = jwt.decode(token) as jwt.JwtPayload
    expect(decoded.iss).toBe('ziggy')
    expect(decoded.aud).toBe('ziggy-admin')
  })

  it('rejects tokens signed with wrong issuer', () => {
    const bad = jwt.sign({ sub: 'a1', email: 'e@x' }, 'x'.repeat(32), {
      issuer: 'attacker',
      audience: 'ziggy-admin',
    })
    expect(() => verifyToken(bad)).toThrow()
  })

  it('rejects tokens signed with wrong audience', () => {
    const bad = jwt.sign({ sub: 'a1', email: 'e@x' }, 'x'.repeat(32), {
      issuer: 'ziggy',
      audience: 'other',
    })
    expect(() => verifyToken(bad)).toThrow()
  })

  it('rejects tokens signed with different algorithm (none)', () => {
    const bad = jwt.sign({ sub: 'a1' }, '', { algorithm: 'none' as never })
    expect(() => verifyToken(bad)).toThrow()
  })

  it('accepts a freshly signed token', () => {
    const token = signToken(adminStub as never)
    const payload = verifyToken(token)
    expect(payload.email).toBe('e@x')
  })
})
```

Run. Expected: FAIL.

- [ ] **Step 3: Update auth.ts**

Replace `signToken` + `verifyToken` with explicit options:

```ts
import jwt from 'jsonwebtoken'
import type { Admin } from '@ziggy/shared'
import { getEnv } from '../env.js'

const ISSUER = 'ziggy'
const AUDIENCE = 'ziggy-admin'
const ALGO = 'HS256' as const

export interface TokenPayload {
  sub: string
  email: string
}

export function signToken(admin: Admin): string {
  const env = getEnv()
  return jwt.sign({ email: admin.email }, env.jwtSecret, {
    subject: admin.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: ALGO,
    expiresIn: '24h',
  })
}

export function verifyToken(token: string): TokenPayload {
  const env = getEnv()
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: [ALGO],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (typeof decoded === 'string') throw new Error('Malformed token')
  return {
    sub: String(decoded.sub ?? ''),
    email: String((decoded as jwt.JwtPayload).email ?? ''),
  }
}

// Preserve existing exports (hashPassword, comparePassword) — copy from original file.
export { hashPassword, comparePassword } from './auth-passwords.js'
```

If `hashPassword`/`comparePassword` were previously in `auth.ts`, move them to a new file `auth-passwords.ts` (straight copy, no behavior change) to keep concerns separate.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ziggy/api test -- auth.test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/
git commit -m "feat(api): explicit JWT algorithm/issuer/audience + subject claim"
```

### Task 2.3: Login + setup rate limiting

**Files:**
- Create: `packages/api/src/middleware/rate-limit.ts`
- Create: `packages/api/src/middleware/rate-limit.test.ts`
- Modify: `packages/api/src/routes/admin.ts` (login + setup handlers)

- [ ] **Step 1: Failing test**

Create `packages/api/src/middleware/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLoginRateLimiter } from './rate-limit.js'

describe('createLoginRateLimiter', () => {
  const NOW = 1_000_000_000
  let now = NOW
  const clock = () => now

  beforeEach(() => {
    now = NOW
  })

  it('allows first 5 failed attempts from same ip+email', () => {
    const rl = createLoginRateLimiter({ max: 5, windowMs: 15 * 60_000, clock })
    for (let i = 0; i < 5; i++) {
      expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
      rl.recordFailure('1.2.3.4', 'a@b')
    }
    expect(rl.check('1.2.3.4', 'a@b')).toBe(false)
  })

  it('clears counter on success', () => {
    const rl = createLoginRateLimiter({ max: 5, windowMs: 15 * 60_000, clock })
    for (let i = 0; i < 4; i++) rl.recordFailure('1.2.3.4', 'a@b')
    rl.recordSuccess('1.2.3.4', 'a@b')
    for (let i = 0; i < 5; i++) expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
  })

  it('resets after window elapses', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 1000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.2.3.4', 'a@b')
    expect(rl.check('1.2.3.4', 'a@b')).toBe(false)
    now = NOW + 2000
    expect(rl.check('1.2.3.4', 'a@b')).toBe(true)
  })

  it('isolates different ips', () => {
    const rl = createLoginRateLimiter({ max: 3, windowMs: 60_000, clock })
    for (let i = 0; i < 3; i++) rl.recordFailure('1.1.1.1', 'a@b')
    expect(rl.check('1.1.1.1', 'a@b')).toBe(false)
    expect(rl.check('2.2.2.2', 'a@b')).toBe(true)
  })
})
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

Create `packages/api/src/middleware/rate-limit.ts`:

```ts
interface Bucket {
  count: number
  resetAt: number
}

export interface LoginRateLimiter {
  check(ip: string, email: string): boolean
  recordFailure(ip: string, email: string): void
  recordSuccess(ip: string, email: string): void
}

export function createLoginRateLimiter(opts: {
  max: number
  windowMs: number
  clock?: () => number
}): LoginRateLimiter {
  const clock = opts.clock ?? Date.now
  const buckets = new Map<string, Bucket>()
  const key = (ip: string, email: string) => `${ip}::${email.toLowerCase()}`

  function current(ip: string, email: string): Bucket {
    const k = key(ip, email)
    const b = buckets.get(k)
    const now = clock()
    if (!b || now >= b.resetAt) {
      const fresh = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(k, fresh)
      return fresh
    }
    return b
  }

  return {
    check(ip, email) {
      return current(ip, email).count < opts.max
    },
    recordFailure(ip, email) {
      current(ip, email).count++
    },
    recordSuccess(ip, email) {
      buckets.delete(key(ip, email))
    },
  }
}

export const loginRateLimiter = createLoginRateLimiter({
  max: 5,
  windowMs: 15 * 60_000,
})
```

- [ ] **Step 3: Wire into login + setup handlers**

In `admin.ts`, import `loginRateLimiter` and apply:

```ts
import { loginRateLimiter } from '../middleware/rate-limit.js'

// Helper to get best-effort client IP
function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}
```

In the login handler, at the top:

```ts
const ip = clientIp(c)
const email = (body.email || '').toLowerCase()
if (!loginRateLimiter.check(ip, email)) {
  return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
}
```

After a successful password compare:

```ts
loginRateLimiter.recordSuccess(ip, email)
```

After a failed password compare (invalid email or password branches):

```ts
loginRateLimiter.recordFailure(ip, email)
```

Do the same in the `/api/auth/setup` handler (body.email + ip), only recording success when the 201 is about to return.

- [ ] **Step 4: Run API tests + commit**

```bash
pnpm --filter @ziggy/api test
git add packages/api/
git commit -m "feat(api): per-ip+email rate limit on login and setup"
```

### Task 2.4: Dependency updates + `pnpm audit` in CI

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/kiosk/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Remove unused dep and update**

```bash
pnpm --filter @ziggy/kiosk remove i18next-http-backend
pnpm --filter @ziggy/api update hono @hono/node-server
pnpm --filter @ziggy/api update @azure/storage-blob @azure/cosmos
```

Verify `hono >= 4.12.14` and `@hono/node-server >= 1.19.13` in the resulting `package.json` and lock.

- [ ] **Step 2: Re-grep for any i18next-http-backend import**

```bash
grep -rn "i18next-http-backend" packages/kiosk/src
```

Expected: no results. If any, delete those imports.

- [ ] **Step 3: Audit locally**

```bash
pnpm audit --prod --audit-level=high
```

If still reporting findings after the update, add `pnpm.overrides` in root `package.json` for stuck transitive deps (e.g. `fast-xml-parser`). Re-run until exit 0.

- [ ] **Step 4: Add audit step to CI**

Read current `.github/workflows/ci.yml`. Add step after install:

```yaml
      - name: Security audit (prod, high+)
        run: pnpm audit --prod --audit-level=high
```

- [ ] **Step 5: Typecheck + build**

```bash
pnpm typecheck && pnpm build
```

Fix any typing regressions from the Hono/Azure bumps.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore(deps): patch vulnerable deps, drop unused i18next-http-backend, audit in CI"
```

### Task 2.5: Add `zod` + schemas module

**Files:**
- Modify: `packages/api/package.json`
- Create: `packages/api/src/schemas/admin.ts`
- Create: `packages/api/src/schemas/admin.test.ts`

- [ ] **Step 1: Install zod**

```bash
pnpm --filter @ziggy/api add zod
```

- [ ] **Step 2: Write failing schema tests**

Create `packages/api/src/schemas/admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  SponsorSchema,
  SponsorTierSchema,
  FloorMapSchema,
  EventConfigSchema,
  I18nOverridesSchema,
} from './admin.js'

describe('SponsorSchema', () => {
  const base = {
    name: 'ACME',
    tierId: '11111111-2222-3333-4444-555555555555',
    logoUrl: 'https://cdn.example.com/logo.png',
    description: { en: 'Hello', nl: 'Hallo' },
    sortOrder: 0,
  }

  it('accepts a valid sponsor', () => {
    expect(SponsorSchema.safeParse(base).success).toBe(true)
  })

  it('rejects http (non-https) logo URL', () => {
    const r = SponsorSchema.safeParse({ ...base, logoUrl: 'http://x/y.png' })
    expect(r.success).toBe(false)
  })

  it('rejects non-string name', () => {
    expect(SponsorSchema.safeParse({ ...base, name: 123 }).success).toBe(false)
  })

  it('rejects description values over 2000 chars', () => {
    const big = { ...base, description: { en: 'x'.repeat(2001) } }
    expect(SponsorSchema.safeParse(big).success).toBe(false)
  })

  it('rejects description with unknown language key', () => {
    const bad = { ...base, description: { xx: 'hi' } }
    expect(SponsorSchema.safeParse(bad).success).toBe(false)
  })
})

describe('FloorMapSchema', () => {
  const base = {
    name: 'Main floor',
    imageUrl: 'https://cdn.example.com/map.png',
    label: { en: 'Main', nl: 'Hoofd' },
    sortOrder: 0,
    hotspots: [
      {
        id: 'h1',
        roomName: 'Room A',
        label: { en: 'A', nl: 'A' },
        points: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][],
      },
    ],
  }

  it('accepts valid map', () => {
    expect(FloorMapSchema.safeParse(base).success).toBe(true)
  })

  it('rejects more than 100 hotspots', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ ...base.hotspots[0], id: `h${i}` }))
    expect(FloorMapSchema.safeParse({ ...base, hotspots: many }).success).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    const bad = {
      ...base,
      hotspots: [{ ...base.hotspots[0], points: [[0, 0], [99999, 0], [0, 10]] as [number, number][] }],
    }
    expect(FloorMapSchema.safeParse(bad).success).toBe(false)
  })
})

describe('EventConfigSchema', () => {
  it('rejects invalid hex color', () => {
    const bad = {
      name: 'x', timezone: 'Europe/Amsterdam',
      languages: ['en'], defaultLanguage: 'en',
      days: [], branding: { primaryColor: 'red', secondaryColor: '#000000', backgroundColor: '#000000', textColor: '#000000' },
    }
    expect(EventConfigSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects unknown language code', () => {
    const bad = {
      name: 'x', timezone: 'Europe/Amsterdam',
      languages: ['xx'], defaultLanguage: 'xx',
      days: [], branding: { primaryColor: '#000000', secondaryColor: '#000000', backgroundColor: '#000000', textColor: '#000000' },
    }
    expect(EventConfigSchema.safeParse(bad).success).toBe(false)
  })
})

describe('I18nOverridesSchema', () => {
  it('rejects override value over 1000 chars', () => {
    const bad = { overrides: { 'k': 'x'.repeat(1001) } }
    expect(I18nOverridesSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects more than 500 keys', () => {
    const bigObj: Record<string, string> = {}
    for (let i = 0; i < 501; i++) bigObj[`k${i}`] = 'v'
    expect(I18nOverridesSchema.safeParse({ overrides: bigObj }).success).toBe(false)
  })
})

describe('SponsorTierSchema', () => {
  it('rejects invalid displaySize', () => {
    const bad = {
      name: 'Gold', label: { en: 'Gold' }, sortOrder: 0, displaySize: 'xl',
    }
    expect(SponsorTierSchema.safeParse(bad).success).toBe(false)
  })
})
```

Run. Expected: FAIL (schemas don't exist yet).

- [ ] **Step 3: Implement schemas**

Create `packages/api/src/schemas/admin.ts`:

```ts
import { z } from 'zod'
import { SUPPORTED_LANGUAGES } from '@ziggy/shared'

const language = z.enum(SUPPORTED_LANGUAGES as [string, ...string[]])

const i18nStringRecord = z.record(language, z.string().max(2000)).refine(
  (obj) => Object.keys(obj).length <= SUPPORTED_LANGUAGES.length,
  { message: 'Too many language keys' },
)

const httpsUrl = z.string().url().refine(
  (u) => u.startsWith('https://'),
  { message: 'Only https URLs allowed' },
)

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb')

const point = z.tuple([
  z.number().min(0).max(10_000),
  z.number().min(0).max(10_000),
])

export const SponsorSchema = z.object({
  name: z.string().min(1).max(200),
  tierId: z.string().uuid(),
  logoUrl: httpsUrl,
  website: httpsUrl.optional(),
  boothNumber: z.string().max(20).optional(),
  description: i18nStringRecord,
  sortOrder: z.number().int().min(0).max(10_000),
})

export const SponsorTierSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.record(language, z.string().max(200)),
  sortOrder: z.number().int().min(0).max(10_000),
  displaySize: z.enum(['large', 'medium', 'small']),
})

const HotspotSchema = z.object({
  id: z.string().min(1).max(100),
  roomName: z.string().max(200),
  roomGuid: z.string().max(100).optional(),
  label: z.record(language, z.string().max(200)),
  points: z.array(point).min(3).max(50),
})

export const FloorMapSchema = z.object({
  name: z.string().min(1).max(200),
  imageUrl: httpsUrl,
  label: z.record(language, z.string().max(200)),
  sortOrder: z.number().int().min(0).max(10_000),
  hotspots: z.array(HotspotSchema).max(100),
})

export const EventConfigSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(60),
  languages: z.array(language).min(1).max(SUPPORTED_LANGUAGES.length),
  defaultLanguage: language,
  branding: z.object({
    primaryColor: hexColor,
    secondaryColor: hexColor,
    backgroundColor: hexColor,
    textColor: hexColor,
    logoUrl: httpsUrl.optional(),
    fontFamily: z.string().max(100).optional(),
  }),
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    label: z.record(language, z.string().max(200)),
  })).max(14),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const I18nOverridesSchema = z.object({
  overrides: z.record(z.string().max(200), z.string().max(1000)).refine(
    (obj) => Object.keys(obj).length <= 500,
    { message: 'Max 500 override keys' },
  ),
})

export const BoothOverrideSchema = z.object({
  floorMapHotspotId: z.string().min(1).max(100).optional(),
})
```

Ensure `@ziggy/shared` exports `SUPPORTED_LANGUAGES` as a tuple of language codes (e.g. `['nl', 'en', 'de', 'fr'] as const`). If not:

Edit `packages/shared/src/constants.ts` (or wherever languages live) to export:

```ts
export const SUPPORTED_LANGUAGES = ['nl', 'en', 'de', 'fr'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]
```

Rebuild shared: `pnpm build:shared`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ziggy/api test -- admin.test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(api): zod schemas for admin write paths"
```

### Task 2.6: Apply schemas to admin routes + body size limit

**Files:**
- Modify: `packages/api/src/routes/admin.ts` (all admin write handlers)
- Modify: `packages/api/src/index.ts` (body size)

- [ ] **Step 1: Body size middleware**

Edit `packages/api/src/index.ts` to add a JSON body size guard before routes mount:

```ts
import { bodyLimit } from 'hono/body-limit'

app.use('/api/admin/*', async (c, next) => {
  // Exempt upload route — it has its own 25 MB limit
  if (c.req.path === '/api/admin/upload') return next()
  const lim = bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: 'Request body too large' }, 413) })
  return lim(c, next)
})
```

- [ ] **Step 2: Apply SponsorSchema**

In `admin.ts`, for the `POST /api/admin/events/:slug/sponsors` handler replace the body parse:

```ts
const body = await c.req.json()
const parsed = SponsorSchema.safeParse(body)
if (!parsed.success) {
  return c.json({ error: 'Invalid sponsor payload', issues: parsed.error.issues }, 400)
}
const data = parsed.data

const sponsor: Sponsor = {
  id: crypto.randomUUID(),
  eventSlug: slug,
  name: data.name,
  tierId: data.tierId,
  description: data.description,
  logoUrl: data.logoUrl,
  website: data.website,
  boothNumber: data.boothNumber,
  sortOrder: data.sortOrder,
  createdAt: now,
  updatedAt: now,
}
```

Add `import { SponsorSchema } from '../schemas/admin.js'`.

For the `PUT` handler, use `SponsorSchema.partial()` to allow partial updates, but merge only allowlisted keys:

```ts
const parsed = SponsorSchema.partial().safeParse(body)
if (!parsed.success) return c.json({ error: 'Invalid sponsor payload', issues: parsed.error.issues }, 400)
const patch = parsed.data

const updated: Sponsor = {
  ...existing,
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.tierId !== undefined && { tierId: patch.tierId }),
  ...(patch.logoUrl !== undefined && { logoUrl: patch.logoUrl }),
  ...(patch.website !== undefined && { website: patch.website }),
  ...(patch.boothNumber !== undefined && { boothNumber: patch.boothNumber }),
  ...(patch.description !== undefined && { description: patch.description }),
  ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
  id,
  eventSlug: slug,
  updatedAt: new Date().toISOString(),
}
```

- [ ] **Step 3: Repeat for tiers, floor maps, event config, i18n overrides**

Apply the same pattern in the POST + PUT handlers for:
- `SponsorTierSchema` — tiers
- `FloorMapSchema` — floor maps
- `EventConfigSchema` — event config (PUT only exists — use `.partial()`)
- `I18nOverridesSchema` — i18n overrides

No `...body` spreads remain. Use only parsed/allowlisted fields.

- [ ] **Step 4: Limit search query length**

In `packages/api/src/routes/events.ts:147-167`, after reading `query`:

```ts
if (query.length > 100) {
  return c.json({ error: 'Query too long (max 100 characters)' }, 400)
}
```

- [ ] **Step 5: Add upstream fetch timeout**

In `packages/api/src/lib/run-events.ts:29-35`, wrap fetch with a 10s abort:

```ts
const response = await fetch(url, {
  method,
  headers: { ApiKey: apiKey, 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(10_000),
})
```

- [ ] **Step 6: Run API tests + typecheck**

```bash
pnpm --filter @ziggy/api test
pnpm --filter @ziggy/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/
git commit -m "feat(api): apply zod schemas to admin writes, add body size limit + fetch timeout"
```

### Task 2.7: Upload hardening

**Files:**
- Create: `packages/api/src/lib/magic-bytes.ts`
- Create: `packages/api/src/lib/magic-bytes.test.ts`
- Modify: `packages/api/src/routes/admin.ts` (upload handler)
- Modify: `packages/api/src/lib/storage.ts`

- [ ] **Step 1: Write failing test for magic-byte sniff**

Create `packages/api/src/lib/magic-bytes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectImageType } from './magic-bytes.js'

describe('detectImageType', () => {
  it('detects JPEG', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(detectImageType(buf.buffer)).toBe('image/jpeg')
  })

  it('detects PNG', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(detectImageType(buf.buffer)).toBe('image/png')
  })

  it('detects WebP', () => {
    const buf = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ])
    expect(detectImageType(buf.buffer)).toBe('image/webp')
  })

  it('rejects SVG (text content)', () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?><svg/>')
    expect(detectImageType(svg.buffer)).toBeNull()
  })

  it('rejects GIF', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectImageType(gif.buffer)).toBeNull()
  })

  it('rejects too-short buffer', () => {
    expect(detectImageType(new Uint8Array([0x00]).buffer)).toBeNull()
  })
})
```

Run. Expected: FAIL.

- [ ] **Step 2: Implement**

Create `packages/api/src/lib/magic-bytes.ts`:

```ts
export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp'

const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP = [0x57, 0x45, 0x42, 0x50]

function startsWith(view: Uint8Array, prefix: number[]): boolean {
  if (view.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) if (view[i] !== prefix[i]) return false
  return true
}

function hasAt(view: Uint8Array, offset: number, bytes: number[]): boolean {
  if (view.length < offset + bytes.length) return false
  for (let i = 0; i < bytes.length; i++) if (view[offset + i] !== bytes[i]) return false
  return true
}

export function detectImageType(buf: ArrayBuffer): AllowedImageType | null {
  const view = new Uint8Array(buf)
  if (startsWith(view, JPEG)) return 'image/jpeg'
  if (startsWith(view, PNG)) return 'image/png'
  if (startsWith(view, RIFF) && hasAt(view, 8, WEBP)) return 'image/webp'
  return null
}

export function extensionFor(type: AllowedImageType): string {
  switch (type) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
  }
}
```

Run tests. Expected: pass.

- [ ] **Step 3: Harden upload handler**

In `admin.ts`, replace the `/api/admin/upload` handler body:

```ts
admin.post('/api/admin/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided. Send a "file" field as multipart form data.' }, 400)
  }

  const maxSize = 25 * 1024 * 1024
  if (file.size > maxSize) {
    return c.json({ error: 'File too large. Maximum size is 25 MB.' }, 400)
  }

  const buffer = await file.arrayBuffer()
  const detected = detectImageType(buffer)
  if (!detected) {
    return c.json({ error: 'Unsupported file type. Only JPEG, PNG, WebP accepted.' }, 400)
  }

  try {
    const url = await uploadImage(buffer, file.name, detected)
    return c.json({ url })
  } catch (err) {
    console.error('[admin/upload] failed')
    return c.json({ error: 'Failed to upload image' }, 500)
  }
})
```

Add imports: `import { detectImageType } from '../lib/magic-bytes.js'`.

- [ ] **Step 4: Update storage.ts**

Edit `packages/api/src/lib/storage.ts`:

- `uploadImage` signature accepts the detected MIME (already a 3rd arg, but must now be an `AllowedImageType`).
- Derive extension via `extensionFor(type)`, NOT from `filename`.
- Set blob headers on upload: `blobHTTPHeaders: { blobContentType: type, blobCacheControl: 'public, max-age=31536000, immutable', blobContentDisposition: 'inline' }`.
- Blob name: `${crypto.randomUUID()}${extensionFor(type)}`.

Full modified file:

```ts
import { BlobServiceClient, type BlockBlobParallelUploadOptions } from '@azure/storage-blob'
import { getEnv } from '../env.js'
import { type AllowedImageType, extensionFor } from './magic-bytes.js'

const CONTAINER = 'images'

let _client: BlobServiceClient | null = null
function client(): BlobServiceClient {
  if (_client) return _client
  const env = getEnv()
  _client = BlobServiceClient.fromConnectionString(env.storageConnectionString)
  return _client
}

export async function uploadImage(
  buffer: ArrayBuffer,
  _filename: string,
  type: AllowedImageType,
): Promise<string> {
  const container = client().getContainerClient(CONTAINER)
  const blobName = `${crypto.randomUUID()}${extensionFor(type)}`
  const blob = container.getBlockBlobClient(blobName)
  const options: BlockBlobParallelUploadOptions = {
    blobHTTPHeaders: {
      blobContentType: type,
      blobCacheControl: 'public, max-age=31536000, immutable',
      blobContentDisposition: 'inline',
    },
    metadata: { 'x-content-type-options': 'nosniff' },
  }
  await blob.uploadData(Buffer.from(buffer), options)
  return blob.url
}
```

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @ziggy/api typecheck
pnpm --filter @ziggy/api test
git add packages/api/
git commit -m "fix(api): upload hardening — magic-byte sniff, reject svg/gif, derived extension"
```

### Task 2.8: Security headers — SWA + Hono

**Files:**
- Modify: `packages/kiosk/staticwebapp.config.json`
- Modify: `packages/admin/staticwebapp.config.json`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Read current SWA configs**

```bash
cat packages/kiosk/staticwebapp.config.json
cat packages/admin/staticwebapp.config.json
```

- [ ] **Step 2: Add globalHeaders to kiosk SWA config**

Merge this block into `packages/kiosk/staticwebapp.config.json` (keep existing `navigationFallback`):

```json
{
  "navigationFallback": { "rewrite": "/index.html" },
  "globalHeaders": {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
  }
}
```

Same additions to `packages/admin/staticwebapp.config.json`.

- [ ] **Step 3: Add Hono secureHeaders**

In `packages/api/src/index.ts`, import and mount before routes:

```ts
import { secureHeaders } from 'hono/secure-headers'

app.use('*', secureHeaders({
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
}))
```

Mount after `logger()` and after CORS so CORS headers aren't squashed.

- [ ] **Step 4: Local smoke test**

```bash
pnpm --filter @ziggy/api dev &
sleep 2
curl -I http://localhost:3001/api/health
```

Expected: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` in response.

Kill the server.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk/staticwebapp.config.json packages/admin/staticwebapp.config.json packages/api/
git commit -m "feat: security headers (SWA globalHeaders + Hono secureHeaders)"
```

### Task 2.9: Logging redaction

**Files:**
- Modify: `packages/api/src/lib/run-events.ts:37-39`

- [ ] **Step 1: Replace error log**

In `run-events.ts:37-39`, replace:

```ts
if (!response.ok) {
  const body = await response.text().catch(() => 'Unknown error')
  throw new Error(`run.events API error ${response.status} for ${method} ${path}: ${body}`)
}
```

with:

```ts
if (!response.ok) {
  throw new Error(`run.events API error ${response.status} for ${method} ${path}`)
}
```

Upstream response body can contain request echoes; we keep status + path only.

- [ ] **Step 2: Commit**

```bash
git add packages/api/
git commit -m "fix(api): redact upstream error body from logs"
```

---

## Phase 3 — Reliability

### Task 3.1: Stale-while-error cache layer

**Files:**
- Modify: `packages/api/src/lib/cache.ts`
- Create: `packages/api/src/lib/cache.test.ts`

- [ ] **Step 1: Failing tests**

Create `packages/api/src/lib/cache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import * as cache from './cache.js'

describe('cache last-good layer', () => {
  beforeEach(() => cache.clear())

  it('returns live value when fresh', () => {
    cache.set('k', 'v1', 1000)
    expect(cache.get<string>('k')).toBe('v1')
    expect(cache.getOrStale<string>('k')).toBe('v1')
  })

  it('returns last-good when live has expired', () => {
    cache.set('k', 'v1', 1)
    // wait past TTL
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cache.get<string>('k')).toBeUndefined()
        expect(cache.getOrStale<string>('k')).toBe('v1')
        resolve()
      }, 10)
    })
  })

  it('updates last-good on set', () => {
    cache.set('k', 'v1', 1000)
    cache.set('k', 'v2', 1000)
    expect(cache.getOrStale<string>('k')).toBe('v2')
  })

  it('returns undefined when neither live nor last-good exist', () => {
    expect(cache.getOrStale<string>('missing')).toBeUndefined()
  })
})
```

Run. Expected: FAIL (`getOrStale` doesn't exist).

- [ ] **Step 2: Implement**

Replace `packages/api/src/lib/cache.ts`:

```ts
import { CACHE_TTL_MS } from '@ziggy/shared'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const live = new Map<string, CacheEntry<unknown>>()
const lastGood = new Map<string, unknown>()

export function get<T>(key: string): T | undefined {
  const entry = live.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    live.delete(key)
    return undefined
  }
  return entry.value as T
}

export function getOrStale<T>(key: string): T | undefined {
  const fresh = get<T>(key)
  if (fresh !== undefined) return fresh
  return lastGood.get(key) as T | undefined
}

export function set<T>(key: string, value: T, ttlMs: number = CACHE_TTL_MS): void {
  live.set(key, { value, expiresAt: Date.now() + ttlMs })
  lastGood.set(key, value)
}

export function invalidate(key: string): void {
  live.delete(key)
  lastGood.delete(key)
}

export function clear(): void {
  live.clear()
  lastGood.clear()
}

export function hasLastGood(key: string): boolean {
  return lastGood.has(key)
}
```

- [ ] **Step 3: Apply stale-on-error in run-events.ts**

In `fetchAgenda`, `fetchRawAgenda`, `fetchSpeakers`, `fetchBooths`, `fetchPartnerships`, wrap the fetch+transform in try/catch and fall back to last-good:

```ts
export async function fetchAgenda(apiKey: string, slug: string): Promise<Agenda> {
  const cacheKey = `agenda:${slug}`
  const cached = cache.get<Agenda>(cacheKey)
  if (cached) return cached

  try {
    const items = await request<RunEventsAgendaItem[]>(apiKey, 'POST', `/v2/events/${slug}/agenda`)
    const agenda = transformAgenda(items)
    cache.set(cacheKey, agenda)
    return agenda
  } catch (err) {
    const stale = cache.getOrStale<Agenda>(cacheKey)
    if (stale) {
      console.warn(`[run-events] serving stale agenda for ${slug}: ${(err as Error).message}`)
      return stale
    }
    throw err
  }
}
```

Repeat the pattern for each fetcher.

- [ ] **Step 4: Add `X-Stale: true` header at routes**

In `events.ts`, for each GET route that wraps a runEvents fetcher, check whether the returned value came from stale cache. Simplest approach: let the fetcher optionally return `{ value, stale }` — but that's invasive. Cleaner: compare the cached live entry before/after via `cache.get`:

```ts
events.get('/api/events/:slug/agenda', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const hadLive = cache.get(`agenda:${slug}`) !== undefined
    const agenda = await runEvents.fetchAgenda(apiKey, slug)
    const hasLiveNow = cache.get(`agenda:${slug}`) !== undefined
    const isStale = !hadLive && !hasLiveNow && cache.hasLastGood(`agenda:${slug}`)
    if (isStale) c.header('X-Stale', 'true')
    return c.json(agenda)
  } catch (err) {
    console.error('[events/agenda]', err)
    return c.json({ error: 'Failed to fetch agenda' }, 502)
  }
})
```

Simpler alternative: set `X-Stale` based on whether the fetcher logged a warn. Don't over-engineer — a simpler option: expose `wasLastServeStale` state via cache module. Pick the cleanest one during implementation; the behavior must be:
- 200 + stale data + `X-Stale: true` when live upstream failed AND last-good cache exists
- 200 + fresh data (no header) on happy path
- 502 only when neither live nor last-good exists

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @ziggy/api test
git add packages/api/
git commit -m "feat(api): stale-while-error cache layer, X-Stale header"
```

### Task 3.2: Warmup endpoint

**Files:**
- Create: `packages/api/src/routes/warmup.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `infra/main.bicep`

- [ ] **Step 1: Create route**

Create `packages/api/src/routes/warmup.ts`:

```ts
import { Hono } from 'hono'
import { getEnv } from '../env.js'
import * as runEvents from '../lib/run-events.js'

const warmup = new Hono()

warmup.get('/api/warmup', async (c) => {
  const env = getEnv()
  const slug = env.eventSlug
  const apiKey = env.runEventsApiKey
  if (!apiKey) return c.json({ ok: false, error: 'No API key' }, 503)

  const results = await Promise.allSettled([
    runEvents.fetchRawAgenda(apiKey, slug),
    runEvents.fetchSpeakers(apiKey, slug),
    runEvents.fetchBooths(apiKey, slug),
    runEvents.fetchPartnerships(apiKey, slug),
  ])

  const warmed = results.map((r, i) => ({
    source: ['agenda', 'speakers', 'booths', 'partnerships'][i],
    ok: r.status === 'fulfilled',
  }))

  const allOk = warmed.every((w) => w.ok)
  return c.json({ ok: allOk, warmed }, allOk ? 200 : 503)
})

export default warmup
```

- [ ] **Step 2: Mount**

In `packages/api/src/index.ts`:

```ts
import warmup from './routes/warmup.js'
// ...
app.route('/', warmup)
```

- [ ] **Step 3: Wire readiness probe**

Read `infra/main.bicep`. Find the Container App `containers` array. Add `readinessProbe` and `startupProbe`:

```bicep
probes: [
  {
    type: 'Startup'
    httpGet: { path: '/api/warmup', port: 3001 }
    initialDelaySeconds: 5
    periodSeconds: 10
    failureThreshold: 30
  }
  {
    type: 'Readiness'
    httpGet: { path: '/api/health', port: 3001 }
    periodSeconds: 30
    timeoutSeconds: 5
  }
]
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/ infra/
git commit -m "feat(api): warmup endpoint + Container Apps startup probe"
```

### Task 3.3: Central QueryClient + persistence

**Files:**
- Modify: `packages/kiosk/package.json`
- Create: `packages/kiosk/src/lib/queryClient.ts`
- Modify: `packages/kiosk/src/main.tsx`
- Modify: `packages/kiosk/vite.config.ts`

- [ ] **Step 1: Install**

```bash
pnpm --filter @ziggy/kiosk add \
  @tanstack/react-query-persist-client \
  @tanstack/query-sync-storage-persister
```

- [ ] **Step 2: Expose build hash to client**

Edit `packages/kiosk/vite.config.ts` to inject the build hash:

```ts
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

const buildHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

export default defineConfig({
  // ...
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(buildHash),
  },
})
```

(Merge with whatever is already in the vite config.)

- [ ] **Step 3: QueryClient module**

Create `packages/kiosk/src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'ziggy-query-cache',
})

export const BUILD_HASH = import.meta.env.VITE_BUILD_HASH || 'dev'
```

- [ ] **Step 4: Wire PersistQueryClientProvider**

Edit `packages/kiosk/src/main.tsx`. Replace the existing `QueryClientProvider` with:

```tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, persister, BUILD_HASH } from './lib/queryClient'

// ...

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, buster: BUILD_HASH, maxAge: 24 * 60 * 60 * 1000 }}
>
  <App />
</PersistQueryClientProvider>
```

- [ ] **Step 5: Typecheck, dev run, commit**

```bash
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk dev &
```

Open `http://localhost:5173`, navigate around, reload — second load should hydrate from cache (visible as instant render of the previously-loaded agenda). Kill dev.

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): central QueryClient with retry, backoff, and localStorage persistence"
```

### Task 3.4: Reconnecting banner

**Files:**
- Create: `packages/kiosk/src/components/ReconnectingBanner.tsx`
- Modify: `packages/kiosk/src/App.tsx`
- Modify: `packages/kiosk/src/i18n/{nl,en,de,fr}.json`

- [ ] **Step 1: Add i18n strings**

In all four JSON files, add under a new `reconnecting` key:

```json
{
  "reconnecting": "Reconnecting to event data…"
}
```

Translations: `nl`: "Verbinding herstellen…", `de`: "Verbindung wird wiederhergestellt…", `fr`: "Reconnexion…".

- [ ] **Step 2: Component**

Create `packages/kiosk/src/components/ReconnectingBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function ReconnectingBanner() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null

    const evaluate = () => {
      const queries = client.getQueryCache().getAll()
      const anyError = queries.some((q) => q.state.status === 'error')
      if (anyError && !timeout) {
        timeout = setTimeout(() => setShow(true), 10_000)
      }
      if (!anyError) {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        setShow(false)
      }
    }

    const unsub = client.getQueryCache().subscribe(evaluate)
    evaluate()
    return () => {
      if (timeout) clearTimeout(timeout)
      unsub()
    }
  }, [client])

  if (!show) return null

  return (
    <div className="bg-yellow-500 text-black text-center py-2 text-sm font-medium">
      {t('reconnecting')}
    </div>
  )
}
```

- [ ] **Step 3: Mount in App**

Edit `packages/kiosk/src/App.tsx`, insert `<ReconnectingBanner />` above `<Header />`.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): reconnecting banner after 10s of query errors"
```

### Task 3.5: Warmup overlay

**Files:**
- Create: `packages/kiosk/src/components/WarmupOverlay.tsx`
- Modify: `packages/kiosk/src/App.tsx`
- Modify: `packages/kiosk/src/pages/NowPage.tsx` — drop red error state
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx` — drop red error state
- Modify: i18n files

- [ ] **Step 1: i18n**

Add to all four locale files:

```json
{
  "warmup": {
    "title": "Warming up…",
    "subtitle": "The event data is loading.",
    "retry": "Retry"
  }
}
```

Translate.

- [ ] **Step 2: Overlay component**

Create `packages/kiosk/src/components/WarmupOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

const CORE_KEYS = ['agenda', 'now-sessions', 'event-config']

export function WarmupOverlay() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null

    const evaluate = () => {
      const queries = client.getQueryCache().getAll()
      const coreLoading = queries.some(
        (q) =>
          CORE_KEYS.includes(String(q.queryKey[0])) &&
          q.state.status === 'pending' &&
          q.state.data === undefined,
      )
      if (coreLoading && !timeout) {
        timeout = setTimeout(() => setShow(true), 15_000)
      }
      if (!coreLoading) {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        setShow(false)
      }
    }

    const unsub = client.getQueryCache().subscribe(evaluate)
    evaluate()
    return () => {
      if (timeout) clearTimeout(timeout)
      unsub()
    }
  }, [client])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-el-darker/90">
      <div className="text-4xl font-extrabold text-el-light mb-2">{t('warmup.title')}</div>
      <div className="text-el-light/70 mb-6">{t('warmup.subtitle')}</div>
      <button
        className="bg-el-blue text-white px-6 py-3 rounded-xl font-bold text-lg"
        onClick={() => client.invalidateQueries()}
      >
        {t('warmup.retry')}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Mount & drop per-page error states**

In `App.tsx`, mount `<WarmupOverlay />` inside the root div.

In `NowPage.tsx`, remove the `if (error || !data)` early return (lines 94-101). After:

```ts
const { current, upNext } = data ?? { current: [], upNext: [] }
```

then the rest of the component renders. Loading state becomes "empty-looking" until data arrives; the overlay appears if >15s.

In `AgendaPage.tsx`, remove the red error return at lines 95-102. Similar pattern: let the page render with empty days when data absent.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): warmup overlay + drop red error screens on Now/Agenda"
```

---

## Phase 4 — Zustand store refactor + inactivity reset

### Task 4.1: Expand store with all resettable state + `resetSession()`

**Files:**
- Modify: `packages/kiosk/src/store/kiosk.ts`
- Create: `packages/kiosk/src/store/kiosk.test.ts`

- [ ] **Step 1: Read current store**

Read `packages/kiosk/src/store/kiosk.ts`. Note existing fields (`language`, `eventSlug`, `lastInteraction`, `touch`).

- [ ] **Step 2: Failing test**

Create `packages/kiosk/src/store/kiosk.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useKioskStore } from './kiosk'

describe('kiosk store resetSession', () => {
  beforeEach(() => {
    useKioskStore.setState(useKioskStore.getInitialState())
  })

  it('clears modals, search, filters, and ui prefs', () => {
    useKioskStore.setState({
      openSessionId: 42,
      openSpeakerId: 7,
      openBoothId: 3,
      searchQuery: 'azure',
      selectedDayIndex: 2,
      selectedMapId: 'm1',
      mapHighlightId: 'h1',
      agendaLabelFilter: ['Security'],
      fontScale: 1.4,
      theme: 'high-contrast',
    })

    useKioskStore.getState().resetSession()

    const s = useKioskStore.getState()
    expect(s.openSessionId).toBeNull()
    expect(s.openSpeakerId).toBeNull()
    expect(s.openBoothId).toBeNull()
    expect(s.searchQuery).toBe('')
    expect(s.selectedDayIndex).toBeNull()
    expect(s.selectedMapId).toBeNull()
    expect(s.mapHighlightId).toBeNull()
    expect(s.agendaLabelFilter).toEqual([])
    expect(s.fontScale).toBe(1)
    expect(s.theme).toBe('default')
  })

  it('does not reset eventSlug or lastInteraction', () => {
    const before = useKioskStore.getState().lastInteraction
    useKioskStore.getState().resetSession()
    const after = useKioskStore.getState()
    expect(after.eventSlug).toBe('experts-live-netherlands-2026')
    expect(after.lastInteraction).toBe(before)
  })
})
```

Run. Expected: FAIL.

- [ ] **Step 3: Expand store**

Replace `packages/kiosk/src/store/kiosk.ts` with:

```ts
import { create } from 'zustand'

type Theme = 'default' | 'high-contrast'
type FontScale = 1 | 1.2 | 1.4

interface KioskState {
  // Stable per kiosk
  eventSlug: string
  language: string
  lastInteraction: number

  // Per-session — cleared on inactivity
  selectedDayIndex: number | null
  openSessionId: number | null
  openSpeakerId: number | null
  openBoothId: number | null
  searchQuery: string
  selectedMapId: string | null
  mapHighlightId: string | null
  agendaLabelFilter: string[]
  fontScale: FontScale
  theme: Theme

  // Actions
  touch: () => void
  setLanguage: (lang: string) => void
  openSession: (id: number | null) => void
  openSpeaker: (id: number | null) => void
  openBooth: (id: number | null) => void
  setSearchQuery: (q: string) => void
  setSelectedDayIndex: (i: number | null) => void
  setSelectedMap: (id: string | null, highlightId?: string | null) => void
  setMapHighlight: (id: string | null) => void
  toggleLabelFilter: (name: string) => void
  clearLabelFilter: () => void
  setFontScale: (s: FontScale) => void
  setTheme: (t: Theme) => void
  resetSession: () => void
}

const INITIAL_SESSION: Pick<
  KioskState,
  | 'selectedDayIndex'
  | 'openSessionId'
  | 'openSpeakerId'
  | 'openBoothId'
  | 'searchQuery'
  | 'selectedMapId'
  | 'mapHighlightId'
  | 'agendaLabelFilter'
  | 'fontScale'
  | 'theme'
> = {
  selectedDayIndex: null,
  openSessionId: null,
  openSpeakerId: null,
  openBoothId: null,
  searchQuery: '',
  selectedMapId: null,
  mapHighlightId: null,
  agendaLabelFilter: [],
  fontScale: 1,
  theme: 'default',
}

const DEFAULT_LANGUAGE = 'nl'

export const useKioskStore = create<KioskState>()((set) => ({
  eventSlug: 'experts-live-netherlands-2026',
  language: DEFAULT_LANGUAGE,
  lastInteraction: Date.now(),
  ...INITIAL_SESSION,

  touch: () => set({ lastInteraction: Date.now() }),
  setLanguage: (language) => set({ language }),
  openSession: (openSessionId) => set({ openSessionId }),
  openSpeaker: (openSpeakerId) => set({ openSpeakerId }),
  openBooth: (openBoothId) => set({ openBoothId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedDayIndex: (selectedDayIndex) => set({ selectedDayIndex }),
  setSelectedMap: (selectedMapId, mapHighlightId = null) => set({ selectedMapId, mapHighlightId }),
  setMapHighlight: (mapHighlightId) => set({ mapHighlightId }),
  toggleLabelFilter: (name) =>
    set((s) => ({
      agendaLabelFilter: s.agendaLabelFilter.includes(name)
        ? s.agendaLabelFilter.filter((n) => n !== name)
        : [...s.agendaLabelFilter, name],
    })),
  clearLabelFilter: () => set({ agendaLabelFilter: [] }),
  setFontScale: (fontScale) => set({ fontScale }),
  setTheme: (theme) => set({ theme }),
  resetSession: () => set({ ...INITIAL_SESSION, language: DEFAULT_LANGUAGE }),
}))
```

- [ ] **Step 4: Tests pass**

```bash
pnpm --filter @ziggy/kiosk test -- kiosk.test
```

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): expand store with session state + resetSession action"
```

### Task 4.2: Wire `resetSession` into inactivity hook

**Files:**
- Modify: `packages/kiosk/src/hooks/useInactivityReset.ts`

- [ ] **Step 1: Update hook**

Replace `useInactivityReset.ts` body:

```ts
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKioskStore } from '../store/kiosk'

const INACTIVITY_TIMEOUT = 60_000

export function useInactivityReset() {
  const navigate = useNavigate()
  const lastInteraction = useKioskStore((s) => s.lastInteraction)
  const resetSession = useKioskStore((s) => s.resetSession)

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (elapsed >= INACTIVITY_TIMEOUT) {
        resetSession()
        navigate('/now', { replace: true })
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lastInteraction, navigate, resetSession])
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): inactivity reset now clears all session state"
```

### Task 4.3: Refactor pages to read modal/selection state from store

**Files:**
- Modify: `packages/kiosk/src/pages/NowPage.tsx`
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`
- Modify: `packages/kiosk/src/pages/SpeakersPage.tsx`
- Modify: `packages/kiosk/src/pages/BoothsPage.tsx`
- Modify: `packages/kiosk/src/pages/MapPage.tsx`
- Modify: `packages/kiosk/src/pages/SearchPage.tsx`
- Modify: `packages/kiosk/src/components/SessionDetailModal.tsx`
- Modify: `packages/kiosk/src/components/SpeakerDetailModal.tsx`

For each page, replace local `useState` for modal/selection state with store selectors. Example pattern:

- [ ] **Step 1: NowPage**

In `NowPage.tsx`:

```tsx
const openSessionId = useKioskStore((s) => s.openSessionId)
const openSession = useKioskStore((s) => s.openSession)

// ...

// In SessionCard onTap:
onTap={() => { openSession(session.id); touch() }}

// Modal:
{openSessionId && (() => {
  const session = [...current, ...upNext].find((s) => s.id === openSessionId)
  return session ? <SessionDetailModal session={session} onClose={() => openSession(null)} /> : null
})()}
```

- [ ] **Step 2: AgendaPage**

Replace `const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)` with store. Replace `selectedSession` local state with `openSessionId` from store + session lookup by id across all timeslots.

- [ ] **Step 3: SpeakersPage**

Use `openSpeakerId` from store. Speaker lookup from cached `useSpeakers()` data.

- [ ] **Step 4: BoothsPage**

Use `openBoothId` from store.

- [ ] **Step 5: MapPage**

Replace local `selectedMapId` state (if any) with store. Keep existing UI behavior otherwise — deep-link wiring is in Phase 7.

- [ ] **Step 6: SearchPage**

Use `searchQuery` and session-open helpers from store.

- [ ] **Step 7: Typecheck, dev sanity check, commit**

```bash
pnpm --filter @ziggy/kiosk typecheck
```

Dev-run manually: open kiosk, open a session modal, wait 65s — modal should close AND the page should return to /now AND search state should be empty.

```bash
git add packages/kiosk/
git commit -m "refactor(kiosk): move modal/selection state from components to store"
```

---

## Phase 5 — Agenda UX

### Task 5.1: Clock-tick hook + simulated-now helper

**Files:**
- Create: `packages/kiosk/src/lib/clock.ts`
- Create: `packages/kiosk/src/lib/clock.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { getSimulatedNow } from './clock'

describe('getSimulatedNow', () => {
  it('returns real Date when no override', () => {
    const d = getSimulatedNow(undefined)
    expect(d).toBeInstanceOf(Date)
    expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(1000)
  })

  it('returns parsed override when dev + valid', () => {
    const d = getSimulatedNow('2026-06-02T10:30')
    expect(d.toISOString()).toBe('2026-06-02T10:30:00.000Z')
  })

  it('returns real Date on invalid override', () => {
    const d = getSimulatedNow('not-a-date')
    expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(1000)
  })
})
```

- [ ] **Step 2: Implement**

Create `packages/kiosk/src/lib/clock.ts`:

```ts
import { useEffect, useState } from 'react'

export function getSimulatedNow(override: string | undefined | null): Date {
  if (!override) return new Date()
  const parsed = new Date(override)
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

export function useClockTick(intervalMs = 30_000): Date {
  const override = new URLSearchParams(window.location.search).get('now')
  const [now, setNow] = useState(() => getSimulatedNow(override))
  useEffect(() => {
    if (override) return // Frozen in override mode
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, override])
  return now
}
```

Run tests, commit:

```bash
pnpm --filter @ziggy/kiosk test -- clock.test
git add packages/kiosk/
git commit -m "feat(kiosk): clock tick + dev-only ?now= override"
```

### Task 5.2: Live/past states on SessionCard

**Files:**
- Modify: `packages/kiosk/src/components/SessionCard.tsx`
- Modify: `packages/kiosk/src/i18n/{nl,en,de,fr}.json`

- [ ] **Step 1: i18n**

Add to each locale:

```json
{
  "session": {
    "live": "LIVE"
  }
}
```

- [ ] **Step 2: Update SessionCard**

Add `now` prop, compute live/past:

```tsx
interface Props {
  session: AgendaSession
  now?: Date
  onTap: () => void
}

export function SessionCard({ session, now, onTap }: Props) {
  const { t } = useTranslation()
  const current = now ?? new Date()
  const start = new Date(session.startDate)
  const end = new Date(session.endDate)
  const isLive = current >= start && current < end
  const isPast = current >= end

  return (
    <button
      onClick={onTap}
      className={`relative text-left w-full bg-el-gray rounded-2xl p-4 active:scale-[0.99] transition-transform ${isPast ? 'opacity-40' : ''}`}
    >
      {isLive && (
        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          {t('session.live')}
        </span>
      )}
      {/* Existing card body unchanged */}
      {/* ... */}
    </button>
  )
}
```

Merge the new JSX + classes into the existing `SessionCard.tsx` without duplicating the body.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): live pill + dim-past on SessionCard"
```

### Task 5.3: Pass `now` from pages

**Files:**
- Modify: `packages/kiosk/src/pages/NowPage.tsx`
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`

- [ ] **Step 1: NowPage**

```tsx
import { useClockTick } from '../lib/clock'
// ...
const now = useClockTick(30_000)
// Pass to every <SessionCard session={...} now={now} />
```

- [ ] **Step 2: AgendaPage**

Same pattern.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): thread now through Now and Agenda pages"
```

### Task 5.4: Label filter UI

**Files:**
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`
- Modify: `packages/kiosk/src/i18n/{nl,en,de,fr}.json`

- [ ] **Step 1: i18n**

Add `agenda.filter.clear` in all four locales ("Clear filters", "Filters wissen", "Filter löschen", "Effacer les filtres").

- [ ] **Step 2: Derive labels + render chips**

In `AgendaPage.tsx`, above the timeline block:

```tsx
const agendaLabelFilter = useKioskStore((s) => s.agendaLabelFilter)
const toggleLabelFilter = useKioskStore((s) => s.toggleLabelFilter)
const clearLabelFilter = useKioskStore((s) => s.clearLabelFilter)

const labels = useMemo(() => {
  const map = new Map<string, Label>()
  for (const slot of currentDay.timeslots)
    for (const s of slot.sessions)
      for (const l of s.labels) map.set(l.name, l)
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}, [currentDay])

const filtered = useMemo(() => {
  if (agendaLabelFilter.length === 0) return currentDay.timeslots
  return currentDay.timeslots
    .map((slot) => ({
      ...slot,
      sessions: slot.sessions.filter((s) =>
        s.labels.some((l) => agendaLabelFilter.includes(l.name)),
      ),
    }))
    .filter((slot) => slot.sessions.length > 0)
}, [currentDay, agendaLabelFilter])
```

Render the chip row between the day tabs and timeline:

```tsx
{labels.length > 0 && (
  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
    {labels.map((l) => {
      const active = agendaLabelFilter.includes(l.name)
      return (
        <button
          key={l.name}
          onClick={() => { toggleLabelFilter(l.name); touch() }}
          className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap"
          style={{
            backgroundColor: active ? l.color : 'transparent',
            color: active ? '#fff' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${l.color}`,
          }}
        >
          {l.name}
        </button>
      )
    })}
    {agendaLabelFilter.length > 0 && (
      <button
        onClick={() => { clearLabelFilter(); touch() }}
        className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-el-gray text-el-light/80"
      >
        {t('agenda.filter.clear')}
      </button>
    )}
  </div>
)}
```

Use `filtered` instead of `currentDay.timeslots` in the render block below.

- [ ] **Step 3: Manual verify + commit**

```bash
pnpm --filter @ziggy/kiosk dev &
# tap label chips, verify filtering
```

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): agenda label filter"
```

### Task 5.5: Jump-to-now button

**Files:**
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`
- Modify: i18n files

- [ ] **Step 1: i18n**

`agenda.jumpToNow`: "Jump to now" / "Ga naar nu" / "Zu jetzt springen" / "Aller à maintenant".

- [ ] **Step 2: Implement**

In `AgendaPage.tsx`:

```tsx
const timeslotRefs = useRef<Map<string, HTMLElement>>(new Map())

const liveTimeslot = useMemo(() => {
  return filtered.find((slot) =>
    slot.sessions.some((s) => {
      const start = new Date(s.startDate)
      const end = new Date(s.endDate)
      return now >= start && now < end
    }),
  )
}, [filtered, now])

const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: timezone })
const showJumpToNow = currentDay.date === todayStr && !!liveTimeslot
```

In each timeslot wrapper div:

```tsx
<div
  key={timeslot.startTimeGroup}
  ref={(el) => {
    if (el) timeslotRefs.current.set(timeslot.startTimeGroup, el)
  }}
>
```

Button (end of component return):

```tsx
{showJumpToNow && liveTimeslot && (
  <button
    className="fixed bottom-24 right-6 bg-el-blue text-white rounded-full px-5 py-3 shadow-lg font-bold"
    onClick={() => {
      timeslotRefs.current
        .get(liveTimeslot.startTimeGroup)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      touch()
    }}
  >
    {t('agenda.jumpToNow')} ↓
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): jump-to-now button on agenda"
```

---

## Phase 6 — Cross-feature search

### Task 6.1: Rework SearchPage with three result sections

**Files:**
- Modify: `packages/kiosk/src/pages/SearchPage.tsx`
- Modify: i18n files

- [ ] **Step 1: i18n**

Add to each locale:

```json
{
  "search": {
    "sectionSessions": "Sessions",
    "sectionSpeakers": "Speakers",
    "sectionBooths": "Booths",
    "keepTyping": "Keep typing for sessions (need ≥4 characters)",
    "showAll": "Show all {{count}}",
    "noResults": "No results"
  }
}
```

- [ ] **Step 2: Rewrite SearchPage**

```tsx
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/PageContainer'
import { VirtualKeyboard } from '../components/VirtualKeyboard'
import { useSearch, useSpeakers, useBooths } from '../lib/hooks'
import { useKioskStore } from '../store/kiosk'
import { SessionCard } from '../components/SessionCard'
import { SessionDetailModal } from '../components/SessionDetailModal'
// import SpeakerCard, BoothCard shared or re-used from their pages

export function SearchPage() {
  const { t } = useTranslation()
  const query = useKioskStore((s) => s.searchQuery)
  const setQuery = useKioskStore((s) => s.setSearchQuery)
  const touch = useKioskStore((s) => s.touch)
  const openSession = useKioskStore((s) => s.openSession)
  const openSpeaker = useKioskStore((s) => s.openSpeaker)
  const openBooth = useKioskStore((s) => s.openBooth)

  const sessionsQ = useSearch(query)
  const speakersQ = useSpeakers()
  const boothsQ = useBooths()

  const [expandSessions, setExpandSessions] = useState(false)
  const [expandSpeakers, setExpandSpeakers] = useState(false)
  const [expandBooths, setExpandBooths] = useState(false)

  const q = query.trim().toLowerCase()
  const speakers = useMemo(() => {
    if (!q || !speakersQ.data) return []
    return speakersQ.data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.company?.toLowerCase().includes(q) ||
        s.tagline?.toLowerCase().includes(q),
    )
  }, [speakersQ.data, q])

  const booths = useMemo(() => {
    if (!q || !boothsQ.data) return []
    return boothsQ.data.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.organization?.toLowerCase().includes(q) ||
        b.boothNumber?.toLowerCase().includes(q),
    )
  }, [boothsQ.data, q])

  const sessions = sessionsQ.data ?? []
  const hasAny = sessions.length > 0 || speakers.length > 0 || booths.length > 0
  const showKeepTyping = q.length > 0 && q.length < 4

  const limit = (arr: unknown[], expand: boolean) => (expand ? arr.length : 6)

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('search.title')}</h1>

      <VirtualKeyboard value={query} onChange={(v) => { setQuery(v); touch() }} />

      {showKeepTyping && <p className="text-el-light/60 text-sm mb-3">{t('search.keepTyping')}</p>}
      {q.length > 0 && !hasAny && !showKeepTyping && (
        <p className="text-el-light/60">{t('search.noResults')}</p>
      )}

      {sessions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-el-light mb-2">
            {t('search.sectionSessions')} ({sessions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.slice(0, limit(sessions, expandSessions)).map((s) => (
              <SessionCard key={s.id} session={s} onTap={() => { openSession(s.id); touch() }} />
            ))}
          </div>
          {sessions.length > 6 && !expandSessions && (
            <button className="mt-3 text-el-blue font-bold" onClick={() => setExpandSessions(true)}>
              {t('search.showAll', { count: sessions.length })}
            </button>
          )}
        </section>
      )}

      {speakers.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-el-light mb-2">
            {t('search.sectionSpeakers')} ({speakers.length})
          </h2>
          {/* Re-use the speaker grid styling from SpeakersPage — extract a SpeakerCard component if not already, before touching SearchPage */}
          {/* Render up to `limit(speakers, expandSpeakers)` */}
        </section>
      )}

      {booths.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-el-light mb-2">
            {t('search.sectionBooths')} ({booths.length})
          </h2>
          {/* Re-use BoothCard similarly */}
        </section>
      )}
    </PageContainer>
  )
}
```

- [ ] **Step 3: Extract SpeakerCard + BoothCard components first**

If `SpeakersPage.tsx` and `BoothsPage.tsx` currently render cards inline, extract their card JSX into `packages/kiosk/src/components/SpeakerCard.tsx` and `BoothCard.tsx` — each a pure presentational component accepting the data + `onTap`. Update the respective pages to use the new components, then import them from SearchPage.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): cross-feature search (sessions + speakers + booths)"
```

---

## Phase 7 — Floor map deep links

### Task 7.1: BoothOverride Cosmos container + admin field

**Files:**
- Modify: `packages/api/src/routes/admin.ts` (add booth-override CRUD)
- Modify: `packages/api/src/routes/events.ts` (expose merged booth data)
- Modify: `packages/admin/src/**` (add hotspot picker to booth list)

- [ ] **Step 1: Create container on first use**

In `packages/api/src/lib/cosmos.ts`, ensure the `booth-overrides` container is created on startup with partition key `/eventSlug`. If the file has a container-bootstrap step, add this entry; if not, it'll be created lazily via `container(name).items.upsert` — confirm by reading the cosmos helper.

- [ ] **Step 2: Admin routes for booth overrides**

Add to `admin.ts`:

```ts
admin.get('/api/admin/events/:slug/booth-overrides', async (c) => {
  const slug = c.req.param('slug')
  const items = await findAll('booth-overrides', 'eventSlug', slug)
  return c.json(items)
})

admin.put('/api/admin/events/:slug/booth-overrides/:boothId', async (c) => {
  const slug = c.req.param('slug')
  const boothId = c.req.param('boothId')
  const body = await c.req.json()
  const parsed = BoothOverrideSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400)

  const doc = {
    id: `${slug}:${boothId}`,
    eventSlug: slug,
    boothId,
    floorMapHotspotId: parsed.data.floorMapHotspotId,
    updatedAt: new Date().toISOString(),
  }
  const result = await upsert('booth-overrides', doc)
  return c.json(result)
})
```

Import `BoothOverrideSchema` from `../schemas/admin.js`.

- [ ] **Step 3: Public route merges overrides**

In `events.ts`, modify the booths handler to merge overrides:

```ts
events.get('/api/events/:slug/booths', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  try {
    const [booths, overrides] = await Promise.all([
      runEvents.fetchBooths(apiKey, slug),
      findAll<{ boothId: string; floorMapHotspotId?: string }>('booth-overrides', 'eventSlug', slug)
        .catch(() => []),
    ])
    const overrideMap = new Map(overrides.map((o) => [o.boothId, o]))
    const merged = booths.map((b) => ({
      ...b,
      floorMapHotspotId: overrideMap.get(String(b.id))?.floorMapHotspotId,
    }))
    return c.json(merged)
  } catch (err) {
    console.error('[events/booths]', err)
    return c.json({ error: 'Failed to fetch booths' }, 502)
  }
})
```

Update the `Booth` shared type to include `floorMapHotspotId?: string`.

- [ ] **Step 4: Admin UI**

In the admin app booth list page, add a "Link to map" action per booth row that opens a picker showing all hotspots across all floor maps. PUT to `/api/admin/events/:slug/booth-overrides/:boothId` with `{ floorMapHotspotId }`.

(Read current admin booth page first to match the existing UI pattern — add only the picker + PUT call.)

- [ ] **Step 5: Commit**

```bash
git add packages/api/ packages/shared/ packages/admin/
git commit -m "feat: booth → floor-map-hotspot link via booth-overrides container"
```

### Task 7.2: Extend hotspots with `roomGuid`

**Files:**
- Modify: `packages/shared/src/types/floor-map.ts`
- Modify: `packages/api/src/schemas/admin.ts` (HotspotSchema)
- Modify: `packages/admin/src/**` (hotspot editor → room picker)

- [ ] **Step 1: Add field**

Add `roomGuid?: string` to the `Hotspot` type and to `HotspotSchema` (already added in Task 2.5 — verify).

- [ ] **Step 2: Admin hotspot editor**

When editing a hotspot in the admin panel, render a dropdown populated from distinct room guids in the cached agenda. Save the selected value as `roomGuid`.

(Admin hotspot editor code location: identified by grepping for existing roomName field in `packages/admin/src/`.)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/ packages/admin/
git commit -m "feat: hotspots can link to a run.events roomGuid"
```

### Task 7.3: Kiosk "Show on map" action

**Files:**
- Modify: `packages/kiosk/src/components/SessionDetailModal.tsx`
- Modify: `packages/kiosk/src/pages/BoothsPage.tsx` (booth detail)
- Modify: `packages/kiosk/src/pages/MapPage.tsx`
- Modify: i18n files

- [ ] **Step 1: i18n**

`map.showOnMap` across all four locales.

- [ ] **Step 2: Button in session modal**

In `SessionDetailModal.tsx`, near the room name:

```tsx
const navigate = useNavigate()
const floorMaps = useFloorMaps().data ?? []
const setSelectedMap = useKioskStore((s) => s.setSelectedMap)
const openSession = useKioskStore((s) => s.openSession)

const matchingMap = floorMaps.find((m) =>
  m.hotspots?.some((h) => h.roomGuid === session.roomGuid),
)

{matchingMap && (
  <button
    className="bg-el-blue text-white rounded-xl px-4 py-2 font-bold"
    onClick={() => {
      const hotspot = matchingMap.hotspots.find((h) => h.roomGuid === session.roomGuid)
      setSelectedMap(matchingMap.id, hotspot?.id ?? null)
      openSession(null) // close modal
      navigate('/map')
    }}
  >
    {t('map.showOnMap')}
  </button>
)}
```

- [ ] **Step 3: Button in booth detail**

Mirror the pattern but match by `booth.floorMapHotspotId`:

```tsx
const matchingMap = floorMaps.find((m) =>
  m.hotspots?.some((h) => h.id === booth.floorMapHotspotId),
)
```

- [ ] **Step 4: MapPage highlight rendering**

In `MapPage.tsx`, read `selectedMapId`, `mapHighlightId`, and `setMapHighlight` from store. On mount:

```tsx
useEffect(() => {
  if (!selectedMapId && floorMaps.length > 0) setSelectedMap(floorMaps[0].id, mapHighlightId)
}, [floorMaps, selectedMapId, mapHighlightId, setSelectedMap])
```

For the hotspot SVG polygons, render with conditional glow:

```tsx
<polygon
  key={hotspot.id}
  points={pointsStr}
  className={`${hotspot.id === mapHighlightId ? 'highlight-pulse' : ''} fill-el-blue/20 stroke-el-blue`}
  onClick={() => { setMapHighlight(null); /* existing tap handler */ }}
/>
```

Add CSS in `index.css`:

```css
.highlight-pulse {
  filter: drop-shadow(0 0 12px gold);
  animation: pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 8px gold); }
  50% { filter: drop-shadow(0 0 20px gold); }
}
```

Auto-pan/zoom: compute bounding box from the highlighted polygon's points, set the SVG `viewBox` to center it at ~60% scale, on mount only. Clear `mapHighlightId` on any user pan/zoom interaction.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): show-on-map deep link from session and booth detail"
```

---

## Phase 8 — Practical info page

### Task 8.1: InfoPage + nav + i18n

**Files:**
- Create: `packages/kiosk/src/pages/InfoPage.tsx`
- Modify: `packages/kiosk/src/App.tsx` (route)
- Modify: `packages/kiosk/src/components/BottomNav.tsx`
- Modify: `packages/kiosk/src/i18n/{nl,en,de,fr}.json`

- [ ] **Step 1: i18n**

In all four files add:

```json
{
  "nav": { "info": "Info" },
  "info": {
    "title": "Practical info",
    "wifi": {
      "title": "WiFi",
      "ssid": "ExpertsLive2026",
      "password": "FILLED_AT_BUILD_TIME"
    },
    "venue": {
      "title": "Venue",
      "name": "FILLED",
      "address": "FILLED"
    },
    "schedule": {
      "title": "Schedule",
      "doorsOpen": "Doors open: 08:30",
      "lunch": "Lunch: 12:30–13:30",
      "drinks": "Drinks: 17:00"
    },
    "emergency": {
      "title": "Emergency",
      "location": "FILLED",
      "phone": "FILLED"
    },
    "facilities": {
      "title": "Facilities",
      "toilets": "FILLED",
      "cloakroom": "FILLED"
    },
    "contact": {
      "title": "Contact",
      "name": "FILLED",
      "email": "FILLED",
      "phone": "FILLED"
    }
  }
}
```

Translate labels per locale; values (SSID, password, address, phone numbers, etc.) stay identical across locales unless actually different.

Fill actual Experts Live NL 2026 values (WiFi password, venue name, address, contact details) at build time. Mark placeholders with `FILLED_AT_BUILD_TIME` so they can be grepped before deploy.

- [ ] **Step 2: Page component**

Create `packages/kiosk/src/pages/InfoPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/PageContainer'

function Card({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`bg-el-gray rounded-2xl p-6 ${wide ? 'md:col-span-2' : ''}`}>
      <h2 className="text-lg font-bold text-el-blue mb-3">{title}</h2>
      {children}
    </div>
  )
}

export function InfoPage() {
  const { t } = useTranslation()
  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-6">{t('info.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t('info.wifi.title')} wide>
          <div className="text-el-light/80 text-sm mb-1">SSID</div>
          <div className="text-3xl font-extrabold text-el-light mb-3 select-text">{t('info.wifi.ssid')}</div>
          <div className="text-el-light/80 text-sm mb-1">Password</div>
          <div className="text-3xl font-extrabold text-el-light select-text">{t('info.wifi.password')}</div>
        </Card>
        <Card title={t('info.venue.title')}>
          <div className="text-el-light font-bold">{t('info.venue.name')}</div>
          <div className="text-el-light/80 whitespace-pre-line">{t('info.venue.address')}</div>
        </Card>
        <Card title={t('info.schedule.title')}>
          <ul className="text-el-light/90 space-y-1">
            <li>{t('info.schedule.doorsOpen')}</li>
            <li>{t('info.schedule.lunch')}</li>
            <li>{t('info.schedule.drinks')}</li>
          </ul>
        </Card>
        <Card title={t('info.emergency.title')}>
          <div className="text-el-light">{t('info.emergency.location')}</div>
          <div className="text-el-light/80">{t('info.emergency.phone')}</div>
        </Card>
        <Card title={t('info.facilities.title')}>
          <div className="text-el-light">{t('info.facilities.toilets')}</div>
          <div className="text-el-light">{t('info.facilities.cloakroom')}</div>
        </Card>
        <Card title={t('info.contact.title')}>
          <div className="text-el-light font-bold">{t('info.contact.name')}</div>
          <div className="text-el-light/80">{t('info.contact.email')}</div>
          <div className="text-el-light/80">{t('info.contact.phone')}</div>
        </Card>
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 3: Route + nav**

Add to `App.tsx`:

```tsx
const InfoPage = lazy(() => import('./pages/InfoPage').then((m) => ({ default: m.InfoPage })))
// ...
<Route path="/info" element={<ErrorBoundary><InfoPage /></ErrorBoundary>} />
```

Add to `BottomNav.tsx` an entry for `/info` with an info icon (existing nav items use text + icon — follow the pattern).

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): practical info page (wifi, venue, schedule, contact)"
```

---

## Phase 9 — Accessibility

### Task 9.1: Accessibility menu component

**Files:**
- Create: `packages/kiosk/src/components/AccessibilityMenu.tsx`
- Modify: `packages/kiosk/src/components/Header.tsx`
- Modify: `packages/kiosk/src/i18n/{nl,en,de,fr}.json`

- [ ] **Step 1: i18n**

```json
{
  "a11y": {
    "title": "Display",
    "fontSize": "Font size",
    "highContrast": "High contrast"
  }
}
```

- [ ] **Step 2: Component**

Create `packages/kiosk/src/components/AccessibilityMenu.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'

export function AccessibilityMenu() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const fontScale = useKioskStore((s) => s.fontScale)
  const setFontScale = useKioskStore((s) => s.setFontScale)
  const theme = useKioskStore((s) => s.theme)
  const setTheme = useKioskStore((s) => s.setTheme)
  const touch = useKioskStore((s) => s.touch)

  return (
    <div className="relative">
      <button
        aria-label={t('a11y.title')}
        className="w-12 h-12 rounded-full bg-el-gray flex items-center justify-center text-el-light text-xl font-bold"
        onClick={() => { setOpen((v) => !v); touch() }}
      >
        Ⓐ
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-14 z-50 bg-el-gray rounded-2xl shadow-xl p-4 w-72">
            <div className="text-sm text-el-light/70 mb-2">{t('a11y.fontSize')}</div>
            <div className="flex gap-2 mb-4">
              {([1, 1.2, 1.4] as const).map((scale) => (
                <button
                  key={scale}
                  className={`flex-1 h-12 rounded-xl font-bold ${
                    fontScale === scale ? 'bg-el-blue text-white' : 'bg-el-darker text-el-light'
                  }`}
                  onClick={() => { setFontScale(scale); touch() }}
                >
                  {scale === 1 ? 'A' : scale === 1.2 ? 'A+' : 'A++'}
                </button>
              ))}
            </div>
            <div className="text-sm text-el-light/70 mb-2">{t('a11y.highContrast')}</div>
            <button
              className={`w-full h-12 rounded-xl font-bold ${
                theme === 'high-contrast' ? 'bg-el-blue text-white' : 'bg-el-darker text-el-light'
              }`}
              onClick={() => { setTheme(theme === 'high-contrast' ? 'default' : 'high-contrast'); touch() }}
            >
              {theme === 'high-contrast' ? 'ON' : 'OFF'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Mount in Header**

In `Header.tsx`, add `<AccessibilityMenu />` next to the existing language switcher.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): accessibility menu (font size + high contrast)"
```

### Task 9.2: Apply theme + font scale to root

**Files:**
- Modify: `packages/kiosk/src/App.tsx`
- Modify: `packages/kiosk/src/index.css`

- [ ] **Step 1: App.tsx**

Replace the root `<div>`:

```tsx
const fontScale = useKioskStore((s) => s.fontScale)
const theme = useKioskStore((s) => s.theme)

return (
  <div
    className="flex flex-col h-dvh bg-el-darker text-el-light font-sans"
    data-theme={theme}
    style={{ fontSize: `${fontScale * 16}px` }}
    onTouchStart={touch}
    onClick={touch}
  >
```

- [ ] **Step 2: High-contrast CSS**

Append to `packages/kiosk/src/index.css`:

```css
[data-theme='high-contrast'] {
  --color-el-darker: #000000;
  --color-el-dark: #000000;
  --color-el-light: #ffffff;
  --color-el-blue: #ffcc00;
  --color-el-gray: #1a1a1a;
  --color-el-gray-light: #333333;
  --color-el-red: #ff6666;
}
```

Verify the Tailwind v4 `@theme` block in the same file maps these to the `--color-el-*` CSS variables so the class overrides cascade. If the theme uses static Tailwind class-generated colors (not CSS variables), refactor the `@theme` block to reference the variables first.

- [ ] **Step 3: Manual verify**

```bash
pnpm --filter @ziggy/kiosk dev
```

Open kiosk → Ⓐ menu → toggle contrast, cycle font sizes. Confirm visually.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk/
git commit -m "feat(kiosk): apply font scale and high-contrast theme to root"
```

---

## Phase 10 — Deploy notes + acceptance

### Task 10.1: Deploy runbook

**Files:**
- Create: `docs/event-ready-deploy-runbook.md`

- [ ] **Step 1: Write runbook**

```markdown
# Event-Ready Deploy Runbook

Run this in order for the first deploy of the event-ready polish work.

## Pre-deploy

1. Set `SETUP_TOKEN` in Container App secret (random 32+ chars; store in password manager).
2. Verify `JWT_SECRET` is ≥32 chars in the Container App. Rotate if shorter.
3. Fill real values in `packages/kiosk/src/i18n/*.json` where `FILLED_AT_BUILD_TIME` appears:
   ```
   grep -rn FILLED_AT_BUILD_TIME packages/kiosk/src/i18n
   ```
4. Run `pnpm audit --prod --audit-level=high`. Must be clean.
5. Run `pnpm test` across all packages. Must pass.

## Deploy

6. Merge + deploy via GitHub Actions as normal.

## Post-deploy

7. Scrub any legacy `apiKey` fields from Cosmos `events` documents:
   ```
   tsx --env-file=packages/api/.env packages/api/scripts/scrub-apikey.ts
   ```
   If the script reports any scrubbed values, rotate the run.events API key in the run.events dashboard.

8. Smoke test `/api/events/experts-live-netherlands-2026/config` — response must contain no `apiKey`:
   ```
   curl -s $API_URL/api/events/experts-live-netherlands-2026/config | grep -iE 'apiKey|password|secret|token'
   ```
   Expected: no output.

9. Verify security headers on kiosk:
   ```
   curl -I $KIOSK_URL
   ```
   Expected: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.

10. Verify `/api/warmup` responds 200 and warms all sources.

11. Test a kiosk cold path:
    - Open the kiosk URL on the actual kiosk machine
    - Disable WiFi for 30 seconds
    - Re-enable — the reconnecting banner should appear and disappear without a red error screen
    - Verify inactivity reset: open a session modal, change language, wait 65s — should return to /now with default language and no modal.
```

- [ ] **Step 2: Commit**

```bash
git add docs/event-ready-deploy-runbook.md
git commit -m "docs: event-ready deploy runbook"
```

### Task 10.2: Update roadmap

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Mark completed + move deferred items**

Under "Future Improvements", adjust entries:
- Mark completed: touch optimization pass additional polish, etc.
- Add:
  - [ ] Application Insights + kiosk heartbeat monitoring
  - [ ] OS-level kiosk lockdown guide
  - [ ] Sponsor QR codes
  - [ ] Service worker / full offline mode
  - [ ] Multi-event support
  - [ ] Azure managed-identity infra rework
  - [ ] GitHub Actions OIDC + SHA-pinned actions
  - [ ] Admin token migration to HttpOnly cookies + CSRF
  - [ ] Structured audit logging + alerting

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: roadmap update for event-ready polish + deferred items"
```

---

## Acceptance checklist

Run these once at the end of Phase 10 to confirm the spec's acceptance criteria:

- [ ] Red "Error" screen never appears during a 5-minute idle + API-offline test
- [ ] 90-second attendee-idle returns to `/now` with no prior session state
- [ ] Agenda page shows ≥1 LIVE pill during a live session; jump-to-now scrolls to it
- [ ] Searching a known speaker surfaces them under "Speakers" section
- [ ] Session → "Show on map" centers the correct hotspot with a glow
- [ ] `/info` displays WiFi credentials at glance distance
- [ ] Font size A++ is legible from 2 m in default and high-contrast themes
- [ ] `/api/events/.../config` response contains no secret-shaped keys (automated test)
- [ ] `/api/auth/setup`: 403 when admin exists, 401 without token, 503 when env unset
- [ ] Six consecutive wrong-password logins return 429
- [ ] `pnpm audit --prod --audit-level=high` exits 0
- [ ] Uploading SVG or GIF returns 400
- [ ] `curl -I` on kiosk shows all new security headers
