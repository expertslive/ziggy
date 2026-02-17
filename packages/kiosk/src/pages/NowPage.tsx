import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { useNowSessions } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { AgendaSession } from '../lib/api';

function useTimeRemaining(session: AgendaSession): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const endMs = new Date(session.endDate).getTime();
  const diffMs = endMs - now;

  if (diffMs <= 0) return '0 min';

  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMinutes} min`;
}

function TimeRemainingBadge({ session }: { session: AgendaSession }) {
  const { t } = useTranslation();
  const remaining = useTimeRemaining(session);

  return (
    <span className="inline-block text-xs font-bold rounded-full px-3 py-1 bg-el-red/20 text-el-red">
      {t('now.timeRemaining', { minutes: remaining })}
    </span>
  );
}

function NextSessionTime({ sessions }: { sessions: AgendaSession[] }) {
  const { t } = useTranslation();
  const language = useKioskStore((s) => s.language);

  const nextTime = useMemo(() => {
    if (sessions.length === 0) return null;
    // Find the earliest start time from up-next sessions
    const earliest = sessions.reduce((min, s) => {
      const t = new Date(s.startDate).getTime();
      return t < min ? t : min;
    }, Infinity);
    if (!isFinite(earliest)) return null;
    const d = new Date(earliest);
    return d.toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [sessions, language]);

  if (!nextTime) {
    return (
      <p className="text-el-light/60 text-lg">{t('now.noSessions')}</p>
    );
  }

  return (
    <p className="text-el-light/60 text-lg">
      {t('now.noSessionsNextAt', { time: nextTime })}
    </p>
  );
}

export function NowPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data, isLoading, error } = useNowSessions();
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-2">{t('now.title')}</h1>
        <p className="text-el-light/60 text-lg mb-6">{t('now.subtitle')}</p>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-2">{t('now.title')}</h1>
        <p className="text-el-red text-lg">{t('common.error')}</p>
      </PageContainer>
    );
  }

  const { current, upNext } = data;
  const hasCurrentSessions = current.length > 0;
  const hasUpNext = upNext.length > 0;

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-2">{t('now.title')}</h1>
      <p className="text-el-light/60 text-lg mb-6">{t('now.subtitle')}</p>

      {/* Current sessions */}
      {hasCurrentSessions ? (
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {current.map((session) => (
              <div key={session.id} className="space-y-2">
                <SessionCard
                  session={session}
                  onTap={() => {
                    setSelectedSession(session);
                    touch();
                  }}
                />
                <div className="px-1">
                  <TimeRemainingBadge session={session} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 py-12 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4 opacity-40">&#x1F4AD;</div>
          <NextSessionTime sessions={upNext} />
        </div>
      )}

      {/* Up Next */}
      {hasUpNext && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-el-light">{t('now.upNext')}</h2>
            <div className="flex-1 h-px bg-el-gray-light" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upNext.map((session) => (
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
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </PageContainer>
  );
}
