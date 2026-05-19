import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { detectionService } from '@/services/api/detectionService';
import { useToast } from '@/hooks/use-toast';

interface MotionDetectionSettingsProps {
  markChanged: () => void;
}

interface MotionSettings {
  sensitivity: number;
  requiredConsecutiveFrames: number;
  minContourArea: number;
  useGaussianBlur: boolean;
  blurKernelSize: number;
}

export const MotionDetectionSettings: React.FC<MotionDetectionSettingsProps> = ({ markChanged }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<MotionSettings>({
    sensitivity: 90,
    requiredConsecutiveFrames: 3,
    minContourArea: 500,
    useGaussianBlur: true,
    blurKernelSize: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await detectionService.getMotionSettings('cam1');
        setSettings({
          sensitivity: data.sensitivity,
          requiredConsecutiveFrames: data.requiredConsecutiveFrames,
          minContourArea: data.minContourArea,
          useGaussianBlur: data.useGaussianBlur,
          blurKernelSize: data.blurKernelSize,
        });
      } catch {
        console.error('Failed to load motion settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (newSettings: Partial<MotionSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    setSaving(true);
    try {
      await detectionService.updateMotionSettings('cam1', updated);
      await detectionService.updateMotionSettings('cam2', updated);
      toast({ title: 'Motion settings saved', description: 'Applied to all cameras.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Could not update motion settings.',
      });
    } finally {
      setSaving(false);
    }
  };

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
          onValueChange={(v) => handleSave({ sensitivity: parseInt(v) })}
          disabled={saving}
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
          onValueChange={(v) => handleSave({ requiredConsecutiveFrames: parseInt(v) })}
          disabled={saving}
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
          onValueChange={(v) => handleSave({ minContourArea: parseInt(v) })}
          disabled={saving}
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
    </div>
  );
};
