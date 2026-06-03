import React, { useEffect, useState } from 'react';
import { Clock, User, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetectionItem { id: string; imageUrl: string | null; timestamp: Date; objectType: string; confidence: number; }
interface RecentDetectionsSectionProps { cameraId: string; className?: string; }

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function getPrimaryObject(event: { labels?: string[]; personCount?: number; objectDetections?: Array<{ class: string }> }): { type: string; icon: React.ElementType } {
  if (event.personCount && event.personCount > 0) return { type: 'Person', icon: User };
  if (event.objectDetections && event.objectDetections.length > 0) return { type: event.objectDetections[0].class, icon: Eye };
  if (event.labels && event.labels.length > 0) {
    const label = event.labels[0];
    if (label === 'person') return { type: 'Person', icon: User };
    return { type: label, icon: Eye };
  }
  return { type: 'Motion', icon: AlertCircle };
}

export const RecentDetectionsSection: React.FC<RecentDetectionsSectionProps> = ({ cameraId, className }) => {
  const [detections, setDetections] = useState<DetectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      try {
        const params = new URLSearchParams({ cameraId, pageSize: '3', sortBy: 'timestamp', sortOrder: 'desc' });
        const res = await fetch(`/api/events/list?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const items: DetectionItem[] = (data.events || []).map((ev: { id: string; imageUrl?: string; image_path?: string; timestamp: string; event_type?: string; confidence?: number; labels?: string[]; personCount?: number; objectDetections?: Array<{ class: string }> }) => {
          const primary = getPrimaryObject(ev);
          return { id: ev.id, imageUrl: ev.imageUrl || ev.image_path || null, timestamp: new Date(ev.timestamp), objectType: primary.type, confidence: ev.confidence || 0 };
        });
        setDetections(items);
      } catch (err) { console.error('Failed to fetch recent detections', err); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchRecent();
    return () => { cancelled = true; };
  }, [cameraId]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-3', className)}>
        <div className="flex gap-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 w-10 rounded-[0.5rem] bg-white/[0.06] animate-pulse" />))}</div>
      </div>
    );
  }

  if (detections.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-4 text-muted-foreground', className)} role="status" aria-label="No recent detections">
        <AlertCircle className="h-4 w-4 mb-1" /><span className="text-[10px]">No recent detections</span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)} role="list" aria-label="Recent detections">
      {detections.map((det) => {
        const ObjectIcon = getPrimaryObject({ labels: [det.objectType] }).icon;
        return (
          <button key={det.id} role="listitem"
            className="flex-1 min-w-0 rounded-[0.75rem] border border-white/[0.12] bg-white/[0.06] overflow-hidden hover:bg-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] text-left focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={`${det.objectType} detected ${formatRelativeTime(det.timestamp)}`}
            onClick={() => { window.location.href = `/events/${det.id}`; }}
          >
            <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
              {det.imageUrl ? (
                <img src={det.imageUrl} alt={`${det.objectType} detection`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <ObjectIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="px-1.5 py-1">
              <div className="flex items-center gap-1">
                <ObjectIcon className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <span className="text-[9px] font-medium truncate">{det.objectType}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <Clock className="h-2 w-2" />
                  <span className="text-[8px]">{formatRelativeTime(det.timestamp)}</span>
                </div>
                {det.confidence > 0 && <span className="text-[8px] text-muted-foreground">{Math.round(det.confidence <= 1 ? det.confidence * 100 : det.confidence)}%</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
