import { useEffect, type ReactNode } from 'react'

/** Chromeless wrapper for the public /nominate flow. Reachable only via
 *  direct URL/QR — none of the kiosk shell (BottomNav, Header, idle-reset,
 *  pair-overlay, analytics) applies. Mobile-first: scroll the whole page,
 *  no fixed regions.
 *
 *  index.css applies kiosk-only resets to <html> and every element
 *  (`overflow: hidden`, `user-select: none`, `-webkit-touch-callout: none`).
 *  Those resets keep an idle kiosk locked down but break the public form on
 *  a phone — the page can't scroll and inputs can't be selected/pasted into.
 *  We tag <html> while NominatePage is mounted and undo the resets via the
 *  scoped CSS in `nominate.css`. */
export function BareLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('nominate-mode')
    return () => {
      document.documentElement.classList.remove('nominate-mode')
    }
  }, [])

  return <div className="min-h-dvh bg-el-light text-el-dark font-sans">{children}</div>
}
