'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageLoadingProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const PageLoading = React.forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ message, fullScreen = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center gap-3',
          fullScreen ? 'h-[100dvh]' : 'h-64',
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label={message || 'Loading'}
        {...props}
      >
        <div className="h-10 w-10 animate-pulse rounded-[4px] bg-white/[0.06]" aria-hidden="true" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
PageLoading.displayName = 'PageLoading';

export { PageLoading };
