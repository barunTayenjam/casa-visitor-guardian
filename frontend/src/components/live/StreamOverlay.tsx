import React from 'react';

interface StreamOverlayProps {
  error: string | null;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  showFullOverlay: boolean;
  onRetry: () => void;
}

export const StreamOverlay: React.FC<StreamOverlayProps> = ({
  error,
  connectionState,
  showFullOverlay,
  onRetry,
}) => {
  if (!(error && connectionState === 'error' && !showFullOverlay)) return null;
  return (
    <div className="absolute top-12 left-3 z-10 text-red-400 text-xs bg-black/50 px-2 py-1 rounded flex items-center gap-2">
      {error}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="text-red-300 hover:text-red-100"
        title="Retry"
        aria-label="Retry stream"
      >
        ↻
      </button>
    </div>
  );
};
