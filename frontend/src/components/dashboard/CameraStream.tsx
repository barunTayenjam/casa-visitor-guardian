import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameras } from '@/contexts/CameraContext';
import { useSocketContext } from '@/contexts/SocketContext';
import socketService from '@/services/SocketService';
import { Camera, Detection } from '@/types/security';

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
  console.log(`[CameraStream] 🎥 Mounting for camera: ${camera.name} (${camera.id}) | AutoStart: ${autoStart}`);

  const { startCameraStream, stopCameraStream } = useCameras();
  const { connected: socketConnected, connectionStatus } = useSocketContext();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detectionResolution, setDetectionResolution] = useState<{ width: number; height: number } | undefined>();
  const [displayResolution, setDisplayResolution] = useState<{ width: number; height: number } | undefined>();
  
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [displayFps, setDisplayFps] = useState<number>(0);
  const streamActionRef = useRef<"start" | "stop" | null>(null);

  const handleStreamStart = useCallback(async () => {
    console.log(`[CameraStream] 🎬 handleStreamStart called for ${camera.id}. Socket connected: ${socketConnected}`);
    if (!socketConnected) {
      console.error("[CameraStream] Socket not connected. Cannot start stream.");
      setError("Socket not connected. Cannot start stream.");
      return;
    }
    if (streamActionRef.current === "start") {
      console.warn(`[CameraStream] Stream start for ${camera.id} already in progress.`);
      return;
    }
    
    setError(null);
    streamActionRef.current = "start";
    setIsStreaming(true);
    console.log(`[CameraStream] 🟢 Set isStreaming to true for ${camera.id}`);
    
    // Reset FPS counters
    frameCountRef.current = 0;
    lastFrameTimeRef.current = performance.now();
    
    try {
      console.log(`[CameraStream] ▶️ Requesting stream from server for ${camera.id}`);
      await startCameraStream(camera.id);
      console.log(`[CameraStream] ✅ Stream request successful for ${camera.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      console.error(`[CameraStream] ❌ Error starting stream for ${camera.id}:`, errorMessage);
      setError(errorMessage);
      setIsStreaming(false);
      streamActionRef.current = null;
    }
  }, [camera.id, startCameraStream, socketConnected]);

  const handleStreamStop = useCallback(() => {
    console.log(`[CameraStream] 🎬 handleStreamStop called for ${camera.id}`);
    if (streamActionRef.current === "stop") {
      console.warn(`[CameraStream] Stream stop for ${camera.id} already in progress.`);
      return;
    }
    
    streamActionRef.current = "stop";
    setIsStreaming(false);
    setCurrentFrame(null);
    setDetections([]);
    console.log(`[CameraStream] 🔴 Set isStreaming to false for ${camera.id}`);
    stopCameraStream(camera.id).catch(err => {
      console.error(`[CameraStream] ❌ Failed to stop stream for ${camera.id}:`, err);
    });
  }, [camera.id, stopCameraStream]);

  // Effect for auto-starting/stopping based on props
  useEffect(() => {
    console.log(`[CameraStream] 🔄 Auto-start/stop effect for ${camera.id}. autoStart: ${autoStart}, socketConnected: ${socketConnected}, isStreaming: ${isStreaming}`);

    if (autoStart && socketConnected && !isStreaming) {
      console.log(`[CameraStream] 🚀 Auto-starting stream for ${camera.id}`);
      handleStreamStart();
    } else if (!autoStart && isStreaming) {
      console.log(`[CameraStream] 🛑 Auto-stopping stream for ${camera.id}`);
      handleStreamStop();
    }

    // Cleanup on unmount
    return () => {
      console.log(`[CameraStream] 🧹 Cleanup effect for ${camera.id}. isStreaming: ${isStreaming}`);
      if (isStreaming) {
        handleStreamStop();
      }
    };
  }, [camera.id, autoStart, socketConnected, isStreaming, handleStreamStart, handleStreamStop]);

  // Effect to handle socket connection changes for auto-start
  useEffect(() => {
    console.log(`[CameraStream] 🔄 Socket connection status changed for ${camera.id}. Status: ${connectionStatus}, socketConnected: ${socketConnected}, autoStart: ${autoStart}, isStreaming: ${isStreaming}`);

    // If socket just connected, autoStart is true, and we're not already streaming, start the stream
    if (socketConnected && autoStart && !isStreaming) {
      console.log(`[CameraStream] 🚀 Socket connected, auto-starting stream for ${camera.id}`);
      handleStreamStart();
    }
  }, [socketConnected, connectionStatus, autoStart, isStreaming, handleStreamStart]);

  // Effect for handling WebSocket events
  useEffect(() => {
    console.log(`[CameraStream] 🎧 Registering WebSocket listeners for ${camera.id}`);

    // Frame rate limiting to prevent excessive updates
    let lastFrameUpdate = 0;
    const FRAME_UPDATE_INTERVAL = 100; // ~10 FPS max update rate (100ms)

    const handleFrame = (data: { cameraId: string; data: string; timestamp: string }) => {
      if (data.cameraId === camera.id) {
        const now = Date.now();

        // Limit frame updates to prevent excessive rendering
        if (now - lastFrameUpdate >= FRAME_UPDATE_INTERVAL) {
          lastFrameUpdate = now;

          // Create a new image object to properly handle loading
          const img = new Image();
          img.onload = () => {
            // Only update state if the image loaded successfully
            setCurrentFrame(`data:image/jpeg;base64,${data.data}`);

            // FPS calculation
            frameCountRef.current++;
            const perfNow = performance.now();
            const elapsed = perfNow - lastFrameTimeRef.current;

            if (elapsed >= 1000) {
              const fps = Math.round((frameCountRef.current * 1000) / elapsed);
              setDisplayFps(fps);
              frameCountRef.current = 0;
              lastFrameTimeRef.current = perfNow;
            }
          };
          img.onerror = () => {
            console.error(`[CameraStream] 💥 Failed to load image frame for ${camera.id}`);
          };
          img.src = `data:image/jpeg;base64,${data.data}`;
        }
      }
    };

    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        console.error(`[CameraStream] ❌ WebSocket error for ${camera.id}: ${data.error}`);
        setError(data.error);
        setIsStreaming(false);
      }
    };

     // Listen for detection events
     const handleDetection = (data: {
       cameraId: string;
       detections: Detection[];
       detectionResolution?: { width: number; height: number };
       displayResolution?: { width: number; height: number };
     }) => {
       if (data.cameraId === camera.id) {
         console.log(`[CameraStream] 🎯 Received ${data.detections.length} detections for ${camera.id}`);
         setDetectionResolution(data.detectionResolution);
         setDisplayResolution(data.displayResolution);
       }
     };

     const frameUnsubscribe = socketService.on('frame', handleFrame);
     const errorUnsubscribe = socketService.on('camera-error', handleError);

     return () => {
       console.log(`[CameraStream] 🗑️ Unregistering WebSocket listeners for ${camera.id}`);
       frameUnsubscribe();
       errorUnsubscribe();
     };
   }, [camera.id]);

  const toggleStream = () => {
    console.log(`[CameraStream] ⏯️ toggleStream called for ${camera.id}. Currently streaming: ${isStreaming}`);
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

      <div className="absolute bottom-2 right-2 flex items-center space-x-2">
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

