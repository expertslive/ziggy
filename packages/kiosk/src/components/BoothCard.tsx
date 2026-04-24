import { motion } from 'framer-motion'
import type { Booth } from '../lib/api'

interface BoothCardProps {
  booth: Booth
  onTap: () => void
}

export function BoothCard({ booth, onTap }: BoothCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onTap}
      className="w-full bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 active:bg-white/20 transition-colors text-left"
    >
      {booth.logoUrl ? (
        <img
          src={booth.logoUrl}
          alt={booth.name}
          className="w-16 h-16 rounded-xl object-contain bg-white/5 shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-el-gray flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-el-light/40">
            {booth.name[0]}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-el-light truncate">{booth.name}</h3>
        {booth.organization && booth.organization !== booth.name && (
          <p className="text-sm text-el-light/50 truncate">{booth.organization}</p>
        )}
        {booth.boothNumber && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-el-blue/20 text-el-blue text-xs font-semibold">
            {booth.boothNumber}
          </span>
        )}
      </div>
      <svg className="w-5 h-5 text-el-light/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </motion.button>
  )
}
