import { z } from 'zod'

const kioskIdPattern = /^kiosk-[A-Za-z0-9-]+$/
const shortCodePattern = /^[A-Z0-9]{2,12}$/

const displayName = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(100, 'Max 100 chars')

const shortCode = z
  .string()
  .trim()
  .regex(shortCodePattern, '2-12 chars, A-Z and 0-9 only')

const location = z.string().trim().min(1, 'Required').max(200, 'Max 200 chars')

export const KioskMetaCreateSchema = z.object({
  id: z
    .string()
    .trim()
    .min(8, 'Min 8 chars')
    .max(64, 'Max 64 chars')
    .regex(kioskIdPattern, 'Must look like kiosk-XXXX'),
  displayName,
  shortCode: shortCode.optional(),
  location: location.optional(),
})

export type KioskMetaCreateInput = z.infer<typeof KioskMetaCreateSchema>

export const KioskMetaUpdateSchema = z
  .object({
    displayName: displayName.optional(),
    shortCode: shortCode.optional(),
    location: location.optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.shortCode !== undefined ||
      v.location !== undefined,
    { message: 'At least one of displayName, shortCode, or location is required' },
  )

export type KioskMetaUpdateInput = z.infer<typeof KioskMetaUpdateSchema>
