import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';

export function NowPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-4">
        {t('now.title')}
      </h1>
      <p className="text-el-light/60 text-lg">
        {t('now.subtitle')}
      </p>
    </PageContainer>
  );
}
