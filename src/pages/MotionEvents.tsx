import React, { useState, useEffect, useCallback } from 'react';
import { EventGrid } from '@/components/dashboard/EventGrid';
import { useToast } from '@/hooks/use-toast';
import apiService, { ApiError } from '@/services/ApiService';
import { MotionEvent } from '@/types/security';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  X,
  Search,
  Calendar as CalendarIcon,
  Camera as CameraIcon,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ScanSearch // Added for the new button
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCameras } from '@/contexts/CameraContext';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';


import { TabletEventViewer } from '@/components/dashboard/TabletEventViewer';

const MotionEvents = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [scanning, setScanning] = useState(false); // New state for scanning

  const loadEvents = useCallback(async () => {
    console.log('Loading events for MotionEvents page...');
    setLoading(true);
    try {
      const response = await apiService.getHistoricalEvents({
        page: currentPage,
        pageSize: 20, // Increased to show more events
        cameraId: selectedCamera === 'all' ? undefined : selectedCamera,
        searchQuery: searchQuery || undefined,
        startDate: selectedDate || undefined,
        endDate: selectedDate ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined, // End of selected day
      });
      console.log("Fetched motion events:", response.events); // Add logging
      setEvents(response.events);
      setTotalPages(response.pagination.totalPages);
      setTotalEvents(response.pagination.totalEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: 'Error',
        description: `Failed to load motion events: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: 'destructive',
      });
      setEvents([]);
      setTotalPages(1);
      setTotalEvents(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCamera, searchQuery, selectedDate, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleArchiveEvent = async (eventId: string) => {
    if (window.confirm("Are you sure you want to archive this event?")) {
      try {
        await apiService.archiveEvent(eventId);
        toast({
          title: "Event Archived",
          description: "The motion event has been archived.",
        });
        loadEvents(); // Refresh the list after archiving
      } catch (error) {
        console.error(`Failed to archive event ${eventId}:`, error);
        toast({
          title: "Error",
          description: `Failed to archive event: ${error instanceof ApiError ? error.message : String(error)}`,
          variant: "destructive",
        });
      }
    }
  };

  const downloadImage = (event: MotionEvent) => {
    if (!event.imageUrl) {
      toast({
        title: "Download Failed",
        description: "No image available for this event",
        variant: "destructive"
      });
      return;
    }
    const link = document.createElement('a');
    link.href = event.imageUrl;
    link.download = `motion_${event.cameraName || event.cameraId}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScanSnapshots = async () => {
    setScanning(true);
    try {
      // You can pass options here if you want to customize batch detection
      const { jobId } = await apiService.scanSnapshotsForPersons({});
      toast({
        title: "Scan Initiated",
        description: `Scanning of past snapshots for persons has been initiated. Job ID: ${jobId}`,
      });
    } catch (error) {
      console.error('Failed to scan snapshots for persons:', error);
      toast({
        title: "Error",
        description: `Failed to scan snapshots for persons: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  // Filter and sort events (now done by backend, but keeping for client-side if needed)
  const sortedEvents = [...events].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.timestamp.getTime() - a.timestamp.getTime();
      case 'oldest':
        return a.timestamp.getTime() - b.timestamp.getTime();
      case 'confidence':
        return b.confidence - a.confidence;
      default:
        return 0;
    }
  });

  // Calculate statistics
  const todayEvents = events.filter(event => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return event.timestamp >= today;
  }).length;

  const highConfidenceEvents = events.filter(event => event.confidence > 0.8).length;
  const uniqueCameras = new Set(events.map(event => event.cameraName)).size;

  const uniqueCameraNames = [...new Set(cameras.map(cam => cam.name))];

  return (
    <div className="h-full">
      <TabletEventViewer />
    </div>
  );
};

export default MotionEvents;
