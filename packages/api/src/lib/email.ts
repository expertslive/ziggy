/** Resend transactional-email helper.
 *
 *  Thin wrapper around the Resend REST API — no SDK needed; one POST.
 *  Returns silently on success, throws on failure. Caller decides whether
 *  to fire-and-forget (auction outbid) or await.
 */

import { getEnv } from '../env.js'

export interface SendArgs {
  to: string
  subject: string
  html: string
  text?: string
  /** Falls back to env.outbidSender, then to resend.dev test sender. */
  from?: string
  replyTo?: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Experts Live <onboarding@resend.dev>'

export async function sendEmail(args: SendArgs): Promise<void> {
  const env = getEnv()
  if (!env.resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const body = {
    from: args.from || env.outbidSender || DEFAULT_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    ...(args.text ? { text: args.text } : {}),
    ...(args.replyTo ? { reply_to: args.replyTo } : {}),
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${raw.slice(0, 200)}`)
  }
}
