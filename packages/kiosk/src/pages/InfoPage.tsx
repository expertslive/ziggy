import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PageContainer } from '../components/PageContainer'
import { findKioskEntry, getKioskId, setKioskId } from '../lib/kiosks'

function Card({
  title,
  wide = false,
  children,
}: {
  title: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={`bg-el-gray rounded-2xl p-6 ${wide ? 'md:col-span-2' : ''}`}>
      <h2 className="text-lg font-bold text-el-blue mb-3">{title}</h2>
      {children}
    </div>
  )
}

export function InfoPage() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const ssid = t('info.wifi.ssid')
  const password = t('info.wifi.password')
  const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`
  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-6">{t('info.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t('info.wifi.title')} wide>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="text-el-light/70 text-sm mb-1">SSID</div>
              <div className="text-3xl font-extrabold text-el-light mb-3 select-text">
                {ssid}
              </div>
              <div className="text-el-light/70 text-sm mb-1">Password</div>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-extrabold text-el-light select-text">
                  {password}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(password)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    } catch {
                      // clipboard API unavailable — silent fallback
                    }
                  }}
                  aria-label={t('info.wifi.copyPassword')}
                  title={copied ? t('info.wifi.copied') : t('info.wifi.copyPassword')}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-el-gray text-el-light active:bg-el-gray-light"
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-el-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 self-center md:self-auto shrink-0">
              <QRCodeSVG
                value={wifiString}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin
              />
            </div>
          </div>
        </Card>
        <Card title={t('info.times.title')}>
          <div className="space-y-4 text-el-light/80">
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.times.morning.heading')}</h3>
              <ul className="text-sm space-y-0.5">
                <li>{t('info.times.morning.registration')}</li>
                <li>{t('info.times.morning.firstBreakout')}</li>
                <li>{t('info.times.morning.keynote')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.times.afternoon.heading')}</h3>
              <ul className="text-sm space-y-0.5">
                <li>{t('info.times.afternoon.morningBreakouts')}</li>
                <li>{t('info.times.afternoon.lunch')}</li>
                <li>{t('info.times.afternoon.afternoonBreakouts')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.times.evening.heading')}</h3>
              <ul className="text-sm space-y-0.5">
                <li>{t('info.times.evening.prizeShow')}</li>
                <li>{t('info.times.evening.closing')}</li>
                <li>{t('info.times.evening.drinks')}</li>
              </ul>
            </div>
          </div>
        </Card>
        <Card title={t('info.travel.title')}>
          <div className="space-y-4 text-el-light/80">
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.travel.publicTransport.heading')}</h3>
              <p className="text-sm">{t('info.travel.publicTransport.intro')}</p>
              <ul className="text-sm list-disc list-inside ml-1 mt-1 space-y-0.5">
                <li>{t('info.travel.publicTransport.lineToUtrecht')}</li>
                <li>{t('info.travel.publicTransport.lineToWestraven')}</li>
              </ul>
              <p className="text-sm mt-1 text-el-light/60">{t('info.travel.publicTransport.frequency')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.travel.car.heading')}</h3>
              <ul className="text-sm list-disc list-inside ml-1 space-y-0.5">
                <li>{t('info.travel.car.shuttle')}</li>
                <li>{t('info.travel.car.parking')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-el-light mb-1">{t('info.travel.farewell.heading')}</h3>
              <p className="text-sm">{t('info.travel.farewell.body')}</p>
            </div>
          </div>
        </Card>
        <Card title={t('info.access.title')}>
          <ul className="space-y-2 text-el-light/80 text-sm leading-relaxed list-disc list-inside ml-1">
            <li>{t('info.access.halls')}</li>
            <li>{t('info.access.captions')}</li>
            <li>{t('info.access.feeding')}</li>
            <li>{t('info.access.help')}</li>
          </ul>
        </Card>
        <Card title={t('info.radio.title')}>
          <p className="text-el-light/80 leading-relaxed mb-3">{t('info.radio.body')}</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-el-gray text-el-light text-sm font-bold select-text">
            <svg className="w-4 h-4 text-el-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            radio.expertslive.nl
          </div>
        </Card>
        <Card title={t('info.questions.title')} wide>
          <p className="text-el-light/80 leading-relaxed">{t('info.questions.body')}</p>
          <hr className="my-3 border-el-light/10" />
          <p className="italic text-el-light/60 text-sm">{t('info.questions.emergency')}</p>
        </Card>
      </div>
      <DeviceInfo />
    </PageContainer>
  )
}

/** Subtle row at the bottom of /info showing whether this device is paired
 * to a kiosk location (with a green status dot when active) and a reset
 * link for the volunteer who picked the wrong one. */
function DeviceInfo() {
  const [id, setId] = useState<string | null>(typeof window !== 'undefined' ? getKioskId() : null)
  // Re-read on mount in case localStorage was changed elsewhere this session.
  useEffect(() => {
    setId(getKioskId())
  }, [])
  const entry = findKioskEntry(id)
  const paired = !!id

  function handleReset() {
    // Skip the browser-native confirm() — on the PixioDisplay's embedded
    // browser the dialog renders without its OK/Cancel buttons, leaving
    // staff with no way out. The pair overlay itself has a "Niet pairen"
    // escape hatch so this isn't actually destructive.
    setKioskId(null)
    const url = new URL(window.location.href)
    url.searchParams.set('pair', '1')
    window.location.href = url.toString()
  }

  return (
    <div className="mt-10 pt-6 border-t border-el-gray flex items-center justify-between text-xs text-el-light/40">
      <div className="flex items-center gap-2">
        {paired && (
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]"
            aria-label="Tracking actief"
            title="Tracking actief"
          />
        )}
        <span>
          Apparaat:{' '}
          {paired ? (
            <span className="text-el-light/70 font-semibold">{entry?.label || id}</span>
          ) : (
            <span className="italic">niet ingesteld</span>
          )}
        </span>
      </div>
      <button
        onClick={handleReset}
        className="text-el-light/30 hover:text-el-light/60 underline-offset-2 hover:underline"
      >
        {paired ? 'Apparaat opnieuw instellen' : 'Apparaat instellen'}
      </button>
    </div>
  )
}
