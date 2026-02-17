import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';
import type { AgendaSession } from '../lib/api';

interface SessionDetailModalProps {
  session: AgendaSession;
  onClose: () => void;
}

export function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const visibleLabels = session.labels.filter((l) => l.showInElement);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={() => {
        onClose();
        touch();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-el-dark rounded-t-2xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-el-gray">
          <div className="flex-1 mr-4">
            <h2 className="text-xl font-extrabold text-el-light leading-tight">
              {session.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-el-light/60">
              <span>
                {session.startTimeGroup} — {session.endDate.substring(11, 16)}
              </span>
              <span className="text-el-light/30">|</span>
              <span>&#x1F4CD; {session.roomName}</span>
            </div>
            {visibleLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
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
          </div>
          <button
            onClick={() => {
              onClose();
              touch();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-el-gray text-el-light active:bg-el-gray-light"
          >
            &#x2715;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="scrollable p-6 space-y-5">
          {/* Speakers */}
          {session.speakers.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                {t('speakers.title')}
              </h3>
              <div className="space-y-3">
                {session.speakers.map((speaker) => (
                  <div key={speaker.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-el-gray-light overflow-hidden shrink-0">
                      {speaker.image ? (
                        <img
                          src={speaker.image}
                          alt={speaker.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg text-el-light/60">
                          {speaker.name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-base font-bold text-el-light">{speaker.name}</p>
                      {speaker.tagline && (
                        <p className="text-sm text-el-light/50">{speaker.tagline}</p>
                      )}
                      {speaker.company && (
                        <p className="text-xs text-el-light/40">{speaker.company}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div>
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-2">
                {t('agenda.description')}
              </h3>
              <p className="text-base text-el-light/80 leading-relaxed whitespace-pre-line">
                {session.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
