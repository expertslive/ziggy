# Ziggy Roadmap

## Phase 1: Foundation (monorepo + backend + basic kiosk) ✅

- [x] pnpm monorepo setup, TypeScript configs, ESLint/Prettier
- [x] Shared types from run.events API responses
- [x] Hono API: health, run.events proxy, in-memory cache
- [x] Kiosk shell: layout, router, branding (Nunito, EL colors), kiosk CSS resets
- [x] Agenda page with day tabs, timeline, session cards, detail modal

**Verification**: Run `pnpm dev` in API and kiosk, verify agenda loads from run.events API

## Phase 2: Core kiosk features ← **Current**

- [ ] "What's happening now" home page with auto-refresh
- [ ] Speaker browsing (grid + detail)
- [ ] Search with `react-simple-keyboard`
- [ ] Inactivity timer (60s auto-reset)
- [ ] Multi-language (i18next, Dutch + English initial)
- [ ] Touch optimization pass

**Verification**: Test all kiosk pages, verify inactivity reset, language switching, search

## Phase 3: Azure infrastructure + deployment

- [ ] Bicep templates (Cosmos DB, Container Apps, Static Web Apps, Blob Storage, Key Vault)
- [ ] Deploy to Azure, set up Cosmos DB containers
- [ ] Containerize API (Dockerfile), deploy to Container Apps
- [ ] Deploy kiosk to Static Web Apps
- [ ] GitHub Actions CI/CD

**Verification**: Hit deployed Azure endpoints, verify caching, CI/CD green

## Phase 4: Admin panel — core

- [ ] Admin app setup (Vite + React + Tailwind + Radix UI)
- [ ] Auth (JWT login, protected routes)
- [ ] Event config page
- [ ] Sponsor management (CRUD, logo upload, tiers)
- [ ] Sponsors page in kiosk

**Verification**: Login to admin, create sponsor, verify it appears on kiosk

## Phase 5: Floor maps + hotspot editor

- [ ] Floor map admin: upload, list, manage
- [ ] Konva polygon editor: draw, edit, link rooms
- [ ] Kiosk floor map: SVG hotspot overlays, room popover with current session
- [ ] API endpoints for floor map CRUD

**Verification**: Upload floor map, draw hotspots, verify tappable on kiosk with room popover

## Phase 6: Polish + production readiness

- [ ] Remaining translations (DE, DA, FR, IT, EL)
- [ ] i18n override system in admin
- [ ] Booth/expo integration
- [ ] Performance optimization (lazy loading, bundle analysis)
- [ ] Error handling + graceful degradation
- [ ] Testing on actual kiosk hardware

**Verification**: Full end-to-end test with real event data on touch hardware
