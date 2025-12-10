import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Detection {
  class: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: string;
}

interface DetectionResult {
  filename: string;
  path: string;
  detections: Detection[];
}

interface DetectionResultsViewerProps {
  jobId: string;
  results: DetectionResult[];
  onClose?: () => void;
}

export function DetectionResultsViewer({ 
  jobId, 
  results, 
  onClose 
}: DetectionResultsViewerProps) {
  const [selectedImage, setSelectedImage] = useState<DetectionResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'persons' | 'empty'>('all');

  // Filter results based on selected filter
  const filteredResults = results.filter(result => {
    switch (filter) {
      case 'persons':
        return result.detections.length > 0;
      case 'empty':
        return result.detections.length === 0;
      default:
        return true;
    }
  });

  // Calculate statistics
  const totalImages = results.length;
  const imagesWithDetections = results.filter(r => r.detections.length > 0).length;
  const totalDetections = results.reduce((sum, r) => sum + r.detections.length, 0);
  const personDetections = results.reduce((sum, r) => 
    sum + r.detections.filter(d => d.class === 'person').length, 0
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Detection Results</h3>
          <p className="text-sm text-muted-foreground">
            Job #{jobId.slice(-8)}
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            <XCircle className="h-4 w-4 mr-2" />
            Close
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalImages}</div>
            <p className="text-sm text-muted-foreground">Total Images</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{imagesWithDetections}</div>
            <p className="text-sm text-muted-foreground">With Detections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totalDetections}</div>
            <p className="text-sm text-muted-foreground">Total Detections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{personDetections}</div>
            <p className="text-sm text-muted-foreground">Person Detections</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        <div className="flex gap-1">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({totalImages})
          </Button>
          <Button
            variant={filter === 'persons' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('persons')}
          >
            With Detections ({imagesWithDetections})
          </Button>
          <Button
            variant={filter === 'empty' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('empty')}
          >
            No Detections ({totalImages - imagesWithDetections})
          </Button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResults.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{result.filename}</span>
                <Badge variant={result.detections.length > 0 ? 'default' : 'secondary'}>
                  {result.detections.length} {result.detections.length === 1 ? 'detection' : 'detections'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {/* Image with detections overlay */}
              <div className="relative mb-3">
                <img
                  src={result.path}
                  alt={result.filename}
                  className="w-full h-48 object-cover rounded cursor-pointer"
                  onClick={() => setSelectedImage(result)}
                />
                {/* Detection overlays */}
                {result.detections.map((detection, detIndex) => (
                  <div
                    key={detIndex}
                    className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                    style={{
                      left: `${(detection.bbox.x / 640) * 100}%`,
                      top: `${(detection.bbox.y / 480) * 100}%`,
                      width: `${(detection.bbox.width / 640) * 100}%`,
                      height: `${(detection.bbox.height / 480) * 100}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-1 rounded">
                      {detection.class} ({Math.round(detection.confidence * 100)}%)
                    </div>
                  </div>
                ))}
              </div>

              {/* Detection List */}
              {result.detections.length > 0 && (
                <div className="space-y-2">
                  {result.detections.map((detection, detIndex) => (
                    <div key={detIndex} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{detection.class}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getConfidenceColor(detection.confidence)} text-white`}
                        >
                          {getConfidenceText(detection.confidence)}
                        </Badge>
                        <span className="text-muted-foreground">
                          {Math.round(detection.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.detections.length === 0 && (
                <div className="text-center text-muted-foreground py-2">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs">No detections found</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
              <h4 className="text-lg font-semibold">{selectedImage.filename}</h4>
              <Button variant="outline" onClick={() => setSelectedImage(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <img
                  src={selectedImage.path}
                  alt={selectedImage.filename}
                  className="w-full rounded"
                />
                {selectedImage.detections.map((detection, detIndex) => (
                  <div
                    key={detIndex}
                    className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                    style={{
                      left: `${(detection.bbox.x / 640) * 100}%`,
                      top: `${(detection.bbox.y / 480) * 100}%`,
                      width: `${(detection.bbox.width / 640) * 100}%`,
                      height: `${(detection.bbox.height / 480) * 100}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-1 rounded">
                      {detection.class} ({Math.round(detection.confidence * 100)}%)
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Detailed detection info */}
              <div className="space-y-3">
                <h5 className="font-medium">Detection Details:</h5>
                {selectedImage.detections.map((detection, detIndex) => (
                  <div key={detIndex} className="p-3 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Class:</span> {detection.class}
                      </div>
                      <div>
                        <span className="font-medium">Confidence:</span> {Math.round(detection.confidence * 100)}%
                      </div>
                      <div>
                        <span className="font-medium">Position:</span> ({detection.bbox.x}, {detection.bbox.y})
                      </div>
                      <div>
                        <span className="font-medium">Size:</span> {detection.bbox.width} × {detection.bbox.height}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}