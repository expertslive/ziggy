import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  fetchAuction,
  placeBid,
  type AuctionPublicState,
  type ShopItem,
} from '../lib/api'
import { useKioskStore } from '../store/kiosk'
import { getKioskId } from '../lib/kiosks'
import { track } from '../lib/analytics'

const SLUG =
  (import.meta.env.VITE_EVENT_SLUG as string | undefined) ||
  'experts-live-netherlands-2026'

const SESSION_BIDS_KEY = 'ziggy.auction.sessionBids'

/** Has the current visitor (= analytics session) already bid on this item?
 * Stored client-side so the UI can switch to "je hebt al geboden" without
 * waiting for a server round-trip. The server still enforces the rule. */
function hasBidThisSession(itemId: string): boolean {
  try {
    const sessionId = window.localStorage.getItem('ziggy.analytics.sessionId')
    if (!sessionId) return false
    const raw = window.localStorage.getItem(SESSION_BIDS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    return map[itemId] === sessionId
  } catch {
    return false
  }
}
function markBidThisSession(itemId: string) {
  try {
    const sessionId = window.localStorage.getItem('ziggy.analytics.sessionId')
    if (!sessionId) return
    const raw = window.localStorage.getItem(SESSION_BIDS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[itemId] = sessionId
    window.localStorage.setItem(SESSION_BIDS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function fmtEur(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`
}

/** Format helpers that take t() so all strings are localised. */
function useFormatters() {
  const { t } = useTranslation()
  function fmtTimeAgo(ts: number, now = Date.now()): string {
    const sec = Math.floor((now - ts) / 1000)
    if (sec < 60) return t('auction.time.secAgo', { n: sec })
    const min = Math.floor(sec / 60)
    if (min < 60) return t('auction.time.minAgo', { n: min })
    const hr = Math.floor(min / 60)
    return t('auction.time.hrAgo', { n: hr })
  }
  function fmtCountdown(ms: number): string {
    if (ms <= 0) return t('auction.time.closed')
    const sec = Math.floor(ms / 1000)
    const days = Math.floor(sec / 86400)
    const hrs = Math.floor((sec % 86400) / 3600)
    const min = Math.floor((sec % 3600) / 60)
    if (days > 0) return t('auction.time.countDays', { d: days, h: hrs })
    if (hrs > 0) return t('auction.time.countHours', { h: hrs, m: min })
    return t('auction.time.countMins', { m: min })
  }
  return { fmtTimeAgo, fmtCountdown }
}

export function AuctionPanel({ item }: { item: ShopItem }) {
  const { t, i18n } = useTranslation()
  const { fmtTimeAgo, fmtCountdown } = useFormatters()
  const qc = useQueryClient()
  const touch = useKioskStore((s) => s.touch)
  const q = useQuery<AuctionPublicState>({
    queryKey: ['auction', item.id],
    queryFn: () => fetchAuction(SLUG, item.id),
    refetchInterval: 8_000, // live updates every ~8s
    staleTime: 4_000,
  })
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const [formOpen, setFormOpen] = useState(false)
  const alreadyBid = hasBidThisSession(item.id)

  const state = q.data
  const currentHigh = state?.highest?.amount ?? 0
  const minNext =
    currentHigh > 0
      ? currentHigh + (item.auction?.minIncrement ?? 1000)
      : item.auction?.minStartBid ?? 9000

  const isOpen = state ? state.isOpen : true
  const endsAt = item.auction ? new Date(item.auction.endsAt).getTime() : 0
  const ms = endsAt - now

  const winner = !isOpen && state?.highest

  // Locale-friendly clock — falls back to nl-NL formatting if i18n key isn't a
  // real BCP47 tag we can pass to Intl.
  const timeLocale = i18n.language || 'nl'

  return (
    <div className="space-y-4 text-el-light">
      <div className="rounded-2xl bg-el-darker/80 border border-el-blue/40 p-5">
        {winner ? (
          <>
            <div className="text-xs uppercase tracking-wider font-bold text-el-blue mb-1">
              {t('auction.winner')}
            </div>
            <div className="text-4xl font-extrabold">
              {fmtEur(state!.highest!.amount)}
            </div>
            <div className="text-el-light/70 mt-1 text-sm">
              {state!.highest!.displayName}
            </div>
            <div className="mt-3 text-xs text-el-light/50">
              {t('auction.closedThanks')}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider font-bold text-el-blue mb-1">
              {t('auction.currentBid')}
            </div>
            <div className="text-4xl font-extrabold">
              {state?.highest
                ? fmtEur(state.highest.amount)
                : fmtEur(
                    item.auction!.minStartBid -
                      (item.auction!.minIncrement ?? 0),
                  )}
            </div>
            {state?.highest ? (
              <div className="text-el-light/70 mt-1 text-sm">
                {state.highest.displayName} · {fmtTimeAgo(state.highest.ts, now)}
              </div>
            ) : (
              <div className="text-el-light/50 mt-1 text-sm">
                {t('auction.noBids', { amount: fmtEur(item.auction!.minStartBid) })}
              </div>
            )}
            <div className="mt-3 text-xs text-el-light/60 flex items-center gap-1.5">
              <span>⏱</span>
              <span>
                {t('auction.closesAt', {
                  time: new Date(item.auction!.endsAt).toLocaleTimeString(
                    timeLocale,
                    { hour: '2-digit', minute: '2-digit' },
                  ),
                  countdown: fmtCountdown(ms),
                })}
              </span>
            </div>
          </>
        )}
      </div>

      {isOpen && !alreadyBid && (
        <button
          onClick={() => {
            setFormOpen(true)
            touch()
            track('shop_item_open', {
              kind: 'auction-bid-tap',
              shopItemId: item.id,
            })
          }}
          className="w-full py-4 rounded-2xl bg-el-blue text-white font-bold text-lg active:bg-el-blue/80 transition-colors"
        >
          {t('auction.bidCta', { amount: fmtEur(minNext) })}
        </button>
      )}
      {isOpen && alreadyBid && (
        <div className="w-full py-3 rounded-2xl bg-white/5 text-el-light/70 text-center text-sm">
          {t('auction.alreadyBid')}
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider font-bold text-el-light/50 mb-2">
          {t('auction.history')}
        </div>
        <ul className="space-y-1.5 text-sm">
          {state?.bids.length ? (
            state.bids.slice(0, 12).map((b, i) => (
              <li
                key={`${b.ts}-${i}`}
                className={`flex items-center justify-between gap-3 ${
                  i === 0 ? 'text-el-light' : 'text-el-light/60'
                }`}
              >
                <span className="truncate">
                  {i === 0 && '🥇 '}
                  {i === 1 && '🥈 '}
                  {i === 2 && '🥉 '}
                  {b.displayName}
                </span>
                <span className="font-mono shrink-0">{fmtEur(b.amount)}</span>
                <span className="shrink-0 w-20 text-right text-xs text-el-light/40">
                  {fmtTimeAgo(b.ts, now)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-el-light/50 italic">
              {t('auction.noBidsHistory')}
            </li>
          )}
        </ul>
      </div>

      <p className="text-[11px] text-el-light/40">{t('auction.footnote')}</p>

      {formOpen && (
        <BidForm
          item={item}
          minNext={minNext}
          increment={item.auction!.minIncrement}
          onClose={() => setFormOpen(false)}
          onPlaced={() => {
            markBidThisSession(item.id)
            qc.invalidateQueries({ queryKey: ['auction', item.id] })
            setFormOpen(false)
          }}
        />
      )}
    </div>
  )
}

function BidForm({
  item,
  minNext,
  increment,
  onClose,
  onPlaced,
}: {
  item: ShopItem
  minNext: number
  increment: number
  onClose: () => void
  onPlaced: () => void
}) {
  const { t } = useTranslation()
  const touch = useKioskStore((s) => s.touch)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState(minNext) // cents
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () =>
      placeBid(SLUG, item.id, {
        amount,
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        kioskId: getKioskId() ?? undefined,
        sessionId:
          typeof window !== 'undefined'
            ? window.localStorage.getItem('ziggy.analytics.sessionId') ?? undefined
            : undefined,
        binding: true,
      }),
    onSuccess: () => {
      track('shop_item_open', { kind: 'auction-bid-placed', shopItemId: item.id, amount })
      onPlaced()
    },
    onError: (e) => {
      // Server returns localised text where it makes sense (Dutch fallback for
      // unmapped messages); we surface verbatim so the actual reason ('Auction
      // is closed', 'Je hebt al geboden…') is visible to the user.
      setError(e instanceof Error ? e.message : t('auction.errors.generic'))
      setConfirming(false)
    },
  })

  const validForm =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    /^06\d{8}$/.test(phone.replace(/\D/g, '')) &&
    amount >= minNext

  const minLabel = `€${(minNext / 100).toFixed(0)}`

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-el-dark rounded-t-3xl w-full max-w-lg max-h-[90dvh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={touch}
      >
        {!confirming ? (
          <div className="p-5 sm:p-6 space-y-4">
            <h2 className="text-xl font-bold text-el-light">
              {t('auction.form.title')}
            </h2>
            <p className="text-sm text-el-light/60">
              {t('auction.form.minHint', {
                amount: minLabel,
                increment: increment / 100,
              })}
            </p>

            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-el-light/50 mb-1">
                {t('auction.form.amountLabel')}
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setAmount((a) => Math.max(minNext, a - increment))
                  }
                  className="w-12 h-12 rounded-xl bg-el-gray text-2xl text-el-light active:bg-el-gray-light"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  step={increment / 100}
                  min={minNext / 100}
                  value={amount / 100}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (Number.isFinite(n)) setAmount(n * 100)
                  }}
                  className="flex-1 h-12 rounded-xl bg-el-gray text-el-light text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-el-blue"
                />
                <button
                  onClick={() => setAmount((a) => a + increment)}
                  className="w-12 h-12 rounded-xl bg-el-gray text-2xl text-el-light active:bg-el-gray-light"
                >
                  +
                </button>
              </div>
              {amount < minNext && (
                <p className="mt-1 text-xs text-amber-300">
                  {t('auction.form.minError', { amount: minNext / 100 })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-el-light/50 mb-1">
                  {t('auction.form.name')}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auction.form.namePlaceholder')}
                  autoCapitalize="words"
                  className="w-full h-12 px-3 rounded-xl bg-el-gray text-el-light outline-none focus:ring-2 focus:ring-el-blue"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-el-light/50 mb-1">
                  {t('auction.form.email')}
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="naam@bedrijf.nl"
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="w-full h-12 px-3 rounded-xl bg-el-gray text-el-light outline-none focus:ring-2 focus:ring-el-blue"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-el-light/50 mb-1">
                  {t('auction.form.phone')}
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('auction.form.phonePlaceholder')}
                  inputMode="numeric"
                  className="w-full h-12 px-3 rounded-xl bg-el-gray text-el-light outline-none focus:ring-2 focus:ring-el-blue"
                />
              </div>
            </div>

            <p className="text-[11px] text-el-light/50">
              {t('auction.form.privacy')}
            </p>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20"
              >
                {t('auction.form.cancel')}
              </button>
              <button
                disabled={!validForm}
                onClick={() => setConfirming(true)}
                className="flex-1 h-12 rounded-xl bg-el-blue text-white font-bold active:bg-el-blue/80 disabled:opacity-40"
              >
                {t('auction.form.next')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-4 text-el-light">
            <h2 className="text-xl font-bold">{t('auction.confirm.title')}</h2>
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2">
              <p className="text-base">
                {t('auction.confirm.body', { amount: `€${amount / 100}` })}
              </p>
              <p className="text-sm text-el-light/80">
                {t('auction.confirm.consequence')}
              </p>
            </div>
            <ul className="text-sm text-el-light/70 space-y-1">
              <li>
                {t('auction.confirm.fieldName')}{' '}
                <span className="text-el-light">{name}</span>
              </li>
              <li>
                {t('auction.confirm.fieldEmail')}{' '}
                <span className="text-el-light">{email}</span>
              </li>
              <li>
                {t('auction.confirm.fieldPhone')}{' '}
                <span className="text-el-light">{phone}</span>
              </li>
            </ul>
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={mut.isPending}
                className="flex-1 h-12 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20"
              >
                {t('auction.confirm.cancel')}
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="flex-1 h-12 rounded-xl bg-red-600 text-white font-bold active:bg-red-700 disabled:opacity-50"
              >
                {mut.isPending
                  ? t('auction.confirm.submitting')
                  : t('auction.confirm.submit')}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
