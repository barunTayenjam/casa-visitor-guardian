import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, AlertTriangle, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameras } from '@/contexts/CameraContext';
import { useSocketContext } from '@/contexts/SocketContext';
import socketService from '@/services/SocketService';
import { Camera, Detection } from '@/types/security';
import { StreamHealthIndicator } from '@/components/live/StreamHealthIndicator';
import { StreamQualityIndicator } from '@/components/dashboard/StreamQualityIndicator';
import { MotionAlertOverlay } from '@/components/live/MotionAlertOverlay';
import { ScreenshotButton } from '@/components/live/ScreenshotButton';
import { ConnectionStateOverlay } from '@/components/live/ConnectionStateOverlay';
import { cn } from '@/lib/utils';

interface CameraStreamProps {
  camera: Camera;
  fullscreen?: boolean;
  autoStart?: boolean;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';

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
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Enhanced metrics
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [displayFps, setDisplayFps] = useState<number>(0);
  const [bandwidth, setBandwidth] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);
  const [viewerCount, setViewerCount] = useState<number>(0);
  
  // Motion detection
  const [motionDetected, setMotionDetected] = useState(false);
  const [motionConfidence, setMotionConfidence] = useState(0);
  const [objectCount, setObjectCount] = useState(0);
  const [lastMotionTime, setLastMotionTime] = useState<number>(0);
  
  const streamActionRef = useRef<"start" | "stop" | null>(null);

  // Fetch stream metrics
  useEffect(() => {
    if (!isStreaming) return;

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/streaming/metrics');
        if (response.ok) {
          const data = await response.json();
          const cameraMetrics = data.metrics?.find((m: any) => m.cameraId === camera.id);
          if (cameraMetrics) {
            setBandwidth(cameraMetrics.bandwidth || 0);
            setViewerCount(cameraMetrics.viewerCount || 0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch streaming metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [isStreaming, camera.id]);

  const handleStreamStart = useCallback(async () => {
    console.log(`[CameraStream] 🎬 handleStreamStart called for ${camera.id}. Socket connected: ${socketConnected}`);
    if (!socketConnected) {
      console.error("[CameraStream] Socket not connected. Cannot start stream.");
      setError("Socket not connected. Cannot start stream.");
      setConnectionState('error');
      return;
    }
    if (streamActionRef.current === "start") {
      console.warn(`[CameraStream] Stream start for ${camera.id} already in progress.`);
      return;
    }
    
    setError(null);
    setConnectionState('connecting');
    streamActionRef.current = "start";
    setIsStreaming(true);
    console.log(`[CameraStream] 🟢 Set isStreaming to true for ${camera.id}`);
    
    // Reset FPS counters
    frameCountRef.current = 0;
    lastFrameTimeRef.current = performance.now();
    
    // Set a timeout for connection
    const connectionTimeout = setTimeout(() => {
      if (connectionState === 'connecting') {
        setConnectionState('error');
        setError('Connection timeout. Please try again.');
        setIsStreaming(false);
      }
    }, 10000);
    
    try {
      console.log(`[CameraStream] ▶️ Requesting stream from server for ${camera.id}`);
      const startTime = Date.now();
      await startCameraStream(camera.id);
      setLatency(Date.now() - startTime);
      clearTimeout(connectionTimeout);
      setConnectionState('connected');
      console.log(`[CameraStream] ✅ Stream request successful for ${camera.id}`);
    } catch (err) {
      clearTimeout(connectionTimeout);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      console.error(`[CameraStream] ❌ Error starting stream for ${camera.id}:`, errorMessage);
      setError(errorMessage);
      setConnectionState('error');
      setIsStreaming(false);
      streamActionRef.current = null;
    }
  }, [camera.id, startCameraStream, socketConnected, connectionState]);

  const handleStreamStop = useCallback(() => {
    console.log(`[CameraStream] 🎬 handleStreamStop called for ${camera.id}`);
    if (streamActionRef.current === "stop") {
      console.warn(`[CameraStream] Stream stop for ${camera.id} already in progress.`);
      return;
    }
    
    streamActionRef.current = "stop";
    setIsStreaming(false);
    setConnectionState('idle');
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
    if (socketConnected && autoStart && !isStreaming && connectionState === 'idle') {
      console.log(`[CameraStream] 🚀 Socket connected, auto-starting stream for ${camera.id}`);
      handleStreamStart();
    }
    
    // If socket disconnected while streaming
    if (!socketConnected && isStreaming && connectionState === 'connected') {
      console.log(`[CameraStream] ⚠️ Socket disconnected, reconnecting ${camera.id}`);
      setConnectionState('reconnecting');
    }
  }, [socketConnected, connectionStatus, autoStart, isStreaming, connectionState, handleStreamStart, camera.id]);

  // Effect for handling WebSocket events
  useEffect(() => {
    console.log(`[CameraStream] 🎧 Registering WebSocket listeners for ${camera.id}`);

    // Frame rate limiting to prevent excessive updates
    let lastFrameUpdate = 0;
    const FRAME_UPDATE_INTERVAL = 66; // Increased to ~15 FPS for smoother video

    // Handle frame data (base64 format with cameraId)
    const handleFrame = (data: {
      cameraId: string;
      role: string;
      timestamp: string;
      data: string; // Base64 encoded JPEG
    }) => {
      // CRITICAL: Only process frames for THIS camera
      if (data.cameraId !== camera.id) {
        return; // Ignore frames from other cameras
      }

      const now = Date.now();

      // Limit frame updates to prevent excessive rendering
      if (now - lastFrameUpdate >= FRAME_UPDATE_INTERVAL) {
        lastFrameUpdate = now;

        // Update image with base64 data
        if (imgRef.current) {
          imgRef.current.src = `data:image/jpeg;base64,${data.data}`;
          
          // Update bandwidth estimate (base64 is ~33% larger than raw)
          const base64Size = data.data.length * 0.75;
          setBandwidth(prev => {
            const newBandwidth = base64Size * 4; // Rough estimate at current FPS
            return prev * 0.7 + newBandwidth * 0.3; // Smooth average
          });
        }

        // FPS calculation
        frameCountRef.current++;
        const perfNow = performance.now();
        const elapsed = perfNow - lastFrameTimeRef.current;

        if (elapsed >= 2000) { // Update FPS display every 2 seconds
          const fps = Math.round((frameCountRef.current * 1000) / elapsed);
          setDisplayFps(fps);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = perfNow;
        }
      }
    };
    
    // Handle detection events (motion alerts)
    const handleDetection = (data: {
      cameraId: string;
      detections: any[];
      timestamp: string;
      metadata?: any;
    }) => {
      if (data.cameraId !== camera.id) return;
      
      const detections = data.detections || [];
      if (detections.length > 0) {
        const confidence = data.metadata?.confidence || 0;
        setMotionDetected(true);
        setMotionConfidence(confidence);
        setObjectCount(detections.length);
        setLastMotionTime(Date.now());
        
        // Auto-hide motion alert after 3 seconds
        setTimeout(() => {
          setMotionDetected(false);
        }, 3000);
      }
    };

    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        console.error(`[CameraStream] ❌ WebSocket error for ${camera.id}: ${data.error}`);
        setError(data.error);
        setConnectionState('error');
        setIsStreaming(false);
      }
    };

    // Subscribe to frame events (now includes cameraId filtering)
    const frameUnsubscribe = socketService.on('frame', handleFrame);
    const detectionUnsubscribe = socketService.on('detection', handleDetection);
    const errorUnsubscribe = socketService.on('camera-error', handleError);

    return () => {
      console.log(`[CameraStream] 🗑️ Unregistering WebSocket listeners for ${camera.id}`);
      // Unsubscribe from frame events
      frameUnsubscribe();
      detectionUnsubscribe();
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

  const isLoading = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div className="relative w-full h-full bg-slate-900">
      {camera.status === 'offline' && !isStreaming ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 text-sm font-medium">Camera Offline</p>
          </div>
        </div>
      ) : (
        <>
          {/* Connection State Overlay */}
          {(connectionState === 'connecting' || connectionState === 'error' || connectionState === 'reconnecting') && (
            <ConnectionStateOverlay
              state={connectionState}
              cameraName={camera.name}
              errorMessage={error || undefined}
            />
          )}

          {/* Motion Alert Overlay */}
          <MotionAlertOverlay
            hasMotion={motionDetected}
            confidence={motionConfidence}
            objectCount={objectCount}
          />

          {/* Camera Stream */}
          <img
            ref={imgRef}
            alt={`${camera.name} stream`}
            className={cn(
              "h-full w-full object-contain",
              !isStreaming && connectionState !== 'connecting' && connectionState !== 'reconnecting' && 'hidden'
            )}
          />

          {!isStreaming && connectionState === 'idle' && (
             <div 
               className="h-full flex items-center justify-center cursor-pointer"
               onClick={toggleStream}
             >
               <div className="text-center">
                 <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
                 <p className="text-white/60 text-sm">Click to Start Stream</p>
               </div>
             </div>
          )}

          {/* Top Left: Camera Name + Status */}
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-black/60 border border-white/10">
              <div className={cn(
                "w-2 h-2 rounded-full",
                connectionState === 'connected' && isStreaming ? "bg-green-500 animate-pulse" : "bg-red-500"
              )} />
              <span className="text-xs font-medium text-white/90">
                {camera.name}
              </span>
              {connectionState === 'connected' && isStreaming && (
                <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                  LIVE
                </span>
              )}
            </div>
          </div>

          {/* Top Right: Stream Quality Indicator */}
          {connectionState === 'connected' && isStreaming && (
            <div className="absolute top-3 right-3 z-20">
              <StreamQualityIndicator
                metrics={{
                  resolution: camera.isActive && camera.config?.streams?.[0]?.width 
                    ? `${camera.config.streams[0].width}x${camera.config.streams[0].height}`
                    : '720p',
                  fps: displayFps || 0,
                  bandwidth: Math.round(bandwidth / 1024), // Convert to Kbps
                  latency: latency
                }}
              />
            </div>
          )}

          {/* Bottom Left: Timestamp */}
          {connectionState === 'connected' && isStreaming && (
            <div className="absolute bottom-3 left-3 z-20">
              <div className="px-2 py-1 rounded backdrop-blur-sm bg-black/60 border border-white/10">
                <span className="text-xs font-mono text-white/80">
                  {new Date().toLocaleTimeString('en-US', { hour12: false })}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Right: Controls */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center space-x-2">
            {connectionState === 'connected' && isStreaming && (
              <>
                <ScreenshotButton
                  camera={camera}
                  imgRef={imgRef}
                  className="bg-black/50 text-white hover:bg-black/70 h-8 w-8"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-black/50 text-white hover:bg-black/70 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStream();
                  }}
                  title="Stop Stream"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              </>
            )}
            
            {connectionState !== 'connected' && (
              <Button 
                variant="ghost" 
                size="icon"
                className="bg-black/50 text-white hover:bg-black/70 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStream();
                }}
                disabled={isLoading}
                title={isStreaming ? "Connecting..." : "Start Stream"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Error Message */}
          {error && connectionState === 'error' && (
            <div className="absolute bottom-16 left-4 right-4 text-center text-red-400 text-sm bg-black/50 p-2 rounded">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
};

