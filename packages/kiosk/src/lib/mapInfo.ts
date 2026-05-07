/** Maps a hotspot's roomName to a fixed info-blurb i18n key (under
 * `map.info.<key>.body`). Used both to render the blurb in MapPage and to
 * include the blurb text in the search corpus on SearchPage. Returns null
 * for hotspots that don't have a fixed blurb (booths, sessions rooms etc).
 */
export function getMapInfoKey(roomName: string): string | null {
  const n = roomName.trim().toLowerCase()
  if (n === 'registratie' || n === 'registratiebalie' || n === 'registration')
    return 'registration'
  if (n === 'photo wall' || n === 'photowall') return 'photoWall'
  if (n === 'garderobe' || n === 'cloakroom' || n === 'wardrobe') return 'garderobe'
  if (n === 'toiletten' || n === 'toilet' || n === 'toilets' || n === 'restroom')
    return 'toilets'
  if (n === 'lift' || n === 'elevator') return 'lift'
  if (
    n === 'eten/drinken' ||
    n === 'eten en drinken' ||
    n === 'food' ||
    n === 'food and drinks' ||
    n === 'food/drinks' ||
    n === 'catering'
  )
    return 'food'
  if (n === 'dietary needs' || n === 'dieet' || n === 'dieetwensen') return 'dietary'
  if (n === 'trappen' || n === 'trap' || n === 'stairs' || n === 'staircase')
    return 'stairs'
  if (n === 'ask the experts' || n === 'ask-the-experts' || n === 'experts')
    return 'askTheExperts'
  if (n === 'zaal 12') return 'zaal12'
  if (n === 'focus booths' || n === 'focus booth' || n === 'focusbooths' || n === 'focusbooth')
    return 'focusBooths'
  if (n === 'game area' || n === 'gaming area' || n === 'gamearea' || n === 'gaminggebied')
    return 'gameArea'
  if (n === 'lounge' || n === 'lounge area') return 'lounge'
  if (n === 'radio' || n === 'experts live radio') return 'radio'
  return null
}
