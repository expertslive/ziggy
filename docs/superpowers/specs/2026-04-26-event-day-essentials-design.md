# Event-Day Essentials — Design Spec

**Date:** 2026-04-26
**Goal:** Three small features that fix moments-of-need on event day: surface what's happening during breaks, give attendees travel info for departure, and put an emergency line on /info.

## Context

Walking-up-to-a-kiosk testing surfaced three gaps:

1. During lunch/breaks, the `/now` page renders the empty thought-bubble state because it filters out non-session agenda items. Visitors see "no current sessions" during the busiest networking moments of the day.
2. The `/info` page has no travel info. Around 17:30 attendees ask staff how to get back to the station.
3. The `/info` page has no emergency line. We removed the Emergency card earlier in favor of a single "Vragen?" card that points at volunteers — fine for general questions, but doesn't cover medical emergencies.

## Out of scope

- Personal favorites / login
- Networking / attendee directory
- Push notifications, service worker
- QR check-in
- Live polling / Q&A
- Tweet wall

## Section 1 — NonContent items on `/now`

### Data

run.events agenda items have `elementType`:
- `1` = Session (talks, workshops)
- `2` = NonContent (registration, breaks, lunch, drinks reception, closing)

The current `/api/events/:slug/sessions/now` filters to `elementType === 1` only. Result on `/now` during lunch: empty thought-bubble.

### API change

`GET /api/events/:slug/sessions/now` now returns:

```ts
{
  current: AgendaSession[]      // elementType=1, currently running (existing)
  currentBreaks: AgendaSession[] // elementType=2, currently running (NEW)
  upNext: AgendaSession[]        // first upcoming timeslot (existing — sessions OR NonContent)
  timeZone: string
}
```

`upNext` is unchanged: it's the next timeslot regardless of type. Both buckets share the same `AgendaSession` shape (the API normalizes both element types into the same kiosk-facing shape).

### Kiosk render priority

```
if current.length > 0:
  render session cards as today (LIVE pill, countdown, etc.)
else if currentBreaks.length > 0:
  render NonContent card(s) as the "what's happening" hero
  show upNext below as "next up at HH:MM"
else:
  render existing empty thought-bubble + next-session-time
```

### NonContent card visual

A single card per running NonContent item (typically 1 at a time — lunch, break). Different visual register from session cards:

- **Background:** `bg-emerald-900/40` border `border-emerald-700/40` (calm green; signals "non-session" without competing with brand blue)
- **Icon:** keyword-match on the title against the kiosk language to pick the right glyph:
  - "lunch" / "diner" → 🍽️
  - "borrel" / "drinks" / "reception" → 🥂
  - "registratie" / "registration" / "welcome" → 👋
  - "pauze" / "break" / "coffee" / "koffie" → ☕
  - default → ⏸️
  - Picked client-side; no admin action needed.
- **Title:** the run.events title, large
- **Eindtijd:** `tot HH:MM` + a live "X min" countdown that ticks every 30s (reuse `useClockTick`)
- **No LIVE pill** — that's reserved for sessions
- **Tappable:** opens the existing SessionDetailModal (same data shape) so it works for free

### i18n

Add to all 4 locales:

- `now.breakUntil` → "tot {{time}}" / "until {{time}}" / etc.
- `now.minutesLeft` → "nog {{minutes}} min" / "{{minutes}} min left" / etc.
- `now.nextUpAt` → "Volgende sessie om {{time}}" / "Next session at {{time}}" / etc.

## Section 2 — Reizen card on `/info`

A new card on `/info`, placed AFTER "Vragen?" and BEFORE "Tijden". Pure static content via i18n keys; no API.

### Content (NL)

```
Reizen

Met openbaar vervoer
Sneltramhalte Nieuwegein Stadscentrum:
  • Lijn 60/61 → Utrecht Centraal
  • Of richting Nieuwegein/IJsselstein → P+R Westraven
Tram rijdt regelmatig (~elke 7-10 min).

Met de auto
  • Gratis shuttlebus elke ±15 min van/naar Parkeerterrein Sportpark Galecop
  • Of gratis parkeren bij NBC

Bij vertrek
Bij de uitgang staat een poffertjeskraam — neem gratis wat lekkers mee voor onderweg.
```

### Translations

EN/DE/FR translate the labels and instructional text. Eigennamen blijven Nederlands: "Nieuwegein Stadscentrum", "P+R Westraven", "Sportpark Galecop", "NBC". The "poffertjes" line gets translated too — "mini Dutch pancakes" / "mini niederländische Pfannkuchen" / "mini-pancakes hollandais" — but keeps "poffertjes" as the recognizable word.

### i18n keys

```
info.travel.title
info.travel.publicTransport.heading
info.travel.publicTransport.body  (multi-line via \n)
info.travel.car.heading
info.travel.car.body
info.travel.farewell.heading
info.travel.farewell.body
```

### Layout

Same Card component as the other `/info` cards. Three sub-blocks within (heading + body lines). On mobile: full-width single-column. On kiosk: same `md:grid-cols-2` layout — Reizen sits in the grid alongside the others.

## Section 3 — Emergency line on existing "Vragen?" card

No new card. Append a separator + small italic line to the existing "Vragen?" card body.

### Content additions

After the existing `info.questions.body` text, add a new key:

- `info.questions.emergency` → "Bij medisch nood: meld het direct bij de balie of bel 112." / "Medical emergency: report at the desk or call 112." / etc.

### Layout

Inside the "Vragen?" card:

```jsx
<Card title={t('info.questions.title')}>
  <p>{t('info.questions.body')}</p>
  <hr className="my-3 border-el-light/10" />
  <p className="italic text-el-light/60 text-sm">{t('info.questions.emergency')}</p>
</Card>
```

The thin separator + smaller italic text marks it as a different register without making the card feel busy.

## Files affected

- `packages/api/src/routes/events.ts` — split current into `current` + `currentBreaks` in `/sessions/now` handler
- `packages/api/src/lib/run-events.ts` — small helper for non-content filtering if useful (otherwise inline in the route)
- `packages/api/src/routes/events.test.ts` — test the new shape
- `packages/kiosk/src/lib/api.ts` — extend `NowResponse` type with `currentBreaks: AgendaSession[]`
- `packages/kiosk/src/pages/NowPage.tsx` — render NonContent card when `current === [] && currentBreaks.length > 0`
- `packages/kiosk/src/components/NonContentCard.tsx` (new) — the green card with icon/countdown
- `packages/kiosk/src/pages/InfoPage.tsx` — add Reizen card; add emergency line to Vragen? card
- `packages/kiosk/src/i18n/{nl,en,de,fr}.json` — new keys for now, info.travel, info.questions.emergency

## Acceptance

- During lunch (e.g. `?now=2026-06-02T12:30:00Z`): `/now` shows a green NonContent card with title "Lunch", a "tot 13:00" indicator, a live minute countdown, and "Volgende sessie om 13:00" below
- Outside any agenda item (early morning before doors): `/now` shows the existing empty thought-bubble
- During a session: `/now` shows session cards as today, NonContent buckets are empty
- `/info` Reizen card renders 3 sub-blocks (OV, auto, poffertjes) in 4 languages
- "Vragen?" card on `/info` shows the body, then a thin separator, then the italic 112 line
- Existing inactivity reset, accessibility menu, language switcher, and other features all keep working
- iPad/kiosk layout unchanged for everything not in scope

## Sequencing

1. Section 3 (emergency line) — one i18n addition + one JSX line, near-zero risk
2. Section 2 (Reizen card) — i18n + InfoPage card, isolated
3. Section 1 (NonContent on /now) — touches API route + new shared shape + new component, biggest of the three

Sections are independent; Section 3 could ship before Section 1 even though it's listed last in the spec body.
