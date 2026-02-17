import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="scrollable h-full px-6 py-6">
      {children}
    </div>
  );
}
