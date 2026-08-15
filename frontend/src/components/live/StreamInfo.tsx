import React from 'react';
import { cn } from '@/lib/utils';
import { Camera } from '@/types/security';

interface StreamInfoProps {
  camera: Camera;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  isStreaming: boolean;
  isWanStream: boolean;
}

export const StreamInfo: React.FC<StreamInfoProps> = ({
  camera,
  connectionState,
  isStreaming,
  isWanStream,
}) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-black/60 border border-white/10 pointer-events-auto">
    <div
      className={cn(
        'w-2 h-2 rounded-full',
        connectionState === 'connected' && isStreaming
          ? 'bg-green-500'
          : connectionState === 'connecting' || connectionState === 'reconnecting'
            ? 'bg-yellow-500 animate-pulse'
            : 'bg-red-500',
      )}
      role="status"
      aria-label={
        connectionState === 'connected'
          ? 'Connected'
          : connectionState === 'connecting'
            ? 'Connecting'
            : connectionState === 'reconnecting'
              ? 'Reconnecting'
              : 'Connection error'
      }
    />
    <span className="text-xs font-medium text-white/90">{camera.name}</span>
    {connectionState === 'connected' && isStreaming && (
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          isWanStream ? 'text-amber-500' : 'text-red-500',
        )}
      >
        {isWanStream ? 'STREAM' : 'LIVE'}
      </span>
    )}
  </div>
);
