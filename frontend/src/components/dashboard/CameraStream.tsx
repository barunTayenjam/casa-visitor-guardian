import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Loader2, AlertTriangle } from 'lucide-react';
import { useCameras } from '@/contexts/CameraContext';
import { useSocketContext } from '@/contexts/SocketContext';
import socketService from '@/services/SocketService';
import { Camera } from '@/types/security';
import { ConnectionStateOverlay } from '@/components/live/ConnectionStateOverlay';
import { StreamPanel } from '@/components/live/StreamPanel';
import { CameraStreamSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils';

interface CameraStreamProps {
  camera: Camera;
  autoStart?: boolean;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface StreamMetrics {
  fps: number;
  bandwidth: number;
  latency: number;
  resolution: string;
}

interface MotionState {
  detected: boolean;
  confidence: number;
  objectCount: number;
  lastMotionTime: number;
}

export const CameraStream: React.FC<CameraStreamProps> = ({
  camera,
  autoStart = true
}) => {
  const { startCameraStream, stopCameraStream } = useCameras();
  const { connected: socketConnected, connectionStatus } = useSocketContext();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Stream metrics consolidated into single object
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<StreamMetrics>({
    fps: 0,
    bandwidth: 0,
    latency: 0,
    resolution: camera.config?.detect?.width
      ? `${camera.config.detect.width}x${camera.config.detect.height}`
      : '720p',
  });

  // Motion state — separate from metrics (frequently updated)
  const [motion, setMotion] = useState<MotionState>({
    detected: false,
    confidence: 0,
    objectCount: 0,
    lastMotionTime: 0,
  });

  const streamActionRef = useRef<"start" | "stop" | null>(null);
  const connectionStartTimeRef = useRef<number>(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeDetectionRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const frameErrorRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  // === Anti-flicker: Cooldown and throttling ===
  const lastRestartTimeRef = useRef<number>(0);
  const restartCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef<number>(0);
  const connectionAttemptsRef = useRef<number>(0);
  const lastConnectionAttemptRef = useRef<number>(0);

  // Refs to store function references (to avoid circular dependency issues)
  const handleStreamStartRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleStreamStopRef = useRef<() => void>(() => {});

  // Anti-flicker constants
  const RESTART_COOLDOWN_MS = 5000; // 5 seconds minimum between restarts
  const VISIBILITY_DEBOUNCE_MS = 2000; // 2 second debounce for visibility changes
  const MAX_FAILURE_COUNT = 3; // After this many failures, use exponential backoff
  const CONNECTION_RATE_LIMIT_MS = 3000; // 3 seconds between connection attempts
  const MAX_CONNECTION_ATTEMPTS_PER_MINUTE = 10; // Rate limit to prevent server overload

  // === Anti-flicker helper functions ===
  const rateLimitResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canRestartStream = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRestart = now - lastRestartTimeRef.current;

    if (timeSinceLastRestart < RESTART_COOLDOWN_MS) {
      return false;
    }

    if (now - lastConnectionAttemptRef.current < CONNECTION_RATE_LIMIT_MS) {
      return false;
    }

    connectionAttemptsRef.current++;
    if (connectionAttemptsRef.current > MAX_CONNECTION_ATTEMPTS_PER_MINUTE) {
      if (!rateLimitResetRef.current) {
        rateLimitResetRef.current = setTimeout(() => {
          connectionAttemptsRef.current = 0;
          rateLimitResetRef.current = null;
        }, 60000);
      }
      return false;
    }

    lastRestartTimeRef.current = now;
    lastConnectionAttemptRef.current = now;
    return true;
  }, []);

  const handleStreamRestart = useCallback(() => {
    if (!canRestartStream()) return;

    if (failureCountRef.current >= MAX_FAILURE_COUNT) {
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, failureCountRef.current - MAX_FAILURE_COUNT));
      if (restartCooldownRef.current) clearTimeout(restartCooldownRef.current);
      restartCooldownRef.current = setTimeout(() => {
        failureCountRef.current = 0;
        streamActionRef.current = null;
        handleStreamStopRef.current();
        setTimeout(() => {
          hasAutoStartedRef.current = false;
          handleStreamStartRef.current();
        }, 500);
      }, backoffMs);
      return;
    }

    streamActionRef.current = null;
    hasAutoStartedRef.current = false;
    handleStreamStopRef.current();
    setTimeout(() => handleStreamStartRef.current(), 1000);
  }, [canRestartStream]);

  // Panel state — tap to toggle, swipe does NOT open panel
  const [panelOpen, setPanelOpen] = useState(false);

  // Determine if full connection overlay should show (initial connection or persistent error)
  const [showFullOverlay, setShowFullOverlay] = useState(false);

  useEffect(() => {
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      setShowFullOverlay(true);
      connectionStartTimeRef.current = Date.now();
    }
    if (connectionState === 'connected') {
      setShowFullOverlay(false);
    }
    if (connectionState === 'error') {
      // Keep overlay for errors
      setShowFullOverlay(true);
    }
    if (connectionState === 'idle') {
      setShowFullOverlay(false);
    }
  }, [connectionState]);

  // Auto-dismiss full connecting overlay after 5 seconds if still connecting
  useEffect(() => {
    if ((connectionState === 'connecting' || connectionState === 'reconnecting') && showFullOverlay) {
      const timer = setTimeout(() => {
        setShowFullOverlay(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionState, showFullOverlay]);

  // Tap-to-toggle panel (not swipe)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    swipeDetectionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!swipeDetectionRef.current) return;
    const dx = Math.abs(e.clientX - swipeDetectionRef.current.startX);
    const dy = Math.abs(e.clientY - swipeDetectionRef.current.startY);
    if (dx > 10 || dy > 10) {
      swipeDetectionRef.current.moved = true;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (swipeDetectionRef.current && !swipeDetectionRef.current.moved) {
      setPanelOpen(prev => !prev);
    }
    swipeDetectionRef.current = null;
  }, []);

  // Fetch stream metrics from API
  useEffect(() => {
    if (!isStreaming) return;

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/streaming/metrics');
        if (response.ok) {
          const data = await response.json();
          const cameraMetrics = data.metrics?.find((m: { cameraId: string }) => m.cameraId === camera.id);
          if (cameraMetrics) {
            setMetrics(prev => ({ ...prev, bandwidth: cameraMetrics.bandwidth || 0 }));
          }
        }
      } catch {
        // Silently fail — metrics are non-critical
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [isStreaming, camera.id]);

  const handleStreamStart = useCallback(async () => {
    console.log('[STREAM] CameraStream.handleStreamStart:', camera.id, 'socketConnected:', socketConnected);
    if (!socketConnected) {
      console.log('[STREAM] ❌ handleStreamStart — socket not connected for', camera.id);
      setError("Socket not connected. Cannot start stream.");
      setConnectionState('error');
      return;
    }
    if (streamActionRef.current === "start") {
      console.log('[STREAM] handleStreamStart — already starting, skip:', camera.id);
      return;
    }

    setError(null);
    setConnectionState('connecting');
    streamActionRef.current = "start";
    setIsStreaming(true);
    hasAutoStartedRef.current = true;

    frameCountRef.current = 0;
    lastFrameTimeRef.current = Date.now();

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      console.log('[STREAM] ⏱ handleStreamStart timeout fired for', camera.id);
      streamActionRef.current = null;
      hasAutoStartedRef.current = false;
      setConnectionState('error');
      setError('Connection timeout. Please try again.');
      setIsStreaming(false);
    }, 10000);

    try {
      const startTime = Date.now();
      console.log('[STREAM] Calling startCameraStream for', camera.id);
      await startCameraStream(camera.id);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const elapsed = Date.now() - startTime;
      setMetrics(prev => ({ ...prev, latency: elapsed }));
      console.log('[STREAM] ✅ startCameraStream resolved for', camera.id, 'in', elapsed, 'ms');
      failureCountRef.current = 0;
      connectionAttemptsRef.current = 0;
      setConnectionState('connected');
    } catch (err) {
      console.log('[STREAM] ❌ startCameraStream failed for', camera.id, err);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMessage);
      setConnectionState('error');
      setIsStreaming(false);
      streamActionRef.current = null;
    }
  }, [camera.id, startCameraStream, socketConnected]);

  const handleStreamStop = useCallback(() => {
    console.log('[STREAM] CameraStream.handleStreamStop:', camera.id);
    if (streamActionRef.current === "stop") return;

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    streamActionRef.current = "stop";
    setIsStreaming(false);
    setConnectionState('idle');
    hasAutoStartedRef.current = false;
    stopCameraStream(camera.id).catch(() => {});
  }, [camera.id, stopCameraStream]);

  // Store function references in refs for use by handleStreamRestart (avoids circular dependency)
  handleStreamStartRef.current = handleStreamStart;
  handleStreamStopRef.current = handleStreamStop;

  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rateLimitResetRef.current) {
        clearTimeout(rateLimitResetRef.current);
        rateLimitResetRef.current = null;
      }
      if (restartCooldownRef.current) {
        clearTimeout(restartCooldownRef.current);
        restartCooldownRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoStart && socketConnected && !isStreaming && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      handleStreamStart();
    } else if (!autoStart && isStreaming) {
      handleStreamStop();
    }
  }, [camera.id, autoStart, socketConnected, isStreaming, handleStreamStart, handleStreamStop]);

  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      streamActionRef.current = null;
      hasAutoStartedRef.current = false;
      stopCameraStream(camera.id).catch(() => {});
    };
  }, [camera.id, stopCameraStream]);

  // Handle socket connection changes
  useEffect(() => {
    if (socketConnected && autoStart && !isStreaming && connectionState === 'idle' && !hasAutoStartedRef.current) {
      handleStreamStart();
    }
    if (!socketConnected && isStreaming && connectionState === 'connected') {
      setConnectionState('reconnecting');
      hasAutoStartedRef.current = false;
    }
  }, [socketConnected, connectionStatus, autoStart, isStreaming, connectionState, handleStreamStart, camera.id]);

  // Stream freeze detection - monitors if frames stop arriving (reduced check frequency)
  const streamFreezeTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (streamFreezeTimeoutRef.current) {
      clearInterval(streamFreezeTimeoutRef.current);
    }

    if (isStreaming && socketConnected) {
      streamFreezeTimeoutRef.current = setInterval(() => {
        if (!lastFrameTimeRef.current) return;
        const now = Date.now();
        const timeSinceLastFrame = now - lastFrameTimeRef.current;
        const STREAM_FREEZE_TIMEOUT = 8000;
        const MIN_TIME_BEFORE_CHECK = 10000;

        console.log('[STREAM] ⏱', camera.id, 'time since last frame:', timeSinceLastFrame, 'ms');

        if (timeSinceLastFrame > MIN_TIME_BEFORE_CHECK && timeSinceLastFrame > STREAM_FREEZE_TIMEOUT && autoStart) {
          console.log('[STREAM] ❄️ FREEZE DETECTED for', camera.id, '— no frame for', timeSinceLastFrame, 'ms. Restarting...');
          failureCountRef.current++;
          handleStreamRestart();
        }
      }, 3000);
    }

    return () => {
      if (streamFreezeTimeoutRef.current) {
        clearInterval(streamFreezeTimeoutRef.current);
        streamFreezeTimeoutRef.current = null;
      }
    };
  }, [isStreaming, socketConnected, autoStart, handleStreamRestart, camera.id]);

  // Handle page visibility changes - debounced to prevent flicker on brief tab switches
  // Only restarts if stream has been stable OR if truly needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Clear any pending debounce
      if (visibilityDebounceRef.current) {
        clearTimeout(visibilityDebounceRef.current);
      }

      // Debounce the visibility change handler
      visibilityDebounceRef.current = setTimeout(() => {
        if (!document.hidden && socketConnected && autoStart) {
          // Only restart if stream is idle (not actively streaming) AND has been stable
          // DO NOT restart on every visibility change - only when genuinely needed
          if (!isStreaming && (connectionState === 'idle' || connectionState === 'error') && !hasAutoStartedRef.current) {
            handleStreamRestart();
          }
        }
      }, VISIBILITY_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (visibilityDebounceRef.current) {
        clearTimeout(visibilityDebounceRef.current);
      }
    };
  }, [socketConnected, autoStart, isStreaming, connectionState, handleStreamRestart]);

  // Handle socket reconnect - stream should restart when socket reconnects
  useEffect(() => {
    const handleSocketReconnect = () => {
      if (socketConnected && autoStart && !isStreaming && connectionState === 'idle' && !hasAutoStartedRef.current) {
        handleStreamStart();
      }
    };

    const unsubscribe = socketService.on('connect', handleSocketReconnect);
    return () => unsubscribe();
  }, [socketConnected, autoStart, isStreaming, connectionState, handleStreamStart]);

  // WebSocket event handlers
  useEffect(() => {
    let lastFrameUpdate = 0;
    let lastStateUpdate = 0;
    const FRAME_UPDATE_INTERVAL = 66;
    const STATE_UPDATE_INTERVAL = 1000;

    const handleFrame = (data: {
      cameraId: string;
      role: string;
      timestamp: string;
      data: ArrayBuffer | string;
    }) => {
      if (data.cameraId !== camera.id) return;
      console.log('[STREAM] 🖼 CameraStream handleFrame:', camera.id, 'type:', typeof data.data, 'ts:', data.timestamp, data.data);

      const now = Date.now();
      if (now - lastFrameUpdate >= FRAME_UPDATE_INTERVAL) {
        lastFrameUpdate = now;

        if (imgRef.current) {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }

          let frameSize = 0;
          if (typeof data.data === 'string') {
            const imgSrc = `data:image/jpeg;base64,${data.data}`;
            imgRef.current.src = imgSrc;
            frameSize = data.data.length * 0.75;
          } else {
            const blob = new Blob([data.data], { type: 'image/jpeg' });
            const imgSrc = URL.createObjectURL(blob);
            blobUrlRef.current = imgSrc;
            imgRef.current.src = imgSrc;
            frameSize = data.data.byteLength;
          }
          frameErrorRef.current = false;

          if (now - lastStateUpdate >= STATE_UPDATE_INTERVAL) {
            lastStateUpdate = now;
            setLastFrame(imgRef.current.src);
          }

          setMetrics(prev => ({
            ...prev,
            bandwidth: prev.bandwidth * 0.7 + (frameSize * 4) * 0.3,
          }));
        }

        frameCountRef.current++;
        const nowMs = Date.now();
        const elapsed = nowMs - lastFrameTimeRef.current;

        if (elapsed >= 2000) {
          const fps = Math.round((frameCountRef.current * 1000) / elapsed);
          setMetrics(prev => ({ ...prev, fps }));
          frameCountRef.current = 0;
          lastFrameTimeRef.current = nowMs;
        }
      }
    };

    const handleDetection = (data: {
      cameraId: string;
      detections: { class?: string; confidence?: number }[];
      timestamp: string;
      metadata?: { confidence?: number };
    }) => {
      if (data.cameraId !== camera.id) return;

      const detections = data.detections || [];
      if (detections.length > 0) {
        setMotion({
          detected: true,
          confidence: data.metadata?.confidence || 0,
          objectCount: detections.length,
          lastMotionTime: Date.now(),
        });

        setTimeout(() => {
          setMotion(prev => ({ ...prev, detected: false }));
        }, 3000);
      }
    };

    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        setError(data.error);
        setConnectionState('error');
        setIsStreaming(false);
      }
    };

    const frameUnsubscribe = socketService.on('frame', handleFrame);
    const detectionUnsubscribe = socketService.on('detection', handleDetection);
    const errorUnsubscribe = socketService.on('camera-error', handleError);

    return () => {
      frameUnsubscribe();
      detectionUnsubscribe();
      errorUnsubscribe();
    };
  }, [camera.id]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const isLoading = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div className="relative w-full h-full bg-black">
      {camera.status === 'offline' && !isStreaming ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 text-sm font-medium">Camera Offline</p>
          </div>
        </div>
      ) : (
        <>
          {/* z-0: Video feed (background) — tap toggles panel, swipe does NOT */}
          <img
            ref={imgRef}
            alt={`${camera.name} stream`}
            className={cn(
              "h-full w-full object-contain z-0 select-none touch-pan-y",
              (!lastFrame || (!isStreaming && connectionState !== 'connecting' && connectionState !== 'reconnecting') || frameErrorRef.current) && 'hidden'
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onError={() => {
              frameErrorRef.current = true;
              if (imgRef.current) {
                imgRef.current.src = '';
              }
            }}
          />

          {/* z-0: Thumbnail placeholder while stream connects */}
          {(connectionState === 'connecting' || connectionState === 'reconnecting') && !lastFrame && (
            <div className="absolute inset-0 z-0">
              <CameraStreamSkeleton />
            </div>
          )}
          {(connectionState === 'connecting' || connectionState === 'reconnecting') && lastFrame && (
            <div className="absolute inset-0 z-0">
              <img
                src={lastFrame}
                alt={`${camera.name} last frame`}
                className="h-full w-full object-contain opacity-60 blur-[2px] scale-[1.02]"
              />
            </div>
          )}

          {/* z-0: Idle state with play button */}
          {!isStreaming && connectionState === 'idle' && (
            <div
              className="absolute inset-0 z-0 h-full flex items-center justify-center cursor-pointer"
              onClick={() => handleStreamStart()}
            >
              {lastFrame && (
                <img
                  src={lastFrame}
                  alt={`${camera.name} last frame`}
                  className="absolute inset-0 h-full w-full object-contain opacity-40 blur-[1px]"
                />
              )}
              <div className="relative z-10 text-center">
                <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
                <p className="text-white/60 text-sm">Click to Start Stream</p>
              </div>
            </div>
          )}

          {/* z-30: Full connection overlay — only for initial connection or persistent errors */}
          {showFullOverlay && (
            <ConnectionStateOverlay
              state={connectionState as 'connecting' | 'error' | 'reconnecting'}
              cameraName={camera.name}
              errorMessage={error || undefined}
            />
          )}

          {/* z-10: Camera name + status dot (HUD) */}
          <div className="absolute top-3 left-3 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-black/60 border border-white/10">
              <div className={cn(
                "w-2 h-2 rounded-full",
                connectionState === 'connected' && isStreaming ? "bg-green-500" :
                connectionState === 'connecting' || connectionState === 'reconnecting' ? "bg-yellow-500 animate-pulse" :
                "bg-red-500"
              )}
                role="status"
                aria-label={
                  connectionState === 'connected' ? 'Connected' :
                  connectionState === 'connecting' ? 'Connecting' :
                  connectionState === 'reconnecting' ? 'Reconnecting' :
                  'Connection error'
                }
              />
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

          {/* z-10: Brief error text under pill (only when full overlay is hidden) */}
          {error && connectionState === 'error' && !showFullOverlay && (
            <div className="absolute top-12 left-3 z-10 text-red-400 text-xs bg-black/50 px-2 py-1 rounded">
              {error}
            </div>
          )}

          {/* z-30: Stream panel (tap-to-toggle drawer) */}
          <StreamPanel
            open={panelOpen}
            onOpenChange={setPanelOpen}
            camera={camera}
            connectionState={connectionState}
            displayFps={metrics.fps}
            bandwidth={metrics.bandwidth}
            latency={metrics.latency}
            motionDetected={motion.detected}
            motionConfidence={motion.confidence}
            objectCount={motion.objectCount}
            imgRef={imgRef}
          />
        </>
      )}
    </div>
  );
};
