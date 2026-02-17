import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { useSponsors, useSponsorTiers } from '../lib/hooks';
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

  const imgHeight = {
    large: 'h-32',
    medium: 'h-24',
    small: 'h-16',
  };

  return (
    <div className={sizeClasses[size]}>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onTap}
        className="w-full bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:bg-white/20 transition-colors"
      >
        {sponsor.logoUrl ? (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className={`${imgHeight[size]} w-full object-contain`}
          />
        ) : (
          <div
            className={`${imgHeight[size]} w-full flex items-center justify-center text-el-light/40`}
          >
            <span className="text-lg font-bold">{sponsor.name}</span>
          </div>
        )}
        {size !== 'small' && (
          <span className="text-el-light/80 text-sm font-semibold truncate w-full text-center">
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
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const description =
    sponsor.description[lang] || sponsor.description['en'] || '';

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
            <span className="px-3 py-1 rounded-full bg-el-red/20 text-el-red text-sm font-semibold">
              Booth {sponsor.boothNumber}
            </span>
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
  const { data: sponsors, isLoading: sponsorsLoading } = useSponsors();
  const { data: tiers, isLoading: tiersLoading } = useSponsorTiers();
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

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

      {isLoading && (
        <p className="text-el-light/60 text-lg">{t('common.loading')}</p>
      )}

      {!isLoading && (!sponsors || sponsors.length === 0) && (
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      )}

      {!isLoading &&
        sortedTiers.map((tier) => {
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
