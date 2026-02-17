# Roadmap

## Phase 1: Foundation ✅

- [x] pnpm monorepo setup, TypeScript configs, ESLint/Prettier
- [x] Shared types from run.events API responses
- [x] Hono API: health, run.events proxy, in-memory cache
- [x] Kiosk shell: layout, router, branding (Nunito, EL colors), kiosk CSS resets
- [x] Agenda page with day tabs, timeline, session cards, detail modal

## Phase 2: Core Kiosk Features ✅

- [x] "What's happening now" home page with auto-refresh
- [x] Speaker browsing (grid + detail)
- [x] Search with virtual keyboard
- [x] Inactivity timer (60s auto-reset)
- [x] Multi-language (i18next: Dutch + English)
- [x] Touch optimization pass

## Phase 3: Azure Infrastructure + Deployment ✅

- [x] Azure resources: Cosmos DB, Container Apps, Static Web Apps, Blob Storage
- [x] Deploy to Azure, set up Cosmos DB containers
- [x] Containerize API (Dockerfile), deploy to Container Apps
- [x] Deploy kiosk to Static Web Apps
- [x] GitHub Actions CI/CD

## Phase 4: Admin Panel ✅

- [x] Admin app setup (Vite + React + Tailwind)
- [x] Auth (JWT login, protected routes)
- [x] Event config page
- [x] Sponsor management (CRUD, logo upload, tiers)
- [x] Sponsors page in kiosk

## Phase 5: Floor Maps + Hotspot Editor ✅

- [x] Floor map admin: upload, list, manage
- [x] Konva polygon editor: draw, edit, link rooms
- [x] Kiosk floor map: SVG hotspot overlays, room popover with current session
- [x] API endpoints for floor map CRUD

## Phase 6: Polish + Production Readiness ✅

- [x] Additional translations (German, French)
- [x] i18n override system in admin
- [x] Booth/expo integration
- [x] Performance optimization (lazy loading, code splitting)
- [x] Error handling with error boundaries + React Query retry
- [x] Experts Live branding (logo, colors, sponsor data)

## Future Improvements

- [ ] Testing on actual kiosk hardware
- [ ] Additional languages (Danish, Italian, Greek)
- [ ] Push notifications for session changes
- [ ] QR code scanning for session check-in
- [ ] Analytics dashboard (most viewed sessions, popular search terms)
- [ ] Offline mode with service worker
- [ ] Multi-event support in a single deployment
