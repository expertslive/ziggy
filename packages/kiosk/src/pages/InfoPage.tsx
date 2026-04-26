import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PageContainer } from '../components/PageContainer'

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
        <Card title={t('info.questions.title')}>
          <p className="text-el-light/80 leading-relaxed">{t('info.questions.body')}</p>
          <hr className="my-3 border-el-light/10" />
          <p className="italic text-el-light/60 text-sm">{t('info.questions.emergency')}</p>
        </Card>
      </div>
    </PageContainer>
  )
}
