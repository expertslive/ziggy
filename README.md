# Ziggy — Experts Live Kiosk App

A touch-screen kiosk web app for conference venues, allowing attendees to find sessions, speakers, workshops, rooms, sponsors, and navigate floor maps.

Built for [Experts Live](https://www.intechnieuws.nl/experts-live-netherlands-2026/) events. Data sourced from the [run.events](https://run.events) platform.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend (kiosk + admin) | React 19, TypeScript, Vite, Tailwind v4 |
| Backend | Hono + Node.js (BFF/proxy) |
| Database | Azure Cosmos DB |
| File storage | Azure Blob Storage |
| SPA hosting | Azure Static Web Apps |
| API hosting | Azure Container Apps |
| IaC | Bicep |
| Monorepo | pnpm workspaces |

## Project Structure

```
ziggy/
├── packages/
│   ├── shared/     # TypeScript types, constants, utils
│   ├── api/        # Hono backend (BFF proxy + admin API)
│   ├── kiosk/      # Kiosk SPA (touch-optimized, attendee-facing)
│   └── admin/      # Admin panel SPA (event config, sponsors, floor maps)
├── infra/          # Bicep templates for Azure
└── .github/        # CI/CD workflows
```

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
# Install dependencies
pnpm install

# Build shared types
pnpm build:shared

# Start API (in one terminal)
cp packages/api/.env.example packages/api/.env
# Edit .env to add your run.events API key
pnpm dev:api

# Start kiosk (in another terminal)
pnpm dev:kiosk
```

The kiosk app runs at `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### All Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Start API dev server |
| `pnpm dev:kiosk` | Start kiosk dev server |
| `pnpm dev:admin` | Start admin dev server |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format all packages |
| `pnpm typecheck` | Type-check all packages |

## Kiosk Features

- **Now** — current sessions with time remaining + "Up Next" preview
- **Agenda** — day tabs, timeline, session cards with detail modal
- **Speakers** — photo grid, tap for bio + their sessions
- **Floor Map** — tappable room hotspots, room popover with current session
- **Sponsors** — tiered display (platinum → silver), tap for details
- **Search** — virtual keyboard, results stream as you type

### Touch Optimizations

- 48px minimum tap targets
- Scale-down press animations
- No hover states, kiosk CSS resets (no select/zoom/context menu)
- Swipe gestures for day/map switching
- Auto-reset to home after 60s inactivity

## Data Flow

```
run.events API  ──(5-min cache)──▶  Hono API  ──▶  Kiosk SPA
                                       ▲
                                       │
Admin Panel ──(CRUD)──▶ Cosmos DB ─────┘
```

- Session/speaker/booth data: fetched from run.events API, cached for 5 minutes
- Sponsors, floor maps, event config: managed by admins, stored in Cosmos DB

## Environment Variables

### API (`packages/api/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `EVENT_SLUG` | Event slug for run.events | `experts-live-netherlands-2026` |
| `RUN_EVENTS_API_KEY` | run.events API key | — |
| `NODE_ENV` | Environment | `development` |

### Kiosk (`packages/kiosk/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API base URL (empty for proxy) | `` |
| `VITE_EVENT_SLUG` | Event slug | `experts-live-netherlands-2026` |

## License

MIT
