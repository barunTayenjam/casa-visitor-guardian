import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TabletAnalytics from '@/pages/TabletAnalytics';
import apiService from '@/services/ApiService';

// Mock API service
jest.mock('@/services/ApiService', () => ({
  getHourlyAnalytics: jest.fn(),
  getWeeklyAnalytics: jest.fn(),
  getMonthlyAnalytics: jest.fn(),
}));

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
}));

const mockHourlyData = [
  { hour: 0, count: 5 },
  { hour: 1, count: 3 },
  { hour: 8, count: 15 },
  { hour: 12, count: 20 },
  { hour: 18, count: 25 },
  { hour: 22, count: 10 }
];

const mockWeeklyData = {
  totalEvents: 150,
  dailyBreakdown: [
    { date: '2024-01-01', count: 20 },
    { date: '2024-01-02', count: 25 },
    { date: '2024-01-03', count: 30 }
  ]
};

const mockMonthlyData = {
  totalEvents: 500,
  weeklyBreakdown: [
    { week: 'Week 1', count: 120 },
    { week: 'Week 2', count: 130 },
    { week: 'Week 3', count: 125 },
    { week: 'Week 4', count: 125 }
  ]
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('TabletAnalytics', () => {
  beforeEach(() => {
    (apiService.getHourlyAnalytics as jest.Mock).mockResolvedValue(mockHourlyData);
    (apiService.getWeeklyAnalytics as jest.Mock).mockResolvedValue(mockWeeklyData);
    (apiService.getMonthlyAnalytics as jest.Mock).mockResolvedValue(mockMonthlyData);
  });

  it('renders analytics dashboard title', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  it('displays key metrics cards', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Total Events (Week)')).toBeInTheDocument();
      expect(screen.getByText('Daily Average')).toBeInTheDocument();
      expect(screen.getByText('Peak Hour')).toBeInTheDocument();
      expect(screen.getByText('Peak Activity')).toBeInTheDocument();
    });
  });

  it('shows correct weekly total', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument(); // weekly total
    });
  });

  it('displays charts', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Activity Pattern')).toBeInTheDocument();
      expect(screen.getByText('Weekly Trend')).toBeInTheDocument();
      expect(screen.getByText('Monthly Overview')).toBeInTheDocument();
    });
    
    // Check for chart components
    expect(screen.getAllByTestId('chart-container')).toHaveLength(3);
  });

  it('shows loading state initially', () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    expect(screen.getByText('Loading Analytics...')).toBeInTheDocument();
  });

  it('displays activity insights', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Activity Insights')).toBeInTheDocument();
      expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    });
  });

  it('calculates peak hour correctly', async () => {
    render(
      <TestWrapper>
        <TabletAnalytics />
      </TestWrapper>
    );
    
    await waitFor(() => {
      // Peak hour should be 18:00 (25 events)
      expect(screen.getByText('18:00')).toBeInTheDocument();
    });
  });
});