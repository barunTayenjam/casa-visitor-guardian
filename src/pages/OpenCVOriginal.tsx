import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Camera, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Image as ImageIcon,
  Zap,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Camera {
  id: string;
  name: string;
  isActive: boolean;
  status: 'online' | 'offline' | 'warning';
}

interface OpenCVServiceStatus {
  status: 'ready' | 'initializing' | 'error';
  initialized: boolean;
  service: string;
}

interface DetectionResult {
  success: boolean;
  cached: boolean;
  detections?: Array<{
    class: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faceDetections?: Array<{
    id: string;
    name: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  processingTime?: number;
  fileHash: string;
  error?: string;
}

const OpenCV: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [serviceStatus, setServiceStatus] = useState<OpenCVServiceStatus | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCameras();
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await fetch('/api/cameras');
      const data = await response.json();
      if (data.success) {
        setCameras(data.cameras);
        if (data.cameras.length > 0 && !selectedCamera) {
          setSelectedCamera(data.cameras[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cameras",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/api/opencv/status');
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data.status);
      } else {
        setServiceStatus({ status: 'error', initialized: false, service: 'opencv-detection' });
      }
    } catch (error) {
      setServiceStatus({ status: 'error', initialized: false, service: 'opencv-detection' });
    }
  };

  const triggerObjectDetection = async () => {
    if (!selectedCamera) {
      toast({
        title: "Error",
        description: "Please select a camera first",
        variant: "destructive",
      });
      return;
    }

    setIsDetecting(true);
    try {
      const response = await fetch(`/api/detection/person/${selectedCamera}/trigger`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDetectionResults(prev => [result, ...prev.slice(0, 9)]);
        toast({
          title: "Detection Complete",
          description: `Found ${result.persons} person(s) in image`,
        });
      } else {
        throw new Error(result.error || 'Detection failed');
      }
    } catch (error) {
      console.error('Object detection failed:', error);
      toast({
        title: "Detection Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const triggerFaceRecognition = async () => {
    if (!selectedCamera) {
      toast({
        title: "Error",
        description: "Please select a camera first",
        variant: "destructive",
      });
      return;
    }

    setIsDetecting(true);
    try {
      const response = await fetch(`/api/detection/face/${selectedCamera}/trigger`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDetectionResults(prev => [result, ...prev.slice(0, 9)]);
        toast({
          title: "Face Recognition Complete",
          description: `Found ${result.faces} face(s) (${result.knownFaces} known, ${result.unknownFaces} unknown)`,
        });
      } else {
        throw new Error(result.error || 'Face recognition failed');
      }
    } catch (error) {
      console.error('Face recognition failed:', error);
      toast({
        title: "Face Recognition Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const captureSnapshot = async () => {
    if (!selectedCamera) return;

    try {
      const response = await fetch(`/api/cameras/${selectedCamera}/snapshot`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSelectedImage(result.snapshotPath);
        toast({
          title: "Snapshot Captured",
          description: "Image captured successfully",
        });
      }
    } catch (error) {
      console.error('Snapshot failed:', error);
      toast({
        title: "Snapshot Failed",
        description: "Failed to capture image",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'online':
        return 'bg-green-500';
      case 'initializing':
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'online':
        return <CheckCircle className="h-4 w-4" />;
      case 'initializing':
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'error':
      case 'offline':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading OpenCV Detection...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OpenCV Detection</h1>
          <p className="text-muted-foreground">
            Computer vision detection and face recognition using OpenCV
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            {serviceStatus && getStatusIcon(serviceStatus.status)}
            <span>Service: {serviceStatus?.status || 'Unknown'}</span>
          </Badge>
        </div>
      </div>

      {serviceStatus?.status === 'error' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            OpenCV service is not responding. Please ensure OpenCV microservice is running on port 8084.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Camera className="mr-2 h-5 w-5" />
              Camera Selection
            </CardTitle>
            <CardDescription>
              Select a camera for detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger>
                <SelectValue placeholder="Select a camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status)}`} />
                      <span>{camera.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedCamera && (
              <div className="mt-4 space-y-2">
                <Button 
                  onClick={captureSnapshot}
                  variant="outline" 
                  className="w-full"
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Capture Snapshot
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Detection Controls
            </CardTitle>
            <CardDescription>
              Trigger AI detection on selected camera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={triggerObjectDetection}
              disabled={isDetecting || !selectedCamera}
              className="w-full"
            >
              <Zap className="mr-2 h-4 w-4" />
              {isDetecting ? 'Detecting...' : 'Object Detection'}
            </Button>
            
            <Button 
              onClick={triggerFaceRecognition}
              disabled={isDetecting || !selectedCamera}
              variant="outline"
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              {isDetecting ? 'Recognizing...' : 'Face Recognition'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Service Information
            </CardTitle>
            <CardDescription>
              OpenCV microservice status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={serviceStatus?.status === 'ready' ? 'default' : 'destructive'}>
                  {serviceStatus?.status || 'Unknown'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Initialized</span>
                <Badge variant={serviceStatus?.initialized ? 'default' : 'secondary'}>
                  {serviceStatus?.initialized ? 'Yes' : 'No'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Active Cameras</span>
                <span className="text-sm">{cameras.filter(c => c.isActive).length}/{cameras.length}</span>
              </div>
              
              <Button 
                onClick={checkServiceStatus}
                variant="outline" 
                size="sm"
                className="w-full mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Detection Results</CardTitle>
            <CardDescription>
              Latest detection and recognition results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {detectionResults.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Eye className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No detection results yet</p>
                  <p className="text-sm">Run a detection to see results here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detectionResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.success ? 'Success' : 'Failed'}
                        </Badge>
                        {result.cached && (
                          <Badge variant="secondary" className="ml-2">Cached</Badge>
                        )}
                      </div>
                      
                      {result.detections && result.detections.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium">Objects Detected:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.detections.map((detection, i) => (
                              <Badge key={i} variant="outline">
                                {detection.class} ({Math.round(detection.confidence * 100)}%)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {result.faceDetections && result.faceDetections.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium">Faces Detected:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.faceDetections.map((face, i) => (
                              <Badge key={i} variant="outline">
                                {face.name || 'Unknown'} ({Math.round(face.confidence * 100)}%)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {result.processingTime && (
                        <p className="text-xs text-muted-foreground">
                          Processing time: {result.processingTime}ms
                        </p>
                      )}
                      
                      {result.error && (
                        <p className="text-xs text-red-500">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Image</CardTitle>
            <CardDescription>
              Latest snapshot from selected camera
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedImage ? (
              <div className="space-y-4">
                <img 
                  src={selectedImage} 
                  alt="Current snapshot" 
                  className="w-full rounded-lg border"
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedImage.split('/').pop()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <ImageIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No image captured</p>
                <p className="text-sm">Capture a snapshot to see it here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OpenCV;