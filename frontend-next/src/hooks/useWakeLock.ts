'use client';

import { useEffect, useRef } from 'react';

/**
 * useWakeLock — keeps the device screen alive on the stream page.
 *
 * The Screen Wake Lock API is the first choice, but Amazon Fire tablets
 * (and some Android WebViews) ignore it. For those, we fall back to:
 *   1. A silent looping 1px video — tablets that play <video> don't sleep.
 *   2. Synthetic touch events every 10s — mimics user activity.
 *   3. Tiny scroll ping — scrollBy(1) then back.
 *
 * All fallbacks are harmless no-ops when unsupported. Re-acquires after
 * the tab becomes visible again (browsers auto-release on hide).
 */
export function useWakeLock(enabled = true) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Touch simulation (10s interval) ───────────────────────
  const startTouchSimulation = () => {
    if (touchIntervalRef.current) return;
    touchIntervalRef.current = setInterval(() => {
      try {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const touchData = {
          clientX: cx, clientY: cy, identifier: 0, force: 1,
          pageX: cx, pageY: cy, radiusX: 1, radiusY: 1,
          rotationAngle: 0, screenX: cx, screenY: cy, target: document.body,
        };
        document.body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touchData] }));
        document.body.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [touchData] }));
        window.scrollBy(0, 1);
        setTimeout(() => window.scrollBy(0, -1), 50);
      } catch { /* simulation is best-effort */ }
    }, 10_000);
  };

  const stopTouchSimulation = () => {
    if (touchIntervalRef.current) { clearInterval(touchIntervalRef.current); touchIntervalRef.current = null; }
  };

  // ── Silent video fallback ─────────────────────────────────
  const startVideoFallback = () => {
    if (videoRef.current) return;
    try {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('loop', '');
      video.muted = true;
      video.volume = 0;
      Object.assign(video.style, {
        position: 'fixed', top: '-1px', left: '-1px',
        width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', zIndex: '-1',
      });
      // Minimal silent MP4 (1 frame, blank)
      video.src = 'data:video/mp4;base64,AAAAHGZ0eXBNNEVAAAAAAAEAAuAAls6bCqYAAAA2a0ptkfjxAAAAAjq5fCtzGgkAAAAIAAABUcXRyYUAAAApwc3R0cwAAABhzaHJkZgAAABxtcDRhAAAAAAAAAAEAQABAAAAAAAEAAAAAAAAAAAAAQAAAAAAAAB0bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAA8ZWx0QgAAAAAA////AAAAAADrZWx0YQAAABQAAAAAQAAAAAAQWRwbmQAAAAAbWRhdAAAAAAAAAAAAAAAAAAAA';
      document.body.appendChild(video);
      void video.play();
      videoRef.current = video;
    } catch { /* video fallback is best-effort */ }
  };

  const stopVideoFallback = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.parentNode?.removeChild(videoRef.current);
      videoRef.current = null;
    }
  };

  // ── Mouse-move timer fallback (20s interval) ──────────────
  const startTimerFallback = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      try {
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, view: window, clientX: Math.random() * 100, clientY: Math.random() * 100 }));
      } catch { /* best-effort */ }
    }, 20_000);
  };

  const stopTimerFallback = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // ── Native Wake Lock API ──────────────────────────────────
  async function requestLock() {
    if (!('wakeLock' in navigator)) return false;
    try {
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener('release', () => { wakeLockRef.current = null; });
      return true;
    } catch { return false; }
  }

  function releaseAll() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    stopVideoFallback();
    stopTouchSimulation();
    stopTimerFallback();
  }

  // ── Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { releaseAll(); return; }

    async function activate() {
      void (await requestLock());
      startVideoFallback();
      startTouchSimulation();
      startTimerFallback();
    }

    activate();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) activate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
