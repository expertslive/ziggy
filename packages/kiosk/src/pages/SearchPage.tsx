import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { useSearch } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { AgendaSession } from '../lib/api';

export function SearchPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearch(query);
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);

  const handleKeyPress = (key: string) => {
    setQuery((prev) => prev + key);
  };

  const handleBackspace = () => {
    setQuery((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setQuery('');
  };

  const showMinChars = query.length > 0 && query.length < 4;
  const showResults = query.length >= 4;
  const hasResults = results && results.length > 0;

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
              className="w-8 h-8 flex items-center justify-center rounded-full bg-el-gray-light text-el-light/60 active:bg-el-red active:text-white text-sm"
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>

      {/* Results area (scrollable, fills available space) */}
      <div className="flex-1 min-h-0 scrollable px-6 py-3">
        {showMinChars && (
          <p className="text-el-light/50 text-sm">{t('search.minChars')}</p>
        )}

        {showResults && isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-el-light/60">{t('common.loading')}</div>
          </div>
        )}

        {showResults && !isLoading && !hasResults && (
          <p className="text-el-light/50 text-sm">{t('common.noResults')}</p>
        )}

        {showResults && hasResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onTap={() => {
                  setSelectedSession(session);
                  touch();
                }}
              />
            ))}
          </div>
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

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
