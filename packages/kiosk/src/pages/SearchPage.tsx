import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { SpeakerCard } from '../components/SpeakerCard';
import { SpeakerDetailModal } from '../components/SpeakerDetailModal';
import { BoothCard } from '../components/BoothCard';
import { BoothDetailModal } from '../components/BoothDetailModal';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { useSearch, useSpeakers, useBooths } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { AgendaSession, Speaker, Booth } from '../lib/api';

const INITIAL_LIMIT = 6;

export function SearchPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const query = useKioskStore((s) => s.searchQuery);
  const setQuery = useKioskStore((s) => s.setSearchQuery);
  const openSessionId = useKioskStore((s) => s.openSessionId);
  const openSession = useKioskStore((s) => s.openSession);
  const openSpeakerId = useKioskStore((s) => s.openSpeakerId);
  const openSpeaker = useKioskStore((s) => s.openSpeaker);
  const openBoothId = useKioskStore((s) => s.openBoothId);
  const openBooth = useKioskStore((s) => s.openBooth);

  const sessionsQ = useSearch(query);
  const speakersQ = useSpeakers();
  const boothsQ = useBooths();

  const [expandSessions, setExpandSessions] = useState(false);
  const [expandSpeakers, setExpandSpeakers] = useState(false);
  const [expandBooths, setExpandBooths] = useState(false);

  const q = query.trim().toLowerCase();

  const speakers = useMemo<Speaker[]>(() => {
    if (!q || !speakersQ.data) return [];
    return speakersQ.data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.company?.toLowerCase().includes(q) ||
        s.tagline?.toLowerCase().includes(q),
    );
  }, [speakersQ.data, q]);

  const booths = useMemo<Booth[]>(() => {
    if (!q || !boothsQ.data) return [];
    return boothsQ.data.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.organization?.toLowerCase().includes(q) ||
        b.boothNumber?.toLowerCase().includes(q),
    );
  }, [boothsQ.data, q]);

  const sessions: AgendaSession[] = sessionsQ.data ?? [];
  const hasAny = sessions.length > 0 || speakers.length > 0 || booths.length > 0;
  const showKeepTyping =
    q.length > 0 && q.length < 4 && speakers.length === 0 && booths.length === 0;

  const selectedSession = useMemo<AgendaSession | null>(() => {
    if (openSessionId == null) return null;
    return sessions.find((s) => s.id === openSessionId) ?? null;
  }, [openSessionId, sessions]);

  const selectedSpeaker = useMemo<Speaker | null>(() => {
    if (openSpeakerId == null || !speakersQ.data) return null;
    return speakersQ.data.find((s) => s.uniqueId === openSpeakerId) ?? null;
  }, [openSpeakerId, speakersQ.data]);

  const selectedBooth = useMemo<Booth | null>(() => {
    if (openBoothId == null || !boothsQ.data) return null;
    return boothsQ.data.find((b) => b.id === openBoothId) ?? null;
  }, [openBoothId, boothsQ.data]);

  const resetExpansion = () => {
    setExpandSessions(false);
    setExpandSpeakers(false);
    setExpandBooths(false);
  };

  const handleKeyPress = (key: string) => {
    setQuery(query + key);
    resetExpansion();
  };

  const handleBackspace = () => {
    setQuery(query.slice(0, -1));
  };

  const handleClear = () => {
    setQuery('');
    resetExpansion();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input area */}
      <div className="px-6 pt-6 pb-3 shrink-0">
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('search.title')}</h1>
        <div className="flex items-center gap-3 bg-el-gray rounded-xl px-4 py-3">
          <span className="text-el-light/40 text-lg">&#x1F50D;</span>
          <div className="flex-1 text-base text-el-light min-h-[24px]">
            {query || (
              <span className="text-el-light/30">{t('search.placeholder')}</span>
            )}
          </div>
          {query.length > 0 && (
            <button
              onClick={() => {
                handleClear();
                touch();
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-el-gray-light text-el-light/60 active:bg-el-blue active:text-white text-sm"
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>

      {/* Results area (scrollable, fills available space) */}
      <div className="flex-1 min-h-0 scrollable px-6 py-3 space-y-6">
        {showKeepTyping && (
          <p className="text-el-light/50 text-sm">{t('search.keepTyping')}</p>
        )}

        {q.length > 0 && !hasAny && !showKeepTyping && (
          <p className="text-el-light/50 text-sm">{t('common.noResults')}</p>
        )}

        {sessions.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-el-light mb-3">
              {t('search.sectionSessions')} ({sessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sessions
                .slice(0, expandSessions ? sessions.length : INITIAL_LIMIT)
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onTap={() => {
                      openSession(session.id);
                      touch();
                    }}
                  />
                ))}
            </div>
            {sessions.length > INITIAL_LIMIT && !expandSessions && (
              <button
                className="mt-3 text-el-blue font-bold"
                onClick={() => {
                  setExpandSessions(true);
                  touch();
                }}
              >
                {t('search.showAll', { count: sessions.length })}
              </button>
            )}
          </section>
        )}

        {speakers.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-el-light mb-3">
              {t('search.sectionSpeakers')} ({speakers.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {speakers
                .slice(0, expandSpeakers ? speakers.length : INITIAL_LIMIT)
                .map((speaker) => (
                  <SpeakerCard
                    key={speaker.uniqueId}
                    speaker={speaker}
                    onTap={() => {
                      openSpeaker(speaker.uniqueId);
                      touch();
                    }}
                  />
                ))}
            </div>
            {speakers.length > INITIAL_LIMIT && !expandSpeakers && (
              <button
                className="mt-3 text-el-blue font-bold"
                onClick={() => {
                  setExpandSpeakers(true);
                  touch();
                }}
              >
                {t('search.showAll', { count: speakers.length })}
              </button>
            )}
          </section>
        )}

        {booths.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-el-light mb-3">
              {t('search.sectionBooths')} ({booths.length})
            </h2>
            <div className="space-y-3">
              {booths
                .slice(0, expandBooths ? booths.length : INITIAL_LIMIT)
                .map((booth) => (
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
            {booths.length > INITIAL_LIMIT && !expandBooths && (
              <button
                className="mt-3 text-el-blue font-bold"
                onClick={() => {
                  setExpandBooths(true);
                  touch();
                }}
              >
                {t('search.showAll', { count: booths.length })}
              </button>
            )}
          </section>
        )}
      </div>

      {/* Virtual keyboard (pinned to bottom) */}
      <div className="shrink-0">
        <VirtualKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onClear={handleClear}
        />
      </div>

      {/* Modals */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => openSession(null)}
        />
      )}
      {selectedSpeaker && (
        <SpeakerDetailModal
          speaker={selectedSpeaker}
          onClose={() => openSpeaker(null)}
        />
      )}
      <AnimatePresence>
        {selectedBooth && (
          <BoothDetailModal
            booth={selectedBooth}
            onClose={() => openBooth(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
