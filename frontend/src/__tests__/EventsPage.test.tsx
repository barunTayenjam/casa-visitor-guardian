import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventsPage from '@/pages/EventsPage';

// --- Component mocks ---
jest.mock('@/components/events/SmartFilters', () => ({
  SmartFilters: () => <div data-testid="smart-filters" />,
}));
jest.mock('@/components/events/EventTimeline', () => ({
  EventTimeline: () => <div data-testid="event-timeline" />,
}));
jest.mock('@/components/events/EventDetailPanel', () => ({
  EventDetailPanel: () => <div data-testid="event-detail-panel" />,
}));
jest.mock('@/components/events/RelatedEvents', () => ({
  RelatedEvents: () => <div data-testid="related-events" />,
}));
jest.mock('@/components/ui/ProgressiveImage', () => ({
  ProgressiveImage: () => <div data-testid="progressive-image" />,
}));
jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));
jest.mock('@/components/ui/pagination', () => ({
  Pagination: () => <div data-testid="pagination" />,
  PaginationContent: () => <div data-testid="pagination-content" />,
  PaginationItem: () => <div data-testid="pagination-item" />,
  PaginationPrevious: () => <button data-testid="pagination-previous" />,
  PaginationNext: () => <button data-testid="pagination-next" />,
  PaginationLink: () => <button data-testid="pagination-link" />,
}));

// --- Service mocks ---
jest.mock('@/services/api/eventService', () => ({
  eventService: {
    getEnhancedEventsList: jest.fn(),
    getDailyStats: jest.fn(),
    archiveEvent: jest.fn(),
  },
}));
jest.mock('@/services/api/detectionService', () => ({
  detectionService: {
    analyzeEvent: jest.fn(),
    analyzeEventWithBboxes: jest.fn(),
  },
}));
jest.mock('@/services/api/systemService', () => ({
  systemService: {
    getDaySummary: jest.fn().mockResolvedValue({ success: true, summary: {} }),
    getTimelapses: jest.fn().mockResolvedValue({ success: true, timelapses: [] }),
  },
}));

// --- Context mocks ---
jest.mock('@/contexts/CameraContext', () => ({
  useCameras: () => ({
    cameras: [
      { id: 'cam-1', name: 'Front Door' },
      { id: 'cam-2', name: 'Back Yard' },
    ],
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { eventService } from '@/services/api/eventService';

const mockEvents = [
  {
    id: 'evt-1',
    cameraId: 'cam-1',
    cameraName: 'Front Door',
    timestamp: '2026-08-14T10:00:00Z',
    imageUrl: '/evt1.jpg',
    confidence: 0.95,
    event_type: 'person',
    severity: 'info',
    persons_detected: 1,
    faces_detected: 0,
    known_faces_count: 0,
    unknown_faces_count: 0,
  },
  {
    id: 'evt-2',
    cameraId: 'cam-2',
    cameraName: 'Back Yard',
    timestamp: '2026-08-13T22:30:00Z',
    imageUrl: '/evt2.jpg',
    confidence: 0.80,
    event_type: 'motion',
    severity: 'alert',
    persons_detected: 0,
    faces_detected: 1,
    known_faces_count: 1,
    unknown_faces_count: 0,
  },
];

const defaultListResponse = {
  events: mockEvents,
  pagination: { totalPages: 2, totalEvents: 25 },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <EventsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (eventService.getEnhancedEventsList as jest.Mock).mockResolvedValue(defaultListResponse);
  (eventService.getDailyStats as jest.Mock).mockResolvedValue(3);
});

describe('EventsPage', () => {
  it('renders correctly', async () => {
    renderPage();
    await waitFor(() => {
        expect(screen.getByText('Events')).toBeInTheDocument();
    });
    await waitFor(() => {
        expect(screen.queryByTestId('skeleton-card')).not.toBeInTheDocument();
    });
  });

  it('renders empty state', async () => {
    (eventService.getEnhancedEventsList as jest.Mock).mockResolvedValue({
      events: [],
      pagination: { totalPages: 1, totalEvents: 0 },
    });
    renderPage();
    const empty = await screen.findByTestId('empty-state-wrapper');
    expect(empty).toBeInTheDocument();
  });
});
