import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Clock, 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  TrendingUp, 
  Download,
  Search,
  Filter,
  Eye,
  Camera,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface Visitor {
  id: string;
  name?: string;
  type: 'known' | 'unknown';
  firstSeen: Date;
  lastSeen: Date;
  duration: number;
  cameraIds: string[];
  photos: string[];
  confidence: number;
  visitCount: number;
  lastSeenTimestamp: number;
}

interface VisitorTimeline {
  date: string;
  visitors: Visitor[];
  summary: {
    totalVisitors: number;
    knownVisitors: number;
    unknownVisitors: number;
    totalDuration: number;
    averageVisitDuration: number;
    peakHours: Array<{ hour: number; count: number }>;
    cameras: Array<{ cameraId: string; count: number }>;
  };
}

const VisitorTimeline: React.FC = () => {
  const [originalTimeline, setOriginalTimeline] = useState<VisitorTimeline[]>([]);
  const [timeline, setTimeline] = useState<VisitorTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [visitorTypeFilter, setVisitorTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

  const loadVisitorTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: endDate,
        ...(cameraFilter !== 'all' && { cameraId: cameraFilter }),
        ...(visitorTypeFilter !== 'all' && { visitorType: visitorTypeFilter })
      });

      const response = await fetch(`/api/visitors/timeline?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to load visitor timeline');
      }

      const data = await response.json();
      
      if (data.success) {
        setOriginalTimeline(data.data.timeline);
      }

    } catch (err) {
      console.error('Error loading visitor timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to load visitor timeline');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, endDate, cameraFilter, visitorTypeFilter]);

  useEffect(() => {
    loadVisitorTimeline();
  }, [selectedDate, endDate, cameraFilter, visitorTypeFilter, loadVisitorTimeline]);

  // Handle search filtering and other client-side filtering
  useEffect(() => {
    let filteredTimeline = [...originalTimeline];
    
    // Apply search filter if needed
    if (searchQuery.trim()) {
      filteredTimeline = filteredTimeline.map((day: VisitorTimeline) => ({
        ...day,
        visitors: day.visitors.filter(visitor =>
          visitor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          visitor.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter((day: VisitorTimeline) => day.visitors.length > 0);
    }
    
    setTimeline(filteredTimeline);
  }, [originalTimeline, searchQuery]);

  const toggleDateExpansion = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const handleVisitorClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
  };

  const getUniqueCameras = (): string[] => {
    const cameras = new Set<string>();
    timeline.forEach(day => {
      day.summary.cameras.forEach(camera => {
        cameras.add(camera.cameraId);
      });
    });
    return Array.from(cameras).sort();
  };

  const getVisitorTypeIcon = (type: 'known' | 'unknown') => {
    return type === 'known' 
      ? <UserCheck className="h-4 w-4 text-green-600" />
      : <UserX className="h-4 w-4 text-red-600" />;
  };

  const getVisitorTypeColor = (type: 'known' | 'unknown') => {
    return type === 'known' 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const getCameraDistribution = (cameras: Array<{ cameraId: string; count: number }>) => {
    const totalCount = cameras.reduce((sum, camera) => sum + camera.count, 0);
    return cameras.map(camera => ({
      ...camera,
      percentage: totalCount > 0 ? Math.round((camera.count / totalCount) * 100) : 0
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Failed to load visitor timeline</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={loadVisitorTimeline}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Visitor Timeline</h1>
            <p className="text-gray-600 mt-2">Detailed chronological view of all visitor activity</p>
          </div>
          
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => {
              // Export timeline data
              const dataStr = JSON.stringify(timeline, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `visitor_timeline_${selectedDate}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="cameraFilter">Camera</Label>
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All cameras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cameras</SelectItem>
                    {getUniqueCameras().map(camera => (
                      <SelectItem key={camera} value={camera}>{camera}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="visitorTypeFilter">Visitor Type</Label>
                <Select value={visitorTypeFilter} onValueChange={setVisitorTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All visitors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visitors</SelectItem>
                    <SelectItem value="known">Known Visitors</SelectItem>
                    <SelectItem value="unknown">Unknown Visitors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="searchQuery">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="searchQuery"
                  type="text"
                  placeholder="Search by name or visitor ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {timeline.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                {searchQuery.trim() ? (
                  <>
                    <p>No visitors match your search: "{searchQuery}"</p>
                    <p className="text-sm mt-2">Try adjusting your search term</p>
                  </>
                ) : (
                  <>
                    <p>No visitor activity found for the selected period</p>
                    <p className="text-sm mt-2">Try adjusting the filters or date range</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {timeline.map((day, dayIndex) => (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIndex * 0.1 }}
              >
                <Card>
                  <CardHeader 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleDateExpansion(day.date)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                          </CardTitle>
                          <CardDescription>
                            {day.summary.totalVisitors} visitors • 
                            {day.summary.knownVisitors} known • 
                            {day.summary.unknownVisitors} unknown • 
                            Avg duration: {formatDuration(day.summary.averageVisitDuration)}
                          </CardDescription>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <div className="text-sm text-gray-500">Peak hour</div>
                          <div className="font-medium">
                            {day.summary.peakHours.length > 0 
                              ? `${day.summary.peakHours.reduce((a, b) => a.count > b.count ? a : b).hour}:00`
                              : 'N/A'
                            }
                          </div>
                        </div>
                        
                        <motion.div
                          animate={{ rotate: expandedDates.has(day.date) ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <AnimatePresence>
                    {expandedDates.has(day.date) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="border-t">
                          {/* Camera Distribution */}
                          {day.summary.cameras.length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Camera className="h-4 w-4" />
                                Camera Activity
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {getCameraDistribution(day.summary.cameras).map(camera => (
                                  <div key={camera.cameraId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                      <Camera className="h-3 w-3 text-gray-600" />
                                      <span className="text-sm font-medium">{camera.cameraId}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">{camera.count}</span>
                                      <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                        <div
                                          className="bg-blue-500 h-1.5 rounded-full"
                                          style={{ width: `${camera.percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Hourly Peak Activity */}
                          {day.summary.peakHours.length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Peak Activity Hours
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {day.summary.peakHours
                                  .sort((a, b) => b.count - a.count)
                                  .slice(0, 6)
                                  .map(hour => (
                                    <Badge key={hour.hour} variant="outline">
                                      {hour.hour}:00 ({hour.count})
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Visitor List */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Visitors ({day.visitors.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {day.visitors.map((visitor, visitorIndex) => (
                                <motion.div
                                  key={visitor.id}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: visitorIndex * 0.05 }}
                                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => handleVisitorClick(visitor)}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                        {getVisitorTypeIcon(visitor.type)}
                                      </div>
                                      <div>
                                        <p className="font-medium">
                                          {visitor.name || `Unknown Visitor #${visitorIndex + 1}`}
                                        </p>
                                        <p className="text-xs text-gray-500">ID: {visitor.id}</p>
                                      </div>
                                    </div>
                                    
                                    <Badge className={getVisitorTypeColor(visitor.type)} variant="outline">
                                      {visitor.type}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      <span>Duration: {formatDuration(visitor.duration)}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3 w-3 text-gray-400" />
                                      <span>
                                        {visitor.cameraIds.slice(0, 2).join(', ')}
                                        {visitor.cameraIds.length > 2 && ` +${visitor.cameraIds.length - 2}`}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <Users className="h-3 w-3 text-gray-400" />
                                      <span>{visitor.visitCount} visit{visitor.visitCount !== 1 ? 's' : ''}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs text-gray-500">
                                        Last: {format(new Date(visitor.lastSeen), 'h:mm a')}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {visitor.photos.length > 0 && (
                                    <div className="mt-3 flex gap-1">
                                      {visitor.photos.slice(0, 3).map((photo, index) => (
                                        <img
                                          key={index}
                                          src={`/api/events/image/${photo.split('/').pop()}`}
                                          alt={`Visitor photo ${index + 1}`}
                                          className="w-12 h-12 object-cover rounded border"
                                          onError={(e) => {
                                            // Don't try to load another image to prevent infinite loops
                                            e.target.style.backgroundColor = '#f3f4f6';
                                            e.target.style.display = 'flex';
                                            e.target.style.alignItems = 'center';
                                            e.target.style.justifyContent = 'center';
                                            e.target.textContent = '📷';
                                          }}
                                        />
                                      ))}
                                      {visitor.photos.length > 3 && (
                                        <div className="w-12 h-12 bg-gray-200 rounded border flex items-center justify-center text-xs text-gray-600">
                                          +{visitor.photos.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Visitor Detail Modal */}
        <AnimatePresence>
          {selectedVisitor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setSelectedVisitor(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedVisitor.name || 'Unknown Visitor'} Details
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedVisitor(null)}
                  >
                    ×
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      {getVisitorTypeIcon(selectedVisitor.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-lg">
                        {selectedVisitor.name || 'Unknown Visitor'}
                      </h4>
                      <p className="text-gray-600">Visitor ID: {selectedVisitor.id}</p>
                      <Badge className={getVisitorTypeColor(selectedVisitor.type)}>
                        {selectedVisitor.type}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Seen</Label>
                      <p className="text-sm">{format(new Date(selectedVisitor.firstSeen), 'PPP p')}</p>
                    </div>
                    <div>
                      <Label>Last Seen</Label>
                      <p className="text-sm">{format(new Date(selectedVisitor.lastSeen), 'PPP p')}</p>
                    </div>
                    <div>
                      <Label>Total Visit Duration</Label>
                      <p className="text-sm">{formatDuration(selectedVisitor.duration)}</p>
                    </div>
                    <div>
                      <Label>Number of Visits</Label>
                      <p className="text-sm">{selectedVisitor.visitCount}</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Cameras Detected</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedVisitor.cameraIds.map(camera => (
                        <Badge key={camera} variant="outline">
                          <Camera className="h-3 w-3 mr-1" />
                          {camera}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {selectedVisitor.photos.length > 0 && (
                    <div>
                      <Label>Detection Photos ({selectedVisitor.photos.length})</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {selectedVisitor.photos.map((photo, index) => (
                          <img
                            key={index}
                            src={`/api/events/image/${photo.split('/').pop()}`}
                            alt={`Detection photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded border"
                            onError={(e) => {
                              // Don't try to load another image to prevent infinite loops
                              e.target.style.backgroundColor = '#f3f4f6';
                              e.target.style.display = 'flex';
                              e.target.style.alignItems = 'center';
                              e.target.style.justifyContent = 'center';
                              e.target.textContent = '📷';
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label>Detection Confidence</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.round(selectedVisitor.confidence * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round(selectedVisitor.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VisitorTimeline;