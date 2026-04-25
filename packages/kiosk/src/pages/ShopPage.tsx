import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/PageContainer';
import { useShopItems } from '../lib/hooks';
import { useKioskStore } from '../store/kiosk';
import type { ShopItem } from '../lib/api';

function ShopCard({ item, onTap }: { item: ShopItem; onTap: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onTap}
      className={`bg-white rounded-2xl p-4 flex flex-col gap-3 active:bg-el-light transition-colors text-left ${
        item.isHighlighted ? 'ring-4 ring-el-blue' : ''
      }`}
    >
      <div className="aspect-[4/3] w-full bg-el-light rounded-xl overflow-hidden flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-el-dark/40 text-2xl">{item.name[0]}</span>
        )}
      </div>
      <div>
        <h3 className="text-base font-bold text-el-dark line-clamp-2">{item.name}</h3>
        <p className="text-el-blue font-extrabold mt-1">{item.priceLabel}</p>
      </div>
    </motion.button>
  );
}

function ShopDetailModal({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const description = item.description[i18n.language] || item.description['en'] || '';
  return (
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
        className="bg-el-dark rounded-t-3xl w-full max-w-2xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-full h-64 object-cover" />
        )}
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-bold text-el-light">{item.name}</h2>
          <p className="text-el-blue font-extrabold text-2xl">{item.priceLabel}</p>
          {description && (
            <p className="text-el-light/70 leading-relaxed whitespace-pre-line">{description}</p>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20 transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ShopPage() {
  const { t } = useTranslation();
  const touch = useKioskStore((s) => s.touch);
  const { data, isLoading } = useShopItems();
  const [selected, setSelected] = useState<ShopItem | null>(null);

  const items = (data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const highlighted = items.filter((i) => i.isHighlighted);
  const regular = items.filter((i) => !i.isHighlighted);

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-el-light mb-2">{t('shop.title')}</h1>
      <p className="text-el-light/70 mb-4">{t('shop.subtitle')}</p>

      <div className="bg-el-blue/10 border border-el-blue/40 rounded-2xl p-4 mb-6">
        <h2 className="text-base font-bold text-el-blue mb-2">{t('shop.studiebeurs.heading')}</h2>
        <p className="text-el-light/80 text-sm leading-relaxed mb-2">{t('shop.studiebeurs.body1')}</p>
        <p className="text-el-light/80 text-sm leading-relaxed">{t('shop.studiebeurs.body2')}</p>
      </div>

      {isLoading && <p className="text-el-light/60">{t('common.loading')}</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-el-light/60 text-lg">{t('shop.empty')}</p>
      )}

      {highlighted.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-el-light mb-3">{t('shop.featured')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </section>
      )}

      {regular.length > 0 && (
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
    </PageContainer>
  );
}
