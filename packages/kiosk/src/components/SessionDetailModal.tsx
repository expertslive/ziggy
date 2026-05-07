import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../store/kiosk';
import { useFloorMaps, useSponsors } from '../lib/hooks';
import { useNavigateKeepingSearch } from '../lib/nav';
import { cleanSessionTitle } from '../lib/title';
import type { AgendaSession, Sponsor } from '../lib/api';

/** Find the sponsor that owns a sponsor session, by matching speaker.company
 * against sponsor names (bidirectional substring after normalising). Returns
 * the sponsor record if (a) the session is labelled "Sponsor" and (b) one of
 * the speakers' companies maps to a sponsor with a floor-map hotspot. */
function findSessionSponsor(
  session: AgendaSession,
  sponsors: Sponsor[] | undefined,
): Sponsor | null {
  if (!sponsors || sponsors.length === 0) return null;
  if (!session.labels.some((l) => l.name === 'Sponsor')) return null;
  const norm = (s: string | null | undefined) =>
    (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const sp of session.speakers) {
    const c = norm(sp.company);
    if (!c) continue;
    // Exact match wins
    let hit = sponsors.find((s) => norm(s.name) === c);
    if (hit) return hit;
    // Bidirectional substring (handles "Recast" ↔ "Recast Software",
    // "Silverside B.V." ↔ "Silverside")
    hit = sponsors.find((s) => {
      const sn = norm(s.name);
      return sn.length > 2 && (c.includes(sn) || sn.includes(c));
    });
    if (hit) return hit;
  }
  return null;
}

interface SessionDetailModalProps {
  session: AgendaSession;
  onClose: () => void;
}

export function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigateKeepingSearch();
  const touch = useKioskStore((s) => s.touch);
  const setSelectedMap = useKioskStore((s) => s.setSelectedMap);
  const { data: floorMaps } = useFloorMaps();
  const { data: sponsors } = useSponsors();
  const visibleLabels = session.labels.filter((l) => l.showInElement);

  const matchingMap = (floorMaps ?? []).find((m) =>
    m.hotspots?.some((h) => h.roomGuid === session.roomGuid),
  );
  const matchingHotspot = matchingMap?.hotspots.find(
    (h) => h.roomGuid === session.roomGuid,
  );

  // For sponsor sessions: find the sponsor + their booth on the floor map.
  const sessionSponsor = findSessionSponsor(session, sponsors);
  const sponsorMap =
    sessionSponsor && sessionSponsor.floorMapHotspotId
      ? (floorMaps ?? []).find((m) =>
          m.hotspots?.some((h) => h.id === sessionSponsor.floorMapHotspotId),
        )
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={() => {
        onClose();
        touch();
      }}
    >
      <div
        className="relative w-full max-h-[90dvh] bg-el-dark rounded-t-3xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating close (defense-in-depth, always reachable on mobile) */}
        <button
          onClick={() => {
            onClose();
            touch();
          }}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-el-gray/80 backdrop-blur text-el-light text-xl active:bg-el-gray"
        >
          &#x2715;
        </button>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-el-light/20" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-el-gray">
          <div className="pr-12">
            <h2 className="text-xl font-extrabold text-el-light leading-tight">
              {cleanSessionTitle(session.title)}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-el-light/60">
              <span>
                {session.startTimeGroup} — {session.endDate.substring(11, 16)}
              </span>
              <span className="text-el-light/30">|</span>
              <span>&#x1F4CD; {session.roomName}</span>
            </div>
            {(matchingMap || sponsorMap) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {matchingMap && matchingHotspot && (
                  <button
                    onClick={() => {
                      setSelectedMap(matchingMap.id, matchingHotspot.id);
                      onClose();
                      navigate('/map');
                      touch();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-el-blue/20 text-el-blue text-xs font-bold active:bg-el-blue/30"
                  >
                    &#x1F5FA; {t('map.showOnMap')}
                  </button>
                )}
                {sponsorMap && sessionSponsor?.floorMapHotspotId && (
                  <button
                    onClick={() => {
                      setSelectedMap(sponsorMap.id, sessionSponsor.floorMapHotspotId!);
                      onClose();
                      navigate('/map');
                      touch();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-el-blue/20 text-el-blue text-xs font-bold active:bg-el-blue/30"
                  >
                    &#x1F4CD;{' '}
                    {t('map.showOnMapBooth', {
                      booth: sessionSponsor.boothNumber || sessionSponsor.name,
                      defaultValue: 'Booth {{booth}} on map',
                    })}
                  </button>
                )}
              </div>
            )}
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
                {session.speakers.map((speaker) => {
                  const isMvp = speaker.labels?.some((l) => l.name === 'Microsoft MVP');
                  return (
                  <div key={speaker.id} className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0">
                      <div className="w-full h-full rounded-full bg-el-gray-light overflow-hidden">
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
                      {isMvp && (
                        <img
                          src="https://cdn.run.events/label-badge-images/1bc5962c-e222-4bb3-bfab-add778c970d7"
                          alt="Microsoft MVP"
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white p-px shadow"
                        />
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
                  );
                })}
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
    </div>,
    document.body,
  );
}
