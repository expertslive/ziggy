# Cosmos backups

Self-service snapshots of every admin-managed Cosmos container, taken via
the live admin API. Cheap insurance — periodic Cosmos backups still
exist, but a JSON we can re-PUT in seconds is faster than a Microsoft
support ticket.

## Take a snapshot

```sh
ADMIN_EMAIL=…@…  ADMIN_PASSWORD=…  node scripts/backup-all.mjs
```

Output lands at `backups/<event-slug>-YYYY-MM-DD-HHMM.json` (UTC). Keep
the most recent few in git as restore points.

## Restore

There's no auto-restore script — pick the section you need out of the
JSON and PUT it back via the matching admin endpoint:

| Section | Endpoint |
| --- | --- |
| `floor-maps[i]` | `PUT /api/admin/events/:slug/floor-maps/:id` |
| `sponsors[i]` | `PUT /api/admin/events/:slug/sponsors/:id` |
| `sponsor-tiers[i]` | `PUT /api/admin/events/:slug/sponsor-tiers/:id` |
| `shop-items[i]` | `PUT /api/admin/events/:slug/shop-items/:id` |
| `event-config` | `PUT /api/admin/events/:slug/config` |
| `i18n-overrides[i]` | `PUT /api/admin/events/:slug/i18n-overrides/:lang` |
| `booth-overrides[i]` | `PUT /api/admin/events/:slug/booth-overrides/:boothId` |

The `scripts/seed-bg-hotspots.mjs` and `scripts/fix-event-halls.mjs`
scripts are good templates for ad-hoc PUT batches.

## What's NOT in the snapshot

- The kiosk/admin app code itself — that's in `packages/`.
- run.events upstream data (agenda, speakers, booths) — fetched live, not
  ours to back up.
- Cosmos `analytics` container — append-only event stream with 90-day
  TTL; not worth snapshotting.
- Blob storage (sponsor logos, floor-map images) — referenced by URL
  from the JSON, not duplicated in the snapshot.
- `admins` Cosmos container — bcrypt password hashes; deliberately
  excluded.
