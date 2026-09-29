'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Keyboard } from 'lucide-react';

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'j', action: 'Next event' },
  { keys: 'k', action: 'Previous event' },
  { keys: 'Esc', action: 'Close event detail' },
  { keys: '/', action: 'Focus Ask input' },
  { keys: '?', action: 'Toggle this overlay' },
];

/**
 * ShortcutHelp — global `?` overlay listing keyboard shortcuts.
 * The watchman's manual: one page, plain language, Esc to put it away.
 */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className={reduceMotion ? 'w-full max-w-xs' : 'w-full max-w-xs animate-[relatedFadeIn_180ms_ease-out]'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bezel">
          <div className="bezel-inner p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-primary/20 bg-primary/10">
                <Keyboard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
                <p className="text-[11px] text-muted-foreground">Press Esc to close</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-foreground/80">{s.action}</span>
                  <kbd className="rounded-[4px] border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-foreground">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-muted-foreground">
              The banner up top speaks plainly: <span className="text-emerald-400">ALL CLEAR</span> means every
              camera is watching, <span className="text-amber-400">ALERT</span> means something moved recently —
              tap it to see what.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
