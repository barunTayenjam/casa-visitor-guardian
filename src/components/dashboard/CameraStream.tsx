import React, { useEffect, useState, useRef } from 'react';
import { Play, PauseIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import socketService from '@/services/SocketService';
import apiService from '@/services/ApiService';
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const [displayFps, setDisplayFps] = useState<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef<number>(0);
  const maxRetries = 5;
  
  // Function to start streaming
  const startStream = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsConnecting(true);
      
      // Reset retry count if this is a manual start
      if (!autoStart) {
        retryCountRef.current = 0;
      }
      
      // Ensure socket is connected
      if (!socketService.isConnected()) {
        await socketService.connect();
      }
      
      // Ensure backend stream is active
      await apiService.startCameraStream(camera.id);
      
      // Request stream from WebSocket
      socketService.requestStream(camera.id);
      setIsStreaming(true);
      
      // Reset FPS counter
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();
      
      console.log(`Stream started successfully for camera ${camera.id}`);
    } catch (err) {
      console.error('Failed to start stream:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to camera stream';
      setError(errorMessage);
      setIsStreaming(false);
      
      // Auto retry with exponential backoff if enabled
      if (autoStart && retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;
        console.log(`Retrying stream in ${delay/1000} seconds (attempt ${retryCountRef.current}/${maxRetries})`);
        retryTimeoutRef.current = setTimeout(startStream, delay);
      }
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  }, [autoStart, camera.id]);

  // Function to stop streaming
  const stopStream = React.useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    socketService.stopStream(camera.id);
    apiService.stopCameraStream(camera.id).catch(console.error);
    setIsStreaming(false);
    setCurrentFrame(null);
    setError(null);
    retryCountRef.current = 0;
  }, [camera.id]);

  // Auto-start streaming if enabled
  useEffect(() => {
    if (autoStart && !isStreaming && !isLoading) {
      startStream();
    }
    return () => {
      if (isStreaming) {
        stopStream();
      }
    };
  }, [camera.id, autoStart, isStreaming, isLoading, startStream, stopStream]);

  // Handle frame reception from WebSocket with improved error handling
  useEffect(() => {
    if (!isStreaming) return;

    // Handle incoming video frames
    const handleFrame = (data: { cameraId: string; data: string; timestamp: string }) => {
      if (data.cameraId === camera.id) {
        // Clear any previous error state since we're receiving frames
        if (error) setError(null);
        if (retryCountRef.current > 0) retryCountRef.current = 0;
        
        try {
          // Validate frame data
          if (!data.data || typeof data.data !== 'string') {
            console.warn(`Camera ${data.cameraId}: Invalid frame data received`);
            return;
          }
          
          // Create image data URL
          const imageDataUrl = `data:image/jpeg;base64,${data.data}`;
          setCurrentFrame(imageDataUrl);
          
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
          setError('Error processing video frame');
        }
      }
    };
    
    // Handle camera status updates
    const handleStatus = (data: { cameraId: string; status: string; message?: string }) => {
      if (data.cameraId === camera.id) {
        if (data.status === 'offline' || data.status === 'error') {
          setError(data.message || 'Camera stream disconnected');
          stopStream();
          // Auto retry with delay if autoStart is enabled
          if (autoStart && retryCountRef.current < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
            retryCountRef.current++;
            console.log(`Camera offline, retrying in ${delay/1000} seconds (attempt ${retryCountRef.current}/${maxRetries})`);
            retryTimeoutRef.current = setTimeout(startStream, delay);
          }
        } else if (data.status === 'reconnecting') {
          setError(data.message || 'Reconnecting to camera...');
        } else if (data.status === 'online') {
          setError(null);
          retryCountRef.current = 0;
        }
      }
    };

    // Handle camera errors
    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        setError(data.error);
        // Auto retry with delay if autoStart is enabled
        if (autoStart && retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          console.log(`Stream error, retrying in ${delay/1000} seconds (attempt ${retryCountRef.current}/${maxRetries})`);
          retryTimeoutRef.current = setTimeout(startStream, delay);
        }
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [camera.id, isStreaming, error, autoStart, startStream, stopStream]);

  // Toggle stream on/off
  const toggleStream = () => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0">
        {camera.status === 'offline' ? (
          <div className="h-full bg-slate-800 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-500 text-sm font-medium">Camera Offline</p>
              {error && (
                <p className="text-red-400 text-xs mt-1 max-w-[200px] text-center">{error}</p>
              )}
            </div>
          </div>
        ) : isStreaming ? (
          <div className="relative h-full bg-black">
            {currentFrame ? (
              <img 
                src={currentFrame} 
                alt={`${camera.name} stream`} 
                className={`h-full w-full ${fullscreen ? 'object-contain' : 'object-contain'}`}
                style={{ aspectRatio: '16/9' }}
                onError={(e) => {
                  console.error('Image load error:', e);
                  setError('Failed to load video frame');
                }}
                onLoad={() => {
                  // Image loaded successfully
                  if (error) setError(null);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Waiting for video...</p>
                </div>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute bottom-2 right-2 bg-black/50 text-white hover:bg-black/70 h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                toggleStream();
              }}
            >
              <PauseIcon className="h-4 w-4" />
            </Button>
            {displayFps > 0 && (
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                {displayFps} FPS
              </div>
            )}
          </div>
        ) : (
          <div 
            className="h-full bg-slate-900 flex items-center justify-center cursor-pointer"
            onClick={isLoading ? undefined : toggleStream}
          >
            {isLoading || isConnecting ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 text-white/80 animate-spin mx-auto mb-2" />
                <p className="text-white/60 text-sm">
                  {isConnecting ? 'Connecting...' : 'Loading...'}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
                <p className="text-white/60 text-sm">Click to Start Stream</p>
              </div>
            )}
            {error && (
              <p className="absolute bottom-4 left-0 right-0 text-center text-red-400 text-sm">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
