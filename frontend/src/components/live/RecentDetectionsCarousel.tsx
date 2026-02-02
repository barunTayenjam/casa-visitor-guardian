import React, { useState, useEffect } from 'react';
import { X, ZoomIn, Calendar, AlertTriangle } from 'lucide-react';
import { colors, spacing } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';

interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName?: string;
  event_type: string;
  confidence: number;
  imageUrl: string;
  persons_detected?: number;
  faces_detected?: number;
  object_detections?: Array<{
    label: string;
    confidence: number;
  }>;
}

interface RecentDetectionsCarouselProps {
  limit?: number;
  onEventClick?: (event: DetectionEvent) => void;
}

export const RecentDetectionsCarousel: React.FC<RecentDetectionsCarouselProps> = ({
  limit = 12,
  onEventClick,
}) => {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<DetectionEvent | null>(null);

  useEffect(() => {
    const fetchRecentEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/events/list-enhanced?page=1&pageSize=${limit}`);
        const data = await response.json();

        if (data.success && data.events) {
          const formattedEvents: DetectionEvent[] = data.events.map((event: any) => ({
            id: event.id,
            timestamp: event.timestamp,
            cameraId: event.cameraId,
            event_type: event.event_type,
            confidence: event.confidence,
            imageUrl: event.imageUrl || `/api/events/image/${event.filename}`,
            persons_detected: event.persons_detected,
            faces_detected: event.faces_detected,
            object_detections: event.object_detections,
          }));

          setEvents(formattedEvents);
        }
      } catch (error) {
        console.error('Failed to fetch recent events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentEvents();

    // Refresh events every 30 seconds
    const interval = setInterval(fetchRecentEvents, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  const handleEventClick = (event: DetectionEvent) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  };

  const getEventTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
      case 'face':
        return colors.detection.person;
      case 'vehicle':
        return colors.detection.vehicle;
      case 'motion':
        return colors.detection.motion;
      case 'package':
        return colors.detection.package;
      default:
        return colors.text.muted;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <div className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading recent detections...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <div className="text-center text-white/40">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent detections</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Carousel Container */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          background: colors.glass.light,
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${colors.border.subtle}`,
        }}
      >
        <div className="px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: colors.status.warning }} />
              <h2 className="text-sm font-semibold text-white/90">Recent Detections</h2>
              <span className="text-xs text-white/50">Last {limit} events</span>
            </div>
          </div>

          {/* Horizontal Scroll Container */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {events.map((event) => (
              <div
                key={event.id}
                className="relative group flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105"
                style={{ width: '160px' }}
                onClick={() => handleEventClick(event)}
              >
                {/* Event Card */}
                <div
                  className="relative overflow-hidden rounded-lg bg-black border border-white/10"
                  style={{ aspectRatio: '16/9' }}
                >
                  {/* Event Image */}
                  <img
                    src={event.imageUrl}
                    alt={event.event_type}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-event.svg';
                    }}
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Subtle Timestamp Badge - Bottom Right */}
                  <div className="absolute bottom-2 right-2">
                    <div className="px-2 py-1 rounded text-xs font-medium bg-black/40 backdrop-blur-sm text-white/80">
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal for Enlarged View */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.90)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
              onClick={() => setSelectedEvent(null)}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <div className="relative bg-black">
              <img
                src={selectedEvent.imageUrl}
                alt={selectedEvent.event_type}
                className="w-full object-contain max-h-[70vh]"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-event.svg';
                }}
              />
            </div>

            {/* Details Panel */}
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Event Type and Camera */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: `${getEventTypeColor(selectedEvent.event_type)}20`,
                        color: getEventTypeColor(selectedEvent.event_type),
                        border: `1px solid ${getEventTypeColor(selectedEvent.event_type)}40`,
                      }}
                    >
                      {selectedEvent.event_type}
                    </div>
                    <div className="text-white/60">•</div>
                    <div className="text-sm text-white/90">{selectedEvent.cameraId}</div>
                    {selectedEvent.confidence > 0 && (
                      <>
                        <div className="text-white/60">•</div>
                        <div className="text-sm text-white/90">{Math.round(selectedEvent.confidence)}% confidence</div>
                      </>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                  </div>

                  {/* Detection Counts */}
                  <div className="flex items-center gap-4">
                    {selectedEvent.persons_detected !== undefined && selectedEvent.persons_detected > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white/60">Persons:</span>
                        <span className="font-medium text-white">{selectedEvent.persons_detected}</span>
                      </div>
                    )}
                    {selectedEvent.faces_detected !== undefined && selectedEvent.faces_detected > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white/60">Faces:</span>
                        <span className="font-medium text-white">{selectedEvent.faces_detected}</span>
                      </div>
                    )}
                  </div>

                  {/* Object Detections */}
                  {selectedEvent.object_detections && selectedEvent.object_detections.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-white/60 mb-2">Detected Objects:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.object_detections.map((obj, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/80"
                          >
                            {obj.label} ({Math.round(obj.confidence)}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
