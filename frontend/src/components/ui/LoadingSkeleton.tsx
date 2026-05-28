import React from 'react';
import { cn } from '@/lib/utils';

export function CameraStreamSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="loading camera stream"
      className={cn('animate-pulse bg-white/[0.06] rounded-[0.75rem] w-full h-full', className)}
    >
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/[0.08]" />
          <div className="h-3 w-24 rounded-full bg-white/[0.08]" />
          <div className="h-2 w-16 rounded-full bg-white/[0.06]" />
        </div>
      </div>
    </div>
  );
}
