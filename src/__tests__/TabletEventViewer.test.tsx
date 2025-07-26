import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabletEventViewer } from '@/components/dashboard/TabletEventViewer';
import { EventsProvider } from '@/contexts/EventsContext';

const mockEvents = [
  {
    id: 'event1',
    cameraId: 'cam1',
    cameraName: 'Front Door',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    imageUrl: '/events/test1.jpg',
    confidence: 0.85,
    labels: ['motion'],
    location: 'Front',
    duration: 5000,
    archived: false
  },
  {
    id: 'event2',
    cameraId: 'cam2',
    cameraName: 'Back Yard',
    timestamp: new Date('2024-01-01T11:00:00Z'),
    imageUrl: '/events/test2.jpg',
    confidence: 0.92,
    labels: ['person'],
    location: 'Back',
    duration: 3000,
    archived: false
  }
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <EventsProvider>
      {children}
    </EventsProvider>
  </BrowserRouter>
);

// Mock the useEvents hook
jest.mock('@/contexts/EventsContext', () => ({
  useEvents: () => ({
    events: mockEvents,
    loading: false,
    error: null,
    loadMoreEvents: jest.fn(),
    hasMore: false
  }),
  EventsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('TabletEventViewer', () => {
  it('renders filter buttons', () => {
    render(
      <TestWrapper>
        <TabletEventViewer />
      </TestWrapper>
    );
    
    expect(screen.getByText('All Events')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('displays event cards with proper information', () => {
    render(
      <TestWrapper>
        <TabletEventViewer />
      </TestWrapper>
    );
    
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('Back Yard')).toBeInTheDocument();
  });

  it('handles filter changes', () => {
    render(
      <TestWrapper>
        <TabletEventViewer />
      </TestWrapper>
    );
    
    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);
    
    // Should still show events (mocked data)
    expect(screen.getByText('Front Door')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    // Mock loading state
    jest.doMock('@/contexts/EventsContext', () => ({
      useEvents: () => ({
        events: [],
        loading: true,
        error: null,
        loadMoreEvents: jest.fn(),
        hasMore: false
      }),
      EventsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    }));

    render(
      <TestWrapper>
        <TabletEventViewer />
      </TestWrapper>
    );
    
    expect(screen.getByText('Loading Events...')).toBeInTheDocument();
  });

  it('handles event selection', () => {
    const onEventSelect = jest.fn();
    
    render(
      <TestWrapper>
        <TabletEventViewer onEventSelect={onEventSelect} />
      </TestWrapper>
    );
    
    const eventCard = screen.getByText('Front Door').closest('[role="button"], div[class*="cursor-pointer"]');
    if (eventCard) {
      fireEvent.click(eventCard);
      expect(onEventSelect).toHaveBeenCalled();
    }
  });
});