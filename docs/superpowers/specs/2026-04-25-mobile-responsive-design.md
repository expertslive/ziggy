# Mobile Responsive — Design Spec

**Date:** 2026-04-25
**Goal:** Make Ziggy render and feel correct on iPhone (≤640px) without changing the kiosk experience on iPad and larger.

## Constraint

The kiosk look on iPad-class devices (744px+) is the **primary** experience and must not change. Tailwind's `sm:` breakpoint (640px) is the cutoff: iPad mini portrait (744px) and everything bigger keeps the current styling; iPhone-class widths get the adapted styling. Implement using `max-sm:` (or equivalent default + `sm:` overrides where it reads cleaner) so the kiosk stays the default.

## Out of scope

- Color palette, fonts, iconography
- Theme/font-scale/high-contrast logic
- Inactivity reset, deep-link behavior, security headers
- PWA, push notifications, offline mode, location-aware features

## Section 1 — Header

| Element | iPad / desktop (kiosk) | iPhone (≤640px) |
|---|---|---|
| Logo | `h-10`, links to `/info` | `h-8`, links to `/info` |
| Clock | `text-3xl`, centered | Hidden — iOS shows the time in the status bar |
| Refresh button | 48×48 button | 44×44 button |
| Accessibility (Ⓐ) | 48×48 button + popover | 44×44 button + popover |
| Language switcher | 4 buttons NL/EN/DE/FR side by side | 1 button showing current language ("NL ▾") + tap opens a popover with all 4 |

The single-language-button-with-popover pattern mirrors the existing AccessibilityMenu and uses the same dismiss-on-outside-tap behavior.

## Section 2 — BottomNav

| Aspect | iPad / desktop | iPhone |
|---|---|---|
| Items | All 8 | All 8 |
| Layout | Icon + label, `flex-1` per item, `min-h-[80px]` | Icon-only, `flex-1` per item, `min-h-[64px]` |
| Active state | Blue icon + label + top border accent | Blue icon + top border accent |
| Tap target | Whole button | Whole button (~46px wide × 64px tall, meets WCAG 44×44) |

`aria-label` is set on each NavLink from the existing `t(item.labelKey)` so screenreaders still announce the section name on iPhone.

## Section 3 — Per-page polish

| Page | Adjustment on iPhone |
|---|---|
| **Global** | `text-3xl` page titles → `text-2xl`; page padding `px-6` → `px-4`. `PageContainer` already wraps content; the change lives there. |
| **Now (`/now`)** | Already 1-column session grid. No structural change. |
| **Agenda** | Day-tabs already scrollable. Label-filter chips already scrollable. Session cards 1-column. Jump-to-now button: `px-4 py-2` (was `px-5 py-3`) and `bottom-20` (was `bottom-24`) so it clears the iOS home indicator without overlapping content. |
| **Sprekers** | Grid is already `grid-cols-2 md:grid-cols-3`. On iPhone, reduce `SpeakerCard` photo from `w-24 h-24` to `w-20 h-20` and tighten gap to `gap-3`. |
| **Plattegrond** | Map-tabs scrollable. Image container `min-h-[40vh]` becomes `min-h-[50vh]` on iPhone so the floor map is meaningful at glance distance. |
| **Sponsors** | "Open kaart van expo gebied" button: `w-full sm:w-auto`. Sponsor grid: ALL tier-sizes go full-width (`w-full`) on iPhone so logos render at consistent legible size; `sm:` rules restore the 1/2/3-column tier layout. |
| **Shop** | Grid `grid-cols-2 md:grid-cols-3` for regular items (already correct). Featured items: explicitly 1-column on iPhone (`grid-cols-1 md:grid-cols-2`). |
| **Zoeken** | The on-screen `<VirtualKeyboard />` is hidden on iPhone (replaced by the native keyboard via a real `<input>`). The `keyboardOpen` auto-collapse remains active on iPad/kiosk. The query input becomes a normal text input on iPhone with `inputMode="search"` and `autoFocus`. |
| **Info** | Cards already `md:grid-cols-2`, defaulting to 1-column. WiFi card already responsive. No further change. |

## Files affected

- `packages/kiosk/src/components/Header.tsx` — clock visibility, language popover, sizing
- `packages/kiosk/src/components/BottomNav.tsx` — icon-only mobile mode + smaller `min-h`
- `packages/kiosk/src/components/PageContainer.tsx` — padding tweak
- `packages/kiosk/src/components/SpeakerCard.tsx` — photo sizing
- `packages/kiosk/src/components/SessionCard.tsx` — confirm responsive (likely no change)
- `packages/kiosk/src/pages/AgendaPage.tsx` — title size, jump-to-now positioning
- `packages/kiosk/src/pages/SpeakersPage.tsx` — title size, grid gap
- `packages/kiosk/src/pages/MapPage.tsx` — `min-h-[50vh]` mobile
- `packages/kiosk/src/pages/SponsorsPage.tsx` — button width, sponsor card layout
- `packages/kiosk/src/pages/ShopPage.tsx` — featured grid 1-col on mobile, title size
- `packages/kiosk/src/pages/SearchPage.tsx` — native input on mobile, hide virtual keyboard
- `packages/kiosk/src/pages/NowPage.tsx` / `InfoPage.tsx` — title size only

## Acceptance

- All visible text and controls fit on a 375×667 viewport (iPhone SE) without horizontal overflow.
- Tapping the language button on iPhone opens a popover with the 4 languages; tapping outside dismisses; tapping a language sets it and closes.
- BottomNav on iPhone shows 8 icons, evenly spaced, with no clipped text.
- iPad/desktop kiosk renders identically to before this change (visual regression test by eyeballing the SWA URL on a 1024px+ viewport).
- The `?now=` URL override still scopes the live session highlighting to a chosen moment for testing.
- Existing 60s inactivity reset still navigates back to `/now` and clears all session state.

## Sequencing

1. Header (Section 1) — single component change, low risk
2. BottomNav (Section 2) — single component change
3. PageContainer + per-page polish (Section 3) — touches many files, mostly className tweaks
4. SearchPage native input — slightly bigger, isolate as last task

Each phase is independently shippable; the kiosk experience stays correct after every step because all changes are gated behind the iPhone-only breakpoint.
