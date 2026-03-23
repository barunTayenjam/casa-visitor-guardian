import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameras } from '@/contexts/CameraContext';
import { useToast } from '@/hooks/use-toast';
import { useWakeLock } from '@/hooks/useWakeLock';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { colors } from '@/styles/design-tokens';
import { Shield, Activity, Calendar, Power, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { Button } from '@/components/ui/button';

/**
 * Minimal streaming page focused on live camera views.
 * All non-essential UI removed to prioritize the stream experience.
 */
const StreamDashboard = () => {
  const navigate = useNavigate();
  const { cameras } = useCameras();
  const { toast } = useToast();
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const wakeLock = useWakeLock({
    enabled: wakeLockEnabled,
    onError: (error) => {
      console.error('Wake Lock error:', error);
      toast({
        title: 'Wake Lock Issue',
        description: 'Screen may still sleep. Try keeping app in foreground.',
        variant: 'destructive',
      });
    }
  });

  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);

  const handleCameraFocus = useCallback((cameraId: string) => {
    if (cameraId === 'undefined' || cameraId === undefined || cameraId === '') {
      setFocusedCameraId(undefined);
    } else if (focusedCameraId === cameraId) {
      setFocusedCameraId(undefined);
    } else {
      setFocusedCameraId(cameraId);
    }
  }, [focusedCameraId]);

  const handleTakeSnapshot = async () => {
    try {
      const camera = cameras[0];
      if (camera) {
        const response = await fetch(`/api/cameras/${camera.id}/snapshot`, {
          method: 'POST',
        });
        if (response.ok) {
          toast({
            title: 'Snapshot Captured',
            description: 'Saved to your gallery.',
          });
        } else {
          throw new Error('Snapshot failed');
        }
      }
    } catch (error) {
      toast({
        title: 'Snapshot Failed',
        description: 'Could not capture snapshot.',
        variant: 'destructive',
      });
    }
  };

  // Include cameras with online or warning status
  const activeCameras = cameras.filter(c => c.status === 'online' || c.status === 'warning');

  return (
    <TooltipProvider>
      <div
        className="relative w-full h-screen overflow-hidden flex flex-col"
        style={{ backgroundColor: colors.background.primary }}
      >
        {/* Minimal Top Bar */}
        <div
          className="absolute top-0 left-0 right-0 z-30 px-4 py-3"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
          }}
        >
          <div className="flex items-center justify-between">
            {/* Left: Logo + Status */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                style={{ backgroundColor: colors.interactive.hover }}
                onClick={() => setShowTooltip(!showTooltip)}
              >
                <Shield className="h-5 w-5" style={{ color: colors.status.success }} />
              </div>

              <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer">
                    <h1 className="text-lg font-semibold text-white">SentryVision</h1>
                    <p className="text-xs text-white/60">
                      {activeCameras.length} {activeCameras.length === 1 ? 'camera' : 'cameras'} online
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-900 border-white/10">
                  <p className="text-xs text-white/80">Click camera to focus • Press F to toggle fullscreen</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Right: Essential Controls */}
            <div className="flex items-center gap-2">
              {/* Live Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-400 hidden sm:inline">LIVE</span>
              </div>

              {/* Wake Lock Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={wakeLockEnabled ? "default" : "ghost"}
                      className={
                        wakeLockEnabled
                          ? "bg-green-600 hover:bg-green-700 text-white h-9 w-9 p-0 rounded-full relative"
                          : "text-white/80 hover:text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full"
                      }
                      onClick={() => {
                        const newState = !wakeLockEnabled;
                        setWakeLockEnabled(newState);
                        toast({
                          title: newState ? 'Screen Stay On Enabled' : 'Disabled',
                          description: newState ? 'Keep app in foreground' : 'Screen may sleep',
                        });
                      }}
                    >
                      <Power className="h-4 w-4" />
                      {wakeLockEnabled && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Keep screen on</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Events Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full"
                      onClick={() => navigate('/app/events')}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">View events</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Settings Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full"
                      onClick={() => navigate('/app/settings')}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Main Content - Full Viewport Camera Grid */}
        <div className="flex-1 relative overflow-hidden">
          <AdaptiveCameraGrid
            cameras={cameras}
            focusedCameraId={focusedCameraId}
            onCameraFocus={handleCameraFocus}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default StreamDashboard;
