# Event-Ready Deploy Runbook

*Originally written for the April 2026 event-ready deploy. Current ops state assumed.*

Run this in order for the first deploy of the event-ready polish work to Experts Live NL 2026.

## Pre-deploy

1. **Set `SETUP_TOKEN` in the Container App secret.** Random 32+ char string. Store in the password manager. Without this, `/api/auth/setup` returns 503 — but if an admin already exists, the endpoint is already locked by the admin-exists gate regardless.
2. **Verify `JWT_SECRET` is ≥32 chars** in the Container App secrets. Production startup now fails fast if it's missing or shorter. Rotate if needed.
3. **Fill the practical-info placeholders.** The info page has `FILLED_AT_BUILD_TIME` markers for WiFi password, venue address, contact phone/email, etc. Grep and edit:
   ```bash
   grep -rn FILLED_AT_BUILD_TIME packages/kiosk/src/i18n
   ```
   Replace values with real Experts Live NL 2026 info. Commit once filled.
4. **Run `pnpm audit --prod --audit-level=high`** — must be clean (CI enforces this too).
5. **Run `pnpm -r test`** — all packages must be green (api suite has ~53 tests; kiosk suite has store + clock tests).

## Deploy

6. Merge `event-ready-polish` to `main` via pull request. GitHub Actions deploys the container image and Static Web Apps.

## Post-deploy

7. **Scrub any legacy `apiKey` fields from Cosmos `events` documents.** The scrub script is committed at `packages/api/scripts/scrub-apikey.ts`:
   ```bash
   tsx --env-file=packages/api/.env packages/api/scripts/scrub-apikey.ts
   ```
   - If the script reports any scrubbed values, **rotate the run.events API key** in the run.events dashboard and update `RUN_EVENTS_API_KEY` in the Container App secrets.
   - Idempotent — safe to run multiple times.

8. **Smoke test the public config endpoint** — response must contain no secret-shaped keys:
   ```bash
   curl -s https://<api-host>/api/events/experts-live-netherlands-2026/config \
     | grep -iE 'apiKey|password|secret|token|connectionString'
   ```
   Expected: no output.

9. **Verify security headers on kiosk:**
   ```bash
   curl -I https://<kiosk-host>/
   ```
   Expected in the response:
   - `Content-Security-Policy: default-src 'self'; …`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: geolocation=(), camera=(), microphone=()`

10. **Verify `/api/warmup`** responds 200 with all four sources warmed:
    ```bash
    curl -s https://<api-host>/api/warmup
    ```
    Expected: `{"ok":true,"warmed":[{"source":"agenda","ok":true}, ...]}`

11. **Kiosk cold-path smoke test** on the actual kiosk machine:
    - Open the kiosk URL in fullscreen Chrome/Edge.
    - Disable WiFi for 30 seconds. Kiosk should keep rendering cached data; no red error screen.
    - Re-enable WiFi. The thin yellow reconnecting banner (if it had appeared) should disappear within 10s of sustained success.
    - Inactivity reset test: open a session modal, change language to FR, wait 65 seconds. Kiosk should return to `/now` with default language (NL) and no open modal.
    - Accessibility: tap the Ⓐ button → A++ → confirm text is visibly larger. Toggle high contrast → confirm background flips to black with yellow accents.
    - Practical info: tap `/info` → confirm WiFi SSID + password display at glance distance.

## Rollback

If any step 7–11 fails, revert by:
1. Re-point Container App traffic to the previous revision (`az containerapp revision set-mode single --revision <previous>`).
2. Static Web Apps auto-deploys on merge to `main`, so a revert commit will roll it back on the next deploy.

## Follow-ups (not part of this deploy)

- Cosmos `upsert()` → `create()` for the bootstrap admin path (Task 1.5 concern — the token gate is the primary defense)
- Application Insights + kiosk heartbeat monitoring
- OS-level kiosk lockdown guide
- Sponsor QR codes
- Service worker / full offline mode
- Azure managed-identity infra rework
- GitHub Actions OIDC + SHA-pinned actions
- Admin token migration to HttpOnly cookies + CSRF
- Admin UI for booth → floor-map-hotspot linking (Task 7.1 — API endpoint exists; UI deferred)
