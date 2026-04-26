# API Reference

The Hono API is a thin BFF: it proxies run.events, serves admin-managed
documents from Cosmos DB, and exposes a small JWT-authenticated CRUD layer for
the admin panel.

Base URL in production: `https://<container-app>.azurecontainerapps.io`. CORS
is locked to `https://ziggy.expertslive.dev`,
`https://ziggy-admin.expertslive.dev`, and the two `*.azurestaticapps.net`
fallbacks. All errors use `{ error: string }` shape (sometimes with an
`issues` array from zod).

## Public endpoints (no auth)

### Health and warmup

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/health` | Returns `{ status: 'ok', timestamp }`. |
| `GET` | `/api/warmup` | Fetches agenda, speakers, booths, partnerships in parallel to populate caches. Returns `{ ok, warmed: [{ source, ok }] }`. Status 200 if all four succeed, 503 otherwise. Used as the Container App startup probe. |

### Agenda routes (proxy run.events, 5-min cache)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events/:slug/config` | Public event config (branding, languages, days, timezone). Returned shape is `PublicEventConfig` — explicitly projected to exclude any admin-only fields. Falls back to a hardcoded default if Cosmos returns nothing. |
| `GET` | `/api/events/:slug/agenda` | Structured agenda: `{ days: [{ date, timeslots: [{ startTimeGroup, sessions[] }] }], timeZone }`. |
| `GET` | `/api/events/:slug/sessions/now` | `{ current: AgendaItem[], currentBreaks: AgendaItem[], upNext: AgendaItem[], timeZone }`. `current` = content sessions (`elementType=1`) whose `[startDate, endDate)` contains "now"; `currentBreaks` = NonContent items (`elementType=2` — lunch, breaks, registration, borrel) live at the same instant; `upNext` = next contiguous timeslot of content sessions. NonContent items have `labels: []` and `speakers: []` normalized server-side because run.events returns `null` for both. Accepts an optional `?now=<ISO-8601>` query param to override "now" — used by the kiosk's preview mode (`/now?now=2026-06-02T12:30:00Z` shows the kiosk what lunch looks like). |
| `GET` | `/api/events/:slug/speakers` | Returns `RunEventsSpeaker[]`. |
| `GET` | `/api/events/:slug/booths` | Returns `RunEventsBooth[]`, each merged with its optional `floorMapHotspotId` from the `booth-overrides` Cosmos container. |
| `GET` | `/api/events/:slug/search?q=` | Agenda full-text search. `q` must be 4–100 chars (`MIN_SEARCH_LENGTH = 4`). Returns up to whatever run.events returns — capped at 100 chars on input. |

### Catalog routes (Cosmos-only, no upstream)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events/:slug/sponsors` | `Sponsor[]` from Cosmos. Falls back to `[]` on any error. |
| `GET` | `/api/events/:slug/sponsor-tiers` | `SponsorTier[]`. |
| `GET` | `/api/events/:slug/floor-maps` | `FloorMap[]` (each contains a `hotspots` array). |
| `GET` | `/api/events/:slug/i18n-overrides` | `I18nOverrides[]` (one document per language). |
| `GET` | `/api/events/:slug/shop-items` | `ShopItem[]` from Cosmos `shop-items` (sorted by `sortOrder`). Falls back to `[]` on error. |

### Stale-while-error and the `X-Stale` header

Every agenda-style proxy route follows this rule: when an upstream fetch
fails *and* the live cache is also empty, we serve the last-good value (no
expiry) from `cache.getOrStale()` and set `X-Stale: true` on the response. The
kiosk does not currently inspect this header, but it shows up in API logs and
makes outage incidents visible.

If both the live cache and the last-good store are empty, the route returns
`502 { error: '...' }`.

## Admin auth

### `POST /api/auth/login`

Body: `{ email, password }`. Returns `{ token, expiresAt }` on success.

- Rate-limited per `(IP, email.toLowerCase())` — 5 failures per 15-minute
  sliding window. Window resets on successful login. Returns `429` once the
  bucket fills.
- Looks up admin by email, compares with bcrypt, signs a 24h HS256 JWT.
- `400` if email/password missing, `401` for unknown admin or bad password,
  `429` after lockout.

### `POST /api/auth/setup`

Bootstrap the first admin. Three locks gate this endpoint:

1. `SETUP_TOKEN` env must be set; otherwise the route returns `503 { error:
   'Setup disabled' }`. After bootstrap is complete, unset the env to harden
   it permanently.
2. `X-Setup-Token` request header must match the env value; otherwise `401`.
3. The `admins` container must be empty; otherwise `403 { error: 'Admin
   already exists. Setup is disabled.' }` (no rate-limit penalty — this is not
   a brute-forceable path).

On success creates an admin with id `bootstrap`, hashes the password with
bcrypt cost 10, returns `{ token, expiresAt }` with status `201`. A race
losing the upsert returns `409 { error: 'Admin already exists.' }`.

## Admin CRUD (Bearer JWT required)

All routes below require `Authorization: Bearer <jwt>` and run through the
`requireAuth` middleware (verifies HS256 / issuer `ziggy` / audience
`ziggy-admin`).

### Sponsors

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/api/admin/events/:slug/sponsors` | List. |
| `POST` | `/api/admin/events/:slug/sponsors` | Validated by `SponsorSchema`. Returns the created sponsor with a generated UUID id, status 201. |
| `PUT` | `/api/admin/events/:slug/sponsors/:id` | `SponsorSchema.partial()`. 404 if id not found. |
| `DELETE` | `/api/admin/events/:slug/sponsors/:id` | 404 if not found, otherwise `{ ok: true }`. |

`SponsorSchema` requires: `name` (1–200), `tierId` (UUID), `logoUrl` (https),
`description` (i18n record limited to supported languages, each ≤2000 chars),
`sortOrder` (0–10000). Optional: `website` (https), `boothNumber` (≤20),
`floorMapHotspotId` (1–100), `logoOnDark` (boolean — when true the kiosk renders
the logo on a dark background instead of white; for sponsors with white-on-
transparent logos like Inforcer, Experts Inside, ESPC).

### Sponsor tiers

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/admin/events/:slug/sponsor-tiers` | — |
| `POST` | `/api/admin/events/:slug/sponsor-tiers` | `SponsorTierSchema`. |
| `PUT` | `/api/admin/events/:slug/sponsor-tiers/:id` | `SponsorTierSchema.partial()`. |
| `DELETE` | `/api/admin/events/:slug/sponsor-tiers/:id` | — |

`SponsorTierSchema`: `name` (1–100), `label` (i18n), `sortOrder` (0–10000),
`displaySize` ∈ {`large`, `medium`, `small`}.

### Floor maps

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/admin/events/:slug/floor-maps` | — |
| `POST` | `/api/admin/events/:slug/floor-maps` | `FloorMapSchema`. |
| `PUT` | `/api/admin/events/:slug/floor-maps/:id` | `FloorMapSchema.partial()`. |
| `DELETE` | `/api/admin/events/:slug/floor-maps/:id` | — |

`FloorMapSchema`: `name`, `imageUrl` (https), `label` (i18n), `sortOrder`,
`hotspots` (≤100 each with id, roomName, optional roomGuid, label,
`points: [number, number][]` with 3–50 entries each in `[0, 10000]`).

### Event config

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/admin/events/:slug/config` | Returns `AdminEventConfig`. 404 if missing. |
| `PUT` | `/api/admin/events/:slug/config` | `EventConfigSchema.partial()`. Merges with existing or defaults. |

`EventConfigSchema`: `name`, `timezone`, `languages` (subset of
`SUPPORTED_LANGUAGES`), `defaultLanguage`, `branding` (four `#rrggbb` colors,
optional logo URLs, fontFamily), `days[]` (≤14 entries, `YYYY-MM-DD` format,
i18n labels), optional `startDate`/`endDate`.

### i18n overrides

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/admin/events/:slug/i18n-overrides` | Returns all override documents (one per language). |
| `PUT` | `/api/admin/events/:slug/i18n-overrides/:lang` | `{ overrides: { [key]: string } }`, ≤500 keys, key ≤200 chars, value ≤1000 chars. Doc id is `${slug}_${lang}`. |

### Booth overrides

Booth metadata that lives outside run.events (currently just the
floor-map-hotspot link).

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/admin/events/:slug/booth-overrides` | List. |
| `PUT` | `/api/admin/events/:slug/booth-overrides/:boothId` | `{ floorMapHotspotId?: string }`. Doc id is `${slug}:${boothId}`. |

### Shop items

CRUD for the `/shop` page. Items render on the kiosk in two groups:
highlighted items (featured row) and regular items (grid), sorted by
`sortOrder`. Each item links to a per-purchase nomination for the **Experts
Live Studiebeurs** (a €5,000 Microsoft certification package).

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/api/admin/events/:slug/shop-items` | List. |
| `POST` | `/api/admin/events/:slug/shop-items` | `ShopItemSchema`. Returns the created item with a generated UUID id, status 201. |
| `PUT` | `/api/admin/events/:slug/shop-items/:id` | `ShopItemSchema.partial()`. 404 if not found. |
| `DELETE` | `/api/admin/events/:slug/shop-items/:id` | 404 if not found, otherwise `{ ok: true }`. |

`ShopItemSchema` requires: `name` (i18n, ≤200 per language), `description`
(i18n, ≤2000 per language), `imageUrl` (https), `priceLabel` (1–50; e.g.
"€25" or "€50 / bid"), `sortOrder` (0–10000). Optional: `isHighlighted`
(boolean — featured row).

### Image upload

`POST /api/admin/upload` — multipart form-data with a single `file` field.

- Maximum size: **25 MB** (route-level check; the global 1 MB body limit is
  bypassed for this path).
- Magic-byte sniff: only JPEG (`FF D8 FF`), PNG (8-byte signature), and WebP
  (`RIFF` + `WEBP` at offset 8) are accepted. Client-supplied MIME and
  filename are ignored.
- Blob name: `${crypto.randomUUID()}${.jpg|.png|.webp}` derived from the
  sniffed type. User filename is never used in the URL.
- Blob is written to the `images` container with
  `Cache-Control: public, max-age=31536000, immutable`,
  `Content-Disposition: inline`, and the metadata flag
  `x-content-type-options: nosniff`.
- Returns `{ url }` on success.

Error codes: `400` (no file / unsupported type / too large), `500` (storage
failure).

## Cross-cutting behavior

### Body size limit

All `/api/admin/*` routes go through `bodyLimit({ maxSize: 1024 * 1024 })`
(1 MB), except `/api/admin/upload` which has its own 25 MB ceiling. Exceeding
the limit returns `413 { error: 'Request body too large' }`.

### Security headers

All responses get Hono's `secureHeaders()` middleware:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### CORS

In production:

```
Allowed origins: https://ziggy.expertslive.dev,
                 https://ziggy-admin.expertslive.dev,
                 https://victorious-plant-071edeb03.6.azurestaticapps.net,
                 https://gray-hill-067f71103.1.azurestaticapps.net
Allowed methods: GET, POST, PUT, DELETE, OPTIONS
Allowed headers: Content-Type, Authorization
maxAge: 86400
```

In development, `*` is allowed.

### Upstream timeouts

All run.events fetches use `AbortSignal.timeout(10_000)` — 10s ceiling.

## Environment variables

API (`packages/api/.env` in dev; Container App secrets in prod):

| Variable | Required in prod | Notes |
|---|---|---|
| `PORT` | no | Defaults to 3001. |
| `EVENT_SLUG` | yes (effectively) | The single event the API serves. Defaults to `experts-live-netherlands-2026`. |
| `RUN_EVENTS_API_KEY` | yes | run.events `ApiKey` header value. KV-backed. |
| `COSMOS_CONNECTION_STRING` | yes | Direct connection string. |
| `STORAGE_CONNECTION_STRING` | yes | Constructed from account key in Bicep. |
| `JWT_SECRET` | yes | ≥32 chars enforced at startup. KV-backed. |
| `SETUP_TOKEN` | optional | Gates `/api/auth/setup`. Unset → 503. |
| `NODE_ENV` | `production` | Toggles strict env validation and CORS. |

Kiosk:

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Empty string in dev (Vite proxy). Required at build time in prod. |
| `VITE_EVENT_SLUG` | Defaults to `experts-live-netherlands-2026`. |
| `VITE_BUILD_HASH` | Optional. Used as the localStorage cache-buster key. |

Admin:

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Required at build time. |
| `VITE_EVENT_SLUG` | Same default as kiosk. |

## run.events specifics

- Base URL: `https://modesty.runevents.net`
- Auth: `ApiKey: <key>` header
- All data endpoints use **POST**, not GET. The only GET is the agenda search
  (`/v2/events/:slug/agenda/search?q=`).
- Search requires a minimum of 4 characters.
