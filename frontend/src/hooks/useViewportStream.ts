import { useState, useEffect, useRef } from 'react';

export class StreamSlotManager {
  private activeStreams: Set<string>;
  private pendingQueue: Array<{ cameraId: string; resolve: () => void }>;
  private maxSlots: number;

  constructor(maxSlots: number = 4) {
    this.activeStreams = new Set();
    this.pendingQueue = [];
    this.maxSlots = maxSlots;
  }

  async acquire(cameraId: string): Promise<void> {
    if (this.activeStreams.has(cameraId)) return;

    if (this.activeStreams.size < this.maxSlots) {
      this.activeStreams.add(cameraId);
      return;
    }

    return new Promise<void>((resolve) => {
      this.pendingQueue.push({ cameraId, resolve });
    });
  }

  release(cameraId: string): void {
    this.activeStreams.delete(cameraId);

    while (this.pendingQueue.length > 0 && this.activeStreams.size < this.maxSlots) {
      const next = this.pendingQueue.shift();
      if (next) {
        if (next.cameraId === cameraId) continue;
        this.activeStreams.add(next.cameraId);
        next.resolve();
      }
    }
  }

  releaseAll(): void {
    this.activeStreams.clear();
    for (const pending of this.pendingQueue) {
      pending.resolve();
    }
    this.pendingQueue = [];
  }

  getActiveCount(): number {
    return this.activeStreams.size;
  }

  isStreaming(cameraId: string): boolean {
    return this.activeStreams.has(cameraId);
  }
}

interface UseViewportStreamConfig {
  debounceMs?: number;
  rootMargin?: string;
  threshold?: number;
}

export function useViewportStream(
  elementRef: React.RefObject<HTMLElement | null>,
  config: UseViewportStreamConfig = {}
): { isVisible: boolean } {
  const { debounceMs = 300, rootMargin = '100px', threshold = 0.1 } = config;
  const [isVisible, setIsVisible] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          setIsVisible(entry.isIntersecting);
        }, debounceMs);
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [elementRef, debounceMs, rootMargin, threshold]);

  return { isVisible };
}
