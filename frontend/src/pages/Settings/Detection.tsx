import React, { useState, useCallback } from 'react';
import { useDetectionConfig, useUpdateDetectionConfig } from '../hooks/useReview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, RotateCcw, AlertTriangle } from 'lucide-react';

interface DetectionSettingsProps {
  camera?: string;
}

export function DetectionSettings({ camera }: DetectionSettingsProps) {
  const { data: config, isLoading, error } = useDetectionConfig(camera);
  const { mutate: updateConfig, isPending } = useUpdateDetectionConfig();

  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  }, [config]);

  const handleThresholdChange = useCallback((label: string, field: 'min_score' | 'threshold', value: number) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        thresholds: {
          ...prev.thresholds,
          [label]: {
            ...prev.thresholds[label],
            [field]: value,
          },
        },
      };
    });
    setHasChanges(true);
  }, []);

  const handleLabelmapChange = useCallback((original: string, mapped: string) => {
    setLocalConfig(prev => {
      if (!prev) return prev;
      const newLabelmap = { ...prev.labelmap };
      if (mapped) {
        newLabelmap[original] = mapped;
      } else {
        delete newLabelmap[original];
      }
      return {
        ...prev,
        labelmap: newLabelmap,
      };
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (localConfig) {
      updateConfig({ config: localConfig, camera });
    }
    setHasChanges(false);
  }, [localConfig, camera, updateConfig]);

  const handleReset = useCallback(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-32" /></CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load detection configuration.</AlertDescription>
      </Alert>
    );
  }

  const labels = Object.keys(localConfig?.thresholds || DEFAULT_THRESHOLDS);
  const labelmapEntries = Object.entries(localConfig?.labelmap || {});

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Detection Settings
          </h1>
          <p className="text-muted-foreground">
            Configure object detection thresholds and label mapping
            {camera && ` for camera: ${camera}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-yellow-500">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isPending}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="thresholds" className="w-full">
        <TabsList>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="labelmap">Label Mapping</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Thresholds</CardTitle>
              <CardDescription>
                Configure minimum and alert thresholds for each object type.
                Detections below the minimum score are filtered out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {labels.map((label) => {
                const threshold = localConfig?.thresholds?.[label] || DEFAULT_THRESHOLDS[label];
                return (
                  <div key={label} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium capitalize">{label}</Label>
                      <Badge variant="secondary">{label}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`${label}-min`} className="text-sm">
                            Minimum Score
                          </Label>
                          <span className="text-sm text-muted-foreground">
                            {threshold?.min_score?.toFixed(2) ?? 0.30}
                          </span>
                        </div>
                        <Slider
                          id={`${label}-min`}
                          min={0}
                          max={1}
                          step={0.05}
                          value={[threshold?.min_score ?? 0.30]}
                          onValueChange={([value]) => handleThresholdChange(label, 'min_score', value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Filter out detections below this score
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`${label}-threshold`} className="text-sm">
                            Alert Threshold
                          </Label>
                          <span className="text-sm text-muted-foreground">
                            {threshold?.threshold?.toFixed(2) ?? 0.50}
                          </span>
                        </div>
                        <Slider
                          id={`${label}-threshold`}
                          min={0}
                          max={1}
                          step={0.05}
                          value={[threshold?.threshold ?? 0.50]}
                          onValueChange={([value]) => handleThresholdChange(label, 'threshold', value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Consider as alert when above this score
                        </p>
                      </div>
                    </div>
                    <hr />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labelmap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Label Mapping</CardTitle>
              <CardDescription>
                Map similar object types together to reduce noise.
                For example, map "truck" and "bus" to "car".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {labelmapEntries.map(([original, mapped]) => (
                <div key={original} className="flex items-center gap-4">
                  <Badge variant="outline" className="w-24 justify-center">
                    {original}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Input
                    value={mapped}
                    onChange={(e) => handleLabelmapChange(original, e.target.value)}
                    className="w-32"
                    placeholder="Mapped label"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLabelmapChange(original, '')}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Add new mappings by specifying the original label and target label.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure score history and other advanced detection settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="score-history">Score History Length</Label>
                <Input
                  id="score-history"
                  type="number"
                  min={1}
                  max={20}
                  value={localConfig?.score_history_length ?? 7}
                  onChange={(e) => {
                    setLocalConfig(prev => prev ? {
                      ...prev,
                      score_history_length: parseInt(e.target.value) || 7,
                    } : prev);
                    setHasChanges(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Number of detections to track for calculating median scores (1-20). Higher values
                  provide more stable scores but may be slower to respond to changes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DEFAULT_THRESHOLDS: Record<string, { min_score: number; threshold: number }> = {
  person: { min_score: 0.3, threshold: 0.5 },
  car: { min_score: 0.4, threshold: 0.6 },
  dog: { min_score: 0.3, threshold: 0.4 },
  package: { min_score: 0.25, threshold: 0.35 },
};

export default DetectionSettings;
