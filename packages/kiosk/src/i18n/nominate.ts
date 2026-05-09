import { useEffect, useSyncExternalStore } from 'react'

/** Self-contained NL/EN strings for /nominate. Kept outside react-i18next
 *  so the public form's language never bleeds into the kiosk's own i18n
 *  store and vice versa. */

export type NominateLang = 'nl' | 'en'

const STORAGE_KEY = 'nominate-lang'

export const nominateStrings = {
  nl: {
    // Hero
    pill: 'Experts Live Studiebeurs',
    headline: 'Nomineer je kandidaat',
    headlineEmoji: '🎓',
    intro:
      'Wie verdient de €5.000 Studiebeurs? Vul de nominatie hieronder in — duurt twee minuten.',
    // Lang switch
    langNL: 'NL',
    langEN: 'EN',

    // Sections
    sectionNominee: 'Wie nomineer je?',
    sectionReason: 'Waarom verdient deze persoon de Studiebeurs?',
    sectionNominator: 'Jouw gegevens',
    sectionNominatorHint: 'Voor follow-up — niet zichtbaar in publicaties.',

    // Field labels
    nomineeName: 'Volledige naam',
    nomineeNameRequired: 'Volledige naam *',
    nomineeEmail: 'E-mail (optioneel)',
    nomineePhone: 'Telefoon (optioneel)',
    reason: 'Reden',
    reasonRequired: 'Reden *',
    reasonPlaceholder:
      'Wat maakt deze persoon zo bijzonder? Hun verhaal, ambitie, wat de Studiebeurs voor ze zou betekenen…',
    nominatorName: 'Jouw naam',
    nominatorNameRequired: 'Jouw naam *',
    nominatorEmail: 'Jouw e-mail',
    nominatorEmailRequired: 'Jouw e-mail *',
    nominatorPhone: 'Jouw telefoon (optioneel)',

    // Consent
    consent:
      'Bij winst mag de naam van mijn genomineerde gedeeld worden op de Experts Live socials.',
    consentRequired: 'Vinkje verplicht om te kunnen versturen.',

    // Submit
    submit: 'Verstuur nominatie',
    submitting: 'Versturen…',
    privacy:
      'Privacy: gegevens worden alleen gebruikt voor de Studiebeurs-procedure en na 6 maanden gewist.',

    // Errors
    errorGeneric: 'Verzenden mislukt — probeer het opnieuw.',
    errorRateLimit: 'Te veel pogingen. Probeer later opnieuw.',
    errorRequired: 'Verplicht veld',
    charCounter: '{n} / 1000',

    // Success
    successTitle: 'Bedankt!',
    successBody:
      'Je nominatie is binnen. We nemen 30 dagen na het event contact op met de winnaar via LinkedIn — en met jou als nominator als follow-up nodig is.',
    successAgain: 'Nog een aankoop gedaan? Nieuwe nominatie',
    successFooter: 'Experts Live',
  },
  en: {
    pill: 'Experts Live Scholarship',
    headline: 'Nominate your candidate',
    headlineEmoji: '🎓',
    intro:
      'Who deserves the €5,000 scholarship? Fill in the nomination below — takes two minutes.',
    langNL: 'NL',
    langEN: 'EN',

    sectionNominee: 'Who are you nominating?',
    sectionReason: 'Why does this person deserve the scholarship?',
    sectionNominator: 'Your details',
    sectionNominatorHint: 'For follow-up — never published.',

    nomineeName: 'Full name',
    nomineeNameRequired: 'Full name *',
    nomineeEmail: 'Email (optional)',
    nomineePhone: 'Phone (optional)',
    reason: 'Reason',
    reasonRequired: 'Reason *',
    reasonPlaceholder:
      'What makes this person stand out? Their story, ambition, what the scholarship would mean for them…',
    nominatorName: 'Your name',
    nominatorNameRequired: 'Your name *',
    nominatorEmail: 'Your email',
    nominatorEmailRequired: 'Your email *',
    nominatorPhone: 'Your phone (optional)',

    consent:
      "If they win, my nominee's name may be shared on Experts Live's socials.",
    consentRequired: 'Required to submit.',

    submit: 'Submit nomination',
    submitting: 'Submitting…',
    privacy:
      'Privacy: data is used only for the scholarship procedure and erased after 6 months.',

    errorGeneric: 'Submission failed — please try again.',
    errorRateLimit: 'Too many attempts. Try again later.',
    errorRequired: 'Required',
    charCounter: '{n} / 1000',

    successTitle: 'Thank you!',
    successBody:
      "Your nomination is in. We'll contact the winner 30 days after the event via LinkedIn — and reach out to you as the nominator if follow-up is needed.",
    successAgain: 'Made another purchase? Submit another',
    successFooter: 'Experts Live',
  },
} as const

export type NominateStringKey = keyof typeof nominateStrings.nl

/** Detect a sensible default language from the browser. NL for Dutch
 *  speakers, EN for everyone else. */
function detectLang(): NominateLang {
  if (typeof navigator === 'undefined') return 'nl'
  const langs = [navigator.language, ...(navigator.languages ?? [])]
  return langs.some((l) => l?.toLowerCase().startsWith('nl')) ? 'nl' : 'en'
}

// Module-level singleton so every useNominateLang() consumer shares state.
// useState-per-call would give Hero and NominatePage independent copies and
// the switcher would only update its own subtree.
const subscribers = new Set<() => void>()

let currentLang: NominateLang = (() => {
  if (typeof window === 'undefined') return 'nl'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'nl' || stored === 'en') return stored
  return detectLang()
})()

function setLangShared(next: NominateLang) {
  if (next === currentLang) return
  currentLang = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore quota / private mode */
  }
  subscribers.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

function getSnapshot() {
  return currentLang
}

function getServerSnapshot(): NominateLang {
  return 'nl'
}

/** Read/write nominate language. Singleton state — all consumers re-render
 *  on switch, so Hero and NominatePage stay in sync. */
export function useNominateLang() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = (key: NominateStringKey) => nominateStrings[lang][key]

  return { lang, setLang: setLangShared, t }
}
