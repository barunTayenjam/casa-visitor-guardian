import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Camera } from '@/types/security';

interface SimpleCameraStreamProps {
  camera: Camera;
  fullscreen?: boolean;
  autoStart?: boolean;
}

export const SimpleCameraStream: React.FC<SimpleCameraStreamProps> = ({ 
  camera, 
  fullscreen = false, 
  autoStart = true 
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startStreaming = () => {
    if (intervalRef.current) return;
    
    setIsStreaming(true);
    setError(null);
    
    // Update image immediately
    updateImage();
    
    // Set up interval to refresh image
    intervalRef.current = setInterval(updateImage, 100); // 10 FPS
  };

  const stopStreaming = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
    setImageUrl('');
  };

  const updateImage = () => {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    setImageUrl(`/snapshot/${camera.id}.jpg?t=${timestamp}`);
  };

  useEffect(() => {
    if (autoStart && camera.status === 'online') {
      startStreaming();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [camera.id, autoStart, camera.status, startStreaming]);

  const toggleStream = () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  };

  const isLoading = isStreaming && !imageUrl;

  return (
    <div className="relative w-full h-full bg-slate-900">
      {camera.status === 'offline' && !isStreaming ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 text-sm font-medium">Camera Offline</p>
          </div>
        </div>
      ) : isStreaming && imageUrl ? (
        <img 
          src={imageUrl} 
          alt={`${camera.name} stream`} 
          className={`h-full w-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
          onError={() => {
            setError('Failed to load camera stream');
            stopStreaming();
          }}
        />
      ) : (
        <div 
          className="h-full flex items-center justify-center cursor-pointer"
          onClick={isLoading ? undefined : toggleStream}
        >
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-white/80 animate-spin mx-auto mb-2" />
              <p className="text-white/60 text-sm">Loading stream...</p>
            </div>
          ) : (
            <div className="text-center">
              <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
              <p className="text-white/60 text-sm">Click to Start Stream</p>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 right-2">
        <Button 
          variant="ghost" 
          size="icon"
          className="bg-black/50 text-white hover:bg-black/70 h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            toggleStream();
          }}
          disabled={isLoading}
        >
          {isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 text-center text-red-400 text-sm bg-black/50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};