import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStateOverlayProps {
  state: 'connecting' | 'error' | 'reconnecting';
  cameraName: string;
  errorMessage?: string;
  className?: string;
}

export const ConnectionStateOverlay: React.FC<ConnectionStateOverlayProps> = ({
  state,
  cameraName,
  errorMessage,
  className,
}) => {
  if (state === 'error') {
    return (
      <div className={cn(
        "absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-30",
        className
      )}>
        <div className="text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
          <p className="text-sm text-white/70 mb-4">{errorMessage || 'Failed to connect to camera'}</p>
          <p className="text-xs text-white/50">Camera: {cameraName}</p>
        </div>
      </div>
    );
  }

  if (state === 'connecting' || state === 'reconnecting') {
    return (
      <div className={cn(
        "absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30",
        className
      )}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-1">
            {state === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </p>
          <p className="text-sm text-white/60">{cameraName}</p>
        </div>
      </div>
    );
  }

  return null;
};
