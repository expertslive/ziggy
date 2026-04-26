# Ziggy — TODO

Open punten richting Experts Live NL 2026.

## 1. Mobiele experience testen + bugs verhelpen

De mobile-responsive aanpassingen zijn live op `ziggy.expertslive.dev`. Doorlopen op:

- iPhone (Chrome én Safari)
- Android telefoon (Chrome)
- iPad (mag in kiosk modus blijven, controleren dat niets veranderd is)

Per pagina checken: header (taalswitcher popover), bottom nav (icon-only), titels (`text-2xl`), padding, sponsor logos full-width op mobiel, plattegrond hoogte (50vh), zoek input (native keyboard).

Bugs hier opnemen of als losse issues maken.

## 2. Sponsors → kaart-knop strategie heroverwegen

De "Open kaart van expo gebied" knop op de Sponsors pagina opent nu de algemene plattegrond (eerste map of map met "expo" in de naam). Overwegen:

- Eigen, vereenvoudigde plattegrond specifiek voor het expo-gebied (alleen de stands/sponsors, geen zaaltjes/sessies)
- Direct embedden op de Sponsors pagina i.p.v. navigeren naar `/map`
- Of: link sponsors individueel aan een hotspot via de admin (al ondersteund via `floorMapHotspotId` op Sponsor) — dan tap op sponsor card → "Toon op plattegrond" knop
- Afhankelijk van wat duidelijker is voor attendees op de kiosk
