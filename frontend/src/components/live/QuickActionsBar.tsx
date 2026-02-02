import React from 'react';
import { Camera, Download, Settings, Shield, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { colors } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';

interface QuickActionsBarProps {
  systemArmed?: boolean;
  recordingEnabled?: boolean;
  motionDetectionEnabled?: boolean;
  notificationsEnabled?: boolean;
  onSystemArmToggle?: (enabled: boolean) => void;
  onRecordingToggle?: (enabled: boolean) => void;
  onMotionDetectionToggle?: (enabled: boolean) => void;
  onNotificationsToggle?: (enabled: boolean) => void;
  onTakeSnapshot?: () => void;
  onOpenSettings?: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  systemArmed = true,
  recordingEnabled = true,
  motionDetectionEnabled = true,
  notificationsEnabled = true,
  onSystemArmToggle,
  onRecordingToggle,
  onMotionDetectionToggle,
  onNotificationsToggle,
  onTakeSnapshot,
  onOpenSettings,
}) => {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40"
      style={{
        background: `linear-gradient(to top, ${colors.glass.heavy}, transparent)`,
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${colors.border.subtle}`,
      }}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: System Status Toggles */}
          <div className="flex items-center gap-6">
            {/* Arm/Disarm */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Shield
                  className={cn(
                    'h-4 w-4 transition-colors',
                    systemArmed ? 'text-green-500' : 'text-gray-500'
                  )}
                />
                <span className="text-sm text-white/90 font-medium">
                  {systemArmed ? 'Armed' : 'Disarmed'}
                </span>
              </div>
              <Switch
                checked={systemArmed}
                onCheckedChange={onSystemArmToggle}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Recording */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    recordingEnabled && 'bg-red-500 animate-pulse'
                  )}
                />
                <span className="text-sm text-white/90">Recording</span>
              </div>
              <Switch
                checked={recordingEnabled}
                onCheckedChange={onRecordingToggle}
                className="data-[state=checked]:bg-red-500"
              />
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Motion Detection */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/90">Motion</span>
              </div>
              <Switch
                checked={motionDetectionEnabled}
                onCheckedChange={onMotionDetectionToggle}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Notifications */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bell
                  className={cn(
                    'h-4 w-4 transition-colors',
                    notificationsEnabled ? 'text-blue-400' : 'text-gray-500'
                  )}
                />
                <span className="text-sm text-white/90">Alerts</span>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={onNotificationsToggle}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              onClick={onTakeSnapshot}
            >
              <Download className="h-4 w-4 mr-2" />
              Snapshot
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
