import type { Speaker } from '../lib/api'

interface SpeakerCardProps {
  speaker: Speaker
  onTap: () => void
}

export function SpeakerCard({ speaker, onTap }: SpeakerCardProps) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center text-center bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
      <div className="w-24 h-24 rounded-full bg-el-gray-light overflow-hidden mb-3 shrink-0">
        {speaker.image ? (
          <img
            src={speaker.image}
            alt={speaker.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-el-light/60">
            {speaker.name[0]}
          </div>
        )}
      </div>
      <p className="text-sm font-bold text-el-light leading-tight line-clamp-2">
        {speaker.name}
      </p>
      {speaker.tagline && (
        <p className="text-xs text-el-light/50 mt-1 line-clamp-2">{speaker.tagline}</p>
      )}
      {speaker.company && (
        <p className="text-xs text-el-light/40 mt-0.5 truncate w-full">
          {speaker.company}
        </p>
      )}
    </button>
  )
}
