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
that `/api/events/:slug/config` never returns secret-shaped keys. See
[security-hardening-review.md](./security-hardening-review.md) finding P0.

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
