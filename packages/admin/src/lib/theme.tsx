import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'ziggy-admin-theme'

interface Ctx {
  pref: ThemePref
  resolved: 'light' | 'dark'
  setPref: (p: ThemePref) => void
}

const ThemeCtx = createContext<Ctx | null>(null)

function readPref(): ThemePref {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'system'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyToHtml(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  // Track system preference changes — only matters when pref === 'system'.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved: 'light' | 'dark' =
    pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    applyToHtml(resolved)
  }, [resolved])

  function setPref(p: ThemePref) {
    setPrefState(p)
    try {
      window.localStorage.setItem(STORAGE_KEY, p)
    } catch {
      // localStorage disabled — current session still applies the choice
    }
  }

  return (
    <ThemeCtx.Provider value={{ pref, resolved, setPref }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
