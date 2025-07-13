import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Play,
  Square,
  Download,
  RefreshCw,
  Users,
  Image,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  Calendar,
  Eye,
  FolderOpen,
  FileText
} from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import apiService from '@/services/ApiService';

interface BatchDetectionStatus {
  isProcessing: boolean;
  jobId: string | null;
}

interface BatchProgress {
  jobId: string;
  current: number;
  total: number;
  currentFile: string;
  percentage: number;
}

interface BatchResult {
  totalImages: number;
  processedImages: number;
  personsDetected: number;
  imagesWithPersons: number;
  errors: number;
  processingTime: number;
}

interface BatchResultFile {
  filename: string;
  timestamp: string;
  size: number;
}

const BatchPersonDetection = () => {
  const { toast } = useToast();
  const { socket } = useSocketContext();
  
  const [status, setStatus] = useState<BatchDetectionStatus>({ isProcessing: false, jobId: null });
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);
  const [resultFiles, setResultFiles] = useState<BatchResultFile[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  
  // Configuration state
  const [timeFilter, setTimeFilter] = useState<'all' | 'hour' | 'day' | 'week' | 'month'>('day');
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [maxDetections, setMaxDetections] = useState(10);
  const [saveDetectedPersons, setSaveDetectedPersons] = useState(true);
  const [cropPersonImages, setCropPersonImages] = useState(true);
  const [includeSubdirectories, setIncludeSubdirectories] = useState(false);
  const [saveAnnotatedImages, setSaveAnnotatedImages] = useState(false);
  const [outputResults, setOutputResults] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleBatchStarted = (data: any) => {
      console.log('Batch detection started:', data);
      setStatus({ isProcessing: true, jobId: data.jobId });
      setProgress(null);
      toast({
        title: "Batch Detection Started",
        description: "Processing all snapshots for person detection...",
      });
    };

    const handleBatchProgress = (data: BatchProgress) => {
      console.log('Batch progress:', data);
      setProgress(data);
    };

    const handleBatchCompleted = (data: { jobId: string; result: BatchResult }) => {
      console.log('Batch detection completed:', data);
      setStatus({ isProcessing: false, jobId: null });
      setProgress(null);
      setLastResult(data.result);
      
      toast({
        title: "Batch Detection Completed",
        description: `Processed ${data.result.processedImages} images, found ${data.result.personsDetected} persons in ${data.result.imagesWithPersons} images.`,
      });

      // Refresh result files list
      loadResultFiles();
    };

    const handleBatchError = (data: { jobId: string; error: string }) => {
      console.error('Batch detection error:', data);
      setStatus({ isProcessing: false, jobId: null });
      setProgress(null);
      
      toast({
        title: "Batch Detection Failed",
        description: data.error,
        variant: "destructive",
      });
    };

    const handleBatchCancelled = (data: { message: string }) => {
      console.log('Batch detection cancelled:', data);
      setStatus({ isProcessing: false, jobId: null });
      setProgress(null);
      
      toast({
        title: "Batch Detection Cancelled",
        description: data.message,
        variant: "destructive",
      });
    };

    socket.on('batchDetectionStarted', handleBatchStarted);
    socket.on('batchDetectionProgress', handleBatchProgress);
    socket.on('batchDetectionCompleted', handleBatchCompleted);
    socket.on('batchDetectionError', handleBatchError);
    socket.on('batchDetectionCancelled', handleBatchCancelled);

    return () => {
      socket.off('batchDetectionStarted', handleBatchStarted);
      socket.off('batchDetectionProgress', handleBatchProgress);
      socket.off('batchDetectionCompleted', handleBatchCompleted);
      socket.off('batchDetectionError', handleBatchError);
      socket.off('batchDetectionCancelled', handleBatchCancelled);
    };
  }, [socket, toast]);

  // Load initial status and result files
  useEffect(() => {
    loadStatus();
    loadResultFiles();
  }, []);

  const loadStatus = async () => {
    try {
      const status = await apiService.getBatchPersonDetectionStatus();
      setStatus(status);
    } catch (error) {
      console.error('Error loading batch status:', error);
      toast({
        title: "Error",
        description: "Failed to load batch status",
        variant: "destructive",
      });
    }
  };

  const loadResultFiles = async () => {
    setIsLoadingResults(true);
    try {
      const results = await apiService.getBatchDetectionResults();
      setResultFiles(results);
    } catch (error) {
      console.error('Error loading result files:', error);
      toast({
        title: "Error",
        description: "Failed to load result files",
        variant: "destructive",
      });
    } finally {
      setIsLoadingResults(false);
    }
  };

  const startBatchDetection = async () => {
    try {
      const options = {
        minConfidence,
        maxDetections,
        timeFilter,
        saveDetectedPersons,
        cropPersonImages: saveDetectedPersons && cropPersonImages,
        outputResults,
        includeSubdirectories,
        saveAnnotatedImages,
      };

      const { jobId } = await apiService.startBatchPersonDetection(options);
      
      setStatus({ isProcessing: true, jobId });
      toast({
        title: "Batch Detection Started",
        description: "Processing snapshots in the background...",
      });
    } catch (error) {
      console.error('Error starting batch detection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start batch detection",
        variant: "destructive",
      });
    }
  };

  const cancelBatchDetection = async () => {
    try {
      await apiService.cancelBatchPersonDetection();
      
      setStatus({ isProcessing: false, jobId: null });
      setProgress(null);
      toast({
        title: "Batch Detection Cancelled",
        description: "Processing has been stopped",
      });
    } catch (error) {
      console.error('Error cancelling batch detection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel batch detection",
        variant: "destructive",
      });
    }
  };

  const downloadResult = async (filename: string) => {
    try {
      const result = await apiService.getBatchDetectionResult(filename);
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${filename}...`,
      });
    } catch (error) {
      console.error('Error downloading result:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download result file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Batch Person Detection
        </CardTitle>
        <CardDescription>
          Analyze all saved snapshots for person detection. This process runs once and doesn't affect live streaming.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Detection Options</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {showAdvancedOptions ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeFilter">Time Range</Label>
              <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All snapshots</SelectItem>
                  <SelectItem value="hour">Past hour</SelectItem>
                  <SelectItem value="day">Past 24 hours</SelectItem>
                  <SelectItem value="week">Past week</SelectItem>
                  <SelectItem value="month">Past month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="confidence">Min Confidence: {Math.round(minConfidence * 100)}%</Label>
              <Slider
                value={[minConfidence]}
                onValueChange={(value) => setMinConfidence(value[0])}
                max={1}
                min={0.1}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="maxDetections">Max Detections per Image: {maxDetections}</Label>
              <Slider
                value={[maxDetections]}
                onValueChange={(value) => setMaxDetections(value[0])}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>20</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Save Person Images</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={saveDetectedPersons}
                  onCheckedChange={setSaveDetectedPersons}
                />
                <span className="text-sm text-muted-foreground">
                  {saveDetectedPersons ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Crop Person Images</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={cropPersonImages}
                  onCheckedChange={setCropPersonImages}
                  disabled={!saveDetectedPersons}
                />
                <span className="text-sm text-muted-foreground">
                  {cropPersonImages && saveDetectedPersons ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {showAdvancedOptions && (
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Include Subdirectories</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={includeSubdirectories}
                      onCheckedChange={setIncludeSubdirectories}
                    />
                    <span className="text-sm text-muted-foreground">
                      {includeSubdirectories ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Process images in subdirectories
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Save Annotated Images</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={saveAnnotatedImages}
                      onCheckedChange={setSaveAnnotatedImages}
                    />
                    <span className="text-sm text-muted-foreground">
                      {saveAnnotatedImages ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Save images with detection boxes drawn
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t">
                <div className="text-sm">
                  <span className="font-medium">Max Detections:</span> {maxDetections} per image
                </div>
                <div className="text-sm">
                  <span className="font-medium">Output Format:</span> {outputResults ? 'JSON + CSV' : 'None'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Image Cropping:</span> {saveDetectedPersons && cropPersonImages ? 'Enabled' : 'Disabled'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Subdirectories:</span> {includeSubdirectories ? 'Included' : 'Excluded'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Annotations:</span> {saveAnnotatedImages ? 'Enabled' : 'Disabled'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Metadata:</span> Always saved
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Control Section */}
        <div className="flex items-center gap-4">
          {!status.isProcessing ? (
            <Button onClick={startBatchDetection} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Start Batch Detection
            </Button>
          ) : (
            <Button onClick={cancelBatchDetection} variant="destructive" className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              Cancel Processing
            </Button>
          )}
          
          <Button onClick={loadResultFiles} variant="outline" size="sm" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Results
          </Button>
        </div>

        {/* Progress Section */}
        {status.isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Processing snapshots...</span>
              {status.jobId && (
                <Badge variant="outline" className="text-xs">
                  Job: {status.jobId.slice(-8)}
                </Badge>
              )}
            </div>
            
            {progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress: {progress.current} / {progress.total}</span>
                  <span>{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Currently processing: {progress.currentFile}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Last Result Section */}
        {lastResult && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Last Detection Results
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{lastResult.totalImages}</div>
                <div className="text-xs text-muted-foreground">Total Images</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{lastResult.imagesWithPersons}</div>
                <div className="text-xs text-muted-foreground">With Persons</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{lastResult.personsDetected}</div>
                <div className="text-xs text-muted-foreground">Total Persons</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{formatDuration(lastResult.processingTime)}</div>
                <div className="text-xs text-muted-foreground">Processing Time</div>
              </div>
            </div>
            {lastResult.errors > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                {lastResult.errors} errors occurred during processing
              </div>
            )}
          </div>
        )}

        {/* Results History Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Detection Results History
            </h4>
            {isLoadingResults && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          
          {resultFiles.length > 0 ? (
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {resultFiles.map((file) => (
                  <div key={file.filename} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(file.timestamp).toLocaleString()} • {formatFileSize(file.size)}
                      </div>
                    </div>
                    <Button
                      onClick={() => downloadResult(file.filename)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No detection results available</p>
              <p className="text-xs">Run batch detection to generate results</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BatchPersonDetection;