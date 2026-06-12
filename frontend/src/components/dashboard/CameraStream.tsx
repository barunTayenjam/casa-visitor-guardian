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
  const [isWanStream, setIsWanStream] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mseWsRef = useRef<WebSocket | null>(null);
  const mseMediaSourceRef = useRef<MediaSource | null>(null);
  const mseSettledRef = useRef(false);

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
  const lastVideoTimeRef = useRef<number>(0);
  const lastVideoTimeUpdateRef = useRef<number>(0);
  const watchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamStartTimeRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestFrameRef = useRef<HTMLImageElement | null>(null);
  const hasNewFrameRef = useRef(false);
  const renderRafRef = useRef<number>(0);
  const isWanRef = useRef<boolean | null>(null);
  const frameUnsubscribeRef = useRef<(() => void) | null>(null);

  const handleStreamStartRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleStreamStopRef = useRef<() => void>(() => {});

  const RESTART_COOLDOWN_MS = 5000;
  const VISIBILITY_DEBOUNCE_MS = 1000;
  const MAX_FAILURE_COUNT = 3;
  const CONNECTION_RATE_LIMIT_MS = 3000;
  const MAX_CONNECTION_ATTEMPTS_PER_MINUTE = 10;
  const STALL_THRESHOLD_MS = 5000;
  const STARTUP_GRACE_PERIOD_MS = 10000;

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
    if (!canRestartStream()) {
      console.log(`[CameraStream:${camera.name}] Restart suppressed by rate limit or cooldown`);
      return;
    }

    console.log(`[CameraStream:${camera.name}] Restarting stream...`);

    if (failureCountRef.current >= MAX_FAILURE_COUNT) {
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, failureCountRef.current - MAX_FAILURE_COUNT));
      console.log(`[CameraStream:${camera.name}] Too many failures, backing off for ${backoffMs}ms`);
      if (restartCooldownRef.current) clearTimeout(restartCooldownRef.current);
      restartCooldownRef.current = setTimeout(() => {
        streamActionRef.current = null;
        handleStreamStopRef.current();
        setTimeout(() => {
          handleStreamStartRef.current();
        }, 500);
      }, backoffMs);
      return;
    }

    streamActionRef.current = null;
    handleStreamStopRef.current();
    setTimeout(() => handleStreamStartRef.current(), 1000);
  }, [canRestartStream, camera.name]);

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
      const video = videoRef.current;
      if (video) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          video.requestFullscreen().catch(() => {});
        }
      }
    }
    swipeDetectionRef.current = null;
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      console.log(`[CameraStream:${camera.name}] Cleaning up PeerConnection`);
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
  }, [camera.name]);

  const isStreamingRef = useRef(isStreaming);
  const connectionStateRef = useRef(connectionState);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
    connectionStateRef.current = connectionState;
  }, [isStreaming, connectionState]);

  const startWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    watchdogIntervalRef.current = setInterval(() => {
      if (videoRef.current && isStreamingRef.current && !document.hidden && !isWanRef.current) {
        const now = Date.now();

        if (now - streamStartTimeRef.current < STARTUP_GRACE_PERIOD_MS) return;

        if (connectionStateRef.current === 'reconnecting') {
          if (now - lastVideoTimeUpdateRef.current > STALL_THRESHOLD_MS * 2) {
            console.warn(`[CameraStream:${camera.name}] ICE disconnected too long, restarting`);
            failureCountRef.current++;
            handleStreamRestart();
          }
          return;
        }

        if (connectionStateRef.current === 'connecting' || connectionStateRef.current === 'reconnecting') {
          const video = videoRef.current;
          if (video.currentTime > 0 && video.readyState >= 2 && !mseSettledRef.current) {
            console.log(`[CameraStream:${camera.name}] Video playing but connection never settled — forcing connected`);
            if (connectionTimeoutRef.current) { clearTimeout(connectionTimeoutRef.current); connectionTimeoutRef.current = null; }
            setConnectionState('connected');
            mseSettledRef.current = true;
          }
          return;
        }

        if (connectionStateRef.current !== 'connected') return;

        const currentTime = videoRef.current.currentTime;

        if (currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = currentTime;
          lastVideoTimeUpdateRef.current = now;
          failureCountRef.current = 0;
        } else if (now - lastVideoTimeUpdateRef.current > STALL_THRESHOLD_MS) {
          console.warn(`[CameraStream:${camera.name}] Stream stalled detected by watchdog`);
          handleStreamRestart();
        }
      }
    }, 2000);
  }, [camera.name, handleStreamRestart]);

  const startWebRTC = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      cleanupPeerConnection();

      console.log(`[CameraStream:${camera.name}] Starting WebRTC connection`);
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      let settled = false;

      pc.ontrack = (event) => {
        if (pcRef.current !== pc) return;
        console.log(`[CameraStream:${camera.name}] Received video track`);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          lastFrameTimeRef.current = Date.now();
          lastVideoTimeRef.current = 0;
          lastVideoTimeUpdateRef.current = Date.now();

          videoRef.current.play().catch(e => {
            if (e.name !== 'AbortError') console.warn('Video play failed:', e);
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const state = pc.iceConnectionState;
        console.log(`[CameraStream:${camera.name}] ICE state: ${state}`);

        if (settled) {
          if (state === 'failed') {
            failureCountRef.current++;
            handleStreamRestart();
          } else if (state === 'disconnected') {
            console.log(`[CameraStream:${camera.name}] ICE disconnected, waiting for recovery...`);
            setConnectionState('reconnecting');
          } else if (state === 'connected' || state === 'completed') {
            lastFrameTimeRef.current = Date.now();
            lastVideoTimeRef.current = 0;
            lastVideoTimeUpdateRef.current = Date.now();
            setConnectionState('connected');
          }
          return;
        }

        if (state === 'connected' || state === 'completed') {
          settled = true;
          lastFrameTimeRef.current = Date.now();
          lastVideoTimeRef.current = 0;
          lastVideoTimeUpdateRef.current = Date.now();
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          const elapsed = Date.now() - streamStartTimeRef.current;
          setMetrics(prev => ({ ...prev, latency: elapsed }));
          connectionAttemptsRef.current = 0;
          setConnectionState('connected');
          resolve();
        } else if (state === 'failed') {
          settled = true;
          reject(new Error('ICE connection failed'));
        } else if (state === 'disconnected') {
          console.log(`[CameraStream:${camera.name}] ICE disconnected, waiting for recovery...`);
          setConnectionState('reconnecting');
        }
      };

      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const response = await fetch(`${GO2RTC_BASE}/api/webrtc?src=${camera.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: offer.type, sdp: offer.sdp }),
          });

          if (!response.ok) {
            throw new Error(`go2rtc returned ${response.status}`);
          }

          const answer = await response.json();
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      })();
    });
  }, [camera.id, camera.name, cleanupPeerConnection, handleStreamRestart]);

  const cleanupMSE = useCallback(() => {
    mseSettledRef.current = false;
    if (mseWsRef.current) {
      mseWsRef.current.close();
      mseWsRef.current = null;
    }
    if (mseMediaSourceRef.current) {
      try { if (mseMediaSourceRef.current.readyState === 'open') mseMediaSourceRef.current.endOfStream(); } catch { /* ended */ }
      mseMediaSourceRef.current = null;
    }
  }, []);

  const startMSE = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      cleanupMSE();
      console.log(`[CameraStream:${camera.name}] Starting MSE stream via go2rtc`);
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}${GO2RTC_BASE}/api/ws?src=${camera.id}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      mseWsRef.current = ws;

      mseSettledRef.current = false;
      let sourceBuffer: SourceBuffer | null = null;
      const queue: ArrayBuffer[] = [];
      let isUpdating = false;

      const drainQueue = () => {
        if (!sourceBuffer || isUpdating || queue.length === 0) return;
        isUpdating = true;
        try { sourceBuffer.appendBuffer(queue.shift()!); } catch { isUpdating = false; }
      };

      const settleMse = () => {
        if (mseSettledRef.current) return;
        mseSettledRef.current = true;
        lastFrameTimeRef.current = Date.now();
        lastVideoTimeRef.current = 0;
        lastVideoTimeUpdateRef.current = Date.now();
        if (connectionTimeoutRef.current) { clearTimeout(connectionTimeoutRef.current); connectionTimeoutRef.current = null; }
        const elapsed = Date.now() - streamStartTimeRef.current;
        setMetrics(prev => ({ ...prev, latency: elapsed }));
        connectionAttemptsRef.current = 0;
        setConnectionState('connected');
        resolve();
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'mse', value: 'video' }));
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'mse' && msg.value) {
              const ms = new MediaSource();
              mseMediaSourceRef.current = ms;
              ms.addEventListener('sourceopen', () => {
                try {
                  sourceBuffer = ms.addSourceBuffer(msg.value);
                  sourceBuffer.mode = 'segments';
                  sourceBuffer.addEventListener('updateend', () => { isUpdating = false; drainQueue(); });
                  sourceBuffer.addEventListener('error', () => { isUpdating = false; });
                  if (queue.length > 0) settleMse();
                } catch (err) {
                  if (!mseSettledRef.current) { mseSettledRef.current = true; reject(err); }
                }
              });
              if (videoRef.current) {
                videoRef.current.src = URL.createObjectURL(ms);
                videoRef.current.play().catch(e => {
                  if (e.name !== 'AbortError') console.warn('Video play failed:', e);
                });
              }
            }
          } catch { /* parse error */ }
          return;
        }

        if (event.data instanceof ArrayBuffer) {
          queue.push(event.data);
          if (sourceBuffer) settleMse();
          drainQueue();
        }
      };

      ws.onerror = () => { if (!settled) { settled = true; reject(new Error('MSE WebSocket error')); } };
      ws.onclose = () => {
        if (!settled) { settled = true; reject(new Error('MSE WebSocket closed')); }
        else if (connectionStateRef.current === 'connected') {
          console.log(`[CameraStream:${camera.name}] MSE WebSocket closed unexpectedly`);
          setConnectionState('reconnecting');
          failureCountRef.current++;
          handleStreamRestart();
        }
      };
    });
  }, [camera.id, camera.name, cleanupMSE, handleStreamRestart]);

  const stopFrameRender = useCallback(() => {
    if (renderRafRef.current) {
      cancelAnimationFrame(renderRafRef.current);
      renderRafRef.current = 0;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (frameUnsubscribeRef.current) {
      frameUnsubscribeRef.current();
      frameUnsubscribeRef.current = null;
    }
    if (latestFrameRef.current) {
      URL.revokeObjectURL(latestFrameRef.current.src);
      latestFrameRef.current = null;
    }
    hasNewFrameRef.current = false;
  }, []);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const startFrameRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    const parent = canvas.parentElement;
    if (parent) {
      resizeObserverRef.current = new ResizeObserver(resizeCanvas);
      resizeObserverRef.current.observe(parent);
    }

    const render = () => {
      if (hasNewFrameRef.current && latestFrameRef.current) {
        const img = latestFrameRef.current;
        if (canvas.width > 0 && canvas.height > 0 && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
          const x = (canvas.width - img.naturalWidth * scale) / 2;
          const y = (canvas.height - img.naturalHeight * scale) / 2;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
        }
        hasNewFrameRef.current = false;
      }
      renderRafRef.current = requestAnimationFrame(render);
    };
    renderRafRef.current = requestAnimationFrame(render);
  }, []);

  const setupWanStream = useCallback(() => {
    setIsWanStream(true);
    stopFrameRender();
    frameUnsubscribeRef.current = socketService.on('frame', (raw: Record<string, unknown>) => {
      const event = raw as { cameraId: string; data: ArrayBuffer; role: string; timestamp: string };
      if (event.cameraId !== camera.id) return;
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (latestFrameRef.current) {
          URL.revokeObjectURL(latestFrameRef.current.src);
        }
        latestFrameRef.current = img;
        hasNewFrameRef.current = true;
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
    startFrameRender();
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    setConnectionState('connected');
  }, [camera.id, stopFrameRender, startFrameRender]);

  const handleStreamStart = useCallback(async () => {
    if (streamActionRef.current === "start") return;

    console.log(`[CameraStream:${camera.name}] Starting stream`);
    setError(null);
    setConnectionState('connecting');
    streamActionRef.current = "start";
    setIsStreaming(true);
    setIsWanStream(false);

    frameCountRef.current = 0;
    lastFrameTimeRef.current = Date.now();
    lastVideoTimeRef.current = 0;
    lastVideoTimeUpdateRef.current = Date.now();
    streamStartTimeRef.current = Date.now();

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      streamActionRef.current = null;
      setConnectionState('error');
      setError('Connection timeout. Please try again.');
      setIsStreaming(false);
    }, 30000);

    try {
      await startCameraStream(camera.id);

      if (isWanRef.current === true) {
        setupWanStream();
        return;
      }

      const webRtcTimeoutMs = isWanRef.current === false ? 10000 : 5000;
      try {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('WebRTC timeout')), webRtcTimeoutMs)
        );
        await Promise.race([startWebRTC(), timeoutPromise]);
        isWanRef.current = false;
        startWatchdog();
      } catch {
        console.log(`[CameraStream:${camera.name}] WebRTC failed, trying MSE...`);
        cleanupPeerConnection();
        try {
          const mseTimeout = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('MSE timeout')), 15000)
          );
          await Promise.race([startMSE(), mseTimeout]);
          isWanRef.current = false;
          console.log(`[CameraStream:${camera.name}] MSE connected`);
          startWatchdog();
        } catch {
          console.log(`[CameraStream:${camera.name}] MSE failed, falling back to WAN canvas`);
          cleanupMSE();
          isWanRef.current = true;
          setupWanStream();
        }
      }
    } catch (err) {
      failureCountRef.current++;
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMessage);
      setConnectionState('error');
      setIsStreaming(false);
      setIsWanStream(false);
      cleanupPeerConnection();
      cleanupMSE();
      stopFrameRender();
      streamActionRef.current = null;
    }
  }, [camera.id, camera.name, startCameraStream, startWebRTC, startMSE, cleanupPeerConnection, cleanupMSE, stopFrameRender, setupWanStream, startWatchdog]);

  const handleStreamStop = useCallback(() => {
    if (streamActionRef.current === "stop") return;

    console.log(`[CameraStream:${camera.name}] Stopping stream`);
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    streamActionRef.current = "stop";
    setIsStreaming(false);
    setIsWanStream(false);
    setConnectionState('idle');
    cleanupPeerConnection();
    cleanupMSE();
    stopFrameRender();
    stopCameraStream(camera.id).catch(() => {});
  }, [camera.id, camera.name, stopCameraStream, cleanupPeerConnection, cleanupMSE, stopFrameRender]);

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
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
      }
      stopFrameRender();
    };
  }, [stopFrameRender]);

  useEffect(() => {
    let mountTimer: ReturnType<typeof setTimeout> | null = null;

    const maybeStart = () => {
      if (autoStart && socketConnected && !isStreaming && (connectionState === 'idle' || connectionState === 'error')) {
        console.log(`[CameraStream:${camera.name}] Auto-starting stream (mount/nav check)`);
        handleStreamRestart();
      }
    };

    if (autoStart && socketConnected) {
      mountTimer = setTimeout(maybeStart, 500);
    }

    return () => {
      if (mountTimer) clearTimeout(mountTimer);
    };
  }, [camera.id, camera.name, autoStart, socketConnected, isStreaming, connectionState, handleStreamRestart]);

  useEffect(() => {
    if (!autoStart && isStreaming) {
      handleStreamStop();
    }
  }, [autoStart, isStreaming, handleStreamStop]);

  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      cleanupPeerConnection();
      cleanupMSE();
      streamActionRef.current = null;
      stopCameraStream(camera.id).catch(() => {});
    };
  }, [camera.id, stopCameraStream, cleanupPeerConnection, cleanupMSE]);

  useEffect(() => {
    if (!socketConnected && isStreaming && connectionState === 'connected') {
      setConnectionState('reconnecting');
    }
  }, [socketConnected, isStreaming, connectionState]);

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
          if (isWanStream) {
            return;
          }
          const isVideoPlaying = videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 3;
          const isStalled = Date.now() - lastVideoTimeUpdateRef.current > STALL_THRESHOLD_MS;
          
          if (!isStreaming || connectionState !== 'connected' || !isVideoPlaying || isStalled) {
            console.log(`[CameraStream:${camera.name}] Tab became visible and stream needs restart.`, {
              isStreaming, connectionState, isVideoPlaying, isStalled
            });
            handleStreamRestart();
          } else {
            // Just ensure it's playing
            videoRef.current?.play().catch(() => {});
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
  }, [socketConnected, autoStart, isStreaming, connectionState, handleStreamRestart, camera.name, isWanStream]);

  useEffect(() => {
    const handleSocketReconnect = () => {
      const video = videoRef.current;
      const isVideoPlaying = video && !video.paused && video.readyState >= 2;

      if (connectionState === 'reconnecting') {
        if (isWanStream || isVideoPlaying) {
          setConnectionState('connected');
          return;
        }
      }

      if (socketConnected && autoStart && !isStreaming && connectionState === 'idle') {
        handleStreamStart();
      }
    };

    const unsubscribe = socketService.on('connect', handleSocketReconnect);
    return () => unsubscribe();
  }, [socketConnected, autoStart, isStreaming, connectionState, handleStreamStart, isWanStream]);

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
      cleanupMSE();
      stopFrameRender();
    };
  }, [cleanupPeerConnection, cleanupMSE, stopFrameRender]);

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
              "h-full w-full object-contain z-0 select-none touch-pan-y bg-black",
              (!isStreaming || isWanStream) && 'hidden'
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onStalled={() => {
              console.warn(`[CameraStream:${camera.name}] Video stalled`);
              lastVideoTimeUpdateRef.current = 0; // Force watchdog to see it as stalled
            }}
            onWaiting={() => {
              console.log(`[CameraStream:${camera.name}] Video waiting for data`);
              // Don't restart immediately on waiting, as it might just be a brief buffer
            }}
          />

          <canvas
            ref={canvasRef}
            className={cn(
              "h-full w-full object-contain z-0 select-none bg-black",
              (!isStreaming || !isWanStream) && 'hidden'
            )}
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
              onRetry={() => {
                failureCountRef.current = 0; // Reset failure count on manual retry
                handleStreamRestart();
              }}
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
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isWanStream ? "text-amber-500" : "text-red-500"
                )}>
                  {isWanStream ? "STREAM" : "LIVE"}
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
