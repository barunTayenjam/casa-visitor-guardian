import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft,
  Calendar, 
  Clock, 
  Users, 
  UserCheck, 
  UserX, 
  Download,
  Search,
  Filter,
  Eye,
  Camera,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { colors } from '@/styles/design-tokens';

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

const VisitorTimeline = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    let filteredTimeline = [...originalTimeline];
    
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
      ? <UserCheck className="h-4 w-4" style={{ color: colors.status.success }} />
      : <UserX className="h-4 w-4" style={{ color: colors.status.error }} />;
  };

  const getVisitorTypeColor = (type: 'known' | 'unknown') => {
    return type === 'known' 
      ? { backgroundColor: `${colors.status.success}20`, color: colors.status.success, borderColor: colors.status.success }
      : { backgroundColor: `${colors.status.error}20`, color: colors.status.error, borderColor: colors.status.error };
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

  const totalVisitors = timeline.reduce((sum, day) => sum + day.summary.totalVisitors, 0);
  const totalKnownVisitors = timeline.reduce((sum, day) => sum + day.summary.knownVisitors, 0);
  const totalUnknownVisitors = timeline.reduce((sum, day) => sum + day.summary.unknownVisitors, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.background.primary }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.status.info }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.background.primary }}>
        <Card className="w-full max-w-md" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2" style={{ color: colors.status.error }}>Error</h3>
            <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>{error}</p>
            <Button onClick={loadVisitorTimeline} size="sm">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/streams')} className="hover:bg-white/5">
            <ArrowLeft className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold" style={{ color: colors.text.primary }}>Visitor Timeline</h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>Track visitor activity over time</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
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
          }} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Total Visitors</p>
                <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>{totalVisitors}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
                <Users className="h-5 w-5" style={{ color: colors.status.info }} />
              </div>
            </div>
          </Card>
          
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Known</p>
                <p className="text-2xl font-bold" style={{ color: colors.status.success }}>{totalKnownVisitors}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.success}15` }}>
                <UserCheck className="h-5 w-5" style={{ color: colors.status.success }} />
              </div>
            </div>
          </Card>
          
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Unknown</p>
                <p className="text-2xl font-bold" style={{ color: colors.status.error }}>{totalUnknownVisitors}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.error}15` }}>
                <UserX className="h-5 w-5" style={{ color: colors.status.error }} />
              </div>
            </div>
          </Card>
          
          <Card className="rounded-xl p-4" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>Days in Range</p>
                <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>{timeline.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.status.warning}15` }}>
                <Calendar className="h-5 w-5" style={{ color: colors.status.warning }} />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="rounded-xl" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <div className="p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" style={{ color: colors.text.secondary }} />
              <h3 className="font-semibold" style={{ color: colors.text.primary }}>Filters</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm" style={{ color: colors.text.secondary }}>Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="endDate" className="text-sm" style={{ color: colors.text.secondary }}>End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="cameraFilter" className="text-sm" style={{ color: colors.text.secondary }}>Camera</Label>
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger className="mt-1">
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
                <Label htmlFor="visitorTypeFilter" className="text-sm" style={{ color: colors.text.secondary }}>Visitor Type</Label>
                <Select value={visitorTypeFilter} onValueChange={setVisitorTypeFilter}>
                  <SelectTrigger className="mt-1">
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
            
            <div>
              <Label htmlFor="searchQuery" className="text-sm" style={{ color: colors.text.secondary }}>Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: colors.text.muted }} />
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
          </div>
        </Card>

        {/* Timeline */}
        {timeline.length === 0 ? (
          <Card className="rounded-xl" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="p-12 text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" style={{ color: colors.text.primary }} />
              <p className="text-lg mb-2" style={{ color: colors.text.primary }}>
                {searchQuery.trim() ? `No visitors match "${searchQuery}"` : 'No visitor activity found'}
              </p>
              <p className="text-sm" style={{ color: colors.text.muted }}>
                {searchQuery.trim() ? 'Try adjusting your search term' : 'Try adjusting the date range or filters'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {timeline.map((day, dayIndex) => (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIndex * 0.05 }}
              >
                <Card className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div 
                    className="cursor-pointer transition-colors p-4 md:p-6 flex items-center justify-between"
                    style={{ 
                      borderBottom: expandedDates.has(day.date) ? `1px solid ${colors.border.subtle}` : 'none',
                    }}
                    onClick={() => toggleDateExpansion(day.date)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
                        <Calendar className="h-6 w-6" style={{ color: colors.status.info }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                          {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        <p className="text-sm" style={{ color: colors.text.muted }}>
                          {day.summary.totalVisitors} visitors • {day.summary.knownVisitors} known • {day.summary.unknownVisitors} unknown
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs" style={{ color: colors.text.muted }}>Avg duration</p>
                        <p className="font-medium" style={{ color: colors.text.primary }}>{formatDuration(day.summary.averageVisitDuration)}</p>
                      </div>
                      
                      <motion.div
                        animate={{ rotate: expandedDates.has(day.date) ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" style={{ color: colors.text.secondary }} />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedDates.has(day.date) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 md:p-6 space-y-6">
                          {/* Camera Distribution */}
                          {day.summary.cameras.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text.primary }}>
                                <Camera className="h-4 w-4" />
                                Camera Activity
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {getCameraDistribution(day.summary.cameras).map(camera => (
                                  <div key={camera.cameraId} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                                    <div className="flex items-center gap-2">
                                      <Camera className="h-3 w-3" style={{ color: colors.text.secondary }} />
                                      <span className="text-sm font-medium" style={{ color: colors.text.primary }}>{camera.cameraId}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm" style={{ color: colors.text.secondary }}>{camera.count}</span>
                                      <div className="w-16 rounded-full h-1.5" style={{ backgroundColor: colors.border.subtle }}>
                                        <div
                                          className="h-1.5 rounded-full"
                                          style={{ width: `${camera.percentage}%`, backgroundColor: colors.status.info }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Peak Hours */}
                          {day.summary.peakHours.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text.primary }}>
                                <Clock className="h-4 w-4" />
                                Peak Activity Hours
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {day.summary.peakHours
                                  .sort((a, b) => b.count - a.count)
                                  .slice(0, 8)
                                  .map(hour => (
                                    <Badge key={hour.hour} variant="outline" className="gap-1" style={{ borderColor: colors.border.default }}>
                                      {hour.hour}:00 <span style={{ color: colors.text.muted }}>({hour.count})</span>
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Visitor List */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text.primary }}>
                              <Users className="h-4 w-4" />
                              Visitors ({day.visitors.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {day.visitors.map((visitor, visitorIndex) => (
                                <motion.div
                                  key={visitor.id}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: visitorIndex * 0.03 }}
                                  className="border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
                                  style={{ borderColor: colors.border.subtle, backgroundColor: colors.background.tertiary }}
                                  onClick={() => handleVisitorClick(visitor)}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.background.secondary }}>
                                        {getVisitorTypeIcon(visitor.type)}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm" style={{ color: colors.text.primary }}>
                                          {visitor.name || `Visitor #${visitorIndex + 1}`}
                                        </p>
                                        <p className="text-xs" style={{ color: colors.text.muted }}>ID: {visitor.id.slice(0, 8)}...</p>
                                      </div>
                                    </div>
                                    
                                    <Badge className="gap-1" variant="outline" style={getVisitorTypeColor(visitor.type)}>
                                      {getVisitorTypeIcon(visitor.type)}
                                      <span className="text-xs">{visitor.type}</span>
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3" style={{ color: colors.text.muted }} />
                                      <span style={{ color: colors.text.secondary }}>Duration: {formatDuration(visitor.duration)}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3 w-3" style={{ color: colors.text.muted }} />
                                      <span style={{ color: colors.text.secondary }}>
                                        {visitor.cameraIds.slice(0, 2).join(', ')}
                                        {visitor.cameraIds.length > 2 && ` +${visitor.cameraIds.length - 2}`}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <Users className="h-3 w-3" style={{ color: colors.text.muted }} />
                                      <span style={{ color: colors.text.secondary }}>{visitor.visitCount} visit{visitor.visitCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                  
                                  {visitor.photos.length > 0 && (
                                    <div className="mt-3 flex gap-1">
                                      {visitor.photos.slice(0, 3).map((photo, index) => (
                                        <div key={index} className="w-12 h-12 rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border.subtle}` }}>
                                          <img
                                            src={`/api/events/image/${photo.split('/').pop()}`}
                                            alt={`Visitor photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'flex';
                                              target.style.alignItems = 'center';
                                              target.style.justifyContent = 'center';
                                              target.style.backgroundColor = colors.background.tertiary;
                                              target.textContent = '📷';
                                            }}
                                          />
                                        </div>
                                      ))}
                                      {visitor.photos.length > 3 && (
                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: colors.background.tertiary, color: colors.text.secondary }}>
                                          +{visitor.photos.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Visitor Detail Modal */}
      <AnimatePresence>
        {selectedVisitor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedVisitor(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
              style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.subtle}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
                    {selectedVisitor.name || 'Unknown Visitor'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedVisitor(null)}
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.background.tertiary }}>
                      {getVisitorTypeIcon(selectedVisitor.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-lg" style={{ color: colors.text.primary }}>
                        {selectedVisitor.name || 'Unknown Visitor'}
                      </h4>
                      <p className="text-sm" style={{ color: colors.text.muted }}>ID: {selectedVisitor.id}</p>
                      <Badge className="mt-1" variant="outline" style={getVisitorTypeColor(selectedVisitor.type)}>
                        {selectedVisitor.type}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                      <p className="text-xs mb-1" style={{ color: colors.text.muted }}>First Seen</p>
                      <p className="text-sm" style={{ color: colors.text.primary }}>{format(new Date(selectedVisitor.firstSeen), 'PPP p')}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                      <p className="text-xs mb-1" style={{ color: colors.text.muted }}>Last Seen</p>
                      <p className="text-sm" style={{ color: colors.text.primary }}>{format(new Date(selectedVisitor.lastSeen), 'PPP p')}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                      <p className="text-xs mb-1" style={{ color: colors.text.muted }}>Total Duration</p>
                      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{formatDuration(selectedVisitor.duration)}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                      <p className="text-xs mb-1" style={{ color: colors.text.muted }}>Number of Visits</p>
                      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{selectedVisitor.visitCount}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background.tertiary }}>
                    <p className="text-xs mb-2" style={{ color: colors.text.muted }}>Cameras Detected</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVisitor.cameraIds.map(camera => (
                        <Badge key={camera} variant="outline" className="gap-1">
                          <Camera className="h-3 w-3" />
                          {camera}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {selectedVisitor.photos.length > 0 && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: colors.text.muted }}>Detection Photos ({selectedVisitor.photos.length})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedVisitor.photos.map((photo, index) => (
                          <div key={index} className="aspect-video rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border.subtle}` }}>
                            <img
                              src={`/api/events/image/${photo.split('/').pop()}`}
                              alt={`Detection photo ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'flex';
                                target.style.alignItems = 'center';
                                target.style.justifyContent = 'center';
                                target.style.backgroundColor = colors.background.tertiary;
                                target.textContent = '📷';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-xs mb-2" style={{ color: colors.text.muted }}>Detection Confidence</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-full h-2" style={{ backgroundColor: colors.border.subtle }}>
                        <div
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${selectedVisitor.confidence >= 1 ? Math.round(selectedVisitor.confidence) : Math.round(selectedVisitor.confidence * 100)}%`,
                            backgroundColor: colors.status.info
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                        {selectedVisitor.confidence >= 1 ? Math.round(selectedVisitor.confidence) : Math.round(selectedVisitor.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitorTimeline;
