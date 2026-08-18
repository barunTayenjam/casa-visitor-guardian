import React, { useEffect, useState } from 'react';

interface StreamTimestampProps {
  visible: boolean;
}

export const StreamTimestamp: React.FC<StreamTimestampProps> = ({ visible }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const date = now
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  return (
    <div
      className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10"
      role="timer"
      aria-label={`Current time ${time}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      <span className="font-mono text-[10px] tracking-wide text-white/90 tabular-nums">
        {date} {time}
      </span>
    </div>
  );
};
