import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { SpeakerDetailModal } from '../components/SpeakerDetailModal';
import { useSpeakers } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { Speaker } from '../lib/api';

export function SpeakersPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data: speakers, isLoading, error } = useSpeakers();
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  // Sort speakers A-Z by name
  const sortedSpeakers = useMemo(() => {
    if (!speakers) return [];
    return [...speakers].sort((a, b) => a.name.localeCompare(b.name));
  }, [speakers]);

  if (isLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('speakers.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !speakers) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('speakers.title')}</h1>
        <p className="text-el-red text-lg">{t('common.error')}</p>
      </PageContainer>
    );
  }

  if (sortedSpeakers.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('speakers.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-2">{t('speakers.title')}</h1>
      <p className="text-el-light/40 text-sm mb-6">
        {t('speakers.sortedAZ', { count: sortedSpeakers.length })}
      </p>

      {/* Speaker grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedSpeakers.map((speaker) => (
          <button
            key={speaker.uniqueId}
            onClick={() => {
              setSelectedSpeaker(speaker);
              touch();
            }}
            className="flex flex-col items-center text-center bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-20 h-20 rounded-full bg-el-gray-light overflow-hidden mb-3 shrink-0">
              {speaker.image ? (
                <img
                  src={speaker.image}
                  alt={speaker.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-el-light/60">
                  {speaker.name[0]}
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-el-light leading-tight line-clamp-2">
              {speaker.name}
            </p>
            {speaker.tagline && (
              <p className="text-xs text-el-light/50 mt-1 line-clamp-2">{speaker.tagline}</p>
            )}
            {speaker.company && (
              <p className="text-xs text-el-light/40 mt-0.5 truncate w-full">
                {speaker.company}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Speaker detail modal */}
      {selectedSpeaker && (
        <SpeakerDetailModal
          speaker={selectedSpeaker}
          onClose={() => setSelectedSpeaker(null)}
        />
      )}
    </PageContainer>
  );
}
