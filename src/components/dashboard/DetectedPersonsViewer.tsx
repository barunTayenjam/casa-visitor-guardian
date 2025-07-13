import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Eye,
  Trash2,
  Download,
  Filter,
  Calendar,
  Camera,
  TrendingUp,
  RefreshCw,
  Search,
  Grid,
  List,
  Loader2
} from 'lucide-react';

interface DetectedPerson {
  filename: string;
  imagePath: string;
  cameraId: string;
  confidence: number;
  timestamp: string;
  detectionDate: string;
  boundingBox: number[] | null;
  personIndex: number;
  fileSize: number;
  metadata: any;
}

interface DetectedPersonsStats {
  totalPersons: number;
  totalSize: number;
  cameras: string[];
  confidenceDistribution: { [key: string]: number };
}

const DetectedPersonsViewer = () => {
  const { toast } = useToast();
  
  const [persons, setPersons] = useState<DetectedPerson[]>([]);
  const [stats, setStats] = useState<DetectedPersonsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPersons, setTotalPersons] = useState(0);
  const pageSize = 20;

  // Load detected persons
  const loadDetectedPersons = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (cameraFilter && cameraFilter !== 'all') {
        params.append('cameraId', cameraFilter);
      }
      if (minConfidence > 0) {
        params.append('minConfidence', minConfidence.toString());
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/detected-persons?${params}`);
      const data = await response.json();

      if (data.success) {
        setPersons(data.persons);
        setTotalPages(data.pagination.totalPages);
        setTotalPersons(data.pagination.totalPersons);
      } else {
        toast({
          title: "Error",
          description: "Failed to load detected persons",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading detected persons:', error);
      toast({
        title: "Error",
        description: "Failed to load detected persons",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/detected-persons/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Delete person image
  const deletePerson = async (filename: string) => {
    try {
      const response = await fetch(`/api/detected-persons/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Person image deleted successfully",
        });
        loadDetectedPersons();
        loadStats();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete person image",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting person:', error);
      toast({
        title: "Error",
        description: "Failed to delete person image",
        variant: "destructive",
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    loadDetectedPersons();
  }, [currentPage, cameraFilter, minConfidence, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalPersons}</p>
                  <p className="text-xs text-muted-foreground">Total Persons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.cameras.length}</p>
                  <p className="text-xs text-muted-foreground">Cameras</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Download className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
                  <p className="text-xs text-muted-foreground">Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {Object.keys(stats.confidenceDistribution).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Confidence Ranges</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Viewer Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Detected Persons
              </CardTitle>
              <CardDescription>
                Browse and manage detected person images from batch processing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadDetectedPersons();
                  loadStats();
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label>Camera</Label>
              <Select value={cameraFilter} onValueChange={setCameraFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All cameras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cameras</SelectItem>
                  {stats?.cameras.map((camera) => (
                    <SelectItem key={camera} value={camera}>
                      {camera}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Min Confidence</Label>
              <Select value={minConfidence.toString()} onValueChange={(value) => setMinConfidence(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Any confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any confidence</SelectItem>
                  <SelectItem value="50">50%+</SelectItem>
                  <SelectItem value="60">60%+</SelectItem>
                  <SelectItem value="70">70%+</SelectItem>
                  <SelectItem value="80">80%+</SelectItem>
                  <SelectItem value="90">90%+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={() => {
                  setCameraFilter('all');
                  setMinConfidence(0);
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading detected persons...</span>
            </div>
          ) : persons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No detected persons found</p>
              <p className="text-sm">Try adjusting your filters or run batch detection first</p>
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {persons.length} of {totalPersons} detected persons
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {/* Grid View */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {persons.map((person) => (
                    <Card key={person.filename} className="overflow-hidden">
                      <div className="aspect-square relative">
                        <img
                          src={person.imagePath}
                          alt={`Person detected in ${person.cameraId}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                          }}
                        />
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary">
                            {person.confidence}%
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{person.cameraId}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePerson(person.filename)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(person.detectionDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(person.fileSize)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
                  {persons.map((person) => (
                    <Card key={person.filename}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 flex-shrink-0">
                            <img
                              src={person.imagePath}
                              alt={`Person detected in ${person.cameraId}`}
                              className="w-full h-full object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                              }}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{person.cameraId}</Badge>
                              <Badge variant="secondary">{person.confidence}%</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(person.detectionDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {person.filename} • {formatFileSize(person.fileSize)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePerson(person.filename)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DetectedPersonsViewer;