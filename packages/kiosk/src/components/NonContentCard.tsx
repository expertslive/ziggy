import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'
import type { AgendaSession } from '../lib/api'

function pickIcon(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('lunch') || t.includes('diner') || t.includes('dinner')) return '🍽️'
  if (t.includes('borrel') || t.includes('drinks') || t.includes('reception')) return '🥂'
  if (t.includes('registratie') || t.includes('registration') || t.includes('welcome')) return '👋'
  if (t.includes('pauze') || t.includes('break') || t.includes('coffee') || t.includes('koffie') || t.includes('tea') || t.includes('thee')) return '☕'
  return '⏸️'
}

function formatTime(date: Date, language: string): string {
  return date.toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function NonContentCard({ item, now }: { item: AgendaSession; now: Date }) {
  const { t } = useTranslation()
  const language = useKioskStore((s) => s.language)

  const endDate = useMemo(() => new Date(item.endDate), [item.endDate])
  const minutesLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 60_000))
  const endTime = formatTime(endDate, language)
  const icon = pickIcon(item.title)

  return (
    <div className="bg-emerald-900/40 border border-emerald-700/40 rounded-2xl p-6 flex items-center gap-4">
      <div className="text-5xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-2xl font-extrabold text-el-light leading-tight">
          {item.title}
        </h3>
        <p className="text-el-light/70 mt-1">
          {t('now.breakUntil', { time: endTime })} · {t('now.minutesLeft', { minutes: minutesLeft })}
        </p>
      </div>
    </div>
  )
}
