import { useTranslation } from 'react-i18next';
import type { AgendaSession } from '../lib/api';

interface SessionCardProps {
  session: AgendaSession;
  now?: Date;
  /** When set, overrides the client-side time check. Used by /now where the
   * API has already decided a session is live or past — re-deriving on the
   * client risks browser timezone vs override (UTC) parsing mismatches. */
  forceState?: 'live' | 'past';
  onTap: () => void;
}

export function SessionCard({ session, now, forceState, onTap }: SessionCardProps) {
  const { t } = useTranslation();
  const visibleLabels = session.labels.filter((l) => l.showInElement);

  const current = now ?? new Date();
  const start = new Date(session.startDate);
  const end = new Date(session.endDate);
  const isLive = forceState === 'live' || (forceState === undefined && current >= start && current < end);
  const isPast = forceState === 'past' || (forceState === undefined && current >= end);

  return (
    <button
      onClick={onTap}
      className={`relative w-full text-left bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform ${
        isPast ? 'opacity-40' : ''
      }`}
    >
      {isLive && (
        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
          {t('session.live')}
        </span>
      )}

      <h3 className="text-base font-bold text-el-light leading-tight mb-2 line-clamp-2">
        {session.title}
      </h3>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs text-el-light/50">&#x1F4CD;</span>
        <span className="text-sm text-el-light/60">{session.roomName}</span>
      </div>

      {visibleLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-block text-xs rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: label.color + '30', color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {session.speakers.length > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex -space-x-2">
            {session.speakers.slice(0, 3).map((speaker) => (
              <div
                key={speaker.id}
                className="w-7 h-7 rounded-full bg-el-gray-light border-2 border-el-gray overflow-hidden"
              >
                {speaker.image ? (
                  <img
                    src={speaker.image}
                    alt={speaker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-el-light/60">
                    {speaker.name[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-el-light/50 truncate">
            {session.speakers.map((s) => s.name).join(', ')}
          </span>
        </div>
      )}

      <div className="text-xs text-el-light/40 mt-2">
        {session.startTimeGroup} — {session.endDate.substring(11, 16)}
      </div>
    </button>
  );
}
