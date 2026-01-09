import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  RefreshCw,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiService from '@/services/ApiService';
import { useCameras } from '@/contexts/CameraContext';
import DetectionOverlay from '@/components/detection/DetectionOverlay';

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
  const { cameras } = useCameras();
  const { toast } = useToast();
  
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [serviceStatus, setServiceStatus] = useState<any>(null);

  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0].id);
    }
  }, [cameras, selectedCamera]);

  useEffect(() => {
    checkServiceStatus();
  }, []);

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
      const result = await apiService.triggerPersonDetection(selectedCamera);
      
      const detectionResult: DetectionResult = {
        success: true,
        cached: false,
        detections: result.detections || [],
        processingTime: 0,
        fileHash: Date.now().toString()
      };
      setDetectionResults(prev => [detectionResult, ...prev.slice(0, 9)]);
      toast({
        title: "Detection Complete",
        description: `Found ${result.persons} person(s) in image`,
      });
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
      const result = await apiService.triggerFaceDetection(selectedCamera);
      
      const faceDetectionResult: DetectionResult = {
        success: true,
        cached: false,
        detections: result.detections || [],
        processingTime: 0,
        fileHash: Date.now().toString()
      };
      setDetectionResults(prev => [faceDetectionResult, ...prev.slice(0, 9)]);
      toast({
        title: "Face Recognition Complete",
        description: `Found ${result.faces} face(s) (${result.knownFaces} known, ${result.unknownFaces} unknown)`,
      });
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
      const result = await apiService.takeSnapshot(selectedCamera);
      setSelectedImage(result);
      toast({
        title: "Snapshot Captured",
        description: "Image captured successfully",
      });
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OpenCV Detection</h1>
          <p className="text-muted-foreground">
            Real-time computer vision detection and face recognition
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
              Camera Controls
            </CardTitle>
            <CardDescription>
              Select camera and capture snapshot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger>
                <SelectValue placeholder="Select a camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status || 'offline')}`} />
                      <span>{camera.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedCamera && (
              <div className="space-y-2">
                <Button 
                  onClick={captureSnapshot}
                  variant="outline" 
                  className="w-full"
                  disabled={isDetecting}
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
              <Zap className="mr-2 h-5 w-5" />
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
                <span className="text-sm font-medium">Active Cameras</span>
                <span className="text-sm">{cameras.length}/{cameras.length}</span>
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

      <div className="space-y-6">
        {detectionResults.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {detectionResults.map((result, index) => (
              <DetectionOverlay
                key={index}
                imageUrl={selectedImage}
                detections={result.detections}
                faceDetections={result.faceDetections}
                title={`Detection Result #${index + 1}`}
                timestamp={new Date().toISOString()}
                cameraName={cameras.find(c => c.id === selectedCamera)?.name}
              />
            ))}
          </div>
        )}
        
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

      <Card>
        <CardHeader>
          <CardTitle>Detection History</CardTitle>
          <CardDescription>
            View all detection results in the unified Gallery page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Detection history has been moved to the unified Gallery page
              </p>
              <Button asChild>
                <a href="/app/gallery">
                  Go to Gallery
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpenCV;