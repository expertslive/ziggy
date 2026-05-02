import { useMemo, useState } from 'react';
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
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Sort speakers by name in chosen direction
  const sortedSpeakers = useMemo(() => {
    if (!speakers) return [];
    const arr = [...speakers].sort((a, b) => a.name.localeCompare(b.name));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [speakers, sortDir]);

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
      <div className="flex items-center justify-between mb-6 gap-3">
        <p className="text-el-light/40 text-sm">
          {t('speakers.count', { count: sortedSpeakers.length, defaultValue: '{{count}} speakers' })}
        </p>
        <div className="inline-flex rounded-full bg-el-gray p-0.5 shrink-0" role="group" aria-label="Sort speakers">
          <button
            onClick={() => { setSortDir('asc'); touch(); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
              sortDir === 'asc' ? 'bg-el-blue text-white' : 'text-el-light/60 active:bg-el-gray-light'
            }`}
            aria-pressed={sortDir === 'asc'}
          >
            A–Z
          </button>
          <button
            onClick={() => { setSortDir('desc'); touch(); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
              sortDir === 'desc' ? 'bg-el-blue text-white' : 'text-el-light/60 active:bg-el-gray-light'
            }`}
            aria-pressed={sortDir === 'desc'}
          >
            Z–A
          </button>
        </div>
      </div>

      {/* Speaker grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
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
