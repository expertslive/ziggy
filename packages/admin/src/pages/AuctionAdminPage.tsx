import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAuctionAdmin,
  closeAuction,
  type AuctionAdminState,
  type AuctionBid,
} from '../lib/api'
import { useShopItems } from '../lib/hooks'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const KIOSK_LABELS: Record<string, string> = {
  'kiosk-registratie': 'Reg',
  'kiosk-trap-gh': 'Trap GH',
  'kiosk-trap-e2': 'Trap E2',
  'kiosk-merch': 'Merch',
  'kiosk-entresol-1': 'Entresol 1',
  'kiosk-entresol-2': 'Entresol 2',
  'kiosk-lounge-1': 'Lounge A',
  'kiosk-lounge-2': 'Lounge B',
}

function fmtEur(cents: number) {
  return `€${(cents / 100).toFixed(2)}`
}
function fmtDateTime(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-NL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function fmtTs(ts: number) {
  return fmtDateTime(new Date(ts).toISOString())
}

function csvField(v: string | number | undefined): string {
  const s = String(v ?? '')
  // RFC 4180 — wrap in quotes if it contains comma, quote, or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function bidsToCsv(bids: AuctionBid[]): string {
  const header = ['Time', 'Name', 'Email', 'Phone', 'Kiosk', 'Amount (EUR)']
  const rows = bids.map((b) => [
    new Date(b.ts).toISOString(),
    csvField(b.name),
    csvField(b.email),
    csvField(b.phone),
    csvField(b.kioskId || ''),
    (b.amount / 100).toFixed(2),
  ])
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function AuctionAdminPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { toast } = useToast()
  const items = useShopItems()
  const item = (items.data ?? []).find((it: { id: string }) => it.id === id)

  const q = useQuery<AuctionAdminState>({
    queryKey: ['auction-admin', id],
    queryFn: () => fetchAuctionAdmin(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  })

  const [closeOpen, setCloseOpen] = useState(false)
  const closeMut = useMutation({
    mutationFn: () => closeAuction(id!),
    onSuccess: () => {
      toast('success', 'Veiling gesloten')
      setCloseOpen(false)
      qc.invalidateQueries({ queryKey: ['auction-admin', id] })
      qc.invalidateQueries({ queryKey: ['shop-items'] })
    },
    onError: () => toast('error', 'Sluiten mislukt'),
  })

  function downloadCsv() {
    if (!q.data) return
    const csv = bidsToCsv(q.data.bids)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auction-${id}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!id) return null
  const config = q.data?.config
  const bids = q.data?.bids ?? []
  const sorted = [...bids].sort((a, b) => b.amount - a.amount)
  const top = sorted[0]

  return (
    <div>
      <div className="mb-4">
        <Link to="/shop-items" className="text-xs text-primary hover:underline">
          ← Shop items
        </Link>
      </div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">
            Veiling — {item?.name || (id ? id.slice(0, 8) : '')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Live bod-overzicht. Auto-refresh elke 15s.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            disabled={!q.data || bids.length === 0}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-surface-alt disabled:opacity-40"
          >
            Export CSV
          </button>
          {q.data?.isOpen && (
            <button
              onClick={() => setCloseOpen(true)}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Sluit veiling
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Tile
          label="Status"
          value={
            !q.data
              ? '…'
              : q.data.isOpen
              ? 'Open'
              : config?.closedAt
              ? `Gesloten ${fmtDateTime(config.closedAt)}`
              : 'Gesloten'
          }
          tone={q.data?.isOpen ? 'good' : 'warn'}
        />
        <Tile
          label="Aantal biedingen"
          value={String(bids.length)}
        />
        <Tile
          label="Hoogste bod"
          value={top ? fmtEur(top.amount) : '—'}
        />
        <Tile
          label="Sluit"
          value={config ? fmtDateTime(config.endsAt) : '—'}
        />
      </div>

      {config && (
        <div className="mt-6 rounded-xl border border-border bg-white p-4 text-sm shadow-sm">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Min. start
              </div>
              <div className="font-mono text-secondary">
                {fmtEur(config.minStartBid)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Min. increment
              </div>
              <div className="font-mono text-secondary">
                {fmtEur(config.minIncrement)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Sluittijd
              </div>
              <div className="text-secondary">{fmtDateTime(config.endsAt)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Gesloten op
              </div>
              <div className="text-secondary">
                {config.closedAt ? fmtDateTime(config.closedAt) : '—'}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Wijzig deze waarden via Edit op het shop-item.
          </p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Tijd</th>
              <th className="px-6 py-3">Naam</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Telefoon</th>
              <th className="px-6 py-3">Kiosk</th>
              <th className="px-6 py-3 text-right">Bod</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  Laden…
                </td>
              </tr>
            )}
            {!q.isLoading && bids.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nog geen biedingen.
                </td>
              </tr>
            )}
            {bids.map((b) => {
              const isTop = top && b.id === top.id
              return (
                <tr key={b.id} className={isTop ? 'bg-emerald-50' : ''}>
                  <td className="px-6 py-3 text-sm text-gray-700">{fmtTs(b.ts)}</td>
                  <td className="px-6 py-3 text-sm font-medium text-secondary">
                    {b.name}
                    {isTop && (
                      <span className="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                        Hoogste
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{b.email}</td>
                  <td className="px-6 py-3 text-sm font-mono text-gray-700">{b.phone}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {b.kioskId
                      ? KIOSK_LABELS[b.kioskId] || (
                          <span className="font-mono text-xs">{b.kioskId}</span>
                        )
                      : <span className="text-gray-400">(test pc)</span>}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm font-bold text-secondary">
                    {fmtEur(b.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={closeOpen}
        title="Veiling sluiten?"
        message={
          top
            ? `Hoogste bod is ${fmtEur(top.amount)} van ${top.name}. Daarna kunnen er geen biedingen meer worden geplaatst.`
            : 'Er zijn nog geen biedingen. Sluit je toch?'
        }
        confirmLabel="Sluit"
        confirmTone="warning"
        onConfirm={() => closeMut.mutate()}
        onCancel={() => setCloseOpen(false)}
      />
    </div>
  )
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'neutral'
}) {
  const cls =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
      ? 'text-amber-700'
      : 'text-secondary'
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  )
}
