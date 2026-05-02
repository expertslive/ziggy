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

/** Duration-based visual classification.
 * - 'plenary' = keynote / closing-note → white stripe
 * - 'long' = regular 50-min breakout → blue stripe
 * - 'short' = 20-min breakout → no stripe, ghost "20m" badge
 * - 'noncontent' = lunch / break / drinks → no stripe, no badge */
function classifySession(session: AgendaSession): 'plenary' | 'long' | 'short' | 'noncontent' {
  const hasContent = session.speakers.length > 0 || session.labels.length > 0;
  if (!hasContent) return 'noncontent';
  const isPlenary = session.labels.some(
    (l) => l.name === 'Keynote' || l.name === 'Closing note',
  );
  if (isPlenary) return 'plenary';
  const start = new Date(session.startDate).getTime();
  const end = new Date(session.endDate).getTime();
  const minutes = (end - start) / 60000;
  return minutes <= 25 ? 'short' : 'long';
}

export function SessionCard({ session, now, forceState, onTap }: SessionCardProps) {
  const { t } = useTranslation();
  const visibleLabels = session.labels.filter((l) => l.showInElement);
  const kind = classifySession(session);

  const current = now ?? new Date();
  const start = new Date(session.startDate);
  const end = new Date(session.endDate);
  const isLive = forceState === 'live' || (forceState === undefined && current >= start && current < end);
  const isPast = forceState === 'past' || (forceState === undefined && current >= end);

  const stripeColor =
    kind === 'plenary' ? '#F5F5F5' : kind === 'long' ? '#0082C8' : null;

  return (
    <button
      onClick={onTap}
      className={`relative w-full text-left bg-el-gray rounded-xl p-4 overflow-hidden active:scale-[0.98] transition-transform ${
        isPast ? 'opacity-40' : ''
      }`}
    >
      {stripeColor && (
        <span
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{ width: '2px', background: stripeColor }}
          aria-hidden
        />
      )}
      {kind === 'short' && (
        <span
          className="absolute bottom-3 right-3 rounded-full font-bold text-[11px] flex items-center justify-center bg-transparent text-el-blue ring-1 ring-el-blue/60"
          style={{ width: '36px', height: '36px' }}
          aria-label={t('session.shortDuration', { defaultValue: '20 minute session' })}
        >
          20m
        </span>
      )}
      {isLive && (
        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
          {t('session.live')}
        </span>
      )}

      <h3 className="text-base font-bold text-el-light leading-tight mb-2 line-clamp-2 pr-12">
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
