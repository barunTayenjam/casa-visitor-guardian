'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * StreamingText — types out text word-by-word to simulate streaming.
 * The full text arrives at once (no backend streaming); this fakes presence.
 * Click (or press Enter) to reveal the rest instantly.
 */
export function StreamingText({
  content,
  onGrow,
  onDone,
  children,
}: {
  content: string;
  onGrow?: () => void;
  onDone?: () => void;
  children: (shown: string, done: boolean) => ReactNode;
}) {
  const instant = !!useReducedMotion();
  const [shown, setShown] = useState(() => (instant ? content : ''));
  const [done, setDone] = useState(instant);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(instant);

  useEffect(() => {
    if (doneRef.current) {
      onDone?.();
      return;
    }
    const words = content.split(/(\s+)/);
    let i = 0;
    const tick = () => {
      i = Math.min(words.length, i + 3 + Math.floor(Math.random() * 4));
      setShown(words.slice(0, i).join(''));
      onGrow?.();
      if (i < words.length) {
        timerRef.current = setTimeout(tick, 22 + Math.random() * 36);
      } else {
        doneRef.current = true;
        setDone(true);
        onDone?.();
      }
    };
    timerRef.current = setTimeout(tick, 140);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const skip = () => {
    if (doneRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    doneRef.current = true;
    setShown(content);
    setDone(true);
    onDone?.();
  };

  if (done) return <>{children(shown, true)}</>;

  return (
    <div
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          skip();
        }
      }}
      tabIndex={0}
      title="Click to show full response"
      className="cursor-pointer outline-none"
    >
      {children(shown, false)}
    </div>
  );
}

