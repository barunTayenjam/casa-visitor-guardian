import { useCallback, useRef, useState } from 'react';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { ThreatMatrix } from '@/components/live/ThreatMatrix';
import { VerificationTimeline } from '@/components/live/VerificationTimeline';
import { ActiveVisitors } from '@/components/live/ActiveVisitors';
import { MonitorPlay, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocketStore } from '@/stores/socket';
import { useCameraStore } from '@/stores/camera';
import { motion, AnimatePresence } from 'framer-motion';

const StreamDashboard = () => {
  const cameras = useCameraStore((state) => state.cameras);
  const connected = useSocketStore((state) => state.connected);
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>();
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCameraFocus = useCallback((cameraId: string | undefined) => {
    setFocusedCameraId((previous) => {
      if (!cameraId) return undefined;
      return previous === cameraId ? undefined : cameraId;
    });
  }, []);

  const handleStartSlideshow = useCallback(() => {
    if (cameras.length === 0) return;
    handleCameraFocus(cameras[0].id);
    setSlideshowActive(true);
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    if (fullscreenRequest) void fullscreenRequest.catch(() => undefined);
  }, [cameras, handleCameraFocus]);

  return (
    <div className="flex h-full min-h-0 bg-[#050505]">
      <div className="flex min-w-0 flex-1 flex-col">
        {!focusedCameraId && (
          <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0A0A0B] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
                  connected
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                    : 'border-red-400/20 bg-red-400/10 text-red-300',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-300' : 'bg-red-300')} />
                {connected ? 'Live' : 'Offline'}
              </div>
              <span className="text-xs text-[#6B6B73]">
                {cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {cameras.length > 1 && (
                <button
                  onClick={handleStartSlideshow}
                  className="inline-flex items-center gap-2 rounded-[4px] border border-white/[0.10] bg-[#121215] px-3 py-2 text-xs font-medium text-[#A1A1A8] transition-colors hover:border-white/[0.16] hover:text-[#ECECEC] active:scale-[0.98]"
                >
                  <MonitorPlay className="h-4 w-4" />
                  <span className="hidden sm:inline">Slideshow</span>
                </button>
              )}
              <button
                onClick={() => setShowDataPanel((value) => !value)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[4px] border px-3 py-2 text-xs font-medium transition-colors active:scale-[0.98]',
                  showDataPanel
                    ? 'border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#AEB7F2]'
                    : 'border-white/[0.10] bg-[#121215] text-[#A1A1A8] hover:border-white/[0.16] hover:text-[#ECECEC]',
                )}
                aria-pressed={showDataPanel}
              >
                {showDataPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                <span className="hidden sm:inline">Data</span>
              </button>
            </div>
          </header>
        )}

        <div ref={containerRef} className="min-h-0 flex-1">
          <AdaptiveCameraGrid
            cameras={cameras}
            focusedCameraId={focusedCameraId}
            onCameraFocus={handleCameraFocus}
            slideshowActive={slideshowActive}
            onSlideshowChange={setSlideshowActive}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showDataPanel && !focusedCameraId && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="hidden h-full shrink-0 overflow-hidden border-l border-white/[0.06] bg-[#0A0A0B] xl:block"
            aria-label="Live detection data"
          >
            <div className="flex h-full w-[360px] flex-col overflow-hidden">
              <div className="border-b border-white/[0.06] p-4">
                <ThreatMatrix />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <VerificationTimeline />
              </div>
              <div className="border-t border-white/[0.06]">
                <ActiveVisitors />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreamDashboard;
