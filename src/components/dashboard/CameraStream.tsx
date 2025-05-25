import React, { useEffect, useState, useRef } from 'react';
import { Play, PauseIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import socketService from '@/services/SocketService';
import apiService from '@/services/ApiService';
import { Camera } from '@/types/security';

interface CameraStreamProps {
  camera: Camera;
  fullscreen?: boolean;
}

export const CameraStream: React.FC<CameraStreamProps> = ({ camera, fullscreen = false }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const [displayFps, setDisplayFps] = useState<number>(0);

  // Function to start streaming
  const startStream = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Ensure backend stream is active
      await apiService.startCameraStream(camera.id);
      
      // Request stream from WebSocket
      socketService.requestStream(camera.id);
      setIsStreaming(true);
      
      // Reset FPS counter
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError('Failed to connect to camera stream');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to stop streaming
  const stopStream = () => {
    socketService.stopStream(camera.id);
    setIsStreaming(false);
    setCurrentFrame(null);
  };

  // Handle frame reception from WebSocket with improved error handling
  useEffect(() => {
    if (!isStreaming) return;

    // Handle incoming video frames
    const handleFrame = (data: { cameraId: string; data: string; timestamp: string }) => {
      if (data.cameraId === camera.id) {
        // Clear any previous error state
        if (error) setError(null);
        
        try {
          // Update current frame with proper data URL format
          setCurrentFrame(`data:image/jpeg;base64,${data.data}`);
          
          // Calculate FPS
          frameCountRef.current++;
          const now = performance.now();
          const elapsed = now - lastFrameTimeRef.current;
          
          // Update FPS counter every second
          if (elapsed >= 1000) {
            fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);
            setDisplayFps(fpsRef.current);
            frameCountRef.current = 0;
            lastFrameTimeRef.current = now;
          }
        } catch (err) {
          console.error('Error processing frame:', err);
        }
      }
    };
    
    // Handle camera status updates
    const handleStatus = (data: { cameraId: string; status: string; message?: string }) => {
      if (data.cameraId === camera.id) {
        if (data.status === 'offline' || data.status === 'error') {
          setError(data.message || 'Camera stream disconnected');
        } else if (data.status === 'reconnecting') {
          setError(data.message || 'Reconnecting to camera...');
        }
      }
    };

    // Handle camera errors
    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        setError(data.error);
      }
    };

    // Register handlers
    const frameUnsubscribe = socketService.on('frame', handleFrame);
    const statusUnsubscribe = socketService.on('camera-status', handleStatus);
    const errorUnsubscribe = socketService.on('camera-error', handleError);

    // Ensure socket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Clean up when component unmounts or stream stops
    return () => {
      frameUnsubscribe();
      statusUnsubscribe();
      errorUnsubscribe();
    };
  }, [camera.id, isStreaming, error]);

  // Toggle stream on/off
  const toggleStream = () => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        socketService.stopStream(camera.id);
      }
    };
  }, [camera.id, isStreaming]);

  // Handle camera status
  const isOffline = camera.status === 'offline';

  return (
    <div 
      className={`camera-stream relative overflow-hidden rounded-lg ${fullscreen ? 'h-full w-full' : 'h-48 sm:h-64'}`}
    >
      {isOffline ? (
        // Offline state
        <div className="h-full bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 text-sm font-medium">Camera Offline</p>
            <p className="text-muted-foreground text-xs">
              Last seen: {camera.lastSeen.toLocaleTimeString()}
            </p>
          </div>
        </div>
      ) : isStreaming && currentFrame ? (
        // Active stream
        <div className="relative h-full">
          <img 
            src={currentFrame} 
            alt={`${camera.name} stream`} 
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-md">
              {displayFps} FPS
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="bg-black/50 text-white hover:bg-black/70 h-8 w-8"
              onClick={toggleStream}
            >
              <PauseIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Inactive stream
        <div 
          className="relative h-full bg-slate-900 flex items-center justify-center cursor-pointer"
          onClick={isLoading ? undefined : toggleStream}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
          <div className="text-center z-10">
            {isLoading ? (
              <div className="bg-black/50 rounded-full p-4 mb-2">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            ) : (
              <div className="bg-black/50 rounded-full p-4 mb-2 hover:bg-black/70 transition-colors">
                <Play className="h-8 w-8 text-white" />
              </div>
            )}
            
            <p className="text-white text-sm font-medium">
              {isLoading ? 'Connecting...' : 'Click to view live'}
            </p>
            
            {error ? (
              <p className="text-red-400 text-xs mt-1">{error}</p>
            ) : (
              <p className="text-white/60 text-xs">{camera.resolution} • {camera.fps}fps</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
