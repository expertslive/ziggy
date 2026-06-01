import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigateKeepingSearch } from '../lib/nav';
import { PageContainer } from '../components/PageContainer';
import { useFloorMaps, useNowSessions, useSponsors } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import { cleanSessionTitle } from '../lib/title';
import { getMapInfoKey } from '../lib/mapInfo';
import { SessionDetailModal } from '../components/SessionDetailModal';
import type { FloorMap, AgendaSession, Sponsor } from '../lib/api';
import { track } from '../lib/analytics';

interface HotspotInfo {
  id: string;
  roomName: string;
  /** When set, used to match sessions in the room-detail modal — preferred
   * over the loose roomName match because run.events room names like
   * "Session Room 16 - 20 minutes (80)" don't equal the printed "Zaal 16". */
  roomGuid?: string;
  /** When set, the hotspot represents multiple run.events rooms — used for
   * Event Hall 1/2 which also serve the combined "Event Hall 1+2" room
   * during the keynote / closing-note / Politie session. */
  roomGuids?: string[];
  label: Record<string, string>;
}

function RoomDetailModal({
  hotspot,
  sponsor,
  currentSessions,
  upcomingSessions,
  onSessionTap,
  onClose,
}: {
  hotspot: HotspotInfo;
  sponsor: Sponsor | null;
  currentSessions: AgendaSession[];
  upcomingSessions: AgendaSession[];
  onSessionTap: (session: AgendaSession) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const lang = i18n.language;
  const roomLabel = hotspot.label[lang] || hotspot.label['en'] || hotspot.roomName;
  const sponsorDescription = sponsor
    ? sponsor.description[lang] || sponsor.description['en'] || ''
    : '';

  // Special-purpose hotspots (no sessions, no sponsor): show a custom info blurb
  const infoKey = getMapInfoKey(hotspot.roomName);
  const infoBody = infoKey ? t(`map.info.${infoKey}.body`) : '';

  return createPortal(
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

          {/* Info blurb for utility hotspots (registratie, photo wall, …) */}
          {infoKey && (
            <div className="mb-5 bg-el-blue/10 border border-el-blue/30 rounded-2xl p-4">
              <p className="text-el-light/85 text-base leading-relaxed whitespace-pre-line">
                {infoBody}
              </p>
            </div>
          )}

          {/* Sponsor card (if this hotspot is a booth) */}
          {sponsor && (
            <div className="mb-5 bg-el-gray rounded-2xl p-4 flex items-start gap-4">
              {sponsor.logoUrl && (
                <div
                  className={`w-20 h-20 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
                    sponsor.logoOnDark ? 'bg-el-dark' : 'bg-white'
                  }`}
                >
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-extrabold text-el-light leading-tight">
                  {sponsor.name}
                </h3>
                {sponsor.boothNumber && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-el-blue/20 text-el-blue text-xs font-bold">
                    Booth {sponsor.boothNumber}
                  </span>
                )}
                {sponsorDescription && (
                  <p className="mt-2 text-sm text-el-light/70 leading-relaxed line-clamp-4">
                    {sponsorDescription}
                  </p>
                )}
                {sponsor.website && (
                  <p className="mt-1 text-xs text-el-light/40 break-all">
                    {sponsor.website.replace(/^https?:\/\//, '')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Current sessions */}
          {currentSessions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-el-light/50 uppercase tracking-wide mb-3">
                {t('map.currentSessions')}
              </h3>
              <div className="space-y-3">
                {currentSessions.map((session) => (
                  <SessionMiniCard key={session.id} session={session} onTap={() => onSessionTap(session)} />
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
                  <SessionMiniCard key={session.id} session={session} onTap={() => onSessionTap(session)} />
                ))}
              </div>
            </div>
          )}

          {/* No sessions at all (and no sponsor / no info blurb) */}
          {!sponsor &&
            !infoKey &&
            currentSessions.length === 0 &&
            upcomingSessions.length === 0 && (
              <p className="text-el-light/50 text-base">
                {t('map.noCurrentSessions')}
              </p>
            )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SessionMiniCard({ session, onTap }: { session: AgendaSession; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="block w-full text-left bg-el-gray rounded-xl p-4 active:bg-el-gray-light transition-colors"
    >
      <h4 className="text-base font-bold text-el-light leading-tight mb-1 line-clamp-2">
        {cleanSessionTitle(session.title)}
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
    </button>
  );
}

function FloorMapViewer({
  map,
  nowData,
  highlightId,
  onHighlightCleared,
}: {
  map: FloorMap;
  nowData: { current: AgendaSession[]; upNext: AgendaSession[] } | undefined;
  highlightId: string | null;
  onHighlightCleared: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigateKeepingSearch();
  const touch = useKioskStore((s) => s.touch);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);
  const { data: sponsors } = useSponsors();

  // ---------------- Pinch / pan / auto-zoom (mobile only) ----------------
  // Any touch-first device (pointer:coarse) gets gestures — phones AND tablets
  // including iPad Pro. The 1080×1920 kiosk also matches pointer:coarse, but
  // pinch on the kiosk is harmless: people rarely need it at that size and the
  // gesture model is consistent everywhere.
  function detectMobile() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }
  const [isMobile, setIsMobile] = useState(detectMobile);
  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---------------- JS-computed fit ----------------
  // CSS aspect-ratio + max-h-full doesn't reliably "shrink to fit" when the
  // parent's height is implicit. We compute the box dimensions explicitly:
  // start from the viewport width, derive the aspect-driven height, and clamp
  // by available vertical space (window height minus header+nav+page chrome).
  // Result: floor map always visible whole on landscape kiosks AND on phones
  // where the natural width-bound rendering already fits.
  const [viewportW, setViewportW] = useState<number>(0);
  const [availableH, setAvailableH] = useState<number>(() =>
    typeof window === 'undefined' ? 0 : Math.max(0, window.innerHeight - 260),
  );
  useEffect(() => {
    const onWinResize = () =>
      setAvailableH(Math.max(0, window.innerHeight - 260));
    window.addEventListener('resize', onWinResize);
    return () => window.removeEventListener('resize', onWinResize);
  }, []);

  const boxSize = useMemo(() => {
    if (!imgSize || !viewportW) return null;
    const aspect = imgSize.w / imgSize.h;
    let w = viewportW;
    let h = w / aspect;
    if (availableH > 0 && h > availableH) {
      h = availableH;
      w = h * aspect;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [imgSize, viewportW, availableH]);

  const [transform, setTransform] = useState({ s: 1, tx: 0, ty: 0 });
  const [animating, setAnimating] = useState(false);
  const transformRef = useRef(transform);
  const pinchTrackedRef = useRef(false);
  useEffect(() => {
    transformRef.current = transform;
    if (transform.s > 1.05 && !pinchTrackedRef.current) {
      pinchTrackedRef.current = true;
      track('pinch_zoom_used', { mapId: map.id });
    }
    if (transform.s <= 1.01) pinchTrackedRef.current = false;
  }, [transform, map.id]);

  const viewportRef = useRef<HTMLDivElement>(null);
  // ResizeObserver keeps viewportW in sync with the actual rendered container
  // width — covers orientation changes + admin Preview iframe resizes.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Inner box sized to the image's aspect ratio. Pan/zoom transform applies to
  // its content so the image always fills it (no contain bands), and bounds
  // calculations are anchored on the actual image content — preventing the
  // user from panning the map off-screen on devices where the outer wrapper
  // is taller than the image (mobile portrait + min-h).
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch';
    startTouches: { x: number; y: number }[];
    startT: { s: number; tx: number; ty: number };
    startDist: number;
    startMid: { x: number; y: number };
    panMoved: boolean;
    suppressClickUntil: number;
  }>({
    mode: 'idle',
    startTouches: [],
    startT: { s: 1, tx: 0, ty: 0 },
    startDist: 0,
    startMid: { x: 0, y: 0 },
    panMoved: false,
    suppressClickUntil: 0,
  });

  function clampT(t: { s: number; tx: number; ty: number }, w: number, h: number) {
    const s = Math.max(1, Math.min(3.5, t.s));
    const minTx = w * (1 - s);
    const minTy = h * (1 - s);
    return {
      s,
      tx: Math.max(minTx, Math.min(0, t.tx)),
      ty: Math.max(minTy, Math.min(0, t.ty)),
    };
  }

  function resetZoom() {
    setAnimating(true);
    setTransform({ s: 1, tx: 0, ty: 0 });
    setTimeout(() => setAnimating(false), 350);
  }

  // Bind native touch handlers (passive:false so we can preventDefault on pinch).
  // Attached to the image box (not the outer wrapper) so taps in the bg-el-gray
  // bands above/below the image don't accidentally start a gesture, AND so
  // coordinates are relative to the actual image content.
  useEffect(() => {
    if (!isMobile || !imageBoxRef.current) return;
    const el = imageBoxRef.current;
    const opts: AddEventListenerOptions = { passive: false };

    function localCoords(e: TouchEvent) {
      const rect = el.getBoundingClientRect();
      return Array.from(e.touches).map((t) => ({
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
      }));
    }

    function onStart(e: TouchEvent) {
      const touches = localCoords(e);
      const g = gestureRef.current;
      if (touches.length === 1) {
        g.mode = 'pan';
        g.startTouches = touches;
        g.startT = { ...transformRef.current };
        g.panMoved = false;
      } else if (touches.length >= 2) {
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        g.mode = 'pinch';
        g.startTouches = touches;
        g.startT = { ...transformRef.current };
        g.startDist = Math.hypot(dx, dy) || 1;
        g.startMid = {
          x: (touches[0].x + touches[1].x) / 2,
          y: (touches[0].y + touches[1].y) / 2,
        };
        g.panMoved = true; // pinch always cancels the click
        e.preventDefault();
      }
    }

    function onMove(e: TouchEvent) {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const touches = localCoords(e);
      const g = gestureRef.current;
      if (g.mode === 'pinch' && touches.length >= 2) {
        e.preventDefault();
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        const dist = Math.hypot(dx, dy);
        const mid = {
          x: (touches[0].x + touches[1].x) / 2,
          y: (touches[0].y + touches[1].y) / 2,
        };
        const ratio = dist / g.startDist;
        const newS = g.startT.s * ratio;
        const ax = g.startMid.x;
        const ay = g.startMid.y;
        const tx = ax - (ax - g.startT.tx) * (newS / g.startT.s) + (mid.x - g.startMid.x);
        const ty = ay - (ay - g.startT.ty) * (newS / g.startT.s) + (mid.y - g.startMid.y);
        setTransform(clampT({ s: newS, tx, ty }, w, h));
      } else if (g.mode === 'pan' && touches.length === 1 && g.startT.s > 1) {
        const dx = touches[0].x - g.startTouches[0].x;
        const dy = touches[0].y - g.startTouches[0].y;
        // Only update the transform once movement crosses the 5px threshold.
        // Otherwise sub-threshold finger jitter during a tap-while-zoomed
        // shifts the wrapper a few px, the click target moves out from under
        // the finger, and the synthetic click hits the wrong polygon.
        if (Math.hypot(dx, dy) > 5) {
          g.panMoved = true;
          e.preventDefault();
          setTransform(
            clampT(
              { s: g.startT.s, tx: g.startT.tx + dx, ty: g.startT.ty + dy },
              w,
              h,
            ),
          );
        }
      }
    }

    function onEnd(e: TouchEvent) {
      const g = gestureRef.current;
      if (g.panMoved) {
        // Suppress the synthetic click that follows the touchend
        g.suppressClickUntil = Date.now() + 400;
        e.preventDefault();
      }
      g.mode = 'idle';
    }

    el.addEventListener('touchstart', onStart, opts);
    el.addEventListener('touchmove', onMove, opts);
    el.addEventListener('touchend', onEnd, opts);
    el.addEventListener('touchcancel', onEnd, opts);
    return () => {
      el.removeEventListener('touchstart', onStart, opts);
      el.removeEventListener('touchmove', onMove, opts);
      el.removeEventListener('touchend', onEnd, opts);
      el.removeEventListener('touchcancel', onEnd, opts);
    };
  }, [isMobile]);

  // Hotspot deeplinks no longer auto-zoom. The earlier 2.5× zoom-in was
  // landscape-kiosk-hostile: it cropped most of the floor on PixioDisplay so
  // visitors couldn't see context around the highlighted room. The pulse
  // animation (hotspot-pulse class) already makes the target unmissable;
  // pinch-zoom remains available for users who want a closer look.

  // Reset zoom whenever the active map changes (defensive)
  useEffect(() => {
    setTransform({ s: 1, tx: 0, ty: 0 });
  }, [map.id]);

  // When a sponsor/session deeplink lands on /map with a highlighted hotspot,
  // scroll the floor-map viewport into view so the user lands directly on the
  // highlighted booth — without this they'd see the page header + tabs and
  // would have to scroll down themselves to find the pulsing magenta marker.
  useEffect(() => {
    if (!highlightId || !viewportRef.current) return;
    // Defer so the map image has had a layout pass first
    const tid = setTimeout(() => {
      viewportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => clearTimeout(tid);
  }, [highlightId]);

  const currentSessions = nowData?.current ?? [];
  const upcomingSessions = nowData?.upNext ?? [];

  const sponsorForSelected = selectedHotspot
    ? (sponsors ?? []).find((s) => s.floorMapHotspotId === selectedHotspot.id) ?? null
    : null;

  // When a "category" hotspot is tapped (Toiletten / Eten-drinken / Dietary
  // needs), highlight every hotspot that shares the same roomName so the
  // visitor sees all locations at once, not just the one they tapped.
  const GROUP_NAMES = new Set([
    'toiletten', 'toilet', 'toilets', 'restroom',
    'eten/drinken', 'eten en drinken', 'food', 'food and drinks', 'food/drinks', 'catering',
    'dietary needs', 'dieet', 'dieetwensen',
  ]);
  const groupHighlightIds = useMemo(() => {
    if (!selectedHotspot) return null;
    const name = selectedHotspot.roomName.trim().toLowerCase();
    if (!GROUP_NAMES.has(name)) return null;
    const ids = new Set<string>();
    for (const h of map.hotspots) {
      if (h.roomName.trim().toLowerCase() === name) ids.add(h.id);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHotspot, map.hotspots]);

  // Match sessions by roomGuid(s) when wired (preferred — exact), fall back
  // to roomName for utility rooms. roomGuids[] supports a single hotspot
  // representing multiple run.events rooms — Event Hall 1 matches both the
  // EH1 GUID and the combined "EH1+2" GUID used for the keynote/closing.
  const matchesRoom = (s: AgendaSession, h: HotspotInfo) => {
    if (h.roomGuids && h.roomGuids.length > 0) return h.roomGuids.includes(s.roomGuid);
    if (h.roomGuid) return s.roomGuid === h.roomGuid;
    return s.roomName === h.roomName;
  };
  const currentForRoom = selectedHotspot
    ? currentSessions.filter((s) => matchesRoom(s, selectedHotspot))
    : [];
  const upcomingForRoom = selectedHotspot
    ? upcomingSessions.filter((s) => matchesRoom(s, selectedHotspot))
    : [];

  function handleHotspotTap(hotspot: HotspotInfo) {
    touch();
    track('hotspot_tap', {
      mapId: map.id,
      hotspotId: hotspot.id,
      roomName: hotspot.roomName,
    });
    if (hotspot.roomName.trim().toLowerCase() === 'merchandise') {
      navigate('/shop');
      return;
    }
    setSelectedHotspot(hotspot);
  }

  return (
    <>
      <p className="text-el-light/40 text-sm mb-3">{t('map.tapRoom')}</p>

      <div
        ref={viewportRef}
        className="relative w-full bg-el-gray rounded-2xl overflow-hidden flex items-center justify-center"
      >
        {!imgSize && (
          <div className="text-el-light/50">
            <div className="animate-pulse">{t('common.loading')}</div>
          </div>
        )}
        {/* Inner box: JS-computed pixel dimensions so the floor map always
            fits within the viewport both horizontally AND vertically (no
            scroll-clip on landscape kiosks). Falls back to a 16/9 ratio
            while the source image is still loading. Pan/zoom is anchored on
            this so users can never pan past the gray bands. */}
        <div
          ref={imageBoxRef}
          className="relative overflow-hidden touch-none"
          style={{
            width: boxSize ? `${boxSize.w}px` : '100%',
            height: boxSize ? `${boxSize.h}px` : 'auto',
            aspectRatio: imgSize ? `${imgSize.w}/${imgSize.h}` : '16/9',
            display: imgSize ? 'block' : 'none',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.s})`,
              transformOrigin: '0 0',
              transition: animating ? 'transform 400ms ease-out' : 'none',
              willChange: 'transform',
            }}
          >
            <img
              src={map.imageUrl}
              alt={map.name}
              loading="eager"
              decoding="async"
              className="w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              onError={() => {
                console.warn('[MapPage] floor map image failed to load:', map.imageUrl);
              }}
            />
            {imgSize && (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {map.hotspots.map((hotspot) => {
                const isHighlighted =
                  hotspot.id === highlightId ||
                  (groupHighlightIds?.has(hotspot.id) ?? false);
                return (
                  <polygon
                    key={hotspot.id}
                    points={hotspot.points.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill={isHighlighted ? 'rgba(236, 72, 153, 0.5)' : 'rgba(0, 0, 0, 0)'}
                    stroke={isHighlighted ? '#EC4899' : 'none'}
                    strokeWidth={isHighlighted ? '0.005' : '0'}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'all' }}
                    className={`cursor-pointer ${isHighlighted ? 'hotspot-pulse' : ''}`}
                    onClick={() => {
                      // Pan/pinch gestures briefly suppress the synthetic click
                      if (Date.now() < gestureRef.current.suppressClickUntil) return;
                      handleHotspotTap(hotspot);
                      onHighlightCleared();
                    }}
                  />
                );
              })}
            </svg>
            )}
          </div>
        </div>

        {isMobile && transform.s > 1.01 && (
          <button
            onClick={() => {
              resetZoom();
              touch();
            }}
            aria-label="Reset zoom"
            className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-full bg-el-dark/85 backdrop-blur text-el-light flex items-center justify-center shadow-lg active:bg-el-dark"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 9V5H5m0 0l4 4M15 9V5h4m0 0l-4 4M9 15v4H5m0 0l4-4M15 15v4h4m0 0l-4-4"
              />
            </svg>
          </button>
        )}
      </div>

      {selectedHotspot && (
        <RoomDetailModal
          hotspot={selectedHotspot}
          sponsor={sponsorForSelected}
          currentSessions={currentForRoom}
          upcomingSessions={upcomingForRoom}
          onSessionTap={(s) => setSelectedSession(s)}
          onClose={() => setSelectedHotspot(null)}
        />
      )}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </>
  );
}

export function MapPage() {
  const { t, i18n } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const selectedMapId = useKioskStore((s) => s.selectedMapId);
  const setSelectedMap = useKioskStore((s) => s.setSelectedMap);
  const mapHighlightId = useKioskStore((s) => s.mapHighlightId);
  const setMapHighlight = useKioskStore((s) => s.setMapHighlight);
  const lang = i18n.language;
  const { data: maps, isLoading } = useFloorMaps();
  const { data: nowData } = useNowSessions();

  // Auto-select the map containing the highlighted hotspot if needed.
  useEffect(() => {
    if (!mapHighlightId) return;
    if (!maps || maps.length === 0) return;
    const activeContains = maps
      .find((m) => m.id === selectedMapId)
      ?.hotspots.some((h) => h.id === mapHighlightId);
    if (activeContains) return;
    const targetMap = maps.find((m) =>
      m.hotspots.some((h) => h.id === mapHighlightId),
    );
    if (targetMap && targetMap.id !== selectedMapId) {
      setSelectedMap(targetMap.id, mapHighlightId);
    }
  }, [mapHighlightId, maps, selectedMapId, setSelectedMap]);

  if (isLoading || !maps) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">
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

  if (maps.length === 0) {
    return (
      <PageContainer>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">
          {t('map.title')}
        </h1>
        <p className="text-el-light/60 text-lg">{t('map.noMaps')}</p>
      </PageContainer>
    );
  }

  // Use maps in API order (sortOrder handled server-side)
  const sortedMaps = maps;
  const activeMapIndex = selectedMapId
    ? Math.max(
        0,
        sortedMaps.findIndex((m) => m.id === selectedMapId),
      )
    : 0;
  const activeMap = sortedMaps[activeMapIndex] ?? sortedMaps[0];

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">
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
                  track('floor_switch', { mapId: map.id });
                  setSelectedMap(map.id);
                  touch();
                }}
                className={`shrink-0 px-5 py-3 rounded-xl text-base font-bold transition-colors active:scale-[0.98] ${
                  isActive
                    ? 'bg-el-blue text-el-light'
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
        highlightId={mapHighlightId}
        onHighlightCleared={() => setMapHighlight(null)}
      />
    </PageContainer>
  );
}
