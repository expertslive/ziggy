import { Link } from 'react-router-dom'
import { SlideOver } from '../SlideOver'
import type { AuctionBidWithItem, AuctionItemStatus } from '../../lib/api'

interface Props {
  bid: AuctionBidWithItem | null
  open: boolean
  onClose: () => void
}

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatAmount(cents: number): string {
  return eurFmt.format(cents / 100)
}

function fmtDateTimeLong(ts: number): string {
  return new Date(ts).toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusPill({ status }: { status: AuctionItemStatus }) {
  const cls =
    status === 'open'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status === 'open' ? 'Open' : 'Closed'}
    </span>
  )
}

export function AuctionDetailModal({ bid, open, onClose }: Props) {
  if (!bid) {
    return (
      <SlideOver open={open} title="Bid" onClose={onClose}>
        <div />
      </SlideOver>
    )
  }

  return (
    <SlideOver open={open} title="Bid" onClose={onClose}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-secondary">
            {formatAmount(bid.amount)}
          </div>
          <StatusPill status={bid.itemAuctionStatus} />
        </div>

        <Section title="Meta">
          <Field label="Time">{fmtDateTimeLong(bid.ts)}</Field>
          <Field label="Item">
            <span className="font-medium text-secondary">{bid.itemName || '—'}</span>
          </Field>
          <Field label="Bid ID">
            <code className="break-all rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-700">
              {bid.id}
            </code>
          </Field>
        </Section>

        <Section title="Bidder">
          <Field label="Name">
            <span className="font-medium text-secondary">{bid.name}</span>
          </Field>
          {bid.displayName && bid.displayName !== bid.name && (
            <Field label="Display">
              <span className="text-gray-700">{bid.displayName}</span>
            </Field>
          )}
          {bid.email && (
            <Field label="Email">
              <a href={`mailto:${bid.email}`} className="text-primary hover:underline">
                {bid.email}
              </a>
            </Field>
          )}
          {bid.phone && (
            <Field label="Phone">
              <a href={`tel:${bid.phone}`} className="text-primary hover:underline">
                {bid.phone}
              </a>
            </Field>
          )}
        </Section>

        <Section title="Operational">
          <Field label="Kiosk">
            {bid.kioskId ? (
              <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-700">
                {bid.kioskId}
              </code>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </Field>
          <Field label="Session">
            {bid.sessionId ? (
              <code className="block max-w-full truncate rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-gray-500">
                {bid.sessionId}
              </code>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </Field>
        </Section>

        <div className="border-t border-border pt-4">
          <Link
            to={`/shop-items/${bid.itemId}/auction`}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Manage this auction →
          </Link>
        </div>
      </div>
    </SlideOver>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface-alt/50 p-3 text-sm">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="col-span-2 min-w-0 text-sm text-gray-700">{children}</div>
    </div>
  )
}
