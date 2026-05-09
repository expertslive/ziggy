import type { ReactNode } from 'react'

/** Chromeless wrapper for the public /nominate flow. Reachable only via
 *  direct URL/QR — none of the kiosk shell (BottomNav, Header, idle-reset,
 *  pair-overlay, analytics) applies. Mobile-first: scroll the whole page,
 *  no fixed regions. */
export function BareLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-el-light text-el-dark font-sans">{children}</div>
}
