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
    // Mobile sheet — anchored bottom because a side-drawer is unusable at <=390px.
    <div
      className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 md:items-stretch"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:h-full md:max-h-none md:max-w-lg md:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 md:hidden" />
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 py-3 md:px-6 md:py-4">
          <h2 className="text-lg font-bold text-secondary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-alt hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
