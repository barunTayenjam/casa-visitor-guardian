import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStateOverlayProps {
  state: 'connecting' | 'error' | 'reconnecting';
  cameraName: string;
  errorMessage?: string;
  className?: string;
  onRetry?: () => void;
}

export const ConnectionStateOverlay: React.FC<ConnectionStateOverlayProps> = ({ state, cameraName, errorMessage, className, onRetry }) => {
  if (state === 'error') {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-2xl z-30", className)}>
        <div className="text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-2">Connection Error</h3>
          <p className="text-sm text-foreground/70 mb-4">{errorMessage || 'Failed to connect to camera'}</p>
          <p className="text-xs text-muted-foreground mb-6">Camera: {cameraName}</p>
          
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state === 'connecting' || state === 'reconnecting') {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-2xl z-30", className)}>
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">{state === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}</p>
          <p className="text-xs text-muted-foreground">{cameraName}</p>
        </div>
      </div>
    );
  }

  return null;
};
