import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  /** Narrow reading surface (Ask) vs data surface (default 7xl) */
  width?: 'narrow' | 'full';
  className?: string;
}

/**
 * Single scroll container for all content pages inside AppLayout.
 * Full-bleed workspaces (Live, Timeline) don't use this — they need
 * edge-to-edge grid + panel layouts.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  width = 'full',
  className,
}) => (
  <div className="h-full overflow-y-auto bg-background">
    <div
      className={cn(
        'mx-auto px-6 pt-6 pb-10',
        width === 'narrow' ? 'max-w-3xl' : 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  </div>
);
