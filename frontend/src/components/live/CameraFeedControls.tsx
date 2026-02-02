import React from 'react';
import { Camera } from '@/types/security';
import { Camera as CameraIcon, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { colors } from '@/styles/design-tokens';

interface CameraFeedControlsProps {
  camera: Camera;
  isFocused?: boolean;
  onFullscreen?: () => void;
}

export const CameraFeedControls: React.FC<CameraFeedControlsProps> = ({
  camera,
  isFocused = false,
  onFullscreen,
}) => {
  const [muted, setMuted] = React.useState(true);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
        onClick={() => setMuted(!muted)}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      
      {!isFocused && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
          onClick={onFullscreen}
          title="Expand to fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
