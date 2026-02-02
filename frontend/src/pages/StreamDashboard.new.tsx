import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameras } from '@/contexts/CameraContext';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { QuickActionsBar } from '@/components/live/QuickActionsBar';
import { RecentDetectionsCarousel } from '@/components/live/RecentDetectionsCarousel';
import { colors, spacing } from '@/styles/design-tokens';
import { Shield, Activity, Calendar, Keyboard, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const StreamDashboard = () => {
  const navigate = useNavigate();
  const { cameras } = useCameras();
  const { toast } = useToast();

  const [systemStatus, setSystemStatus] = useState({
    armed: true,
    recording: true,
    motionDetection: true,
    notifications: true,
  });

  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);

  const handleCameraFocus = (cameraId: string) => {
    console.log('Focus camera:', cameraId);
    if (cameraId === 'undefined' || cameraId === undefined || cameraId === '') {
      setFocusedCameraId(undefined);
    } else if (focusedCameraId === cameraId) {
      setFocusedCameraId(undefined);
    } else {
      setFocusedCameraId(cameraId);
    }
  };

  const handleSystemAction = (action: string, enabled: boolean) => {
    setSystemStatus(prev => {
      const newState = { ...prev, [action]: enabled };
      
      toast({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${enabled ? 'Enabled' : 'Disabled'}`,
        description: `System ${action} has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
      
      return newState;
    });
  };

  const handleTakeSnapshot = async () => {
    try {
      const camera = cameras[0];
      if (camera) {
        // Call the snapshot API
        const response = await fetch(`/api/cameras/${camera.id}/snapshot`, {
          method: 'POST',
        });
        if (response.ok) {
          toast({
            title: 'Snapshot Captured',
            description: 'Snapshot has been saved to your gallery.',
          });
        } else {
          toast({
            title: 'Snapshot Failed',
            description: 'Failed to capture snapshot.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Snapshot Failed',
        description: 'Failed to capture snapshot.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSettings = () => {
    navigate('/app/settings');
  };

  const activeCameras = cameras.filter(c => c.status === 'online');

  // Keyboard shortcuts
  useKeyboardShortcuts(
    [
      {
        key: 'f',
        description: 'Toggle fullscreen mode',
        action: () => {
          if (focusedCameraId) {
            setFocusedCameraId(undefined);
          } else if (cameras.length > 0) {
            setFocusedCameraId(cameras[0].id);
          }
        },
      },
      {
        key: 'l',
        description: 'Cycle through layouts',
        action: () => {
          // This would cycle layouts if we had layout state exposed
          toast({
            title: 'Layout',
            description: 'Use the layout buttons to change view',
          });
        },
      },
      {
        key: '1',
        description: 'Go to Streams',
        action: () => navigate('/app/streams'),
      },
      {
        key: '2',
        description: 'Go to Events',
        action: () => navigate('/app/events'),
      },
      {
        key: 's',
        description: 'Go to Settings',
        action: () => navigate('/app/settings'),
      },
      {
        key: 'r',
        description: 'Refresh cameras',
        action: () => {
          window.location.reload();
        },
      },
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(true),
      },
    ],
    true
  );

  return (
    <>
    {/* Keyboard Shortcuts Help Modal */}
    {showHelp && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.90)', backdropFilter: 'blur(10px)' }} onClick={() => setShowHelp(false)}>
        <div className="max-w-md w-full bg-slate-900 rounded-xl border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-white" />
              <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
            </div>
            <button onClick={() => setShowHelp(false)} className="text-white/60 hover:text-white">
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {[
              { key: 'F', desc: 'Toggle fullscreen mode' },
              { key: 'L', desc: 'Cycle through layouts' },
              { key: '1', desc: 'Go to Streams' },
              { key: '2', desc: 'Go to Events' },
              { key: 'S', desc: 'Go to Settings' },
              { key: 'R', desc: 'Refresh page' },
              { key: '?', desc: 'Show this help' },
            ].map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between p-2 rounded bg-white/5">
                <kbd className="px-2 py-1 rounded bg-white/10 text-white text-sm font-mono">{shortcut.key}</kbd>
                <span className="text-sm text-white/80">{shortcut.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/50 mt-4 text-center">Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono">Esc</kbd> or click outside to close</p>
        </div>
      </div>
    )}

    <div
      className="relative w-full h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: colors.background.primary }}
    >
      {/* Top Navigation Bar - Minimalist */}
      <div
        className="relative z-30 px-4 md:px-6 py-3 border-b"
        style={{
          background: colors.glass.light,
          backdropFilter: 'blur(10px)',
          borderColor: colors.border.subtle,
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left: Logo and Status */}
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3 relative">
              <div
                className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                style={{ backgroundColor: colors.interactive.hover }}
                onClick={() => setShowHelp(true)}
                title="Press ? for keyboard shortcuts"
              >
                <Shield className="h-4 w-4 md:h-5 md:w-5" style={{ color: colors.status.success }} />
              </div>
              {/* Keyboard hint */}
              <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-blue-600 rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold text-white opacity-80 hover:opacity-100 cursor-pointer" onClick={() => setShowHelp(true)}>
                ?
              </div>
              <div>
                <h1 className="text-base md:text-lg font-semibold text-white">SentryVision</h1>
                <p className="text-xs text-white/60 hidden sm:block">
                  {activeCameras.length} cameras online
                </p>
              </div>
            </div>

            <div
              className="h-8 w-px hidden md:block"
              style={{ backgroundColor: colors.border.subtle }}
            />

            {/* Quick Stats - Hide on mobile */}
            <div className="flex items-center gap-4 hidden md:flex">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-white/60" />
                <span className="text-sm text-white/80">Live Monitoring</span>
              </div>
            </div>
          </div>

          {/* Right: Navigation */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/5 hidden md:flex"
              onClick={() => navigate('/app/analytics')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/5"
              onClick={() => navigate('/app/events')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Events</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Detections Carousel */}
      <RecentDetectionsCarousel limit={12} />

      {/* Main Content - Camera Grid */}
      <div className="flex-1 relative overflow-hidden">
        <AdaptiveCameraGrid
          cameras={cameras}
          focusedCameraId={focusedCameraId}
          onCameraFocus={handleCameraFocus}
        />
      </div>

      {/* Bottom Actions Bar */}
      <QuickActionsBar
        systemArmed={systemStatus.armed}
        recordingEnabled={systemStatus.recording}
        motionDetectionEnabled={systemStatus.motionDetection}
        notificationsEnabled={systemStatus.notifications}
        onSystemArmToggle={(enabled) => handleSystemAction('armed', enabled)}
        onRecordingToggle={(enabled) => handleSystemAction('recording', enabled)}
        onMotionDetectionToggle={(enabled) => handleSystemAction('motionDetection', enabled)}
        onNotificationsToggle={(enabled) => handleSystemAction('notifications', enabled)}
        onTakeSnapshot={handleTakeSnapshot}
        onOpenSettings={handleOpenSettings}
      />
    </div>
    </>
  );
};

export default StreamDashboard;
