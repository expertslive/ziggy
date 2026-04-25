import type { Speaker } from '../lib/api'

interface SpeakerCardProps {
  speaker: Speaker
  onTap: () => void
}

export function SpeakerCard({ speaker, onTap }: SpeakerCardProps) {
  const isMvp = speaker.labels?.some((l) => l.name === 'Microsoft MVP')
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center text-center bg-el-gray rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-el-gray-light overflow-visible mb-3 shrink-0">
        <div className="w-full h-full rounded-full overflow-hidden">
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
        {isMvp && (
          <img
            src="https://cdn.run.events/label-badge-images/1bc5962c-e222-4bb3-bfab-add778c970d7"
            alt="Microsoft MVP"
            className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white p-0.5 shadow-md"
          />
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
