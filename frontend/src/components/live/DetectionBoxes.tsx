import React from 'react';
import { cn } from '@/lib/utils';

export interface TrackedDetection {
  trackId: string | number;
  className: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  identity?: string;
  identityConfidence?: number;
  hitCount?: number;
  lastSeen: number;
}

interface DetectionBoxesProps {
  tracks: TrackedDetection[];
  videoRect: { left: number; top: number; width: number; height: number } | null;
}

const formatLabel = (track: TrackedDetection): string => {
  if (track.identity && track.identity !== 'unknown') {
    const idConf = track.identityConfidence
      ? ` ${Math.round(track.identityConfidence * 100)}%`
      : '';
    return `${track.identity.toUpperCase()}${idConf}`;
  }
  return `${track.className.toUpperCase()} ${Math.round(track.confidence)}%`;
};

export const DetectionBoxes: React.FC<DetectionBoxesProps> = ({ tracks, videoRect }) => {
  if (!videoRect || tracks.length === 0) return null;

  return (
    <div
      className="absolute z-[5] pointer-events-none"
      style={{
        left: `${videoRect.left}px`,
        top: `${videoRect.top}px`,
        width: `${videoRect.width}px`,
        height: `${videoRect.height}px`,
      }}
      aria-hidden="true"
    >
      {tracks.map((track) => {
        const isPerson = track.className === 'person';
        const label = formatLabel(track);
        const labelAbove = track.bbox.y > 0.12;

        return (
          <div
            key={track.trackId}
            className={cn(
              'absolute transition-[left,top,width,height] duration-200 ease-linear',
              isPerson
                ? 'border-2 border-red-500 rounded-md shadow-[0_0_12px_rgba(239,68,68,0.35)]'
                : 'border border-sky-400/70 rounded',
            )}
            style={{
              left: `${track.bbox.x * 100}%`,
              top: `${track.bbox.y * 100}%`,
              width: `${track.bbox.width * 100}%`,
              height: `${track.bbox.height * 100}%`,
            }}
          >
            <span
              className={cn(
                'absolute left-0 whitespace-nowrap font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-[10px] leading-none',
                isPerson
                  ? 'bg-red-500/90 text-white font-semibold'
                  : 'bg-sky-400/80 text-slate-900 text-[9px]',
                labelAbove ? '-top-5' : 'top-0',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
