import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { 
  User, 
  Camera, 
  Settings, 
  Play, 
  StopCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  AlertTriangle
} from 'lucide-react';
import { Camera as CameraType } from '@/types/security';
import apiService from '@/services/ApiService';

interface DetectionControlProps {
  camera: CameraType;
  onDetectionResult?: (result: {
    type: 'person' | 'face' | 'enhanced';
    cameraId: string;
    result: any;
  }) => void;
}

interface PersonDetectionSettings {
  detectClasses: string[];
  confidenceThreshold: number;
  maxDetections: number;
}

interface FacialRecognitionSettings {
  recognitionThreshold: number;
  minFaceSize: number;
  livenessDetection: boolean;
}

export const DetectionControl: React.FC<DetectionControlProps> = ({ 
  camera, 
  onDetectionResult 
}) => {
  const [isDetectingPerson, setIsDetectingPerson] = useState(false);
  const [isDetectingFace, setIsDetectingFace] = useState(false);
  const [personSettings, setPersonSettings] = useState<PersonDetectionSettings>({
    detectClasses: ['person'],
    confidenceThreshold: 0.5,
    maxDetections: 10
  });
  const [faceSettings, setFaceSettings] = useState<FacialRecognitionSettings>({
    recognitionThreshold: 0.6,
    minFaceSize: 48,
    livenessDetection: false
  });
  const [lastPersonResult, setLastPersonResult] = useState<any>(null);
  const [lastFaceResult, setLastFaceResult] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handlePersonDetection = async () => {
    if (!camera.id) return;
    
    setIsDetectingPerson(true);
    try {
      const result = await apiService.triggerPersonDetection(camera.id);
      setLastPersonResult(result);
      onDetectionResult?.({ type: 'person', cameraId: camera.id, result });
    } catch (error) {
      console.error('Person detection failed:', error);
      setLastPersonResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsDetectingPerson(false);
    }
  };

  const handleFaceDetection = async () => {
    if (!camera.id) return;
    
    setIsDetectingFace(true);
    try {
      const result = await apiService.triggerFaceDetection(camera.id);
      setLastFaceResult(result);
      onDetectionResult?.({ type: 'face', cameraId: camera.id, result });
    } catch (error) {
      console.error('Face detection failed:', error);
      setLastFaceResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsDetectingFace(false);
    }
  };

  const handleEnhancedMotionAnalysis = async () => {
    if (!camera.id) return;
    
    setIsDetectingPerson(true);
    setIsDetectingFace(true);
    try {
      const result = await apiService.analyzeMotionWithDetection(camera.id, {
        enablePersonDetection: true,
        enableFaceDetection: true
      });
      setLastPersonResult({ persons: result.persons?.length || 0, timestamp: result.timestamp });
      setLastFaceResult({ 
        faces: result.faces?.length || 0, 
        knownFaces: result.faces?.filter((f: any) => f.isKnown).length || 0,
        unknownFaces: result.faces?.filter((f: any) => !f.isKnown).length || 0,
        timestamp: result.timestamp 
      });
      onDetectionResult?.({ type: 'enhanced', cameraId: camera.id, result });
    } catch (error) {
      console.error('Enhanced motion analysis failed:', error);
      setLastPersonResult({ error: error instanceof Error ? error.message : 'Unknown error' });
      setLastFaceResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsDetectingPerson(false);
      setIsDetectingFace(false);
    }
  };

  const updatePersonSettings = async (settings: Partial<PersonDetectionSettings>) => {
    try {
      const updated = await apiService.updatePersonDetectionSettings(settings);
      setPersonSettings(updated);
    } catch (error) {
      console.error('Failed to update person detection settings:', error);
    }
  };

  const updateFaceSettings = async (settings: Partial<FacialRecognitionSettings>) => {
    try {
      const updated = await apiService.updateFacialRecognitionSettings(settings);
      setFaceSettings(updated);
    } catch (error) {
      console.error('Failed to update face recognition settings:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <CardTitle className="text-sm">Detection Controls</CardTitle>
            <Badge variant={camera.status === 'online' ? 'default' : 'secondary'}>
              {camera.status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
        <CardDescription>
          {camera.name} - Manual detection triggers
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Detection Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handlePersonDetection}
            disabled={isDetectingPerson || camera.status !== 'online'}
            size="sm"
            variant="outline"
          >
            {isDetectingPerson ? (
              <StopCircle className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <User className="h-4 w-4 mr-2" />
            )}
            {isDetectingPerson ? 'Detecting...' : 'Detect Person'}
          </Button>
          
          <Button
            onClick={handleFaceDetection}
            disabled={isDetectingFace || camera.status !== 'online'}
            size="sm"
            variant="outline"
          >
            {isDetectingFace ? (
              <StopCircle className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <UserCheck className="h-4 w-4 mr-2" />
            )}
            {isDetectingFace ? 'Scanning...' : 'Face Recognition'}
          </Button>
          
          <Button
            onClick={handleEnhancedMotionAnalysis}
            disabled={(isDetectingPerson || isDetectingFace) || camera.status !== 'online'}
            size="sm"
          >
            {(isDetectingPerson || isDetectingFace) ? (
              <StopCircle className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            {(isDetectingPerson || isDetectingFace) ? 'Analyzing...' : 'Full Analysis'}
          </Button>
        </div>

        {/* Results Display */}
        {(lastPersonResult || lastFaceResult) && (
          <div className="space-y-2">
            <Separator />
            <div className="text-sm font-medium">Latest Results</div>
            
            {lastPersonResult && (
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm">Person Detection</span>
                </div>
                {lastPersonResult.error ? (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : (
                  <Badge variant={lastPersonResult.persons > 0 ? 'default' : 'secondary'}>
                    {lastPersonResult.persons} person{lastPersonResult.persons !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
            
            {lastFaceResult && (
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  <span className="text-sm">Face Recognition</span>
                </div>
                {lastFaceResult.error ? (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : (
                  <div className="flex items-center gap-1">
                    <Badge variant={lastFaceResult.faces > 0 ? 'default' : 'secondary'}>
                      {lastFaceResult.faces} face{lastFaceResult.faces !== 1 ? 's' : ''}
                    </Badge>
                    {lastFaceResult.faces > 0 && (
                      <>
                        <Badge variant="outline">
                          {lastFaceResult.knownFaces} known
                        </Badge>
                        {lastFaceResult.unknownFaces > 0 && (
                          <Badge variant="destructive">
                            {lastFaceResult.unknownFaces} unknown
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="text-sm font-medium">Detection Settings</div>
              
              {/* Person Detection Settings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Person Detection</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Confidence Threshold</Label>
                    <span className="text-xs text-muted-foreground">
                      {(personSettings.confidenceThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[personSettings.confidenceThreshold]}
                    onValueChange={([value]) => {
                      setPersonSettings({ ...personSettings, confidenceThreshold: value });
                      updatePersonSettings({ confidenceThreshold: value });
                    }}
                    max={1}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Max Detections</Label>
                    <span className="text-xs text-muted-foreground">
                      {personSettings.maxDetections}
                    </span>
                  </div>
                  <Slider
                    value={[personSettings.maxDetections]}
                    onValueChange={([value]) => {
                      setPersonSettings({ ...personSettings, maxDetections: value });
                      updatePersonSettings({ maxDetections: value });
                    }}
                    max={20}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Face Recognition Settings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Face Recognition</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Recognition Threshold</Label>
                    <span className="text-xs text-muted-foreground">
                      {(faceSettings.recognitionThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[faceSettings.recognitionThreshold]}
                    onValueChange={([value]) => {
                      setFaceSettings({ ...faceSettings, recognitionThreshold: value });
                      updateFaceSettings({ recognitionThreshold: value });
                    }}
                    max={1}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Min Face Size</Label>
                    <span className="text-xs text-muted-foreground">
                      {faceSettings.minFaceSize}px
                    </span>
                  </div>
                  <Slider
                    value={[faceSettings.minFaceSize]}
                    onValueChange={([value]) => {
                      setFaceSettings({ ...faceSettings, minFaceSize: value });
                      updateFaceSettings({ minFaceSize: value });
                    }}
                    max={200}
                    min={24}
                    step={8}
                    className="w-full"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Liveness Detection</Label>
                  <Switch
                    checked={faceSettings.livenessDetection}
                    onCheckedChange={(checked) => {
                      setFaceSettings({ ...faceSettings, livenessDetection: checked });
                      updateFaceSettings({ livenessDetection: checked });
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DetectionControl;