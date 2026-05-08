import { SUPPORTED_LANGUAGES } from '@ziggy/shared'

/** Tiny indicator showing how many supported languages a record covers.
 * - all 4 filled: emerald
 * - 1–3 filled:  amber, with the missing langs in the title
 * - none:        red */
export function I18nDot({
  record,
}: {
  record: Record<string, string | undefined> | undefined
}) {
  const langs = SUPPORTED_LANGUAGES as readonly string[]
  const filled = langs.filter((l) => Boolean(record?.[l]?.trim()))
  const missing = langs.filter((l) => !record?.[l]?.trim())
  const cls =
    filled.length === langs.length
      ? 'bg-emerald-500'
      : filled.length === 0
      ? 'bg-red-500'
      : 'bg-amber-500'
  const title =
    missing.length === 0
      ? 'All languages covered'
      : `Missing: ${missing.map((l) => l.toUpperCase()).join(', ')}`
  return (
    <span
      className={`inline-flex h-4 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold text-white ${cls}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {filled.length}/{langs.length}
    </span>
  )
}
