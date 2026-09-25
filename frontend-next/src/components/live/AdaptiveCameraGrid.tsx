'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MonitorPlay, MonitorStop, X } from 'lucide-react';
import type { Camera } from '@/types/security';
import socketService from '@/services/SocketService';
import { useCameraStore } from '@/stores/camera';
import { cn } from '@/lib/utils';

interface FramePayload {
  cameraId: string;
  data: unknown;
  timestamp?: string;
}

function toFrameUrl(data: unknown): string | null {
  if (typeof data === 'string') {
    if (data.startsWith('data:')) return data;
    if (data.startsWith('http')) return data;
    try {
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    } catch {
      return null;
    }
  }
  if (data instanceof Blob) return URL.createObjectURL(data);
  if (data instanceof ArrayBuffer) return URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }));
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
    return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  }
  if (data && typeof data === 'object' && 'type' in data && data.type === 'Buffer' && 'data' in data && Array.isArray(data.data)) {
    return URL.createObjectURL(new Blob([Uint8Array.from(data.data as number[])], { type: 'image/jpeg' }));
  }
  return null;
}

function LiveCameraTile({
  camera,
  focused,
  onClick,
  onClose,
}: {
  camera: Camera;
  focused: boolean;
  onClick: () => void;
  onClose?: () => void;
}) {
  const startCameraStream = useCameraStore((state) => state.startCameraStream);
  const stopCameraStream = useCameraStore((state) => state.stopCameraStream);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void startCameraStream(camera.id).catch((error: unknown) => {
      if (!cancelled) setStreamError(error instanceof Error ? error.message : 'Stream unavailable');
    });
    const unsubscribe = socketService.on('frame', (payload: FramePayload) => {
      if (payload.cameraId !== camera.id) return;
      const nextUrl = toFrameUrl(payload.data);
      if (!nextUrl) return;
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = nextUrl;
      if (mountedRef.current) setFrameUrl(nextUrl);
    });
    const unsubscribeError = socketService.on('streamError', (payload: { cameraId?: string; error?: string }) => {
      if (payload.cameraId === camera.id) setStreamError(payload.error || 'Stream unavailable');
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      unsubscribe();
      unsubscribeError();
      stopCameraStream(camera.id);
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    };
  }, [camera.id, startCameraStream, stopCameraStream]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'group relative min-h-[180px] overflow-hidden rounded-lg border border-white/[0.08] bg-black',
        focused ? 'absolute inset-0 rounded-none' : 'h-full',
      )}
    >
      <button type="button" onClick={onClick} className="absolute inset-0 z-10 cursor-pointer" aria-label={`Focus ${camera.name}`} />
      {frameUrl ? (
        <img src={frameUrl} alt={`${camera.name} live feed`} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full min-h-[180px] items-center justify-center bg-gradient-to-br from-[#0a0a0b] to-black">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-pulse rounded-full bg-white/[0.08]" />
            <p className="text-xs text-muted-foreground">{streamError || 'Connecting to camera…'}</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">{camera.name}</p>
          <p className="font-mono text-[10px] text-white/60">{camera.status} · {camera.resolution || 'live'}</p>
        </div>
        {focused && onClose && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.12] bg-black/50 text-white/80 hover:bg-black/80"
            aria-label="Close focused camera"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export interface AdaptiveCameraGridProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onCameraFocus?: (cameraId: string | undefined) => void;
  slideshowActive?: boolean;
  onSlideshowChange?: (active: boolean) => void;
}

export function AdaptiveCameraGrid({
  cameras,
  focusedCameraId,
  onCameraFocus,
  slideshowActive = false,
  onSlideshowChange,
}: AdaptiveCameraGridProps) {
  const [interval, setIntervalSeconds] = useState(5);
  const reduceMotion = useReducedMotion();
  const slideshowRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const focusCamera = useCallback(
    (cameraId: string) => onCameraFocus?.(focusedCameraId === cameraId ? undefined : cameraId),
    [focusedCameraId, onCameraFocus],
  );

  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (cameras.length < 2) return;
      const index = focusedCameraId ? cameras.findIndex((camera) => camera.id === focusedCameraId) : -1;
      const nextIndex = index < 0 ? (direction === 1 ? 0 : cameras.length - 1) : (index + direction + cameras.length) % cameras.length;
      onCameraFocus?.(cameras[nextIndex].id);
    },
    [cameras, focusedCameraId, onCameraFocus],
  );

  useEffect(() => {
    if (slideshowActive) {
      slideshowRef.current = setInterval(() => navigate(1), interval * 1000);
    }
    return () => {
      if (slideshowRef.current) clearInterval(slideshowRef.current);
    };
  }, [interval, navigate, slideshowActive]);

  const gridClass = useMemo(() => {
    if (focusedCameraId) return 'grid-cols-1 grid-rows-1';
    if (cameras.length === 1) return 'grid-cols-1';
    if (cameras.length === 2) return 'grid-cols-1 md:grid-cols-2';
    if (cameras.length <= 4) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  }, [cameras.length, focusedCameraId]);

  if (cameras.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center">
        <div className="text-center">
          <p className="text-base font-medium">No cameras online</p>
          <p className="mt-2 text-sm text-muted-foreground">Add a camera in Settings to start monitoring.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col" onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') navigate(-1);
      if (event.key === 'ArrowRight') navigate(1);
      if (event.key === 'Escape') onCameraFocus?.(undefined);
    }}>
      <div className="relative min-h-0 flex-1">
        <div className={cn('grid h-full auto-rows-fr gap-2', gridClass)} role="group" aria-label="Camera grid">
          <AnimatePresence initial={false}>
            {cameras.map((camera) => (
              <LiveCameraTile
                key={camera.id}
                camera={camera}
                focused={focusedCameraId === camera.id}
                onClick={() => focusCamera(camera.id)}
                onClose={() => onCameraFocus?.(undefined)}
              />
            ))}
          </AnimatePresence>
        </div>
        {focusedCameraId && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-between px-3">
            <div className="pointer-events-auto flex items-center gap-2">
              {slideshowActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSlideshowChange?.(false)}
                    className="flex h-10 items-center gap-2 rounded-md border border-red-400/30 bg-red-500/80 px-3 text-xs font-medium text-white"
                  >
                    <MonitorStop className="h-4 w-4" />
                    Stop
                  </button>
                  <div className="flex gap-1">
                    {[3, 5, 10].map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setIntervalSeconds(seconds)}
                        className={cn('rounded-md border px-2 py-1.5 text-xs', interval === seconds ? 'border-white/20 bg-white/20 text-white' : 'border-white/[0.1] bg-black/50 text-white/60')}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSlideshowChange?.(true);
                    onCameraFocus?.(focusedCameraId);
                  }}
                  className="flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-black/60 px-3 text-xs font-medium text-white"
                >
                  <MonitorPlay className="h-4 w-4" />
                  Slideshow
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onCameraFocus?.(undefined)}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.12] bg-black/60 text-white/80 hover:bg-black/80"
              aria-label="Exit focused camera"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {focusedCameraId && cameras.length > 1 && (
        <>
          <button type="button" onClick={() => navigate(-1)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/[0.12] bg-black/50 text-white/80 md:flex" aria-label="Previous camera">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => navigate(1)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/[0.12] bg-black/50 text-white/80 md:flex" aria-label="Next camera">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      {!reduceMotion && focusedCameraId && <div className="pointer-events-none absolute bottom-3 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/40" />}
    </div>
  );
}
