import React, { useState } from 'react';
import { MotionEvent } from '@/types/security';
import { X, Download, Trash2, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { colors } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EventDetailPanelProps {
  event: MotionEvent | null;
  events: MotionEvent[];
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onDelete?: (eventId: string) => void;
  onDownload?: (event: MotionEvent) => void;
}

export const EventDetailPanel: React.FC<EventDetailPanelProps> = ({
  event,
  events,
  onClose,
  onNext,
  onPrevious,
  onDelete,
  onDownload,
}) => {
  const [imageError, setImageError] = useState(false);

  if (!event) return null;

  const currentIndex = events.findIndex(e => e.id === event.id);
  const hasNext = currentIndex < events.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleDownload = () => {
    if (onDownload && event.imageUrl) {
      const link = document.createElement('a');
      link.href = event.imageUrl;
      link.download = `event_${event.cameraId}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
      link.click();
      onDownload(event);
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this event?')) {
      onDelete(event.id);
    }
  };

  const getDetectionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
        return colors.detection.person;
      case 'face':
        return colors.detection.face;
      case 'vehicle':
        return colors.detection.vehicle;
      default:
        return colors.detection.motion;
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] lg:w-[700px] shadow-2xl transform transition-transform duration-300"
      style={{
        backgroundColor: colors.background.secondary,
        borderLeft: `1px solid ${colors.border.subtle}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: colors.border.subtle }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Event Details</h2>
          <Badge
            className="text-xs"
            style={{
              backgroundColor: `${getDetectionColor(event.labels?.[0] || 'motion')}20`,
              borderColor: getDetectionColor(event.labels?.[0] || 'motion'),
              color: getDetectionColor(event.labels?.[0] || 'motion'),
            }}
          >
            {event.labels?.[0] || 'motion'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-1 mr-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30"
              onClick={onPrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30"
              onClick={onNext}
              disabled={!hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-sm text-white/50 mr-2">
            {currentIndex + 1} / {events.length}
          </span>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Event Image */}
        <div className="relative aspect-video bg-black">
          {!imageError && event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.cameraName}
              className="w-full h-full object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-white/40">Image not available</p>
            </div>
          )}

          {/* Detection Overlays */}
          {event.detections && event.detections.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {event.detections.map((detection, index) => (
                <div
                  key={index}
                  className="absolute border-2"
                  style={{
                    left: `${detection.boundingBox.x}px`,
                    top: `${detection.boundingBox.y}px`,
                    width: `${detection.boundingBox.width}px`,
                    height: `${detection.boundingBox.height}px`,
                    borderColor: getDetectionColor(detection.type),
                    boxShadow: `0 0 10px ${getDetectionColor(detection.type)}40`,
                  }}
                >
                  <div
                    className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-semibold text-white rounded"
                    style={{ backgroundColor: getDetectionColor(detection.type) }}
                  >
                    {detection.type} • {Math.round(detection.confidence * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Metadata */}
        <div className="p-6 space-y-6">
          {/* Title & Timestamp */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {event.cameraName}
            </h3>
            <p className="text-sm text-white/60">
              {format(event.timestamp, 'PPPP p')}
            </p>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: colors.background.tertiary }}
            >
              <p className="text-xs text-white/50 mb-1">Confidence</p>
              <p className="text-lg font-semibold text-white">
                {Math.round(event.confidence * 100)}%
              </p>
            </div>

            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: colors.background.tertiary }}
            >
              <p className="text-xs text-white/50 mb-1">Persons</p>
              <p className="text-lg font-semibold text-white">
                {event.personCount || 0}
              </p>
            </div>

            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: colors.background.tertiary }}
            >
              <p className="text-xs text-white/50 mb-1">Faces</p>
              <p className="text-lg font-semibold text-white">
                {event.faceCount || 0}
              </p>
            </div>
          </div>

          {/* Detection Labels */}
          {event.labels && event.labels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Detections</h4>
              <div className="flex flex-wrap gap-2">
                {event.labels.map((label, index) => (
                  <Badge
                    key={index}
                    className="text-sm"
                    style={{
                      backgroundColor: `${getDetectionColor(label)}20`,
                      borderColor: getDetectionColor(label),
                      color: getDetectionColor(label),
                    }}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Additional Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Additional Info</h4>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {event.metadata.lightLevel !== undefined && (
                  <>
                  <dt className="text-white/50">Light Level</dt>
                  <dd className="text-white">{String(event.metadata.lightLevel)}</dd>
                  </>
                )}
                {event.metadata.motionArea !== undefined && (
                  <>
                  <dt className="text-white/50">Motion Area</dt>
                  <dd className="text-white">{String(event.metadata.motionArea)}%</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {/* Face Recognition Details */}
          {(event.knownFaces || 0) > 0 || (event.unknownFaces || 0) > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Face Recognition</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <span className="text-xs text-green-400">
                      {event.knownFaces || 0}
                    </span>
                  </div>
                  <span className="text-sm text-white/70">Known</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <span className="text-xs text-amber-400">
                      {event.unknownFaces || 0}
                    </span>
                  </div>
                  <span className="text-sm text-white/70">Unknown</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer Actions */}
      <div
        className="flex items-center justify-between px-6 py-4 border-t"
        style={{ borderColor: colors.border.subtle }}
      >
        <Button
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>

          <Button
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            onClick={handleDownload}
            disabled={!event.imageUrl}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};
