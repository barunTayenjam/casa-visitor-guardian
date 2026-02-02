import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameras } from '@/contexts/CameraContext';
import { useToast } from '@/hooks/use-toast';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { QuickActionsBar } from '@/components/live/QuickActionsBar';
import { colors, spacing } from '@/styles/design-tokens';
import { Shield, Activity, Calendar } from 'lucide-react';
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
    toast({
      title: 'Settings',
      description: 'Settings page is not available in the redesigned interface.',
    });
  };

  const activeCameras = cameras.filter(c => c.status === 'online');

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: colors.background.primary }}
    >
      {/* Top Navigation Bar - Minimalist */}
      <div
        className="relative z-30 px-6 py-3 border-b"
        style={{
          background: colors.glass.light,
          backdropFilter: 'blur(10px)',
          borderColor: colors.border.subtle,
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left: Logo and Status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: colors.interactive.hover }}
              >
                <Shield className="h-5 w-5" style={{ color: colors.status.success }} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">SentryVision</h1>
                <p className="text-xs text-white/60">
                  {activeCameras.length} cameras online
                </p>
              </div>
            </div>

            <div
              className="h-8 w-px"
              style={{ backgroundColor: colors.border.subtle }}
            />

            {/* Quick Stats */}
            <div className="flex items-center gap-4">
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
              className="text-white/80 hover:text-white hover:bg-white/5"
              onClick={() => navigate('/app/events')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Events
            </Button>
          </div>
        </div>
      </div>

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
  );
};

export default StreamDashboard;
