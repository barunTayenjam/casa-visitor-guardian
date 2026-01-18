import React, { useState, useCallback } from 'react';
import { useReviewSegments, useAcknowledgeSegment, useActiveObjects } from '../hooks/useReview';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Clock, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface ReviewPageProps {
  camera?: string;
}

export function ReviewPage({ camera: initialCamera }: ReviewPageProps) {
  const [camera, setCamera] = useState<string | undefined>(initialCamera);
  const [severity, setSeverity] = useState<'all' | 'alert' | 'detection'>('all');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const { data, isLoading, error, refetch } = useReviewSegments({
    camera,
    severity: severity === 'all' ? undefined : severity,
    limit,
  });

  const { mutate: acknowledge } = useAcknowledgeSegment();

  const handleAcknowledge = useCallback((segmentId: string) => {
    acknowledge(segmentId);
  }, [acknowledge]);

  const alertCount = data?.segments.filter(s => s.severity === 'alert').length ?? 0;
  const detectionCount = data?.segments.filter(s => s.severity === 'detection').length ?? 0;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load review segments. Please try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Review</h1>
        <div className="flex items-center gap-4">
          <Select value={camera || 'all'} onValueChange={(v) => setCamera(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({data?.total ?? 0})</SelectItem>
              <SelectItem value="alert">Alerts ({alertCount})</SelectItem>
              <SelectItem value="detection">Detections ({detectionCount})</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{alertCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Detections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{detectionCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList>
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data?.segments.map((segment) => (
                <ReviewSegmentCard
                  key={segment.id}
                  segment={segment}
                  isSelected={selectedSegment === segment.id}
                  onSelect={() => setSelectedSegment(segment.id)}
                  onAcknowledge={() => handleAcknowledge(segment.id)}
                />
              ))}
            </div>
          )}
          {data?.segments.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              No review segments found for the selected filters.
            </div>
          )}
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineView camera={camera} />
        </TabsContent>
      </Tabs>

      {data?.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit(l => l + 50)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

interface ReviewSegmentCardProps {
  segment: {
    id: string;
    camera: string;
    start_time: string;
    end_time: string;
    severity: 'alert' | 'detection';
    labels: string[];
    thumbnail_path: string | null;
    reviewed?: boolean;
  };
  isSelected: boolean;
  onSelect: () => void;
  onAcknowledge: () => void;
}

function ReviewSegmentCard({ segment, isSelected, onSelect, onAcknowledge }: ReviewSegmentCardProps) {
  const thumbnailUrl = segment.thumbnail_path
    ? `/api/review/${segment.id}/thumbnail.jpg`
    : '/placeholder.svg';

  const startTime = new Date(segment.start_time);
  const endTime = new Date(segment.end_time);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        segment.severity === 'alert' && 'border-red-500',
        isSelected && 'ring-2 ring-primary',
        segment.reviewed && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="relative aspect-video bg-muted">
        <img
          src={thumbnailUrl}
          alt={`Review segment from ${segment.camera}`}
          className="w-full h-full object-cover rounded-t-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            variant={segment.severity === 'alert' ? 'destructive' : 'default'}
            className="flex items-center gap-1"
          >
            {segment.severity === 'alert' ? <AlertTriangle className="w-3 h-3" /> : null}
            {segment.severity}
          </Badge>
        </div>
        {segment.reviewed && (
          <div className="absolute top-2 right-2">
            <Check className="w-4 h-4 text-green-500" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white bg-black/50 rounded px-2 py-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(startTime, 'HH:mm:ss')}
          </span>
          <span>{duration}s</span>
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{segment.camera}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(startTime, { addSuffix: true })}
            </p>
          </div>
          <div className="flex gap-1">
            {segment.labels.slice(0, 3).map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        </div>
        {!segment.reviewed && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
          >
            <Check className="w-4 h-4 mr-1" />
            Mark Reviewed
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface TimelineViewProps {
  camera?: string;
}

function TimelineView({ camera }: TimelineViewProps) {
  const { data: activeObjects } = useActiveObjects(camera || 'all');
  const [zoom, setZoom] = useState(1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Activity Timeline</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              >
                -
              </Button>
              <span className="text-sm">{Math.round(zoom * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              >
                +
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-32 bg-muted rounded-lg overflow-hidden">
            <div
              className="absolute inset-0 flex items-center"
              style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
            >
              {activeObjects?.objects.map((obj) => (
                <div
                  key={obj.id}
                  className="absolute h-8 rounded text-xs text-white px-2 py-1 whitespace-nowrap"
                  style={{
                    left: `${Math.random() * 80 + 10}%`,
                    backgroundColor: getLabelColor(obj.label),
                  }}
                >
                  {obj.label}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {activeObjects?.count ?? 0} active objects
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function getLabelColor(label: string): string {
  const colors: Record<string, string> = {
    person: '#ef4444',
    car: '#3b82f6',
    dog: '#22c55e',
    cat: '#f59e0b',
    package: '#8b5cf6',
  };
  return colors[label] || '#6b7280';
}

export default ReviewPage;
