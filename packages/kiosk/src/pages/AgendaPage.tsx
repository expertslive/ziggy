import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { useAgenda, useEventConfig } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { SessionCard } from '../components/SessionCard';
import { useClockTick } from '../lib/clock';
import type { AgendaSession, AgendaDay } from '../lib/api';

interface DayTab {
  date: string;
  label: string;
  timeslots: AgendaDay['timeslots'];
}

function formatDayLabel(dateStr: string, language: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Determine the initial day tab index: pick the tab whose date matches today
 * (in the event timezone), or fall back to 0.
 */
function getInitialDayIndex(days: DayTab[], timezone: string): number {
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: timezone }); // "2026-06-02"
  const idx = days.findIndex((d) => d.date === todayStr);
  return idx >= 0 ? idx : 0;
}

export function AgendaPage() {
  const { t } = useTranslation();
  const language = useKioskStore((s) => s.language);
  const touch = useKioskStore((s) => s.touch);
  const { data: agenda, isLoading: agendaLoading } = useAgenda();
  const { data: config } = useEventConfig();
  const selectedDayIndex = useKioskStore((s) => s.selectedDayIndex);
  const setSelectedDayIndex = useKioskStore((s) => s.setSelectedDayIndex);
  const openSessionId = useKioskStore((s) => s.openSessionId);
  const openSession = useKioskStore((s) => s.openSession);
  const agendaLabelFilter = useKioskStore((s) => s.agendaLabelFilter);
  const toggleLabelFilter = useKioskStore((s) => s.toggleLabelFilter);
  const clearLabelFilter = useKioskStore((s) => s.clearLabelFilter);
  const now = useClockTick(30_000);

  // Build the list of day tabs by merging event config days with agenda data.
  // The event config defines which days exist and their labels (e.g. "Workshops", "Sessions").
  // The agenda data provides the actual timeslots/sessions for each day.
  const days = useMemo<DayTab[]>(() => {
    // Build a lookup of agenda data by date
    const agendaByDate = new Map<string, AgendaDay>();
    if (agenda) {
      for (const day of agenda.days) {
        agendaByDate.set(day.date, day);
      }
    }

    // If the event config defines days, use those as the authoritative list
    if (config?.days && config.days.length > 0) {
      return config.days.map((configDay) => {
        const agendaDay = agendaByDate.get(configDay.date);
        return {
          date: configDay.date,
          label: configDay.label[language] || configDay.label[config.defaultLanguage] || formatDayLabel(configDay.date, language),
          timeslots: agendaDay?.timeslots ?? [],
        };
      });
    }

    // Fallback: use whatever days are in the agenda data
    if (agenda) {
      return agenda.days.map((day) => ({
        date: day.date,
        label: formatDayLabel(day.date, language),
        timeslots: day.timeslots,
      }));
    }

    return [];
  }, [agenda, config, language]);

  // Resolve the active tab index: use explicit selection, or auto-select today's tab
  const timezone = config?.timezone || agenda?.timeZone || 'Europe/Amsterdam';
  const activeDayIndex = selectedDayIndex ?? getInitialDayIndex(days, timezone);

  // Lookup the selected session from its id across all timeslots on all days
  const selectedSession = useMemo<AgendaSession | null>(() => {
    if (openSessionId == null) return null;
    for (const day of days) {
      for (const ts of day.timeslots) {
        const found = ts.sessions.find((s) => s.id === openSessionId);
        if (found) return found;
      }
    }
    return null;
  }, [openSessionId, days]);

  if (agendaLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (days.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      </PageContainer>
    );
  }

  const currentDay = days[activeDayIndex] ?? days[0];

  const labels = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const slot of currentDay.timeslots) {
      for (const s of slot.sessions) {
        for (const l of s.labels) {
          if (!map.has(l.name)) map.set(l.name, { name: l.name, color: l.color });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [currentDay]);

  const filteredTimeslots = useMemo(() => {
    if (agendaLabelFilter.length === 0) return currentDay.timeslots;
    return currentDay.timeslots
      .map((slot) => ({
        ...slot,
        sessions: slot.sessions.filter((s) =>
          s.labels.some((l) => agendaLabelFilter.includes(l.name)),
        ),
      }))
      .filter((slot) => slot.sessions.length > 0);
  }, [currentDay, agendaLabelFilter]);

  const timeslotRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  const liveTimeslot = useMemo(() => {
    return filteredTimeslots.find((slot) =>
      slot.sessions.some((s) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return now >= start && now < end;
      }),
    );
  }, [filteredTimeslots, now]);

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: timezone });
  const showJumpToNow = currentDay.date === todayStr && !!liveTimeslot;

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
                index === activeDayIndex
                  ? 'bg-el-blue text-white'
                  : 'bg-el-gray text-el-light/70 active:bg-el-gray-light'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {/* Label filter chips */}
      {labels.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {labels.map((l) => {
            const active = agendaLabelFilter.includes(l.name);
            const color = l.color || '#3b82f6';
            return (
              <button
                key={l.name}
                onClick={() => {
                  toggleLabelFilter(l.name);
                  touch();
                }}
                className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: active ? color : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${color}`,
                }}
              >
                {l.name}
              </button>
            );
          })}
          {agendaLabelFilter.length > 0 && (
            <button
              onClick={() => {
                clearLabelFilter();
                touch();
              }}
              className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-el-gray text-el-light/80"
            >
              {t('agenda.filter.clear')}
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {filteredTimeslots.length > 0 ? (
        <div className="space-y-6">
          {filteredTimeslots.map((timeslot) => (
            <div
              key={timeslot.startTimeGroup}
              ref={(el) => {
                timeslotRefs.current.set(timeslot.startTimeGroup, el);
              }}
            >
              {/* Time header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-lg font-bold text-el-blue">
                  {timeslot.startTimeGroup}
                </span>
                <span className="text-sm text-el-light/40">&mdash;</span>
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
                    now={now}
                    onTap={() => {
                      openSession(session.id);
                      touch();
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className="text-el-light/60 text-lg">{t('agenda.noSessions')}</p>
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => openSession(null)}
        />
      )}

      {showJumpToNow && liveTimeslot && (
        <button
          className="fixed bottom-24 right-6 bg-el-blue text-white rounded-full px-5 py-3 shadow-lg font-bold active:scale-95 transition-transform z-20"
          onClick={() => {
            timeslotRefs.current
              .get(liveTimeslot.startTimeGroup)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            touch();
          }}
        >
          {t('agenda.jumpToNow')} ↓
        </button>
      )}
    </PageContainer>
  );
}
