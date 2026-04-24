# Event-Ready Polish — Design Spec

**Date:** 2026-04-24
**Target event:** Experts Live Netherlands 2026 (2026-06-01 / 2026-06-02)
**Scope:** Production hardening + attendee-experience finishing before the event. Eight buckets. Security P0s sequenced first.

## Context

Phases 1–6 of the Ziggy roadmap are complete. The kiosk is deployed and the admin panel is usable. ~99% of sessions are in run.events. The only outstanding content is isometric floor-map PNGs, arriving in 2–3 weeks — this does not block any code in this spec.

A separate security review (`docs/security-hardening-review.md`) identified several issues, the event-critical subset of which is folded into section 8.

## Out of scope

- Application Insights / kiosk heartbeat monitoring
- OS-level kiosk lockdown guide
- Sponsor QR codes
- Service worker / true offline mode (chose level B resilience, not level C)
- Multi-event support
- Azure managed-identity infra rework (ACR admin disable, Cosmos/Storage MSI, CORS Bicep alignment)
- GitHub Actions OIDC + SHA pinning + minimal permissions
- Container non-root + digest-pinned base image
- Admin token migration to HttpOnly cookies + CSRF
- Structured audit logging + alerting

All deferred items should be tracked as follow-ups in `docs/roadmap.md` under "Future Improvements".

---

## 1. Reliability — stale-on-error, persisted cache, reconnecting UX

### API server

**Stale-while-error cache.** Extend `packages/api/src/lib/cache.ts` so every successful write stores a second entry `{key}:last-good` with no TTL. Add a `getOrStale<T>(key)` helper that returns the live value when present, otherwise the last-good value. Every `fetchAgenda`/`fetchSpeakers`/`fetchBooths`/`fetchPartnerships` call in `run-events.ts` uses this pattern: on fetch failure, return last-good and log a warning. The route wraps the response with header `X-Stale: true` when last-good was used. If no cache exists at all (cold start + upstream down), the route returns 502 as today.

**Warmup endpoint.** New `packages/api/src/routes/warmup.ts` exposing `GET /api/warmup`. Triggers `fetchRawAgenda`, `fetchSpeakers`, `fetchBooths`, `fetchPartnerships` in parallel and returns `{ ok: true, warmed: [...] }`. Intended for Container Apps startup probe; mount it at startup in `index.ts`. Container Apps health probe config added to Bicep (`readinessProbe` hitting `/api/warmup`).

### Kiosk client

**Central QueryClient.** New `packages/kiosk/src/lib/queryClient.ts` exporting a configured `QueryClient`:

```ts
{
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      staleTime: 60_000,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
}
```

Instantiated once in `main.tsx`. Replace any existing ad-hoc `QueryClient`.

**Persisted cache.** Add `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`. Persister writes to `localStorage` with key `ziggy-query-cache`. Cache bust key derived from Vite build hash (`import.meta.env.VITE_BUILD_HASH`, set in CI from git SHA). On version mismatch the persisted cache is discarded.

**Reconnecting banner.** New `packages/kiosk/src/components/ReconnectingBanner.tsx`. Subscribes to `useQueryClient().getQueryCache()`; shows a thin yellow bar at the top of the screen ("Reconnecting to event data…") when any query has been in `error` state for >10 seconds. Hides immediately when any query succeeds. Mounted inside `App.tsx` above `<Header />`.

**Warmup overlay.** New `packages/kiosk/src/components/WarmupOverlay.tsx`. Shows a branded "Warming up…" splash when any of the core queries (agenda, now, event-config) has been in initial loading state for >15 seconds. Includes a "Retry" button calling `queryClient.invalidateQueries()`. Replaces the inline red "Error" state on `NowPage` and `AgendaPage` — pages keep showing last-good data underneath the overlay if the persisted cache had data.

**Remove per-page error states.** `NowPage.tsx:94-101`, `AgendaPage.tsx:95-102`, and other pages drop their red error early-return in favor of the overlay strategy. Pages must tolerate `data === undefined` briefly.

---

## 2. Full inactivity reset

Current `useInactivityReset` only navigates to `/now`. The reset must clear every piece of attendee-facing state.

### Changes

**Move UI state into the Zustand store.** `packages/kiosk/src/store/kiosk.ts` gains:

```ts
selectedDayIndex: number | null
openSessionId: number | null
openSpeakerId: number | null
openBoothId: number | null
searchQuery: string
selectedMapId: string | null
mapHighlightId: string | null
fontScale: 1 | 1.2 | 1.4
theme: 'default' | 'high-contrast'
resetSession(): void
```

The `resetSession()` action:
- nulls every modal/selection field
- empties `searchQuery`
- resets `fontScale` to 1 and `theme` to `'default'`
- resets `language` to `eventConfig.defaultLanguage` (read via a getter passed in)
- leaves `eventSlug` and `lastInteraction` untouched

**Page refactor.** `AgendaPage`, `NowPage`, `SpeakersPage`, `BoothsPage`, `MapPage`, `SearchPage` replace their local `useState` for modal/selection state with store selectors. `SessionDetailModal` / `SpeakerDetailModal` read `openSessionId`/`openSpeakerId` from the store.

**Inactivity hook update.** `useInactivityReset.ts:12-17` calls `resetSession()` before `navigate('/now', { replace: true })`.

---

## 3. Agenda UX — label filter, live-now, dim past, jump-to-now

### Label filter

Above the timeline (below day tabs), render a horizontally scrollable chip row. Chips derived from:

```ts
const labels = useMemo(() => {
  const map = new Map<string, Label>()
  for (const slot of currentDay.timeslots)
    for (const s of slot.sessions)
      for (const l of s.labels)
        map.set(l.name, l)
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}, [currentDay])
```

Store `agendaLabelFilter: string[]` in the Zustand store so `resetSession()` can clear it (§2). It does NOT reset when switching day tabs — attendees filtering for "Azure" probably want that filter to persist across days.

Tap toggles. Active chips use the label's `color` as background. Clear-all chip appears when ≥1 selected.

Session filter: `sessions.filter(s => !active.length || s.labels.some(l => active.includes(l.name)))`.

### Live-now indicator

In `SessionCard.tsx`, accept an optional `now: Date` prop (passed from parent, shared across all cards in a page to avoid N re-renders per tick). If `startDate <= now < endDate`, render a small red dot + "LIVE" pill in the top-right of the card. Pill uses `bg-red-500 text-white`, pulses via Tailwind `animate-pulse`.

`AgendaPage` and `NowPage` create a single `useClockTick(30_000)` hook returning a `Date` that updates every 30s.

### Dim past sessions

In `SessionCard.tsx`, when `endDate < now`, apply `opacity-40` to the card's outer container. Session remains tappable (attendees may still want details).

### Jump-to-now button

In `AgendaPage`, when (a) the active day tab is today (in event timezone) AND (b) there's a timeslot containing the current moment, render a floating button in the bottom-right:

```tsx
<button className="fixed bottom-24 right-6 bg-el-blue text-white rounded-full px-5 py-3 shadow-lg">
  {t('agenda.jumpToNow')}
</button>
```

On tap: scrolls the containing timeslot's DOM node into view with `scrollIntoView({ behavior: 'smooth', block: 'center' })`. Each timeslot gets a `ref` stored in a `Map<string, HTMLElement>` keyed by `startTimeGroup`.

### Dev-only time override

Both `useClockTick` and the `AgendaPage` "jump-to-now" logic read from a helper `getSimulatedNow()` that checks `import.meta.env.DEV && URLSearchParams` for a `?now=2026-06-02T10:30` query param. Lets developers verify live/past/jump-to-now behavior before the event date.

---

## 4. Cross-feature search

Rework `SearchPage.tsx`:

- Three data sources: `useSearch(query)` (existing run.events agenda search, ≥4 chars), plus client-side substring match over `useSpeakers()` results and `useBooths()` results. No min length for client-side.
- Single query input + virtual keyboard.
- Three result sections: **Sessions** (from server), **Speakers** (client), **Booths** (client). Each section header shows count. Show first 6 per section, with "Show all N" button expanding the section inline.
- Query-too-short state: show an empty-state above the section headers saying "Keep typing for sessions (need ≥4 characters)". Speaker/booth sections populate as soon as query ≥1 char.
- No results in any section: single empty state, no per-section "no results" clutter.

Client-side matchers:

```ts
const q = query.toLowerCase()
const matchedSpeakers = speakers.filter(s =>
  s.name.toLowerCase().includes(q) ||
  s.company?.toLowerCase().includes(q) ||
  s.tagline?.toLowerCase().includes(q))
const matchedBooths = booths.filter(b =>
  b.name.toLowerCase().includes(q) ||
  b.organization?.toLowerCase().includes(q) ||
  b.boothNumber?.toLowerCase().includes(q))
```

Tapping a result opens the relevant detail modal (session/speaker/booth).

---

## 5. Floor map deep links

### Kiosk

**"Show on map" button.** In `SessionDetailModal.tsx` next to the room name, add a button. `onClick`: close modal, set `mapHighlightId = session.roomGuid`, navigate to `/map`. Booth detail modal (currently inline in `BoothsPage.tsx`) gets an equivalent button using `booth.floorMapHotspotId` (new admin-managed field, see below).

**MapPage highlight behavior.** `MapPage.tsx` reads `mapHighlightId` from store on mount. If set:
- Auto-select the map whose `hotspots` array contains a hotspot with matching `roomGuid` (for sessions) or `id` (for booths).
- Render that hotspot with a pulsing gold glow (`drop-shadow` filter, 2s animation).
- Auto-pan/zoom so the hotspot bounding box is centered and fills ~60% of the viewport.
- Clear `mapHighlightId` on first user interaction with the map.

### Admin

**Booth → hotspot link.** Create a new Cosmos container `booth-overrides` keyed by `{eventSlug}:{boothId}` with one field `floorMapHotspotId?: string`. Admin booth-list page gets a "Link to map" action per booth → picker showing all hotspots from all floor maps for the event. (Booth content itself stays in run.events; this container is strictly for kiosk-local metadata.)

Kiosk falls back to hiding the "Show on map" button when `floorMapHotspotId` is unset.

### Rooms → hotspots

Sessions already carry `roomGuid`. Hotspot polygon editor already stores `roomName`; extend to also store optional `roomGuid`. Admin hotspot editor adds a room-guid picker (dropdown of distinct `roomGuid`s from cached agenda). Existing hotspots without `roomGuid` continue to work by room-name fallback match.

---

## 6. Practical info page (hardcoded)

### Route + nav

New page `packages/kiosk/src/pages/InfoPage.tsx` at route `/info`. Add to `BottomNav.tsx` with an info-circle icon and `t('nav.info')` label.

### Content

Six sections, each rendering from i18n keys. No admin UI, no Cosmos.

- **WiFi** — `info.wifi.ssid`, `info.wifi.password`. Rendered oversized (3xl font) because this is the most-tapped reason.
- **Venue** — `info.venue.name`, `info.venue.address` (multi-line).
- **Schedule summary** — `info.schedule.doorsOpen`, `info.schedule.lunch`, `info.schedule.drinks`, per day.
- **Emergency / first aid** — `info.emergency.location`, `info.emergency.phone`.
- **Facilities** — `info.facilities.toilets`, `info.facilities.cloakroom`.
- **Organizer contact** — `info.contact.name`, `info.contact.email`, `info.contact.phone`.

All six keys added to `nl.json`, `en.json`, `de.json`, `fr.json`. Values filled with real Experts Live NL 2026 data at build time by the developer.

### Layout

2-column grid on landscape (`md:grid-cols-2`), single column on portrait. Each section is a rounded card with a top-aligned icon. WiFi card spans both columns on landscape for visual weight.

---

## 7. Accessibility controls

### Header control

`Header.tsx` gains an accessibility button (Unicode "Ⓐ" or a Heroicons accessibility-compliant icon) next to the language switcher. Tap opens a small popover.

### Popover

Two controls:

- **Font size** — three buttons labeled "A / A+ / A++", each a 48×48 tap target. Sets store `fontScale` to `1`, `1.2`, or `1.4`. Active choice highlighted.
- **High contrast** — toggle switch. Sets store `theme` to `'default'` or `'high-contrast'`.

Popover closes on any outside tap or on next nav.

### Application

`App.tsx` sets CSS variables on the root element:

```tsx
<div style={{ fontSize: `${fontScale * 16}px` }} data-theme={theme}>
```

Add to `index.css`:

```css
[data-theme='high-contrast'] {
  --color-el-darker: #000000;
  --color-el-dark: #000000;
  --color-el-light: #ffffff;
  --color-el-blue: #ffcc00;
  --color-el-gray: #1a1a1a;
  --color-el-gray-light: #333333;
}
```

All components already reference these via Tailwind `bg-el-*` / `text-el-*` classes, so the theme switch is a CSS-variable swap.

Both settings reset on inactivity via `resetSession()` (§2).

---

## 8. Security hardening (event-critical subset)

### 8.1 P0 — Public config secret leak

**Type split.** In `packages/shared/src/types/event.ts`:

```ts
export interface PublicEventConfig {
  slug: string
  name: string
  timezone: string
  languages: string[]
  defaultLanguage: string
  branding: Branding
  days: Array<{ date: string; label: Record<string, string> }>
}

// AdminEventConfig currently has no extra fields — alias for now.
export type AdminEventConfig = PublicEventConfig
```

**Remove `EventConfig.apiKey` entirely.** The runtime already uses `env.RUN_EVENTS_API_KEY` (confirmed in `events.ts:21`); the stored field is unused. Delete from the shared type, the admin write handler (`admin.ts:345-349`), and any admin form field. If any Cosmos `events` document has a stored `apiKey` value, the migration step (see Deploy notes) scrubs it.

**Explicit public projection.** `events.ts:25-56` constructs the public response object field-by-field instead of returning the Cosmos doc. No spread.

**Regression test.** New test in `packages/api/src/routes/events.test.ts` (add vitest if absent) asserting the `/api/events/:slug/config` response has none of: `apiKey`, `passwordHash`, `connectionString`, `token`, `secret`, `clientSecret`.

### 8.2 P0/P1 — Lock down `/api/auth/setup`

- Read `SETUP_TOKEN` from `env`. If unset, `/api/auth/setup` returns 503.
- If set, endpoint requires header `X-Setup-Token` matching. Mismatch → 401.
- After any admin exists, endpoint returns 403 regardless of token.
- First-admin creation uses a fixed document id `bootstrap` + Cosmos `ifNoneMatch: '*'` condition, so the check-then-create race is impossible.

### 8.3 P1 — Login + JWT hardening

**Rate limit.** In-process per-API-instance rate limiter (simple `Map<key, { count, resetAt }>`): max 5 failed auth attempts per `{ip}:{email}` per 15 min. Applied to `POST /api/auth/login` and `POST /api/auth/setup`. 429 response on exceed. Cleared on successful login.

**Fail-fast config.** `env.ts` throws at startup when `NODE_ENV === 'production'` and any of `JWT_SECRET`, `COSMOS_CONNECTION_STRING`, `STORAGE_CONNECTION_STRING`, `RUN_EVENTS_API_KEY` is missing or empty. `JWT_SECRET` additionally must be ≥32 chars; otherwise throw.

**Explicit JWT verification.** `auth.ts:23-26` verify call becomes:

```ts
jwt.verify(token, env.JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'ziggy',
  audience: 'ziggy-admin',
})
```

Sign call updated to include `issuer`, `audience`.

**Token storage:** Admin tokens remain in `localStorage` for this pass. Flagged as follow-up.

### 8.4 P1 — Dependency updates

- Update `hono` to `^4.12.14`, `@hono/node-server` to `^1.19.13`, Azure SDK packages to latest, regenerate lockfile.
- Delete `i18next-http-backend` dependency from `packages/kiosk/package.json` (not imported anywhere in kiosk source — verified by grep during audit).
- Add step to `.github/workflows/ci.yml`: `pnpm audit --prod --audit-level=high`. Fail CI on any high-severity finding.

### 8.5 P1/P2 — Admin input validation

**Zod schemas.** Add `zod` dep. New file `packages/api/src/schemas/admin.ts` with schemas per admin entity:

- `SponsorSchema`: name (1–200 chars), tierId (uuid), logoUrl (`https://` URL only), website (`https://` URL only, optional), boothNumber (0–20 chars), description (record of language→string, each ≤2000 chars), sortOrder (integer 0–10000).
- `SponsorTierSchema`: similar constraints; displaySize ∈ {large, medium, small}.
- `FloorMapSchema`: imageUrl validated, label record language-keyed (keys in `SUPPORTED_LANGUAGES`), hotspots array max 100, each hotspot has 3–50 points, each point `[0–10000, 0–10000]`.
- `EventConfigSchema`: branding colors `#[0-9a-f]{6}`, languages subset of `SUPPORTED_LANGUAGES`, days array max 14, label record language-keyed.
- `I18nOverrideSchema`: language in `SUPPORTED_LANGUAGES`, overrides record max 500 keys, each value ≤1000 chars.

Every admin write route parses the body with its schema, returns 400 on failure, constructs the persisted object from allowlisted fields only. No `...body` spreads.

**Body size limit.** Add middleware in `index.ts` that rejects non-upload JSON bodies >1 MB. Upload route remains separate with its own 25 MB limit.

**Search query length limit.** `events.ts:147-167` caps `q` at 100 chars, returns 400 beyond.

**Upstream fetch timeout.** `run-events.ts:29` uses `AbortSignal.timeout(10_000)`.

### 8.6 P1/P2 — Upload hardening

In `packages/api/src/routes/admin.ts` upload handler + `lib/storage.ts`:

- Accept only `image/jpeg`, `image/png`, `image/webp`. Reject SVG, GIF, anything else (400).
- Validate file content by magic-byte sniff (first 12 bytes): JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `52 49 46 46 .. .. .. .. 57 45 42 50`. Mismatch → 400.
- Blob extension derived from detected type, not filename.
- Align size limit and error message: 25 MB in both the check and the error text.
- Server-side dimension check: decode PNG/JPEG/WebP header-only (using `image-size` package), reject >8000×8000.
- Uploaded blob metadata: `Cache-Control: public, max-age=31536000, immutable`, `Content-Type` set explicitly from detected type, `X-Content-Type-Options: nosniff` header set on the blob.

### 8.7 P2 — Security headers

**SWA.** `packages/kiosk/staticwebapp.config.json` and `packages/admin/staticwebapp.config.json` gain a `globalHeaders` block:

```json
{
  "globalHeaders": {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
  }
}
```

Start CSP in enforce mode from day one since the origins are known (self, run.events images, Azure Blob Storage images). If it breaks anything in dev/staging, relax iteratively.

**API.** Add Hono `secureHeaders()` middleware to `packages/api/src/index.ts` after the CORS middleware.

### 8.8 Logging redaction

`run-events.ts:37-39`: log only `response.status` and path, not the body. Strip Authorization and ApiKey headers from any future request logging via Hono's logger config.

---

## Code structure summary

### New files

- `packages/kiosk/src/lib/queryClient.ts`
- `packages/kiosk/src/lib/clock.ts` — `useClockTick(intervalMs)` + `getSimulatedNow()`
- `packages/kiosk/src/components/ReconnectingBanner.tsx`
- `packages/kiosk/src/components/WarmupOverlay.tsx`
- `packages/kiosk/src/components/AccessibilityMenu.tsx`
- `packages/kiosk/src/pages/InfoPage.tsx`
- `packages/api/src/routes/warmup.ts`
- `packages/api/src/schemas/admin.ts`
- `packages/api/src/routes/events.test.ts`
- `packages/api/src/lib/magic-bytes.ts`

### Touched files

- `packages/kiosk/src/App.tsx` — banner, overlay, theme/fontScale root
- `packages/kiosk/src/main.tsx` — persisted QueryClient wiring
- `packages/kiosk/src/components/Header.tsx` — accessibility menu button
- `packages/kiosk/src/components/BottomNav.tsx` — /info entry
- `packages/kiosk/src/components/SessionCard.tsx` — live/past states
- `packages/kiosk/src/components/SessionDetailModal.tsx` — show-on-map
- `packages/kiosk/src/hooks/useInactivityReset.ts` — calls resetSession
- `packages/kiosk/src/store/kiosk.ts` — full state expansion
- `packages/kiosk/src/pages/*.tsx` — all seven pages refactor for store-driven state
- `packages/kiosk/src/lib/hooks.ts` — tune per-query options where central config isn't enough
- `packages/kiosk/src/i18n/{nl,en,de,fr}.json` — new keys for labels, info, accessibility, jump-to-now, reconnecting
- `packages/kiosk/src/index.css` — high-contrast theme variables
- `packages/kiosk/package.json` — remove i18next-http-backend, add persist-client + sync-storage-persister
- `packages/api/src/index.ts` — secure headers, body size, warmup mount
- `packages/api/src/env.ts` — fail-fast + SETUP_TOKEN
- `packages/api/src/lib/cache.ts` — last-good layer
- `packages/api/src/lib/run-events.ts` — stale-on-error, abort signal, redaction
- `packages/api/src/lib/auth.ts` — explicit JWT verify options
- `packages/api/src/lib/storage.ts` — MIME-derived extension, blob headers
- `packages/api/src/routes/admin.ts` — setup lockdown, zod schemas, upload hardening, rate limit
- `packages/api/src/routes/events.ts` — public projection for config
- `packages/shared/src/types/event.ts` — split types, remove apiKey
- `.github/workflows/ci.yml` — `pnpm audit --prod`
- `packages/admin/staticwebapp.config.json` + `packages/kiosk/staticwebapp.config.json` — global headers
- `infra/main.bicep` — readiness probe for warmup (only this, larger infra rework deferred)

---

## Deploy notes

1. **Run once before redeploy:** scrub any `apiKey` fields from existing Cosmos `events` documents (one-off script in `packages/api/scripts/scrub-apikey.ts`). If any scrubbed value was a real run.events key, rotate it at run.events.
2. Set new env vars: `SETUP_TOKEN` (random 32+ char string), verify `JWT_SECRET` is ≥32 chars.
3. After first deploy, verify `/api/events/:slug/config` response contains no `apiKey`.
4. Verify CSP in browser console on kiosk and admin; relax if any legitimate resource is blocked.

---

## Sequencing

Work ordered by dependency + risk:

1. **Security P0s** (§8.1, §8.2) — exposure exists today.
2. **Security P1s** (§8.3, §8.4, §8.5, §8.6, §8.7) — before public testing.
3. **Reliability** (§1) — underpins everything visible.
4. **Inactivity reset state refactor** (§2) — other buckets depend on the expanded store shape.
5. **Agenda UX** (§3), **Search** (§4), **Floor map deep links** (§5) — can run in parallel once §2 lands.
6. **Practical info page** (§6) — standalone, any time.
7. **Accessibility** (§7) — depends on §2 for resetSession wiring.

## Acceptance criteria

- Red "Error" screen never appears during a 5-minute kiosk-idle + API-offline test.
- 90-second attendee-idle leaves kiosk on `/now` with no prior user's state (search empty, no modals, default language, default font size).
- Agenda page shows at least one LIVE pill when visited during a session, and jump-to-now scrolls to it.
- Searching for a known speaker name returns that speaker under "Speakers".
- Tapping a session's "Show on map" centers the correct hotspot with a glow.
- `/info` displays WiFi SSID + password at glance distance.
- Font-size A++ is legible from 2m away in default theme and in high-contrast.
- `GET /api/events/experts-live-netherlands-2026/config` response contains no secret-shaped keys (automated test).
- `POST /api/auth/setup` returns 403 when an admin exists, 401 without correct `X-Setup-Token`, 503 when env var unset.
- Six consecutive wrong-password logins from the same IP/email return 429.
- `pnpm audit --prod --audit-level=high` exits 0.
- Uploading an SVG or GIF returns 400.
- `curl -I https://<kiosk>/` shows the new security headers.
