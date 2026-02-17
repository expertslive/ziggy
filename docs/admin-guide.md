# Admin Guide

This guide covers how to set up and manage your event using the Ziggy admin panel.

## Getting Started

### First Login

1. Open the admin panel URL in your browser
2. Log in with your admin credentials
3. You'll see the sidebar with: **Config**, **Sponsors**, **Tiers**, **Floor Maps**, and **Translations**

### Initial Setup Checklist

1. Configure your event (branding, languages, timezone)
2. Create sponsor tiers (e.g. Ultimate, Gold, Silver)
3. Add sponsors with logos
4. Upload floor maps and draw room hotspots
5. Review translations, add overrides if needed

---

## Event Configuration

Navigate to **Config** in the sidebar.

### Branding

- **Logo** — upload your event logo (displayed in the kiosk header). Supported formats: JPEG, PNG, WebP, SVG, GIF (max 10 MB). You can also paste an image URL.
- **Primary color** — main accent color used for active navigation, buttons, and highlights
- **Secondary color** — used for the header background and supporting elements

### Languages

Select which languages are available on the kiosk. The language switcher in the kiosk header will display buttons for each enabled language.

Available languages: Dutch (NL), English (EN), German (DE), French (FR)

### Event Details

- **Event name** — displayed in the admin panel
- **Timezone** — used for calculating "now" sessions and time displays
- **Event days** — defines which days appear as tabs on the agenda page

---

## Sponsor Management

### Sponsor Tiers

Navigate to **Tiers** to set up your sponsorship levels before adding sponsors.

Each tier has:
- **Name** — e.g. "Ultimate", "Gold", "Speaker Dinner"
- **Size** — controls how sponsors in this tier are displayed on the kiosk:
  - `large` — prominent display with big logos (for top-tier sponsors)
  - `medium` — standard display
  - `small` — compact display
- **Sort order** — controls the order tiers appear on the sponsors page (lower numbers first)

### Adding Sponsors

Navigate to **Sponsors** in the sidebar.

1. Click **"New Sponsor"**
2. Fill in the details:
   - **Name** — sponsor/company name (required)
   - **Tier** — select from your defined tiers
   - **Logo** — upload a logo image or paste a URL
   - **Description** — per-language description text
   - **Website** — sponsor's website URL
   - **Booth number** — if the sponsor has an expo booth
   - **Sort order** — display order within their tier
3. Click **Save**

### Editing Sponsors

Click a sponsor in the list to edit. You can update any field, change their tier, or replace their logo. Click **Delete** to remove a sponsor.

---

## Floor Maps

Navigate to **Floor Maps** in the sidebar.

### Uploading a Floor Map

1. Click **"New Floor Map"**
2. Fill in:
   - **Name** — e.g. "Ground Floor", "First Floor", "Exhibition Hall"
   - **Image** — upload a venue map image (JPEG, PNG, WebP, SVG — max 10 MB), or paste a URL
   - **Sort order** — controls display order on the kiosk (lower numbers first)
   - **Labels** — optional per-language display names
3. Click **Save**

### Drawing Room Hotspots

Hotspots are tappable regions on the floor map that show attendees which session is running in a room.

1. From the floor maps list, click **"Edit Hotspots"** on a map
2. The full-screen editor opens:
   - **Left**: your map image with an SVG overlay for drawing
   - **Right**: hotspot list and properties panel

#### Drawing a New Hotspot

1. Click **"+ Draw New Hotspot"** to enter drawing mode
2. Click on the map to place polygon vertices — you need at least 3 points to form a region
3. Close the polygon by either:
   - Clicking near the first point (shown as a green dot)
   - Double-clicking to auto-close
4. Press **Escape** to cancel drawing at any time

#### Editing Hotspot Properties

After drawing or selecting a hotspot:

- **Room Name** — the name displayed on the kiosk map overlay (e.g. "Room 1", "Main Hall"). This should match the room name used in your run.events schedule.
- **Color** — hex color for the overlay region (e.g. `#0082C8` for blue). Each room can have a different color to help attendees distinguish areas.
- **Labels** — multi-language room names shown on the kiosk
- **Delete** — remove the hotspot entirely

#### Tips for Good Hotspots

- Draw polygons that closely follow the room boundaries on your map
- Use distinct colors for different areas or floors
- Keep room names short — they're displayed as text inside the polygon
- Make sure room names match the names in your run.events schedule, so the kiosk can show which session is in each room

#### Saving

Click **Save** to persist all hotspots. Coordinates are stored in a normalized format (0–1 range) so they display correctly on any screen size.

---

## Translation Overrides

Navigate to **Translations** in the sidebar.

The kiosk comes with built-in translations for Dutch, English, German, and French. You can override any UI string for your specific event.

### How It Works

1. Select a **language tab** at the top
2. You'll see a table of all UI strings with:
   - **Key** — the translation identifier (e.g. `nav.now`, `agenda.title`)
   - **Default** — the built-in translation (shown as placeholder text)
   - **Override** — your custom value (leave empty to use the default)
3. Type your custom text in the override field
4. Click **Save**

### Common Overrides

| Key | Default (EN) | Example Override |
|-----|-------------|-----------------|
| `now.title` | "What's Happening Now" | "Live Sessions" |
| `now.subtitle` | "View the sessions currently taking place." | "See what's on right now at Experts Live" |
| `agenda.title` | "Agenda" | "Conference Schedule" |
| `booths.title` | "Expo" | "Exhibition Hall" |
| `search.placeholder` | "Search sessions, speakers, or booths..." | "What are you looking for?" |

Overrides are applied on top of the built-in translations when the kiosk loads, so you can override as many or as few strings as you want.

---

## Kiosk Behavior

### Auto-Reset

The kiosk automatically returns to the **Now** (home) screen after 60 seconds of inactivity. Any touch or tap resets the timer. This keeps kiosks useful for the next attendee.

### Data Refresh

- Session, speaker, and booth data from run.events is cached for **5 minutes** on the server
- The kiosk refreshes data automatically — no manual action needed
- Sponsor and floor map changes made in the admin panel appear on kiosks within a few minutes

### Language Switching

Attendees can switch languages using the buttons in the top-right corner of the kiosk header. The language resets to the default after the inactivity timeout.
