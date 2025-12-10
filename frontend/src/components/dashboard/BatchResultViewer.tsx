import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  UserCheck, 
  Eye, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import { format } from 'date-fns';

interface BatchResult {
  filename: string;
  timestamp: string;
  cameraId: string;
  persons: Array<{
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  faces: Array<{
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    personId?: string;
    personName?: string;
    isKnown?: boolean;
  }>;
}

interface BatchResultsData {
  jobId: string;
  timestamp: string;
  options: {
    timeRange: {
      start: string;
      end: string;
    };
    cameraIds: string[];
    detectionTypes: string[];
    confidenceThreshold: number;
  };
  summary: {
    totalImages: number;
    personDetections: number;
    faceDetections: number;
    knownFaces: number;
    unknownFaces: number;
  };
  results: BatchResult[];
}

interface BatchResultViewerProps {
  batchData: BatchResultsData;
  jobId: string;
}

export const BatchResultViewer: React.FC<BatchResultViewerProps> = ({ batchData, jobId }) => {
  console.log('BatchResultViewer rendered with:', { batchData: batchData.summary, jobId });
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'persons' | 'faces' | 'both'>('all');
  const [sortOrder, setSortOrder] = useState<'time' | 'detections'>('time');
  const imageRef = useRef<HTMLImageElement>(null);

  // Filter and sort results
  const filteredResults = batchData.results.filter(result => {
    const hasPersons = result.persons.length > 0;
    const hasFaces = result.faces.length > 0;
    
    switch (filter) {
      case 'persons':
        return hasPersons && !hasFaces;
      case 'faces':
        return hasFaces && !hasPersons;
      case 'both':
        return hasPersons && hasFaces;
      default:
        return true;
    }
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortOrder === 'detections') {
      const aCount = a.persons.length + a.faces.length;
      const bCount = b.persons.length + b.faces.length;
      return bCount - aCount;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const currentImage = sortedResults[selectedImageIndex];

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const renderBoundingBoxes = () => {
    if (!currentImage || !imageRef.current) return null;

    const img = imageRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    return (
      <svg 
        className="absolute inset-0 pointer-events-none"
        style={{ width: img.clientWidth, height: img.clientHeight }}
      >
        {/* Person bounding boxes */}
        {currentImage.persons.map((person, index) => (
          <g key={`person-${index}`}>
            <rect
              x={person.boundingBox.x / scaleX}
              y={person.boundingBox.y / scaleY}
              width={person.boundingBox.width / scaleX}
              height={person.boundingBox.height / scaleY}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            <rect
              x={person.boundingBox.x / scaleX}
              y={person.boundingBox.y / scaleY - 20}
              width="80"
              height="20"
              fill="#10b981"
              rx="2"
            />
            <text
              x={person.boundingBox.x / scaleX + 5}
              y={person.boundingBox.y / scaleY - 5}
              fill="white"
              fontSize="12"
              fontWeight="bold"
            >
              Person {Math.round(person.confidence * 100)}%
            </text>
          </g>
        ))}

        {/* Face bounding boxes */}
        {currentImage.faces.map((face, index) => (
          <g key={`face-${index}`}>
            <rect
              x={face.boundingBox.x / scaleX}
              y={face.boundingBox.y / scaleY}
              width={face.boundingBox.width / scaleX}
              height={face.boundingBox.height / scaleY}
              fill="none"
              stroke={face.isKnown ? "#3b82f6" : "#f59e0b"}
              strokeWidth="2"
            />
            <rect
              x={face.boundingBox.x / scaleX}
              y={face.boundingBox.y / scaleY - 20}
              width="100"
              height="20"
              fill={face.isKnown ? "#3b82f6" : "#f59e0b"}
              rx="2"
            />
            <text
              x={face.boundingBox.x / scaleX + 5}
              y={face.boundingBox.y / scaleY - 5}
              fill="white"
              fontSize="12"
              fontWeight="bold"
            >
              {face.isKnown ? face.personName || 'Known' : 'Unknown'} {Math.round(face.confidence * 100)}%
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Batch Results: #{jobId.slice(-8)}
          </CardTitle>
          <CardDescription>
            Processed {format(new Date(batchData.timestamp), 'PPpp')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{batchData.summary.totalImages}</div>
              <div className="text-sm text-muted-foreground">Total Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{batchData.summary.personDetections}</div>
              <div className="text-sm text-muted-foreground">Persons Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{batchData.summary.faceDetections}</div>
              <div className="text-sm text-muted-foreground">Faces Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">{batchData.summary.knownFaces}</div>
              <div className="text-sm text-muted-foreground">Known Faces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{batchData.summary.unknownFaces}</div>
              <div className="text-sm text-muted-foreground">Unknown Faces</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Filter:</label>
              <Select value={filter} onValueChange={(value: 'all' | 'persons' | 'faces' | 'both') => setFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({batchData.results.length})</SelectItem>
                  <SelectItem value="persons">Persons Only</SelectItem>
                  <SelectItem value="faces">Faces Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Sort:</label>
              <Select value={sortOrder} onValueChange={(value: 'time' | 'detections') => setSortOrder(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="detections">Detections</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto text-sm text-muted-foreground">
              Showing {sortedResults.length} of {batchData.results.length} images
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Detection Results</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No results match the current filter
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedResults.map((result, index) => (
                <div
                  key={result.filename}
                  className="relative group cursor-pointer border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedImageIndex(index);
                    setIsImageDialogOpen(true);
                  }}
                >
                  <div className="aspect-video bg-gray-100 relative">
                    <img
                      src={`/events/${result.filename}`}
                      alt={result.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Detection overlay badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {result.persons.length > 0 && (
                        <Badge variant="secondary" className="bg-green-500 text-white">
                          <User className="h-3 w-3 mr-1" />
                          {result.persons.length}
                        </Badge>
                      )}
                      {result.faces.length > 0 && (
                        <Badge variant="secondary" className="bg-blue-500 text-white">
                          <UserCheck className="h-3 w-3 mr-1" />
                          {result.faces.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <div className="text-sm font-medium truncate">{result.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(result.timestamp), 'MMM dd, HH:mm')} • {result.cameraId}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs">
                      {result.persons.length > 0 && (
                        <span className="text-green-600">
                          {result.persons.length} persons
                        </span>
                      )}
                      {result.faces.length > 0 && (
                        <span className="text-blue-600">
                          {result.faces.filter(f => f.isKnown).length} known, {result.faces.filter(f => !f.isKnown).length} unknown
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Detail Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detection Details</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadImage(`/events/${currentImage?.filename}`, currentImage?.filename || '')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                  disabled={selectedImageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedImageIndex(Math.min(sortedResults.length - 1, selectedImageIndex + 1))}
                  disabled={selectedImageIndex === sortedResults.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {currentImage && (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  ref={imageRef}
                  src={`/events/${currentImage.filename}`}
                  alt={currentImage.filename}
                  className="max-w-full h-auto"
                />
                {renderBoundingBoxes()}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Image Info</h4>
                  <div className="space-y-1 text-sm">
                    <div>Filename: {currentImage.filename}</div>
                    <div>Camera: {currentImage.cameraId}</div>
                    <div>Time: {format(new Date(currentImage.timestamp), 'PPpp')}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Detections</h4>
                  <div className="space-y-2 text-sm">
                    {currentImage.persons.length > 0 && (
                      <div>
                        <div className="font-medium text-green-600">Persons ({currentImage.persons.length})</div>
                        {currentImage.persons.map((person, index) => (
                          <div key={index} className="ml-2 text-xs">
                            Person {index + 1}: {Math.round(person.confidence * 100)}% confidence
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {currentImage.faces.length > 0 && (
                      <div>
                        <div className="font-medium text-blue-600">Faces ({currentImage.faces.length})</div>
                        {currentImage.faces.map((face, index) => (
                          <div key={index} className="ml-2 text-xs">
                            {face.isKnown ? face.personName || 'Known Person' : 'Unknown Face'}: {Math.round(face.confidence * 100)}% confidence
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {currentImage.persons.length === 0 && currentImage.faces.length === 0 && (
                      <div className="text-muted-foreground">No detections</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchResultViewer;