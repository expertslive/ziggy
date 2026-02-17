import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';
import type { Session } from '../lib/api';

interface SessionDetailModalProps {
  session: Session;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);

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
                {formatTime(session.startsAt)} — {formatTime(session.endsAt)}
              </span>
              {session.room && (
                <>
                  <span className="text-el-light/30">|</span>
                  <span>&#x1F4CD; {session.room}</span>
                </>
              )}
            </div>
            {session.track && (
              <span className="inline-block text-xs bg-el-red/20 text-el-red rounded-full px-2.5 py-0.5 mt-2">
                {session.track}
              </span>
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
          {session.speakers && session.speakers.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                {t('speakers.title')}
              </h3>
              <div className="space-y-3">
                {session.speakers.map((speaker) => (
                  <div key={speaker.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-el-gray-light overflow-hidden shrink-0">
                      {speaker.profilePicture ? (
                        <img
                          src={speaker.profilePicture}
                          alt={speaker.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg text-el-light/60">
                          {speaker.firstName[0]}
                          {speaker.lastName[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-base font-bold text-el-light">{speaker.fullName}</p>
                      {speaker.tagline && (
                        <p className="text-sm text-el-light/50">{speaker.tagline}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description / Abstract */}
          {(session.description || session.abstract) && (
            <div>
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-2">
                {t('agenda.description', 'Description')}
              </h3>
              <p className="text-base text-el-light/80 leading-relaxed whitespace-pre-line">
                {session.description || session.abstract}
              </p>
            </div>
          )}

          {/* Labels */}
          {session.labels && session.labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {session.labels.map((label) => (
                <span
                  key={label}
                  className="text-xs bg-el-gray text-el-light/60 rounded-full px-3 py-1"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
