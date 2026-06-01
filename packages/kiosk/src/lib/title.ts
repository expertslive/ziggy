/** Clean noisy prefixes/suffixes from session titles before rendering.
 *
 * The run.events titles for masterclasses sometimes carry organisational
 * status that's not useful on the kiosk (e.g. "SOLD OUT - " when bezoekers
 * are already registered, or " - Powered by <community>" sponsor tagging).
 * The Ask-the-Experts slots also get tagged in-title with "(ATE session)" —
 * we strip the marker text and let SessionCard render a small badge instead
 * (same visual idiom as the 20m badge). The original title remains intact
 * in the data (search, descriptions, etc. still match it).
 */
export function cleanSessionTitle(title: string): string {
  if (!title) return title
  return title
    .replace(/^\s*sold\s*out\s*[-–—:]\s*/i, '')
    .replace(/\s*[-–—]\s*powered\s+by\s+.*$/i, '')
    .replace(/\s*\(\s*ATE(?:\s+session)?\s*\)\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** True when the session is an Ask-the-Experts slot — marked in run.events
 *  with "(ATE session)" or "(ATE)" somewhere in the title. Used by
 *  SessionCard to swap the 20m badge for an ATE pill. */
export function isAteSession(title: string): boolean {
  if (!title) return false
  return /\(\s*ATE(?:\s+session)?\s*\)/i.test(title)
}
