import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="scrollable h-full px-4 py-4 sm:px-6 sm:py-6">
      {children}
    </div>
  );
}
