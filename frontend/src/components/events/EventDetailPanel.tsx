import React, { useState, useRef, useCallback } from 'react';
import { MotionEvent } from '@/types/security';
import { X, Download, Trash2, Share2, ChevronLeft, ChevronRight, Brain, AlertTriangle, Car, User, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysis {
  sceneDescription?: string;
  threatAssessment?: { level: string; factors: string[]; confidence: number; };
  detectedEntities?: { people: string[]; vehicles: string[]; animals: string[]; objects: string[]; };
  recommendedActions?: string[]; processingTime?: number; modelUsed?: string;
}

interface NvidiaBox {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EventDetailPanelProps {
  event: MotionEvent | null;
  events: MotionEvent[];
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onDelete?: (eventId: string) => void;
  onDownload?: (event: MotionEvent) => void;
  onAnalyze?: (eventId: string) => void;
  analysis?: AIAnalysis | null;
  analyzing?: boolean;
  boxes?: NvidiaBox[];
}

interface DetectionBoxV1 { x: number; y: number; w: number; h: number; }
interface DetectionBoxV2 { xmin: number; ymin: number; xmax: number; ymax: number; }
interface DetectionEntry {
  boundingBox?: { x: number; y: number; width: number; height: number };
  box?: DetectionBoxV1;
  bounding_box?: DetectionBoxV2;
  [key: string]: unknown;
}

function normalizeBoundingBox(detection: DetectionEntry): { x: number; y: number; width: number; height: number } | null {
  if (detection.boundingBox) return detection.boundingBox;
  if (detection.box) {
    return { x: detection.box.x, y: detection.box.y, width: detection.box.w, height: detection.box.h };
  }
  if (detection.bounding_box) {
    return {
      x: detection.bounding_box.xmin,
      y: detection.bounding_box.ymin,
      width: detection.bounding_box.xmax - detection.bounding_box.xmin,
      height: detection.bounding_box.ymax - detection.bounding_box.ymin,
    };
  }
  return null;
}

function formatConfidence(value: number): string {
  if (value <= 0) return '0%';
  if (value < 0.5) return '< 1%';
  return `${Math.round(value)}%`;
}

export const EventDetailPanel: React.FC<EventDetailPanelProps> = ({
  event, events, onClose, onNext, onPrevious, onDelete, onDownload, onAnalyze, analysis, analyzing, boxes,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [imageScale, setImageScale] = useState<{ scaleX: number; scaleY: number; offsetX: number; offsetY: number; renderedW: number; renderedH: number }>({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, renderedW: 0, renderedH: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleImageLoad = useCallback((e?: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e?.currentTarget;
    const container = imageContainerRef.current;
    if (!img || !container) return;
    const containerRect = container.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;
    const containerW = containerRect.width;
    const containerH = containerRect.height;
    const imgAspect = naturalW / naturalH;
    const containerAspect = containerW / containerH;
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (imgAspect > containerAspect) {
      renderedW = containerW;
      renderedH = containerW / imgAspect;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    } else {
      renderedH = containerH;
      renderedW = containerH * imgAspect;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    }
    setImageScale({
      scaleX: renderedW / naturalW,
      scaleY: renderedH / naturalH,
      offsetX,
      offsetY,
      renderedW,
      renderedH,
    });
  }, []);

  const hasNvidiaBoxes = boxes && boxes.length > 0 && showBoxes;

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
    if (onDelete && window.confirm('Are you sure you want to delete this event?')) onDelete(event.id);
  };

  const handleShare = async () => {
    const eventUrl = `${window.location.origin}/events?eventId=${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Security Event', url: eventUrl });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(eventUrl);
        toast({ title: 'Link copied to clipboard' });
      } catch {
        toast({ title: 'Failed to copy link', variant: 'destructive' });
      }
    }
  };

  const getDetectionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person': return '#22c55e';
      case 'face': return '#8b5cf6';
      case 'vehicle': return '#3b82f6';
      default: return '#f59e0b';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full md:w-[600px] lg:w-[700px] flex flex-col text-white">
      {/* Outer shell */}
      <div className="h-full p-[1px] rounded-l-[4px] bg-white/[0.06]">
        <div className="h-full rounded-l-[3px] bg-black/90 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex flex-col overflow-hidden border-l border-white/[0.12]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 hairline-bottom">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">Event Details</h2>
              <Badge variant="glass" className="text-[10px] uppercase tracking-[0.08em]"
                style={{
                  backgroundColor: `${getDetectionColor(event.labels?.[0] || 'motion')}15`,
                  borderColor: `${getDetectionColor(event.labels?.[0] || 'motion')}30`,
                  color: getDetectionColor(event.labels?.[0] || 'motion'),
                }}
              >
                {event.labels?.[0] || 'motion'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2">
                <Button size="icon-sm" variant="ghost" onClick={onPrevious} disabled={!hasPrevious} className="text-white/60 hover:text-white" aria-label="Previous event">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/60">{currentIndex + 1} / {events.length}</span>
                <Button size="icon-sm" variant="ghost" onClick={onNext} disabled={!hasNext} className="text-white/60 hover:text-white" aria-label="Next event">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Event Image */}
            <div className="relative aspect-video bg-black" ref={imageContainerRef}>
              {!imageError && event.imageUrl ? (
                <ProgressiveImage src={event.imageUrl} alt={`Event from ${event.cameraName}`} className="w-full h-full" onError={() => setImageError(true)} onLoad={handleImageLoad} />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><p className="text-white/60 text-sm">Image not available</p></div>
              )}
              {(event.detections && event.detections.length > 0) && (
                <div className="absolute inset-0 pointer-events-none">
                  {event.detections.map((detection: DetectionEntry, index) => {
                     const box = normalizeBoundingBox(detection);
                     if (!box) return null;
                     const detType = String(detection.type || 'motion');
                     const conf = typeof detection.confidence === 'number' ? detection.confidence : 0;
                     const displayConf = conf <= 1 ? conf * 100 : conf;
                     return (
                       <div key={index} className="absolute border-2"
                         style={{
                           left: `${box.x * imageScale.scaleX + imageScale.offsetX}px`,
                           top: `${box.y * imageScale.scaleY + imageScale.offsetY}px`,
                           width: `${box.width * imageScale.scaleX}px`,
                           height: `${box.height * imageScale.scaleY}px`,
                           borderColor: getDetectionColor(detType),
                           boxShadow: `0 0 10px ${getDetectionColor(detType)}40`,
                         }}
                       >
                        <div className="absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-semibold text-white rounded-full"
                          style={{ backgroundColor: getDetectionColor(detType) }}
                        >
                          {detType} • {formatConfidence(displayConf)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {analysis && analysis.detectedEntities && (
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
                  {analysis.detectedEntities.people?.map((person, i) => (
                    <div key={`person-${i}`} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-green-500/80 text-white shadow-lg backdrop-blur-sm">👤 {person}</div>
                  ))}
                  {analysis.detectedEntities.vehicles?.map((vehicle, i) => (
                    <div key={`vehicle-${i}`} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-blue-500/80 text-white shadow-lg backdrop-blur-sm">🚗 {vehicle}</div>
                  ))}
                  {analysis.detectedEntities.animals?.map((animal, i) => (
                    <div key={`animal-${i}`} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/80 text-white shadow-lg backdrop-blur-sm">🐾 {animal}</div>
                  ))}
                </div>
              )}
              {hasNvidiaBoxes && (
                <div className="absolute inset-0 pointer-events-none" key="nvidia-boxes">
                  {boxes.map((box, i) => (
                    <div key={i} className="absolute border-2"
                      style={{
                        left: `${(box.x / 100) * imageScale.renderedW + imageScale.offsetX}px`,
                        top: `${(box.y / 100) * imageScale.renderedH + imageScale.offsetY}px`,
                        width: `${(box.width / 100) * imageScale.renderedW}px`,
                        height: `${(box.height / 100) * imageScale.renderedH}px`,
                        borderColor: getDetectionColor(box.label),
                        boxShadow: `0 0 10px ${getDetectionColor(box.label)}40`,
                      }}
                    >
                      <div className="absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-semibold text-white rounded-full whitespace-nowrap"
                        style={{ backgroundColor: getDetectionColor(box.label) }}
                      >
                        {box.label} • {formatConfidence(box.confidence)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {analysis ? (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => setShowBoxes(v => !v)}
                    className="p-[1px] rounded-full bg-white/[0.08] hover:bg-white/[0.12] transition-all duration-500"
                    title={showBoxes ? 'Hide bounding boxes' : 'Show bounding boxes'}
                  >
                    <div className={cn(
                      "rounded-full bg-black/70 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center gap-1.5 px-2.5 py-1",
                      showBoxes ? "text-green-400" : "text-white/40"
                    )}>
                      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="1" width="14" height="14" rx="2" />
                        <line x1="1" y1="5" x2="15" y2="5" />
                        <line x1="1" y1="11" x2="15" y2="11" />
                        <line x1="5" y1="1" x2="5" y2="15" />
                        <line x1="11" y1="1" x2="11" y2="15" />
                      </svg>
                    </div>
                  </button>
                  <div className="p-[1px] rounded-full bg-green-500/30 shadow-[0_0_16px_rgba(34,197,94,0.15)]">
                    <div className="rounded-full bg-black/70 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center gap-1.5 px-2.5 py-1">
                      <Brain className="h-3 w-3 text-green-400" />
                      <span className="text-[10px] font-medium text-green-400">Analyzed</span>
                    </div>
                  </div>
                </div>
              ) : onAnalyze && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(event.id); }}
                    disabled={analyzing}
                    className="p-[1px] rounded-full bg-blue-500/30 shadow-[0_0_16px_rgba(59,130,246,0.15)] hover:bg-blue-500/40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-50"
                  >
                    <div className="rounded-full bg-black/70 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center gap-1.5 px-2.5 py-1">
                      {analyzing ? (
                        <span className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      ) : (
                        <Brain className="h-3 w-3 text-blue-400" />
                      )}
                      <span className="text-[10px] font-medium text-blue-400">{analyzing ? 'Analyzing...' : 'Analyze'}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Event Metadata */}
            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-lg font-semibold mb-1">{event.cameraName}</h3>
                <p className="text-sm text-white/60">{format(event.timestamp, 'PPPP p')}</p>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Confidence', value: formatConfidence(typeof event.confidence === 'number' && event.confidence <= 1 ? event.confidence * 100 : event.confidence) },
                  { label: 'Persons', value: event.personCount || 0 },
                  { label: 'Faces', value: event.faceCount || 0 },
                ].map((stat, i) => (
                  <div key={i} className="p-[1px] rounded-[0.75rem] bg-white/[0.08]">
                    <div className="rounded-[calc(0.75rem-1px)] bg-black/40 px-3 py-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-white/60 mb-0.5">{stat.label}</p>
                      <p className="text-base font-semibold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detection Labels */}
              {event.labels && event.labels.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-white/70 uppercase tracking-[0.08em] mb-3">Detections</h4>
                  <div className="flex flex-wrap gap-2">
                    {event.labels.map((label, index) => (
                      <Badge key={index} variant="glass" className="text-xs"
                        style={{
                          backgroundColor: `${getDetectionColor(label)}15`,
                          borderColor: `${getDetectionColor(label)}30`,
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
                  <h4 className="text-xs font-medium text-white/70 uppercase tracking-[0.08em] mb-3">Additional Info</h4>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {event.metadata.lightLevel !== undefined && (
                      <><dt className="text-white/60">Light Level</dt><dd className="text-white">{String(event.metadata.lightLevel)}</dd></>
                    )}
                    {event.metadata.motionArea !== undefined && (
                      <><dt className="text-white/60">Motion Area</dt><dd className="text-white">{Number(event.metadata.motionArea).toLocaleString()} px</dd></>
                    )}
                  </dl>
                </div>
              )}

              {/* Face Recognition */}
              {(event.knownFaces || 0) > 0 || (event.unknownFaces || 0) > 0 ? (
                <div>
                  <h4 className="text-xs font-medium text-white/70 uppercase tracking-[0.08em] mb-3">Face Recognition</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <span className="text-xs text-green-400">{event.knownFaces || 0}</span>
                      </div>
                      <span className="text-sm text-white/60">Known</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <span className="text-xs text-amber-400">{event.unknownFaces || 0}</span>
                      </div>
                      <span className="text-sm text-white/60">Unknown</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* AI Analysis */}
            {analysis && (
              <div className="mx-5 mb-5 p-[1px] rounded-[1.25rem] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-indigo-500/20 shadow-[0_0_30px_rgba(59,130,246,0.06)]">
                <div className="rounded-[calc(1.25rem-1px)] bg-black/70 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 space-y-5">

                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-[1px] rounded-full bg-blue-500/30">
                        <div className="rounded-full bg-blue-500/10 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                          <Brain className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold">AI Analysis</h4>
                    </div>
                    {analysis.modelUsed && (
                      <div className="p-[1px] rounded-full bg-white/[0.06]">
                        <div className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-mono text-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                          {analysis.modelUsed.split('/').pop()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scene Description */}
                  {analysis.sceneDescription && (
                    <p className="text-sm text-white/80 leading-relaxed">{analysis.sceneDescription}</p>
                  )}

                  {/* Threat Assessment */}
                  {analysis.threatAssessment && (
                    <div className="p-[1px] rounded-[0.875rem] bg-white/[0.08]">
                      <div className="rounded-[calc(0.875rem-1px)] bg-black/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] px-3.5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-[1px] rounded-full",
                            analysis.threatAssessment.level === 'high' ? 'bg-red-500/40' :
                            analysis.threatAssessment.level === 'medium' ? 'bg-amber-500/30' : 'bg-green-500/30'
                          )}>
                            <div className="rounded-full bg-black/60 p-1.5">
                              <AlertTriangle className={cn(
                                "h-3.5 w-3.5",
                                analysis.threatAssessment.level === 'high' ? 'text-red-400' :
                                analysis.threatAssessment.level === 'medium' ? 'text-amber-400' : 'text-green-400'
                              )} />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-white/70">Threat Level</span>
                              <div className={cn(
                                "p-[1px] rounded-full",
                                analysis.threatAssessment.level === 'high' ? 'bg-red-500/30' :
                                analysis.threatAssessment.level === 'medium' ? 'bg-amber-500/30' : 'bg-green-500/30'
                              )}>
                                <div className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                                  analysis.threatAssessment.level === 'high' ? 'bg-red-500/15 text-red-400' :
                                  analysis.threatAssessment.level === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'
                                )}>
                                  {analysis.threatAssessment.level}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]",
                                    analysis.threatAssessment.level === 'high' ? 'bg-red-500' :
                                    analysis.threatAssessment.level === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                                  )}
                                  style={{ width: `${analysis.threatAssessment.confidence}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-white/60">{analysis.threatAssessment.confidence}%</span>
                            </div>
                          </div>
                        </div>
                        {analysis.threatAssessment.factors?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {analysis.threatAssessment.factors.map((factor, i) => (
                              <div key={i} className="p-[1px] rounded-full bg-white/[0.08]">
                                <div className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                                  {factor}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detected Entities */}
                  {analysis.detectedEntities && (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-white/60">Detected Entities</p>
                      {analysis.detectedEntities.people?.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="p-[1px] rounded-full bg-green-500/20 mt-0.5">
                            <div className="rounded-full bg-green-500/10 p-1">
                              <User className="h-3 w-3 text-green-400" />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {analysis.detectedEntities.people.map((p, i) => (
                              <div key={i} className="p-[1px] rounded-full bg-green-500/20">
                                <div className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] text-green-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                                  {p}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.detectedEntities.vehicles?.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="p-[1px] rounded-full bg-blue-500/20 mt-0.5">
                            <div className="rounded-full bg-blue-500/10 p-1">
                              <Car className="h-3 w-3 text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {analysis.detectedEntities.vehicles.map((v, i) => (
                              <div key={i} className="p-[1px] rounded-full bg-blue-500/20">
                                <div className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] text-blue-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                                  {v}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.detectedEntities.animals?.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="p-[1px] rounded-full bg-amber-500/20 mt-0.5">
                            <div className="rounded-full bg-amber-500/10 p-1">
                              <Eye className="h-3 w-3 text-amber-400" />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {analysis.detectedEntities.animals.map((a, i) => (
                              <div key={i} className="p-[1px] rounded-full bg-amber-500/20">
                                <div className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                                  {a}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.detectedEntities.objects?.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="p-[1px] rounded-full bg-purple-500/20 mt-0.5">
                            <div className="rounded-full bg-purple-500/10 p-1">
                              <span className="block h-3 w-3 text-[10px] text-purple-400 leading-none text-center">◇</span>
                            </div>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {analysis.detectedEntities.objects.map((o, i) => (
                              <div key={i} className="p-[1px] rounded-full bg-purple-500/20">
                                <div className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] text-purple-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                                  {o}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommended Actions */}
                  {analysis.recommendedActions?.length > 0 && (
                    <div className="p-[1px] rounded-[0.875rem] bg-white/[0.08]">
                      <div className="rounded-[calc(0.875rem-1px)] bg-black/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-white/60 mb-2.5">Recommended Actions</p>
                        <div className="space-y-1.5">
                          {analysis.recommendedActions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <div className="p-[1px] rounded-full bg-blue-500/30 mt-0.5 flex-shrink-0">
                                <div className="rounded-full bg-blue-500/10 w-4 h-4 flex items-center justify-center">
                                  <span className="text-[8px] text-blue-400 font-bold">→</span>
                                </div>
                              </div>
                              <span className="text-sm text-white/70">{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing Footer */}
                  {(analysis.processingTime || analysis.modelUsed) && (
                    <div className="flex items-center justify-between pt-3 hairline-top">
                      {analysis.processingTime && (
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse-soft" />
                          <span className="text-[10px] font-mono text-white/60">
                            Processed in {Math.round(analysis.processingTime / 1000)}s
                          </span>
                        </div>
                      )}
                      {analysis.modelUsed && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/60">via</span>
                          <div className="p-[1px] rounded-full bg-white/[0.08]">
                            <div className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-mono text-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                              {analysis.modelUsed}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 hairline-top">
            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={handleDownload} disabled={!event.imageUrl}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
