import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useKioskStore } from '../store/kiosk'
import { useFloorMaps } from '../lib/hooks'
import type { Booth } from '../lib/api'

interface BoothDetailModalProps {
  booth: Booth
  onClose: () => void
}

export function BoothDetailModal({ booth, onClose }: BoothDetailModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSelectedMap = useKioskStore((s) => s.setSelectedMap)
  const { data: floorMaps } = useFloorMaps()

  const matchingMap = (floorMaps ?? []).find((m) =>
    m.hotspots?.some((h) => h.id === booth.floorMapHotspotId),
  )

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
        className="bg-el-dark rounded-t-3xl w-full max-w-2xl max-h-[80vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

        <div className="flex flex-col items-center gap-4">
          {booth.logoUrl && (
            <img
              src={booth.logoUrl}
              alt={booth.name}
              className="h-20 max-w-full object-contain"
            />
          )}
          <h2 className="text-2xl font-bold text-el-light">{booth.name}</h2>

          {booth.organization && booth.organization !== booth.name && (
            <p className="text-el-light/50 text-sm">{booth.organization}</p>
          )}

          {booth.boothNumber && (
            <span className="px-3 py-1 rounded-full bg-el-blue/20 text-el-blue text-sm font-semibold">
              {t('booths.boothNumber', { number: booth.boothNumber })}
            </span>
          )}

          {matchingMap && booth.floorMapHotspotId && (
            <button
              onClick={() => {
                setSelectedMap(matchingMap.id, booth.floorMapHotspotId!)
                onClose()
                navigate('/map')
              }}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-el-blue text-white text-sm font-bold active:bg-el-blue/80"
            >
              &#x1F5FA; {t('map.showOnMap')}
            </button>
          )}

          {booth.location && (
            <p className="text-el-light/60 text-sm">{booth.location}</p>
          )}

          {booth.description && (
            <p className="text-el-light/70 text-base leading-relaxed text-center">
              {booth.description}
            </p>
          )}

          {booth.website && (
            <p className="text-el-light/50 text-sm">{booth.website}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-white/10 text-el-light font-semibold active:bg-white/20 transition-colors"
        >
          {t('common.back')}
        </button>
      </motion.div>
    </motion.div>
  )
}
