import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonBaseProps {
  className?: string;
  children?: React.ReactNode;
}

export function SkeletonBase({ className, children }: SkeletonBaseProps) {
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn('animate-pulse rounded-md bg-muted', className)}
    >
      {children}
    </div>
  );
}

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

export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading event"
      className={cn('animate-pulse', className)}
    >
      <div className="aspect-video bg-slate-800 rounded-xl" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
      </div>
    </div>
  );
}

export function EventRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading event"
      className={cn('animate-pulse flex items-center gap-4 p-3 rounded-xl', className)}
    >
      <div className="w-32 h-20 rounded-lg bg-slate-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700 rounded w-1/3" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
      </div>
    </div>
  );
}

export function ImageSkeleton({
  aspectRatio = 'aspect-video',
  className,
}: {
  aspectRatio?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="loading image"
      className={cn('animate-pulse bg-slate-800 rounded', aspectRatio, className)}
    />
  );
}
