import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components/PageContainer';
import { useFloorMaps, useNowSessions } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { FloorMap, AgendaSession } from '../lib/api';

interface HotspotInfo {
  id: string;
  roomName: string;
  label: Record<string, string>;
}

function RoomDetailModal({
  hotspot,
  currentSessions,
  upcomingSessions,
  onClose,
}: {
  hotspot: HotspotInfo;
  currentSessions: AgendaSession[];
  upcomingSessions: AgendaSession[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const lang = i18n.language;
  const roomLabel = hotspot.label[lang] || hotspot.label['en'] || hotspot.roomName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={() => {
        onClose();
        touch();
      }}
    >
      <div
        className="w-full max-h-[60vh] bg-el-dark rounded-t-3xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-el-light/20" />
        </div>

        {/* Content */}
        <div className="scrollable px-6 pb-6">
          <h2 className="text-xl font-extrabold text-el-light mb-4">{roomLabel}</h2>

          {/* Current sessions */}
          {currentSessions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                {t('map.currentSessions')}
              </h3>
              <div className="space-y-3">
                {currentSessions.map((session) => (
                  <SessionMiniCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming sessions */}
          {upcomingSessions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                {t('map.upcomingSessions')}
              </h3>
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <SessionMiniCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {/* No sessions at all */}
          {currentSessions.length === 0 && upcomingSessions.length === 0 && (
            <p className="text-el-light/50 text-base">
              {t('map.noCurrentSessions')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionMiniCard({ session }: { session: AgendaSession }) {
  return (
    <div className="bg-el-gray rounded-xl p-4">
      <h4 className="text-base font-bold text-el-light leading-tight mb-1 line-clamp-2">
        {session.title}
      </h4>
      <div className="text-xs text-el-light/40 mb-1">
        {session.startTimeGroup} &mdash; {session.endDate.substring(11, 16)}
      </div>
      {session.speakers.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex -space-x-2">
            {session.speakers.slice(0, 3).map((speaker) => (
              <div
                key={speaker.id}
                className="w-6 h-6 rounded-full bg-el-gray-light border-2 border-el-gray overflow-hidden"
              >
                {speaker.image ? (
                  <img
                    src={speaker.image}
                    alt={speaker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-el-light/60">
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
    </div>
  );
}

function FloorMapViewer({
  map,
  nowData,
}: {
  map: FloorMap;
  nowData: { current: AgendaSession[]; upNext: AgendaSession[] } | undefined;
}) {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);

  const currentSessions = nowData?.current ?? [];
  const upcomingSessions = nowData?.upNext ?? [];

  const currentForRoom = selectedHotspot
    ? currentSessions.filter((s) => s.roomName === selectedHotspot.roomName)
    : [];
  const upcomingForRoom = selectedHotspot
    ? upcomingSessions.filter((s) => s.roomName === selectedHotspot.roomName)
    : [];

  function handleHotspotTap(hotspot: HotspotInfo) {
    setSelectedHotspot(hotspot);
    touch();
  }

  return (
    <>
      <p className="text-el-light/40 text-sm mb-3">{t('map.tapRoom')}</p>

      <div
        className="relative w-full"
        style={imgSize ? { aspectRatio: `${imgSize.w}/${imgSize.h}` } : undefined}
      >
        <img
          src={map.imageUrl}
          alt={map.name}
          className="w-full h-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
        {imgSize && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            {map.hotspots.map((hotspot) => (
              <polygon
                key={hotspot.id}
                points={hotspot.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="rgba(227, 6, 19, 0.25)"
                stroke="#E30613"
                strokeWidth="0.003"
                className="cursor-pointer"
                onClick={() => handleHotspotTap(hotspot)}
              />
            ))}
          </svg>
        )}
      </div>

      {selectedHotspot && (
        <RoomDetailModal
          hotspot={selectedHotspot}
          currentSessions={currentForRoom}
          upcomingSessions={upcomingForRoom}
          onClose={() => setSelectedHotspot(null)}
        />
      )}
    </>
  );
}

export function MapPage() {
  const { t, i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const lang = i18n.language;
  const { data: maps, isLoading, error } = useFloorMaps();
  const { data: nowData } = useNowSessions();
  const [activeMapIndex, setActiveMapIndex] = useState(0);

  if (isLoading) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">
          {t('map.title')}
        </h1>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-el-light/60 text-lg">
            {t('common.loading')}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !maps) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">
          {t('map.title')}
        </h1>
        <p className="text-el-red text-lg">{t('common.error')}</p>
      </PageContainer>
    );
  }

  if (maps.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-extrabold text-el-light mb-4">
          {t('map.title')}
        </h1>
        <p className="text-el-light/60 text-lg">{t('map.noMaps')}</p>
      </PageContainer>
    );
  }

  // Use maps in API order (sortOrder handled server-side)
  const sortedMaps = maps;
  const activeMap = sortedMaps[activeMapIndex] ?? sortedMaps[0];

  return (
    <PageContainer>
      <h1 className="text-3xl font-extrabold text-el-light mb-4">
        {t('map.title')}
      </h1>

      {/* Map tabs (only shown if multiple maps) */}
      {sortedMaps.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {sortedMaps.map((map, index) => {
            const isActive = index === activeMapIndex;
            const mapLabel = map.label[lang] || map.label['en'] || map.name;
            return (
              <button
                key={map.id}
                onClick={() => {
                  setActiveMapIndex(index);
                  touch();
                }}
                className={`shrink-0 px-5 py-3 rounded-xl text-base font-bold transition-colors active:scale-[0.98] ${
                  isActive
                    ? 'bg-el-red text-el-light'
                    : 'bg-el-gray text-el-light/60'
                }`}
              >
                {mapLabel}
              </button>
            );
          })}
        </div>
      )}

      <FloorMapViewer
        key={activeMap.id}
        map={activeMap}
        nowData={nowData}
      />
    </PageContainer>
  );
}
