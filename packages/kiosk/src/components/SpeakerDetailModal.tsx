import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';
import { useAgenda } from '../lib/hooks';
import { SessionCard } from './SessionCard';
import { SessionDetailModal } from './SessionDetailModal';
import type { Speaker } from '../lib/api';
import type { AgendaSession } from '../lib/api';

interface SpeakerDetailModalProps {
  speaker: Speaker;
  onClose: () => void;
}

export function SpeakerDetailModal({ speaker, onClose }: SpeakerDetailModalProps) {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data: agenda } = useAgenda();
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);

  // Find sessions this speaker is part of
  const speakerSessions: AgendaSession[] = [];
  if (agenda) {
    for (const day of agenda.days) {
      for (const timeslot of day.timeslots) {
        for (const session of timeslot.sessions) {
          if (session.speakers.some((s) => s.id === speaker.id)) {
            speakerSessions.push(session);
          }
        }
      }
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
        onClick={() => {
          onClose();
          touch();
        }}
      >
        <div
          className="w-full max-w-2xl max-h-[85vh] bg-el-dark rounded-t-2xl overflow-hidden flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-5 p-6 pb-4 border-b border-el-gray">
            <div className="w-24 h-24 rounded-full bg-el-gray-light overflow-hidden shrink-0">
              {speaker.image ? (
                <img
                  src={speaker.image}
                  alt={speaker.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-el-light/60">
                  {speaker.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-el-light leading-tight">
                {speaker.name}
              </h2>
              {speaker.tagline && (
                <p className="text-sm text-el-light/60 mt-1">{speaker.tagline}</p>
              )}
              {speaker.company && (
                <p className="text-sm text-el-light/40 mt-0.5">{speaker.company}</p>
              )}
            </div>
            <button
              onClick={() => {
                onClose();
                touch();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-el-gray text-el-light active:bg-el-gray-light shrink-0"
            >
              &#x2715;
            </button>
          </div>

          {/* Scrollable content */}
          <div className="scrollable p-6 space-y-5">
            {/* Biography */}
            {speaker.biography && (
              <div>
                <p className="text-base text-el-light/80 leading-relaxed whitespace-pre-line">
                  {speaker.biography}
                </p>
              </div>
            )}

            {/* Sessions */}
            {speakerSessions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                  {t('speakers.sessions')}
                </h3>
                <div className="space-y-3">
                  {speakerSessions.map((session) => (
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
          </div>
        </div>
      </div>

      {/* Session detail modal (on top of speaker modal) */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </>
  );
}
