import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { useBooths } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { Booth } from '../lib/api';

function BoothCard({ booth, onTap }: { booth: Booth; onTap: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onTap}
      className="w-full bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 active:bg-white/20 transition-colors text-left"
    >
      {booth.logoUrl ? (
        <img
          src={booth.logoUrl}
          alt={booth.name}
          className="w-16 h-16 rounded-xl object-contain bg-white/5 shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-el-gray flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-el-light/40">
            {booth.name[0]}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-el-light truncate">{booth.name}</h3>
        {booth.organization && booth.organization !== booth.name && (
          <p className="text-sm text-el-light/50 truncate">{booth.organization}</p>
        )}
        {booth.boothNumber && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-el-blue/20 text-el-blue text-xs font-semibold">
            {booth.boothNumber}
          </span>
        )}
      </div>
      <svg className="w-5 h-5 text-el-light/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </motion.button>
  );
}

function BoothDetailModal({ booth, onClose }: { booth: Booth; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-el-dark rounded-t-3xl w-full max-w-2xl max-h-[80vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

        <div className="flex flex-col items-center gap-4">
          {booth.logoUrl && (
            <img
              src={booth.logoUrl}
              alt={booth.name}
              className="h-20 max-w-full object-contain"
            />
          )}
          <h2 className="text-2xl font-bold text-el-light">{booth.name}</h2>

          {booth.organization && booth.organization !== booth.name && (
            <p className="text-el-light/50 text-sm">{booth.organization}</p>
          )}

          {booth.boothNumber && (
            <span className="px-3 py-1 rounded-full bg-el-blue/20 text-el-blue text-sm font-semibold">
              {t('booths.boothNumber', { number: booth.boothNumber })}
            </span>
          )}

          {booth.location && (
            <p className="text-el-light/60 text-sm">{booth.location}</p>
          )}

          {booth.description && (
            <p className="text-el-light/70 text-base leading-relaxed text-center">
              {booth.description}
            </p>
          )}

          {booth.website && (
            <p className="text-el-light/50 text-sm">{booth.website}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20 transition-colors"
        >
          {t('common.back')}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function BoothsPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data: booths, isLoading, error } = useBooths();
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

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
              setSelectedBooth(booth);
              touch();
            }}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedBooth && (
          <BoothDetailModal
            booth={selectedBooth}
            onClose={() => setSelectedBooth(null)}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
