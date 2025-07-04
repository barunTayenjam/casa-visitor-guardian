import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, PauseIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameras } from '@/contexts/CameraContext';
import { useSocketContext } from '@/contexts/SocketContext';
import socketService from '@/services/SocketService';
import { Camera } from '@/types/security';

interface CameraStreamProps {
  camera: Camera;
  fullscreen?: boolean;
  autoStart?: boolean;
}

export const CameraStream: React.FC<CameraStreamProps> = ({ 
  camera, 
  fullscreen = false, 
  autoStart = true 
}) => {
  const { startCameraStream, stopCameraStream } = useCameras();
  const { connected: socketConnected, connectionStatus } = useSocketContext();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [displayFps, setDisplayFps] = useState<number>(0);

  const handleStreamStart = useCallback(async () => {
    if (!socketConnected) {
      setError("Socket not connected. Cannot start stream.");
      return;
    }
    setError(null);
    setIsStreaming(true);
    try {
      await startCameraStream(camera.id);
      // Reset FPS counter
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMessage);
      setIsStreaming(false);
    }
  }, [camera.id, startCameraStream, socketConnected]);

  const handleStreamStop = useCallback(() => {
    setIsStreaming(false);
    setCurrentFrame(null);
    stopCameraStream(camera.id).catch(err => {
      console.error("Failed to stop stream:", err);
    });
  }, [camera.id, stopCameraStream]);

  // Auto-start or stop streaming
  useEffect(() => {
    if (autoStart && socketConnected && !isStreaming) {
      handleStreamStart();
    }
    
    return () => {
      if (isStreaming) {
        handleStreamStop();
      }
    };
  }, [camera.id, autoStart, socketConnected, isStreaming, handleStreamStart, handleStreamStop]);

  // Handle frame reception from WebSocket
  useEffect(() => {
    const handleFrame = (data: { cameraId: string; data: string; timestamp: string }) => {
      if (data.cameraId === camera.id) {
        if (error) setError(null);
        
        const imageDataUrl = `data:image/jpeg;base64,${data.data}`;
        setCurrentFrame(imageDataUrl);
        
        // Calculate FPS
        frameCountRef.current++;
        const now = performance.now();
        const elapsed = now - lastFrameTimeRef.current;
        
        if (elapsed >= 1000) {
          const fps = Math.round((frameCountRef.current * 1000) / elapsed);
          setDisplayFps(fps);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      }
    };

    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        setError(data.error);
        setIsStreaming(false);
      }
    };

    const frameUnsubscribe = socketService.on('frame', handleFrame);
    const errorUnsubscribe = socketService.on('camera-error', handleError);

    return () => {
      frameUnsubscribe();
      errorUnsubscribe();
    };
  }, [camera.id, isStreaming, error]);

  const toggleStream = () => {
    if (isStreaming) {
      handleStreamStop();
    } else {
      handleStreamStart();
    }
  };

  const isLoading = connectionStatus === 'connecting' || (isStreaming && !currentFrame);

  return (
    <div className="relative w-full h-full bg-slate-900">
      {camera.status === 'offline' && !isStreaming ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 text-sm font-medium">Camera Offline</p>
          </div>
        </div>
      ) : isStreaming && currentFrame ? (
        <img 
          src={currentFrame} 
          alt={`${camera.name} stream`} 
          className={`h-full w-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
          onError={() => setError('Failed to load video frame')}
        />
      ) : (
        <div 
          className="h-full flex items-center justify-center cursor-pointer"
          onClick={isLoading ? undefined : toggleStream}
        >
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-white/80 animate-spin mx-auto mb-2" />
              <p className="text-white/60 text-sm">
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Waiting for video...'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
              <p className="text-white/60 text-sm">Click to Start Stream</p>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-2 right-2 flex items-center space-x-2">
        {isStreaming && displayFps > 0 && (
          <div className="bg-black/50 text-white px-2 py-1 rounded text-xs">
            {displayFps} FPS
          </div>
        )}
      </div>

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
          {isStreaming ? <PauseIcon className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
