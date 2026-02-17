import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { useAgenda } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { SessionCard } from '../components/SessionCard';
import type { AgendaSession } from '../lib/api';

function formatDayLabel(dateStr: string, language: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function AgendaPage() {
  const { t } = useTranslation();
  const language = useKioskStore((s) => s.language);
  const touch = useKioskStore((s) => s.touch);
  const { data: agenda, isLoading, error } = useAgenda();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !agenda) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <p className="text-el-red text-lg">{t('common.error')}</p>
      </PageContainer>
    );
  }

  const days = agenda.days;
  if (days.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      </PageContainer>
    );
  }

  const currentDay = days[selectedDayIndex] ?? days[0];

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>

      {/* Day tabs */}
      {days.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {days.map((day, index) => (
            <button
              key={day.date}
              onClick={() => {
                setSelectedDayIndex(index);
                touch();
              }}
              className={`px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                index === selectedDayIndex
                  ? 'bg-el-blue text-white'
                  : 'bg-el-gray text-el-light/70 active:bg-el-gray-light'
              }`}
            >
              {formatDayLabel(day.date, language)}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-6">
        {currentDay.timeslots.map((timeslot) => (
          <div key={timeslot.startTimeGroup}>
            {/* Time header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg font-bold text-el-blue">
                {timeslot.startTimeGroup}
              </span>
              <span className="text-sm text-el-light/40">—</span>
              <span className="text-sm text-el-light/40">
                {timeslot.endDate.substring(11, 16)}
              </span>
              <div className="flex-1 h-px bg-el-gray-light" />
            </div>

            {/* Session cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {timeslot.sessions.map((session) => (
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
        ))}
      </div>

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
