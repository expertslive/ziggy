import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { SpeakerCard } from '../components/SpeakerCard';
import { SpeakerDetailModal } from '../components/SpeakerDetailModal';
import { useSpeakers } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { Speaker } from '../lib/api';

export function SpeakersPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const openSpeakerId = useKioskStore((s) => s.openSpeakerId);
  const openSpeaker = useKioskStore((s) => s.openSpeaker);
  const { data: speakers, isLoading } = useSpeakers();

  // Sort speakers A-Z by name
  const sortedSpeakers = useMemo(() => {
    if (!speakers) return [];
    return [...speakers].sort((a, b) => a.name.localeCompare(b.name));
  }, [speakers]);

  const selectedSpeaker = useMemo<Speaker | null>(() => {
    if (openSpeakerId == null || !speakers) return null;
    return speakers.find((s) => s.id === openSpeakerId) ?? null;
  }, [openSpeakerId, speakers]);

  if (isLoading || !speakers) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('speakers.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (sortedSpeakers.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('speakers.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-2">{t('speakers.title')}</h1>
      <p className="text-el-light/40 text-sm mb-6">
        {t('speakers.sortedAZ', { count: sortedSpeakers.length })}
      </p>

      {/* Speaker grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedSpeakers.map((speaker) => (
          <SpeakerCard
            key={speaker.id}
            speaker={speaker}
            onTap={() => {
              openSpeaker(speaker.id);
              touch();
            }}
          />
        ))}
      </div>

      {/* Speaker detail modal */}
      {selectedSpeaker && (
        <SpeakerDetailModal
          speaker={selectedSpeaker}
          onClose={() => openSpeaker(null)}
        />
      )}
    </PageContainer>
  );
}
