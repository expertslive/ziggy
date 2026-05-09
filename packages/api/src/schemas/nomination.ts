import { z } from 'zod'

const trimmedName = z
  .string()
  .trim()
  .min(2, 'Min 2 chars')
  .max(100, 'Max 100 chars')

const optionalEmail = z
  .string()
  .trim()
  .max(200, 'Max 200 chars')
  .email('Invalid email')
  .optional()
  .or(z.literal('').transform(() => undefined))

const requiredEmail = z
  .string()
  .trim()
  .max(200, 'Max 200 chars')
  .email('Invalid email')

const phonePattern = /^[0-9 +\-]+$/
const optionalPhone = z
  .string()
  .trim()
  .min(6, 'Min 6 chars')
  .max(30, 'Max 30 chars')
  .regex(phonePattern, 'Digits, spaces, + and - only')
  .optional()
  .or(z.literal('').transform(() => undefined))

export const NominationSubmitSchema = z.object({
  nomineeName: trimmedName,
  nomineeEmail: optionalEmail,
  nomineePhone: optionalPhone,
  reason: z.string().trim().min(1, 'Required').max(1000, 'Max 1000 chars'),
  nominatorName: trimmedName,
  nominatorEmail: requiredEmail,
  nominatorPhone: optionalPhone,
  consentToShareNomineeName: z.literal(true, {
    message: 'Consent required',
  }),
  // Honeypot — real users never fill this; bots usually do. Schema fails if
  // any value is sent so the route returns a generic 400 without revealing it.
  website: z.string().max(0).optional(),
})

export type NominationSubmitInput = z.infer<typeof NominationSubmitSchema>

export const AdminNominationPatchSchema = z
  .object({
    status: z.enum(['pending', 'verified', 'rejected']).optional(),
    adminNotes: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: 'At least one of status or adminNotes is required',
  })

export type AdminNominationPatchInput = z.infer<typeof AdminNominationPatchSchema>
