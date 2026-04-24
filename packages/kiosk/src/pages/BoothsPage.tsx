import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { BoothCard } from '../components/BoothCard';
import { BoothDetailModal } from '../components/BoothDetailModal';
import { useBooths } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { Booth } from '../lib/api';

export function BoothsPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const openBoothId = useKioskStore((s) => s.openBoothId);
  const openBooth = useKioskStore((s) => s.openBooth);
  const { data: booths, isLoading, error } = useBooths();

  const selectedBooth = useMemo<Booth | null>(() => {
    if (openBoothId == null || !booths) return null;
    return booths.find((b) => b.id === openBoothId) ?? null;
  }, [openBoothId, booths]);

  if (isLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('booths.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !booths) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('booths.title')}</h1>
        <p className="text-el-red text-lg">{t('common.error')}</p>
      </PageContainer>
    );
  }

  if (booths.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('booths.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('booths.noBooths')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-2">{t('booths.title')}</h1>
      <p className="text-el-light/40 text-sm mb-4">
        {t('booths.count', { count: booths.length })}
      </p>

      <div className="space-y-3">
        {booths.map((booth) => (
          <BoothCard
            key={booth.id}
            booth={booth}
            onTap={() => {
              openBooth(booth.id);
              touch();
            }}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedBooth && (
          <BoothDetailModal
            booth={selectedBooth}
            onClose={() => openBooth(null)}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
