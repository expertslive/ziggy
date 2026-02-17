import type { ReactNode } from 'react';

interface SlideOverProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SlideOver({ open, title, onClose, children }: SlideOverProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-secondary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-alt hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
