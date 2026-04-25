# Ziggy

Touch-screen kiosk web app for [Experts Live](https://www.intechnieuws.nl/experts-live-netherlands-2026/)
conference events. Attendees walk up to a 1080×1920 portrait screen, find
sessions, speakers, booths, and venue maps; admins manage event content
through a separate panel. Session, speaker, and booth data is sourced from
[run.events](https://run.events); admin-managed data lives in Azure Cosmos
DB.

## Live URLs

- Kiosk: `https://ziggy.expertslive.dev` (planned) — currently
  `https://victorious-plant-071edeb03.6.azurestaticapps.net`
- Admin: `https://ziggy-admin.expertslive.dev` (live) — fallback
  `https://gray-hill-067f71103.1.azurestaticapps.net`

## Quick start

```bash
# Install
pnpm install

# Build shared types first — every other package depends on it
pnpm build:shared

# Configure API
cp packages/api/.env.example packages/api/.env
# Edit .env to add RUN_EVENTS_API_KEY (and Cosmos/Storage if testing those)

# Run all three dev servers in separate terminals
pnpm dev:api      # API on http://localhost:3001
pnpm dev:kiosk    # kiosk on http://localhost:5173
pnpm dev:admin    # admin on http://localhost:5174
```

| Command | Description |
|---|---|
| `pnpm dev:api` / `dev:kiosk` / `dev:admin` | Run a dev server |
| `pnpm build:shared` | Build the shared types package (required first) |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Type-check all packages |
| `pnpm -r test` | Run unit tests in every package |

## Documentation

Start with `architecture.md` if you're new to the codebase.

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Tech stack, package layout, data flow diagrams, kiosk page tree |
| [docs/data-model.md](docs/data-model.md) | Shared types, Cosmos containers, run.events transform |
| [docs/state-management.md](docs/state-management.md) | Zustand store, inactivity reset, deep links, theme + font scale |
| [docs/api.md](docs/api.md) | Full HTTP endpoint reference, schemas, rate limits, headers |
| [docs/security.md](docs/security.md) | Threat model, JWT, Key Vault, validation, security headers |
| [docs/deployment.md](docs/deployment.md) | Azure topology, CI/CD, manual deploy, Bicep refactor history |
| [docs/azure-costs.md](docs/azure-costs.md) | Monthly cost estimates by resource |
| [docs/admin-guide.md](docs/admin-guide.md) | How event organizers use the admin panel |
| [docs/attendee-guide.md](docs/attendee-guide.md) | What attendees see and tap on the kiosk |
| [docs/lessons-learned.md](docs/lessons-learned.md) | Gotchas and design notes from the rebuild |
| [docs/event-ready-deploy-runbook.md](docs/event-ready-deploy-runbook.md) | Pre/post-deploy checklist |
| [docs/security-hardening-review.md](docs/security-hardening-review.md) | Original security audit (April 2026) |

## License

MIT
