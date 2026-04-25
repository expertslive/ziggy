import { z } from 'zod'
import { SUPPORTED_LANGUAGES } from '@ziggy/shared'

const language = z.enum(SUPPORTED_LANGUAGES as unknown as [string, ...string[]])

// Strict object with one optional key per supported language. Rejects unknown
// language codes (the z.record-with-enum route is inconsistent across zod
// versions; this object+strict form is explicit and reliable).
const i18nStringRecord = z
  .object(
    Object.fromEntries(
      SUPPORTED_LANGUAGES.map((l) => [l, z.string().max(2000).optional()]),
    ),
  )
  .strict()

const i18nLabelRecord = z
  .object(
    Object.fromEntries(
      SUPPORTED_LANGUAGES.map((l) => [l, z.string().max(200).optional()]),
    ),
  )
  .strict()

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), { message: 'Only https URLs allowed' })

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb')

const point = z.tuple([
  z.number().min(0).max(10_000),
  z.number().min(0).max(10_000),
])

export const SponsorSchema = z.object({
  name: z.string().min(1).max(200),
  tierId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      'Expected UUID',
    ),
  logoUrl: httpsUrl,
  website: httpsUrl.optional(),
  boothNumber: z.string().max(20).optional(),
  floorMapHotspotId: z.string().min(1).max(100).optional(),
  description: i18nStringRecord,
  sortOrder: z.number().int().min(0).max(10_000),
})

export const SponsorTierSchema = z.object({
  name: z.string().min(1).max(100),
  label: i18nLabelRecord,
  sortOrder: z.number().int().min(0).max(10_000),
  displaySize: z.enum(['large', 'medium', 'small']),
})

const HotspotSchema = z.object({
  id: z.string().min(1).max(100),
  roomName: z.string().max(200),
  roomGuid: z.string().max(100).optional(),
  label: i18nLabelRecord,
  points: z.array(point).min(3).max(50),
})

export const FloorMapSchema = z.object({
  name: z.string().min(1).max(200),
  imageUrl: httpsUrl,
  label: i18nLabelRecord,
  sortOrder: z.number().int().min(0).max(10_000),
  hotspots: z.array(HotspotSchema).max(100),
})

export const EventConfigSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(60),
  languages: z.array(language).min(1).max(SUPPORTED_LANGUAGES.length),
  defaultLanguage: language,
  branding: z.object({
    primaryColor: hexColor,
    secondaryColor: hexColor,
    backgroundColor: hexColor,
    textColor: hexColor,
    logoUrl: httpsUrl.optional(),
    logoLightUrl: httpsUrl.optional(),
    fontFamily: z.string().max(100).optional(),
  }),
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        label: i18nLabelRecord,
      }),
    )
    .max(14),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const I18nOverridesSchema = z.object({
  overrides: z
    .record(z.string().max(200), z.string().max(1000))
    .refine((obj) => Object.keys(obj).length <= 500, {
      message: 'Max 500 override keys',
    }),
})

export const BoothOverrideSchema = z.object({
  floorMapHotspotId: z.string().min(1).max(100).optional(),
})

export const ShopItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: i18nStringRecord,
  imageUrl: httpsUrl,
  priceLabel: z.string().min(1).max(80),
  isHighlighted: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000),
})
