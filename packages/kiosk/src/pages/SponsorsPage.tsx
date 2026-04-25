import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { useSponsors, useSponsorTiers, useFloorMaps } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { Sponsor } from '../lib/api';

function SponsorCard({
  sponsor,
  size,
  onTap,
}: {
  sponsor: Sponsor;
  size: 'large' | 'medium' | 'small';
  onTap: () => void;
}) {
  const sizeClasses = {
    large: 'w-full sm:w-1/2 p-3',
    medium: 'w-1/2 sm:w-1/3 p-2',
    small: 'w-1/3 sm:w-1/4 p-2',
  };
  const aspectBox = size === 'small' ? 'aspect-[2/1]' : 'aspect-[3/2]';

  return (
    <div className={sizeClasses[size]}>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onTap}
        className="w-full bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 active:bg-el-light transition-colors"
      >
        <div className={`${aspectBox} w-full flex items-center justify-center px-2`}>
          {sponsor.logoUrl ? (
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-lg font-bold text-el-dark/40">{sponsor.name}</span>
          )}
        </div>
        {size !== 'small' && (
          <span className="text-el-dark/80 text-sm font-semibold truncate w-full text-center">
            {sponsor.name}
          </span>
        )}
      </motion.button>
    </div>
  );
}

function SponsorDetailModal({
  sponsor,
  onClose,
}: {
  sponsor: Sponsor;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSelectedMap = useKioskStore((s) => s.setSelectedMap);
  const { data: floorMaps } = useFloorMaps();
  const lang = i18n.language;
  const description =
    sponsor.description[lang] || sponsor.description['en'] || '';

  const matchingMap = (floorMaps ?? []).find((m) =>
    m.hotspots?.some((h) => h.id === sponsor.floorMapHotspotId),
  );

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
          {sponsor.logoUrl && (
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="h-24 max-w-full object-contain"
            />
          )}
          <h2 className="text-2xl font-bold text-el-light">{sponsor.name}</h2>

          {sponsor.boothNumber && (
            <span className="px-3 py-1 rounded-full bg-el-blue/20 text-el-blue text-sm font-semibold">
              Booth {sponsor.boothNumber}
            </span>
          )}

          {matchingMap && sponsor.floorMapHotspotId && (
            <button
              onClick={() => {
                setSelectedMap(matchingMap.id, sponsor.floorMapHotspotId!);
                onClose();
                navigate('/map');
              }}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-el-blue text-white text-sm font-bold active:bg-el-blue/80"
            >
              &#x1F5FA; {t('map.showOnMap')}
            </button>
          )}

          {description && (
            <p className="text-el-light/70 text-base leading-relaxed text-center">
              {description}
            </p>
          )}

          {sponsor.website && (
            <p className="text-el-light/50 text-sm">{sponsor.website}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

export function SponsorsPage() {
  const { t, i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data: sponsors, isLoading: sponsorsLoading } = useSponsors();
  const { data: tiers, isLoading: tiersLoading } = useSponsorTiers();
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const isLoading = sponsorsLoading || tiersLoading;
  const lang = i18n.language;

  // Sort tiers by sortOrder
  const sortedTiers = [...(tiers || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  // Group sponsors by tier
  const sponsorsByTier = new Map<string, Sponsor[]>();
  for (const sponsor of [...(sponsors || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )) {
    const list = sponsorsByTier.get(sponsor.tierId) || [];
    list.push(sponsor);
    sponsorsByTier.set(sponsor.tierId, list);
  }

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-6">
        {t('sponsors.title')}
      </h1>

      {/* Tier filter chips */}
      {!isLoading && sortedTiers.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setSelectedTierId(null);
              touch();
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              selectedTierId === null
                ? 'bg-el-blue text-white'
                : 'bg-el-gray text-el-light/70 active:bg-el-gray-light'
            }`}
          >
            {t('sponsors.filterAll')}
          </button>
          {sortedTiers.map((tier) => {
            const active = selectedTierId === tier.id;
            const label = tier.label[lang] || tier.label['en'] || tier.name;
            return (
              <button
                key={tier.id}
                onClick={() => {
                  setSelectedTierId(active ? null : tier.id);
                  touch();
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-el-blue text-white'
                    : 'bg-el-gray text-el-light/70 active:bg-el-gray-light'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {isLoading && (
        <p className="text-el-light/60 text-lg">{t('common.loading')}</p>
      )}

      {!isLoading && (!sponsors || sponsors.length === 0) && (
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      )}

      {!isLoading &&
        sortedTiers.map((tier) => {
          if (selectedTierId !== null && tier.id !== selectedTierId) return null;
          const tierSponsors = sponsorsByTier.get(tier.id);
          if (!tierSponsors || tierSponsors.length === 0) return null;

          return (
            <div key={tier.id} className="mb-8">
              <h2 className="text-xl font-bold text-el-light/80 mb-3">
                {tier.label[lang] || tier.label['en'] || tier.name}
              </h2>
              <div className="flex flex-wrap -mx-2">
                {tierSponsors.map((sponsor) => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    size={tier.displaySize}
                    onTap={() => setSelectedSponsor(sponsor)}
                  />
                ))}
              </div>
            </div>
          );
        })}

      <AnimatePresence>
        {selectedSponsor && (
          <SponsorDetailModal
            sponsor={selectedSponsor}
            onClose={() => setSelectedSponsor(null)}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
