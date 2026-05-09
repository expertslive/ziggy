import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RICKROLL_FRAMES } from '../assets/rickroll-frames'

interface RickRollOverlayProps {
  onClose: () => void
}

export function RickRollOverlay({ onClose }: RickRollOverlayProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    // 8 fps loop through baked ASCII braille frames
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % RICKROLL_FRAMES.length)
    }, 125)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-el-darker flex flex-col items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl flex items-center justify-center"
      >
        &#x2715;
      </button>
      <pre
        className="text-white text-center whitespace-pre leading-[1.0] m-0"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 'clamp(6px, 1.2vw, 11px)',
          lineHeight: 1.0,
        }}
      >
        {RICKROLL_FRAMES[frame]}
      </pre>
      <div className="mt-6 text-center px-4">
        <p className="text-white text-lg sm:text-xl font-bold">
          🕺 Never Gonna Give You Up — You&apos;ve been rickrolled!
        </p>
        <p className="text-white/60 text-sm mt-2">
          Tap &times; or press Esc to dismiss
        </p>
      </div>
    </div>,
    document.body,
  )
}
