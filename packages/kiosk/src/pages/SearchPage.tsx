import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';

export function SearchPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-4">
        {t('search.title')}
      </h1>
      <p className="text-el-light/60 text-lg">
        {t('search.placeholder')}
      </p>
    </PageContainer>
  );
}
