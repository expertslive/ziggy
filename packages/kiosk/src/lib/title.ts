/** Clean noisy prefixes/suffixes from session titles before rendering.
 *
 * The run.events titles for masterclasses sometimes carry organisational
 * status that's not useful on the kiosk (e.g. "SOLD OUT - " when bezoekers
 * are already registered, or " - Powered by <community>" sponsor tagging).
 * Strip those at render time so the on-screen title stays focused on the
 * actual session topic. The original title remains intact in the data
 * (search, descriptions, etc. still match it).
 */
export function cleanSessionTitle(title: string): string {
  if (!title) return title
  return title
    .replace(/^\s*sold\s*out\s*[-–—:]\s*/i, '')
    .replace(/\s*[-–—]\s*powered\s+by\s+.*$/i, '')
    .trim()
}
