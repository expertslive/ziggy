# Lessons Learned

Things that took longer than they should have, or that paid off because we
got them right early. Captured during the event-ready polish work
(April 2026).

## Tailwind v4 `@theme` plus `[data-theme]` overrides cascade for free

Tailwind v4 emits utilities like `bg-el-blue` as
`background-color: var(--color-el-blue)`. Once the variable is set on `:root`
via `@theme`, any selector that re-declares the variable lower in the tree
overrides it without touching component code. The high-contrast theme is a
single block in `packages/kiosk/src/index.css` that overrides the
`--color-el-*` variables under `[data-theme='high-contrast']` — every utility
follows automatically.

## `rem`-based sizes scale off `<html>`, not the parent

The accessibility font scale lives on `document.documentElement` because
Tailwind's spacing utilities (`p-4`, `gap-2`, etc.) all resolve to `rem`,
which is relative to the root font size. Set the size on a wrapper div and
nothing changes. See `packages/kiosk/src/App.tsx:27`.

## `EventConfig.apiKey` was dead weight that could leak

The shared type carried an `apiKey` field that was set at admin write time
but never actually used by the runtime (which always read
`RUN_EVENTS_API_KEY` from env). The public config endpoint returned the
whole document, including `apiKey`. Fix: remove the field from the shared
type, project explicit fields in the public route, and add a regression test
that `/api/events/:slug/config` never returns secret-shaped keys.

## Container Apps secrets can reference Key Vault directly

```bicep
{
  name: 'jwt-secret'
  keyVaultUrl: '${keyVault.properties.vaultUri}secrets/jwt-secret'
  identity: 'system'
}
```

No proxy code, no init container, no Azure Functions in the middle. The
Container App's system-assigned MSI just needs "Key Vault Secrets User" on
the vault. Rotation: update the secret value, restart the revision.

## Bicep parameters re-write secrets every deploy

When `jwtSecret` was a Bicep parameter, every `az deployment group create`
needed the value passed in (or it would default-empty and break prod).
Externalizing both rotation-sensitive secrets to Key Vault (`existing`
references in Bicep) means redeploys never touch the values.

## Azure refuses duplicate role assignments regardless of name

`Microsoft.Authorization/roleAssignments` is keyed by
`(principal, role, scope)` even though the resource has a `name` property.
Trying to reassign the same role with a different GUID name fails with
`RoleAssignmentExists`. Generate the name deterministically with
`guid(scope, principal, roleDefId)` so re-runs of the Bicep are idempotent.

## pnpm `packageManager` field conflicts with `pnpm/action-setup` `version:`

If `package.json` has `"packageManager": "pnpm@9.x.y"`, do not pass `version:`
to `pnpm/action-setup` — the action will refuse to run with a version
mismatch error. Just call `pnpm/action-setup@v4` with no inputs and let it
read the field. See `.github/workflows/{ci,deploy}.yml`.

## Static Web App custom domain validation is automatic for CNAMEs

`ziggy-admin.expertslive.dev` was added to the SWA, the CNAME pointed at the
default `*.azurestaticapps.net` host, and the cert provisioned within
minutes — no manual TXT record needed for sub-domains. Apex domains are a
different story and need a TXT verification step.

## Docker build context needs explicit `.npmrc` copy

`pnpm install --frozen-lockfile --filter` inside Docker doesn't auto-copy
`.npmrc` from the workspace root. Without it, registry/auth config is
missing and pnpm falls back to defaults. Solution: explicit `COPY .npmrc
./` in the Dockerfile before the install step.

## run.events agenda endpoint is `POST` not `GET`

The agenda, speakers, booths, and partnerships endpoints all use `POST`
with no body. Search is the only `GET`. This is unusual but is what
run.events publishes (see the Swagger at
`https://modesty.runevents.net/swagger/index.html`). The first integration
attempt used GET and got blanket 404s; switching to POST made everything
work.

## Inactivity reset is trivial when all session state lives in one store

We initially had open-modal IDs in component-local `useState`. The
inactivity reset would `navigate('/now')` but the modal stayed mounted with
the previous attendee's session selected. Moving every per-session field
into the Zustand store turned the reset into a single
`set({ ...INITIAL_SESSION })`. The bug class disappears.

## `gcTime: 24h` lets a kiosk survive overnight without a re-fetch storm

TanStack Query's default `gcTime` is 5 minutes. With persistence to
`localStorage` and `gcTime: 24 * 60 * 60 * 1000`, a kiosk that gets reloaded
in the morning paints from cache while the API spins up — first attendee
sees data immediately. See `packages/kiosk/src/lib/queryClient.ts`.

## `frame-ancestors 'none'` is the modern X-Frame-Options

CSP `frame-ancestors 'none'` is the spec-correct way to deny iframing. The
legacy `X-Frame-Options: DENY` header is harmless to keep alongside it for
older browsers. We do both: SWA `globalHeaders` ships CSP, the API's
`secureHeaders()` ships `X-Frame-Options`.

## Bcrypt password hashes don't depend on `JWT_SECRET`

Rotating `JWT_SECRET` invalidates outstanding tokens (forces a re-login)
but leaves password hashes intact — they're salted by bcrypt itself, not by
any app-level secret. Useful to know during a panic-rotation drill.

## CSP `connect-src 'self' https:` survives API host changes

The kiosk's CSP allows any HTTPS origin for `connect-src` so that swapping
the API host (e.g. cutover to a custom domain, or moving regions) doesn't
require redeploying the SWA. The narrowing is on `default-src 'self'`,
which still blocks unexpected fetches that aren't `connect-src`-typed.

## run.events returns `null` for empty `labels`/`speakers` on NonContent

Content sessions (`elementType=1`) come back with `labels: []` and
`speakers: []` when those arrays are empty, but NonContent items
(`elementType=2` — lunch, breaks, registratie, borrel) come back with
`labels: null, speakers: null`. The kiosk assumed both fields were always
arrays and crashed on the first lunch break with `Cannot read properties of
null (reading 'length')`. Fix: normalize to `[]` server-side in the
NonContent transform path inside the `/sessions/now` route. Don't rely on
TanStack Query selectors to clean it up downstream — the JSON-decoded
runtime shape disagreed with the TypeScript type, so the type system was
silent.

## A `?now=` URL override needs server forwarding to be a true e2e preview

The kiosk's `useClockTick()` parses `?now=` from the URL and freezes
client-side time. Originally we thought that was enough to preview "what
does the kiosk look like during lunch" — but `/sessions/now` filters
*server-side* against `Date.now()`, so the API kept returning the live
current/upNext sessions and the break card never appeared. Fix: forward
`?now=` from `useNowSessions` as a query param to
`GET /api/events/:slug/sessions/now?now=…` and have the API filter against
that instant. Without the server hop, only the on-screen clocks shift while
the data stays live.

## Trust the server when it's the source of truth

`/api/events/:slug/sessions/now` already filters items into `current` based
on event-tz string comparison. The client `SessionCard` then re-checked
`isLive` with `current >= start && current < end`, where `current` is a UTC
`Date` from the `?now=` override and `start`/`end` come from
timezone-naive run.events strings parsed as **browser-local**. Different
browser timezones produce different answers — a session the API said was
live could fail the client-side check and miss its `LIVE` pulse pill, making
the card look "calm" when it should be active. Fix: trust the API. We added
a `forceState?: 'live' | 'past'` prop to `SessionCard`. NowPage passes
`forceState="live"` for cards in the `current` bucket; AgendaPage keeps the
auto-derive path because it needs to style past/future across the whole day.
Lesson: re-implementing the same filter on both sides is asking for them to
disagree.

## i18next silently falls back to the key when a translation is missing

Removing `info.times.doorsOpen` from the JSON without also updating
`InfoPage.tsx` rendered the literal text **`info.times.doorsOpen`** on the
kiosk — no build error, no console warning, no test failure. The keys are
strings to the type system. Whenever you remove or rename an i18n key, grep
the codebase before merging:

```bash
grep -rn "info.times.doorsOpen" packages/kiosk/src
```

A pre-merge CI step that loads the locale JSON and asserts every
`t('...')` literal in `.tsx` files resolves to a real key would catch this
class of regression.

## Container App in-memory cache lingers past a code deploy

We ship a 5-minute in-memory cache layer in front of run.events
(`packages/api/src/lib/cache.ts`). A code deploy creates a **new** Container
App revision with empty RAM, but Azure does a graceful rollout — the old
revision keeps serving traffic until the new one is healthy. Requests
landing on the still-warm old revision return cached pre-fix data, and once
the new revision takes over its empty cache pulls fresh data on the next
miss. So sometimes a fix appears to take ~5 minutes to "show up" even
though the build is live. If you need an immediate cache flush after
deploy:

```
az containerapp revision restart --name ziggy-api --resource-group ziggy-rg \
  --revision $(az containerapp show -n ziggy-api -g ziggy-rg --query \
    properties.latestRevisionName -o tsv)
```

## Empty optional URL strings need explicit coercion before zod sees them

`SponsorSchema` declares `website: httpsUrl.optional()` where `httpsUrl =
z.string().url().refine(starts-with-https)`. The admin form binds the input
to `form.website` and submits the whole object on save. When the field is
empty, zod runs `.url()` on `""` and rejects it — every existing sponsor
without a website couldn't be edited at all (`Failed to save sponsor` toast,
no other clue). The fix is one line per optional URL/min(1) field:

```ts
const payload = {
  ...form,
  website: form.website || undefined,
  boothNumber: form.boothNumber || undefined,
  floorMapHotspotId: form.floorMapHotspotId || undefined,
}
```

`.optional()` means *the key may be absent*; an empty string still
satisfies the type-narrowing path and runs through the validator. Strip
empties to `undefined` at the form boundary, not in the schema.

## Floor-map hotspot polygons are visual debris when there are 29 of them

The first floor map editor drew tappable hotspots as filled blue polygons
with a border. With 4 sessions in 4 rooms it looked fine. With 25 booths
plus 4 utility rooms (Merchandise, Registratie, Photo wall, Garderobe) the
overlay obscured the printed booth labels on the venue map and made the
plattegrond illegible. Fix: render the polygons with `fill="rgba(0,0,0,0)"`
+ `stroke="none"` by default and switch to the yellow highlight only when
arriving via "Show on map" from a sponsor. Important: SVG polygons with
`fill="none"` don't capture clicks — use `rgba(0,0,0,0)` (or
`pointer-events: all`) so transparent hit-areas stay tappable. Lesson: an
overlay's job ends the moment the underlying image already conveys the
information; keep it for the *deep-link callout* only.

## Conference floor maps are basically grids of rectangles

Every booth, registratie balie, garderobe, and merchandise stand on the
NBC Nieuwegein floor was rectangular. The polygon editor lets you trace
freeform shapes, but the operator drew them slightly skewed so the dataset
ended up with 29 quadrilaterals where every booth visually clearly should
be axis-aligned. Cheap fix: walk the saved hotspots, compute each one's
bounding box, and replace `points` with the four corner points. Future
direction: the editor could offer a "rectangle mode" that takes two
diagonal taps and emits `[minX,minY], [maxX,minY], [maxX,maxY],
[minX,maxY]` directly.

## A floor-map hotspot can mean "go elsewhere" instead of "open detail"

The Merchandise hotspot has no sessions and no sponsor — opening the
generic room-detail modal showed only a dead "no sessions in this room"
message. Routing the tap to `/shop` instead is one `navigate()` call keyed
on the hotspot's `roomName`. Pattern: not every map region needs to share
the same modal. A short whitelist (`merchandise`, `photo wall`, etc.) that
diverts the tap is acceptable and beats over-engineering a per-hotspot
"action type" field on the data model. Reach for the data-model knob the
day you have three.

## When the heading lies, fix the heading — not each item underneath it

The agenda used run.events' timeslot grouping to draw section headings like
"10:10 – 11:00". For sessions of mixed duration (a 50-min and a 20-min
both starting at 10:10) the heading promised the full hour, even when half
the cards inside ended at 10:30. Quick scanners saw "Sandra · Kickstart
your AI journey" under "10:10 – 11:00" and assumed her session ran until
11. We brainstormed eight per-card visual variants (badges, height proxies,
color stripes, color-tinted backgrounds) before noticing the real bug was
structural: *the heading was wrong*. Switching to start-time-only headings
("10:10", "10:40", …) removed the lie at the source. The remaining per-card
cues (blue stripe for 50-min, white for keynote, ghost "20m" badge for the
short ones) became light decoration rather than the primary disambiguation.
Lesson: when a UI lies, look up the hierarchy first. Fixing the lie is
usually one structural change; trying to compensate underneath it is many
visual changes.

## Group-highlight is the right answer for spatially-repeated map hotspots

The floor map has multiple toilet icons, multiple catering points, two
"Dietary needs" panels. When a visitor taps one of those, their question
is *"where are the toilets?"*, not *"what does this specific toilet do?"*.
Treating same-`roomName` hotspots as a category and lighting all of them
yellow when any one is tapped matches the question being asked.
Implementation is one-line: a `GROUP_NAMES` set; if the selected hotspot's
name is in it, expand the highlight set to every hotspot sharing that name.
Booths and singleton hotspots (Lift, Trappen, Photo wall, Garderobe) keep
the single-highlight behaviour because each is a unique destination — "Lift"
is one place, "Booth 14" is one place. Pattern generalises: any time the
data has an N:1 entity → category mapping and the user query is about the
category, group-highlight is the simplest UX.

## Random ordering needs a stable seed; per-render shuffles cause card-bounce

For the sponsor "no-one-always-first" requirement we initially shuffled in
JSX with a plain `Math.random()` sort — every render reordered the cards,
so they bounced as the user scrolled. The fix isn't a global random seed
or a state machine: it's `useMemo` keyed on a stable signature of the data
set (sorted-and-joined sponsor IDs). The shuffle runs once when the data
materialises and stays fixed for the lifetime of the component. New mount
(after the 60-second inactivity reset routes back from `/now` and the user
navigates to `/sponsors` again) → fresh shuffle → fair rotation across
visitors. Same trick works for any "fair-but-stable" ordering need —
randomized speaker grids, lottery draws, etc.

## `pointer:coarse + width < X` is a leaky touch-device gate

Earlier mobile-only pinch/zoom on `/map` gated on
`pointer:coarse AND innerWidth < 1024`. That width cap was meant to
exclude the 1080×1920 kiosk, which it does — but it also silently excluded
iPad Pro (1024+) and any full-size touchscreen tablet, where pinch is
exactly what users expect. When in doubt, prefer `pointer:coarse` alone
and accept that touchscreen kiosks are technically included. For our
case pinch on the kiosk is harmless: nobody pinches a stationary portrait
screen, and the floating reset button gets them back to fit if they
accidentally trigger it. Width caps for "is this a phone?" detection
will keep being wrong as device sizes drift; gate on capability
(`pointer`, `hover`) and let the design absorb the edge cases.

## Pair-based analytics gating beats date-gating

We considered turning analytics on by date ("only on event day"), then
realised the right gate is "only when the kiosk has been paired to a
known location." A test laptop opening the URL is indistinguishable from
a kiosk on the day-of unless we tag the device. Pairing solves both:
the kiosk registers its location, *and* tracking turns on. No date logic
needed, and dev/test devices silently no-op forever. The cost is one
extra step on event morning (drop the URL, pick the location) — much
cheaper than wiring date checks across every track call site.

## Cosmos `defaultTtl` removes the need for a cleanup job

The analytics container is born with `defaultTtl: 7776000` (90 days).
Every doc auto-expires; there is no cron, no purge endpoint, no manual
"oh right, GDPR" scramble nine months later. For ephemeral, append-only
event streams this is dramatically simpler than building retention.
Set TTL at container creation — it cannot be retrofitted onto existing
docs without a write.

## TS narrows `crypto` to `never` after a guarded early-return

```ts
if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
crypto.getRandomValues(a) // TS2339: 'getRandomValues' does not exist on type 'never'
```

The `'randomUUID' in crypto` check narrows the type so aggressively that
the *false* branch ends up typed as `never`. Re-binding to a typed local
fixes it: `const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined`.
Don't fight the narrowing with `as Crypto` casts inside the conditional —
they survive the build but get re-narrowed in incremental rebuilds.

## Lazy `createIfNotExists` beats up-front Bicep provisioning for new containers

When we added the `analytics` Cosmos container we *also* added it to
Bicep, but Bicep only runs on a deliberate `az deployment` — the GH
Actions deploy doesn't apply infra. Calling `db.containers.createIfNotExists()`
on the first ingest means the container shows up the moment the first
real kiosk pairs, with the right partition key and TTL, regardless of
whether infra was redeployed. Bicep is still the source of truth, but
the runtime check guards against drift.

## Two CSPs: kiosk frame-ancestors AND admin frame-src

Embedding the kiosk in the admin's `/preview` iframe needs both ends to
agree:

- The **kiosk's** CSP `frame-ancestors` must allow the admin origin —
  otherwise Chrome refuses to render the frame ("who's allowed to embed
  me?").
- The **admin's** CSP `frame-src` must allow the kiosk origin —
  otherwise Chrome refuses to load the iframe at all ("what am I
  allowed to embed?").

I fixed only the kiosk side first and stared at a broken-page icon for
twenty minutes. Both sides are policed independently; both must
explicitly whitelist.

## Public-repo cleanup is a separate pass — don't trust grep alone

A repo can be free of obvious secrets (tokens, connection strings,
password hashes) and still leak operational recon: live blob URLs,
Cosmos `_rid`/`_self`/`_etag` metadata in committed snapshot JSONs,
auto-generated Azure resource names hardcoded in scripts as silent
defaults, SWA fallback hostnames in docs. None of those are credentials,
but together they're a free reconnaissance kit for an attacker. Treat
"secrets clean" and "exposure clean" as two distinct passes, and
codify it: `backups/*.json` in `.gitignore`, scripts that *require*
`API_BASE` instead of defaulting silently, Bicep parameters that ship
generic placeholders rather than the live resource names.

## `existing` Key Vault means you must seed it before Bicep runs

`infra/main.bicep` declares the Key Vault as `existing` and wires the
Container App's secret references via `keyVaultUrl`. The MSI gets
"Key Vault Secrets User" granted on the KV inside the same Bicep run.
A clean-slate deploy therefore breaks if the KV (and its
`jwt-secret` + `run-events-api-key` entries) doesn't exist *before* the
Bicep runs — `az keyvault create` + `secret set` first, then the
`az deployment group create`. Documenting this saves the next deployer
half an hour of "why is the Container App in CrashLoopBackoff?" debugging.

## Vite doesn't copy `staticwebapp.config.json` from the package root

`staticwebapp.config.json` (CSP, headers, SPA fallback) needs to land in
the SWA upload directory, which is `packages/{kiosk,admin}/dist/`. Putting
the file at the package root or under `src/` does **not** work — Vite only
copies `public/` to `dist/`. After a deploy where the file was at the
package root, the SWA shipped with default headers and the kiosk's CSP went
missing without any visible build error. Move it to `public/`, rebuild,
re-deploy.
