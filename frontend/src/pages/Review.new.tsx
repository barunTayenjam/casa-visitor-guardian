import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewSegments, useAcknowledgeSegment, useActiveObjects } from '../hooks/useReview';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Video, Clock, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { colors } from '@/styles/design-tokens';

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.background.primary }}>
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load review segments. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/streams')} className="hover:bg-white/5">
            <ArrowLeft className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold" style={{ color: colors.text.primary }}>Review</h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>Review and confirm detection events</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={camera || 'all'} onValueChange={(v) => setCamera(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
            <SelectTrigger className="w-[140px]">
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
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Total Segments</p>
                <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>{data?.total ?? 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
                <Video className="h-5 w-5" style={{ color: colors.status.info }} />
              </div>
            </div>
          </Card>
          
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Alerts</p>
                <p className="text-2xl font-bold" style={{ color: colors.status.error }}>{alertCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.error}15` }}>
                <AlertTriangle className="h-5 w-5" style={{ color: colors.status.error }} />
              </div>
            </div>
          </Card>
          
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Detections</p>
                <p className="text-2xl font-bold" style={{ color: colors.status.success }}>{detectionCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.success}15` }}>
                <Check className="h-5 w-5" style={{ color: colors.status.success }} />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="w-full sm:w-auto" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.subtle}` }}>
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
              <Card className="rounded-xl p-12 text-center" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                <Video className="h-16 w-16 mx-auto mb-4 opacity-30" style={{ color: colors.text.primary }} />
                <p className="text-lg mb-2" style={{ color: colors.text.primary }}>No review segments found</p>
                <p className="text-sm" style={{ color: colors.text.muted }}>Try adjusting the filters</p>
              </Card>
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

  const getSeverityColor = () => {
    return segment.severity === 'alert' 
      ? { borderColor: colors.status.error, badgeBg: `${colors.status.error}15`, badgeColor: colors.status.error }
      : { borderColor: colors.border.subtle, badgeBg: `${colors.status.success}15`, badgeColor: colors.status.success };
  };

  const severityColors = getSeverityColor();

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md rounded-xl overflow-hidden',
        isSelected && 'ring-2',
        segment.reviewed && 'opacity-60'
      )}
      style={{ 
        backgroundColor: colors.background.secondary,
        borderColor: isSelected ? colors.status.info : severityColors.borderColor
      }}
      onClick={onSelect}
    >
      <div className="relative aspect-video" style={{ backgroundColor: colors.background.tertiary }}>
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
            className="flex items-center gap-1"
            style={{ backgroundColor: severityColors.badgeBg, color: severityColors.badgeColor, border: 'none' }}
          >
            {segment.severity === 'alert' && <AlertTriangle className="w-3 h-3" />}
            {segment.severity}
          </Badge>
        </div>
        {segment.reviewed && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${colors.status.success}20` }}>
            <Check className="w-4 h-4" style={{ color: colors.status.success }} />
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
            <p className="font-medium text-sm" style={{ color: colors.text.primary }}>{segment.camera}</p>
            <p className="text-xs" style={{ color: colors.text.muted }}>
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
            size="sm"
            variant="outline"
            className="w-full gap-1"
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
    <Card className="rounded-xl" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: colors.text.primary }}>Activity Timeline</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            >
              -
            </Button>
            <span className="text-sm w-12 text-center" style={{ color: colors.text.secondary }}>{Math.round(zoom * 100)}%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            >
              +
            </Button>
          </div>
        </div>
        
        <div className="relative h-32 rounded-lg overflow-hidden" style={{ backgroundColor: colors.background.tertiary }}>
          <div
            className="absolute inset-0 flex items-center"
            style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
          >
            {activeObjects?.objects.map((obj) => (
              <div
                key={obj.id}
                className="absolute h-8 rounded text-xs text-white px-2 py-1 whitespace-nowrap shadow-sm"
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
        
        <p className="text-sm mt-2" style={{ color: colors.text.muted }}>
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

export default ReviewPage;
