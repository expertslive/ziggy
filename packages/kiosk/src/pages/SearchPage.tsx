import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { SpeakerCard } from '../components/SpeakerCard';
import { SpeakerDetailModal } from '../components/SpeakerDetailModal';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { useSearch, useSpeakers } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { AgendaSession, Speaker } from '../lib/api';

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

  const sessionsQ = useSearch(query);
  const speakersQ = useSpeakers();

  const inputRef = useRef<HTMLInputElement>(null);

  const [expandSessions, setExpandSessions] = useState(false);
  const [expandSpeakers, setExpandSpeakers] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState<boolean>(false);
  const [focused, setFocused] = useState(false);
  const [showHint, setShowHint] = useState(false);

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

  const sessions: AgendaSession[] = sessionsQ.data ?? [];
  const hasAny = sessions.length > 0 || speakers.length > 0;
  const showKeepTyping =
    q.length > 0 && q.length < 4 && speakers.length === 0;

  // Auto-collapse virtual keyboard after 4s of no typing IF results are showing.
  useEffect(() => {
    if (!keyboardOpen) return;
    if (!hasAny) return;
    const timer = setTimeout(() => {
      setKeyboardOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }, 4000);
    return () => clearTimeout(timer);
  }, [query, hasAny, keyboardOpen]);

  // Discoverability hint: show after 2s of focus on empty query, while keyboard is closed.
  useEffect(() => {
    if (!focused || query.length > 0 || keyboardOpen) {
      setShowHint(false);
      return;
    }
    const timer = setTimeout(() => setShowHint(true), 2000);
    return () => clearTimeout(timer);
  }, [focused, query, keyboardOpen]);

  const selectedSession = useMemo<AgendaSession | null>(() => {
    if (openSessionId == null) return null;
    return sessions.find((s) => s.id === openSessionId) ?? null;
  }, [openSessionId, sessions]);

  const selectedSpeaker = useMemo<Speaker | null>(() => {
    if (openSpeakerId == null || !speakersQ.data) return null;
    return speakersQ.data.find((s) => s.id === openSpeakerId) ?? null;
  }, [openSpeakerId, speakersQ.data]);

  const resetExpansion = () => {
    setExpandSessions(false);
    setExpandSpeakers(false);
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('search.title')}</h1>
        <div className="flex items-center gap-3 bg-el-gray rounded-xl px-4 py-3">
          <span className="text-el-light/40 text-lg">&#x1F50D;</span>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetExpansion(); touch() }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-base text-el-light placeholder:text-el-light/30 outline-none min-h-[24px]"
          />
          <button
            onClick={() => {
              const next = !keyboardOpen;
              setKeyboardOpen(next);
              touch();
              if (next) {
                inputRef.current?.blur();
              } else {
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
            aria-label={t('search.toggleKeyboard')}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
              keyboardOpen
                ? 'bg-el-blue text-white'
                : 'bg-el-gray text-el-light/60 active:bg-el-gray-light'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
            </svg>
          </button>
          {query.length > 0 && (
            <button
              onClick={() => {
                handleClear();
                touch();
              }}
              aria-label="Clear"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-el-gray-light text-el-light/60 active:bg-el-blue active:text-white text-sm"
            >
              &#x2715;
            </button>
          )}
        </div>
        {showHint && (
          <p className="text-el-light/50 text-sm mt-2">{t('search.keyboardHint')}</p>
        )}
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
                    key={speaker.id}
                    speaker={speaker}
                    onTap={() => {
                      openSpeaker(speaker.id);
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

      </div>

      {/* Virtual keyboard (collapsible) */}
      {keyboardOpen && (
        <div className="shrink-0">
          <button
            onClick={() => {
              setKeyboardOpen(false);
              setTimeout(() => inputRef.current?.focus(), 0);
              touch();
            }}
            aria-label={t('search.closeKeyboard')}
            className="w-full bg-el-dark border-t border-el-gray py-2 text-el-light/60 active:bg-el-gray text-xs font-semibold"
          >
            &#x2715; {t('search.closeKeyboard')}
          </button>
          <VirtualKeyboard
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
          />
        </div>
      )}

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
    </div>
  );
}
