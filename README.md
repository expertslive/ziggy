# Ziggy — Experts Live Kiosk App

A touch-screen kiosk web app for conference venues, allowing attendees to find sessions, speakers, expo booths, sponsors, and navigate interactive floor maps.

Built for [Experts Live](https://www.intechnieuws.nl/experts-live-netherlands-2026/) events. Data sourced from the [run.events](https://run.events) platform.

## Features

### What's Happening Now

The home screen shows sessions currently in progress with a live countdown, plus a preview of what's coming up next. The page auto-refreshes so kiosks always display the latest information.

### Agenda

Browse the full conference schedule organized by day. Tap any session to see details including description, speakers, room location, and time slot. Swipe or tap day tabs to switch between conference days.

### Speakers

A searchable grid of all speakers with photos. Tap a speaker to see their bio and the sessions they're presenting.

### Interactive Floor Maps

Zoomable venue maps with tappable room hotspots. Tap a room to see which session is currently running there and what's coming up next. Admins draw hotspot regions using a visual polygon editor.

### Expo

Browse exhibitor booths with logos, booth numbers, and descriptions. Tap for full details.

### Sponsors

Tiered sponsor display — Ultimate sponsors featured prominently, with Gold, Speaker Dinner, and other tiers displayed at appropriate sizes.

### Search

Full-text search across sessions, speakers, and booths with an on-screen virtual keyboard optimized for touch input.

### Multi-language

Supports Dutch, English, German, and French out of the box. Language switcher in the header. Admins can override any translation string per event.

### Touch Optimized

- 48px minimum tap targets
- Press animations for tactile feedback
- No hover states — designed for fingers, not mice
- Kiosk-safe: no text selection, no pinch zoom, no context menus
- Auto-resets to the home screen after 60 seconds of inactivity

## Admin Panel

Event organizers manage their kiosk configuration through a separate admin panel:

- **Event config** — branding colors, logo, languages, timezone
- **Sponsors** — add/edit/remove sponsors with logos, descriptions, tier assignment
- **Floor maps** — upload venue images, draw tappable room hotspots with a visual editor
- **Translations** — override any UI string per language

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

# Start admin panel (optional, in another terminal)
pnpm dev:admin
```

The kiosk app runs at `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Start API dev server |
| `pnpm dev:kiosk` | Start kiosk dev server |
| `pnpm dev:admin` | Start admin dev server |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

## Documentation

- [Architecture](docs/architecture.md) — tech stack, project structure, data flow
- [API Reference](docs/api.md) — backend endpoints and environment variables
- [Deployment](docs/deployment.md) — Azure infrastructure and CI/CD
- [Azure Cost Estimate](docs/azure-costs.md) — monthly cost breakdown
- [Roadmap](docs/roadmap.md) — implementation phases and progress

## License

MIT
