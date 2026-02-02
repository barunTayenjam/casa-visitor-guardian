import React, { useState, useRef, useEffect } from 'react';
import { Camera } from '@/types/security';

import { colors, transitions } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';

interface CameraFeedProps {
  camera: Camera;
  isFocused?: boolean;
  onFocus?: () => void;
  showControls?: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  camera,
  isFocused = false,
  onFocus,
  showControls = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(showControls);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setControlsVisible(showControls);
  }, [showControls]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setControlsVisible(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    if (!showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  const handleClick = () => {
    if (!isFocused && onFocus) {
      onFocus();
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online':
        return colors.status.success;
      case 'offline':
        return colors.status.error;
      default:
        return colors.status.warning;
    }
  };

  return (
    <div
      className={cn(
        'relative w-full h-full bg-black cursor-pointer group',
        'transition-all duration-200',
        isFocused && 'ring-2 ring-blue-500'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Camera Stream */}
      <div className="relative w-full h-full">
        {!imageError ? (
          <img
            ref={videoRef}
            src={camera.streamUrl}
            alt={camera.name}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center text-white/60">
              <p className="text-lg font-medium">{camera.name}</p>
              <p className="text-sm mt-2">Stream unavailable</p>
            </div>
          </div>
        )}

        {/* Status Overlay - Top Left */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm',
              'bg-black/60 border border-white/10',
              'transition-opacity duration-200',
              isHovered || isFocused ? 'opacity-100' : 'opacity-70'
            )}
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: getStatusColor() }}
            />
            <span className="text-xs font-medium text-white/90">
              {camera.name}
            </span>
            {camera.status === 'online' && (
              <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                LIVE
              </span>
            )}
          </div>
        </div>



        {/* Timestamp Overlay - Bottom Left */}
        <div
          className={cn(
            'absolute bottom-3 left-3 px-2 py-1 rounded backdrop-blur-sm',
            'bg-black/60 border border-white/10',
            'transition-opacity duration-200',
            isHovered || isFocused ? 'opacity-100' : 'opacity-70'
          )}
        >
          <span className="text-xs font-mono text-white/80">
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        {/* Minimal Controls - Bottom Right */}
        {controlsVisible && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1">
            <button
              className="h-8 w-8 flex items-center justify-center rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all"
              title="Mute/Unmute"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </button>
            
            {!isFocused && (
              <button
                className="h-8 w-8 flex items-center justify-center rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all"
                onClick={onFocus}
                title="Expand to fullscreen"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>
        )}



        {/* Hover/Focus Border */}
        {isHovered && !isFocused && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: '2px solid rgba(255, 255, 255, 0.2)',
            }}
          />
        )}
      </div>
    </div>
  );
};
