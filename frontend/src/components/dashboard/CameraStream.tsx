import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, AlertTriangle } from 'lucide-react';
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

const GO2RTC_BASE = '/go2rtc';

export const CameraStream: React.FC<CameraStreamProps> = ({
  camera,
  autoStart = true
}) => {
  const { startCameraStream, stopCameraStream } = useCameras();
  const { connected: socketConnected, connectionStatus } = useSocketContext();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<StreamMetrics>({
    fps: 0,
    bandwidth: 0,
    latency: 0,
    resolution: '1080p',
  });

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

  const lastRestartTimeRef = useRef<number>(0);
  const restartCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef<number>(0);
  const connectionAttemptsRef = useRef<number>(0);
  const lastConnectionAttemptRef = useRef<number>(0);

  const handleStreamStartRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleStreamStopRef = useRef<() => void>(() => {});

  const RESTART_COOLDOWN_MS = 5000;
  const VISIBILITY_DEBOUNCE_MS = 2000;
  const MAX_FAILURE_COUNT = 3;
  const CONNECTION_RATE_LIMIT_MS = 3000;
  const MAX_CONNECTION_ATTEMPTS_PER_MINUTE = 10;

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

  const [panelOpen, setPanelOpen] = useState(false);
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
      setShowFullOverlay(true);
    }
    if (connectionState === 'idle') {
      setShowFullOverlay(false);
    }
  }, [connectionState]);

  useEffect(() => {
    if ((connectionState === 'connecting' || connectionState === 'reconnecting') && showFullOverlay) {
      const timer = setTimeout(() => {
        setShowFullOverlay(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionState, showFullOverlay]);

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

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startWebRTC = useCallback(async () => {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        lastFrameTimeRef.current = Date.now();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        failureCountRef.current++;
        handleStreamRestart();
      } else if (state === 'connected' || state === 'completed') {
        failureCountRef.current = 0;
        lastFrameTimeRef.current = Date.now();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(`${GO2RTC_BASE}/api/webrtc?src=${camera.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: offer.type,
        sdp: offer.sdp,
      }),
    });

    if (!response.ok) {
      throw new Error(`go2rtc returned ${response.status}`);
    }

    const answer = await response.json();
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, [camera.id, cleanupPeerConnection, handleStreamRestart]);

  const hasAutoStartedRef = useRef(false);

  const handleStreamStart = useCallback(async () => {
    if (streamActionRef.current === "start") return;

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
      streamActionRef.current = null;
      hasAutoStartedRef.current = false;
      setConnectionState('error');
      setError('Connection timeout. Please try again.');
      setIsStreaming(false);
    }, 10000);

    try {
      const startTime = Date.now();
      await startCameraStream(camera.id);
      await startWebRTC();

      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const elapsed = Date.now() - startTime;
      setMetrics(prev => ({ ...prev, latency: elapsed }));
      failureCountRef.current = 0;
      connectionAttemptsRef.current = 0;
      setConnectionState('connected');
    } catch (err) {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMessage);
      setConnectionState('error');
      setIsStreaming(false);
      cleanupPeerConnection();
      streamActionRef.current = null;
    }
  }, [camera.id, startCameraStream, startWebRTC, cleanupPeerConnection]);

  const handleStreamStop = useCallback(() => {
    if (streamActionRef.current === "stop") return;

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    streamActionRef.current = "stop";
    setIsStreaming(false);
    setConnectionState('idle');
    hasAutoStartedRef.current = false;
    cleanupPeerConnection();
    stopCameraStream(camera.id).catch(() => {});
  }, [camera.id, stopCameraStream, cleanupPeerConnection]);

  handleStreamStartRef.current = handleStreamStart;
  handleStreamStopRef.current = handleStreamStop;

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
      cleanupPeerConnection();
      streamActionRef.current = null;
      hasAutoStartedRef.current = false;
      stopCameraStream(camera.id).catch(() => {});
    };
  }, [camera.id, stopCameraStream, cleanupPeerConnection]);

  useEffect(() => {
    if (socketConnected && autoStart && !isStreaming && connectionState === 'idle' && !hasAutoStartedRef.current) {
      handleStreamStart();
    }
    if (!socketConnected && isStreaming && connectionState === 'connected') {
      setConnectionState('reconnecting');
      hasAutoStartedRef.current = false;
    }
  }, [socketConnected, connectionStatus, autoStart, isStreaming, connectionState, handleStreamStart, camera.id]);

  useEffect(() => {
    if (isStreaming && socketConnected) {
      lastFrameTimeRef.current = Date.now();
    }
  }, [isStreaming, socketConnected]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (visibilityDebounceRef.current) {
        clearTimeout(visibilityDebounceRef.current);
      }

      visibilityDebounceRef.current = setTimeout(() => {
        if (!document.hidden && socketConnected && autoStart) {
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

  useEffect(() => {
    const handleSocketReconnect = () => {
      if (socketConnected && autoStart && !isStreaming && connectionState === 'idle' && !hasAutoStartedRef.current) {
        handleStreamStart();
      }
    };

    const unsubscribe = socketService.on('connect', handleSocketReconnect);
    return () => unsubscribe();
  }, [socketConnected, autoStart, isStreaming, connectionState, handleStreamStart]);

  useEffect(() => {
    let lastStateUpdate = 0;
    const STATE_UPDATE_INTERVAL = 1000;

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

      const now = Date.now();
      if (now - lastStateUpdate >= STATE_UPDATE_INTERVAL) {
        lastStateUpdate = now;
        lastFrameTimeRef.current = now;
        frameCountRef.current++;
        const elapsed = now - lastFrameTimeRef.current;
        if (elapsed >= 2000) {
          const fps = Math.round((frameCountRef.current * 1000) / elapsed);
          setMetrics(prev => ({ ...prev, fps }));
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      }
    };

    const handleError = (data: { cameraId: string; error: string }) => {
      if (data.cameraId === camera.id) {
        setError(data.error);
        setConnectionState('error');
        setIsStreaming(false);
      }
    };

    const detectionUnsubscribe = socketService.on('detection', handleDetection);
    const errorUnsubscribe = socketService.on('camera-error', handleError);

    return () => {
      detectionUnsubscribe();
      errorUnsubscribe();
    };
  }, [camera.id]);

  useEffect(() => {
    return () => {
      cleanupPeerConnection();
    };
  }, [cleanupPeerConnection]);

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
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "h-full w-full object-contain z-0 select-none touch-pan-y",
              !isStreaming && 'hidden'
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
            <div className="absolute inset-0 z-0">
              <CameraStreamSkeleton />
            </div>
          )}

          {!isStreaming && connectionState === 'idle' && (
            <div
              className="absolute inset-0 z-0 h-full flex items-center justify-center cursor-pointer"
              onClick={() => handleStreamStart()}
            >
              <div className="relative z-10 text-center">
                <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
                <p className="text-white/60 text-sm">Click to Start Stream</p>
              </div>
            </div>
          )}

          {showFullOverlay && (
            <ConnectionStateOverlay
              state={connectionState as 'connecting' | 'error' | 'reconnecting'}
              cameraName={camera.name}
              errorMessage={error || undefined}
            />
          )}

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

          {error && connectionState === 'error' && !showFullOverlay && (
            <div className="absolute top-12 left-3 z-10 text-red-400 text-xs bg-black/50 px-2 py-1 rounded">
              {error}
            </div>
          )}

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
            videoRef={videoRef}
          />
        </>
      )}
    </div>
  );
};
