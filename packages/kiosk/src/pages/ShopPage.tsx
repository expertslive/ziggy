import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { useShopItems, useFloorMaps } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { ShopItem } from '../lib/api';
import { AuctionPanel } from '../components/AuctionPanel';
import { StudiebeursHeroCard } from '../components/StudiebeursHeroCard';

function ShopCard({ item, onTap }: { item: ShopItem; onTap: () => void }) {
  const { t } = useTranslation();
  const hasAuction = !!item.auction;
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onTap}
      className={`bg-white rounded-2xl p-4 flex flex-col gap-3 active:bg-el-light transition-colors text-left relative ${
        item.isHighlighted ? 'ring-4 ring-el-blue' : ''
      }`}
    >
      {hasAuction && (
        <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {t('shop.liveAuction')}
        </span>
      )}
      <div className="aspect-[4/3] w-full bg-el-light rounded-xl overflow-hidden flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-el-dark/40 text-2xl">{item.name[0]}</span>
        )}
      </div>
      <div>
        <h3 className="text-base font-bold text-el-dark line-clamp-2">{item.name}</h3>
        <p className="text-el-blue font-extrabold mt-1">
          {hasAuction ? t('shop.bidNow') : item.priceLabel}
        </p>
        {hasAuction && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-el-dark/80 leading-relaxed">
              {t('shop.octocat.pitch')}
            </p>
            <ul className="space-y-1.5 text-xs text-el-dark/70">
              <li className="flex items-start gap-2">
                <span className="text-el-blue font-bold mt-0.5">•</span>
                {t('shop.octocat.bullet1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-el-blue font-bold mt-0.5">•</span>
                {t('shop.octocat.bullet2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-el-blue font-bold mt-0.5">•</span>
                {t('shop.octocat.bullet3')}
              </li>
            </ul>
          </div>
        )}
      </div>
    </motion.button>
  );
}

function ShopDetailModal({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const description = item.description[i18n.language] || item.description['en'] || '';
  const images = [item.imageUrl, ...(item.galleryUrls ?? [])].filter(Boolean);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollToIdx(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  }

  const hasAuction = !!item.auction;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`relative bg-el-dark rounded-t-3xl w-full max-h-[92dvh] overflow-auto ${
          hasAuction ? 'max-w-5xl' : 'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-el-gray/80 backdrop-blur text-el-light text-xl active:bg-el-gray"
        >
          &#x2715;
        </button>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-4" />

        {/* Layout: split-pane on md+ when auction is present (gallery+info on
         *  the left, auction panel on the right). Otherwise single column. */}
        <div className={hasAuction ? 'md:grid md:grid-cols-2 md:gap-0' : ''}>
          {/* Left / top: gallery + name + description */}
          <div>
            {images.length > 0 && (
              <div className="relative">
                <div
                  ref={scrollerRef}
                  onScroll={onScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
                >
                  {images.map((src, i) => (
                    <img
                      key={src + i}
                      src={src}
                      alt={`${item.name} ${i + 1}`}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      className="shrink-0 w-full h-60 sm:h-80 object-contain snap-start select-none bg-el-darker"
                    />
                  ))}
                </div>
                {images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => scrollToIdx(i)}
                        aria-label={`Show image ${i + 1}`}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          i === activeIdx ? 'bg-white w-4' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="p-5 sm:p-6 space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-el-light">{item.name}</h2>
              {!hasAuction && (
                <p className="text-el-blue font-extrabold text-xl sm:text-2xl">{item.priceLabel}</p>
              )}
              {description && (
                <p className="text-el-light/70 leading-relaxed whitespace-pre-line text-sm sm:text-base">{description}</p>
              )}
            </div>
          </div>

          {/* Right / bottom: auction panel (only when configured) */}
          {hasAuction && (
            <div className="p-5 sm:p-6 md:border-l md:border-white/10">
              <AuctionPanel item={item} />
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20 transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function ShopPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data, isLoading } = useShopItems();
  const navigate = useNavigate();
  const setSelectedMap = useKioskStore((s) => s.setSelectedMap);
  const { data: floorMapsData } = useFloorMaps();

  // Find the Merch hotspot across all floor maps. Hidden when not yet
  // loaded or when the hotspot is missing — never shows a broken state.
  // Memoised so we don't walk the floor-map tree on every render of this
  // page (re-renders fire on store touch + observer state too).
  const merchTarget = useMemo(() => {
    for (const map of floorMapsData ?? []) {
      for (const h of map.hotspots ?? []) {
        if (h.roomName.trim().toLowerCase() === 'merchandise') {
          return { mapId: map.id, hotspotId: h.id };
        }
      }
    }
    return null;
  }, [floorMapsData]);
  const [selected, setSelected] = useState<ShopItem | null>(null);

  const items = (data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const highlighted = items.filter((i) => i.isHighlighted);
  const regular = items.filter((i) => !i.isHighlighted);

  const regularGridRef = useRef<HTMLDivElement | null>(null);
  const [regularInView, setRegularInView] = useState(true);

  useEffect(() => {
    const el = regularGridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setRegularInView(e.isIntersecting);
      },
      // any sliver of the grid showing counts as "in view" so the cue
      // disappears as soon as it begins to peek.
      { threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [regular.length]);

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-4">{t('shop.title')}</h1>

      {/* Hero row: Octocat (left) and Studiebeurs (right) get equal visual
          weight on md+. On mobile they stack. Below the hero row a full-width
          info strip carries the subtitle + Merch deeplink + handmade line. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {highlighted.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {highlighted.map((item) => (
              <ShopCard
                key={item.id}
                item={item}
                onTap={() => {
                  setSelected(item);
                  touch();
                }}
              />
            ))}
          </div>
        ) : (
          <div /> /* placeholder so the studiebeurs card keeps its right slot */
        )}
        <StudiebeursHeroCard />
      </div>

      {/* Full-width info strip — subtitle + Merch button (added in Task 6) +
          handmade line. */}
      <div className="mt-4 mb-8 bg-el-blue/10 border border-el-blue/40 rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
        <p className="text-el-light/90 text-sm sm:text-base leading-relaxed">
          {t('shop.subtitle')}
        </p>
        {merchTarget && (
          <button
            onClick={() => {
              setSelectedMap(merchTarget.mapId, merchTarget.hotspotId);
              touch();
              navigate('/map');
            }}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-el-blue text-white text-sm font-bold active:bg-el-blue/80"
          >
            <span aria-hidden="true">📍</span>
            {t('shop.merchOnMap')}
          </button>
        )}
        <p className="text-el-light/60 italic leading-relaxed text-xs sm:text-sm">
          {t('shop.handmade')}
        </p>
      </div>

      {isLoading && <p className="text-el-light/60">{t('common.loading')}</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-el-light/60 text-lg">{t('shop.empty')}</p>
      )}

      {regular.length > 0 && (
        <section>
          <div ref={regularGridRef} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {regular.map((item) => (
              <ShopCard
                key={item.id}
                item={item}
                onTap={() => {
                  setSelected(item);
                  touch();
                }}
              />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {selected && <ShopDetailModal item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {regular.length > 0 && !regularInView && (
        <button
          onClick={() => {
            regularGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            touch();
          }}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-el-blue text-white text-sm font-semibold shadow-lg active:bg-el-blue/80 animate-bounce-soft"
        >
          {t('shop.moreBelow', { count: regular.length })}
        </button>
      )}
    </PageContainer>
  );
}
