import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string; alt: string; className?: string; placeholderClassName?: string;
  onLoad?: () => void; onError?: () => void;
}

export function ProgressiveImage({ src, alt, className, placeholderClassName, onLoad, onError }: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '100px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoad = () => { setLoaded(true); onLoad?.(); };
  const handleError = () => { setError(true); onError?.(); };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {!loaded && !error && (
        <div className={cn('absolute inset-0 bg-white/[0.06] animate-pulse', placeholderClassName)} />
      )}
      {inView && !error && (
        <img src={src} alt={alt}
          className={cn('w-full h-full object-cover transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-lg scale-105')}
          onLoad={handleLoad} onError={handleError}
        />
      )}
      {error && (
        <div className="w-full h-full flex items-center justify-center bg-black/40">
          <p className="text-xs text-white/60">Image unavailable</p>
        </div>
      )}
    </div>
  );
}
