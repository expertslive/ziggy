import { describe, it, expect } from 'vitest'
import {
  SponsorSchema,
  SponsorTierSchema,
  FloorMapSchema,
  EventConfigSchema,
  I18nOverridesSchema,
  BoothOverrideSchema,
} from './admin.js'

describe('SponsorSchema', () => {
  const base = {
    name: 'ACME',
    tierId: '11111111-2222-3333-4444-555555555555',
    logoUrl: 'https://cdn.example.com/logo.png',
    description: { en: 'Hello', nl: 'Hallo' },
    sortOrder: 0,
  }

  it('accepts a valid sponsor', () => {
    expect(SponsorSchema.safeParse(base).success).toBe(true)
  })

  it('rejects http (non-https) logo URL', () => {
    const r = SponsorSchema.safeParse({ ...base, logoUrl: 'http://x/y.png' })
    expect(r.success).toBe(false)
  })

  it('rejects non-string name', () => {
    expect(SponsorSchema.safeParse({ ...base, name: 123 }).success).toBe(false)
  })

  it('rejects description values over 2000 chars', () => {
    const big = { ...base, description: { en: 'x'.repeat(2001) } }
    expect(SponsorSchema.safeParse(big).success).toBe(false)
  })

  it('rejects description with unknown language key', () => {
    const bad = { ...base, description: { xx: 'hi' } }
    expect(SponsorSchema.safeParse(bad).success).toBe(false)
  })
})

describe('FloorMapSchema', () => {
  const base = {
    name: 'Main floor',
    imageUrl: 'https://cdn.example.com/map.png',
    label: { en: 'Main', nl: 'Hoofd' },
    sortOrder: 0,
    hotspots: [
      {
        id: 'h1',
        roomName: 'Room A',
        label: { en: 'A', nl: 'A' },
        points: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][],
      },
    ],
  }

  it('accepts valid map', () => {
    expect(FloorMapSchema.safeParse(base).success).toBe(true)
  })

  it('rejects more than 100 hotspots', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ ...base.hotspots[0], id: `h${i}` }))
    expect(FloorMapSchema.safeParse({ ...base, hotspots: many }).success).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    const bad = {
      ...base,
      hotspots: [{ ...base.hotspots[0], points: [[0, 0], [99999, 0], [0, 10]] as [number, number][] }],
    }
    expect(FloorMapSchema.safeParse(bad).success).toBe(false)
  })
})

describe('EventConfigSchema', () => {
  const base = {
    name: 'x',
    timezone: 'Europe/Amsterdam',
    languages: ['en'],
    defaultLanguage: 'en',
    days: [],
    branding: {
      primaryColor: '#000000',
      secondaryColor: '#000000',
      backgroundColor: '#000000',
      textColor: '#000000',
    },
  }

  it('accepts a valid config', () => {
    expect(EventConfigSchema.safeParse(base).success).toBe(true)
  })

  it('rejects invalid hex color', () => {
    expect(EventConfigSchema.safeParse({
      ...base,
      branding: { ...base.branding, primaryColor: 'red' },
    }).success).toBe(false)
  })

  it('rejects unknown language code', () => {
    expect(EventConfigSchema.safeParse({
      ...base,
      languages: ['xx'],
      defaultLanguage: 'xx',
    }).success).toBe(false)
  })
})

describe('I18nOverridesSchema', () => {
  it('rejects override value over 1000 chars', () => {
    const bad = { overrides: { 'k': 'x'.repeat(1001) } }
    expect(I18nOverridesSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects more than 500 keys', () => {
    const bigObj: Record<string, string> = {}
    for (let i = 0; i < 501; i++) bigObj[`k${i}`] = 'v'
    expect(I18nOverridesSchema.safeParse({ overrides: bigObj }).success).toBe(false)
  })
})

describe('SponsorTierSchema', () => {
  it('rejects invalid displaySize', () => {
    const bad = {
      name: 'Gold',
      label: { en: 'Gold' },
      sortOrder: 0,
      displaySize: 'xl',
    }
    expect(SponsorTierSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts large/medium/small', () => {
    for (const size of ['large', 'medium', 'small'] as const) {
      const valid = { name: 'Gold', label: { en: 'Gold' }, sortOrder: 0, displaySize: size }
      expect(SponsorTierSchema.safeParse(valid).success).toBe(true)
    }
  })
})

describe('BoothOverrideSchema', () => {
  it('accepts empty optional', () => {
    expect(BoothOverrideSchema.safeParse({}).success).toBe(true)
  })
  it('accepts valid hotspot id', () => {
    expect(BoothOverrideSchema.safeParse({ floorMapHotspotId: 'h1' }).success).toBe(true)
  })
})
