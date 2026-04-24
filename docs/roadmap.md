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

## Phase 7: Event-Ready Polish ✅

- [x] Security P0: split PublicEventConfig/AdminEventConfig, drop apiKey, lock down /api/auth/setup behind SETUP_TOKEN
- [x] Security P1: fail-fast env, JWT algorithm/issuer/audience enforcement, login rate limit, dep patches (18 vulns → 0 high), zod validation on admin writes, upload magic-byte sniff, security headers, log redaction
- [x] Reliability: stale-while-error cache, warmup endpoint + container startup probe, persisted QueryClient, reconnecting banner, warmup overlay
- [x] Store refactor: session state centralized, inactivity reset clears everything
- [x] Agenda UX: LIVE pill, dim-past, label filter chips, jump-to-now button, dev-only ?now= override
- [x] Cross-feature search: sessions + speakers + booths in three sections
- [x] Floor map deep links: session/booth → show-on-map with hotspot pulse
- [x] Practical info page (WiFi, venue, schedule, emergency, facilities, contact)
- [x] Accessibility: font-size (3 steps) + high-contrast theme with root CSS variable overrides

## Future Improvements

- [ ] Testing on actual kiosk hardware
- [ ] Additional languages (Danish, Italian, Greek)
- [ ] Push notifications for session changes
- [ ] QR code scanning for session check-in
- [ ] Analytics dashboard (most viewed sessions, popular search terms)
- [ ] Offline mode with service worker
- [ ] Multi-event support in a single deployment
- [ ] Admin UI for linking booths to floor-map hotspots (API side done — PUT `/api/admin/events/:slug/booth-overrides/:boothId` — BoothsPage in admin still pending since booths live in run.events)
- [ ] Admin editor UI for picking a `roomGuid` per hotspot from the live run.events agenda (API schema already accepts `roomGuid`; currently populated via direct PUT)
- [ ] Application Insights + kiosk heartbeat monitoring
- [ ] OS-level kiosk lockdown guide (Chrome kiosk mode, autostart, disable F11/context menu)
- [ ] Sponsor QR codes (attendee takes a link home)
- [ ] Azure managed identity: disable ACR admin, MSI for Cosmos/Storage, align Bicep CORS with app code
- [ ] GitHub Actions OIDC + SHA-pinned actions + minimal permissions
- [ ] Admin token migration to HttpOnly cookies + CSRF protection
- [ ] Switch bootstrap admin creation from upsert to create() for true conflict-throwing idempotency
- [ ] Structured audit logging + alerting for login/setup attempts, admin mutations, uploads
