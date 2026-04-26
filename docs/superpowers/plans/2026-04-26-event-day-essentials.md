# Event-Day Essentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three event-day quality-of-life features: a 112 emergency line on the Vragen? card, a Reizen card on /info with travel directions, and surfacing breaks/lunch on /now instead of the empty thought-bubble.

**Architecture:** Section 3 and Section 2 are i18n + JSX additions on `InfoPage`, no API change. Section 1 splits the `/api/events/:slug/sessions/now` response into `current` (sessions) + `currentBreaks` (NonContent items) and adds a new `NonContentCard` component that renders when sessions are empty but breaks aren't.

**Tech Stack:** Hono (API) + vitest, React 19 + Tailwind v4 + i18next + react-router-dom (kiosk).

**Spec:** `docs/superpowers/specs/2026-04-26-event-day-essentials-design.md`

**Order:** Section 3 (smallest, lowest risk) → Section 2 → Section 1 (largest, touches API + new component). Each section is independently shippable.

---

## Phase 1 — Section 3: Emergency line on Vragen? card

### Task 1.1: Add `info.questions.emergency` i18n keys

**Files:**
- Modify: `packages/kiosk/src/i18n/en.json`
- Modify: `packages/kiosk/src/i18n/nl.json`
- Modify: `packages/kiosk/src/i18n/de.json`
- Modify: `packages/kiosk/src/i18n/fr.json`

- [ ] **Step 1: Read each file to find the `info.questions` block**

```bash
cd /Users/maartengoet/Github/ziggy
grep -n "questions" packages/kiosk/src/i18n/*.json
```

The `questions` object inside `info` already has `title` and `body`. We're adding a third sibling key `emergency`.

- [ ] **Step 2: Add the `emergency` key in each locale**

In `packages/kiosk/src/i18n/en.json`, find the `info.questions` block and add `"emergency"`:

```json
"questions": {
  "title": "Questions?",
  "body": "Ask one of the volunteers (recognizable by their Experts Live clothing) or visit the registration desk.",
  "emergency": "Medical emergency: report at the desk or call 112."
}
```

In `packages/kiosk/src/i18n/nl.json`:

```json
"questions": {
  "title": "Vragen?",
  "body": "Vraag een van de vrijwilligers (te herkennen aan de Experts Live kleding) of ga naar de registratiebalie.",
  "emergency": "Bij medisch nood: meld het direct bij de balie of bel 112."
}
```

In `packages/kiosk/src/i18n/de.json`:

```json
"questions": {
  "title": "Fragen?",
  "body": "Fragen Sie einen Freiwilligen (erkennbar an der Experts Live Kleidung) oder gehen Sie zur Anmeldung.",
  "emergency": "Medizinischer Notfall: melden Sie es an der Anmeldung oder rufen Sie 112."
}
```

In `packages/kiosk/src/i18n/fr.json`:

```json
"questions": {
  "title": "Questions ?",
  "body": "Demandez à un des bénévoles (reconnaissables par leur tenue Experts Live) ou rendez-vous à l'accueil.",
  "emergency": "Urgence médicale : signalez-le à l'accueil ou appelez le 112."
}
```

Preserve the existing `title` and `body` values exactly. Only add the `emergency` key alongside them.

### Task 1.2: Render emergency line in the Vragen? card

**Files:**
- Modify: `packages/kiosk/src/pages/InfoPage.tsx`

- [ ] **Step 1: Update the Vragen? Card body**

Find the existing Vragen? card (around line 62-64):

```tsx
<Card title={t('info.questions.title')}>
  <p className="text-el-light/80 leading-relaxed">{t('info.questions.body')}</p>
</Card>
```

Replace with:

```tsx
<Card title={t('info.questions.title')}>
  <p className="text-el-light/80 leading-relaxed">{t('info.questions.body')}</p>
  <hr className="my-3 border-el-light/10" />
  <p className="italic text-el-light/60 text-sm">{t('info.questions.emergency')}</p>
</Card>
```

- [ ] **Step 2: Build + test**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
pnpm --filter @ziggy/kiosk test
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/
git commit -m "feat(kiosk): emergency 112 line under Vragen? card on /info"
```

---

## Phase 2 — Section 2: Reizen card on /info

### Task 2.1: Add `info.travel.*` i18n keys

**Files:**
- Modify: `packages/kiosk/src/i18n/en.json`
- Modify: `packages/kiosk/src/i18n/nl.json`
- Modify: `packages/kiosk/src/i18n/de.json`
- Modify: `packages/kiosk/src/i18n/fr.json`

- [ ] **Step 1: Add the `travel` block in each locale**

The new `travel` block sits as a sibling of `wifi`, `times`, `questions` inside `info`.

In `packages/kiosk/src/i18n/en.json`, add:

```json
"travel": {
  "title": "Travel",
  "publicTransport": {
    "heading": "By public transport",
    "intro": "From the Nieuwegein Stadscentrum tram stop:",
    "lineToUtrecht": "Lines 60/61 → Utrecht Centraal",
    "lineToWestraven": "Or towards Nieuwegein/IJsselstein → P+R Westraven",
    "frequency": "Trams run regularly (about every 7-10 min)."
  },
  "car": {
    "heading": "By car",
    "shuttle": "Free shuttle bus every ~15 min between the venue and Sportpark Galecop parking",
    "parking": "Or free parking at NBC"
  },
  "farewell": {
    "heading": "On your way out",
    "body": "There's a poffertjes (mini Dutch pancakes) stand at the exit — grab some for the road on us."
  }
}
```

In `packages/kiosk/src/i18n/nl.json`, add:

```json
"travel": {
  "title": "Reizen",
  "publicTransport": {
    "heading": "Met openbaar vervoer",
    "intro": "Sneltramhalte Nieuwegein Stadscentrum:",
    "lineToUtrecht": "Lijn 60/61 → Utrecht Centraal",
    "lineToWestraven": "Of richting Nieuwegein/IJsselstein → P+R Westraven",
    "frequency": "Tram rijdt regelmatig (~elke 7-10 min)."
  },
  "car": {
    "heading": "Met de auto",
    "shuttle": "Gratis shuttlebus elke ±15 min van/naar Parkeerterrein Sportpark Galecop",
    "parking": "Of gratis parkeren bij NBC"
  },
  "farewell": {
    "heading": "Bij vertrek",
    "body": "Bij de uitgang staat een poffertjeskraam — neem gratis wat lekkers mee voor onderweg."
  }
}
```

In `packages/kiosk/src/i18n/de.json`, add:

```json
"travel": {
  "title": "Anreise",
  "publicTransport": {
    "heading": "Mit öffentlichen Verkehrsmitteln",
    "intro": "Ab Schnellbahnhaltestelle Nieuwegein Stadscentrum:",
    "lineToUtrecht": "Linien 60/61 → Utrecht Centraal",
    "lineToWestraven": "Oder Richtung Nieuwegein/IJsselstein → P+R Westraven",
    "frequency": "Die Tram fährt regelmäßig (~alle 7-10 Min)."
  },
  "car": {
    "heading": "Mit dem Auto",
    "shuttle": "Kostenloser Shuttlebus ca. alle 15 Min zwischen dem NBC und dem Parkplatz Sportpark Galecop",
    "parking": "Oder kostenlos parken am NBC"
  },
  "farewell": {
    "heading": "Auf dem Heimweg",
    "body": "Am Ausgang steht ein Poffertjes-Stand (kleine niederländische Pfannkuchen) — nehmen Sie kostenlos welche mit für unterwegs."
  }
}
```

In `packages/kiosk/src/i18n/fr.json`, add:

```json
"travel": {
  "title": "Trajet",
  "publicTransport": {
    "heading": "En transports en commun",
    "intro": "Depuis l'arrêt de tramway Nieuwegein Stadscentrum :",
    "lineToUtrecht": "Lignes 60/61 → Utrecht Centraal",
    "lineToWestraven": "Ou direction Nieuwegein/IJsselstein → P+R Westraven",
    "frequency": "Le tramway passe régulièrement (~toutes les 7 à 10 min)."
  },
  "car": {
    "heading": "En voiture",
    "shuttle": "Navette gratuite toutes les ±15 min entre le NBC et le parking Sportpark Galecop",
    "parking": "Ou parking gratuit au NBC"
  },
  "farewell": {
    "heading": "Pour la route",
    "body": "À la sortie, un stand de poffertjes (mini-pancakes hollandais) — prenez-en gratuitement pour la route."
  }
}
```

Add the `travel` block alongside the existing `wifi`, `times`, `questions` keys inside `info`. Preserve everything else.

### Task 2.2: Add Reizen card to InfoPage

**Files:**
- Modify: `packages/kiosk/src/pages/InfoPage.tsx`

- [ ] **Step 1: Insert the Reizen card between Times and Questions**

Looking at the current file, the cards order is: WiFi (wide), Times, Questions. We want: WiFi (wide), Times, **Travel**, Questions.

Add a new `<Card>` block between the Times card and the Questions card:

```tsx
<Card title={t('info.travel.title')}>
  <div className="space-y-4 text-el-light/80">
    <div>
      <h3 className="font-semibold text-el-light mb-1">{t('info.travel.publicTransport.heading')}</h3>
      <p className="text-sm">{t('info.travel.publicTransport.intro')}</p>
      <ul className="text-sm list-disc list-inside ml-1 mt-1 space-y-0.5">
        <li>{t('info.travel.publicTransport.lineToUtrecht')}</li>
        <li>{t('info.travel.publicTransport.lineToWestraven')}</li>
      </ul>
      <p className="text-sm mt-1 text-el-light/60">{t('info.travel.publicTransport.frequency')}</p>
    </div>
    <div>
      <h3 className="font-semibold text-el-light mb-1">{t('info.travel.car.heading')}</h3>
      <ul className="text-sm list-disc list-inside ml-1 space-y-0.5">
        <li>{t('info.travel.car.shuttle')}</li>
        <li>{t('info.travel.car.parking')}</li>
      </ul>
    </div>
    <div>
      <h3 className="font-semibold text-el-light mb-1">{t('info.travel.farewell.heading')}</h3>
      <p className="text-sm">{t('info.travel.farewell.body')}</p>
    </div>
  </div>
</Card>
```

The full updated grid block:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Card title={t('info.wifi.title')} wide>
    {/* unchanged */}
  </Card>
  <Card title={t('info.times.title')}>
    {/* unchanged */}
  </Card>
  <Card title={t('info.travel.title')}>
    {/* new content shown above */}
  </Card>
  <Card title={t('info.questions.title')}>
    {/* unchanged from Phase 1 — body + hr + emergency */}
  </Card>
</div>
```

- [ ] **Step 2: Build + test**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
pnpm --filter @ziggy/kiosk test
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/
git commit -m "feat(kiosk): Reizen card on /info — tram, shuttle, poffertjes"
```

---

## Phase 3 — Section 1: NonContent items on /now

### Task 3.1: API — split `/sessions/now` response

**Files:**
- Modify: `packages/api/src/routes/events.ts`
- Modify: `packages/api/src/routes/events.test.ts`

- [ ] **Step 1: Write the failing test**

The existing `events.test.ts` mocks the cosmos layer. We need to add a test of the `/sessions/now` route that exercises the new `currentBreaks` bucket. The route currently fetches via `runEvents.fetchRawAgenda`. We can mock that helper.

Add to `packages/api/src/routes/events.test.ts`:

```ts
import { vi } from 'vitest'

vi.mock('../lib/run-events.js', () => ({
  fetchRawAgenda: vi.fn(),
  fetchSpeakers: vi.fn(async () => []),
  fetchBooths: vi.fn(async () => []),
  fetchPartnerships: vi.fn(async () => []),
  searchAgenda: vi.fn(async () => []),
  fetchAgenda: vi.fn(async () => ({ days: [], timeZone: 'Europe/Amsterdam' })),
}))

import * as runEvents from '../lib/run-events.js'

describe('GET /api/events/:slug/sessions/now', () => {
  const app = new Hono().route('/', events)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns currentBreaks for elementType=2 items running now', async () => {
    // Mock the system clock so "now" is predictable in event TZ
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T11:00:00Z')) // 13:00 Europe/Amsterdam in summer

    vi.mocked(runEvents.fetchRawAgenda).mockResolvedValueOnce([
      {
        id: 1,
        guid: 'g1',
        title: 'Lunch',
        roomName: 'Foyer',
        roomGuid: 'r1',
        startDate: '2026-06-02T12:30:00',
        endDate: '2026-06-02T13:30:00',
        startTimeGroup: '12:30',
        elementType: 2,
        elementTypeName: 'NonContent',
        timeZone: 'Europe/Amsterdam',
        labels: [],
        speakers: [],
        description: null,
        color: null,
        icon: null,
      },
    ] as never)

    const res = await app.request('/api/events/test-event/sessions/now')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current).toEqual([])
    expect(body.currentBreaks).toHaveLength(1)
    expect(body.currentBreaks[0].title).toBe('Lunch')
    expect(body.currentBreaks[0].elementType).toBe(2)

    vi.useRealTimers()
  })

  it('returns current sessions and empty currentBreaks during a session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T08:30:00Z')) // 10:30 Europe/Amsterdam

    vi.mocked(runEvents.fetchRawAgenda).mockResolvedValueOnce([
      {
        id: 2,
        guid: 'g2',
        title: 'Keynote',
        roomName: 'Plenary',
        roomGuid: 'r2',
        startDate: '2026-06-02T10:00:00',
        endDate: '2026-06-02T11:00:00',
        startTimeGroup: '10:00',
        elementType: 1,
        elementTypeName: 'Session',
        timeZone: 'Europe/Amsterdam',
        labels: [],
        speakers: [],
        description: null,
        color: null,
        icon: null,
      },
    ] as never)

    const res = await app.request('/api/events/test-event/sessions/now')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current).toHaveLength(1)
    expect(body.currentBreaks).toEqual([])

    vi.useRealTimers()
  })
})
```

Run: `pnpm --filter @ziggy/api test -- events.test`. Expected: FAIL — current route doesn't return `currentBreaks`.

- [ ] **Step 2: Update the route to split current / currentBreaks**

Edit `packages/api/src/routes/events.ts`. Find the `/api/events/:slug/sessions/now` handler. Currently it filters items into `current` (elementType === 1) and discards type !== 1. Change to also collect type === 2 items into `currentBreaks`:

```ts
events.get('/api/events/:slug/sessions/now', async (c) => {
  const slug = c.req.param('slug')
  const apiKey = getEventApiKey(slug)
  if (!apiKey) return c.json({ error: 'Event not found' }, 404)

  const cacheKey = `agenda-raw:${slug}`
  const hadLive = cache.get(cacheKey) !== undefined

  try {
    const items = await runEvents.fetchRawAgenda(apiKey, slug)
    const eventTimezone = items[0]?.timeZone || 'Europe/Amsterdam'

    const now = new Date()
    const nowStr = now.toLocaleString('sv-SE', { timeZone: eventTimezone })
    const nowIso = nowStr.replace(' ', 'T')

    const current: RunEventsAgendaItem[] = []
    const currentBreaks: RunEventsAgendaItem[] = []
    const upcoming: RunEventsAgendaItem[] = []

    for (const item of items) {
      const isLive = item.startDate <= nowIso && nowIso < item.endDate
      if (isLive) {
        if (item.elementType === 1) current.push(item)
        else if (item.elementType === 2) currentBreaks.push(item)
      } else if (item.startDate > nowIso) {
        upcoming.push(item)
      }
    }

    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
    const nextTimeGroup = upcoming[0]?.startTimeGroup
    const upNext = nextTimeGroup
      ? upcoming.filter((s) => s.startTimeGroup === nextTimeGroup)
      : []

    const hasLiveNow = cache.get(cacheKey) !== undefined
    if (!hadLive && !hasLiveNow && cache.hasLastGood(cacheKey)) {
      c.header('X-Stale', 'true')
    }

    return c.json({ current, currentBreaks, upNext, timeZone: eventTimezone })
  } catch (err) {
    console.error('[events/sessions/now]', err)
    return c.json({ error: 'Failed to fetch current sessions' }, 502)
  }
})
```

The shape now adds `currentBreaks: RunEventsAgendaItem[]`. The existing `current` semantics stay (sessions only).

- [ ] **Step 3: Run tests**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/api test
```

Expected: all pass, including the two new test cases.

- [ ] **Step 4: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/api/
git commit -m "feat(api): split /sessions/now response into current + currentBreaks"
```

### Task 3.2: Kiosk — extend NowResponse type and hook

**Files:**
- Modify: `packages/kiosk/src/lib/api.ts`

- [ ] **Step 1: Add `currentBreaks` to NowResponse**

In `packages/kiosk/src/lib/api.ts`, find the `NowResponse` interface (search for `export interface NowResponse`):

```ts
export interface NowResponse {
  current: AgendaSession[];
  upNext: AgendaSession[];
  timeZone: string;
}
```

Replace with:

```ts
export interface NowResponse {
  current: AgendaSession[];
  currentBreaks: AgendaSession[];
  upNext: AgendaSession[];
  timeZone: string;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
```

Expected: there may be type errors in `NowPage.tsx` if it destructures `current, upNext` — those are fine because we're adding a NEW field, not removing the old ones. If the destructure pattern is `const { current, upNext } = data ?? {...}`, the fallback object needs `currentBreaks: []`. Fix in next task.

### Task 3.3: NonContentCard component

**Files:**
- Create: `packages/kiosk/src/components/NonContentCard.tsx`

- [ ] **Step 1: Implement the component**

Create `packages/kiosk/src/components/NonContentCard.tsx`:

```tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'
import type { AgendaSession } from '../lib/api'

function pickIcon(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('lunch') || t.includes('diner') || t.includes('dinner')) return '🍽️'
  if (t.includes('borrel') || t.includes('drinks') || t.includes('reception')) return '🥂'
  if (t.includes('registratie') || t.includes('registration') || t.includes('welcome')) return '👋'
  if (t.includes('pauze') || t.includes('break') || t.includes('coffee') || t.includes('koffie') || t.includes('tea') || t.includes('thee')) return '☕'
  return '⏸️'
}

function formatTime(date: Date, language: string): string {
  return date.toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function NonContentCard({ item, now }: { item: AgendaSession; now: Date }) {
  const { t } = useTranslation()
  const language = useKioskStore((s) => s.language)

  const endDate = useMemo(() => new Date(item.endDate), [item.endDate])
  const minutesLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 60_000))
  const endTime = formatTime(endDate, language)
  const icon = pickIcon(item.title)

  return (
    <div className="bg-emerald-900/40 border border-emerald-700/40 rounded-2xl p-6 flex items-center gap-4">
      <div className="text-5xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-2xl font-extrabold text-el-light leading-tight">
          {item.title}
        </h3>
        <p className="text-el-light/70 mt-1">
          {t('now.breakUntil', { time: endTime })} · {t('now.minutesLeft', { minutes: minutesLeft })}
        </p>
      </div>
    </div>
  )
}
```

The component takes the same `AgendaSession` shape as session cards — both `current` and `currentBreaks` come back as the same kiosk type from the API.

### Task 3.4: i18n keys for now.breakUntil / now.minutesLeft / now.nextUpAt

**Files:**
- Modify: `packages/kiosk/src/i18n/{en,nl,de,fr}.json`

- [ ] **Step 1: Add keys to all 4 locales**

Find the existing `now` block in each locale. Add three new keys:

`en.json` `now`:
```json
"breakUntil": "until {{time}}",
"minutesLeft": "{{minutes}} min left",
"nextUpAt": "Next session at {{time}}"
```

`nl.json` `now`:
```json
"breakUntil": "tot {{time}}",
"minutesLeft": "nog {{minutes}} min",
"nextUpAt": "Volgende sessie om {{time}}"
```

`de.json` `now`:
```json
"breakUntil": "bis {{time}}",
"minutesLeft": "noch {{minutes}} Min",
"nextUpAt": "Nächste Sitzung um {{time}}"
```

`fr.json` `now`:
```json
"breakUntil": "jusqu'à {{time}}",
"minutesLeft": "{{minutes}} min restantes",
"nextUpAt": "Prochaine session à {{time}}"
```

Add alongside existing `now` keys (`title`, `subtitle`, `upNext`, `noSessions`, etc.). Preserve all existing keys.

### Task 3.5: NowPage renders NonContentCard when sessions empty but breaks running

**Files:**
- Modify: `packages/kiosk/src/pages/NowPage.tsx`

- [ ] **Step 1: Read the current NowPage to find the empty-state branch**

```bash
cd /Users/maartengoet/Github/ziggy
grep -n "current" packages/kiosk/src/pages/NowPage.tsx
```

The page currently destructures `current, upNext` and renders sessions if `hasCurrentSessions`, else the thought-bubble empty state. We add a middle branch.

- [ ] **Step 2: Update the destructure + render**

Find the destructure (around line 103):

```tsx
const { current, upNext } = data ?? { current: [], upNext: [] }
const hasCurrentSessions = current.length > 0
const hasUpNext = upNext.length > 0
```

Replace with:

```tsx
const { current, currentBreaks, upNext } = data ?? { current: [], currentBreaks: [], upNext: [] }
const hasCurrentSessions = current.length > 0
const hasCurrentBreaks = currentBreaks.length > 0
const hasUpNext = upNext.length > 0
```

Find the render branch (around line 113):

```tsx
{hasCurrentSessions ? (
  <div className="mb-8">
    {/* existing session card grid */}
  </div>
) : (
  <div className="mb-8 py-12 flex flex-col items-center justify-center">
    <div className="text-5xl mb-4 opacity-40">&#x1F4AD;</div>
    <NextSessionTime sessions={upNext} />
  </div>
)}
```

Replace with three branches: sessions → break → empty. Add `import { NonContentCard } from '../components/NonContentCard'` at the top:

```tsx
{hasCurrentSessions ? (
  <div className="mb-8">
    {/* existing session card grid — unchanged */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {current.map((session) => (
        <div key={session.id} className="space-y-2">
          <SessionCard
            session={session}
            now={now}
            onTap={() => {
              openSession(session.id);
              touch();
            }}
          />
          <div className="px-1">
            <TimeRemainingBadge session={session} />
          </div>
        </div>
      ))}
    </div>
  </div>
) : hasCurrentBreaks ? (
  <div className="mb-8 space-y-4">
    {currentBreaks.map((b) => (
      <NonContentCard key={b.id} item={b} now={now} />
    ))}
    {hasUpNext && (
      <p className="text-el-light/60 text-center">
        {t('now.nextUpAt', {
          time: new Date(upNext[0].startDate).toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        })}
      </p>
    )}
  </div>
) : (
  <div className="mb-8 py-12 flex flex-col items-center justify-center">
    <div className="text-5xl mb-4 opacity-40">&#x1F4AD;</div>
    <NextSessionTime sessions={upNext} />
  </div>
)}
```

If the existing NowPage doesn't already import a `now` value or `language`, add them. Look near the top of the function for `useClockTick` and `useKioskStore` — `now` and `language` should already be there from Phase 5 of the event-ready plan; if not, add:

```tsx
import { useClockTick } from '../lib/clock'
// ...
const now = useClockTick(30_000)
const language = useKioskStore((s) => s.language)
```

- [ ] **Step 3: Build + typecheck + test**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
pnpm --filter @ziggy/kiosk test
```

Expected: clean.

- [ ] **Step 4: Manual sanity test with `?now=` override**

Run a quick visual check by starting dev and visiting with a frozen-time override that lands during a break:

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk dev &
DEV_PID=$!
sleep 3
echo "Open http://localhost:5173/now?now=2026-06-02T12:30:00Z"
# Manually verify the NonContentCard appears with title 'Lunch' (assuming run.events has a Lunch entry)
kill $DEV_PID 2>/dev/null
```

(The `?now=` override only affects `useClockTick` on the kiosk side, not the API. So the API still returns based on real time. Skip this step if dev backend isn't running with a recent agenda — visual verification can also be done after deploy with the dev override on production.)

- [ ] **Step 5: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/
git commit -m "feat(kiosk): show NonContent break/lunch on /now instead of empty state"
```

---

## Phase 4 — Push + watch CI

### Task 4.1: Push all phases

- [ ] **Step 1: Push**

```bash
cd /Users/maartengoet/Github/ziggy
git push origin main 2>&1 | tail -5
```

- [ ] **Step 2: Watch CI**

```bash
cd /Users/maartengoet/Github/ziggy
sleep 8
RUN=$(gh run list --branch main --limit 1 --json databaseId,status -q '.[0] | select(.status != "completed") | .databaseId')
[ -n "$RUN" ] && gh run watch "$RUN" --exit-status 2>&1 | tail -3
gh run view "$RUN" --json conclusion -q '.conclusion'
```

Expected: `success`.

### Task 4.2: Smoke test

- [ ] **Step 1: Verify /api/events/.../sessions/now returns currentBreaks**

```bash
curl -s https://ziggy-api.mangosky-5e1b98ca.westeurope.azurecontainerapps.io/api/events/experts-live-netherlands-2026/sessions/now | python3 -m json.tool | head -30
```

Expected: response has `current`, `currentBreaks`, `upNext`, `timeZone` keys. Outside event days `current` and `currentBreaks` are both `[]` and `upNext` is non-empty (or `[]` if before any future agenda items).

- [ ] **Step 2: Visual check on /info**

Open `https://ziggy.expertslive.dev/info`. Verify:
- 4 cards visible: WiFi (wide), Tijden, Reizen, Vragen?
- Reizen has 3 sub-blocks (OV, Auto, Bij vertrek) with poffertjes line
- Vragen? has body + thin separator + italic 112 line
- Switch language to EN/DE/FR and verify all keys translate

---

## Acceptance checklist

- [ ] `/info` shows 4 cards: WiFi, Tijden, Reizen, Vragen?
- [ ] Reizen card has OV / Auto / Bij vertrek blocks; renders correctly in NL, EN, DE, FR
- [ ] Vragen? card body has the 112 line below a thin separator in italic, smaller text
- [ ] `GET /api/events/:slug/sessions/now` returns the new `currentBreaks` array
- [ ] During a break/lunch (verifiable mid-event or via temporarily mocking the agenda), `/now` shows a green NonContent card with title, end time, and minute countdown
- [ ] Outside any agenda item, `/now` still shows the empty thought-bubble state
- [ ] During a session, `/now` shows session cards with LIVE pill (existing behavior unchanged)
- [ ] Inactivity reset still works (60s → /now, all state cleared)
- [ ] iPhone mobile responsive layout still works (Reizen card stacks under others on narrow screens)
- [ ] CI deploy successful, both kiosk + admin SWAs deploy, all routes return 200
