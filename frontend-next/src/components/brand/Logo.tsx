'use client';

import { cn } from '@/lib/utils';

/**
 * SentryVision brand mark — "The Watchman's Eye".
 * A shield carrying an open eye: vigilant, quiet, always on duty.
 * The pupil offset upward keeps the gaze lifted — watching, not staring.
 */
export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Shield */}
      <path
        d="M16 2.5 L27.5 6.8 V15 C27.5 22.8 22.9 27.9 16 30 C9.1 27.9 4.5 22.8 4.5 15 V6.8 Z"
        fill="var(--primary, #5E6AD2)"
      />
      {/* Eye — almond */}
      <path
        d="M8.5 15 C11 11.2 21 11.2 23.5 15 C21 18.8 11 18.8 8.5 15 Z"
        fill="var(--background, #050505)"
      />
      {/* Pupil — offset up: the lifted gaze */}
      <circle cx="16" cy="14.2" r="2.6" fill="var(--foreground, #ECECEC)" />
      <circle cx="16.9" cy="13.3" r="0.9" fill="var(--primary, #5E6AD2)" />
    </svg>
  );
}

/** Full lockup: mark + wordmark. For the dock and login hero. */
export function Logo({ size = 20, withWordmark = true, className }: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight text-foreground"
          style={{ fontSize: size * 0.72 }}
        >
          SentryVision
        </span>
      )}
    </span>
  );
}
