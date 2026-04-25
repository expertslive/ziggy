import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useKioskStore } from '../store/kiosk'

interface LanguageSwitcherProps {
  languages: string[]
}

export function LanguageSwitcher({ languages }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const setLanguage = useKioskStore((s) => s.setLanguage)
  const touch = useKioskStore((s) => s.touch)
  const [open, setOpen] = useState(false)

  const change = (lang: string) => {
    i18n.changeLanguage(lang)
    setLanguage(lang)
    touch()
    setOpen(false)
  }

  return (
    <>
      {/* Inline pills — kiosk only (sm+) */}
      <div className="hidden sm:flex items-center gap-2">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => change(lang)}
            className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
              i18n.language === lang
                ? 'bg-el-blue text-white'
                : 'bg-el-gray text-el-light active:bg-el-gray-light'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Popover trigger — iPhone only */}
      <div className="relative sm:hidden">
        <button
          aria-label={t('a11y.languagePicker', 'Language picker')}
          onClick={() => { setOpen((v) => !v); touch() }}
          className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center rounded-xl bg-el-blue text-white text-sm font-bold"
        >
          {i18n.language.toUpperCase()} <span className="ml-1 text-xs">▾</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div role="menu" className="absolute right-0 top-12 z-50 bg-el-gray rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[120px]">
              {languages.map((lang) => (
                <button
                  key={lang}
                  role="menuitem"
                  onClick={() => change(lang)}
                  className={`min-h-[44px] px-4 rounded-xl text-left text-sm font-bold ${
                    i18n.language === lang
                      ? 'bg-el-blue text-white'
                      : 'bg-el-darker text-el-light active:bg-el-gray-light'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
