import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Filter, Download, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import ApiService from '@/services/ApiService';

interface ProcessedImage {
  id: string;
  jobId: string;
  filename: string;
  filePath: string;
  cameraId: string;
  timestamp: string;
  personCount: number;
  faceCount: number;
  knownFaceCount: number;
  unknownFaceCount: number;
  status: string;
  detections: {
    persons: Array<{
      class: string;
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
    faces: Array<{
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
      personName?: string;
      isKnown: boolean;
    }>;
    detected_at: string;
    detection_types: string[];
  };
  processedAt: string;
  imageUrl: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function BatchResultsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterObject, setFilterObject] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  
  const pageSize = 20;

  useEffect(() => {
    if (jobId) {
      loadImages();
    } else {
      if (filterObject === 'all') {
        loadAllJobs();
      } else {
        // When filtering without a jobId, load all images and filter client-side
        loadAllImagesFiltered();
      }
    }
  }, [jobId, currentPage, filterObject]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const offset = currentPage * pageSize;
      const params: any = { limit: pageSize, offset };
      
      if (jobId) {
        params.jobId = jobId;
      }
      
      if (filterObject !== 'all') {
        params.objectClass = filterObject;
      }
      
      const response = await fetch(`/api/batch/processed-images?${new URLSearchParams(params)}`);
      const data = await response.json();
      
      if (data.success) {
        setImages(data.images);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/batch/jobs');
      const data = await response.json();
      
      if (data.success) {
        const completedJobs = data.jobs.filter((job: any) => job.status === 'completed');
        // Convert jobs to image-like format for display
        const jobImages = completedJobs.map((job: any) => ({
          id: job.id,
          jobId: job.id,
          filename: `Batch Job - ${new Date(job.startTime).toLocaleDateString()}`,
          filePath: '',
          cameraId: 'all',
          timestamp: job.startTime,
          personCount: job.progress?.successful || 0,
          faceCount: 0,
          knownFaceCount: 0,
          unknownFaceCount: 0,
          status: job.status,
          detections: { persons: [], faces: [], detection_types: [] },
          processedAt: job.endTime || job.startTime,
          imageUrl: '',
          isJobSummary: true,
          totalImages: job.progress?.total || 0,
          successfulImages: job.progress?.successful || 0
        }));
        setImages(jobImages);
        setPagination({
          total: jobImages.length,
          limit: pageSize,
          offset: 0,
          hasMore: false
        });
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = images.filter(img => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      img.filename.toLowerCase().includes(search) ||
      img.cameraId.toLowerCase().includes(search) ||
      img.detections?.persons?.some((p: any) => p.class?.toLowerCase().includes(search)) ||
      img.detections?.faces?.some((f: any) => f.personName?.toLowerCase().includes(search))
    );
  });

  const getImageWithBoxes = (image: ProcessedImage) => {
    if (!image.detections) return image.imageUrl;
    
    const hasObjects = image.detections.persons?.length > 0 || image.detections.faces?.length > 0;
    if (!hasObjects) return image.imageUrl;
    
    return image.imageUrl; 
  };

  const getClassColor = (className: string) => {
    const colors: Record<string, string> = {
      person: 'bg-blue-500',
      car: 'bg-green-500',
      truck: 'bg-green-600',
      motorcycle: 'bg-purple-500',
      bicycle: 'bg-purple-600',
      dog: 'bg-orange-500',
      cat: 'bg-orange-600',
      bird: 'bg-yellow-500',
      face: 'bg-pink-500',
      default: 'bg-gray-500'
    };
    return colors[className] || colors.default;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        title={jobId ? 'Batch Detection Results' : 'Batch Detection History'}
        subtitle={
          jobId
            ? `${pagination?.total || 0} images processed • Job: ${jobId}`
            : `${pagination?.total || 0} completed batch jobs`
        }
        backTo="/app/batch-detection"
        size="large"
        actions={
          <Button variant="outline" onClick={() => jobId ? loadImages() : loadAllJobs()}>
            <Filter className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Images" value={pagination?.total || 0} />
        <StatCard
          label="With Detections"
          value={images.filter(i => i.personCount > 0 || i.faceCount > 0).length}
          iconColor="text-green-500"
        />
        <StatCard
          label="Persons Detected"
          value={images.reduce((sum, i) => sum + i.personCount, 0)}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Faces Detected"
          value={images.reduce((sum, i) => sum + i.faceCount, 0)}
          iconColor="text-purple-500"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={filterObject} onValueChange={setFilterObject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by object" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Objects</SelectItem>
                  <SelectItem value="person">Persons</SelectItem>
                  <SelectItem value="car">Cars</SelectItem>
                  <SelectItem value="truck">Trucks</SelectItem>
                  <SelectItem value="dog">Dogs</SelectItem>
                  <SelectItem value="cat">Cats</SelectItem>
                  <SelectItem value="face">Faces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No images found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredImages.map((image) => (
                <Card 
                  key={image.id} 
                  className="overflow-hidden hover:shadow-lg transition cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="relative aspect-video bg-muted">
                    <img
                      src={getImageWithBoxes(image)}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {image.personCount > 0 && (
                      <Badge className="absolute top-2 left-2 bg-blue-500">
                        {image.personCount} objects
                      </Badge>
                    )}
                    {image.faceCount > 0 && (
                      <Badge className="absolute top-2 right-2 bg-pink-500">
                        {image.faceCount} faces
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium truncate">{image.filename}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {image.cameraId} • {new Date(image.timestamp).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {image.detections?.detection_types?.slice(0, 3).map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {pagination && pagination.total > pageSize && (
            <div className="flex items-center justify-center gap-2 mt-6" role="navigation" aria-label="Pagination">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                Page {currentPage + 1} of {Math.ceil(pagination.total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!pagination.hasMore}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImage(null)}>
          <div className="bg-background rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedImage.filename}</h2>
              <Button variant="outline" size="sm" onClick={() => setSelectedImage(null)}>
                Close
              </Button>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.filename}
                  className="w-full rounded-lg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="font-semibold mb-2">Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Camera:</span> {selectedImage.cameraId}</p>
                    <p><span className="font-medium">Timestamp:</span> {new Date(selectedImage.timestamp).toLocaleString()}</p>
                    <p><span className="font-medium">Processed:</span> {new Date(selectedImage.processedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Detections</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Persons:</span> {selectedImage.personCount}</p>
                    <p><span className="font-medium">Faces:</span> {selectedImage.faceCount}</p>
                    <p><span className="font-medium">Known Faces:</span> {selectedImage.knownFaceCount}</p>
                    <p><span className="font-medium">Unknown Faces:</span> {selectedImage.unknownFaceCount}</p>
                  </div>
                </div>
              </div>

              {selectedImage.detections?.persons && selectedImage.detections.persons.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Detected Objects ({selectedImage.detections.persons.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedImage.detections.persons.map((obj, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getClassColor(obj.class)}>
                              {obj.class}
                            </Badge>
                            <span className="text-sm font-medium">{(obj.confidence * 100).toFixed(1)}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>Position: ({obj.bbox.x.toFixed(0)}, {obj.bbox.y.toFixed(0)})</p>
                            <p>Size: {obj.bbox.width.toFixed(0)} × {obj.bbox.height.toFixed(0)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedImage.detections?.faces && selectedImage.detections.faces.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Detected Faces ({selectedImage.detections.faces.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedImage.detections.faces.map((face, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={face.isKnown ? "default" : "secondary"}>
                              {face.isKnown ? face.personName || "Known" : "Unknown"}
                            </Badge>
                            <span className="text-sm font-medium">{(face.confidence * 100).toFixed(1)}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>Position: ({face.bbox.x.toFixed(0)}, {face.bbox.y.toFixed(0)})</p>
                            <p>Size: {face.bbox.width.toFixed(0)} × {face.bbox.height.toFixed(0)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}