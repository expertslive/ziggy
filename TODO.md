# Ziggy — TODO

Open punten richting Experts Live NL 2026.

## 1. Foto's toevoegen aan Shop items

De 6 shop items (Ridge wallet, Stanley beker, Draadloze lader, Leren travel bag, Houten borrelplank, Ninjacat Lamp) hebben momenteel placeholder afbeeldingen via `placehold.co`. Vervangen door echte productfoto's:

- Login op [https://ziggy-admin.expertslive.dev](https://ziggy-admin.expertslive.dev)
- Shop Items → per item: klik bewerken → upload foto → opslaan
- Aanbevolen formaat: 4:3 ratio, ≥600×450 px, JPEG of PNG of WebP (max 25 MB)

## 2. Veilig item (Octocat schets) toevoegen aan Shop

Originele tekening van de GitHub Octocat als veilig-item:

- Maak nieuw shop item via admin
- `priceLabel`: bv. "Veiling — bied bij de balie"
- `isHighlighted: true` aanvinken — dan verschijnt 'ie in de "Uitgelicht" sectie boven de andere items met een blauwe ring eromheen
- Foto van de tekening uploaden
- Description in NL + EN: korte beschrijving van het item en hoe te bieden

## 3. Mobiele experience testen + bugs verhelpen

De mobile-responsive aanpassingen zijn live op `ziggy.expertslive.dev`. Doorlopen op:

- iPhone (Chrome én Safari)
- Android telefoon (Chrome)
- iPad (mag in kiosk modus blijven, controleren dat niets veranderd is)

Per pagina checken: header (taalswitcher popover), bottom nav (icon-only), titels (`text-2xl`), padding, sponsor logos full-width op mobiel, plattegrond hoogte (50vh), zoek input (native keyboard).

Bugs hier opnemen of als losse issues maken.

## 4. Sponsors → kaart-knop strategie heroverwegen

De "Open kaart van expo gebied" knop op de Sponsors pagina opent nu de algemene plattegrond (eerste map of map met "expo" in de naam). Overwegen:

- Eigen, vereenvoudigde plattegrond specifiek voor het expo-gebied (alleen de stands/sponsors, geen zaaltjes/sessies)
- Direct embedden op de Sponsors pagina i.p.v. navigeren naar `/map`
- Of: link sponsors individueel aan een hotspot via de admin (al ondersteund via `floorMapHotspotId` op Sponsor) — dan tap op sponsor card → "Toon op plattegrond" knop
- Afhankelijk van wat duidelijker is voor attendees op de kiosk
