import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { settingsService, type DetectionConfig } from '@/services/api/settingsService';
import { useToast } from '@/hooks/use-toast';
import { Cpu, Settings } from 'lucide-react';

export const OptimizationSettings = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<DetectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [localThreads, setLocalThreads] = useState(2);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.getDetectionConfig();
        setConfig(data);
        setLocalThreads(data.ffmpegThreads ?? 2);
      } catch (e) {
        console.error('Failed to load detection config', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateConfig = async (newFields: Partial<DetectionConfig>) => {
    try {
      await settingsService.updateDetectionConfig({ ...config, ...newFields });
      setConfig({ ...config, ...newFields });
      toast({ title: 'Saved', description: 'Optimization settings updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update.' });
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Performance Optimization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Low Resource Mode</Label>
            <p className="text-xs text-muted-foreground">Reduce CPU/MEM usage</p>
          </div>
          <Switch 
            checked={config?.lowResourceMode || false} 
            onCheckedChange={(val) => updateConfig({ lowResourceMode: val })} 
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <Label>FFmpeg Threads</Label>
            <span className="font-bold">{localThreads}</span>
          </div>
          <Slider 
            value={[localThreads]} 
            min={1} max={8} step={1}
            onValueChange={(val) => setLocalThreads(val[0])}
            onValueCommit={(val) => updateConfig({ ffmpegThreads: val[0] })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
