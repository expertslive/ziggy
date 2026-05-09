import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNominateLang } from '../../i18n/nominate'

const CONFETTI_COLORS = ['bg-el-blue', 'bg-yellow-400', 'bg-green-500', 'bg-white']
const CONFETTI_COUNT = 30

/** Replaces the form on a successful submit. Renders confetti behind a
 *  white card with a check, headline + body, and a "submit another" reset
 *  CTA. The hero is rendered above this by NominatePage so it stays on
 *  screen across the form -> success transition. */
export function SuccessScreen({ onAgain }: { onAgain: () => void }) {
  const { t } = useNominateLang()

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        leftPct: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 2 + Math.random() * 1.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.round(Math.random() * 6),
        rotateEnd: 360 + Math.round(Math.random() * 360),
      })),
    [],
  )

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
      >
        {confetti.map((c) => (
          <motion.span
            key={c.id}
            className={`absolute top-0 ${c.color} rounded-sm`}
            style={{
              left: `${c.leftPct}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
            }}
            initial={{ y: -20, opacity: 0, rotate: 0 }}
            animate={{
              y: 'calc(100vh + 20px)',
              opacity: [0, 1, 1, 0],
              rotate: c.rotateEnd,
            }}
            transition={{ duration: c.duration, delay: c.delay, ease: 'easeIn' }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 text-center flex flex-col items-center gap-4">
          <CheckIcon />
          <h2 className="text-3xl font-extrabold text-el-dark">{t('successTitle')}</h2>
          <p className="text-el-dark/80 leading-relaxed">{t('successBody')}</p>
          <button
            type="button"
            onClick={onAgain}
            className="mt-2 w-full min-h-12 rounded-xl bg-el-light/60 border border-el-blue/30 text-el-dark font-semibold text-base hover:bg-el-light active:bg-el-light/80 transition-colors"
          >
            {t('successAgain')}
          </button>
          <p className="mt-2 text-xs text-el-dark/40 uppercase tracking-wider font-semibold">
            {t('successFooter')}
          </p>
        </div>
      </div>
    </>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-20 h-20 text-green-500"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}
