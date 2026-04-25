import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'

type FontScale = 1 | 1.2 | 1.4

const SCALES: Array<{ value: FontScale; label: string }> = [
  { value: 1, label: 'A' },
  { value: 1.2, label: 'A+' },
  { value: 1.4, label: 'A++' },
]

export function AccessibilityMenu() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const fontScale = useKioskStore((s) => s.fontScale)
  const setFontScale = useKioskStore((s) => s.setFontScale)
  const theme = useKioskStore((s) => s.theme)
  const setTheme = useKioskStore((s) => s.setTheme)
  const touch = useKioskStore((s) => s.touch)

  return (
    <div className="relative">
      <button
        aria-label={t('a11y.title')}
        onClick={() => { setOpen((v) => !v); touch() }}
        className="min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl bg-el-gray text-el-light flex items-center justify-center text-xl font-bold active:bg-el-gray-light"
      >
        Ⓐ
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-14 z-50 bg-el-gray rounded-2xl shadow-xl p-4 w-72">
            <div className="text-sm text-el-light/70 mb-2">{t('a11y.fontSize')}</div>
            <div className="flex gap-2 mb-4">
              {SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setFontScale(s.value); touch() }}
                  className={`flex-1 min-h-[48px] rounded-xl font-bold ${
                    fontScale === s.value ? 'bg-el-blue text-white' : 'bg-el-darker text-el-light'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="text-sm text-el-light/70 mb-2">{t('a11y.highContrast')}</div>
            <button
              onClick={() => {
                setTheme(theme === 'high-contrast' ? 'default' : 'high-contrast')
                touch()
              }}
              className={`w-full min-h-[48px] rounded-xl font-bold ${
                theme === 'high-contrast' ? 'bg-el-blue text-white' : 'bg-el-darker text-el-light'
              }`}
            >
              {theme === 'high-contrast' ? 'ON' : 'OFF'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
