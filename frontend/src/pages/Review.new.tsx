import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewSegments, useAcknowledgeSegment, useActiveObjects } from '../hooks/useReview';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Clock, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';

interface ReviewPageProps {
  camera?: string;
}

export function ReviewPage({ camera: initialCamera }: ReviewPageProps) {
  const navigate = useNavigate();
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

  const headerActions = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <Select value={camera || 'all'} onValueChange={(v) => setCamera(v === 'all' ? undefined : v)}>
        <SelectTrigger className="w-full sm:w-[160px] h-11 min-h-[44px]">
          <SelectValue placeholder="Camera" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cameras</SelectItem>
        </SelectContent>
      </Select>
      <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
        <SelectTrigger className="w-full sm:w-[140px] h-11 min-h-[44px]">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({data?.total ?? 0})</SelectItem>
          <SelectItem value="alert">Alerts ({alertCount})</SelectItem>
          <SelectItem value="detection">Detections ({detectionCount})</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={() => refetch()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load review segments. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Review</h1>
            <p className="text-sm text-muted-foreground">Review and confirm detection events</p>
          </div>
          {headerActions}
        </div>
      </div>

      <div className="px-4 md:px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={Video}
            iconColor="text-blue-500"
            label="Total Segments"
            value={data?.total ?? 0}
          />
          <StatCard
            icon={AlertTriangle}
            iconColor="text-red-500"
            label="Alerts"
            value={alertCount}
          />
          <StatCard
            icon={Check}
            iconColor="text-emerald-500"
            label="Detections"
            value={detectionCount}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[200px] rounded-xl" />
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
              <EmptyState
                icon={Video}
                title="No review segments found"
                description="Try adjusting the filters"
              />
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TimelineView camera={camera} />
          </TabsContent>
        </Tabs>

        {data?.hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setLimit(l => l + 50)} className="gap-2">
              Load More
            </Button>
          </div>
        )}
      </div>
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
        'cursor-pointer transition-all hover:shadow-md rounded-xl overflow-hidden',
        isSelected && 'ring-2 ring-blue-500',
        segment.reviewed && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="relative aspect-video bg-muted">
        <img
          src={thumbnailUrl}
          alt={`Review segment from ${segment.camera}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge
            className={cn(
              "flex items-center gap-1 border-0",
              segment.severity === 'alert'
                ? "bg-red-500/15 text-red-500"
                : "bg-emerald-500/15 text-emerald-500"
            )}
          >
            {segment.severity === 'alert' && <AlertTriangle className="w-3 h-3" />}
            {segment.severity}
          </Badge>
        </div>
        {segment.reviewed && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/20">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white rounded px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(startTime, 'HH:mm:ss')}
          </span>
          <span>{duration}s</span>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-medium text-sm text-foreground">{segment.camera}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(startTime, { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {segment.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
        {!segment.reviewed && (
          <Button
            size="default"
            variant="outline"
            className="w-full h-11 min-h-[44px] gap-1 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
          >
            <Check className="w-4 h-4" />
            Mark Reviewed
          </Button>
        )}
      </div>
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
    <Card className="rounded-xl">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Activity Timeline</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            >
              -
            </Button>
            <span className="text-sm w-12 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            >
              +
            </Button>
          </div>
        </div>

        <div className="relative h-32 rounded-lg overflow-hidden bg-muted">
          <div
            className="absolute inset-0 flex items-center"
            style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
          >
            {activeObjects?.objects.map((obj) => (
              <div
                key={obj.id}
                className="absolute h-8 rounded text-xs text-white px-2 py-1 whitespace-nowrap shadow-sm"
                style={{
                  left: `${10 + (hashCode(obj.id || obj.label) % 70)}%`,
                  backgroundColor: getLabelColor(obj.label),
                }}
              >
                {obj.label}
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm mt-2 text-muted-foreground">
          Showing {activeObjects?.count ?? 0} active objects
        </p>
      </div>
    </Card>
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

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export default ReviewPage;
