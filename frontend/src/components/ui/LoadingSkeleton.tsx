import React from 'react';
import { cn } from '@/lib/utils';

export function CameraStreamSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading camera stream"
      className={cn('animate-pulse bg-slate-800 rounded-lg w-full h-full', className)}
    >
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-700" />
          <div className="h-4 w-32 rounded bg-slate-700" />
          <div className="h-3 w-20 rounded bg-slate-700" />
        </div>
      </div>
    </div>
  );
}
