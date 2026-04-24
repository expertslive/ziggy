import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
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
  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-6">{t('info.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t('info.wifi.title')} wide>
          <div className="text-el-light/70 text-sm mb-1">SSID</div>
          <div className="text-3xl font-extrabold text-el-light mb-3 select-text">
            {t('info.wifi.ssid')}
          </div>
          <div className="text-el-light/70 text-sm mb-1">Password</div>
          <div className="text-3xl font-extrabold text-el-light select-text">
            {t('info.wifi.password')}
          </div>
        </Card>
        <Card title={t('info.venue.title')}>
          <div className="text-el-light font-bold">{t('info.venue.name')}</div>
          <div className="text-el-light/70 whitespace-pre-line mt-1">
            {t('info.venue.address')}
          </div>
        </Card>
        <Card title={t('info.schedule.title')}>
          <ul className="text-el-light/90 space-y-1">
            <li>{t('info.schedule.doorsOpen')}</li>
            <li>{t('info.schedule.lunch')}</li>
            <li>{t('info.schedule.drinks')}</li>
          </ul>
        </Card>
        <Card title={t('info.emergency.title')}>
          <div className="text-el-light">{t('info.emergency.location')}</div>
          <div className="text-el-light/70 mt-1">{t('info.emergency.phone')}</div>
        </Card>
        <Card title={t('info.facilities.title')}>
          <div className="text-el-light">{t('info.facilities.toilets')}</div>
          <div className="text-el-light mt-1">{t('info.facilities.cloakroom')}</div>
        </Card>
        <Card title={t('info.contact.title')}>
          <div className="text-el-light font-bold">{t('info.contact.name')}</div>
          <div className="text-el-light/70 mt-1">{t('info.contact.email')}</div>
          <div className="text-el-light/70">{t('info.contact.phone')}</div>
        </Card>
      </div>
    </PageContainer>
  )
}
