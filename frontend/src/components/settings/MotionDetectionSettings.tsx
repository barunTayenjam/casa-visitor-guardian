import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCameras } from '../../contexts/CameraContext';

interface MotionSettings {
  sensitivity: number;
  requiredConsecutiveFrames: number;
  minContourArea: number;
}

export interface MotionDetectionSettingsHandle {
  save: () => Promise<void>;
}

interface MotionDetectionSettingsProps {
  markChanged: () => void;
}

export const MotionDetectionSettings = forwardRef<MotionDetectionSettingsHandle, MotionDetectionSettingsProps>(
  ({ markChanged }, ref) => {
    const { cameras } = useCameras();
    const [settings, setSettings] = useState<MotionSettings>({
      sensitivity: 90,
      requiredConsecutiveFrames: 3,
      minContourArea: 500,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (cameras.length === 0) {
        setLoading(false);
        return;
      }
      const load = async () => {
        try {
          const { detectionService } = await import('@/services/api/detectionService');
          const data = await detectionService.getMotionSettings(cameras[0].id);
          setSettings({
            sensitivity: data.sensitivity,
            requiredConsecutiveFrames: data.requiredConsecutiveFrames,
            minContourArea: data.minContourArea,
          });
        } catch {
          console.error('Failed to load motion settings');
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [cameras]);

    useImperativeHandle(ref, () => ({
      save: async () => {
        const { detectionService } = await import('@/services/api/detectionService');
        const updates = {
          sensitivity: settings.sensitivity,
          requiredConsecutiveFrames: settings.requiredConsecutiveFrames,
          minContourArea: settings.minContourArea,
        };
        for (const cam of cameras) {
          await detectionService.updateMotionSettings(cam.id, updates);
        }
      },
    }));

    if (loading) {
      return (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Loading detection settings...</p>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Sensitivity</Label>
            <p className="text-xs text-muted-foreground">Higher values detect more motion</p>
          </div>
          <Select
            value={settings.sensitivity.toString()}
            onValueChange={(v) => { setSettings(s => ({ ...s, sensitivity: parseInt(v) })); markChanged(); }}
          >
            <SelectTrigger className="w-28 bg-muted border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="70">Low (70)</SelectItem>
              <SelectItem value="80">Medium (80)</SelectItem>
              <SelectItem value="90">High (90)</SelectItem>
              <SelectItem value="95">Very High (95)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Consecutive Frames</Label>
            <p className="text-xs text-muted-foreground">Frames required before triggering event</p>
          </div>
          <Select
            value={settings.requiredConsecutiveFrames.toString()}
            onValueChange={(v) => { setSettings(s => ({ ...s, requiredConsecutiveFrames: parseInt(v) })); markChanged(); }}
          >
            <SelectTrigger className="w-28 bg-muted border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 frames</SelectItem>
              <SelectItem value="3">3 frames</SelectItem>
              <SelectItem value="4">4 frames</SelectItem>
              <SelectItem value="5">5 frames</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Min Contour Area</Label>
            <p className="text-xs text-muted-foreground">Minimum object size to trigger detection</p>
          </div>
          <Select
            value={settings.minContourArea.toString()}
            onValueChange={(v) => { setSettings(s => ({ ...s, minContourArea: parseInt(v) })); markChanged(); }}
          >
            <SelectTrigger className="w-28 bg-muted border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="250">Small (250)</SelectItem>
              <SelectItem value="500">Medium (500)</SelectItem>
              <SelectItem value="1000">Large (1000)</SelectItem>
              <SelectItem value="2000">Very Large (2000)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Cameras: {cameras.map(c => c.name).join(', ')}
        </div>
      </div>
    );
  }
);

MotionDetectionSettings.displayName = 'MotionDetectionSettings';
