import type { Session } from '../lib/api';

interface SessionCardProps {
  session: Session;
  onTap: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SessionCard({ session, onTap }: SessionCardProps) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
      <h3 className="text-base font-bold text-el-light leading-tight mb-2 line-clamp-2">
        {session.title}
      </h3>

      {session.room && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-el-light/50">&#x1F4CD;</span>
          <span className="text-sm text-el-light/60">{session.room}</span>
        </div>
      )}

      {session.track && (
        <span className="inline-block text-xs bg-el-red/20 text-el-red rounded-full px-2.5 py-0.5 mb-2">
          {session.track}
        </span>
      )}

      {session.speakers && session.speakers.length > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex -space-x-2">
            {session.speakers.slice(0, 3).map((speaker) => (
              <div
                key={speaker.id}
                className="w-7 h-7 rounded-full bg-el-gray-light border-2 border-el-gray overflow-hidden"
              >
                {speaker.profilePicture ? (
                  <img
                    src={speaker.profilePicture}
                    alt={speaker.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-el-light/60">
                    {speaker.firstName[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-el-light/50 truncate">
            {session.speakers.map((s) => s.fullName).join(', ')}
          </span>
        </div>
      )}

      <div className="text-xs text-el-light/40 mt-2">
        {formatTime(session.startsAt)} — {formatTime(session.endsAt)}
      </div>
    </button>
  );
}
