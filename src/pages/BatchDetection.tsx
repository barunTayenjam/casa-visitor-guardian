import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import apiService, { ApiError } from '@/services/ApiService';

interface BatchDetectionResult {
  eventId: string;
  imageId: string;
  timestamp: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faceDetections: Array<{
    id: string;
    name: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  success: boolean;
  error?: string;
}

interface BatchProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentImage?: string;
  percentage: number;
}

interface BatchSummary {
  totalEvents: number;
  personsDetected: number;
  facesDetected: number;
  vehiclesDetected: number;
  motionEvents: number;
  averageProcessingTime: number;
  processingErrors: number;
}

export function BatchDetection() {
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchId, setBatchId] = useState<string>('');
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchDetectionResult[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [todayEventCount, setTodayEventCount] = useState<number>(0);

  useEffect(() => {
    fetchTodayEventsCount();
  }, []);

  const fetchTodayEventsCount = async () => {
    try {
      const response = await apiService.get('/detection/today-events');
      const count = (response.data as any)?.events || (response.data as any)?.count || 0;
      setTodayEventCount(count);
    } catch (error) {
      console.error('Failed to fetch today events count:', error);
    }
  };

  const handleDateRangeChange = (value: string) => {
    setSelectedDate(value);
    if (value === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setStartDate(today.toISOString());
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setEndDate(tomorrow.toISOString());
    } else if (value === 'week') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setStartDate(weekAgo.toISOString());
      setEndDate(today.toISOString());
    } else if (value === 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const startBatchDetection = async () => {
    try {
      setIsProcessing(true);
      setResults([]);
      setSummary(null);
      setProgress(null);

      let requestBody: any = { limit };
      
      if (selectedDate === 'custom' && startDate) {
        requestBody.startDate = startDate;
      }
      if (selectedDate === 'custom' && endDate) {
        requestBody.endDate = endDate;
      } else if (selectedDate === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        requestBody.startDate = today.toISOString();
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        requestBody.endDate = tomorrow.toISOString();
      } else if (selectedDate === 'week') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        requestBody.startDate = weekAgo.toISOString();
        requestBody.endDate = today.toISOString();
      }

      const response = await apiService.post('/detection/batch-process', requestBody);
      
      if (response.data.success) {
        setBatchId(response.data.batchId);
        setProgress(response.data.progress);
        setSummary(response.data.summary);
        setResults(response.data.results || []);
        
        // Poll for progress updates
        if (response.data.batchId) {
          startProgressPolling(response.data.batchId);
        }
      }
    } catch (error: any) {
      console.error('Batch detection failed:', error);
      setIsProcessing(false);
    }
  };

  const startProgressPolling = (currentBatchId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.get(`/detection/batch-progress/${currentBatchId}`);
        
        if (response.data.progress) {
          setProgress(response.data.progress);
          
          if (response.data.progress.percentage === 100) {
            clearInterval(pollInterval);
            setIsProcessing(false);
          }
        } else {
          clearInterval(pollInterval);
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Progress polling error:', error);
        clearInterval(pollInterval);
        setIsProcessing(false);
      }
    }, 2000);
  };

  const getDetectionColor = (className: string): string => {
    switch (className) {
      case 'person': return 'bg-green-500';
      case 'vehicle': return 'bg-blue-500';
      case 'motion': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getFaceDetectionColor = (isKnown: boolean): string => {
    return isKnown ? 'bg-purple-500' : 'bg-orange-500';
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const renderDetectionBox = (detection: any, index: number) => (
    <div
      key={index}
      className={`absolute border-2 ${getDetectionColor(detection.class)} rounded`}
      style={{
        left: `${detection.bbox.x}px`,
        top: `${detection.bbox.y}px`,
        width: `${detection.bbox.width}px`,
        height: `${detection.bbox.height}px`
      }}
    >
      <div className="absolute -top-6 left-0 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
        {detection.class.toUpperCase()} {(detection.confidence * 100).toFixed(0)}%
      </div>
    </div>
  );

  const renderFaceDetectionBox = (face: any, index: number) => (
    <div
      key={`face-${index}`}
      className={`absolute border-2 ${getFaceDetectionColor(face.name !== 'Unknown')} rounded border-pink-500`}
      style={{
        left: `${face.bbox.x}px`,
        top: `${face.bbox.y}px`,
        width: `${face.bbox.width}px`,
        height: `${face.bbox.height}px`
      }}
    >
      <div className="absolute -top-6 left-0 bg-pink-600 bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
        👤 {face.name}
      </div>
      <div className="absolute -bottom-6 right-0 bg-purple-600 bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
        {(face.confidence * 100).toFixed(0)}%
      </div>
    </div>
  );

  const renderEventImage = (event: BatchDetectionResult) => {
    const imagePath = event.imageId 
      ? `/api/events/image/${event.imageId}`
      : `/data/events/${event.eventId}.jpg`;

    return (
      <div className="relative group" onClick={() => setSelectedEventId(event.eventId)}>
        <img
          src={imagePath}
          alt={`Event ${event.eventId}`}
          className="w-full h-auto cursor-pointer rounded-lg border border-gray-300 hover:border-blue-500 transition-colors"
          style={{ maxHeight: '400px' }}
        />
        
        {event.success && event.detections && event.detections.map((d, i) => renderDetectionBox(d, i))}
        {event.success && event.faceDetections && event.faceDetections.map((f, i) => renderFaceDetectionBox(f, i))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>🔍 Batch Detection</CardTitle>
            <CardDescription>
              Run OpenCV detection on multiple events at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Selection */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={selectedDate} onValueChange={handleDateRangeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today ({todayEventCount} events)</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedDate === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Event Limit */}
            <div className="space-y-2">
              <Label>Max Events</Label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
              />
              <p className="text-xs text-gray-500">
                Limit the number of events to process (default: 100)
              </p>
            </div>

            {/* Start Button */}
            <Button
              onClick={startBatchDetection}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? '🔄 Processing...' : '🚀 Start Batch Detection'}
            </Button>

            {/* Progress */}
            {isProcessing && progress && (
              <div className="space-y-2">
                <Progress value={progress.percentage || 0} className="w-full" />
                <div className="text-sm text-gray-600">
                  Processing: {progress.processed} / {progress.total} ({progress.percentage || 0}%)
                </div>
                {progress.currentImage && (
                  <div className="text-xs text-gray-500">
                    Current: {progress.currentImage}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Panel */}
        {summary && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>📊 Detection Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.totalEvents}
                  </div>
                  <div className="text-sm text-gray-600">Total Events</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {summary.personsDetected}
                  </div>
                  <div className="text-sm text-gray-600">Persons</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {summary.facesDetected}
                  </div>
                  <div className="text-sm text-gray-600">Faces</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.vehiclesDetected}
                  </div>
                  <div className="text-sm text-gray-600">Vehicles</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {summary.motionEvents}
                  </div>
                  <div className="text-sm text-gray-600">Motion</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {summary.averageProcessingTime}ms
                  </div>
                  <div className="text-sm text-gray-600">Avg Time</div>
                </div>
              </div>
              {summary.processingErrors > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {summary.processingErrors} processing errors occurred
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Legend */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>🏷️ Detection Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">Person</Badge>
              <span className="text-sm text-gray-600">Human detected</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500">Known Face</Badge>
              <span className="text-sm text-gray-600">Recognized person</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500">Unknown Face</Badge>
              <span className="text-sm text-gray-600">Unrecognized person</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500">Vehicle</Badge>
              <span className="text-sm text-gray-600">Car/vehicle detected</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500">Motion</Badge>
              <span className="text-sm text-gray-600">Movement detected</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detection Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📷 Detection Results ({results.length})</CardTitle>
            <CardDescription>
              Click on images to see detailed detection boxes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((event, index) => (
                <div key={event.eventId} className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    #{index + 1} - {formatTimestamp(event.timestamp)}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {event.detections && event.detections.map((d, i) => (
                      <Badge key={`det-${i}`} className={getDetectionColor(d.class)}>
                        {d.class} {(d.confidence * 100).toFixed(0)}%
                      </Badge>
                    ))}
                    {event.faceDetections && event.faceDetections.map((f, i) => (
                      <Badge key={`face-${i}`} className={getFaceDetectionColor(f.name !== 'Unknown')}>
                        👤 {f.name}
                      </Badge>
                    ))}
                  </div>
                  
                  {renderEventImage(event)}
                  
                  {event.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{event.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length === 0 && !isProcessing && summary && (
        <Alert>
          <AlertDescription>
            No events found for the selected date range
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default BatchDetection;