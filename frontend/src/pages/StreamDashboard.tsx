import { useState, useCallback, useRef } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { ThreatMatrix } from '@/components/live/ThreatMatrix';
import { VerificationTimeline } from '@/components/live/VerificationTimeline';
import { ActiveVisitors } from '@/components/live/ActiveVisitors';
import { MonitorPlay, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSocketContext } from '@/contexts/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';

const StreamDashboard = () => {
  const { cameras } = useCameras();
  const { connected } = useSocketContext();
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCameraFocus = useCallback((cameraId: string | undefined) => {
    setFocusedCameraId((prev) => {
      if (!cameraId) return undefined;
      else if (prev === cameraId) return undefined;
      else return cameraId;
    });
  }, []);

  const handleStartSlideshow = useCallback(() => {
    if (cameras.length > 0) {
      handleCameraFocus(cameras[0].id);
      setSlideshowActive(true);
      document.documentElement.requestFullscreen();
    }
  }, [cameras, handleCameraFocus]);

  return (
    <div className="flex h-full">
      {/* Main stream area - always full width */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Minimal top bar - only show when not focused */}
        {!focusedCameraId && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center gap-1.5 px-2 py-0.5 rounded',
                connected ? 'bg-green-500/10' : 'bg-red-500/10',
              )}>
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  connected ? 'bg-green-400' : 'bg-red-400',
                )} />
                <span className={cn(
                  'text-[9px] uppercase tracking-wider font-medium',
                  connected ? 'text-green-400' : 'text-red-400',
                )}>
                  {connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {cameras.length > 1 && (
                <Button
                  onClick={handleStartSlideshow}
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 rounded-md bg-white/[0.04] border-white/[0.10] text-[11px] hover:bg-white/[0.08]"
                >
                  <MonitorPlay className="h-3 w-3" />
                  <span className="hidden sm:inline">Slideshow</span>
                </Button>
              )}
              <button
                onClick={() => setShowDataPanel(!showDataPanel)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                  showDataPanel
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-white/[0.04] text-muted-foreground border border-white/[0.10] hover:bg-white/[0.08]',
                )}
              >
                {showDataPanel ? (
                  <PanelRightClose className="h-3 w-3" />
                ) : (
                  <PanelRightOpen className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">Data</span>
              </button>
            </div>
          </div>
        )}

        {/* Camera grid - takes all available space */}
        <div ref={containerRef} className="flex-1 min-h-0">
          <AdaptiveCameraGrid
            cameras={cameras}
            focusedCameraId={focusedCameraId}
            onCameraFocus={handleCameraFocus}
            slideshowActive={slideshowActive}
            onSlideshowChange={setSlideshowActive}
          />
        </div>
      </div>

      {/* Collapsible data panel */}
      <AnimatePresence>
        {showDataPanel && !focusedCameraId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full border-l border-white/[0.08] bg-[#0a0a0b] overflow-hidden flex-shrink-0"
          >
            <div className="w-[360px] h-full flex flex-col overflow-hidden">
              {/* Threat Matrix */}
              <div className="p-4 border-b border-white/[0.08]">
                <ThreatMatrix />
              </div>

              {/* Verification Timeline */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <VerificationTimeline />
              </div>

              {/* Active Visitors */}
              <div className="border-t border-white/[0.08]">
                <ActiveVisitors />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreamDashboard;
