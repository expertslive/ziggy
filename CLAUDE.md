# CLAUDE.md — Ziggy Project Guide

## Project Overview

Ziggy is a touch-screen kiosk web app for Experts Live conference events. It has three packages in a pnpm monorepo:

- `@ziggy/shared` — TypeScript types and constants shared across packages
- `@ziggy/api` — Hono backend that proxies the run.events API with 5-min caching and serves admin-managed data from Cosmos DB
- `@ziggy/kiosk` — React 19 SPA optimized for touch kiosks
- `@ziggy/admin` — React admin panel (Phase 4)

## Key Commands

```bash
pnpm dev:api          # Start API on :3001
pnpm dev:kiosk        # Start kiosk on :5173
pnpm build:shared     # Must build shared before other packages
pnpm build            # Build everything
pnpm typecheck        # Type-check all packages
```

## Architecture Decisions

- **run.events API uses POST for data endpoints** (not GET) — this is unusual but correct. Auth via `ApiKey` header.
- **In-memory cache** with 5-min TTL on the API server — sufficient for single-container deployment
- **Kiosk has no auth** — all public endpoints. Admin panel uses JWT auth.
- **Cosmos DB** for admin-managed data (sponsors, floor maps, event config). Free tier: 1000 RU/s.
- **Tailwind v4** with `@tailwindcss/vite` plugin — no `tailwind.config.js`, use `@theme` in CSS instead.

## Code Conventions

- TypeScript strict mode everywhere
- ESM (`"type": "module"`) in all packages
- Shared types use `.js` extension in imports (TypeScript ESM requirement)
- Prettier: no semicolons, single quotes, trailing commas
- API routes return JSON, errors use `{ error: string }` shape
- Kiosk uses `@tanstack/react-query` for data fetching, `zustand` for UI state
- i18n: `react-i18next` with inline resources (no HTTP backend)

## Important File Paths

- Shared types: `packages/shared/src/types/`
- API routes: `packages/api/src/routes/`
- API cache: `packages/api/src/lib/cache.ts`
- run.events client: `packages/api/src/lib/run-events.ts`
- Kiosk pages: `packages/kiosk/src/pages/`
- Kiosk components: `packages/kiosk/src/components/`
- Kiosk API client: `packages/kiosk/src/lib/api.ts`
- i18n translations: `packages/kiosk/src/i18n/`
- Kiosk store: `packages/kiosk/src/store/`

## run.events API

- Base URL: `https://modesty.runevents.net`
- Swagger: `https://modesty.runevents.net/swagger/index.html`
- Auth: `ApiKey` header (event-level key)
- Key endpoints (all POST except search):
  - `POST /v2/events/{slug}/agenda`
  - `POST /v2/events/{slug}/speakers`
  - `POST /v2/events/{slug}/booths`
  - `POST /v2/events/{slug}/partnerships`
  - `GET /v2/events/{slug}/agenda/search?q=`
- Search requires minimum 4 characters

## Azure Infrastructure

- Cosmos DB (free tier) — document store
- Container Apps (consumption) — API hosting, scales to zero
- Static Web Apps (free) — SPA hosting
- Blob Storage — floor map images, sponsor logos
- Estimated cost: $5-17/month
