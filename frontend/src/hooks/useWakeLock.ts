import { useEffect, useState, useRef } from 'react';

type WakeLockSentinelType = EventTarget & { release: () => Promise<void> };

interface UseWakeLockOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  error: Error | null;
  release: () => Promise<void>;
  request: () => Promise<void>;
}

export const useWakeLock = (options: UseWakeLockOptions = {}): UseWakeLockReturn => {
  const { enabled = true, onError } = options;
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelType | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const useFallback = useRef(false);
  
  const isSupported = 'wakeLock' in navigator;

  // Aggressive keep-alive: simulate touch events and scroll
  const startTouchSimulation = () => {
    if (touchIntervalRef.current) return;
    
    console.log('[WakeLock] Starting aggressive keep-alive simulation');
    touchIntervalRef.current = setInterval(() => {
      try {
        // Method 1: Simulate touch at center of screen
        const touch = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [{
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
            identifier: 0,
            force: 1,
            pageX: window.innerWidth / 2,
            pageY: window.innerHeight / 2,
            radiusX: 1,
            radiusY: 1,
            rotationAngle: 0,
            screenX: window.innerWidth / 2,
            screenY: window.innerHeight / 2,
            target: document.body
          }]
        });
        
        const touchEnd = new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          changedTouches: [{
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
            identifier: 0,
            force: 1,
            pageX: window.innerWidth / 2,
            pageY: window.innerHeight / 2,
            radiusX: 1,
            radiusY: 1,
            rotationAngle: 0,
            screenX: window.innerWidth / 2,
            screenY: window.innerHeight / 2,
            target: document.body
          }]
        });
        
        document.body.dispatchEvent(touch);
        document.body.dispatchEvent(touchEnd);
        
        // Method 2: Tiny scroll to simulate activity
        const originalScroll = window.pageYOffset || document.documentElement.scrollTop;
        window.scrollBy(0, 1);
        setTimeout(() => {
          window.scrollBy(0, -1);
        }, 50);
        
        // Method 3: Focus change
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        document.body.focus();
        
        console.log('[WakeLock] Keep-alive ping sent');
      } catch (err) {
        // Ignore errors from simulation attempts
        console.log('[WakeLock] Keep-alive ping failed (expected)');
      }
    }, 10000); // Every 10 seconds - more aggressive
  };

  const stopTouchSimulation = () => {
    if (touchIntervalRef.current) {
      clearInterval(touchIntervalRef.current);
      touchIntervalRef.current = null;
      console.log('[WakeLock] Stopped touch simulation');
    }
  };

  const release = async () => {
    console.log('[WakeLock] Releasing wake lock...');
    
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('[WakeLock] Native wake lock released');
      } catch (err) {
        const error = err as Error;
        console.error('[WakeLock] Error releasing native wake lock:', error);
        setError(error);
        onError?.(error);
      }
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
      }
      videoRef.current = null;
      console.log('[WakeLock] Video fallback stopped');
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log('[WakeLock] Timer fallback stopped');
    }

    stopTouchSimulation();
    
    setIsActive(false);
  };

  const request = async () => {
    console.log('[WakeLock] Requesting wake lock...', { 
      isSupported, 
      useFallback: useFallback.current,
      userAgent: navigator.userAgent 
    });

    if (!isSupported) {
      console.log('[WakeLock] Native API not supported, using fallback');
      useFallback.current = true;
    }

    if (useFallback.current) {
      console.log('[WakeLock] Using aggressive fallback method for Fire tablet');
      
      // Start all methods simultaneously for maximum reliability
      let videoSuccess = false;
      let timerSuccess = false;
      
      // Method 1: Video fallback (silent)
      if (!videoRef.current) {
        try {
          console.log('[WakeLock] Starting video fallback');
          const video = document.createElement('video');
          video.setAttribute('playsinline', '');
          video.setAttribute('loop', '');
          video.setAttribute('autoplay', '');
          video.muted = true;
          video.volume = 0;
          video.style.position = 'absolute';
          video.style.top = '-1px';
          video.style.left = '-1px';
          video.style.width = '1px';
          video.style.height = '1px';
          video.style.opacity = '0';
          video.style.pointerEvents = 'none';
          document.body.appendChild(video);
          
          // Use a simple base64 video (1x1 blank)
          video.src = 'data:video/mp4;base64,AAAAHGZ0eXBNNEVAAAAAAAEAAuAAls6bCqYAAAA2a0ptkfjxAAAAAjq5fCtzGgkAAAAIAAABUcXRyYUAAAApwc3R0cwAAABhzaHJkZgAAABxtcDRhAAAAAAAAAAEAQABAAAAAAAEAAAAAAAAAAAAAQAAAAAAAAB0bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAA8ZWx0QgAAAAAA////AAAAAADrZWx0YQAAABQAAAAAQAAAAAAQWRwbmQAAAAAbWRhdAAAAAAAAAAAAAAAAAAAA';
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          
          videoRef.current = video;
          videoSuccess = true;
          console.log('[WakeLock] Video fallback started');
        } catch (err) {
          console.error('[WakeLock] Video failed:', err);
        }
      } else {
        videoSuccess = true;
      }

      // Method 2: Timer-based keep-alive (mousemove simulation)
      if (!timerRef.current) {
        try {
          console.log('[WakeLock] Starting timer fallback');
          timerRef.current = setInterval(() => {
            // Simulate mouse movement
            const event = new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: Math.random() * 100,
              clientY: Math.random() * 100
            });
            document.dispatchEvent(event);
            
            // Also scroll by tiny amount
            window.scrollBy(0, 0);
          }, 20000); // Every 20 seconds
          
          timerSuccess = true;
          console.log('[WakeLock] Timer fallback started');
        } catch (err) {
          console.error('[WakeLock] Timer failed:', err);
        }
      } else {
        timerSuccess = true;
      }

      // Method 3: Aggressive touch simulation (MOST IMPORTANT)
      startTouchSimulation();

      const overallSuccess = videoSuccess || timerSuccess;
      
      if (overallSuccess) {
        setIsActive(true);
        setError(null);
        console.log('[WakeLock] All fallback methods active - using aggressive approach');
      } else {
        const error = new Error('All fallback methods failed. Try using Chrome browser.');
        console.error('[WakeLock] All methods failed');
        setError(error);
        setIsActive(false);
        onError?.(error);
      }
      return;
    }

    // Native API
    try {
      console.log('[WakeLock] Requesting native wake lock');
      const wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = wakeLock;
      setIsActive(true);
      setError(null);
      console.log('[WakeLock] Native wake lock acquired successfully');
      
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Native wake lock released');
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      const error = err as Error;
      console.error('[WakeLock] Native wake lock failed, falling back:', error);
      setError(error);
      setIsActive(false);
      useFallback.current = true;
      onError?.(error);
      
      // Retry with fallback
      await request();
    }
  };

  useEffect(() => {
    if (!enabled) {
      console.log('[WakeLock] Wake lock disabled, releasing if active');
      release();
      stopTouchSimulation();
      return;
    }

    console.log('[WakeLock] Effect triggered, requesting wake lock');
    request();
    startTouchSimulation();

    const handleVisibilityChange = () => {
      console.log('[WakeLock] Visibility changed:', document.visibilityState);
      if (document.visibilityState === 'visible' && enabled) {
        console.log('[WakeLock] Page became visible, re-requesting wake lock');
        request();
        startTouchSimulation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('[WakeLock] Cleanup: removing listeners and releasing wake lock');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
      stopTouchSimulation();
    };
  }, [enabled]);

  return {
    isSupported: isSupported || true,
    isActive,
    error,
    release,
    request
  };
};
