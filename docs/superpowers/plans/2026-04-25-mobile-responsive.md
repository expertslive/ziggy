# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ziggy render correctly on iPhone (≤640px) without changing the kiosk experience on iPad and larger.

**Architecture:** Mobile-only adaptations gated behind Tailwind's `max-sm:` (or default + `sm:` overrides) so iPad/desktop kiosk styling stays unchanged. Most changes are className tweaks; the language switcher gets a popover (mirrors the existing AccessibilityMenu pattern); the SearchPage gains a native `<input>` for iPhone alongside the existing virtual keyboard for kiosk.

**Tech Stack:** React 19, Tailwind v4, Zustand, react-i18next, vitest. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-25-mobile-responsive-design.md`

**Note on TDD:** Most tasks here are CSS className changes that don't lend themselves to tests. The language popover (Task 1.2) is the only stateful interactive component and gets a vitest test. Other tasks are validated by `pnpm typecheck` + `pnpm build` + manual eyeball.

---

## Phase 1 — Header

### Task 1.1: Hide the clock on iPhone

**Files:**
- Modify: `packages/kiosk/src/components/Header.tsx`

- [ ] **Step 1: Wrap the clock in a hidden-on-mobile class**

In `Header.tsx`, find the clock div around line 57-59:

```tsx
<div className="text-3xl font-bold tabular-nums text-el-light">
  {time}
</div>
```

Replace with:

```tsx
<div className="hidden sm:block text-3xl font-bold tabular-nums text-el-light">
  {time}
</div>
```

`hidden sm:block` means: display: none by default (iPhone), display: block at `sm:` breakpoint (640px+) and bigger.

- [ ] **Step 2: Typecheck + build**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/src/components/Header.tsx
git commit -m "feat(kiosk): hide clock on iPhone (OS status bar shows time)"
```

### Task 1.2: Language switcher popover on iPhone

**Files:**
- Create: `packages/kiosk/src/components/LanguageSwitcher.tsx`
- Create: `packages/kiosk/src/components/LanguageSwitcher.test.tsx`
- Modify: `packages/kiosk/src/components/Header.tsx`

- [ ] **Step 1: Write the failing test first**

Create `packages/kiosk/src/components/LanguageSwitcher.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

i18n.use(initReactI18next).init({
  lng: 'nl',
  fallbackLng: 'en',
  resources: {
    nl: { translation: {} },
    en: { translation: {} },
  },
  interpolation: { escapeValue: false },
})

function renderSwitcher(languages: string[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSwitcher languages={languages} />
    </I18nextProvider>,
  )
}

describe('LanguageSwitcher', () => {
  it('shows all languages inline on the kiosk variant', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    expect(screen.getByText('NL')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('FR')).toBeInTheDocument()
  })

  it('shows only the current language as the trigger on iPhone', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    // Mobile-only trigger (the popover-collapsed view) shows NL
    const triggers = screen.getAllByText('NL')
    // At least one of them is the mobile trigger
    expect(triggers.length).toBeGreaterThanOrEqual(1)
  })

  it('opens a popover with all languages when the mobile trigger is tapped', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    const trigger = screen.getByLabelText(/language picker/i)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes the popover after picking a language', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    const trigger = screen.getByLabelText(/language picker/i)
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    const enButton = within(menu).getByRole('menuitem', { name: /en/i })
    fireEvent.click(enButton)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
```

Add the `within` import at the top of the test file:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
```

Run:
```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk test -- LanguageSwitcher
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 2: Implement LanguageSwitcher**

Create `packages/kiosk/src/components/LanguageSwitcher.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'

interface LanguageSwitcherProps {
  languages: string[]
}

export function LanguageSwitcher({ languages }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const setLanguage = useKioskStore((s) => s.setLanguage)
  const touch = useKioskStore((s) => s.touch)
  const [open, setOpen] = useState(false)

  const change = (lang: string) => {
    i18n.changeLanguage(lang)
    setLanguage(lang)
    touch()
    setOpen(false)
  }

  return (
    <>
      {/* Inline pills — kiosk only (sm and up) */}
      <div className="hidden sm:flex items-center gap-2">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => change(lang)}
            className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
              i18n.language === lang
                ? 'bg-el-blue text-white'
                : 'bg-el-gray text-el-light active:bg-el-gray-light'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Popover trigger — iPhone only (below sm) */}
      <div className="relative sm:hidden">
        <button
          aria-label={t('a11y.languagePicker', 'Language picker')}
          onClick={() => { setOpen((v) => !v); touch() }}
          className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center rounded-xl bg-el-blue text-white text-sm font-bold"
        >
          {i18n.language.toUpperCase()} <span className="ml-1 text-xs">▾</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div role="menu" className="absolute right-0 top-12 z-50 bg-el-gray rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[120px]">
              {languages.map((lang) => (
                <button
                  key={lang}
                  role="menuitem"
                  onClick={() => change(lang)}
                  className={`min-h-[44px] px-4 rounded-xl text-left text-sm font-bold ${
                    i18n.language === lang
                      ? 'bg-el-blue text-white'
                      : 'bg-el-darker text-el-light active:bg-el-gray-light'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Run test — should pass**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk test -- LanguageSwitcher
```

Expected: 4 pass.

- [ ] **Step 4: Wire into Header**

In `packages/kiosk/src/components/Header.tsx`:

Replace the right-hand container that currently maps over `languages` (around lines 63-77). The current block:

```tsx
<div className="flex items-center gap-2">
  <AccessibilityMenu />
  {languages.map((lang) => (
    <button ... key={lang} ... onClick={() => changeLanguage(lang)}>
      {lang.toUpperCase()}
    </button>
  ))}
</div>
```

Becomes:

```tsx
<div className="flex items-center gap-2">
  <button aria-label="Refresh" onClick={...} className="...">...</button>
  <AccessibilityMenu />
  <LanguageSwitcher languages={languages} />
</div>
```

Add the import:

```tsx
import { LanguageSwitcher } from './LanguageSwitcher'
```

The local `changeLanguage` function in Header is no longer needed — delete it. The `setLanguage` and `touch` store reads are moved into LanguageSwitcher itself.

- [ ] **Step 5: Verify Header still typechecks + builds**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
pnpm --filter @ziggy/kiosk test
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/
git commit -m "feat(kiosk): mobile language picker — popover on iPhone, pills on kiosk"
```

### Task 1.3: Smaller logo + smaller header buttons on iPhone

**Files:**
- Modify: `packages/kiosk/src/components/Header.tsx`
- Modify: `packages/kiosk/src/components/AccessibilityMenu.tsx`

- [ ] **Step 1: Logo sizing**

In `Header.tsx`, find the logo `<img>` (around line 48):

```tsx
<img src={logoUrl} alt={...} className="h-10 w-auto" />
```

Replace with:

```tsx
<img src={logoUrl} alt={...} className="h-8 sm:h-10 w-auto" />
```

The text fallback (when no logoUrl):

```tsx
<span className="text-2xl font-extrabold tracking-tight">
```

becomes:

```tsx
<span className="text-xl sm:text-2xl font-extrabold tracking-tight">
```

- [ ] **Step 2: Refresh button sizing**

In `Header.tsx`, the refresh button currently has `min-w-[48px] min-h-[48px]`. Change to `min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px]`. Same for the SVG inside — change `w-6 h-6` to `w-5 h-5 sm:w-6 sm:h-6`.

- [ ] **Step 3: Accessibility button sizing**

In `packages/kiosk/src/components/AccessibilityMenu.tsx`, the trigger button has `min-w-[48px] min-h-[48px] rounded-xl bg-el-gray ...`. Change `min-w-[48px] min-h-[48px]` to `min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px]`.

- [ ] **Step 4: Build + typecheck**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/src/components/
git commit -m "feat(kiosk): smaller logo + 44px header buttons on iPhone"
```

---

## Phase 2 — BottomNav

### Task 2.1: Icon-only nav on iPhone

**Files:**
- Modify: `packages/kiosk/src/components/BottomNav.tsx`

- [ ] **Step 1: Hide labels + tighten min-h on mobile**

Read `BottomNav.tsx`. Find the NavLink className:

```tsx
className={({ isActive }) =>
  `flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[80px] py-3 transition-colors ${
    isActive ? '...' : '...'
  }`
}
```

Change `min-h-[80px]` to `min-h-[64px] sm:min-h-[80px]` and `gap-1.5` to `gap-0 sm:gap-1.5` and `py-3` to `py-2 sm:py-3`.

For the `<span>` containing the label `{t(item.labelKey)}`, add `hidden sm:block` to its className:

```tsx
<span className="hidden sm:block text-[11px] font-semibold">{t(item.labelKey)}</span>
```

Also add `aria-label` to the `<NavLink>` so screenreaders still know the section name when the label is hidden:

```tsx
<NavLink
  key={item.to}
  to={item.to}
  aria-label={t(item.labelKey)}
  onClick={touch}
  className={...}
>
  {item.icon}
  <span className="hidden sm:block text-[11px] font-semibold">{t(item.labelKey)}</span>
</NavLink>
```

- [ ] **Step 2: Build + typecheck**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/src/components/BottomNav.tsx
git commit -m "feat(kiosk): icon-only bottom nav on iPhone"
```

---

## Phase 3 — Page polish

### Task 3.1: PageContainer padding tweak

**Files:**
- Modify: `packages/kiosk/src/components/PageContainer.tsx`

- [ ] **Step 1: Tighter padding on iPhone**

Replace the current implementation:

```tsx
export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="scrollable h-full px-6 py-6">
      {children}
    </div>
  )
}
```

with:

```tsx
export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="scrollable h-full px-4 py-4 sm:px-6 sm:py-6">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/components/PageContainer.tsx
git commit -m "feat(kiosk): tighter PageContainer padding on iPhone"
```

### Task 3.2: Smaller page titles on iPhone

**Files:**
- Modify: `packages/kiosk/src/pages/NowPage.tsx`
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`
- Modify: `packages/kiosk/src/pages/SpeakersPage.tsx`
- Modify: `packages/kiosk/src/pages/MapPage.tsx`
- Modify: `packages/kiosk/src/pages/SponsorsPage.tsx`
- Modify: `packages/kiosk/src/pages/ShopPage.tsx`
- Modify: `packages/kiosk/src/pages/SearchPage.tsx`
- Modify: `packages/kiosk/src/pages/InfoPage.tsx`

- [ ] **Step 1: Replace title classNames across all pages**

In every page file above, find the page-title `<h1>`:

```tsx
<h1 className="text-3xl font-extrabold text-el-light ...">{t('...')}</h1>
```

Change `text-3xl` to `text-2xl sm:text-3xl`.

Some pages have `mb-2`, `mb-4`, `mb-6` — keep those as-is. Only the size token changes.

For NowPage there are two h1-class titles in different render branches (loading + error + happy path). Update all of them.

- [ ] **Step 2: Build**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/src/pages/
git commit -m "feat(kiosk): text-2xl page titles on iPhone, text-3xl on kiosk"
```

### Task 3.3: SpeakerCard photo sizing on iPhone

**Files:**
- Modify: `packages/kiosk/src/components/SpeakerCard.tsx`
- Modify: `packages/kiosk/src/pages/SpeakersPage.tsx` (grid gap)

- [ ] **Step 1: Smaller photo on iPhone**

In `SpeakerCard.tsx`, find the photo container `<div className="w-24 h-24 ...">`. Change to `w-20 h-20 sm:w-24 sm:h-24`.

The MVP badge inside it currently has `w-7 h-7` — leave it, it scales fine with the smaller container too. Or change to `w-6 h-6 sm:w-7 sm:h-7` for a slightly tighter feel.

- [ ] **Step 2: Tighten grid gap on iPhone**

In `SpeakersPage.tsx`, find the grid:

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
```

Change to:

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
```

- [ ] **Step 3: Build + commit**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/components/SpeakerCard.tsx packages/kiosk/src/pages/SpeakersPage.tsx
git commit -m "feat(kiosk): tighter speaker grid on iPhone"
```

### Task 3.4: AgendaPage jump-to-now button positioning

**Files:**
- Modify: `packages/kiosk/src/pages/AgendaPage.tsx`

- [ ] **Step 1: Smaller button + lower position on iPhone**

Find the jump-to-now `<button>` (around line 285+):

```tsx
<button
  className="fixed bottom-24 right-6 bg-el-blue text-white rounded-full px-5 py-3 shadow-lg font-bold ..."
  ...
>
```

Change `bottom-24` to `bottom-20 sm:bottom-24`, `right-6` to `right-4 sm:right-6`, and `px-5 py-3` to `px-4 py-2 sm:px-5 sm:py-3`.

- [ ] **Step 2: Build + commit**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/pages/AgendaPage.tsx
git commit -m "feat(kiosk): jump-to-now button compact on iPhone"
```

### Task 3.5: MapPage taller container on iPhone

**Files:**
- Modify: `packages/kiosk/src/pages/MapPage.tsx`

- [ ] **Step 1: 50vh min-height on iPhone**

Find the `FloorMapViewer` container with `min-h-[40vh]` (added in earlier mobile fix). Change to `min-h-[50vh] sm:min-h-[40vh]`.

(Mobile gets a TALLER min-height so the floor map is meaningful at glance distance; iPad has plenty of vertical space for the map regardless.)

- [ ] **Step 2: Build + commit**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/pages/MapPage.tsx
git commit -m "feat(kiosk): floor map taller on iPhone (50vh)"
```

### Task 3.6: SponsorsPage — full-width button + 1-col logos on iPhone

**Files:**
- Modify: `packages/kiosk/src/pages/SponsorsPage.tsx`

- [ ] **Step 1: Open-expo-map button full-width on iPhone**

Find the button that triggers `setSelectedMap(expoMap.id)`. Currently:

```tsx
<button
  onClick={...}
  className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-el-blue text-white font-bold active:bg-el-blue/80"
>
```

Change `mb-6 inline-flex` to `mb-6 w-full sm:w-auto inline-flex justify-center sm:justify-start`. The full-width on iPhone gives a clear tap target; on kiosk it stays inline.

- [ ] **Step 2: Sponsor logos 1-column on iPhone**

In the `SponsorCard` component inside `SponsorsPage.tsx`, the `sizeClasses` object currently:

```tsx
const sizeClasses = {
  large: 'w-full sm:w-1/2 p-3',
  medium: 'w-1/2 sm:w-1/3 p-2',
  small: 'w-1/3 sm:w-1/4 p-2',
}
```

Replace with:

```tsx
const sizeClasses = {
  large: 'w-full p-3',
  medium: 'w-full sm:w-1/3 p-2',
  small: 'w-1/2 sm:w-1/4 p-2',
}
```

`large` (Ultimate sponsors) was already `w-full` on iPhone — no change needed but explicit. `medium` (Gold) goes from `w-1/2` to `w-full` on iPhone, `small` from `w-1/3` to `w-1/2`. Result: Ultimate logos full-width, Gold logos full-width, smaller tiers 2-column. Logos render large enough to read.

- [ ] **Step 3: Build + commit**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/pages/SponsorsPage.tsx
git commit -m "feat(kiosk): full-width sponsor logos on iPhone, full-width expo button"
```

### Task 3.7: ShopPage featured items 1-col on iPhone

**Files:**
- Modify: `packages/kiosk/src/pages/ShopPage.tsx`

- [ ] **Step 1: Featured grid responsive**

Find the featured items grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

That's already 1-col on mobile and 2-col on `md:`. Verify by reading the file. If it's actually `grid-cols-2 md:grid-cols-2` for featured, change to `grid-cols-1 md:grid-cols-2`. The regular items grid is `grid-cols-2 md:grid-cols-3` and stays.

- [ ] **Step 2: Build + commit (no-op if already correct)**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk build
git add packages/kiosk/src/pages/ShopPage.tsx 2>/dev/null || true
git diff --cached --stat
# If anything changed, commit:
git commit -m "feat(kiosk): featured shop items 1-col on iPhone" 2>/dev/null || echo "no change needed"
```

---

## Phase 4 — SearchPage native input

### Task 4.1: Native text input on iPhone, virtual keyboard on kiosk

**Files:**
- Modify: `packages/kiosk/src/pages/SearchPage.tsx`

- [ ] **Step 1: Add a native input visible only on iPhone**

In `SearchPage.tsx`, find the search input area (a div containing the magnifying glass icon and current `query` text rendering). Above the existing rendered query, add a native text input that's visible ONLY on iPhone:

```tsx
{/* iPhone: native text input */}
<input
  type="search"
  inputMode="search"
  value={query}
  onChange={(e) => { setQuery(e.target.value); touch() }}
  placeholder={t('search.placeholder')}
  className="sm:hidden flex-1 bg-transparent text-base text-el-light placeholder:text-el-light/30 outline-none"
/>

{/* Kiosk: read-only display of the typed query */}
<div className="hidden sm:flex flex-1 text-base text-el-light min-h-[24px]">
  {query || (
    <span className="text-el-light/30">{t('search.placeholder')}</span>
  )}
</div>
```

(Wrap the existing query-display div with `hidden sm:flex`.)

- [ ] **Step 2: Hide the virtual keyboard on iPhone**

The current `<VirtualKeyboard ...>` block at the bottom of the page should be hidden on iPhone. Find the wrapper around the VirtualKeyboard / "tap to type" bar:

```tsx
<div className="shrink-0">
  {keyboardOpen ? (
    <VirtualKeyboard ... />
  ) : (
    <button ... >Tap to type</button>
  )}
</div>
```

Change to:

```tsx
<div className="shrink-0 hidden sm:block">
  {keyboardOpen ? (
    <VirtualKeyboard ... />
  ) : (
    <button ... >Tap to type</button>
  )}
</div>
```

- [ ] **Step 3: Verify the clear button still works**

The clear button (×) should remain visible in both modes. Read the relevant line:

```tsx
{query.length > 0 && (
  <button onClick={...} className="...">×</button>
)}
```

This works on both modes since it's gated only by `query.length > 0`. No change needed.

- [ ] **Step 4: Build + typecheck + test**

```bash
cd /Users/maartengoet/Github/ziggy
pnpm --filter @ziggy/kiosk typecheck
pnpm --filter @ziggy/kiosk build
pnpm --filter @ziggy/kiosk test
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/maartengoet/Github/ziggy
git add packages/kiosk/src/pages/SearchPage.tsx
git commit -m "feat(kiosk): native search input on iPhone, virtual keyboard on kiosk"
```

---

## Phase 5 — Push + verify

### Task 5.1: Push and watch CI

- [ ] **Step 1: Push**

```bash
cd /Users/maartengoet/Github/ziggy
git push origin main 2>&1 | tail -3
```

- [ ] **Step 2: Watch the CI deploy**

```bash
sleep 6
RUN=$(gh run list --branch main --limit 1 --json databaseId,status -q '.[0] | select(.status != "completed") | .databaseId')
[ -n "$RUN" ] && gh run watch "$RUN" --exit-status 2>&1 | tail -3
gh run view "$RUN" --json conclusion -q '.conclusion'
```

Expected: `success`.

- [ ] **Step 3: Curl smoke test**

```bash
echo "=== verify deep paths ==="
for path in "/" "/now" "/agenda" "/speakers" "/map" "/sponsors" "/shop" "/search" "/info"; do
  curl -s -o /dev/null -w "$path -> HTTP %{http_code}\n" "https://ziggy.expertslive.dev$path"
done
```

Expected: all `200`.

### Task 5.2: Manual viewport verification

- [ ] Visit `https://ziggy.expertslive.dev` on:
  - **iPhone Chrome** (or Chrome DevTools mobile emulation, 375×667 iPhone SE)
    - Header: clock hidden, single language button "NL ▾", refresh + Ⓐ visible
    - Bottom nav: 8 icons evenly spaced, no labels
    - Tap each tab — content fits, titles `text-2xl`
    - `/search`: native keyboard appears on input focus, no virtual keyboard at the bottom
    - `/sponsors` Ultimate sponsor logos full-width
    - `/map` floor map fills ≥50% of viewport height
    - `/agenda` jump-to-now button bottom-right, doesn't overlap content
  - **iPad Safari** (or DevTools 1024×768)
    - Header: clock visible, 4 language buttons inline, refresh + Ⓐ
    - Bottom nav: 8 icons + labels, full kiosk layout
    - Visual regression check: looks the same as before this work
- [ ] If any layout breaks, file follow-up fixes.

---

## Acceptance checklist

- [ ] iPhone (375×667): no horizontal overflow, all controls reachable
- [ ] iPhone language switcher: tap opens popover, pick language, popover closes, language applied
- [ ] iPhone bottom nav: 8 icons fit comfortably, no clipped text (because no labels)
- [ ] iPad: zero visual change from before this work
- [ ] All pages typecheck + build clean
- [ ] LanguageSwitcher unit tests pass
- [ ] Existing 60s inactivity reset still navigates back to `/now` and clears state
- [ ] CI deploy succeeds + curl smoke test returns 200 on all routes
