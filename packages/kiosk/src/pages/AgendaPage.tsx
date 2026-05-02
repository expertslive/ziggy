import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { useAgenda, useEventConfig } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { SessionCard } from '../components/SessionCard';
import { useClockTick, getSimulatedNow } from '../lib/clock';
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
  const override = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('now')
    : null
  const now = getSimulatedNow(override)
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: timezone })
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

  // currentDay can be undefined while data loads or when days is empty.
  // ALL hooks must run unconditionally (Rules of Hooks) — handle undefined inside each hook.
  const currentDay = days[activeDayIndex] ?? days[0];

  const labels = useMemo(() => {
    if (!currentDay) return [];
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

  const filteredSessions = useMemo<AgendaSession[]>(() => {
    if (!currentDay) return [];
    const flat: AgendaSession[] = [];
    for (const slot of currentDay.timeslots) flat.push(...slot.sessions);
    if (agendaLabelFilter.length === 0) return flat;
    return flat.filter((s) =>
      s.labels.some((l) => agendaLabelFilter.includes(l.name)),
    );
  }, [currentDay, agendaLabelFilter]);

  /** Group by start-time. The API returns ISO-like strings without a TZ offset
   * ("2026-06-02T07:15:00") representing event-local time, so we substring HH:MM
   * directly — using `new Date()` would parse as the *device's* local TZ which
   * is wrong for kiosks/iPads not set to Europe/Amsterdam. Within each group:
   * keynote/closing first, then 50-min breakouts, then 20-min, then NonContent. */
  const startTimeGroups = useMemo(() => {
    function classify(s: AgendaSession): number {
      const hasContent = s.speakers.length > 0 || s.labels.length > 0;
      if (!hasContent) return 3; // noncontent
      const isPlenary = s.labels.some((l) => {
        const n = l.name?.trim().toLowerCase() ?? '';
        return n === 'keynote' || n === 'closing note' || n === 'closing-note';
      });
      if (isPlenary) return 0;
      // Duration: end-time minutes - start-time minutes (within same day),
      // independent of TZ. Strings are "YYYY-MM-DDTHH:MM:SS".
      const startMin = parseInt(s.startDate.substring(11, 13), 10) * 60 + parseInt(s.startDate.substring(14, 16), 10);
      const endMin = parseInt(s.endDate.substring(11, 13), 10) * 60 + parseInt(s.endDate.substring(14, 16), 10);
      const dur = endMin - startMin;
      return dur <= 25 ? 2 : 1;
    }
    const map = new Map<string, AgendaSession[]>();
    for (const s of filteredSessions) {
      const key = s.startDate.substring(11, 16); // "HH:MM" in event-local time
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, arr] of groups) arr.sort((a, b) => classify(a) - classify(b));
    return groups;
  }, [filteredSessions]);

  const groupRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  const liveStartTime = useMemo(() => {
    const live = startTimeGroups.find(([, sessions]) =>
      sessions.some((s) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return now >= start && now < end;
      }),
    );
    return live ? live[0] : null;
  }, [startTimeGroups, now]);

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: timezone });
  const showJumpToNow = currentDay?.date === todayStr && !!liveStartTime;

  // Conditional renders AFTER all hooks have run.
  if (agendaLoading) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">{t('common.loading')}</div>
        </div>
      </PageContainer>
    );
  }

  if (days.length === 0 || !currentDay) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>
        <p className="text-el-light/60 text-lg">{t('common.noResults')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('agenda.title')}</h1>

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

      {/* Timeline — grouped by start-time, kop = werkelijke start-tijd */}
      {startTimeGroups.length > 0 ? (
        <div className="space-y-6">
          {startTimeGroups.map(([startTime, sessions]) => (
            <div
              key={startTime}
              ref={(el) => {
                groupRefs.current.set(startTime, el);
              }}
            >
              <h3 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-3 tracking-tight">
                {startTime}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sessions.map((session) => (
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

      {showJumpToNow && liveStartTime && (
        <button
          className="fixed bottom-20 right-4 px-4 py-2 sm:bottom-24 sm:right-6 sm:px-5 sm:py-3 bg-el-blue text-white rounded-full shadow-lg font-bold active:scale-95 transition-transform z-20"
          onClick={() => {
            groupRefs.current
              .get(liveStartTime)
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
