import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'nl',
    fallbackLng: 'en',
    resources: { nl: { translation: {} }, en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
}

function renderSwitcher(languages: string[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSwitcher languages={languages} />
    </I18nextProvider>,
  )
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    i18n.changeLanguage('nl')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all 4 language buttons in the inline kiosk variant', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    // Each language is rendered twice (kiosk pills + popover items), so getAllByText
    expect(screen.getAllByText('NL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('EN').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('DE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('FR').length).toBeGreaterThanOrEqual(1)
  })

  it('mobile trigger has language-picker aria-label', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    expect(screen.getByLabelText(/language picker/i)).toBeInTheDocument()
  })

  it('opens popover when mobile trigger is tapped', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByLabelText(/language picker/i))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes popover after picking a language', () => {
    renderSwitcher(['nl', 'en', 'de', 'fr'])
    fireEvent.click(screen.getByLabelText(/language picker/i))
    const menu = screen.getByRole('menu')
    const enItem = within(menu).getByRole('menuitem', { name: /^EN$/ })
    fireEvent.click(enItem)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
