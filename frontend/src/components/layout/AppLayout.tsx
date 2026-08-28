import React from 'react';
import { MacDock } from './MacDock';

/**
 * THESIS: SentryVision proves self-hosted security through a verification timeline
 * that shows exactly why each event was classified, turning security data into trust.
 * The SOC analyst workstation aesthetic replaces glassmorphism with dense data zones,
 * threat color coding, and monospace precision.
 *
 * OWN-WORLD: Near-black backgrounds (#0a0a0b, #111113), blue accent (#3b82f6),
 * green/yellow/red threat status colors, monospace data displays, dense grid layouts,
 * glow borders on active elements. Geist for UI, Geist Mono for data.
 *
 * STORY: The visitor sees a system that is always watching, always verifying, never
 * crying wolf. Each event shows its classification path — YOLO confidence, face match,
 * pose verification — proving the AI works. Visitors are recognized by face, movements
 * tracked across cameras.
 *
 * FIRST VIEWPORT: Full-width dashboard with live camera grid (3 columns), threat matrix
 * panel (person/vehicle/animal/motion counts), verification timeline (scrolling feed of
 * classified events with status indicators), and active visitor list. Primary action:
 * click any event to see full verification chain.
 *
 * FORM: Operate surface, SOC analyst workstation metaphor. Dense data grids, real-time
 * indicators, threat color coding. Not a marketing page — an operational dashboard that
 * proves its mechanism through visible verification.
 *
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
 * the verdict, and DESIGN.md
 */

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Main content area - no padding, stream takes full space */}
      <main className="relative flex-1 pb-12 min-h-0 overflow-hidden">
        {children}
      </main>
      
      {/* SOC-style bottom navigation */}
      <MacDock />
    </div>
  );
};
