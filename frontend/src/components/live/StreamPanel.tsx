import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScreenshotButton } from '@/components/live/ScreenshotButton';
import { QualitySection, QualityMetrics } from '@/components/live/QualitySection';
import { Camera } from '@/types/security';
import { RecentDetectionsSection } from '@/components/live/RecentDetectionsSection';
import {
  Wifi,
  WifiOff,
  Loader2,
  Maximize2,
  Camera as CameraIcon,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface StreamPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: Camera;
  // Connection
  connectionState: ConnectionState;
  // Metrics
  displayFps: number;
  bandwidth: number;
  latency: number;
  // Motion
  motionDetected: boolean;
  motionConfidence: number;
  objectCount: number;
  // Actions
  onScreenshot?: () => void;
  onFullscreen?: () => void;
  // Ref for screenshot
  imgRef?: React.RefObject<HTMLImageElement>;
}

const connectionConfig: Record<
  ConnectionState,
  { icon: React.ElementType; label: string; color: string }
> = {
  idle: { icon: WifiOff, label: 'Idle', color: 'text-muted-foreground' },
  connecting: { icon: Loader2, label: 'Connecting', color: 'text-yellow-400' },
  connected: { icon: Wifi, label: 'Connected', color: 'text-green-400' },
  error: { icon: WifiOff, label: 'Error', color: 'text-red-400' },
  reconnecting: { icon: Loader2, label: 'Reconnecting', color: 'text-yellow-400' },
};

export const StreamPanel: React.FC<StreamPanelProps> = ({
  open,
  onOpenChange,
  camera,
  connectionState,
  displayFps,
  bandwidth,
  latency,
  motionDetected,
  motionConfidence,
  objectCount,
  onFullscreen,
  imgRef,
}) => {
  const conn = connectionConfig[connectionState];
  const ConnIcon = conn.icon;

  const resolution =
    camera.config?.detect
      ? `${camera.config.detect.width}x${camera.config.detect.height}`
      : camera.resolution || '720p';

  const metrics: QualityMetrics = {
    resolution,
    fps: displayFps,
    bandwidth: Math.round(bandwidth / 1024),
    latency,
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[70vh] dark:bg-gray-900"
        aria-label={`Stream panel for ${camera.name}`}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base flex items-center gap-2">
            <CameraIcon className="h-4 w-4" />
            {camera.name}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Stream information and controls for {camera.name}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-3 overflow-y-auto">
          {/* Connection Status */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50"
            role="status"
            aria-label={`Connection status: ${conn.label}`}
          >
            <ConnIcon
              className={cn(
                'h-4 w-4',
                conn.color,
                (connectionState === 'connecting' ||
                  connectionState === 'reconnecting') &&
                  'animate-spin'
              )}
            />
            <span className={cn('text-sm font-medium', conn.color)}>
              {conn.label}
            </span>
          </div>

          {/* Quality Metrics */}
          {connectionState === 'connected' && (
            <QualitySection metrics={metrics} />
          )}

          {/* Motion Alert */}
          {motionDetected && (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md',
                motionConfidence >= 70
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-yellow-500/15 text-yellow-400'
              )}
              role="alert"
              aria-label={`Motion detected with ${motionConfidence}% confidence`}
            >
              {motionConfidence >= 70 ? (
                <ShieldAlert className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">
                  Motion Detected
                </span>
                <span className="text-xs ml-2 opacity-80">
                  {motionConfidence}% confidence
                  {objectCount > 0 && ` · ${objectCount} object${objectCount > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          )}

          {/* No Motion indicator */}
          {!motionDetected && connectionState === 'connected' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 text-green-400"
              role="status"
              aria-label="No motion detected"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm">All Clear</span>
            </div>
          )}

          {/* Recent Detections */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Recent Detections
            </h4>
            <RecentDetectionsSection cameraId={camera.id} />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-3 pt-1">
            {imgRef && (
              <ScreenshotButton
                camera={camera}
                imgRef={imgRef}
                className="h-11 w-11 rounded-full bg-muted hover:bg-muted/80 text-foreground"
              />
            )}
            {onFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full bg-muted hover:bg-muted/80"
                onClick={onFullscreen}
                title="Fullscreen"
                aria-label="Enter fullscreen"
              >
                <Maximize2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
