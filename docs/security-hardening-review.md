# Security and Hardening Review

Review date: 2026-04-24

This handoff summarizes a security review of the Ziggy pnpm monorepo: Hono API, React kiosk/admin SPAs, shared types, Azure Bicep infrastructure, Dockerfile, and GitHub Actions workflows.

## Executive Summary

Priority work:

1. Fix the public event config secret leak path before adding or editing any event API keys.
2. Lock down first-admin setup and login abuse paths.
3. Update vulnerable production dependencies and add automated dependency checks.
4. Add server-side validation for all admin writes and upload metadata.
5. Harden Azure identity, CORS, Blob Storage, static headers, and container runtime settings.

`pnpm audit --prod` was run with registry access and reported 18 production vulnerabilities: 3 high, 13 moderate, 2 low.

## Findings

### P0: Public Config Can Leak `apiKey`

Evidence:

- `packages/shared/src/types/event.ts:7` defines `EventConfig.apiKey`.
- `packages/api/src/routes/admin.ts:345-349` persists `body.apiKey` into the event config document.
- `packages/api/src/routes/events.ts:31-33` returns the full Cosmos `EventConfig` from the public `/api/events/:slug/config` route.

Impact: if an admin stores a run.events key in event config, any unauthenticated visitor can fetch it from the public kiosk config endpoint.

Recommended fix:

- Split `AdminEventConfig` from `PublicEventConfig`; public responses must explicitly project safe fields only.
- Remove `apiKey` from the public shared type and from kiosk/admin public fetch models.
- Prefer storing run.events API keys only in environment/Key Vault, not Cosmos event docs.
- If this has been deployed with a real key in Cosmos, rotate the run.events key and scrub existing `events` documents.
- Add a regression test that `/api/events/:slug/config` never returns `apiKey`, `passwordHash`, connection strings, tokens, or secret-like fields.

### P0/P1: First Admin Setup Is Public and Race-Prone

Evidence:

- `POST /api/auth/setup` is unauthenticated in `packages/api/src/routes/admin.ts:56-85`.
- It only checks whether the admins container is empty before creating a new admin.

Impact: before initial setup, anyone who can reach the API can claim the first admin. The check-then-create flow is also race-prone.

Recommended fix:

- Disable `/api/auth/setup` in production after bootstrapping, or require a one-time setup token from a secret env var.
- Prefer a deployment/admin CLI seed step over a public bootstrap endpoint.
- Make first-admin creation atomic, for example with a deterministic bootstrap document/id and conflict handling.
- Add audit logging for setup attempts and alert on failures/success.

### P1: Login and Session Hardening Gaps

Evidence:

- Login has no rate limit, lockout, or backoff: `packages/api/src/routes/admin.ts:24-53`.
- JWT signing uses a silent random fallback if `JWT_SECRET` is missing: `packages/api/src/env.ts:20-21`.
- JWT verification does not explicitly constrain issuer/audience/algorithm: `packages/api/src/lib/auth.ts:23-26`.
- Admin tokens are stored in `localStorage`: `packages/admin/src/lib/api.ts:3-9`.

Impact: brute-force attempts are cheap, missing production secrets can be masked, and any admin-panel XSS would expose the bearer token.

Recommended fix:

- Add IP and email-based rate limiting to login/setup, with low limits and backoff.
- Fail fast in production if `JWT_SECRET`, `COSMOS_CONNECTION_STRING`, `STORAGE_CONNECTION_STRING`, or `RUN_EVENTS_API_KEY` is missing; enforce JWT secret length/entropy.
- Verify JWTs with explicit `algorithms`, `issuer`, and ideally `audience`; add `jti` if revocation is needed.
- Move admin auth to `HttpOnly; Secure; SameSite=Lax/Strict` cookies plus CSRF protection, or at least reduce token lifetime and add a logout/revocation strategy.

### P1: Vulnerable Production Dependencies

`pnpm audit --prod` results:

- `hono@4.11.9`: multiple advisories. Highest audited patched version shown is `>=4.12.14`.
- `@hono/node-server@1.19.9`: patched versions include `>=1.19.13`.
- `fast-xml-parser@5.3.6` via `@azure/storage-blob@12.31.0 > @azure/core-xml@1.5.0`: audited patched version shown up to `>=5.7.0`.
- `i18next-http-backend@3.0.2`: moderate advisory, patched `>=3.0.5`; it appears unused in `packages/kiosk/src`.

Recommended fix:

- Remove unused `i18next-http-backend` from `packages/kiosk/package.json`.
- Update `hono`, `@hono/node-server`, and Azure SDK/transitive dependencies, then regenerate `pnpm-lock.yaml`.
- If Azure SDK has not yet pulled a patched `fast-xml-parser`, use a carefully scoped `pnpm.overrides` entry and retest Blob operations.
- Add `pnpm audit --prod` to CI or configure Dependabot/Renovate with security PRs.

### P1/P2: Admin APIs Trust Client Shapes

Evidence:

- Admin create/update handlers use `Partial<T>` JSON bodies without runtime schemas, for example sponsors at `packages/api/src/routes/admin.ts:137-179`, tiers at `205-243`, floor maps at `270-309`, config at `337-369`, and i18n overrides at `390-401`.
- Updates spread arbitrary request fields into persisted documents, for example `...body` at `packages/api/src/routes/admin.ts:169-175`, `234-240`, and `300-306`.

Impact: malformed or oversized values can be stored and later rendered by kiosk/admin clients. Unknown fields can persist in Cosmos documents. Invalid URLs, colors, language keys, hotspot coordinates, and large nested objects can create stored UI breakage, client-side tracking, or denial-of-service pressure.

Recommended fix:

- Add runtime validation with `zod`, `valibot`, or similar.
- Strip unknown fields and construct allowlisted output objects.
- Enforce max lengths, max array sizes, language values from `SUPPORTED_LANGUAGES`, color regexes, URL schemes/domains, numeric bounds, and hotspot point ranges.
- Add max request body size and consistent malformed JSON handling.
- Add max search query length and upstream fetch timeouts with `AbortController`.

### P1/P2: Upload Pipeline Needs Hardening

Evidence:

- Upload accepts SVG and GIF plus client-declared MIME type: `packages/api/src/routes/admin.ts:106-118`.
- The size constant is 25 MB but the error says 10 MB: `packages/api/src/routes/admin.ts:111-113`.
- Blob names derive extension from the original filename: `packages/api/src/lib/storage.ts:33-35`.
- Uploaded blobs are returned as public URLs: `packages/api/src/lib/storage.ts:37-42`.

Impact: SVG is active content if opened directly, client-supplied MIME types can lie, very large images can strain kiosks, and every successful upload is immediately public.

Recommended fix:

- Disallow SVG unless there is a sanitizer and a clear business need. Consider disallowing GIF too.
- Validate magic bytes and decode dimensions server-side; re-encode to JPEG/PNG/WebP.
- Use MIME-derived extensions, not user filename extensions.
- Set consistent size limits and enforce image dimension limits.
- Set `Cache-Control`, `Content-Disposition`, and `X-Content-Type-Options` where applicable.
- Consider private blobs with short-lived SAS, CDN signed URLs, or at least a separate public container only for approved assets.

### P2: Azure Infrastructure Uses Broad Credentials and Public Controls

Evidence:

- ACR admin user is enabled: `infra/main.bicep:33-42`.
- Container Apps pulls from ACR with username/password secret: `infra/main.bicep:177-188`.
- Cosmos and Storage are accessed with connection strings/account keys: `infra/main.bicep:193-203`.
- Storage allows blob public access and the images container is public: `infra/main.bicep:106-130`.
- Container Apps ingress CORS is wildcarded in Bicep: `infra/main.bicep:171-175`, while app code has a stricter production origin list at `packages/api/src/index.ts:22-33`.

Impact: compromise of app settings or ACR credentials has broad account-level impact. The infrastructure CORS policy conflicts with the app-level policy and may weaken browser-side protections.

Recommended fix:

- Disable ACR admin user and assign Container Apps a managed identity with `AcrPull`.
- Use managed identity/RBAC for Cosmos and Storage where feasible; keep secrets in Key Vault when connection strings remain necessary.
- Align Container Apps CORS with the exact kiosk/admin origins, or remove ingress CORS and let the app own CORS.
- Decide whether images truly need public container access. If yes, document that as intentional and keep uploads tightly validated.
- Add network restrictions/private endpoints if threat model or budget allows.

### P2: Missing Browser Security Headers

Evidence:

- `packages/kiosk/staticwebapp.config.json:1-5` and `packages/admin/staticwebapp.config.json:1-5` only define navigation fallback.
- API startup has CORS and logging but no secure headers middleware: `packages/api/src/index.ts:18-44`.

Recommended fix:

- Add Static Web Apps global headers: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and HSTS where appropriate.
- Start with a report-only CSP if needed because images currently load from run.events, Azure Blob Storage, and possibly admin-entered external URLs.
- Add equivalent API headers with Hono secure headers middleware or explicit middleware.

### P2: CI/CD Supply Chain Hardening

Evidence:

- GitHub Actions use mutable action tags such as `actions/checkout@v4`, `azure/login@v2`, and `Azure/static-web-apps-deploy@v1`: `.github/workflows/ci.yml:11-16`, `.github/workflows/deploy.yml:13-43`.
- Workflows do not declare minimal `permissions`.
- Azure deploy uses a long-lived `AZURE_CREDENTIALS` secret: `.github/workflows/deploy.yml:10-11` and `41-43`.

Recommended fix:

- Pin third-party actions to commit SHAs.
- Add minimal `permissions`; for CI usually `contents: read`.
- Move Azure auth to OIDC federated credentials with `id-token: write`, scoped Azure roles, and GitHub environments.
- Add branch/environment protections for production deploys.
- Add `pnpm audit --prod`, secret scanning, and IaC linting in CI.

### P2/P3: Container Runtime Hardening

Evidence:

- Runtime image uses floating `node:22-alpine` and runs as the default root user: `packages/api/Dockerfile:24-44`.

Recommended fix:

- Pin base image by digest or use a regularly rebuilt patched base strategy.
- Run as a non-root user.
- Reduce runtime contents where possible and avoid keeping package manager tooling in the final image unless needed.
- Add Container Apps health probes and resource limits/alerts beyond basic CPU/memory.

### P3: Logging and Monitoring

Evidence:

- Hono request logging is enabled globally: `packages/api/src/index.ts:18-19`.
- API catches upstream errors and logs the thrown error, including upstream response body from run.events: `packages/api/src/lib/run-events.ts:37-39`.

Recommended fix:

- Keep request logs but ensure Authorization headers and tokens are never logged.
- Sanitize upstream error bodies before logging in case they echo sensitive request details.
- Add security audit events for login success/failure, setup attempts, admin mutations, uploads, and deletes.
- Add alerts for repeated 401s, setup attempts after setup, upload spikes, and high 5xx rates.

## Positive Notes

- Tracked secret scan found placeholders/references but no obvious committed real secrets. Local `.env` files exist and are ignored.
- Cosmos queries that use user values are parameterized in reviewed paths.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` usage was found in app source.
- React text rendering reduces XSS risk for descriptions and translations, though URLs/styles still need validation.

## Suggested Next-Agent Checklist

1. Patch public config projection and rotate/scrub any existing event API key stored in Cosmos.
2. Remove `EventConfig.apiKey` from shared public types or split public/admin types.
3. Disable or protect `/api/auth/setup`; add login/setup rate limits.
4. Update vulnerable dependencies, remove unused `i18next-http-backend`, and rerun `pnpm audit --prod`.
5. Add schema validation for admin routes and upload metadata.
6. Harden uploads by rejecting SVG/GIF, validating content bytes/dimensions, and using MIME-derived filenames.
7. Add Static Web Apps and API security headers, starting with CSP report-only if needed.
8. Change Azure deployment to managed identities/RBAC and align CORS in Bicep with app code.
9. Pin GitHub Actions, add minimal permissions, and migrate Azure auth to OIDC.
10. Add focused tests for secret redaction, setup protection, rate limits, validation failures, and upload rejection cases.

## Open Questions

- Should uploaded images be public by design, or can kiosk/admin consume signed URLs?
- Is the admin panel deployed to a separate Static Web App/domain? Bicep currently creates only `ziggy-kiosk`, while docs describe both kiosk and admin deployments.
- Is `EventConfig.apiKey` still needed? Runtime run.events calls currently use `RUN_EVENTS_API_KEY` from env, not the stored config field.
