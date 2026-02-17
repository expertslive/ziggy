import type { AgendaSession } from '../lib/api';

interface SessionCardProps {
  session: AgendaSession;
  onTap: () => void;
}

export function SessionCard({ session, onTap }: SessionCardProps) {
  const visibleLabels = session.labels.filter((l) => l.showInElement);

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
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
