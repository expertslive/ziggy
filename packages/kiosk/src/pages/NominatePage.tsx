import { BareLayout } from '../components/nominate/BareLayout'

/** Studiebeurs nomination flow — public page reachable only via direct
 *  URL or the QR code handed out at the Merch booth. Hero + form + success
 *  screen are wired in subsequent tasks (T7-T9). */
export function NominatePage() {
  return (
    <BareLayout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <p className="text-el-dark/60">Nominate flow placeholder — wired in T7-T9.</p>
      </div>
    </BareLayout>
  )
}
