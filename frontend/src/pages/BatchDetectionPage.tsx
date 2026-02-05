import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/ApiService';
import { Calendar } from '../components/ui/calendar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Calendar as CalendarIcon, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Download,
  Image as ImageIcon,
  List,
  Clock
} from 'lucide-react';

interface BatchResult {
  filename: string;
  timestamp: string;
  cameraId: string;
  persons: Array<{
    class: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  faces: Array<{
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    personId?: string;
    personName?: string;
    isKnown?: boolean;
  }>;
}

interface ObjectStats {
  [key: string]: number;
}

export default function BatchDetectionPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availableImages, setAvailableImages] = useState<number>(0);
  const [loadingImages, setLoadingImages] = useState(false);
  
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [polling, setPolling] = useState(false);
  
  const [results, setResults] = useState<BatchResult[]>([]);
  const [objectStats, setObjectStats] = useState<ObjectStats>({});
  
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0
  });
  
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [historicalJobs, setHistoricalJobs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Load historical batch jobs on mount
  useEffect(() => {
    loadHistoricalJobs();
  }, []);

  // Load available images for selected date
  useEffect(() => {
    if (selectedDate) {
      loadAvailableImages();
    }
  }, [selectedDate]);

  // Poll job status when processing
  useEffect(() => {
    if (processing && batchJobId) {
      setPolling(true);
      const interval = setInterval(() => {
        checkJobStatus(batchJobId);
      }, 3000);
      
      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }
  }, [processing, batchJobId]);

  const loadHistoricalJobs = async () => {
    try {
      const response = await fetch('/api/batch/jobs');
      const data = await response.json();
      if (data.success) {
        const completedJobs = data.jobs
          .filter((job: any) => job.status === 'completed')
          .sort((a: any, b: any) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())
          .slice(0, 10);
        setHistoricalJobs(completedJobs);
      }
    } catch (err) {
      console.error('Error loading historical jobs:', err);
    }
  };

  const loadAvailableImages = async () => {
    if (!selectedDate) return;
    
    setLoadingImages(true);
    setError(null);
    
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimeStr = startOfDay.toISOString();
      const endTimeStr = endOfDay.toISOString();
      
      console.log('[BatchDetection] Loading events for', startTimeStr, 'to', endTimeStr);
      
      // Try direct fetch to debug
      const directFetch = await fetch(`/api/batch/events/available?startTime=${encodeURIComponent(startTimeStr)}&endTime=${encodeURIComponent(endTimeStr)}`);
      const directData = await directFetch.json();
      console.log('[BatchDetection] Direct fetch result:', directData);
      
      const events = await apiService.getBatchAvailableEvents({
        startTime: startTimeStr,
        endTime: endTimeStr
      });
      
      console.log('[BatchDetection] API service returned', events.length, 'events');
      setAvailableImages(events.length);
    } catch (err) {
      console.error('[BatchDetection] Error loading images:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load images';
      setError(`Failed to load events: ${errorMsg}`);
      setAvailableImages(0);
    } finally {
      setLoadingImages(false);
    }
  };

  const startBatchDetection = async () => {
    if (!selectedDate || availableImages === 0) {
      setError('No images available for selected date');
      return;
    }
    
    setProcessing(true);
    setError(null);
    setResults([]);
    setObjectStats({});
    setProgress({ total: availableImages, processed: 0, successful: 0, failed: 0 });
    setStatus('queued');
    
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('[BatchDetection] Starting batch detection');
      
      const jobId = await apiService.startBatchProcessing({
        timeRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString()
        },
        detectionTypes: ['both'],
        confidenceThreshold: 30,
        saveResults: true,
        outputFormat: 'json'
      });
      
      console.log('[BatchDetection] Job started:', jobId);
      setBatchJobId(jobId);
      setStatus('running');
    } catch (err) {
      console.error('[BatchDetection] Error starting batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to start batch detection');
      setProcessing(false);
      setStatus('failed');
    }
  };

  const checkJobStatus = async (jobId: string) => {
    try {
      console.log('[BatchDetection] Checking job status:', jobId);
      
      // The API returns { success: true, job: {...} }
      const jobResults: any = await apiService.getBatchResults(jobId);
      
      if (!jobResults || !jobResults.job) {
        console.error('[BatchDetection] Invalid response:', jobResults);
        return;
      }
      
      const job = jobResults.job;
      const jobStatus = job.status || 'running';
      setStatus(jobStatus);
      
      console.log('[BatchDetection] Job status:', jobStatus, 'Progress:', job.progress);
      
      if (job.results?.details) {
        const details = job.results.details;
        setResults(details);
        
        const successful = details.filter((r: any) => 
          r.persons.length > 0 || r.faces.length > 0
        ).length;
        
        setProgress({
          total: job.results.totalImages || details.length,
          processed: details.length,
          successful,
          failed: details.length - successful
        });
        
        // Calculate object statistics
        const stats: ObjectStats = {};
        details.forEach((result: any) => {
          result.persons.forEach((p: any) => {
            const objClass = p.class || 'unknown';
            stats[objClass] = (stats[objClass] || 0) + 1;
          });
        });
        
        console.log('[BatchDetection] Object stats:', stats);
        setObjectStats(stats);
      }
      
      if (jobStatus === 'completed' || jobStatus === 'failed') {
        console.log('[BatchDetection] Job completed with status:', jobStatus);
        setProcessing(false);
        setPolling(false);
        
        if (jobStatus === 'completed') {
          console.log('[BatchDetection] Navigating to results page');
          navigate(`/app/batch-results/${jobId}`);
        }
      }
    } catch (err) {
      console.error('[BatchDetection] Error checking job status:', err);
    }
  };

  const downloadResults = () => {
    if (!batchJobId) return;
    window.open(`/api/batch/jobs/${batchJobId}/download`, '_blank');
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'queued':
        return <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const calculateProgress = () => {
    if (progress.total === 0) return 0;
    return (progress.processed / progress.total) * 100;
  };

  const sortedObjects = Object.entries(objectStats).sort((a, b) => b[1] - a[1]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Detection</h1>
          <p className="text-muted-foreground mt-1">
            Run AI detection on all images from a specific date
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/app/streams')}>
          Back to Streams
        </Button>
      </div>

      {/* Historical Jobs Section */}
      {historicalJobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                Recent Batch Jobs
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? 'Hide' : 'Show'} History
              </Button>
            </div>
            <CardDescription>
              View and manage previous batch detection runs
            </CardDescription>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="space-y-3">
                {historicalJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition cursor-pointer"
                    onClick={() => navigate(`/app/batch-results/${job.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                          {job.status}
                        </Badge>
                        <span className="text-sm font-mono text-muted-foreground">
                          {job.id?.split('_')[1]?.substring(0, 8) || job.id}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {job.startTime && new Date(job.startTime).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{job.progress?.total || 0} images</span>
                        <span className="text-green-600">
                          {job.progress?.successful || 0} with detections
                        </span>
                        <span className="text-muted-foreground">
                          {job.progress?.failed || 0} without detections
                        </span>
                        {job.results?.processingTime && (
                          <span className="text-muted-foreground">
                            {Math.round(job.results.processingTime / 1000)}s
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View Results →
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Date Selection & Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Select Date
            </CardTitle>
            <CardDescription>
              Choose a date to run detection on all captured images
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              disabled={(date) => date > new Date()}
            />
            
            {selectedDate && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Selected: {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                
                {loadingImages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading available images...
                  </div>
                ) : availableImages > 0 ? (
                  <div className="text-sm">
                    <span className="font-medium">{availableImages}</span> images available
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No images found for this date
                  </div>
                )}
              </div>
            )}
            
            <Button
              onClick={startBatchDetection}
              disabled={processing || availableImages === 0 || !selectedDate}
              className="w-full"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Detection
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Panel: Progress & Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          {status !== 'idle' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {getStatusIcon()}
                    Job Status
                  </span>
                  <Badge variant={
                    status === 'completed' ? 'default' :
                    status === 'failed' ? 'destructive' :
                    status === 'running' ? 'default' :
                    'secondary'
                  }>
                    {status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>
                      {progress.processed} / {progress.total}
                    </span>
                  </div>
                  <Progress value={calculateProgress()} />
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      {progress.successful}
                    </div>
                    <div className="text-sm text-muted-foreground">With Objects</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-500">
                      {progress.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Empty</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {Math.round(calculateProgress())}%
                    </div>
                    <div className="text-sm text-muted-foreground">Complete</div>
                  </div>
                </div>
                
                {batchJobId && (
                  <div className="text-xs text-center text-muted-foreground font-mono">
                    Job ID: {batchJobId}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Statistics Card */}
          {Object.keys(objectStats).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detection Statistics</CardTitle>
                <CardDescription>
                  {Object.keys(objectStats).length} different object types detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {sortedObjects.map(([objClass, count]) => (
                      <div key={objClass} className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize mt-1">
                          {objClass}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Detection Results ({results.length} images)</CardTitle>
                  <Button onClick={downloadResults} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((result, idx) => (
                      <DetectionCard key={idx} result={result} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetectionCard({ result }: { result: BatchResult }) {
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = `/api/events/image/${result.filename}`;
  const objectCount = result.persons.length + result.faces.length;
  
  // Group objects by class
  const objectsByClass: { [key: string]: number } = {};
  result.persons.forEach(p => {
    objectsByClass[p.class] = (objectsByClass[p.class] || 0) + 1;
  });
  
  return (
    <Card className={objectCount === 0 ? 'opacity-50' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
          {!imageError ? (
            <img
              src={imageUrl}
              alt={result.filename}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mb-2" />
              <span>Image not available</span>
            </div>
          )}
          
          {result.cameraId && (
            <Badge className="absolute top-2 left-2">
              {result.cameraId}
            </Badge>
          )}
          
          {objectCount > 0 && (
            <Badge className="absolute top-2 right-2 bg-green-500">
              {objectCount} objects
            </Badge>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium truncate" title={result.filename}>
            {result.filename}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>
        
        {Object.keys(objectsByClass).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(objectsByClass).map(([cls, count]) => (
              <Badge key={cls} variant="secondary" className="text-xs">
                {cls}: {count}
              </Badge>
            ))}
          </div>
        )}
        
        {objectCount === 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">
            No detections
          </div>
        )}
      </CardContent>
    </Card>
  );
}