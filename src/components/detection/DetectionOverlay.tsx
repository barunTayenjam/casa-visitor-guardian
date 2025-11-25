import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download,
  Eye,
  Users,
  UserCheck,
  UserX
} from 'lucide-react';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Detection {
  class: string;
  confidence: number;
  bbox: BoundingBox;
}

interface FaceDetection {
  id: string;
  name: string;
  confidence: number;
  bbox: BoundingBox;
}

interface DetectionOverlayProps {
  imageUrl: string;
  detections?: Detection[];
  faceDetections?: FaceDetection[];
  title?: string;
  timestamp?: string;
  cameraName?: string;
  className?: string;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  imageUrl,
  detections = [],
  faceDetections = [],
  title,
  timestamp,
  cameraName,
  className = ""
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDetection, setSelectedDetection] = useState<Detection | FaceDetection | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.max(0.5, Math.min(5, prevZoom * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getDetectionColor = (type: string) => {
    switch (type) {
      case 'person':
        return '#10b981'; // green-500
      case 'face':
        return '#3b82f6'; // blue-500
      case 'car':
        return '#f59e0b'; // amber-500
      case 'bicycle':
        return '#8b5cf6'; // violet-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getDetectionIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <Users className="h-3 w-3" />;
      case 'face':
        return <UserCheck className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `detection_${Date.now()}.jpg`;
    link.click();
  };

  const allDetections = [
    ...detections.map(d => ({ 
      ...d, 
      type: 'detection' as const,
      detectionType: 'detection' as const
    })),
    ...faceDetections.map(f => ({ 
      ...f, 
      class: 'face', 
      confidence: f.confidence,
      type: 'face' as const,
      detectionType: 'face' as const
    }))
  ];

  return (
    <Card className={className}>
      {(title || timestamp || cameraName) && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {(timestamp || cameraName) && (
                <div className="text-sm text-muted-foreground">
                  {cameraName && <span>{cameraName}</span>}
                  {cameraName && timestamp && <span> • </span>}
                  {timestamp && <span>{new Date(timestamp).toLocaleString()}</span>}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLabels(!showLabels)}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetView}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadImage}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="relative overflow-hidden bg-black rounded-lg">
          {/* Image Container */}
          <div 
            className="relative cursor-move select-none"
            style={{
              width: '100%',
              height: '400px',
              overflow: 'hidden'
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Image */}
            <img
              src={imageUrl}
              alt="Detection"
              className="absolute top-0 left-0 w-full h-full object-contain"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.1s'
              }}
              draggable={false}
            />
            
            {/* Detection Overlays */}
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center'
              }}
            >
              {allDetections.map((detection, index) => (
                <div
                  key={index}
                  className="absolute border-2 cursor-pointer pointer-events-auto transition-all hover:opacity-80"
                  style={{
                    left: `${detection.bbox.x}px`,
                    top: `${detection.bbox.y}px`,
                    width: `${detection.bbox.width}px`,
                    height: `${detection.bbox.height}px`,
                    borderColor: getDetectionColor(detection.class),
                    backgroundColor: `${getDetectionColor(detection.class)}20`
                  }}
                  onClick={() => setSelectedDetection(detection)}
                >
                  {/* Label */}
                  {showLabels && (
                    <div
                      className="absolute -top-6 left-0 text-xs text-white px-1 rounded flex items-center gap-1"
                      style={{ backgroundColor: getDetectionColor('class' in detection ? detection.class : 'face') }}
                >
                  {getDetectionIcon('class' in detection ? detection.class : 'face')}
                  <span>
                    {('detectionType' in detection && detection.detectionType === 'face') 
                      ? (detection as any).name || 'Unknown' 
                      : 'class' in detection ? detection.class : 'face'}
                  </span>
                      <span className="opacity-75">
                        ({Math.round(detection.confidence * 100)}%)
                      </span>
                    </div>
                  )}
                  
                  {/* Confidence indicator */}
                  <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: getDetectionColor(detection.class) }}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Zoom Controls */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setZoom(prev => Math.max(0.5, prev / 1.2))}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Zoom Indicator */}
          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {Math.round(zoom * 100)}%
          </div>
        </div>
        
        {/* Detection Summary */}
        <div className="p-4 border-t">
          <div className="flex flex-wrap gap-2 mb-3">
            {detections.length > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Users className="h-3 w-3 mr-1" />
                {detections.length} Object{detections.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {faceDetections.length > 0 && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <UserCheck className="h-3 w-3 mr-1" />
                {faceDetections.length} Face{faceDetections.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {faceDetections.filter(f => f.name && f.name !== 'Unknown').length > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <UserCheck className="h-3 w-3 mr-1" />
                {faceDetections.filter(f => f.name && f.name !== 'Unknown').length} Known
              </Badge>
            )}
            {faceDetections.filter(f => !f.name || f.name === 'Unknown').length > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <UserX className="h-3 w-3 mr-1" />
                {faceDetections.filter(f => !f.name || f.name === 'Unknown').length} Unknown
              </Badge>
            )}
          </div>
          
          {/* Selected Detection Details */}
          {selectedDetection && (
            <div className="text-sm p-3 bg-muted rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {('detectionType' in selectedDetection && selectedDetection.detectionType === 'face') 
                    ? (selectedDetection as FaceDetection).name || 'Unknown Face'
                    : 'class' in selectedDetection ? selectedDetection.class : 'face'
                  }
                </span>
                <Badge variant="outline">
                  {Math.round(selectedDetection.confidence * 100)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Position: ({selectedDetection.bbox.x}, {selectedDetection.bbox.y})</div>
                <div>Size: {selectedDetection.bbox.width}×{selectedDetection.bbox.height}</div>
                {('detectionType' in selectedDetection && selectedDetection.detectionType === 'face') && (selectedDetection as FaceDetection).id && (
                  <div>Face ID: {(selectedDetection as FaceDetection).id}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DetectionOverlay;