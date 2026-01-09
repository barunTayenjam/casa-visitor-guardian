import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download,
  FileJson,
  Table,
  Eye,
  EyeOff,
  Users,
  UserCheck,
  UserX,
  Package,
  AlertCircle
} from 'lucide-react';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ObjectDetection {
  confidence: number;
  boundingBox: BoundingBox;
}

interface FaceDetection extends ObjectDetection {
  personId?: string;
  personName?: string;
  isKnown?: boolean;
}

interface DetectionSummary {
  totalObjects: number;
  totalFaces: number;
  knownFaces: number;
  unknownFaces: number;
}

interface ImageDetectionDetailsProps {
  imageUrl: string;
  objectDetections?: ObjectDetection[];
  faceDetections?: FaceDetection[];
  filename?: string;
  timestamp?: string;
  cameraId?: string;
  className?: string;
}

export const ImageDetectionDetails: React.FC<ImageDetectionDetailsProps> = ({
  imageUrl,
  objectDetections = [],
  faceDetections = [],
  filename,
  timestamp,
  cameraId,
  className = ""
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [selectedDetection, setSelectedDetection] = useState<ObjectDetection | FaceDetection | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  }, [imageUrl]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.max(0.5, Math.min(5, prevZoom * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
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
    setSelectedDetection(null);
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename || `detection_${Date.now()}.jpg`;
    link.click();
  };

  const exportAsJSON = () => {
    const data = {
      filename,
      timestamp,
      cameraId,
      summary,
      objectDetections: objectDetections.map(d => ({
        class: 'confidence' in d ? 'unknown' : d.class,
        confidence: d.confidence,
        boundingBox: d.boundingBox
      })),
      faceDetections: faceDetections.map(f => ({
        id: f.personId,
        name: f.personName,
        isKnown: f.isKnown,
        confidence: f.confidence,
        boundingBox: f.boundingBox
      })),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename?.replace(/\.[^/.]+$/, '') || 'detection'}_details.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    const rows = [
      ['Type', 'Class/Name', 'Confidence', 'X', 'Y', 'Width', 'Height', 'Known'],
      
      // Object detections
      ...objectDetections.map(d => [
        'Object',
        'confidence' in d ? 'unknown' : d.class,
        (d.confidence * 100).toFixed(2),
        d.boundingBox.x,
        d.boundingBox.y,
        d.boundingBox.width,
        d.boundingBox.height,
        'N/A'
      ]),
      
      // Face detections
      ...faceDetections.map(f => [
        'Face',
        f.personName || 'Unknown',
        (f.confidence * 100).toFixed(2),
        f.boundingBox.x,
        f.boundingBox.y,
        f.boundingBox.width,
        f.boundingBox.height,
        f.isKnown ? 'Yes' : 'No'
      ])
    ];

    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename?.replace(/\.[^/.]+$/, '') || 'detection'}_details.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isFaceDetection = (detection: ObjectDetection | FaceDetection): detection is FaceDetection => {
    return 'personName' in detection;
  };

  const getDetectionColor = (detection: ObjectDetection | FaceDetection) => {
    if (isFaceDetection(detection)) {
      return detection.isKnown ? '#10b981' : '#f59e0b';
    }
    return '#3b82f6';
  };

  const getDetectionLabel = (detection: ObjectDetection | FaceDetection) => {
    if (isFaceDetection(detection)) {
      return detection.personName || (detection.isKnown ? 'Known Face' : 'Unknown Face');
    }
    return 'Object';
  };

  const getDetectionIcon = (detection: ObjectDetection | FaceDetection) => {
    if (isFaceDetection(detection)) {
      return detection.isKnown ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />;
    }
    return <Users className="h-3 w-3" />;
  };

  const summary: DetectionSummary = {
    totalObjects: objectDetections.length,
    totalFaces: faceDetections.length,
    knownFaces: faceDetections.filter(f => f.isKnown).length,
    unknownFaces: faceDetections.filter(f => !f.isKnown).length
  };

  const allDetections = [
    ...objectDetections.map(d => ({ ...d, type: 'object' as const })),
    ...faceDetections.map(d => ({ ...d, type: 'face' as const }))
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {filename && (
                <CardTitle className="text-lg truncate" title={filename}>
                  {filename}
                </CardTitle>
              )}
              {(timestamp || cameraId) && (
                <div className="text-sm text-muted-foreground mt-1">
                  {cameraId && (
                    <span className="inline-flex items-center mr-3">
                      <Package className="h-3 w-3 mr-1" />
                      {cameraId}
                    </span>
                  )}
                  {timestamp && (
                    <span className="inline-flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {new Date(timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLabels(!showLabels)}
                title={showLabels ? "Hide Labels" : "Show Labels"}
              >
                {showLabels ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetView}
                title="Reset View"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAsJSON}
                title="Export as JSON"
              >
                <FileJson className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAsCSV}
                title="Export as CSV"
              >
                <Table className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadImage}
                title="Download Image"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Detection Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {summary.totalObjects > 0 && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <Users className="h-3 w-3 mr-1" />
                {summary.totalObjects} Object{summary.totalObjects !== 1 ? 's' : ''}
              </Badge>
            )}
            {summary.totalFaces > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <UserCheck className="h-3 w-3 mr-1" />
                {summary.totalFaces} Face{summary.totalFaces !== 1 ? 's' : ''}
              </Badge>
            )}
            {summary.knownFaces > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <UserCheck className="h-3 w-3 mr-1" />
                {summary.knownFaces} Known
              </Badge>
            )}
            {summary.unknownFaces > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <UserX className="h-3 w-3 mr-1" />
                {summary.unknownFaces} Unknown
              </Badge>
            )}
            {summary.totalObjects === 0 && summary.totalFaces === 0 && (
              <Badge variant="outline" className="text-gray-500 border-gray-500">
                No detections
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Viewer with Bounding Boxes */}
      <Card>
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="relative overflow-hidden bg-black rounded-lg"
            style={{ height: '600px' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Image */}
            <div
              className="absolute top-0 left-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.1s',
                minWidth: '100%',
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt={filename || 'Detection'}
                className="max-w-none"
                style={{ 
                  maxWidth: containerRef.current?.clientWidth || 0,
                  height: 'auto'
                }}
                draggable={false}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setImageDimensions({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  });
                }}
              />
            </div>

            {/* Bounding Box Overlay */}
            {imageDimensions.width > 0 && (
              <div
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center'
                }}
              >
                {allDetections.map((detection, index) => {
                  const bbox = detection.boundingBox;
                  const color = getDetectionColor(detection);
                  const isSelected = selectedDetection === detection;

                  return (
                    <div
                      key={index}
                      className={`absolute border-2 cursor-pointer pointer-events-auto transition-all hover:opacity-80 ${
                        isSelected ? 'z-20' : 'z-10'
                      }`}
                      style={{
                        left: `${bbox.x}px`,
                        top: `${bbox.y}px`,
                        width: `${bbox.width}px`,
                        height: `${bbox.height}px`,
                        borderColor: color,
                        backgroundColor: isSelected ? `${color}40` : 'transparent',
                        boxShadow: isSelected ? `0 0 0 2px ${color}80` : 'none'
                      }}
                      onClick={() => setSelectedDetection(detection)}
                    >
                      {/* Label */}
                      {showLabels && (
                        <div
                          className="absolute -top-6 left-0 text-xs text-white px-2 py-0.5 rounded flex items-center gap-1 font-medium"
                          style={{ backgroundColor: color }}
                        >
                          {getDetectionIcon(detection)}
                          <span>{getDetectionLabel(detection)}</span>
                          <span className="opacity-75 ml-1">
                            ({Math.round(detection.confidence * 100)}%)
                          </span>
                        </div>
                      )}

                      {/* Corner markers */}
                      <div 
                        className="absolute -top-1 -left-1 w-2 h-2 bg-white border-2 rounded-sm"
                        style={{ borderColor: color }}
                      />
                      <div 
                        className="absolute -top-1 -right-1 w-2 h-2 bg-white border-2 rounded-sm"
                        style={{ borderColor: color }}
                      />
                      <div 
                        className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border-2 rounded-sm"
                        style={{ borderColor: color }}
                      />
                      <div 
                        className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border-2 rounded-sm"
                        style={{ borderColor: color }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-30">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
                className="h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(prev => Math.max(0.5, prev / 1.2))}
                className="h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
            </div>

            {/* Zoom Indicator */}
            <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detection Details Panel */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">
            Detection Details
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          {selectedDetection ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded">
                <div className="flex items-center gap-2">
                  {getDetectionIcon(selectedDetection)}
                  <span className="font-medium">
                    {getDetectionLabel(selectedDetection)}
                  </span>
                </div>
                <Badge variant="outline">
                  {Math.round(selectedDetection.confidence * 100)}%
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">Position</div>
                  <div className="font-mono text-xs">
                    X: {selectedDetection.boundingBox.x}, Y: {selectedDetection.boundingBox.y}
                  </div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">Size</div>
                  <div className="font-mono text-xs">
                    {selectedDetection.boundingBox.width} × {selectedDetection.boundingBox.height}
                  </div>
                </div>
              </div>

              {isFaceDetection(selectedDetection) && selectedDetection.personId && (
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">Person ID</div>
                  <div className="font-mono text-xs">{selectedDetection.personId}</div>
                </div>
              )}
            </div>
          ) : allDetections.length > 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Click on a detection box to see details
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-4">
              No detections available
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Detections List */}
      {allDetections.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              All Detections ({allDetections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {allDetections.map((detection, index) => {
                  const isSelected = selectedDetection === detection;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedDetection(detection)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getDetectionIcon(detection)}
                        <span className="text-sm truncate">
                          {getDetectionLabel(detection)}
                        </span>
                      </div>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">
                        {Math.round(detection.confidence * 100)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageDetectionDetails;
