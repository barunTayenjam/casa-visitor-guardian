import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
  Play,
  Square,
  Download,
  Search,
  Filter,
  Calendar,
  BarChart3,
  History,
  Grid3X3,
  List,
  ZoomIn,
  X,
  UserCheck,
  UserX,
  PersonStanding,
  ScanFace,
  Box,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiService from '@/services/ApiService';
import { useCameras } from '@/contexts/CameraContext';
import DetectionOverlay from '@/components/detection/DetectionOverlay';
import DetectionAnalytics from '@/components/analytics/DetectionAnalytics';
import FaceRecognitionManager from '@/components/analytics/FaceRecognitionManager';

// Type definitions
interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName?: string;
  imagePath: string;
  detectionType: 'person' | 'face' | 'object';
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  className?: string;
  personName?: string;
  isKnown?: boolean;
  metadata?: Record<string, unknown>;
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

interface BatchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    currentFile?: string;
  };
  options: {
    timeRange: {
      start: string;
      end: string;
    };
    cameraIds?: string[];
    detectionTypes: ('person' | 'face' | 'both')[];
    confidenceThreshold: number;
    saveResults: boolean;
    outputFormat: 'json' | 'csv' | 'database';
  };
  results?: {
    totalImages: number;
    personDetections: number;
    faceDetections: number;
    processingTime: number;
  };
  error?: string;
}

const OpenCV: React.FC = () => {
  const { cameras } = useCameras();
  const { toast } = useToast();
  
  // State for detection controls
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [serviceStatus, setServiceStatus] = useState<{
    status: string;
    initialized: boolean;
    service: string;
  } | null>(null);
  
  // State for detection history
  const [detectionHistory, setDetectionHistory] = useState<DetectionEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEventForPopup, setSelectedEventForPopup] = useState<DetectionEvent | null>(null);
  
  // State for filters
  const [filters, setFilters] = useState({
    detectionType: 'all' as 'all' | 'person' | 'face' | 'object',
    cameraId: 'all' as string,
    minConfidence: 0,
    timeRange: '24h' as '1h' | '6h' | '24h' | '7d' | 'all'
  });
  
  // State for batch processing
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchOptions, setBatchOptions] = useState({
    timeRange: '24h',
    detectionTypes: ['both'] as ('person' | 'face' | 'both')[],
    confidenceThreshold: 0.7,
    saveResults: true,
    outputFormat: 'database' as 'json' | 'csv' | 'database'
  });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Initialize camera selection
  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0].id);
    }
  }, [cameras, selectedCamera]);

  const checkServiceStatus = useCallback(async () => {
    try {
      const status = await apiService.getOpenCVStatus();
      setServiceStatus(status);
    } catch (error) {
      console.error('Error checking OpenCV service status:', error);
      setServiceStatus({ status: 'error', initialized: false, service: 'opencv-detection' });
    }
  }, []);

  const loadDetectionHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const now = new Date();
      let startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h
      switch (filters.timeRange) {
        case '1h': startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000); break;
        case '6h': startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
        case '24h': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case '7d': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      }

      const detectionTypes = filters.detectionType === 'all' ? undefined : 
        filters.detectionType === 'face' ? ['face'] : 
        filters.detectionType === 'person' ? ['person'] : undefined;

      const history = await apiService.getDetectionHistory({
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        cameraIds: filters.cameraId === 'all' ? undefined : [filters.cameraId],
        detectionTypes,
        minConfidence: filters.minConfidence,
        limit: 50
      });
      setDetectionHistory(history);
    } catch (error) {
      console.error('Failed to load detection history:', error);
      toast({
        title: "Error",
        description: "Failed to load detection history",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filters, toast]);

  const loadBatchJobs = useCallback(async () => {
    try {
      const jobs = await apiService.getBatchJobs();
      setBatchJobs(jobs);
    } catch (error) {
      console.error('Failed to load batch jobs:', error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    checkServiceStatus();
    loadDetectionHistory();
    loadBatchJobs();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      loadBatchJobs();
      checkServiceStatus();
    }, 10000);
    
    return () => clearInterval(interval);
   }, [loadDetectionHistory, loadBatchJobs, checkServiceStatus]);

  // Reload detection history when filters change
  useEffect(() => {
    loadDetectionHistory();
  }, [filters, loadDetectionHistory]);


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

  const startBatchProcessing = async () => {
    setIsBatchProcessing(true);
    try {
      const jobId = await apiService.startBatchProcessing({
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        detectionTypes: batchOptions.detectionTypes,
        confidenceThreshold: batchOptions.confidenceThreshold,
        saveResults: batchOptions.saveResults,
        outputFormat: batchOptions.outputFormat
      });
      
      toast({
        title: "Batch Processing Started",
        description: `Job ${jobId} has been started`,
      });
      
      // Refresh jobs
      await loadBatchJobs();
    } catch (error) {
      console.error('Failed to start batch processing:', error);
      toast({
        title: "Batch Processing Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const cancelBatchJob = async (jobId: string) => {
    try {
      await apiService.cancelBatchJob(jobId);
      toast({
        title: "Job Cancelled",
        description: `Batch job has been cancelled`,
      });
      await loadBatchJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel batch job",
        variant: "destructive",
      });
    }
  };

  const downloadBatchResults = async (jobId: string) => {
    try {
      await apiService.downloadBatchResults(jobId);
    } catch (error) {
      console.error('Failed to download results:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download batch results",
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

  const getDetectionTypeIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <Users className="h-4 w-4" />;
      case 'face':
        return <UserCheck className="h-4 w-4" />;
      case 'object':
        return <Eye className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getDetectionTypeColor = (type: string) => {
    switch (type) {
      case 'person':
        return 'bg-blue-100 text-blue-800';
      case 'face':
        return 'bg-green-100 text-green-800';
      case 'object':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OpenCV Detection</h1>
          <p className="text-muted-foreground">
            Computer vision detection and face recognition with batch processing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            {serviceStatus && getStatusIcon(serviceStatus.status)}
            <span>Service: {serviceStatus?.status || 'Unknown'}</span>
          </Badge>
        </div>
      </div>

      {/* Service Status Alert */}
      {serviceStatus?.status === 'error' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            OpenCV service is not responding. Please ensure OpenCV microservice is running on port 8084.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="detection" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="detection" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Detection
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Batch
          </TabsTrigger>
          <TabsTrigger value="face-recognition" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Face Recognition
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Detection Tab */}
        <TabsContent value="detection" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Camera Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Camera className="mr-2 h-5 w-5" />
                  Camera Controls
                </CardTitle>
                <CardDescription>
                  Select camera and trigger detection
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

            {/* Detection Controls */}
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

            {/* Service Information */}
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

          {/* Detection Results */}
          <div className="space-y-6">
            {detectionResults.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                {detectionResults.map((result, index) => (
                  <DetectionOverlay
                    key={index}
                    imageUrl={selectedImage || '/placeholder-image.png'}
                    detections={result.detections}
                    faceDetections={result.faceDetections}
                    title={`Detection Result #${index + 1}`}
                    timestamp={new Date().toISOString()}
                    cameraName={cameras.find(c => c.id === selectedCamera)?.name}
                  />
                ))}
              </div>
            )}
            
            {/* Current Image with Controls */}
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
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Detection Type</Label>
                  <Select 
                    value={filters.detectionType} 
                    onValueChange={(value: 'all' | 'person' | 'face' | 'object') => setFilters(prev => ({ ...prev, detectionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="face">Face</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Camera</Label>
                  <Select 
                    value={filters.cameraId} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, cameraId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cameras</SelectItem>
                      {cameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id}>
                          {camera.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Min Confidence: {Math.round(filters.minConfidence * 100)}%</Label>
                  <Slider
                    value={[filters.minConfidence]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, minConfidence: value }))}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select 
                    value={filters.timeRange} 
                    onValueChange={(value: '1h' | '6h' | '24h' | '7d' | 'all') => setFilters(prev => ({ ...prev, timeRange: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Last Hour</SelectItem>
                      <SelectItem value="6h">Last 6 Hours</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button onClick={loadDetectionHistory} disabled={isLoadingHistory}>
                  <Search className="mr-2 h-4 w-4" />
                  {isLoadingHistory ? 'Loading...' : 'Search'}
                </Button>
                
                <div className="flex gap-1 ml-auto">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detection History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  Detection History
                </span>
                <Badge variant="outline">
                  {(detectionHistory || []).length} events
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <RefreshCw className="mx-auto h-8 w-8 animate-spin" />
                  <p className="mt-2">Loading detection history...</p>
                </div>
              ) : (detectionHistory || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No detection history found</p>
                  <p className="text-sm">Try adjusting filters or run some detections</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  {viewMode === 'grid' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {(detectionHistory || []).map((event) => (
                        <div 
                          key={event.id} 
                          className="border rounded-lg p-4 space-y-2 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                          onClick={() => setSelectedEventForPopup(event)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge className={getDetectionTypeColor(event.detectionType)}>
                              {getDetectionTypeIcon(event.detectionType)}
                              <span className="ml-1">{event.detectionType}</span>
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {event.confidence >= 1 ? Math.round(event.confidence) + '%' : Math.round(event.confidence * 100) + '%'}
                            </span>
                          </div>
                          
                          <div className="aspect-video bg-muted rounded relative overflow-hidden">
                            <img 
                              src={event.imagePath} 
                              alt={event.detectionType}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-image.png';
                              }}
                            />
                          </div>
                          
                          <div className="text-sm">
                            <p className="font-medium">{event.cameraName || event.cameraId}</p>
                            <p className="text-muted-foreground">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                            {event.personName && (
                              <p className="text-green-600">
                                {event.isKnown ? <UserCheck className="inline h-3 w-3" /> : <UserX className="inline h-3 w-3" />}
                                <span className="ml-1">{event.personName}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(detectionHistory || []).map((event) => (
                        <div 
                          key={event.id} 
                          className="flex items-center justify-between p-3 border rounded cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                          onClick={() => setSelectedEventForPopup(event)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-16 h-12 bg-muted rounded relative overflow-hidden">
                              <img 
                                src={event.imagePath} 
                                alt={event.detectionType}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder-image.png';
                                }}
                              />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <Badge className={getDetectionTypeColor(event.detectionType)}>
                                  {getDetectionTypeIcon(event.detectionType)}
                                  <span className="ml-1">{event.detectionType}</span>
                                </Badge>
                                <span className="text-sm font-medium">
                                  {event.confidence >= 1 ? Math.round(event.confidence) + '%' : Math.round(event.confidence * 100) + '%'}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {event.cameraName || event.cameraId} • {new Date(event.timestamp).toLocaleString()}
                              </p>
                              {event.personName && (
                                <p className="text-sm text-green-600">
                                  {event.isKnown ? <UserCheck className="inline h-3 w-3" /> : <UserX className="inline h-3 w-3" />}
                                  <span className="ml-1">{event.personName}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventForPopup(event);
                          }}>
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Processing Tab */}
        <TabsContent value="batch" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Batch Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="mr-2 h-5 w-5" />
                  Batch Processing
                </CardTitle>
                <CardDescription>
                  Process historical motion detection images
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select 
                    value={batchOptions.timeRange} 
                    onValueChange={(value: string) => setBatchOptions(prev => ({ ...prev, timeRange: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Last Hour</SelectItem>
                      <SelectItem value="6h">Last 6 Hours</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Detection Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {['person', 'face', 'both'].map((type) => (
                      <label key={type} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                           checked={batchOptions.detectionTypes.includes(type as 'person' | 'face' | 'both')}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setBatchOptions(prev => ({
                                 ...prev,
                                 detectionTypes: [...prev.detectionTypes, type as 'person' | 'face' | 'both']
                               }));
                            } else {
                              setBatchOptions(prev => ({
                                ...prev,
                                detectionTypes: prev.detectionTypes.filter(t => t !== type)
                              }));
                            }
                          }}
                        />
                        <span className="text-sm capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confidence Threshold: {Math.round(batchOptions.confidenceThreshold * 100)}%</Label>
                  <Slider
                    value={[batchOptions.confidenceThreshold]}
                    onValueChange={([value]) => setBatchOptions(prev => ({ ...prev, confidenceThreshold: value }))}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Save Results</Label>
                  <Switch
                    checked={batchOptions.saveResults}
                    onCheckedChange={(checked) => setBatchOptions(prev => ({ ...prev, saveResults: checked }))}
                  />
                </div>

                <Button 
                  onClick={startBatchProcessing}
                  disabled={isBatchProcessing}
                  className="w-full"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isBatchProcessing ? 'Starting...' : 'Start Batch Processing'}
                </Button>
              </CardContent>
            </Card>

            {/* Batch Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Batch Jobs
                </CardTitle>
                <CardDescription>
                  Active and recent batch processing jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {batchJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No batch jobs yet</p>
                      <p className="text-sm">Start a batch processing job to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {batchJobs.map((job) => (
                        <div key={job.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  job.status === 'completed' ? 'default' :
                                  job.status === 'running' ? 'secondary' :
                                  job.status === 'failed' ? 'destructive' : 'outline'
                                }
                              >
                                {job.status}
                              </Badge>
                              <span className="text-sm font-mono">#{job.id.slice(-8)}</span>
                            </div>
                            
                            <div className="flex gap-1">
                              {job.status === 'running' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelBatchJob(job.id)}
                                >
                                  <Square className="h-3 w-3" />
                                </Button>
                              )}
                              {job.status === 'completed' && job.options.saveResults && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadBatchResults(job.id)}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>{job.progress.processed} / {job.progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${(job.progress.processed / job.progress.total) * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>✓ {job.progress.successful}</span>
                              <span>✗ {job.progress.failed}</span>
                            </div>
                            
                            {job.results && (
                              <div className="pt-2 border-t text-sm">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <div className="font-medium">{job.results.totalImages}</div>
                                    <div className="text-xs text-muted-foreground">Images</div>
                                  </div>
                                  <div>
                                    <div className="font-medium">{job.results.personDetections}</div>
                                    <div className="text-xs text-muted-foreground">Persons</div>
                                  </div>
                                  <div>
                                    <div className="font-medium">{job.results.faceDetections}</div>
                                    <div className="text-xs text-muted-foreground">Faces</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Face Recognition Tab */}
        <TabsContent value="face-recognition" className="space-y-6">
          <FaceRecognitionManager />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <DetectionAnalytics
            timeRange={filters.timeRange}
            onTimeRangeChange={(range: '1h' | '6h' | '24h' | '7d' | 'all') => setFilters(prev => ({ ...prev, timeRange: range }))}
          />
        </TabsContent>
      </Tabs>

      {/* Detection Detail Popup */}
      <Dialog open={selectedEventForPopup !== null} onOpenChange={() => setSelectedEventForPopup(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Detection Details
            </DialogTitle>
            <DialogDescription>
              Complete metadata and detection information
            </DialogDescription>
          </DialogHeader>
          
          {selectedEventForPopup && (
            <div className="flex-1 overflow-auto">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Image with Bounding Boxes */}
                <div className="space-y-2">
                  <Label>Detection Image</Label>
                  <div className="relative bg-muted rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                    <img
                      src={selectedEventForPopup.imagePath}
                      alt={selectedEventForPopup.detectionType}
                      className="w-full h-auto"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                    {/* Main detection bounding box */}
                    {selectedEventForPopup.boundingBox && (
                      <div
                        className="absolute border-2 border-red-500 bg-red-500/10"
                        style={{
                          left: `${selectedEventForPopup.boundingBox.x}px`,
                          top: `${selectedEventForPopup.boundingBox.y}px`,
                          width: `${selectedEventForPopup.boundingBox.width}px`,
                          height: `${selectedEventForPopup.boundingBox.height}px`
                        }}
                      >
                        <span className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                          {selectedEventForPopup.detectionType}: {selectedEventForPopup.confidence >= 1 ? Math.round(selectedEventForPopup.confidence) + '%' : Math.round(selectedEventForPopup.confidence * 100) + '%'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Metadata */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Basic Information</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>ID:</span>
                        <span className="font-mono truncate ml-2">{selectedEventForPopup.id}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Type:</span>
                        <Badge className={getDetectionTypeColor(selectedEventForPopup.detectionType)}>
                          {getDetectionTypeIcon(selectedEventForPopup.detectionType)}
                          <span className="ml-1">{selectedEventForPopup.detectionType}</span>
                        </Badge>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Confidence:</span>
                        <span className="font-medium">
                          {selectedEventForPopup.confidence >= 1 ? Math.round(selectedEventForPopup.confidence) + '%' : Math.round(selectedEventForPopup.confidence * 100) + '%'}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded">
                        <span>Camera:</span>
                        <span>{selectedEventForPopup.cameraName || selectedEventForPopup.cameraId}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted rounded col-span-2">
                        <span>Timestamp:</span>
                        <span>{new Date(selectedEventForPopup.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedEventForPopup.personName && (
                    <div>
                      <Label className="text-muted-foreground">Face Recognition</Label>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded mt-1">
                        {selectedEventForPopup.isKnown ? (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <UserX className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="font-medium">{selectedEventForPopup.personName}</span>
                        <Badge variant={selectedEventForPopup.isKnown ? 'default' : 'secondary'}>
                          {selectedEventForPopup.isKnown ? 'Known' : 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {/* Bounding Box Details */}
                  {selectedEventForPopup.boundingBox && (
                    <div>
                      <Label className="text-muted-foreground">Bounding Box</Label>
                      <div className="grid grid-cols-4 gap-2 mt-1 text-sm">
                        <div className="p-2 bg-muted rounded text-center">
                          <div className="text-xs text-muted-foreground">X</div>
                          <div className="font-mono">{selectedEventForPopup.boundingBox.x}</div>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <div className="text-xs text-muted-foreground">Y</div>
                          <div className="font-mono">{selectedEventForPopup.boundingBox.y}</div>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <div className="text-xs text-muted-foreground">Width</div>
                          <div className="font-mono">{selectedEventForPopup.boundingBox.width}</div>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <div className="text-xs text-muted-foreground">Height</div>
                          <div className="font-mono">{selectedEventForPopup.boundingBox.height}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* All Metadata */}
                  {selectedEventForPopup.metadata && Object.keys(selectedEventForPopup.metadata).length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Additional Metadata</Label>
                      <div className="mt-1 p-3 bg-muted rounded max-h-40 overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(selectedEventForPopup.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenCV;