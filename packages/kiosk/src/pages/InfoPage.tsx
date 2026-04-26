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
              <div className="text-3xl font-extrabold text-el-light select-text">
                {password}
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
          <ul className="text-el-light/90 space-y-1">
            <li>{t('info.times.doorsOpen')}</li>
            <li>{t('info.times.lunch')}</li>
            <li>{t('info.times.drinks')}</li>
          </ul>
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
