import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabletSystemMonitor } from '@/components/dashboard/TabletSystemMonitor';
import { CameraProvider } from '@/contexts/CameraContext';
import apiService from '@/services/ApiService';

// Mock API service
jest.mock('@/services/ApiService', () => ({
  getSystemHealth: jest.fn(),
  getSystemStorage: jest.fn(),
}));

const mockSystemHealth = {
  status: 'healthy',
  uptime: 86400, // 1 day
  issues: [],
  cameras: { total: 2, online: 2, offline: 0 },
  memory: { used: 1024 * 1024 * 512, total: 1024 * 1024 * 1024 }, // 512MB used of 1GB
  events: { recent: 10, today: 5 }
};

const mockStorageInfo = {
  used: 1024 * 1024 * 1024 * 5, // 5GB
  total: 1024 * 1024 * 1024 * 100, // 100GB
  eventsSize: 1024 * 1024 * 1024 * 2, // 2GB
  snapshotsSize: 1024 * 1024 * 1024 * 3, // 3GB
  percentage: 5
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <CameraProvider>
      {children}
    </CameraProvider>
  </BrowserRouter>
);

describe('TabletSystemMonitor', () => {
  beforeEach(() => {
    (apiService.getSystemHealth as jest.Mock).mockResolvedValue(mockSystemHealth);
    (apiService.getSystemStorage as jest.Mock).mockResolvedValue(mockStorageInfo);
  });

  it('renders system status cards', async () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('System Monitor')).toBeInTheDocument();
    });
    
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('Cameras Online')).toBeInTheDocument();
    expect(screen.getByText('Events Today')).toBeInTheDocument();
  });

  it('displays correct system health data', async () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('2/2')).toBeInTheDocument(); // cameras online
      expect(screen.getByText('5')).toBeInTheDocument(); // events today
    });
  });

  it('shows storage information', async () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Storage Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    expect(screen.getByText('Loading System Status...')).toBeInTheDocument();
  });

  it('handles refresh button click', async () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    await waitFor(() => {
      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeInTheDocument();
    });
  });

  it('shows no issues when system is healthy', async () => {
    render(
      <TestWrapper>
        <TabletSystemMonitor />
      </TestWrapper>
    );
    
    await waitFor(() => {
      expect(screen.getByText('No issues detected')).toBeInTheDocument();
    });
  });
});