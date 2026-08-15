import React from 'react';
import { Volume2, VolumeX, Maximize } from 'lucide-react';

interface StreamControlsProps {
  isMuted: boolean;
  onMuteToggle: () => void;
  onFullscreen: () => void;
}

export const StreamControls: React.FC<StreamControlsProps> = ({
  isMuted,
  onMuteToggle,
  onFullscreen,
}) => {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        className="h-11 w-11 flex items-center justify-center rounded-full backdrop-blur-sm bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onMuteToggle();
        }}
        title={isMuted ? 'Unmute' : 'Mute'}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <button
        className="h-11 w-11 flex items-center justify-center rounded-full backdrop-blur-sm bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onFullscreen();
        }}
        title="Fullscreen"
        aria-label="Toggle fullscreen"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
};
